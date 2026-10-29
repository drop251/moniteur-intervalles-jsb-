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
 assert.ok(serviceWorker.includes('moniteur-jsb-web-v38'));
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

test('Tabata and Chronomètre settings share the Randori large editor',()=>{
 for(const id of ['editorForm','effortField','reposField','cyclesField','editorMore',
   'chronoStartField','chronoStartHint','saveWorkout','launchConfigured'])
   assert.ok(html.includes('id="'+id+'"'),id);
 for(const option of ['0','10','30'])assert.ok(html.includes('data-chrono-prep="'+option+'"'));
 assert.ok(html.includes('function formatTabataName('));
 assert.ok(html.includes('syncTabataName();'));
 assert.ok(html.includes('syncChronoStartOptions();'));
 assert.ok(html.includes("$('closeEditor').focus({preventScroll:true})"));
 assert.ok(css.includes('.chrono-start-choices button[aria-pressed="true"]'));
 assert.ok(html.includes("modeSettings[w.id]={...w};safeWrite('jsb_v2_mode_settings',modeSettings)"));
});

test('Tabata totals and Chronomètre start delays match their configured modes',()=>{
 const modes=modules().JSBTrainingModes;
 const w={kind:'tabata',prep:10,work:30,rest:15,cycles:12};
 const seq=modes.phasePlan(w);
 assert.equal(seq.filter(p=>p.kind==='effort').length,12);
 assert.equal(seq.filter(p=>p.kind==='rest').length,11);
 assert.equal(modes.workoutDuration(w),10+12*30+11*15);
 for(const prep of [0,10,30]){
  const free={kind:'chrono',prep,work:0,rest:0,cycles:1};
  const stages=modes.phasePlan(free);
  assert.equal(stages[stages.length-1].ms,Infinity);
  assert.equal(stages[0].kind,prep>0?'prep':'effort');
  assert.equal(modes.workoutDuration(free),Infinity);
 }
});

test('Tabata title follows work, rest and cycles with editable custom naming',()=>{
 const a=html.indexOf('function formatTabataName(');
 const b=html.indexOf('function syncTabataName(){',a);
 assert.ok(a>=0&&b>a);
 const formatter=new Function('durationPresets',html.slice(a,b)+'return formatTabataName;');
 const fmt=formatter(modules().JSBDurationPresets);
 assert.equal(fmt(8,20,10),'Tabata 8 × 20 s / 10 s');
 assert.equal(fmt(12,30,15),'Tabata 12 × 30 s / 15 s');
 assert.equal(fmt(3,90,30),'Tabata 3 × 1 min 30 s / 30 s');
 assert.equal(fmt(0,20,10),null);
 assert.ok(html.includes('autoTabataName=false'));
});

test('Chronomètre quick-start choices synchronize selected value and custom delay',()=>{
 const a=html.indexOf('function syncChronoStartOptions(){');
 const b=html.indexOf('function syncRandoriName(){',a);
 assert.ok(a>=0&&b>a);
 const buttons=[0,10,30].map(n=>({
   dataset:{chronoPrep:String(n)},pressed:false,
   setAttribute(key,value){if(key==='aria-pressed')this.pressed=value==='true';}
 }));
 const controls={
   preparation:{value:'0'},
   chronoStartHint:{textContent:''},
 };
 const fn=new Function('$','document','durationPresets',html.slice(a,b)+'return syncChronoStartOptions;')(
   id=>controls[id],
   {querySelectorAll:()=>buttons},
   modules().JSBDurationPresets
 );
 for(const seconds of [0,10,30,20]){
   controls.preparation.value=String(seconds);
   fn();
   const selected=buttons.filter(b=>b.pressed).map(b=>Number(b.dataset.chronoPrep));
   assert.deepEqual(selected,[0,10,30].includes(seconds)?[seconds]:[]);
   assert.match(controls.chronoStartHint.textContent,
     seconds===0?/immédiat/i:/départ après/i);
 }
});

