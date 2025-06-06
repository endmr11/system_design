# Cache Invalidation Strategies

## Cache Invalidation Fundamentals
- **Cache Invalidation Problem**: "There are only two hard things in Computer Science: cache invalidation and naming things"
- **Consistency vs Performance**: Fresh data vs fast access trade-offs
- **Complexity**: Multi-level cache hierarchies with coordinated invalidation

## Time-Based Invalidation (TTL)

### TTL Implementation Strategies
- **Absolute TTL**: 
  - Fixed expiration timestamp
  - Consistent across all cache instances  
  - Good for content with known refresh cycles
- **Sliding TTL**:
  - Reset expiration on each access
  - Keep frequently accessed items longer
  - Good for user-specific data
- **Adaptive TTL**:
  - Dynamic adjustment based on data patterns
  - Machine learning with optimal TTL prediction
  - Context-aware expiration policies

### Platform-Specific TTL Implementation
- **Android**:
  - `SystemClock.elapsedRealtime()` with reliable timestamps
  - Background tasks with proactive cleanup
  - Shared preferences with TTL metadata storage
- **iOS**:
  - `CFAbsoluteTimeGetCurrent()` with precise timing
  - Timer-based cleanup with automatic expiration
  - UserDefaults with expiration tracking
- **Flutter**:
  - `DateTime.now()` with cross-platform timestamps
  - Timer class with scheduled invalidation
  - SharedPreferences with persistence

```kotlin
// Android TTL Cache Implementation
class TTLCache<K, V>(private val maxSize: Int, private val defaultTtlMs: Long) {
    private data class CacheEntry<V>(
        val value: V,
        val timestamp: Long,
        val ttlMs: Long
    )
    
    private val cache = LruCache<K, CacheEntry<V>>(maxSize)
    
    fun put(key: K, value: V, ttlMs: Long = defaultTtlMs) {
        val entry = CacheEntry(value, System.currentTimeMillis(), ttlMs)
        cache.put(key, entry)
    }
    
    fun get(key: K): V? {
        val entry = cache.get(key) ?: return null
        val currentTime = System.currentTimeMillis()
        
        return if (currentTime - entry.timestamp > entry.ttlMs) {
            cache.remove(key)
            null
        } else {
            entry.value
        }
    }
    
    fun cleanup() {
        val currentTime = System.currentTimeMillis()
        val iterator = cache.snapshot().iterator()
        
        while (iterator.hasNext()) {
            val (key, entry) = iterator.next()
            if (currentTime - entry.timestamp > entry.ttlMs) {
                cache.remove(key)
            }
        }
    }
}
```

```swift
// iOS TTL Cache Implementation
class TTLCache<Key: Hashable, Value> {
    private struct CacheEntry {
        let value: Value
        let timestamp: TimeInterval
        let ttl: TimeInterval
    }
    
    private var cache: [Key: CacheEntry] = [:]
    private let queue = DispatchQueue(label: "TTLCache", attributes: .concurrent)
    private var cleanupTimer: Timer?
    
    init(cleanupInterval: TimeInterval = 60) {
        startCleanupTimer(interval: cleanupInterval)
    }
    
    func set(_ value: Value, forKey key: Key, ttl: TimeInterval = 300) {
        queue.async(flags: .barrier) {
            let entry = CacheEntry(
                value: value,
                timestamp: CFAbsoluteTimeGetCurrent(),
                ttl: ttl
            )
            self.cache[key] = entry
        }
    }
    
    func get(forKey key: Key) -> Value? {
        return queue.sync {
            guard let entry = cache[key] else { return nil }
            let currentTime = CFAbsoluteTimeGetCurrent()
            
            if currentTime - entry.timestamp > entry.ttl {
                cache.removeValue(forKey: key)
                return nil
            }
            
            return entry.value
        }
    }
    
    private func startCleanupTimer(interval: TimeInterval) {
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            self.cleanup()
        }
    }
    
    private func cleanup() {
        queue.async(flags: .barrier) {
            let currentTime = CFAbsoluteTimeGetCurrent()
            self.cache = self.cache.filter { _, entry in
                currentTime - entry.timestamp <= entry.ttl
            }
        }
    }
}
```

## Version-Based Invalidation

### Versioning Strategies
- **Global Version Numbers**:
  - Single version counter for entire dataset
  - Simple implementation but coarse-grained
  - Cache miss on any data change
- **Entity-Level Versioning**:
  - Per-object version tracking
  - Fine-grained invalidation
  - Complex dependency management
- **Hash-Based Versioning**:
  - Content hash as version identifier
  - Automatic change detection
  - Efficient for immutable data

### Implementation Patterns
- **ETag Headers**:
  - HTTP standard for resource versioning
  - Conditional requests with bandwidth optimization
  - Client-server version synchronization
- **API Versioning Integration**:
  - `/api/v2/users` with endpoint versioning
  - Backward compatibility with gradual migration
  - Cache segregation by API version

