# Bellek Etkin UI Yönetimi

Mobil cihazlarda sınırlı bellek kaynaklarının verimli kullanılması, uygulamanın performansı ve kullanıcı deneyimi açısından kritik öneme sahiptir. Bu bölümde bellek sızıntılarını önleme, etkin bellek yönetimi ve optimize edilmiş veri yapıları ele alınacaktır.

## Bellek Yönetimi Temelleri

### Memory Leaks'i Önleme
```kotlin
// Android - WeakReference kullanarak memory leak'leri önleme
class MemoryEfficientActivity : AppCompatActivity() {
    private var asyncTask: WeakReference<BackgroundTask>? = null
    private lateinit var viewModel: MainViewModel
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // ViewModel kullanarak configuration changes'e karşı koruma
        viewModel = ViewModelProvider(this)[MainViewModel::class.java]
        
        // Weak reference ile task referansı
        val task = BackgroundTask(WeakReference(this))
        asyncTask = WeakReference(task)
        task.execute()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        
        // AsyncTask'i iptal et
        asyncTask?.get()?.cancel(true)
        asyncTask = null
        
        // Event listener'ları temizle
        EventBus.getDefault().unregister(this)
        
        // Bitmap'leri recycle et
        recycleBitmaps()
    }
    
    private fun recycleBitmaps() {
        // ImageView'lardaki bitmap'leri temizle
        findViewById<ImageView>(R.id.imageView)?.setImageDrawable(null)
        
        // Cache'deki bitmap'leri temizle
        Glide.get(this).clearMemory()
    }
}

// WeakReference ile güvenli callback
class BackgroundTask(
    private val activityRef: WeakReference<MemoryEfficientActivity>
) : AsyncTask<Void, Void, String>() {
    
    override fun doInBackground(vararg params: Void?): String {
        // Ağır işlem
        Thread.sleep(5000)
        return "Tamamlandı"
    }
    
    override fun onPostExecute(result: String?) {
        val activity = activityRef.get()
        if (activity != null && !activity.isDestroyed) {
            // UI güncelleme güvenli
            activity.updateUI(result)
        }
    }
}

// Memory-efficient ViewHolder pattern
class OptimizedViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
    private val titleView: TextView = itemView.findViewById(R.id.title)
    private val imageView: ImageView = itemView.findViewById(R.id.image)
    
    fun bind(item: DataItem) {
        titleView.text = item.title
        
        // Glide ile bellek etkin image loading
        Glide.with(itemView.context)
            .load(item.imageUrl)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .override(200, 200) // Boyut sınırla
            .centerCrop()
            .into(imageView)
    }
    
    fun recycle() {
        // ViewHolder yeniden kullanılırken temizlik
        Glide.with(itemView.context).clear(imageView)
        titleView.text = null
    }
}
```

### iOS Memory Management
```swift
// iOS - ARC ve weak references
class MemoryEfficientViewController: UIViewController {
    private weak var delegate: ViewControllerDelegate?
    private var observations: [NSKeyValueObservation] = []
    private var notificationTokens: [NSObjectProtocol] = []
    
    // Strong reference cycle'ları önlemek için weak self kullanımı
    private func setupNetworking() {
        NetworkManager.shared.fetchData { [weak self] result in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                self.handleNetworkResult(result)
            }
        }
    }
    
    // Timer ile memory leak'i önleme
    private func setupTimer() {
        let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateUI()
        }
        
        // View controller deallocate olduğunda timer'ı invalidate et
        timer.tolerance = 0.1
    }
    
    // KVO observations temizleme
    private func setupObservations() {
        let observation = observe(\.view.bounds) { [weak self] _, _ in
            self?.handleBoundsChange()
        }
        observations.append(observation)
    }
    
    // Notification observers temizleme
    private func setupNotifications() {
        let token = NotificationCenter.default.addObserver(
            forName: .UIApplicationDidEnterBackground,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleBackgroundTransition()
        }
        notificationTokens.append(token)
    }
    
    deinit {
        // Tüm observations'ı temizle
        observations.forEach { $0.invalidate() }
        observations.removeAll()
        
        // Notification observers'ı temizle
        notificationTokens.forEach {
            NotificationCenter.default.removeObserver($0)
        }
        notificationTokens.removeAll()
        
        print("ViewController successfully deallocated")
    }
}

// Memory-efficient image caching
class ImageCacheManager {
    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskCache: DiskCache
    
    init() {
        // Memory cache configuration
        memoryCache.countLimit = 50
        memoryCache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        
        // Disk cache setup
        diskCache = DiskCache(name: "ImageCache")
        
        // Memory warning'de cache'i temizle
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(clearMemoryCache),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    @objc private func clearMemoryCache() {
        memoryCache.removeAllObjects()
    }
    
    func loadImage(from url: URL, completion: @escaping (UIImage?) -> Void) {
        let key = url.absoluteString as NSString
        
        // Memory cache'de var mı kontrol et
        if let cachedImage = memoryCache.object(forKey: key) {
            completion(cachedImage)
            return
        }
        
        // Disk cache'de var mı kontrol et
        diskCache.object(forKey: url.absoluteString) { [weak self] image in
            if let image = image {
                self?.memoryCache.setObject(image, forKey: key)
                DispatchQueue.main.async {
                    completion(image)
                }
                return
            }
            
            // Network'ten yükle
            self?.downloadImage(from: url) { downloadedImage in
                if let image = downloadedImage {
                    self?.memoryCache.setObject(image, forKey: key)
                    self?.diskCache.setObject(image, forKey: url.absoluteString)
                }
                
                DispatchQueue.main.async {
                    completion(downloadedImage)
                }
            }
        }
    }
}
```

