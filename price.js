'use strict';
// v46: прайс металла (только владелец), выбор материала из прайса, лист в м² + обрезки, цены процентами
let priceItems=[],wsSettings={},priceCat='',priceQ='',priceTab='metal';
const PRICE_TABS=[['metal','⚙ Металл'],['wood','🪵 Дерево'],['paint','🎨 Краска'],['hw','🔩 Метизы']];
const priceTabOf=c=>/дерев|брус|доск|листвен|сосн|осин|фанер|вагонк/i.test(c||'')?'wood':/краск|эмал|грунт|порош|лак|раствор|ral/i.test(c||'')?'paint':/метиз|болт|гайк|саморез|анкер|шайб|винт|заклеп|шпильк/i.test(c||'')?'hw':'metal';
const inTab=p=>priceTabOf(p.category)===priceTab;
const tabName=()=>PRICE_TABS.find(t=>t[0]===priceTab)[1].replace(/^\S+ /,'');
const wastePct=()=>{const v=+wsSettings.sheet_waste_pct;return wsSettings.sheet_waste_pct!=null&&isFinite(v)&&v>=0&&v<=200?v:20};
const priceById=id=>id?priceItems.find(p=>p.id===id):null;
const sheetArea=p=>(+p.sheet_w||0)*(+p.sheet_l||0)/1e6;
const priceUnitText=p=>p.kind==='sheet'?`${rub(p.price)}/лист`:p.kind==='linear'?`${rub(p.price)}/м`:`${rub(p.price)}/${p.unit||'шт'}`;
function priceSub(p){const a=[];if(p.kind==='linear')a.push('хлыст '+num((p.stock_len_mm||6000)/1000,1)+' м');if(p.kind==='sheet')a.push(`${p.sheet_w}×${p.sheet_l} · ${num(sheetArea(p),3)} м² · ${rub(p.price/sheetArea(p))}/м²`);if(p.kg_unit&&p.kind==='linear')a.push(num(p.kg_unit,3)+' кг/м');if(p.price_ton)a.push(rub(p.price_ton).replace(' ₽','')+' ₽/т');if(+p.price!==+p.base_price)a.push(`в прайсе ${rub(p.base_price)}`);return a.join(' · ')}

async function loadPrice(){
 if(!isOwner()){priceItems=[];wsSettings={};return}
 try{const r=await fetchAll(()=>sb.from('price_items').select('*').eq('workspace_id',currentWorkspace).order('sort').order('id'));if(r.error)throw r.error;priceItems=r.data||[];
  const w=await sb.from('workspaces').select('settings').eq('id',currentWorkspace).maybeSingle();wsSettings=w.data?.settings||{};
  if(!priceItems.length&&!wsSettings.price_seeded)await seedPrice()}
 catch(e){console.warn('price',e)}
}
async function saveSettings(patch){wsSettings={...wsSettings,...patch};await q(sb.from('workspaces').update({settings:wsSettings}).eq('id',currentWorkspace))}
async function seedPrice(){try{const res=await fetch('price-seed.json',{cache:'no-store'});if(!res.ok)return;await importPrice(await res.json(),true)}catch(e){console.warn('seed',e)}}
// Загрузка прайса: новые позиции добавляются, существующие (по категории и названию) получают новую цену
async function importPrice(j,silent){
 const key=i=>(i.category+'|'+i.name).toLowerCase(),old=new Map(priceItems.map(p=>[key(p),p]));
 const ins=[],upd=[];
 for(const i of j.items){const body={workspace_id:currentWorkspace,category:i.category,name:i.name,kind:i.kind,unit:i.unit,thickness:i.thickness??null,sheet_w:i.sheet_w??null,sheet_l:i.sheet_l??null,stock_len_mm:i.stock_len_mm??null,kg_unit:i.kg_unit??null,price_ton:i.price_ton??null,base_price:i.base_price,price:i.base_price,supplier:j.supplier||'',price_date:j.date||null,sort:i.sort};
  const o=old.get(key(i));if(o)upd.push({...o,...body,id:o.id});else ins.push(body)}
 for(let k=0;k<ins.length;k+=200)await q(sb.from('price_items').insert(ins.slice(k,k+200)));
 for(let k=0;k<upd.length;k+=200)await q(sb.from('price_items').upsert(upd.slice(k,k+200)));
 await saveSettings({price_seeded:true});
 const r=await fetchAll(()=>sb.from('price_items').select('*').eq('workspace_id',currentWorkspace).order('sort').order('id'));if(!r.error)priceItems=r.data||[];
 if(!silent)toast(`Прайс загружен: новых ${ins.length}, обновлено ${upd.length}`);
 return {ins:ins.length,upd:upd.length};
}

