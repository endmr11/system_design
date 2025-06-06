# Ağ Dayanıklılığı (Yeniden Deneme/Geri Çekilme Stratejileri)

Mobil uygulamalarda ağ kesintileri ve instabilitesine karşı dayanıklılık sağlayan kritik teknikler.

## Ağ Dayanıklılığı Temelleri
- **Mobile Network Challenges**: Intermittent connectivity, varying signal strength, network switching
- **User Experience Goals**: Seamless operation despite network issues
- **System Reliability**: Graceful degradation ile service continuity

## Yeniden Deneme Strategi Desenleri

### Üstel Geri Çekilme
- **Algorithm**: Retry intervals exponentially increase (1s → 2s → 4s → 8s)
- **Jitter Addition**: Random delay ile thundering herd prevention
- **Implementation Formula**: `delay = base_delay * (2^attempt) + jitter`
- **Platform Examples**:
  - **Android**: Retrofit ile OkHttp interceptors
  - **iOS**: URLSessionRetryPolicy ile custom retry logic
  - **Flutter**: dio_retry package ile automatic retry

```kotlin
// Android Exponential Backoff Implementation
class ExponentialBackoffInterceptor(
    private val maxRetries: Int = 3,
    private val baseDelayMs: Long = 1000L,
    private val maxDelayMs: Long = 30000L,
    private val jitterFactor: Double = 0.1
) : Interceptor {
    
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        var response = chain.proceed(request)
        var attemptCount = 0
        
        while (!response.isSuccessful && attemptCount < maxRetries) {
            response.close()
            
            val delay = calculateDelay(attemptCount)
            Thread.sleep(delay)
            
            response = chain.proceed(request)
            attemptCount++
        }
        
        return response
    }
    
    private fun calculateDelay(attempt: Int): Long {
        val exponentialDelay = (baseDelayMs * Math.pow(2.0, attempt.toDouble())).toLong()
        val cappedDelay = Math.min(exponentialDelay, maxDelayMs)
        val jitter = (cappedDelay * jitterFactor * Math.random()).toLong()
        return cappedDelay + jitter
    }
}
```

```swift
// iOS URLSession Retry Implementation
class RetryableURLSession {
    private let session: URLSession
    private let maxRetries: Int
    private let baseDelay: TimeInterval
    
    init(maxRetries: Int = 3, baseDelay: TimeInterval = 1.0) {
        self.session = URLSession.shared
        self.maxRetries = maxRetries
        self.baseDelay = baseDelay
    }
    
    func data(from url: URL) async throws -> (Data, URLResponse) {
        var lastError: Error?
        
        for attempt in 0...maxRetries {
            do {
                let (data, response) = try await session.data(from: url)
                
                if let httpResponse = response as? HTTPURLResponse,
                   httpResponse.statusCode >= 500 {
                    throw NetworkError.serverError(httpResponse.statusCode)
                }
                
                return (data, response)
            } catch {
                lastError = error
                
                if attempt < maxRetries && isRetryableError(error) {
                    let delay = calculateDelay(for: attempt)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                } else {
                    break
                }
            }
        }
        
        throw lastError ?? NetworkError.maxRetriesExceeded
    }
    
    private func calculateDelay(for attempt: Int) -> TimeInterval {
        let exponentialDelay = baseDelay * pow(2.0, Double(attempt))
        let jitter = Double.random(in: 0...0.1) * exponentialDelay
        return min(exponentialDelay + jitter, 30.0)
    }
    
    private func isRetryableError(_ error: Error) -> Bool {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .networkConnectionLost, .notConnectedToInternet:
                return true
            default:
                return false
            }
        }
        return false
    }
}
```

### Linear Backoff
- **Use Cases**: Less aggressive than exponential, predictable timing
- **Pattern**: Fixed interval increases (1s → 2s → 3s → 4s)
- **Advantages**: Simpler implementation, resource-friendly

### Fixed Interval Retry
- **Scenario**: Real-time applications ile consistent retry timing
- **Implementation**: Same delay between all retry attempts
- **Considerations**: Risk of thundering herd without jitter

## Advanced Retry Mechanisms

### Devre Kesici Deseni
- **States**: Closed (normal) → Open (failing) → Half-Open (testing)
- **Failure Threshold**: Trip circuit after N consecutive failures
- **Recovery Testing**: Periodic success attempts ile circuit restoration
- **Implementation Libraries**:
  - **Android**: Resilience4j-Android ile circuit breaker
  - **iOS**: Custom CircuitBreaker classes
  - **Flutter**: circuit_breaker package

