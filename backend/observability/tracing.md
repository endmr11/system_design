# Dağıtık İzleme (Jaeger, Zipkin)

Dağıtık izleme, mikroservis mimarisinde isteklerin servisler arasında nasıl ilerlediğini takip etmek için kullanılır.

## Dağıtık İzleme Kavramları

### Temel Kavramlar

**Trace**: Bir isteğin başından sonuna kadar olan tüm yaşam döngüsü
**Span**: Trace içindeki bir operasyonun süresini ve detaylarını temsil eder
**Context Propagation**: Trace bilgilerinin servisler arasında aktarımı

```java
// Trace ve Span yapısı örneği
public class TraceExample {
    /*
    Trace: user-order-request-12345
    ├── Span: http-request (API Gateway) [100ms]
    │   ├── Span: user-authentication (Auth Service) [20ms]
    │   ├── Span: order-creation (Order Service) [60ms]
    │   │   ├── Span: inventory-check (Inventory Service) [15ms]
    │   │   ├── Span: payment-processing (Payment Service) [35ms]
    │   │   └── Span: database-insert (Order DB) [10ms]
    │   └── Span: notification-send (Notification Service) [20ms]
    */
}
```

### Spring Boot Tracing Entegrasyonu

```xml
<!-- pom.xml - Tracing bağımlılıkları -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
    <dependency>
        <groupId>io.zipkin.reporter2</groupId>
        <artifactId>zipkin-reporter-brave</artifactId>
    </dependency>
    <dependency>
        <groupId>io.zipkin.reporter2</groupId>
        <artifactId>zipkin-sender-okhttp3</artifactId>
    </dependency>
</dependencies>
```

### Tracing Configuration

```yaml
# application.yml - Tracing yapılandırması
management:
  tracing:
    sampling:
      probability: 1.0  # Production'da 0.1 (10%) kullanın
  zipkin:
    tracing:
      endpoint: http://localhost:9411/api/v2/spans
      timeout: 10s
      read-timeout: 10s
      connect-timeout: 10s

spring:
  application:
    name: order-service
  sleuth:
    sampler:
      probability: 1.0
    zipkin:
      base-url: http://localhost:9411
    web:
      skip-pattern: /actuator.*
```

## Span Management

### Custom Span Creation

```java
@Service
@Slf4j
public class OrderService {
    
    private final Tracer tracer;
    private final PaymentService paymentService;
    private final InventoryService inventoryService;
    
    public OrderService(Tracer tracer, PaymentService paymentService, 
                       InventoryService inventoryService) {
        this.tracer = tracer;
        this.paymentService = paymentService;
        this.inventoryService = inventoryService;
    }
    
    public Order createOrder(CreateOrderRequest request) {
        // Ana operasyon için span oluştur
        Span orderSpan = tracer.nextSpan()
                .name("order.create")
                .tag("order.customer_id", request.getCustomerId())
                .tag("order.total_amount", String.valueOf(request.getTotalAmount()))
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(orderSpan)) {
            log.info("Starting order creation for customer: {}", request.getCustomerId());
            
            // Inventory kontrolü
            boolean inventoryAvailable = checkInventory(request);
            orderSpan.tag("inventory.available", String.valueOf(inventoryAvailable));
            
            if (!inventoryAvailable) {
                orderSpan.tag("order.status", "failed")
                        .tag("failure.reason", "insufficient_inventory");
                throw new InsufficientInventoryException("Insufficient inventory");
            }
            
            // Payment işlemi
            PaymentResult paymentResult = processPayment(request);
            orderSpan.tag("payment.status", paymentResult.getStatus());
            
            // Order oluşturma
            Order order = createOrderEntity(request, paymentResult);
            orderSpan.tag("order.id", order.getId())
                    .tag("order.status", "completed");
            
            log.info("Order created successfully: {}", order.getId());
            return order;
            
        } catch (Exception e) {
            orderSpan.tag("error", true)
                    .tag("error.message", e.getMessage())
                    .tag("order.status", "failed");
            log.error("Order creation failed", e);
            throw e;
        } finally {
            orderSpan.end();
        }
    }
    
    private boolean checkInventory(CreateOrderRequest request) {
        Span inventorySpan = tracer.nextSpan()
                .name("inventory.check")
                .tag("inventory.product_count", String.valueOf(request.getItems().size()))
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(inventorySpan)) {
            // Simulated inventory check
            Thread.sleep(50); // Simulate network call
            boolean available = inventoryService.checkAvailability(request.getItems());
            inventorySpan.tag("inventory.result", String.valueOf(available));
            return available;
        } catch (Exception e) {
            inventorySpan.tag("error", true).tag("error.message", e.getMessage());
            throw new RuntimeException("Inventory check failed", e);
        } finally {
            inventorySpan.end();
        }
    }
    
    private PaymentResult processPayment(CreateOrderRequest request) {
        Span paymentSpan = tracer.nextSpan()
                .name("payment.process")
                .tag("payment.amount", String.valueOf(request.getTotalAmount()))
                .tag("payment.method", request.getPaymentMethod())
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(paymentSpan)) {
            PaymentResult result = paymentService.processPayment(request);
            paymentSpan.tag("payment.transaction_id", result.getTransactionId())
                      .tag("payment.status", result.getStatus());
            return result;
        } catch (Exception e) {
            paymentSpan.tag("error", true).tag("error.message", e.getMessage());
            throw e;
        } finally {
            paymentSpan.end();
        }
    }
}
```

