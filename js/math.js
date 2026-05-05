// ── 수식(KaTeX) 렌더링 ──
// span.math[data-latex]를 찾아 KaTeX로 렌더링. 이미 렌더링된 것은 건너뜀.
function renderMathIn(container) {
  if (!container || typeof katex === 'undefined') return;
  container.querySelectorAll('span.math[data-latex]').forEach(el => {
    if (el.dataset.rendered === '1') return;
    const latex = el.getAttribute('data-latex') || '';
    try {
      katex.render(latex, el, { throwOnError: false, displayMode: false, output: 'html' });
      el.dataset.rendered = '1';
      el.setAttribute('contenteditable', 'false');
    } catch (e) {
      el.textContent = latex;
    }
  });
}

// KaTeX 로드 지연 시 재시도용
function _scheduleMathRender(container) {
  if (!container) return;
  const tryRender = () => {
    if (typeof katex !== 'undefined') {
      renderMathIn(container);
    } else {
      setTimeout(tryRender, 200);
    }
  };
  tryRender();
}

// ── 수식 편집 모달 로직 ──
let _mathEditorState = null; // { editor, savedRange, editingSpan }

function openMathEditorForResearch(btn) {
  const wrap = btn.closest('.activity-editor');
  if (!wrap) return;
  const editor = wrap.querySelector('.act-research');
  if (!editor) return;
  editor.focus();
  // 현재 커서 위치 저장 (활동 연구 에디터 내부일 때만)
  const sel = window.getSelection();
  let savedRange = null;
  let editingSpan = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (editor.contains(r.commonAncestorContainer)) {
      savedRange = r.cloneRange();
      // 커서가 기존 수식 span 안에 있는지 확인 (편집 모드 자동 진입)
      let node = r.startContainer;
      while (node && node !== editor) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('math')) {
          editingSpan = node;
          break;
        }
        node = node.parentNode;
      }
    }
  }
  _openMathModal({ editor, savedRange, editingSpan, initialLatex: editingSpan ? (editingSpan.getAttribute('data-latex') || '') : '' });
}

function _openMathModal(state) {
  _mathEditorState = state;
  const modal = document.getElementById('math-editor-modal');
  if (!modal) return;
  const mf = document.getElementById('math-editor-field');
  // 삭제 버튼은 기존 수식 편집 시에만
  const delBtn = document.getElementById('math-btn-delete');
  if (delBtn) delBtn.style.display = state.editingSpan ? 'inline-block' : 'none';
  // MathLive가 아직 로드 안 됐다면 잠깐 대기
  const mountField = () => {
    if (mf && typeof mf.setValue === 'function') {
      mf.setValue(state.initialLatex || '');
    } else if (mf) {
      mf.value = state.initialLatex || '';
    }
    setTimeout(() => { if (mf && mf.focus) mf.focus(); }, 80);
  };
  modal.classList.add('open');
  if (typeof customElements !== 'undefined' && customElements.get && customElements.get('math-field')) {
    mountField();
  } else {
    // MathLive 로드 대기
    let tries = 0;
    const wait = setInterval(() => {
      tries++;
      if (typeof customElements !== 'undefined' && customElements.get && customElements.get('math-field')) {
        clearInterval(wait);
        mountField();
      } else if (tries > 50) {
        clearInterval(wait);
        mountField();
      }
    }, 100);
  }
}

function closeMathEditor() {
  const modal = document.getElementById('math-editor-modal');
  if (modal) modal.classList.remove('open');
  _mathEditorState = null;
}

function confirmMathEditor() {
  const mf = document.getElementById('math-editor-field');
  let latex = '';
  if (mf) {
    if (typeof mf.getValue === 'function') latex = mf.getValue('latex') || '';
    else latex = mf.value || '';
  }
  latex = (latex || '').trim();
  const state = _mathEditorState;
  if (!latex) { closeMathEditor(); return; }
  if (!state || !state.editor) { closeMathEditor(); return; }
  if (latex.length > _MATH_LATEX_MAX) latex = latex.slice(0, _MATH_LATEX_MAX);
  const editor = state.editor;
  const span = document.createElement('span');
  span.className = 'math';
  span.setAttribute('data-latex', latex);
  span.setAttribute('contenteditable', 'false');
  if (state.editingSpan) {
    state.editingSpan.replaceWith(span);
  } else if (state.savedRange) {
    state.savedRange.deleteContents();
    state.savedRange.insertNode(span);
    // 수식 뒤에 공백 추가하고 커서를 그 뒤로 이동
    const space = document.createTextNode(' ');
    if (span.parentNode) span.parentNode.insertBefore(space, span.nextSibling);
    const newRange = document.createRange();
    newRange.setStart(space, 1);
    newRange.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
  } else {
    editor.appendChild(span);
  }
  renderMathIn(editor);
  // 빈 상태 표시 갱신용 input 이벤트 발생
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  closeMathEditor();
  editor.focus();
}

function deleteMathEditor() {
  const state = _mathEditorState;
  if (!state || !state.editingSpan) { closeMathEditor(); return; }
  const editor = state.editor;
  state.editingSpan.remove();
  if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
  closeMathEditor();
  if (editor) editor.focus();
}

// 활동 연구 에디터 안의 수식 span을 더블클릭하면 편집 모드로 진입
document.addEventListener('dblclick', function(e) {
  const span = e.target && e.target.closest && e.target.closest('span.math');
  if (!span) return;
  const editor = span.closest('.act-research');
  if (!editor || !editor.isContentEditable) return;
  e.preventDefault();
  const range = document.createRange();
  range.selectNode(span);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  _openMathModal({
    editor,
    savedRange: range,
    editingSpan: span,
    initialLatex: span.getAttribute('data-latex') || ''
  });
});

// 모달 배경 클릭으로 닫기 + 프리셋 버튼 → 입력란에 LaTeX 추가
document.addEventListener('click', function(e) {
  // 배경 클릭 (가상 키보드 클릭은 제외)
  const modal = document.getElementById('math-editor-modal');
  if (modal && e.target === modal) {
    const vk = document.getElementById('mathlive-virtual-keyboard-container');
    if (vk && vk.contains(e.target)) return;
    closeMathEditor();
    return;
  }
  // 프리셋 버튼 클릭
  const preset = e.target && e.target.closest && e.target.closest('.math-preset-btn');
  if (preset) {
    const latex = preset.getAttribute('data-latex') || '';
    const mf = document.getElementById('math-editor-field');
    if (mf && typeof mf.executeCommand === 'function') {
      try { mf.executeCommand(['insert', latex]); }
      catch(_) { mf.value = (mf.value || '') + latex; }
    } else if (mf) {
      mf.value = (mf.value || '') + latex;
    }
    if (mf && mf.focus) mf.focus();
  }
});

// ESC로 모달 닫기
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('math-editor-modal');
    if (modal && modal.classList.contains('open')) {
      e.preventDefault();
      closeMathEditor();
    }
  }
});
