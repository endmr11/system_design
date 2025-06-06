---
title: Data Synchronization Strategies
---

# Data Synchronization Strategies

Data synchronization in mobile applications is crucial for maintaining consistency between local and remote data sources while providing optimal user experience. This section covers various synchronization patterns, conflict resolution mechanisms, and implementation strategies across different platforms.

## Synchronization Patterns

### Pull-Based Synchronization

Pull-based sync involves the client actively requesting data updates from the server. This approach provides better control over when and what data is synchronized.

#### Polling Implementation

```swift
// iOS polling example
class DataSyncManager {
    private let apiService: APIService
    private let localDatabase: CoreDataManager
    private var syncTimer: Timer?
    private let syncInterval: TimeInterval = 30.0 // 30 seconds
    
    init(apiService: APIService, localDatabase: CoreDataManager) {
        self.apiService = apiService
        self.localDatabase = localDatabase
    }
    
    func startPeriodicSync() {
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { _ in
            Task {
                await self.performSync()
            }
        }
    }
    
    func stopPeriodicSync() {
        syncTimer?.invalidate()
        syncTimer = nil
    }
    
    private func performSync() async {
        do {
            let lastSyncTimestamp = UserDefaults.standard.double(forKey: "lastSyncTimestamp")
            let serverData = try await apiService.fetchUpdates(since: lastSyncTimestamp)
            
            await localDatabase.performBackgroundTask { context in
                for item in serverData.items {
                    self.mergeServerItem(item, into: context)
                }
                
                try? context.save()
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastSyncTimestamp")
            }
        } catch {
            print("Sync failed: \(error)")
        }
    }
    
    private func mergeServerItem(_ serverItem: ServerItem, into context: NSManagedObjectContext) {
        let fetchRequest: NSFetchRequest<LocalItem> = LocalItem.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "serverId == %@", serverItem.id)
        
        do {
            let existingItems = try context.fetch(fetchRequest)
            let localItem = existingItems.first ?? LocalItem(context: context)
            
            if localItem.lastModified < serverItem.lastModified {
                localItem.updateFromServer(serverItem)
            }
        } catch {
            print("Merge failed: \(error)")
        }
    }
}
```

```kotlin
// Android polling example
class DataSyncManager(
    private val apiService: ApiService,
    private val localDatabase: AppDatabase,
    private val preferences: SharedPreferences
) {
    private val syncInterval = 30000L // 30 seconds
    private var syncJob: Job? = null
    
    fun startPeriodicSync() {
        syncJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                try {
                    performSync()
                    delay(syncInterval)
                } catch (e: Exception) {
                    Log.e("SyncManager", "Sync failed", e)
                    delay(syncInterval)
                }
            }
        }
    }
    
    fun stopPeriodicSync() {
        syncJob?.cancel()
    }
    
    private suspend fun performSync() {
        val lastSyncTimestamp = preferences.getLong("lastSyncTimestamp", 0L)
        val serverData = apiService.fetchUpdates(lastSyncTimestamp)
        
        localDatabase.withTransaction {
            for (item in serverData.items) {
                mergeServerItem(item)
            }
            
            preferences.edit()
                .putLong("lastSyncTimestamp", System.currentTimeMillis())
                .apply()
        }
    }
    
    private suspend fun mergeServerItem(serverItem: ServerItem) {
        val localItem = localDatabase.itemDao().getByServerId(serverItem.id)
        
        if (localItem == null) {
            // Insert new item
            localDatabase.itemDao().insert(LocalItem.fromServer(serverItem))
        } else if (localItem.lastModified < serverItem.lastModified) {
            // Update existing item
            localDatabase.itemDao().update(localItem.copy(
                title = serverItem.title,
                content = serverItem.content,
                lastModified = serverItem.lastModified
            ))
        }
    }
}
```

#### Delta Synchronization

Delta sync only transfers changes since the last synchronization, reducing bandwidth usage and improving performance.

