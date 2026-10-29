'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const get=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=get('index.html');
const css=get('premium_v2.css');
const serviceWorker=get('sw.js');
const manifest=JSON.parse(get('manifest.webmanifest'));

function modules(){
 const window={};
 const ctx=vm.createContext({
   window,console,atob:text=>Buffer.from(text,'base64').toString('binary'),
 });
 for(const file of [
   'interaction_gate.js','workout_manager.js','workout_library.js',
   'duration_presets.js','training_modes.js','random_signals.js',
   'jsb_audio_samples.js','sound_engine.js','audio_cues.js',
   'pause_adjustments.js',
 ])vm.runInContext(get(file),ctx,{filename:file,timeout:3000});
 return window;
}

function sessionFor(workout,elapsed){
 const all=modules().JSBTrainingModes.phasePlan(workout);
 let total=0;
 const seq=all.map(p=>{const stage={...p,start:total};total+=p.ms;return stage;});
 return {workout:{...workout},seq,total,elapsed,base:0,paused:true,
         finished:false,index:-1,lastCueMs:elapsed,cueTimes:[]};
}

test('HTML is self contained and syntactically valid',()=>{
 const dependencies=[...html.matchAll(/<script\s+src="\.\/([^"]+)"\s*>/g)]
  .map(m=>m[1]);
 assert.equal(dependencies.length,10);
 for(const file of dependencies){
   assert.ok(fs.existsSync(path.join(root,file)),file);
   assert.ok(serviceWorker.includes(file),file+' not cached');
 }
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
   .map(m=>m[1]).filter(x=>x.trim());
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script));
 for(const file of ['premium_v2.css','manifest.webmanifest','icon.svg','sw.js']){
   assert.ok(fs.existsSync(path.join(root,file)),file);
 }
 assert.ok(html.includes('navigator.serviceWorker.register'));
 assert.ok(!html.includes('jsb_native_bridge.js'));
});

