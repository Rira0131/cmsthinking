// ── 페이지네이션 & 검색 상태 ──
const LESSON_PAGE_SIZE = 20;
let _lessonOffset = 0;
let _lessonHasMore = false;
let _searchTimer = null;
let _dbSearchActive = false;

async function _sbLoad() {
  const bar = document.getElementById('load-bar');
  const loadMsg = document.getElementById('load-msg');
  try {
    bar.style.width = '30%';
    if (loadMsg) loadMsg.textContent = '데이터를 불러오는 중...';
    const schedId = getCurrentScheduleId();
    let lessonsQuery = _sb.from('custom_lessons').select('id,data', { count: 'exact' })
      .order('updated_at', { ascending: false });
    const myCenter = getCurrentCenter();
    if (_centerFilter && myCenter) {
      lessonsQuery = lessonsQuery.or(`data->>center.eq.${myCenter},data->>center.is.null`);
    }
    lessonsQuery = lessonsQuery.range(0, LESSON_PAGE_SIZE - 1);
    const [schedRes, lessonsRes, statusRes, teachersRes] = await Promise.all([
      _sb.from('seminar_schedule').select('data').eq('id', schedId).maybeSingle(),
      lessonsQuery,
      _sb.from('week_status').select('*'),
      _sb.from('teachers').select('email, name, aliases, is_admin'),
    ]);
    // [신규] teachers 결과 반영 + 로그인 시 임시 이름 정정
    if (teachersRes && !teachersRes.error && Array.isArray(teachersRes.data) && teachersRes.data.length > 0) {
      _teachers = teachersRes.data.map(t => ({
        email: (t.email || '').toLowerCase(),
        name: t.name || '',
        aliases: Array.isArray(t.aliases) ? t.aliases : [],
        is_admin: !!t.is_admin
      }));
      _teachersLoaded = true;
      const myEmail = (sessionStorage.getItem('cms_email') || '').toLowerCase();
      if (myEmail) {
        const fresh = getNameFromEmail(myEmail);
        if (fresh && fresh !== sessionStorage.getItem('cms_name')) {
          sessionStorage.setItem('cms_name', fresh);
          const tag = document.getElementById('my-name-tag');
          if (tag) {
            if (isAdmin()) {
              tag.innerHTML = '👤 ' + fresh + ' <span style="background:#DC2626;color:#fff;font-weight:700;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:4px">관리자</span>';
            } else {
              tag.textContent = '👤 ' + fresh;
            }
          }
        }
      }
    }
    bar.style.width = '80%';
    if (schedRes.data) _state.schedule = schedRes.data.data;
    if (lessonsRes.data) {
      _state.customLessons = lessonsRes.data.map(r => ({...r.data, id: r.id}));
      _lessonOffset = lessonsRes.data.length;
      _lessonHasMore = (lessonsRes.count || 0) > _lessonOffset;
      _lessonTotalCount = lessonsRes.count || _lessonOffset;
    }
    if (statusRes.data) statusRes.data.forEach(r => {
      _state.weekStatus[r.id] = {t1: r.t1_done, t2: r.t2_done};
    });
    await loadCmsConfig();
    bar.style.width = '100%';
    // 첫 화면 보여준 뒤 백그라운드에서 나머지 교안 모두 로드
    setTimeout(() => { backgroundLoadAllLessons().catch(e => console.warn('bg load:', e)); }, 300);
  } catch(e) {
    console.error('Supabase 로드 오류:', e);
    bar.style.width = '100%';
    bar.style.background = '#fca5a5';
    if (loadMsg) loadMsg.textContent = '⚠️ 서버 연결 실패 — 오프라인 모드로 실행합니다';
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ── 백그라운드 전체 교안 로드 (시작 직후 비동기로 나머지를 채움) ──
let _lessonTotalCount = 0;
let _bgLoading = false;
async function backgroundLoadAllLessons() {
  if (_bgLoading) return;
  if (!_lessonHasMore) return;
  _bgLoading = true;
  const indicator = ensureBgLoadIndicator();
  try {
    const PAGE = 200;
    while (_lessonHasMore) {
      const myCenter = getCurrentCenter();
      let q = _sb.from('custom_lessons').select('id,data', { count: 'exact' })
        .order('updated_at', { ascending: false });
      if (_centerFilter && myCenter) {
        q = q.or(`data->>center.eq.${myCenter},data->>center.is.null`);
      }
      const { data, count, error } = await q.range(_lessonOffset, _lessonOffset + PAGE - 1);
      if (error) { console.error('bg load error:', error); break; }
      const batch = (data || []).map(r => ({...r.data, id: r.id}));
      if (!batch.length) { _lessonHasMore = false; break; }
      _state.customLessons.push(...batch);
      _lessonOffset += batch.length;
      _lessonTotalCount = count || _lessonOffset;
      _lessonHasMore = _lessonOffset < _lessonTotalCount;
      // 라이브러리 페이지가 활성화되어 있으면 부드럽게 갱신
      if (document.getElementById('page-library')?.classList.contains('active')) {
        if (typeof filterLessons === 'function') filterLessons();
      }
      if (indicator) {
        indicator.textContent = `📥 추가 교안 불러오는 중... (${_lessonOffset}/${_lessonTotalCount})`;
      }
      // 다음 페이지 전에 잠깐 양보 (UI 반응성 유지)
      await new Promise(r => setTimeout(r, 30));
    }
    // 완료
    if (indicator) {
      indicator.textContent = `✅ 전체 교안 ${_lessonOffset}개 로드 완료`;
      setTimeout(() => indicator.remove(), 1500);
    }
    if (typeof filterLessons === 'function' &&
        document.getElementById('page-library')?.classList.contains('active')) {
      filterLessons();
    }
  } finally {
    _bgLoading = false;
  }
}

function ensureBgLoadIndicator() {
  let el = document.getElementById('bg-load-indicator');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'bg-load-indicator';
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(79,70,229,0.92);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;z-index:9000;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:none';
  el.textContent = '📥 추가 교안 불러오는 중...';
  document.body.appendChild(el);
  return el;
}

// ── Realtime 구독 ──
function _sbRealtime() {
  // 이미 구독 중이면 스킵
  if (window._realtimeChannel) return;

  window._realtimeChannel = _sb
    .channel('seminar-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'seminar_schedule' }, payload => {
      if (payload.eventType === 'DELETE') {
        _state.schedule = null;
      } else if (payload.new && payload.new.data) {
        _state.schedule = payload.new.data;
      }
      if (typeof renderSchedule === 'function') renderSchedule();
      if (typeof renderDashboard === 'function') renderDashboard();
      showSyncToast('📅 일정이 업데이트되었습니다');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_lessons' }, payload => {
      if (payload.eventType === 'DELETE') {
        _state.customLessons = _state.customLessons.filter(c => c.id !== payload.old.id);
      } else if (payload.eventType === 'INSERT' && payload.new) {
        const exists = _state.customLessons.some(c => c.id === payload.new.id);
        if (!exists) _state.customLessons.push({...payload.new.data, id: payload.new.id});
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const idx = _state.customLessons.findIndex(c => c.id === payload.new.id);
        if (idx >= 0) _state.customLessons[idx] = {...payload.new.data, id: payload.new.id};
        else _state.customLessons.push({...payload.new.data, id: payload.new.id});
      }
      if (typeof renderMyLessons === 'function') renderMyLessons();
      showSyncToast('📝 교안이 업데이트되었습니다');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'week_status' }, payload => {
      if (payload.new) {
        const r = payload.new;
        _state.weekStatus[r.id] = {t1: r.t1_done, t2: r.t2_done};
        if (typeof renderSchedule === 'function') renderSchedule();
        if (typeof renderDashboard === 'function') renderDashboard();
        showSyncToast('✅ 완료 상태가 업데이트되었습니다');
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_comments' }, payload => {
      const lessonId = payload.new?.lesson_id || payload.old?.lesson_id;
      if (!lessonId) return;
      // 해당 교안이 현재 열려있으면 댓글 새로고침
      const card = document.querySelector(`.lesson-card[data-lesson-id="${lessonId}"].open`);
      if (card) loadComments(lessonId);
      showSyncToast('💬 새 댓글이 달렸습니다');
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime 연결됨');
      }
    });
}

function showSyncToast(msg) {
  // 내가 직접 저장한 직후엔 토스트 안 뜨게 (300ms 이내)
  if (window._justSaved && Date.now() - window._justSaved < 300) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(79,70,229,0.92);color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;opacity:1;transition:opacity 0.4s';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2500);
}

// ── 선생님 이름 매핑 ──
// ── 선생님 정보 (Supabase teachers 테이블에서 동적 로드) ──
// DB 로드가 실패하거나 아직 안 됐을 때를 위한 fallback. 새 선생님이 추가되면
// Supabase 콘솔에서 행을 추가하면 되고, 굳이 코드를 고치지 않아도 됨.
const TEACHERS_FALLBACK = [
  // 명지센터 (mjcms.com)
  {email:'ysh@mjcms.com',  name:'윤시현', aliases:['윤시현T'],                is_admin:false},
  {email:'kkm@mjcms.com',  name:'김경미', aliases:['김경미T','김경미 대리'],   is_admin:false},
  {email:'byj@mjcms.com',  name:'변유진', aliases:['변유진T'],                is_admin:false},
  {email:'jsy@mjcms.com',  name:'제선영', aliases:['제선영T','제선영 T'],      is_admin:false},
  {email:'rira@mjcms.com', name:'황지향', aliases:['황지향T','황지향 센터장'], is_admin:true},
  // 동래본원 (drcms.com)
  {email:'lhl@drcms.com',  name:'이향림', aliases:['이향림T'],                is_admin:false},
  {email:'bsh@drcms.com',  name:'배소현', aliases:['배소현T'],                is_admin:false},
  {email:'mjh@drcms.com',  name:'문지혜', aliases:['문지혜T'],                is_admin:false},
  {email:'yis@drcms.com',  name:'유인선', aliases:['유인선T'],                is_admin:false},
  {email:'kej@drcms.com',  name:'권은정', aliases:['권은정T'],                is_admin:false},
  {email:'jsh@drcms.com',  name:'정송희', aliases:['정송희T'],                is_admin:false},
  {email:'kym@drcms.com',  name:'강영미', aliases:['강영미T'],                is_admin:false},
  {email:'hhj@drcms.com',  name:'홍현진', aliases:['홍현진T'],                is_admin:false},
  {email:'lhr@drcms.com',  name:'이혜림', aliases:['이혜림T'],                is_admin:false},
  // 동부산센터 (dbcms.com)
  {email:'leg@dbcms.com',  name:'이의금', aliases:['이의금T'],                is_admin:false},
  {email:'ymn@dbcms.com',  name:'윤미나', aliases:['윤미나T'],                is_admin:false},
  {email:'hey@dbcms.com',  name:'홍은영', aliases:['홍은영T'],                is_admin:false},
  {email:'hyj@dbcms.com',  name:'허유진', aliases:['허유진T'],                is_admin:false},
  {email:'chj@dbcms.com',  name:'최희주', aliases:['최희주T'],                is_admin:false},
  {email:'shw@dbcms.com',  name:'서헌욱', aliases:['서헌욱T'],                is_admin:false},
  {email:'pjh@dbcms.com',  name:'박지혜', aliases:['박지혜T'],                is_admin:false},
  {email:'jdu@dbcms.com',  name:'정다움', aliases:['정다움T'],                is_admin:false},
  {email:'hsh@dbcms.com',  name:'허시현', aliases:['허시현T'],                is_admin:false}
];
let _teachers = TEACHERS_FALLBACK.slice();
let _teachersLoaded = false;

async function loadTeachers() {
  try {
    const { data, error } = await _sb.from('teachers')
      .select('email, name, aliases, is_admin');
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      _teachers = data.map(t => ({
        email: (t.email || '').toLowerCase(),
        name: t.name || '',
        aliases: Array.isArray(t.aliases) ? t.aliases : [],
        is_admin: !!t.is_admin
      }));
      _teachersLoaded = true;
    }
  } catch(e) {
    console.warn('teachers 테이블 로드 실패, fallback 사용:', e);
  }
}

function getNameFromEmail(email) {
  if (!email) return '';
  const e = String(email).toLowerCase();
  const t = _teachers.find(x => x.email === e);
  return t ? t.name : email.split('@')[0];
}

// 구버전 교안: author 이름만 있고 author_email이 없을 때 이름 → 이메일 변환
function getEmailFromAuthorName(authorName) {
  if (!authorName) return '';
  for (const t of _teachers) {
    if (t.name === authorName) return t.email;
    if ((t.aliases || []).indexOf(authorName) >= 0) return t.email;
  }
  return '';
}

// ── 센터 매핑 ──
const CENTER_MAP = {
  'mjcms.com': '명지센터',
  'drcms.com': '동래본원',
  'dbcms.com': '동부산센터',
  'sbcms.com': '서부산센터'
};
// 센터별 seminar_schedule id (명지=1 기존 유지)
const CENTER_SCHEDULE_IDS = {
  'mjcms.com': 1,
  'drcms.com': 2,
  'dbcms.com': 3,
  'sbcms.com': 4
};

function getCenterFromEmail(email) {
  if (!email) return '';
  const domain = (email.split('@')[1] || '').toLowerCase();
  return CENTER_MAP[domain] || '';
}
function getCenterIdFromEmail(email) {
  if (!email) return 1;
  const domain = (email.split('@')[1] || '').toLowerCase();
  return CENTER_SCHEDULE_IDS[domain] || 1;
}
function getCurrentEmail() { return sessionStorage.getItem('cms_email') || ''; }
function getCurrentCenter() { return sessionStorage.getItem('cms_center') || ''; }
function getCurrentScheduleId() { return parseInt(sessionStorage.getItem('cms_schedule_id') || '1'); }

// ── 관리자 설정 ──
// 관리자는 모든 교안을 편집/삭제할 수 있음 (작성자 무관)
// 관리자 여부는 teachers 테이블의 is_admin 컬럼으로 결정
function isAdmin() {
  const email = (getCurrentEmail() || '').toLowerCase();
  if (!email) return false;
  const t = _teachers.find(x => x.email === email);
  return t ? !!t.is_admin : false;
}
function canEdit(l) { return isMyLesson(l) || isAdmin(); }

// 센터 필터 (true=내 센터만, false=전체) — 교안은 전 센터 공유가 기본
let _centerFilter = false;

// ── 로그인 ──
(function(){
  function enterApp(name, email) {
    sessionStorage.setItem('cms_name', name);
    if (email) {
      sessionStorage.setItem('cms_email', email);
      sessionStorage.setItem('cms_center', getCenterFromEmail(email));
      sessionStorage.setItem('cms_schedule_id', getCenterIdFromEmail(email));
    }
    document.getElementById('login-overlay').style.display = 'none';
    _sbLoad().catch(e => console.error(e)).finally(() => {
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      init();
      _sbRealtime();
    });
  }

  window.tryLogin = async function() {
    const idVal = document.getElementById('id-input').value.trim().toLowerCase();
    const pw = document.getElementById('pw-input').value;
    const inp = document.getElementById('pw-input');
    const err = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    if (!idVal) {
      err.textContent = '이메일을 입력해 주세요.';
      document.getElementById('id-input').focus();
      return;
    }
    if (!idVal.includes('@')) {
      err.textContent = '이메일 전체를 입력해 주세요. (예: ysh@mjcms.com)';
      document.getElementById('id-input').focus();
      return;
    }
    const email = idVal;
    btn.disabled = true;
    btn.textContent = '로그인 중...';
    err.textContent = '';
    try {
      const { data, error } = await _sb.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      const name = getNameFromEmail(data.user.email);
      enterApp(name, data.user.email);
    } catch(e) {
      inp.classList.add('error');
      err.textContent = '아이디 또는 비밀번호가 맞지 않습니다.';
      inp.value = '';
      setTimeout(() => inp.classList.remove('error'), 400);
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  };

  window.doLogout = async function() {
    if (!confirm('로그아웃 하시겠어요?')) return;
    await _sb.auth.signOut();
    sessionStorage.clear();
    location.reload();
  };

  // ── 비밀번호 변경 ──
  window.openPasswordChangeModal = function() {
    const modal = document.getElementById('pw-change-modal');
    if (!modal) return;
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-new2').value = '';
    document.getElementById('pw-change-error').textContent = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('pw-current').focus(), 50);
  };

  window.closePasswordChangeModal = function() {
    const modal = document.getElementById('pw-change-modal');
    if (modal) modal.style.display = 'none';
  };

  window.submitPasswordChange = async function() {
    const cur  = document.getElementById('pw-current').value;
    const newPw = document.getElementById('pw-new').value;
    const newPw2 = document.getElementById('pw-new2').value;
    const errEl = document.getElementById('pw-change-error');
    const btn = document.getElementById('pw-change-submit');
    errEl.textContent = '';

    // 입력 검증
    if (!cur)    { errEl.textContent = '현재 비밀번호를 입력해 주세요.'; return; }
    if (!newPw)  { errEl.textContent = '새 비밀번호를 입력해 주세요.'; return; }
    if (newPw.length < 6) { errEl.textContent = '새 비밀번호는 6자 이상이어야 해요.'; return; }
    if (newPw !== newPw2) { errEl.textContent = '새 비밀번호 확인이 일치하지 않습니다.'; return; }
    if (newPw === cur)    { errEl.textContent = '현재 비밀번호와 새 비밀번호가 같습니다.'; return; }

    btn.disabled = true;
    btn.textContent = '변경 중...';
    try {
      // 1) 현재 비밀번호 검증 — 본인이 맞는지 확인
      const email = sessionStorage.getItem('cms_email') || '';
      if (!email) throw new Error('세션 정보가 없습니다. 다시 로그인해 주세요.');
      const { error: verifyErr } = await _sb.auth.signInWithPassword({ email, password: cur });
      if (verifyErr) {
        errEl.textContent = '현재 비밀번호가 일치하지 않습니다.';
        btn.disabled = false;
        btn.textContent = '변경';
        return;
      }
      // 2) 새 비밀번호로 갱신
      const { error: updateErr } = await _sb.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;

      closePasswordChangeModal();
      showToast('🔑 비밀번호가 변경되었습니다');
    } catch(e) {
      console.error('비밀번호 변경 실패:', e);
      errEl.textContent = '변경에 실패했어요. 잠시 후 다시 시도해주세요.';
    } finally {
      btn.disabled = false;
      btn.textContent = '변경';
    }
  };

  // 세션 확인 (이미 로그인된 경우)
  (async () => {
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
      const name = getNameFromEmail(session.user.email);
      enterApp(name, session.user.email);
    } else {
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('login-overlay').style.display = 'flex';
    }
  })();
})();

