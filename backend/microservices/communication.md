# Senkron vs Asenkron İletişim

Mikroservis mimarisinde servisler arası iletişim kritik bir konudur. Bu bölümde senkron (REST/gRPC) ve asenkron (Event-Driven) iletişim modellerinin Spring Boot ile implementasyonunu detaylı olarak inceleyeceğiz.

## İçindekiler
- [Senkron İletişim Patterns](#senkron-iletişim-patterns)
- [Asenkron İletişim Architecture](#asenkron-iletişim-architecture)
- [Performance Optimization](#performance-optimization)
- [Implementation Examples](#implementation-examples)

## Senkron İletişim Patterns

### REST API Communication

#### Spring WebClient Implementation

**Reactive HTTP Client Configuration:**

```java
@Configuration
@EnableConfigurationProperties(WebClientProperties.class)
public class WebClientConfig {
    
    @Bean
    @Primary
    public WebClient defaultWebClient(WebClientProperties properties) {
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(
                HttpClient.create()
                    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.getConnectTimeout())
                    .responseTimeout(Duration.ofMillis(properties.getResponseTimeout()))
                    .wiretap(properties.isWiretap())
            ))
            .codecs(configurer -> configurer
                .defaultCodecs()
                .maxInMemorySize(properties.getMaxInMemorySize()))
            .filter(ExchangeFilterFunctions.retry(
                RetrySpec.backoff(3, Duration.ofSeconds(1))
                    .maxBackoff(Duration.ofSeconds(10))
                    .filter(throwable -> throwable instanceof ConnectException)
            ))
            .build();
    }
    
    @Bean
    public WebClient userServiceClient(WebClient.Builder builder,
                                     @Value("${services.user.url}") String baseUrl) {
        return builder
            .baseUrl(baseUrl)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .filter(authenticationFilter())
            .filter(loggingFilter())
            .build();
    }
    
    private ExchangeFilterFunction authenticationFilter() {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            String token = SecurityContextHolder.getContext()
                .getAuthentication()
                .getDetails()
                .toString();
            
            return Mono.just(
                ClientRequest.from(request)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .build()
            );
        });
    }
    
    private ExchangeFilterFunction loggingFilter() {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            log.info("Request: {} {}", request.method(), request.url());
            return Mono.just(request);
        });
    }
}
```

**WebClient Properties Configuration:**

```java
@ConfigurationProperties(prefix = "webclient")
@Data
public class WebClientProperties {
    private int connectTimeout = 5000;
    private int responseTimeout = 30000;
    private int maxInMemorySize = 1024 * 1024; // 1MB
    private boolean wiretap = false;
    private Pool pool = new Pool();
    
    @Data
    public static class Pool {
        private int maxConnections = 100;
        private int maxIdleTime = 30000;
        private int maxLifeTime = 60000;
        private int pendingAcquireTimeout = 45000;
    }
}
```

#### Circuit Breaker Integration

**Resilience4j Circuit Breaker Configuration:**

```java
@Component
public class UserServiceClient {
    
    private final WebClient webClient;
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final TimeLimiter timeLimiter;
    
    public UserServiceClient(WebClient userServiceClient,
                           CircuitBreakerRegistry circuitBreakerRegistry,
                           RetryRegistry retryRegistry,
                           TimeLimiterRegistry timeLimiterRegistry) {
        this.webClient = userServiceClient;
        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker("userService");
        this.retry = retryRegistry.retry("userService");
        this.timeLimiter = timeLimiterRegistry.timeLimiter("userService");
    }
    
    public Mono<UserDto> getUserById(Long userId) {
        Supplier<CompletableFuture<UserDto>> futureSupplier = () ->
            webClient.get()
                .uri("/users/{id}", userId)
                .retrieve()
                .onStatus(HttpStatus::is4xxClientError, response -> 
                    Mono.error(new UserNotFoundException("User not found: " + userId)))
                .onStatus(HttpStatus::is5xxServerError, response ->
                    Mono.error(new ServiceUnavailableException("User service unavailable")))
                .bodyToMono(UserDto.class)
                .toFuture();
        
        Supplier<CompletableFuture<UserDto>> decoratedSupplier = 
            Decorators.ofSupplier(futureSupplier)
                .withCircuitBreaker(circuitBreaker)
                .withRetry(retry)
                .withTimeLimiter(timeLimiter)
                .withFallback(Arrays.asList(
                    TimeoutException.class, 
                    CallNotPermittedException.class,
                    ServiceUnavailableException.class
                ), throwable -> CompletableFuture.completedFuture(getDefaultUser(userId)))
                .decorate();
        
        return Mono.fromFuture(decoratedSupplier.get());
    }
    
    private UserDto getDefaultUser(Long userId) {
        return UserDto.builder()
            .id(userId)
            .username("unknown")
            .email("unknown@example.com")
            .status("INACTIVE")
            .build();
    }
    
    @EventListener
    public void handleCircuitBreakerStateChange(CircuitBreakerOnStateTransitionEvent event) {
        log.info("Circuit breaker {} state changed from {} to {}", 
            event.getCircuitBreakerName(),
            event.getStateTransition().getFromState(),
            event.getStateTransition().getToState());
    }
}
```

### OpenFeign Integration

**Declarative REST Client:**

```java
@FeignClient(
    name = "order-service",
    url = "${services.order.url}",
    configuration = OrderServiceFeignConfig.class,
    fallback = OrderServiceFallback.class
)
public interface OrderServiceClient {
    
    @GetMapping("/orders/{orderId}")
    @Retryable(value = {ConnectException.class}, maxAttempts = 3)
    OrderDto getOrder(@PathVariable("orderId") Long orderId);
    
    @PostMapping("/orders")
    @CircuitBreaker(name = "order-service", fallbackMethod = "createOrderFallback")
    OrderDto createOrder(@RequestBody CreateOrderRequest request);
    
    @GetMapping("/orders")
    Page<OrderDto> getOrdersByUserId(
        @RequestParam("userId") Long userId,
        @RequestParam("page") int page,
        @RequestParam("size") int size,
        @RequestParam("sort") String sort
    );
    
    @PutMapping("/orders/{orderId}/status")
    void updateOrderStatus(@PathVariable("orderId") Long orderId, 
                          @RequestBody OrderStatusUpdateRequest request);
    
    default OrderDto createOrderFallback(CreateOrderRequest request, Exception ex) {
        log.warn("Order service unavailable, using fallback", ex);
        return OrderDto.builder()
            .id(-1L)
            .status("PENDING")
            .message("Order will be processed when service is available")
            .build();
    }
}
```

**Feign Configuration:**

```java
@Configuration
public class OrderServiceFeignConfig {
    
    @Bean
    public Decoder feignDecoder() {
        return new JacksonDecoder(objectMapper());
    }
    
    @Bean
    public Encoder feignEncoder() {
        return new JacksonEncoder(objectMapper());
    }
    
    @Bean
    public Contract feignContract() {
        return new SpringMvcContract();
    }
    
    @Bean
    public Retryer feignRetryer() {
        return new Retryer.Default(100L, TimeUnit.SECONDS.toMillis(1L), 3);
    }
    
    @Bean
    public RequestInterceptor requestInterceptor() {
        return template -> {
            // JWT token propagation
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getDetails() instanceof String) {
                template.header(HttpHeaders.AUTHORIZATION, 
                    "Bearer " + authentication.getDetails());
            }
            
            // Correlation ID propagation
            String correlationId = MDC.get("correlationId");
            if (correlationId != null) {
                template.header("X-Correlation-ID", correlationId);
            }
            
            // Request tracing
            template.header("X-Request-Source", "feign-client");
            template.header("X-Request-Timestamp", Instant.now().toString());
        };
    }
    
    @Bean
    public ErrorDecoder errorDecoder() {
        return new CustomFeignErrorDecoder();
    }
    
    @Bean
    public Logger.Level feignLoggerLevel() {
        return Logger.Level.FULL;
    }
    
    private ObjectMapper objectMapper() {
        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
    }
}
```

## gRPC Implementation

### Spring Boot gRPC Integration

**Server Configuration:**

```java
@Configuration
@EnableConfigurationProperties(GrpcServerProperties.class)
public class GrpcServerConfig {
    
    @Bean
    public NettyChannelBuilder channelBuilder(GrpcServerProperties properties) {
        return NettyChannelBuilder.forAddress(properties.getHost(), properties.getPort())
            .keepAliveTime(properties.getKeepAlive().getTime(), TimeUnit.SECONDS)
            .keepAliveTimeout(properties.getKeepAlive().getTimeout(), TimeUnit.SECONDS)
            .keepAliveWithoutCalls(properties.getKeepAlive().isWithoutCalls())
            .idleTimeout(properties.getIdleTimeout(), TimeUnit.SECONDS)
            .maxInboundMessageSize(properties.getMaxMessageSize())
            .maxInboundMetadataSize(properties.getMaxMetadataSize());
    }
    
    @Bean
    public ServerInterceptor authenticationInterceptor() {
        return new ServerInterceptor() {
            @Override
            public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
                    ServerCall<ReqT, RespT> call,
                    Metadata headers,
                    ServerCallHandler<ReqT, RespT> next) {
                
                String token = headers.get(Metadata.Key.of("authorization", 
                    Metadata.ASCII_STRING_MARSHALLER));
                
                if (token != null && token.startsWith("Bearer ")) {
                    // JWT token validation
                    String jwt = token.substring(7);
                    if (jwtTokenValidator.validateToken(jwt)) {
                        Context context = Context.current()
                            .withValue(USER_CONTEXT_KEY, extractUserFromToken(jwt));
                        return Contexts.interceptCall(context, call, headers, next);
                    }
                }
                
                call.close(Status.UNAUTHENTICATED.withDescription("Invalid token"), 
                    new Metadata());
                return new ServerCall.Listener<ReqT>() {};
            }
        };
    }
}
```

**gRPC Service Implementation:**

```java
@GrpcService
@Slf4j
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {
    
    private final UserService userService;
    private final UserMapper userMapper;
    
    @Override
    public void getUser(GetUserRequest request, 
                       StreamObserver<GetUserResponse> responseObserver) {
        try {
            log.info("Received getUser request for userId: {}", request.getUserId());
            
            User user = userService.findById(request.getUserId());
            UserProto userProto = userMapper.toProto(user);
            
            GetUserResponse response = GetUserResponse.newBuilder()
                .setUser(userProto)
                .setSuccess(true)
                .build();
                
            responseObserver.onNext(response);
            responseObserver.onCompleted();
            
        } catch (UserNotFoundException e) {
            Status status = Status.NOT_FOUND.withDescription(e.getMessage());
            responseObserver.onError(status.asRuntimeException());
        } catch (Exception e) {
            log.error("Error processing getUser request", e);
            Status status = Status.INTERNAL.withDescription("Internal server error");
            responseObserver.onError(status.asRuntimeException());
        }
    }
    
    @Override
    public void getUserStream(GetUserStreamRequest request,
                             StreamObserver<GetUserResponse> responseObserver) {
        try {
            List<Long> userIds = request.getUserIdsList();
            log.info("Received getUserStream request for {} users", userIds.size());
            
            userIds.stream()
                .map(userService::findById)
                .map(userMapper::toProto)
                .map(userProto -> GetUserResponse.newBuilder()
                    .setUser(userProto)
                    .setSuccess(true)
                    .build())
                .forEach(responseObserver::onNext);
                
            responseObserver.onCompleted();
            
        } catch (Exception e) {
            log.error("Error processing getUserStream request", e);
            Status status = Status.INTERNAL.withDescription("Stream processing error");
            responseObserver.onError(status.asRuntimeException());
        }
    }
    
    @Override
    public StreamObserver<CreateUserRequest> createUserBatch(
            StreamObserver<CreateUserResponse> responseObserver) {
        
        return new StreamObserver<CreateUserRequest>() {
            private final List<CreateUserRequest> requests = new ArrayList<>();
            
            @Override
            public void onNext(CreateUserRequest request) {
                requests.add(request);
                log.debug("Received user creation request: {}", request.getUser().getEmail());
            }
            
            @Override
            public void onError(Throwable t) {
                log.error("Error in createUserBatch stream", t);
            }
            
            @Override
            public void onCompleted() {
                try {
                    List<User> users = requests.stream()
                        .map(req -> userMapper.fromProto(req.getUser()))
                        .collect(Collectors.toList());
                        
                    List<User> savedUsers = userService.createBatch(users);
                    
                    CreateUserResponse response = CreateUserResponse.newBuilder()
                        .addAllCreatedUserIds(
                            savedUsers.stream()
                                .map(User::getId)
                                .collect(Collectors.toList())
                        )
                        .setSuccess(true)
                        .setMessage("Created " + savedUsers.size() + " users")
                        .build();
                        
                    responseObserver.onNext(response);
                    responseObserver.onCompleted();
                    
                } catch (Exception e) {
                    log.error("Error processing batch user creation", e);
                    Status status = Status.INTERNAL.withDescription("Batch processing error");
                    responseObserver.onError(status.asRuntimeException());
                }
            }
        };
    }
}
```

## Asenkron İletişim Architecture

### Event-Driven Patterns

**Domain Events with Spring:**

```java
@Component
@Slf4j
public class OrderEventPublisher {
    
    private final ApplicationEventPublisher eventPublisher;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @EventListener
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Publishing order created event: {}", event.getOrderId());
        
        OrderCreatedMessage message = OrderCreatedMessage.builder()
            .orderId(event.getOrderId())
            .userId(event.getUserId())
            .totalAmount(event.getTotalAmount())
            .createdAt(event.getCreatedAt())
            .build();
            
        kafkaTemplate.send("order-events", event.getOrderId().toString(), message)
            .addCallback(
                result -> log.info("Order event published successfully"),
                failure -> log.error("Failed to publish order event", failure)
            );
    }
    
    @Async
    @EventListener
    public void handleOrderStatusChanged(OrderStatusChangedEvent event) {
        log.info("Order status changed: {} -> {}", 
            event.getOrderId(), event.getNewStatus());
            
        // Publish to external systems
        publishToExternalSystems(event);
        
        // Update read models
        updateReadModels(event);
        
        // Send notifications
        sendNotifications(event);
    }
    
    private void publishToExternalSystems(OrderStatusChangedEvent event) {
        OrderStatusMessage message = OrderStatusMessage.builder()
            .orderId(event.getOrderId())
            .previousStatus(event.getPreviousStatus())
            .newStatus(event.getNewStatus())
            .changedAt(event.getChangedAt())
            .reason(event.getReason())
            .build();
            
        // Publish to different topics based on status
        String topic = switch (event.getNewStatus()) {
            case CONFIRMED -> "order-confirmed";
            case SHIPPED -> "order-shipped";
            case DELIVERED -> "order-delivered";
            case CANCELLED -> "order-cancelled";
            default -> "order-status-changed";
        };
        
        kafkaTemplate.send(topic, event.getOrderId().toString(), message);
    }
}
```

### Spring Cloud Stream Implementation

**Functional Configuration:**

```java
@Configuration
@EnableBinding({OrderEventProcessor.class})
public class StreamConfig {
    
    @Bean
    public Consumer<OrderCreatedMessage> orderCreated() {
        return message -> {
            log.info("Processing order created: {}", message.getOrderId());
            
            try {
                // Process order creation
                orderProcessingService.processOrderCreation(message);
                
                // Update inventory
                inventoryService.reserveItems(message.getItems());
                
                // Send confirmation email
                notificationService.sendOrderConfirmation(message);
                
            } catch (Exception e) {
                log.error("Error processing order created event", e);
                throw new RetryableException("Order processing failed", e);
            }
        };
    }
    
    @Bean
    public Consumer<PaymentProcessedMessage> paymentProcessed() {
        return message -> {
            log.info("Processing payment: {}", message.getPaymentId());
            
            if (message.isSuccessful()) {
                orderService.confirmOrder(message.getOrderId());
            } else {
                orderService.cancelOrder(message.getOrderId(), 
                    "Payment failed: " + message.getFailureReason());
            }
        };
    }
    
    @Bean
    public Function<OrderCreatedMessage, PaymentRequestMessage> orderToPayment() {
        return orderMessage -> {
            log.info("Converting order to payment request: {}", orderMessage.getOrderId());
            
            return PaymentRequestMessage.builder()
                .orderId(orderMessage.getOrderId())
                .userId(orderMessage.getUserId())
                .amount(orderMessage.getTotalAmount())
                .currency(orderMessage.getCurrency())
                .paymentMethod(orderMessage.getPaymentMethod())
                .build();
        };
    }
    
    @Bean
    public Supplier<OrderStatusMessage> orderStatusUpdates() {
        return () -> {
            // Periodically send status updates for tracking
            List<Order> ordersToUpdate = orderService.getOrdersNeedingStatusUpdate();
            
            return ordersToUpdate.stream()
                .map(this::createStatusMessage)
                .findFirst()
                .orElse(null);
        };
    }
}
```

**Error Handling and Dead Letter Queue:**

```java
@Component
@Slf4j
public class OrderEventErrorHandler {
    
    @ServiceActivator(inputChannel = "order-events.order-group.errors")
    public void handleError(ErrorMessage errorMessage) {
        Throwable throwable = errorMessage.getPayload();
        Message<?> originalMessage = (Message<?>) errorMessage.getHeaders()
            .get("originalMessage");
            
        log.error("Error processing message: {}", originalMessage, throwable);
        
        if (isRetryableError(throwable)) {
            // Send to retry topic
            retryService.scheduleRetry(originalMessage, throwable);
        } else {
            // Send to dead letter queue
            deadLetterService.sendToDeadLetter(originalMessage, throwable);
        }
    }
    
    @EventListener
    public void handleRetryExhausted(RetryExhaustedEvent event) {
        log.error("Retry exhausted for message: {}", event.getMessage());
        
        // Send notification to operations team
        alertingService.sendAlert(
            "Message Processing Failed",
            "Message processing failed after all retries: " + event.getMessage()
        );
        
        // Store for manual investigation
        failedMessageRepository.save(
            FailedMessage.builder()
                .message(event.getMessage().toString())
                .error(event.getThrowable().getMessage())
                .timestamp(Instant.now())
                .build()
        );
    }
    
    private boolean isRetryableError(Throwable throwable) {
        return throwable instanceof TransientDataAccessException ||
               throwable instanceof ConnectException ||
               throwable instanceof TimeoutException;
    }
}
```

### Saga Pattern Implementation

**Orchestration-based Saga:**

```java
@Component
@Slf4j
public class OrderSagaOrchestrator {
    
    private final SagaStateMachine sagaStateMachine;
    private final List<SagaStep> sagaSteps;
    
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Starting order saga for order: {}", event.getOrderId());
        
        OrderSagaData sagaData = OrderSagaData.builder()
            .orderId(event.getOrderId())
            .userId(event.getUserId())
            .totalAmount(event.getTotalAmount())
            .status(SagaStatus.STARTED)
            .currentStep(0)
            .build();
            
        executeSaga(sagaData);
    }
    
    private void executeSaga(OrderSagaData sagaData) {
        while (sagaData.getCurrentStep() < sagaSteps.size()) {
            SagaStep currentStep = sagaSteps.get(sagaData.getCurrentStep());
            
            try {
                log.info("Executing saga step: {} for order: {}", 
                    currentStep.getName(), sagaData.getOrderId());
                    
                StepResult result = currentStep.execute(sagaData);
                
                if (result.isSuccess()) {
                    sagaData.setCurrentStep(sagaData.getCurrentStep() + 1);
                    sagaRepository.save(sagaData);
                } else {
                    // Execute compensation
                    compensate(sagaData);
                    return;
                }
                
            } catch (Exception e) {
                log.error("Saga step failed: {}", currentStep.getName(), e);
                compensate(sagaData);
                return;
            }
        }
        
        // All steps completed successfully
        sagaData.setStatus(SagaStatus.COMPLETED);
        sagaRepository.save(sagaData);
        
        publishEvent(new OrderSagaCompletedEvent(sagaData.getOrderId()));
    }
    
    private void compensate(OrderSagaData sagaData) {
        log.info("Starting compensation for order: {}", sagaData.getOrderId());
        sagaData.setStatus(SagaStatus.COMPENSATING);
        
        // Execute compensation in reverse order
        for (int i = sagaData.getCurrentStep() - 1; i >= 0; i--) {
            SagaStep step = sagaSteps.get(i);
            try {
                step.compensate(sagaData);
            } catch (Exception e) {
                log.error("Compensation failed for step: {}", step.getName(), e);
                // Mark saga as failed
                sagaData.setStatus(SagaStatus.FAILED);
                break;
            }
        }
        
        sagaRepository.save(sagaData);
        publishEvent(new OrderSagaFailedEvent(sagaData.getOrderId()));
    }
}
```

**Saga Step Implementation:**

```java
@Component
public class PaymentSagaStep implements SagaStep {
    
    private final PaymentService paymentService;
    
    @Override
    public String getName() {
        return "PaymentStep";
    }
    
    @Override
    public StepResult execute(OrderSagaData sagaData) {
        try {
            PaymentRequest request = PaymentRequest.builder()
                .orderId(sagaData.getOrderId())
                .userId(sagaData.getUserId())
                .amount(sagaData.getTotalAmount())
                .build();
                
            PaymentResult result = paymentService.processPayment(request);
            
            if (result.isSuccessful()) {
                sagaData.setPaymentId(result.getPaymentId());
                return StepResult.success();
            } else {
                return StepResult.failure(result.getErrorMessage());
            }
            
        } catch (Exception e) {
            log.error("Payment processing failed", e);
            return StepResult.failure("Payment service unavailable");
        }
    }
    
    @Override
    public void compensate(OrderSagaData sagaData) {
        if (sagaData.getPaymentId() != null) {
            try {
                paymentService.refundPayment(sagaData.getPaymentId());
                log.info("Payment refunded for order: {}", sagaData.getOrderId());
            } catch (Exception e) {
                log.error("Failed to refund payment", e);
                // Send alert for manual intervention
                alertingService.sendCriticalAlert(
                    "Saga Compensation Failed",
                    "Failed to refund payment for order: " + sagaData.getOrderId()
                );
            }
        }
    }
}
```

## Performance Optimization

### Connection Pooling and Resource Management

```java
@Configuration
public class PerformanceConfig {
    
    @Bean
    @ConfigurationProperties("app.httpclient")
    public HttpClient httpClient() {
        ConnectionProvider provider = ConnectionProvider.builder("custom")
            .maxConnections(200)
            .maxIdleTime(Duration.ofSeconds(30))
            .maxLifeTime(Duration.ofMinutes(5))
            .pendingAcquireTimeout(Duration.ofSeconds(45))
            .evictInBackground(Duration.ofSeconds(120))
            .build();
            
        return HttpClient.create(provider)
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .option(ChannelOption.SO_KEEPALIVE, true)
            .option(ChannelOption.TCP_NODELAY, true)
            .responseTimeout(Duration.ofSeconds(30))
            .compress(true);
    }
    
    @Bean
    public KafkaProducerFactory<String, Object> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        
        // Performance optimizations
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384);
        props.put(ProducerConfig.LINGER_MS_CONFIG, 5);
        props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");
        props.put(ProducerConfig.BUFFER_MEMORY_CONFIG, 33554432);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        
        return new DefaultKafkaProducerFactory<>(props);
    }
}
```

### Monitoring and Metrics

```java
@Component
public class CommunicationMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter httpRequestsTotal;
    private final Timer httpRequestDuration;
    private final Counter kafkaMessagesProduced;
    private final Counter kafkaMessagesConsumed;
    
    public CommunicationMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.httpRequestsTotal = Counter.builder("http_requests_total")
            .description("Total HTTP requests")
            .tag("application", "order-service")
            .register(meterRegistry);
            
        this.httpRequestDuration = Timer.builder("http_request_duration_seconds")
            .description("HTTP request duration")
            .register(meterRegistry);
            
        this.kafkaMessagesProduced = Counter.builder("kafka_messages_produced_total")
            .description("Total Kafka messages produced")
            .register(meterRegistry);
            
        this.kafkaMessagesConsumed = Counter.builder("kafka_messages_consumed_total")
            .description("Total Kafka messages consumed")
            .register(meterRegistry);
    }
    
    @EventListener
    public void onHttpRequest(HttpRequestEvent event) {
        httpRequestsTotal.increment(
            Tags.of(
                "method", event.getMethod(),
                "status", String.valueOf(event.getStatus()),
                "endpoint", event.getEndpoint()
            )
        );
        
        httpRequestDuration.record(event.getDuration(), TimeUnit.MILLISECONDS);
    }
    
    @EventListener
    public void onKafkaMessageProduced(KafkaMessageProducedEvent event) {
        kafkaMessagesProduced.increment(
            Tags.of(
                "topic", event.getTopic(),
                "partition", String.valueOf(event.getPartition())
            )
        );
    }
}
```

Bu kapsamlı implementasyon, mikroservis iletişiminin tüm yönlerini Spring Boot ekosistemi ile birlikte ele almaktadır. Her pattern için production-ready örnekler, error handling, monitoring ve performance optimizasyonları içermektedir.