```typescript
// React Native delta sync
interface DeltaResponse {
  created: Item[];
  updated: Item[];
  deleted: string[];
  nextCursor: string;
}

class DeltaSyncManager {
  private apiClient: ApiClient;
  private storage: AsyncStorage;
  private database: WatermelonDB;

  constructor(apiClient: ApiClient, database: WatermelonDB) {
    this.apiClient = apiClient;
    this.database = database;
  }

  async performDeltaSync(): Promise<void> {
    try {
      const lastCursor = await AsyncStorage.getItem('lastSyncCursor') || '0';
      const deltaResponse = await this.apiClient.getDelta(lastCursor);
      
      await this.database.write(async () => {
        // Handle deletions first
        for (const deletedId of deltaResponse.deleted) {
          const existingItem = await this.database.get('items').find(deletedId);
          if (existingItem) {
            await existingItem.markAsDeleted();
          }
        }
        
        // Handle updates and creations
        for (const serverItem of [...deltaResponse.created, ...deltaResponse.updated]) {
          await this.mergeItem(serverItem);
        }
      });
      
      await AsyncStorage.setItem('lastSyncCursor', deltaResponse.nextCursor);
    } catch (error) {
      console.error('Delta sync failed:', error);
      throw error;
    }
  }

  private async mergeItem(serverItem: Item): Promise<void> {
    const itemsCollection = this.database.get('items');
    
    try {
      const existingItem = await itemsCollection.find(serverItem.id);
      
      if (existingItem.lastModified < serverItem.lastModified) {
        await existingItem.update((item) => {
          item.title = serverItem.title;
          item.content = serverItem.content;
          item.lastModified = serverItem.lastModified;
        });
      }
    } catch (error) {
      // Item doesn't exist, create new one
      await itemsCollection.create((item) => {
        item._raw.id = serverItem.id;
        item.title = serverItem.title;
        item.content = serverItem.content;
        item.lastModified = serverItem.lastModified;
      });
    }
  }
}
```

### Push-Based Synchronization

Push-based synchronization involves the server actively notifying clients of data changes through real-time communication channels.

#### WebSocket Implementation

```dart
// Flutter WebSocket sync
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketSyncManager {
  WebSocketChannel? _channel;
  final DatabaseHelper _database;
  final String _serverUrl;
  
  WebSocketSyncManager(this._database, this._serverUrl);
  
  void connect() {
    _channel = WebSocketChannel.connect(Uri.parse(_serverUrl));
    
    _channel!.stream.listen(
      (data) => _handleMessage(json.decode(data)),
      onError: (error) => _handleError(error),
      onDone: () => _handleDisconnection(),
    );
  }
  
  void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }
  
  void _handleMessage(Map<String, dynamic> message) async {
    switch (message['type']) {
      case 'item_created':
        await _handleItemCreated(message['data']);
        break;
      case 'item_updated':
        await _handleItemUpdated(message['data']);
        break;
      case 'item_deleted':
        await _handleItemDeleted(message['data']);
        break;
    }
  }
  
  Future<void> _handleItemCreated(Map<String, dynamic> itemData) async {
    final item = Item.fromJson(itemData);
    await _database.insertItem(item);
  }
  
  Future<void> _handleItemUpdated(Map<String, dynamic> itemData) async {
    final item = Item.fromJson(itemData);
    await _database.updateItem(item);
  }
  
  Future<void> _handleItemDeleted(Map<String, dynamic> data) async {
    final itemId = data['id'] as String;
    await _database.deleteItem(itemId);
  }
  
  void _handleError(dynamic error) {
    print('WebSocket error: $error');
    // Implement reconnection logic
    Future.delayed(Duration(seconds: 5), () => connect());
  }
  
  void _handleDisconnection() {
    print('WebSocket disconnected');
    // Implement reconnection logic
    Future.delayed(Duration(seconds: 5), () => connect());
  }
  
  void sendChange(String type, Map<String, dynamic> data) {
    if (_channel != null) {
      _channel!.sink.add(json.encode({
        'type': type,
        'data': data,
      }));
    }
  }
}
```

#### Server-Sent Events (SSE)

```javascript
// React Native SSE implementation
import EventSource from 'react-native-server-sent-events';

class SSESyncManager {
  constructor(apiUrl, database) {
    this.apiUrl = apiUrl;
    this.database = database;
    this.eventSource = null;
  }

  startListening() {
    this.eventSource = new EventSource(`${this.apiUrl}/events`);

    this.eventSource.addEventListener('item-created', (event) => {
      const item = JSON.parse(event.data);
      this.handleItemCreated(item);
    });

    this.eventSource.addEventListener('item-updated', (event) => {
      const item = JSON.parse(event.data);
      this.handleItemUpdated(item);
    });

    this.eventSource.addEventListener('item-deleted', (event) => {
      const data = JSON.parse(event.data);
      this.handleItemDeleted(data.id);
    });

    this.eventSource.addEventListener('error', (error) => {
      console.error('SSE error:', error);
      this.handleReconnection();
    });
  }

  stopListening() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async handleItemCreated(item) {
    try {
      await this.database.write(async () => {
        const itemsCollection = this.database.get('items');
        await itemsCollection.create((newItem) => {
          newItem._raw.id = item.id;
          newItem.title = item.title;
          newItem.content = item.content;
          newItem.lastModified = item.lastModified;
        });
      });
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  }

  async handleItemUpdated(item) {
    try {
      await this.database.write(async () => {
        const existingItem = await this.database.get('items').find(item.id);
        await existingItem.update((updatedItem) => {
          updatedItem.title = item.title;
          updatedItem.content = item.content;
          updatedItem.lastModified = item.lastModified;
        });
      });
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  }

  async handleItemDeleted(itemId) {
    try {
      await this.database.write(async () => {
        const existingItem = await this.database.get('items').find(itemId);
        await existingItem.markAsDeleted();
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }

  handleReconnection() {
    setTimeout(() => {
      this.startListening();
    }, 5000);
  }
}
```

