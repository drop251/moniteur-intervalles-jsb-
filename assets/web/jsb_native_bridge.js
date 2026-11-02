/* Bridge hors-ligne entre l'interface JSB d'origine et l'audio natif iOS/Android.
   Aucun son Web Audio n'est émis dans l'application : pas de double bip,
   les signaux sont synthétisés avec les mêmes profils que la version web,
   puis lus par AVAudioPlayer/AudioTrack via Flutter. */
(function(root) {
  'use strict';
  if (!root.JSBHost || !root.JSBSoundEngine) return;
  const api = root.JSBSoundEngine;
  const cache = new Map();
  let lastPreparedCue = null;
  const post = payload => {
    try { root.JSBHost.postMessage(JSON.stringify(payload)); return true; }
    catch(error) { console.warn('[JSB] native bridge:',error); return false; }
  };
  function wavBase64(sound, event) {
    const key = sound + '|' + event;
    if(cache.has(key)) return cache.get(key);
    const originalSample=api.sampleWavBase64?.(sound,event);
    if(originalSample){cache.set(key,originalSample);return originalSample;}
    const data = api.pcmWav(api.notesFor(sound, event), 100);
    const chunks = [];
    for(let i=0;i<data.length;i+=8192) {
      chunks.push(String.fromCharCode.apply(null, data.subarray(i, i+8192)));
    }
    const result = btoa(chunks.join(''));
    cache.set(key,result);
    if(cache.size>16) cache.delete(cache.keys().next().value);
    return result;
  }

  api.createEngine = function() {
    let status='ready';
    const listeners=new Set();
    const emit=s => { status=s; for(const fn of listeners)try{fn(s)}catch{} };
    function play(sound,event='effort',volume=70) {
      const gain=Number(volume);
      if(!Number.isFinite(gain)||gain<=0) {emit('muted');return false;}
      try {
        const wav=wavBase64(sound,event);
        const ok=post({type:'cue',event,sound,volume:Math.max(0,Math.min(100,gain)),
          wavBase64:wav,vibrate:false});
        emit(ok?'ready':'blocked');
        return ok;
      } catch(error) {
        console.error('[JSB] Erreur signal natif:',error);
        emit('blocked');return false;
      }
    }
    return {
      setMode:()=>emit('ready'),
      play,
      activateAndPlay:(sound,event,volume)=>Promise.resolve(play(sound,event,volume)),
      resume:()=>Promise.resolve(true),
      onStatus:fn=>{listeners.add(fn);fn(status);return()=>listeners.delete(fn)},
      getState:()=>status,
      getMixingStatus:()=>({supported:true,active:true}),
      destroy:()=>{cache.clear();emit('inactive')}
    };
  };

  function release() {
    lastPreparedCue = null;
    post({type:'release'});
  }
  root.JSBNativeAudio = {
    release,
    reset:()=>{lastPreparedCue=null},
    setAwake:enabled=>post({type:'screenAwake',enabled:!!enabled}),
    haptic:event=>post({type:'haptic',event:String(event||'effort')}),
    maybePrepare(now,cues,enabled=true) {
      if(!enabled || !Array.isArray(cues))return;
      // Chronological cue deadlines; never send redundant requests on every frame.
      for(const cueTime of cues) {
        if(!Number.isFinite(cueTime)||cueTime<now-150)continue;
        if(cueTime-now>3000)break;
        if(lastPreparedCue!==cueTime) {
          lastPreparedCue=cueTime;
          post({type:'prepare'});
        }
        return;
      }
    }
  };
})(window);
