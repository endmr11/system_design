---
title: Conflict Resolution
---

# Conflict Resolution (Çakışma Çözümü)

Mobil uygulamalarda çoklu cihaz kullanımı, offline düzenleme ve eşzamanlı veri değişiklikleri nedeniyle ortaya çıkan veri çakışmalarının çözümlenmesi kritik önem taşır. Bu bölümde, basit timestamp-based çözümlerden karmaşık CRDT implementasyonlarına kadar çeşitli conflict resolution stratejileri ele alınmaktadır.

## Conflict Scenarios

### Tipik Çakışma Senaryoları

**Multi-Device Editing**
```typescript
// Aynı dökümanın farklı cihazlarda düzenlenmesi
interface DocumentConflict {
  documentId: string;
  localVersion: DocumentVersion;
  remoteVersion: DocumentVersion;
  conflictFields: string[];
}

class MultiDeviceConflictDetector {
  detectConflicts(local: Document, remote: Document): DocumentConflict | null {
    if (local.lastModified === remote.lastModified) {
      return null; // No conflict
    }
    
    const conflictFields = this.findConflictingFields(local, remote);
    
    if (conflictFields.length === 0) {
      return null; // Different timestamps but no actual conflicts
    }
    
    return {
      documentId: local.id,
      localVersion: local.version,
      remoteVersion: remote.version,
      conflictFields
    };
  }
  
  private findConflictingFields(local: Document, remote: Document): string[] {
    const conflicts: string[] = [];
    
    for (const field in local.data) {
      if (local.data[field] !== remote.data[field]) {
        conflicts.push(field);
      }
    }
    
    return conflicts;
  }
}
```

**Collaborative Editing**
Real-time işbirlikçi düzenleme senaryoları.

```kotlin
// Android Collaborative Editing Conflict
data class EditOperation(
    val id: String,
    val userId: String,
    val timestamp: Long,
    val type: OperationType,
    val position: Int,
    val content: String,
    val vectorClock: VectorClock
)

class CollaborativeConflictResolver {
    fun resolveOperationConflicts(
        localOps: List<EditOperation>,
        remoteOps: List<EditOperation>
    ): List<EditOperation> {
        
        val allOps = (localOps + remoteOps).sortedBy { it.timestamp }
        val resolvedOps = mutableListOf<EditOperation>()
        
        for (op in allOps) {
            val transformedOp = transformOperation(op, resolvedOps)
            resolvedOps.add(transformedOp)
        }
        
        return resolvedOps
    }
    
    private fun transformOperation(
        op: EditOperation,
        appliedOps: List<EditOperation>
    ): EditOperation {
        var transformedOp = op
        
        for (appliedOp in appliedOps) {
            if (needsTransformation(transformedOp, appliedOp)) {
                transformedOp = operationalTransform(transformedOp, appliedOp)
            }
        }
        
        return transformedOp
    }
}
```

## Simple Resolution Strategies

### Last-Write-Wins (LWW)
En basit conflict resolution stratejisi.

```swift
// iOS Last-Write-Wins Implementation
struct LWWResolver {
    static func resolve<T: Timestamped>(_ local: T, _ remote: T) -> T {
        return local.timestamp > remote.timestamp ? local : remote
    }
}

// Usage with Core Data
extension NSManagedObject {
    func resolveConflictLWW(with remote: NSManagedObject) {
        guard let localTimestamp = self.value(forKey: "lastModified") as? Date,
              let remoteTimestamp = remote.value(forKey: "lastModified") as? Date else {
            return
        }
        
        if remoteTimestamp > localTimestamp {
            // Remote wins - update local
            for key in remote.entity.attributesByName.keys {
                self.setValue(remote.value(forKey: key), forKey: key)
            }
        }
        // Local wins - no action needed
    }
}
```

**LWW Problems**
- Data loss riski
- Concurrent edits'te poor user experience
- Causality tracking eksikliği

### First-Write-Wins
Lock-based yaklaşım ile first writer advantage.

