'use strict';
// v45: справочник изделий, спецификация объекта, план работ, цех (дерево + металл), снабжение
let catItems=[],catOps=[],catMats=[],specLines=[],projOps=[],parts=[],prodError='';
let shopKind='wood',shopFilter='',supplyTab='order';
const KIND_NAME={metal:'Металл',wood:'Дерево',other:'Метизы и прочее'},KIND_ICON={metal:'⚙',wood:'🪵',other:'🔩'};
const PART_STATUS=['order','ordered','stock','ready'],PART_LABEL={order:'К заказу',ordered:'Заказано',stock:'Есть',ready:'Готово ✓'};
const MAT_NAMES=['Труба проф.','Труба круглая','Уголок','Полоса','Лист','Швеллер','Арматура','Пруток','Лиственница','Сосна','Доска','Брус','Брусок','Болт','Гайка','Саморез','Анкер','Краска порошковая','Грунт','Эмаль'];
const UNITS=['шт','м','кг','м²','л','компл'];
const num=(n,d=3)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(Math.round((+n||0)*1000)/1000);
const qtyVal=s=>{let v=parseFloat(String(s??'').replace(/\s/g,'').replace(',','.'));return isFinite(v)&&v>0?Math.round(v*1000)/1000:0};
const normSize=s=>String(s||'').toLowerCase().replace(/[xх*]/g,'×').replace(/\s+/g,'').replace(/,/g,'.');
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>(Math.random()*16|0).toString(16));
const activeProjects=()=>data.filter(o=>o.status!=='Выполнено');
const projName=id=>data.find(o=>o.id===id)?.name||'—';
async function q(p){const {data:d,error}=await p;if(error)throw error;return d}

async function loadProd(){
 const ws=currentWorkspace,f=t=>fetchAll(()=>sb.from(t).select('*').eq('workspace_id',ws).order('id'));
 try{
  const r=await Promise.all(['catalog_items','catalog_ops','catalog_materials','spec_lines','project_ops','shop_parts'].map(f));
  const bad=r.find(x=>x.error);if(bad)throw bad.error;
  [catItems,catOps,catMats,specLines,projOps,parts]=r.map(x=>x.data||[]);
  catItems.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  [catOps,catMats,specLines].forEach(a=>a.sort((x,y)=>(x.sort||0)-(y.sort||0)));
  prodError='';
 }catch(e){prodError=e.message||String(e);console.warn('prod',e)}
 if(typeof loadSalary==='function'&&isOwner())await loadSalary();
 if(typeof loadPrice==='function'&&isOwner()&&!priceItems.length)await loadPrice();
 if(typeof loadEco==='function'&&isOwner())await loadEco();
}
async function reloadProd(){await loadProd();renderCurrent();if(currentDetail)refreshDetail(currentDetail)}