### Flutter Memory Optimization
```dart
// Flutter - Widget'ların efficient disposal'ı
class MemoryEfficientWidget extends StatefulWidget {
  @override
  _MemoryEfficientWidgetState createState() => _MemoryEfficientWidgetState();
}

class _MemoryEfficientWidgetState extends State<MemoryEfficientWidget> {
  StreamSubscription? _streamSubscription;
  Timer? _timer;
  AnimationController? _animationController;
  late ScrollController _scrollController;
  
  @override
  void initState() {
    super.initState();
    
    _scrollController = ScrollController();
    
    // Stream subscription
    _streamSubscription = DataStream.listen((data) {
      if (mounted) {
        setState(() {
          // Update UI
        });
      }
    });
    
    // Timer setup
    _timer = Timer.periodic(Duration(seconds: 1), (timer) {
      if (mounted) {
        updatePeriodicData();
      }
    });
    
    // Animation controller
    _animationController = AnimationController(
      duration: Duration(milliseconds: 300),
      vsync: this,
    );
  }
  
  @override
  void dispose() {
    // Stream subscription'ı iptal et
    _streamSubscription?.cancel();
    _streamSubscription = null;
    
    // Timer'ı iptal et
    _timer?.cancel();
    _timer = null;
    
    // Animation controller'ı dispose et
    _animationController?.dispose();
    _animationController = null;
    
    // Scroll controller'ı dispose et
    _scrollController.dispose();
    
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView.builder(
        controller: _scrollController,
        itemBuilder: (context, index) {
          // AutomaticKeepAliveClientMixin yerine manuel optimizasyon
          return MemoryEfficientListItem(
            key: ValueKey('item_$index'),
            data: items[index],
          );
        },
      ),
    );
  }
}

// Memory-efficient list item
class MemoryEfficientListItem extends StatelessWidget {
  final ItemData data;
  
  const MemoryEfficientListItem({
    Key? key,
    required this.data,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Card(
        child: ListTile(
          leading: OptimizedNetworkImage(
            url: data.imageUrl,
            width: 50,
            height: 50,
          ),
          title: Text(data.title),
          subtitle: Text(data.description),
        ),
      ),
    );
  }
}

// Memory-efficient image widget
class OptimizedNetworkImage extends StatefulWidget {
  final String url;
  final double width;
  final double height;
  
  const OptimizedNetworkImage({
    Key? key,
    required this.url,
    required this.width,
    required this.height,
  }) : super(key: key);
  
  @override
  _OptimizedNetworkImageState createState() => _OptimizedNetworkImageState();
}

class _OptimizedNetworkImageState extends State<OptimizedNetworkImage> {
  @override
  Widget build(BuildContext context) {
    return Image.network(
      widget.url,
      width: widget.width,
      height: widget.height,
      fit: BoxFit.cover,
      // Memory cache optimization
      cacheWidth: widget.width.toInt(),
      cacheHeight: widget.height.toInt(),
      // Error handling
      errorBuilder: (context, error, stackTrace) {
        return Container(
          width: widget.width,
          height: widget.height,
          color: Colors.grey[300],
          child: Icon(Icons.error),
        );
      },
      // Loading placeholder
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        
        return Container(
          width: widget.width,
          height: widget.height,
          child: CircularProgressIndicator(
            value: loadingProgress.expectedTotalBytes != null
                ? loadingProgress.cumulativeBytesLoaded /
                  loadingProgress.expectedTotalBytes!
                : null,
          ),
        );
      },
    );
  }
}
```

