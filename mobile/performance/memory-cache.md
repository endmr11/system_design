# In-Memory Cache (Bellek Önbelleği)

## Memory Cache Fundamentals

### Temel Prensipler
- **Amaç**: En hızlı veri erişimi ile anında yanıt
- **Trade-offs**: Bellek kullanımı vs hız vs cache hit oranı
- **Mobil Kısıtlamalar**: Sınırlı RAM, arka plan uygulama askıya alma
- **Cache Boyut Optimizasyonu**: 
  - Kullanılabilir belleğe göre dinamik boyutlandırma
  - Bellek baskısı izleme
  - Uyarlanabilir cache limitleri
- **Cache Entry Türleri**:
  - Strong references: Sık erişilen öğeler
  - Soft references: Bellek baskısına duyarlı öğeler
  - Weak references: Geçici cache girdileri

## LRU (Least Recently Used) Cache Implementation

### Platform-Özel LRU Implementasyonları

#### Android LruCache
```kotlin
class ImageMemoryCache {
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = maxMemory / 8 // Toplam belleğin 1/8'i
    
    private val cache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            // Bitmap boyutunu KB cinsinden döndür
            return bitmap.byteCount / 1024
        }
        
        override fun entryRemoved(
            evicted: Boolean, 
            key: String, 
            oldValue: Bitmap, 
            newValue: Bitmap?
        ) {
            // Çıkarılan bitmap'i temizle
            if (evicted && !oldValue.isRecycled) {
                oldValue.recycle()
            }
        }
    }
    
    fun put(key: String, bitmap: Bitmap) {
        cache.put(key, bitmap)
    }
    
    fun get(key: String): Bitmap? {
        return cache.get(key)
    }
    
    fun evictAll() {
        cache.evictAll()
    }
    
    // Cache istatistikleri
    fun getCacheStats(): String {
        return "Hit: ${cache.hitCount()}, Miss: ${cache.missCount()}, Size: ${cache.size()}"
    }
}
```

#### iOS NSCache
```swift
class ImageMemoryCache {
    private let cache = NSCache<NSString, UIImage>()
    
    init() {
        // Toplam maliyet limiti (bytes)
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        // Maksimum obje sayısı
        cache.countLimit = 100
        
        // Bellek uyarılarını dinle
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(clearCache),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    func setImage(_ image: UIImage, forKey key: String) {
        let cost = image.jpegData(compressionQuality: 1.0)?.count ?? 0
        cache.setObject(image, forKey: key as NSString, cost: cost)
    }
    
    func image(forKey key: String) -> UIImage? {
        return cache.object(forKey: key as NSString)
    }
    
    @objc private func clearCache() {
        cache.removeAllObjects()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
```

#### Flutter Memory Cache
```dart
class MemoryCache<K, V> {
  final int _maxSize;
  final Map<K, _CacheEntry<V>> _cache = <K, _CacheEntry<V>>{};
  final Queue<K> _accessOrder = Queue<K>();
  
  MemoryCache(this._maxSize);
  
  V? get(K key) {
    final entry = _cache[key];
    if (entry != null) {
      // Access sırasını güncelle
      _accessOrder.remove(key);
      _accessOrder.addLast(key);
      return entry.value;
    }
    return null;
  }
  
  void put(K key, V value) {
    if (_cache.containsKey(key)) {
      // Mevcut girdiyi güncelle
      _cache[key] = _CacheEntry(value, DateTime.now());
      _accessOrder.remove(key);
      _accessOrder.addLast(key);
    } else {
      // Yeni girdi ekle
      if (_cache.length >= _maxSize) {
        _evictLeastRecentlyUsed();
      }
      _cache[key] = _CacheEntry(value, DateTime.now());
      _accessOrder.addLast(key);
    }
  }
  
  void _evictLeastRecentlyUsed() {
    if (_accessOrder.isNotEmpty) {
      final lruKey = _accessOrder.removeFirst();
      _cache.remove(lruKey);
    }
  }
  
  void clear() {
    _cache.clear();
    _accessOrder.clear();
  }
  
  int get length => _cache.length;
  bool get isEmpty => _cache.isEmpty;
}

class _CacheEntry<V> {
  final V value;
  final DateTime timestamp;
  
  _CacheEntry(this.value, this.timestamp);
}
```

