const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

const extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  fs: require.resolve('react-native-fs'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer/'),
  process: require.resolve('process/browser'),
  util: require.resolve('util/'),
  'node:crypto': require.resolve('crypto-browserify'),
  'node:fs': require.resolve('react-native-fs'),
  'node:stream': require.resolve('stream-browserify'),
  'node:buffer': require.resolve('buffer/'),
  'node:process': require.resolve('process/browser'),
  'node:util': require.resolve('util/'),
};

const config = {
  resolver: {
    extraNodeModules,
  },
  watchFolders: [path.resolve(__dirname, 'node_modules')],
};

module.exports = mergeConfig(defaultConfig, config);
