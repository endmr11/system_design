# İstek Birleştirme & Debouncing

Mobil uygulamalarda ağ trafiğini optimize etmek ve kullanıcı deneyimini iyileştirmek için kritik teknikler.

## İstek Birleştirme Stratejileri

### Kavramsal Çerçeve
- **Purpose**: Multiple small requests'i tek network call'da birleştirme
- **Benefits**: 
  - Reduced network overhead
  - Battery optimization
  - Server load reduction
  - Improved network efficiency
  - Better user experience
- **Trade-offs**: 
  - Latency vs efficiency
  - Complexity vs simplicity
  - Memory usage vs performance
  - Real-time requirements vs batching benefits

### Uygulama Teknikleri

#### Zamana Dayalı Birleştirme
- **Fixed Time Windows**: 
  - Every 5 seconds'da accumulated requests'i send etme
  - Configurable window sizes based on use case
  - Priority-based window adjustment
- **Adaptive Time Windows**: 
  - Network conditions'a göre window size adjustment
  - Battery level consideration
  - User activity patterns
- **Implementation Patterns**:
  - **Android**: 
    - Handler.postDelayed() ile scheduled batching
    - WorkManager integration for background batching
    - JobScheduler for system-optimized scheduling
  - **iOS**: 
    - Timer.scheduledTimer() ile periodic execution
    - BackgroundTasks framework integration
    - Combine framework for reactive batching
  - **Flutter**: 
    - Timer.periodic() ile cross-platform batching
    - Isolate-based background processing
    - Stream-based batching implementation

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

#### Size-Based Batching
- **Request Count Limits**: 
  - Maximum 50 requests per batch
  - Dynamic limit adjustment based on payload size
  - Priority-based request inclusion
- **Payload Size Limits**: 
  - Maximum 1MB per batch request
  - Compression-aware size limits
  - Network type consideration
- **Memory Considerations**: 
  - Buffer overflow prevention
  - Memory pressure monitoring
  - Automatic batch splitting

### Platform-Spesifik Birleştirme Çözümleri

#### Firebase Analytics Batching
- **Automatic Batching**: 
  - Events are queued and sent in batches
  - Network availability awareness
  - Battery optimization integration
- **Custom Event Batching**:
  - Manual batch creation için custom implementation
  - Business logic integration ile intelligent batching

#### GraphQL Batching
- **Query Batching**: Multiple GraphQL queries'i single HTTP request'te
- **DataLoader Pattern**: N+1 query problem'ini solve etme
- **Implementation**: Apollo Client ile automatic request batching

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
- **Problem**: Her keystroke'da API call expensive ve unnecessary
- **Solution**: Wait for pause in typing before triggering search
- **Implementation Examples**:
  - **Android**: RxJava `debounce()` operator ile observable streams
  - **iOS**: Combine `debounce()` ile publisher transformation
  - **Flutter**: Timer cancellation ile manual debouncing
  - **React Native**: Lodash debounce ile utility-based approach

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
- **Leading Edge Debouncing**: First call immediate, subsequent calls debounced
- **Trailing Edge Debouncing**: Only last call after quiet period
- **Throttling vs Debouncing**: Rate limiting vs delay-based filtering

### Kullanıcı Etkileşimi Debouncing
- **Button Press Protection**: Prevent double-clicks ile duplicate actions
- **Form Submission**: Prevent multiple form submissions
- **Navigation Actions**: Prevent rapid navigation transitions

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
- **In-Flight Request Tracking**: Same API calls'ı deduplicate etme
- **Cache-First Strategies**: Check cache before making network requests
- **Request Coalescing**: Similar requests'i single request'e merge etme

### Öncelik Tabanlı Kuyruk
- **High Priority**: User-initiated actions
- **Medium Priority**: Background data refresh
- **Low Priority**: Analytics, metrics, non-critical updates
- **Implementation**: Custom queue management ile request prioritization

## Performans İzleme
- **Request Batching Metrics**: Batch size distribution, success rates
- **Debouncing Effectiveness**: Reduced request count, user satisfaction
- **Network Efficiency**: Bandwidth savings, response time improvements
