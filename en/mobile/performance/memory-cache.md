# Memory Cache & In-Memory Caching

In-memory caching is one of the most critical performance optimization techniques in mobile applications, providing fast data access while considering device resource constraints.

## Memory Cache Fundamentals

### Mobile Memory Constraints

Mobile devices have unique memory constraints that require special attention:

- **Limited RAM**: 2-8GB on average devices
- **Memory Pressure**: Operating system can terminate applications
- **Battery Impact**: Excessive memory usage drains battery
- **Shared Resources**: Memory shared with other applications

### Cache Size Calculation

```java
// Android - Optimal Cache Size Calculation
public class MemoryCacheManager {
    private static final float MEMORY_CACHE_PERCENTAGE = 0.125f; // 12.5% of available memory
    
    public static int calculateOptimalCacheSize() {
        final ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        final int memoryClass = am.getMemoryClass();
        
        // Convert to bytes and calculate cache size
        final int memoryClassBytes = memoryClass * 1024 * 1024;
        return Math.round(memoryClassBytes * MEMORY_CACHE_PERCENTAGE);
    }
}
```

## LRU Cache Implementation

### Android LruCache

```java
// Android - Advanced LruCache Implementation
public class AdvancedLruCache<K, V> extends LruCache<K, V> {
    private final Map<K, Long> accessTimes = new ConcurrentHashMap<>();
    private final Map<K, Integer> accessCounts = new ConcurrentHashMap<>();
    private final EvictionCallback<K, V> evictionCallback;
    
    public AdvancedLruCache(int maxSize, EvictionCallback<K, V> callback) {
        super(maxSize);
        this.evictionCallback = callback;
    }
    
    @Override
    public V get(K key) {
        V value = super.get(key);
        if (value != null) {
            recordAccess(key);
        }
        return value;
    }
    
    @Override
    public V put(K key, V value) {
        recordAccess(key);
        return super.put(key, value);
    }
    
    @Override
    protected void entryRemoved(boolean evicted, K key, V oldValue, V newValue) {
        super.entryRemoved(evicted, key, oldValue, newValue);
        
        if (evicted && evictionCallback != null) {
            evictionCallback.onEntryEvicted(key, oldValue);
        }
        
        // Cleanup tracking maps
        accessTimes.remove(key);
        accessCounts.remove(key);
    }
    
    private void recordAccess(K key) {
        long currentTime = System.currentTimeMillis();
        accessTimes.put(key, currentTime);
        accessCounts.merge(key, 1, Integer::sum);
    }
    
    public Map<K, AccessPattern> getAccessPatterns() {
        Map<K, AccessPattern> patterns = new HashMap<>();
        
        for (K key : accessTimes.keySet()) {
            Long lastAccess = accessTimes.get(key);
            Integer count = accessCounts.get(key);
            
            if (lastAccess != null && count != null) {
                patterns.put(key, new AccessPattern(lastAccess, count));
            }
        }
        
        return patterns;
    }
    
    public interface EvictionCallback<K, V> {
        void onEntryEvicted(K key, V value);
    }
    
    public static class AccessPattern {
        public final long lastAccessTime;
        public final int accessCount;
        
        public AccessPattern(long lastAccessTime, int accessCount) {
            this.lastAccessTime = lastAccessTime;
            this.accessCount = accessCount;
        }
        
        public boolean isFrequentlyAccessed() {
            return accessCount > 10; // Threshold can be adjusted
        }
        
        public boolean isRecentlyAccessed() {
            return System.currentTimeMillis() - lastAccessTime < 300000; // 5 minutes
        }
    }
}
```

### iOS NSCache Integration

