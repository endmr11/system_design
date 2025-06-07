# 5.4. GraphQL vs REST vs gRPC Karşılaştırması

## REST API

### Temel Prensipler
- **Kaynak tabanlı**
- **Durumsuz (stateless)**
- **Önbelleğe alınabilir**
- **Tekdüze arayüz**

### Kullanım Senaryoları
- CRUD işlemleri
- Kaynak yönetimi
- Genel amaçlı API'ler
- Açık API'ler

### Avantajlar
- Geniş ekosistem
- Kolay anlaşılır
- Önbellek dostu
- Araç desteği

### Dezavantajlar
- Fazla/eksik veri çekme
- Versiyonlama zorlukları
- Çoklu istek ihtiyacı
- Sınırlı gerçek zamanlılık

## GraphQL

### Temel Prensipler
- **İstemci tarafından belirlenen sorgular**
- **Tek uç nokta**
- **Güçlü tip kontrolü**
- **Kendi kendini tanımlama (introspection)**

### Kullanım Senaryoları
- Karmaşık veri ihtiyaçları
- Mobil uygulamalar
- Gerçek zamanlı güncellemeler
- Mikroservisler

### Avantajlar
- Esnek sorgular
- Azaltılmış ağ trafiği
- Güçlü tip kontrolü
- Gerçek zamanlı abonelikler

### Dezavantajlar
- Önbellekleme karmaşıklığı
- Performans yükü
- Güvenlik zorlukları
- Öğrenme eğrisi

## gRPC

### Temel Prensipler
- **Protocol Buffers**
- **HTTP/2**
- **Güçlü tip kontrolü**
- **Kod üretimi**

### Kullanım Senaryoları
- Mikroservisler
- Düşük gecikmeli sistemler
- Çoklu dil ortamları
- Gerçek zamanlı akış

### Avantajlar
- Yüksek performans
- Çift yönlü akış
- Güçlü tip kontrolü
- Kod üretimi

### Dezavantajlar
- Sınırlı tarayıcı desteği
- Daha dik öğrenme eğrisi
- Hata ayıklama karmaşıklığı
- Sınırlı araç desteği

## Karşılaştırma Tablosu

| Özellik          | REST                  | GraphQL               | gRPC                  |
|-------------------|-----------------------|-----------------------|-----------------------|
| **Veri Taşınımı** | JSON/XML              | JSON                  | Protobuf (ikili)      |
| **İstek/Yanıt**   | Kaynak tabanlı        | İstemci-tarafı sorgu  | Senkron (HTTP/2)      |
| **Performans**    | Orta                  | Yüksek                | Çok Yüksek            |
| **Kullanım Senaryosu** | Genel amaçlı API'ler | Esnek veri sorgulama | Yüksek hız gerektiren sistemler |

## Spring Boot Uygulama Karşılaştırması

### REST API Uygulaması
```java
@RestController
@RequestMapping("/api/v1/users")
@Validated
@Slf4j
public class UserRestController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PostService postService;
    
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        UserResponse response = UserResponse.from(user);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/{id}/posts")
    public ResponseEntity<PagedResponse<PostResponse>> getUserPosts(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = postService.findByUserId(id, pageable);
        
        List<PostResponse> postResponses = posts.getContent().stream()
            .map(PostResponse::from)
            .collect(Collectors.toList());
            
        PagedResponse<PostResponse> response = new PagedResponse<>(
            postResponses, posts.getTotalElements(), posts.getTotalPages()
        );
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping
    public ResponseEntity<UserResponse> createUser(@RequestBody @Valid CreateUserRequest request) {
        User user = userService.create(request);
        UserResponse response = UserResponse.from(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @RequestBody @Valid UpdateUserRequest request) {
        
        User user = userService.update(id, request);
        UserResponse response = UserResponse.from(user);
        return ResponseEntity.ok(response);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private Instant createdAt;
    private Instant updatedAt;
    
    public static UserResponse from(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .phone(user.getPhone())
            .createdAt(user.getCreatedAt())
            .updatedAt(user.getUpdatedAt())
            .build();
    }
}

@Data
@AllArgsConstructor
public class PagedResponse<T> {
    private List<T> content;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    
    public PagedResponse(List<T> content, long totalElements, int totalPages) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
    }
}
```

