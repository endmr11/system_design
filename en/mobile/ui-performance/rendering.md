# Rendering Optimization

Modern mobile applications require high performance rendering to provide smooth user experience. This section covers rendering optimization techniques, GPU acceleration strategies, and platform-specific implementation approaches.

## Lazy Loading Strategies

### Image Lazy Loading
```kotlin
// Android - Efficient image lazy loading with Glide
class LazyImageLoader {
    private val glide = Glide.with(context)
    private val imageCache = LruCache<String, Bitmap>(50)
    
    fun loadImageLazy(
        imageView: ImageView,
        url: String,
        placeholder: Int = R.drawable.placeholder
    ) {
        // Set placeholder immediately
        imageView.setImageResource(placeholder)
        
        // Check memory cache first
        imageCache.get(url)?.let { cachedBitmap ->
            imageView.setImageBitmap(cachedBitmap)
            return
        }
        
        // Use Glide for lazy loading
        glide
            .load(url)
            .placeholder(placeholder)
            .error(R.drawable.error_image)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .override(imageView.width, imageView.height)
            .listener(object : RequestListener<Drawable> {
                override fun onLoadFailed(
                    e: GlideException?,
                    model: Any?,
                    target: Target<Drawable>?,
                    isFirstResource: Boolean
                ): Boolean {
                    Log.w("ImageLoader", "Failed to load image: $url", e)
                    return false
                }
                
                override fun onResourceReady(
                    resource: Drawable?,
                    model: Any?,
                    target: Target<Drawable>?,
                    dataSource: DataSource?,
                    isFirstResource: Boolean
                ): Boolean {
                    // Cache the loaded bitmap
                    (resource as? BitmapDrawable)?.bitmap?.let { bitmap ->
                        imageCache.put(url, bitmap)
                    }
                    return false
                }
            })
            .into(imageView)
    }
    
    // Preload images for better performance
    fun preloadImages(urls: List<String>) {
        urls.forEach { url ->
            glide
                .load(url)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .preload()
        }
    }
}

// RecyclerView with optimized image loading
class OptimizedImageAdapter(
    private val items: List<ImageItem>,
    private val imageLoader: LazyImageLoader
) : RecyclerView.Adapter<OptimizedImageAdapter.ViewHolder>() {
    
    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val imageView: ImageView = view.findViewById(R.id.imageView)
        val titleView: TextView = view.findViewById(R.id.titleView)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.image_item, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        
        holder.titleView.text = item.title
        
        // Load image lazily only when visible
        imageLoader.loadImageLazy(holder.imageView, item.imageUrl)
    }
    
    override fun getItemCount() = items.size
    
    // Preload images for upcoming items
    override fun onViewAttachedToWindow(holder: ViewHolder) {
        super.onViewAttachedToWindow(holder)
        
        val position = holder.adapterPosition
        if (position != RecyclerView.NO_POSITION) {
            // Preload next 3 images
            val preloadUrls = items.subList(
                position + 1,
                minOf(position + 4, items.size)
            ).map { it.imageUrl }
            
            imageLoader.preloadImages(preloadUrls)
        }
    }
}
```

