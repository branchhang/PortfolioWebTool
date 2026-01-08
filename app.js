const STORAGE_KEY = 'portfolio-tool-data';
const CURRENCIES = ['CNY', 'HKD', 'USD'];
const clone = typeof structuredClone === 'function' ? structuredClone : (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_DATA = {
  settings: {
    baseCurrency: 'CNY',
    hideAmounts: false,
    pnlMode: 'amount',
    structureView: 'bar',
    accountFilter: [],
    fxRates: {
      CNY: 1,
      HKD: 1,
      USD: 1
    },
    lastRateFetch: null,
    lastRateOk: true,
    lastRateSource: '',
    lastQuoteFetch: null,
    lastQuoteOk: true
  },
  accounts: [],
  history: []
};

const ui = {
  refreshQuotes: document.querySelector('#refreshQuotes'),
  quoteStatus: document.querySelector('#quoteStatus'),
  rateStatus: document.querySelector('#rateStatus'),
  toggleVisibility: document.querySelector('#toggleVisibility'),
  pnlModeToggle: document.querySelector('#pnlModeToggle'),
  structureToggle: document.querySelector('#structureToggle'),
  structureBars: document.querySelector('#structureBars'),
  structurePies: document.querySelector('#structurePies'),
  accountPnlTable: document.querySelector('#accountPnlTable'),
  accountPie: document.querySelector('#accountPie'),
  assetPie: document.querySelector('#assetPie'),
  accountPieLegend: document.querySelector('#accountPieLegend'),
  assetPieLegend: document.querySelector('#assetPieLegend'),
  accountFilters: document.querySelector('#accountFilters'),
  openAccountModal: document.querySelector('#openAccountModal'),
  openHoldingModal: document.querySelector('#openHoldingModal'),
  accountModal: document.querySelector('#accountModal'),
  holdingModal: document.querySelector('#holdingModal'),
  refreshRates: document.querySelector('#refreshRates'),
  dashboard: document.querySelector('#dashboard'),
  assetChart: document.querySelector('#assetChart'),
  pnlChart: document.querySelector('#pnlChart'),
  accountDistribution: document.querySelector('#accountDistribution'),
  assetDistribution: document.querySelector('#assetDistribution'),
  accountList: document.querySelector('#accountList'),
  accountForm: document.querySelector('#accountForm'),
  accountId: document.querySelector('#accountId'),
  accountName: document.querySelector('#accountName'),
  resetAccountForm: document.querySelector('#resetAccountForm'),
  holdingForm: document.querySelector('#holdingForm'),
  holdingId: document.querySelector('#holdingId'),
  holdingAccount: document.querySelector('#holdingAccount'),
  holdingCode: document.querySelector('#holdingCode'),
  holdingCategory: document.querySelector('#holdingCategory'),
  holdingFundInputs: document.querySelector('#holdingFundInputs'),
  holdingStockInputs: document.querySelector('#holdingStockInputs'),
  holdingQuantity: document.querySelector('#holdingQuantity'),
  holdingCostPrice: document.querySelector('#holdingCostPrice'),
  holdingAmount: document.querySelector('#holdingAmount'),
  holdingProfit: document.querySelector('#holdingProfit'),
  holdingCost: document.querySelector('#holdingCost'),
  holdingShares: document.querySelector('#holdingShares'),
  holdingReturn: document.querySelector('#holdingReturn'),
  holdingSearch: document.querySelector('#holdingSearch'),
  holdingName: document.querySelector('#holdingName'),
  holdingCurrency: document.querySelector('#holdingCurrency'),
  holdingPrice: document.querySelector('#holdingPrice'),
  resetHoldingForm: document.querySelector('#resetHoldingForm'),
  holdingList: document.querySelector('#holdingList'),
  backupData: document.querySelector('#backupData'),
  restoreData: document.querySelector('#restoreData'),
  navButtons: Array.from(document.querySelectorAll('.bottom-nav button')),
  pages: Array.from(document.querySelectorAll('.page'))
};

let state = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(DEFAULT_DATA);
    }
    const parsed = JSON.parse(raw);
    return {
      settings: {
        ...DEFAULT_DATA.settings,
        ...(parsed.settings || {})
      },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (error) {
    return clone(DEFAULT_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: state.settings.baseCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(value || 0);
}

function formatPercent(value) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(value || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

function maskValue(text) {
  return state.settings.hideAmounts ? '****' : text;
}

function formatCurrencyDisplay(value) {
  return maskValue(formatCurrency(value));
}

function formatNumberDisplay(value) {
  return maskValue(formatNumber(value));
}

function formatPercentDisplay(value) {
  return maskValue(formatPercent(value));
}

function formatPnlDisplay(value, base) {
  if (state.settings.pnlMode === 'percent') {
    const rate = base > 0 ? value / base : 0;
    return formatPercentDisplay(rate);
  }
  return formatCurrencyDisplay(value);
}

function getPnlClass(value) {
  if (value > 0) {
    return 'pnl-positive';
  }
  if (value < 0) {
    return 'pnl-negative';
  }
  return '';
}

function toBaseCurrency(amount, currency) {
  const rate = state.settings.fxRates[currency] || 1;
  return amount * rate;
}

function isFundHolding(holding) {
  const category = String(holding.category || '').toLowerCase();
  return holding.source === 'fund' || category.includes('基金');
}

function getHoldingValue(holding) {
  if (isFundHolding(holding)) {
    const amount = Number(holding.amount);
    if (!Number.isNaN(amount)) {
      return amount;
    }
  }
  const quantity = Number(holding.quantity);
  const price = Number(holding.lastPrice);
  if (!Number.isNaN(quantity) && !Number.isNaN(price)) {
    return quantity * price;
  }
  const amount = Number(holding.amount);
  if (!Number.isNaN(amount)) {
    return amount;
  }
  return 0;
}

function getHoldingProfit(holding) {
  if (isFundHolding(holding)) {
    const profit = Number(holding.profit);
    if (!Number.isNaN(profit)) {
      return profit;
    }
  }
  const value = getHoldingValue(holding);
  const cost = getHoldingCost(holding);
  if (!Number.isNaN(value) && !Number.isNaN(cost)) {
    return value - cost;
  }
  const profit = Number(holding.profit);
  if (!Number.isNaN(profit)) {
    return profit;
  }
  return 0;
}

function getHoldingCost(holding) {
  if (isFundHolding(holding)) {
    const amount = Number(holding.amount);
    const profit = Number(holding.profit);
    if (!Number.isNaN(amount) && !Number.isNaN(profit)) {
      return amount - profit;
    }
  }
  const quantity = Number(holding.quantity);
  const costPrice = Number(holding.costPrice);
  if (!Number.isNaN(quantity) && !Number.isNaN(costPrice)) {
    return quantity * costPrice;
  }
  const cost = Number(holding.cost);
  if (!Number.isNaN(cost)) {
    return cost;
  }
  return 0;
}

function normalizeSymbol(code) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('.') || trimmed.startsWith('^')) {
    return trimmed;
  }
  if (/^(SH|SZ)[0-9]{6}$/.test(trimmed)) {
    const suffix = trimmed.startsWith('SH') ? 'SS' : 'SZ';
    return `${trimmed.slice(2)}.${suffix}`;
  }
  if (/^HK[0-9]{1,5}$/.test(trimmed)) {
    return `${trimmed.slice(2).padStart(4, '0')}.HK`;
  }
  if (/^[0-9]{6}$/.test(trimmed)) {
    return trimmed.startsWith('6') ? `${trimmed}.SS` : `${trimmed}.SZ`;
  }
  if (/^[0-9]{1,5}$/.test(trimmed)) {
    return `${trimmed.padStart(4, '0')}.HK`;
  }
  return trimmed;
}

function computeTotals() {
  return state.accounts.reduce(
    (acc, account) => {
      (account.holdings || []).forEach((holding) => {
        const value = getHoldingValue(holding);
        const cost = getHoldingCost(holding);
        const currency = holding.currency || state.settings.baseCurrency;
        acc.assets += toBaseCurrency(value, currency);
        acc.cost += toBaseCurrency(cost, currency);
      });
      return acc;
    },
    { assets: 0, cost: 0, pnl: 0 }
  );
}

function computeAccountSummaries() {
  return state.accounts.map((account) => {
    const summary = (account.holdings || []).reduce(
      (acc, holding) => {
        const value = getHoldingValue(holding);
        const cost = getHoldingCost(holding);
        const currency = holding.currency || state.settings.baseCurrency;
        acc.assets += toBaseCurrency(value, currency);
        acc.cost += toBaseCurrency(cost, currency);
        return acc;
      },
      { assets: 0, cost: 0 }
    );
    return {
      id: account.id,
      name: account.name,
      assets: summary.assets,
      cost: summary.cost,
      pnl: summary.assets - summary.cost
    };
  });
}

function ensureTotals() {
  const totals = computeTotals();
  totals.pnl = totals.assets - totals.cost;
  return totals;
}

function sortHistory() {
  state.history.sort((a, b) => a.date.localeCompare(b.date));
}

function getPreviousSnapshot() {
  const today = getTodayISO();
  sortHistory();
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    if (state.history[i].date < today) {
      return state.history[i];
    }
  }
  return null;
}

