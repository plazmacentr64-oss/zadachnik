'use strict';
const $=id=>document.getElementById(id), LS_OBJ='crm01',LS_TASK='crm09tasks';
const SUPABASE_URL='https://qlyqgltoumxixteerqak.supabase.co';
const SUPABASE_KEY='sb_publishable_qF4gxUFPHxpMr_lA5VOHCQ_BDExMuBp';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let wood=[],woodAvailable=false,woodFilter="";
let currentUser=null,currentWorkspace=null,members=[],serverReady=false,realtimeChannel=null;
const legacyProjectMap=new Map();
let projectChanges=new Map(); // история изменений по проектам

const localISO=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseDate=s=>new Date((s||localISO())+'T12:00:00');
const days=s=>Math.round((parseDate(s)-parseDate(localISO()))/86400000);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isOwner=()=>members.find(m=>m.user_id===currentUser?.id)?.role==='owner';
let companyInfo={};
function toast(msg,undo){let el=$('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.append(el)}clearTimeout(el._t);el.innerHTML=`<span>${esc(msg)}</span>${undo?'<button type=button>Отменить</button>':''}`;if(undo)el.querySelector('button').onclick=()=>{el.classList.remove('on');undo()};el.classList.add('on');el._t=setTimeout(()=>el.classList.remove('on'),undo?6000:3000)}
function failSave(e){serverError(e);toast('Не удалось сохранить: '+(e?.message||e));loadServer().catch(()=>{})}
const rub=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(+n||0)+' ₽';
const fmt=s=>s?parseDate(s).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'—';
const moneyVal=s=>+String(s||'').replace(/\D/g,'')||0, moneyText=n=>String(+n||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const STATUSES=['Подписание договора','В производстве','В работе','Выполнено'];
let data=[],tasks=[];try{localStorage.removeItem(LS_OBJ);localStorage.removeItem(LS_TASK)}catch(e){}



let bucket='active',analyticsSpan=6,analyticsSelected=null;
const persist=()=>{};
const memberName=id=>members.find(m=>m.user_id===id)?.display_name||members.find(m=>m.user_id===id)?.email||'';
const dbProject=o=>({workspace_id:currentWorkspace,name:o.name,amount:+o.money||0,start_date:o.startDate||null,due_date:o.date||null,items:o.items||'',contractor:o.contractor||'',status:o.status,progress:+o.progress||0,closing_received:!!o.closingReceived,responsible_id:o.responsibleId||null,updated_by:currentUser?.id||null});
const dbTask=t=>({workspace_id:currentWorkspace,project_id:t.projectId||null,title:t.title,due_date:t.date||null,responsible_id:t.responsibleId||null,done:!!t.done,completed_at:t.completedAt||null,updated_by:currentUser?.id||null});
async function serverProjectUpsert(o,isNew=false){if(!serverReady)throw new Error('Нет связи с сервером');let payload=dbProject(o);if(isNew){payload.created_by=currentUser.id;let {data:r,error}=await sb.from('projects').insert(payload).select().single();if(error){serverError(error);throw error}o.id=r.id}else{let {error}=await sb.from('projects').update(payload).eq('id',o.id);if(error){serverError(error);throw error}}}
async function serverTaskUpsert(t,isNew=false){if(!serverReady)throw new Error('Нет связи с сервером');let payload=dbTask(t);if(isNew){payload.created_by=currentUser.id;let {data:r,error}=await sb.from('tasks').insert(payload).select().single();if(error){serverError(error);throw error}t.id=r.id}else{let {error}=await sb.from('tasks').update(payload).eq('id',t.id);if(error){serverError(error);throw error}}}
function serverError(e){console.error(e);$('syncDot').textContent='ОШИБКА';$('syncDot').classList.add('off')}
async function ensureWorkspace(){
 let {data:mine,error}=await sb.from('members').select('workspace_id,role,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:true});
 if(error)throw error;
 if(mine?.length){let last='';try{last=localStorage.getItem('crmWs:'+currentUser.id)||''}catch(e){}let pick=mine.find(m=>m.workspace_id===last)||[...mine].reverse().find(m=>m.role==='employee')||mine[0];currentWorkspace=pick.workspace_id;return}
 let name=(currentUser.user_metadata?.display_name||currentUser.email?.split('@')[0]||'Моя фирма')+' — CRM';
 let {data:w,error:we}=await sb.from('workspaces').insert({name,created_by:currentUser.id}).select().single();if(we)throw we;
 /* Bootstrap owner membership through RPC added by setup patch. */
 let {error:be}=await sb.rpc('bootstrap_workspace_owner',{wid:w.id,display_name:currentUser.user_metadata?.display_name||currentUser.email||'Владелец'});if(be)throw be;
 currentWorkspace=w.id;
}
let loadSeq=0,reloadTimer=null;
function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>loadServer().catch(serverError),400)}
async function loadServer(){
 const seq=++loadSeq;
 let [{data:ps,error:pe},{data:ts,error:te},{data:ms,error:me},{data:pays,error:paye},{data:ws,error:we},{error:wse},{data:wsRow},{data:expenses,error:expErr},{data:changes,error:chgErr}]=await Promise.all([
  sb.from('projects').select('*').eq('workspace_id',currentWorkspace).order('created_at',{ascending:false}),
  sb.from('tasks').select('*').eq('workspace_id',currentWorkspace).order('created_at',{ascending:false}),
  sb.from('members').select('*').eq('workspace_id',currentWorkspace),
  sb.from('payments').select('*').eq('workspace_id',currentWorkspace),
  sb.from('wood_items').select('*').eq('workspace_id',currentWorkspace).order('created_at',{ascending:false}),
  sb.from('wood_items').select('in_stock,ready').eq('workspace_id',currentWorkspace).limit(1),
  sb.from('workspaces').select('id,name,company').eq('id',currentWorkspace).maybeSingle(),
  sb.from('expenses').select('*').eq('workspace_id',currentWorkspace).order('created_at',{ascending:false}),
  sb.from('project_changes').select('*').eq('workspace_id',currentWorkspace).order('changed_at',{ascending:false})
 ]);
 if(seq!==loadSeq)return;
 if(pe||te||me||paye||expErr||chgErr)throw(pe||te||me||paye||expErr||chgErr);companyInfo=wsRow?.company||{};try{localStorage.setItem('crmWs:'+currentUser.id,currentWorkspace)}catch(e){}woodAvailable=!we;woodStatusAvailable=!wse;woodLocalMode=!!we&&['42P01','PGRST205'].includes(we.code);woodLoadError=we&&!woodLocalMode?(we.message||'Ошибка загрузки'):'';
 woodFlagsAvailable=(ps||[]).some(o=>Object.hasOwn(o,'needs_wood'));
 let drafts=readWoodDrafts();let remote=(ws||[]).map(w=>({id:w.id,projectId:w.project_id,name:w.name,thickness:+w.thickness_mm,width:+w.width_mm,length:+w.length_mm,quantity:+w.quantity,note:w.note||'',inStock:!!w.in_stock,ready:!!w.ready}));
 wood=[...remote.filter(w=>!drafts.rows.some(d=>d.id===w.id)),...drafts.rows.map(w=>({...w,local:true}))].map(withWoodStatus);
 members=ms||[];
 let byProject={};(pays||[]).forEach(p=>(byProject[p.project_id]??=[]).push({id:p.id,amount:+p.amount,date:p.paid_on,note:p.note||'',status:'Получен'}));
 let byExpense={};(expenses||[]).forEach(e=>(byExpense[e.project_id]??=[]).push({id:e.id,amount:+e.amount,category:e.category,supplier:e.supplier,date:e.paid_on,note:e.note||'',created_at:e.created_at}));
 let byChanges={};(changes||[]).forEach(c=>{if(!byChanges[c.project_id])byChanges[c.project_id]=[];byChanges[c.project_id].push({id:c.id,field:c.field,old_value:c.old_value,new_value:c.new_value,changed_by:c.changed_by,changed_at:c.changed_at})});
 projectChanges=byChanges;
 data=(ps||[]).map(o=>({id:o.id,name:o.name,needsWood:Object.hasOwn(drafts.flags,o.id)?!!drafts.flags[o.id]:(typeof o.needs_wood==='boolean'?o.needs_wood:wood.some(w=>w.projectId===o.id)),money:+o.amount||0,advance:0,startDate:o.start_date||'',date:o.due_date||'',items:o.items||'',contractor:o.contractor||'',status:o.status,progress:o.status==='Выполнено'?100:(+o.progress||0),closingReceived:!!o.closing_received,responsibleId:o.responsible_id||null,payments:byProject[o.id]||[],expenses:byExpense[o.id]||[],totalExpenses:(byExpense[o.id]||[]).reduce((s,e)=>s+e.amount,0)}));
 tasks=(ts||[]).map(t=>({id:t.id,title:t.title,projectId:t.project_id||null,date:t.due_date||'',createdAt:(t.created_at||'').slice(0,10),done:!!t.done,completedAt:t.completed_at||'',responsibleId:t.responsible_id||null}));
 serverReady=true;$('syncDot').textContent='СИНХР.';$('syncDot').classList.remove('off');render();
}
function subscribeRealtime(){
 if(realtimeChannel)sb.removeChannel(realtimeChannel);
 realtimeChannel=sb.channel('crm-team-'+currentWorkspace)
  .on('postgres_changes',{event:'*',schema:'public',table:'projects',filter:`workspace_id=eq.${currentWorkspace}`},()=>scheduleReload())
  .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`workspace_id=eq.${currentWorkspace}`},()=>scheduleReload())
  .on('postgres_changes',{event:'*',schema:'public',table:'payments',filter:`workspace_id=eq.${currentWorkspace}`},()=>scheduleReload()).on('postgres_changes',{event:'*',schema:'public',table:'wood_items',filter:`workspace_id=eq.${currentWorkspace}`},()=>scheduleReload()).subscribe();
}
let teamStartedFor=null;
async function startTeam(session){
 const u=session?.user||null;
 if(u&&teamStartedFor===u.id){currentUser=u;return}
 currentUser=u;
 if(!currentUser){teamStartedFor=null;data=[];tasks=[];members=[];companyInfo={};if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null}renderCurrent();wood=[];woodAvailable=false;woodFlagsAvailable=false;woodStatusAvailable=false;woodFilter='';currentWorkspace=null;serverReady=false;$('authGate').classList.add('on');$('signOutBtn').style.display='none';$('teamBtn').style.display='none';return}
 teamStartedFor=currentUser.id;
 $('authGate').classList.remove('on');$('signOutBtn').style.display='inline-block';$('teamBtn').style.display='inline-block';$('teamUser').textContent=currentUser.email||'Пользователь';
 try{await ensureWorkspace();await loadServer();subscribeRealtime()}catch(e){teamStartedFor=null;serverError(e);toast('Ошибка загрузки: '+(e.message||e))}
}

