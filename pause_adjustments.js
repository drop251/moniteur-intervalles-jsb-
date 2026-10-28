/* Moniteur JSB — safe time editing while a session is paused.
 * Uses the already elapsed monotonic session time; changing a phase never
 * synthesizes sounds or advances the timer. Browser & mobile compatible.
 */
(function(root){
  'use strict';
  const ALLOWED = Object.freeze(['randori','golden','tabata']);
  const integerWithin=(value,min,max)=>
    Number.isSafeInteger(value)&&value>=min&&value<=max;

  function locatePhase(seq,timeMs){
    for(let i=0;i<seq.length;i++){
      if(timeMs<seq[i].start+seq[i].ms)return i;
    }
    return seq.length-1;
  }

  function rebuildCueTimes(seq,total,countdown){
    const cueTimes=seq.map(p=>p.start).filter(Number.isFinite);
    if(Number.isFinite(total))cueTimes.push(total);
    if(countdown){
      for(let i=0;i<seq.length-1;i++){
        const p=seq[i],next=seq[i+1];
        if((p.kind==='prep'||p.kind==='rest')&&next.kind==='effort'){
          const end=p.start+p.ms;
          for(const second of [3,2,1]){
            const at=end-second*1000;
            if(at>=p.start+500)cueTimes.push(at);
          }
        }
      }
    }
    return [...new Set(cueTimes)].sort((a,b)=>a-b);
  }

  // Explicitly round to seconds to match the app's MM:SS display and inputs.
  function applyPausedEdit(session,config,options={}){
    if(!session||!session.paused||session.finished)throw Error('La séance doit être en pause.');
    const kind=session.workout&&session.workout.kind;
    if(!ALLOWED.includes(kind))throw Error('Ce mode ne permet pas ce réglage.');
    const shownSeconds=config.displaySeconds;
    const countingUp=kind==='golden'&&session.seq.some(p=>p.kind==='effort'&&
      session.elapsed>=p.start&&session.elapsed<p.start+p.ms);
    if(!integerWithin(shownSeconds,countingUp?0:1,countingUp?21600:3600))
      throw Error('Saisis un temps valide.');

    if(['randori','tabata'].includes(kind)){
      if(!integerWithin(config.effortSeconds,1,3600)||
         !integerWithin(config.restSeconds,0,3600))
        throw Error('Les durées effort/repos doivent être comprises entre 0 et 60 minutes.');
    }
    const seq=session.seq.map(p=>({...p}));
    const index=locatePhase(seq,session.elapsed);
    const phase=seq[index];
    const oldMs=session.elapsed;
    let newMs=oldMs;

    if(countingUp){
      // Golden Score counts UP, so user edits elapsed time, not infinity.
      newMs=phase.start+shownSeconds*1000;
    }else{
      const phaseProgress=Math.max(0,oldMs-phase.start);
      // The currently displayed remaining time takes precedence over the
      // configured duration of future effort or recovery phases.
      phase.ms=phaseProgress+shownSeconds*1000;
    }

    let work=session.workout.work,rest=session.workout.rest;
    if(['randori','tabata'].includes(kind)){
      work=config.effortSeconds;
      rest=config.restSeconds;
      for(let i=index+1;i<seq.length;i++){
        if(seq[i].kind==='effort')seq[i].ms=work*1000;
        if(seq[i].kind==='rest')seq[i].ms=rest*1000;
      }
    }

    let total=0;
    for(const p of seq){p.start=total;total+=p.ms;}
    if(Number.isFinite(total)&&newMs>=total)throw Error('Le temps affiché dépasse la séance.');

    session.seq=seq;
    session.total=total;
    session.elapsed=newMs;
    session.base=0; // set by caller when resuming; ignored during pause.
    session.workout={...session.workout,work,rest};
    session.index=locatePhase(seq,newMs);
    session.lastCueMs=newMs;
    session.cueTimes=rebuildCueTimes(seq,total,options.countdown!==false);
    return {
      index:session.index,
      displayedSeconds:shownSeconds,
      phase:seq[session.index].kind,
      total,
      elapsed:newMs,
      nextCueTimes:session.cueTimes
    };
  }

  const api={ALLOWED,locatePhase,rebuildCueTimes,applyPausedEdit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JSBPauseAdjustments=api;
})(typeof window!=='undefined'?window:globalThis);
