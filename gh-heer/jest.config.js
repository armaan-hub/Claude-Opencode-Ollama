module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!chalk/)',
  ],
  collectCoverageFrom: [
    'commands/**/*.js',
    'lib/**/*.js',
  ],
};
