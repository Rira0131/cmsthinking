
// ── 레벨 순서 정의 ──
const ALL_LEVELS = [
  'Pre-IG','IG-V','IG-O','IG-N','IG-K',
  'Pre-A','Pre-R','Pre-C','Pre-H','Pre-E','Pre-S',
  '1레벨','2레벨','3레벨','4레벨','5레벨','6레벨','7레벨',
  '8레벨','9레벨','10레벨','11레벨','12레벨','13레벨','14레벨','15레벨'
];
function sortLevels(levels) {
  return levels.sort((a, b) => {
    const ai = ALL_LEVELS.indexOf(a), bi = ALL_LEVELS.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}
// 작성자 이름 정규화: "황지향T", "황지향 센터장", "황지향 대리" → "황지향"
function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\s*(센터장|원장|부원장|대리|선생님|강사|원감|T|t)\s*$/, '')
    .trim();
}
// ── Supabase 초기화 ──
const _SB_URL = 'https://glnpiclivptwqvopujpe.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsbnBpY2xpdnB0d3F2b3B1anBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzUyNTAsImV4cCI6MjA5MDQxMTI1MH0.NyvL12AUiPsZhG05S3RRnlXwcYEI8Qmiat0UcP3LPUg';
const _sb = window.supabase.createClient(_SB_URL, _SB_KEY);

// ── 앱 공유 상태 (Supabase에서 로드 후 메모리에 캐시) ──
const _state = {
  schedule: null,
  customLessons: [],
  weekStatus: {},
  deletedBuiltinIds: []
};
