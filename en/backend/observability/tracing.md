# Tracing (Jaeger, Zipkin)

## Introduction

Distributed tracing is a method for monitoring and profiling complex distributed systems, especially microservices-based applications. This approach allows tracking requests as they flow through multiple services, providing insights into performance bottlenecks, latency issues, and system dependencies.

## Basic Concepts

### 1. Core Tracing Concepts

```java
// Spring Boot application.yml
spring:
  application:
    name: user-service
  sleuth:
    enabled: true
    zipkin:
      base-url: http://localhost:9411
    sampler:
      probability: 1.0  # 100% sampling for development
    web:
      skip-pattern: /actuator/.*
```

### 2. Key Terms
- **Trace**: Complete journey of a request through the system
- **Span**: A single operation within a trace
- **Context Propagation**: Passing trace information between services
- **Sampling**: Deciding which traces to collect (for performance)

## Spring Boot Tracing Integration

### 1. Dependencies

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- Spring Cloud Sleuth for tracing -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-sleuth</artifactId>
    </dependency>
    
    <!-- Zipkin integration -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-sleuth-zipkin</artifactId>
    </dependency>
    
    <!-- Jaeger integration (alternative to Zipkin) -->
    <dependency>
        <groupId>io.opentracing.contrib</groupId>
        <artifactId>opentracing-spring-jaeger-starter</artifactId>
        <version>3.3.1</version>
    </dependency>
    
    <!-- Micrometer Tracing (Spring Boot 3.x) -->
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
    
    <dependency>
        <groupId>io.zipkin.reporter2</groupId>
        <artifactId>zipkin-reporter-brave</artifactId>
    </dependency>
</dependencies>
```

### 2. Tracing Configuration

```java
@Configuration
@EnableConfigurationProperties
public class TracingConfiguration {

    @Bean
    public Sender sender() {
        return OkHttpSender.create("http://localhost:9411/api/v2/spans");
    }

    @Bean
    public AsyncReporter<Span> spanReporter() {
        return AsyncReporter.create(sender());
    }

    @Bean
    public Tracing tracing() {
        return Tracing.newBuilder()
                .localServiceName("user-service")
                .spanReporter(spanReporter())
                .sampler(Sampler.create(1.0f)) // 100% sampling
                .build();
    }

    @Bean
    public Tracer tracer() {
        return tracing().tracer();
    }
}
```

### 3. Custom Span Creation

```java
@Service
@Slf4j
public class UserTraceService {

    private final Tracer tracer;
    private final UserRepository userRepository;

    public UserTraceService(Tracer tracer, UserRepository userRepository) {
        this.tracer = tracer;
        this.userRepository = userRepository;
    }

    public User getUserWithTracing(Long userId) {
        Span span = tracer.nextSpan()
                .name("get-user-operation")
                .tag("user.id", String.valueOf(userId))
                .tag("service.name", "user-service")
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            log.info("Fetching user with ID: {}", userId);
            
            // Database operation with tracing
            User user = fetchUserFromDatabase(userId);
            
            // Add tags based on result
            span.tag("user.found", user != null ? "true" : "false");
            if (user != null) {
                span.tag("user.email", user.getEmail());
                span.tag("user.status", user.getStatus().toString());
            }
            
            return user;
            
        } catch (Exception ex) {
            span.tag("error", ex.getMessage());
            span.tag("error.class", ex.getClass().getSimpleName());
            throw ex;
        } finally {
            span.end();
        }
    }

    private User fetchUserFromDatabase(Long userId) {
        Span dbSpan = tracer.nextSpan()
                .name("db-query-user")
                .tag("db.operation", "select")
                .tag("db.table", "users")
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(dbSpan)) {
            return userRepository.findById(userId).orElse(null);
        } finally {
            dbSpan.end();
        }
    }
}
```

### 4. HTTP Client Tracing

```java
@Component
public class TracedHttpClient {

    private final RestTemplate restTemplate;
    private final Tracer tracer;

    public TracedHttpClient(RestTemplate restTemplate, Tracer tracer) {
        this.restTemplate = restTemplate;
        this.tracer = tracer;
    }

