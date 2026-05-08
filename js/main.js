function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 교안 유형 토글 (사고력 / 교과) ──
function setLessonType(type) {
  document.getElementById('ed-lesson-type').value = type;
  const isGyogwa = type === '교과';
  document.getElementById('type-btn-사고력').classList.toggle('active', !isGyogwa);
  document.getElementById('type-btn-교과').classList.toggle('active', isGyogwa);
  document.getElementById('ed-sagoryeok-fields').style.display = isGyogwa ? 'none' : '';
  document.getElementById('ed-gyogwa-fields').style.display = isGyogwa ? '' : 'none';
  document.getElementById('ed-sagoryeok-extra').style.display = isGyogwa ? 'none' : 'grid';
  // 교과 탭일 때 학년 select 초기화
  if (isGyogwa) {
    const gradeEl = document.getElementById('ed-gyogwa-grade');
    if (gradeEl.options.length <= 1) {
      CURRICULUM_GRADE_ORDER.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        gradeEl.appendChild(opt);
      });
    }
  }
}

// 학년/학기 변경 시 단원 select 갱신
function updateGyogwaUnits(selectUnit) {
  const grade = document.getElementById('ed-gyogwa-grade').value;
  const units = (grade && CURRICULUM_UNITS[grade]) || [];
  const unitEl = document.getElementById('ed-gyogwa-unit');
  unitEl.innerHTML = '<option value="">단원 선택</option>';
  units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    if (selectUnit && u === selectUnit) opt.selected = true;
    unitEl.appendChild(opt);
  });
}

// 활동 에디터의 + 추가 버튼 → 그 활동의 act-links 안에 한 행 추가
function addActLinkRow(btn) {
  const editor = btn.closest('.activity-editor');
  if (!editor) return;
  const container = editor.querySelector('.act-links');
  if (!container) return;
  _appendActLinkRow(container, '', '');
}
// 활동 링크 한 행 만들기 (재사용 헬퍼)
function _appendActLinkRow(container, label, url) {
  const row = document.createElement('div');
  row.className = 'act-link-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    <input type="text" class="form-input link-label" placeholder="링크 제목 (선택, 예: 유튜브 영상)" value="${escHtml(label)}" style="flex:1;min-width:0">
    <input type="url" class="form-input link-url" placeholder="https://" value="${escHtml(url)}" style="flex:2;min-width:0">
    <button type="button" onclick="this.parentElement.remove()" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:20px;padding:0 4px;line-height:1" title="삭제">×</button>
  `;
  container.appendChild(row);
}

function addLinkRow(label='', url='') {
  const container = document.getElementById('ed-links');
  const row = document.createElement('div');
  row.className = 'link-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    <input type="text" class="form-input link-label" placeholder="링크 제목 (선택)" value="${label}" style="flex:1;min-width:0">
    <input type="url" class="form-input link-url" placeholder="https://" value="${url}" style="flex:2;min-width:0">
    <button type="button" onclick="this.parentElement.remove();refreshLinksBadge()" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--gray-400);font-size:20px;padding:0 4px;line-height:1" title="삭제">×</button>
  `;
  container.appendChild(row);
  refreshLinksBadge();
}