### Hybrid Synchronization

Combining pull and push strategies for optimal performance and reliability.

```swift
// iOS hybrid sync manager
class HybridSyncManager {
    private let pullSyncManager: PullSyncManager
    private let pushSyncManager: PushSyncManager
    private let reachability: NetworkReachabilityManager
    
    init() {
        self.pullSyncManager = PullSyncManager()
        self.pushSyncManager = PushSyncManager()
        self.reachability = NetworkReachabilityManager()
        
        setupNetworkMonitoring()
    }
    
    private func setupNetworkMonitoring() {
        reachability.startListening { [weak self] status in
            switch status {
            case .reachable:
                self?.onNetworkAvailable()
            case .notReachable:
                self?.onNetworkUnavailable()
            case .unknown:
                break
            }
        }
    }
    
    private func onNetworkAvailable() {
        // Start real-time sync
        pushSyncManager.startListening()
        
        // Perform initial pull sync to catch up
        Task {
            await pullSyncManager.performFullSync()
        }
    }
    
    private func onNetworkUnavailable() {
        // Stop real-time sync
        pushSyncManager.stopListening()
    }
    
    func startSync() {
        if reachability.isReachable {
            onNetworkAvailable()
        }
    }
    
    func stopSync() {
        pushSyncManager.stopListening()
        pullSyncManager.stopPeriodicSync()
    }
    
    func forcePullSync() async {
        await pullSyncManager.performFullSync()
    }
}
```

## Bidirectional Synchronization

### Optimistic Updates

Implementing optimistic updates to improve perceived performance while maintaining data consistency.

```kotlin
// Android optimistic updates
class OptimisticSyncManager(
    private val apiService: ApiService,
    private val database: AppDatabase,
    private val eventBus: EventBus
) {
    suspend fun updateItemOptimistically(item: LocalItem, updates: ItemUpdates) {
        // 1. Apply changes locally immediately
        val optimisticItem = item.copy(
            title = updates.title ?: item.title,
            content = updates.content ?: item.content,
            lastModified = System.currentTimeMillis(),
            syncStatus = SyncStatus.PENDING
        )
        
        database.itemDao().update(optimisticItem)
        eventBus.post(ItemUpdatedEvent(optimisticItem))
        
        // 2. Send to server in background
        try {
            val serverResponse = apiService.updateItem(item.serverId, updates)
            
            // 3. Update with server response
            val syncedItem = optimisticItem.copy(
                serverId = serverResponse.id,
                lastModified = serverResponse.lastModified,
                syncStatus = SyncStatus.SYNCED
            )
            
            database.itemDao().update(syncedItem)
            eventBus.post(ItemSyncedEvent(syncedItem))
            
        } catch (e: Exception) {
            // 4. Handle sync failure
            when (e) {
                is ConflictException -> {
                    handleConflict(optimisticItem, e.serverItem)
                }
                is NetworkException -> {
                    // Keep as pending, retry later
                    scheduleRetry(optimisticItem)
                }
                else -> {
                    // Revert optimistic changes
                    revertOptimisticUpdate(optimisticItem, item)
                }
            }
        }
    }
    
    private suspend fun handleConflict(localItem: LocalItem, serverItem: ServerItem) {
        val conflictResolution = ConflictResolver.resolve(localItem, serverItem)
        
        val resolvedItem = when (conflictResolution.strategy) {
            ConflictStrategy.KEEP_LOCAL -> localItem.copy(syncStatus = SyncStatus.CONFLICT)
            ConflictStrategy.KEEP_SERVER -> LocalItem.fromServer(serverItem, SyncStatus.SYNCED)
            ConflictStrategy.MERGE -> mergeItems(localItem, serverItem)
        }
        
        database.itemDao().update(resolvedItem)
        eventBus.post(ConflictResolvedEvent(resolvedItem, conflictResolution))
    }
    
    private suspend fun revertOptimisticUpdate(optimisticItem: LocalItem, originalItem: LocalItem) {
        database.itemDao().update(originalItem.copy(syncStatus = SyncStatus.FAILED))
        eventBus.post(SyncFailedEvent(optimisticItem))
    }
    
    private fun scheduleRetry(item: LocalItem) {
        // Schedule background retry with exponential backoff
        WorkManager.getInstance()
            .enqueueUniqueWork(
                "sync_item_${item.id}",
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequest.Builder(ItemSyncWorker::class.java)
                    .setInputData(workDataOf("itemId" to item.id))
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build()
            )
    }
}
```

