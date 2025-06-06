# Certificate Pinning

Certificate pinning is a critical security technique that prevents man-in-the-middle (MITM) attacks by validating that the server's certificate matches a known good certificate or public key. This section covers comprehensive certificate pinning strategies for mobile applications.

## Understanding Certificate Pinning

Certificate pinning works by embedding expected certificate information in the mobile application and validating server certificates against this known good information during SSL/TLS handshake.

### Types of Certificate Pinning

1. **Certificate Pinning**: Pin the entire certificate
2. **Public Key Pinning**: Pin only the public key (recommended)
3. **CA Pinning**: Pin the Certificate Authority
4. **Subject Public Key Info (SPKI) Pinning**: Pin the SPKI hash

## Android Certificate Pinning

### Using OkHttp CertificatePinner

```kotlin
class NetworkSecurityManager {
    
    // Production certificate pins
    private val certificatePinner = CertificatePinner.Builder()
        .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") // Current cert
        .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=") // Backup cert
        .add("*.example.com", "sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=")   // Wildcard
        .build()
    
    // Development/Debug configuration (no pinning)
    private val debugCertificatePinner = CertificatePinner.Builder().build()
    
    fun createSecureOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .certificatePinner(if (BuildConfig.DEBUG) debugCertificatePinner else certificatePinner)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(createLoggingInterceptor())
            .build()
    }
    
    // Generate certificate pins programmatically
    fun generateCertificatePin(hostname: String): String {
        val client = OkHttpClient.Builder()
            .certificatePinner(CertificatePinner.Builder().build())
            .build()
        
        val request = Request.Builder()
            .url("https://$hostname")
            .build()
        
        try {
            client.newCall(request).execute()
        } catch (e: SSLPeerUnverifiedException) {
            // Extract pins from exception message
            val pins = e.message?.let { extractPinsFromMessage(it) }
            return pins ?: "Unable to extract pins"
        }
        return "Connection succeeded without pinning"
    }
    
    private fun extractPinsFromMessage(message: String): String {
        // Parse the exception message to extract certificate pins
        val pinPattern = Regex("sha256/([A-Za-z0-9+/=]+)")
        return pinPattern.findAll(message)
            .map { it.value }
            .joinToString("\n")
    }
}
```

### Network Security Configuration (Android 7.0+)

```xml
<!-- res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set>
            <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
            <pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
        </pin-set>
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </domain-config>
    
    <!-- Debug configuration -->
    <debug-overrides>
        <trust-anchors>
            <certificates src="user"/>
            <certificates src="system"/>
        </trust-anchors>
    </debug-overrides>
</network-security-config>
```

```kotlin
// Custom TrustManager for advanced certificate validation
class CustomCertificatePinner : X509TrustManager {
    private val systemTrustManager: X509TrustManager
    private val pinnedCertificates: Set<String>
    
    init {
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as KeyStore?)
        systemTrustManager = trustManagerFactory.trustManagers
            .filterIsInstance<X509TrustManager>()
            .first()
        
        pinnedCertificates = setOf(
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Production cert
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="  // Backup cert
        )
    }
    
    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {
        systemTrustManager.checkClientTrusted(chain, authType)
    }
    
    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
        // First, validate with system trust manager
        systemTrustManager.checkServerTrusted(chain, authType)
        
        // Then, check certificate pinning
        val pinnedCertFound = chain.any { cert ->
            val publicKeyHash = hashPublicKey(cert.publicKey)
            pinnedCertificates.contains(publicKeyHash)
        }
        
        if (!pinnedCertFound) {
            throw CertificateException("Certificate pinning failure: No pinned certificate found in chain")
        }
    }
    
    override fun getAcceptedIssuers(): Array<X509Certificate> {
        return systemTrustManager.acceptedIssuers
    }
    
    private fun hashPublicKey(publicKey: PublicKey): String {
        val spkiBytes = publicKey.encoded
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(spkiBytes)
        return Base64.encodeToString(hash, Base64.NO_WRAP)
    }
}
```

## iOS Certificate Pinning

### Using URLSession with Certificate Pinning

