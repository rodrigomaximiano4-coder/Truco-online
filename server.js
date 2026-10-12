'use strict';
// Multiplayer MVP (sem dinheiro, compras ou ranking): servidor autoritativo, HTTP JSON polling.
const http=require('http'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||'0.0.0.0';
const ORIGIN=process.env.ALLOWED_ORIGIN||'*'; // MVP de testes: ajustar origem antes de producao
const RK=['4','5','6','7','Q','J','K','A','2','3'], SU=['♦','♠','♥','♣'];
const rand=n=>crypto.randomInt(n), id=()=>crypto.randomBytes(16).toString('hex');
const games=new Map(), sessions=new Map();let waiting=null;
const RECONNECT_GRACE_MS=10000, INACTIVITY_MS=25000;
const pub=g=>({id:g.id,phase:g.phase,score:g.score,rounds:g.rounds,round:g.rounds.length,turn:g.turn,deadline:g.deadline,lead:g.lead,mao:g.mao,vira:g.vira,man:g.man,played:g.played,players:g.players.map((p,i)=>({seat:i,name:p.name,bot:p.bot})),winner:g.winner,notice:g.notice});
const strength=(c,man)=>!c?-1:c.r===man?100+SU.indexOf(c.s):RK.indexOf(c.r);
function check(g){const a=g.rounds.filter(x=>x===0).length,b=g.rounds.filter(x=>x===1).length,r=g.rounds;
 if(a===2)return 0;if(b===2)return 1;
 if(r.length>1&&r[0]==='t'&&r[1]!=='t')return r[1];
 if(r.length>1&&r[0]!=='t'&&r[1]==='t')return r[0];
 if(r.length===3)return r[2]==='t'?(r[0]!=='t'?r[0]:g.mao%2):a>b?0:1;
 return null;}
function notify(g){g.updated=Date.now()}
function deal(g){const deck=RK.flatMap(r=>SU.map(s=>({r,s})));for(let i=deck.length-1;i>0;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}
 g.hands=[0,1,2,3].map(()=>deck.splice(0,3));g.vira=deck.pop();g.man=RK[(RK.indexOf(g.vira.r)+1)%10];g.played=[null,null,null,null];g.rounds=[];g.lead=g.mao;g.turn=g.mao;g.deadline=Date.now()+11000;g.phase='playing';g.notice='Nova mão';notify(g)}
function start(g){if(g.phase!=='waiting')return;g.phase='playing';g.mao=0;g.score=[0,0];deal(g);if(waiting===g.id)waiting=null}
function complete(g){const max=Math.max(...g.played.map(c=>strength(c,g.man)));const best=g.played.map((c,i)=>strength(c,g.man)===max?i:null).filter(i=>i!==null);const team=best[0]%2,tie=best.some(i=>i%2!==team);g.rounds.push(tie?'t':team);let winner=check(g);
 if(winner!==null){g.score[winner]++;g.notice=`Dupla ${winner+1} ganhou a mão`;
 if(g.score[winner]>=12){g.phase='over';g.winner=winner;g.deadline=0;notify(g);return}
 g.mao=(g.mao+1)%4;deal(g);g.notice=`Dupla ${winner+1} ganhou; próxima mão`;return}
 g.lead=tie?g.lead:best[0];g.turn=g.lead;g.played=[null,null,null,null];g.deadline=Date.now()+11000;g.notice=tie?'Rodada empatada':'Rodada encerrada';notify(g)}
function play(g,seat,index){if(g.phase!=='playing'||g.turn!==seat||g.played[seat])return false;if(!Number.isInteger(index)||index<0||index>=g.hands[seat].length)return false;
 const card=g.hands[seat].splice(index,1)[0];g.played[seat]=card;
 if(g.played.every(Boolean)){complete(g)}else{g.turn=(seat+1)%4;g.deadline=Date.now()+11000;notify(g)}return true}
function botMove(g,seat){const hand=g.hands[seat],already=g.played.filter(Boolean);const best=already.length?Math.max(...already.map(c=>strength(c,g.man))):-1;
 const sorted=hand.map((c,i)=>({i,s:strength(c,g.man)})).sort((a,b)=>a.s-b.s);
 const partner=g.played[(seat+2)%4];const partnerAhead=partner&&strength(partner,g.man)>=best;
 const choice=partnerAhead?sorted[0]:(sorted.find(x=>x.s>best)||sorted[0]);if(choice)play(g,seat,choice.i)}
function tick(g){const now=Date.now();if(g.phase==='waiting'){if(now-g.created>=8000||g.players.every(p=>!p.bot))start(g);return}
 if(g.phase!=='playing'||now<g.deadline)return;botMove(g,g.turn);g.notice='11 segundos: jogada automática';notify(g)}
function sweep(){for(const g of games.values()){
 for(let i=0;i<4;i++){const p=g.players[i];if(!p.bot&&(p.reconnectUntil ? Date.now()>=p.reconnectUntil : Date.now()-p.lastSeen>INACTIVITY_MS)){p.bot=true;p.name=`Bot ${i+1}`;sessions.delete(p.token);p.token=null;p.reconnectUntil=0;notify(g)}}
 tick(g)}
 for(const [k,g] of games)if(Date.now()-g.created>24*3600*1000){games.delete(k);if(waiting===k)waiting=null}}
setInterval(sweep,300).unref();
function join(name){name=String(name||'Jogador').trim().slice(0,24);if(!name)name='Jogador';let g=waiting&&games.get(waiting);
 if(!g||g.phase!=='waiting'||g.players.every(p=>!p.bot)){g={id:id(),created:Date.now(),phase:'waiting',players:[0,1,2,3].map(i=>({name:`Bot ${i+1}`,bot:true,token:null,lastSeen:0})),score:[0,0],rounds:[],played:[null,null,null,null],hands:[[],[],[],[]],turn:0,deadline:0,notice:'Aguardando jogadores (até 8 segundos)',winner:null};games.set(g.id,g);waiting=g.id}
 const seat=g.players.findIndex(p=>p.bot);const token=id();g.players[seat]={name,bot:false,token,lastSeen:Date.now()};sessions.set(token,{game:g.id,seat});notify(g);tick(g);return {token,seat,game:g.id,waitingSeconds:8}}
function lookup(token){const s=sessions.get(String(token||''));const g=s&&games.get(s.game);if(!g)return null;const p=g.players[s.seat];if(p.token!==token||p.bot)return null;p.lastSeen=Date.now();p.reconnectUntil=0;return {g,seat:s.seat,p}}
const MAX=4096;
const server=http.createServer((req,res)=>{
 const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
 const send=(status,obj)=>{res.writeHead(status,cors);res.end(JSON.stringify(obj))};
 if(req.method==='GET' && (req.url==='/'||req.url==='/online.html')){
  const file=path.join(__dirname,'online.html');
  return fs.readFile(file,(err,html)=>{
   if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('online.html nao encontrado na raiz do repositorio')};
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html)
  })
 }
 if(req.method==='OPTIONS')return send(200,{});
 if(req.url==='/health')return send(200,{ok:true,version:'online-mvp-1.5-deploy'});
 if(!['/join','/state','/play','/leave','/suspend'].includes(req.url)||req.method!=='POST')return send(404,{error:'Rota desconhecida'});
 let raw='';req.on('data',ch=>{raw+=ch;if(raw.length>MAX)req.destroy()});req.on('end',()=>{
 let x;try{x=JSON.parse(raw||'{}')}catch{return send(400,{error:'JSON inválido'})}
 if(req.url==='/join')return send(200,join(x.name));
 const found=lookup(x.token);if(!found)return send(401,{error:'Sessão expirada ou jogador substituído por bot'});
 const {g,seat}=found;tick(g);
 if(req.url==='/suspend'){found.p.reconnectUntil=Date.now()+RECONNECT_GRACE_MS;notify(g);return send(200,{ok:true,graceSeconds:10})}
 if(req.url==='/state')return send(200,{...pub(g),you:seat,hand:g.hands[seat],serverTime:Date.now()});
 if(req.url==='/play'){if(g.phase!=='playing'||g.turn!==seat)return send(409,{error:'Não é sua vez'});if(Date.now()>g.deadline){tick(g);return send(409,{error:'Seu tempo terminou'})}if(!play(g,seat,x.index))return send(400,{error:'Jogada inválida'});return send(200,{ok:true})}
 if(req.url==='/leave'){g.players[seat]={name:`Bot ${seat+1}`,bot:true,token:null,lastSeen:0};sessions.delete(x.token);notify(g);return send(200,{ok:true})}
 });
});
server.listen(PORT,HOST,()=>console.log(`Truco Online MVP em http://${HOST}:${PORT}`));
