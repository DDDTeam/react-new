import {isEqual} from '@guanghechen/fast-deep-equal';
import {destroyDOM} from './destroy-dom';
import {extractChildren} from './h';
import {mountDOM} from './mount-dom';
import {patchDOM} from './patch-dom';
import {enqueueJob} from './scheduler';
import type {Consumer, Context, Provider, VDOMNode, WithChildrenProps} from './types';
import {DOM_TYPES} from './types';
import {isConsumer, isProvider} from './utils/context';

export abstract class Component<P = {}, S = {}, C = null> {
  public isMounted = false;
  public vdom: VDOMNode | null = null;
  private hostEl: HTMLElement | null = null;
  public parent: Component | null = null;

  static defaultProps: any = {}
  static getDerivedStateFromError?(error: Error): any;

  public props: P & WithChildrenProps;
  public state: S = {} as S;

  public context: C = null as C;

  public dependencies: {consumer: Consumer<C>}[] = [];
  public subscribedProvider: Provider<C> | null = null;

  public isProvider = false
  public isConsumer = false

  constructor(props = {} as P, parentComponent: Component | null) {
    const defaultProps = this.getDefaultProps();
    this.props = { ...defaultProps, ...props } as P & WithChildrenProps;
    this.parent = parentComponent;
  }

  addDependency({consumer}: {consumer: Consumer<C>}) {
    if (!this.dependencies.some(d => d.consumer === consumer)) {
      this.dependencies.push({consumer});
      consumer.subscribedProvider = this as unknown as Provider<C>;
    }
  }

  removeDependency({consumer}: {consumer: Consumer<C>}) {
    const index = this.dependencies.findIndex(dep => dep.consumer === consumer);
    if (index !== -1) {
      this.dependencies.splice(index, 1);
      consumer.subscribedProvider = null;
    }
  }

  notify() {
    enqueueJob(() => {
      this.dependencies.forEach(({consumer}) => {
        if (consumer.isMounted) {
          const changed = consumer.updateContext();
          if (changed) {
            consumer.patch(consumer.props, consumer.state);
          }
        }
      });
    })
  }

  didMount(): void | Promise<void> {
    return Promise.resolve();
  }

  willUpdate(_nextProps:P, _nextState:S): void | Promise<void> {
    return Promise.resolve();
  }

  didUpdate(_prevProps:P, _prevState:S): void | Promise<void> {
    return Promise.resolve();
  }

  willUnmount(): void | Promise<void> {
    return Promise.resolve();
  }

  didUnmount(): void | Promise<void> {
    return Promise.resolve();
  }

  didCatch(error: Error, errorInfo: any): void | Promise<void> {
    console.error('Uncaught error:', error, errorInfo);
    return Promise.resolve();
  }

  shouldComponentUpdate(prevProps: P, nextProps: P): boolean {
    return isEqual(prevProps, nextProps);
  }

  abstract render(): VDOMNode[] | VDOMNode | Function | null | undefined;

  get elements(): HTMLElement[] {
    if (this.vdom == null) {
      return [];
    }

    if (this.vdom.type === DOM_TYPES.FRAGMENT) {
      return extractChildren(this.vdom).flatMap(child => {
        if (child.type === DOM_TYPES.COMPONENT && (child as any).component) {
          return (child as any).component.elements;
        }
        return (child as any).el ? [(child as any).el] : [];
      });
    }

    return (this.vdom as any).el ? [(this.vdom as any).el] : [];
  }

  get firstElement(): HTMLElement | undefined {
    return this.elements[0];
  }

  get offset(): number {
    if (this.vdom?.type === DOM_TYPES.FRAGMENT && this.hostEl && this.firstElement) {
      return Array.from(this.hostEl.children).indexOf(this.firstElement);
    }
    return 0;
  }

  updateProps(props: Partial<P>): void {
    const defaultProps = this.getDefaultProps();
    const newProps = { ...defaultProps, ...this.props, ...props };
    const oldProps = this.props;

    this.props = newProps;

    if (this.shouldComponentUpdate(oldProps, newProps)) {
      return;
    }

    if (isProvider(this as Component)) {
      this.notify();
    }

    this.patch(oldProps, this.state);
  }

  setState(state: Partial<S> | ((prevState: S, props: P) => Partial<S>)): void {
    const oldState = this.state

    if (typeof state === 'function') {
      this.state = {
        ...this.state,
        ...(state as (prevState: S, props: P) => Partial<S>)(this.state, this.props),
      };
    } else {
      this.state = {...this.state, ...state};
    }

    this.patch(this.props, oldState);
  }