test('All timer cards expose a separate accessible Settings button',()=>{
 const built=html.slice(html.indexOf('function buildModeOption(key)'),html.indexOf('function savedWorkoutCard(w)'));
 const saved=html.slice(html.indexOf('function savedWorkoutCard(w)'),html.indexOf('function renderSavedWorkouts()'));
 for(const part of [built,saved]){
  assert.ok(part.includes("edit.textContent='⚙ Régler'"));
  assert.ok(part.includes("edit.setAttribute('aria-haspopup','dialog')"));
  assert.ok(part.includes("edit.setAttribute('aria-controls','editorModal')"));
  assert.ok(part.includes("edit.addEventListener('click',()=>openEditor("));
  assert.ok(part.includes('controls.append(edit,play)'));
 }
 assert.ok(css.includes('#editorModal.modal.active'));
 assert.ok(css.includes('z-index:200'));
});

test('real Settings click opens the editor for every timer mode without starting',()=>{
 const openA=html.indexOf('function openEditor(workout=null,requestedKind=null){');
 const openB=html.indexOf('const durationLimits=',openA);
 const cardA=html.indexOf('function buildModeOption(key)');
 const cardB=html.indexOf('function savedWorkoutCard(w)',cardA);
 assert.ok(openA>=0&&openB>openA&&cardA>=0&&cardB>cardA);
 const editorCode=html.slice(openA,openB);
 const normA=html.indexOf('function normalizedTabata(w){');
 const normB=html.indexOf('function formatTabataName(',normA);
 const normalizer=html.slice(normA,normB);
 const cardCode=html.slice(cardA,cardB);
 class MockNode {
   constructor(){
     this.children=[];this.handlers={};this.attributes={};this.dataset={};
     this.value='';this.textContent='';this.className='';
     this.hidden=false;this.disabled=false;this.checked=false;
     const names=new Set();
     this.classList={add:v=>names.add(v),remove:v=>names.delete(v),contains:v=>names.has(v)};
   }
   append(...items){this.children.push(...items);}
   addEventListener(event,fn){this.handlers[event]=fn;}
   setAttribute(name,value){this.attributes[name]=value;}
   closest(){return new MockNode();}
   querySelector(){return new MockNode();}
   reset(){}
   focus(){this.focused=true;}
 }
 const els={};const $=id=>els[id]||(els[id]=new MockNode());
 const doc={activeElement:new MockNode(),querySelectorAll:()=>[],
   querySelector:()=>new MockNode(),createElement:()=>new MockNode()};
 const defaults=[
  {id:'randori',kind:'randori',name:'Randori',prep:10,work:240,rest:60,cycles:5},
  {id:'golden',kind:'golden',name:'Golden Score',prep:10,work:0,rest:0,cycles:1},
  {id:'tabata',kind:'tabata',name:'Tabata',prep:10,work:20,rest:10,cycles:8},
  {id:'chrono',kind:'chrono',name:'Chronomètre',prep:0,work:0,rest:0,cycles:1},
  {id:'random',kind:'random',name:'Bips aléatoires',prep:10,work:180,rest:0,cycles:1}
 ];
 let launched=0;
 const create=new Function('$','document','gate','trainingModes','standard',
   'primaryWorkout','modeOptionMeta','pretty','session','closeWorkoutMenus',
   'notice','syncAllDurationPickers','updateConfigDuration','applyMode','startWorkout',
   'let editorReturnFocus=null,editingWorkoutId=null,autoRandoriName=false,autoTabataName=false;'+
   normalizer+editorCode+cardCode+'return {buildModeOption};');
 const {buildModeOption}=create($,doc,{allow:()=>true},
   {isAvailable:kind=>defaults.some(w=>w.kind===kind),DEFAULTS:{},
    tabataStructure:modules().JSBTrainingModes.tabataStructure},
   defaults,w=>w,(kind,w)=>({title:w.name,description:kind}),String,
   null,()=>{},()=>{},()=>{},()=>{},()=>{},()=>{launched++});
 for(const w of defaults){
   const card=buildModeOption(w.id);
   const buttons=card.children.flatMap(node=>node.children||[]);
   const edit=buttons.find(node=>node.className==='mode-option-settings secondary');
   assert.ok(edit,w.id+' is missing Settings');
   assert.equal(edit.attributes['aria-controls'],'editorModal');
   edit.handlers.click();
   assert.ok($('editorModal').classList.contains('active'),w.id+' modal not opened');
   assert.equal($('workoutMode').value,w.kind);
   assert.equal(launched,0,'Settings should never launch a timer');
   $('editorModal').classList.remove('active');
   $('app').inert=false;
 }
});