### Gelişmiş LRU Stratejileri

#### Size-Based Eviction (Boyut Tabanlı Çıkarma)
```kotlin
class SizeAwareLruCache<K, V>(
    private val maxSize: Long,
    private val sizeCalculator: (V) -> Long
) {
    private val cache = LinkedHashMap<K, CacheEntry<V>>(16, 0.75f, true)
    private var currentSize = 0L
    
    data class CacheEntry<V>(
        val value: V,
        val size: Long,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    @Synchronized
    fun put(key: K, value: V) {
        val size = sizeCalculator(value)
        val entry = CacheEntry(value, size)
        
        // Önceki girdiyi kontrol et
        cache[key]?.let { oldEntry ->
            currentSize -= oldEntry.size
        }
        
        cache[key] = entry
        currentSize += size
        
        // Boyut limitini aş tıksa eski girdileri çıkar
        while (currentSize > maxSize && cache.isNotEmpty()) {
            val eldestEntry = cache.entries.first()
            cache.remove(eldestEntry.key)
            currentSize -= eldestEntry.value.size
        }
    }
    
    @Synchronized
    fun get(key: K): V? {
        return cache[key]?.value
    }
    
    fun getSize(): Long = currentSize
    fun getCount(): Int = cache.size
}
```

#### Access Pattern Learning (Erişim Kalıpları Öğrenimi)
```swift
class SmartCache<Key: Hashable, Value> {
    private var cache: [Key: CacheEntry<Value>] = [:]
    private let maxSize: Int
    private let queue = DispatchQueue(label: "smart.cache.queue", attributes: .concurrent)
    
    struct CacheEntry<Value> {
        let value: Value
        var accessCount: Int
        var lastAccess: Date
        var accessPattern: AccessPattern
    }
    
    struct AccessPattern {
        var hourlyAccess: [Int] = Array(repeating: 0, count: 24)
        var dayOfWeekAccess: [Int] = Array(repeating: 0, count: 7)
    }
    
    init(maxSize: Int) {
        self.maxSize = maxSize
    }
    
    func get(_ key: Key) -> Value? {
        return queue.sync {
            guard var entry = cache[key] else { return nil }
            
            // Erişim istatistiklerini güncelle
            entry.accessCount += 1
            entry.lastAccess = Date()
            updateAccessPattern(&entry.accessPattern)
            
            cache[key] = entry
            return entry.value
        }
    }
    
    func set(_ key: Key, value: Value) {
        queue.async(flags: .barrier) {
            if self.cache.count >= self.maxSize {
                self.evictLeastValuable()
            }
            
            let entry = CacheEntry(
                value: value,
                accessCount: 1,
                lastAccess: Date(),
                accessPattern: AccessPattern()
            )
            self.cache[key] = entry
        }
    }
    
    private func evictLeastValuable() {
        let now = Date()
        let currentHour = Calendar.current.component(.hour, from: now)
        let currentDay = Calendar.current.component(.weekday, from: now)
        
        let leastValuable = cache.min { entry1, entry2 in
            let score1 = calculateValue(entry1.value, at: currentHour, day: currentDay)
            let score2 = calculateValue(entry2.value, at: currentHour, day: currentDay)
            return score1 < score2
        }
        
        if let keyToRemove = leastValuable?.key {
            cache.removeValue(forKey: keyToRemove)
        }
    }
    
    private func calculateValue(_ entry: CacheEntry<Value>, at hour: Int, day: Int) -> Double {
        let timeFactor = 1.0 / (Date().timeIntervalSince(entry.lastAccess) + 1)
        let frequencyFactor = Double(entry.accessCount)
        let patternFactor = Double(entry.accessPattern.hourlyAccess[hour] + 
                                 entry.accessPattern.dayOfWeekAccess[day])
        
        return timeFactor * frequencyFactor * patternFactor
    }
    
    private func updateAccessPattern(_ pattern: inout AccessPattern) {
        let now = Date()
        let hour = Calendar.current.component(.hour, from: now)
        let day = Calendar.current.component(.weekday, from: now) - 1
        
        pattern.hourlyAccess[hour] += 1
        pattern.dayOfWeekAccess[day] += 1
    }
}
```

## Image Caching Solutions

### Android Image Caching

