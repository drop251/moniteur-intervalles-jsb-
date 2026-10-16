const assert=require('node:assert/strict');
const {SOUNDS,FINISH_SOUNDS,notesFor,pcmWav,normalize,normalizeFinish,normalizeVolume,createEngine}=require('../sound_engine.js');
assert.ok(SOUNDS.length>=13);
assert.equal(FINISH_SOUNDS.length,5);
assert.equal(normalizeFinish('gong'),'gong');
assert.equal(normalizeFinish('invalid'),'gong');
assert.equal(new Set(SOUNDS.map(s=>s.id)).size,6);
assert.equal(normalize('unknown'),'short');
assert.equal(normalizeVolume(105),100);
assert.equal(normalizeVolume(-3),0);
assert.equal(normalizeVolume('invalid'),70);
for(const item of SOUNDS){
 const notes=notesFor(item.id,'effort');
 assert.ok(notes.length>0);
 assert.ok(notes.every(n=>n.duration>0&&n.freq>0));
 const wav=pcmWav(notes,70);
 assert.equal(String.fromCharCode(...wav.slice(0,4)),'RIFF');
 assert.equal(String.fromCharCode(...wav.slice(8,12)),'WAVE');
}
assert.ok(notesFor('gong','finish').some(n=>n.duration>=3));
assert.ok(notesFor('gongDouble','finish').length>notesFor('gong','finish').length);
assert.ok(notesFor('taiko','effort').some(n=>n.shape==='drum'));
for(const ending of FINISH_SOUNDS){const notes=notesFor(ending.id,'finish');assert.ok(notes.length>0);const wav=pcmWav(notes,70);assert.ok(wav.byteLength>44);}
const events=[];
class FakeOscillator{
 constructor(){this.frequency={setValueAtTime(){},linearRampToValueAtTime(){}}}
 connect(){}disconnect(){}
 start(){events.push('started')}
 stop(){}
}
class FakeGain{
 constructor(){this.gain={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}
 connect(){}disconnect(){}
}
class FakeContext{
 constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
 createOscillator(){return new FakeOscillator()}
 createGain(){return new FakeGain()}
 resume(){events.push('resumed');this.state='running';return Promise.resolve()}
 close(){return Promise.resolve()}
}
(async()=>{
 const engine=createEngine({AudioContextCtor:FakeContext,AudioCtor:null});
 assert.equal(engine.play('double','effort',70),false);
 assert.equal(await engine.activateAndPlay('double','effort',70),true);
 assert.equal(engine.getState(),'ready');
 assert.ok(events.includes('resumed'));
 assert.ok(events.filter(x=>x==='started').length>=3);
 assert.equal(engine.play('double','effort',0),false);
 engine.destroy();
 console.log('Bibliothèque sonore et déblocage Web Audio : tests réussis');
})().catch(e=>{console.error(e);process.exitCode=1});
