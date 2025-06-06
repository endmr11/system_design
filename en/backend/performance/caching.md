# Caching - Spring Boot Multi-Layer Approach

Caching is one of the most effective optimization techniques that dramatically improves system performance. By temporarily storing data in fast-accessible locations, it minimizes expensive computation and I/O operations. Spring Boot provides comprehensive support for multi-layered caching strategies.

## Application-Level Caching

### Spring Cache Abstraction

Spring Cache Abstraction enables managing caching operations through declarative annotations. This approach supports clean code principles by separating caching concerns from business logic.

**Key Features:**
- **@Cacheable**: Caches method results
- **@CacheEvict**: Removes data from cache
- **@CachePut**: Updates cache on every call
- **@Caching**: Groups multiple cache annotations
- **Conditional caching**: Enables conditional caching capabilities

**Cache Provider Comparison:**
- **Redis**: Ideal for distributed caching, persistence support
- **Hazelcast**: In-memory data grid, clustering capabilities
- **Caffeine**: High-performance local cache, advanced version of Guava
- **EhCache**: Both local and distributed cache support

### Basic Cache Configuration
```java
@Configuration
@EnableCaching
public class CacheConfig {
    
    @Bean
    public CacheManager cacheManager() {
        RedisCacheManager.Builder builder = RedisCacheManager
            .RedisCacheManagerBuilder
            .fromConnectionFactory(redisConnectionFactory())
            .cacheDefaults(cacheConfiguration());
        
        return builder.build();
    }
    
    @Bean
    public RedisCacheConfiguration cacheConfiguration() {
        return RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));
    }
}
```

### Cache Annotations
```java
@Service
public class UserService {
    
    @Cacheable(value = "users", key = "#userId")
    public User getUserById(Long userId) {
        log.info("Fetching user from database: {}", userId);
        return userRepository.findById(userId).orElse(null);
    }
    
    @CachePut(value = "users", key = "#user.id")
    public User updateUser(User user) {
        User updatedUser = userRepository.save(user);
        log.info("User updated and cached: {}", updatedUser.getId());
        return updatedUser;
    }
    
    @CacheEvict(value = "users", key = "#userId")
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
        log.info("User deleted and evicted from cache: {}", userId);
    }
    
    @CacheEvict(value = "users", allEntries = true)
    public void clearAllUsers() {
        log.info("All users evicted from cache");
    }
}
```

## Redis Distributed Caching

### Redis Configuration
```java
@Configuration
public class RedisConfig {
    
    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName("localhost");
        config.setPort(6379);
        config.setPassword("password");
        
        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
            .commandTimeout(Duration.ofSeconds(5))
            .poolConfig(connectionPoolConfig())
            .build();
            
        return new LettuceConnectionFactory(config, clientConfig);
    }
    
    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory());
        
        // JSON serialization
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(serializer);
        
        return template;
    }
    
    private GenericObjectPoolConfig<?> connectionPoolConfig() {
        GenericObjectPoolConfig<?> config = new GenericObjectPoolConfig<>();
        config.setMaxTotal(20);
        config.setMaxIdle(10);
        config.setMinIdle(5);
        return config;
    }
}
```

### Manual Cache Operations
```java
@Service
public class CacheService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public void cacheObject(String key, Object value, Duration ttl) {
        redisTemplate.opsForValue().set(key, value, ttl);
    }
    
    public <T> T getCachedObject(String key, Class<T> type) {
        Object cached = redisTemplate.opsForValue().get(key);
        return type.cast(cached);
    }
    
    public void evictFromCache(String key) {
        redisTemplate.delete(key);
    }
    
    public void cacheList(String key, List<Object> list, Duration ttl) {
        redisTemplate.opsForList().rightPushAll(key, list.toArray());
        redisTemplate.expire(key, ttl);
    }
    
    public Set<Object> getCachedSet(String key) {
        return redisTemplate.opsForSet().members(key);
    }
}
```

## Cache Patterns

### Cache-Aside Pattern
```java
@Service
public class ProductService {
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public Product getProduct(Long productId) {
        String cacheKey = "product:" + productId;
        
        // Check cache first
        Product cachedProduct = (Product) redisTemplate.opsForValue().get(cacheKey);
        if (cachedProduct != null) {
            return cachedProduct;
        }
        
        // Fetch from database
        Product product = productRepository.findById(productId).orElse(null);
        if (product != null) {
            // Add to cache
            redisTemplate.opsForValue().set(cacheKey, product, Duration.ofMinutes(30));
        }
        
        return product;
    }
    
    public Product updateProduct(Product product) {
        // Update database
        Product updatedProduct = productRepository.save(product);
        
        // Update cache
        String cacheKey = "product:" + product.getId();
        redisTemplate.opsForValue().set(cacheKey, updatedProduct, Duration.ofMinutes(30));
        
        return updatedProduct;
    }
}
```

