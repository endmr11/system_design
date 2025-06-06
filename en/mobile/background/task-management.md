# Background Task Management

## Introduction to Background Processing

Background task management is a critical component of mobile applications that ensures seamless user experience by performing operations when the app is not in the foreground. Modern mobile operating systems impose strict limitations on background execution to preserve battery life and system performance.

## Platform-Specific Implementation

### Android Background Tasks

#### WorkManager Integration
```kotlin
class BackgroundTaskManager(private val context: Context) {
    private val workManager = WorkManager.getInstance(context)
    
    fun scheduleDataSync(immediate: Boolean = false) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build()
        
        val syncWorkRequest = if (immediate) {
            OneTimeWorkRequestBuilder<DataSyncWorker>()
                .setConstraints(constraints)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
        } else {
            PeriodicWorkRequestBuilder<DataSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    15,
                    TimeUnit.SECONDS
                )
                .build()
        }
        
        workManager.enqueueUniqueWork(
            "data_sync",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )
    }
    
    fun scheduleImageProcessing(imageUrls: List<String>) {
        val imageProcessingTasks = imageUrls.map { url ->
            OneTimeWorkRequestBuilder<ImageProcessingWorker>()
                .setInputData(workDataOf("image_url" to url))
                .build()
        }
        
        workManager
            .beginWith(imageProcessingTasks)
            .enqueue()
    }
    
    fun cancelAllTasks() {
        workManager.cancelAllWork()
    }
}

class DataSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            val syncService = ServiceLocator.getSyncService()
            val result = syncService.performBackgroundSync()
            
            if (result.isSuccess) {
                // Update local database
                updateLocalData(result.data)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("DataSyncWorker", "Sync failed", e)
            Result.failure()
        }
    }
    
    private suspend fun updateLocalData(data: SyncData) {
        val database = AppDatabase.getInstance(applicationContext)
        database.syncDao().insertAll(data.entities)
    }
}
```

#### Foreground Services for Long-Running Tasks
```kotlin
class LongRunningTaskService : Service() {
    private val notificationId = 1
    private val channelId = "background_tasks"
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_UPLOAD -> startFileUpload()
            ACTION_START_DOWNLOAD -> startFileDownload()
            ACTION_STOP -> stopForeground(true)
        }
        return START_STICKY
    }
    
    private fun startFileUpload() {
        val notification = createProgressNotification("Uploading files...")
        startForeground(notificationId, notification)
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val uploadManager = FileUploadManager()
                uploadManager.uploadFiles { progress ->
                    updateProgressNotification(progress)
                }
                stopSelf()
            } catch (e: Exception) {
                Log.e("LongRunningTaskService", "Upload failed", e)
                stopSelf()
            }
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Background Tasks",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows progress of background tasks"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    companion object {
        const val ACTION_START_UPLOAD = "start_upload"
        const val ACTION_START_DOWNLOAD = "start_download"
        const val ACTION_STOP = "stop"
    }
}
```

### iOS Background Tasks

#### Background App Refresh
```swift
class BackgroundTaskManager {
    static let shared = BackgroundTaskManager()
    
    private let backgroundQueue = DispatchQueue(label: "background.tasks", qos: .background)
    
    func registerBackgroundTasks() {
        // Register background app refresh
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.background-sync",
            using: backgroundQueue
        ) { task in
            self.handleBackgroundSync(task: task as! BGAppRefreshTask)
        }
        
        // Register background processing
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.data-processing",
            using: backgroundQueue
        ) { task in
            self.handleDataProcessing(task: task as! BGProcessingTask)
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
    
    func scheduleDataProcessing() {
        let request = BGProcessingTaskRequest(identifier: "com.app.data-processing")
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60) // 30 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule data processing: \(error)")
        }
    }
    
    private func handleBackgroundSync(task: BGAppRefreshTask) {
        // Schedule next background sync
        scheduleBackgroundSync()
        
        let syncOperation = BackgroundSyncOperation()
        
        task.expirationHandler = {
            syncOperation.cancel()
        }
        
        syncOperation.completionBlock = {
            task.setTaskCompleted(success: !syncOperation.isCancelled)
        }
        
        OperationQueue().addOperation(syncOperation)
    }
    
    private func handleDataProcessing(task: BGProcessingTask) {
        let processingOperation = DataProcessingOperation()
        
        task.expirationHandler = {
            processingOperation.cancel()
        }
        
        processingOperation.completionBlock = {
            task.setTaskCompleted(success: !processingOperation.isCancelled)
        }
        
        OperationQueue().addOperation(processingOperation)
    }
}

class BackgroundSyncOperation: Operation {
    override func main() {
        guard !isCancelled else { return }
        
        let syncService = SyncService.shared
        let semaphore = DispatchSemaphore(value: 0)
        
        syncService.performBackgroundSync { [weak self] result in
            defer { semaphore.signal() }
            
            guard let self = self, !self.isCancelled else { return }
            
            switch result {
            case .success(let data):
                self.handleSyncSuccess(data)
            case .failure(let error):
                self.handleSyncError(error)
            }
        }
        
        semaphore.wait()
    }
    
    private func handleSyncSuccess(_ data: SyncData) {
        // Update local storage
        let coreDataManager = CoreDataManager.shared
        coreDataManager.updateSyncData(data)
    }
    
    private func handleSyncError(_ error: Error) {
        print("Background sync failed: \(error)")
    }
}
```

