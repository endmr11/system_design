# Sayfalama & Sonsuz Kaydırma

Mobil uygulamalarda büyük veri setlerini verimli şekilde yüklemek ve göstermek için kullanılan temel teknikler.

## Sayfalama Mimari Desenleri

### Geleneksel Sayfalama
- **Offset Tabanlı Sayfalama**: 
  - `?page=2&limit=20` ile sayfa tabanlı gezinme
  - Basit uygulama ancak büyük veri setlerinde performans sorunları
  - Skip-limit deseni ile veritabanı sorgu optimizasyon zorlukları
- **İmleç Tabanlı Sayfalama**:
  - `?after=cursor_id&limit=20` ile durum bilgili gezinme
  - Veri değişikliklerinde bile tutarlı sonuçlar
  - Büyük veri setleri için daha iyi performans

### Mobil-Optimize Sayfalama Stratejileri
- **Aşamalı Yükleme**: Küçük başlangıç sayfası, daha büyük sonraki sayfalar
- **Uyarlanabilir Sayfa Boyutları**: Ağ koşullarına göre dinamik sayfa boyutlandırma
- **Öngörülü Yükleme**: Kullanıcı davranış kalıpları ile akıllı ön yükleme

## Platform-Spesifik Sayfalama Uygulamaları

### Android Sayfalama Çözümleri
- **Paging 3 Kütüphane Mimarisi**:
  - PagingSource ile veri yükleme soyutlaması
  - RemoteMediator ile ağ + veritabanı koordinasyonu
  - PagingDataAdapter ile RecyclerView entegrasyonu
  - LoadState yönetimi ile yükleme/hata durumları
- **Gelişmiş Özellikler**:
  - Separators ile gruplandırılmış içerik
  - Headers/Footers ile ek içerik
  - Retry mekanizmaları ile hata kurtarma
  - Placeholder desteği ile akıcı kaydırma

```kotlin
// Android Paging 3 Uygulaması
class ItemPagingSource(
    private val apiService: ApiService,
    private val query: String
) : PagingSource<Int, Item>() {
    
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Item> {
        return try {
            val page = params.key ?: 1
            val response = apiService.getItems(
                query = query,
                page = page,
                size = params.loadSize
            )
            
            LoadResult.Page(
                data = response.items,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.items.isEmpty()) null else page + 1
            )
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }
    
    override fun getRefreshKey(state: PagingState<Int, Item>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            val anchorPage = state.closestPageToPosition(anchorPosition)
            anchorPage?.prevKey?.plus(1) ?: anchorPage?.nextKey?.minus(1)
        }
    }
}

// Repository Uygulaması
class ItemRepository(private val apiService: ApiService) {
    
    fun getItemsPagingFlow(query: String): Flow<PagingData<Item>> {
        return Pager(
            config = PagingConfig(
                pageSize = 20,
                prefetchDistance = 5,
                enablePlaceholders = false
            ),
            pagingSourceFactory = { ItemPagingSource(apiService, query) }
        ).flow
    }
}

// Adapter Uygulaması
class ItemAdapter : PagingDataAdapter<Item, ItemViewHolder>(ItemDiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ItemViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_layout, parent, false)
        return ItemViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
        val item = getItem(position)
        if (item != null) {
            holder.bind(item)
        }
    }
}
```

### iOS Sayfalama Desenleri
- **UICollectionView Sayfalama**:
  - `UICollectionViewDiffableDataSource` ile modern yaklaşım
  - `willDisplay` delegate metodları ile yükleme tetikleyicileri
  - `NSFetchedResultsController` ile Core Data entegrasyonu
- **SwiftUI Sayfalama**:
  - LazyVStack ile verimli liste render etme
  - @StateObject ile sayfalama durum yönetimi
  - Combine yayıncıları ile reaktif veri yükleme

