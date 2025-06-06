# Mobil-Spesifik Ağ Hususları

## Batarya Optimizasyonu

### Ağ Verimliliği

Mobile cihazlarda battery life kritik bir faktördür ve network operations en büyük battery drain sebeplerinden biridir.

#### İstek Birleştirme
```javascript
class RequestCoalescer {
  constructor(windowSize = 100) {
    this.windowSize = windowSize;
    this.pendingRequests = [];
    this.coalesceTimer = null;
  }

  addRequest(request) {
    this.pendingRequests.push(request);
    
    if (!this.coalesceTimer) {
      this.coalesceTimer = setTimeout(() => {
        this.processBatchedRequests();
      }, this.windowSize);
    }
  }

  processBatchedRequests() {
    if (this.pendingRequests.length === 0) return;
    
    // Similar requests'leri grupla
    const groupedRequests = this.groupSimilarRequests(this.pendingRequests);
    
    // Her grup için batch request gönder
    groupedRequests.forEach(group => {
      this.sendBatchRequest(group);
    });
    
    this.pendingRequests = [];
    this.coalesceTimer = null;
  }

  groupSimilarRequests(requests) {
    const groups = new Map();
    
    requests.forEach(request => {
      const key = `${request.method}-${request.baseUrl}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(request);
    });
    
    return Array.from(groups.values());
  }

  async sendBatchRequest(requests) {
    if (requests.length === 1) {
      return this.sendSingleRequest(requests[0]);
    }

    // Multiple requests'i tek bir batch request'e dönüştür
    const batchPayload = {
      requests: requests.map(req => ({
        id: req.id,
        method: req.method,
        url: req.url,
        data: req.data
      }))
    };

    try {
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      const batchResult = await response.json();
      
      // Results'ları individual promises'a distribute et
      batchResult.responses.forEach(result => {
        const originalRequest = requests.find(req => req.id === result.id);
        if (originalRequest) {
          if (result.success) {
            originalRequest.resolve(result.data);
          } else {
            originalRequest.reject(new Error(result.error));
          }
        }
      });
    } catch (error) {
      requests.forEach(req => req.reject(error));
    }
  }
}
```

#### Background Sync Strategy
```javascript
class BackgroundSyncManager {
  constructor() {
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Network durumu değişikliklerini dinle
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  queueForSync(operation) {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now(),
      retries: 0
    });
    
    if (this.isOnline && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    
    while (this.syncQueue.length > 0 && this.isOnline) {
      const operation = this.syncQueue.shift();
      
      try {
        await this.executeOperation(operation);
      } catch (error) {
        console.error('Sync operation failed:', error);
        
        if (operation.retries < 3) {
          operation.retries++;
          this.syncQueue.unshift(operation); // Retry
        } else {
          console.error('Max retries reached for operation:', operation);
        }
      }
      
      // Battery'yi korumak için operations arasında delay
      await this.delay(100);
    }
    
    this.syncInProgress = false;
  }

