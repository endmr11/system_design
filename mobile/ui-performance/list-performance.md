# Liste ve Kaydırma Performansı

Liste performansı, mobil uygulamalarda en hızlı hissedilen kalite göstergelerinden biridir. Feed, mesaj listesi, ürün kataloğu veya log ekranı gibi yüzlerce öğe gösteren yüzeylerde küçük render hataları bile jank, yüksek bellek kullanımı ve batarya tüketimi olarak kullanıcıya döner.

Bu sayfa liste render etme, sonsuz kaydırma, ön yükleme, bellek temizliği ve performans ölçümü kararlarını birlikte ele alır.

## Temel Hedefler

- İlk ekrana hızlı içerik getirmek
- Scroll sırasında 60 FPS hedefini korumak
- Görünmeyen öğelerin UI ve görsel kaynaklarını serbest bırakmak
- Veri yükleme ile render maliyetini birbirinden ayırmak
- Pagination, empty state, loading state ve error state davranışını açık tutmak

## Android RecyclerView Teknikleri

### ViewHolder Deseni

```kotlin
class OptimizedViewHolder(
    private val binding: ItemBinding
) : RecyclerView.ViewHolder(binding.root) {

    fun bind(item: DataItem) {
        binding.title.text = item.title
        binding.subtitle.text = item.subtitle
    }

    fun clear() {
        binding.thumbnail.setImageDrawable(null)
    }
}
```

ViewHolder içinde `findViewById` tekrarından kaçınmak, görselleri recycle anında temizlemek ve bind işlemini hafif tutmak scroll performansını doğrudan etkiler. Ağ isteği veya ağır formatlama bind sırasında yapılmamalıdır.

### DiffUtil ve Payload

```kotlin
class ItemDiffCallback : DiffUtil.ItemCallback<DataItem>() {
    override fun areItemsTheSame(oldItem: DataItem, newItem: DataItem): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: DataItem, newItem: DataItem): Boolean {
        return oldItem == newItem
    }

    override fun getChangePayload(oldItem: DataItem, newItem: DataItem): Any? {
        return when {
            oldItem.title != newItem.title -> "title_changed"
            oldItem.subtitle != newItem.subtitle -> "subtitle_changed"
            else -> null
        }
    }
}
```

DiffUtil tam listeyi yeniden çizmek yerine değişen öğeleri günceller. Payload kullanımı, yalnızca değişen alanı bind ederek pahalı image veya layout işlemlerini tekrar çalıştırmayı önler.

## iOS UICollectionView Teknikleri

### Prefetching

```swift
final class FeedViewController: UICollectionViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        collectionView.isPrefetchingEnabled = true
        collectionView.prefetchDataSource = self
    }
}

extension FeedViewController: UICollectionViewDataSourcePrefetching {
    func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            imageLoader.prefetch(at: indexPath)
        }
    }

    func collectionView(_ collectionView: UICollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            imageLoader.cancelPrefetch(at: indexPath)
        }
    }
}
```

Prefetching görsel ve veri hazırlığını kullanıcı ilgili hücreye gelmeden başlatır. Cancel mekanizması yoksa hızlı scroll sırasında gereksiz ağ ve CPU işi birikir.

## Flutter ListView Teknikleri

```dart
class PerformantListView extends StatelessWidget {
  const PerformantListView({super.key, required this.items});

  final List<Item> items;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      itemExtent: 80,
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: ItemTile(item: items[index]),
        );
      },
    );
  }
}
```

`ListView.builder` görünmeyen öğeleri üretmez. Sabit yükseklik biliniyorsa `itemExtent` veya `prototypeItem` kullanmak layout hesaplamasını azaltır. Karmaşık hücrelerde `RepaintBoundary`, tüm listenin yeniden boyanmasını engellemeye yardımcı olur.

## Sonsuz Kaydırma

### Android Paging 3

```kotlin
class ItemPagingSource(
    private val api: ItemApi
) : PagingSource<Int, Item>() {
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Item> {
        return try {
            val page = params.key ?: 1
            val response = api.getItems(page, params.loadSize)

            LoadResult.Page(
                data = response.items,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.hasMore) page + 1 else null
            )
        } catch (error: Exception) {
            LoadResult.Error(error)
        }
    }
}
```

Paging tasarımında en kritik karar `nextKey` üretimidir. Offset tabanlı pagination basit ama veri eklenip silindiğinde kayma yaratabilir. Cursor tabanlı pagination feed ve mesajlaşma gibi sürekli değişen listelerde daha güvenlidir.

### iOS Threshold Loading

```swift
final class PaginatedCollectionViewController: UICollectionViewController {
    private var isLoading = false
    private var hasMoreData = true

    override func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let remaining = scrollView.contentSize.height - scrollView.contentOffset.y - scrollView.frame.height

        if remaining < 240 {
            loadMoreDataIfNeeded()
        }
    }

    private func loadMoreDataIfNeeded() {
        guard !isLoading, hasMoreData else { return }
        isLoading = true
        // Sonraki sayfayı yükle.
    }
}
```

Threshold loading kullanırken aynı sayfanın iki kez istenmesini engellemek gerekir. `isLoading`, `hasMoreData` ve idempotent page token bu nedenle birlikte tutulmalıdır.

## Bellek Yönetimi

Görüntü tabanlı listelerde en büyük maliyet çoğunlukla cell/view değil image decode ve cache davranışıdır. Büyük görseller liste hücresi boyutuna göre downsample edilmelidir. Recycled hücrelerde eski image request iptal edilmeli ve placeholder state doğru gösterilmelidir.

Kontrol noktaları:

- Görseller hedef boyuta göre decode ediliyor mu?
- Hızlı scroll sırasında iptal edilen request sayısı izleniyor mu?
- Cell recycle olduğunda eski async callback yanlış hücreye yazıyor mu?
- Empty, loading ve error row'ları normal item'lardan ayrılıyor mu?
- Büyük listede selection state item identity ile mi tutuluyor?

## Performans Ölçümü

| Alan | Ölçüm | Hedef |
| --- | --- | --- |
| Frame time | Android FrameMetrics, Xcode Instruments, Flutter DevTools | 16.6 ms altında kalmak |
| Dropped frame | Jank oranı | Kritik ekranlarda düşük ve izlenebilir |
| Memory | Heap, image cache, retained views | Scroll sonrası düşebilmeli |
| Pagination | Page load p95 | Kullanıcı eşiğe gelmeden tamamlanmalı |
| Error | Page retry ve failure oranı | Telemetry ile görünür olmalı |

## Yaygın Hatalar

- Bütün listeyi `setState` veya global state değişikliğiyle yeniden çizmek
- Image decode işlemini UI thread üzerinde yapmak
- Stable key/id kullanmamak
- Pagination request'lerini debounce etmemek
- Liste item'ında gereksiz gölge, blur veya pahalı layout kullanmak
- Çok büyük JSON'u tek seferde parse edip listeye basmak
- Scroll performansını yalnızca güçlü cihazda test etmek

## Kontrol Listesi

- [ ] Liste stable id veya key kullanıyor.
- [ ] Sadece görünür öğeler render ediliyor.
- [ ] Görsel request'leri recycle veya hızlı scroll sırasında iptal ediliyor.
- [ ] Pagination duplicate request üretmiyor.
- [ ] Loading, empty, error ve retry state'leri açık.
- [ ] Scroll performansı düşük seviye cihazda ölçüldü.
- [ ] Liste item'ı gereksiz global state okumuyor.
