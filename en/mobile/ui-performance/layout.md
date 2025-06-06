# Layout Performance Optimization

Layout performance is crucial for maintaining smooth user interactions in mobile applications. This section covers layout optimization techniques, constraint optimization, and responsive design patterns that minimize layout calculations and improve rendering performance.

## Constraint Layout Optimization

### Android Layout Performance
```kotlin
// Android - Optimized ConstraintLayout usage
class PerformantLayoutActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Use view binding for better performance
        val binding = ActivityPerformantLayoutBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupOptimizedLayout(binding)
    }
    
    private fun setupOptimizedLayout(binding: ActivityPerformantLayoutBinding) {
        // Use chains for better performance than nested layouts
        val constraintSet = ConstraintSet()
        constraintSet.clone(binding.constraintLayout)
        
        // Create horizontal chain
        constraintSet.createHorizontalChain(
            ConstraintSet.PARENT_ID,
            ConstraintSet.LEFT,
            ConstraintSet.PARENT_ID,
            ConstraintSet.RIGHT,
            intArrayOf(R.id.leftView, R.id.centerView, R.id.rightView),
            null,
            ConstraintSet.CHAIN_SPREAD_INSIDE
        )
        
        constraintSet.applyTo(binding.constraintLayout)
    }
}

// Custom ViewGroup for complex layouts
class OptimizedLinearLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ViewGroup(context, attrs, defStyleAttr) {
    
    private var totalLength = 0
    private val childMeasureSpecs = mutableListOf<MeasureSpec>()
    
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        // Cache child measure specs to avoid repeated calculations
        if (childMeasureSpecs.size != childCount) {
            childMeasureSpecs.clear()
            repeat(childCount) {
                childMeasureSpecs.add(MeasureSpec())
            }
        }
        
        var maxWidth = 0
        totalLength = 0
        
        // Measure children efficiently
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            
            val lp = child.layoutParams as MarginLayoutParams
            
            // Use cached measure spec if dimensions haven't changed
            val childWidthMeasureSpec = getChildMeasureSpec(
                widthMeasureSpec,
                paddingLeft + paddingRight + lp.leftMargin + lp.rightMargin,
                lp.width
            )
            val childHeightMeasureSpec = getChildMeasureSpec(
                heightMeasureSpec,
                paddingTop + paddingBottom + totalLength + lp.topMargin + lp.bottomMargin,
                lp.height
            )
            
            child.measure(childWidthMeasureSpec, childHeightMeasureSpec)
            
            totalLength += child.measuredHeight + lp.topMargin + lp.bottomMargin
            maxWidth = maxOf(maxWidth, child.measuredWidth + lp.leftMargin + lp.rightMargin)
        }
        
        // Add padding
        totalLength += paddingTop + paddingBottom
        maxWidth += paddingLeft + paddingRight
        
        setMeasuredDimension(
            resolveSizeAndState(maxWidth, widthMeasureSpec, 0),
            resolveSizeAndState(totalLength, heightMeasureSpec, 0)
        )
    }
    
    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        var childTop = paddingTop
        
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            
            val lp = child.layoutParams as MarginLayoutParams
            
            childTop += lp.topMargin
            
            val childLeft = paddingLeft + lp.leftMargin
            child.layout(
                childLeft,
                childTop,
                childLeft + child.measuredWidth,
                childTop + child.measuredHeight
            )
            
            childTop += child.measuredHeight + lp.bottomMargin
        }
    }
    
    override fun generateLayoutParams(attrs: AttributeSet?): LayoutParams {
        return MarginLayoutParams(context, attrs)
    }
    
    override fun generateDefaultLayoutParams(): LayoutParams {
        return MarginLayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)
    }
    
    data class MeasureSpec(
        var widthSpec: Int = 0,
        var heightSpec: Int = 0
    )
}

// Layout inflation optimization
class LayoutOptimizer {
    private val layoutInflaterCache = LruCache<Int, View>(20)
    
    fun inflateOptimized(layoutId: Int, parent: ViewGroup, attachToRoot: Boolean = false): View {
        // Check cache first for reusable views
        val cachedView = layoutInflaterCache.get(layoutId)
        if (cachedView != null && cachedView.parent == null) {
            if (attachToRoot) {
                parent.addView(cachedView)
            }
            return cachedView
        }
        
        // Inflate with optimized inflater
        val inflater = LayoutInflater.from(parent.context)
        val view = inflater.inflate(layoutId, parent, attachToRoot)
        
        // Cache for reuse if it's a commonly used layout
        if (isReusableLayout(layoutId)) {
            layoutInflaterCache.put(layoutId, view)
        }
        
        return view
    }
    
    private fun isReusableLayout(layoutId: Int): Boolean {
        // Define which layouts are suitable for reuse
        return when (layoutId) {
            R.layout.list_item_simple,
            R.layout.card_view_basic -> true
            else -> false
        }
    }
}
```

