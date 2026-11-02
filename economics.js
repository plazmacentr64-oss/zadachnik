'use strict';
// v48: экономика объекта (план/факт/прогноз, маржа), расходы, цены изделий для КП и акта. Только владелец.
let expenses=[],specPrices=new Map(),finPlans=new Map();
const EXP_CAT={materials:'Материалы',delivery:'Доставка / транспорт',subcontract:'Субподряд',paint:'Покраска на стороне',other:'Прочее'};
const overheadPct=()=>{const v=+wsSettings?.overhead_pct;return wsSettings&&wsSettings.overhead_pct!=null&&isFinite(v)&&v>=0&&v<=100?v:10};
function avgDayRate(){const r=(typeof workers!=='undefined'?workers:[]).filter(w=>w.active&&w.pay_type==='day'&&+w.day_rate>0).map(w=>+w.day_rate);return r.length?r.reduce((a,b)=>a+b,0)/r.length:(+wsSettings?.day_rate_default||3000)}

async function loadEco(){
 if(!isOwner()){expenses=[];specPrices=new Map();finPlans=new Map();return}
 try{const ws=currentWorkspace;const [e,p,f]=await Promise.all([fetchAll(()=>sb.from('project_expenses').select('*').eq('workspace_id',ws).order('id')),fetchAll(()=>sb.from('spec_prices').select('*').eq('workspace_id',ws).order('spec_line_id')),fetchAll(()=>sb.from('project_finance').select('project_id,plan').eq('workspace_id',ws).order('project_id'))]);
  if(e.error||p.error||f.error)throw e.error||p.error||f.error;
  expenses=e.data||[];specPrices=new Map((p.data||[]).map(x=>[x.spec_line_id,+x.price]));finPlans=new Map((f.data||[]).map(x=>[x.project_id,x.plan||{}]))}
 catch(err){console.warn('eco',err)}
}

