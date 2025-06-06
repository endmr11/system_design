---
title: Offline-First Tasarım
---

# Offline-First Tasarım

Offline-first yaklaşım, modern mobil uygulamalarda kullanıcı deneyiminin sürekliliğini sağlamak için geliştirilen bir tasarım felsefesidir. Bu yaklaşımda ağ bağlantısı opsiyonel kabul edilir ve uygulama öncelikle local veri ile çalışacak şekilde tasarlanır.

## Temel Prensipler

### Local-First Data Management
Offline-first tasarımın temelinde local storage'ın tek doğruluk kaynağı olarak kabul edilmesi yatar.

**Single Source of Truth**
```kotlin
// Android Local-First Pattern
class OfflineFirstRepository(
    private val localDataSource: LocalDataSource,
    private val remoteDataSource: RemoteDataSource,
    private val syncManager: SyncManager
) {
    
    // Her zaman local data'yı döndür
    fun getData(): Flow<List<Entity>> {
        return localDataSource.getAllEntities()
            .onStart { 
                // Background'da sync başlat
                syncManager.requestSync()
            }
    }
    
    // Yazma işlemleri önce local'e
    suspend fun saveEntity(entity: Entity) {
        // 1. Local'e kaydet
        localDataSource.insertEntity(entity.copy(needsSync = true))
        
        // 2. Background sync kuyruğuna ekle
        syncManager.queueForUpload(entity)
    }
}
```

### Eventual Consistency Model
Network'e bağımlı olmayan eventual consistency yaklaşımı.

```swift
// iOS Eventual Consistency
class EventualConsistencyManager {
    private let localStore: LocalStore
    private let remoteStore: RemoteStore
    private let conflictResolver: ConflictResolver
    
    func synchronizeEventually() async {
        do {
            // 1. Local değişiklikleri upload et
            let localChanges = await localStore.getPendingChanges()
            try await uploadLocalChanges(localChanges)
            
            // 2. Remote değişiklikleri fetch et
            let remoteChanges = try await remoteStore.getChanges(since: lastSyncTime)
            
            // 3. Conflict resolution
            let resolvedChanges = await conflictResolver.resolve(
                local: localChanges,
                remote: remoteChanges
            )
            
            // 4. Resolved changes'i local'e apply et
            await localStore.applyChanges(resolvedChanges)
            
        } catch {
            // Network error - continue with local data
            print("Sync failed, continuing offline: \(error)")
        }
    }
}
```

## Write-Ahead Logging (WAL)

### Database Level WAL
SQLite'da WAL mode ile eşzamanlı okuma/yazma ve crash recovery.

```sql
-- SQLite WAL Mode aktifleştirme
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = memory;
```

**WAL Avantajları:**
- Concurrent readers/writers
- Better performance için sequential writes
- Atomic commit operations
- Crash recovery guarantee
- Reduced file system fragmentation

### Application Level WAL
Kullanıcı aksiyonları için custom WAL implementasyonu.

```dart
// Flutter Application WAL
class ApplicationWAL {
  final Database _walDatabase;
  final Queue<WalEntry> _pendingOperations = Queue();
  
  Future<void> logOperation(UserOperation operation) async {
    final walEntry = WalEntry(
      id: Uuid().v4(),
      operation: operation,
      timestamp: DateTime.now(),
      status: WalStatus.pending
    );
    
    // WAL'a kaydet
    await _walDatabase.insert('wal_entries', walEntry.toMap());
    _pendingOperations.add(walEntry);
    
    // Immediate local execution
    await _executeLocally(operation);
    
    // Background sync için queue'a ekle
    _scheduleSync();
  }
  
  Future<void> replayPendingOperations() async {
    final pendingEntries = await _walDatabase.query(
      'wal_entries',
      where: 'status = ?',
      whereArgs: [WalStatus.pending.index]
    );
    
    for (final entry in pendingEntries) {
      try {
        await _syncToRemote(WalEntry.fromMap(entry));
        await _markAsCompleted(entry['id']);
      } catch (e) {
        // Log error, retry later
        print('WAL replay failed for ${entry['id']}: $e');
      }
    }
  }
}
```

