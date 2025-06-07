# Advanced Network Patterns

## WebSocket Implementation

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Heartbeat
    
    Client->>Server: WebSocket Connection
    Server-->>Client: Connection Acknowledgment
    loop Every 30 seconds
        Client->>Server: Ping
        Server-->>Client: Pong
    end
    Note over Client,Server: Heartbeat Mechanism
    
    alt Connection Loss
        Client->>Client: Reconnection Strategy
        Note over Client: Exponential Backoff
        Client->>Server: Reconnection Attempt
    end
```

### Connection Management

WebSocket connections require careful connection management as they are long-running connections:

#### Heartbeat Mechanism
```javascript
class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connection established');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'pong') {
        console.log('Heartbeat response received');
      } else {
        this.handleMessage(message);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.stopHeartbeat();
      this.reconnect();
    };
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
```

#### Reconnection Strategy
```javascript
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      reconnectDecay: 1.5,
      ...options
    };
    this.reconnectAttempts = 0;
  }

  reconnect() {
    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      const timeout = this.options.reconnectInterval * 
        Math.pow(this.options.reconnectDecay, this.reconnectAttempts);
      
      setTimeout(() => {
        console.log(`Reconnection attempt: ${this.reconnectAttempts + 1}`);
        this.reconnectAttempts++;
        this.connect();
      }, Math.min(timeout, this.options.maxReconnectInterval));
    } else {
      console.error('Maximum reconnection attempts exceeded');
    }
  }
}
```

#### Connection Pooling
```javascript
class WebSocketPool {
  constructor(baseUrl, poolSize = 3) {
    this.baseUrl = baseUrl;
    this.poolSize = poolSize;
    this.connections = [];
    this.currentIndex = 0;
  }

  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const ws = new ReconnectingWebSocket(`${this.baseUrl}/${i}`);
      this.connections.push(ws);
    }
  }

  getConnection() {
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.poolSize;
    return connection;
  }

  broadcast(message) {
    this.connections.forEach(connection => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    });
  }
}
```

### Message Handling

#### Message Queuing
```javascript
class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(message) {
    this.queue.push({
      ...message,
      timestamp: Date.now(),
      retries: 0
    });
    
    if (!this.processing) {
      this.process();
    }
  }

  async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const message = this.queue.shift();
      
      try {
        await this.sendMessage(message);
      } catch (error) {
        console.error('Message sending failed:', error);
        
        if (message.retries < 3) {
          message.retries++;
          this.queue.unshift(message); // Add back to front of queue
        } else {
          console.error('Message exceeded maximum retry attempts:', message);
        }
      }
    }
    
    this.processing = false;
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        resolve();
      } else {
        reject(new Error('WebSocket connection is closed'));
      }
    });
  }
}
```

#### Priority-Based Delivery
```javascript
class PriorityMessageQueue {
  constructor() {
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];
  }

  enqueue(message, priority = 'normal') {
    const queuedMessage = {
      ...message,
      timestamp: Date.now(),
      priority
    };

    switch (priority) {
      case 'high':
        this.highPriorityQueue.push(queuedMessage);
        break;
      case 'low':
        this.lowPriorityQueue.push(queuedMessage);
        break;
      default:
        this.normalPriorityQueue.push(queuedMessage);
    }

    this.processNext();
  }

  processNext() {
    let nextMessage;
    
    if (this.highPriorityQueue.length > 0) {
      nextMessage = this.highPriorityQueue.shift();
    } else if (this.normalPriorityQueue.length > 0) {
      nextMessage = this.normalPriorityQueue.shift();
    } else if (this.lowPriorityQueue.length > 0) {
      nextMessage = this.lowPriorityQueue.shift();
    }

    if (nextMessage) {
      this.sendMessage(nextMessage);
    }
  }
}
```

### Platform-Specific WebSocket Implementation

#### Android WebSocket
```kotlin
class AndroidWebSocketManager {
    private lateinit var webSocket: WebSocket
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    fun connect(url: String) {
        val request = Request.Builder()
            .url(url)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("WebSocket", "Connection established")
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocket", "Connection closing: $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocket", "Connection error", t)
                scheduleReconnect()
            }
        })
    }

    private fun startHeartbeat() {
        val handler = Handler(Looper.getMainLooper())
        val heartbeatRunnable = object : Runnable {
            override fun run() {
                webSocket.send("""{"type":"ping"}""")
                handler.postDelayed(this, 30000)
            }
        }
        handler.post(heartbeatRunnable)
    }
}
```

#### iOS WebSocket
```swift
class iOSWebSocketManager: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var heartbeatTimer: Timer?
    
    func connect(to url: URL) {
        urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        webSocketTask = urlSession?.webSocketTask(with: url)
        webSocketTask?.resume()
        
        startHeartbeat()
        receiveMessage()
    }
    
    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            self.sendPing()
        }
    }
    
    private func sendPing() {
        let message = URLSessionWebSocketTask.Message.string("""{"type":"ping"}""")
        webSocketTask?.send(message) { error in
            if let error = error {
                print("Ping sending failed: \(error)")
            }
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    self?.handleData(data)
                @unknown default:
                    break
                }
                self?.receiveMessage() // Listen for next message
            case .failure(let error):
                print("Message receiving error: \(error)")
                self?.scheduleReconnect()
            }
        }
    }
}
```

## GraphQL Optimization

```mermaid
graph TD
    A[Client] -->|1. Query Request| B[GraphQL Client]
    B -->|2. Cache Check| C{Cache Hit?}
    C -->|Yes| D[Return Cached Data]
    C -->|No| E[Network Request]
    E -->|3. Query Execution| F[GraphQL Server]
    F -->|4. Data Fetch| G[Database/External APIs]
    G -->|5. Response| F
    F -->|6. Response| B
    B -->|7. Cache Update| H[Cache Store]
    B -->|8. Response| A
    
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#bbf,stroke:#333,stroke-width:2px
```

### Query Optimization

#### Field Selection
```javascript
// Instead of fetching unnecessary fields, only get what you need
const USER_PROFILE_QUERY = gql`
  query GetUserProfile($userId: ID!) {
    user(id: $userId) {
      id
      name
      email
      avatar {
        url
        alt
      }
      # Remove unnecessary fields
      # createdAt
      # updatedAt
      # permissions
    }
  }
`;
```

#### Fragment Usage
```javascript
// Use fragments for common fields
const USER_FRAGMENT = gql`
  fragment UserInfo on User {
    id
    name
    email
    avatar {
      url
      alt
    }
  }
`;

