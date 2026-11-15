{{/*
Короткое имя приложения: имя чарта или nameOverride.
*/}}
{{- define "hello-node.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Полное имя для объектов. Если имя релиза уже содержит имя чарта, берётся только оно,
иначе "<релиз>-<чарт>". Обрезка до 63 символов: ограничение DNS-имён в Kubernetes.
*/}}
{{- define "hello-node.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Имя и версия чарта для метки helm.sh/chart.
*/}}
{{- define "hello-node.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Общие метки для всех объектов чарта.
*/}}
{{- define "hello-node.labels" -}}
helm.sh/chart: {{ include "hello-node.chart" . }}
{{ include "hello-node.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Метки для селекторов. Только стабильные: selector у Deployment после создания не меняется.
*/}}
{{- define "hello-node.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hello-node.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
