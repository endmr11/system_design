# Metrics (Prometheus, Grafana) - Metrik Toplama ve İzleme

Uygulama performansını ve sistem sağlığını izlemek için metriklerin toplanması ve görselleştirilmesi kritiktir.

## Spring Boot Actuator Metrics

### Micrometer Entegrasyonu

Micrometer, vendor-neutral metrics facade olarak çeşitli monitoring sistemleriyle entegrasyon sağlar:

```xml
<!-- pom.xml - Micrometer bağımlılıkları -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-registry-prometheus</artifactId>
    </dependency>
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
</dependencies>
```

### Metrics Configuration

```yaml
# application.yml - Metrics yapılandırması
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
    metrics:
      enabled: true
    prometheus:
      enabled: true
  metrics:
    export:
      prometheus:
        enabled: true
        descriptions: true
        step: 10s
    web:
      server:
        request:
          autotime:
            enabled: true
            percentiles: [0.5, 0.9, 0.95, 0.99]
    distribution:
      percentiles-histogram:
        http.server.requests: true
      sla:
        http.server.requests: 50ms,100ms,200ms,500ms,1s,2s
    tags:
      application: ${spring.application.name}
      instance: ${spring.cloud.client.hostname:${spring.application.name}}
      version: ${app.version:unknown}
```

### Custom Metrics Service

```java
@Service
@Component
public class ApplicationMetricsService {
    
    private final MeterRegistry meterRegistry;
    private final Counter orderCreatedCounter;
    private final Counter orderFailedCounter;
    private final Timer orderProcessingTimer;
    private final Gauge activeUsersGauge;
    private final DistributionSummary orderAmountSummary;
    
    private final AtomicInteger activeUsers = new AtomicInteger(0);
    
    public ApplicationMetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        // Counter metrikleri
        this.orderCreatedCounter = Counter.builder("orders.created.total")
                .description("Total number of orders created")
                .tag("status", "success")
                .register(meterRegistry);
                
        this.orderFailedCounter = Counter.builder("orders.failed.total")
                .description("Total number of failed orders")
                .register(meterRegistry);
        
        // Timer metrikleri
        this.orderProcessingTimer = Timer.builder("order.processing.duration")
                .description("Time spent processing orders")
                .publishPercentiles(0.5, 0.9, 0.95, 0.99)
                .register(meterRegistry);
        
        // Gauge metrikleri
        this.activeUsersGauge = Gauge.builder("users.active.current")
                .description("Current number of active users")
                .register(meterRegistry, activeUsers, AtomicInteger::get);
        
        // Distribution Summary
        this.orderAmountSummary = DistributionSummary.builder("order.amount")
                .description("Distribution of order amounts")
                .baseUnit("currency")
                .publishPercentiles(0.5, 0.9, 0.95, 0.99)
                .register(meterRegistry);
    }
    
    public void incrementOrderCreated(String customerType, String paymentMethod) {
        orderCreatedCounter.increment(
                Tags.of(
                    Tag.of("customer.type", customerType),
                    Tag.of("payment.method", paymentMethod)
                )
        );
    }
    
    public void incrementOrderFailed(String reason, String customerType) {
        orderFailedCounter.increment(
                Tags.of(
                    Tag.of("failure.reason", reason),
                    Tag.of("customer.type", customerType)
                )
        );
    }
    
    public Timer.Sample startOrderProcessing() {
        return Timer.start(meterRegistry);
    }
    
    public void recordOrderProcessingTime(Timer.Sample sample, String orderType) {
        sample.stop(Timer.builder("order.processing.duration")
                .tag("order.type", orderType)
                .register(meterRegistry));
    }
    
    public void recordOrderAmount(double amount, String currency) {
        orderAmountSummary.record(amount, 
                Tags.of(Tag.of("currency", currency)));
    }
    
    public void incrementActiveUsers() {
        activeUsers.incrementAndGet();
    }
    
    public void decrementActiveUsers() {
        activeUsers.decrementAndGet();
    }
    
    // Business metrikleri
    public void recordBusinessMetric(String metricName, double value, String... tags) {
        Gauge.builder(metricName)
                .tags(tags)
                .register(meterRegistry, value, (v) -> v);
    }
}
```

### Metrics Aspects

```java
@Aspect
@Component
public class MetricsAspect {
    
    private final MeterRegistry meterRegistry;
    
    public MetricsAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    @Around("@annotation(Timed)")
    public Object measureExecutionTime(ProceedingJoinPoint joinPoint, Timed timed) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        return Timer.builder("method.execution.time")
                .description("Method execution time")
                .tag("class", className)
                .tag("method", methodName)
                .register(meterRegistry)
                .recordCallable(() -> {
                    try {
                        return joinPoint.proceed();
                    } catch (Throwable throwable) {
                        throw new RuntimeException(throwable);
                    }
                });
    }
    
    @Around("@annotation(Counted)")
    public Object countMethodCalls(ProceedingJoinPoint joinPoint, Counted counted) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        Counter counter = Counter.builder("method.calls.total")
                .description("Method call count")
                .tag("class", className)
                .tag("method", methodName)
                .register(meterRegistry);
        
        try {
            Object result = joinPoint.proceed();
            counter.increment(Tags.of(Tag.of("result", "success")));
            return result;
        } catch (Exception e) {
            counter.increment(Tags.of(Tag.of("result", "error")));
            throw e;
        }
    }
}
```

