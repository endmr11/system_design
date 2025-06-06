# List Performance and Infinite Scroll Optimization

List performance is crucial for mobile applications that display large datasets. This section covers advanced techniques for optimizing list rendering, implementing efficient infinite scroll, and managing memory during scroll operations.

## Virtual Scrolling Implementation

### React Native FlatList Optimization
```javascript
// React Native - Advanced FlatList optimization
import React, { useMemo, useCallback, useState, useRef } from 'react';
import { FlatList, Dimensions, Platform } from 'react-native';

const VirtualizedList = ({ 
  data, 
  renderItem, 
  onEndReached,
  estimatedItemSize = 80,
  overscan = 5 
}) => {
  const [viewportHeight, setViewportHeight] = useState(Dimensions.get('window').height);
  const flatListRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  
  // Calculate visible range based on scroll position
  const getVisibleRange = useCallback((offset, height) => {
    const startIndex = Math.floor(offset / estimatedItemSize);
    const endIndex = Math.min(
      data.length - 1,
      Math.ceil((offset + height) / estimatedItemSize) + overscan
    );
    
    return {
      start: Math.max(0, startIndex - overscan),
      end: endIndex
    };
  }, [data.length, estimatedItemSize, overscan]);
  
  // Memoized visible data
  const visibleData = useMemo(() => {
    const range = getVisibleRange(scrollOffsetRef.current, viewportHeight);
    return data.slice(range.start, range.end + 1).map((item, index) => ({
      ...item,
      originalIndex: range.start + index
    }));
  }, [data, getVisibleRange, viewportHeight]);
  
  // Optimized scroll handler
  const handleScroll = useCallback((event) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);
  
  // Layout measurement
  const handleLayout = useCallback((event) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);
  
  // Memoized render item
  const memoizedRenderItem = useCallback(({ item, index }) => {
    return (
      <VirtualizedListItem
        item={item}
        index={item.originalIndex}
        renderItem={renderItem}
      />
    );
  }, [renderItem]);
  
  // Key extractor optimization
  const keyExtractor = useCallback((item) => {
    return item.id ? item.id.toString() : item.originalIndex.toString();
  }, []);
  
  // Get item layout for better performance
  const getItemLayout = useCallback((data, index) => ({
    length: estimatedItemSize,
    offset: estimatedItemSize * index,
    index,
  }), [estimatedItemSize]);
  
  return (
    <FlatList
      ref={flatListRef}
      data={visibleData}
      renderItem={memoizedRenderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      onLayout={handleLayout}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={15}
      updateCellsBatchingPeriod={100}
      
      // Infinite scroll
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      
      // Memory optimization
      disableVirtualization={false}
    />
  );
};

// Memoized list item component
const VirtualizedListItem = React.memo(({ item, index, renderItem }) => {
  return renderItem({ item, index });
});

// Advanced infinite scroll with intelligent loading
const InfiniteScrollList = ({ 
  loadData, 
  renderItem,
  pageSize = 20,
  loadingThreshold = 5
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  const loadingRef = useRef(false);
  const pageRef = useRef(0);
  
  // Load initial data
  useEffect(() => {
    loadNextPage();
  }, []);
  
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const newData = await loadData(pageRef.current, pageSize);
      
      if (newData.length < pageSize) {
        setHasMore(false);
      }
      
      setData(prevData => [...prevData, ...newData]);
      pageRef.current += 1;
    } catch (err) {
      setError(err);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [loadData, pageSize, hasMore]);
  
  // Smart end reached handler
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && data.length >= loadingThreshold) {
      loadNextPage();
    }
  }, [loading, hasMore, data.length, loadingThreshold, loadNextPage]);
  
  // Refresh handler
  const handleRefresh = useCallback(async () => {
    pageRef.current = 0;
    setData([]);
    setHasMore(true);
    setError(null);
    await loadNextPage();
  }, [loadNextPage]);
  
  // Footer component
  const renderFooter = useCallback(() => {
    if (!loading) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  }, [loading]);
  
  return (
    <VirtualizedList
      data={data}
      renderItem={renderItem}
      onEndReached={handleEndReached}
      onRefresh={handleRefresh}
      refreshing={loading && data.length === 0}
      ListFooterComponent={renderFooter}
    />
  );
};

// Bidirectional infinite scroll
const BidirectionalInfiniteList = ({ loadData, renderItem }) => {
  const [data, setData] = useState([]);
  const [topOffset, setTopOffset] = useState(0);
  const flatListRef = useRef(null);
  
  const loadMoreTop = useCallback(async () => {
    const newData = await loadData('top', data[0]?.timestamp);
    
    setData(prevData => [...newData, ...prevData]);
    
    // Maintain scroll position
    if (flatListRef.current && newData.length > 0) {
      flatListRef.current.scrollToOffset({
        offset: topOffset + (newData.length * 80), // Estimated item height
        animated: false
      });
    }
  }, [data, topOffset]);
  
  const loadMoreBottom = useCallback(async () => {
    const lastItem = data[data.length - 1];
    const newData = await loadData('bottom', lastItem?.timestamp);
    
    setData(prevData => [...prevData, ...newData]);
  }, [data]);
  
  const handleScroll = useCallback((event) => {
    const { contentOffset } = event.nativeEvent;
    setTopOffset(contentOffset.y);
    
    // Load more at top when scrolling up
    if (contentOffset.y < 100) {
      loadMoreTop();
    }
  }, [loadMoreTop]);
  
  return (
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={renderItem}
      onScroll={handleScroll}
      onEndReached={loadMoreBottom}
      keyExtractor={(item) => item.id}
      // ... other props
    />
  );
};
```

