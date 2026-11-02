'use strict';
// v52: справочник по разделам (скамьи, урны, перголы, заборы, прочее), быстрая отметка сварки, вкладка цеха запоминается.
const CAT_SECTIONS=[['bench',ic('park',26),'Скамьи','скамья'],['urn',ic('trash',26),'Урны','урна'],['pergola',ic('tent',26),'Перголы','пергола'],['fence',ic('columns',26),'Заборы','забор'],['other',ic('cube',26),'Прочее','изделие']];
const catGuess=n=>/скам|лав/i.test(n)?'bench':/урн/i.test(n)?'urn':/перго|беседк|навес/i.test(n)?'pergola':/забор|огражд/i.test(n)?'fence':'other';
const catOf=i=>CAT_SECTIONS.some(s=>s[0]===i.category)?i.category:catGuess(i.name||'');
const secOf=k=>CAT_SECTIONS.find(s=>s[0]===k)||CAT_SECTIONS[4];
let catNewSec='',catSec=lsGet('catSec','bench');
const liveItems=()=>catItems.filter(i=>!i.archived);
function catSectionsHtml(){const it=liveItems();return `<div class=catSec>${CAT_SECTIONS.map(([k,ic,l])=>`<button type=button onclick="openCatalog('${k}')"><i>${ic}</i>${l}<small>${it.filter(i=>catOf(i)===k).length} ${plural(it.filter(i=>catOf(i)===k).length,'карточка','карточки','карточек')}</small></button>`).join('')}</div>`}
function catCardSub(i){const own=isOwner(),ops=catOps.filter(o=>o.item_id===i.id&&o.pay_type==='piece'),w=ops.find(o=>/свар/i.test(o.name)),u=i.unit||'шт';
 return [i.note,own&&w&&+w.rate?`сварка ${rub(w.rate)}/${u}`:'',u!=='шт'?'в '+u:''].filter(Boolean).join(' · ')||`${ops.length} ${plural(ops.length,'работа','работы','работ')}`}
function catTabsHtml(cur,fn,onlyFilled){const it=liveItems();return `<div class=catTabs>${CAT_SECTIONS.filter(([k])=>!onlyFilled||it.some(i=>catOf(i)===k)||k===cur).map(([k,ic,l])=>{const n=it.filter(i=>catOf(i)===k).length;return `<button type=button class="${cur===k?'on':''}" onclick="${fn}('${k}')">${ic} ${l}${n?' · '+n:''}</button>`}).join('')}</div>`}
openCatalog=function(sec){
 if(sec&&CAT_SECTIONS.some(s=>s[0]===sec)){catSec=sec;lsSet('catSec',sec)}
 const own=isOwner(),[k,ic,l,one]=secOf(catSec),list=liveItems().filter(i=>catOf(i)===k);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Справочник изделий</h2>${catTabsHtml(k,'openCatalog')}
 <div class=catGrid>${list.map(i=>`<button type=button class=catCard onclick="openCatItem('${i.id}')"><span class=im>${ic}</span><b>${esc(i.name)}</b><small>${esc(catCardSub(i))}</small></button>`).join('')}${own?`<button type=button class="catCard add" onclick="catNewSec='${k}';openCatItem()">+ Новая ${k==='other'?'карточка':one==='забор'?'карточка забора':one}</button>`:''}</div>
 ${!list.length&&!own?'<div class=empty>В разделе пока нет карточек</div>':''}
 <div class=small style="margin-top:10px">Тап по карточке — техкарта: работы и материалы на 1 ${k==='fence'?'м.п.':'шт'}. В спецификации объекта выбираете раздел, потом карточку.</div>`;
 openModal();
};
let saSt=null;
openSpecAdd=function(pid,preselect){
 const pre=catItems.find(i=>i.id===preselect);
 saSt={pid,item:pre?.id||'',sec:pre?catOf(pre):(saSt&&saSt.pid===pid?saSt.sec:catSec)};drawSpecAdd();openModal();
};
function saSec(k){saSt.sec=k;saSt.item='';drawSpecAdd()}
function saPick(id){const q=$('saQty')?.value;saSt.item=id;drawSpecAdd();if(q&&$('saQty'))$('saQty').value=q}
function drawSpecAdd(){
 const {pid,sec,item}=saSt,[k,ic]=secOf(sec),list=liveItems().filter(i=>catOf(i)===k),sel=catItems.find(i=>i.id===item);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Изделие в спецификацию</h2><div class=summary>${esc(projName(pid))}</div>${catTabsHtml(k,'saSec',true)}
 <div class=catGrid>${list.map(i=>`<button type=button class="catCard ${i.id===item?'sel':''}" onclick="saPick('${i.id}')"><span class=im>${ic}</span><b>${esc(i.name)}</b><small>${i.id===item?'✓ выбрано':esc(catCardSub(i))}</small></button>`).join('')}${isOwner()?`<button type=button class="catCard add" onclick="catNewSec='${k}';openCatItem(null,'${pid}')">+ Новая карточка</button>`:''}</div>
 ${sel?`<label class=field style="margin-top:10px">Количество, ${esc(sel.unit||'шт')}<input id=saQty inputmode=decimal value="1"></label><div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button><button class=btn id=saSave>Добавить</button></div>`:`<div class=small style="margin-top:10px">Выберите карточку</div><div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button></div>`}`;
 if(!$('saSave'))return;
 $('saSave').onclick=async()=>{const b=$('saSave');if(b.disabled)return;const it=catItems.find(i=>i.id===saSt.item),n=qtyVal($('saQty').value);if(!it)return;if(!n)return alert('Укажите количество');b.disabled=true;b.textContent='Сохраняю…';
  try{await q(sb.from('spec_lines').insert({workspace_id:currentWorkspace,project_id:pid,item_id:it.id,item_name:it.name,qty:n,sort:specLines.filter(l=>l.project_id===pid).length}));await loadProd();await syncProject(pid);toast(it.name+' · '+num(n)+' '+(it.unit||'шт')+' добавлено');detail(pid)}catch(e){b.disabled=false;b.textContent='Добавить';serverError(e);alert('Не удалось: '+(e.message||e))}};
}

