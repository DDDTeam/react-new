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

  public props: P & WithChildrenProps;
  public state: S = {} as S;

  public context: C = null as C;

  public dependencies: {consumer: Consumer<C>}[] = [];
  public subscribedProvider: Provider<C> | null = null;

  public isProvider = false
  public isConsumer = false

  constructor(props = {} as P, parentComponent: Component | null) {
    this.props = props as P & WithChildrenProps;
    this.parent = parentComponent;
  }

  addDependency({consumer}: {consumer: Consumer<C>}) {
    if (!this.dependencies.some(d => d.consumer === consumer)) {
      this.dependencies.push({consumer});
      consumer.subscribedProvider = this as Provider<C>;
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

  onMount(): void | Promise<void> {
    return Promise.resolve();
  }

  onUnmount(): void | Promise<void> {
    return Promise.resolve();
  }

  onWillUpdate(nextProps:P, nextState:S): void | Promise<void> {
    return Promise.resolve();
  }

  onUpdate(prevProps:P, prevState:S): void | Promise<void> {
    return Promise.resolve();
  }

  onWillUnmount(): void | Promise<void> {
    return Promise.resolve();
  }

  abstract render(): VDOMNode;

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
    const newProps = {...this.props, ...props};
    const oldProps = this.props;

    this.props = newProps;

    const isContextUpdated = this.updateContext();
    if (isEqual(oldProps, newProps) && !isContextUpdated) {
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

    this.vdom = this.render();
    mountDOM(this.vdom, hostEl, index, this as Component);
    this.hostEl = hostEl;
    this.isMounted = true;
  }

  unmount(): void {
    if (!this.isMounted) {
      return;
    }

    enqueueJob(() => this.onWillUnmount());
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

    enqueueJob(() => this.onUnmount());
    this.vdom = null;
    this.hostEl = null;
    this.isMounted = false;
  }

  private patch(prevProps:P, prevState:S): void {
    if (!this.isMounted || !this.hostEl || !this.vdom) {
      return;
    }

    enqueueJob(() => this.onWillUpdate(this.props, this.state));
    const vdom = this.render();
    this.vdom = patchDOM(this.vdom, vdom, this.hostEl, this as Component);
    enqueueJob(() => this.onUpdate(prevProps, prevState));
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
}