## Object Pooling ve Caching

### Object Pool Implementation
```javascript
// React Native - Object pooling pattern
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.usedObjects = new Set();
  }
  
  acquire() {
    let obj;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }
    
    this.usedObjects.add(obj);
    return obj;
  }
  
  release(obj) {
    if (!this.usedObjects.has(obj)) {
      return; // Already released or not from this pool
    }
    
    this.usedObjects.delete(obj);
    
    if (this.resetFn) {
      this.resetFn(obj);
    }
    
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }
  
  clear() {
    this.pool.length = 0;
    this.usedObjects.clear();
  }
  
  getStats() {
    return {
      poolSize: this.pool.length,
      usedCount: this.usedObjects.size,
      totalCreated: this.pool.length + this.usedObjects.size
    };
  }
}

// List item pool example
const ListItemPool = new ObjectPool(
  // Create function
  () => ({
    id: null,
    title: '',
    description: '',
    imageUrl: '',
    timestamp: null,
    metadata: {}
  }),
  // Reset function
  (obj) => {
    obj.id = null;
    obj.title = '';
    obj.description = '';
    obj.imageUrl = '';
    obj.timestamp = null;
    obj.metadata = {};
  },
  100 // Max pool size
);

// Usage in component
const OptimizedList = ({ data }) => {
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    // Process data with object pooling
    const processedItems = data.map(rawItem => {
      const item = ListItemPool.acquire();
      
      item.id = rawItem.id;
      item.title = rawItem.title;
      item.description = rawItem.description;
      item.imageUrl = rawItem.imageUrl;
      item.timestamp = new Date(rawItem.timestamp);
      item.metadata = { ...rawItem.metadata };
      
      return item;
    });
    
    setItems(processedItems);
    
    // Cleanup on unmount
    return () => {
      processedItems.forEach(item => {
        ListItemPool.release(item);
      });
    };
  }, [data]);
  
  return (
    <FlatList
      data={items}
      renderItem={({ item }) => <ListItem item={item} />}
      keyExtractor={item => item.id}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
    />
  );
};
```

### Memory-Efficient Caching
```kotlin
// Android - LRU Cache implementation
class MemoryEfficientCache<K, V> {
    private val cache: LruCache<K, V>
    private val maxMemory = Runtime.getRuntime().maxMemory()
    private val cacheSize = (maxMemory / 8).toInt() // 1/8 of available memory
    
    init {
        cache = object : LruCache<K, V>(cacheSize) {
            override fun sizeOf(key: K, value: V): Int {
                return when (value) {
                    is Bitmap -> value.byteCount
                    is String -> value.length * 2 // 2 bytes per char
                    is ByteArray -> value.size
                    else -> 1
                }
            }
            
            override fun entryRemoved(
                evicted: Boolean,
                key: K,
                oldValue: V,
                newValue: V?
            ) {
                // Cleanup removed entries
                if (oldValue is Bitmap && !oldValue.isRecycled) {
                    oldValue.recycle()
                }
            }
        }
    }
    
    fun put(key: K, value: V) {
        cache.put(key, value)
    }
    
    fun get(key: K): V? {
        return cache.get(key)
    }
    
    fun remove(key: K): V? {
        return cache.remove(key)
    }
    
    fun clear() {
        cache.evictAll()
    }
    
    fun getMemoryUsage(): CacheStats {
        return CacheStats(
            size = cache.size(),
            hitCount = cache.hitCount(),
            missCount = cache.missCount(),
            evictionCount = cache.evictionCount()
        )
    }
}

// Bitmap cache with memory pressure handling
class BitmapCache {
    private val memoryCache = MemoryEfficientCache<String, Bitmap>()
    private val diskCache = DiskLruCache.open(cacheDir, 1, 1, 50 * 1024 * 1024) // 50MB
    
    init {
        // Memory pressure listener
        registerComponentCallbacks(object : ComponentCallbacks2 {
            override fun onConfigurationChanged(newConfig: Configuration) {}
            
            override fun onLowMemory() {
                memoryCache.clear()
            }
            
            override fun onTrimMemory(level: Int) {
                when (level) {
                    ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
                    ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> {
                        memoryCache.clear()
                    }
                    ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> {
                        // Clear half of the cache
                        val currentSize = memoryCache.getMemoryUsage().size
                        for (i in 0 until currentSize / 2) {
                            // Remove oldest entries
                        }
                    }
                }
            }
        })
    }
    
    fun getBitmap(key: String): Bitmap? {
        // Try memory cache first
        memoryCache.get(key)?.let { return it }
        
        // Try disk cache
        return loadFromDiskCache(key)?.also { bitmap ->
            memoryCache.put(key, bitmap)
        }
    }
    
    fun putBitmap(key: String, bitmap: Bitmap) {
        memoryCache.put(key, bitmap)
        saveToDiskCache(key, bitmap)
    }
    
    private fun loadFromDiskCache(key: String): Bitmap? {
        return try {
            diskCache.get(key)?.getInputStream(0)?.use { inputStream ->
                BitmapFactory.decodeStream(inputStream)
            }
        } catch (e: IOException) {
            null
        }
    }
    
    private fun saveToDiskCache(key: String, bitmap: Bitmap) {
        try {
            diskCache.edit(key)?.let { editor ->
                editor.newOutputStream(0).use { outputStream ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 90, outputStream)
                }
                editor.commit()
            }
        } catch (e: IOException) {
            // Handle error
        }
    }
}

data class CacheStats(
    val size: Int,
    val hitCount: Long,
    val missCount: Long,
    val evictionCount: Long
) {
    val hitRate: Double get() = hitCount.toDouble() / (hitCount + missCount)
}
```

