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
const isCampPast = (camp) => {
  const [year, month, day] = camp.endsOn.split('-').map(Number);
  return Date.now() > new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
};
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

function renderArchiveCard(camp, past) {
  return `
    <article class="camp-archive-card${past ? ' is-past' : ''}" id="${safe(camp.id)}" data-camp-id="${safe(camp.id)}">
      ${past || !camp.page || camp.cancelled || camp.registrationClosed || camp.registrationComingSoon ? '' : `<a class="camp-card-hitarea" href="${safe(camp.page)}" aria-label="${ui('Open camp page for', 'Відкрити сторінку кемпу:')} ${safe(camp.title)}, ${safe(camp.period)}"></a>`}
      <div class="camp-archive-photo"><img src="${safe(camp.image)}" alt="${safe(camp.imageAlt)}" ${camp.imageSrcset ? `srcset="${safe(camp.imageSrcset)}" sizes="(max-width:800px) calc(100vw - 40px), 600px" width="${camp.imageWidth}" height="${camp.imageHeight}"` : ''} loading="lazy" decoding="async"></div>
      <div class="camp-archive-info">
        <p class="eyebrow dark">${safe(camp.period.toUpperCase())}</p>
        <h3>${safe(camp.title)}</h3>
        ${past ? '' : `<p class="camp-archive-short">${safe(camp.shortDescription)}</p>`}
        ${past ? '' : `<p class="camp-archive-long">${safe(camp.longDescription)}</p>`}
        ${past && !camp.cancelled
          ? `<span class="camp-status">${ui('Camp completed', 'Кемп завершено')}</span>`
          : registrationButton(camp)}
      </div>
    </article>`;
}

function renderCampArchive() {
  const upcomingContainer = document.querySelector('#upcoming-camps');
  const pastContainer = document.querySelector('#past-camps');
  if (!upcomingContainer || !pastContainer) return;
  const upcoming = campList.filter((camp) => !isCampPast(camp)).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const past = campList.filter(isCampPast).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  upcomingContainer.innerHTML = upcoming.map((camp) => renderArchiveCard(camp, false)).join('');
  const pageSize = 12;
  let visiblePastCount = Math.min(pageSize, past.length);
  pastContainer.innerHTML = past.slice(0, visiblePastCount).map((camp) => renderArchiveCard(camp, true)).join('');
  document.querySelector('#upcoming-empty').hidden = upcoming.length > 0;
  document.querySelector('#past-empty').hidden = past.length > 0;
  if (visiblePastCount >= past.length) return;
  const loadMoreButton = document.querySelector('#past-camps-load-more');
  const loadNextBatch = () => {
    if (visiblePastCount >= past.length) return;
    const nextCount = Math.min(visiblePastCount + pageSize, past.length);
    pastContainer.insertAdjacentHTML('beforeend', past.slice(visiblePastCount, nextCount).map((camp) => renderArchiveCard(camp, true)).join(''));
    visiblePastCount = nextCount;
    const hasMore = visiblePastCount < past.length;
    if (loadMoreButton) loadMoreButton.hidden = !hasMore;
  };
  if (loadMoreButton) {
    loadMoreButton.hidden = false;
    loadMoreButton.addEventListener('click', loadNextBatch);
  }
}

renderHomeCamps();
renderCampArchive();

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

document.querySelectorAll('.register-button[data-camp-end]').forEach((button) => {
  const [year, month, day] = button.dataset.campEnd.split('-').map(Number);
  const campEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Date.now() > campEnd.getTime()) {
    button.classList.add('is-disabled');
    button.setAttribute('aria-disabled', 'true');
    button.removeAttribute('href');
    button.removeAttribute('tabindex');
    button.textContent = ui('Registration Closed', 'Реєстрацію закрито');
  }
});