### Tracing Aspect

```java
@Aspect
@Component
@Slf4j
public class TracingAspect {
    
    private final Tracer tracer;
    
    public TracingAspect(Tracer tracer) {
        this.tracer = tracer;
    }
    
    @Around("@annotation(TraceMethod)")
    public Object traceMethod(ProceedingJoinPoint joinPoint, TraceMethod traceMethod) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String spanName = traceMethod.name().isEmpty() ? 
                className.toLowerCase() + "." + methodName : traceMethod.name();
        
        Span span = tracer.nextSpan()
                .name(spanName)
                .tag("class", className)
                .tag("method", methodName)
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            // Method parametrelerini tag olarak ekle
            Object[] args = joinPoint.getArgs();
            if (args.length > 0 && traceMethod.includeArgs()) {
                for (int i = 0; i < args.length; i++) {
                    if (args[i] != null) {
                        span.tag("arg." + i, args[i].toString());
                    }
                }
            }
            
            Object result = joinPoint.proceed();
            span.tag("result.type", result != null ? result.getClass().getSimpleName() : "null");
            return result;
            
        } catch (Exception e) {
            span.tag("error", true)
                .tag("error.class", e.getClass().getSimpleName())
                .tag("error.message", e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface TraceMethod {
    String name() default "";
    boolean includeArgs() default false;
}
```

## Jaeger Entegrasyonu

### Jaeger Deployment

```yaml
# docker-compose.yml - Jaeger all-in-one
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - "16686:16686"  # Jaeger UI
      - "14250:14250"  # gRPC
      - "14268:14268"  # HTTP
      - "9411:9411"    # Zipkin compatible endpoint
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - tracing

  # Production Jaeger deployment
  jaeger-collector:
    image: jaegertracing/jaeger-collector:latest
    container_name: jaeger-collector
    ports:
      - "14269:14269"  # Admin port
      - "14268:14268"  # HTTP
      - "14250:14250"  # gRPC
      - "9411:9411"    # Zipkin
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
      - ES_NUM_SHARDS=1
      - ES_NUM_REPLICAS=0
    depends_on:
      - elasticsearch
    networks:
      - tracing

  jaeger-query:
    image: jaegertracing/jaeger-query:latest
    container_name: jaeger-query
    ports:
      - "16686:16686"
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    networks:
      - tracing

networks:
  tracing:
    driver: bridge
```

### Jaeger Client Configuration

```java
@Configuration
@ConditionalOnProperty(name = "management.tracing.enabled", havingValue = "true", matchIfMissing = true)
public class JaegerConfiguration {
    
    @Bean
    @ConditionalOnMissingBean
    public io.opentracing.Tracer jaegerTracer(@Value("${spring.application.name}") String serviceName) {
        return io.jaegertracing.Configuration.fromEnv(serviceName)
                .withSampler(io.jaegertracing.Configuration.SamplerConfiguration.fromEnv()
                        .withType(ConstSampler.TYPE)
                        .withParam(1))
                .withReporter(io.jaegertracing.Configuration.ReporterConfiguration.fromEnv()
                        .withLogSpans(true)
                        .withFlushInterval(1000)
                        .withMaxQueueSize(10000))
                .getTracer();
    }
    
    @Bean
    public TracingConfiguration tracingConfiguration() {
        return TracingConfiguration.builder()
                .sampler(Sampler.create(1.0f))  // 100% sampling for development
                .spanProcessor(BatchSpanProcessor.builder(
                        JaegerGrpcSpanExporter.builder()
                                .setEndpoint("http://localhost:14250")
                                .build())
                        .setMaxExportBatchSize(512)
                        .setExportTimeout(Duration.ofSeconds(2))
                        .setScheduleDelay(Duration.ofSeconds(5))
                        .build())
                .build();
    }
}
```

## Zipkin Entegrasyonu

### Zipkin Deployment

```yaml
# docker-compose.yml - Zipkin
version: '3.8'
services:
  zipkin:
    image: openzipkin/zipkin:latest
    container_name: zipkin
    ports:
      - "9411:9411"
    environment:
      - STORAGE_TYPE=elasticsearch
      - ES_HOSTS=http://elasticsearch:9200
      - ES_INDEX=zipkin
      - ES_DATE_SEPARATOR=-
      - ES_INDEX_SHARDS=1
      - ES_INDEX_REPLICAS=0
    depends_on:
      - elasticsearch
    networks:
      - tracing

  zipkin-dependencies:
    image: openzipkin/zipkin-dependencies:latest
    container_name: zipkin-dependencies
    environment:
      - STORAGE_TYPE=elasticsearch
      - ES_HOSTS=elasticsearch:9200
      - ES_INDEX=zipkin
    depends_on:
      - elasticsearch
    networks:
      - tracing
```

