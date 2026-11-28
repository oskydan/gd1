import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const host = 'https://gd1-card-analytics.example';

async function profile(page, player, language, privacy = 'allowed') {
  await page.addInitScript((choice) => {
    localStorage.setItem('gd1_analytics_consent_v2', JSON.stringify({
      allowed: choice !== 'rejected',
      savedAt: Date.now()
    }));
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: choice === 'gpc' });
    Object.defineProperty(navigator, 'doNotTrack', { value: choice === 'dnt' ? '1' : null });
    window.events = [];
    window.mixpanel = {
      init(_token, options) {
        options.loaded({
          track: (name, props) => window.events.push({ name, props }),
          opt_in_tracking() {},
          opt_out_tracking() {},
          start_session_recording() {}
        });
      }
    };
    document.addEventListener('click', (event) => {
      if (event.target.closest('a')) event.preventDefault();
    });
  }, privacy);
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== host) return route.abort();
    const file = path.join(root, url.pathname);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
    return route.fulfill({ path: file });
  });
  const suffix = language === 'uk' ? '-uk' : '';
  await page.goto(`${host}/${player}${suffix}.html?test=omitted`);
  return page.locator('.player-profile-card-download');
}

for (const [player, language, name] of [
  ['yaroslav-skydan', 'en', 'Yaroslav Skydan'],
  ['denys-honcharenko', 'uk', 'Денис Гончаренко']
]) {
  test(`PDF activations include the stable player identity on ${player} (${language})`, async ({ page }) => {
    const link = await profile(page, player, language);
    await expect(link).toHaveAttribute('target', '_blank');
    await link.click();
    await link.press('Enter');
    await link.dispatchEvent('auxclick', { button: 1 });
    await link.dispatchEvent('auxclick', { button: 2 });
    await page.locator('.player-profile-card-pair img').first().click();

    const events = await page.evaluate(() => window.events.filter(({ name }) => name !== 'Page Viewed'));
    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event).toMatchObject({
        name: 'Player Card Opened',
        props: {
          player_id: player,
          player_name: name,
          page_language: language,
          page_type: 'player_profile',
          destination_path: `/assets/players/${player}-card-print.pdf`,
          document_format: 'pdf',
          placement: 'player_profile'
        }
      });
      expect(JSON.stringify(event.props)).not.toMatch(/test=|\?v=/);
    }
  });
}

for (const privacy of ['rejected', 'gpc', 'dnt']) {
  test(`player card activity respects ${privacy}`, async ({ page }) => {
    const link = await profile(page, 'yaroslav-skydan', 'en', privacy);
    // Use native activation so the consent banner does not obscure the test target.
    await link.evaluate((element) => element.click());
    expect(await page.evaluate(() => window.events)).toEqual([]);
  });
}

test('general navigation emits a sanitized link event', async ({ page }) => {
  await profile(page, 'yaroslav-skydan', 'en');
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = 'coach.html?private=value#private-fragment';
    document.querySelector('main').append(link);
    link.click();
  });
  const clicks = await page.evaluate(() => window.events.filter(({ name }) => name === 'Site Link Clicked'));
  expect(clicks).toHaveLength(1);
  expect(clicks[0].props).toMatchObject({ placement: 'content', destination_path: '/coach.html' });
  expect(JSON.stringify(clicks[0].props)).not.toMatch(/private=value|private-fragment/);
});