function getHistorySeries(includeToday) {
  sortHistory();
  const series = state.history.map((entry) => ({
    label: entry.date,
    assets: entry.totalAssetsBase,
    pnl: entry.totalPnlBase
  }));

  if (includeToday) {
    const today = getTodayISO();
    const last = series[series.length - 1];
    if (!last || last.label !== today) {
      const totals = ensureTotals();
      series.push({
        label: today,
        assets: totals.assets,
        pnl: totals.pnl
      });
    }
  }

  return series;
}

function ensureTodaySnapshot() {
  const today = getTodayISO();
  const totals = ensureTotals();
  const accountAssetsBase = computeAccountSummaries().reduce((acc, item) => {
    acc[item.id] = item.assets;
    return acc;
  }, {});
  const entry = {
    date: today,
    totalAssetsBase: totals.assets,
    totalPnlBase: totals.pnl,
    accountAssetsBase
  };

  const index = state.history.findIndex((item) => item.date === today);
  if (index >= 0) {
    state.history[index] = entry;
  } else {
    state.history.push(entry);
  }

  saveData();
}

function updateDashboard() {
  const totals = ensureTotals();
  const history = getHistorySeries(false);
  const today = getTodayISO();
  const lastEntry = history[history.length - 1];
  const previousEntry = lastEntry && lastEntry.label === today ? history[history.length - 2] : lastEntry;
  const todayPnl = previousEntry ? totals.assets - previousEntry.assets : 0;
  const todayBase = previousEntry ? previousEntry.assets : 0;
  const returnRate = totals.cost > 0 ? totals.pnl / totals.cost : 0;

  const todayValue = formatPnlDisplay(todayPnl, todayBase);
  const totalValue = formatPnlDisplay(totals.pnl, totals.cost);
  const totalSub = state.settings.pnlMode === 'percent'
    ? `累计盈亏 ${formatCurrencyDisplay(totals.pnl)}`
    : `累计收益率 ${formatPercentDisplay(returnRate)}`;
  const todaySub = previousEntry
    ? `较 ${previousEntry.label} ${state.settings.pnlMode === 'percent' ? formatCurrencyDisplay(todayPnl) : formatPercentDisplay(todayBase ? todayPnl / todayBase : 0)}`
    : '等待历史对比';

  const cards = [
    {
      title: '总资产',
      value: formatCurrencyDisplay(totals.assets),
      sub: `${state.accounts.length} 个账户 · ${formatCurrencyDisplay(totals.cost)} 成本`
    },
    {
      title: '今日盈亏',
      value: todayValue,
      sub: todaySub,
      className: getPnlClass(todayPnl)
    },
    {
      title: '累计盈亏',
      value: totalValue,
      sub: totalSub,
      className: getPnlClass(totals.pnl)
    },
    {
      title: '结算币种',
      value: state.settings.baseCurrency,
      sub: '点击切换结算币种',
      action: 'cycleCurrency'
    }
  ];

  ui.dashboard.innerHTML = cards
    .map(
      (card) => `
      <div class="panel ${card.action ? 'clickable' : ''}" ${card.action ? `data-action="${card.action}"` : ''}>
        <h3>${card.title}</h3>
        <div class="value ${card.className || ''}">${card.value}</div>
        <div class="sub">${card.sub}</div>
      </div>
    `
    )
    .join('');
}

