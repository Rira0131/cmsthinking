// ── 내장자료 삭제 목록 (관리자: Supabase Storage 전체 반영) ──
const CMS_CONFIG_FILE = 'cms_config.json';
async function loadCmsConfig() {
  try {
    const { data, error } = await _sb.storage.from('lesson-images').download(CMS_CONFIG_FILE);
    if (error || !data) return;
    const text = await data.text();
    const cfg = JSON.parse(text);
    _state.deletedBuiltinIds = cfg.deleted_builtin_ids || [];
  } catch(e) { console.warn('config 로드 실패 (첫 실행이면 정상):', e); }
}
async function saveCmsConfig() {
  try {
    const cfg = JSON.stringify({ deleted_builtin_ids: _state.deletedBuiltinIds });
    const blob = new Blob([cfg], { type: 'application/json' });
    await _sb.storage.from('lesson-images').upload(CMS_CONFIG_FILE, blob, { upsert: true });
  } catch(e) { console.error('config 저장 실패:', e); }
}

// ── 데이터 접근 함수 (Supabase _state 기반) ──
function getDeletedBuiltinIds() { return _state.deletedBuiltinIds; }
function setDeletedBuiltinIds(ids) { _state.deletedBuiltinIds = ids; }
function getAllLessons() {
  const deleted = _state.deletedBuiltinIds;
  const builtins = DATA.lessons.map((l, i) => ({...l, id: l.id || 'builtin_' + i, builtin: true}))
    .filter(l => !deleted.includes(l.id));
  return [...builtins, ..._state.customLessons.map(l => ({...l, custom: true}))];
}
function getCustomLessons() {
  return _state.customLessons;
}