### iOS Auto Layout Optimization
```swift
// iOS - Auto Layout performance optimization
class OptimizedViewController: UIViewController {
    
    private var cachedConstraints: [NSLayoutConstraint] = []
    private var constraintAnimator: UIViewPropertyAnimator?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupOptimizedLayout()
        optimizeConstraintActivation()
    }
    
    private func setupOptimizedLayout() {
        // Create views
        let headerView = createHeaderView()
        let contentView = createContentView()
        let footerView = createFooterView()
        
        // Add to view hierarchy
        view.addSubview(headerView)
        view.addSubview(contentView)
        view.addSubview(footerView)
        
        // Batch constraint activation for better performance
        let constraints = [
            // Header constraints
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 60),
            
            // Content constraints
            contentView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            contentView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: footerView.topAnchor),
            
            // Footer constraints
            footerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            footerView.heightAnchor.constraint(equalToConstant: 80)
        ]
        
        // Activate all constraints at once
        NSLayoutConstraint.activate(constraints)
        cachedConstraints = constraints
    }
    
    private func optimizeConstraintActivation() {
        // Use priority-based constraints to avoid conflicts
        cachedConstraints.forEach { constraint in
            if constraint.firstAttribute == .height || constraint.firstAttribute == .width {
                constraint.priority = UILayoutPriority(999) // Less than required
            }
        }
    }
    
    // Efficient constraint updates
    func updateLayoutWithAnimation() {
        // Disable layout during constraint changes
        view.translatesAutoresizingMaskIntoConstraints = false
        
        // Batch constraint changes
        UIView.performWithoutAnimation {
            // Update constraint constants
            cachedConstraints.first { $0.firstAttribute == .height }?.constant = 100
            
            // Mark for layout update
            view.setNeedsLayout()
        }
        
        // Animate layout changes
        constraintAnimator = UIViewPropertyAnimator(duration: 0.3, curve: .easeInOut) {
            self.view.layoutIfNeeded()
        }
        
        constraintAnimator?.startAnimation()
    }
    
    private func createHeaderView() -> UIView {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemBlue
        return view
    }
    
    private func createContentView() -> UIView {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemBackground
        return view
    }
    
    private func createFooterView() -> UIView {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemGray
        return view
    }
}

// Custom layout for complex scenarios
class GridLayout: UIView {
    
    private var itemSize: CGSize = CGSize(width: 100, height: 100)
    private var spacing: CGFloat = 8
    private var cachedFrames: [CGRect] = []
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Only recalculate if necessary
        if cachedFrames.count != subviews.count || bounds.size != cachedBounds {
            calculateItemFrames()
            cachedBounds = bounds.size
        }
        
        // Apply cached frames
        for (index, subview) in subviews.enumerated() {
            if index < cachedFrames.count {
                subview.frame = cachedFrames[index]
            }
        }
    }
    
    private var cachedBounds: CGSize = .zero
    
    private func calculateItemFrames() {
        cachedFrames.removeAll()
        
        let itemsPerRow = Int((bounds.width + spacing) / (itemSize.width + spacing))
        
        for (index, _) in subviews.enumerated() {
            let row = index / itemsPerRow
            let col = index % itemsPerRow
            
            let x = CGFloat(col) * (itemSize.width + spacing)
            let y = CGFloat(row) * (itemSize.height + spacing)
            
            cachedFrames.append(CGRect(origin: CGPoint(x: x, y: y), size: itemSize))
        }
    }
    
    override var intrinsicContentSize: CGSize {
        let itemsPerRow = Int((bounds.width + spacing) / (itemSize.width + spacing))
        let numberOfRows = (subviews.count + itemsPerRow - 1) / itemsPerRow
        
        let height = CGFloat(numberOfRows) * itemSize.height + CGFloat(numberOfRows - 1) * spacing
        return CGSize(width: bounds.width, height: height)
    }
}

// Stack view optimization
extension UIStackView {
    func optimizePerformance() {
        // Reduce relayout frequency
        distribution = .fillEqually
        
        // Use consistent spacing
        spacing = 8
        
        // Disable automatic distribution for better performance
        if #available(iOS 11.0, *) {
            setCustomSpacing(8, after: arrangedSubviews.first!)
        }
    }
    
    func addArrangedSubviewsEfficiently(_ views: [UIView]) {
        // Batch additions to avoid multiple layout passes
        views.forEach { view in
            view.translatesAutoresizingMaskIntoConstraints = false
        }
        
        // Add all views at once
        UIView.performWithoutAnimation {
            views.forEach { addArrangedSubview($0) }
        }
    }
}
```

