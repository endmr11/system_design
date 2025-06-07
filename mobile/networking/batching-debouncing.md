# İstek Birleştirme & Debouncing

Mobil uygulamalarda ağ trafiğini optimize etmek ve kullanıcı deneyimini iyileştirmek için kritik teknikler.

## İstek Birleştirme Stratejileri

### Kavramsal Çerçeve
- **Amaç**: Birden fazla küçük isteği tek bir ağ çağrısında birleştirme
- **Faydalar**: 
  - Ağ yükünün azaltılması
  - Batarya optimizasyonu
  - Sunucu yükünün azaltılması
  - Ağ verimliliğinin artırılması
  - Daha iyi kullanıcı deneyimi
- **Ödünleşimler**: 
  - Gecikme vs verimlilik
  - Karmaşıklık vs basitlik
  - Bellek kullanımı vs performans
  - Gerçek zamanlı gereksinimler vs birleştirme faydaları

### Uygulama Teknikleri

#### Zamana Dayalı Birleştirme
- **Sabit Zaman Pencereleri**: 
  - Her 5 saniyede birikmiş istekleri gönderme
  - Kullanım durumuna göre yapılandırılabilir pencere boyutları
  - Öncelik tabanlı pencere ayarlaması
- **Uyarlanabilir Zaman Pencereleri**: 
  - Ağ koşullarına göre pencere boyutu ayarlaması
  - Batarya seviyesi dikkate alma
  - Kullanıcı aktivite kalıpları
- **Uygulama Desenleri**:
  - **Android**: 
    - Handler.postDelayed() ile zamanlanmış birleştirme
    - Arka plan birleştirme için WorkManager entegrasyonu
    - Sistem optimizasyonlu zamanlama için JobScheduler
  - **iOS**: 
    - Timer.scheduledTimer() ile periyodik çalıştırma
    - BackgroundTasks framework entegrasyonu
    - Reaktif birleştirme için Combine framework
  - **Flutter**: 
    - Timer.periodic() ile çapraz platform birleştirme
    - İzole tabanlı arka plan işleme
    - Akış tabanlı birleştirme uygulaması

```kotlin
// Android Time-Based Batching Implementation
class RequestBatcher<T> {
    private val pendingRequests = mutableListOf<T>()
    private val batchHandler = Handler(Looper.getMainLooper())
    private var batchRunnable: Runnable? = null
    
    private val batchSize = 20
    private val batchTimeoutMs = 5000L
    
    fun addRequest(request: T) {
        synchronized(pendingRequests) {
            pendingRequests.add(request)
            
            // Size-based trigger
            if (pendingRequests.size >= batchSize) {
                processBatch()
                return
            }
            
            // Time-based trigger
            if (batchRunnable == null) {
                batchRunnable = Runnable {
                    processBatch()
                }.also { runnable ->
                    batchHandler.postDelayed(runnable, batchTimeoutMs)
                }
            }
        }
    }
    
    private fun processBatch() {
        synchronized(pendingRequests) {
            if (pendingRequests.isEmpty()) return
            
            val batch = pendingRequests.toList()
            pendingRequests.clear()
            
            batchRunnable?.let { batchHandler.removeCallbacks(it) }
            batchRunnable = null
            
            // Process batch in background
            executeBatch(batch)
        }
    }
    
    private fun executeBatch(requests: List<T>) {
        // Network call with batched requests
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val response = apiService.batchRequests(requests)
                handleBatchResponse(response)
            } catch (e: Exception) {
                handleBatchError(e, requests)
            }
        }
    }
}
```

```swift
// iOS Combine-Based Batching
class RequestBatcher<T> {
    private let subject = PassthroughSubject<T, Never>()
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        subject
            .collect(.byTimeOrCount(
                .main, 
                strategy: .byTimeOrCount(5.0, 20)
            ))
            .sink { [weak self] batch in
                self?.processBatch(Array(batch))
            }
            .store(in: &cancellables)
    }
    
    func addRequest(_ request: T) {
        subject.send(request)
    }
    
    private func processBatch(_ requests: [T]) {
        Task {
            do {
                let response = try await apiService.batchRequests(requests)
                await handleBatchResponse(response)
            } catch {
                await handleBatchError(error, requests)
            }
        }
    }
}
```

