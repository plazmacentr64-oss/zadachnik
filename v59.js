'use strict';
// v59: в карточке изделия — только какие работы есть, без расчёта зарплаты. Цены и вид оплаты — в «Справочники → Расценки»
// или прямо в табеле («Указать цену»). В расценках можно сменить сдельно / посуточно.

const V59_WORKS=[['Сварка','piece'],['Покраска','piece'],['Дерево','piece'],['Сборка','piece'],['Монтаж на объекте','day']];
const v59pay=o=>o.pay_type==='piece'?(+o.rate>0?`${num(o.rate,0)} ₽`:'без цены'):'по дню';

if(typeof renderCatItem==='function'){const _rci59=renderCatItem;renderCatItem=function(){
 _rci59();
 const d=catDraft,own=isOwner(),sh=$('sheet');if(!d||!sh)return;
 const box=[...sh.querySelectorAll('.info')].find(b=>/^Работы на 1/.test((b.querySelector('.label')?.textContent||'').trim()));if(!box)return;
 box.classList.add('v59works');
 // старые поля оплаты и ставки — прячем, значения остаются в форме и сохраняются как были
 box.querySelectorAll('.edGrid2').forEach(g=>g.classList.add('v58moved'));
 [...box.querySelectorAll(':scope > .small')].forEach(s=>s.classList.add('v58moved'));
 const addBtn=[...box.querySelectorAll(':scope > button')].find(b=>/\+ Работа/.test(b.textContent));if(addBtn)addBtn.classList.add('v58moved');
 box.querySelectorAll('.edBlock').forEach(bl=>{const inp=bl.querySelector('input[id^="on_"]');if(!inp)return;const id=inp.id.slice(3),o=d.ops.find(x=>x.id===id);if(!o)return;
  const row=bl.querySelector('.edRow');if(row&&!row.querySelector('.v59tag'))(row.querySelector('.edDel')||row).insertAdjacentHTML(row.querySelector('.edDel')?'beforebegin':'beforeend',`<span class="v59tag ${o.pay_type==='piece'&&!(+o.rate>0)?'no':''}">${esc(v59pay(o))}</span>`)});
 if(own){
  const have=new Set(d.ops.map(o=>o.name.trim().toLowerCase()));
  const quick=V59_WORKS.filter(([n])=>!have.has(n.toLowerCase()));
  box.insertAdjacentHTML('beforeend',`${quick.length?`<div class=v59quick>${quick.map(([n,t])=>`<button type=button class=chip onclick="v59add('${n}','${t}')">+ ${esc(n)}</button>`).join('')}<button type=button class=chip onclick="v59add('','piece')">+ своя</button></div>`:`<div class=v59quick><button type=button class=chip onclick="v59add('','piece')">+ своя работа</button></div>`}
  <button type=button class="s57row v59link" onclick="v59rates()"><span class=s57ic>${ic('tag',18)}</span><span class=s57tx><b>Цены работ</b><span>${d.id?'в Справочники → Расценки, или в табеле при расчёте':'появятся после сохранения изделия'}</span></span><span class=s57chev>›</span></button>`);
 }
}}
function v59add(name,type){readCatForm();catDraft.ops.push({id:uuid(),name,pay_type:type,rate:0,norm_days:0});renderCatItem();if(!name){const l=catDraft.ops.at(-1);setTimeout(()=>{try{$('on_'+l.id).focus()}catch(e){}},50)}}
function v59rates(){
 const d=catDraft;if(!d?.id)return toast('Сначала сохраните изделие — потом укажете цены');
 if($('sheet').dataset.dirty&&!confirm('Изменения в изделии не сохранены. Перейти к ценам без сохранения?'))return;
 if(typeof openRateItem57==='function')openRateItem57(d.id);
}
// сохранение без вопроса про нулевые расценки: цены задаются в справочнике
if(typeof saveCatItem==='function'){const _sci59=saveCatItem;saveCatItem=async function(){const c=window.confirm;window.confirm=m=>/Не указана расценка/.test(String(m))?true:c.call(window,m);try{return await _sci59.apply(this,arguments)}finally{window.confirm=c}}}

