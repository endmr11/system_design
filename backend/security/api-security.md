# API Güvenliği

## Giriş

API güvenliği, web uygulamalarının en kritik bileşenlerinden biridir. Derinlemesine savunma (defense in depth) stratejisi ile istek bütünlüğü, kimlik doğrulama, oran sınırlama ve girdi doğrulama gibi çok katmanlı güvenlik yaklaşımları uygulanır.

## İstek Bütünlüğü & Kimlik Doğrulama

### 1. HMAC Uygulaması

**Spring Security HMAC filtresi**:

```java
@Component
public class HmacAuthenticationFilter extends OncePerRequestFilter {
    
    private final HmacService hmacService;
    private final ApiKeyService apiKeyService;
    
    public HmacAuthenticationFilter(HmacService hmacService, ApiKeyService apiKeyService) {
        this.hmacService = hmacService;
        this.apiKeyService = apiKeyService;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
        
        String signature = request.getHeader("X-HMAC-Signature");
        String timestamp = request.getHeader("X-Timestamp");
        String clientId = request.getHeader("X-Client-ID");
        
        if (signature == null || timestamp == null || clientId == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        
        try {
            // Validate timestamp (prevent replay attacks)
            long requestTime = Long.parseLong(timestamp);
            long currentTime = System.currentTimeMillis();
            if (Math.abs(currentTime - requestTime) > 300000) { // 5 minutes
                response.setStatus(HttpServletResponse.SC_REQUEST_TIMEOUT);
                return;
            }
            
            // Get client secret
            String secret = apiKeyService.getSecretByClientId(clientId);
            if (secret == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
            
            // Read request body
            CachedBodyHttpServletRequest cachedRequest = new CachedBodyHttpServletRequest(request);
            String requestBody = IOUtils.toString(cachedRequest.getReader());
            
            // Generate expected signature
            String expectedSignature = hmacService.generateSignature(
                request.getMethod(),
                request.getRequestURI(),
                request.getQueryString(),
                requestBody,
                timestamp,
                secret
            );
            
            // Verify signature
            if (!hmacService.verifySignature(signature, expectedSignature)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
            
            // Create authentication
            ApiKeyAuthentication authentication = new ApiKeyAuthentication(clientId, secret);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
            filterChain.doFilter(cachedRequest, response);
            
        } catch (Exception e) {
            log.error("HMAC authentication failed", e);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        }
    }
}
```

**HMAC Servis uygulaması**:

```java
@Service
public class HmacService {
    
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    
    public String generateSignature(String method, String uri, String queryString, 
                                  String body, String timestamp, String secret) {
        try {
            // Create string to sign
            StringBuilder stringToSign = new StringBuilder();
            stringToSign.append(method.toUpperCase()).append("\n");
            stringToSign.append(uri).append("\n");
            stringToSign.append(queryString != null ? queryString : "").append("\n");
            stringToSign.append(body != null ? body : "").append("\n");
            stringToSign.append(timestamp);
            
            // Generate HMAC
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(), HMAC_ALGORITHM);
            mac.init(secretKeySpec);
            
            byte[] hmacBytes = mac.doFinal(stringToSign.toString().getBytes());
            return Base64.getEncoder().encodeToString(hmacBytes);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate HMAC signature", e);
        }
    }
    
    public boolean verifySignature(String receivedSignature, String expectedSignature) {
        return MessageDigest.isEqual(
            receivedSignature.getBytes(),
            expectedSignature.getBytes()
        );
    }
}
```

**Cached Body Request Wrapper**:

```java
public class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
    
    private byte[] cachedBody;
    
    public CachedBodyHttpServletRequest(HttpServletRequest request) throws IOException {
        super(request);
        InputStream requestInputStream = request.getInputStream();
        this.cachedBody = IOUtils.toByteArray(requestInputStream);
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

### 2. API Anahtarı Yönetimi

**Özel kimlik doğrulama filtresi** ve API anahtarı döngüsü:

```java
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {
    
    private final ApiKeyService apiKeyService;
    private final RateLimitService rateLimitService;
    
    public ApiKeyAuthenticationFilter(ApiKeyService apiKeyService, RateLimitService rateLimitService) {
        this.apiKeyService = apiKeyService;
        this.rateLimitService = rateLimitService;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
        
        String apiKey = extractApiKey(request);
        
        if (apiKey != null) {
            try {
                ApiKeyDetails apiKeyDetails = apiKeyService.validateApiKey(apiKey);
                
                if (apiKeyDetails != null && apiKeyDetails.isActive()) {
                    // Check rate limits
                    if (!rateLimitService.tryAcquire(apiKeyDetails.getClientId())) {
                        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                        response.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
                        return;
                    }
                    
                    // Update usage statistics
                    apiKeyService.updateUsageStats(apiKeyDetails.getClientId());
                    
                    // Create authentication
                    ApiKeyAuthentication authentication = new ApiKeyAuthentication(
                        apiKeyDetails.getClientId(), 
                        apiKeyDetails.getAuthorities()
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
                
            } catch (Exception e) {
                log.error("API key validation failed", e);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }
    
    private String extractApiKey(HttpServletRequest request) {
        // Try header first
        String apiKey = request.getHeader("X-API-Key");
        
        // Try query parameter
        if (apiKey == null) {
            apiKey = request.getParameter("api_key");
        }
        
        // Try Authorization header
        if (apiKey == null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("ApiKey ")) {
                apiKey = authHeader.substring(7);
            }
        }
        
        return apiKey;
    }
}
```

**API Anahtarı Servisi** döngü ve kullanım takibi ile:

```java
@Service
public class ApiKeyService {
    
    @Autowired
    private ApiKeyRepository apiKeyRepository;
    
    @Autowired
    private ApiKeyUsageRepository usageRepository;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public ApiKeyDetails validateApiKey(String apiKey) {
        // Check cache first
        String cacheKey = "api_key:" + apiKey;
        ApiKeyDetails cached = (ApiKeyDetails) redisTemplate.opsForValue().get(cacheKey);
        
        if (cached != null) {
            return cached;
        }
        
        // Query database
        Optional<ApiKey> apiKeyEntity = apiKeyRepository.findByKeyAndActiveTrue(apiKey);
        
        if (apiKeyEntity.isPresent()) {
            ApiKey key = apiKeyEntity.get();
            
            // Check expiration
            if (key.getExpiresAt() != null && key.getExpiresAt().isBefore(Instant.now())) {
                return null;
            }
            
            ApiKeyDetails details = ApiKeyDetails.builder()
                    .clientId(key.getClientId())
                    .scopes(key.getScopes())
                    .authorities(buildAuthorities(key.getScopes()))
                    .rateLimitPlan(key.getRateLimitPlan())
                    .active(key.isActive())
                    .build();
            
            // Cache for 5 minutes
            redisTemplate.opsForValue().set(cacheKey, details, Duration.ofMinutes(5));
            
            return details;
        }
        
        return null;
    }
    
    public String generateApiKey(String clientId, Set<String> scopes, RateLimitPlan rateLimitPlan) {
        String apiKey = "sk_" + generateSecureRandomString(32);
        
        ApiKey key = ApiKey.builder()
                .key(apiKey)
                .clientId(clientId)
                .scopes(scopes)
                .rateLimitPlan(rateLimitPlan)
                .active(true)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(365, ChronoUnit.DAYS))
                .build();
        
        apiKeyRepository.save(key);
        
        // Invalidate cache
        redisTemplate.delete("api_key:" + apiKey);
        
        return apiKey;
    }
    
    public void rotateApiKey(String oldApiKey) {
        ApiKey oldKey = apiKeyRepository.findByKey(oldApiKey)
                .orElseThrow(() -> new RuntimeException("API key not found"));
        
        // Generate new key
        String newApiKey = generateApiKey(
            oldKey.getClientId(), 
            oldKey.getScopes(), 
            oldKey.getRateLimitPlan()
        );
        
        // Deactivate old key after grace period
        scheduleKeyDeactivation(oldApiKey, Duration.ofDays(7));
        
        // Notify client
        notificationService.sendApiKeyRotation(oldKey.getClientId(), newApiKey);
    }
    
    public void updateUsageStats(String clientId) {
        LocalDate today = LocalDate.now();
        
        ApiKeyUsage usage = usageRepository.findByClientIdAndDate(clientId, today)
                .orElse(ApiKeyUsage.builder()
                        .clientId(clientId)
                        .date(today)
                        .requestCount(0L)
                        .build());
        
        usage.setRequestCount(usage.getRequestCount() + 1);
        usage.setLastRequestAt(Instant.now());
        
        usageRepository.save(usage);
    }
    
    private Collection<GrantedAuthority> buildAuthorities(Set<String> scopes) {
        return scopes.stream()
                .map(scope -> new SimpleGrantedAuthority("SCOPE_" + scope))
                .collect(Collectors.toList());
    }
    
    private String generateSecureRandomString(int length) {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[length];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
```

## Oran Sınırlama (Spring Boot)

### 1. Uygulama Seviyesi Oran Sınırlama

**Spring AOP tabanlı oran sınırlama**:

```java
@Aspect
@Component
public class RateLimitAspect {
    
    @Autowired
    private RateLimitService rateLimitService;
    
    @Around("@annotation(rateLimited)")
    public Object rateLimit(ProceedingJoinPoint joinPoint, RateLimited rateLimited) throws Throwable {
        String key = generateKey(joinPoint, rateLimited);
        
        if (!rateLimitService.tryAcquire(key, rateLimited.requests(), rateLimited.duration())) {
            throw new RateLimitExceededException("Rate limit exceeded for: " + key);
        }
        
        return joinPoint.proceed();
    }
    
    private String generateKey(ProceedingJoinPoint joinPoint, RateLimited rateLimited) {
        if (!rateLimited.key().isEmpty()) {
            return rateLimited.key();
        }
        
        // Generate key based on method and parameters
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        
        // Include user or client ID if available
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String identifier = auth != null ? auth.getName() : "anonymous";
        
        return String.format("%s:%s:%s", className, methodName, identifier);
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimited {
    int requests() default 100;
    long duration() default 60; // seconds
    String key() default "";
}
```

**Redis destekli oran sınırlama servisi**:

```java
@Service
public class RedisRateLimitService implements RateLimitService {
    
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    private final String SLIDING_WINDOW_SCRIPT = 
        "local key = KEYS[1] " +
        "local window = tonumber(ARGV[1]) " +
        "local limit = tonumber(ARGV[2]) " +
        "local current_time = tonumber(ARGV[3]) " +
        "local window_start = current_time - window " +
        "redis.call('zremrangebyscore', key, '-inf', window_start) " +
        "local current_requests = redis.call('zcard', key) " +
        "if current_requests < limit then " +
        "  redis.call('zadd', key, current_time, current_time) " +
        "  redis.call('expire', key, window) " +
        "  return {1, limit - current_requests - 1} " +
        "else " +
        "  return {0, 0} " +
        "end";
    
    @Override
    public boolean tryAcquire(String key, int requests, long durationSeconds) {
        String rateLimitKey = "rate_limit:" + key;
        long currentTime = System.currentTimeMillis();
        long windowSizeMs = durationSeconds * 1000;
        
        DefaultRedisScript<List> script = new DefaultRedisScript<>();
        script.setScriptText(SLIDING_WINDOW_SCRIPT);
        script.setResultType(List.class);
        
        List<Long> result = redisTemplate.execute(script, 
            Collections.singletonList(rateLimitKey),
            String.valueOf(windowSizeMs),
            String.valueOf(requests),
            String.valueOf(currentTime)
        );
        
        return result.get(0) == 1L;
    }
    
    @Override
    public RateLimitInfo getRateLimitInfo(String key) {
        String rateLimitKey = "rate_limit:" + key;
        Long count = redisTemplate.opsForZSet().zCard(rateLimitKey);
        Long ttl = redisTemplate.getExpire(rateLimitKey);
        
        return RateLimitInfo.builder()
                .currentRequests(count != null ? count.intValue() : 0)
                .resetTimeSeconds(ttl != null ? ttl.intValue() : 0)
                .build();
    }
}
```

### 2. Bucket4j Entegrasyonu

**Token bucket uygulaması**:

```java
@Configuration
public class RateLimitConfig {
    
    @Bean
    public ProxyManager<String> proxyManager(RedisTemplate<String, byte[]> redisTemplate) {
        return Bucket4j.extension(Redis.class).proxyManagerForRedis(redisTemplate);
    }
    
    @Bean
    public RateLimitService bucket4jRateLimitService(ProxyManager<String> proxyManager) {
        return new Bucket4jRateLimitService(proxyManager);
    }
}

@Service
public class Bucket4jRateLimitService implements RateLimitService {
    
    private final ProxyManager<String> proxyManager;
    
    public Bucket4jRateLimitService(ProxyManager<String> proxyManager) {
        this.proxyManager = proxyManager;
    }
    
    @Override
    public boolean tryAcquire(String key, int requests, long durationSeconds) {
        BucketConfiguration configuration = BucketConfiguration.builder()
                .addLimit(Bandwidth.simple(requests, Duration.ofSeconds(durationSeconds)))
                .build();
        
        CompletableFuture<BucketProxy> bucketFuture = proxyManager.builder()
                .build(key, configuration);
        
        BucketProxy bucket = bucketFuture.join();
        return bucket.tryConsume(1);
    }
    
    public boolean tryAcquireWithBackoff(String key, RateLimitPlan plan) {
        BucketConfiguration configuration = createBucketConfiguration(plan);
        
        CompletableFuture<BucketProxy> bucketFuture = proxyManager.builder()
                .build(key, configuration);
        
        BucketProxy bucket = bucketFuture.join();
        
        // Try with exponential backoff
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        
        if (probe.isConsumed()) {
            return true;
        } else {
            // Log rate limit details
            log.warn("Rate limit exceeded for key: {}. Remaining tokens: {}, Nanoseconds to wait: {}", 
                    key, probe.getRemainingTokens(), probe.getNanosToWaitForRefill());
            return false;
        }
    }
    
    private BucketConfiguration createBucketConfiguration(RateLimitPlan plan) {
        BucketConfiguration.Builder builder = BucketConfiguration.builder();
        
        for (RateLimitTier tier : plan.getTiers()) {
            Bandwidth bandwidth = Bandwidth.simple(
                tier.getRequests(), 
                Duration.of(tier.getDuration(), tier.getTimeUnit())
            );
            builder.addLimit(bandwidth);
        }
        
        return builder.build();
    }
}
```

## Web Uygulama Güvenlik Duvarı (WAF) Entegrasyonu

### 1. OWASP Top 10 Koruması

**Güvenlik başlıkları yapılandırması**:

```java
@Configuration
public class SecurityHeadersConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                .contentSecurityPolicy("default-src 'self'; " +
                                     "script-src 'self' 'unsafe-inline' https://trusted-scripts.com; " +
                                     "style-src 'self' 'unsafe-inline'; " +
                                     "img-src 'self' data: https:; " +
                                     "font-src 'self' https://fonts.gstatic.com; " +
                                     "connect-src 'self' https://api.example.com; " +
                                     "frame-ancestors 'none'")
                .and()
                .frameOptions().deny()
                .contentTypeOptions().and()
                .xssProtection(xss -> xss.block(true))
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31536000)
                    .includeSubdomains(true)
                    .preload(true)
                )
                .referrerPolicy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
            );
        
        return http.build();
    }
}
```

**SQL Enjeksiyon önleme**:

```java
@Component
public class SqlInjectionFilter implements Filter {
    
    private static final List<Pattern> SQL_INJECTION_PATTERNS = Arrays.asList(
        Pattern.compile("('|(\\-\\-)|(;)|(\\|)|(\\*)|(%27)|(')|(\\+))", Pattern.CASE_INSENSITIVE),
        Pattern.compile("((%3D)|(=))[^\\n]*((%27)|(')|((%3B)|(;)))", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\w*((%27)|('))((%6F)|o|(%4F))((%72)|r|(%52))", Pattern.CASE_INSENSITIVE),
        Pattern.compile("((%27)|('))union", Pattern.CASE_INSENSITIVE),
        Pattern.compile("exec(\\s|\\+)+(s|x)p\\w+", Pattern.CASE_INSENSITIVE)
    );
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Check query parameters
        String queryString = httpRequest.getQueryString();
        if (queryString != null && containsSqlInjection(queryString)) {
            log.warn("SQL injection attempt detected in query string: {}", queryString);
            httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }
        
        // Check request body for POST requests
        if ("POST".equalsIgnoreCase(httpRequest.getMethod()) || 
            "PUT".equalsIgnoreCase(httpRequest.getMethod())) {
            
            CachedBodyHttpServletRequest cachedRequest = new CachedBodyHttpServletRequest(httpRequest);
            String body = IOUtils.toString(cachedRequest.getReader());
            
            if (containsSqlInjection(body)) {
                log.warn("SQL injection attempt detected in request body");
                httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            
            chain.doFilter(cachedRequest, response);
        } else {
            chain.doFilter(request, response);
        }
    }
    
    private boolean containsSqlInjection(String input) {
        if (input == null || input.trim().isEmpty()) {
            return false;
        }
        
        String decodedInput = URLDecoder.decode(input, StandardCharsets.UTF_8);
        
        return SQL_INJECTION_PATTERNS.stream()
                .anyMatch(pattern -> pattern.matcher(decodedInput).find());
    }
}
```

**XSS filtreleme**:

```java
@Component
public class XssFilter implements Filter {
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        XssHttpServletRequestWrapper wrappedRequest = new XssHttpServletRequestWrapper(
            (HttpServletRequest) request);
        
        chain.doFilter(wrappedRequest, response);
    }
}

public class XssHttpServletRequestWrapper extends HttpServletRequestWrapper {
    
    private static final Pattern[] XSS_PATTERNS = {
        Pattern.compile("<script>(.*?)</script>", Pattern.CASE_INSENSITIVE),
        Pattern.compile("src[\r\n]*=[\r\n]*\\\'(.*?)\\\'", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL),
        Pattern.compile("src[\r\n]*=[\r\n]*\\\"(.*?)\\\"", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL),
        Pattern.compile("</script>", Pattern.CASE_INSENSITIVE),
        Pattern.compile("<script(.*?)>", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL),
        Pattern.compile("eval\\((.*?)\\)", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL),
        Pattern.compile("expression\\((.*?)\\)", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL),
        Pattern.compile("javascript:", Pattern.CASE_INSENSITIVE),
        Pattern.compile("vbscript:", Pattern.CASE_INSENSITIVE),
        Pattern.compile("onload(.*?)=", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL)
    };
    
    public XssHttpServletRequestWrapper(HttpServletRequest servletRequest) {
        super(servletRequest);
    }
    
    @Override
    public String[] getParameterValues(String parameter) {
        String[] values = super.getParameterValues(parameter);
        
        if (values == null) {
            return null;
        }
        
        int count = values.length;
        String[] encodedValues = new String[count];
        for (int i = 0; i < count; i++) {
            encodedValues[i] = stripXss(values[i]);
        }
        
        return encodedValues;
    }
    
    @Override
    public String getParameter(String parameter) {
        String value = super.getParameter(parameter);
        return stripXss(value);
    }
    
    @Override
    public String getHeader(String name) {
        String value = super.getHeader(name);
        return stripXss(value);
    }
    
    private String stripXss(String value) {
        if (value != null) {
            // HTML encode
            value = StringEscapeUtils.escapeHtml4(value);
            
            // Remove XSS patterns
            for (Pattern pattern : XSS_PATTERNS) {
                value = pattern.matcher(value).replaceAll("");
            }
        }
        return value;
    }
}
```

## Girdi Doğrulama & Temizleme

### 1. Bean Validation

**Gelişmiş doğrulama anotasyonları**:

```java
@Entity
public class UserRegistrationRequest {
    
    @NotNull(message = "Kullanıcı adı gereklidir")
    @Size(min = 3, max = 50, message = "Kullanıcı adı 3 ile 50 karakter arasında olmalıdır")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir")
    private String username;
    
    @NotNull(message = "E-posta gereklidir")
    @Email(message = "Geçerli bir e-posta adresi girin")
    @UniqueEmail
    private String email;
    
    @NotNull(message = "Şifre gereklidir")
    @StrongPassword
    private String password;
    
    @Valid
    @NotNull(message = "Adres gereklidir")
    private Address address;
    
    @NotNull(message = "Doğum tarihi gereklidir")
    @Past(message = "Doğum tarihi geçmişte olmalıdır")
    @MinAge(18)
    private LocalDate dateOfBirth;
    
    @NotEmpty(message = "En az bir rol gereklidir")
    @Size(max = 5, message = "Maksimum 5 rol izinlidir")
    private Set<@ValidRole String> roles;
}
```

**Özel doğrulayıcılar**:

```java
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Şifre en az 8 karakter, büyük harf, küçük harf, rakam ve özel karakter içermelidir";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

@Component
public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    
    private static final String PASSWORD_PATTERN = 
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$";
    
    private Pattern pattern;
    
    @Override
    public void initialize(StrongPassword constraintAnnotation) {
        pattern = Pattern.compile(PASSWORD_PATTERN);
    }
    
    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        if (password == null) {
            return false;
        }
        
        boolean isValid = pattern.matcher(password).matches();
        
        if (!isValid) {
            context.disableDefaultConstraintViolation();
            
            List<String> violations = new ArrayList<>();
            
            if (password.length() < 8) {
                violations.add("Şifre en az 8 karakter uzunluğunda olmalıdır");
            }
            if (!password.matches(".*[a-z].*")) {
                violations.add("Şifre en az bir küçük harf içermelidir");
            }
            if (!password.matches(".*[A-Z].*")) {
                violations.add("Şifre en az bir büyük harf içermelidir");
            }
            if (!password.matches(".*\\d.*")) {
                violations.add("Şifre en az bir rakam içermelidir");
            }
            if (!password.matches(".*[@$!%*?&].*")) {
                violations.add("Şifre en az bir özel karakter içermelidir");
            }
            
            context.buildConstraintViolationWithTemplate(String.join(", ", violations))
                   .addConstraintViolation();
        }
        
        return isValid;
    }
}
```

**Alanlar arası doğrulama**:

```java
@CrossFieldValidation
public class PasswordChangeRequest {
    
    @NotNull
    private String currentPassword;
    
    @NotNull
    @StrongPassword
    private String newPassword;
    
    @NotNull
    private String confirmPassword;
    
    // getters and setters
}

@Constraint(validatedBy = CrossFieldValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface CrossFieldValidation {
    String message() default "Alanlar arası doğrulama hatası";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class CrossFieldValidator implements ConstraintValidator<CrossFieldValidation, PasswordChangeRequest> {
    
    @Override
    public boolean isValid(PasswordChangeRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        
        boolean isValid = true;
        
        // Check if new password is different from current password
        if (Objects.equals(request.getCurrentPassword(), request.getNewPassword())) {
            context.buildConstraintViolationWithTemplate("Yeni şifre mevcut şifreden farklı olmalıdır")
                   .addPropertyNode("newPassword")
                   .addConstraintViolation();
            isValid = false;
        }
        
        // Check if new password and confirm password match
        if (!Objects.equals(request.getNewPassword(), request.getConfirmPassword())) {
            context.buildConstraintViolationWithTemplate("Şifre onayı eşleşmiyor")
                   .addPropertyNode("confirmPassword")
                   .addConstraintViolation();
            isValid = false;
        }
        
        if (!isValid) {
            context.disableDefaultConstraintViolation();
        }
        
        return isValid;
    }
}
```

Bu kapsamlı API Güvenliği uygulaması, çok katmanlı güvenlik yaklaşımı ile modern web uygulamaları için gereken tüm güvenlik bileşenlerini sağlar.