    public <T> ResponseEntity<T> exchange(String url, HttpMethod method, 
                                         HttpEntity<?> requestEntity, 
                                         Class<T> responseType) {
        
        Span span = tracer.nextSpan()
                .name("http-client-request")
                .tag("http.method", method.toString())
                .tag("http.url", url)
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            ResponseEntity<T> response = restTemplate.exchange(
                url, method, requestEntity, responseType);
            
            span.tag("http.status_code", String.valueOf(response.getStatusCodeValue()));
            
            return response;
            
        } catch (Exception ex) {
            span.tag("error", ex.getMessage());
            span.tag("http.status_code", "error");
            throw ex;
        } finally {
            span.end();
        }
    }
}
```

## Jaeger Integration

### 1. Jaeger Configuration

```yaml
# application-jaeger.yml
opentracing:
  jaeger:
    service-name: user-service
    udp-sender:
      host: localhost
      port: 6831
    sampler:
      type: const
      param: 1
    reporter:
      log-spans: true
      max-queue-size: 1000
      flush-interval: 1000
```

### 2. Jaeger Setup with Docker

```yaml
# docker-compose-jaeger.yml
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:1.50
    container_name: jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "5775:5775/udp"   # accept zipkin.thrift over compact thrift protocol
      - "6831:6831/udp"   # accept jaeger.thrift over compact thrift protocol
      - "6832:6832/udp"   # accept jaeger.thrift over binary thrift protocol
      - "5778:5778"       # serve configs
      - "16686:16686"     # serve frontend
      - "14250:14250"     # accept model.proto
      - "14268:14268"     # accept jaeger.thrift directly from clients
      - "14269:14269"     # admin port: health check at / and metrics at /metrics
      - "9411:9411"       # Zipkin compatible endpoint
    restart: unless-stopped

  # Application with Jaeger
  user-service:
    build: .
    environment:
      - SPRING_PROFILES_ACTIVE=jaeger
      - JAEGER_AGENT_HOST=jaeger
    depends_on:
      - jaeger
    ports:
      - "8080:8080"
```

### 3. Production Jaeger Setup

```yaml
# jaeger-production.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  jaeger-collector:
    image: jaegertracing/jaeger-collector:1.50
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
      - ES_NUM_SHARDS=1
      - ES_NUM_REPLICAS=0
    ports:
      - "14269:14269"
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    depends_on:
      - elasticsearch

  jaeger-agent:
    image: jaegertracing/jaeger-agent:1.50
    command: ["--reporter.grpc.host-port=jaeger-collector:14250"]
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
    depends_on:
      - jaeger-collector

  jaeger-query:
    image: jaegertracing/jaeger-query:1.50
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
    ports:
      - "16686:16686"
    depends_on:
      - elasticsearch

volumes:
  es_data:
```

## Zipkin Integration

### 1. Zipkin Configuration

```java
@Configuration
public class ZipkinConfiguration {

    @Bean
    public Sender sender() {
        return OkHttpSender.create("http://localhost:9411/api/v2/spans");
    }

    @Bean
    public AsyncReporter<Span> spanReporter() {
        return AsyncReporter.create(sender());
    }

    @Bean
    public Tracing tracing() {
        return Tracing.newBuilder()
                .localServiceName("user-service")
                .spanReporter(spanReporter())
                .sampler(Sampler.create(0.1f)) // 10% sampling for production
                .build();
    }
}
```

### 2. Zipkin Docker Setup

```yaml
# docker-compose-zipkin.yml
version: '3.8'
services:
  zipkin:
    image: openzipkin/zipkin:2.24
    container_name: zipkin
    environment:
      - STORAGE_TYPE=elasticsearch
      - ES_HOSTS=elasticsearch:9200
    ports:
      - "9411:9411"
    depends_on:
      - elasticsearch

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

volumes:
  es_data:
```

## Advanced Tracing Patterns

### 1. Database Tracing

```java
@Aspect
@Component
@Slf4j
public class DatabaseTracingAspect {

    private final Tracer tracer;

    public DatabaseTracingAspect(Tracer tracer) {
        this.tracer = tracer;
    }

