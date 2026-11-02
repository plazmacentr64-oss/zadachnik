'use strict';
// v53: метки гаснут при заполнении, авто «В работе», значки материалов, расходники цеха как задачи, накладные расходы цеха.

/* метки полей: гаснут сразу при вводе */
document.addEventListener('input',e=>{const l=e.target.closest&&e.target.closest('.fReq,.fWant');if(!l)return;const i=e.target;l.classList.toggle('fEmpty',i.inputMode==='decimal'?!moneyVal(i.value):!String(i.value||'').trim())},true);
document.addEventListener('change',e=>{const l=e.target.closest&&e.target.closest('.fReq,.fWant');if(!l)return;const i=e.target;l.classList.toggle('fEmpty',i.inputMode==='decimal'?!moneyVal(i.value):!String(i.value||'').trim())},true);

/* все обязательные заполнены → «В работе» (с возвратом) */
const reqFilled=o=>!!(o.name&&o.contractor&&+o.money>0&&o.startDate&&o.date);
function autoToWork(o){if(!o||o.status!=='Подписание договора'||!isOwner()||!reqFilled(o))return;
 quickStatus(o.id,'В работе',true).then(()=>toast('Все обязательные поля заполнены — объект «В работе»',async()=>{await quickStatus(o.id,'Подписание договора',true);refreshDetail(o.id)}))}

/* значки материалов */
const PAINT_RX=/краск|эмал|грунт|порош|лак|раствор|ral/i;
const kKey=x=>x.kind==='wood'?'wood':x.kind==='metal'?'metal':PAINT_RX.test(x.name||'')?'paint':'other';
const K_ICON={metal:'⚙',wood:'🪵',other:'🔩',paint:'🎨'};
const kIcon=k=>`<i class="kI ${k}" aria-hidden=true>${K_ICON[k]||'🔩'}</i>`;

