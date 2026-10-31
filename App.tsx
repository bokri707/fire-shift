import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState as RNAppState, KeyboardAvoidingView, Platform, Pressable, StatusBar as RNStatusBar, Text, View } from 'react-native';
import AdBanner from './src/AdBanner';
import CalendarScreen from './src/screens/CalendarScreen';
import CloudSync from './src/CloudSync';
import DutyNotifier from './src/DutyNotifier';
import PairScreen from './src/screens/PairScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TeamScreen from './src/screens/TeamScreen';
import { autoLeaveKakao, codeFromUrl, inKakaoBrowser, openInExternalBrowser } from './src/lib/link';
import { bump } from './src/lib/usage';
import { StoreProvider, focusKind, groupKind, useStore } from './src/store';
import { useTheme } from './src/theme';

type Tab = 'cal' | 'team' | 'meet' | 'pair' | 'set';
const TABS: { v: Tab; label: string }[] = [
  { v: 'cal', label: '달력' },
  { v: 'team', label: '팀' },
  { v: 'meet', label: '모임' },
  { v: 'pair', label: '부부·육아' },
  { v: 'set', label: '설정' },
];

function Shell(): React.ReactElement {
  const t = useTheme();
  const { state, update } = useStore();
  const [tab, setTab] = useState<Tab>(codeFromUrl() ? 'team' : 'cal');
  useEffect(() => { if (Platform.OS === 'web') autoLeaveKakao(); }, []);

  // 처음에는 달력·설정만 보여 주고, 소모임에 들어가거나 설정에서 켜면 해당 탭이 나타납니다.
  const groups = (state.cloud ? [state.cloud] : []).concat(state.others || []);
  const teamShown = state.teamOn === true || groups.some((g) => groupKind(g) === 'team') || !!codeFromUrl();
  const meetShown = state.meetOn === true || groups.some((g) => groupKind(g) === 'meet');
  const pairShown = state.pairOn === true;
  const shown = TABS.filter((x) => x.v === 'cal' || x.v === 'set' || (x.v === 'team' && teamShown) || (x.v === 'meet' && meetShown) || (x.v === 'pair' && pairShown));
  const cur: Tab = shown.some((x) => x.v === tab) ? tab : 'cal';

  // 사용 횟수 (합계만): 앱을 열 때, 탭을 볼 때
  useEffect(() => {
    bump('open');
    const sub = RNAppState.addEventListener('change', (st) => { if (st === 'active') bump('open'); });
    return () => sub.remove();
  }, []);
  const go = (v: Tab): void => {
    setTab(v);
    bump(v === 'meet' ? 'team' : v);
    // 팀·모임 탭은 그 종류의 소모임을 보여 주도록 맞춥니다.
    if (v === 'team' || v === 'meet') update((s) => focusKind(s, v));
  };
  // 보고 있는 소모임의 종류가 바뀌면(가입·종류 변경) 그 종류의 탭으로 옮겨 갑니다.
  const curKind = state.cloud ? groupKind(state.cloud) : '';
  const curCode = state.cloud ? state.cloud.code : '';
  useEffect(() => {
    if (!curKind) return;
    setTab((tb) => (tb === 'team' && curKind === 'meet' ? 'meet' : tb === 'meet' && curKind === 'team' ? 'team' : tb));
  }, [curCode, curKind]);
  const kakao = Platform.OS === 'web' && inKakaoBrowser();
  const top = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 52;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: t.bg, paddingTop: top }}>
      <CloudSync tab={cur} />
      <DutyNotifier />
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {kakao ? (
        <Pressable onPress={openInExternalBrowser} style={{ backgroundColor: t.accent, paddingVertical: 10, paddingHorizontal: 18 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>카카오톡 안에서는 정보가 사라질 수 있어요. 눌러서 크롬(기본 브라우저)으로 열기 ›</Text>
        </Pressable>
      ) : null}
      <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={{ color: t.ink2, fontSize: 12 }}>당 · 비 · 비</Text>
        <Text style={{ color: t.ink, fontSize: 26, fontWeight: '700' }}>소방 교대달력</Text>
      </View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.surface, marginTop: 8 }}>
        {shown.map((x) => (
          <Pressable
            key={x.v}
            accessibilityRole="tab"
            accessibilityState={{ selected: cur === x.v }}
            onPress={() => go(x.v)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: cur === x.v ? t.accent : 'transparent' }}
          >
            <Text style={{ color: cur === x.v ? t.accent : t.ink2, fontWeight: cur === x.v ? '700' : '500', fontSize: 14 }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: cur === 'cal' ? 'flex' : 'none' }}><CalendarScreen /></View>
        <View style={{ flex: 1, display: cur === 'team' ? 'flex' : 'none' }}><TeamScreen kind="team" /></View>
        <View style={{ flex: 1, display: cur === 'meet' ? 'flex' : 'none' }}><TeamScreen kind="meet" /></View>
        <View style={{ flex: 1, display: cur === 'pair' ? 'flex' : 'none' }}><PairScreen /></View>
        <View style={{ flex: 1, display: cur === 'set' ? 'flex' : 'none' }}><SettingsScreen onDone={() => go('cal')} /></View>
      </View>
      <AdBanner />
    </KeyboardAvoidingView>
  );
}

export default function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
