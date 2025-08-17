const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

// Register path mappings from tsconfig.json
tsConfigPaths.register({
  baseUrl: './src',
  paths: tsConfig.compilerOptions.paths
});
