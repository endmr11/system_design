# Pagination & Infinite Scroll

Essential techniques for efficiently loading and displaying large datasets in mobile applications.

## Pagination Architecture Patterns

### Traditional Pagination
- **Offset-Based Pagination**: 
  - Page-based navigation with `?page=2&limit=20`
  - Simple implementation but performance issues with large datasets
  - Database query optimization challenges with skip-limit pattern
- **Cursor-Based Pagination**:
  - Stateful navigation with `?after=cursor_id&limit=20`
  - Consistent results even with data changes
  - Better performance for large datasets

### Mobile-Optimized Pagination Strategies
- **Progressive Loading**: Small initial page, larger subsequent pages
- **Adaptive Page Sizes**: Dynamic page sizing based on network conditions
- **Predictive Loading**: Intelligent prefetching based on user behavior patterns

## Platform-Specific Pagination Implementations

### Android Pagination Solutions
- **Paging 3 Library Architecture**:
  - Data loading abstraction with PagingSource
  - Network + database coordination with RemoteMediator
  - RecyclerView integration with PagingDataAdapter
  - Loading/error state handling with LoadState
- **Advanced Features**:
  - Grouped content with Separators
  - Additional content with Headers/Footers
  - Error recovery with Retry mechanisms
  - Smooth scrolling with Placeholder support

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
        } catch (exception: Exception) {
            LoadResult.Error(exception)
        }
    }
    
    override fun getRefreshKey(state: PagingState<Int, Item>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}

// ViewModel Integration
class ItemViewModel(private val repository: ItemRepository) : ViewModel() {
    val items = Pager(
        config = PagingConfig(
            pageSize = 20,
            enablePlaceholders = false,
            prefetchDistance = 5
        ),
        pagingSourceFactory = { ItemPagingSource(repository.apiService, searchQuery) }
    ).flow.cachedIn(viewModelScope)
}

// Fragment Usage
class ItemFragment : Fragment() {
    private val adapter = ItemPagingAdapter()
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        recyclerView.adapter = adapter
        
        viewModel.items.observe(this) { pagingData ->
            adapter.submitData(lifecycle, pagingData)
        }
        
        // Load state handling
        adapter.addLoadStateListener { loadState ->
            when (loadState.refresh) {
                is LoadState.Loading -> showProgressBar()
                is LoadState.Error -> showError(loadState.refresh.error)
                is LoadState.NotLoading -> hideProgressBar()
            }
        }
    }
}
```

### iOS Pagination Solutions
- **UITableView/UICollectionView Prefetching**:
  - Prefetch data source delegate for predictive loading
  - Cell prefetching for smooth scrolling
  - Background loading coordination
- **Combine Framework Integration**:
  - Publisher-based pagination flows
  - Automatic retry and error handling
  - State management with CurrentValueSubject

```swift
// iOS Pagination Manager
class PaginationManager<T: Codable> {
    private var currentPage = 1
    private var isLoading = false
    private var hasMorePages = true
    
    @Published var items: [T] = []
    @Published var loadingState: LoadingState = .idle
    
    private let pageSize: Int
    private let apiService: APIService
    private var cancellables = Set<AnyCancellable>()
    
    init(pageSize: Int = 20, apiService: APIService) {
        self.pageSize = pageSize
        self.apiService = apiService
    }
    
    func loadNextPage() {
        guard !isLoading && hasMorePages else { return }
        
        isLoading = true
        loadingState = .loading
        
        apiService.fetchItems(page: currentPage, limit: pageSize)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    switch completion {
                    case .failure(let error):
                        self?.loadingState = .error(error)
                    case .finished:
                        self?.loadingState = .idle
                    }
                },
                receiveValue: { [weak self] response in
                    guard let self = self else { return }
                    
                    self.items.append(contentsOf: response.items)
                    self.currentPage += 1
                    self.hasMorePages = response.items.count == self.pageSize
                }
            )
            .store(in: &cancellables)
    }
    
    func refresh() {
        currentPage = 1
        hasMorePages = true
        items.removeAll()
        loadNextPage()
    }
}

// SwiftUI Integration
struct InfiniteScrollView<T: Codable & Identifiable>: View {
    @StateObject private var paginationManager: PaginationManager<T>
    
