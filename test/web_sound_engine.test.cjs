const assert=require('node:assert/strict');
const samples=require('../jsb_audio_samples.js');
const {SOUNDS,FINISH_SOUNDS,notesFor,pcmWav,normalize,normalizeFinish,
  normalizeVolume,sampleWavBase64,createEngine}=require('../sound_engine.js');

assert.deepEqual(SOUNDS.map(s=>s.id),['buzzerPro','bellSport','whistlePro','hornPro']);
assert.deepEqual(FINISH_SOUNDS.map(s=>s.id),['buzzerPro','bellSport','whistlePro','hornPro']);
assert.equal(normalizeFinish('finishChime'),'bellSport');
assert.equal(normalizeFinish('gong'),'bellSport');
assert.equal(normalize('buzzer'),'buzzerPro');
assert.equal(normalize('unknown'),'buzzerPro');
assert.equal(normalizeVolume(105),100);
assert.equal(normalizeVolume(-3),0);
assert.equal(normalizeVolume('invalid'),90);
assert.equal(new Set(SOUNDS.map(s=>s.id)).size,SOUNDS.length);
assert.ok(samples.ids.includes('buzzerPro'));
for(const id of samples.ids){
  const sample=Buffer.from(samples.getWavBase64(id),'base64');
  assert.equal(sample.toString('ascii',0,4),'RIFF');
  assert.equal(sample.readUInt32LE(24),22050);
}
assert.equal(sampleWavBase64('buzzerPro','effort'),samples.getWavBase64('buzzerPro'));
assert.equal(sampleWavBase64('bellSport','finish'),samples.getWavBase64('bellSport'));
assert.equal(sampleWavBase64('countdown','countdown'),samples.getWavBase64('whistlePro'));
assert.deepEqual(samples.ids,['buzzerPro','bellSport','whistlePro','hornPro']);

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
assert.ok(notesFor('bellSport','finish').some(n=>n.duration>=.75));
assert.ok(notesFor('hornPro','finish').some(n=>n.duration>=1));
assert.ok(notesFor('whistlePro','countdown').some(n=>n.freq>1500));

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
 assert.equal(engine.play('hornPro','effort',90),false);
 assert.equal(await engine.activateAndPlay('hornPro','effort',90),true);
 assert.equal(engine.getState(),'ready');
 assert.ok(events.includes('resumed'));
 assert.ok(events.filter(x=>x==='started').length>=3);
 assert.equal(engine.play('hornPro','effort',0),false);
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