function renderAccountPnlTable() {
  if (!ui.accountPnlTable) {
    return;
  }
  const summaries = computeAccountSummaries();
  if (!summaries.length) {
    ui.accountPnlTable.innerHTML = '<div class="helper">暂无账户数据</div>';
    return;
  }
  const previous = getPreviousSnapshot();
  const previousAssets = (previous && previous.accountAssetsBase) || {};
  const hasPrevious = Boolean(previous && previous.accountAssetsBase);
  const gridTemplate = `120px repeat(${summaries.length}, minmax(120px, 1fr))`;

  const headerCells = summaries.map((item) => `<div class="pnl-cell header">${item.name}</div>`).join('');
  const todayCells = summaries
    .map((item) => {
      const base = previousAssets[item.id] || 0;
      const todayPnl = hasPrevious ? item.assets - base : 0;
      return `<div class="pnl-cell ${getPnlClass(todayPnl)}">${formatPnlDisplay(todayPnl, base)}</div>`;
    })
    .join('');
  const totalCells = summaries
    .map((item) => {
      return `<div class="pnl-cell ${getPnlClass(item.pnl)}">${formatPnlDisplay(item.pnl, item.cost)}</div>`;
    })
    .join('');

  ui.accountPnlTable.innerHTML = `
    <div class="pnl-grid" style="grid-template-columns: ${gridTemplate};">
      <div class="pnl-cell header">项目</div>
      ${headerCells}
      <div class="pnl-cell header">当日盈亏</div>
      ${todayCells}
      <div class="pnl-cell header">总盈亏</div>
      ${totalCells}
    </div>
  `;
}

function updateSwitchLabel(label, checked) {
  if (!label) {
    return;
  }
  const text = label.querySelector('.switch-text');
  if (!text) {
    return;
  }
  const onText = text.dataset.on || '';
  const offText = text.dataset.off || '';
  text.textContent = checked ? onText : offText;
}

function syncHeaderControls() {
  if (ui.toggleVisibility) {
    ui.toggleVisibility.textContent = state.settings.hideAmounts ? '🙈' : '👁';
    ui.toggleVisibility.setAttribute('aria-pressed', state.settings.hideAmounts ? 'true' : 'false');
  }
  if (ui.pnlModeToggle) {
    ui.pnlModeToggle.checked = state.settings.pnlMode === 'percent';
    updateSwitchLabel(ui.pnlModeToggle.closest('.switch'), ui.pnlModeToggle.checked);
  }
  if (ui.structureToggle) {
    ui.structureToggle.checked = state.settings.structureView === 'pie';
    updateSwitchLabel(ui.structureToggle.closest('.switch'), ui.structureToggle.checked);
  }
}

function renderLineChart(svg, data, color) {
  const width = 320;
  const height = 180;
  const padding = 20;
  svg.innerHTML = '';

  if (!data.length) {
    svg.innerHTML = '<text x="16" y="96" fill="rgba(255,255,255,0.7)" font-size="12">暂无数据</text>';
    return;
  }

  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = padding + step * index;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return { x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(2)} ${height - padding} Z`;

  const gradientId = `${svg.id}-gradient`;

  const maxLabel = maskValue(formatNumber(max));
  const minLabel = maskValue(formatNumber(min));

  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.4" />
        <stop offset="100%" stop-color="${color}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#${gradientId})" />
    <path d="${path}" fill="none" stroke="${color}" stroke-width="3" />
    <circle cx="${points[points.length - 1].x}" cy="${points[points.length - 1].y}" r="4" fill="${color}" />
    <text x="${padding}" y="${padding}" fill="rgba(255,255,255,0.65)" font-size="11">${maxLabel}</text>
    <text x="${padding}" y="${height - 6}" fill="rgba(255,255,255,0.45)" font-size="11">${minLabel}</text>
  `;
}

function updateCharts() {
  const series = getHistorySeries(true);
  renderLineChart(
    ui.assetChart,
    series.map((item) => ({ label: item.label, value: item.assets })),
    '#ffd166'
  );
  renderLineChart(
    ui.pnlChart,
    series.map((item) => ({ label: item.label, value: item.pnl })),
    '#06d6a0'
  );
}

function renderDistribution(container, items, emptyLabel) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = `<div class="helper">${emptyLabel}</div>`;
    return;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  items
    .sort((a, b) => b.value - a.value)
    .forEach((item) => {
      const percent = item.value / total;
      const node = document.createElement('div');
      node.className = 'dist-item';
      node.innerHTML = `
        <div class="dist-label">
          <span>${item.label}</span>
          <span>${formatCurrencyDisplay(item.value)} · ${formatPercentDisplay(percent)}</span>
        </div>
        <div class="bar"><span style="width:${Math.min(percent * 100, 100).toFixed(1)}%"></span></div>
      `;
      container.appendChild(node);
    });
}

function renderPieChart(svg, legend, items, emptyLabel) {
  if (!svg || !legend) {
    return;
  }
  svg.innerHTML = '';
  legend.innerHTML = '';
  if (!items.length) {
    svg.innerHTML = `<text x="12" y="116" fill="rgba(11,19,32,0.6)" font-size="12">${emptyLabel}</text>`;
    return;
  }
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = ['#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#073b4c', '#8d5cf6', '#f4a261'];
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  items
    .sort((a, b) => b.value - a.value)
    .forEach((item, index) => {
      const percent = item.value / total;
      const dash = percent * circumference;
      const color = colors[index % colors.length];
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '110');
      circle.setAttribute('cy', '110');
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '24');
      circle.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
      circle.setAttribute('stroke-dashoffset', (-offset).toString());
      circle.setAttribute('transform', 'rotate(-90 110 110)');
      svg.appendChild(circle);

      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML = `
        <span class="legend-dot" style="background:${color}"></span>
        <span>${item.label}</span>
        <span>${formatCurrencyDisplay(item.value)} · ${formatPercentDisplay(percent)}</span>
      `;
      legend.appendChild(row);
      offset += dash;
    });
}