// Себестоимость 1 шт строки спецификации: материалы по прайсу + труд по плану (расценки объекта)
function lineUnitCost(l){
 const ms=catMats.filter(m=>m.item_id===l.item_id);let metal=0,other=0,unpriced=0;
 const sp=typeof lineSpecies==='function'?lineSpecies(l):null;ms.forEach(m=>{const c=matCost(m,sp);if(!c){unpriced++;return}if(m.kind==='metal')metal+=c.sum;else other+=c.sum});
 let ops=projOps.filter(o=>o.spec_line_id===l.id);if(!ops.length)ops=catOps.filter(o=>o.item_id===l.item_id);
 const piece=ops.filter(o=>o.pay_type==='piece').reduce((s,o)=>s+(+o.rate||0),0),days=ops.filter(o=>o.pay_type==='day').reduce((s,o)=>s+(+o.norm_days||0),0);
 const labor=piece+days*avgDayRate();
 return {metal,other,labor,total:metal+other+labor,unpriced};
}
function ecoPlan(pid){
 const lines=specLines.filter(l=>l.project_id===pid),plan=finPlans.get(pid)||{};
 let metal=0,other=0,labor=0,unpriced=0;lines.forEach(l=>{const c=lineUnitCost(l),q=+l.qty||0;metal+=c.metal*q;other+=c.other*q;labor+=c.labor*q;unpriced+=c.unpriced});
 const materials=metal+other,delivery=+plan.delivery||0,sub=+plan.sub||0,oth=+plan.other||0,overhead=(materials+labor)*overheadPct()/100;
 return {metal,other,materials,labor,delivery,sub,oth,overhead,total:materials+labor+delivery+sub+oth+overhead,unpriced,lines:lines.length};
}
function ecoFact(pid){
 const ex=expenses.filter(e=>e.project_id===pid),sum=c=>ex.filter(e=>c.includes(e.category)).reduce((s,e)=>s+(+e.amount||0),0);
 const lab=projectLabor(pid),p=ecoPlan(pid);
 const f={materials:sum(['materials']),labor:lab.piece+lab.day,delivery:sum(['delivery']),sub:sum(['subcontract','paint']),oth:sum(['other']),overhead:p.overhead};
 f.total=f.materials+f.labor+f.delivery+f.sub+f.oth+f.overhead;return f;
}
function ecoHtml(pid){
 if(!isOwner())return '';
 const o=data.find(x=>x.id===pid);if(!o)return '';
 const P=ecoPlan(pid),F=ecoFact(pid),done=o.status==='Выполнено';
 const rows=[['materials','Материалы'],['labor','Труд (табель)'],['delivery','Доставка / транспорт'],['sub','Субподряд и покраска'],['oth','Прочее'],['overhead',`Накладные цеха ${num(overheadPct())}%`]];
 const fc=k=>done?F[k]:Math.max(P[k],F[k]),forecast=rows.reduce((s,[k])=>s+fc(k),0);
 const mPlan=o.money-P.total,mFc=o.money-forecast,pct=v=>o.money?num(v/o.money*100,1)+'%':'—';
 const over=rows.filter(([k])=>k!=='overhead'&&F[k]>P[k]+0.5&&P[k]>0).map(([k,l])=>`${l}: дороже плана на ${rub(F[k]-P[k])}`);
 const noPlan=rows.filter(([k])=>k!=='overhead'&&F[k]>0&&P[k]===0).map(([k,l])=>l);
 const ex=expenses.filter(e=>e.project_id===pid).sort((a,b)=>String(b.spent_on).localeCompare(String(a.spent_on)));
 const col=['#7b9cc4','#7bc48e','#c4a27b','#c47b9c','#a0a8b0','#d0c48a'],tot=Math.max(o.money,forecast)||1;
 return `<div class=info id=ecoBox><div class=dHead><div class=label>Экономика объекта</div><button class=chip onclick="openEcoPlan('${pid}')">План и %</button></div>
 <div class=kvRow><span>Договор</span><b>${rub(o.money)}</b></div>
 <div class=ecoGrid><span class=eh>Статья</span><span class=eh>План</span><span class=eh>Факт</span>
 ${rows.map(([k,l])=>`<span>${l}${k==='materials'&&(P.metal||P.other)?`<small>металл ${num(Math.round(P.metal),0)} · прочее ${num(Math.round(P.other),0)}</small>`:''}</span><span>${num(Math.round(P[k]),0)}</span><span class="${F[k]>P[k]+0.5&&P[k]>0?'neg':''}">${num(Math.round(F[k]),0)}</span>`).join('')}
 <span class=et>Себестоимость</span><span class=et>${num(Math.round(P.total),0)}</span><span class=et>${num(Math.round(F.total),0)}</span></div>
 <div class=mBig><div><small>Маржа по плану</small><b class="${mPlan<0?'neg':''}">${rub(mPlan)}</b><small>${pct(mPlan)} от договора</small></div><div style="text-align:right"><small>${done?'Итог по факту':'Прогноз на сдачу'}</small><b class="${mFc<mPlan-0.5?'warnC':''} ${mFc<0?'neg':''}">${rub(mFc)}</b><small>${pct(mFc)}</small></div></div>
 <div class=ecoBar>${rows.map(([k],i)=>`<i style="width:${Math.max(0,fc(k)/tot*100)}%;background:${col[i]}"></i>`).join('')}<i style="width:${Math.max(0,mFc/tot*100)}%;background:var(--primary)"></i></div>
 ${!P.lines?'<div class=small>Заполните спецификацию — план посчитается из изделий.</div>':''}${P.unpriced?`<div class=small>${P.unpriced} ${plural(P.unpriced,'материал','материала','материалов')} в изделиях без цены — привяжите к прайсу в справочнике.</div>`:''}
 ${over.length?`<div class=ecoAlert>⚠ ${over.map(esc).join('<br>⚠ ')}</div>`:''}${noPlan.length?`<div class=small>Есть факт без плана: ${noPlan.join(', ')} — укажите план в «План и %».</div>`:''}
 <div class=inlineRow style="margin-top:8px"><button class="btn secondary" onclick="openExpense('${pid}')">+ Расход</button><button class="btn secondary" onclick="openDocPrices('${pid}')">Цены для КП и акта</button></div>
 ${ex.length?`<details style="margin-top:8px"><summary class=small style="cursor:pointer">Расходы по объекту · ${ex.length} · ${rub(ex.reduce((s,e)=>s+(+e.amount||0),0))}</summary>${ex.map(e=>`<div class=doc><span>${esc(EXP_CAT[e.category])}${e.note?' · '+esc(e.note):''}<br><span class=small>${fmt(e.spent_on)}${e.source==='supply'?' · из снабжения':''}</span></span><span><b>${rub(e.amount)}</b> <button class=edDel aria-label="Удалить расход" onclick="delExpense('${e.id}','${pid}')">×</button></span></div>`).join('')}</details>`:''}</div>`;
}
function openExpense(pid){
 let cat='delivery',method='cash';
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Расход по объекту</h2><div class=summary>${esc(projName(pid))}</div>
 <div class=label>Статья</div><div class=chipRow id=exCat>${Object.entries(EXP_CAT).map(([k,l])=>`<button type=button class="chip ${k===cat?'on':''}" data-v=${k}>${l}</button>`).join('')}</div>
 <label class=field>Сумма, ₽<input id=exAmt inputmode=decimal autocomplete=off></label>
 <div class=chipRow id=exMethod><button type=button class="chip on" data-v=cash>Наличные</button><button type=button class=chip data-v=card>Карта</button><button type=button class=chip data-v=bank>По счёту</button></div>
 <label class=field>Дата<input id=exDate type=date value="${localISO()}"></label>
 <label class=field>Комментарий<input id=exNote placeholder="например: Газель, отгрузка 6 скамеек"></label>
 <div class=small>Материалы от поставщиков попадают сюда сами, когда в «Снабжении» отмечаете «Пришло».</div>
 <div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button><button class=btn id=exSave>Записать</button></div>`;
 openModal();$('exAmt').oninput=e=>fmtMoneyInput(e.target);
 const chips=(id,set)=>$(id).onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;set(b.dataset.v);[...$(id).children].forEach(x=>x.classList.toggle('on',x===b))};
 chips('exCat',v=>cat=v);chips('exMethod',v=>method=v);
 $('exSave').onclick=async()=>{const b=$('exSave');if(b.disabled)return;const a=moneyVal($('exAmt').value);if(!a)return alert('Укажите сумму');b.disabled=true;
  try{await q(sb.from('project_expenses').insert({workspace_id:currentWorkspace,project_id:pid,category:cat,amount:a,spent_on:$('exDate').value||localISO(),method,note:$('exNote').value.trim(),created_by:currentUser.id}));await loadEco();toast('Расход '+rub(a)+' записан');detail(pid)}catch(e){b.disabled=false;failSave(e)}};
}
async function delExpense(id,pid){const e=expenses.find(x=>x.id===id);if(!e||!confirm(`Удалить расход ${rub(e.amount)} (${EXP_CAT[e.category]})?`))return;try{await q(sb.from('project_expenses').delete().eq('id',id));await loadEco();detail(pid)}catch(err){failSave(err)}}
function openEcoPlan(pid){
 const plan=finPlans.get(pid)||{};
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>План по объекту</h2><div class=summary>${esc(projName(pid))} · материалы и труд считаются из спецификации</div>
 <label class=field>Доставка / транспорт, ₽<input id=epDel inputmode=decimal value="${plan.delivery?moneyText(plan.delivery):''}" placeholder="0"></label>
 <label class=field>Субподряд и покраска, ₽<input id=epSub inputmode=decimal value="${plan.sub?moneyText(plan.sub):''}" placeholder="0"></label>
 <label class=field>Прочее, ₽<input id=epOth inputmode=decimal value="${plan.other?moneyText(plan.other):''}" placeholder="0"></label>
 <div class=label style="margin-top:10px">Для всех объектов</div>
 <label class=field>Накладные цеха, % от материалов и труда<input id=epOh inputmode=decimal value="${num(overheadPct())}"></label>
 <label class=field>Ставка чел-дня для плана посуточных, ₽<input id=epRate inputmode=decimal value="${moneyText(avgDayRate())}"><span class=small>${(typeof workers!=='undefined'?workers:[]).some(w=>w.active&&w.pay_type==='day'&&+w.day_rate>0)?'сейчас берётся средняя ставка ваших посуточных':'нет посуточных со ставкой — берётся это число'}</span></label>
 <div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button><button class=btn id=epSave2>Сохранить</button></div>`;
 openModal();['epDel','epSub','epOth','epRate'].forEach(k=>$(k).oninput=e=>fmtMoneyInput(e.target));
 $('epSave2').onclick=async()=>{const oh=parseFloat($('epOh').value.replace(',','.'));if(!(oh>=0&&oh<=100))return alert('Накладные — от 0 до 100%');
  const np={...plan,delivery:moneyVal($('epDel').value),sub:moneyVal($('epSub').value),other:moneyVal($('epOth').value)};
  try{await q(sb.from('project_finance').upsert({project_id:pid,workspace_id:currentWorkspace,amount:+data.find(o=>o.id===pid)?.money||0,plan:np}));await saveSettings({overhead_pct:oh,day_rate_default:moneyVal($('epRate').value)||3000});finPlans.set(pid,np);toast('План сохранён');detail(pid)}catch(e){failSave(e)}};
}
// Цены изделий для документов
function openDocPrices(pid){
 const o=data.find(x=>x.id===pid),lines=specLines.filter(l=>l.project_id===pid);
 if(!lines.length)return alert('Сначала заполните спецификацию объекта');
 const cost=new Map(lines.map(l=>[l.id,lineUnitCost(l).total*(1+overheadPct()/100)]));
 let prices=new Map(lines.map(l=>[l.id,specPrices.get(l.id)??0])),mode=(finPlans.get(pid)||{}).price_mode||'spread',markup=+((finPlans.get(pid)||{}).markup)||50;
 const totalCost=lines.reduce((s,l)=>s+cost.get(l.id)*l.qty,0);
 const spread=()=>{if(!totalCost)return alert('Себестоимость изделий 0 — привяжите материалы к прайсу и укажите расценки');const k=o.money/totalCost;let acc=0;const ord=[...lines].sort((a,b)=>(+a.qty===1?1:0)-(+b.qty===1?1:0));
  ord.forEach((l,i)=>{if(i<ord.length-1){const p=Math.round(cost.get(l.id)*k);prices.set(l.id,p);acc+=p*l.qty}else prices.set(l.id,Math.round((o.money-acc)/l.qty*100)/100)})};
 const byMarkup=()=>lines.forEach(l=>prices.set(l.id,Math.round(cost.get(l.id)*(1+markup/100))));
 const draw=()=>{const sum=lines.reduce((s,l)=>s+(prices.get(l.id)||0)*l.qty,0),diff=Math.round((sum-o.money)*100)/100;
  $('dpBody').innerHTML=`<div class=ecoGrid style="grid-template-columns:1fr 74px 96px"><span class=eh>Изделие</span><span class=eh>Себест.</span><span class=eh>Цена за шт</span>
  ${lines.map(l=>`<span>${esc(l.item_name)}<small>${num(l.qty)} шт · сумма ${rub((prices.get(l.id)||0)*l.qty)}</small></span><span>${num(Math.round(cost.get(l.id)),0)}</span><span><input class=dpIn data-l="${l.id}" inputmode=decimal value="${prices.get(l.id)?moneyText(prices.get(l.id)):''}" ${mode==='manual'?'':'readonly'}></span>`).join('')}
  <span class=et>Итого</span><span class=et>${num(Math.round(totalCost),0)}</span><span class=et>${rub(sum)}</span></div>
  <div class=small>Себестоимость включает накладные ${num(overheadPct())}%. ${totalCost&&sum?`Наценка на себестоимость: ${num((sum/totalCost-1)*100,1)}%.`:''}</div>
  ${Math.abs(diff)>=0.01?`<div class=ecoAlert>Итог отличается от суммы договора ${rub(o.money)} на ${rub(diff)}${mode!=='spread'?' — нажмите «Разложить договор» или поправьте цены':''}.</div>`:`<div class=small style="color:var(--primary)">✓ Сходится с договором ${rub(o.money)} до копейки</div>`}
  ${mode==='markup'&&Math.abs(diff)>=0.01?`<button class=linkBtn onclick="dpToContract('${pid}',${Math.round(sum*100)/100})">Записать ${rub(sum)} в сумму договора</button>`:''}`;
  $('dpBody').querySelectorAll('.dpIn').forEach(i=>{i.oninput=e=>{fmtMoneyInput(e.target)};i.onchange=e=>{prices.set(e.target.dataset.l,moneyVal(e.target.value));draw()}})};
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Цены для КП и акта</h2><div class=summary>${esc(o.name)} · договор ${rub(o.money)}</div>
 <div class=segBar id=dpMode><button data-m=markup>Наценка %</button><button data-m=spread>Разложить договор</button><button data-m=manual>Вручную</button></div>
 <label class=field id=dpMk hidden>Наценка на себестоимость, %<input id=dpMarkup inputmode=decimal value="${num(markup)}"></label>
 <div id=dpBody></div>
 <div class=actions><button class="btn secondary" onclick="detail('${pid}')">Назад</button><button class=btn id=dpSave>Сохранить цены</button></div>`;
 openModal();
 const setMode=m=>{mode=m;[...$('dpMode').children].forEach(b=>b.classList.toggle('on',b.dataset.m===m));$('dpMk').hidden=m!=='markup';if(m==='spread')spread();if(m==='markup')byMarkup();draw()};
 $('dpMode').onclick=e=>{const b=e.target.closest('[data-m]');if(b)setMode(b.dataset.m)};
 $('dpMarkup').oninput=e=>{markup=parseFloat(e.target.value.replace(',','.'))||0;byMarkup();draw()};
 setMode(mode==='manual'&&![...prices.values()].some(Boolean)?'spread':mode);
 $('dpSave').onclick=async()=>{const b=$('dpSave');if(b.disabled)return;b.disabled=true;
  try{await q(sb.from('spec_prices').upsert(lines.map(l=>({spec_line_id:l.id,workspace_id:currentWorkspace,price:prices.get(l.id)||0,updated_at:new Date().toISOString()}))));
   const np={...(finPlans.get(pid)||{}),price_mode:mode,markup};await q(sb.from('project_finance').upsert({project_id:pid,workspace_id:currentWorkspace,amount:+o.money||0,plan:np}));finPlans.set(pid,np);
   await loadEco();toast('Цены сохранены — они в КП, акте и договоре');detail(pid)}catch(e){b.disabled=false;failSave(e)}};
}
async function dpToContract(pid,sum){const o=data.find(x=>x.id===pid);if(!o||!confirm(`Записать в сумму договора ${rub(sum)} (было ${rub(o.money)})?`))return;o.money=sum;try{await serverProjectUpsert(o);toast('Сумма договора: '+rub(sum));openDocPrices(pid)}catch(e){failSave(e)}}
// Строки документа из спецификации (с ценами владельца)
function specDocRows(pid){const lines=specLines.filter(l=>l.project_id===pid);return lines.map(l=>({name:l.item_name,qty:+l.qty,unit:'шт',price:specPrices.get(l.id)||0}))}
// Стоимость детали по прайсу (для расходов при «Пришло»)
function partCost(p){if(p.wood_slot_id&&typeof woodPartPrice==='function'){const w=woodPartPrice(p);return w?partMeters(p)*w.price:0}const pr=priceById(p.price_item_id);if(!pr)return 0;if(p.shape==='sheet')return partArea(p)*(1+wastePct()/100)*pr.price/(sheetArea(pr)||1);if(pr.kind==='linear')return partMeters(p)*pr.price;return (+p.qty||0)*pr.price}
