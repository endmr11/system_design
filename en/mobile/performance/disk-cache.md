# Disk Cache & HTTP Caching

Disk cache is a critical component in mobile applications for persistent data storage and reducing network traffic.

## Disk Cache Fundamentals

### Storage Strategies

```java
// Android - DiskLruCache Implementation
public class DiskCacheManager {
    private DiskLruCache diskCache;
    private static final int DISK_CACHE_SIZE = 1024 * 1024 * 10; // 10MB
    private static final int VALUE_COUNT = 1;
    
    public void initDiskCache() {
        File cacheDir = new File(context.getCacheDir(), "disk_cache");
        try {
            diskCache = DiskLruCache.open(cacheDir, 1, VALUE_COUNT, DISK_CACHE_SIZE);
        } catch (IOException e) {
            Log.e("Cache", "Disk cache initialization failed", e);
        }
    }
    
    public void put(String key, byte[] data) {
        try {
            DiskLruCache.Editor editor = diskCache.edit(key);
            if (editor != null) {
                OutputStream os = editor.newOutputStream(0);
                os.write(data);
                os.close();
                editor.commit();
            }
        } catch (IOException e) {
            Log.e("Cache", "Failed to write to disk cache", e);
        }
    }
    
    public byte[] get(String key) {
        try {
            DiskLruCache.Snapshot snapshot = diskCache.get(key);
            if (snapshot != null) {
                InputStream is = snapshot.getInputStream(0);
                return IOUtils.toByteArray(is);
            }
        } catch (IOException e) {
            Log.e("Cache", "Failed to read from disk cache", e);
        }
        return null;
    }
}
```

### iOS Disk Cache

```swift
class DiskCache {
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let maxCacheSize: Int
    
    init(maxSize: Int = 50 * 1024 * 1024) { // 50MB
        self.maxCacheSize = maxSize
        
        let urls = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)
        self.cacheDirectory = urls[0].appendingPathComponent("DiskCache")
        
        createCacheDirectoryIfNeeded()
    }
    
    func store(data: Data, forKey key: String) {
        let url = cacheDirectory.appendingPathComponent(key)
        do {
            try data.write(to: url)
            checkCacheSize()
        } catch {
            print("Failed to store data: \(error)")
        }
    }
    
    func retrieve(forKey key: String) -> Data? {
        let url = cacheDirectory.appendingPathComponent(key)
        return try? Data(contentsOf: url)
    }
    
    private func checkCacheSize() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else { return }
            
            let size = self.calculateCacheSize()
            if size > self.maxCacheSize {
                self.performCleanup()
            }
        }
    }
    
    private func performCleanup() {
        // LRU-based cleanup
        let files = try? fileManager.contentsOfDirectory(at: cacheDirectory,
                                                        includingPropertiesForKeys: [.contentModificationDateKey])
        
        let sortedFiles = files?.sorted { file1, file2 in
            let date1 = try? file1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
            let date2 = try? file2.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
            return date1 ?? Date.distantPast < date2 ?? Date.distantPast
        }
        
        // Delete oldest files
        let filesToDelete = sortedFiles?.prefix(sortedFiles!.count / 2)
        filesToDelete?.forEach { try? fileManager.removeItem(at: $0) }
    }
}
```

## HTTP Caching Strategies

### Cache Headers Management

```java
// Android - OkHttp HTTP Cache
public class HttpCacheInterceptor implements Interceptor {
    @Override
    public Response intercept(Chain chain) throws IOException {
        Request request = chain.request();
        
        // Offline status check
        if (!isNetworkAvailable()) {
            request = request.newBuilder()
                .cacheControl(new CacheControl.Builder()
                    .maxStale(7, TimeUnit.DAYS)
                    .build())
                .build();
        }
        
        Response response = chain.proceed(request);
        
        // Set cache headers for online status
        if (isNetworkAvailable()) {
            int maxAge = 60; // 1 minute
            response = response.newBuilder()
                .header("Cache-Control", "public, max-age=" + maxAge)
                .removeHeader("Pragma")
                .build();
        } else {
            int maxStale = 60 * 60 * 24 * 7; // 1 week
            response = response.newBuilder()
                .header("Cache-Control", "public, only-if-cached, max-stale=" + maxStale)
                .removeHeader("Pragma")
                .build();
        }
        
        return response;
    }
    
    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) 
            context.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
    }
}
```

### iOS URLSession Cache Management