```dart
// Flutter Version-Based Cache
class VersionedCache<T> {
  final Map<String, CacheEntry<T>> _cache = {};
  final int maxSize;
  
  VersionedCache({this.maxSize = 100});
  
  void put(String key, T value, int version) {
    if (_cache.length >= maxSize) {
      _evictOldest();
    }
    
    _cache[key] = CacheEntry(
      value: value,
      version: version,
      timestamp: DateTime.now(),
    );
  }
  
  T? get(String key, int expectedVersion) {
    final entry = _cache[key];
    if (entry == null || entry.version != expectedVersion) {
      _cache.remove(key);
      return null;
    }
    
    return entry.value;
  }
  
  void invalidateVersion(int version) {
    _cache.removeWhere((key, entry) => entry.version == version);
  }
  
  void _evictOldest() {
    if (_cache.isEmpty) return;
    
    String? oldestKey;
    DateTime? oldestTime;
    
    _cache.forEach((key, entry) {
      if (oldestTime == null || entry.timestamp.isBefore(oldestTime!)) {
        oldestKey = key;
        oldestTime = entry.timestamp;
      }
    });
    
    if (oldestKey != null) {
      _cache.remove(oldestKey);
    }
  }
}

class CacheEntry<T> {
  final T value;
  final int version;
  final DateTime timestamp;
  
  CacheEntry({
    required this.value,
    required this.version,
    required this.timestamp,
  });
}
```

## Event-Driven Invalidation

### Real-Time Invalidation
- **WebSocket Events**:
  - Server-pushed invalidation messages
  - Real-time cache updates
  - Reduced polling overhead
- **Push Notifications**:
  - Silent push with cache invalidation triggers
  - Background app refresh with data updates
  - Battery-efficient cache management

### Publish-Subscribe Patterns
- **Event Bus Architecture**:
  - Decoupled cache invalidation
  - Multiple cache layers coordination
  - Observable patterns with reactive updates
- **Platform Implementations**:
  - Android: EventBus, RxJava observables
  - iOS: NotificationCenter, Combine publishers
  - Flutter: Stream controllers, BLoC events

```kotlin
// Android Event-Driven Cache Invalidation
class EventDrivenCache<K, V> {
    private val cache = ConcurrentHashMap<K, V>()
    private val invalidationSubject = PublishSubject.create<InvalidationEvent<K>>()
    
    init {
        invalidationSubject
            .observeOn(Schedulers.io())
            .subscribe { event ->
                when (event.type) {
                    InvalidationType.SINGLE -> cache.remove(event.key)
                    InvalidationType.PATTERN -> invalidateByPattern(event.pattern)
                    InvalidationType.ALL -> cache.clear()
                }
            }
    }
    
    fun put(key: K, value: V) {
        cache[key] = value
    }
    
    fun get(key: K): V? = cache[key]
    
    fun invalidate(key: K) {
        invalidationSubject.onNext(InvalidationEvent.single(key))
    }
    
    fun invalidatePattern(pattern: String) {
        invalidationSubject.onNext(InvalidationEvent.pattern(pattern))
    }
    
    private fun invalidateByPattern(pattern: String) {
        val keysToRemove = cache.keys.filter { key ->
            key.toString().matches(pattern.toRegex())
        }
        keysToRemove.forEach { cache.remove(it) }
    }
}
```

## Advanced Invalidation Techniques

### Cache Tagging
- **Tag-Based Grouping**:
  - Related cache entries grouping
  - Bulk invalidation by tags
  - Complex dependency resolution
- **Hierarchical Tags**:
  - Parent-child relationships
  - Cascading invalidation
  - Efficient dependency management

### Conditional Invalidation
- **Business Rules Integration**:
  - Domain-specific invalidation logic
  - User context consideration
  - Feature flag integration
- **Machine Learning Approaches**:
  - Pattern recognition with predictive invalidation
  - User behavior analysis
  - Optimal cache refresh timing

### Cache Coherence in Distributed Systems

#### Multi-Device Synchronization
- **Cache Invalidation Propagation**:
  - Cross-device cache coordination
  - Eventual consistency models
  - Conflict resolution strategies
- **Implementation Challenges**:
  - Network partitions
  - Clock synchronization
  - Race conditions

#### Performance Monitoring
- **Cache Metrics**:
  - Hit/miss ratios
  - Invalidation frequencies
  - Storage utilization
- **Optimization Feedback Loop**:
  - A/B testing with strategy validation
  - Performance correlation analysis
  - Adaptive algorithm improvement

### Predictive Invalidation

#### Machine Learning Based Prediction
- **Pattern Recognition**:
  - User behavior analysis
  - Time-based patterns
  - Location-based invalidation
  - Content type patterns

#### Smart TTL
- **Dynamic TTL Adjustment**:
  - Content type specific TTL
  - User preference based TTL
  - Network condition aware TTL
  - Historical access pattern analysis