// Стоимость материала на 1 изделие по прайсу (null — материал не привязан к прайсу)
function matCost(m){const p=priceById(m.price_item_id);if(!p)return null;
 if(p.kind==='sheet'){const a=(+m.width_mm||0)*(+m.length_mm||0)/1e6*(+m.qty||0);return {sum:a*(1+wastePct()/100)*p.price/(sheetArea(p)||1),text:`${num(a,3)} м² + ${num(wastePct())}% обрезки = ${num(a*(1+wastePct()/100),3)} м² × ${rub(p.price/(sheetArea(p)||1))}`}}
 if(p.kind==='linear'){const mm=(+m.length_mm||0)/1000*(+m.qty||0);return {sum:mm*p.price,text:`${num(mm,3)} м × ${rub(p.price)}`}}
 return {sum:(+m.qty||0)*p.price,text:`${num(m.qty)} ${p.unit} × ${rub(p.price)}`}}
function itemMatCost(itemId,mats){const ms=mats||catMats.filter(m=>m.item_id===itemId);let sum=0,priced=0;ms.forEach(m=>{const c=matCost(m);if(c){sum+=c.sum;priced++}});return {sum,priced,total:ms.length}}

/* ---------- экран прайса ---------- */
function priceCats(){return [...new Set(priceItems.map(p=>p.category))]}
function openPriceList(){
 if(!isOwner())return;
 const cats=priceCats().filter(c=>priceTabOf(c)===priceTab);if(priceCat&&!cats.includes(priceCat))priceCat='';
 const first=priceItems.find(p=>p.supplier&&p.supplier!=='Своя')||priceItems[0],tabItems=priceItems.filter(inTab);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Прайс</h2>
 <div class=summary>${first?`${esc(first.supplier||'Поставщик')} · от ${first.price_date?parseDate(first.price_date).toLocaleDateString('ru-RU'):'—'}`:'Прайс не загружен'}</div>
 <div class="segBar seg4" id=prTabs>${PRICE_TABS.map(([k,l])=>`<button type=button class="${priceTab===k?'on':''}" data-t=${k}>${l} · ${priceItems.filter(p=>priceTabOf(p.category)===k).length}</button>`).join('')}</div>
 ${priceTab==='metal'?`<div class=info><div class=kvRow><span>Обрезки листа</span><b>${num(wastePct())}%</b></div><div class=kvRow><span>Изменено вручную или процентом</span><b>${tabItems.filter(p=>+p.price!==+p.base_price).length} поз.</b></div></div>`:''}
 ${priceTab==='wood'?`<button class="btn wide" onclick="openWoodGrid()" style="margin:4px 0 8px">🪵 Брус: таблица «сечение × порода»</button>`:''}
 <input id=prQ class=searchIn placeholder="🔍 Поиск: ${priceTab==='metal'?'40х20, лист 2, уголок 50':priceTab==='paint'?'эмаль, грунт, RAL':priceTab==='hw'?'болт М8, саморез':'лиственница, доска'}" value="${esc(priceQ)}">
 ${cats.length>1?'':'<!--'}<div class="chipRow chipScroll" id=prCats><button class="chip ${!priceCat?'on':''}" data-c="">Все</button>${cats.map(c=>`<button class="chip ${priceCat===c?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>${cats.length>1?'':'-->'}
 <div id=prList></div>
 <button class="btn secondary wide" onclick="openOwnPrice()" style="margin-top:8px">+ Позиция в «${tabName()}»</button>
 <div class=stickyActions>${priceTab==='metal'?`<button class="btn secondary" onclick="pickPriceFile()">Загрузить .xls</button>`:''}<button class=btn onclick="openPricePct()">% Изменить цены · ${tabName()}</button></div>`;
 openModal();
 const draw=()=>{const qy=priceQ.toLowerCase().replace(/\s+/g,'').replace(/(\d)[xх*](?=\d)/g,'$1×'),list=priceItems.filter(p=>inTab(p)&&(!priceCat||p.category===priceCat)&&(!qy||p.name.toLowerCase().replace(/\s+/g,'').includes(qy)));
  $('prList').innerHTML=list.slice(0,150).map(p=>`<button class=priceRow onclick="editPrice('${p.id}')"><div><b>${esc(p.name)}</b><span>${esc(priceSub(p))}</span></div><strong>${priceUnitText(p)}</strong></button>`).join('')+(list.length>150?`<div class=small>Показаны 150 из ${list.length} — уточните поиск</div>`:'')||`<div class=empty>${priceItems.some(inTab)?'Ничего не найдено':'Во вкладке пока пусто — добавьте позицию'}</div>`};
 $('prTabs').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;priceTab=b.dataset.t;priceCat='';priceQ='';openPriceList()};
 $('prQ').oninput=e=>{priceQ=e.target.value;draw()};
 if($('prCats'))$('prCats').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;priceCat=b.dataset.c;[...$('prCats').children].forEach(x=>x.classList.toggle('on',x===b));draw()};
 draw();
}
function editPrice(id){
 const p=priceById(id);if(!p)return;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(p.name)}</h2><div class=summary>${esc(p.category)} · ${esc(priceSub(p))}</div>
 <label class=field>Цена, ₽ за ${p.kind==='sheet'?'лист':p.kind==='linear'?'метр':p.unit}<input id=epPrice inputmode=decimal value="${moneyText(p.price)}"></label>
 ${p.kind==='linear'?`<label class=field>Длина хлыста, м<input id=epLen inputmode=decimal value="${num((p.stock_len_mm||6000)/1000,2)}"></label>`:''}
 <div class=small>В прайсе поставщика: ${rub(p.base_price)}</div>
 <div class=actions><button class="btn secondary" onclick="openPriceList()">Назад</button><button class=btn id=epSave>Сохранить</button></div>
 ${+p.price!==+p.base_price?`<button class=linkBtn onclick="$('epPrice').value=moneyText(${+p.base_price})">Вернуть цену из прайса</button>`:''}`;
 openModal();$('epPrice').oninput=e=>fmtMoneyInput(e.target);
 $('epSave').onclick=async()=>{const v=moneyVal($('epPrice').value);if(!v)return alert('Укажите цену');const body={price:v};if($('epLen')){const l=Math.round(qtyVal($('epLen').value)*1000);if(l)body.stock_len_mm=l}
  try{await q(sb.from('price_items').update(body).eq('id',id));Object.assign(p,body);toast('Цена сохранена');openPriceList();renderCurrent()}catch(e){failSave(e)}};
}
function openPricePct(){
 const cats=priceCats().filter(c=>priceTabOf(c)===priceTab);let scope=priceCat||'',pct=5;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Изменить цены</h2>
 <label class=field>Что меняем<select id=ppScope><option value="">Вся вкладка «${tabName()}»</option>${cats.map(c=>`<option ${c===scope?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
 <div class=label>На сколько</div><div class=chipRow id=ppPcts>${[-10,-5,5,10].map(v=>`<button type=button class="chip ${v===pct?'on':''}" data-v="${v}">${v>0?'+':'−'}${Math.abs(v)}%</button>`).join('')}</div>
 <label class=field>Свой %, можно с минусом<input id=ppVal inputmode=decimal value="5"></label>
 <label class=check2><input type=checkbox id=ppFromBase> Считать от цены поставщика (а не от текущей)</label>
 <div class=label style="margin-top:8px">Будет так</div><div id=ppPrev class=info></div>
 <div class=actions><button class="btn secondary" onclick="openPriceList()">Назад</button><button class=btn id=ppApply>Применить</button></div>
 <button class=linkBtn id=ppReset>Вернуть цены как в прайсе поставщика</button>
 ${priceTab==='metal'?'':'<div hidden>'}<div class=label style="margin-top:14px">Обрезки листа</div><div class=chipRow id=ppWaste>${[10,15,20,25,30].map(v=>`<button type=button class="chip ${v===wastePct()?'on':''}" data-v="${v}">${v}%</button>`).join('')}</div>
 <label class=field>Свой % обрезков<input id=ppWasteVal inputmode=decimal value="${num(wastePct())}"></label>${priceTab==='metal'?'':'</div>'}`;
 openModal();
 const list=()=>priceItems.filter(p=>inTab(p)&&(!$('ppScope').value||p.category===$('ppScope').value));
 const newP=p=>Math.round(((($('ppFromBase').checked?+p.base_price:+p.price))*(1+pct/100))*100)/100;
 const prev=()=>{const l=list();$('ppPrev').innerHTML=l.slice(0,3).map(p=>`<div class=kvRow><span>${esc(p.name)}</span><b><s style="color:#99a3ad;font-weight:400">${num(p.price,2)}</s> → ${rub(newP(p))}</b></div>`).join('')+`<div class=small>${l.length} ${plural(l.length,'позиция','позиции','позиций')}</div>`;$('ppApply').textContent=`Применить ${pct>0?'+':''}${num(pct,2)}% к ${l.length} поз.`};
 const setPct=v=>{pct=v;$('ppVal').value=num(v,2);[...$('ppPcts').children].forEach(x=>x.classList.toggle('on',+x.dataset.v===v));prev()};
 $('ppPcts').onclick=e=>{const b=e.target.closest('[data-v]');if(b)setPct(+b.dataset.v)};
 $('ppVal').oninput=()=>{const t=$('ppVal').value.replace(',','.').replace('−','-'),v=parseFloat(t);pct=isFinite(v)?v:0;[...$('ppPcts').children].forEach(x=>x.classList.toggle('on',+x.dataset.v===pct));prev()};
 $('ppScope').onchange=prev;$('ppFromBase').onchange=prev;prev();
 const bulk=async rows=>{for(let k=0;k<rows.length;k+=200)await q(sb.from('price_items').upsert(rows.slice(k,k+200)))};
 $('ppApply').onclick=async()=>{const b=$('ppApply');if(b.disabled)return;if(!pct)return alert('Укажите процент');if(pct<=-90||pct>500)return alert('Слишком большой процент');const l=list();if(!confirm(`Изменить цены у ${l.length} позиций на ${pct>0?'+':''}${num(pct,2)}%?`))return;b.disabled=true;
  try{await bulk(l.map(p=>({...p,price:newP(p)})));await loadPrice();toast('Цены изменены');openPriceList();renderCurrent()}catch(e){b.disabled=false;failSave(e)}};
 $('ppReset').onclick=async()=>{const l=list().filter(p=>+p.price!==+p.base_price);if(!l.length)return toast('Все цены и так как в прайсе');if(!confirm(`Вернуть цены поставщика у ${l.length} позиций?`))return;try{await bulk(l.map(p=>({...p,price:+p.base_price})));await loadPrice();toast('Цены возвращены');openPriceList();renderCurrent()}catch(e){failSave(e)}};
 const saveW=async v=>{if(!(v>=0&&v<=200))return alert('Обрезки — от 0 до 200%');try{await saveSettings({sheet_waste_pct:v});$('ppWasteVal').value=num(v);[...$('ppWaste').children].forEach(x=>x.classList.toggle('on',+x.dataset.v===v));toast('Обрезки листа: '+num(v)+'%');renderCurrent()}catch(e){failSave(e)}};
 $('ppWaste').onclick=e=>{const b=e.target.closest('[data-v]');if(b)saveW(+b.dataset.v)};
 $('ppWasteVal').onchange=e=>saveW(parseFloat(e.target.value.replace(',','.')));
}
// Новый прайс файлом .xls/.xlsx того же формата
function pickPriceFile(){const i=document.createElement('input');i.type='file';i.accept='.xls,.xlsx';i.onchange=()=>i.files[0]&&loadPriceFile(i.files[0]);i.click()}
function loadScript(src){return new Promise((ok,no)=>{if(window.XLSX)return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Не удалось загрузить модуль чтения Excel'));document.head.append(s)})}
async function loadPriceFile(f){
 try{toast('Читаю прайс…');await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null,raw:true}),j=parsePriceRows(rows);
  if(j.items.length<10)return alert('В файле не нашлось позиций прайса. Нужен тот же формат, что у прайса «ООО ЦЕХ».');
  const changed=priceItems.filter(p=>+p.price!==+p.base_price).length;
  if(!confirm(`Прайс ${j.supplier||''} от ${j.date||'?'}: ${j.items.length} позиций.\nЦены обновятся по новому прайсу${changed?` (ваши изменения у ${changed} поз. сбросятся — потом можно снова применить %)`:''}. Загрузить?`))return;
  await importPrice(j);openPriceList();renderCurrent()}
 catch(e){serverError(e);alert('Не удалось загрузить прайс: '+(e.message||e))}
}
// Выбор позиции прайса (для техкарты и деталей)
function openPricePicker(onPick,onBack){
 let cat='',qy='';const cats=priceCats();
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Материал из прайса</h2>
 <input id=pkQ class=searchIn placeholder="🔍 40х20х2, лист 2, уголок 50"><div class="chipRow chipScroll" id=pkCats><button class="chip on" data-c="">Все</button>${cats.map(c=>`<button class=chip data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><div id=pkList></div>
 <div class=actions><button class="btn secondary" id=pkBack>Назад</button></div>`;
 openModal();
 const draw=()=>{const s=qy.toLowerCase().replace(/\s+/g,'').replace(/(\d)[xх*](?=\d)/g,'$1×'),l=priceItems.filter(p=>(!cat||p.category===cat)&&(!s||p.name.toLowerCase().replace(/\s+/g,'').includes(s)));$('pkList').innerHTML=l.slice(0,100).map(p=>`<button class=priceRow data-id="${p.id}"><div><b>${esc(p.name)}</b><span>${esc(p.category)} · ${esc(priceSub(p))}</span></div><strong>${priceUnitText(p)}</strong></button>`).join('')||'<div class=empty>Ничего не найдено</div>'};
 $('pkQ').oninput=e=>{qy=e.target.value;draw()};
 $('pkCats').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;[...$('pkCats').children].forEach(x=>x.classList.toggle('on',x===b));draw()};
 $('pkList').onclick=e=>{const b=e.target.closest('[data-id]');if(b)onPick(priceById(b.dataset.id))};
 $('pkBack').onclick=onBack;draw();setTimeout(()=>$('pkQ')?.focus(),50);
}

// Своя позиция прайса: дерево за метр, метизы и краска за штуку/кг, свой лист
function openOwnPrice(){
 const cats=['Дерево','Метизы','Краска и грунт','Прочее'],defCat={wood:'Дерево',paint:'Краска и грунт',hw:'Метизы',metal:priceCat||'Прочее'}[priceTab];let kind=priceTab==='wood'?'linear':'piece';
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Своя позиция</h2>
 <label class=field>Раздел<input id=opCat list=opCats value="${esc(defCat)}"><datalist id=opCats>${[...new Set([...cats,...priceCats()])].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
 <label class=field>Название<input id=opName placeholder="Лиственница 40×90 / Болт М8×60 / Краска RAL 7016"></label>
 <div class=chipRow id=opKind><button type=button class="chip ${kind==='linear'?'on':''}" data-v=linear>За метр (погонаж)</button><button type=button class="chip ${kind==='piece'?'on':''}" data-v=piece>За штуку / кг / л</button></div>
 <div class=inlineRow><label class=field>Цена, ₽<input id=opPrice inputmode=decimal></label><label class=field id=opUnitBox ${kind==='piece'?'':'hidden'}>Ед.<select id=opUnit>${['шт','кг','л','компл','м²','уп'].map(u=>`<option>${u}</option>`).join('')}</select></label><label class=field id=opLenBox ${kind==='linear'?'':'hidden'}>Длина хлыста/доски, м<input id=opLen inputmode=decimal value="6"></label></div>
 <div class=actions><button class="btn secondary" onclick="openPriceList()">Назад</button><button class=btn id=opSave>Добавить</button></div>`;
 openModal();$('opPrice').oninput=e=>fmtMoneyInput(e.target);
 $('opKind').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;kind=b.dataset.v;[...$('opKind').children].forEach(x=>x.classList.toggle('on',x===b));$('opUnitBox').hidden=kind!=='piece';$('opLenBox').hidden=kind!=='linear'};
 $('opSave').onclick=async()=>{const name=$('opName').value.trim(),cat=$('opCat').value.trim()||'Прочее',pr=moneyVal($('opPrice').value);if(!name)return alert('Укажите название');if(!pr)return alert('Укажите цену');
  const row={workspace_id:currentWorkspace,category:cat,name,kind,unit:kind==='linear'?'м':$('opUnit').value,stock_len_mm:kind==='linear'?Math.round((qtyVal($('opLen').value)||6)*1000):null,base_price:pr,price:pr,supplier:'Своя',price_date:localISO(),sort:9000+priceItems.length};
  try{await q(sb.from('price_items').insert(row));await loadPrice();toast('Добавлено в прайс');priceTab=priceTabOf(cat);priceCat=cat;openPriceList()}catch(e){failSave(e)}};
}