### iOS Lazy Loading
```swift
// iOS - Efficient lazy loading with SDWebImage
class LazyImageManager {
    private let imageCache = SDImageCache.shared
    private let imageManager = SDWebImageManager.shared
    
    func loadImageLazy(
        into imageView: UIImageView,
        from url: URL,
        placeholder: UIImage? = nil
    ) {
        // Set placeholder immediately
        imageView.image = placeholder
        
        // Check cache first
        let cacheKey = imageManager.cacheKey(for: url)
        
        if let cachedImage = imageCache.imageFromCache(forKey: cacheKey) {
            imageView.image = cachedImage
            return
        }
        
        // Load with SDWebImage
        imageView.sd_setImage(
            with: url,
            placeholderImage: placeholder,
            options: [.continueInBackground, .progressiveLoad],
            context: [
                .imageTransformer: SDImageResizingTransformer(
                    size: imageView.bounds.size,
                    scaleMode: .aspectFill
                )
            ]
        ) { [weak self] image, error, cacheType, url in
            if let error = error {
                print("Image loading failed: \(error.localizedDescription)")
            }
        }
    }
    
    // Preload images for better performance
    func preloadImages(_ urls: [URL]) {
        let prefetcher = SDWebImagePrefetcher.shared
        prefetcher.prefetchURLs(urls) { finished, total in
            print("Preloaded \(finished)/\(total) images")
        }
    }
}

// Collection view with optimized image loading
class OptimizedImageCollectionViewController: UICollectionViewController {
    private let imageManager = LazyImageManager()
    private var imageItems: [ImageItem] = []
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCollectionView()
    }
    
    private func setupCollectionView() {
        // Configure collection view for performance
        collectionView.isPrefetchingEnabled = true
        collectionView.prefetchDataSource = self
        
        // Set appropriate item size
        if let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout {
            let itemWidth = (view.bounds.width - 30) / 2
            layout.itemSize = CGSize(width: itemWidth, height: itemWidth)
            layout.minimumInteritemSpacing = 10
            layout.minimumLineSpacing = 10
        }
    }
    
    override func collectionView(
        _ collectionView: UICollectionView,
        numberOfItemsInSection section: Int
    ) -> Int {
        return imageItems.count
    }
    
    override func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: "ImageCell",
            for: indexPath
        ) as! ImageCell
        
        let item = imageItems[indexPath.item]
        cell.configure(with: item, imageManager: imageManager)
        
        return cell
    }
}

// Collection view prefetching
extension OptimizedImageCollectionViewController: UICollectionViewDataSourcePrefetching {
    func collectionView(
        _ collectionView: UICollectionView,
        prefetchItemsAt indexPaths: [IndexPath]
    ) {
        let urls = indexPaths.compactMap { indexPath -> URL? in
            guard indexPath.item < imageItems.count else { return nil }
            return URL(string: imageItems[indexPath.item].imageUrl)
        }
        
        imageManager.preloadImages(urls)
    }
    
    func collectionView(
        _ collectionView: UICollectionView,
        cancelPrefetchingForItemsAt indexPaths: [IndexPath]
    ) {
        // Cancel prefetching if needed
        let urls = indexPaths.compactMap { indexPath -> URL? in
            guard indexPath.item < imageItems.count else { return nil }
            return URL(string: imageItems[indexPath.item].imageUrl)
        }
        
        urls.forEach { url in
            SDWebImageManager.shared.cancelAll()
        }
    }
}

class ImageCell: UICollectionViewCell {
    @IBOutlet weak var imageView: UIImageView!
    
    func configure(with item: ImageItem, imageManager: LazyImageManager) {
        guard let url = URL(string: item.imageUrl) else { return }
        
        imageManager.loadImageLazy(
            into: imageView,
            from: url,
            placeholder: UIImage(named: "placeholder")
        )
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        imageView.sd_cancelCurrentImageLoad()
        imageView.image = nil
    }
}
```

## View Recycling Patterns