const USER_LIST_QUERY = gql`
  query GetUsers {
    users {
      ...UserInfo
      role
    }
  }
  ${USER_FRAGMENT}
`;

const USER_DETAIL_QUERY = gql`
  query GetUserDetail($id: ID!) {
    user(id: $id) {
      ...UserInfo
      bio
      preferences {
        theme
        language
      }
    }
  }
  ${USER_FRAGMENT}
`;
```

#### Query Batching
```javascript
class GraphQLBatcher {
  constructor(client, batchTimeout = 10) {
    this.client = client;
    this.batchTimeout = batchTimeout;
    this.batchQueue = [];
    this.batchTimer = null;
  }

  query(query, variables = {}) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        query,
        variables,
        resolve,
        reject
      });

      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.executeBatch();
        }, this.batchTimeout);
      }
    });
  }

  async executeBatch() {
    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    try {
      const batchQuery = this.createBatchQuery(currentBatch);
      const result = await this.client.query(batchQuery);
      
      this.resolveBatchResults(currentBatch, result);
    } catch (error) {
      currentBatch.forEach(item => item.reject(error));
    }
  }

  createBatchQuery(batch) {
    // Combine multiple queries into a single query
    const queries = batch.map((item, index) => {
      return `query_${index}: ${item.query.loc.source.body}`;
    });

    return gql`
      query BatchQuery {
        ${queries.join('\n')}
      }
    `;
  }
}
```

### Caching Strategy

#### Client-Side Caching
```javascript
class GraphQLCache {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
  }

  set(key, data, ttl = 300000) { // 5 minutes TTL
    this.cache.set(key, data);
    this.ttl.set(key, Date.now() + ttl);
  }

  get(key) {
    if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  invalidate(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.ttl.delete(key);
      }
    }
  }
}
```

#### Server-Side Caching
```javascript
// GraphQL server-side caching with Redis
const redis = require('redis');
const client = redis.createClient();

const typeDefs = gql`
  type Query {
    user(id: ID!): User @cacheControl(maxAge: 300)
    posts(limit: Int): [Post] @cacheControl(maxAge: 60)
  }
`;

const resolvers = {
  Query: {
    user: async (parent, { id }, context) => {
      const cacheKey = `user:${id}`;
      const cached = await client.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const user = await getUserById(id);
      await client.setex(cacheKey, 300, JSON.stringify(user));
      
      return user;
    }
  }
};
```

### Flutter GraphQL Implementation
```dart
class GraphQLService {
  late GraphQLClient _client;
  
  GraphQLService() {
    final HttpLink httpLink = HttpLink('https://api.example.com/graphql');
    final AuthLink authLink = AuthLink(getToken: () async => 'Bearer $token');
    final Link link = authLink.concat(httpLink);
    
    _client = GraphQLClient(
      cache: GraphQLCache(store: InMemoryStore()),
      link: link,
    );
  }

