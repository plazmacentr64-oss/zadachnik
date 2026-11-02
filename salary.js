'use strict';
// v45: табель и зарплата (только владелец). Неделя пн–вс. Ставки фиксируются в каждой записи.
let workers=[],tdays=[],pieces=[],payouts=[],adjs=[],weekCloses=[],salaryError='';
let moneySeg=(()=>{try{return localStorage.getItem('moneySeg')||'money'}catch(e){return 'money'}})(),salTab='grid',salWeek=null;
// Тап по полю количества/суммы выделяет содержимое — ввод не дописывается к «1»
const NUMSEL='input[inputmode=decimal],input[inputmode=numeric],.specQty';
document.addEventListener('focusin',e=>{const el=e.target;if(el.matches&&el.matches(NUMSEL))el._fresh=true});
document.addEventListener('click',e=>{const el=e.target;if(el._fresh&&el.matches&&el.matches(NUMSEL)){el._fresh=false;if(el.value)try{el.select()}catch(_){}}});
document.addEventListener('keydown',e=>{if(e.target&&e.target._fresh)e.target._fresh=false},true);
const DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const mondayOf=iso=>{const d=parseDate(iso),w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return localISO(d)};
const addDays=(iso,n)=>{const d=parseDate(iso);d.setDate(d.getDate()+n);return localISO(d)};
const weekDates=ws=>Array.from({length:7},(_,i)=>addDays(ws,i));
const isWeekend=iso=>[0,6].includes(parseDate(iso).getDay());
const weekClosed=ws=>weekCloses.some(w=>w.week_start===ws);
const dayAmount=t=>(+t.mark||0)*(+t.rate||0)+(+t.ot_hours||0)*(+t.ot_rate||0);
const shortDate=iso=>parseDate(iso).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}).replace('.','');
const wName=id=>workers.find(w=>w.id===id)?.name||'—';
function weekLabel(ws){return shortDate(ws)+' – '+shortDate(addDays(ws,6))}

async function loadSalary(){
 const ws=currentWorkspace,f=t=>fetchAll(()=>sb.from(t).select('*').eq('workspace_id',ws).order('id'));
 try{const r=await Promise.all(['workers','time_days','piece_entries','payouts','pay_adjustments'].map(f));const wc=await sb.from('week_closes').select('*').eq('workspace_id',ws);
  const bad=r.find(x=>x.error)||(wc.error?{error:wc.error}:null);if(bad)throw bad.error;
  [workers,tdays,pieces,payouts,adjs]=r.map(x=>x.data||[]);weekCloses=wc.data||[];
  workers.sort((a,b)=>(a.sort||0)-(b.sort||0)||a.name.localeCompare(b.name,'ru'));salaryError=''}
 catch(e){salaryError=e.message||String(e);console.warn('salary',e)}
}
async function reloadSalary(){await loadSalary();renderCurrent()}
function salErr(e){serverError(e);const m=e?.message||String(e);alert(/закрыта/.test(m)?m:'Не удалось сохранить: '+m);loadSalary().then(()=>renderCurrent())}

// ---------- расчёт ----------
function accrual(wid,from,to){ // включительно
 const inR=d=>d>=from&&d<=to;
 const ds=tdays.filter(t=>t.worker_id===wid&&inR(t.work_date)),ps=pieces.filter(p=>p.worker_id===wid&&inR(p.work_date));
 return {days:ds.reduce((s,t)=>s+(+t.mark||0),0),dayRub:ds.reduce((s,t)=>s+(+t.mark||0)*(+t.rate||0),0),ot:ds.reduce((s,t)=>s+(+t.ot_hours||0),0),otRub:ds.reduce((s,t)=>s+(+t.ot_hours||0)*(+t.ot_rate||0),0),
  piece:ps.reduce((s,p)=>s+(+p.amount||0),0),pieceN:ps.length,
  adj:adjs.filter(a=>a.worker_id===wid&&inR(a.adj_date)).reduce((s,a)=>s+(+a.amount||0),0),
  paid:payouts.filter(p=>p.worker_id===wid&&inR(p.paid_on)).reduce((s,p)=>s+(+p.amount||0),0)};
}
const accTotal=a=>a.dayRub+a.otRub+a.piece;
function balanceBefore(wid,ws){const a=accrual(wid,'0000-01-01',addDays(ws,-1));return accTotal(a)+a.adj-a.paid}
function weekRows(ws){
 const end=addDays(ws,6);
 return workers.map(w=>{const prev=balanceBefore(w.id,ws),a=accrual(w.id,ws,end),bal=prev+accTotal(a)+a.adj-a.paid;return {w,prev,a,bal,busy:Math.abs(prev)>0.004||accTotal(a)||a.paid||a.adj}}).filter(r=>r.w.active||r.busy);
}

