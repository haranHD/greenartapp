/** Static font faces avoid synthesized weights on Android and iOS. */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  editorial: 'PlayfairDisplay_600SemiBold',
} as const;
export const FONT_ASSETS = {
  [Fonts.regular]: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
  [Fonts.medium]: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
  [Fonts.semibold]: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
  [Fonts.bold]: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
  [Fonts.editorial]: require('../../assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
  NotoSansTamil_400Regular: require('../../assets/fonts/NotoSansTamil_400Regular.ttf'),
  NotoSansTamil_500Medium: require('../../assets/fonts/NotoSansTamil_500Medium.ttf'),
  NotoSansTamil_600SemiBold: require('../../assets/fonts/NotoSansTamil_600SemiBold.ttf'),
  NotoSansTamil_700Bold: require('../../assets/fonts/NotoSansTamil_700Bold.ttf'),
};
export const Typography = {
  hero: { fontFamily: Fonts.editorial, fontWeight: '600', fontSize: 28, lineHeight: 35, letterSpacing: -.3 },
  page: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  button: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  nav: { fontFamily: Fonts.medium, fontSize: 10, lineHeight: 15, fontWeight: 'normal' },
} as const;
export function fontForWeight(weight: string | number = '400', tamil = false): string {
  const n = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  const suffix = n >= 700 ? '700Bold' : n >= 600 ? '600SemiBold' : n >= 500 ? '500Medium' : '400Regular';
  return `${tamil ? 'NotoSansTamil' : 'PlusJakartaSans'}_${suffix}`;
}
export const containsTamil = (value: string) => /[\u0B80-\u0BFF]/u.test(value);
