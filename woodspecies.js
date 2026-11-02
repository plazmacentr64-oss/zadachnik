'use strict';
// v50: дерево по породам. Типоразмер (брусок 40×60) × порода (сосна АВ, термоосина…) → реальный размер и цена за метр.
let woodSlots=[],woodSpecies=[],woodPriceMap=new Map();
const wpKey=(slot,sp)=>slot+'|'+sp;
const woodSlot=id=>woodSlots.find(s=>s.id===id);
const woodSp=id=>woodSpecies.find(s=>s.id===id);
const defaultSpecies=()=>woodSpecies[0]||null;
const woodPrice=(slot,sp)=>woodPriceMap.get(wpKey(slot,sp))||null;

async function loadWoodSpecies(){
 try{const ws=currentWorkspace,[a,b]=await Promise.all([sb.from('wood_slots').select('*').eq('workspace_id',ws),sb.from('wood_species').select('*').eq('workspace_id',ws)]);
  if(a.error||b.error)throw a.error||b.error;
  woodSlots=(a.data||[]).sort((x,y)=>(x.sort||0)-(y.sort||0));woodSpecies=(b.data||[]).sort((x,y)=>(x.sort||0)-(y.sort||0));
  if(isOwner()){const c=await fetchAll(()=>sb.from('wood_prices').select('*').eq('workspace_id',ws).order('slot_id'));if(c.error)throw c.error;woodPriceMap=new Map((c.data||[]).map(p=>[wpKey(p.slot_id,p.species_id),p]))}else woodPriceMap=new Map()}
 catch(e){console.warn('wood species',e)}
}
// Порода строки спецификации: своя → объекта → первая
function projSpecies(pid){const p=(typeof finPlans!=='undefined'&&finPlans.get(pid))||{};return p.wood_species&&woodSp(p.wood_species)?p.wood_species:null}
function lineSpecies(l){return (l.species_id&&woodSp(l.species_id)?l.species_id:null)||projSpecies(l.project_id)||defaultSpecies()?.id||null}
// Поля детали цеха для дерева по типоразмеру
function woodBody(m,l){const slot=woodSlot(m.wood_slot_id),sp=lineSpecies(l),spo=woodSp(sp),wp=woodPrice(m.wood_slot_id,sp),size=(wp&&wp.size)||slot?.nominal||'';
 return {kind:'wood',shape:'linear',name:spo?spo.name:(slot?.name||m.name),size,wood_slot_id:m.wood_slot_id,species_id:sp,stock_len_mm:wp?.stock_len_mm||null,price_item_id:null}}
// Стоимость: дерево по типоразмеру берёт цену выбранной породы
const _matCostBase=matCost;
matCost=function(m,sp){
 if(m&&m.wood_slot_id){const s=sp||defaultSpecies()?.id,wp=woodPrice(m.wood_slot_id,s);if(!wp||!(+wp.price>0))return null;const mm=(+m.length_mm||0)/1000*(+m.qty||0);return {sum:mm*wp.price,text:`${woodSp(s)?.name||''} ${wp.size}: ${num(mm,3)} м × ${rub(wp.price)}`}}
 return _matCostBase(m)};
function woodPartPrice(p){if(!p.wood_slot_id)return null;const wp=woodPrice(p.wood_slot_id,p.species_id);return wp&&+wp.price>0?{price:+wp.price,kind:'linear'}:null}