#### Boyut Tabanlı Birleştirme
- **İstek Sayısı Limitleri**: 
  - Toplu başına maksimum 50 istek
  - Yük boyutuna göre dinamik limit ayarlaması
  - Öncelik tabanlı istek dahil etme
- **Yük Boyutu Limitleri**: 
  - Toplu istek başına maksimum 1MB
  - Sıkıştırma farkında boyut limitleri
  - Ağ tipi dikkate alma
- **Bellek Hususları**: 
  - Tampon taşması önleme
  - Bellek basıncı izleme
  - Otomatik toplu bölme

### Platform Özel Birleştirme Çözümleri

#### Firebase Analytics Birleştirme
- **Otomatik Birleştirme**: 
  - Olaylar kuyruğa alınır ve toplu olarak gönderilir
  - Ağ kullanılabilirliği farkındalığı
  - Batarya optimizasyonu entegrasyonu
- **Özel Olay Birleştirme**:
  - Manuel toplu oluşturma için özel uygulama
  - İş mantığı entegrasyonu ile akıllı birleştirme

#### GraphQL Birleştirme
- **Sorgu Birleştirme**: Birden fazla GraphQL sorgusunu tek HTTP isteğinde
- **DataLoader Deseni**: N+1 sorgu problemini çözme
- **Uygulama**: Apollo Client ile otomatik istek birleştirme

```dart
// Flutter GraphQL Batching
class GraphQLBatcher {
  final List<QueryRequest> _pendingQueries = [];
  Timer? _batchTimer;
  final Duration batchWindow = Duration(milliseconds: 10);
  
  Future<QueryResult> executeQuery(String query, Map<String, dynamic> variables) {
    final completer = Completer<QueryResult>();
    final request = QueryRequest(query, variables, completer);
    
    _pendingQueries.add(request);
    
    _batchTimer?.cancel();
    _batchTimer = Timer(batchWindow, () {
      _executeBatch();
    });
    
    return completer.future;
  }
  
  void _executeBatch() {
    if (_pendingQueries.isEmpty) return;
    
    final batch = List<QueryRequest>.from(_pendingQueries);
    _pendingQueries.clear();
    
    final batchedQuery = _createBatchQuery(batch);
    
    _httpClient.post('/graphql', body: batchedQuery).then((response) {
      final results = _parseBatchResponse(response.body);
      for (int i = 0; i < batch.length; i++) {
        batch[i].completer.complete(results[i]);
      }
    }).catchError((error) {
      for (final request in batch) {
        request.completer.completeError(error);
      }
    });
  }
  
  String _createBatchQuery(List<QueryRequest> requests) {
    final queries = requests.asMap().entries.map((entry) {
      final index = entry.key;
      final request = entry.value;
      return 'query$index: ${request.query}';
    }).join('\n');
    
    return '{\n$queries\n}';
  }
}

class QueryRequest {
  final String query;
  final Map<String, dynamic> variables;
  final Completer<QueryResult> completer;
  
  QueryRequest(this.query, this.variables, this.completer);
}
```

## Debouncing Mekanizmaları

### Arama Girişi Debouncing
- **Problem**: Her tuş vuruşunda API çağrısı maliyetli ve gereksiz
- **Çözüm**: Aramayı tetiklemeden önce yazma duraklamasını bekleme
- **Uygulama Örnekleri**:
  - **Android**: RxJava `debounce()` operatörü ile gözlemlenebilir akışlar
  - **iOS**: Combine `debounce()` ile yayıncı dönüşümü
  - **Flutter**: Zamanlayıcı iptali ile manuel debouncing
  - **React Native**: Lodash debounce ile yardımcı program tabanlı yaklaşım

