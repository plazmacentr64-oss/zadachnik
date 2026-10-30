(()=>{
 'use strict';
 const ROW=36,layer=document.createElement('div');let current=null;
 layer.className='woodWheelLayer';layer.hidden=true;
 layer.innerHTML='<section class="woodWheelPanel" role="dialog" aria-modal="true" aria-labelledby="woodWheelTitle"><div class="woodWheelHead"><button type="button" class="wheelCancel">Отмена</button><b id="woodWheelTitle">Размеры, мм</b><button type="button" class="wheelDone">Готово</button></div><div class="woodWheelColumns"></div><button type="button" class="wheelManual">Ввести вручную</button></section>';
 document.body.append(layer);
 const columns=layer.querySelector('.woodWheelColumns'),title=layer.querySelector('#woodWheelTitle');
 function close(restore=true){if(!current)return;const state=current;current=null;layer.hidden=true;columns.replaceChildren();document.body.style.overflow=state.overflow;state.trigger.setAttribute('aria-expanded','false');if(restore&&state.trigger.isConnected)state.trigger.focus({preventScroll:true})}
 function sync(column){const index=Math.max(0,Math.min(column.values.length-1,Math.round(column.track.scrollTop/ROW)));column.index=index;column.track.setAttribute('aria-activedescendant',column.options[index].id);column.options.forEach((o,i)=>o.setAttribute('aria-selected',String(i===index)))}
 function move(column,index){index=Math.max(0,Math.min(column.values.length-1,index));column.track.scrollTop=index*ROW;sync(column)}
 function commitSelect(select,value){if(select.value===String(value))return;select.value=String(value);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}
 window.openWoodWheel=(select,trigger)=>{
  if(select.disabled)return;close(false);
  const suffix=select.id.replace(/^(wwidth|wthick|wqty)/,'');
  const isSize=/^(wwidth|wthick)/.test(select.id);
  const sources=isSize?[document.getElementById('wwidth'+suffix),document.getElementById('wthick'+suffix)]:[select];
  if(sources.some(s=>!s))return;
  current={origin:select,trigger,columns:[],overflow:document.body.style.overflow};
  title.textContent=isSize?'Размеры, мм':'Количество, шт.';
  sources.forEach((source,columnIndex)=>{
   const values=[...source.options].map(o=>o.value).filter(v=>v!=='custom'&&Number.isFinite(Number(v)));
   const wrapper=document.createElement('div');wrapper.className='woodWheelColumn';
   const label=document.createElement('div');label.className='woodWheelLabel';label.id='wheelLabel'+columnIndex;label.textContent=source.id.startsWith('wwidth')?'Ширина':source.id.startsWith('wthick')?'Толщина':'Количество';
   const viewport=document.createElement('div');viewport.className='woodWheelViewport';
   const band=document.createElement('div');band.className='woodWheelCenter';band.setAttribute('aria-hidden','true');
   const track=document.createElement('div');track.className='woodWheelTrack';track.tabIndex=0;track.setAttribute('role','listbox');track.setAttribute('aria-labelledby',label.id);
   const column={source,values,track,options:[],index:Math.max(0,values.indexOf(source.value))};
   values.forEach((value,i)=>{const item=document.createElement('button');item.type='button';item.className='woodWheelNumber';item.id='wheelOption'+columnIndex+'_'+i;item.tabIndex=-1;item.setAttribute('role','option');item.textContent=value;item.addEventListener('click',()=>move(column,i));track.append(item);column.options.push(item)});
   track.addEventListener('scroll',()=>{if(current)sync(column)},{passive:true});
   track.addEventListener('keydown',event=>{const key=event.key;if(['ArrowDown','ArrowUp','Home','End'].includes(key)){event.preventDefault();move(column,key==='Home'?0:key==='End'?values.length-1:column.index+(key==='ArrowDown'?1:-1))}else if(key==='Enter'){event.preventDefault();finish()}});
   viewport.append(band,track);wrapper.append(label,viewport);columns.append(wrapper);current.columns.push(column);
  });
  layer.hidden=false;document.body.style.overflow='hidden';trigger.setAttribute('aria-expanded','true');
  current.columns.forEach(c=>move(c,c.index));
  current.columns.find(c=>c.source===select)?.track.focus({preventScroll:true});
 };
 function finish(){if(!current)return;const state=current;state.columns.forEach(sync);if(state.columns.some(c=>!c.source.isConnected)){close(false);return}close();state.columns.forEach(c=>commitSelect(c.source,c.values[c.index]))}
 layer.querySelector('.wheelDone').addEventListener('click',finish);
 layer.querySelector('.wheelCancel').addEventListener('click',()=>close());
 layer.querySelector('.wheelManual').addEventListener('click',()=>{if(!current)return;const source=current.origin;close();if(source.isConnected){commitSelect(source,'custom');document.getElementById(source.id+'Custom')?.focus()}});
 layer.addEventListener('click',event=>{if(event.target===layer)close()});
 layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}else if(event.key==='Tab'){const nodes=[layer.querySelector('.wheelCancel'),layer.querySelector('.wheelDone'),...current.columns.map(c=>c.track),layer.querySelector('.wheelManual')];const i=nodes.indexOf(document.activeElement);event.preventDefault();nodes[(i+(event.shiftKey?-1:1)+nodes.length)%nodes.length].focus()}});
})();