### Flutter Efficient Widgets
```dart
// Flutter - Optimized list with view recycling
class EfficientListView extends StatefulWidget {
  final List<ListItem> items;
  final Widget Function(BuildContext, ListItem) itemBuilder;
  
  const EfficientListView({
    Key? key,
    required this.items,
    required this.itemBuilder,
  }) : super(key: key);
  
  @override
  _EfficientListViewState createState() => _EfficientListViewState();
}

class _EfficientListViewState extends State<EfficientListView> {
  late ScrollController _scrollController;
  
  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
  }
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: _scrollController,
      // Optimize for performance
      addAutomaticKeepAlives: false,
      addRepaintBoundaries: true,
      addSemanticIndexes: false,
      
      // Cache extent for smooth scrolling
      cacheExtent: MediaQuery.of(context).size.height * 2,
      
      itemCount: widget.items.length,
      itemBuilder: (context, index) {
        final item = widget.items[index];
        
        return RepaintBoundary(
          child: ListItemWidget(
            key: ValueKey(item.id),
            item: item,
            builder: widget.itemBuilder,
          ),
        );
      },
    );
  }
}

class ListItemWidget extends StatelessWidget {
  final ListItem item;
  final Widget Function(BuildContext, ListItem) builder;
  
  const ListItemWidget({
    Key? key,
    required this.item,
    required this.builder,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return builder(context, item);
  }
}

// Optimized image widget with caching
class CachedNetworkImageWidget extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit? fit;
  
  const CachedNetworkImageWidget({
    Key? key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit ?? BoxFit.cover,
      
      // Memory optimization
      memCacheWidth: width?.toInt(),
      memCacheHeight: height?.toInt(),
      
      // Placeholder and error handling
      placeholder: (context, url) => Container(
        width: width,
        height: height,
        color: Colors.grey[300],
        child: const Center(
          child: CircularProgressIndicator(),
        ),
      ),
      
      errorWidget: (context, url, error) => Container(
        width: width,
        height: height,
        color: Colors.grey[300],
        child: const Icon(Icons.error),
      ),
      
      // Fade animation
      fadeInDuration: const Duration(milliseconds: 200),
      fadeOutDuration: const Duration(milliseconds: 200),
    );
  }
}

// Custom scroll physics for better performance
class OptimizedScrollPhysics extends BouncingScrollPhysics {
  const OptimizedScrollPhysics({ScrollPhysics? parent}) : super(parent: parent);
  
  @override
  OptimizedScrollPhysics applyTo(ScrollPhysics? ancestor) {
    return OptimizedScrollPhysics(parent: buildParent(ancestor));
  }
  
  @override
  double get minFlingVelocity => 50.0; // Reduced sensitivity
  
  @override
  double get maxFlingVelocity => 5000.0; // Controlled max velocity
  
  @override
  double get dragStartDistanceMotionThreshold => 3.5; // Smoother drag start
}
```

### React Native Optimization
```javascript
// React Native - FlatList optimization
import React, { useMemo, useCallback } from 'react';
import { FlatList, Image, View, Text } from 'react-native';
import FastImage from 'react-native-fast-image';

const OptimizedList = ({ data, onItemPress }) => {
  // Memoize the data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data]);
  
  // Optimize render item with useCallback
  const renderItem = useCallback(({ item, index }) => (
    <OptimizedListItem
      item={item}
      onPress={() => onItemPress(item)}
    />
  ), [onItemPress]);
  
  // Key extractor for better performance
  const keyExtractor = useCallback((item) => item.id.toString(), []);
  
  // Get item layout for better scrolling performance
  const getItemLayout = useCallback((data, index) => ({
    length: 120, // Fixed item height
    offset: 120 * index,
    index,
  }), []);
  
  return (
    <FlatList
      data={memoizedData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
      
      // Memory optimization
      onEndReachedThreshold={0.5}
      
      // Separator optimization
      ItemSeparatorComponent={ListSeparator}
    />
  );
};

// Memoized list item component
const OptimizedListItem = React.memo(({ item, onPress }) => {
  return (
    <View style={styles.itemContainer}>
      <FastImage
        style={styles.itemImage}
        source={{
          uri: item.imageUrl,
          priority: FastImage.priority.normal,
          cache: FastImage.cacheControl.immutable,
        }}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemDescription}>{item.description}</Text>
      </View>
    </View>
  );
});

// Lightweight separator component
const ListSeparator = React.memo(() => (
  <View style={styles.separator} />
));

// Image preloading utility
class ImagePreloader {
  static preloadImages(urls) {
    const preloadPromises = urls.map(url =>
      FastImage.preload([{
        uri: url,
        priority: FastImage.priority.low,
        cache: FastImage.cacheControl.immutable,
      }])
    );
    
    return Promise.all(preloadPromises);
  }
  
  static clearCache() {
    FastImage.clearMemoryCache();
    FastImage.clearDiskCache();
  }
}

// Usage with virtualization
const VirtualizedList = ({ data }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const start = viewableItems[0].index;
      const end = viewableItems[viewableItems.length - 1].index;
      setVisibleRange({ start, end });
      
      // Preload upcoming images
      const preloadStart = Math.max(0, end + 1);
      const preloadEnd = Math.min(data.length, end + 5);
      const preloadUrls = data
        .slice(preloadStart, preloadEnd)
        .map(item => item.imageUrl);
      
      ImagePreloader.preloadImages(preloadUrls);
    }
  }, [data]);
  
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  };
  
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      // ... other props
    />
  );
};
```