/* ---------- прайс дерева: таблица типоразмер × порода ---------- */
function openWoodGrid(){
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Дерево по породам</h2>
 <div class=small>Строка — типоразмер из техкарты, столбец — порода со своим реальным размером и ценой за метр. Тап по клетке — поправить.</div>
 <div class=wgWrap><table class=wg><tr><th>Типоразмер</th>${woodSpecies.map(s=>`<th><button class=linkBtn style="padding:0" onclick="renameSpecies('${s.id}')">${esc(s.name)}</button></th>`).join('')}</tr>
 ${woodSlots.map(sl=>`<tr><td><button class=linkBtn style="padding:0;text-align:left" onclick="editSlot('${sl.id}')">${esc(sl.name)}</button></td>${woodSpecies.map(sp=>{const wp=woodPrice(sl.id,sp.id);return `<td><button class="wgCell ${wp&&+wp.price>0?'':'empty'}" onclick="editWoodCell('${sl.id}','${sp.id}')">${wp?esc(wp.size||sl.nominal):'—'}<small>${wp&&+wp.price>0?rub(wp.price)+'/м':'нет цены'}</small></button></td>`}).join('')}</tr>`).join('')}</table></div>
 <div class=inlineRow style="margin-top:10px"><button class="btn secondary" onclick="addSpecies()">+ Порода</button><button class="btn secondary" onclick="editSlot()">+ Типоразмер</button></div>
 <button class="btn secondary wide" style="margin-top:8px" onclick="woodPct()">% Изменить цены дерева</button>
 <div class=actions><button class="btn secondary" onclick="openPriceList()">К прайсу</button></div>`;
 openModal();
}
function editWoodCell(slotId,spId){
 const sl=woodSlot(slotId),sp=woodSp(spId),wp=woodPrice(slotId,spId)||{size:sl.nominal,price:0,stock_len_mm:3000};
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(sp.name)} · ${esc(sl.name)}</h2>
 <label class=field>Реальный размер (сечение)<input id=wcSize value="${esc(wp.size||sl.nominal)}" placeholder="${esc(sl.nominal)}"></label>
 <label class=field>Цена за метр, ₽<input id=wcPrice inputmode=decimal value="${+wp.price?moneyText(wp.price):''}"></label>
 <div class=small>или посчитать из цены за штуку:</div>
 <div class=inlineRow><label class=field>Цена за шт, ₽<input id=wcPiece inputmode=decimal></label><label class=field>Длина, м<input id=wcLen inputmode=decimal value="${num((wp.stock_len_mm||3000)/1000,2)}"></label></div>
 <div class=actions><button class="btn secondary" onclick="openWoodGrid()">Назад</button><button class=btn id=wcSave>Сохранить</button></div>`;
 openModal();['wcPrice','wcPiece'].forEach(k=>$(k).oninput=e=>fmtMoneyInput(e.target));
 const calc=()=>{const pc=moneyVal($('wcPiece').value),l=qtyVal($('wcLen').value);if(pc&&l)$('wcPrice').value=moneyText(Math.round(pc/l*100)/100)};$('wcPiece').addEventListener('input',calc);$('wcLen').addEventListener('input',calc);
 $('wcSave').onclick=async()=>{const size=sizeShow($('wcSize').value.trim())||sl.nominal,price=moneyVal($('wcPrice').value),len=Math.round((qtyVal($('wcLen').value)||3)*1000);
  try{await q(sb.from('wood_prices').upsert({slot_id:slotId,species_id:spId,workspace_id:currentWorkspace,size,price,stock_len_mm:len,updated_at:new Date().toISOString()}));await loadWoodSpecies();toast('Сохранено');openWoodGrid();renderCurrent()}catch(e){failSave(e)}};
}
async function addSpecies(){const n=prompt('Название породы (например: Лиственница, Термососна):','');if(!n||!n.trim())return;
 try{const r=await q(sb.from('wood_species').insert({workspace_id:currentWorkspace,name:n.trim(),sort:woodSpecies.length+1}).select().single());
  await q(sb.from('wood_prices').insert(woodSlots.map(s=>({slot_id:s.id,species_id:r.id,workspace_id:currentWorkspace,size:s.nominal,price:0,stock_len_mm:3000}))));await loadWoodSpecies();openWoodGrid()}catch(e){failSave(e)}}
async function renameSpecies(id){const s=woodSp(id);const n=prompt('Название породы (пусто — удалить породу):',s.name);if(n===null)return;
 try{if(!n.trim()){if(!confirm(`Удалить породу «${s.name}»? Объекты с ней перейдут на породу по умолчанию.`))return;await q(sb.from('wood_species').delete().eq('id',id))}else await q(sb.from('wood_species').update({name:n.trim()}).eq('id',id));await loadWoodSpecies();openWoodGrid()}catch(e){failSave(e)}}
