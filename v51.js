'use strict';
// v51: сводка «Сегодня», заполненность карточки, цех по изделиям (мастер), дерево по этапам, внутрицеховые,
// снабжение «Заказать / Заказано» с заявкой и объединением бруса, барабаны выбора, расценки, «Моя работа».
let metalDetOpen=false,shopWorkers=[],shopProg=[],opAssign=[],workRates=[],myWorker=null,mineWeek=null,reqState=null;
const canMark=()=>isOwner()||!!members.find(m=>m.user_id===currentUser?.id)?.is_master;
const shopDone=opId=>shopProg.filter(p=>p.project_op_id===opId).reduce((s,p)=>s+(+p.qty||0),0);
const opWorkers=opId=>opAssign.filter(a=>a.project_op_id===opId).map(a=>a.worker_id);
const swName=id=>shopWorkers.find(w=>w.id===id)?.name||workers.find(w=>w.id===id)?.name||'—';
const lsGet=(k,d)=>{try{return localStorage.getItem(k)??d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const STAGE_LBL={cut:'Нарезка',proc:'Обработка',paint:'Покраска'};

/* ---------- загрузка ---------- */
const _loadProd50=loadProd;
loadProd=async function(){
 await _loadProd50();
 const ws=currentWorkspace;if(!ws)return;
 try{
  const [a,b,c]=await Promise.all([sb.rpc('shop_workers',{wid:ws}),sb.rpc('shop_progress',{wid:ws}),fetchAll(()=>sb.from('op_assign').select('*').eq('workspace_id',ws).order('project_op_id'))]);
  shopWorkers=a.error?[]:(a.data||[]);shopProg=b.error?[]:(b.data||[]);opAssign=c.error?[]:(c.data||[]);
  if(isOwner()){const r=await sb.from('work_rates').select('*').eq('workspace_id',ws);workRates=(r.data||[]).sort((x,y)=>(x.sort||0)-(y.sort||0)||String(x.name).localeCompare(String(y.name),'ru'))}
  else{const r=await sb.rpc('my_pay',{wid:ws}),m=r.data||{};myWorker=m.worker||null;if(myWorker){workers=[myWorker];tdays=m.days||[];pieces=m.pieces||[];payouts=m.payouts||[];adjs=m.adjs||[];weekCloses=[]}}
 }catch(e){console.warn('v51 load',e)}
};
async function refreshShop(){
 const ws=currentWorkspace;
 const [b,c,d]=await Promise.all([sb.rpc('shop_progress',{wid:ws}),fetchAll(()=>sb.from('op_assign').select('*').eq('workspace_id',ws).order('project_op_id')),fetchAll(()=>sb.from('shop_parts').select('*').eq('workspace_id',ws).order('id'))]);
 if(!b.error)shopProg=b.data||[];if(!c.error)opAssign=c.data||[];if(!d.error)parts=d.data||[];
 if(isOwner()&&typeof loadSalary==='function')await loadSalary();
 renderCurrent();
}

/* ---------- барабаны выбора ---------- */
const wheelLayer=(()=>{const l=document.createElement('div');l.className='woodWheelLayer';l.id='genWheel';l.hidden=true;
 l.innerHTML='<section class="woodWheelPanel" role="dialog" aria-modal="true"><div class="woodWheelHead"><button type="button" class="wheelCancel">Отмена</button><b class=gwTitle></b><button type="button" class="wheelDone">Готово</button></div><div class="woodWheelColumns"></div></section>';
 document.body.append(l);return l})();
let wheelCur=null;
function openWheels(title,cols,onDone){
 const box=wheelLayer.querySelector('.woodWheelColumns');box.replaceChildren();wheelLayer.querySelector('.gwTitle').textContent=title;
 wheelCur={cols:[],onDone};
 cols.forEach((c,ci)=>{const wrap=document.createElement('div');wrap.className='woodWheelColumn';
  const lab=document.createElement('div');lab.className='woodWheelLabel';lab.textContent=c.label;
  const vp=document.createElement('div');vp.className='woodWheelViewport';const band=document.createElement('div');band.className='woodWheelCenter';
  const tr=document.createElement('div');tr.className='woodWheelTrack';tr.tabIndex=0;tr.setAttribute('role','listbox');tr.setAttribute('aria-label',c.label);
  const col={c,tr,idx:Math.max(0,c.items.findIndex(x=>String(x.v)===String(c.value))),opts:[]};
  c.items.forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.className='woodWheelNumber'+(String(it.t).length>6?' wheelText':'');b.textContent=it.t;b.setAttribute('role','option');b.onclick=()=>{tr.scrollTop=i*36;sync(col)};tr.append(b);col.opts.push(b)});
  tr.addEventListener('scroll',()=>sync(col),{passive:true});
  vp.append(band,tr);wrap.append(lab,vp);box.append(wrap);wheelCur.cols.push(col)});
 wheelLayer.hidden=false;
 requestAnimationFrame(()=>wheelCur&&wheelCur.cols.forEach(col=>{col.tr.scrollTop=col.idx*36;sync(col)}));
 function sync(col){col.idx=Math.max(0,Math.min(col.c.items.length-1,Math.round(col.tr.scrollTop/36)));col.opts.forEach((o,i)=>o.setAttribute('aria-selected',String(i===col.idx)))}
}
wheelLayer.querySelector('.wheelCancel').onclick=()=>{wheelLayer.hidden=true;wheelCur=null};
wheelLayer.querySelector('.wheelDone').onclick=()=>{const w=wheelCur;wheelLayer.hidden=true;wheelCur=null;if(w)w.onDone(w.cols.map(col=>col.c.items[col.idx]?.v))};
wheelLayer.onclick=e=>{if(e.target===wheelLayer){wheelLayer.hidden=true;wheelCur=null}};
function pickSlotWheel(matId){
 readCatForm();const m=catDraft.mats.find(x=>x.id===matId);if(!m)return;
 openWheels('Сечение бруса',[{label:'Сечение',value:m.wood_slot_id||'',items:[...woodSlots.map(s=>({v:s.id,t:s.nominal||s.name})),{v:'',t:'своё'}]}],([v])=>{const el=$('mws_'+matId);if(el)el.value=v||'';readCatForm();renderCatItem()});
}

