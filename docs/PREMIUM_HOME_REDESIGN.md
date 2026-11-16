# Premium Modern home screen

Implemented the supplied Style 1 brief in the existing Expo / React Native home screen. The user confirmed keeping the neutral **Property insights** header. The approved violet/gold bottom navigation, API contracts, route mappings and valuation rules are unchanged.

## Files

- `apps/mobile/src/screens/HomeScreen.tsx`: premium search card, actual selected-location row, responsive actions, three existing research tools, lavender information panel and screen/focus animation.
- `apps/mobile/src/components/AppHeader.tsx`: neutral header, restrained profile action, real health-state indicator and compact large-text layout.
- `apps/mobile/src/components/FeatureIcon.tsx`: existing outline icon family using the new violet token.
- `apps/mobile/src/components/PropertyHero.tsx`: violet gradient, champagne heading and subtle gold architectural linework.
- `apps/mobile/src/components/PremiumPressable.tsx`: reusable press-scale and tool highlight feedback with reduced-motion support.
- `apps/mobile/src/hooks/useReducedMotion.ts`: native accessibility preference and browser preference subscriptions with cleanup.
- `apps/mobile/src/theme/premium.ts`: scoped presentation tokens so unrelated evidence/status colours are unaffected.

The hero uses the brief's permitted local gradient fallback. No suitable licensed property photo was bundled; no remote image URL, synthetic listing, or new image dependency was introduced. The information panel remains noninteractive and therefore has no misleading disclosure control.

## Verification

- Strict mobile TypeScript check passed.
- Expo web export passed.
- All 23 existing mobile tests passed (7 authentication, 7 locality search, 9 valuation API).
- Mocked browser checks passed at 320, 360, 390, 440, 768 and 1440 pixels, with no horizontal overflow or runtime exceptions.
- Tested three research tools, map selection navigation and all five approved bottom destinations.
- Tested visible search provider errors, genuine no-match results, failed place-details preserving the old pin, successful Bhavani selection, and valuation receiving Bhavani/Erode and coordinates 11.4471/77.684.
- Tested browser reduced-motion card feedback and an enlarged-text wrapping stress check. Native accessibility font scaling, iOS/Android keyboard behaviour and physical safe areas still need device QA.
- No lint script is configured for this mobile workspace. No native application binary was built in this environment.
- All browser API traffic was mocked; no live provider usage, email sends or database writes occurred.
