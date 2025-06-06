# Helm Charts

## Giriş

Helm, Kubernetes uygulamalarını paketlemek, dağıtmak ve yönetmek için kullanılan bir paket yöneticisidir. "Kubernetes için apt/yum" olarak tanımlanabilir. Helm Charts, Kubernetes kaynaklarını şablon olarak tanımlamanıza ve parametrize etmenize olanak tanır.

## Helm Temelleri

### Helm Kurulumu

```bash
# Helm 3 kurulumu (macOS)
brew install helm

# Helm 3 kurulumu (Linux)
curl https://get.helm.sh/helm-v3.12.0-linux-amd64.tar.gz | tar xz
sudo mv linux-amd64/helm /usr/local/bin/

# Helm version kontrolü
helm version

# Helm repository ekleme
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### Temel Helm Komutları

```bash
# Chart oluşturma
helm create my-web-app

# Chart install etme
helm install my-release ./my-web-app
helm install my-release bitnami/postgresql

# Release listesi
helm list
helm list --all-namespaces

# Release status
helm status my-release

# Release upgrade
helm upgrade my-release ./my-web-app

# Release rollback
helm rollback my-release 1

# Release uninstall
helm uninstall my-release

# Chart template render
helm template my-release ./my-web-app

# Chart validate
helm lint ./my-web-app
```

## Chart Yapısı

### Temel Chart Dizin Yapısı

```
my-web-app/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default configuration values
├── charts/             # Chart dependencies
├── templates/          # Kubernetes manifest templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   ├── serviceaccount.yaml
│   ├── _helpers.tpl    # Template helpers
│   ├── NOTES.txt       # Installation notes
│   └── tests/
│       └── test-connection.yaml
└── .helmignore         # Files to ignore
```

### Chart.yaml Örneği

```yaml
# Chart.yaml
apiVersion: v2
name: my-web-app
description: A comprehensive web application Helm chart
type: application
version: 1.0.0
appVersion: "1.0.0"
home: https://github.com/mycompany/my-web-app
sources:
  - https://github.com/mycompany/my-web-app
maintainers:
  - name: Development Team
    email: dev-team@mycompany.com
    url: https://mycompany.com
keywords:
  - web
  - application
  - microservice
  - spring-boot
annotations:
  category: Application Framework
dependencies:
  - name: postgresql
    version: 12.1.9
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.3.7
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: nginx-ingress-controller
    version: 9.3.3
    repository: https://charts.bitnami.com/bitnami
    condition: ingress.enabled
```

## Values.yaml Yapılandırması

### Kapsamlı Values.yaml

```yaml
# values.yaml
# Global configuration
global:
  imageRegistry: "myregistry.azurecr.io"
  imagePullSecrets:
    - name: registry-secret
  storageClass: "premium-ssd"

# Application configuration
app:
  name: my-web-app
  version: "1.0.0"
  
image:
  repository: my-web-app
  tag: "1.0.0"
  pullPolicy: IfNotPresent

# Replica configuration
replicaCount: 3

# Service configuration
service:
  type: ClusterIP
  port: 80
  targetPort: 8080
  annotations: {}

# Ingress configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: api.mycompany.com
      paths:
        - path: /api
          pathType: Prefix
        - path: /health
          pathType: Exact
  tls:
    - secretName: api-tls-secret
      hosts:
        - api.mycompany.com

# Resource limits
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

# Auto scaling
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Node selector and affinity
nodeSelector: {}
tolerations: []
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - my-web-app
        topologyKey: kubernetes.io/hostname

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 3000
  fsGroup: 2000

containerSecurityContext:
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
    - ALL
    add:
    - NET_BIND_SERVICE
  readOnlyRootFilesystem: true

# Health checks
healthChecks:
  liveness:
    enabled: true
    path: /actuator/health
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readiness:
    enabled: true
    path: /actuator/health/readiness
    initialDelaySeconds: 5
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3