const received=o=>(+o.advance||0)+(o.payments||[]).filter(p=>!p.status||p.status==='Получен').reduce((sum,p)=>sum+(+p.amount||0),0), left=o=>Math.max(0,(+o.money||0)-received(o));
// Фактическая маржа = доход − расходы
const actualMargin=o=>received(o)-(o.totalExpenses||0);
function bucketOf(o){return o.status!=='Выполнено'?'active':left(o)>0?'debt':'archive'}
function health(o){if(o.status==='Выполнено')return {cls:'green',text:'Работы выполнены',level:1};if(o.status!=='В работе')return {cls:'',text:'Договор на подписании',level:0};if(!o.startDate)return {cls:'',text:'Укажите дату начала',level:0};let st=parseDate(o.startDate),en=parseDate(o.date),now=parseDate(localISO());if(!(en>st))return {cls:'red',text:'Проверьте даты',level:3};if(now>en)return {cls:'red',text:`Срок прошёл · готовность ${o.progress}%`,level:3};if(now<st)return {cls:'green',text:'Старт впереди',level:1};let elapsed=Math.max(0,Math.min(100,(now-st)/(en-st)*100)),gap=elapsed-(+o.progress||0);return gap<=10?{cls:'green',text:gap<=0?'С опережением':'По плану',level:1}:gap<=25?{cls:'orange',text:`Есть отставание · план ≈ ${Math.round(elapsed)}%`,level:2}:{cls:'red',text:`Риск срока · план ≈ ${Math.round(elapsed)}%`,level:3}}
function priority(o){let h=health(o),d=days(o.date);return h.level*100+(d<0?50:d<=7?25:0)}
function sortedObjects(a){return [...a].sort((x,y)=>priority(y)-priority(x)||days(x.date)-days(y.date))}
function dayText(s){let n=days(s);return n<0?`Просрочено ${Math.abs(n)} дн.`:n===0?'Срок сегодня':n===1?'Остался 1 день':`Осталось ${n} дн.`}
function card(o){let h=health(o),active=tasks.filter(t=>!t.done&&t.projectId===o.id);return `<article class="card ${h.cls}" onclick="detail(\'${o.id}\')">${active.length?`<div class=taskbadge>${active.length}</div>`:''}<div class=customerTitle>${esc(o.name)}</div><div class=customerLabel>👤 ${esc(o.contractor||'Заказчик не указан')}</div><div class=date>📅 ${fmt(o.date)} · ${dayText(o.date)}</div>${o.items?.trim()?`<div class=items>${esc(o.items)}</div>`:''}<div class=money>${rub(o.money)}</div><div class=small>${o.status==='Выполнено'?(left(o)>0?'Должны нам: <b>'+rub(left(o))+'</b>':'<b>Оплачено полностью</b>'):'Остаток: <b>'+rub(left(o))+'</b>'}</div><div class=badges><span class="badge ${h.cls}">${h.text}</span></div><div class=quick onclick="event.stopPropagation()"><select onchange="quickStatus(\'${o.id}\',this.value)">${STATUSES.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></div><div class=cardTools onclick="event.stopPropagation()">${o.status!=='Выполнено'?`<div class=progress><div class=progressControl id="prog${o.id}"><button type=button class=progressButton onclick="toggleProgressMenu(\'${o.id}\')"><span>Готовность</span><b>${+o.progress||0}%</b></button><div class=progressMenu>${[0,20,40,60,80,100].map(v=>`<button type=button class="progressChoice ${+o.progress===v?'on':''}" onclick="chooseProgress(\'${o.id}\',${v})">${v}%</button>`).join('')}</div></div></div>`:''}${o.status==='Выполнено'?`<button type=button class="docMini ${o.closingReceived?'ok':'need'}" onclick="quickClosing(\'${o.id}\',${!o.closingReceived})">${o.closingReceived?'Документы ✓':'Нет документов'}</button>`:''}</div></article>`}
function renderObjects(){
 let q=($('objectSearch')?.value||'').toLowerCase();
 let arr=sortedObjects(data.filter(o=>bucket==='docs'?(o.status==='Выполнено'&&!o.closingReceived):bucketOf(o)===bucket));
 if(q)arr=arr.filter(o=>o.name.toLowerCase().includes(q)||(o.contractor||'').toLowerCase().includes(q)||(o.items||'').toLowerCase().includes(q));
 let work=data.filter(o=>o.status==='В работе'),workSum=work.reduce((s,o)=>s+(+o.money||0),0),debts=data.filter(o=>o.status==='Выполнено'&&left(o)>0),debtSum=debts.reduce((s,o)=>s+left(o),0),arch=data.filter(o=>bucketOf(o)==='archive'),archSum=arch.reduce((s,o)=>s+(+o.money||0),0),summary='';if(bucket==='active')summary=`<div class=summaryStats><div class="sumPill accent"><span>Активные</span><b>${arr.length}</b><small>в работе ${work.length} · подписание ${arr.length-work.length}</small></div><div class=sumPill><span>Сумма договоров</span><b>${rub(arr.reduce((s,o)=>s+(+o.money||0),0))}</b><small>по активным</small></div></div>`;else if(bucket==='debt')summary=`<div class=summaryStats><div class="sumPill warn"><span>Ожидают оплаты</span><b>${debts.length}</b><small>объектов</small></div><div class=sumPill><span>К получению</span><b>${rub(debtSum)}</b><small>остаток оплаты</small></div></div>`;else if(bucket==='docs')summary=`<div class=summaryStats style="grid-template-columns:1fr"><div class="sumPill warn"><span>Нужны документы</span><b>${arr.length}</b><small>объектов без закрывающих документов</small></div></div>`;else summary=`<div class=summaryStats><div class=sumPill><span>В архиве</span><b>${arch.length}</b><small>объектов</small></div><div class=sumPill><span>Сумма договоров</span><b>${rub(archSum)}</b><small>закрытые объекты</small></div></div>`;$('summary').innerHTML=summary;$('grid').innerHTML=arr.map(card).join('')||'<div class=empty>Здесь пока пусто</div>'}