/* быстрая отметка: тап по счётчику — кто и сколько сразу */
function openOpMark(opId){
 const o=projOps.find(x=>x.id===opId);if(!o)return;if(!canMark())return;
 const done=shopDone(opId),left=Math.max(0,o.qty_plan-done),as=opWorkers(opId),ids=[...as,...shopWorkers.map(w=>w.id).filter(id=>!as.includes(id))];
 if(!ids.length)return alert('Сотрудников нет. Владелец добавляет их в «Деньги → Зарплата → Сотрудники».');
 let who=as[0]||lsGet('opWho','')||ids[0];if(!ids.includes(who))who=ids[0];
 const max=Math.max(left,1),vals=Array.from({length:Math.max(max,1)},(_,i)=>i+1);let n=1;
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(o.item_name)} · ${esc(o.name.toLowerCase())}</h2><div class=summary>${esc(projName(o.project_id))} · сделано ${num(done)} из ${num(o.qty_plan)}${left?'':' · план выполнен'}</div>
 <div class=label>Кто</div><div class=wkPick id=omW>${ids.map(id=>`<button type=button data-w="${id}" class="${id===who?'sel':''}">${esc(swName(id))}${as.includes(id)?'':' <small style="font-weight:500;color:var(--text-secondary)">+</small>'}</button>`).join('')}</div>
 <div class=label>Сколько сделал</div>
 <div class="inWheel"><div class=woodWheelCenter></div><div class=woodWheelTrack id=omT>${vals.map(v=>`<button type=button class=woodWheelNumber data-v=${v}>${v}</button>`).join('')}</div></div>
 <div class=qChips id=omQ>${[1,2,5].filter(v=>v<max).map(v=>`<button type=button data-v=${v}>${v}</button>`).join('')}<button type=button data-v=${max}>${left?'все '+num(left):num(max)}</button></div>
 <button class="btn wide" id=omSave style="margin-top:10px"></button>
 <div class=small style="margin-top:6px">Запишется в табель сегодняшним днём по расценке ${isOwner()?rub(o.rate)+'/шт':''}. Ошиблись — «Вернуть» в подсказке или «−» на карточке.</div>`;
 openModal();
 const tr=$('omT'),lbl=()=>{$('omSave').textContent=`Записать ${num(n)} шт · ${swName(who)}`;[...$('omQ').children].forEach(b=>b.classList.toggle('on',+b.dataset.v===n))};
 const go=v=>{n=v;tr.scrollTop=(v-1)*36;lbl()};
 tr.addEventListener('scroll',()=>{const i=Math.max(0,Math.min(vals.length-1,Math.round(tr.scrollTop/36)));n=vals[i];lbl()},{passive:true});
 tr.onclick=e=>{const b=e.target.closest('[data-v]');if(b)go(+b.dataset.v)};
 $('omQ').onclick=e=>{const b=e.target.closest('[data-v]');if(b)go(+b.dataset.v)};
 $('omW').onclick=e=>{const b=e.target.closest('[data-w]');if(!b)return;who=b.dataset.w;[...$('omW').children].forEach(x=>x.classList.toggle('sel',x===b));lbl()};
 requestAnimationFrame(()=>go(n));
 $('omSave').onclick=async()=>{const b=$('omSave');if(b.disabled)return;if(n>left&&left>0&&!confirm(`По плану осталось ${num(left)}, записать ${num(n)}?`))return;if(!left&&!confirm('План уже выполнен. Всё равно записать?'))return;b.disabled=true;lsSet('opWho',who);
  try{if(!as.includes(who)){const r=await sb.rpc('shop_assign',{p_op:opId,p_workers:[...as,who]});if(r.error)throw r.error}
   const {data:tot,error}=await sb.rpc('shop_mark',{p_op:opId,p_worker:who,p_delta:n});if(error)throw error;closeModal();await refreshShop();
   const w=who,d=n;toast(`${o.item_name} — ${o.name}: +${num(d)} · ${swName(w)} · ${num(tot)} из ${num(o.qty_plan)}`,async()=>{const r=await sb.rpc('shop_mark',{p_op:opId,p_worker:w,p_delta:-d});if(r.error)alert(r.error.message);await refreshShop()})}
  catch(e){b.disabled=false;alert(e.message||e)}};
}

/* вкладка цеха запоминается */
shopKind=lsGet('shopKind',shopKind);
const _renderShop51=renderShop;
renderShop=function(){_renderShop51();lsSet('shopKind',shopKind)};
