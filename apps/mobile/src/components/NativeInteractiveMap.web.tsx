// Web Fallback: Web uses the direct Leaflet DOM container in App.tsx
import React from 'react';
import { View } from 'react-native';

export interface NativeInteractiveMapProps {
  targetLat: number;
  targetLng: number;
  mapZoom: number;
  activeLocality: string;
  records: any[];
  onSelectLocation: (lat: number, lng: number) => void;
  style?: any;
}

export const NativeInteractiveMap: React.FC<NativeInteractiveMapProps> = () => {
  return null;
};

