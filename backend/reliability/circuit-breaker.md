# Circuit Breaker ve Bulkhead Pattern

## Circuit Breaker Pattern

### Temel Kavramlar
- Aşırı hata veya gecikme durumunda servis çağrısını keser
- Kaskad kesintileri önler
- Sistem kaynaklarını korur

### Circuit Breaker Durumları

#### CLOSED (Kapalı)
- Normal operasyon durumu
- Tüm istekler servis çağrısına yönlendirilir
- Hata sayısı izlenir

#### OPEN (Açık)
- Hata eşiği aşıldığında geçilen durum
- Tüm istekler hemen başarısız olarak döner
- Fallback mekanizması devreye girer

#### HALF-OPEN (Yarı Açık)
- İyileşme testi için kullanılan durum
- Sınırlı sayıda istek geçişine izin verilir
- Başarı durumunda CLOSED'a geçiş

## Spring Boot Implementasyonları

### Resilience4j Configuration

```java
@Configuration
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreaker circuitBreaker() {
        return CircuitBreaker.ofDefaults("userService");
    }
    
    @Bean
    public CircuitBreakerConfig circuitBreakerConfig() {
        return CircuitBreakerConfig.custom()
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofMillis(1000))
            .slidingWindowSize(2)
            .minimumNumberOfCalls(2)
            .build();
    }
}

@Service
@Slf4j
public class UserService {
    
    private final CircuitBreaker circuitBreaker;
    private final UserRepository userRepository;
    
    public UserService(CircuitBreaker circuitBreaker, UserRepository userRepository) {
        this.circuitBreaker = circuitBreaker;
        this.userRepository = userRepository;
    }
    
    public User findById(Long id) {
        Supplier<User> decoratedSupplier = CircuitBreaker
            .decorateSupplier(circuitBreaker, () -> {
                return userRepository.findById(id)
                    .orElseThrow(() -> new UserNotFoundException("User not found"));
            });
        
        return Try.ofSupplier(decoratedSupplier)
            .recover(throwable -> {
                log.error("Circuit breaker activated for user lookup", throwable);
                return getFallbackUser(id);
            });
    }
    
    private User getFallbackUser(Long id) {
        return User.builder()
            .id(id)
            .name("Fallback User")
            .email("fallback@example.com")
            .build();
    }
}
```

### Reactive Circuit Breaker

```java
@Service
public class ReactiveUserService {
    
    private final CircuitBreaker circuitBreaker;
    private final WebClient webClient;
    
    public ReactiveUserService(CircuitBreaker circuitBreaker, WebClient webClient) {
        this.circuitBreaker = circuitBreaker;
        this.webClient = webClient;
    }
    
    public Mono<User> getUser(Long id) {
        return webClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .bodyToMono(User.class)
            .transformDeferred(CircuitBreakerOperator.of(circuitBreaker))
            .onErrorResume(this::fallbackUser);
    }
    
    private Mono<User> fallbackUser(Throwable error) {
        log.warn("Fallback triggered for user service", error);
        return Mono.just(User.builder()
            .id(0L)
            .name("Service Unavailable")
            .build());
    }
}
```

### Spring Cloud Circuit Breaker

```java
@RestController
public class UserController {
    
    private final CircuitBreakerFactory circuitBreakerFactory;
    private final UserService userService;
    
    public UserController(CircuitBreakerFactory circuitBreakerFactory, 
                         UserService userService) {
        this.circuitBreakerFactory = circuitBreakerFactory;
        this.userService = userService;
    }
    
    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        CircuitBreaker circuitBreaker = circuitBreakerFactory.create("userService");
        
        User user = circuitBreaker.run(
            () -> userService.findById(id),
            throwable -> {
                log.error("Circuit breaker fallback triggered", throwable);
                return User.builder()
                    .id(id)
                    .name("Circuit Breaker Fallback")
                    .build();
            }
        );
        
        return ResponseEntity.ok(user);
    }
}
```

## Bulkhead Pattern

### Thread Pool Isolation

```java
@Configuration
public class BulkheadConfig {
    
    @Bean("userServiceExecutor")
    public Executor userServiceExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("UserService-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
    
    @Bean("orderServiceExecutor")
    public Executor orderServiceExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(3);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(15);
        executor.setThreadNamePrefix("OrderService-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
}

@Service
public class IsolatedUserService {
    
    @Async("userServiceExecutor")
    public CompletableFuture<User> findUserAsync(Long id) {
        // User service logic
        return CompletableFuture.completedFuture(new User());
    }
}

@Service
public class IsolatedOrderService {
    
    @Async("orderServiceExecutor")
    public CompletableFuture<Order> findOrderAsync(Long id) {
        // Order service logic
        return CompletableFuture.completedFuture(new Order());
    }
}
```

### Connection Pool Isolation