// ---------- экран ----------
function renderMoneySeg(){const el=$('moneySeg');if(el)el.innerHTML=`<button class="${moneySeg==='money'?'on':''}" onclick="moneySeg='money';try{localStorage.setItem('moneySeg','money')}catch(e){};renderCurrent()">Объекты</button><button class="${moneySeg==='salary'?'on':''}" onclick="moneySeg='salary';try{localStorage.setItem('moneySeg','salary')}catch(e){};renderCurrent()">Зарплата</button>`}
function renderSalary(){
 if(!salWeek)salWeek=mondayOf(localISO());
 const ws=salWeek,closed=weekClosed(ws);
 let h=`<div class=weekNav><button class=chip onclick="salWeek=addDays(salWeek,-7);renderSalary()" aria-label="Прошлая неделя">‹</button><b>${weekLabel(ws)}${closed?' · закрыта 🔒':''}</b><button class=chip onclick="salWeek=addDays(salWeek,7);renderSalary()" aria-label="Следующая неделя">›</button></div>
 <div class=segBar><button class="${salTab==='grid'?'on':''}" onclick="salTab='grid';renderSalary()">Табель</button><button class="${salTab==='pay'?'on':''}" onclick="salTab='pay';renderSalary()">Выдачи</button><button class="${salTab==='sum'?'on':''}" onclick="salTab='sum';renderSalary()">Итог</button><button class="${salTab==='rates'?'on':''}" onclick="salTab='rates';renderSalary()">Расценки</button></div>`;
 if(salaryError)h+=`<div class=empty>Зарплата не загрузилась: ${esc(salaryError)}</div>`;
 else if(!workers.length)h+=`<div class=empty>Добавьте сотрудников: имя, посуточно или сдельно, ставка за день и за час переработки.<br><button class=btn style="margin-top:10px" onclick="openWorker()">+ Сотрудник</button></div>`;
 else h+=salTab==='rates'?(typeof ratesHtml==='function'?ratesHtml():''):salTab==='grid'?gridHtml(ws,closed):salTab==='pay'?payHtml(ws,closed):sumHtml(ws,closed);
 h+=`<button class=linkBtn onclick="openWorkers()">Сотрудники и ставки →</button>`;
 $('analyticsBody').innerHTML=h;
 bindLongPress();
}
function cellHtml(w,d,closed){
 const ds=tdays.filter(t=>t.worker_id===w.id&&t.work_date===d),ps=pieces.filter(p=>p.worker_id===w.id&&p.work_date===d);
 const mark=ds.reduce((s,t)=>s+(+t.mark||0),0),ot=ds.some(t=>+t.ot_hours>0),pr=ps.reduce((s,p)=>s+(+p.amount||0),0);
 let cls='x',txt='–';
 const pq=ps.filter(p=>p.kind!=='other').reduce((s,p)=>s+(+p.qty||0),0),ks=v=>v>=100000?Math.round(v/1000)+'к':v>=10000?num(v/1000,1)+'к':String(Math.round(v));
 if(w.pay_type==='piece'&&ps.length&&!mark){cls='m pc';txt=pq?`${num(pq,1)} шт<small>${ks(pr)}</small>`:ks(pr)}
 else if(w.pay_type==='piece'&&pr){cls='m pc';txt=pq?`${num(pq,1)} шт<small>${ks(pr)}</small>`:ks(pr)}
 else if(w.pay_type==='piece'&&!mark&&!ps.length){cls='x pc0';txt='+'}
 else if(mark){cls=mark>=1?'f':'h';txt=ds.length>1?'½+½':mark>=1?(mark>1?num(mark,1):'1'):'½';if(ds.length>1)cls+=' two';if(pr)cls+=' plus'}
 else if(pr){cls='m';txt=String(Math.round(pr))}
 else if(ps.length){cls='m';txt='0₽'}
 return `<td><button class="tc ${cls}${d===localISO()?' today':''}" data-w="${w.id}" data-d="${d}" onclick="cellTap('${w.id}','${d}')" aria-label="${esc(w.name)}, ${shortDate(d)}: ${String(txt).replace(/<[^>]+>/g,' ')}">${txt}${ot?'<i class=otDot></i>':''}</button></td>`;
}
function gridHtml(ws,closed){
 const dates=weekDates(ws),rows=workers.filter(w=>w.active||tdays.some(t=>t.worker_id===w.id&&t.work_date>=ws&&t.work_date<=dates[6])||pieces.some(p=>p.worker_id===w.id&&p.work_date>=ws&&p.work_date<=dates[6]));
 const all=weekRows(ws),acc=all.reduce((s,r)=>s+accTotal(r.a)+r.a.adj,0),prev=all.reduce((s,r)=>s+r.prev,0),paid=all.reduce((s,r)=>s+r.a.paid,0),toPay=all.reduce((s,r)=>s+Math.max(0,r.bal),0),over=all.reduce((s,r)=>s+Math.min(0,r.bal),0);
 return `<div class=tgWrap><table class=tg><thead><tr><th></th>${dates.map((d,i)=>`<th><button class="dayH${isWeekend(d)?' we':''}" onclick="markAllDay('${d}')" aria-label="Все посуточные были ${shortDate(d)}">${DOW[i]}<small>${parseDate(d).getDate()}</small></button></th>`).join('')}<th class=tgTot>₽</th></tr></thead><tbody>
 ${rows.map(w=>{const a=accrual(w.id,ws,dates[6]);return `<tr><td class=tgName><button onclick="openWorker('${w.id}')">${esc(w.name)}<small>${w.pay_type==='piece'?'сдельно':num(w.day_rate,0)+'/д'}</small></button></td>${dates.map(d=>cellHtml(w,d,closed)).join('')}<td class=tgTot><b>${num(Math.round(accTotal(a)),0)}</b><small>${w.pay_type==='piece'?a.pieceN+' раб.':num(a.days,1)+' дн'+(a.ot?' +'+num(a.ot,1)+'ч':'')}</small></td></tr>`}).join('')}
 </tbody></table></div>
 <div class=small style="margin:6px 2px">Посуточным: тап по клетке 1 → ½ → –, долгий тап — объект и переработка, тап по дню — «все были». Сдельщикам (фиолетовые клетки): тап — объект → изделие → сколько штук. Отметки мастера в Цехе попадают сюда сами.</div>
 <div class=info>${Math.abs(prev)>0.004?`<div class=kvRow><span>С прошлых недель</span><b>${prev>0?'+':''}${rub(prev)}</b></div>`:''}<div class=kvRow><span>Начислено (с премиями и штрафами)</span><b>+${rub(acc)}</b></div><div class=kvRow><span>Выдано</span><b>−${rub(paid)}</b></div><div class=kvRow><span><b>К выдаче</b></span><b class=pos>${rub(toPay)}</b></div>${over<-0.004?`<div class=kvRow><span>Переплата (перейдёт дальше)</span><b class=neg>−${rub(-over)}</b></div>`:''}${closed?'<div class=small>Неделя закрыта — правки только корректировкой в следующей неделе</div>':''}</div>`;
}
// долгий тап
let lpTimer=null,lpFired=false;
function bindLongPress(){document.querySelectorAll('.tc').forEach(b=>{b.onpointerdown=()=>{lpFired=false;clearTimeout(lpTimer);lpTimer=setTimeout(()=>{lpFired=true;openDay(b.dataset.w,b.dataset.d)},550)};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>clearTimeout(lpTimer);b.oncontextmenu=e=>{e.preventDefault()}})}
function lastProject(wid){const t=[...tdays,...pieces].filter(x=>x.worker_id===wid&&x.project_id).sort((a,b)=>String(b.work_date+b.created_at).localeCompare(String(a.work_date+a.created_at)))[0];return t&&data.some(o=>o.id===t.project_id&&o.status!=='Выполнено')?t.project_id:''}
function hasHistory(wid){return tdays.some(t=>t.worker_id===wid)||pieces.some(p=>p.worker_id===wid)}
const rateFor=(w,d)=>isWeekend(d)&&w.weekend_rate!=null&&+w.weekend_rate>0?+w.weekend_rate:+w.day_rate||0;
const cellBusy={};
async function cellTap(wid,d){
 if(lpFired){lpFired=false;return}
 const w=workers.find(x=>x.id===wid);if(!w)return;
 if(w.pay_type==='piece')return openPiece(wid,d);
 if(weekClosed(mondayOf(d)))return openDay(wid,d);
 const key=wid+d;if(cellBusy[key])return;
 const ds=tdays.filter(t=>t.worker_id===wid&&t.work_date===d);
 if(ds.length>1||ds.some(t=>+t.ot_hours>0))return openDay(wid,d);
 if(!ds.length&&!hasHistory(wid))return openDay(wid,d);
 cellBusy[key]=1;
 try{
  if(!ds.length){const lp=lastProject(wid)||null;await q(sb.from('time_days').insert({workspace_id:currentWorkspace,worker_id:wid,work_date:d,mark:1,project_id:lp,rate:rateFor(w,d),ot_rate:+w.ot_rate||0}));toast(`${w.name}: день · ${lp?projName(lp):'цех'} (долгий тап — сменить)`)}
  else if(+ds[0].mark===1)await q(sb.from('time_days').update({mark:0.5,updated_at:new Date().toISOString()}).eq('id',ds[0].id));
  else await q(sb.from('time_days').delete().eq('id',ds[0].id));
  await loadSalary();renderCurrent();
 }catch(e){salErr(e)}finally{delete cellBusy[key]}
}
async function markAllDay(d){
 if(weekClosed(mondayOf(d)))return toast('Неделя закрыта');
 const ws=workers.filter(w=>w.active&&w.pay_type==='day'&&!tdays.some(t=>t.worker_id===w.id&&t.work_date===d));
 if(!ws.length)return toast('Все посуточные на '+shortDate(d)+' уже отмечены');
 const rows=ws.map(w=>({id:uuid(),workspace_id:currentWorkspace,worker_id:w.id,work_date:d,mark:1,project_id:lastProject(w.id)||null,rate:rateFor(w,d),ot_rate:+w.ot_rate||0}));
 try{await q(sb.from('time_days').insert(rows));await loadSalary();renderCurrent();
  toast(`${shortDate(d)}: ${rows.map(r=>wName(r.worker_id)+' — '+(r.project_id?projName(r.project_id):'цех')).join('; ')}`,async()=>{try{for(const r of rows)await q(sb.from('time_days').delete().eq('id',r.id));await loadSalary();renderCurrent()}catch(e){salErr(e)}})}
 catch(e){salErr(e)}
}
function projOptions(sel,withShop=true){return (withShop?`<option value="" ${!sel?'selected':''}>Цех (без объекта)</option>`:'')+activeProjects().map(o=>`<option value="${o.id}" ${o.id===sel?'selected':''}>${esc(o.name)}</option>`).join('')}

