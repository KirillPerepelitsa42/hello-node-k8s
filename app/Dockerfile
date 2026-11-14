FROM node:22-alpine

WORKDIR /app

# Внешних зависимостей нет, поэтому npm install не нужен.
COPY package.json server.js ./

# Не запускаем приложение от root.
USER node

ENV PORT=3000
EXPOSE 3000

# Запуск напрямую через node, а не через npm: так SIGTERM доходит до приложения.
CMD ["node", "server.js"]
