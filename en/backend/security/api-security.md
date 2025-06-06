# API Security - Request Integrity & Protection

API security encompasses multiple layers of protection including request integrity validation, rate limiting, and Web Application Firewall (WAF) integration. This chapter covers comprehensive API security implementation in Spring Boot applications.

## Request Integrity & Authentication

### HMAC Implementation for API Security

HMAC (Hash-based Message Authentication Code) ensures request integrity and authenticity:

```java
@Component
public class HMACService {
    
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SIGNATURE_HEADER = "X-Signature";
    private static final String TIMESTAMP_HEADER = "X-Timestamp";
    private static final long MAX_REQUEST_AGE_MS = 300_000; // 5 minutes
    
    private final SecretKey secretKey;
    
    public HMACService(@Value("${api.hmac.secret}") String secret) {
        this.secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }
    
    public String generateSignature(String method, String uri, String body, 
                                  String timestamp, String clientId) throws Exception {
        String payload = buildPayload(method, uri, body, timestamp, clientId);
        
        Mac mac = Mac.getInstance(HMAC_ALGORITHM);
        mac.init(secretKey);
        byte[] signature = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        
        return Base64.getEncoder().encodeToString(signature);
    }
    
    public boolean validateSignature(String method, String uri, String body,
                                   String timestamp, String clientId, String signature) {
        try {
            // Check timestamp to prevent replay attacks
            if (!isValidTimestamp(timestamp)) {
                log.warn("Invalid timestamp in request: {}", timestamp);
                return false;
            }
            
            String expectedSignature = generateSignature(method, uri, body, timestamp, clientId);
            return MessageDigest.isEqual(
                signature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.error("Signature validation failed", e);
            return false;
        }
    }
    
    private String buildPayload(String method, String uri, String body, 
                              String timestamp, String clientId) {
        return String.join("\n", 
            method.toUpperCase(),
            uri,
            body != null ? body : "",
            timestamp,
            clientId
        );
    }
    
    private boolean isValidTimestamp(String timestamp) {
        try {
            long requestTime = Long.parseLong(timestamp);
            long currentTime = System.currentTimeMillis();
            return Math.abs(currentTime - requestTime) <= MAX_REQUEST_AGE_MS;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
```

### HMAC Authentication Filter

```java
@Component
public class HMACAuthenticationFilter extends OncePerRequestFilter {
    
    private final HMACService hmacService;
    private final ApiKeyService apiKeyService;
    private final ObjectMapper objectMapper;
    
    private static final List<String> EXCLUDED_PATHS = Arrays.asList(
        "/api/public", "/health", "/actuator"
    );
    
    public HMACAuthenticationFilter(HMACService hmacService,
                                  ApiKeyService apiKeyService,
                                  ObjectMapper objectMapper) {
        this.hmacService = hmacService;
        this.apiKeyService = apiKeyService;
        this.objectMapper = objectMapper;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                  HttpServletResponse response, 
                                  FilterChain filterChain) throws ServletException, IOException {
        
        if (shouldSkipAuthentication(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        
        try {
            CachedBodyHttpServletRequest cachedBodyRequest = 
                new CachedBodyHttpServletRequest(request);
            
            if (authenticateRequest(cachedBodyRequest)) {
                filterChain.doFilter(cachedBodyRequest, response);
            } else {
                sendAuthenticationError(response, "Invalid HMAC signature");
            }
        } catch (Exception e) {
            log.error("HMAC authentication failed", e);
            sendAuthenticationError(response, "Authentication error");
        }
    }
    
    private boolean shouldSkipAuthentication(HttpServletRequest request) {
        String path = request.getRequestURI();
        return EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
    }
    
    private boolean authenticateRequest(CachedBodyHttpServletRequest request) throws Exception {
        String signature = request.getHeader("X-Signature");
        String timestamp = request.getHeader("X-Timestamp");
        String clientId = request.getHeader("X-Client-ID");
        
        if (signature == null || timestamp == null || clientId == null) {
            log.warn("Missing required headers for HMAC authentication");
            return false;
        }
        
        // Validate API client
        if (!apiKeyService.isValidClient(clientId)) {
            log.warn("Invalid client ID: {}", clientId);
            return false;
        }
        
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        if (query != null) {
            uri += "?" + query;
        }
        
        String body = new String(request.getCachedBody(), StandardCharsets.UTF_8);
        
        return hmacService.validateSignature(method, uri, body, timestamp, clientId, signature);
    }
    
    private void sendAuthenticationError(HttpServletResponse response, String message) 
            throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        
        Map<String, Object> errorResponse = Map.of(
            "error", "authentication_failed",
            "message", message,
            "timestamp", Instant.now().toString()
        );
        
        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
```