```swift
// iOS UICollectionView Sayfalama
class ItemViewController: UIViewController {
    @IBOutlet weak var collectionView: UICollectionView!
    
    private var dataSource: UICollectionViewDiffableDataSource<Section, Item>!
    private let viewModel = ItemViewModel()
    private var cancellables = Set<AnyCancellable>()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupDataSource()
        setupBindings()
        viewModel.loadInitialData()
    }
    
    private func setupDataSource() {
        dataSource = UICollectionViewDiffableDataSource<Section, Item>(
            collectionView: collectionView
        ) { collectionView, indexPath, item in
            let cell = collectionView.dequeueReusableCell(
                withReuseIdentifier: "ItemCell",
                for: indexPath
            ) as! ItemCell
            cell.configure(with: item)
            return cell
        }
    }
    
    private func setupBindings() {
        viewModel.$items
            .receive(on: DispatchQueue.main)
            .sink { [weak self] items in
                self?.updateSnapshot(with: items)
            }
            .store(in: &cancellables)
    }
    
    private func updateSnapshot(with items: [Item]) {
        var snapshot = NSDiffableDataSourceSnapshot<Section, Item>()
        snapshot.appendSections([.main])
        snapshot.appendItems(items)
        dataSource.apply(snapshot, animatingDifferences: true)
    }
}

// Collection View Delegate
extension ItemViewController: UICollectionViewDelegate {
    func collectionView(
        _ collectionView: UICollectionView,
        willDisplay cell: UICollectionViewCell,
        forItemAt indexPath: IndexPath
    ) {
        let totalItems = dataSource.snapshot().numberOfItems
        if indexPath.row == totalItems - 5 {
            viewModel.loadNextPage()
        }
    }
}

// SwiftUI Sayfalama
struct ItemListView: View {
    @StateObject private var viewModel = ItemViewModel()
    
    var body: some View {
        NavigationView {
            List {
                ForEach(viewModel.items) { item in
                    ItemRowView(item: item)
                        .onAppear {
                            if item == viewModel.items.last {
                                viewModel.loadNextPage()
                            }
                        }
                }
                
                if viewModel.isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            }
            .navigationTitle("Öğeler")
            .refreshable {
                await viewModel.refresh()
            }
        }
        .onAppear {
            viewModel.loadInitialData()
        }
    }
}
```

### Flutter Sayfalama Çözümleri
- **infinite_scroll_pagination Paketi**:
  - PagingController ile durum yönetimi
  - Yerleşik hata yönetimi ile kullanıcı deneyimi
  - Özel öğe oluşturucuları ile esnek UI
- **Özel Sayfalama Uygulaması**:
  - ScrollController ile kaydırma pozisyonu tespiti
  - FutureBuilder ile asenkron veri yükleme
  - Durum yönetimi ile sayfalama koordinasyonu

```dart
// Flutter Özel Sayfalama Uygulaması
class PaginatedListView<T> extends StatefulWidget {
  final Future<List<T>> Function(int page) onLoadPage;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final Widget? loadingWidget;
  final Widget? errorWidget;
  final int pageSize;
  
  const PaginatedListView({
    Key? key,
    required this.onLoadPage,
    required this.itemBuilder,
    this.loadingWidget,
    this.errorWidget,
    this.pageSize = 20,
  }) : super(key: key);
  
  @override
  _PaginatedListViewState<T> createState() => _PaginatedListViewState<T>();
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  final List<T> _items = [];
  final ScrollController _scrollController = ScrollController();
  
  bool _isLoading = false;
  bool _hasReachedEnd = false;
  String? _error;
  int _currentPage = 1;
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadPage();
  }
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
  
  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200) {
      _loadPage();
    }
  }
  
  Future<void> _loadPage() async {
    if (_isLoading || _hasReachedEnd) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      final newItems = await widget.onLoadPage(_currentPage);
      
      setState(() {
        _items.addAll(newItems);
        _currentPage++;
        _isLoading = false;
        
        if (newItems.length < widget.pageSize) {
          _hasReachedEnd = true;
        }
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }
  
  Future<void> _refresh() async {
    setState(() {
      _items.clear();
      _currentPage = 1;
      _hasReachedEnd = false;
      _error = null;
    });
    await _loadPage();
  }
  
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: _items.length + (_isLoading ? 1 : 0),
        itemBuilder: (context, index) {
          if (index < _items.length) {
            return widget.itemBuilder(context, _items[index]);
          } else {
            return _buildLoadingIndicator();
          }
        },
      ),
    );
  }
  
  Widget _buildLoadingIndicator() {
    if (_error != null) {
      return widget.errorWidget ?? 
          Center(
            child: Column(
              children: [
                Text('Hata: $_error'),
                ElevatedButton(
                  onPressed: _loadPage,
                  child: Text('Tekrar Dene'),
                ),
              ],
            ),
          );
    }
    
    return widget.loadingWidget ?? 
        const Center(child: CircularProgressIndicator());
  }
}
```

