/* Moniteur JSB — bibliothèque de signaux + moteur audio pour le navigateur.
 * Deux voies : Web Audio (timing) et Audio media (compatibilité iOS).
 * L'activation doit démarrer directement depuis une interaction utilisateur.
 */
(function (root) {
  'use strict';

  const SOUNDS = Object.freeze([
    {id:'short',label:'Bip court',description:'Signal bref et net'},
    {id:'double',label:'Double bip',description:'Deux signaux rapprochés'},
    {id:'triple',label:'Triple bip',description:'Trois signaux successifs'},
    {id:'whistle',label:'Sifflet électronique',description:'Signal montant'},
    {id:'bell',label:'Cloche',description:'Signal harmonique'},
    {id:'digital',label:'Signal digital',description:'Trois notes électroniques'}
  ]);
  const IDS = new Set(SOUNDS.map(s=>s.id));
  const EVENTS = Object.freeze(['prep','effort','rest','random','finish']);
  const DEFAULTS = Object.freeze({effort:'double',rest:'bell',random:'whistle',finish:'triple'});
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const normalize = value => IDS.has(value) ? value : 'short';
  const normalizeVolume = value => Number.isFinite(Number(value)) ? clamp(Number(value),0,100) : 70;

  function notesFor(soundId, event='effort') {
    const id = normalize(soundId);
    const pitch = event==='rest' ? 0.66 : event==='prep' ? 0.84 : event==='random' ? 1.1 : 1;
    const note=(time,duration,freq,wave='sine',endFreq=freq,amplitude=1)=>
      ({time,duration,freq:freq*pitch,endFreq:endFreq*pitch,wave,amplitude});
    let notes;
    switch(id){
      case 'double':notes=[note(0,.13,850),note(.20,.13,850)];break;
      case 'triple':notes=[note(0,.11,960),note(.17,.11,960),note(.34,.11,960)];break;
      case 'whistle':notes=[note(0,.42,900,'sine',1750)];break;
      case 'bell':notes=[note(0,.52,640,'sine',620,.9),note(0,.46,1280,'sine',1240,.27)];break;
      case 'digital':notes=[note(0,.12,720,'triangle'),note(.16,.12,980,'triangle'),note(.32,.18,1180,'triangle')];break;
      default:notes=[note(0,.22,940)];break;
    }
    if(event==='finish'){
      // Toujours une cadence terminale distincte pour le feedback de fin.
      return notes.concat([note(.6,.15,1120),note(.83,.28,1350)]);
    }
    return notes;
  }

  function pcmWav(notes,volume=70,sampleRate=22050){
    const boundedVolume=normalizeVolume(volume)/100;
    const end=Math.max(.1,...notes.map(n=>n.time+n.duration))+.06;
    const count=Math.ceil(end*sampleRate), bytes=new Uint8Array(44+2*count),view=new DataView(bytes.buffer);
    const put=(offset,s)=>{for(let i=0;i<s.length;i++)bytes[offset+i]=s.charCodeAt(i)};
    put(0,'RIFF');view.setUint32(4,36+count*2,true);put(8,'WAVE');put(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,count*2,true);
    for(let i=0;i<count;i++){
      const t=i/sampleRate;let total=0;
      for(const n of notes){
        const local=t-n.time;if(local<0||local>=n.duration)continue;
        const progress=local/n.duration;
        const freq=n.freq+(n.endFreq-n.freq)*progress;
        const cycles=(n.freq*local+(n.endFreq-n.freq)*local*local/(2*n.duration));
        const angle=2*Math.PI*cycles;
        const wave=n.wave==='triangle'?2/Math.PI*Math.asin(Math.sin(angle)):Math.sin(angle);
        const envelope=Math.min(1,local/.012)*Math.pow(Math.max(0,1-progress),1.7);
        total+=wave*envelope*n.amplitude;
      }
      const value=clamp(total*.52*boundedVolume,-.94,.94);
      view.setInt16(44+i*2,Math.round(value*32767),true);
    }
    return bytes;
  }

  function createEngine(deps={}){
    const host=deps.host||root;
    const AudioContextCtor=deps.AudioContextCtor===undefined
      ? (host.AudioContext||host.webkitAudioContext) : deps.AudioContextCtor;
    const AudioCtor=deps.AudioCtor===undefined ? host.Audio : deps.AudioCtor;
    const createUrl=deps.createUrl||((blob)=>host.URL.createObjectURL(blob));
    const revokeUrl=deps.revokeUrl||((url)=>host.URL.revokeObjectURL(url));
    const BlobCtor=deps.BlobCtor||host.Blob;
    let context=null,media=null,mode='web',status='inactive';
    const cached=new Map(),listeners=new Set();

    function emit(value){
      status=value;
      for(const listener of listeners){try{listener(value)}catch{}}
    }
    function onStatus(listener){listeners.add(listener);return()=>listeners.delete(listener);}
    function setMode(value){
      const next=value==='media'?'media':'web';
      if(next!==mode&&media){try{media.pause()}catch{}}
      mode=next;emit('inactive');
    }
    function ensureContext(){
      if(context)return context;
      if(!AudioContextCtor)throw Error('Web Audio indisponible');
      context=new AudioContextCtor();
      if(typeof context.addEventListener==='function'){
        context.addEventListener('statechange',()=>{
          if(mode==='web')emit(context.state==='running'?'ready':'inactive');
        });
      }
      return context;
    }
    function initializeMedia(){
      if(media)return media;
      if(!AudioCtor)throw Error('Audio HTML indisponible');
      media=new AudioCtor();media.preload='auto';
      if(typeof media.setAttribute==='function')media.setAttribute('playsinline','');
      return media;
    }
    function webUnlock(){
      try{
        const ctx=ensureContext();
        // Opérations synchrones pendant le geste : indispensables sur iOS Safari.
        if(typeof ctx.createOscillator==='function'&&typeof ctx.createGain==='function'){
          const osc=ctx.createOscillator(),gain=ctx.createGain();
          gain.gain.value=0;
          osc.connect(gain);gain.connect(ctx.destination);
          osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.015);
        }
        const pending=ctx.state==='running'?Promise.resolve():Promise.resolve(ctx.resume());
        return pending.then(()=>{
          const ok=ctx.state==='running';
          emit(ok?'ready':'blocked');
          return ok;
        }).catch(()=>{emit('blocked');return false;});
      }catch{emit('unsupported');return Promise.resolve(false);}
    }
    function urlFor(notes,volume){
      const key=JSON.stringify([notes,normalizeVolume(volume)]);
      if(cached.has(key))return cached.get(key);
      const bytes=pcmWav(notes,volume);
      const url=createUrl(new BlobCtor([bytes],{type:'audio/wav'}));
      cached.set(key,url);
      if(cached.size>28){
        const first=cached.keys().next().value;const old=cached.get(first);
        cached.delete(first);try{revokeUrl(old)}catch{}
      }
      return url;
    }
    function mediaPlay(sound,event,volume){
      try{
        const audio=initializeMedia();
        audio.pause();
        audio.src=urlFor(notesFor(sound,event),volume);
        audio.currentTime=0;
        // play() est appelé directement depuis le geste dans le cas d'un test.
        const pending=audio.play();
        if(pending&&typeof pending.then==='function'){
          pending.then(()=>emit('ready')).catch(()=>emit('blocked'));
        }else emit('ready');
        return true;
      }catch{emit('blocked');return false;}
    }
    function webPlay(sound,event,volume){
      const ctx=context;
      if(!ctx||ctx.state!=='running'){emit('blocked');return false;}
      if(normalizeVolume(volume)===0)return false;
      try{
        const now=ctx.currentTime+.007;
        const peak=.32*Math.pow(normalizeVolume(volume)/100,1.3);
        for(const n of notesFor(sound,event)){
          const oscillator=ctx.createOscillator(),gain=ctx.createGain();
          oscillator.type=n.wave;oscillator.frequency.setValueAtTime(n.freq,now+n.time);
          if(n.endFreq!==n.freq)oscillator.frequency.linearRampToValueAtTime(n.endFreq,now+n.time+n.duration);
          const amplitude=peak*n.amplitude;
          gain.gain.setValueAtTime(.0001,now+n.time);
          gain.gain.linearRampToValueAtTime(amplitude,now+n.time+.012);
          gain.gain.exponentialRampToValueAtTime(.0001,now+n.time+n.duration);
          oscillator.connect(gain);gain.connect(ctx.destination);
          oscillator.start(now+n.time);oscillator.stop(now+n.time+n.duration+.005);
          oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect()}catch{}};
        }
        emit('ready');return true;
      }catch{emit('blocked');return false;}
    }
    function play(sound,event='effort',volume=70){
      if(normalizeVolume(volume)===0)return false;
      return mode==='media'
        ? mediaPlay(sound,event,volume)
        : webPlay(sound,event,volume);
    }
    function activateAndPlay(sound,event='effort',volume=70){
      // Appelé uniquement dans un handler click/touch, sans await préalable.
      if(normalizeVolume(volume)===0){emit('muted');return Promise.resolve(false);}
      if(mode==='media')return Promise.resolve(mediaPlay(sound,event,volume));
      return webUnlock().then(ok=>ok?webPlay(sound,event,volume):false);
    }
    function resume(){
      if(mode==='media')return Promise.resolve(Boolean(media));
      return webUnlock();
    }
    function getState(){return status;}
    function destroy(){
      if(media)try{media.pause();media.src='';}catch{}
      for(const url of cached.values())try{revokeUrl(url)}catch{}
      cached.clear();
      if(context&&typeof context.close==='function')context.close().catch(()=>{});
      context=null;media=null;emit('inactive');
    }
    return {setMode,play,activateAndPlay,resume,onStatus,getState,destroy};
  }
  const api={SOUNDS,DEFAULTS,EVENTS,notesFor,pcmWav,normalize,normalizeVolume,createEngine};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBSoundEngine=api;
})(typeof window!=='undefined'?window:globalThis);
