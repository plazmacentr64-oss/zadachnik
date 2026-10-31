// ============================================
// Документогенерация v1
// ============================================
// Шаблоны документов → подстановка переменных → генерация HTML
// Шаблоны: Договор, КП, Акт, Паспорт изделия

'use strict';

let templates = [];
let docVersions = [];

// Типы документов
const DOC_TYPES = {
  contract: { label: 'Договор подряда', icon: '📋', color: '#2f765d' },
  commercial_offer: { label: 'Коммерческое предложение', icon: '💼', color: '#3b6e9a' },
  act: { label: 'Акт выполненных работ', icon: '✅', color: '#8b692a' },
  passport: { label: 'Паспорт изделия', icon: '📦', color: '#6b4f8a' }
};

// ============================================
// ЗАГРУЗКА ШАБЛОНОВ
// ============================================
async function loadTemplates() {
  // Шаблоны встроены в приложение (таблицы doc_templates в базе нет)
  if (!templates.length) templates = getBuiltInTemplates();
}

// Встроенные шаблоны (fallback)
function getBuiltInTemplates() {
  return [
    {
      id: 'builtin_contract',
      name: 'Договор подряда',
      type: 'contract',
      typeInfo: DOC_TYPES.contract,
      content: getContractTemplate()
    },
    {
      id: 'builtin_offer',
      name: 'Коммерческое предложение',
      type: 'commercial_offer',
      typeInfo: DOC_TYPES.commercial_offer,
      content: getOfferTemplate()
    },
    {
      id: 'builtin_act',
      name: 'Акт выполненных работ',
      type: 'act',
      typeInfo: DOC_TYPES.act,
      content: getActTemplate()
    },
    {
      id: 'builtin_passport',
      name: 'Паспорт изделия',
      type: 'passport',
      typeInfo: DOC_TYPES.passport,
      content: getPassportTemplate()
    }
  ];
}

