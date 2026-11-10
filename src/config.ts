// Supabase 접속 정보입니다. (publishable 키는 공개되어도 되는 키입니다. secret/service_role 키는 넣지 마세요.)
export const SUPABASE_URL = 'https://jryjcqqabfcfahzhrrqi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_l1KyiZJRx4Afv4dTcydjlg_l2NxvPlo';

// 웹 주소(Netlify). 앱(Expo Go)에서 초대 문구에 링크를 넣고 싶으면 여기에 적으세요. 예: 'https://내이름.netlify.app'
export const SITE_URL = 'https://fire-shift.fire-shift-app.workers.dev';

// 개인정보처리방침·이용약관 공개 주소입니다. (웹 배포 때 public/ 폴더의 파일이 함께 올라갑니다.)
export const PRIVACY_URL = 'https://fire-shift.fire-shift-app.workers.dev/privacy.html';
export const TERMS_URL = 'https://fire-shift.fire-shift-app.workers.dev/terms.html';

// 안드로이드 테스터 모집 안내(웹의 안드로이드 폰 브라우저에서만 보이는 배너) 스위치입니다.
// true = 배너가 보입니다. 모집이 끝나면 false로 바꿔서 올리면 모두에게서 사라집니다.
export const TESTER_RECRUIT = true;

// 광고(AdMob) 설정입니다. 비워 두면 구글이 주는 "테스트 광고"가 나옵니다. (실제 수익은 나지 않습니다.)
// AdMob 가입 후 받은 '배너 광고 단위 ID'(ca-app-pub-숫자/숫자)를 아래 따옴표 안에 넣으면 진짜 광고로 바뀝니다.
// 앱 ID(ca-app-pub-숫자~숫자)는 이 파일이 아니라 app.json의 androidAppId 자리에 넣습니다.
export const ADMOB_BANNER_UNIT = 'ca-app-pub-3967129261197383/1130146540';

// 구글 플레이 앱 주소와 공개 여부입니다. 비공개 테스트 중에는 테스터만 설치할 수 있어서 false로 둡니다.
// 정식 출시(프로덕션)가 되면 true로 바꿔 올리세요. 웹 초대 링크 화면에 "구글 플레이에서 설치" 버튼이 나옵니다.
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=kr.fireshift.app';
export const PLAY_PUBLIC = false;
