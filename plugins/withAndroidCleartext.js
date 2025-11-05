const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin that toggles android:usesCleartextTraffic on the main application.
 * Expo Go ignores this flag, so you must build a development or production APK/AAB
 * for the setting to take effect.
 */
const withAndroidCleartext = (config, props = {}) => {
  const { enabled = true } = props;

  return withAndroidManifest(config, async (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (!application || !application.$) {
      return config;
    }

    if (enabled) {
      application.$['android:usesCleartextTraffic'] = 'true';
    } else {
      delete application.$['android:usesCleartextTraffic'];
    }

    return config;
  });
};

module.exports = withAndroidCleartext;