## Lazy Loading ve Virtual Lists

### Virtual List Implementation
```dart
// Flutter - Virtual scrolling implementation
class VirtualListView extends StatefulWidget {
  final List<dynamic> items;
  final double itemHeight;
  final Widget Function(BuildContext, int, dynamic) itemBuilder;
  
  const VirtualListView({
    Key? key,
    required this.items,
    required this.itemHeight,
    required this.itemBuilder,
  }) : super(key: key);
  
  @override
  _VirtualListViewState createState() => _VirtualListViewState();
}

class _VirtualListViewState extends State<VirtualListView> {
  late ScrollController _scrollController;
  int _startIndex = 0;
  int _endIndex = 0;
  double _viewportHeight = 0;
  
  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
  
  void _onScroll() {
    final scrollOffset = _scrollController.offset;
    final newStartIndex = (scrollOffset / widget.itemHeight).floor();
    final visibleItemCount = (_viewportHeight / widget.itemHeight).ceil() + 2; // Buffer
    final newEndIndex = (newStartIndex + visibleItemCount).clamp(0, widget.items.length);
    
    if (newStartIndex != _startIndex || newEndIndex != _endIndex) {
      setState(() {
        _startIndex = newStartIndex;
        _endIndex = newEndIndex;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _viewportHeight = constraints.maxHeight;
        _onScroll(); // Update indices
        
        final totalHeight = widget.items.length * widget.itemHeight;
        final topPadding = _startIndex * widget.itemHeight;
        final bottomPadding = totalHeight - (_endIndex * widget.itemHeight);
        
        return ListView.builder(
          controller: _scrollController,
          itemCount: _endIndex - _startIndex + 2, // +2 for padding items
          itemBuilder: (context, index) {
            if (index == 0) {
              return SizedBox(height: topPadding);
            } else if (index == _endIndex - _startIndex + 1) {
              return SizedBox(height: bottomPadding);
            } else {
              final actualIndex = _startIndex + index - 1;
              return SizedBox(
                height: widget.itemHeight,
                child: widget.itemBuilder(context, actualIndex, widget.items[actualIndex]),
              );
            }
          },
        );
      },
    );
  }
}

// Lazy loading data manager
class LazyDataManager<T> {
  final Future<List<T>> Function(int offset, int limit) _loadData;
  final List<T> _items = [];
  final Set<int> _loadingPages = {};
  final Map<int, List<T>> _pageCache = {};
  
  final int pageSize;
  bool _hasMore = true;
  
  LazyDataManager({
    required Future<List<T>> Function(int offset, int limit) loadData,
    this.pageSize = 20,
  }) : _loadData = loadData;
  
  List<T> get items => _items;
  bool get hasMore => _hasMore;
  
  Future<void> loadMore() async {
    if (!_hasMore || _loadingPages.isNotEmpty) return;
    
    final offset = _items.length;
    final pageIndex = offset ~/ pageSize;
    
    if (_pageCache.containsKey(pageIndex)) {
      _items.addAll(_pageCache[pageIndex]!);
      return;
    }
    
    _loadingPages.add(pageIndex);
    
    try {
      final newItems = await _loadData(offset, pageSize);
      
      if (newItems.length < pageSize) {
        _hasMore = false;
      }
      
      _pageCache[pageIndex] = newItems;
      _items.addAll(newItems);
      
      // Memory management: remove old pages
      if (_pageCache.length > 10) {
        final oldestPage = _pageCache.keys.first;
        _pageCache.remove(oldestPage);
      }
    } catch (error) {
      // Handle error
      print('Data loading error: $error');
    } finally {
      _loadingPages.remove(pageIndex);
    }
  }
  
  void reset() {
    _items.clear();
    _pageCache.clear();
    _loadingPages.clear();
    _hasMore = true;
  }
  
  T? getItem(int index) {
    if (index < _items.length) {
      return _items[index];
    }
    
    // Trigger lazy loading if near the end
    if (index >= _items.length - 5 && _hasMore) {
      loadMore();
    }
    
    return null;
  }
}
```

