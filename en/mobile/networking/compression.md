# Data Compression (Gzip, WebP)

Critical compression techniques for bandwidth savings and performance optimization in mobile applications.

## Compression Fundamentals for Mobile
- **Bandwidth Savings**: Reduced data transfer with faster loading
- **Battery Optimization**: Less radio activity with improved battery life
- **User Experience**: Faster content loading with improved engagement
- **Cost Savings**: Reduced data usage with user cost consideration

## HTTP Content Compression

### Gzip Compression
- **Server-Side Configuration**:
  - Accept-Encoding: gzip header with client capability advertisement
  - Content-Encoding: gzip header with server response compression
  - Compression ratio: Typically 60-80% size reduction
- **Mobile Implementation**:
  - **Android OkHttp**: Automatic gzip compression support
  - **iOS URLSession**: Built-in gzip handling
  - **Flutter HTTP**: Automatic compression with dart:io integration
- **Selective Compression**:
  - Text-based content: JSON, HTML, CSS, JavaScript
  - Binary content: Usually not beneficial (images, videos)
  - Size threshold: Only compress responses > 1KB

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

### Brotli Compression
- **Advanced Compression**: Better compression ratios than gzip
- **Browser Support**: Modern mobile browsers with native support
- **Implementation Considerations**: Server capability requirements

## Image Compression & Optimization

### WebP Format
- **Compression Benefits**:
  - 25-35% smaller than JPEG
  - Transparency support like PNG
  - Animation support like GIF
- **Platform Support**:
  - **Android**: Native support since API 14+
  - **iOS**: Native support since iOS 14+
  - **Flutter**: Auto-format selection with cross-platform optimization
- **Implementation Strategies**:
  - Server-side format selection based on client capability
  - Progressive enhancement with fallback to JPEG/PNG
  - Dynamic format negotiation with optimal selection

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

### AVIF & HEIC Formats
- **Next-Generation Formats**: Even better compression than WebP
- **Platform Adoption**: Gradual rollout with compatibility considerations
- **Implementation**: Feature detection with progressive enhancement

### Advanced Image Optimization
- **Responsive Images**: Different compressions for multiple resolutions
- **Lazy Loading Integration**: Compression optimization with progressive loading
- **Quality Adaptation**: Dynamic quality adjustment based on network conditions

## Platform-Specific Compression

### Android Compression Libraries
- **Built-in Compression**:
  - `GZIPOutputStream` with custom compression
  - `DeflaterOutputStream` with advanced compression options
- **Third-Party Solutions**:
  - LZ4 compression with high-speed compression
  - Snappy compression with CPU-efficient compression

### iOS Compression APIs
- **Compression Framework**:
  - `NSData` compression methods
  - Algorithm selection (LZFSE, LZ4, ZLIB)
  - Streaming compression with large data handling
- **Image Compression**:
  - `UIImage` compression quality settings
  - Core Graphics with custom compression logic

### Flutter Compression
- **dart:io Compression**:
  - GZipCodec with built-in gzip support
  - ZLibCodec with zlib compression
  - Custom codec implementation with specialized compression

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

## Real-Time Compression Strategies

### Adaptive Compression
- **Dynamic Compression Levels**:
  - Network speed-based adjustment
  - Device capability consideration
  - Battery level awareness
- **Content-Type Optimization**:
  - Text vs binary compression
  - Media-specific compression
  - Mixed content handling

### Progressive Compression
- **Multi-Stage Compression**:
  - Initial quick compression
  - Background optimization
  - Quality improvement over time
- **Streaming Compression**:
  - Real-time compression
  - Chunk-based processing
  - Memory-efficient implementation

## Performance Considerations

### Compression vs CPU Trade-offs
- **CPU Impact**: Compression/decompression processing overhead
- **Battery Drain**: Processing power with battery consumption
- **Memory Usage**: Compression buffers with memory management
- **Thermal Management**: Intensive compression with device heating

### Caching Compressed Data
- **Cache Storage**: Store compressed or uncompressed data
- **Decompression Caching**: Cache decompressed data for repeated access
- **Hybrid Caching**: Different strategies for different content types

## Monitoring & Analytics
- **Compression Effectiveness**: Size reduction ratios tracking
- **Performance Impact**: Load time improvements measurement
- **Error Rates**: Compression-related failures monitoring
- **User Experience Correlation**: Compression benefits with engagement metrics