#### Glide Architecture
```kotlin
class OptimizedImageLoader(private val context: Context) {
    private val glide: RequestManager by lazy {
        Glide.with(context)
            .applyDefaultRequestOptions(
                RequestOptions()
                    .diskCacheStrategy(DiskCacheStrategy.AUTOMATIC)
                    .format(DecodeFormat.PREFER_RGB_565) // Bellek tasarrufu
                    .skipMemoryCache(false)
            )
    }
    
    fun loadImage(
        url: String,
        imageView: ImageView,
        placeholder: Int? = null,
        errorPlaceholder: Int? = null
    ) {
        var request = glide
            .load(url)
            .thumbnail(0.1f) // %10 boyutunda thumbnail
            .transition(DrawableTransitionOptions.withCrossFade())
        
        placeholder?.let { request = request.placeholder(it) }
        errorPlaceholder?.let { request = request.error(it) }
        
        request.into(imageView)
    }
    
    fun preloadImage(url: String, width: Int, height: Int) {
        glide
            .load(url)
            .override(width, height)
            .preload()
    }
    
    fun clearMemoryCache() {
        Glide.get(context).clearMemory()
    }
    
    fun clearDiskCache() {
        // Arka plan thread'de çalıştır
        Thread {
            Glide.get(context).clearDiskCache()
        }.start()
    }
    
    // Custom cache key generation
    fun loadImageWithCustomKey(
        url: String,
        imageView: ImageView,
        customKey: String
    ) {
        glide
            .load(url)
            .signature(ObjectKey(customKey))
            .into(imageView)
    }
}

// Custom memory cache configuration
class CustomGlideModule : AppGlideModule() {
    override fun applyOptions(context: Context, builder: GlideBuilder) {
        val calculator = MemorySizeCalculator.Builder(context)
            .setMemoryCacheScreens(2f) // 2 ekran boyutunda cache
            .setBitmapPoolScreens(3f)
            .build()
        
        builder
            .setMemoryCache(LruResourceCache(calculator.memoryCacheSize.toLong()))
            .setBitmapPool(LruBitmapPool(calculator.bitmapPoolSize.toLong()))
            .setDiskCache(
                InternalCacheDiskCacheFactory(
                    context,
                    "image_cache",
                    100 * 1024 * 1024 // 100MB
                )
            )
    }
}
```

#### Picasso Features
```kotlin
class PicassoImageLoader(private val context: Context) {
    private val picasso: Picasso by lazy {
        Picasso.Builder(context)
            .memoryCache(LruCache(calculateMemoryCacheSize()))
            .diskCache(createDiskCache())
            .indicatorsEnabled(BuildConfig.DEBUG) // Debug modda cache göstergeleri
            .build()
    }
    
    fun loadImage(
        url: String,
        imageView: ImageView,
        transformation: Transformation? = null
    ) {
        var request = picasso
            .load(url)
            .placeholder(R.drawable.placeholder)
            .error(R.drawable.error_placeholder)
        
        transformation?.let { request = request.transform(it) }
        
        request.into(imageView, object : Callback {
            override fun onSuccess() {
                // Başarılı yükleme
            }
            
            override fun onError(e: Exception?) {
                // Hata durumu
                logError("Image load failed: ${e?.message}")
            }
        })
    }
    
    private fun calculateMemoryCacheSize(): Int {
        val maxMemory = Runtime.getRuntime().maxMemory()
        return (maxMemory / 8).toInt() // Toplam belleğin 1/8'i
    }
    
    private fun createDiskCache(): Cache {
        val cacheDir = File(context.cacheDir, "picasso_cache")
        return Cache(cacheDir, 50 * 1024 * 1024) // 50MB
    }
    
    // Custom transformation example
    class CircleTransformation : Transformation {
        override fun transform(source: Bitmap): Bitmap {
            val size = minOf(source.width, source.height)
            val x = (source.width - size) / 2
            val y = (source.height - size) / 2
            
            val squaredBitmap = Bitmap.createBitmap(source, x, y, size, size)
            if (squaredBitmap != source) {
                source.recycle()
            }
            
            val bitmap = Bitmap.createBitmap(size, size, source.config)
            val canvas = Canvas(bitmap)
            val paint = Paint()
            val shader = BitmapShader(squaredBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
            paint.shader = shader
            paint.isAntiAlias = true
            
            val radius = size / 2f
            canvas.drawCircle(radius, radius, radius, paint)
            
            squaredBitmap.recycle()
            return bitmap
        }
        
        override fun key(): String = "circle()"
    }
}
```