async function saveLesson() {
  const title = document.getElementById('ed-title').value.trim();
  if (!title) { showToast('⚠️ 테마명을 입력해주세요'); return; }
  
  const activities = [];
  let skippedEmpty = 0;
  document.querySelectorAll('.activity-editor').forEach(ae => {
    const name = ae.querySelector('.act-name').value.trim();
    if (!name) { skippedEmpty++; return; }
    if (name) {
      const imgGrid = ae.querySelector('.img-grid');
      const images = imgGrid
        ? Array.from(imgGrid.querySelectorAll('.img-thumb')).map(t => t.dataset.src).filter(Boolean)
        : [];
      const researchEl = ae.querySelector('.act-research');
      // contenteditable이면 innerHTML(정화) 사용, 구버전 textarea 호환을 위해 value도 fallback
      let researchVal = '';
      if (researchEl) {
        if (researchEl.isContentEditable || researchEl.getAttribute('contenteditable') === 'true') {
          const plain = (researchEl.textContent || '').trim();
          researchVal = plain ? sanitizeResearchHtml(researchEl.innerHTML).trim() : '';
        } else {
          researchVal = (researchEl.value || '').trim();
        }
      }
      // 활동별 참고 링크 (유튜브 등) — 빈 URL 행은 제외
      const actLinks = Array.from(ae.querySelectorAll('.act-link-row')).map(row => ({
        label: row.querySelector('.link-label').value.trim(),
        url: row.querySelector('.link-url').value.trim()
      })).filter(l => l.url);
      activities.push({
        name,
        research: researchVal,
        materials: ae.querySelector('.act-materials').value.trim(),
        time: ae.querySelector('.act-time').value.trim(),
        workbook: ae.querySelector('.act-workbook') ? ae.querySelector('.act-workbook').value.trim() : '',
        images,
        links: actLinks
      });
    }
  });
  
  const lessonId = document.getElementById('ed-id').value || 'custom_' + Date.now();
  const lessonType = document.getElementById('ed-lesson-type').value || '사고력';
  const isGyogwa = lessonType === '교과';
  // 기존 교안이면 center/author_email 원본 유지
  const existingLesson = _state.customLessons.find(c => c.id === lessonId);
  const lesson = {
    id: lessonId,
    lesson_type: lessonType,
    title,
    author: document.getElementById('ed-author').value.trim(),
    author_email: existingLesson ? (existingLesson.author_email || getCurrentEmail()) : getCurrentEmail(),
    level: isGyogwa ? (document.getElementById('ed-gyogwa-grade').value || '') : document.getElementById('ed-level').value,
    gyogwa_grade: isGyogwa ? document.getElementById('ed-gyogwa-grade').value : '',
    gyogwa_unit: isGyogwa ? document.getElementById('ed-gyogwa-unit').value : '',
    objectives: document.getElementById('ed-objectives').value.trim(),
    teacher_objectives: document.getElementById('ed-teacher-obj').value.trim(),
    curriculum: isGyogwa ? '' : document.getElementById('ed-curriculum').value.trim(),
    cms_link: isGyogwa ? '' : document.getElementById('ed-cms').value.trim(),
    notes: document.getElementById('ed-notes').value.trim(),
    textbook_images: Array.from(document.querySelectorAll('#ed-textbook-imgs .img-thumb')).map(t => t.dataset.src).filter(Boolean),
    attachments: Array.from(document.querySelectorAll('#ed-attachments .attach-item[data-url]')).map(el => ({
      name: el.dataset.name, url: el.dataset.url, size: parseInt(el.dataset.size || '0')
    })),
    links: Array.from(document.querySelectorAll('#ed-links .link-row')).map(row => ({
      label: row.querySelector('.link-label').value.trim(),
      url: row.querySelector('.link-url').value.trim()
    })).filter(l => l.url),
    activities,
    materials: [],
    custom: true,
    center: existingLesson ? (existingLesson.center || getCurrentCenter()) : getCurrentCenter(),
    updatedAt: new Date().toISOString()
  };
  
  // [수정] 저장 순서 변경 — DB 먼저 저장, 성공해야 로컬 state 갱신.
  //   이전 흐름은 로컬을 먼저 바꾸고 DB가 실패해도 화면엔 변경이 보였다가, 새로고침하면
  //   DB의 옛 데이터가 다시 로드되어 "변경이 날아간 것처럼" 보이는 문제가 있었음.
  console.log(`[saveLesson] id=${lesson.id} 활동 ${activities.length}개 저장 시도`);
  // 활동명 비어 있어 저장 대상에서 빠진 활동이 있으면 사용자에게 안내
  if (skippedEmpty > 0) {
    console.warn(`[saveLesson] 활동명 빈 활동 ${skippedEmpty}개는 저장에서 제외됨`);
    showToast(`⚠️ 활동명 비어있는 활동 ${skippedEmpty}개는 저장되지 않습니다`);
  }
  window._justSaved = Date.now();
  try {
    const { error } = await _sb.from('custom_lessons')
      .upsert({id: lesson.id, data: lesson, updated_at: new Date().toISOString()});
    if (error) throw error;
  } catch(e) {
    console.error('[saveLesson] DB upsert 실패:', e);
    showToast('⚠️ 저장 실패 — ' + (e.message || '인터넷/권한 확인 필요'));
    return;   // 로컬 state 갱신도 하지 않음 (DB와 화면 불일치 방지)
  }
  // DB 저장 성공한 후에만 로컬 state 갱신
  const existIdx = _state.customLessons.findIndex(c => c.id === lesson.id);
  if (existIdx >= 0) _state.customLessons[existIdx] = lesson;
  else _state.customLessons.push(lesson);
  console.log(`[saveLesson] ✓ 저장 완료 — _state.customLessons에 ${activities.length}개 활동 반영됨`);

  showToast('✅ 저장되었습니다');
  // [패치] 저장 후에도 현재 편집 화면을 그대로 유지한다.
  //  - resetEditor()를 호출하지 않아 입력한 내용이 화면에 남도록 함
  //  - 새로 작성한 교안이었다면 ed-id를 채워서 다음 저장은 "덮어쓰기"가 되도록 함
  //    (그렇지 않으면 같은 화면에서 또 저장 시 사본이 계속 새로 생성됨)
  const idInput = document.getElementById('ed-id');
  if (idInput && !idInput.value) idInput.value = lesson.id;
  // [패치] 내 자료 목록은 백그라운드에서만 갱신.
  //  - "전체 보기" 모드(showAllLessons)로 보고 있었다면 그 상태를 유지하기 위해
  //    실제로 #editor-mylist 탭이 보일 때만 다시 그린다.
  //  - 데이터(_state.customLessons)는 이미 최신이므로, 사용자가 다음에 목록 탭을
  //    열 때 새 내용이 자연스럽게 반영된다.
  const mylistEl = document.getElementById('editor-mylist');
  if (mylistEl && mylistEl.style.display !== 'none') {
    renderMyLessons();
  }
}

function resetEditor() {
  document.getElementById('ed-id').value = '';
  document.getElementById('ed-title').value = '';
  document.getElementById('ed-author').value = '';
  document.getElementById('ed-objectives').value = '';
  document.getElementById('ed-teacher-obj').value = '';
  document.getElementById('ed-curriculum').value = '';
  document.getElementById('ed-cms').value = '';
  document.getElementById('ed-notes').value = '';
  setLessonType('사고력');
  document.getElementById('ed-gyogwa-grade').value = '';
  document.getElementById('ed-gyogwa-unit').innerHTML = '<option value="">단원 선택</option>';
  document.getElementById('ed-textbook-imgs').innerHTML = '';
  updateTextbookHint();
  document.getElementById('ed-attachments').innerHTML = '';
  document.getElementById('ed-links').innerHTML = '';
  document.getElementById('ed-activities').innerHTML = '';
  activityCount = 0;
  addActivityEditor();
  resetAllAccordions();
}

