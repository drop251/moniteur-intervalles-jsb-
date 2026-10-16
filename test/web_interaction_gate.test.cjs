const assert = require('node:assert/strict');
const { createInteractionGate } = require('../interaction_gate.js');

let time = 1000;
const gate = createInteractionGate(() => time);

assert.equal(gate.allow('start', 600), true, 'premier démarrage accepté');
assert.equal(gate.allow('start', 600), false, 'deuxième démarrage immédiat refusé');
time += 599;
assert.equal(gate.allow('start', 600), false, 'démarrage prématuré refusé');
time += 1;
assert.equal(gate.allow('start', 600), true, 'démarrage après délai accepté');

assert.equal(gate.allow('test-beep', 400), true, 'actions indépendantes');
assert.equal(gate.allow('test-beep', 400), false, 'pas de chevauchement des bips');
time += 450;
assert.equal(gate.allow('test-beep', 400), true);

assert.equal(gate.begin('stop-dialog'), true, 'première confirmation acceptée');
assert.equal(gate.begin('stop-dialog'), false, 'deuxième confirmation simultanée refusée');
assert.equal(gate.isActive('stop-dialog'), true);
gate.end('stop-dialog');
assert.equal(gate.begin('stop-dialog'), true, 'verrou libéré');
gate.end('stop-dialog');

assert.equal(gate.allow('pause', 400), true);
time += 100;
assert.equal(gate.allow('pause', 400), false, 'double pause refusée');
time += 300;
assert.equal(gate.allow('pause', 400), true, 'pause/reprise possible après délai');

console.log('Interaction gate: 13 assertions réussies');
