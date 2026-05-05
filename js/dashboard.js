// ── 학기 캘린더 ──
const SEMESTER_DEFS = {
  winter: { label: '겨울', range: '12-2월', monthNumbers: [12, 1, 2] },
  spring: { label: '봄',   range: '3-5월',  monthNumbers: [3, 4, 5] },
  summer: { label: '여름', range: '6-8월',  monthNumbers: [6, 7, 8] },
  fall:   { label: '가을', range: '9-11월', monthNumbers: [9, 10, 11] }
};
function getCurrentSemester() {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'fall';
}
let _currentSemester = getCurrentSemester();

// 월 이름 매칭 (예: '3월', '3월 (가산)' 모두 3월로 인식)
function _monthMatchesNumber(name, n) {
  if (!name) return false;
  const m = String(name).match(/(\d+)\s*월/);
  return m && parseInt(m[1]) === n;
}
function getSemesterMonths(sem) {
  const def = SEMESTER_DEFS[sem];
  if (!def) return [];
  const allMonths = (getSchedule().months) || [];
  return def.monthNumbers
    .map(n => allMonths.find(m => _monthMatchesNumber(m.name, n)))
    .filter(Boolean);
}

function selectSemester(sem) {
  _currentSemester = sem;
  renderSemesterCalendar();
  renderStatCards();
}