```swift
import Network
import CryptoKit

class CertificatePinningManager: NSObject {
    private let pinnedCertificates: Set<String>
    private let pinnedPublicKeys: Set<String>
    
    init(certificatePins: Set<String> = [], publicKeyPins: Set<String> = []) {
        self.pinnedCertificates = certificatePins
        self.pinnedPublicKeys = publicKeyPins
        super.init()
    }
    
    // Create URLSession with certificate pinning
    func createSecureURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        
        return URLSession(
            configuration: configuration,
            delegate: self,
            delegateQueue: nil
        )
    }
}

extension CertificatePinningManager: URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        
        // Only handle server trust challenges
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        
        // Get server trust
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        // Validate certificate pinning
        if validateCertificatePinning(serverTrust: serverTrust) {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
    
    private func validateCertificatePinning(serverTrust: SecTrust) -> Bool {
        // First, evaluate the trust using system validation
        var result: SecTrustResultType = .invalid
        let status = SecTrustEvaluate(serverTrust, &result)
        
        guard status == errSecSuccess else {
            return false
        }
        
        // System validation passed, now check our pins
        let certificateCount = SecTrustGetCertificateCount(serverTrust)
        
        for i in 0..<certificateCount {
            guard let certificate = SecTrustGetCertificateAtIndex(serverTrust, i) else {
                continue
            }
            
            // Check certificate pinning
            if !pinnedCertificates.isEmpty {
                let certificateData = SecCertificateCopyData(certificate)
                let certificateHash = hashCertificate(data: certificateData)
                
                if pinnedCertificates.contains(certificateHash) {
                    return true
                }
            }
            
            // Check public key pinning
            if !pinnedPublicKeys.isEmpty {
                if let publicKey = extractPublicKey(from: certificate) {
                    let publicKeyHash = hashPublicKey(publicKey)
                    
                    if pinnedPublicKeys.contains(publicKeyHash) {
                        return true
                    }
                }
            }
        }
        
        return false
    }
    
    private func hashCertificate(data: CFData) -> String {
        let dataBytes = CFDataGetBytePtr(data)!
        let dataLength = CFDataGetLength(data)
        let hash = SHA256.hash(data: Data(bytes: dataBytes, count: dataLength))
        return Data(hash).base64EncodedString()
    }
    
    private func extractPublicKey(from certificate: SecCertificate) -> SecKey? {
        return SecCertificateCopyKey(certificate)
    }
    
    private func hashPublicKey(_ publicKey: SecKey) -> String {
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) else {
            return ""
        }
        
        let hash = SHA256.hash(data: publicKeyData as Data)
        return Data(hash).base64EncodedString()
    }
}
```

### TrustKit Integration (iOS)

```swift
import TrustKit

class TrustKitManager {
    
    static func configure() {
        let trustKitConfig: [String: Any] = [
            kTSKSwizzleNetworkDelegates: false,
            kTSKPinnedDomains: [
                "api.example.com": [
                    kTSKEnforcePinning: true,
                    kTSKIncludeSubdomains: true,
                    kTSKPublicKeyHashes: [
                        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Current key
                        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", // Backup key
                    ],
                    kTSKReportUris: ["https://api.example.com/security/pin-failure"]
                ],
                "*.example.com": [
                    kTSKEnforcePinning: true,
                    kTSKPublicKeyHashes: [
                        "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=",
                    ]
                ]
            ]
        ]
        
        TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
    }
    
    func createSecureURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        
        return URLSession(
            configuration: configuration,
            delegate: TrustKit.sharedInstance().pinningValidator,
            delegateQueue: nil
        )
    }
}
```

## Cross-Platform Certificate Pinning

### React Native Implementation

```typescript
// React Native certificate pinning with react-native-cert-pinner
import CertPinner from 'react-native-cert-pinner';

class NetworkSecurityManager {
    private static instance: NetworkSecurityManager;
    
    static getInstance(): NetworkSecurityManager {
        if (!NetworkSecurityManager.instance) {
            NetworkSecurityManager.instance = new NetworkSecurityManager();
        }
        return NetworkSecurityManager.instance;
    }
    
    async initializeCertificatePinning(): Promise<void> {
        const pins = [
            {
                hostname: 'api.example.com',
                pin: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
            },
            {
                hostname: '*.example.com',
                pin: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
            }
        ];
        
        await CertPinner.pin(pins);
    }
    
    async makeSecureRequest(url: string, options: RequestInit = {}): Promise<Response> {
        try {
            // Use fetch with certificate pinning
            const response = await fetch(url, {
                ...options,
                // Certificate pinning is handled by native module
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (error.message.includes('Certificate pinning failure')) {
                // Handle pinning failure
                this.handlePinningFailure(url, error);
            }
            throw error;
        }
    }
    
    private handlePinningFailure(url: string, error: Error): void {
        // Log security incident
        console.error('Certificate pinning failure:', { url, error: error.message });
        
        // Report to security monitoring
        this.reportSecurityIncident({
            type: 'CERTIFICATE_PINNING_FAILURE',
            url,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
    
    private async reportSecurityIncident(incident: SecurityIncident): Promise<void> {
        // Report to security monitoring service
        try {
            await fetch('/api/security/incidents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(incident)
            });
        } catch (error) {
            console.error('Failed to report security incident:', error);
        }
    }
}

interface SecurityIncident {
    type: string;
    url: string;
    timestamp: string;
    error: string;
}
```

