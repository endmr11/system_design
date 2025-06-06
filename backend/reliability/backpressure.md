# 3.4 Backpressure Control

## Genel Bakış

Backpressure control, sistem kapasitesini aşan isteklerin güvenli bir şekilde yönetilmesi için kritik bir mekanizmadır. Yüksek trafikli durumlarda sistemin çökmesini önleyerek performans ve güvenilirliği korur.

## Rate Limiting

### Token Bucket Algoritması

```java
@Component
public class TokenBucketRateLimiter {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public boolean isAllowed(String key, int capacity, int refillRate) {
        String script = """
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local tokens = tonumber(ARGV[2])
            local interval = tonumber(ARGV[3])
            
            local bucket = redis.call('hmget', key, 'tokens', 'last_refill')
            local tokens_count = tonumber(bucket[1]) or capacity
            local last_refill = tonumber(bucket[2]) or redis.call('time')[1]
            
            local now = redis.call('time')[1]
            local elapsed = now - last_refill
            local tokens_to_add = math.floor(elapsed * tokens / interval)
            
            tokens_count = math.min(capacity, tokens_count + tokens_to_add)
            
            if tokens_count >= 1 then
                tokens_count = tokens_count - 1
                redis.call('hmset', key, 'tokens', tokens_count, 'last_refill', now)
                redis.call('expire', key, interval * 2)
                return 1
            else
                redis.call('hmset', key, 'tokens', tokens_count, 'last_refill', now)
                redis.call('expire', key, interval * 2)
                return 0
            end
        """;
        
        List<String> keys = Arrays.asList(key);
        List<Object> args = Arrays.asList(capacity, refillRate, 60);
        
        Long result = (Long) redisTemplate.execute(
            (RedisCallback<Long>) connection -> 
                connection.eval(script.getBytes(), 
                    ReturnType.INTEGER, 
                    keys.size(), 
                    keys.toArray(new String[0]),
                    args.toArray(new String[0])
                )
        );
        
        return result != null && result == 1;
    }
}
```

### API Gateway Rate Limiting

```java
@RestController
@RequestMapping("/api")
public class RateLimitedController {
    
    @Autowired
    private TokenBucketRateLimiter rateLimiter;
    
    @GetMapping("/data")
    public ResponseEntity<?> getData(HttpServletRequest request) {
        String clientId = getClientId(request);
        String key = "rate_limit:" + clientId;
        
        // Her client için dakikada 100 istek
        if (!rateLimiter.isAllowed(key, 100, 100)) {
            HttpHeaders headers = new HttpHeaders();
            headers.add("X-RateLimit-Limit", "100");
            headers.add("X-RateLimit-Remaining", "0");
            headers.add("Retry-After", "60");
            
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .headers(headers)
                .body(Map.of("error", "Rate limit exceeded"));
        }
        
        return ResponseEntity.ok(processData());
    }
    
    private String getClientId(HttpServletRequest request) {
        String apiKey = request.getHeader("X-API-Key");
        if (apiKey != null) {
            return apiKey;
        }
        return request.getRemoteAddr();
    }
}
```

## Queue Management

### Message Queue Backpressure

```java
@Configuration
@EnableRabbitMQ
public class QueueBackpressureConfig {
    
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        
        // Publisher confirms için callback
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message rejected: {}", cause);
                // Retry logic veya dead letter queue
            }
        });
        
        // Return callback for unroutable messages
        template.setReturnCallback((message, replyCode, replyText, exchange, routingKey) -> {
            log.error("Message returned: {} - {}", replyCode, replyText);
        });
        
        return template;
    }
    
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        
        SimpleRabbitListenerContainerFactory factory = 
            new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        
        // Backpressure control
        factory.setPrefetchCount(10); // Her consumer için max 10 mesaj
        factory.setConcurrentConsumers(2);
        factory.setMaxConcurrentConsumers(10);
        
        // Error handling
        factory.setErrorHandler(new ConditionalRejectingErrorHandler(
            new ConditionalRejectingErrorHandler.DefaultExceptionStrategy())
        );
        
        return factory;
    }
}
```

### Async Processing with Backpressure

```java
@Service
public class BackpressureAwareProcessor {
    
    private final Semaphore semaphore;
    private final ExecutorService executorService;
    
    public BackpressureAwareProcessor() {
        this.semaphore = new Semaphore(100); // Max 100 concurrent operations
        this.executorService = Executors.newFixedThreadPool(20);
    }
    
    @Async
    public CompletableFuture<String> processWithBackpressure(String data) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Semaphore ile concurrency control
                if (!semaphore.tryAcquire(1, TimeUnit.SECONDS)) {
                    throw new BackpressureException("System overloaded");
                }
                
                try {
                    return processData(data);
                } finally {
                    semaphore.release();
                }
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(e);
            }
        }, executorService);
    }
    
    private String processData(String data) {
        // Simulate processing time
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return "Processed: " + data;
    }
}

@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class BackpressureException extends RuntimeException {
    public BackpressureException(String message) {
        super(message);
    }
}
```

## Circuit Breaking

### Resilience4j Integration

