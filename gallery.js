const galleryTabs = [...document.querySelectorAll('.gallery-tab')];
const galleryVideos = [...document.querySelectorAll('.gallery-video-item video')];

function selectGalleryTab(tab) {
  galleryTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  galleryVideos.forEach((video) => {
    video.pause();
    if (tab.id === 'videos-tab') {
      const source = video.querySelector('source[data-src]');
      if (source) {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
        video.load();
      }
    }
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
  video.addEventListener('play', () => {
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
