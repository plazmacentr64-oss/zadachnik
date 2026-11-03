'use strict';
// v58: единый вид вкладок — шапка «заголовок + счётчик + «+»», один переключатель-сегмент, одна полоса итогов,
// кружок вместо почты и «ОШИБКА», закрытые объекты без лишних цифр, подсказки только в пустых состояниях.

const v58plusSvg='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

/* ---------- шапка приложения: кружок с точкой связи ---------- */
(()=>{const top=document.querySelector('.teamtop');if(!top)return;top.classList.add('v58top');
 const right=$('teamBtn')?.parentElement;if(!right)return;
 right.insertAdjacentHTML('beforeend',`<button id=v58av class=v58av onclick="openTeam()" aria-label="Ещё: справочники, команда, выход"><span id=v58avL>·</span><i id=v58avDot></i></button>`);
 const sync=()=>{const t=($('syncDot')?.textContent||'').trim(),dot=$('v58avDot');if(!dot)return;dot.className=/ОШИБ/i.test(t)?'bad':/СИНХР|SERVER|сервер/i.test(t)?'ok':'wait';$('v58av').title=t?'Связь: '+t.toLowerCase():''};
 const sd=$('syncDot');if(sd)new MutationObserver(sync).observe(sd,{childList:true,characterData:true,subtree:true,attributes:true});sync();
 const tu=$('teamUser');const name=()=>{const s=String(currentUser?.user_metadata?.display_name||currentUser?.email||'').trim();$('v58avL').textContent=s?s.charAt(0).toUpperCase():'·'};
 if(tu)new MutationObserver(name).observe(tu,{childList:true,characterData:true,subtree:true});
})();

/* ---------- кнопка «+» в шапке вкладки ---------- */
function v58ttl(head){let t=head.querySelector('.v58ttl');if(t)return t;const h1=head.querySelector('h1');if(!h1)return null;
 if(h1.parentElement===head){h1.insertAdjacentHTML('beforebegin','<div class=v58ttl></div>');t=head.querySelector('.v58ttl');t.append(h1)}else{t=h1.parentElement;t.classList.add('v58ttl')}return t}
