// Exercise the real card renderers with a small DOM adapter, plus syntax checks.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))) execFileSync(process.execPath,['--check',path.join(root,name)]);
const code=fs.readFileSync(path.join(root,'script.js'),'utf8');
function run(lang,fixture) {
  const nodes=Object.fromEntries(['#home-camp-list','#upcoming-camps','#past-camps','#upcoming-empty','#past-empty','#past-camps-load-more'].map(id=>[id,{innerHTML:'',hidden:true,listeners:{},addEventListener(event,fn){this.listeners[event]=fn},insertAdjacentHTML(_,html){this.innerHTML+=html}}]));
  const ctx={URL,Date:class extends Date {static now(){return new Date('2026-11-07T12:00:00Z').getTime()}},document:{documentElement:{lang},body:{dataset:{},classList:{contains(){return false}}},querySelector:s=>nodes[s]||null,querySelectorAll:()=>[]},window:{location:{href:'https://gd1.pro/',hash:'',search:''},addEventListener(){}}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'camps-data.js'),'utf8'),ctx);
  if(lang==='uk')vm.runInContext(fs.readFileSync(path.join(root,'camps-data-uk.js'),'utf8'),ctx);
  if(fixture)ctx.window.GD1_CAMPS=fixture(ctx.window.GD1_CAMPS);
  vm.runInContext(code,ctx);
  return {ctx,nodes};
}
for(const lang of ['en','uk']) {
  const {ctx,nodes}=run(lang);
  const actual=[...nodes['#home-camp-list'].innerHTML.matchAll(/data-camp-id="([^"]+)"/g)].map(m=>m[1]);
  const expected=ctx.window.GD1_CAMPS.filter(c=>c.endsOn>='2026-11-07').sort((a,b)=>a.startsOn.localeCompare(b.startsOn)).slice(0,3).map(c=>c.id);
  assert.deepEqual(actual,Array.from(expected));
  const order=run(lang,camps=>[3,1,2].map(i=>({...camps[0],id:`order-${i}`,startsOn:`2030-01-0${i}`,endsOn:`2030-01-0${i}`}))).nodes['#home-camp-list'].innerHTML;
  assert.deepEqual([...order.matchAll(/data-camp-id="([^"]+)"/g)].map(m=>m[1]),['order-1','order-2','order-3']);
  for(const c of ctx.window.GD1_CAMPS.filter(c=>actual.includes(c.id))) {
    for(const selector of ['#home-camp-list','#upcoming-camps']) {
      const html=nodes[selector].innerHTML;
      assert.ok(html.includes(`href="${c.registrationUrl}" target="_blank" rel="noopener noreferrer"`));
      assert.ok(html.includes(`href="${c.page}"`));
    }
    assert.ok(c.imageAlt && c.title && c.shortDescription && c.longDescription);
  }
  // Supply enough historic camps to exercise both intermediate and final batches.
  const past=run(lang,camps=>Array.from({length:25},(_,i)=>({...camps[0],id:`past-${i}`,startsOn:'2025-01-01',endsOn:'2025-01-02'}))).nodes;
  const count=()=>[...past['#past-camps'].innerHTML.matchAll(/class="camp-archive-card/g)].length;
  assert.equal(count(),12);assert.equal(past['#past-camps-load-more'].hidden,false);
  past['#past-camps-load-more'].listeners.click();assert.equal(count(),24);assert.equal(past['#past-camps-load-more'].hidden,false);
  past['#past-camps-load-more'].listeners.click();assert.equal(count(),25);assert.equal(past['#past-camps-load-more'].hidden,true);
  assert.ok(!past['#past-camps'].innerHTML.includes('camp-card-hitarea'));
  for(const status of ['cancelled','registrationComingSoon','registrationClosed']) {
    const html=run(lang,camps=>[{...camps[0],[status]:true}]).nodes['#home-camp-list'].innerHTML;
    assert.ok(html.includes('aria-disabled="true"'));assert.ok(!html.includes('camp-card-hitarea'));assert.ok(!html.includes('target="_blank"'));
  }
  const empty=run(lang,()=>[]).nodes;assert.equal(empty['#upcoming-empty'].hidden,false);assert.equal(empty['#past-empty'].hidden,false);
}
console.log('Passed: JavaScript syntax, both languages, chronological cards, registration links/states, empty lists and 12-camp pagination.');