### Cached Body Request Wrapper

```java
public class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
    
    private byte[] cachedBody;
    
    public CachedBodyHttpServletRequest(HttpServletRequest request) throws IOException {
        super(request);
        InputStream requestInputStream = request.getInputStream();
        this.cachedBody = StreamUtils.copyToByteArray(requestInputStream);
    }
    
    @Override
    public ServletInputStream getInputStream() throws IOException {
        return new CachedBodyServletInputStream(this.cachedBody);
    }
    
    @Override
    public BufferedReader getReader() throws IOException {
        ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(this.cachedBody);
        return new BufferedReader(new InputStreamReader(byteArrayInputStream));
    }
    
    public byte[] getCachedBody() {
        return cachedBody;
    }
    
    private static class CachedBodyServletInputStream extends ServletInputStream {
        
        private final InputStream cachedBodyInputStream;
        
        public CachedBodyServletInputStream(byte[] cachedBody) {
            this.cachedBodyInputStream = new ByteArrayInputStream(cachedBody);
        }
        
        @Override
        public boolean isFinished() {
            try {
                return cachedBodyInputStream.available() == 0;
            } catch (IOException e) {
                return false;
            }
        }
        
        @Override
        public boolean isReady() {
            return true;
        }
        
        @Override
        public void setReadListener(ReadListener readListener) {
            throw new UnsupportedOperationException();
        }
        
        @Override
        public int read() throws IOException {
            return cachedBodyInputStream.read();
        }
    }
}
```

## API Key Management

### API Key Service Implementation

