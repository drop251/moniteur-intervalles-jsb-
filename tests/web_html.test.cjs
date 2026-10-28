'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const get = filename => fs.readFileSync(path.join(root, filename), 'utf8');

const html = get('index.html');
const css = get('premium_v2.css');
const manifest = JSON.parse(get('manifest.webmanifest'));
const serviceWorker = get('sw.js');

function loadModules() {
  const window = {};
  const context = vm.createContext({window, console});
  for (const module of [
    'interaction_gate.js','workout_manager.js','workout_library.js',
    'duration_presets.js','training_modes.js','random_signals.js',
    'sound_engine.js','audio_cues.js',
  ]) {
    vm.runInContext(get(module), context, {filename:module,timeout:3000});
  }
  return window;
}

test('all HTML scripts and local assets can be loaded offline', () => {
  const externalScripts = [...html.matchAll(/<script\s+src="\.\/([^"]+)"\s*>/g)]
    .map(match => match[1]);
  assert.equal(externalScripts.length, 8);
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
  assert.ok(html.includes('Le site ne peut pas réduire automatiquement le volume'));
  assert.ok(!html.includes('jsb_native_bridge.js'));
  assert.ok(html.includes('soundEngine.activateAndPlay'));
  assert.ok(html.includes('settings.randomSound'));
  assert.ok(html.includes('settings.restSound'));
  const api=loadModules().JSBSoundEngine;
  assert.deepEqual(Array.from(api.SOUNDS,x=>x.id),
    ['bellSport','pulse','digitalDuo','wood','soft']);
  assert.equal(api.normalize('buzzer'),'bellSport');
  const wave=Buffer.from(api.pcmWav(api.notesFor('bellSport','effort'),90));
  assert.equal(wave.toString('ascii',0,4),'RIFF');
  assert.equal(wave.toString('ascii',8,12),'WAVE');
  assert.ok(wave.length>5000);
});

test('offline PWA cache, icon and manifest match the web release', () => {
  assert.ok(serviceWorker.includes("moniteur-jsb-web-v23"));
  assert.ok(serviceWorker.includes("'./premium_v2.css'"));
  for (const script of ['training_modes.js','sound_engine.js','audio_cues.js']) {
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
