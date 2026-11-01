import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import mobileAds, { BannerAd, BannerAdSize, MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';
import { ADMOB_BANNER_UNIT } from './config';

/**
 * 화면 맨 아래 배너 광고 (안드로이드/아이폰 앱 전용. 웹에서는 AdBanner.web.tsx가 대신 쓰여 아무것도 안 나옵니다.)
 * - 광고 등급을 PG 이하로 제한합니다. (성인·자극적인 광고를 줄이기 위함. 완전히 막지는 못합니다.)
 * - 광고가 안 불러와지면 자리를 차지하지 않습니다.
 */
export default function AdBanner(): React.ReactElement | null {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    mobileAds()
      .setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG })
      .then(() => mobileAds().initialize())
      .then(() => { if (alive) setReady(true); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  if (!ready) return null;
  return (
    <View style={{ alignItems: 'center', height: loaded ? undefined : 0, overflow: 'hidden' }}>
      <BannerAd
        unitId={ADMOB_BANNER_UNIT || TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}