```dart
// Flutter First-Write-Wins with Optimistic Locking
class OptimisticLockResolver {
  Future<WriteResult> attemptWrite(
    String documentId,  
    Map<String, dynamic> changes,
    int expectedVersion
  ) async {
    try {
      final currentDoc = await repository.getDocument(documentId);
      
      if (currentDoc.version != expectedVersion) {
        return WriteResult.conflict(
          message: 'Document was modified by another user',
          currentVersion: currentDoc.version,
          expectedVersion: expectedVersion
        );
      }
      
      final updatedDoc = currentDoc.copyWith(
        data: {...currentDoc.data, ...changes},
        version: currentDoc.version + 1,
        lastModified: DateTime.now()
      );
      
      await repository.updateDocument(updatedDoc);
      return WriteResult.success(updatedDoc);
      
    } catch (e) {
      return WriteResult.error(e.toString());
    }
  }
}

sealed class WriteResult {
  const WriteResult();
  
  factory WriteResult.success(Document doc) = WriteSuccess;
  factory WriteResult.conflict({
    required String message,
    required int currentVersion,
    required int expectedVersion
  }) = WriteConflict;
  factory WriteResult.error(String message) = WriteError;
}
```

### Custom Business Logic Resolution
Domain-specific conflict resolution kuralları.

```kotlin
class BusinessLogicResolver {
    
    fun resolveUserProfileConflict(
        local: UserProfile,
        remote: UserProfile
    ): UserProfile {
        return UserProfile(
            id = local.id,
            // Email: remote always wins (server-side validation)
            email = remote.email,
            
            // Name: most recent wins
            name = if (local.nameUpdatedAt > remote.nameUpdatedAt) 
                   local.name else remote.name,
            
            // Settings: merge strategies
            settings = mergeSettings(local.settings, remote.settings),
            
            // Avatar: keep higher resolution
            avatar = selectBestAvatar(local.avatar, remote.avatar),
            
            // Subscription: server always wins
            subscription = remote.subscription
        )
    }
    
    private fun mergeSettings(
        local: UserSettings,
        remote: UserSettings
    ): UserSettings {
        return UserSettings(
            // Notifications: union of preferences
            notifications = local.notifications + remote.notifications,
            
            // Theme: most recent
            theme = if (local.themeUpdatedAt > remote.themeUpdatedAt)
                   local.theme else remote.theme,
            
            // Privacy: most restrictive
            privacy = selectMostRestrictive(local.privacy, remote.privacy)
        )
    }
}
```

## CRDT (Conflict-free Replicated Data Types)

### State-based CRDTs
State merge ile conflict-free replication.

```javascript
// G-Counter (Grow-only Counter) CRDT
class GCounter {
  constructor(actorId) {
    this.actorId = actorId;
    this.counters = new Map();
    this.counters.set(actorId, 0);
  }
  
  increment() {
    const current = this.counters.get(this.actorId) || 0;
    this.counters.set(this.actorId, current + 1);
  }
  
  merge(other) {
    const merged = new GCounter(this.actorId);
    
    // Get all actor IDs from both counters
    const allActors = new Set([
      ...this.counters.keys(),
      ...other.counters.keys()
    ]);
    
    // Take maximum value for each actor
    for (const actor of allActors) {
      const thisValue = this.counters.get(actor) || 0;
      const otherValue = other.counters.get(actor) || 0;
      merged.counters.set(actor, Math.max(thisValue, otherValue));
    }
    
    return merged;
  }
  
  value() {
    return Array.from(this.counters.values()).reduce((sum, val) => sum + val, 0);
  }
}

// PN-Counter (Increment/Decrement Counter)
class PNCounter {
  constructor(actorId) {
    this.positive = new GCounter(actorId);
    this.negative = new GCounter(actorId);
  }
  
  increment() {
    this.positive.increment();
  }
  
  decrement() {
    this.negative.increment();
  }
  
  merge(other) {
    const merged = new PNCounter(this.positive.actorId);
    merged.positive = this.positive.merge(other.positive);
    merged.negative = this.negative.merge(other.negative);
    return merged;
  }
  
  value() {
    return this.positive.value() - this.negative.value();
  }
}
```

### Operation-based CRDTs
Operation replication ile conflict resolution.

