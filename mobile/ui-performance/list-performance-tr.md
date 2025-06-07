# Liste ve Kaydırma Performansı

## Liste Performans Optimizasyonu

### Android RecyclerView Gelişmiş Teknikleri

#### ViewHolder Deseni Optimizasyonu
```kotlin
class OptimizedViewHolder(private val binding: ItemBinding) : 
    RecyclerView.ViewHolder(binding.root) {
    
    fun bind(item: DataItem) {
        // findViewById çağrılarını minimize et
        binding.apply {
            title.text = item.title
            subtitle.text = item.subtitle
            // Performans için veri bağlama kullan
        }
    }
}
```

#### Verimli Güncellemeler için DiffUtil
```kotlin
class ItemDiffCallback : DiffUtil.ItemCallback<DataItem>() {
    override fun areItemsTheSame(oldItem: DataItem, newItem: DataItem): Boolean {
        return oldItem.id == newItem.id
    }
    
    override fun areContentsTheSame(oldItem: DataItem, newItem: DataItem): Boolean {
        return oldItem == newItem
    }
    
    override fun getChangePayload(oldItem: DataItem, newItem: DataItem): Any? {
        // Özel değişiklik bilgisini döndür
        return when {
            oldItem.title != newItem.title -> "title_changed"
            oldItem.subtitle != newItem.subtitle -> "subtitle_changed"
            else -> null
        }
    }
}
```

### iOS UICollectionView Performansı

#### Hücre Ön Yükleme
```swift
class PerformantCollectionViewController: UICollectionViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Ön yüklemeyi etkinleştir
        collectionView.isPrefetchingEnabled = true
        collectionView.prefetchDataSource = self
    }
}

extension PerformantCollectionViewController: UICollectionViewDataSourcePrefetching {
    func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        // Yaklaşan hücreler için veri ön yükle
        for indexPath in indexPaths {
            loadData(for: indexPath)
        }
    }
}
```

### Flutter Liste Performansı

#### Verimli ListView Uygulaması
```dart
class PerformantListView extends StatelessWidget {
  final List<Item> items;
  
  const PerformantListView({Key? key, required this.items}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      // Daha iyi performans için öğe boyutunu belirt
      itemExtent: 80.0,
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: ItemWidget(item: items[index]),
        );
      },
    );
  }
}
```

## Sonsuz Kaydırma Uygulaması

### Android Paging 3 ile Sayfalama
```kotlin
class ItemPagingSource : PagingSource<Int, Item>() {
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Item> {
        return try {
            val page = params.key ?: 1
            val response = apiService.getItems(page, params.loadSize)
            
            LoadResult.Page(
                data = response.items,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.hasMore) page + 1 else null
            )
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }
}
```

### iOS Sayfalama Uygulaması
```swift
class PaginatedCollectionViewController: UICollectionViewController {
    private var items: [Item] = []
    private var isLoading = false
    private var hasMoreData = true
    
    override func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let offsetY = scrollView.contentOffset.y
        let contentHeight = scrollView.contentSize.height
        let frameHeight = scrollView.frame.size.height
        
        if offsetY > contentHeight - frameHeight - 200 {
            loadMoreDataIfNeeded()
        }
    }
    
    private func loadMoreDataIfNeeded() {
        guard !isLoading && hasMoreData else { return }
        
        isLoading = true
        // Daha fazla veri yükle
    }
}
```

## Performans Optimizasyon Teknikleri

### Bellek Yönetimi
```kotlin
// Android Bellek Optimizasyonu
class MemoryEfficientAdapter : RecyclerView.Adapter<ViewHolder>() {
    override fun onViewRecycled(holder: ViewHolder) {
        super.onViewRecycled(holder)
        // Görünüm geri dönüştürüldüğünde kaynakları temizle
        holder.clearResources()
    }
}
```

### Kaydırma Performansı İzleme
```kotlin
class ScrollPerformanceMonitor {
    private var frameDropCount = 0
    
    fun monitorScrollPerformance(recyclerView: RecyclerView) {
        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                // Takılmalı kaydırmayı izle
                if (isFrameDropped()) {
                    frameDropCount++
                }
            }
        })
    }
}
``` 