# Environment configuration
environment:
  - name: SPRING_PROFILES_ACTIVE
    value: "production"
  - name: JAVA_OPTS
    value: "-Xmx384m -Xms256m"

# ConfigMap configuration
configMap:
  enabled: true
  data:
    application.properties: |
      server.port=8080
      management.endpoints.web.exposure.include=health,info,metrics,prometheus
      management.endpoint.health.show-details=always
      logging.level.com.mycompany=INFO

# Secret configuration
secrets:
  enabled: true
  data:
    database-url: "amRiYzpwb3N0Z3Jlc3FsOi8vcG9zdGdyZXMtc2VydmljZTo1NDMyL215ZGI="
    jwt-secret: "bXlfc3VwZXJfc2VjcmV0X2p3dF9rZXk="

# Service Account
serviceAccount:
  create: true
  annotations: {}
  name: ""

# Pod Disruption Budget
podDisruptionBudget:
  enabled: true
  minAvailable: 2

# Network Policy
networkPolicy:
  enabled: true
  ingress:
    enabled: true
    from:
      - namespaceSelector:
          matchLabels:
            name: nginx-ingress
  egress:
    enabled: true
    to:
      - namespaceSelector:
          matchLabels:
            name: database

# Monitoring
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    path: /actuator/prometheus
    interval: 30s

# Volume mounts
volumeMounts:
  - name: tmp-volume
    mountPath: /tmp
  - name: cache-volume
    mountPath: /app/cache

volumes:
  - name: tmp-volume
    emptyDir: {}
  - name: cache-volume
    emptyDir:
      sizeLimit: 1Gi

# Database (PostgreSQL)
postgresql:
  enabled: true
  auth:
    postgresPassword: "super_secret_password"
    username: "app_user"
    password: "app_password"
    database: "my_app_db"
  primary:
    persistence:
      enabled: true
      size: 10Gi
      storageClass: "premium-ssd"
  metrics:
    enabled: true

# Cache (Redis)
redis:
  enabled: true
  auth:
    enabled: true
    password: "redis_password"
  master:
    persistence:
      enabled: true
      size: 2Gi
  metrics:
    enabled: true
```

## Template Örnekleri

### Deployment Template

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-web-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      {{- include "my-web-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
      labels:
        {{- include "my-web-app.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "my-web-app.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.global.imageRegistry }}/{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          {{- if .Values.healthChecks.liveness.enabled }}
          livenessProbe:
            httpGet:
              path: {{ .Values.healthChecks.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthChecks.liveness.initialDelaySeconds }}
            periodSeconds: {{ .Values.healthChecks.liveness.periodSeconds }}
            timeoutSeconds: {{ .Values.healthChecks.liveness.timeoutSeconds }}
            failureThreshold: {{ .Values.healthChecks.liveness.failureThreshold }}
          {{- end }}
          {{- if .Values.healthChecks.readiness.enabled }}
          readinessProbe:
            httpGet:
              path: {{ .Values.healthChecks.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthChecks.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.healthChecks.readiness.periodSeconds }}
            timeoutSeconds: {{ .Values.healthChecks.readiness.timeoutSeconds }}
            failureThreshold: {{ .Values.healthChecks.readiness.failureThreshold }}
          {{- end }}
          env:
            {{- range .Values.environment }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
            {{- if .Values.secrets.enabled }}
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "my-web-app.fullname" . }}-secret
                  key: database-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "my-web-app.fullname" . }}-secret
                  key: jwt-secret
            {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          securityContext:
            {{- toYaml .Values.containerSecurityContext | nindent 12 }}
          volumeMounts:
            {{- range .Values.volumeMounts }}
            - name: {{ .name }}
              mountPath: {{ .mountPath }}
            {{- end }}
            {{- if .Values.configMap.enabled }}
            - name: config-volume
              mountPath: /app/config
            {{- end }}
      volumes:
        {{- range .Values.volumes }}
        - name: {{ .name }}
          {{- if .emptyDir }}
          emptyDir:
            {{- if .emptyDir.sizeLimit }}
            sizeLimit: {{ .emptyDir.sizeLimit }}
            {{- end }}
          {{- end }}
        {{- end }}
        {{- if .Values.configMap.enabled }}
        - name: config-volume
          configMap:
            name: {{ include "my-web-app.fullname" . }}-config
        {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

### Service Template

```yaml
# templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "my-web-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  {{- with .Values.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "my-web-app.selectorLabels" . | nindent 4 }}
```

### Ingress Template

```yaml
# templates/ingress.yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-web-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "my-web-app.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

