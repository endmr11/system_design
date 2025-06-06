# Sayfalama & Sonsuz Kaydırma

Mobil uygulamalarda büyük veri setlerini verimli şekilde yüklemek ve göstermek için kullanılan temel teknikler.

## Sayfalama Mimari Desenleri

### Geleneksel Sayfalama
- **Offset-Based Pagination**: 
  - `?page=2&limit=20` ile page-based navigation
  - Simple implementation ama large datasets'te performance issues
  - Skip-limit pattern ile database query optimization challenges
- **Cursor-Based Pagination**:
  - `?after=cursor_id&limit=20` ile stateful navigation
  - Consistent results even with data changes
  - Better performance for large datasets

### Mobil-Optimize Sayfalama Stratejileri
- **Progressive Loading**: Small initial page, larger subsequent pages
- **Adaptive Page Sizes**: Network conditions'a göre dynamic page sizing
- **Predictive Loading**: User behavior patterns ile intelligent prefetching

## Platform-Spesifik Sayfalama Uygulamaları

### Android Sayfalama Çözümleri
- **Paging 3 Library Architecture**:
  - PagingSource ile data loading abstraction
  - RemoteMediator ile network + database coordination
  - PagingDataAdapter ile RecyclerView integration
  - LoadState handling ile loading/error states
- **Advanced Features**:
  - Separators ile grouped content
  - Headers/Footers ile additional content
  - Retry mechanisms ile error recovery
  - Placeholder support ile smooth scrolling

```kotlin
// Android Paging 3 Implementation
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

// Repository Implementation
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

// Adapter Implementation
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
- **UICollectionView Pagination**:
  - `UICollectionViewDiffableDataSource` ile modern approach
  - `willDisplay` delegate methods ile load triggers
  - `NSFetchedResultsController` ile Core Data integration
- **SwiftUI Pagination**:
  - LazyVStack ile efficient list rendering
  - @StateObject ile pagination state management
  - Combine publishers ile reactive data loading

```swift
// iOS UICollectionView Pagination
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

// SwiftUI Pagination
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
            .navigationTitle("Items")
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

### Flutter Pagination Solutions
- **infinite_scroll_pagination Package**:
  - PagingController ile state management
  - Built-in error handling ile user experience
  - Custom item builders ile flexible UI
- **Custom Pagination Implementation**:
  - ScrollController ile scroll position detection
  - FutureBuilder ile async data loading
  - State management ile pagination coordination

```dart
// Flutter Custom Pagination Implementation
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
                Text('Error: $_error'),
                ElevatedButton(
                  onPressed: _loadPage,
                  child: Text('Retry'),
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

## Infinite Scroll Implementation

### Scroll Detection Mechanisms
- **Threshold-Based Loading**: Load when 80% scrolled
- **Predictive Loading**: Load based on scroll velocity
- **Viewport-Based Loading**: Load when approaching visible area

### Performance Optimization Techniques
- **View Recycling**: 
  - RecyclerView ViewHolder pattern (Android)
  - UITableView cell reuse (iOS)
  - ListView.builder efficient rendering (Flutter)
- **Memory Management**:
  - Window-based data management
  - Automatic data cleanup for distant items
  - Image lazy loading ile memory optimization

### Advanced Infinite Scroll Features
- **Bidirectional Scrolling**: Both forward and backward pagination
- **Pull-to-Refresh Integration**: Manual refresh capability
- **Empty State Handling**: No more data scenarios
- **Error State Recovery**: Network error ile retry mechanisms

## Data Consistency Challenges

### Real-Time Data Updates
- **New Item Insertion**: Handle newly added items during pagination
- **Item Modifications**: Update existing items without breaking pagination
- **Item Deletions**: Remove items while maintaining scroll position

### Concurrent Access Management
- **Race Condition Prevention**: Multiple page loads'ı coordinate etme
- **Cache Coordination**: Ensure consistency between cached and fresh data
- **State Synchronization**: Multi-screen pagination state management

## Network Optimization

### Smart Prefetching
- **Usage Pattern Analysis**: Learn user scrolling behavior
- **Network Condition Awareness**: Adjust prefetch strategy based on connection
- **Battery Consideration**: Reduce prefetching on low battery

### Request Optimization
- **Request Deduplication**: Prevent duplicate page requests
- **Request Cancellation**: Cancel unnecessary requests on scroll direction change
- **Batch Loading**: Load multiple pages in single request when appropriate

## Metrics & Analytics
- **Scroll Depth Tracking**: How far users typically scroll
- **Page Load Performance**: Time to load each page
- **User Engagement**: Correlation between pagination and user retention
- **Error Rate Monitoring**: Failed page loads ile user experience impact
