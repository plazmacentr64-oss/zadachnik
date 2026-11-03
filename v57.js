'use strict';
// v57: Зарплата одним экраном (неделя → лента дней → люди дня → итог недели), один барабан на день/объект/переработку,
// окно «что сделал за неделю» с правкой цен, раздел «Справочники»: сотрудники, расценки, изделия, прайс, команда.

let salDay=null;
const SKILLS=['Сварка','Покраска','Дерево','Сборка','Монтаж','Подсобник'];
const s57av=w=>`<span class="s57av ${w.pay_type==='piece'?'pc':''} ${w.active?'':'off'}">${esc((w.name||'?').trim().charAt(0).toUpperCase())}</span>`;
const s57k=n=>num(Math.round(+n||0),0);
const s57chev='<span class=s57chev aria-hidden=true>›</span>';

/* ---------- единый барабан: доп. кнопка внизу ---------- */
(()=>{if(typeof wheelLayer==='undefined')return;const p=wheelLayer.querySelector('.woodWheelPanel');
 if(p&&!p.querySelector('.wheelExtra')){const b=document.createElement('button');b.type='button';b.className='wheelManual wheelExtra';b.hidden=true;p.append(b)}})();
function openWheel57(title,cols,onDone,extra){
 openWheels(title,cols,onDone);
 const b=wheelLayer.querySelector('.wheelExtra');if(!b)return;
 if(extra){b.hidden=false;b.textContent=extra.label;b.onclick=()=>{wheelLayer.hidden=true;wheelCur=null;extra.fn()}}else{b.hidden=true;b.onclick=null}
}

/* ---------- расчёт по дню ---------- */
function dayInfo(w,d){
 const ds=tdays.filter(t=>t.worker_id===w.id&&t.work_date===d),ps=pieces.filter(p=>p.worker_id===w.id&&p.work_date===d);
 const mark=ds.reduce((s,t)=>s+(+t.mark||0),0),ot=ds.reduce((s,t)=>s+(+t.ot_hours||0),0);
 const rubD=ds.reduce((s,t)=>s+(+t.mark||0)*(+t.rate||0)+(+t.ot_hours||0)*(+t.ot_rate||0),0),rubP=ps.reduce((s,p)=>s+(+p.amount||0),0);
 return {ds,ps,mark,ot,sum:rubD+rubP,marked:ds.length>0||ps.length>0};
}
function pieceLine(ps){
 const g=new Map();ps.forEach(p=>{const k=p.title||'Работа';g.set(k,(g.get(k)||0)+(+p.qty||0))});
 return [...g].map(([t,qn])=>qn?`${t} × ${num(qn,1)}`:t).join(' · ');
}
function dayLine(w,inf){
 const parts=[];
 if(inf.ds.length){const m=inf.mark;parts.push((inf.ds.length>1?'½ + ½':m>=1?'Весь день':m>0?'½ дня':'Не был')+(inf.ot?` + ${num(inf.ot,1)} ч`:''));
  const pr=[...new Set(inf.ds.map(t=>t.project_id?projName(t.project_id):'Цех'))];parts.push(pr.join(' / '))}
 if(inf.ps.length)parts.push(pieceLine(inf.ps));
 return parts.join(' · ');
}
const dayWorkers=(ws)=>{const end=addDays(ws,6);return workers.filter(w=>w.active||tdays.some(t=>t.worker_id===w.id&&t.work_date>=ws&&t.work_date<=end)||pieces.some(p=>p.worker_id===w.id&&p.work_date>=ws&&p.work_date<=end))
 .sort((a,b)=>(a.pay_type==='piece')-(b.pay_type==='piece')||(a.sort||0)-(b.sort||0)||a.name.localeCompare(b.name,'ru'))};
function dayDot(d,ws){
 if(d>localISO())return '';
 const dw=dayWorkers(ws).filter(w=>w.pay_type!=='piece'&&w.active);if(!dw.length)return pieces.some(p=>p.work_date===d)?'f':'';
 const n=dw.filter(w=>tdays.some(t=>t.worker_id===w.id&&t.work_date===d)).length;return n===0?'':n===dw.length?'f':'h';
}

