(() => {
  'use strict';
  // Derive reporting language from the route, never from browser-translated DOM.
  const pageFilename = location.pathname.split('/').pop() || 'index.html';
  const isNotFound = document.body.classList.contains('not-found-page');
  const ukrainian = isNotFound ? pageFilename === '404-uk.html' : pageFilename.endsWith('-uk.html');
  const text = (english, uk) => ukrainian ? uk : english;
  const pageTitles = {
    'index.html': ['GD1 Hockey | Camps & Player Development', 'GD1 Hockey | Кемпи та розвиток гравців'],
    'camps.html': ['GD1 Camps | Upcoming & Past Camps', 'Кемпи GD1 | Найближчі та минулі кемпи'],
    'coach.html': ['Coach | GD1 School', 'Тренер | Школа GD1'],
    'school.html': ['The GD1 School | Training Through Camps', 'Школа GD1 | Розвиток через кемпи'],
    'gallery.html': ['GD1 Gallery | Camp Photos', 'Галерея GD1 | Фото та відео кемпів'],
    'contact.html': ['Contact GD1 | GD1 School', 'Контакти GD1 | Школа GD1'],
  };
  const titlePair = isNotFound ? ['Page not found | GD1', 'Сторінку не знайдено | GD1'] : pageTitles[pageFilename.replace(/-uk\.html$/, '.html')] || ['GD1 Hockey', 'GD1 Hockey'];
  const reportingCamp = (window.GD1_CAMPS || []).find(camp => camp.page === pageFilename);
  const reportingTitle = reportingCamp ? `${reportingCamp.title} | ${ukrainian ? 'Кемп GD1' : 'GD1 Camp'}` : titlePair[ukrainian ? 1 : 0];

  // Keep file previews and local development out of the production project.
  if (!['https:', 'http:'].includes(location.protocol) ||
      ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  const PROJECT_TOKEN = 'b5f5fdb3fcef92f9312cd07124da47c8';
  // Renew consent because v1 explicitly excluded session recording.
  const CONSENT_KEY = 'gd1_analytics_consent_v2';
  const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
  const privacyRequested = navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' || window.doNotTrack === '1';
  let sdk = null;
  let loading = false;
  let pageTracked = false;
  let pending = [];
  let returnFocus = null;

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (saved && typeof saved.allowed === 'boolean' &&
          Number.isFinite(saved.savedAt) && Date.now() - saved.savedAt < CONSENT_LIFETIME) {
        return saved.allowed;
      }
    } catch { /* Analytics remains optional when browser storage is unavailable. */ }
    return null;
  }

  let consent = readConsent();
  const allowed = () => consent === true && !privacyRequested;
  const pageProperties = () => ({
    page_path: location.pathname,
    page_title: reportingTitle,
    page_language: ukrainian ? 'uk' : 'en'
  });

  function track(name, properties = {}) {
    if (!allowed()) return;
    const event = [name, { ...pageProperties(), ...properties }];
    if (!sdk) {
      if (pending.length < 30) pending.push(event);
      return;
    }
    try { sdk.track(...event); } catch { /* Analytics must never interrupt the site. */ }
  }

  function trackPage() {
    if (!pageTracked && sdk && allowed()) {
      pageTracked = true;
      track('Page Viewed');
    }
  }

  function initialize() {
    if (!allowed()) return;
    window.mixpanel.init(PROJECT_TOKEN, {
      api_host: 'https://api-eu.mixpanel.com',
      persistence: 'localStorage',
      cookie_expiration: 180,
      cross_subdomain_cookie: false,
      secure_cookie: location.protocol === 'https:',
      opt_out_tracking_by_default: true,
      opt_out_persistence_by_default: true,
      ignore_dnt: false,
      autocapture: false,
      track_pageview: false,
      record_sessions_percent: 100,
      record_heatmap_data: true,
      record_mask_all_text: true,
      record_mask_all_inputs: true,
      record_block_selector: 'img, video, audio, iframe, form, input, textarea, select, a[href^="mailto:"], a[href^="tel:"], .analytics-consent',
      record_console: false,
      record_network: false,
      record_canvas: false,
      flags: false,
      remote_settings_mode: 'disabled',
      track_marketing: false,
      skip_first_touch_marketing: true,
      stop_utm_persistence: true,
      save_referrer: false,
      store_google: false,
      ip: false,
      batch_requests: false,
      api_transport: 'sendBeacon',
      hooks: {
        before_send_events(event) {
          // Normalize SDK-generated heatmap/page-view titles as well as custom events.
          const properties = { ...event.properties, ...pageProperties() };
          ['current_page_title', '$current_page_title', '$title'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(properties, key)) properties[key] = reportingTitle;
          });
          return { ...event, properties };
        }
      },
      property_blacklist: ['$current_url', '$referrer', '$initial_referrer', '$initial_referring_domain'],
      loaded(instance) {
        sdk = instance;
        loading = false;
        if (!allowed()) {
          sdk.opt_out_tracking({ clear_persistence: true, delete_user: false });
          pending = [];
          return;
        }
        sdk.opt_in_tracking({ track: null });
        // Initialization is opted out; begin recording only after opt-in.
        sdk.start_session_recording();
        trackPage();
        const events = pending;
        pending = [];
        events.forEach(([name, properties]) => track(name, properties));
      }
    });
  }

  function start() {
    if (!allowed()) return;
    if (sdk) {
      sdk.opt_in_tracking({ track: null });
      sdk.start_session_recording();
      trackPage();
      return;
    }
    if (loading) return;
    if (window.mixpanel && typeof window.mixpanel.init === 'function') {
      initialize();
      return;
    }
    loading = true;
    // The official globals bundle expects this snippet bootstrap before loading.
    window.mixpanel = window.mixpanel || [];
    window.mixpanel._i = [];
    window.mixpanel.__SV = 1.2;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      loading = false;
      try { initialize(); } catch { pending = []; }
    };
    script.onerror = () => { loading = false; pending = []; script.remove(); };
    document.head.append(script);
  }

  const banner = document.createElement('section');
  banner.className = 'analytics-consent';
  banner.setAttribute('aria-label', text('Analytics preferences', 'Налаштування аналітики'));
  banner.hidden = true;
  banner.innerHTML = `
    <h2>${text('Optional analytics', 'Аналітика за вашою згодою')}</h2>
    <p>${text('May we use Mixpanel to understand page visits, camp interest, and video views, and create click heatmaps? This includes recording how you interact with our pages, using a browser identifier. Text and form entries are masked; photos and videos are excluded from recordings. You can reject analytics.', 'Чи дозволяєте ви використовувати Mixpanel для аналізу відвідувань, інтересу до кемпів, переглядів відео та створення теплових карт кліків? Це включає запис взаємодії зі сторінками за допомогою ідентифікатора браузера. Текст і дані форм приховані, а фото та відео не потрапляють у записи. Ви можете відмовитися від аналітики.')}</p>
    <p class="analytics-consent-status" aria-live="polite"></p>
    <div class="analytics-consent-actions">
      <button type="button" data-analytics-choice="allow">${text('Allow analytics', 'Дозволити аналітику')}</button>
      <button type="button" data-analytics-choice="reject">${text('Reject analytics', 'Відхилити аналітику')}</button>
    </div>`;
  document.body.append(banner);

  function showPreferences() {
    banner.querySelector('.analytics-consent-status').textContent = privacyRequested
      ? text('Your browser requests no tracking, so analytics stays off.', 'Ваш браузер забороняє відстеження, тому аналітику вимкнено.')
      : consent === null ? '' : text(`Analytics is currently ${consent ? 'on' : 'off'}.`, `Аналітику зараз ${consent ? 'увімкнено' : 'вимкнено'}.`);
    banner.querySelector('[data-analytics-choice="allow"]').disabled = privacyRequested;
    banner.hidden = false;
  }

  function applyConsent(choice) {
    consent = choice;
    if (allowed()) start();
    else {
      pending = [];
      if (sdk) sdk.opt_out_tracking({ clear_persistence: true, delete_user: false });
    }
  }

  banner.addEventListener('click', (event) => {
    const button = event.target.closest('[data-analytics-choice]');
    if (!button || button.disabled) return;
    const choice = button.dataset.analyticsChoice === 'allow';
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ allowed: choice, savedAt: Date.now() }));
    } catch { /* Respect this choice for the current page even without storage. */ }
    applyConsent(choice);
    banner.hidden = true;
    if (returnFocus) { returnFocus.focus(); returnFocus = null; }
  });

  const footer = document.querySelector('.footer-bottom');
  if (footer) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'analytics-settings';
    button.hidden = true;
    button.textContent = text('Analytics preferences', 'Налаштування аналітики');
    button.addEventListener('click', () => {
      returnFocus = button;
      showPreferences();
      banner.querySelector('[data-analytics-choice="reject"]').focus();
    });
    footer.insertBefore(button, footer.lastElementChild);
  }

  document.addEventListener('gd1:camp-calendar', event => {
    const {camp_id, calendar_option} = event.detail || {};
    const camp = (window.GD1_CAMPS || []).find(item => item.id === camp_id);
    if (!camp || !['google', 'ics'].includes(calendar_option)) return;
    track('Camp Calendar Clicked', {camp_id, camp_name: camp.title, camp_dates: camp.period, calendar_option, placement: 'camp_detail'});
  });

  document.addEventListener('gd1:camp-share', (event) => {
    const { camp_id, outcome, method } = event.detail || {};
    const camp = (window.GD1_CAMPS || []).find(item => item.id === camp_id);
    if (!camp || !['started', 'shared', 'copied', 'cancelled', 'manual_copy_shown'].includes(outcome) || !['native', 'clipboard', 'manual'].includes(method)) return;
    track('Camp Share', {
      camp_id, camp_name: camp.title, camp_dates: camp.period,
      share_method: method, share_outcome: outcome, placement: 'camp_detail'
    });
  });

  const placement = (element) => element.closest('header') ? 'header'
    : element.closest('footer') ? 'footer' : 'content';

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.getAttribute('aria-disabled') === 'true') return;
    const properties = { placement: placement(link) };
    const href = link.getAttribute('href');
    if (link.closest('.language-switcher')) {
      const toLanguage = link.getAttribute('hreflang') || link.getAttribute('lang');
      if (!['en', 'uk'].includes(toLanguage)) return;
      let destination;
      try { destination = new URL(href, location.href); } catch { return; }
      track('Language Switched', {
        ...properties,
        from_language: ukrainian ? 'uk' : 'en',
        to_language: toLanguage,
        destination_path: destination.pathname
      });
    } else if (link.matches('.register-button, .camp-detail-cta')) {
      const campId = link.closest('[data-camp-id]')?.dataset.campId;
      const camp = (window.GD1_CAMPS || []).find((item) => item.id === campId);
      track('Registration Clicked', {
        ...properties,
        camp_id: campId || 'unknown',
        camp_name: camp?.title || '',
        camp_dates: camp?.period || '',
        registration_location: link.closest('.camp-detail-hero') ? 'hero' : properties.placement
      });
    } else if (href.startsWith('mailto:')) {
      track('Email Clicked', { ...properties, recipient: link.classList.contains('footer-credit-link') ? 'SkydanLabs' : 'GD1' });
    } else if (href.startsWith('tel:')) {
      track('Phone Clicked', { ...properties, country: href.startsWith('tel:+380') ? 'Ukraine' : 'Germany' });
    } else {
      let url;
      try { url = new URL(href, location.href); } catch { return; }
      if (['www.instagram.com', 'instagram.com', 'www.facebook.com', 'facebook.com'].includes(url.hostname)) {
        track('Social Link Clicked', { ...properties, network: url.hostname.includes('instagram') ? 'Instagram' : 'Facebook' });
      } else if (url.origin === location.origin && /\/contact(?:-uk)?\.html$/.test(url.pathname)) {
        track('Contact Clicked', properties);
      }
    }
  });

  const tabs = document.querySelector('[role="tablist"]');
  if (tabs) {
    new MutationObserver((changes) => {
      changes.forEach(({ target, oldValue }) => {
        if (oldValue !== 'true' && target.getAttribute('aria-selected') === 'true') {
          track('Gallery Tab Changed', { tab: target.id === 'videos-tab' ? 'videos' : 'photos' });
        }
      });
    }).observe(tabs, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-selected'] });
  }

  document.addEventListener('play', (event) => {
    const video = event.target;
    if (!video.matches('.gallery-video-item video')) return;
    const source = video.querySelector('source');
    const path = source?.getAttribute('src') || source?.dataset.src || '';
    track('Video Played', {
      video_file: path.split('/').pop(),
      video_title: video.getAttribute('aria-label') || ''
    });
  }, true);

  // A choice made in one tab also applies to other already-open GD1 tabs.
  window.addEventListener('storage', (event) => {
    if (event.key !== CONSENT_KEY && event.key !== null) return;
    applyConsent(readConsent());
    if (consent === null) showPreferences();
    else banner.hidden = true;
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    applyConsent(readConsent());
    pageTracked = false;
    trackPage();
    if (consent === null) showPreferences();
  });

  if (consent === null && !privacyRequested) showPreferences();
  else start();
})();
