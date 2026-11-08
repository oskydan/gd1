// Exercise the real card renderers with a small DOM adapter, plus syntax checks.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))) execFileSync(process.execPath,['--check',path.join(root,name)]);
const code=fs.readFileSync(path.join(root,'script.js'),'utf8');
function run(lang,fixture,now='2026-11-07T12:00:00Z') {
  const clock={now:Date.parse(now)};
  const nodes=Object.fromEntries(['#home-camp-list','#upcoming-camps','#past-camps','#upcoming-empty','#past-empty','#past-camps-load-more'].map(id=>[id,{innerHTML:'',hidden:true,listeners:{},addEventListener(event,fn){this.listeners[event]=fn},insertAdjacentHTML(_,html){this.innerHTML+=html}}]));
  const ctx={URL,Date:class extends Date {static now(){return clock.now}},document:{documentElement:{lang},body:{dataset:{},classList:{contains(){return false}}},querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener(){}},window:{location:{href:'https://gd1.pro/',hash:'',search:''},addEventListener(){},setTimeout(){return 1},clearTimeout(){}}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'camps-data.js'),'utf8'),ctx);
  if(lang==='uk')vm.runInContext(fs.readFileSync(path.join(root,'camps-data-uk.js'),'utf8'),ctx);
  if(fixture)ctx.window.GD1_CAMPS=fixture(ctx.window.GD1_CAMPS);
  vm.runInContext(code,ctx);
  return {ctx,nodes,advance(time){clock.now=Date.parse(time);vm.runInContext('refreshCampState()',ctx)}};
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
  const past=run(lang,camps=>Array.from({length:25},(_,i)=>({...camps[0],id:`past-${i}`,page:'',startsOn:'2025-01-01',endsOn:'2025-01-02'}))).nodes;
  const count=()=>[...past['#past-camps'].innerHTML.matchAll(/class="camp-archive-card/g)].length;
  assert.equal(count(),12);assert.equal(past['#past-camps-load-more'].hidden,false);
  past['#past-camps-load-more'].onclick();assert.equal(count(),24);assert.equal(past['#past-camps-load-more'].hidden,false);
  past['#past-camps-load-more'].onclick();assert.equal(count(),25);assert.equal(past['#past-camps-load-more'].hidden,true);
  assert.ok(!past['#past-camps'].innerHTML.includes('camp-card-hitarea'));
  const linked=run(lang,camps=>[{...camps[0],id:'with-details',startsOn:'2025-01-01',endsOn:'2025-01-02'}, {...camps[0],id:'without-details',page:'',startsOn:'2025-01-01',endsOn:'2025-01-02'}]).nodes['#past-camps'].innerHTML;
  assert.equal([...linked.matchAll(/class="camp-card-hitarea"/g)].length,1);
  assert.ok(!linked.includes('target="_blank"'));
  for(const status of ['cancelled','registrationComingSoon','registrationClosed']) {
    const html=run(lang,camps=>[{...camps[0],[status]:true}]).nodes['#home-camp-list'].innerHTML;
    assert.ok(html.includes('aria-disabled="true"'));assert.ok(!html.includes('camp-card-hitarea'));assert.ok(!html.includes('target="_blank"'));
  }
  const empty=run(lang,()=>[]).nodes;assert.equal(empty['#upcoming-empty'].hidden,false);assert.equal(empty['#past-empty'].hidden,false);
}
console.log('Passed: JavaScript syntax, both languages, chronological cards, registration links/states, empty lists and 12-camp pagination.');

for (const [zone,end,instant] of [
  ['Europe/Prague','2026-12-26','2026-12-26T23:00:00Z'],
  ['Europe/Vilnius','2026-12-30','2026-12-30T22:00:00Z'],
  ['Europe/Sofia','2027-04-11','2027-04-11T21:00:00Z'],
  ['Europe/Prague','2027-03-28','2027-03-28T22:00:00Z'],
  ['Europe/Prague','2027-10-31','2027-10-31T23:00:00Z'],
  ['Europe/Sofia','2027-03-28','2027-03-28T21:00:00Z']
]) for (const lang of ['en','uk']) {
  const before=new Date(Date.parse(instant)-1).toISOString();
  const fixture=camps=>[{...camps[0],id:'boundary',startsOn:end,endsOn:end,timeZone:zone}];
  const result=run(lang,fixture,before);
  assert.ok(result.nodes['#upcoming-camps'].innerHTML.includes('target="_blank"'));
  result.advance(instant);
  assert.equal(result.nodes['#upcoming-camps'].innerHTML,'');
  assert.equal(result.nodes['#home-camp-list'].innerHTML.includes('data-camp-id="boundary"'),false);
  assert.ok(result.nodes['#past-camps'].innerHTML.includes(lang==='uk'?'Кемп завершено':'Camp Completed'));
  assert.ok(!result.nodes['#past-camps'].innerHTML.includes('target="_blank"'));
  assert.ok(result.nodes['#past-camps'].innerHTML.includes('aria-disabled="true"'));
}
console.log('Passed: exact camp-local midnight, summer/winter offsets and DST transitions in both languages.');
