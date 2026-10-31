const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(mobileRoot, '../..');

const mobileRN = path.resolve(mobileRoot, 'node_modules/react-native');
const rootRN = path.resolve(monorepoRoot, 'node_modules/react-native');

if (fs.existsSync(mobileRN) && !fs.existsSync(rootRN)) {
  try {
    fs.symlinkSync(mobileRN, rootRN, 'junction');
    console.log('[EAS Build] Successfully linked react-native to monorepo root node_modules');
  } catch (err) {
    console.warn('[EAS Build] Note: could not link react-native:', err.message);
  }
}
