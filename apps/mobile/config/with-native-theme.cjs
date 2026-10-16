const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

module.exports = function withNativeTheme(config) {
  return withAndroidStyles(config, (mod) => {
    const parent = AndroidConfig.Styles.getAppThemeGroup();
    for (const name of ['colorAccent', 'android:colorAccent']) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        name,
        value: '#171716',
        parent,
      });
    }
    return mod;
  });
};