/* ---------- расценки: вид оплаты меняется здесь ---------- */
function s57rateOp(id){
 const o=catOps.find(x=>x.id===id),i=catItems.find(x=>x.id===o?.item_id);if(!o)return;let type=o.pay_type;
 const draw=()=>{
  $('sheet').innerHTML=`<button class=close onclick="openRateItem57('${o.item_id}')" aria-label="Назад">×</button><h2>${esc(i?.name||'')} — ${esc(o.name)}</h2><div class=summary>${type==='piece'?`₽ за 1 ${esc(i?.unit||'шт')} · сейчас ${rub(o.rate)}`:'посуточно — идёт в табель днём; норма нужна для плана и экономики'}</div>
  <div class="segBar s57seg2" id=v59t><button type=button class="${type==='piece'?'on':''}" data-v=piece>Сдельно</button><button type=button class="${type==='day'?'on':''}" data-v=day>Посуточно</button></div>
  <input id=s57pv class=s57money inputmode=decimal autocomplete=off value="${type==='piece'?(+o.rate>0?moneyText(o.rate):''):(+o.norm_days>0?num(o.norm_days):'')}" placeholder="${type==='piece'?'0 ₽':'0 чел-дн'}" aria-label="${type==='piece'?'Цена за штуку':'Чел-дней на штуку'}">
  <div class=small style="text-align:center">${type==='piece'?'Текущая неделя пересчитается у всех. Закрытые недели не меняются.':'Чел-дней на 1 '+esc(i?.unit||'шт')+', например 0,5'}</div>
  <button class="btn wide" id=s57ps style="margin-top:10px">Сохранить</button>`;
  $('v59t').onclick=e=>{const b=e.target.closest('[data-v]');if(!b||b.dataset.v===type)return;type=b.dataset.v;draw()};
  const el=$('s57pv');if(type==='piece')el.oninput=e=>fmtMoneyInput(e.target);setTimeout(()=>{try{el.focus();el.select()}catch(e){}},60);
  $('s57ps').onclick=async()=>{const b=$('s57ps');if(b.disabled)return;b.disabled=true;b.textContent='Сохраняю…';
   try{
    if(type!==o.pay_type){await q(sb.from('catalog_ops').update({pay_type:type}).eq('id',id));const act=new Set(activeProjects().map(x=>x.id));for(const p of projOps.filter(p=>p.catalog_op_id===id&&act.has(p.project_id)))await q(sb.from('project_ops').update({pay_type:type}).eq('id',p.id))}
    if(type==='piece')await applyOpRate(id,moneyVal(el.value));
    else{const n=qtyVal(el.value)||0;await q(sb.from('catalog_ops').update({norm_days:n,rate:0}).eq('id',id));const act=new Set(activeProjects().map(x=>x.id));for(const p of projOps.filter(p=>p.catalog_op_id===id&&act.has(p.project_id)))await q(sb.from('project_ops').update({norm_days:n}).eq('id',p.id))}
    await loadProd();await loadSalary();renderCurrent();toast('Сохранено');openRateItem57(o.item_id)}
   catch(e){b.disabled=false;b.textContent='Сохранить';failSave(e)}};
 };
 draw();openModal();
}
// в списке работ изделия «по дню» тоже нажимается — чтобы сменить вид оплаты
if(typeof openRateItem57==='function'){const _ori59=openRateItem57;openRateItem57=function(iid){_ori59(iid);
 $('sheet').querySelectorAll('.s57price.day').forEach(sp=>{const row=sp.closest('.s57row'),name=row?.querySelector('.s57tx b')?.textContent,o=catOps.find(x=>x.item_id===iid&&x.name===name&&x.pay_type!=='piece');if(!o)return;
  const b=document.createElement('button');b.className='s57price day';b.style.cursor='pointer';b.textContent=+o.norm_days>0?`по дню · ${num(o.norm_days)} ч-д ✎`:'по дню ✎';b.onclick=()=>s57rateOp(o.id);sp.replaceWith(b)})}}