/* ---------- экран Зарплаты ---------- */
renderSalary=function(){
 if(!salWeek)salWeek=mondayOf(localISO());
 const ws=salWeek,dates=weekDates(ws),closed=weekClosed(ws),today=localISO();
 if(!salDay||salDay<ws||salDay>dates[6])salDay=today>=ws&&today<=dates[6]?today:ws;
 const d=salDay,di=dates.indexOf(d);
 let h=`<div class=s57wk><button class=s57round onclick="s57week(-7)" aria-label="Прошлая неделя">‹</button><b>${weekLabel(ws)}${closed?' · закрыта':''}</b><button class=s57round onclick="s57week(7)" aria-label="Следующая неделя">›</button></div>`;
 if(salaryError){$('analyticsBody').innerHTML=h+`<div class=empty>Зарплата не загрузилась: ${esc(salaryError)}</div>`;return}
 if(!workers.length){$('analyticsBody').innerHTML=h+`<div class=empty>Добавьте сотрудников: имя, посуточно или сдельно, ставка за день и за час переработки.<br><button class=btn style="margin-top:10px" onclick="openWorker57()">+ Сотрудник</button></div>`;return}
 h+=`<div class=s57days role=tablist aria-label="Дни недели">${dates.map((x,i)=>`<button role=tab aria-selected=${x===d} class="s57d ${x===d?'on':''} ${isWeekend(x)?'we':''} ${x===today?'today':''}" onclick="salDay='${x}';renderSalary()">${DOW[i]}<b>${parseDate(x).getDate()}</b><i class="${dayDot(x,ws)}"></i></button>`).join('')}</div>`;
 const list=dayWorkers(ws),dayW=list.filter(w=>w.pay_type!=='piece'&&w.active),markedN=dayW.filter(w=>tdays.some(t=>t.worker_id===w.id&&t.work_date===d)).length;
 const daySum=list.reduce((s,w)=>s+dayInfo(w,d).sum,0);
 const dn=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][di];
 h+=`<div class=s57sec><b>${dn}${dayW.length?` · ${markedN} из ${dayW.length}`:''}</b>${!closed&&dayW.length&&markedN<dayW.length&&d<=today?`<button class=s57pill onclick="markAllDay('${d}')">Все на месте</button>`:`<span>${daySum?rub(daySum):''}</span>`}</div>`;
 h+=`<div class=s57list>${list.map(w=>{const inf=dayInfo(w,d),pc=w.pay_type==='piece',sub=inf.marked?dayLine(w,inf):pc?'ждём отметки из Цеха':(w.pay_type==='piece'?'сдельно':`посуточно · ${s57k(rateFor(w,d))} ₽`);
  const right=inf.marked?`<span class=s57v>${s57k(inf.sum)}</span>`:(!pc&&!closed&&d<=today?`<button class=s57ask onclick="event.stopPropagation();s57was('${w.id}','${d}')">Был?</button>`:`<span class="s57v mute">0</span>`);
  return `<div class="s57row ${inf.marked&&!inf.mark&&!inf.ps.length?'dim':''}" role=button tabindex=0 onclick="s57tap('${w.id}','${d}')" onkeydown="if(event.key==='Enter')this.click()">${s57av(w)}<span class=s57tx><b>${esc(w.name)}</b><span>${esc(sub)}</span></span>${right}</div>`}).join('')}</div>`;
 h+=weekHtml57(ws,closed);
 $('analyticsBody').innerHTML=h;
};
function s57week(n){salWeek=addDays(salWeek,n);salDay=null;renderSalary()}
async function s57was(wid,d){
 const w=workers.find(x=>x.id===wid);if(!w)return;if(weekClosed(mondayOf(d)))return toast('Неделя закрыта');
 if(tdays.some(t=>t.worker_id===wid&&t.work_date===d))return s57tap(wid,d);
 const lp=lastProject(wid)||null,row={id:uuid(),workspace_id:currentWorkspace,worker_id:wid,work_date:d,mark:1,project_id:lp,rate:rateFor(w,d),ot_rate:+w.ot_rate||0};
 try{await q(sb.from('time_days').insert(row));await loadSalary();renderCurrent();
  toast(`${w.name} — весь день, ${lp?projName(lp):'Цех'}`,async()=>{try{await q(sb.from('time_days').delete().eq('id',row.id));await loadSalary();renderCurrent()}catch(e){salErr(e)}})}catch(e){salErr(e)}
}
function s57tap(wid,d){
 const w=workers.find(x=>x.id===wid);if(!w)return;
 if(weekClosed(mondayOf(d)))return w.pay_type==='piece'?openPiece(wid,d):openDay(wid,d);
 if(w.pay_type==='piece'&&!tdays.some(t=>t.worker_id===wid&&t.work_date===d))return openPiece(wid,d);
 const ds=tdays.filter(t=>t.worker_id===wid&&t.work_date===d);
 if(ds.length>1)return openDay(wid,d);
 const cur=ds[0],mark=cur?+cur.mark:1,proj=cur?(cur.project_id||''):(lastProject(wid)||''),ot=cur?+cur.ot_hours||0:0,rate=rateFor(w,d);
 const projItems=[{v:'',t:'Цех'},...activeProjects().map(o=>({v:o.id,t:o.name}))];
 const otItems=Array.from({length:25},(_,i)=>({v:i/2,t:(i%2?num(i/2,1):String(i/2))+' ч'}));
 const dl=`${esc(w.name)} · ${DOW[(parseDate(d).getDay()+6)%7].toLowerCase()} ${shortDate(d)}`;
 openWheel57(dl,[
  {label:'День · '+s57k(rate)+' ₽',value:mark,items:[{v:1,t:'Весь день'},{v:0.5,t:'½ дня'},{v:0,t:'Не был'}]},
  {label:'Объект',value:proj,items:projItems},
  {label:'Переработка',value:ot,items:otItems}],
 async([m,p,o])=>{
  try{for(const t of ds)await q(sb.from('time_days').delete().eq('id',t.id));
   if(+m>0)await q(sb.from('time_days').insert({workspace_id:currentWorkspace,worker_id:wid,work_date:d,mark:+m,project_id:p||null,ot_hours:+o||0,rate,ot_rate:+w.ot_rate||0,note:cur?.note||''}));
   await loadSalary();renderCurrent();toast(`${w.name}: ${+m?(+m===1?'весь день':'½ дня')+(+o?` + ${num(o,1)} ч`:''):'не был'}`)}
  catch(e){salErr(e)}},
 {label:w.pay_type==='piece'?'Сдельная работа за день →':'Два объекта, комментарий, сделка →',fn:()=>w.pay_type==='piece'?openPiece(wid,d):openDay(wid,d)});
}

