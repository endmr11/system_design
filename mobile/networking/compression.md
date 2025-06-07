# Veri Sıkıştırma (Gzip, WebP)

Mobil uygulamalarda bant genişliği tasarrufu ve performans optimizasyonu için kritik sıkıştırma teknikleri.

## Mobil için Sıkıştırma Temelleri
- **Bant Genişliği Tasarrufu**: Azaltılmış veri transferi ile daha hızlı yükleme
- **Pil Optimizasyonu**: Daha az radyo aktivitesi ile geliştirilmiş pil ömrü
- **Kullanıcı Deneyimi**: Daha hızlı içerik yükleme ile geliştirilmiş etkileşim
- **Maliyet Tasarrufu**: Azaltılmış veri kullanımı ile kullanıcı maliyeti göz önünde bulundurma

## HTTP İçerik Sıkıştırma

### Gzip Sıkıştırma
- **Sunucu Tarafı Yapılandırma**:
  - Accept-Encoding: gzip başlığı ile istemci yeteneklerinin tanıtımı
  - Content-Encoding: gzip başlığı ile sunucu yanıt sıkıştırması
  - Sıkıştırma oranı: Tipik olarak %60-80 boyut azaltması
- **Mobil Uygulama**:
  - **Android OkHttp**: Otomatik gzip sıkıştırma desteği
  - **iOS URLSession**: Yerleşik gzip işleme
  - **Flutter HTTP**: Otomatik sıkıştırma ile dart:io entegrasyonu
- **Seçici Sıkıştırma**:
  - Metin tabanlı içerik: JSON, HTML, CSS, JavaScript
  - İkili içerik: Genellikle faydalı değil (resimler, videolar)
  - Boyut eşiği: Sadece 1KB'dan büyük yanıtları sıkıştır

```kotlin
// Android OkHttp Gzip Configuration
class NetworkModule {
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .addHeader("Accept-Encoding", "gzip, deflate")
                    .build()
                chain.proceed(request)
            }
            .addNetworkInterceptor(CompressionInterceptor())
            .build()
    }
}

class CompressionInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        
        return if (response.header("Content-Encoding") == "gzip") {
            val gzipSource = GzipSource(response.body()!!.source())
            val responseBody = ResponseBody.create(
                response.body()!!.contentType(),
                -1L,
                Buffer().apply { writeAll(gzipSource) }
            )
            response.newBuilder()
                .body(responseBody)
                .removeHeader("Content-Encoding")
                .build()
        } else {
            response
        }
    }
}
```

```swift
// iOS URLSession Compression Handling
class NetworkManager {
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "Accept-Encoding": "gzip, deflate"
        ]
        return URLSession(configuration: config)
    }()
    
    func request<T: Codable>(
        _ endpoint: String,
        type: T.Type
    ) async throws -> T {
        guard let url = URL(string: endpoint) else {
            throw NetworkError.invalidURL
        }
        
        let (data, response) = try await session.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.invalidResponse
        }
        
        // URLSession automatically handles gzip decompression
        let decodedData = try JSONDecoder().decode(T.self, from: data)
        return decodedData
    }
}
```

### Brotli Sıkıştırma
- **Gelişmiş Sıkıştırma**: Gzip'ten daha iyi sıkıştırma oranları
- **Tarayıcı Desteği**: Modern mobil tarayıcılar ile yerel destek
- **Uygulama Hususları**: Sunucu yetenek gereksinimleri

## Resim Sıkıştırma ve Optimizasyon

### WebP Formatı
- **Sıkıştırma Avantajları**:
  - JPEG'den %25-35 daha küçük
  - PNG gibi şeffaflık desteği
  - GIF gibi animasyon desteği
- **Platform Desteği**:
  - **Android**: API 14+ sürümünden itibaren yerel destek
  - **iOS**: iOS 14+ sürümünden itibaren yerel destek
  - **Flutter**: Otomatik format seçimi ile çapraz platform optimizasyonu
- **Uygulama Stratejileri**:
  - İstemci yeteneğine göre sunucu tarafı format seçimi
  - JPEG/PNG'ye geri dönüş ile kademeli geliştirme
  - Optimal seçim ile dinamik format müzakere

```dart
// Flutter WebP Implementation with Fallback
class ImageLoader {
  static bool get supportsWebP {
    // Check platform support
    if (Platform.isAndroid) return true;
    if (Platform.isIOS) {
      // iOS 14+ supports WebP
      return true;
    }
    return false;
  }
  
  static String getOptimalImageUrl(String baseUrl, int width, int height) {
    final format = supportsWebP ? 'webp' : 'jpg';
    final quality = _getQualityBasedOnConnection();
    
    return '$baseUrl?w=$width&h=$height&format=$format&quality=$quality';
  }
  
  static int _getQualityBasedOnConnection() {
    // Implement network condition detection
    // Return quality between 60-90 based on connection
    return 80;
  }
  
  static Widget buildOptimizedImage(
    String imageUrl,
    double width,
    double height,
  ) {
    final optimizedUrl = getOptimalImageUrl(
      imageUrl,
      (width * MediaQuery.of(context).devicePixelRatio).round(),
      (height * MediaQuery.of(context).devicePixelRatio).round(),
    );
    
    return CachedNetworkImage(
      imageUrl: optimizedUrl,
      width: width,
      height: height,
      fit: BoxFit.cover,
      placeholder: (context, url) => Container(
        width: width,
        height: height,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      ),
      errorWidget: (context, url, error) => Container(
        width: width,
        height: height,
        color: Colors.grey[300],
        child: const Icon(Icons.error),
      ),
    );
  }
}
```

