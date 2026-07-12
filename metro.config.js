const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

// Bundled corpus snapshot (assets/corpus/vials_corpus.db) ships as an asset.
config.resolver.assetExts.push('db');

module.exports = config;
