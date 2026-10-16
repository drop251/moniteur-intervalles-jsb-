const assert=require('node:assert/strict');
const {createPlayer,volumeValue}=require('../music_player.js');
assert.equal(volumeValue(140),100);assert.equal(volumeValue(-1),0);
let time=1000,deadline=null,urls=[],revoked=[];
const audio={paused:true,volume:1,src:'',loop:false,preload:'',load(){},play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true}};
const player=createPlayer({audio,AudioContextCtor:null,now:()=>time,
 createUrl:()=>{const url='blob:test-'+urls.length;urls.push(url);return url},
 revokeUrl:url=>revoked.push(url),setTimer:(callback,delay)=>{deadline={callback,at:time+delay};return 1},clearTimer:()=>{deadline=null}});
assert.equal(player.chooseFile({name:'text.txt',type:'text/plain'}),false);
assert.equal(player.chooseFile({name:'dojo.mp3',type:'audio/mpeg'}),true);
player.setVolume(80);player.setDuck(20);
(async()=>{
 assert.equal(await player.play(),true);assert.equal(audio.volume,.8);
 player.duckFor(900);assert.ok(Math.abs(audio.volume-.16)<.0001);
 time+=400;player.duckFor(500);
 assert.ok(Math.abs(audio.volume-.16)<.0001);
 time=deadline.at;deadline.callback();
 assert.ok(Math.abs(audio.volume-.8)<.0001);
 player.pause();assert.equal(audio.paused,true);
 player.dispose();assert.equal(revoked.length,1);
 console.log('Lecteur local, baisse temporaire et restauration du volume : tests réussis');
})().catch(error=>{console.error(error);process.exitCode=1});