### Event Sourcing Integration
State değişiklikleri event olarak saklama ve replay.

```typescript
// React Native Event Sourcing WAL
interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  timestamp: number;
  version: number;
}

class EventSourcingWAL {
  private eventStore: EventStore;
  private projectionStore: ProjectionStore;
  
  async appendEvent(event: DomainEvent): Promise<void> {
    // 1. Event'i WAL'a yaz
    await this.eventStore.append(event);
    
    // 2. Projection'ı güncelle
    await this.updateProjection(event);
    
    // 3. Background sync için işaretle
    await this.markForSync(event);
  }
  
  async replayEvents(aggregateId: string): Promise<any> {
    const events = await this.eventStore.getEvents(aggregateId);
    return events.reduce((state, event) => {
      return this.applyEvent(state, event);
    }, this.getInitialState());
  }
  
  private async updateProjection(event: DomainEvent): Promise<void> {
    const currentProjection = await this.projectionStore.get(event.aggregateId);
    const newProjection = this.applyEvent(currentProjection, event);
    await this.projectionStore.update(event.aggregateId, newProjection);
  }
}
```

## Operation Queue Systems

### iOS NSOperationQueue
iOS'ta gelişmiş operation queue yönetimi.

```swift
class OfflineOperationQueue {
    private let operationQueue: OperationQueue
    private let persistentStore: OperationStore
    
    init() {
        operationQueue = OperationQueue()
        operationQueue.maxConcurrentOperationCount = 3
        operationQueue.qualityOfService = .utility
    }
    
    func addOperation(_ operation: OfflineOperation) {
        // 1. Persistent store'a kaydet
        persistentStore.save(operation)
        
        // 2. Queue'ya ekle
        let nsOperation = NetworkOperation(operation) { [weak self] result in
            switch result {
            case .success:
                self?.persistentStore.markCompleted(operation.id)
            case .failure(let error):
                self?.handleOperationFailure(operation, error)
            }
        }
        
        operationQueue.addOperation(nsOperation)
    }
    
    private func handleOperationFailure(_ operation: OfflineOperation, _ error: Error) {
        operation.retryCount += 1
        
        if operation.retryCount < maxRetries {
            // Exponential backoff ile retry
            let delay = pow(2.0, Double(operation.retryCount))
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                self.addOperation(operation)
            }
        } else {
            // Max retry'a ulaştı, failed olarak işaretle
            persistentStore.markFailed(operation.id)
        }
    }
}
```

### Android WorkManager
Android'de constraint-aware background operations.

```kotlin
class OfflineWorkManager(context: Context) {
    private val workManager = WorkManager.getInstance(context)
    
    fun scheduleDataSync(data: SyncableData) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        
        val syncWork = OneTimeWorkRequestBuilder<DataSyncWorker>()
            .setConstraints(constraints)
            .setInputData(workDataOf("sync_data" to data.toJson()))
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                OneTimeWorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()
        
        workManager.enqueueUniqueWork(
            "data_sync_${data.id}",
            ExistingWorkPolicy.REPLACE,
            syncWork
        )
    }
    
    // Chained work example
    fun scheduleComplexOperation(operation: ComplexOperation) {
        val uploadWork = OneTimeWorkRequestBuilder<UploadWorker>()
            .setInputData(workDataOf("operation_id" to operation.id))
            .build()
            
        val processWork = OneTimeWorkRequestBuilder<ProcessWorker>()
            .build()
            
        val notifyWork = OneTimeWorkRequestBuilder<NotifyWorker>()
            .build()
        
        workManager.beginWith(uploadWork)
            .then(processWork)
            .then(notifyWork)
            .enqueue()
    }
}

class DataSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            val syncData = inputData.getString("sync_data")?.let { 
                SyncableData.fromJson(it) 
            } ?: return Result.failure()
            
            syncRepository.syncToRemote(syncData)
            Result.success()
            
        } catch (e: Exception) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
```