/* внутрицеховые: работы и расходники — зачеркнуть, завтра в «Выполнено» */
function inShopHtml(){
 const tdy=localISO(),ts=tasks.filter(t=>t.shop&&(!t.done||doneToday(t))).sort((a,b)=>(a.done-b.done)||taskKey(a)-taskKey(b));
 const rq=parts.filter(p=>!p.project_id&&(p.status==='order'||p.status==='ordered'||(p.status==='stock'&&p.arrived_on===tdy))).sort((a,b)=>(a.status==='stock')-(b.status==='stock'));
 const oldT=tasks.filter(t=>t.shop&&t.done&&!doneToday(t)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt))).slice(0,30);
 const oldP=parts.filter(p=>!p.project_id&&(p.status==='ready'||(p.status==='stock'&&p.arrived_on!==tdy))).sort((a,b)=>String(b.arrived_on||b.updated_at).localeCompare(String(a.arrived_on||a.updated_at))).slice(0,30);
 let h=`<div class=sectionTitle><b>Работы по цеху</b><span>${ts.filter(t=>!t.done).length}</span></div>${ts.map(t=>`<div class="tk ${t.done?'done':''}"><input class=check type=checkbox ${t.done?'checked':''} onchange="toggleTask('${t.id}')" aria-label="Выполнено"><div><b>${esc(t.title)}</b>${t.responsibleId||t.date?`<small>${t.responsibleId?esc(memberName(t.responsibleId)):''}${t.date?' · '+fmt(t.date):''}</small>`:''}</div>${isOwner()?`<button class=edDel aria-label="Удалить" onclick="deleteTask('${t.id}')">×</button>`:''}</div>`).join('')||'<div class=small>Нет работ — ремонт, оснастка, уборка…</div>'}`;
 h+=`<div class=sectionTitle style="margin-top:14px"><b>Расходники и материалы для цеха</b><span>${rq.filter(p=>p.status!=='stock').length}</span></div>${rq.map(p=>{const k=kKey(p),dn=p.status==='stock';return `<div class="tk kB ${k} ${dn?'done':''}"><input class=check type=checkbox ${dn?'checked':''} onchange="shopPartDone('${p.id}',this.checked)" aria-label="Пришло"><button class=partMain style="flex:1;min-width:0;border:0;background:none;padding:0;text-align:left;font:inherit;cursor:pointer" onclick="openPart('${p.id}')">${kIcon(k)}<b>${esc(p.name)} ${esc(p.size||'')}</b><small>${dn?'пришло сегодня':PART_LABEL[p.status].toLowerCase()}${p.note?' · '+esc(p.note):''}</small></button><b style="white-space:nowrap">${num(p.qty)} ${esc(p.unit||'шт')}</b></div>`}).join('')||'<div class=small>Заявок без объекта нет. Диски, электроды, газ — через «+ Заявка».</div>'}`;
 h+=`<div class=small style="margin:4px 2px">Галочка — сделано / пришло: строка зачеркнётся и завтра уйдёт в «Выполнено».</div>`;
 h+=`<div class=inlineRow style="margin-top:10px"><button class="btn secondary" onclick="openShopTask()">+ Работа по цеху</button><button class=btn onclick="openRequest('')">+ Заявка</button></div>`;
 if(oldT.length||oldP.length)h+=`<details class=section style="margin-top:12px"><summary class=sectionTitle><b>Выполнено</b><span>${oldT.length+oldP.length}</span></summary>${oldT.map(t=>`<div class="tk done"><input class=check type=checkbox checked onchange="toggleTask('${t.id}')" aria-label="Снять отметку"><div><b>${esc(t.title)}</b><small>${t.completedAt?fmt(localISO(new Date(t.completedAt))):''}</small></div></div>`).join('')}${oldP.map(p=>`<div class="tk done kB ${kKey(p)}"><input class=check type=checkbox checked onchange="shopPartDone('${p.id}',false)" aria-label="Вернуть в заказ"><div>${kIcon(kKey(p))}<b>${esc(p.name)} ${esc(p.size||'')}</b><small>${p.arrived_on?'пришло '+fmt(p.arrived_on):'готово'} · ${num(p.qty)} ${esc(p.unit||'шт')}</small></div></div>`).join('')}</details>`;
 return h;
}
async function shopPartDone(id,on){
 const p=parts.find(x=>x.id===id);if(!p)return;const prev={status:p.status,arrived_on:p.arrived_on||null};
 const patch=on?{status:'stock',arrived_on:localISO()}:{status:p.ordered_on?'ordered':'order',arrived_on:null};
 try{await q(sb.from('shop_parts').update({...patch,updated_at:new Date().toISOString()}).eq('id',id));await refreshShop();
  toast(`${p.name}: ${on?'пришло':'снова в заказе'}`,async()=>{try{await q(sb.from('shop_parts').update(prev).eq('id',id));await refreshShop()}catch(e){failSave(e)}})}catch(e){failSave(e)}
}

