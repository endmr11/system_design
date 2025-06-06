# Distributed Tracing ve Correlation IDs - Dağıtık Sistem İzleme

Mikroservis mimarisinde isteklerin servisler arası takibi ve korelasyon yönetimi için gelişmiş teknikler.

## Correlation ID Implementasyonu

### MDC (Mapped Diagnostic Context) Kullanımı

MDC, thread-local storage kullanarak context bilgilerini yönetir:

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter implements Filter {
    
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    private static final String CORRELATION_ID_MDC_KEY = "correlationId";
    private static final String USER_ID_HEADER = "X-User-ID";
    private static final String SESSION_ID_HEADER = "X-Session-ID";
    private static final String REQUEST_ID_HEADER = "X-Request-ID";
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Correlation ID'yi header'dan al veya oluştur
        String correlationId = extractOrGenerateCorrelationId(httpRequest);
        String userId = httpRequest.getHeader(USER_ID_HEADER);
        String sessionId = httpRequest.getHeader(SESSION_ID_HEADER);
        String requestId = UUID.randomUUID().toString();
        
        try {
            // MDC'ye context bilgilerini ekle
            MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
            MDC.put("userId", userId != null ? userId : "anonymous");
            MDC.put("sessionId", sessionId != null ? sessionId : "none");
            MDC.put("requestId", requestId);
            MDC.put("userAgent", httpRequest.getHeader("User-Agent"));
            MDC.put("ipAddress", getClientIpAddress(httpRequest));
            MDC.put("endpoint", httpRequest.getRequestURI());
            MDC.put("method", httpRequest.getMethod());
            
            // Response header'larına ekle
            httpResponse.setHeader(CORRELATION_ID_HEADER, correlationId);
            httpResponse.setHeader(REQUEST_ID_HEADER, requestId);
            
            chain.doFilter(request, response);
            
        } finally {
            // Thread temizliği
            MDC.clear();
        }
    }
    
    private String extractOrGenerateCorrelationId(HttpServletRequest request) {
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.trim().isEmpty()) {
            correlationId = generateCorrelationId();
        }
        return correlationId;
    }
    
    private String generateCorrelationId() {
        // Timestamp + Random = Unique ID
        return System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
    
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }
}
```

### Context Propagation Service

```java
@Service
@Component
public class ContextPropagationService {
    
    private static final String CORRELATION_ID_KEY = "correlationId";
    private static final String USER_ID_KEY = "userId";
    private static final String SESSION_ID_KEY = "sessionId";
    private static final String TRACE_ID_KEY = "traceId";
    private static final String SPAN_ID_KEY = "spanId";
    
    public CorrelationContext getCurrentContext() {
        return CorrelationContext.builder()
                .correlationId(MDC.get(CORRELATION_ID_KEY))
                .userId(MDC.get(USER_ID_KEY))
                .sessionId(MDC.get(SESSION_ID_KEY))
                .traceId(MDC.get(TRACE_ID_KEY))
                .spanId(MDC.get(SPAN_ID_KEY))
                .ipAddress(MDC.get("ipAddress"))
                .userAgent(MDC.get("userAgent"))
                .endpoint(MDC.get("endpoint"))
                .method(MDC.get("method"))
                .build();
    }
    
    public void setContext(CorrelationContext context) {
        if (context.getCorrelationId() != null) {
            MDC.put(CORRELATION_ID_KEY, context.getCorrelationId());
        }
        if (context.getUserId() != null) {
            MDC.put(USER_ID_KEY, context.getUserId());
        }
        if (context.getSessionId() != null) {
            MDC.put(SESSION_ID_KEY, context.getSessionId());
        }
        if (context.getTraceId() != null) {
            MDC.put(TRACE_ID_KEY, context.getTraceId());
        }
        if (context.getSpanId() != null) {
            MDC.put(SPAN_ID_KEY, context.getSpanId());
        }
    }
    
