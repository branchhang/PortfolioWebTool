const http = require('http');
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const PORT = process.env.PORT || 8787;
const ROOT = process.cwd();
const gbkDecoder = new TextDecoder('gbk');

if (typeof fetch !== 'function') {
  console.error('Node 18+ is required (missing fetch).');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
}

function normalizeYahooSymbol(rawCode) {
  const trimmed = rawCode.trim().toUpperCase();
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

function normalizeTencentSymbol(rawCode) {
  const trimmed = rawCode.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  if (/^(sh|sz)\d{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^hk\d{1,5}$/.test(trimmed)) {
    return `hk${trimmed.slice(2).padStart(4, '0')}`;
  }
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed.startsWith('6') ? `sh${trimmed}` : `sz${trimmed}`;
  }
  if (/^\d{1,5}$/.test(trimmed)) {
    return `hk${trimmed.padStart(4, '0')}`;
  }
  if (/^[a-zA-Z]+$/.test(trimmed)) {
    return `us${trimmed}`;
  }
  return '';
}

function isFundCode(code) {
  return /^[0-9]{6}$/.test(code.trim());
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!response.ok) {
    throw new Error('Quote fetch failed');
  }
  return response.json();
}

async function fetchText(url, encoding = 'utf-8') {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!response.ok) {
    throw new Error('Quote fetch failed');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (encoding === 'gbk') {
    return gbkDecoder.decode(buffer);
  }
  return buffer.toString('utf-8');
}

function mapYahooCategory(result, fallbackCode) {
  const type = String(result.quoteType || '').toUpperCase();
  if (type === 'ETF') {
    return '指数基金';
  }
  if (type === 'MUTUALFUND') {
    return '基金';
  }
  if (type === 'BOND') {
    return '债券';
  }
  if (type === 'CRYPTOCURRENCY') {
    return '加密';
  }
  if (type === 'COMMODITY') {
    return '商品';
  }
  if (type === 'CURRENCY') {
    return '外汇';
  }
  if (type) {
    return '股票';
  }
  const trimmed = String(fallbackCode || '').toUpperCase();
  if (trimmed.endsWith('.SS') || trimmed.endsWith('.SZ') || trimmed.endsWith('.HK') || /^[A-Z]+$/.test(trimmed)) {
    return '股票';
  }
  return '其他';
}

async function fetchYahooQuote(rawCode) {
  const symbol = normalizeYahooSymbol(rawCode);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const data = await fetchJson(url);
  const result = data.quoteResponse && data.quoteResponse.result ? data.quoteResponse.result[0] : null;
  if (!result) {
    throw new Error('No quote data');
  }
  return {
    code: rawCode,
    symbol: result.symbol || symbol,
    name: result.shortName || result.longName || symbol,
    price: Number(result.regularMarketPrice) || 0,
    currency: result.currency || '',
    category: mapYahooCategory(result, symbol),
    source: 'yahoo'
  };
}

async function fetchTencentQuote(rawCode) {
  const symbol = normalizeTencentSymbol(rawCode);
  if (!symbol) {
    throw new Error('Invalid symbol');
  }
  const url = `https://qt.gtimg.cn/q=${encodeURIComponent(symbol)}`;
  const text = await fetchText(url, 'gbk');
  const match = text.match(/"([^"]+)"/);
  if (!match) {
    throw new Error('No quote data');
  }
  const fields = match[1].split('~');
  const name = fields[1] || rawCode;
  const price = Number(fields[3]) || 0;
  let currency = 'CNY';
  if (symbol.startsWith('hk')) {
    currency = 'HKD';
  } else if (symbol.startsWith('us')) {
    currency = 'USD';
  }
  return {
    code: rawCode,
    symbol,
    name,
    price,
    currency,
    category: '股票',
    source: 'tencent'
  };
}

async function fetchFundQuote(code) {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
  const text = await fetchText(url);
  const match = text.match(/jsonpgz\((.*)\);?/);
  if (!match) {
    throw new Error('No fund data');
  }
  const data = JSON.parse(match[1]);
  if (!data || !data.fundcode) {
    throw new Error('No fund data');
  }
  const price = Number(data.gsz || data.dwjz) || 0;
  return {
    code,
    symbol: data.fundcode,
    name: data.name || code,
    price,
    currency: 'CNY',
    category: '基金',
    source: 'fund'
  };
}

async function lookupQuote(code) {
  const trimmed = code.trim();
  let lastError = null;

  if (isFundCode(trimmed)) {
    try {
      return await fetchFundQuote(trimmed);
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await fetchYahooQuote(trimmed);
  } catch (error) {
    lastError = error;
  }

  try {
    return await fetchTencentQuote(trimmed);
  } catch (error) {
    lastError = error;
  }

  throw lastError || new Error('No quote data');
}

async function fetchRatesFromOpenErApi(base) {
  const data = await fetchJson(`https://open.er-api.com/v6/latest/${base}`);
  if (!data || !data.rates) {
    throw new Error('No rate data');
  }
  return { base: data.base_code || base, rates: data.rates, source: 'open.er-api' };
}

async function fetchRatesFromExchangerateHost(base) {
  const data = await fetchJson(`https://api.exchangerate.host/latest?base=${base}`);
  if (!data || !data.rates) {
    throw new Error('No rate data');
  }
  return { base: data.base || base, rates: data.rates, source: 'exchangerate.host' };
}

async function lookupRates(base) {
  const sources = [fetchRatesFromOpenErApi, fetchRatesFromExchangerateHost];
  let lastError = null;
  for (const fetcher of sources) {
    try {
      return await fetcher(base);
    } catch (error) {
      lastError = error;
      console.warn(`[rates] source failed: ${error.message}`);
    }
  }
  throw lastError || new Error('No rate data');
}

function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

async function handleApiQuote(req, res, url) {
  if (handleCors(req, res)) {
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    sendJson(res, 400, { error: 'missing code' });
    return;
  }
  try {
    const quote = await lookupQuote(code);
    sendJson(res, 200, quote);
  } catch (error) {
    sendJson(res, 502, { error: 'quote lookup failed' });
  }
}

async function handleApiRates(req, res, url) {
  if (handleCors(req, res)) {
    return;
  }
  const base = (url.searchParams.get('base') || 'CNY').toUpperCase();
  try {
    const data = await lookupRates(base);
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 502, { error: 'rate lookup failed', detail: error.message });
  }
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') {
    pathname = '/index.html';
  }
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=0' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/quote') {
    handleApiQuote(req, res, url).catch(() => {
      sendJson(res, 500, { error: 'server error' });
    });
    return;
  }
  if (url.pathname === '/api/rates') {
    handleApiRates(req, res, url).catch(() => {
      sendJson(res, 500, { error: 'server error' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed');
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`PortfolioTool proxy running at http://localhost:${PORT}`);
});
