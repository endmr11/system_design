# Sertifika Sabitleme (Certificate Pinning)

Sertifika sabitleme, sunucu sertifikasının bilinen güvenilir bir sertifika veya açık anahtar ile eşleştiğini doğrulayarak ortadaki adam (MITM) saldırılarını önleyen kritik bir güvenlik tekniğidir. Bu bölüm, mobil uygulamalar için kapsamlı sertifika sabitleme stratejilerini ele almaktadır.

## Sertifika Sabitlemeyi Anlama

Sertifika sabitleme, beklenen sertifika bilgilerini mobil uygulamaya gömerek ve SSL/TLS el sıkışması sırasında sunucu sertifikalarını bu bilinen güvenilir bilgilere karşı doğrulayarak çalışır.

### Sertifika Sabitleme Türleri

1. **Sertifika Sabitleme**: Tüm sertifikayı sabitleme
2. **Açık Anahtar Sabitleme**: Sadece açık anahtarı sabitleme (önerilen)
3. **CA Sabitleme**: Sertifika Otoritesini sabitleme
4. **Konu Açık Anahtar Bilgisi (SPKI) Sabitleme**: SPKI hash'ini sabitleme

## Android Sertifika Sabitleme

### OkHttp CertificatePinner Kullanımı

```kotlin
class NetworkSecurityManager {
    
    // Üretim sertifika pinleri
    private val certificatePinner = CertificatePinner.Builder()
        .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") // Mevcut sertifika
        .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=") // Yedek sertifika
        .add("*.example.com", "sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=")   // Joker karakter
        .build()
    
    // Geliştirme/Hata ayıklama yapılandırması (sabitleme yok)
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
}
```

### Ağ Güvenliği Yapılandırması (Android 7.0+)

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
</network-security-config>
```

## iOS Sertifika Sabitleme

### URLSession ile Sertifika Sabitleme

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
    
    // Sertifika sabitleme ile URLSession oluşturma
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
```

## Sertifika Sabitleme En İyi Uygulamaları

### Uygulama Yönergeleri

1. **Birden Fazla Sertifika Sabitleme**: Yedek sertifikaları dahil edin
2. **Ara Sertifikaları Sabitleme**: Ara sertifikaları sabitlemeyi düşünün
3. **Düzenli Güncellemeler**: Sertifika rotasyon mekanizması uygulayın
4. **Zarif Bozulma**: Sabitleme hatalarını uygun şekilde yönetin
5. **Hata Ayıklama Yapılandırması**: Hata ayıklama derlemelerinde sabitlemeyi devre dışı bırakın

### İzleme ve Uyarı

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
        
        // Güvenlik izlemeye gönder
        analyticsService.trackSecurityEvent(event)
        
        // Hata ayıklama için yerel olarak günlüğe kaydet
        Log.w("CertPinning", "Sabitleme hatası: $event")
    }
}
```

## Güvenlik Değerlendirmeleri

### Sertifika Rotasyon Stratejisi

1. **Önceden Planlama**: Her zaman yedek sertifikaları dahil edin
2. **Kademeli Yayın**: Pinleri kullanıcı tabanı genelinde kademeli olarak güncelleyin
3. **İzleme**: Rotasyon sırasında sabitleme hatalarını izleyin
4. **Geri Alma Planı**: Başarısız rotasyonlar için geri alma mekanizmasına sahip olun

### Acil Durum Prosedürleri

1. **Pin Atlama**: Acil durum pin atlama mekanizması uygulayın
2. **Kill Switch**: Sabitlemeyi devre dışı bırakmak için uzaktan yapılandırma
3. **Olay Müdahale**: Sabitleme ile ilgili olaylar için net prosedürler

Sertifika sabitleme, MITM saldırılarının riskini önemli ölçüde azaltan güçlü bir güvenlik önlemidir. Ancak, hizmet kesintilerine neden olmadan etkili olabilmesi için dikkatli bir şekilde uygulanması, izlenmesi ve bakımının yapılması gerekir.
