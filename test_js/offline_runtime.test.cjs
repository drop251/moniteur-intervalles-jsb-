'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const assets = path.join(__dirname, '..', 'assets', 'web');

function js(name) {
  return fs.readFileSync(path.join(assets, name), 'utf8');
}

function createJSB() {
  const messages = [];
  const window = {
    JSBHost: {
      postMessage: text => messages.push(JSON.parse(text)),
    },
  };
  const context = vm.createContext({
    window,
    btoa: binary => Buffer.from(binary, 'binary').toString('base64'),
    console,
  });
  for (const source of ['sound_engine.js', 'jsb_native_bridge.js',
    'training_modes.js', 'random_signals.js', 'audio_cues.js']) {
    vm.runInContext(js(source), context, {filename: source, timeout: 1500});
  }
  return {window, messages};
}

test('the bundled web document has valid inline JavaScript', () => {
  const html = js('index.html');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(code => code.trim().length > 0);
  assert.ok(scripts.length > 0);
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code));
  for (const id of ['view-sessions', 'view-tests', 'view-history',
    'view-settings', 'timer', 'clockText', 'pauseBtn', 'stopBtn']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test('original JSB gong and combat cues are transported as WAV, not browser audio', async () => {
  const {window, messages} = createJSB();
  const soundEngine = window.JSBSoundEngine.createEngine();
  assert.equal(await soundEngine.activateAndPlay('buzzer', 'effort', 90), true);
  assert.equal(await soundEngine.activateAndPlay('gong', 'finish', 80), true);
  const cues = messages.filter(message => message.type === 'cue');
  assert.equal(cues.length, 2);
  assert.equal(cues[0].event, 'effort');
  assert.equal(cues[0].volume, 90);
  assert.equal(cues[1].event, 'finish');
  assert.equal(cues[1].volume, 80);
  for (const cue of cues) {
    const wav = Buffer.from(cue.wavBase64, 'base64');
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.ok(wav.length > 44);
  }
});

test('ducking starts in a three-second lead-in and is not requested on every frame', () => {
  const {window, messages} = createJSB();
  const bridge = window.JSBNativeAudio;
  bridge.maybePrepare(6999, [10000, 14000]);
  assert.equal(messages.length, 0);
  bridge.maybePrepare(7000, [10000, 14000]);
  bridge.maybePrepare(7100, [10000, 14000]);
  assert.deepEqual(messages.map(message => message.type), ['prepare']);
  bridge.maybePrepare(11001, [10000, 14000]);
  assert.deepEqual(messages.map(message => message.type), ['prepare', 'prepare']);
  bridge.release();
  assert.equal(messages.at(-1).type, 'release');
  bridge.maybePrepare(11010, [10000, 14000]);
  assert.equal(messages.at(-1).type, 'prepare');
});

test('training modes preserve Randori and Golden Score semantics', () => {
  const {window} = createJSB();
  const randori = window.JSBTrainingModes.phasePlan({
    kind: 'randori', prep: 10, work: 240, rest: 60, cycles: 5,
  });
  assert.equal(randori.length, 10);
  assert.equal(randori.filter(p => p.kind === 'effort').length, 5);
  assert.equal(randori.filter(p => p.kind === 'rest').length, 4);
  assert.equal(randori.at(-1).kind, 'effort');
  const golden = window.JSBTrainingModes.phasePlan({
    kind: 'golden', prep: 10, work: 0, rest: 0, cycles: 1,
  });
  assert.equal(golden[1].label, 'GOLDEN SCORE');
  assert.equal(golden[1].ms, Infinity);
});

test('random cues are spaced and countdown cues never replay when late', () => {
  const {window} = createJSB();
  const signals = window.JSBRandomSignals.createSignals({
    workMs: 180000, frequency: 'high', progressive: true, rng: () => 0.2,
  });
  for (let i = 1; i < signals.length; i++) {
    assert.ok(signals[i] - signals[i - 1] >= 3500);
  }
  const phases = [
    {kind: 'prep', start: 0, ms: 10000},
    {kind: 'effort', start: 10000, ms: 20000},
  ];
  assert.equal(window.JSBAudioCues.countdownCues(phases, 6900, 7100).length, 1);
  assert.equal(window.JSBAudioCues.countdownCues(phases, 7000, 8100).length, 0);
});

test('screen wake and haptics are relayed to the native app', () => {
  const {window, messages} = createJSB();
  const bridge = window.JSBNativeAudio;
  bridge.setAwake(true);
  bridge.haptic('countdown');
  bridge.setAwake(false);
  assert.deepEqual(messages, [
    {type: 'screenAwake', enabled: true},
    {type: 'haptic', event: 'countdown'},
    {type: 'screenAwake', enabled: false},
  ]);
});
