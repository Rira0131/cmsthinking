// ── 교사 포털 자료실 링크 생성 ──
// 권별 고정값 (idx, top_cors_id) — teacherportals.com 해당 권 자료 전체 페이지.
// 키: 인덱스 code와 동일한 "레벨-권" 형식 (예: "12-3")
const _PORTAL_LEVEL_MAP = {
  // 1~4레벨 (WHY01~WHY04) — 1-1=28378 확인, top_cors_id=1581 공통
  '1-1':  { idx: '28378', top_cors_id: '1581', level_code: 'WHY01' },
  '1-2':  { idx: '28379', top_cors_id: '1581', level_code: 'WHY01' },
  '1-3':  { idx: '28380', top_cors_id: '1581', level_code: 'WHY01' },
  '2-1':  { idx: '28381', top_cors_id: '1581', level_code: 'WHY02' },
  '2-2':  { idx: '28382', top_cors_id: '1581', level_code: 'WHY02' },
  '2-3':  { idx: '28383', top_cors_id: '1581', level_code: 'WHY02' },
  '3-1':  { idx: '28384', top_cors_id: '1581', level_code: 'WHY03' },
  '3-2':  { idx: '28385', top_cors_id: '1581', level_code: 'WHY03' },
  '3-3':  { idx: '28386', top_cors_id: '1581', level_code: 'WHY03' },
  '4-1':  { idx: '28387', top_cors_id: '1581', level_code: 'WHY04' },
  '4-2':  { idx: '28388', top_cors_id: '1581', level_code: 'WHY04' },
  '4-3':  { idx: '28389', top_cors_id: '1581', level_code: 'WHY04' },
  // 5~8레벨 (WHY05~WHY08) — WHY1→WHY2 사이 gap 없음
  '5-1':  { idx: '28390', top_cors_id: '1581', level_code: 'WHY05' },
  '5-2':  { idx: '28391', top_cors_id: '1581', level_code: 'WHY05' },
  '5-3':  { idx: '28392', top_cors_id: '1581', level_code: 'WHY05' },
  '6-1':  { idx: '28393', top_cors_id: '1581', level_code: 'WHY06' },
  '6-2':  { idx: '28394', top_cors_id: '1581', level_code: 'WHY06' },
  '6-3':  { idx: '28395', top_cors_id: '1581', level_code: 'WHY06' },
  '7-1':  { idx: '28396', top_cors_id: '1581', level_code: 'WHY07' },
  '7-2':  { idx: '28397', top_cors_id: '1581', level_code: 'WHY07' },
  '7-3':  { idx: '28398', top_cors_id: '1581', level_code: 'WHY07' },
  '8-1':  { idx: '28399', top_cors_id: '1581', level_code: 'WHY08' },
  '8-2':  { idx: '28400', top_cors_id: '1581', level_code: 'WHY08' },
  '8-3':  { idx: '28401', top_cors_id: '1581', level_code: 'WHY08' },
  // 9~12레벨 (WHY09~WHY12) — WHY2→WHY3 사이 gap 1 (idx 28402 건너뜀), 11-1·12-x 확인됨
  '9-1':  { idx: '28403', top_cors_id: '1581', level_code: 'WHY09' },
  '9-2':  { idx: '28404', top_cors_id: '1581', level_code: 'WHY09' },
  '9-3':  { idx: '28405', top_cors_id: '1581', level_code: 'WHY09' },
  '10-1': { idx: '28406', top_cors_id: '1581', level_code: 'WHY10' },
  '10-2': { idx: '28407', top_cors_id: '1581', level_code: 'WHY10' },
  '10-3': { idx: '28408', top_cors_id: '1581', level_code: 'WHY10' },
  '11-1': { idx: '28409', top_cors_id: '1581', level_code: 'WHY11' },
  '11-2': { idx: '28410', top_cors_id: '1581', level_code: 'WHY11' },
  '11-3': { idx: '28411', top_cors_id: '1581', level_code: 'WHY11' },
  '12-1': { idx: '28412', top_cors_id: '1581', level_code: 'WHY12' },
  '12-2': { idx: '28413', top_cors_id: '1581', level_code: 'WHY12' },
  '12-3': { idx: '28414', top_cors_id: '1581', level_code: 'WHY12' },
  // 13~15레벨 (WHY13~WHY15) — WHY3→WHY4 gap 없음, 13-1=28415 확인됨
  '13-1': { idx: '28415', top_cors_id: '1581', level_code: 'WHY13' },
  '13-2': { idx: '28416', top_cors_id: '1581', level_code: 'WHY13' },
  '13-3': { idx: '28417', top_cors_id: '1581', level_code: 'WHY13' },
  '14-1': { idx: '28418', top_cors_id: '1581', level_code: 'WHY14' }, // 14-1 확인됨
  '14-2': { idx: '28419', top_cors_id: '1581', level_code: 'WHY14' },
  // 14-3: teacherportals 미업로드 — 매핑 없음 (fallback 검색으로 동작)
  '15-1': { idx: '28420', top_cors_id: '1581', level_code: 'WHY15' }, // 15-1 확인됨
  '15-2': { idx: '28421', top_cors_id: '1581', level_code: 'WHY15' },
  '15-3': { idx: '28422', top_cors_id: '1581', level_code: 'WHY15' },
  // IG — 서브레벨마다 top_cors_id 다름, idx gap 있음
  'V-1':  { idx: '28362', top_cors_id: '0',    level_code: '' }, // V-1 확인됨
  'V-2':  { idx: '28363', top_cors_id: '0',    level_code: '' },
  'V-3':  { idx: '28364', top_cors_id: '0',    level_code: '' },
  'O-1':  { idx: '28365', top_cors_id: '1579', level_code: '' }, // O-1 확인됨
  'O-2':  { idx: '28366', top_cors_id: '1579', level_code: '' },
  'O-3':  { idx: '28367', top_cors_id: '1579', level_code: '' },
  // gap: 28368~28371
  'N-1':  { idx: '28372', top_cors_id: '0',    level_code: '' }, // N-1 확인됨
  'N-2':  { idx: '28373', top_cors_id: '0',    level_code: '' },
  'N-3':  { idx: '28374', top_cors_id: '0',    level_code: '' },
  'K-1':  { idx: '28375', top_cors_id: '0',    level_code: '' }, // K-1 미확인 — top_cors_id 추정
  'K-2':  { idx: '28376', top_cors_id: '0',    level_code: '' },
  'K-3':  { idx: '28377', top_cors_id: '0',    level_code: '' },
  // Pre-WHY (A~S, top_cors_id=0, level_code 없음) — A-1=28334 확인됨, 18개 순차
  'A-1':  { idx: '28334', top_cors_id: '0', level_code: '' },
  'A-2':  { idx: '28335', top_cors_id: '0', level_code: '' },
  'A-3':  { idx: '28336', top_cors_id: '0', level_code: '' },
  'R-1':  { idx: '28347', top_cors_id: '1580', level_code: '' }, // R-1 확인됨
  'R-2':  { idx: '28348', top_cors_id: '1580', level_code: '' },
  'R-3':  { idx: '28349', top_cors_id: '1580', level_code: '' },
  'C-1':  { idx: '28350', top_cors_id: '1580', level_code: '' }, // C-1 확인됨
  'C-2':  { idx: '28351', top_cors_id: '1580', level_code: '' },
  'C-3':  { idx: '28352', top_cors_id: '1580', level_code: '' },
  'H-1':  { idx: '28353', top_cors_id: '1580', level_code: '' }, // H-1 확인됨
  'H-2':  { idx: '28354', top_cors_id: '1580', level_code: '' },
  'H-3':  { idx: '28355', top_cors_id: '1580', level_code: '' },
  'E-1':  { idx: '28356', top_cors_id: '1580', level_code: '' }, // 패턴 추정
  'E-2':  { idx: '28357', top_cors_id: '1580', level_code: '' },
  'E-3':  { idx: '28358', top_cors_id: '1580', level_code: '' },
  'S-1':  { idx: '28359', top_cors_id: '1580', level_code: '' }, // 패턴 추정
  'S-2':  { idx: '28360', top_cors_id: '1580', level_code: '' },
  'S-3':  { idx: '28361', top_cors_id: '1580', level_code: '' },
};

