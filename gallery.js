const galleryTabs = [...document.querySelectorAll('.gallery-tab')];
const galleryVideos = [...document.querySelectorAll('.gallery-video-item video')];

function selectGalleryTab(tab) {
  if (tab.id === 'videos-tab') galleryVideos.forEach(video => {
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
  });
  galleryTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  galleryVideos.forEach((video) => {
    video.pause();

  });
}

galleryTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectGalleryTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % galleryTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + galleryTabs.length) % galleryTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = galleryTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectGalleryTab(galleryTabs[next]);
    galleryTabs[next].focus();
  });
});
galleryVideos.forEach((video) => {
  const button = video.parentElement.querySelector('.gallery-video-play');
  button?.addEventListener('click', async () => {
    const source = video.querySelector('source[data-src]');
    if (source) {
      source.src = source.dataset.src;
      source.removeAttribute('data-src');
      video.load();
    }
    button.hidden = true;
    try { await video.play(); }
    catch { button.hidden = false; }
  });
  video.addEventListener('play', () => {
    if (button) button.hidden = true;
    galleryVideos.forEach((other) => { if (other !== video) other.pause(); });
  });
});

function selectGalleryFromHash() {
  const tabId = window.location.hash === '#videos' ? 'videos-tab' : window.location.hash === '#photos' ? 'photos-tab' : null;
  const tab = tabId && document.getElementById(tabId);
  if (tab) selectGalleryTab(tab);
}
selectGalleryFromHash();
window.addEventListener('hashchange', selectGalleryFromHash);

