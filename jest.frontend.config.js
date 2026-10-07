module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleDirectories: ['node_modules', '<rootDir>/server/node_modules'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/test-support/react-native-mock.ts',
    '^react-native-keyboard-aware-scroll-view$': '<rootDir>/src/test-support/keyboard-scroll-mock.ts',
    '^react-native-calendars$': '<rootDir>/src/test-support/calendars-mock.tsx',
    '^react-native-screens$': '<rootDir>/src/test-support/third-party-mocks.tsx',
    '^react-native-ratings$': '<rootDir>/src/test-support/third-party-mocks.tsx',
    '^react-native-check-box$': '<rootDir>/src/test-support/third-party-mocks.tsx',
    '^rn-bottom-drawer$': '<rootDir>/src/test-support/third-party-mocks.tsx',
    '^@react-navigation/native$': '<rootDir>/src/test-support/navigation-mock.tsx',
    '^@react-navigation/native-stack$': '<rootDir>/src/test-support/navigation-mock.tsx',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/test-support/image-mock.js',
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