```dart
// Flutter Circuit Breaker Implementation
enum CircuitState { closed, open, halfOpen }

class CircuitBreaker {
  final int failureThreshold;
  final Duration timeout;
  final Duration retryTimeout;
  
  CircuitState _state = CircuitState.closed;
  int _failureCount = 0;
  DateTime? _lastFailureTime;
  
  CircuitBreaker({
    this.failureThreshold = 5,
    this.timeout = const Duration(seconds: 60),
    this.retryTimeout = const Duration(seconds: 10),
  });
  
  Future<T> execute<T>(Future<T> Function() operation) async {
    if (_state == CircuitState.open) {
      if (_shouldAttemptReset()) {
        _state = CircuitState.halfOpen;
      } else {
        throw CircuitBreakerOpenException();
      }
    }
    
    try {
      final result = await operation();
      _onSuccess();
      return result;
    } catch (e) {
      _onFailure();
      rethrow;
    }
  }
  
  void _onSuccess() {
    _failureCount = 0;
    _state = CircuitState.closed;
    _lastFailureTime = null;
  }
  
  void _onFailure() {
    _failureCount++;
    _lastFailureTime = DateTime.now();
    
    if (_failureCount >= failureThreshold) {
      _state = CircuitState.open;
    }
  }
  
  bool _shouldAttemptReset() {
    if (_lastFailureTime == null) return false;
    return DateTime.now().difference(_lastFailureTime!) > timeout;
  }
}

class CircuitBreakerOpenException implements Exception {
  final String message = 'Circuit breaker is open';
}
```

### Bulkhead Pattern
- **Resource Isolation**: Separate thread pools for different services
- **Failure Containment**: One service failure doesn't affect others
- **Implementation**: Different HTTP clients for different service categories

## Platform-Specific Resilience

### Android Network Resilience
- **Connectivity Manager**: Network state monitoring ile adaptive behavior
- **Network Security Policy**: Certificate pinning ile security resilience
- **WorkManager Integration**: Background retry ile guaranteed execution
- **OkHttp Resilience Features**:
  - Connection pooling ile connection reuse
  - Automatic HTTP/2 multiplexing
  - Built-in retry logic with exponential backoff

### iOS Ağ Dayanıklılığı
- **Network Framework**: Path monitoring ile network change detection
- **URLSession Configuration**:
  - Timeout configurations ile request management
  - Waits for connectivity ile automatic retry
  - Background URL sessions ile app state independence
- **Reachability Integration**: Third-party libraries ile connectivity monitoring

### Flutter Cross-Platform Resilience
- **Connectivity Plugin**: Network state monitoring across platforms
- **Dio Interceptors**: Custom retry logic ile error handling
- **Platform Channels**: Native network state integration

## Intelligent Retry Logic

### Context-Aware Retries
- **Error Type Classification**:
  - Transient errors: Network timeout, temporary server issues
  - Permanent errors: Authentication failures, malformed requests
  - Rate limiting: Exponential backoff with longer delays
- **Selective Retry**: Only retry appropriate error types

### Network Condition Adaptation
- **Connection Quality Assessment**: Speed testing ile network quality
- **Retry Strategy Adjustment**: Slower networks ile longer intervals
- **Bandwidth Consideration**: Reduced retry frequency on metered connections

### User Context Integration
- **Battery Level**: Reduced retry aggression on low battery
- **Data Plan Awareness**: Conservative retries on limited data plans
- **User Activity**: Background vs foreground retry strategies

## Offline-First Resilience

### Queue-Based Retry
- **Operation Queuing**: Failed requests queued için later retry
- **Persistent Queue**: Survive app restarts ile guaranteed delivery
- **Priority Management**: Critical operations ile higher retry priority

### Graceful Degradation
- **Cached Data Serving**: Show stale data ile connectivity issues
- **Feature Disabling**: Non-essential features disabled offline
- **User Communication**: Clear offline state indication

## Monitoring & Observability

### Retry Metrics
- **Success Rate Tracking**: Retry effectiveness measurement
- **Retry Frequency Analysis**: Identify problematic endpoints
- **Network Error Correlation**: Error patterns ile network conditions

### Performance Impact
- **Battery Consumption**: Retry activity ile power usage
- **User Experience**: Retry delays ile perceived performance
- **Server Load**: Retry traffic ile backend impact consideration

## Testing Strategies
- **Network Simulation**: Controlled network failure injection
- **Chaos Engineering**: Random failure introduction ile resilience testing
- **Load Testing**: Retry behavior under high load conditions
- **A/B Testing**: Different retry strategies ile effectiveness comparison