  mount(hostEl: HTMLElement, index: number | null = null): void {
    if (this.isMounted) {
      throw new Error('Component is already mounted');
    }
    if (isConsumer(this as Component) && !this.subscribedProvider) {
      this.subscribeToProvider();
    }
    this.updateContext();

    try {
      this.vdom = this.render() as VDOMNode;
      this.hostEl = hostEl;
      this.isMounted = true;
      mountDOM(this.vdom, hostEl, index, this as Component);
    } catch (error) {
      this.handleError(error as Error, 'mount');
    }
  }

  unmount(): void {
    if (!this.isMounted) {
      return;
    }

    enqueueJob(() => this.willUnmount());
    if (this.subscribedProvider) {
      this.subscribedProvider.removeDependency({consumer: this as Component});
    }

    this.dependencies.forEach(({consumer}) => {
      consumer.subscribedProvider = null;
    });
    this.dependencies = [];

    if (this.vdom) {
      destroyDOM(this.vdom);
    }

    enqueueJob(() => this.didUnmount());
    this.vdom = null;
    this.hostEl = null;
    this.isMounted = false;
  }

  private patch(prevProps:P, prevState:S): void {
    if (!this.isMounted || !this.hostEl || !this.vdom) {
      return;
    }

    enqueueJob(() => this.willUpdate(this.props, this.state));

    try {
      const vdom = this.render() as VDOMNode;
      this.vdom = patchDOM(this.vdom, vdom, this.hostEl, this as Component);
      enqueueJob(() => this.didUpdate(prevProps, prevState));
    } catch (error) {
      this.handleError(error as Error, 'patch');
    }
  }

  private updateContext() {
    const context = Object.getPrototypeOf(this).constructor
        .contextType as Context<C>;

    let curVNode: Component | null = this.parent;
    if (context != null) {
      while (curVNode) {
        if (Object.getPrototypeOf(curVNode).constructor === context.Provider) {
          this.context = (curVNode as Provider<C>).props.value;
          return true;
        }

        curVNode = curVNode.parent;
      }

      if (curVNode == null) {
        this.context = context.defaultValue;
      }
    }

    return false;
  }

  private subscribeToProvider(): void {
    const context = Object.getPrototypeOf(this).constructor
        .contextType as Context<C>;

    if (!context) {
      return;
    }

    let curVNode: Component | null = this.parent;
    while (curVNode) {
      if (Object.getPrototypeOf(curVNode).constructor === context.Provider) {
        curVNode.addDependency({consumer: this as Component});
        break;
      }
      curVNode = curVNode.parent;
    }
  }

  getDefaultProps(): P {
    return (this.constructor as typeof Component).defaultProps || {}
  }

  private handleError(error: Error, phase: 'mount' | 'patch'): void {
    const errorBoundary = this.findClosestErrorBoundary();

    if (errorBoundary) {
      const Constructor = errorBoundary.constructor as typeof Component;

      if (Constructor.getDerivedStateFromError) {
        const newState = Constructor.getDerivedStateFromError(error);
        errorBoundary.state = { ...errorBoundary.state, ...newState };
      }

      if (errorBoundary.hostEl && errorBoundary.isMounted) {
        try {
          const vdom = errorBoundary.render() as VDOMNode;
          if (vdom) {
            errorBoundary.vdom = patchDOM(errorBoundary.vdom as VDOMNode, vdom, errorBoundary.hostEl, errorBoundary);

            enqueueJob(() => {
              const errorInfo = {
                phase,
                failedComponent: this.constructor.name,
                componentStack: this.getComponentStack()
              }
              console.error("error", error, errorInfo)
              errorBoundary.didCatch(error, errorInfo);
            });
          }
        } catch (renderError) {
          if (errorBoundary.parent) {
            errorBoundary.parent.handleError(renderError as Error, phase);
          }
        }
      }

      return;
    }

    const Constructor = this.constructor as typeof Component;

    if (Constructor.getDerivedStateFromError) {
      const newState = Constructor.getDerivedStateFromError(error);
      this.state = { ...this.state, ...newState };
    }

    enqueueJob(() => {
      this.didCatch(error, {
        phase,
        componentStack: this.getComponentStack()
      });

      if (this.hostEl && this.isMounted) {
        try {
          const vdom = this.render() as VDOMNode;
          if (vdom) {
            patchDOM(this.vdom!, vdom, this.hostEl!, this as Component);
          }
        } catch (renderError) {
          console.error('Error during error recovery render:', renderError);
        }
      }
    });
  }

  private getComponentStack(): string[] {
    const stack: string[] = [this.constructor.name];
    let current: Component | null = this.parent;

    while (current) {
      stack.push(current.constructor.name);
      current = current.parent;
    }

    return stack.reverse();
  }

  private findClosestErrorBoundary():Component | null {
    let current: Component | null = this.parent;

    while (current) {
      if (current.isErrorBoundary()) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  public isErrorBoundary(): boolean {
    return (this.constructor as typeof Component).getDerivedStateFromError !== undefined;
  }
}
