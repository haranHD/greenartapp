/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element {}
}

declare module 'react' {
  export const React: any;
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useRef<T>(initialValue?: T): { current: T };
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export default React;
}

declare module 'react-dom/client' {
  export function createRoot(container: any): {
    render(children: any): void;
    unmount(): void;
  };
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'leaflet' {
  const L: any;
  export default L;
}

declare module 'react-leaflet' {
  export const MapContainer: any;
  export const TileLayer: any;
  export const Marker: any;
  export const Popup: any;
  export const Circle: any;
  export const useMap: any;
  export const useMapEvents: any;
}