### ConfigMap Template

```yaml
# templates/configmap.yaml
{{- if .Values.configMap.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "my-web-app.fullname" . }}-config
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
data:
  {{- range $key, $value := .Values.configMap.data }}
  {{ $key }}: |
{{ $value | indent 4 }}
  {{- end }}
{{- end }}
```

### Secret Template

```yaml
# templates/secret.yaml
{{- if .Values.secrets.enabled }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "my-web-app.fullname" . }}-secret
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
type: Opaque
data:
  {{- range $key, $value := .Values.secrets.data }}
  {{ $key }}: {{ $value }}
  {{- end }}
{{- end }}
```

### HPA Template

```yaml
# templates/hpa.yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "my-web-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "my-web-app.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
{{- end }}
```

### ServiceMonitor Template

```yaml
# templates/servicemonitor.yaml
{{- if and .Values.monitoring.enabled .Values.monitoring.serviceMonitor.enabled }}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "my-web-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "my-web-app.selectorLabels" . | nindent 6 }}
  endpoints:
  - port: http
    path: {{ .Values.monitoring.serviceMonitor.path }}
    interval: {{ .Values.monitoring.serviceMonitor.interval }}
{{- end }}
```

## Helper Functions

### _helpers.tpl

```yaml
{{/*
# templates/_helpers.tpl
Expand the name of the chart.
*/}}
{{- define "my-web-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "my-web-app.fullname" -}}
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
Create chart name and version as used by the chart label.
*/}}
{{- define "my-web-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-web-app.labels" -}}
helm.sh/chart: {{ include "my-web-app.chart" . }}
{{ include "my-web-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.app.name }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "my-web-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-web-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "my-web-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "my-web-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate backend URL
*/}}
{{- define "my-web-app.backendUrl" -}}
{{- if .Values.ingress.enabled }}
{{- $host := index .Values.ingress.hosts 0 }}
{{- if .Values.ingress.tls }}
https://{{ $host.host }}
{{- else }}
http://{{ $host.host }}
{{- end }}
{{- else }}
http://{{ include "my-web-app.fullname" . }}:{{ .Values.service.port }}
{{- end }}
{{- end }}

{{/*
Database connection string
*/}}
{{- define "my-web-app.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "jdbc:postgresql://%s-postgresql:5432/%s" .Release.Name .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "my-web-app.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://%s-redis-master:6379" .Release.Name }}
{{- else }}
{{- .Values.externalRedis.url }}
{{- end }}
{{- end }}
```

## Multi-Environment Configuration

### Development Values

```yaml
# values-dev.yaml
replicaCount: 1

image:
  tag: "dev-latest"
  pullPolicy: Always

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false

ingress:
  hosts:
    - host: api-dev.mycompany.com
      paths:
        - path: /
          pathType: Prefix

postgresql:
  primary:
    persistence:
      size: 1Gi

redis:
  master:
    persistence:
      size: 512Mi

environment:
  - name: SPRING_PROFILES_ACTIVE
    value: "development"
  - name: JAVA_OPTS
    value: "-Xmx192m -Xms128m"
```

### Staging Values