### AVIF & HEIC Formatları
- **Yeni Nesil Formatlar**: WebP'den daha iyi sıkıştırma
- **Platform Benimsemesi**: Uyumluluk hususları ile kademeli yayılım
- **Uygulama**: Kademeli geliştirme ile özellik algılama

### Gelişmiş Görüntü Optimizasyonu
- **Duyarlı Resimler**: Farklı çözünürlükler için farklı sıkıştırmalar
- **Tembel Yükleme Entegrasyonu**: Kademeli yükleme ile sıkıştırma optimizasyonu
- **Kalite Adaptasyonu**: Ağ koşullarına göre dinamik kalite ayarlaması

## Platform Özel Sıkıştırma

### Android Sıkıştırma Kütüphaneleri
- **Yerleşik Sıkıştırma**:
  - `GZIPOutputStream` ile özel sıkıştırma
  - `DeflaterOutputStream` ile gelişmiş sıkıştırma seçenekleri
- **Üçüncü Taraf Çözümler**:
  - Yüksek hızlı sıkıştırma ile LZ4 sıkıştırma
  - CPU verimli sıkıştırma ile Snappy sıkıştırma

### iOS Sıkıştırma API'leri
- **Sıkıştırma Çerçevesi**:
  - `NSData` sıkıştırma yöntemleri
  - Algoritma seçimi (LZFSE, LZ4, ZLIB)
  - Büyük veri işleme ile akış sıkıştırma
- **Resim Sıkıştırma**:
  - `UIImage` sıkıştırma kalite ayarları
  - Özel sıkıştırma mantığı ile Core Graphics

### Flutter Sıkıştırma
- **dart:io Sıkıştırma**:
  - Yerleşik gzip desteği ile GZipCodec
  - zlib sıkıştırma ile ZLibCodec
  - Özel sıkıştırma ile özel codec uygulaması

```dart
// Flutter Custom Compression Implementation
import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';

class CompressionUtils {
  static Uint8List gzipCompress(String data) {
    final bytes = utf8.encode(data);
    final gzipBytes = gzip.encode(bytes);
    return Uint8List.fromList(gzipBytes);
  }
  
  static String gzipDecompress(Uint8List compressedData) {
    final decompressedBytes = gzip.decode(compressedData);
    return utf8.decode(decompressedBytes);
  }
  
  static Future<Uint8List> compressLarge(String data) async {
    return await compute(_compressInIsolate, data);
  }
  
  static Uint8List _compressInIsolate(String data) {
    return gzipCompress(data);
  }
  
  static double getCompressionRatio(String original, Uint8List compressed) {
    final originalSize = utf8.encode(original).length;
    final compressedSize = compressed.length;
    return (originalSize - compressedSize) / originalSize;
  }
}

// Usage Example
class DataService {
  static Future<void> sendCompressedData(String data) async {
    final compressed = await CompressionUtils.compressLarge(data);
    final ratio = CompressionUtils.getCompressionRatio(data, compressed);
    
    print('Compression ratio: ${(ratio * 100).toStringAsFixed(1)}%');
    
    // Send compressed data
    await _httpClient.post(
      '/api/data',
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json',
      },
      body: compressed,
    );
  }
}
```

## Gerçek Zamanlı Sıkıştırma Stratejileri

### Uyarlanabilir Sıkıştırma
- **Dinamik Sıkıştırma Seviyeleri**:
  - Ağ hızına dayalı ayarlama
  - Cihaz yeteneklerini göz önünde bulundurma
  - Pil seviyesi farkındalığı
- **İçerik Tipi Optimizasyonu**:
  - Metin ve ikili sıkıştırma
  - Medyaya özel sıkıştırma
  - Karma içerik işleme

### Aşamalı Sıkıştırma
- **Çok Aşamalı Sıkıştırma**:
  - İlk hızlı sıkıştırma
  - Arka plan optimizasyonu
  - Zamanla kalite iyileştirme
- **Akış Sıkıştırma**:
  - Gerçek zamanlı sıkıştırma
  - Parça tabanlı işleme
  - Bellek verimli uygulama

## Performans Hususları

### Sıkıştırma vs CPU Dengeleri
- **CPU Etkisi**: Sıkıştırma/açma işleme yükü
- **Pil Tüketimi**: İşlem gücü ile pil tüketimi
- **Bellek Kullanımı**: Sıkıştırma tamponları ile bellek yönetimi
- **Termal Yönetim**: Yoğun sıkıştırma ile cihaz ısınması

### Sıkıştırılmış Veri Önbellekleme
- **Önbellek Depolama**: Sıkıştırılmış veya açılmış veriyi saklama
- **Açma Önbellekleme**: Tekrarlanan erişim için açılmış veriyi önbellekleme
- **Karma Önbellekleme**: Farklı içerik tipleri için farklı stratejiler

## İzleme ve Analitik
- **Sıkıştırma Etkinliği**: Boyut azaltma oranlarının takibi
- **Performans Etkisi**: Yükleme süresi iyileştirmelerinin ölçümü
- **Hata Oranları**: Sıkıştırma ile ilgili hataların izlenmesi
- **Kullanıcı Deneyimi Korelasyonu**: Etkileşim metrikleri ile sıkıştırma faydaları