## Offline Data Strategies

### Multi-Level Caching
Katmanlı caching yaklaşımı ile performans optimizasyonu.

```javascript
// React Native Multi-Level Cache
class MultiLevelCache {
  constructor() {
    this.L1 = new Map(); // In-memory cache
    this.L2 = new AsyncStorage(); // Persistent local storage
    this.L3 = new NetworkClient(); // Remote API
  }
  
  async get(key) {
    // L1: Memory cache
    if (this.L1.has(key)) {
      return this.L1.get(key);
    }
    
    // L2: Local storage
    try {
      const cached = await this.L2.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
        this.L1.set(key, data); // Populate L1
        return data;
      }
    } catch (e) {
      console.warn('L2 cache miss:', e);
    }
    
    // L3: Network (only if online)
    if (await this.isOnline()) {
      try {
        const data = await this.L3.fetch(key);
        
        // Populate all cache levels
        this.L1.set(key, data);
        await this.L2.setItem(key, JSON.stringify(data));
        
        return data;
      } catch (e) {
        console.warn('Network fetch failed:', e);
      }
    }
    
    return null; // Data not available offline
  }
  
  async set(key, data) {
    // Update all levels
    this.L1.set(key, data);
    await this.L2.setItem(key, JSON.stringify(data));
    
    // Mark for sync when online
    this.markForSync(key, data);
  }
}
```

### Smart Prefetching
Kullanıcı davranışlarına dayalı akıllı veri önyükleme.

```swift
class SmartPrefetcher {
    private let analytics: UserAnalytics
    private let dataStore: LocalDataStore
    private let predictor: UsagePredictor
    
    func startIntelligentPrefetching() {
        // Kullanıcı davranış analizi
        let userPatterns = analytics.getUserPatterns()
        let predictions = predictor.predict(from: userPatterns)
        
        Task {
            for prediction in predictions {
                if shouldPrefetch(prediction) {
                    await prefetchData(for: prediction)
                }
            }
        }
    }
    
    private func shouldPrefetch(_ prediction: UsagePrediction) -> Bool {
        return prediction.probability > 0.7 &&
               prediction.dataSize < maxPrefetchSize &&
               NetworkMonitor.shared.isOnWiFi
    }
    
    private func prefetchData(for prediction: UsagePrediction) async {
        do {
            let data = try await apiClient.fetchData(prediction.endpoint)
            await dataStore.cache(data, key: prediction.cacheKey)
        } catch {
            print("Prefetch failed for \(prediction.endpoint): \(error)")
        }
    }
}
```

### Progressive Enhancement
Ağ durumuna göre özellik degradation'ı.

```dart
class ProgressiveEnhancement {
  final ConnectivityService _connectivity;
  final FeatureFlags _features;
  
  Widget buildAdaptiveUI(BuildContext context) {
    return StreamBuilder<ConnectivityResult>(
      stream: _connectivity.connectivityStream,
      builder: (context, snapshot) {
        final isOnline = snapshot.data != ConnectivityResult.none;
        
        return Column(
          children: [
            // Core offline functionality
            OfflineDataList(),
            
            // Enhanced online features
            if (isOnline) ...[
              RealTimeUpdates(),
              CloudSyncIndicator(),
              OnlineOnlyFeatures(),
            ] else ...[
              OfflineIndicator(),
              CachedDataWarning(),
            ],
            
            // Adaptive features based on connection quality
            if (isOnline && _connectivity.isHighBandwidth) 
              HighQualityMedia()
            else
              LowQualityMedia(),
          ],
        );
      },
    );
  }
  
  Future<void> adaptFeaturesToConnectivity() async {
    final connectivity = await _connectivity.getCurrentConnectivity();
    
    switch (connectivity) {
      case ConnectivityResult.none:
        _features.enable([
          'offline_mode',
          'local_search',
          'cached_content',
        ]);
        _features.disable([
          'real_time_sync',
          'cloud_features',
          'live_updates',
        ]);
        break;
        
      case ConnectivityResult.mobile:
        _features.enable([
          'essential_sync',
          'compressed_images',
          'minimal_updates',
        ]);
        _features.disable([
          'background_media_sync',
          'auto_backup',
          'hd_content',
        ]);
        break;
        
      case ConnectivityResult.wifi:
        _features.enableAll();
        break;
    }
  }
}
```

