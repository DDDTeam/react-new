import type {Component} from '../component';

export const isProvider = (component: Component) => {
  return component.isProvider;
};

export const isConsumer = (component: Component) => {
  return component.isConsumer;
};
