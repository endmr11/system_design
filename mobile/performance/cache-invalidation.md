# Önbellek Geçersizleştirme Stratejileri (Cache Invalidation)

Önbellek geçersizleştirme, mobil uygulamalarda veri tutarlılığını sağlamak için kritik bir bileşendir. "Bilgisayar biliminde sadece iki zor şey vardır: önbellek geçersizleştirme ve isimlendirme."

## TTL (Time-To-Live) Stratejileri

### Adaptif TTL Uygulaması

```java
// Android - Adaptif TTL Cache
public class AdaptiveTTLCache<T> {
    private final Map<String, CacheEntry<T>> cache = new ConcurrentHashMap<>();
    private final Map<String, AccessPattern> accessPatterns = new ConcurrentHashMap<>();
    
    public static class CacheEntry<T> {
        final T value;
        final long creationTime;
        final long baseExpiration;
        long adaptiveExpiration;
        int accessCount;
        
        CacheEntry(T value, long ttlMs) {
            this.value = value;
            this.creationTime = System.currentTimeMillis();
            this.baseExpiration = creationTime + ttlMs;
            this.adaptiveExpiration = baseExpiration;
            this.accessCount = 0;
        }
    }
    
    public void put(String key, T value, long ttlMs) {
        CacheEntry<T> entry = new CacheEntry<>(value, ttlMs);
        cache.put(key, entry);
        updateAccessPattern(key, System.currentTimeMillis());
    }
    
    public T get(String key) {
        CacheEntry<T> entry = cache.get(key);
        if (entry == null) return null;
        
        long currentTime = System.currentTimeMillis();
        
        // Adaptif TTL hesaplama
        adaptTTL(key, entry, currentTime);
        
        if (currentTime > entry.adaptiveExpiration) {
            cache.remove(key);
            return null;
        }
        
        entry.accessCount++;
        updateAccessPattern(key, currentTime);
        return entry.value;
    }
    
    private void adaptTTL(String key, CacheEntry<T> entry, long currentTime) {
        AccessPattern pattern = accessPatterns.get(key);
        if (pattern == null) return;
        
        // Sık erişilen veriler için TTL uzatma
        if (pattern.getAccessFrequency() > 10) { // Son saatte 10+ erişim
            long extension = (long) (entry.baseExpiration * 0.5); // %50 uzatma
            entry.adaptiveExpiration = Math.max(entry.adaptiveExpiration, 
                                              currentTime + extension);
        }
        
        // Nadir erişilen veriler için TTL kısaltma
        if (pattern.getDaysSinceLastAccess() > 7) {
            entry.adaptiveExpiration = Math.min(entry.adaptiveExpiration, 
                                              currentTime + TimeUnit.HOURS.toMillis(1));
        }
    }
    
    private void updateAccessPattern(String key, long accessTime) {
        accessPatterns.compute(key, (k, pattern) -> {
            if (pattern == null) {
                return new AccessPattern(accessTime);
            }
            pattern.recordAccess(accessTime);
            return pattern;
        });
    }
}

class AccessPattern {
    private final List<Long> accessTimes = new ArrayList<>();
    private long lastAccessTime;
    
    AccessPattern(long firstAccess) {
        this.lastAccessTime = firstAccess;
        accessTimes.add(firstAccess);
    }
    
    void recordAccess(long accessTime) {
        this.lastAccessTime = accessTime;
        accessTimes.add(accessTime);
        
        // Son 24 saati tut
        long oneDayAgo = accessTime - TimeUnit.DAYS.toMillis(1);
        accessTimes.removeIf(time -> time < oneDayAgo);
    }
    
    int getAccessFrequency() {
        return accessTimes.size();
    }
    
    long getDaysSinceLastAccess() {
        return TimeUnit.MILLISECONDS.toDays(System.currentTimeMillis() - lastAccessTime);
    }
}
```

### iOS Akıllı TTL Yöneticisi