### Write-Through Pattern
```java
@Service
public class WriteThoughCacheService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public User saveUser(User user) {
        // Write to database
        User savedUser = userRepository.save(user);
        
        // Write to cache (write-through)
        String cacheKey = "user:" + savedUser.getId();
        redisTemplate.opsForValue().set(cacheKey, savedUser, Duration.ofHours(1));
        
        return savedUser;
    }
}
```

### Write-Behind (Write-Back) Pattern
```java
@Service
public class WriteBehindCacheService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Autowired
    private UserRepository userRepository;
    
    private final Queue<User> writeQueue = new ConcurrentLinkedQueue<>();
    
    public User updateUser(User user) {
        // Update cache immediately
        String cacheKey = "user:" + user.getId();
        redisTemplate.opsForValue().set(cacheKey, user, Duration.ofHours(1));
        
        // Queue database write operation
        writeQueue.offer(user);
        
        return user;
    }
    
    @Scheduled(fixedDelay = 5000) // Every 5 seconds
    public void flushToDatabase() {
        List<User> usersToWrite = new ArrayList<>();
        User user;
        
        while ((user = writeQueue.poll()) != null) {
            usersToWrite.add(user);
        }
        
        if (!usersToWrite.isEmpty()) {
            userRepository.saveAll(usersToWrite);
            log.info("Flushed {} users to database", usersToWrite.size());
        }
    }
}
```

## Multi-Level Caching

### L1 (Local) + L2 (Distributed) Cache
```java
@Service
public class MultiLevelCacheService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // L1 Cache - Local in-memory cache
    private final ConcurrentHashMap<String, CacheItem> localCache = new ConcurrentHashMap<>();
    
    public User getUser(Long userId) {
        String key = "user:" + userId;
        
        // L1 Cache check
        CacheItem item = localCache.get(key);
        if (item != null && !item.isExpired()) {
            return (User) item.getValue();
        }
        
        // L2 Cache check (Redis)
        User user = (User) redisTemplate.opsForValue().get(key);
        if (user != null) {
            localCache.put(key, new CacheItem(user, Duration.ofMinutes(5)));
            return user;
        }
        
        // Fetch from database
        user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            // Add to both caches
            redisTemplate.opsForValue().set(key, user, Duration.ofMinutes(30));
            localCache.put(key, new CacheItem(user, Duration.ofMinutes(5)));
        }
        
        return user;
    }
    
    @Scheduled(fixedDelay = 60000) // Every minute
    public void cleanupLocalCache() {
        localCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }
    
    private static class CacheItem {
        private final Object value;
        private final Instant expiry;
        
        public CacheItem(Object value, Duration ttl) {
            this.value = value;
            this.expiry = Instant.now().plus(ttl);
        }
        
        public Object getValue() { return value; }
        public boolean isExpired() { return Instant.now().isAfter(expiry); }
    }
}
```

## Cache Invalidation Strategies

### Event-Based Invalidation
```java
@Component
public class CacheInvalidationHandler {
    
    @Autowired
    private CacheManager cacheManager;
    
    @EventListener
    public void handleUserUpdateEvent(UserUpdateEvent event) {
        Cache userCache = cacheManager.getCache("users");
        if (userCache != null) {
            userCache.evict(event.getUserId());
            log.info("Evicted user {} from cache", event.getUserId());
        }
    }
    
    @EventListener
    public void handleProductCategoryUpdateEvent(ProductCategoryUpdateEvent event) {
        Cache productCache = cacheManager.getCache("products");
        if (productCache != null) {
            // Invalidate all products in the category
            event.getProductIds().forEach(productCache::evict);
        }
    }
}
```

### Time-Based Invalidation
```java
@Service
public class TimeBasedCacheService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public void cacheWithTTL(String key, Object value, Duration ttl) {
        redisTemplate.opsForValue().set(key, value, ttl);
    }
    
    public void cacheWithExpiry(String key, Object value, Instant expiryTime) {
        Duration ttl = Duration.between(Instant.now(), expiryTime);
        redisTemplate.opsForValue().set(key, value, ttl);
    }
    
    @Scheduled(cron = "0 0 2 * * *") // Every night at 02:00
    public void clearDailyCache() {
        Set<String> keys = redisTemplate.keys("daily:*");
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.info("Cleared {} daily cache entries", keys.size());
        }
    }
}
```

## CDN Integration

### Static Content Caching
```java
@RestController
public class StaticContentController {
    
    @GetMapping(value = "/images/{filename}", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Resource> getImage(@PathVariable String filename) {
        try {
            Resource resource = resourceLoader.getResource("classpath:static/images/" + filename);
            
            return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7))) // Cache for 7 days
                .eTag(calculateETag(resource))
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    @GetMapping("/api/products/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        Product product = productService.getProduct(id);
        
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)))
            .eTag(String.valueOf(product.getLastModified().hashCode()))
            .body(product);
    }
}
```

