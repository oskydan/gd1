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
  let photoRequest = 0;
  let photoAnimation;
  let photoOverlay;
  function showPhoto(index) {
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
      const options = {duration: 250, easing: 'cubic-bezier(.4, 0, .2, 1)'};
      const outgoing = previous.animate([{opacity: 1}, {opacity: 0}], {...options, fill: 'forwards'});
      photoAnimation = enlarged.animate([{opacity: 0}, {opacity: 1}], options);
      try { await outgoing.finished; } catch { /* A newer photo can replace this transition. */ }
      previous.remove();
      if (photoOverlay === previous) photoOverlay = null;
    };
    transition();
  }
  photoButtons.forEach((button,index) => button.addEventListener('click', () => {
    opener = button;
    previousOverflow = document.body.style.overflow;
    showPhoto(index);
    photoViewer.showModal();
    document.body.style.overflow = 'hidden';
    close.focus({preventScroll:true});
  }));
  close.addEventListener('click', () => photoViewer.close());
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
    photoRequest++;
    photoAnimation?.cancel();
    photoOverlay?.remove();
    document.body.style.overflow = previousOverflow;
    opener?.focus({preventScroll:true});
    enlarged.removeAttribute('src');
    enlarged.removeAttribute('srcset');
  });
  window.addEventListener('resize', () => {
    photoAnimation?.cancel();
    photoOverlay?.remove();
  });
  // Swipe navigation complements the arrows on touch screens.
  let touchStart=null;
  const stage=photoViewer.querySelector('.gallery-lightbox-stage');
  stage.addEventListener('touchstart', event => {
    touchStart=event.touches.length===1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
  },{passive:true});
  stage.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
  stage.addEventListener('touchmove', event => { if (event.touches.length !== 1) touchStart = null; }, {passive:true});
  stage.addEventListener('touchend', event => {
    const touch=event.changedTouches[0];
    if (!touch || !touchStart) return;
    const dx=touch.clientX-touchStart.x,dy=touch.clientY-touchStart.y;
    touchStart=null;
    if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) showPhoto(current+(dx<0?1:-1));
  },{passive:true});
}
