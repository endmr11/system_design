# Ağ Dayanıklılığı (Yeniden Deneme/Geri Çekilme Stratejileri)

Mobil uygulamalarda ağ kesintilerine ve dengesizliklerine karşı dayanıklılık sağlamak için kritik teknikler.

## Ağ Dayanıklılığı Temelleri
- **Mobil Ağ Zorlukları**: Kesintili bağlantı, değişken sinyal gücü, ağ geçişleri
- **Kullanıcı Deneyimi Hedefleri**: Ağ sorunlarına rağmen kesintisiz çalışma
- **Sistem Güvenilirliği**: Hizmet sürekliliği ile zarif bozulma

## Yeniden Deneme Stratejisi Desenleri

### Üstel Geri Çekilme
- **Algoritma**: Yeniden deneme aralıkları üstel olarak artar (1s → 2s → 4s → 8s)
- **Jitter Ekleme**: Gök gürültüsü sürüsünü önlemek için rastgele gecikme
- **Uygulama Formülü**: `gecikme = temel_gecikme * (2^deneme) + jitter`
- **Platform Örnekleri**:
  - **Android**: OkHttp interceptor'ları ile Retrofit
  - **iOS**: Özel yeniden deneme mantığı ile URLSessionRetryPolicy
  - **Flutter**: Otomatik yeniden deneme ile dio_retry paketi

