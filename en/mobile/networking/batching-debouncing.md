# Request Batching & Debouncing Strategies

## Request Batching

### Basic Batching Implementation

Request batching is a critical technique for reducing network overhead and improving mobile app performance by combining multiple small requests into fewer larger ones.

#### Simple Request Batcher
```javascript
class RequestBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100; // ms
    this.pendingRequests = [];
    this.timer = null;
  }

  addRequest(request) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        ...request,
        resolve,
        reject
      });

      if (this.pendingRequests.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchTimeout);
      }
    });
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingRequests.length === 0) return;

    const requestsToProcess = this.pendingRequests.slice();
    this.pendingRequests = [];

    this.processBatch(requestsToProcess);
  }

  async processBatch(requests) {
    try {
      const batchPayload = {
        requests: requests.map(req => ({
          id: req.id || this.generateId(),
          method: req.method,
          url: req.url,
          data: req.data,
          headers: req.headers
        }))
      };

      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      const batchResult = await response.json();
      
      // Distribute results to individual requests
      requests.forEach(request => {
        const result = batchResult.responses.find(r => r.id === request.id);
        if (result) {
          if (result.success) {
            request.resolve(result.data);
          } else {
            request.reject(new Error(result.error));
          }
        } else {
          request.reject(new Error('No response found for request'));
        }
      });
    } catch (error) {
      // If batch fails, reject all requests
      requests.forEach(request => request.reject(error));
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Usage
const batcher = new RequestBatcher({ batchSize: 5, batchTimeout: 200 });

// Individual requests are automatically batched
batcher.addRequest({
  method: 'GET',
  url: '/api/users/1'
}).then(user => console.log(user));

batcher.addRequest({
  method: 'GET',
  url: '/api/users/2'
}).then(user => console.log(user));
```

#### Smart Batching with Request Types
```javascript
class SmartRequestBatcher {
  constructor() {
    this.batchers = new Map();
    this.defaultConfig = {
      read: { batchSize: 20, timeout: 50 },
      write: { batchSize: 5, timeout: 100 },
      delete: { batchSize: 10, timeout: 200 }
    };
  }

  addRequest(request) {
    const requestType = this.getRequestType(request);
    
    if (!this.batchers.has(requestType)) {
      const config = this.defaultConfig[requestType] || this.defaultConfig.read;
      this.batchers.set(requestType, new RequestBatcher(config));
    }

    return this.batchers.get(requestType).addRequest(request);
  }

  getRequestType(request) {
    if (request.method === 'GET') return 'read';
    if (request.method === 'POST' || request.method === 'PUT') return 'write';
    if (request.method === 'DELETE') return 'delete';
    return 'read';
  }

  // Priority-based batching
  addPriorityRequest(request, priority = 'normal') {
    if (priority === 'high') {
      // High priority requests bypass batching
      return this.executeImmediately(request);
    }
    
    return this.addRequest(request);
  }

  async executeImmediately(request) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.data ? JSON.stringify(request.data) : null
      });
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}
```

### GraphQL Batching
```javascript
class GraphQLBatcher {
  constructor(endpoint, options = {}) {
    this.endpoint = endpoint;
    this.batchTimeout = options.batchTimeout || 10;
    this.maxBatchSize = options.maxBatchSize || 10;
    this.pendingQueries = [];
    this.batchTimer = null;
  }

  query(query, variables = {}) {
    return new Promise((resolve, reject) => {
      const queryRequest = {
        query: query.loc ? query.loc.source.body : query,
        variables,
        resolve,
        reject
      };

      this.pendingQueries.push(queryRequest);

      if (this.pendingQueries.length >= this.maxBatchSize) {
        this.executeBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.executeBatch(), this.batchTimeout);
      }
    });
  }

  async executeBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingQueries.length === 0) return;

    const currentBatch = this.pendingQueries.slice();
    this.pendingQueries = [];

    try {
      const batchedQuery = this.createBatchedQuery(currentBatch);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchedQuery)
      });

      const results = await response.json();
      
      // Handle batch response
      if (Array.isArray(results)) {
        results.forEach((result, index) => {
          const originalQuery = currentBatch[index];
          if (result.errors) {
            originalQuery.reject(new Error(result.errors[0].message));
          } else {
            originalQuery.resolve(result.data);
          }
        });
      } else {
        // Single response for batch
        currentBatch.forEach(query => {
          if (results.errors) {
            query.reject(new Error(results.errors[0].message));
          } else {
            query.resolve(results.data);
          }
        });
      }
    } catch (error) {
      currentBatch.forEach(query => query.reject(error));
    }
  }

  createBatchedQuery(queries) {
    if (queries.length === 1) {
      return {
        query: queries[0].query,
        variables: queries[0].variables
      };
    }

    // Create a single query with multiple operations
    const operations = queries.map((q, index) => {
      const operationName = `batch_${index}`;
      return q.query.replace('query', `query ${operationName}`);
    });

    return {
      query: operations.join('\n'),
      variables: queries.reduce((acc, q, index) => {
        Object.keys(q.variables).forEach(key => {
          acc[`${key}_${index}`] = q.variables[key];
        });
        return acc;
      }, {})
    };
  }
}
```