### iOS UICollectionView Optimization
```swift
// iOS - Optimized collection view with prefetching
class OptimizedCollectionViewController: UICollectionViewController {
    
    private var dataSource: [DataItem] = []
    private var loadingIndexPaths: Set<IndexPath> = []
    private let prefetchQueue = OperationQueue()
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupCollectionView()
        setupPrefetching()
    }
    
    private func setupCollectionView() {
        // Enable prefetching
        collectionView.isPrefetchingEnabled = true
        collectionView.prefetchDataSource = self
        
        // Optimize layout
        if let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout {
            layout.estimatedItemSize = CGSize(width: 150, height: 200)
            layout.itemSize = UICollectionViewFlowLayout.automaticSize
        }
        
        // Register cells
        collectionView.register(
            OptimizedCollectionViewCell.self,
            forCellWithReuseIdentifier: "OptimizedCell"
        )
    }
    
    private func setupPrefetching() {
        prefetchQueue.maxConcurrentOperationCount = 5
        prefetchQueue.qualityOfService = .userInitiated
    }
    
    // MARK: - UICollectionViewDataSource
    
    override func collectionView(
        _ collectionView: UICollectionView,
        numberOfItemsInSection section: Int
    ) -> Int {
        return dataSource.count
    }
    
    override func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: "OptimizedCell",
            for: indexPath
        ) as! OptimizedCollectionViewCell
        
        let item = dataSource[indexPath.item]
        cell.configure(with: item)
        
        // Check if we need to load more data
        if indexPath.item >= dataSource.count - 5 {
            loadMoreDataIfNeeded()
        }
        
        return cell
    }
    
    // MARK: - Infinite Scroll
    
    private func loadMoreDataIfNeeded() {
        guard !isLoadingData else { return }
        
        isLoadingData = true
        
        DataManager.shared.loadMoreData { [weak self] newItems in
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                let startIndex = self.dataSource.count
                self.dataSource.append(contentsOf: newItems)
                
                let indexPaths = (startIndex..<self.dataSource.count).map {
                    IndexPath(item: $0, section: 0)
                }
                
                self.collectionView.insertItems(at: indexPaths)
                self.isLoadingData = false
            }
        }
    }
    
    private var isLoadingData = false
}

// MARK: - UICollectionViewDataSourcePrefetching

extension OptimizedCollectionViewController: UICollectionViewDataSourcePrefetching {
    
    func collectionView(
        _ collectionView: UICollectionView,
        prefetchItemsAt indexPaths: [IndexPath]
    ) {
        for indexPath in indexPaths {
            guard indexPath.item < dataSource.count else { continue }
            
            let item = dataSource[indexPath.item]
            
            // Prefetch images
            if let imageURL = item.imageURL {
                prefetchImage(at: imageURL, for: indexPath)
            }
            
            // Prefetch additional data if needed
            prefetchAdditionalData(for: item, at: indexPath)
        }
    }
    
    func collectionView(
        _ collectionView: UICollectionView,
        cancelPrefetchingForItemsAt indexPaths: [IndexPath]
    ) {
        for indexPath in indexPaths {
            // Cancel prefetch operations
            cancelPrefetch(for: indexPath)
        }
    }
    
    private func prefetchImage(at url: URL, for indexPath: IndexPath) {
        loadingIndexPaths.insert(indexPath)
        
        let operation = BlockOperation {
            SDWebImagePrefetcher.shared.prefetchURLs([url]) { [weak self] _, _ in
                DispatchQueue.main.async {
                    self?.loadingIndexPaths.remove(indexPath)
                }
            }
        }
        
        prefetchQueue.addOperation(operation)
    }
    
    private func prefetchAdditionalData(for item: DataItem, at indexPath: IndexPath) {
        // Prefetch related data
        let operation = BlockOperation {
            DataManager.shared.prefetchRelatedData(for: item) { _ in
                // Handle completion
            }
        }
        
        prefetchQueue.addOperation(operation)
    }
    
    private func cancelPrefetch(for indexPath: IndexPath) {
        loadingIndexPaths.remove(indexPath)
        
        // Cancel ongoing operations for this index path
        prefetchQueue.operations.forEach { operation in
            if let blockOperation = operation as? BlockOperation {
                blockOperation.cancel()
            }
        }
    }
}

// Optimized collection view cell
class OptimizedCollectionViewCell: UICollectionViewCell {
    
    private let imageView = UIImageView()
    private let titleLabel = UILabel()
    private let descriptionLabel = UILabel()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }
    
    private func setupViews() {
        // Configure image view
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 8
        
        // Configure labels
        titleLabel.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        titleLabel.numberOfLines = 2
        
        descriptionLabel.font = UIFont.systemFont(ofSize: 14)
        descriptionLabel.textColor = .secondaryLabel
        descriptionLabel.numberOfLines = 3
        
        // Add to hierarchy
        [imageView, titleLabel, descriptionLabel].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview($0)
        }
        
        // Setup constraints
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            imageView.heightAnchor.constraint(equalToConstant: 120),
            
            titleLabel.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            
            descriptionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            descriptionLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            descriptionLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            descriptionLabel.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -8)
        ])
    }
    
    func configure(with item: DataItem) {
        titleLabel.text = item.title
        descriptionLabel.text = item.description
        
        // Load image with caching
        if let imageURL = item.imageURL {
            imageView.sd_setImage(
                with: imageURL,
                placeholderImage: UIImage(named: "placeholder"),
                options: [.continueInBackground, .progressiveLoad]
            )
        }
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        
        imageView.sd_cancelCurrentImageLoad()
        imageView.image = nil
        titleLabel.text = nil
        descriptionLabel.text = nil
    }
}
```

