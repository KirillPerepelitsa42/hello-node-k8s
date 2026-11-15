const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const { parse } = require('yaml');

// Порт остаётся переменной окружения: это настройка контейнера, а не приложения.
const PORT = Number(process.env.PORT) || 3000;
// Конфигурация приложения — файл. В кластере его собирает init-контейнер перед стартом.
const CONFIG_FILE = process.env.CONFIG_FILE || '/app/config.yaml';
const STARTED_AT = new Date().toISOString();

// Читаем конфиг один раз при старте. Нет файла или он битый — падаем сразу:
// под уйдёт в CrashLoopBackOff, и проблема будет видна, а не спрятана.
const loadConfig = () => {
  try {
    return parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.error(`Cannot load config from ${CONFIG_FILE}: ${error.message}`);
    process.exit(1);
  }
};

const config = loadConfig();
const MESSAGE = config.app?.message || 'Hello from Kubernetes!';
const STARTUP_DELAY_SECONDS = Number(config.app?.startupDelaySeconds) || 0;

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
const maskSecret = (value) => (value ? `${String(value).slice(0, 2)}*** (${String(value).length} chars)` : null);

const configReport = () => ({
  hostname: os.hostname(),
  startedAt: STARTED_AT,
  configFile: CONFIG_FILE,
  config: {
    ...config,
    auth: { ...config.auth, apiToken: maskSecret(config.auth?.apiToken) },
  },
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

    // Конфигурация, с которой стартовал процесс.
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