    var body: some View {
        List {
            ForEach(paginationManager.items) { item in
                ItemRow(item: item)
                    .onAppear {
                        if item.id == paginationManager.items.last?.id {
                            paginationManager.loadNextPage()
                        }
                    }
            }
            
            if paginationManager.loadingState == .loading {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .refreshable {
            paginationManager.refresh()
        }
        .onAppear {
            if paginationManager.items.isEmpty {
                paginationManager.loadNextPage()
            }
        }
    }
}
```

### Flutter Pagination Solutions
- **Built-in Scroll Controllers**:
  - ScrollController for scroll position detection
  - NotificationListener for scroll events
  - ListView.builder for efficient item rendering
- **External Packages**:
  - infinite_scroll_pagination for advanced features
  - pull_to_refresh for refresh functionality
  - cached_network_image for image pagination

```dart
// Flutter Pagination Controller
class PaginationController<T> extends ChangeNotifier {
  List<T> _items = [];
  bool _isLoading = false;
  bool _hasReachedMax = false;
  String? _error;
  
  List<T> get items => _items;
  bool get isLoading => _isLoading;
  bool get hasReachedMax => _hasReachedMax;
  String? get error => _error;
  
  final Future<PaginatedResponse<T>> Function(int page) _fetchPage;
  final int pageSize;
  int _currentPage = 1;
  
  PaginationController({
    required Future<PaginatedResponse<T>> Function(int page) fetchPage,
    this.pageSize = 20,
  }) : _fetchPage = fetchPage;
  
  Future<void> loadNextPage() async {
    if (_isLoading || _hasReachedMax) return;
    
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      final response = await _fetchPage(_currentPage);
      
      if (response.items.isEmpty) {
        _hasReachedMax = true;
      } else {
        _items.addAll(response.items);
        _currentPage++;
        _hasReachedMax = response.items.length < pageSize;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> refresh() async {
    _currentPage = 1;
    _hasReachedMax = false;
    _items.clear();
    await loadNextPage();
  }
}

// Flutter Infinite Scroll Widget
class InfiniteScrollListView<T> extends StatefulWidget {
  final PaginationController<T> controller;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final Widget? loadingWidget;
  final Widget? errorWidget;
  
  const InfiniteScrollListView({
    Key? key,
    required this.controller,
    required this.itemBuilder,
    this.loadingWidget,
    this.errorWidget,
  }) : super(key: key);
  
  @override
  _InfiniteScrollListViewState<T> createState() => _InfiniteScrollListViewState<T>();
}

class _InfiniteScrollListViewState<T> extends State<InfiniteScrollListView<T>> {
  final ScrollController _scrollController = ScrollController();
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    widget.controller.addListener(_onControllerUpdate);
    
    // Load initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.controller.items.isEmpty) {
        widget.controller.loadNextPage();
      }
    });
  }
  
  void _onScroll() {
    if (_isBottom) {
      widget.controller.loadNextPage();
    }
  }
  
  bool get _isBottom {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    return currentScroll >= (maxScroll * 0.9);
  }
  
  void _onControllerUpdate() => setState(() {});
  
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: widget.controller.refresh,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: widget.controller.hasReachedMax
            ? widget.controller.items.length
            : widget.controller.items.length + 1,
        itemBuilder: (context, index) {
          if (index >= widget.controller.items.length) {
            return widget.loadingWidget ?? 
                   const Center(child: CircularProgressIndicator());
          }
          
          return widget.itemBuilder(context, widget.controller.items[index]);
        },
      ),
    );
  }
  
  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    widget.controller.removeListener(_onControllerUpdate);
    super.dispose();
  }
}
```

### JavaScript/React Native Pagination
- **FlatList Optimization**:
  - onEndReached for infinite scroll
  - getItemLayout for performance
  - removeClippedSubviews for memory management
- **State Management Integration**:
  - Redux/Zustand for pagination state
  - React Query for server state management
  - SWR for data fetching and caching

```javascript
// React Native Pagination Hook
import { useState, useCallback, useRef } from 'react';

export const usePagination = (fetchFunction, pageSize = 20) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  const currentPage = useRef(1);
  const isLoadingMore = useRef(false);
  
  const loadMore = useCallback(async () => {
    if (loading || isLoadingMore.current || !hasMore) return;
    
    isLoadingMore.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchFunction({
        page: currentPage.current,
        limit: pageSize,
      });
      
      const newItems = response.data || [];
      
      setData(prevData => 
        currentPage.current === 1 ? newItems : [...prevData, ...newItems]
      );
      
      setHasMore(newItems.length === pageSize);
      currentPage.current += 1;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      isLoadingMore.current = false;
    }
  }, [fetchFunction, pageSize, loading, hasMore]);
  
  const refresh = useCallback(async () => {
    setRefreshing(true);
    currentPage.current = 1;
    setHasMore(true);
    setData([]);
    
    await loadMore();
    setRefreshing(false);
  }, [loadMore]);
  
  const reset = useCallback(() => {
    setData([]);
    setLoading(false);
    setRefreshing(false);
    setHasMore(true);
    setError(null);
    currentPage.current = 1;
  }, []);
  
  return {
    data,
    loading,
    refreshing,
    hasMore,
    error,
    loadMore,
    refresh,
    reset,
  };
};

// FlatList Implementation
import React, { useEffect } from 'react';
import { FlatList, ActivityIndicator, Text } from 'react-native';