function updateDistributions() {
  const accountItems = state.accounts.map((account) => {
    const total = (account.holdings || []).reduce((sum, holding) => {
      const currency = holding.currency || state.settings.baseCurrency;
      return sum + toBaseCurrency(getHoldingValue(holding), currency);
    }, 0);
    return { label: account.name, value: total };
  });
  renderDistribution(ui.accountDistribution, accountItems, '暂无账户数据');

  const categoryTotals = {};
  state.accounts.forEach((account) => {
    (account.holdings || []).forEach((holding) => {
      const category = holding.category || '未分类';
      const currency = holding.currency || state.settings.baseCurrency;
      const value = toBaseCurrency(getHoldingValue(holding), currency);
      categoryTotals[category] = (categoryTotals[category] || 0) + value;
    });
  });

  const categoryItems = Object.entries(categoryTotals).map(([label, value]) => ({ label, value }));
  renderDistribution(ui.assetDistribution, categoryItems, '暂无资产分类');

  renderPieChart(ui.accountPie, ui.accountPieLegend, accountItems, '暂无账户数据');
  renderPieChart(ui.assetPie, ui.assetPieLegend, categoryItems, '暂无资产分类');

  if (ui.structureBars && ui.structurePies) {
    const showPie = state.settings.structureView === 'pie';
    ui.structureBars.classList.toggle('is-hidden', showPie);
    ui.structurePies.classList.toggle('is-hidden', !showPie);
  }
}

function renderAccountList() {
  ui.accountList.innerHTML = '';

  if (!state.accounts.length) {
    ui.accountList.innerHTML = '<div class="helper">还没有账户，先创建账户。</div>';
    return;
  }

  state.accounts.forEach((account) => {
    const total = (account.holdings || []).reduce((sum, holding) => {
      const currency = holding.currency || state.settings.baseCurrency;
      return sum + toBaseCurrency(getHoldingValue(holding), currency);
    }, 0);

    const item = document.createElement('div');
    item.className = 'list-item compact';
    item.innerHTML = `
      <div class="row">
        <strong>${account.name}</strong>
      </div>
      <div class="row">
        <span>${(account.holdings || []).length} 个标的</span>
        <span>${formatCurrencyDisplay(total)}</span>
      </div>
      <div class="row" style="gap:8px;">
        <button type="button" class="ghost" data-action="edit" data-id="${account.id}">编辑</button>
        <button type="button" class="ghost" data-action="delete" data-id="${account.id}">删除</button>
      </div>
    `;

    ui.accountList.appendChild(item);
  });
}

function renderAccountOptions() {
  const selected = ui.holdingAccount.value;
  const options = state.accounts.map((account) => `<option value="${account.id}">${account.name}</option>`);
  ui.holdingAccount.innerHTML = `<option value="">选择账户</option>${options.join('')}`;
  if (selected) {
    ui.holdingAccount.value = selected;
  }
}

function renderAccountFilters() {
  if (!ui.accountFilters) {
    return;
  }
  const availableIds = new Set(state.accounts.map((account) => account.id));
  const selected = Array.isArray(state.settings.accountFilter)
    ? state.settings.accountFilter.filter((id) => availableIds.has(id))
    : [];
  if (selected.length !== state.settings.accountFilter.length) {
    state.settings.accountFilter = selected;
    saveData();
  }
  const allActive = selected.length === 0;
  const buttons = [];
  buttons.push(`<button type="button" class="tag ${allActive ? 'active' : ''}" data-id="all">全部</button>`);
  state.accounts.forEach((account) => {
    const isActive = selected.includes(account.id);
    buttons.push(
      `<button type="button" class="tag ${isActive ? 'active' : ''}" data-id="${account.id}">${account.name}</button>`
    );
  });
  ui.accountFilters.innerHTML = buttons.join('');
}