```swift
// iOS - Smart NSCache with Memory Management
class SmartMemoryCache<Key: AnyObject, Value: AnyObject> where Key: NSCopying {
    private let cache = NSCache<Key, CacheWrapper<Value>>()
    private let accessQueue = DispatchQueue(label: "cache.access.queue", attributes: .concurrent)
    private var accessPatterns: [Key: AccessPattern] = [:]
    
    var totalCostLimit: Int {
        get { return cache.totalCostLimit }
        set { cache.totalCostLimit = newValue }
    }
    
    var countLimit: Int {
        get { return cache.countLimit }
        set { cache.countLimit = newValue }
    }
    
    init() {
        setupMemoryWarningObserver()
        configureCacheDefaults()
    }
    
    private func configureCacheDefaults() {
        // Set default limits based on device memory
        let physicalMemory = ProcessInfo.processInfo.physicalMemory
        let memoryCacheLimit = Int(Double(physicalMemory) * 0.1) // 10% of physical memory
        
        cache.totalCostLimit = memoryCacheLimit
        cache.countLimit = 100 // Default object count limit
        cache.delegate = self
    }
    
    func object(forKey key: Key) -> Value? {
        return accessQueue.sync { [weak self] in
            guard let wrapper = self?.cache.object(forKey: key) else {
                return nil
            }
            
            // Record access pattern
            self?.recordAccess(forKey: key)
            
            return wrapper.value
        }
    }
    
    func setObject(_ object: Value, forKey key: Key, cost: Int = 0) {
        accessQueue.async(flags: .barrier) { [weak self] in
            let wrapper = CacheWrapper(value: object, cost: cost)
            self?.cache.setObject(wrapper, forKey: key, cost: cost)
            self?.recordAccess(forKey: key)
        }
    }
    
    func removeObject(forKey key: Key) {
        accessQueue.async(flags: .barrier) { [weak self] in
            self?.cache.removeObject(forKey: key)
            self?.accessPatterns.removeValue(forKey: key)
        }
    }
    
    func removeAllObjects() {
        accessQueue.async(flags: .barrier) { [weak self] in
            self?.cache.removeAllObjects()
            self?.accessPatterns.removeAll()
        }
    }
    
    private func recordAccess(forKey key: Key) {
        let currentTime = Date()
        
        if let pattern = accessPatterns[key] {
            pattern.recordAccess(at: currentTime)
        } else {
            accessPatterns[key] = AccessPattern(firstAccess: currentTime)
        }
    }
    
    private func setupMemoryWarningObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    @objc private func handleMemoryWarning() {
        // Implement intelligent cleanup based on access patterns
        performIntelligentCleanup()
    }
    
    private func performIntelligentCleanup() {
        accessQueue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }
            
            let currentTime = Date()
            let keysToRemove: [Key] = self.accessPatterns.compactMap { (key, pattern) in
                // Remove items not accessed in the last 10 minutes
                if currentTime.timeIntervalSince(pattern.lastAccess) > 600 {
                    return key
                }
                return nil
            }
            
            for key in keysToRemove {
                self.cache.removeObject(forKey: key)
                self.accessPatterns.removeValue(forKey: key)
            }
        }
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

extension SmartMemoryCache: NSCacheDelegate {
    func cache(_ cache: NSCache<AnyObject, AnyObject>, willEvictObject obj: AnyObject) {
        // Handle eviction if needed
        print("Cache will evict object: \(obj)")
    }
}

private class CacheWrapper<T> {
    let value: T
    let cost: Int
    let creationTime = Date()
    
    init(value: T, cost: Int) {
        self.value = value
        self.cost = cost
    }
}

private class AccessPattern {
    private(set) var lastAccess: Date
    private(set) var accessCount: Int = 1
    private(set) var totalAccessTime: TimeInterval = 0
    
    init(firstAccess: Date) {
        self.lastAccess = firstAccess
    }
    
    func recordAccess(at time: Date) {
        totalAccessTime += time.timeIntervalSince(lastAccess)
        lastAccess = time
        accessCount += 1
    }
    
    var averageAccessInterval: TimeInterval {
        return accessCount > 1 ? totalAccessTime / Double(accessCount - 1) : 0
    }
}
```

## Advanced LRU Strategies

### Size-based Eviction

