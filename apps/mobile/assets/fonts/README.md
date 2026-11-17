# Bundled application typography

All font files are static, unmodified TrueType faces from the Expo Google Fonts repository:
https://github.com/expo/google-fonts/tree/master/font-packages

- `plus-jakarta-sans`: Plus Jakarta Sans Regular (400), Medium (500), SemiBold (600), Bold (700).
- `playfair-display`: Playfair Display SemiBold (600), used only by the Home marketing hero.
- `noto-sans-tamil`: Noto Sans Tamil Regular (400), Medium (500), SemiBold (600), Bold (700), for Tamil text.

Each family is distributed under the SIL Open Font License 1.1. The adjacent `*-OFL.txt` files contain the respective copyright and license notices, sourced from the Google Fonts repository's `ofl` directory. Keep those notices when redistributing the application.

## Usage

`src/theme/typography.ts` registers the local assets and defines the shared typography scale. `AppFontLoader` uses the project's Expo Font installation and mounts the application after all text and Feather icon faces are loaded. Web loading explicitly probes Tamil glyphs as well as Latin glyphs; it does not rely on a Latin-only font observer for Tamil readiness. A load failure presents a retry action instead of displaying the application in a temporary system font.

`AppText` preserves nested text styling, selects actual static font weights, applies tabular numerals, and renders Tamil script runs with the corresponding Noto Sans Tamil face. `AppTextInput` uses Noto Sans Tamil when its value or placeholder contains Tamil. Inputs retain the original handlers, values and accessibility properties. Animated choices and bottom navigation explicitly select the bundled font faces as well.

Use Plus Jakarta Sans for functional UI and data. Limit the editorial face to approved marketing/editorial headings. App font assets are packaged by Metro; there is no runtime Google Fonts request. Map provider labels and operating-system controls retain their provider/system typography.
