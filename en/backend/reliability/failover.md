# Failover Mechanisms - Spring Boot Ecosystem

## Failover Strategies

### Database Failover

#### Multi-DataSource Configuration with Spring Boot
```java
@Configuration
public class DatabaseFailoverConfig {
    
    @Primary
    @Bean("primaryDataSource")
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() {
        return DataSourceBuilder.create().build();
    }
    
    @Bean("secondaryDataSource")
    @ConfigurationProperties("spring.datasource.secondary")
    public DataSource secondaryDataSource() {
        return DataSourceBuilder.create().build();
    }
    
    @Bean
    public DataSource routingDataSource() {
        RoutingDataSource routingDataSource = new RoutingDataSource();
        
        Map<Object, Object> dataSourceMap = new HashMap<>();
        dataSourceMap.put("primary", primaryDataSource());
        dataSourceMap.put("secondary", secondaryDataSource());
        
        routingDataSource.setTargetDataSources(dataSourceMap);
        routingDataSource.setDefaultTargetDataSource(primaryDataSource());
        
        return routingDataSource;
    }
}

public class RoutingDataSource extends AbstractRoutingDataSource {
    
    @Override
    protected Object determineCurrentLookupKey() {
        return DatabaseContextHolder.getDatabase();
    }
}

@Component
public class DatabaseContextHolder {
    
    private static final ThreadLocal<String> contextHolder = new ThreadLocal<>();
    
    public static void setDatabase(String database) {
        contextHolder.set(database);
    }
    
    public static String getDatabase() {
        return contextHolder.get();
    }
    
    public static void clearDatabase() {
        contextHolder.remove();
    }
}
```

#### Health-Based Database Switching
```java
@Service
public class DatabaseHealthService {
    
    @Autowired
    @Qualifier("primaryDataSource")
    private DataSource primaryDataSource;
    
    @Autowired
    @Qualifier("secondaryDataSource")
    private DataSource secondaryDataSource;
    
    private volatile boolean primaryHealthy = true;
    
    @Scheduled(fixedDelay = 5000) // Check every 5 seconds
    public void checkDatabaseHealth() {
        primaryHealthy = isDatabaseHealthy(primaryDataSource);
        
        if (!primaryHealthy) {
            log.warn("Primary database is unhealthy, switching to secondary");
            DatabaseContextHolder.setDatabase("secondary");
        } else {
            DatabaseContextHolder.setDatabase("primary");
        }
    }
    
    private boolean isDatabaseHealthy(DataSource dataSource) {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(5);
        } catch (SQLException e) {
            return false;
        }
    }
}

@Aspect
@Component
public class DatabaseFailoverAspect {
    
    @Around("@annotation(Transactional)")
    public Object handleDatabaseFailover(ProceedingJoinPoint joinPoint) throws Throwable {
        try {
            return joinPoint.proceed();
        } catch (DataAccessException e) {
            log.warn("Database operation failed, attempting failover: {}", e.getMessage());
            
            // Switch to secondary database
            DatabaseContextHolder.setDatabase("secondary");
            
            try {
                return joinPoint.proceed();
            } finally {
                DatabaseContextHolder.clearDatabase();
            }
        }
    }
}
```

### Service-to-Service Failover

#### Failover with Resilience4j Circuit Breaker
```java
@Configuration
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreaker userServiceCircuitBreaker() {
        return CircuitBreaker.ofDefaults("user-service");
    }
    
    @Bean
    public TimeLimiter userServiceTimeLimiter() {
        return TimeLimiter.of(Duration.ofSeconds(3));
    }
}

@Service
public class UserService {
    
    @CircuitBreaker(name = "user-service", fallbackMethod = "fallbackGetUser")
    @TimeLimiter(name = "user-service")
    @Retry(name = "user-service")
    public CompletableFuture<User> getUser(Long userId) {
        return CompletableFuture.supplyAsync(() -> {
            return primaryUserServiceClient.getUser(userId);
        });
    }
    
    // Fallback: Switch to secondary service
    public CompletableFuture<User> fallbackGetUser(Long userId, Exception e) {
        log.warn("Primary user service failed, using secondary: {}", e.getMessage());
        return CompletableFuture.supplyAsync(() -> {
            return secondaryUserServiceClient.getUser(userId);
        });
    }
    
    // Last resort: Return from cache
    public CompletableFuture<User> cacheFallbackGetUser(Long userId, Exception e) {
        log.warn("All user services failed, trying cache: {}", e.getMessage());
        return CompletableFuture.supplyAsync(() -> {
            User cachedUser = userCacheService.getUser(userId);
            if (cachedUser != null) {
                return cachedUser;
            }
            throw new UserNotFoundException("User not found in any source");
        });
    }
}
```

