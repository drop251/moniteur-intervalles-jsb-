const assert=require('node:assert/strict');
const {createSignals,PROFILES,MIN_GAP_MS}=require('../random_signals.js');
assert.deepEqual(createSignals({workMs:0}),[]);
assert.deepEqual(createSignals({workMs:-1}),[]);
for(const frequency of Object.keys(PROFILES)){
 const times=createSignals({workMs:240000,frequency,progressive:true,rng:()=>0.5});
 assert.ok(times.length>2);
 assert.ok(times.every((t,i)=>Number.isInteger(t)&&t>2500&&t<238800&&(i===0||t-times[i-1]>=MIN_GAP_MS)));
 const gaps=times.slice(1).map((t,i)=>t-times[i]);
 assert.ok(gaps[gaps.length-1]<gaps[0],'progression '+frequency);
}
const slow=createSignals({workMs:240000,frequency:'low',progressive:false,rng:()=>0.5});
const fast=createSignals({workMs:240000,frequency:'high',progressive:false,rng:()=>0.5});
assert.ok(fast.length>slow.length);
const same=createSignals({workMs:120000,rng:()=>0.3});
assert.deepEqual(same,createSignals({workMs:120000,rng:()=>0.3}));
console.log('Planification des signaux : tests réussis');