```java
@Service
public class ApiKeyService {
    
    private final ApiKeyRepository apiKeyRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ApiKeyGenerator apiKeyGenerator;
    
    private static final String API_KEY_CACHE_PREFIX = "api_key:";
    private static final Duration CACHE_TTL = Duration.ofMinutes(15);
    
    public ApiKeyService(ApiKeyRepository apiKeyRepository,
                        RedisTemplate<String, Object> redisTemplate,
                        ApiKeyGenerator apiKeyGenerator) {
        this.apiKeyRepository = apiKeyRepository;
        this.redisTemplate = redisTemplate;
        this.apiKeyGenerator = apiKeyGenerator;
    }
    
    public ApiKeyInfo createApiKey(CreateApiKeyRequest request) {
        ApiKey apiKey = ApiKey.builder()
            .keyId(UUID.randomUUID().toString())
            .clientId(request.getClientId())
            .keyValue(apiKeyGenerator.generateSecureKey())
            .name(request.getName())
            .description(request.getDescription())
            .scopes(request.getScopes())
            .rateLimit(request.getRateLimit())
            .ipWhitelist(request.getIpWhitelist())
            .expiresAt(request.getExpiresAt())
            .createdAt(Instant.now())
            .isActive(true)
            .usageCount(0L)
            .lastUsedAt(null)
            .build();
        
        ApiKey savedKey = apiKeyRepository.save(apiKey);
        
        // Cache the API key
        cacheApiKey(savedKey);
        
        return ApiKeyInfo.from(savedKey);
    }
    
    public boolean isValidClient(String clientId) {
        return getApiKeyByClientId(clientId) != null;
    }
    
    public boolean validateApiKey(String keyValue, String clientId, String ipAddress) {
        ApiKey apiKey = getApiKeyByClientId(clientId);
        
        if (apiKey == null || !apiKey.isActive()) {
            return false;
        }
        
        // Validate key value
        if (!MessageDigest.isEqual(
                keyValue.getBytes(StandardCharsets.UTF_8),
                apiKey.getKeyValue().getBytes(StandardCharsets.UTF_8))) {
            return false;
        }
        
        // Check expiration
        if (apiKey.getExpiresAt() != null && 
            apiKey.getExpiresAt().isBefore(Instant.now())) {
            return false;
        }
        
        // Check IP whitelist
        if (!isIpAllowed(ipAddress, apiKey.getIpWhitelist())) {
            return false;
        }
        
        // Update usage statistics
        updateUsageStats(apiKey);
        
        return true;
    }
    
    private ApiKey getApiKeyByClientId(String clientId) {
        String cacheKey = API_KEY_CACHE_PREFIX + clientId;
        
        // Try cache first
        ApiKey cached = (ApiKey) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return cached;
        }
        
        // Fallback to database
        Optional<ApiKey> apiKey = apiKeyRepository.findByClientIdAndIsActiveTrue(clientId);
        if (apiKey.isPresent()) {
            cacheApiKey(apiKey.get());
            return apiKey.get();
        }
        
        return null;
    }
    
    private void cacheApiKey(ApiKey apiKey) {
        String cacheKey = API_KEY_CACHE_PREFIX + apiKey.getClientId();
        redisTemplate.opsForValue().set(cacheKey, apiKey, CACHE_TTL);
    }
    
    private boolean isIpAllowed(String ipAddress, Set<String> ipWhitelist) {
        if (ipWhitelist == null || ipWhitelist.isEmpty()) {
            return true; // No IP restriction
        }
        
        return ipWhitelist.stream()
            .anyMatch(allowedIp -> isIpInRange(ipAddress, allowedIp));
    }
    
    private boolean isIpInRange(String ipAddress, String allowedIp) {
        try {
            if (allowedIp.contains("/")) {
                // CIDR notation
                SubnetUtils subnet = new SubnetUtils(allowedIp);
                return subnet.getInfo().isInRange(ipAddress);
            } else {
                // Exact match
                return ipAddress.equals(allowedIp);
            }
        } catch (Exception e) {
            log.warn("Invalid IP range format: {}", allowedIp);
            return false;
        }
    }
    
    @Async
    private void updateUsageStats(ApiKey apiKey) {
        apiKey.setUsageCount(apiKey.getUsageCount() + 1);
        apiKey.setLastUsedAt(Instant.now());
        apiKeyRepository.save(apiKey);
        
        // Update cache
        cacheApiKey(apiKey);
    }
    
    public void rotateApiKey(String clientId) {
        ApiKey existingKey = apiKeyRepository.findByClientIdAndIsActiveTrue(clientId)
            .orElseThrow(() -> new ApiKeyNotFoundException("API key not found: " + clientId));
        
        // Deactivate old key
        existingKey.setIsActive(false);
        existingKey.setRevokedAt(Instant.now());
        apiKeyRepository.save(existingKey);
        
        // Create new key
        ApiKey newKey = existingKey.toBuilder()
            .keyId(UUID.randomUUID().toString())
            .keyValue(apiKeyGenerator.generateSecureKey())
            .createdAt(Instant.now())
            .isActive(true)
            .usageCount(0L)
            .lastUsedAt(null)
            .revokedAt(null)
            .build();
        
        apiKeyRepository.save(newKey);
        
        // Update cache
        String cacheKey = API_KEY_CACHE_PREFIX + clientId;
        redisTemplate.delete(cacheKey);
        cacheApiKey(newKey);
        
        log.info("API key rotated for client: {}", clientId);
    }
}
```

## Rate Limiting Implementation

### Spring AOP Rate Limiting

```java
@Component
@Aspect
public class RateLimitingAspect {
    
    private final RateLimitService rateLimitService;
    
    public RateLimitingAspect(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }
    
    @Around("@annotation(rateLimit)")
    public Object enforceRateLimit(ProceedingJoinPoint joinPoint, RateLimit rateLimit) 
            throws Throwable {
        
        HttpServletRequest request = getCurrentRequest();
        String clientId = extractClientId(request);
        String endpoint = request.getRequestURI();
        
        RateLimitKey key = RateLimitKey.builder()
            .clientId(clientId)
            .endpoint(endpoint)
            .timeWindow(rateLimit.timeWindow())
            .build();
        
        if (rateLimitService.isAllowed(key, rateLimit.limit())) {
            return joinPoint.proceed();
        } else {
            throw new RateLimitExceededException(
                String.format("Rate limit exceeded: %d requests per %s", 
                    rateLimit.limit(), rateLimit.timeWindow())
            );
        }
    }
    
    private HttpServletRequest getCurrentRequest() {
        ServletRequestAttributes attrs = 
            (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
        return attrs.getRequest();
    }
    
    private String extractClientId(HttpServletRequest request) {
        String clientId = request.getHeader("X-Client-ID");
        if (clientId == null) {
            clientId = request.getRemoteAddr();
        }
        return clientId;
    }
}
```

### Redis-Backed Rate Limiting