## Debouncing Mechanisms

### Input Debouncing
```javascript
class InputDebouncer {
  constructor(delay = 300) {
    this.delay = delay;
    this.timers = new Map();
  }

  debounce(key, callback, customDelay) {
    const delay = customDelay || this.delay;
    
    // Clear existing timer for this key
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(key);
    }, delay);

    this.timers.set(key, timer);
  }

  // Immediate execution with trailing debounce
  debounceLeading(key, callback, customDelay) {
    const delay = customDelay || this.delay;
    
    if (!this.timers.has(key)) {
      // Execute immediately on first call
      callback();
      
      // Set timer to prevent subsequent calls
      const timer = setTimeout(() => {
        this.timers.delete(key);
      }, delay);
      
      this.timers.set(key, timer);
    }
  }

  // Cancel specific debounced function
  cancel(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  // Cancel all debounced functions
  cancelAll() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

// Search input debouncing example
class SearchDebouncer {
  constructor(searchFunction) {
    this.debouncer = new InputDebouncer(300);
    this.searchFunction = searchFunction;
    this.lastQuery = '';
  }

  search(query) {
    if (query === this.lastQuery) return;
    
    this.lastQuery = query;
    
    if (query.trim() === '') {
      this.debouncer.cancel('search');
      this.clearResults();
      return;
    }

    this.debouncer.debounce('search', () => {
      this.executeSearch(query);
    });
  }

  async executeSearch(query) {
    try {
      const results = await this.searchFunction(query);
      this.displayResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      this.displayError(error);
    }
  }

  displayResults(results) {
    // Update UI with search results
    console.log('Search results:', results);
  }

  displayError(error) {
    // Show error message
    console.error('Search error:', error);
  }

  clearResults() {
    // Clear search results
    console.log('Clearing search results');
  }
}
```

### API Call Debouncing
```javascript
class APIDebouncer {
  constructor() {
    this.pendingCalls = new Map();
    this.debounceDelay = 250;
  }

  async debouncedCall(endpoint, options = {}, customDelay) {
    const delay = customDelay || this.debounceDelay;
    const callKey = this.generateCallKey(endpoint, options);

    // Cancel existing call
    if (this.pendingCalls.has(callKey)) {
      this.pendingCalls.get(callKey).cancel();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await this.makeCall(endpoint, options);
          this.pendingCalls.delete(callKey);
          resolve(result);
        } catch (error) {
          this.pendingCalls.delete(callKey);
          reject(error);
        }
      }, delay);

      this.pendingCalls.set(callKey, {
        timeoutId,
        cancel: () => {
          clearTimeout(timeoutId);
          this.pendingCalls.delete(callKey);
          reject(new Error('Debounced call cancelled'));
        }
      });
    });
  }

  generateCallKey(endpoint, options) {
    // Create unique key based on endpoint and relevant options
    const keyData = {
      endpoint,
      method: options.method || 'GET',
      params: options.params || {},
      // Don't include things like timestamps in key
    };
    
    return JSON.stringify(keyData);
  }

  async makeCall(endpoint, options) {
    const response = await fetch(endpoint, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : null
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Throttling variant - limits call frequency
  async throttledCall(endpoint, options = {}, throttleMs = 1000) {
    const callKey = this.generateCallKey(endpoint, options);
    const now = Date.now();
    
    const lastCall = this.lastCallTimes?.get(callKey) || 0;
    
    if (now - lastCall < throttleMs) {
      // Return cached result or throw error
      throw new Error('Call throttled');
    }

    if (!this.lastCallTimes) {
      this.lastCallTimes = new Map();
    }
    
    this.lastCallTimes.set(callKey, now);
    
    return await this.makeCall(endpoint, options);
  }
}

// Usage example
const apiDebouncer = new APIDebouncer();

// User types in search box
document.getElementById('search').addEventListener('input', async (e) => {
  const query = e.target.value;
  
  if (query.length < 2) return;
  
  try {
    const results = await apiDebouncer.debouncedCall('/api/search', {
      method: 'GET',
      params: { q: query }
    });
    
    displaySearchResults(results);
  } catch (error) {
    if (error.message !== 'Debounced call cancelled') {
      console.error('Search failed:', error);
    }
  }
});
```

