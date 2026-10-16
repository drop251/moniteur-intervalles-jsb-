const assert = require('node:assert/strict');
const {presetsForMode,hasPreset,formatDuration}=require('../duration_presets.js');
for(const mode of ['hiit','tabata','emom','amrap','boxe']){
 const values=presetsForMode(mode);
 assert.ok(values.length>5,mode+' liste de durées');
 assert.ok(values.every(n=>Number.isInteger(n)&&n>=1&&n<=3600));
 assert.ok(values.every((n,i)=>i===0||n>values[i-1]));
}
assert.equal(hasPreset('hiit',30),true);
assert.equal(hasPreset('hiit',31),false);
assert.equal(hasPreset('amrap',300),true);
assert.equal(hasPreset('boxe',180),true);
assert.equal(formatDuration(30),'30 s');
assert.equal(formatDuration(60),'1 min');
assert.equal(formatDuration(90),'1 min 30 s');
assert.equal(formatDuration(300),'5 min');
console.log('Durées rapides : tests réussis');
