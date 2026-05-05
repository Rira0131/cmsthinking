function applyResearchFormat(btn, cmd, value) {
  const wrap = btn.closest('.activity-editor');
  if (!wrap) return;
  const editor = wrap.querySelector('.act-research');
  if (!editor) return;
  const sel = window.getSelection();
  let inside = false;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    inside = editor.contains(r.commonAncestorContainer);
  }
  if (!inside) { editor.focus(); return; }
  try { document.execCommand('styleWithCSS', false, true); } catch(_) {}
  if (cmd === 'removeFormat') {
    document.execCommand('removeFormat', false, null);
    document.execCommand('foreColor', false, 'inherit');
    document.execCommand('hiliteColor', false, 'transparent');
  } else if (cmd === 'foreColor') {
    document.execCommand('foreColor', false, value || 'inherit');
  } else if (cmd === 'hiliteColor') {
    if (value === '' || value == null) {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('backColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, value);
    }
  } else {
    document.execCommand(cmd, false, value || null);
  }
  updateResearchEmpty(editor);
}

function updateResearchEmpty(editor) {
  if (!editor) return;
  const isEmpty = !editor.textContent.trim() && !editor.querySelector('img');
  editor.classList.toggle('is-empty', isEmpty);
}

function buildResearchToolbarHtml() {
  const colors = [
    ['#DC2626', '빨강'], ['#2563EB', '파랑'], ['#059669', '초록'],
    ['#D97706', '주황'], ['#7C3AED', '보라'], ['#111827', '검정']
  ];
  const highlights = [
    ['#FEF3C7', '노랑'], ['#FECACA', '분홍'],
    ['#BFDBFE', '파랑'], ['#BBF7D0', '초록']
  ];
  const colorBtns = colors.map(([c, t]) =>
    `<button type="button" class="rt-color" style="background:${c}" title="${t}" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'foreColor','${c}')"></button>`
  ).join('');
  const hlBtns = highlights.map(([c, t]) =>
    `<button type="button" class="rt-hl" style="background:${c}" title="형광펜 ${t}" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'hiliteColor','${c}')"></button>`
  ).join('');
  return `
    <div class="research-toolbar">
      <button type="button" class="rt-btn" title="굵게 (Ctrl+B)" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'bold')"><b>B</b></button>
      <span class="rt-sep"></span>
      <span class="rt-label">색상</span>
      ${colorBtns}
      <button type="button" class="rt-clear" title="글자색 기본으로" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'foreColor','')">기본</button>
      <span class="rt-sep"></span>
      <span class="rt-label">형광펜</span>
      ${hlBtns}
      <button type="button" class="rt-clear" title="형광펜 제거" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'hiliteColor','')">없음</button>
      <span class="rt-sep"></span>
      <button type="button" class="rt-clear" title="모든 서식 제거" onmousedown="event.preventDefault()" onclick="applyResearchFormat(this,'removeFormat')">서식 지우기</button>
      <span class="rt-sep"></span>
      <button type="button" class="rt-clear" title="수식 삽입" onmousedown="event.preventDefault()" onclick="openMathEditorForResearch(this)" style="color:#FF6B9D;font-weight:700">∑ 수식</button>
    </div>`;
}