```swift
class SmartTTLManager<T: Codable> {
    private var cache: [String: CacheItem<T>] = [:]
    private var accessPatterns: [String: AccessPattern] = [:]
    private let queue = DispatchQueue(label: "cache.ttl.queue", attributes: .concurrent)
    
    struct CacheItem<T> {
        let value: T
        let creationDate: Date
        let baseTTL: TimeInterval
        var adaptiveTTL: TimeInterval
        var accessCount: Int = 0
        
        init(value: T, ttl: TimeInterval) {
            self.value = value
            self.creationDate = Date()
            self.baseTTL = ttl
            self.adaptiveTTL = ttl
        }
        
        var isExpired: Bool {
            return Date().timeIntervalSince(creationDate) > adaptiveTTL
        }
    }
    
    func set(_ value: T, forKey key: String, ttl: TimeInterval) {
        queue.async(flags: .barrier) { [weak self] in
            self?.cache[key] = CacheItem(value: value, ttl: ttl)
            self?.updateAccessPattern(for: key)
        }
    }
    
    func get(forKey key: String) -> T? {
        return queue.sync { [weak self] in
            guard var item = self?.cache[key] else { return nil }
            
            self?.adaptTTL(for: key, item: &item)
            
            if item.isExpired {
                self?.cache.removeValue(forKey: key)
                return nil
            }
            
            item.accessCount += 1
            self?.cache[key] = item
            self?.updateAccessPattern(for: key)
            
            return item.value
        }
    }
    
    private func adaptTTL(for key: String, item: inout CacheItem<T>) {
        guard let pattern = accessPatterns[key] else { return }
        
        let currentTime = Date()
        let hourlyAccess = pattern.getAccessCount(in: 3600) // Son 1 saat
        
        // Sık kullanılan veriler için TTL uzatma
        if hourlyAccess > 5 {
            let multiplier = min(1.0 + Double(hourlyAccess) * 0.1, 3.0) // Max 3x
            item.adaptiveTTL = item.baseTTL * multiplier
        }
        
        // Uzun süre erişilmeyen veriler için TTL kısaltma
        let daysSinceLastAccess = currentTime.timeIntervalSince(pattern.lastAccess) / 86400
        if daysSinceLastAccess > 3 {
            item.adaptiveTTL = min(item.adaptiveTTL, 3600) // Max 1 saat
        }
    }
    
    private func updateAccessPattern(for key: String) {
        let now = Date()
        if accessPatterns[key] == nil {
            accessPatterns[key] = AccessPattern(firstAccess: now)
        } else {
            accessPatterns[key]?.recordAccess(at: now)
        }
    }
}

class AccessPattern {
    private(set) var lastAccess: Date
    private var accessHistory: [Date] = []
    
    init(firstAccess: Date) {
        self.lastAccess = firstAccess
        accessHistory.append(firstAccess)
    }
    
    func recordAccess(at time: Date) {
        lastAccess = time
        accessHistory.append(time)
        
        // Son 24 saati tut
        let oneDayAgo = time.addingTimeInterval(-86400)
        accessHistory = accessHistory.filter { $0 > oneDayAgo }
    }
    
    func getAccessCount(in seconds: TimeInterval) -> Int {
        let threshold = Date().addingTimeInterval(-seconds)
        return accessHistory.filter { $0 > threshold }.count
    }
}
```

## Sürüm Tabanlı Geçersizleştirme

### İçerik Sürümleme Sistemi

```dart
// Flutter - Sürüm-tabanlı Önbellek Geçersizleştirme
class VersionedCache<T> {
  final Map<String, VersionedCacheEntry<T>> _cache = {};
  final String _versionEndpoint;
  final Dio _dio;
  
  VersionedCache(this._versionEndpoint) : _dio = Dio();
  
  Future<void> put(String key, T value, String version) async {
    _cache[key] = VersionedCacheEntry(
      value: value,
      version: version,
      timestamp: DateTime.now(),
    );
  }
  
  Future<T?> get(String key) async {
    final entry = _cache[key];
    if (entry == null) return null;
    
    // Version kontrolü
    final isValid = await _validateVersion(key, entry.version);
    if (!isValid) {
      _cache.remove(key);
      return null;
    }
    
    return entry.value;
  }
  
  Future<bool> _validateVersion(String key, String cachedVersion) async {
    try {
      final response = await _dio.get('$_versionEndpoint/$key');
      final latestVersion = response.data['version'] as String;
      
      return cachedVersion == latestVersion;
    } catch (e) {
      // Network hatası durumunda cache'i geçerli say (graceful degradation)
      print('Version check failed: $e');
      return true;
    }
  }
  
  Future<void> invalidateByVersion(String key, String newVersion) async {
    final entry = _cache[key];
    if (entry != null && entry.version != newVersion) {
      _cache.remove(key);
    }
  }
  
  // Bulk version check (efficiency için)
  Future<void> validateAllVersions() async {
    if (_cache.isEmpty) return;
    
    try {
      final keys = _cache.keys.toList();
      final versions = _cache.values.map((e) => e.version).toList();
      
      final response = await _dio.post('$_versionEndpoint/batch', data: {
        'items': keys.asMap().map((index, key) => MapEntry(key, versions[index])),
      });
      
      final outdatedKeys = (response.data['outdated'] as List<dynamic>).cast<String>();
      
      for (final key in outdatedKeys) {
        _cache.remove(key);
      }
    } catch (e) {
      print('Batch version validation failed: $e');
    }
  }
}

class VersionedCacheEntry<T> {
  final T value;
  final String version;
  final DateTime timestamp;
  
  VersionedCacheEntry({
    required this.value,
    required this.version,
    required this.timestamp,
  });
}
```

