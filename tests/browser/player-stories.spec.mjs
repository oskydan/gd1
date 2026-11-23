import {test,expect} from 'playwright/test';
import fs from 'node:fs';
const players=JSON.parse(fs.readFileSync(new URL('../../data/players.json',import.meta.url),'utf8')).players.filter(p=>!p.draft);
for(const language of ['en','uk'])test(`${language}: published player stories open their shared profile pages`,async({page})=>{
 const suffix=language==='uk'?'-uk':'';
 await page.goto('/player-stories'+suffix+'.html');
 await expect(page.locator('.stories-count strong')).toHaveText(String(players.length));
 await expect(page.locator('.story-card')).toHaveCount(players.length);
 for(const player of players){
  const file=player.page.replace('.html',suffix+'.html');
  await page.goto('/player-stories'+suffix+'.html');
  const link=page.locator(`.story-card-link[href="${file}"]`);await expect(link).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await link.locator('.story-card-action').click();
  await expect(page).toHaveURL(new RegExp('/'+file+'$'));
  await expect(page.locator('h1')).toContainText(player.copy[language].name[0]);
  await expect(page.locator('.player-profile-instagram')).toHaveAttribute('href',player.instagram);
  await expect(page.locator('.player-profile-instagram')).toHaveAttribute('target','_blank');
  await expect(page.locator('.player-profile-portrait img')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.locator('.player-profile-portrait img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