### Flutter Implementation

```dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio_certificate_pinning/dio_certificate_pinning.dart';
import 'package:crypto/crypto.dart';

class CertificatePinningManager {
  static final CertificatePinningManager _instance = CertificatePinningManager._internal();
  late Dio _dio;
  
  factory CertificatePinningManager() {
    return _instance;
  }
  
  CertificatePinningManager._internal() {
    _initializeDio();
  }
  
  void _initializeDio() {
    _dio = Dio();
    
    // Add certificate pinning interceptor
    _dio.interceptors.add(
      CertificatePinningInterceptor(
        allowedSHAFingerprints: [
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // api.example.com
          'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // backup cert
        ],
      ),
    );
    
    // Custom certificate callback for additional validation
    (_dio.httpClientAdapter as DefaultHttpClientAdapter).onHttpClientCreate = (client) {
      client.badCertificateCallback = (cert, host, port) {
        return _validateCertificate(cert, host);
      };
      return client;
    };
  }
  
  bool _validateCertificate(X509Certificate cert, String host) {
    // Additional certificate validation logic
    if (!_isAllowedHost(host)) {
      return false;
    }
    
    // Validate certificate against pinned certificates
    String certFingerprint = _getCertificateFingerprint(cert);
    return _pinnedFingerprints.contains(certFingerprint);
  }
  
  String _getCertificateFingerprint(X509Certificate cert) {
    var digest = sha256.convert(cert.der);
    return base64.encode(digest.bytes);
  }
  
  bool _isAllowedHost(String host) {
    List<String> allowedHosts = [
      'api.example.com',
      'secure.example.com',
    ];
    
    return allowedHosts.any((allowedHost) {
      if (allowedHost.startsWith('*.')) {
        String domain = allowedHost.substring(2);
        return host.endsWith(domain);
      }
      return host == allowedHost;
    });
  }
  
  static const List<String> _pinnedFingerprints = [
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  ];
  
  Future<Response> makeSecureRequest(
    String url, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? headers,
  }) async {
    try {
      Response response;
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await _dio.get(url, options: Options(headers: headers));
          break;
        case 'POST':
          response = await _dio.post(url, data: data, options: Options(headers: headers));
          break;
        case 'PUT':
          response = await _dio.put(url, data: data, options: Options(headers: headers));
          break;
        case 'DELETE':
          response = await _dio.delete(url, options: Options(headers: headers));
          break;
        default:
          throw ArgumentError('Unsupported HTTP method: $method');
      }
      
      return response;
    } on DioError catch (e) {
      if (e.type == DioErrorType.other && e.message.contains('CERTIFICATE_VERIFY_FAILED')) {
        _handleCertificatePinningFailure(url, e);
      }
      rethrow;
    }
  }
  
  void _handleCertificatePinningFailure(String url, DioError error) {
    // Log security incident
    print('Certificate pinning failure for $url: ${error.message}');
    
    // Report to security monitoring
    _reportSecurityIncident({
      'type': 'CERTIFICATE_PINNING_FAILURE',
      'url': url,
      'timestamp': DateTime.now().toIso8601String(),
      'error': error.message,
    });
  }
  
  Future<void> _reportSecurityIncident(Map<String, dynamic> incident) async {
    try {
      await _dio.post('/api/security/incidents', data: incident);
    } catch (e) {
      print('Failed to report security incident: $e');
    }
  }
}
```

## Dynamic Certificate Pinning

### Certificate Update Mechanism