```swift
// iOS LWW-Element-Set CRDT
struct LWWElementSet<Element: Hashable> {
    private var added: [Element: TimeVector] = [:]
    private var removed: [Element: TimeVector] = [:]
    private let actorId: String
    
    init(actorId: String) {
        self.actorId = actorId
    }
    
    mutating func add(_ element: Element) {
        let timestamp = TimeVector.now(actorId: actorId)
        added[element] = timestamp
    }
    
    mutating func remove(_ element: Element) {
        let timestamp = TimeVector.now(actorId: actorId)
        removed[element] = timestamp
    }
    
    func contains(_ element: Element) -> Bool {
        guard let addedTime = added[element] else { return false }
        
        if let removedTime = removed[element] {
            return addedTime > removedTime
        }
        
        return true
    }
    
    func merge(with other: LWWElementSet<Element>) -> LWWElementSet<Element> {
        var merged = LWWElementSet<Element>(actorId: actorId)
        
        // Merge added timestamps
        for (element, timestamp) in added {
            if let otherTimestamp = other.added[element] {
                merged.added[element] = max(timestamp, otherTimestamp)
            } else {
                merged.added[element] = timestamp
            }
        }
        
        for (element, timestamp) in other.added {
            if merged.added[element] == nil {
                merged.added[element] = timestamp
            }
        }
        
        // Merge removed timestamps
        for (element, timestamp) in removed {
            if let otherTimestamp = other.removed[element] {
                merged.removed[element] = max(timestamp, otherTimestamp)
            } else {
                merged.removed[element] = timestamp
            }
        }
        
        for (element, timestamp) in other.removed {
            if merged.removed[element] == nil {
                merged.removed[element] = timestamp
            }
        }
        
        return merged
    }
}
```

### Text Editing CRDTs
Collaborative text editing için özel CRDT'ler.

```kotlin
// RGA (Replicated Growable Array) for Text
data class RGAChar(
    val char: Char,
    val id: CharacterId,
    val isVisible: Boolean = true
)

data class CharacterId(
    val actorId: String,
    val sequence: Long,
    val offset: Int = 0
) : Comparable<CharacterId> {
    override fun compareTo(other: CharacterId): Int {
        return when {
            sequence != other.sequence -> sequence.compareTo(other.sequence)
            actorId != other.actorId -> actorId.compareTo(other.actorId)
            else -> offset.compareTo(other.offset)
        }
    }
}

class RGAString(private val actorId: String) {
    private val chars = mutableListOf<RGAChar>()
    private var sequenceCounter = 0L
    
    fun insert(position: Int, char: Char) {
        val id = CharacterId(actorId, ++sequenceCounter)
        val rgaChar = RGAChar(char, id)
        
        // Find insertion point in RGA structure
        val insertionIndex = findInsertionIndex(position, id)
        chars.add(insertionIndex, rgaChar)
    }
    
    fun delete(position: Int) {
        val visiblePosition = getVisiblePosition(position)
        if (visiblePosition < chars.size) {
            chars[visiblePosition] = chars[visiblePosition].copy(isVisible = false)
        }
    }
    
    fun merge(operations: List<RGAOperation>) {
        for (op in operations.sortedBy { it.id }) {
            when (op.type) {
                RGAOperationType.INSERT -> applyInsert(op)
                RGAOperationType.DELETE -> applyDelete(op)
            }
        }
    }
    
    fun toString(): String {
        return chars.filter { it.isVisible }.joinToString("") { it.char.toString() }
    }
    
    private fun findInsertionIndex(position: Int, id: CharacterId): Int {
        // Complex logic to maintain RGA invariants
        // This ensures convergence across all replicas
        var index = 0
        var visibleCount = 0
        
        while (index < chars.size && visibleCount < position) {
            if (chars[index].isVisible) {
                visibleCount++
            }
            if (visibleCount < position) {
                index++
            }
        }
        
        // Handle concurrent inserts at same position
        while (index < chars.size && chars[index].id > id) {
            index++
        }
        
        return index
    }
}
```

## Platform-Specific Implementations

### iOS Core Data Merge Policies
Core Data'da built-in conflict resolution.