// ---------- день посуточно ----------
function openDay(wid,d){
 const w=workers.find(x=>x.id===wid);if(!w)return;const closed=weekClosed(mondayOf(d));
 const ds=tdays.filter(t=>t.worker_id===wid&&t.work_date===d),first=ds[0],second=ds[1];
 let mark=first?(ds.length>1?1:+first.mark):(closed?0:1),ot=ds.reduce((s,t)=>s+(+t.ot_hours||0),0);
 const rate=rateFor(w,d);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(w.name)} · ${DOW[(parseDate(d).getDay()+6)%7].toLowerCase()} ${shortDate(d)}</h2>${rate?'':`<div class=info style="border-color:#ffd59a;background:#fff8ec">Ставка за день у ${esc(w.name)} — 0 ₽. <button class=linkBtn style="padding:0" onclick="openWorker('${w.id}')">Указать ставку</button></div>`}<div class=summary>Посуточно · ${rub(rate)} за день${isWeekend(d)&&rate!==+w.day_rate?' (выходной)':''} · переработка ${rub(w.ot_rate)}/ч</div>
 ${closed?'<div class=info>Неделя закрыта — правки запрещены</div>':''}
 <div class=big3 id=dMark>${[[1,'Весь день'],[0.5,'Полдня'],[0,'Не был']].map(([v,l])=>`<button type=button data-v="${v}" class="${mark===v?'sel':''}">${l}<small>${rub(v*rate)}</small></button>`).join('')}</div>
 <label class=field>Объект<select id=dProj>${projOptions(first?.project_id??lastProject(wid))}</select></label>
 <label class=check2><input type=checkbox id=dTwo ${second?'checked':''}> Второй объект в этот день (½ + ½)</label>
 <label class=field id=dProj2Box ${second?'':'hidden'}>Второй объект<select id=dProj2>${projOptions(second?.project_id||'')}</select></label>
 <div class=label style="margin-top:10px">Переработка</div><div class=stepper><button type=button id=otMinus aria-label="Меньше часов">−</button><b id=otVal>${num(ot,1)} ч</b><button type=button id=otPlus aria-label="Больше часов">+</button><span id=otSum class=small>${ot?'+'+rub(ot*w.ot_rate):''}</span></div>
 <label class=field>Комментарий<input id=dNote value="${esc(first?.note||'')}" placeholder="например: задержались на отгрузке"></label>
 <button class=linkBtn onclick="openPiece('${wid}','${d}')">Сдельная работа в этот день →</button>
 ${closed?'':`<div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=dSave>Сохранить</button></div>`}`;
 openModal();
 const upd=()=>{$('otVal').textContent=num(ot,1)+' ч';$('otSum').textContent=ot?'+'+rub(ot*w.ot_rate):''};
 $('dMark').onclick=e=>{const b=e.target.closest('button');if(!b)return;mark=+b.dataset.v;[...$('dMark').children].forEach(x=>x.classList.toggle('sel',x===b))};
 $('otMinus').onclick=()=>{ot=Math.max(0,ot-1);upd()};$('otPlus').onclick=()=>{ot=Math.min(16,ot+1);upd()};
 $('dTwo').onchange=()=>{$('dProj2Box').hidden=!$('dTwo').checked};
 if($('dSave'))$('dSave').onclick=async()=>{const b=$('dSave');if(b.disabled)return;
  const two=$('dTwo').checked&&mark>0,p1=$('dProj').value||null,p2=$('dProj2').value||null;
  if(two&&mark!==1)return alert('Два объекта — только при «Весь день»: он делится на ½ + ½. Полдня записывайте на один объект.');if(two&&p1===p2)return alert('Выберите два разных объекта');
  b.disabled=true;b.textContent='Сохраняю…';
  try{for(const t of ds)await q(sb.from('time_days').delete().eq('id',t.id));
   if(mark>0){const base={workspace_id:currentWorkspace,worker_id:wid,work_date:d,rate,ot_rate:+w.ot_rate||0,note:$('dNote').value.trim()};
    const rows=two?[{...base,mark:0.5,project_id:p1,ot_hours:ot},{...base,mark:0.5,project_id:p2,ot_hours:0}]:[{...base,mark,project_id:p1,ot_hours:ot}];
    await q(sb.from('time_days').insert(rows))}
   await loadSalary();closeModal();renderCurrent();toast(esc(w.name)+': '+(mark?(mark===1?'весь день':'полдня')+(ot?' + '+num(ot,1)+' ч':''):'не был'))}
  catch(e){b.disabled=false;b.textContent='Сохранить';salErr(e)}};
}

// ---------- сдельщина ----------
function openPiece(wid,d,keep){
 const w=workers.find(x=>x.id===wid);if(!w)return;const closed=weekClosed(mondayOf(d));
 const list=pieces.filter(p=>p.worker_id===wid&&p.work_date===d),sum=list.reduce((s,p)=>s+(+p.amount||0),0);
 const KIND={work:'Работа',redo_paid:'Переделка · платим',redo_free:'Переделка · 0 ₽',other:'Другая работа'};
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(w.name)} · ${DOW[(parseDate(d).getDay()+6)%7].toLowerCase()} ${shortDate(d)}</h2><div class=summary>Сдельно за день: <b>${rub(sum)}</b></div>
 ${list.length?`<div class=info>${list.map(p=>`<div class=doc><span><b>${esc(p.title)}</b><br><span class=small>${esc(projName(p.project_id))} · ${p.kind==='other'?'':num(p.qty)+' шт × '+rub(p.rate)+' · '}${KIND[p.kind]}${p.group_id?' · на двоих':''}</span></span><span><b>${rub(p.amount)}</b>${closed?'':` <button class=edDel aria-label="Удалить запись" onclick="delPiece('${p.id}','${wid}','${d}')">×</button>`}</span></div>`).join('')}</div>`:''}
 ${closed?'<div class=info>Неделя закрыта — правки запрещены</div>':`<div class=label style="margin-top:6px">Добавить</div>
 <label class=field>Объект<select id=pcProj>${projOptions(keep?.pid||(()=>{const lp=lastProject(wid);if(lp&&projOps.some(o=>o.project_id===lp&&o.pay_type==='piece'&&+o.qty_plan>0))return lp;return activeProjects().find(o=>projOps.some(x=>x.project_id===o.id&&x.pay_type==='piece'&&+x.qty_plan>0))?.id||lp})(),false)}</select></label>
 <div id=pcBody></div>`}
 ${w.pay_type==='day'?'':`<button class=linkBtn onclick="openDay('${wid}','${d}')">Отметить день посуточно / переработку →</button>`}`;
 openModal();if(closed)return;
 let mode='plan',kind='work';
 const draw=()=>{
  const pid=$('pcProj').value,li=id=>{const i=specLines.findIndex(l=>l.id===id);return i<0?999:i},cs=id=>catOps.find(c=>c.id===id)?.sort??99,ops=projOps.filter(o=>o.project_id===pid&&o.pay_type==='piece'&&+o.qty_plan>0).sort((a,b)=>li(a.spec_line_id)-li(b.spec_line_id)||cs(a.catalog_op_id)-cs(b.catalog_op_id));
  if(!ops.length)mode='other';
  const others=workers.filter(x=>x.active&&x.id!==wid);
  $('pcBody').innerHTML=`${ops.length?`<div class=segBar style="margin:6px 0"><button type=button class="${mode==='plan'?'on':''}" data-m=plan>Из плана объекта</button><button type=button class="${mode==='other'?'on':''}" data-m=other>Другая работа</button></div>`:`<div class=small>У объекта нет плана работ — <button class=linkBtn style="padding:0" onclick="closeModal();detail('${pid}')">заполните спецификацию</button> или внесите «Другую работу».</div>`}
  ${mode==='plan'?`<label class=field>Работа<select id=pcOp>${ops.map(o=>{const left=Math.max(0,o.qty_plan-opDone(o.id));return `<option value="${o.id}" ${keep?.opId===o.id?'selected':''}>${esc(o.item_name)} — ${esc(o.name)} · осталось ${num(left)} из ${num(o.qty_plan)} · ${rub(o.rate)}/шт</option>`}).join('')}</select></label>
   <div class=label>Сколько штук</div><div class=qtyRow><input id=pcQty inputmode=decimal value="1" aria-label="Количество штук"><button type=button class=chip id=pcHalf>0,5</button><button type=button class=chip id=pcAll></button></div>
   <div class=label style="margin-top:10px">Вид</div><div class=chipRow id=pcKind>${['work','redo_paid','redo_free'].map(k=>`<button type=button class="chip ${kind===k?'on':''}" data-k=${k}>${KIND[k]}</button>`).join('')}</div>`
  :`${(typeof workRates!=='undefined'?workRates.filter(r=>r.kind==='other'):[]).length?`<div class=chipRow id=pcRates>${workRates.filter(r=>r.kind==='other').map((r,i)=>`<button type=button class=chip data-i=${i}>${esc(r.name)} · ${rub(r.rate)}</button>`).join('')}</div>`:''}<label class=field>Что сделал<input id=pcTitle placeholder="например: зачистка сварных швов"></label><label class=field>Сумма, ₽<input id=pcAmt inputmode=decimal autocomplete=off></label>`}
  ${others.length?`<label class=field>Кто делал<select id=pcPartner><option value="">${esc(w.name)} один</option>${others.map(x=>`<option value="${x.id}">${esc(w.name)} + ${esc(x.name)}</option>`).join('')}</select></label><div id=pcShareBox hidden class=inlineRow><label class=field>Доля ${esc(w.name)}, %<input id=pcShare inputmode=numeric value=50></label></div>`:''}
  <div class=calcLine id=pcCalc></div>
  <div class=actions><button class="btn secondary" onclick=closeModal()>Закрыть</button><button class=btn id=pcSave>Добавить</button></div>`;
  const calc=()=>{let t='';if(mode==='plan'){const o=projOps.find(x=>x.id===$('pcOp').value),n=qtyVal($('pcQty').value);if(o){const left=Math.max(0,o.qty_plan-opDone(o.id));$('pcAll').textContent='всё, что осталось · '+num(left);$('pcAll').disabled=!left;const r=kind==='redo_free'?0:o.rate;t=`<div class=small>осталось по плану ${num(left)} из ${num(o.qty_plan)} шт · ${rub(o.rate)}/шт</div>${num(n)} шт × ${rub(r)} = <b>${rub(n*r)}</b>${n>left&&kind==='work'?` <span class=warnTxt>больше плана (осталось ${num(left)})</span>`:''}`}}else{t='Сумма: <b>'+rub(moneyVal($('pcAmt')?.value))+'</b>'}
   if($('pcPartner')?.value){const sh=Math.min(100,Math.max(0,+$('pcShare').value||0));t+=` · ${esc(w.name)} ${sh}% / ${esc(wName($('pcPartner').value))} ${100-sh}%`}$('pcCalc').innerHTML=t};
  $('pcBody').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;draw()});
  if(mode==='plan'){$('pcOp').onchange=calc;$('pcQty').oninput=calc;$('pcHalf').onclick=()=>{$('pcQty').value='0,5';calc()};$('pcAll').onclick=()=>{const o=projOps.find(x=>x.id===$('pcOp').value);$('pcQty').value=num(Math.max(0,o.qty_plan-opDone(o.id)));calc()};$('pcKind').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;kind=b.dataset.k;[...$('pcKind').children].forEach(x=>x.classList.toggle('on',x===b));calc()}}
  else{$('pcAmt').oninput=e=>{fmtMoneyInput(e.target);calc()};if($('pcRates'))$('pcRates').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const r=workRates.filter(r=>r.kind==='other')[+b.dataset.i];$('pcTitle').value=r.name;$('pcAmt').value=moneyText(r.rate);calc()}}
  if($('pcPartner')){$('pcPartner').onchange=()=>{$('pcShareBox').hidden=!$('pcPartner').value;calc()};$('pcShare').oninput=calc}
  calc();
  $('pcSave').onclick=async()=>{const b=$('pcSave');if(b.disabled)return;
   let rows=[],base={workspace_id:currentWorkspace,work_date:d,project_id:pid||null,created_by:currentUser.id};
   if(mode==='plan'){const o=projOps.find(x=>x.id===$('pcOp').value),n=qtyVal($('pcQty').value);if(!o)return;if(!n)return alert('Укажите количество');const left=Math.max(0,o.qty_plan-opDone(o.id));
    if(kind==='work'&&n>left+1e-9&&!confirm(`По плану осталось ${num(left)} шт, а вы вводите ${num(n)}. Записать?`))return;
    const r=kind==='redo_free'?0:+o.rate;rows=[{...base,project_op_id:o.id,title:o.item_name+' — '+o.name+(kind!=='work'?' (переделка)':''),qty:n,rate:r,amount:Math.round(n*r*100)/100,kind}]}
   else{const t=$('pcTitle').value.trim(),a=moneyVal($('pcAmt').value);if(!t)return alert('Опишите работу');if(!a)return alert('Укажите сумму');rows=[{...base,project_op_id:null,title:t,qty:0,rate:0,amount:a,kind:'other'}]}
   const partner=$('pcPartner')?.value;
   if(partner){const sh=Math.min(100,Math.max(0,+$('pcShare').value||0))/100,g=uuid(),r=rows[0];if(sh<=0||sh>=1)return alert('Доля должна быть от 1 до 99%');
    const a1=Math.round(r.amount*sh*100)/100;rows=[{...r,worker_id:wid,group_id:g,qty:Math.round(r.qty*sh*1000)/1000,amount:a1},{...r,worker_id:partner,group_id:g,qty:Math.round((r.qty-Math.round(r.qty*sh*1000)/1000)*1000)/1000,amount:Math.round((r.amount-a1)*100)/100}]}
   else rows[0].worker_id=wid;
   b.disabled=true;b.textContent='Сохраняю…';
   try{await q(sb.from('piece_entries').insert(rows));await loadSalary();renderCurrent();toast('Записано '+rub(rows.reduce((s,r)=>s+r.amount,0)));openPiece(wid,d,{pid,opId:mode==='plan'?$('pcOp')?.value:''})}catch(e){b.disabled=false;b.textContent='Добавить';salErr(e)}};
 };
 $('pcProj').onchange=()=>{mode='plan';draw()};draw();
}
async function delPiece(id,wid,d){const p=pieces.find(x=>x.id===id);if(!p)return;const grp=p.group_id?pieces.filter(x=>x.group_id===p.group_id):[p];
 if(!confirm(`Удалить «${p.title}» на ${rub(grp.reduce((s,x)=>s+(+x.amount||0),0))}?${grp.length>1?' Запись на двоих удалится у обоих.':''}`))return;
 try{for(const x of grp)await q(sb.from('piece_entries').delete().eq('id',x.id));await loadSalary();renderCurrent();openPiece(wid,d)}catch(e){salErr(e)}}