async function editSlot(id){const s=woodSlot(id);const n=prompt(s?'Название типоразмера (пусто — удалить):':'Типоразмер, например: Брусок 40×60',s?.name||'');if(n===null)return;
 try{if(s&&!n.trim()){if(!confirm(`Удалить «${s.name}»? В изделиях материал станет обычным.`))return;await q(sb.from('wood_slots').delete().eq('id',id))}
  else{const nom=(sizeShow(n).match(/\d+×\d+/)||[''])[0];if(s)await q(sb.from('wood_slots').update({name:n.trim(),nominal:nom||s.nominal}).eq('id',id));else{const r=await q(sb.from('wood_slots').insert({workspace_id:currentWorkspace,name:n.trim(),nominal:nom,sort:woodSlots.length+1}).select().single());await q(sb.from('wood_prices').insert(woodSpecies.map(sp=>({slot_id:r.id,species_id:sp.id,workspace_id:currentWorkspace,size:nom,price:0,stock_len_mm:3000}))))}}
  await loadWoodSpecies();openWoodGrid()}catch(e){failSave(e)}}
async function woodPct(){const names=woodSpecies.map((s,i)=>`${i+1} — ${s.name}`).join('\n');const w=prompt(`Для какой породы? Номер или пусто — для всех:\n${names}`,'');if(w===null)return;
 const sp=w.trim()?woodSpecies[+w-1]:null;if(w.trim()&&!sp)return alert('Нет такой породы');const p=parseFloat((prompt('На сколько процентов? (например 5 или -5)','5')||'').replace(',','.').replace('−','-'));if(!isFinite(p)||!p)return;
 const rows=[...woodPriceMap.values()].filter(x=>(!sp||x.species_id===sp.id)&&+x.price>0).map(x=>({...x,price:Math.round(x.price*(1+p/100)*100)/100,updated_at:new Date().toISOString()}));
 if(!rows.length)return alert('Нет цен для изменения');if(!confirm(`Изменить ${rows.length} цен${sp?' ('+sp.name+')':''} на ${p>0?'+':''}${p}%?`))return;
 try{await q(sb.from('wood_prices').upsert(rows));await loadWoodSpecies();toast('Цены дерева изменены');openWoodGrid();renderCurrent()}catch(e){failSave(e)}}

/* ---------- выбор породы в объекте ---------- */
function woodLinesOf(pid){return specLines.filter(l=>l.project_id===pid&&catMats.some(m=>m.item_id===l.item_id&&m.wood_slot_id))}
function speciesBoxHtml(pid){
 if(!woodSpecies.length)return '';const lines=woodLinesOf(pid);if(!lines.length)return '';
 if(!isOwner())return `<div class=small>Дерево: ${lines.map(l=>esc(l.item_name)+' — '+esc(woodSp(lineSpecies(l))?.name||'')).join('; ')}</div>`;
 const cur=projSpecies(pid)||defaultSpecies()?.id;
 return `<div class=spBox><div class=label>Порода дерева для объекта</div><div class=chipRow>${woodSpecies.map(s=>`<button class="chip ${s.id===cur?'on':''}" onclick="setProjSpecies('${pid}','${s.id}')">${esc(s.name)}</button>`).join('')}</div>
 ${lines.map(l=>`<div class=kvRow><span>${esc(l.item_name)}</span><select class=spSel aria-label="Порода для ${esc(l.item_name)}" onchange="setLineSpecies('${l.id}',this.value)"><option value="">как у объекта</option>${woodSpecies.map(s=>`<option value="${s.id}" ${l.species_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>`).join('')}</div>`;
}
async function setProjSpecies(pid,spId){
 const o=data.find(x=>x.id===pid),before=typeof ecoPlan==='function'?ecoPlan(pid).total:0,plan={...(finPlans.get(pid)||{}),wood_species:spId};
 try{await q(sb.from('project_finance').upsert({project_id:pid,workspace_id:currentWorkspace,amount:+o?.money||0,plan}));finPlans.set(pid,plan);await syncProject(pid,true);
  const after=typeof ecoPlan==='function'?ecoPlan(pid).total:0;toast(`Порода: ${woodSp(spId)?.name}${before||after?` · себестоимость ${rub(before)} → ${rub(after)}`:''}`);detail(pid)}catch(e){failSave(e)}
}
async function setLineSpecies(lineId,spId){const l=specLines.find(x=>x.id===lineId);if(!l)return;try{await q(sb.from('spec_lines').update({species_id:spId||null}).eq('id',lineId));l.species_id=spId||null;await syncProject(l.project_id,true);toast('Порода изменена');detail(l.project_id)}catch(e){failSave(e)}}