### iOS Image Caching

#### SDWebImage
```swift
class SDWebImageManager {
    private let imageManager = SDWebImageManager.shared
    
    func loadImage(
        url: URL,
        into imageView: UIImageView,
        placeholder: UIImage? = nil,
        completion: ((UIImage?, Error?) -> Void)? = nil
    ) {
        imageView.sd_setImage(
            with: url,
            placeholderImage: placeholder,
            options: [.progressiveLoad, .retryFailed],
            progress: { receivedSize, expectedSize, targetURL in
                // Progress tracking
                let progress = Double(receivedSize) / Double(expectedSize)
                DispatchQueue.main.async {
                    // Update progress indicator
                }
            },
            completed: { image, error, cacheType, imageURL in
                completion?(image, error)
                
                if let error = error {
                    print("Image load failed: \(error.localizedDescription)")
                } else {
                    print("Image loaded from: \(cacheType)")
                }
            }
        )
    }
    
    func preloadImages(urls: [URL]) {
        let prefetcher = SDWebImagePrefetcher.shared
        prefetcher.prefetchURLs(urls) { completedCount, skippedCount in
            print("Preloaded: \(completedCount), Skipped: \(skippedCount)")
        }
    }
    
    func configureCache() {
        let cache = SDImageCache.shared
        
        // Memory cache configuration
        cache.config.maxMemoryCost = 50 * 1024 * 1024 // 50MB
        cache.config.maxMemoryCount = 100
        
        // Disk cache configuration
        cache.config.maxDiskAge = 7 * 24 * 60 * 60 // 7 days
        cache.config.maxDiskSize = 100 * 1024 * 1024 // 100MB
        
        // Background cache cleanup
        cache.config.shouldDecompressImages = true
        cache.config.shouldCacheImagesInMemory = true
    }
    
    func clearCache() {
        SDImageCache.shared.clearMemory()
        SDImageCache.shared.clearDisk()
    }
}
```

#### Kingfisher (Swift)
```swift
import Kingfisher
import SwiftUI

class KingfisherImageLoader: ObservableObject {
    func configureKingfisher() {
        let cache = ImageCache.default
        
        // Memory cache limits
        cache.memoryStorage.config.totalCostLimit = 50 * 1024 * 1024 // 50MB
        cache.memoryStorage.config.countLimit = 100
        
        // Disk cache limits
        cache.diskStorage.config.sizeLimit = 100 * 1024 * 1024 // 100MB
        cache.diskStorage.config.expiration = .days(7)
        
        // Network configuration
        KingfisherManager.shared.downloader.downloadTimeout = 15.0
    }
    
    func loadImage(
        url: URL,
        into imageView: UIImageView,
        placeholder: UIImage? = nil
    ) {
        let processor = DownsamplingImageProcessor(size: imageView.bounds.size)
        let options: KingfisherOptionsInfo = [
            .processor(processor),
            .scaleFactor(UIScreen.main.scale),
            .transition(.fade(1.0)),
            .cacheOriginalImage
        ]
        
        imageView.kf.setImage(
            with: url,
            placeholder: placeholder,
            options: options
        ) { result in
            switch result {
            case .success(let value):
                print("Image loaded: \(value.cacheType)")
            case .failure(let error):
                print("Image load failed: \(error.localizedDescription)")
            }
        }
    }
}

// SwiftUI integration
struct AsyncImageView: View {
    let url: URL
    let placeholder: Image
    
    var body: some View {
        KFImage(url)
            .placeholder {
                placeholder
                    .foregroundColor(.gray)
            }
            .retry(maxCount: 3, interval: .seconds(5))
            .onSuccess { result in
                print("Image loaded from: \(result.cacheType)")
            }
            .onFailure { error in
                print("Image load failed: \(error.localizedDescription)")
            }
            .resizable()
            .aspectRatio(contentMode: .fit)
    }
}
```

### Flutter Image Caching

