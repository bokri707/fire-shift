import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StatusBar as RNStatusBar, Text, View } from 'react-native';
import CalendarScreen from './src/screens/CalendarScreen';
import CloudSync from './src/CloudSync';
import SettingsScreen from './src/screens/SettingsScreen';
import TeamScreen from './src/screens/TeamScreen';
import { autoLeaveKakao, codeFromUrl, inKakaoBrowser, openInExternalBrowser } from './src/lib/link';
import { StoreProvider } from './src/store';
import { useTheme } from './src/theme';

type Tab = 'cal' | 'team' | 'set';
const TABS: { v: Tab; label: string }[] = [
  { v: 'cal', label: '달력' },
  { v: 'team', label: '팀·모임' },
  { v: 'set', label: '설정' },
];

function Shell(): React.ReactElement {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>(codeFromUrl() ? 'team' : 'cal');
  useEffect(() => { if (Platform.OS === 'web') autoLeaveKakao(); }, []);
  const kakao = Platform.OS === 'web' && inKakaoBrowser();
  const top = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 52;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: t.bg, paddingTop: top }}>
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
        {TABS.map((x) => (
          <Pressable
            key={x.v}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === x.v }}
            onPress={() => setTab(x.v)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: tab === x.v ? t.accent : 'transparent' }}
          >
            <Text style={{ color: tab === x.v ? t.accent : t.ink2, fontWeight: tab === x.v ? '700' : '500', fontSize: 14 }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: tab === 'cal' ? 'flex' : 'none' }}><CalendarScreen /></View>
        <View style={{ flex: 1, display: tab === 'team' ? 'flex' : 'none' }}><TeamScreen /></View>
        <View style={{ flex: 1, display: tab === 'set' ? 'flex' : 'none' }}><SettingsScreen onDone={() => setTab('cal')} /></View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function App(): React.ReactElement {
  return (
    <StoreProvider>
      <CloudSync />
      <Shell />
    </StoreProvider>
  );
}
