'use strict';
// Разбор прайса металла (формат «ООО ЦЕХ»: 4 колонки-блока). Работает и в браузере (SheetJS), и в node.
(function(root){
 const MONTHS={январ:1,феврал:2,март:3,апрел:4,мая:5,май:5,июн:6,июл:7,август:8,сентябр:9,октябр:10,ноябр:11,декабр:12};
 const BLOCKS=[[0,5],[6,10],[11,16],[17,21]];
 const txt=v=>v==null?'':String(v).replace(/\s+/g,' ').trim();
 // «63 000р.» → 63000, «8 742,0р.» → 8742, «165,88р.» → 165.88
 function n(v){if(typeof v==='number')return isFinite(v)?v:null;let s=txt(v).replace(/р\.?|₽/gi,'').replace(/[\s ]/g,'');if(!/^\d+([.,]\d+)?$/.test(s))return null;return parseFloat(s.replace(',','.'))}
 const cap=s=>{s=s.toLowerCase();s=s.charAt(0).toUpperCase()+s.slice(1);return s==='Угол'?'Уголок':s};
 const nums=s=>(txt(s).replace(/(\d)\s*[,.]\s*(\d)/g,'$1.$2').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
 function sheetDims(name){const a=nums(txt(name).replace(/\s*ст\.?\s*[\dА-Яа-яA-Za-z]+\s*$/,''));if(a.length<3)return {};let t=a[0],w=a[a.length-2],l=a[a.length-1];if(w<20)w=Math.round(w*1000);if(l<20)l=Math.round(l*1000);if(w>l)[w,l]=[l,w];return {thickness:t,sheet_w:w,sheet_l:l}}
 function stockLen(v){const a=nums(v);if(!a.length)return null;const m=a[0];return m>0&&m<=13?Math.round(m*1000):null}
 const prettyName=s=>txt(s).replace(/(\d)\s*[xх*]\s*(?=\d)/gi,'$1×').replace(/\s*×\s*/g,'×');
 function parsePriceRows(rows){
  let supplier='',date=null;const items=[];
  for(const r of rows.slice(0,4))for(const c of r||[]){const s=txt(c);if(!supplier&&/^(ООО|ИП|АО|ЗАО)\s/i.test(s))supplier=s.replace(/\s+/g,' ');const m=s.match(/(\d{1,2})\s+([а-я]+)\s+(\d{4})/i);if(!date&&m){const k=Object.keys(MONTHS).find(k=>m[2].toLowerCase().startsWith(k));if(k)date=`${m[3]}-${String(MONTHS[k]).padStart(2,'0')}-${m[1].padStart(2,'0')}`}}
  BLOCKS.forEach(([a,b],bi)=>{let cat='',sort=bi*1000;
   for(let i=3;i<rows.length;i++){const cells=(rows[i]||[]).slice(a,b+1),texts=cells.map(txt),filled=texts.filter(Boolean);if(!filled.length)continue;
    const ni=texts[0]?0:(texts[1]&&/[а-я]{3}/i.test(texts[1])&&filled.length>1?1:0),name=texts[ni];if(/^наименование/i.test(name))continue;
    const vals=cells.slice(ni+1).map(n),tonIdx=vals.findIndex(v=>v!=null&&v>=20000&&v<=500000);
    const anyPrice=vals.some(v=>v!=null&&v>0);
    if(!name&&filled.length===1&&!anyPrice){cat=filled[0];continue}           // «УГОЛ» в соседней колонке
    if(name&&filled.length===1&&!/\d/.test(name)){cat=name;continue}          // заголовок раздела
    if(!name)continue;
    const c=cap(cat||'Прочее'),isSheet=/^лист/i.test(cat);
    let it=null;
    if(tonIdx>=0){const unitP=vals[tonIdx+1],k=vals[tonIdx+2];if(!(unitP>0))continue;
     if(isSheet){const d=sheetDims(name);if(!d.sheet_w)continue;it={kind:'sheet',unit:'лист',...d,kg_unit:k||null}}
     else it={kind:'linear',unit:'м',stock_len_mm:stockLen(texts[ni+tonIdx])||6000,kg_unit:k||null};
     Object.assign(it,{price_ton:vals[tonIdx],base_price:Math.round(unitP*100)/100})}
    else{const p=vals.filter(v=>v!=null&&v>=10).pop();if(!(p>0))continue;const unit=/электрод/i.test(cat)?'уп':'шт';it={kind:'piece',unit,price_ton:null,base_price:p,kg_unit:null}}
    items.push({category:c,name:prettyName(name),...it,price:it.base_price,sort:sort++});
   }});
  return {supplier,date,items};
 }
 root.parsePriceRows=parsePriceRows;
 if(typeof module!=='undefined')module.exports={parsePriceRows};
})(typeof window!=='undefined'?window:globalThis);
