# UI/UX Performans Optimizasyonu

## 5.1. Lazy Loading & View Recycling (RecyclerView, UITableView)

### Lazy Loading Temelleri
- **Ana Prensip**: İçeriği sadece gerektiğinde yükleyerek bellek ve performans optimizasyonu
- **Faydaları**: Daha hızlı başlangıç yüklemesi, daha az bellek kullanımı, geliştirilmiş kullanıcı deneyimi
- **Uygulama Zorlukları**: Yer tutucu yönetimi, yükleme durumu işleme, hata kurtarma

### View Recycling Mimarisi

#### Android RecyclerView Optimizasyonu
- **ViewHolder Deseni**:
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
- **Gelişmiş RecyclerView Özellikleri**:
  ```kotlin
  // DiffUtil Uygulaması
  class UserDiffCallback : DiffUtil.ItemCallback<User>() {
      override fun areItemsTheSame(oldItem: User, newItem: User) = 
          oldItem.id == newItem.id
      
      override fun areContentsTheSame(oldItem: User, newItem: User) = 
          oldItem == newItem
  }

  // ListAdapter Uygulaması
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
- **Layout Manager Optimizasyonu**:
  ```kotlin
  // Özel LayoutManager Örneği
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
          // Özel düzen mantığı
      }
  }
  ```

#### iOS Table/Collection View Optimizasyonu
- **Hücre Yeniden Kullanım Mekanizmaları**:
  ```swift
  // Modern UICollectionView Uygulaması
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
- **Modern iOS Liste Performansı**:
  ```swift
  // Compositional Layout Örneği
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

#### Flutter Liste Performansı
- **Verimli Liste Widget'ları**:
  ```dart
  // Sliver'lar ile Özel ScrollView
  class CustomScrollViewExample extends StatelessWidget {
    @override
    Widget build(BuildContext context) {
      return CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            expandedHeight: 200.0,
            flexibleSpace: FlexibleSpaceBar(
              title: Text('Özel Scroll View'),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => ListTile(
                title: Text('Öğe $index'),
              ),
              childCount: 100,
            ),
          ),
        ],
      );
    }
  }
  ```

### Görüntü Lazy Loading Stratejileri

#### Aşamalı Görüntü Yükleme
- **Yer Tutucu Stratejileri**:
  ```kotlin
  // Android Glide Uygulaması
  Glide.with(context)
      .load(imageUrl)
      .placeholder(R.drawable.placeholder)
      .thumbnail(0.1f)
      .transition(DrawableTransitionOptions.withCrossFade())
      .into(imageView)
  ```
  ```swift
  // iOS Kingfisher Uygulaması
  imageView.kf.setImage(
      with: URL(string: imageUrl),
      placeholder: UIImage(named: "placeholder"),
      options: [
          .transition(.fade(0.3)),
          .cacheOriginalImage
      ]
  )
  ```

### Veri Lazy Loading

#### Sayfalama Entegrasyonu
- **Android Uygulaması**:
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

### UI Performansı için Threading Mimarisi

#### Main Thread (UI Thread) Sorumlulukları
- **Kullanıcı Etkileşimi İşleme**:
  ```kotlin
  // Android Dokunma Olayı İşleme
  class CustomView @JvmOverloads constructor(
      context: Context,
      attrs: AttributeSet? = null
  ) : View(context, attrs) {
      
      override fun onTouchEvent(event: MotionEvent): Boolean {
          when (event.action) {
              MotionEvent.ACTION_DOWN -> {
                  // Dokunma başlangıcını işle
                  return true
              }
              MotionEvent.ACTION_MOVE -> {
                  // Dokunma hareketini işle
                  return true
              }
              MotionEvent.ACTION_UP -> {
                  // Dokunma bitişini işle
                  return true
              }
          }
          return super.onTouchEvent(event)
      }
  }
  ```

#### Render Thread Kavramları
- **Android Render Thread Örneği**:
  ```kotlin
  // Donanım Hızlandırmalı Özel View
  class CustomRenderView @JvmOverloads constructor(
      context: Context,
      attrs: AttributeSet? = null
  ) : View(context, attrs) {
      
      init {
          setLayerType(LAYER_TYPE_HARDWARE, null)
      }
      
      override fun onDraw(canvas: Canvas) {
          super.onDraw(canvas)
          // Karmaşık çizim işlemleri
      }
  }
  ```

### Android Threading Modeli

#### Main Thread vs Arka Plan Thread'leri
- **Coroutines Uygulaması**:
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
              // Hatayı işle
          }
      }
  }
  ```

### iOS Threading Modeli

#### Grand Central Dispatch (GCD)
- **Kuyruk Yönetimi**:
  ```swift
  class ImageProcessor {
      func processImage(_ image: UIImage, completion: @escaping (UIImage?) -> Void) {
          DispatchQueue.global(qos: .userInitiated).async {
              // Arka planda görüntü işleme
              let processedImage = self.applyFilters(to: image)
              
              DispatchQueue.main.async {
                  // Ana thread'de UI güncelleme
                  completion(processedImage)
              }
          }
      }
  }
  ```

### Flutter Threading Mimarisi