test('native Safari dialog opens and closes for each timer without starting it',()=>{
 const openStart=html.indexOf('function openEditor(workout=null,requestedKind=null){');
 const openEnd=html.indexOf('const durationLimits=',openStart);
 const closeStart=html.indexOf('function closeEditor(){');
 const closeEnd=html.indexOf('function renderQuickPresets(){',closeStart);
 const normA=html.indexOf('function normalizedTabata(w){');
 const normB=html.indexOf('function formatTabataName(',normA);
 const cardStart=html.indexOf('function buildModeOption(key)');
 const cardEnd=html.indexOf('function savedWorkoutCard(w)',cardStart);
 assert.ok(openStart>=0&&openEnd>openStart&&closeStart>=0&&closeEnd>closeStart);
 class Node {
   constructor(){
     this.children=[];this.handlers={};this.attributes={};this.dataset={};
     this.value='';this.textContent='';this.className='';
     this.hidden=false;this.disabled=false;this.checked=false;
     this.open=false;this.isConnected=true;
     const set=new Set();
     this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)};
   }
   append(...x){this.children.push(...x);}
   setAttribute(k,v){this.attributes[k]=v;if(k==='open')this.open=true;}
   removeAttribute(k){delete this.attributes[k];if(k==='open')this.open=false;}
   addEventListener(k,fn){this.handlers[k]=fn;}
   closest(){return new Node();}
   querySelector(){return new Node();}
   reset(){}
   focus(){this.focused=true;}
   showModal(){this.open=true;this.openCount=(this.openCount||0)+1;}
   close(){this.open=false;this.closeCount=(this.closeCount||0)+1;}
 }
 const lookup={};const $=id=>lookup[id]||(lookup[id]=new Node());
 const doc={activeElement:new Node(),querySelectorAll:()=>[],
   querySelector:()=>new Node(),createElement:()=>new Node()};
 const kinds=[
   {id:'randori',kind:'randori',name:'Randori',prep:10,work:240,rest:60,cycles:5},
   {id:'golden',kind:'golden',name:'Golden Score',prep:10,work:0,rest:0,cycles:1},
   {id:'tabata',kind:'tabata',name:'Tabata',prep:10,work:20,rest:10,cycles:8},
   {id:'chrono',kind:'chrono',name:'Chronomètre',prep:0,work:0,rest:0,cycles:1},
   {id:'random',kind:'random',name:'Bips aléatoires',prep:10,work:180,rest:0,cycles:1},
 ];
 let started=0;
 const create=new Function('$','document','gate','trainingModes','standard','primaryWorkout',
   'modeOptionMeta','pretty','session','closeWorkoutMenus','notice','syncAllDurationPickers',
   'updateConfigDuration','applyMode','startWorkout','console',
   'let editorReturnFocus=null,editingWorkoutId=null,autoRandoriName=false,autoTabataName=false;'+
   html.slice(normA,normB)+html.slice(openStart,openEnd)+html.slice(closeStart,closeEnd)+
   html.slice(cardStart,cardEnd)+'return {openEditor,closeEditor,buildModeOption};');
 const app=create($,doc,{allow:()=>true},{isAvailable:k=>kinds.some(w=>w.kind===k),DEFAULTS:{},
    tabataStructure:modules().JSBTrainingModes.tabataStructure},
   kinds,w=>w,(kind,w)=>({title:w.name,description:kind}),String,null,
   ()=>{},()=>{},()=>{},()=>{},()=>{},()=>{started++;},console);
 for(const w of kinds){
   const card=app.buildModeOption(w.kind);
   const buttons=card.children.flatMap(node=>node.children||[]);
   const edit=buttons.find(node=>node.className==='mode-option-settings secondary');
   assert.ok(edit,w.kind+' edit button missing');
   edit.handlers.click();
   assert.equal($('editorModal').open,true,w.kind+' showModal did not open');
   assert.equal($('editorModal').classList.contains('active'),true);
   assert.equal($('workoutMode').value,w.kind);
   assert.equal(started,0);
   app.closeEditor();
   assert.equal($('editorModal').open,false,w.kind+' modal remained open');
   assert.equal($('editorModal').classList.contains('active'),false);
 }
 assert.equal($('editorModal').openCount,kinds.length);
 assert.equal($('editorModal').closeCount,kinds.length);
 assert.ok(html.includes("navigator.serviceWorker.addEventListener('controllerchange'"));
 assert.ok(html.includes('<dialog class="modal" id="editorModal"'));
 assert.ok(css.includes('#editorModal::backdrop'));
});