## Memory Profiling ve Debugging

### Memory Leak Detection
```swift
// iOS - Memory leak detection tools
class MemoryLeakDetector {
    private static var instances: [String: WeakObjectSet] = [:]
    
    static func track<T: AnyObject>(_ object: T, name: String? = nil) {
        let className = String(describing: type(of: object))
        let trackingName = name ?? className
        
        if instances[trackingName] == nil {
            instances[trackingName] = WeakObjectSet()
        }
        
        instances[trackingName]?.add(object)
    }
    
    static func printMemoryReport() {
        print("=== Memory Report ===")
        
        for (name, objectSet) in instances {
            let count = objectSet.count
            print("\(name): \(count) instances")
            
            if count > 100 {
                print("⚠️ Potential memory leak detected for \(name)")
            }
        }
        
        print("===================")
    }
    
    static func detectLeaks() -> [String] {
        var leaks: [String] = []
        
        for (name, objectSet) in instances {
            let count = objectSet.count
            
            // Heuristic: more than 100 instances might indicate a leak
            if count > 100 {
                leaks.append("\(name): \(count) instances")
            }
        }
        
        return leaks
    }
}

class WeakObjectSet {
    private var objects: [WeakBox] = []
    
    func add<T: AnyObject>(_ object: T) {
        // Clean up nil references first
        objects = objects.filter { $0.object != nil }
        
        objects.append(WeakBox(object))
    }
    
    var count: Int {
        // Clean up and return count
        objects = objects.filter { $0.object != nil }
        return objects.count
    }
}

private class WeakBox {
    weak var object: AnyObject?
    
    init(_ object: AnyObject) {
        self.object = object
    }
}

// Usage in ViewController
class MonitoredViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Track this instance
        MemoryLeakDetector.track(self)
        
        // Set up memory monitoring
        setupMemoryMonitoring()
    }
    
    private func setupMemoryMonitoring() {
        #if DEBUG
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            MemoryLeakDetector.printMemoryReport()
        }
        #endif
    }
}

// Memory usage monitoring
class MemoryMonitor {
    static func getCurrentMemoryUsage() -> MemoryUsage {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            let usedMemory = Double(info.resident_size)
            let totalMemory = Double(ProcessInfo.processInfo.physicalMemory)
            
            return MemoryUsage(
                used: usedMemory,
                total: totalMemory,
                percentUsed: (usedMemory / totalMemory) * 100
            )
        }
        
        return MemoryUsage(used: 0, total: 0, percentUsed: 0)
    }
    
    static func logMemoryUsage() {
        let usage = getCurrentMemoryUsage()
        let usedMB = usage.used / (1024 * 1024)
        let totalMB = usage.total / (1024 * 1024)
        
        print("Memory Usage: \(String(format: "%.1f", usedMB))MB / \(String(format: "%.0f", totalMB))MB (\(String(format: "%.1f", usage.percentUsed))%)")
        
        if usage.percentUsed > 80 {
            print("⚠️ High memory usage detected!")
        }
    }
}

struct MemoryUsage {
    let used: Double
    let total: Double
    let percentUsed: Double
}
```