// ── 교과 인덱스 데이터 ──
const CURRICULUM_INDEX = {"sections":{"IG":[{"code":"V-1","themes":[{"name":"우리 집에 외계 생명체가 살아요","isNew":false},{"name":"도형 조각 형제들","isNew":false}]},{"code":"V-2","themes":[{"name":"숲속 마을 곰돌이","isNew":false},{"name":"산타를 찾아요","isNew":false}]},{"code":"V-3","themes":[{"name":"몬스터 여행기","isNew":false},{"name":"숲속 동물 학교","isNew":false}]},{"code":"O-1","themes":[{"name":"푸카우카","isNew":false},{"name":"모여라 도형 친구들","isNew":false}]},{"code":"O-2","themes":[{"name":"친구들 찾아요","isNew":false},{"name":"더더와 대대","isNew":false}]},{"code":"O-3","themes":[{"name":"숫자나라","isNew":false},{"name":"그림 조각 놀이","isNew":false}]},{"code":"N-1","themes":[{"name":"알록달록","isNew":false},{"name":"이쪽일까 저쪽일까","isNew":false}]},{"code":"N-2","themes":[{"name":"달이와 별이","isNew":false},{"name":"자리를 찾아주세요","isNew":false}]},{"code":"N-3","themes":[{"name":"셈이 필요해","isNew":false},{"name":"여러 가지 모양","isNew":false}]},{"code":"K-1","themes":[{"name":"깨비 마을","isNew":false},{"name":"지지와 나니","isNew":false}]},{"code":"K-2","themes":[{"name":"토토네 마을 소소한 이야기","isNew":false},{"name":"어떻게 알았지, 몰래 보았을지도 몰라","isNew":false}]},{"code":"K-3","themes":[{"name":"누구세요","isNew":false},{"name":"친구들에게 물어보았어요","isNew":false}]}],"PRE":[{"code":"A-1","themes":[{"name":"사고뭉치 신데렐라","isNew":false},{"name":"삼각형과 사각형","isNew":false},{"name":"뾰로롱 뾰로롱","isNew":false},{"name":"무거운 것이 좋아","isNew":false}]},{"code":"A-2","themes":[{"name":"변신! 패턴블록","isNew":false},{"name":"어떤 수가 올까","isNew":false},{"name":"같은 모양 다른 모양","isNew":false},{"name":"물놀이는 즐거워","isNew":false}]},{"code":"A-3","themes":[{"name":"나누미 친구들","isNew":false},{"name":"숫자나라 운동회","isNew":false},{"name":"줄줄이 삼각형","isNew":false},{"name":"거미와 개미","isNew":false}]},{"code":"R-1","themes":[{"name":"테트로미노","isNew":false},{"name":"제멋대로 별","isNew":false},{"name":"곰들의 소풍","isNew":false},{"name":"두더지 마을","isNew":false}]},{"code":"R-2","themes":[{"name":"추리게임","isNew":false},{"name":"자리를 찾아라","isNew":false},{"name":"한 바퀴","isNew":false},{"name":"대로대로","isNew":false}]},{"code":"R-3","themes":[{"name":"유추게임","isNew":false},{"name":"난 알아요","isNew":false},{"name":"UFO퍼즐","isNew":false},{"name":"블랙일병 구하기","isNew":false}]},{"code":"C-1","themes":[{"name":"평면도형","isNew":false},{"name":"네벌랜드","isNew":false},{"name":"꼬부랑 지팡이","isNew":false},{"name":"이중추리게임","isNew":false}]},{"code":"C-2","themes":[{"name":"너, 슈퍼맨이지","isNew":false},{"name":"홀수와 짝수","isNew":false},{"name":"아기 늑대 삼형제","isNew":false},{"name":"도대체 몇 개야?","isNew":false}]},{"code":"C-3","themes":[{"name":"겹쳐질까요?","isNew":false},{"name":"쌓기나무놀이","isNew":false},{"name":"알포의 모험","isNew":false},{"name":"어부왕 피셔","isNew":false}]},{"code":"H-1","themes":[{"name":"네모나라","isNew":false},{"name":"펼치면 어떻게 될까?","isNew":false},{"name":"여왕과 앨리스","isNew":false},{"name":"성냥개비 놀이","isNew":false}]},{"code":"H-2","themes":[{"name":"스무고개","isNew":false},{"name":"요리보고 조리보고","isNew":false},{"name":"수학 실험","isNew":false},{"name":"경찰과 도둑","isNew":false}]},{"code":"H-3","themes":[{"name":"셋게임","isNew":false},{"name":"씨를 뿌려요요","isNew":false},{"name":"폴리아몬드","isNew":false},{"name":"마법의 약","isNew":false}]},{"code":"E-1","themes":[{"name":"얼렁이네 저녁식사","isNew":false},{"name":"병정놀이","isNew":false},{"name":"손오공","isNew":false},{"name":"영웅 람고","isNew":false}]},{"code":"E-2","themes":[{"name":"무엇을 알아야 할까?","isNew":false},{"name":"회전탑의 비밀","isNew":false},{"name":"사이좋은 삼남매","isNew":false},{"name":"내 자리는 어디?","isNew":false}]},{"code":"E-3","themes":[{"name":"디퍼를 찾아라","isNew":false},{"name":"폴리큐브","isNew":false},{"name":"늘이고 구부리고","isNew":false},{"name":"꿀벌의 집","isNew":false}]},{"code":"S-1","themes":[{"name":"기사 랜스롱","isNew":false},{"name":"내 맘대로 팔아요","isNew":false},{"name":"어떻게 나누지?","isNew":false},{"name":"색종이 놀이","isNew":false}]},{"code":"S-2","themes":[{"name":"뿌삐와 친구들","isNew":false},{"name":"눈금 없는 자","isNew":false},{"name":"위앞옆","isNew":false},{"name":"퀴즈네르 퍼즐","isNew":false}]},{"code":"S-3","themes":[{"name":"퀴즈네르 쌓기","isNew":false},{"name":"꼼꼼이네 아이스크림","isNew":false},{"name":"보지 않아도 알아요","isNew":false},{"name":"섬나라 꿈","isNew":false}]}],"WHY1":[{"code":"1-1","themes":[{"name":"보물섬","isNew":false},{"name":"월드컵","isNew":false},{"name":"구멍을 뚫어라","isNew":false},{"name":"삼각형 퍼즐","isNew":false}]},{"code":"1-2","themes":[{"name":"시간 알아보기","isNew":false},{"name":"쌓기나무","isNew":false},{"name":"지혜로운 일솝","isNew":false},{"name":"진영 바꾸기","isNew":false}]},{"code":"1-3","themes":[{"name":"바둑돌 규칙","isNew":false},{"name":"동글벌레 이야기","isNew":true},{"name":"만칼라 게임","isNew":true},{"name":"미로 찾기","isNew":false}]},{"code":"2-1","themes":[{"name":"도형 게임","isNew":true},{"name":"곱셈법","isNew":false},{"name":"축구 게임","isNew":false},{"name":"딩동댕","isNew":false}]},{"code":"2-2","themes":[{"name":"15만들기","isNew":false},{"name":"(新)분수 어림하기","isNew":true},{"name":"땅따먹기","isNew":false},{"name":"수학탐정","isNew":false}]},{"code":"2-3","themes":[{"name":"도형의 규칙성","isNew":false},{"name":"수리수리 마수리","isNew":false},{"name":"고누","isNew":false},{"name":"펀펀 퍼즐","isNew":true}]},{"code":"3-1","themes":[{"name":"적의 함선을 격침하라","isNew":false},{"name":"주사위와 전개도","isNew":false},{"name":"토끼몰이","isNew":false},{"name":"(新)퀵 드로잉","isNew":true}]},{"code":"3-2","themes":[{"name":"(新)곱곱이","isNew":true},{"name":"탱그램","isNew":false},{"name":"양을 가둬라","isNew":false},{"name":"벌집은 왜 육각기둥일까","isNew":false}]},{"code":"3-3","themes":[{"name":"기본도형 그리기","isNew":false},{"name":"에프론의 주사위","isNew":false},{"name":"야구게임","isNew":false},{"name":"헥스","isNew":false}]},{"code":"4-1","themes":[{"name":"4색 정리","isNew":false},{"name":"지혜 대탐험","isNew":false},{"name":"가우스 이야기","isNew":false},{"name":"도형의 분할","isNew":false}]},{"code":"4-2","themes":[{"name":"벌집 퍼즐","isNew":false},{"name":"원의 중심 찾기","isNew":false},{"name":"기사단의 이동","isNew":false},{"name":"가져가기 놀이 Ⅰ","isNew":false}]},{"code":"4-3","themes":[{"name":"정사각형 퍼즐","isNew":false},{"name":"삼각그물 놀이","isNew":false},{"name":"자라나는 새싹","isNew":false},{"name":"솔리테르","isNew":false}]}],"WHY2":[{"code":"5-1","themes":[{"name":"약수를 이용한 빙고놀이","isNew":false},{"name":"딴짓 일보","isNew":false},{"name":"도형의 넓이","isNew":false},{"name":"아르키메데스 퍼즐","isNew":false}]},{"code":"5-2","themes":[{"name":"강 건너기","isNew":false},{"name":"발상의 전환 Ⅰ","isNew":false},{"name":"단위 분수","isNew":false},{"name":"성냥 퍼즐","isNew":false}]},{"code":"5-3","themes":[{"name":"종이접기로 도형 만들기","isNew":false},{"name":"꼭지네모 놀이","isNew":false},{"name":"수의 규칙성","isNew":false},{"name":"창고정리","isNew":false}]},{"code":"6-1","themes":[{"name":"하트 퍼즐","isNew":false},{"name":"한 번씩만 지나요","isNew":true},{"name":"소수의 정체를 밝혀라","isNew":false},{"name":"분수와 소수의 카드게임","isNew":false}]},{"code":"6-2","themes":[{"name":"두 가지로 나타낸 세상","isNew":true},{"name":"내각의 합과 외각의 합","isNew":false},{"name":"(新)나이트 퍼즐","isNew":true},{"name":"원의 측정","isNew":false}]},{"code":"6-3","themes":[{"name":"복면산","isNew":false},{"name":"지오보드 게임","isNew":false},{"name":"슬라이딩 퍼즐","isNew":false},{"name":"조각보와 퀼트","isNew":false}]},{"code":"7-1","themes":[{"name":"테셀레이션 Ⅰ","isNew":false},{"name":"단서는 바로 수","isNew":true},{"name":"두 개로 충분씨의 비밀 레시피","isNew":true},{"name":"마법의 카드","isNew":false}]},{"code":"7-2","themes":[{"name":"배수 판별법","isNew":false},{"name":"(新)제멋대로 교통신호","isNew":true},{"name":"거듭제곱","isNew":false},{"name":"즐거운 논리 퍼즐","isNew":false}]},{"code":"7-3","themes":[{"name":"요술 달걀","isNew":false},{"name":"마방진 Ⅰ","isNew":false},{"name":"바둑돌 배열하기","isNew":false},{"name":"주사위를 굴려라","isNew":false}]},{"code":"8-1","themes":[{"name":"테트로미노","isNew":false},{"name":"등식의 이해","isNew":false},{"name":"주기","isNew":false},{"name":"발상의 전환 Ⅱ","isNew":false}]},{"code":"8-2","themes":[{"name":"소마 큐브","isNew":false},{"name":"Pick의 정리","isNew":false},{"name":"파스칼의 삼각형","isNew":false},{"name":"시크릿 사건 파일","isNew":true}]},{"code":"8-3","themes":[{"name":"방정식","isNew":false},{"name":"여러 가지 대칭","isNew":false},{"name":"나만의 연산 만들기","isNew":false},{"name":"네모네모 로직","isNew":false}]}],"WHY3":[{"code":"9-1","themes":[{"name":"암호 만들기와 해독","isNew":false},{"name":"기둥과 뿔의 부피 관계","isNew":false},{"name":"펜토미노","isNew":false},{"name":"색다른 볼링","isNew":false}]},{"code":"9-2","themes":[{"name":"도형의 결정 및 합동","isNew":false},{"name":"n진법의 연산","isNew":false},{"name":"필승전략을 찾아라","isNew":false},{"name":"알쏭달쏭 주사위","isNew":true}]},{"code":"9-3","themes":[{"name":"닮은 도형","isNew":false},{"name":"시간과 각","isNew":false},{"name":"모순과 역설","isNew":false},{"name":"스도쿠","isNew":false}]},{"code":"10-1","themes":[{"name":"악마의 퍼즐","isNew":false},{"name":"동그란 이슬비","isNew":false},{"name":"마방진 Ⅱ","isNew":false},{"name":"가져가기 놀이 Ⅱ","isNew":false}]},{"code":"10-2","themes":[{"name":"유클리드 호제법","isNew":false},{"name":"라틴 방진","isNew":false},{"name":"오일러의 정리 Ⅰ","isNew":false},{"name":"신비로운 수","isNew":false}]},{"code":"10-3","themes":[{"name":"단면도","isNew":false},{"name":"도형수","isNew":false},{"name":"기사들의 바꿔치기","isNew":false},{"name":"15퍼즐","isNew":false}]},{"code":"11-1","themes":[{"name":"하노이 탑 Ⅰ","isNew":false},{"name":"홀짝성","isNew":false},{"name":"개구리","isNew":false},{"name":"아인슈타인 퍼즐","isNew":false}]},{"code":"11-2","themes":[{"name":"부분 분수","isNew":false},{"name":"π 이야기","isNew":false},{"name":"수학의 착각","isNew":false},{"name":"사이클로이드","isNew":false}]},{"code":"11-3","themes":[{"name":"무한의 신비","isNew":false},{"name":"도형분할 게임","isNew":false},{"name":"길은 몇 가지?","isNew":false},{"name":"코드를 찾아라","isNew":false}]},{"code":"12-1","themes":[{"name":"뫼비우스의 띠","isNew":false},{"name":"피타고라스의 정리 Ⅰ","isNew":false},{"name":"달력 이야기","isNew":false},{"name":"프랙탈","isNew":false}]},{"code":"12-2","themes":[{"name":"황금비","isNew":false},{"name":"피타고라스의 정리 Ⅱ","isNew":false},{"name":"보이는 점","isNew":false},{"name":"참말과 거짓말 Ⅰ","isNew":false}]},{"code":"12-3","themes":[{"name":"정다면체","isNew":false},{"name":"정다면체의 순환","isNew":false},{"name":"바닥 덮기 퍼즐","isNew":false},{"name":"캐치 미","isNew":false}]}],"WHY4":[{"code":"13-1","themes":[{"name":"반사","isNew":false},{"name":"테셀레이션 Ⅱ","isNew":false},{"name":"작도 Ⅰ","isNew":false},{"name":"준정다면체","isNew":false}]},{"code":"13-2","themes":[{"name":"비둘기집의 원리 Ⅰ","isNew":false},{"name":"편지를 볼 수 있을까?","isNew":false},{"name":"피보나치 수열","isNew":false},{"name":"수박 자르기","isNew":false}]},{"code":"13-3","themes":[{"name":"참말과 거짓말 Ⅱ","isNew":false},{"name":"해밀턴 경로","isNew":false},{"name":"맨홀 뚜껑은 왜 둥글까?","isNew":false},{"name":"큐브 퍼즐","isNew":false}]},{"code":"14-1","themes":[{"name":"비둘기집의 원리 Ⅱ","isNew":false},{"name":"하노이 탑 Ⅱ","isNew":false},{"name":"논리적 추론","isNew":false},{"name":"축구 리그","isNew":false}]},{"code":"14-2","themes":[{"name":"가짜를 찾아라","isNew":false},{"name":"작도 Ⅱ","isNew":false},{"name":"캔 한 개를 더 넣을 수 있을까?","isNew":false},{"name":"고지를 점령하라","isNew":false}]},{"code":"14-3","themes":[{"name":"순열과 조합 Ⅰ","isNew":false},{"name":"작도 Ⅲ","isNew":false},{"name":"게임 이론","isNew":false},{"name":"성벽을 쌓아라","isNew":false}]},{"code":"15-1","themes":[{"name":"닮은 도형 퍼즐","isNew":false},{"name":"대푯값과 통계","isNew":false},{"name":"순열과 조합 Ⅱ","isNew":false},{"name":"Common Knowledge","isNew":false}]},{"code":"15-2","themes":[{"name":"복면산 Ⅱ","isNew":false},{"name":"증명과 귀류법","isNew":false},{"name":"페르마의 점","isNew":false},{"name":"삼각형의 중심","isNew":false}]},{"code":"15-3","themes":[{"name":"비유클리드 기하학","isNew":false},{"name":"연분수","isNew":false},{"name":"수학적 귀납법","isNew":false},{"name":"오일러 정리 Ⅱ","isNew":false}]}]}};