```yaml
# values-staging.yaml
replicaCount: 2

image:
  tag: "staging-latest"

resources:
  limits:
    cpu: 300m
    memory: 384Mi
  requests:
    cpu: 150m
    memory: 192Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5

ingress:
  hosts:
    - host: api-staging.mycompany.com
      paths:
        - path: /
          pathType: Prefix

postgresql:
  primary:
    persistence:
      size: 5Gi

environment:
  - name: SPRING_PROFILES_ACTIVE
    value: "staging"
```

### Production Values

```yaml
# values-prod.yaml
replicaCount: 5

image:
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 50

ingress:
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "1000"
  hosts:
    - host: api.mycompany.com
      paths:
        - path: /
          pathType: Prefix

postgresql:
  primary:
    persistence:
      size: 100Gi
      storageClass: "premium-ssd"

redis:
  master:
    persistence:
      size: 10Gi

podDisruptionBudget:
  enabled: true
  minAvailable: 3

environment:
  - name: SPRING_PROFILES_ACTIVE
    value: "production"
  - name: JAVA_OPTS
    value: "-Xmx768m -Xms512m"
```

## Chart Dependencies

### requirements.yaml (Helm 2) / Chart.yaml dependencies (Helm 3)

```yaml
# Chart.yaml dependencies section için
dependencies:
  - name: postgresql
    version: "~12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
    tags:
      - database
  - name: redis
    version: "~17.3.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
    tags:
      - cache
  - name: prometheus
    version: "~15.0.0"
    repository: "https://prometheus-community.github.io/helm-charts"
    condition: monitoring.prometheus.enabled
    tags:
      - monitoring
```

### Dependencies Update

```bash
# Dependency güncelleme
helm dependency update

# Dependency build
helm dependency build

# Dependency list
helm dependency list
```

## Testing

### Test Templates

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "my-web-app.fullname" . }}-test"
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "my-web-app.fullname" . }}:{{ .Values.service.port }}/actuator/health']
```

### Test Commands

```bash
# Test çalıştırma
helm test my-release

# Test sonuçlarını görme
kubectl logs my-web-app-test

# Test pod'unu temizleme
helm test my-release --cleanup
```

## Advanced Helm Techniques

### Hooks

```yaml
# templates/job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ include "my-web-app.fullname" . }}-migration"
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    metadata:
      name: "{{ include "my-web-app.fullname" . }}-migration"
      labels:
        {{- include "my-web-app.selectorLabels" . | nindent 8 }}
    spec:
      restartPolicy: Never
      containers:
      - name: migration
        image: "{{ .Values.global.imageRegistry }}/{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        command:
        - /bin/sh
        - -c
        - |
          echo "Running database migration..."
          java -jar app.jar --spring.profiles.active=migration
```

### Notes Template

```yaml
# templates/NOTES.txt
1. Get the application URL by running these commands:
{{- if .Values.ingress.enabled }}
{{- range $host := .Values.ingress.hosts }}
  {{- range .paths }}
  http{{ if $.Values.ingress.tls }}s{{ end }}://{{ $host.host }}{{ .path }}
  {{- end }}
{{- end }}
{{- else if contains "NodePort" .Values.service.type }}
  export NODE_PORT=$(kubectl get --namespace {{ .Release.Namespace }} -o jsonpath="{.spec.ports[0].nodePort}" services {{ include "my-web-app.fullname" . }})
  export NODE_IP=$(kubectl get nodes --namespace {{ .Release.Namespace }} -o jsonpath="{.items[0].status.addresses[0].address}")
  echo http://$NODE_IP:$NODE_PORT
{{- else if contains "LoadBalancer" .Values.service.type }}
     NOTE: It may take a few minutes for the LoadBalancer IP to be available.
           You can watch the status of by running 'kubectl get --namespace {{ .Release.Namespace }} svc -w {{ include "my-web-app.fullname" . }}'
  export SERVICE_IP=$(kubectl get svc --namespace {{ .Release.Namespace }} {{ include "my-web-app.fullname" . }} --template "{{"{{ range (index .status.loadBalancer.ingress 0) }}{{.}}{{ end }}"}}")
  echo http://$SERVICE_IP:{{ .Values.service.port }}
{{- else if contains "ClusterIP" .Values.service.type }}
  export POD_NAME=$(kubectl get pods --namespace {{ .Release.Namespace }} -l "{{ include "my-web-app.selectorLabels" . }}" -o jsonpath="{.items[0].metadata.name}")
  export CONTAINER_PORT=$(kubectl get pod --namespace {{ .Release.Namespace }} $POD_NAME -o jsonpath="{.spec.containers[0].ports[0].containerPort}")
  echo "Visit http://127.0.0.1:8080 to use your application"
  kubectl --namespace {{ .Release.Namespace }} port-forward $POD_NAME 8080:$CONTAINER_PORT
{{- end }}