## Sonsuz Kaydırma Uygulaması

### Kaydırma Tespit Mekanizmaları
- **Eşik Tabanlı Yükleme**: %80 kaydırıldığında yükleme
- **Öngörülü Yükleme**: Kaydırma hızına göre yükleme
- **Görünüm Alanı Tabanlı Yükleme**: Görünür alana yaklaşırken yükleme

### Performans Optimizasyon Teknikleri
- **Görünüm Geri Dönüşümü**: 
  - RecyclerView ViewHolder deseni (Android)
  - UITableView hücre yeniden kullanımı (iOS)
  - ListView.builder verimli render etme (Flutter)
- **Bellek Yönetimi**:
  - Pencere tabanlı veri yönetimi
  - Uzak öğeler için otomatik veri temizleme
  - Görüntü tembel yükleme ile bellek optimizasyonu

### Gelişmiş Sonsuz Kaydırma Özellikleri
- **Çift Yönlü Kaydırma**: İleri ve geri sayfalama
- **Aşağı Çekerek Yenileme Entegrasyonu**: Manuel yenileme yeteneği
- **Boş Durum Yönetimi**: Daha fazla veri olmayan senaryolar
- **Hata Durumu Kurtarma**: Ağ hatası ile yeniden deneme mekanizmaları

## Veri Tutarlılığı Zorlukları

### Gerçek Zamanlı Veri Güncellemeleri
- **Yeni Öğe Ekleme**: Sayfalama sırasında yeni eklenen öğeleri yönetme
- **Öğe Değişiklikleri**: Sayfalamayı bozmadan mevcut öğeleri güncelleme
- **Öğe Silme**: Kaydırma pozisyonunu koruyarak öğeleri kaldırma

### Eşzamanlı Erişim Yönetimi
- **Yarış Durumu Önleme**: Çoklu sayfa yüklemelerini koordine etme
- **Önbellek Koordinasyonu**: Önbelleklenmiş ve taze veri arasında tutarlılık sağlama
- **Durum Senkronizasyonu**: Çoklu ekran sayfalama durum yönetimi

## Ağ Optimizasyonu

### Akıllı Ön Yükleme
- **Kullanım Kalıbı Analizi**: Kullanıcı kaydırma davranışını öğrenme
- **Ağ Durumu Farkındalığı**: Bağlantıya göre ön yükleme stratejisini ayarlama
- **Pil Düşüncesi**: Düşük pilde ön yüklemeyi azaltma

### İstek Optimizasyonu
- **İstek Tekrarlarını Önleme**: Yinelenen sayfa isteklerini önleme
- **İstek İptali**: Kaydırma yönü değiştiğinde gereksiz istekleri iptal etme
- **Toplu Yükleme**: Uygun olduğunda tek istekte birden fazla sayfa yükleme

## Metrikler ve Analitik
- **Kaydırma Derinliği Takibi**: Kullanıcıların tipik olarak ne kadar kaydırdığı
- **Sayfa Yükleme Performansı**: Her sayfayı yükleme süresi
- **Kullanıcı Etkileşimi**: Sayfalama ile kullanıcı tutma arasındaki korelasyon
- **Hata Oranı İzleme**: Başarısız sayfa yüklemeleri ile kullanıcı deneyimi etkisi
