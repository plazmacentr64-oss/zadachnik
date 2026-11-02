'use strict';
// v56: карточка объекта — даты целиком, номер закупки в ЕИС, спецификация без плана работ и с «+ Новое изделие»,
// экономика внутри блока «Деньги»; «План работ» — вкладка в Цеху; руководитель может смотреть приложение глазами роли.

/* ---------- номер ЕИС (поле projects.eis_number) ---------- */
let eisMap=new Map();
const eisOf=id=>eisMap.get(id)||'';
const eisUrl=n=>'https://zakupki.gov.ru/epz/order/extendedsearch/results.html?searchString='+encodeURIComponent(n);
async function loadEis(){if(!currentWorkspace)return;try{const r=await fetchAll(()=>sb.from('projects').select('id,eis_number').eq('workspace_id',currentWorkspace).order('id'));if(!r.error)eisMap=new Map((r.data||[]).map(x=>[x.id,x.eis_number||'']))}catch(e){console.warn('eis',e)}}
async function saveEis(id,el){
 const v=String(el.value||'').replace(/[^\d]/g,''),old=eisOf(id);if(v===old){el.value=v;return}
 if(v&&(v.length<11||v.length>25)){el.value=old;return toast('Номер закупки в ЕИС — от 11 до 25 цифр')}
 try{const {error}=await sb.from('projects').update({eis_number:v||null,updated_by:currentUser?.id||null}).eq('id',id);if(error)throw error;eisMap.set(id,v);el.value=v;
  const go=el.parentElement?.querySelector('.v56eisGo');if(go){go.href=v?eisUrl(v):'#';go.classList.toggle('off',!v)}toast(v?'Номер ЕИС сохранён':'Номер ЕИС убран');renderCurrent()}
 catch(e){el.value=old;failSave(e)}}
function eisFieldHtml(o){const own=isOwner(),n=eisOf(o.id);
 return `<label class="field v56eis">Номер закупки в ЕИС<span class=v56eisRow><input class=inlineEdit inputmode=numeric autocomplete=off placeholder="0360300011126000154" value="${esc(n)}" ${own?'':'readonly disabled'} onchange="saveEis('${o.id}',this)"><a class="v56eisGo ${n?'':'off'}" href="${n?esc(eisUrl(n)):'#'}" target=_blank rel=noopener aria-label="Открыть закупку на zakupki.gov.ru" onclick="if(this.classList.contains('off')){event.preventDefault();toast('Сначала укажите номер')}"><span aria-hidden=true>↗</span></a></span></label>`}

/* значок ЕИС на карточке в списке объектов */
if(typeof card==='function'){const _card56=card;card=function(o,c){const h=_card56(o,c),n=o&&eisOf(o.id);return n?h.replace(/<\/article>\s*$/,`<div class=v56eisB>ЕИС № ${esc(n)}</div></article>`):h}}

/* ---------- спецификация: без плана работ, с новым изделием ---------- */
if(typeof specBoxHtml==='function'){const _spec56=specBoxHtml;specBoxHtml=function(pid){
 let h=_spec56(pid);const i=h.indexOf('<div class=label style="margin-top:12px">План работ</div>');
 if(i>=0){const j=h.indexOf('<button class=linkBtn',i);h=h.slice(0,i)+(j>=0?h.slice(j):'</div>')}
 const add=`<button class="btn secondary wide" onclick="openSpecAdd('${pid}')">+ Изделие из справочника</button>`;
 if(h.includes(add))h=h.replace(add,`<div class=v56specAdd><button class="btn secondary" onclick="openSpecAdd('${pid}')">+ Из справочника</button><button class=btn onclick="openCatItem(null,'${pid}')">+ Новое изделие</button></div>`);
 h=h.replace(/<\/div>$/,`<button class=linkBtn onclick="closeModal();shopKind='plan';showView('wood')">План работ по объекту — в Цеху →</button></div>`);
 return h}}