### Zipkin Configuration

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
    public Tracing tracing(@Value("${spring.application.name}") String serviceName) {
        return Tracing.newBuilder()
                .localServiceName(serviceName)
                .spanReporter(spanReporter())
                .sampler(Sampler.create(1.0f))
                .build();
    }
    
    @Bean
    public brave.Tracer braveTracer(Tracing tracing) {
        return tracing.tracer();
    }
}
```

## Advanced Tracing Patterns

### Database Tracing

```java
@Component
public class TracedDataSource {
    
    @Bean
    @Primary
    public DataSource dataSource(@Autowired DataSource actualDataSource, 
                                 @Autowired Tracer tracer) {
        return new TracingDataSourceWrapper(actualDataSource, tracer);
    }
}

public class TracingDataSourceWrapper implements DataSource {
    
    private final DataSource delegate;
    private final Tracer tracer;
    
    public TracingDataSourceWrapper(DataSource delegate, Tracer tracer) {
        this.delegate = delegate;
        this.tracer = tracer;
    }
    
    @Override
    public Connection getConnection() throws SQLException {
        Span span = tracer.nextSpan()
                .name("db.connection.get")
                .tag("db.type", "postgresql")
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            Connection connection = delegate.getConnection();
            return new TracingConnectionWrapper(connection, tracer);
        } catch (SQLException e) {
            span.tag("error", true).tag("error.message", e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}

public class TracingConnectionWrapper implements Connection {
    
    private final Connection delegate;
    private final Tracer tracer;
    
    @Override
    public PreparedStatement prepareStatement(String sql) throws SQLException {
        Span span = tracer.nextSpan()
                .name("db.query.prepare")
                .tag("db.statement", sql)
                .tag("db.type", "postgresql")
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            PreparedStatement statement = delegate.prepareStatement(sql);
            return new TracingPreparedStatementWrapper(statement, tracer, sql);
        } catch (SQLException e) {
            span.tag("error", true).tag("error.message", e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

### HTTP Client Tracing

```java
@Configuration
public class TracingRestTemplateConfiguration {
    
    @Bean
    public RestTemplate restTemplate(Tracer tracer) {
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.setInterceptors(List.of(new TracingClientHttpRequestInterceptor(tracer)));
        return restTemplate;
    }
}

@Component
public class TracingClientHttpRequestInterceptor implements ClientHttpRequestInterceptor {
    
    private final Tracer tracer;
    
    public TracingClientHttpRequestInterceptor(Tracer tracer) {
        this.tracer = tracer;
    }
    
    @Override
    public ClientHttpResponse intercept(
            HttpRequest request, 
            byte[] body,
            ClientHttpRequestExecution execution) throws IOException {
        
        Span span = tracer.nextSpan()
                .name("http.client.request")
                .tag("http.method", request.getMethod().name())
                .tag("http.url", request.getURI().toString())
                .start();
        
        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            // Trace context'i header'lara ekle
            TraceContext.Injector<HttpHeaders> injector = 
                    tracing.propagation().injector(HttpHeaders::set);
            injector.inject(span.context(), request.getHeaders());
            
            ClientHttpResponse response = execution.execute(request, body);
            span.tag("http.status_code", String.valueOf(response.getStatusCode().value()));
            
            if (response.getStatusCode().is4xxClientError() || 
                response.getStatusCode().is5xxServerError()) {
                span.tag("error", true);
            }
            
            return response;
            
        } catch (IOException e) {
            span.tag("error", true).tag("error.message", e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
```

### Kafka Tracing

```java
@Configuration
public class TracingKafkaConfiguration {
    
    @Bean
    public ProducerFactory<String, Object> producerFactory(Tracer tracer) {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        
        DefaultKafkaProducerFactory<String, Object> factory = 
                new DefaultKafkaProducerFactory<>(configProps);
        
        // Tracing interceptor ekle
        factory.addPostProcessor(producer -> new TracingProducer<>(producer, tracer));
        return factory;
    }
    
    @Bean
    public ConsumerFactory<String, Object> consumerFactory(Tracer tracer) {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        configProps.put(ConsumerConfig.GROUP_ID_CONFIG, "order-service");
        configProps.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        configProps.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        
        DefaultKafkaConsumerFactory<String, Object> factory = 
                new DefaultKafkaConsumerFactory<>(configProps);
        
        // Tracing interceptor ekle
        factory.addPostProcessor(consumer -> new TracingConsumer<>(consumer, tracer));
        return factory;
    }
}
```

Bu Türkçe tracing dokümantasyonu, Jaeger ve Zipkin entegrasyonu, custom span yönetimi ve advanced tracing patterns'ini kapsamlı bir şekilde ele alır.