const PaginatedList = ({ fetchItems, renderItem, keyExtractor }) => {
  const {
    data,
    loading,
    refreshing,
    hasMore,
    error,
    loadMore,
    refresh,
  } = usePagination(fetchItems);
  
  useEffect(() => {
    loadMore(); // Initial load
  }, []);
  
  const renderFooter = () => {
    if (!hasMore) return null;
    
    return (
      <ActivityIndicator 
        style={{ margin: 15 }} 
        size="small" 
        color="#0066cc" 
      />
    );
  };
  
  const renderError = () => {
    if (!error) return null;
    
    return (
      <Text style={{ textAlign: 'center', color: 'red', margin: 10 }}>
        {error}
      </Text>
    );
  };
  
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={loadMore}
      onEndReachedThreshold={0.1}
      onRefresh={refresh}
      refreshing={refreshing}
      ListFooterComponent={renderFooter}
      ListHeaderComponent={renderError}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={20}
      windowSize={10}
    />
  );
};
```

## Advanced Pagination Techniques

### Cursor-Based Implementation
- **Benefits**: Consistent pagination even with data changes
- **Implementation**: Use stable identifiers (timestamps, UUIDs)
- **Database Support**: Efficient queries with indexed cursor fields

```javascript
// Cursor-based API endpoint
app.get('/api/posts', async (req, res) => {
  const { after, limit = 20 } = req.query;
  
  const query = {
    ...(after && { createdAt: { $lt: new Date(after) } })
  };
  
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) + 1); // +1 to check if there are more
  
  const hasNextPage = posts.length > limit;
  const edges = posts.slice(0, limit);
  
  const pageInfo = {
    hasNextPage,
    endCursor: edges.length > 0 ? edges[edges.length - 1].createdAt : null,
  };
  
  res.json({
    edges: edges.map(post => ({ node: post })),
    pageInfo,
  });
});
```

### Virtual Scrolling for Large Lists
- **Use Cases**: Lists with thousands of items
- **Memory Optimization**: Render only visible items
- **Platform Libraries**: react-window, @tanstack/react-virtual

```javascript
// React Virtual Scrolling
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

const VirtualizedInfiniteList = ({ 
  items, 
  hasNextPage, 
  isNextPageLoading, 
  loadNextPage 
}) => {
  const itemCount = hasNextPage ? items.length + 1 : items.length;
  const isItemLoaded = index => !!items[index];
  
  const Item = ({ index, style }) => {
    const item = items[index];
    
    if (!item) {
      return (
        <div style={style}>
          <div>Loading...</div>
        </div>
      );
    }
    
    return (
      <div style={style}>
        <ItemComponent item={item} />
      </div>
    );
  };
  
  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadNextPage}
    >
      {({ onItemsRendered, ref }) => (
        <List
          ref={ref}
          height={400}
          itemCount={itemCount}
          itemSize={50}
          onItemsRendered={onItemsRendered}
        >
          {Item}
        </List>
      )}
    </InfiniteLoader>
  );
};
```

## Performance Optimization Strategies

### Memory Management
- **Item Recycling**: Reuse view components for better performance
- **Image Loading**: Lazy loading with placeholder images
- **Data Cleanup**: Remove off-screen items from memory

### Smooth Scrolling Techniques
- **Prefetch Distance**: Load data before reaching the end
- **Throttled Loading**: Prevent excessive API calls
- **Background Processing**: Load data on background threads

### Network Optimization
- **Request Consolidation**: Batch multiple page requests
- **Compression**: Use gzip compression for API responses
- **Caching Strategy**: Cache pages for offline browsing

```javascript
// Advanced Pagination with Caching
class PaginationCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  get(key) {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  has(key) {
    return this.cache.has(key);
  }
}

const paginationCache = new PaginationCache();

const fetchPageWithCache = async (page) => {
  const cacheKey = `page_${page}`;
  
  if (paginationCache.has(cacheKey)) {
    return paginationCache.get(cacheKey);
  }
  
  const response = await api.fetchPage(page);
  paginationCache.set(cacheKey, response);
  
  return response;
};
```

## Best Practices

### User Experience Guidelines
- **Loading States**: Show clear loading indicators
- **Error Handling**: Provide retry mechanisms for failed loads
- **Empty States**: Design meaningful empty state screens
- **Pull-to-Refresh**: Implement intuitive refresh gestures

### Performance Considerations
- **Page Size Optimization**: Balance between load time and user experience
- **Debounce Scrolling**: Prevent excessive scroll event handling
- **Memory Monitoring**: Track and optimize memory usage

### Accessibility Support
- **Screen Reader**: Announce loading states and page updates
- **Focus Management**: Maintain proper focus when new items load
- **Keyboard Navigation**: Support keyboard-only navigation patterns

This comprehensive pagination system provides efficient data loading while maintaining excellent user experience across all mobile platforms.