  Future<QueryResult> query(DocumentNode document, {Map<String, dynamic>? variables}) async {
    final QueryOptions options = QueryOptions(
      document: document,
      variables: variables ?? {},
      fetchPolicy: FetchPolicy.cacheAndNetwork,
    );
    
    return await _client.query(options);
  }

  Future<QueryResult> mutate(DocumentNode document, {Map<String, dynamic>? variables}) async {
    final MutationOptions options = MutationOptions(
      document: document,
      variables: variables ?? {},
    );
    
    return await _client.mutate(options);
  }
}
```

## Real-Time Data Sync

```mermaid
stateDiagram-v2
    [*] --> LocalState
    LocalState --> OptimisticUpdate: User Change
    OptimisticUpdate --> PendingUpdate: UI Update
    PendingUpdate --> ServerSync: Send to Server
    ServerSync --> ConfirmedUpdate: Success
    ServerSync --> Rollback: Error
    ConfirmedUpdate --> LocalState: State Update
    Rollback --> LocalState: Revert to Previous State
    
    state OptimisticUpdate {
        [*] --> UpdateUI
        UpdateUI --> StorePreviousState
        StorePreviousState --> [*]
    }
    
    state ServerSync {
        [*] --> SendToServer
        SendToServer --> WaitResponse
        WaitResponse --> [*]
    }
```

### Conflict Resolution

#### Last-Write-Wins Strategy
```javascript
class LastWriteWinsResolver {
  resolveConflict(localData, remoteData) {
    // Accept the last update based on timestamp
    if (localData.updatedAt > remoteData.updatedAt) {
      return localData;
    } else {
      return remoteData;
    }
  }

  mergeData(local, remote) {
    const resolved = { ...local };
    
    Object.keys(remote).forEach(key => {
      if (remote[key].updatedAt > (local[key]?.updatedAt || 0)) {
        resolved[key] = remote[key];
      }
    });

    return resolved;
  }
}
```

#### Merge Strategies
```javascript
class MergeStrategy {
  smartMerge(localData, remoteData) {
    const merged = { ...localData };
    
    // Conflict resolution rules
    const resolutionRules = {
      // String fields: Use remote if different
      title: (local, remote) => remote !== local ? remote : local,
      
      // Arrays: Merge unique items
      tags: (local, remote) => [...new Set([...local, ...remote])],
      
      // Objects: Deep merge
      settings: (local, remote) => this.deepMerge(local, remote),
      
      // Numbers: Use higher value
      score: (local, remote) => Math.max(local, remote)
    };

    Object.keys(remoteData).forEach(key => {
      if (resolutionRules[key]) {
        merged[key] = resolutionRules[key](localData[key], remoteData[key]);
      } else {
        merged[key] = remoteData[key];
      }
    });

    return merged;
  }

  deepMerge(obj1, obj2) {
    const result = { ...obj1 };
    
    Object.keys(obj2).forEach(key => {
      if (typeof obj2[key] === 'object' && !Array.isArray(obj2[key])) {
        result[key] = this.deepMerge(result[key] || {}, obj2[key]);
      } else {
        result[key] = obj2[key];
      }
    });

    return result;
  }
}
```

#### Version Vectors
```javascript
class VectorClock {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.vector = new Map();
    this.vector.set(nodeId, 0);
  }

  tick() {
    const currentValue = this.vector.get(this.nodeId) || 0;
    this.vector.set(this.nodeId, currentValue + 1);
    return this.getVector();
  }

  update(otherVector) {
    // Merge vector clocks
    Object.keys(otherVector).forEach(nodeId => {
      const currentValue = this.vector.get(nodeId) || 0;
      const otherValue = otherVector[nodeId];
      this.vector.set(nodeId, Math.max(currentValue, otherValue));
    });
    
    // Increment own counter
    this.tick();
  }

  compare(otherVector) {
    const thisKeys = [...this.vector.keys()];
    const otherKeys = Object.keys(otherVector);
    const allKeys = [...new Set([...thisKeys, ...otherKeys])];
    
    let thisGreater = false;
    let otherGreater = false;
    
    allKeys.forEach(key => {
      const thisValue = this.vector.get(key) || 0;
      const otherValue = otherVector[key] || 0;
      
      if (thisValue > otherValue) {
        thisGreater = true;
      } else if (otherValue > thisValue) {
        otherGreater = true;
      }
    });
    
    if (thisGreater && !otherGreater) return 1;  // This is newer
    if (otherGreater && !thisGreater) return -1; // Other is newer
    return 0; // Concurrent/conflicting
  }

  getVector() {
    return Object.fromEntries(this.vector);
  }
}
```