## Smart Optimization

### Adaptive Batching
```javascript
class AdaptiveBatcher {
  constructor() {
    this.metrics = {
      batchSizes: [],
      responseTimes: [],
      successRates: []
    };
    this.currentConfig = {
      batchSize: 10,
      timeout: 100
    };
    this.learningEnabled = true;
  }

  async addRequest(request) {
    const startTime = Date.now();
    
    try {
      const result = await this.batcher.addRequest(request);
      
      if (this.learningEnabled) {
        this.recordSuccess(Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      if (this.learningEnabled) {
        this.recordFailure(Date.now() - startTime);
      }
      throw error;
    }
  }

  recordSuccess(responseTime) {
    this.metrics.responseTimes.push(responseTime);
    this.metrics.successRates.push(1);
    this.metrics.batchSizes.push(this.currentConfig.batchSize);
    
    this.adaptConfiguration();
  }

  recordFailure(responseTime) {
    this.metrics.responseTimes.push(responseTime);
    this.metrics.successRates.push(0);
    this.metrics.batchSizes.push(this.currentConfig.batchSize);
    
    this.adaptConfiguration();
  }

  adaptConfiguration() {
    // Only adapt after collecting enough data
    if (this.metrics.responseTimes.length < 10) return;

    const recent = this.getRecentMetrics(20);
    const avgResponseTime = this.average(recent.responseTimes);
    const successRate = this.average(recent.successRates);
    
    // If performance is poor, reduce batch size
    if (avgResponseTime > 2000 || successRate < 0.9) {
      this.currentConfig.batchSize = Math.max(1, this.currentConfig.batchSize - 1);
      this.currentConfig.timeout = Math.min(1000, this.currentConfig.timeout + 50);
    }
    // If performance is good, try to increase efficiency
    else if (avgResponseTime < 500 && successRate > 0.95) {
      this.currentConfig.batchSize = Math.min(50, this.currentConfig.batchSize + 1);
      this.currentConfig.timeout = Math.max(50, this.currentConfig.timeout - 10);
    }

    // Update batcher configuration
    this.updateBatcher();
  }

  getRecentMetrics(count) {
    const sliceStart = Math.max(0, this.metrics.responseTimes.length - count);
    
    return {
      responseTimes: this.metrics.responseTimes.slice(sliceStart),
      successRates: this.metrics.successRates.slice(sliceStart),
      batchSizes: this.metrics.batchSizes.slice(sliceStart)
    };
  }

  average(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  updateBatcher() {
    this.batcher = new RequestBatcher({
      batchSize: this.currentConfig.batchSize,
      batchTimeout: this.currentConfig.timeout
    });
  }
}
```

