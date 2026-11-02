'use strict';
// v54: единые значки, новая лента «Объекты», карточка блоками, новая деталь из прайса с барабанами, несколько сварщиков с долями.
const STAGE_IC=['handshake','shopping-cart','fire','paint-brush-broad','wrench','truck-trailer','seal-check'];

/* нижнее меню — значки */
(()=>{const m={today:'sun',objects:'buildings',tasks:'check-square',wood:'factory',supply:'truck',analytics:'wallet'};document.querySelectorAll('.tab').forEach(b=>{const i=b.querySelector('i');if(i&&m[b.dataset.v])i.innerHTML=ic(m[b.dataset.v],22)})})();

/* лента «Объекты» */
const prodIcon=pid=>{const l=specLines.find(x=>x.project_id===pid),it=l&&catItems.find(i=>i.id===l.item_id);const k=it?catOf(it):catGuess(data.find(o=>o.id===pid)?.items||'');return k==='other'&&!l?ic('buildings',22):secOf(k)[1]};
function objBadges(o){
 const ops=projOps.filter(x=>x.project_id===o.id&&x.pay_type==='piece'&&+x.qty_plan>0),b=[];
 const agg=rx=>{const s=ops.filter(x=>rx.test(x.name));if(!s.length)return null;return [s.reduce((a,x)=>a+Math.min(shopDone(x.id),x.qty_plan),0),s.reduce((a,x)=>a+(+x.qty_plan||0),0)]};
 const w=agg(/свар/i),p=agg(/покрас/i);
 if(w)b.push(`<span class="bg m">${ic('fire',13)} сварка ${num(w[0])}/${num(w[1])}${w[0]>=w[1]?' ✓':''}</span>`);
 if(p)b.push(`<span class="bg p">${ic('paint-brush-broad',13)} покраска ${num(p[0])}/${num(p[1])}</span>`);
 const wd=parts.filter(x=>x.project_id===o.id&&x.kind==='wood');if(wd.length){const q=wd.reduce((a,x)=>a+(+x.qty||0),0),d=wd.reduce((a,x)=>a+(+x.paint_qty||0),0);b.push(`<span class="bg w">${ic('tree',13)} брус ${num(d)}/${num(q)}</span>`)}
 const ord=parts.filter(x=>x.project_id===o.id&&x.status==='order').length;if(ord)b.push(`<span class="bg r">${ic('shopping-cart',13)} к заказу ${ord}</span>`);
 const t=tasks.filter(x=>x.projectId===o.id&&!x.done).length;if(t)b.push(`<span class=bg>${ic('list-checks',13)} задач ${t}</span>`);
 return b.length?`<div class=ocBadges>${b.join('')}</div>`:'';
}
function card(o,openCount){
 const own=isOwner(),done=o.status==='Выполнено',contract=o.status==='Подписание договора',h=health(o),d=o.date?days(o.date):null;
 const due=done?['g','сдан']:contract?['','договор']:d==null?['','без срока']:d<0?['r',`−${-d} дн`]:d<=14?['o',`${d} дн`]:['g',`${d} дн`];
 const n=done?7:o.stage,cur=n>=7?'Все этапы пройдены':STAGES[n];
 const paid=+o.money>0?Math.round(received(o)/o.money*100):0;
 let nums='';if(own){let third=`<div>Остаток<b>${rubShort(left(o))}</b></div>`;if(done&&typeof ecoPlan==='function'){const P=ecoPlan(o.id);if(P.total-P.overhead>0&&+o.money>0)third=`<div>Маржа<b>${num((o.money-P.total)/o.money*100,0)}%</b></div>`}
  nums=`<div class=ocNums><div>Договор<b>${rubShort(o.money)}</b></div><div>Оплачено<b>${paid}%</b></div>${third}</div>`}
 return `<article class="ocard2 ${done?'g':h.cls||'g'}" tabindex=0 role=button onclick="detail('${o.id}')" onkeydown="if(event.key==='Enter')detail('${o.id}')">
 <div class=ocT><span class=ocAv>${prodIcon(o.id)}</span><div class=ocN><b>${esc(o.name)}</b><small>${esc(o.contractor||'Заказчик не указан')}</small></div><span class="ocDue2 ${due[0]}">${due[1]}</span></div>
 ${contract?'':`<div class=ocStp>${STAGES.map((_,i)=>`<i class="${i<n?'d':i===n?'n':''}"></i>`).join('')}</div><div class=ocStl><span>${n>=7?'':'Сейчас: '}<b>${n<7?ic(STAGE_IC[n],14)+' ':''}${esc(cur)}</b></span><span>${n} из 7</span></div>`}
 ${nums}${objBadges(o)}</article>`;
}