```swift
// iOS Smart TTL Implementation
class SmartTTLCache<Key: Hashable, Value> {
    private struct CacheEntry {
        let value: Value
        let timestamp: TimeInterval
        var ttl: TimeInterval
        var accessCount: Int
        var lastAccessTime: TimeInterval
    }
    
    private var cache: [Key: CacheEntry] = [:]
    private let queue = DispatchQueue(label: "SmartTTLCache", attributes: .concurrent)
    private let baseTTL: TimeInterval
    private let maxTTL: TimeInterval
    
    init(baseTTL: TimeInterval = 300, maxTTL: TimeInterval = 3600) {
        self.baseTTL = baseTTL
        self.maxTTL = maxTTL
    }
    
    func set(_ value: Value, forKey key: Key) {
        queue.async(flags: .barrier) {
            let entry = CacheEntry(
                value: value,
                timestamp: CFAbsoluteTimeGetCurrent(),
                ttl: self.baseTTL,
                accessCount: 1,
                lastAccessTime: CFAbsoluteTimeGetCurrent()
            )
            self.cache[key] = entry
        }
    }
    
    func get(forKey key: Key) -> Value? {
        return queue.sync {
            guard var entry = cache[key] else { return nil }
            let currentTime = CFAbsoluteTimeGetCurrent()
            
            if currentTime - entry.timestamp > entry.ttl {
                cache.removeValue(forKey: key)
                return nil
            }
            
            // Update access pattern and adjust TTL
            entry.accessCount += 1
            entry.lastAccessTime = currentTime
            entry.ttl = calculateSmartTTL(entry: entry)
            cache[key] = entry
            
            return entry.value
        }
    }
    
    private func calculateSmartTTL(entry: CacheEntry) -> TimeInterval {
        let accessFrequency = Double(entry.accessCount) / 
            max(1, CFAbsoluteTimeGetCurrent() - entry.timestamp)
        let frequencyMultiplier = min(3.0, 1.0 + accessFrequency * 2.0)
        
        return min(maxTTL, baseTTL * frequencyMultiplier)
    }
}
```

### Batch Invalidation

#### Bulk Cache Updates
- **Atomic invalidation operations**
- **Transaction-like invalidation**
- **Rollback support**
- **Dependency management**

```dart
// Flutter Batch Invalidation
class BatchInvalidationCache<T> {
  final Map<String, T> _cache = {};
  final Map<String, Set<String>> _tags = {};
  final Map<String, Set<String>> _keyTags = {};
  
  void put(String key, T value, {Set<String> tags = const {}}) {
    _cache[key] = value;
    
    // Update tag mappings
    for (final tag in tags) {
      _tags.putIfAbsent(tag, () => {}).add(key);
      _keyTags.putIfAbsent(key, () => {}).add(tag);
    }
  }
  
  T? get(String key) => _cache[key];
  
  // Batch invalidation by tags
  void invalidateByTags(Set<String> tags) {
    final keysToInvalidate = <String>{};
    
    for (final tag in tags) {
      final taggedKeys = _tags[tag];
      if (taggedKeys != null) {
        keysToInvalidate.addAll(taggedKeys);
      }
    }
    
    _batchRemove(keysToInvalidate);
  }
  
  void _batchRemove(Set<String> keys) {
    for (final key in keys) {
      _cache.remove(key);
      
      // Clean up tag mappings
      final keyTags = _keyTags.remove(key);
      if (keyTags != null) {
        for (final tag in keyTags) {
          _tags[tag]?.remove(key);
          if (_tags[tag]?.isEmpty ?? false) {
            _tags.remove(tag);
          }
        }
      }
    }
  }
  
  // Transaction-like batch operations
  void transaction(void Function(BatchTransaction<T>) operation) {
    final transaction = BatchTransaction<T>(this);
    try {
      operation(transaction);
      transaction.commit();
    } catch (e) {
      transaction.rollback();
      rethrow;
    }
  }
}

class BatchTransaction<T> {
  final BatchInvalidationCache<T> _cache;
  final Map<String, T?> _originalValues = {};
  final Set<String> _modifiedKeys = {};
  
  BatchTransaction(this._cache);
  
  void put(String key, T value, {Set<String> tags = const {}}) {
    if (!_originalValues.containsKey(key)) {
      _originalValues[key] = _cache.get(key);
    }
    _modifiedKeys.add(key);
    _cache.put(key, value, tags: tags);
  }
  
  void remove(String key) {
    if (!_originalValues.containsKey(key)) {
      _originalValues[key] = _cache.get(key);
    }
    _modifiedKeys.add(key);
    _cache._cache.remove(key);
  }
  
  void commit() {
    _originalValues.clear();
    _modifiedKeys.clear();
  }
  
  void rollback() {
    for (final key in _modifiedKeys) {
      final originalValue = _originalValues[key];
      if (originalValue != null) {
        _cache.put(key, originalValue);
      } else {
        _cache._cache.remove(key);
      }
    }
    _originalValues.clear();
    _modifiedKeys.clear();
  }
}
```