// ============================================
// ШАБЛОНЫ ДОКУМЕНТОВ (HTML с {{переменные}})
// ============================================
function getContractTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 40px; }
  .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 30px 0 10px; }
  .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 25px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11pt; }
  .section { margin: 18px 0; }
  .section-title { font-weight: bold; margin: 12px 0 6px; }
  p { margin: 6px 0; }
  .signature { display: flex; justify-content: space-between; margin-top: 50px; }
  .sig-block { width: 45%; border-top: 1px solid #000; padding-top: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 10pt; }
  th { background: #f5f5f5; }
</style></head>
<body>
  <div class="title">ДОГОВОР ПОДРЯДА № {{version}}</div>
  <div class="subtitle">на выполнение строительно-монтажных работ</div>

  <div class="meta">
    <span>г. {{city}}</span>
    <span>{{date}}</span>
  </div>

  <p><b>Заказчик:</b> {{contractor}}</p>
  <p><b>Подрядчик:</b> {{company}}</p>

  <div class="section">
    <div class="section-title">1. ПРЕДМЕТ ДОГОВОРА</div>
    <p>1.1. Подрядчик выполняет, а Заказчик принимает работы по проекту «<b>{{object_name}}</b>».</p>
    <p>1.2. Предмет работ: {{items}}</p>
  </div>

  <div class="section">
    <div class="section-title">2. СТОИМОСТЬ</div>
    <p>2.1. Стоимость работ: <b>{{money}}</b> ₽ ({{money_words}}), {{vat}}.</p>
    <p>2.2. Аванс: {{advance}} ₽.</p>
    <p>2.3. Остаток: {{remaining}} ₽.</p>
  </div>

  <div class="section">
    <div class="section-title">3. СРОКИ</div>
    <p>3.1. Начало: {{start_date}}</p>
    <p>3.2. Окончание: {{due_date}}</p>
  </div>

  <div class="section">
    <div class="section-title">4. РЕКВИЗИТЫ</div>
    <table>
      <tr><th style="width:45%">Заказчик</th><td>{{contractor}}</td></tr>
      <tr><th>Подрядчик</th><td>{{company}}<br>ИНН {{company_inn}} КПП {{company_kpp}} ОГРН {{company_ogrn}}<br>{{company_address}}<br>р/с {{company_account}} в {{company_bank}}, БИК {{company_bik}}, к/с {{company_corr}}<br>{{company_contact}}</td></tr>
      <tr><th>Объект</th><td>{{object_name}}</td></tr>
    </table>
  </div>

  <div class="signature">
    <div class="sig-block"><b>Заказчик</b><br><br>__________ / __________</div>
    <div class="sig-block"><b>Подрядчик</b><br>{{company}}<br><br>__________ / {{director}}</div>
  </div>
</body>
</html>`;
}

function getOfferTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; padding: 30px; }
  .header { background: #2f765d; color: white; padding: 25px; margin: -30px -30px 24px; border-radius: 0; }
  .header h1 { margin: 0; font-size: 18pt; }
  .header p { margin: 5px 0 0; opacity: 0.9; }
  .title { font-size: 14pt; font-weight: bold; margin: 25px 0 15px; color: #2f765d; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f8f8f8; font-weight: bold; }
  .total { text-align: right; font-size: 14pt; font-weight: bold; color: #2f765d; margin: 15px 0; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9pt; color: #888; }
  .valid { text-align: center; color: #666; margin: 15px 0; font-style: italic; }
</style></head>
<body>
  <div class="header">
    <h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
    <p>от {{company}} | № {{version}} от {{date}}</p>
  </div>

  <p><b>Для:</b> {{contractor}}</p>
  <p><b>Проект:</b> {{object_name}}</p>

  <div class="title">Предлагаемые изделия и работы</div>

  <table>
    <tr>
      <th>№</th>
      <th>Наименование</th>
      <th>Кол-во</th>
      <th>Ед.</th>
      <th>Цена, ₽</th>
      <th>Сумма, ₽</th>
    </tr>
    {{items_table}}
    <tr style="font-weight:bold;">
      <td colspan="5" style="text-align:right;">ИТОГО:</td>
      <td>{{money}} ₽</td>
    </tr>
  </table>

  <div class="valid">Предложение действительно 14 календарных дней.</div>

  <p><b>Условия:</b></p>
  <p>• Срок изготовления: {{lead_time}}</p>
  <p>• Доставка: {{delivery_time}}</p>
  <p>• Гарантия: {{warranty}}</p>
  <p>• Аванс: {{advance_pct}}%</p>

  <div class="footer">
    <p>{{company}} | {{company_contact}}</p>
  </div>
</body>
</html>`;
}

function getActTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 40px; }
  .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 30px 0; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  .signature { display: flex; justify-content: space-between; margin-top: 50px; }
  .sig-block { width: 45%; border-top: 1px solid #000; padding-top: 10px; }
</style></head>
<body>
  <div class="title">АКТ ВЫПОЛНЕННЫХ РАБОТ № {{version}}</div>
  <div class="meta"><span>г. {{city}}</span><span>{{date}}</span></div>

  <p><b>Заказчик:</b> {{contractor}}</p>
  <p><b>Подрядчик:</b> {{company}}</p>
  <p><b>Проект:</b> {{object_name}}</p>

  <p>Работы по договору выполнены, изделия поставлены и смонтированы в объёме, указанном ниже.</p>

  <table>
    <tr>
      <th>№</th>
      <th>Наименование</th>
      <th>Кол-во</th>
      <th>Ед.</th>
      <th>Сумма, ₽</th>
    </tr>
    {{items_table}}
    <tr style="font-weight:bold;">
      <td colspan="4" style="text-align:right;">ИТОГО:</td>
      <td>{{money}} ₽</td>
    </tr>
  </table>

  <p>Всего выполнено работ и поставлено изделий на сумму: <b>{{money}} ₽</b> ({{money_words}}), {{vat}}.</p>
  <p>Замечаний по качеству и объёму СТОРОНЫ не имеют.</p>

  <div class="signature">
    <div class="sig-block"><b>Заказчик</b><br>Принято<br><br>__________</div>
    <div class="sig-block"><b>Подрядчик</b><br>{{company}}<br>Выполнено<br><br>__________ / {{director}}</div>
  </div>
</body>
</html>`;
}

function getPassportTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; padding: 30px; }
  .header { background: #2f765d; color: white; padding: 20px; margin: -30px -30px 24px; }
  .header h1 { margin: 0; font-size: 16pt; }
  .meta { display: flex; gap: 20px; margin: 15px 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 10pt; }
  th { background: #f8f8f8; width: 40%; }
  .stamp { text-align: center; margin-top: 30px; padding: 15px; border: 2px solid #2f765d; color: #2f765d; font-weight: bold; font-size: 12pt; }
</style></head>
<body>
  <div class="header">
    <h1>ПАСПОРТ ИЗДЕЛИЯ</h1>
    <p>{{object_name}} | {{company}}</p>
  </div>

  <div class="meta">
    <span>Серийный номер: <b>{{serial}}</b></span>
    <span>Дата: <b>{{date}}</b></span>
  </div>

  <table>
    <tr><th>Наименование</th><td>{{item_name}}</td></tr>
    <tr><th>Состав поставки</th><td>{{items}}</td></tr>
    <tr><th>Материал / покрытие</th><td>________________________</td></tr>
    <tr><th>Гарантия</th><td>{{warranty}}</td></tr>
    <tr><th>Проект</th><td>{{object_name}}</td></tr>
    <tr><th>Заказчик</th><td>{{contractor}}</td></tr>
  </table>

  <p style="margin-top:30px">ОТК: __________ / __________ &nbsp;&nbsp; Дата: __________</p>
</body>
</html>`;
}