  async executeOperation(operation) {
    switch (operation.type) {
      case 'create':
        return await this.createResource(operation.resource, operation.data);
      case 'update':
        return await this.updateResource(operation.resource, operation.id, operation.data);
      case 'delete':
        return await this.deleteResource(operation.resource, operation.id);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Push Notifications vs Polling
```javascript
class EfficientDataFetcher {
  constructor() {
    this.pollingIntervals = new Map();
    this.pushNotificationSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Push notifications kullanarak real-time updates
  async setupPushNotifications() {
    if (!this.pushNotificationSupported) {
      console.log('Push notifications desteklenmiyor, polling\'e geri dön');
      return this.fallbackToPolling();
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Subscription'ı server'a gönder
      await this.sendSubscriptionToServer(subscription);
      
      console.log('Push notifications kuruldu');
    } catch (error) {
      console.error('Push notification setup failed:', error);
      this.fallbackToPolling();
    }
  }

  // Fallback: Adaptive polling
  fallbackToPolling() {
    this.startAdaptivePolling();
  }

  startAdaptivePolling() {
    let pollInterval = 30000; // 30 saniye başla
    let consecutiveEmptyResponses = 0;
    
    const poll = async () => {
      try {
        const updates = await this.checkForUpdates();
        
        if (updates.length === 0) {
          consecutiveEmptyResponses++;
          // Boş response'larda interval'ı artır (max 5 dakika)
          pollInterval = Math.min(pollInterval * 1.2, 300000);
        } else {
          consecutiveEmptyResponses = 0;
          // Update varsa interval'ı azalt
          pollInterval = Math.max(pollInterval * 0.8, 10000);
          this.processUpdates(updates);
        }
        
        setTimeout(poll, pollInterval);
      } catch (error) {
        console.error('Polling failed:', error);
        setTimeout(poll, pollInterval * 2); // Error durumunda daha uzun bekle
      }
    };
    
    poll();
  }

  async checkForUpdates() {
    const response = await fetch('/api/updates', {
      headers: {
        'If-None-Match': this.lastETag || '',
        'If-Modified-Since': this.lastModified || ''
      }
    });
    
    if (response.status === 304) {
      return []; // No updates
    }
    
    this.lastETag = response.headers.get('ETag');
    this.lastModified = response.headers.get('Last-Modified');
    
    return await response.json();
  }
}
```

### Resource Management

#### CPU Usage Optimization
```javascript
class CPUOptimizedNetworking {
  constructor() {
    this.requestQueue = [];
    this.maxConcurrentRequests = this.detectOptimalConcurrency();
    this.activeRequests = 0;
  }

  detectOptimalConcurrency() {
    // Device capabilities'e göre optimal concurrency belirle
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 1; // GB
    
    // Low-end device detection
    if (memory <= 1 || cores <= 2) {
      return 2; // Conservative
    } else if (memory <= 4 || cores <= 4) {
      return 4; // Moderate
    } else {
      return 6; // Aggressive
    }
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    const request = this.requestQueue.shift();
    this.activeRequests++;

    try {
      const response = await fetch(request.url, request.options);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request
      setTimeout(() => this.processQueue(), 0);
    }
  }

  // Request priority ile CPU usage'ı optimize et
  prioritizeRequest(url, options = {}, priority = 'normal') {
    const request = { url, options, priority, timestamp: Date.now() };
    
    if (priority === 'high') {
      this.requestQueue.unshift(request);
    } else {
      this.requestQueue.push(request);
    }
    
    this.processQueue();
  }
}
```

#### Memory Footprint Management
```javascript
class MemoryEfficientCache {
  constructor(maxSize = 50 * 1024 * 1024) { // 50MB default
    this.maxSize = maxSize;
    this.currentSize = 0;
    this.cache = new Map();
    this.accessTimes = new Map();
  }

  set(key, data) {
    const size = this.calculateSize(data);
    
    // Memory pressure kontrolü
    if (this.currentSize + size > this.maxSize) {
      this.evictLRU(size);
    }
    
    this.cache.set(key, data);
    this.accessTimes.set(key, Date.now());
    this.currentSize += size;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.accessTimes.set(key, Date.now());
      return this.cache.get(key);
    }
    return null;
  }

  evictLRU(requiredSize) {
    // LRU eviction ile memory'yi temizle
    const sortedByAccess = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]);
    
    let freedSize = 0;
    
    for (const [key, _] of sortedByAccess) {
      if (freedSize >= requiredSize) break;
      
      const data = this.cache.get(key);
      const size = this.calculateSize(data);
      
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.currentSize -= size;
      freedSize += size;
    }
  }

  calculateSize(data) {
    // Rough size calculation
    return JSON.stringify(data).length * 2; // UTF-16 characters
  }

  // Memory pressure detection
  onMemoryPressure() {
    // Aggressive cleanup on memory pressure
    const targetSize = this.maxSize * 0.5; // Reduce to 50%
    this.evictLRU(this.currentSize - targetSize);
  }
}
```

### Platform-Specific Battery Optimization

#### Android Battery Optimization
```kotlin
class AndroidBatteryOptimizer(private val context: Context) {
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    
    fun isDeviceInPowerSaveMode(): Boolean {
        return powerManager.isPowerSaveMode
    }
    
    fun isOnMeteredConnection(): Boolean {
        val networkInfo = connectivityManager.activeNetworkInfo
        return connectivityManager.isActiveNetworkMetered
    }
    
    fun optimizeForBattery(): NetworkConfiguration {
        val config = NetworkConfiguration()
        
        when {
            isDeviceInPowerSaveMode() -> {
                config.requestTimeout = 60000 // Longer timeout
                config.maxConcurrentRequests = 1 // Single request
                config.retryPolicy = ConservativeRetryPolicy()
            }
            isOnMeteredConnection() -> {
                config.compressionEnabled = true
                config.imageCacheEnabled = true
                config.prefetchingEnabled = false
            }
            else -> {
                config.loadDefaultConfiguration()
            }
        }
        
        return config
    }
    
    fun scheduleBackgroundSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
            
        val syncWork = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
            .setConstraints(constraints)
            .build()
            
        WorkManager.getInstance(context).enqueue(syncWork)
    }
}
```

#### iOS Battery Optimization
```swift
class iOSBatteryOptimizer {
    private let processInfo = ProcessInfo.processInfo
    
    var isLowPowerModeEnabled: Bool {
        return processInfo.isLowPowerModeEnabled
    }
    
    var thermalState: ProcessInfo.ThermalState {
        return processInfo.thermalState
    }
    
    func optimizeForBattery() -> NetworkConfiguration {
        let config = NetworkConfiguration()
        
        switch (isLowPowerModeEnabled, thermalState) {
        case (true, _):
            config.requestTimeout = 60.0
            config.maxConcurrentRequests = 1
            config.backgroundTasksEnabled = false
            
        case (_, .critical), (_, .serious):
            config.requestTimeout = 30.0
            config.maxConcurrentRequests = 2
            config.throttleRequests = true
            
        default:
            config.loadDefaultConfiguration()
        }
        
        return config
    }
    
    func scheduleBackgroundRefresh() {
        let identifier = "com.app.backgroundrefresh"
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Background refresh scheduling failed: \(error)")
        }
    }
}
```

## Offline Support

### Data Persistence

#### Local Storage Strategy
```javascript
class OfflineStorageManager {
  constructor() {
    this.dbName = 'OfflineApp';
    this.dbVersion = 1;
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Entities store
        if (!db.objectStoreNames.contains('entities')) {
          const entityStore = db.createObjectStore('entities', { keyPath: 'id' });
          entityStore.createIndex('type', 'type', { unique: false });
          entityStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
        
        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('priority', 'priority', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }
      };
    });
  }

  async saveEntity(entity) {
    const transaction = this.db.transaction(['entities'], 'readwrite');
    const store = transaction.objectStore('entities');
    
    const entityWithTimestamp = {
      ...entity,
      lastModified: Date.now(),
      syncStatus: 'pending'
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(entityWithTimestamp);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEntity(id) {
    const transaction = this.db.transaction(['entities'], 'readonly');
    const store = transaction.objectStore('entities');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEntitiesByType(type) {
    const transaction = this.db.transaction(['entities'], 'readonly');
    const store = transaction.objectStore('entities');
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncItems() {
    const transaction = this.db.transaction(['entities'], 'readonly');
    const store = transaction.objectStore('entities');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const pendingItems = request.result.filter(item => item.syncStatus === 'pending');
        resolve(pendingItems);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

#### Sync Queue Management
```javascript
class SyncQueueManager {
  constructor(storageManager) {
    this.storage = storageManager;
    this.syncInProgress = false;
    this.retryDelays = [1000, 2000, 5000, 10000, 30000]; // Progressive delays
  }

  async queueOperation(operation) {
    const queueItem = {
      ...operation,
      timestamp: Date.now(),
      retries: 0,
      priority: operation.priority || 'normal'
    };

    const transaction = this.storage.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => {
        resolve(request.result);
        this.processQueue(); // Start processing
      };
      request.onerror = () => reject(request.error);
    });
  }

  async processQueue() {
    if (this.syncInProgress || !navigator.onLine) return;
    
    this.syncInProgress = true;
    
    try {
      const queueItems = await this.getQueueItems();
      
      for (const item of queueItems) {
        try {
          await this.processQueueItem(item);
          await this.removeFromQueue(item.id);
        } catch (error) {
          console.error('Queue item processing failed:', error);
          await this.handleRetry(item, error);
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async processQueueItem(item) {
    switch (item.type) {
      case 'create':
        return await this.createRemoteEntity(item.entity);
      case 'update':
        return await this.updateRemoteEntity(item.entityId, item.changes);
      case 'delete':
        return await this.deleteRemoteEntity(item.entityId);
      default:
        throw new Error(`Unknown operation type: ${item.type}`);
    }
  }

  async handleRetry(item, error) {
    if (item.retries < this.retryDelays.length - 1) {
      const delay = this.retryDelays[item.retries];
      
      setTimeout(async () => {
        item.retries++;
        await this.updateQueueItem(item);
        this.processQueue();
      }, delay);
    } else {
      console.error('Max retries reached for queue item:', item);
      await this.moveToFailedQueue(item, error);
    }
  }

  async getQueueItems() {
    const transaction = this.storage.db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    const index = store.index('priority');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by priority and timestamp
        const sorted = request.result.sort((a, b) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
        });
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

### Offline-First Architecture

#### Local-First Data Access
```javascript
class OfflineFirstDataManager {
  constructor() {
    this.storage = new OfflineStorageManager();
    this.syncManager = new SyncQueueManager(this.storage);
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncManager.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async getData(id, options = {}) {
    // Always try local first
    const localData = await this.storage.getEntity(id);
    
    if (!this.isOnline || options.localOnly) {
      return localData;
    }
    
    // If online, try to get fresh data
    try {
      const remoteData = await this.fetchFromServer(id);
      
      if (remoteData) {
        // Update local storage with fresh data
        await this.storage.saveEntity(remoteData);
        return remoteData;
      }
    } catch (error) {
      console.warn('Remote fetch failed, using local data:', error);
    }
    
    // Fallback to local data
    return localData;
  }

  async saveData(id, data, options = {}) {
    // Always save locally first
    const savedData = await this.storage.saveEntity({ id, ...data });
    
    if (this.isOnline && !options.localOnly) {
      try {
        // Try immediate sync
        await this.syncToServer(id, data);
        
        // Mark as synced
        await this.storage.saveEntity({ 
          id, 
          ...data, 
          syncStatus: 'synced',
          lastSynced: Date.now()
        });
      } catch (error) {
        console.warn('Immediate sync failed, queuing for later:', error);
        
        // Queue for later sync
        await this.syncManager.queueOperation({
          type: 'update',
          entityId: id,
          changes: data,
          priority: options.priority || 'normal'
        });
      }
    }
    
    return savedData;
  }

  async deleteData(id, options = {}) {
    // Mark as deleted locally
    await this.storage.saveEntity({ 
      id, 
      deleted: true, 
      syncStatus: 'pending',
      deletedAt: Date.now()
    });
    
    if (this.isOnline && !options.localOnly) {
      try {
        await this.deleteFromServer(id);
        
        // Remove from local storage after successful server delete
        await this.storage.deleteEntity(id);
      } catch (error) {
        console.warn('Immediate delete failed, queuing for later:', error);
        
        await this.syncManager.queueOperation({
          type: 'delete',
          entityId: id,
          priority: options.priority || 'normal'
        });
      }
    }
  }

  async getAllData(type, options = {}) {
    const localData = await this.storage.getEntitiesByType(type);
    
    // Filter out deleted items
    const activeData = localData.filter(item => !item.deleted);
    
    if (!this.isOnline || options.localOnly) {
      return activeData;
    }
    
    // Background refresh from server
    this.refreshFromServer(type).catch(error => {
      console.warn('Background refresh failed:', error);
    });
    
    return activeData;
  }

  async refreshFromServer(type) {
    try {
      const remoteData = await this.fetchListFromServer(type);
      
      // Update local storage with fresh data
      for (const item of remoteData) {
        await this.storage.saveEntity(item);
      }
      
      return remoteData;
    } catch (error) {
      console.error('Server refresh failed:', error);
      throw error;
    }
  }
}
```

## Cross-Platform Considerations

### Platform Differences

#### iOS vs Android Networking
```javascript
class PlatformAwareNetworking {
  constructor() {
    this.platform = this.detectPlatform();
    this.networkConfig = this.getPlatformConfig();
  }

  detectPlatform() {
    const userAgent = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return 'ios';
    } else if (/Android/.test(userAgent)) {
      return 'android';
    } else {
      return 'web';
    }
  }

  getPlatformConfig() {
    switch (this.platform) {
      case 'ios':
        return {
          timeout: 30000, // iOS uygulamaları genelde daha uzun timeout kullanır
          maxConcurrentRequests: 4,
          retryAttempts: 3,
          backgroundSyncEnabled: true,
          tlsVersion: '1.3' // iOS ATS requirements
        };
        
      case 'android':
        return {
          timeout: 20000,
          maxConcurrentRequests: 6,
          retryAttempts: 5,
          backgroundSyncEnabled: true,
          compressionEnabled: true
        };
        
      default:
        return {
          timeout: 15000,
          maxConcurrentRequests: 8,
          retryAttempts: 3,
          backgroundSyncEnabled: false
        };
    }
  }

  async makeRequest(url, options = {}) {
    const platformOptions = {
      ...options,
      timeout: options.timeout || this.networkConfig.timeout
    };

    // Platform-specific headers
    if (this.platform === 'ios') {
      platformOptions.headers = {
        ...platformOptions.headers,
        'User-Agent': this.getIOSUserAgent()
      };
    } else if (this.platform === 'android') {
      platformOptions.headers = {
        ...platformOptions.headers,
        'X-Requested-With': 'XMLHttpRequest'
      };
    }

    return await this.executeRequest(url, platformOptions);
  }

  getIOSUserAgent() {
    // iOS için özel User-Agent
    return `MyApp/1.0 (iOS; ${navigator.platform})`;
  }
}
```

#### Flutter Cross-Platform Implementation
```dart
class FlutterNetworkManager {
  late Dio _dio;
  late ConnectivityResult _connectionStatus;
  
  FlutterNetworkManager() {
    _initializeDio();
    _initializeConnectivity();
  }
  
  void _initializeDio() {
    _dio = Dio();
    
    // Platform-specific configurations
    if (Platform.isIOS) {
      _dio.options.connectTimeout = Duration(seconds: 30);
      _dio.options.sendTimeout = Duration(seconds: 30);
      _dio.options.receiveTimeout = Duration(seconds: 30);
    } else if (Platform.isAndroid) {
      _dio.options.connectTimeout = Duration(seconds: 20);
      _dio.options.sendTimeout = Duration(seconds: 20);
      _dio.options.receiveTimeout = Duration(seconds: 20);
    }
    
    // Add interceptors
    _dio.interceptors.add(PlatformInterceptor());
    _dio.interceptors.add(RetryInterceptor());
    _dio.interceptors.add(CacheInterceptor());
  }
  
  void _initializeConnectivity() {
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      _connectionStatus = result;
      _handleConnectivityChange(result);
    });
  }
  
  void _handleConnectivityChange(ConnectivityResult result) {
    switch (result) {
      case ConnectivityResult.wifi:
        _enableHighBandwidthFeatures();
        break;
      case ConnectivityResult.mobile:
        _enableDataSavingMode();
        break;
      case ConnectivityResult.none:
        _enableOfflineMode();
        break;
    }
  }
  
  void _enableHighBandwidthFeatures() {
    // WiFi'da yüksek kaliteli content
    _dio.options.extra['imageQuality'] = 'high';
    _dio.options.extra['prefetchEnabled'] = true;
  }
  
  void _enableDataSavingMode() {
    // Mobil data'da optimization
    _dio.options.extra['imageQuality'] = 'medium';
    _dio.options.extra['compressionEnabled'] = true;
    _dio.options.extra['prefetchEnabled'] = false;
  }
  
  void _enableOfflineMode() {
    // Offline mode aktivasyonu
    _dio.options.extra['offlineMode'] = true;
  }
  
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } catch (e) {
      return _handleError(e);
    }
  }
  
  Future<Response> post(String path, {dynamic data}) async {
    try {
      return await _dio.post(path, data: data);
    } catch (e) {
      return _handleError(e);
    }
  }
  
  Response _handleError(dynamic error) {
    if (error is DioError) {
      switch (error.type) {
        case DioErrorType.connectTimeout:
        case DioErrorType.sendTimeout:
        case DioErrorType.receiveTimeout:
          throw NetworkTimeoutException();
        case DioErrorType.response:
          throw NetworkResponseException(error.response?.statusCode ?? 0);
        case DioErrorType.other:
          if (_connectionStatus == ConnectivityResult.none) {
            throw NetworkOfflineException();
          }
          throw NetworkUnknownException();
        default:
          throw NetworkUnknownException();
      }
    }
    throw error;
  }
}

class PlatformInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Platform-specific headers
    if (Platform.isIOS) {
      options.headers['User-Agent'] = 'MyApp-iOS/1.0';
    } else if (Platform.isAndroid) {
      options.headers['User-Agent'] = 'MyApp-Android/1.0';
    }
    
    super.onRequest(options, handler);
  }
}
```

### Unified Architecture

#### Shared Networking Layer
```javascript
class UnifiedNetworkLayer {
  constructor() {
    this.adapters = {
      web: new WebNetworkAdapter(),
      native: new NativeNetworkAdapter(),
      flutter: new FlutterNetworkAdapter()
    };
    
    this.currentAdapter = this.detectAdapter();
  }

  detectAdapter() {
    if (typeof window !== 'undefined' && window.flutter_inappwebview) {
      return this.adapters.flutter;
    } else if (typeof window !== 'undefined') {
      return this.adapters.web;
    } else {
      return this.adapters.native;
    }
  }

  async request(config) {
    // Unified request interface
    const normalizedConfig = this.normalizeConfig(config);
    return await this.currentAdapter.request(normalizedConfig);
  }

  normalizeConfig(config) {
    return {
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {},
      data: config.data,
      timeout: config.timeout || 30000,
      retries: config.retries || 3
    };
  }

  // Common methods that all platforms support
  async get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' });
  }

  async post(url, data, config = {}) {
    return this.request({ ...config, url, method: 'POST', data });
  }

  async put(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PUT', data });
  }

  async delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' });
  }
}

// Platform-specific adapters
class WebNetworkAdapter {
  async request(config) {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.data ? JSON.stringify(config.data) : undefined
    });
    
    return this.normalizeResponse(response);
  }

  async normalizeResponse(response) {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: await response.json()
    };
  }
}

class NativeNetworkAdapter {
  async request(config) {
    // React Native or native platform implementation
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.data ? JSON.stringify(config.data) : undefined
    });
    
    return this.normalizeResponse(response);
  }

  async normalizeResponse(response) {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: await response.json()
    };
  }
}
```

Bu mobile-specific considerations, modern mobile uygulamaların network performansını ve kullanıcı deneyimini optimize etmek için kritik öneme sahiptir. Battery optimization, offline support ve cross-platform compatibility, başarılı bir mobile uygulama için temel gereksinimlerdir.