    public <T> T executeWithContext(CorrelationContext context, Supplier<T> action) {
        CorrelationContext previousContext = getCurrentContext();
        try {
            setContext(context);
            return action.get();
        } finally {
            if (previousContext != null) {
                setContext(previousContext);
            } else {
                MDC.clear();
            }
        }
    }
    
    public void executeWithContext(CorrelationContext context, Runnable action) {
        executeWithContext(context, () -> {
            action.run();
            return null;
        });
    }
}

@Data
@Builder
public class CorrelationContext {
    private String correlationId;
    private String userId;
    private String sessionId;
    private String traceId;
    private String spanId;
    private String ipAddress;
    private String userAgent;
    private String endpoint;
    private String method;
    private Instant timestamp;
    
    public Map<String, String> toHeaders() {
        Map<String, String> headers = new HashMap<>();
        if (correlationId != null) headers.put("X-Correlation-ID", correlationId);
        if (userId != null) headers.put("X-User-ID", userId);
        if (sessionId != null) headers.put("X-Session-ID", sessionId);
        if (traceId != null) headers.put("X-Trace-ID", traceId);
        if (spanId != null) headers.put("X-Span-ID", spanId);
        return headers;
    }
}
```

## Cross-Service Correlation

### HTTP Client Interceptor

```java
@Component
public class CorrelationHttpClientInterceptor implements ClientHttpRequestInterceptor {
    
    private final ContextPropagationService contextService;
    
    public CorrelationHttpClientInterceptor(ContextPropagationService contextService) {
        this.contextService = contextService;
    }
    
    @Override
    public ClientHttpResponse intercept(
            HttpRequest request, 
            byte[] body,
            ClientHttpRequestExecution execution) throws IOException {
        
        // Mevcut context'i al
        CorrelationContext context = contextService.getCurrentContext();
        
        // Context bilgilerini header'lara ekle
        HttpHeaders headers = request.getHeaders();
        context.toHeaders().forEach(headers::set);
        
        // Service-to-service call metadata'sı ekle
        headers.set("X-Calling-Service", getCurrentServiceName());
        headers.set("X-Call-Timestamp", Instant.now().toString());
        headers.set("X-Call-Depth", String.valueOf(getCurrentCallDepth() + 1));
        
        return execution.execute(request, body);
    }
    
    private String getCurrentServiceName() {
        return System.getProperty("spring.application.name", "unknown");
    }
    
    private int getCurrentCallDepth() {
        String depth = MDC.get("callDepth");
        return depth != null ? Integer.parseInt(depth) : 0;
    }
}
```

### Feign Client Interceptor

```java
@Component
public class CorrelationFeignInterceptor implements RequestInterceptor {
    
    private final ContextPropagationService contextService;
    
    public CorrelationFeignInterceptor(ContextPropagationService contextService) {
        this.contextService = contextService;
    }
    
    @Override
    public void apply(RequestTemplate template) {
        CorrelationContext context = contextService.getCurrentContext();
        
        // Context header'larını ekle
        context.toHeaders().forEach(template::header);
        
        // Feign-specific metadata
        template.header("X-Client-Type", "feign");
        template.header("X-Client-Service", getCurrentServiceName());
        template.header("X-Client-Instance", getInstanceId());
        
        // Request timing
        template.header("X-Request-Start-Time", String.valueOf(System.currentTimeMillis()));
    }
    
    private String getCurrentServiceName() {
        return System.getProperty("spring.application.name", "unknown");
    }
    
    private String getInstanceId() {
        return System.getProperty("instance.id", InetAddress.getLocalHost().getHostName());
    }
}
```

### Message Queue Correlation

```java
@Component
public class CorrelationKafkaProducer {
    
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ContextPropagationService contextService;
    