function v58head(viewId,fn,label){
 const v=$(viewId);if(!v)return;const top=v.querySelector('.top');if(!top)return;
 let head=top.querySelector('.head');
 if(!head){const h1=top.querySelector('h1');if(!h1)return;h1.insertAdjacentHTML('beforebegin','<div class=head></div>');head=top.querySelector('.head');head.append(h1)}
 head.classList.add('v58head');v58ttl(head);
 let b=head.querySelector('.v58plus');
 if(!b){head.insertAdjacentHTML('beforeend',`<button class=v58plus type=button></button>`);b=head.querySelector('.v58plus')}
 if(!fn){b.hidden=true;return}
 b.hidden=false;b.innerHTML=v58plusSvg;b.setAttribute('aria-label',label||'Добавить');b.onclick=fn;
}
function v58count(viewId,text){const v=$(viewId);if(!v)return;const top=v.querySelector('.top'),head=top&&top.querySelector('.head');if(!head)return;const t=v58ttl(head);if(!t)return;let s=t.querySelector('.v58cnt');if(!s){t.insertAdjacentHTML('beforeend','<div class="summary v58cnt"></div>');s=t.querySelector('.v58cnt')}s.textContent=text||''}
// собрать «+ …» кнопки из тела вкладки: одна — «+» в шапке жмёт её, несколько — короткое меню
function v58collect(bodyId){
 const body=$(bodyId);if(!body)return [];
 const bs=[...body.querySelectorAll('button.btn, button.fab')].filter(b=>/^\+\s/.test((b.textContent||'').trim())&&!b.closest('.modal,.s57row,.opRow,.ocard2,.supRow2,.catRow'));
 bs.forEach(b=>{b.classList.add('v58moved');const box=b.parentElement;if(box&&box!==body&&box.classList.contains('inlineRow')&&[...box.children].every(c=>c.classList.contains('v58moved')))box.classList.add('v58moved')});
 return bs.map(b=>({label:(b.textContent||'').trim().replace(/^\+\s*/,''),run:()=>b.click()}));
}
function v58menu(title,acts){
 if(acts.length===1)return acts[0].run();
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>${esc(title)}</h2><div class=s57list>${acts.map((a,i)=>`<button class=s57row data-i=${i}><span class=s57ic>${v58plusSvg}</span><span class=s57tx><b>${esc(a.label)}</b></span><span class=s57chev>›</span></button>`).join('')}</div>`;
 openModal();$('sheet').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{closeModal();setTimeout(()=>acts[+b.dataset.i].run(),0)});
}
function v58bodyPlus(viewId,bodyId,title){const acts=v58collect(bodyId);v58head(viewId,acts.length?()=>v58menu(title,acts):null,acts.length===1?'+ '+acts[0].label:'Добавить')}

/* ---------- Объекты ---------- */
if(typeof renderObjects==='function'){const _ro58=renderObjects;renderObjects=function(){
 _ro58();
 const lbl={active:'Работа',debt:'Оплата',contract:'Договор',archive:'Закрыто'},counts={active:0,debt:0,contract:0,archive:0};data.forEach(o=>counts[bucketOf(o)]++);
 const f=document.querySelector('#objectsView .filters');if(f){f.classList.add('v58seg');f.querySelectorAll('.chip').forEach(c=>{const b=c.dataset.b;c.innerHTML=esc(lbl[b])+(counts[b]&&b!=='archive'?`<i>${counts[b]}</i>`:'')})}
 const own=isOwner();v58head('objectsView',own?()=>openProject():null,'Новый объект');
 const ab=$('addObjBtn');if(ab)ab.classList.add('v58moved');
 const act=data.filter(o=>o.status==='В работе'),hot=act.filter(o=>health(o).level>=3).length;
 v58count('objectsView',`${act.length} в работе${hot?` · ${hot} ${plural(hot,'горит','горят','горят')}`:''}`);
}}
// закрытый и рассчитанный объект: штамп, договор, дата сдачи (и маржа, если посчитана)
if(typeof card==='function'){const _card58=card;card=function(o,c){
 let h=_card58(o,c);
 if(!o||o.status!=='Выполнено'||left(o)>0.004||!o.closingReceived)return h;
 h=h.replace(/<div class=ocStp>[\s\S]*?<\/div>\s*<div class=ocStl>[\s\S]*?<\/div>/,'');
 let mg='';if(typeof ecoPlan==='function'){try{const P=ecoPlan(o.id);if(P.total-P.overhead>0&&+o.money>0)mg=` · маржа <b>${num((o.money-P.total)/o.money*100,0)}%</b>`}catch(e){}}
 const line=`<div class=v58closed><span>Договор <b>${isOwner()?rubShort(o.money):'—'}</b>${isOwner()?mg:''}</span><span>сдан ${o.date?esc(fmt(o.date)):'—'}</span></div>`;
 h=h.replace(/<div class=ocNums>[\s\S]*?<\/div><\/div>/,line);
 if(!h.includes('v58closed'))h=h.replace(/<\/article>\s*$/,line+'</article>');
 return h.replace('class="ocard2','class="ocard2 v58arch');
}}

/* ---------- Сегодня ---------- */
if(typeof renderToday==='function'){const _rt58=renderToday;renderToday=function(){
 _rt58();
 const own=isOwner(),body=$('todayBody');if(!body)return;
 body.querySelectorAll('.section').forEach(s=>{const t=s.querySelector('.sectionTitle b')?.textContent?.trim();
  if(t==='Ждём оплату'){const debts=data.filter(o=>o.status==='Выполнено'&&left(o)>0),sum=debts.reduce((a,o)=>a+left(o),0);
   s.outerHTML=debts.length?`<button class="s57row v58link" onclick="bucket='debt';showView('objects')"><span class=s57tx><b>Ждём оплату · ${debts.length} ${plural(debts.length,'объект','объекта','объектов')}</b><span>все долги — в Объектах → Оплата и в Деньгах</span></span><span class=s57v>${rubShort(sum)} →</span></button>`:''}});
 v58head('todayView',()=>openTask(),'Новая задача');
}}

/* ---------- Задачи ---------- */
if(typeof renderTasks==='function'){const _rtk58=renderTasks;renderTasks=function(){
 _rtk58();
 const sw=document.querySelector('#taskList .scopeSwitch');if(sw)sw.classList.add('v58seg');
 const hb=[...document.querySelectorAll('#tasksView .top .head > .btn')].find(b=>/Новая задача/.test(b.textContent));if(hb)hb.classList.add('v58moved');
 v58head('tasksView',()=>openTask(),'Новая задача');
}}

/* ---------- Цех ---------- */
if(typeof renderShop==='function'){const _rs58=renderShop;renderShop=function(){
 _rs58();
 const bar=document.querySelector('#woodBody > .segBar');
 if(bar){bar.classList.add('v58seg');bar.querySelectorAll('button').forEach(b=>{const t=b.textContent.trim(),m=t.match(/·\s*(\d+)\s*$/),n=m?m[1]:'';
  const name=/Моя работа/.test(t)?'Моя':/Металл/.test(t)?'Металл':/Дерево/.test(t)?'Дерево':/Внутрицех/.test(t)?'Работы':/План/.test(t)?'План':t.replace(/·.*$/,'');
  b.innerHTML=esc(name)+(n?`<i>${n}</i>`:'')})}
 v58bodyPlus('woodView','woodBody','Добавить в цех');
 const sm=document.querySelector('#woodView .top > .summary:not(.v58cnt)');if(sm)sm.classList.add('v58moved');
}}

/* ---------- Снабжение ---------- */
if(typeof renderSupply==='function'){const _rsu58=renderSupply;renderSupply=function(){
 _rsu58();
 v58bodyPlus('supplyView','supplyBody','Снабжение');
 const sm=document.querySelector('#supplyView .top > .summary:not(.v58cnt)');if(sm)sm.classList.add('v58moved');
 try{const gs=supplyGroups(),nO=gs.filter(x=>x.order>0).length,nD=gs.filter(x=>x.ordered>0).length;v58count('supplyView',`${nO} к заказу · ${nD} в пути`)}catch(e){}
}}

/* ---------- Деньги ---------- */
if(typeof renderAnalytics==='function'){const _ra58=renderAnalytics;renderAnalytics=function(){
 _ra58();
 const body=$('analyticsBody');if(!body)return;
 const m=body.querySelector('.metrics');
 if(m&&moneySeg!=='overhead'){const total=data.reduce((s,o)=>s+(+o.money||0),0),got=data.reduce((s,o)=>s+received(o),0),owed=data.filter(o=>o.status==='Выполнено').reduce((s,o)=>s+left(o),0),rest=data.filter(o=>o.status!=='Выполнено').reduce((s,o)=>s+left(o),0);
  m.outerHTML=`<div class="s57strip v58s4"><div><b>${rubShort(total)}</b><span>договоры</span></div><div><b>${rubShort(got)}</b><span>получено</span></div><div><b class=neg>${rubShort(owed)}</b><span>должны</span></div><div><b>${rubShort(rest)}</b><span>в работе</span></div></div>`}
 body.querySelectorAll('.debtrow').forEach(r=>{const id=(r.getAttribute('onclick')||'').match(/detail\('([^']+)'\)/)?.[1],o=id&&data.find(x=>x.id===id),sp=r.querySelector('div > span');if(o&&sp)sp.textContent=`получено ${rubShort(received(o))} из ${rubShort(o.money)}`});
 const tip=body.querySelector('.chartTip');if(tip&&/Нажмите на месяц/.test(tip.textContent))tip.classList.add('v58moved');
 const acts=v58collect('analyticsBody');
 v58head('analyticsView',moneySeg==='salary'&&isOwner()?()=>openWorker57():acts.length?()=>v58menu('Добавить',acts):null,moneySeg==='salary'?'Новый сотрудник':'Добавить');
}}
if(typeof renderSalary==='function'){const _rsa58=renderSalary;renderSalary=function(){_rsa58();v58head('analyticsView',()=>openWorker57(),'Новый сотрудник')}}

/* ---------- справочники: настройки снабжения ---------- */
if(typeof openRefs==='function'){const _or58=openRefs;openRefs=function(){_or58();if(!isOwner()||typeof setMergeTol!=='function')return;const l=[...$('sheet').querySelectorAll('.s57list')].pop();
 if(l)l.insertAdjacentHTML('beforeend',`<button class=s57row onclick="closeModal();setMergeTol()"><span class=s57ic>${ic('tree',18)}</span><span class=s57tx><b>Допуск бруса</b><span>объединять сечения в снабжении: ±${num(mergeTol())} мм</span></span><span class=s57chev>›</span></button>`)}}