#### Automatic Failover with Service Discovery
```java
@Configuration
@EnableDiscoveryClient
public class ServiceDiscoveryConfig {
    
    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
    
    @Bean
    public DiscoveryClient discoveryClient() {
        return new EurekaDiscoveryClient();
    }
}

@Service
public class FailoverAwareServiceClient {
    
    @Autowired
    private DiscoveryClient discoveryClient;
    
    @Autowired
    @LoadBalanced
    private RestTemplate restTemplate;
    
    public ResponseEntity<String> callService(String serviceName, String endpoint) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceName);
        
        for (ServiceInstance instance : instances) {
            try {
                String url = instance.getUri() + endpoint;
                return restTemplate.getForEntity(url, String.class);
            } catch (Exception e) {
                log.warn("Service instance {} failed: {}", instance.getUri(), e.getMessage());
                // Try next instance
                continue;
            }
        }
        
        throw new ServiceUnavailableException("All instances of " + serviceName + " are down");
    }
}
```

### Application Server Failover

#### Health Check Endpoints with Spring Boot
```java
@Component
public class CustomHealthIndicator implements HealthIndicator {
    
    @Autowired
    private DatabaseHealthService databaseHealthService;
    
    @Autowired
    private ExternalServiceHealthService externalServiceHealthService;
    
    @Override
    public Health health() {
        boolean isDatabaseHealthy = databaseHealthService.isHealthy();
        boolean areExternalServicesHealthy = externalServiceHealthService.areHealthy();
        
        if (isDatabaseHealthy && areExternalServicesHealthy) {
            return Health.up()
                .withDetail("database", "UP")
                .withDetail("external-services", "UP")
                .build();
        } else {
            return Health.down()
                .withDetail("database", isDatabaseHealthy ? "UP" : "DOWN")
                .withDetail("external-services", areExternalServicesHealthy ? "UP" : "DOWN")
                .build();
        }
    }
}

@RestController
public class HealthController {
    
    @Autowired
    private HealthEndpoint healthEndpoint;
    
    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Health health = healthEndpoint.health();
        
        if (health.getStatus() == Status.UP) {
            return ResponseEntity.ok(Map.of("status", "ready"));
        } else {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", "not-ready", "details", health.getDetails()));
        }
    }
    
    @GetMapping("/health/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        // Simple liveness check - is application running?
        return ResponseEntity.ok(Map.of("status", "alive"));
    }
}
```

## Load Balancer Integration

### NGINX with Health Check and Failover
```nginx
upstream backend_servers {
    server app1.example.com:8080 max_fails=3 fail_timeout=30s;
    server app2.example.com:8080 max_fails=3 fail_timeout=30s;
    server app3.example.com:8080 backup; # Backup server
}

server {
    listen 80;
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    location / {
        proxy_pass http://backend_servers;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        
        # Health check headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### AWS Application Load Balancer Failover
```yaml
# ALB Target Group Health Check
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    HealthCheckEnabled: true
    HealthCheckIntervalSeconds: 30
    HealthCheckPath: /actuator/health
    HealthCheckPort: 8080
    HealthCheckProtocol: HTTP
    HealthCheckTimeoutSeconds: 5
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    Matcher:
      HttpCode: 200
    Port: 8080
    Protocol: HTTP
    VpcId: !Ref VPC
