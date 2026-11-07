import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
function element(){return {listeners:{},addEventListener(e,f){this.listeners[e]=f},focus(){this.focused=true},removeAttribute(key){delete this[key]}}}
const image=element(),caption=element(),count=element(),close=element(),prev=element(),next=element(),stage=element();
const elements={'.gallery-lightbox-image':image,'.gallery-lightbox-caption':caption,'.gallery-lightbox-count':count,'.gallery-lightbox-close':close,'.gallery-lightbox-prev':prev,'.gallery-lightbox-next':next,'.gallery-lightbox-stage':stage};
const dialog={...element(),querySelector:s=>elements[s],showModal(){this.open=true},close(){this.open=false;this.listeners.close()}};
const photos=Array.from({length:3},(_,i)=>({src:`photo-${i}.webp`,srcset:`photo-${i}.webp 1600w`,alt:`Photo ${i}`}));
const buttons=photos.map(photo=>({...element(),querySelector(){return photo}}));
const body={style:{overflow:'auto'}};
const ctx={document:{body,getElementById:id=>id==='gallery-lightbox'?dialog:null,querySelectorAll:s=>s==='.gallery-photo-open'?buttons:[]},window:{location:{hash:''},addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'gallery.js'),'utf8'),ctx);
buttons[1].listeners.click();assert.ok(dialog.open);assert.equal(image.src,photos[1].src);assert.equal(count.textContent,'2 / 3');assert.equal(body.style.overflow,'hidden');assert.ok(close.focused);
next.listeners.click();assert.equal(image.src,photos[2].src);
next.listeners.click();assert.equal(image.src,photos[0].src);
prev.listeners.click();assert.equal(image.src,photos[2].src);
dialog.listeners.keydown({key:'ArrowLeft',preventDefault(){}});assert.equal(image.src,photos[1].src);
stage.listeners.touchstart({touches:[{clientX:200,clientY:100}]});stage.listeners.touchend({changedTouches:[{clientX:80,clientY:110}]});assert.equal(image.src,photos[2].src);
assert.equal(caption.textContent,photos[2].alt);
close.listeners.click();assert.equal(body.style.overflow,'auto');assert.ok(buttons[1].focused);assert.ok(!dialog.open);assert.equal(image.src,undefined);
for(const name of ['gallery.html','gallery-uk.html']) {
  const html=fs.readFileSync(path.join(root,name),'utf8');
  assert.equal((html.match(/class="gallery-photo-open"/g)||[]).length,24);
  assert.ok(html.includes('<dialog class="gallery-lightbox"'));
}
console.log('Passed: photo selection, arrows/wrapping, keyboard, swipe, captions, scroll/focus restoration and both languages.');