    public CorrelationKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate,
                                   ContextPropagationService contextService) {
        this.kafkaTemplate = kafkaTemplate;
        this.contextService = contextService;
    }
    
    public void sendMessage(String topic, Object message) {
        CorrelationContext context = contextService.getCurrentContext();
        
        // Message header'larına context bilgilerini ekle
        ProducerRecord<String, Object> record = new ProducerRecord<>(topic, message);
        context.toHeaders().forEach((key, value) -> 
                record.headers().add(key, value.getBytes(StandardCharsets.UTF_8)));
        
        // Producer metadata
        record.headers().add("X-Producer-Service", getCurrentServiceName().getBytes());
        record.headers().add("X-Message-Timestamp", 
                Instant.now().toString().getBytes(StandardCharsets.UTF_8));
        record.headers().add("X-Message-Id", 
                UUID.randomUUID().toString().getBytes(StandardCharsets.UTF_8));
        
        kafkaTemplate.send(record);
    }
    
    private String getCurrentServiceName() {
        return System.getProperty("spring.application.name", "unknown");
    }
}

@KafkaListener(topics = "order-events")
public class CorrelationKafkaConsumer {
    
    private final ContextPropagationService contextService;
    
    public CorrelationKafkaConsumer(ContextPropagationService contextService) {
        this.contextService = contextService;
    }
    
    @KafkaListener(topics = "order-events")
    public void handleOrderEvent(@Payload OrderEvent event, 
                                @Header Map<String, Object> headers) {
        
        // Header'lardan context'i reconstruct et
        CorrelationContext context = reconstructContextFromHeaders(headers);
        
        // Context'i set et ve işlemi yap
        contextService.executeWithContext(context, () -> {
            processOrderEvent(event);
        });
    }
    
    private CorrelationContext reconstructContextFromHeaders(Map<String, Object> headers) {
        return CorrelationContext.builder()
                .correlationId(getStringHeader(headers, "X-Correlation-ID"))
                .userId(getStringHeader(headers, "X-User-ID"))
                .sessionId(getStringHeader(headers, "X-Session-ID"))
                .traceId(getStringHeader(headers, "X-Trace-ID"))
                .spanId(getStringHeader(headers, "X-Span-ID"))
                .build();
    }
    
    private String getStringHeader(Map<String, Object> headers, String key) {
        Object value = headers.get(key);
        if (value instanceof byte[]) {
            return new String((byte[]) value, StandardCharsets.UTF_8);
        }
        return value != null ? value.toString() : null;
    }
    
    private void processOrderEvent(OrderEvent event) {
        // İş mantığı burada
        log.info("Processing order event: {}", event);
    }
}
```

## Advanced Correlation Patterns

### User Journey Tracking

```java
@Service
@Slf4j
public class UserJourneyTracker {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final ContextPropagationService contextService;
    
    public UserJourneyTracker(RedisTemplate<String, Object> redisTemplate,
                             ContextPropagationService contextService) {
        this.redisTemplate = redisTemplate;
        this.contextService = contextService;
    }
    
    public void trackUserAction(String action, Map<String, Object> metadata) {
        CorrelationContext context = contextService.getCurrentContext();
        
        UserAction userAction = UserAction.builder()
                .sessionId(context.getSessionId())
                .userId(context.getUserId())
                .correlationId(context.getCorrelationId())
                .action(action)
                .metadata(metadata)
                .timestamp(Instant.now())
                .endpoint(context.getEndpoint())
                .userAgent(context.getUserAgent())
                .ipAddress(context.getIpAddress())
                .build();
        
        // Redis'e journey bilgisini kaydet
        String journeyKey = "user:journey:" + context.getSessionId();
        redisTemplate.opsForList().rightPush(journeyKey, userAction);
        redisTemplate.expire(journeyKey, Duration.ofHours(24));
        
        log.info("User action tracked: sessionId={}, action={}, userId={}", 
                context.getSessionId(), action, context.getUserId());
    }
    
