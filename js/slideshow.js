// ── 슬라이드쇼 ──
let _slides = [];
let _slideIdx = 0;
let _textbookImages = [];
let _textbookPanelOpen = false;

function startSlideshow(lessonId) {
  const l = getAllLessons().find(x => x.id === lessonId);
  if (!l) return;

  const acts = (l.activities || []).filter(a =>
    !['수업 목표','교과 연계','CMS과정 연계'].includes(a.name)
  );

  _slides = [];

  // 슬라이드 1: 타이틀 + 목표
  _slides.push({ type: 'title', lesson: l });

  // 슬라이드 2~: 활동별
  acts.forEach((a, i) => {
    _slides.push({ type: 'activity', act: a, num: i + 1, total: acts.length });
  });

  // 교재 이미지 세팅
  _textbookImages = l.textbook_images || [];
  _textbookPanelOpen = false;
  const bookBtn = document.getElementById('slide-book-btn');
  const panel = document.getElementById('textbook-panel');
  bookBtn.style.display = _textbookImages.length > 0 ? '' : 'none';
  bookBtn.classList.remove('active');
  panel.classList.remove('open');
  // 교재 이미지 패널 내용 채우기
  const tbList = document.getElementById('tb-imgs-list');
  tbList.innerHTML = '';
  if (_textbookImages.length === 0) {
    tbList.innerHTML = '<div class="tb-empty">등록된 교재 이미지가 없습니다</div>';
  } else {
    _textbookImages.forEach(src => {
      const wrap = document.createElement('div');
      wrap.className = 'tb-img-wrap';
      const img = document.createElement('img');
      img.src = src;
      img.onclick = () => openLightbox(src);
      wrap.appendChild(img);
      tbList.appendChild(wrap);
    });
  }

  document.getElementById('slide-lesson-title').textContent = l.title;
  _slideIdx = 0;
  renderSlide();
  // [신규] 마지막에 사용한 테마(라이트/다크) 복원. 기본값은 라이트.
  applySlideshowTheme(localStorage.getItem('cms_slide_theme') || 'light');
  const ov = document.getElementById('slideshow-overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';

  // [신규] 키 이벤트 수신을 위해 오버레이에 포커스 부여
  // 무선 프레젠터의 키 입력이 풀스크린/포커스 위치에 따라 누락되는 것을 방지
  ov.setAttribute('tabindex', '-1');
  setTimeout(() => ov.focus(), 60);

  // 전체화면 시도
  if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
}

function applySlideshowTheme(theme) {
  const overlay = document.getElementById('slideshow-overlay');
  const btn = document.getElementById('slide-theme-btn');
  if (!overlay) return;
  if (theme === 'dark') {
    overlay.classList.add('theme-dark');
    if (btn) btn.textContent = '☀️ 라이트';
  } else {
    overlay.classList.remove('theme-dark');
    if (btn) btn.textContent = '🌙 다크';
  }
}

function toggleSlideshowTheme() {
  const overlay = document.getElementById('slideshow-overlay');
  const isDark = overlay.classList.contains('theme-dark');
  const next = isDark ? 'light' : 'dark';
  applySlideshowTheme(next);
  localStorage.setItem('cms_slide_theme', next);
}

function toggleTextbookPanel() {
  _textbookPanelOpen = !_textbookPanelOpen;
  const panel = document.getElementById('textbook-panel');
  const btn = document.getElementById('slide-book-btn');
  if (_textbookPanelOpen) {
    panel.classList.add('open');
    btn.classList.add('active');
  } else {
    panel.classList.remove('open');
    btn.classList.remove('active');
  }
}

function closeSlideshow() {
  closeSlideVideo();
  if (typeof closeSlideLightbox === 'function') closeSlideLightbox();
  _slideVideoIdx.clear();
  document.getElementById('slideshow-overlay').classList.remove('open');
  document.getElementById('textbook-panel').classList.remove('open');
  document.getElementById('slide-book-btn').classList.remove('active');
  _textbookPanelOpen = false;
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// ── 발표 중 영상 인라인 재생 ──
// 흐름: 활동 카드 도착 → 포인터 한 번 → 영상1 모달 → 한 번 더 → 영상2 모달 → ... → 다음 슬라이드
const _slideVideoIdx = new Map();   // slideIdx → 마지막에 본 video 번호 (-1 = 시작 전)
let _videoModalOpen = false;

function _imagesOnCurrentSlide() {
  const s = _slides[_slideIdx];
  if (!s || s.type !== 'activity') return [];
  return (s.act && s.act.images) || [];
}

// 슬라이드 카드가 화면보다 크면 transform:scale로 자동 축소해 한 화면에 맞춘다.
// 콘텐츠가 너무 길면 0.55까지만 축소(가독성 보호) 후 카드 내부 스크롤로 대체.
function _autofitSlideContent() {
  const area = document.getElementById('slide-area');
  if (!area) return;
  const content = area.querySelector('.slide-content');
  if (!content) return;
  // 변환 초기화 후 실제 크기 측정 (transform이 측정에 영향 주지 않게)
  content.style.transform = 'none';
  // 강제 reflow로 정확한 측정값 보장
  void content.offsetHeight;
  const aw = Math.max(0, area.clientWidth - 16);
  const ah = Math.max(0, area.clientHeight - 16);
  // scrollHeight/Width = 콘텐츠의 실제 크기
  const ch = content.scrollHeight;
  const cw = content.scrollWidth;
  let s = 1;
  if (ch > ah) s = Math.min(s, ah / ch);
  if (cw > aw) s = Math.min(s, aw / cw);
  if (s < 1) {
    if (s < 0.55) s = 0.55;   // 가독성 하한
    content.style.transform = `scale(${s})`;
    content.style.transformOrigin = 'center center';
  }
}

// 현재 라이트박스 인덱스를 썸네일 강조 표시에 반영
function _updateThumbHighlight() {
  const imgs = document.querySelectorAll('.slide-act-imgs img');
  imgs.forEach((img, i) => {
    img.classList.toggle('is-current', i === _slideLightboxIdx);
  });
}

// 활동 슬라이드에서 인덱스로 라이트박스 열기 (썸네일 클릭 또는 포인터에서 사용)
function openSlideImageAt(idx) {
  const imgs = _imagesOnCurrentSlide();
  if (idx < 0 || idx >= imgs.length) return;
  _slideLightboxIdx = idx;
  if (typeof openLightbox === 'function') openLightbox(imgs[idx]);
  _updateThumbHighlight();
}

// 라이트박스 영역 클릭 시 동작
//   슬라이드쇼 모드(이미지 시퀀스 중)에는 → 다음 이미지로 진행 (닫지 않음)
//   일반 모드에서는 → 닫기 (기존 동작 유지)
function onLightboxClick(e) {
  // X 버튼 클릭은 자체에서 stopPropagation으로 처리됨
  const overlay = document.getElementById('slideshow-overlay');
  const inSlideshow = overlay && overlay.classList.contains('open') && _slideLightboxIdx >= 0;
  if (inSlideshow) {
    if (typeof slideMove === 'function') slideMove(1);
  } else {
    closeSlideLightbox();
  }
}

// 라이트박스 닫고 슬라이드 시퀀스 상태 리셋
function closeSlideLightbox() {
  const lb = document.getElementById('img-lightbox');
  if (lb) lb.classList.remove('open');
  _slideLightboxIdx = -1;
  _updateThumbHighlight();
}

// 유튜브/Vimeo URL → 임베드 URL. 변환 불가능한 URL은 null 반환.
function _videoEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,15})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`;
  const vmMatch = String(url).match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=1`;
  return null;
}

