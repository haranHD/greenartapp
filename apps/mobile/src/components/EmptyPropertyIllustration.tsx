import React from 'react';
import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Premium as P } from '../theme/premium';

/** Decorative, code-native artwork. Never represents a listing or a document record. */
export function EmptyPropertyIllustration({ kind = 'land' }: { kind?: 'land' | 'document' }) {
  return <View accessible={false} pointerEvents="none" style={styles.scene}>
    <View style={styles.halo} />
    <View style={[styles.tree, { left: 18 }]}><View style={styles.crown} /><View style={styles.trunk} /></View>
    <View style={[styles.tree, { right: 17, transform: [{ scale: .85 }] }]}><View style={styles.crown} /><View style={styles.trunk} /></View>
    {kind === 'land' ? <>
      <View style={styles.parcel}><View style={styles.plotLine} /><View style={[styles.plotLine, { left: 54, transform: [{ rotate: '-24deg' }] }]} /><View style={styles.road} /></View>
      <View style={styles.pin}><Feather name="map-pin" size={27} color={P.violet} /></View>
    </> : <>
      <View style={styles.paper}><View style={styles.fold} /><View style={styles.line} /><View style={styles.line} /><View style={[styles.line, { width: 24 }]} /></View>
      <View style={styles.plus}><Feather name="plus" size={22} color={P.violet} /></View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  scene: { width: 168, height: 98, alignSelf: 'center', marginBottom: 12 },
  halo: { position: 'absolute', left: 3, right: 3, bottom: 6, height: 67, borderRadius: 80, backgroundColor: '#F3ECFB' },
  tree: { position: 'absolute', bottom: 12, alignItems: 'center' },
  crown: { width: 14, height: 25, backgroundColor: '#B68ED3', borderRadius: 8 },
  trunk: { width: 2, height: 13, backgroundColor: '#78529C', marginTop: -6 },
  parcel: { position: 'absolute', left: 39, bottom: 18, width: 94, height: 45, backgroundColor: '#DCC8EE', borderWidth: 1.5, borderColor: '#9E73BF', borderRadius: 6, transform: [{ rotate: '-13deg' }] },
  plotLine: { position: 'absolute', top: 7, bottom: 7, left: 30, width: 1, backgroundColor: '#A985C4', transform: [{ rotate: '-12deg' }] },
  road: { position: 'absolute', top: 21, left: 8, right: 8, height: 2, backgroundColor: '#E4C77E', transform: [{ rotate: '8deg' }] },
  pin: { position: 'absolute', right: 40, top: 6, width: 37, height: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: P.champagne, borderRadius: 20, borderWidth: 3, borderColor: '#FFF4D6' },
  paper: { position: 'absolute', left: 55, top: 6, width: 57, height: 73, borderWidth: 2, borderColor: '#9E70BF', borderRadius: 7, backgroundColor: '#FEFCFF', paddingTop: 23, paddingLeft: 10, gap: 8 },
  fold: { position: 'absolute', right: 0, top: 0, width: 14, height: 14, backgroundColor: '#E9DCF5', borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#B290CD', borderBottomLeftRadius: 4 },
  line: { width: 32, height: 2, backgroundColor: '#B997D2', borderRadius: 1 },
  plus: { position: 'absolute', right: 38, bottom: 9, width: 29, height: 29, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: P.champagne, borderWidth: 2, borderColor: '#FFFFFF' },
});