## Olay Tabanlı Geçersizleştirme

### WebSocket Tabanlı Gerçek Zamanlı Geçersizleştirme

```java
// Android - WebSocket Olay-tabanlı Geçersizleştirme
public class EventDrivenCacheManager {
    private final Map<String, Object> cache = new ConcurrentHashMap<>();
    private final Set<String> invalidationTags = new ConcurrentHashMap<>();
    private WebSocketClient webSocketClient;
    
    public void initializeWebSocket(String url) {
        URI serverUri = URI.create(url);
        webSocketClient = new WebSocketClient(serverUri) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                Log.d("Cache", "WebSocket connected for cache invalidation");
            }
            
            @Override
            public void onMessage(String message) {
                handleInvalidationMessage(message);
            }
            
            @Override
            public void onClose(int code, String reason, boolean remote) {
                Log.d("Cache", "WebSocket closed: " + reason);
                scheduleReconnect();
            }
            
            @Override
            public void onError(Exception ex) {
                Log.e("Cache", "WebSocket error", ex);
            }
        };
        
        webSocketClient.connect();
    }
    
    public void put(String key, Object value, String... tags) {
        cache.put(key, value);
        
        // Tag'leri kaydet
        for (String tag : tags) {
            invalidationTags.add(createTagKey(key, tag));
        }
    }
    
    public Object get(String key) {
        return cache.get(key);
    }
    
    private void handleInvalidationMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            String type = json.getString("type");
            
            switch (type) {
                case "invalidate_key":
                    String key = json.getString("key");
                    invalidateKey(key);
                    break;
                    
                case "invalidate_tag":
                    String tag = json.getString("tag");
                    invalidateByTag(tag);
                    break;
                    
                case "invalidate_pattern":
                    String pattern = json.getString("pattern");
                    invalidateByPattern(pattern);
                    break;
                    
                case "bulk_invalidate":
                    JSONArray keys = json.getJSONArray("keys");
                    for (int i = 0; i < keys.length(); i++) {
                        invalidateKey(keys.getString(i));
                    }
                    break;
            }
        } catch (JSONException e) {
            Log.e("Cache", "Failed to parse invalidation message", e);
        }
    }
    
    private void invalidateKey(String key) {
        cache.remove(key);
        removeTagsForKey(key);
        notifyInvalidation(key);
    }
    
    private void invalidateByTag(String tag) {
        Set<String> keysToInvalidate = new HashSet<>();
        
        for (String tagKey : invalidationTags) {
            if (tagKey.endsWith(":" + tag)) {
                String key = extractKeyFromTagKey(tagKey);
                keysToInvalidate.add(key);
            }
        }
        
        for (String key : keysToInvalidate) {
            invalidateKey(key);
        }
    }
    
    private void invalidateByPattern(String pattern) {
        Pattern regex = Pattern.compile(pattern);
        Set<String> keysToInvalidate = new HashSet<>();
        
        for (String key : cache.keySet()) {
            if (regex.matcher(key).matches()) {
                keysToInvalidate.add(key);
            }
        }
        
        for (String key : keysToInvalidate) {
            invalidateKey(key);
        }
    }
    
    private String createTagKey(String key, String tag) {
        return key + ":" + tag;
    }
    
    private void removeTagsForKey(String key) {
        invalidationTags.removeIf(tagKey -> tagKey.startsWith(key + ":"));
    }
    
    private String extractKeyFromTagKey(String tagKey) {
        int lastColon = tagKey.lastIndexOf(":");
        return lastColon > 0 ? tagKey.substring(0, lastColon) : tagKey;
    }
    
    private void notifyInvalidation(String key) {
        // UI güncellemeleri için observer pattern
        EventBus.getDefault().post(new CacheInvalidationEvent(key));
    }
    
    private void scheduleReconnect() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (webSocketClient != null && !webSocketClient.isOpen()) {
                webSocketClient.reconnect();
            }
        }, 5000); // 5 saniye sonra tekrar dene
    }
}
```

