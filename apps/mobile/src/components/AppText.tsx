import React, { createContext, useContext } from 'react';
import { Platform, StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import { containsTamil, Fonts, fontForWeight, Typography } from '../theme/typography';

// Preserve nested text inheritance (including the two-tone hero) while selecting real font weights.
const TextContext = createContext<{ weight: string | number; editorial: boolean } | null>(null);
export function AppText({ children, style, ...props }: any) {
  const parent = useContext(TextContext);
  const flat = StyleSheet.flatten(style) || {};
  const weight = flat.fontWeight ?? parent?.weight ?? '400';
  const editorial = flat.fontFamily === Fonts.editorial || (!flat.fontFamily && !!parent?.editorial);
  const family = editorial ? Fonts.editorial : flat.fontFamily?.startsWith('PlusJakartaSans_') ? flat.fontFamily : fontForWeight(weight);
  const defaults = parent ? {} : {
    fontSize: Typography.body.fontSize,
    lineHeight: flat.lineHeight ?? Math.ceil((flat.fontSize ?? 14) * 1.5),
  };
  // Explicit script runs work on native too; a CSS fallback stack alone would only cover web.
  const content = React.Children.map(children, (child: any) => typeof child === 'string' && containsTamil(child)
    ? child.split(/([\u0B80-\u0BFF\u200C\u200D]+)/u).map((run, i) => containsTamil(run)
      ? <NativeText key={i} style={{ fontFamily: fontForWeight(weight, true), fontWeight: 'normal' }}>{run}</NativeText>
      : run)
    : child);
  return <TextContext.Provider value={{ weight, editorial }}><NativeText {...props} style={[
    defaults, style, { fontFamily: family, fontWeight: 'normal', fontVariant: ['tabular-nums'] },
  ]}>{content}</NativeText></TextContext.Provider>;
}

export function AppTextInput({ style, value, defaultValue, placeholder, ...props }: any) {
  const flat = StyleSheet.flatten(style) || {};
  const tamil = containsTamil(String(value ?? defaultValue ?? '')) || containsTamil(placeholder ?? '');
  const weight = flat.fontWeight ?? '400';
  const family = fontForWeight(weight, tamil);
  return <NativeTextInput {...props} value={value} defaultValue={defaultValue} placeholder={placeholder} style={[
    { fontSize: 14 }, style,
    { fontFamily: Platform.OS === 'web' ? `${fontForWeight(weight)}, ${fontForWeight(weight, true)}, sans-serif` : family, fontWeight: 'normal' },
  ]} />;
}