/* ---------- карточка: даты, ЕИС, экономика внутри «Деньги» ---------- */
let moneyPane=(()=>{try{return localStorage.getItem('v56moneyPane')||'pay'}catch(e){return 'pay'}})();
function setMoneyPane(p){moneyPane=p;try{localStorage.setItem('v56moneyPane',p)}catch(e){}document.querySelectorAll('#sheet .v56seg button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));document.querySelectorAll('#sheet .v56pane').forEach(x=>x.hidden=x.dataset.p!==p)}
function v56Card(id){
 const o=data.find(x=>x.id===id),sh=$('sheet');if(!o||!sh||currentDetail!==id)return;
 const dataSec=sh.querySelector('.acc[data-k="data"] .accInner');
 if(dataSec&&!dataSec.querySelector('.v56eis')){dataSec.classList.add('v56data');const lbls=[...dataSec.querySelectorAll(':scope > label.field')];const after=lbls.find(l=>/Заказчик/.test(l.textContent))||lbls[0];
  if(after)after.insertAdjacentHTML('afterend',eisFieldHtml(o));else dataSec.insertAdjacentHTML('beforeend',eisFieldHtml(o))}
 const eco=sh.querySelector('.acc[data-k="eco"]'),money=sh.querySelector('.acc[data-k="money"]');
 if(eco&&money&&!money.querySelector('.v56seg')){
  const box=eco.querySelector('.accB > *'),mb=money.querySelector('.accB');
  const pay=document.createElement('div');pay.className='v56pane';pay.dataset.p='pay';while(mb.firstChild)pay.append(mb.firstChild);
  const ec=document.createElement('div');ec.className='v56pane';ec.dataset.p='eco';if(box)ec.append(box);
  mb.innerHTML=`<div class="segBar v56seg"><button type=button data-p=pay onclick="setMoneyPane('pay')">Оплаты</button><button type=button data-p=eco onclick="setMoneyPane('eco')">Экономика</button></div>`;
  mb.append(pay,ec);eco.remove();setMoneyPane(moneyPane);
  const s=money.querySelector('.accS');if(s&&typeof ecoPlan==='function'&&+o.money>0){try{const P=ecoPlan(o.id);if(P.total-P.overhead>0)s.innerHTML+=` · маржа ${num((o.money-P.total)/o.money*100,0)}%`}catch(e){}}
 }
}
{const _detail56=detail;detail=async function(id){await _detail56(id);try{v56Card(id)}catch(e){console.warn('v56 card',e)}}}

/* ---------- Цех: вкладка «План работ» ---------- */
const opIcon=n=>/свар|каркас|рам/i.test(n)?'fire':/покрас|грунт/i.test(n)?'paint-brush-broad':/дерев|брус|доск|сборк/i.test(n)?'tree':/монтаж|достав|отгруз/i.test(n)?'truck':'wrench';
const opIk=n=>({fire:'k-fire','paint-brush-broad':'k-paint',tree:'k-tree',truck:'k-truck',wrench:'k-wrench'})[opIcon(n)];
let planOpen=null;
function planHtml(){
 const own=isOwner(),done=id=>typeof shopDone==='function'?shopDone(id):opDone(id);
 const list=sortedObjects(activeProjects().filter(o=>o.status==='В работе'||projOps.some(x=>x.project_id===o.id))).map(o=>({o,ops:projOps.filter(x=>x.project_id===o.id&&+x.qty_plan>0)})).filter(x=>x.ops.length);
 if(!list.length)return `<div class=empty>Плана работ пока нет.<br>Он строится сам из спецификации объекта: добавьте изделия в карточке объекта.</div>`;
 if(planOpen===null)planOpen=list[0].o.id;
 return `<div class=small style="margin:2px 2px 10px">План строится из спецификации объектов. Тап по объекту — работы.</div>`+list.map(({o,ops})=>{
  const piece=ops.filter(x=>x.pay_type==='piece'),day=ops.filter(x=>x.pay_type==='day');
  const plan=piece.reduce((s,x)=>s+x.qty_plan*x.rate,0),got=piece.reduce((s,x)=>s+Math.min(done(x.id),x.qty_plan)*x.rate,0);
  const qp=piece.reduce((s,x)=>s+(+x.qty_plan||0),0),qd=piece.reduce((s,x)=>s+Math.min(done(x.id),x.qty_plan),0),pct=qp?Math.round(qd/qp*100):0;
  const d=o.date?days(o.date):null,due=d==null?'':d<0?`<span class="ocDue2 r">−${-d} дн</span>`:d<=7?`<span class="ocDue2 o">${d} дн</span>`:`<span class="ocDue2 g">${d} дн</span>`;
  const h=health(o),open=planOpen===o.id;
  const rows=open?ops.map(x=>{const dn=done(x.id),pc=x.pay_type==='piece';return `<div class=v56op><span class="v55tk ${opIk(x.name)}" aria-hidden=true>${ic(opIcon(x.name),20)}</span><div class=v56opM><b>${esc(x.item_name)} — ${esc(x.name)}</b><small>${pc?`сдельно · ${num(dn)} из ${num(x.qty_plan)} шт${dn>x.qty_plan?' · перевыполнение':''}`:`посуточно · план ${num(x.qty_plan*x.norm_days,1)} чел-дн`}</small>${pc?`<div class=bar><i style="width:${Math.min(100,x.qty_plan?dn/x.qty_plan*100:0)}%"></i></div>`:''}</div>${own&&pc?`<b class=v56opR>${rub(x.qty_plan*x.rate)}</b>`:''}</div>`}).join('')+`<button class=linkBtn onclick="detail('${o.id}')">Открыть объект →</button>`:'';
  return `<section class="ocard2 v56plan ${h.cls||'g'} ${open?'open':''}"><button type=button class=v56planH onclick="planOpen=planOpen==='${o.id}'?'':'${o.id}';renderShop()" aria-expanded="${open}"><span class=v56planT><b>${esc(o.name)}</b>${due}</span><small>${own&&plan?`по плану сделано на ${rub(got)} из ${rub(plan)}`:`${ops.length} ${plural(ops.length,'работа','работы','работ')} · сделано ${pct}%`}</small><span class=bar><i style="width:${own&&plan?Math.min(100,got/plan*100):pct}%"></i></span></button>${rows}</section>`}).join('');
}
if(typeof renderShop==='function'){const _rs56=renderShop;renderShop=function(){
 const want=shopKind==='plan';if(want)shopKind=isOwner()?'metal':'mine';
 _rs56();
 const body=$('woodBody'),bar=body&&body.querySelector('.segBar');if(!bar)return;
 bar.classList.add('v56tabs');
 if(!bar.querySelector('[data-plan]')){const n=activeProjects().filter(o=>projOps.some(x=>x.project_id===o.id&&+x.qty_plan>0)).length;bar.insertAdjacentHTML('beforeend',`<button type=button data-plan onclick="shopKind='plan';renderShop()">${ic('list-checks',16)} План работ${n?` · ${n}`:''}</button>`)}
 if(want){shopKind='plan';bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.hasAttribute('data-plan')));while(bar.nextSibling)bar.nextSibling.remove();bar.insertAdjacentHTML('afterend',planHtml())}
}}