function renderHoldingsList() {
  ui.holdingList.innerHTML = '';
  const allHoldings = [];
  const selected = Array.isArray(state.settings.accountFilter) ? state.settings.accountFilter : [];
  const filterActive = selected.length > 0;

  state.accounts.forEach((account) => {
    if (filterActive && !selected.includes(account.id)) {
      return;
    }
    (account.holdings || []).forEach((holding) => {
      allHoldings.push({ account, holding });
    });
  });

  if (!allHoldings.length) {
    ui.holdingList.innerHTML = filterActive
      ? '<div class="helper">当前筛选暂无持仓。</div>'
      : '<div class="helper">还没有持仓，先添加标的。</div>';
    return;
  }

  allHoldings.forEach(({ account, holding }) => {
    const price = Number(holding.lastPrice) || 0;
    const value = getHoldingValue(holding);
    const profit = getHoldingProfit(holding);
    const cost = getHoldingCost(holding);
    const currency = holding.currency || state.settings.baseCurrency;
    const storedQuantity = Number(holding.quantity);
    const quantity = Number.isFinite(storedQuantity) && storedQuantity > 0
      ? storedQuantity
      : price > 0 && value
        ? value / price
        : 0;
    const valueBase = toBaseCurrency(value, currency);
    const costBase = toBaseCurrency(cost, currency);
    const pnlBase = toBaseCurrency(profit, currency);
    const returnRate = costBase > 0 ? pnlBase / costBase : 0;
    const pnlMain = state.settings.pnlMode === 'percent'
      ? formatPercentDisplay(returnRate)
      : formatCurrencyDisplay(pnlBase);
    const pnlSub = state.settings.pnlMode === 'percent'
      ? formatCurrencyDisplay(pnlBase)
      : formatPercentDisplay(returnRate);

    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="row">
        <strong>${holding.name || holding.code}</strong>
        <span class="badge">${holding.symbol || holding.code}</span>
      </div>
      <div class="row">
        <span>${account.name} · ${holding.category || '未分类'}</span>
        <span>${formatCurrencyDisplay(valueBase)}</span>
      </div>
      <div class="row">
        <span>最新价 ${formatNumberDisplay(price)} ${currency} · 份额 ${formatNumberDisplay(quantity)}</span>
        <span class="${getPnlClass(pnlBase)}">盈亏 ${pnlMain} · ${pnlSub}</span>
      </div>
      <div class="row" style="gap:8px;">
        <button type="button" class="ghost" data-action="edit" data-account-id="${account.id}" data-id="${holding.id}">编辑</button>
        <button type="button" class="ghost" data-action="delete" data-account-id="${account.id}" data-id="${holding.id}">删除</button>
      </div>
    `;

    ui.holdingList.appendChild(item);
  });
}

function resetAccountForm() {
  ui.accountId.value = '';
  ui.accountName.value = '';
}

function resetHoldingForm() {
  ui.holdingId.value = '';
  ui.holdingAccount.value = '';
  ui.holdingCode.value = '';
  clearHoldingLookup();
  ui.holdingCategory.value = '';
  ui.holdingQuantity.value = '';
  ui.holdingCostPrice.value = '';
  ui.holdingAmount.value = '';
  ui.holdingProfit.value = '';
  ui.holdingCost.value = '';
  ui.holdingShares.value = '';
  ui.holdingReturn.value = '';
  ui.holdingName.value = '';
  ui.holdingCurrency.value = '';
  ui.holdingPrice.value = '';
}

function clearHoldingLookup() {
  delete ui.holdingCode.dataset.symbol;
  delete ui.holdingCode.dataset.name;
  delete ui.holdingCode.dataset.currency;
  delete ui.holdingCode.dataset.price;
  delete ui.holdingCode.dataset.source;
  delete ui.holdingCode.dataset.category;
  ui.holdingName.value = '';
  ui.holdingCurrency.value = '';
  ui.holdingPrice.value = '';
  ui.holdingCategory.value = '';
  applyHoldingMode();
}

function getHoldingMode() {
  const source = ui.holdingCode.dataset.source || '';
  const category = (ui.holdingCode.dataset.category || ui.holdingCategory.value || '').toLowerCase();
  if (source === 'fund') {
    return 'fund';
  }
  if (category.includes('基金')) {
    return 'fund';
  }
  return 'stock';
}

function applyHoldingMode() {
  const mode = getHoldingMode();
  if (ui.holdingFundInputs) {
    ui.holdingFundInputs.classList.toggle('is-hidden', mode !== 'fund');
  }
  if (ui.holdingStockInputs) {
    ui.holdingStockInputs.classList.toggle('is-hidden', mode !== 'stock');
  }
  ui.holdingAmount.readOnly = mode !== 'fund';
  ui.holdingProfit.readOnly = mode !== 'fund';
  ui.holdingAmount.required = mode === 'fund';
  ui.holdingProfit.required = mode === 'fund';
  if (ui.holdingQuantity) {
    ui.holdingQuantity.readOnly = mode !== 'stock';
    ui.holdingQuantity.required = mode === 'stock';
  }
  if (ui.holdingCostPrice) {
    ui.holdingCostPrice.readOnly = mode !== 'stock';
    ui.holdingCostPrice.required = mode === 'stock';
  }
  if (mode === 'fund') {
    ui.holdingQuantity.value = '';
    ui.holdingCostPrice.value = '';
  }
  updateDerivedHolding();
}

function updateDerivedHolding() {
  const price = Number(ui.holdingPrice.value);
  const mode = getHoldingMode();
  const amountInput = Number(ui.holdingAmount.value);
  const profitInput = Number(ui.holdingProfit.value);
  const quantityInput = Number(ui.holdingQuantity.value);
  const costPriceInput = Number(ui.holdingCostPrice.value);

  let amount = NaN;
  let profit = NaN;
  let cost = NaN;
  let shares = NaN;
  let returnRate = NaN;

  if (mode === 'fund') {
    if (!Number.isNaN(amountInput)) {
      amount = amountInput;
    }
    if (!Number.isNaN(profitInput)) {
      profit = profitInput;
    }
    cost = Number.isFinite(amount) && Number.isFinite(profit) ? amount - profit : NaN;
    shares = price > 0 && Number.isFinite(amount) ? amount / price : NaN;
  } else {
    const quantity = Number.isNaN(quantityInput) ? NaN : quantityInput;
    const costPrice = Number.isNaN(costPriceInput) ? NaN : costPriceInput;
    cost = Number.isFinite(quantity) && Number.isFinite(costPrice) ? quantity * costPrice : NaN;
    amount = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : NaN;
    profit = Number.isFinite(amount) && Number.isFinite(cost) ? amount - cost : NaN;
    shares = Number.isFinite(quantity) ? quantity : NaN;
    ui.holdingAmount.value = Number.isFinite(amount) ? amount.toFixed(2) : '';
    ui.holdingProfit.value = Number.isFinite(profit) ? profit.toFixed(2) : '';
  }

  returnRate = Number.isFinite(cost) && cost !== 0 && Number.isFinite(profit) ? profit / cost : NaN;
  ui.holdingCost.value = Number.isFinite(cost) ? cost.toFixed(2) : '';
  ui.holdingShares.value = Number.isFinite(shares) ? shares.toFixed(4) : '';
  ui.holdingReturn.value = Number.isFinite(returnRate) ? `${(returnRate * 100).toFixed(2)}%` : '';
}

function fillAccountForm(account) {
  ui.accountId.value = account.id;
  ui.accountName.value = account.name;
}

function fillHoldingForm(accountId, holding) {
  ui.holdingId.value = holding.id;
  ui.holdingAccount.value = accountId;
  ui.holdingCode.value = holding.code;
  ui.holdingCategory.value = holding.category || '';
  const value = getHoldingValue(holding);
  const profit = getHoldingProfit(holding);
  ui.holdingAmount.value = Number.isFinite(Number(holding.amount)) ? holding.amount : value || '';
  ui.holdingProfit.value = Number.isFinite(Number(holding.profit)) ? holding.profit : profit || '';
  ui.holdingQuantity.value = Number.isFinite(Number(holding.quantity)) ? holding.quantity : '';
  ui.holdingCostPrice.value = Number.isFinite(Number(holding.costPrice)) ? holding.costPrice : '';
  ui.holdingName.value = holding.name || '';
  ui.holdingCurrency.value = holding.currency || '';
  ui.holdingPrice.value = holding.lastPrice || '';
  ui.holdingCode.dataset.symbol = holding.symbol || '';
  ui.holdingCode.dataset.name = holding.name || '';
  ui.holdingCode.dataset.currency = holding.currency || '';
  ui.holdingCode.dataset.price = holding.lastPrice || '';
  ui.holdingCode.dataset.source = holding.source || '';
  ui.holdingCode.dataset.category = holding.category || '';
  applyHoldingMode();
}

function openModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add('is-visible');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove('is-visible');
  modal.setAttribute('aria-hidden', 'true');
}

function cycleBaseCurrency() {
  const currentIndex = CURRENCIES.indexOf(state.settings.baseCurrency);
  const next = CURRENCIES[(currentIndex + 1) % CURRENCIES.length];
  setBaseCurrency(next);
}

function toggleVisibility() {
  state.settings.hideAmounts = !state.settings.hideAmounts;
  saveData();
  render();
}

function togglePnlMode() {
  state.settings.pnlMode = state.settings.pnlMode === 'percent' ? 'amount' : 'percent';
  saveData();
  render();
}

function toggleStructureView() {
  state.settings.structureView = state.settings.structureView === 'pie' ? 'bar' : 'pie';
  saveData();
  render();
}

function handleAccountFilterClick(event) {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }
  const id = button.dataset.id;
  if (!id) {
    return;
  }
  if (id === 'all') {
    state.settings.accountFilter = [];
    saveData();
    renderAccountFilters();
    renderHoldingsList();
    return;
  }
  const selected = Array.isArray(state.settings.accountFilter) ? state.settings.accountFilter : [];
  if (selected.includes(id)) {
    state.settings.accountFilter = selected.filter((item) => item !== id);
  } else {
    state.settings.accountFilter = [...selected, id];
  }
  saveData();
  renderAccountFilters();
  renderHoldingsList();
}

function handleDashboardClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) {
    return;
  }
  if (target.dataset.action === 'cycleCurrency') {
    cycleBaseCurrency();
  }
}

function handleAccountSubmit(event) {
  event.preventDefault();
  const name = ui.accountName.value.trim();

  if (!name) {
    window.alert('请完整填写账户信息');
    return;
  }

  const account = {
    id: ui.accountId.value || (crypto.randomUUID ? crypto.randomUUID() : `acc_${Date.now()}`),
    name,
    holdings: ui.accountId.value
      ? state.accounts.find((item) => item.id === ui.accountId.value)?.holdings || []
      : []
  };

  const index = state.accounts.findIndex((item) => item.id === account.id);
  if (index >= 0) {
    state.accounts[index] = account;
  } else {
    state.accounts.push(account);
  }

  saveData();
  resetAccountForm();
  closeModal(ui.accountModal);
  render();
}

function handleAccountListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }
  const account = state.accounts.find((item) => item.id === id);
  if (!account) {
    return;
  }

  if (target.dataset.action === 'edit') {
    fillAccountForm(account);
    openModal(ui.accountModal);
    return;
  }
  if (target.dataset.action === 'delete') {
    if (window.confirm('确定删除该账户吗？')) {
      state.accounts = state.accounts.filter((item) => item.id !== id);
      saveData();
      render();
    }
  }
}

function isFundCode(code) {
  return /^[0-9]{6}$/.test(code.trim());
}

async function fetchQuoteByCode(code) {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error('Empty code');
  }
  const response = await fetch(`/api/quote?code=${encodeURIComponent(trimmed)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.error) || 'Quote fetch failed');
  }
  if (!data || !data.name) {
    throw new Error('No quote data');
  }
  return data;
}

