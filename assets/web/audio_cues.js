/* Cues sonores de compte à rebours pour les séances de judo et Taïso.
 * Les horodatages sont absolus (ms depuis le démarrage).
 * Un bip manqué à cause d'une suspension Safari n'est jamais rejoué en rafale.
 */
(function(root){
  'use strict';

  function countdownCues(phases, previousMs, currentMs, maxLateMs=250){
    if(!Array.isArray(phases)||!Number.isFinite(previousMs)||!Number.isFinite(currentMs)
      ||currentMs<=previousMs||!Number.isFinite(maxLateMs)||maxLateMs<0)return [];
    const result=[];
    for(let i=0;i<phases.length-1;i++){
      const phase=phases[i],next=phases[i+1];
      if((phase.kind!=='prep'&&phase.kind!=='rest')||next.kind!=='effort')continue;
      const phaseStart=Number(phase.start);
      const phaseDuration=Number(phase.ms);
      if(!Number.isFinite(phaseStart)||!Number.isFinite(phaseDuration))continue;
      const end=phaseStart+phaseDuration;
      for(const count of [3,2,1]){
        const at=end-count*1000;
        // Ne pas ajouter un compte à rebours exactement au démarrage de la phase.
        if(at<phaseStart+500)continue;
        if(previousMs<at&&at<=currentMs&&currentMs-at<=maxLateMs){
          result.push({at,count,phaseIndex:i});
        }
      }
    }
    return result.sort((a,b)=>a.at-b.at);
  }

  const api={countdownCues};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBAudioCues=api;
})(typeof window!=='undefined'?window:globalThis);
