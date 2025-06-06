# 3.2 Circuit Breaker & Bulkhead Pattern

## Overview

Circuit Breaker pattern prevents cascading failures by temporarily stopping calls to failing services. When combined with Bulkhead pattern, it provides comprehensive protection against system-wide outages by isolating failures and resources.

## Circuit Breaker Implementation

### Basic Circuit Breaker with Resilience4j

```java
@Configuration
@EnableCircuitBreaker
public class CircuitBreakerConfig {
    
    @Bean
    public CircuitBreakerConfig circuitBreakerConfig() {
        return CircuitBreakerConfig.custom()
            .failureRateThreshold(50) // Open when 50% of calls fail
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .slidingWindowSize(10)
            .minimumNumberOfCalls(5)
            .slowCallRateThreshold(50) // Consider slow calls as failures
            .slowCallDurationThreshold(Duration.ofSeconds(2))
            .permittedNumberOfCallsInHalfOpenState(3)
            .automaticTransitionFromOpenToHalfOpenEnabled(true)
            .build();
    }
    
    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        return CircuitBreakerRegistry.of(circuitBreakerConfig());
    }
    
    @Bean
    public CircuitBreaker databaseCircuitBreaker(CircuitBreakerRegistry registry) {
        CircuitBreaker circuitBreaker = registry.circuitBreaker("database", 
            circuitBreakerConfig());
            
        circuitBreaker.getEventPublisher()
            .onStateTransition(event -> 
                log.info("Circuit breaker state transition: {} -> {}", 
                    event.getStateTransition().getFromState(),
                    event.getStateTransition().getToState())
            )
            .onCallNotPermitted(event -> 
                log.warn("Call not permitted: {}", event.getCircuitBreakerName())
            )
            .onError(event -> 
                log.error("Circuit breaker error: {}", event.getThrowable().getMessage())
            );
            
        return circuitBreaker;
    }
}
```

### Service Layer with Circuit Breaker

```java
@Service
public class PaymentService {
    
    private final CircuitBreaker circuitBreaker;
    private final PaymentGatewayClient paymentClient;
    private final PaymentRepository paymentRepository;
    
    public PaymentService(CircuitBreakerRegistry registry,
                         PaymentGatewayClient paymentClient,
                         PaymentRepository paymentRepository) {
        this.circuitBreaker = registry.circuitBreaker("payment-gateway");
        this.paymentClient = paymentClient;
        this.paymentRepository = paymentRepository;
    }
    
    public PaymentResult processPayment(PaymentRequest request) {
        Supplier<PaymentResult> decoratedSupplier = CircuitBreaker
            .decorateSupplier(circuitBreaker, () -> {
                // Call external payment gateway
                return paymentClient.processPayment(request);
            });
            
        try {
            PaymentResult result = decoratedSupplier.get();
            
            // Save successful payment
            Payment payment = new Payment(request, result, PaymentStatus.COMPLETED);
            paymentRepository.save(payment);
            
            return result;
            
        } catch (CallNotPermittedException e) {
            log.warn("Payment gateway circuit breaker is open");
            
            // Fallback: Queue for later processing
            Payment payment = new Payment(request, null, PaymentStatus.QUEUED);
            paymentRepository.save(payment);
            
            return PaymentResult.queued("Payment queued for processing");
            
        } catch (Exception e) {
            log.error("Payment processing failed", e);
            
            Payment payment = new Payment(request, null, PaymentStatus.FAILED);
            paymentRepository.save(payment);
            
            throw new PaymentException("Payment processing failed", e);
        }
    }
}
```

### Reactive Circuit Breaker

```java
@Service
public class ReactiveExternalService {
    
    private final CircuitBreaker circuitBreaker;
    private final WebClient webClient;
    
    public ReactiveExternalService(CircuitBreakerRegistry registry) {
        this.circuitBreaker = registry.circuitBreaker("external-api");
        this.webClient = WebClient.builder()
            .baseUrl("https://api.external-service.com")
            .build();
    }
    
    public Mono<ApiResponse> callExternalApi(String data) {
        return webClient
            .post()
            .uri("/api/process")
            .bodyValue(Map.of("data", data))
            .retrieve()
            .bodyToMono(ApiResponse.class)
            .transform(CircuitBreakerOperator.of(circuitBreaker))
            .onErrorResume(CallNotPermittedException.class, ex -> {
                log.warn("Circuit breaker is open, using cached response");
                return getCachedResponse(data);
            })
            .onErrorResume(TimeoutException.class, ex -> {
                log.warn("Request timeout, using fallback");
                return getFallbackResponse(data);
            })
            .timeout(Duration.ofSeconds(5));
    }
    
    private Mono<ApiResponse> getCachedResponse(String data) {
        // Return cached response or default response
        return Mono.just(new ApiResponse("cached", data));
    }
    
    private Mono<ApiResponse> getFallbackResponse(String data) {
        return Mono.just(new ApiResponse("fallback", data));
    }
}
```