### React Native Background Tasks

#### Using @react-native-async-storage/async-storage and background jobs
```typescript
import BackgroundJob from 'react-native-background-job';
import AsyncStorage from '@react-native-async-storage/async-storage';

class BackgroundTaskManager {
  private isBackgroundJobRunning = false;

  startBackgroundTasks() {
    BackgroundJob.register({
      jobKey: 'myJob',
      job: () => {
        this.performBackgroundSync();
      }
    });

    BackgroundJob.start({
      jobKey: 'myJob',
      period: 15000, // 15 seconds
    });
  }

  private async performBackgroundSync() {
    if (this.isBackgroundJobRunning) return;
    
    this.isBackgroundJobRunning = true;
    
    try {
      // Fetch pending sync operations
      const pendingOps = await AsyncStorage.getItem('pendingSyncOps');
      const operations = pendingOps ? JSON.parse(pendingOps) : [];
      
      for (const operation of operations) {
        await this.processSyncOperation(operation);
      }
      
      // Clear processed operations
      await AsyncStorage.removeItem('pendingSyncOps');
      
    } catch (error) {
      console.error('Background sync failed:', error);
    } finally {
      this.isBackgroundJobRunning = false;
    }
  }

  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    const { type, data, endpoint } = operation;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Sync operation ${type} completed:`, result);
      
    } catch (error) {
      // Re-queue failed operation
      await this.requeueOperation(operation);
      throw error;
    }
  }

  async queueSyncOperation(operation: SyncOperation) {
    try {
      const existing = await AsyncStorage.getItem('pendingSyncOps');
      const operations = existing ? JSON.parse(existing) : [];
      
      operations.push({
        ...operation,
        timestamp: Date.now(),
        retryCount: 0,
      });
      
      await AsyncStorage.setItem('pendingSyncOps', JSON.stringify(operations));
    } catch (error) {
      console.error('Failed to queue sync operation:', error);
    }
  }

  stopBackgroundTasks() {
    BackgroundJob.stop({
      jobKey: 'myJob',
    });
  }
}

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp?: number;
  retryCount?: number;
}
```

### Flutter Background Processing

#### Using WorkManager plugin
```dart
class BackgroundTaskManager {
  static const String _taskName = 'background_sync_task';
  
  static void initialize() {
    Workmanager().initialize(callbackDispatcher);
  }
  
  static void schedulePeriodicSync() {
    Workmanager().registerPeriodicTask(
      _taskName,
      _taskName,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
    );
  }
  
  static void scheduleOneTimeSync() {
    Workmanager().registerOneOffTask(
      'one_time_sync',
      'one_time_sync',
      constraints: Constraints(
        networkType: NetworkType.connected,
      ),
    );
  }
  
  static void cancelAllTasks() {
    Workmanager().cancelAll();
  }
}

void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    switch (task) {
      case 'background_sync_task':
        await _performBackgroundSync();
        break;
      case 'one_time_sync':
        await _performOneTimeSync();
        break;
    }
    return Future.value(true);
  });
}