test('every literal editor lookup refers to a real DOM id (regression iPhone settings)',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const lookups=[...html.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 const missing=[...new Set(lookups)].filter(id=>!ids.has(id));
 assert.deepEqual(missing,[], 'Missing element IDs make Settings fail when tapped');
 assert.ok(ids.has('reposField'));
 assert.ok(!html.includes("$('restField')"));
});

test('the actual applyMode implementation runs for all five timers',()=>{
 const begin=html.indexOf('function applyMode(){');
 const end=html.indexOf('function closeEditor(){',begin);
 assert.ok(begin>=0&&end>begin);
 const source=html.slice(begin,end);
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const ui=new Map();
 const $=id=>{
   assert.ok(ids.has(id),'Unknown element: '+id);
   if(!ui.has(id))ui.set(id,{value:'',textContent:'',hidden:false,disabled:false,checked:false,
     setAttribute(name,value){this[name]=value;}});
   return ui.get(id);
 };
 let refreshes=0;
 const apply=new Function('$','syncAllDurationPickers','updateConfigDuration','renderQuickPresets',
   ('const document={querySelector:()=>({classList:{toggle:()=>{}}})};'+source+'return applyMode;'))($,()=>{refreshes++},()=>{refreshes++},()=>{refreshes++});
 for(const kind of ['randori','golden','tabata','chrono','random']){
   $('workoutMode').value=kind;
   apply();
   assert.equal($('reposField').hidden,['golden','chrono','random'].includes(kind));
   assert.equal($('effortField').hidden,['golden','chrono'].includes(kind));
   assert.equal($('cyclesField').hidden,['golden','chrono','random'].includes(kind));
   assert.equal($('chronoStartField').hidden,kind!=='chrono');
   assert.equal($('randomOptions').hidden,kind!=='random');
 }
 assert.equal(refreshes,15);
});

test('Tabata grouped editor fields exist and save all independent values',()=>{
 for(const id of ['tabataExercises','tabataExercisesField','cycleRest','tabataCycleRestField',
   'cycleRestMinutes','cycleRestSeconds','cycleRestDisplay','tabataPlanHint']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes("...(kind==='tabata'?{exercises,cycleRest}:{})"));
 assert.ok(html.includes("for(const id of ['preparation','effort','repos','cycleRest'])"));
 assert.ok(html.includes("cycles*exercises>200"));
 assert.ok(html.includes("if(w.kind==='tabata')w=normalizedTabata(w)"));
 assert.ok(html.includes("session.workout.cycles*session.workout.exercises"));
 assert.ok(html.includes("p.restType==='cycle'"));
 assert.ok(css.includes('.simple-editor-fields.tabata-fields #cyclesField'));
});

test('grouped Tabata is 15 efforts, 12 short rests, 2 long rests and no final rest',()=>{
 const m=modules().JSBTrainingModes;
 const p=modules().JSBPauseAdjustments;
 const w={kind:'tabata',prep:10,work:30,rest:10,cycles:3,exercises:5,cycleRest:60};
 assert.equal(m.workoutDuration(w),700);
 const phases=m.phasePlan(w);
 assert.equal(phases.filter(x=>x.kind==='effort').length,15);
 assert.equal(phases.filter(x=>x.restType==='exercise').length,12);
 assert.equal(phases.filter(x=>x.restType==='cycle').length,2);
 assert.equal(phases.at(-1).kind,'effort');
 assert.equal(phases.at(-1).cycle,3);
 assert.equal(phases.at(-1).exercise,5);
 const s=sessionFor(w,20000);
 p.applyPausedEdit(s,{displaySeconds:15,effortSeconds:40,restSeconds:20},{countdown:true});
 assert.ok(s.seq.filter(x=>x.restType==='exercise').every(x=>x.ms===20000));
 assert.ok(s.seq.filter(x=>x.restType==='cycle').every(x=>x.ms===60000));
 assert.equal(s.workout.cycleRest,60);
});