### GraphQL Uygulaması
```java
// GraphQL Schema Definition (schema.graphqls)
```graphql
type Query {
    user(id: ID!): User
    users(first: Int, after: String): UserConnection
    post(id: ID!): Post
    posts(first: Int, after: String, userId: ID): PostConnection
}

type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload
    updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload
    deleteUser(id: ID!): DeleteUserPayload
}

type Subscription {
    userUpdated(id: ID!): User
    postCreated(userId: ID!): Post
}

type User {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    phone: String
    posts(first: Int, after: String): PostConnection
    createdAt: String!
    updatedAt: String!
}

type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    createdAt: String!
    updatedAt: String!
}

type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
}

type UserEdge {
    node: User!
    cursor: String!
}

type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
}

type PostEdge {
    node: Post!
    cursor: String!
}

type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
}

input CreateUserInput {
    firstName: String!
    lastName: String!
    email: String!
    phone: String
}

input UpdateUserInput {
    firstName: String
    lastName: String
    email: String
    phone: String
}

type CreateUserPayload {
    user: User
    errors: [Error!]
}

type UpdateUserPayload {
    user: User
    errors: [Error!]
}

type DeleteUserPayload {
    success: Boolean!
    errors: [Error!]
}

type Error {
    field: String
    message: String!
}
```

```java
@Component
@Slf4j
public class UserGraphQLResolver implements GraphQLQueryResolver, GraphQLMutationResolver {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PostService postService;
    
    // Query resolvers
    public User user(Long id) {
        return userService.findById(id);
    }
    
    public UserConnection users(Integer first, String after) {
        int limit = first != null ? first : 20;
        int offset = after != null ? decodePageCursor(after) : 0;
        
        Pageable pageable = PageRequest.of(offset / limit, limit);
        Page<User> userPage = userService.findAll(pageable);
        
        return UserConnection.from(userPage);
    }
    
    public Post post(Long id) {
        return postService.findById(id);
    }
    
    public PostConnection posts(Integer first, String after, Long userId) {
        int limit = first != null ? first : 20;
        int offset = after != null ? decodePageCursor(after) : 0;
        
        Pageable pageable = PageRequest.of(offset / limit, limit);
        Page<Post> postPage = userId != null ? 
            postService.findByUserId(userId, pageable) : 
            postService.findAll(pageable);
        
        return PostConnection.from(postPage);
    }
    
    // Mutation resolvers
    public CreateUserPayload createUser(CreateUserInput input) {
        try {
            User user = userService.create(input);
            return CreateUserPayload.success(user);
        } catch (ValidationException e) {
            return CreateUserPayload.withErrors(e.getErrors());
        }
    }
    
    public UpdateUserPayload updateUser(Long id, UpdateUserInput input) {
        try {
            User user = userService.update(id, input);
            return UpdateUserPayload.success(user);
        } catch (ValidationException e) {
            return UpdateUserPayload.withErrors(e.getErrors());
        }
    }
    
    public DeleteUserPayload deleteUser(Long id) {
        try {
            userService.delete(id);
            return DeleteUserPayload.success();
        } catch (Exception e) {
            return DeleteUserPayload.withError("Failed to delete user: " + e.getMessage());
        }
    }
    
    // Field resolvers for User type
    public PostConnection posts(User user, Integer first, String after) {
        int limit = first != null ? first : 20;
        int offset = after != null ? decodePageCursor(after) : 0;
        
        Pageable pageable = PageRequest.of(offset / limit, limit);
        Page<Post> postPage = postService.findByUserId(user.getId(), pageable);
        
        return PostConnection.from(postPage);
    }
    
    // Field resolvers for Post type
    public User author(Post post) {
        return userService.findById(post.getUserId());
    }
    
    private int decodePageCursor(String cursor) {
        try {
            return Integer.parseInt(new String(Base64.getDecoder().decode(cursor)));
        } catch (Exception e) {
            return 0;
        }
    }
}

@Component
public class UserSubscriptionResolver implements GraphQLSubscriptionResolver {
    
    @Autowired
    private ReactiveUserService reactiveUserService;
    
    public Publisher<User> userUpdated(Long id) {
        return reactiveUserService.getUserUpdatesStream(id);
    }
    
