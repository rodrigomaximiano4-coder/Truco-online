'use strict';
const assert=require('assert'),{spawn}=require('child_process');
const port=31817, child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'}});
let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function req(path,data){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {code:r.status,body:await r.json()}}
(async()=>{try{
 for(let i=0;i<30&&!log.includes('MVP');i++)await sleep(100);assert(log.includes('MVP'),log);
 const a=(await req('/join',{name:'Ana'})).body,b=(await req('/join',{name:'Beto'})).body;
 assert.equal(a.game,b.game);assert.notEqual(a.seat,b.seat);
 let st=(await req('/state',{token:a.token})).body;assert.equal(st.phase,'waiting');assert.equal(st.players.filter(p=>!p.bot).length,2);
 // add 2 more humans and immediate start
 const c=(await req('/join',{name:'Carlos'})).body,d=(await req('/join',{name:'Duda'})).body;
 st=(await req('/state',{token:a.token})).body;assert.equal(st.phase,'playing');assert.equal(st.players.filter(p=>!p.bot).length,4);
 const seats=[a,b,c,d];const current=seats[st.turn];assert.equal((await req('/play',{token:current.token,index:0})).code,200);
 const next=(await req('/state',{token:a.token})).body;assert.equal(next.turn,(st.turn+1)%4);
 assert.equal((await req('/play',{token:current.token,index:0})).code,409);
 // departure replaces with bot without kicking others
 assert.equal((await req('/leave',{token:b.token})).code,200);
 st=(await req('/state',{token:a.token})).body;assert(st.players[b.seat].bot);
 assert(!st.hand.some(c=>!c.r||!c.s));assert.equal(st.hand.length,3-(st.played[a.seat]?1:0));
 console.log('PASS: matchmaking, 4 humanos, turnos, cartas privadas, saída e bot');
 }catch(e){console.error('FAIL',e);process.exitCode=1}finally{child.kill()}})();