// Native modal keeps focus inside the viewer and the background non-interactive.
const photoViewer = document.getElementById('gallery-lightbox');
if (photoViewer) {
  const photoButtons = [...document.querySelectorAll('.gallery-photo-open')];
  const photos = photoButtons.map(button => button.querySelector('img'));
  const enlarged = photoViewer.querySelector('.gallery-lightbox-image');
  const caption = photoViewer.querySelector('.gallery-lightbox-caption');
  const counter = photoViewer.querySelector('.gallery-lightbox-count');
  const close = photoViewer.querySelector('.gallery-lightbox-close');
  let current = 0;
  let opener;
  let previousOverflow = '';
  let lockedScrollY = 0;
  let previousBodyLayout;
  let previousRootOverflow;
  let photoRequest = 0;
  let photoAnimation;
  let photoOverlay;
  function showPhoto(index, swipeDirection = 0) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    const request = ++photoRequest;
    photoAnimation?.cancel();
    photoOverlay?.remove();
    const applyPhoto = () => {
      enlarged.alt = photo.alt;
      enlarged.sizes = '100vw';
      if (photo.srcset) enlarged.srcset = photo.srcset;
      else enlarged.removeAttribute('srcset');
      enlarged.src = photo.src;
      caption.textContent = photo.alt;
      counter.textContent = `${current + 1} / ${photos.length}`;
    };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!photoViewer.open || reduced || !enlarged.animate) { applyPhoto();return; }
    // Prepare the next photo before fading, avoiding a blank loading flash.
    const prepared = new Image();
    prepared.sizes = '100vw';
    if (photo.srcset) prepared.srcset = photo.srcset;
    prepared.src = photo.src;
    const transition = async () => {
      try { await prepared.decode(); } catch { /* The image element retains its normal error handling. */ }
      if (request !== photoRequest || !photoViewer.open) return;
      // Crossfade over the old photo instead of fading through black.
      const bounds = enlarged.getBoundingClientRect();
      const previous = enlarged.cloneNode(true);
      previous.removeAttribute('id');
      previous.className = 'gallery-lightbox-crossfade';
      previous.alt = '';
      previous.setAttribute('aria-hidden', 'true');
      Object.assign(previous.style, {
        position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
        maxWidth: 'none', maxHeight: 'none', objectFit: 'contain', pointerEvents: 'none'
      });
      photoOverlay = previous;
      enlarged.after(previous);
      applyPhoto();
      const options = {duration: 250, easing: 'cubic-bezier(.22, 1, .36, 1)'};
      const distance = swipeDirection * Math.min(48, window.innerWidth * .08);
      const outgoingFrames = swipeDirection
        ? [{opacity: 1, transform: 'translate3d(0,0,0)'}, {opacity: 0, transform: `translate3d(${-distance}px,0,0)`}]
        : [{opacity: 1}, {opacity: 0}];
      const incomingFrames = swipeDirection
        ? [{opacity: 0, transform: `translate3d(${distance}px,0,0)`}, {opacity: 1, transform: 'translate3d(0,0,0)'}]
        : [{opacity: 0}, {opacity: 1}];
      const outgoing = previous.animate(outgoingFrames, {...options, fill: 'forwards'});
      photoAnimation = enlarged.animate(incomingFrames, options);
      try { await outgoing.finished; } catch { /* A newer photo can replace this transition. */ }
      previous.remove();
      if (photoOverlay === previous) photoOverlay = null;
    };
    transition();
  }
  photoButtons.forEach((button,index) => button.addEventListener('click', () => {
    opener = button;
    previousOverflow = document.body.style.overflow;
    lockedScrollY = window.scrollY || 0;
    previousBodyLayout = {position: document.body.style.position, top: document.body.style.top, width: document.body.style.width};
    previousRootOverflow = document.documentElement?.style.overflow;
    showPhoto(index);
    photoViewer.showModal();
    document.body.style.overflow = 'hidden';
    Object.assign(document.body.style, {position: 'fixed', top: `-${lockedScrollY}px`, width: '100%'});
    if (document.documentElement) document.documentElement.style.overflow = 'hidden';
    close.focus({preventScroll:true});
    enterViewerFullscreen();
  }));
  close.addEventListener('click', () => photoViewer.close());
  const tapTimers = new Map();
  photoViewer.querySelectorAll('.gallery-lightbox-prev, .gallery-lightbox-next').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
      window.clearTimeout(tapTimers.get(button));
      button.classList.add('is-tapped');
      tapTimers.set(button, window.setTimeout(() => {
        button.classList.remove('is-tapped');
        tapTimers.delete(button);
      }, 200));
    });
  });
  photoViewer.querySelector('.gallery-lightbox-prev').addEventListener('click', () => showPhoto(current - 1));
  photoViewer.querySelector('.gallery-lightbox-next').addEventListener('click', () => showPhoto(current + 1));
  photoViewer.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const controls = [...photoViewer.querySelectorAll('button:not([disabled])')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  photoViewer.addEventListener('close', () => {
    exitViewerFullscreen();
    photoRequest++;
    photoAnimation?.cancel();
    photoOverlay?.remove();
    document.body.style.overflow = previousOverflow;
    Object.assign(document.body.style, previousBodyLayout);
    if (document.documentElement) document.documentElement.style.overflow = previousRootOverflow;
    window.scrollTo?.({top: lockedScrollY, behavior: 'instant'});
    opener?.focus({preventScroll:true});
    enlarged.removeAttribute('src');
    enlarged.removeAttribute('srcset');
  });
  window.addEventListener('resize', () => {
    photoAnimation?.cancel();
    photoOverlay?.remove();
  });
  photoViewer.addEventListener('wheel', event => { if (!event.ctrlKey) event.preventDefault(); }, {passive: false});
  photoViewer.addEventListener('touchmove', event => { if (event.touches.length === 1) event.preventDefault(); }, {passive: false});
  // Fullscreen must target the document: browsers reject fullscreen on a dialog.
  const landscapePhoto = window.matchMedia?.('(orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse)');
  let viewerOwnsFullscreen = false;
  let fullscreenPending = false;
  const exitViewerFullscreen = () => {
    if (!viewerOwnsFullscreen) return;
    viewerOwnsFullscreen = false;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) { try { Promise.resolve(exit.call(document)).catch(() => {}); } catch {} }
  };
  const enterViewerFullscreen = () => {
    if (!photoViewer.open || !landscapePhoto?.matches || fullscreenPending || document.fullscreenElement || document.webkitFullscreenElement) return;
    const root = document.documentElement;
    const request = root?.requestFullscreen || root?.webkitRequestFullscreen;
    if (!request) return;
    fullscreenPending = true;
    try {
      Promise.resolve(request.call(root, {navigationUI: 'hide'})).then(() => {
        viewerOwnsFullscreen = true;
        if (!photoViewer.open || !landscapePhoto.matches) exitViewerFullscreen();
      }).catch(() => { /* Rotation alone may lack the browser's required user gesture. */ }).finally(() => { fullscreenPending = false; });
    } catch { fullscreenPending = false; }
  };
  landscapePhoto?.addEventListener('change', () => {
    if (landscapePhoto.matches) enterViewerFullscreen();
    else exitViewerFullscreen();
  });
  photoViewer.addEventListener('click', event => {
    if (event.target.closest('.gallery-lightbox-stage')) enterViewerFullscreen();
  });
  // Swipe navigation complements the arrows on touch screens.
  let touchStart=null;
  const stage=photoViewer.querySelector('.gallery-lightbox-stage');
  stage.addEventListener('touchstart', event => {
    touchStart=event.touches.length===1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
    if (touchStart) [-1, 1].forEach(offset => {
      const photo = photos[(current + offset + photos.length) % photos.length];
      const nearby = new Image();nearby.sizes = '100vw';
      if (photo.srcset) nearby.srcset = photo.srcset;
      nearby.src = photo.src;
    });
  },{passive:true});
  stage.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
  stage.addEventListener('touchmove', event => { if (event.touches.length !== 1) touchStart = null; }, {passive:true});
  stage.addEventListener('touchend', event => {
    const touch=event.changedTouches[0];
    if (!touch || !touchStart) return;
    const dx=touch.clientX-touchStart.x,dy=touch.clientY-touchStart.y;
    touchStart=null;
    if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) {
      enterViewerFullscreen();
      showPhoto(current+(dx<0?1:-1), dx<0?1:-1);
    }
  },{passive:true});
}
