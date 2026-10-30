(function(){
const DN=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const KEY="iac-escala5x2-v3", ENC=75;
const SEGS=[
 {n:"Atacado / distribuidora",t:"comercio",w:["07:00","18:00"],s:["07:00","13:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Material de construção",t:"comercio",w:["07:00","18:00"],s:["07:00","13:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Pet shop",t:"comercio",w:["08:00","19:00"],s:["08:00","17:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Loja de conveniência",t:"comercio",w:["06:00","23:00"],s:["06:00","23:00"],d:["07:00","22:00"],on:[1,1,1,1,1,1,1]},
 {n:"Concessionária / revenda de veículos",t:"comercio",w:["08:00","18:00"],s:["08:00","14:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Posto de combustível",t:"outros",w:["06:00","22:00"],s:["06:00","22:00"],d:["07:00","20:00"],on:[1,1,1,1,1,1,1]},
 {n:"Lanchonete / pizzaria (noite)",t:"outros",w:["17:00","23:30"],s:["17:00","23:59"],d:["17:00","23:30"],on:[0,1,1,1,1,1,1]},
 {n:"Bar / restaurante (almoço e jantar)",t:"outros",w:["11:00","23:00"],s:["11:00","23:59"],d:["11:00","17:00"],on:[0,1,1,1,1,1,1]},
 {n:"Hotel / pousada",t:"outros",w:["07:00","23:00"],s:["07:00","23:00"],d:["07:00","23:00"],on:[1,1,1,1,1,1,1]},
 {n:"Clínica / consultório",t:"outros",w:["07:00","19:00"],s:["08:00","12:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Laboratório / hospital",t:"outros",w:["06:00","20:00"],s:["06:00","18:00"],d:["07:00","13:00"],on:[1,1,1,1,1,1,1]},
 {n:"Salão de beleza / barbearia",t:"outros",w:["09:00","19:00"],s:["08:00","18:00"],d:null,on:[0,1,1,1,1,1,0]},
 {n:"Academia",t:"outros",w:["06:00","22:00"],s:["08:00","14:00"],d:["08:00","12:00"],on:[1,1,1,1,1,1,1]},
 {n:"Escola / creche",t:"outros",w:["07:00","19:00"],s:null,d:null,on:[1,1,1,1,1,0,0]},
 {n:"Oficina mecânica",t:"outros",w:["08:00","18:00"],s:["08:00","12:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Lavanderia",t:"outros",w:["08:00","19:00"],s:["08:00","14:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Transportadora / logística",t:"outros",w:["06:00","18:00"],s:["06:00","12:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Call center / atendimento",t:"outros",w:["08:00","20:00"],s:["09:00","15:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Construção civil",t:"outros",w:["07:00","17:00"],s:null,d:null,on:[1,1,1,1,1,0,0]},
 {n:"Depósito de bebidas / adega",t:"comercio",w:["08:00","22:00"],s:["08:00","23:00"],d:["09:00","15:00"],on:[1,1,1,1,1,1,1]},
 {n:"Supermercado / mercado",t:"comercio",w:["07:00","22:00"],s:["07:00","22:00"],d:["08:00","14:00"],on:[1,1,1,1,1,1,1]},
 {n:"Loja de rua",t:"comercio",w:["09:00","18:00"],s:["09:00","13:00"],d:null,on:[1,1,1,1,1,1,0]},
 {n:"Loja de shopping",t:"comercio",w:["10:00","22:00"],s:["10:00","22:00"],d:["14:00","20:00"],on:[1,1,1,1,1,1,1]},
 {n:"Açougue / hortifrúti",t:"comercio",w:["06:00","19:00"],s:["06:00","18:00"],d:["07:00","13:00"],on:[1,1,1,1,1,1,1]},
 {n:"Farmácia / drogaria",t:"outros",w:["07:00","22:00"],s:["08:00","20:00"],d:["08:00","16:00"],on:[1,1,1,1,1,1,1]},
 {n:"Padaria / cafeteria",t:"outros",w:["05:00","21:00"],s:["05:00","21:00"],d:["06:00","14:00"],on:[1,1,1,1,1,1,1]},
 {n:"Restaurante (almoço)",t:"outros",w:["09:00","17:00"],s:["09:00","17:00"],d:["09:00","17:00"],on:[0,1,1,1,1,1,1]},
 {n:"Escritório / serviços",t:"outros",w:["08:00","18:00"],s:null,d:null,on:[1,1,1,1,1,0,0]},
 {n:"Indústria (seg a sáb)",t:"outros",w:["06:00","16:00"],s:["06:00","12:00"],d:null,on:[1,1,1,1,1,1,0]}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toM=s=>{const [h,m]=(s||"0:0").split(":").map(Number);return h*60+(m||0)};
const hm=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")};
const hfmt=h=>{const t=Math.round(h*60);return Math.floor(t/60)+"h"+(t%60?String(t%60).padStart(2,"0"):"")};
const brl=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});

function daysFromSeg(sg){
  return [...Array(7)].map((_,k)=>{const h=k<5?sg.w:k===5?sg.s:sg.d;const on=!!sg.on[k]&&!!h;
    return {on,a:(h||sg.w)[0],f:(h||sg.w)[1],need:0};});
}
function exemplo(){
  const si=SEGS.findIndex(x=>x.n.startsWith("Supermercado")), sg=SEGS[si];
  const team=[["Ana","F"],["Bruna","F"],["Carla","F"],["Daniela","F"],["Eduardo","M"],["Felipe","M"],["Gustavo","M"],["Henrique","M"]].map(([n,s])=>({n,s}));
  const st={seg:si,tipo:sg.t,team,days:daysFromSeg(sg),needAuto:true,fase:"42",contratar:true,sal:2150,enc:75,ben:0,ov:{},wk:0,names:{}};
  autoNeed(st); return st;
}
function autoNeed(st){
  const N=st.team.length, open=st.days.filter(d=>d.on).length; if(!open) return;
  const K=Math.min(6,open), total=N*K;
  if(open<=6){ st.days.forEach(d=>d.need=d.on?Math.min(N,Math.round(total/open)):0); return; }
  const sun=Math.max(N?1:0,Math.round(N*0.4)), rest=Math.floor((total-sun)/6); let extra=(total-sun)-rest*6;
  st.days.forEach((d,k)=>d.need=d.on?(k===6?sun:Math.min(N,rest+(extra-->0?1:0))):0);
}
let S;
try{ const d=JSON.parse(localStorage.getItem(KEY)); if(d&&Array.isArray(d.team)&&Array.isArray(d.days)) S=d; }catch(e){}
if(!S) S=exemplo();
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(S)) }catch(e){} };

/* ---------- Abas ---------- */
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("nav.tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));
  $("pane-sim").hidden=b.dataset.tab!=="sim"; $("pane-regras").hidden=b.dataset.tab!=="regras";
});

/* ---------- Entradas ---------- */
$("segm").innerHTML=SEGS.map((s,i)=>[s.n,i]).sort((x,y)=>x[0].localeCompare(y[0],"pt")).map(([n,i])=>`<option value="${i}">${esc(n)}</option>`).join("")+`<option value="-1">Outro (ajustar manualmente)</option>`;
$("segm").onchange=e=>{ const i=+e.target.value; S.seg=i; S.modelo=null; S.tnAuto=true; if(i>=0){ const sg=SEGS[i]; S.tipo=sg.t; S.days=daysFromSeg(sg); S.needAuto=true; autoNeed(S); } S.ov={}; renderInputs(); run(); };
document.querySelectorAll("#tipo button").forEach(b=>b.onclick=()=>{ S.tipo=b.dataset.v; S.ov={}; renderInputs(); run(); });
document.querySelectorAll(".stepper button").forEach(b=>b.onclick=()=>{
  const sx=b.dataset.c, d=+b.dataset.d;
  if(d>0){ const n=S.team.filter(p=>p.s===sx).length+1; S.team.push({n:(sx==="F"?"Colaboradora ":"Colaborador ")+n,s:sx}); }
  else { for(let i=S.team.length-1;i>=0;i--) if(S.team[i].s===sx){ S.team.splice(i,1); break; } }
  if(S.needAuto) autoNeed(S); S.ov={}; renderInputs(); run();
});
const MODELOS={
  "5":k=>k<5?{on:true,a:"08:00",f:"17:48"}:{on:false,a:"08:00",f:"12:00"},
  "6":k=>k<5?{on:true,a:"08:00",f:"17:00"}:k===5?{on:true,a:"08:00",f:"12:00"}:{on:false,a:"08:00",f:"12:00"},
  "7":k=>({on:true,a:"08:00",f:"16:20"})
};
document.querySelectorAll("#modelos .modelo").forEach(b=>b.onclick=()=>{
  const m=b.dataset.m; S.modelo=m; S.seg=-1;
  S.days=S.days.map((_,k)=>({...MODELOS[m](k),need:0})); S.needAuto=true; autoNeed(S); S.ov={}; S.fase="44"; S.alm=60;
  renderInputs(); run();
});
$("almDur").onchange=e=>{ S.alm=+e.target.value; run(); };
$("almIni").onchange=e=>{ S.almIni=e.target.value; run(); };
$("tnAuto").onclick=()=>{ S.tnAuto=true; S.needAuto=true; autoNeed(S); (S.tt||[]).forEach(t=>t.auto=true); S.ov={}; renderInputs(); run(); };
$("needAuto").onclick=()=>{ S.needAuto=true; S.tnAuto=true; autoNeed(S); S.ov={}; renderInputs(); run(); };
$("contratar").onchange=e=>{ S.contratar=e.target.checked; S.ov={}; run(); };
const parseBRL=v=>{ v=String(v||"").replace(/[^\d,.-]/g,""); if(v.includes(",")) v=v.replace(/\./g,"").replace(",","."); else if(/^\d{1,3}(\.\d{3})+$/.test(v)) v=v.replace(/\./g,""); const n=parseFloat(v); return isFinite(n)&&n>0?n:0; };
const fmtBRL=n=>n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
["sal","ben"].forEach(id=>{ $(id).oninput=e=>{ S[id]=parseBRL(e.target.value); renderCost(); save(); }; $(id).onblur=e=>{ e.target.value=S[id]?fmtBRL(S[id]):""; }; });
document.querySelectorAll("#fases .fase").forEach(b=>b.onclick=()=>{ S.fase=b.dataset.v; S.ov={}; renderInputs(); run(); });
$("undo").onclick=()=>{ S.ov={}; run(); };
$("exemplo").onclick=()=>{ S=exemplo(); renderInputs(); run(); };

function renderTitle(){ $("gtitle").textContent="Escala da equipe"; }
function horasPadrao(k){ const sg=SEGS[S.seg]; if(sg){ const h=k<5?sg.w:k===5?(sg.s||sg.w):(sg.d||sg.s||sg.w); return {a:h[0],f:h[1]}; } const ref=S.days.find(d=>d.on)||S.days[0]; return {a:ref.a,f:ref.f}; }
function renderInputs(){
  $("segm").value=S.seg;
  $("dayrow").innerHTML=S.days.map((d,k)=>`<button class="dchip" data-k="${k}" aria-pressed="${d.on}" aria-label="${DN[k]}: ${d.on?"aberto":"fechado"}">${DN[k]}</button>`).join("");
  $("dayrow").querySelectorAll(".dchip").forEach(b=>b.onclick=()=>{ const k=+b.dataset.k, d=S.days[k]; d.on=!d.on; if(d.on&&!S.modelo) Object.assign(d,horasPadrao(k)); S.modelo=null; if(S.needAuto) autoNeed(S); else d.need=d.on?Math.max(1,d.need):0; S.ov={}; renderInputs(); run(); });
  const grupos=[["Seg a Sex",[0,1,2,3,4]],["Sábado",[5]],["Domingo",[6]]];
  $("func").innerHTML=grupos.map(([nm,ks],gi)=>{ const on=ks.some(k=>S.days[k].on), ref=S.days[ks.find(k=>S.days[k].on)??ks[0]];
    return `<div class="fr ${on?"":"off"}"><b>${nm}</b>
      <div><label class="l" for="fa${gi}">Abre</label><input type="time" id="fa${gi}" data-g="${gi}" data-f="a" value="${ref.a}" ${on?"":"disabled"}></div>
      <div><label class="l" for="ff${gi}">Fecha</label><input type="time" id="ff${gi}" data-g="${gi}" data-f="f" value="${ref.f}" ${on?"":"disabled"}></div></div>`; }).join("");
  $("func").querySelectorAll("input").forEach(inp=>inp.onchange=()=>{ const ks=grupos[+inp.dataset.g][1]; ks.forEach(k=>S.days[k][inp.dataset.f]=inp.value); S.modelo=null; S.ov={}; renderInputs(); run(); });
  const N=S.team.length;
  const Pv=params(S.fase,Math.max(1,S.days.filter(d=>d.on).length)), multi=aplicarTurnos(Pv);
  $("sug").hidden=multi; $("tn").hidden=!multi;
  if(!multi){
    $("sugTitle").textContent="Pessoas por dia"; $("tnAuto").hidden=S.needAuto!==false;
    $("sugHint").textContent=N?`Sugestão para a equipe de ${N} pessoa${N>1?"s":""}. Ajuste com − e + quantas pessoas trabalham em cada dia.`:"Adicione pessoas na equipe para ver a sugestão.";
    $("sug").innerHTML=S.days.map((d,k)=>d.on?`<div><b>${DN[k]}</b><span>${d.a} às ${d.f}</span><div class="mini"><button data-k="${k}" data-n="-1" aria-label="Menos pessoas ${DN[k]}">−</button><output>${d.need}</output><button data-k="${k}" data-n="1" aria-label="Mais pessoas ${DN[k]}">+</button></div></div>`:`<div class="closed"><b>${DN[k]}</b><span>fechado</span><em></em></div>`).join("");
    $("sug").querySelectorAll(".mini button").forEach(b=>b.onclick=()=>{ const d=S.days[+b.dataset.k]; d.need=Math.max(0,d.need+ +b.dataset.n); S.needAuto=false; S.ov={}; renderInputs(); run(); });
  } else {
  $("sugTitle").textContent="Turnos da equipe"; $("tnAuto").hidden=S.tnAuto!==false&&S.tt.every(t=>t.auto!==false);
  const kRef=[0,1,2,3,4,5,6].find(k=>S.days[k].on)??0, spr=spanOf(Pv.dm(kRef));
  const tot=GRP.map((_,g)=>S.tn[g].reduce((x,y)=>x+y,0));
  $("tn").innerHTML=`<thead><tr><th class="tl2">Turno</th><th class="tl2">Horário</th>${GN.map(n=>`<th>${n}</th>`).join("")}</tr></thead><tbody>${[0,1,2].map(j=>{ const ini=toM(S.tt[j].ini), used=S.tn.some(t=>t[j]>0);
    return `<tr class="${used?"":"unused"}"><td class="tnm"><b><i class="kc${j}"></i>Turno ${j+1}</b></td>
      <td class="thr"><input type="time" id="ti${j}" data-j="${j}" value="${S.tt[j].ini}" aria-label="Início do turno ${j+1}"><small>até ${hm(ini+spr)}</small></td>
      ${GRP.map((ks,g)=>{ if(!ks.some(k=>S.days[k].on)) return `<td class="na">fechado</td>`; const v=S.tn[g][j]||0;
        return `<td><div class="mini"><button data-g="${g}" data-j="${j}" data-n="-1" aria-label="Menos pessoas turno ${j+1} ${GN[g]}">−</button><output>${v}</output><button data-g="${g}" data-j="${j}" data-n="1" aria-label="Mais pessoas turno ${j+1} ${GN[g]}">+</button></div></td>`; }).join("")}</tr>`; }).join("")}</tbody>
    <tfoot><tr><td class="tnm"><b>Por dia</b></td><td></td>${GRP.map((ks,g)=>ks.some(k=>S.days[k].on)?`<td class="tt">${tot[g]}</td>`:`<td class="na"></td>`).join("")}</tr></tfoot>`;
  $("tn").querySelectorAll(".mini button").forEach(b=>b.onclick=()=>{ const g=+b.dataset.g,j=+b.dataset.j; S.tnAuto=false; S.needAuto=false; S.tn[g][j]=Math.max(0,(S.tn[g][j]||0)+ +b.dataset.n); S.ov={}; renderInputs(); run(); });
  $("tn").querySelectorAll("input[type=time]").forEach(inp=>inp.onchange=()=>{ const j=+inp.dataset.j; if(!inp.value) return; S.tt[j].ini=inp.value; S.tt[j].auto=false; S.ov={}; renderInputs(); run(); });
  $("sugHint").textContent=`Escolha a entrada de cada turno e quantas pessoas trabalham nele. A saída acompanha a jornada e o almoço. Coloque 0 no turno que não usar.${S.tnAuto!==false?` Números sugeridos para a equipe de ${N} pessoa${N>1?"s":""}.`:""}`;
  }
  document.querySelectorAll("#tipo button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===S.tipo));
  $("tipoHint").textContent=S.tipo==="comercio"?"Homens folgam ao menos 1 domingo a cada 3 semanas.":"Homens folgam ao menos 1 domingo a cada 7 semanas.";
  $("cF").textContent=S.team.filter(p=>p.s==="F").length; $("cM").textContent=S.team.filter(p=>p.s==="M").length;
  $("days").innerHTML=S.days.map((d,k)=>`<tr class="${d.on?"":"closed"}">
    <td class="dl">${DN[k]}</td>
    <td><input type="time" id="a${k}" data-k="${k}" data-f="a" value="${d.a}" aria-label="Abre ${DN[k]}"></td>
    <td><input type="time" id="f${k}" data-k="${k}" data-f="f" value="${d.f}" aria-label="Fecha ${DN[k]}"></td>
    </tr>`).join("");
  $("days").querySelectorAll("input[type=time]").forEach(i=>i.onchange=()=>{ S.days[+i.dataset.k][i.dataset.f]=i.value; S.modelo=null; renderInputs(); run(); });
  document.querySelectorAll("#modelos .modelo").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===S.modelo));
  $("almDur").value=S.alm||60; $("almIni").value=S.almIni||"12:00";
  $("contratar").checked=!!S.contratar; $("sal").value=S.sal?fmtBRL(S.sal):""; $("ben").value=S.ben?fmtBRL(S.ben):"";
  renderTitle();
}

/* ---------- Motor da escala ---------- */
function params(fase,open){
  let P;
  if(fase==="44"){ const K=Math.min(6,open);
    if(S.modelo==="6"&&K===6&&S.days[5].on) P={K,min:480,lim:44,folgas:1,dm:d=>d===5?240:480,week:44,txt:"8h + sáb 4h"};
    else P={K,min:K>=6?440:Math.min(528,Math.round(2640/Math.max(1,K))),lim:44,folgas:1}; }
  else { const lim=+fase, K=Math.min(5,open); P={K,min:Math.min(480*(lim===42?1.05:1),Math.round(lim*60/5)),lim,folgas:2}; }
  if(!P.dm){ const m=P.min; P.dm=()=>m; }
  if(P.week===undefined) P.week=P.min*P.K/60;
  return P;
}
const intOf=m=>m>360?(S.alm||60):m>240?15:0, spanOf=m=>m+intOf(m);
function needPeople(st,P){
  const N=st.team.length, W=st.team.filter(p=>p.s==="F").length, M=N-W;
  const need=st.days.map(d=>d.on?d.need:0), total=need.reduce((a,b)=>a+b,0);
  const fm=st.tipo==="comercio"?2/3:6/7, capSun=W*0.5+M*fm;
  const hSun=need[6]>capSun?Math.ceil((need[6]-capSun)/0.5-1e-9):0;
  return Math.max(P.K?Math.ceil(total/P.K-1e-9):0, Math.max(0,...need), N+hSun);
}
const GRP=[[0,1,2,3,4],[5],[6]], gOf=d=>d<5?0:d===5?1:2, GN=["Seg a Sex","Sáb","Dom"];
function turnosDia(d,P){ return [0,1,2].map(j=>({nome:"Turno "+(j+1),s:toM(S.tt[j].ini)})); }
function sugerirTurnos(P,kk){
  const k0=kk!==undefined?kk:[0,1,2,3,4,5,6].find(k=>S.days[k].on); if(k0===undefined) return {nt:1,t:[480,720,960]};
  const D=S.days[k0], a=toM(D.a), f=toM(D.f)<=a?toM(D.f)+1440:toM(D.f), sp=spanOf(P.dm(k0)), L=f-a;
  const nt=L<=sp+60?1:L<=2*sp?2:3, mid=Math.round((a+(f-sp))/2/10)*10, late=Math.max(a,f-sp);
  return {nt,t:nt===3?[a,mid,late]:nt===2?[a,late,mid]:[a,Math.max(a,Math.min(late,a+240)),late]};
}
function usaTurnos(P){ return S.days.every(d=>d.on)&&sugerirTurnos(P).nt>1; }
function aplicarTurnos(P){
  const sg=sugerirTurnos(P);
  if(!usaTurnos(P)){ if(S.needAuto) autoNeed(S); return false; }
  S.tt=S.tt&&S.tt.length===3?S.tt:[0,1,2].map(()=>({auto:true}));
  S.tt.forEach((t,j)=>{ if(t.auto!==false) t.ini=hm(sg.t[j]); });
  if(S.needAuto) autoNeed(S);
  if(!S.tn||S.tn.length!==3) S.tn=[[0,0,0],[0,0,0],[0,0,0]];
  GRP.forEach((ks,g)=>{ const k0=ks.find(k=>S.days[k].on);
    if(k0===undefined){ S.tn[g]=[0,0,0]; return; }
    if(S.tnAuto!==false||!Array.isArray(S.tn[g])||S.tn[g].length!==3){ const n=S.days[k0].need, nt=Math.min(sg.nt,sugerirTurnos(P,k0).nt), base=Math.floor(n/nt), r=n-base*nt; S.tn[g]=[0,1,2].map(j=>j<nt?base+(j<r?1:0):0); }
    const tot=S.tn[g].reduce((x,y)=>x+y,0); ks.forEach(k=>{ if(S.days[k].on) S.days[k].need=tot; });
  });
  return true;
}
function build(){
  const open=S.days.filter(d=>d.on).length, P=params(S.fase,open||1);
  const multi=aplicarTurnos(P);
  const N=S.team.length, req=needPeople(S,P), hires=S.fase!=="44"&&S.contratar?Math.max(0,req-N):0;
  const team=S.team.map(p=>({...p,novo:false}));
  for(let j=0;j<hires;j++){ const id="novo"+(j+1); team.push({n:(S.names&&S.names[id])||"Nova contratação "+(j+1),s:"N",novo:true,id}); }
  const need=S.days.map(d=>d.on?d.need:0), maxRunSun=S.tipo==="comercio"?2:6;
  const st=team.map((p,i)=>({sunStreak:0,lastSun:false,run:0,sunCount:0}));
  const weeks=[];
  for(let w=0;w<4;w++){
    const g=team.map(()=>new Array(7).fill(false));
    const rot=i=>(i+w*3)%Math.max(1,team.length);
    // domingo
    if(need[6]>0){
      const ok=i=>{ const p=team[i]; return p.s==="M"? st[i].sunStreak<maxRunSun : !st[i].lastSun; };
      const el=team.map((_,i)=>i).filter(ok).sort((a,b)=>st[a].sunCount-st[b].sunCount||rot(a)-rot(b));
      el.slice(0,need[6]).forEach(i=>g[i][6]=true);
    }
    const rem=team.map((_,i)=>P.K-(g[i][6]?1:0));
    const asg=need.map((_,d)=>g.filter(r=>r[d]).length);
    const runOK=(i,d)=>{ // não formar 7 dias seguidos, contando o fim da semana anterior
      const was=g[i][d]; g[i][d]=true; let r=st[i].run, mx=0;
      for(let k=0;k<7;k++){ r=g[i][k]?r+1:0; if(r>mx) mx=r; }
      g[i][d]=was; return mx<7; };
    const blocked=new Set();
    for(let guard=0;guard<500;guard++){
      let bd=-1,bv=0; for(let d=0;d<6;d++){ if(blocked.has(d)) continue; const v=need[d]-asg[d]; if(v>bv){bv=v;bd=d;} }
      if(bd<0) break;
      const c=team.map((_,i)=>i).filter(i=>rem[i]>0&&!g[i][bd]&&runOK(i,bd)).sort((a,b)=>rem[b]-rem[a]||rot(a)-rot(b));
      if(!c.length){ blocked.add(bd); continue; }
      g[c[0]][bd]=true; rem[c[0]]--; asg[bd]++;
    }
    // quem ainda tem dias a cumprir trabalha onde há menos gente proporcionalmente
    team.forEach((_,i)=>{ while(rem[i]>0){ let bd=-1,br=1e9;
      for(let d=0;d<6;d++){ if(!need[d]||g[i][d]||!runOK(i,d)) continue; const r=asg[d]/need[d]; if(r<br){br=r;bd=d;} }
      if(bd<0) break; g[i][bd]=true; rem[i]--; asg[bd]++; } });
    // equilibrar: mover alguém de um dia com sobra para um dia com falta
    for(let guard=0;guard<200;guard++){
      let moved=false;
      for(let d=0;d<6&&!moved;d++){ if(asg[d]>=need[d]) continue;
        for(let d2=0;d2<6&&!moved;d2++){ if(d2===d||asg[d2]<=need[d2]) continue;
          for(let i=0;i<team.length&&!moved;i++){ if(!g[i][d2]||g[i][d]) continue;
            g[i][d2]=false; if(runOK(i,d)){ g[i][d]=true; asg[d]++; asg[d2]--; moved=true; } else g[i][d2]=true; } } }
      if(!moved) break;
    }
    // ajustes manuais
    team.forEach((p,i)=>{ for(let d=0;d<7;d++){ const k=(p.id||i)+"-"+w+"-"+d; if(S.ov[k]!==undefined&&need[d]>=0&&S.days[d].on) g[i][d]=S.ov[k]; } });
    // atualizar estado
    team.forEach((p,i)=>{ let r=st[i].run; for(let d=0;d<7;d++) r=g[i][d]?r+1:0; st[i].run=r;
      st[i].lastSun=g[i][6]; st[i].sunStreak=g[i][6]?st[i].sunStreak+1:0; if(g[i][6]) st[i].sunCount++; });
    weeks.push(g);
  }
  // horários por dia
  const span=spanOf(P.min);
  // turno preferido de cada pessoa (fica no mesmo turno ao longo das semanas)
  const pref=team.map(()=>0);
  if(multi){ const base=(S.tn[0]&&S.tn[0].length?S.tn[0]:S.tn.find(t=>t&&t.length))||[1]; const tot=base.reduce((x,y)=>x+y,0)||1; let acc=0;
    const cut=base.map(v=>(acc+=v)/tot); team.forEach((_,i)=>{ const x=(i+0.5)/team.length; pref[i]=Math.max(0,cut.findIndex(c=>x<=c+1e-9)); }); }
  const almoco=(s,span,iv)=>{ if(iv<30) return null; let L=s+240, fx=toM(S.almIni||"12:00"); if(fx<s) fx+=1440; if(fx>=s+60&&fx+iv<=s+span-60) L=fx; return L; };
  const falta={};
  const shiftT=(w,d)=>{ const tl=turnosDia(d,P), cnt=(S.tn[gOf(d)]||[]).slice(0,tl.length), span=spanOf(P.dm(d)), iv=intOf(P.dm(d));
    const ids=team.map((_,i)=>i).filter(i=>weeks[w][i][d]), fill=tl.map(()=>[]), left=[];
    ids.forEach(i=>{ const k=Math.min(pref[i],tl.length-1); if(fill[k].length<(cnt[k]||0)) fill[k].push(i); else left.push(i); });
    left.forEach(i=>{ const used=tl.map((_,k)=>k).filter(k=>(cnt[k]||0)>0), cand=used.length?used:[0]; let bk=cand[0],br=1e9; cand.forEach(k=>{ const r=(fill[k].length+1)/Math.max(.5,cnt[k]||0); if(r<br){br=r;bk=k;} }); fill[bk].push(i); });
    tl.forEach((_,k)=>{ const f=(cnt[k]||0)-fill[k].length; if(f>0) falta[w+"-"+d+"-"+k]=f; });
    const D0=S.days[d], oa=toM(D0.a), of=toM(D0.f)<=oa?toM(D0.f)+1440:toM(D0.f), clamp=x=>Math.max(oa,Math.min(x,Math.max(oa,of-span)));
    const out={}; fill.forEach((arr,k)=>arr.forEach(i=>{ const s0=clamp(tl[k].s); out[i]=[s0,s0+span,almoco(s0,span,iv),iv,k,tl[k].nome]; })); return out; };
  const shift=(w,d)=>{ if(multi) return shiftT(w,d); const span=spanOf(P.dm(d)); const ids=team.map((_,i)=>i).filter(i=>weeks[w][i][d]); const D=S.days[d], a=toM(D.a), f=toM(D.f)<=a?toM(D.f)+1440:toM(D.f);
    const out={}; const n=ids.length, room=f-a-span;
    ids.forEach((i,j)=>{ const s=room<=0||n<2?a:a+Math.round(room*j/(n-1)/10)*10; let L=null; const iv=intOf(P.dm(d));
      if(iv>=30){ L=s+240; { let fx=toM(S.almIni||"12:00"); if(fx<s) fx+=1440; if(fx>=s+60&&fx+iv<=s+span-60) L=fx; } }
      out[i]=[s,s+span,L,iv]; }); return out; };
  const R0={P,team,weeks,need,req,hires,span,shift,N,multi,falta};
  if(multi) for(let w=0;w<4;w++) for(let d=0;d<7;d++) if(S.days[d].on) shiftT(w,d);
  return R0;
}

/* ---------- Verificações ---------- */
function check(R){
  const al=[], bad=new Set(), cellErr=new Set(), wkBad=new Set();
  const {team,weeks,need,P}=R, maxRunSun=S.tipo==="comercio"?2:6;
  team.forEach((p,i)=>{
    let run=0,ss=0,maxRun=0,runStart=null;
    weeks.forEach((g,w)=>{
      const wd=g[i].filter(Boolean).length, folgas=7-wd, h=g[i].reduce((a,on,d)=>a+(on?P.dm(d):0),0)/60;
      if(folgas<P.folgas){ al.push(["bad",`${p.n}: só ${folgas} folga${folgas===1?"":"s"} na semana ${w+1}`,`O mínimo nesta jornada é ${P.folgas} folga${P.folgas>1?"s":""} por semana.`]); wkBad.add(w); bad.add(i); }
      if(h>P.lim+0.01){ al.push(["bad",`${p.n}: ${hfmt(h)} na semana ${w+1}`,`Passa do limite de ${P.lim}h. Dê mais uma folga.`]); wkBad.add(w); bad.add(i); }
      for(let d=0;d<7;d++){ run=g[i][d]?run+1:0; if(run===7){ al.push(["bad",`${p.n}: 7 dias seguidos sem folga`,`Termina na semana ${w+1}, ${DN[d]}. Folga depois do 7º dia é paga em dobro.`]); wkBad.add(w); cellErr.add(i+"-"+w+"-"+d); } }
      if(g[i][6]){ ss++;
        if(p.s!=="M"&&ss>=2){ al.push(["bad",`${p.n}: dois domingos seguidos`,`Mulheres folgam em domingos alternados (semana ${w+1}).`]); wkBad.add(w); cellErr.add(i+"-"+w+"-6"); }
        if(p.s==="M"&&ss>maxRunSun){ al.push(["bad",`${p.n}: ${ss} domingos seguidos`,S.tipo==="comercio"?"No comércio, homens folgam 1 domingo a cada 3 semanas.":"Folga ao menos 1 domingo a cada 7 semanas."]); wkBad.add(w); cellErr.add(i+"-"+w+"-6"); }
      } else ss=0;
    });
  });
  const faltas=[];
  weeks.forEach((g,w)=>need.forEach((n,d)=>{ const c=g.filter(r=>r[d]).length; if(c<n){ faltas.push({w,d,f:n-c}); wkBad.add(w); } }));
  { const curto=[]; GRP.forEach((ks,g)=>{ ks.forEach(k=>{ if(!S.days[k].on||!R.need[k]) return; const D=S.days[k], a=toM(D.a), f=toM(D.f)<=a?toM(D.f)+1440:toM(D.f), sp=spanOf(P.dm(k)); if(f-a<sp-5&&!curto.some(c=>c.startsWith(GN[g]))) curto.push(`${k<5?GN[g]:DN[k]}: abre ${hfmt((f-a)/60)} e a jornada pede ${hfmt(sp/60)} com almoço`); }); });
    if(curto.length) al.push(["warn","Dia mais curto que a jornada",curto.join(" · ")+". Quem trabalha nesse dia sai depois do fechamento; ajuste o horário ou dê folga nesse dia."]); }
  if(R.multi){ const fs=Object.entries(R.falta); if(fs.length){ const by={}; fs.forEach(([k,f])=>{ const [w,d,t]=k.split("-").map(Number); const nm=turnosDia(d,P)[t].nome+" de "+DN[d]; by[nm]=Math.max(by[nm]||0,f); wkBad.add(w); });
    al.unshift(["warn","Turnos sem gente suficiente",Object.entries(by).slice(0,6).map(([n,f])=>`${n}: falta${f>1?"m":""} ${f}`).join(" · ")+"."]); } }
  if(faltas.length){
    const byDay={}; faltas.forEach(x=>{ byDay[x.d]=Math.max(byDay[x.d]||0,x.f); });
    al.unshift(["warn","Faltam pessoas em alguns dias",Object.entries(byDay).map(([d,f])=>`${DN[d]}: falta${f>1?"m":""} ${f}`).join(" · ")+". "+(S.fase!=="44"&&!S.contratar&&R.req>R.N?"Marque “Incluir as contratações” ou reduza as pessoas por dia.":"Reduza as pessoas por dia ou aumente a equipe.")]);
  }
  const alm=S.alm||60, longo=R.P.min>360;
  if(longo&&alm<60) al.push(["warn",`Almoço de ${alm} min exige convenção`,"Intervalo menor que 1h em jornada acima de 6h só vale com convenção ou acordo coletivo (mínimo de 30 min) ou autorização do MTE."]);
  if(longo&&alm>120) al.push(["warn",`Almoço de ${hfmt(alm/60)} exige acordo`,"Intervalo acima de 2h só vale com acordo escrito ou convenção coletiva. A saída fica mais tarde."]);
  if(longo){
    const wk=0, todos=R.weeks[wk]; let vazio=null;
    for(let d=0;d<7&&!vazio;d++){ if(!S.days[d].on) continue; const sh=R.shift(wk,d), ids=Object.keys(sh); if(ids.length&&ids.every(i=>sh[i][2]!=null&&sh[i][2]===sh[ids[0]][2])) vazio=DN[d]; }
    if(vazio) al.push(["ok","Todos almoçam no mesmo horário",`Na ${vazio}, ninguém fica na empresa durante o almoço. Se alguém precisa atender nesse horário, combine um revezamento no almoço.`]);
  }
  if(S.fase==="42") al.push(["warn","8h24 por dia exige convenção","Sem convenção ou acordo coletivo que autorize, use a escala de 40h (5 × 8h) já em dezembro."]);
  if(!al.some(a=>a[0]==="bad")&&!faltas.length) al.unshift(["ok","Escala dentro das regras",`2 folgas por semana, domingos no revezamento certo e nenhum período de 7 dias seguidos nas 4 semanas.`]);
  return {al,cellErr,wkBad};
}

/* ---------- Render ---------- */
let R,C;
function run(){ R=build(); C=check(R); render(); save(); }
function render(){
  document.querySelectorAll("#fases .fase").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===S.fase));
  $("contratar").disabled=S.fase==="44"; $("contratar").parentElement.style.opacity=S.fase==="44"?.45:1;
  $("undo").hidden=!Object.keys(S.ov).length;
  const {P,team,req,N,hires}=R, falta=Math.max(0,req-N);
  const hoje=params("44",Math.max(1,S.days.filter(d=>d.on).length));
  $("kpis").innerHTML=`
    <div class="kpi"><span class="k">Equipe hoje</span><span class="v">${N}</span><span class="d">${S.team.filter(p=>p.s==="F").length} mulheres · ${S.team.filter(p=>p.s==="M").length} homens</span></div>
    <div class="kpi ${S.fase==="44"?"":(falta?"bad":"ok")}"><span class="k">Pessoas necessárias</span><span class="v">${req}</span><span class="d">${S.fase==="44"?"na escala atual":falta?`faltam ${falta} para cobrir tudo`:"a equipe atual dá conta"}</span></div>
    <div class="kpi hl"><span class="k">Jornada por dia</span><span class="v">${P.txt||hfmt(P.min/60)}</span><span class="d">${P.K} dias + ${7-P.K} folga${7-P.K>1?"s":""} · almoço ${hfmt((R.P.min>360?(S.alm||60):intOf(R.P.min))/60)} · saída = entrada + ${hfmt(R.span/60)}</span></div>
    <div class="kpi"><span class="k">Horas por semana</span><span class="v">${hfmt(P.week)}</span><span class="d">antes: ${hfmt(hoje.week)} · limite ${P.lim}h</span></div>`;
  const wk=Math.min(S.wk||0,3);
  $("weeks").innerHTML=[0,1,2,3].map(w=>`<button data-w="${w}" aria-pressed="${w===wk}" class="${C.wkBad.has(w)?"has-bad":""}">Semana ${w+1}</button>`).join("");
  $("weeks").querySelectorAll("button").forEach(b=>b.onclick=()=>{ S.wk=+b.dataset.w; render(); save(); });
  const g=R.weeks[wk], sh=[...Array(7)].map((_,d)=>R.shift(wk,d));
  const head=`<tr><th class="nm">Pessoa</th>${DN.map((d,k)=>`<th class="${k===6?"dom":""}">${d}</th>`).join("")}<th>Horas</th><th title="Domingos nas 4 semanas">Dom.</th></tr>`;
  const rows=team.map((p,i)=>{
    let h=0;
    const cells=DN.map((_,d)=>{
      if(!S.days[d].on) return `<td><div class="cell x">fechado</div></td>`;
      const key=(p.id||i)+"-"+wk+"-"+d, man=S.ov[key]!==undefined?" man":"", err=C.cellErr.has(i+"-"+wk+"-"+d)?" err":"";
      if(g[i][d]){ h+=P.dm(d)/60; const s=sh[d][i]; return `<td><button class="cell t${man}${err}${s[4]?" k"+s[4]:""}" data-i="${i}" data-d="${d}" title="${s[5]||""}" aria-label="${esc(p.n)} ${DN[d]}: trabalha${s[5]?" no turno "+s[5]:""}, trocar para folga"><b>${hm(s[0])}</b><span>às ${hm(s[1])}</span>${s[2]!=null?`<i>almoço ${hm(s[2])}–${hm(s[2]+s[3])}</i>`:""}</button></td>`; }
      return `<td><button class="cell f${man}${err}" data-i="${i}" data-d="${d}" aria-label="${esc(p.n)} ${DN[d]}: folga, trocar para trabalho">Folga</button></td>`;
    }).join("");
    const doms=R.weeks.map(G=>`<i class="${G[i][6]?"w":""}"></i>`).join("");
    return `<tr class="${p.novo?"novo":""}"><td class="nm"><button class="sx ${p.s}" data-i="${i}" title="${p.s==="F"?"Mulher":p.s==="M"?"Homem":"Contratação, sexo a definir"}" ${p.novo?"disabled":""}>${p.s==="N"?"?":p.s}</button><input type="text" id="nm${p.id||i}" value="${esc(p.n)}" data-i="${i}" aria-label="Nome"></td>${cells}<td class="h ${h>P.lim+0.01?"bad":""}">${hfmt(h)}</td><td><div class="doms">${doms}</div></td></tr>`;
  }).join("");
  const cob=`<tr class="cob"><td class="nm">Trabalhando / precisa</td>${DN.map((_,d)=>{ if(!S.days[d].on) return "<td></td>"; const c=g.filter(r=>r[d]).length, n=R.need[d]; return `<td class="${c<n?"falta":"okc"}">${c} / ${n}</td>`; }).join("")}<td></td><td></td></tr>`;
  $("esc").innerHTML=`<thead>${head}</thead><tbody>${rows}${cob}</tbody>`;
  $("esc").querySelectorAll(".cell[data-i]").forEach(b=>b.onclick=()=>{
    if(suppressClick){ suppressClick=false; return; }
    const i=+b.dataset.i,d=+b.dataset.d,p=R.team[i],key=(p.id||i)+"-"+wk+"-"+d;
    S.ov[key]=!R.weeks[wk][i][d]; run(); avisoDomingo(i,d,R.weeks[wk][i][d]?"work":"off");
  });
  $("esc").querySelectorAll(".cell.f[data-i]").forEach(b=>b.addEventListener("pointerdown",startDrag));
  $("esc").querySelectorAll(".sx[data-i]").forEach(b=>b.onclick=()=>{ const p=S.team[+b.dataset.i]; if(!p) return; p.s=p.s==="F"?"M":"F"; S.ov={}; renderInputs(); run(); });
  $("esc").querySelectorAll("td.nm input").forEach(inp=>inp.onchange=()=>{
    const i=+inp.dataset.i, p=R.team[i], v=inp.value.trim()||p.n;
    if(p.novo){ S.names=S.names||{}; S.names[p.id]=v; } else S.team[i].n=v; run();
  });
  $("alerts").innerHTML=C.al.slice(0,8).map(a=>`<div class="al ${a[0]}"><b>${esc(a[1])}</b><span class="small">${esc(a[2])}</span></div>`).join("")+(C.al.length>8?`<p class="hint">+ ${C.al.length-8} avisos parecidos nas outras semanas.</p>`:"");
  renderCost();
  renderMob();
}
function renderCost(){
  if(!R) return;
  const brl2=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const pct=v=>"+"+v.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
  const sal=+S.sal||0, ben=+S.ben||0, N=R.N;
  if(!sal){ $("cres").innerHTML=`<p class="small muted">Informe o salário médio, por exemplo 2.150,00, para ver o custo.</p>`; $("cobs").innerHTML=""; return; }
  const per=sal*(1+ENC/100)+ben, folha=N*per, DIV={"44":220,"42":210,"40":200};
  const alvo=S.fase==="44"?"40":S.fase, div=DIV[alvo];
  const hr0=per/220, hr1=per/div, up=(220/div-1)*100, perda=N*(220-div), repor=perda*hr1;
  const P=params(alvo,Math.max(1,S.days.filter(d=>d.on).length));
  const req=S.fase===alvo?R.req:needPeople(S,P), faltam=Math.max(0,req-N), contr=faltam*per;
  const hFalta=faltam*P.week*(30/7), he=hFalta*(sal/div)*1.5*(1+ENC/100);
  $("cres").innerHTML=`
    <div class="cres">
      <div><span class="k">Custo da equipe hoje</span><span class="v">${brl(folha)}<small>/mês</small></span><span class="small muted">${N} pessoas × ${brl(per)}</span></div>
      <div><span class="k">Custo real da hora</span><span class="v">${brl2(hr0)} → <b class="up">${brl2(hr1)}</b></span><span class="small muted">${pct(up)} na escala de ${alvo}h</span></div>
      <div><span class="k">Sem contratar</span><span class="v up">+${brl(repor)}<small>/mês</small></span><span class="small muted">para repor ${perda.toLocaleString("pt-BR")}h a menos</span></div>
      <div><span class="k">${faltam?`Contratando ${faltam}`:"Contratações"}</span><span class="v ${faltam?"up":"dn"}">${faltam?"+"+brl(contr):"Nenhuma"}${faltam?"<small>/mês</small>":""}</span><span class="small muted">${faltam?`hora extra custaria ${brl(he)}`:"a equipe cobre a escala"}</span></div>
    </div>
    <div class="hstrip">${["44","42","40"].map(f=>`<span class="${f===alvo?"on":""}"><b>${f}h</b> ${brl2(per/DIV[f])}${f!=="44"?` <em>${pct((220/DIV[f]-1)*100)}</em>`:""}</span>`).join("")}<span class="lb">custo real por hora trabalhada</span></div>`;
  $("cobs").innerHTML=`<div class="al warn"><b>Mesmo sem contratar, o custo aumenta</b><span class="small">O salário não muda, mas a equipe trabalha ${perda.toLocaleString("pt-BR")} horas a menos por mês e cada hora fica ${pct(up).slice(1)} mais cara. Manter o mesmo atendimento de hoje custa cerca de ${brl(repor)} a mais por mês (${brl(repor*12)} por ano)${faltam?`; cobrindo toda a escala com ${faltam} contrataç${faltam>1?"ões":"ão"}, o aumento é de ${brl(contr)} por mês`:""}.${S.fase==="44"?" Valores da escala de 40h; escolha 42h no topo para ver a transição.":""}</span></div>`;
}
/* ---------- Arrastar folga ---------- */
let drag=null, suppressClick=false, toastT;
function toast(kind,title,text){ const t=$("toast"); t.className="toast "+kind; t.innerHTML=`<b>${esc(title)}</b><span class="small">${esc(text)}</span>`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,kind==="bad"?9000:6000); }
function startDrag(e){
  if(e.button>0) return;
  const el=e.currentTarget; drag={i:+el.dataset.i,d:+el.dataset.d,x:e.clientX,y:e.clientY,el,moved:false,target:null,ghost:null};
  el.setPointerCapture(e.pointerId);
  el.addEventListener("pointermove",moveDrag); el.addEventListener("pointerup",endDrag); el.addEventListener("pointercancel",endDrag);
}
function moveDrag(e){
  if(!drag) return;
  if(!drag.moved){ if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6) return;
    drag.moved=true; drag.el.classList.add("src"); drag.el.closest("tr").classList.add("dragrow");
    const g=document.createElement("div"); g.className="ghost"; g.textContent="Folga · "+R.team[drag.i].n; document.body.appendChild(g); drag.ghost=g; }
  drag.ghost.style.left=e.clientX+"px"; drag.ghost.style.top=e.clientY+"px";
  const over=document.elementFromPoint(e.clientX,e.clientY), c=over&&over.closest(".cell.t[data-i]");
  const ok=c&&+c.dataset.i===drag.i?c:null;
  if(drag.target&&drag.target!==ok) drag.target.classList.remove("drop");
  drag.target=ok; if(ok) ok.classList.add("drop");
}
function endDrag(e){
  if(!drag) return; const D=drag; drag=null;
  D.el.removeEventListener("pointermove",moveDrag); D.el.removeEventListener("pointerup",endDrag); D.el.removeEventListener("pointercancel",endDrag);
  if(D.ghost) D.ghost.remove();
  if(!D.moved) return;
  suppressClick=true; setTimeout(()=>suppressClick=false,300);
  D.el.classList.remove("src"); const tr=D.el.closest("tr"); if(tr) tr.classList.remove("dragrow");
  if(!D.target||e.type==="pointercancel"){ if(D.target) D.target.classList.remove("drop"); return; }
  const to=+D.target.dataset.d, wk=Math.min(S.wk||0,3), p=R.team[D.i], k=d=>(p.id||D.i)+"-"+wk+"-"+d;
  S.ov[k(D.d)]=true; S.ov[k(to)]=false; run();
  avisoDomingo(D.i,to,"off",D.d);
}
// Avisa a regra do domingo depois de mover ou trocar uma folga
function avisoDomingo(i,dia,agora,de){
  const p=R.team[i], wk=Math.min(S.wk||0,3), sx=p.s;
  const viol=C.al.filter(a=>a[0]==="bad"&&a[1].startsWith(p.n+":"));
  const dom=viol.find(a=>/domingo/i.test(a[1]));
  if(dom){ toast("bad","Regra do domingo: "+dom[1].replace(p.n+": ",""),dom[2]+" Devolva a folga para o domingo ou troque com outra pessoa."); return; }
  if(viol.length){ toast("bad",viol[0][1],viol[0][2]); return; }
  const trabalhaDom=R.weeks[wk][i][6];
  if(S.days[6].on&&trabalhaDom&&(de===6||(dia===6&&agora==="work"))){
    const regra=sx==="M"?(S.tipo==="comercio"?"Homens no comércio precisam folgar ao menos 1 domingo a cada 3 semanas.":"Homens precisam folgar ao menos 1 domingo a cada 7 semanas.")
      :"Mulheres folgam em domingos alternados: no domingo seguinte esta pessoa precisa folgar.";
    toast("warn",`${p.n} vai trabalhar no domingo da semana ${wk+1}`,regra+" O simulador confere as 4 semanas e avisa se a regra quebrar."); return; }
  const fd=de!==undefined?` de ${DN[de]} para ${DN[dia]}`:"";
  toast("ok","Folga ajustada"+fd,`${p.n} continua dentro das regras nesta escala.`);
}
$("copy").onclick=async()=>{
  const wk=Math.min(S.wk||0,3), g=R.weeks[wk], sh=[...Array(7)].map((_,d)=>R.shift(wk,d));
  const out=[`*Escala ${S.fase==="44"?"44h (hoje)":S.fase+"h · 5x2"} · Semana ${wk+1}*`];
  DN.forEach((n,d)=>{ if(!S.days[d].on) return; out.push("",`*${n}*`);
    R.team.forEach((p,i)=>{ if(g[i][d]){ const s=sh[d][i]; out.push(`${p.n}: ${hm(s[0])} às ${hm(s[1])}`+(s[2]!=null?` (almoço ${hm(s[2])})`:"")); } });
    const fo=R.team.filter((p,i)=>!g[i][d]).map(p=>p.n); if(fo.length) out.push("Folga: "+fo.join(", ")); });
  const b=$("copy"); try{ await navigator.clipboard.writeText(out.join("\n")); b.textContent="Copiado! Cole no WhatsApp"; }catch(e){ b.textContent="Não foi possível copiar"; }
  setTimeout(()=>b.textContent="Copiar semana",2200);
};

/* ---------- Modo app (celular) ---------- */
const mq=window.matchMedia?window.matchMedia("(max-width: 760px)"):{matches:false};
let mSel=null;
function setTab(t){ document.body.dataset.mtab=t; S.mtab=t; save();
  document.querySelectorAll("#mnav button").forEach(b=>b.setAttribute("aria-current",b.dataset.t===t?"page":"false"));
  try{ window.scrollTo(0,0); }catch(e){} }
document.querySelectorAll("#mnav button").forEach(b=>b.onclick=()=>setTab(b.dataset.t));
$("verEscala").onclick=()=>setTab("escala");
document.querySelectorAll("#mfase button").forEach(b=>b.onclick=()=>{ S.fase=b.dataset.v; S.ov={}; mSel=null; renderInputs(); run(); });
// passos viram lista recolhível no celular
document.querySelectorAll("aside.side .card").forEach((c,ix)=>{ const st=c.querySelector(".step"); if(!st) return;
  const sm=document.createElement("span"); sm.className="ssum"; sm.id="sum"+(ix+1); st.appendChild(sm);
  st.setAttribute("role","button"); st.tabIndex=0;
  const tog=()=>{ if(!mq.matches) return; const op=!c.classList.contains("open"); document.querySelectorAll("aside.side .card.open").forEach(x=>x.classList.remove("open")); if(op) c.classList.add("open"); };
  st.onclick=e=>{ if(e.target.closest("button,input,select,a")) return; tog(); };
  st.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); tog(); } };
});
function resumoPassos(){
  const open=S.days.map((d,k)=>d.on?DN[k]:null).filter(Boolean), F=S.team.filter(p=>p.s==="F").length, M=S.team.length-F;
  const sg=SEGS[S.seg], w=S.days.find(d=>d.on);
  const set=(n,t)=>{ const e=$("sum"+n); if(e) e.textContent=t; };
  set(1,(sg?sg.n:"Personalizado")+" · "+(S.tipo==="comercio"?"comércio":"outras"));
  set(2,open.length===7?"Todos os dias":open.length?open.join(", "):"Nenhum dia");
  set(3,w?`${w.a} às ${w.f}`:"—");
  set(4,`${hfmt((S.alm||60)/60)} às ${S.almIni||"12:00"}`);
  set(5,`${F} mulher${F===1?"":"es"} · ${M} home${M===1?"m":"ns"}`);
  set(6,R&&R.multi?S.tn[0].map((v,j)=>v?`T${j+1}: ${v}`:"").filter(Boolean).join(" · "):(w?`${w.need} pessoas/dia`:"—"));
  set(7,S.ov&&Object.keys(S.ov).length?"com ajustes":"opcional");
}
function renderMob(){
  resumoPassos();
  document.querySelectorAll("#mfase button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===S.fase));
  const nb=C.al.filter(a=>a[0]==="bad").length+C.al.filter(a=>a[0]==="warn"&&/Faltam|Turnos sem/.test(a[1])).length, bd=$("mbadge"); bd.textContent=nb; bd.hidden=!nb;
  const wk=Math.min(S.wk||0,3), g=R.weeks[wk], sh=[...Array(7)].map((_,d)=>R.shift(wk,d));
  const cov=DN.map((n,d)=>{ if(!S.days[d].on) return `<div class="mc x"><b>${n}</b><span>—</span></div>`; const c=g.filter(r=>r[d]).length, nd=R.need[d]; return `<div class="mc ${c<nd?"bad":""}"><b>${n}</b><span>${c}/${nd}</span></div>`; }).join("");
  const cards=R.team.map((p,i)=>{ let h=0;
    const cells=DN.map((n,d)=>{ if(!S.days[d].on) return `<button class="mx x" disabled><i>${n[0]}</i>–</button>`;
      const err=C.cellErr.has(i+"-"+wk+"-"+d)?" err":"", man=S.ov[(p.id||i)+"-"+wk+"-"+d]!==undefined?" man":"";
      const selc=mSel&&mSel.i===i&&mSel.d===d?" sel":"", tgt=mSel&&mSel.i===i&&g[i][d]?" tgt":"";
      if(g[i][d]){ h+=R.P.dm(d)/60; const s=sh[d][i]; return `<button class="mx t${s[4]?" k"+s[4]:""}${err}${man}${tgt}" data-i="${i}" data-d="${d}"><i>${n}</i><b>${hm(s[0])}</b><small>${hm(s[1])}</small></button>`; }
      return `<button class="mx f${err}${man}${selc}" data-i="${i}" data-d="${d}"><i>${n}</i><b>Folga</b></button>`; }).join("");
    const doms=R.weeks.map(G=>G[i][6]?"●":"○").join("");
    return `<div class="mp ${p.novo?"novo":""}"><div class="mph"><span class="sx ${p.s}">${p.s==="N"?"?":p.s}</span><b>${esc(p.n)}</b><span class="mh ${h>R.P.lim+0.01?"bad":""}">${hfmt(h)}</span><span class="md" title="Domingos trabalhados nas 4 semanas">Dom ${doms}</span></div><div class="mrow">${cells}</div></div>`; }).join("");
  $("mesc").innerHTML=`<div class="mcov">${cov}</div><p class="mhint">${mSel?`Agora toque no dia para onde vai a folga de <b>${esc(R.team[mSel.i].n)}</b>. Toque na folga de novo para cancelar.`:"Toque numa <b>folga</b> e depois no dia para onde ela deve ir."}</p>${cards}`;
  $("mesc").querySelectorAll(".mx[data-i]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i,d=+b.dataset.d,p=R.team[i],wk2=Math.min(S.wk||0,3), work=R.weeks[wk2][i][d];
    if(mSel&&mSel.i===i&&mSel.d===d){ mSel=null; renderMob(); return; }
    if(mSel&&mSel.i===i&&work){ const k=x=>(p.id||i)+"-"+wk2+"-"+x, from=mSel.d; S.ov[k(from)]=true; S.ov[k(d)]=false; mSel=null; run(); avisoDomingo(i,d,"off",from); return; }
    if(!work){ mSel={i,d}; renderMob(); return; }
    const s=R.shift(wk2,d)[i]; toast("ok",`${p.n} · ${DN[d]}`,`${s[5]?s[5]+": ":""}${hm(s[0])} às ${hm(s[1])}${s[2]!=null?`, almoço ${hm(s[2])}–${hm(s[2]+s[3])}`:""}. Para dar folga neste dia, toque numa folga de ${p.n} e depois aqui.`);
  });
}
mq.addEventListener?.("change",()=>render());

renderInputs(); run(); setTab(S.mtab||"ajustes");
})();