### Operational Transform

Implementing operational transform for real-time collaborative editing.

```typescript
// TypeScript operational transform
interface Operation {
  type: 'insert' | 'delete' | 'retain';
  length?: number;
  text?: string;
}

class OperationalTransform {
  static transform(op1: Operation[], op2: Operation[]): [Operation[], Operation[]] {
    let i1 = 0, i2 = 0;
    const ops1Prime: Operation[] = [];
    const ops2Prime: Operation[] = [];
    
    while (i1 < op1.length && i2 < op2.length) {
      const o1 = op1[i1];
      const o2 = op2[i2];
      
      if (o1.type === 'insert' && o2.type === 'insert') {
        if (i1 <= i2) {
          ops1Prime.push(o1);
          ops2Prime.push({ type: 'retain', length: o1.text!.length });
          i1++;
        } else {
          ops1Prime.push({ type: 'retain', length: o2.text!.length });
          ops2Prime.push(o2);
          i2++;
        }
      } else if (o1.type === 'insert') {
        ops1Prime.push(o1);
        ops2Prime.push({ type: 'retain', length: o1.text!.length });
        i1++;
      } else if (o2.type === 'insert') {
        ops1Prime.push({ type: 'retain', length: o2.text!.length });
        ops2Prime.push(o2);
        i2++;
      } else if (o1.type === 'delete' && o2.type === 'delete') {
        const len1 = o1.length!;
        const len2 = o2.length!;
        
        if (len1 === len2) {
          i1++;
          i2++;
        } else if (len1 < len2) {
          op2[i2] = { type: 'delete', length: len2 - len1 };
          i1++;
        } else {
          op1[i1] = { type: 'delete', length: len1 - len2 };
          i2++;
        }
      } else if (o1.type === 'delete') {
        ops1Prime.push(o1);
        i1++;
      } else if (o2.type === 'delete') {
        ops2Prime.push(o2);
        i2++;
      } else if (o1.type === 'retain' && o2.type === 'retain') {
        const len1 = o1.length!;
        const len2 = o2.length!;
        
        if (len1 === len2) {
          ops1Prime.push({ type: 'retain', length: len1 });
          ops2Prime.push({ type: 'retain', length: len2 });
          i1++;
          i2++;
        } else if (len1 < len2) {
          ops1Prime.push({ type: 'retain', length: len1 });
          ops2Prime.push({ type: 'retain', length: len1 });
          op2[i2] = { type: 'retain', length: len2 - len1 };
          i1++;
        } else {
          ops1Prime.push({ type: 'retain', length: len2 });
          ops2Prime.push({ type: 'retain', length: len2 });
          op1[i1] = { type: 'retain', length: len1 - len2 };
          i2++;
        }
      }
    }
    
    // Append remaining operations
    while (i1 < op1.length) {
      ops1Prime.push(op1[i1++]);
    }
    while (i2 < op2.length) {
      ops2Prime.push(op2[i2++]);
    }
    
    return [ops1Prime, ops2Prime];
  }
  
  static apply(document: string, operations: Operation[]): string {
    let result = '';
    let docIndex = 0;
    
    for (const op of operations) {
      switch (op.type) {
        case 'retain':
          result += document.substr(docIndex, op.length!);
          docIndex += op.length!;
          break;
        case 'insert':
          result += op.text!;
          break;
        case 'delete':
          docIndex += op.length!;
          break;
      }
    }
    
    return result;
  }
}

class CollaborativeEditor {
  private document: string = '';
  private revisionNumber: number = 0;
  private pendingOperations: Operation[][] = [];
  private socket: WebSocket;
  
  constructor(documentId: string) {
    this.socket = new WebSocket(`ws://server/document/${documentId}`);
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'operation':
          this.handleRemoteOperation(message.operations, message.revision);
          break;
        case 'ack':
          this.handleAcknowledgment(message.revision);
          break;
      }
    };
  }
  
  applyLocalOperation(operations: Operation[]) {
    // Apply operation locally
    this.document = OperationalTransform.apply(this.document, operations);
    
    // Transform against pending operations
    let transformedOps = operations;
    for (const pendingOps of this.pendingOperations) {
      const [, transformed] = OperationalTransform.transform(pendingOps, transformedOps);
      transformedOps = transformed;
    }
    
    // Add to pending operations
    this.pendingOperations.push(transformedOps);
    
    // Send to server
    this.socket.send(JSON.stringify({
      type: 'operation',
      operations: transformedOps,
      revision: this.revisionNumber
    }));
  }
  
  private handleRemoteOperation(operations: Operation[], revision: number) {
    // Transform remote operation against pending operations
    let transformedOps = operations;
    for (let i = 0; i < this.pendingOperations.length; i++) {
      const [pendingTransformed, remoteTransformed] = OperationalTransform.transform(
        this.pendingOperations[i],
        transformedOps
      );
      this.pendingOperations[i] = pendingTransformed;
      transformedOps = remoteTransformed;
    }
    
    // Apply transformed operation
    this.document = OperationalTransform.apply(this.document, transformedOps);
    this.revisionNumber = revision;
  }
  
  private handleAcknowledgment(revision: number) {
    // Remove acknowledged operation from pending queue
    if (this.pendingOperations.length > 0) {
      this.pendingOperations.shift();
    }
    this.revisionNumber = revision;
  }
}
```

## Background Synchronization

### Work Managers and Background Tasks

```kotlin
// Android WorkManager for background sync
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            val syncManager = SyncManager.getInstance(applicationContext)
            syncManager.performFullSync()
            Result.success()
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync failed", e)
            Result.retry()
        }
    }
    
    companion object {
        fun schedulePeriodicSync(context: Context) {
            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                repeatInterval = 15,
                repeatIntervalTimeUnit = TimeUnit.MINUTES
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .setRequiresBatteryNotLow(true)
                    .build()
            )
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30,
                TimeUnit.SECONDS
            )
            .build()
            
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    "periodic_sync",
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
                )
        }
    }
}
```

```swift
// iOS Background App Refresh
class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()
    
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.background-sync",
            using: nil
        ) { task in
            self.handleBackgroundSync(task: task as! BGAppRefreshTask)
        }
    }
    
    func scheduleBackgroundSync() {
        let request = BGAppRefreshTaskRequest(identifier: "com.app.background-sync")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule background sync: \(error)")
        }
    }
    
    private func handleBackgroundSync(task: BGAppRefreshTask) {
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            do {
                let syncManager = DataSyncManager.shared
                await syncManager.performBackgroundSync()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
            
            // Schedule next background sync
            scheduleBackgroundSync()
        }
    }
}
```

## Performance Optimization

### Batch Operations

```dart
// Flutter batch sync optimization
class BatchSyncManager {
  final DatabaseHelper _database;
  final ApiService _apiService;
  static const int batchSize = 100;
  
