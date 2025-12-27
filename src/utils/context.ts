import type {Component} from '../component';

export const isProvider = (component: Component) => {
  console.log("isProvider")
  console.log("component.constructor.name", component.constructor.name)
  return component.isProvider;
};

export const isConsumer = (component: Component) => {
  console.log("isConsumer")
  console.log("component.constructor.name", component.constructor.name)
  return component.isConsumer;
};