const _PORTAL_BASE = 'https://www.teacherportals.com/DashboardMt/BoardView?bm_code=teachers_mtfile';
const _PORTAL_FALLBACK = _PORTAL_BASE + '&bd_category=All&search_field=title';

// 제목에서 검색 키워드 추출: 앞의 번호 패턴 제거
// "12-3-1 정다면체", "WHY 10-1-2 테마", "WHY11-1-1 하노이탑", "IG-O-1-2 테마", "O-1-2 테마" 등
function _portalKeyword(title) {
  return title
    .replace(/^(?:WHY\s*)?\d[\d\-]*[-_\s]+/i, '')   // 숫자 레벨 패턴
    .replace(/^(?:IG[-_\s])?[VONK][-_\s]\d[-_\s]*/i, '')  // IG 레벨 패턴
    .replace(/^(?:Pre[-_\s])?[ARCHSE][-_\s]\d[-_\s]*/i, '') // Pre-WHY 패턴
    .trim();
}

// 제목 → 권 코드 추출 (예: "12-3-1 정다면체" → "12-3", "WHY11-1-1 하노이탑" → "11-1",
//   "IG-O-1-2 테마" → "O-1", "O-1-2 테마" → "O-1", "Pre-A-1-2" → "A-1")
function _volumeCodeFromTitle(title) {
  // WHY 숫자 레벨: "12-3-1", "WHY 12-3-1", "WHY12-3-1" (공백 있/없)
  const why = title.match(/^(?:WHY\s*)?(\d+)-(\d+)-\d+/i);
  if (why) return `${why[1]}-${why[2]}`;
  // IG 레벨: "IG-O-1-2", "IG_O_1_2", "IG O 1 2", "O-1-2", "V-1-1" 등
  const ig = title.match(/^(?:IG[-_\s])?([VONK])[-_\s](\d+)[-_\s]/i);
  if (ig) return `${ig[1].toUpperCase()}-${ig[2]}`;
  // Pre-WHY 레벨: "Pre-A-1-2", "Pre_R_1_1", "A-1-2", "R-1-3" 등
  const pre = title.match(/^(?:Pre[-_\s])?([ARCHSE])[-_\s](\d+)[-_\s]/i);
  if (pre) return `${pre[1].toUpperCase()}-${pre[2]}`;
  return '';
}