function loadLessonToEditor(id, isCustom) {
  // 내장 자료는 전체 목록에서 id로 찾음
  const all = getAllLessons();
  const l = all.find(x => x.id === id);
  if (!l) { showToast('⚠️ 자료를 찾을 수 없습니다'); return; }

  showPage('editor');
  showEditorTab('write');

  // 내장 자료: id 비워서 새 custom 자료로 생성
  // custom 자료: 내 교안이면 id 유지(덮어쓰기), 남의 교안이면 id 비워서 복사
  const isMineLoad = isCustom ? canEdit(l) : false;
  document.getElementById('ed-id').value = isMineLoad ? l.id : '';
  document.getElementById('ed-title').value = l.title || '';
  document.getElementById('ed-author').value = l.author || '';
  // 교안 유형 설정
  setLessonType(l.lesson_type || '사고력');
  document.getElementById('ed-level').value = l.level || '';
  if (l.lesson_type === '교과') {
    document.getElementById('ed-gyogwa-grade').value = l.gyogwa_grade || '';
    updateGyogwaUnits(l.gyogwa_unit || '');
  }
  document.getElementById('ed-objectives').value = l.objectives || '';
  document.getElementById('ed-teacher-obj').value = l.teacher_objectives || '';
  document.getElementById('ed-curriculum').value = l.curriculum || '';
  document.getElementById('ed-cms').value = l.cms_link || '';
  document.getElementById('ed-notes').value = l.notes || '';
  document.getElementById('ed-links').innerHTML = '';
  (l.links || []).forEach(lk => addLinkRow(lk.label, lk.url));
  document.getElementById('ed-textbook-imgs').innerHTML = '';
  (l.textbook_images || []).forEach(url => addTextbookImgPreview(url));
  document.getElementById('ed-attachments').innerHTML = '';
  (l.attachments || []).forEach(att => addAttachmentRow(att.name, att.url, att.size));
  document.getElementById('ed-activities').innerHTML = '';
  activityCount = 0;
  (l.activities || []).forEach(a => addActivityEditor(a.name, a.research, a.materials, a.time, a.workbook||'', a.images||[], a.links||[]));
  if (!l.activities || l.activities.length === 0) addActivityEditor();

  // 아코디언: 내용 있는 섹션 자동 열기
  openAccordionIfContent('acc-textbook', (l.textbook_images || []).length);
  openAccordionIfContent('acc-attach', (l.attachments || []).length);
  openAccordionIfContent('acc-links', (l.links || []).length);

  if (!isCustom) {
    showToast('📋 내장 자료를 불러왔어요. 수정 후 저장하면 내 자료로 등록됩니다.');
  } else if (!isMineLoad) {
    showToast(`📋 ${l.author || '다른 선생님'}의 교안을 복사합니다. 저장하면 내 교안으로 새로 등록됩니다.`);
  }
  window.scrollTo(0, 0);
}
function isMyLesson(l) {
  const myEmail = getCurrentEmail();
  if (!myEmail) return false;
  // author_email이 있으면 직접 비교
  if (l.author_email) return l.author_email === myEmail;
  // author_email 없는 구버전 교안 → 이름으로 판단 (teachers 테이블 기반)
  const mapped = getEmailFromAuthorName(l.author || '');
  return mapped ? mapped === myEmail : false;
}

function editCustomLesson(id) {
  const customs = getCustomLessons();
  const l = customs.find(c => c.id === id);
  if (!l) return;

  const isMine = canEdit(l);
  showEditorTab('write');
  // 내 교안이 아니고 관리자도 아니면 ID 비워서 새 교안으로 저장되게 함
  document.getElementById('ed-id').value = isMine ? l.id : '';
  document.getElementById('ed-title').value = l.title;
  document.getElementById('ed-author').value = l.author;
  setLessonType(l.lesson_type || '사고력');
  document.getElementById('ed-level').value = l.level;
  if (l.lesson_type === '교과') {
    document.getElementById('ed-gyogwa-grade').value = l.gyogwa_grade || '';
    updateGyogwaUnits(l.gyogwa_unit || '');
  }
  document.getElementById('ed-objectives').value = l.objectives;
  document.getElementById('ed-teacher-obj').value = l.teacher_objectives || '';
  document.getElementById('ed-curriculum').value = l.curriculum;
  document.getElementById('ed-cms').value = l.cms_link || '';
  document.getElementById('ed-notes').value = l.notes || '';
  document.getElementById('ed-links').innerHTML = '';
  (l.links || []).forEach(lk => addLinkRow(lk.label, lk.url));
  document.getElementById('ed-textbook-imgs').innerHTML = '';
  (l.textbook_images || []).forEach(url => addTextbookImgPreview(url));
  document.getElementById('ed-attachments').innerHTML = '';
  (l.attachments || []).forEach(att => addAttachmentRow(att.name, att.url, att.size));
  document.getElementById('ed-activities').innerHTML = '';
  activityCount = 0;
  (l.activities || []).forEach(a => addActivityEditor(a.name, a.research, a.materials, a.time, a.workbook||'', a.images||[], a.links||[]));
  if (!l.activities || l.activities.length === 0) addActivityEditor();

  // 아코디언: 내용 있는 섹션 자동 열기
  openAccordionIfContent('acc-textbook', (l.textbook_images || []).length);
  openAccordionIfContent('acc-attach', (l.attachments || []).length);
  openAccordionIfContent('acc-links', (l.links || []).length);

  if (!isMine) {
    showToast(`📋 ${l.author || '다른 선생님'}의 교안을 복사합니다. 저장하면 내 교안으로 새로 등록됩니다.`);
  }
  window.scrollTo(0, 0);
}

