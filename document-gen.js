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
  if (!serverReady || !templates.length) {
    try {
      let { data, error } = await sb
        .from('doc_templates')
        .select('*')
        .eq('workspace_id', currentWorkspace)
        .order('name');
      if (!error && data) {
        templates = data.map(t => ({
          ...t,
          typeInfo: DOC_TYPES[t.type] || { label: t.type, icon: '📄', color: '#888' }
        }));
      }
    } catch (e) {
      console.warn('Doc templates load error:', e.message);
      // Fallback: встроенные шаблоны
      templates = getBuiltInTemplates();
    }
  }
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
    <p>2.1. Стоимость работ: <b>{{money}}</b> ₽.</p>
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
      <tr><th>Подрядчик</th><td>{{company}}</td></tr>
      <tr><th>Проект</th><td>{{object_name}}</td></tr>
      <tr><th>Ответственный</th><td>{{responsible}}</td></tr>
    </table>
  </div>

  <div class="signature">
    <div class="sig-block"><b>Заказчик</b><br><br>__________ / __________</div>
    <div class="sig-block"><b>Подрядчик</b><br><br>__________ / __________</div>
  </div>
</body>
</html>`;
}

function getOfferTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; padding: 30px; }
  .header { background: #2f765d; color: white; padding: 25px; margin: -30px; border-radius: 0; }
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

  <p>Работы выполнены в полном объёме и соответствуют требованиям договора.</p>

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

  <p>Замечаний по качеству и объёму СТОРОНЫ не имеют.</p>

  <div class="signature">
    <div class="sig-block"><b>Заказчик</b><br>Принято<br><br>__________</div>
    <div class="sig-block"><b>Подрядчик</b><br>Выполнено<br><br>__________</div>
  </div>
</body>
</html>`;
}

