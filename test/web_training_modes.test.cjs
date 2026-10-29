const assert=require('node:assert/strict');
const m=require('../training_modes.js');
assert.deepEqual(m.AVAILABLE,['randori','golden','random','tabata','chrono','hiit','boxe']);
assert.equal(m.isAvailable('emom'),false);
assert.equal(m.isAvailable('amrap'),false);
const randori={kind:'randori',prep:10,work:240,rest:60,cycles:5};
const rp=m.phasePlan(randori);
assert.equal(rp.length,10);
assert.deepEqual(rp.map(x=>x.kind),['prep','effort','rest','effort','rest','effort','rest','effort','rest','effort']);
assert.equal(m.workoutDuration(randori),1450);
const golden={kind:'golden',prep:10,work:0,rest:0,cycles:1};
assert.equal(m.workoutDuration(golden),Infinity);
assert.equal(m.phasePlan(golden)[1].ms,Infinity);
assert.equal(m.phasePlan(golden)[1].label,'GOLDEN SCORE');
const chrono={kind:'chrono',prep:0,work:0,rest:0,cycles:1};
assert.equal(m.workoutDuration(chrono),Infinity);
assert.equal(m.phasePlan(chrono).length,1);
assert.equal(m.phasePlan(chrono)[0].label,'CHRONOMÈTRE');
assert.equal(m.phasePlan(chrono)[0].ms,Infinity);
const random={kind:'random',prep:10,work:120,rest:0,cycles:1};
assert.equal(m.workoutDuration(random),130);
assert.equal(m.phasePlan(random).length,2);
assert.equal(m.phasePlan(random)[1].label,'BIPS ALÉATOIRES');
const tabata={kind:'tabata',prep:10,work:20,rest:10,cycles:8};
assert.equal(m.workoutDuration(tabata),240);
assert.equal(m.phasePlan(tabata).length,16);

const grouped={kind:'tabata',prep:10,work:30,rest:10,cycles:3,exercises:5,cycleRest:60};
const gp=m.phasePlan(grouped);
assert.equal(m.workoutDuration(grouped),700); // 10s prep + 15 x 30s + 12 x 10s + 2 x 60s
assert.equal(gp.filter(x=>x.kind==='effort').length,15);
assert.equal(gp.filter(x=>x.restType==='exercise').length,12);
assert.equal(gp.filter(x=>x.restType==='cycle').length,2);
assert.deepEqual(gp.filter(x=>x.restType==='cycle').map(x=>x.label),
  ['REPOS ENTRE CYCLES','REPOS ENTRE CYCLES']);
assert.equal(gp[gp.length-1].kind,'effort'); // never rest after the final exercise
assert.equal(gp[gp.length-1].exercise,5);
assert.equal(gp[gp.length-1].cycle,3);
assert.deepEqual(m.tabataStructure({kind:'tabata',cycles:8}),{
  cycles:1,exercises:8,cycleRest:0,legacy:true
});
assert.deepEqual(m.tabataStructure(grouped),{
  cycles:3,exercises:5,cycleRest:60,legacy:false
});
console.log('Modes Randori Golden Score Chronomètre Bips aléatoires Tabata : tests réussis');
