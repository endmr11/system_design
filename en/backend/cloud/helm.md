# Helm Charts

## What is Helm?

Helm is the package manager for Kubernetes. It helps you manage Kubernetes applications through Helm Charts, which are collections of files that describe a related set of Kubernetes resources.

## Core Concepts

### Chart
A Chart is a Helm package containing all of the resource definitions necessary to run an application, tool, or service inside a Kubernetes cluster.

### Release
A Release is an instance of a chart running in a Kubernetes cluster. A single chart can be installed multiple times into the same cluster with different release names.

### Repository
A Repository is a place where charts can be collected and shared.

## Basic Chart Structure

```
mychart/
  Chart.yaml          # Chart metadata
  values.yaml         # Default configuration values
  charts/             # Chart dependencies
  templates/          # Template files
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
    _helpers.tpl      # Template helpers
  .helmignore         # Files to ignore when packaging
```

## Chart.yaml

```yaml
apiVersion: v2
name: myapp
description: A Helm chart for my application
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - web
  - application
home: https://github.com/mycompany/myapp
sources:
  - https://github.com/mycompany/myapp
maintainers:
  - name: DevOps Team
    email: devops@mycompany.com
dependencies:
  - name: postgresql
    version: 11.6.12
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 16.9.11
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

## Values.yaml

```yaml
# Default values for myapp
replicaCount: 3

image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: "1.0.0"

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  fsGroup: 2000

securityContext:
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

# Application-specific configuration
config:
  database:
    host: ""
    port: 5432
    name: myapp
    user: myapp
  redis:
    host: ""
    port: 6379
  logging:
    level: INFO
  features:
    newFeature: false

# External dependencies
postgresql:
  enabled: true
  auth:
    postgresPassword: secretPassword
    username: myapp
    password: myappPassword
    database: myapp

redis:
  enabled: true
  auth:
    enabled: false
```

## Template Files

### Deployment Template

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "myapp.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: DATABASE_HOST
              value: {{ include "myapp.databaseHost" . }}
            - name: DATABASE_PORT
              value: "{{ .Values.config.database.port }}"
            - name: DATABASE_NAME
              value: {{ .Values.config.database.name }}
            - name: DATABASE_USER
              value: {{ .Values.config.database.user }}
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "myapp.fullname" . }}-db
                  key: password
            - name: REDIS_HOST
              value: {{ include "myapp.redisHost" . }}
            - name: REDIS_PORT
              value: "{{ .Values.config.redis.port }}"
            - name: LOG_LEVEL
              value: {{ .Values.config.logging.level }}
          envFrom:
            - configMapRef:
                name: {{ include "myapp.fullname" . }}-config
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: config-volume
              mountPath: /etc/config
              readOnly: true
      volumes:
        - name: config-volume
          configMap:
            name: {{ include "myapp.fullname" . }}-config
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
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "myapp.selectorLabels" . | nindent 4 }}
```

### Ingress Template

```yaml
# templates/ingress.yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
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
                name: {{ include "myapp.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

### ConfigMap Template

```yaml
# templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "myapp.fullname" . }}-config
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
data:
  APP_NAME: {{ include "myapp.fullname" . }}
  ENVIRONMENT: {{ .Values.global.environment | default "production" }}
  NEW_FEATURE_ENABLED: {{ .Values.config.features.newFeature | quote }}
  config.yaml: |
    server:
      port: {{ .Values.service.targetPort }}
    database:
      host: {{ include "myapp.databaseHost" . }}
      port: {{ .Values.config.database.port }}
      name: {{ .Values.config.database.name }}
    redis:
      host: {{ include "myapp.redisHost" . }}
      port: {{ .Values.config.redis.port }}
    logging:
      level: {{ .Values.config.logging.level }}
```

### Secret Template

```yaml
# templates/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "myapp.fullname" . }}-db
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
type: Opaque
data:
  {{- if .Values.postgresql.enabled }}
  password: {{ .Values.postgresql.auth.password | b64enc }}
  {{- else }}
  password: {{ required "Database password is required when postgresql is disabled" .Values.config.database.password | b64enc }}
  {{- end }}
```

## Helper Templates

```yaml
# templates/_helpers.tpl
{{/*
Expand the name of the chart.
*/}}
{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "myapp.fullname" -}}
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
{{- define "myapp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "myapp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "myapp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "myapp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database host helper
*/}}
{{- define "myapp.databaseHost" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "myapp.fullname" .) }}
{{- else }}
{{- required "Database host is required when postgresql is disabled" .Values.config.database.host }}
{{- end }}
{{- end }}