/* ---------- Сегодня ---------- */
function renderToday(){
 const own=isOwner(),mine=t=>own||!t.responsibleId||t.responsibleId===currentUser?.id;
 const open=tasks.filter(t=>!t.done&&mine(t)).sort((a,b)=>taskKey(a)-taskKey(b)),soon=open.filter(t=>t.date&&days(t.date)<=7),later=open.length-soon.length;
 const act=data.filter(o=>o.status==='В работе'),hot=act.filter(o=>health(o).level>=3),due=act.filter(o=>o.date&&days(o.date)>=0&&days(o.date)<=7);
 const debts=own?data.filter(o=>o.status==='Выполнено'&&left(o)>0).sort((a,b)=>left(b)-left(a)):[];
 const prio=sortedObjects(act).slice(0,5);
 $('todaySummary').textContent=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
 let h=`<div class=kpi><button onclick="bucket='active';showView('objects')"><b>${act.length}</b><span>В работе</span></button><button class="${hot.length?'hot':''}" onclick="bucket='active';showView('objects')"><b>${hot.length}</b><span>Горят</span></button><button onclick="bucket='active';showView('objects')"><b>${due.length}</b><span>Сдача на неделе</span></button>${own?`<button onclick="bucket='debt';showView('objects')"><b>${debts.length}</b><span>Ждём оплату</span></button>`:`<button onclick="showView('tasks')"><b>${open.length}</b><span>Мои задачи</span></button>`}</div>`;
 h+=`<div class=section><div class=sectionTitle><b>🔥 Приоритет сегодня</b><button class=linkBtn style="padding:0" onclick="bucket='active';showView('objects')">все объекты ›</button></div>${prio.map(o=>{const hh=health(o),d=o.date?days(o.date):null,dt=d==null?'срок не указан':d<0?`просрочен ${-d} дн`:d===0?'сдача сегодня':d===1?'сдача завтра':`через ${d} дн`;return `<button class="prio ${hh.cls}" onclick="detail('${o.id}')"><span class="prT ${hh.cls}">${dt}</span><b>${esc(o.name)}</b><small>${o.stage>=7?'все этапы пройдены':esc(STAGES[o.stage])} · ${esc(hh.text)}</small></button>`}).join('')||'<div class=empty>Объектов в работе нет</div>'}</div>`;
 const gs=(()=>{try{return supplyGroups().filter(x=>x.order>0)}catch(e){return []}})();
 if(gs.length){const top=[...gs].sort((a,b)=>(b.cost||0)-(a.cost||0)).slice(0,4),tot=gs.reduce((s,x)=>s+(x.cost||0),0);
  h+=`<div class=section><div class=sectionTitle><b>🛒 Закупить</b><button class=linkBtn style="padding:0" onclick="supplyTab='order';showView('supply')">в снабжение ›</button></div><div class="info buyBox">${top.map(x=>{const s=supplyQty(x,'order');return `<div class=buy><span>${esc(x.name)} ${esc(x.size)}</span><b>${s.big}${own&&x.cost?' · '+rub(x.cost):''}</b></div>`}).join('')}${gs.length>top.length||(own&&tot)?`<div class="buy muted"><span>${gs.length>top.length?`ещё ${gs.length-top.length} ${plural(gs.length-top.length,'позиция','позиции','позиций')}`:''}</span><b>${own&&tot?'Итого '+rub(tot):''}</b></div>`:''}</div></div>`}
 h+=`<div class=section><div class=sectionTitle><b>${own?'Задачи на неделю':'Мои задачи на неделю'}</b><span>${soon.length}</span></div>${soon.map(t=>`<div class="focus ${taskHeat(t).cls}"><div class=frow><div><div class=ftitle>${esc(t.title)}</div><div class=fmeta>${esc(t.projectId?projName(t.projectId):t.shop?'Внутрицеховые':'Личная задача')} · ${taskHeat(t).text}</div></div><button class=doneBtn aria-label="Отметить выполненной" onclick="completeToday('${t.id}')">✓</button></div></div>`).join('')||'<div class=empty>На неделю задач нет</div>'}${later?`<button class=linkBtn onclick="showView('tasks')">Ещё ${later} — позже или без срока · все задачи</button>`:''}</div>`;
 if(own)h+=`<div class=section><div class=sectionTitle><b>Ждём оплату</b><span>${rub(debts.reduce((s,o)=>s+left(o),0))}</span></div>${debts.map(o=>`<button class=debtrow onclick="detail('${o.id}')"><div><b>${esc(o.name)}</b><br><span>${esc(o.contractor||'')}</span></div><strong>${rub(left(o))}</strong></button>`).join('')||'<div class=empty>Долгов по сданным объектам нет</div>'}</div>`;
 $('todayBody').innerHTML=h;
}

/* ---------- карточка: заполненность ---------- */
function fillList(o){const own=isOwner();return [['Название',!!o.name,1],['Заказчик',!!o.contractor,1],...(own?[['Сумма',+o.money>0,1]]:[]),['Дата начала',!!o.startDate,1],['Дата сдачи',!!o.date,1],['Спецификация',specLines.some(l=>l.project_id===o.id),0],...(own?[['Аванс',(o.payments||[]).length>0,0]]:[])]}
function fillHtml(o){const r=fillList(o),n=r.filter(x=>x[1]).length,mr=r.filter(x=>x[2]&&!x[1]).map(x=>x[0]),mw=r.filter(x=>!x[2]&&!x[1]).map(x=>x[0]);
 return `<div class=fillBox id=fillBox><div class=fillTop><b>Заполнено ${n} из ${r.length}</b><div class=bar><i style="width:${n/r.length*100}%"></i></div></div>${mr.length?`<div class=fillMiss><span class=fR>▌</span>Не заполнено: ${mr.map(esc).join(', ')}</div>`:''}${mw.length?`<div class=fillMiss><span class=fW>▌</span>Желательно: ${mw.map(esc).join(', ')}</div>`:''}</div>`}
function updateFill(o){const el=$('fillBox');if(el)el.outerHTML=fillHtml(o);document.querySelectorAll('#sheet .fReq').forEach(l=>{const i=l.querySelector('input');if(i)l.classList.toggle('fEmpty',i.inputMode==='decimal'?!moneyVal(i.value):!i.value.trim())})}

/* ---------- Цех ---------- */
const SHOP_TABS=()=>[...(isOwner()?[]:[['mine','👷 Моя работа']]),['metal','⚙ Металл'],['wood','🪵 Дерево'],['shop','🏭 Внутрицеховые']];
function metalLines(){const act=activeProjects(),ids=new Set(act.map(o=>o.id)),ord=new Map(act.map((o,i)=>[o.id,i])),cs=id=>catOps.find(c=>c.id===id)?.sort??99;
 return specLines.filter(l=>ids.has(l.project_id)).sort((a,b)=>ord.get(a.project_id)-ord.get(b.project_id)||(a.sort||0)-(b.sort||0)).map(l=>({l,ops:projOps.filter(o=>o.spec_line_id===l.id&&o.pay_type==='piece'&&+o.qty_plan>0&&!/дерев|брус/i.test(o.name)).sort((a,b)=>cs(a.catalog_op_id)-cs(b.catalog_op_id))})).filter(x=>x.ops.length)}