/* карточка объекта — сворачиваемые блоки */
let accOpen=(()=>{try{return JSON.parse(localStorage.getItem('accOpen')||'null')||{stages:true}}catch(e){return {stages:true}}})();
const ACC={stages:['stack','Этапы'],data:['clipboard-text','Данные договора'],spec:['package','Спецификация'],eco:['chart-bar','Экономика'],money:['coins','Деньги'],tasks:['list-checks','Задачи'],files:['paperclip','Файлы']};
function accKey(el){if(el.id==='specBox')return 'spec';if(el.id==='ecoBox')return 'eco';if(el.id==='docsBox')return 'files';const l=(el.querySelector(':scope > .label, :scope > .dHead .label')?.textContent||'').trim();
 if(/^Этапы/.test(l))return 'stages';if(/^Деньги/.test(l))return 'money';if(/^Закрывающие/.test(l))return 'closing';if(/^Задачи/.test(l))return 'tasks';if(el.querySelector('.inlineRow input[type=date]'))return 'data';return null}
function accSum(k,o){
 if(k==='stages'){const n=o.status==='Выполнено'?7:o.stage;return o.status==='Подписание договора'?'после подписания договора':n>=7?'все этапы пройдены':`${ic(STAGE_IC[n],13)} ${STAGES[n]} · ${n} из 7`}
 if(k==='data'){const r=fillList(o),f=r.filter(x=>x[1]).length,miss=r.some(x=>x[2]&&!x[1]);return `${miss?'<i class=accDot></i>':''}заполнено ${f} из ${r.length}`}
 if(k==='spec'){const ls=specLines.filter(l=>l.project_id===o.id);return ls.length?`${ls.length} ${plural(ls.length,'изделие','изделия','изделий')} · ${num(ls.reduce((s,l)=>s+(+l.qty||0),0))} ${ls.every(l=>itemUnit(l.item_id)==='шт')?'шт':'ед.'}`:'пусто'}
 if(k==='eco'){if(typeof ecoPlan!=='function'||!(+o.money>0))return '';const P=ecoPlan(o.id);return P.total-P.overhead>0?`маржа ${num((o.money-P.total)/o.money*100,0)}% · план`:'нет данных'}
 if(k==='money'){const p=+o.money>0?Math.round(received(o)/o.money*100):0;return `оплачено ${p}% · остаток ${rubShort(left(o))}`}
 if(k==='tasks'){const ts=tasks.filter(t=>t.projectId===o.id&&!t.done),hot=ts.filter(t=>t.date&&days(t.date)<=0).length;return ts.length?`${ts.length} ${plural(ts.length,'активная','активные','активных')}${hot?' · '+hot+' горит':''}`:'нет активных'}
 if(k==='files'){const n=document.querySelectorAll('#docsBox .doc').length;return n?`${n} ${plural(n,'файл','файла','файлов')}`:'нет'}
 return ''}
