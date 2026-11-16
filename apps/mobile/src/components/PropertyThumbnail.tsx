import React, { useEffect, useState } from 'react';
import { Image, View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Premium as P } from '../theme/premium';
export function PropertyThumbnail({ uri, style }: { uri?: string; style?: object }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? <Image accessibilityLabel="Property photo supplied with this listing" source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} /> :
    <View style={[style, { backgroundColor: P.lavender, alignItems: 'center', justifyContent: 'center', gap: 9 }]}><Feather accessible={false} name="map" size={30} color={P.purple} /><Text style={{ fontSize: 12, color: P.secondary }}>No photo provided</Text></View>;
}