/* ---------- Справочник изделий ---------- */
function openCatalog(){
 const own=isOwner();
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Справочник изделий</h2><div class=small>Изделие описывается один раз: какие работы (сдельно ₽/шт или посуточно чел-дн/шт) и какие материалы на 1 шт. Потом его можно добавить в спецификацию любого объекта.</div>
 ${catItems.filter(i=>!i.archived).map(i=>{const o=catOps.filter(x=>x.item_id===i.id),m=catMats.filter(x=>x.item_id===i.id);return `<button class=catRow onclick="openCatItem('${i.id}')"><b>${esc(i.name)}</b><span>${o.length} ${plural(o.length,'работа','работы','работ')} · ${m.length} ${plural(m.length,'материал','материала','материалов')}${own&&typeof itemMatCost==='function'&&itemMatCost(i.id).priced?' · материалы '+rub(itemMatCost(i.id).sum):''}</span></button>`}).join('')||'<div class=empty>Справочник пуст. Добавьте первое изделие — например, «Скамья «Парк»».</div>'}
 ${own?`<button class="btn wide" style="margin-top:12px" onclick="openCatItem()">+ Новое изделие</button>`:''}`;
 openModal();
}
let catDraft=null;
function openCatItem(id,backProject){
 const i=catItems.find(x=>x.id===id);
 catDraft={id:i?.id||null,name:i?.name||'',note:i?.note||'',back:backProject||'',
  ops:catOps.filter(x=>x.item_id===id).map(x=>({...x})),mats:catMats.filter(x=>x.item_id===id).map(x=>({...x}))};
 if(!i){catDraft.ops=[{id:uuid(),name:'Сварка',pay_type:'piece',rate:0,norm_days:0},{id:uuid(),name:'Покраска',pay_type:'piece',rate:0,norm_days:0},{id:uuid(),name:'Монтаж на объекте',pay_type:'day',rate:0,norm_days:0}]}
 renderCatItem();openModal();
}
function readCatForm(){
 if(!catDraft||!$('ciName'))return;
 catDraft.name=$('ciName').value.trim();catDraft.note=$('ciNote').value.trim();
 catDraft.ops.forEach(o=>{o.name=$('on_'+o.id).value.trim();o.pay_type=$('ot_'+o.id).value;const v=$('ov_'+o.id).value;if(o.pay_type==='piece'){o.rate=moneyVal(v);o.norm_days=0}else{o.norm_days=qtyVal(v);o.rate=0}});
 catDraft.mats.forEach(m=>{m.kind=$('mk_'+m.id).value;m.name=$('mn_'+m.id).value.trim();m.size=$('ms_'+m.id)?$('ms_'+m.id).value.trim():'';m.shape=m.kind==='other'?'piece':m.kind==='wood'?'linear':($('msh_'+m.id)?.value||m.shape||'linear');m.length_mm=Math.round(qtyVal($('ml_'+m.id)?.value))||null;m.width_mm=Math.round(qtyVal($('mw_'+m.id)?.value))||null;m.qty=qtyVal($('mq_'+m.id).value)||1;m.unit=$('mu_'+m.id)?.value||m.unit||'шт';if(m.shape==='piece'&&m.kind==='metal'&&!$('mu_'+m.id))m.unit=m.unit||'шт'});
}
function renderCatItem(){
 const d=catDraft,own=isOwner(),ro=own?'':'disabled';
 const pieceSum=d.ops.filter(o=>o.pay_type==='piece').reduce((s,o)=>s+(+o.rate||0),0),daySum=d.ops.filter(o=>o.pay_type==='day').reduce((s,o)=>s+(+o.norm_days||0),0);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${d.id?'Изделие':'Новое изделие'}</h2>
 <label class=field>Название<input id=ciName value="${esc(d.name)}" placeholder="Например: Скамья «Парк»" ${ro}></label>
 <label class=field>Примечание<input id=ciNote value="${esc(d.note)}" placeholder="металл + брус лиственницы" ${ro}></label>
 <div class=info><div class=label>Работы на 1 шт</div>${d.ops.map(o=>`<div class=edBlock><div class=edRow><input id="on_${o.id}" value="${esc(o.name)}" placeholder="Работа, например: сварка каркаса" aria-label="Работа" ${ro}>${own?`<button class=edDel aria-label="Убрать работу" onclick="readCatForm();catDraft.ops=catDraft.ops.filter(x=>x.id!=='${o.id}');renderCatItem()">×</button>`:''}</div><div class=edGrid2><label>Оплата<select id="ot_${o.id}" ${ro} onchange="readCatForm();renderCatItem()"><option value=piece ${o.pay_type==='piece'?'selected':''}>Сдельно</option><option value=day ${o.pay_type==='day'?'selected':''}>Посуточно</option></select></label><label ${!own&&o.pay_type==='piece'?'hidden':''}>${o.pay_type==='piece'?'₽ за 1 шт':'чел-дней на 1 шт'}<input id="ov_${o.id}" inputmode=decimal value="${o.pay_type==='piece'?(+o.rate?moneyText(o.rate):''):(+o.norm_days?num(o.norm_days):'')}" placeholder="0" ${ro}></label></div></div>`).join('')||'<div class=small>Работ нет</div>'}
 ${own?`<button class="btn secondary wide" onclick="readCatForm();catDraft.ops.push({id:uuid(),name:'',pay_type:'piece',rate:0,norm_days:0});renderCatItem()">+ Работа</button>`:''}
 ${own?`<div class=small style="margin-top:8px">На 1 шт: сдельно ${rub(pieceSum)} · посуточно ${num(daySum)} чел-дн</div>`:''}</div>
 <div class=info><div class=label>Материалы на 1 шт</div><datalist id=matNames>${MAT_NAMES.map(n=>`<option value="${n}">`).join('')}</datalist>${d.mats.map(m=>matEdHtml(m,own,ro)).join('')||'<div class=small>Материалов нет</div>'}
 ${own&&d.mats.length?(()=>{const c=itemMatCost(null,d.mats);return c.priced?`<div class=kvRow style="margin-top:6px"><span><b>Материалы по прайсу на 1 шт</b>${c.priced<c.total?` <span class=small>(${c.priced} из ${c.total})</span>`:''}</span><b id=matTotal>${rub(c.sum)}</b></div>`:''})():''}
 ${own?`<div class=inlineRow><button class="btn secondary" onclick="readCatForm();catDraft.mats.push({id:uuid(),kind:'metal',shape:'linear',name:'',size:'',length_mm:null,qty:1,unit:'шт'});renderCatItem()">+ Материал</button>${priceItems.length?`<button class=btn onclick="pickMatFromPrice()">+ Из прайса</button>`:''}</div>`:''}
 <div class=small style="margin-top:8px">Погонаж (труба, уголок, брус): длина детали и сколько деталей на 1 изделие. Лист: ширина × длина детали — считается в м² + ${typeof wastePct==='function'?num(wastePct()):20}% обрезки и округляется до целых листов.</div></div>
 ${own?`<div class=actions><button class="btn secondary" onclick="${d.back?`detail('${d.back}')`:'openCatalog()'}">Назад</button><button class=btn id=ciSave onclick="saveCatItem()">Сохранить изделие</button></div>${d.id?`<button class=dangerLink onclick="archiveCatItem('${d.id}')">Убрать из справочника</button>`:''}`:''}`;
}
function matEdHtml(m,own,ro){
 const p=own&&typeof priceById==='function'?priceById(m.price_item_id):null,c=p?matCost(m):null,shape=m.kind==='other'?'piece':m.kind==='wood'?'linear':(m.shape||'linear');
 const del=own?`<button class=edDel aria-label="Убрать материал" onclick="readCatForm();catDraft.mats=catDraft.mats.filter(x=>x.id!=='${m.id}');renderCatItem()">×</button>`:'';
 const ch=`onchange="readCatForm();renderCatItem()"`,rc=p?`oninput="matRecalc()"`:'';
 let g='';
 if(shape==='sheet')g=`<div class=edGrid4><label>Ширина, мм<input id="mw_${m.id}" inputmode=numeric value="${m.width_mm||''}" placeholder="мм" ${ro} ${rc}></label><label>Длина, мм<input id="ml_${m.id}" inputmode=numeric value="${m.length_mm||''}" placeholder="мм" ${ro} ${rc}></label><label>Деталей на 1 шт<input id="mq_${m.id}" inputmode=decimal value="${num(m.qty||1)}" ${ro} ${rc}></label></div>`;
 else if(shape==='linear')g=`<div class=edGrid4>${p?'':`<label>${m.kind==='wood'?'Сечение':'Размер'}<input id="ms_${m.id}" value="${esc(m.size||'')}" placeholder="${m.kind==='wood'?'40×90':'40×20×2'}" ${ro}></label>`}<label>Длина, мм<input id="ml_${m.id}" inputmode=numeric value="${m.length_mm||''}" placeholder="мм" ${ro} ${rc}></label><label>Деталей на 1 шт<input id="mq_${m.id}" inputmode=decimal value="${num(m.qty||1)}" ${ro} ${rc}></label></div>`;
 else g=`<div class=edGrid4>${p?'':`<label>Размер<input id="ms_${m.id}" value="${esc(m.size||'')}" placeholder="—" ${ro}></label>`}<label>Кол-во на 1 шт<input id="mq_${m.id}" inputmode=decimal value="${num(m.qty||1)}" ${ro} ${rc}></label><label>Ед.<select id="mu_${m.id}" ${ro}>${[...new Set([m.unit||'шт',...UNITS])].map(u=>`<option ${m.unit===u?'selected':''}>${u}</option>`).join('')}</select></label></div>`;
 return `<div class=matEd><div class=edRow><select id="mk_${m.id}" aria-label="Вид" ${ro} ${ch}>${['metal','wood','other'].map(k=>`<option value=${k} ${m.kind===k?'selected':''}>${KIND_ICON[k]} ${KIND_NAME[k]}</option>`).join('')}</select>${m.kind==='metal'?`<select id="msh_${m.id}" aria-label="Форма" ${ro} ${ch} ${p?'disabled':''}><option value=linear ${shape==='linear'?'selected':''}>Погонаж</option><option value=sheet ${shape==='sheet'?'selected':''}>Лист</option><option value=piece ${shape==='piece'?'selected':''}>Штучно</option></select>`:''}${del}</div>
 <div class=edRow><input id="mn_${m.id}" list=matNames value="${esc(m.name)}" placeholder="${m.kind==='wood'?'Лиственница':m.kind==='metal'?(shape==='sheet'?'Лист 2,0 х/к':'Труба проф.'):'Болт М8×60'}" aria-label="Материал" ${ro} ${p?'readonly':''}>${own&&priceItems.length?`<button class="chip" type=button onclick="pickMatFromPrice('${m.id}')">${p?'Сменить':'Из прайса'}</button>`:''}</div>
 ${p?`<div class=small style="margin:2px 0 0">${priceUnitText(p)} · ${esc(priceSub(p))} · <button class=linkBtn style="padding:0" onclick="readCatForm();const x=catDraft.mats.find(x=>x.id==='${m.id}');x.price_item_id=null;renderCatItem()">отвязать от прайса</button></div>`:''}
 ${g}${c?`<div class=calcLine2 id="mc_${m.id}">${c.text} = <b>${rub(c.sum)}</b></div>`:''}</div>`;
}
function matRecalc(){readCatForm();catDraft.mats.forEach(m=>{const el=$('mc_'+m.id);if(!el)return;const c=matCost(m);if(c)el.innerHTML=`${c.text} = <b>${rub(c.sum)}</b>`});const t=$('matTotal');if(t)t.textContent=rub(itemMatCost(null,catDraft.mats).sum)}
function pickMatFromPrice(matId){
 readCatForm();
 openPricePicker(p=>{let m=catDraft.mats.find(x=>x.id===matId);if(!m){m={id:uuid(),kind:'metal',qty:1};catDraft.mats.push(m)}
  const kind=/дерев|лиственн|сосн|доск|брус/i.test(p.category+' '+p.name)?'wood':p.kind==='piece'&&!/сетк/i.test(p.category)?'other':'metal';
  Object.assign(m,{kind,price_item_id:p.id,name:p.name,size:'',shape:p.kind,stock_len_mm:p.kind==='linear'?(p.stock_len_mm||6000):null,sheet_w:p.sheet_w||null,sheet_l:p.sheet_l||null,unit:p.kind==='piece'?(p.unit||'шт'):'шт'});
  if(p.kind!=='sheet')m.width_mm=null;renderCatItem()},()=>renderCatItem());
}
async function saveCatItem(){
 readCatForm();const d=catDraft,b=$('ciSave');if(b.disabled)return;
 if(!d.name)return alert('Укажите название изделия');
 if(d.mats.some(m=>m.shape==='sheet'&&!(m.width_mm&&m.length_mm)))return alert('Для листа укажите ширину и длину детали в мм');
 if(d.ops.some(o=>!o.name)||d.mats.some(m=>!m.name))return alert('У каждой работы и материала должно быть название — или уберите пустые строки');
 const zero=d.ops.filter(o=>o.pay_type==='piece'?!(+o.rate>0):!(+o.norm_days>0)).map(o=>o.name);if(zero.length&&!confirm('Не указана расценка/норма: '+zero.join(', ')+'. Сохранить с нулём?'))return;
 b.disabled=true;b.textContent='Сохраняю…';
 try{
  const old=catOps.filter(x=>x.item_id===d.id);
  let id=d.id;
  if(!id){const r=await q(sb.from('catalog_items').insert({workspace_id:currentWorkspace,name:d.name,note:d.note}).select().single());id=r.id}
  else await q(sb.from('catalog_items').update({name:d.name,note:d.note}).eq('id',id));
  const keepO=new Set(d.ops.map(o=>o.id)),keepM=new Set(d.mats.map(m=>m.id));
  for(const o of catOps.filter(x=>x.item_id===id&&!keepO.has(x.id)))await q(sb.from('catalog_ops').delete().eq('id',o.id));
  for(const m of catMats.filter(x=>x.item_id===id&&!keepM.has(x.id)))await q(sb.from('catalog_materials').delete().eq('id',m.id));
  if(d.ops.length)await q(sb.from('catalog_ops').upsert(d.ops.map((o,i)=>({id:o.id,workspace_id:currentWorkspace,item_id:id,name:o.name,pay_type:o.pay_type,rate:+o.rate||0,norm_days:+o.norm_days||0,sort:i}))));
  if(d.mats.length)await q(sb.from('catalog_materials').upsert(d.mats.map((m,i)=>({id:m.id,workspace_id:currentWorkspace,item_id:id,kind:m.kind,name:m.name,size:m.size||'',length_mm:m.shape==='piece'?null:(m.length_mm||null),qty:+m.qty||1,unit:m.unit||'шт',sort:i,shape:m.shape||(m.kind==='other'?'piece':'linear'),price_item_id:m.price_item_id||null,width_mm:m.shape==='sheet'?(m.width_mm||null):null,stock_len_mm:m.stock_len_mm||null,sheet_w:m.sheet_w||null,sheet_l:m.sheet_l||null}))));
  // новые расценки — к объектам в работе только по согласию
  const changed=d.ops.filter(o=>{const p=old.find(x=>x.id===o.id);return p&&(+p.rate!==+o.rate||+p.norm_days!==+o.norm_days)});
  const used=[...new Set(specLines.filter(l=>l.item_id===id).map(l=>l.project_id))].filter(pid=>data.find(o=>o.id===pid&&o.status!=='Выполнено'));
  if(changed.length&&used.length&&confirm(`Расценки изменились. Применить новые расценки к объектам в работе (${used.length})? Уже записанная работа не пересчитается.`)){
   for(const o of changed)for(const pid of used){const ids=projOps.filter(x=>x.project_id===pid&&x.catalog_op_id===o.id).map(x=>x.id);for(const pid2 of ids)await q(sb.from('project_ops').update({rate:+o.rate||0,norm_days:+o.norm_days||0}).eq('id',pid2))}
  }
  await loadProd();
  for(const pid of used)await syncProject(pid,true);
  if(used.length)await loadProd();
  toast('Изделие сохранено');
  if(d.back)openSpecAdd(d.back,id);else openCatalog();
 }catch(e){b.disabled=false;b.textContent='Сохранить изделие';serverError(e);alert('Не удалось сохранить: '+(e.message||e))}
}
async function archiveCatItem(id){if(!confirm('Убрать изделие из справочника? В объектах, где оно уже есть, ничего не изменится.'))return;try{await q(sb.from('catalog_items').update({archived:true}).eq('id',id));await loadProd();openCatalog()}catch(e){alert('Не удалось: '+(e.message||e))}}

