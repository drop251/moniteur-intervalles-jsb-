const assert=require('node:assert/strict');
const {SOUNDS,FINISH_SOUNDS,notesFor,pcmWav,normalize,normalizeFinish,
  normalizeVolume,createEngine}=require('../sound_engine.js');

assert.deepEqual(SOUNDS.map(s=>s.id),['bellSport','pulse','digitalDuo','wood','soft']);
assert.deepEqual(FINISH_SOUNDS.map(s=>s.id),['finishBell','finishChime','finishTriple']);
assert.equal(normalizeFinish('finishChime'),'finishChime');
assert.equal(normalizeFinish('gong'),'finishChime');
assert.equal(normalize('buzzer'),'bellSport');
assert.equal(normalize('unknown'),'bellSport');
assert.equal(normalizeVolume(105),100);
assert.equal(normalizeVolume(-3),0);
assert.equal(normalizeVolume('invalid'),90);
assert.equal(new Set(SOUNDS.map(s=>s.id)).size,SOUNDS.length);
for(const item of [...SOUNDS,...FINISH_SOUNDS]){
 const event=FINISH_SOUNDS.includes(item)?'finish':'effort';
 const notes=notesFor(item.id,event);
 assert.ok(notes.length>0,item.id);
 assert.ok(notes.every(n=>n.duration>0&&n.freq>0),item.id);
 const wav=pcmWav(notes,90);
 assert.equal(String.fromCharCode(...wav.slice(0,4)),'RIFF',item.id);
 assert.equal(String.fromCharCode(...wav.slice(8,12)),'WAVE',item.id);
 assert.ok(wav.byteLength>5000,item.id);
 let peak=0;
 for(let i=44;i<wav.length;i+=2){
  const sample=wav[i]|(wav[i+1]<<8);
  peak=Math.max(peak,Math.abs(sample>=32768?sample-65536:sample));
 }
 assert.ok(peak>3000&&peak<32767,item.id+' : amplitude valide');
}
assert.ok(notesFor('finishBell','finish').some(n=>n.duration>=2));
assert.ok(notesFor('finishChime','finish').some(n=>n.time>0));
assert.ok(notesFor('finishTriple','finish').filter(n=>n.time>0).length>=2);

const events=[];
class FakeOscillator{
 constructor(){this.frequency={setValueAtTime(){},linearRampToValueAtTime(){}}}
 connect(){}disconnect(){}
 start(){events.push('started')}
 stop(){}
}
class FakeGain{
 constructor(){this.gain={value:0,setValueAtTime(){},
  linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}
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
 assert.equal(engine.play('digitalDuo','effort',90),false);
 assert.equal(await engine.activateAndPlay('digitalDuo','effort',90),true);
 assert.equal(engine.getState(),'ready');
 assert.ok(events.includes('resumed'));
 assert.ok(events.filter(x=>x==='started').length>=3);
 assert.equal(engine.play('digitalDuo','effort',0),false);
 engine.destroy();
 console.log('Nouveaux signaux JSB et déblocage Web Audio : tests réussis');
})().catch(e=>{console.error(e);process.exitCode=1});

const audioSession={type:'auto'};
const mixingEngine=createEngine({AudioContextCtor:FakeContext,AudioCtor:null,audioSession});
assert.equal(mixingEngine.getMixingStatus().active,false);
mixingEngine.setMode('web');
assert.equal(audioSession.type,'ambient');
assert.equal(mixingEngine.getMixingStatus().active,true);
mixingEngine.setMode('media');
assert.equal(mixingEngine.getMixingStatus().active,false);
const unsupported=createEngine({AudioContextCtor:FakeContext,AudioCtor:null,audioSession:null});
unsupported.setMode('web');
assert.deepEqual(unsupported.getMixingStatus(),{supported:false,active:false});
mixingEngine.destroy();
unsupported.destroy();
console.log('Compatibilité audio du navigateur : tests réussis');
