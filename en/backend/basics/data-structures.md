# Basic Data Structures and Algorithms - System Design Context

## Data Structures (Production Use Cases)

### Array/List
- **Spring Framework dependency injection container**
- `@Autowired List<Service>` for multiple bean injection
- Fixed-size vs dynamic arrays
- Memory locality advantages

### Linked List
- **LRU cache implementation**
- Queue structures in messaging systems
- **Spring Cloud Stream message handling**
- Insertion/deletion at O(1)

### Hash Table/Map
- **Spring cache abstractions**
- `ConcurrentHashMap` for thread-safe operations
- **Distributed caching with Redis**
- O(1) average lookup time

### Tree Structures
- **B-tree indices in databases**
- **Trie structures** for autocomplete features
- **Decision trees** in business rules
- Balanced trees for guaranteed performance

### Graph Structures
- **Dependency graphs** in Spring IoC container
- Social networks
- Recommendation systems
- **Circuit breaker state machines**

## Algorithms (Real-World Applications)

### Search Algorithms
- **Binary search** in sorted datasets
- **DFS/BFS** in microservice dependency resolution
- **A*** in route planning
- Full-text search in Elasticsearch

### Sorting Algorithms
- **TimSort** in Java Collections
- **External sorting** for large datasets
- **Distributed sorting** in big data processing
- Quick sort vs merge sort trade-offs

### Caching Algorithms
- **LRU/LFU eviction policies**
- **Write-through/write-back strategies**
- **Distributed cache consistency**
- Cache replacement policies

### Load Balancing
- **Round-robin** algorithm
- **Weighted round-robin**
- **Least connections** algorithms in Spring Cloud LoadBalancer
- Consistent hashing for distributed systems

### Consensus Algorithms
- **Raft** in distributed systems
- **Paxos** for distributed consensus
- **Leader election** in microservices
- Byzantine fault tolerance

## Performance Implications

### Time Complexity
- **O(1)** hash lookups in cache systems
- **O(log n)** database index seeks
- **O(n log n)** sorting operations
- **O(n²)** nested loops to avoid

### Space Complexity
- Memory-efficient data structures
- Garbage collection considerations
- **Off-heap storage strategies**
- Memory pools and object reuse

### Distributed Systems
- **CAP theorem** trade-offs
- **Eventual consistency** models
- **Partitioning strategies**
- Network latency considerations

## Distributed Systems Patterns

### Consensus Algorithms
- **Raft**: Leader-based consensus, log replication
- **Paxos**: Byzantine fault tolerance, complex but robust
- **ZAB**: ZooKeeper Atomic Broadcast, total ordering

### Leader Election
- **ZooKeeper** based leader election
- **etcd** for service coordination
- Custom implementation patterns
- Split-brain prevention

### Distributed Locking
- **Redis-based locks** with expiration
- **Database locks** for consistency
- Optimistic vs pessimistic locking
- Deadlock detection and prevention

### Eventual Consistency
- **CRDTs** (Conflict-free Replicated Data Types)
- **Vector clocks** for causality tracking
- **Version vectors** for conflict resolution
- Gossip protocols for data propagation

### Failure Detection
- **Heartbeat mechanism** for liveness detection
- **Timeout strategies** for failure detection
- Phi accrual failure detector
- Adaptive timeout algorithms

## Scalability Patterns

### Horizontal Scaling
- **Stateless services** design
- **Shared-nothing architecture**
- Microservices decomposition
- Database sharding strategies

### Vertical Scaling
- **Resource optimization** techniques
- **JVM tuning** parameters
- Hardware upgrade strategies
- Performance bottleneck identification

### Caching Strategies
- **Multi-level caching** hierarchy
- **Cache invalidation** strategies
- Write-through vs write-behind
- Cache stampede prevention

### Database Scaling
- **Read replicas** for read scaling
- **Sharding** for write scaling
- **Partitioning** strategies
- Cross-shard query challenges

### Message Queue
- **Asynchronous processing** patterns
- **Back-pressure handling** mechanisms
- Message ordering guarantees
- Dead letter queue handling

## Algorithm Complexity Analysis

### Common Operations
| Data Structure | Access | Search | Insertion | Deletion |
|----------------|--------|--------|-----------|----------|
| Array | O(1) | O(n) | O(n) | O(n) |
| Linked List | O(n) | O(n) | O(1) | O(1) |
| Hash Table | O(1) | O(1) | O(1) | O(1) |
| Binary Tree | O(log n) | O(log n) | O(log n) | O(log n) |
| B-Tree | O(log n) | O(log n) | O(log n) | O(log n) |

### Sorting Algorithms
| Algorithm | Best Case | Average Case | Worst Case | Space |
|-----------|-----------|--------------|------------|-------|
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n) |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) |
| Tim Sort | O(n) | O(n log n) | O(n log n) | O(n) |

## Production Implementation Examples

### LRU Cache Implementation
```java
@Component
public class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> cache;
    private final Node<K, V> head, tail;
    
    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new ConcurrentHashMap<>();
        this.head = new Node<>();
        this.tail = new Node<>();
        head.next = tail;
        tail.prev = head;
    }
    
    // Implementation details...
}
```

### Consistent Hashing for Load Balancing
```java
@Component
public class ConsistentHashLoadBalancer {
    private final SortedMap<Integer, String> circle = new TreeMap<>();
    private final int virtualNodes = 100;
    
    public void addServer(String server) {
        for (int i = 0; i < virtualNodes; i++) {
            circle.put(hash(server + i), server);
        }
    }
    
    public String getServer(String key) {
        int hash = hash(key);
        SortedMap<Integer, String> tailMap = circle.tailMap(hash);
        return tailMap.isEmpty() ? circle.firstEntry().getValue() : tailMap.firstEntry().getValue();
    }
}
```

## Memory Management

### JVM Memory Optimization
- Heap size tuning (-Xmx, -Xms)
- Garbage collection algorithm selection
- Off-heap storage for large datasets
- Memory leak detection and prevention

### Distributed Memory
- Redis clustering for distributed cache
- Hazelcast for in-memory data grid
- Apache Ignite for distributed computing
- Consistency vs performance trade-offs

## Security Considerations

### Algorithm Security
- Cryptographic hash functions
- Secure random number generation
- Timing attack prevention
- Side-channel attack mitigation

### Data Structure Security
- Input validation for data structures
- Bounds checking for arrays
- Hash collision attack prevention
- Memory safety in native code
