/** @type {import('jest').Config} */
module.exports = {
    // Use babel-jest for TypeScript
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { presets: ['module:@react-native/babel-preset'] }],
    },

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    // Ignore patterns
    testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.expo/'],

    // Transform these ESM modules from node_modules
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|@testing-library|expo|@expo|zustand|msw|@bundled-es-modules|strict-event-emitter|outvariant|@mswjs|@open-draft|until-async)/)',
    ],

    // Module extensions
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    // Path aliases
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },

    // Test patterns
    testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],

    // Coverage
    collectCoverageFrom: [
        'utils/**/*.{ts,tsx}',
        'stores/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'services/**/*.{ts,tsx}',
        '!**/*.d.ts',
    ],
    coverageDirectory: '<rootDir>/coverage',

    // Use Node environment for unit tests
    testEnvironment: 'node',

    // Clear mocks between tests
    clearMocks: true,
};
