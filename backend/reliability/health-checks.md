# Health Checks & Heartbeats

## Health Checks

Health checks, sistem bileşenlerinin sağlık durumunu sürekli olarak izleyerek sistem güvenilirliğini artıran mekanizmalardır.

### Liveness Probes
- Uygulama yaşam döngüsü kontrolü
- Deadlock detection
- Memory leak detection

### Readiness Probes
- Dependency health check
- Resource availability
- Service initialization

### Startup Probes
- Initial startup validation
- Configuration verification
- Resource allocation check

## Spring Boot Actuator Implementation

### Basic Health Check Configuration

```java
@Configuration
public class HealthCheckConfig {
    
    @Bean
    public HealthIndicator customHealthIndicator() {
        return new CustomHealthIndicator();
    }
    
    @Component
    public static class CustomHealthIndicator implements HealthIndicator {
        
        @Override
        public Health health() {
            // Custom health check logic
            boolean healthy = checkSystemHealth();
            
            if (healthy) {
                return Health.up()
                    .withDetail("status", "All systems operational")
                    .withDetail("timestamp", Instant.now())
                    .build();
            } else {
                return Health.down()
                    .withDetail("status", "System degraded")
                    .withDetail("error", "Database connection failed")
                    .build();
            }
        }
        
        private boolean checkSystemHealth() {
            // Implementation logic
            return true;
        }
    }
}
```

### Comprehensive Health Indicators

```java
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    
    private final DataSource dataSource;
    
    public DatabaseHealthIndicator(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public Health health() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(1)) {
                return Health.up()
                    .withDetail("database", "Available")
                    .withDetail("connectionPool", getConnectionPoolInfo())
                    .build();
            }
        } catch (SQLException e) {
            return Health.down(e)
                .withDetail("database", "Unavailable")
                .withDetail("error", e.getMessage())
                .build();
        }
        
        return Health.down()
            .withDetail("database", "Connection validation failed")
            .build();
    }
    
    private Map<String, Object> getConnectionPoolInfo() {
        Map<String, Object> info = new HashMap<>();
        if (dataSource instanceof HikariDataSource) {
            HikariDataSource hikari = (HikariDataSource) dataSource;
            HikariPoolMXBean pool = hikari.getHikariPoolMXBean();
            info.put("active", pool.getActiveConnections());
            info.put("idle", pool.getIdleConnections());
            info.put("total", pool.getTotalConnections());
            info.put("waiting", pool.getThreadsAwaitingConnection());
        }
        return info;
    }
}

@Component
public class RedisHealthIndicator implements HealthIndicator {
    
    private final RedisTemplate<String, String> redisTemplate;
    
    public RedisHealthIndicator(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    @Override
    public Health health() {
        try {
            Properties info = redisTemplate.getConnectionFactory()
                .getConnection()
                .info();
            
            return Health.up()
                .withDetail("redis", "Available")
                .withDetail("version", info.getProperty("redis_version"))
                .withDetail("used_memory", info.getProperty("used_memory_human"))
                .withDetail("connected_clients", info.getProperty("connected_clients"))
                .build();
                
        } catch (Exception e) {
            return Health.down(e)
                .withDetail("redis", "Unavailable")
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}

@Component
public class ExternalApiHealthIndicator implements HealthIndicator {
    
    private final WebClient webClient;
    
    public ExternalApiHealthIndicator(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
            .baseUrl("https://external-api.example.com")
            .build();
    }
    
    @Override
    public Health health() {
        try {
            String response = webClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(5))
                .block();
                
            return Health.up()
                .withDetail("externalApi", "Available")
                .withDetail("response", response)
                .withDetail("responseTime", measureResponseTime())
                .build();
                
        } catch (WebClientException | TimeoutException e) {
            return Health.down(e)
                .withDetail("externalApi", "Unavailable")
                .withDetail("error", e.getMessage())
                .build();
        }
    }
    
    private long measureResponseTime() {
        long startTime = System.currentTimeMillis();
        try {
            webClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(5))
                .block();
        } catch (Exception ignored) {
            // Response time measurement only
        }
        return System.currentTimeMillis() - startTime;
    }
}
```

### Custom Health Check Groups