```

## Cache Failover Strategies

### Redis Cluster Failover
```java
@Configuration
public class RedisFailoverConfig {
    
    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        RedisClusterConfiguration clusterConfig = new RedisClusterConfiguration();
        clusterConfig.clusterNode("redis-1.example.com", 6379);
        clusterConfig.clusterNode("redis-2.example.com", 6379);
        clusterConfig.clusterNode("redis-3.example.com", 6379);
        
        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
            .commandTimeout(Duration.ofSeconds(2))
            .build();
            
        return new LettuceConnectionFactory(clusterConfig, clientConfig);
    }
    
    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory());
        template.setDefaultSerializer(new GenericJackson2JsonRedisSerializer());
        return template;
    }
}

@Service
public class CacheFailoverService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Cacheable(value = "users", unless = "#result == null")
    public User getUser(Long userId) {
        try {
            return redisTemplate.opsForValue().get("user:" + userId);
        } catch (Exception e) {
            log.warn("Redis cache failed, falling back to database: {}", e.getMessage());
            return userRepository.findById(userId).orElse(null);
        }
    }
}
```

### Multi-Level Cache Failover
```java
@Service
public class MultiLevelCacheService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    private final ConcurrentHashMap<String, Object> localCache = new ConcurrentHashMap<>();
    
    public User getUser(Long userId) {
        String key = "user:" + userId;
        
        // Level 1: Local cache
        User user = (User) localCache.get(key);
        if (user != null) {
            return user;
        }
        
        // Level 2: Redis cache
        try {
            user = (User) redisTemplate.opsForValue().get(key);
            if (user != null) {
                localCache.put(key, user);
                return user;
            }
        } catch (Exception e) {
            log.warn("Redis cache failed: {}", e.getMessage());
        }
        
        // Level 3: Database
        user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            // Write back to caches
            localCache.put(key, user);
            try {
                redisTemplate.opsForValue().set(key, user, Duration.ofMinutes(10));
            } catch (Exception e) {
                log.warn("Failed to update Redis cache: {}", e.getMessage());
            }
        }
        
        return user;
    }
}
```

## Monitoring and Alerting

### Failover Events Monitoring
```java
@Component
public class FailoverMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter failoverEvents;
    
    public FailoverMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.failoverEvents = Counter.builder("failover.events")
            .tag("component", "database")
            .register(meterRegistry);
    }
    
    public void recordFailoverEvent(String component, String from, String to) {
        failoverEvents.increment(
            Tags.of(
                "component", component,
                "from", from,
                "to", to
            )
        );
        
        log.info("Failover event recorded: {} from {} to {}", component, from, to);
    }
}

@EventListener
@Component
public class FailoverEventListener {
    
    @Autowired
    private FailoverMetrics failoverMetrics;
    
    @Autowired
    private AlertService alertService;
    
    @EventListener
    public void handleDatabaseFailover(DatabaseFailoverEvent event) {
        failoverMetrics.recordFailoverEvent("database", event.getFrom(), event.getTo());
        alertService.sendAlert("Database failover occurred: " + event.getFrom() + " -> " + event.getTo());
    }
}
```

### Custom Health Check Dashboard
```java
@RestController
public class FailoverStatusController {
    
    @Autowired
    private DatabaseHealthService databaseHealthService;
    
    @Autowired
    private ServiceHealthService serviceHealthService;
    
    @GetMapping("/admin/failover-status")
    public ResponseEntity<FailoverStatus> getFailoverStatus() {
        FailoverStatus status = FailoverStatus.builder()
            .primaryDatabase(databaseHealthService.isPrimaryHealthy())
            .secondaryDatabase(databaseHealthService.isSecondaryHealthy())
            .services(serviceHealthService.getServiceStatuses())
            .timestamp(Instant.now())
            .build();
            
        return ResponseEntity.ok(status);
    }
}
```

## Kubernetes Automatic Failover

### Pod Disruption Budget
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: spring-app-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: spring-app
```

### Liveness and Readiness Probes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spring-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: spring-app
  template:
    metadata:
      labels:
        app: spring-app
    spec:
      containers:
      - name: spring-app
        image: spring-app:latest
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
```

These failover mechanisms improve system reliability and minimize downtime. Combined with proper monitoring and alerting, they provide reliable failover capabilities in production systems.