#### cached_network_image Package
```dart
class FlutterImageCache {
  static const String _cacheKey = 'image_cache';
  
  Widget buildCachedImage({
    required String imageUrl,
    Widget? placeholder,
    Widget? errorWidget,
    BoxFit? fit,
    double? width,
    double? height,
  }) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, url) => placeholder ?? 
        const Center(child: CircularProgressIndicator()),
      errorWidget: (context, url, error) => errorWidget ?? 
        const Icon(Icons.error),
      memCacheWidth: width?.toInt(),
      memCacheHeight: height?.toInt(),
      cacheManager: DefaultCacheManager(),
      fadeInDuration: const Duration(milliseconds: 300),
      fadeOutDuration: const Duration(milliseconds: 300),
    );
  }
  
  // Custom cache manager
  static CacheManager get customCacheManager {
    return CacheManager(
      Config(
        _cacheKey,
        stalePeriod: const Duration(days: 7),
        maxNrOfCacheObjects: 100,
        repo: JsonCacheInfoRepository(databaseName: _cacheKey),
        fileService: HttpFileService(),
      ),
    );
  }
  
  // Preload images
  Future<void> preloadImages(List<String> imageUrls) async {
    for (String url in imageUrls) {
      try {
        await DefaultCacheManager().downloadFile(url);
      } catch (e) {
        debugPrint('Failed to preload image: $url, Error: $e');
      }
    }
  }
  
  // Clear cache
  Future<void> clearCache() async {
    await DefaultCacheManager().emptyCache();
  }
  
  // Get cache info
  Future<void> getCacheInfo() async {
    final cacheManager = DefaultCacheManager();
    final cacheObjects = await cacheManager.store.getAllObjects();
    
    int totalSize = 0;
    for (var obj in cacheObjects) {
      final file = await cacheManager.getFileFromCache(obj.key);
      if (file != null) {
        totalSize += await file.file.length();
      }
    }
    
    debugPrint('Cache objects: ${cacheObjects.length}');
    debugPrint('Total cache size: ${totalSize / (1024 * 1024)} MB');
  }
}

// Advanced image widget with custom caching
class AdvancedCachedImage extends StatefulWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  
  const AdvancedCachedImage({
    Key? key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  }) : super(key: key);
  
  @override
  _AdvancedCachedImageState createState() => _AdvancedCachedImageState();
}

class _AdvancedCachedImageState extends State<AdvancedCachedImage> {
  final MemoryCache<String, Uint8List> _memoryCache = MemoryCache<String, Uint8List>(50);
  
  @override
  Widget build(BuildContext context) {
    // First check memory cache
    final cachedData = _memoryCache.get(widget.imageUrl);
    if (cachedData != null) {
      return Image.memory(
        cachedData,
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
      );
    }
    
    return CachedNetworkImage(
      imageUrl: widget.imageUrl,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      imageBuilder: (context, imageProvider) {
        // Cache in memory for faster access
        _cacheImageInMemory(widget.imageUrl, imageProvider);
        return Image(
          image: imageProvider,
          width: widget.width,
          height: widget.height,
          fit: widget.fit,
        );
      },
      placeholder: (context, url) => Container(
        width: widget.width,
        height: widget.height,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      ),
      errorWidget: (context, url, error) => Container(
        width: widget.width,
        height: widget.height,
        color: Colors.grey[300],
        child: const Icon(Icons.error),
      ),
    );
  }
  
  void _cacheImageInMemory(String url, ImageProvider imageProvider) async {
    try {
      final completer = Completer<Uint8List>();
      final stream = imageProvider.resolve(const ImageConfiguration());
      
      stream.addListener(ImageStreamListener((ImageInfo info, bool _) async {
        final byteData = await info.image.toByteData(format: ImageByteFormat.png);
        if (byteData != null) {
          completer.complete(byteData.buffer.asUint8List());
        }
      }));
      
      final bytes = await completer.future;
      _memoryCache.put(url, bytes);
    } catch (e) {
      debugPrint('Failed to cache image in memory: $e');
    }
  }
}
```

## Memory Management Integration

### Garbage Collection Awareness