```swift
class HTTPCacheManager {
    private let urlSession: URLSession
    
    init() {
        let configuration = URLSessionConfiguration.default
        
        // Cache configuration
        let cachesURL = FileManager.default.urls(for: .cachesDirectory, 
                                               in: .userDomainMask)[0]
        let diskCacheURL = cachesURL.appendingPathComponent("URLCache")
        
        let cache = URLCache(
            memoryCapacity: 20 * 1024 * 1024,  // 20MB memory
            diskCapacity: 100 * 1024 * 1024,   // 100MB disk
            diskPath: diskCacheURL.path
        )
        
        configuration.urlCache = cache
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        
        self.urlSession = URLSession(configuration: configuration)
    }
    
    func request(url: URL, cachePolicy: URLRequest.CachePolicy = .returnCacheDataElseLoad) -> URLRequest {
        var request = URLRequest(url: url)
        request.cachePolicy = cachePolicy
        
        // Custom cache headers
        if !NetworkReachability.isConnected {
            request.cachePolicy = .returnCacheDataDontLoad
        }
        
        return request
    }
    
    func clearCache() {
        urlSession.configuration.urlCache?.removeAllCachedResponses()
    }
    
    func getCacheSize() -> Int {
        return urlSession.configuration.urlCache?.currentDiskUsage ?? 0
    }
}
```

## Hybrid Cache Strategies

### Multi-Level Cache

```dart
// Flutter - Hybrid Cache
class HybridCache<T> {
  final Map<String, CacheEntry<T>> _memoryCache = {};
  final String _diskCachePath;
  final int _maxMemorySize;
  final int _maxDiskSize;
  
  HybridCache({
    required String diskCachePath,
    int maxMemorySize = 50,
    int maxDiskSize = 100 * 1024 * 1024, // 100MB
  }) : _diskCachePath = diskCachePath,
       _maxMemorySize = maxMemorySize,
       _maxDiskSize = maxDiskSize;
  
  Future<void> put(String key, T value, {Duration? ttl}) async {
    final entry = CacheEntry(
      value: value,
      timestamp: DateTime.now(),
      ttl: ttl,
    );
    
    // Add to memory cache
    _addToMemoryCache(key, entry);
    
    // Add to disk cache asynchronously
    await _addToDiskCache(key, entry);
  }
  
  Future<T?> get(String key) async {
    // Check memory cache first
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null && !memoryEntry.isExpired) {
      return memoryEntry.value;
    }
    
    // Check disk cache
    final diskEntry = await _getFromDiskCache(key);
    if (diskEntry != null && !diskEntry.isExpired) {
      // Re-add to memory cache (cache warming)
      _addToMemoryCache(key, diskEntry);
      return diskEntry.value;
    }
    
    return null;
  }
  
  void _addToMemoryCache(String key, CacheEntry<T> entry) {
    _memoryCache[key] = entry;
    
    // LRU eviction
    if (_memoryCache.length > _maxMemorySize) {
      final oldestKey = _memoryCache.keys.first;
      _memoryCache.remove(oldestKey);
    }
  }
  
  Future<void> _addToDiskCache(String key, CacheEntry<T> entry) async {
    try {
      final file = File('$_diskCachePath/$key.cache');
      await file.parent.create(recursive: true);
      
      final json = jsonEncode({
        'value': entry.value,
        'timestamp': entry.timestamp.millisecondsSinceEpoch,
        'ttl': entry.ttl?.inMilliseconds,
      });
      
      await file.writeAsString(json);
    } catch (e) {
      print('Disk cache write error: $e');
    }
  }
  
  Future<CacheEntry<T>?> _getFromDiskCache(String key) async {
    try {
      final file = File('$_diskCachePath/$key.cache');
      if (!await file.exists()) return null;
      
      final json = await file.readAsString();
      final data = jsonDecode(json);
      
      return CacheEntry<T>(
        value: data['value'] as T,
        timestamp: DateTime.fromMillisecondsSinceEpoch(data['timestamp']),
        ttl: data['ttl'] != null ? Duration(milliseconds: data['ttl']) : null,
      );
    } catch (e) {
      print('Disk cache read error: $e');
      return null;
    }
  }
}

class CacheEntry<T> {
  final T value;
  final DateTime timestamp;
  final Duration? ttl;
  
  CacheEntry({
    required this.value,
    required this.timestamp,
    this.ttl,
  });
  
  bool get isExpired {
    if (ttl == null) return false;
    return DateTime.now().difference(timestamp) > ttl!;
  }
}
```

## Cache Compression and Optimization

### Adaptive Compression