```dart
// Flutter - Advanced LRU with Size-based Eviction
class SizeAwareLRUCache<K, V> {
  final int maxSize;
  final int maxMemorySize;
  final Map<K, CacheEntry<V>> _cache = LinkedHashMap();
  final SizeCalculator<V> _sizeCalculator;
  int _currentMemoryUsage = 0;
  
  SizeAwareLRUCache({
    required this.maxSize,
    required this.maxMemorySize,
    required SizeCalculator<V> sizeCalculator,
  }) : _sizeCalculator = sizeCalculator;
  
  V? get(K key) {
    final entry = _cache.remove(key);
    if (entry == null) return null;
    
    // Move to end (most recently used)
    _cache[key] = entry;
    entry.recordAccess();
    
    return entry.value;
  }
  
  void put(K key, V value) {
    final size = _sizeCalculator.calculateSize(value);
    
    // Remove existing entry if present
    final existingEntry = _cache.remove(key);
    if (existingEntry != null) {
      _currentMemoryUsage -= existingEntry.size;
    }
    
    // Ensure there's space for the new entry
    _ensureSpace(size);
    
    // Add new entry
    final entry = CacheEntry(value: value, size: size);
    _cache[key] = entry;
    _currentMemoryUsage += size;
  }
  
  void _ensureSpace(int requiredSize) {
    // Remove entries until there's enough space
    while ((_cache.length >= maxSize || 
            _currentMemoryUsage + requiredSize > maxMemorySize) &&
           _cache.isNotEmpty) {
      _removeLRU();
    }
  }
  
  void _removeLRU() {
    if (_cache.isEmpty) return;
    
    final entry = _cache.entries.first;
    _cache.remove(entry.key);
    _currentMemoryUsage -= entry.value.size;
  }
  
  void clear() {
    _cache.clear();
    _currentMemoryUsage = 0;
  }
  
  CacheStats getStats() {
    final entries = _cache.values.toList();
    final totalAccesses = entries.fold(0, (sum, entry) => sum + entry.accessCount);
    final averageSize = entries.isEmpty ? 0 : _currentMemoryUsage ~/ entries.length;
    
    return CacheStats(
      entryCount: _cache.length,
      memoryUsage: _currentMemoryUsage,
      maxMemoryUsage: maxMemorySize,
      totalAccesses: totalAccesses,
      averageEntrySize: averageSize,
    );
  }
}

class CacheEntry<V> {
  final V value;
  final int size;
  final DateTime creationTime = DateTime.now();
  DateTime lastAccessTime = DateTime.now();
  int accessCount = 0;
  
  CacheEntry({required this.value, required this.size});
  
  void recordAccess() {
    lastAccessTime = DateTime.now();
    accessCount++;
  }
  
  Duration get age => DateTime.now().difference(creationTime);
  Duration get timeSinceLastAccess => DateTime.now().difference(lastAccessTime);
}

abstract class SizeCalculator<T> {
  int calculateSize(T object);
}

class StringSizeCalculator implements SizeCalculator<String> {
  @override
  int calculateSize(String object) {
    return object.length * 2; // Approximate size in bytes (UTF-16)
  }
}

class ImageSizeCalculator implements SizeCalculator<ui.Image> {
  @override
  int calculateSize(ui.Image object) {
    return object.width * object.height * 4; // RGBA bytes
  }
}

class CacheStats {
  final int entryCount;
  final int memoryUsage;
  final int maxMemoryUsage;
  final int totalAccesses;
  final int averageEntrySize;
  
  CacheStats({
    required this.entryCount,
    required this.memoryUsage,
    required this.maxMemoryUsage,
    required this.totalAccesses,
    required this.averageEntrySize,
  });
  
  double get memoryUsagePercentage => 
      maxMemoryUsage > 0 ? (memoryUsage / maxMemoryUsage) * 100 : 0;
  
  double get averageAccessesPerEntry => 
      entryCount > 0 ? totalAccesses / entryCount : 0;
}
```

## Image Caching Solutions

### Android Image Cache with Glide