#### Android Memory Management
```kotlin
class MemoryAwareCache<K, V> {
    private val cache = ConcurrentHashMap<K, SoftReference<V>>()
    private val hardReferences = LinkedHashMap<K, V>(16, 0.75f, true)
    private val maxHardReferences: Int
    
    init {
        // Kullanılabilir belleğin %25'i kadar hard reference
        val runtime = Runtime.getRuntime()
        val maxMemory = runtime.maxMemory()
        maxHardReferences = (maxMemory / (4 * 1024)).toInt() // Rough estimation
        
        // Memory pressure listener
        registerMemoryPressureListener()
    }
    
    fun put(key: K, value: V) {
        // Hard reference cache'e ekle
        synchronized(hardReferences) {
            hardReferences[key] = value
            if (hardReferences.size > maxHardReferences) {
                val eldest = hardReferences.entries.first()
                hardReferences.remove(eldest.key)
            }
        }
        
        // Soft reference cache'e de ekle
        cache[key] = SoftReference(value)
    }
    
    fun get(key: K): V? {
        // Önce hard reference'larda ara
        synchronized(hardReferences) {
            hardReferences[key]?.let { value ->
                // LRU order'ı güncelle
                hardReferences.remove(key)
                hardReferences[key] = value
                return value
            }
        }
        
        // Sonra soft reference'larda ara
        val softRef = cache[key]
        val value = softRef?.get()
        
        if (value == null) {
            // Soft reference garbage collect edilmiş
            cache.remove(key)
        } else {
            // Hard reference cache'e geri ekle
            synchronized(hardReferences) {
                if (hardReferences.size < maxHardReferences) {
                    hardReferences[key] = value
                }
            }
        }
        
        return value
    }
    
    private fun registerMemoryPressureListener() {
        // ComponentCallbacks2 kullanarak memory pressure'ı dinle
        val context = /* get application context */
        context.registerComponentCallbacks(object : ComponentCallbacks2 {
            override fun onConfigurationChanged(newConfig: Configuration) {}
            
            override fun onLowMemory() {
                clearHardReferences()
            }
            
            override fun onTrimMemory(level: Int) {
                when (level) {
                    ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE -> {
                        // Bellek baskısı artıyor, cache'i küçült
                        trimCache(0.5f)
                    }
                    ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> {
                        // Yüksek bellek baskısı
                        trimCache(0.25f)
                    }
                    ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> {
                        // Kritik bellek durumu
                        clearHardReferences()
                    }
                }
            }
        })
    }
    
    private fun trimCache(retainFactor: Float) {
        synchronized(hardReferences) {
            val targetSize = (hardReferences.size * retainFactor).toInt()
            while (hardReferences.size > targetSize) {
                val eldest = hardReferences.entries.first()
                hardReferences.remove(eldest.key)
            }
        }
    }
    
    private fun clearHardReferences() {
        synchronized(hardReferences) {
            hardReferences.clear()
        }
    }
}
```

#### iOS Memory Management
```swift
class MemoryAwareCache<Key: Hashable, Value: AnyObject> {
    private var cache: [Key: Value] = [:]
    private let queue = DispatchQueue(label: "memory.cache.queue", attributes: .concurrent)
    private var memoryWarningObserver: NSObjectProtocol?
    
    init() {
        // Memory warning observer
        memoryWarningObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            self?.handleMemoryWarning()
        }
    }
    
    deinit {
        if let observer = memoryWarningObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    func set(_ value: Value, forKey key: Key) {
        queue.async(flags: .barrier) {
            self.cache[key] = value
            
            // Memory pressure check
            if self.cache.count > self.calculateOptimalCacheSize() {
                self.trimCache()
            }
        }
    }
    
    func object(forKey key: Key) -> Value? {
        return queue.sync {
            return cache[key]
        }
    }
    
    private func calculateOptimalCacheSize() -> Int {
        let info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let usedMemory = info.resident_size
            let totalMemory = ProcessInfo.processInfo.physicalMemory
            let memoryPressure = Double(usedMemory) / Double(totalMemory)
            
            // Bellek baskısına göre cache boyutunu ayarla
            let baseCacheSize = 100
            let adjustmentFactor = max(0.1, 1.0 - memoryPressure)
            return Int(Double(baseCacheSize) * adjustmentFactor)
        }
        
        return 50 // Default fallback
    }
    
    private func trimCache() {
        let targetSize = calculateOptimalCacheSize()
        let keysToRemove = cache.keys.prefix(cache.count - targetSize)
        
        for key in keysToRemove {
            cache.removeValue(forKey: key)
        }
    }
    
    private func handleMemoryWarning() {
        queue.async(flags: .barrier) {
            // Memory warning durumunda cache'in %75'ini temizle
            let targetSize = self.cache.count / 4
            let keysToRemove = self.cache.keys.prefix(self.cache.count - targetSize)
            
            for key in keysToRemove {
                self.cache.removeValue(forKey: key)
            }
        }
    }
    
    func removeAll() {
        queue.async(flags: .barrier) {
            self.cache.removeAll()
        }
    }
}
```

