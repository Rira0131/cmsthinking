
function renderSchedule() {
  const schedule = (_editMode && _editSchedule) ? _editSchedule : getSchedule();
  // subtitle 업데이트
  const subEl = document.getElementById('schedule-subtitle');
  if (subEl) {
    if (_editMode) {
      subEl.innerHTML = `<input id="schedule-note-input" type="text" value="${(schedule.note||'').replace(/"/g,'&quot;')}" placeholder="예: 매주 수요일 1시 30분 진행" style="border:1px solid #FFD0E2;border-radius:8px;padding:4px 10px;font-size:13px;font-family:inherit;outline:none;color:var(--gray-700);width:280px">`;
    } else {
      subEl.textContent = schedule.note || '';
    }
  }
  const months = schedule.months;
  const summerMonths = ['6월','7월','8월'];
  const fallMonths = ['9월','10월','11월'];

  let completedCount = 0, totalCount = 0;
  let html = '';

  months.forEach((m, mi) => {
    const isSummer = summerMonths.some(s => m.name.includes(s));
    const isFall = fallMonths.some(s => m.name.includes(s));
    const headerClass = isFall ? 'fall' : isSummer ? 'summer' : '';

    if (_editMode) {
      html += `<div class="month-card editing"><div class="month-card-inner">
        <div class="month-card-header ${headerClass}" style="display:flex;align-items:center;gap:8px">
          <input class="edit-input" id="mn-${mi}" value="${m.name.replace(/"/g,'&quot;')}" placeholder="월 이름 (예: 3월)" style="background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.5);font-weight:700;font-size:14px;flex:1">
          <button class="month-del-btn" onclick="removeMonth(${mi})" title="이 월 삭제">🗑️</button>
        </div>
        <div class="month-direction edit-row">
          <span style="font-weight:600;font-size:11px;color:var(--gray-500);margin-right:6px">진행 방향:</span>
          <input class="edit-input" id="dir-${mi}" value="${(m.direction||'').replace(/"/g,'&quot;')}" placeholder="이달 진행 방향을 입력하세요">
        </div>`;
    } else {
      html += `<div class="month-card"><div class="month-card-inner">
        <div class="month-card-header ${headerClass}">${m.name}</div>`;
      if (m.direction) html += `<div class="month-direction">📌 ${m.direction}</div>`;
    }

    m.weeks.forEach((w, wi) => {
      const slots = getWeekSlots(w);
      const mn = m.name.replace(/'/g,"\\'");
      const wk = w.week.replace(/'/g,"\\'");
      slots.forEach((sl, si) => {
        if (sl.theme) totalCount++;
        if (getSlotDone(m.name, w.week, si) && sl.theme) completedCount++;
      });

      if (_editMode) {
        const slotCols = `grid-template-columns:90px repeat(${slots.length},minmax(170px,1fr));min-width:${90 + slots.length * 170}px`;
        html += `<div class="week-row edit-week-row" style="${slotCols}">
          <div class="week-label" style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;min-width:90px">
            <input class="edit-input" id="wk-${mi}-${wi}" value="${(w.week||'').replace(/"/g,'&quot;')}" placeholder="예: 1주(4/1)" style="font-size:12px;text-align:center">
            <input type="date" title="날짜 선택" onchange="applyDateToWeek(this,'${mi}','${wi}')" style="font-size:10px;width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:2px 4px;cursor:pointer;color:#6b7280;margin-top:1px">
            <button class="week-del-btn" onclick="removeWeek(${mi},${wi})">🗑️ 삭제</button>
            <button class="week-del-btn" onclick="addSlot(${mi},${wi})" style="border-color:var(--primary);color:var(--primary)">＋ 추가</button>
          </div>
          ${slots.map((sl, si) => `
          <div class="week-cell edit-cell" style="position:relative">
            <input list="teacher-datalist" class="edit-input" id="ts-${mi}-${wi}-${si}" value="${(sl.teacher||'').replace(/"/g,'&quot;')}" placeholder="선생님 이름">
            <textarea class="edit-textarea" id="th-${mi}-${wi}-${si}" placeholder="테마명">${sl.theme||''}</textarea>
            ${si >= 2 ? `<button onclick="removeSlot(${mi},${wi},${si})" style="position:absolute;top:4px;right:4px;padding:1px 6px;border-radius:4px;border:1px solid var(--red);background:#fff;color:var(--red);cursor:pointer;font-size:11px">×</button>` : ''}
          </div>`).join('')}
        </div>`;
      } else {
        const slotCols = `grid-template-columns:90px repeat(${slots.length},minmax(140px,1fr));min-width:${90 + slots.length * 140}px`;
        html += `<div class="week-row" style="${slotCols}">
          <div class="week-label">${w.week}</div>
          ${slots.map((sl, si) => {
            const done = getSlotDone(m.name, w.week, si);
            return `<div class="week-cell">
              <div class="week-teacher-row">
                <span class="week-teacher">${sl.teacher}</span>
                ${sl.theme ? `<button class="status-btn ${done?'done':''}" onclick="toggleSlotStatus('${mn}','${wk}',${si})">${done?'✅ 완료':'○ 미완료'}</button>` : ''}
              </div>
              ${makeThemeLink(sl.theme)}
            </div>`;
          }).join('')}
        </div>`;
      }
    });
    if (_editMode) {
      html += `<button class="add-week-btn" onclick="addWeek(${mi})">+ 주차 추가</button>`;
    }
    html += '</div></div>'; // month-card-inner + month-card
  });

  if (_editMode) {
    html += `<div style="display:flex;align-items:center;justify-content:center;padding:8px">
      <button class="btn btn-secondary" onclick="addMonth()" style="width:100%;max-width:320px">＋ 월 추가</button>
    </div>`;
  }

  document.getElementById('schedule-grid').innerHTML = html;
  window._scheduleProgress = { completed: completedCount, total: totalCount };
}

// Library
let currentLevel = '';