async function handleHoldingSearch() {
  const rawCode = ui.holdingCode.value.trim();
  if (!rawCode) {
    window.alert('请输入标的代码');
    return;
  }
  ui.holdingName.value = '加载中...';
  ui.holdingCurrency.value = '';
  ui.holdingPrice.value = '';

  try {
    const quote = await fetchQuoteByCode(rawCode);
    ui.holdingCode.value = rawCode.toUpperCase();
    ui.holdingName.value = quote.name;
    ui.holdingCurrency.value = quote.currency || '';
    ui.holdingPrice.value = quote.price || '';
    ui.holdingCategory.value = quote.category || '';
    ui.holdingCode.dataset.symbol = quote.symbol;
    ui.holdingCode.dataset.name = quote.name;
    ui.holdingCode.dataset.currency = quote.currency;
    ui.holdingCode.dataset.price = quote.price;
    ui.holdingCode.dataset.source = quote.source || '';
    ui.holdingCode.dataset.category = quote.category || '';
    applyHoldingMode();
  } catch (error) {
    clearHoldingLookup();
    window.alert('检索失败，请确认本地代理已启动，且代码格式正确。');
  }
}

function handleHoldingSubmit(event) {
  event.preventDefault();
  const accountId = ui.holdingAccount.value;
  const code = ui.holdingCode.value.trim();
  const mode = getHoldingMode();
  const amountInput = Number(ui.holdingAmount.value);
  const profitInput = Number(ui.holdingProfit.value);
  const quantityInput = Number(ui.holdingQuantity.value);
  const costPriceInput = Number(ui.holdingCostPrice.value);

  if (!accountId) {
    window.alert('请选择账户');
    return;
  }
  if (!code) {
    window.alert('请完整填写持仓信息');
    return;
  }
  if (!ui.holdingName.value || !ui.holdingPrice.value) {
    window.alert('请先检索标的获取最新数据');
    return;
  }
  if (mode === 'fund' && (Number.isNaN(amountInput) || Number.isNaN(profitInput))) {
    window.alert('请填写持有金额与持有收益');
    return;
  }
  if (mode === 'stock' && (Number.isNaN(quantityInput) || Number.isNaN(costPriceInput))) {
    window.alert('请填写持仓数量与成本价');
    return;
  }

  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) {
    window.alert('账户不存在');
    return;
  }

  const symbol = ui.holdingCode.dataset.symbol || normalizeSymbol(code);
  const name = ui.holdingCode.dataset.name || ui.holdingName.value || code;
  const currency = ui.holdingCode.dataset.currency || ui.holdingCurrency.value || state.settings.baseCurrency;
  const lastPrice = Number(ui.holdingCode.dataset.price) || Number(ui.holdingPrice.value) || 0;
  const source = ui.holdingCode.dataset.source || (isFundCode(code) ? 'fund' : 'proxy');
  const category = ui.holdingCode.dataset.category || ui.holdingCategory.value.trim() || '未分类';
  let amount = amountInput;
  let profit = profitInput;
  let quantity = quantityInput;
  let costPrice = costPriceInput;
  if (mode === 'stock') {
    quantity = quantityInput;
    costPrice = costPriceInput;
    const cost = Number.isFinite(quantity) && Number.isFinite(costPrice) ? quantity * costPrice : 0;
    amount = Number.isFinite(quantity) && Number.isFinite(lastPrice) ? quantity * lastPrice : 0;
    profit = amount - cost;
  } else {
    amount = amountInput;
    profit = profitInput;
    quantity = lastPrice > 0 ? amount / lastPrice : 0;
  }
  const cost = mode === 'stock'
    ? (Number.isFinite(quantity) && Number.isFinite(costPrice) ? quantity * costPrice : 0)
    : amount - profit;

  const holding = {
    id: ui.holdingId.value || (crypto.randomUUID ? crypto.randomUUID() : `hold_${Date.now()}`),
    code,
    symbol,
    name,
    currency,
    amount,
    profit,
    cost,
    quantity,
    costPrice,
    lastPrice,
    category,
    source,
    lastUpdate: Date.now()
  };

  const holdings = account.holdings || [];
  const index = holdings.findIndex((item) => item.id === holding.id);
  if (index >= 0) {
    holdings[index] = holding;
  } else {
    holdings.push(holding);
  }
  account.holdings = holdings;

  saveData();
  resetHoldingForm();
  closeModal(ui.holdingModal);
  ensureTodaySnapshot();
  render();
}

function handleHoldingListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const id = target.dataset.id;
  const accountId = target.dataset.accountId;
  if (!id || !accountId) {
    return;
  }
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) {
    return;
  }
  const holding = (account.holdings || []).find((item) => item.id === id);
  if (!holding) {
    return;
  }

  if (target.dataset.action === 'edit') {
    fillHoldingForm(accountId, holding);
    openModal(ui.holdingModal);
    return;
  }
  if (target.dataset.action === 'delete') {
    if (window.confirm('确定删除该持仓吗？')) {
      account.holdings = (account.holdings || []).filter((item) => item.id !== id);
      saveData();
      ensureTodaySnapshot();
      render();
    }
  }
}

function buildRateStatusMessage(success) {
  const base = state.settings.baseCurrency;
  const lastFetch = state.settings.lastRateFetch
    ? new Date(state.settings.lastRateFetch).toLocaleString('zh-CN', { hour12: false })
    : '暂无记录';

  const lines = [`结算币种：${base}`, `汇率更新：${lastFetch}`];

  CURRENCIES.filter((code) => code !== base).forEach((code) => {
    const rate = state.settings.fxRates[code];
    if (rate) {
      lines.push(`1 ${code} = ${formatNumber(rate)} ${base}`);
    }
  });

  if (state.settings.lastRateSource) {
    lines.push(`来源：${state.settings.lastRateSource}`);
  }

  if (!success) {
    lines.push('汇率更新失败，使用上次数据');
  }

  return lines.join(' · ');
}

function buildQuoteStatusMessage(success) {
  const lastFetch = state.settings.lastQuoteFetch
    ? new Date(state.settings.lastQuoteFetch).toLocaleString('zh-CN', { hour12: false })
    : '暂无记录';
  const message = `行情更新：${lastFetch}`;
  return success ? message : `${message} · 行情更新失败`;
}