// l.level 필드("IG-O", "Pre-A", "11", "11레벨" 등) → 권 코드 (볼륨 특정 불가 → 1권)
function _levelFieldToVolumeCode(level) {
  if (!level) return '';
  // IG 레벨: "IG-O", "IG_V", "IG O" 등
  const ig = level.match(/^IG[-_\s]?([VONK])$/i);
  if (ig) return `${ig[1].toUpperCase()}-1`;
  // Pre-WHY 레벨: "Pre-A", "Pre_R", "Pre R", 또는 그냥 "A", "R" 등 단독 알파벳
  const pre = level.match(/^(?:Pre[-_\s]?)?([ARCHSE])$/i);
  if (pre) return `${pre[1].toUpperCase()}-1`;
  // WHY 숫자 레벨: "11", "11레벨", "WHY11" 등
  const why = level.match(/(\d+)/);
  if (why) return `${parseInt(why[1])}-1`;
  return '';
}

function _buildPortalUrl(volumeCode, keyword) {
  const entry = _PORTAL_LEVEL_MAP[volumeCode];
  if (entry) {
    return `${_PORTAL_BASE}&idx=${entry.idx}&pageindex=1&bd_category=All&sem_id=0&top_cors_id=${entry.top_cors_id}&level_code=${encodeURIComponent(entry.level_code)}&search_field=title&keyword=`;
  }
  // 매핑 없으면 키워드 검색 fallback
  return `${_PORTAL_FALLBACK}&keyword=${encodeURIComponent(keyword)}`;
}

function buildPortalSearchUrl(title, level) {
  let volumeCode = _volumeCodeFromTitle(title);
  // 제목에서 권 코드 추출 실패 시 l.level 필드로 fallback (볼륨 1권으로 연결)
  if (!volumeCode && level) volumeCode = _levelFieldToVolumeCode(level);
  const keyword = _portalKeyword(title);
  return _buildPortalUrl(volumeCode, keyword);
}

function _openUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openPortalSearch(title, level) {
  _openUrl(buildPortalSearchUrl(title, level));
}

// 인덱스 셀 더블클릭 — code = "12-3" (인덱스의 item.code와 동일)
function openPortalSearchFromIndex(themeName, code) {
  _openUrl(_buildPortalUrl(code, themeName));
}