## Threading and Async Operations

### Background Processing
```kotlin
// Android - Background threading for heavy operations
class BackgroundProcessor {
    private val backgroundExecutor = Executors.newFixedThreadPool(4)
    private val mainHandler = Handler(Looper.getMainLooper())
    
    fun processImageInBackground(
        bitmap: Bitmap,
        filters: List<ImageFilter>,
        callback: (Bitmap) -> Unit
    ) {
        backgroundExecutor.execute {
            try {
                var processedBitmap = bitmap
                
                // Apply filters on background thread
                filters.forEach { filter ->
                    processedBitmap = filter.apply(processedBitmap)
                }
                
                // Return to main thread for UI update
                mainHandler.post {
                    callback(processedBitmap)
                }
            } catch (e: Exception) {
                Log.e("BackgroundProcessor", "Processing failed", e)
                mainHandler.post {
                    callback(bitmap) // Return original on error
                }
            }
        }
    }
    
    fun processDataSetInBackground(
        dataSet: List<RawData>,
        processor: DataProcessor,
        progressCallback: (Int) -> Unit,
        completionCallback: (List<ProcessedData>) -> Unit
    ) {
        backgroundExecutor.execute {
            val results = mutableListOf<ProcessedData>()
            
            dataSet.forEachIndexed { index, rawData ->
                val processed = processor.process(rawData)
                results.add(processed)
                
                // Update progress on main thread
                val progress = ((index + 1) * 100) / dataSet.size
                mainHandler.post {
                    progressCallback(progress)
                }
            }
            
            // Completion callback on main thread
            mainHandler.post {
                completionCallback(results)
            }
        }
    }
    
    fun shutdown() {
        backgroundExecutor.shutdown()
        try {
            if (!backgroundExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                backgroundExecutor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            backgroundExecutor.shutdownNow()
        }
    }
}

// Coroutines for async operations
class AsyncDataManager {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    
    suspend fun loadDataAsync(url: String): Result<List<DataItem>> = withContext(Dispatchers.IO) {
        try {
            val response = ApiClient.fetchData(url)
            Result.success(response.data)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun loadAndProcessDataAsync(
        urls: List<String>,
        onProgress: (Int) -> Unit,
        onComplete: (List<DataItem>) -> Unit
    ) {
        scope.launch {
            val results = mutableListOf<DataItem>()
            
            urls.forEachIndexed { index, url ->
                val result = loadDataAsync(url)
                
                result.onSuccess { data ->
                    results.addAll(data)
                }
                
                // Update progress on main thread
                withContext(Dispatchers.Main) {
                    val progress = ((index + 1) * 100) / urls.size
                    onProgress(progress)
                }
            }
            
            // Completion on main thread
            withContext(Dispatchers.Main) {
                onComplete(results)
            }
        }
    }
    
    fun cancelAllOperations() {
        scope.coroutineContext.cancelChildren()
    }
}
```