## Bulkhead Pattern Implementation

### Thread Pool Isolation

```java
@Configuration
@EnableAsync
public class BulkheadConfig implements AsyncConfigurer {
    
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
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("OrderService-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
    
    @Bean("notificationServiceExecutor")
    public Executor notificationServiceExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(3);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("Notification-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());
        executor.initialize();
        return executor;
    }
}
```

### Service Isolation with Bulkhead

```java
@Service
public class IsolatedUserService {
    
    private final UserRepository userRepository;
    private final EmailService emailService;
    
    public IsolatedUserService(UserRepository userRepository, 
                              EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }
    
    @Async("userServiceExecutor")
    public CompletableFuture<User> createUser(CreateUserRequest request) {
        try {
            User user = new User(request.getEmail(), request.getName());
            User savedUser = userRepository.save(user);
            
            // Send welcome email asynchronously in separate thread pool
            sendWelcomeEmailAsync(savedUser);
            
            return CompletableFuture.completedFuture(savedUser);
            
        } catch (Exception e) {
            log.error("User creation failed", e);
            return CompletableFuture.failedFuture(e);
        }
    }
    
    @Async("notificationServiceExecutor")
    public CompletableFuture<Void> sendWelcomeEmailAsync(User user) {
        try {
            emailService.sendWelcomeEmail(user.getEmail(), user.getName());
            return CompletableFuture.completedFuture(null);
        } catch (Exception e) {
            log.error("Failed to send welcome email to {}", user.getEmail(), e);
            // Don't fail user creation if email fails
            return CompletableFuture.completedFuture(null);
        }
    }
}

@Service
public class IsolatedOrderService {
    
    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final InventoryService inventoryService;
    
    @Async("orderServiceExecutor")
    public CompletableFuture<Order> processOrder(OrderRequest request) {
        try {
            // Check inventory in parallel
            CompletableFuture<Boolean> inventoryCheck = 
                checkInventoryAsync(request.getItems());
                
            // Process payment in parallel
            CompletableFuture<PaymentResult> paymentResult = 
                processPaymentAsync(request.getPaymentInfo());
            
            // Wait for both operations
            CompletableFuture.allOf(inventoryCheck, paymentResult).join();
            
            if (!inventoryCheck.get()) {
                throw new InsufficientInventoryException("Not enough inventory");
            }
            
            if (!paymentResult.get().isSuccessful()) {
                throw new PaymentFailedException("Payment failed");
            }
            
            Order order = new Order(request);
            return CompletableFuture.completedFuture(orderRepository.save(order));
            
        } catch (Exception e) {
            log.error("Order processing failed", e);
            return CompletableFuture.failedFuture(e);
        }
    }
    
    @Async("orderServiceExecutor")
    private CompletableFuture<Boolean> checkInventoryAsync(List<OrderItem> items) {
        return CompletableFuture.supplyAsync(() -> 
            inventoryService.checkAvailability(items));
    }
    
    @Async("orderServiceExecutor")
    private CompletableFuture<PaymentResult> processPaymentAsync(PaymentInfo paymentInfo) {
        return CompletableFuture.supplyAsync(() -> 
            paymentService.processPayment(new PaymentRequest(paymentInfo)));
    }
}
```

### Connection Pool Bulkhead

```java
@Configuration
public class DatabaseBulkheadConfig {
    
    @Bean
    @Primary
    @Qualifier("primaryDataSource")
    public DataSource primaryDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://localhost:5432/primary");
        config.setUsername("user");
        config.setPassword("password");
        
        // Primary operations pool
        config.setMaximumPoolSize(20);
        config.setMinimumIdle(5);
        config.setConnectionTimeout(30000);
        config.setPoolName("PrimaryPool");
        
        return new HikariDataSource(config);
    }
    
    @Bean
    @Qualifier("reportsDataSource")
    public DataSource reportsDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://localhost:5432/primary");
        config.setUsername("reports_user");
        config.setPassword("password");
        
        // Separate pool for heavy reporting queries
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(60000);
        config.setPoolName("ReportsPool");
        
        return new HikariDataSource(config);
    }
    
    @Bean
    @Primary
    public JdbcTemplate primaryJdbcTemplate(@Qualifier("primaryDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
    
    @Bean
    public JdbcTemplate reportsJdbcTemplate(@Qualifier("reportsDataSource") DataSource dataSource) {
        JdbcTemplate template = new JdbcTemplate(dataSource);
        template.setQueryTimeout(300); // 5 minutes for reports
        return template;
    }
}
```

## Advanced Patterns

### Resilience4j Combination