  BatchSyncManager(this._database, this._apiService);
  
  Future<void> syncPendingChanges() async {
    final pendingItems = await _database.getPendingItems();
    
    // Group changes by operation type
    final creates = pendingItems.where((item) => item.operation == 'CREATE').toList();
    final updates = pendingItems.where((item) => item.operation == 'UPDATE').toList();
    final deletes = pendingItems.where((item) => item.operation == 'DELETE').toList();
    
    // Process in batches
    await _processBatch(creates, _batchCreate);
    await _processBatch(updates, _batchUpdate);
    await _processBatch(deletes, _batchDelete);
  }
  
  Future<void> _processBatch<T>(
    List<T> items,
    Future<void> Function(List<T>) processor
  ) async {
    for (int i = 0; i < items.length; i += batchSize) {
      final batch = items.skip(i).take(batchSize).toList();
      await processor(batch);
      
      // Add delay between batches to avoid overwhelming the server
      if (i + batchSize < items.length) {
        await Future.delayed(Duration(milliseconds: 100));
      }
    }
  }
  
  Future<void> _batchCreate(List<PendingItem> items) async {
    try {
      final createRequests = items.map((item) => CreateRequest(
        title: item.title,
        content: item.content,
        localId: item.localId,
      )).toList();
      
      final results = await _apiService.batchCreate(createRequests);
      
      await _database.transaction(() async {
        for (int i = 0; i < results.length; i++) {
          final result = results[i];
          final localItem = items[i];
          
          if (result.success) {
            await _database.updateItem(localItem.localId, {
              'serverId': result.serverId,
              'syncStatus': 'SYNCED',
              'operation': null,
            });
          } else {
            await _database.updateItem(localItem.localId, {
              'syncStatus': 'FAILED',
              'error': result.error,
            });
          }
        }
      });
    } catch (e) {
      // Mark all items as failed
      await _markBatchAsFailed(items, e.toString());
    }
  }
  
