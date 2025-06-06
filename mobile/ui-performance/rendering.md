# UI/UX Performans Optimizasyonu

## 5.1. Lazy Loading & View Recycling (RecyclerView, UITableView)

### Lazy Loading Fundamentals
- **Core Principle**: Load content only when needed ile memory ve performance optimization
- **Benefits**: Faster initial loading, reduced memory footprint, improved user experience
- **Implementation Challenges**: Placeholder management, loading state handling, error recovery

### View Recycling Architecture

#### Android RecyclerView Optimization
- **ViewHolder Pattern**:
  ```kotlin
  class UserViewHolder(private val binding: ItemUserBinding) : RecyclerView.ViewHolder(binding.root) {
      fun bind(user: User) {
          binding.apply {
              nameText.text = user.name
              emailText.text = user.email
              Glide.with(avatarImage)
                  .load(user.avatarUrl)
                  .circleCrop()
                  .into(avatarImage)
          }
      }
  }
  ```
- **Advanced RecyclerView Features**:
  ```kotlin
  // DiffUtil Implementation
  class UserDiffCallback : DiffUtil.ItemCallback<User>() {
      override fun areItemsTheSame(oldItem: User, newItem: User) = 
          oldItem.id == newItem.id
      
      override fun areContentsTheSame(oldItem: User, newItem: User) = 
          oldItem == newItem
  }

  // ListAdapter Implementation
  class UserAdapter : ListAdapter<User, UserViewHolder>(UserDiffCallback()) {
      override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
          val binding = ItemUserBinding.inflate(
              LayoutInflater.from(parent.context), parent, false
          )
          return UserViewHolder(binding)
      }

      override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
          holder.bind(getItem(position))
      }
  }
  ```
- **Layout Manager Optimization**:
  ```kotlin
  // Custom LayoutManager Example
  class StaggeredGridLayoutManager(
      private val spanCount: Int,
      private val orientation: Int
  ) : RecyclerView.LayoutManager() {
      override fun generateDefaultLayoutParams(): RecyclerView.LayoutParams =
          RecyclerView.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.WRAP_CONTENT
          )

      override fun onLayoutChildren(recycler: RecyclerView.Recycler, state: RecyclerView.State) {
          // Custom layout logic
      }
  }
  ```

#### iOS Table/Collection View Optimization
- **Cell Reuse Mechanisms**:
  ```swift
  // Modern UICollectionView Implementation
  class UserCollectionViewController: UIViewController {
      private var dataSource: UICollectionViewDiffableDataSource<Section, User>!
      
      private func configureDataSource() {
          let cellRegistration = UICollectionView.CellRegistration<UserCell, User> { cell, indexPath, user in
              cell.configure(with: user)
          }
          
          dataSource = UICollectionViewDiffableDataSource<Section, User>(
              collectionView: collectionView
          ) { collectionView, indexPath, user in
              return collectionView.dequeueConfiguredReusableCell(
                  using: cellRegistration,
                  for: indexPath,
                  item: user
              )
          }
      }
  }
  ```
- **Modern iOS List Performance**:
  ```swift
  // Compositional Layout Example
  func createLayout() -> UICollectionViewLayout {
      let itemSize = NSCollectionLayoutSize(
          widthDimension: .fractionalWidth(1.0),
          heightDimension: .estimated(100)
      )
      let item = NSCollectionLayoutItem(layoutSize: itemSize)
      
      let groupSize = NSCollectionLayoutSize(
          widthDimension: .fractionalWidth(1.0),
          heightDimension: .estimated(100)
      )
      let group = NSCollectionLayoutGroup.horizontal(
          layoutSize: groupSize,
          subitems: [item]
      )
      
      let section = NSCollectionLayoutSection(group: group)
      return UICollectionViewCompositionalLayout(section: section)
  }
  ```