function renderSemesterCalendar() {
  const container = document.getElementById('semester-calendar');
  if (!container) return;
  const myName = sessionStorage.getItem('cms_name') || '';
  const myNorm = normalizeName(myName);
  const months = getSemesterMonths(_currentSemester);

  const tabsHtml = Object.entries(SEMESTER_DEFS).map(([key, def]) => {
    const active = _currentSemester === key ? 'active' : '';
    return `<button type="button" class="sem-tab ${active}" onclick="selectSemester('${key}')">${def.label}<span class="sem-tab-range"> ${def.range}</span></button>`;
  }).join('');

  let totalWeeks = months.reduce((s, m) => s + ((m.weeks && m.weeks.length) || 0), 0);
  let weekCounter = 0;
  const monthsHtml = months.length === 0
    ? `<div class="sem-empty">
        <div style="font-size:32px;margin-bottom:8px">📭</div>
        <div style="margin-bottom:12px;color:var(--gray-700)">${SEMESTER_DEFS[_currentSemester].label} 학기에는 일정이 등록되지 않았습니다</div>
        <button class="btn btn-primary" onclick="showPage('schedule')">일정 페이지에서 추가하기</button>
      </div>`
    : months.map(m => {
        const weeks = m.weeks || [];
        return `<div class="sem-month-block">
          <div class="sem-month-header">📅 ${escHtml(m.name)}<span class="sem-month-count">${weeks.length}주차</span></div>
          <div class="sem-week-grid">
            ${weeks.map((w, wi) => {
              weekCounter++;
              const slots = getWeekSlots(w);
              const slotStatuses = slots.map((_, si) => getSlotDone(m.name, w.week, si));
              const allDone = slots.length > 0 && slotStatuses.every(Boolean);
              const someDone = slotStatuses.some(Boolean);
              const isMine = myNorm && slots.some(sl => normalizeName(sl.teacher) === myNorm);
              const cls = (allDone ? 'done' : someDone ? 'partial' : '') + (isMine ? ' is-mine' : '');
              const monthEsc = String(m.name).replace(/'/g, "\\'");
              // [수정] 주차 박스 자체의 편집 클릭은 제거 — 일정 편집은 "전체 일정 편집"에서 하고,
              //   대시보드 캘린더의 슬롯은 "그 교안으로 점프" 용도로만 사용한다.
              return `<div class="sem-week ${cls}">
                <div class="sem-week-head">
                  <span class="sem-week-num">${weekCounter}주차</span>
                  <span class="sem-week-status">${allDone ? '✅' : someDone ? '◐' : '○'}</span>
                </div>
                <div class="sem-week-label">${escHtml(w.week || '날짜 미정')}</div>
                <div class="sem-week-slots">
                  ${slots.length === 0 ? '<div class="sem-slot empty">미배정</div>' :
                    slots.map((sl, si) => {
                      const done = slotStatuses[si];
                      const mine = myNorm && normalizeName(sl.teacher) === myNorm;
                      // 테마가 있으면 클릭으로 자료실 점프, 없으면 비활성
                      const themeRaw = sl.theme || '';
                      const clickable = !!themeRaw;
                      const onClick = clickable
                        ? ` onclick="jumpToLessonFromSlot(${JSON.stringify(themeRaw).replace(/"/g, '&quot;')})" style="cursor:pointer"`
                        : '';
                      return `<div class="sem-slot ${done ? 'slot-done' : ''} ${mine ? 'slot-mine' : ''}"${onClick} title="${clickable ? '클릭하면 자료실에서 이 교안 찾기' : ''}">
                        <span class="sem-slot-teacher">${escHtml(sl.teacher || '?')}</span><span class="sem-slot-theme">${escHtml(sl.theme || '주제 미정')}</span>
                      </div>`;
                    }).join('')}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');

  container.innerHTML = `
    <div class="sem-tabs">${tabsHtml}</div>
    <div class="sem-summary">
      <span><strong>${SEMESTER_DEFS[_currentSemester].label}학기</strong> · 총 ${totalWeeks}주차 (목표 12주차)</span>
      <button class="btn btn-secondary btn-sm" onclick="showPage('schedule')">📋 전체 일정 편집</button>
    </div>
    ${monthsHtml}
  `;
}

// ── 주차 편집 모달 ──
let _weekEditorCtx = null;
function openWeekEditor(monthName, weekIdx) {
  const sched = getSchedule();
  const month = (sched.months || []).find(m => m.name === monthName);
  if (!month) { showToast('월을 찾을 수 없습니다'); return; }
  const week = (month.weeks || [])[weekIdx];
  if (!week) { showToast('주차를 찾을 수 없습니다'); return; }
  _weekEditorCtx = { monthName, weekIdx, originalWeekLabel: week.week };

  document.getElementById('week-editor-title').textContent = `${monthName} ${week.week || '주차 편집'}`;
  document.getElementById('we-week-label').value = week.week || '';

  const slots = getWeekSlots(week);
  const slotsContainer = document.getElementById('week-editor-slots');
  slotsContainer.innerHTML = '';
  slots.forEach((sl, si) => weekEditorAppendSlot(sl.teacher || '', sl.theme || '', getSlotDone(monthName, week.week, si)));
  if (slots.length === 0) { weekEditorAppendSlot('', '', false); weekEditorAppendSlot('', '', false); }

  document.getElementById('week-editor-overlay').classList.add('open');
}

function weekEditorAppendSlot(teacher, theme, done) {
  const container = document.getElementById('week-editor-slots');
  const div = document.createElement('div');
  div.className = 'we-slot-row';
  div.innerHTML = `
    <input type="text" class="form-input we-teacher" value="${escHtml(teacher)}" placeholder="선생님">
    <input type="text" class="form-input we-theme" value="${escHtml(theme)}" placeholder="테마">
    <label class="we-done"><input type="checkbox" class="we-status" ${done ? 'checked' : ''}> 완료</label>
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" title="삭제">×</button>`;
  container.appendChild(div);
}

function weekEditorAddSlot() { weekEditorAppendSlot('', '', false); }

function closeWeekEditor() {
  document.getElementById('week-editor-overlay').classList.remove('open');
  _weekEditorCtx = null;
}

async function saveWeekEditor() {
  if (!_weekEditorCtx) return;
  const { monthName, weekIdx, originalWeekLabel } = _weekEditorCtx;
  const sched = JSON.parse(JSON.stringify(getSchedule()));
  const month = sched.months.find(m => m.name === monthName);
  if (!month) { closeWeekEditor(); return; }
  const week = month.weeks[weekIdx];
  if (!week) { closeWeekEditor(); return; }

  const newWeekLabel = document.getElementById('we-week-label').value.trim();
  week.week = newWeekLabel;

  const rows = Array.from(document.querySelectorAll('#week-editor-slots .we-slot-row'));
  const newSlots = rows.map(row => ({
    teacher: row.querySelector('.we-teacher').value.trim(),
    theme: row.querySelector('.we-theme').value.trim()
  }));
  Object.assign(week, slotsToLegacy(newSlots));

  // 슬롯 완료 상태: 라벨이 바뀌었으면 기존 키 정리, 새 키로 저장
  if (originalWeekLabel && originalWeekLabel !== newWeekLabel) {
    const oldKey = monthName + '_' + originalWeekLabel;
    delete _state.weekStatus[oldKey];
    try { await _sb.from('week_status').delete().eq('id', oldKey); } catch(_) {}
  }
  for (let si = 0; si < rows.length; si++) {
    const checked = rows[si].querySelector('.we-status').checked;
    setSlotDone(monthName, newWeekLabel, si, checked);
  }
  const key = monthName + '_' + newWeekLabel;
  const st = _state.weekStatus[key] || {t1:false, t2:false};
  try {
    window._justSaved = Date.now();
    await _sb.from('week_status').upsert({
      id: key, month_name: monthName, week_label: newWeekLabel,
      t1_done: st.t1, t2_done: st.t2, updated_at: new Date().toISOString()
    });
  } catch(e) { console.warn('week_status upsert:', e); }

  await saveScheduleData(sched);

  showToast('✅ 저장되었습니다');
  closeWeekEditor();
  renderDashboard();
  if (typeof renderSchedule === 'function') renderSchedule();
}

// ── 개인화 박스 ──
// 이름 매칭: 대소문자 무시 + 부분일치 (양방향)
function _isMyTeacherSlot(slotTeacher, myName, myNormName) {
  if (!slotTeacher) return false;
  const slot = normalizeName(slotTeacher).toLowerCase();
  const me = (myNormName || '').toLowerCase();
  const meRaw = (myName || '').toLowerCase();
  if (!slot || !me) return false;
  if (slot === me) return true;
  // 부분일치: 슬롯 텍스트가 내 이름을 포함하거나, 내 이름이 슬롯 텍스트를 포함
  if (slot.includes(me) || me.includes(slot)) return true;
  if (meRaw && (slot.includes(meRaw) || meRaw.includes(slot))) return true;
  return false;
}

function renderPersonalBox() {
  const container = document.getElementById('personal-box');
  if (!container) return;
  const myName = sessionStorage.getItem('cms_name') || '';
  if (!myName) { container.innerHTML = ''; return; }
  const myNorm = normalizeName(myName);
  const months = (getSchedule().months) || [];

  const monthOrder = [3,4,5,6,7,8,9,10,11,12,1,2];
  const myUpcoming = [];
  // 일정에 등장하는 모든 선생님 이름 수집 (디버그 안내용)
  const teacherNames = new Set();
  months.forEach(m => {
    const mm = String(m.name).match(/(\d+)\s*월/);
    const monthNum = mm ? parseInt(mm[1]) : 99;
    (m.weeks || []).forEach((w, wi) => {
      const slots = getWeekSlots(w);
      slots.forEach((sl, si) => {
        if (sl.teacher) teacherNames.add(sl.teacher);
        if (_isMyTeacherSlot(sl.teacher, myName, myNorm) && !getSlotDone(m.name, w.week, si)) {
          myUpcoming.push({ monthName: m.name, monthNum, weekIdx: wi, week: w.week, theme: sl.theme || '주제 미정' });
        }
      });
    });
  });
  myUpcoming.sort((a, b) => {
    const ai = monthOrder.indexOf(a.monthNum);
    const bi = monthOrder.indexOf(b.monthNum);
    return ai - bi;
  });

  const next = myUpcoming[0];
  // 매칭 안 됐을 때, 일정에 비슷한 이름이 있는지 힌트
  let hintHtml = '';
  if (!next && teacherNames.size > 0) {
    const myLow = myNorm.toLowerCase();
    // 비슷한 이름 후보 찾기 (앞 글자 같거나 부분 포함)
    const similar = [...teacherNames].filter(t => {
      const tn = normalizeName(t).toLowerCase();
      return tn !== myLow && (tn.includes(myLow.slice(0,1)) || tn.startsWith(myLow.slice(0,1)));
    }).slice(0, 5);
    hintHtml = `<div class="personal-hint" title="이름 매칭 안 됨">
      현재 인식되는 내 이름: <strong>${escHtml(myName)}</strong>
      ${similar.length ? `· 일정에 있는 비슷한 이름: ${similar.map(s => `<code>${escHtml(s)}</code>`).join(', ')}` : ''}
      <br><span style="opacity:.7">슬롯의 선생님 이름이 위와 일치(또는 포함)해야 표시됩니다.</span>
    </div>`;
  }

  const html = `
    <div class="personal-box">
      <div class="personal-greeting">👋 안녕하세요, <strong>${escHtml(myName)}</strong>!</div>
      ${next
        ? `<div class="personal-task">
            <div class="task-label">다음 내 발표</div>
            <div class="task-detail">${escHtml(next.monthName)} ${escHtml(next.week)} · ${escHtml(next.theme)}</div>
            ${myUpcoming.length > 1 ? `<div class="task-more">+ ${myUpcoming.length - 1}개 더 예정</div>` : ''}
          </div>`
        : `<div class="personal-task all-done">📌 예정된 내 발표가 없어요${hintHtml ? '' : ''}</div>`
      }
    </div>
    ${hintHtml}`;
  container.innerHTML = html;
}

// ── 통계 카드 ──
function renderStatCards() {
  const container = document.getElementById('stats');
  if (!container) return;
  const myName = sessionStorage.getItem('cms_name') || '';
  const myNorm = normalizeName(myName);
  const customLessons = getCustomLessons();
  const myCount = customLessons.filter(isMyLesson).length;

  // 이번 학기 진행률 (선택된 학기 기준)
  const semMonths = getSemesterMonths(_currentSemester);
  let semTotal = 0, semDone = 0;
  semMonths.forEach(m => {
    (m.weeks || []).forEach(w => {
      const slots = getWeekSlots(w);
      slots.forEach((_, si) => {
        semTotal++;
        if (getSlotDone(m.name, w.week, si)) semDone++;
      });
    });
  });
  const semPct = semTotal > 0 ? Math.round(semDone / semTotal * 100) : 0;

  // 내 남은 발표 수 (전체 학기)
  let myPendingCount = 0;
  ((getSchedule().months) || []).forEach(m => {
    (m.weeks || []).forEach(w => {
      const slots = getWeekSlots(w);
      slots.forEach((sl, si) => {
        if (normalizeName(sl.teacher) === myNorm && !getSlotDone(m.name, w.week, si)) myPendingCount++;
      });
    });
  });

  const totalCustom = customLessons.length;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-value">${semPct}%</div><div class="stat-label">${SEMESTER_DEFS[_currentSemester].label}학기 진행 (${semDone}/${semTotal})</div></div>
    <div class="stat-card"><div class="stat-value">${myPendingCount}</div><div class="stat-label">내 남은 발표</div></div>
    <div class="stat-card"><div class="stat-value">${myCount}</div><div class="stat-label">내가 작성한 자료</div></div>
    <div class="stat-card"><div class="stat-value">${totalCustom}</div><div class="stat-label">전체 등록 자료</div></div>
  `;
}

// ── 최근 작성 (버그 수정: customLessons는 updated_at DESC라 앞에서 자르는 게 맞음) ──
function renderRecentLessons() {
  const container = document.getElementById('recent-lessons');
  if (!container) return;
  const recent = getCustomLessons()
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 5);
  const html = recent.map(l => {
    const date = l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('ko-KR') : '';
    return `<div class="my-lesson-item" style="cursor:pointer" onclick="loadLessonToEditor('${l.id}', true)">
      <div class="my-lesson-info">
        <h4>${escHtml(l.title)} ${l.author ? `<span style="font-weight:400;color:var(--gray-500);font-size:12px">· ${escHtml(l.author)}</span>` : ''}</h4>
        <p>${escHtml(l.level)} ${date ? '· ' + date : ''}</p>
      </div>
      <span class="badge badge-level">${escHtml(l.level)}</span>
    </div>`;
  }).join('');
  container.innerHTML = html || '<div class="empty-state"><p>아직 자료가 없습니다</p></div>';
}

function renderDashboard() {
  renderPersonalBox();
  renderStatCards();
  renderSemesterCalendar();
  renderCurriculumProgress();
  renderRecentLessons();
}

// ── 일정 편집 ──
function getSchedule() {
  return _state.schedule || DATA.schedule;
}
async function saveScheduleData(schedule) {
  _state.schedule = schedule;
  window._justSaved = Date.now();
  const schedId = getCurrentScheduleId();
  await _sb.from('seminar_schedule').upsert({id: schedId, data: schedule, updated_at: new Date().toISOString()});
}
async function resetSchedule() {
  if (!confirm('원본 일정으로 되돌리시겠습니까? 수정된 내용이 모두 사라집니다.')) return;
  _state.schedule = null;
  await _sb.from('seminar_schedule').delete().eq('id', 1);
  cancelEditMode();
  renderSchedule();
  renderDashboard();
  showToast('↺ 원본 일정으로 초기화되었습니다');
}

let _editMode = false;
let _editSchedule = null; // 편집 중 임시 복사본
function enterEditMode() {
  _editMode = true;
  _editSchedule = JSON.parse(JSON.stringify(getSchedule()));
  if (!_editSchedule.teachers) _editSchedule.teachers = ['황지향','김경미','변유진','윤시현'];
  document.getElementById('schedule-actions').style.display = 'none';
  document.getElementById('edit-actions').style.display = 'flex';
  document.getElementById('schedule-edit-notice').style.display = 'block';
  document.getElementById('teacher-panel').style.display = 'block';
  // subtitle은 renderSchedule에서 처리
  renderTeacherPanel();
  updateTeacherDatalist();
  renderSchedule();
}
function cancelEditMode() {
  _editMode = false;
  _editSchedule = null;
  document.getElementById('schedule-actions').style.display = 'flex';
  document.getElementById('edit-actions').style.display = 'none';
  document.getElementById('schedule-edit-notice').style.display = 'none';
  document.getElementById('teacher-panel').style.display = 'none';
  // subtitle은 renderSchedule에서 처리
  renderSchedule();
}
function captureEditValues() {
  if (!_editSchedule) return;
  const noteEl = document.getElementById('schedule-note-input');
  if (noteEl) _editSchedule.note = noteEl.value;
  _editSchedule.months.forEach((m, mi) => {
    const mnEl = document.getElementById(`mn-${mi}`);
    const dirEl = document.getElementById(`dir-${mi}`);
    if (mnEl) m.name = mnEl.value;
    if (dirEl) m.direction = dirEl.value;
    m.weeks.forEach((w, wi) => {
      const wkEl = document.getElementById(`wk-${mi}-${wi}`);
      if (wkEl) w.week = wkEl.value;
      // slots 수집 (ts-mi-wi-0, ts-mi-wi-1, ...)
      const curSlots = getWeekSlots(w);
      const newSlots = [];
      for (let si = 0; si < curSlots.length + 5; si++) {
        const tEl = document.getElementById(`ts-${mi}-${wi}-${si}`);
        const thEl = document.getElementById(`th-${mi}-${wi}-${si}`);
        if (!tEl && !thEl) break;
        newSlots.push({teacher: tEl?tEl.value:'', theme: thEl?thEl.value:''});
      }
      if (newSlots.length > 0) {
        Object.assign(w, slotsToLegacy(newSlots));
      }
    });
  });
}
function applyDateToWeek(dateInput, mi, wi) {
  if (!dateInput.value) return;
  const d = new Date(dateInput.value + 'T00:00:00');
  const formatted = `${d.getMonth() + 1}/${d.getDate()}`;
  const wkEl = document.getElementById(`wk-${mi}-${wi}`);
  if (!wkEl) return;
  const current = wkEl.value;
  // 기존 (M/D) 부분이 있으면 교체, 없으면 뒤에 추가
  const replaced = current.replace(/\(\d+\/\d+\)/, `(${formatted})`);
  wkEl.value = replaced !== current ? replaced : current + `(${formatted})`;
}

function saveScheduleEdit() {
  captureEditValues();
  saveScheduleData(_editSchedule);
  showToast('✅ 일정이 저장되었습니다');
  cancelEditMode();
  renderDashboard();
}
// 주차/월 추가·삭제
function addWeek(mi) {
  captureEditValues();
  const ts = _editSchedule.teachers || [];
  _editSchedule.months[mi].weeks.push({
    week:'',
    slots: [{teacher:ts[0]||'', theme:''}, {teacher:ts[1]||'', theme:''}],
    teacher1:ts[0]||'', teacher2:ts[1]||'', theme1:'', theme2:''
  });
  renderSchedule();
}
function addSlot(mi, wi) {
  captureEditValues();
  const w = _editSchedule.months[mi].weeks[wi];
  const slots = getWeekSlots(w);
  const ts = _editSchedule.teachers || [];
  slots.push({teacher: ts[slots.length] || '', theme: ''});
  Object.assign(w, slotsToLegacy(slots));
  renderSchedule();
}
function removeSlot(mi, wi, si) {
  captureEditValues();
  const w = _editSchedule.months[mi].weeks[wi];
  const slots = getWeekSlots(w);
  if (slots.length <= 2) { showToast('⚠️ 최소 2칸은 유지해야 해요'); return; }
  slots.splice(si, 1);
  Object.assign(w, slotsToLegacy(slots));
  renderSchedule();
}
function removeWeek(mi, wi) {
  if (_editSchedule.months[mi].weeks.length <= 1) { showToast('⚠️ 주차가 1개뿐이라 삭제할 수 없어요'); return; }
  captureEditValues();
  _editSchedule.months[mi].weeks.splice(wi, 1);
  renderSchedule();
}
function addMonth() {
  captureEditValues();
  const ts = _editSchedule.teachers || [];
  _editSchedule.months.push({name:'', direction:'', weeks:[{week:'', slots:[{teacher:ts[0]||'',theme:''},{teacher:ts[1]||'',theme:''}], teacher1:ts[0]||'', teacher2:ts[1]||'', theme1:'', theme2:''}]});
  renderSchedule();
  // 새 월로 스크롤
  setTimeout(() => { const cards = document.querySelectorAll('.month-card'); if(cards.length) cards[cards.length-1].scrollIntoView({behavior:'smooth'}); }, 100);
}
function removeMonth(mi) {
  if (!confirm('이 월 전체를 삭제하시겠습니까?')) return;
  captureEditValues();
  _editSchedule.months.splice(mi, 1);
  renderSchedule();
}
// 선생님 관리
function getTeachers() {
  return (getSchedule().teachers) || ['황지향','김경미','변유진','윤시현'];
}
function renderTeacherPanel() {
  const teachers = _editSchedule ? (_editSchedule.teachers || []) : [];
  document.getElementById('teacher-list-edit').innerHTML = teachers.map((t, i) =>
    `<div class="teacher-tag"><span>${t}</span><button class="teacher-tag-del" onclick="removeTeacher(${i})" title="삭제">×</button></div>`
  ).join('') || '<span style="font-size:13px;color:var(--gray-500)">선생님이 없습니다</span>';
}
function addTeacher() {
  const input = document.getElementById('new-teacher-input');
  const name = input.value.trim();
  if (!name || !_editSchedule) return;
  if (!_editSchedule.teachers) _editSchedule.teachers = [];
  if (_editSchedule.teachers.includes(name)) { showToast('이미 있는 이름이에요'); return; }
  _editSchedule.teachers.push(name);
  renderTeacherPanel();
  updateTeacherDatalist();
  input.value = '';
  showToast(`✅ ${name} 추가됨`);
}
function removeTeacher(idx) {
  if (!_editSchedule?.teachers) return;
  const name = _editSchedule.teachers[idx];
  if (!confirm(`"${name}"을(를) 목록에서 제거할까요?`)) return;
  _editSchedule.teachers.splice(idx, 1);
  renderTeacherPanel();
  updateTeacherDatalist();
}
function updateTeacherDatalist() {
  const dl = document.getElementById('teacher-datalist');
  if (!dl || !_editSchedule) return;
  dl.innerHTML = (_editSchedule.teachers || []).map(t => `<option value="${t}">`).join('');
}

// Schedule
// ── 주차 슬롯 헬퍼: 구형(teacher1/2) ↔ 신형(slots[]) 호환 ──
function getWeekSlots(w) {
  if (w.slots && w.slots.length > 0) return w.slots;
  const s = [];
  if (w.teacher1 || w.theme1) s.push({teacher: w.teacher1||'', theme: w.theme1||''});
  if (w.teacher2 || w.theme2) s.push({teacher: w.teacher2||'', theme: w.theme2||''});
  return s.length ? s : [{teacher:'', theme:''},{teacher:'', theme:''}];
}
function slotsToLegacy(slots) {
  // Supabase 저장 시 호환성 유지
  return {
    teacher1: slots[0]?.teacher||'', theme1: slots[0]?.theme||'',
    teacher2: slots[1]?.teacher||'', theme2: slots[1]?.theme||'',
    slots
  };
}
// 슬롯 완료 상태: Supabase(t1/t2) + localStorage(추가분)
function getSlotStatusKey(monthName, weekLabel) { return monthName + '_' + weekLabel; }
function getSlotDone(monthName, weekLabel, si) {
  const key = getSlotStatusKey(monthName, weekLabel);
  if (si === 0) return (_state.weekStatus[key]||{}).t1||false;
  if (si === 1) return (_state.weekStatus[key]||{}).t2||false;
  const ext = JSON.parse(localStorage.getItem('cms_slot_ext')||'{}');
  return (ext[key]||[])[si]||false;
}
function setSlotDone(monthName, weekLabel, si, val) {
  const key = getSlotStatusKey(monthName, weekLabel);
  if (!_state.weekStatus[key]) _state.weekStatus[key] = {t1:false, t2:false};
  if (si === 0) _state.weekStatus[key].t1 = val;
  else if (si === 1) _state.weekStatus[key].t2 = val;
  else {
    const ext = JSON.parse(localStorage.getItem('cms_slot_ext')||'{}');
    if (!ext[key]) ext[key] = [];
    ext[key][si] = val;
    localStorage.setItem('cms_slot_ext', JSON.stringify(ext));
  }
}
function getWeekStatusKey(monthName, weekLabel) {
  return monthName + '_' + weekLabel;
}
function getWeekStatus(monthName, weekLabel) {
  return _state.weekStatus[getWeekStatusKey(monthName, weekLabel)] || {t1: false, t2: false};
}
async function toggleSlotStatus(monthName, weekLabel, si) {
  const key = getSlotStatusKey(monthName, weekLabel);
  const cur = getSlotDone(monthName, weekLabel, si);
  setSlotDone(monthName, weekLabel, si, !cur);
  const st = _state.weekStatus[key] || {t1:false, t2:false};
  window._justSaved = Date.now();
  await _sb.from('week_status').upsert({
    id: key, month_name: monthName, week_label: weekLabel,
    t1_done: st.t1, t2_done: st.t2, updated_at: new Date().toISOString()
  });
  renderSchedule();
  renderDashboard();
}

function makeThemeLink(theme) {
  if (!theme) return '<span class="week-theme empty">미정</span>';
  // Extract theme code (e.g. "13-2-2") to use as search query
  const match = theme.match(/[\d]+[-][\d]+[-][\d]+/);
  const searchQ = match ? match[0] : theme.split('\n')[0].trim();
  return `<span class="week-theme theme-link" onclick="goToLesson('${searchQ.replace(/'/g,"\\'")}')">
    ${theme.replace(/\n/g,'<br>')}
  </span>`;
}

function goToLesson(query) {
  showPage('library');
  document.getElementById('search-input').value = query;
  currentLevel = '';
  // 다른 선생님 교안도 볼 수 있게 작성자 필터 전체로 초기화
  const authorFilter = document.getElementById('author-filter');
  if (authorFilter) authorFilter.value = '';
  filterLessons();
}

// [신규] 학기 캘린더 슬롯 클릭 시 호출 — 테마 코드(13-2-2)가 있으면 그것을,
//   없으면 첫 줄 전체를 사용해 테마 필터 모드(제목 매칭)로 자료실에 점프한다.
function jumpToLessonFromSlot(theme) {
  if (!theme) return;
  const m = String(theme).match(/\d+-\d+-\d+/);
  const q = m ? m[0] : String(theme).split('\n')[0].trim();
  if (typeof searchByTheme === 'function') searchByTheme(q);
  else goToLesson(q);
}