const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/tests/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      path.resolve(__dirname, 'node_modules/ts-jest/dist/index.js'),
      { tsconfig: '<rootDir>/backend/tsconfig.test.json' }
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
  },
};
