import {Component} from './component';
import {createContext} from './context';
import {h, hFragment, hString} from './h';
import {render} from './render';
import {createRef} from './ref';
import type {Ref} from './ref';
import type {ComponentType} from './types/types';
import {createPortal} from './portal';

export type {ComponentType, Ref};
export {Component, createContext, createRef, h, hFragment, hString, render, createPortal};