const DATA ={"schedule": {"title": "2026 명지초등관 사고력 세미나 계획", "note": "매주 금요일 1시 30분 진행 → 수요일 1시 30분으로 변경", "months": [{"name": "3월", "direction": "고레벨 영역별 정리 (센터장)  - 언어논리 봄학기 담당 테마 중 고난도 테마 연구 (강사)", "weeks": [{"week": "1주(3/6)", "teacher1": "황지향", "teacher2": "변유진", "theme1": "13-2-2 편지를 볼 수 있을까", "theme2": "C-1-2 네벌랜드"}, {"week": "2주(3/13)", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "10-1-2  동그란 이슬비", "theme2": "2-1-3 축구 게임"}, {"week": "3주(3/20)", "teacher1": "황지향", "teacher2": "변유진", "theme1": "14-1-1 논리적 추론", "theme2": "C-1-3 꼬부랑 지팡이"}, {"week": "4주(3/25)", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "10-2-1 유클리드 호제법", "theme2": "2-2-3 땅따먹기"}]}, {"name": "4월", "direction": "고레벨 영역별 정리 (센터장)  - 기하 (정다면체) 봄학기 담당 테마 중 고난도 테마 연구 (강사)", "weeks": [{"week": "1주(3/6)", "teacher1": "1주(4/1)", "teacher2": "황지향", "theme1": "진행 테마", "theme2": "12-3-1 정다면체"}, {"week": "2주(3/13)", "teacher1": "2주(4/8)", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}, {"week": "3주(3/20)", "teacher1": "3주(4/15)", "teacher2": "황지향", "theme1": "진행 테마", "theme2": "12-3-2 정다면체의 순환"}, {"week": "4주(3/25)", "teacher1": "4주(4/22)", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}]}, {"name": "5월", "direction": "고레벨 영역별 정리 (센터장)  - 기하 (정다면체) 봄학기 담당 테마 중 고난도 테마 연구 (강사)", "weeks": [{"week": "1주(3/6)", "teacher1": "변유진", "teacher2": "1주(4/29)", "theme1": "", "theme2": "진행 테마"}, {"week": "2주(3/13)", "teacher1": "윤시현", "teacher2": "2주(5/6)", "theme1": "", "theme2": "진행 테마"}, {"week": "3주(3/20)", "teacher1": "변유진", "teacher2": "3주(5/13)", "theme1": "", "theme2": "진행 테마"}, {"week": "4주(3/25)", "teacher1": "윤시현", "teacher2": "4주(5/20)", "theme1": "", "theme2": "진행 테마"}]}, {"name": "6월~ 줌세미나 전환", "direction": "", "weeks": [{"week": "1주", "teacher1": "황지향", "teacher2": "변유진", "theme1": "", "theme2": ""}, {"week": "2주", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "", "theme2": ""}, {"week": "3주", "teacher1": "황지향", "teacher2": "변유진", "theme1": "", "theme2": ""}, {"week": "4주", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "", "theme2": ""}]}, {"name": "7월", "direction": "", "weeks": [{"week": "1주", "teacher1": "1주", "teacher2": "황지향", "theme1": "진행 테마", "theme2": ""}, {"week": "2주", "teacher1": "2주", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}, {"week": "3주", "teacher1": "3주", "teacher2": "황지향", "theme1": "진행 테마", "theme2": ""}, {"week": "4주", "teacher1": "4주", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}]}, {"name": "8월", "direction": "", "weeks": [{"week": "1주", "teacher1": "변유진", "teacher2": "1주", "theme1": "", "theme2": "진행 테마"}, {"week": "2주", "teacher1": "윤시현", "teacher2": "2주", "theme1": "", "theme2": "진행 테마"}, {"week": "3주", "teacher1": "변유진", "teacher2": "3주", "theme1": "", "theme2": "진행 테마"}, {"week": "4주", "teacher1": "윤시현", "teacher2": "4주", "theme1": "", "theme2": "진행 테마"}]}, {"name": "9월", "direction": "", "weeks": [{"week": "1주", "teacher1": "황지향", "teacher2": "변유진", "theme1": "", "theme2": ""}, {"week": "2주", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "", "theme2": ""}, {"week": "3주", "teacher1": "황지향", "teacher2": "변유진", "theme1": "", "theme2": ""}, {"week": "4주", "teacher1": "김경미", "teacher2": "윤시현", "theme1": "", "theme2": ""}]}, {"name": "10월", "direction": "", "weeks": [{"week": "1주", "teacher1": "1주", "teacher2": "황지향", "theme1": "진행 테마", "theme2": ""}, {"week": "2주", "teacher1": "2주", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}, {"week": "3주", "teacher1": "3주", "teacher2": "황지향", "theme1": "진행 테마", "theme2": ""}, {"week": "4주", "teacher1": "4주", "teacher2": "김경미", "theme1": "진행 테마", "theme2": ""}]}, {"name": "11월", "direction": "", "weeks": [{"week": "1주", "teacher1": "변유진", "teacher2": "1주", "theme1": "", "theme2": "진행 테마"}, {"week": "2주", "teacher1": "윤시현", "teacher2": "2주", "theme1": "", "theme2": "진행 테마"}, {"week": "3주", "teacher1": "변유진", "teacher2": "3주", "theme1": "", "theme2": "진행 테마"}, {"week": "4주", "teacher1": "윤시현", "teacher2": "4주", "theme1": "", "theme2": "진행 테마"}]}]}, "lessons": [{"title": "생각하는 I.G-K-1 1단원 깨비마을 2주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 자료가 가진 여러가지 속성을 이해하고, 다양한 분규 기준을 적용하여 직접 카드를 분류해봅니다.  ◎ 두 가지 속성에 따라 분류하는 복합 분류에 대해 알아봄으로써 그에 따른 포함 관계를 이해할 수 있습니다.", "teacher_objectives": "스스로 자료가 가진 속성에 대해서 대답하고 찾을 수 있도록 한다.", "curriculum": "2-1 분류하기", "cms_link": "이전 :   I.G-V 친구를 찾아요 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 자료가 가진 여러가지 속성을 이해하고, 다양한 분규 기준을 적용하여 직접 카드를 분류해봅니다.  ◎ 두 가지 속성에 따라 분류하는 복합 분류에 대해 알아봄으로써 그에 따른 포함 관계를 이해할 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "2-1 분류하기", "materials": "아직 어린 학생들이라서 90분 수업 중 5분 휴식(화장실)이 필수., 글 쓰는 시간이 오래 걸리기 때문에 최대한 간략한 필기 정리 필요."}, {"name": "CMS과정 연계", "research": "이전 :   I.G-V 친구를 찾아요 이후 :", "materials": ""}, {"name": "이웃 마을 도깨비", "research": "※ 목표 : 여러 분류를 기준으로 도깨비들을 나누어 봄으로써 복합 분류에 대하여 이해할 수 있다. Q.색들의 의미하는 것은 무엇일까? Q.이 칸의 도깨비는 어떤 특징과 어떤 특징을 가지고 있을까? 1주차에 찾은 도깨비의 분류 기준 및 속성 다시 칠판에 적어주기. (뿔 모양, 도깨비 색, 눈의 수, 옷의 무늬, 방망이 모양, 방망이 색)", "materials": "이웃 마을 도깨비 스티커", "time": "활동 전 과제 체크 30분, 활동 10분 + 5분 휴식"}, {"name": "기준을 찾아요", "research": "※ 목표 : 복합 분류의 심화 과정으로 일부 카드를 보고 묶음 고리들의 분류 기준을 파악하여 다른 도깨비들의 자리를 찾을 수 있다. Q.같은 가로줄, 세로줄의 도깨비의 공통점이 무엇일까? Q.가로줄, 세로줄의 분류 기준은? 기준에 따른 속성은? (발문 후 정리해서 적어주기.) p.18 (세로줄:옷의 무늬, 가로줄:뿔의 모양) , p.19 (세로줄:방망이 모양, 가로줄:방망이 색깔)", "materials": "", "time": "10분"}, {"name": "나는 어디에 1", "research": "※ 목표 : 여러 도깨비 카드를 묶음 고리의 속성에 따라 분류해 보고, 하나의 묶음 고리에 들어가도록 놓거나 두 묶음 고리가 겹치는 곳에 놓을 수 있다. 스티커 미리 준비해두기. 교집합이 발생하므로 스티커를 번복하지 않기 위해 순서대로 함께 진행하기.  p.21 개별로 시켜보기", "materials": "도깨비 스티커", "time": "10분"}, {"name": "나는 어디에 2 &", "research": "※ 목표 : 묶음 고리 안의 도깨비들을 보며 포함 관계를 이해하고 그에 따라 묶음 고리의 이름을 추론할 수 있다. 팀으로 진행했을 시에 규칙을 이해 못하는 특정 아이가 생김. 선생님이 먼저 술래가 되어 게임 진행 해보고 시간에 따라 아이들도 팀을 나눠 진행할 수 있도록 해봄. [다시 한 번 차곡차곡] 스스로 3분 정도 기다려주고 함께 마무리.", "materials": "게임판, 도깨비 카드", "time": "15분"}, {"name": "친구를 찾아주세요", "research": "※ 목표 : 세 가지 분류 기준에 따라 분류를 해 보고 조건에 해당하는 영역을 찾을 수 있다. p.26 벤다이어그램에서 각각 위치에 따라 어떤 속성을 가지는지부터 먼저 찾도록 하고 찾기. 계속 반복해서 위치에 따라 꼭 확인해야함을 강조.  p.27 동일한 방법으로 스스로 도전.", "materials": ""}], "notes": "2-1 분류하기", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "생각하는 I.G-K-1 2단원 지지와 나니 1주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 변인이 하나인 규칙과 여러 개인 규칙, 회전 규칙을 알아보며 다음에 올 모양을 추론합니다.  ◎ 규칙을 직접 만들고 예측해 보는 활동과 규칙이 숨겨진 미로 해결을 통해 귀납적 추론 능력과 수학적 사고의 유연성을 키울 수 있습니다.", "teacher_objectives": "스스로 규칙을 찾고 적도록 한다.", "curriculum": "1-2 규칙찾기 2-2 규칙찾기", "cms_link": "이전 : 알록달록 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 변인이 하나인 규칙과 여러 개인 규칙, 회전 규칙을 알아보며 다음에 올 모양을 추론합니다.  ◎ 규칙을 직접 만들고 예측해 보는 활동과 규칙이 숨겨진 미로 해결을 통해 귀납적 추론 능력과 수학적 사고의 유연성을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "1-2 규칙찾기 2-2 규칙찾기", "materials": "아직 어린 학생들이라서 90분 수업 중 5분 휴식(화장실)이 필수., 글 쓰는 시간이 오래 걸리기 때문에 최대한 간략한 필기 정리 필요."}, {"name": "CMS과정 연계", "research": "이전 : 알록달록 이후 :", "materials": ""}, {"name": "뒤죽박죽 엉망진창이 좋아", "research": "※ 목표 : 동화 속 지지와 나니를 보며 규칙이 있는 것과 없는 것을 비교해 보고 규칙의 개념과 필요성을 이야기할 수 있다. 본문 내용을 학생들과 함께 읽어본다.  Q.왜 지지의 방이 더러워보일까? Q.나니의 방은 어떻게 정리되어있어?", "materials": "", "time": "활동 전 과제 체크 30분, 활동 10분 + 5분 휴식"}, {"name": "몰래 두 번만", "research": "※ 목표 : 변인이 한 개인 규칙에서 다음에 올 모양을 예측해 보고, 두 가지 색으로 이루어진 규칙을 만들 수 있다. (워크북유사) Q. 되풀이되는 부분이 뭐야? 어떤 색이 반복되는 규칙이야? 어떤 모양이 반복되는 규칙이야? 스스로 대답할 수 있도록 하고 규칙을 책에 꼭 적도록 하기. 게임진행: 2명씩 편을 나누어 진행. 시간에 여유가 있다면 게임판을 칠판에 띄우고 자석으로 진행해보는 것도 고려해보기", "materials": "음표&악기스티커,, 연결큐브, 규칙카드, 규칙게임판", "time": "15분"}, {"name": "재주넘기", "research": "※ 목표 : 변인이 두 개인 규칙과 회전 규칙에서 되풀이되는 부분을 보고 다음에 올 모양을 알 수 있다. (워크북유사) Q. 그림이 어떻게 변하고 있어? 되풀이되는 부분이 뭐야? 되풀이 되는 부분이 몇가지야? 글로 쓰고 확인 후에 스티커 붙이도록 지도하기. 서커스 그림은 간단하게 표현할 수 있도록 정리해주고 답 확인 후에 스티커 붙이기.", "materials": "외발자전거스티커, 서커스스티커", "time": "10분"}, {"name": "길게 길게 이어요", "research": "※ 목표 : 두 개 또는 세 개씩 끊어져 있는 조각들을 규칙에 맞게 연결할 수 있다. (워크북유사) 스스로 연결해보도록 먼저 시키기(색연필이 아니라 연필 사용). 연결한 그림을 확인 후에 맞다면 모양규칙과 색깔규칙을 찾아 적을 수 있도록 하기. 개구리는 다양한 규칙이 가능함. Q. 개구리 그림은 어떤 부분이 변하고 있지? (크기, 색깔)  2명씩 함께 찾아보도록 하고 연결 후에 규칙 적도록 하기.", "materials": "개구리카드", "time": "10분"}, {"name": "안 봐도 알 수 있어요", "research": "※ 목표 : 두 가지 크기, 세 가지 색인 교구로 만들어진 규칙을 관찰해 보고, 다음에 올 모양을 찾을 수 있다. (워크북에 없음.) Q. 어떤 부분이 변하고 있어? (크기,색깔) Q.크기는 어떤 규칙이 있어? 색깔은 어떤 규칙이 있어? 찾은 규칙 책에 적어서 정리. 10번째 곰돌이는 선생님이 술래가 되어 곰돌이를 보여주고 아이들에게 맞춰보도록 하기.", "materials": "곰돌이교구, 곰돌이 게임판", "time": "10분"}], "notes": "1-2 규칙찾기 2-2 규칙찾기", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "생각하는 I.G-K-1 2단원 지지와 나니 2주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 변인이 하나인 규칙과 여러 개인 규칙, 회전 규칙을 알아보며 다음에 올 모양을 추론합니다.  ◎ 규칙을 직접 만들고 예측해 보는 활동과 규칙이 숨겨진 미로 해결을 통해 귀납적 추론 능력과 수학적 사고의 유연성을 키울 수 있습니다.", "teacher_objectives": "스스로 규칙을 찾고 적도록 한다.", "curriculum": "1-2 규칙찾기 2-2 규칙찾기", "cms_link": "이전 : 알록달록 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 변인이 하나인 규칙과 여러 개인 규칙, 회전 규칙을 알아보며 다음에 올 모양을 추론합니다.  ◎ 규칙을 직접 만들고 예측해 보는 활동과 규칙이 숨겨진 미로 해결을 통해 귀납적 추론 능력과 수학적 사고의 유연성을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "1-2 규칙찾기 2-2 규칙찾기", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 : 알록달록 이후 :", "materials": ""}, {"name": "미로찾기 모험의 집1", "research": "※ 목표 : 여러 가지 그림들이 나열되어있는 것을 보고 반복되는 규칙을 찾아 미로를 탈출할 수 있다. (워크북유사) 표지판에 반복하는 규칙을 확인하고 함께 출구로 나가는 길 찾고 다음 진행. 스스로 과일 규칙 찾아보도록 하고 연필로 그은 규칙 확인 후에 스티커 붙이도록 하기.", "materials": "", "time": "활동 전 과제 체크 30분\n활동 10분 + 5분 휴식"}, {"name": "미로찾기 모험의 집 2", "research": "※ 목표 : 색깔과 모양이 변하는 규칙에 맞게 미로를 탈출할 수 있다. (워크북유사) 표지판에 반복하는 규칙 확인하고 함께 진행.  스스로 규칙을 찾아서 해결할 시간 5분 주고 함께 마무리. 규칙이 맞는지 확인하도록 하기.", "materials": "", "time": "10분"}, {"name": "보물을 찾아요", "research": "※ 목표 : 규칙의 일부만 주어졌을 때 남은 부분도 규칙에 맞게 미로에서 길을 찾을 수 있다. 뽑은 규칙을 속성을 적어가며 규칙을 알아낸다. 미로 규칙 카드 활동 난이도 조절 하/중/상 (초/파/노)", "materials": "", "time": "10분"}, {"name": "예쁘게 꾸며요", "research": "※ 목표 : 회전하는 모양을 관찰하여 규칙에 맞게 타일을 꾸미고 벽지 조각들을 붙여 규칙적인 모양을 만들 수 있다. 무엇이 변하고 있나요? 반복하는 규칙은 모두 몇 칸인가요? 꼭 회전 규칙이 아니더라도 단위 모양을 만든 뒤 그 모양을 변형해 가며 규칙을 만들 수 있음.", "materials": "", "time": "10분"}, {"name": "다시 한 번 차곡차곡", "research": "※ 목표 : 배운 내용을 바탕으로 스스로 해결할 수 있다. 해결하고 남은 시간 워크북 미리 풀기기", "materials": ""}], "notes": "", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "생각하는 I.G-K-2 1단원 토토네 마을 소소한 이야기 1주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 자릿값의 의미를 이해하고 덧셈과 뺄셈을 하는 여러 가지 방법을 찾아보며, 활동을 통해 찾은 방법을 활용해 봅니다. ◎ 동전을 이용한 금액 만들기 활동을 통해 일상 생활에서의 덧셈과 뺄셈을 경험하고 연산 능력과 논리적 사고력을 키울 수 있습니다.", "teacher_objectives": "", "curriculum": "1-2 덧셈과 뺄셈(2) , 2-1 세 자리 수, 2-1 덧셈과 뺄셈", "cms_link": "이전 :  I.G-O-3 숫자나라, I.G-N-3셈이 필요해 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 자릿값의 의미를 이해하고 덧셈과 뺄셈을 하는 여러 가지 방법을 찾아보며, 활동을 통해 찾은 방법을 활용해 봅니다. ◎ 동전을 이용한 금액 만들기 활동을 통해 일상 생활에서의 덧셈과 뺄셈을 경험하고 연산 능력과 논리적 사고력을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "1-2 덧셈과 뺄셈(2) , 2-1 세 자리 수, 2-1 덧셈과 뺄셈", "materials": "아직 어린 학생들이라서 90분 수업 중 5분 휴식(화장실)이 필수., 글 쓰는 시간이 오래 걸리기 때문에 최대한 간략한 필기 정리 필요."}, {"name": "CMS과정 연계", "research": "이전 :  I.G-O-3 숫자나라, I.G-N-3셈이 필요해 이후 :", "materials": ""}, {"name": "토토가 초콜릿을 사는 방법", "research": "※ 목표 : 거스름돈을 받는 토토와 주인아저씨의 대화 상황과 토토와 동생과의 대화 상황을 연결지어 마지막 토토가 한 말이 무엇일지 이야기를 나눠본다.  Q.토토는 왜 100원으로 90원짜리 초콜릿을 살 수 없다고 생각했을까? Q.10개짜리 1묶음, 낱개 4개의 초콜릿을 어떻게 똑같이 나눌 수 있을까?", "materials": "", "time": "활동 전 과제 체크 30분\n활동 5분 + 5분 휴식"}, {"name": "백은 얼마나 클까", "research": "※ 목표 : 흩어져 있는 구체물을 10개씩 묶어 세면서 자릿값의 의미를 이해하고, 50과 100에 대한 양적 경험을 한다.  Q.어떻게 큐브를 세었어? 하나씩 세어보는 것 말고 다른 방법은 없었어? 묶어서 세어본다면 몇개씩 묶어볼까?", "materials": "연결큐브", "time": "10분"}, {"name": "끼리끼리", "research": "※ 목표 : 받아 올림이 없는 (두 자리 수)+(두 자리 수), 받아 내림이 없는 (두 자리 수)-(두 자리 수)의 계산 원리를 경험적으로 이해한다. 두자리 계산이라서 10개 묶음으로 계속 설명을 반복하기. Q.10개 묶음이 몇개 있어? 10개로 못 묶은 낱개는 몇 개일까?", "materials": "", "time": "10분"}, {"name": "여러 가지 방법으로 더할 수 있어요", "research": "※ 목표 : 받아 올림이 있는 (두 자리 수)+(한 자리 수) 또는 (두 자리 수)+(두 자리 수)를 계산하는 여러 가지 방법을 교구를 이용해 찾아본다. 수막대로는 개수가 제대로 보이지 않으니 연결큐브 계속 활용하면서 수업 진행하기. Q.8에 얼마를 더하면 10이 될까? 식으로 20 만들기 하면서 계산해주기.", "materials": "수 막대", "time": "10분"}, {"name": "여러 가지 방법으로 뺄 수 있어요", "research": "※ 목표 : 받아 내림이 있는 (두 자리 수)-(한 자리 수)를 계산하는 방법을 교구를 이용해 찾아본다. 계란판 그림에서 빼야하는 개수만큼 지우면서 직접 세어본다. 식으로는 10을 계속 활용하면서 정리해준다.", "materials": "수 막대", "time": "10분"}, {"name": "꿀꿀꿀 게임", "research": "※ 목표 : 게임을 통해서 덧셈, 뺄셈을 익히고, 연산 감각을 기른다. 2명씩 2팀으로 진행하고 충분히 게임방법을 숙지할 수 있도록 반복한다.", "materials": "꿀꿀꿀 게임판, 꿀꿀꿀 카드"}], "notes": "1-2 덧셈과 뺄셈(2) , 2-1 세 자리 수, 2-1 덧셈과 뺄셈", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "생각하는 I.G-K-2 2단원 어떻게 알았지, 몰래 보았을지도 몰라 1주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 크기, 넓이, 무게, 위치, 길이 등 다양한 상황에서 여러 물체들을 비교해 보면서 추이율의 관계를 이해하고 순서를 지어봅니다. ◎ 언어논리 문제와 논리 퍼즐을 해결할 수 있고 연역적 추론 능력과 논리적 사고력을 키울 수 있습니다.", "teacher_objectives": "직관적으로 보이는 부분에 대해서 꼭 적고 정리할 수 있도록 한다.", "curriculum": "1-2 시계보기", "cms_link": "이전 :  IG-V-2 숲속 마을 곰돌이, IG-N-2 달이와 별이 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 크기, 넓이, 무게, 위치, 길이 등 다양한 상황에서 여러 물체들을 비교해 보면서 추이율의 관계를 이해하고 순서를 지어봅니다. ◎ 언어논리 문제와 논리 퍼즐을 해결할 수 있고 연역적 추론 능력과 논리적 사고력을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "1-2 시계보기", "materials": "아직 어린 학생들이라서 90분 수업 중 5분 휴식(화장실)이 필수., 글 쓰는 시간이 오래 걸리기 때문에 최대한 간략한 필기 정리 필요."}, {"name": "CMS과정 연계", "research": "이전 :  IG-V-2 숲속 마을 곰돌이, IG-N-2 달이와 별이 이후 :", "materials": ""}, {"name": "다 아는 수가 있어", "research": "※ 목표 : 여러 상황에서 비교하는 과정을 통해 순서 정하기를 할 수 있음을 알 수 있다.  Q. 곰순이는 곰돌이의 시험지를 보지 않고 어떻게 곰돌이가 꼴찌인지 알 수 있었을까요? Q. 곰순이는 어떻게 곰돌이가 꿀떡을 제일 많이 먹었는지 알 수 있었을까요?", "materials": "", "time": "활동 전 과제 체크 30분\n활동 10분 + 5분 휴식"}, {"name": "무거운 것부터 차례대로", "research": "※ 목표 : 상자를 두 개씩 비교해 보고 무거운 순서를 논리적으로 생각해 볼 수 있다. p.34 Q. 가장 무거운 상자가 무엇인지 알 수 있을까? Q. 어떤 상자 두 개를 추가로 비교해봐야 순서를 정할 수 있을까? (준비물이 없어서 ‘어떻게 할까요’ 생략하고 진행하기.)", "materials": "쌓기나무, 상자, 양팔저울", "time": "10분"}, {"name": "비교해 보지 않아도 알아요", "research": "※ 목표 : 무게, 넓이, 크기를 비교하는 상황에서 모두 비슷한 방법으로 순서를 파악할 수 있음을 이해할 수 있다. p.37 같은 친구가 두 번 들어간 그림을 먼저 찾아보도록 한다. 위의 두개로 먼저 순서 정하고 3,4번째 그림으로 순서 정해서 합쳐본다. p.38-39 수기로 먼저 찾아본 후에 스티커를 붙일 수 있도록 지도한다.", "materials": "곰돌이말, 곰돌이스티커커", "time": "15분"}, {"name": "순서를 알아요", "research": "※ 목표 : 위치, 길이를 비교하는 상황에서 모두 비슷한 방법으로 순서를 파악할 수 있음을 이해할 수 있다. 앞----------뒤 적은 후에 곰돌이와 친구들 이름을 적어보도록 시켜본다. 다 끝나면 미리 워크북 풀기.", "materials": "곰돌이말, 곰돌이스티커"}], "notes": "1-2 시계보기", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "생각하는 I.G-K-2 2단원 어떻게 알았지, 몰래 보았을지도 몰라 2주차", "author": "김경미T", "level": "IG-K", "objectives": "◎ 크기, 넓이, 무게, 위치, 길이 등 다양한 상황에서 여러 물체들을 비교해 보면서 추이율의 관계를 이해하고 순서를 지어봅니다. ◎ 언어논리 문제와 논리 퍼즐을 해결할 수 있고 연역적 추론 능력과 논리적 사고력을 키울 수 있습니다.", "teacher_objectives": "직관적으로 보이는 부분에 대해서 꼭 적고 정리할 수 있도록 한다.", "curriculum": "1-2 시계보기", "cms_link": "이전 :  IG-V-2 숲속 마을 곰돌이, IG-N-2 달이와 별이 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : ◎ 크기, 넓이, 무게, 위치, 길이 등 다양한 상황에서 여러 물체들을 비교해 보면서 추이율의 관계를 이해하고 순서를 지어봅니다. ◎ 언어논리 문제와 논리 퍼즐을 해결할 수 있고 연역적 추론 능력과 논리적 사고력을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "1-2 시계보기", "materials": "아직 어린 학생들이라서 90분 수업 중 5분 휴식(화장실)이 필수., 글 쓰는 시간이 오래 걸리기 때문에 최대한 간략한 필기 정리 필요., 곰돌이말은 대체 어디에 있을까요?"}, {"name": "CMS과정 연계", "research": "이전 :  IG-V-2 숲속 마을 곰돌이, IG-N-2 달이와 별이 이후 :", "materials": ""}, {"name": "롤러코스터", "research": "※ 목표 : 앞, 뒤 위치 관계에서 의미를 이해하고 논리에 맞게 순서를 나타낼 수 있다.  수업 전에 미리 선생님이 스티커 떼서 준비해두기. 앞--------뒤 적어두고 조건에 따라 정리할 수 있도록 연습한다. Q. 가장 먼저 자리가 결정되는 친구는 누구?", "materials": "곰돌이말, 곰돌이스티커", "time": "활동 전 과제 체크 30분\n활동 10분 + 5분 휴식"}, {"name": "퍼레이드", "research": "※ 목표 : 위치와 관련된 문장을 사용하여 사진을 설명하고, 순서를 알아맞힐 수 있다. 앞, 뒤의 위치를 그림에서 확인하고 순서대로 정리할 수 있도록 한다. ‘어떻게 할까요’에서 문장을 선생님이 정리해주고 동물카드와 동물스티커를 이용해서 찾아보도록 한다. Q. 바로 앞에 있는 것과 앞에 있는 것은 무엇이 다를까요?", "materials": "동물카드, 동물스티커", "time": "10분"}, {"name": "타잔 밧줄타기 놀이", "research": "※ 목표 : 위, 아래 위치 관계에서 조건들의 의미를 이해하고 논리에 맞게 순서를 나타낼 수 있다. 위-----------아래 적어두고 조건에 따라 정리할 수 있도록 연습한다.", "materials": "곰돌이말, 곰돌이스티커", "time": "10분"}, {"name": "숲속을 걸어요", "research": "※ 목표 : 주어진 사진에서 순서에 대한 정보를 찾아 모든 순서를 찾아볼 수 있다. (나무 위치는 상관이 없음을 알려주기.) Q. 사진이 여러번 찍힌 친구는 누구인가요? Q. 곰식이 앞에는 누가 있나요? Q. 곰순이와 곰자는 어디에 들어갈 수 있나요?", "materials": "곰돌이말, 곰돌이스티커", "time": "10분"}, {"name": "뛰어보자폴짝폴짝", "research": "※ 목표 : 위치, 길이를 비교하는 상황에서 모두 비슷한 방법으로 순서를 파악할 수 있음을 이해할 수 있다. 스스로 해결할 수 있도록 하기.", "materials": "곰돌이말, 곰돌이스티커커"}], "notes": "1-2 시계보기", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "PRE-WHY H-2 스무고개", "author": "이의금T", "level": "Pre-H", "objectives": "주어진 대상을 위계적으로 분류할 수 있다.", "teacher_objectives": "한 번 질문할 때마다 질문의 반을 줄여가면, 최소 질문으로 비밀수를 맞출 수 있다.", "curriculum": "3-2 자료의 정리, 5-1 규칙과 대응", "cms_link": "이전 :   WC-1 이중 추리 게임 이후 :   WH-3 셋 게임", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :  주어진 대상을 위계적으로 분류할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "3-2 자료의 정리, 5-1 규칙과 대응", "materials": "교구 셋카드를 이용시, 책상에 자리가 없음! 그러므로 자체 제작한 미니셋카드를 사용하거나, 아이들 책 부록의 미니셋카드를 이용하여 모든 활동을 진행한다."}, {"name": "CMS과정 연계", "research": "이전 :   WC-1 이중 추리 게임 이후 :   WH-3 셋 게임", "materials": ""}, {"name": "없어진 카드는?", "research": "", "materials": "미니셋카드", "time": "활동 전 과제 체크 20분, 활동   진행 15분"}, {"name": "여러 번 분류하기", "research": "", "materials": "부록(미니 셋카드,스티커), 벤다이어프린트(크레버스자료실)", "time": "15분"}, {"name": "분류표로 나타내기", "research": "", "materials": "※ 목표 : 분류표를 보고 들어갈 셋카드를 찾아야한다., 활동 이후라 10쪽은 어렵게 느끼지 않고 금방 찾아냄. 11쪽은 공통된 성질을 찾아야하는데, 스스로는 잘 안되어 칠판에서 선생님과 함께 진행함.", "time": "10분"}, {"name": "비밀수 알아맞히기", "research": "", "materials": "1~16까지 적힌 띠지를 준비하면 좋을듯", "time": "20분"}, {"name": "스무고개 놀이", "research": "", "materials": "부록(스티커)"}], "notes": "3-2 자료의 정리, 5-1 규칙과 대응", "materials": [], "author_email": "leg@dbcms.com"}, {"title": "WHY 2-1-1 도형게임", "author": "윤시현T", "level": "2레벨", "objectives": "", "teacher_objectives": "사각형의 종류와 특징을 명확히 아는 것보다 게임을 통해 흥미 유발, 관찰을 통해 수학적 경험을 쌓는 것에 의의를 둡니다.", "curriculum": "4-2 4.사각형 & 6.다각형", "cms_link": "이전 : WHY 1 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :  1.다양한 도형 게임을 통해 여러가지 평면도형의 특징을 알 수 있습니다. 2.색칠한 도형을 만들고 규칙에 따라 접어보면서 도형 감각을 익힐 수 있습니다.", "materials": "※ 교안  목표 :  1.다양한 도형 게임을 통해 여러가지 평면도형의 특징을 알 수 있습니다. 2.색칠한 도형을 만들고 규칙에 따라 접어보면서 도형 감각을 익힐 수 있습니다."}, {"name": "교과 연계", "research": "4-2 4.사각형 & 6.다각형", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 : WHY 1 이후 :", "materials": ""}, {"name": "비고(건의,제안)", "research": "", "materials": ""}, {"name": "8도형 특징", "research": "20분", "materials": "자,삼각자"}, {"name": "8도형 게임", "research": "5분", "materials": "※ 목표 : 각 도형의 이름과 특징을 알아봅니다., - 처음에는 선생님이 술래가 되어 게임을 진행하며 게임하는 방법을 익히도록 해줍니다., - 두번째 게임은 아이들이 술래를 정할 수 있도록 하여 참여를 유도합니다."}, {"name": "찾아라 게임", "research": "25분", "materials": "사각형의 용어와 성질을 익숙해 질 수 있도록 여러번 언급한다"}, {"name": "색칠한 종이접기I", "research": "20분", "materials": "가위,풀"}, {"name": "색칠한 종이접기II", "research": "20분", "materials": "※ 목표 : 각 도형의 이름과 특징을 이해합니다., - 처음에는 선생님이 술래가 되어 게임을 진행하며 게임하는 방법을 익히도록 도와줍니다., - 두번째 게임은 아이들이 술래를 정할 수 있도록 하여 참여를 유도합니다."}], "notes": "", "materials": [], "author_email": "ysh@mjcms.com"}, {"title": "WHY 2-1-2 곱셈법", "author": "윤시현T", "level": "2레벨", "objectives": "", "teacher_objectives": "곱셈을 넓이의 차원에서 시각적으로 이해하여 계산할 수 있다.", "curriculum": "3-2 1단원 곱셈(두자리수x두자리수)", "cms_link": "이전 :  이후 :", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :  1.곱셈의 원리를 이해하고 여러 가지 곱셈법을 알 수 있다. 2.여러 나라의 전통 곱셈법의 원리를 찾을 수 있다. 3.곱셈 연산 능력을 향상시킬 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "3-2 1단원 곱셈(두자리수x두자리수)", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  이후 :", "materials": ""}, {"name": "비고(건의,제안)", "research": "", "materials": ""}, {"name": "큰 수 곱셈", "research": "30분 (이전 과제 풀이+주별테스트:30분)", "materials": "※ 활동 목표 : 곱셈의 원리를 알아본다., P.16 수의 곱셈을 다양하게 표현해 본다., Q.60을 여러가지 수의 곱으로 나타내볼까?어떤수를 곱하면 60이 될까?, A.1x60이요. 6x10이요..., Q.작은 수부터 순차적으로 얘기해 볼까?, A.1x60,2x30,3x10,5x12,6x10이요., Q.32x9는 머릿셈으로 계산해 보자. 어떻게 계산해 볼까?, A.32를 9번 더해요. 32를 10번 더했다가 1번을 빼요.30을9번 더한 값에 2를 9번 더한 값을 합하면 되요., p.17 분배법칙을 이용하여 계산하기, Q.큰수를 곱할 때 계산을 편하게 할 수 있는 방법이 무얼까 생각해 봅시다. , 수가 너무 크니까 수를 쪼개서 곱해보면 어떨까요?, 먼저,6x23을 계산해 봅시다. , 6x23=6x(ㅁ+ㅁ), 큰수인 23을 쪼개서 계산하면 어떨까하는데 어떤 수로  쪼개면 좋을까요?, A.20과 3으로 쪼개요., 그럼, 6x(20+3)=6x20묶음+6x3묶음=120+18=138으로 계산할 수 있겠네요., 2)3)도 마찬가지로 풀어봅시다.이런 방식은 보통 하나씩 나눠 주는 것처럼 보여서 분배법칙이라고 합니다., p.18 그림으로 계산하기, Q.17x6에서 큰수인 17을 몇칸으로 나눠서 보면 좋을까요?, A.10칸과 7칸으로 나눠봐요., 네,그럼 6x17=6x10+6x7=60+42=102로 계산이 쉽게 되겠네요., 1)2)문제도 어떻게 풀면 좋을지 생각해 보아요., p.19 우리가 주로 사용하는 곱셈법으로 계산하기, 두가지 원리로 설명해준다.1)2)함께 풀어봅니다."}, {"name": "여러나라의 곱셈법", "research": "30분", "materials": "※ 목표 : 여러나라의 곱셈법 원리를 알아본다., p.20,21 네이피어 곱셈법, 천문학에 관심이 많은 스코틀랜드의 부유한 귀족 네이피어에 의해 탄생한 계산법. , Q.어떤 방법으로 게산했을까요? , A. 곱셈구구를 이용한 것 같아요., 대각선으로 칸을 나누어 곱셈한 값을 쓰, 고 오른쪽 끝에서 부터 1의자리,10의자리,100의 자리수를 나타낸다. 나온 값을 올림하여 더한다., 1)2)한번 풀어볼까요?, p.22,23 이집트 곱셈법, 고대 이집트 사람들은 오직 2를 곱하는 것만으로도 곱셈을 할 수 있었다고 생각함., Q.어떤 방법으로 계산한 걸까요?, A.18을 2배씩 했어요., Q.네 맞아요. 그런데 18을 아무리 2배씩 해도 앞의 수는 24가 나오지 않아요. 그럼 어떻게 해야할까요?, A.8과 16을 더하면 24가 나와요., Q.네 그럼 8과 16을 이용하여 어떻게 24x18을 계산할 수 있을까요?, A.18을 8번 더한수와 18을16번 더한 수를 합하면 되요. , p.24 러시아 곱셈법, 러시아 농부들은 2를 곱하거나 2로 나누는 것을 이용하여 곱셈을 할 수 있다고 생각함., Q.8x13에서 8을 2로 나누면 13은 어떻게 해야 할까요?, A.2를 곱해봐요., Q.네 그럼 8은 4,2,1이되고 13은 26,52,104가 되죠? 그래서 얼마가 나올까요?, A.104가 되요., , ,"}], "notes": "", "materials": [], "author_email": "ysh@mjcms.com"}, {"title": "WHY 2-1-3 축구 게임", "author": "윤시현T", "level": "2레벨", "objectives": "", "teacher_objectives": "1.괄호를 여러번 사용하여 복잡한 사칙연산도 계산해 본다. 2.여러가지 방법으로 답을 도출해 본다.", "curriculum": "5-1 1단원 자연수의 혼합계산  중1-1 유리수의 계산", "cms_link": "이전 :  이후 :", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :  게임을 통해 연산 능력을 기를 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "5-1 1단원 자연수의 혼합계산  중1-1 유리수의 계산", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  이후 :", "materials": ""}, {"name": "비고(건의,제안)", "research": "", "materials": ""}, {"name": "축구의 역사", "research": "30분 (이전 과제 풀이+주별테스트:30분)", "materials": "주사위"}, {"name": "게임2,3", "research": "30분 (1게임당 10분)", "materials": "주사위, 사칙연산 카드"}], "notes": "", "materials": [], "author_email": "ysh@mjcms.com"}, {"title": "WHY 2-2-3 땅따먹기", "author": "윤시현T", "level": "2레벨", "objectives": "", "teacher_objectives": "", "curriculum": "", "cms_link": "이전 :  이후 :", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 : 1.게임을 통해 논리적인 사고와 판단력을 기를 수 있다. 2.게임을 분석하며 도형 사이의 관계를 분석하는 능력을 기를 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  이후 :", "materials": ""}, {"name": "비고(건의,제안)", "research": "", "materials": ""}, {"name": "땅따먹기", "research": "20분 (이전 과제 풀이+주별테스트:30분)", "materials": "※ 활동 목표: 땅따먹기 게임의 규칙을 이해한다., P.30 , 게임 규칙, 1.두 명이 번갈아 가며 이웃한 두 점을 이어 선을 그린다.(대각선 방향x), 2.점들을 선으로 연결하여 하나의 작은 정사각형을 만들면 자기것을 표시한다., 3.사각형의 개수가 많은 사람이 이기는 게임., Q.게임 규칙이 이해되나요?, A.네, P.31-34, <게임1> 게임을 진행하며 선공이 유리한지, 후공이 유리한지 생각해 본다., 2X2게임판, Q., A., 3X3게임판, Q., A., 4X4게임판, Q., A., 5X5게임판, Q., A., 6X6게임판, Q., A., 5X8게임판, Q., A.,"}, {"name": "땅따먹기", "research": "20분 (1게임당 10분)", "materials": "※ 활동 목표: 땅따먹기 게임에서 바로 다음 차례에 작은 정사각형이 생기지 않도록 선분을 최대한 많이 그리기, 2X2게임판, Q., A., 3X3게임판, Q., A., 4X4게임판, Q., A."}, {"name": "땅따먹기", "research": "20분", "materials": "※ 활동 목표: 게임에서 이기기 위한 전략 짜보기, P.38, 게임1, Q.게임에서 이기기 위해 어디에 선을 그어야 할까요?, A.통로만 피해요., 게임2, Q.어떤 전략이 좋을까요?, A., P.39, 게임3, Q., A., 게임4, Q., A., P.40 , Q.자유롭게 게임을 해 보세요., A.네"}], "notes": "", "materials": [], "author_email": "ysh@mjcms.com"}, {"title": "WHY 4-1-3 가우스 이야기", "author": "김경미T", "level": "4레벨", "objectives": "◎ 가우스 이야기를 통하여 수의 합을 구하는 여러 가지 방법에 대해 생각할 수 있습니다.  ◎ 연속하는 수를 보면서 규칙을 찾을 수 있습니다. ◎ 연속하는 수의 특징을 이용하여 합을 구하고 문제에 응용할 수 있습니다.", "teacher_objectives": "제대로 규칙을 이해시키고 스스로 해결하는 즐거움을 느낄 수 있도록 해보자.", "curriculum": "4번 활동에서 하나 씩 해주고 시켜야 할 지 바로 스스로 시켜야 할 지 확인.", "cms_link": "이전 :    이후 : W 13-2 피보나치 수열", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ◎ 가우스 이야기를 통하여 수의 합을 구하는 여러 가지 방법에 대해 생각할 수 있습니다.  ◎ 연속하는 수를 보면서 규칙을 찾을 수 있습니다. ◎ 연속하는 수의 특징을 이용하여 합을 구하고 문제에 응용할 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "4번 활동에서 하나 씩 해주고 시켜야 할 지 바로 스스로 시켜야 할 지 확인."}, {"name": "CMS과정 연계", "research": "이전 :    이후 : W 13-2 피보나치 수열", "materials": ""}, {"name": "가우스 따라잡기 (p.29)", "research": "", "materials": "※ 목표 : 등차수열을 관찰하여 특징을 찾아 가우스식 덧셈 방법에 대한 아이디어를 얻습니다., 나열된 수의 개수와 일정한 규칙 찾기. / Q.그냥 계산하지 말고 답을 찾아보자. / 1씩 계속 커진다. 2씩 계속 커진다. 이웃한 수의 차가 같다. 짝수 개의 수가 있는 경우 무지개식으로 둘씩 더하면 합이 같다. 홀수 개의 수가 있는 경우 가운데 수를 제외하고 합이 같다. / 너무 깊지 않도록 지나가기. , 마지막 문제 이후에 p.30의 홀수 개의 수 먼저 풀기.  [이웃하는 세 수는 첫번째수+세번째수=가운데수x2]", "time": "활동 전 과제  30 분, \n활동  진행  10 분"}, {"name": "연속하는 수", "research": "", "materials": "주사위"}, {"name": "수는 몇 개 있을까?", "research": "", "materials": "※ 목표 : 수열에서 수의 개수와 가운데 수를 구하는 방법을 찾을 수 있습니다., 1~35 자연수는 35개, 3~35까지 자연수는 35-3+1=33 / Q.몇 개일까? , 홀수로 시작해서 홀수로 끝나므로 33-1=32, 32/2=16(홀수17개, 짝수16개) / 가우스 게임 생략"}, {"name": "거꾸로 써서 합(p.36) > 연속하는 짝수, 홀수 개의 수의 합 (p.34-35)", "research": "", "materials": "※ 목표 :, 거꾸로 합 구하기 먼저! 워크북 연계. 세로로 짝지어진 수의 합에 전체 수의 개수를 곱하고 2를 나누어준다. , 짝수 개의 수의 합 : 수의 개수/2에 일정한 합을 곱한다. 1,2 진행 3번 보류,  홀수 개의 수의 합 : 일정한 합(가운데 수의 2배)를 찾고 수의 개수를 곱한다. 1번 필수 2,3번 택1."}, {"name": "여러 가지 문제 응용 (p.37-38)", "research": "", "materials": "※ 목표 : ,  1,3번 필수. 2,4번 보류", "time": "5분"}], "notes": "4번 활동에서 하나 씩 해주고 시켜야 할 지 바로 스스로 시켜야 할 지 확인.", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 4-1-4 도형의 분할", "author": "김경미T", "level": "4레벨", "objectives": "◎ 여러 가지 도형의 분할을 통해 도형에 친숙해 질 수 있습니다. ◎ 도형의 닮음과 합동의 개념을 알 수 있습니다. ◎ 도형의 분할을 통해 도형들 사이의 넓이 관계를 익히고 수학적 직관을 기를 수 있습니다.", "teacher_objectives": "틀려도 되니 직접 그려보면서 확인할 수 있도록 하기", "curriculum": "중등 2-2 도형의 닮음", "cms_link": "이전 :  pre-why H 손오공 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ◎ 여러 가지 도형의 분할을 통해 도형에 친숙해 질 수 있습니다. ◎ 도형의 닮음과 합동의 개념을 알 수 있습니다. ◎ 도형의 분할을 통해 도형들 사이의 넓이 관계를 익히고 수학적 직관을 기를 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "중등 2-2 도형의 닮음", "materials": "과제 풀이 및 주별 테스트 30분컷."}, {"name": "CMS과정 연계", "research": "이전 :  pre-why H 손오공 이후 :", "materials": ""}, {"name": "너희는 커도 똑같네 (p.40-41)", "research": "", "materials": "※ 목표 : 모든 도형이 이런 모양을 만들 수 있는지 생각하고 주어진 도형이 어떤 특징이 있는지 생각해보기, 한 조각일 때의 모양과 4조각, 9조각이 모여서 만드는 모양이 모두 같음. 도형의 닮음에 대해서 언급., 자기 자신을 이용해 같은 모양을 만들 수 있음. 처음 1조각을 어떻게 집어넣으면서 시작해야 할 지 생각할 수 있도록 하기."}, {"name": "너희는 모두 엄마랑 붕어빵이구나~! (p.41)", "research": "", "materials": "※ 목표 : 칸 수를 세어보면서 진행할 수 있도록 하기,  주별 테스트에 나오는 유형이므로 충분히 고민해보고 최대한 스스로 해결할 수 있도록 진행., 처음 넣는 도형을 잘 찾아주기.  칸 수를 세어보거나 길이에 대해서 볼 수 있도록 하기."}, {"name": "다각형의 분할", "research": "", "materials": "※ 목표 : 이어붙이는 부분의 길이에 대해서 고민할 수 있도록 방향 잡아주기, 1,2번 도형으로 예시를 들어주고 조각을 끼워 넣을 때, 모양과 길이를 생각하도록 방향."}, {"name": "쌍둥이 형제들(p.44-45)", "research": "", "materials": "※ 목표 : 칸 수를 세어보거나 같은 길이를 동시에 보면서 해결해보기, 주별 테스트에서 2,3번 유형이 나오기 때문에 충분히 고민할 수 있도록 하고 한 번 더 마무리하면서 강조."}, {"name": "모두 모두 모여라 (p.46-47)", "research": "", "materials": "※ 목표 : ,  작은 조각들에 순서대로 번호를 붙이고 우선적으로 채워야 할 도형(4번)부터 찾도록 하기.", "time": "10분"}], "notes": "중등 2-2 도형의 닮음", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 4-2-1 벌집퍼즐", "author": "김경미T", "level": "4레벨", "objectives": "◎정다각형 붙이기를 통해 도형에 대한 직관력을 키울 수 있습니다. ◎퍼즐을 맞추어 보며 공간지각력을 기를 수 있습니다.", "teacher_objectives": "힌트는 주더라도 스스로 끝까지 해결할 수 있도록 시키기.", "curriculum": "과제 풀이 및 주별 테스트 30분컷. 테트라헥스? 테트로헥스? (주별테스트/교안) 4,5 활동 때 서로 다른 모양인지 확인인", "cms_link": "이전 : pre-why R  이후 :  W8-1-1 테트로미노", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ◎정다각형 붙이기를 통해 도형에 대한 직관력을 키울 수 있습니다. ◎퍼즐을 맞추어 보며 공간지각력을 기를 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "과제 풀이 및 주별 테스트 30분컷., 테트라헥스? 테트로헥스? (주별테스트/교안), 4,5 활동 때 서로 다른 모양인지 확인인"}, {"name": "CMS과정 연계", "research": "이전 : pre-why R  이후 :  W8-1-1 테트로미노", "materials": ""}, {"name": "정다각형을 이어보세요 (p.6)", "research": "", "materials": "※ 목표 : 도형 붙이기를 효율적으로 하는 방법을 익히고, 공간 감각을 향상 시킵니다.,  정삼각형, 정사각형을 3개씩 붙여서 만들 수 있는 모양을 먼저 찾고 확인해주기. 4개씩 붙인 모양은 스스로 하게 하고 안되는 경우엔 3개 붙인 모양에서 1개씩 더 붙여서 서로 다른 모양을 만들어 보도록 해주기."}, {"name": "테트로미노를 붙여요 (p.7)", "research": "", "materials": "※ 목표 : 목표 모양을 테트로미노를 이용해 채우는 방법을 생각해보며 도형 감각을 기릅니다., 책에 고민해보도록 하고 시간에 따라 1~2명 정도 칠판에 그려보도록 하고 마무리. 주별테스트 1번 유사(3가지 방법)"}, {"name": "벌집을 닮은 육각형 (p.8-10)", "research": "", "materials": "탐구블록"}, {"name": "벌집으로 만든 정육각형, 정육각형 만들기(p.11-14)", "research": "", "materials": "※ 목표 : 정육각형 퍼즐을 해결하며 공간 구성력을 향상시킵니다., 여러가지 답이 존재함. 주별테스트 1번(3가지 방법)"}, {"name": "정삼각형 만들기 (p.15)", "research": "", "materials": "※ 목표 : 즐기면서 하기.,  (더 많은 퍼즐 PDF 어디 있는지 확인.)", "time": "10분"}, {"name": "도전! 탐구과제 (p.16)", "research": "", "materials": "※ 목표 : 정삼각형과 정사각형은 꼭 찾아볼 수 있도록 하기.,  그림 또는 활용 가능 교구 확인하기. 정삼각형 4가지, 정사각형 12가지, 정육각형 22가지 (이걸 다 찾을 수 있는지 확인.)", "time": "10분"}], "notes": "과제 풀이 및 주별 테스트 30분컷. 테트라헥스? 테트로헥스? (주별테스트/교안) 4,5 활동 때 서로 다른 모양인지 확인인", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 4-2-2 원의 중심 찾기", "author": "김경미T", "level": "4레벨", "objectives": "◎원의 성질을 알고 이를 이용해 원의 중심을 찾을 수 있습니다.", "teacher_objectives": "원의 용어에 대해서 정확히 알고 가기기", "curriculum": "중2--2 삼각형의 외심 중3--2 원과 현", "cms_link": "이전 :   이후 :  W6-1 하트퍼즐", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ◎원의 성질을 알고 이를 이용해 원의 중심을 찾을 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "중2--2 삼각형의 외심 중3--2 원과 현", "materials": "과제 풀이 및 주별 테스트 30분컷."}, {"name": "CMS과정 연계", "research": "이전 :   이후 :  W6-1 하트퍼즐", "materials": ""}, {"name": "어떻게 복원할까요? (p.18)", "research": "", "materials": "※ 목표 : 실생활 소재를 바탕으로 학학생들의 흥미를 유발시킵니다."}, {"name": "원이란?", "research": "", "materials": "※ 목표 : 원에 대한 정확한 의미를 알고 각 용어들을 정의합니다., 원이란 무엇일까? 자유롭게 발표해보기.(A테마) ‘원 위’라는 표현이 생소할 수 있으니 먼저 짚어주고 진행., 원과 관련 용어 중요.(A테마 및 주별테스트 문항)"}, {"name": "원의 성질을 알아볼까요? (p.21-25)", "research": "", "materials": "자, 각도기, 컴퍼스"}, {"name": "원래 모양은?", "research": "", "materials": "※ 목표 : , 동심원에 대해서 먼저 설명., 1~2번 다른 방법을 이용해서 찾아보도록 시켜보기. (A테마 및 주별테스트 문항.)"}, {"name": "도전! 탐구과제 (p.28)", "research": "", "materials": "※ 목표 : ,  어떤 특징들이 있을까??  용어에 대해서 한 번 더 정리해보기., 원,현,지금,원주,호,부채꼴,동심원,수직이등분선.", "time": "10분"}], "notes": "중2--2 삼각형의 외심 중3--2 원과 현", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 4-2-3 기사단의 이동", "author": "김경미T", "level": "4레벨", "objectives": "◎체스에서 기사가 어떻게 움직이는지 알 수 있습니다. ◎기사의 이동 방식으로 여러가지 배치를 해보면서 문제 해결력과 직관력을 기를 수 있습니다. ◎그림을 그려 문제를 해결하는 능력을 키울 수 있습니다.", "teacher_objectives": "스스로 해결할 수 있는 노하우에 대해서 알고 갈 수 있도록 하기기", "curriculum": "과제 풀이 및 주별 테스트 30분컷.", "cms_link": "이전 : W6-1 한 번씩만 지나요 W6-2 나이트퍼즐(?) 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ◎체스에서 기사가 어떻게 움직이는지 알 수 있습니다. ◎기사의 이동 방식으로 여러가지 배치를 해보면서 문제 해결력과 직관력을 기를 수 있습니다. ◎그림을 그려 문제를 해결하는 능력을 키울 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "과제 풀이 및 주별 테스트 30분컷."}, {"name": "CMS과정 연계", "research": "이전 : W6-1 한 번씩만 지나요 W6-2 나이트퍼즐(?) 이후 :", "materials": ""}, {"name": "체스 (p.30-31)", "research": "", "materials": "※ 목표 : 호기심을 유발하고 체스 말의 이동 방법을 소개합니다.,  화살표를 이용하여 전체 이동 방법에 대해서 설명. 나이트만 직선과 대각선을 동시에 이동하는 체스말"}, {"name": "성을 지키는 나이트 (p.32-35)", "research": "", "materials": "※ 목표 : 나이트의 움직임을 그림으로 나타내는 방법을 익히고 효율적으로 문제를 해결하는 방법을 모색합니다., 1. 최대한으로 움직이기. 최대 몇 칸일까? 체스판에 스스로 해보도록 하고 점판은 함께 마무리. 3x3(8개) 4x4(15개) 5x5(25개) > 규칙? 그냥 외움? 방법?, 2. 최소한으로 움직이기 (4x4 , 5x5 둘 다 4개의 칸) , 꼭짓점으로 연결되는 칸은 항상 두 개. 둘 중 한 칸에서 시작하여 네 번째에 꼭짓점에 도착하는 경로를 만들기."}, {"name": "모든 길을 지나는 랜스롱 (p.36-37)", "research": "", "materials": "※ 목표 : , 다 외워서 하는건가요? 방법이 있나요?"}, {"name": "도전! 탐구과제(p.38-39)", "research": "", "materials": "※ 목표 : 나이트의 움직임을 익히고 직관적으로 문제를 해결합니다., 스스로 시키면서 마무리., 순서대로 12개, 12개, 9개(3개 제외)"}], "notes": "과제 풀이 및 주별 테스트 30분컷.", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "W6-1-3 소수의 정체를 밝혀라", "author": "변유진T", "level": "6레벨", "objectives": "소수의 정의와 필요성에 대해 생각 할 수 있다.", "teacher_objectives": "단위수, 소수, 합성수의 의미를 인지하여 소인수분해 방법을 제대로 인지할 수 있다.", "curriculum": "중 1-1 소인수분해", "cms_link": "이전 : pre-why H 네모나라, why 5-1-1", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   소수의 정의와 필요성에 대해 생각 할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "중 1-1 소인수분해", "materials": "4. 비고, (건의, 제언)"}, {"name": "CMS과정 연계", "research": "이전 : pre-why H 네모나라, why 5-1-1", "materials": "", "time": "20분"}, {"name": "소수를 어떻게 찾을까?", "research": "", "materials": "※ 목표 :  1부터 100까지의 소수의 개수, 1부터 50까지의 소수의 개수도 정리하기, 순차적으로 2의 배수, 3의 배수, 5의 배수, 7의 배수 순으로 찾기, 마음대로 생각나는 대로 무작위로 지우는 학생 지도 필요., 색연필로 하기보다는 연필로 진행하고 남은 수를 동그라미 치는 것으로 대체., 100이상의 큰 자연수들이 소수인지 아닌 지를 알아볼 수 있는 방법 알려 주는 방법 고민 필요.", "time": "15분"}, {"name": "숨겨진 수 찾기기", "research": "", "materials": "부록(소수칩)", "time": "10분"}, {"name": "자연수에 숨겨진 수", "research": "", "materials": "※ 목표 : 지금까지 활동을 바탕으로 개념 정리하기, 개념 정리 후 p.37 개별로 진행하며 개별 성취도 파악 필요", "time": "15분"}, {"name": "소수 미로를 탈출해라", "research": "", "materials": "성취도 우수반이더라도 보통 p.37까지  마무리 가능. 또는 p.37까지 개별 진행 시에 빨리 끝난 아이들은 추가 학습 할 수 있도록 유도."}], "notes": "중 1-1 소인수분해", "materials": [], "author_email": "byj@mjcms.com"}, {"title": "W6-1-4 분수와 소수 카드 게임", "author": "변유진T", "level": "6레벨", "objectives": "1. 분수와 소수의 개념을 이해할 수 있다. 2. 분수와 소수를 서로 바꾸어 보고, 그 크기를 비교할 수 있다.", "teacher_objectives": "분수와 소수가 각각 편리한 경우를 알 수 있다.", "curriculum": "5-1 약분과 통분, 5-2 분수의 곱셈, 소수의 곱셈", "cms_link": "PW.S 어떻게 나누지(분수개념), W2 분수 어림하기(분수의 크기 비교, 크기가 같은 분수 만들기), W5 단위분수(약분과 통분, 분수의 덧뺄셈)", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   1. 분수와 소수의 개념을 이해할 수 있다. 2. 분수와 소수를 서로 바꾸어 보고, 그 크기를 비교할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "5-1 약분과 통분, 5-2 분수의 곱셈, 소수의 곱셈", "materials": "이미 교과에서 분수와 소수의 크기 비교를 아는 아이가 있는지 파악하여 수업 진행 방향을 고려할 필요가 있다."}, {"name": "CMS과정 연계", "research": "PW.S 어떻게 나누지(분수개념), W2 분수 어림하기(분수의 크기 비교, 크기가 같은 분수 만들기), W5 단위분수(약분과 통분, 분수의 덧뺄셈)", "materials": ""}, {"name": "분수와 소수는 어떻게 태어났을까?", "research": "", "materials": "※ 목표 : 분수의 또 다른 형태로 출발한 소수를 이해하기기,  분수의 개념을 다시 한 번 짚고 이전 시간에 배웠던 소수와 다름을 짚어 주기", "time": "5분"}, {"name": "스테빈은 어떻게 소수를 나타냈을까?", "research": "", "materials": "※ 목표 :  분수와 소수의 공통점, 차이점 알기, 오늘날의 소수 표기 형태로 바뀌게 된 이유에 대해 아이들 스스로 깨우칠 수 있도록 발문 열어주기, 표를 그려 각각의 편리한 경우 정확하게 정리하기", "time": "15분"}, {"name": "분수와 소수 맞바꾸기", "research": "", "materials": "※ 목표 : 분모가 4,8일 때 바꾸는 방법 학습하기, 스스로 찾고 한 문제 씩 발표하는 방향으로 수업 진행", "time": "15분"}, {"name": "어떻게 바꿀까?", "research": "", "materials": "※ 목표 :  분모가 10,100,1000,…으로 되지 않는 분수를 소수로 나타낼 때 수의 나눗셈으로 생각할 수 있도록 지도하기, 소수의 나눗셈을 배우지 않은 상태기 때문에 선생님과 함께 진행", "time": "10분"}, {"name": "위로 아래로", "research": "", "materials": "※ 목표 : 팀전으로 진행하여 분수와 소수 크기 비교 이해하기기,  게임이기에 정확한 이해 없이 무분별하게 진행되지 않도록 챙김하기., 팀전으로 진행하여 메모지와 필기구 함께 챙겨 계산하면서 할 수 있도록 사전에 안내하기.", "time": "10분"}], "notes": "5-1 약분과 통분, 5-2 분수의 곱셈, 소수의 곱셈", "materials": [], "author_email": "byj@mjcms.com"}, {"title": "W6-2-1 두 가지로 나타낸 세상", "author": "변유진T", "level": "6레벨", "objectives": "이진법의 의미를 이해하고, 십진법과의 관계를 알 수 있다.", "teacher_objectives": "", "curriculum": "", "cms_link": "W7-1 마법의 카드, W9-2 n진법의 연산", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : 이진법의 의미를 이해하고, 십진법과의 관계를 알 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "4. 비고, (건의, 제언)"}, {"name": "CMS과정 연계", "research": "W7-1 마법의 카드, W9-2 n진법의 연산", "materials": ""}, {"name": "저울 이야기", "research": "", "materials": "※ 목표 : 무게 추를 사용하여 1부터 40까지의 수를 나타낼 방법을 찾아보기,  처음 문제 이해 잘 시키기. 다양한 방법이 있기에 첫 번째 방법 함께 찾은 후 다른 답 아이들이 찾도록 유도하기.", "time": "10분"}, {"name": "손가락 메시지지", "research": "", "materials": "※ 목표 :  1부터 시작해서 2를 곱해 가는 규칙으로 자릿수를 만들고, 수를 전달해보기, 선생님 vs 아이들로 진행하는 게 좋음. 아직 이진법에 대한 이해 자체가 안된 상태이기에 학생 vs 학생의 시작 자체가 큰 의미가 없음. 대신, 선생님이 낸 문제를 함께 풀어낼 수 있도록 반별 상황에 따라 팀전으로 진행도 괜찮음.", "time": "15분"}, {"name": "이진법이란?", "research": "", "materials": "※ 목표 : 십진법과 비교하여 이진법의 개념을 이해하고, 시각화된 그림에서 이진법의 자릿값과 관계된 규칙을 찾아 십진법의 수로 나타내기, 1번 함께 해결 후 2,3번 스스로 찾고 발표하기. 이 때 학생별 이해도 파악 필수. 이해도 낮은 친구들 대상으로 다양한 숫자 예시를 들어 퀴즈를 내도 좋은 흐름임. 십진법 -> 이진법이 이해되었다면 이진법 -> 십진법도 해결할 수 있도록 퀴즈 내기.", "time": "15분"}, {"name": "도둑맞은 금반지", "research": "", "materials": "※ 목표 :  자릿값과 기호가 시각화되어있지 않더라도 이진법을 활용하여 복잡한 문제를 해결해보기,  워크북 연계 및 총괄 평가 연계 문제이기에 필수 진행 필요. 교재 문제와 워크북 문제 방향이 다르기에 반별 성취도에 따라 워크북 문제도 함께 해결하는 것도 좋음. 충분한 고민 후 다양한 토론 진행으로 아이들의 생각을 자유롭게 발표하는 시간 가지고 문제 해결법은 확실히 지도하여 이해 챙김 필요.", "time": "15분"}, {"name": "도전! 탐구 과제", "research": "", "materials": "※ 목표 : 이진법의 크게 비교를 통해 퍼즐 해결해보기, 반 성취도에 따라 해결 유무 결정. 하반이라면 도전 탐구 과제 해결보다는 이진법을 십진법의 수로 나타내는 문제 해결 퀴즈로 진행하며 완벽한 이해에 초점을 두는 것이 좋을 듯."}], "notes": "", "materials": [], "author_email": "byj@mjcms.com"}, {"title": "W6-2-1 두 가지로 나타낸 세상", "author": "변유진T", "level": "6레벨", "objectives": "이진법의 의미를 이해하고, 십진법과의 관계를 알 수 있다.", "teacher_objectives": "", "curriculum": "", "cms_link": "W7-1 마법의 카드, W9-2 n진법의 연산", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : 이진법의 의미를 이해하고, 십진법과의 관계를 알 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "4. 비고, (건의, 제언)"}, {"name": "CMS과정 연계", "research": "W7-1 마법의 카드, W9-2 n진법의 연산", "materials": ""}, {"name": "저울 이야기", "research": "", "materials": "※ 목표 : 무게 추를 사용하여 1부터 40까지의 수를 나타낼 방법을 찾아보기,  처음 문제 이해 잘 시키기. 다양한 방법이 있기에 첫 번째 방법 함께 찾은 후 다른 답 아이들이 찾도록 유도하기.", "time": "10분"}, {"name": "손가락 메시지지", "research": "", "materials": "※ 목표 :  1부터 시작해서 2를 곱해 가는 규칙으로 자릿수를 만들고, 수를 전달해보기, 선생님 vs 아이들로 진행하는 게 좋음. 아직 이진법에 대한 이해 자체가 안된 상태이기에 학생 vs 학생의 시작 자체가 큰 의미가 없음. 대신, 선생님이 낸 문제를 함께 풀어낼 수 있도록 반별 상황에 따라 팀전으로 진행도 괜찮음.", "time": "15분"}, {"name": "이진법이란?", "research": "", "materials": "※ 목표 : 십진법과 비교하여 이진법의 개념을 이해하고, 시각화된 그림에서 이진법의 자릿값과 관계된 규칙을 찾아 십진법의 수로 나타내기, 1번 함께 해결 후 2,3번 스스로 찾고 발표하기. 이 때 학생별 이해도 파악 필수. 이해도 낮은 친구들 대상으로 다양한 숫자 예시를 들어 퀴즈를 내도 좋은 흐름임. 십진법 -> 이진법이 이해되었다면 이진법 -> 십진법도 해결할 수 있도록 퀴즈 내기.", "time": "15분"}, {"name": "도둑맞은 금반지", "research": "", "materials": "※ 목표 :  자릿값과 기호가 시각화되어있지 않더라도 이진법을 활용하여 복잡한 문제를 해결해보기,  워크북 연계 및 총괄 평가 연계 문제이기에 필수 진행 필요. 교재 문제와 워크북 문제 방향이 다르기에 반별 성취도에 따라 워크북 문제도 함께 해결하는 것도 좋음. 충분한 고민 후 다양한 토론 진행으로 아이들의 생각을 자유롭게 발표하는 시간 가지고 문제 해결법은 확실히 지도하여 이해 챙김 필요.", "time": "15분"}, {"name": "도전! 탐구 과제", "research": "", "materials": "※ 목표 : 이진법의 크게 비교를 통해 퍼즐 해결해보기, 반 성취도에 따라 해결 유무 결정. 하반이라면 도전 탐구 과제 해결보다는 이진법을 십진법의 수로 나타내는 문제 해결 퀴즈로 진행하며 완벽한 이해에 초점을 두는 것이 좋을 듯."}], "notes": "", "materials": [], "author_email": "byj@mjcms.com"}, {"title": "W6-2-4 원의 측정", "author": "이의금T", "level": "6레벨", "objectives": "1. 원의 정의&특징 알아보기. 2. 원주율의 개념 이해하기", "teacher_objectives": "원주, 원의 넓이를 구하는 공식을 숙지시키기 - 곡선의 일부는 원을 이용해서 구하는 것이다", "curriculum": "6-2 원의 넓이, 중1-2-2 평면도형", "cms_link": "이전 :   W4-2 원의 중심 찾기 이후 :   W7-3 요술 달걀, 11-2 파이 이야기", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   1. 원의 정의&특징 알아보기. 2. 원주율의 개념 이해하기", "materials": ""}, {"name": "교과 연계", "research": "6-2 원의 넓이, 중1-2-2 평면도형", "materials": "한 테마를 어떻게 잘 전달할지도 중요하지만, 수업 연구를 할 때 조금 더 넓은 시야를 가지면 좋겠습니다. 왜 이 테마가 나온걸까에 대한 고민을 해봅시다 :)"}, {"name": "CMS과정 연계", "research": "이전 :   W4-2 원의 중심 찾기 이후 :   W7-3 요술 달걀, 11-2 파이 이야기", "materials": ""}, {"name": "우리 주변의 원", "research": "", "materials": "원의 용어정리 프린트물", "time": "활동 전 과제 체크 20분, 활동   진행 10분"}, {"name": "원주와 원의 넓이 구하기", "research": "", "materials": "부록(스티커), 자", "time": "15분"}, {"name": "부채꼴의 넓이와 호의 길이", "research": "", "materials": "부록(스티커)", "time": "20분"}, {"name": "원을 측정하는 식", "research": "", "materials": "※ 목표 : 지금까지 활동을 바탕으로 식을 정리하기 - 식이 어떻게 만들어지는지 유도과정 잘 살펴볼 것(6학년 교과 과정에서 나올 것),  기억이 안 나면 앞 페이지를 보면서 대답을 해보도록 하고 함께 식을 정리한다. 원의 넓이는 반반율! 이라고 귀엽게 말하여 기억에 남을 수 있도록 하면 좋다. -원주율의 경우 문제에 따라 제시되는 수가 다양 (3, 3.1, 3.14, 22/7 등…) 근사치이므로 정확하지 않을 수 있음을 이야기 해주고 넘어가는 것이 좋겠음", "time": "10분"}, {"name": "여러 가지 부채꼴의 둘레와 넓이", "research": "", "materials": "※ 목표 : 공식을 활용하기.,  1번과 2번 문제가 있는데, 시간이 부족하다면 2번을 푸는 것을 추천한다. (이유: 숙제에 나옴.) 식을 하나씩 적으면서 아이들이 입으로 반반율과 지름X원주율을 중얼거리며 풀 수 있도록 한다. - 1번의 경우 아이들이 하나씩 나누어서 풀어보게(부채꼴의 반지름은 같이 찾은 후)", "time": "15분"}], "notes": "6-2 원의 넓이, 중1-2-2 평면도형", "materials": [], "author_email": "leg@dbcms.com"}, {"title": "W8-1-3 주기 (진행-2025.3.17)", "author": "황지향T", "level": "8레벨", "objectives": "① 주기의 의미를 알고, 이를 활용하여 다양한 문제를 해결할 수 있다. ② 나머지가 같은 수의 성질을 알 수 있다", "teacher_objectives": "주기가 있는 문제를 나눗셈의 나머지를 이용하여 해결할 수 있도록 한다. (=나머지만 알아도 된다)", "curriculum": "초등 전체 문제해결단원", "cms_link": "이전: W8-1-2 이후: (없음)", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 주기의 의미를 알고, 이를 활용하여 다양한 문제를 해결할 수 있다. ② 나머지가 같은 수의 성질을 알 수 있다", "materials": ""}, {"name": "교과 연계", "research": "초등 전체 문제해결단원", "materials": "교과 문제를 푸는 것 처럼 주입식으로 진행될 가능성이 높은 테마이다. 따라서 적절히 발문하여 아이들이 스스로 주기를 찾을 수 있도록 주기라는 용어를 수업시간에 많이 말할 필요가 있다."}, {"name": "CMS 과정 연계", "research": "이전 :   pre-why C 꼬부랑 지팡이 이후 :   Why 11-1 개구리, 12-1 달력이야기", "materials": ""}, {"name": "주기를 찾아라", "research": "", "materials": "※ 목표 : 주기에 대한 개념을 이해하고, 주기를 구하는 방법을 탐구한다., 주기를 찾기 위해 계속적으로 수를 써넣을 필요가 있는지를 발문한다. 결국 한 바퀴 돌아 모든 칸을 채운 후 두번째 턴이 돌아오면 모든 칸에서 주기가 성립할 것임을 예측하게 한다. → <주기 = 수가 쓰인 칸의 개수>이므로 둘 중 하나만 구해도 답을 알 수 있다.", "time": "10분"}, {"name": "나란히 놓인 바둑돌 p30", "research": "", "materials": "※ 목표 :  규칙이 반복되는 주기를 이용해 ㅁ번째를 구해본다., 이 활동에서는 주기를 구한 후 나눗셈으로 n번째의 바둑돌을 찾아내는 것을 이해시켜야 한다., n번째 ÷ 주기 = ㅁ묶음, 나머지의 구조에서 몇 묶음으로 끝이 난다면 묶음의 마지막 바둑돌일 것이고, 나머지가 남는다면 묶음 안에서 나머지의 개수와 같은 번째의 바둑돌이 정답이 될 것. 나눗셈할 때 중요한 것은 묶음이 아니라 나머지임을 인지할 수 있게 발문이 필요하다. (88÷5에서 나머지가 3인 것만 캐치해도 해결할 수 있다.) 물론 관련 문제의 난이도에 따라 몫이 중요할 경우도 있음 (군수열 관련 문제의 경우)", "time": "5분"}, {"name": "SKY 4색 퍼즐", "research": "", "materials": "※ 목표 : 두 가지 규칙이 반복되는 패턴에서 두 주기의 최소공배수를 이용하여 퍼즐을 해결한다., 앞의 나란히 놓인 바둑돌 활동에서 각 칸의 모양이나 색깔은 나머지와 관련이 있음을 인지하도록 발문하고, 모양과 색깔이 쓰인 개수를 알아본 후(문제에서는 각 색깔과 모양이 모두 쓰임) 나눗셈을 이용하여 규칙을 알아낼 수 있도록 한다. (노랑색 : 5÷4= 나머지 1, 첫번째 색, 달은 2번째 모양)", "time": "10분"}, {"name": "3색 큐브 쌓기", "research": "", "materials": "연결큐브", "time": "15분"}, {"name": "주기를 이용한 문제해결 p 34~37", "research": "", "materials": "※ 목표 : 주기를 적용하여 문제를 해결한다., 2. 3/1일이 무슨 요일인지 찾은 후, 내년의 3/1일이 올해보다 하루 뒤인 것을 이용하여 거꾸로 생각하는 것이 빠를 수 있다., 3. 아이들에게 하나는 주기가 3이고, 하나는 주기가 5인데 공통으로 규칙을 통일하려면 어떻게 해야 할지를 발문,1테마에서 최소공배수를 배웠으므로 관련해서 대답이 나올 수 있도록 한다., 4. 워크북에서 관련 문제가 과제로 제시되므로, 꼭 풀어보아야 한다. 엄지나 소지는 주기가 8인데 나머지 손가락은 왜 4처럼 보이는지 발문하여, 같은 방향으로 세었을 경우를 기준으로 해야 주기가 통일됨을 보인다., 5. 12레벨 달력이야기에서 나올 것. 따라서 시간이 없을 경우 생략해도 좋다. 다만 문제 자체는 어렵지 않으므로 시간이 충분하다면 풀어보도록 한다."}], "notes": "초등 전체 문제해결단원", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "W8-1-4 발상의 전환2", "author": "황지향T", "level": "8레벨", "objectives": "① 문제를 살펴보고 감춰진 조건을 찾아낼 수 있다. ② 고정관념을 깨고 다양한 시각으로 문제를 해결할 수 있다. ③ 논리적 생각을 통해 문제를 해결할 수 있다.", "teacher_objectives": "문제를 풀 때 모르는 것, 안 배운 것이 아니라 관점이 다양해지면 해결 방법도 다양해질 수 있음을 알게 한다.", "curriculum": "문제풀이로만 진행하면 굉장히 빠르게 끝나는 테마. 아이들의 다양한 아이디어를 들어볼 수 있도록 충분한 발문이 필요하다.", "cms_link": "이전: W8-1-3 주기 이후: (없음)", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 문제를 살펴보고 감춰진 조건을 찾아낼 수 있다. ② 고정관념을 깨고 다양한 시각으로 문제를 해결할 수 있다. ③ 논리적 생각을 통해 문제를 해결할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": "문제풀이로만 진행하면 굉장히 빠르게 끝나는 테마. 아이들의 다양한 아이디어를 들어볼 수 있도록 충분한 발문이 필요하다."}, {"name": "CMS 과정 연계", "research": "이전 :   WHY 5 발상의 전환 1 이후 :", "materials": ""}, {"name": "초점을 바꾸면 새로운 해결책이 보인다 40~41p", "research": "", "materials": "※ 목표 : 복잡한 상황을 간단하게 만들거나 초점을 바꾸어 보는 ‘발상의 전환’이라는 학습 목표를 소개한다. , 관점을 이기는 팀과 지는 팀을 기준으로 생각했을 때 확연히 달라지는 난이도를 확인하게 하여 문제를 생각할 때 다양한 관점이 중요한 것을 알게 한다."}, {"name": "홀짝 나무타기", "research": "", "materials": "※ 목표 :  안과 밖이라는 요소를 이용하여 복잡해 보이는 나무 미로에서 직접 따라가보지 않고도 안과 밖을 구분하여 문제를 해결, 미로찾기처럼 연필로 시도하는 아이들이 있을 수 있다. 모든 아이들이 연필로 시도할 때, 우리는 오늘 발상의 전환 테마를 진행하고 있다는 사실을 인지시켜줄 필요가 있다. 아이들이 다양한 시도를 함에도 불구하고 다른 방법을 찾지 못한다면, 조르당 곡선의 원리를 알려주도록 한다."}, {"name": "고속파리", "research": "", "materials": "※ 목표 : 파리가 날아간 거리를 구하는 대신 파리가 날아가는 공간에 주목하여 기차가 움직인 거리를 이용하여 문제를 해결, 앞의 활동들에서도 마찬가지. 관점을 바꿔보는 것을 연습해야 하므로, 파리가 날아다니는 것에 집중하지 않으려면 어디에 관심을 두어야 할지 발문하고, 아이들의 다양한 이야기를 들어보도록 한다."}, {"name": "세 산책로", "research": "", "materials": "활동지"}, {"name": "돌연변이 세균", "research": "", "materials": "※ 목표 : 시간을 거꾸로 거슬러 올라가면서 문제를 해결합니다., 이해가 쉬우려면 그림이 도움이 될 수 있음. 그렇다면 이전 모습을 그려보게 하여, 한 시간 전임을 이해시키는 것이 빠르다."}, {"name": "알록달록 색종이", "research": "", "materials": "※ 목표 : 관점을 전환하여 각각의 넓이를 구하지 않고 둘 다 흰 부분만큼 추가하면 두 종이의 넓이의 차는 일정하다는 사실을 이용하여 문제를 해결합니다., 수식으로 해결하면 쉽지만 생각보다 그림이 이해가 더 어려운 부분이 있음. 아이들에게 그림으로 이해가 잘 안된다면 어떤 방법이 도움이 될 수 있는지 발문해줄 필요가 있음."}, {"name": "달리는 스포츠카", "research": "", "materials": "※ 목표 : 복잡한 계산을 이용하지 않고도 시간을 거꾸로 거슬러 올라가면서 문제를 해결합니다., 처음 떨어져 있었던 거리는 아무런 상관이 없음을 캐치할 수 있어야 함. 여러 예시들을 아이들이 경험해보게 한다. (ex:우리가 지금 충돌하기 1분 전이라면, 지금의 거리가 중요할까 아니면 그 전의 거리가 중요할까?)"}], "notes": "문제풀이로만 진행하면 굉장히 빠르게 끝나는 테마. 아이들의 다양한 아이디어를 들어볼 수 있도록 충분한 발문이 필요하다.", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "W8-2-1 소마큐브", "author": "황지향T", "level": "8레벨", "objectives": "① 공간지각력을 향상시킬 수 있습니다. ② 문제해결능력과 창의력을 향상시킬 수 있습니다.", "teacher_objectives": "입체를 그리는 법을 훈련한다.", "curriculum": "초등 전체 쌓기나무 관련", "cms_link": "이전: W8-1 이후: (없음)", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 공간지각력을 향상시킬 수 있습니다. ② 문제해결능력과 창의력을 향상시킬 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "초등 전체 쌓기나무 관련", "materials": "입체 퍼즐이라 A형 과제를 해결하기 쉽지 않을 것. 수학퍼즐 러닝포털에서 꼭 풀어볼 수 있도록 권유."}, {"name": "CMS 과정 연계", "research": "이전 :    이후 :", "materials": ""}, {"name": "소마큐브란? 6p", "research": "", "materials": "테마 전체, 소마큐브"}, {"name": "7개의 조각 7~9p", "research": "", "materials": "점판지, (뒷 장 첨부)"}, {"name": "다양하게 만들어 보기", "research": "", "materials": "※ 목표 : 취급하기 어려운 조각의 처리를 어떻게 할지 고민하게 한다., 보통 소마큐브 퍼즐을 풀다 보면 5~7번 조각의 처리가 어렵다. 먼저 조립하여 필요한 부분을 만들어 낼 수 있을지 고민하게 해본다. 입체 실루엣 퍼즐을 생각보다 어려워 하는 학생들이 많으므로, 이런 아이들이 문제를 풀 때 킥이 되는 조각들을 하나씩 힌트로 주는 것이 도움이 된다."}, {"name": "별 모으기 게임", "research": "", "materials": "소마조각, 모형카드, (뒷 장 첨부)"}, {"name": "소마큐브", "research": "", "materials": "※ 목표 : 소마큐브를 정육면체 모양으로 쌓아, 정리하며 마무리한다., 바닥 면에 사용된 소마조각의 번호대로 놓고 나머지 부분을 채워본다. 5번 조각의 위치를 먼저 결정할 수 있으며 나머지 세 조각의 위치는 서로 바뀔 수 있다."}], "notes": "초등 전체 쌓기나무 관련", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 9-3-3 모순과 역설 (11주차지만 12주차에 진행)", "author": "김경미 대리", "level": "9레벨", "objectives": "", "teacher_objectives": "논리적 사고를 할 수 있도록 직접 문제점을 찾고 논리적인 주장을 펼칠 수 있도록 진행하기.", "curriculum": "고등학교 수학 I - 1.집합과 명제 (귀류법에서 다룸)", "cms_link": "이전 :  이후 : Why 11-2-3 수학의 착각", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :   ① 모순적인 상황에서 논리적으로 생각해 볼 수 있습니다. ② 논리적 모순이 생기는 부분을 찾고, 해결 방법을 떠올릴 수 있습니다.", "materials": ""}, {"name": "교과 연계", "research": "고등학교 수학 I - 1.집합과 명제 (귀류법에서 다룸)", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  이후 : Why 11-2-3 수학의 착각", "materials": ""}, {"name": "비고", "research": "", "materials": ""}, {"name": "모순,", "research": "10분", "materials": "귀류법이란?, “반대로 가정 → 모순 발생 → 원래 주장 참”"}, {"name": "누구 말이 옳을까?", "research": "5분", "materials": "30에서 모순 정확하게 인지하고 넘어가기, , 소크라테스 30~32 문장의 구조화 연습, , 모순? 짚어주고 정의를 해주고 넘어가기., , 역설? 모순을 낳는 명제들 중에 상식이 어긋나는 경우"}, {"name": "크레타인 에피메니데스", "research": "5분", "materials": "시간 축소하기., 앞의 모순에서 시간 더 쓰기."}, {"name": "이발사의 패러독스", "research": "5분", "materials": "유명한 패러독스, 거짓말쟁이 패러독스, 이발사의 패러독스"}, {"name": "우리 주변의 패러독스?", "research": "5분", "materials": "중요도, 모순>역설"}, {"name": "배고픈 악어, 마지막 소원,", "research": "15분", "materials": "중요도"}], "notes": "", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 10-1-2 동그란 이슬비", "author": "김경미 대리", "level": "10레벨", "objectives": "", "teacher_objectives": "", "curriculum": "5-2학기 5.원과 원기둥,원뿔,구 중1-2학기 2.기본도형", "cms_link": "이전 :  이후 : W12-3 정다면체", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :   ① 구의 개념을 이해하고, 실험을 통해 구의 겉넓이와 부피를 구하는 방법을 알 수 있습니다. ② 구와 원기둥, 원뿔의 부피 관계를 알 수 있습니다..", "materials": ""}, {"name": "교과 연계", "research": "5-2학기 5.원과 원기둥,원뿔,구 중1-2학기 2.기본도형", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  이후 : W12-3 정다면체", "materials": ""}, {"name": "비고", "research": "", "materials": ""}, {"name": "동그랗게 떨어지는 이슬비, 구의 겉넓이를 어떻게 구할 수 있을까?", "research": "5분", "materials": "파이 확인"}, {"name": "아르키메데스의 실험", "research": "15분", "materials": "반으로 자르고 비닐에 씌운 오렌지, 접시, A4종이, 연필, 가위, 테이프"}, {"name": "구의 겉넓이를 확인하여 봅시다.", "research": "5분", "materials": "※ 목표 : 아르키메데스의 실험1을 통해 구의 겉넓이를 구해봅시다., Q. 반지름이 5cm인 구가 있다면 겉넓이는 반지름 5cm인 원애 몇개 정도 들어갈까?, A. 2개. 3개. , Q. 반지름이 5cm인 원과 반지름이 10cm인 원의 넓이는 몇배?, A. 4배, Q. 직접 한 번 해보니까 몇개랑 같지 ?, A.4개"}, {"name": "아르키메데스의 묘비에 새겨진 그림,", "research": "15분", "materials": "반지름이 같은 원기둥/원뿔/구 모양 용기, 물"}, {"name": "구의 부피를 확인해봅시다.", "research": "10분", "materials": "※ 목표 :, Q. 구를 잘게 자르면 어떤 조각이 생길까? , A. 수박조각, 피자조각, Q. 수박을 더 잘게 자르면 밑면은 어떤 모양이 가까울까? , A. 직사각형 모양"}, {"name": "여러 입체도형의 부피관계", "research": "10분", "materials": "빗방울이 구 모양일 때 유리한 점 : 표면적이 줄어들고 증발이 느려지고 외부 힘을 고르게 분산. 공기저항을 동일하게 받음."}], "notes": "", "materials": [], "author_email": "kkm@mjcms.com"}, {"title": "WHY 10-3-1. 단면도", "author": "이의금T", "level": "10레벨", "objectives": "여러가지 입체도형을 잘라보며 공간지각능력을 길러 보자.", "teacher_objectives": "단면도를 다양하게 찾아보자!", "curriculum": "6-1 각기둥과 각뿔, 6-2 원기둥,원뿔,구, 중1-2 입체도형", "cms_link": "이전 :   W10-1-2 동그란이슬비 (입체도형) 이후 :  W13-3 큐브퍼즐(공간지각력)", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :  여러가지 입체도형을 잘라보며 공간지각능력을 길러 보자.", "materials": ""}, {"name": "교과 연계", "research": "6-1 각기둥과 각뿔, 6-2 원기둥,원뿔,구, 중1-2 입체도형", "materials": "4. 비고, (건의, 제언)"}, {"name": "CMS과정 연계", "research": "이전 :   W10-1-2 동그란이슬비 (입체도형) 이후 :  W13-3 큐브퍼즐(공간지각력)", "materials": ""}, {"name": "위대한 절단", "research": "", "materials": "※ 목표 :  입체도형 절단을 왜 배우는지, 흥미유발, ‘입방배적문제’의 뜻:  입방 배적 문제 立方倍積問題 :, 주어진 정육면체의 두 배의 부피를 가지는 정육면체를 작도하라는 문제. 고대 그리스에서 시작된 기하학의 3대 불가능한 문제의 하나로, 1837년 작도가 불가능한 문제임이 증명되었다.", "time": "활동 전 과제 체크 20분, 활동   진행 5분"}, {"name": "각뿔의 단면", "research": "", "materials": "부록, 입체도형과 물", "time": "20분"}, {"name": "각기둥의 단면", "research": "", "materials": "부록, 입체도형과 물", "time": "20분"}, {"name": "쌍둥이 만들기", "research": "", "materials": "부록, 입체도형과 물", "time": "10분"}, {"name": "원뿔과 원기둥의 단면", "research": "", "materials": "부록", "time": "5분"}, {"name": "단면도 문제", "research": "", "materials": "워크북3번", "time": "10분"}], "notes": "6-1 각기둥과 각뿔, 6-2 원기둥,원뿔,구, 중1-2 입체도형", "materials": [], "author_email": "leg@dbcms.com"}, {"title": "W11-1-4 아인슈타인 퍼즐", "author": "이의금T", "level": "11레벨", "objectives": "진리표를 작성할 수 있다.", "teacher_objectives": "문제를 자세히 읽고, 추론하는 능력 기르기.", "curriculum": "", "cms_link": "이전: W11-1-3 이후: W12-2 참말과 거짓말 1", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 : 진리표를 작성할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": ""}, {"name": "CMS 과정 연계", "research": "이전: W9-3-3 모순과 역설 이후: W12-2-4 참말과 거짓말 1", "materials": ""}, {"name": "비고", "research": "", "materials": "4. 비고, (건의, 제안),"}], "notes": "", "materials": [], "author_email": "leg@dbcms.com"}, {"title": "WHY 13-1-2 테셀레이션2", "author": "황지향T", "level": "13레벨", "objectives": "① 평면을 가득 채울 수 있는 정다각형에는 어떤 것이 있는지 논리적으로 유추하기 ② 평면을 가득 채울 수 있는 정다각형에는 어떤 것이 있는지 논리적으로 유추하기", "teacher_objectives": "수식을 도형으로 바꾸어 생각해보게 함으로서 대수 → 기하로의 전환을 경험해보게 한다.", "curriculum": "중1-2 2.평면도형", "cms_link": "이전 :  7-1 테셀레이션1, 12-3 정다면체 이후 :  13-1 준정다면체", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 평면을 가득 채울 수 있는 정다각형에는 어떤 것이 있는지 논리적으로 유추하기 ② 평면을 가득 채울 수 있는 정다각형에는 어떤 것이 있는지 논리적으로 유추하기", "materials": ""}, {"name": "교과 연계", "research": "중1-2 2.평면도형", "materials": "테셀레이션2의 경우 교안의 내용이 다소 소화하기 어려우므로, 수업 전 반드시 테마 내용 숙지 필요. 준비 안 된 상태로 수업할 경우 시간 굉장히 부족해짐"}, {"name": "CMS과정 연계", "research": "이전 :  7-1 테셀레이션1, 12-3 정다면체 이후 :  13-1 준정다면체", "materials": ""}, {"name": "테셀레이션을 나타내는 표현법 (18p, 25p)", "research": "※ 목표 : 한 꼭짓점에 정다각형들이 모이는 테셀레이션을 수배열로 표현할 수 있다. 정n각형들이 모여 테셀레이션을 이룰 때, n의 수가 작은 것이 많이 모여있는 곳부터 시작하여 시계 or 반시계방향으로 표시. 순서쌍으로 나타낸다는 사실만 알고 있으면 크게 무리 없음. 25p에 준정다각형 테셀레이션이 제시되어 있어, 먼저 배열을 표시해보게 한다.", "materials": "", "time": "30분"}, {"name": "준정다각형 테셀레이션이 가능한 배열", "research": "※ 목표 : 꼭짓점에서의 정다각형 배열에 따라 실제로 테셀레이션이 가능한 경우들을 찾을 수 있다.  한 정n각형을 중심으로 꼭짓점 주위의 배열을 그림을 그려 생각해보게 한다. 앞에서 찾았던 16가지 경우 중 9가지 경우만 가능하며, 이 중 정다각형 테셀레이션 2가지를 제외하면 준정다각형 테셀레이션의 경우 7가지가 가능하며, 25p에서 확인 가능하지만 수의 배열에 따라 한가지 순서쌍에서 2가지 배열 모양이 나오는 경우가 있을 수 있다.  (3, 12, 12), (4, 6, 12), (4, 8, 8), (6, 6, 6), (3, 3, 6, 6), (3, 4, 4, 6), (4, 4, 4, 4), (3, 3, 3, 3, 6), (3, 3, 3, 4, 4)", "materials": "", "time": "20분"}, {"name": "쌍대 테셀레이션", "research": "※ 목표 : 주어진 테셀레이션의 쌍대 테셀레이션을 알 수 있다. 12레벨 정다면체에서 쌍대다면체를 다루어 보아 쌍대의 개념을 알고 있는 상황. 그리 오래 걸리지 않아, 앞의 활동에서 시간이 부족했다면 다음 시간 과제풀이 시간에 같이 진행해도 무리 없이 진행 가능.", "materials": "", "time": "5분"}], "notes": "중1-2 2.평면도형", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 13-1-4 준정다면체", "author": "황지향T", "level": "13레벨", "objectives": "① 정다면체의 조건을 변화시키면 어떤 다면체를 만들 수 있는지 탐구해본다.  ② 준정다면체에는 어떤 것이 있는지 논리적으로 찾아본다.", "teacher_objectives": "이전 테셀레이션에서 수식을 도형으로 생각해보았다면 이번에는 수식을 입체로 생각해본다.", "curriculum": "중1-2 정다면체", "cms_link": "이전 : 12-3 정다면체, 정다면체 순환 이후 : 15-3 비유클리드 기하학", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 정다면체의 조건을 변화시키면 어떤 다면체를 만들 수 있는지 탐구해본다.  ② 준정다면체에는 어떤 것이 있는지 논리적으로 찾아본다.", "materials": ""}, {"name": "교과 연계", "research": "중1-2 정다면체", "materials": "44~45p와 부록(55p)를 활용하여 각 도형의 이름을 수업시간에 미리미리 적을 수 있도록 한다."}, {"name": "CMS과정 연계", "research": "이전 : 12-3 정다면체, 정다면체 순환 이후 : 15-3 비유클리드 기하학", "materials": ""}, {"name": "정다각형으로 만드는 다면체 (42~43p)", "research": "※ 목표 : 꼭짓점마다 여러 종류의 정다각형이 똑같이 모이는 다면체의 면으로 가능한 조합을 찾을 수 있다. 테셀레이션의 경우처럼 세세하게 분수방정식으로 해결하는 활동은 아님. 배열을 확인하여 각도의 합을 확인할 수 있도록 한다. 배열이나 수식으로만 접근할 경우 이해가 어려울 수 있다. - 각 정다각형의 내각의 크기를 나타내는 표를 만들어 가는 것도 도움이 될 것 같다. ①a=3 (3, 3, 3)정사면체 (3, 4, 4)삼각기둥 (3, 6, 6) (3, 8, 8) (3, 10, 10)  ②a=4 (4, 4, n) 모두 가능, (4, 6, 6) (4, 6, 8) (4, 6, 10) ③a=5 (5, 4, 4)오각기둥 (5, 5, 5)정십이면체 (5, 6, 6)축구공 ④a=6 (a, 4, 4)", "materials": "", "time": "5분"}, {"name": "깎은 정다면체", "research": "※ 목표 : 면의 종류가 2개인 준정다면체는 깎아서 만들 수 있음을 알고, 깎은 정다면체간의 관계를 오일러수와 연결하여 생각할 수 있다. 깎은 모양을 그려보고, 배열을 찾아보게 한다. 앞의 44~45p에서 이름을 표기할 수 있도록 한다. 꼭짓점을 깎아내서 만드는 도형들이므로, 면의 수는 원래 면의 수 + 원래 꼭짓점의 수로 확인, 모서리의 경우 자른 꼭짓점마다 새로운 모서리가 추가됨을 알 수 있다. 앞의 두 방법으로 꼭짓점의 수는 오일러정리를 이용해 구할 수 있다. (오일러정리=모서리만 빼면 2)", "materials": "", "time": "15분"}, {"name": "두 개의 특별한 준정다면체 (26p)", "research": "※ 목표 : 정다면체 각 모서리의 1/2 지점을 연결하여 잘랐을 때 만들어지는 준정다면체와 쌍대다면체 사이의 관계를 살피고 각각의 준정다면체의 특징을 탐구할 수 있다. 쌍대다면체끼리는 모서리 1/2 지점을 잘랐을 때 같은 모양이 나옴을 알게 한다. 육팔면체의 면의 수는 삼각형이 6, 사각형이 8이며 각각의 개수를 알고 있으므로 모서리의 수를 쉽게 구할 수 있다. 꼭짓점은 오일러정리로 구한다. 십이이십면체의 쌍대는 부록에서 찾아 생각해보게 한다.", "materials": "", "time": "10분"}, {"name": "면이 많은 다면체", "research": "※ 목표 : 면이 많은 다면체의 꼭짓점, 모서리, 면의 개수를 구하고 쌍대다면체를 찾을 수 있다. 면의 수가 나와 있어 생각보다 쉬운 문제.", "materials": "", "time": "5분"}, {"name": "공간 다 채울 수 있을까", "research": "※ 목표 : 정다면체와 준정다면체를 활용하여 공간을 채우는 방법을 탐구할 수 있다.", "materials": "", "time": "5분"}], "notes": "중1-2 정다면체", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 13-2-1 비둘기집의 원리1", "author": "황지향T", "level": "13레벨", "objectives": "① 비둘기집의 원리를 이해하고 일반화한다.  ② 비둘기집의 원리를 이용해 문제를 해결한다.", "teacher_objectives": "비둘기집의 원리로 해결하지 않는다면 어떤 방법(귀류법)으로 해결할 수 있는지에 대한 고민도 필요", "curriculum": "중2-2 3. 확률 고1 수(하) 3. 순열과 조합", "cms_link": "이전 :  이후 : W14-1 비둘기집의 원리2", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 비둘기집의 원리를 이해하고 일반화한다.  ② 비둘기집의 원리를 이용해 문제를 해결한다.", "materials": ""}, {"name": "교과 연계", "research": "중2-2 3. 확률 고1 수(하) 3. 순열과 조합", "materials": "강사가 테마의 목적성을 가지고 있지 않는다면 자칫 문제풀이 테마로 전락할 수도 있는 테마. 비둘기집의 원리를 이용하지 않을 때는 어떻게 해결할 수 있을지를 고민하며, 경우의 수 관련 문제를 해결할 때 이 ‘원리’가 도움이 될 수 있음을 인지 시킨다."}, {"name": "CMS과정 연계", "research": "이전 :  이후 : W14-1 비둘기집의 원리2", "materials": ""}, {"name": "어둠 속의 양말들(6p)", "research": "※ 목표 : 실생활의 문제를 해결하며 서랍의 원리를 이해할 수 있다. 최소한 = ‘가장 운이 없는 경우’에도 성립되어야 함을 이해하여야 한다. 이번 테마의 주요 포인트는 ‘가장 운이 없는 경우’에 중점을 두도록 한다.", "materials": "", "time": "활동 전 과제 체크 30분, 5분"}, {"name": "비둘기집의 원리", "research": "※ 목표 : 비둘기집의 원리를 이해하고 다양한 문제를 해결할 수 있다. +가장 운이 없는 경우  (N+1)마리의 비둘기가 N개의 집 중 선택하여 들어간다면 어느 집 하나에는 적어도 2마리 이상이다. 가장 운이 없는 경우 n개의 비둘기 집에 n마리가 각각 1마리씩 들어있는 경우, 마지막 n+1번째 비둘기는 무조건 다른 비둘기와 같은 집 < 선택하는 자와 선택하는 경우를 고민  가장 운이 없는 경우 = 모든 사람들의 생년월일이 다를 경우. 따라서 1~100살의 생년월일의 가짓수가 비둘기집, 관중이 비둘기가 된다. 가장 운이 없는 경우 = 정사각형 대각선이 루트2이므로 한 정사각형 안에는 2개의 점이 들어갈 수 없음. 9칸 중 적어도 1칸은 점이 2개가 되므로 루트2보다 큰 두 점 사이의 거리는 없다. 가장 운이 없는 경우 = 모든 참가자의 악수 횟수가 다른 경우. 만약 n명이라면 악수의 가짓수가 0번~(n-1)가지가 나와야 하지만, 악수를 0번 한 사람이 있는 경우 전체 악수 횟수는 0~n-2회가 될 수 있다. (가장 많은 횟수로 악수를 하는 경우, 자기 자신과 0번인 사람이 악수하지 않기 때문) 0번 한 사람이 없는 경우 전체 악수 횟수는 1~n-1회가 될 수 있다. 두 가지 경우 모두 악수 횟수의 가짓수는 n-1번이며, 전체 인원은 n이므로 비둘기집의 원리에 따라 악수 횟수가 같은 경우가 있다. 가장 운이 없는 경우 = 13으로 나눈 나머지가 같아야 13배수를 만들 수 있는데, 13으로 나눈 나머지가 모두 있는 경우.", "materials": "", "time": "25분"}, {"name": "비둘기집의 원리의 확장", "research": "※ 목표 : 비둘기집의 원리를 확장하고 다양한 문제의 해결에 이용할 수 있다. + 귀류법  귀류법 : 어떤 명제가 참임을 증명하려 할 때 그 명제의 결론을 부정함으로써 가정(假定) 또는 공리(公理) 등이 모순됨을 보여 간접적으로 그 결론이 성립한다는 것을 증명하는 방법이다.   도입부를 14p 2번 문제로 두고 시작. 원리의 증명은 귀류법으로 보임(12p에서)  가장 운이 없는 경우 - 9게임에서 모두 2골이 들어갔을 경우. 18골이어야 하는데 19골이므로 한 게임은 3골 귀류법 - 3골이 들어가지 않는다면 처음 19골이라는 가정에 모순. 5가지의 색이 다른 구슬이 주머니에 담겨 있다. 몇 개의 구슬을 꺼내야 그 중에 최소한 색이 같은 3개의 구슬이 나오게 할 수 있을까? 가장 운이 없는 경우 - 모든 색을 2개씩 꺼냈을 때.  3. 한 사람이 9시간 걸어서 38km. 처음 1시간은 6km를 걸었을 때 적어도 1번은 연속된 2시간에 최소 8km?        가장 운이 없는 경우 - 처음 1시간을 제외한 나머지 시간은 1시간에 모두 1km를 걸었다 하더라도 마지막에 25km.        귀류법 - 모두 8km보다 적게 걸었다면 모두 합해서 32를 걸을 수 없음 4. 합이 3으로 나누어 떨어지려면 나머지의 합이 3배수가 되어야 함.     가장 운이 없는 경우 - 모든 나머지가 다 나온 경우 (0, 1, 2), 이 경우 나머지의 합이 3배수이므로 가능, 나머지가 2가지인 경우 5개의 수 중 적어도 세 수는 나머지가 같아서 가능  5. 가장 운이 없는 경우 - 모든 무더기의 홀짝성이 다른 경우 (홀, 홀) (홀, 짝) (짝, 홀) (짝, 짝), 5무더기 이므로 비둘기집 원리에 의해 나머지 한 무더기와 홀짝성이 같은 경우 반드시 존재. 따라서 가능 6. 중점은 x, y좌표의 값을 2로 나눈 값이므로 결국 좌표의 합이 짝수가 됨을 보여야 한다. 격자점이라면 x, y좌표가 정수이다. 5개의 격자점 중 어느 두 점은 x좌표, y좌표의 홀짝성이 같다. (5번과 같은 논리) 그렇다면 모두 두 좌표의 합이 짝수가 되므로, 2로 나눌 수 있다. 따라서 중점의 좌표가 정수인 격자점을 찾을 수 있다.", "materials": "", "time": "30분"}], "notes": "중2-2 3. 확률 고1 수(하) 3. 순열과 조합", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 13-2-2 편지를 볼 수 있을까?", "author": "황지향T", "level": "13레벨", "objectives": "① 문장을 논리적 원자로 쪼개서 추론하는 방법을 알아본다.  ② 대우를 이용하여 추론하는 방법을 알아본다.", "teacher_objectives": "긴 문장을 이해하기 위해서는 분해를 통하여 키워드를 얻어내는 것이 중요하며, 얻은 키워드를 내가 생각하는 방향으로 재조립할 수 있다.", "curriculum": "공통수학2 2.집합과 명제", "cms_link": "이전 :  이후 : W14 논리적 추론", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 문장을 논리적 원자로 쪼개서 추론하는 방법을 알아본다.  ② 대우를 이용하여 추론하는 방법을 알아본다.", "materials": ""}, {"name": "교과 연계", "research": "공통수학2 2.집합과 명제", "materials": "이 테마에서 진리집합의 포함관계를 이해하지 못하면 이후 14레벨의 논리적 추론 테마에서 힘들어짐.  진리집합의 포함관계를 이해할 수 있도록 한다."}, {"name": "CMS과정 연계", "research": "이전 :  이후 : W14 논리적 추론", "materials": ""}, {"name": "편지를 볼 수 있을까?", "research": "※ 목표 : 논리 문제를 보고 어떻게 풀 수 있을지 자신의 의견을 말할 수 있다. 의미가 없는 단순한 문장의 관계를 이해하기 위해 우리는 어떠한 노력을 해야 할까?", "materials": "", "time": "활동 전 과제 체크 30분, 5분"}, {"name": "나는 어제 고추장을 먹었을까?", "research": "※ 목표 : 주어진 명제와 의미가 같은 말로 바꾸는 과정에서 대우를 학습할 수 있다. 이 활동에서는 그냥 읽었을 때 이해가 되지 않는 모호한 문장이 있을 때 문장의 구조를 바꾸어 같은 뜻을 가지면서 이해가 쉬운 구조가 될 수 있는지를 발문. ‘내가 어제 먹은 것은 맵지 않았다’라는 장황한 문장보다 간결하게 이해가 되는 문장이 있을지를 생각해본다.", "materials": "", "time": "5분"}, {"name": "아기는 악어를 다룰 수 있을까?", "research": "※ 목표 : 대우를 활용하여 질문에 대한 답을 추론할 수 있다. 2번 활동과 결은 비슷하나 좀 더 이해가 되지 않을 만한 문장이 여러 개 나열됨. 학생들에게 아까 전의 활동과 다른 점이 무엇인지, 문장이 많아질수록(like 루이스캐롤퍼즐) 어떻게 해야 이해가 더 쉬워질지(문장의 연결성 찾기)를 고민해보게 함.", "materials": "", "time": "10분"}, {"name": "문장을 쪼개 봅시다.", "research": "※ 목표 : 문장을 형식적으로 나누어서 기호화하여 나타내고 추론할 수 있다. 아이들이 기호를 정하는 과정에서 혼선이 많으므로, 키워드가 될 수 있는 단어를 선택할 수 있도록 돕는다.", "materials": "", "time": "5분"}, {"name": "명제", "research": "※ 목표 : 조건과 진리집합의 개념을 이해하고, 진리집합을 통해 주어진 명제의 역, 이, 대우 중 동치인 것을 알 수 있다. 앞에서 배운 문장의 연결성을 파악한 내용으로, 어떤 경우에 진리가 되는지 연구함. 사각형의 포함 관계로 설명했을 때 이해가 좀 더 쉬운 경향이 있었음. 앞에서 배웠던 구조를 바꾸는 과정이 사실은 역, 이, 대우였음을 알리며 명제가 참일 때 그 대우도 반드시 참임을 알게 함.", "materials": "", "time": "10분"}, {"name": "부정", "research": "※ 목표 : not의 홀짝성에 대한 이해 + 이중부정의 이해 그리고와 또는의 다른 표현(~이고, ~거나)를 알게 한다. 모두 포함된 관계를 부정하는 경우와 한 조건만 포함될 수도 있는 관계를 부정하는 경우를 고민하게 한다. (벤다이어그램 이용) 부정의 부정은 긍정이며, 부정이 성립하려면 홀수번일 때 가능함을 안다.", "materials": "", "time": "5분"}, {"name": "루이스 캐롤 퍼즐", "research": "※ 목표 : 루이스 캐롤의 논리 퍼즐들을 풀 수 있다. 앞에서 배운 모든 스킬을 이용해야 원활하게 관계를 찾아 해결할 수 있다. (대우로 바꾸기, 연결성 찾기, 기호화 하기) 학생이 시도하지 못하고 있다면 어느 단계를 진행하지 못 하는지(대우가 안 되는지, 연결이 안 되는지, 기호화에 문제가 있는지) 파악하여 피드백을 주도록 한다.", "materials": "", "time": "20분"}], "notes": "공통수학2 2.집합과 명제", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 13-2-3 피보나치 수열", "author": "황지향T", "level": "13레벨", "objectives": "① 점화관계를 찾아서 규칙을 안다. ② 피보나치 수열의 여러 가지 성질을 그림을 통해 알아보기 ③ 피보나치 수열과 황금비의 관계 알아보기", "teacher_objectives": "① 수열의 귀납적 정의에 대한 이해  ② 점화관계의 이해 ③ 점화관계를 찾으려면 어떠한 단계를 거쳐야 하는지에 대한 이해", "curriculum": "수1 수열", "cms_link": "이전 :  W8-2-3 파스칼의 삼각형 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 점화관계를 찾아서 규칙을 안다. ② 피보나치 수열의 여러 가지 성질을 그림을 통해 알아보기 ③ 피보나치 수열과 황금비의 관계 알아보기", "materials": ""}, {"name": "교과 연계", "research": "수1 수열", "materials": "점화 관계를 이용하여야 하는 수열은 어떤 것들이 있을까?에 대한 고민이 필요함. 보통 계차수열의 일반항을 구하는 것이 까다롭기 때문에, 우리는 이전에 여러 계차수열들을의 일반항을 배웠음을 상기시켜주자. (삼각수, 사각수…)"}, {"name": "CMS과정 연계", "research": "이전 :  W8-2-3 파스칼의 삼각형 이후 :", "materials": ""}, {"name": "토끼 이야기", "research": "※ 목표 : 피보나치 수열의 유래와 점화 관계를 알 수 있다.  앞서 등차수열의 일반항, 등비수열의 일반항(하노이의 탑)을 구하는 방법을 배운 상태. 따라서 계차수열의 경우 일반항을 쉽게 구할 수 있을까, 아래에 나온 피보나치 수열을 보고 n을 이용한 일반항으로 표현하는 것이 쉬운지에 대해 토론.", "materials": "", "time": "활동 전 과제 체크 30분, \n15분"}, {"name": "피보나치 수열의 성질", "research": "※ 목표 : 피보나치 수열에서 다양한 성질을 발견하고 그림이나 점화관계를 통해 설명할 수 있다.  수열만 던져 주었을 때 시간을 충분히 주어도 2~3가지를 찾는 것이 전부. 그림이 왜 나왔는지에 대한 고민이 필요하며, 정사각형은 제곱수임을 알게 하여 여러 가지 성질을 더 볼 수 있도록 한다. 그림에서 사분원을 그려나갔을 때 황금나선의 모양을 볼 수 있으며, 여기에서 황금비와의 관계를 알아볼 수 있도록 한다.   5번마다 5의 배수가 존재합니다. 25번마다 25의 배수가 존재합니다. 750번마다 125의 배수가 존재합니다.", "materials": "", "time": "15분"}, {"name": "풀어 볼까요?", "research": "※ 목표 : 피보나치 수열이 나오는 문제를 풀 수 있다.  1. 보통 10계단을 오르는 서로 다른 방법을 구하라 했을 때, 귀납적 정의로 접근하기 보다 바로 10계단을 올라가는 방법을 구하는 시도를 할 확률이 높다. 시행착오를 하도록 두고, 만약 제한 시간 내에 구하지 못하였다면 무엇이 문제였는지 - 귀납적 정의로 접근하기 위해 처음 단계의 몇 개의 항을 찾아야 하고, 몇 개의 항을 찾았다면 거기에서 점화 관계를 구해야 한다는 것을 상기시킨다. 2~5 : 꼭 피보나치 수열의 초항이 1부터 시작되어야 하는 것은 아니다. 각 경우 아이들이 피보나치 테마이기 때문에 바로 n번째 수만 구하고 넘어갈 수 있으므로, 정말 이 수열이 피보나치인지, 중간에서 등차나 등비로 의심되는 구간은 없는지를 살펴본 이후 피보나치라고 확신이 될 때 접근해야 함을 이야기 하여야 한다.", "materials": "", "time": "30분"}], "notes": "수1 수열", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 14-1-1 비둘기집의 원리 2", "author": "황지향 센터장", "level": "14레벨", "objectives": "", "teacher_objectives": "경우의 수 / 확률 파트에서 비둘기집의 원리를 이용할 수 있음을 인지시킨다.", "curriculum": "", "cms_link": "이전 : Why 13-2-1 비둘기집의 원리1 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교안  목표 :   ① 비둘기집의 원리를 이해하고 이를 응용한다. ② 비둘기 집의 원리를 이용하여 문제해결력을 기른다.", "materials": ""}, {"name": "교과 연계", "research": "", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 : Why 13-2-1 비둘기집의 원리1 이후 :", "materials": ""}, {"name": "비고", "research": "비둘기집의 원리1을 먼저 숙지하는 것이 테마 이해에 도움이 될 것.", "materials": ""}, {"name": "알거나 모르거나", "research": "5분 (이전 과제 풀이+주테 30분)", "materials": "※활동 목표 : 임의의 집합에서 특별한 조건을 만족하는 부분집합의 존재성을 비둘기집의 원리를 통해 밝힐 수 있다., , 6p - 이후 활동들의 증명에 시간이 많이 걸릴 것. 가볍게 넘어가는 것이 좋음., Q: 어느 모임이든 6명이 모이면, 그 중 3명을 랜덤으로 골랐을 때 이 3명은 서로 모두 알거나 서로 모두 모르는 그런 3명이 반드시 있대. 뜻이 이해가 되었니?, Q: 왜 이 문제가 비둘기집 원리2에 제시가 된걸까?"}, {"name": "두 가지 색", "research": "20분", "materials": "3색볼펜"}, {"name": "세 가지 색", "research": "20분", "materials": "※활동 목표 : 두 가지 색에서 정리한 사실을 잘 연결해야 수월하게 이해할 수 있다. (귀납법으로 증명해야 하므로), , 10p - a1=3, a2=6, a3=17을 이용하여 일반화 할 수 있게 돕는다., ·한 가지 색이라면 점이 3개만 있어도 됨. a1=3, ·두 가지 색이라면 점이 6개 있어야 됨. a2=6, Q: 우리 아까 두 가지 색으로 삼각형을 완성하려면 점이 몇 개가 있어야 했었지? A: 6개요., ·한 가지 색으로 칠할 때 필요한 점의 수(3)과 두 가지 색으로 칠할 때 필요한 점의 수(6)은 6=1+(3-1)×2+1의 관계식을 가진다., 직전 3개의 점마다 가장 운이 없는 경우 2가지 색깔 모두 선분이 생기는 것. 거기에 꼭짓점인 점A가 필요. 점A + (이전 항의 수-1)×색깔 수+1, , 11p - 두 가지 색 > 세 가지 색으로 연결, ·세 가지 색이라면 가장 운이 없는 경우 이전 두 가지 색에서 필요했던 6개의 선분이 세 가지 색깔이 모두 나온 것. , 1+(6-1)×3+1=17개., ,"}, {"name": "평균 이상은 있다", "research": "15분", "materials": "비둘기집의 원리에서의 포인트는 가장 운이 없는 경우에서도 만족해야한다는 것. 여기에 포인트를 두면 쉽게 해결되는 경우가 많음."}], "notes": "비둘기집의 원리1을 먼저 숙지하는 것이 테마 이해에 도움이 될 것.", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 14-1-3 논리적 추론", "author": "황지향 센터장", "level": "14레벨", "objectives": "① 가능한 모든 경우의 수를 빠짐없이 중복되지 않도록 구할 수 있다.  ②순열과 조합의 의미를 알아보고 차이점을 알아본다.", "teacher_objectives": "14레벨에서 배우는 순열과 조합을 어느 시점에 응용할 수 있는지, 적절한 예시를 들어 아이들과 확인 (중2-2 확률)", "curriculum": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "cms_link": "이전 :  13-2-2 편지를 볼 수 있을까? 이후 :", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 가능한 모든 경우의 수를 빠짐없이 중복되지 않도록 구할 수 있다.  ②순열과 조합의 의미를 알아보고 차이점을 알아본다.", "materials": ""}, {"name": "교과 연계", "research": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  13-2-2 편지를 볼 수 있을까? 이후 :", "materials": "이전 :  13-2-2 편지를 볼 수 있을까?, 이후 :"}, {"name": "비고", "research": "13-15과정은 고등수학 1학년 과정까지는 어느 정도 인지하고 있어야 원활한 수업이 가능. 고레벨 수업을 대비하여 중1-고1 수학 내용 스터디하는 것을 추천.", "materials": "4. 비고, (건의, 제언),"}, {"name": "몇 가지일까", "research": "5분", "materials": "※ 목표 : 경우의 수를 세는 문제들을 수형도를 이용하여 풀고 수형도를 통해서 알게 된 사실들을 일반화할 수 있다., , 수형도를 이용하는 것은 신생 항공사의 고민 활동에서 수형도를 그려보게 하고, 복잡한 조건을 가진 문제일 수록 수형도가 생각에 유리할 수 있음을 알게한다. 어리버리 비서의 실수의 경우 사실 수형도 보다 표를 그려 해결하는 것이 보기가 간단하므로, 이 활동에서는 표(=또는 수형도)를 이용하여 찾은 경우의 수를 일반화 할 수 있다는 사실을 알게 하는 것에 목표를 둔다. (수열의 귀납적 정의로 일반화가 가능)"}, {"name": "순서가 있는 선택의 문제", "research": "15분", "materials": "순열의 계산 방법"}, {"name": "원형테이블에 앉기", "research": "10분", "materials": "원순열의 계산 방법"}, {"name": "순서가 없는 선택의 문제", "research": "15분", "materials": "조합의 계산 방법"}, {"name": "풀어봅시다", "research": "15분", "materials": "※ 목표 : 순열이나 조합의 수를 세는 방법을 다양한 문제에 적용하여 해결할 수 있다., , 시간상 모든 문제가 해결하기 힘듦. 따라서 2, 4번의 경우 수업시간에 해결하고, 1,3번의 문제는 과제로 출제하여 과제 풀이시간을 이용하여 해결 방법 보여주고 있음."}], "notes": "13-15과정은 고등수학 1학년 과정까지는 어느 정도 인지하고 있어야 원활한 수업이 가능. 고레벨 수업을 대비하여 중1-고1 수학 내용 스터디하는 것을 추천.", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 14-3-1 순열과 조합 1", "author": "황지향 센터장", "level": "14레벨", "objectives": "① 가능한 모든 경우의 수를 빠짐없이 중복되지 않도록 구할 수 있다.  ②순열과 조합의 의미를 알아보고 차이점을 알아본다.", "teacher_objectives": "14레벨에서 배우는 순열과 조합을 어느 시점에 응용할 수 있는지, 적절한 예시를 들어 아이들과 확인 (중2-2 확률)", "curriculum": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "cms_link": "이전 :  Pre-why S1-1 기사 랜스롱 S3-2 꼼꼼이네 아이스크림 이후 :  Why 15-1-3 순열과 조합2", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 가능한 모든 경우의 수를 빠짐없이 중복되지 않도록 구할 수 있다.  ②순열과 조합의 의미를 알아보고 차이점을 알아본다.", "materials": ""}, {"name": "교과 연계", "research": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  Pre-why S1-1 기사 랜스롱 S3-2 꼼꼼이네 아이스크림 이후 :  Why 15-1-3 순열과 조합2", "materials": ""}, {"name": "비고", "research": "13-15과정은 고등수학 1학년 과정까지는 어느 정도 인지하고 있어야 원활한 수업이 가능. 고레벨 수업을 대비하여 중1-고1 수학 내용 스터디하는 것을 추천.", "materials": "4. 비고, (건의, 제언),"}, {"name": "몇 가지일까", "research": "5분", "materials": "※ 목표 : 경우의 수를 세는 문제들을 수형도를 이용하여 풀고 수형도를 통해서 알게 된 사실들을 일반화할 수 있다., , 수형도를 이용하는 것은 신생 항공사의 고민 활동에서 수형도를 그려보게 하고, 복잡한 조건을 가진 문제일 수록 수형도가 생각에 유리할 수 있음을 알게한다. 어리버리 비서의 실수의 경우 사실 수형도 보다 표를 그려 해결하는 것이 보기가 간단하므로, 이 활동에서는 표(=또는 수형도)를 이용하여 찾은 경우의 수를 일반화 할 수 있다는 사실을 알게 하는 것에 목표를 둔다. (수열의 귀납적 정의로 일반화가 가능)"}, {"name": "순서가 있는 선택의 문제", "research": "15분", "materials": "순열의 계산 방법"}, {"name": "원형테이블에 앉기", "research": "10분", "materials": "원순열의 계산 방법"}, {"name": "순서가 없는 선택의 문제", "research": "15분", "materials": "조합의 계산 방법"}, {"name": "풀어봅시다", "research": "15분", "materials": "※ 목표 : 순열이나 조합의 수를 세는 방법을 다양한 문제에 적용하여 해결할 수 있다., , 시간상 모든 문제가 해결하기 힘듦. 따라서 2, 4번의 경우 수업시간에 해결하고, 1,3번의 문제는 과제로 출제하여 과제 풀이시간을 이용하여 해결 방법 보여주고 있음."}], "notes": "13-15과정은 고등수학 1학년 과정까지는 어느 정도 인지하고 있어야 원활한 수업이 가능. 고레벨 수업을 대비하여 중1-고1 수학 내용 스터디하는 것을 추천.", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 14-2-3 고지를 점령하라", "author": "황지향 센터장", "level": "14레벨", "objectives": "① 불변량을 이용하여 문제를 해결한다  ② 무한등비급수에 대한 이해를 향상시킨다.", "teacher_objectives": "11, 12레벨에 걸쳐 제시되었던 무한등비급수의 이해를 마무리 (공비가 1보다 작을 때 문제를 해결할 수 있어야 함)", "curriculum": "고2 수1 수열, 고2 수열의 극한(미적분)", "cms_link": "이전 :  11-3-1 무한의 신비, 12-2-1 황금비, 12-1-4 프랙탈 이후 : 교안에는 W14 성벽을 쌓아라 연관이 있다고 함 → 연관성?", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 불변량을 이용하여 문제를 해결한다  ② 무한등비급수에 대한 이해를 향상시킨다.", "materials": ""}, {"name": "교과 연계", "research": "고2 수1 수열, 고2 수열의 극한(미적분)", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  11-3-1 무한의 신비, 12-2-1 황금비, 12-1-4 프랙탈 이후 : 교안에는 W14 성벽을 쌓아라 연관이 있다고 함 → 연관성?", "materials": ""}, {"name": "비고", "research": "정확하게 무한등비급수 관련 문제를 풀어내야 한다기 보다, 이전 레벨들에서 언급되었던 개념들을 마무리 해야 하는 단계. 따라서 무한등비급수 공식을 정리할 수 있도록 유도 과정이 중요", "materials": ""}, {"name": "고지를 점령하라", "research": "활동 전 과제 체크 20분,  활동 진행 5분", "materials": "바둑돌, , 바둑돌 자석, (자석은 20개 이상)"}, {"name": "2칸 점령", "research": "5분", "materials": "※ 목표 : 경계선 두 칸 위 고지를 최소의 병사 수로 점령하는 방법을 찾을 수 있다., , 답안이 여러 가지가 나올 수 있으므로, 만약 강사가 찾은 답안과 다른 답안이 나왔다면 학생에게 바둑돌로 과정을 보여주게 하고, 만약 5~6명을 이야기 하는 학생에게는 더 적은 수로 성공할 수는 없는지 발문한다."}, {"name": "3칸 점령", "research": "10분", "materials": "※ 목표 : 경계선 세 칸 위 고지를 최소의 병사의 수로 점령하는 방법을 찾을 수 있다., , 수업 전 준비한 예시를 칠판에 자석을 이용하여 고지까지 올라가는 과정을 보여줄 수 있어야 한다. 충분히 연습하여 학생들 앞에서 실수하지 않을 수 있도록 하는 것이 중요하다."}, {"name": "4칸 점령", "research": "15분", "materials": "※ 목표 : 경계선 네 칸 위 고지를 최소의 병사의 수로 점령하는 방법을 찾을 수 있다., , 20명을 배치하는 과정을 보여야 하므로 충분히 바둑돌 자석을 준비할 수 있도록 한다. 20명이 움직여 고지로 가는 과정을 보일 수 있도록 해야 하니 수업 전 충분히 연습하여 원활히 보일 수 있도록 한다. (준비해도 막상 실패하는 경우가 많음), ▶과정에서의 포인트는 고지로 올라갈 때 (중앙, 위)방향 우선으로 가야 한다는 것."}, {"name": "5칸 점령", "research": "45분", "materials": "※ 목표 : 경계선 다섯 칸 위 고지를 점령할 수 없음을 증명할 수 있다. (불변량을 이용하여 점령 가능성을 알아본다. 무한등비급수를 통해 불가능성을 설명한다.), , 이전 레벨에서 배웠던 무한의 개념을 정립할 수 있음. 12-2-1 황금비에서 x^2+x=1이 -1+루트5/2를 만족한다는 사실을 배웠으며, 11-3-1 무한의 신비에서 공비가 1보다 작을 때 소거법을 이용하여 등비수열의 합을 구할 수 있음을 배웠음. 12-1-4에서 a/1-r의 개념을 배운 적이 있으므로, 이 모두를 종합하여 공비가 1보다 작을 때 무한등비수열의 합을 구할 수 있음을 알게 하는 것이 포인트. 반대로, 공비가 1보다 크다면 어떤 일이 일어나게 될지 아이들에게 발문하고, 그때도 우리가 배웠던 것 처럼 합을 구할 수 있을 것인지 토론해보게 한다."}], "notes": "정확하게 무한등비급수 관련 문제를 풀어내야 한다기 보다, 이전 레벨들에서 언급되었던 개념들을 마무리 해야 하는 단계. 따라서 무한등비급수 공식을 정리할 수 있도록 유도 과정이 중요", "materials": [], "author_email": "rira@mjcms.com"}, {"title": "WHY 15-1-3 순열과 조합 2", "author": "황지향T", "level": "15레벨", "objectives": "① 일대일대응을 이용하여 여러 가지 경우의 수를 구할 수 있다.  ② 경우의 수를 중복 또는 누락되지 않게 세도록 대상을 정확히 분류할 수 있다.", "teacher_objectives": "순열과 조합의 확장에 중점을 두고, 이전 테마에서 진행되었던 순열과 조합의 이해를 다시 한번 돕는다.", "curriculum": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "cms_link": "이전 :  Pre-why S1-1 기사 랜스롱 S3-2 꼼꼼이네 아이스크림, 14-3-1 순열과 조합 이후 :  Why 15-1-3 순열과 조합2", "activities": [{"name": "수업 목표", "research": "※ 교재  목표 :   ① 일대일대응을 이용하여 여러 가지 경우의 수를 구할 수 있다.  ② 경우의 수를 중복 또는 누락되지 않게 세도록 대상을 정확히 분류할 수 있다.", "materials": ""}, {"name": "교과 연계", "research": "중2-2 확률, 고1 수(하) 3. 순열과 조합", "materials": ""}, {"name": "CMS과정 연계", "research": "이전 :  Pre-why S1-1 기사 랜스롱 S3-2 꼼꼼이네 아이스크림, 14-3-1 순열과 조합 이후 :  Why 15-1-3 순열과 조합2", "materials": ""}, {"name": "비고", "research": "", "materials": "4. 비고, (건의, 제언),"}, {"name": "길 찾기", "research": "활동 전 과제 체크 20분,  활동 진행 20분", "materials": "※ 목표 : 특별한 조건(카탈란 수)을 만족하는 길의 가짓수를 세며 계산법을 탐구 할 수 있다.,  , 격자에서 최단거리를 찾는 방법은 아이들이 많이 접해본 유형(8-2-3 파스칼의 삼각형에서도 언급)이므로, n의 수가 점점 커짐에 따라 최단거리를 해당 점에 일일이 적어나가는 과정이 과연 가장 이상적인 방법인지에 대한 고민을 해보게 함. 총 10칸의 최단거리 중 5칸의 위치를 결정하는 것으로는 특정 지점(X)을 지나는 방법을 알 수 없으므로, 최단거리는 달라지지 않게 하면서 특정 지점을 지나지 않는 경우와 어떤 차이점을 두어야 할지 발문해야 함."}, {"name": "카탈란 수", "research": "20분", "materials": "※ 목표 : 카탈란 수가 나오는 예를 접하며 계산방법을 적용할 수 있다. 일대일대응을 통하여 두 가지 경우의 수가 같은 것임을 알 수 있다., , 1번 문제의 경우 결국 앞의 경우의 문제와 같다. 1번에서 카탈란 수의 공식이 제시되어야 한다. 2nCn-2nC(n-1)=특정 지점을 지나지 않는 순수한 최단거리의 수이며 결국 어느 두 요소 중 스코어를 판단하였을 때 적지 않아야(이기거나 같아야 함) 하는 경우임을 연결할 수 있도록 발문이 필요.,  2번 문제의 경우 영재원에서도 많이 출제되는 유형. 각 수가 어느 위치에 있는지 알아보면 결국 위가 아래보다 적지 않아야 하는 카탈란 수임을 알아낼 수 있다. 3번 문제의 경우 시간이 있으면 풀이, 만약 시간이 없다면 괄호와 문자에 대한 힌트만 제시하고 과제로 제시한 후 다음 시간에 풀이."}, {"name": "삼각형은 몇 개 만들어질까?", "research": "20분", "materials": "3색 볼펜"}, {"name": "상자 속에 상자 넣기", "research": "10분", "materials": "※ 목표 : 규모가 작은 경우에 수를 센 방법을 이용하여 규모가 커질 때의 수를 세는 것을 탐구할 수 있다. ,  , 이전의 방법을 이용하여 다음 해결 방법을 찾는 과정. 상자가 3개 있는 경우는 쉽게 찾기 가능. 4개의 경우 자유롭게 찾다보면 (총 11가지) 수월하게 찾는 방법을 모르게 됨. 따라서 자유롭게 찾아 시행착오를 겪게 하고, 만약 시행착오를 겪었다면 이전 경우와 비교하여 어떤 점이 달라졌는지 확인하게 한 후 이전 방법을 이용하도록 돕는다."}], "notes": "", "materials": [], "author_email": "rira@mjcms.com"}]};
