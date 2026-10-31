const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(mobileRoot, '../..');

const mobileNodeModules = path.resolve(mobileRoot, 'node_modules');
const rootNodeModules = path.resolve(monorepoRoot, 'node_modules');

if (!fs.existsSync(mobileNodeModules)) {
  fs.mkdirSync(mobileNodeModules, { recursive: true });
}
if (!fs.existsSync(rootNodeModules)) {
  fs.mkdirSync(rootNodeModules, { recursive: true });
}

function ensureBiDirectionalLink(pkgName) {
  const mobilePkg = path.resolve(mobileNodeModules, pkgName);
  const rootPkg = path.resolve(rootNodeModules, pkgName);

  if (fs.existsSync(rootPkg) && !fs.existsSync(mobilePkg)) {
    try {
      fs.symlinkSync(rootPkg, mobilePkg, 'junction');
      console.log(`[EAS Build] Linked ${pkgName} from root to mobile/node_modules`);
    } catch (e) {
      console.warn(`[EAS Build] Failed to link ${pkgName} to mobile:`, e.message);
    }
  } else if (fs.existsSync(mobilePkg) && !fs.existsSync(rootPkg)) {
    try {
      fs.symlinkSync(mobilePkg, rootPkg, 'junction');
      console.log(`[EAS Build] Linked ${pkgName} from mobile to root/node_modules`);
    } catch (e) {
      console.warn(`[EAS Build] Failed to link ${pkgName} to root:`, e.message);
    }
  }
}

// Ensure both levels have these critical native packages
[
  'react-native',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-webview',
  'expo',
  'expo-modules-core'
].forEach(ensureBiDirectionalLink);