/* накладные расходы цеха: статьи в месяц и оборот в год → % от договора */
const OH_DEF=[{id:'rent',icon:'🏠',name:'Аренда цеха',amount:160000},{id:'power',icon:'⚡',name:'Электроэнергия',amount:150000}];
const ohItems=()=>Array.isArray(wsSettings?.overheads)?wsSettings.overheads:OH_DEF;
const ohTurnover=()=>+wsSettings?.turnover_year>0?+wsSettings.turnover_year:60000000;
const ohMonth=()=>ohItems().reduce((s,i)=>s+(+i.amount||0),0);
function ohRate(){if(!isOwner())return null;const t=ohTurnover();return t>0?ohMonth()*12/t:null}
const _renderMoneySeg51=renderMoneySeg;
renderMoneySeg=function(){_renderMoneySeg51();const el=$('moneySeg');if(!el||!isOwner())return;el.insertAdjacentHTML('beforeend',`<button class="${moneySeg==='overhead'?'on':''}" onclick="moneySeg='overhead';try{localStorage.setItem('moneySeg','overhead')}catch(e){};renderCurrent()">Накладные</button>`);if(moneySeg==='overhead')el.querySelectorAll('button').forEach(b=>b.classList.toggle('on',/Накладные/.test(b.textContent)))};
const _renderAnalytics50=renderAnalytics;
renderAnalytics=function(){if(moneySeg==='overhead'&&isOwner())return renderOverhead();return _renderAnalytics50()};
function renderOverhead(){
 const it=ohItems(),m=ohMonth(),t=ohTurnover(),r=ohRate()||0,act=data.filter(o=>o.status==='В работе').sort((a,b)=>(+b.money||0)-(+a.money||0));
 $('analyticsBody').innerHTML=`<div class=small style="margin:4px 2px 8px">Постоянные расходы цеха в месяц. Делятся между объектами пропорционально сумме договора — через средний оборот.</div>
 ${it.map((x,i)=>`<button class=ohRow onclick="ohEdit(${i})"><span>${esc(x.icon||'•')} ${esc(x.name)}</span><b>${rub(x.amount)}</b></button>`).join('')}
 <button class="btn secondary wide" style="margin-top:6px" onclick="ohAdd()">+ Статья</button>
 <div class=info style="margin-top:10px"><div class="kvRow mineBig" style="border:0;margin:0;padding:0"><span>Итого в месяц</span><b>${rub(m)}</b></div><div class=kvRow><span>В год</span><b>${rub(m*12)}</b></div>
 <button class=ohRow style="margin:8px 0 0" onclick="ohTurn()"><span>Средний оборот в год</span><b>${rubShort(t)}</b></button>
 <div class=kvRow style="margin-top:8px"><span><b>Накладные на каждый объект</b></span><b class=pos>${num(r*100,1)}% от договора</b></div></div>
 ${act.length?`<div class=label>Объекты в работе</div>${act.slice(0,8).map(o=>`<div class=kvRow><span>${esc(o.name)} <span class=small>· договор ${rubShort(o.money)}</span></span><b>≈ ${rub((+o.money||0)*r)}</b></div>`).join('')}`:''}
 <div class=small style="margin-top:8px">Эта доля стоит в «Экономике объекта» строкой «Накладные цеха» вместо ручного %.</div>`;
}
async function ohSave(list,turn){const patch={overheads:list};if(turn!=null)patch.turnover_year=turn;try{await saveSettings(patch);renderCurrent()}catch(e){failSave(e)}}
function ohEdit(i){const list=ohItems().map(x=>({...x})),x=list[i];
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(x.icon||'')} ${esc(x.name)}</h2><label class=field>Название<input id=ohN value="${esc(x.name)}"></label><label class=field>Сумма в месяц, ₽<input id=ohA inputmode=decimal value="${moneyText(x.amount)}"></label><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=ohS>Сохранить</button></div><button class=dangerLink id=ohD>Удалить статью</button>`;
 openModal();$('ohA').oninput=e=>fmtMoneyInput(e.target);
 $('ohS').onclick=async()=>{x.name=$('ohN').value.trim()||x.name;x.amount=moneyVal($('ohA').value);closeModal();await ohSave(list)};
 $('ohD').onclick=async()=>{if(!confirm('Удалить статью «'+x.name+'»?'))return;list.splice(i,1);closeModal();await ohSave(list)};
}
function ohAdd(){const ic=['🏠','⚡','🔥','💧','📱','🚚','🛡','🧾'];
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Новая статья</h2><div class=chipRow id=ohI>${ic.map((c,i)=>`<button type=button class="chip ${i===6?'on':''}" data-v="${c}">${c}</button>`).join('')}</div><label class=field>Название<input id=ohN placeholder="Например: газ, вода, охрана, бухгалтер"></label><label class=field>Сумма в месяц, ₽<input id=ohA inputmode=decimal></label><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=ohS>Добавить</button></div>`;
 openModal();let icon='🛡';$('ohA').oninput=e=>fmtMoneyInput(e.target);$('ohI').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;icon=b.dataset.v;[...$('ohI').children].forEach(x=>x.classList.toggle('on',x===b))};
 $('ohS').onclick=async()=>{const n=$('ohN').value.trim();if(!n)return alert('Название');const list=ohItems().map(x=>({...x}));list.push({id:uuid(),icon,name:n,amount:moneyVal($('ohA').value)});closeModal();await ohSave(list)};
}
function ohTurn(){askNum('Средний оборот в год','по нему считается доля накладных в каждом договоре',ohTurnover(),async v=>{if(!(v>0))throw new Error('Укажите оборот');await saveSettings({turnover_year:v})},'Оборот в год, ₽')}