  Future<void> _batchUpdate(List<PendingItem> items) async {
    try {
      final updateRequests = items.map((item) => UpdateRequest(
        id: item.serverId!,
        title: item.title,
        content: item.content,
        version: item.version,
      )).toList();
      
      final results = await _apiService.batchUpdate(updateRequests);
      
      await _database.transaction(() async {
        for (int i = 0; i < results.length; i++) {
          final result = results[i];
          final localItem = items[i];
          
          if (result.success) {
            await _database.updateItem(localItem.localId, {
              'version': result.newVersion,
              'syncStatus': 'SYNCED',
              'operation': null,
              'lastModified': result.lastModified,
            });
          } else if (result.isConflict) {
            await _handleConflict(localItem, result.serverVersion);
          } else {
            await _database.updateItem(localItem.localId, {
              'syncStatus': 'FAILED',
              'error': result.error,
            });
          }
        }
      });
    } catch (e) {
      await _markBatchAsFailed(items, e.toString());
    }
  }
  
  Future<void> _batchDelete(List<PendingItem> items) async {
    try {
      final deleteRequests = items
          .where((item) => item.serverId != null)
          .map((item) => DeleteRequest(
            id: item.serverId!,
            version: item.version,
          ))
          .toList();
      
      final results = await _apiService.batchDelete(deleteRequests);
      
      await _database.transaction(() async {
        for (int i = 0; i < results.length; i++) {
          final result = results[i];
          final localItem = items[i];
          
          if (result.success || result.isNotFound) {
            // Successfully deleted or already deleted
            await _database.deleteItem(localItem.localId);
          } else if (result.isConflict) {
            await _handleDeleteConflict(localItem, result.serverVersion);
          } else {
            await _database.updateItem(localItem.localId, {
              'syncStatus': 'FAILED',
              'error': result.error,
            });
          }
        }
      });
    } catch (e) {
      await _markBatchAsFailed(items, e.toString());
    }
  }
  
  Future<void> _markBatchAsFailed(List<PendingItem> items, String error) async {
    await _database.transaction(() async {
      for (final item in items) {
        await _database.updateItem(item.localId, {
          'syncStatus': 'FAILED',
          'error': error,
        });
      }
    });
  }
  
  Future<void> _handleConflict(PendingItem localItem, Map<String, dynamic> serverVersion) async {
    // Implement conflict resolution strategy
    await _database.updateItem(localItem.localId, {
      'syncStatus': 'CONFLICT',
      'serverVersion': jsonEncode(serverVersion),
    });
  }
  
  Future<void> _handleDeleteConflict(PendingItem localItem, Map<String, dynamic> serverVersion) async {
    // Server version exists but local item was deleted
    await _database.updateItem(localItem.localId, {
      'syncStatus': 'DELETE_CONFLICT',
      'serverVersion': jsonEncode(serverVersion),
    });
  }
}
```

### Connection Pooling and Request Optimization

```swift
// iOS URLSession optimization for sync
class OptimizedSyncClient {
    private let session: URLSession
    private let baseURL: URL
    private let requestQueue = DispatchQueue(label: "sync.request.queue", qos: .utility)
    
    init(baseURL: URL) {
        self.baseURL = baseURL
        
        let config = URLSessionConfiguration.default
        config.httpMaximumConnectionsPerHost = 4
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.urlCache = URLCache(
            memoryCapacity: 10 * 1024 * 1024, // 10MB
            diskCapacity: 50 * 1024 * 1024,   // 50MB
            diskPath: "sync_cache"
        )
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        
        // Enable HTTP/2
        config.httpAdditionalHeaders = ["Connection": "keep-alive"]
        
        self.session = URLSession(configuration: config)
    }
    
    func batchSync<T: Codable>(
        operations: [SyncOperation],
        responseType: T.Type
    ) async throws -> [SyncResult<T>] {
        let url = baseURL.appendingPathComponent("batch-sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("gzip", forHTTPHeaderField: "Accept-Encoding")
        
        let batchRequest = BatchSyncRequest(operations: operations)
        request.httpBody = try JSONEncoder().encode(batchRequest)
        
        // Enable compression
        if let bodyData = request.httpBody {
            request.httpBody = try bodyData.compressed()
            request.setValue("gzip", forHTTPHeaderField: "Content-Encoding")
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw SyncError.serverError(httpResponse.statusCode)
        }
        
        let batchResponse = try JSONDecoder().decode(BatchSyncResponse<T>.self, from: data)
        return batchResponse.results
    }
    
    func downloadChanges(since cursor: String) async throws -> DeltaResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("delta"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: "500")
        ]
        
        let url = components.url!
        var request = URLRequest(url: url)
        request.setValue("gzip", forHTTPHeaderField: "Accept-Encoding")
        