// 현재 슬라이드의 모든 임베드 가능 URL 배열을 가져옴 (등록 순서)
function _embedUrlsOnCurrentSlide() {
  const s = _slides[_slideIdx];
  if (!s || s.type !== 'activity') return [];
  const links = (s.act && s.act.links) || [];
  return links.map(lk => _videoEmbedUrl(lk.url)).filter(Boolean);
}
// 하위 호환 — 첫 임베드 URL 반환
function _firstEmbeddableLinkOnCurrentSlide() {
  return _embedUrlsOnCurrentSlide()[0] || null;
}

function openSlideVideo(embedUrl) {
  const modal = document.getElementById('slide-video-modal');
  const iframe = document.getElementById('slide-video-iframe');
  if (!modal || !iframe) return;
  iframe.src = embedUrl;
  modal.classList.add('open');
  _videoModalOpen = true;
}

function closeSlideVideo() {
  const modal = document.getElementById('slide-video-modal');
  const iframe = document.getElementById('slide-video-iframe');
  if (!modal || !iframe) return;
  iframe.src = '';   // 영상 즉시 정지
  modal.classList.remove('open');
  _videoModalOpen = false;
}

function slideMove(dir) {
  // 발표 흐름: 슬라이드에 영상이 N개 있으면 포인터 누를 때마다 영상1 → 영상2 → ... → 다음 슬라이드.
  //   영상 없는 슬라이드는 한 번에 다음 슬라이드로 이동.
  const videos = _embedUrlsOnCurrentSlide();
  const curIdx = _slideVideoIdx.has(_slideIdx) ? _slideVideoIdx.get(_slideIdx) : -1;

  if (dir === 1) {
    // 다음에 보여줄 영상이 남아 있으면 → 그 영상 열기
    const nextIdx = curIdx + 1;
    if (nextIdx < videos.length) {
      if (_videoModalOpen) closeSlideVideo();
      openSlideVideo(videos[nextIdx]);
      _slideVideoIdx.set(_slideIdx, nextIdx);
      return;
    }
    // 더 이상 영상 없음 — 모달 열려 있으면 닫고, 다음 슬라이드로 진행
    if (_videoModalOpen) closeSlideVideo();
  }
  // 이전 키: 영상 모달 열려 있으면 닫기만 (슬라이드 이동 없음)
  if (dir === -1 && _videoModalOpen) {
    closeSlideVideo();
    return;
  }

  const next = _slideIdx + dir;
  if (next < 0 || next >= _slides.length) return;
  _slideIdx = next;
  renderSlide();
}