    public Publisher<Post> postCreated(Long userId) {
        return reactiveUserService.getPostCreatedStream(userId);
    }
}

// GraphQL Configuration
@Configuration
@EnableGraphQLWebSocket
public class GraphQLConfig {
    
    @Bean
    public GraphQLWebSocketConfigurer graphQLWebSocketConfigurer() {
        return new GraphQLWebSocketConfigurer() {
            @Override
            public void configure(GraphQLWebSocketConfigurationRegistry registry) {
                registry.getConfiguration("default")
                    .setKeepAliveInterval(Duration.ofSeconds(30))
                    .setInitTimeout(Duration.ofSeconds(60));
            }
        };
    }
    
    @Bean
    public DataFetcher<User> userDataFetcher(UserService userService) {
        return environment -> {
            Long id = Long.valueOf(environment.getArgument("id"));
            return userService.findById(id);
        };
    }
    
    @Bean
    public DataFetcher<CompletableFuture<User>> asyncUserDataFetcher(UserService userService) {
        return environment -> {
            Long id = Long.valueOf(environment.getArgument("id"));
            return CompletableFuture.supplyAsync(() -> userService.findById(id));
        };
    }
}
```

### gRPC Uygulaması
```protobuf
// user_service.proto
syntax = "proto3";

package com.example.grpc;

option java_multiple_files = true;
option java_package = "com.example.grpc";
option java_outer_classname = "UserServiceProto";

service UserService {
    rpc GetUser(GetUserRequest) returns (UserResponse);
    rpc GetUsers(GetUsersRequest) returns (stream UserResponse);
    rpc CreateUser(CreateUserRequest) returns (UserResponse);
    rpc UpdateUser(UpdateUserRequest) returns (UserResponse);
    rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
    rpc StreamUserUpdates(StreamUserUpdatesRequest) returns (stream UserResponse);
}

message GetUserRequest {
    int64 id = 1;
}

message GetUsersRequest {
    int32 page = 1;
    int32 size = 2;
    string filter = 3;
}

message CreateUserRequest {
    string first_name = 1;
    string last_name = 2;
    string email = 3;
    string phone = 4;
}

message UpdateUserRequest {
    int64 id = 1;
    string first_name = 2;
    string last_name = 3;
    string email = 4;
    string phone = 5;
}

message DeleteUserRequest {
    int64 id = 1;
}

message DeleteUserResponse {
    bool success = 1;
    string message = 2;
}

message UserResponse {
    int64 id = 1;
    string first_name = 2;
    string last_name = 3;
    string email = 4;
    string phone = 5;
    int64 created_at = 6;
    int64 updated_at = 7;
}