```java
@Configuration
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreaker databaseCircuitBreaker() {
        return CircuitBreaker.ofDefaults("database");
    }
    
    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50) // %50 failure rate
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .slidingWindowSize(10)
            .minimumNumberOfCalls(5)
            .slowCallRateThreshold(50)
            .slowCallDurationThreshold(Duration.ofSeconds(2))
            .build();
            
        return CircuitBreakerRegistry.of(config);
    }
}

@Service
public class ExternalServiceClient {
    
    private final CircuitBreaker circuitBreaker;
    private final TimeLimiter timeLimiter;
    private final Retry retry;
    
    public ExternalServiceClient(CircuitBreakerRegistry registry) {
        this.circuitBreaker = registry.circuitBreaker("external-service");
        this.timeLimiter = TimeLimiter.ofDefaults();
        this.retry = Retry.ofDefaults("external-service");
    }
    
    public CompletableFuture<String> callExternalService(String data) {
        Supplier<CompletableFuture<String>> decoratedSupplier = 
            Decorators.ofSupplier(() -> CompletableFuture.supplyAsync(() -> {
                // External service call simulation
                if (Math.random() > 0.7) {
                    throw new RuntimeException("Service unavailable");
                }
                return "Response for: " + data;
            }))
            .withCircuitBreaker(circuitBreaker)
            .withTimeLimiter(timeLimiter)
            .withRetry(retry)
            .decorate();
            
        return decoratedSupplier.get();
    }
}
```

## Connection Pooling

### Database Connection Management

```java
@Configuration
public class DatabasePoolConfig {
    
    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://localhost:5432/mydb");
        config.setUsername("user");
        config.setPassword("password");
        
        // Connection pool settings
        config.setMaximumPoolSize(20);
        config.setMinimumIdle(5);
        config.setConnectionTimeout(30000); // 30 seconds
        config.setIdleTimeout(600000); // 10 minutes
        config.setMaxLifetime(1800000); // 30 minutes
        
        // Backpressure settings
        config.setLeakDetectionThreshold(60000); // 1 minute
        
        return new HikariDataSource(config);
    }
    
    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        JdbcTemplate template = new JdbcTemplate(dataSource);
        template.setQueryTimeout(30); // 30 seconds query timeout
        return template;
    }
}
```

### HTTP Client Pool Management

```java
@Configuration
public class HttpClientConfig {
    
    @Bean
    public RestTemplate restTemplate() {
        HttpComponentsClientHttpRequestFactory factory = 
            new HttpComponentsClientHttpRequestFactory();
            
        // Connection pool configuration
        factory.setConnectTimeout(5000); // 5 seconds
        factory.setReadTimeout(10000); // 10 seconds
        
        CloseableHttpClient httpClient = HttpClients.custom()
            .setMaxConnTotal(100) // Total max connections
            .setMaxConnPerRoute(20) // Max connections per route
            .setConnectionTimeToLive(30, TimeUnit.SECONDS)
            .build();
            
        factory.setHttpClient(httpClient);
        
        RestTemplate restTemplate = new RestTemplate(factory);
        
        // Error handling for backpressure
        restTemplate.setErrorHandler(new ResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) throws IOException {
                return response.getStatusCode().series() == 
                    HttpStatus.Series.CLIENT_ERROR ||
                    response.getStatusCode().series() == 
                    HttpStatus.Series.SERVER_ERROR;
            }
            
            @Override
            public void handleError(ClientHttpResponse response) throws IOException {
                if (response.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                    throw new BackpressureException("Rate limit exceeded");
                }
                throw new RestClientException("HTTP error: " + 
                    response.getStatusCode());
            }
        });
        
        return restTemplate;
    }
}
```

## Monitoring ve Alerting

### Backpressure Metrics

```java
@Component
public class BackpressureMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter rejectedRequests;
    private final Gauge queueSize;
    private final Timer processingTime;
    
    public BackpressureMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.rejectedRequests = Counter.builder("requests.rejected")
            .description("Number of rejected requests due to backpressure")
            .register(meterRegistry);
            
        this.queueSize = Gauge.builder("queue.size")
            .description("Current queue size")
            .register(meterRegistry, this, BackpressureMetrics::getCurrentQueueSize);
            
        this.processingTime = Timer.builder("processing.time")
            .description("Request processing time")
            .register(meterRegistry);
    }
    
    public void recordRejection(String reason) {
        rejectedRequests.increment(Tags.of("reason", reason));
    }
    
    public Timer.Sample startTimer() {
        return Timer.start(meterRegistry);
    }
    
    private double getCurrentQueueSize() {
        // Implementation to get current queue size
        return 0.0;
    }
}
```

### Health Check Integration

```java
@Component
public class BackpressureHealthIndicator implements HealthIndicator {
    
    private final BackpressureAwareProcessor processor;
    private final TokenBucketRateLimiter rateLimiter;
    
    public BackpressureHealthIndicator(
            BackpressureAwareProcessor processor,
            TokenBucketRateLimiter rateLimiter) {
        this.processor = processor;
        this.rateLimiter = rateLimiter;
    }
    
    @Override
    public Health health() {
        Health.Builder builder = new Health.Builder();
        
        try {
            // Check system capacity
            boolean hasCapacity = checkSystemCapacity();
            
            if (hasCapacity) {
                builder.up()
                    .withDetail("status", "System has available capacity")
                    .withDetail("available_permits", getAvailablePermits());
            } else {
                builder.down()
                    .withDetail("status", "System at capacity")
                    .withDetail("available_permits", 0);
            }
            
        } catch (Exception e) {
            builder.down()
                .withDetail("error", e.getMessage());
        }
        
        return builder.build();
    }
    
    private boolean checkSystemCapacity() {
        // Implementation to check system capacity
        return true;
    }
    
    private int getAvailablePermits() {
        // Implementation to get available permits
        return 50;
    }
}
```

Bu backpressure control implementasyonu, sistemin aşırı yüklenme durumlarında güvenli bir şekilde çalışmasını sağlar ve performans degradasyonunu önler.