// 테마명 → 작성된 자료가 있는지 체크
// 로마자(유니코드 Ⅰ-Ⅹ, 영문 I-V)는 아라비아 숫자로 통일하고,
// 조사 '의' 유무 차이도 무시해서 매칭 실패를 줄인다.
function _normalizeThemeKey(s) {
  if (!s) return '';
  let t = String(s).toLowerCase();
  // 1) 유니코드 소문자 로마자(U+2170~U+2179): ⅰ→1 ... ⅹ→10
  const romanLower = {'ⅰ':'1','ⅱ':'2','ⅲ':'3','ⅳ':'4','ⅴ':'5','ⅵ':'6','ⅶ':'7','ⅷ':'8','ⅸ':'9','ⅹ':'10'};
  t = t.replace(/[ⅰ-ⅹ]/g, ch => romanLower[ch] || ch);
  // 2) 유니코드 대문자 로마자(U+2160~U+2169)는 toLowerCase가 자동 변환하지만
  //    환경에 따라 그대로 남을 수 있어 안전하게 한 번 더 처리
  const romanUpper = {'Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','Ⅹ':'10'};
  t = t.replace(/[Ⅰ-Ⅹ]/g, ch => romanUpper[ch] || ch);
  // 3) 단어 경계의 영문 로마자(i, ii, iii, iv, v) → 숫자
  //    "I love math" 같은 일반 영문은 건드리지 않도록 앞에 공백/기호 경계가 있을 때만 변환
  const ascRoman = {'i':'1','ii':'2','iii':'3','iv':'4','v':'5'};
  t = t.replace(/(^|[\s\-_(\[])(iv|v|iii|ii|i)\b/g, (_, pre, r) => pre + ascRoman[r]);
  // 4) 조사 '의' 무시 (오일러의 정리 ≡ 오일러 정리)
  t = t.replace(/의/g, '');
  // 5) 공백·기호 제거 + 머리의 '新' 또는 '(新)' 제거
  return t.replace(/[\s\-_().·,'·"\[\]]+/g, '').replace(/^新|\(新\)|\[新\]/g, '');
}
let _lessonThemeIndex = null;
function buildLessonThemeIndex() {
  const idx = new Map(); // normalized theme key → [lesson_id, ...]
  getAllLessons().forEach(l => {
    const title = l.title || '';
    const key = _normalizeThemeKey(title);
    // 또한 'WHY 11-3-1 무한의 신비'에서 마지막 의미 부분 추출
    // 키 자체로 매칭하기 어려우니, 모든 테마명을 순회하며 부분 매칭
    if (!idx.has('__all__')) idx.set('__all__', []);
    idx.get('__all__').push({ id: l.id, title, normTitle: key, level: l.level, author: l.author });
  });
  _lessonThemeIndex = idx;
}
function findLessonsForTheme(themeName) {
  if (!_lessonThemeIndex) buildLessonThemeIndex();
  const key = _normalizeThemeKey(themeName);
  if (!key) return [];
  const all = _lessonThemeIndex.get('__all__') || [];
  return all.filter(l => l.normTitle.includes(key));
}

// ── 전체 레벨별 인덱스 페이지 렌더 (3패널 가로 × 각 3열 = 9열) ──
function renderCurriculumIndex() {
  const container = document.getElementById('curriculum-grid');
  if (!container) return;
  buildLessonThemeIndex();
  const search = (document.getElementById('curr-search-input')?.value || '').trim().toLowerCase();
  const sec = CURRICULUM_INDEX.sections;

  const renderCell = (item) => {
    const themes = item.themes || [];
    const themesWithMatch = themes.map(t => ({ ...t, matched: findLessonsForTheme(t.name).length > 0 }));
    const matchCount = themesWithMatch.filter(t => t.matched).length;
    const allDone = matchCount === themes.length && themes.length > 0;
    const someDone = matchCount > 0 && !allDone;
    const cls = allDone ? 'has-all' : someDone ? 'has-some' : '';
    let matchesSearch = true;
    if (search) {
      const inCode = item.code.toLowerCase().includes(search);
      const inTheme = themes.some(t => t.name.toLowerCase().includes(search));
      matchesSearch = inCode || inTheme;
    }
    const dim = !matchesSearch ? 'dim' : '';
    const themesHtml = themesWithMatch.map(t => {
      const c = (t.matched ? 'has-lesson ' : '') + (t.isNew ? 'is-new' : '');
      return `<div class="curr-theme ${c}" onclick="event.stopPropagation();searchByTheme('${t.name.replace(/'/g, "\\'")}')" ondblclick="event.stopPropagation();openPortalSearchFromIndex(${JSON.stringify(t.name)},'${item.code}')" title="클릭: 교안 필터 / 더블클릭: 자료실 검색">${escHtml(t.name)}</div>`;
    }).join('');
    return `<div class="curr-cell ${cls} ${dim}" onclick="searchByTheme('${item.code}')">
      <div class="curr-cell-code">${escHtml(item.code)}</div>
      <div class="curr-cell-themes">${themesHtml}</div>
    </div>`;
  };

  // 각 섹션 패널 — 3열 그리드 (-1 / -2 / -3)
  const igHtml = `<div class="curr-section sec-ig">
    <div class="curr-section-header">생각하는 I.G</div>
    <div class="curr-grid-3">${(sec.IG||[]).map(renderCell).join('')}</div>
  </div>`;
  const preHtml = `<div class="curr-section sec-pre">
    <div class="curr-section-header">Pre-WHY</div>
    <div class="curr-grid-3">${(sec.PRE||[]).map(renderCell).join('')}</div>
  </div>`;
  // WHY는 4개 그룹을 합쳐서 정렬 후 3열
  const whyAll = [...(sec.WHY1||[]), ...(sec.WHY2||[]), ...(sec.WHY3||[]), ...(sec.WHY4||[])];
  whyAll.sort((a,b) => {
    const pa = a.code.split('-').map(Number);
    const pb = b.code.split('-').map(Number);
    return (pa[0]-pb[0]) || (pa[1]-pb[1]);
  });
  const whyHtml = `<div class="curr-section sec-why">
    <div class="curr-section-header">WHY (1~15레벨)</div>
    <div class="curr-grid-3">${whyAll.map(renderCell).join('')}</div>
  </div>`;

  container.innerHTML = `<div class="curr-table">${igHtml}${preHtml}${whyHtml}</div>`;
}

// [신규] 테마 필터 상태 — 인덱스에서 테마 클릭 시 활성화되는 별도 필터
//   · 일반 검색은 제목+목표+활동+자료 모든 텍스트를 뒤지므로 "주기"처럼 흔한 단어는
//     무관한 교안까지 매칭됨. 테마 필터는 제목과만 정규화 매칭하여 정확히 그 테마의
//     교안만 보여준다.
let _themeFilter = '';

function clearThemeFilter() {
  _themeFilter = '';
  const banner = document.getElementById('theme-filter-banner');
  if (banner) banner.style.display = 'none';
  if (typeof filterLessons === 'function') filterLessons();
}

function _applyThemeFilterUI() {
  const banner = document.getElementById('theme-filter-banner');
  const nameEl = document.getElementById('theme-filter-name');
  if (!banner) return;
  if (_themeFilter) {
    if (nameEl) nameEl.textContent = _themeFilter;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function searchByTheme(themeName) {
  // [수정] 일반 검색창에 테마명을 넣으면 본문까지 매칭되어 무관한 교안이 잡힌다.
  //   대신 _themeFilter 상태를 사용해 제목 매칭(인덱스의 매칭 로직과 동일) 모드로
  //   필터링한다. 검색창은 비워서 사용자가 추가로 검색어를 입력할 수 있게 한다.
  _themeFilter = themeName;
  showPage('library');
  setTimeout(() => {
    const authorFilter = document.getElementById('author-filter');
    if (authorFilter) authorFilter.value = '';
    if (typeof currentLevel !== 'undefined') currentLevel = '';
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    _applyThemeFilterUI();
    if (typeof filterLessons === 'function') filterLessons();
  }, 100);
}

// 대시보드 진척도 위젯 렌더
function renderCurriculumProgress() {
  const container = document.getElementById('curriculum-progress');
  if (!container) return;
  buildLessonThemeIndex();
  const sec = CURRICULUM_INDEX.sections;
  const groups = [
    { label: 'IG', items: sec.IG },
    { label: 'Pre-WHY', items: sec.PRE },
    { label: 'WHY 1-4', items: sec.WHY1 },
    { label: 'WHY 5-8', items: sec.WHY2 },
    { label: 'WHY 9-12', items: sec.WHY3 },
    { label: 'WHY 13-15', items: sec.WHY4 }
  ];
  const html = groups.map(g => {
    let total = 0, done = 0;
    (g.items || []).forEach(it => (it.themes||[]).forEach(t => {
      total++;
      if (findLessonsForTheme(t.name).length > 0) done++;
    }));
    const pct = total > 0 ? Math.round(done/total*100) : 0;
    return `<div class="curr-widget-cell" onclick="showPage('curriculum')" title="${g.label} ${done}/${total} (${pct}%)">
      <div class="wv">${pct}%</div>
      <div class="wl">${g.label} ${done}/${total}</div>
    </div>`;
  }).join('');
  container.innerHTML = html;
}

// ── 교과 인덱스 탭 상태 ──
let _currentCurriculumTab = '사고력';

function setCurriculumTab(tab) {
  _currentCurriculumTab = tab;
  document.getElementById('curr-tab-사고력').classList.toggle('active', tab === '사고력');
  document.getElementById('curr-tab-교과').classList.toggle('active', tab === '교과');
  document.getElementById('curr-sagoryeok-panel').style.display = tab === '사고력' ? '' : 'none';
  document.getElementById('curr-gyogwa-panel').style.display = tab === '교과' ? '' : 'none';
  if (tab === '교과') renderGyogwaIndex();
  else renderCurriculumIndex();
}

// ── 교과 인덱스 렌더 ──
function renderGyogwaIndex() {
  const container = document.getElementById('gyogwa-curriculum-grid');
  if (!container) return;

  // HTML 특수문자 이스케이프 (main.js보다 먼저 로드되므로 로컬 정의)
  function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  // onclick에 쓸 단일인용부호 이스케이프
  function _escQ(s) {
    return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  }

  const gyogwaLessons = (_state.customLessons || []).filter(function(l){ return l.lesson_type === '교과'; });
  const countMap = {};
  gyogwaLessons.forEach(function(l) {
    if (l.gyogwa_grade && l.gyogwa_unit) {
      const key = l.gyogwa_grade + '\u00A7' + l.gyogwa_unit;
      countMap[key] = (countMap[key] || 0) + 1;
    }
  });

  const groups = [
    { label: '🏫 초등학교', grades: ['초1-1','초1-2','초2-1','초2-2','초3-1','초3-2','초4-1','초4-2','초5-1','초5-2','초6-1','초6-2'] },
    { label: '🏫 중학교', grades: ['중1-1','중1-2','중2-1','중2-2','중3-1','중3-2'] },
    { label: '🏫 고등학교 (2015 개정)', grades: ['수학(상)','수학(하)','수학\u2160','수학\u2161','미적분','확률과 통계','기하'] },
    { label: '🏫 고등학교 (2022 개정)', grades: ['공통수학1','공통수학2'] },
  ];

  let html = '';
  groups.forEach(function(group) {
    let rows = '';
    group.grades.forEach(function(grade) {
      const units = (CURRICULUM_UNITS && CURRICULUM_UNITS[grade]) ? CURRICULUM_UNITS[grade] : [];
      let cells = '';
      units.forEach(function(unit) {
        const count = countMap[grade + '\u00A7' + unit] || 0;
        const cls = count > 0 ? 'gyogwa-cell has-lesson' : 'gyogwa-cell';
        cells += '<div class="' + cls + '" onclick="searchByGyogwaUnit(\'' + _escQ(grade) + '\',\'' + _escQ(unit) + '\')" title="' + _esc(grade) + ' · ' + _esc(unit) + '">'
          + '<div class="gyogwa-unit-name">' + _esc(unit) + '</div>'
          + (count > 0 ? '<div class="gyogwa-unit-count">' + count + '개</div>' : '')
          + '</div>';
      });
      rows += '<div class="gyogwa-grade-row">'
        + '<div class="gyogwa-grade-label">' + _esc(grade) + '</div>'
        + '<div class="gyogwa-units-wrap">' + cells + '</div>'
        + '</div>';
    });
    html += '<div class="gyogwa-section">'
      + '<div class="gyogwa-section-header">' + group.label + '</div>'
      + rows
      + '</div>';
  });

  container.innerHTML = html || '<div style="padding:20px;color:var(--gray-500)">교과 교안을 작성하면 여기에 인덱스가 표시됩니다</div>';
}

// 교과 인덱스 셀 클릭 → 수업 연구 자료 교과 탭으로 이동
function searchByGyogwaUnit(grade, unit) {
  if (typeof _currentLibraryTab !== 'undefined') _currentLibraryTab = '교과';
  if (typeof currentLevel !== 'undefined') currentLevel = grade;
  if (typeof _gyogwaUnitFilter !== 'undefined') _gyogwaUnitFilter = unit;
  showPage('library');
  setTimeout(() => {
    const libTabSago = document.getElementById('lib-tab-사고력');
    const libTabGyo  = document.getElementById('lib-tab-교과');
    if (libTabSago) libTabSago.classList.remove('active');
    if (libTabGyo)  libTabGyo.classList.add('active');
    const authorFilter = document.getElementById('author-filter');
    if (authorFilter) authorFilter.value = '';
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    if (typeof filterLessons === 'function') filterLessons();
  }, 100);
}

// Navigation
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  if (page === 'dashboard') renderDashboard();
  if (page === 'schedule') renderSchedule();
  if (page === 'library') renderLibrary();
  if (page === 'editor') renderMyLessons();
  if (page === 'curriculum') {
    if (_currentCurriculumTab === '교과') renderGyogwaIndex();
    else renderCurriculumIndex();
  }
}

// Toast
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Dashboard