### Automated Memory Testing
```kotlin
// Android - Automated memory testing
class MemoryTestSuite {
    
    @Test
    fun testMemoryLeakAfterActivityDestroy() {
        val activityRule = ActivityTestRule(MainActivity::class.java)
        val initialMemory = getMemoryUsage()
        
        // Create and destroy activity multiple times
        repeat(10) {
            val activity = activityRule.launchActivity(Intent())
            // Perform UI operations
            performUIOperations(activity)
            
            // Destroy activity
            activity.finish()
            waitForGC()
        }
        
        val finalMemory = getMemoryUsage()
        val memoryGrowth = finalMemory - initialMemory
        
        // Assert memory growth is within acceptable limits
        assert(memoryGrowth < ACCEPTABLE_MEMORY_GROWTH) {
            "Memory leak detected: grew by ${memoryGrowth}MB"
        }
    }
    
    @Test
    fun testRecyclerViewMemoryUsage() {
        val recyclerView = RecyclerView(context)
        val adapter = TestAdapter()
        
        recyclerView.adapter = adapter
        recyclerView.layoutManager = LinearLayoutManager(context)
        
        val initialMemory = getMemoryUsage()
        
        // Simulate scrolling with large dataset
        val largeDataset = generateLargeDataset(10000)
        adapter.updateData(largeDataset)
        
        // Simulate rapid scrolling
        repeat(100) {
            recyclerView.scrollBy(0, 100)
            Thread.sleep(10)
        }
        
        val peakMemory = getMemoryUsage()
        
        // Clear data and force GC
        adapter.updateData(emptyList())
        waitForGC()
        
        val finalMemory = getMemoryUsage()
        
        // Assert memory is properly released
        val retainedMemory = finalMemory - initialMemory
        assert(retainedMemory < MAX_RETAINED_MEMORY) {
            "RecyclerView retaining too much memory: ${retainedMemory}MB"
        }
    }
    
    private fun getMemoryUsage(): Long {
        val runtime = Runtime.getRuntime()
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
    }
    
    private fun waitForGC() {
        repeat(3) {
            System.gc()
            System.runFinalization()
            Thread.sleep(100)
        }
    }
    
    private fun performUIOperations(activity: Activity) {
        // Simulate user interactions
        activity.runOnUiThread {
            // Create views, load images, etc.
            repeat(50) {
                val imageView = ImageView(activity)
                val bitmap = Bitmap.createBitmap(100, 100, Bitmap.Config.ARGB_8888)
                imageView.setImageBitmap(bitmap)
                
                // Add to layout
                (activity.findViewById<ViewGroup>(android.R.id.content)).addView(imageView)
                
                // Remove immediately
                (activity.findViewById<ViewGroup>(android.R.id.content)).removeView(imageView)
                
                // Cleanup
                bitmap.recycle()
            }
        }
    }
    
    companion object {
        private const val ACCEPTABLE_MEMORY_GROWTH = 50L // MB
        private const val MAX_RETAINED_MEMORY = 10L // MB
    }
}

// Memory allocation tracker
class AllocationTracker {
    private val allocations = mutableMapOf<String, AllocationStats>()
    
    fun trackAllocation(objectType: String, size: Long) {
        val stats = allocations.getOrPut(objectType) {
            AllocationStats(objectType)
        }
        
        stats.totalAllocations++
        stats.totalSize += size
        stats.currentSize += size
    }
    
    fun trackDeallocation(objectType: String, size: Long) {
        allocations[objectType]?.let { stats ->
            stats.totalDeallocations++
            stats.currentSize -= size
        }
    }
    
    fun getReport(): String {
        val report = StringBuilder()
        report.appendLine("=== Allocation Report ===")
        
        for (stats in allocations.values.sortedByDescending { it.currentSize }) {
            report.appendLine(
                "${stats.objectType}: " +
                "Current: ${stats.currentSize / 1024}KB, " +
                "Allocated: ${stats.totalAllocations}, " +
                "Deallocated: ${stats.totalDeallocations}, " +
                "Leaked: ${stats.totalAllocations - stats.totalDeallocations}"
            )
        }
        
        return report.toString()
    }
}

data class AllocationStats(
    val objectType: String,
    var totalAllocations: Long = 0,
    var totalDeallocations: Long = 0,
    var totalSize: Long = 0,
    var currentSize: Long = 0
)
```

Bu bellek etkin UI yönetimi dokümantasyonu, mobil uygulamalarda memory leak'leri önleme, etkin caching stratejileri, object pooling, lazy loading ve memory profiling konularında kapsamlı rehberlik sağlamaktadır. Platform-specific implementasyonlar ve best practice'ler ile bellek optimizasyonu konusunda derinlemesine bilgi sunmaktadır.
