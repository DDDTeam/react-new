import {isEqual} from '@guanghechen/fast-deep-equal';
import {destroyDOM} from './destroy-dom.js';
import {extractChildren} from './h.js';
import {mountDOM} from './mount-dom.js';
import {patchDOM} from './patch-dom.js';
import {enqueueJob} from './scheduler.js';
import type {ComponentState, Context, VDOMNode, WithChildrenProps} from './types';
import {DOM_TYPES} from './types';
import {isConsumer, isProvider} from './utils/context';

export abstract class Component<P = {}, S = ComponentState, ContextValueType = null> {
  public isMounted = false;
  public vdom: VDOMNode | null = null;
  private hostEl: HTMLElement | null = null;
  public parent: Component | null = null;

  public props: P & WithChildrenProps;
  public state: S = {} as S;

  public context: ContextValueType = null as ContextValueType;

  public dependencies: {consumer: Component}[] = [];
  public subscribedProvider: Component | null = null;

  public isProvider = false
  public isConsumer = false

  constructor(props = {} as P, parentComponent: Component | null) {
    this.props = props as P & WithChildrenProps;
    this.parent = parentComponent;
  }

  addDependency({consumer}: {consumer: Component}) {
    if (!this.dependencies.some(d => d.consumer === consumer)) {
      this.dependencies.push({consumer});
      consumer.subscribedProvider = this as Component;
    }
  }

  removeDependency({consumer}: {consumer: Component}) {
    const index = this.dependencies.findIndex(dep => dep.consumer === consumer);
    if (index !== -1) {
      this.dependencies.splice(index, 1);
      consumer.subscribedProvider = null;
    }
  }

  notify() {
    console.log("notify")
    console.log("this.dependencies", this.dependencies);
    this.dependencies.forEach(({consumer}) => {
      console.log("consumer", consumer);
      console.log("consumer.isMounted", consumer.isMounted);
      if ((consumer as any).isMounted) {
        const changed = consumer.updateContext();
        console.log("changed", changed);
        if (changed) {
          console.log("consumer.patch");
          consumer.patch();
        }
      }
    });
  }

  onMount(): void | Promise<void> {
    return Promise.resolve();
  }

  onUnmount(): void | Promise<void> {
    return Promise.resolve();
  }

  onUpdate(): void | Promise<void> {
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
    console.log("updateProps", this);
    const newProps = {...this.props, ...props};
    const oldProps = this.props;

    this.props = newProps;

    let isContextUpdated = this.updateContext();
    console.log("isEqual(oldProps, newProps)", isEqual(oldProps, newProps));
    console.log("isContextUpdated", isContextUpdated);
    if (isEqual(oldProps, newProps) && !isContextUpdated) {
      console.log("return");
      return;
    }

    console.log("isProvider(this.parent as Component)", isProvider(this.parent as Component));
    if (isProvider(this as Component)) {
      this.notify();
    }

    this.patch();
  }

  setState(state: Partial<S> | ((prevState: S, props: P) => Partial<S>)): void {
    if (typeof state === 'function') {
      this.state = {
        ...this.state,
        ...(state as (prevState: S, props: P) => Partial<S>)(this.state, this.props),
      };
    } else {
      this.state = {...this.state, ...state};
    }
    this.patch();
  }

  mount(hostEl: HTMLElement, index: number | null = null): void {
    if (this.isMounted) {
      throw new Error('Component is already mounted');
    }
    console.log("this", this);
    console.log("isConsumer(this as Component)", isConsumer(this as Component))
    if (isConsumer(this as Component) && !this.subscribedProvider) {
      console.log(" this.subscribeToProvider()")
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

  private patch(): void {
    if (!this.isMounted || !this.hostEl || !this.vdom) {
      return;
    }

    const vdom = this.render();
    this.vdom = patchDOM(this.vdom, vdom, this.hostEl, this as Component);
    enqueueJob(() => this.onUpdate());
  }

  private updateContext() {
    console.log("updateContext");
    const context = Object.getPrototypeOf(this).constructor
        .contextType as Context<ContextValueType>;
    console.log("context", context);

    let curVNode: Component | null | undefined = this.parent;
    if (context != null) {
      console.log(1)
      while (curVNode) {
        console.log(2)
        if (Object.getPrototypeOf(curVNode).constructor === context.Provider) {
          this.context = (curVNode as any).props.value as ContextValueType;
          console.log("this.context", this.context)
          console.log(3)
          return true;
        }

        curVNode = curVNode.parent;
      }

      if (curVNode == null) {
        console.log(4)
        this.context = context.defaultValue;
      }
    }
    console.log(5)

    return false;
  }

  private subscribeToProvider(): void {
    const context = Object.getPrototypeOf(this).constructor
        .contextType as Context<ContextValueType>;

    if (!context) {
      return;
    }

    let curVNode: Component | null | undefined = this.parent;
    while (curVNode) {
      if (Object.getPrototypeOf(curVNode).constructor === context.Provider) {
        curVNode.addDependency({consumer: this as Component});
        break;
      }
      curVNode = curVNode.parent;
    }
  }
}
