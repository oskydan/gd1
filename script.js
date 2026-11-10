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
// Share the public, language-specific camp URL rather than a local preview URL.
if (document.body.classList.contains('camp-detail-page') && campPage) {
  const host = document.querySelector('.camp-detail-hero-copy');
  const share = document.createElement('div');
  share.className = 'camp-share';
  share.innerHTML = `<button type="button" class="camp-share-button" aria-label="${ui('Share camp', 'Поділитися кемпом')}" title="${ui('Share camp', 'Поділитися кемпом')}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/></svg></button><span class="camp-share-status" role="status" aria-live="polite"></span><input class="camp-share-link" type="text" readonly hidden aria-label="${ui('Camp link', 'Посилання на кемп')}">`;
  const registration = host?.querySelector('.camp-detail-cta');
  if (registration) share.prepend(registration);
  host?.append(share);
  const button = share.querySelector('button');
  const shareIcon = button.innerHTML;
  let copyConfirmationTimer;
  const confirmCopy = (message = ui('Link copied', 'Посилання скопійовано')) => {
    window.clearTimeout(copyConfirmationTimer);
    button.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>';
    button.classList.add('is-copied');
    button.title = message;
    button.setAttribute('aria-label', message);
    copyConfirmationTimer = window.setTimeout(() => {
      button.innerHTML = shareIcon;
      button.classList.remove('is-copied');
      button.title = ui('Share camp', 'Поділитися кемпом');
      button.setAttribute('aria-label', button.title);
    }, 3000);
  };
  const status = share.querySelector('[role="status"]');
  const input = share.querySelector('input');
  const dates = host?.querySelector('.camp-detail-date');
  const originalDateParent = dates?.parentElement;
  const originalDateNext = dates?.nextSibling;
  const mobileShare = window.matchMedia('(max-width:700px)');
  const arrangeCampActions = () => {
    if (!dates || !originalDateParent) return;
    if (mobileShare.matches) share.prepend(dates);
    else originalDateParent.insertBefore(dates, originalDateNext);
  };
  mobileShare.addEventListener('change', arrangeCampActions);
  arrangeCampActions();
  input.addEventListener('copy', () => {
    status.textContent = ui('Link copied.', 'Посилання скопійовано.');
    confirmCopy();
  });
  const url = document.querySelector('link[rel="canonical"]')?.href;
  const title = `GD1 · ${campPage.title} · ${campPage.period}`;
  const record = (outcome, method) => document.dispatchEvent(new CustomEvent('gd1:camp-share', { detail: { camp_id: campPage.id, outcome, method } }));
  button.addEventListener('click', async () => {
    if (!url || button.disabled) return;
    button.disabled = true;status.textContent = '';input.hidden = true;
    const native = typeof navigator.share === 'function';
    record('started', native ? 'native' : 'clipboard');
    try {
      if (native) {
        try {
          await navigator.share({ title, url });
          confirmCopy(ui('Sharing completed', 'Поширення завершено'));
          record('shared', 'native');
          return;
        } catch (error) {
          if (error.name === 'AbortError') { record('cancelled', 'native');return; }
          // Unsupported or blocked sharing still offers a usable copy action.
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = ui('Link copied.', 'Посилання скопійовано.');
        confirmCopy();
        record('copied', 'clipboard');
      } catch {
        input.value = url;input.hidden = false;input.focus();input.select();
        status.textContent = ui('Copy the link below.', 'Скопіюйте посилання нижче.');
        record('manual_copy_shown', 'manual');
      }
    } finally { button.disabled = false; }
  });
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

function campDuration(camp) {
  const days = camp.durationDays;
  const ukrainian = days % 10 === 1 && days % 100 !== 11 ? 'день'
    : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14) ? 'дні' : 'днів';
  return `${days} ${ui(days === 1 ? 'day' : 'days', ukrainian)}`;
}
function renderUpcomingCard(camp, home = false, first = false) {
  const details = camp.page && !camp.cancelled && !camp.registrationClosed && !camp.registrationComingSoon;
  const description = camp.cardSummary || camp.shortDescription;
  const label = `${ui('View camp details for', 'Деталі кемпу:')} ${camp.title}, ${camp.period}`;
  return `
    <article class="${home ? 'upcoming-camp-card' : 'camp-archive-card'} camp-overview-card" ${home ? '' : `id="${safe(camp.id)}"`} data-camp-id="${safe(camp.id)}">
      ${details ? `<a class="camp-card-hitarea" href="${safe(camp.page)}" aria-label="${safe(label)}" aria-hidden="true" tabindex="-1"></a>` : ''}
      <div class="camp-card-photo">${details ? `<a class="camp-card-photo-link" href="${safe(camp.page)}" aria-label="${safe(label)}" tabindex="-1">` : ''}<img src="${safe(camp.image)}" alt="${safe(camp.imageAlt)}" ${camp.imageSrcset ? `srcset="${safe(camp.imageSrcset)}" sizes="(max-width:700px) calc(100vw - 48px), (max-width:1000px) 50vw, 440px" width="${camp.imageWidth}" height="${camp.imageHeight}"` : ''} loading="${first ? 'eager' : 'lazy'}" ${first ? 'fetchpriority="high"' : ''} decoding="async">${details ? '</a>' : ''}</div>
      <div class="camp-card-content">
        <p class="camp-card-date"><span>${safe(camp.period)}</span><span class="camp-card-duration">${safe(campDuration(camp))}</span></p>
        <h3>${safe(camp.title)}</h3>
        <p class="camp-card-summary">${safe(description)}</p>
        <dl class="camp-card-facts">
          <dt>${ui('Daily sessions', 'Щодня')}</dt><dd class="camp-card-sessions">${camp.onIceDaily} ${ui('on-ice', 'на льоду')} + ${camp.offIceDaily} ${ui('off-ice', 'поза льодом')}</dd>
          ${camp.venue ? `<dt>${ui('Ice arena', 'Арена')}</dt><dd>${safe(camp.venue)}</dd>` : ''}
        </dl>
        ${camp.campFee ? `<div class="camp-card-price"><span>${ui('Camp fee', 'Вартість кемпу')}</span><strong>${ui('€' + camp.campFee, camp.campFee + ' €')}</strong></div>` : ''}
        <div class="camp-card-actions${details ? ' has-details' : ''}">
          ${details ? `<a class="button camp-details-button" href="${safe(camp.page)}" aria-label="${safe(label)}">${ui('View camp details', 'Деталі кемпу')}</a>` : ''}
          ${registrationButton(camp)}
        </div>
      </div>
    </article>`;
}

function renderHomeCamps() {
  const container = document.querySelector('#home-camp-list');
  if (!container) return;
  const upcoming = campList.filter((camp) => !isCampPast(camp)).sort((a, b) => a.startsOn.localeCompare(b.startsOn)).slice(0, 3);
  if (upcoming.length === 0) {
    container.innerHTML = `<p class="camp-empty-state">${ui('No upcoming camps are scheduled right now. Check back soon for new dates.', 'Наразі найближчі кемпи ще не заплановані. Завітайте згодом, щоб дізнатися нові дати.')}</p>`;
    return;
  }
  container.innerHTML = upcoming.map(camp => renderUpcomingCard(camp, true)).join('');
}

let visiblePastLimit = 12;
function renderPastCard(camp) {
  return `
    <article class="camp-archive-card is-past" id="${safe(camp.id)}" data-camp-id="${safe(camp.id)}">
      ${camp.page ? `<a class="camp-card-hitarea" href="${safe(camp.page)}" aria-label="${ui('Open camp page for', 'Відкрити сторінку кемпу:')} ${safe(camp.title)}, ${safe(camp.period)}"></a>` : ''}
      <div class="camp-archive-photo"><img src="${safe(camp.image)}" alt="${safe(camp.imageAlt)}" ${camp.imageSrcset ? `srcset="${safe(camp.imageSrcset)}" sizes="(max-width:620px) calc(100vw - 40px), (max-width:900px) 50vw, 440px" width="${camp.imageWidth}" height="${camp.imageHeight}"` : ''} loading="lazy" decoding="async"></div>
      <div class="camp-archive-info">
        <p class="eyebrow dark">${safe(camp.period.toUpperCase())}</p>
        <h3>${safe(camp.title)}</h3>
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
  upcomingContainer.innerHTML = upcoming.map((camp, index) => renderUpcomingCard(camp, false, index === 0)).join('');
  const pageSize = 12;
  let visiblePastCount = Math.min(visiblePastLimit, past.length);
  pastContainer.innerHTML = past.slice(0, visiblePastCount).map((camp) => renderPastCard(camp)).join('');
  document.querySelector('#upcoming-empty').hidden = upcoming.length > 0;
  document.querySelector('#past-empty').hidden = past.length > 0;
  const loadMoreButton = document.querySelector('#past-camps-load-more');
  const loadNextBatch = () => {
    if (visiblePastCount >= past.length) return;
    const nextCount = Math.min(visiblePastCount + pageSize, past.length);
    pastContainer.insertAdjacentHTML('beforeend', past.slice(visiblePastCount, nextCount).map((camp) => renderPastCard(camp)).join(''));
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

// Calendar dates are all-day; DTEND is exclusive, including the final camp day.
let campCalendar;
if (document.body.classList.contains('camp-detail-page') && campPage) {
  const url = document.querySelector('link[rel="canonical"]')?.href;
  const start = campPage.startsOn.replaceAll('-', '');
  const endDate = new Date(campPage.endsOn + 'T00:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replaceAll('-', '');
  const title = `GD1 · ${campPage.title}`;
  const location = `${campPage.venue || ''}, ${campPage.title}`;
  const description = `${ui('Camp details', 'Деталі кемпу')}: ${url}`;
  const google = new URL('https://calendar.google.com/calendar/render');
  google.search = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}`, location, details: description }).toString();
  const escapeCalendar = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const foldCalendar = line => {
    let result = '', current = '', size = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (size + bytes > 75) { result += current + '\r\n';current = ' ';size = 1; }
      current += char;size += bytes;
    }
    return result + current;
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GD1//Camp Calendar//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${campPage.id}@gd1.pro`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${escapeCalendar(title)}`,
    `LOCATION:${escapeCalendar(location)}`, `DESCRIPTION:${escapeCalendar(description)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'];
  const downloadUrl = URL.createObjectURL(new Blob([lines.map(foldCalendar).join('\r\n') + '\r\n'], {type: 'text/calendar;charset=utf-8'}));
  campCalendar = document.createElement('details');
  campCalendar.className = 'camp-calendar';
  campCalendar.innerHTML = `<summary>${ui('Add to calendar', 'Додати до календаря')}</summary><div class="camp-calendar-options"><a href="${safe(google.href)}" target="_blank" rel="noopener noreferrer" data-calendar-option="google">Google Calendar</a><a href="${downloadUrl}" download="${safe(campPage.id)}.ics" data-calendar-option="ics">${ui('Apple Calendar / Outlook (.ics)', 'Apple Calendar / Outlook (.ics)')}</a><p>${ui('Includes all camp dates. Training times will be provided separately. Saved events will not update automatically.', 'Подія охоплює всі дні кемпу. Час тренувань повідомимо окремо. Збережені події не оновлюються автоматично.')}</p></div>`;
  document.querySelector('.camp-detail-hero-copy')?.append(campCalendar);
  campCalendar.addEventListener('click', event => {
    const option = event.target.closest('[data-calendar-option]');
    if (!option) return;
    campCalendar.open = false;
    campCalendar.querySelector('summary').focus({preventScroll: true});
    if (isCampPast(campPage) || campPage.cancelled) { event.preventDefault();return; }
    document.dispatchEvent(new CustomEvent('gd1:camp-calendar', {detail: {camp_id: campPage.id, calendar_option: option.dataset.calendarOption}}));
  });
  document.addEventListener('click', event => { if (campCalendar.open && !campCalendar.contains(event.target)) campCalendar.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && campCalendar.open) { campCalendar.open = false;campCalendar.querySelector('summary').focus(); } });
}

// Keep the camp action within reach on small screens, including after expiry.
let mobileCampBar;
if (document.body.classList.contains('camp-detail-page') && campPage) {
  mobileCampBar = document.createElement('aside');
  mobileCampBar.className = 'mobile-camp-bar';
  mobileCampBar.setAttribute('aria-label', ui('Camp registration', 'Реєстрація на кемп'));
  document.body.append(mobileCampBar);
  document.body.classList.add('has-mobile-camp-bar');
}
function updateMobileCampBar() {
  if (!mobileCampBar) return;
  const completed = isCampPast(campPage);
  const action = completed
    ? `<a class="button" href="${ui('camps.html', 'camps-uk.html')}">${ui('View upcoming camps', 'Майбутні кемпи')}</a>`
    : registrationButton(campPage);
  mobileCampBar.innerHTML = `<div class="mobile-camp-bar-inner"><div class="mobile-camp-bar-price"><span>${ui('Camp fee', 'Вартість кемпу')}</span><strong>${ui('€' + campPage.campFee, campPage.campFee + ' €')}</strong></div>${action}</div>`;
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
    updateMobileCampBar();
    if (campCalendar) campCalendar.hidden = isCampPast(campPage) || Boolean(campPage.cancelled);
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