function deleteAnyLesson(id, isCustom) {
  if (isCustom) {
    if (!confirm('이 자료를 삭제하시겠습니까?')) return;
    deleteCustomLesson(id);
  } else {
    const msg = isAdmin()
      ? '이 내장 자료를 삭제하시겠습니까?\n(모든 선생님 화면에서 사라집니다)'
      : '이 자료를 삭제하시겠습니까?\n(이 기기에서만 숨겨집니다)';
    if (!confirm(msg)) return;
    const ids = getDeletedBuiltinIds();
    if (!ids.includes(id)) ids.push(id);
    setDeletedBuiltinIds(ids);
    if (isAdmin()) saveCmsConfig();
    showToast(isAdmin() ? '🗑️ 삭제되었습니다 (전체 반영)' : '🗑️ 숨김 처리되었습니다');
    // [패치] renderLibrary()는 작성자 필터/레벨 칩을 다시 그리면서
    //   기본값(내 이름)으로 초기화시켜 버린다. 라이브러리 카드 목록만 갱신하면
    //   필요한 효과(삭제된 카드 사라짐)는 모두 얻을 수 있어서 filterLessons로 충분.
    if (typeof filterLessons === 'function') filterLessons();
    if (typeof renderDashboard === 'function') renderDashboard();
  }
}
async function _deleteStorageFilesForLesson(l) {
  if (!l) return;
  const urls = [];
  (l.activities || []).forEach(a => (a.images || []).forEach(u => urls.push(u)));
  (l.textbook_images || []).forEach(u => urls.push(u));
  (l.attachments || []).forEach(a => a.url && urls.push(a.url));
  const fileNames = urls
    .filter(u => u && u.includes(_SB_URL))
    .map(u => u.split('/').pop().split('?')[0])
    .filter(n => n);
  if (fileNames.length === 0) return;
  try { await _sb.storage.from('lesson-images').remove(fileNames); }
  catch(e) { console.warn('Storage cleanup 실패:', e); }
}

async function deleteCustomLesson(id) {
  const l = _state.customLessons.find(c => c.id === id);
  // 관리자만 삭제 가능
  if (!isAdmin()) { showToast('⛔ 삭제는 관리자만 가능합니다'); return; }
  const msg = (l && !isMyLesson(l))
    ? `[관리자] "${l.author || '다른 선생님'}"이 작성한 "${l.title}" 교안을 삭제하시겠습니까?`
    : `"${l ? l.title : ''}" 교안을 삭제하시겠습니까?`;
  if (!confirm(msg)) return;
  await _deleteStorageFilesForLesson(l);
  _state.customLessons = _state.customLessons.filter(c => c.id !== id);
  window._justSaved = Date.now();
  await _sb.from('custom_lessons').delete().eq('id', id);
  showToast('🗑️ 삭제되었습니다');
  // [패치] 무조건 renderMyLessons()만 호출하면 라이브러리/인덱스에서 삭제했을 때
  //   해당 페이지가 갱신되지 않거나, 내 자료 탭이 강제 필터로 돌아가는 문제가 있음.
  //   현재 활성화된 페이지에 맞춰 그 페이지만 재렌더한다 (필터/스크롤 보존).
  const activePage = document.querySelector('.page.active');
  const pageId = activePage ? activePage.id : '';
  if (pageId === 'page-library') {
    if (typeof filterLessons === 'function') filterLessons();
  } else if (pageId === 'page-editor') {
    // 내 자료 탭이 화면에 보일 때만 갱신 (전체 보기 등 다른 상태 보존)
    const mylistEl = document.getElementById('editor-mylist');
    if (mylistEl && mylistEl.style.display !== 'none') renderMyLessons();
  } else if (pageId === 'page-curriculum') {
    if (typeof renderCurriculumIndex === 'function') renderCurriculumIndex();
  } else if (pageId === 'page-dashboard') {
    if (typeof renderDashboard === 'function') renderDashboard();
  } else {
    // 알 수 없는 페이지면 안전하게 my-lessons-list만 갱신
    if (document.getElementById('my-lessons-list')) renderMyLessons();
  }
}