// ============================================
// ГЕНЕРАЦИЯ ДОКУМЕНТА
// ============================================
function fillTemplate(template, project) {
  let html = template.content;
  const c = (typeof companyInfo === 'object' && companyInfo) || {};
  const blank = '________';
  const paid = typeof received === 'function' ? received(project) : 0;
  const total = +project.money || 0;
  const now = new Date();
  const docNo = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(project.id || '').replace(/-/g, '').slice(0, 4).toUpperCase();
  const tax = c.tax || 'УСН (без НДС)';
  const rate = (tax.match(/(\d+)%/) || [])[1];
  const vat = rate ? `в т.ч. НДС ${rate}% — ${formatMoney(total * rate / (100 + +rate))} ₽` : 'НДС не облагается (УСН)';
  const raw = {
    version: docNo,
    date: formatRuDate(localISO()),
    city: c.city || blank,
    company: c.name || 'Наименование подрядчика не заполнено',
    company_inn: c.inn || blank, company_kpp: c.kpp || blank, company_ogrn: c.ogrn || blank,
    company_address: c.address || blank, company_bank: c.bank || blank, company_bik: c.bik || blank,
    company_account: c.account || blank, company_corr: c.corr || blank,
    company_contact: [c.phone, c.email].filter(Boolean).join(', ') || blank,
    company_email: c.email || blank,
    director: c.director || blank,
    contractor: project.contractor || 'Не указан',
    object_name: project.name || 'Объект без названия',
    items: (project.items || '').trim() || 'Не указано',
    money: formatMoney(total),
    advance: formatMoney(paid),
    remaining: formatMoney(Math.max(0, total - paid)),
    start_date: formatRuDate(project.startDate),
    due_date: formatRuDate(project.date),
    status: project.status || '—',
    progress: (project.progress || 0) + '%',
    responsible: project.responsibleId ? (members.find(m => m.user_id === project.responsibleId)?.display_name || '') : '',
    money_words: moneyToWords(total),
    advance_pct: total ? Math.round(paid / total * 100) : 0,
    vat,
    lead_time: '14 рабочих дней',
    delivery_time: '3 рабочих дня',
    warranty: '24 месяца',
    serial: 'ПАС-' + docNo,
    item_name: project.name || 'Изделие'
  };
  const vars = {};
  for (const k in raw) vars[k] = esc(raw[k]);
  if (template.type === 'commercial_offer' || template.type === 'act') {
    vars.items_table = generateItemsTable(project, template.type === 'act' ? 5 : 6) ||
      `<tr><td colspan="${template.type === 'act' ? 5 : 6}" style="text-align:center;color:#999;">Предмет договора не заполнен</td></tr>`;
  }
  html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] !== undefined ? vars[key] : '');
  return html;
}

function generateItemsTable(project, cols) {
  // Строки таблицы из «Предмета договора»: «Лавочки 80 · Урны 80 шт»
  const parts = String(project.items || '').trim().split(/\s*[·•;\n]\s*|,\s+(?=\D)/).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return '';
  return parts.map((part, i) => {
    const m = part.match(/^(.*?)[\s—-]*(\d+(?:[.,]\d+)?)\s*(шт|компл|кв\.?\s?м|м2|м²|п\.?\s?м|м)?\.?$/i);
    const name = m && m[1] ? m[1] : part, qty = m && m[1] ? m[2] : '', unit = (m && m[3]) || 'шт';
    const priceCols = cols === 6 ? '<td></td><td></td>' : '<td></td>';
    return `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${esc(qty)}</td><td>${esc(unit)}</td>${priceCols}</tr>`;
  }).join('\n');
}

// ============================================
// ПРЕВЬЮ И ПЕЧАТЬ
// ============================================
function previewDocument(projectId, template) {
  let project = data.find(p => p.id === projectId);
  if (!project) return;

  let html = fillTemplate(template, project);
  html = html.replace('<body>', '<body><div class="noprint" style="background:#fff;padding:8px 0;margin:-20px 0 34px;border-bottom:1px solid #ddd;position:relative;z-index:5"><button onclick="print()" style="font-size:14px;padding:8px 16px">🖨 Печать / сохранить в PDF</button></div>').replace('</style>', '@media print{.noprint{display:none}}</style>');
  let win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для этого сайта.');
  win.document.write(html);
  win.document.close();
  win.focus();
}