{{/*
Redis host helper
*/}}
{{- define "myapp.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "myapp.fullname" .) }}
{{- else }}
{{- required "Redis host is required when redis is disabled" .Values.config.redis.host }}
{{- end }}
{{- end }}
```

## HPA Template

```yaml
# templates/hpa.yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "myapp.fullname" . }}
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

## Multi-Environment Values

### values-dev.yaml

```yaml
# Development environment values
replicaCount: 1

image:
  repository: myapp
  tag: "dev"
  pullPolicy: Always

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

config:
  logging:
    level: DEBUG
  features:
    newFeature: true

postgresql:
  enabled: true
  auth:
    postgresPassword: devPassword
    password: devPassword

redis:
  enabled: true

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: myapp-dev.internal
      paths:
        - path: /
          pathType: Prefix
```

### values-staging.yaml

```yaml
# Staging environment values
replicaCount: 2

image:
  repository: myapp
  tag: "staging"

resources:
  limits:
    cpu: 300m
    memory: 384Mi
  requests:
    cpu: 150m
    memory: 192Mi

config:
  logging:
    level: INFO
  features:
    newFeature: true

postgresql:
  enabled: true
  auth:
    postgresPassword: stagingPassword
    password: stagingPassword

redis:
  enabled: true

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
  hosts:
    - host: myapp-staging.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-staging-tls
      hosts:
        - myapp-staging.example.com
```

### values-prod.yaml

```yaml
# Production environment values
replicaCount: 5

image:
  repository: myapp
  tag: "1.0.0"

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

config:
  logging:
    level: WARN
  features:
    newFeature: false

postgresql:
  enabled: false
  # Use external database in production
config:
  database:
    host: prod-db.example.com
    password: productionPassword

redis:
  enabled: false
config:
  redis:
    host: prod-redis.example.com

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-prod-tls
      hosts:
        - myapp.example.com

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
            - myapp
        topologyKey: kubernetes.io/hostname
```

## Chart Testing

### values-test.yaml

```yaml
# Test values
replicaCount: 1

image:
  repository: myapp
  tag: "test"

config:
  logging:
    level: DEBUG

postgresql:
  enabled: true
  auth:
    postgresPassword: testPassword
    password: testPassword

redis:
  enabled: true
```

### Test Templates

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "myapp.fullname" . }}-test-connection"
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "myapp.fullname" . }}:{{ .Values.service.port }}/health']
```

## Helm Commands

### Basic Commands

```bash
# Create a new chart
helm create mychart

# Validate chart
helm lint mychart/

# Dry run installation
helm install myrelease mychart/ --dry-run --debug

# Install chart
helm install myrelease mychart/

# Install with custom values
helm install myrelease mychart/ -f values-prod.yaml

# Install with overrides
helm install myrelease mychart/ --set replicaCount=5 --set image.tag=v2.0.0

# List releases
helm list

# Get release info
helm get values myrelease
helm get manifest myrelease

# Upgrade release
helm upgrade myrelease mychart/ -f values-prod.yaml

# Rollback release
helm rollback myrelease 1

# Uninstall release
helm uninstall myrelease

# Test release
helm test myrelease
```

### Package and Repository

```bash
# Package chart
helm package mychart/

# Create repository index
helm repo index .

# Add repository
helm repo add myrepo https://charts.example.com

# Update repositories
helm repo update

# Search charts
helm search repo myapp

# Install from repository
helm install myrelease myrepo/myapp
```

## Chart Dependencies

### Chart.yaml with Dependencies

```yaml
apiVersion: v2
name: myapp
description: A Helm chart for Kubernetes
type: application
version: 0.1.0
appVersion: "1.16.0"

dependencies:
  - name: postgresql
    version: "11.6.12"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
  - name: redis
    version: "16.9.11"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
  - name: nginx-ingress
    version: "4.1.0"
    repository: "https://kubernetes.github.io/ingress-nginx"
    condition: ingress.controller.enabled
```

### Managing Dependencies

```bash
# Download dependencies
helm dependency update

# Build dependencies
helm dependency build

# List dependencies
helm dependency list
```

## Hooks

### Pre-Install Hook

```yaml
# templates/hooks/pre-install-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ include "myapp.fullname" . }}-pre-install"
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    metadata:
      name: "{{ include "myapp.fullname" . }}-pre-install"
    spec:
      restartPolicy: Never
      containers:
      - name: pre-install-job
        image: busybox
        command: ['sh', '-c', 'echo "Running pre-install setup..." && sleep 10']
```

### Post-Install Hook

```yaml
# templates/hooks/post-install-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ include "myapp.fullname" . }}-post-install"
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": post-install
    "helm.sh/hook-weight": "1"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    metadata:
      name: "{{ include "myapp.fullname" . }}-post-install"
    spec:
      restartPolicy: Never
      containers:
      - name: post-install-job
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        command: ['sh', '-c', 'echo "Running database migrations..." && sleep 5']
        env:
        - name: DATABASE_URL
          value: "postgresql://{{ include "myapp.databaseHost" . }}:5432/{{ .Values.config.database.name }}"
```

## Best Practices

### 1. Use Meaningful Names

```yaml
# Good
{{- define "myapp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
```

### 2. Validate Required Values

```yaml
{{- if not .Values.database.host }}
{{- fail "Database host is required" }}
{{- end }}

# Or using required function
host: {{ required "Database host is required" .Values.database.host }}
```

### 3. Use Checksums for ConfigMaps

```yaml
template:
  metadata:
    annotations:
      checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```

### 4. Provide Sensible Defaults

```yaml
# values.yaml
image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: "" # Will use Chart.AppVersion if not set

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### 5. Document Your Chart

```yaml
# Chart.yaml
description: |
  A comprehensive Helm chart for deploying myapp with:
  - Automatic scaling support
  - Multiple environment configurations
  - Integrated monitoring
  - Security best practices
```

This comprehensive guide covers Helm Charts fundamentals, templating, dependencies, testing, and deployment strategies for Kubernetes applications.