2. Check the status of the deployment:
   kubectl get pods -l "{{ include "my-web-app.selectorLabels" . }}" -n {{ .Release.Namespace }}

3. View application logs:
   kubectl logs -f deployment/{{ include "my-web-app.fullname" . }} -n {{ .Release.Namespace }}

{{- if .Values.postgresql.enabled }}
4. Get PostgreSQL connection details:
   echo "PostgreSQL URL: {{ include "my-web-app.databaseUrl" . }}"
   echo "PostgreSQL Password: $(kubectl get secret --namespace {{ .Release.Namespace }} {{ .Release.Name }}-postgresql -o jsonpath="{.data.postgres-password}" | base64 --decode)"
{{- end }}

{{- if .Values.redis.enabled }}
5. Get Redis connection details:
   echo "Redis URL: {{ include "my-web-app.redisUrl" . }}"
   echo "Redis Password: $(kubectl get secret --namespace {{ .Release.Namespace }} {{ .Release.Name }}-redis -o jsonpath="{.data.redis-password}" | base64 --decode)"
{{- end }}
```

## Packaging ve Repository

### Chart Packaging

```bash
# Chart package oluşturma
helm package ./my-web-app

# Chart package'ı belirli dizine kaydetme
helm package ./my-web-app -d ./packages

# Package'ı sign etme
helm package ./my-web-app --sign --key mykey --keyring ~/.gnupg/secring.gpg
```

### Chart Repository

```bash
# Local repository oluşturma
helm repo index ./packages --url https://my-charts.mycompany.com

# Repository'ye chart ekleme
helm repo add mycompany https://my-charts.mycompany.com
helm repo update

# Chart'ı repository'den install etme
helm install my-release mycompany/my-web-app
```

## Best Practices

### Values Organization

```yaml
# values.yaml structure best practices
global:
  # Global values here

# Application specific values
app:
  name: my-web-app
  component: backend

# Image configuration
image:
  repository: my-web-app
  tag: ""  # Will use appVersion from Chart.yaml
  pullPolicy: IfNotPresent

# Don't use camelCase for keys that map to Kubernetes resources
service:
  type: ClusterIP
  port: 80

# Use clear, descriptive names
database:
  enabled: true
  host: postgres-service
  port: 5432
```

### Template Best Practices

```yaml
# Use consistent indentation
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}

# Use meaningful comments
{{/*
This template generates the deployment for the web application.
It includes configurable replicas, resources, and health checks.
*/}}

# Validate required values
{{- if not .Values.image.repository }}
{{- fail "image.repository is required" }}
{{- end }}

# Use proper conditionals
{{- if and .Values.ingress.enabled .Values.ingress.hosts }}
# Ingress configuration here
{{- end }}
```

Bu kapsamlı Helm rehberi, Kubernetes uygulamalarınızı etkili bir şekilde paketleyip yönetmeniz için gereken tüm bilgileri içermektedir. Helm Charts kullanarak uygulamalarınızı farklı ortamlarda tutarlı bir şekilde dağıtabilir ve yönetebilirsiniz.
