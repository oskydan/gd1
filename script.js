const languageIsUk = document.documentElement.lang === 'uk';
const ui = (english, ukrainian) => languageIsUk ? ukrainian : english;
const languageLinks = document.querySelectorAll('.language-switcher a');
const updateLanguageLinks = () => languageLinks.forEach((link) => {
  const url = new URL(link.href, window.location.href);
  url.hash = window.location.hash;
  url.search = window.location.search;
  link.href = url.href;
});
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);

const languagePicker = document.querySelector('details.language-switcher');
if (languagePicker) {
  const mobileLanguageMenu = window.matchMedia('(max-width:800px)');
  const syncLanguageMenu = () => { languagePicker.open = mobileLanguageMenu.matches; };
  syncLanguageMenu();
  mobileLanguageMenu.addEventListener('change', syncLanguageMenu);
  document.addEventListener('click', (event) => {
    if (!mobileLanguageMenu.matches && !languagePicker.contains(event.target)) languagePicker.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && languagePicker.open && !mobileLanguageMenu.matches) {
      languagePicker.open = false;
      languagePicker.querySelector('summary').focus();
    }
  });
  languagePicker.addEventListener('focusout', (event) => {
    if (!mobileLanguageMenu.matches && !languagePicker.contains(event.relatedTarget)) languagePicker.open = false;
  });
}

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');
if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? ui('Close navigation', 'Закрити меню') : ui('Open navigation', 'Відкрити меню'));
  });
  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', ui('Open navigation', 'Відкрити меню'));
  }));
}

const homeNavLink = navigation?.querySelector('a[href="#home"]');
const homeSection = document.querySelector('.hero');
const siteHeader = document.querySelector('.site-header');
if (homeNavLink && homeSection && siteHeader) {
  const updateHomeNavState = () => {
    const isAtHome = homeSection.getBoundingClientRect().bottom > siteHeader.offsetHeight;
    homeNavLink.classList.toggle('is-active', isAtHome);
    if (isAtHome) homeNavLink.setAttribute('aria-current', 'page');
    else homeNavLink.removeAttribute('aria-current');
  };
  window.addEventListener('scroll', updateHomeNavState, { passive: true });
  updateHomeNavState();
}

