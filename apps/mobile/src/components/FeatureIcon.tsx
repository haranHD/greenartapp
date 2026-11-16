import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Premium } from '../theme/premium';
/** One consistent outline icon family across customer navigation and tools. */
export function FeatureIcon({ kind }: { kind: 'valuation' | 'nearby' | 'guideline' }) {
  return <Feather accessible={false} name={kind === 'valuation' ? 'bar-chart-2' : kind === 'nearby' ? 'map-pin' : 'file-text'} size={22} color={Premium.purple} />;
}