/* ---------- руководитель: смотреть как роль ---------- */
const V56_ROLES=[['owner','Руководитель','всё: деньги, экономика, зарплаты','seal-check'],['shop','Начальник цеха','цех, план работ, снабжение — без денег','hard-hat'],['employee','Сотрудник','свои задания, табель и зарплата','users']];
let viewRole=(()=>{try{return localStorage.getItem('v56role')||'owner'}catch(e){return 'owner'}})(),viewWorker=(()=>{try{return localStorage.getItem('v56worker')||''}catch(e){return ''}})();
const meMember=()=>members.find(m=>m.user_id===currentUser?.id);
const realOwner=()=>{const m=meMember();return !!m&&(m._realRole||m.role)==='owner'};
function applyView(){
 const m=meMember();if(!m)return;if(m._realRole===undefined)m._realRole=m.role;
 if(m._realRole!=='owner'){viewRole='owner';v56Chrome();return}
 m.role=viewRole==='owner'?'owner':'employee';
 if(viewRole==='employee'){const w=(typeof workers!=='undefined'?workers:[]).find(x=>x.id===viewWorker)||null;myWorker=w}
 else if(viewRole==='shop')myWorker=null;
 v56Chrome();
}
function v56Chrome(){
 const own=realOwner(),right=$('teamBtn')?.parentElement;let b=$('v56roleBtn');
 if(own&&right&&!b){right.insertAdjacentHTML('afterbegin',`<button id=v56roleBtn class=chip onclick="openRoleSwitch()" aria-label="Смотреть приложение как другая роль"></button>`);b=$('v56roleBtn')}
 if(b){b.hidden=!own;const r=V56_ROLES.find(x=>x[0]===viewRole)||V56_ROLES[0];b.innerHTML=`${ic(r[3],15)} ${viewRole==='owner'?'Роль':({shop:'Цех',employee:'Сотрудник'})[viewRole]} ▾`;b.classList.toggle('on',viewRole!=='owner')}
 let bar=$('v56viewBar');
 if(own&&viewRole!=='owner'){const r=V56_ROLES.find(x=>x[0]===viewRole),w=viewRole==='employee'?(typeof workers!=='undefined'?workers:[]).find(x=>x.id===viewWorker):null;
  const txt=`Вы смотрите как <b>${w?esc(w.name)+' · ':''}${esc(r[1].toLowerCase())}</b>`;
  if(!bar){document.querySelector('.teamtop')?.insertAdjacentHTML('afterend',`<div id=v56viewBar class=v56viewBar role=status></div>`);bar=$('v56viewBar')}
  if(bar)bar.innerHTML=`${ic('users',18)}<span>${txt}</span><button type=button onclick="setViewRole('owner')">Вернуться</button>`}
 else if(bar)bar.remove();
}
function openRoleSwitch(){
 if(!realOwner())return;const ws=(typeof workers!=='undefined'?workers:[]).filter(w=>w.active!==false);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Смотреть как</h2><div class=summary>Показывает приложение глазами роли. Права и данные не меняются.</div>
 <div class=v56roles>${V56_ROLES.map(([k,l,d,i])=>`<button type=button class="v56role ${viewRole===k?'on':''}" onclick="${k==='employee'?`v56PickWorker()`:`setViewRole('${k}')`}"><span class="v56ri r-${k}">${ic(i,20)}</span><span class=v56rt><b>${l}</b><small>${d}</small></span>${viewRole===k?'<span class=v56ok>✓</span>':''}</button>`).join('')}</div>
 <div class=label style="margin-top:12px">Чей табель показать в роли «Сотрудник»</div>
 <div class=v56ws>${ws.map(w=>`<button type=button class="chip ${viewWorker===w.id?'on':''}" onclick="viewWorker='${w.id}';setViewRole('employee')">${esc(w.name)}</button>`).join('')||'<div class=small>Сотрудников в табеле пока нет</div>'}</div>`;
 openModal();
}
function v56PickWorker(){const ws=(typeof workers!=='undefined'?workers:[]).filter(w=>w.active!==false);if(!viewWorker&&ws[0])viewWorker=ws[0].id;setViewRole('employee')}
function setViewRole(r){
 if(!realOwner())return;viewRole=r;try{localStorage.setItem('v56role',r);localStorage.setItem('v56worker',viewWorker||'')}catch(e){}
 closeModal();applyView();applyRole();
 if(r==='shop'){shopKind='plan';showView('wood')}else if(r==='employee'){shopKind='mine';showView('wood')}else render();
 toast(r==='owner'?'Снова вид руководителя':'Вид: '+V56_ROLES.find(x=>x[0]===r)[1].toLowerCase());
}

/* загрузка: данные — как у настоящей роли, потом включаем выбранный вид */
{const _lp56=loadProd;loadProd=async function(){const m=meMember();if(m&&m._realRole)m.role=m._realRole;await _lp56();await loadEis();applyView()}}

/* первый запуск после загрузки этого файла */
if(serverReady){loadEis().then(()=>{applyView();applyRole();renderCurrent()})}
