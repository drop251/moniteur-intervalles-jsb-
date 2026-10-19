/* Signaux aléatoires d'entraînement : plan déterminé en début de séance.
 * Les horodatages sont relatifs au début du travail, en millisecondes.
 * Aucun signal groupé au démarrage ni à la toute fin, et jamais de rattrapage audio.
 */
(function(root){
  'use strict';
  const PROFILES=Object.freeze({
    low:Object.freeze({min:15000,max:27000}),
    medium:Object.freeze({min:9000,max:17000}),
    high:Object.freeze({min:5500,max:10500})
  });
  const MIN_GAP_MS=3500;
  function clamp(value,low,high){return Math.max(low,Math.min(high,value));}
  function createSignals({workMs,frequency='medium',progressive=true,rng=Math.random}={}){
    if(!Number.isFinite(workMs)||workMs<=0)return [];
    const profile=PROFILES[frequency]||PROFILES.medium;
    const result=[];
    let elapsed=2500;
    const end=workMs-1200;
    for(let iteration=0;iteration<2000;iteration++){
      const phase=clamp(elapsed/workMs,0,1);
      // Au début, davantage d'espace entre les bips. En fin de travail,
      // densité croissante sans descendre sous l'espacement de sécurité.
      const factor=progressive?(1.55-0.95*phase):1;
      const random=clamp(Number(rng())||0,0,0.999999);
      const interval=Math.max(MIN_GAP_MS,Math.round((profile.min+(profile.max-profile.min)*random)*factor));
      elapsed+=interval;
      if(elapsed>=end)break;
      result.push(elapsed);
    }
    return result;
  }
  const api={createSignals,PROFILES,MIN_GAP_MS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBRandomSignals=api;
})(typeof window!=='undefined'?window:globalThis);