Future<void> _performBackgroundSync() async {
  try {
    final syncService = SyncService();
    final pendingOperations = await syncService.getPendingOperations();
    
    for (final operation in pendingOperations) {
      await syncService.processOperation(operation);
    }
    
    print('Background sync completed successfully');
  } catch (e) {
    print('Background sync failed: $e');
  }
}

class SyncService {
  Future<List<SyncOperation>> getPendingOperations() async {
    final prefs = await SharedPreferences.getInstance();
    final operationsJson = prefs.getString('pending_operations') ?? '[]';
    final operationsList = jsonDecode(operationsJson) as List;
    
    return operationsList
        .map((json) => SyncOperation.fromJson(json))
        .toList();
  }
  
  Future<void> processOperation(SyncOperation operation) async {
    final dio = Dio();
    
    try {
      final response = await dio.request(
        operation.endpoint,
        data: operation.data,
        options: Options(method: operation.method),
      );
      
      if (response.statusCode == 200) {
        await _removeProcessedOperation(operation);
      }
    } catch (e) {
      await _handleOperationError(operation, e);
      rethrow;
    }
  }
  
  Future<void> _removeProcessedOperation(SyncOperation operation) async {
    final prefs = await SharedPreferences.getInstance();
    final operations = await getPendingOperations();
    operations.removeWhere((op) => op.id == operation.id);
    
    await prefs.setString(
      'pending_operations',
      jsonEncode(operations.map((op) => op.toJson()).toList()),
    );
  }
  
  Future<void> _handleOperationError(SyncOperation operation, dynamic error) async {
    operation.retryCount++;
    
    if (operation.retryCount < operation.maxRetries) {
      // Re-queue with exponential backoff
      final backoffDelay = Duration(
        seconds: math.pow(2, operation.retryCount).toInt() * 30,
      );
      
      operation.nextRetryTime = DateTime.now().add(backoffDelay);
      await _updateOperation(operation);
    } else {
      // Max retries reached, remove operation
      await _removeProcessedOperation(operation);
    }
  }
}
```

## Task Priority and Queue Management

### Priority-Based Task Scheduling
```typescript
enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

interface BackgroundTask {
  id: string;
  type: string;
  priority: TaskPriority;
  data: any;
  createdAt: number;
  maxRetries: number;
  retryCount: number;
  estimatedDuration: number;
}

class TaskQueue {
  private tasks: BackgroundTask[] = [];
  private isProcessing = false;
  private maxConcurrentTasks = 3;
  private activeTasks = new Set<string>();

  addTask(task: BackgroundTask) {
    this.tasks.push(task);
    this.tasks.sort((a, b) => a.priority - b.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if this.isProcessing || this.tasks.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.tasks.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
      const task = this.tasks.shift()!;
      this.activeTasks.add(task.id);
      
      this.executeTask(task)
        .finally(() => {
          this.activeTasks.delete(task.id);
          
          // Continue processing if there are more tasks
          if (this.tasks.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
            this.processQueue();
          }
        });
    }
    
    // Mark as not processing when no more tasks or max concurrent reached
    if (this.tasks.length === 0 || this.activeTasks.size >= this.maxConcurrentTasks) {
      this.isProcessing = false;
    }
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    try {
      const processor = TaskProcessorFactory.getProcessor(task.type);
      await processor.execute(task);
      
      console.log(`Task ${task.id} completed successfully`);
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        
        // Exponential backoff retry
        const retryDelay = Math.pow(2, task.retryCount) * 1000;
        setTimeout(() => {
          this.addTask(task);
        }, retryDelay);
      } else {
        console.error(`Task ${task.id} failed permanently after ${task.maxRetries} retries`);
      }
    }
  }
}
```

## Memory and Performance Optimization

### Resource Management
```kotlin
class OptimizedBackgroundTaskManager {
    private val memoryThreshold = 0.85f // 85% memory usage threshold
    private val batteryThreshold = 0.15f // 15% battery level threshold
    
    fun shouldExecuteTask(task: BackgroundTask): Boolean {
        return hasEnoughMemory() && 
               hasEnoughBattery() && 
               isNetworkAvailable(task.requiresNetwork)
    }
    