#### Flutter List Performance
- **Efficient List Widgets**:
  ```dart
  // Custom ScrollView with Slivers
  class CustomScrollViewExample extends StatelessWidget {
    @override
    Widget build(BuildContext context) {
      return CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            expandedHeight: 200.0,
            flexibleSpace: FlexibleSpaceBar(
              title: Text('Custom Scroll View'),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => ListTile(
                title: Text('Item $index'),
              ),
              childCount: 100,
            ),
          ),
        ],
      );
    }
  }
  ```

### Image Lazy Loading Strategies

#### Progressive Image Loading
- **Placeholder Strategies**:
  ```kotlin
  // Android Glide Implementation
  Glide.with(context)
      .load(imageUrl)
      .placeholder(R.drawable.placeholder)
      .thumbnail(0.1f)
      .transition(DrawableTransitionOptions.withCrossFade())
      .into(imageView)
  ```
  ```swift
  // iOS Kingfisher Implementation
  imageView.kf.setImage(
      with: URL(string: imageUrl),
      placeholder: UIImage(named: "placeholder"),
      options: [
          .transition(.fade(0.3)),
          .cacheOriginalImage
      ]
  )
  ```

### Data Lazy Loading

#### Pagination Integration
- **Android Implementation**:
  ```kotlin
  class UserPagingSource : PagingSource<Int, User>() {
      override suspend fun load(params: LoadParams<Int>): LoadResult<Int, User> {
          return try {
              val page = params.key ?: 1
              val response = api.getUsers(page)
              
              LoadResult.Page(
                  data = response.users,
                  prevKey = if (page == 1) null else page - 1,
                  nextKey = if (response.isLastPage) null else page + 1
              )
          } catch (e: Exception) {
              LoadResult.Error(e)
          }
      }
  }
  ```

## 5.2. Render Thread vs. Main Thread Ayrımı

### Threading Architecture for UI Performance

#### Main Thread (UI Thread) Responsibilities
- **User Interaction Handling**:
  ```kotlin
  // Android Touch Event Handling
  class CustomView @JvmOverloads constructor(
      context: Context,
      attrs: AttributeSet? = null
  ) : View(context, attrs) {
      
      override fun onTouchEvent(event: MotionEvent): Boolean {
          when (event.action) {
              MotionEvent.ACTION_DOWN -> {
                  // Handle touch down
                  return true
              }
              MotionEvent.ACTION_MOVE -> {
                  // Handle touch move
                  return true
              }
              MotionEvent.ACTION_UP -> {
                  // Handle touch up
                  return true
              }
          }
          return super.onTouchEvent(event)
      }
  }
  ```

#### Render Thread Concepts
- **Android Render Thread Example**:
  ```kotlin
  // Custom View with Hardware Acceleration
  class CustomRenderView @JvmOverloads constructor(
      context: Context,
      attrs: AttributeSet? = null
  ) : View(context, attrs) {
      
      init {
          setLayerType(LAYER_TYPE_HARDWARE, null)
      }
      
      override fun onDraw(canvas: Canvas) {
          super.onDraw(canvas)
          // Complex drawing operations
      }
  }
  ```

### Android Threading Model

#### Main Thread vs Background Threads
- **Coroutines Implementation**:
  ```kotlin
  class UserRepository @Inject constructor(
      private val api: UserApi,
      private val dispatcher: CoroutineDispatcher = Dispatchers.IO
  ) {
      suspend fun fetchUsers(): Flow<List<User>> = flow {
          try {
              val users = withContext(dispatcher) {
                  api.getUsers()
              }
              emit(users)
          } catch (e: Exception) {
              // Handle error
          }
      }
  }
  ```

### iOS Threading Model

#### Grand Central Dispatch (GCD)
- **Queue Management**:
  ```swift
  class ImageProcessor {
      func processImage(_ image: UIImage, completion: @escaping (UIImage?) -> Void) {
          DispatchQueue.global(qos: .userInitiated).async {
              // Process image on background thread
              let processedImage = self.applyFilters(to: image)
              
              DispatchQueue.main.async {
                  // Update UI on main thread
                  completion(processedImage)
              }
          }
      }
  }
  ```

### Flutter Threading Architecture

