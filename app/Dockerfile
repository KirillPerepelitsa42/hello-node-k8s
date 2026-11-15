FROM node:22-alpine

WORKDIR /app

# Сначала только манифесты зависимостей: этот слой пересобирается, лишь когда они меняются.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

# Не запускаем приложение от root.
USER node

ENV PORT=3000
EXPOSE 3000

# Запуск напрямую через node, а не через npm: так SIGTERM доходит до приложения.
CMD ["node", "server.js"]