### iOS Olay-tabanlı Önbellek ile Combine

```swift
import Combine
import Starscream

class EventDrivenCache: ObservableObject {
    private var cache: [String: CacheItem] = [:]
    private var tagMapping: [String: Set<String>] = [:] // tag -> keys
    private var keyTags: [String: Set<String>] = [:] // key -> tags
    
    private var webSocket: WebSocket?
    private var cancellables = Set<AnyCancellable>()
    
    @Published var invalidationEvents: [InvalidationEvent] = []
    
    init(socketURL: URL) {
        setupWebSocket(url: socketURL)
    }
    
    func set<T>(_ value: T, forKey key: String, tags: [String] = []) {
        cache[key] = CacheItem(value: value)
        
        // Tag mapping güncelle
        keyTags[key] = Set(tags)
        for tag in tags {
            tagMapping[tag, default: Set()].insert(key)
        }
    }
    
    func get<T>(forKey key: String, type: T.Type) -> T? {
        return cache[key]?.value as? T
    }
    
    private func setupWebSocket(url: URL) {
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        
        webSocket = WebSocket(request: request)
        webSocket?.delegate = self
        webSocket?.connect()
    }
    
    private func handleInvalidationMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        let event: InvalidationEvent
        
        switch type {
        case "invalidate_key":
            guard let key = json["key"] as? String else { return }
            invalidateKey(key)
            event = InvalidationEvent(type: .key, target: key)
            
        case "invalidate_tag":
            guard let tag = json["tag"] as? String else { return }
            invalidateByTag(tag)
            event = InvalidationEvent(type: .tag, target: tag)
            
        case "invalidate_pattern":
            guard let pattern = json["pattern"] as? String else { return }
            invalidateByPattern(pattern)
            event = InvalidationEvent(type: .pattern, target: pattern)
            
        case "bulk_invalidate":
            guard let keys = json["keys"] as? [String] else { return }
            for key in keys {
                invalidateKey(key)
            }
            event = InvalidationEvent(type: .bulk, target: keys.joined(separator: ","))
            
        default:
            return
        }
        
        DispatchQueue.main.async {
            self.invalidationEvents.append(event)
        }
    }
    
    private func invalidateKey(_ key: String) {
        cache.removeValue(forKey: key)
        
        // Tag mapping temizle
        if let tags = keyTags[key] {
            for tag in tags {
                tagMapping[tag]?.remove(key)
                if tagMapping[tag]?.isEmpty == true {
                    tagMapping.removeValue(forKey: tag)
                }
            }
            keyTags.removeValue(forKey: key)
        }
    }
    
    private func invalidateByTag(_ tag: String) {
        guard let keys = tagMapping[tag] else { return }
        
        for key in keys {
            invalidateKey(key)
        }
    }
    
    private func invalidateByPattern(_ pattern: String) {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
        
        let keysToInvalidate = cache.keys.filter { key in
            let range = NSRange(location: 0, length: key.utf16.count)
            return regex.firstMatch(in: key, range: range) != nil
        }
        
        for key in keysToInvalidate {
            invalidateKey(key)
        }
    }
}

extension EventDrivenCache: WebSocketDelegate {
    func didReceive(event: WebSocketEvent, client: WebSocket) {
        switch event {
        case .connected(let headers):
            print("WebSocket connected: \(headers)")
            
        case .disconnected(let reason, let code):
            print("WebSocket disconnected: \(reason) with code: \(code)")
            scheduleReconnect()
            
        case .text(let string):
            handleInvalidationMessage(string)
            
        case .error(let error):
            print("WebSocket error: \(error?.localizedDescription ?? "Unknown error")")
            
        default:
            break
        }
    }
    
    private func scheduleReconnect() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            self?.webSocket?.connect()
        }
    }
}

struct CacheItem {
    let value: Any
    let timestamp: Date = Date()
}

struct InvalidationEvent {
    let type: InvalidationType
    let target: String
    let timestamp: Date = Date()
}

enum InvalidationType {
    case key, tag, pattern, bulk
}
```