// ============================================
// МОДАЛЬНОЕ ОКНО ДОКУМЕНТОВ (встроено в CRM)
// ============================================
function openDocGenerator(projectId) {
  let project = data.find(p => p.id === projectId);
  if (!project) return;

  loadTemplates().then(() => {
    let html = `
      <button class="close" onclick="closeModal()" aria-label="Закрыть">×</button>
      <h2>📄 Генерация документов</h2>
      <p class="tapHint">Выберите документ для «${esc(project.name)}»</p>
      ${(typeof companyInfo==='object'&&companyInfo.name)?'':'<div class="woodNotice">Реквизиты фирмы не заполнены — откройте «Команда» → «Реквизиты фирмы».</div>'}

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:15px 0;">
    `;

    templates.forEach(t => {
      let info = t.typeInfo || DOC_TYPES[t.type] || { label: t.name, icon: '📄', color: '#888' };
      if (t.type === 'act' && project.status !== 'Выполнено') {
        html += `<div style="border:1px dashed #c9d6cf;border-radius:12px;padding:14px;text-align:center;color:#56655f;"><div style="font-size:24px;margin-bottom:6px;">${info.icon}</div><div style="font-weight:700;font-size:12px;">${info.label}</div><div style="font-size:11px;margin-top:4px;">Доступен, когда объект выполнен</div></div>`;
        return;
      }
      html += `
        <div style="border:1px solid #d7e4dc;border-radius:12px;padding:14px;cursor:pointer;text-align:center;transition:all .15s;"
             onmouseover="this.style.borderColor='${info.color}';this.style.boxShadow='0 2px 8px #0002'"
             onmouseout="this.style.borderColor='#d7e4dc';this.style.boxShadow='none'"
             onclick="previewDocument('${projectId}', templates.find(x=>x.id==='${t.id}'))">
          <div style="font-size:24px;margin-bottom:6px;">${info.icon}</div>
          <div style="font-weight:700;font-size:12px;color:#333;">${info.label}</div>
          <div style="font-size:9px;color:#888;margin-top:4px;">Откроется в новой вкладке</div>
        </div>
      `;
    });

    html += `
      </div>


      <div class="actions" style="margin-top:15px;">
        <button class="btn secondary" onclick="detail('${projectId}')">← К объекту</button>
      </div>
    `;

    $('sheet').innerHTML = html;
    currentDetail = null;
    openModal();
  });
}

// ============================================
// УТИЛИТЫ
// ============================================
function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
}

function formatRuDate(dateStr) {
  if (!dateStr) return '«__» ________ ____ г.';
  let d = new Date(dateStr + 'T12:00:00');
  let months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `«${d.getDate()}» ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

function moneyToWords(n) {
  n = Math.round(+n || 0);
  const ones = [['','один','два','три','четыре','пять','шесть','семь','восемь','девять'],['','одна','две','три','четыре','пять','шесть','семь','восемь','девять']];
  const teens = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tens = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  const units = [[['рубль','рубля','рублей'],0],[['тысяча','тысячи','тысяч'],1],[['миллион','миллиона','миллионов'],0],[['миллиард','миллиарда','миллиардов'],0],[['триллион','триллиона','триллионов'],0]];
  const plural = (x, f) => { x %= 100; if (x > 10 && x < 20) return f[2]; x %= 10; return x === 1 ? f[0] : (x >= 2 && x <= 4 ? f[1] : f[2]); };
  if (n === 0) return 'ноль рублей 00 копеек';
  const out = []; let i = 0, rest = n;
  while (rest > 0 && i < units.length) {
    const tri = rest % 1000, [forms, fem] = units[i];
    if (tri || i === 0) {
      const w = [hundreds[Math.floor(tri / 100)]], d = tri % 100;
      if (d >= 10 && d < 20) w.push(teens[d - 10]); else { w.push(tens[Math.floor(d / 10)]); w.push(ones[fem][d % 10]); }
      w.push(plural(tri, forms));
      out.unshift(w.filter(Boolean).join(' '));
    }
    rest = Math.floor(rest / 1000); i++;
  }
  const t = out.join(' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + ' 00 копеек';
}

// esc() берётся из app.js

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
// Интеграция с существующим интерфейсом
// Кнопка "Документы" в карточке проекта (detail)
// Кнопка «Документы» встроена в карточку объекта (app.js → detail)
