// 앱은 세로 화면으로만 열리게 되어 있습니다(app.json의 "orientation": "portrait").
// 그러면 구글 플레이가 "세로 화면이 꼭 필요한 앱"으로 보고, 태블릿·PC(Desktop)·XR 기기에서 설치를 막을 수 있습니다.
// 이 파일은 설치 파일 설명서(AndroidManifest)에 "세로 화면은 있으면 좋지만 꼭 필요하지는 않음"이라고 적어 줍니다.
// 앱이 세로로 열리는 것은 그대로입니다.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURES = ['android.hardware.screen.portrait'];

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] || [];
    for (const name of FEATURES) {
      const found = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name);
      if (found) found.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