## Prometheus Entegrasyonu

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'spring-boot-apps'
    static_configs:
      - targets: ['localhost:8080', 'localhost:8081']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 5s
    scrape_timeout: 3s
    
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Alert Rules

```yaml
# alert_rules.yml
groups:
  - name: application_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_server_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_server_requests_duration_seconds_bucket[5m])) > 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"
          
      - alert: DatabaseConnectionPoolExhausted
        expr: hikaricp_connections_active / hikaricp_connections_max > 0.9
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value }}% of database connections are in use"
          
      - alert: JVMMemoryHigh
        expr: jvm_memory_used_bytes / jvm_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "JVM memory usage high"
          description: "JVM memory usage is {{ $value }}%"
          
      - alert: OrderProcessingFailureRateHigh
        expr: rate(orders_failed_total[5m]) / rate(orders_created_total[5m]) > 0.05
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Order processing failure rate high"
          description: "Order failure rate is {{ $value }}%"
```

### Docker Compose Setup

```yaml
# docker-compose.yml - Prometheus & Grafana
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - ./grafana/provisioning:/etc/grafana/provisioning

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:
```

## Grafana Dashboard'ları

### Application Overview Dashboard

```json
{
  "dashboard": {
    "title": "Spring Boot Application Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_server_requests_total[5m])",
            "legendFormat": "{{method}} {{uri}}"
          }
        ]
      },
      {
        "title": "Response Time Percentiles",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_server_requests_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_server_requests_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_server_requests_duration_seconds_bucket[5m]))",
            "legendFormat": "99th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_server_requests_total{status=~\"4..|5..\"}[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "JVM Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "jvm_memory_used_bytes{area=\"heap\"} / 1024 / 1024",
            "legendFormat": "Heap Used (MB)"
          },
          {
            "expr": "jvm_memory_max_bytes{area=\"heap\"} / 1024 / 1024",
            "legendFormat": "Heap Max (MB)"
          }
        ]
      }
    ]
  }
}
```

### Business Metrics Dashboard

```json
{
  "dashboard": {
    "title": "Business Metrics Dashboard",
    "panels": [
      {
        "title": "Orders Created per Minute",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(orders_created_total[1m]) * 60",
            "legendFormat": "Orders/min"
          }
        ]
      },
      {
        "title": "Order Processing Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(order_processing_duration_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "users_active_current",
            "legendFormat": "Active Users"
          }
        ]
      },
      {
        "title": "Revenue per Hour",
        "type": "graph",
        "targets": [
          {
            "expr": "increase(order_amount_sum[1h])",
            "legendFormat": "Revenue/hour"
          }
        ]
      }
    ]
  }
}
```

### Infrastructure Monitoring

```java
@Component
public class InfrastructureMetrics {
    
    private final MeterRegistry meterRegistry;
    
    public InfrastructureMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        initializeSystemMetrics();
    }
    
    private void initializeSystemMetrics() {
        // CPU kullanımı
        Gauge.builder("system.cpu.usage")
                .register(meterRegistry, this, InfrastructureMetrics::getCpuUsage);
        
        // Disk kullanımı
        Gauge.builder("system.disk.usage")
                .tag("path", "/")
                .register(meterRegistry, this, InfrastructureMetrics::getDiskUsage);
        
        // Network I/O
        Gauge.builder("system.network.bytes.sent")
                .register(meterRegistry, this, InfrastructureMetrics::getNetworkBytesSent);
        
        // Database connection pool
        Gauge.builder("database.connections.active")
                .register(meterRegistry, this, InfrastructureMetrics::getActiveConnections);
    }
    
    private double getCpuUsage(InfrastructureMetrics metrics) {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
            return ((com.sun.management.OperatingSystemMXBean) osBean).getProcessCpuLoad();
        }
        return 0.0;
    }
    
    private double getDiskUsage(InfrastructureMetrics metrics) {
        File root = new File("/");
        long totalSpace = root.getTotalSpace();
        long usableSpace = root.getUsableSpace();
        return (double) (totalSpace - usableSpace) / totalSpace;
    }
    
    private double getNetworkBytesSent(InfrastructureMetrics metrics) {
        // Network metrics implementation
        return 0.0;
    }
    
    private double getActiveConnections(InfrastructureMetrics metrics) {
        // Database connection pool metrics
        return 0.0;
    }
}
```

Bu Türkçe metrics dokümantasyonu, Spring Boot Actuator, Micrometer, Prometheus ve Grafana entegrasyonunu detaylı bir şekilde ele alır ve production-ready monitoring çözümü sunar.