```java
// Android - Custom Glide Image Cache
public class SmartImageCache {
    private final GlideRequests glideRequests;
    private final Map<String, ImageMetrics> imageMetrics = new ConcurrentHashMap<>();
    
    public SmartImageCache(Context context) {
        this.glideRequests = GlideApp.with(context);
    }
    
    public void loadImage(String url, ImageView imageView, ImageLoadCallback callback) {
        recordImageRequest(url);
        
        glideRequests
            .load(url)
            .transform(new SmartTransformation())
            .listener(new RequestListener<Drawable>() {
                @Override
                public boolean onLoadFailed(@Nullable GlideException e, Object model, 
                                          Target<Drawable> target, boolean isFirstResource) {
                    recordImageFailure(url, e);
                    callback.onError(e);
                    return false;
                }
                
                @Override
                public boolean onResourceReady(Drawable resource, Object model, 
                                             Target<Drawable> target, DataSource dataSource, 
                                             boolean isFirstResource) {
                    recordImageSuccess(url, dataSource);
                    callback.onSuccess(resource);
                    return false;
                }
            })
            .into(imageView);
    }
    
    private void recordImageRequest(String url) {
        imageMetrics.computeIfAbsent(url, k -> new ImageMetrics(url)).recordRequest();
    }
    
    private void recordImageSuccess(String url, DataSource dataSource) {
        ImageMetrics metrics = imageMetrics.get(url);
        if (metrics != null) {
            metrics.recordSuccess(dataSource);
        }
    }
    
    private void recordImageFailure(String url, Exception error) {
        ImageMetrics metrics = imageMetrics.get(url);
        if (metrics != null) {
            metrics.recordFailure(error);
        }
    }
    
    public ImageCacheStats getCacheStats() {
        int totalRequests = 0;
        int cacheHits = 0;
        int failures = 0;
        
        for (ImageMetrics metrics : imageMetrics.values()) {
            totalRequests += metrics.getTotalRequests();
            cacheHits += metrics.getCacheHits();
            failures += metrics.getFailures();
        }
        
        return new ImageCacheStats(totalRequests, cacheHits, failures);
    }
    
    private static class SmartTransformation extends BitmapTransformation {
        @Override
        protected Bitmap transform(@NonNull BitmapPool pool, @NonNull Bitmap toTransform, 
                                 int outWidth, int outHeight) {
            // Intelligent image resizing based on view size and device density
            float scale = Math.min(
                (float) outWidth / toTransform.getWidth(),
                (float) outHeight / toTransform.getHeight()
            );
            
            if (scale < 1.0f) {
                Matrix matrix = new Matrix();
                matrix.setScale(scale, scale);
                
                return Bitmap.createBitmap(toTransform, 0, 0, 
                    toTransform.getWidth(), toTransform.getHeight(), matrix, true);
            }
            
            return toTransform;
        }
        
        @Override
        public void updateDiskCacheKey(@NonNull MessageDigest messageDigest) {
            messageDigest.update("smart_transformation".getBytes());
        }
    }
    
    public interface ImageLoadCallback {
        void onSuccess(Drawable drawable);
        void onError(Exception error);
    }
}

class ImageMetrics {
    private final String url;
    private int totalRequests = 0;
    private int cacheHits = 0;
    private int failures = 0;
    private long totalLoadTime = 0;
    
    public ImageMetrics(String url) {
        this.url = url;
    }
    
    public void recordRequest() {
        totalRequests++;
    }
    
    public void recordSuccess(DataSource dataSource) {
        if (dataSource == DataSource.MEMORY_CACHE || dataSource == DataSource.DISK_CACHE) {
            cacheHits++;
        }
    }
    
    public void recordFailure(Exception error) {
        failures++;
    }
    
    // Getters
    public int getTotalRequests() { return totalRequests; }
    public int getCacheHits() { return cacheHits; }
    public int getFailures() { return failures; }
}

class ImageCacheStats {
    private final int totalRequests;
    private final int cacheHits;
    private final int failures;
    
    public ImageCacheStats(int totalRequests, int cacheHits, int failures) {
        this.totalRequests = totalRequests;
        this.cacheHits = cacheHits;
        this.failures = failures;
    }
    
    public double getCacheHitRatio() {
        return totalRequests > 0 ? (double) cacheHits / totalRequests : 0;
    }
    
    public double getFailureRatio() {
        return totalRequests > 0 ? (double) failures / totalRequests : 0;
    }
}
```

### iOS Image Cache with Kingfisher

