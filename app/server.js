const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');

const PORT = Number(process.env.PORT) || 3000;
const MESSAGE = process.env.APP_MESSAGE || 'Hello from Kubernetes!';
const STARTUP_DELAY_SECONDS = Number(process.env.STARTUP_DELAY_SECONDS) || 0;

// Конфигурация из переменных окружения: читается один раз при старте процесса.
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const API_TOKEN = process.env.API_TOKEN || '';
const STARTED_AT = new Date().toISOString();
// Файл настроек, наоборот, читается при каждом запросе к /debug/config.
const SETTINGS_FILE = process.env.SETTINGS_FILE || '/etc/hello-node/settings.json';

// Состояние для проб. Отдельные флаги нужны, чтобы вручную проверить поведение кластера.
let ready = false;
let healthy = true;

// Имитация долгого старта: процесс уже работает, но ещё не готов принимать трафик.
setTimeout(() => {
  ready = true;
  console.log('Ready to serve traffic');
}, STARTUP_DELAY_SECONDS * 1000);

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
};

// Секрет целиком не показываем: только начало и длину, чтобы было видно, что он пришёл.
const maskSecret = (value) => (value ? `${value.slice(0, 2)}*** (${value.length} chars)` : null);

// Читает файл настроек заново на каждый вызов, чтобы было видно, когда kubelet его обновит.
const readSettingsFile = () => {
  try {
    const stat = fs.statSync(SETTINGS_FILE);
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    let content;
    try {
      content = JSON.parse(raw);
    } catch {
      content = raw;
    }
    return { path: SETTINGS_FILE, modifiedAt: stat.mtime.toISOString(), content };
  } catch (error) {
    return { path: SETTINGS_FILE, error: error.code || error.message };
  }
};

const configReport = () => ({
  hostname: os.hostname(),
  startedAt: STARTED_AT,
  fromEnv: {
    APP_MESSAGE: MESSAGE,
    LOG_LEVEL,
    API_TOKEN: maskSecret(API_TOKEN),
  },
  fromFile: readSettingsFile(),
});

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const { pathname } = new URL(req.url, 'http://localhost');

  switch (pathname) {
    case '/':
      // В поде os.hostname() возвращает имя пода: удобно видеть, кто ответил.
      return sendJson(res, 200, {
        message: MESSAGE,
        hostname: os.hostname(),
        uptimeSeconds: Math.round(process.uptime()),
      });
    // Liveness: жив ли процесс. Ошибка приводит к перезапуску контейнера.
    case '/healthz':
      return sendJson(res, healthy ? 200 : 500, { healthy });
    // Readiness: можно ли слать трафик. Ошибка убирает под из Service, но не перезапускает его.
    case '/readyz':
      return sendJson(res, ready ? 200 : 503, { ready });

    // Учебные переключатели для демонстрации проб. В реальном приложении таких эндпоинтов быть не должно.
    case '/debug/not-ready':
      ready = false;
      return sendJson(res, 200, { hostname: os.hostname(), ready });
    case '/debug/ready':
      ready = true;
      return sendJson(res, 200, { hostname: os.hostname(), ready });
    case '/debug/unhealthy':
      healthy = false;
      return sendJson(res, 200, { hostname: os.hostname(), healthy });

    // Конфигурация: что пришло из env при старте и что сейчас лежит в файле.
    case '/debug/config':
      return sendJson(res, 200, configReport());
    default:
      return sendJson(res, 404, { error: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// Kubernetes останавливает контейнер сигналом SIGTERM, а через 30 секунд шлёт SIGKILL.
// Node, запущенный как PID 1, сам на SIGTERM не реагирует, поэтому обработчик нужен явно.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  server.closeIdleConnections();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
