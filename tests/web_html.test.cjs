'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto=require('node:crypto');

const root = path.resolve(__dirname, '..');
const get = filename => fs.readFileSync(path.join(root, filename), 'utf8');

const html = get('index.html');
const css = get('premium_v2.css');
const manifest = JSON.parse(get('manifest.webmanifest'));
const serviceWorker = get('sw.js');

function loadModules() {
  const window = {};
  const context = vm.createContext({window, console, atob: value => Buffer.from(value,'base64').toString('binary')});
  for (const module of [
    'interaction_gate.js','workout_manager.js','workout_library.js',
    'duration_presets.js','training_modes.js','random_signals.js',
    'jsb_audio_samples.js','sound_engine.js','audio_cues.js',
  ]) {
    vm.runInContext(get(module), context, {filename:module,timeout:3000});
  }
  return window;
}

test('all HTML scripts and local assets can be loaded offline', () => {
  const externalScripts = [...html.matchAll(/<script\s+src="\.\/([^"]+)"\s*>/g)]
    .map(match => match[1]);
  assert.equal(externalScripts.length, 9);
  for (const asset of externalScripts) assert.ok(fs.existsSync(path.join(root,asset)), asset);
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).filter(code => code.trim());
  assert.ok(inlineScripts.length >= 1);
  for(const script of inlineScripts)assert.doesNotThrow(() => new vm.Script(script));
  for (const file of ['premium_v2.css','manifest.webmanifest','icon.svg','sw.js']){
    assert.ok(fs.existsSync(path.join(root,file)), file);
  }
  assert.ok(html.includes('./premium_v2.css'));
  assert.ok(html.includes('./manifest.webmanifest'));
  assert.ok(html.includes('navigator.serviceWorker.register'));
  assert.ok(!html.includes('jsb_native_bridge.js'));
});

test('the home shows exactly three accessible collapsible families', () => {
  const start=html.indexOf('<section id="view-sessions"');
  const end=html.indexOf('<section id="view-history"',start);
  assert.ok(start>=0&&end>start);
  const home=html.slice(start,end);
  const visible=[...home.matchAll(/data-group="(randori|tabata|chrono)"/g)].map(m=>m[1]);
  assert.deepEqual(visible,['randori','tabata','chrono']);
  assert.ok(home.includes('modeOptionsRandori'));
  assert.ok(home.includes('modeOptionsTabata'));
  assert.ok(home.includes('modeOptionsChrono'));
  assert.ok(css.includes('.mode-accordion-head:focus-visible'));
  assert.ok(css.includes('.mode-option-play'));
  assert.ok(html.includes('jsb_v2_open_group'));
  assert.ok(html.includes("['modeOptionsRandori',['randori','golden']]"));
  assert.ok(html.includes("['modeOptionsChrono',['chrono','random']]"));
});

test('Luc Léger is off by default and can never start a workout', () => {
  const section=html.match(/<details\s+class="mode-accordion experimental-mode"[^>]*>[\s\S]*?<\/details>/);
  assert.ok(section);
  assert.ok(section[0].includes('data-group="luc" hidden'));
  assert.ok(section[0].includes('disabled'));
  assert.ok(html.includes("read('jsb_v2_show_luc_leger',false)===true"));
  assert.ok(html.includes('id="showLucLeger"'));
});

test('the five training submodes preserve their timing semantics', () => {
  const modes=loadModules().JSBTrainingModes;
  assert.equal(modes.phasePlan({
    kind:'chrono',prep:0,work:0,rest:0,cycles:1,
  })[0].ms,Infinity);
  assert.equal(modes.phasePlan({
    kind:'golden',prep:0,work:0,rest:0,cycles:1,
  })[0].label,'GOLDEN SCORE');
  const randori=modes.phasePlan({kind:'randori',prep:10,work:240,rest:60,cycles:5});
  assert.equal(randori.filter(p=>p.kind==='effort').length,5);
  assert.equal(randori.filter(p=>p.kind==='rest').length,4);
  const tabata=modes.phasePlan({kind:'tabata',prep:10,work:20,rest:10,cycles:8});
  assert.equal(tabata.filter(p=>p.kind==='effort').length,8);
  assert.equal(tabata.filter(p=>p.kind==='rest').length,7);
  assert.equal(modes.workoutDuration({kind:'tabata',prep:10,work:20,rest:10,cycles:8}),240);
  const random=modes.phasePlan({kind:'random',prep:10,work:180,rest:0,cycles:1});
  assert.equal(random.length,2);
});

test('browser uses JSB audio, not unavailable native iOS ducking', () => {
  assert.ok(!html.includes('Signaux audio natifs'));
  assert.ok(html.includes('il ne peut pas réduire automatiquement Spotify'));
  assert.ok(!html.includes('jsb_native_bridge.js'));
  assert.ok(html.includes('soundEngine.activateAndPlay'));
  assert.ok(html.includes('settings.randomSound'));
  assert.ok(html.includes('settings.restSound'));
  const api=loadModules().JSBSoundEngine;
  assert.deepEqual(Array.from(api.SOUNDS,x=>x.id),
    ['buzzerPro','bellSport','whistlePro','hornPro','digitalDuo','wood','pulse','soft']);
  assert.equal(api.normalize('buzzer'),'buzzerPro');
  const wave=Buffer.from(api.sampleWavBase64('buzzerPro','effort'),'base64');
  assert.equal(wave.toString('ascii',0,4),'RIFF');
  assert.equal(wave.toString('ascii',8,12),'WAVE');
  assert.ok(wave.length>5000);
});