### iOS Concurrency
```swift
// iOS - Modern async/await with actors
actor ImageProcessor {
    private var cache: [String: UIImage] = [:]
    private let maxCacheSize = 50
    
    func processImage(_ image: UIImage, with filters: [ImageFilter]) async -> UIImage {
        let cacheKey = generateCacheKey(for: image, filters: filters)
        
        if let cachedImage = cache[cacheKey] {
            return cachedImage
        }
        
        let processedImage = await withTaskGroup(of: UIImage.self) { group in
            group.addTask {
                await self.applyFiltersAsync(to: image, filters: filters)
            }
            
            return await group.next() ?? image
        }
        
        // Cache the result
        if cache.count >= maxCacheSize {
            cache.removeValue(forKey: cache.keys.first!)
        }
        cache[cacheKey] = processedImage
        
        return processedImage
    }
    
    private func applyFiltersAsync(to image: UIImage, filters: [ImageFilter]) async -> UIImage {
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                var processedImage = image
                
                for filter in filters {
                    processedImage = filter.apply(to: processedImage)
                }
                
                continuation.resume(returning: processedImage)
            }
        }
    }
    
    private func generateCacheKey(for image: UIImage, filters: [ImageFilter]) -> String {
        let imageHash = image.hashValue
        let filtersHash = filters.map { $0.identifier }.joined(separator: "_")
        return "\(imageHash)_\(filtersHash)"
    }
}

// Background data loading
class AsyncDataLoader {
    private let urlSession = URLSession.shared
    
    func loadData(from urls: [URL]) async -> [DataItem] {
        await withTaskGroup(of: [DataItem].self) { group in
            var allData: [DataItem] = []
            
            for url in urls {
                group.addTask {
                    await self.loadSingleURL(url)
                }
            }
            
            for await data in group {
                allData.append(contentsOf: data)
            }
            
            return allData
        }
    }
    
    private func loadSingleURL(_ url: URL) async -> [DataItem] {
        do {
            let (data, _) = try await urlSession.data(from: url)
            let decoder = JSONDecoder()
            return try decoder.decode([DataItem].self, from: data)
        } catch {
            print("Failed to load data from \(url): \(error)")
            return []
        }
    }
    
    // Progress tracking with AsyncStream
    func loadDataWithProgress(from urls: [URL]) -> AsyncStream<LoadingProgress> {
        return AsyncStream { continuation in
            Task {
                let totalCount = urls.count
                var completedCount = 0
                
                for url in urls {
                    _ = await loadSingleURL(url)
                    completedCount += 1
                    
                    let progress = LoadingProgress(
                        completed: completedCount,
                        total: totalCount,
                        percentage: Double(completedCount) / Double(totalCount) * 100
                    )
                    
                    continuation.yield(progress)
                }
                
                continuation.finish()
            }
        }
    }
}

struct LoadingProgress {
    let completed: Int
    let total: Int
    let percentage: Double
}
```

## Graphics and GPU Acceleration

