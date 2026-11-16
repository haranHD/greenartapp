// Greenart Properties Brand & System Color Palette (Violet, Gold & White Luxury Theme)

export const Colors = {
  // Brand Royal Violet
  primary: '#240046',
  primaryDark: '#17002E',
  primaryLight: '#3B0764',
  primaryMuted: '#F5F3FF',
  primaryBorder: '#DDD6FE',
  violetAccent: '#581C87',
  violetHover: '#6B21A8',

  // Brand Luxurious Gold
  gold: '#D4AF37',
  goldDark: '#B45309',
  goldLight: '#FDE047',
  goldMuted: '#FEFCE8',
  goldBorder: '#FDE68A',
  goldText: '#92400E',

  // Crisp White & Neutral Backgrounds
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  surfaceMuted: '#F3E8FF',

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#EEF2F6',
  borderMuted: '#E2E8F0',
  borderGold: '#FDE68A',

  // Typography
  textPrimary: '#182230',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textGold: '#B45309',
  textInverse: '#FFFFFF',

  // Source Categories & Verification Badges (Gold, Violet & Statutory)
  verifiedTransaction: '#D4AF37',
  verifiedTransactionBg: '#FEFCE8',
  verifiedTransactionBorder: '#FDE68A',

  guidelineValue: '#2563EB',
  guidelineValueBg: '#EFF6FF',
  guidelineValueBorder: '#BFDBFE',

  askingPrice: '#D97706',
  askingPriceBg: '#FEF3C7',
  askingPriceBorder: '#FDE68A',

  // Feedback & Alert
  success: '#15803D',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FECACA',
} as const;

export type ColorToken = keyof typeof Colors;