```kotlin
// Android Üstel Geri Çekilme Uygulaması
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
// iOS URLSession Yeniden Deneme Uygulaması
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

### Doğrusal Geri Çekilme
- **Kullanım Alanları**: Üstel geri çekilmeden daha az agresif, öngörülebilir zamanlama
- **Desen**: Sabit aralık artışları (1s → 2s → 3s → 4s)
- **Avantajlar**: Daha basit uygulama, kaynak dostu

### Sabit Aralıklı Yeniden Deneme
- **Senaryo**: Tutarlı yeniden deneme zamanlaması ile gerçek zamanlı uygulamalar
- **Uygulama**: Tüm yeniden deneme girişimleri arasında aynı gecikme
- **Dikkat Edilmesi Gerekenler**: Jitter olmadan gök gürültüsü sürüsü riski

## Gelişmiş Yeniden Deneme Mekanizmaları

### Devre Kesici Deseni
- **Durumlar**: Kapalı (normal) → Açık (başarısız) → Yarı-Açık (test)
- **Başarısızlık Eşiği**: N ardışık başarısızlıktan sonra devreyi kes
- **İyileştirme Testi**: Devre restorasyonu ile periyodik başarı denemeleri
- **Uygulama Kütüphaneleri**:
  - **Android**: Devre kesici ile Resilience4j-Android
  - **iOS**: Özel CircuitBreaker sınıfları
  - **Flutter**: circuit_breaker paketi

```dart
// Flutter Devre Kesici Uygulaması
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
  final String message = 'Devre kesici açık';
}
```

### Bölme Deseni
- **Kaynak İzolasyonu**: Farklı hizmetler için ayrı thread havuzları
- **Hata Sınırlama**: Bir hizmet hatası diğerlerini etkilemez
- **Uygulama**: Farklı hizmet kategorileri için farklı HTTP istemcileri

## Platform Özel Dayanıklılık

### Android Ağ Dayanıklılığı
- **Bağlantı Yöneticisi**: Uyarlanabilir davranış ile ağ durumu izleme
- **Ağ Güvenlik Politikası**: Güvenlik dayanıklılığı ile sertifika sabitleme
- **WorkManager Entegrasyonu**: Garantili yürütme ile arka plan yeniden deneme
- **OkHttp Dayanıklılık Özellikleri**:
  - Bağlantı yeniden kullanımı ile bağlantı havuzu
  - Otomatik HTTP/2 çoklama
  - Üstel geri çekilme ile yerleşik yeniden deneme mantığı

### iOS Ağ Dayanıklılığı
- **Ağ Çerçevesi**: Ağ değişikliği algılama ile yol izleme
- **URLSession Yapılandırması**:
  - İstek yönetimi ile zaman aşımı yapılandırmaları
  - Otomatik yeniden deneme ile bağlantı bekleme
  - Uygulama durumundan bağımsız arka plan URL oturumları
- **Erişilebilirlik Entegrasyonu**: Bağlantı izleme ile üçüncü taraf kütüphaneler

### Flutter Çapraz Platform Dayanıklılık
- **Bağlantı Eklentisi**: Platformlar arası ağ durumu izleme
- **Dio Interceptor'ları**: Hata işleme ile özel yeniden deneme mantığı
- **Platform Kanalları**: Yerel ağ durumu entegrasyonu

## Akıllı Yeniden Deneme Mantığı

### Bağlam Duyarlı Yeniden Denemeler
- **Hata Tipi Sınıflandırması**:
  - Geçici hatalar: Ağ zaman aşımı, geçici sunucu sorunları
  - Kalıcı hatalar: Kimlik doğrulama başarısızlıkları, hatalı istekler
  - Hız sınırlama: Daha uzun gecikmelerle üstel geri çekilme
- **Seçici Yeniden Deneme**: Sadece uygun hata tiplerini yeniden dene

### Ağ Durumu Adaptasyonu
- **Bağlantı Kalitesi Değerlendirmesi**: Ağ kalitesi ile hız testi
- **Yeniden Deneme Stratejisi Ayarlaması**: Daha yavaş ağlarda daha uzun aralıklar
- **Bant Genişliği Dikkate Alma**: Sınırlı veri planlarında daha muhafazakar yeniden denemeler

### Kullanıcı Bağlamı Entegrasyonu
- **Pil Seviyesi**: Düşük pilde daha az agresif yeniden deneme
- **Veri Planı Farkındalığı**: Sınırlı veri planlarında muhafazakar yeniden denemeler
- **Kullanıcı Aktivitesi**: Arka plan vs ön plan yeniden deneme stratejileri

## Çevrimdışı Öncelikli Dayanıklılık

### Kuyruk Tabanlı Yeniden Deneme
- **İşlem Kuyruğu**: Başarısız istekler daha sonra yeniden deneme için kuyruğa alınır
- **Kalıcı Kuyruk**: Garantili teslimat ile uygulama yeniden başlatmalarında hayatta kalma
- **Öncelik Yönetimi**: Daha yüksek yeniden deneme önceliği ile kritik işlemler

### Zarif Bozulma
- **Önbelleğe Alınmış Veri Sunumu**: Bağlantı sorunlarında eski verileri göster
- **Özellik Devre Dışı Bırakma**: Çevrimdışı durumda temel olmayan özellikleri devre dışı bırak
- **Kullanıcı İletişimi**: Net çevrimdışı durum göstergesi

## İzleme ve Gözlemlenebilirlik

### Yeniden Deneme Metrikleri
- **Başarı Oranı Takibi**: Yeniden deneme etkinliği ölçümü
- **Yeniden Deneme Sıklığı Analizi**: Sorunlu uç noktaları belirle
- **Ağ Hatası Korelasyonu**: Ağ koşulları ile hata desenleri

### Performans Etkisi
- **Pil Tüketimi**: Güç kullanımı ile yeniden deneme aktivitesi
- **Kullanıcı Deneyimi**: Algılanan performans ile yeniden deneme gecikmeleri
- **Sunucu Yükü**: Backend etki dikkate alınarak yeniden deneme trafiği

## Test Stratejileri
- **Ağ Simülasyonu**: Kontrollü ağ hata enjeksiyonu
- **Kaos Mühendisliği**: Dayanıklılık testi ile rastgele hata tanıtımı
- **Yük Testi**: Yüksek yük koşullarında yeniden deneme davranışı
- **A/B Testi**: Etkinlik karşılaştırması ile farklı yeniden deneme stratejileri 