async function refreshRates(force) {
  const now = Date.now();
  const lastFetch = state.settings.lastRateFetch || 0;
  if (!force && now - lastFetch < 6 * 60 * 60 * 1000) {
    const message = buildRateStatusMessage(state.settings.lastRateOk !== false);
    ui.rateStatus.textContent = message;
    return;
  }

  const base = state.settings.baseCurrency;
  try {
    const response = await fetch(`/api/rates?base=${encodeURIComponent(base)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !data.rates) {
      throw new Error('No rates');
    }

    const fxRates = { [base]: 1 };
    CURRENCIES.forEach((code) => {
      if (code === base) {
        return;
      }
      const rate = data.rates[code];
      if (rate) {
        fxRates[code] = 1 / rate;
      }
    });

    state.settings.fxRates = fxRates;
    state.settings.lastRateFetch = now;
    state.settings.lastRateOk = true;
    state.settings.lastRateSource = data.source || state.settings.lastRateSource || '';
    saveData();
    const message = buildRateStatusMessage(true);
    ui.rateStatus.textContent = message;
    render();
  } catch (error) {
    state.settings.lastRateOk = false;
    state.settings.lastRateSource = state.settings.lastRateSource || '';
    saveData();
    const message = buildRateStatusMessage(false);
    ui.rateStatus.textContent = message;
  }
}

async function refreshQuotes(force) {
  const now = Date.now();
  const lastFetch = state.settings.lastQuoteFetch || 0;
  if (!force && now - lastFetch < 30 * 60 * 1000) {
    ui.quoteStatus.textContent = buildQuoteStatusMessage(state.settings.lastQuoteOk !== false);
    return;
  }

  const lookupMap = new Map();
  state.accounts.forEach((account) => {
    (account.holdings || []).forEach((holding) => {
      const key = holding.code || holding.symbol;
      if (!key) {
        return;
      }
      if (!lookupMap.has(key)) {
        lookupMap.set(key, []);
      }
      lookupMap.get(key).push(holding);
    });
  });

  const lookups = Array.from(lookupMap.entries());
  if (!lookups.length) {
    ui.quoteStatus.textContent = buildQuoteStatusMessage(true);
    return;
  }

  try {
    const results = await Promise.allSettled(
      lookups.map(async ([code, holdings]) => {
        const quote = await fetchQuoteByCode(code);
        return { quote, holdings };
      })
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    fulfilled.forEach(({ quote, holdings }) => {
      holdings.forEach((holding) => {
        holding.symbol = quote.symbol;
        holding.name = quote.name;
        holding.currency = quote.currency || holding.currency;
        holding.lastPrice = quote.price;
        holding.lastUpdate = now;
        holding.source = quote.source || holding.source;
      });
    });

    const success = fulfilled.length > 0;
    if (success) {
      state.settings.lastQuoteFetch = now;
      state.settings.lastQuoteOk = true;
      saveData();
      ensureTodaySnapshot();
    } else {
      state.settings.lastQuoteOk = false;
    }
    ui.quoteStatus.textContent = buildQuoteStatusMessage(success);
    render();
  } catch (error) {
    state.settings.lastQuoteOk = false;
    saveData();
    ui.quoteStatus.textContent = buildQuoteStatusMessage(false);
  }
}

function setBaseCurrency(newBase) {
  if (!newBase || newBase === state.settings.baseCurrency) {
    return;
  }
  const oldRates = state.settings.fxRates;
  const conversionRate = oldRates[newBase];
  if (conversionRate) {
    state.history = state.history.map((entry) => ({
      ...entry,
      totalAssetsBase: entry.totalAssetsBase / conversionRate,
      totalPnlBase: entry.totalPnlBase / conversionRate,
      accountAssetsBase: entry.accountAssetsBase
        ? Object.fromEntries(
            Object.entries(entry.accountAssetsBase).map(([key, value]) => [key, value / conversionRate])
          )
        : entry.accountAssetsBase
    }));
  }
  state.settings.baseCurrency = newBase;
  const baseRate = oldRates[state.settings.baseCurrency] || 1;
  const rebased = {};
  CURRENCIES.forEach((code) => {
    rebased[code] = (oldRates[code] || 1) / baseRate;
  });
  rebased[state.settings.baseCurrency] = 1;
  state.settings.fxRates = rebased;
  saveData();
  ensureTodaySnapshot();
  refreshRates(true);
  render();
}

function backupData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `portfolio-backup-${getTodayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = {
        settings: {
          ...DEFAULT_DATA.settings,
          ...(parsed.settings || {})
        },
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
      saveData();
      render();
      window.alert('已恢复备份。');
    } catch (error) {
      window.alert('备份文件解析失败。');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function switchPage(target) {
  ui.pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === target);
  });
  ui.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === target);
  });
  closeModal(ui.accountModal);
  closeModal(ui.holdingModal);
}

function render() {
  updateDashboard();
  renderAccountPnlTable();
  updateCharts();
  updateDistributions();
  renderAccountList();
  renderAccountOptions();
  renderAccountFilters();
  renderHoldingsList();
  const rateMessage = buildRateStatusMessage(state.settings.lastRateOk !== false);
  ui.rateStatus.textContent = rateMessage;
  ui.quoteStatus.textContent = buildQuoteStatusMessage(state.settings.lastQuoteOk !== false);
  syncHeaderControls();
}

function bindEvents() {
  ui.refreshQuotes.addEventListener('click', () => refreshQuotes(true));
  ui.refreshRates.addEventListener('click', () => refreshRates(true));
  if (ui.toggleVisibility) {
    ui.toggleVisibility.addEventListener('click', toggleVisibility);
  }
  if (ui.pnlModeToggle) {
    ui.pnlModeToggle.addEventListener('change', togglePnlMode);
  }
  if (ui.structureToggle) {
    ui.structureToggle.addEventListener('change', toggleStructureView);
  }
  if (ui.dashboard) {
    ui.dashboard.addEventListener('click', handleDashboardClick);
  }
  ui.accountForm.addEventListener('submit', handleAccountSubmit);
  ui.resetAccountForm.addEventListener('click', resetAccountForm);
  ui.accountList.addEventListener('click', handleAccountListClick);
  if (ui.accountFilters) {
    ui.accountFilters.addEventListener('click', handleAccountFilterClick);
  }
  if (ui.openAccountModal) {
    ui.openAccountModal.addEventListener('click', () => {
      resetAccountForm();
      openModal(ui.accountModal);
    });
  }
  if (ui.openHoldingModal) {
    ui.openHoldingModal.addEventListener('click', () => {
      resetHoldingForm();
      openModal(ui.holdingModal);
    });
  }
  if (ui.accountModal) {
    ui.accountModal.addEventListener('click', (event) => {
      if (event.target === ui.accountModal) {
        closeModal(ui.accountModal);
      }
    });
  }
  if (ui.holdingModal) {
    ui.holdingModal.addEventListener('click', (event) => {
      if (event.target === ui.holdingModal) {
        closeModal(ui.holdingModal);
      }
    });
  }
  document.addEventListener('click', (event) => {
    const action = event.target.dataset && event.target.dataset.action;
    if (action === 'closeAccountModal') {
      closeModal(ui.accountModal);
    }
    if (action === 'closeHoldingModal') {
      closeModal(ui.holdingModal);
    }
  });
  ui.holdingForm.addEventListener('submit', handleHoldingSubmit);
  ui.holdingSearch.addEventListener('click', handleHoldingSearch);
  ui.holdingAmount.addEventListener('input', updateDerivedHolding);
  ui.holdingProfit.addEventListener('input', updateDerivedHolding);
  ui.holdingQuantity.addEventListener('input', updateDerivedHolding);
  ui.holdingCostPrice.addEventListener('input', updateDerivedHolding);
  ui.holdingCode.addEventListener('input', clearHoldingLookup);
  ui.resetHoldingForm.addEventListener('click', resetHoldingForm);
  ui.holdingList.addEventListener('click', handleHoldingListClick);
  ui.backupData.addEventListener('click', backupData);
  ui.restoreData.addEventListener('change', restoreData);
  ui.navButtons.forEach((button) => {
    button.addEventListener('click', () => switchPage(button.dataset.target));
  });
}

function init() {
  bindEvents();
  render();
  refreshRates(false);
  refreshQuotes(false);
  switchPage('summary');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

init();