function accToggle(k){accOpen[k]=!accOpen[k];try{localStorage.setItem('accOpen',JSON.stringify(accOpen))}catch(e){}const s=document.querySelector(`#sheet .acc[data-k="${k}"]`);if(s)s.classList.toggle('open',!!accOpen[k])}
function accHead(k,o){return `<span class=accIc>${ic(ACC[k][0],18)}</span><b>${ACC[k][1]}</b><small class=accS>${accSum(k,o)}</small><span class=accCh>${ic('caret-down',14)}</span>`}
function accRefresh(o){document.querySelectorAll('#sheet .acc').forEach(s=>{const h=s.querySelector('.accH');if(h)h.innerHTML=accHead(s.dataset.k,o)})}
function accordionize(id){
 const o=data.find(x=>x.id===id),sh=$('sheet');if(!o||!sh||currentDetail!==id||sh.querySelector('.acc'))return;
 const fb=$('fillBox');if(fb)fb.remove();
 const blocks=[...sh.children].filter(el=>el.classList.contains('info'));let moneySec=null;
 for(const el of blocks){const k=accKey(el);if(!k)continue;
  if(k==='closing'){if(moneySec){el.classList.add('accInner');moneySec.querySelector('.accB').append(el)}continue}
  const s=document.createElement('section');const mustOpen=k==='data'&&fillList(o).some(x=>x[2]&&!x[1]);s.className='acc'+(accOpen[k]||mustOpen?' open':'');s.dataset.k=k;
  s.innerHTML=`<button type=button class=accH onclick="accToggle('${k}')">${accHead(k,o)}</button><div class=accB></div>`;
  el.replaceWith(s);el.classList.add('accInner');s.querySelector('.accB').append(el);if(k==='money')moneySec=s}
 // заголовок блока «Этапы» внутри не нужен — он уже в шапке
 sh.querySelectorAll('.acc .accInner > .label:first-child, .acc .accInner > .dHead:first-child').forEach(x=>{if(!x.querySelector('button'))x.classList.add('accHide')});
}
const _detail53=detail;
detail=async function(id){await _detail53(id);try{accordionize(id)}catch(e){console.warn('acc',e)}};
const _updateFill53=updateFill;
updateFill=function(o){_updateFill53(o);accRefresh(o)};