    public List<UserAction> getUserJourney(String sessionId) {
        String journeyKey = "user:journey:" + sessionId;
        List<Object> actions = redisTemplate.opsForList().range(journeyKey, 0, -1);
        
        return actions.stream()
                .map(obj -> (UserAction) obj)
                .collect(Collectors.toList());
    }
    
    public void trackConversion(String conversionType, double value) {
        CorrelationContext context = contextService.getCurrentContext();
        
        ConversionEvent conversion = ConversionEvent.builder()
                .sessionId(context.getSessionId())
                .userId(context.getUserId())
                .correlationId(context.getCorrelationId())
                .conversionType(conversionType)
                .value(value)
                .timestamp(Instant.now())
                .build();
        
        // Conversion event'ini ayrı bir stream'e kaydet
        String conversionKey = "conversion:events:" + LocalDate.now().toString();
        redisTemplate.opsForList().rightPush(conversionKey, conversion);
        redisTemplate.expire(conversionKey, Duration.ofDays(90));
        
        log.info("Conversion tracked: userId={}, type={}, value={}", 
                context.getUserId(), conversionType, value);
    }
}

@Data
@Builder
public class UserAction {
    private String sessionId;
    private String userId;
    private String correlationId;
    private String action;
    private Map<String, Object> metadata;
    private Instant timestamp;
    private String endpoint;
    private String userAgent;
    private String ipAddress;
}

@Data
@Builder
public class ConversionEvent {
    private String sessionId;
    private String userId;
    private String correlationId;
    private String conversionType;
    private double value;
    private Instant timestamp;
}
```

### Error Correlation

```java
@Component
@Slf4j
public class ErrorCorrelationService {
    
    private final ContextPropagationService contextService;
    private final MeterRegistry meterRegistry;
    
    public ErrorCorrelationService(ContextPropagationService contextService,
                                  MeterRegistry meterRegistry) {
        this.contextService = contextService;
        this.meterRegistry = meterRegistry;
    }
    
    public void logError(Exception exception, String operation) {
        CorrelationContext context = contextService.getCurrentContext();
        
        ErrorEvent errorEvent = ErrorEvent.builder()
                .correlationId(context.getCorrelationId())
                .userId(context.getUserId())
                .sessionId(context.getSessionId())
                .operation(operation)
                .errorType(exception.getClass().getSimpleName())
                .errorMessage(exception.getMessage())
                .stackTrace(getStackTrace(exception))
                .timestamp(Instant.now())
                .endpoint(context.getEndpoint())
                .method(context.getMethod())
                .ipAddress(context.getIpAddress())
                .userAgent(context.getUserAgent())
                .build();
        
        // Structured error logging
        MDC.put("errorType", errorEvent.getErrorType());
        MDC.put("operation", operation);
        log.error("Operation failed: operation={}, error={}, correlationId={}", 
                operation, exception.getMessage(), context.getCorrelationId(), exception);
        
        // Error metrics
        meterRegistry.counter("errors.total",
                Tags.of(
                    Tag.of("error.type", errorEvent.getErrorType()),
                    Tag.of("operation", operation),
                    Tag.of("endpoint", context.getEndpoint())
                )).increment();
        
        // Kritik hatalar için alert
        if (isCriticalError(exception)) {
            sendCriticalErrorAlert(errorEvent);
        }
    }
    
    private String getStackTrace(Exception exception) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        exception.printStackTrace(pw);
        return sw.toString();
    }
    
    private boolean isCriticalError(Exception exception) {
        return exception instanceof OutOfMemoryError ||
               exception instanceof StackOverflowError ||
               exception instanceof SecurityException ||
               exception.getMessage().contains("database connection");
    }
    
    private void sendCriticalErrorAlert(ErrorEvent errorEvent) {
        // Alert mechanism implementation
        log.error("CRITICAL ERROR ALERT: {}", errorEvent);
    }
}

