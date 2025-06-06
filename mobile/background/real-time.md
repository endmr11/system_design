# Gerçek Zamanlı İletişim

## Genel Bakış

Gerçek zamanlı iletişim, modern mobil uygulamalarda kullanıcı etkileşimini artıran kritik bir özelliktir. Bu dokümantasyon WebSocket, Server-Sent Events ve diğer gerçek zamanlı teknolojilerin mobil platformlarda kullanımını kapsar.

## WebSocket Implementation

### iOS WebSocket
```swift
import Foundation
import Network

class WebSocketManager: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private let urlSession = URLSession(configuration: .default)
    
    func connect(to url: URL) {
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.delegate = self
        webSocketTask?.resume()
        
        receiveMessage()
    }
    
    func sendMessage(_ message: String) {
        let message = URLSessionWebSocketTask.Message.string(message)
        webSocketTask?.send(message) { error in
            if let error = error {
                print("WebSocket send error: \(error)")
            }
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    print("Received text: \(text)")
                case .data(let data):
                    print("Received data: \(data)")
                @unknown default:
                    break
                }
                
                // Bir sonraki mesaj için dinlemeye devam et
                self?.receiveMessage()
                
            case .failure(let error):
                print("WebSocket receive error: \(error)")
            }
        }
    }
}
```

### Android WebSocket
```kotlin
import okhttp3.*
import okio.ByteString

class WebSocketManager : WebSocketListener() {
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    
    fun connect(url: String) {
        val request = Request.Builder()
            .url(url)
            .build()
            
        webSocket = client.newWebSocket(request, this)
    }
    
    fun sendMessage(message: String) {
        webSocket?.send(message)
    }
    
    override fun onOpen(webSocket: WebSocket, response: Response) {
        println("WebSocket connected")
    }
    
    override fun onMessage(webSocket: WebSocket, text: String) {
        println("Received message: $text")
        // UI thread'de işle
        Handler(Looper.getMainLooper()).post {
            handleMessage(text)
        }
    }
    
    override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
        println("Received bytes: ${bytes.hex()}")
    }
    
    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(1000, null)
        println("WebSocket closing: $code $reason")
    }
    
    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        println("WebSocket error: ${t.message}")
    }
}
```

## Server-Sent Events (SSE)

### React Native SSE
```typescript
import { EventSource } from 'react-native-sse';

class SSEManager {
    private eventSource: EventSource | null = null;
    
    connect(url: string) {
        this.eventSource = new EventSource(url, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        this.eventSource.addEventListener('open', (event) => {
            console.log('SSE connection opened');
        });
        
        this.eventSource.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        });
        
        this.eventSource.addEventListener('error', (event) => {
            console.error('SSE error:', event);
        });
    }
    
    private handleMessage(data: any) {
        switch (data.type) {
            case 'notification':
                this.showNotification(data.payload);
                break;
            case 'update':
                this.updateUI(data.payload);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    disconnect() {
        this.eventSource?.close();
        this.eventSource = null;
    }
}
```

## Socket.IO Integration

### Client Implementation
```typescript
import io from 'socket.io-client';

class SocketIOManager {
    private socket: any;
    
    connect() {
        this.socket = io('ws://localhost:3000', {
            transports: ['websocket'],
            auth: {
                token: getAuthToken()
            }
        });
        
        this.setupEventListeners();
    }
    
    private setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('message', (data: any) => {
            this.handleMessage(data);
        });
        
        this.socket.on('user_joined', (user: any) => {
            this.handleUserJoined(user);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        this.socket.on('error', (error: any) => {
            console.error('Socket error:', error);
        });
    }
    
    joinRoom(roomId: string) {
        this.socket.emit('join_room', { roomId });
    }
    
    sendMessage(roomId: string, message: string) {
        this.socket.emit('send_message', {
            roomId,
            message,
            timestamp: new Date().toISOString()
        });
    }
}
```

## Offline Handling

### Connection State Management
```swift
import Network

class ConnectionManager: ObservableObject {
    @Published var isConnected = false
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                
                if self?.isConnected == true {
                    self?.reconnectWebSocket()
                }
            }
        }
        monitor.start(queue: queue)
    }
    
    private func reconnectWebSocket() {
        // WebSocket yeniden bağlantısı
        WebSocketManager.shared.reconnect()
        
        // Offline sırasında biriken mesajları gönder
        OfflineMessageQueue.shared.sendPendingMessages()
    }
}
```

### Message Queue for Offline Support
```kotlin
class OfflineMessageQueue {
    private val database = Room.databaseBuilder(
        context,
        AppDatabase::class.java,
        "offline_messages"
    ).build()
    
    suspend fun queueMessage(message: Message) {
        if (!NetworkUtils.isConnected()) {
            database.messageDao().insert(
                OfflineMessage(
                    id = UUID.randomUUID().toString(),
                    content = message.toJson(),
                    timestamp = System.currentTimeMillis(),
                    retryCount = 0
                )
            )
        } else {
            sendMessageDirectly(message)
        }
    }
    
    suspend fun sendPendingMessages() {
        val pendingMessages = database.messageDao().getAllPending()
        
        for (message in pendingMessages) {
            try {
                val originalMessage = Message.fromJson(message.content)
                sendMessageDirectly(originalMessage)
                
                database.messageDao().delete(message)
            } catch (e: Exception) {
                // Retry count'ı artır
                database.messageDao().incrementRetryCount(message.id)
                
                if (message.retryCount >= MAX_RETRY_COUNT) {
                    database.messageDao().delete(message)
                }
            }
        }
    }
}
```

## Performance Optimization

### Connection Pooling
```swift
class ConnectionPool {
    private var connections: [String: WebSocketManager] = [:]
    private let maxConnections = 5
    
    func getConnection(for url: String) -> WebSocketManager {
        if let existing = connections[url] {
            return existing
        }
        
        if connections.count >= maxConnections {
            // En eski bağlantıyı kapat
            let oldestKey = connections.keys.first!
            connections[oldestKey]?.disconnect()
            connections.removeValue(forKey: oldestKey)
        }
        
        let newConnection = WebSocketManager()
        newConnection.connect(to: URL(string: url)!)
        connections[url] = newConnection
        
        return newConnection
    }
}
```

### Message Batching
```typescript
class MessageBatcher {
    private batch: any[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private readonly BATCH_SIZE = 10;
    private readonly BATCH_TIMEOUT = 1000; // 1 second
    
    addMessage(message: any) {
        this.batch.push(message);
        
        if (this.batch.length >= this.BATCH_SIZE) {
            this.flushBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushBatch();
            }, this.BATCH_TIMEOUT);
        }
    }
    
    private flushBatch() {
        if (this.batch.length > 0) {
            this.sendBatch(this.batch);
            this.batch = [];
        }
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }
    
    private sendBatch(messages: any[]) {
        WebSocketManager.shared.sendMessage(JSON.stringify({
            type: 'batch',
            messages: messages
        }));
    }
}
```

Bu yaklaşımlarla mobil uygulamanızda güvenilir ve performanslı gerçek zamanlı iletişim sistemi oluşturabilirsiniz.