function getPassportTemplate() {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; padding: 30px; }
  .header { background: #2f765d; color: white; padding: 20px; margin: -30px; }
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
    <tr><th>Длина, мм</th><td>{{length}}</td></tr>
    <tr><th>Ширина, мм</th><td>{{width}}</td></tr>
    <tr><th>Толщина, мм</th><td>{{thickness}}</td></tr>
    <tr><th>Количество, шт</th><td>{{quantity}}</td></tr>
    <tr><th>Материал</th><td>{{material}}</td></tr>
    <tr><th>Проект</th><td>{{object_name}}</td></tr>
    <tr><th>Заказчик</th><td>{{contractor}}</td></tr>
  </table>

  <div class="stamp">КОНТРОЛЬ КАЧЕСТВА — ПРОЙДЕНО ✓</div>
</body>
</html>`;
}

// ============================================
// ГЕНЕРАЦИЯ ДОКУМЕНТА
// ============================================
function fillTemplate(template, project, woodItems) {
  let html = template.content;

  // Базовые переменные из проекта
  const vars = {
    version: Math.floor(Math.random() * 9000) + 1000,
    date: formatRuDate(project.date || new Date()),
    city: 'Москва',
    company: 'ООО "Задачник"',
    company_inn: '7700000000',
    company_kpp: '770001001',
    company_contact: '+7 (000) 000-00-00',
    company_email: 'info@zadachnik.ru',

    // Из проекта
    contractor: project.contractor || 'Не указан',
    object_name: project.name || 'Проект без названия',
    items: project.items || 'Не указано',
    money: formatMoney(project.money || 0),
    advance: formatMoney(project.advance || 0),
    remaining: formatMoney((project.money || 0) - (project.advance || 0)),
    start_date: formatRuDate(project.startDate),
    due_date: formatRuDate(project.date),
    status: project.status || '—',
    progress: (project.progress || 0) + '%',
    responsible: project.responsibleId ? (members.find(m => m.user_id === project.responsibleId)?.display_name || '') : '',

    // Финансы
    money_words: moneyToWords(project.money || 0),
    advance_pct: project.money ? Math.round(((project.advance || 0) / project.money) * 100) : 0,
    vat: 'Без НДС',

    // Для КП
    lead_time: '14 рабочих дней',
    delivery_time: '3 рабочих дня',
    warranty: '24 месяца',

    // Для паспорта
    serial: 'ПАС-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 10000) + 1).toString().padStart(4, '0'),
    item_name: project.name || 'Изделие',
    length: '2000',
    width: '37',
    thickness: '47',
    quantity: '15',
    material: 'Сосна камерной сушки',
    gost: 'ГОСТ 8486-86',
    coating: 'Анодирование / РAL',
    color: 'RAL 7024 Графитовый'
  };

  // Генерация таблицы для КП и Акта
  if (template.type === 'commercial_offer' || template.type === 'act') {
    let tableHtml = generateItemsTable(project, woodItems);
    vars.items_table = tableHtml || '<tr><td colspan="6" style="text-align:center;color:#999;">Нет позиций в спецификации</td></tr>';
  }

  // Подстановка переменных {{var}}
  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });

  return html;
}

function generateItemsTable(project, woodItems) {
  if (!project || !woodItems) return '';

  let items = [];

  // Если есть woodItems — используем их
  if (woodItems && woodItems.length) {
    woodItems.forEach((w, i) => {
      items.push({
        num: i + 1,
        name: w.name || 'Брус / доска',
        qty: w.quantity || 0,
        unit: 'шт',
        price: '',
        total: ''
      });
    });
  } else if (project.items) {
    // Парсим "Предмет договора" если нет woodItems
    const partItems = project.items.split(/[·•,]/).map(s => s.trim()).filter(Boolean);
    partItems.forEach((item, i) => {
      items.push({
        num: i + 1,
        name: item,
        qty: '—',
        unit: 'шт',
        price: '',
        total: ''
      });
    });
  }

  if (!items.length) return '';

  let html = '<table>\n';
  html += '<tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr>\n';
  items.forEach(item => {
    html += `<tr><td>${item.num}</td><td>${esc(item.name)}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.price || '—'}</td><td>${item.total || '—'}</td></tr>\n`;
  });
  html += '</table>';
  return html;
}

// ============================================
// ПРЕВЬЮ И ПЕЧАТЬ
// ============================================
function previewDocument(projectId, template) {
  let project = data.find(p => p.id === projectId);
  if (!project) return;

  let woodItems = wood.filter(w => w.projectId === projectId);
  let html = fillTemplate(template, project, woodItems);

  let win = window.open('', '_blank', 'width=900,height=700');
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
      <button class="close" onclick="closeModal()">×</button>
      <h2>📄 Генерация документов</h2>
      <p class="tapHint">Выберите документ для «${esc(project.name)}»</p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:15px 0;">
    `;

    templates.forEach(t => {
      let info = t.typeInfo || DOC_TYPES[t.type] || { label: t.name, icon: '📄', color: '#888' };
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

      <div style="margin-top:15px;padding:10px 12px;background:#f8faf9;border:1px solid #d7e4dc;border-radius:10px;font-size:11px;color:#667;">
        <b>ℹ️ Переменные:</b> {{contractor}}, {{object_name}}, {{items}}, {{money}}, {{advance}}, {{start_date}}, {{due_date}}, {{responsible}} и др.
      </div>

      <div class="actions" style="margin-top:15px;">
        <button class="btn secondary" onclick="closeModal()">Закрыть</button>
      </div>
    `;

    $('sheet').innerHTML = html;
    $('modal').classList.add('on');
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
  n = Math.round(n || 0);
  if (n === 0) return 'ноль рублей 00 копеек';
  return n + ' рублей'; // Упрощённо, можно расширить
}

// esc() берётся из app.js

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
// Интеграция с существующим интерфейсом
// Кнопка "Документы" в карточке проекта (detail)
(function integrateDocGenerator() {
  // Сохраняем оригинальный detail
  const _originalDetail = window.detail;

  // Переопределяем
  window.detail = async function(id) {
    // Вызываем оригинальный detail
    if (_originalDetail) await _originalDetail(id);

    // После рендера добавляем кнопку
    setTimeout(() => {
      let container = document.querySelector('.sheet .actions:last-child');
      if (!container) {
        // Если не нашли actions, ищем модальное окно
        container = document.querySelector('.sheet');
      }
      if (container && !document.getElementById('docGenBtn')) {
        let btn = document.createElement('button');
        btn.id = 'docGenBtn';
        btn.className = 'btn';
        btn.style.cssText = 'display:block;width:100%;margin-top:9px;text-align:center;';
        btn.textContent = '📄 Генерация документов';
        btn.onclick = () => openDocGenerator(id);
        container.appendChild(btn);
      }
    }, 150);
  };

  // Загружаем шаблоны при старте если сервер доступен
  setTimeout(() => {
    if (typeof serverReady !== 'undefined' && serverReady) {
      loadTemplates();
    }
  }, 2000);
})();