async function quickStatus(id,v,silent){let o=data.find(x=>x.id===id);if(!o)return;let prev={status:o.status,progress:o.progress,startDate:o.startDate};o.status=v;if(v==='В работе'&&!o.startDate)o.startDate=localISO();if(v==='Выполнено')o.progress=100;render();try{await serverProjectUpsert(o);if(!silent)toast(`«${o.name}» → ${v}`,async()=>{Object.assign(o,prev);render();try{await serverProjectUpsert(o)}catch(e){failSave(e)}})}catch(e){Object.assign(o,prev);render();failSave(e)}}
function previewProgress(id,v){let o=data.find(x=>x.id===id);if(!o)return;o.progress=+v;let el=$('pct'+id);if(el)el.textContent=v+'%'}
function toggleProgressMenu(id){document.querySelectorAll('.progressControl.open').forEach(x=>{if(x.id!=='prog'+id)x.classList.remove('open')});let el=$('prog'+id);if(el)el.classList.toggle('open')}
async function chooseProgress(id,v){let el=$('prog'+id);if(el)el.classList.remove('open');await saveProgress(id,v)}
async function saveProgress(id,v){let o=data.find(x=>x.id===id);if(!o)return;let old=o.progress;o.progress=+v;render();try{await serverProjectUpsert(o)}catch(e){o.progress=old;render();failSave(e)}}
async function quickClosing(id,checked){let o=data.find(x=>x.id===id);if(!o||o.status!=='Выполнено')return;let old=o.closingReceived;o.closingReceived=!!checked;render();try{await serverProjectUpsert(o)}catch(e){o.closingReceived=old;render();failSave(e)}}
const taskKey=t=>t.date?days(t.date):1e6;
function taskHeat(t){if(t.done)return {cls:'',text:'Выполнено'};if(!t.date)return {cls:'',text:'Без срока'};let n=days(t.date);if(n<0)return {cls:'red',text:`Просрочено ${Math.abs(n)} дн.`};if(n===0)return {cls:'red',text:'Сделать сегодня'};let total=Math.max(1,days(t.date)-days(t.createdAt)),spent=Math.max(0,Math.min(1,1-n/total));return {cls:spent>.75?'orange':'',text:n===1?'Завтра':`Через ${n} дн.`}}
function taskCard(t){let p=data.find(o=>o.id===t.projectId),h=taskHeat(t);return `<div class="task ${h.cls} ${t.done?'done':''}"><div class=taskTop><input class=check type=checkbox ${t.done?'checked':''} onchange="toggleTask(\'${t.id}\')" aria-label="Выполнено"><div class=taskMain><div class=ftitle>${esc(t.title)}</div><div class=fmeta>${p?esc(p.name):'Личная задача'}${t.date?' · '+fmt(t.date):''}</div><div class=tasktime>${h.text}</div>${t.responsibleId?`<div class=assignee>Ответственный: ${esc(memberName(t.responsibleId))}</div>`:''}${isOwner()?`<button class=taskDel onclick="deleteTask('${t.id}')">Удалить</button>`:''}</div></div></div>`}
function renderTasks(){let open=tasks.filter(t=>!t.done).sort((a,b)=>taskKey(a)-taskKey(b)),done=tasks.filter(t=>t.done).sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||''));$('tasksSummary').textContent=`${open.length} активных · ${done.length} выполнено`;$('taskList').innerHTML=`${open.map(taskCard).join('')||'<div class=empty>Активных задач нет</div>'}<details class=section><summary class=sectionTitle><b>Выполненные</b><span>${done.length}</span></summary>${done.map(taskCard).join('')}</details>`}
function renderToday(){let open=tasks.filter(t=>!t.done).sort((a,b)=>taskKey(a)-taskKey(b)),urgent=open.filter(t=>t.date&&days(t.date)<=0),soon=open.filter(t=>t.date&&days(t.date)<=7),later=open.length-soon.length,risks=sortedObjects(data.filter(o=>o.status==='В работе'&&['red','orange'].includes(health(o).cls))),debts=data.filter(o=>o.status==='Выполнено'&&left(o)>0).sort((a,b)=>left(b)-left(a));$('todaySummary').textContent=`${open.length} активных задач · ${risks.length} проблемных объектов · ${debts.length} ждём оплату`;$('todayBody').innerHTML=`<div class=hero><strong>${urgent.length?urgent.length+' требуют решения':'Сегодня спокойно'}</strong><span>Сначала срочное, но будущие задачи не исчезают</span></div><div class=section><div class=sectionTitle><b>Задачи на неделю</b><span>${soon.length}</span></div>${soon.map(t=>`<div class="focus ${taskHeat(t).cls}"><div class=frow><div><div class=ftitle>${esc(t.title)}</div><div class=fmeta>${esc(data.find(o=>o.id===t.projectId)?.name||'Личная задача')} · ${taskHeat(t).text}</div></div><button class=doneBtn aria-label="Отметить выполненной" onclick="completeToday(\'${t.id}\')">✓</button></div></div>`).join('')||'<div class=empty>На неделю задач нет</div>'}${later?`<div class=small style="margin-top:6px" onclick="showView('tasks')">Ещё ${later} — позже или без срока · <u>все задачи</u></div>`:''}</div><div class=section><div class=sectionTitle><b>Проблемные объекты</b><span>${risks.length}</span></div>${risks.map(o=>`<div class="focus ${health(o).cls}" onclick="detail(\'${o.id}\')"><div class=ftitle>${esc(o.name)}</div><div class=fmeta>${health(o).text} · ${dayText(o.date)}</div></div>`).join('')||'<div class=empty>Всё по плану</div>'}</div><div class=section><div class=sectionTitle><b>Ждём оплату</b><span>${rub(debts.reduce((s,o)=>s+left(o),0))}</span></div>${debts.map(o=>`<div class=debtrow onclick="detail(\'${o.id}\')"><div><b>${esc(o.name)}</b><br><span>Работы выполнены</span></div><strong>${rub(left(o))}</strong></div>`).join('')||'<div class=empty>Нет задолженностей по выполненным объектам</div>'}</div>`}
function renderAnalytics(){let total=data.reduce((s,o)=>s+(+o.money||0),0),got=data.reduce((s,o)=>s+received(o),0),owed=data.filter(o=>o.status==='Выполнено').reduce((s,o)=>s+left(o),0),rest=data.filter(o=>o.status!=='Выполнено').reduce((s,o)=>s+left(o),0),debtObjs=data.filter(o=>o.status==='Выполнено'&&left(o)>0).sort((a,b)=>left(b)-left(a)),now=new Date(),end=now.getFullYear()*12+now.getMonth(),rows=[];for(let k=end-analyticsSpan+1;k<=end;k++){let y=Math.floor(k/12),m=((k%12)+12)%12,key=y+'-'+String(m+1).padStart(2,'0'),os=data.filter(o=>o.date?.slice(0,7)===key);rows.push({y,m,label:new Date(y,m,1).toLocaleDateString('ru-RU',{month:'short'}).replace('.',''),volume:os.reduce((s,o)=>s+(+o.money||0),0),got:os.reduce((s,o)=>s+received(o),0),debt:os.reduce((s,o)=>s+left(o),0),objects:os})}
let W=600,H=220,L=18,R=18,T=18,B=28,max=Math.max(1,...rows.flatMap(r=>[r.volume,r.got])),x=i=>rows.length===1?W/2:L+(W-L-R)*i/(rows.length-1),y=v=>T+(H-T-B)*(1-v/max),curve=key=>rows.map((r,i)=>`${i?'L':'M'}${x(i)} ${y(r[key])}`).join(' '),zones=rows.map((r,i)=>{let l=i?(x(i-1)+x(i))/2:0,rr=i<rows.length-1?(x(i)+x(i+1))/2:W;return `<rect data-i="${i}" x="${l}" y="0" width="${rr-l}" height="${H}" fill="transparent"/>`}).join(''),marks=rows.map((r,i)=>`${analyticsSelected===i?`<line x1="${x(i)}" y1="${T}" x2="${x(i)}" y2="${H-B}" stroke="#9fb5aa"/><circle cx="${x(i)}" cy="${y(r.volume)}" r="8" fill="#fff" stroke="#5e665f" stroke-width="3"/>`:''}<text x="${x(i)}" y="${H-7}" text-anchor="middle" font-size="10" fill="#718078">${r.label}</text>`).join(''),s=analyticsSelected==null?null:rows[analyticsSelected];
$('analyticsBody').innerHTML=`<div class=metrics><div class=metric><span>Объём</span><strong>${rub(total)}</strong></div><div class=metric><span>Получено</span><strong>${rub(got)}</strong></div><div class=metric><span>Должны за выполненное</span><strong>${rub(owed)}</strong></div><div class=metric><span>Остаток по договорам в работе</span><strong>${rub(rest)}</strong></div></div><div class=chartbox><div class=chartHead><b>Финансовая картина</b><select id=spanSel><option value=3>3 месяца</option><option value=6>Полгода</option><option value=12>Год</option></select></div><div class=legend>Тёмная — объём договоров по сроку сдачи · зелёная — получено по этим объектам</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${curve('volume')}" fill="none" stroke="#5e665f" stroke-width="3" vector-effect="non-scaling-stroke"/><path d="${curve('got')}" fill="none" stroke="#63b78b" stroke-width="3" vector-effect="non-scaling-stroke"/>${marks}${zones}</svg><div class=chartTip>${s?`<b>${s.label} ${s.y}</b><br>Объём ${rub(s.volume)} · получено ${rub(s.got)} · остаток ${rub(s.debt)} · объектов ${s.objects.length}`:'Нажмите на месяц — активна вся широкая зона, а не маленькая точка.'}</div></div><div class=sectionTitle><b>Кто должен за выполненное</b><span>${rub(owed)}</span></div>${debtObjs.map(o=>`<div class=debtrow onclick="detail(\'${o.id}\')"><div><b>${esc(o.name)}</b><br><span>Получено ${rub(received(o))} из ${rub(o.money)}</span></div><strong>${rub(left(o))}</strong></div>`).join('')||'<div class=empty>Все расчёты закрыты</div>'}`;
$('spanSel').value=analyticsSpan;$('spanSel').onchange=e=>{analyticsSpan=+e.target.value;analyticsSelected=null;renderAnalytics()};$('analyticsBody').querySelectorAll('rect[data-i]').forEach(el=>el.onpointerdown=()=>{analyticsSelected=+el.dataset.i;renderAnalytics()})}
function renderCurrent(){let on=document.querySelector('.view.on')?.id||'objectsView';if(on==='objectsView')renderObjects();else if(on==='tasksView')renderTasks();else if(on==='todayView')renderToday();else if(on==='analyticsView')renderAnalytics();else if(on==='woodView')renderWood()}
function render(){renderCurrent();persist()}
function showView(v){document.querySelectorAll('.view,.tab').forEach(e=>e.classList.remove('on'));$(v+'View').classList.add('on');document.querySelector(`.tab[data-v="${v}"]`).classList.add('on');renderCurrent()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.v));document.querySelectorAll('.filters .chip').forEach(b=>b.onclick=()=>{bucket=b.dataset.b;document.querySelectorAll('.filters .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderObjects()});
function closeModal(){$('modal').classList.remove('on')}$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()}

const COMPANY_FIELDS=[['name','Название фирмы','ООО «Ромашка» или ИП Иванов И.И.'],['inn','ИНН','6450000000'],['kpp','КПП','645001001'],['ogrn','ОГРН / ОГРНИП',''],['address','Юридический адрес','г. Саратов, ул. …'],['city','Город в документах','Саратов'],['director','Подписант (ФИО, должность)','Директор Иванов И.И.'],['phone','Телефон','+7 …'],['email','E-mail',''],['bank','Банк','ПАО Сбербанк'],['bik','БИК',''],['account','Расчётный счёт',''],['corr','Корр. счёт',''],['tax','Налоги','']];
async function openTeam(){
 let me=members.find(m=>m.user_id===currentUser?.id),owner=me?.role==='owner';
 $('sheet').innerHTML=`<button class=close onclick=closeModal()>×</button><h2>Команда</h2>
 <div class=info><div class=label>Участники · ${members.length}</div>${members.map(m=>`<div class=doc><span><b>${esc(m.display_name||m.email||'Сотрудник')}</b><br><span class=small>${esc(m.email||'')} · ${m.role==='owner'?'Владелец':'Сотрудник'}</span></span></div>`).join('')}</div>
 ${owner?`<div class=info><div class=label>Пригласить сотрудника</div><div class=small>Создай код и отправь его сотруднику. Код действует 7 дней.</div><button class=btn style="width:100%;margin-top:10px" id=makeInvite>Создать код приглашения</button><div id=inviteResult></div></div><details class=info id=companyBox><summary class=label style="cursor:pointer">Реквизиты фирмы для документов ${companyInfo.name?'✓':'— не заполнены'}</summary>${COMPANY_FIELDS.map(([k,l,ph])=>k==='tax'?`<label class=field>${l}<select id="co_${k}">${['УСН (без НДС)','НДС 20%','НДС 5%','НДС 7%'].map(v=>`<option ${companyInfo.tax===v?'selected':''}>${v}</option>`).join('')}</select></label>`:`<label class=field>${l}<input id="co_${k}" value="${esc(companyInfo[k]||'')}" placeholder="${esc(ph)}"></label>`).join('')}<button class=btn style="width:100%" id=saveCompany>Сохранить реквизиты</button></details>`:''}
 <div class=info><div class=label>Войти в команду по коду</div><label class=field>Код приглашения<input id=joinCode placeholder="Например: A1B2C3D4" autocapitalize=characters></label><button class=btn style="width:100%" id=joinInvite>Присоединиться</button><div id=joinResult class=small style="margin-top:8px"></div></div>`;
 $('modal').classList.add('on');
 if(owner)$('saveCompany').onclick=async()=>{let b=$('saveCompany');if(b.disabled)return;let c={};COMPANY_FIELDS.forEach(([k])=>c[k]=$('co_'+k).value.trim());b.disabled=true;b.textContent='Сохраняю…';let {error}=await sb.from('workspaces').update({company:c}).eq('id',currentWorkspace);b.disabled=false;b.textContent='Сохранить реквизиты';if(error){serverError(error);return alert('Не удалось сохранить: '+error.message)}companyInfo=c;toast('Реквизиты сохранены')};
 if(owner)$('makeInvite').onclick=async()=>{let b=$('makeInvite');b.disabled=true;b.textContent='Создаю…';let {data:code,error}=await sb.rpc('create_workspace_invite',{wid:currentWorkspace});if(error){b.disabled=false;b.textContent='Создать код приглашения';return $('inviteResult').innerHTML=`<div class=autherr>${esc(error.message)}</div>`}$('inviteResult').innerHTML=`<div class=hero><span>Код приглашения</span><strong style="letter-spacing:3px">${esc(code)}</strong><span>Отправь этот код сотруднику</span></div>`;b.textContent='Создать новый код';b.disabled=false};
 $('joinInvite').onclick=async()=>{let code=$('joinCode').value.trim().toUpperCase();if(!code)return;let b=$('joinInvite');b.disabled=true;b.textContent='Подключаю…';let {data:wid,error}=await sb.rpc('accept_workspace_invite',{invite_code:code,display_name:currentUser.user_metadata?.display_name||currentUser.email||'Сотрудник'});if(error){b.disabled=false;b.textContent='Присоединиться';return $('joinResult').textContent='Ошибка: '+error.message}currentWorkspace=wid;closeModal();await loadServer();subscribeRealtime();$('teamUser').textContent=(currentUser.email||'Пользователь')+' · команда';};
}

function openProject(){let o={id:null,name:'',money:0,startDate:localISO(),date:'',items:'',contractor:'',status:'Подписание договора',progress:0,closingReceived:false,responsibleId:currentUser?.id||null};$('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Новый объект</h2><label class=field>Название *<input id=pn placeholder="Например: Астраханская — этап 2"></label><label class=field>Заказчик<input id=pc placeholder="Например: Администрация Волжского района"></label><div class=row2><label class=field>Сумма договора, ₽ *<input id=pm inputmode=numeric></label><label class=field>Аванс уже получен, ₽<input id=pa inputmode=numeric placeholder="0"></label></div><div class=row2><label class=field>Дата начала<input id=psd type=date value="${localISO()}"></label><label class=field>Дата сдачи *<input id=pdd type=date></label></div><label class=field>Предмет договора<textarea id=pi placeholder="Например: лавочки 80 · урны 80 · велопарковки 6"></textarea></label><div class=row2><label class=field>Статус<select id=pst>${STATUSES.slice(0,2).map(s=>`<option>${s}</option>`).join('')}</select></label><label class=field>Ответственный<select id=presp><option value="">Не назначен</option>${members.map(m=>`<option value="${esc(m.user_id)}" ${m.user_id===o.responsibleId?'selected':''}>${esc(m.display_name||m.email||'Сотрудник')}</option>`).join('')}</select></label></div><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=saveP>Сохранить</button></div>`;$('modal').classList.add('on');setTimeout(()=>$('pn')?.focus(),50);['pm','pa'].forEach(k=>$(k).oninput=e=>{e.target.value=moneyText(moneyVal(e.target.value))});$('saveP').onclick=async()=>{let b=$('saveP');if(b.disabled)return;if(!$('pn').value.trim()||!moneyVal($('pm').value)||!$('pdd').value)return alert('Заполните название, сумму и дату сдачи');o.name=$('pn').value.trim();o.money=moneyVal($('pm').value);o.startDate=$('psd').value||localISO();o.date=$('pdd').value;o.items=$('pi').value;o.contractor=$('pc').value.trim();o.responsibleId=$('presp').value||null;o.status=$('pst').value;let adv=moneyVal($('pa').value);if(adv>o.money&&!confirm('Аванс больше суммы договора. Сохранить как есть?'))return;b.disabled=true;b.textContent='Сохраняю…';try{await serverProjectUpsert(o,true);if(adv>0){let {error}=await sb.from('payments').insert({workspace_id:currentWorkspace,project_id:o.id,amount:adv,paid_on:localISO(),note:'Аванс',created_by:currentUser.id});if(error)throw error}closeModal();await loadServer();toast('Объект «'+o.name+'» добавлен')}catch(e){b.disabled=false;b.textContent='Сохранить';serverError(e);alert('Не удалось сохранить: '+(e.message||e))}}}
let docsDB=new Promise((res,rej)=>{let r=indexedDB.open('crm01docs',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('docs')){let s=r.result.createObjectStore('docs',{keyPath:'key',autoIncrement:true});s.createIndex('projectId','projectId')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function docsFor(id){let db=await docsDB;return new Promise((res,rej)=>{let q=db.transaction('docs').objectStore('docs').index('projectId').getAll(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function addDocs(id,files){let db=await docsDB,tx=db.transaction('docs','readwrite'),s=tx.objectStore('docs');for(let f of files)s.add({projectId:id,name:f.name,size:f.size,type:f.type,blob:f,created:Date.now()});tx.oncomplete=()=>detail(id)}
async function openDoc(k){let db=await docsDB,q=db.transaction('docs').objectStore('docs').get(k);q.onsuccess=()=>{let u=URL.createObjectURL(q.result.blob);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000)}}
async function delDoc(k,id){let db=await docsDB,tx=db.transaction('docs','readwrite');tx.objectStore('docs').delete(k);tx.oncomplete=()=>detail(id)}
async function inlineProjectSave(id,field,value,el){let o=data.find(x=>x.id===id);if(!o)return;let old=o[field];if(field==='money')value=moneyVal(value);if(field==='progress')value=Math.max(0,Math.min(100,+value||0));if(field==='status'&&value==='Выполнено')o.progress=100;o[field]=value;if(el){let st=$('inlineSaveState');if(st)st.textContent='Сохраняю…'}try{await serverProjectUpsert(o,false);if(el){let st=$('inlineSaveState');if(st)st.textContent='Сохранено ✓'}render()}catch(e){o[field]=old;serverError(e);let st=$('inlineSaveState');if(st)st.textContent='Не удалось сохранить'}}
function inlineMoneyBlur(id,el){let v=moneyVal(el.value);el.value=moneyText(v);inlineProjectSave(id,'money',v,el)}
function paymentDate(p){return p.paid_on||p.date||p.created_at?.slice(0,10)||''}
function paymentHistory(o){let ps=[...(o.payments||[])].filter(p=>!p.status||p.status==='Получен').sort((a,b)=>String(paymentDate(b)).localeCompare(String(paymentDate(a))));return ps.length?`<div class=paymentList>${ps.map(p=>`<div class=paymentRow><div><div class=paymentDate>${fmt(paymentDate(p))}${p.note?` · ${esc(p.note)}`:''}</div></div><div class=paymentAmount>${rub(+p.amount||0)}</div>${isOwner()?'':'<!--'}<button class=paymentDel title="Удалить платёж" onclick="deletePayment('${o.id}','${p.id||''}')" aria-label="Удалить платёж">×</button>${isOwner()?'':'-->'}</div>`).join('')}</div>`:'<div class=paymentEmpty>Платежей пока нет</div>'}
async function deletePayment(projectId,paymentId){let o=data.find(x=>x.id===projectId);if(!o)return;if(!paymentId)return alert('Этот старый платёж нельзя удалить отдельно. Добавленные сейчас платежи удаляются крестиком.');let p=(o.payments||[]).find(x=>x.id===paymentId);if(!p)return;if(!confirm('Удалить платёж '+rub(+p.amount||0)+' от '+fmt(paymentDate(p))+'?'))return;if(serverReady){let {data:del,error}=await sb.from('payments').delete().eq('id',paymentId).select('id');if(error){serverError(error);return alert('Не удалось удалить платёж: '+(error.message||error))}if(!del?.length)return alert('Удалять платежи может только владелец');await loadServer()}else{o.payments=o.payments.filter(x=>x.id!==paymentId);persist();render()}detail(projectId)}

// ============================================
// РАСХОДЫ
// ============================================
async function addExpense(projectId,amount,category,paidOn,supplier,note){
 let o=data.find(x=>x.id===projectId);if(!o)return;
 let b=$('paySave');if(b.disabled)return;
 let amt=+amount||0;
 if(amt<=0)return alert('Укажите сумму расхода');
 b.disabled=true;b.textContent='Сохраняю…';
 try{
  let {error}=await sb.rpc('add_expense',{pid:projectId,pamount:amt,pcategory:category||'Материалы',ppaid_on:paidOn||localISO(),psupplier:supplier||'',pnote:note||''});
  if(error)throw error;
  await loadServer();
  toast('Расход '+rub(amt)+' добавлен');
  if($('modal').classList.contains('on'))detail(projectId);
  else render();
 }catch(e){b.disabled=false;b.textContent='Добавить';serverError(e);alert('Не удалось добавить расход: '+(e.message||e))}
}

async function deleteExpense(projectId,expenseId){
 let o=data.find(x=>x.id===projectId);if(!o)return;
 let e=(o.expenses||[]).find(x=>x.id===expenseId);
 if(!e)return;
 if(!confirm('Удалить расход '+rub(+e.amount||0)+' ('+esc(e.category||'')+')?'))return;
 if(serverReady){
  let {data:del,error}=await sb.from('expenses').delete().eq('id',expenseId).select('id');
  if(error){serverError(error);return alert('Не удалось удалить: '+(error.message||error))}
  await loadServer();
 }else{o.expenses=(o.expenses||[]).filter(x=>x.id!==expenseId);persist();render()}
 detail(projectId);
}

function expenseCard(e){
 let c=e.category||'Материалы';
 let catEmoji=c.includes('Работа')?'👷':c.includes('Доставка')?'🚚':c.includes('Инструмент')?'🔧':'📦';
 return `<div class="expense-row ${isOwner()?'':'no-del'}"><span class=expense-cat>${catEmoji} ${esc(c)}</span><span class=expense-amount>${rub(+e.amount||0)}</span>${isOwner()?`<button class=expense-del title="Удалить расход" onclick="deleteExpense('${e.projectId||currentProjectForExpense}','${e.id||''}')" aria-label="Удалить расход">×</button>`:''}</div>`;
}

let currentProjectForExpense='';
async function detail(id){let o=data.find(x=>x.id===id);if(!o)return;let list=tasks.filter(t=>t.projectId===id);let margin=actualMargin(o);let marginClass=margin>=0?'green':'red';let changes=(projectChanges[id]||[]).slice(0,10);$('sheet').innerHTML=`<button class=close onclick=closeModal()>×</button><input class="inlineEdit inlineTitle" value="${esc(o.name)}" aria-label="Название объекта" onchange="inlineProjectSave('${id}','name',this.value.trim()||'Без названия',this)"><div class=tapHint>Любое поле можно изменить прямо здесь — сохраняется сразу</div><div class=info><div class=inlineRow><label class=field>Статус<select class=inlineEdit onchange="quickStatus('${id}',this.value);setTimeout(()=>detail('${id}'),300)">${STATUSES.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></label>${o.status!=='Выполнено'?`<label class=field>Готовность<select class=inlineEdit onchange="saveProgress('${id}',this.value)">${[0,20,40,60,80,100].map(v=>`<option value=${v} ${+o.progress===v?'selected':''}>${v}%</option>`).join('')}</select></label>`:''}</div></div><div class=info><div class=inlineRow><label class=field>Дата начала<input class=inlineEdit type=date value="${o.startDate||''}" onchange="inlineProjectSave('${id}','startDate',this.value,this)"></label><label class=field>Дата сдачи<input class=inlineEdit type=date value="${o.date||''}" onchange="inlineProjectSave('${id}','date',this.value,this)"></label></div><label class=field>Заказчик<input class="inlineEdit inlineText" value="${esc(o.contractor||'')}" placeholder="Не указан" onchange="inlineProjectSave('${id}','contractor',this.value,this)"></label><label class=field>Предмет договора<textarea class="inlineEdit inlineArea contractSubject" placeholder="Не указан" onchange="inlineProjectSave('${id}','items',this.value,this)">${esc(o.items||'')}</textarea></label></div><div class=info><div class=label>Сумма договора</div><input class="inlineEdit inlineText" inputmode=numeric value="${moneyText(o.money)}" oninput="this.value=moneyText(moneyVal(this.value))" onchange="inlineMoneyBlur('${id}',this)"><div class=small>Получено ${rub(received(o))} · остаток к оплате ${rub(left(o))}</div>${paymentHistory(o)}</div><div class=info><div class=label>💰 Фактическая маржа</div><div class="margin-display ${marginClass}"><div>Доход: <b>${rub(received(o))}</b></div><div>Расходы: <b style="color:${(o.totalExpenses||0)>0?'#e74c3c':'#27ae60'}">${rub(o.totalExpenses||0)}</b></div><hr><div>Маржа: <b>${rub(margin)}</b></div></div><div class=actions style="margin-top:8px"><button class=btn onclick="openExpense('${id}')">+ Расход</button></div>${(o.expenses||[]).length?`<div class=expense-list style="margin-top:6px">${o.expenses.map(e=>expenseCard({...e,projectId:o.id})).join('')}</div>`:''}</div><div class=info><div class=label>Закрывающие документы</div>${o.status==='Выполнено'?`<label class="docCheck ${o.closingReceived?'ok':''}"><input type=checkbox ${o.closingReceived?'checked':''} onchange="quickClosing('${id}',this.checked)"><span>${o.closingReceived?'Документы собраны':'Закрывающие документы собраны'}</span></label>`:'<div class=small>Появятся после выполнения объекта</div>'}</div><div class=info><div class=label>Задачи · ${list.filter(t=>!t.done).length} активных</div>${list.slice(0,8).map(taskCard).join('')||'<div class=empty>Задач нет</div>'}</div><div class=info><label class=woodCheck><span>Нужно дерево</span><input type=checkbox ${o.needsWood?'checked':''} onchange="toggleWoodProject('${id}',this.checked,this)"></label><div id=woodCheckHint class=small>${o.needsWood?'Объект добавлен во вкладку «Дерево»':'Отметьте, чтобы добавить объект во вкладку «Дерево»'}</div></div><div class=info id=docsBox><div class=label>Файлы</div><div class=small>Загрузка…</div></div>${changes.length?`<div class=info><div class=label>📝 История изменений</div>${changes.map(c=>{let who=memberName(c.changed_by)||'?';return `<div class="change-row ${esc(c.field)}"><span class=change-field>${esc(c.field)}</span> <span class=change-old>${esc(c.old_value||'—')}</span> → <span class=change-new>${esc(c.new_value||'—')}</span> <span class=change-by>${esc(who)} · ${new Date(c.changed_at).toLocaleDateString('ru-RU')}</span></div>`}).join('')}</div>`:''}<div id=inlineSaveState class=saveState></div><div class=actions><button class=btn onclick="openTask('${id}')">+ Задача</button><button class=btn onclick="openPayment('${id}')">+ Оплата</button></div><button class="btn secondary wide" onclick="openDocGenerator('${id}')">📄 Документы: договор, КП, акт</button>${isOwner()?`<button class=dangerLink onclick="deleteProject('${id}')">Удалить объект</button>`:''}`;$('modal').classList.add('on');try{let ds=await docsFor(id);$('docsBox').innerHTML=`<div class=label>Файлы</div>${ds.map(d=>`<div class=doc><span>📎 ${esc(d.name)}</span><span><button class=chip onclick="openDoc(${d.key})">Открыть</button> <button class=chip onclick="delDoc(${d.key},'${id}')">×</button></span></div>`).join('')||'<div class=small>Файлов пока нет</div>'}<label class="btn secondary" style="display:block;text-align:center;margin-top:9px">+ Файл<input type=file multiple hidden onchange="addDocs('${id}',this.files)" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml+xml"></label></div>`}catch(e){}}
// Local drafts are isolated by account and workspace, and never labelled as synced.
let woodLocalMode=false,woodLoadError='',woodFlagsAvailable=false,woodStatusAvailable=false;
function woodStorageKey(){return 'crmWoodV25:'+currentUser?.id+':'+currentWorkspace}
function readWoodDrafts(){try{let x=JSON.parse(localStorage.getItem(woodStorageKey())||'{}');return {rows:Array.isArray(x.rows)?x.rows:[],flags:x.flags&&typeof x.flags==='object'?x.flags:{}}}catch(e){return {rows:[],flags:{}}}}
function writeWoodDrafts(x){localStorage.setItem(woodStorageKey(),JSON.stringify(x))}
function selectedWoodProjects(){return data.filter(o=>o.needsWood&&o.status!=='Выполнено')}
function completedWoodProjects(){return data.filter(o=>o.needsWood&&o.status==='Выполнено')}
function woodNotice(){
 if(woodLoadError)return '<div class=empty>Не удалось загрузить дерево. Проверьте соединение и обновите страницу.</div>';
 let drafts=readWoodDrafts(),statuses=Object.keys(readWoodStatuses()).length;
 if(!woodAvailable||!woodFlagsAvailable)return '<div class=woodNotice>Дерево сохраняется в этом браузере. Для доступа с других устройств нужна настройка общей базы.</div>';
 let notice=!woodStatusAvailable?'<div class=woodNotice>Новые галочки сохраняются в этом браузере. Для синхронизации с командой нужно обновить общую базу.</div>':'';
 if(drafts.rows.length||Object.keys(drafts.flags).length||(woodStatusAvailable&&statuses))notice+='<div class=woodNotice>Есть записи из этого браузера. <button class=chip onclick="syncWoodDrafts(this)">Перенести в общую базу</button></div>';
 return notice;
}
function readWoodStatuses(){try{return JSON.parse(localStorage.getItem(woodStorageKey()+':statuses')||'{}')||{}}catch(e){return {}}}
function withWoodStatus(w){let state=readWoodStatuses()[w.id];return state?{...w,inStock:!!state.inStock,ready:!!state.ready}:w}
function writeWoodStatuses(x){localStorage.setItem(woodStorageKey()+':statuses',JSON.stringify(x))}
async function toggleWoodStatus(id,field,value,el){
 let w=wood.find(x=>x.id===id);if(!w||!['inStock','ready'].includes(field))return;
 if(el)el.disabled=true;
 try{let states=readWoodStatuses(),next={projectId:w.projectId,inStock:!!w.inStock,ready:!!w.ready,[field]:!!value};
  if(woodStatusAvailable&&!w.local){let {error}=await sb.from('wood_items').update(states[id]?{in_stock:next.inStock,ready:next.ready}:{[field==='inStock'?'in_stock':'ready']:!!value}).eq('id',id).eq('workspace_id',currentWorkspace);if(error)throw error;delete states[id];writeWoodStatuses(states)}
  else{states[id]=next;writeWoodStatuses(states)}
  let current=wood.find(x=>x.id===id);if(current)Object.assign(current,next);renderWood();
 }catch(e){if(el){el.disabled=false;el.checked=!value}alert('Не удалось сохранить отметку: '+(e.message||e))}
}
function woodToOrder(rows){return rows.filter(w=>!w.inStock&&!w.ready)}

async function toggleWoodProject(id,checked,el){
 let o=data.find(x=>x.id===id);if(!o)return;
 try{
  if(woodFlagsAvailable){let {error}=await sb.from('projects').update({needs_wood:checked}).eq('id',id).eq('workspace_id',currentWorkspace);if(error)throw error;let d=readWoodDrafts();delete d.flags[id];writeWoodDrafts(d)}
  else{let d=readWoodDrafts();d.flags[id]=checked;writeWoodDrafts(d)}
  o.needsWood=checked;render();let hint=$('woodCheckHint');if(hint)hint.textContent=checked?'Объект добавлен во вкладку «Дерево»':'Записи сохранены. Объект исключён из сводной таблицы.';
 }catch(e){if(el)el.checked=!checked;alert('Не удалось сохранить отметку: '+(e.message||e))}
}
function aggregateWood(rows){let groups=new Map();for(let w of rows){let key=JSON.stringify([w.name.trim().toLocaleLowerCase('ru'),w.thickness,w.width,w.length]),g=groups.get(key);if(!g){g={...w,quantity:0};groups.set(key,g)}g.quantity+=w.quantity}return [...groups.values()].sort((a,b)=>a.length-b.length||a.width-b.width||a.thickness-b.thickness||a.name.localeCompare(b.name,'ru'))}
function woodRecord(w,archived=false){return `<div class=woodRow><b>${esc(w.name)}</b><div class=woodDims><span>Длина <b>${w.length}</b> мм</span><span>Ширина <b>${w.width}</b> мм</span><span>Толщина <b>${w.thickness}</b> мм</span><span><b>${w.quantity}</b> шт.</span></div>${w.note?`<div class=woodNote>${esc(w.note)}</div>`:''}<div class=woodStatuses><label class="woodStatus ${w.inStock?'on':''}"><input type=checkbox ${w.inStock?'checked':''} ${archived?'disabled':''} onchange="toggleWoodStatus('${w.id}','inStock',this.checked,this)"><span>Дерево есть</span></label><label class="woodStatus ${w.ready?'on':''}"><input type=checkbox ${w.ready?'checked':''} ${archived?'disabled':''} onchange="toggleWoodStatus('${w.id}','ready',this.checked,this)"><span>Дерево готово</span></label></div>${archived?'':`<div class=actions><button class=chip onclick="openWood('${w.projectId}','${w.id}')">Изменить</button><button class=chip onclick="deleteWood('${w.id}')">Удалить</button></div>`}</div>`}
function woodProjectHtml(o,archived=false){const rows=wood.filter(w=>w.projectId===o.id);return `<section class="woodProject ${archived?'woodArchivedProject':''}"><div class=head><h2>${esc(o.name)}</h2>${archived?'<span class=badge>Выполнено</span>':`<button class=btn onclick="openWood('${o.id}')">+ Дерево</button>`}</div>${rows.map(w=>woodRecord(w,archived)).join('')||'<p class=summary>Записей о дереве пока нет.</p>'}</section>`}
function woodOrderMeters(rows){
 const groups=new Map();
 for(const w of woodToOrder(rows)){let width=Math.ceil(w.width/10)*10,thickness=Math.ceil(w.thickness/10)*10,key=JSON.stringify([w.name.trim().toLocaleLowerCase('ru'),width,thickness]);let g=groups.get(key);if(!g){g={name:w.name.trim(),width,thickness,millimeters:0};groups.set(key,g)}g.millimeters+=w.length*w.quantity}
 return [...groups.values()].map(g=>({...g,meters:g.millimeters/1000})).sort((a,b)=>a.width-b.width||a.thickness-b.thickness||a.name.localeCompare(b.name,'ru'));
}
function woodOrderTotals(rows){const groups=woodOrderMeters(rows).map(g=>({...g,volume:g.meters*g.width*g.thickness/1e6}));return {groups,meters:groups.reduce((n,g)=>n+g.millimeters,0)/1000,volume:groups.reduce((n,g)=>n+g.volume,0)}}
function woodOrderMeterHtml(rows){let {groups,meters,volume}=woodOrderTotals(rows),volumeText=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:6}),meterText=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:3});return `<section class=woodMeterSummary><div class=woodMeterHead><b>Погонаж к заказу</b><div class=woodOrderAmounts><strong>${volumeText(volume)} м³</strong><strong>${meterText(meters)} пог. м</strong></div></div><div class=small>Ширина × толщина округлены вверх до 10 мм</div>${groups.map(g=>`<div class=woodMeterRow><div><b>${g.width} × ${g.thickness} мм</b><span>${esc(g.name)}</span></div><div class=woodOrderAmounts><span>${volumeText(g.volume)} м³</span><strong>${meterText(g.meters)} пог. м</strong></div></div>`).join('')||'<div class=summary>Нет дерева к заказу</div>'}</section>`}

function woodPositionStatus(w){return w.ready?{label:'Готово',kind:'ready'}:w.inStock?{label:'Есть',kind:'stock'}:{label:'К заказу',kind:'order'}}
function woodOverviewHtml(projects){
 return `<div class=sectionTitle style="margin-top:22px"><b>Дерево по объектам</b></div><div class=woodOverviewWrap><table class=woodOverview aria-label="Перечень дерева по объектам"><thead><tr><th scope=col>Материал</th><th scope=col>Д×Ш×Т, мм</th><th scope=col class=woodOverviewQty>Шт.</th><th scope=col class=woodOverviewState>Статус</th></tr></thead>${projects.map(o=>{const rows=wood.filter(w=>w.projectId===o.id);return `<tbody><tr class=woodOverviewProject><th scope=rowgroup colspan=4>${esc(o.name)}</th></tr>${rows.map(w=>{const status=woodPositionStatus(w);return `<tr><td class=woodOverviewName>${esc(w.name)}</td><td class=woodOverviewSize>${w.length}×${w.width}×${w.thickness}</td><td class=woodOverviewQty>${w.quantity}</td><td class=woodOverviewState><span class="woodOverviewBadge ${status.kind}">${status.label}</span></td></tr>`}).join('')||'<tr><td colspan=4 class=woodOverviewEmpty>Дерево ещё не добавлено</td></tr>'}</tbody>`}).join('')}</table></div>`;
}

function renderWood(){
 let projects=selectedWoodProjects(),completed=completedWoodProjects();if(woodFilter&&!projects.some(o=>o.id===woodFilter))woodFilter='';
 $('woodProjectFilter').innerHTML='<option value="">Все отмеченные объекты</option>'+projects.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');$('woodProjectFilter').value=woodFilter;
 let shown=projects.filter(o=>!woodFilter||o.id===woodFilter),ids=new Set(shown.map(o=>o.id)),rows=wood.filter(w=>ids.has(w.projectId)),pending=woodToOrder(rows);
 $('woodBody').innerHTML=woodNotice()+(projects.length?`${woodOrderMeterHtml(rows)}<div class=woodObjectsDivider><span>Объекты</span><i aria-hidden=true></i></div>${shown.map(o=>woodProjectHtml(o)).join('')}${woodOverviewHtml(shown)}`:'<div class=empty>Нет активных объектов с деревом. Отметьте «Нужно дерево» в карточке объекта.</div>')+`<details class=woodCompleted><summary><b>Выполненные</b><span>${completed.length}</span></summary><div class=summary>Сохранены для истории и не входят в расчёты. При возвращении объекта в работу он появится в активных.</div>${completed.map(o=>woodProjectHtml(o,true)).join('')||'<div class=empty>Выполненных объектов пока нет</div>'}</details>`;
}
function woodSelect(id,label,values,value){let v=value||values[0],opts=[...new Set([...values,v])].sort((a,b)=>a-b);return `<label class=field>${label}<select id="${id}" data-number-wheel="true" onchange="woodCustomInput('${id}',this.value)">${opts.map(n=>`<option value="${n}" ${n===v?'selected':''}>${n}</option>`).join('')}<option value=custom>Своё значение…</option></select><input id="${id}Custom" class=woodCustom type=number min=1 max=2147483647 step=1 placeholder="Введите значение" hidden></label>`}
function woodCustomInput(id,value){let el=$(id+'Custom');el.hidden=value!=='custom';if(!el.hidden)el.focus()}
function woodNumber(id){return Number($(id).value==='custom'?$(id+'Custom').value:$(id).value)}
let woodFormEntries=[],woodFormCounter=0,woodFormSaving=false;
const woodFieldId=(name,key)=>key===0?name:name+'_'+key;
const woodRange=(first,last)=>Array.from({length:last-first+1},(_,i)=>first+i);
function woodPositionHtml(w,key,removable=false){
 const id=name=>woodFieldId(name,key);
 return `<section class=woodFormPosition id="woodPosition${key}"><div class=woodPositionHead><span>Позиция ${key+1}</span>${removable?`<button type=button class=woodRemovePosition aria-label="Убрать позицию ${key+1}" onclick="removeWoodPosition(${key})">×</button>`:''}</div><label class=field>Материал / деталь<input id="${id('wname')}" placeholder="Например: сосна, брусок" value="${esc(w?.name||'Брусок')}"></label><div class=row2><label class=field>Длина, мм<input id="${id('wlength')}" type=number inputmode=numeric min=1 max=2147483647 step=1 placeholder="1500" value="${w?.length??2000}"></label>${woodSelect(id('wqty'),'Количество, шт.',woodRange(1,500),w?.quantity||1)}</div><div class=row2>${woodSelect(id('wwidth'),'Ширина, мм',woodRange(1,300),w?.width||37)}${woodSelect(id('wthick'),'Толщина, мм',woodRange(1,300),w?.thickness||47)}</div><details class=woodNoteDetails ${w?.note?'open':''}><summary>Заметка</summary><label class=field><span class=srOnly>Заметка к позиции ${key+1}</span><textarea id="${id('wnote')}" rows=2 placeholder="Например: 20 лавочек × 5 брусков">${esc(w?.note||'')}</textarea></label></details></section>`;
}
function addWoodPosition(){
 if(woodFormSaving)return;
 let previous=woodFormEntries.at(-1),name=previous?$(woodFieldId('wname',previous.key)).value:'Брусок';
 let key=++woodFormCounter;woodFormEntries.push({key,id:crypto.randomUUID(),source:null});
 $('woodPositions').insertAdjacentHTML('beforeend',woodPositionHtml({name},key,true));
 $(woodFieldId('wlength',key)).focus({preventScroll:true});
 $('woodPosition'+key).scrollIntoView({block:'nearest',behavior:'smooth'});
}
function removeWoodPosition(key){if(woodFormSaving)return;let entry=woodFormEntries.find(e=>e.key===key);if(!entry||entry.source)return;woodFormEntries=woodFormEntries.filter(e=>e.key!==key);$('woodPosition'+key)?.remove()}
function openWood(projectId='',itemId=''){
 if(woodLoadError)return alert('Данные дерева не загружены. Проверьте соединение и обновите страницу.');
 let projects=selectedWoodProjects();if(!projects.length)return alert('Поставьте галочку «Нужно дерево» в карточке объекта.');
 let w=wood.find(x=>x.id===itemId),pid=w?.projectId||projectId||projects[0].id;
 woodFormCounter=0;woodFormSaving=false;woodFormEntries=[{key:0,id:w?.id||crypto.randomUUID(),source:w||null}];
 $('sheet').innerHTML=`<div class=woodForm><button class=close onclick=closeModal()>×</button><h2>${w?'Изменить':'Добавить'} дерево</h2><label class=field>Объект<select id=wproject>${projects.map(o=>`<option value="${esc(o.id)}" ${o.id===pid?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><div id=woodPositions>${woodPositionHtml(w,0)}</div><button type=button class=woodAddPosition onclick="addWoodPosition()">+ Позиция</button><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=woodSave>Сохранить</button></div></div>`;
 $('modal').classList.add('on');$('woodSave').onclick=saveWoodForm;
}
function collectWoodForm(){
 let pid=$('wproject').value;if(!pid)throw new Error('Выберите объект');
 return woodFormEntries.map(entry=>{
  const id=name=>woodFieldId(name,entry.key),vals=['wlength','wwidth','wthick','wqty'].map(name=>woodNumber(id(name))),name=$(id('wname')).value.trim();
  if(!name||vals.some(x=>!Number.isInteger(x)||x<=0||x>2147483647))throw new Error('Позиция '+(entry.key+1)+': укажите материал, длину, ширину, толщину и количество целыми положительными числами.');
  const source=wood.find(w=>w.id===entry.id)||entry.source;
  return {entry,row:{id:entry.id,projectId:pid,name,length:vals[0],width:vals[1],thickness:vals[2],quantity:vals[3],note:$(id('wnote')).value.trim(),inStock:!!source?.inStock,ready:!!source?.ready}};
 });
}
async function saveWoodForm(){
 if(woodFormSaving)return;let batch;
 try{batch=collectWoodForm()}catch(e){return alert(e.message)}
 woodFormSaving=true;let button=$('woodSave');button.disabled=true;
 const form=$('sheet').querySelector('.woodForm');const controls=form?[...form.querySelectorAll('input,select,textarea,button')]:[];controls.forEach(el=>el.disabled=true);
 let saved=0;
 try{
  for(const {entry,row} of batch){
   if(entry.source?.local||!woodAvailable||!woodFlagsAvailable){let d=readWoodDrafts();row.local=true;d.rows=d.rows.filter(x=>x.id!==row.id);d.rows.unshift(row);writeWoodDrafts(d)}
   else{const payload=woodPayload(row);const q=entry.source?await sb.from('wood_items').update(payload).eq('id',row.id):await sb.from('wood_items').upsert({...payload,id:row.id,created_by:currentUser.id});if(q.error)throw q.error}
   wood=wood.filter(x=>x.id!==row.id);wood.unshift(row);entry.source={...row};saved++;
   const states=readWoodStatuses();if(states[row.id]){states[row.id].projectId=row.projectId;writeWoodStatuses(states)}
  }
  closeModal();showView('wood');
 }catch(e){
  alert((saved?'Сохранено позиций: '+saved+'. Остальные остались в форме. Нажмите «Сохранить» повторно. ':'Не удалось сохранить дерево. ')+(e.message||e));
 }finally{
  woodFormSaving=false;button.disabled=false;controls.forEach(el=>el.disabled=false);
  for(const entry of woodFormEntries){if(entry.source){const remove=$('woodPosition'+entry.key)?.querySelector('.woodRemovePosition');if(remove)remove.disabled=true}}
 }
}

function woodPayload(w){return {workspace_id:currentWorkspace,project_id:w.projectId,name:w.name,length_mm:w.length,width_mm:w.width,thickness_mm:w.thickness,quantity:w.quantity,note:w.note||'',...(woodStatusAvailable?{in_stock:!!w.inStock,ready:!!w.ready}:{})}}
async function deleteWood(id){let w=wood.find(x=>x.id===id);if(!w||!confirm('Удалить запись «'+w.name+'»?'))return;try{if(w.local){let d=readWoodDrafts();d.rows=d.rows.filter(x=>x.id!==id);writeWoodDrafts(d)}else{let {error}=await sb.from('wood_items').delete().eq('id',id);if(error)throw error}let states=readWoodStatuses();delete states[id];writeWoodStatuses(states);wood=wood.filter(x=>x.id!==id);renderWood()}catch(e){alert('Не удалось удалить: '+(e.message||e))}}
async function syncWoodDrafts(button){button.disabled=true;try{let d=readWoodDrafts();for(let [id,value] of Object.entries(d.flags)){if(!data.some(o=>o.id===id))continue;let {error}=await sb.from('projects').update({needs_wood:value}).eq('id',id);if(error)throw error;delete d.flags[id];writeWoodDrafts(d)}for(let w of [...d.rows]){if(!data.some(o=>o.id===w.projectId))continue;let {error}=await sb.from('wood_items').upsert({...woodPayload(withWoodStatus(w)),id:w.id,created_by:currentUser.id});if(error)throw error;d.rows=d.rows.filter(x=>x.id!==w.id);writeWoodDrafts(d)}if(woodStatusAvailable){let states=readWoodStatuses();for(let [id,state] of Object.entries(states)){let row=wood.find(x=>x.id===id);if(!row)continue;let {error}=await sb.from('wood_items').update({in_stock:!!state.inStock,ready:!!state.ready}).eq('id',id);if(error)throw error;delete states[id];writeWoodStatuses(states)}}await loadServer()}catch(e){button.disabled=false;alert('Перенос не завершён. Оставшиеся записи сохранены в браузере: '+(e.message||e))}}

function openPayment(id){let o=data.find(x=>x.id===id);if(!o)return;let rest=left(o);$('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Добавить оплату</h2><div class=summary>${esc(o.name)} · осталось ${rub(rest)}</div><label class=field>Сумма, ₽<input id=pay inputmode=numeric autocomplete=off></label>${rest>0?`<button type=button class=chip id=payAll>Весь остаток · ${rub(rest)}</button>`:''}<label class=field>Дата оплаты<input id=payDate type=date value="${localISO()}"></label><label class=field>Комментарий<input id=payNote placeholder="Например: аванс 30%, платёжка №123"></label><div class=actions><button class="btn secondary" onclick="detail('${id}')">Назад</button><button class=btn id=paySave>Добавить</button></div>`;$('modal').classList.add('on');setTimeout(()=>$('pay')?.focus(),50);$('pay').oninput=e=>e.target.value=moneyText(moneyVal(e.target.value));if($('payAll'))$('payAll').onclick=()=>{$('pay').value=moneyText(rest)};$('paySave').onclick=async()=>{let b=$('paySave');if(b.disabled)return;let v=moneyVal($('pay').value);if(v<=0)return alert('Укажите сумму оплаты');if(v>rest&&!confirm(`Сумма больше остатка (${rub(rest)}). Записать ${rub(v)}?`))return;let d=$('payDate').value||localISO();b.disabled=true;b.textContent='Сохраняю…';try{if(!serverReady)throw new Error('Нет связи с сервером');let {error}=await sb.from('payments').insert({workspace_id:currentWorkspace,project_id:o.id,amount:v,paid_on:d,note:$('payNote').value.trim(),created_by:currentUser.id});if(error)throw error;await loadServer();toast('Оплата '+rub(v)+' добавлена');detail(id)}catch(e){b.disabled=false;b.textContent='Добавить';serverError(e);alert('Не удалось добавить оплату: '+(e.message||e))}}}

function openExpense(projectId){
 let o=data.find(x=>x.id===projectId);if(!o)return;
 currentProjectForExpense=projectId;
 let rest=left(o);
 $('sheet').innerHTML=`<button class=close onclick=closeModal() aria-label="Закрыть">×</button><h2>Добавить расход</h2><div class=summary>${esc(o.name)} · договор ${rub(o.money)} · получено ${rub(received(o))}</div><label class=field>Сумма, ₽<input id=expAmt inputmode=numeric autocomplete=off></label><label class=field>Категория<select id=expCat><option value="Материалы">📦 Материалы</option><option value="Работа">👷 Работа</option><option value="Доставка">🚚 Доставка</option><option value="Инструмент">🔧 Инструмент</option><option value="Прочее">📋 Прочее</option></select></label><label class=field>Поставщик/подрядчик<input id=expSup placeholder="Название поставщика"></label><label class=field>Дата<input id=expDate type=date value="${localISO()}"></label><label class=field>Комментарий<input id=expNote placeholder="Например: накладная №12"></label><div class=actions><button class="btn secondary" onclick="detail('${projectId}')">Назад</button><button class=btn id=expSave>Добавить</button></div>`;$('modal').classList.add('on');setTimeout(()=>$('expAmt')?.focus(),50);$('expAmt').oninput=e=>e.target.value=moneyText(moneyVal(e.target.value));$('expSave').onclick=async()=>{
  let b=$('expSave');if(b.disabled)return;
  let v=moneyVal($('expAmt').value);
  if(v<=0)return alert('Укажите сумму расхода');
  b.disabled=true;b.textContent='Сохраняю…';
  try{
   await addExpense(projectId,v,$('expCat').value,$('expDate').value||localISO(),$('expSup').value.trim(),$('expNote').value.trim());
  }catch(e){b.disabled=false;b.textContent='Добавить';alert('Не удалось: '+(e.message||e))}
 }}

// ============================================
// ЭКСПОРТ ДЕРЕВА В PDF
// ============================================
function exportWoodToPDF(){
 let pending=woodToOrder(wood);
 if(!pending.length)return alert('Нет дерева к заказу');
 let {groups,meters,volume}=woodOrderTotals(pending);
 let date=new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
 let rows=groups.map((g,i)=>`<tr><td>${i+1}</td><td>${esc(g.name)}</td><td>${g.width} × ${g.thickness}</td><td>${g.meters.toFixed(3)}</td><td>${g.volume.toFixed(6)}</td></tr>`).join('');
 let html=`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Заказ дерева</title><style>
  body{font-family:'Times New Roman',serif;font-size:11pt;padding:40px;color:#000}
  .title{text-align:center;font-size:16pt;font-weight:bold;margin:20px 0}
  .meta{display:flex;justify-content:space-between;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{border:1px solid #000;padding:8px;text-align:left}
  th{background:#f0f0f0;font-weight:bold}
  .total{margin-top:20px;font-size:12pt;font-weight:bold}
  .footer{margin-top:40px;display:flex;justify-content:space-between}
  .sig{border-top:1px solid #000;padding-top:10px;width:45%}
  @media print{body{padding:20px}.noprint{display:none}}
 </style></head><body>
  <div class="noprint" style="text-align:center;margin-bottom:20px"><button onclick="window.print()" style="font-size:14px;padding:10px 20px;background:#315e50;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨 Печать / Сохранить PDF</button></div>
  <div class=title>ЗАКАЗ ДЕРЕВА</div>
  <div class=meta><span>Дата: ${date}</span><span>Всего: ${volume.toFixed(6)} м³ (${meters.toFixed(3)} пог.м)</span></div>
  <table><thead><tr><th>№</th><th>Наименование</th><th>Размер, мм</th><th>Погонаж, м</th><th>Объём, м³</th></tr></thead><tbody>${rows}</tbody></table>
  <div class=total>${volume.toFixed(6)} м³ · ${meters.toFixed(3)} пог. м</div>
  <div class=footer><div class=sig>Заказчик: __________ / __________</div><div class=sig>Поставщик: __________ / __________</div></div>
 </body></html>`;
 let win=window.open('','_blank','width=900,height=700');
 if(!win)return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна.');
 win.document.write(html);win.document.close();win.focus();
}
function openTask(projectId){$('sheet').innerHTML=`<button class=close onclick=closeModal()>×</button><h2>Новая задача</h2><label class=field>Что нужно сделать *<input id=tt placeholder="Например: согласовать цвет лавочек"></label><label class=field>По объекту<select id=tp><option value="">Без объекта</option>${data.map(o=>`<option value="${esc(o.id)}" ${o.id===projectId?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><label class=field>Ответственный<select id=tr><option value="">Не назначен</option>${members.map(m=>`<option value="${esc(m.user_id)}" ${m.user_id===currentUser?.id?'selected':''}>${esc(m.display_name||m.email||'Сотрудник')}</option>`).join('')}</select></label><label class=field>Срок<input id=td type=date></label><div class=actions><button class="btn secondary" onclick=closeModal()>Отмена</button><button class=btn id=taskSave>Создать</button></div>`;$('modal').classList.add('on');setTimeout(()=>$('tt')?.focus(),50);$('taskSave').onclick=async()=>{let b=$('taskSave');if(b.disabled)return;let title=$('tt').value.trim();if(!title)return alert('Напишите задачу');let t={id:null,title,projectId:$('tp').value||null,date:$('td').value||'',createdAt:localISO(),done:false,responsibleId:$('tr').value||null};b.disabled=true;b.textContent='Сохраняю…';try{await serverTaskUpsert(t,true);await loadServer();toast('Задача добавлена');if(projectId)detail(projectId);else closeModal()}catch(e){b.disabled=false;b.textContent='Создать';serverError(e);alert('Не удалось создать задачу: '+(e.message||e))}}}
async function deleteProject(id){let o=data.find(x=>x.id===id);if(!o)return;if(!isOwner())return alert('Удалять объекты может только владелец');if(!confirm('Удалить объект «'+o.name+'»?\n\nБудут также удалены его задачи, оплаты и дерево. Это действие нельзя отменить.'))return;let {error}=await sb.rpc('delete_project',{pid:id});if(error){serverError(error);return alert('Не удалось удалить: '+(error.message||error))}try{let ds=await docsFor(id),db=await docsDB,tx=db.transaction('docs','readwrite'),st=tx.objectStore('docs');ds.forEach(d=>st.delete(d.key))}catch(e){}closeModal();await loadServer();toast('Объект удалён')}
async function deleteTask(id){let t=tasks.find(x=>x.id===id);if(!t)return;if(!confirm('Удалить задачу «'+t.title+'»?'))return;if(serverReady){let {data:del,error}=await sb.from('tasks').delete().eq('id',id).select('id');if(error){serverError(error);return alert('Не удалось удалить задачу: '+(error.message||error))}if(!del?.length)return alert('Удалять задачи может только владелец')}tasks=tasks.filter(x=>x.id!==id);render();if($('modal').classList.contains('on')&&t.projectId)detail(t.projectId)}
async function toggleTask(id){let t=tasks.find(x=>x.id===id);if(!t)return;let prev={done:t.done,completedAt:t.completedAt};t.done=!t.done;t.completedAt=t.done?new Date().toISOString():null;render();try{await serverTaskUpsert(t);if(t.done)toast('Задача выполнена',async()=>{Object.assign(t,prev);render();try{await serverTaskUpsert(t)}catch(e){failSave(e)}})}catch(e){Object.assign(t,prev);render();failSave(e)}}
async function completeToday(id){let t=tasks.find(x=>x.id===id);if(t&&!t.done)await toggleTask(id)}
async function authAction(mode){$('authErr').textContent='';let email=$('authEmail').value.trim(),password=$('authPass').value;if(!email||password.length<6){$('authErr').textContent='Введите e-mail и пароль минимум из 6 символов';return}let r=mode==='up'?await sb.auth.signUp({email,password,options:{data:{display_name:email.split('@')[0]}}}):await sb.auth.signInWithPassword({email,password});if(r.error){$('authErr').textContent=r.error.message;return}if(mode==='up'&&!r.data.session)$('authErr').textContent='Аккаунт создан. Проверьте почту и подтвердите e-mail.'}
$('signInBtn').onclick=()=>authAction('in');$('signUpBtn').onclick=()=>authAction('up');$('signOutBtn').onclick=async()=>{await sb.auth.signOut();try{Object.keys(localStorage).filter(k=>k.startsWith('crm')).forEach(k=>localStorage.removeItem(k))}catch(e){}if(navigator.serviceWorker?.controller)navigator.serviceWorker.controller.postMessage('clear');location.reload()};
sb.auth.onAuthStateChange((_e,s)=>setTimeout(()=>startTeam(s),0));
sb.auth.getSession().then(({data:{session}})=>startTeam(session));
render();

if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
