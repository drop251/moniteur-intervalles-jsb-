const assert = require('node:assert/strict');
const {presetsForMode,hasPreset,formatDuration,splitDuration,combineDuration}=require('../duration_presets.js');
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

assert.deepEqual(splitDuration(90),{minutes:1,seconds:30});
assert.deepEqual(splitDuration(3600),{minutes:60,seconds:0});
assert.deepEqual(splitDuration(650,600),{minutes:10,seconds:0});
assert.equal(combineDuration(1,30),90);
assert.equal(combineDuration(0,0,3600,1),null);
assert.equal(combineDuration(60,1),null);
assert.equal(combineDuration(1,60),null);
assert.equal(combineDuration(10,0,600),600);
assert.equal(combineDuration(10,30,600),null);
console.log('Conversions des minutes et secondes : tests réussis');
