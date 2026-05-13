// ── 라이브러리 상태 변수 ──
let currentLevel = '';           // 레벨/학년 칩 필터
let _currentLibraryTab = '사고력';
let _gyogwaUnitFilter = '';   // 교과 인덱스에서 특정 단원 클릭 시 설정

function setLibraryTab(tab) {
  _currentLibraryTab = tab;
  _gyogwaUnitFilter = '';
  document.getElementById('lib-tab-사고력').classList.toggle('active', tab === '사고력');
  document.getElementById('lib-tab-교과').classList.toggle('active', tab === '교과');
  currentLevel = '';
  filterLessons();
}

function renderLibrary() {
  const allLessons = getAllLessons();

  // Author filter (정규화된 이름으로 중복 제거)
  const authorNormMap = {};
  allLessons.forEach(l => {
    if (!l.author) return;
    const norm = normalizeName(l.author);
    if (!authorNormMap[norm]) authorNormMap[norm] = norm;
  });
  const normalizedAuthors = Object.keys(authorNormMap).sort((a,b) => a.localeCompare(b,'ko'));
  const myName = normalizeName(sessionStorage.getItem('cms_name') || '');
  let authHtml = '<option value="">전체 작성자</option>';
  normalizedAuthors.forEach(norm => { authHtml += `<option value="${norm}"${norm===myName?' selected':''}>${norm}</option>`; });
  document.getElementById('author-filter').innerHTML = authHtml;

  filterLessons();
}

async function loadMoreLessons() {
  if (!_lessonHasMore) return;
  const btn = document.getElementById('load-more-btn');
  if (btn) { btn.disabled = true; btn.textContent = '불러오는 중...'; }
  try {
    let moreQuery = _sb.from('custom_lessons').select('id,data', { count: 'exact' })
      .order('updated_at', { ascending: false });
    const myCenter2 = getCurrentCenter();
    if (_centerFilter && myCenter2) {
      moreQuery = moreQuery.or(`data->>center.eq.${myCenter2},data->>center.is.null`);
    }
    const { data, count, error } = await moreQuery
      .range(_lessonOffset, _lessonOffset + LESSON_PAGE_SIZE - 1);
    if (error) throw error;
    const newLessons = data.map(r => ({...r.data, id: r.id}));
    _state.customLessons = [..._state.customLessons, ...newLessons];
    _lessonOffset += newLessons.length;
    _lessonHasMore = count > _lessonOffset;
    filterLessons();
  } catch(e) {
    console.error('더 보기 오류:', e);
    if (btn) { btn.disabled = false; btn.textContent = '더 보기'; }
  }
}

function onSearchInput() {
  clearTimeout(_searchTimer);
  // [신규] 사용자가 검색창에 직접 타이핑하면 테마 필터를 자동 해제한다.
  //   (테마 필터와 검색어를 동시에 적용하지 않음 — 의도가 충돌할 수 있어 검색 우선)
  if (_themeFilter) {
    _themeFilter = '';
    _applyThemeFilterUI();
  }
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    _dbSearchActive = false;
    filterLessons();
    return;
  }
  _searchTimer = setTimeout(() => searchLessonsFromDB(query), 350);
}

async function searchLessonsFromDB(query) {
  _dbSearchActive = true;
  try {
    let searchQuery = _sb.from('custom_lessons').select('id,data')
      .filter('data->>title', 'ilike', `%${query}%`)
      .order('updated_at', { ascending: false });
    const myCenter3 = getCurrentCenter();
    if (_centerFilter && myCenter3) {
      searchQuery = searchQuery.or(`data->>center.eq.${myCenter3},data->>center.is.null`);
    }
    const { data, error } = await searchQuery.limit(100);
    if (!error && data) {
      // [패치] _state.customLessons를 통째로 덮어쓰면 인덱스 페이지의 진척도/완료
      //   표시가 검색 결과 범위로 좁혀져 버린다. 그래서 이미 로드된 교안은 그대로
      //   두고, 검색으로 새로 발견된 id만 병합한다.
      const newResults = data.map(r => ({...r.data, id: r.id}));
      const existingIds = new Set(_state.customLessons.map(l => l.id));
      const additions = newResults.filter(r => !existingIds.has(r.id));
      if (additions.length > 0) {
        _state.customLessons = [..._state.customLessons, ...additions];
      }
      // 검색 모드에서는 페이지네이션의 "더 보기" 버튼은 의미가 없으므로 숨긴다.
      // (filterLessons가 _dbSearchActive 플래그로 버튼 표시를 제어함)
    }
  } catch(e) {
    console.error('검색 오류:', e);
    _dbSearchActive = false;
  }
  filterLessons();
}