function renderSlide() {
  // [수정] 슬라이드 전환 시 라이트박스/영상 시퀀스 상태 리셋
  closeSlideLightbox();
  _slideLightboxIdx = -1;
  const s = _slides[_slideIdx];
  const total = _slides.length;
  const pct = total === 1 ? 100 : (_slideIdx / (total - 1)) * 100;

  document.getElementById('slide-counter').textContent = `${_slideIdx + 1} / ${total}`;
  document.getElementById('slide-progress-bar').style.width = pct + '%';
  document.getElementById('slide-prev').disabled = _slideIdx === 0;
  document.getElementById('slide-next').disabled = _slideIdx === total - 1;

  // 점 내비게이션
  const dotsEl = document.getElementById('slide-dots');
  dotsEl.innerHTML = _slides.map((_, i) =>
    `<div class="slide-dot${i === _slideIdx ? ' active' : ''}" onclick="jumpSlide(${i})"></div>`
  ).join('');

  // 슬라이드 내용
  let html = '';
  if (s.type === 'title') {
    const l = s.lesson;
    const slideBadge = l.lesson_type === '교과'
      ? `${l.gyogwa_grade ? `<span class="slide-badge" style="margin-right:6px">${escHtml(l.gyogwa_grade)}</span>` : ''}${l.gyogwa_unit ? `<span class="slide-badge" style="background:rgba(96,165,250,.25)">${escHtml(l.gyogwa_unit)}</span>` : ''}`
      : `<span class="slide-badge">${l.level || '사고력수학'}</span>`;
    html = `
      <div class="slide-title-card">
        <div>${slideBadge}</div>
        <h1>${escHtml(l.title)}</h1>
        ${l.objectives ? `<div class="slide-objectives"><strong style="color:#a5b4fc;display:block;margin-bottom:10px;font-size:14px">📎 수업 목표</strong>${escHtml(l.objectives)}</div>` : ''}
        ${l.teacher_objectives ? `<div class="slide-objectives" style="margin-top:12px"><strong style="color:#a5b4fc;display:block;margin-bottom:10px;font-size:14px">🎯 교사 목표</strong>${escHtml(l.teacher_objectives)}</div>` : ''}
        ${(l.links && l.links.length > 0) ? `<div class="slide-objectives" style="margin-top:12px"><strong style="color:#a5b4fc;display:block;margin-bottom:10px;font-size:14px">🔗 참고 링크</strong><div style="display:flex;flex-direction:column;gap:8px">${l.links.map(lk => `<a href="${lk.url}" target="_blank" rel="noopener noreferrer" style="color:#c7d2fe;text-decoration:underline;font-size:15px;word-break:break-all;transition:color .15s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#c7d2fe'">${lk.label || lk.url}</a>`).join('')}</div></div>` : ''}
      </div>`;
  } else {
    const a = s.act;
    const hasImgs = a.images && a.images.length > 0;
    html = `
      <div class="slide-activity-card">
        <div class="slide-act-num">${s.num}</div>
        <div class="slide-act-title">${escHtml(a.name)}</div>
        ${a.time ? `<span class="slide-act-time">⏱ ${a.time}</span>` : ''}
        <div class="slide-act-body">
          <div>
            ${a.research ? `<div class="slide-act-research">${researchToDisplayHtml(a.research)}</div>` : '<div style="color:#64748b;font-style:italic">연구 내용 없음</div>'}
            <div class="slide-act-extras">
              ${a.workbook ? `<span class="slide-extra-tag">📖 워크북: ${escHtml(a.workbook)}</span>` : ''}
              ${a.materials ? `<span class="slide-extra-tag">🧩 준비물: ${escHtml(a.materials)}</span>` : ''}
            </div>
            ${(() => {
              const links = a.links || [];
              if (links.length === 0) return '';
              let html = '<div style="margin-top:14px;display:flex;flex-direction:column;gap:6px">';
              let videoCount = 0;
              links.forEach(lk => {
                const embedUrl = _videoEmbedUrl(lk.url);
                if (embedUrl) {
                  // 영상 — 클릭하면 즉시 재생, 또는 포인터 → 키로 순서대로 재생
                  videoCount++;
                  const hint = videoCount === 1 ? '클릭 또는 → 키' : '클릭하여 재생';
                  html += `<div class="slide-video-prompt" onclick="openSlideVideo(${JSON.stringify(embedUrl).replace(/"/g, '&quot;')})" style="cursor:pointer">▶️ <strong>영상 ${videoCount}</strong> · ${hint} <span style="opacity:.85;font-weight:400">— ${escHtml(lk.label || '영상')}</span></div>`;
                } else {
                  // 일반 외부 링크
                  html += `<a href="${lk.url}" target="_blank" rel="noopener noreferrer" style="color:var(--sl-accent);text-decoration:underline;font-size:14px;word-break:break-all">🔗 ${escHtml(lk.label || lk.url)}</a>`;
                }
              });
              html += '</div>';
              return html;
            })()}
          </div>
          ${hasImgs ? `<div class="slide-act-imgs ${a.images.length > 3 ? 'multi' : ''}">${a.images.map(src => `<img src="${src}" onclick="openLightbox('${src}')" title="클릭하면 크게 보기">`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  const areaEl = document.getElementById('slide-area');
  areaEl.innerHTML = html;
  _scheduleMathRender(areaEl);
  // [수정] transform 자동 축소 대신 슬라이드 영역에서 자연 스크롤 — 새 슬라이드는 항상 맨 위부터 보이게
  areaEl.scrollTop = 0;
}

function jumpSlide(idx) {
  _slideIdx = idx;
  renderSlide();
}

// 키보드/리모컨 네비게이션
// 대부분의 무선 프레젠터(로지텍 R400/R500 등)는 화살표 또는 PageUp/PageDown를 보낸다.
// 일부 모델은 Tab/F5/Period 같은 다른 키를 보내기도 해서, 폭넓게 받는다.
// 또한 전체화면 모드에서 이벤트 누락을 방지하기 위해 window/document/overlay 세 곳 모두에 등록.
function _handleSlideshowKey(e) {
  // [수정] 같은 이벤트 객체에 플래그를 달아 중복 호출 방지.
  //   리스너를 window/document/overlay 3곳에 등록해 두었기 때문에 그대로 두면
  //   한 번 누를 때마다 3번 넘어가버린다. 첫 핸들러가 처리하면 나머지는 스킵.
  if (e._slideHandled) return;
  e._slideHandled = true;
  const overlay = document.getElementById('slideshow-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  // 디버그: 어떤 키가 들어왔는지 화면 우상단에 잠깐 표시 (포인터 호환성 진단용)
  if (window._slideKeyDebug) {
    const dbg = document.getElementById('slide-key-debug');
    if (dbg) {
      dbg.textContent = `key="${e.key}" code="${e.code}" keyCode=${e.keyCode}`;
      dbg.style.opacity = '1';
      clearTimeout(window._slideKeyDebugTimer);
      window._slideKeyDebugTimer = setTimeout(() => { dbg.style.opacity = '0'; }, 1800);
    }
  }
  const k = e.key;
  // 다음 (포인터 forward 버튼이 보낼 가능성이 있는 모든 키)
  const nextKeys = ['ArrowRight','ArrowDown',' ','PageDown','Enter','Tab','MediaTrackNext','N','n'];
  // 이전 (포인터 back 버튼)
  const prevKeys = ['ArrowLeft','ArrowUp','PageUp','Backspace','MediaTrackPrevious','P','p'];
  if (nextKeys.indexOf(k) >= 0) { e.preventDefault(); slideMove(1); return; }
  if (prevKeys.indexOf(k) >= 0) { e.preventDefault(); slideMove(-1); return; }
  if (k === 'Home') { e.preventDefault(); _slideIdx = 0; renderSlide(); return; }
  if (k === 'End')  { e.preventDefault(); _slideIdx = _slides.length - 1; renderSlide(); return; }
  // [신규] 0 키: 이미지 라이트박스 시퀀스 건너뛰기 (현재 슬라이드의 이미지를 다 본 것으로 처리)
  //   라이트박스 열려 있으면 닫고, 다음 키 입력은 영상 / 다음 슬라이드로 자연스럽게 진행됨.
  if (k === '0') {
    e.preventDefault();
    if (_slideLightboxIdx >= 0) closeSlideLightbox();
    _imagesConsumedSlides.add(_slideIdx);
    return;
  }
  if (k === 'Escape' || k === 'F5') {
    // 영상 모달이 열려 있으면 그것부터 닫기 — 슬라이드쇼는 유지
    if (_videoModalOpen) { e.preventDefault(); closeSlideVideo(); return; }
    closeSlideshow();
    return;
  }
}
// 세 군데 모두에 등록 — 풀스크린/포커스 이슈로 한쪽이 누락돼도 다른 쪽이 받음.
window.addEventListener('keydown', _handleSlideshowKey, true);    // capture
document.addEventListener('keydown', _handleSlideshowKey);
document.getElementById('slideshow-overlay').addEventListener('keydown', _handleSlideshowKey);

// 디버그 모드 토글: 콘솔에서 toggleSlideKeyDebug() 또는 발표 모드 중 Shift+D
window.toggleSlideKeyDebug = function() {
  window._slideKeyDebug = !window._slideKeyDebug;
  console.log('Slide key debug:', window._slideKeyDebug);
};
document.addEventListener('keydown', e => {
  if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    const overlay = document.getElementById('slideshow-overlay');
    if (overlay && overlay.classList.contains('open')) {
      window.toggleSlideKeyDebug();
    }
  }
});

function openLightbox(src) {
  const lb = document.getElementById('img-lightbox');
  // 전체화면 중이면 라이트박스를 전체화면 요소 안으로 이동 (슬라이드쇼 위에 표시)
  if (document.fullscreenElement) {
    document.fullscreenElement.appendChild(lb);
  } else {
    document.body.appendChild(lb);
  }
  document.getElementById('img-lightbox-img').src = src;
  lb.classList.add('open');
}

// ── 전역 Ctrl+V 이미지 붙여넣기 ──
document.addEventListener('paste', function(e) {
  // 교재 이미지 붙여넣기 모드가 활성화된 경우 활동 이미지에는 추가하지 않음
  if (_textbookPasteActive) return;

  const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
  if (!items) return;
  let imgItem = null;
  for (const item of items) {
    if (item.type.startsWith('image/')) { imgItem = item; break; }
  }
  if (!imgItem) return;

  // 활동 편집기가 열려 있는지 확인
  const editors = document.querySelectorAll('.activity-editor');
  if (editors.length === 0) return;

  // 우선순위: ① 현재 포커스된 편집기 → ② 최근 클릭된 이미지 영역 → ③ 마지막 편집기
  let actEditor = document.activeElement?.closest?.('.activity-editor');
  if (!actEditor && _activeActId) {
    actEditor = document.getElementById('act-' + _activeActId);
  }
  if (!actEditor) actEditor = editors[editors.length - 1];

  const actId = actEditor.id.replace('act-', '');
  addImgToActivity(actId, imgItem.getAsFile());

  // 붙여넣기 피드백
  const zone = document.getElementById('img-zone-'+actId);
  if (zone) {
    const origContent = zone.innerHTML;
    zone.classList.add('paste-flash');
    zone.innerHTML = '✅ 이미지가 붙여넣어졌습니다!';
    setTimeout(() => {
      zone.classList.remove('paste-flash');
      zone.innerHTML = origContent;
    }, 1500);
  }
  e.preventDefault();
});