/* ---------- Спецификация и план объекта ---------- */
function opDone(opId){return (typeof pieces!=='undefined'?pieces:[]).filter(p=>p.project_op_id===opId&&p.kind==='work').reduce((s,p)=>s+(+p.qty||0),0)}
function projectLabor(pid){
 const ps=(typeof pieces!=='undefined'?pieces:[]).filter(p=>p.project_id===pid),ds=(typeof tdays!=='undefined'?tdays:[]).filter(t=>t.project_id===pid);
 return {piece:ps.reduce((s,p)=>s+(+p.amount||0),0),day:ds.reduce((s,t)=>s+dayAmount(t),0),days:ds.reduce((s,t)=>s+(+t.mark||0),0),redo:ps.filter(p=>p.kind!=='work'&&p.kind!=='other').reduce((s,p)=>s+(+p.amount||0),0)};
}
function specBoxHtml(pid){
 const own=isOwner(),lines=specLines.filter(l=>l.project_id===pid),li=id=>{const i=lines.findIndex(l=>l.id===id);return i<0?999:i},cs=id=>catOps.find(c=>c.id===id)?.sort??99,ops=projOps.filter(o=>o.project_id===pid).sort((a,b)=>li(a.spec_line_id)-li(b.spec_line_id)||cs(a.catalog_op_id)-cs(b.catalog_op_id));
 if(prodError)return `<div class=info><div class=label>Спецификация</div><div class=small>Не загрузилась: ${esc(prodError)}</div></div>`;
 const pieceOps=ops.filter(o=>o.pay_type==='piece'&&+o.qty_plan>0),dayOps=ops.filter(o=>o.pay_type==='day'&&+o.qty_plan>0);
 const planPiece=pieceOps.reduce((s,o)=>s+o.qty_plan*o.rate,0),planDays=dayOps.reduce((s,o)=>s+o.qty_plan*o.norm_days,0);
 const lab=own?projectLabor(pid):null,pp=parts.filter(p=>p.project_id===pid),toOrder=pp.filter(p=>p.status==='order').length,ready=pp.filter(p=>p.status==='ready').length;
 let h=`<div class=info id=specBox><div class=dHead><div class=label>Спецификация</div>${own?`<button class=chip onclick="openCatalog()">Справочник</button>`:''}</div>`;
 h+=lines.map(l=>{const item=catItems.find(i=>i.id===l.item_id);return `<div class=specLine><div><b>${esc(l.item_name)}</b>${item?'':'<div class=small>изделие убрано из справочника</div>'}</div>${own?`<input class=specQty inputmode=decimal value="${num(l.qty)}" aria-label="Количество ${esc(l.item_name)}" onchange="specQty('${l.id}',this)"><span class=small>шт</span><button class=edDel aria-label="Убрать из спецификации" onclick="specDelete('${l.id}')">×</button>`:`<b>${num(l.qty)} шт</b>`}</div>`}).join('')||`<div class=small>Изделий пока нет. Старое описание: «${esc(data.find(o=>o.id===pid)?.items||'—')}»</div>`;
 if(own)h+=`<button class="btn secondary wide" onclick="openSpecAdd('${pid}')">+ Изделие из справочника</button>`;
 if(ops.length){
  h+=`<div class=label style="margin-top:12px">План работ</div>`;
  h+=pieceOps.map(o=>{const done=opDone(o.id),pct=o.qty_plan?Math.min(100,done/o.qty_plan*100):100;return `<div class=planRow><div><span class="pt sd">сдельно</span>${esc(o.item_name)} — ${esc(o.name)}<div class=small>${own?`${num(done)} из ${num(o.qty_plan)} шт`:`план ${num(o.qty_plan)} шт`}${done>o.qty_plan?' · перевыполнение':''}</div>${own?`<div class=bar><i style="width:${pct}%"></i></div>`:''}</div>${own?`<b>${rub(o.qty_plan*o.rate)}</b>`:''}</div>`}).join('');
  h+=dayOps.map(o=>`<div class=planRow><div><span class="pt dn">посуточно</span>${esc(o.item_name)} — ${esc(o.name)}<div class=small>${num(o.qty_plan*o.norm_days)} чел-дн по плану</div></div></div>`).join('');
  if(own){const doneVal=pieceOps.reduce((s,o)=>s+Math.min(opDone(o.id),o.qty_plan)*o.rate,0),pw=(typeof pieces!=='undefined'?pieces:[]).filter(p=>p.project_id===pid),workRub=pw.filter(p=>p.kind==='work').reduce((s,p)=>s+(+p.amount||0),0),otherRub=pw.filter(p=>p.kind==='other').reduce((s,p)=>s+(+p.amount||0),0),over=lab.days>planDays+1e-9&&planDays>0;
  h+=`<div class=kvRow style="margin-top:8px"><span>Сделано работ по плану на сумму</span><b>${rub(doneVal)} из ${rub(planPiece)}</b></div><div class=kvRow><span>Сдельно: начислено за работу</span><b>${rub(workRub)}</b></div>${lab.redo?`<div class=kvRow><span>Переделки</span><b class=neg>${rub(lab.redo)}</b></div>`:''}${otherRub?`<div class=kvRow><span>Другая работа (вне плана)</span><b>${rub(otherRub)}</b></div>`:''}<div class=kvRow><span>Посуточно</span><b class="${over?'neg':''}">${num(lab.days,1)} из ${num(planDays,1)} чел-дн · ${rub(lab.day)}</b></div>${over?`<div class=small style="color:var(--red)">Перерасход дней: +${num(lab.days-planDays,1)} чел-дн</div>`:''}<div class=kvRow><span><b>Труд по объекту всего</b></span><b>${rub(lab.piece+lab.day)}</b></div>`}
 if(own&&typeof itemMatCost==='function'){const mc=lines.reduce((s,l)=>s+(+l.qty||0)*itemMatCost(l.item_id).sum,0);if(mc)h+=`<div class=kvRow><span><b>Материалы по прайсу (план)</b></span><b>${rub(mc)}</b></div>`}
 }
 if(pp.length)h+=`<button class=linkBtn onclick="closeModal();shopFilter='${pid}';shopKind=['wood','metal','other'].find(k=>parts.some(p=>p.project_id==='${pid}'&&p.kind===k))||shopKind;showView('wood')">Детали в цеху: ${pp.length} · готово ${ready}${toOrder?' · к заказу '+toOrder:''} →</button>`;
 return h+'</div>';
}
function openSpecAdd(pid,preselect){
 const items=catItems.filter(i=>!i.archived);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Изделие в спецификацию</h2><div class=summary>${esc(projName(pid))}</div>
 ${items.length?`<label class=field>Изделие<select id=saItem>${items.map(i=>`<option value="${i.id}" ${i.id===preselect?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label><label class=field>Количество, шт<input id=saQty inputmode=decimal value="1"></label>`:'<div class=empty>В справочнике пока нет изделий</div>'}
 <button class="btn secondary wide" onclick="openCatItem(null,'${pid}')">+ Новое изделие в справочник</button>
 <div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button>${items.length?`<button class=btn id=saSave>Добавить</button>`:''}</div>`;
 openModal();
 if($('saSave'))$('saSave').onclick=async()=>{const b=$('saSave');if(b.disabled)return;const it=catItems.find(i=>i.id===$('saItem').value),n=qtyVal($('saQty').value);if(!it)return;if(!n)return alert('Укажите количество');b.disabled=true;b.textContent='Сохраняю…';
  try{await q(sb.from('spec_lines').insert({workspace_id:currentWorkspace,project_id:pid,item_id:it.id,item_name:it.name,qty:n,sort:specLines.filter(l=>l.project_id===pid).length}));await loadProd();await syncProject(pid);toast(it.name+' · '+num(n)+' шт добавлено');detail(pid)}catch(e){b.disabled=false;b.textContent='Добавить';serverError(e);alert('Не удалось: '+(e.message||e))}};
}
async function specQty(lineId,el){const l=specLines.find(x=>x.id===lineId);if(!l)return;const n=qtyVal(el.value);if(!n){el.value=num(l.qty);return alert('Количество должно быть больше нуля. Чтобы убрать изделие — нажмите ×')}
 const done=projOps.filter(o=>o.spec_line_id===lineId&&o.pay_type==='piece').map(o=>opDone(o.id)).reduce((a,b)=>Math.max(a,b),0);
 if(n<done&&!confirm(`По этому изделию уже сделано ${num(done)} шт. Всё равно поставить ${num(n)}? Сделанное останется оплаченным и покажется как перевыполнение.`)){el.value=num(l.qty);return}
 try{await q(sb.from('spec_lines').update({qty:n}).eq('id',lineId));await loadProd();await syncProject(l.project_id);toast('Количество: '+num(n)+' шт')}catch(e){failSave(e)}}
async function specDelete(lineId){const l=specLines.find(x=>x.id===lineId);if(!l)return;const busy=projOps.some(o=>o.spec_line_id===lineId&&opDone(o.id)>0)||parts.some(p=>p.spec_line_id===lineId&&p.status!=='order');
 if(!confirm(`Убрать «${l.item_name}» из спецификации?${busy?' Работа и детали уже есть — записанное останется, детали «к заказу» удалятся.':''}`))return;
 try{await q(sb.from('spec_lines').delete().eq('id',lineId));await loadProd();await syncProject(l.project_id);toast('Изделие убрано')}catch(e){failSave(e)}}
// Пересобрать план работ и детали объекта из спецификации. Расценки в плане фиксируются при создании.
async function syncProject(pid,silent){
 const lines=specLines.filter(l=>l.project_id===pid),wantOps=new Set(),wantParts=new Set(),surplus=[];
 for(const l of lines){
  const item=catItems.find(i=>i.id===l.item_id);if(!item)continue;
  for(const o of catOps.filter(x=>x.item_id===item.id)){
   const ex=projOps.find(x=>x.spec_line_id===l.id&&x.catalog_op_id===o.id);
   if(ex){wantOps.add(ex.id);if(+ex.qty_plan!==+l.qty||ex.item_name!==l.item_name)await q(sb.from('project_ops').update({qty_plan:l.qty,item_name:l.item_name}).eq('id',ex.id))}
   else{const id=uuid();wantOps.add(id);await q(sb.from('project_ops').insert({id,workspace_id:currentWorkspace,project_id:pid,spec_line_id:l.id,catalog_op_id:o.id,item_name:l.item_name,name:o.name,pay_type:o.pay_type,rate:+o.rate||0,norm_days:+o.norm_days||0,qty_plan:l.qty}))}
  }
  for(const m of catMats.filter(x=>x.item_id===item.id)){
   // Заказанное, пришедшее и готовое не трогаем: разница — отдельной деталью «к заказу», излишек — предупреждением
   const mine=parts.filter(x=>x.spec_line_id===l.id&&x.catalog_material_id===m.id),need=Math.round(l.qty*m.qty*1000)/1000;
   const fixed=mine.filter(x=>x.status!=='order'),open=mine.filter(x=>x.status==='order'),have=fixed.reduce((s,x)=>s+(+x.qty||0),0),diff=Math.round((need-have)*1000)/1000;
   fixed.forEach(x=>wantParts.add(x.id));
   const body={kind:m.kind,name:m.name,size:m.size||'',length_mm:m.length_mm||null,unit:m.unit||'шт',shape:m.shape||(m.kind==='other'?'piece':'linear'),price_item_id:m.price_item_id||null,width_mm:m.width_mm||null,stock_len_mm:m.stock_len_mm||null,sheet_w:m.sheet_w||null,sheet_l:m.sheet_l||null};
   if(diff<0)surplus.push(`${m.name} ${m.size||''}: заказано больше нужного на ${num(-diff)} ${m.length_mm?'шт':m.unit||'шт'}`);
   if(diff>0){const ex=open[0];
    if(ex){wantParts.add(ex.id);const same=+ex.qty===diff&&Object.keys(body).every(k=>String(ex[k]??'')===String(body[k]??''));if(!same)await q(sb.from('shop_parts').update({...body,qty:diff,updated_at:new Date().toISOString()}).eq('id',ex.id))}
    else{const id=uuid();wantParts.add(id);await q(sb.from('shop_parts').insert({id,workspace_id:currentWorkspace,project_id:pid,spec_line_id:l.id,catalog_material_id:m.id,...body,qty:diff,status:'order',source:'auto',note:l.item_name+(fixed.length?' (добавка)':''),created_by:currentUser.id}))}}
  }
 }
 for(const o of projOps.filter(x=>x.project_id===pid&&!wantOps.has(x.id)&&x.catalog_op_id)){
  const used=(typeof pieces!=='undefined'?pieces:[]).some(p=>p.project_op_id===o.id);
  if(used){if(+o.qty_plan!==0)await q(sb.from('project_ops').update({qty_plan:0}).eq('id',o.id))}else await q(sb.from('project_ops').delete().eq('id',o.id));
 }
 for(const p of parts.filter(x=>x.project_id===pid&&x.source==='auto'&&!wantParts.has(x.id)&&x.status==='order'))await q(sb.from('shop_parts').delete().eq('id',p.id));
 await loadProd();if(!silent){renderCurrent();refreshDetail(pid)}
 if(surplus.length)setTimeout(()=>alert('Изделий стало меньше, чем уже заказано:\n'+surplus.join('\n')+'\n\nЛишнее останется в цеху — отмените заказ у поставщика или пустите в другой объект.'),50);
}

/* ---------- Цех ---------- */
function partMeters(p){return p.shape!=='sheet'&&p.length_mm?p.length_mm/1000*(+p.qty||0):0}
function partArea(p){return p.shape==='sheet'?(+p.width_mm||0)*(+p.length_mm||0)/1e6*(+p.qty||0):0}
function partLine(p){return p.shape==='sheet'?`${num(p.width_mm,0)}×${num(p.length_mm,0)} мм × ${num(p.qty)} шт · ${num(partArea(p),3)} м²`:p.length_mm?`${num(p.length_mm,0)} мм × ${num(p.qty)} шт`:`${num(p.qty)} ${esc(p.unit||'шт')}`}
function barHint(p){if(p.kind!=='metal'||p.shape==='sheet'||!p.length_mm)return '';const st=p.stock_len_mm||6000,per=Math.floor(st/p.length_mm);return per>0?` · из хлыста ${num(st/1000,1)} м по ${per} шт → ${Math.ceil((+p.qty||0)/per)} хл.`:` · ⚠ длиннее хлыста ${num(st/1000,1)} м — нужен мерный`}
const sizeShow=s=>String(s||'').replace(/(\d)\s*[xх*]\s*(?=\d)/gi,'$1×');
const capFirst=s=>s?s[0].toUpperCase()+s.slice(1):s;
function renderShop(){
 const projIds=new Set(activeProjects().map(o=>o.id)),all=parts.filter(p=>projIds.has(p.project_id)&&p.kind===shopKind);
 const projs=activeProjects().filter(o=>all.some(p=>p.project_id===o.id));
 if(shopFilter&&!projs.some(o=>o.id===shopFilter))shopFilter='';
 const counts=k=>parts.filter(p=>projIds.has(p.project_id)&&p.kind===k&&p.status!=='ready').length;
 let h=`<div class=segBar>${['wood','metal','other'].map(k=>`<button class="${shopKind===k?'on':''}" onclick="shopKind='${k}';shopFilter='';renderShop()">${KIND_ICON[k]} ${k==='other'?'Прочее':KIND_NAME[k]}${counts(k)?` · ${counts(k)}`:''}</button>`).join('')}</div>`;
 if(prodError)h+=`<div class=empty>Цех не загрузился: ${esc(prodError)}</div>`;
 if(projs.length>1)h+=`<div class=chipRow><button class="chip ${!shopFilter?'on':''}" onclick="shopFilter='';renderShop()">Все объекты</button>${projs.map(o=>`<button class="chip ${shopFilter===o.id?'on':''}" onclick="shopFilter='${o.id}';renderShop()">${esc(o.name)}</button>`).join('')}</div>`;
 const shown=projs.filter(o=>!shopFilter||o.id===shopFilter);
 h+=shown.map(o=>{const ps=all.filter(p=>p.project_id===o.id).sort((a,b)=>String(a.note).localeCompare(String(b.note),'ru')||a.name.localeCompare(b.name,'ru')||String(a.size).localeCompare(String(b.size),'ru')||String(a.created_at).localeCompare(String(b.created_at)));return `<div class=sectionTitle><b>${esc(o.name)}</b><span>готово ${ps.filter(p=>p.status==='ready').length} из ${ps.length}</span></div><div class=partList>${ps.map(partRowHtml).join('')}</div>`}).join('')||(prodError?'':`<div class=empty>${shopKind==='other'?'Метизов и прочего нет':'Деталей нет'}.<br>Они появятся сами из спецификации объекта (изделия × материалы из справочника), или добавьте вручную.</div>`);
 h+=`<button class="btn wide" style="margin-top:12px" onclick="openPart()">+ Деталь вручную</button>`;
 $('woodBody').innerHTML=h;
}
function partRowHtml(p){return `<div class=partRow><button class=partMain onclick="openPart('${p.id}')"><b>${p.note&&p.source==='auto'?esc(p.note)+' — ':''}${esc(p.name)} ${esc(p.size||'')}</b><span>${partLine(p)}${barHint(p)}${p.source!=='auto'&&p.note?' · '+esc(p.note):''}${p.status==='ordered'&&p.supplier?' · '+esc(p.supplier):''}</span></button><button class="st st_${p.status}" onclick="partNext('${p.id}')" aria-label="Статус: ${PART_LABEL[p.status]}, нажмите для следующего">${PART_LABEL[p.status]}</button></div>`}
const partBusy={};// защита от двойного тапа
async function partNext(id){
 const p=parts.find(x=>x.id===id);if(!p)return;if(partBusy[id]&&Date.now()-partBusy[id]<600)return;partBusy[id]=Date.now();
 let i=PART_STATUS.indexOf(p.status),next=PART_STATUS[i+1];
 if(!next)return toast('Деталь готова. Чтобы изменить статус — откройте деталь');
 const prev=p.status;p.status=next;renderCurrent();
 try{await q(sb.from('shop_parts').update({status:next,updated_at:new Date().toISOString(),...(next==='ordered'&&!p.ordered_on?{ordered_on:localISO()}:{})}).eq('id',id));
  toast(`${p.name} ${p.size||''}: ${PART_LABEL[next]}`,async()=>{p.status=prev;renderCurrent();try{await q(sb.from('shop_parts').update({status:prev}).eq('id',id))}catch(e){failSave(e)}})}
 catch(e){p.status=prev;renderCurrent();failSave(e)}
}
function openPart(id){
 const p=parts.find(x=>x.id===id)||{kind:shopKind,name:'',size:'',length_mm:null,qty:1,unit:'шт',status:'order',project_id:shopFilter||activeProjects()[0]?.id,note:''};
 const projs=activeProjects();if(!projs.length)return alert('Нет объектов в работе');
 const canDel=p.id&&(isOwner()||p.created_by===currentUser?.id);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${p.id?'Деталь':'Новая деталь'}</h2>${p.source==='auto'?'<div class=small>Деталь из спецификации: размеры и количество меняются в справочнике изделия или в количестве изделий.</div>':''}
 <label class=field>Объект<select id=ppProj ${p.source==='auto'?'disabled':''}>${projs.map(o=>`<option value="${o.id}" ${o.id===p.project_id?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label>
 <label class=field>Вид<select id=ppKind ${p.source==='auto'?'disabled':''}>${['wood','metal','other'].map(k=>`<option value=${k} ${p.kind===k?'selected':''}>${KIND_ICON[k]} ${KIND_NAME[k]}</option>`).join('')}</select></label>
 <datalist id=matNames2>${MAT_NAMES.map(n=>`<option value="${n}">`).join('')}</datalist>
 <label class=field>Материал<input id=ppName list=matNames2 value="${esc(p.name)}" placeholder="Лиственница / Труба проф. / Болт" ${p.source==='auto'?'disabled':''}></label>
 <label class=field>Форма<select id=ppShape ${p.source==='auto'?'disabled':''}><option value=linear ${p.shape!=='sheet'&&p.shape!=='piece'?'selected':''}>Погонаж (длина)</option><option value=sheet ${p.shape==='sheet'?'selected':''}>Лист (ширина × длина)</option><option value=piece ${p.shape==='piece'?'selected':''}>Штучно</option></select></label>
 <div class=inlineRow><label class=field>Размер / толщина<input id=ppSize value="${esc(p.size||'')}" placeholder="40×90" ${p.source==='auto'?'disabled':''}></label><label class=field>Длина, мм<input id=ppLen inputmode=numeric value="${p.length_mm||''}" placeholder="1500" ${p.source==='auto'?'disabled':''}></label></div>
 <div class=inlineRow id=ppSheetBox ${p.shape==='sheet'?'':'hidden'}><label class=field>Ширина детали, мм<input id=ppW inputmode=numeric value="${p.width_mm||''}" ${p.source==='auto'?'disabled':''}></label><label class=field>Лист, мм<input id=ppSheet value="${p.sheet_w?p.sheet_w+'×'+p.sheet_l:'1250×2500'}" ${p.source==='auto'?'disabled':''}></label></div>
 <div class=inlineRow><label class=field>Количество<input id=ppQty inputmode=decimal value="${num(p.qty)}" ${p.source==='auto'?'disabled':''}></label><label class=field>Ед.<select id=ppUnit ${p.source==='auto'?'disabled':''}>${UNITS.map(u=>`<option ${p.unit===u?'selected':''}>${u}</option>`).join('')}</select></label></div>
 <label class=field>Статус<select id=ppStatus>${PART_STATUS.map(s=>`<option value=${s} ${p.status===s?'selected':''}>${PART_LABEL[s]}</option>`).join('')}</select></label>
 <label class=field>Поставщик<input id=ppSup value="${esc(p.supplier||'')}" placeholder="необязательно"></label>
 ${p.source!=='auto'?`<label class=field>Примечание<input id=ppNote value="${esc(p.note||'')}" placeholder="для чего деталь"></label>`:''}
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=ppSave>Сохранить</button></div>${canDel?`<button class=dangerLink onclick="deletePart('${p.id}')">Удалить деталь</button>`:''}`;
 openModal();
 if($('ppShape'))$('ppShape').onchange=e=>{$('ppSheetBox').hidden=e.target.value!=='sheet'};
 const WOOD=/лиственн|сосн|ель|дуб|берёз|берез|доск|брус|вагонк|фанер/i,METAL=/труб|уголок|полос|лист|швеллер|арматур|пруток|двутавр|профил/i;
 if($('ppName')&&!p.id)$('ppName').oninput=e=>{const v=e.target.value,k=WOOD.test(v)?'wood':METAL.test(v)?'metal':/болт|гайк|саморез|анкер|краск|грунт|эмаль|шайб/i.test(v)?'other':'';if(k&&$('ppKind').value!==k){$('ppKind').value=k;$('ppKind').dispatchEvent(new Event('change'))}};
 $('ppSave').onclick=async()=>{const b=$('ppSave');if(b.disabled)return;
  const body={status:$('ppStatus').value,supplier:$('ppSup').value.trim(),updated_at:new Date().toISOString()};
  if(p.source!=='auto'){Object.assign(body,{project_id:$('ppProj').value,kind:$('ppKind').value,name:$('ppName').value.trim(),size:$('ppSize').value.trim(),length_mm:Math.round(qtyVal($('ppLen').value))||null,qty:qtyVal($('ppQty').value),unit:$('ppUnit').value,note:$('ppNote').value.trim()});body.size=sizeShow(body.size);body.shape=body.kind==='other'?'piece':$('ppShape').value;if(body.shape==='sheet'){body.width_mm=Math.round(qtyVal($('ppW').value))||null;const sd=($('ppSheet').value.match(/\d+/g)||[]).map(Number);body.sheet_w=sd[0]||1250;body.sheet_l=sd[1]||2500;if(!body.width_mm||!body.length_mm)return alert('Для листовой детали укажите ширину и длину в мм')}if(body.shape==='piece')body.length_mm=null;if(!body.name)return alert('Укажите материал');if(!body.qty)return alert('Укажите количество');if(body.kind==='other')body.length_mm=null}
  if(body.status==='ordered'&&!p.ordered_on)body.ordered_on=localISO();
  b.disabled=true;b.textContent='Сохраняю…';
  try{if(p.id)await q(sb.from('shop_parts').update(body).eq('id',p.id));else await q(sb.from('shop_parts').insert({...body,workspace_id:currentWorkspace,source:'manual',created_by:currentUser.id}));shopKind=body.kind||shopKind;await loadProd();closeModal();renderCurrent();toast('Деталь сохранена')}
  catch(e){b.disabled=false;b.textContent='Сохранить';serverError(e);alert('Не удалось: '+(e.message||e))}};
}
async function deletePart(id){if(!confirm('Удалить деталь?'))return;try{await q(sb.from('shop_parts').delete().eq('id',id));await loadProd();closeModal();renderCurrent()}catch(e){alert('Не удалось удалить: '+(e.message||e))}}

/* ---------- Снабжение ---------- */
function sectionArea(size){const n=normSize(size).split('×').map(Number).filter(x=>x>0);return n.length>=2?n[0]*n[1]/1e6:0}
function supplyGroups(){
 const ids=new Set(activeProjects().map(o=>o.id)),g=new Map(),own=isOwner();
 for(const p of parts){if(!ids.has(p.project_id))continue;
  const sh=p.shape==='sheet',lin=!sh&&p.kind!=='other'&&p.shape!=='piece'&&p.length_mm;
  const key=sh?['sheet',p.price_item_id||p.name.trim().toLowerCase(),p.sheet_w||0,p.sheet_l||0].join('|'):[p.kind,p.price_item_id||p.name.trim().toLowerCase(),p.price_item_id?'':normSize(p.size),lin?'m':p.unit].join('|');
  let x=g.get(key);if(!x){x={key,kind:p.kind,name:capFirst(p.name.trim()),size:sizeShow(p.size),unit:sh?'м²':lin?'м':(p.unit||'шт'),linear:!!lin,sheet:sh,sheetW:+p.sheet_w||0,sheetL:+p.sheet_l||0,need:0,have:0,ordered:0,order:0,bars:0,vol:0,parts:[],suppliers:new Set(),byLen:{},longM:0,orderedOn:'',price:own&&typeof priceById==='function'?priceById(p.price_item_id):null};g.set(key,x)}
  const v=sh?partArea(p):lin?partMeters(p):(+p.qty||0);x.need+=v;x.parts.push(p);
  if(p.status==='order'){x.order+=v;if(lin&&p.kind==='metal'){const st=p.stock_len_mm||6000;if(p.length_mm>st)x.longM+=partMeters(p);else{const k=p.length_mm+'|'+st;x.byLen[k]=(x.byLen[k]||0)+(+p.qty||0)}}if(p.kind==='wood')x.vol+=partMeters(p)*sectionArea(p.size)}
  else if(p.status==='ordered'){x.ordered+=v;if(p.supplier)x.suppliers.add(p.supplier);if(p.ordered_on&&(!x.orderedOn||p.ordered_on<x.orderedOn))x.orderedOn=p.ordered_on}else x.have+=v;
 }
 const w=typeof wastePct==='function'?wastePct():20;
 for(const x of g.values()){
  x.barsM=0;x.bars=Object.entries(x.byLen).reduce((s,[k,n])=>{const [len,st]=k.split('|').map(Number),b=Math.ceil(n/Math.floor(st/len));x.barsM+=b*st/1000;return s+b},0);
  if(x.sheet){const sa=x.sheetW*x.sheetL/1e6;x.sheetArea=sa;x.orderArea=x.order*(1+w/100);x.sheets=sa?Math.ceil(x.orderArea/sa-1e-9):0}
  x.cost=null;if(x.price&&x.order>0){const pr=+x.price.price;if(x.sheet)x.cost=x.sheets*pr;else if(x.linear)x.cost=x.kind==='metal'?(x.barsM+x.longM)*pr:x.order*pr;else x.cost=x.order*pr}
 }
 return [...g.values()].sort((a,b)=>['metal','wood','other'].indexOf(a.kind)-['metal','wood','other'].indexOf(b.kind)||a.name.localeCompare(b.name,'ru')||a.size.localeCompare(b.size,'ru'));
}
function supplyQty(x,which){const v=x[which],w=typeof wastePct==='function'?wastePct():20,cost=which==='order'&&x.cost!=null?' · '+rub(x.cost):'';
 if(x.sheet){if(which==='order'&&x.sheetArea)return {big:`${x.sheets} ${plural(x.sheets,'лист','листа','листов')}`,sub:`${num(v,3)} м² + ${num(w)}% = ${num(x.orderArea,3)} м² · лист ${num(x.sheetArea,3)} м²${cost}`};return {big:`${num(v,2)} м²`,sub:''}}
 if(x.linear){const m=Math.ceil(Math.round(v*1000)/100)/10;if(x.kind==='metal'&&which==='order'&&(x.bars||x.longM)){const st=[...new Set(Object.keys(x.byLen).map(k=>+k.split('|')[1]/1000))];return {big:x.bars?`${x.bars} ${plural(x.bars,'хлыст','хлыста','хлыстов')}`:`${num(m,1)} м`,sub:`${num(m,1)} м · хлыст ${st.map(s=>num(s,1)).join('/')||6} м`+(x.longM?` · ⚠ ${num(x.longM,1)} м деталей длиннее хлыста — мерные`:'')+cost}}if(x.kind==='wood'&&which==='order'&&x.vol)return {big:`${num(Math.ceil(v),0)} м`,sub:`≈ ${num(x.vol,2)} м³`};return {big:`${num(m,1)} м`,sub:cost.replace(/^ · /,'')}}
 return {big:`${num(v)} ${x.unit}`,sub:cost.replace(/^ · /,'')}}
function supplyText(groups){return groups.filter(x=>x.order>0).map(x=>{const s=supplyQty(x,'order');return `${x.name} ${x.size}`.trim()+' — '+s.big+(()=>{const t=String(s.sub||'').replace(/(^| · )[\d\s\u00a0,]+ ₽$/,'').trim();return t&&!x.sheet?` (${t})`:''})()}).join('\n')}
function renderSupply(){
 const gs=supplyGroups(),list=gs.filter(x=>supplyTab==='order'?x.order>0:x.ordered>0),nO=gs.filter(x=>x.order>0).length,nD=gs.filter(x=>x.ordered>0).length;
 let h=`<div class=segBar><button class="${supplyTab==='order'?'on':''}" onclick="supplyTab='order';renderSupply()">К заказу · ${nO}</button><button class="${supplyTab==='ordered'?'on':''}" onclick="supplyTab='ordered';renderSupply()">Заказано · ${nD}</button></div>`;
 if(prodError)h+=`<div class=empty>Не загрузилось: ${esc(prodError)}</div>`;
 let last='';
 h+=list.map(x=>{const s=supplyQty(x,supplyTab),head=x.kind!==last?`<div class=sectionTitle><b>${KIND_ICON[x.kind]} ${KIND_NAME[x.kind]}</b></div>`:'';last=x.kind;
  return head+`<button class=supRow onclick="openSupplyGroup('${esc(x.key)}')"><div><b>${esc(x.name)} ${esc(x.size)}</b><span>${supplyTab==='order'?`нужно ${num(x.need,x.sheet?2:1)} ${x.unit} · есть ${num(x.have,x.sheet?2:1)}${x.ordered?` · заказано ${num(x.ordered,1)}`:''}`:`${[...x.suppliers].map(esc).join(', ')||'поставщик не указан'}${x.orderedOn?` · заказано ${fmt(x.orderedOn)} · ждём ${Math.max(0,-days(x.orderedOn))} дн.`:''}`}</span></div><div class=supBig>${s.big}${s.sub?`<small>${s.sub}</small>`:''}</div></button>`}).join('')||(prodError?'':`<div class=empty>${supplyTab==='order'?'Заказывать нечего 👍<br>Материалы появятся, когда в объектах будут детали со статусом «к заказу».':'Нет заказанного, которое ждём'}</div>`);
 const tot=list.reduce((s,x)=>s+(supplyTab==='order'&&x.cost?x.cost:0),0);if(tot)h+=`<div class=info><div class=kvRow><span><b>К заказу по прайсу</b></span><b>${rub(tot)}</b></div><div class=small>по позициям, привязанным к прайсу; целые хлысты и листы</div></div>`;
 if(supplyTab==='order'&&nO)h+=`<div class=stickyActions><button class="btn secondary" onclick="openSupplyText()">Заявка текстом</button><button class=btn onclick="orderAll()">Всё заказано ✓</button></div>`;
 $('supplyBody').innerHTML=h;
}
function openSupplyGroup(key){
 const x=supplyGroups().find(g=>g.key===key);if(!x)return;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(x.name)} ${esc(x.size)}</h2><div class=summary>нужно ${num(x.need,1)} ${x.unit} · есть ${num(x.have,1)} · заказано ${num(x.ordered,1)} · к заказу ${num(x.order,1)}</div>
 <div class=info><div class=label>По объектам</div>${x.parts.map(p=>`<div class=doc><span>${esc(projName(p.project_id))}<br><span class=small>${p.note?esc(p.note)+' · ':''}${partLine(p)}</span></span><span class="st st_${p.status}">${PART_LABEL[p.status]}</span></div>`).join('')}</div>
 ${x.order>0?`<label class=field>Поставщик<input id=sgSup placeholder="например: Металлобаза Юг" value="${esc([...x.suppliers][0]||'')}"></label><button class="btn wide" id=sgOrder>Заказал ${supplyQty(x,'order').big}</button>`:''}
 ${x.ordered>0?`${isOwner()?`<label class=field>Сумма по счёту, ₽ — запишется в расходы объектов<input id=sgSum inputmode=decimal value="${(()=>{const c=x.parts.filter(p=>p.status==='ordered').reduce((s,p)=>s+(typeof partCost==='function'?partCost(p):0),0);return c?moneyText(Math.round(c*100)/100):''})()}" placeholder="можно пусто"></label>`:''}<button class="btn wide" id=sgCame style="margin-top:8px">Пришло всё заказанное</button>`:''}`;
 openModal();
 const set=async(from,to,extra,b)=>{if(b.disabled)return;b.disabled=true;try{for(const p of x.parts.filter(p=>p.status===from))await q(sb.from('shop_parts').update({status:to,updated_at:new Date().toISOString(),...extra}).eq('id',p.id));await loadProd();closeModal();renderCurrent();toast(to==='ordered'?'Отмечено «заказано»':'Пришло — в цеху теперь «есть»')}catch(e){b.disabled=false;failSave(e)}};
 if($('sgOrder'))$('sgOrder').onclick=e=>set('order','ordered',{supplier:$('sgSup').value.trim(),ordered_on:localISO()},e.target);
 if($('sgSum'))$('sgSum').oninput=e=>fmtMoneyInput(e.target);
 if($('sgCame'))$('sgCame').onclick=async e=>{const sum=$('sgSum')?moneyVal($('sgSum').value):0,arr=x.parts.filter(p=>p.status==='ordered');
  if(sum>0&&isOwner()){const w=arr.map(p=>(typeof partCost==='function'?partCost(p):0)||(x.sheet?partArea(p):x.linear?partMeters(p):(+p.qty||0))),tw=w.reduce((a,b)=>a+b,0)||1,by=new Map();arr.forEach((p,i)=>by.set(p.project_id,(by.get(p.project_id)||0)+w[i]/tw*sum));
   const rows=[...by.entries()].map(([pid,a])=>({workspace_id:currentWorkspace,project_id:pid,category:'materials',amount:Math.round(a*100)/100,spent_on:localISO(),method:'bank',note:`${x.name} ${x.size}`.trim(),source:'supply',created_by:currentUser.id})).filter(r=>r.amount);
   const diff=Math.round((sum-rows.reduce((s,r)=>s+r.amount,0))*100)/100;if(rows.length&&diff)rows[rows.length-1].amount=Math.round((rows[rows.length-1].amount+diff)*100)/100;
   try{await q(sb.from('project_expenses').insert(rows))}catch(err){return failSave(err)}}
  set('ordered','stock',{},e.target)};
}
function openSupplyText(){
 const t=supplyText(supplyGroups());
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Заявка поставщику</h2><textarea id=supText class=supText rows=10>${esc(t)}</textarea><div class=actions><button class="btn secondary" onclick=closeModal()>Закрыть</button><button class=btn id=supCopy>Скопировать</button></div>`;
 openModal();$('supCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('supText').value);toast('Скопировано — вставьте в WhatsApp')}catch(e){$('supText').select();toast('Выделено — скопируйте вручную')}};
}
async function orderAll(){
 const ps=parts.filter(p=>p.status==='order'&&activeProjects().some(o=>o.id===p.project_id));if(!ps.length)return;
 const ng=supplyGroups().filter(x=>x.order>0).length;const sup=prompt(`Отметить «заказано» всё к заказу (${ng} ${plural(ng,'позиция','позиции','позиций')})? Поставщик (можно пусто):`,'');if(sup===null)return;
 try{for(const p of ps)await q(sb.from('shop_parts').update({status:'ordered',supplier:sup.trim(),ordered_on:localISO(),updated_at:new Date().toISOString()}).eq('id',p.id));await loadProd();renderCurrent();toast('Всё отмечено «заказано»')}catch(e){failSave(e)}
}