function renderShop(){
 const own=isOwner(),tabs=SHOP_TABS();if(!own&&!renderShop._emp){renderShop._emp=1;if(shopKind==='wood')shopKind='mine'}if(!tabs.some(t=>t[0]===shopKind))shopKind=own?'metal':'mine';
 const act=new Set(activeProjects().map(o=>o.id));
 const cnt={metal:metalLines().reduce((s,x)=>s+x.ops.filter(o=>shopDone(o.id)<o.qty_plan).length,0),wood:parts.filter(p=>p.kind==='wood'&&act.has(p.project_id)&&(+p.paint_qty||0)<+p.qty).length,shop:tasks.filter(t=>t.shop&&!t.done).length+parts.filter(p=>!p.project_id&&['order','ordered'].includes(p.status)).length};
 let h=`<div class="segBar seg4">${tabs.map(([k,l])=>`<button class="${shopKind===k?'on':''}" onclick="shopKind='${k}';renderShop()">${l}${cnt[k]?` · ${cnt[k]}`:''}</button>`).join('')}</div>`;
 if(prodError)h+=`<div class=empty>Цех не загрузился: ${esc(prodError)}</div>`;
 h+=shopKind==='mine'?mineHtml():shopKind==='wood'?woodShopHtml():shopKind==='shop'?inShopHtml():metalShopHtml();
 $('woodBody').innerHTML=h;bindPartLong($('woodBody'));
}
function metalShopHtml(){
 const cm=canMark(),ls=metalLines(),weld=new Map();
 ls.forEach(({ops})=>ops.filter(o=>/свар/i.test(o.name)).forEach(o=>{const left=Math.max(0,o.qty_plan-shopDone(o.id));if(left>0)weld.set(o.item_name,(weld.get(o.item_name)||0)+left)}));
 let h=weld.size?`<div class=res>Под сварку: <b>${[...weld].map(([n,k])=>esc(n)+' — '+num(k)).join(' · ')}</b></div>`:'';
 h+=ls.map(({l,ops})=>{const u=itemUnit(l.item_id);return `<div class=prod><button class=prodHead onclick="openLineParts('${l.id}')"><b>${esc(l.item_name)}</b><span>${num(l.qty)} ${esc(u)} ›</span></button><small>${esc(projName(l.project_id))}</small>
  ${ops.map(o=>{const d=shopDone(o.id),ws=opWorkers(o.id),pct=Math.min(100,d/o.qty_plan*100);return `<div class=opRow><div class=opTop><span>${esc(o.name)}</span>${cm?`<button type=button class="opCnt ${d>=o.qty_plan?'pos':''}" onclick="openOpMark('${o.id}')" aria-label="Отметить сколько сделано">${num(d)} / ${num(o.qty_plan)} ✎</button>`:`<b class="${d>=o.qty_plan?'pos':''}">${num(d)} / ${num(o.qty_plan)}</b>`}</div><div class=bar><i style="width:${pct}%"></i></div><div class=who><span class=whoL>${ws.length?ws.map(w=>`<button class=chip onclick="${cm?`openAssign('${o.id}')`:''}">👷 ${esc(swName(w))}</button>`).join(''):cm?`<button class="chip no" onclick="openAssign('${o.id}')">Не назначен — тап</button>`:'<span class="chip no">не назначен</span>'}</span>${cm?`<span class=pm><button aria-label="Минус 1" onclick="opMark('${o.id}',-1)">−</button><button aria-label="Плюс 1" onclick="opMark('${o.id}',1)">+</button></span>`:''}</div></div>`}).join('')}</div>`}).join('')||(prodError?'':`<div class=empty>Изделий под сварку нет.<br>Они появятся из спецификации объекта (карточка объекта → «+ Изделие из справочника»).</div>`);
 const act=new Set(activeProjects().map(o=>o.id)),man=parts.filter(p=>act.has(p.project_id)&&p.kind!=='wood'),projs=activeProjects().filter(o=>man.some(p=>p.project_id===o.id));
 if(man.length)h+=`<details class=section ${metalDetOpen?'open':''} ontoggle="metalDetOpen=this.open"><summary class=sectionTitle><b>Детали металла и метизы по объектам</b><span>${man.length}</span></summary>${projs.map(o=>`<div class=small style="margin:8px 2px 4px"><b>${esc(o.name)}</b></div><div class=partList>${man.filter(p=>p.project_id===o.id).sort((a,b)=>String(a.note).localeCompare(String(b.note),'ru')||a.name.localeCompare(b.name,'ru')).map(partRowHtml).join('')}</div>`).join('')}<div class=small>Тап по статусу — дальше, долгий тап — назад.</div></details>`;
 h+=`<button class="btn secondary wide" style="margin-top:10px" onclick="shopKind='metal';openPart()">+ Деталь вручную</button>`;
 if(cm)h+=`<div class=small style="margin-top:8px">Тап по счётчику «6 / 10 ✎» — сразу сколько штук и кто; + / − — по одной. Всё идёт в табель по расценке. Тап по имени — сменить исполнителя.</div>`;
 return h;
}
function openLineParts(lineId){
 const l=specLines.find(x=>x.id===lineId);if(!l)return;const ps=parts.filter(p=>p.spec_line_id===lineId);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(l.item_name)}</h2><div class=summary>${esc(projName(l.project_id))} · ${num(l.qty)} ${esc(itemUnit(l.item_id))}</div><div class=label>Детали</div><div class=partList>${ps.map(partRowHtml).join('')||'<div class=small>Деталей нет</div>'}</div><div class=small style="margin-top:6px">Тап по статусу — дальше, долгий тап — назад.</div><button class="btn secondary wide" style="margin-top:10px" onclick="closeModal();detail('${l.project_id}')">Карточка объекта</button>`;
 openModal();bindPartLong($('sheet'));
}
function pickWorker(ids,title,cb){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(title)}</h2>${ids.map(id=>`<button class=catRow data-w="${id}"><b>👷 ${esc(swName(id))}</b></button>`).join('')}`;
 openModal();$('sheet').querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{closeModal();cb(b.dataset.w)});
}
function openAssign(opId,thenMark){
 const o=projOps.find(x=>x.id===opId);if(!o)return;const cur=new Set(opWorkers(opId));
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(o.item_name)} · ${num(o.qty_plan)}</h2><div class=summary>${esc(projName(o.project_id))} · ${esc(o.name)} — кто делает?</div>
 ${shopWorkers.length?shopWorkers.map(w=>{const busy=opAssign.filter(a=>a.worker_id===w.id&&a.project_op_id!==opId).map(a=>projOps.find(x=>x.id===a.project_op_id)).filter(Boolean).filter(x=>shopDone(x.id)<x.qty_plan);return `<label class="wr2 ${cur.has(w.id)?'on':''}"><input type=checkbox value="${w.id}" ${cur.has(w.id)?'checked':''}><div><b>${esc(w.name)}</b><small>${busy.length?'сейчас: '+busy.slice(0,2).map(x=>esc(x.item_name)).join(', '):'свободен'}</small></div></label>`}).join(''):'<div class=empty>Сотрудников нет. Владелец добавляет их в «Деньги → Зарплата → Сотрудники».</div>'}
 <div class=small>Можно выбрать нескольких — при «+» спросим, кто сделал.</div>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=asSave>Сохранить</button></div>`;
 openModal();$('sheet').querySelectorAll('.wr2 input').forEach(i=>i.onchange=()=>i.closest('.wr2').classList.toggle('on',i.checked));
 $('asSave').onclick=async()=>{const b=$('asSave');if(b.disabled)return;const ids=[...$('sheet').querySelectorAll('.wr2 input:checked')].map(i=>i.value);b.disabled=true;
  try{const {error}=await sb.rpc('shop_assign',{p_op:opId,p_workers:ids});if(error)throw error;closeModal();await refreshShop();toast(ids.length?'Назначено: '+ids.map(swName).join(', '):'Исполнитель снят');if(thenMark&&ids.length===1)opMark(opId,1,ids[0])}catch(e){b.disabled=false;alert('Не удалось: '+(e.message||e))}};
}
const markBusy={};
async function opMark(opId,d,wid){
 const o=projOps.find(x=>x.id===opId);if(!o)return;
 if(!wid){let ws=opWorkers(opId);
  if(d<0){ws=[...new Set(shopProg.filter(p=>p.project_op_id===opId&&+p.qty>0).map(p=>p.worker_id))];if(!ws.length)return toast('Отменять нечего')}
  else if(!ws.length)return openAssign(opId,true);
  if(ws.length>1)return pickWorker(ws,`${o.item_name}: ${d>0?'кто сделал +1?':'у кого снять 1?'}`,w=>opMark(opId,d,w));
  wid=ws[0]}
 if(markBusy[opId]&&Date.now()-markBusy[opId]<500)return;markBusy[opId]=Date.now();
 try{const {data:n,error}=await sb.rpc('shop_mark',{p_op:opId,p_worker:wid,p_delta:d});if(error)throw error;await refreshShop();
  toast(`${o.item_name} — ${o.name}: ${num(n)} из ${num(o.qty_plan)} · ${swName(wid)} ${d>0?'+':''}${num(d)}`,async()=>{const r=await sb.rpc('shop_mark',{p_op:opId,p_worker:wid,p_delta:-d});if(r.error)alert(r.error.message);await refreshShop()})}
 catch(e){alert(e.message||e)}
}
// статусы деталей: тап — дальше по кругу, долгий тап — назад
function bindPartLong(root){if(!root)return;root.querySelectorAll('button.st[onclick^="partNext"]').forEach(b=>{let t=null;const id=(b.getAttribute('onclick').match(/'([^']+)'/)||[])[1];
 b.onpointerdown=()=>{b._lp=false;clearTimeout(t);t=setTimeout(()=>{b._lp=true;partPrev(id)},550)};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>clearTimeout(t);b.oncontextmenu=e=>e.preventDefault();
 b.onclick=e=>{e.preventDefault();if(b._lp){b._lp=false;return}partNext(id)}})}
async function partStep(id,dir){
 const p=parts.find(x=>x.id===id);if(!p)return;if(partBusy[id]&&Date.now()-partBusy[id]<600)return;partBusy[id]=Date.now();
 const i=PART_STATUS.indexOf(p.status),next=PART_STATUS[(i+dir+PART_STATUS.length)%PART_STATUS.length],prev=p.status;
 p.status=next;renderCurrent();if($('modal').classList.contains('on'))bindPartLong($('sheet'));
 const upd=s=>({status:s,updated_at:new Date().toISOString(),...(s==='ordered'&&!p.ordered_on?{ordered_on:localISO()}:{}),...(s==='stock'&&prev==='ordered'?{arrived_on:localISO()}:{})});
 try{await q(sb.from('shop_parts').update(upd(next)).eq('id',id));
  toast(`${p.name} ${p.size||''}: ${PART_LABEL[next]}`,async()=>{p.status=prev;renderCurrent();try{await q(sb.from('shop_parts').update({status:prev}).eq('id',id))}catch(e){failSave(e)}})}
 catch(e){p.status=prev;renderCurrent();failSave(e)}
}
partNext=id=>partStep(id,1);
function partPrev(id){return partStep(id,-1)}

/* дерево: бруски по объектам, этапы нарезка → обработка → покраска */
function woodShopHtml(){
 const act=activeProjects(),ids=new Set(act.map(o=>o.id)),ps=parts.filter(p=>p.kind==='wood'&&ids.has(p.project_id));
 const left=k=>ps.reduce((s,p)=>s+Math.max(0,(+p.qty||0)-(+p[k+'_qty']||0)),0);
 let h=ps.length?`<div class=res>Под покраску: <b>${num(left('paint'))} ${plural(left('paint'),'брусок','бруска','брусков')}</b> · обработать ${num(left('proc'))} · нарезать ${num(left('cut'))}</div>`:'';
 h+=act.filter(o=>ps.some(p=>p.project_id===o.id)).map(o=>`<div class=sectionTitle><b>${esc(o.name)}</b><span>покрашено ${num(ps.filter(p=>p.project_id===o.id).reduce((s,p)=>s+(+p.paint_qty||0),0))} из ${num(ps.filter(p=>p.project_id===o.id).reduce((s,p)=>s+(+p.qty||0),0))}</span></div>${ps.filter(p=>p.project_id===o.id).sort((a,b)=>String(a.size).localeCompare(String(b.size),'ru')||(a.length_mm||0)-(b.length_mm||0)).map(woodRowHtml).join('')}`).join('')||'<div class=empty>Дерева в работе нет.<br>Бруски появятся из спецификации объекта или из заявки.</div>';
 h+=`<div class=small style="margin-top:8px">Тап по этапу — отметить партию («+40»). Записанное можно отменить.</div>`;
 return h;
}
function woodRowHtml(p){const qn=+p.qty||0;return `<div class=prod><div class=h1><span>${esc(p.name)} ${esc(sizeShow(p.size)||'')}${p.length_mm?' × '+num(p.length_mm,0):''}</span><span>${num(qn)} шт</span></div><small>${p.source==='auto'&&p.note?esc(p.note)+' · ':''}<span class="st st_${p.status}" style="font-size:11px;padding:1px 6px">${PART_LABEL[p.status]}</span></small>
 <div class=wst>${['cut','proc','paint'].map(k=>{const v=+p[k+'_qty']||0;return `<button class="${v>=qn&&qn?'dn':v>0?'on':''}" onclick="openWoodStage('${p.id}','${k}')">${STAGE_LBL[k]}<b>${v>=qn&&qn?num(qn)+' ✓':num(v)+'/'+num(qn)}</b></button>`}).join('')}</div></div>`}
function openWoodStage(id,st){
 const p=parts.find(x=>x.id===id);if(!p)return;const qn=+p.qty||0,v=+p[st+'_qty']||0,rest=Math.max(0,qn-v),cm=canMark();
 const lastW=lsGet('woodW_'+st,'');
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${STAGE_LBL[st]} · ${esc(p.name)} ${esc(sizeShow(p.size)||'')}${p.length_mm?' × '+num(p.length_mm,0):''}</h2><div class=summary>${esc(projName(p.project_id))} · сделано <b>${num(v)} из ${num(qn)}</b></div>
 ${cm?`<label class=field>Кто делал (запишется в табель по расценке)<select id=wsW><option value="">— без записи в табель —</option>${shopWorkers.map(w=>`<option value="${w.id}" ${w.id===lastW?'selected':''}>${esc(w.name)}</option>`).join('')}</select></label>
 <div class=label>Сколько штук</div><div class=chipRow id=wsQuick>${[10,20,50].filter(n=>n<rest).map(n=>`<button type=button class=chip data-n=${n}>+${n}</button>`).join('')}${rest?`<button type=button class=chip data-n=${rest}>всё · +${num(rest)}</button>`:''}</div>
 <input id=wsN inputmode=decimal value="${rest?Math.min(rest,10):''}" aria-label="Количество" style="margin-top:6px">
 <div class=actions><button class="btn secondary" id=wsMinus ${v?'':'disabled'}>− Снять</button><button class=btn id=wsPlus ${rest?'':'disabled'}>+ Записать</button></div>`:'<div class=info>Отмечает мастер или владелец.</div>'}`;
 openModal();if(!cm)return;
 $('wsQuick').onclick=e=>{const b=e.target.closest('[data-n]');if(b)$('wsN').value=num(+b.dataset.n)};
 const go=async(sign,b)=>{if(b.disabled)return;const n=qtyVal($('wsN').value);if(!n)return alert('Укажите количество');const w=$('wsW').value||null;lsSet('woodW_'+st,w||'');b.disabled=true;
  const d=sign*n;try{const {error}=await sb.rpc('wood_mark',{p_part:id,p_stage:st,p_delta:d,p_worker:w});if(error)throw error;closeModal();await refreshShop();
   toast(`${STAGE_LBL[st]}: ${d>0?'+':'−'}${num(n)} · ${p.name} ${sizeShow(p.size)||''}`,async()=>{const r=await sb.rpc('wood_mark',{p_part:id,p_stage:st,p_delta:-d,p_worker:d<0?w:null});if(r.error)alert(r.error.message);await refreshShop()})}
  catch(e){b.disabled=false;alert(e.message||e)}};
 $('wsPlus').onclick=e=>go(1,e.target);$('wsMinus').onclick=e=>go(-1,e.target);
}