let activityCount = 0;
function addActivityEditor(name='', research='', materials='', time='', workbook='', images=[], links=[]) {
  activityCount++;
  const id = activityCount;
  const container = document.getElementById('ed-activities');
  const div = document.createElement('div');
  div.className = 'activity-editor';
  div.id = 'act-' + id;
  div.innerHTML = `
    <div class="activity-editor-header">
      <span class="activity-drag-handle" title="드래그해서 순서 변경"
            onmousedown="this.closest('.activity-editor').setAttribute('draggable','true')"
            onmouseup="this.closest('.activity-editor').setAttribute('draggable','false')">☰</span>
      <span class="activity-num" style="font-weight:600;font-size:13px;flex:1">활동 ${id}</span>
      <div class="activity-controls">
        <button class="activity-move-btn" type="button" title="위로 이동" onclick="moveActivityBy(this,-1)">↑</button>
        <button class="activity-move-btn" type="button" title="아래로 이동" onclick="moveActivityBy(this,1)">↓</button>
        <button class="btn btn-danger btn-sm" onclick="document.getElementById('act-${id}').remove();if(_activeActId==='${id}')_activeActId=null;renumberActivities();updateTimeBar();updateMoveButtons()">삭제</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">활동명</label><input type="text" class="form-input act-name" value="${escHtml(name)}"></div>
      <div class="form-group"><label class="form-label">워크북 연계 <span style="font-weight:400;color:var(--gray-500)">(예: A형 1번, B형 2-3번)</span></label><input type="text" class="form-input act-workbook" value="${escHtml(workbook)}" placeholder="예: A형 1번"></div>
    </div>
    <div class="form-group">
      <label class="form-label">활동 연구</label>
      ${buildResearchToolbarHtml()}
      <div class="research-editor act-research" contenteditable="true" data-placeholder="활동 연구 내용을 입력하세요. 위 툴바로 굵게·색상·형광펜을 적용할 수 있어요."></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">준비물</label><input type="text" class="form-input act-materials" value="${escHtml(materials)}"></div>
      <div class="form-group"><label class="form-label">소요 시간</label><input type="text" class="form-input act-time" value="${escHtml(time)}" placeholder="예: 10분" oninput="updateTimeBar()"></div>
    </div>
    <div class="form-group">
      <label class="form-label">🖼️ 이미지 <span style="font-weight:400;font-size:11px;color:var(--gray-500)">(클릭·드래그·Ctrl+V 붙여넣기)</span></label>
      <div class="img-upload-zone" id="img-zone-${id}"
           onclick="onImgZoneClick(event,'${id}')"
           ondragover="event.preventDefault();this.classList.add('dragover')"
           ondragleave="this.classList.remove('dragover')"
           ondrop="handleImgDrop(event,'${id}')">
        📷 이미지 파일 선택 또는 드래그 &nbsp;·&nbsp; <kbd style="background:#e5e7eb;padding:1px 6px;border-radius:4px;font-size:12px">Ctrl+V</kbd>로 붙여넣기
        <label style="display:inline-block;margin-top:6px;padding:4px 14px;background:var(--primary);color:#fff;border-radius:6px;font-size:12px;cursor:pointer" onclick="event.stopPropagation();setActiveImgZone('${id}')">
          파일 선택<input type="file" id="img-file-${id}" accept="image/*" multiple style="display:none" onchange="handleImgFiles(this,'${id}')">
        </label>
      </div>
      <div class="img-grid" id="img-grid-${id}"></div>
    </div>
    <div class="form-group">
      <label class="form-label" style="display:flex;align-items:center;gap:8px">🔗 참고 링크 <span style="font-weight:400;font-size:11px;color:var(--gray-500)">(이 활동에만 적용)</span>
        <button type="button" class="btn btn-sm" onclick="addActLinkRow(this)" style="padding:3px 10px;font-size:12px;margin-left:auto">+ 추가</button>
      </label>
      <div class="act-links" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  `;
  container.appendChild(div);
  // [신규] 드래그 이벤트 등록 — 헤더 핸들 mousedown 시 draggable=true 설정 후 동작
  _attachActivityDragEvents(div);
  // 기존 링크 채우기
  if (links && links.length > 0) {
    const linksContainer = div.querySelector('.act-links');
    links.forEach(lk => _appendActLinkRow(linksContainer, lk.label || '', lk.url || ''));
  }
  // 활동 연구 contenteditable 초기 콘텐츠 주입 (구버전 평문/신버전 HTML 모두 대응)
  const researchEditor = div.querySelector('.act-research');
  if (researchEditor) {
    researchEditor.innerHTML = researchToDisplayHtml(research);
    _scheduleMathRender(researchEditor);
    updateResearchEmpty(researchEditor);
    researchEditor.addEventListener('input', () => updateResearchEmpty(researchEditor));
    researchEditor.addEventListener('blur', () => updateResearchEmpty(researchEditor));
    researchEditor.addEventListener('paste', (e) => {
      const html = e.clipboardData && e.clipboardData.getData('text/html');
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (html) {
        e.preventDefault();
        document.execCommand('insertHTML', false, sanitizeResearchHtml(html));
      } else if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
      }
    });
  }
  if (images && images.length > 0) {
    images.forEach(src => addImgPreview(id, src));
  }
  renumberActivities();
  updateTimeBar();
}