    private fun hasEnoughMemory(): Boolean {
        val runtime = Runtime.getRuntime()
        val usedMemory = runtime.totalMemory() - runtime.freeMemory()
        val maxMemory = runtime.maxMemory()
        
        return (usedMemory.toFloat() / maxMemory.toFloat()) < memoryThreshold
    }
    
    private fun hasEnoughBattery(): Boolean {
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        
        return (batteryLevel / 100f) > batteryThreshold
    }
    
    private fun isNetworkAvailable(requiresNetwork: Boolean): Boolean {
        if (!requiresNetwork) return true
        
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
```

## Error Handling and Recovery

### Robust Error Management
```swift
class BackgroundTaskErrorHandler {
    enum TaskError: Error {
        case networkUnavailable
        case insufficientStorage
        case authenticationFailed
        case serverError(Int)
        case timeoutError
        case unknownError(Error)
    }
    
    func handleTaskError(_ error: Error, for task: BackgroundTask) -> TaskRetryStrategy {
        switch error {
        case TaskError.networkUnavailable:
            return .retryAfter(delay: 30, maxRetries: 5)
            
        case TaskError.authenticationFailed:
            return .retryAfter(delay: 60, maxRetries: 2)
            
        case TaskError.serverError(let code) where code >= 500:
            return .retryAfter(delay: 60, maxRetries: 3)
            
        case TaskError.serverError(let code) where code >= 400:
            return .abandon // Client errors shouldn't be retried
            
        case TaskError.timeoutError:
            return .retryAfter(delay: 120, maxRetries: 2)
            
        default:
            return .retryAfter(delay: 30, maxRetries: 1)
        }
    }
}

enum TaskRetryStrategy {
    case retryAfter(delay: TimeInterval, maxRetries: Int)
    case abandon
}
```

## Best Practices

### 1. **Resource Awareness**
- Monitor battery level and charging state
- Check available memory before executing tasks
- Respect network connectivity constraints
- Consider device thermal state

### 2. **User Experience**
- Provide clear progress indicators for long-running tasks
- Allow users to pause/cancel background operations
- Minimize notification spam
- Respect user preferences for background activity

### 3. **Platform Guidelines**
- Follow platform-specific background execution limits
- Use appropriate background task types for each platform
- Handle task expiration gracefully
- Implement proper cleanup procedures

### 4. **Testing and Monitoring**
```typescript
class BackgroundTaskMonitor {
  private metrics: TaskMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    memoryUsage: [],
    batteryImpact: []
  };

  recordTaskExecution(task: BackgroundTask, duration: number, success: boolean) {
    this.metrics.totalTasks++;
    
    if (success) {
      this.metrics.successfulTasks++;
    } else {
      this.metrics.failedTasks++;
    }
    
    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalTasks - 1) + duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalTasks;
    
    // Record memory usage
    this.recordMemoryUsage();
  }

  private recordMemoryUsage() {
    const memoryInfo = performance as any;
    if (memoryInfo.memory) {
      this.metrics.memoryUsage.push({
        used: memoryInfo.memory.usedJSHeapSize,
        total: memoryInfo.memory.totalJSHeapSize,
        timestamp: Date.now()
      });
      
      // Keep only last 100 measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  getPerformanceReport(): TaskPerformanceReport {
    const successRate = (this.metrics.successfulTasks / this.metrics.totalTasks) * 100;
    
    return {
      totalTasks: this.metrics.totalTasks,
      successRate: successRate,
      averageExecutionTime: this.metrics.averageExecutionTime,
      failureRate: 100 - successRate,
      memoryTrend: this.calculateMemoryTrend(),
      recommendations: this.generateRecommendations()
    };
  }
}
```

## Conclusion

Effective background task management is crucial for mobile applications that need to perform operations outside of user interaction. By implementing platform-specific solutions, managing resources carefully, and following best practices, you can create robust background processing systems that enhance user experience while respecting system constraints and battery life.

Key takeaways:
- Use appropriate background task mechanisms for each platform
- Implement intelligent resource management and constraint awareness
- Design fault-tolerant systems with proper error handling and retry strategies
- Monitor and optimize background task performance continuously
- Always prioritize user experience and system health over feature completeness
