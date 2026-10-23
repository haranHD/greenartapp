/// <reference types="node" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element {}
}

declare module 'react' {
  export const React: any;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useState<T = any>(): [T | undefined, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[] | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T>(initialValue?: T): { current: T | undefined };
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export type ErrorInfo = any;
  export class Component<P = {}, S = {}> {
    constructor(props: P);
    props: P;
    state: S;
    context: any;
    refs: any;
    forceUpdate(callback?: () => void): void;
    setState(state: Partial<S> | ((prevState: S) => Partial<S>), callback?: () => void): void;
    render(): ReactNode;
  }
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-native' {
  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
  };
  export const Text: any;
  export const View: any;
  export const SafeAreaView: any;
  export const ScrollView: any;
  export const StatusBar: any;
  export const TouchableOpacity: any;
  export const Image: any;
  export const TextInput: any;
  export const FlatList: any;
  export const ActivityIndicator: any;
  export const Platform: any;
  export const BackHandler: {
    addEventListener(eventName: string, handler: () => boolean | null | undefined): { remove: () => void };
    removeEventListener(eventName: string, handler: () => boolean | null | undefined): void;
    exitApp(): void;
  };
  export const KeyboardAvoidingView: any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
  export function useSafeAreaInsets(): { top: number; right: number; bottom: number; left: number };
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

