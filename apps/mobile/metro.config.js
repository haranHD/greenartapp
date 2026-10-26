const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const hasMonorepoModules = fs.existsSync(path.resolve(monorepoRoot, 'node_modules'));
config.watchFolders = hasMonorepoModules ? [monorepoRoot] : [projectRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(hasMonorepoModules ? [path.resolve(monorepoRoot, 'node_modules')] : []),
];

// Helper to safely locate package root directory
function resolvePkgDir(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot, monorepoRoot] }));
  } catch {
    return path.resolve(monorepoRoot, 'node_modules', name);
  }
}

const reactDir = resolvePkgDir('react');
const reactDomDir = resolvePkgDir('react-dom');

config.resolver.extraNodeModules = {
  react: reactDir,
  'react-dom': reactDomDir,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subpath = moduleName === 'react' ? 'index.js' : moduleName.slice('react/'.length);
    const resolvedPath = path.resolve(reactDir, subpath.endsWith('.js') || subpath.endsWith('.json') ? subpath : `${subpath}.js`);
    if (fs.existsSync(resolvedPath)) {
      return { filePath: fs.realpathSync(resolvedPath), type: 'sourceFile' };
    }
  }

  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    const subpath = moduleName === 'react-dom' ? 'index.js' : moduleName.slice('react-dom/'.length);
    const resolvedPath = path.resolve(reactDomDir, subpath.endsWith('.js') || subpath.endsWith('.json') ? subpath : `${subpath}.js`);
    if (fs.existsSync(resolvedPath)) {
      return { filePath: fs.realpathSync(resolvedPath), type: 'sourceFile' };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
