# Containers (Docker)

## Giriş

Containerlar, uygulamaların ve bağımlılıklarının izole edilmiş ortamlarda çalıştırılması için kullanılan hafif sanallaştırma teknolojisidir. Docker, bu teknolojinin en yaygın kullanılan implementasyonudur.

## Docker Temel Kavramlar

### 1. Docker Architecture

```dockerfile
# Multi-stage Dockerfile örneği
FROM openjdk:11-jdk-slim AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM openjdk:11-jre-slim
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
EXPOSE 8080
USER 1000:1000
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Best practices Dockerfile yazımı**:
```dockerfile
# Base image optimizasyonu
FROM alpine:3.15 AS base

# Security: Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Package installation ve cleanup
RUN apk add --no-cache \
    openjdk11-jre \
    && rm -rf /var/cache/apk/*

# Working directory
WORKDIR /app

# Copy application
COPY --chown=appuser:appgroup target/app.jar app.jar

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Switch to non-root user
USER appuser

# Startup command
ENTRYPOINT ["java", "-Xmx512m", "-Xms256m", "-jar", "app.jar"]
```

### 2. Docker Compose Configuration

**Multi-service application** örneği:
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - DATABASE_URL=jdbc:postgresql://db:5432/appdb
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network
    volumes:
      - app-logs:/var/log/app
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  db:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  app-logs:

networks:
  app-network:
    driver: bridge
```

## Container Runtime Configuration

### 1. Docker Security Configuration

**Security best practices** Spring Boot uygulaması için:
```java
@Configuration
@EnableWebSecurity
public class DockerSecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                .frameOptions().deny()
                .contentTypeOptions().and()
                .httpStrictTransportSecurity(hstsConfig -> hstsConfig
                    .maxAgeInSeconds(31536000)
                    .includeSubdomains(true)
                    .preload(true)
                )
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );
        
        return http.build();
    }
}
```

**Container resource monitoring**:
```java
@Component
public class ContainerMetricsCollector {
    
    private final MeterRegistry meterRegistry;
    
    public ContainerMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        initializeMetrics();
    }
    
    private void initializeMetrics() {
        // Memory metrics
        Gauge.builder("container.memory.usage")
                .description("Container memory usage")
                .register(meterRegistry, this, ContainerMetricsCollector::getMemoryUsage);
        
        // CPU metrics
        Gauge.builder("container.cpu.usage")
                .description("Container CPU usage")
                .register(meterRegistry, this, ContainerMetricsCollector::getCpuUsage);
        
        // Disk metrics
        Gauge.builder("container.disk.usage")
                .description("Container disk usage")
                .register(meterRegistry, this, ContainerMetricsCollector::getDiskUsage);
    }
    
    private double getMemoryUsage(ContainerMetricsCollector collector) {
        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        return (double) (totalMemory - freeMemory) / totalMemory * 100;
    }
    
    private double getCpuUsage(ContainerMetricsCollector collector) {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
            return ((com.sun.management.OperatingSystemMXBean) osBean).getProcessCpuLoad() * 100;
        }
        return 0.0;
    }
    
    private double getDiskUsage(ContainerMetricsCollector collector) {
        File root = new File("/");
        long totalSpace = root.getTotalSpace();
        long usableSpace = root.getUsableSpace();
        return (double) (totalSpace - usableSpace) / totalSpace * 100;
    }
}
```

### 2. Container Networking

**Network bridge configuration**:
```bash
#!/bin/bash

# Custom Docker network oluşturma
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --ip-range=172.20.240.0/20 \
  --gateway=172.20.0.1 \
  app-network

# Network security policies
docker network create --driver bridge \
  --opt com.docker.network.bridge.enable_icc=false \
  --opt com.docker.network.bridge.enable_ip_masquerade=true \
  secure-network
```

**Service discovery** Docker Compose ile:
```java
@Service
public class ServiceDiscoveryService {
    
    @Value("${service.registry.url:http://consul:8500}")
    private String registryUrl;
    
    @Autowired
    private RestTemplate restTemplate;
    
    public List<ServiceInstance> discoverServices(String serviceName) {
        try {
            String url = registryUrl + "/v1/health/service/" + serviceName + "?passing=true";
            ConsulHealthResponse response = restTemplate.getForObject(url, ConsulHealthResponse.class);
            
            return response.getServices().stream()
                    .map(this::mapToServiceInstance)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Service discovery failed for service: {}", serviceName, e);
            return Collections.emptyList();
        }
    }
    
    private ServiceInstance mapToServiceInstance(ConsulService consulService) {
        return ServiceInstance.builder()
                .serviceId(consulService.getService().getId())
                .serviceName(consulService.getService().getService())
                .host(consulService.getService().getAddress())
                .port(consulService.getService().getPort())
                .metadata(consulService.getService().getMeta())
                .build();
    }
}
```

## Container Image Management

### 1. Registry Integration

**Docker Registry** authentication ve push/pull işlemleri:
```java
@Service
public class DockerRegistryService {
    
    @Value("${docker.registry.url}")
    private String registryUrl;
    
    @Value("${docker.registry.username}")
    private String username;
    
    @Value("${docker.registry.password}")
    private String password;
    
    public void pushImage(String imageName, String tag) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "push", registryUrl + "/" + imageName + ":" + tag
            );
            
            Process process = pb.start();
            int exitCode = process.waitFor();
            
            if (exitCode != 0) {
                throw new RuntimeException("Docker push failed with exit code: " + exitCode);
            }
            
            log.info("Successfully pushed image: {}/{}}:{}", registryUrl, imageName, tag);
        } catch (Exception e) {
            log.error("Failed to push image: {}", imageName, e);
            throw new RuntimeException("Image push failed", e);
        }
    }
    
    public boolean pullImage(String imageName, String tag) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "pull", registryUrl + "/" + imageName + ":" + tag
            );
            
            Process process = pb.start();
            int exitCode = process.waitFor();
            
            return exitCode == 0;
        } catch (Exception e) {
            log.error("Failed to pull image: {}:{}", imageName, tag, e);
            return false;
        }
    }
}
```

**Image vulnerability scanning** entegrasyonu:
```java
@Component
public class ImageSecurityScanner {
    
    @Autowired
    private DockerClient dockerClient;
    
    public SecurityScanResult scanImage(String imageId) {
        try {
            // Trivy scanner kullanarak vulnerability check
            ProcessBuilder pb = new ProcessBuilder(
                "trivy", "image", "--format", "json", "--output", "/tmp/scan-result.json", imageId
            );
            
            Process process = pb.start();
            process.waitFor();
            
            // Scan sonuçlarını parse et
            String scanOutput = Files.readString(Paths.get("/tmp/scan-result.json"));
            ObjectMapper mapper = new ObjectMapper();
            TrivyScanResult trivyResult = mapper.readValue(scanOutput, TrivyScanResult.class);
            
            return mapToSecurityScanResult(trivyResult);
        } catch (Exception e) {
            log.error("Image security scan failed for image: {}", imageId, e);
            throw new SecurityScanException("Security scan failed", e);
        }
    }
    
    private SecurityScanResult mapToSecurityScanResult(TrivyScanResult trivyResult) {
        List<Vulnerability> vulnerabilities = trivyResult.getResults().stream()
                .flatMap(result -> result.getVulnerabilities().stream())
                .map(this::mapVulnerability)
                .collect(Collectors.toList());
        
        return SecurityScanResult.builder()
                .imageId(trivyResult.getArtifactName())
                .scanDate(Instant.now())
                .totalVulnerabilities(vulnerabilities.size())
                .criticalCount(countBySeverity(vulnerabilities, "CRITICAL"))
                .highCount(countBySeverity(vulnerabilities, "HIGH"))
                .mediumCount(countBySeverity(vulnerabilities, "MEDIUM"))
                .lowCount(countBySeverity(vulnerabilities, "LOW"))
                .vulnerabilities(vulnerabilities)
                .build();
    }
}
```

### 2. Container Lifecycle Management

**Health check implementation**:
```java
@RestController
@RequestMapping("/actuator")
public class ContainerHealthController {
    
    @Autowired
    private DatabaseHealthIndicator databaseHealth;
    
    @Autowired
    private RedisHealthIndicator redisHealth;
    
    @GetMapping("/health")
    public ResponseEntity<HealthStatus> health() {
        HealthStatus status = HealthStatus.builder()
                .status("UP")
                .timestamp(Instant.now())
                .checks(performHealthChecks())
                .build();
        
        boolean allHealthy = status.getChecks().values().stream()
                .allMatch(check -> "UP".equals(check.getStatus()));
        
        return ResponseEntity.status(allHealthy ? 200 : 503).body(status);
    }
    
    @GetMapping("/health/liveness")
    public ResponseEntity<Map<String, String>> liveness() {
        // Basic liveness check - application is running
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "timestamp", Instant.now().toString()
        ));
    }
    
    @GetMapping("/health/readiness")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, HealthCheck> checks = performHealthChecks();
        boolean ready = checks.values().stream()
                .allMatch(check -> "UP".equals(check.getStatus()));
        
        return ResponseEntity.status(ready ? 200 : 503)
                .body(Map.of(
                        "status", ready ? "UP" : "DOWN",
                        "checks", checks,
                        "timestamp", Instant.now()
                ));
    }
    
    private Map<String, HealthCheck> performHealthChecks() {
        Map<String, HealthCheck> checks = new HashMap<>();
        
        checks.put("database", databaseHealth.health());
        checks.put("redis", redisHealth.health());
        checks.put("disk", checkDiskSpace());
        checks.put("memory", checkMemoryUsage());
        
        return checks;
    }
    
    private HealthCheck checkDiskSpace() {
        File root = new File("/");
        long usableSpace = root.getUsableSpace();
        long totalSpace = root.getTotalSpace();
        double usagePercent = (double) (totalSpace - usableSpace) / totalSpace * 100;
        
        String status = usagePercent < 90 ? "UP" : "DOWN";
        return HealthCheck.builder()
                .status(status)
                .details(Map.of(
                        "usagePercent", usagePercent,
                        "threshold", 90
                ))
                .build();
    }
}
```

**Container monitoring ve logging**:
```java
@Component
public class ContainerMonitoringService {
    
    private final MeterRegistry meterRegistry;
    private final Logger structuredLogger = LoggerFactory.getLogger("CONTAINER_METRICS");
    
    @EventListener
    public void handleContainerEvent(ContainerEvent event) {
        structuredLogger.info("Container event: type={}, containerId={}, timestamp={}", 
                event.getType(), event.getContainerId(), event.getTimestamp());
        
        // Metrics recording
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("container.event.duration")
                .tag("event.type", event.getType())
                .register(meterRegistry));
        
        meterRegistry.counter("container.events.total",
                "type", event.getType(),
                "status", event.getStatus())
                .increment();
    }
    
    @Scheduled(fixedRate = 30000)
    public void collectContainerMetrics() {
        try {
            ContainerStats stats = dockerClient.stats(getCurrentContainerId()).exec();
            
            // Memory metrics
            long memoryUsage = stats.getMemoryStats().getUsage();
            long memoryLimit = stats.getMemoryStats().getLimit();
            double memoryPercent = (double) memoryUsage / memoryLimit * 100;
            
            meterRegistry.gauge("container.memory.usage.bytes", memoryUsage);
            meterRegistry.gauge("container.memory.usage.percent", memoryPercent);
            
            // CPU metrics
            long cpuDelta = stats.getCpuStats().getCpuUsage().getTotalUsage() - 
                           stats.getPreCpuStats().getCpuUsage().getTotalUsage();
            long systemDelta = stats.getCpuStats().getSystemCpuUsage() - 
                              stats.getPreCpuStats().getSystemCpuUsage();
            
            double cpuPercent = (double) cpuDelta / systemDelta * 100;
            meterRegistry.gauge("container.cpu.usage.percent", cpuPercent);
            
            // Network metrics
            Map<String, NetworkStats> networks = stats.getNetworks();
            networks.forEach((interfaceName, networkStats) -> {
                meterRegistry.gauge("container.network.rx.bytes", 
                        Tags.of("interface", interfaceName), networkStats.getRxBytes());
                meterRegistry.gauge("container.network.tx.bytes", 
                        Tags.of("interface", interfaceName), networkStats.getTxBytes());
            });
            
        } catch (Exception e) {
            log.error("Failed to collect container metrics", e);
        }
    }
}
```

Bu kapsamlı Docker ve Container implementasyonu, production-ready containerized uygulamalar geliştirmek için gereken tüm bileşenleri sağlar.