## Responsive Design Patterns

### Flutter Layout Optimization
```dart
// Flutter - Responsive layout with performance optimization
class ResponsiveLayout extends StatelessWidget {
  final Widget mobile;
  final Widget tablet;
  final Widget desktop;
  
  const ResponsiveLayout({
    Key? key,
    required this.mobile,
    required this.tablet,
    required this.desktop,
  }) : super(key: key);
  
  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < 768;
  
  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= 768 &&
      MediaQuery.of(context).size.width < 1200;
  
  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= 1200;
  
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 1200) {
          return desktop;
        } else if (constraints.maxWidth >= 768) {
          return tablet;
        } else {
          return mobile;
        }
      },
    );
  }
}

// Optimized flexible layout
class FlexibleOptimizedLayout extends StatelessWidget {
  final List<Widget> children;
  final MainAxisAlignment mainAxisAlignment;
  final CrossAxisAlignment crossAxisAlignment;
  final MainAxisSize mainAxisSize;
  
  const FlexibleOptimizedLayout({
    Key? key,
    required this.children,
    this.mainAxisAlignment = MainAxisAlignment.start,
    this.crossAxisAlignment = CrossAxisAlignment.center,
    this.mainAxisSize = MainAxisSize.max,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Choose layout direction based on available space
        final isWideScreen = constraints.maxWidth > constraints.maxHeight;
        
        return Flex(
          direction: isWideScreen ? Axis.horizontal : Axis.vertical,
          mainAxisAlignment: mainAxisAlignment,
          crossAxisAlignment: crossAxisAlignment,
          mainAxisSize: mainAxisSize,
          children: children.map((child) {
            // Wrap in Flexible for responsive behavior
            return Flexible(
              flex: 1,
              child: RepaintBoundary(child: child),
            );
          }).toList(),
        );
      },
    );
  }
}

// Custom layout delegate for complex layouts
class CustomGridDelegate extends SliverGridDelegate {
  final double maxCrossAxisExtent;
  final double childAspectRatio;
  final double crossAxisSpacing;
  final double mainAxisSpacing;
  
  const CustomGridDelegate({
    required this.maxCrossAxisExtent,
    this.childAspectRatio = 1.0,
    this.crossAxisSpacing = 0,
    this.mainAxisSpacing = 0,
  });
  
  @override
  SliverGridLayout getLayout(SliverConstraints constraints) {
    final usableCrossAxisExtent = constraints.crossAxisExtent - crossAxisSpacing;
    final childCrossAxisExtent = math.min(maxCrossAxisExtent, usableCrossAxisExtent);
    final childMainAxisExtent = childCrossAxisExtent / childAspectRatio;
    final crossAxisCount = math.max(1, usableCrossAxisExtent ~/ (childCrossAxisExtent + crossAxisSpacing));
    
    return SliverGridRegularTileLayout(
      crossAxisCount: crossAxisCount,
      mainAxisStride: childMainAxisExtent + mainAxisSpacing,
      crossAxisStride: childCrossAxisExtent + crossAxisSpacing,
      childMainAxisExtent: childMainAxisExtent,
      childCrossAxisExtent: childCrossAxisExtent,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    );
  }
  
  @override
  bool shouldRelayout(CustomGridDelegate oldDelegate) {
    return oldDelegate.maxCrossAxisExtent != maxCrossAxisExtent ||
           oldDelegate.childAspectRatio != childAspectRatio ||
           oldDelegate.crossAxisSpacing != crossAxisSpacing ||
           oldDelegate.mainAxisSpacing != mainAxisSpacing;
  }
}

// Optimized wrap layout
class OptimizedWrap extends StatelessWidget {
  final List<Widget> children;
  final WrapAlignment alignment;
  final double spacing;
  final double runSpacing;
  
  const OptimizedWrap({
    Key? key,
    required this.children,
    this.alignment = WrapAlignment.start,
    this.spacing = 0.0,
    this.runSpacing = 0.0,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Pre-calculate layout to avoid expensive operations during build
        final wrappedChildren = _optimizeChildLayout(constraints);
        
        return Wrap(
          alignment: alignment,
          spacing: spacing,
          runSpacing: runSpacing,
          children: wrappedChildren,
        );
      },
    );
  }
  
  List<Widget> _optimizeChildLayout(BoxConstraints constraints) {
    return children.map((child) {
      return RepaintBoundary(
        child: IntrinsicWidth(
          child: child,
        ),
      );
    }).toList();
  }
}
```