    @Around("@annotation(org.springframework.transaction.annotation.Transactional)")
    public Object traceTransaction(ProceedingJoinPoint joinPoint) throws Throwable {
        Span span = tracer.nextSpan()
                .name("database-transaction")
                .tag("db.operation", "transaction")
                .tag("method.class", joinPoint.getTarget().getClass().getSimpleName())
                .tag("method.name", joinPoint.getSignature().getName())
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            Object result = joinPoint.proceed();
            span.tag("transaction.status", "committed");
            return result;
        } catch (Exception ex) {
            span.tag("transaction.status", "rolled-back");
            span.tag("error", ex.getMessage());
            throw ex;
        } finally {
            span.end();
        }
    }

    @Around("execution(* *..repository.*.*(..))")
    public Object traceRepositoryMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        Span span = tracer.nextSpan()
                .name("repository-operation")
                .tag("repository.class", joinPoint.getTarget().getClass().getSimpleName())
                .tag("repository.method", joinPoint.getSignature().getName())
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            return joinPoint.proceed();
        } catch (Exception ex) {
            span.tag("error", ex.getMessage());
            throw ex;
        } finally {
            span.end();
        }
    }
}
```

### 2. Kafka Message Tracing

```java
@Component
@Slf4j
public class TracedKafkaProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final Tracer tracer;

    public TracedKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate, 
                              Tracer tracer) {
        this.kafkaTemplate = kafkaTemplate;
        this.tracer = tracer;
    }

    public void sendMessage(String topic, String key, Object message) {
        Span span = tracer.nextSpan()
                .name("kafka-producer")
                .tag("messaging.destination", topic)
                .tag("messaging.operation", "send")
                .tag("messaging.message_id", key)
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            // Inject trace context into message headers
            ProducerRecord<String, Object> record = new ProducerRecord<>(topic, key, message);
            
            // Add tracing headers
            TraceContext traceContext = span.context();
            record.headers().add("X-Trace-Id", traceContext.traceId().getBytes());
            record.headers().add("X-Span-Id", traceContext.spanId().getBytes());
            
            kafkaTemplate.send(record).addCallback(
                result -> span.tag("kafka.send.status", "success"),
                failure -> {
                    span.tag("kafka.send.status", "failure");
                    span.tag("error", failure.getMessage());
                }
            );
            
        } finally {
            span.end();
        }
    }
}

@KafkaListener(topics = "user-events")
public void handleUserEvent(ConsumerRecord<String, Object> record) {
    // Extract trace context from headers
    TraceContext.Builder contextBuilder = TraceContext.newBuilder();
    
    Header traceIdHeader = record.headers().lastHeader("X-Trace-Id");
    Header spanIdHeader = record.headers().lastHeader("X-Span-Id");
    
    if (traceIdHeader != null && spanIdHeader != null) {
        // Continue existing trace
        contextBuilder.traceId(Long.parseLong(new String(traceIdHeader.value())));
        contextBuilder.spanId(Long.parseLong(new String(spanIdHeader.value())));
    }
    
    Span span = tracer.nextSpan(contextBuilder.build())
            .name("kafka-consumer")
            .tag("messaging.destination", record.topic())
            .tag("messaging.operation", "receive")
            .start();

    try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
        // Process message
        log.info("Processing user event: {}", record.value());
    } finally {
        span.end();
    }
}
```

### 3. Async Processing Tracing

```java
@Service
@Slf4j
public class AsyncTracingService {

    private final Tracer tracer;

    @Async
    public CompletableFuture<String> processAsyncWithTracing(String data) {
        // Create a new span for async operation
        Span span = tracer.nextSpan()
                .name("async-processing")
                .tag("async.operation", "data-processing")
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            // Simulate processing
            Thread.sleep(2000);
            
            String result = "Processed: " + data;
            span.tag("processing.result", "success");
            
            return CompletableFuture.completedFuture(result);
            
        } catch (Exception ex) {
            span.tag("error", ex.getMessage());
            throw new RuntimeException(ex);
        } finally {
            span.end();
        }
    }

    @EventListener
    public void handleApplicationEvent(ApplicationEvent event) {
        Span span = tracer.nextSpan()
                .name("event-handling")
                .tag("event.type", event.getClass().getSimpleName())
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            log.info("Handling event: {}", event);
            // Process event
        } finally {
            span.end();
        }
    }
}
```

## Performance Considerations

### 1. Sampling Strategies

```java
@Configuration
public class TracingSamplingConfiguration {

