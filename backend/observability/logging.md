# Logging (ELK Stack) - Günlük Kaydı ve Log Yönetimi

Gözlemlenebilirliğin temel bileşenlerinden biri olan logging, sistemin durumunu, hataları ve olayları izlememizi sağlar.

## Logging Framework - Spring Boot ile Yapılandırılmış Logging

### SLF4J + Logback Entegrasyonu

Spring Boot'un varsayılan logging stack'i olan SLF4J ve Logback kombinasyonu güçlü logging özellikleri sunar:

```xml
<!-- pom.xml - Logging bağımlılıkları -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <!-- spring-boot-starter-logging otomatik dahil edilir -->
    </dependency>
    <dependency>
        <groupId>net.logstash.logback</groupId>
        <artifactId>logstash-logback-encoder</artifactId>
        <version>7.4</version>
    </dependency>
</dependencies>
```

### Logback Yapılandırması

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>
    <!-- Console Appender -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
            <providers>
                <timestamp/>
                <logLevel/>
                <loggerName/>
                <mdc/>
                <message/>
                <stackTrace/>
            </providers>
        </encoder>
    </appender>

    <!-- Async File Appender -->
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/application.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/application.%d{yyyy-MM-dd}.%i.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>30</maxHistory>
            <totalSizeCap>10GB</totalSizeCap>
        </rollingPolicy>
        <encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
            <providers>
                <timestamp/>
                <logLevel/>
                <loggerName/>
                <mdc/>
                <message/>
                <stackTrace/>
            </providers>
        </encoder>
    </appender>

    <!-- Async Wrapper -->
    <appender name="ASYNC_FILE" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE"/>
        <queueSize>1024</queueSize>
        <discardingThreshold>0</discardingThreshold>
        <includeCallerData>true</includeCallerData>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="ASYNC_FILE"/>
    </root>
</configuration>
```

### Structured Logging Service

```java
@Service
@Slf4j
public class StructuredLoggingService {
    
    private final ObjectMapper objectMapper;
    
    public StructuredLoggingService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }
    
    public void logBusinessEvent(String event, Object data, String userId) {
        try {
            MDC.put("userId", userId);
            MDC.put("eventType", "BUSINESS");
            MDC.put("eventData", objectMapper.writeValueAsString(data));
            
            log.info("Business event occurred: {}", event);
        } catch (Exception e) {
            log.error("Failed to log business event", e);
        } finally {
            MDC.clear();
        }
    }
    
    public void logPerformance(String operation, long duration, String endpoint) {
        MDC.put("operation", operation);
        MDC.put("duration", String.valueOf(duration));
        MDC.put("endpoint", endpoint);
        MDC.put("eventType", "PERFORMANCE");
        
        if (duration > 1000) {
            log.warn("Slow operation detected: {} took {}ms", operation, duration);
        } else {
            log.info("Operation completed: {} in {}ms", operation, duration);
        }
        
        MDC.clear();
    }
    
    public void logSecurityEvent(String event, String userId, String ipAddress) {
        MDC.put("userId", userId);
        MDC.put("ipAddress", ipAddress);
        MDC.put("eventType", "SECURITY");
        
        log.warn("Security event: {}", event);
        MDC.clear();
    }
}
```

## ELK Stack Entegrasyonu

### Elasticsearch Configuration

```yaml
# docker-compose.yml - Elasticsearch cluster
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - node.name=elasticsearch
      - cluster.name=elk-cluster
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - elk

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: logstash
    volumes:
      - ./logstash/config:/usr/share/logstash/pipeline/
    ports:
      - "5044:5044"
    environment:
      LS_JAVA_OPTS: "-Xmx1g -Xms1g"
    networks:
      - elk
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    networks:
      - elk
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:

networks:
  elk:
    driver: bridge
```

### Logstash Pipeline Yapılandırması

```ruby
# logstash/config/logstash.conf
input {
  beats {
    port => 5044
  }
  
  file {
    path => "/var/log/app/*.log"
    start_position => "beginning"
    codec => "json"
  }
}

filter {
  # JSON parsing
  if [message] =~ /^\{.*\}$/ {
    json {
      source => "message"
    }
  }
  
  # Timestamp parsing
  if [timestamp] {
    date {
      match => [ "timestamp", "ISO8601" ]
      target => "@timestamp"
    }
  }
  
  # MDC field extraction
  if [mdc] {
    ruby {
      code => "
        mdc = event.get('mdc')
        if mdc.is_a?(Hash)
          mdc.each { |key, value| event.set(key, value) }
        end
      "
    }
  }
  
  # Error categorization
  if [level] == "ERROR" {
    mutate {
      add_field => { "alert_level" => "high" }
    }
  } else if [level] == "WARN" {
    mutate {
      add_field => { "alert_level" => "medium" }
    }
  }
  
  # Performance metrics
  if [duration] {
    mutate {
      convert => { "duration" => "integer" }
    }
    
    if [duration] > 1000 {
      mutate {
        add_field => { "performance_issue" => "true" }
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "application-logs-%{+YYYY.MM.dd}"
    template_name => "application-logs"
    template => "/usr/share/logstash/templates/application-template.json"
    template_overwrite => true
  }
  
  # Alert için webhook
  if [alert_level] == "high" {
    http {
      url => "http://alert-manager:9093/api/v1/alerts"
      http_method => "post"
      format => "json"
      mapping => {
        "alerts" => [{
          "labels" => {
            "alertname" => "ApplicationError"
            "severity" => "critical"
            "service" => "%{logger_name}"
          }
          "annotations" => {
            "summary" => "%{message}"
            "description" => "%{stackTrace}"
          }
        }]
      }
    }
  }
}
```

### Elasticsearch Index Template

```json
{
  "index_patterns": ["application-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "index.lifecycle.name": "application-logs-policy",
      "index.lifecycle.rollover_alias": "application-logs"
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "logger_name": {
          "type": "keyword"
        },
        "message": {
          "type": "text",
          "analyzer": "standard"
        },
        "userId": {
          "type": "keyword"
        },
        "eventType": {
          "type": "keyword"
        },
        "duration": {
          "type": "long"
        },
        "endpoint": {
          "type": "keyword"
        },
        "stackTrace": {
          "type": "text",
          "index": false
        }
      }
    }
  }
}
```

## Log Yönetimi Best Practices

### Log Level Stratejisi

```java
@RestController
@Slf4j
public class OrderController {
    