test('four independent spaces and a settings cog top right',()=>{
 const nav=html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav);
 const tabs=[...nav.matchAll(/data-nav="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(tabs,['randori','tabata','chrono','luc-leger']);
 assert.ok(!nav.includes('data-nav="settings"'));
 assert.ok(!nav.includes('data-nav="history"'));
 const header=html.slice(html.indexOf('<header>'),html.indexOf('</header>')+9);
 assert.ok(header.includes('id="settingsQuick"'));
 assert.ok(header.includes('aria-label="Ouvrir les réglages"'));
 assert.ok(css.includes('#settingsQuick[aria-pressed="true"]'));
 for(const section of ['view-randori','view-tabata','view-chrono',
   'view-luc-leger','view-settings']){
   assert.ok(html.includes('id="'+section+'"'),section);
 }
 assert.ok(!html.includes('id="view-history"'));
 assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
});

test('start screen restores the last actually started timer, never autoplays',()=>{
 assert.ok(html.includes("read('jsb_v2_recent_workout',null)"));
 assert.ok(html.includes("safeWrite('jsb_v2_last_started_tab',lastTimerTab)"));
 assert.ok(html.includes("const persistedTab=read('jsb_v2_last_started_tab',null)"));
 assert.ok(html.includes("recentWorkout?tabForTimer(recentWorkout.kind):'randori'"));
 assert.ok(html.includes('navigate(initialTab)'));
 assert.ok(!html.includes('startWorkout(recentWorkout)'));
 assert.ok(html.includes("navigate($('view-settings').classList.contains('active')?lastTrainingView:'settings')"));
 assert.ok(html.includes("lastTrainingView=view"));
 assert.ok(html.includes("if(view!=='settings')lastTrainingView=view"));
 for(const name of ['randori','golden','tabata','chrono','random']){
   assert.ok(html.includes("'"+name+"'"),name);
 }
});

test('Luc Léger has its own page and cannot be started with unverified pacing',()=>{
 const start=html.indexOf('<section id="view-luc-leger"');
 const end=html.indexOf('<section id="view-settings"',start);
 assert.ok(start>=0&&end>start);
 const view=html.slice(start,end);
 assert.ok(view.includes('Test Luc Léger'));
 assert.ok(view.includes('20 mètres'));
 assert.ok(view.includes('disabled'));
 assert.match(view,/protocole/i);
 assert.ok(!html.includes('id="showLucLeger"'));
 assert.ok(!html.includes('id="lucLegerCategory"'));
});

test('existing customized sessions survive, although History is not in the menu',()=>{
 for(const store of ['jsb_preview_customs','jsb_preview_settings',
   'jsb_preview_favorites','jsb_v2_mode_settings']){
   assert.ok(html.includes(store),store);
 }
 assert.ok(html.indexOf('id="libraryDetails"')>
   html.indexOf('<section id="view-settings"'));
 assert.ok(html.includes('id="presetList"'));
 assert.ok(html.includes('id="workoutSearch"'));
});

test('the existing combat, Tabata, chronometer and reaction modes still work',()=>{
 const api=modules().JSBTrainingModes;
 assert.equal(api.phasePlan({kind:'golden',prep:0,work:0,rest:0,cycles:1})[0].ms,Infinity);
 assert.equal(api.phasePlan({kind:'chrono',prep:0,work:0,rest:0,cycles:1})[0].label,'CHRONOMÈTRE');
 const randori=api.phasePlan({kind:'randori',prep:10,work:240,rest:60,cycles:5});
 assert.equal(randori.filter(p=>p.kind==='effort').length,5);
 assert.equal(randori.filter(p=>p.kind==='rest').length,4);
 const tabata=api.phasePlan({kind:'tabata',prep:10,work:20,rest:10,cycles:8});
 assert.equal(tabata.filter(p=>p.kind==='effort').length,8);
 assert.equal(tabata.filter(p=>p.kind==='rest').length,7);
 assert.equal(api.workoutDuration({kind:'tabata',prep:10,work:20,rest:10,cycles:8}),240);
});

test('the paused edit UI is accessible and only shown when paused',()=>{
 for(const id of ['adjustTimeBtn','pauseTimeDialog','pauseTimeForm',
   'adjustCurrentMin','adjustCurrentSec','adjustEffortMin','adjustEffortSec',
   'adjustRestMin','adjustRestSec','pauseTimeFeedback','cancelPauseTime']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes("window.JSBPauseAdjustments.applyPausedEdit(session,changes"));
 assert.ok(html.includes("!session.paused||!['randori','tabata','golden'].includes"));
 assert.ok(html.includes("modalBusy=true"));
 assert.ok(html.includes("modalBusy=false"));
 assert.ok(css.includes('.adjust-time-trigger[hidden]'));
 assert.ok(css.includes('.adjust-number input:focus-visible'));
});

test('editing a paused Randori preserves elapsed time and adjusts future phases',()=>{
 const {JSBPauseAdjustments:edit}=modules();
 const workout={kind:'randori',name:'Randori',prep:10,work:240,rest:60,cycles:3};
 const session=sessionFor(workout,80000);
 const result=edit.applyPausedEdit(session,{
   displaySeconds:120,effortSeconds:180,restSeconds:45,
 },{countdown:true});
 assert.equal(session.elapsed,80000);
 assert.equal(session.seq[1].ms,190000); // 70s elapsed + 120s remaining
 assert.equal(session.seq[2].ms,45000);
 assert.equal(session.seq[3].ms,180000);
 assert.equal(session.workout.work,180);
 assert.equal(session.workout.rest,45);
 assert.equal(result.phase,'effort');
 assert.ok(result.nextCueTimes.length>0);
});

test('editing a paused Tabata preserves phase and modifies upcoming cycles',()=>{
 const {JSBPauseAdjustments:edit}=modules();
 const session=sessionFor({
   kind:'tabata',name:'Tabata',prep:10,work:20,rest:10,cycles:3,
 },25000);
 const result=edit.applyPausedEdit(session,{
   displaySeconds:15,effortSeconds:30,restSeconds:15,
 },{countdown:true});
 assert.equal(session.elapsed,25000);
 assert.equal(session.seq[1].ms,30000);
 assert.equal(session.seq[2].ms,15000);
 assert.equal(session.seq[3].ms,30000);
 assert.equal(result.phase,'effort');
});

test('editing Golden Score changes the elapsed display, never its infinite duration',()=>{
 const {JSBPauseAdjustments:edit}=modules();
 const session=sessionFor({kind:'golden',name:'Golden Score',
   prep:0,work:0,rest:0,cycles:1},96000);
 edit.applyPausedEdit(session,{displaySeconds:120},{countdown:true});
 assert.equal(session.elapsed,120000);
 assert.equal(session.total,Infinity);
 assert.equal(session.seq[0].ms,Infinity);
 assert.equal(session.workout.kind,'golden');
});

test('editing while running or with impossible values is rejected safely',()=>{
 const {JSBPauseAdjustments:edit}=modules();
 const session=sessionFor({kind:'randori',name:'Randori',
   prep:10,work:180,rest:30,cycles:2},50000);
 session.paused=false;
 assert.throws(()=>edit.applyPausedEdit(session,{
   displaySeconds:20,effortSeconds:180,restSeconds:30,
 }),/pause/);
 session.paused=true;
 assert.throws(()=>edit.applyPausedEdit(session,{
   displaySeconds:0,effortSeconds:180,restSeconds:30,
 }),/valide/);
 assert.equal(session.elapsed,50000);
});

test('the four real sports alert WAV files are distinct, loud, and local',()=>{
 const app=modules();
 const audio=app.JSBSoundEngine;
 const ids=['buzzerPro','bellSport','whistlePro','hornPro'];
 assert.deepEqual(Array.from(audio.SOUNDS,s=>s.id),ids);
 const hashes=new Set();
 for(const id of ids){
   const source=Buffer.from(app.JSBRealSignals.getWavBase64(id),'base64');
   assert.equal(source.toString('ascii',0,4),'RIFF');
   assert.ok(source.length>5000);
   const hash=crypto.createHash('sha256').update(source).digest('hex');
   assert.ok(!hashes.has(hash),id);
   hashes.add(hash);
 }
 for(const wav of ['buzzer_combat','cloche_ring','sifflet_arbitre','corne_sportive']){
   assert.ok(fs.existsSync(path.join(root,'assets/audio/'+wav+'.wav')));
 }
 assert.ok(html.includes('id="signalGallery"'));
 assert.ok(html.includes('soundEngine.activateAndPlay'));
 assert.ok(html.includes('ne peut pas réduire automatiquement Spotify'));
});

test('offline cache includes all new interface and timer dependencies',()=>{
 assert.ok(serviceWorker.includes('moniteur-jsb-web-v34'));
 for(const file of ['premium_v2.css','pause_adjustments.js',
   'jsb_audio_samples.js','sound_engine.js','audio_cues.js']){
   assert.ok(serviceWorker.includes(file),file);
 }
 assert.equal(manifest.theme_color,'#1F293B');
 assert.equal(manifest.background_color,'#1F293B');
});

test('Randori random beep settings are accessible, saved and remain optional',()=>{
 for(const id of ['randoriBipsField','randoriRandomBips','randoriBipFrequency',
   'randoriBipFrequencyField'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes("randomBips:$('randoriRandomBips').checked"));
 assert.ok(html.includes("randomBipFrequency:$('randoriBipFrequency').value"));
 assert.ok(html.includes("session.workout.kind==='randori'&&session.workout.randomBips===true"));
 assert.ok(html.includes("beep('random')"));
 assert.ok(html.includes("session.signals=randomSignals.createSignalsForPhases(session.seq"));
});

test('Randori random cues happen during combats only, never in rest or preparation',()=>{
 const {JSBTrainingModes:mode,JSBRandomSignals:random}=modules();
 const seq=mode.phasePlan({kind:'randori',name:'Randori',prep:10,work:240,rest:60,cycles:3});
 let start=0;for(const p of seq){p.start=start;start+=p.ms;}
 const cues=random.createSignalsForPhases(seq,{frequency:'high',rng:()=>0});
 assert.ok(cues.length>0);
 assert.ok(cues.every(at=>seq.some(p=>p.kind==='effort'&&at>p.start&&at<p.start+p.ms)));
 assert.ok(cues.some(at=>at>=seq[3].start));
 assert.deepEqual(cues,[...cues].sort((a,b)=>a-b));
 assert.equal(random.createSignalsForPhases(seq.filter(p=>p.kind!=='effort'),{rng:()=>0}).length,0);
});

test('very short combats do not receive random signals near phase boundaries',()=>{
 const random=modules().JSBRandomSignals;
 const seq=[
  {kind:'prep',start:0,ms:10000},
  {kind:'effort',start:10000,ms:6000},
  {kind:'rest',start:16000,ms:3000},
  {kind:'effort',start:19000,ms:6000}
 ];
 assert.equal(random.createSignalsForPhases(seq,{frequency:'high',rng:()=>0}).length,0);
});