## Önbellek Isıtma Stratejileri

### Tahmine Dayalı Önbellek Isıtma

```dart
// Flutter - Tahmine Dayalı Önbellek Isıtma
class PredictiveCacheWarmer {
  final Map<String, UserBehaviorPattern> _userPatterns = {};
  final CacheManager _cacheManager;
  final ApiService _apiService;
  
  PredictiveCacheWarmer(this._cacheManager, this._apiService);
  
  void recordUserAction(String userId, String action, Map<String, dynamic> context) {
    final pattern = _userPatterns.putIfAbsent(
      userId, 
      () => UserBehaviorPattern(userId),
    );
    
    pattern.recordAction(action, context);
    
    // Predictive warming trigger
    _scheduleWarmingTasks(userId, pattern);
  }
  
  void _scheduleWarmingTasks(String userId, UserBehaviorPattern pattern) {
    final predictions = pattern.predictNextActions();
    
    for (final prediction in predictions) {
      if (prediction.confidence > 0.7) { // %70 güven eşiği
        _warmCache(prediction);
      }
    }
  }
  
  Future<void> _warmCache(ActionPrediction prediction) async {
    try {
      switch (prediction.action) {
        case 'view_product':
          final productId = prediction.context['productId'];
          await _preloadProductData(productId);
          break;
          
        case 'browse_category':
          final categoryId = prediction.context['categoryId'];
          await _preloadCategoryData(categoryId);
          break;
          
        case 'search':
          final query = prediction.context['query'];
          await _preloadSearchResults(query);
          break;
      }
    } catch (e) {
      print('Cache warming failed for ${prediction.action}: $e');
    }
  }
  
  Future<void> _preloadProductData(String productId) async {
    final key = 'product_$productId';
    
    if (await _cacheManager.get(key) == null) {
      final productData = await _apiService.getProduct(productId);
      await _cacheManager.put(key, productData, const Duration(hours: 24));
      
      // İlgili ürünleri de önceden yükle
      final relatedProducts = await _apiService.getRelatedProducts(productId);
      for (final related in relatedProducts) {
        final relatedKey = 'product_${related.id}';
        await _cacheManager.put(relatedKey, related, const Duration(hours: 12));
      }
    }
  }
  
  Future<void> _preloadCategoryData(String categoryId) async {
    final key = 'category_$categoryId';
    
    if (await _cacheManager.get(key) == null) {
      final categoryData = await _apiService.getCategoryProducts(categoryId);
      await _cacheManager.put(key, categoryData, const Duration(hours: 6));
    }
  }
  
  Future<void> _preloadSearchResults(String query) async {
    final key = 'search_${query.hashCode}';
    
    if (await _cacheManager.get(key) == null) {
      final searchResults = await _apiService.search(query);
      await _cacheManager.put(key, searchResults, const Duration(hours: 2));
    }
  }
}

class UserBehaviorPattern {
  final String userId;
  final List<UserAction> _actions = [];
  final Map<String, ActionFrequency> _frequencies = {};
  
  UserBehaviorPattern(this.userId);
  
  void recordAction(String action, Map<String, dynamic> context) {
    final userAction = UserAction(
      action: action,
      context: context,
      timestamp: DateTime.now(),
    );
    
    _actions.add(userAction);
    
    // Son 100 aksiyonu tut
    if (_actions.length > 100) {
      _actions.removeAt(0);
    }
    
    // Frekans güncelle
    _frequencies.update(
      action,
      (freq) => freq.increment(),
      ifAbsent: () => ActionFrequency(action),
    );
  }
  
  List<ActionPrediction> predictNextActions() {
    final predictions = <ActionPrediction>[];
    
    // Son eylemlerden pattern çıkar
    final recentActions = _actions.where(
      (action) => DateTime.now().difference(action.timestamp).inMinutes < 30,
    ).toList();
    
    if (recentActions.isEmpty) return predictions;
    
    // Sequence-based prediction
    final sequences = _findActionSequences();
    for (final sequence in sequences) {
      final prediction = _predictFromSequence(sequence, recentActions);
      if (prediction != null) {
        predictions.add(prediction);
      }
    }
    
    // Frequency-based prediction
    final frequentActions = _frequencies.values
        .where((freq) => freq.dailyAverage > 2)
        .map((freq) => _predictFromFrequency(freq))
        .where((pred) => pred != null)
        .cast<ActionPrediction>();
    
    predictions.addAll(frequentActions);
    
    return predictions;
  }
  
  List<ActionSequence> _findActionSequences() {
    final sequences = <ActionSequence>[];
    
    for (int i = 0; i < _actions.length - 1; i++) {
      final current = _actions[i];
      final next = _actions[i + 1];
      
      final timeDiff = next.timestamp.difference(current.timestamp);
      if (timeDiff.inMinutes < 10) { // 10 dakika içinde
        sequences.add(ActionSequence([current, next]));
      }
    }
    
    return sequences;
  }
  
  ActionPrediction? _predictFromSequence(
    ActionSequence sequence, 
    List<UserAction> recentActions,
  ) {
    // Sequence matching logic
    if (recentActions.isEmpty) return null;
    
    final lastAction = recentActions.last;
    if (sequence.actions.first.action == lastAction.action) {
      final nextAction = sequence.actions[1];
      return ActionPrediction(
        action: nextAction.action,
        context: nextAction.context,
        confidence: 0.8,
        predictionSource: 'sequence',
      );
    }
    
    return null;
  }
  
  ActionPrediction? _predictFromFrequency(ActionFrequency frequency) {
    final now = DateTime.now();
    final lastActionTime = _actions
        .where((a) => a.action == frequency.action)
        .map((a) => a.timestamp)
        .fold<DateTime?>(null, (latest, current) {
          return latest == null || current.isAfter(latest) ? current : latest;
        });
    
    if (lastActionTime == null) return null;
    
    final timeSinceLastAction = now.difference(lastActionTime);
    final expectedInterval = Duration(hours: 24 ~/ frequency.dailyAverage);
    
    if (timeSinceLastAction > expectedInterval) {
      return ActionPrediction(
        action: frequency.action,
        context: {},
        confidence: 0.6,
        predictionSource: 'frequency',
      );
    }
    
    return null;
  }
}

class UserAction {
  final String action;
  final Map<String, dynamic> context;
  final DateTime timestamp;
  
  UserAction({
    required this.action,
    required this.context,
    required this.timestamp,
  });
}

class ActionFrequency {
  final String action;
  int count = 1;
  DateTime firstSeen = DateTime.now();
  DateTime lastSeen = DateTime.now();
  
  ActionFrequency(this.action);
  
  ActionFrequency increment() {
    count++;
    lastSeen = DateTime.now();
    return this;
  }
  
  double get dailyAverage {
    final days = DateTime.now().difference(firstSeen).inDays + 1;
    return count / days;
  }
}

class ActionSequence {
  final List<UserAction> actions;
  
  ActionSequence(this.actions);
}

class ActionPrediction {
  final String action;
  final Map<String, dynamic> context;
  final double confidence;
  final String predictionSource;
  
  ActionPrediction({
    required this.action,
    required this.context,
    required this.confidence,
    required this.predictionSource,
  });
}
```