### API Response Caching
```java
@RestController
public class CachedApiController {
    
    @GetMapping("/api/popular-products")
    @Cacheable(value = "popular-products", unless = "#result.isEmpty()")
    public ResponseEntity<List<Product>> getPopularProducts() {
        List<Product> products = productService.getPopularProducts();
        
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofMinutes(15)))
            .body(products);
    }
    
    @GetMapping("/api/categories")
    public ResponseEntity<List<Category>> getCategories(HttpServletRequest request) {
        String etag = categoryService.getCategoriesETag();
        
        // ETag check
        if (request.getHeader("If-None-Match") != null && 
            request.getHeader("If-None-Match").equals(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }
        
        List<Category> categories = categoryService.getAllCategories();
        
        return ResponseEntity.ok()
            .eTag(etag)
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)))
            .body(categories);
    }
}
```

## Performance Monitoring

### Cache Metrics
```java
@Component
public class CacheMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter cacheHits;
    private final Counter cacheMisses;
    private final Timer cacheLoadTime;
    
    public CacheMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.cacheHits = Counter.builder("cache.hits")
            .tag("cache", "users")
            .register(meterRegistry);
        this.cacheMisses = Counter.builder("cache.misses")
            .tag("cache", "users")
            .register(meterRegistry);
        this.cacheLoadTime = Timer.builder("cache.load.time")
            .register(meterRegistry);
    }
    
    public void recordCacheHit(String cacheName) {
        cacheHits.increment(Tags.of("cache", cacheName));
    }
    
    public void recordCacheMiss(String cacheName) {
        cacheMisses.increment(Tags.of("cache", cacheName));
    }
    
    public void recordCacheLoadTime(Duration duration) {
        cacheLoadTime.record(duration);
    }
}
```

### Cache Health Monitoring
```java
@Component
public class CacheHealthIndicator implements HealthIndicator {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Override
    public Health health() {
        try {
            redisTemplate.opsForValue().set("health-check", "ping", Duration.ofSeconds(10));
            String response = (String) redisTemplate.opsForValue().get("health-check");
            
            if ("ping".equals(response)) {
                return Health.up()
                    .withDetail("redis", "Available")
                    .withDetail("responseTime", measureResponseTime() + "ms")
                    .build();
            } else {
                return Health.down()
                    .withDetail("redis", "Invalid response")
                    .build();
            }
        } catch (Exception e) {
            return Health.down()
                .withDetail("redis", "Unavailable")
                .withException(e)
                .build();
        }
    }
    
    private long measureResponseTime() {
        long start = System.currentTimeMillis();
        redisTemplate.opsForValue().get("health-check");
        return System.currentTimeMillis() - start;
    }
}
```

## Production Best Practices

### Cache Warming
```java
@Component
public class CacheWarmupService {
    
    @Autowired
    private ProductService productService;
    
    @Autowired
    private UserService userService;
    
    @EventListener(ApplicationReadyEvent.class)
    public void warmupCache() {
        log.info("Starting cache warmup...");
        
        CompletableFuture.runAsync(this::warmupPopularProducts);
        CompletableFuture.runAsync(this::warmupFrequentlyAccessedUsers);
        
        log.info("Cache warmup initiated");
    }
    
    private void warmupPopularProducts() {
        List<Long> popularProductIds = getPopularProductIds();
        popularProductIds.forEach(productService::getProduct);
        log.info("Warmed up {} popular products", popularProductIds.size());
    }
    
    private void warmupFrequentlyAccessedUsers() {
        List<Long> frequentUserIds = getFrequentlyAccessedUserIds();
        frequentUserIds.forEach(userService::getUserById);
        log.info("Warmed up {} frequently accessed users", frequentUserIds.size());
    }
}
```

### Cache Disaster Recovery
```java
@Service
public class CacheDisasterRecoveryService {
    
    @Autowired
    private RedisTemplate<String, Object> primaryRedis;
    
    @Autowired
    private RedisTemplate<String, Object> backupRedis;
    
    @Retryable(value = Exception.class, maxAttempts = 3)
    public Object getCachedValue(String key) {
        try {
            return primaryRedis.opsForValue().get(key);
        } catch (Exception e) {
            log.warn("Primary Redis failed, trying backup: {}", e.getMessage());
            return backupRedis.opsForValue().get(key);
        }
    }
    
    @Async
    public void syncCaches() {
        Set<String> keys = primaryRedis.keys("*");
        for (String key : keys) {
            try {
                Object value = primaryRedis.opsForValue().get(key);
                Long ttl = primaryRedis.getExpire(key);
                
                if (ttl > 0) {
                    backupRedis.opsForValue().set(key, value, Duration.ofSeconds(ttl));
                }
            } catch (Exception e) {
                log.error("Failed to sync cache key {}: {}", key, e.getMessage());
            }
        }
    }
}
```

These caching strategies significantly improve system performance and reduce database load. With Redis distributed caching, multi-level cache structures, and proper invalidation strategies, they provide production-ready caching solutions.