```swift
class CoreDataConflictResolver {
    
    func setupMergePolicies() {
        let container = NSPersistentContainer(name: "DataModel")
        
        // Configure merge policy
        container.persistentStoreDescriptions.first?.setOption(
            true as NSNumber,
            forKey: NSPersistentHistoryTrackingKey
        )
        
        container.persistentStoreDescriptions.first?.setOption(
            true as NSNumber,
            forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey
        )
        
        container.viewContext.mergePolicy = NSMergePolicy.mergeByPropertyObjectTrump
    }
    
    func customMergePolicy() -> NSMergePolicy {
        return NSMergePolicy(merge: .mergeByPropertyObjectTrumpMergePolicyType) { conflict in
            // Custom resolution logic
            for case let object as User in conflict.sourceObject {
                if let snapshot = conflict.cachedSnapshot {
                    // Field-level conflict resolution
                    self.resolveUserConflict(object: object, snapshot: snapshot)
                }
            }
            
            return true
        }
    }
    
    private func resolveUserConflict(object: User, snapshot: [String: Any]) {
        // Email: server wins
        if let serverEmail = snapshot["email"] as? String {
            object.email = serverEmail
        }
        
        // Name: most recent timestamp wins
        if let localTimestamp = object.nameUpdatedAt,
           let serverTimestamp = snapshot["nameUpdatedAt"] as? Date {
            if serverTimestamp > localTimestamp {
                object.name = snapshot["name"] as? String
                object.nameUpdatedAt = serverTimestamp
            }
        }
        
        // Settings: merge
        if let serverSettings = snapshot["settings"] as? Data {
            object.settings = mergeUserSettings(
                local: object.settings,
                remote: serverSettings
            )
        }
    }
}
```

### Android Room Conflict Resolution
Room database ile conflict handling.

```kotlin
@Dao
interface UserDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnoreConflict(user: User): Long
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReplaceConflict(user: User): Long
    
    @Query("SELECT * FROM users WHERE id = :id")
    suspend fun getUserById(id: String): User?
    
    @Transaction
    suspend fun resolveUserConflict(localUser: User, remoteUser: User): User {
        val resolved = ConflictResolver.resolveUser(localUser, remoteUser)
        update(resolved)
        return resolved
    }
}

class RoomConflictResolver {
    
    suspend fun handleSyncConflicts(conflicts: List<SyncConflict>) {
        for (conflict in conflicts) {
            when (conflict.entity) {
                "User" -> resolveUserConflict(conflict)
                "Document" -> resolveDocumentConflict(conflict)
                "Settings" -> resolveSettingsConflict(conflict)
            }
        }
    }
    
    private suspend fun resolveUserConflict(conflict: SyncConflict) {
        val local = userDao.getUserById(conflict.entityId) ?: return
        val remote = conflict.remoteData.toUser()
        
        val resolved = when (conflict.resolutionStrategy) {
            ResolutionStrategy.LAST_WRITE_WINS -> {
                if (local.lastModified > remote.lastModified) local else remote
            }
            
            ResolutionStrategy.FIELD_LEVEL_MERGE -> {
                User(
                    id = local.id,
                    email = remote.email, // Server always wins
                    name = if (local.nameUpdatedAt > remote.nameUpdatedAt) 
                           local.name else remote.name,
                    settings = mergeSettings(local.settings, remote.settings)
                )
            }
            
            ResolutionStrategy.USER_CHOICE -> {
                // Present UI for user to choose
                presentConflictResolutionUI(local, remote)
                return // Will be resolved asynchronously
            }
        }
        
        userDao.update(resolved)
    }
}
```

### Flutter Conflict Resolution
Cross-platform conflict handling.