```java
@Service
public class RedisRateLimitService implements RateLimitService {
    
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisScript<Long> rateLimitScript;
    
    public RedisRateLimitService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.rateLimitScript = loadLuaScript();
    }
    
    @Override
    public boolean isAllowed(RateLimitKey key, int limit) {
        String redisKey = buildRedisKey(key);
        long windowSizeInSeconds = key.getTimeWindow().toSeconds();
        
        List<String> keys = Collections.singletonList(redisKey);
        List<String> args = Arrays.asList(
            String.valueOf(limit),
            String.valueOf(windowSizeInSeconds),
            String.valueOf(System.currentTimeMillis())
        );
        
        Long result = redisTemplate.execute(rateLimitScript, keys, args.toArray());
        return result != null && result == 1;
    }
    
    @Override
    public RateLimitInfo getRateLimitInfo(RateLimitKey key) {
        String redisKey = buildRedisKey(key);
        String countStr = redisTemplate.opsForValue().get(redisKey);
        long currentCount = countStr != null ? Long.parseLong(countStr) : 0;
        
        Long ttl = redisTemplate.getExpire(redisKey);
        long resetTime = System.currentTimeMillis() + (ttl != null ? ttl * 1000 : 0);
        
        return RateLimitInfo.builder()
            .currentCount(currentCount)
            .resetTime(Instant.ofEpochMilli(resetTime))
            .build();
    }
    
    private String buildRedisKey(RateLimitKey key) {
        return String.format("rate_limit:%s:%s:%d", 
            key.getClientId(), 
            key.getEndpoint().replace("/", "_"),
            getCurrentWindow(key.getTimeWindow())
        );
    }
    
    private long getCurrentWindow(Duration timeWindow) {
        long windowSizeInSeconds = timeWindow.toSeconds();
        return System.currentTimeMillis() / 1000 / windowSizeInSeconds;
    }
    
    private RedisScript<Long> loadLuaScript() {
        String script = """
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local current_time = tonumber(ARGV[3])
            
            local current = redis.call('GET', key)
            if current == false then
                redis.call('SET', key, 1)
                redis.call('EXPIRE', key, window)
                return 1
            else
                local count = tonumber(current)
                if count < limit then
                    redis.call('INCR', key)
                    return 1
                else
                    return 0
                end
            end
            """;
        
        return RedisScript.of(script, Long.class);
    }
}
```

### Bucket4j Token Bucket Rate Limiting

```java
@Service
public class TokenBucketRateLimitService {
    
    private final LoadingCache<String, Bucket> bucketCache;
    
    public TokenBucketRateLimitService() {
        this.bucketCache = Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .build(this::createBucket);
    }
    
    public boolean isAllowed(String clientId, RateLimitConfig config) {
        try {
            String bucketKey = clientId + ":" + config.getEndpoint();
            Bucket bucket = bucketCache.get(bucketKey);
            return bucket.tryConsume(1);
        } catch (Exception e) {
            log.error("Rate limiting check failed", e);
            return true; // Fail open
        }
    }
    
    private Bucket createBucket(String key) {
        // Extract rate limit configuration based on key
        // For simplicity, using default configuration
        Bandwidth limit = Bandwidth.classic(100, Refill.intervally(100, Duration.ofMinutes(1)));
        return Bucket.builder()
            .addLimit(limit)
            .build();
    }
    
    public RateLimitStatus getRateLimitStatus(String clientId, String endpoint) {
        String bucketKey = clientId + ":" + endpoint;
        try {
            Bucket bucket = bucketCache.get(bucketKey);
            ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(0);
            
            return RateLimitStatus.builder()
                .remainingTokens(probe.getRemainingTokens())
                .nanosToWaitForRefill(probe.getNanosToWaitForRefill())
                .isConsumed(probe.isConsumed())
                .build();
        } catch (Exception e) {
            log.error("Failed to get rate limit status", e);
            return RateLimitStatus.builder()
                .remainingTokens(0)
                .nanosToWaitForRefill(0)
                .isConsumed(false)
                .build();
        }
    }
}
```

## Web Application Firewall (WAF) Integration

### OWASP Top 10 Protection