#### Isolates and Engine Threads
- **Isolate Implementation**:
  ```dart
  Future<void> computeHeavyTask() async {
    final result = await compute(complexCalculation, data);
    setState(() {
      // Update UI with result
    });
  }

  int complexCalculation(Map<String, dynamic> data) {
    // Heavy computation
    return result;
  }
  ```

## 5.3. Asenkron Görüntü ve Veri Yükleme

### Image Loading Architecture

#### Platform-Specific Image Loading

##### Android Image Loading Solutions
- **Glide Advanced Features**:
  ```kotlin
  // Custom Glide Module
  @GlideModule
  class CustomGlideModule : AppGlideModule() {
      override fun applyOptions(context: Context, builder: GlideBuilder) {
          builder.setDefaultRequestOptions(
              RequestOptions()
                  .diskCacheStrategy(DiskCacheStrategy.ALL)
                  .format(DecodeFormat.PREFER_RGB_565)
          )
      }
  }
  ```

##### iOS Image Loading Solutions
- **Kingfisher Advanced Features**:
  ```swift
  // Custom Image Processor
  struct CustomImageProcessor: ImageProcessor {
      let identifier = "com.custom.processor"
      
      func process(item: ImageProcessItem, options: KingfisherOptionsInfo) -> Image? {
          switch item {
          case .image(let image):
              return image.kf.scaled(to: CGSize(width: 100, height: 100))
          case .data:
              return nil
          }
      }
  }
  ```

### Data Loading Patterns

#### Real-Time Data Updates
- **WebSocket Implementation**:
  ```kotlin
  // Android WebSocket Client
  class WebSocketClient {
      private val client = OkHttpClient.Builder()
          .pingInterval(30, TimeUnit.SECONDS)
          .build()
      
      private val webSocket = client.newWebSocket(
          Request.Builder().url("wss://api.example.com/ws").build(),
          object : WebSocketListener() {
              override fun onMessage(webSocket: WebSocket, text: String) {
                  // Handle incoming message
              }
              
              override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                  // Handle failure
              }
          }
      )
  }
  ```

## 5.4. Raster vs. Vector Drawables

### Graphics Format Fundamentals

#### Raster Graphics in Mobile Development
- **Bitmap Optimization**:
  ```kotlin
  // Android Bitmap Optimization
  fun optimizeBitmap(bitmap: Bitmap): Bitmap {
      return Bitmap.createScaledBitmap(
          bitmap,
          bitmap.width / 2,
          bitmap.height / 2,
          true
      )
  }
  ```

### Vector Graphics Implementation

#### Android Vector Drawables
- **Animated Vector Drawable**:
  ```xml
  <!-- res/drawable/animated_vector.xml -->
  <animated-vector
      xmlns:android="http://schemas.android.com/apk/res/android"
      android:drawable="@drawable/vector_drawable">
      <target
          android:name="path"
          android:animation="@animator/path_animator"/>
  </animated-vector>
  ```

#### iOS Vector Assets
- **Custom SF Symbol**:
  ```swift
  // Custom SF Symbol Configuration
  let config = UIImage.SymbolConfiguration(
      pointSize: 24,
      weight: .medium,
      scale: .large
  )
  let image = UIImage(
      systemName: "star.fill",
      withConfiguration: config
  )
  ```

### Performance Considerations

#### Memory Usage Patterns
- **Bitmap Memory Management**:
  ```kotlin
  // Android Bitmap Memory Management
  class BitmapManager {
      private val cache = LruCache<String, Bitmap>(calculateCacheSize())
      
      private fun calculateCacheSize(): Int {
          val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
          return maxMemory / 8
      }
      
      fun addBitmapToCache(key: String, bitmap: Bitmap) {
          if (getBitmapFromCache(key) == null) {
              cache.put(key, bitmap)
          }
      }
  }
  ```

### Implementation Best Practices

#### Asset Organization
- **Android Resource Organization**:
  ```kotlin
  // Resource Naming Convention
  object ResourceNaming {
      const val PREFIX_ICON = "ic_"
      const val PREFIX_IMAGE = "img_"
      const val PREFIX_BACKGROUND = "bg_"
      const val PREFIX_ANIMATION = "anim_"
  }
  ```