```java
@Service
public class ResilientService {
    
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final TimeLimiter timeLimiter;
    private final Bulkhead bulkhead;
    
    public ResilientService(CircuitBreakerRegistry cbRegistry,
                           RetryRegistry retryRegistry,
                           TimeLimiterRegistry tlRegistry,
                           BulkheadRegistry bulkheadRegistry) {
        this.circuitBreaker = cbRegistry.circuitBreaker("resilient-service");
        this.retry = retryRegistry.retry("resilient-service");
        this.timeLimiter = tlRegistry.timeLimiter("resilient-service");
        this.bulkhead = bulkheadRegistry.bulkhead("resilient-service");
    }
    
    public CompletableFuture<String> callResilientService(String data) {
        Supplier<CompletableFuture<String>> decoratedSupplier = Decorators
            .ofSupplier(() -> CompletableFuture.supplyAsync(() -> {
                // Simulate external service call
                return callExternalService(data);
            }))
            .withCircuitBreaker(circuitBreaker)
            .withRetry(retry)
            .withTimeLimiter(timeLimiter)
            .withBulkhead(bulkhead)
            .decorate();
        
        return decoratedSupplier.get()
            .exceptionally(throwable -> {
                log.error("All resilience patterns failed", throwable);
                return getFallbackResponse(data);
            });
    }
    
    private String callExternalService(String data) {
        // External service call implementation
        if (Math.random() > 0.7) {
            throw new RuntimeException("Service temporarily unavailable");
        }
        return "Processed: " + data;
    }
    
    private String getFallbackResponse(String data) {
        return "Fallback response for: " + data;
    }
}
```

### Custom Health Indicators

```java
@Component
public class CircuitBreakerHealthIndicator implements HealthIndicator {
    
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    
    public CircuitBreakerHealthIndicator(CircuitBreakerRegistry registry) {
        this.circuitBreakerRegistry = registry;
    }
    
    @Override
    public Health health() {
        Health.Builder builder = new Health.Builder();
        
        Map<String, Object> details = new HashMap<>();
        boolean allHealthy = true;
        
        for (CircuitBreaker cb : circuitBreakerRegistry.getAllCircuitBreakers()) {
            CircuitBreaker.State state = cb.getState();
            String name = cb.getName();
            
            details.put(name + ".state", state.toString());
            details.put(name + ".failureRate", cb.getMetrics().getFailureRate());
            details.put(name + ".calls", cb.getMetrics().getNumberOfBufferedCalls());
            
            if (state == CircuitBreaker.State.OPEN) {
                allHealthy = false;
            }
        }
        
        if (allHealthy) {
            builder.up();
        } else {
            builder.down();
        }
        
        return builder.withDetails(details).build();
    }
}
```

### Metrics and Monitoring

```java
@Component
public class CircuitBreakerMetrics {
    
    private final MeterRegistry meterRegistry;
    
    public CircuitBreakerMetrics(MeterRegistry meterRegistry,
                                CircuitBreakerRegistry circuitBreakerRegistry) {
        this.meterRegistry = meterRegistry;
        
        // Register metrics for all circuit breakers
        circuitBreakerRegistry.getAllCircuitBreakers().forEach(this::registerMetrics);
    }
    
    private void registerMetrics(CircuitBreaker circuitBreaker) {
        String name = circuitBreaker.getName();
        
        // State gauge
        Gauge.builder("circuit.breaker.state")
            .description("Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)")
            .tag("name", name)
            .register(meterRegistry, circuitBreaker, cb -> {
                switch (cb.getState()) {
                    case CLOSED: return 0;
                    case OPEN: return 1;
                    case HALF_OPEN: return 2;
                    default: return -1;
                }
            });
        
        // Failure rate gauge
        Gauge.builder("circuit.breaker.failure.rate")
            .description("Circuit breaker failure rate")
            .tag("name", name)
            .register(meterRegistry, circuitBreaker, 
                cb -> cb.getMetrics().getFailureRate());
        
        // Call counters
        circuitBreaker.getEventPublisher()
            .onSuccess(event -> 
                Counter.builder("circuit.breaker.calls")
                    .tag("name", name)
                    .tag("outcome", "success")
                    .register(meterRegistry)
                    .increment()
            )
            .onError(event -> 
                Counter.builder("circuit.breaker.calls")
                    .tag("name", name)
                    .tag("outcome", "error")
                    .register(meterRegistry)
                    .increment()
            )
            .onCallNotPermitted(event -> 
                Counter.builder("circuit.breaker.calls")
                    .tag("name", name)
                    .tag("outcome", "not_permitted")
                    .register(meterRegistry)
                    .increment()
            );
    }
}
```

This implementation provides comprehensive protection against cascading failures through circuit breaker patterns and resource isolation via bulkhead patterns, ensuring system stability under various failure conditions.
