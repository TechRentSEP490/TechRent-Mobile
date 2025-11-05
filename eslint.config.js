// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    settings: {
      'import/core-modules': [
        'expo-image-picker',
        'expo-print',
        'expo-sharing',
        'expo-file-system',
        '@react-native-community/datetimepicker',
      ],
    },
  },
]);