#### Runtime Optimization
- **Image Loading Optimization**:
  ```kotlin
  // Android Image Loading Optimization
  class OptimizedImageLoader {
      fun loadImage(url: String, imageView: ImageView) {
          Glide.with(imageView.context)
              .load(url)
              .apply(RequestOptions()
                  .diskCacheStrategy(DiskCacheStrategy.ALL)
                  .format(DecodeFormat.PREFER_RGB_565)
                  .override(Target.SIZE_ORIGINAL)
              )
              .into(imageView)
      }
  }
  ```

### Platform-Specific Recommendations

#### Android Best Practices
- **Vector Drawable Optimization**:
  ```kotlin
  // Vector Drawable Tinting
  class VectorDrawableHelper {
      fun tintDrawable(
          context: Context,
          @DrawableRes drawableId: Int,
          @ColorInt color: Int
      ): Drawable {
          return ContextCompat.getDrawable(context, drawableId)?.apply {
              setTint(color)
          } ?: throw IllegalArgumentException("Drawable not found")
      }
  }
  ```

#### iOS Best Practices
- **PDF Vector Optimization**:
  ```swift
  // PDF Vector Rendering
  class PDFVectorRenderer {
      func renderPDF(named name: String, size: CGSize) -> UIImage? {
          guard let pdfURL = Bundle.main.url(forResource: name, withExtension: "pdf"),
                let pdfDocument = PDFDocument(url: pdfURL),
                let page = pdfDocument.page(at: 0) else {
              return nil
          }
          
          let renderer = UIGraphicsImageRenderer(size: size)
          return renderer.image { context in
              context.cgContext.setFillColor(UIColor.clear.cgColor)
              context.cgContext.fill(CGRect(origin: .zero, size: size))
              
              page.draw(with: .mediaBox, to: context.cgContext)
          }
      }
  }
  ```

#### Flutter Cross-Platform
- **SVG Asset Loading**:
  ```dart
  // Flutter SVG Loading
  class SVGAssetLoader {
    static Widget loadSVG(String assetName, {double? width, double? height}) {
      return SvgPicture.asset(
        assetName,
        width: width,
        height: height,
        placeholderBuilder: (context) => CircularProgressIndicator(),
      );
    }
  }
  ```

## Performans İzleme ve Optimizasyon

### UI Performance Metrics
- **Frame Rate Monitoring**:
  ```kotlin
  // Android Frame Rate Monitoring
  class FrameRateMonitor {
      private var frameCount = 0
      private var lastTime = System.currentTimeMillis()
      
      fun onFrame() {
          frameCount++
          val currentTime = System.currentTimeMillis()
          
          if (currentTime - lastTime >= 1000) {
              val fps = frameCount.toFloat() / ((currentTime - lastTime) / 1000f)
              Log.d("FrameRate", "FPS: $fps")
              
              frameCount = 0
              lastTime = currentTime
          }
      }
  }
  ```

### Memory Optimization
- **View Hierarchy Optimization**:
  ```kotlin
  // Android View Hierarchy Optimization
  class ViewOptimizer {
      fun optimizeViewHierarchy(view: View) {
          when (view) {
              is ViewGroup -> {
                  // Flatten nested layouts
                  if (view.childCount == 1 && view is LinearLayout) {
                      val child = view.getChildAt(0)
                      if (child is LinearLayout && 
                          view.orientation == child.orientation) {
                          // Consider flattening
                      }
                  }
              }
          }
      }
  }
  ```

### Best Practices Summary
1. **View Recycling**: Always use RecyclerView/UITableView for lists
2. **Image Optimization**: Implement progressive loading and caching
3. **Thread Management**: Keep UI operations on main thread, heavy work on background
4. **Vector Graphics**: Prefer vector drawables for scalable assets
5. **Memory Management**: Monitor and optimize bitmap usage
6. **Performance Monitoring**: Implement frame rate and memory monitoring