@Data
@Builder
public class ErrorEvent {
    private String correlationId;
    private String userId;
    private String sessionId;
    private String operation;
    private String errorType;
    private String errorMessage;
    private String stackTrace;
    private Instant timestamp;
    private String endpoint;
    private String method;
    private String ipAddress;
    private String userAgent;
}
```

## Production Considerations

### Sampling Strategy

```java
@Configuration
public class TracingSamplingConfiguration {
    
    @Bean
    public ProbabilityBasedSampler probabilitySampler() {
        // Production'da düşük sampling rate kullan
        return ProbabilityBasedSampler.create(0.1f); // %10
    }
    
    @Bean
    public RateLimitingSampler rateLimitingSampler() {
        // Saniyede maksimum 100 trace
        return RateLimitingSampler.create(100);
    }
    
    @Bean
    public CustomSampler customSampler() {
        return new CustomSampler();
    }
    
    public static class CustomSampler implements Sampler {
        
        @Override
        public SamplingResult shouldSample(Context parentContext, String traceId, 
                                         String name, SpanKind spanKind, 
                                         Attributes attributes, List<Link> parentLinks) {
            
            // Kritik endpoint'ler için %100 sampling
            String endpoint = attributes.get(AttributeKey.stringKey("http.target"));
            if (endpoint != null && (endpoint.contains("/payment") || endpoint.contains("/order"))) {
                return SamplingResult.create(SamplingDecision.RECORD_AND_SAMPLE);
            }
            
            // Health check endpoint'leri için sampling yapma
            if (endpoint != null && endpoint.contains("/actuator/health")) {
                return SamplingResult.create(SamplingDecision.NOT_RECORD);
            }
            
            // Diğer endpoint'ler için %5 sampling
            return Math.random() < 0.05 ? 
                    SamplingResult.create(SamplingDecision.RECORD_AND_SAMPLE) :
                    SamplingResult.create(SamplingDecision.NOT_RECORD);
        }
    }
}
```

### Performance Impact Monitoring

```java
@Component
@Slf4j
public class TracingPerformanceMonitor {
    
    private final MeterRegistry meterRegistry;
    private final Timer tracingOverheadTimer;
    
    public TracingPerformanceMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.tracingOverheadTimer = Timer.builder("tracing.overhead")
                .description("Time spent on tracing operations")
                .register(meterRegistry);
    }
    
    @EventListener
    public void handleSpanEnd(SpanEndEvent event) {
        // Span süresini ölç
        long spanDuration = event.getEndEpochNanos() - event.getStartEpochNanos();
        
        // Tracing overhead'i hesapla (yaklaşık)
        long estimatedOverhead = spanDuration / 100; // %1 overhead varsayımı
        
        tracingOverheadTimer.record(estimatedOverhead, TimeUnit.NANOSECONDS);
        
        // Uzun süren span'ler için uyarı
        if (TimeUnit.NANOSECONDS.toMillis(spanDuration) > 5000) {
            log.warn("Long-running span detected: name={}, duration={}ms", 
                    event.getSpanName(), TimeUnit.NANOSECONDS.toMillis(spanDuration));
        }
    }
    
    @Scheduled(fixedRate = 60000) // Her dakika
    public void reportTracingMetrics() {
        double averageOverhead = tracingOverheadTimer.mean(TimeUnit.MICROSECONDS);
        log.info("Tracing performance - Average overhead: {}μs", averageOverhead);
        
        // Memory usage for tracing
        long tracingMemoryUsage = getTracingMemoryUsage();
        meterRegistry.gauge("tracing.memory.usage", tracingMemoryUsage);
    }
    
    private long getTracingMemoryUsage() {
        // Tracing-related memory usage calculation
        return Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
    }
}
```

Bu Türkçe distributed tracing dokümantasyonu, correlation ID yönetimi, cross-service propagation ve production considerations'ı kapsamlı bir şekilde ele alır.
