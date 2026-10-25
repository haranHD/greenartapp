const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Determine valid roots (supports both monorepo root and isolated Vercel project root)
const hasMonorepoModules = fs.existsSync(path.resolve(monorepoRoot, 'node_modules'));
const nodeModulesRoot = hasMonorepoModules ? monorepoRoot : projectRoot;

// 1. Watch folders
config.watchFolders = hasMonorepoModules ? [monorepoRoot] : [projectRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(hasMonorepoModules ? [path.resolve(monorepoRoot, 'node_modules')] : []),
];

// Helper to safely resolve single instance of a package
function resolvePkg(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot, nodeModulesRoot] }));
  } catch {
    return path.resolve(nodeModulesRoot, 'node_modules', name);
  }
}

const reactPath = resolvePkg('react');
const reactDomPath = resolvePkg('react-dom');

// 3. Force Metro to strictly deduplicate React and React-DOM across the monorepo
config.resolver.extraNodeModules = {
  react: reactPath,
  'react-dom': reactDomPath,
  'react/jsx-runtime': path.resolve(reactPath, 'jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(reactPath, 'jsx-dev-runtime'),
};

module.exports = config;
