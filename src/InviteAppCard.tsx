import React from 'react';
import { Platform, Text, View } from 'react-native';
import { PLAY_PUBLIC } from './config';
import { codeFromUrl, playInviteLink } from './lib/link';
import { useTheme } from './theme';
import { Btn } from './ui';

interface Web { navigator?: { userAgent?: string }; location?: { href?: string } }

/**
 * 안드로이드 폰 브라우저에서 초대 링크(?code=)로 들어왔을 때만 보이는 "앱으로 쓰기" 안내입니다.
 * 구글 플레이가 공개된 뒤(config.ts의 PLAY_PUBLIC=true)부터 나옵니다. 비공개 테스트 중에는 테스터만 설치할 수 있어서 숨깁니다.
 */
export default function InviteAppCard(): React.ReactElement | null {
  const t = useTheme();
  if (!PLAY_PUBLIC || Platform.OS !== 'web') return null;
  const w = globalThis as unknown as Web;
  const ua = (w.navigator && w.navigator.userAgent) || '';
  const code = codeFromUrl();
  if (!code || !/Android/i.test(ua)) return null;
  const go = (): void => { try { if (w.location) w.location.href = playInviteLink(code); } catch (e) { /* 열리지 않아도 웹은 그대로 */ } };
  return (
    <View style={{ marginHorizontal: 12, marginTop: 8, padding: 14, gap: 8, borderRadius: 10, borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface }}>
      <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>앱으로 쓰면 더 편해요</Text>
      <Text style={{ color: t.ink, fontSize: 14, lineHeight: 21 }}>구글 플레이에서 설치하면 초대 코드가 자동으로 채워집니다. 웹에서 계속 써도 됩니다.</Text>
      <Btn label="구글 플레이에서 설치" onPress={go} />
    </View>
  );
}