// 활동 편집기들의 화면 표시 번호를 현재 순서대로 1부터 다시 매긴다
// (내부 DOM id는 유지해서 이미지 업로드 등 기존 참조는 영향 없음)
function renumberActivities() {
  document.querySelectorAll('.activity-editor .activity-num').forEach((span, idx) => {
    span.textContent = '활동 ' + (idx + 1);
  });
  updateMoveButtons();
}

// 위/아래 이동 버튼의 활성/비활성 상태 갱신 (첫 활동은 ↑ 비활성, 마지막은 ↓ 비활성)
function updateMoveButtons() {
  const editors = Array.from(document.querySelectorAll('#ed-activities .activity-editor'));
  editors.forEach((editor, i) => {
    const btns = editor.querySelectorAll('.activity-move-btn');
    if (btns.length >= 2) {
      btns[0].disabled = (i === 0);
      btns[1].disabled = (i === editors.length - 1);
    }
  });
}

// ↑/↓ 버튼: 클릭한 버튼이 속한 활동을 한 칸 위/아래로 이동
function moveActivityBy(btn, dir) {
  const editor = btn.closest('.activity-editor');
  if (!editor) return;
  const sibling = dir < 0 ? editor.previousElementSibling : editor.nextElementSibling;
  if (!sibling || !sibling.classList.contains('activity-editor')) return;
  if (dir < 0) editor.parentNode.insertBefore(editor, sibling);
  else editor.parentNode.insertBefore(sibling, editor);
  renumberActivities();
  updateTimeBar();
}

// 드래그 앤 드롭: 헤더 핸들 mousedown으로 draggable이 켜진 .activity-editor를 끌어
//   원하는 위치로 옮긴다. 드롭 위치는 마우스 Y가 대상 활동의 절반 위/아래 어느 쪽인지로 결정.
let _draggedActivity = null;
function _attachActivityDragEvents(editor) {
  editor.addEventListener('dragstart', (e) => {
    _draggedActivity = editor;
    editor.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox 호환: dataTransfer에 뭔가를 세팅해야 드래그가 시작됨
      try { e.dataTransfer.setData('text/plain', editor.id || 'activity'); } catch(_) {}
    }
  });
  editor.addEventListener('dragend', () => {
    editor.classList.remove('dragging');
    document.querySelectorAll('.activity-editor.drag-over-top, .activity-editor.drag-over-bottom')
      .forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
    editor.setAttribute('draggable', 'false');
    _draggedActivity = null;
  });
  editor.addEventListener('dragover', (e) => {
    if (!_draggedActivity || _draggedActivity === editor) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = editor.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    editor.classList.toggle('drag-over-top', before);
    editor.classList.toggle('drag-over-bottom', !before);
  });
  editor.addEventListener('dragleave', () => {
    editor.classList.remove('drag-over-top','drag-over-bottom');
  });
  editor.addEventListener('drop', (e) => {
    if (!_draggedActivity || _draggedActivity === editor) return;
    e.preventDefault();
    const rect = editor.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    if (before) editor.parentNode.insertBefore(_draggedActivity, editor);
    else editor.parentNode.insertBefore(_draggedActivity, editor.nextElementSibling);
    editor.classList.remove('drag-over-top','drag-over-bottom');
    renumberActivities();
    updateTimeBar();
  });
}

// ── 90분 시간 합산 체크 ──
function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  // "30분", "10분 + 5분 휴식", "활동 전 과제 체크 30분", "약 15분" 등 다양한 형식 처리
  let total = 0;
  const matches = timeStr.match(/(\d+)\s*분/g);
  if (matches) matches.forEach(m => { total += parseInt(m); });
  return total;
}