```swift
// iOS - Advanced Kingfisher Image Cache
class SmartImageCacheManager {
    private let imageCache: ImageCache
    private let downloader: ImageDownloader
    private var imageMetrics: [String: ImageMetrics] = [:]
    private let metricsQueue = DispatchQueue(label: "image.metrics.queue")
    
    init() {
        // Configure cache
        imageCache = ImageCache(name: "SmartImageCache")
        imageCache.memoryStorage.config.totalCostLimit = 100 * 1024 * 1024 // 100MB
        imageCache.diskStorage.config.sizeLimit = 500 * 1024 * 1024 // 500MB
        
        // Configure downloader
        downloader = ImageDownloader(name: "SmartImageDownloader")
        downloader.downloadTimeout = 30.0
        
        setupCacheEventHandlers()
    }
    
    func loadImage(from url: URL, 
                   into imageView: UIImageView,
                   completion: @escaping (Result<RetrieveImageResult, KingfisherError>) -> Void) {
        
        recordImageRequest(for: url.absoluteString)
        
        let options: KingfisherOptionsInfo = [
            .targetCache(imageCache),
            .downloader(downloader),
            .processor(SmartImageProcessor()),
            .cacheSerializer(SmartCacheSerializer()),
            .backgroundDecode
        ]
        
        imageView.kf.setImage(
            with: url,
            options: options
        ) { [weak self] result in
            self?.handleImageResult(result, for: url.absoluteString)
            completion(result)
        }
    }
    
    private func setupCacheEventHandlers() {
        // Monitor cache events
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    @objc private func handleMemoryWarning() {
        // Clear memory cache on memory pressure
        imageCache.clearMemoryCache()
        
        // Optionally, clear old disk cache entries
        imageCache.cleanExpiredDiskCache()
    }
    
    private func recordImageRequest(for url: String) {
        metricsQueue.async { [weak self] in
            if self?.imageMetrics[url] == nil {
                self?.imageMetrics[url] = ImageMetrics(url: url)
            }
            self?.imageMetrics[url]?.recordRequest()
        }
    }
    
    private func handleImageResult(_ result: Result<RetrieveImageResult, KingfisherError>, 
                                   for url: String) {
        metricsQueue.async { [weak self] in
            guard let metrics = self?.imageMetrics[url] else { return }
            
            switch result {
            case .success(let imageResult):
                metrics.recordSuccess(cacheType: imageResult.cacheType)
            case .failure(let error):
                metrics.recordFailure(error: error)
            }
        }
    }
    
    func getCacheStatistics() -> ImageCacheStatistics {
        return metricsQueue.sync {
            let totalRequests = imageMetrics.values.reduce(0) { $0 + $1.totalRequests }
            let cacheHits = imageMetrics.values.reduce(0) { $0 + $1.cacheHits }
            let failures = imageMetrics.values.reduce(0) { $0 + $1.failures }
            
            let memorySize = imageCache.memoryStorage.totalCost
            let diskSize = try? imageCache.diskStorage.totalSize() ?? 0
            
            return ImageCacheStatistics(
                totalRequests: totalRequests,
                cacheHits: cacheHits,
                failures: failures,
                memoryCacheSize: memorySize,
                diskCacheSize: diskSize ?? 0
            )
        }
    }
    
    func clearCache() {
        imageCache.clearCache()
        metricsQueue.async { [weak self] in
            self?.imageMetrics.removeAll()
        }
    }
}

struct SmartImageProcessor: ImageProcessor {
    let identifier = "SmartImageProcessor"
    
    func process(item: ImageProcessItem, options: KingfisherParsedOptionsInfo) -> KFCrossPlatformImage? {
        switch item {
        case .image(let image):
            return processImage(image)
        case .data(let data):
            guard let image = KingfisherWrapper.image(data: data, options: options.imageCreatingOptions) else {
                return nil
            }
            return processImage(image)
        }
    }
    
    private func processImage(_ image: KFCrossPlatformImage) -> KFCrossPlatformImage {
        // Intelligent image processing based on device capabilities
        let screenScale = UIScreen.main.scale
        let maxDimension = max(UIScreen.main.bounds.width, UIScreen.main.bounds.height) * screenScale
        
        let imageSize = image.size
        let maxImageDimension = max(imageSize.width, imageSize.height)
        
        if maxImageDimension > maxDimension {
            let scale = maxDimension / maxImageDimension
            let newSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
            
            return image.kf.resize(to: newSize, for: .aspectFit)
        }
        
        return image
    }
}

struct SmartCacheSerializer: CacheSerializer {
    func data(with image: KFCrossPlatformImage, original: Data?) -> Data? {
        // Smart compression based on image characteristics
        if let originalData = original, originalData.count < 50 * 1024 { // < 50KB
            return originalData // Keep small images as-is
        }
        
        // Use appropriate compression for larger images
        return image.kf.jpegRepresentation(compressionQuality: 0.8)
    }
    
    func image(with data: Data, options: KingfisherParsedOptionsInfo) -> KFCrossPlatformImage? {
        return KingfisherWrapper.image(data: data, options: options.imageCreatingOptions)
    }
}

class ImageMetrics {
    let url: String
    private(set) var totalRequests = 0
    private(set) var cacheHits = 0
    private(set) var failures = 0
    private(set) var lastRequestTime = Date()
    
    init(url: String) {
        self.url = url
    }
    
    func recordRequest() {
        totalRequests += 1
        lastRequestTime = Date()
    }
    
    func recordSuccess(cacheType: CacheType) {
        if cacheType == .memory || cacheType == .disk {
            cacheHits += 1
        }
    }
    
    func recordFailure(error: KingfisherError) {
        failures += 1
    }
}

struct ImageCacheStatistics {
    let totalRequests: Int
    let cacheHits: Int
    let failures: Int
    let memoryCacheSize: Int
    let diskCacheSize: UInt
    
    var cacheHitRatio: Double {
        return totalRequests > 0 ? Double(cacheHits) / Double(totalRequests) : 0
    }
    
    var failureRatio: Double {
        return totalRequests > 0 ? Double(failures) / Double(totalRequests) : 0
    }
}
```

