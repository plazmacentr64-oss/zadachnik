'use strict';
// v55 «Мастерская»: стиль в v55.css; здесь — немного картинок поверх готовых экранов.
// 1) штамп «СДАНО» на сданных объектах, 2) значок у задачи по смыслу, 3) рисунок сечения в прайсе.
// Данные и логика не меняются.

/* 1. Сданные объекты — отметка для штампа */
if(typeof card==='function'){const _card55=card;card=function(o,c){const h=_card55(o,c);return o&&o.status==='Выполнено'?h.replace('class="ocard2 ','class="ocard2 v55done '):h}}

/* 2. Задачи — значок по словам в названии */
const V55_TK=[[/свар|сварк|каркас|рам[аыу]/i,'fire','fire'],[/покрас|краск|грунт|ral/i,'paint-brush-broad','paint'],[/машин|отгруз|достав|вывез|привез|монтаж/i,'truck','truck'],
 [/звон|оплат|счёт|счет|деньг|аванс|договор/i,'coins','coins'],[/брус|дерев|сосн|доск|лиственн/i,'tree','tree'],[/заказ|купить|закуп|снабж/i,'shopping-cart','cart'],
 [/почин|ремонт|вытяжк|станок|наладить/i,'wrench','wrench']];
function v55TaskIcon(title){const m=V55_TK.find(([rx])=>rx.test(title||''));const [,n,k]=m||[0,'list-checks','doc'];return typeof ic==='function'?`<span class="v55tk k-${k}" aria-hidden="true">${ic(n,22)}</span>`:''}
if(typeof taskCard==='function'){const _tc55=taskCard;taskCard=function(t){const h=_tc55(t);return h.replace('<div class=taskMain>',v55TaskIcon(t&&t.title)+'<div class=taskMain>')}}

/* 3. Прайс — маленький рисунок сечения слева от позиции */
const V55_RAL={'1015':'#E6D2B5','3005':'#5E2028','5005':'#1E4A7C','6005':'#114232','6029':'#20603D','7024':'#45494E','7040':'#9DA3A6','8017':'#45322E','9003':'#F4F4F0','9005':'#0E0E10','9006':'#A5A8A6'};
function v55Shape(name){
 const s=(name||'').toLowerCase(),d=s.match(/(\d+)\s*[x×х*]\s*(\d+)/),st='#8C9BA5',dk='#5B7280',bg='#E3E8EB';
 const box=(inner,b=bg)=>`<span class=v55sh style="background:${b}" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 30 30">${inner}</svg></span>`;
 if(/ral\s*(\d{4})/.test(s)){const c=V55_RAL[s.match(/ral\s*(\d{4})/)[1]];if(c)return `<span class=v55sh style="background:${c}" aria-hidden="true"></span>`}
 if(/эмал|краск|грунт|лак|пропит|морилк|антисепт/.test(s))return box(`<rect x="8" y="9" width="14" height="16" rx="3" fill="#2F6B4F"/><path d="M9 9c2-4 10-4 12 0" stroke="#5B4A36" stroke-width="2" fill="none"/><rect x="10.5" y="14" width="9" height="5" rx="1" fill="#FFFBF5"/>`,'#F5E6A8');
 if(/болт|винт|гайк|шайб|саморез|шуруп|анкер|заклёп|заклеп|дюбел/.test(s))return box(`<path d="M10 5h10l2 4H8z" fill="#6E5FB5"/><rect x="12.5" y="9" width="5" height="17" rx="1" fill="#8C7FD0"/><path d="M12.5 13h5M12.5 17h5M12.5 21h5" stroke="#4A3D99" stroke-width="1.2"/>`,'#DDD6F3');
 if(/брус|доск|рейк|вагонк|сосн|листвен|дуб|берёз|берез|планкен/.test(s))return box(`<rect x="3" y="10" width="21" height="11" rx="2" fill="#C98A4B"/><path d="M5 14c5 2 10-2 17 0" stroke="#8A5424" stroke-width="1" fill="none"/><ellipse cx="25" cy="15.5" rx="3" ry="5.5" fill="#B8732F"/>`,'#F3E1CC');
 if(/уголок/.test(s))return box(`<path d="M7 5h5v13h12v5H7z" fill="${st}"/>`);
 if(/швеллер/.test(s))return box(`<path d="M7 6h15v4h-10v10h10v4H7z" fill="${st}"/>`);
 if(/лист|просеч|рифл/.test(s))return box(`<path d="M3 18l12-8 12 5-12 8z" fill="${st}"/><path d="M3 18v2l12 5v-2z" fill="${dk}"/>`);
 if(/полоса/.test(s))return box(`<rect x="3" y="12" width="24" height="6" rx="1" fill="${st}"/>`);
 if(/круг|пруток|арматур|вгп|ø|диам|круглая/.test(s))return box(`<circle cx="15" cy="15" r="10" fill="${st}"/>${/труба|вгп/.test(s)?`<circle cx="15" cy="15" r="6" fill="${bg}"/>`:''}`);
 if(/труба|профил/.test(s)){const sq=!d||d[1]===d[2];return sq?box(`<rect x="5" y="5" width="20" height="20" rx="2" fill="${st}"/><rect x="9" y="9" width="12" height="12" fill="${bg}"/>`):box(`<rect x="3" y="8" width="24" height="14" rx="2" fill="${st}"/><rect x="7" y="12" width="16" height="6" fill="${bg}"/>`)}
 return '';
}
function v55DecoratePrice(root){(root||document).querySelectorAll('.priceRow:not(.v55p)').forEach(r=>{r.classList.add('v55p');const b=r.querySelector('b');const pic=v55Shape(b&&b.textContent);if(pic)r.insertAdjacentHTML('afterbegin',pic)})}
(()=>{const s=document.getElementById('sheet');if(!s||!window.MutationObserver)return;let t=0;new MutationObserver(()=>{if(t)return;t=requestAnimationFrame(()=>{t=0;v55DecoratePrice(s)})}).observe(s,{childList:true,subtree:true})})();

/* цвет строки браузера под новый стиль */
(()=>{const m=document.querySelector('meta[name=theme-color]');if(m)m.content='#F3EDE3'})();
if(typeof renderCurrent==='function'){try{renderCurrent()}catch(e){}}