function updateTimeBar() {
  const times = document.querySelectorAll('.act-time');
  let total = 0;
  times.forEach(t => { total += parseMinutes(t.value); });

  const wrap = document.getElementById('time-bar-wrap');
  const warning = document.getElementById('time-warning');
  const fill = document.getElementById('time-bar-fill');
  const label = document.getElementById('time-bar-label');
  const summary = document.getElementById('time-summary');
  const overVal = document.getElementById('time-over-val');

  if (times.length === 0 || total === 0) {
    wrap.style.display = 'none';
    warning.style.display = 'none';
    summary.textContent = '';
    return;
  }

  wrap.style.display = 'block';
  const pct = Math.min((total / 90) * 100, 100);
  const isOver = total > 90;
  const isClose = total >= 80 && total <= 90;

  fill.style.width = pct + '%';
  fill.style.background = isOver ? '#DC2626' : isClose ? '#D97706' : '#4F46E5';
  label.textContent = `${total} / 90분`;
  label.style.color = isOver ? '#DC2626' : isClose ? '#D97706' : 'var(--gray-500)';
  label.style.fontWeight = isOver || isClose ? '700' : '400';

  if (isOver) {
    warning.style.display = 'block';
    overVal.textContent = total;
    summary.innerHTML = `<span style="color:#DC2626;font-weight:700">⚠️ ${total}분 (${total-90}분 초과)</span>`;
  } else if (isClose) {
    warning.style.display = 'none';
    summary.innerHTML = `<span style="color:#D97706;font-weight:700">⏱ ${total}분 (거의 다 찼어요)</span>`;
  } else {
    warning.style.display = 'none';
    summary.innerHTML = `<span style="color:var(--gray-500)">⏱ 총 ${total}분 / 90분</span>`;
  }
}


// ── 이미지 처리 ──
// 현재 활성 이미지 영역 (Ctrl+V 붙여넣기 대상)
let _activeActId = null;
function setActiveImgZone(actId) {
  _activeActId = actId;
  document.querySelectorAll('.img-upload-zone').forEach(z => z.classList.remove('active-target'));
  const zone = document.getElementById('img-zone-' + actId);
  if (zone) zone.classList.add('active-target');
}
function onImgZoneClick(e, actId) {
  // 영역 클릭 시 해당 활동을 활성 대상으로 설정
  setActiveImgZone(actId);
  // 내부의 "파일 선택" 라벨/입력 클릭이 아니면 파일 선택창 열기
  const t = e.target;
  if (t.tagName === 'LABEL' || t.tagName === 'INPUT' || t.closest('label')) return;
  document.getElementById('img-file-' + actId)?.click();
}
function handleImgFiles(input, actId) {
  Array.from(input.files).forEach(file => addImgToActivity(actId, file));
  input.value = '';
}
function handleImgDrop(e, actId) {
  e.preventDefault();
  document.getElementById('img-zone-'+actId)?.classList.remove('dragover');
  setActiveImgZone(actId);
  Array.from(e.dataTransfer.files)
    .filter(f => f.type.startsWith('image/'))
    .forEach(f => addImgToActivity(actId, f));
}
// ── 이미지 압축 (canvas 이용, 최대 960px / JPEG 75%) ──
const IMG_MAX_W = 960;   // 최대 가로 픽셀
const IMG_QUALITY = 0.75; // JPEG 품질 (0~1)