message StreamUserUpdatesRequest {
    int64 user_id = 1;
}
```

```java
@GrpcService
@Slf4j
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {
    
    @Autowired
    private UserService userService;
    
    @Override
    public void getUser(GetUserRequest request, StreamObserver<UserResponse> responseObserver) {
        try {
            User user = userService.findById(request.getId());
            UserResponse response = convertToGrpcResponse(user);
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Error getting user: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to get user: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    @Override
    public void getUsers(GetUsersRequest request, StreamObserver<UserResponse> responseObserver) {
        try {
            Pageable pageable = PageRequest.of(request.getPage(), request.getSize());
            Page<User> users = userService.findAll(pageable);
            
            users.getContent().forEach(user -> {
                UserResponse response = convertToGrpcResponse(user);
                responseObserver.onNext(response);
            });
            
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Error getting users: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to get users: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    @Override
    public void createUser(CreateUserRequest request, StreamObserver<UserResponse> responseObserver) {
        try {
            User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .build();
            
            User createdUser = userService.create(user);
            UserResponse response = convertToGrpcResponse(createdUser);
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (ValidationException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                .withDescription("Validation failed: " + e.getMessage())
                .asRuntimeException());
        } catch (Exception e) {
            log.error("Error creating user: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to create user: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    @Override
    public void updateUser(UpdateUserRequest request, StreamObserver<UserResponse> responseObserver) {
        try {
            User existingUser = userService.findById(request.getId());
            
            User.UserBuilder builder = existingUser.toBuilder();
            if (!request.getFirstName().isEmpty()) {
                builder.firstName(request.getFirstName());
            }
            if (!request.getLastName().isEmpty()) {
                builder.lastName(request.getLastName());
            }
            if (!request.getEmail().isEmpty()) {
                builder.email(request.getEmail());
            }
            if (!request.getPhone().isEmpty()) {
                builder.phone(request.getPhone());
            }
            
            User updatedUser = userService.update(builder.build());
            UserResponse response = convertToGrpcResponse(updatedUser);
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (UserNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND
                .withDescription("User not found: " + e.getMessage())
                .asRuntimeException());
        } catch (Exception e) {
            log.error("Error updating user: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to update user: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    @Override
    public void deleteUser(DeleteUserRequest request, StreamObserver<DeleteUserResponse> responseObserver) {
        try {
            userService.delete(request.getId());
            
            DeleteUserResponse response = DeleteUserResponse.newBuilder()
                .setSuccess(true)
                .setMessage("User deleted successfully")
                .build();
                
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (UserNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND
                .withDescription("User not found: " + e.getMessage())
                .asRuntimeException());
        } catch (Exception e) {
            log.error("Error deleting user: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to delete user: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    @Override
    public void streamUserUpdates(StreamUserUpdatesRequest request, 
                                 StreamObserver<UserResponse> responseObserver) {
        try {
            // Subscribe to user updates
            userService.subscribeToUserUpdates(request.getUserId())
                .subscribe(
                    user -> {
                        UserResponse response = convertToGrpcResponse(user);
                        responseObserver.onNext(response);
                    },
                    error -> {
                        log.error("Error in user updates stream: {}", error.getMessage(), error);
                        responseObserver.onError(Status.INTERNAL
                            .withDescription("Stream error: " + error.getMessage())
                            .asRuntimeException());
                    },
                    () -> responseObserver.onCompleted()
                );
        } catch (Exception e) {
            log.error("Error setting up user updates stream: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                .withDescription("Failed to setup stream: " + e.getMessage())
                .asRuntimeException());
        }
    }
    
    private UserResponse convertToGrpcResponse(User user) {
        return UserResponse.newBuilder()
            .setId(user.getId())
            .setFirstName(user.getFirstName())
            .setLastName(user.getLastName())
            .setEmail(user.getEmail())
            .setPhone(user.getPhone() != null ? user.getPhone() : "")
            .setCreatedAt(user.getCreatedAt().getEpochSecond())
            .setUpdatedAt(user.getUpdatedAt().getEpochSecond())
            .build();
    }
}

// gRPC Configuration
@Configuration
public class GrpcConfig {
    
    @Bean
    public NettyChannelBuilder grpcChannelBuilder() {
        return NettyChannelBuilder.forAddress("localhost", 9090)
            .keepAliveTime(30, TimeUnit.SECONDS)
            .keepAliveTimeout(5, TimeUnit.SECONDS)
            .keepAliveWithoutCalls(true)
            .maxInboundMessageSize(1024 * 1024) // 1MB
            .usePlaintext();
    }
    
    @Bean
    public ServerInterceptor authenticationInterceptor() {
        return new ServerInterceptor() {
            @Override
            public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
                    ServerCall<ReqT, RespT> call,
                    Metadata headers,
                    ServerCallHandler<ReqT, RespT> next) {
                
                String authToken = headers.get(Metadata.Key.of("authorization", ASCII_STRING_MARSHALLER));
                
                if (authToken == null || !authToken.startsWith("Bearer ")) {
                    call.close(Status.UNAUTHENTICATED.withDescription("Missing or invalid token"), headers);
                    return new ServerCall.Listener<ReqT>() {};
                }
                
                // Validate token
                try {
                    validateToken(authToken.substring(7));
                } catch (Exception e) {
                    call.close(Status.UNAUTHENTICATED.withDescription("Invalid token"), headers);
                    return new ServerCall.Listener<ReqT>() {};
                }
                
                return next.startCall(call, headers);
            }
        };
    }
    
    private void validateToken(String token) throws Exception {
        // Token validation logic
    }
}
```

Bu kapsamlı uygulama, REST, GraphQL ve gRPC'nin Spring Boot ekosisteminde nasıl uygulanabileceğini ve her birinin güçlü yanlarını gösterir.