```java
// Android - Adaptive Image Cache
public class AdaptiveImageCache {
    private static final String TAG = "AdaptiveImageCache";
    private final LruCache<String, Bitmap> memoryCache;
    private final DiskLruCache diskCache;
    
    public AdaptiveImageCache(Context context) {
        // Use 12.5% of device RAM for memory cache
        int maxMemory = (int) (Runtime.getRuntime().maxMemory() / 1024);
        int cacheSize = maxMemory / 8;
        
        memoryCache = new LruCache<String, Bitmap>(cacheSize) {
            @Override
            protected int sizeOf(String key, Bitmap bitmap) {
                return bitmap.getByteCount() / 1024;
            }
        };
        
        // Disk cache
        File cacheDir = getDiskCacheDir(context, "images");
        try {
            diskCache = DiskLruCache.open(cacheDir, 1, 1, 50 * 1024 * 1024);
        } catch (IOException e) {
            throw new RuntimeException("Failed to initialize disk cache", e);
        }
    }
    
    public void putBitmap(String key, Bitmap bitmap) {
        // Memory cache
        if (getBitmapFromMemCache(key) == null) {
            memoryCache.put(key, bitmap);
        }
        
        // Disk cache - compressed format
        putBitmapToDisk(key, bitmap);
    }
    
    private void putBitmapToDisk(String key, Bitmap bitmap) {
        new AsyncTask<Void, Void, Void>() {
            @Override
            protected Void doInBackground(Void... params) {
                try {
                    DiskLruCache.Editor editor = diskCache.edit(key);
                    if (editor != null) {
                        OutputStream os = editor.newOutputStream(0);
                        
                        // Adaptive compression
                        Bitmap.CompressFormat format = getOptimalFormat(bitmap);
                        int quality = getOptimalQuality(bitmap);
                        
                        bitmap.compress(format, quality, os);
                        os.close();
                        editor.commit();
                    }
                } catch (IOException e) {
                    Log.e(TAG, "Error caching bitmap to disk", e);
                }
                return null;
            }
        }.execute();
    }
    
    private Bitmap.CompressFormat getOptimalFormat(Bitmap bitmap) {
        // PNG: For images requiring transparency
        // JPEG: For photos
        // WEBP: For modern Android versions
        
        if (bitmap.hasAlpha()) {
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH 
                ? Bitmap.CompressFormat.WEBP : Bitmap.CompressFormat.PNG;
        } else {
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH 
                ? Bitmap.CompressFormat.WEBP : Bitmap.CompressFormat.JPEG;
        }
    }
    
    private int getOptimalQuality(Bitmap bitmap) {
        // Balance between size and quality
        int pixels = bitmap.getWidth() * bitmap.getHeight();
        
        if (pixels > 2000000) return 70; // Large images
        if (pixels > 500000) return 80;  // Medium images
        return 90; // Small images
    }
}
```

## Cache Performance Metrics

### Analytics and Monitoring

```swift
class CacheAnalytics {
    private var hitCount = 0
    private var missCount = 0
    private var diskReadTime: [TimeInterval] = []
    private var memoryReadTime: [TimeInterval] = []
    
    func recordCacheHit(source: CacheSource, readTime: TimeInterval) {
        hitCount += 1
        
        switch source {
        case .memory:
            memoryReadTime.append(readTime)
        case .disk:
            diskReadTime.append(readTime)
        }
    }
    
    func recordCacheMiss() {
        missCount += 1
    }
    
    func getCacheEfficiency() -> CacheMetrics {
        let totalRequests = hitCount + missCount
        let hitRatio = totalRequests > 0 ? Double(hitCount) / Double(totalRequests) : 0
        
        let avgMemoryReadTime = memoryReadTime.isEmpty ? 0 : 
            memoryReadTime.reduce(0, +) / Double(memoryReadTime.count)
        
        let avgDiskReadTime = diskReadTime.isEmpty ? 0 : 
            diskReadTime.reduce(0, +) / Double(diskReadTime.count)
        
        return CacheMetrics(
            hitRatio: hitRatio,
            averageMemoryReadTime: avgMemoryReadTime,
            averageDiskReadTime: avgDiskReadTime,
            totalRequests: totalRequests
        )
    }
    
    func reset() {
        hitCount = 0
        missCount = 0
        diskReadTime.removeAll()
        memoryReadTime.removeAll()
    }
}

struct CacheMetrics {
    let hitRatio: Double
    let averageMemoryReadTime: TimeInterval
    let averageDiskReadTime: TimeInterval
    let totalRequests: Int
}

enum CacheSource {
    case memory
    case disk
}
```

## Best Practices

### Cache Size Management

1. **Memory Cache**: 10-15% of device RAM
2. **Disk Cache**: 50-200MB range
3. **TTL Strategy**: Different durations based on content type
4. **Compression**: Appropriate format and quality selection
5. **Analytics**: Track hit/miss ratios

### Platform-Specific Optimizations

- **Android**: DiskLruCache, Bitmap recycling
- **iOS**: NSCache automatic memory management
- **Flutter**: Platform channels with native cache integration
- **React Native**: AsyncStorage with SQLite hybrid approach

These strategies optimize disk cache performance in mobile applications and improve user experience.
