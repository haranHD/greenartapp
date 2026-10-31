const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for Monorepo Android Builds:
 * Explicitly exposes REACT_NATIVE_NODE_MODULES_DIR to rootProject.app ext
 * so third-party native libraries (like react-native-screens) can locate react-native
 * whether hoisted to monorepo root or installed locally in apps/mobile.
 */
module.exports = function withMonorepoPaths(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes('REACT_NATIVE_NODE_MODULES_DIR')) {
      const injection = `
// Monorepo react-native resolution for react-native-screens & native modules
project.ext.REACT_NATIVE_NODE_MODULES_DIR = file("\${rootProject.projectDir}/../node_modules/react-native").exists() ?
    file("\${rootProject.projectDir}/../node_modules/react-native") :
    file("\${rootProject.projectDir}/../../node_modules/react-native")
`;
      modConfig.modResults.contents = injection + modConfig.modResults.contents;
    }
    return modConfig;
  });
};
