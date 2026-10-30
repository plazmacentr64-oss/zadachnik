// Keep the original selects as the source of values and change events.
// Render the picker ourselves so its corners are consistent on mobile and desktop.
(()=>{
 'use strict';
 const controls=new WeakMap();
 let active=null,scheduled=false,serial=0;
 const layer=document.createElement('div');
 layer.className='selectLayer';layer.hidden=true;
 layer.innerHTML='<div class="selectPopup" role="dialog" aria-modal="true" aria-labelledby="selectPopupTitle"><div class="selectPopupHead"><b id="selectPopupTitle"></b><button type="button" class="selectPopupClose" aria-label="Закрыть список">×</button></div><div class="selectOptions" role="listbox" aria-labelledby="selectPopupTitle"></div></div>';
 document.body.append(layer);
 const popup=layer.querySelector('.selectPopup'),list=layer.querySelector('.selectOptions'),title=layer.querySelector('#selectPopupTitle');
 list.id='roundedSelectOptions';
 function labelFor(select){
  if(select.getAttribute('aria-label'))return select.getAttribute('aria-label');
  const label=select.labels?.[0];
  const text=label?[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim():'';
  return text||({'woodProjectFilter':'Объект','spanSel':'Период'}[select.id])||select.title||(select.closest('.quick')?'Статус объекта':'Выберите значение');
 }
 function refresh(select,button){
  const value=select.options[select.selectedIndex]?.textContent||'Выберите значение';
  if(button.firstChild.textContent!==value)button.firstChild.textContent=value;
  const label=labelFor(select)+': '+value;
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  button.disabled=select.disabled;
 }
 function enhance(){
  scheduled=false;
  document.querySelectorAll('select:not([multiple])').forEach(select=>{
   let button=controls.get(select);
   if(!button||!button.isConnected){
    button=document.createElement('button');button.type='button';button.className='selectTrigger';
    button.innerHTML='<span></span><span class="selectChevron" aria-hidden="true">⌄</span>';
    button.id='selectTrigger'+(++serial);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    select.classList.add('roundedNativeSelect');select.insertAdjacentElement('afterend',button);controls.set(select,button);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(select,button)});
    button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();open(select,button);if(active&&event.key==='Home')focusAt(0);if(active&&event.key==='End')focusAt(active.options.length-1)}});
    select.addEventListener('change',()=>refresh(select,button));
    select.addEventListener('invalid',()=>button.focus());
   }
   refresh(select,button);
  });
  if(active&&(!active.select.isConnected||active.select.disabled))close(false);
 }
 function close(restore=true){
  if(!active)return;const old=active;active=null;
  layer.hidden=true;document.body.append(layer);old.button.setAttribute('aria-expanded','false');old.button.removeAttribute('aria-controls');document.body.style.overflow=old.overflow;
  if(restore&&old.button.isConnected)old.button.focus({preventScroll:true});
 }
 function focusAt(index){if(!active||!active.options.length)return;index=Math.max(0,Math.min(active.options.length-1,index));active.index=index;active.options[index].focus({preventScroll:true});if(active.compact){const item=active.options[index];list.scrollTop=Math.max(0,item.offsetTop-list.clientHeight/2+item.offsetHeight/2)}else active.options[index].scrollIntoView({block:'nearest'})}
 function open(select,button){
  if(select.disabled)return;close(false);
  if(select.getAttribute('data-number-wheel')==='true'){window.openWoodWheel(select,button);return;}
  const compact=select.getAttribute('data-number-wheel')==='true';
  layer.className=compact?'selectLayer selectLayerCompact':'selectLayer';popup.className=compact?'selectPopup selectPopupCompact':'selectPopup';
  title.textContent=labelFor(select);list.replaceChildren();
  active={select,button,options:[],index:0,overflow:document.body.style.overflow,typed:'',typedAt:0,compact};
  [...select.options].forEach((option,index)=>{
   if(option.hidden)return;
   const item=document.createElement('button');item.type='button';item.className='selectOption';item.setAttribute('role','option');item.setAttribute('aria-selected',String(index===select.selectedIndex));item.textContent=option.textContent;
   item.disabled=option.disabled||!!option.closest('optgroup')?.disabled;
   item.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();
    const previous=select.selectedIndex;select.selectedIndex=index;refresh(select,button);close();
    if(previous!==index){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}
   });
   list.append(item);if(!item.disabled){if(index===select.selectedIndex)active.index=active.options.length;active.options.push(item)}
  });
  if(compact)button.insertAdjacentElement('afterend',layer);else document.body.append(layer);
  layer.hidden=false;if(!compact)document.body.style.overflow='hidden';button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',list.id);
  // Numeric wheels stay in the form directly below the control; no side switching.
  if(compact){
   popup.style.width='100%';popup.style.maxHeight='116px';popup.style.left='0';popup.style.top='0';
  }else{
   const r=button.getBoundingClientRect(),width=Math.min(420,window.innerWidth-24),height=Math.min(440,window.innerHeight-32);
   popup.style.width=width+'px';popup.style.maxHeight=height+'px';popup.style.left=Math.max(12,Math.min(r.left,window.innerWidth-width-12))+'px';
   const actualHeight=popup.getBoundingClientRect().height;popup.style.top=Math.max(16,Math.min(r.bottom+8,window.innerHeight-actualHeight-16))+'px';
  }
  popup.setAttribute('aria-modal',String(!compact));
  if(active.options.length)focusAt(active.index);else layer.querySelector('.selectPopupClose').focus();
 }
 layer.addEventListener('click',event=>{if(event.target===layer)close()});
 layer.querySelector('.selectPopupClose').addEventListener('click',()=>close());
 layer.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
  const options=active.options,current=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();focusAt(event.key==='Home'?0:event.key==='End'?options.length-1:current+(event.key==='ArrowDown'?1:-1));return;
  }
  if(event.key==='Tab'){
   event.preventDefault();const all=active.compact&&options.length?[...options]:[layer.querySelector('.selectPopupClose'),...options],index=all.indexOf(document.activeElement);all[(index+(event.shiftKey?-1:1)+all.length)%all.length].focus();return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key!==' '){
   const now=Date.now();active.typed=(now-active.typedAt>700?'':active.typed)+event.key.toLocaleLowerCase();active.typedAt=now;
   const index=options.findIndex(o=>o.textContent.trim().toLocaleLowerCase().startsWith(active.typed));if(index>=0){event.preventDefault();focusAt(index)}
  }
 });
 document.addEventListener('click',event=>{if(active?.compact&&!layer.contains(event.target)&&!active.button.contains(event.target))close(false)},true);
 window.addEventListener('resize',()=>close());
 document.addEventListener('reset',()=>setTimeout(enhance,0));
 const observer=new MutationObserver(records=>{
  // Ignore our own text updates and popup contents to avoid observer loops.
  if(!records.some(r=>!layer.contains(r.target)&&!r.target.closest?.('.selectTrigger')))return;
  if(!scheduled){scheduled=true;queueMicrotask(enhance)}
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','label','aria-label']});
 enhance();
})();
