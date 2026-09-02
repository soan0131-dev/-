'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_RANGE_DAYS = Number(process.env.MAX_RANGE_DAYS) || 62;
const MAX_TITLE_LEN = 100;
const MAX_NAME_LEN = 30;
const MAX_BODY_BYTES = 200 * 1024;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[0-9a-f-]{36}$/i;

function isValidDateStr(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
}

// Synchronous by design: keeps each request's read-modify-write atomic
// without extra locking, since Node runs this handler to completion
// before any other request's callback can run.
function readEvents() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function parseJSONBody(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Client-side routes (e.g. "/?id=...") always resolve to index.html.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, idx) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(idx);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleCreateEvent(req, res) {
  const body = await parseJSONBody(req);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const { startDate, endDate } = body;

  if (!title || title.length > MAX_TITLE_LEN) {
    return sendJSON(res, 400, { error: '제목을 확인해주세요.' });
  }
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
    return sendJSON(res, 400, { error: '날짜 형식이 올바르지 않습니다.' });
  }
  const range = daysBetween(startDate, endDate);
  if (range < 0) {
    return sendJSON(res, 400, { error: '종료일은 시작일보다 빠를 수 없습니다.' });
  }
  if (range > MAX_RANGE_DAYS) {
    return sendJSON(res, 400, { error: `기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.` });
  }

  const events = readEvents();
  const id = crypto.randomUUID();
  events[id] = {
    id,
    title,
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
    participants: {},
  };
  writeEvents(events);
  return sendJSON(res, 201, { id });
}

async function handleUpsertParticipant(req, res, eventId) {
  const events = readEvents();
  const ev = events[eventId];
  if (!ev) return sendJSON(res, 404, { error: '일정을 찾을 수 없습니다.' });

  const body = await parseJSONBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_NAME_LEN) {
    return sendJSON(res, 400, { error: '이름을 확인해주세요.' });
  }
  if (!Array.isArray(body.dates)) {
    return sendJSON(res, 400, { error: 'dates는 배열이어야 합니다.' });
  }

  const validDates = [...new Set(body.dates)]
    .filter((d) => isValidDateStr(d) && d >= ev.startDate && d <= ev.endDate)
    .sort();

  ev.participants[name] = validDates;
  writeEvents(events);
  return sendJSON(res, 200, { name, dates: validDates });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/api/events' && req.method === 'POST') {
      return await handleCreateEvent(req, res);
    }

    const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
    if (eventMatch && req.method === 'GET') {
      const id = eventMatch[1];
      if (!ID_RE.test(id)) return sendJSON(res, 404, { error: '일정을 찾을 수 없습니다.' });
      const events = readEvents();
      const ev = events[id];
      if (!ev) return sendJSON(res, 404, { error: '일정을 찾을 수 없습니다.' });
      return sendJSON(res, 200, ev);
    }

    const partMatch = pathname.match(/^\/api\/events\/([^/]+)\/participants$/);
    if (partMatch && req.method === 'PUT') {
      const id = partMatch[1];
      if (!ID_RE.test(id)) return sendJSON(res, 404, { error: '일정을 찾을 수 없습니다.' });
      return await handleUpsertParticipant(req, res, id);
    }

    if (req.method === 'GET' && !pathname.startsWith('/api')) {
      return serveStatic(req, res, pathname);
    }

    return sendJSON(res, 404, { error: 'not found' });
  } catch (err) {
    return sendJSON(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