```kotlin
// Android RxJava Debouncing
class SearchDebouncer {
    private val searchSubject = PublishSubject.create<String>()
    private val compositeDisposable = CompositeDisposable()
    
    init {
        searchSubject
            .debounce(300, TimeUnit.MILLISECONDS)
            .distinctUntilChanged()
            .switchMap { query ->
                if (query.isBlank()) {
                    Observable.just(emptyList<SearchResult>())
                } else {
                    searchService.search(query)
                        .subscribeOn(Schedulers.io())
                        .observeOn(AndroidSchedulers.mainThread())
                        .onErrorReturn { emptyList() }
                }
            }
            .subscribe { results ->
                updateSearchResults(results)
            }
            .let { compositeDisposable.add(it) }
    }
    
    fun onSearchTextChanged(query: String) {
        searchSubject.onNext(query)
    }
    
    fun dispose() {
        compositeDisposable.dispose()
    }
}
```

```swift
// iOS Combine Debouncing
class SearchDebouncer: ObservableObject {
    @Published var searchText = ""
    @Published var searchResults: [SearchResult] = []
    
    private var cancellables = Set<AnyCancellable>()
    private let searchService: SearchService
    
    init(searchService: SearchService) {
        self.searchService = searchService
        
        $searchText
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .removeDuplicates()
            .sink { [weak self] query in
                self?.performSearch(query: query)
            }
            .store(in: &cancellables)
    }
    
    private func performSearch(query: String) {
        guard !query.isEmpty else {
            searchResults = []
            return
        }
        
        searchService.search(query: query)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { [weak self] results in
                    self?.searchResults = results
                }
            )
            .store(in: &cancellables)
    }
}
```

### Gelişmiş Debouncing Desenleri
- **Ön Uç Debouncing**: İlk çağrı anında, sonraki çağrılar debounced
- **Arka Uç Debouncing**: Sessizlik periyodundan sonra sadece son çağrı
- **Kısıtlama vs Debouncing**: Hız sınırlama vs gecikme tabanlı filtreleme

### Kullanıcı Etkileşimi Debouncing
- **Düğme Basma Koruması**: Çift tıklama ile yinelenen eylemleri önleme
- **Form Gönderimi**: Çoklu form gönderimlerini önleme
- **Gezinme Eylemleri**: Hızlı gezinme geçişlerini önleme

```dart
// Flutter Custom Debouncer
class Debouncer {
  final Duration delay;
  Timer? _timer;
  
  Debouncer({required this.delay});
  
  void call(VoidCallback action) {
    _timer?.cancel();
    _timer = Timer(delay, action);
  }
  
  void dispose() {
    _timer?.cancel();
  }
}

// Usage in Widget
class SearchWidget extends StatefulWidget {
  @override
  _SearchWidgetState createState() => _SearchWidgetState();
}

class _SearchWidgetState extends State<SearchWidget> {
  final _debouncer = Debouncer(delay: Duration(milliseconds: 300));
  final _controller = TextEditingController();
  
  @override
  void dispose() {
    _debouncer.dispose();
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: (value) {
        _debouncer.call(() {
          _performSearch(value);
        });
      },
    );
  }
  
  void _performSearch(String query) {
    // Search implementation
  }
}
```

## Akıllı İstek Optimizasyonu

### İstek Tekrarı Önleme
- **Devam Eden İstek Takibi**: Aynı API çağrılarını tekrarlamama
- **Önbellek Öncelikli Stratejiler**: Ağ isteklerinden önce önbelleği kontrol etme
- **İstek Birleştirme**: Benzer istekleri tek bir isteğe birleştirme

### Öncelik Tabanlı Kuyruk
- **Yüksek Öncelik**: Kullanıcı başlatılan eylemler
- **Orta Öncelik**: Arka plan veri yenileme
- **Düşük Öncelik**: Analitik, metrikler, kritik olmayan güncellemeler
- **Uygulama**: İstek önceliklendirme ile özel kuyruk yönetimi

## Performans İzleme
- **İstek Birleştirme Metrikleri**: Toplu boyut dağılımı, başarı oranları
- **Debouncing Etkinliği**: Azaltılmış istek sayısı, kullanıcı memnuniyeti
- **Ağ Verimliliği**: Bant genişliği tasarrufu, yanıt süresi iyileştirmeleri