        // Add conditional headers for caching
        if let lastETag = UserDefaults.standard.string(forKey: "lastDeltaETag") {
            request.setValue(lastETag, forHTTPHeaderField: "If-None-Match")
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        
        if httpResponse.statusCode == 304 {
            // Not modified
            throw SyncError.notModified
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw SyncError.serverError(httpResponse.statusCode)
        }
        
        // Store ETag for next request
        if let etag = httpResponse.value(forHTTPHeaderField: "ETag") {
            UserDefaults.standard.set(etag, forKey: "lastDeltaETag")
        }
        
        return try JSONDecoder().decode(DeltaResponse.self, from: data)
    }
}

extension Data {
    func compressed() throws -> Data {
        return try (self as NSData).compressed(using: .lzfse) as Data
    }
}
```

## Monitoring and Analytics

### Sync Performance Metrics

```javascript
// React Native sync analytics
class SyncAnalytics {
  constructor(analytics) {
    this.analytics = analytics;
    this.syncMetrics = {
      startTime: null,
      endTime: null,
      itemsProcessed: 0,
      conflicts: 0,
      errors: 0,
      bytesTransferred: 0,
    };
  }

  startSync() {
    this.syncMetrics = {
      startTime: Date.now(),
      endTime: null,
      itemsProcessed: 0,
      conflicts: 0,
      errors: 0,
      bytesTransferred: 0,
    };
  }

  recordItemProcessed(item) {
    this.syncMetrics.itemsProcessed++;
    this.syncMetrics.bytesTransferred += JSON.stringify(item).length;
  }

  recordConflict(conflict) {
    this.syncMetrics.conflicts++;
    this.analytics.track('sync_conflict', {
      itemId: conflict.itemId,
      conflictType: conflict.type,
      resolutionStrategy: conflict.resolution,
    });
  }

  recordError(error) {
    this.syncMetrics.errors++;
    this.analytics.track('sync_error', {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorCode: error.code,
    });
  }

  endSync(success) {
    this.syncMetrics.endTime = Date.now();
    const duration = this.syncMetrics.endTime - this.syncMetrics.startTime;

    this.analytics.track('sync_completed', {
      success,
      duration,
      itemsProcessed: this.syncMetrics.itemsProcessed,
      conflicts: this.syncMetrics.conflicts,
      errors: this.syncMetrics.errors,
      bytesTransferred: this.syncMetrics.bytesTransferred,
      throughput: this.syncMetrics.itemsProcessed / (duration / 1000), // items per second
    });

    // Performance warnings
    if (duration > 30000) { // > 30 seconds
      this.analytics.track('sync_performance_warning', {
        type: 'slow_sync',
        duration,
        itemsProcessed: this.syncMetrics.itemsProcessed,
      });
    }

    if (this.syncMetrics.conflicts / this.syncMetrics.itemsProcessed > 0.1) { // > 10% conflicts
      this.analytics.track('sync_performance_warning', {
        type: 'high_conflict_rate',
        conflictRate: this.syncMetrics.conflicts / this.syncMetrics.itemsProcessed,
      });
    }
  }
}

// Usage in sync manager
class AnalyticsEnabledSyncManager extends SyncManager {
  constructor(database, apiClient, analytics) {
    super(database, apiClient);
    this.analytics = new SyncAnalytics(analytics);
  }

  async performSync() {
    this.analytics.startSync();
    
    try {
      const deltaResponse = await this.apiClient.getDelta(this.lastCursor);
      
      for (const item of deltaResponse.items) {
        try {
          await this.processItem(item);
          this.analytics.recordItemProcessed(item);
        } catch (error) {
          if (error instanceof ConflictError) {
            this.analytics.recordConflict(error.conflict);
            await this.resolveConflict(error.conflict);
          } else {
            this.analytics.recordError(error);
            throw error;
          }
        }
      }
      
      this.analytics.endSync(true);
    } catch (error) {
      this.analytics.recordError(error);
      this.analytics.endSync(false);
      throw error;
    }
  }
}
```

## Testing Strategies

### Sync Testing Framework

```python
# Python testing framework for sync scenarios
import asyncio
import pytest
from unittest.mock import Mock, AsyncMock
from datetime import datetime, timedelta

