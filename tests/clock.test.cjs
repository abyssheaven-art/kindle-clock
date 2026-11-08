const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createRuntime}=require('./runtime.cjs');
const path=require('node:path');
const root=process.env.CLOCK_TEST_ROOT || path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('404 fallback has the same implementation',()=>{assert.equal(fs.readFileSync(path.join(root,'404.html'),'utf8'),html);});
const start='2026-11-08T11:40:00Z';
const offline={offline:true};
test('clock advances at minute boundaries without network',()=>{
 const r=createRuntime(html,start,offline);r.advance(59999);assert.equal(r.time(),'20:40');r.advance(102);assert.equal(r.time(),'20:41');r.advance(120000);assert.equal(r.time(),'20:43');assert.equal(r.errors.length,0);
});
test('one rendering exception cannot end minute updates',()=>{
 const r=createRuntime(html,start,offline);r.advance(500);r.failNextLayout();r.advance(180000);assert.equal(r.time(),'20:43');assert.equal(r.errors.length,0);
});
test('backup recovers a dropped minute timeout',()=>{
 const r=createRuntime(html,start,offline);r.advance(500);
 const minute=[...r.tasks.values()].find(t=>t.at-r.now()>59000&&t.at-r.now()<60000);assert.ok(minute);r.tasks.delete(minute.id);
 r.advance(75000);assert.equal(r.time(),'20:41');
});
test('backup check makes no text changes inside the same minute',()=>{
 const r=createRuntime(html,start,offline);r.advance(500);const before=r.writes.length;r.advance(59000);assert.equal(r.writes.length,before);
});
for(const event of ['pageshow','focus','touchend','click'])test(event+' immediately catches up after suspension',()=>{
 const r=createRuntime(html,start,offline);r.tasks.clear();r.setNow('2026-11-08T11:47:30Z');r.fire('window',event);assert.equal(r.time(),'20:47');assert.ok(r.tasks.size>=2);r.advance(30101);assert.equal(r.time(),'20:48');
});
for(const event of ['visibilitychange','webkitvisibilitychange'])test(event+' catches up when visible',()=>{
 const r=createRuntime(html,start,offline);r.tasks.clear();r.setNow('2026-11-08T11:47:30Z');r.document.hidden=true;r.document.webkitHidden=true;
 r.fire('document',event);assert.equal(r.time(),'20:40');r.document.hidden=false;r.document.webkitHidden=false;r.fire('document',event);assert.equal(r.time(),'20:47');
});
test('quiet hours suspend minute and recovery checks until 05:30',()=>{
 const r=createRuntime(html,'2026-11-08T15:59:59Z',offline);r.advance(1101);assert.equal(r.elements.stage.className,'quietSleep');
 assert.equal([...r.tasks.values()].filter(t=>!t.interval&&t.at-r.now()<60*1000).length,0);
 const before=r.writes.length;r.advance(4.5*60*60*1000-1);assert.equal(r.time(),'05:30');assert.equal(r.elements.stage.className.startsWith('sleeping'),true);assert.equal(r.writes.length-before,2);
});
test('wake from quiet hours catches up immediately',()=>{
 const r=createRuntime(html,'2026-11-08T17:00:00Z',offline);r.tasks.clear();r.setNow('2026-11-08T20:42:00Z');r.fire('window','pageshow');assert.equal(r.time(),'05:42');assert.equal(r.elements.stage.className.startsWith('sleeping'),true);
});
test('unfinished sync is aborted and does not block clock or hourly retry',()=>{
 const r=createRuntime(html,start);const first=r.requests[0];r.advance(15001);assert.equal(first.aborted,true);r.advance(450100);assert.equal(r.time(),'20:47');r.advance(3600000);assert.ok(r.requests.length>=2);
});
test('HTTP error Date header cannot reset the clock',()=>{
 const r=createRuntime(html,start);r.requests[0].respond(503,'Sun, 08 Nov 2026 01:00:00 GMT');assert.equal(r.time(),'20:40');r.advance(60101);assert.equal(r.time(),'20:41');
});
test('successful sync applies only once at completion',()=>{
 const r=createRuntime(html,start);const x=r.requests[0];x.respond(200,'Sun, 08 Nov 2026 11:42:00 GMT',2);assert.equal(r.time(),'20:40');x.respond(200,'Sun, 08 Nov 2026 11:42:00 GMT',4);assert.equal(r.time(),'20:42');const before=r.writes.length;x.respond(200,'Sun, 08 Nov 2026 11:42:00 GMT',4);assert.equal(r.writes.length,before);r.advance(60101);assert.equal(r.time(),'20:43');
});
test('late sync after suspension cannot drag time backwards',()=>{
 const r=createRuntime(html,start);const x=r.requests[0];r.setNow('2026-11-08T11:50:00Z');x.respond(200,'Sun, 08 Nov 2026 11:40:00 GMT',4);r.fire('window','focus');assert.equal(r.time(),'20:50');
});
test('cleaning flash remains at 06:00, 12:00, 18:00',()=>{
 for(const utcHour of ['21','03','09']){
  const r=createRuntime(html,'2026-11-08T'+utcHour+':00:00Z',offline);assert.equal(r.elements.cleaningFlash.style.display,'block');r.advance(7601);assert.equal(r.elements.cleaningFlash.style.display,'none');assert.ok(r.window.replaced.includes('?reload='));
 }
});

test('updates remain live across two days and quiet-hour transitions',()=>{
 const r=createRuntime(html,start,offline);r.advance(48*60*60*1000+101);assert.equal(r.time(),'20:40');assert.equal(r.elements.stage.className,'awake');assert.equal(r.errors.length,0);assert.ok(r.tasks.size<=4);
});

test('clock paint area is rebuilt only for a changed visible minute',()=>{
 const r=createRuntime(html,start,offline);r.advance(500);
 const paint=()=>r.styleWrites.filter(w=>w.id==='clock');
 assert.deepEqual(paint().map(w=>w.value),['none','']);
 r.advance(59000);assert.equal(paint().length,2);
 r.advance(1000);assert.deepEqual(paint().map(w=>w.value),['none','','none','']);
 assert.equal(r.elements.clock.style.display,'');
 const night=createRuntime(html,'2026-11-08T17:15:00Z',offline);night.advance(60000);
 assert.equal(night.styleWrites.filter(w=>w.id==='clock').length,0);
});

test('failed repaint restores the visible clock and later updates continue',()=>{
 const r=createRuntime(html,start,offline);r.advance(500);let throwOnce=true;
 Object.defineProperty(r.elements.clock,'offsetHeight',{get:()=>{if(throwOnce&&r.elements.clock.style.display==='none'){throwOnce=false;throw new Error('paint layout failed');}return 200;}});
 r.advance(60000);assert.equal(r.elements.clock.style.display,'');r.advance(120000);assert.equal(r.time(),'20:43');assert.equal(r.errors.length,0);
});