### Thread-Safe Cache Design

#### Concurrent Access Patterns
```kotlin
class ConcurrentLruCache<K, V>(
    private val maxSize: Int
) {
    private val cache = ConcurrentHashMap<K, CacheEntry<V>>()
    private val accessOrder = ConcurrentLinkedQueue<K>()
    private val lock = ReentrantReadWriteLock()
    private val readLock = lock.readLock()
    private val writeLock = lock.writeLock()
    
    data class CacheEntry<V>(
        val value: V,
        @Volatile var accessTime: Long = System.nanoTime()
    )
    
    fun get(key: K): V? {
        readLock.lock()
        try {
            val entry = cache[key] ?: return null
            
            // Access time'ı güncelle (write lock gerekmez, volatile)
            entry.accessTime = System.nanoTime()
            
            // Access order'ı güncelle
            updateAccessOrder(key)
            
            return entry.value
        } finally {
            readLock.unlock()
        }
    }
    
    fun put(key: K, value: V) {
        writeLock.lock()
        try {
            // Önce boyut kontrolü
            if (cache.size >= maxSize && !cache.containsKey(key)) {
                evictLeastRecentlyUsed()
            }
            
            val entry = CacheEntry(value)
            cache[key] = entry
            accessOrder.offer(key)
            
        } finally {
            writeLock.unlock()
        }
    }
    
    private fun updateAccessOrder(key: K) {
        // Non-blocking access order update
        accessOrder.remove(key)
        accessOrder.offer(key)
    }
    
    private fun evictLeastRecentlyUsed() {
        // En eski erişilen elemanı bul ve çıkar
        var oldestKey: K? = null
        var oldestTime = Long.MAX_VALUE
        
        for ((key, entry) in cache) {
            if (entry.accessTime < oldestTime) {
                oldestTime = entry.accessTime
                oldestKey = key
            }
        }
        
        oldestKey?.let { key ->
            cache.remove(key)
            accessOrder.remove(key)
        }
    }
    
    fun size(): Int {
        readLock.lock()
        try {
            return cache.size
        } finally {
            readLock.unlock()
        }
    }
    
    fun clear() {
        writeLock.lock()
        try {
            cache.clear()
            accessOrder.clear()
        } finally {
            writeLock.unlock()
        }
    }
}
```

## Performance Monitoring

### Cache Metrics Collection
```kotlin
class CacheMetrics {
    private val hitCount = AtomicLong(0)
    private val missCount = AtomicLong(0)
    private val putCount = AtomicLong(0)
    private val evictionCount = AtomicLong(0)
    
    fun recordHit() = hitCount.incrementAndGet()
    fun recordMiss() = missCount.incrementAndGet()
    fun recordPut() = putCount.incrementAndGet()
    fun recordEviction() = evictionCount.incrementAndGet()
    
    fun getHitRate(): Double {
        val totalRequests = hitCount.get() + missCount.get()
        return if (totalRequests == 0L) 0.0 else hitCount.get().toDouble() / totalRequests
    }
    
    fun getStats(): CacheStats {
        return CacheStats(
            hitCount = hitCount.get(),
            missCount = missCount.get(),
            putCount = putCount.get(),
            evictionCount = evictionCount.get(),
            hitRate = getHitRate()
        )
    }
    
    fun reset() {
        hitCount.set(0)
        missCount.set(0)
        putCount.set(0)
        evictionCount.set(0)
    }
}

data class CacheStats(
    val hitCount: Long,
    val missCount: Long,
    val putCount: Long,
    val evictionCount: Long,
    val hitRate: Double
)
```

Bu kapsamlı bellek cache implementasyonu, mobil uygulamalarda performans optimizasyonu için gerekli tüm temel bileşenleri içermektedir. Platform-özel optimizasyonlar ve gerçek dünya kullanım senaryoları göz önünde bulundurularak tasarlanmıştır.