function filterLessons() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const author = document.getElementById('author-filter').value;
  const allLessons = getAllLessons();
  const isGyogwaTab = _currentLibraryTab === '교과';

  let filtered = allLessons.filter(l => {
    // ── 탭 필터: lesson_type 없으면 사고력으로 간주 (하위 호환) ──
    const type = l.lesson_type || '사고력';
    if (type !== _currentLibraryTab) return false;

    if (isGyogwaTab) {
      if (currentLevel && l.gyogwa_grade !== currentLevel) return false;
      if (_gyogwaUnitFilter && l.gyogwa_unit !== _gyogwaUnitFilter) return false;
    } else {
      if (currentLevel && l.level !== currentLevel) return false;
    }
    if (author && normalizeName(l.author) !== author) return false;
    if (_themeFilter) {
      const themeKey = _normalizeThemeKey(_themeFilter);
      const titleKey = _normalizeThemeKey(l.title);
      if (themeKey && !titleKey.includes(themeKey)) return false;
    }
    if (query) {
      const searchText = [l.title, l.objectives, l.teacher_objectives, l.notes,
        l.gyogwa_grade || '', l.gyogwa_unit || '',
        ...l.activities.map(a => a.name + ' ' + researchToPlainText(a.research))
      ].join(' ').toLowerCase();
      if (!searchText.includes(query)) return false;
    }
    return true;
  });

  // ── 칩 렌더링: 탭에 따라 레벨 칩 vs 학년 칩 ──
  let chips = '';
  if (isGyogwaTab) {
    // 교과 탭: 학년/학기 칩
    const usedGrades = [...new Set(allLessons.filter(l=>(l.lesson_type||'사고력')==='교과').map(l=>l.gyogwa_grade).filter(Boolean))];
    const orderedGrades = CURRICULUM_GRADE_ORDER.filter(g => usedGrades.includes(g));
    chips = `<div class="chip ${!currentLevel?'active':''}" onclick="_gyogwaUnitFilter='';currentLevel='';filterLessons()">전체</div>`;
    orderedGrades.forEach(g => {
      chips += `<div class="chip ${currentLevel===g?'active':''}" onclick="_gyogwaUnitFilter='';currentLevel='${g}';filterLessons()">${g}</div>`;
    });
  } else {
    // 사고력 탭: 기존 레벨 칩
    const levels = sortLevels([...new Set(allLessons.filter(l=>(l.lesson_type||'사고력')==='사고력').map(l=>l.level))]);
    chips = `<div class="chip ${!currentLevel?'active':''}" onclick="currentLevel='';filterLessons()">전체</div>`;
    levels.forEach(lv => {
      chips += `<div class="chip ${currentLevel===lv?'active':''}" onclick="currentLevel='${lv}';filterLessons()">${lv}</div>`;
    });
  }
  document.getElementById('level-chips').innerHTML = chips;
  
  let html = '';
  if (filtered.length === 0) {
    html = '<div class="empty-state"><div class="icon">🔍</div><p>검색 결과가 없습니다</p></div>';
  } else {
    filtered.forEach((l, i) => {
      const realActivities = l.activities.filter(a => 
        !['수업 목표','교과 연계','CMS과정 연계'].includes(a.name)
      );
      const lessonIdx = allLessons.indexOf(l);
    const isGyogwa = (l.lesson_type === '교과');
    html += `<div class="lesson-card" onclick="toggleLesson(this)" data-lesson-id="${l.id}">
        <div class="lesson-card-header">
          <div><div class="lesson-card-title">${highlightText(l.title, query)}</div></div>
          <div class="lesson-card-meta">
            ${isGyogwa
              ? `${l.gyogwa_grade ? `<span class="badge badge-gyogwa-grade">${l.gyogwa_grade}</span>` : ''} ${l.gyogwa_unit ? `<span class="badge badge-gyogwa-unit">${l.gyogwa_unit}</span>` : ''}`
              : `<span class="badge badge-level">${l.level}</span>`}
            ${l.author ? `<span class="badge badge-author">${l.author}</span>` : ''}
            ${!isGyogwa ? `<a class="print-btn" href="${buildPortalSearchUrl(l.title, l.level||'')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="text-decoration:none" title="교사 포털 자료실">🔍 자료실</a>` : ''}
            <button class="print-btn" onclick="event.stopPropagation();startSlideshow('${l.id}')">📽️ 발표</button>
            <button class="print-btn" onclick="event.stopPropagation();printLesson(${lessonIdx})">🖨️ 출력</button>
            <button class="print-btn" style="color:var(--primary);border-color:var(--primary)" onclick="event.stopPropagation();loadLessonToEditor('${l.id}', ${!!l.custom})">${canEdit(l) ? '✏️ 편집' : '📋 복사'}</button>
            ${isAdmin() ? `<button class="print-btn" style="color:var(--red);border-color:var(--red)" onclick="event.stopPropagation();deleteAnyLesson('${l.id}', ${!!l.custom})" title="${isMyLesson(l) ? '삭제' : '관리자 권한으로 삭제'}">🗑️ 삭제${!isMyLesson(l) ? ' (관리자)' : ''}</button>` : ''}
            <span class="chevron">▼</span>
          </div>
        </div>
        <div class="lesson-card-body">
          ${l.objectives ? `<div class="info-row"><span class="info-label">📎 수업 목표</span><span class="info-value">${highlightText(l.objectives, query)}</span></div>` : ''}
          ${l.teacher_objectives ? `<div class="info-row"><span class="info-label">🎯 교사 목표</span><span class="info-value">${highlightText(l.teacher_objectives, query)}</span></div>` : ''}
          ${l.curriculum ? `<div class="info-row"><span class="info-label">📘 교과 연계</span><span class="info-value">${l.curriculum}</span></div>` : ''}
          ${l.cms_link ? `<div class="info-row"><span class="info-label">🔗 CMS 연계</span><span class="info-value">${l.cms_link}</span></div>` : ''}
          ${l.notes ? `<div class="info-row"><span class="info-label">📝 비고</span><span class="info-value">${l.notes}</span></div>` : ''}
          ${(l.textbook_images && l.textbook_images.length > 0) ? `<div class="info-row"><span class="info-label">📖 교재 이미지</span><span class="info-value" style="display:flex;flex-wrap:wrap;gap:6px">${l.textbook_images.map(src => `<div class="view-img-thumb"><img src="${src}" onclick="openLightbox(this.src)" title="클릭하면 크게"></div>`).join('')}</span></div>` : ''}
          ${(l.links && l.links.length > 0) ? `<div class="info-row"><span class="info-label">🔗 참고 링크</span><span class="info-value" style="display:flex;flex-direction:column;gap:4px">${l.links.map(lk => `<a href="${lk.url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;font-size:13px;word-break:break-all">${lk.label || lk.url}</a>`).join('')}</span></div>` : ''}
          ${(l.attachments && l.attachments.length > 0) ? `<div class="info-row"><span class="info-label">📎 첨부파일</span><span class="info-value" style="display:flex;flex-direction:column;gap:6px;width:100%">${l.attachments.map(att => `<div class="attach-item"><span class="attach-icon">${getFileIcon(att.name)}</span><div class="attach-info"><div class="attach-name">${escHtml(att.name)}</div><div class="attach-size">${formatFileSize(att.size)}</div></div><a class="attach-download" href="${att.url}" target="_blank" download="${escHtml(att.name)}">⬇️ 다운로드</a></div>`).join('')}</span></div>` : ''}
          ${realActivities.length > 0 ? `
            <div class="activity-list">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px">활동 연구 (${realActivities.length}개)</div>
              ${realActivities.map(a => `
                <div class="activity-item">
                  <div class="activity-name">
                    <span>${highlightText(a.name, query)}</span>
                    ${a.time ? `<span class="activity-time">${a.time}</span>` : ''}
                  </div>
                  ${a.workbook ? `<div class="activity-workbook">📖 워크북 연계: ${highlightText(a.workbook, query)}</div>` : ''}
                  ${a.research ? `<div class="activity-research">${researchToDisplayHtml(a.research, query)}</div>` : ''}
                  ${a.materials ? `<div class="activity-materials">🧩 준비물: ${a.materials}</div>` : ''}
                  ${(a.links && a.links.length > 0) ? `<div class="activity-links" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--gray-200)"><div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:2px">🔗 참고 링크</div>${a.links.map(lk => `<a href="${lk.url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;font-size:13px;word-break:break-all">${escHtml(lk.label || lk.url)}</a>`).join('')}</div>` : ''}
                  ${a.images && a.images.length > 0 ? '<div class="view-img-grid">' + a.images.map(src => '<div class="view-img-thumb"><img src="' + src + '" onclick="openLightbox(this.src)" title="클릭"></div>').join('') + '</div>' : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="comment-section" onclick="event.stopPropagation()">
            <div class="comment-section-title">💬 댓글 & 피드백</div>
            <div class="comment-list" id="comments-${l.id}">
              <div class="comment-empty">교안을 열면 댓글을 불러옵니다...</div>
            </div>
            <div class="comment-input-row">
              <textarea class="comment-textarea" id="comment-input-${l.id}" placeholder="피드백이나 의견을 남겨보세요..." rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitComment('${l.id}')}"
                oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
              <button class="comment-submit-btn" id="comment-btn-${l.id}" onclick="submitComment('${l.id}')">등록</button>
            </div>
          </div>
        </div>
      </div>`;
    });
  }
  if (_lessonHasMore && !_dbSearchActive) {
    html += `<div style="text-align:center;padding:16px 0">
      <button id="load-more-btn" class="btn btn-secondary" onclick="loadMoreLessons()">
        📄 더 보기
      </button>
    </div>`;
  }
  const _lessonListEl = document.getElementById('lesson-list');
  _lessonListEl.innerHTML = html;
  _scheduleMathRender(_lessonListEl);
}

function highlightText(text, query) {
  if (!query || !text) return text || '';
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function toggleLesson(el) {
  el.classList.toggle('open');
  if (el.classList.contains('open')) {
    const lessonId = el.dataset.lessonId;
    if (lessonId) loadComments(lessonId);
  }
}

// ── 댓글 기능 ──
async function loadComments(lessonId) {
  const container = document.getElementById('comments-' + lessonId);
  if (!container) return;
  container.innerHTML = '<div class="comment-empty">불러오는 중...</div>';
  try {
    const { data, error } = await _sb
      .from('lesson_comments')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    renderComments(lessonId, data || []);
  } catch(e) {
    container.innerHTML = '<div class="comment-empty">댓글을 불러오지 못했어요 😅</div>';
  }
}

function renderComments(lessonId, comments) {
  const container = document.getElementById('comments-' + lessonId);
  if (!container) return;
  const myName = sessionStorage.getItem('cms_name') || '';
  if (comments.length === 0) {
    container.innerHTML = '<div class="comment-empty">아직 댓글이 없어요. 첫 번째로 남겨보세요! 💬</div>';
    return;
  }
  container.innerHTML = comments.map(c => {
    const isMe = myName && normalizeName(c.author) === normalizeName(myName);
    const timeStr = new Date(c.created_at).toLocaleString('ko-KR', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<div class="comment-item" id="ci-${c.id}">
      <div class="comment-author">👤 ${escHtml(c.author)}</div>
      <div class="comment-text">${escHtml(c.content)}</div>
      <div class="comment-time">${timeStr}</div>
      ${isMe ? `<button class="comment-del-btn" onclick="deleteComment('${c.id}','${lessonId}')" title="삭제">✕</button>` : ''}
    </div>`;
  }).join('');
}

async function submitComment(lessonId) {
  const textarea = document.getElementById('comment-input-' + lessonId);
  if (!textarea) return;
  const content = textarea.value.trim();
  if (!content) return;
  const author = sessionStorage.getItem('cms_name') || '익명';
  const btn = document.getElementById('comment-btn-' + lessonId);
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const { error } = await _sb.from('lesson_comments').insert({
      lesson_id: lessonId,
      author: author,
      content: content
    });
    if (error) throw error;
    textarea.value = '';
    await loadComments(lessonId);
  } catch(e) {
    alert('댓글 저장에 실패했어요. 다시 시도해주세요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '등록'; }
  }
}

async function deleteComment(commentId, lessonId) {
  if (!confirm('댓글을 삭제하시겠어요?')) return;
  try {
    const { error } = await _sb.from('lesson_comments').delete().eq('id', commentId);
    if (error) throw error;
    await loadComments(lessonId);
  } catch(e) {
    alert('삭제에 실패했어요. 다시 시도해주세요.');
  }
}

// Editor

// ── 활동 연구 서식(rich text) 헬퍼 ──
// 허용 태그: 굵게/기울임/밑줄/줄바꿈/색상·형광펜용 span + 수식용 span
const _RESEARCH_ALLOWED_TAGS = ['b','strong','i','em','u','br','span','div','p','mark','font'];
const _RESEARCH_ALLOWED_ATTRS = ['style','color','class','data-latex'];
const _RESEARCH_ALLOWED_STYLES = ['color','background-color','background','font-weight','font-style','text-decoration'];
const _MATH_LATEX_MAX = 800; // 수식 LaTeX 최대 길이 (안전)

function isResearchHtml(s) {
  if (!s) return false;
  return /<(b|i|u|strong|em|span|br|p|div|mark|font)[\s>\/]/i.test(s);
}

// DOMPurify 기반 안전한 sanitizer.
// - <span class="math" data-latex="..."> 만 class·data-latex 보존
// - 다른 모든 class/이벤트핸들러/스크립트/외부 속성은 제거
// - style 속성은 허용된 CSS 속성만 통과
function sanitizeResearchHtml(html) {
  if (!html) return '';
  // DOMPurify 미로드 시 안전 폴백 — 텍스트로만 표현
  if (typeof DOMPurify === 'undefined') {
    return String(html).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // 1차: DOMPurify로 태그·속성·스크립트 차단
  let cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: _RESEARCH_ALLOWED_TAGS,
    ALLOWED_ATTR: _RESEARCH_ALLOWED_ATTRS,
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script','style','iframe','object','embed','link','meta'],
    FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','onblur','onchange','onsubmit','href','src']
  });
  // 2차: style 속성 허용 CSS만 남기고, class는 'math'만 허용,
  //      수식 span은 렌더링된 자식 비우고 data-latex만 남김 (저장 용량 절감)
  const tpl = document.createElement('template');
  tpl.innerHTML = cleaned;
  const filterStyle = (val) => {
    return (val || '').split(';').map(s => s.trim()).filter(s => {
      if (!s) return false;
      const prop = s.split(':')[0].trim().toLowerCase();
      return _RESEARCH_ALLOWED_STYLES.includes(prop);
    }).join('; ');
  };
  // style 정리
  tpl.content.querySelectorAll('[style]').forEach(el => {
    const safe = filterStyle(el.getAttribute('style'));
    if (safe) el.setAttribute('style', safe);
    else el.removeAttribute('style');
  });
  // class는 'math' 하나만 허용
  tpl.content.querySelectorAll('[class]').forEach(el => {
    if (el.classList && el.classList.contains('math')) {
      el.className = 'math';
    } else {
      el.removeAttribute('class');
    }
  });
  // 수식 span: data-latex 검증 + 렌더링 자식 비우기
  tpl.content.querySelectorAll('span.math').forEach(el => {
    const latex = (el.getAttribute('data-latex') || '').trim();
    if (!latex) {
      // data-latex 없는 math span은 텍스트로 변환
      const txt = document.createTextNode(el.textContent || '');
      el.replaceWith(txt);
      return;
    }
    if (latex.length > _MATH_LATEX_MAX) {
      // 너무 긴 수식은 자르기
      el.setAttribute('data-latex', latex.slice(0, _MATH_LATEX_MAX));
    }
    // 렌더링된 KaTeX 자식 제거 — 저장은 data-latex만
    el.innerHTML = '';
  });
  // class만 있고 math가 아닌 잔여 빈 속성 제거 (안전)
  tpl.content.querySelectorAll('[class=""]').forEach(el => el.removeAttribute('class'));
  return tpl.innerHTML;
}

// 화면용 HTML (구버전 평문 호환)
function researchToDisplayHtml(s, query) {
  if (!s) return '';
  if (isResearchHtml(s)) {
    return sanitizeResearchHtml(s);
  }
  let safe = escHtml(s);
  if (query) {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    safe = safe.replace(re, '<mark>$1</mark>');
  }
  return safe.replace(/\n/g, '<br>');
}

function researchToPlainText(s) {
  if (!s) return '';
  if (!isResearchHtml(s)) return s;
  const tpl = document.createElement('template');
  tpl.innerHTML = sanitizeResearchHtml(s);
  // 검색 시 LaTeX 소스(data-latex)는 제외 — 사용자가 원본 LaTeX를 검색어로 쓸 일은 없음
  tpl.content.querySelectorAll('span.math').forEach(el => el.remove());
  return (tpl.content.textContent || '').replace(/\s+/g, ' ').trim();
}
