import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { TESTER_RECRUIT } from './config';
import { useTheme } from './theme';
import { Btn } from './ui';

const KEY = 'fs-tester-closed';
const MAIL = 'mailto:eosqaws1@gmail.com?subject=' + encodeURIComponent('소방 교대달력 테스터 신청')
  + '&body=' + encodeURIComponent('구글 플레이에 쓰는 구글 계정 이메일을 적어 보내 주세요.');

interface Web { navigator?: { userAgent?: string }; location?: { href?: string } }

/** 안드로이드 폰의 웹 브라우저인지 (폰 앱, 아이폰, PC에서는 false) */
function androidWeb(): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = ((globalThis as unknown as Web).navigator || {}).userAgent || '';
  return /Android/i.test(ua);
}

/** 웹(안드로이드 폰 브라우저)에서만 보이는 "테스터 모집" 안내. 닫으면 다시 나오지 않습니다. */
export default function TesterBanner(): React.ReactElement | null {
  const t = useTheme();
  const [show, setShow] = useState(false);
  const ok = TESTER_RECRUIT && androidWeb();

  useEffect(() => {
    if (!ok) return;
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((v) => { if (live && v !== '1') setShow(true); })
      .catch(() => { if (live) setShow(true); });
    return () => { live = false; };
  }, [ok]);

  if (!ok || !show) return null;

  const close = (): void => {
    setShow(false);
    try { AsyncStorage.setItem(KEY, '1').catch(() => undefined); } catch (e) { /* 저장 실패해도 화면은 정상 */ }
  };
  const apply = (): void => {
    try {
      const w = globalThis as unknown as Web;
      if (w.location) w.location.href = MAIL;
    } catch (e) { /* 열리지 않아도 앱은 그대로 */ }
  };

  return (
    <View style={{ marginHorizontal: 12, marginTop: 8, padding: 14, gap: 8, borderRadius: 10, borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface }}>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>안드로이드 테스터를 모집해요</Text>
      <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>
        구글 플레이 출시 전 14일 테스트에 도와주세요. 안드로이드 폰만 참여할 수 있어요. 끝까지 참여하신 분께 감사 선물(구독이 생기면 1년 무료 이용권)을 드려요.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="메일로 신청하기" onPress={apply} style={{ flex: 1 }} />
        <Btn ghost label="닫기" onPress={close} style={{ flex: 1 }} />
      </View>
      <Text style={{ color: t.ink2, fontSize: 11.5, lineHeight: 16 }}>개인이 만든 앱입니다. 소방청이나 기관의 공식 서비스가 아닙니다.</Text>
    </View>
  );
}