/* внутрицеховые: задачи цеха + заявки без объекта */
function inShopHtml(){
 const tdy=localISO(),ts=tasks.filter(t=>t.shop&&(!t.done||doneToday(t))).sort((a,b)=>(a.done-b.done)||taskKey(a)-taskKey(b));
 const rq=parts.filter(p=>!p.project_id&&(p.status==='order'||p.status==='ordered'||(p.status==='stock'&&p.arrived_on===tdy)));
 let h=`<div class=sectionTitle><b>Работы по цеху</b><span>${ts.filter(t=>!t.done).length}</span></div>${ts.map(t=>`<div class="tk ${t.done?'done':''}"><input class=check type=checkbox ${t.done?'checked':''} onchange="toggleTask('${t.id}')" aria-label="Выполнено"><div><b>${esc(t.title)}</b>${t.responsibleId||t.date?`<small>${t.responsibleId?esc(memberName(t.responsibleId)):''}${t.date?' · '+fmt(t.date):''}</small>`:''}</div>${isOwner()?`<button class=edDel aria-label="Удалить" onclick="deleteTask('${t.id}')">×</button>`:''}</div>`).join('')||'<div class=small>Нет работ — ремонт, оснастка, уборка…</div>'}`;
 h+=`<div class=sectionTitle style="margin-top:14px"><b>Расходники и материалы для цеха</b><span>${rq.filter(p=>p.status!=='stock').length}</span></div>${rq.map(p=>`<div class="partRow ${p.status==='stock'?'struck':''}"><button class=partMain onclick="openPart('${p.id}')"><b>${esc(p.name)} ${esc(p.size||'')}</b><span>${partLine(p)}${p.note?' · '+esc(p.note):''}</span></button><span class="st st_${p.status}">${p.status==='stock'?'Пришло':PART_LABEL[p.status]}</span></div>`).join('')||'<div class=small>Заявок без объекта нет. Диски, электроды, газ — через «+ Заявка».</div>'}`;
 h+=`<div class=inlineRow style="margin-top:12px"><button class="btn secondary" onclick="openShopTask()">+ Работа по цеху</button><button class=btn onclick="openRequest('')">+ Заявка</button></div>`;
 return h;
}
function openShopTask(){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Работа по цеху</h2><label class=field>Что сделать *<input id=stT placeholder="Например: починить вытяжку в покрасочной"></label><label class=field>Кто<select id=stR><option value="">Не назначен</option>${members.map(m=>`<option value="${esc(m.user_id)}">${esc(m.display_name||m.email||'Сотрудник')}</option>`).join('')}</select></label><label class=field>Срок<input id=stD type=date></label><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=stSave>Добавить</button></div>`;
 openModal();setTimeout(()=>$('stT')?.focus(),50);
 $('stSave').onclick=async()=>{const b=$('stSave');if(b.disabled)return;const title=$('stT').value.trim();if(!title)return alert('Напишите, что сделать');b.disabled=true;
  try{await serverTaskUpsert({id:null,title,projectId:null,date:$('stD').value||'',createdAt:localISO(),done:false,responsibleId:$('stR').value||null,shop:true},true);await loadServer();closeModal();toast('Добавлено во внутрицеховые')}catch(e){b.disabled=false;alert('Не удалось: '+(e.message||e))}};
}

/* моя работа (сотрудник): своя зарплата за неделю и что назначено */
function mineHtml(){
 if(!myWorker)return `<div class=info>Ваш аккаунт ещё не привязан к сотруднику в табеле.<br><span class=small>Попросите владельца: «Деньги → Зарплата → Сотрудники → Аккаунт в приложении».</span></div>`;
 if(!mineWeek)mineWeek=mondayOf(localISO());const ws=mineWeek,end=addDays(ws,6),r=weekRows(ws).find(x=>x.w.id===myWorker.id)||{prev:balanceBefore(myWorker.id,ws),a:accrual(myWorker.id,ws,end)};const a=r.a,bal=r.bal??(r.prev+accTotal(a)+a.adj-a.paid);
 const line=(l,v,c='')=>`<div class=kvRow><span>${l}</span><b class="${c}">${v}</b></div>`;
 let h=`<div class=weekNav><button class=chip onclick="mineWeek=addDays(mineWeek,-7);renderShop()" aria-label="Прошлая неделя">‹</button><b>${weekLabel(ws)}</b><button class=chip onclick="mineWeek=addDays(mineWeek,7);renderShop()" aria-label="Следующая неделя">›</button></div>
 <div class=info>${Math.abs(r.prev)>0.004?line('Остаток с прошлой недели',(r.prev>0?'':'')+rub(r.prev),r.prev<0?'neg':''):''}${a.days?line(`Деньщина · ${num(a.days,1)} ${plural(Math.ceil(a.days),'день','дня','дней')}`,rub(a.dayRub)):''}${a.ot?line(`Переработка · ${num(a.ot,1)} ч`,rub(a.otRub)):''}${a.pieceN?line(`Сдельщина · ${a.pieceN} ${plural(a.pieceN,'запись','записи','записей')}`,rub(a.piece)):''}${a.adj?line('Премии и удержания',(a.adj>0?'+':'')+rub(a.adj),a.adj<0?'neg':''):''}${a.paid?line('Выдано','−'+rub(a.paid),'neg'):''}
 <div class="kvRow mineBig"><span>${bal>=-0.004?'К выдаче':'Переплата'}</span><b class="${bal>=-0.004?'pos':'neg'}">${rub(Math.abs(bal))}</b></div></div>`;
 const rows=[];weekDates(ws).forEach((d,i)=>{tdays.filter(t=>t.worker_id===myWorker.id&&t.work_date===d).forEach(t=>rows.push(`<div class=mw><div class=r2><span><b>${DOW[i]}</b> · ${+t.mark===1?'день':'полдня'}</span><b>${rub(dayAmount(t))}</b></div><small>${t.project_id?esc(projName(t.project_id)):'Цех'}${+t.ot_hours?` · переработка ${num(t.ot_hours,1)} ч`:''}</small></div>`));
  pieces.filter(p=>p.worker_id===myWorker.id&&p.work_date===d).forEach(p=>rows.push(`<div class=mw><div class=r2><span><b>${DOW[i]}</b> · сдельно</span><b>${rub(p.amount)}</b></div><small>${esc(p.title)}${p.kind!=='other'?` · ${num(p.qty)} шт × ${rub(p.rate)}`:''}</small></div>`))});
 h+=`<div class=label style="margin-top:10px">По дням</div>${rows.join('')||'<div class=small>На этой неделе записей нет</div>'}`;
 const mine=opAssign.filter(x=>x.worker_id===myWorker.id).map(x=>projOps.find(o=>o.id===x.project_op_id)).filter(o=>o&&activeProjects().some(p=>p.id===o.project_id));
 h+=`<div class=label style="margin-top:10px">Назначено мне</div>${mine.map(o=>{const d=shopProg.filter(p=>p.project_op_id===o.id&&p.worker_id===myWorker.id).reduce((s,p)=>s+(+p.qty||0),0),all=shopDone(o.id);return `<div class=mw><div class=r2><span><b>${esc(o.item_name)}</b> · ${esc(o.name)}</span><b>${num(all)} из ${num(o.qty_plan)}${all>=o.qty_plan?' ✓':''}</b></div><small>${esc(projName(o.project_id))}${d?` · мной ${num(d)}`:''}</small></div>`}).join('')||'<div class=small>Пока ничего не назначено</div>'}`;
 return h;
}

/* ---------- Снабжение ---------- */
const mergeTol=()=>{const v=+(typeof wsSettings!=='undefined'&&wsSettings.wood_merge_mm);return typeof wsSettings!=='undefined'&&wsSettings.wood_merge_mm!=null&&isFinite(v)&&v>=0&&v<=20?v:2};
const _supplyGroups50=supplyGroups;
supplyGroups=function(){
 const gs=_supplyGroups50(),tol=mergeTol(),dims=x=>normSize(x.size).split('×').map(Number).filter(n=>n>0).sort((a,b)=>a-b),base=x=>String(x.name).toLowerCase().replace(/[\d×x*.,]+/g,'').trim();
 const out=[],cl=[];
 for(const x of gs){if(x.kind!=='wood'||!x.linear){out.push(x);continue}
  const d=dims(x);if(d.length<2){out.push(x);continue}
  const c=cl.find(c=>c.base===base(x)&&c.d.length===d.length&&c.d.every((v,i)=>Math.abs(v-d[i])<=tol));
  if(!c){x.mergedSizes=[x.size];cl.push({base:base(x),d,x});out.push(x);continue}
  const m=c.x;['need','have','ordered','order','arrived','vol'].forEach(k=>m[k]=(+m[k]||0)+(+x[k]||0));m.parts=m.parts.concat(x.parts);x.suppliers.forEach(s=>m.suppliers.add(s));
  if(x.orderedOn&&(!m.orderedOn||x.orderedOn<m.orderedOn))m.orderedOn=x.orderedOn;if(x.cost!=null||m.cost!=null)m.cost=(+m.cost||0)+(+x.cost||0);
  if(!m.mergedSizes.includes(x.size))m.mergedSizes.push(x.size);if(d.reduce((s,v)=>s+v,0)>c.d.reduce((s,v)=>s+v,0)){c.d=d;m.size=x.size}m.key+='+'+x.key;
 }
 return out;
};
function renderSupply(){
 const tab=supplyTab==='ordered'?'ordered':'order',gs=supplyGroups(),list=gs.filter(x=>tab==='order'?x.order>0:(x.ordered>0||x.arrived>0)),nO=gs.filter(x=>x.order>0).length,nD=gs.filter(x=>x.ordered>0).length,own=isOwner();
 let h=`<div class=segBar><button class="${tab==='order'?'on':''}" onclick="supplyTab='order';renderSupply()">Заказать · ${nO}</button><button class="${tab==='ordered'?'on':''}" onclick="supplyTab='ordered';renderSupply()">Заказано · ${nD}</button></div>`;
 if(prodError)h+=`<div class=empty>Не загрузилось: ${esc(prodError)}</div>`;
 let last='';
 h+=list.map(x=>{const s=supplyQty(x,tab==='order'?'order':'ordered'),head=x.kind!==last?`<div class=sectionTitle><b>${KIND_ICON[x.kind]} ${KIND_NAME[x.kind]}</b></div>`:'';last=x.kind;
  const struck=tab==='ordered'&&!(x.ordered>0)&&x.arrived>0,on=tab==='ordered'&&struck;
  const where=[...new Set(x.parts.filter(p=>tab==='order'?p.status==='order':p.status==='ordered'||(p.status==='stock'&&p.arrived_on===localISO())).map(p=>projName(p.project_id)))];
  const big=struck?`${num(x.arrived,x.sheet?2:1)} ${x.unit}`:s.big;
  return head+`<div class="supRow2 ${struck?'struck':''}"><button class="cb ${on?'on':''}" onclick="supCheck('${esc(x.key)}')" aria-label="${tab==='order'?'Отметить заказанным':struck?'Снять отметку «пришло»':'Отметить: пришло'}">${on?'✓':''}</button><button class=supMain onclick="openSupplyGroup('${esc(x.key)}')"><div><b>${esc(x.name)} ${esc(x.size)}</b><span>${esc(where.join(' · '))}${tab==='ordered'&&!struck?` · ${[...x.suppliers].map(esc).join(', ')||'поставщик не указан'}${x.orderedOn?` · ${fmt(x.orderedOn)}`:''}`:''}${struck?' · пришло сегодня':''}</span>${x.mergedSizes&&x.mergedSizes.length>1?`<span class=merge>⇄ объединено: ${x.mergedSizes.map(esc).join(' + ')} → заказ ${esc(x.size)}</span>`:''}</div><div class=supBig>${big}${s.sub&&!struck?`<small>${s.sub}</small>`:''}</div></button>${tab==='ordered'&&!struck?`<button class=supBack onclick="supBack('${esc(x.key)}')" aria-label="Вернуть в «Заказать»" title="Вернуть в «Заказать»">↩</button>`:''}</div>`}).join('')||(prodError?'':`<div class=empty>${tab==='order'?'Заказывать нечего 👍<br>Позиции появятся из спецификаций объектов или через «+ Заявка».':'Нет заказанного, которое ждём'}</div>`);
 const tot=list.reduce((s,x)=>s+(tab==='order'&&x.cost?x.cost:0),0);if(tot)h+=`<div class=info><div class=kvRow><span><b>К заказу по прайсу</b></span><b>${rub(tot)}</b></div><div class=small>по позициям с ценой; целые хлысты и листы</div></div>`;
 h+=`<div class=small style="margin:6px 2px">${tab==='order'?'Галочка — заказано (уйдёт во вкладку «Заказано»).':'Галочка — пришло: строка зачеркнётся и завтра уйдёт в архив. ↩ — вернуть в «Заказать».'} Брус с сечением в пределах ${num(mergeTol())} мм объединяется${own?` · <button class=linkBtn style="padding:0" onclick="setMergeTol()">изменить допуск</button>`:''}.</div>`;
 if(tab==='order'&&nO)h+=`<div class=stickyActions><button class="btn secondary" onclick="openSupplyText()">Заявка текстом</button><button class=btn onclick="orderAll()">Всё заказано ✓</button></div>`;
 h+=`<button class=fab onclick="openRequest('')">+ Заявка</button>`;
 $('supplyBody').innerHTML=h;
}
async function setMergeTol(){const v=prompt('Объединять брус к заказу, если сечение отличается не больше чем на, мм:',String(mergeTol()));if(v===null)return;const n=+String(v).replace(',','.');if(!(n>=0&&n<=20))return alert('От 0 до 20 мм');try{await saveSettings({wood_merge_mm:n});renderSupply();toast('Допуск: '+num(n)+' мм')}catch(e){failSave(e)}}
async function supSet(arr,patch,msg,undoPatch){
 try{for(const p of arr)await q(sb.from('shop_parts').update({...patch(p),updated_at:new Date().toISOString()}).eq('id',p.id));await refreshShop();
  toast(msg,async()=>{try{for(const p of arr)await q(sb.from('shop_parts').update(undoPatch(p)).eq('id',p.id));await refreshShop()}catch(e){failSave(e)}})}catch(e){failSave(e)}}
const supBusy={};
async function supCheck(key){
 if(supBusy[key]&&Date.now()-supBusy[key]<700)return;supBusy[key]=Date.now();
 const x=supplyGroups().find(g=>g.key===key);if(!x)return;const tdy=localISO();
 if(supplyTab!=='ordered'){const arr=x.parts.filter(p=>p.status==='order');if(!arr.length)return;
  return supSet(arr,()=>({status:'ordered',ordered_on:tdy}),`${x.name} ${x.size}: заказано`,p=>({status:'order',ordered_on:p.ordered_on||null}))}
 if(x.ordered>0){const arr=x.parts.filter(p=>p.status==='ordered');return supSet(arr,()=>({status:'stock',arrived_on:tdy}),`${x.name} ${x.size}: пришло`,p=>({status:'ordered',arrived_on:null}))}
 const arr=x.parts.filter(p=>p.status==='stock'&&p.arrived_on===tdy);if(arr.length)return supSet(arr,()=>({status:'ordered',arrived_on:null}),`${x.name} ${x.size}: снова ждём`,()=>({status:'stock',arrived_on:tdy}));
}
async function supBack(key){const x=supplyGroups().find(g=>g.key===key);if(!x)return;const arr=x.parts.filter(p=>p.status==='ordered');if(!arr.length)return;
 return supSet(arr,()=>({status:'order'}),`${x.name} ${x.size}: вернули в «Заказать»`,p=>({status:'ordered',ordered_on:p.ordered_on}))}

/* заявка без карточки объекта */
const WOOD_LENS=[1000,1200,1500,1800,2000,2500,3000,4000,5000,6000];
function openRequest(pid){
 const lastSlot=lsGet('reqSlot',''),lastSp=lsGet('reqSp','');
 reqState={pid:pid||'',kind:typeof woodSlots!=='undefined'&&woodSlots.length?'wood':'other',slot:woodSlots.find(s=>s.id===lastSlot)?.id||woodSlots[0]?.id||'',sp:woodSpecies.find(s=>s.id===lastSp)?.id||woodSpecies[0]?.id||'',len:+lsGet('reqLen',1500)||1500,qty:'',name:'',size:'',unit:'шт',munit:'хлыст',price:null,note:''};
 drawRequest();openModal();
}
function reqRead(){const r=reqState;if(!r||!$('rqQty'))return;r.qty=$('rqQty').value;r.note=$('rqNote').value;r.pid=$('rqProj').value;if($('rqName'))r.name=$('rqName').value;if($('rqSize'))r.size=$('rqSize').value;if($('rqUnit'))r.unit=$('rqUnit').value}
function drawRequest(){
 const r=reqState,own=isOwner(),slot=woodSlot(r.slot),sp=woodSp(r.sp),wp=woodPrice(r.slot,r.sp),wsize=(wp&&wp.size)||slot?.nominal||'';
 let body='';
 if(r.kind==='wood')body=woodSlots.length?`<button type=button class=wheelBig onclick="reqWheel()"><span><b>${esc(slot?.nominal||slot?.name||'—')}</b><small>сечение</small></span><span><b>${esc(sp?.name||'—')}</b><small>порода</small></span><span><b>${num(r.len,0)}</b><small>длина, мм</small></span></button><div class=res>Факт. размер: <b>${esc(wsize||'—')}</b>${own&&wp&&+wp.price>0?' · '+rub(wp.price)+'/м':''}</div>`:'<div class=small>Типоразмеры дерева не заведены — выберите «Своё».</div>';
 else if(r.kind==='metal')body=`${own&&priceItems.length?`<button type=button class="btn secondary wide" onclick="reqRead();openPricePicker(p=>{reqState.price=p;reqState.name=p.name;reqState.size='';reqState.munit=p.kind==='sheet'?'лист':p.kind==='piece'?'шт':'хлыст';drawRequest()},()=>drawRequest())">${r.price?'Сменить: '+esc(r.price.name):'Выбрать из прайса'}</button>`:''}${r.price?`<div class=small>${esc(r.price.category)} · ${priceUnitText(r.price)}</div>`:`<div class=inlineRow><label class=field>Материал<input id=rqName list=matNames3 value="${esc(r.name)}" placeholder="Труба проф."></label><label class=field>Размер<input id=rqSize value="${esc(r.size)}" placeholder="40×20×2"></label></div><datalist id=matNames3>${MAT_NAMES.map(n=>`<option value="${n}">`).join('')}</datalist>`}
  <div class=label>Единица</div><div class=chipRow id=rqMU>${['хлыст','м','шт','лист'].map(u=>`<button type=button class="chip ${r.munit===u?'on':''}" data-u="${u}">${u}</button>`).join('')}</div>`;
 else body=`<div class=inlineRow><label class=field>Что нужно<input id=rqName value="${esc(r.name)}" placeholder="Диски отрезные 125"></label><label class=field>Ед.<select id=rqUnit>${[...new Set([r.unit,...UNITS,'уп','баллон'])].map(u=>`<option ${r.unit===u?'selected':''}>${u}</option>`).join('')}</select></label></div>`;
 const qLbl=r.kind==='wood'?'Количество, шт':r.kind==='metal'?'Количество, '+r.munit:'Количество';
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Новая заявка</h2>
 <div class=segBar>${[['metal','⚙ Металл'],['wood','🪵 Дерево'],['other','🔩 Своё']].map(([k,l])=>`<button type=button class="${r.kind===k?'on':''}" onclick="reqRead();reqState.kind='${k}';drawRequest()">${l}</button>`).join('')}</div>
 ${body}
 <label class=field>${qLbl}<input id=rqQty inputmode=decimal value="${esc(r.qty)}" placeholder="0"></label><div id=rqCalc class=small></div>
 <label class=field>Объект (необязательно)<select id=rqProj><option value="">Внутрицеховые / на склад</option>${activeProjects().map(o=>`<option value="${o.id}" ${o.id===r.pid?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label>
 <label class=field>Комментарий<input id=rqNote value="${esc(r.note)}" placeholder="например: до пятницы"></label>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=rqSave>Добавить в «Заказать»</button></div>`;
 if($('rqMU'))$('rqMU').onclick=e=>{const b=e.target.closest('[data-u]');if(!b)return;reqRead();reqState.munit=b.dataset.u;drawRequest()};
 const calc=()=>{const n=qtyVal($('rqQty').value);let t='';if(r.kind==='wood'&&n){const m=n*r.len/1000;t=`${num(n)} шт × ${num(r.len/1000,2)} м = ${num(m,1)} м`+(own&&wp&&+wp.price>0?` ≈ ${rub(m*wp.price)}`:'')}else if(r.kind==='metal'&&n&&r.price&&own){const pr=+r.price.price;t=r.munit==='хлыст'?`≈ ${rub(n*(r.price.stock_len_mm||6000)/1000*pr)}`:r.munit==='м'?`≈ ${rub(n*pr)}`:`≈ ${rub(n*pr)}`}$('rqCalc').textContent=t};
 $('rqQty').oninput=calc;calc();
 $('rqSave').onclick=saveRequest;
}
function reqWheel(){reqRead();const r=reqState;
 openWheels('Брус к заказу',[{label:'Сечение',value:r.slot,items:woodSlots.map(s=>({v:s.id,t:s.nominal||s.name}))},{label:'Порода',value:r.sp,items:woodSpecies.map(s=>({v:s.id,t:s.name}))},{label:'Длина, мм',value:r.len,items:WOOD_LENS.map(n=>({v:n,t:String(n)}))}],([a,b,c])=>{r.slot=a;r.sp=b;r.len=+c;lsSet('reqSlot',a);lsSet('reqSp',b);lsSet('reqLen',c);drawRequest()})}
async function saveRequest(){
 reqRead();const r=reqState,b=$('rqSave');if(b.disabled)return;const n=qtyVal(r.qty);if(!n)return alert('Укажите количество');
 let body={workspace_id:currentWorkspace,project_id:r.pid||null,status:'order',source:'manual',note:r.note.trim(),supplier:'',created_by:currentUser.id,spec_line_id:null};
 if(r.kind==='wood'){const slot=woodSlot(r.slot),sp=woodSp(r.sp),wp=woodPrice(r.slot,r.sp);if(!slot)return alert('Выберите сечение');Object.assign(body,{kind:'wood',shape:'linear',name:sp?.name||slot.name,size:(wp&&wp.size)||slot.nominal||'',length_mm:r.len,qty:n,unit:'шт',wood_slot_id:slot.id,species_id:sp?.id||null,stock_len_mm:wp?.stock_len_mm||null})}
 else if(r.kind==='metal'){const p=r.price,name=p?p.name:String(r.name||'').trim(),size=p?'':sizeShow(r.size.trim());if(!name)return alert('Укажите материал');
  const base={kind:'metal',name,size,price_item_id:p?.id||null};
  if(r.munit==='хлыст'){const st=p?.stock_len_mm||6000;Object.assign(body,base,{shape:'linear',length_mm:st,stock_len_mm:st,qty:n,unit:'шт'})}
  else if(r.munit==='м'){Object.assign(body,base,{shape:'linear',length_mm:1000,stock_len_mm:p?.stock_len_mm||6000,qty:n,unit:'шт'})}
  else Object.assign(body,base,{shape:'piece',length_mm:null,qty:n,unit:r.munit})}
 else{const name=String(r.name||'').trim();if(!name)return alert('Напишите, что нужно');Object.assign(body,{kind:'other',shape:'piece',name,size:'',length_mm:null,qty:n,unit:r.unit||'шт'})}
 b.disabled=true;b.textContent='Сохраняю…';
 try{await q(sb.from('shop_parts').insert(body));await refreshShop();closeModal();toast('Заявка добавлена в «Заказать»'+(body.project_id?'':' · внутрицеховые'))}catch(e){b.disabled=false;b.textContent='Добавить в «Заказать»';serverError(e);alert('Не удалось: '+(e.message||e))}
}

/* ---------- Расценки ---------- */
function ratesHtml(){
 const items=catItems.filter(i=>!i.archived),rows=items.map(i=>({i,ops:catOps.filter(o=>o.item_id===i.id&&o.pay_type==='piece')})).filter(x=>x.ops.length);
 return `<div class=label style="margin-top:6px">Работы по изделиям, ₽ за единицу</div>${rows.map(({i,ops})=>ops.map(o=>`<button class=rateRow onclick="editOpRate('${o.id}')"><span>${esc(i.name)} — ${esc(o.name)}</span><b>${rub(o.rate)}<small> / ${esc(i.unit||'шт')}</small></b></button>`).join('')).join('')||'<div class=small>Нет изделий со сдельными работами — добавьте в «Справочник изделий».</div>'}
 <div class=label style="margin-top:12px">Дерево, ₽ за брусок</div>${workRates.filter(r=>r.kind==='wood').map(r=>`<button class=rateRow onclick="editWorkRate('${r.id}')"><span>${esc(r.name)}</span><b>${rub(r.rate)}<small> / ${esc(r.unit||'брусок')}</small></b></button>`).join('')||'<div class=small>Нет расценок</div>'}
 <div class=label style="margin-top:12px">Другие работы (быстрый выбор в «Другая работа»)</div>${workRates.filter(r=>r.kind==='other').map(r=>`<button class=rateRow onclick="editWorkRate('${r.id}')"><span>${esc(r.name)}</span><b>${rub(r.rate)}<small> / ${esc(r.unit||'шт')}</small></b></button>`).join('')||'<div class=small>Пусто</div>'}
 <div class=small style="margin:8px 2px">Тап — изменить цену. Новая цена действует с текущей недели: записи этой недели пересчитаются, закрытые недели — нет.</div>
 <div class=inlineRow><button class="btn secondary" onclick="newWorkRate()">+ Работа</button><button class=btn onclick="ratesPct()">% Изменить все</button></div>`;
}
function askNum(title,sub,val,onSave,unitLbl){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(title)}</h2>${sub?`<div class=summary>${sub}</div>`:''}<label class=field>${unitLbl||'Цена, ₽'}<input id=anV inputmode=decimal value="${val!=null?moneyText(val):''}"></label><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=anS>Сохранить</button></div>`;
 openModal();$('anV').oninput=e=>fmtMoneyInput(e.target);setTimeout(()=>{try{$('anV').focus();$('anV').select()}catch(e){}},50);
 $('anS').onclick=async()=>{const b=$('anS');if(b.disabled)return;b.disabled=true;try{await onSave(moneyVal($('anV').value));closeModal();await loadProd();renderCurrent()}catch(e){b.disabled=false;alert('Не удалось: '+(e.message||e))}};
}
async function recalcPieces(list,rate){const ws=mondayOf(localISO());for(const p of list.filter(p=>p.work_date>=ws&&!weekClosed(mondayOf(p.work_date))&&p.kind!=='redo_free'&&p.kind!=='other'))await q(sb.from('piece_entries').update({rate,amount:Math.round((+p.qty||0)*rate*100)/100}).eq('id',p.id))}
async function applyOpRate(id,v){
 await q(sb.from('catalog_ops').update({rate:v}).eq('id',id));
 const act=new Set(activeProjects().map(o=>o.id)),ops=projOps.filter(o=>o.catalog_op_id===id&&act.has(o.project_id));
 for(const o of ops)await q(sb.from('project_ops').update({rate:v}).eq('id',o.id));
 const ids=new Set(ops.map(o=>o.id));await recalcPieces(pieces.filter(p=>ids.has(p.project_op_id)),v);
}
function editOpRate(id){const o=catOps.find(x=>x.id===id),i=catItems.find(x=>x.id===o?.item_id);if(!o)return;askNum(`${i?.name||''} — ${o.name}`,`сейчас ${rub(o.rate)} за ${esc(i?.unit||'шт')}`,o.rate,async v=>{await applyOpRate(id,v);await loadSalary();toast('Расценка: '+rub(v))},`₽ за 1 ${i?.unit||'шт'}`)}
async function applyWorkRate(r,v){await q(sb.from('work_rates').update({rate:v}).eq('id',r.id));const st=Object.entries(STAGE_LBL).find(([,l])=>l===r.name)?.[0];if(r.kind==='wood'&&st)await recalcPieces(pieces.filter(p=>p.part_id&&p.stage===st),v)}
function editWorkRate(id){const r=workRates.find(x=>x.id===id);if(!r)return;askNum(r.name,`сейчас ${rub(r.rate)} за ${esc(r.unit||'шт')}`,r.rate,async v=>{await applyWorkRate(r,v);await loadSalary();toast('Расценка: '+rub(v))},`₽ за 1 ${r.unit||'шт'}`)}
function newWorkRate(){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Новая работа</h2><label class=field>Название<input id=nwN placeholder="Например: зачистка швов"></label><div class=inlineRow><label class=field>Цена, ₽<input id=nwR inputmode=decimal></label><label class=field>За<input id=nwU value="шт"></label></div><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=nwS>Добавить</button></div>`;
 openModal();$('nwR').oninput=e=>fmtMoneyInput(e.target);
 $('nwS').onclick=async()=>{const n=$('nwN').value.trim();if(!n)return alert('Название');try{await q(sb.from('work_rates').insert({workspace_id:currentWorkspace,kind:'other',name:n,unit:$('nwU').value.trim()||'шт',rate:moneyVal($('nwR').value),sort:workRates.length+10}));closeModal();await loadProd();renderCurrent()}catch(e){alert('Не удалось: '+(e.message||e))}};
}
async function ratesPct(){const v=prompt('Изменить все расценки на, % (например 10 или -5):','10');if(v===null)return;const p=+String(v).replace(',','.');if(!isFinite(p)||p<=-90||p>500)return alert('Укажите процент');
 if(!confirm(`Все сдельные расценки ${p>0?'+':''}${num(p)}%. Записи текущей недели пересчитаются. Продолжить?`))return;
 const k=1+p/100,r2=x=>Math.round(x*k*100)/100;
 try{for(const o of catOps.filter(o=>o.pay_type==='piece'&&+o.rate>0))await applyOpRate(o.id,r2(+o.rate));for(const r of workRates.filter(r=>+r.rate>0))await applyWorkRate(r,r2(+r.rate));await loadProd();renderCurrent();toast('Расценки изменены на '+num(p)+'%')}catch(e){failSave(e)}}

/* ---------- прайс: порядок разделов ---------- */
const CAT_RX=[/проф/i,/^лист$/i,/^лист/i,/полос/i,/угол/i,/швел/i,/труба кругл/i,/^труба/i,/квадрат/i,/^круг/i,/арматур/i,/балк|двутавр/i,/шестигр/i,/сетк/i,/электрод/i];
const catRank=c=>{const i=CAT_RX.findIndex(r=>r.test(String(c||'')));return i<0?99:i};
priceCats=function(){return [...new Set(priceItems.map(p=>p.category))].sort((a,b)=>catRank(a)-catRank(b)||String(a).localeCompare(String(b),'ru'))};
const _loadPrice50=loadPrice;
loadPrice=async function(){await _loadPrice50(...arguments);priceItems.sort((a,b)=>catRank(a.category)-catRank(b.category)||(a.sort||0)-(b.sort||0))};

/* ---------- команда: мастер ---------- */
async function setMaster(uid,on){try{await q(sb.from('members').update({is_master:!!on}).eq('workspace_id',currentWorkspace).eq('user_id',uid));const m=members.find(x=>x.user_id===uid);if(m)m.is_master=!!on;toast(on?'Назначен мастером: отмечает работу в цеху':'Больше не мастер')}catch(e){failSave(e)}}