```dart
class FlutterConflictResolver {
  final ConflictResolutionStrategy strategy;
  
  FlutterConflictResolver(this.strategy);
  
  Future<T> resolveConflict<T extends Syncable>(
    T local, 
    T remote,
    {ConflictContext? context}
  ) async {
    switch (strategy) {
      case ConflictResolutionStrategy.lastWriteWins:
        return _resolveLastWriteWins(local, remote);
        
      case ConflictResolutionStrategy.firstWriteWins:
        return local; // Local is always first in this context
        
      case ConflictResolutionStrategy.mergeFields:
        return _mergeFields(local, remote);
        
      case ConflictResolutionStrategy.userChoice:
        return await _presentUserChoice(local, remote, context);
        
      case ConflictResolutionStrategy.crdt:
        return _applyCRDTResolution(local, remote);
    }
  }
  
  T _resolveLastWriteWins<T extends Syncable>(T local, T remote) {
    return local.lastModified.isAfter(remote.lastModified) ? local : remote;
  }
  
  T _mergeFields<T extends Syncable>(T local, T remote) {
    final Map<String, dynamic> localJson = local.toJson();
    final Map<String, dynamic> remoteJson = remote.toJson();
    final Map<String, dynamic> merged = {};
    
    // Get all unique field names
    final allFields = {...localJson.keys, ...remoteJson.keys};
    
    for (final field in allFields) {
      final localValue = localJson[field];
      final remoteValue = remoteJson[field];
      
      // Field-specific merge logic
      merged[field] = _mergeField(field, localValue, remoteValue, local, remote);
    }
    
    return local.fromJson(merged) as T;
  }
  
  dynamic _mergeField(
    String fieldName,
    dynamic localValue,
    dynamic remoteValue,
    Syncable local,
    Syncable remote
  ) {
    // Define field-specific merge strategies
    switch (fieldName) {
      case 'email':
      case 'phone':
        // Server-validated fields: remote wins
        return remoteValue;
        
      case 'preferences':
        // Merge maps/objects
        if (localValue is Map && remoteValue is Map) {
          return {...localValue, ...remoteValue};
        }
        return remoteValue;
        
      case 'tags':
      case 'categories':
        // Merge lists (union)
        if (localValue is List && remoteValue is List) {
          return [...localValue, ...remoteValue].toSet().toList();
        }
        return remoteValue;
        
      default:
        // Default: most recent timestamp wins
        final localTimestamp = local.getFieldTimestamp(fieldName);
        final remoteTimestamp = remote.getFieldTimestamp(fieldName);
        
        if (localTimestamp != null && remoteTimestamp != null) {
          return localTimestamp.isAfter(remoteTimestamp) ? localValue : remoteValue;
        }
        
        return remoteValue; // Fallback to remote
    }
  }
  
  Future<T> _presentUserChoice<T extends Syncable>(
    T local, 
    T remote, 
    ConflictContext? context
  ) async {
    if (context?.isBackground == true) {
      // Can't show UI in background, use fallback strategy
      return _resolveLastWriteWins(local, remote);
    }
    
    // Show conflict resolution dialog
    final result = await showDialog<ConflictResolution>(
      context: context?.buildContext ?? Get.context!,
      builder: (context) => ConflictResolutionDialog(
        local: local,
        remote: remote,
      ),
    );
    
    switch (result?.choice) {
      case ConflictChoice.keepLocal:
        return local;
      case ConflictChoice.keepRemote:
        return remote;
      case ConflictChoice.merge:
        return _mergeFields(local, remote);
      case null:
        // User cancelled, default to LWW
        return _resolveLastWriteWins(local, remote);
    }
  }
}
```

## Advanced Resolution Techniques

### Machine Learning-based Resolution
AI ile conflict resolution pattern learning.

```python
class MLConflictResolver:
    def __init__(self):
        self.model = self.load_trained_model()
        
    def resolve_with_ml(self, conflict_data):
        # Feature extraction from conflict
        features = self.extract_features(conflict_data)
        
        # Predict best resolution strategy
        strategy_prediction = self.model.predict([features])
        
        # Apply predicted strategy
        return self.apply_strategy(conflict_data, strategy_prediction)
    
    def extract_features(self, conflict):
        return [
            conflict.user_engagement_score,
            conflict.data_freshness_score,
            conflict.conflict_complexity,
            conflict.user_preference_history,
            conflict.context_importance
        ]
```

### Semantic Conflict Detection
İçerik analizi ile semantic conflict'ler.

```swift
class SemanticConflictDetector {
    private let nlProcessor: NaturalLanguageProcessor
    
    func detectSemanticConflicts(
        localText: String,
        remoteText: String
    ) -> SemanticConflictResult {
        
        let localTokens = nlProcessor.tokenize(localText)
        let remoteTokens = nlProcessor.tokenize(remoteText)
        
        let semanticSimilarity = calculateSimilarity(localTokens, remoteTokens)
        
        if semanticSimilarity < 0.3 {
            return .majorConflict(
                suggestion: generateMergesuggestion(localText, remoteText)
            )
        } else if semanticSimilarity < 0.7 {
            return .minorConflict(
                autoMerge: attemptAutoMerge(localText, remoteText)
            )
        } else {
            return .noConflict
        }
    }
}
```

---

> Conflict resolution, modern mobil uygulamalarda kullanıcı deneyimi ve veri bütünlüğü açısından kritik önem taşır. Doğru strateji seçimi, uygulama tipine, kullanıcı davranışlarına ve business requirements'lara bağlı olarak belirlenmelidir. CRDT'ler gibi matematiksel olarak conflict-free yaklaşımlar, complex collaboration senaryolarında tercih edilirken, basit LWW stratejileri çoğu durumda yeterli olabilir.