/* новая деталь: вкладки прайса → барабаны размеров и длины */
let npS=null;
const NP_TABS=[['metal','Металл','gear-six'],['wood','Дерево','tree'],['paint','Краска','paint-roller'],['hw','Метизы','nut'],['own','Своё','pencil-ruler']];
const LENS=[100,150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2200,2400,2500,2700,3000,3500,4000,4500,5000,5500,6000];
const dimsOf=n=>(String(n).replace(/(\d),(\d)/g,'$1.$2').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
function secTh(p){const d=dimsOf(p.name);if(p.kind==='sheet')return {sec:'лист',th:d[0]};if(d.length>=3)return {sec:d.slice(0,-1).join('×'),th:d[d.length-1]};if(d.length===2&&/угол|труба кругл|^труба/i.test(p.category))return {sec:String(d[0]),th:d[1]};return {sec:d.join('×'),th:null}}
const _openPart50=openPart;
openPart=function(id){if(id)return _openPart50(id);return openPartNew()};
function openPartNew(pid){
 const own=isOwner(),act=activeProjects();
 npS={pid:pid!==undefined?pid:(shopKind==='shop'?'':(shopFilter||act[0]?.id||'')),tab:own&&priceItems.length?'metal':'own',cat:'',q:'',price:null,len:1500,w:300,qty:'',slot:woodSlots[0]?.id||'',sp:woodSpecies[0]?.id||'',name:'',size:'',unit:'шт',shape:'linear',note:''};
 if(!own||!priceItems.length)npS.tab=shopKind==='wood'&&woodSlots.length?'wood':'own';
 drawNP();openModal();
}
function npRead(){const s=npS;if(!s)return;['qty','note','name','size'].forEach(k=>{const el=$('np_'+k);if(el)s[k]=el.value});if($('np_proj'))s.pid=$('np_proj').value;if($('np_unit'))s.unit=$('np_unit').value;if($('np_shape'))s.shape=$('np_shape').value}
function npTab(t){npRead();npS.tab=t;npS.cat='';npS.q='';npS.price=null;drawNP()}
function npPick(id){npRead();const p=priceById(id);npS.price=p;if(p&&p.kind==='linear'&&!npS.len)npS.len=1500;drawNP()}
function drawNP(){
 const s=npS,own=isOwner(),p=s.price;
 const tabs=NP_TABS.filter(([k])=>k==='own'||(k==='wood'?woodSlots.length:own&&priceItems.some(x=>priceTabOf(x.category)===k)));
 let body='';
 if(['metal','paint','hw'].includes(s.tab)){
  const inT=priceItems.filter(x=>priceTabOf(x.category)===s.tab),cats=[...new Set(inT.map(x=>x.category))].sort((a,b)=>catRank(a)-catRank(b)),qq=s.q.toLowerCase().replace(/\s+/g,'').replace(/(\d)[xх*](?=\d)/g,'$1×');
  const list=inT.filter(x=>(!s.cat||x.category===s.cat)&&(!qq||x.name.toLowerCase().replace(/\s+/g,'').includes(qq)));
  if(!p){body=`${cats.length>1?`<div class="chipRow chipScroll">${['',...cats].map(c=>`<button type=button class="chip ${s.cat===c?'on':''}" onclick="npRead();npS.cat='${esc(c)}';drawNP()">${c?esc(c):'Все'}</button>`).join('')}</div>`:''}<input id=np_q class=searchIn placeholder="Поиск: 40х20, лист 2, болт М8" value="${esc(s.q)}"><div id=npList>${list.slice(0,80).map(x=>`<button type=button class=priceRow onclick="npPick('${x.id}')"><div><b>${esc(x.name)}</b><span>${esc(priceSub(x))}</span></div><strong>${priceUnitText(x)}</strong></button>`).join('')||'<div class=empty>Ничего не найдено</div>'}</div>`}
  else{const st=secTh(p);
   body=`<div class=npSel><div><b>${esc(p.name)}</b><span>${esc(p.category)} · ${priceUnitText(p)}</span></div><button type=button class=chip onclick="npRead();npS.price=null;drawNP()">Сменить</button></div>`;
   if(p.kind==='linear')body+=`<button type=button class=wheelBig onclick="npWheel()"><span><b>${esc(st.sec||'—')}</b><small>сечение</small></span>${st.th!=null?`<span><b>${num(st.th,1)}</b><small>толщина</small></span>`:''}<span><b>${num(s.len,0)}</b><small>длина, мм</small></span></button><div class=res id=npHint></div>`;
   else if(p.kind==='sheet')body+=`<button type=button class=wheelBig onclick="npWheel()"><span><b>${num(st.th,1)} мм</b><small>толщина</small></span><span><b>${num(s.w,0)}</b><small>ширина детали</small></span><span><b>${num(s.len,0)}</b><small>длина детали</small></span></button><div class=res id=npHint></div>`}
 }else if(s.tab==='wood'){const slot=woodSlot(s.slot),sp=woodSp(s.sp),wp=woodPrice(s.slot,s.sp);
  body=`<button type=button class=wheelBig onclick="npWheel()"><span><b>${esc(slot?.nominal||slot?.name||'—')}</b><small>сечение</small></span><span><b>${esc(sp?.name||'—')}</b><small>порода</small></span><span><b>${num(s.len,0)}</b><small>длина, мм</small></span></button><div class=res>Факт. размер: <b>${esc((wp&&wp.size)||slot?.nominal||'—')}</b>${own&&wp&&+wp.price>0?' · '+rub(wp.price)+'/м':''}</div>`}
 else{body=`<datalist id=npNames>${MAT_NAMES.map(n=>`<option value="${n}">`).join('')}</datalist><div class=inlineRow><label class=field>Материал<input id=np_name list=npNames value="${esc(s.name)}" placeholder="Труба проф. / Лиственница / Болт"></label><label class=field>Размер<input id=np_size value="${esc(s.size)}" placeholder="40×20×2"></label></div>
  <label class=field>Форма<select id=np_shape onchange="npRead();drawNP()"><option value=linear ${s.shape==='linear'?'selected':''}>Погонаж (длина)</option><option value=piece ${s.shape==='piece'?'selected':''}>Штучно</option></select></label>
  ${s.shape==='linear'?`<button type=button class=wheelBig onclick="npWheel()"><span><b>${num(s.len,0)}</b><small>длина детали, мм</small></span></button>`:`<label class=field>Ед.<select id=np_unit>${[...new Set([s.unit,...UNITS])].map(u=>`<option ${u===s.unit?'selected':''}>${u}</option>`).join('')}</select></label>`}`}
 const ready=s.tab==='own'||s.tab==='wood'||p;
 const unitL=p&&p.kind==='piece'?(p.unit||'шт'):'шт';
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Новая деталь</h2>
 <div class="segBar seg5">${tabs.map(([k,l,i])=>`<button type=button class="${s.tab===k?'on':''}" onclick="npTab('${k}')">${ic(i,16)} ${l}</button>`).join('')}</div>
 ${body}
 ${ready?`<label class=field>Сколько, ${unitL}<input id=np_qty inputmode=decimal value="${esc(s.qty)}" placeholder="0"></label>
 <label class=field>Объект<select id=np_proj><option value="" ${!s.pid?'selected':''}>Внутрицеховые (без объекта)</option>${activeProjects().map(o=>`<option value="${o.id}" ${o.id===s.pid?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label>
 <label class=field>Примечание<input id=np_note value="${esc(s.note)}" placeholder="для чего деталь"></label>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=npSave>Добавить деталь</button></div>`:''}`;
 if($('np_q'))$('np_q').oninput=e=>{npS.q=e.target.value;const sel=e.target.selectionStart;drawNP();const q2=$('np_q');if(q2){q2.focus();try{q2.setSelectionRange(sel,sel)}catch(_){}}};
 const hint=()=>{const el=$('npHint');if(!el||!npS.price)return;const pp=npS.price,n=qtyVal($('np_qty')?.value);if(pp.kind==='linear'){const st=pp.stock_len_mm||6000,per=Math.floor(st/npS.len);el.innerHTML=per>0?`Из хлыста ${num(st/1000,1)} м выходит ${per} шт${n?` · на ${num(n)} шт — <b>${Math.ceil(n/per)} ${plural(Math.ceil(n/per),'хлыст','хлыста','хлыстов')}</b>`:''}`:`⚠ деталь длиннее хлыста ${num(st/1000,1)} м`}else if(pp.kind==='sheet'){const a=npS.w*npS.len/1e6;el.innerHTML=`${num(a,3)} м² на деталь${n?` · всего ${num(a*n,2)} м²`:''}`}};
 if($('np_qty'))$('np_qty').oninput=hint;hint();
 if($('npSave'))$('npSave').onclick=saveNP;
}
function npWheel(){npRead();const s=npS,p=s.price;
 if(s.tab==='wood')return openWheels('Брус',[{label:'Сечение',value:s.slot,items:woodSlots.map(x=>({v:x.id,t:x.nominal||x.name}))},{label:'Порода',value:s.sp,items:woodSpecies.map(x=>({v:x.id,t:x.name}))},{label:'Длина, мм',value:s.len,items:LENS.map(n=>({v:n,t:String(n)}))}],([a,b,c])=>{s.slot=a;s.sp=b;s.len=+c;drawNP()});
 if(!p)return openWheels('Длина детали',[{label:'Длина, мм',value:s.len,items:LENS.map(n=>({v:n,t:String(n)}))}],([c])=>{s.len=+c;drawNP()});
 const same=priceItems.filter(x=>x.category===p.category&&x.kind===p.kind),st=secTh(p);
 if(p.kind==='sheet'){const ths=[...new Set(same.map(x=>secTh(x).th))].filter(x=>x!=null).sort((a,b)=>a-b),W=[50,100,150,200,250,300,350,400,450,500,600,700,800,900,1000,1250,1500,2000,2500];
  return openWheels('Лист: толщина и деталь',[{label:'Толщина',value:st.th,items:ths.map(v=>({v,t:num(v,1)}))},{label:'Ширина',value:s.w,items:W.map(v=>({v,t:String(v)}))},{label:'Длина',value:s.len,items:[...new Set([...W,3000])].map(v=>({v,t:String(v)}))}],([t,w,l])=>{s.w=+w;s.len=+l;const m=same.find(x=>secTh(x).th===+t);if(m)s.price=m;drawNP()})}
 const secs=[...new Set(same.map(x=>secTh(x).sec))].sort((a,b)=>dimsOf(a).reduce((s,v)=>s+v,0)-dimsOf(b).reduce((s,v)=>s+v,0)),ths=[...new Set(same.map(x=>secTh(x).th).filter(x=>x!=null))].sort((a,b)=>a-b);
 const cols=[{label:'Сечение',value:st.sec,items:secs.map(v=>({v,t:v}))}];if(ths.length)cols.push({label:'Толщина',value:st.th,items:ths.map(v=>({v,t:num(v,1)}))});cols.push({label:'Длина, мм',value:s.len,items:LENS.map(n=>({v:n,t:String(n)}))});
 openWheels(p.category,cols,vals=>{const sec=vals[0],th=ths.length?+vals[1]:null,len=+vals[vals.length-1];s.len=len;
  const cand=same.filter(x=>secTh(x).sec===sec);let m=cand.find(x=>th==null||secTh(x).th===th);
  if(!m&&cand.length){m=[...cand].sort((a,b)=>Math.abs(secTh(a).th-th)-Math.abs(secTh(b).th-th))[0];toast(`${sec} × ${num(th,1)} нет в прайсе — взял толщину ${num(secTh(m).th,1)}`)}
  if(m)s.price=m;drawNP()})}
async function saveNP(){
 npRead();const s=npS,b=$('npSave');if(b.disabled)return;const n=qtyVal(s.qty);if(!n)return alert('Укажите количество');
 const body={workspace_id:currentWorkspace,project_id:s.pid||null,status:'order',source:'manual',note:String(s.note||'').trim(),supplier:'',created_by:currentUser.id,spec_line_id:null,qty:n,unit:'шт'};
 const p=s.price;
 if(['metal','paint','hw'].includes(s.tab)){if(!p)return alert('Выберите материал из списка');
  const kind=s.tab==='metal'&&!(p.kind==='piece'&&!/сетк/i.test(p.category))?'metal':s.tab==='wood'?'wood':(/сетк/i.test(p.category)?'metal':'other');
  Object.assign(body,{kind,name:p.name,size:'',price_item_id:p.id,shape:p.kind,stock_len_mm:p.kind==='linear'?(p.stock_len_mm||6000):null});
  if(p.kind==='linear')body.length_mm=s.len;else if(p.kind==='sheet'){Object.assign(body,{length_mm:s.len,width_mm:s.w,sheet_w:p.sheet_w||1250,sheet_l:p.sheet_l||2500})}else{body.length_mm=null;body.unit=p.unit||'шт'}}
 else if(s.tab==='wood'){const slot=woodSlot(s.slot),sp=woodSp(s.sp),wp=woodPrice(s.slot,s.sp);if(!slot)return alert('Выберите сечение');Object.assign(body,{kind:'wood',shape:'linear',name:sp?.name||slot.name,size:(wp&&wp.size)||slot.nominal||'',length_mm:s.len,wood_slot_id:slot.id,species_id:sp?.id||null,stock_len_mm:wp?.stock_len_mm||null})}
 else{const name=String(s.name||'').trim();if(!name)return alert('Укажите материал');const k=/лиственн|сосн|ель|дуб|берёз|берез|доск|брус|вагонк|фанер/i.test(name)?'wood':/труб|уголок|полос|лист|швеллер|арматур|пруток|двутавр|профил/i.test(name)?'metal':'other';
  Object.assign(body,{kind:k,name,size:sizeShow(String(s.size||'').trim()),shape:s.shape,length_mm:s.shape==='linear'?s.len:null,unit:s.shape==='linear'?'шт':s.unit})}
 b.disabled=true;b.textContent='Сохраняю…';
 try{await q(sb.from('shop_parts').insert(body));await refreshShop();closeModal();toast('Деталь добавлена · к заказу')}catch(e){b.disabled=false;b.textContent='Добавить деталь';serverError(e);alert('Не удалось: '+(e.message||e))}
}
// выбор из прайса (в техкарте, заявке) — тоже по вкладкам
const _openPricePicker50=openPricePicker;
openPricePicker=function(onPick,onBack){_openPricePicker50(onPick,onBack);const cats=$('pkCats');if(!cats)return;let tab='metal';
 cats.insertAdjacentHTML('beforebegin',`<div class="segBar seg4" id=pkTabs>${PRICE_TABS.map(([k,l,i])=>`<button type=button data-t=${k} class="${k===tab?'on':''}">${ic(i,15)} ${l}</button>`).join('')}</div>`);
 const apply=()=>{[...cats.children].forEach(b=>{const c=b.dataset.c;b.hidden=!!c&&priceTabOf(c)!==tab});const first=[...cats.children].find(b=>!b.dataset.c);first&&first.click();[...$('pkList').children].forEach(r=>{const p=priceById(r.dataset?.id);if(p)r.hidden=priceTabOf(p.category)!==tab})};
 $('pkTabs').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;tab=b.dataset.t;[...$('pkTabs').children].forEach(x=>x.classList.toggle('on',x===b));apply()};
 new MutationObserver(()=>{[...$('pkList')?.children||[]].forEach(r=>{const p=priceById(r.dataset?.id);if(p)r.hidden=priceTabOf(p.category)!==tab})}).observe($('pkList'),{childList:true});
 apply();
};

/* несколько сварщиков на одну работу — у каждого своё количество */
const opAs=opId=>opAssign.filter(a=>a.project_op_id===opId);
function openAssign(opId,thenMark){
 const o=projOps.find(x=>x.id===opId);if(!o)return;const cur=opAs(opId),plan=+o.qty_plan||0;
 const q0={};cur.forEach(a=>q0[a.worker_id]=a.qty!=null?+a.qty:(cur.length===1?plan:Math.floor(plan/cur.length)));
 const rows=shopWorkers.map(w=>({id:w.id,name:w.name,q:q0[w.id]||0,on:q0[w.id]!=null}));
 const draw=()=>{const tot=rows.reduce((s,r)=>s+(r.on?r.q:0),0),fr=plan-tot;
  $('asList').innerHTML=rows.map((r,i)=>`<div class="asRow ${r.on?'on':''}"><button type=button class=asName data-i=${i}>${ic('hard-hat',16)} ${esc(r.name)}${r.on?'':' <small>+ назначить</small>'}</button><span class=asQ><button type=button data-m=${i}>−</button><b>${num(r.q)}</b><button type=button data-p=${i}>+</button></span></div>`).join('')||'<div class=empty>Сотрудников нет. Владелец добавляет их в «Деньги → Зарплата → Сотрудники».</div>';
  $('asBar').innerHTML=rows.filter(r=>r.on&&r.q>0).map((r,i)=>`<i style="width:${plan?r.q/plan*100:0}%;background:${['#5b84b8','#b9844a','#7cc49a','#a15fbf','#e0a400'][i%5]}"></i>`).join('');
  $('asSum').innerHTML=`Распределено <b>${num(tot)} из ${num(plan)}</b>${fr>0?` · свободно ${num(fr)}`:fr<0?` · <span class=neg>больше плана на ${num(-fr)}</span>`:' ✓'}`};
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(o.item_name)} · ${esc(o.name.toLowerCase())}</h2><div class=summary>${esc(projName(o.project_id))} · ${num(plan)} шт — кто сколько делает</div>
 <div class=asBar id=asBar></div><div id=asList></div><div class=res id=asSum></div>
 <button class="btn secondary wide" id=asEven>Поровну между выбранными</button>
 <div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=asSave>Сохранить</button></div>`;
 openModal();draw();
 $('asList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=+(b.dataset.i??b.dataset.m??b.dataset.p),r=rows[i];if(!r)return;
  if(b.dataset.i!=null){r.on=!r.on;if(r.on&&!r.q){const left=plan-rows.reduce((s,x)=>s+(x.on&&x!==r?x.q:0),0);r.q=Math.max(0,left)}}
  else if(b.dataset.m!=null){r.q=Math.max(0,r.q-1);if(!r.q)r.on=false}else{r.q+=1;r.on=true}draw()};
 $('asEven').onclick=()=>{const sel=rows.filter(r=>r.on);if(!sel.length)return toast('Отметьте, кто делает');const base=Math.floor(plan/sel.length);let rest=plan-base*sel.length;sel.forEach(r=>{r.q=base+(rest>0?1:0);if(rest>0)rest--});draw()};
 $('asSave').onclick=async()=>{const b=$('asSave');if(b.disabled)return;const pay=rows.filter(r=>r.on).map(r=>({worker_id:r.id,qty:r.q||null}));b.disabled=true;
  try{const {error}=await sb.rpc('shop_assign_qty',{p_op:opId,p_rows:pay});if(error)throw error;closeModal();await refreshShop();toast(pay.length?'Назначено: '+pay.map(x=>swName(x.worker_id)+(x.qty?' '+num(x.qty):'')).join(', '):'Исполнители сняты');if(thenMark&&pay.length===1)opMark(opId,1,pay[0].worker_id)}catch(e){b.disabled=false;alert('Не удалось: '+(e.message||e))}};
}
// строка «Михаил 4 из 8 · Сергей 2 из 4 · свободно 2» под работой в цеху
const _metalShopHtml51=metalShopHtml;
metalShopHtml=function(){let h=_metalShopHtml51();
 for(const o of projOps){const as=opAs(o.id);if(!as.length||!as.some(a=>a.qty!=null))continue;const plan=+o.qty_plan||0,tot=as.reduce((s,a)=>s+(+a.qty||0),0);
  const line=as.map(a=>{const d=shopProg.filter(p=>p.project_op_id===o.id&&p.worker_id===a.worker_id).reduce((s,p)=>s+(+p.qty||0),0);return `${esc(swName(a.worker_id))} ${num(d)}${a.qty!=null?' из '+num(a.qty):''}`}).join(' · ')+(plan-tot>0?` · свободно ${num(plan-tot)}`:'');
  h=h.replace(`onclick="openOpMark('${o.id}')"`,`onclick="openOpMark('${o.id}')" data-split="${esc(line)}"`)}
 return h};
const _renderShop52=renderShop;
renderShop=function(){_renderShop52();document.querySelectorAll('#woodBody .opCnt[data-split]').forEach(b=>{const row=b.closest('.opRow');if(row&&!row.querySelector('.opSplit'))row.querySelector('.bar')?.insertAdjacentHTML('afterend',`<div class=opSplit>${b.dataset.split}</div>`)})};