```java
@Configuration
public class HealthGroupConfig {
    
    @Bean
    public HealthContributorRegistry healthContributorRegistry() {
        Map<String, HealthContributor> contributors = Map.of(
            "liveness", new CompositeHealthContributor(Map.of(
                "diskSpace", new DiskSpaceHealthIndicator(new File("."), Duration.ofSeconds(1)),
                "ping", new PingHealthIndicator()
            )),
            "readiness", new CompositeHealthContributor(Map.of(
                "database", new DatabaseHealthIndicator(dataSource()),
                "redis", new RedisHealthIndicator(redisTemplate()),
                "externalApi", new ExternalApiHealthIndicator(webClientBuilder())
            ))
        );
        
        return new DefaultHealthContributorRegistry(contributors);
    }
}
```

## Kubernetes Health Checks

### Pod Health Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spring-boot-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: spring-boot-app:latest
        ports:
        - containerPort: 8080
        
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1
          
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1
          
        startupProbe:
          httpGet:
            path: /actuator/health/startup
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
          successThreshold: 1
        
        env:
        - name: MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED
          value: "true"
        - name: MANAGEMENT_HEALTH_LIVENESSSTATE_ENABLED
          value: "true"
        - name: MANAGEMENT_HEALTH_READINESSSTATE_ENABLED
          value: "true"
```

### Application Properties for Kubernetes

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState,diskSpace,ping
        readiness:
          include: readinessState,db,redis,externalApi
        startup:
          include: startupState
      show-details: always
      
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
    
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
      base-path: /actuator
```

## AWS ELB Health Checks

### Target Group Configuration

```java
@Configuration
public class AwsHealthCheckConfig {
    
    @Bean
    public ElasticLoadBalancingV2Client elbClient() {
        return ElasticLoadBalancingV2Client.builder()
            .region(Region.US_EAST_1)
            .build();
    }
    
    @Bean
    public TargetGroupHealthChecker targetGroupHealthChecker() {
        return new TargetGroupHealthChecker();
    }
    
    @Component
    public static class TargetGroupHealthChecker {
        
        private final ElasticLoadBalancingV2Client elbClient;
        
        public TargetGroupHealthChecker(ElasticLoadBalancingV2Client elbClient) {
            this.elbClient = elbClient;
        }
        
        public void configureHealthCheck(String targetGroupArn) {
            ModifyTargetGroupRequest request = ModifyTargetGroupRequest.builder()
                .targetGroupArn(targetGroupArn)
                .healthCheckPath("/actuator/health")
                .healthCheckIntervalSeconds(30)
                .healthCheckTimeoutSeconds(5)
                .healthyThresholdCount(2)
                .unhealthyThresholdCount(5)
                .healthCheckProtocol(ProtocolEnum.HTTP)
                .healthCheckPort("8080")
                .matcher(Matcher.builder()
                    .httpCode("200")
                    .build())
                .build();
                
            elbClient.modifyTargetGroup(request);
        }
    }
}
```

## Heartbeats Implementation

### TCP Keep-Alive

```java
@Configuration
public class TcpKeepAliveConfig {
    
    @Bean
    public NettyChannelCustomizer nettyChannelCustomizer() {
        return channel -> {
            channel.config().setOption(ChannelOption.SO_KEEPALIVE, true);
            channel.config().setOption(ChannelOption.TCP_NODELAY, true);
            
            if (channel.config() instanceof EpollSocketChannelConfig) {
                EpollSocketChannelConfig epollConfig = (EpollSocketChannelConfig) channel.config();
                epollConfig.setTcpKeepIdle(600); // 10 minutes
                epollConfig.setTcpKeepIntvl(60);  // 1 minute
                epollConfig.setTcpKeepCnt(3);     // 3 probes
            }
        };
    }
    
    @Bean
    public ReactorResourceFactory reactorResourceFactory() {
        ReactorResourceFactory factory = new ReactorResourceFactory();
        factory.setConnectionProvider(ConnectionProvider.builder("custom")
            .maxConnections(100)
            .maxIdleTime(Duration.ofMinutes(10))
            .maxLifeTime(Duration.ofHours(1))
            .pendingAcquireTimeout(Duration.ofSeconds(30))
            .evictInBackground(Duration.ofMinutes(1))
            .build());
        return factory;
    }
}
```

### Application Level Heartbeats