test('offline PWA cache, icon and manifest match the web release', () => {
  assert.ok(serviceWorker.includes("moniteur-jsb-web-v25"));
  assert.ok(serviceWorker.includes("'./premium_v2.css'"));
  for (const script of ['training_modes.js','jsb_audio_samples.js','sound_engine.js','audio_cues.js',
    'assets/audio/sifflet_arbitre.wav','assets/audio/cloche_ring.wav',
    'assets/audio/buzzer_combat.wav','assets/audio/corne_sportive.wav']) {
    assert.ok(serviceWorker.includes(script));
  }
  assert.equal(manifest.theme_color,'#1F293B');
  assert.equal(manifest.background_color,'#1F293B');
  assert.ok(get('icon.svg').includes('#DBAE6B'));
});

test('existing custom sessions, favorites, settings and history are retained', () => {
  for(const key of [
    'jsb_preview_customs','jsb_preview_history',
    'jsb_preview_settings','jsb_preview_favorites',
    'jsb_v2_mode_settings',
  ]) assert.ok(html.includes(key),key);
  assert.ok(html.indexOf('id="libraryDetails"')>html.indexOf('<section id="view-history"'));
});

test('settings focus on three steps, with sound gallery and progressive disclosure', () => {
  const panel = html.slice(html.indexOf('<section id="view-settings"'),html.indexOf('<nav class="nav"',html.indexOf('<section id="view-settings"')));
  for(const id of ['audioEnabled','volumeRange','testBeep','signalGallery','currentSoundLabel',
    'resetSounds','advancedSounds','restSoundChoice','randomSoundChoice','finishSoundChoice',
    'countdownEnabled','vibrateEnabled','keepAwake','settingsMore','showLucLeger']){
    assert.ok(panel.includes('id="'+id+'"'),id);
  }
  assert.ok(panel.includes('class="settings-stack"'));
  assert.ok(panel.includes('id="advancedSounds"'));
  assert.ok(panel.includes('id="settingsMore"'));
  assert.ok(panel.includes('Tout est enregistré automatiquement'));
  assert.ok(css.includes('.signal-card[aria-checked=true]'));
  assert.ok(css.includes('.settings-switch input[type=checkbox]:focus-visible'));
  assert.ok(!panel.includes('id="soundChoice"'));
  assert.ok(html.includes("renderSoundGallery()"));
  assert.ok(html.includes("soundEngine.activateAndPlay(cue.id,'effort',settings.volume)"));
});

test('four authentic recordings are primary; electronic cues are optional', () => {
  const settings=html.slice(html.indexOf('<section id="view-settings"'),html.indexOf('<nav class="nav"',html.indexOf('<section id="view-settings"')));
  assert.ok(settings.includes('id="signalGallery"'));
  assert.ok(settings.includes('id="signalGallerySecondary"'));
  assert.ok(settings.includes('id="otherSounds"'));
  assert.ok(settings.includes('Quatre vrais signaux de combat'));
  assert.ok(html.includes("new Set(['buzzerPro','bellSport','whistlePro','hornPro'])"));
  assert.ok(html.includes('(flagshipSounds.has(cue.id)?gallery:gallerySecondary).append(button)'));
  assert.ok(settings.indexOf('settingsGalleryTitle')<settings.indexOf('settingsAudioTitle'),'Choose sound before volume');
});

test('the four actual CC0 recordings are bundled and used by the sound engine', () => {
  const real=loadModules().JSBRealSignals;
  const files={
    buzzerPro:'buzzer_combat.wav',
    bellSport:'cloche_ring.wav',
    whistlePro:'sifflet_arbitre.wav',
    hornPro:'corne_sportive.wav',
    finishBell:'cloche_finale.wav',
  };
  for(const [id,name] of Object.entries(files)){
    const file=path.join(root,'assets','audio',name);
    assert.ok(fs.existsSync(file),name);
    const bundled=Buffer.from(real.getWavBase64(id),'base64');
    assert.equal(
      crypto.createHash('sha256').update(bundled).digest('hex'),
      crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      id+' does not match the recorded source');
  }
  assert.ok(get('AUDIO_CREDITS.md').includes('SpliceSound'));
  assert.ok(get('AUDIO_CREDITS.md').includes('Umplix'));
  assert.ok(get('AUDIO_CREDITS.md').includes('Naïma'));
  assert.ok(get('AUDIO_CREDITS.md').includes('guitarguy1985'));
});

test('all mastered WAV samples are PCM, loud and without digital clipping', () => {
  const root=loadModules();
  const ids=root.JSBRealSignals.ids;
  assert.equal(ids.length,12);
  const hashes=new Set();
  for(const id of ids){
    const b64=root.JSBRealSignals.getWavBase64(id);
    const wav=Buffer.from(b64,'base64');
    assert.equal(wav.toString('ascii',0,4),'RIFF',id);
    assert.equal(wav.toString('ascii',8,12),'WAVE',id);
    assert.equal(wav.readUInt32LE(24),22050,id);
    const count=wav.readUInt32LE(40)/2;
    assert.equal(wav.length,44+count*2,id);
    let total=0,peak=0;
    for(let i=44;i<wav.length;i+=2){
      const v=wav.readInt16LE(i)/32768;
      total+=v*v;peak=Math.max(peak,Math.abs(v));
    }
    const rms=Math.sqrt(total/count);
    assert.ok(rms>.12,id+' is too quiet ('+rms+')');
    assert.ok(peak<=.94,id+' exceeds safe peak ('+peak+')');
    const hash=crypto.createHash('sha256').update(wav).digest('hex');
    assert.ok(!hashes.has(hash),id+' is duplicate');
    hashes.add(hash);
  }
});