class SyncTestFramework:
    def __init__(self):
        self.mock_server = Mock()
        self.mock_database = Mock()
        self.sync_manager = SyncManager(self.mock_database, self.mock_server)
        
    async def setup_scenario(self, scenario_name: str):
        """Setup predefined test scenarios"""
        scenarios = {
            'clean_sync': self._setup_clean_sync,
            'conflict_scenario': self._setup_conflict_scenario,
            'network_failure': self._setup_network_failure,
            'large_dataset': self._setup_large_dataset,
        }
        
        if scenario_name in scenarios:
            await scenarios[scenario_name]()
    
    async def _setup_clean_sync(self):
        # Server has newer data, no conflicts
        self.mock_server.get_delta.return_value = {
            'items': [
                {'id': '1', 'title': 'Item 1', 'version': 2},
                {'id': '2', 'title': 'Item 2', 'version': 1},
            ],
            'cursor': 'next_cursor'
        }
        
        self.mock_database.get_items.return_value = [
            {'id': '1', 'title': 'Old Item 1', 'version': 1},
        ]
    
    async def _setup_conflict_scenario(self):
        # Both client and server have modifications
        self.mock_server.get_delta.return_value = {
            'items': [
                {'id': '1', 'title': 'Server Title', 'version': 2, 'modified': datetime.now()},
            ],
            'cursor': 'next_cursor'
        }
        
        self.mock_database.get_items.return_value = [
            {'id': '1', 'title': 'Client Title', 'version': 1, 'modified': datetime.now()},
        ]
        
        self.mock_database.get_pending_changes.return_value = [
            {'id': '1', 'operation': 'UPDATE', 'data': {'title': 'Client Title'}},
        ]
    
    async def _setup_network_failure(self):
        # Simulate network failures
        self.mock_server.get_delta.side_effect = [
            ConnectionError("Network unreachable"),
            ConnectionError("Timeout"),
            {'items': [], 'cursor': 'recovery_cursor'}  # Recovery
        ]
    
    async def _setup_large_dataset(self):
        # Large dataset for performance testing
        items = [
            {'id': str(i), 'title': f'Item {i}', 'version': 1}
            for i in range(10000)
        ]
        
        self.mock_server.get_delta.return_value = {
            'items': items,
            'cursor': 'large_cursor'
        }

@pytest.mark.asyncio
async def test_clean_sync():
    framework = SyncTestFramework()
    await framework.setup_scenario('clean_sync')
    
    result = await framework.sync_manager.perform_sync()
    
    assert result.success == True
    assert result.items_processed == 2
    assert result.conflicts == 0
    
    # Verify database calls
    framework.mock_database.update_item.assert_called()
    framework.mock_database.insert_item.assert_called()

@pytest.mark.asyncio
async def test_conflict_resolution():
    framework = SyncTestFramework()
    await framework.setup_scenario('conflict_scenario')
    
    # Test different conflict resolution strategies
    strategies = ['client_wins', 'server_wins', 'merge']
    
    for strategy in strategies:
        framework.sync_manager.conflict_strategy = strategy
        result = await framework.sync_manager.perform_sync()
        
        assert result.conflicts == 1
        assert result.success == True

@pytest.mark.asyncio
async def test_network_resilience():
    framework = SyncTestFramework()
    await framework.setup_scenario('network_failure')
    
    # Should retry and eventually succeed
    result = await framework.sync_manager.perform_sync()
    
    assert result.success == True
    assert framework.mock_server.get_delta.call_count == 3  # 2 failures + 1 success

@pytest.mark.asyncio
async def test_performance_with_large_dataset():
    framework = SyncTestFramework()
    await framework.setup_scenario('large_dataset')
    
    start_time = datetime.now()
    result = await framework.sync_manager.perform_sync()
    end_time = datetime.now()
    
    duration = (end_time - start_time).total_seconds()
    
    assert result.success == True
    assert result.items_processed == 10000
    assert duration < 30  # Should complete within 30 seconds
    
    # Check throughput
    throughput = result.items_processed / duration
    assert throughput > 100  # At least 100 items per second

class SyncIntegrationTest:
    """Integration tests with real database and network simulation"""
    
    @pytest.fixture
    async def setup_real_database(self):
        # Setup real local database for integration testing
        db = await create_test_database()
        yield db
        await cleanup_test_database(db)
    
    @pytest.mark.integration
    async def test_real_sync_flow(self, setup_real_database):
        db = setup_real_database
        mock_server = create_mock_server()
        sync_manager = SyncManager(db, mock_server)
        
        # Add local data
        await db.insert_item({'id': 'local1', 'title': 'Local Item'})
        
        # Setup server response
        mock_server.get_delta.return_value = {
            'items': [{'id': 'server1', 'title': 'Server Item'}],
            'cursor': 'test_cursor'
        }
        
        # Perform sync
        result = await sync_manager.perform_sync()
        
        # Verify results in real database
        items = await db.get_all_items()
        assert len(items) == 2
        assert any(item['id'] == 'local1' for item in items)
        assert any(item['id'] == 'server1' for item in items)
```

This comprehensive synchronization strategy guide covers the essential patterns and implementations needed for robust mobile data synchronization, including bidirectional sync, conflict resolution, performance optimization, and thorough testing approaches.
