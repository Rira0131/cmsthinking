// ── 도형 그리기 에디터 ──
let _fabricCanvas = null;
let _drawingState = null; // { actId }
let _currentTool = 'pencil';
let _currentColor = '#111827';
let _currentStroke = 2;
let _currentFill = false;
let _undoStack = [];
let _drawStartX = 0;
let _drawStartY = 0;
let _tempShape = null;
let _isPointerDown = false;

function openDrawingModal(btn) {
  const wrap = btn.closest('.activity-editor');
  if (!wrap) return;
  const actId = wrap.id.replace('act-', '');
  _drawingState = { actId };
  const modal = document.getElementById('drawing-modal');
  if (!modal) return;
  modal.classList.add('open');
  _initFabric();
}

function closeDrawingModal() {
  const modal = document.getElementById('drawing-modal');
  if (modal) modal.classList.remove('open');
  _drawingState = null;
  _undoStack = [];
  _tempShape = null;
  _isPointerDown = false;
  if (_fabricCanvas) {
    _fabricCanvas.dispose();
    _fabricCanvas = null;
  }
}

async function confirmDrawingModal() {
  if (!_fabricCanvas || !_drawingState) { closeDrawingModal(); return; }
  if (_fabricCanvas.getObjects().length === 0) { closeDrawingModal(); return; }
  const state = _drawingState;
  const dataUrl = _fabricCanvas.toDataURL({ format: 'png' });
  closeDrawingModal();
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = `drawing_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { data, error } = await _sb.storage
      .from('lesson-images')
      .upload(fileName, blob, { contentType: 'image/png', upsert: false });
    if (error) throw error;
    const { data: urlData } = _sb.storage.from('lesson-images').getPublicUrl(fileName);
    addImgPreview(state.actId, urlData.publicUrl);
    showToast('✅ 도형이 이미지로 삽입되었습니다');
  } catch(e) {
    console.error('도형 업로드 실패:', e);
    showToast('❌ 도형 삽입에 실패했습니다');
  }
}

function _initFabric() {
  const tryInit = () => {
    if (typeof fabric === 'undefined') { setTimeout(tryInit, 100); return; }
    const el = document.getElementById('drawing-canvas');
    if (!el) return;
    if (_fabricCanvas) { _fabricCanvas.dispose(); }

    // 캔버스 너비를 모달 박스에 맞게 조정
    const box = document.querySelector('.drawing-modal-box');
    const canvasW = box ? Math.min(box.clientWidth - 40, 540) : 520;

    _fabricCanvas = new fabric.Canvas('drawing-canvas', {
      width: canvasW,
      height: 400,
      backgroundColor: '#ffffff',
      selection: false
    });
    _undoStack = [];
    _currentTool = 'pencil';
    _currentColor = '#111827';
    _currentStroke = 2;
    _currentFill = false;
    _tempShape = null;
    _isPointerDown = false;
    _applyTool();
    _setupFabricEvents();
    _updateDrawingToolbarUI();
  };
  // Fabric.js가 로드될 때까지 잠깐 기다림
  setTimeout(tryInit, 50);
}

function _pushUndo() {
  if (!_fabricCanvas) return;
  _undoStack.push(_fabricCanvas.toJSON());
  if (_undoStack.length > 20) _undoStack.shift();
}

function _applyTool() {
  if (!_fabricCanvas) return;
  if (_currentTool === 'pencil') {
    _fabricCanvas.isDrawingMode = true;
    _fabricCanvas.selection = false;
    _fabricCanvas.freeDrawingBrush.color = _currentColor;
    _fabricCanvas.freeDrawingBrush.width = _currentStroke;
  } else if (_currentTool === 'eraser') {
    _fabricCanvas.isDrawingMode = true;
    _fabricCanvas.selection = false;
    _fabricCanvas.freeDrawingBrush.color = '#ffffff';
    _fabricCanvas.freeDrawingBrush.width = _currentStroke * 8;
  } else if (_currentTool === 'select') {
    _fabricCanvas.isDrawingMode = false;
    _fabricCanvas.selection = true;
    _fabricCanvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
  } else {
    // line, rect, circle, text — pointer events handled manually
    _fabricCanvas.isDrawingMode = false;
    _fabricCanvas.selection = false;
    _fabricCanvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; });
  }
  _fabricCanvas.renderAll();
}

function _setupFabricEvents() {
  if (!_fabricCanvas) return;

  _fabricCanvas.on('mouse:down', (opt) => {
    if (['pencil', 'eraser', 'select'].includes(_currentTool)) return;
    _isPointerDown = true;
    const p = _fabricCanvas.getPointer(opt.e);
    _drawStartX = p.x;
    _drawStartY = p.y;

    if (_currentTool === 'text') {
      _isPointerDown = false;
      _pushUndo();
      const t = new fabric.IText('텍스트', {
        left: p.x, top: p.y,
        fontSize: 14, fill: _currentColor, fontFamily: 'Arial',
        selectable: true, evented: true
      });
      _fabricCanvas.add(t);
      _fabricCanvas.setActiveObject(t);
      t.enterEditing();
      t.selectAll();
      return;
    }

    const shapeOpts = {
      stroke: _currentColor,
      strokeWidth: _currentStroke,
      fill: _currentFill ? _currentColor : 'transparent',
      selectable: false, evented: false,
      strokeUniform: true
    };

    if (_currentTool === 'line') {
      _tempShape = new fabric.Line([p.x, p.y, p.x, p.y], shapeOpts);
    } else if (_currentTool === 'rect') {
      _tempShape = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, ...shapeOpts });
    } else if (_currentTool === 'circle') {
      _tempShape = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, ...shapeOpts });
    }
    if (_tempShape) {
      _fabricCanvas.add(_tempShape);
      _fabricCanvas.renderAll();
    }
  });

  _fabricCanvas.on('mouse:move', (opt) => {
    if (!_isPointerDown || !_tempShape) return;
    const p = _fabricCanvas.getPointer(opt.e);
    if (_currentTool === 'line') {
      _tempShape.set({ x2: p.x, y2: p.y });
    } else if (_currentTool === 'rect') {
      const w = p.x - _drawStartX;
      const h = p.y - _drawStartY;
      _tempShape.set({
        left: w < 0 ? p.x : _drawStartX,
        top: h < 0 ? p.y : _drawStartY,
        width: Math.abs(w),
        height: Math.abs(h)
      });
    } else if (_currentTool === 'circle') {
      const rx = Math.abs(p.x - _drawStartX) / 2;
      const ry = Math.abs(p.y - _drawStartY) / 2;
      _tempShape.set({
        left: Math.min(p.x, _drawStartX),
        top: Math.min(p.y, _drawStartY),
        rx, ry
      });
    }
    _fabricCanvas.renderAll();
  });

  _fabricCanvas.on('mouse:up', () => {
    if (_isPointerDown && _tempShape) {
      _pushUndo();
      _tempShape.set({ selectable: false, evented: false });
      _fabricCanvas.discardActiveObject();
      _fabricCanvas.renderAll();
    }
    _isPointerDown = false;
    _tempShape = null;
  });

  // 자유스케치 완료 시 undo 스택에 저장
  _fabricCanvas.on('path:created', () => { _pushUndo(); });
}

function _updateDrawingToolbarUI() {
  document.querySelectorAll('.dt-tool[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === _currentTool);
  });
  document.querySelectorAll('.dc-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === _currentColor);
  });
  document.querySelectorAll('.ds-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.width) === _currentStroke);
  });
  const fillBtn = document.getElementById('dt-fill');
  if (fillBtn) fillBtn.classList.toggle('active', _currentFill);
}

function setDrawingTool(tool) {
  _currentTool = tool;
  if (_fabricCanvas) _applyTool();
  _updateDrawingToolbarUI();
}

function setDrawingColor(color) {
  _currentColor = color;
  if (_fabricCanvas) _applyTool();
  _updateDrawingToolbarUI();
}

function setDrawingStroke(width) {
  _currentStroke = parseInt(width);
  if (_fabricCanvas) _applyTool();
  _updateDrawingToolbarUI();
}

function toggleDrawingFill() {
  _currentFill = !_currentFill;
  _updateDrawingToolbarUI();
}

function undoDrawing() {
  if (!_fabricCanvas || _undoStack.length === 0) return;
  const prev = _undoStack.pop();
  _fabricCanvas.loadFromJSON(prev, () => { _fabricCanvas.renderAll(); });
}

function clearDrawingCanvas() {
  if (!_fabricCanvas) return;
  _pushUndo();
  _fabricCanvas.clear();
  _fabricCanvas.backgroundColor = '#ffffff';
  _fabricCanvas.renderAll();
}

// ── 기본 도형 프리셋 ──
function insertPresetShape(id) {
  if (!_fabricCanvas) return;
  const c = _currentColor;
  const sw = _currentStroke;
  const fill = _currentFill ? c : 'transparent';
  const O = { stroke: c, strokeWidth: sw, fill, strokeLineJoin: 'miter' };
  const L = { stroke: c, strokeWidth: sw, fill: 'transparent' };

  let obj = null;

  switch (id) {
    // ── 2D ──
    case 'triangle':
      obj = new fabric.Polygon([{x:40,y:0},{x:0,y:70},{x:80,y:70}], O);
      break;

    case 'right-triangle':
      obj = new fabric.Polygon([{x:0,y:0},{x:0,y:70},{x:70,y:70}], O);
      break;

    // ── 3D ──
    case 'cube': {
      // 정면·윗면·오른쪽 면 (cabinet projection)
      const [s, d] = [56, 22];
      obj = new fabric.Group([
        new fabric.Polygon([{x:0,y:d},{x:s,y:d},{x:s,y:d+s},{x:0,y:d+s}], O),
        new fabric.Polygon([{x:0,y:d},{x:d,y:0},{x:s+d,y:0},{x:s,y:d}], O),
        new fabric.Polygon([{x:s,y:d},{x:s+d,y:0},{x:s+d,y:s},{x:s,y:d+s}], O),
      ]);
      break;
    }

    case 'cuboid': {
      // 정육면체보다 가로가 넓음
      const [fw, fh, d] = [65, 50, 16];
      obj = new fabric.Group([
        new fabric.Polygon([{x:0,y:d},{x:fw,y:d},{x:fw,y:d+fh},{x:0,y:d+fh}], O),
        new fabric.Polygon([{x:0,y:d},{x:d,y:0},{x:fw+d,y:0},{x:fw,y:d}], O),
        new fabric.Polygon([{x:fw,y:d},{x:fw+d,y:0},{x:fw+d,y:fh},{x:fw,y:d+fh}], O),
      ]);
      break;
    }

    case 'cylinder': {
      const rx = 34, ry = 10, ty = 10, by = 72;
      obj = new fabric.Group([
        new fabric.Ellipse({ left:2, top:0, rx, ry, stroke:c, strokeWidth:sw, fill }),
        new fabric.Ellipse({ left:2, top:by-ry, rx, ry, stroke:c, strokeWidth:sw, fill }),
        new fabric.Line([2, ty, 2, by], L),
        new fabric.Line([2+rx*2, ty, 2+rx*2, by], L),
      ]);
      break;
    }

    case 'cone': {
      const rx = 34, ry = 10, by = 72, ax = 36, ay = 5;
      obj = new fabric.Group([
        new fabric.Ellipse({ left:2, top:by-ry, rx, ry, stroke:c, strokeWidth:sw, fill }),
        new fabric.Line([2, by, ax, ay], L),
        new fabric.Line([2+rx*2, by, ax, ay], L),
      ]);
      break;
    }

    case 'sphere': {
      const r = 37;
      obj = new fabric.Group([
        new fabric.Circle({ left:1, top:1, radius:r, stroke:c, strokeWidth:sw, fill }),
        // 적도 타원
        new fabric.Ellipse({ left:1, top:r-11, rx:r, ry:11, stroke:c, strokeWidth:sw, fill:'transparent' }),
      ]);
      break;
    }

    case 'tri-prism': {
      // 삼각기둥 — 두 삼각형 단면 + 3개 연결선 (옆으로 누운 형태)
      obj = new fabric.Group([
        new fabric.Polygon([{x:0,y:0},{x:0,y:68},{x:36,y:34}], O),
        new fabric.Polygon([{x:50,y:0},{x:50,y:68},{x:86,y:34}], O),
        new fabric.Line([0,0,50,0], L),
        new fabric.Line([0,68,50,68], L),
        new fabric.Line([36,34,86,34], L),
      ]);
      break;
    }

    case 'sq-pyramid': {
      // 사각뿔 — 바닥 평행사변형 + 꼭짓점 4개 선
      obj = new fabric.Group([
        new fabric.Polygon([{x:0,y:62},{x:60,y:62},{x:80,y:42},{x:20,y:42}], O),
        new fabric.Line([0,62,40,5], L),
        new fabric.Line([60,62,40,5], L),
        new fabric.Line([80,42,40,5], L),
        new fabric.Line([20,42,40,5], L),
      ]);
      break;
    }

    default: return;
  }

  if (!obj) return;
  _pushUndo();
  const cx = _fabricCanvas.width / 2;
  const cy = _fabricCanvas.height / 2;
  obj.set({ left: cx, top: cy, originX: 'center', originY: 'center' });
  _fabricCanvas.add(obj);
  _fabricCanvas.setActiveObject(obj);
  _fabricCanvas.renderAll();
  // 삽입 후 선택 모드로 자동 전환 (바로 이동/크기 조절 가능)
  setDrawingTool('select');
}

// 도형 툴바 이벤트 위임
document.addEventListener('click', (e) => {
  const modal = document.getElementById('drawing-modal');
  if (!modal || !modal.classList.contains('open')) return;

  if (e.target === modal) { closeDrawingModal(); return; }

  const toolBtn = e.target.closest('.dt-tool[data-tool]');
  if (toolBtn) { setDrawingTool(toolBtn.dataset.tool); return; }

  const colorBtn = e.target.closest('.dc-btn');
  if (colorBtn) { setDrawingColor(colorBtn.dataset.color); return; }

  const strokeBtn = e.target.closest('.ds-btn');
  if (strokeBtn) { setDrawingStroke(strokeBtn.dataset.width); return; }

  if (e.target.closest('#dt-fill')) { toggleDrawingFill(); return; }
  if (e.target.closest('#dt-undo')) { undoDrawing(); return; }
  if (e.target.closest('#dt-clear')) { clearDrawingCanvas(); return; }

  const shapeBtn = e.target.closest('.dp-btn');
  if (shapeBtn) { insertPresetShape(shapeBtn.dataset.shape); return; }
});

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('drawing-modal');
  if (!modal || !modal.classList.contains('open')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeDrawingModal();
    return;
  }
  // 선택 모드에서 Delete/Backspace로 선택 객체 삭제
  if ((e.key === 'Delete' || e.key === 'Backspace') && _fabricCanvas) {
    const activeObj = _fabricCanvas.getActiveObject();
    // IText 편집 중이면 일반 텍스트 편집 허용
    if (activeObj && activeObj.type === 'i-text' && activeObj.isEditing) return;
    if (activeObj) {
      e.preventDefault();
      _pushUndo();
      _fabricCanvas.remove(activeObj);
      _fabricCanvas.discardActiveObject();
      _fabricCanvas.renderAll();
    }
  }
  // Ctrl+Z로 실행 취소
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undoDrawing();
  }
});
