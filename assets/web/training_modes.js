/* Modèles d'entraînement du Moniteur JSB.
 * EMOM/AMRAP sont conservés uniquement en stockage héritage, non proposés.
 */
(function(root){
  'use strict';
  const AVAILABLE=Object.freeze(['randori','golden','random','tabata','chrono','hiit','boxe']);
  const LEGACY=Object.freeze(['emom','amrap']);
  const DEFAULTS=Object.freeze({
    randori:Object.freeze({work:240,rest:60,cycles:5,prep:10}),
    golden:Object.freeze({work:0,rest:0,cycles:1,prep:10}),
    chrono:Object.freeze({work:0,rest:0,cycles:1,prep:0}),
    random:Object.freeze({work:180,rest:0,cycles:1,prep:10,frequency:'medium',progressive:true}),
    tabata:Object.freeze({work:20,rest:10,cycles:1,exercises:8,cycleRest:60,prep:10}),
    hiit:Object.freeze({work:30,rest:15,cycles:8,prep:10}),
    boxe:Object.freeze({work:180,rest:60,cycles:3,prep:10})
  });
  function isAvailable(kind){return AVAILABLE.includes(kind);}
  // Old Tabata presets stored only 'cycles' as the number of efforts.
  // Interpret those as ONE cycle containing that many exercises, so previously
  // saved sessions still have the same total duration after the upgrade.
  function tabataStructure(w){
    const grouped=Number.isSafeInteger(w.exercises)&&w.exercises>=1;
    return {
      cycles:grouped?w.cycles:1,
      exercises:grouped?w.exercises:w.cycles,
      cycleRest:grouped&&Number.isSafeInteger(w.cycleRest)&&w.cycleRest>=0?w.cycleRest:0,
      legacy:!grouped
    };
  }
  function workoutDuration(w){
    if(w.kind==='golden'||w.kind==='chrono')return Infinity;
    if(w.kind==='random')return w.prep+w.work;
    if(w.kind==='tabata'){
      const {cycles,exercises,cycleRest}=tabataStructure(w);
      return w.prep+cycles*exercises*w.work+
        cycles*(exercises-1)*w.rest+(cycles-1)*cycleRest;
    }
    return w.prep+w.work*w.cycles+w.rest*(w.cycles-1);
  }
  function phasePlan(w){
    const result=[];
    if(w.prep>0)result.push({kind:'prep',label:'PRÉPARATION',ms:w.prep*1000,cycle:0});
    if(w.kind==='golden'||w.kind==='chrono'){
      result.push({kind:'effort',label:w.kind==='chrono'?'CHRONOMÈTRE':'GOLDEN SCORE',ms:Infinity,cycle:1});
      return result;
    }
    if(w.kind==='random'){
      result.push({kind:'effort',label:'BIPS ALÉATOIRES',ms:w.work*1000,cycle:1});
      return result;
    }
    if(w.kind==='tabata'){
      const {cycles,exercises,cycleRest}=tabataStructure(w);
      for(let cycle=1;cycle<=cycles;cycle++){
        for(let exercise=1;exercise<=exercises;exercise++){
          result.push({kind:'effort',label:'EFFORT',ms:w.work*1000,cycle,exercise});
          if(exercise<exercises&&w.rest>0){
            result.push({kind:'rest',label:'REPOS ENTRE EXERCICES',
              ms:w.rest*1000,cycle,exercise,restType:'exercise'});
          }
        }
        if(cycle<cycles&&cycleRest>0){
          result.push({kind:'rest',label:'REPOS ENTRE CYCLES',
            ms:cycleRest*1000,cycle,exercise:exercises,restType:'cycle'});
        }
      }
      return result;
    }
    const name=w.kind==='randori'?'RANDORI':w.kind==='boxe'?'ROUND':'EFFORT';
    for(let i=1;i<=w.cycles;i++){
      result.push({kind:'effort',label:name,ms:w.work*1000,cycle:i});
      if(i<w.cycles&&w.rest>0)result.push({kind:'rest',label:'RÉCUPÉRATION',ms:w.rest*1000,cycle:i});
    }
    return result;
  }
  const api={AVAILABLE,LEGACY,DEFAULTS,isAvailable,tabataStructure,workoutDuration,phasePlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBTrainingModes=api;
})(typeof window!=='undefined'?window:globalThis);