```kotlin
class DynamicCertificatePinningManager {
    private val secureStorage = SecureStorageManager()
    private val apiService = CertificateApiService()
    
    suspend fun updateCertificatePins(): Boolean {
        return try {
            val latestPins = apiService.getLatestCertificatePins()
            
            // Validate new pins before applying
            if (validateNewPins(latestPins)) {
                secureStorage.storeCertificatePins(latestPins)
                rebuildHttpClient()
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e("CertPinning", "Failed to update certificate pins", e)
            false
        }
    }
    
    private suspend fun validateNewPins(pins: List<CertificatePin>): Boolean {
        // Test each pin with a simple request
        return pins.all { pin ->
            try {
                val testClient = createTestClient(listOf(pin))
                val response = testClient.newCall(
                    Request.Builder()
                        .url("https://${pin.hostname}/health")
                        .build()
                ).execute()
                response.isSuccessful
            } catch (e: Exception) {
                false
            }
        }
    }
    
    private fun rebuildHttpClient() {
        val pins = secureStorage.getCertificatePins()
        val pinnedHosts = pins.map { "${it.hostname}:${it.pin}" }
        
        val certificatePinner = CertificatePinner.Builder()
            .apply {
                pins.forEach { pin ->
                    add(pin.hostname, pin.pin)
                }
            }
            .build()
        
        // Rebuild and replace the HTTP client
        NetworkManager.updateClient(
            OkHttpClient.Builder()
                .certificatePinner(certificatePinner)
                .build()
        )
    }
}
```

## Certificate Pinning Best Practices

### Implementation Guidelines

1. **Pin Multiple Certificates**: Include backup certificates
2. **Pin Intermediate CAs**: Consider pinning intermediate certificates
3. **Regular Updates**: Implement certificate rotation mechanism
4. **Graceful Degradation**: Handle pinning failures appropriately
5. **Debug Configuration**: Disable pinning in debug builds

### Monitoring and Alerting

```kotlin
class CertificatePinningMonitor {
    private val analyticsService = AnalyticsService()
    
    fun reportPinningFailure(
        hostname: String,
        expectedPins: List<String>,
        actualCertificate: String,
        userAgent: String
    ) {
        val event = SecurityEvent(
            type = "CERTIFICATE_PINNING_FAILURE",
            timestamp = System.currentTimeMillis(),
            hostname = hostname,
            expectedPins = expectedPins,
            actualCertificate = actualCertificate,
            userAgent = userAgent,
            appVersion = BuildConfig.VERSION_NAME
        )
        
        // Send to security monitoring
        analyticsService.trackSecurityEvent(event)
        
        // Log locally for debugging
        Log.w("CertPinning", "Pinning failure: $event")
    }
    
    fun reportPinningSuccess(hostname: String, pinnedCertificate: String) {
        val event = SecurityEvent(
            type = "CERTIFICATE_PINNING_SUCCESS",
            timestamp = System.currentTimeMillis(),
            hostname = hostname,
            pinnedCertificate = pinnedCertificate
        )
        
        analyticsService.trackSecurityEvent(event)
    }
}
```

### Testing Certificate Pinning

```swift
#if DEBUG
class CertificatePinningTester {
    
    func testCertificatePinning() {
        // Test valid certificate
        testPinningForHost("api.example.com", expectSuccess: true)
        
        // Test invalid certificate (should fail)
        testPinningForHost("badssl.com", expectSuccess: false)
        
        // Test certificate rotation
        testCertificateRotation()
    }
    
    private func testPinningForHost(_ hostname: String, expectSuccess: Bool) {
        let expectation = XCTestExpectation(description: "Certificate pinning test for \(hostname)")
        
        let url = URL(string: "https://\(hostname)")!
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if expectSuccess {
                XCTAssertNil(error, "Expected successful connection")
            } else {
                XCTAssertNotNil(error, "Expected connection failure")
            }
            expectation.fulfill()
        }
        
        task.resume()
        wait(for: [expectation], timeout: 10.0)
    }
    
    private func testCertificateRotation() {
        // Test that backup certificates work
        // Implementation depends on your backup certificate strategy
    }
}
#endif
```

## Security Considerations

### Certificate Rotation Strategy

1. **Plan Ahead**: Always include backup certificates
2. **Gradual Rollout**: Update pins gradually across user base
3. **Monitoring**: Monitor pinning failures during rotation
4. **Rollback Plan**: Have a rollback mechanism for failed rotations

### Emergency Procedures

1. **Pin Bypass**: Implement emergency pin bypass mechanism
2. **Kill Switch**: Remote configuration to disable pinning
3. **Incident Response**: Clear procedures for pinning-related incidents

Certificate pinning is a powerful security measure that significantly reduces the risk of MITM attacks. However, it requires careful implementation, monitoring, and maintenance to be effective without causing service disruptions.
