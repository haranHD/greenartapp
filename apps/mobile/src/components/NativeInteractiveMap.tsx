import React from 'react';
import { Platform } from 'react-native';

export interface NativeInteractiveMapProps {
  targetLat: number;
  targetLng: number;
  mapZoom: number;
  activeLocality: string;
  records: any[];
  onSelectLocation: (lat: number, lng: number) => void;
  style?: any;
  apiKey?: string;
}

export const NativeInteractiveMap: React.FC<NativeInteractiveMapProps> = (props) => {
  if (Platform.OS === 'web') {
    const { NativeInteractiveMap: WebMap } = require('./NativeInteractiveMap.web');
    return <WebMap {...props} />;
  }
  const { NativeInteractiveMap: NativeMap } = require('./NativeInteractiveMap.native');
  return <NativeMap {...props} />;
};