function renderMyLessons() {
  const myName = normalizeName(sessionStorage.getItem('cms_name') || '');
  const allCustoms = getCustomLessons();
  // 내 이름으로 필터링 (이름 설정 안 했으면 전체 표시)
  const customs = myName
    ? allCustoms.filter(l => normalizeName(l.author) === myName)
    : allCustoms;
  const container = document.getElementById('my-lessons-list');
  if (customs.length === 0) {
    const msg = myName
      ? `<div class="empty-state"><div class="icon">📝</div><p><strong>${sessionStorage.getItem('cms_name')}</strong> 선생님이 작성한 자료가 없습니다<br>새로 작성 탭에서 자료를 추가해보세요</p></div>`
      : '<div class="empty-state"><div class="icon">📝</div><p>아직 작성한 자료가 없습니다<br>새로 작성 탭에서 자료를 추가해보세요</p></div>';
    container.innerHTML = msg;
    return;
  }
  let html = `<div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;padding:8px 12px;background:var(--gray-50);border-radius:8px">
    👤 <strong>${sessionStorage.getItem('cms_name') || '전체'}</strong> 선생님 자료 ${customs.length}개
    ${myName ? `<span style="margin-left:8px;color:var(--primary);cursor:pointer;text-decoration:underline" onclick="showAllLessons()">전체 보기</span>` : ''}
  </div>`;
  customs.forEach(l => {
    const date = l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('ko-KR') : '';
    const mine = isMyLesson(l);
    html += `<div class="my-lesson-item">
      <div class="my-lesson-info">
        <h4>${l.title} ${mine ? '' : '<span style="font-size:11px;color:var(--gray-400);font-weight:400">(타 센터)</span>'}</h4>
        <p>${l.level} · ${l.author} ${date ? '· ' + date : ''}</p>
      </div>
      <div class="my-lesson-actions">
        <button class="btn btn-secondary btn-sm" onclick="editCustomLesson('${l.id}')">${mine ? '편집' : '복사'}</button>
        ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomLesson('${l.id}')" title="${mine ? '삭제' : '관리자 권한으로 삭제'}">삭제${!mine ? ' (관리자)' : ''}</button>` : ''}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function showAllLessons() {
  const container = document.getElementById('my-lessons-list');
  const allCustoms = getCustomLessons();
  let html = `<div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;padding:8px 12px;background:var(--gray-50);border-radius:8px">
    📚 전체 자료 ${allCustoms.length}개
    <span style="margin-left:8px;color:var(--primary);cursor:pointer;text-decoration:underline" onclick="renderMyLessons()">내 자료만 보기</span>
  </div>`;
  allCustoms.forEach(l => {
    const date = l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('ko-KR') : '';
    const mine = isMyLesson(l);
    html += `<div class="my-lesson-item">
      <div class="my-lesson-info">
        <h4>${l.title} ${mine ? '<span style="font-size:11px;color:var(--primary);font-weight:600">내 교안</span>' : `<span style="font-size:11px;color:var(--gray-400)">${l.author || '?'}</span>`}</h4>
        <p>${l.level} · ${l.author} ${date ? '· ' + date : ''}</p>
      </div>
      <div class="my-lesson-actions">
        <button class="btn btn-secondary btn-sm" onclick="editCustomLesson('${l.id}')">${mine ? '편집' : '복사'}</button>
        ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomLesson('${l.id}')" title="${mine ? '삭제' : '관리자 권한으로 삭제'}">삭제${!mine ? ' (관리자)' : ''}</button>` : ''}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function showEditorTab(tab) {
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('editor-write').style.display = tab === 'write' ? 'block' : 'none';
  document.getElementById('editor-mylist').style.display = tab === 'mylist' ? 'block' : 'none';
  document.getElementById('editor-share').style.display = tab === 'share' ? 'block' : 'none';
  if (tab === 'share') {
    const cnt = getDeletedBuiltinIds().length;
    const el = document.getElementById('restore-info');
    if (el) el.textContent = cnt > 0 ? `현재 숨긴 내장 자료: ${cnt}개` : '현재 숨긴 내장 자료가 없습니다.';
    if (isAdmin()) _updateMigrateStatus();
  }
  event.target.classList.add('active');
  if (tab === 'mylist') renderMyLessons();
}

// ── ② 내장 교안 → DB 마이그레이션 (관리자 전용) ──
async function migrateBuiltinLessons() {
  if (!isAdmin()) { showToast('⛔ 관리자만 사용할 수 있습니다'); return; }

  const allBuiltins = DATA.lessons.map((l, i) => ({
    ...l, id: l.id || ('builtin_' + i)
  }));
  const alreadyHidden = new Set(_state.deletedBuiltinIds);
  const remaining = allBuiltins.filter(l => !alreadyHidden.has(l.id));

  if (remaining.length === 0) {
    showToast('✅ 이전할 내장 교안이 없습니다');
    return;
  }

  if (!confirm(`내장 교안 ${remaining.length}개를 DB로 이전합니다.\n이전 후 각 선생님이 직접 편집 가능해집니다.\n계속하시겠습니까?`)) return;

  const statusEl = document.getElementById('migrate-status');
  let done = 0, skipped = 0;
  const newHiddenIds = [..._state.deletedBuiltinIds];

  for (let i = 0; i < remaining.length; i++) {
    const l = remaining[i];
    if (statusEl) statusEl.textContent = `진행 중: ${i + 1} / ${remaining.length}`;

    const newId = 'migrated_' + l.id;
    const exists = _state.customLessons.some(
      c => c.id === newId ||
        (c.title === l.title && normalizeName(c.author) === normalizeName(l.author) && c.level === l.level)
    );
    if (exists) {
      skipped++;
      if (!newHiddenIds.includes(l.id)) newHiddenIds.push(l.id);
      continue;
    }

    const authorEmail = getEmailFromAuthorName(l.author || '');
    const center = authorEmail ? getCenterFromEmail(authorEmail) : getCurrentCenter();
    const migrated = { ...l, id: newId, author_email: authorEmail, center,
      custom: true, lesson_type: l.lesson_type || '사고력',
      updatedAt: l.updatedAt || new Date().toISOString() };
    delete migrated.builtin;

    try {
      const { error } = await _sb.from('custom_lessons').upsert({
        id: migrated.id, data: migrated, updated_at: new Date().toISOString()
      });
      if (error) throw error;
      _state.customLessons.unshift(migrated);
      if (!newHiddenIds.includes(l.id)) newHiddenIds.push(l.id);
      done++;
    } catch(e) {
      console.error('[migrate] 실패:', l.title, e);
    }

    if (i % 10 === 9) await new Promise(r => setTimeout(r, 10));
  }

  _state.deletedBuiltinIds = [...new Set(newHiddenIds)];
  await saveCmsConfig();

  const msg = `완료: ${done}개 이전${skipped > 0 ? ', ' + skipped + '개 중복 건너뜀' : ''}`;
  if (statusEl) statusEl.textContent = msg;
  showToast('✅ ' + msg);
  _updateMigrateStatus();

  if (typeof filterLessons === 'function') filterLessons();
  renderMyLessons();
  if (typeof renderDashboard === 'function') renderDashboard();
}

function _updateMigrateStatus() {
  const el = document.getElementById('migrate-status');
  if (!el) return;
  const total = DATA.lessons.length;
  const hidden = _state.deletedBuiltinIds.length;
  const remaining = total - hidden;
  if (remaining <= 0) {
    el.textContent = `✅ 전체 ${total}개 이전 완료`;
    el.style.color = 'var(--green)';
  } else {
    el.textContent = `내장 교안 ${total}개 중 ${remaining}개 미이전`;
    el.style.color = '';
  }
}

// ── ③ 자료 공유: 내보내기 / 가져오기 ──
async function restoreBuiltinLessons() {
  const ids = getDeletedBuiltinIds();
  if (ids.length === 0) { showToast('숨긴 자료가 없습니다'); return; }
  if (!confirm(`숨긴 내장 자료 ${ids.length}개를 모두 복원하시겠습니까?`)) return;
  setDeletedBuiltinIds([]);
  if (isAdmin()) await saveCmsConfig();
  showToast('✅ 복원되었습니다' + (isAdmin() ? ' (전체 반영)' : ''));
  renderLibrary();
  renderDashboard();
}

function exportLessons() {
  const customs = getCustomLessons();
  if (customs.length === 0) { showToast('⚠️ 내보낼 자료가 없습니다'); return; }
  const blob = new Blob([JSON.stringify(customs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cms_세미나자료_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ 내보내기 완료!');
}

function importLessons(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('형식 오류');
      const existIds = new Set(_state.customLessons.map(l => l.id));
      const newItems = imported.filter(l => !existIds.has(l.id));
      _state.customLessons = [..._state.customLessons, ...newItems];
      await Promise.all(newItems.map(l =>
        _sb.from('custom_lessons').upsert({id: l.id, data: l, updated_at: new Date().toISOString()})
      ));
      const result = document.getElementById('import-result');
      result.innerHTML = `<span style="color:var(--green);font-weight:600">✅ ${newItems.length}건 가져오기 완료! (중복 ${imported.length - newItems.length}건 건너뜀)</span>`;
      showToast(`✅ ${newItems.length}건 가져왔습니다`);
    } catch(err) {
      document.getElementById('import-result').innerHTML = `<span style="color:var(--red)">❌ 파일 형식이 올바르지 않습니다</span>`;
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ── ③ 완료 현황 렌더링 ──
function renderCompletionStatus() {
  const months = getSchedule().months;
  let totalSlots = 0, completedSlots = 0;
  let itemsHtml = '';

  months.forEach(m => {
    m.weeks.forEach(w => {
      const st = getWeekStatus(m.name, w.week);
      const hasT1 = !!w.theme1, hasT2 = !!w.theme2;
      const doneT1 = hasT1 && st.t1, doneT2 = hasT2 && st.t2;
      if (hasT1) totalSlots++;
      if (hasT2) totalSlots++;
      if (doneT1) completedSlots++;
      if (doneT2) completedSlots++;

      const slotTotal = (hasT1?1:0) + (hasT2?1:0);
      const slotDone = (doneT1?1:0) + (doneT2?1:0);
      const cls = slotDone === slotTotal && slotTotal > 0 ? 'done' : slotDone > 0 ? 'partial' : '';
      const icon = slotDone === slotTotal && slotTotal > 0 ? '✅' : slotDone > 0 ? '△' : '○';

      if (slotTotal > 0) {
        itemsHtml += `<div class="completion-item ${cls}" onclick="showPage('schedule')" style="cursor:pointer" title="일정으로 이동">
          <span>${m.name} ${w.week}</span>
          <span>${icon} ${slotDone}/${slotTotal}</span>
        </div>`;
      }
    });
  });

  const pct = totalSlots > 0 ? Math.round(completedSlots/totalSlots*100) : 0;
  document.getElementById('completion-status').innerHTML = `
    <div class="completion-row">
      <span>전체 진행률</span>
      <span style="font-weight:700;color:var(--green)">${completedSlots} / ${totalSlots} (${pct}%)</span>
    </div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <div style="font-size:11px;color:var(--gray-500);margin-bottom:10px">각 항목을 클릭하면 일정 페이지로 이동합니다</div>
    <div class="completion-grid">${itemsHtml}</div>
  `;
}

// ── 센터 필터 토글 ──
async function toggleCenterFilter() {
  _centerFilter = !_centerFilter;
  // 상태에 따라 UI 업데이트
  const label = document.getElementById('center-filter-label');
  const btn = document.getElementById('center-toggle-btn');
  const myCenter = getCurrentCenter();
  if (_centerFilter) {
    if (label) label.textContent = myCenter || '내 센터';
    if (btn) { btn.textContent = '전체 센터 보기'; btn.style.background = 'white'; btn.style.color = '#FF6B9D'; }
  } else {
    if (label) label.textContent = '전체 센터';
    if (btn) { btn.textContent = '내 센터만 보기'; btn.style.background = '#FF6B9D'; btn.style.color = 'white'; }
  }
  // DB에서 다시 로드 (첫 페이지만 빠르게 + 백그라운드)
  _lessonOffset = 0;
  _lessonHasMore = false;
  _state.customLessons = [];
  let q = _sb.from('custom_lessons').select('id,data', { count: 'exact' })
    .order('updated_at', { ascending: false });
  if (_centerFilter && myCenter) {
    q = q.or(`data->>center.eq.${myCenter},data->>center.is.null`);
  }
  const { data, count } = await q.range(0, LESSON_PAGE_SIZE - 1);
  if (data) {
    _state.customLessons = data.map(r => ({...r.data, id: r.id}));
    _lessonOffset = data.length;
    _lessonTotalCount = count || _lessonOffset;
    _lessonHasMore = _lessonOffset < _lessonTotalCount;
  }
  if (typeof filterLessons === 'function') filterLessons();
  renderMyLessons();
  // 나머지는 백그라운드에서 조용히 마저 로드
  setTimeout(() => { backgroundLoadAllLessons().catch(e => console.warn('bg load:', e)); }, 200);
}

// Init
function init() {
  // 내 이름 표시 (관리자는 뱃지 추가)
  const myName = sessionStorage.getItem('cms_name');
  if (myName) {
    const tag = document.getElementById('my-name-tag');
    if (tag) {
      if (isAdmin()) {
        tag.innerHTML = '👤 ' + myName + ' <span style="background:#DC2626;color:#fff;font-weight:700;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:4px">관리자</span>';
        const migrateCard = document.getElementById('migrate-card');
        if (migrateCard) migrateCard.style.display = '';
      } else {
        tag.textContent = '👤 ' + myName;
      }
    }
  }
  // 센터명 표시
  const myCenter = getCurrentCenter();
  const centerTag = document.getElementById('center-name-tag');
  if (centerTag) centerTag.textContent = myCenter || 'CMS 사고력관';
  const centerLabel = document.getElementById('center-filter-label');
  if (centerLabel) centerLabel.textContent = '전체 센터';
  // 센터가 없으면 필터바 숨기기
  const filterBar = document.getElementById('center-filter-bar');
  if (filterBar && !myCenter) filterBar.style.display = 'none';
  // 버전바 센터명
  const vcn = document.getElementById('version-center-name');
  if (vcn) vcn.textContent = myCenter || 'CMS';
  // Populate level select in editor
  // 레벨 드롭다운: 전체 레벨 순서대로 표시
  const allLessons = getAllLessons();
  const existLevels = new Set(allLessons.map(l => l.level));
  let opts = '';
  ALL_LEVELS.forEach(lv => {
    opts += `<option value="${lv}">${lv}</option>`;
  });
  // 혹시 데이터에 있지만 ALL_LEVELS에 없는 레벨이 있으면 추가
  existLevels.forEach(lv => {
    if (!ALL_LEVELS.includes(lv)) opts += `<option value="${lv}">${lv}</option>`;
  });
  document.getElementById('ed-level').innerHTML = opts;

  addActivityEditor();
  renderDashboard();
}
// init()은 로그인 완료 후 자동 호출됨

// ── A4 출력 기능 ──
function printLesson(idx) {
  const l = getAllLessons()[idx];
  if (!l) return;

  const realActivities = l.activities.filter(a =>
    !['수업 목표','교과 연계','CMS과정 연계'].includes(a.name)
  );

  const infoRows = [
    l.objectives      ? ['📎 교재 수업 목표', l.objectives] : null,
    l.teacher_objectives ? ['🎯 교사 추가 목표', l.teacher_objectives] : null,
    l.curriculum      ? ['📘 교과 연계', l.curriculum] : null,
    l.cms_link        ? ['🔗 CMS과정 연계', l.cms_link] : null,
    l.notes           ? ['📝 비고 / 건의', l.notes] : null,
  ].filter(Boolean);

  const linksHtml = (l.links && l.links.length > 0)
    ? `<tr><td class="info-label">🔗 참고 링크</td><td class="info-value">${l.links.map(lk => `<a href="${lk.url}" target="_blank" style="color:#4F46E5;text-decoration:underline;word-break:break-all">${lk.label || lk.url}</a>`).join('<br>')}</td></tr>`
    : '';

  const infoHtml = infoRows.map(([label, val]) => `
    <tr>
      <td class="info-label">${label}</td>
      <td class="info-value">${val}</td>
    </tr>`).join('') + linksHtml;

  const activitiesHtml = realActivities.map((a, i) => `
    <div class="act-block">
      <div class="act-title-row">
        <span class="act-num">${i + 1}</span>
        <span class="act-name">${a.name}</span>
        ${a.time ? `<span class="act-time">${a.time}</span>` : ''}
      </div>
      <div class="act-body">
        ${a.workbook ? `<div class="act-workbook">📖 워크북 연계: ${a.workbook}</div>` : ''}
        ${a.research ? `<div class="act-research">${researchToDisplayHtml(a.research)}</div>` : ''}
        ${a.materials ? `<div class="act-materials">🧩 준비물: ${a.materials}</div>` : ''}
        ${(a.links && a.links.length > 0) ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #E5E7EB"><div style="font-size:9pt;font-weight:700;color:#4F46E5;margin-bottom:3px">🔗 참고 링크</div>${a.links.map(lk => `<div style="font-size:9pt"><a href="${lk.url}" target="_blank" style="color:#4F46E5;text-decoration:underline;word-break:break-all">${(lk.label||lk.url)}</a></div>`).join('')}</div>` : ''}
        ${a.images && a.images.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${a.images.map(src => `<img src="${src}" style="max-width:200px;max-height:150px;border-radius:4px;border:1px solid #E5E7EB;object-fit:contain">`).join('')}</div>` : ''}
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${l.title}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Cdefs%3E%3ClinearGradient id='fg' x1='0.75' y1='0' x2='0.15' y2='1'%3E%3Cstop offset='0%25' stop-color='%23E879A0'/%3E%3Cstop offset='55%25' stop-color='%23A855F7'/%3E%3Cstop offset='100%25' stop-color='%235B5CF6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M30,2 C28,18 18,28 2,30 C18,32 28,42 30,58 C32,42 42,32 58,30 C42,28 32,18 30,2 Z' fill='url(%23fg)'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
<style>
  @page { size: A4; margin: 14mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 10.5pt;
    color: #111827;
    line-height: 1.6;
    background: #fff;
  }

  /* 헤더 */
  .doc-header {
    border-bottom: 3px solid #4F46E5;
    padding-bottom: 10px;
    margin-bottom: 12px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .doc-center { text-align: center; font-size: 8.5pt; color: #6B7280; margin-bottom: 4px; }
  .doc-title { font-size: 15pt; font-weight: 700; color: #111827; }
  .doc-meta { display: flex; gap: 10px; margin-top: 5px; }
  .doc-badge {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 10px;
    font-size: 8.5pt;
    font-weight: 600;
  }
  .badge-level { background: #EEF2FF; color: #4F46E5; }
  .badge-author { background: #ECFDF5; color: #059669; }

  /* 기본 정보 테이블 */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 9.5pt;
  }
  .info-table td { padding: 6px 9px; border: 1px solid #E5E7EB; vertical-align: top; }
  .info-label {
    width: 100px;
    font-weight: 700;
    background: #F9FAFB;
    color: #4F46E5;
    white-space: nowrap;
  }
  .info-value { color: #374151; }

  /* 활동 연구 섹션 */
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #4F46E5;
    border-bottom: 2px solid #EEF2FF;
    padding-bottom: 5px;
    margin-bottom: 8px;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* 활동 블록: 제목행은 페이지 끝에 고아로 남지 않도록,
     내용(act-body)은 자유롭게 페이지에 걸쳐 흐르도록 */
  .act-block {
    margin-bottom: 8px;
    border: 1px solid #E5E7EB;
    border-left: 4px solid #4F46E5;
    border-radius: 4px;
    background: #FAFAFA;
    orphans: 3;
    widows: 3;
  }
  .act-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 6px;
    page-break-after: avoid;
    break-after: avoid;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .act-body {
    padding: 0 12px 8px;
    page-break-before: avoid;
    break-before: avoid;
  }
  .act-num {
    display: inline-flex;
    width: 19px; height: 19px;
    background: #4F46E5; color: #fff;
    border-radius: 50%;
    align-items: center; justify-content: center;
    font-size: 8.5pt; font-weight: 700;
    flex-shrink: 0;
  }
  .act-name { font-weight: 700; font-size: 10.5pt; flex: 1; }
  .act-time {
    font-size: 8.5pt; color: #6B7280;
    background: #E5E7EB;
    padding: 1px 7px; border-radius: 8px;
    white-space: nowrap;
  }
  .act-workbook { font-size: 9pt; color: #2563EB; font-weight: 700; margin-bottom: 4px; }
  .act-research { font-size: 9.5pt; color: #374151; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
  .act-materials {
    margin-top: 5px;
    font-size: 9pt;
    color: #D97706;
    font-weight: 600;
  }

  /* 출력 시 링크 색상 숨기기 */
  a { color: inherit; text-decoration: none; }

  /* 푸터 */
  .doc-footer {
    margin-top: 16px;
    padding-top: 8px;
    border-top: 1px solid #E5E7EB;
    font-size: 8pt;
    color: #9CA3AF;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-center">${l.lesson_type === '교과' ? 'CMS 교과 수업 연구 자료' : 'CMS 사고력수학 WP 사고력관 · 사고력 세미나 수업 연구 자료'}</div>
    <div class="doc-title">${l.title}</div>
    <div class="doc-meta">
      ${l.lesson_type === '교과'
        ? `${l.gyogwa_grade ? `<span class="doc-badge badge-level">${l.gyogwa_grade}</span>` : ''}${l.gyogwa_unit ? `<span class="doc-badge badge-level" style="background:#E0F2FE;color:#0369A1">${l.gyogwa_unit}</span>` : ''}`
        : `<span class="doc-badge badge-level">${l.level}</span>`}
      ${l.author ? `<span class="doc-badge badge-author">${l.author}</span>` : ''}
    </div>
  </div>

  ${infoHtml ? `<table class="info-table">${infoHtml}</table>` : ''}

  ${(l.textbook_images && l.textbook_images.length > 0) ? `
    <div class="section-title">📖 교재 이미지 (${l.textbook_images.length}장)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;page-break-inside:avoid">
      ${l.textbook_images.map(src => `<img src="${src}" style="max-width:240px;max-height:180px;border-radius:4px;border:1px solid #E5E7EB;object-fit:contain">`).join('')}
    </div>
  ` : ''}

  ${realActivities.length > 0 ? `
    <div class="section-title">활동 연구 (${realActivities.length}개)</div>
    ${activitiesHtml}
  ` : ''}

  <div class="doc-footer">
    <span>CMS 사고력 세미나 준비 시스템</span>
    <span>출력일: ${new Date().toLocaleDateString('ko-KR')}</span>
  </div>

  <script>
    function _renderPrintMath(){
      if (typeof katex === 'undefined') return false;
      document.querySelectorAll('span.math[data-latex]').forEach(function(el){
        if (el.dataset.rendered === '1') return;
        try { katex.render(el.getAttribute('data-latex')||'', el, {throwOnError:false, displayMode:false, output:'html'}); el.dataset.rendered='1'; }
        catch(e){ el.textContent = el.getAttribute('data-latex')||''; }
      });
      return true;
    }
    window.onload = function(){
      // KaTeX 로드 대기 후 렌더링 → 폰트 로드 약간 더 기다리고 인쇄
      var tries = 0;
      var iv = setInterval(function(){
        tries++;
        if (_renderPrintMath()) {
          clearInterval(iv);
          // 폰트 로딩 시간 확보
          var go = function(){ try { window.print(); } catch(_){} };
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function(){ setTimeout(go, 150); });
          } else {
            setTimeout(go, 400);
          }
        } else if (tries > 50) {
          clearInterval(iv);
          window.print();
        }
      }, 100);
    };
  <\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=794,height=1123');
  w.document.write(html);
  w.document.close();
}