### React Native Layout Performance
```javascript
// React Native - Flexbox optimization
import React, { useMemo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';

const OptimizedFlexLayout = ({ children, spacing = 8 }) => {
  const { width, height } = Dimensions.get('window');
  
  // Memoize style calculations
  const containerStyle = useMemo(() => ({
    flex: 1,
    flexDirection: width > height ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    padding: spacing,
  }), [width, height, spacing]);
  
  // Memoize child styles
  const childStyles = useMemo(() => {
    const itemCount = React.Children.count(children);
    const isHorizontal = width > height;
    
    return {
      flex: 1,
      marginRight: isHorizontal && spacing ? spacing : 0,
      marginBottom: !isHorizontal && spacing ? spacing : 0,
    };
  }, [children, width, height, spacing]);
  
  return (
    <View style={containerStyle}>
      {React.Children.map(children, (child, index) => (
        <View key={index} style={childStyles}>
          {child}
        </View>
      ))}
    </View>
  );
};

// Grid layout with performance optimization
const OptimizedGrid = ({ data, numColumns, renderItem, spacing = 8 }) => {
  const { width } = Dimensions.get('window');
  
  // Calculate item dimensions
  const itemWidth = useMemo(() => {
    const totalSpacing = spacing * (numColumns + 1);
    return (width - totalSpacing) / numColumns;
  }, [width, numColumns, spacing]);
  
  // Memoize item style
  const itemStyle = useMemo(() => ({
    width: itemWidth,
    marginLeft: spacing,
    marginBottom: spacing,
  }), [itemWidth, spacing]);
  
  // Memoize container style
  const containerStyle = useMemo(() => ({
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing,
    justifyContent: 'flex-start',
  }), [spacing]);
  
  // Memoize rendered items
  const renderedItems = useMemo(() => {
    return data.map((item, index) => (
      <View key={item.id || index} style={itemStyle}>
        {renderItem(item, index)}
      </View>
    ));
  }, [data, renderItem, itemStyle]);
  
  return (
    <View style={containerStyle}>
      {renderedItems}
    </View>
  );
};

// Responsive container
const ResponsiveContainer = ({ children }) => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription?.remove();
  }, []);
  
  // Determine layout type
  const layoutType = useMemo(() => {
    const { width, height } = dimensions;
    const aspectRatio = width / height;
    
    if (width >= 1024) return 'desktop';
    if (width >= 768) return 'tablet';
    if (aspectRatio > 1.5) return 'landscape';
    return 'portrait';
  }, [dimensions]);
  
  // Memoize responsive styles
  const responsiveStyles = useMemo(() => {
    switch (layoutType) {
      case 'desktop':
        return {
          flexDirection: 'row',
          padding: 24,
          maxWidth: 1200,
          alignSelf: 'center',
        };
      case 'tablet':
        return {
          flexDirection: 'row',
          padding: 16,
        };
      case 'landscape':
        return {
          flexDirection: 'row',
          padding: 12,
        };
      default: // portrait
        return {
          flexDirection: 'column',
          padding: 8,
        };
    }
  }, [layoutType]);
  
  return (
    <View style={[styles.container, responsiveStyles]}>
      {children}
    </View>
  );
};

// Layout measurement optimization
const useDimensions = () => {
  const [dimensions, setDimensions] = useState(null);
  const [screenData, setScreenData] = useState(Dimensions.get('screen'));
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      setScreenData(screen);
    });
    
    return () => subscription?.remove();
  }, []);
  
  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  }, []);
  
  return {
    onLayout,
    dimensions,
    screen: screenData,
  };
};

// Usage example with memoization
const OptimizedScreen = React.memo(({ data }) => {
  const { onLayout, dimensions, screen } = useDimensions();
  
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      processed: true,
    }));
  }, [data]);
  
  const numColumns = useMemo(() => {
    if (!dimensions) return 2;
    
    const { width } = dimensions;
    if (width > 1024) return 4;
    if (width > 768) return 3;
    return 2;
  }, [dimensions]);
  
  return (
    <View style={styles.screen} onLayout={onLayout}>
      {dimensions && (
        <OptimizedGrid
          data={processedData}
          numColumns={numColumns}
          renderItem={(item) => <ItemComponent item={item} />}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
```