## En İyi Uygulamalar

### Önbellek Geçersizleştirme Strateji Matrisi

| Veri Tipi | TTL | Geçersizleştirme Yöntemi | Önbellek Seviyesi |
|-----------|-----|-------------------|------------|
| Kullanıcı Profili | 24s | Olay-tabanlı | Bellek + Disk |
| Ürün Kataloğu | 6s | Sürüm-tabanlı | Disk |
| Arama Sonuçları | 1s | TTL + Olay | Bellek |
| Statik Varlıklar | 7g | Sürüm Hash | Disk |
| API Yanıtları | 5d | TTL | Bellek |
| Kullanıcı Tarafından Üretilen İçerik | Anında | Olay-tabanlı | Tüm seviyeler |

### Performans Metrikleri

1. **Geçersizleştirme Gecikmesi**: Event'den geçersizleştirmeye kadar geçen süre
2. **Yanlış Pozitif Oranı**: Gereksiz geçersizleştirme oranı
3. **Geçersizleştirme Sonrası Önbellek Vuruş Oranı**: Geçersizleştirme sonrası önbellek performansı
4. **Ağ Trafiği Azaltma**: Geçersizleştirme stratejisinin etkinliği

Bu stratejiler mobil uygulamalarda önbellek tutarlılığını korurken performansı optimize eder.
