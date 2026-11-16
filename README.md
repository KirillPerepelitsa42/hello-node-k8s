# hello-node-k8s

Учебный проект: Node.js-приложение в Kubernetes (minikube) — от голых манифестов до Helm-чарта с окружениями.

## Структура

```
app/                  Приложение: HTTP-сервер, Dockerfile
k8s/                  Манифесты для kubectl (этап до Helm)
charts/hello-node/    Helm-чарт
  values.yaml         Общие значения
  values-dev.yaml     Отличия для dev
  values-pro.yaml     Отличия для pro
```

## Что внутри

- Deployment с выкаткой без простоя (`maxSurge: 1`, `maxUnavailable: 0`), readiness и liveness пробами, requests и limits.
- Конфиг приложения `config.yaml` собирается init-контейнером: `envsubst` подставляет значения из ConfigMap и Secret в шаблон, файл монтируется через `subPath`.
- Поды пересоздаются при изменении конфига благодаря аннотации `checksum/config`.
- Окружения задаются values-файлами; Ingress включается флагом, хост dev-стенда строится из namespace.
- Secret не хранится в репозитории и создаётся отдельно.

## История разработки

Проект собирался по шагам, каждый коммит — отдельный этап. Историю удобно читать через `git log -p`.

1. **Манифесты приложения** — ConfigMap, Deployment и Service для kubectl: реплики, пробы, ресурсы, конфиг через env и файл, Secret по ссылке.
2. **Исходники приложения** — сервер и Dockerfile переехали в репозиторий, образ `hello-node:2.0` собирается из них.
3. **Helm-чарт** — манифесты стали шаблонами: значения вынесены в `values.yaml`, имена и метки — в `_helpers.tpl`, добавлен `checksum/config`.
4. **Конфиг через init-контейнер** — меняет способ конфигурации: вместо переменных окружения приложение читает `config.yaml`, который собирает `envsubst` при старте пода. Версия приложения и чарта — 2.1.
5. **Окружения** — `values-dev.yaml` и `values-pro.yaml` с отличиями от общих значений.
6. **Ingress** — включается флагом `enabled`, хост dev-стенда строится из namespace.

## Запуск

Требуется minikube с аддоном `ingress`.

```bash
minikube image build -t hello-node:2.1 app/

kubectl create namespace ipr-dev
kubectl -n ipr-dev create secret generic hello-node-secret --from-literal=API_TOKEN=<токен>

helm install hello-node charts/hello-node -n ipr-dev -f charts/hello-node/values-dev.yaml --wait
```

Проверка через Ingress (в отдельном терминале `minikube tunnel`):

```bash
curl http://hello-node.ipr-dev.localhost/
curl http://hello-node.ipr-dev.localhost/debug/config
```

## Эндпоинты

| Путь | Назначение |
|---|---|
| `/` | Сообщение и имя пода |
| `/healthz`, `/readyz` | Liveness и readiness |
| `/debug/config` | Конфиг, с которым стартовал процесс (токен замаскирован) |
| `/debug/not-ready`, `/debug/ready`, `/debug/unhealthy` | Ручное переключение проб для демонстрации |