### Android RecyclerView Optimization
```kotlin
// Android - Advanced RecyclerView optimization
class OptimizedRecyclerViewAdapter(
    private val dataList: MutableList<DataItem>
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    
    private val imageLoader = ImageLoader.getInstance()
    private var recyclerView: RecyclerView? = null
    
    // View types
    companion object {
        private const val TYPE_ITEM = 0
        private const val TYPE_LOADING = 1
        private const val PRELOAD_SIZE = 5
    }
    
    override fun onAttachedToRecyclerView(recyclerView: RecyclerView) {
        super.onAttachedToRecyclerView(recyclerView)
        this.recyclerView = recyclerView
        setupOptimizations(recyclerView)
    }
    
    private fun setupOptimizations(recyclerView: RecyclerView) {
        // Set fixed size for better performance
        recyclerView.setHasFixedSize(true)
        
        // Increase view pool size
        recyclerView.recycledViewPool.setMaxRecycledViews(TYPE_ITEM, 20)
        
        // Set cache size
        recyclerView.setItemViewCacheSize(10)
        
        // Add scroll listener for preloading
        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                preloadImages(recyclerView)
            }
        })
    }
    
    override fun getItemViewType(position: Int): Int {
        return if (position < dataList.size) TYPE_ITEM else TYPE_LOADING
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            TYPE_ITEM -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_optimized, parent, false)
                ItemViewHolder(view)
            }
            TYPE_LOADING -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_loading, parent, false)
                LoadingViewHolder(view)
            }
            else -> throw IllegalArgumentException("Invalid view type")
        }
    }
    
    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is ItemViewHolder -> {
                if (position < dataList.size) {
                    holder.bind(dataList[position])
                    
                    // Check if we need to load more data
                    if (position >= dataList.size - PRELOAD_SIZE) {
                        onLoadMore?.invoke()
                    }
                }
            }
            is LoadingViewHolder -> {
                // Show loading indicator
            }
        }
    }
    
    override fun getItemCount(): Int = dataList.size + if (isLoading) 1 else 0
    
    private fun preloadImages(recyclerView: RecyclerView) {
        val layoutManager = recyclerView.layoutManager as? LinearLayoutManager ?: return
        
        val firstVisible = layoutManager.findFirstVisibleItemPosition()
        val lastVisible = layoutManager.findLastVisibleItemPosition()
        
        // Preload images for upcoming items
        val preloadStart = lastVisible + 1
        val preloadEnd = minOf(preloadStart + PRELOAD_SIZE, dataList.size)
        
        for (i in preloadStart until preloadEnd) {
            val item = dataList[i]
            imageLoader.loadImageAsync(item.imageUrl) { /* cache only */ }
        }
    }
    
    // ViewHolder classes
    inner class ItemViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val imageView: ImageView = itemView.findViewById(R.id.imageView)
        private val titleView: TextView = itemView.findViewById(R.id.titleView)
        private val descriptionView: TextView = itemView.findViewById(R.id.descriptionView)
        
        fun bind(item: DataItem) {
            titleView.text = item.title
            descriptionView.text = item.description
            
            // Load image with Glide
            Glide.with(itemView.context)
                .load(item.imageUrl)
                .placeholder(R.drawable.placeholder)
                .error(R.drawable.error_image)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .override(200, 200) // Resize for better memory usage
                .into(imageView)
        }
    }
    
    inner class LoadingViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView)
    
    // Public methods
    fun addData(newData: List<DataItem>) {
        val startPosition = dataList.size
        dataList.addAll(newData)
        notifyItemRangeInserted(startPosition, newData.size)
    }
    
    fun setLoading(loading: Boolean) {
        if (isLoading != loading) {
            isLoading = loading
            if (loading) {
                notifyItemInserted(dataList.size)
            } else {
                notifyItemRemoved(dataList.size)
            }
        }
    }
    
    private var isLoading = false
    var onLoadMore: (() -> Unit)? = null
}

// Optimized RecyclerView implementation
class InfiniteScrollRecyclerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : RecyclerView(context, attrs, defStyleAttr) {
    
    private var loadMoreListener: (() -> Unit)? = null
    private var isLoading = false
    private var hasMore = true
    
    init {
        setupScrollListener()
    }
    
    private fun setupScrollListener() {
        addOnScrollListener(object : OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                
                if (dy > 0 && !isLoading && hasMore) { // Scrolling down
                    val layoutManager = recyclerView.layoutManager as? LinearLayoutManager
                    layoutManager?.let { lm ->
                        val totalItemCount = lm.itemCount
                        val lastVisibleItem = lm.findLastVisibleItemPosition()
                        
                        if (lastVisibleItem >= totalItemCount - 5) {
                            loadMoreListener?.invoke()
                        }
                    }
                }
            }
        })
    }
    
    fun setOnLoadMoreListener(listener: () -> Unit) {
        loadMoreListener = listener
    }
    
    fun setLoading(loading: Boolean) {
        isLoading = loading
    }
    
    fun setHasMore(hasMore: Boolean) {
        this.hasMore = hasMore
    }
}

// Data loading manager
class DataLoadingManager {
    private val executor = Executors.newFixedThreadPool(4)
    private var currentPage = 0
    private val pageSize = 20
    
    fun loadNextPage(callback: (List<DataItem>) -> Unit) {
        executor.execute {
            try {
                // Simulate network delay
                Thread.sleep(1000)
                
                val newData = generateMockData(currentPage, pageSize)
                currentPage++
                
                // Return to main thread
                Handler(Looper.getMainLooper()).post {
                    callback(newData)
                }
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post {
                    callback(emptyList())
                }
            }
        }
    }
    
    private fun generateMockData(page: Int, size: Int): List<DataItem> {
        return (0 until size).map { index ->
            val globalIndex = page * size + index
            DataItem(
                id = globalIndex,
                title = "Item $globalIndex",
                description = "Description for item $globalIndex",
                imageUrl = "https://example.com/image/$globalIndex.jpg"
            )
        }
    }
}
```