### Metal Performance Optimization
```swift
// iOS - Metal for GPU acceleration
class MetalImageProcessor {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let library: MTLLibrary
    
    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw MetalError.deviceNotSupported
        }
        
        self.device = device
        
        guard let commandQueue = device.makeCommandQueue() else {
            throw MetalError.commandQueueCreationFailed
        }
        
        self.commandQueue = commandQueue
        
        guard let library = device.makeDefaultLibrary() else {
            throw MetalError.libraryCreationFailed
        }
        
        self.library = library
    }
    
    func processImageAsync(_ image: UIImage) async throws -> UIImage {
        return try await withCheckedThrowingContinuation { continuation in
            processImage(image) { result in
                continuation.resume(with: result)
            }
        }
    }
    
    private func processImage(_ image: UIImage, completion: @escaping (Result<UIImage, Error>) -> Void) {
        guard let cgImage = image.cgImage else {
            completion(.failure(MetalError.invalidImage))
            return
        }
        
        // Create texture from image
        let textureLoader = MTKTextureLoader(device: device)
        
        textureLoader.newTexture(cgImage: cgImage, options: nil) { [weak self] texture, error in
            guard let self = self, let inputTexture = texture else {
                completion(.failure(error ?? MetalError.textureCreationFailed))
                return
            }
            
            // Create output texture
            let textureDescriptor = MTLTextureDescriptor.texture2DDescriptor(
                pixelFormat: inputTexture.pixelFormat,
                width: inputTexture.width,
                height: inputTexture.height,
                mipmapped: false
            )
            textureDescriptor.usage = [.shaderWrite, .shaderRead]
            
            guard let outputTexture = self.device.makeTexture(descriptor: textureDescriptor) else {
                completion(.failure(MetalError.textureCreationFailed))
                return
            }
            
            // Create compute pipeline
            guard let function = self.library.makeFunction(name: "imageProcessingKernel"),
                  let pipelineState = try? self.device.makeComputePipelineState(function: function) else {
                completion(.failure(MetalError.pipelineCreationFailed))
                return
            }
            
            // Execute on GPU
            guard let commandBuffer = self.commandQueue.makeCommandBuffer(),
                  let computeEncoder = commandBuffer.makeComputeCommandEncoder() else {
                completion(.failure(MetalError.commandBufferCreationFailed))
                return
            }
            
            computeEncoder.setComputePipelineState(pipelineState)
            computeEncoder.setTexture(inputTexture, index: 0)
            computeEncoder.setTexture(outputTexture, index: 1)
            
            let threadgroupSize = MTLSize(width: 16, height: 16, depth: 1)
            let threadgroupCount = MTLSize(
                width: (inputTexture.width + threadgroupSize.width - 1) / threadgroupSize.width,
                height: (inputTexture.height + threadgroupSize.height - 1) / threadgroupSize.height,
                depth: 1
            )
            
            computeEncoder.dispatchThreadgroups(threadgroupCount, threadsPerThreadgroup: threadgroupSize)
            computeEncoder.endEncoding()
            
            commandBuffer.addCompletedHandler { _ in
                // Convert back to UIImage
                let ciImage = CIImage(mtlTexture: outputTexture, options: nil)
                let context = CIContext()
                
                if let cgImage = context.createCGImage(ciImage!, from: ciImage!.extent) {
                    let processedImage = UIImage(cgImage: cgImage)
                    completion(.success(processedImage))
                } else {
                    completion(.failure(MetalError.imageConversionFailed))
                }
            }
            
            commandBuffer.commit()
        }
    }
}

enum MetalError: Error {
    case deviceNotSupported
    case commandQueueCreationFailed
    case libraryCreationFailed
    case invalidImage
    case textureCreationFailed
    case pipelineCreationFailed
    case commandBufferCreationFailed
    case imageConversionFailed
}
```