    private final OrderService orderService;
    
    @PostMapping("/orders")
    public ResponseEntity<Order> createOrder(@RequestBody CreateOrderRequest request) {
        String correlationId = UUID.randomUUID().toString();
        MDC.put("correlationId", correlationId);
        
        try {
            // TRACE: Detaylı debugging bilgisi
            log.trace("Processing order creation request: {}", request);
            
            // DEBUG: Geliştirme zamanı debugging
            log.debug("Validating order request for customer: {}", request.getCustomerId());
            
            Order order = orderService.createOrder(request);
            
            // INFO: İş süreçleri ve durum değişiklikleri
            log.info("Order created successfully: orderId={}, customerId={}, amount={}", 
                    order.getId(), order.getCustomerId(), order.getTotalAmount());
            
            return ResponseEntity.ok(order);
            
        } catch (ValidationException e) {
            // WARN: Potansiyel sorunlar
            log.warn("Order validation failed: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (PaymentException e) {
            // ERROR: Sistem hataları
            log.error("Payment processing failed for order: correlationId={}", correlationId, e);
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).build();
            
        } catch (Exception e) {
            // FATAL: Kritik sistem hataları
            log.error("Critical error during order processing: correlationId={}", correlationId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            
        } finally {
            MDC.clear();
        }
    }
}
```

### Structured Logging Patterns

```java
@Component
@Slf4j
public class AuditLogger {
    
    public void logUserAction(String userId, String action, Object details) {
        StructuredLogEvent event = StructuredLogEvent.builder()
                .eventType("USER_ACTION")
                .userId(userId)
                .action(action)
                .details(details)
                .timestamp(Instant.now())
                .build();
        
        log.info("User action: {}", event.toJson());
    }
    
    public void logSystemEvent(String component, String event, Map<String, Object> metadata) {
        StructuredLogEvent logEvent = StructuredLogEvent.builder()
                .eventType("SYSTEM_EVENT")
                .component(component)
                .event(event)
                .metadata(metadata)
                .timestamp(Instant.now())
                .build();
        
        log.info("System event: {}", logEvent.toJson());
    }
    
    @Data
    @Builder
    public static class StructuredLogEvent {
        private String eventType;
        private String userId;
        private String component;
        private String action;
        private String event;
        private Object details;
        private Map<String, Object> metadata;
        private Instant timestamp;
        
        public String toJson() {
            try {
                return new ObjectMapper().writeValueAsString(this);
            } catch (Exception e) {
                return toString();
            }
        }
    }
}
```

### Performance Monitoring

```java
@Aspect
@Component
@Slf4j
public class PerformanceLoggingAspect {
    
    private final MeterRegistry meterRegistry;
    
    @Around("@annotation(PerformanceLogged)")
    public Object logPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        
        Timer.Sample sample = Timer.start(meterRegistry);
        MDC.put("method", methodName);
        MDC.put("class", className);
        
        try {
            long startTime = System.currentTimeMillis();
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;
            
            // Performance log
            if (duration > 1000) {
                log.warn("Slow method execution: {}.{} took {}ms", className, methodName, duration);
            } else {
                log.debug("Method execution: {}.{} completed in {}ms", className, methodName, duration);
            }
            
            return result;
            
        } catch (Exception e) {
            log.error("Method execution failed: {}.{}", className, methodName, e);
            throw e;
            
        } finally {
            sample.stop(Timer.builder("method.execution.time")
                    .tag("class", className)
                    .tag("method", methodName)
                    .register(meterRegistry));
            MDC.clear();
        }
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface PerformanceLogged {
}
```

### Correlation ID Filter

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter implements Filter {
    
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    private static final String CORRELATION_ID_MDC_KEY = "correlationId";
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        String correlationId = httpRequest.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.trim().isEmpty()) {
            correlationId = UUID.randomUUID().toString();
        }
        
        try {
            MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
            httpResponse.setHeader(CORRELATION_ID_HEADER, correlationId);
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

Bu Türkçe logging dokümantasyonu, Spring Boot ile yapılandırılmış logging, ELK Stack entegrasyonu ve production-ready log yönetimi best practices'ini kapsamlı bir şekilde ele alır.