// ---------- выдачи ----------
function payHtml(ws,closed){
 const end=addDays(ws,6),list=payouts.filter(p=>p.paid_on>=ws&&p.paid_on<=end).sort((a,b)=>a.paid_on.localeCompare(b.paid_on)||String(a.created_at).localeCompare(String(b.created_at)));
 const cash=list.filter(p=>p.method==='cash').reduce((s,p)=>s+(+p.amount),0),card=list.filter(p=>p.method==='card').reduce((s,p)=>s+(+p.amount),0);
 return `${list.map(p=>`<div class=payRow><div><b>${esc(wName(p.worker_id))}</b>${p.note?' · '+esc(p.note):''}<span>${shortDate(p.paid_on)} · ${p.method==='cash'?'наличные':'на карту'}</span></div><div><b>${rub(p.amount)}</b>${closed?'':` <button class=edDel aria-label="Удалить выдачу" onclick="delPayout('${p.id}')">×</button>`}</div></div>`).join('')||'<div class=empty>Выдач на этой неделе нет</div>'}
 <div class=info><div class=moneyRow><div><span>Наличными</span><b>${rub(cash)}</b></div><div><span>На карту</span><b>${rub(card)}</b></div><div><span>Всего</span><b>${rub(cash+card)}</b></div></div><div class=small>для сверки с кассой</div></div>
 ${closed?'':`<button class="btn wide" onclick="openPayout()">+ Выдать деньги</button>`}`;
}
function openPayout(wid,amount){
 const act=workers.filter(w=>w.active),today=localISO(),def=today>=salWeek&&today<=addDays(salWeek,6)?today:salWeek;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Выдать деньги</h2>
 <label class=field>Кому<select id=poW>${act.map(w=>`<option value="${w.id}" ${w.id===wid?'selected':''}>${esc(w.name)}</option>`).join('')}</select></label>
 <div class=small id=poBal></div>
 <label class=field>Сумма, ₽<input id=poAmt inputmode=decimal autocomplete=off value="${amount>0?moneyText(amount):''}"></label>
 <label class=field>Дата<input id=poDate type=date value="${def}"></label>
 <div class=chipRow id=poMethod><button type=button class="chip on" data-v=cash>Наличные</button><button type=button class=chip data-v=card>На карту</button></div>
 <label class=field>Комментарий<input id=poNote placeholder="например: аванс"></label>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=poSave>Выдать</button></div>`;
 openModal();let method='cash';
 const bal=()=>{const w=$('poW').value,ws=mondayOf($('poDate').value||def),r=weekRows(ws).find(x=>x.w.id===w);$('poBal').textContent=r?`Сейчас к выдаче за неделю ${weekLabel(ws)}: ${rub(r.bal)}`:''};
 $('poW').onchange=bal;$('poDate').onchange=bal;bal();
 $('poAmt').oninput=e=>fmtMoneyInput(e.target);
 $('poMethod').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;method=b.dataset.v;[...$('poMethod').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('poSave').onclick=async()=>{const b=$('poSave');if(b.disabled)return;const a=moneyVal($('poAmt').value);if(!a)return alert('Укажите сумму');b.disabled=true;b.textContent='Сохраняю…';
  try{await q(sb.from('payouts').insert({workspace_id:currentWorkspace,worker_id:$('poW').value,paid_on:$('poDate').value||def,amount:a,method,note:$('poNote').value.trim(),created_by:currentUser.id}));await loadSalary();closeModal();renderCurrent();toast(`Выдано ${rub(a)} — ${wName($('poW')?.value)||''}`.replace(/ — $/,''))}
  catch(e){b.disabled=false;b.textContent='Выдать';salErr(e)}};
}
async function delPayout(id){const p=payouts.find(x=>x.id===id);if(!p||!confirm(`Удалить выдачу ${rub(p.amount)} — ${wName(p.worker_id)}, ${shortDate(p.paid_on)}?`))return;try{await q(sb.from('payouts').delete().eq('id',id));await reloadSalary()}catch(e){salErr(e)}}

// ---------- итог ----------
function sumHtml(ws,closed){
 const rows=weekRows(ws),toPay=rows.reduce((s,r)=>s+Math.max(0,r.bal),0),over=rows.filter(r=>r.bal<-0.004);
 const line=(l,v,cls='')=>`<div class=kvRow><span>${l}</span><b class="${cls}">${v}</b></div>`;
 return rows.map(r=>{const a=r.a,adjList=adjs.filter(x=>x.worker_id===r.w.id&&x.adj_date>=ws&&x.adj_date<=addDays(ws,6));
  return `<div class=info><div class=kvRow><b style="font-size:16px">${esc(r.w.name)}</b>${r.bal>=-0.004?`<span>к выдаче <b class=pos>${rub(Math.max(0,r.bal))}</b></span>`:`<span>переплата <b class=neg>−${rub(-r.bal)}</b></span>`}</div>
  ${Math.abs(r.prev)>0.004?line('С прошлых недель',(r.prev>0?'+':'')+rub(r.prev),r.prev<0?'neg':''):''}
  ${a.days?line(`Дни · ${num(a.days,1)}`,'+'+rub(a.dayRub)):''}${a.ot?line(`Переработка · ${num(a.ot,1)} ч`,'+'+rub(a.otRub),'ot'):''}${a.pieceN?line(`Сдельно · ${a.pieceN} ${plural(a.pieceN,'запись','записи','записей')}`,'+'+rub(a.piece)):''}
  ${adjList.map(x=>line(esc(x.reason||'Корректировка'),(x.amount>0?'+':'')+rub(x.amount),x.amount<0?'neg':'')).join('')}
  ${a.paid?line('Выдано','−'+rub(a.paid)):''}
  <div class=chipRow style="margin-top:6px"><button class=chip onclick="openSheetOfWork('${r.w.id}')">Лист работ</button>${!closed&&r.bal>0.004?`<button class=chip onclick="openPayout('${r.w.id}',${Math.round(r.bal*100)/100})">Выдать ${rub(r.bal)}</button>`:''}</div></div>`}).join('')
 +(over.length?`<div class=small>Переплата ${over.map(r=>esc(r.w.name)+' '+rub(-r.bal)).join(', ')} — перейдёт на следующую неделю и в «к выдаче» не вычитается.</div>`:'')
 +`<div class=info><div class=kvRow><b>Всего к выдаче</b><b class=pos style="font-size:18px">${rub(toPay)}</b></div></div>`
 +(closed?`<div class=info>🔒 Неделя закрыта ${(()=>{const c=weekCloses.find(w=>w.week_start===ws);return c&&c.closed_at?new Date(c.closed_at).toLocaleDateString('ru-RU'):''})()}. Ошибки исправляйте корректировкой в текущей неделе.</div><button class=dangerLink onclick="reopenWeek()">Открыть неделю заново</button>`
  :`<button class="btn secondary wide" onclick="openAdj()">± Премия / штраф / дорога / корректировка</button><button class="btn wide" style="margin-top:8px" onclick="closeWeek()">Закрыть неделю…</button>`);
}
function openAdj(){
 const act=workers.filter(w=>w.active),today=localISO(),def=today>=salWeek&&today<=addDays(salWeek,6)?today:salWeek>today?salWeek:addDays(salWeek,6);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Премия, штраф, корректировка</h2>
 <label class=field>Кому<select id=adW>${act.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label>
 <div class=chipRow id=adSign><button type=button class="chip on" data-v=1>+ Начислить</button><button type=button class=chip data-v=-1>− Удержать</button></div>
 <label class=field>Сумма, ₽<input id=adAmt inputmode=decimal autocomplete=off></label>
 <div class=chipRow id=adReason>${['Премия','Дорога / суточные','Штраф','Корректировка'].map((r,i)=>`<button type=button class="chip ${i?'':'on'}" data-v="${r}">${r}</button>`).join('')}</div>
 <label class=field>Пояснение<input id=adNote placeholder="за что / какая ошибка исправляется"></label>
 <label class=field>Дата<input id=adDate type=date value="${def}"></label>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=adSave>Записать</button></div>`;
 openModal();let sign=1,reason='Премия';
 $('adAmt').oninput=e=>fmtMoneyInput(e.target);
 $('adSign').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;sign=+b.dataset.v;[...$('adSign').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('adReason').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;reason=b.dataset.v;if(reason==='Штраф'){sign=-1;[...$('adSign').children].forEach(x=>x.classList.toggle('on',x.dataset.v==='-1'))}[...$('adReason').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('adSave').onclick=async()=>{const b=$('adSave');if(b.disabled)return;const a=moneyVal($('adAmt').value);if(!a)return alert('Укажите сумму');const note=$('adNote').value.trim();if(reason==='Корректировка'&&!note)return alert('Напишите, что исправляет корректировка');b.disabled=true;
  try{await q(sb.from('pay_adjustments').insert({workspace_id:currentWorkspace,worker_id:$('adW').value,adj_date:$('adDate').value||def,amount:sign*a,reason:reason+(note?': '+note:''),created_by:currentUser.id}));await loadSalary();closeModal();renderCurrent();toast('Записано')}catch(e){b.disabled=false;salErr(e)}};
}
async function closeWeek(){const rows=weekRows(salWeek),t=rows.reduce((s,r)=>s+Math.max(0,r.bal),0);
 if(!confirm(`Закрыть неделю ${weekLabel(salWeek)}?\nК выдаче: ${rub(t)}.\nПосле закрытия отметки, работы и выдачи этой недели менять нельзя — только корректировкой в следующей.`))return;
 try{await q(sb.from('week_closes').insert({workspace_id:currentWorkspace,week_start:salWeek,closed_by:currentUser.id}));await reloadSalary();toast('Неделя закрыта, остатки перешли дальше')}catch(e){salErr(e)}}
async function reopenWeek(){const why=prompt('Открыть закрытую неделю для правок? Делайте это, только если выплаты по ней ещё не сверены.\nПричина (обязательно):','');if(why===null)return;if(!why.trim())return alert('Укажите причину');try{await sb.from('activity_log').insert({workspace_id:currentWorkspace,user_id:currentUser.id,entity_type:'week',action:'week_reopen',payload:{week:salWeek,reason:why.trim()}})}catch(e){}
 try{await q(sb.from('week_closes').delete().eq('workspace_id',currentWorkspace).eq('week_start',salWeek));await reloadSalary();toast('Неделя открыта для правок')}catch(e){salErr(e)}}
function openSheetOfWork(wid){
 const w=workers.find(x=>x.id===wid),ws=salWeek,end=addDays(ws,6),r=weekRows(ws).find(x=>x.w.id===wid);if(!w||!r)return;
 const lines=[];weekDates(ws).forEach((d,i)=>{const ds=tdays.filter(t=>t.worker_id===wid&&t.work_date===d),ps=pieces.filter(p=>p.worker_id===wid&&p.work_date===d);
  ds.forEach(t=>lines.push(`${DOW[i]} ${shortDate(d)}: ${+t.mark===1?'день':'полдня'} · ${t.project_id?projName(t.project_id):'цех'} · ${rub(t.mark*t.rate)}${+t.ot_hours?` + переработка ${num(t.ot_hours,1)} ч ${rub(t.ot_hours*t.ot_rate)}`:''}`));
  ps.forEach(p=>lines.push(`${DOW[i]} ${shortDate(d)}: ${p.title}${p.kind!=='other'?` · ${num(p.qty)} шт × ${rub(p.rate)}`:''} = ${rub(p.amount)}`))});
 adjs.filter(a=>a.worker_id===wid&&a.adj_date>=ws&&a.adj_date<=end).forEach(a=>lines.push(`${shortDate(a.adj_date)}: ${a.reason} ${a.amount>0?'+':''}${rub(a.amount)}`));
 payouts.filter(p=>p.worker_id===wid&&p.paid_on>=ws&&p.paid_on<=end).forEach(p=>lines.push(`${shortDate(p.paid_on)}: выдано ${rub(p.amount)} (${p.method==='cash'?'наличные':'карта'})`));
 const txt=`${w.name} · неделя ${weekLabel(ws)}\n`+(Math.abs(r.prev)>0.004?`С прошлых недель: ${rub(r.prev)}\n`:'')+lines.join('\n')+`\nИтого ${r.bal>=0?'к выдаче':'переплата'}: ${rub(r.bal)}`;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Лист работ</h2><textarea id=sowText class="supText sow" rows=14 readonly wrap=soft>${esc(txt)}</textarea><div class=actions><button class="btn secondary" onclick=closeModal()>Закрыть</button><button class=btn id=sowCopy>Скопировать для сотрудника</button></div>`;
 openModal();$('sowCopy').onclick=async()=>{try{await navigator.clipboard.writeText(txt);toast('Скопировано')}catch(e){$('sowText').select();toast('Выделено — скопируйте вручную')}};
}

// ---------- сотрудники ----------
function openWorkers(){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Сотрудники</h2>
 ${workers.map(w=>`<button class=catRow onclick="openWorker('${w.id}')" ${w.active?'':'style="opacity:.55"'}><b>${esc(w.name)}${w.active?'':' · архив'}</b><span>${w.pay_type==='piece'?'сдельно':'посуточно '+rub(w.day_rate)+'/день'} · переработка ${rub(w.ot_rate)}/ч${w.weekend_rate?` · выходной ${rub(w.weekend_rate)}`:''}</span></button>`).join('')||'<div class=empty>Сотрудников нет</div>'}
 <button class="btn wide" style="margin-top:10px" onclick="openWorker()">+ Сотрудник</button>`;
 openModal();
}
function openWorker(id){
 const w=workers.find(x=>x.id===id)||{name:'',pay_type:'day',day_rate:0,ot_rate:0,weekend_rate:null,active:true};
 const used=id&&(tdays.some(t=>t.worker_id===id)||pieces.some(p=>p.worker_id===id)||payouts.some(p=>p.worker_id===id));
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${id?'Сотрудник':'Новый сотрудник'}</h2>
 <label class=field>Имя<input id=wkName value="${esc(w.name)}" placeholder="Например: Сергей"></label>
 <div class=label>Оплата по умолчанию</div><div class=chipRow id=wkType><button type=button class="chip ${w.pay_type==='day'?'on':''}" data-v=day>Посуточно</button><button type=button class="chip ${w.pay_type==='piece'?'on':''}" data-v=piece>Сдельно</button></div>
 <div class=small>Сдельщику тоже можно отметить день посуточно, а посуточному — внести сдельную работу.</div>
 <div class=rateBox><label class=rateLine><span>Ставка за день, ₽</span><input id=wkDay inputmode=decimal value="${moneyText(w.day_rate)}"></label><label class=rateLine><span>За час переработки, ₽</span><input id=wkOt inputmode=decimal value="${moneyText(w.ot_rate)}"></label><label class=rateLine><span>За выходной день, ₽<small>если другая</small></span><input id=wkWe inputmode=decimal value="${w.weekend_rate?moneyText(w.weekend_rate):''}" placeholder="как в будни"></label></div>
 <label class=field>Аккаунт в приложении (увидит свою зарплату в «Цех → Моя работа»)<select id=wkUser><option value="">— не привязан —</option>${members.filter(m=>m.role!=='owner'||m.user_id===w.user_id).map(m=>`<option value="${m.user_id}" ${w.user_id===m.user_id?'selected':''}>${esc(m.display_name||m.email||'Сотрудник')}${m.email?' · '+esc(m.email):''}</option>`).join('')}</select></label>
 ${id?'<div class=small>Новая ставка — только для новых отметок. Прошлые недели не пересчитываются.</div>':''}
 ${id?`<label class=check2><input type=checkbox id=wkActive ${w.active?'checked':''}> Работает (снимите — уйдёт в архив, долги сохранятся)</label>`:''}
 <div class=actions><button class="btn secondary" onclick="openWorkers()">Назад</button><button class=btn id=wkSave>Сохранить</button></div>
 ${id&&!used?`<button class=dangerLink onclick="delWorker('${id}')">Удалить сотрудника</button>`:''}`;
 openModal();let type=w.pay_type;
 ['wkDay','wkOt','wkWe'].forEach(k=>$(k).oninput=e=>fmtMoneyInput(e.target));
 $('wkType').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;type=b.dataset.v;[...$('wkType').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('wkSave').onclick=async()=>{const b=$('wkSave');if(b.disabled)return;const name=$('wkName').value.trim();if(!name)return alert('Укажите имя');
  const body={name,pay_type:type,day_rate:moneyVal($('wkDay').value),ot_rate:moneyVal($('wkOt').value),weekend_rate:$('wkWe').value.trim()?moneyVal($('wkWe').value):null,active:id?$('wkActive').checked:true,user_id:$('wkUser').value||null};if(body.user_id&&workers.some(x=>x.id!==id&&x.user_id===body.user_id))return alert('Этот аккаунт уже привязан к другому сотруднику');
  if(type==='day'&&!body.day_rate&&!confirm('Ставка за день не указана. Сохранить с нулём?'))return;
  b.disabled=true;try{if(id)await q(sb.from('workers').update(body).eq('id',id));else await q(sb.from('workers').insert({...body,workspace_id:currentWorkspace,sort:workers.length}));await loadSalary();renderCurrent();openWorkers();toast('Сохранено')}catch(e){b.disabled=false;salErr(e)}};
}
async function delWorker(id){if(!confirm('Удалить сотрудника?'))return;try{await q(sb.from('workers').delete().eq('id',id));await loadSalary();renderCurrent();openWorkers()}catch(e){salErr(e)}}
