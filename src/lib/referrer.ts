import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { normCode, validCode } from '../cloud';

const KEY = 'fire-shift-referrer-v1';

/**
 * 구글 플레이 초대 링크(...&referrer=code%3D코드)로 설치한 뒤 앱을 처음 열 때, 초대 코드를 한 번만 돌려줍니다.
 * 안드로이드 앱에서만 동작하며, 코드가 없거나 이미 확인했으면 빈 글자입니다. 기기 밖으로 아무것도 보내지 않습니다.
 */
export async function installReferrerCode(): Promise<string> {
  if (Platform.OS !== 'android') return '';
  try {
    if ((await AsyncStorage.getItem(KEY)) === '1') return '';
    await AsyncStorage.setItem(KEY, '1');
    const raw = await Application.getInstallReferrerAsync();
    const m = /(?:^|&)code=([^&]+)/.exec(String(raw || ''));
    if (!m) return '';
    const cd = normCode(decodeURIComponent(m[1]));
    return validCode(cd) ? cd : '';
  } catch (e) {
    return '';
  }
}
