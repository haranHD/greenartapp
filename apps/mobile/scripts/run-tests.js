const path = require('path');
const fs = require('fs');

const mobileDir = path.resolve(__dirname, '..');
const outDir = path.join(mobileDir, '.test_build');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const mockReactNative = path.join(mobileDir, 'scripts', 'mock-react-native.js');
const mockExpoConstants = path.join(mobileDir, 'scripts', 'mock-expo-constants.js');
const esbuild = require('esbuild');
const testFiles = fs.readdirSync(path.join(mobileDir, 'src', '__tests__'))
  .filter((file) => file.endsWith('.test.ts'));

console.log('[Test Runner] Bundling test suites with esbuild...');
for (const file of testFiles) {
  esbuild.buildSync({
    entryPoints: [path.join(mobileDir, 'src', '__tests__', file)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(outDir, file.replace(/\.ts$/, '.cjs')),
    alias: { 'react-native': mockReactNative, 'expo-constants': mockExpoConstants },
  });
}

console.log('[Test Runner] Executing node:test suites...');
const { execFileSync } = require('child_process');
for (const file of testFiles) {
  execFileSync(process.execPath, [path.join(outDir, file.replace(/\.ts$/, '.cjs'))],
    { cwd: mobileDir, stdio: 'inherit' });
}
