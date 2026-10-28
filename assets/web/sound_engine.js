/* Moniteur JSB — bibliothèque de signaux + moteur audio pour le navigateur.
 * Deux voies : Web Audio (timing) et Audio media (compatibilité iOS).
 * L'activation doit démarrer directement depuis une interaction utilisateur.
 */
(function (root) {
  'use strict';

  // Audio original JSB v2, inspired by standard sports timer alert patterns.
  // These tones are not recordings or copies of sounds from other apps.
  // Distinct high-energy WAV samples, provided by jsb_audio_samples.js.
  // Each sample is available offline and decoded only when played.
  const SOUNDS = Object.freeze([
    {id:'buzzerPro',label:'Buzzer de combat',description:'Fort et direct · idéal Randori'},
    {id:'bellSport',label:'Cloche de ring',description:'Métallique · début et fin de combat'},
    {id:'whistlePro',label:'Sifflet d’arbitre',description:'Aigu et perçant · départ'},
    {id:'hornPro',label:'Corne sportive',description:'Grave et puissante · rounds'},
    {id:'digitalDuo',label:'Double bip',description:'Deux tops nets · fractionné'},
    {id:'wood',label:'Claquement sec',description:'Percussion rapide · réactivité'},
    {id:'pulse',label:'Bip sportif',description:'Signal franc · intervalles'},
    {id:'soft',label:'Signal de repos',description:'Moins agressif · récupération'}
  ]);
  const FINISH_SOUNDS = Object.freeze([
    {id:'finishBell', label:'Cloche finale', description:'Cloche claire à décroissance progressive'},
    {id:'finishChime', label:'Double carillon', description:'Deux notes harmonieuses de fin'},
    {id:'finishTriple', label:'Triple top', description:'Trois bips distincts de fin'}
  ]);
  const IDS = new Set(SOUNDS.map(s=>s.id));
  const FINISH_IDS = new Set(FINISH_SOUNDS.map(s=>s.id));
  const EVENTS = Object.freeze(['prep','effort','rest','random','countdown','finish']);
  const DEFAULTS = Object.freeze({
    effort:'buzzerPro', rest:'soft', random:'digitalDuo', finish:'finishBell'
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Reject legacy selections instead of quietly bringing their old sounds back.
  const normalize=value=>IDS.has(value)?value:'buzzerPro';
  const normalizeFinish=value=>FINISH_IDS.has(value)?value:'finishChime';
  const normalizeVolume=value=>Number.isFinite(Number(value))?clamp(Number(value),0,100):90;

  /**
   * A small catalog of original, synthesized sports cues.
   * Event-specific pitch differences make START vs REST intelligible.
   * Limit durations to reduce playback latency and prevent musical masking.
   */
  function notesFor(soundId,event='effort'){
    if(event==='countdown'){
      return [
        {time:0,duration:.10,freq:1100,endFreq:1040,wave:'sine',amplitude:.73,shape:'punch'},
        {time:0,duration:.065,freq:1650,endFreq:1560,wave:'triangle',amplitude:.20,shape:'punch'}
      ];
    }
    const finish=event==='finish';
    const id=finish?normalizeFinish(soundId):normalize(soundId);
    const pitch=event==='rest'?.82:event==='prep'?.91:event==='random'?1.06:1;
    const n=(time,duration,freq,wave='sine',endFreq=freq,amplitude=1,shape='punch')=>({
      time,duration,freq:freq*pitch,endFreq:endFreq*pitch,wave,amplitude,shape
    });
    switch(id){
      case 'buzzerPro':
        return [n(0,.78,640,'triangle',640,.88),n(0,.78,960,'sine',960,.30)];
      case 'whistlePro':
        return [n(0,.68,1710,'sine',1860,.90),n(0,.68,3420,'sine',3720,.12)];
      case 'hornPro':
        return [n(0,1.0,420,'triangle',415,.75),n(0,1.0,840,'sine',830,.35),
          n(0,1.0,1260,'sine',1250,.18)];
      case 'bellSport':
        return [
          n(0,.75,695,'sine',690,.75,'resonant'),
          n(0,.63,1030,'sine',1020,.34,'resonant'),
          n(0,.51,1550,'triangle',1530,.17,'resonant'),
          n(0,.08,2160,'triangle',1500,.15,'metal')
        ];
      case 'pulse':
        return [
          n(0,.25,910,'sine',945,.76),
          n(0,.17,1350,'triangle',1390,.22),
        ];
      case 'digitalDuo':
        return [
          n(0,.15,870,'sine',930,.76),
          n(.23,.18,1130,'sine',1170,.79),
          n(.23,.16,1690,'triangle',1740,.13)
        ];
      case 'wood':
        return [
          n(0,.095,620,'sine',330,.82,'metal'),
          n(0,.065,1250,'triangle',610,.27,'metal'),
          n(.095,.055,450,'sine',295,.20,'metal')
        ];
      case 'soft':
        return [
          n(0,.32,620,'sine',615,.61),
          n(0,.23,930,'sine',923,.15)
        ];
      case 'finishBell':
        return [
          n(0,2.2,535,'sine',528,.72,'resonant'),
          n(0,1.9,801,'sine',790,.39,'resonant'),
          n(0,1.5,1239,'triangle',1223,.21,'resonant'),
          n(0,.12,1880,'triangle',1320,.22,'metal')
        ];
      case 'finishChime':
        return [
          n(0,1.55,659,'sine',651,.63,'resonant'),
          n(0,1.32,989,'sine',978,.20,'resonant'),
          n(.42,2.0,880,'sine',871,.64,'resonant'),
          n(.42,1.65,1320,'sine',1308,.22,'resonant')
        ];
      case 'finishTriple':
        return [
          n(0,.15,970,'sine',1030,.72),
          n(.25,.15,970,'sine',1030,.72),
          n(.50,.29,1250,'sine',1250,.80),
          n(.50,.26,1875,'triangle',1875,.14)
        ];
      default:
        return notesFor(finish?'finishChime':'bellSport',event);
    }
  }

  function signalEnvelope(note,local){
    const progress=local/note.duration;
    if(note.shape==='resonant')return Math.min(1,local/.003)*Math.exp(-4.1*progress)*Math.max(0,1-progress);
    if(note.shape==='drum')return Math.min(1,local/.003)*Math.exp(-5.2*progress)*Math.max(0,1-progress);
    if(note.shape==='metal')return Math.min(1,local/.002)*Math.exp(-6.8*progress)*Math.max(0,1-progress);
    return Math.min(1,local/.004)*Math.pow(Math.max(0,1-progress),.90);
  }

  // An increased cue gain improves audibility with music and in a dojo.
  // Soft-knee limiting caps intermodulating partials below 0 dBFS and
  // avoids the harsh hard clipping of very strong metallic attacks.
  const MIX_GAIN = .86; // previously .63 (about +2.7 dB before limiting)
  function softLimit(value){
    const knee=.80, peak=.96, abs=Math.abs(value);
    if(abs<=knee)return value;
    return Math.sign(value)*(knee+(peak-knee)*(1-Math.exp(-(abs-knee)/(peak-knee))));
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
        const envelope=signalEnvelope(n,local);
        total+=wave*envelope*n.amplitude;
      }
      const value=softLimit(total*MIX_GAIN*boundedVolume);
      view.setInt16(44+i*2,Math.round(value*32767),true);
    }
    return bytes;
  }

  function sampleWavBase64(sound,event='effort'){
    const id=event==='countdown'?'countdown':
      event==='finish'?normalizeFinish(sound):normalize(sound);
    return root.JSBRealSignals?.getWavBase64(id)||null;
  }
  function sampleBytesFor(sound,event='effort'){
    const id=event==='countdown'?'countdown':
      event==='finish'?normalizeFinish(sound):normalize(sound);
    return root.JSBRealSignals?.getWavBytes(id)||null;
  }
  function createEngine(deps={}){
    const host=deps.host||root;
    const audioSession=deps.audioSession===undefined?host.navigator?.audioSession:deps.audioSession;
    const AudioContextCtor=deps.AudioContextCtor===undefined
      ? (host.AudioContext||host.webkitAudioContext) : deps.AudioContextCtor;
    const AudioCtor=deps.AudioCtor===undefined ? host.Audio : deps.AudioCtor;
    const createUrl=deps.createUrl||((blob)=>host.URL.createObjectURL(blob));
    const revokeUrl=deps.revokeUrl||((url)=>host.URL.revokeObjectURL(url));
    const BlobCtor=deps.BlobCtor||host.Blob;
    let context=null,media=null,mode='web',status='inactive';
    const cached=new Map(),buffers=new Map(),listeners=new Set();
    let activeSource=null;

    function emit(value){
      status=value;
      for(const listener of listeners){try{listener(value)}catch{}}
    }
    function onStatus(listener){listeners.add(listener);return()=>listeners.delete(listener);}
    // Sur Safari/iOS, ambient est la catégorie permettant la cohabitation
    // des bips Web Audio avec Apple Music, Spotify et les autres sources.
    // En l'absence de cette API, ne jamais supposer que le mixage fonctionne.
    function requestAmbientMix(){
      if(!audioSession)return false;
      try{audioSession.type='ambient';return audioSession.type==='ambient'}
      catch{return false}
    }
    function getMixingStatus(){
      return{supported:!!audioSession,active:mode==='web'&&audioSession?.type==='ambient'};
    }
    function setMode(value){
      const next=value==='media'?'media':'web';
      if(next!==mode&&media){try{media.pause()}catch{}}
      mode=next;if(mode==='web')requestAmbientMix();emit('inactive');
    }
    function ensureContext(){
      if(context)return context;
      if(!AudioContextCtor)throw Error('Web Audio indisponible');
      requestAmbientMix();
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
        requestAmbientMix();
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
          requestAmbientMix();
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
    function sampleUrl(sound,event,volume){
      const bytes=sampleBytesFor(sound,event);
      if(!bytes)return urlFor(notesFor(sound,event),volume);
      const key='sample:'+sound+'|'+event;
      if(cached.has(key))return cached.get(key);
      const url=createUrl(new BlobCtor([bytes],{type:'audio/wav'}));
      cached.set(key,url);
      return url;
    }
    function playSampleBuffer(ctx,sound,event,volume){
      if(typeof ctx.createBuffer!=='function'||typeof ctx.createBufferSource!=='function')
        return false;
      const key=event==='countdown'?'countdown':event==='finish'?normalizeFinish(sound):normalize(sound);
      let buffer=buffers.get(key);
      if(!buffer){
        const bytes=sampleBytesFor(sound,event);
        if(!bytes||bytes.length<=44)return false;
        const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
        const hz=view.getUint32(24,true),count=view.getUint32(40,true)/2;
        if(hz!==22050||count<1||count>22050*4)return false;
        buffer=ctx.createBuffer(1,count,hz);
        const channel=buffer.getChannelData(0);
        for(let i=0;i<count;i++)channel[i]=view.getInt16(44+i*2,true)/32768;
        buffers.set(key,buffer);
      }
      // Previewing several cues quickly should not stack them together.
      if(activeSource)try{activeSource.stop()}catch{}
      const src=ctx.createBufferSource(),gain=ctx.createGain();
      activeSource=src;
      src.buffer=buffer;
      gain.gain.setValueAtTime(Math.pow(normalizeVolume(volume)/100,.91),ctx.currentTime);
      src.connect(gain);gain.connect(ctx.destination);
      src.start(ctx.currentTime+.004);
      src.onended=()=>{
        if(activeSource===src)activeSource=null;
        try{src.disconnect();gain.disconnect()}catch{}
      };
      emit('ready');
      return true;
    }
    function mediaPlay(sound,event,volume){
      try{
        const audio=initializeMedia();
        audio.pause();
        audio.src=sampleUrl(sound,event,volume);
        audio.volume=normalizeVolume(volume)/100;
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
      requestAmbientMix();
      const ctx=context;
      if(!ctx||ctx.state!=='running'){emit('blocked');return false;}
      if(normalizeVolume(volume)===0)return false;
      try{
        if(playSampleBuffer(ctx,sound,event,volume))return true;
        const now=ctx.currentTime+.007;
        // Oscillator fallback for older browsers, or absent WAV bundle.
        const peak=.52*Math.pow(normalizeVolume(volume)/100,.82);
        for(const n of notesFor(sound,event)){
          const oscillator=ctx.createOscillator(),gain=ctx.createGain();
          oscillator.type=n.wave;oscillator.frequency.setValueAtTime(n.freq,now+n.time);
          if(n.endFreq!==n.freq)oscillator.frequency.linearRampToValueAtTime(n.endFreq,now+n.time+n.duration);
          const amplitude=peak*n.amplitude;
          gain.gain.setValueAtTime(.0001,now+n.time);
          const attack=n.shape==='metal'?.002:n.shape==='drum'?.003:n.shape==='resonant'?.003:.004;
          gain.gain.linearRampToValueAtTime(amplitude,now+n.time+attack);
          if(n.shape==='resonant'||n.shape==='drum'||n.shape==='metal'){
            const shape=n.shape==='resonant'?4.1:n.shape==='drum'?5.2:6.8;
            gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amplitude*Math.exp(-shape*.55)),now+n.time+n.duration*.55);
          }
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
      cached.clear();buffers.clear();
      if(activeSource)try{activeSource.stop()}catch{}
      activeSource=null;
      if(context&&typeof context.close==='function')context.close().catch(()=>{});
      context=null;media=null;emit('inactive');
    }
    return {setMode,play,activateAndPlay,resume,onStatus,getState,getMixingStatus,destroy};
  }
  const api={SOUNDS,FINISH_SOUNDS,DEFAULTS,EVENTS,notesFor,pcmWav,normalize,normalizeFinish,normalizeVolume,sampleWavBase64,createEngine};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBSoundEngine=api;
})(typeof window!=='undefined'?window:globalThis);
