# Kubernetes Temelleri

## Giriş

Kubernetes, konteynerleri organize etmek, ölçeklendirmek ve yönetmek için kullanılan açık kaynaklı bir container orkestrasyon platformudur. Google tarafından geliştirilen Kubernetes, modern uygulama dağıtımının temel taşlarından biridir.

## Kubernetes Mimarisi

### Ana Bileşenler

```yaml
# cluster-architecture.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-info
  namespace: kube-system
data:
  cluster-config: |
    Master Components:
    - API Server (kube-apiserver)
    - etcd (Cluster store)
    - Scheduler (kube-scheduler)
    - Controller Manager (kube-controller-manager)
    
    Node Components:
    - kubelet (Node agent)
    - kube-proxy (Network proxy)
    - Container Runtime (Docker/containerd/CRI-O)
```

### Master Düğümü Bileşenleri

```bash
# Master düğümü durumunu kontrol et
kubectl get componentstatuses

# API Server durumu
kubectl cluster-info

# etcd cluster health
kubectl get --raw='/healthz/etcd'
```

## Pod Yönetimi

### Temel Pod Tanımı

```yaml
# spring-boot-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: spring-boot-app
  labels:
    app: spring-boot-app
    version: "1.0"
    environment: production
spec:
  containers:
  - name: app-container
    image: spring-boot-app:1.0.0
    ports:
    - containerPort: 8080
      name: http
      protocol: TCP
    - containerPort: 8081
      name: management
      protocol: TCP
    env:
    - name: SPRING_PROFILES_ACTIVE
      value: "production"
    - name: SERVER_PORT
      value: "8080"
    - name: MANAGEMENT_SERVER_PORT
      value: "8081"
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
      limits:
        memory: "1Gi"
        cpu: "500m"
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8081
      initialDelaySeconds: 60
      periodSeconds: 30
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8081
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3
  restartPolicy: Always
  terminationGracePeriodSeconds: 30
```

## Deployment Yönetimi

### Temel Deployment

```yaml
# spring-boot-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spring-boot-deployment
  labels:
    app: spring-boot-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: spring-boot-app
  template:
    metadata:
      labels:
        app: spring-boot-app
        version: "1.0"
    spec:
      containers:
      - name: spring-boot-app
        image: spring-boot-app:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "kubernetes"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Service Türleri

### ClusterIP Service

```yaml
# clusterip-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: spring-boot-service
  labels:
    app: spring-boot-app
spec:
  type: ClusterIP
  selector:
    app: spring-boot-app
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: management
    port: 8081
    targetPort: 8081
    protocol: TCP
  sessionAffinity: None
```

### LoadBalancer Service

```yaml
# loadbalancer-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: spring-boot-loadbalancer
  labels:
    app: spring-boot-app
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: spring-boot-app
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
```

## Ingress Yönetimi

### Temel Ingress

```yaml
# spring-boot-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: spring-boot-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-secret
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: spring-boot-service
            port:
              number: 80
```

## ConfigMap ve Secret Yönetimi

### ConfigMap Kullanımı

```yaml
# application-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: spring-boot-config
  labels:
    app: spring-boot-app
data:
  application.properties: |
    server.port=8080
    management.server.port=8081
    management.endpoints.web.exposure.include=health,info,metrics,prometheus
    spring.datasource.hikari.maximum-pool-size=20
    logging.level.com.example=INFO
```

### Secret Yönetimi

```yaml
# database-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
  labels:
    app: spring-boot-app
type: Opaque
data:
  url: amRiYzpwb3N0Z3Jlc3FsOi8vcG9zdGdyZXNxbC1zZXJ2aWNlOjU0MzIvc3ByaW5nYm9vdGRi
  username: c3ByaW5nYm9vdA==
  password: U3VwZXJTZWNyZXRQYXNzd29yZDEyMyE=
```

## Horizontal Pod Autoscaler (HPA)

```yaml
# hpa-configuration.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: spring-boot-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: spring-boot-deployment
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## RBAC (Role-Based Access Control)

```yaml
# rbac-configuration.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: spring-boot-sa
  namespace: production

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: spring-boot-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: spring-boot-role-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: spring-boot-sa
  namespace: production
roleRef:
  kind: Role
  name: spring-boot-role
  apiGroup: rbac.authorization.k8s.io
```

## kubectl Komutları

### Temel Komutlar

```bash
# Cluster bilgilerini görüntüle
kubectl cluster-info
kubectl get nodes
kubectl get namespaces

# Pod yönetimi
kubectl get pods
kubectl get pods -o wide
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- /bin/bash

# Deployment yönetimi
kubectl get deployments
kubectl scale deployment <deployment-name> --replicas=5
kubectl rollout status deployment <deployment-name>
kubectl rollout undo deployment <deployment-name>

# Service yönetimi
kubectl get services
kubectl port-forward service/<service-name> 8080:80

# Resource uygulama
kubectl apply -f <file.yaml>
kubectl delete -f <file.yaml>

# Resource monitoring
kubectl top nodes
kubectl top pods
```

## Best Practices

### Resource Yönetimi

1. **Resource Limits ve Requests**
   - Her container için resource requests ve limits tanımlayın
   - QoS sınıflarını doğru kullanın
   - Memory ve CPU kullanımını monitoring edin

2. **Health Checks**
   - Liveness ve readiness probe'ları tanımlayın
   - Uygun timeout ve threshold değerleri kullanın

3. **Security**
   - Non-root user kullanın
   - SecurityContext tanımlayın
   - Network policies uygulayın

### Deployment Stratejileri

1. **Rolling Updates**
   - Uygun maxUnavailable ve maxSurge değerleri kullanın
   - Deployment'ları aşamalı olarak test edin

2. **Namespace Organizasyonu**
   - Environment'lara göre namespace ayırın
   - Resource quota'ları kullanın

3. **Monitoring ve Logging**
   - Centralized logging sistemi kurun
   - Metrics collection'ı implement edin

Kubernetes, modern uygulama deployment'ının temel taşıdır. Doğru konfigürasyon ve best practice'ler ile yüksek performanslı, güvenilir ve ölçeklenebilir uygulamalar deploy edebilirsiniz.