## Layout Caching and Optimization

### Advanced Layout Caching
```kotlin
// Android - Layout measurement caching
class CachedLayoutManager : RecyclerView.LayoutManager() {
    private val measureCache = LruCache<String, CachedMeasurement>(100)
    private val positionCache = LruCache<Int, CachedPosition>(200)
    
    override fun generateDefaultLayoutParams(): RecyclerView.LayoutParams {
        return RecyclerView.LayoutParams(
            RecyclerView.LayoutParams.WRAP_CONTENT,
            RecyclerView.LayoutParams.WRAP_CONTENT
        )
    }
    
    override fun onLayoutChildren(recycler: RecyclerView.Recycler, state: RecyclerView.State) {
        if (itemCount == 0) {
            removeAndRecycleAllViews(recycler)
            return
        }
        
        // Use cached positions if available
        for (i in 0 until itemCount) {
            val cachedPosition = positionCache.get(i)
            if (cachedPosition != null && !state.isPreLayout) {
                layoutCachedView(i, cachedPosition, recycler)
                continue
            }
            
            layoutViewWithMeasurement(i, recycler, state)
        }
    }
    
    private fun layoutCachedView(position: Int, cached: CachedPosition, recycler: RecyclerView.Recycler) {
        val view = recycler.getViewForPosition(position)
        addView(view)
        
        // Apply cached layout
        layoutDecoratedWithMargins(
            view,
            cached.left,
            cached.top,
            cached.right,
            cached.bottom
        )
    }
    
    private fun layoutViewWithMeasurement(
        position: Int,
        recycler: RecyclerView.Recycler,
        state: RecyclerView.State
    ) {
        val view = recycler.getViewForPosition(position)
        addView(view)
        
        // Check measurement cache
        val viewType = getItemViewType(view)
        val cacheKey = generateCacheKey(viewType, view)
        val cachedMeasurement = measureCache.get(cacheKey)
        
        if (cachedMeasurement != null) {
            // Use cached measurements
            view.layout(0, 0, cachedMeasurement.width, cachedMeasurement.height)
        } else {
            // Measure and cache
            measureChildWithMargins(view, 0, 0)
            val measurement = CachedMeasurement(
                view.measuredWidth,
                view.measuredHeight
            )
            measureCache.put(cacheKey, measurement)
        }
        
        // Calculate position and cache it
        val left = calculateLeft(position)
        val top = calculateTop(position)
        val right = left + view.measuredWidth
        val bottom = top + view.measuredHeight
        
        layoutDecoratedWithMargins(view, left, top, right, bottom)
        
        // Cache position
        positionCache.put(position, CachedPosition(left, top, right, bottom))
    }
    
    private fun generateCacheKey(viewType: Int, view: View): String {
        // Include relevant view characteristics in cache key
        return "${viewType}_${view.measuredWidth}_${view.measuredHeight}"
    }
    
    private fun calculateLeft(position: Int): Int {
        // Implementation for calculating left position
        return 0
    }
    
    private fun calculateTop(position: Int): Int {
        // Implementation for calculating top position
        return position * 120 // Example: fixed height items
    }
    
    data class CachedMeasurement(
        val width: Int,
        val height: Int
    )
    
    data class CachedPosition(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int
    )
}

// View pool optimization
class OptimizedRecyclerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : RecyclerView(context, attrs, defStyleAttr) {
    
    init {
        setupOptimizedViewPool()
    }
    
    private fun setupOptimizedViewPool() {
        // Increase view pool sizes for better recycling
        recycledViewPool.setMaxRecycledViews(0, 20) // View type 0
        recycledViewPool.setMaxRecycledViews(1, 15) // View type 1
        recycledViewPool.setMaxRecycledViews(2, 10) // View type 2
        
        // Pre-populate view pool
        itemAnimator = null // Disable animations for better performance
        setHasFixedSize(true) // Set if adapter changes don't change size
        setItemViewCacheSize(20) // Increase cache size
    }
    
    fun prePopulateViewPool(adapter: RecyclerView.Adapter<*>) {
        val tempParent = FrameLayout(context)
        
        // Create views for each view type
        for (viewType in 0 until adapter.itemCount.coerceAtMost(3)) {
            repeat(5) { // Pre-create 5 views of each type
                val viewHolder = adapter.createViewHolder(tempParent, viewType)
                recycledViewPool.putRecycledView(viewHolder)
            }
        }
    }
}
```