## Performance Monitoring

### Cache Analytics

```dart
// Flutter - Comprehensive Cache Analytics
class CacheAnalyticsManager {
  static final Map<String, CacheMetrics> _cacheMetrics = {};
  static final List<CacheEvent> _events = [];
  static Timer? _reportingTimer;
  
  static void initialize() {
    _reportingTimer = Timer.periodic(const Duration(minutes: 5), (timer) {
      _generatePerformanceReport();
    });
  }
  
  static void recordCacheHit(String cacheType, String key, int sizeBytes) {
    final metrics = _getCacheMetrics(cacheType);
    metrics.recordHit(sizeBytes);
    
    _addEvent(CacheEvent(
      type: CacheEventType.hit,
      cacheType: cacheType,
      key: key,
      sizeBytes: sizeBytes,
      timestamp: DateTime.now(),
    ));
  }
  
  static void recordCacheMiss(String cacheType, String key) {
    final metrics = _getCacheMetrics(cacheType);
    metrics.recordMiss();
    
    _addEvent(CacheEvent(
      type: CacheEventType.miss,
      cacheType: cacheType,
      key: key,
      timestamp: DateTime.now(),
    ));
  }
  
  static void recordCacheEviction(String cacheType, String key, int sizeBytes, String reason) {
    final metrics = _getCacheMetrics(cacheType);
    metrics.recordEviction(sizeBytes);
    
    _addEvent(CacheEvent(
      type: CacheEventType.eviction,
      cacheType: cacheType,
      key: key,
      sizeBytes: sizeBytes,
      timestamp: DateTime.now(),
      metadata: {'reason': reason},
    ));
  }
  
  static CacheMetrics _getCacheMetrics(String cacheType) {
    return _cacheMetrics.putIfAbsent(cacheType, () => CacheMetrics(cacheType));
  }
  
  static void _addEvent(CacheEvent event) {
    _events.add(event);
    
    // Keep only recent events (last 1000)
    if (_events.length > 1000) {
      _events.removeAt(0);
    }
  }
  
  static Map<String, dynamic> _generatePerformanceReport() {
    final report = {
      'timestamp': DateTime.now().toIso8601String(),
      'cache_types': _cacheMetrics.map((type, metrics) => MapEntry(type, {
        'hit_ratio': metrics.hitRatio,
        'total_requests': metrics.totalRequests,
        'total_size_mb': metrics.totalSizeBytes / (1024 * 1024),
        'average_object_size_kb': metrics.averageObjectSize / 1024,
        'eviction_rate': metrics.evictionRate,
      })),
      'recent_events': _events.takeLast(100).map((e) => e.toMap()).toList(),
      'performance_summary': {
        'overall_hit_ratio': _calculateOverallHitRatio(),
        'memory_efficiency': _calculateMemoryEfficiency(),
        'cache_health_score': _calculateHealthScore(),
      },
    };
    
    print('Cache Performance Report: $report');
    return report;
  }
  
  static double _calculateOverallHitRatio() {
    int totalHits = 0;
    int totalRequests = 0;
    
    for (final metrics in _cacheMetrics.values) {
      totalHits += metrics.hits;
      totalRequests += metrics.totalRequests;
    }
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }
  
  static double _calculateMemoryEfficiency() {
    // Calculate bytes saved through caching
    int totalCachedBytes = 0;
    int totalHits = 0;
    
    for (final metrics in _cacheMetrics.values) {
      totalCachedBytes += metrics.totalSizeBytes;
      totalHits += metrics.hits;
    }
    
    return totalHits > 0 ? totalCachedBytes / totalHits : 0;
  }
  
  static double _calculateHealthScore() {
    final hitRatio = _calculateOverallHitRatio();
    final evictionRate = _calculateOverallEvictionRate();
    
    // Health score: high hit ratio and low eviction rate = good
    return (hitRatio * 0.7) + ((1 - evictionRate) * 0.3);
  }
  
  static double _calculateOverallEvictionRate() {
    int totalEvictions = 0;
    int totalRequests = 0;
    
    for (final metrics in _cacheMetrics.values) {
      totalEvictions += metrics.evictions;
      totalRequests += metrics.totalRequests;
    }
    
    return totalRequests > 0 ? totalEvictions / totalRequests : 0;
  }
  
  static void dispose() {
    _reportingTimer?.cancel();
    _cacheMetrics.clear();
    _events.clear();
  }
}

class CacheMetrics {
  final String cacheType;
  int hits = 0;
  int misses = 0;
  int evictions = 0;
  int totalSizeBytes = 0;
  final List<int> objectSizes = [];
  
  CacheMetrics(this.cacheType);
  
  void recordHit(int sizeBytes) {
    hits++;
    if (!objectSizes.contains(sizeBytes)) {
      objectSizes.add(sizeBytes);
      totalSizeBytes += sizeBytes;
    }
  }
  
  void recordMiss() {
    misses++;
  }
  
  void recordEviction(int sizeBytes) {
    evictions++;
    totalSizeBytes -= sizeBytes;
    objectSizes.remove(sizeBytes);
  }
  
  int get totalRequests => hits + misses;
  double get hitRatio => totalRequests > 0 ? hits / totalRequests : 0;
  double get evictionRate => totalRequests > 0 ? evictions / totalRequests : 0;
  double get averageObjectSize => objectSizes.isNotEmpty 
      ? objectSizes.reduce((a, b) => a + b) / objectSizes.length 
      : 0;
}

class CacheEvent {
  final CacheEventType type;
  final String cacheType;
  final String key;
  final int? sizeBytes;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;
  
  CacheEvent({
    required this.type,
    required this.cacheType,
    required this.key,
    this.sizeBytes,
    required this.timestamp,
    this.metadata,
  });
  
  Map<String, dynamic> toMap() {
    return {
      'type': type.toString(),
      'cache_type': cacheType,
      'key': key,
      'size_bytes': sizeBytes,
      'timestamp': timestamp.toIso8601String(),
      'metadata': metadata,
    };
  }
}

enum CacheEventType {
  hit,
  miss,
  eviction,
  cleanup,
}
```

## Best Practices

### Memory Management Integration

1. **Garbage Collection Awareness**: Monitor GC events and adapt cache size
2. **Memory Pressure Handling**: Implement proactive cleanup on memory warnings
3. **Lifecycle Integration**: Clear caches appropriately during app lifecycle events
4. **Thread Safety**: Use concurrent data structures and proper synchronization
5. **Metrics Collection**: Track hit ratios, memory usage, and performance metrics

### Platform-Specific Optimizations

- **Android**: Use LruCache, monitor memory class, handle configuration changes
- **iOS**: Leverage NSCache automatic management, respond to memory warnings
- **Flutter**: Implement custom solutions with platform channel optimizations
- **React Native**: Combine native caching with JavaScript bridge efficiency

This comprehensive memory caching strategy ensures optimal performance while maintaining memory efficiency across all mobile platforms.
