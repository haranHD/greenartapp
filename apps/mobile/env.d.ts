/// <reference types="node" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element {}
}

declare module 'react' {
  export const React: any;
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
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
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