### iOS Layout Caching
```swift
// iOS - Custom layout with caching
class CachedCollectionViewLayout: UICollectionViewLayout {
    
    private var cache: [UICollectionViewLayoutAttributes] = []
    private var contentBounds = CGRect.zero
    private var cachedContentSize: CGSize?
    
    override var collectionViewContentSize: CGSize {
        return cachedContentSize ?? CGSize.zero
    }
    
    override func prepare() {
        super.prepare()
        
        guard let collectionView = collectionView else { return }
        
        // Only recalculate if cache is invalid
        if cache.isEmpty || shouldInvalidateCache() {
            calculateLayout()
        }
    }
    
    private func calculateLayout() {
        guard let collectionView = collectionView else { return }
        
        cache.removeAll()
        contentBounds = CGRect(origin: .zero, size: collectionView.bounds.size)
        
        let itemCount = collectionView.numberOfItems(inSection: 0)
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        let itemSize = CGSize(width: 100, height: 100)
        let spacing: CGFloat = 8
        
        for item in 0..<itemCount {
            let indexPath = IndexPath(item: item, section: 0)
            
            // Check if we need to wrap to next row
            if currentX + itemSize.width > collectionView.bounds.width {
                currentX = 0
                currentY += itemSize.height + spacing
            }
            
            let frame = CGRect(
                x: currentX,
                y: currentY,
                width: itemSize.width,
                height: itemSize.height
            )
            
            let attributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
            attributes.frame = frame
            cache.append(attributes)
            
            contentBounds = contentBounds.union(frame)
            currentX += itemSize.width + spacing
        }
        
        cachedContentSize = contentBounds.size
    }
    
    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        // Return only visible attributes for performance
        return cache.filter { $0.frame.intersects(rect) }
    }
    
    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        return cache[indexPath.item]
    }
    
    override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
        guard let collectionView = collectionView else { return false }
        return !newBounds.size.equalTo(collectionView.bounds.size)
    }
    
    private func shouldInvalidateCache() -> Bool {
        guard let collectionView = collectionView else { return true }
        
        // Invalidate cache if bounds changed significantly
        let currentSize = collectionView.bounds.size
        let cachedSize = cachedContentSize ?? .zero
        
        return abs(currentSize.width - cachedSize.width) > 1.0 ||
               abs(currentSize.height - cachedSize.height) > 1.0
    }
}

// Auto Layout constraint caching
class ConstraintCache {
    private var constraintCache: [String: [NSLayoutConstraint]] = [:]
    
    func getCachedConstraints(for key: String) -> [NSLayoutConstraint]? {
        return constraintCache[key]
    }
    
    func cacheConstraints(_ constraints: [NSLayoutConstraint], for key: String) {
        constraintCache[key] = constraints
    }
    
    func createOrGetConstraints(
        for view: UIView,
        in container: UIView,
        cacheKey: String
    ) -> [NSLayoutConstraint] {
        
        if let cached = getCachedConstraints(for: cacheKey) {
            return cached
        }
        
        let constraints = [
            view.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8)
        ]
        
        cacheConstraints(constraints, for: cacheKey)
        return constraints
    }
    
    func clearCache() {
        constraintCache.removeAll()
    }
}

// Usage in view controller
class CachedLayoutViewController: UIViewController {
    private let constraintCache = ConstraintCache()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupCachedLayout()
    }
    
    private func setupCachedLayout() {
        let cardView = UIView()
        cardView.backgroundColor = .systemBackground
        cardView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(cardView)
        
        // Use cached constraints
        let constraints = constraintCache.createOrGetConstraints(
            for: cardView,
            in: view,
            cacheKey: "main_card_constraints"
        )
        
        NSLayoutConstraint.activate(constraints)
    }
}
```

This layout performance optimization documentation provides comprehensive techniques for improving layout efficiency across Android, iOS, Flutter, and React Native platforms, including constraint optimization, responsive design patterns, and advanced caching strategies.