```java
@Service
@Slf4j
public class HeartbeatService {
    
    private final ServiceRegistry serviceRegistry;
    private final MeterRegistry meterRegistry;
    
    @Scheduled(fixedDelay = 30000) // 30 seconds
    public void sendHeartbeat() {
        try {
            HeartbeatInfo heartbeat = createHeartbeatInfo();
            serviceRegistry.updateHeartbeat(heartbeat);
            
            meterRegistry.counter("heartbeat.sent", "status", "success").increment();
            log.debug("Heartbeat sent successfully: {}", heartbeat);
            
        } catch (Exception e) {
            meterRegistry.counter("heartbeat.sent", "status", "failure").increment();
            log.error("Failed to send heartbeat", e);
        }
    }
    
    private HeartbeatInfo createHeartbeatInfo() {
        Runtime runtime = Runtime.getRuntime();
        
        return HeartbeatInfo.builder()
            .instanceId(getInstanceId())
            .timestamp(Instant.now())
            .status("UP")
            .cpu(getCpuUsage())
            .memory(getMemoryUsage())
            .diskSpace(getDiskSpaceUsage())
            .activeConnections(getActiveConnections())
            .requestsPerSecond(getRequestsPerSecond())
            .build();
    }
    
    private double getCpuUsage() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        return osBean.getProcessCpuLoad() * 100;
    }
    
    private MemoryInfo getMemoryUsage() {
        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        
        return MemoryInfo.builder()
            .used(usedMemory)
            .free(freeMemory)
            .total(totalMemory)
            .max(maxMemory)
            .usagePercentage((double) usedMemory / maxMemory * 100)
            .build();
    }
}
```

### Service Registry Integration

```java
@Service
public class EurekaHeartbeatService {
    
    private final EurekaClient eurekaClient;
    
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready, starting Eureka heartbeats");
    }
    
    @EventListener(ContextClosedEvent.class)
    public void onApplicationShutdown() {
        log.info("Application shutting down, stopping Eureka heartbeats");
        eurekaClient.shutdown();
    }
    
    @EventListener(HeartbeatEvent.class)
    public void onHeartbeat(HeartbeatEvent event) {
        log.debug("Eureka heartbeat event: {}", event);
        
        // Custom heartbeat logic
        updateServiceMetadata();
    }
    
    private void updateServiceMetadata() {
        InstanceInfo instanceInfo = eurekaClient.getApplicationInfoManager()
            .getInfo();
            
        Map<String, String> metadata = instanceInfo.getMetadata();
        metadata.put("lastHeartbeat", Instant.now().toString());
        metadata.put("version", getApplicationVersion());
        metadata.put("health", getCurrentHealthStatus());
    }
}
```

## Monitoring ve Alerting

```java
@Component
public class HealthCheckMetrics {
    
    private final MeterRegistry meterRegistry;
    private final HealthEndpoint healthEndpoint;
    
    @Scheduled(fixedDelay = 60000) // 1 minute
    public void collectHealthMetrics() {
        HealthComponent health = healthEndpoint.health();
        Status status = health.getStatus();
        
        meterRegistry.gauge("health.status", 
            Tags.of("status", status.getCode()),
            status == Status.UP ? 1 : 0);
        
        if (health instanceof CompositeHealth) {
            CompositeHealth composite = (CompositeHealth) health;
            composite.getComponents().forEach((name, component) -> {
                Status componentStatus = component.getStatus();
                meterRegistry.gauge("health.component", 
                    Tags.of("component", name, "status", componentStatus.getCode()),
                    componentStatus == Status.UP ? 1 : 0);
            });
        }
    }
    
    @EventListener
    public void onHealthStatusChange(HealthStatusChangedEvent event) {
        meterRegistry.counter("health.status.change",
            "from", event.getPreviousStatus().getCode(),
            "to", event.getCurrentStatus().getCode()
        ).increment();
        
        if (event.getCurrentStatus() != Status.UP) {
            // Send alert
            sendHealthAlert(event);
        }
    }
    
    private void sendHealthAlert(HealthStatusChangedEvent event) {
        // Alert implementation
        log.error("Health status changed from {} to {}", 
            event.getPreviousStatus(), event.getCurrentStatus());
    }
}
```

Health checks ve heartbeat mekanizmaları, sistem güvenilirliğinin temel taşlarıdır. Proper implementation ile system outage'ları minimize edilebilir ve proactive monitoring sağlanabilir.