### Network-Aware Optimization
```javascript
class NetworkAwareOptimizer {
  constructor() {
    this.networkInfo = this.getNetworkInfo();
    this.adaptToNetwork();
    
    // Listen for network changes
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        this.networkInfo = this.getNetworkInfo();
        this.adaptToNetwork();
      });
    }
  }

  getNetworkInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return { effectiveType: '4g' }; // default
  }

  adaptToNetwork() {
    const config = this.getOptimalConfig();
    
    // Update batching configuration
    this.batchConfig = config.batching;
    this.debounceConfig = config.debouncing;
    
    console.log('Network adapted:', {
      network: this.networkInfo.effectiveType,
      config: config
    });
  }

  getOptimalConfig() {
    switch (this.networkInfo.effectiveType) {
      case 'slow-2g':
      case '2g':
        return {
          batching: { batchSize: 3, timeout: 1000 },
          debouncing: { delay: 800 }
        };
      
      case '3g':
        return {
          batching: { batchSize: 5, timeout: 500 },
          debouncing: { delay: 400 }
        };
      
      case '4g':
        return {
          batching: { batchSize: 10, timeout: 200 },
          debouncing: { delay: 200 }
        };
      
      case '5g':
        return {
          batching: { batchSize: 20, timeout: 50 },
          debouncing: { delay: 100 }
        };
      
      default:
        return {
          batching: { batchSize: 10, timeout: 200 },
          debouncing: { delay: 300 }
        };
    }
  }

  // Create optimized batcher based on network
  createOptimizedBatcher() {
    return new RequestBatcher(this.batchConfig);
  }

  // Create optimized debouncer based on network
  createOptimizedDebouncer() {
    return new InputDebouncer(this.debounceConfig.delay);
  }
}
```

### Platform-Specific Optimizations

#### Android Optimizations
```kotlin
class AndroidBatchingOptimizer(private val context: Context) {
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    
    fun getOptimalBatchConfiguration(): BatchConfiguration {
        val networkInfo = connectivityManager.activeNetworkInfo
        val isLowPowerMode = powerManager.isPowerSaveMode
        val isMeteredConnection = connectivityManager.isActiveNetworkMetered
        
        return when {
            isLowPowerMode -> {
                // Conservative batching to save battery
                BatchConfiguration(
                    batchSize = 20,
                    timeout = 2000,
                    priority = "battery"
                )
            }
            isMeteredConnection -> {
                // Aggressive batching to save data
                BatchConfiguration(
                    batchSize = 15,
                    timeout = 1000,
                    priority = "data"
                )
            }
            networkInfo?.type == ConnectivityManager.TYPE_WIFI -> {
                // Optimal performance on WiFi
                BatchConfiguration(
                    batchSize = 5,
                    timeout = 100,
                    priority = "performance"
                )
            }
            else -> {
                // Default mobile configuration
                BatchConfiguration(
                    batchSize = 10,
                    timeout = 300,
                    priority = "balanced"
                )
            }
        }
    }
    
    fun scheduleOptimalBatching() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
            
        val batchingWork = OneTimeWorkRequestBuilder<BatchingWorker>()
            .setConstraints(constraints)
            .build()
            
        WorkManager.getInstance(context).enqueue(batchingWork)
    }
}

data class BatchConfiguration(
    val batchSize: Int,
    val timeout: Long,
    val priority: String
)
```

#### iOS Optimizations
```swift
class iOSBatchingOptimizer {
    private let reachability = SCNetworkReachability.forInternet()
    
    func getOptimalBatchConfiguration() -> BatchConfiguration {
        let networkStatus = getCurrentNetworkStatus()
        let batteryLevel = UIDevice.current.batteryLevel
        let isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        
        switch (networkStatus, isLowPowerMode) {
        case (.wifi, false):
            return BatchConfiguration(
                batchSize: 5,
                timeout: 0.1,
                priority: .performance
            )
            
        case (.cellular, _) where batteryLevel < 0.2:
            return BatchConfiguration(
                batchSize: 20,
                timeout: 2.0,
                priority: .battery
            )
            
        case (.cellular, true):
            return BatchConfiguration(
                batchSize: 15,
                timeout: 1.0,
                priority: .efficiency
            )
            
        default:
            return BatchConfiguration(
                batchSize: 10,
                timeout: 0.3,
                priority: .balanced
            )
        }
    }
    
    private func getCurrentNetworkStatus() -> NetworkStatus {
        // Implementation to detect current network
        // Using Network framework or Reachability
        return .wifi // placeholder
    }
}

struct BatchConfiguration {
    let batchSize: Int
    let timeout: TimeInterval
    let priority: Priority
    
    enum Priority {
        case performance, battery, efficiency, balanced
    }
}

enum NetworkStatus {
    case wifi, cellular, none
}
```

These batching and debouncing strategies provide robust foundation for efficient mobile networking, ensuring optimal performance across different network conditions and device capabilities.