    @Bean
    @Profile("development")
    public Sampler developmentSampler() {
        return Sampler.create(1.0f); // 100% sampling
    }

    @Bean
    @Profile("staging")
    public Sampler stagingSampler() {
        return Sampler.create(0.5f); // 50% sampling
    }

    @Bean
    @Profile("production")
    public Sampler productionSampler() {
        // Rate-limited sampling: max 100 traces per second
        return RateLimitingSampler.create(100);
    }

    @Bean
    @Profile("production")
    public Sampler customSampler() {
        return new CustomSampler();
    }

    private static class CustomSampler extends Sampler {
        @Override
        public Decision sample(TraceContext traceContext) {
            // Custom sampling logic
            String operationName = traceContext.localRootSpan().name();
            
            // Always sample error scenarios
            if (operationName.contains("error") || operationName.contains("exception")) {
                return Decision.SAMPLE;
            }
            
            // High sampling for critical operations
            if (operationName.contains("payment") || operationName.contains("order")) {
                return Math.random() < 0.8 ? Decision.SAMPLE : Decision.NOT_SAMPLE;
            }
            
            // Low sampling for health checks
            if (operationName.contains("health") || operationName.contains("actuator")) {
                return Math.random() < 0.01 ? Decision.SAMPLE : Decision.NOT_SAMPLE;
            }
            
            // Default sampling rate
            return Math.random() < 0.1 ? Decision.SAMPLE : Decision.NOT_SAMPLE;
        }
    }
}
```

### 2. Performance Monitoring

```java
@Component
@Slf4j
public class TracingPerformanceMonitor {

    private final MeterRegistry meterRegistry;
    private final Counter tracingOverheadCounter;
    private final Timer spanCreationTimer;

    public TracingPerformanceMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.tracingOverheadCounter = Counter.builder("tracing.overhead")
                .description("Number of tracing overhead incidents")
                .register(meterRegistry);
        this.spanCreationTimer = Timer.builder("tracing.span.creation")
                .description("Time taken to create spans")
                .register(meterRegistry);
    }

    @EventListener
    public void onSpanStart(SpanStartEvent event) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(spanCreationTimer);
    }

    @EventListener
    public void onSpanFinish(SpanFinishEvent event) {
        Span span = event.getSpan();
        long duration = span.getDurationMicros();
        
        // Monitor for performance impact
        if (duration > 1000) { // More than 1ms overhead
            tracingOverheadCounter.increment();
            log.warn("High tracing overhead detected: {}μs for span: {}", 
                    duration, span.getOperationName());
        }
    }
}
```

## Best Practices

### 1. Span Naming Conventions
```java
// ✅ Good span names
"http-get-/users/{id}"
"db-query-users"
"kafka-send-user-events"
"cache-get-user-profile"

// ❌ Bad span names
"getUserById"
"database operation"
"message"
```

### 2. Tagging Strategy
```java
public void createSpanWithProperTags() {
    Span span = tracer.nextSpan()
            .name("user-operation")
            // Standard tags
            .tag("service.name", "user-service")
            .tag("service.version", "1.2.3")
            
            // Operation tags
            .tag("operation.type", "read")
            .tag("operation.entity", "user")
            
            // Business tags
            .tag("user.id", "123")
            .tag("user.segment", "premium")
            
            // Technical tags
            .tag("db.connection.pool", "primary")
            .tag("cache.hit", "true")
            
            .start();
}
```

### 3. Error Handling
```java
@Component
public class TracingErrorHandler {

    public void handleWithProperErrorTracing() {
        Span span = tracer.nextSpan().name("risky-operation").start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            // Risky operation
            performRiskyOperation();
            
        } catch (BusinessException ex) {
            // Business errors
            span.tag("error.type", "business");
            span.tag("error.code", ex.getErrorCode());
            span.tag("error.message", ex.getMessage());
            span.tag("error.recoverable", "true");
            
        } catch (SystemException ex) {
            // System errors
            span.tag("error.type", "system");
            span.tag("error.severity", "high");
            span.tag("error.message", ex.getMessage());
            span.tag("error.recoverable", "false");
            
        } finally {
            span.end();
        }
    }
}
```

This comprehensive tracing implementation provides robust distributed tracing capabilities for Spring Boot microservices, enabling detailed monitoring and debugging of complex distributed systems.