## Error Handling ve User Feedback

### Graceful Degradation
Network hatalarında kullanıcı deneyimini koruma.

```kotlin
class GracefulDegradationManager {
    
    fun handleNetworkError(error: NetworkError, operation: Operation): OperationResult {
        return when (error.type) {
            NetworkErrorType.NO_CONNECTION -> {
                // Offline işleme geç
                storeForLaterSync(operation)
                showOfflineMessage()
                OperationResult.QueuedForLater
            }
            
            NetworkErrorType.TIMEOUT -> {
                // Cached data ile devam et
                val cachedData = getCachedData(operation.endpoint)
                if (cachedData != null) {
                    showStaleDataWarning()
                    OperationResult.Success(cachedData)
                } else {
                    OperationResult.Failure(error)
                }
            }
            
            NetworkErrorType.SERVER_ERROR -> {
                // Retry logic
                if (operation.retryCount < MAX_RETRIES) {
                    scheduleRetry(operation)
                    OperationResult.Retrying
                } else {
                    OperationResult.Failure(error)
                }
            }
        }
    }
    
    private fun showOfflineMessage() {
        NotificationManager.show(
            message = "Çevrimdışı modda çalışıyorsunuz. Değişiklikler bağlantı geldiğinde senkronize edilecek.",
            type = NotificationType.INFO,
            persistent = true
        )
    }
}
```

### Sync Status Communication
Kullanıcıya sync durumu hakkında bilgi verme.

```swift
class SyncStatusManager: ObservableObject {
    @Published var syncStatus: SyncStatus = .idle
    @Published var pendingChanges: Int = 0
    @Published var lastSyncTime: Date?
    
    enum SyncStatus {
        case idle
        case syncing
        case success
        case failed(Error)
        case offline
    }
    
    func updateSyncStatus() {
        Task { @MainActor in
            pendingChanges = await getPendingChangesCount()
            
            if NetworkMonitor.shared.isConnected {
                syncStatus = .syncing
                
                do {
                    try await performSync()
                    syncStatus = .success
                    lastSyncTime = Date()
                } catch {
                    syncStatus = .failed(error)
                }
            } else {
                syncStatus = .offline
            }
        }
    }
}

// SwiftUI Integration
struct SyncStatusView: View {
    @StateObject private var syncManager = SyncStatusManager()
    
    var body: some View {
        HStack {
            statusIcon
            statusText
            
            if syncManager.pendingChanges > 0 {
                Text("\(syncManager.pendingChanges) bekliyor")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
        }
    }
    
    private var statusIcon: some View {
        switch syncManager.syncStatus {
        case .idle:
            return Image(systemName: "checkmark.circle")
                .foregroundColor(.green)
        case .syncing:
            return ProgressView()
                .scaleEffect(0.8)
        case .success:
            return Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
        case .failed:
            return Image(systemName: "exclamationmark.triangle")
                .foregroundColor(.red)
        case .offline:
            return Image(systemName: "wifi.slash")
                .foregroundColor(.orange)
        }
    }
}
```

---

> Offline-first tasarım, modern mobil uygulamaların temel gereksinimi haline gelmiştir. Kullanıcıların her koşulda uygulamayı kullanabilmesi, veri kaybı yaşamaması ve kesintisiz deneyim elde etmesi için kapsamlı bir offline stratejisi gereklidir.
