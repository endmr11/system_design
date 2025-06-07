# İstek/Yanıt Döngüsü (Request–Response Model)

## Spring Boot'ta Request-Response Lifecycle

### DispatcherServlet
Spring MVC'nin kalbi, gelen HTTP isteklerini ilgili controller'lara yönlendirir.

```mermaid
sequenceDiagram
    participant Client
    participant DispatcherServlet
    participant HandlerMapping
    participant Controller
    participant Service
    participant Repository
    
    Client->>DispatcherServlet: HTTP Request
    DispatcherServlet->>HandlerMapping: Find Handler
    HandlerMapping-->>DispatcherServlet: Handler Found
    DispatcherServlet->>Controller: Process Request
    Controller->>Service: Business Logic
    Service->>Repository: Data Access
    Repository-->>Service: Data
    Service-->>Controller: Processed Data
    Controller-->>DispatcherServlet: Response
    DispatcherServlet-->>Client: HTTP Response
```

### Handler Mapping
URL pattern'lerini (`@RequestMapping`, `@GetMapping`) controller method'larına map eder.

### Controller Layer
- `@RestController` ile RESTful endpoint'ler
- `@RequestBody`/`@ResponseBody` ile JSON serialization/deserialization

### Service Layer
- `@Service` annotation ile business logic
- `@Transactional` ile transaction yönetimi

### Repository Layer
- Spring Data JPA ile ORM mapping
- `@Repository` ile veri erişim katmanı

## Mikroservislerde Inter-Service Communication

### Synchronous Communication
- **OpenFeign client** ile service-to-service HTTP calls
- **Load balancing** için Ribbon/Spring Cloud LoadBalancer

```mermaid
sequenceDiagram
    participant Client
    participant API Gateway
    participant Load Balancer
    participant Service A
    participant Service B
    
    Client->>API Gateway: Request
    API Gateway->>Load Balancer: Route Request
    Load Balancer->>Service A: Forward Request
    Service A->>Service B: Feign Client Call
    Service B-->>Service A: Response
    Service A-->>Load Balancer: Response
    Load Balancer-->>API Gateway: Response
    API Gateway-->>Client: Final Response
```

### Asynchronous Communication
- **Spring Cloud Stream** ile message-driven architecture
- **RabbitMQ/Apache Kafka** entegrasyonu

```mermaid
sequenceDiagram
    participant Producer
    participant Message Broker
    participant Consumer 1
    participant Consumer 2
    
    Producer->>Message Broker: Publish Event
    Message Broker->>Consumer 1: Deliver Event
    Message Broker->>Consumer 2: Deliver Event
    Consumer 1-->>Message Broker: Acknowledge
    Consumer 2-->>Message Broker: Acknowledge
```

### Event-Driven Architecture
- **Domain events** ile loose coupling
- **Eventual consistency** için event sourcing pattern

### Timeout & Retry
- `@Retryable` annotation ile automatic retry
- **Circuit breaker pattern** ile fault tolerance

## Performance Considerations

### Connection Pooling
- **HikariCP** ile database connection pooling
- **Apache HttpClient** ile HTTP connection pooling

### Caching
- **Spring Cache abstraction** (`@Cacheable`) ile Redis/Hazelcast entegrasyonu

### Async Processing
- `@Async` annotation ile non-blocking operations
- **CompletableFuture** ile async programming

## API Gateway Pattern

### Spring Cloud Gateway
- Route definitions
- Predicates
- Filters

```mermaid
graph TD
    Client[Client] -->|Request| Gateway[API Gateway]
    Gateway -->|Route| Auth[Authentication]
    Gateway -->|Route| RateLimit[Rate Limiting]
    Gateway -->|Route| CircuitBreaker[Circuit Breaker]
    Gateway -->|Route| Transform[Request/Response Transform]
    
    Auth -->|Valid| Service1[Service 1]
    RateLimit -->|Allowed| Service2[Service 2]
    CircuitBreaker -->|Open| Service3[Service 3]
    Transform -->|Modified| Service4[Service 4]
    
    Service1 -->|Response| Gateway
    Service2 -->|Response| Gateway
    Service3 -->|Response| Gateway
    Service4 -->|Response| Gateway
    
    Gateway -->|Final Response| Client
```

### Rate Limiting
- Redis-based rate limiting
- Token bucket algorithm

### Circuit Breaking
- Resilience4j integration
- Fallback mechanisms

### Request/Response Transformation
- Header manipulation
- Body transformation

### Security
- JWT validation
- OAuth2 integration
- API key management

## Load Balancing Strategies

### Client-side Load Balancing
- Spring Cloud LoadBalancer
- Ribbon

```mermaid
graph TD
    Client[Client] -->|Request| LoadBalancer[Load Balancer]
    LoadBalancer -->|Route 1| Service1[Service Instance 1]
    LoadBalancer -->|Route 2| Service2[Service Instance 2]
    LoadBalancer -->|Route 3| Service3[Service Instance 3]
    
    Service1 -->|Response| LoadBalancer
    Service2 -->|Response| LoadBalancer
    Service3 -->|Response| LoadBalancer
    
    LoadBalancer -->|Final Response| Client
    
    subgraph Load Balancing Algorithms
        RoundRobin[Round Robin]
        Weighted[Weighted Round Robin]
        LeastConn[Least Connections]
    end
```

### Server-side Load Balancing
- Nginx
- HAProxy
- AWS ALB

### Health Checks
- Spring Boot Actuator
- Custom health indicators

### Service Discovery Integration
- Eureka
- Consul
- Kubernetes service discovery

## Request Lifecycle Örneği

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Service1
    participant Service2
    participant Database
    
    Client->>Gateway: HTTP Request
    Gateway->>Service1: Route Request
    Service1->>Service2: Service Call
    Service2->>Database: Query
    Database-->>Service2: Result
    Service2-->>Service1: Response
    Service1-->>Gateway: Response
    Gateway-->>Client: HTTP Response
```

## Performance Optimization

### Request Optimization
- Keep-alive connections
- HTTP/2 multiplexing
- Request batching
- Compression (gzip)

```mermaid
sequenceDiagram
    participant Client
    participant Server
    
    Client->>Server: Initial Connection
    Server-->>Client: Connection Established
    
    loop Keep-alive Connection
        Client->>Server: Request 1
        Server-->>Client: Response 1
        Client->>Server: Request 2
        Server-->>Client: Response 2
        Client->>Server: Request 3
        Server-->>Client: Response 3
    end
    
    Note over Client,Server: Connection remains open for multiple requests
```

### Response Optimization
- Response caching
- Pagination
- Field filtering
- Data compression

### Error Handling
- Circuit breaker pattern
- Retry mechanisms
- Graceful degradation
- Fallback responses

## Monitoring & Observability

### Request Tracing
- Distributed tracing
- Correlation IDs
- Request timing
- Error tracking

### Metrics Collection
- Request count
- Response time
- Error rate
- Throughput

### Logging Strategy
- Structured logging
- Log aggregation
- Request/response logging
- Security events