/* ---------- итог недели ---------- */
function noPriceN(wid,ws){const end=addDays(ws,6);return pieces.filter(p=>p.worker_id===wid&&p.work_date>=ws&&p.work_date<=end&&p.kind==='work'&&!(+p.rate>0)).length}
function weekHtml57(ws,closed){
 const rows=weekRows(ws);if(!rows.length)return '';
 const acc=rows.reduce((s,r)=>s+accTotal(r.a)+r.a.adj,0),paid=rows.reduce((s,r)=>s+r.a.paid,0),toPay=rows.reduce((s,r)=>s+Math.max(0,r.bal),0);
 const sub=r=>{const a=r.a,p=[];if(a.days)p.push(num(a.days,1)+' дн');if(a.ot)p.push(num(a.ot,1)+' ч');const qn=pieces.filter(x=>x.worker_id===r.w.id&&x.work_date>=ws&&x.work_date<=addDays(ws,6)).reduce((s,x)=>s+(+x.qty||0),0);if(a.pieceN)p.push(qn?num(qn,1)+' шт':a.pieceN+' раб.');if(Math.abs(r.prev)>0.004)p.push((r.prev>0?'+':'')+s57k(r.prev)+' с прошлых');if(a.paid)p.push('выдано '+s57k(a.paid));return p.join(' · ')||'нет записей'};
 let h=`<div class="s57sec" style="margin-top:14px"><b>Итог недели</b><span>${closed?'закрыта':'не закрыта'}</span></div>
 <div class=s57strip><div><b>${s57k(acc)}</b><span>начислено</span></div><div><b>${s57k(paid)}</b><span>выдано</span></div><div><b class=pos>${s57k(toPay)}</b><span>к выдаче</span></div></div>
 <div class=s57list>${rows.map(r=>{const np=noPriceN(r.w.id,ws);
  return `<div class="s57row ${np?'warn':''}" role=button tabindex=0 onclick="openDone57('${r.w.id}')" onkeydown="if(event.key==='Enter')this.click()">${s57av(r.w)}<span class=s57tx><b>${esc(r.w.name)}</b><span class="${np?'bad':''}">${np?np+' без цены · ':''}${esc(sub(r))}</span></span><span class=s57v>${r.bal<-0.004?'−'+s57k(-r.bal):s57k(Math.max(0,r.bal))}</span>${!closed&&r.bal>0.004?`<button class=s57pay onclick="event.stopPropagation();openPayout('${r.w.id}',${Math.round(r.bal*100)/100})">Выдать</button>`:r.a.paid&&r.bal<=0.004?'<span class=s57done>выдано</span>':''}</div>`}).join('')}</div>
 <div class=s57links><button class=linkBtn onclick="openAdj()">± Премия / штраф</button><button class=linkBtn onclick="s57pays()">Выдачи недели</button></div>`;
 h+=closed?`<div class=small style="text-align:center">Неделя закрыта. Ошибки — корректировкой в текущей неделе.</div><button class=dangerLink onclick="reopenWeek()">Открыть неделю заново</button>`
  :`<button class="btn wide s57dark" onclick="closeWeek()">Закрыть неделю</button>`;
 return h;
}
function s57pays(){$('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Выдачи · ${weekLabel(salWeek)}</h2>${payHtml(salWeek,weekClosed(salWeek))}`;openModal()}

/* ---------- что сделал за неделю ---------- */
function openDone57(wid){
 const w=workers.find(x=>x.id===wid),ws=salWeek,end=addDays(ws,6),closed=weekClosed(ws),r=weekRows(ws).find(x=>x.w.id===wid);if(!w||!r)return;
 const ps=pieces.filter(p=>p.worker_id===wid&&p.work_date>=ws&&p.work_date<=end),a=r.a;
 const byProj=new Map();ps.forEach(p=>{const k=p.project_id||'';if(!byProj.has(k))byProj.set(k,new Map());const g=byProj.get(k),key=(p.project_op_id||p.title)+'|'+(+p.rate)+'|'+p.kind;if(!g.has(key))g.set(key,{title:p.title,rate:+p.rate,kind:p.kind,qty:0,sum:0,days:new Map(),ids:[],opId:p.project_op_id,partId:p.part_id,stage:p.stage});const it=g.get(key);it.qty+=+p.qty||0;it.sum+=+p.amount||0;it.ids.push(p.id);const dd=DOW[(parseDate(p.work_date).getDay()+6)%7].toLowerCase()+' '+parseDate(p.work_date).getDate();it.days.set(dd,(it.days.get(dd)||0)+(+p.qty||0))});
 window._done57={};let n=0;
 const items=[...byProj].map(([pid,g])=>`<div class=s57og>${esc(pid?projName(pid):'Цех')}</div>${[...g.values()].map(it=>{const id='i'+(n++);window._done57[id]=it;const no=it.kind==='work'&&!(it.rate>0);
  return `<div class="s57it ${no?'no':''}"><div class=r1><b>${esc(it.title)}</b><span class="s57v ${no?'mute':''}">${s57k(it.sum)}</span></div><div class=r2><span>${it.kind==='other'?'другая работа':num(it.qty,1)+' шт'}${it.days.size&&it.kind!=='other'?' · '+[...it.days].map(([k,v])=>`${k}: ${num(v,1)}`).join(', '):''}${it.kind==='redo_free'?' · переделка 0 ₽':it.kind==='redo_paid'?' · переделка':''}</span>${it.kind==='other'||it.kind==='redo_free'?'':closed?`<span class=s57price>${s57k(it.rate)} ₽</span>`:`<button class="s57price ${no?'no':''}" onclick="s57priceEdit('${wid}','${id}')">${no?'Указать цену':s57k(it.rate)+' ₽ ✎'}</button>`}</div></div>`}).join('')}`).join('');
 const dayRows=a.days||a.ot?`<div class=s57og>Посуточно</div><div class=s57it><div class=r1><b>${num(a.days,1)} ${plural(Math.ceil(a.days),'день','дня','дней')}${a.ot?` + ${num(a.ot,1)} ч переработки`:''}</b><span class=s57v>${s57k(a.dayRub+a.otRub)}</span></div></div>`:'';
 const adjL=adjs.filter(x=>x.worker_id===wid&&x.adj_date>=ws&&x.adj_date<=end);
 const tot=accTotal(a)+a.adj;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(w.name)}</h2><div class=summary>${w.pay_type==='piece'?'сдельно':'посуточно'} · ${weekLabel(ws)}${ps.length?' · '+num(ps.reduce((s,p)=>s+(+p.qty||0),0),1)+' шт':''}</div>
 ${dayRows}${items||(!dayRows?'<div class=empty>За неделю записей нет</div>':'')}
 ${adjL.length?`<div class=s57og>Премии и штрафы</div>${adjL.map(x=>`<div class=s57it><div class=r1><b>${esc(x.reason||'Корректировка')}</b><span class=s57v>${x.amount>0?'+':''}${s57k(x.amount)}</span></div></div>`).join('')}`:''}
 <div class=s57tot><span>Начислено за неделю</span><b>${rub(tot)}</b></div>
 ${Math.abs(r.prev)>0.004?`<div class=s57kv><span>С прошлых недель</span><b>${r.prev>0?'+':''}${rub(r.prev)}</b></div>`:''}${a.paid?`<div class=s57kv><span>Выдано</span><b>−${rub(a.paid)}</b></div>`:''}
 <div class=s57kv><span><b>${r.bal<-0.004?'Переплата':'К выдаче'}</b></span><b class=pos>${rub(Math.abs(r.bal))}</b></div>
 <div class=actions><button class="btn secondary" onclick="openSheetOfWork('${wid}')">Лист работ</button>${!closed&&r.bal>0.004?`<button class=btn onclick="openPayout('${wid}',${Math.round(r.bal*100)/100})">Выдать ${rub(r.bal)}</button>`:''}</div>`;
 openModal();
}

/* ---------- правка цены ---------- */
function s57priceEdit(wid,key){
 const it=window._done57?.[key],w=workers.find(x=>x.id===wid);if(!it||!w)return;
 const po=it.opId&&projOps.find(o=>o.id===it.opId),cat=po&&po.catalog_op_id&&catOps.find(c=>c.id===po.catalog_op_id),wr=!po&&it.stage&&workRates.find(r=>r.kind==='wood'&&r.name===STAGE_LBL[it.stage]);
 const canAll=!!(cat||wr),thisWeek=mondayOf(localISO())===salWeek;
 let mode=canAll&&thisWeek?'all':'one';
 const quick=[...new Set([it.rate,...(cat?[+cat.rate]:[])].filter(v=>v>0))];
 const sugg=quick.length?quick:[];
 $('sheet').innerHTML=`<button class=close onclick="openDone57('${wid}')" aria-label="Назад">×</button><h2>${esc(it.title)}</h2><div class=summary>цена за 1 шт · сейчас ${rub(it.rate)}${cat?` · в справочнике ${rub(cat.rate)}`:''}</div>
 <input id=s57pv class=s57money inputmode=decimal autocomplete=off value="${it.rate>0?moneyText(it.rate):''}" placeholder="0 ₽" aria-label="Цена за штуку">
 ${sugg.length?`<div class=s57qc>${sugg.map(v=>`<button type=button onclick="$('s57pv').value=moneyText(${v});s57pcalc()">${s57k(v)}</button>`).join('')}</div>`:''}
 <div class=s57og>Кому применить</div>
 <button type=button class="s57opt ${mode==='one'?'on':''}" data-m=one><span class=rad></span><span><b>Только ${esc(w.name)}, эта неделя</b>Разовая цена для ${num(it.qty,1)} шт. В справочнике не меняется</span></button>
 ${canAll?`<button type=button class="s57opt ${mode==='all'?'on':''}" data-m=all ${thisWeek?'':'disabled'}><span class=rad></span><span><b>Расценка для всех</b>${thisWeek?'Запишется в справочник. Пересчитает текущую неделю у всех; закрытые недели не меняются':'Доступно только для текущей недели — откройте её'}</span></button>`:''}
 <div class=s57res><span id=s57pl></span><b id=s57pr></b></div>
 <button class="btn wide" id=s57ps>Сохранить цену</button>`;
 openModal();
 const el=$('s57pv');el.oninput=e=>{fmtMoneyInput(e.target);s57pcalc()};setTimeout(()=>{try{el.focus();el.select()}catch(e){}},60);
 window.s57pcalc=()=>{const v=moneyVal(el.value);$('s57pl').textContent=`${w.name}: ${num(it.qty,1)} × ${s57k(v)}`;const dlt=Math.round((v-it.rate)*it.qty);$('s57pr').textContent=(dlt>=0?'+':'−')+rub(Math.abs(dlt))};s57pcalc();
 $('sheet').querySelectorAll('.s57opt').forEach(b=>b.onclick=()=>{if(b.disabled)return;mode=b.dataset.m;$('sheet').querySelectorAll('.s57opt').forEach(x=>x.classList.toggle('on',x===b))});
 $('s57ps').onclick=async()=>{const b=$('s57ps');if(b.disabled)return;const v=moneyVal(el.value);if(!(v>0)&&!confirm('Цена 0 ₽ — сохранить?'))return;b.disabled=true;b.textContent='Сохраняю…';
  try{
   if(mode==='all'&&cat){await applyOpRate(cat.id,v);await loadProd()}
   else if(mode==='all'&&wr){await applyWorkRate(wr,v);await loadProd()}
   for(const id of it.ids){const p=pieces.find(x=>x.id===id);if(p&&!weekClosed(mondayOf(p.work_date)))await q(sb.from('piece_entries').update({rate:v,amount:Math.round((+p.qty||0)*v*100)/100}).eq('id',id))}
   await loadSalary();renderCurrent();toast(mode==='all'?'Расценка для всех: '+rub(v):'Цена для '+w.name+': '+rub(v));openDone57(wid)}
  catch(e){b.disabled=false;b.textContent='Сохранить цену';salErr(e)}};
}

/* ---------- Справочники ---------- */
const noRateOps=()=>catOps.filter(o=>o.pay_type==='piece'&&!(+o.rate>0)&&catItems.some(i=>i.id===o.item_id&&!i.archived));
const noRateWood=()=>workRates.filter(r=>r.kind==='wood'&&!(+r.rate>0));
function openRefs(){
 const own=isOwner(),act=workers.filter(w=>w.active).length,nr=noRateOps().length+noRateWood().length,coEmpty=!Object.values(companyInfo||{}).some(v=>String(v||'').trim());
 const row=(icn,t,s,right,fn,bad)=>`<button class="s57row ${bad?'warn':''}" onclick="${fn}"><span class=s57ic>${ic(icn,18)}</span><span class=s57tx><b>${t}</b><span>${s}</span></span>${right}${s57chev}</button>`;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Справочники</h2><div class=summary>${nr||!act?'Есть что заполнить — красные метки':'Всё заполнено'}</div>
 <div class=s57og>Люди и работа</div><div class=s57list>
 ${own?row('users','Сотрудники','ставки, оплата, что делает',`<span class=s57cnt>${act}</span>`,'openWorkers()',!act):''}
 ${own?row('tag','Расценки на работы','₽ за штуку по изделиям, дерево, прочее',nr?`<span class="s57badge r">${nr} без цены</span>`:`<span class=s57cnt>${catOps.filter(o=>o.pay_type==='piece').length+workRates.length}</span>`,'openRates57()',nr):''}
 ${row('hard-hat','Команда и доступы','руководитель, мастер, приглашения',`<span class=s57cnt>${members.length}</span>`,'openTeam()')}
 </div><div class=s57og>Производство</div><div class=s57list>
 ${row('package','Изделия','спецификации, работы, материалы',`<span class=s57cnt>${catItems.filter(i=>!i.archived).length}</span>`,'openCatalog()')}
 ${own?row('warehouse','Материалы и цены','металл, дерево, краска, метизы','','openPriceList()'):''}
 </div>${own?`<div class=s57og>Компания</div><div class=s57list>
 ${row('buildings','Заказчики','ИНН, контакты, долги','<span class="s57badge g">скоро</span>',"toast('Справочник заказчиков — следующим шагом')")}
 ${row('receipt','Реквизиты','для договоров и счетов',coEmpty?'<span class="s57badge a">пусто</span>':'','openTeam()',false)}
 ${row('gear-six','Накладные расходы','аренда, свет, доля на объект','',"closeModal();moneySeg='overhead';try{localStorage.setItem('moneySeg','overhead')}catch(e){};showView('analytics')")}
 </div>`:''}`;
 openModal();
}
if(typeof openTeam==='function'){const _openTeam57=openTeam;openTeam=async function(){await _openTeam57();const h=$('sheet')?.querySelector('h2');if(h&&!$('s57refBtn'))h.insertAdjacentHTML('afterend',`<button id=s57refBtn class="s57row" style="margin:6px 0 10px" onclick="openRefs()"><span class=s57ic>${ic('list-checks',18)}</span><span class=s57tx><b>Справочники</b><span>сотрудники, расценки, изделия, прайс</span></span>${noRateOps().length+noRateWood().length&&isOwner()?`<span class="s57badge r">${noRateOps().length+noRateWood().length} без цены</span>`:''}${s57chev}</button>`)}}

/* ---------- Сотрудники ---------- */
let wkTab57='on';
openWorkers=function(){
 const list=workers.filter(w=>wkTab57==='on'?w.active:!w.active),day=list.filter(w=>w.pay_type!=='piece'),pc=list.filter(w=>w.pay_type==='piece');
 const row=w=>`<button class=s57row onclick="openWorker57('${w.id}')">${s57av(w)}<span class=s57tx><b>${esc(w.name)}</b><span>${esc([(w.skills||[]).join(', ').toLowerCase(),w.pay_type==='piece'?'по расценкам':(+w.ot_rate?'переработка '+s57k(w.ot_rate)+' ₽/ч':'')].filter(Boolean).join(' · ')||(w.pay_type==='piece'?'сдельно':'посуточно'))}</span></span>${w.pay_type==='piece'?s57chev:`<span class=s57v>${s57k(w.day_rate)}/д</span>`}</button>`;
 $('sheet').innerHTML=`<button class=close onclick="openRefs()" aria-label="Назад">×</button><div class=s57hd><div><h2>Сотрудники</h2><div class=summary>${workers.filter(w=>w.active&&w.pay_type!=='piece').length} посуточно · ${workers.filter(w=>w.active&&w.pay_type==='piece').length} сдельно</div></div><button class=s57plus onclick="openWorker57()" aria-label="Новый сотрудник">+</button></div>
 <div class="segBar s57seg2"><button class="${wkTab57==='on'?'on':''}" onclick="wkTab57='on';openWorkers()">Работают · ${workers.filter(w=>w.active).length}</button><button class="${wkTab57==='off'?'on':''}" onclick="wkTab57='off';openWorkers()">Уволены · ${workers.filter(w=>!w.active).length}</button></div>
 ${day.length?`<div class=s57og>Посуточно</div><div class=s57list>${day.map(row).join('')}</div>`:''}${pc.length?`<div class=s57og>Сдельно</div><div class=s57list>${pc.map(row).join('')}</div>`:''}
 ${list.length?'':`<div class=empty>${wkTab57==='on'?'Сотрудников пока нет':'Уволенных нет'}</div>`}`;
 openModal();
};
function openWorker57(id){
 const w=workers.find(x=>x.id===id)||{name:'',pay_type:'day',day_rate:+(typeof wsSettings!=='undefined'&&wsSettings?.day_rate_default)||0,ot_rate:0,weekend_rate:null,active:true,skills:[],phone:''};
 const used=id&&(tdays.some(t=>t.worker_id===id)||pieces.some(p=>p.worker_id===id)||payouts.some(p=>p.worker_id===id));
 let type=w.pay_type,skills=new Set(w.skills||[]);
 $('sheet').innerHTML=`<button class=close onclick="openWorkers()" aria-label="Назад">×</button><h2>${id?esc(w.name):'Новый сотрудник'}</h2>
 <label class=field>Имя<input id=wkName value="${esc(w.name)}" placeholder="Например: Сергей"></label>
 <div class=label>Оплата</div><div class="segBar s57seg2" id=wkType><button type=button class="${type==='day'?'on':''}" data-v=day>Посуточно</button><button type=button class="${type==='piece'?'on':''}" data-v=piece>Сдельно</button></div>
 <div class=s57g3><label class=field>За день, ₽<input id=wkDay inputmode=decimal value="${moneyText(w.day_rate)}"></label><label class=field>Выходной, ₽<input id=wkWe inputmode=decimal value="${w.weekend_rate?moneyText(w.weekend_rate):''}" placeholder="как в будни"></label><label class=field>Час перераб.<input id=wkOt inputmode=decimal value="${moneyText(w.ot_rate)}"></label></div>
 <div class=label>Что делает — для Цеха и плана</div><div class=chipRow id=wkSk>${SKILLS.map(s=>`<button type=button class="chip ${skills.has(s)?'on':''}" data-v="${s}">${s}</button>`).join('')}</div>
 <label class=field>Телефон<input id=wkPh inputmode=tel value="${esc(w.phone||'')}" placeholder="+7 …"></label>
 <label class=field>Вход в приложение<select id=wkUser><option value="">Нет — отмечает мастер</option>${members.filter(m=>m.role!=='owner'||m.user_id===w.user_id).map(m=>`<option value="${m.user_id}" ${w.user_id===m.user_id?'selected':''}>${esc(m.display_name||m.email||'Сотрудник')}${m.email?' · '+esc(m.email):''}</option>`).join('')}</select></label>
 ${id?'<div class=small>Новая ставка — для новых отметок. Закрытые недели не пересчитываются.</div>':''}
 <button class="btn wide" id=wkSave style="margin-top:10px">Сохранить</button>
 ${id?`<button class=dangerLink id=wkAct>${w.active?'Уволить (история остаётся)':'Вернуть на работу'}</button>`:''}
 ${id&&!used?`<button class=dangerLink onclick="delWorker('${id}')">Удалить совсем</button>`:''}`;
 openModal();
 ['wkDay','wkOt','wkWe'].forEach(k=>$(k).oninput=e=>fmtMoneyInput(e.target));
 $('wkType').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;type=b.dataset.v;[...$('wkType').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('wkSk').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;const v=b.dataset.v;skills.has(v)?skills.delete(v):skills.add(v);b.classList.toggle('on',skills.has(v))};
 const save=async(active)=>{const name=$('wkName').value.trim();if(!name)return alert('Укажите имя');
  const body={name,pay_type:type,day_rate:moneyVal($('wkDay').value),ot_rate:moneyVal($('wkOt').value),weekend_rate:$('wkWe').value.trim()?moneyVal($('wkWe').value):null,active,user_id:$('wkUser').value||null,phone:$('wkPh').value.trim()||null,skills:[...skills]};
  if(body.user_id&&workers.some(x=>x.id!==id&&x.user_id===body.user_id))return alert('Этот аккаунт уже привязан к другому сотруднику');
  if(type==='day'&&!body.day_rate&&!confirm('Ставка за день не указана. Сохранить с нулём?'))return;
  try{if(id)await q(sb.from('workers').update(body).eq('id',id));else await q(sb.from('workers').insert({...body,workspace_id:currentWorkspace,sort:workers.length}));await loadSalary();renderCurrent();openWorkers();toast(active?'Сохранено':'Уволен — история осталась')}catch(e){salErr(e)}};
 $('wkSave').onclick=()=>save(id?w.active:true);
 if($('wkAct'))$('wkAct').onclick=()=>{if(w.active&&!confirm(`Уволить ${w.name}? Он пропадёт из списка дня, его недели и долги сохранятся.`))return;save(!w.active)};
}
openWorker=function(id){return openWorker57(id)};

/* ---------- Расценки ---------- */
let rtTab57='items';
function openRates57(){
 const items=catItems.filter(i=>!i.archived).map(i=>({i,ops:catOps.filter(o=>o.item_id===i.id).sort((a,b)=>(a.sort||0)-(b.sort||0))})).filter(x=>x.ops.length);
 const pieceN=catOps.filter(o=>o.pay_type==='piece').length,noN=noRateOps().length;
 const seg=`<div class="segBar seg3"><button class="${rtTab57==='items'?'on':''}" onclick="rtTab57='items';openRates57()">Изделия · ${items.length}</button><button class="${rtTab57==='wood'?'on':''}" onclick="rtTab57='wood';openRates57()">Дерево · ${workRates.filter(r=>r.kind==='wood').length}</button><button class="${rtTab57==='other'?'on':''}" onclick="rtTab57='other';openRates57()">Прочее · ${workRates.filter(r=>r.kind==='other').length}</button></div>`;
 let body='';
 if(rtTab57==='items'){
  const sub=x=>x.ops.map(o=>o.pay_type==='piece'?`${o.name} ${+o.rate>0?s57k(o.rate):'—'}`:`${o.name} по дню`).join(' · ');
  const bad=items.filter(x=>x.ops.some(o=>o.pay_type==='piece'&&!(+o.rate>0))),ok=items.filter(x=>!bad.includes(x));
  const row=x=>{const n=x.ops.filter(o=>o.pay_type==='piece'&&!(+o.rate>0)).length;return `<button class="s57row ${n?'warn':''}" onclick="openRateItem57('${x.i.id}')"><span class=s57tx><b>${esc(x.i.name)}</b><span>${esc(sub(x))}</span></span>${n?`<span class="s57badge r">${n} без цены</span>`:''}${s57chev}</button>`};
  body=`<div class=s57strip><div><b>${pieceN}</b><span>сдельных работ</span></div><div><b>${pieceN-noN}</b><span>с ценой</span></div><div><b class="${noN?'neg':''}">${noN}</b><span>без цены</span></div></div>
  ${bad.length?`<div class=s57og>Без цены</div><div class=s57list>${bad.map(row).join('')}</div>`:''}${ok.length?`<div class=s57og>С ценой</div><div class=s57list>${ok.map(row).join('')}</div>`:''}
  ${items.length?'':'<div class=empty>Нет изделий с работами — добавьте их в «Изделия»</div>'}
  <button class="btn secondary wide" onclick="ratesPct()">% Изменить все расценки</button>`;
 }else{
  const list=workRates.filter(r=>r.kind===rtTab57);
  body=`<div class=s57list>${list.map(r=>`<button class="s57row ${+r.rate>0?'':'warn'}" onclick="s57rateWr('${r.id}')"><span class=s57tx><b>${esc(r.name)}</b><span>за ${esc(r.unit||'шт')}</span></span><span class="s57price ${+r.rate>0?'':'no'}">${+r.rate>0?s57k(r.rate)+' ₽':'Указать цену'}</span></button>`).join('')||`<div class=empty>${rtTab57==='wood'?'Работ по дереву нет':'Пусто — например, уборка, ремонт, оснастка'}</div>`}</div>
  ${rtTab57==='other'?`<button class="btn secondary wide" onclick="newWorkRate()">+ Работа</button>`:''}`;
 }
 $('sheet').innerHTML=`<button class=close onclick="openRefs()" aria-label="Назад">×</button><h2>Расценки</h2><div class=summary>₽ за штуку сдельщикам. Новая цена пересчитывает текущую неделю, закрытые — нет.</div>${seg}${body}`;
 openModal();
}
function openRateItem57(iid){
 const i=catItems.find(x=>x.id===iid);if(!i)return;const ops=catOps.filter(o=>o.item_id===iid).sort((a,b)=>(a.sort||0)-(b.sort||0));
 $('sheet').innerHTML=`<button class=close onclick="openRates57()" aria-label="Назад">×</button><h2>${esc(i.name)}</h2><div class=summary>за 1 ${esc(i.unit||'шт')} · ${ops.length} ${plural(ops.length,'работа','работы','работ')}</div>
 <div class=s57list>${ops.map(o=>{const pc=o.pay_type==='piece',no=pc&&!(+o.rate>0),wk=projOps.filter(p=>p.catalog_op_id===o.id).map(p=>p.id),qn=pieces.filter(p=>wk.includes(p.project_op_id)&&p.work_date>=mondayOf(localISO())).reduce((s,p)=>s+(+p.qty||0),0);
  return `<div class="s57row ${no?'warn':''}"><span class=s57tx><b>${esc(o.name)}</b><span>${pc?'сдельно':'посуточно — идёт в табель днём'}${qn?` · на этой неделе ${num(qn,1)} шт`:''}</span></span>${pc?`<button class="s57price ${no?'no':''}" onclick="s57rateOp('${o.id}')">${no?'Указать цену':s57k(o.rate)+' ₽ ✎'}</button>`:'<span class="s57price day">по дню</span>'}</div>`}).join('')}</div>
 <button class="btn secondary wide" onclick="closeModal();openCatItem('${iid}')">Изменить работы изделия</button>
 <div class=small>Та же цена используется в табеле и в плане работ — одна на всё приложение.</div>`;
 openModal();
}
function priceSheet57({title,sub,val,unit,back,onSave}){
 $('sheet').innerHTML=`<button class=close onclick="${back}" aria-label="Назад">×</button><h2>${esc(title)}</h2><div class=summary>${sub}</div>
 <input id=s57pv class=s57money inputmode=decimal autocomplete=off value="${val>0?moneyText(val):''}" placeholder="0 ₽" aria-label="Цена за ${esc(unit)}">
 <div class=small>Текущая неделя пересчитается у всех. Закрытые недели не меняются.</div>
 <button class="btn wide" id=s57ps>Сохранить цену</button>`;
 openModal();const el=$('s57pv');el.oninput=e=>fmtMoneyInput(e.target);setTimeout(()=>{try{el.focus();el.select()}catch(e){}},60);
 $('s57ps').onclick=async()=>{const b=$('s57ps');if(b.disabled)return;b.disabled=true;b.textContent='Сохраняю…';try{await onSave(moneyVal(el.value));await loadProd();await loadSalary();renderCurrent();toast('Цена сохранена')}catch(e){b.disabled=false;b.textContent='Сохранить цену';failSave(e)}};
}
function s57rateOp(id){const o=catOps.find(x=>x.id===id),i=catItems.find(x=>x.id===o?.item_id);if(!o)return;
 priceSheet57({title:`${i?.name||''} — ${o.name}`,sub:`₽ за 1 ${esc(i?.unit||'шт')} · сейчас ${rub(o.rate)}`,val:+o.rate,unit:i?.unit||'шт',back:`openRateItem57('${o.item_id}')`,onSave:async v=>{await applyOpRate(id,v);setTimeout(()=>openRateItem57(o.item_id),0)}})}
function s57rateWr(id){const r=workRates.find(x=>x.id===id);if(!r)return;
 priceSheet57({title:r.name,sub:`₽ за 1 ${esc(r.unit||'шт')} · сейчас ${rub(r.rate)}`,val:+r.rate,unit:r.unit||'шт',back:'openRates57()',onSave:async v=>{await applyWorkRate(r,v);setTimeout(()=>openRates57(),0)}})}