function compressImage(dataUrl) {
  return new Promise(resolve => {
    const imgEl = new Image();
    imgEl.onload = () => {
      let { width, height } = imgEl;
      // 크기 조정
      if (width > IMG_MAX_W) {
        height = Math.round(height * IMG_MAX_W / width);
        width = IMG_MAX_W;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(imgEl, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', IMG_QUALITY);
      // 압축 전보다 커지면 원본 유지 (이미 최적화된 이미지)
      resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    imgEl.onerror = () => resolve(dataUrl); // 실패 시 원본
    imgEl.src = dataUrl;
  });
}

function getBase64SizeKB(dataUrl) {
  return Math.round((dataUrl.length * 3 / 4) / 1024);
}

async function addImgToActivity(actId, file) {
  const grid = document.getElementById('img-grid-'+actId);

  // 플레이스홀더 표시
  const placeholder = document.createElement('div');
  placeholder.className = 'img-thumb';
  placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-500);background:#f3f4f6;flex-direction:column;gap:4px';
  placeholder.innerHTML = '<div style="font-size:18px">⬆️</div><div>업로드 중...</div>';
  if (grid) grid.appendChild(placeholder);

  try {
    // 1단계: canvas로 압축 (base64 경유, 업로드용)
    const dataUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
    const compressed = await compressImage(dataUrl);

    // 2단계: base64 → Blob 변환
    const res = await fetch(compressed);
    const blob = await res.blob();

    // 3단계: Supabase Storage 업로드
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { data, error } = await _sb.storage
      .from('lesson-images')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;

    // 4단계: 공개 URL 가져오기
    const { data: urlData } = _sb.storage.from('lesson-images').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    if (grid && grid.contains(placeholder)) grid.removeChild(placeholder);
    addImgPreview(actId, publicUrl);

    const origKB = Math.round(file.size / 1024);
    const newKB = Math.round(blob.size / 1024);
    if (origKB > newKB * 1.5) showToast(`🗜️ 이미지 압축: ${origKB}KB → ${newKB}KB`);

  } catch(e) {
    console.error('이미지 업로드 실패:', e);
    if (grid && grid.contains(placeholder)) grid.removeChild(placeholder);
    showToast('❌ 이미지 업로드 실패. Storage 버킷을 확인해주세요.');
  }
}
function addImgPreview(actId, url) {
  const grid = document.getElementById('img-grid-'+actId);
  if (!grid) return;
  const div = document.createElement('div');
  div.className = 'img-thumb';
  div.dataset.src = url;
  const img = document.createElement('img');
  img.src = url;
  img.title = '클릭하여 크게 보기';
  img.onclick = () => openLightbox(url);
  const delBtn = document.createElement('button');
  delBtn.className = 'img-thumb-del';
  delBtn.title = '삭제';
  delBtn.textContent = '×';
  delBtn.onclick = async () => {
    div.remove();
    // Storage에서도 삭제
    try {
      const fileName = url.split('/').pop().split('?')[0];
      await _sb.storage.from('lesson-images').remove([fileName]);
    } catch(e) { console.warn('Storage 이미지 삭제 실패:', e); }
  };
  div.appendChild(img);
  div.appendChild(delBtn);
  grid.appendChild(div);
  _attachThumbDragEvents(div);
}

// ── 이미지 썸네일 드래그 순서 변경 (활동 이미지 + 교재 이미지 공용) ──
let _draggedThumb = null;
function _attachThumbDragEvents(thumb) {
  thumb.setAttribute('draggable', 'true');
  thumb.addEventListener('dragstart', (e) => {
    _draggedThumb = thumb;
    thumb.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', thumb.dataset.src || 'thumb'); } catch(_) {}
    }
  });
  thumb.addEventListener('dragend', () => {
    thumb.classList.remove('dragging');
    document.querySelectorAll('.img-thumb.drag-over').forEach(el => el.classList.remove('drag-over'));
    _draggedThumb = null;
  });
  thumb.addEventListener('dragover', (e) => {
    if (!_draggedThumb || _draggedThumb === thumb) return;
    // 같은 그리드 안에서만 순서 변경 허용 (교재 ↔ 활동 이미지 섞이지 않게)
    if (_draggedThumb.parentNode !== thumb.parentNode) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    thumb.classList.add('drag-over');
  });
  thumb.addEventListener('dragleave', () => {
    thumb.classList.remove('drag-over');
  });
  thumb.addEventListener('drop', (e) => {
    if (!_draggedThumb || _draggedThumb === thumb) return;
    if (_draggedThumb.parentNode !== thumb.parentNode) return;
    e.preventDefault();
    const rect = thumb.getBoundingClientRect();
    const before = (e.clientX - rect.left) < rect.width / 2;
    if (before) thumb.parentNode.insertBefore(_draggedThumb, thumb);
    else thumb.parentNode.insertBefore(_draggedThumb, thumb.nextElementSibling);
    thumb.classList.remove('drag-over');
  });
}
// ── 첨부파일 ──
const MAX_ATTACH_SIZE = 20 * 1024 * 1024; // 20MB

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = { pptx:'📊', ppt:'📊', pdf:'📄', hwp:'📝', hwpx:'📝', doc:'📝', docx:'📝', xls:'📈', xlsx:'📈', zip:'🗜️' };
  return map[ext] || '📎';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

async function addAttachments(input) {
  const files = Array.from(input.files);
  input.value = '';
  for (const file of files) {
    if (file.size > MAX_ATTACH_SIZE) {
      showToast(`❌ ${file.name}: 20MB를 초과합니다 (${formatFileSize(file.size)})`);
      continue;
    }
    await uploadAttachment(file);
  }
}

async function uploadAttachment(file) {
  const container = document.getElementById('ed-attachments');
  // 플레이스홀더
  const placeholder = document.createElement('div');
  placeholder.className = 'attach-item';
  placeholder.style.opacity = '0.6';
  placeholder.innerHTML = `<span class="attach-icon">⬆️</span><div class="attach-info"><div class="attach-name">업로드 중... ${escHtml(file.name)}</div></div>`;
  container.appendChild(placeholder);

  try {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const safeFileName = `attach_${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const { data, error } = await _sb.storage
      .from('lesson-images')
      .upload(safeFileName, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;

    const { data: urlData } = _sb.storage.from('lesson-images').getPublicUrl(safeFileName);
    container.removeChild(placeholder);
    addAttachmentRow(file.name, urlData.publicUrl, file.size);
    showToast(`✅ ${file.name} 업로드 완료`);
  } catch(e) {
    console.error('파일 업로드 실패:', e);
    container.removeChild(placeholder);
    showToast(`❌ ${file.name} 업로드 실패`);
  }
}

// ── Accordion helpers ──
function toggleAccordion(id) {
  document.getElementById(id).classList.toggle('open');
}
function updateAccordionBadge(badgeId, count) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  badge.textContent = count;
  badge.className = 'accordion-badge' + (count === 0 ? ' empty' : '');
}
function refreshTextbookBadge() {
  const grid = document.getElementById('ed-textbook-imgs');
  const count = grid ? grid.querySelectorAll('.img-thumb').length : 0;
  updateAccordionBadge('acc-textbook-badge', count);
}
function refreshAttachBadge() {
  const container = document.getElementById('ed-attachments');
  const count = container ? container.querySelectorAll('.attach-item').length : 0;
  updateAccordionBadge('acc-attach-badge', count);
}
function refreshLinksBadge() {
  const container = document.getElementById('ed-links');
  const count = container ? container.querySelectorAll('.link-row').length : 0;
  updateAccordionBadge('acc-links-badge', count);
}
function openAccordionIfContent(id, count) {
  const sec = document.getElementById(id);
  if (!sec) return;
  if (count > 0) sec.classList.add('open');
  else sec.classList.remove('open');
}
function resetAllAccordions() {
  ['acc-textbook','acc-attach','acc-links'].forEach(id => {
    const sec = document.getElementById(id);
    if (sec) sec.classList.remove('open');
  });
  updateAccordionBadge('acc-textbook-badge', 0);
  updateAccordionBadge('acc-attach-badge', 0);
  updateAccordionBadge('acc-links-badge', 0);
}

function addAttachmentRow(name, url, size) {
  const container = document.getElementById('ed-attachments');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'attach-item';
  div.dataset.url = url;
  div.dataset.name = name;
  div.dataset.size = size || 0;
  div.innerHTML = `
    <span class="attach-icon">${getFileIcon(name)}</span>
    <div class="attach-info">
      <div class="attach-name">${escHtml(name)}</div>
      <div class="attach-size">${formatFileSize(size)}</div>
    </div>
    <button class="attach-del" title="삭제" onclick="removeAttachment(this, '${url}')">×</button>
  `;
  container.appendChild(div);
  refreshAttachBadge();
}

async function removeAttachment(btn, url) {
  btn.closest('.attach-item').remove();
  refreshAttachBadge();
  try {
    const fileName = url.split('/').pop().split('?')[0];
    await _sb.storage.from('lesson-images').remove([fileName]);
  } catch(e) { console.warn('파일 삭제 실패:', e); }
}

// ── 교재 이미지 (에디터용) ──
async function addTextbookImages(input) {
  const files = Array.from(input.files);
  input.value = '';
  for (const file of files) {
    await addTextbookImage(file);
  }
}

async function addTextbookImage(file) {
  const grid = document.getElementById('ed-textbook-imgs');
  const placeholder = document.createElement('div');
  placeholder.className = 'img-thumb';
  placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-500);background:#f3f4f6;flex-direction:column;gap:4px';
  placeholder.innerHTML = '<div style="font-size:18px">⬆️</div><div>업로드 중...</div>';
  if (grid) grid.appendChild(placeholder);

  try {
    const dataUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
    const compressed = await compressImage(dataUrl);
    const res = await fetch(compressed);
    const blob = await res.blob();

    const fileName = `tb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { data, error } = await _sb.storage
      .from('lesson-images')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;

    const { data: urlData } = _sb.storage.from('lesson-images').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    if (grid && grid.contains(placeholder)) grid.removeChild(placeholder);
    addTextbookImgPreview(publicUrl);
    showToast('✅ 교재 이미지 업로드 완료');
  } catch(e) {
    console.error('교재 이미지 업로드 실패:', e);
    if (grid && grid.contains(placeholder)) grid.removeChild(placeholder);
    showToast('❌ 이미지 업로드 실패. Storage 버킷을 확인해주세요.');
  }
}

function addTextbookImgPreview(url) {
  const grid = document.getElementById('ed-textbook-imgs');
  if (!grid) return;
  const div = document.createElement('div');
  div.className = 'img-thumb';
  div.dataset.src = url;
  const img = document.createElement('img');
  img.src = url;
  img.title = '클릭하여 크게 보기';
  img.onclick = () => openLightbox(url);
  const delBtn = document.createElement('button');
  delBtn.className = 'img-thumb-del';
  delBtn.title = '삭제';
  delBtn.textContent = '×';
  delBtn.onclick = async () => {
    div.remove();
    updateTextbookHint();
    try {
      const fileName = url.split('/').pop().split('?')[0];
      await _sb.storage.from('lesson-images').remove([fileName]);
    } catch(e) { console.warn('Storage 이미지 삭제 실패:', e); }
  };
  div.appendChild(img);
  div.appendChild(delBtn);
  grid.appendChild(div);
  _attachThumbDragEvents(div);
  updateTextbookHint();
}

function updateTextbookHint() {
  const grid = document.getElementById('ed-textbook-imgs');
  const hint = document.getElementById('ed-textbook-hint');
  if (!grid || !hint) return;
  hint.style.display = grid.children.length === 0 ? 'block' : 'none';
  refreshTextbookBadge();
}

// 붙여넣기 포커스 영역 활성화
let _textbookPasteActive = false;
function focusTextbookZone() {
  const zone = document.getElementById('ed-textbook-paste-zone');
  if (!zone) return;
  _textbookPasteActive = true;
  zone.style.borderColor = 'var(--primary)';
  zone.style.background = 'rgba(99,102,241,.04)';
  showToast('📋 이제 Ctrl+V로 스크린샷을 붙여넣을 수 있어요');
}

// 전역 paste 이벤트 - 교재 이미지 영역 활성화 시만 동작
document.addEventListener('paste', async (e) => {
  if (!_textbookPasteActive) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        showToast('📋 스크린샷 업로드 중...');
        await addTextbookImage(file);
      }
      break;
    }
  }
  // 한 번 붙여넣기 후 포커스 해제
  _textbookPasteActive = false;
  const zone = document.getElementById('ed-textbook-paste-zone');
  if (zone) { zone.style.borderColor = ''; zone.style.background = ''; }
});

// 다른 곳 클릭 시 붙여넣기 모드 해제
document.addEventListener('click', (e) => {
  if (_textbookPasteActive && !e.target.closest('#ed-textbook-paste-zone')) {
    _textbookPasteActive = false;
    const zone = document.getElementById('ed-textbook-paste-zone');
    if (zone) { zone.style.borderColor = ''; zone.style.background = ''; }
  }
});