### Flutter ListView Optimization
```dart
// Flutter - Optimized ListView with infinite scroll
class OptimizedInfiniteListView extends StatefulWidget {
  final Future<List<dynamic>> Function(int page) loadData;
  final Widget Function(BuildContext, dynamic) itemBuilder;
  final int pageSize;
  
  const OptimizedInfiniteListView({
    Key? key,
    required this.loadData,
    required this.itemBuilder,
    this.pageSize = 20,
  }) : super(key: key);
  
  @override
  _OptimizedInfiniteListViewState createState() => _OptimizedInfiniteListViewState();
}

class _OptimizedInfiniteListViewState extends State<OptimizedInfiniteListView> {
  final ScrollController _scrollController = ScrollController();
  final List<dynamic> _items = [];
  
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 0;
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadInitialData();
  }
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
  
  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200) {
      _loadMoreData();
    }
  }
  
  Future<void> _loadInitialData() async {
    if (_isLoading) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final newItems = await widget.loadData(_currentPage);
      
      if (mounted) {
        setState(() {
          _items.addAll(newItems);
          _currentPage++;
          _hasMore = newItems.length == widget.pageSize;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }
  
  Future<void> _loadMoreData() async {
    if (_isLoading || !_hasMore) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final newItems = await widget.loadData(_currentPage);
      
      if (mounted) {
        setState(() {
          _items.addAll(newItems);
          _currentPage++;
          _hasMore = newItems.length == widget.pageSize;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }
  
  Future<void> _refreshData() async {
    setState(() {
      _items.clear();
      _currentPage = 0;
      _hasMore = true;
    });
    
    await _loadInitialData();
  }
  
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refreshData,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        
        // Performance optimizations
        addAutomaticKeepAlives: false,
        addRepaintBoundaries: true,
        addSemanticIndexes: false,
        cacheExtent: MediaQuery.of(context).size.height * 2,
        
        itemCount: _items.length + (_hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _items.length) {
            return _buildLoadingIndicator();
          }
          
          return RepaintBoundary(
            child: OptimizedListItem(
              key: ValueKey(_items[index]['id']),
              item: _items[index],
              builder: widget.itemBuilder,
            ),
          );
        },
      ),
    );
  }
  
  Widget _buildLoadingIndicator() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      alignment: Alignment.center,
      child: const CircularProgressIndicator(),
    );
  }
}

// Optimized list item widget
class OptimizedListItem extends StatelessWidget {
  final dynamic item;
  final Widget Function(BuildContext, dynamic) builder;
  
  const OptimizedListItem({
    Key? key,
    required this.item,
    required this.builder,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return builder(context, item);
  }
}

// Virtual scroll implementation for very large lists
class VirtualScrollListView extends StatefulWidget {
  final List<dynamic> items;
  final Widget Function(BuildContext, dynamic, int) itemBuilder;
  final double itemHeight;
  final double? cacheExtent;
  
  const VirtualScrollListView({
    Key? key,
    required this.items,
    required this.itemBuilder,
    required this.itemHeight,
    this.cacheExtent,
  }) : super(key: key);
  
  @override
  _VirtualScrollListViewState createState() => _VirtualScrollListViewState();
}

class _VirtualScrollListViewState extends State<VirtualScrollListView> {
  final ScrollController _scrollController = ScrollController();
  int _firstVisibleIndex = 0;
  int _lastVisibleIndex = 0;
  double _viewportHeight = 0;
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_updateVisibleRange);
  }
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
  
  void _updateVisibleRange() {
    if (_viewportHeight == 0) return;
    
    final scrollOffset = _scrollController.offset;
    final newFirstIndex = (scrollOffset / widget.itemHeight).floor();
    final visibleCount = (_viewportHeight / widget.itemHeight).ceil();
    final newLastIndex = (newFirstIndex + visibleCount + 2).clamp(0, widget.items.length - 1);
    
    if (newFirstIndex != _firstVisibleIndex || newLastIndex != _lastVisibleIndex) {
      setState(() {
        _firstVisibleIndex = newFirstIndex;
        _lastVisibleIndex = newLastIndex;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _viewportHeight = constraints.maxHeight;
        
        final totalHeight = widget.items.length * widget.itemHeight;
        final topPadding = _firstVisibleIndex * widget.itemHeight;
        final bottomPadding = totalHeight - ((_lastVisibleIndex + 1) * widget.itemHeight);
        
        final visibleItems = widget.items.sublist(
          _firstVisibleIndex,
          _lastVisibleIndex + 1,
        );
        
        return ListView.builder(
          controller: _scrollController,
          cacheExtent: widget.cacheExtent,
          itemCount: visibleItems.length + 2, // +2 for padding items
          itemBuilder: (context, index) {
            if (index == 0) {
              return SizedBox(height: topPadding);
            } else if (index == visibleItems.length + 1) {
              return SizedBox(height: bottomPadding);
            } else {
              final itemIndex = _firstVisibleIndex + index - 1;
              final item = visibleItems[index - 1];
              
              return SizedBox(
                height: widget.itemHeight,
                child: widget.itemBuilder(context, item, itemIndex),
              );
            }
          },
        );
      },
    );
  }
}

// Sticky header implementation
class StickyHeaderListView extends StatelessWidget {
  final List<SectionData> sections;
  final Widget Function(BuildContext, String) headerBuilder;
  final Widget Function(BuildContext, dynamic) itemBuilder;
  
  const StickyHeaderListView({
    Key? key,
    required this.sections,
    required this.headerBuilder,
    required this.itemBuilder,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: sections.map((section) {
        return SliverStickyHeader(
          header: headerBuilder(context, section.title),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return RepaintBoundary(
                  child: itemBuilder(context, section.items[index]),
                );
              },
              childCount: section.items.length,
            ),
          ),
        );
      }).toList(),
    );
  }
}

class SectionData {
  final String title;
  final List<dynamic> items;
  
  SectionData({required this.title, required this.items});
}
```

This list performance and infinite scroll optimization documentation provides comprehensive techniques for implementing efficient list rendering and infinite scroll patterns across React Native, iOS, Android, and Flutter platforms, with focus on memory management, virtualization, and smooth scrolling experiences.
