const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const hasMonorepoModules = fs.existsSync(path.resolve(monorepoRoot, 'node_modules'));
config.watchFolders = hasMonorepoModules ? [monorepoRoot] : [projectRoot];

// Canonical paths to strictly deduplicate React across all monorepo workspaces and node_modules
const reactCanonicalPath = fs.realpathSync(require.resolve('react'));
const reactDomCanonicalPath = fs.realpathSync(require.resolve('react-dom'));
const reactJsxRuntimePath = fs.realpathSync(require.resolve('react/jsx-runtime'));
const reactJsxDevRuntimePath = fs.realpathSync(require.resolve('react/jsx-dev-runtime'));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return {
      filePath: reactCanonicalPath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react-dom') {
    return {
      filePath: reactDomCanonicalPath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react/jsx-runtime') {
    return {
      filePath: reactJsxRuntimePath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return {
      filePath: reactJsxDevRuntimePath,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
