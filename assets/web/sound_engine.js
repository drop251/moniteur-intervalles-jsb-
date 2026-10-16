/* Moniteur JSB — bibliothèque de signaux + moteur audio pour le navigateur.
 * Deux voies : Web Audio (timing) et Audio media (compatibilité iOS).
 * L'activation doit démarrer directement depuis une interaction utilisateur.
 */
(function (root) {
  'use strict';

  // Les signaux d'effort privilégient une attaque immédiatement reconnaissable
  // dans un dojo bruyant ; les signaux de fin ont une couleur distincte.
  const SOUNDS = Object.freeze([
    {id:'buzzer',label:'Buzzer de combat',description:'Avertisseur dense et puissant'},
    {id:'referee',label:"Sifflet d’arbitre",description:'Signal aigu, incisif et répété'},
    {id:'tatami',label:'Impact tatami',description:'Deux frappes courtes et sèches'},
    {id:'clapper',label:'Claquement bois',description:'Clac net, idéal pour les changements'},
    {id:'taiko',label:'Tambour taiko',description:'Percussion grave avec impact audible'},
    {id:'alarm',label:'Alerte intensive',description:'Trois notes agressives'},
    {id:'airhorn',label:'Corne de combat',description:'Deux couches stridentes'},
    {id:'short',label:'Bip court',description:'Simple et discret'},
    {id:'double',label:'Double bip',description:'Deux signaux rapprochés'},
    {id:'triple',label:'Triple bip',description:'Trois signaux successifs'},
    {id:'whistle',label:'Sifflet électronique',description:'Signal montant'},
    {id:'bell',label:'Cloche',description:'Signal harmonique'},
    {id:'digital',label:'Signal digital',description:'Trois notes électroniques'},
    {id:'countdown',label:'Top décompte',description:'Bip sec 3-2-1, puis départ'}
  ]);
  const FINISH_SOUNDS = Object.freeze([
    {id:'gong',label:'Gong japonais',description:'Impact métallique et résonance longue'},
    {id:'gongDouble',label:'Double gong',description:'Deux frappes de gong solennelles'},
    {id:'taikoFinal',label:'Taiko final',description:'Deux grosses percussions et résonance'},
    {id:'buzzerFinal',label:'Buzzer final',description:'Signal de fin fort et distinct'},
    {id:'bellFinal',label:'Cloche de fin',description:'Cloche claire à longue résonance'}
  ]);
  const IDS = new Set([...SOUNDS,...FINISH_SOUNDS].map(s=>s.id));
  const EVENTS = Object.freeze(['prep','effort','rest','random','finish']);
  const DEFAULTS = Object.freeze({effort:'buzzer',rest:'clapper',random:'referee',finish:'gong'});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const normalize=value=>IDS.has(value)?value:'buzzer';
  const normalizeFinish=value=>FINISH_SOUNDS.some(s=>s.id===value)?value:'gong';
  const normalizeVolume=value=>Number.isFinite(Number(value))?clamp(Number(value),0,100):70;

  function notesFor(soundId,event='effort'){
    const id=normalize(soundId);
    const pitch=event==='rest'?.78:event==='prep'?.9:event==='random'?1.08:1;
    const n=(time,duration,freq,wave='sine',endFreq=freq,amplitude=1,shape='punch')=>({
      time,duration,freq:freq*pitch,endFreq:endFreq*pitch,wave,amplitude,shape
    });
    let notes;
    switch(id){
      case 'buzzer':
        notes=[n(0,.48,225,'sawtooth',235,.65),n(0,.48,305,'square',309,.31),n(.035,.32,475,'sawtooth',465,.2)];
        break;
      case 'referee':
        notes=[n(0,.21,1510,'square',1900,.47),n(.28,.31,1680,'square',2110,.52)];
        break;
      case 'tatami':
        notes=[n(0,.095,750,'sawtooth',290,.75),n(0,.10,1250,'square',510,.20),n(.19,.095,790,'sawtooth',300,.75),n(.19,.10,1380,'square',580,.16)];
        break;
      case 'clapper':
        notes=[n(0,.12,850,'sawtooth',320,.7),n(0,.09,1350,'square',550,.24)];
        break;
      case 'taiko':
        notes=[n(0,.56,170,'sine',77,1.1,'drum'),n(0,.18,370,'triangle',132,.43),n(0,.08,930,'sawtooth',500,.14)];
        break;
      case 'alarm':
        notes=[n(0,.17,770,'square',900,.55),n(.24,.17,990,'square',1100,.55),n(.48,.30,1190,'sawtooth',1450,.55)];
        break;
      case 'airhorn':
        notes=[n(0,.50,430,'sawtooth',450,.48),n(0,.50,650,'sawtooth',660,.40),n(.04,.43,830,'square',820,.18)];
        break;
      case 'countdown':notes=[n(0,.095,1320,'square',1240,.43),n(0,.085,1870,'triangle',1500,.14)];break;
      case 'double':notes=[n(0,.13,850),n(.20,.13,850)];break;
      case 'triple':notes=[n(0,.11,960),n(.17,.11,960),n(.34,.11,960)];break;
      case 'whistle':notes=[n(0,.42,900,'sine',1750)];break;
      case 'bell':notes=[n(0,.52,640,'sine',620,.9),n(0,.46,1280,'sine',1240,.27)];break;
      case 'digital':notes=[n(0,.12,720,'triangle'),n(.16,.12,980,'triangle'),n(.32,.18,1180,'triangle')];break;
      case 'gong':
      case 'gongDouble':{
        // Synthèse de cloche de temple (inspiration sonore, pas un échantillon authentique).
        // Partiels inharmoniques, grave soutenu, attaque métallique et longue décroissance.
        const strike=at=>[
          n(at,.18,1150,'sawtooth',410,.32,'metal'),
          n(at,.12,2050,'triangle',1300,.18,'metal'),
          n(at,3.5,196,'sine',190,.70,'resonant'),
          n(at,3.0,287,'sine',281,.46,'resonant'),
          n(at,2.7,407,'sine',398,.29,'resonant'),
          n(at,2.3,623,'sine',610,.17,'resonant'),
          n(at,1.9,933,'sine',916,.10,'resonant')
        ];
        notes=strike(0);
        if(id==='gongDouble')notes=notes.concat(strike(1.28).map(x=>({...x,amplitude:x.amplitude*.82})));
        break;
      }
      case 'taikoFinal':
        notes=[n(0,.75,170,'sine',70,1,'drum'),n(0,.22,490,'sawtooth',210,.28),n(.8,1.0,185,'sine',67,1,'drum'),n(.8,.25,590,'sawtooth',260,.30)];
        break;
      case 'buzzerFinal':
        notes=[...notesFor('buzzer','effort'),n(.65,.65,205,'sawtooth',240,.65),n(.65,.62,310,'square',320,.3)];
        break;
      case 'bellFinal':
        notes=[n(0,2.8,520,'sine',510,.68,'resonant'),n(0,2.4,1047,'sine',1031,.33,'resonant'),n(0,2.0,1550,'sine',1540,.15,'resonant'),n(0,.12,1750,'triangle',1150,.20,'metal')];
        break;
      default:notes=[n(0,.22,940)];break;
    }
    // Par défaut, le bip de fin est le gong spécifique, et non des notes ajoutées aux bips d'effort.
    if(event==='finish'&&!FINISH_SOUNDS.some(s=>s.id===id))return notesFor('gong','finish');
    return notes;
  }

  function signalEnvelope(note,local){
    const progress=local/note.duration;
    if(note.shape==='resonant')return Math.min(1,local/.003)*Math.exp(-4.1*progress)*Math.max(0,1-progress);
    if(note.shape==='drum')return Math.min(1,local/.003)*Math.exp(-5.2*progress)*Math.max(0,1-progress);
    if(note.shape==='metal')return Math.min(1,local/.002)*Math.exp(-6.8*progress)*Math.max(0,1-progress);
    return Math.min(1,local/.004)*Math.pow(Math.max(0,1-progress),.90);
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
      const value=clamp(total*.63*boundedVolume,-.96,.96);
      view.setInt16(44+i*2,Math.round(value*32767),true);
    }
    return bytes;
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
    const cached=new Map(),listeners=new Set();

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
      requestAmbientMix();
      const ctx=context;
      if(!ctx||ctx.state!=='running'){emit('blocked');return false;}
      if(normalizeVolume(volume)===0)return false;
      try{
        const now=ctx.currentTime+.007;
        const peak=.38*Math.pow(normalizeVolume(volume)/100,.82);
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
      cached.clear();
      if(context&&typeof context.close==='function')context.close().catch(()=>{});
      context=null;media=null;emit('inactive');
    }
    return {setMode,play,activateAndPlay,resume,onStatus,getState,getMixingStatus,destroy};
  }
  const api={SOUNDS,FINISH_SOUNDS,DEFAULTS,EVENTS,notesFor,pcmWav,normalize,normalizeFinish,normalizeVolume,createEngine};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBSoundEngine=api;
})(typeof window!=='undefined'?window:globalThis);
