# HTTP, REST, gRPC Protokolleri

## Spring Boot ile REST API Development

### Spring WebMVC
- Traditional servlet-based approach
- Blocking I/O model
- Widely adopted ve mature

### Spring WebFlux
- Reactive programming model
- Non-blocking I/O
- Mono/Flux types ile async streams

### Content Negotiation
- `@RequestMapping(produces/consumes)` ile MediaType handling
- JSON/XML/Protocol Buffers support

### Validation
- Bean Validation (`@Valid`, `@NotNull`, `@Size`) ile request validation
- MethodValidationInterceptor ile method-level validation

### Error Handling
- `@ControllerAdvice` ile global exception handling
- ResponseEntity ile custom HTTP status codes

## REST API Best Practices (Spring Boot ile)

### Richardson Maturity Model
- **Level 0**: HTTP as transport
- **Level 1**: Resources
- **Level 2**: HTTP Verbs
- **Level 3**: HATEOAS support için Spring HATEOAS library

### Versioning Strategies
- **URL versioning** (`/api/v1/`)
- **Header-based versioning**
- **Content negotiation**

### Documentation
- **SpringDoc OpenAPI** (Swagger) ile automatic API documentation
- `@Operation` ve `@Schema` annotations

### Security
- **Spring Security** ile JWT token validation
- **OAuth2 Resource Server** configuration

## gRPC Integration (Spring Boot ile)

### gRPC Starters
- `spring-boot-starter-grpc-server`/`client` dependencies

### Protobuf Code Generation
- `protobuf-maven-plugin` ile Java class generation

### Service Implementation
- `@GrpcService` annotation ile service implementation
- Blocking/non-blocking stub'lar

### Interceptors
- gRPC interceptors ile authentication, logging, metrics collection

### Performance Benefits
- Binary serialization ile %30-50 daha az bandwidth
- HTTP/2 multiplexing
- Bi-directional streaming

## Protocol Selection Criteria

### REST
- ✅ Public API'ler
- ✅ Browser-based clients
- ✅ Human-readable requirements
- ✅ Caching support
- ❌ High-performance scenarios

### gRPC
- ✅ High-performance internal services
- ✅ Polyglot microservices
- ✅ Real-time streaming requirements
- ✅ Type safety
- ❌ Browser support

### GraphQL
- ✅ Complex query requirements
- ✅ Mobile clients ile bandwidth optimization
- ✅ Frontend-driven development
- ❌ Caching complexity

## GraphQL Integration

### Spring GraphQL
- Schema-first approach
- Type definitions

### DataFetcher
- Custom resolver implementations
- N+1 problem çözümü

### Batching & Caching
- DataLoader pattern
- Field-level caching

### Security
- Field-level authorization
- Depth limiting

### Performance Monitoring
- Query complexity analysis
- Execution time tracking

## WebSocket & Server-Sent Events

### Spring WebSocket
- STOMP protocol
- Message broker integration

### Real-time Updates
- Pub/sub pattern
- Topic-based messaging

### Connection Management
- Heartbeat mechanism
- Reconnection strategy

### Scalability
- WebSocket clustering
- Sticky sessions

### Security
- CSRF protection
- Origin validation

## Protocol Comparison

| Özellik | REST | gRPC | GraphQL |
|---------|------|------|---------|
| Performance | Orta | Yüksek | Orta |
| Browser Support | ✅ | ❌ | ✅ |
| Streaming | ❌ | ✅ | ✅ |
| Type Safety | ❌ | ✅ | ✅ |
| Caching | ✅ | ❌ | Karmaşık |
| Learning Curve | Düşük | Orta | Yüksek |

## Implementation Examples

### REST Endpoint
```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    
    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(user);
    }
    
    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest request) {
        User user = userService.create(request);
        return ResponseEntity.status(CREATED).body(user);
    }
}
```

### gRPC Service
```java
@GrpcService
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {
    
    @Override
    public void getUser(GetUserRequest request, StreamObserver<UserResponse> responseObserver) {
        User user = userService.findById(request.getId());
        UserResponse response = UserResponse.newBuilder()
            .setUser(convertToProto(user))
            .build();
        
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
```

## Performance Optimization

### REST API Optimization
- HTTP/2 support
- Response compression
- ETag caching
- Pagination
- Field selection

### gRPC Optimization
- Connection pooling
- Streaming for large datasets
- Compression algorithms
- Keep-alive settings

### Common Optimizations
- Request batching
- Connection reuse
- Circuit breaker pattern
- Load balancing
- Health checks
