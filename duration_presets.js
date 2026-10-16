/* Durées rapides du Moniteur JSB (en secondes).
 * Toutes les valeurs sont compatibles avec l'éditeur : 1 à 3 600 s.
 */
(function(root){
  'use strict';

  const common = Object.freeze([5,10,15,20,25,30,40,45,50,60,75,90,120,150,180,240,300,360,420,480,600]);
  const emom = Object.freeze([15,20,30,40,45,60,75,90,120,150,180,240,300,600]);
  const amrap = Object.freeze([60,120,180,240,300,360,420,480,600,720,900,1200,1500,1800,2400,3600]);
  const boxe = Object.freeze([30,45,60,90,120,150,180,240,300,360,480,600]);
  const presets = Object.freeze({hiit:common,tabata:common,emom,amrap,boxe});

  function presetsForMode(mode){
    return presets[mode] || common;
  }
  function hasPreset(mode,seconds){
    return Number.isInteger(Number(seconds))
      && presetsForMode(mode).includes(Number(seconds));
  }
  function formatDuration(seconds){
    const n=Number(seconds);
    if(!Number.isFinite(n)||n<0) return '';
    const minutes=Math.floor(n/60),remainder=n%60;
    if(minutes===0) return n+' s';
    if(remainder===0) return minutes+' min';
    return minutes+' min '+remainder+' s';
  }
  /* Conversion fiable pour les deux sélecteurs minutes / secondes. */
  function splitDuration(value, maxSeconds=3600){
    const n=Number(value);
    const total=Number.isFinite(n)?Math.max(0,Math.min(maxSeconds,Math.floor(n))):0;
    return {minutes:Math.floor(total/60),seconds:total%60};
  }
  function combineDuration(minutes,seconds,maxSeconds=3600,minSeconds=0){
    const m=Number(minutes),s=Number(seconds);
    if(!Number.isInteger(m)||!Number.isInteger(s)||m<0||s<0||s>59)return null;
    const total=m*60+s;
    if(total>maxSeconds||total<minSeconds)return null;
    return total;
  }
  const api={presetsForMode,hasPreset,formatDuration,splitDuration,combineDuration};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBDurationPresets=api;
})(typeof window!=='undefined'?window:globalThis);