const campList = window.GD1_CAMPS || [];
const campPageId = document.body.dataset.campId;
const campPage = campList.find((camp) => camp.id === campPageId);
if (document.body.classList.contains('camp-detail-page') && campPage) {
  document.title = `${campPage.title} | ${ui('GD1 Camp', 'Кемп GD1')}`;
}
// Completion is midnight after the final day in the venue's time zone.
const campEndInstants = new Map();
const campEndsAt = (camp) => {
  const key = `${camp.endsOn}|${camp.timeZone}`;
  if (campEndInstants.has(key)) return campEndInstants.get(key);
  const [year, month, day] = camp.endsOn.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day + 1);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: camp.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    instant -= shown - target;
  }
  campEndInstants.set(key, instant);
  return instant;
};
const isCampPast = (camp) => Date.now() >= campEndsAt(camp);
const safe = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const registrationAttributes = (camp) => {
  const rawUrl = String(camp.registrationUrl || '').trim();
  if (!rawUrl) return 'href="#contact"';
  try {
    const url = new URL(rawUrl, window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return 'href="#contact"';
    return `href="${safe(url.href)}" target="_blank" rel="noopener noreferrer"`;
  } catch {
    return 'href="#contact"';
  }
};
const registrationButton = (camp) => camp.cancelled
  ? `<span class="button register-button is-disabled" role="status" aria-disabled="true">${ui('Cancelled', 'Скасовано')}</span>`
  : isCampPast(camp)
  ? `<span class="button register-button is-disabled" role="status" aria-disabled="true">${ui('Camp Completed', 'Кемп завершено')}</span>`
  : camp.registrationClosed
  ? `<span class="button register-button is-disabled" role="status" aria-disabled="true">${ui('Registration Closed', 'Реєстрацію закрито')}</span>`
  : camp.registrationComingSoon
  ? `<span class="button register-button is-disabled" role="status" aria-disabled="true">${ui('Registration soon', 'Реєстрація незабаром')}</span>`
  : `<a class="button register-button" ${registrationAttributes(camp)} data-camp-end="${safe(camp.endsOn)}">${ui('Register Now', 'Зареєструватися')}</a>`;

function renderHomeCamps() {
  const container = document.querySelector('#home-camp-list');
  if (!container) return;
  const upcoming = campList.filter((camp) => !isCampPast(camp)).sort((a, b) => a.startsOn.localeCompare(b.startsOn)).slice(0, 3);
  if (upcoming.length === 0) {
    container.innerHTML = `<p class="camp-empty-state">${ui('No upcoming camps are scheduled right now. Check back soon for new dates.', 'Наразі найближчі кемпи ще не заплановані. Завітайте згодом, щоб дізнатися нові дати.')}</p>`;
    return;
  }
  container.innerHTML = upcoming.map((camp) => `
    <article class="upcoming-camp-card" data-camp-id="${safe(camp.id)}">
      ${!camp.page || camp.cancelled || camp.registrationClosed || camp.registrationComingSoon ? '' : `<a class="camp-card-hitarea" href="${safe(camp.page)}" aria-label="${ui('Open camp page for', 'Відкрити сторінку кемпу:')} ${safe(camp.title)}, ${safe(camp.period)}"></a>`}
      <div class="upcoming-camp-photo"><img src="${safe(camp.image)}" alt="${safe(camp.imageAlt)}" ${camp.imageSrcset ? `srcset="${safe(camp.imageSrcset)}" sizes="(max-width:800px) calc(100vw - 40px), 600px" width="${camp.imageWidth}" height="${camp.imageHeight}"` : ''} loading="lazy" decoding="async"></div>
      <div class="upcoming-camp-info">
        <p class="eyebrow dark">${safe(camp.period.toUpperCase())}</p>
        <h3>${safe(camp.title)}</h3>
        <p class="camp-card-description">${safe(camp.shortDescription)}</p>
        ${registrationButton(camp)}
      </div>
    </article>`).join('');
}

let visiblePastLimit = 12;
function renderArchiveCard(camp, past, first = false) {
  return `
    <article class="camp-archive-card${past ? ' is-past' : ''}" id="${safe(camp.id)}" data-camp-id="${safe(camp.id)}">
      ${!camp.page || (!past && (camp.cancelled || camp.registrationClosed || camp.registrationComingSoon)) ? '' : `<a class="camp-card-hitarea" href="${safe(camp.page)}" aria-label="${ui('Open camp page for', 'Відкрити сторінку кемпу:')} ${safe(camp.title)}, ${safe(camp.period)}"></a>`}
      <div class="camp-archive-photo"><img src="${safe(camp.image)}" alt="${safe(camp.imageAlt)}" ${camp.imageSrcset ? `srcset="${safe(camp.imageSrcset)}" sizes="(max-width:800px) calc(100vw - 40px), 600px" width="${camp.imageWidth}" height="${camp.imageHeight}"` : ''} loading="${first ? 'eager' : 'lazy'}" ${first ? 'fetchpriority="high"' : ''} decoding="async"></div>
      <div class="camp-archive-info">
        <p class="eyebrow dark">${safe(camp.period.toUpperCase())}</p>
        <h3>${safe(camp.title)}</h3>
        ${past ? '' : `<p class="camp-archive-short">${safe(camp.shortDescription)}</p>`}
        ${past ? '' : `<p class="camp-archive-long">${safe(camp.longDescription)}</p>`}
        ${registrationButton(camp)}
      </div>
    </article>`;
}

function renderCampArchive() {
  const upcomingContainer = document.querySelector('#upcoming-camps');
  const pastContainer = document.querySelector('#past-camps');
  if (!upcomingContainer || !pastContainer) return;
  const upcoming = campList.filter((camp) => !isCampPast(camp)).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const past = campList.filter(isCampPast).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  upcomingContainer.innerHTML = upcoming.map((camp, index) => renderArchiveCard(camp, false, index === 0)).join('');
  const pageSize = 12;
  let visiblePastCount = Math.min(visiblePastLimit, past.length);
  pastContainer.innerHTML = past.slice(0, visiblePastCount).map((camp) => renderArchiveCard(camp, true)).join('');
  document.querySelector('#upcoming-empty').hidden = upcoming.length > 0;
  document.querySelector('#past-empty').hidden = past.length > 0;
  const loadMoreButton = document.querySelector('#past-camps-load-more');
  const loadNextBatch = () => {
    if (visiblePastCount >= past.length) return;
    const nextCount = Math.min(visiblePastCount + pageSize, past.length);
    pastContainer.insertAdjacentHTML('beforeend', past.slice(visiblePastCount, nextCount).map((camp) => renderArchiveCard(camp, true)).join(''));
    visiblePastCount = nextCount;
    visiblePastLimit = nextCount;
    const hasMore = visiblePastCount < past.length;
    if (loadMoreButton) loadMoreButton.hidden = !hasMore;
  };
  if (loadMoreButton) {
    loadMoreButton.hidden = visiblePastCount >= past.length;
    loadMoreButton.onclick = loadNextBatch;
  }
}

const detailRegistrations = [...document.querySelectorAll('.camp-detail-cta')].map(button => ({
  current: button, original: button.cloneNode(true)
}));
const footerCampLinks = [...document.querySelectorAll('.footer-links a')].map(link => ({
  link, camp: campList.find(camp => camp.id === new URL(link.href, window.location.href).hash.slice(1))
})).filter(item => item.camp);
let campStateSnapshot = null;
let campRefreshTimer;
function refreshCampState() {
  const snapshot = campList.map(camp => `${camp.id}:${isCampPast(camp)}`).join('|');
  if (snapshot !== campStateSnapshot) {
    campStateSnapshot = snapshot;
    renderHomeCamps();
    renderCampArchive();
    footerCampLinks.forEach(({link,camp}) => { link.hidden = isCampPast(camp); });
    const footerNav = footerCampLinks[0]?.link.parentElement;
    if (footerNav) {
      let empty = footerNav.querySelector('.footer-camp-empty');
      if (!empty) {
        empty = document.createElement('p');empty.className = 'footer-camp-empty';
        empty.textContent = ui('New camp dates coming soon.', 'Нові дати кемпів незабаром.');
        footerNav.append(empty);
      }
      empty.hidden = footerCampLinks.some(({link}) => !link.hidden);
    }
    if (campPage) detailRegistrations.forEach(item => {
      const completed = isCampPast(campPage) && !campPage.cancelled;
      if (completed && !item.current.classList.contains('is-completed')) {
        const status = document.createElement('span');
        status.className = item.original.className + ' is-disabled is-completed';
        status.setAttribute('aria-disabled', 'true');
        status.setAttribute('role', 'status');
        status.textContent = ui('Camp Completed', 'Кемп завершено');
        const focused = document.activeElement === item.current;
        item.current.replaceWith(status);item.current = status;
        if (focused) { status.tabIndex = -1;status.focus({preventScroll:true}); }
      } else if (!completed && item.current.classList.contains('is-completed')) {
        const original = item.original.cloneNode(true);
        item.current.replaceWith(original);item.current = original;
      }
    });
  }
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
  window.clearTimeout(campRefreshTimer);
  const next = Math.min(...campList.map(campEndsAt).filter(end => end > Date.now()));
  if (Number.isFinite(next)) campRefreshTimer = window.setTimeout(refreshCampState, Math.min(86400000, Math.max(1, next - Date.now())));
}
refreshCampState();
window.addEventListener('focus', refreshCampState);
window.addEventListener('pageshow', refreshCampState);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCampState(); });
// Recheck at activation too, in case a background tab's timer was suspended.
document.addEventListener('click', event => {
  const button = event.target.closest('.register-button, .camp-detail-cta');
  if (!button) return;
  const campId = button.closest('[data-camp-id]')?.dataset.campId;
  const camp = campList.find(item => item.id === campId);
  if (camp && isCampPast(camp)) {
    event.preventDefault();event.stopImmediatePropagation();refreshCampState();
  }
}, true);
