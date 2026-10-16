/* Lecteur de fichier audio local, indépendant du moteur des bips.
 * Ducking avec GainNode pour Safari iOS lorsque disponible ;
 * repli element.volume sur navigateurs compatibles.
 * Aucune musique n'est envoyée au serveur ni persistée.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const volumeValue=v=>Number.isFinite(Number(v))?clamp(Number(v),0,100):70;
function createPlayer(deps={}){
 const host=deps.host||root;
 const audio=deps.audio||new host.Audio();
 const AudioContextCtor=deps.AudioContextCtor===undefined?(host.AudioContext||host.webkitAudioContext):deps.AudioContextCtor;
 const createUrl=deps.createUrl||((file)=>host.URL.createObjectURL(file));
 const revokeUrl=deps.revokeUrl||((url)=>host.URL.revokeObjectURL(url));
 const setTimer=deps.setTimer||((fn,delay)=>host.setTimeout(fn,delay));
 const clearTimer=deps.clearTimer||((id)=>host.clearTimeout(id));
 audio.preload='metadata';audio.loop=true;
 let context=null,gain=null,source=null,url=null,base=70,duckPercent=25,duckUntil=0,duckTimer=null;
 const clock=deps.now||(()=>Date.now());
 function effective(){return volumeValue(base)/100*(clock()<duckUntil?volumeValue(duckPercent)/100:1)}
 function apply(){
  const level=effective();
  if(gain&&context){gain.gain.setTargetAtTime(level,context.currentTime,.045);}
  else try{audio.volume=level}catch{}
 }
 function ensureGraph(){
  if(context||!AudioContextCtor)return;
  try{
   context=new AudioContextCtor();source=context.createMediaElementSource(audio);gain=context.createGain();
   source.connect(gain);gain.connect(context.destination);
  }catch{context=null;gain=null;source=null}
  apply();
 }
 function activate(){
  ensureGraph();
  if(context&&context.state==='suspended')return Promise.resolve(context.resume()).catch(()=>false);
  return Promise.resolve(true);
 }
 function chooseFile(file){
  if(!file||!file.type.startsWith('audio/'))return false;
  audio.pause();
  if(url){revokeUrl(url);url=null;}
  url=createUrl(file);audio.src=url;audio.load?.();apply();return true;
 }
 function play(){
  if(!url)return Promise.resolve(false);
  // Appelé dans un clic : playback démarré sans attendre l'unlock asynchrone.
  const unlock=activate();
  try{
   const p=audio.play();
   return Promise.all([Promise.resolve(unlock),Promise.resolve(p)])
     .then(()=>true).catch(()=>false);
  }catch{return Promise.resolve(false)}
 }
 function pause(){audio.pause()}
 function toggle(){return audio.paused?play():(pause(),Promise.resolve(false))}
 function setVolume(value){base=volumeValue(value);apply()}
 function setDuck(value){duckPercent=volumeValue(value);apply()}
 function duckFor(durationMs){
  if(audio.paused||!url)return;
  const duration=clamp(Number(durationMs)||0,0,10000);
  duckUntil=Math.max(duckUntil,clock()+duration);
  if(duckTimer!==null)clearTimer(duckTimer);
  apply();
  duckTimer=setTimer(()=>{duckTimer=null;duckUntil=0;apply()},duckUntil-clock()+25);
 }
 function getState(){return{loaded:!!url,paused:audio.paused,volume:base,duck:duckPercent}}
 function dispose(){
  pause();
  if(duckTimer!==null)clearTimer(duckTimer);
  if(url)revokeUrl(url);
  url=null;
  if(context)Promise.resolve(context.close()).catch(()=>{});
 }
 return{chooseFile,play,pause,toggle,setVolume,setDuck,duckFor,getState,dispose,audio};
}
const api={createPlayer,volumeValue};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.JSBMusicPlayer=api;
})(typeof window!=='undefined'?window:globalThis);
