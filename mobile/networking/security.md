# Ağ Güvenliği & Şifreleme

Mobil uygulamalarda güvenli ağ iletişimi ve veri koruması için kritik güvenlik teknikleri.

## Taşıma Katmanı Güvenliği (TLS)

### TLS Yapılandırması
- **Modern TLS Versiyonları**:
  - Gelişmiş güvenlik için TLS 1.3 gerekliliği
  - Geriye dönük uyumluluk değerlendirmeleri
  - Şifreleme paketi optimizasyonu
- **Sertifika Yönetimi**:
  - Sertifika sabitleme uygulaması
  - Sertifika doğrulama
  - Yedek stratejiler
- **Mükemmel İleri Gizlilik**:
  - Geçici anahtar değişimi
  - Oturum güvenliği izolasyonu
  - Uzun vadeli anahtar koruması

### Platform-Spesifik Güvenlik

#### Android Ağ Güvenlik Yapılandırması
```xml
<!-- Android Ağ Güvenlik Yapılandırması -->
<network-security-config>
    <domain-config>
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set>
            <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
            <pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
        </pin-set>
    </domain-config>
    
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

#### iOS Uygulama Taşıma Güvenliği
```swift
// iOS TLS Uygulaması
class SecureNetworkManager {
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        config.tlsMaximumSupportedProtocolVersion = .TLSv13
        return URLSession(
            configuration: config,
            delegate: self,
            delegateQueue: nil
        )
    }()
}

extension SecureNetworkManager: URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        // Sertifika sabitleme uygulaması
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let serverCertificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        let serverCertData = SecCertificateCopyData(serverCertificate)
        let serverCertHash = sha256(data: CFDataGetBytePtr(serverCertData))
        
        if pinnedHashes.contains(serverCertHash) {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
```

#### Flutter Sertifika Doğrulama
```dart
// Flutter TLS Yapılandırması
class SecureHttpClient {
  static HttpClient createSecureClient() {
    final client = HttpClient();
    
    client.badCertificateCallback = (cert, host, port) {
      // Özel sertifika doğrulama
      return validateCertificate(cert, host, port);
    };
    
    return client;
  }
  
  static bool validateCertificate(X509Certificate cert, String host, int port) {
    // Sertifika sabitleme mantığı
    final certHash = sha256.convert(cert.der).toString();
    return pinnedCertificates.contains(certHash);
  }
}
```

## Veri Şifreleme

### Durağan Veri Şifreleme
- **Güvenli Depolama Uygulaması**:
  - Şifrelenmiş SharedPreferences (Android)
  - Keychain Servisleri (iOS)
  - Flutter Güvenli Depolama
- **Anahtar Yönetimi**:
  - Donanım güvenlik modülleri
  - Biyometrik anahtar koruması
  - Anahtar rotasyon stratejileri
- **Veri Sınıflandırma**:
  - Hassas veri tanımlama
  - Şifreleme seviyesi belirleme
  - Depolama konumu kararları

### İletim Sırasında Şifreleme
- **Uçtan Uca Şifreleme**:
  - Mesaj seviyesi şifreleme
  - Anahtar değişim protokolleri
  - İleri gizlilik uygulaması
- **Güvenli WebSocket**:
  - WSS protokolü kullanımı
  - Özel şifreleme katmanları
  - Gerçek zamanlı iletişim güvenliği
- **Şifrelenmiş API İletişimi**:
  - İstek/yanıt şifreleme
  - JWT token güvenliği
  - API anahtarı koruması

## Güvenlik En İyi Uygulamaları

### API Güvenliği
- **Token Tabanlı Kimlik Doğrulama**:
  - JWT uygulaması
  - Token yenileme mekanizmaları
  - Güvenli token depolama
- **OAuth 2.0 Uygulaması**:
  - Yetkilendirme kodu akışı
  - PKCE uzantısı
  - Kapsam yönetimi
- **API Anahtarı Yönetimi**:
  - Güvenli anahtar dağıtımı
  - Anahtar rotasyonu
  - Ortama özel anahtarlar

### Veri Koruması
- **Hassas Veri İşleme**:
  - Kişisel veri şifreleme
  - Veri minimizasyonu
  - Güvenli iletim
- **Güvenli Anahtar Depolama**:
  - Platform-spesifik güvenli depolama
  - Donanım destekli anahtar depoları
  - Biyometrik koruma
- **Bellek Koruması**:
  - Hassas veri temizleme
  - Bellek dökümü koruması
  - Anti-hata ayıklama önlemleri

## Gelişmiş Güvenlik Teknikleri

### Sertifika Sabitleme Uygulaması
```kotlin
// OkHttp ile Android Sertifika Sabitleme
class CertificatePinner {
    companion object {
        fun create(): CertificatePinning {
            return CertificatePinning.Builder()
                .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
                .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
                .build()
        }
    }
}

val okHttpClient = OkHttpClient.Builder()
    .certificatePinner(CertificatePinner.create())
    .build()
```

### Güvenli İletişim Desenleri
- **Mesaj Doğrulama**:
  - HMAC doğrulama
  - Dijital imzalar
  - Bütünlük kontrolü
- **Tekrar Saldırısı Önleme**:
  - Zaman damgası doğrulama
  - Nonce kullanımı
  - Sıra numaraları
- **Ortadaki Adam Koruması**:
  - Sertifika doğrulama
  - Genel anahtar sabitleme
  - Sertifika şeffaflığı

## Güvenlik İzleme

### Tehdit Tespiti
- **Ağ Anomali Tespiti**:
  - Olağandışı trafik desenleri
  - Şüpheli uç noktalar
  - Sertifika değişiklikleri
- **Güvenlik Olay Günlüğü**:
  - Kimlik doğrulama başarısızlıkları
  - Sertifika doğrulama hataları
  - Şifreleme hataları

### Uyumluluk ve Standartlar
- **KVKK Uyumluluğu**:
  - Veri koruma gereksinimleri
  - Kullanıcı onay yönetimi
  - Veri taşınabilirliği
- **Endüstri Standartları**:
  - OWASP Mobil Top 10
  - NIST siber güvenlik çerçevesi
  - ISO 27001 uyumu

## Güvenlik Testi
- **Sızma Testi**:
  - Ağ katmanı saldırıları
  - Sertifika doğrulama testi
  - Şifreleme gücü testi
- **Güvenlik Denetimi**:
  - Kod güvenlik incelemeleri
  - Bağımlılık güvenlik açığı taraması
  - Yapılandırma doğrulama
