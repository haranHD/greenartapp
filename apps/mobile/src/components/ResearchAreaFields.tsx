import React from 'react';
import { View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { PremiumChoice } from './PremiumChoice';
import { ScreenUI } from '../theme/screenUI';
export function ResearchAreaFields({ area, unit, onArea, onUnit }: {
  area: string; unit: string; onArea: (value: string) => void; onUnit: (value: string) => void;
}) {
  return <View style={{ gap: 10 }}>
    <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '700' }}>Land area</Text>
    <Text style={ScreenUI.subtitle}>Enter the property extent to match relevant asking-price research.</Text>
    <TextInput accessibilityLabel="Land area for research" value={area} onChangeText={onArea} keyboardType="decimal-pad" placeholder="Enter land area" style={ScreenUI.input} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Cent', 'SqFt', 'Acre'].map(value => <PremiumChoice key={value} label={value === 'SqFt' ? 'Square feet' : value} selected={unit === value} onPress={() => onUnit(value)} />)}</View>
  </View>;
}