```java
@Component
public class WAFSecurityFilter extends OncePerRequestFilter {
    
    private final SQLInjectionDetector sqlInjectionDetector;
    private final XSSDetector xssDetector;
    private final CSRFProtectionService csrfProtectionService;
    private final RequestValidator requestValidator;
    
    public WAFSecurityFilter(SQLInjectionDetector sqlInjectionDetector,
                           XSSDetector xssDetector,
                           CSRFProtectionService csrfProtectionService,
                           RequestValidator requestValidator) {
        this.sqlInjectionDetector = sqlInjectionDetector;
        this.xssDetector = xssDetector;
        this.csrfProtectionService = csrfProtectionService;
        this.requestValidator = requestValidator;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                  HttpServletResponse response, 
                                  FilterChain filterChain) throws ServletException, IOException {
        
        try {
            CachedBodyHttpServletRequest cachedRequest = 
                new CachedBodyHttpServletRequest(request);
            
            // Check for malicious patterns
            SecurityThreat threat = detectSecurityThreats(cachedRequest);
            
            if (threat.isDetected()) {
                handleSecurityThreat(response, threat);
                return;
            }
            
            filterChain.doFilter(cachedRequest, response);
            
        } catch (Exception e) {
            log.error("WAF security check failed", e);
            sendErrorResponse(response, "Security validation error");
        }
    }
    
    private SecurityThreat detectSecurityThreats(CachedBodyHttpServletRequest request) 
            throws IOException {
        
        // SQL Injection Detection
        if (sqlInjectionDetector.containsSQLInjection(request)) {
            return SecurityThreat.sqlInjection("SQL injection pattern detected");
        }
        
        // XSS Detection
        if (xssDetector.containsXSS(request)) {
            return SecurityThreat.xss("Cross-site scripting pattern detected");
        }
        
        // CSRF Protection
        if (!csrfProtectionService.isValidRequest(request)) {
            return SecurityThreat.csrf("Invalid CSRF token");
        }
        
        // Request Validation
        if (!requestValidator.isValidRequest(request)) {
            return SecurityThreat.invalidRequest("Request validation failed");
        }
        
        return SecurityThreat.none();
    }
    
    private void handleSecurityThreat(HttpServletResponse response, SecurityThreat threat) 
            throws IOException {
        
        log.warn("Security threat detected: {} - {}", threat.getType(), threat.getMessage());
        
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        response.setContentType("application/json");
        
        Map<String, Object> errorResponse = Map.of(
            "error", "security_threat_detected",
            "type", threat.getType().name(),
            "message", "Request blocked by security policy",
            "timestamp", Instant.now().toString()
        );
        
        ObjectMapper objectMapper = new ObjectMapper();
        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
```

### SQL Injection Detection

```java
@Component
public class SQLInjectionDetector {
    
    private final List<Pattern> sqlInjectionPatterns;
    
    public SQLInjectionDetector() {
        this.sqlInjectionPatterns = initializeSQLPatterns();
    }
    
    public boolean containsSQLInjection(HttpServletRequest request) throws IOException {
        // Check URL parameters
        if (hasInjectionInParameters(request.getParameterMap())) {
            return true;
        }
        
        // Check headers
        if (hasInjectionInHeaders(request)) {
            return true;
        }
        
        // Check request body for POST/PUT requests
        if (request instanceof CachedBodyHttpServletRequest) {
            CachedBodyHttpServletRequest cachedRequest = (CachedBodyHttpServletRequest) request;
            String body = new String(cachedRequest.getCachedBody(), StandardCharsets.UTF_8);
            if (hasInjectionInString(body)) {
                return true;
            }
        }
        
        return false;
    }
    
    private boolean hasInjectionInParameters(Map<String, String[]> parameters) {
        for (String[] values : parameters.values()) {
            for (String value : values) {
                if (hasInjectionInString(value)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    private boolean hasInjectionInHeaders(HttpServletRequest request) {
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            String headerValue = request.getHeader(headerName);
            if (hasInjectionInString(headerValue)) {
                return true;
            }
        }
        return false;
    }
    
    private boolean hasInjectionInString(String input) {
        if (input == null || input.trim().isEmpty()) {
            return false;
        }
        
        String normalizedInput = input.toLowerCase().replaceAll("\\s+", " ");
        
        return sqlInjectionPatterns.stream()
            .anyMatch(pattern -> pattern.matcher(normalizedInput).find());
    }
    
    private List<Pattern> initializeSQLPatterns() {
        List<String> patterns = Arrays.asList(
            // Union-based injection
            "union.*select",
            "union.*all.*select",
            
            // Boolean-based blind injection
            "\\s+(and|or)\\s+\\d+\\s*=\\s*\\d+",
            "\\s+(and|or)\\s+\\d+\\s*<>\\s*\\d+",
            "\\s+(and|or)\\s+.+\\s+(like|rlike)\\s+",
            
            // Time-based blind injection
            "sleep\\s*\\(",
            "waitfor\\s+delay\\s+",
            "benchmark\\s*\\(",
            
            // Error-based injection
            "extractvalue\\s*\\(",
            "updatexml\\s*\\(",
            "exp\\s*\\(.*\\~",
            
            // Stacked queries
            ";\\s*(drop|alter|create|insert|update|delete)\\s+",
            
            // Comment patterns
            "/\\*.*\\*/",
            "--.*",
            "#.*",
            
            // SQL keywords in suspicious contexts
            "'\\s*(union|select|insert|update|delete|drop|create|alter)\\s+",
            "\\\"\\s*(union|select|insert|update|delete|drop|create|alter)\\s+",
            
            // Hex encoding attempts
            "0x[0-9a-f]+",
            
            // Function calls that might indicate injection
            "(ascii|char|concat|group_concat|load_file|substring)\\s*\\("
        );
        
        return patterns.stream()
            .map(pattern -> Pattern.compile(pattern, Pattern.CASE_INSENSITIVE))
            .collect(Collectors.toList());
    }
}
```