### OpenGL Optimization for Android
```kotlin
// Android - OpenGL ES optimization
class GLImageRenderer {
    private var program: Int = 0
    private var vertexBuffer: FloatBuffer? = null
    private var textureBuffer: FloatBuffer? = null
    
    private val vertexShaderCode = """
        attribute vec4 vPosition;
        attribute vec2 vTexCoord;
        varying vec2 texCoord;
        
        void main() {
            gl_Position = vPosition;
            texCoord = vTexCoord;
        }
    """.trimIndent()
    
    private val fragmentShaderCode = """
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 texCoord;
        
        void main() {
            gl_FragColor = texture2D(uTexture, texCoord);
        }
    """.trimIndent()
    
    fun initialize() {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, vertexShaderCode)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, fragmentShaderCode)
        
        program = GLES20.glCreateProgram().also {
            GLES20.glAttachShader(it, vertexShader)
            GLES20.glAttachShader(it, fragmentShader)
            GLES20.glLinkProgram(it)
        }
        
        setupBuffers()
    }
    
    private fun setupBuffers() {
        // Vertex coordinates
        val vertices = floatArrayOf(
            -1.0f, -1.0f, 0.0f,  // Bottom left
             1.0f, -1.0f, 0.0f,  // Bottom right
            -1.0f,  1.0f, 0.0f,  // Top left
             1.0f,  1.0f, 0.0f   // Top right
        )
        
        // Texture coordinates
        val textureCoords = floatArrayOf(
            0.0f, 1.0f,  // Bottom left
            1.0f, 1.0f,  // Bottom right
            0.0f, 0.0f,  // Top left
            1.0f, 0.0f   // Top right
        )
        
        vertexBuffer = ByteBuffer.allocateDirect(vertices.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .apply {
                put(vertices)
                position(0)
            }
        
        textureBuffer = ByteBuffer.allocateDirect(textureCoords.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .apply {
                put(textureCoords)
                position(0)
            }
    }
    
    fun renderTexture(textureId: Int) {
        GLES20.glUseProgram(program)
        
        // Get attribute locations
        val positionHandle = GLES20.glGetAttribLocation(program, "vPosition")
        val texCoordHandle = GLES20.glGetAttribLocation(program, "vTexCoord")
        val textureHandle = GLES20.glGetUniformLocation(program, "uTexture")
        
        // Enable vertex arrays
        GLES20.glEnableVertexAttribArray(positionHandle)
        GLES20.glEnableVertexAttribArray(texCoordHandle)
        
        // Set vertex data
        GLES20.glVertexAttribPointer(
            positionHandle, 3, GLES20.GL_FLOAT, false, 12, vertexBuffer
        )
        GLES20.glVertexAttribPointer(
            texCoordHandle, 2, GLES20.GL_FLOAT, false, 8, textureBuffer
        )
        
        // Bind texture
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glUniform1i(textureHandle, 0)
        
        // Draw
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        
        // Disable vertex arrays
        GLES20.glDisableVertexAttribArray(positionHandle)
        GLES20.glDisableVertexAttribArray(texCoordHandle)
    }
    
    private fun loadShader(type: Int, shaderCode: String): Int {
        return GLES20.glCreateShader(type).also { shader ->
            GLES20.glShaderSource(shader, shaderCode)
            GLES20.glCompileShader(shader)
        }
    }
    
    fun cleanup() {
        GLES20.glDeleteProgram(program)
    }
}

// GPU-accelerated image processing
class GPUImageProcessor {
    private val renderer = GLImageRenderer()
    private var eglDisplay: EGLDisplay? = null
    private var eglContext: EGLContext? = null
    
    fun processImageOnGPU(bitmap: Bitmap): Bitmap {
        setupEGLContext()
        
        try {
            renderer.initialize()
            
            // Create texture from bitmap
            val textureIds = IntArray(1)
            GLES20.glGenTextures(1, textureIds, 0)
            val textureId = textureIds[0]
            
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
            GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
            
            // Set texture parameters
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            
            // Setup framebuffer
            val framebufferIds = IntArray(1)
            GLES20.glGenFramebuffers(1, framebufferIds, 0)
            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, framebufferIds[0])
            
            // Create output texture
            val outputTextureIds = IntArray(1)
            GLES20.glGenTextures(1, outputTextureIds, 0)
            val outputTextureId = outputTextureIds[0]
            
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, outputTextureId)
            GLES20.glTexImage2D(
                GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 
                bitmap.width, bitmap.height, 0, 
                GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null
            )
            
            GLES20.glFramebufferTexture2D(
                GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0,
                GLES20.GL_TEXTURE_2D, outputTextureId, 0
            )
            
            // Render
            GLES20.glViewport(0, 0, bitmap.width, bitmap.height)
            renderer.renderTexture(textureId)
            
            // Read pixels
            val pixels = IntArray(bitmap.width * bitmap.height)
            GLES20.glReadPixels(
                0, 0, bitmap.width, bitmap.height,
                GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE,
                IntBuffer.wrap(pixels)
            )
            
            // Create output bitmap
            val outputBitmap = Bitmap.createBitmap(
                bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888
            )
            outputBitmap.setPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            
            // Cleanup
            GLES20.glDeleteTextures(2, intArrayOf(textureId, outputTextureId), 0)
            GLES20.glDeleteFramebuffers(1, framebufferIds, 0)
            
            return outputBitmap
        } finally {
            cleanupEGLContext()
        }
    }
    
    private fun setupEGLContext() {
        // EGL setup implementation
    }
    
    private fun cleanupEGLContext() {
        // EGL cleanup implementation
    }
}
```

This rendering optimization documentation provides comprehensive coverage of mobile rendering performance techniques, including lazy loading strategies, view recycling patterns, threading optimizations, and GPU acceleration methods across Android, iOS, Flutter, and React Native platforms.
