# 소방 교대달력

소방 교대근무자를 위한 근무 달력 + 소모임(팀) 공유 앱. Expo / React Native로 만들었고 웹과 안드로이드로 나갑니다.

- 웹 주소: https://qkrrhksdud1.workers.dev (Cloudflare Workers)
- 서버: Supabase (표와 함수는 `supabase/schema.sql`)
- 저장소: github.com/bokri707/fire-shift (main에 올리면 웹이 자동 배포됩니다)

## 문서
| 문서 | 내용 |
|---|---|
| [docs/구조.md](docs/구조.md) | 코드 구조, 데이터가 어디에 저장되는지, 겉으로 안 보이는 약속들 |
| [docs/서버.md](docs/서버.md) | Supabase 표·함수, 접근 방식, 알려진 약점 |
| [docs/운영.md](docs/운영.md) | 배포, 계정 목록, 장애 대응, 월 비용 |
| [docs/통계.md](docs/통계.md) | 사용 횟수 통계와 조회 방법 |

## 내 컴퓨터에서 실행
```
npm install
npx expo start --web      # 웹으로 실행
npx expo start            # 폰(Expo Go)으로 실행
```
웹 빌드(배포용): `npx expo install react-dom react-native-web @expo/metro-runtime && npx expo export --platform web` → `dist/` 폴더가 만들어집니다.

## 폴더
```
App.tsx                 탭 화면 틀, 탭 표시 규칙, 사용 횟수 집계
src/store.tsx           앱 전체 상태 + 폰 저장(AsyncStorage)
src/types.ts            상태 타입
src/cloud.ts            Supabase 호출(RPC)
src/CloudSync.tsx       서버와 주기적으로 동기화
src/MonthCalendar.tsx   홈 달력 (스와이프, 팀 일정 점)
src/SetupCard.tsx       내 근무 설정
src/CoupleCard.tsx      연가계획표·부부 달력
src/DutyNotifier.tsx    근무·모임 알림
src/screens/            달력, 팀·모임, 설정 화면
src/lib/                날짜, 근무 계산(shift), 팀 일정(events), 공휴일, 백업, 알림, 링크, 통계(usage)
supabase/schema.sql     서버 표·함수 정의
```

## 주의
- 키·비밀번호를 코드나 문서에 넣지 마세요. `src/config.ts`에는 공개되어도 되는 publishable 키만 있습니다.
- `netlify.toml`은 예전 배포(Netlify) 설정이 남은 것입니다. 지금은 Cloudflare를 씁니다.