```java
@Configuration
public class DataSourceBulkheadConfig {
    
    @Bean("userDataSource")
    @ConfigurationProperties("spring.datasource.user")
    public DataSource userDataSource() {
        HikariConfig config = new HikariConfig();
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setPoolName("UserServicePool");
        return new HikariDataSource(config);
    }
    
    @Bean("orderDataSource")
    @ConfigurationProperties("spring.datasource.order")
    public DataSource orderDataSource() {
        HikariConfig config = new HikariConfig();
        config.setMaximumPoolSize(15);
        config.setMinimumIdle(3);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setPoolName("OrderServicePool");
        return new HikariDataSource(config);
    }
}
```

### Queue Isolation

```java
@Configuration
public class QueueBulkheadConfig {
    
    @Bean
    public Queue userQueue() {
        return QueueBuilder.durable("user.queue")
            .withArgument("x-max-length", 1000)
            .withArgument("x-max-priority", 10)
            .build();
    }
    
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable("order.queue")
            .withArgument("x-max-length", 500)
            .withArgument("x-max-priority", 5)
            .build();
    }
    
    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable("dead.letter.queue")
            .build();
    }
}

@Service
@Slf4j
public class QueueIsolationService {
    
    private final RabbitTemplate rabbitTemplate;
    
    @RabbitListener(queues = "user.queue", 
                   concurrency = "5-10",
                   containerFactory = "userContainerFactory")
    public void processUserMessage(UserMessage message) {
        log.info("Processing user message: {}", message);
        // Process user message with isolated resources
    }
    
    @RabbitListener(queues = "order.queue",
                   concurrency = "3-8", 
                   containerFactory = "orderContainerFactory")
    public void processOrderMessage(OrderMessage message) {
        log.info("Processing order message: {}", message);
        // Process order message with isolated resources
    }
}
```

## Resilience4j Integration

### Complete Configuration

```java
@Configuration
@EnableConfigurationProperties({
    CircuitBreakerProperties.class,
    BulkheadProperties.class,
    RetryProperties.class,
    RateLimiterProperties.class
})
public class ResilienceConfig {
    
    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry(CircuitBreakerProperties properties) {
        return CircuitBreakerRegistry.of(properties.getConfigs());
    }
    
    @Bean
    public BulkheadRegistry bulkheadRegistry(BulkheadProperties properties) {
        return BulkheadRegistry.of(properties.getConfigs());
    }
    
    @Bean
    public RetryRegistry retryRegistry(RetryProperties properties) {
        return RetryRegistry.of(properties.getConfigs());
    }
    
    @Bean
    public RateLimiterRegistry rateLimiterRegistry(RateLimiterProperties properties) {
        return RateLimiterRegistry.of(properties.getConfigs());
    }
}
```

### Application Properties

```yaml
resilience4j:
  circuitbreaker:
    configs:
      default:
        registerHealthIndicator: true
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 5s
        failureRateThreshold: 50
        eventConsumerBufferSize: 10
    instances:
      userService:
        baseConfig: default
      orderService:
        slidingWindowSize: 20
        minimumNumberOfCalls: 10
        
  bulkhead:
    configs:
      default:
        maxConcurrentCalls: 10
        maxWaitDuration: 100ms
    instances:
      userService:
        baseConfig: default
      orderService:
        maxConcurrentCalls: 5
        
  retry:
    configs:
      default:
        maxAttempts: 3
        waitDuration: 100ms
        retryExceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
    instances:
      userService:
        baseConfig: default
```

## Monitoring ve Metrics

```java
@Component
public class ResilienceMetrics {
    
    private final MeterRegistry meterRegistry;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final BulkheadRegistry bulkheadRegistry;
    
    @EventListener
    public void onCircuitBreakerEvent(CircuitBreakerOnStateTransitionEvent event) {
        meterRegistry.counter("circuit.breaker.state.transition",
            "name", event.getCircuitBreakerName(),
            "from", event.getStateTransition().getFromState().toString(),
            "to", event.getStateTransition().getToState().toString()
        ).increment();
    }
    
    @EventListener
    public void onBulkheadEvent(BulkheadOnCallPermittedEvent event) {
        meterRegistry.counter("bulkhead.calls.permitted",
            "name", event.getBulkheadName()
        ).increment();
    }
    
    @EventListener
    public void onBulkheadRejectedEvent(BulkheadOnCallRejectedEvent event) {
        meterRegistry.counter("bulkhead.calls.rejected",
            "name", event.getBulkheadName()
        ).increment();
    }
}
```

Circuit Breaker ve Bulkhead pattern'ları, microservice architectures'da sistem güvenilirliğini artırmak için kritik öneme sahiptir. Bu pattern'lar sayesinde cascade failure'lar önlenir ve sistem kaynaklarının verimli kullanımı sağlanır.
