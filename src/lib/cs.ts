import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { cloudConfigured, rpc } from '../cloud';

export const CS_MAIL = 'eosqaws1@gmail.com';
export const CS_DOWN = '지금은 문의를 보낼 수 없어요. ' + CS_MAIL + '으로 보내 주세요.';
const APP_VER = '1.0.0';
const KEY = 'fs.csDevice';

export const CS_CATS: { v: string; label: string }[] = [
  { v: 'bug', label: '오류·고장' },
  { v: 'idea', label: '기능 제안' },
  { v: 'howto', label: '사용법 질문' },
  { v: 'privacy', label: '개인정보·삭제 요청' },
  { v: 'etc', label: '기타' },
];

export interface CsPost { id: string; category: string; body: string; status: string; reply: string | null; replied_at: string | null; created_at: string }

/** 이 폰의 임의 번호. 처음 한 번 만들어 저장하고, 다른 정보와 연결하지 않습니다. */
async function deviceId(): Promise<string> {
  try {
    const old = await AsyncStorage.getItem(KEY);
    if (old && /^[A-Za-z0-9_-]{16,64}$/.test(old)) return old;
  } catch (e) { /* 저장소를 못 읽으면 새로 만듭니다 */ }
  const CH = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const cr = (globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const bytes = new Uint8Array(32);
  if (cr && cr.getRandomValues) cr.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += CH[bytes[i] % CH.length];
  try { await AsyncStorage.setItem(KEY, s); } catch (e) { /* 저장 실패해도 이번엔 보낼 수 있습니다 */ }
  return s;
}

/** 서버 오류를 쉬운 말로 바꿉니다. 함수가 없거나 통신이 안 되면 메일 안내를 돌려줍니다. */
function friendly(e: unknown): string {
  const s = String(e);
  if (/daily_limit/.test(s)) return '하루에 3건까지만 보낼 수 있어요. 내일 다시 보내 주세요.';
  if (/too short/.test(s)) return '내용이 너무 짧아요. 5글자 이상 써 주세요.';
  if (/too long/.test(s)) return '내용이 너무 길어요. 500자 이내로 줄여 주세요.';
  return CS_DOWN;
}

export async function csSubmit(category: string, body: string): Promise<{ ok: true } | { ok: false; err: string }> {
  const b = body.trim();
  if (!b) return { ok: false, err: '내용을 써 주세요.' };
  if (b.length < 5) return { ok: false, err: '내용이 너무 짧아요. 5글자 이상 써 주세요.' };
  if (b.length > 500) return { ok: false, err: '내용이 너무 길어요. 500자 이내로 줄여 주세요.' };
  if (!cloudConfigured()) return { ok: false, err: CS_DOWN };
  try {
    await rpc('cs_submit', { p_device: await deviceId(), p_category: category, p_body: b, p_app_ver: APP_VER, p_platform: Platform.OS });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: friendly(e) };
  }
}

export async function csList(): Promise<{ ok: true; posts: CsPost[] } | { ok: false; err: string }> {
  if (!cloudConfigured()) return { ok: false, err: CS_DOWN };
  try {
    const r = (await rpc('cs_my_posts', { p_device: await deviceId() })) as CsPost[] | null;
    return { ok: true, posts: Array.isArray(r) ? r : [] };
  } catch (e) {
    return { ok: false, err: friendly(e) };
  }
}

export async function csDelete(id: string): Promise<boolean> {
  try {
    await rpc('cs_delete', { p_device: await deviceId(), p_id: id });
    return true;
  } catch (e) {
    return false;
  }
}