### Input Validation & Sanitization

```java
@Component
public class InputValidator {
    
    private final Validator beanValidator;
    private final HTMLSanitizer htmlSanitizer;
    
    public InputValidator(Validator beanValidator) {
        this.beanValidator = beanValidator;
        this.htmlSanitizer = HTMLSanitizer.builder()
            .allowCommonInlineFormattingElements()
            .allowCommonBlockElements()
            .allowStyling()
            .allowStandardUrlProtocols()
            .build();
    }
    
    public <T> ValidationResult validateAndSanitize(T object) {
        ValidationResult result = new ValidationResult();
        
        // Bean validation
        Set<ConstraintViolation<T>> violations = beanValidator.validate(object);
        if (!violations.isEmpty()) {
            result.addErrors(violations.stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.toList()));
        }
        
        // Custom validation and sanitization
        sanitizeObject(object, result);
        
        return result;
    }
    
    private void sanitizeObject(Object object, ValidationResult result) {
        Field[] fields = object.getClass().getDeclaredFields();
        
        for (Field field : fields) {
            try {
                field.setAccessible(true);
                Object value = field.get(object);
                
                if (value instanceof String) {
                    String sanitized = sanitizeString((String) value, field);
                    if (!Objects.equals(value, sanitized)) {
                        field.set(object, sanitized);
                        result.addSanitization(field.getName(), "Input sanitized");
                    }
                }
            } catch (IllegalAccessException e) {
                log.warn("Could not access field: {}", field.getName());
            }
        }
    }
    
    private String sanitizeString(String input, Field field) {
        if (input == null || input.trim().isEmpty()) {
            return input;
        }
        
        // Check for HTML content annotation
        if (field.isAnnotationPresent(AllowHTML.class)) {
            return htmlSanitizer.sanitize(input);
        }
        
        // Default string sanitization
        return input
            .replaceAll("<script[^>]*>.*?</script>", "") // Remove script tags
            .replaceAll("<[^>]+>", "") // Remove HTML tags
            .replaceAll("javascript:", "") // Remove javascript protocols
            .replaceAll("on\\w+\\s*=", "") // Remove event handlers
            .trim();
    }
}
```

### Cross-Field Validation

```java
@Component
public class CrossFieldValidator {
    
    public boolean validatePasswordMatch(PasswordChangeRequest request) {
        return Objects.equals(request.getNewPassword(), request.getConfirmPassword());
    }
    
    public boolean validateDateRange(DateRangeRequest request) {
        if (request.getStartDate() == null || request.getEndDate() == null) {
            return false;
        }
        return !request.getStartDate().isAfter(request.getEndDate());
    }
    
    public boolean validateEmailUniqueness(String email, String currentUserId) {
        // Check if email is already used by another user
        return userService.isEmailAvailable(email, currentUserId);
    }
    
    public boolean validateBusinessRules(OrderRequest request) {
        // Example: Validate order quantity against available stock
        if (request.getQuantity() <= 0) {
            return false;
        }
        
        // Check stock availability
        Product product = productService.findById(request.getProductId());
        if (product == null || product.getStock() < request.getQuantity()) {
            return false;
        }
        
        // Check customer credit limit
        Customer customer = customerService.findById(request.getCustomerId());
        BigDecimal totalAmount = product.getPrice().multiply(BigDecimal.valueOf(request.getQuantity()));
        
        return customer.getCreditLimit().compareTo(totalAmount) >= 0;
    }
}
```

This comprehensive API security implementation provides multiple layers of protection including request integrity validation through HMAC, robust rate limiting, and WAF integration to protect against common web application vulnerabilities.