#### Isolate'lar ve Engine Thread'leri
- **Isolate Uygulaması**:
  ```dart
  Future<void> computeHeavyTask() async {
    final result = await compute(complexCalculation, data);
    setState(() {
      // Sonuçla UI'ı güncelle
    });
  }

  int complexCalculation(Map<String, dynamic> data) {
    // Ağır hesaplama
    return result;
  }
  ```

## 5.3. Asenkron Görüntü ve Veri Yükleme

### Görüntü Yükleme Mimarisi

#### Platform-Spesifik Görüntü Yükleme

##### Android Görüntü Yükleme Çözümleri
- **Glide Gelişmiş Özellikleri**:
  ```kotlin
  // Özel Glide Modülü
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

##### iOS Görüntü Yükleme Çözümleri
- **Kingfisher Gelişmiş Özellikleri**:
  ```swift
  // Özel Görüntü İşleyici
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

### Veri Yükleme Desenleri

#### Gerçek Zamanlı Veri Güncellemeleri
- **WebSocket Uygulaması**:
  ```kotlin
  // Android WebSocket İstemcisi
  class WebSocketClient {
      private val client = OkHttpClient.Builder()
          .pingInterval(30, TimeUnit.SECONDS)
          .build()
      
      private val webSocket = client.newWebSocket(
          Request.Builder().url("wss://api.example.com/ws").build(),
          object : WebSocketListener() {
              override fun onMessage(webSocket: WebSocket, text: String) {
                  // Gelen mesajı işle
              }
              
              override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                  // Hatayı işle
              }
          }
      )
  }
  ```

## 5.4. Raster vs. Vector Drawables

### Grafik Format Temelleri

#### Mobil Geliştirmede Raster Grafikler
- **Bitmap Optimizasyonu**:
  ```kotlin
  // Android Bitmap Optimizasyonu
  fun optimizeBitmap(bitmap: Bitmap): Bitmap {
      return Bitmap.createScaledBitmap(
          bitmap,
          bitmap.width / 2,
          bitmap.height / 2,
          true
      )
  }
  ```

### Vector Grafik Uygulaması

#### Android Vector Drawables
- **Animasyonlu Vector Drawable**:
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

#### iOS Vector Varlıkları
- **Özel SF Symbol**:
  ```swift
  // Özel SF Symbol Yapılandırması
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

### Performans Değerlendirmeleri

#### Bellek Kullanım Desenleri
- **Bitmap Bellek Yönetimi**:
  ```kotlin
  // Android Bitmap Bellek Yönetimi
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

### Uygulama En İyi Uygulamaları

#### Varlık Organizasyonu
- **Android Kaynak Organizasyonu**:
  ```kotlin
  // Kaynak İsimlendirme Kuralı
  object ResourceNaming {
      const val PREFIX_ICON = "ic_"
      const val PREFIX_IMAGE = "img_"
      const val PREFIX_BACKGROUND = "bg_"
      const val PREFIX_ANIMATION = "anim_"
  }
  ```

#### Çalışma Zamanı Optimizasyonu
- **Görüntü Yükleme Optimizasyonu**:
  ```kotlin
  // Android Görüntü Yükleme Optimizasyonu
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

### Platform-Spesifik Öneriler

#### Android En İyi Uygulamaları
- **Vector Drawable Optimizasyonu**:
  ```kotlin
  // Vector Drawable Renklendirme
  class VectorDrawableHelper {
      fun tintDrawable(
          context: Context,
          @DrawableRes drawableId: Int,
          @ColorInt color: Int
      ): Drawable {
          return ContextCompat.getDrawable(context, drawableId)?.apply {
              setTint(color)
          } ?: throw IllegalArgumentException("Drawable bulunamadı")
      }
  }
  ```

#### iOS En İyi Uygulamaları
- **PDF Vector Optimizasyonu**:
  ```swift
  // PDF Vector Renderlama
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
- **SVG Varlık Yükleme**:
  ```dart
  // Flutter SVG Yükleme
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

### UI Performans Metrikleri
- **Kare Hızı İzleme**:
  ```kotlin
  // Android Kare Hızı İzleme
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

### Bellek Optimizasyonu
- **View Hiyerarşisi Optimizasyonu**:
  ```kotlin
  // Android View Hiyerarşisi Optimizasyonu
  class ViewOptimizer {
      fun optimizeViewHierarchy(view: View) {
          when (view) {
              is ViewGroup -> {
                  // İç içe düzenleri düzleştir
                  if (view.childCount == 1 && view is LinearLayout) {
                      val child = view.getChildAt(0)
                      if (child is LinearLayout && 
                          view.orientation == child.orientation) {
                          // Düzleştirmeyi düşün
                      }
                  }
              }
          }
      }
  }
  ```

### En İyi Uygulamalar Özeti
1. **View Recycling**: Listeler için her zaman RecyclerView/UITableView kullanın
2. **Görüntü Optimizasyonu**: Aşamalı yükleme ve önbellekleme uygulayın
3. **Thread Yönetimi**: UI işlemlerini ana thread'de, ağır işleri arka planda tutun
4. **Vector Grafikler**: Ölçeklenebilir varlıklar için vector drawable'ları tercih edin
5. **Bellek Yönetimi**: Bitmap kullanımını izleyin ve optimize edin
6. **Performans İzleme**: Kare hızı ve bellek izleme uygulayın
