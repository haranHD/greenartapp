const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const mobileDir = path.resolve(__dirname, '..');
const outDir = path.join(mobileDir, '.test_build');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const mockReactNative = path.join(mobileDir, 'scripts', 'mock-react-native.js');
const mockExpoConstants = path.join(mobileDir, 'scripts', 'mock-expo-constants.js');
const testBundle = path.join(outDir, 'valuationApi.test.cjs');

console.log('[Test Runner] Bundling test suite with esbuild...');
const esbuildCmd = `npx esbuild "${path.join(mobileDir, 'src', '__tests__', 'valuationApi.test.ts')}" ` +
  `--bundle --platform=node --format=cjs --outfile="${testBundle}" ` +
  `--alias:react-native="${mockReactNative}" ` +
  `--alias:expo-constants="${mockExpoConstants}"`;

execSync(esbuildCmd, { cwd: mobileDir, stdio: 'inherit' });

console.log('[Test Runner] Executing node:test suite...');
execSync(`node --test "${testBundle}"`, { cwd: mobileDir, stdio: 'inherit' });
