---
title: Conflict Resolution
---

# Conflict Resolution

Conflict resolution is a critical aspect of mobile data synchronization when multiple clients can modify the same data simultaneously. This section covers various conflict detection mechanisms, resolution strategies, and implementation patterns to ensure data consistency while maintaining user experience.

## Conflict Detection

### Version-Based Detection

Version-based conflict detection uses version numbers or timestamps to identify when the same piece of data has been modified by multiple clients.

#### Optimistic Locking with Version Numbers

```swift
// iOS version-based conflict detection
struct VersionedItem {
    let id: String
    let title: String
    let content: String
    let version: Int
    let lastModified: Date
    let modifiedBy: String
}

class VersionConflictDetector {
    func detectConflict(local: VersionedItem, server: VersionedItem) -> ConflictType? {
        if local.id != server.id {
            return nil // Different items
        }
        
        if local.version == server.version {
            return nil // No conflict
        }
        
        if local.version < server.version {
            return .serverNewer
        }
        
        if local.version > server.version {
            return .clientNewer
        }
        
        // This shouldn't happen with proper versioning
        return .versionMismatch
    }
    
    func hasConflict(localChanges: [VersionedItem], serverChanges: [VersionedItem]) -> [ConflictPair] {
        var conflicts: [ConflictPair] = []
        
        let serverMap = Dictionary(uniqueKeysWithValues: serverChanges.map { ($0.id, $0) })
        
        for localItem in localChanges {
            if let serverItem = serverMap[localItem.id] {
                if let conflictType = detectConflict(local: localItem, server: serverItem) {
                    conflicts.append(ConflictPair(
                        local: localItem,
                        server: serverItem,
                        type: conflictType
                    ))
                }
            }
        }
        
        return conflicts
    }
}

enum ConflictType {
    case serverNewer
    case clientNewer
    case versionMismatch
    case simultaneousModification
}

struct ConflictPair {
    let local: VersionedItem
    let server: VersionedItem
    let type: ConflictType
}
```

#### Timestamp-Based Detection

```kotlin
// Android timestamp-based conflict detection
data class TimestampedItem(
    val id: String,
    val title: String,
    val content: String,
    val lastModified: Long,
    val lastSynced: Long,
    val modifiedBy: String
)

class TimestampConflictDetector {
    private val conflictWindowMs = 1000L // 1 second tolerance
    
    fun detectConflict(local: TimestampedItem, server: TimestampedItem): ConflictInfo? {
        if (local.id != server.id) return null
        
        val localModifiedSinceSync = local.lastModified > local.lastSynced
        val serverModifiedSinceSync = server.lastModified > local.lastSynced
        
        if (!localModifiedSinceSync && !serverModifiedSinceSync) {
            return null // No changes since last sync
        }
        
        if (localModifiedSinceSync && !serverModifiedSinceSync) {
            return null // Only local changes
        }
        
        if (!localModifiedSinceSync && serverModifiedSinceSync) {
            return null // Only server changes
        }
        
        // Both modified since last sync - conflict
        return ConflictInfo(
            localItem = local,
            serverItem = server,
            type = when {
                Math.abs(local.lastModified - server.lastModified) < conflictWindowMs -> 
                    ConflictType.SIMULTANEOUS
                local.lastModified > server.lastModified -> 
                    ConflictType.LOCAL_NEWER
                else -> 
                    ConflictType.SERVER_NEWER
            }
        )
    }
    
    fun analyzeConflicts(localChanges: List<TimestampedItem>, serverChanges: List<TimestampedItem>): List<ConflictInfo> {
        val serverMap = serverChanges.associateBy { it.id }
        val conflicts = mutableListOf<ConflictInfo>()
        
        for (localItem in localChanges) {
            serverMap[localItem.id]?.let { serverItem ->
                detectConflict(localItem, serverItem)?.let { conflict ->
                    conflicts.add(conflict)
                }
            }
        }
        
        return conflicts
    }
}

data class ConflictInfo(
    val localItem: TimestampedItem,
    val serverItem: TimestampedItem,
    val type: ConflictType
)

enum class ConflictType {
    SIMULTANEOUS,
    LOCAL_NEWER,
    SERVER_NEWER
}
```

### Content-Based Detection

Content-based detection uses checksums or content hashes to identify conflicts more precisely.

```typescript
// React Native content-based conflict detection
import crypto from 'crypto';

interface ContentItem {
  id: string;
  title: string;
  content: string;
  checksum: string;
  lastModified: number;
}

class ContentConflictDetector {
  private generateChecksum(item: Omit<ContentItem, 'checksum'>): string {
    const content = JSON.stringify({
      title: item.title,
      content: item.content,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  private validateChecksum(item: ContentItem): boolean {
    const expectedChecksum = this.generateChecksum(item);
    return expectedChecksum === item.checksum;
  }
  
  detectContentConflict(
    local: ContentItem, 
    server: ContentItem, 
    baseVersion?: ContentItem
  ): ContentConflict | null {
    if (local.id !== server.id) return null;
    
    // Validate checksums
    if (!this.validateChecksum(local) || !this.validateChecksum(server)) {
      throw new Error('Invalid checksum detected');
    }
    
    // No conflict if content is identical
    if (local.checksum === server.checksum) {
      return null;
    }
    
    // Analyze changes if base version is available
    if (baseVersion) {
      const localChanged = local.checksum !== baseVersion.checksum;
      const serverChanged = server.checksum !== baseVersion.checksum;
      
      if (localChanged && serverChanged) {
        return {
          type: 'CONTENT_CONFLICT',
          local,
          server,
          base: baseVersion,
          changes: this.analyzeChanges(baseVersion, local, server),
        };
      }
    }
    
    // Simple conflict without base version
    return {
      type: 'CONTENT_CONFLICT',
      local,
      server,
      base: baseVersion,
      changes: null,
    };
  }
  
  private analyzeChanges(
    base: ContentItem, 
    local: ContentItem, 
    server: ContentItem
  ): ChangeAnalysis {
    return {
      titleChanged: {
        local: base.title !== local.title,
        server: base.title !== server.title,
      },
      contentChanged: {
        local: base.content !== local.content,
        server: base.content !== server.content,
      },
      localChanges: this.getFieldChanges(base, local),
      serverChanges: this.getFieldChanges(base, server),
    };
  }
  
  private getFieldChanges(base: ContentItem, modified: ContentItem): FieldChanges {
    return {
      title: base.title !== modified.title ? {
        from: base.title,
        to: modified.title,
      } : null,
      content: base.content !== modified.content ? {
        from: base.content,
        to: modified.content,
      } : null,
    };
  }
}

interface ContentConflict {
  type: 'CONTENT_CONFLICT';
  local: ContentItem;
  server: ContentItem;
  base?: ContentItem;
  changes: ChangeAnalysis | null;
}

interface ChangeAnalysis {
  titleChanged: {
    local: boolean;
    server: boolean;
  };
  contentChanged: {
    local: boolean;
    server: boolean;
  };
  localChanges: FieldChanges;
  serverChanges: FieldChanges;
}

interface FieldChanges {
  title: {
    from: string;
    to: string;
  } | null;
  content: {
    from: string;
    to: string;
  } | null;
}
```

## Resolution Strategies

### Last Writer Wins (LWW)

The simplest strategy where the most recently modified version wins.

```dart
// Flutter Last Writer Wins implementation
class LastWriterWinsResolver {
  static const String strategyName = 'last_writer_wins';
  
  Future<ResolvedItem> resolve(ConflictContext context) async {
    final local = context.localItem;
    final server = context.serverItem;
    
    // Compare timestamps
    if (local.lastModified > server.lastModified) {
      return ResolvedItem(
        item: local,
        resolution: ResolutionResult.localWins,
        strategy: strategyName,
        metadata: {
          'reason': 'Local item is newer',
          'local_timestamp': local.lastModified,
          'server_timestamp': server.lastModified,
        },
      );
    } else {
      return ResolvedItem(
        item: server,
        resolution: ResolutionResult.serverWins,
        strategy: strategyName,
        metadata: {
          'reason': 'Server item is newer',
          'local_timestamp': local.lastModified,
          'server_timestamp': server.lastModified,
        },
      );
    }
  }
}

class ConflictContext {
  final Item localItem;
  final Item serverItem;
  final Item? baseItem;
  final ConflictType conflictType;
  final Map<String, dynamic> additionalContext;
  
  ConflictContext({
    required this.localItem,
    required this.serverItem,
    this.baseItem,
    required this.conflictType,
    this.additionalContext = const {},
  });
}

class ResolvedItem {
  final Item item;
  final ResolutionResult resolution;
  final String strategy;
  final Map<String, dynamic> metadata;
  
  ResolvedItem({
    required this.item,
    required this.resolution,
    required this.strategy,
    required this.metadata,
  });
}

enum ResolutionResult {
  localWins,
  serverWins,
  merged,
  userDecision,
}
```

### Client Wins

Always prefer the client version, useful for user-centric applications.

```swift
// iOS Client Wins resolver
class ClientWinsResolver: ConflictResolver {
    let strategyName = "client_wins"
    
    func resolve(context: ConflictContext) async -> ResolvedItem {
        let local = context.localItem
        let server = context.serverItem
        
        // Always choose local version but update version number
        let resolvedItem = local.copy(
            version: max(local.version, server.version) + 1,
            lastModified: Date(),
            resolvedAt: Date()
        )
        
        return ResolvedItem(
            item: resolvedItem,
            resolution: .localWins,
            strategy: strategyName,
            metadata: [
                "reason": "Client version always preferred",
                "original_local_version": local.version,
                "original_server_version": server.version,
                "new_version": resolvedItem.version
            ]
        )
    }
}
```

### Server Wins

Always prefer the server version, useful for authoritative data sources.

```kotlin
// Android Server Wins resolver
class ServerWinsResolver : ConflictResolver {
    override val strategyName = "server_wins"
    
    override suspend fun resolve(context: ConflictContext): ResolvedItem {
        val server = context.serverItem
        val local = context.localItem
        
        // Use server version but preserve local metadata if needed
        val resolvedItem = server.copy(
            localId = local.localId, // Preserve local ID
            lastSynced = System.currentTimeMillis(),
            syncStatus = SyncStatus.RESOLVED
        )
        
        return ResolvedItem(
            item = resolvedItem,
            resolution = ResolutionResult.SERVER_WINS,
            strategy = strategyName,
            metadata = mapOf(
                "reason" to "Server version is authoritative",
                "discarded_local_changes" to local.getChangedFields(),
                "server_version" to server.version
            )
        )
    }
}
```

### Merge Strategy

Intelligently merge changes from both versions.

```javascript
// React Native merge strategy
class MergeResolver {
  strategyName = 'merge';

  async resolve(context) {
    const { localItem, serverItem, baseItem } = context;
    
    if (!baseItem) {
      // Without base version, use field-level merge
      return this.performFieldLevelMerge(localItem, serverItem);
    }
    
    // Three-way merge with base version
    return this.performThreeWayMerge(baseItem, localItem, serverItem);
  }

  async performFieldLevelMerge(local, server) {
    const merged = {
      id: local.id,
      version: Math.max(local.version || 0, server.version || 0) + 1,
      lastModified: Date.now(),
    };

    // Merge strategy for different field types
    const mergeStrategies = {
      title: this.mergeTextField,
      content: this.mergeTextField,
      tags: this.mergeArrayField,
      metadata: this.mergeObjectField,
      priority: this.mergeNumericField,
    };

    const conflicts = [];
    
    for (const [field, strategy] of Object.entries(mergeStrategies)) {
      try {
        const result = strategy(local[field], server[field], field);
        merged[field] = result.value;
        
        if (result.hasConflict) {
          conflicts.push({
            field,
            localValue: local[field],
            serverValue: server[field],
            resolvedValue: result.value,
            resolution: result.resolution,
          });
        }
      } catch (error) {
        // Field-level merge failed, escalate to user
        throw new MergeConflictError(field, local[field], server[field]);
      }
    }

    return {
      item: merged,
      resolution: 'merged',
      strategy: this.strategyName,
      metadata: {
        conflicts,
        mergeType: 'field_level',
      },
    };
  }

  async performThreeWayMerge(base, local, server) {
    const merged = {
      id: local.id,
      version: Math.max(local.version || 0, server.version || 0) + 1,
      lastModified: Date.now(),
    };

    const conflicts = [];
    
    for (const field of Object.keys(base)) {
      const baseValue = base[field];
      const localValue = local[field];
      const serverValue = server[field];
      
      const mergeResult = this.mergeThreeWayField(
        baseValue, 
        localValue, 
        serverValue, 
        field
      );
      
      merged[field] = mergeResult.value;
      
      if (mergeResult.hasConflict) {
        conflicts.push({
          field,
          baseValue,
          localValue,
          serverValue,
          resolvedValue: mergeResult.value,
          resolution: mergeResult.resolution,
        });
      }
    }

    return {
      item: merged,
      resolution: 'merged',
      strategy: this.strategyName,
      metadata: {
        conflicts,
        mergeType: 'three_way',
      },
    };
  }

  mergeThreeWayField(base, local, server, fieldName) {
    const localChanged = !this.deepEqual(base, local);
    const serverChanged = !this.deepEqual(base, server);
    
    if (!localChanged && !serverChanged) {
      // No changes
      return { value: base, hasConflict: false };
    }
    
    if (localChanged && !serverChanged) {
      // Only local changed
      return { value: local, hasConflict: false, resolution: 'local_only' };
    }
    
    if (!localChanged && serverChanged) {
      // Only server changed
      return { value: server, hasConflict: false, resolution: 'server_only' };
    }
    
    // Both changed
    if (this.deepEqual(local, server)) {
      // Same changes on both sides
      return { value: local, hasConflict: false, resolution: 'identical_changes' };
    }
    
    // Actual conflict - try field-specific merge
    return this.resolveFieldConflict(base, local, server, fieldName);
  }

  resolveFieldConflict(base, local, server, fieldName) {
    switch (fieldName) {
      case 'title':
      case 'content':
        return this.mergeTextConflict(base, local, server);
      
      case 'tags':
        return this.mergeArrayConflict(base, local, server);
      
      case 'metadata':
        return this.mergeObjectConflict(base, local, server);
      
      default:
        // Default to last writer wins for unknown fields
        return {
          value: server, // Prefer server
          hasConflict: true,
          resolution: 'server_wins_default',
        };
    }
  }

  mergeTextConflict(base, local, server) {
    // Try to detect if one is an extension of the other
    if (local.includes(base) && server.includes(base)) {
      // Both extended the base, try to combine
      const localAddition = local.replace(base, '');
      const serverAddition = server.replace(base, '');
      
      return {
        value: base + localAddition + serverAddition,
        hasConflict: true,
        resolution: 'text_concatenated',
      };
    }
    
    // Complex text conflict - escalate to user
    throw new TextMergeConflictError(base, local, server);
  }

  mergeArrayConflict(base, local, server) {
    // Merge arrays by combining unique elements
    const localAdditions = local.filter(item => !base.includes(item));
    const serverAdditions = server.filter(item => !base.includes(item));
    const localRemovals = base.filter(item => !local.includes(item));
    const serverRemovals = base.filter(item => !server.includes(item));
    
    // Start with base, apply non-conflicting changes
    let merged = [...base];
    
    // Remove items that both sides removed
    const commonRemovals = localRemovals.filter(item => serverRemovals.includes(item));
    merged = merged.filter(item => !commonRemovals.includes(item));
    
    // Add items that either side added
    const allAdditions = [...localAdditions, ...serverAdditions];
    const uniqueAdditions = [...new Set(allAdditions)];
    merged.push(...uniqueAdditions);
    
    return {
      value: merged,
      hasConflict: localRemovals.length > 0 || serverRemovals.length > 0,
      resolution: 'array_merged',
    };
  }

  mergeObjectConflict(base, local, server) {
    const merged = { ...base };
    const conflicts = [];
    
    // Get all keys from all versions
    const allKeys = new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(server),
    ]);
    
    for (const key of allKeys) {
      const baseValue = base[key];
      const localValue = local[key];
      const serverValue = server[key];
      
      if (localValue === serverValue) {
        merged[key] = localValue;
      } else if (localValue === baseValue) {
        merged[key] = serverValue; // Server changed
      } else if (serverValue === baseValue) {
        merged[key] = localValue; // Local changed
      } else {
        // Both changed differently
        merged[key] = serverValue; // Default to server
        conflicts.push(key);
      }
    }
    
    return {
      value: merged,
      hasConflict: conflicts.length > 0,
      resolution: 'object_merged',
      conflictedKeys: conflicts,
    };
  }

  mergeTextField(local, server, fieldName) {
    if (local === server) {
      return { value: local, hasConflict: false };
    }
    
    // Simple text merge - prefer longer text if one contains the other
    if (local.includes(server)) {
      return { 
        value: local, 
        hasConflict: true, 
        resolution: 'local_contains_server' 
      };
    }
    
    if (server.includes(local)) {
      return { 
        value: server, 
        hasConflict: true, 
        resolution: 'server_contains_local' 
      };
    }
    
    // Can't merge automatically
    throw new FieldMergeConflictError(fieldName, local, server);
  }

  mergeArrayField(local, server, fieldName) {
    // Merge arrays by union
    const merged = [...new Set([...local, ...server])];
    
    return {
      value: merged,
      hasConflict: local.length !== server.length,
      resolution: 'array_union',
    };
  }

  mergeObjectField(local, server, fieldName) {
    // Merge objects by combining properties
    const merged = { ...local, ...server };
    
    const localKeys = Object.keys(local);
    const serverKeys = Object.keys(server);
    const conflictedKeys = [];
    
    for (const key of localKeys) {
      if (serverKeys.includes(key) && local[key] !== server[key]) {
        conflictedKeys.push(key);
      }
    }
    
    return {
      value: merged,
      hasConflict: conflictedKeys.length > 0,
      resolution: 'object_overlay',
      conflictedKeys,
    };
  }

  mergeNumericField(local, server, fieldName) {
    // For numeric fields, could use various strategies
    if (local === server) {
      return { value: local, hasConflict: false };
    }
    
    // Default to maximum value
    return {
      value: Math.max(local, server),
      hasConflict: true,
      resolution: 'numeric_max',
    };
  }

  deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

class MergeConflictError extends Error {
  constructor(field, localValue, serverValue) {
    super(`Cannot automatically merge field: ${field}`);
    this.field = field;
    this.localValue = localValue;
    this.serverValue = serverValue;
  }
}

class TextMergeConflictError extends MergeConflictError {
  constructor(base, local, server) {
    super('text', local, server);
    this.base = base;
  }
}

class FieldMergeConflictError extends MergeConflictError {
  constructor(field, local, server) {
    super(field, local, server);
  }
}
```

### User-Mediated Resolution

When automatic resolution isn't possible, present conflicts to the user.

```swift
// iOS user-mediated conflict resolution
class UserMediatedResolver {
    private let presentationQueue = DispatchQueue.main
    
    func resolve(context: ConflictContext) async -> ResolvedItem {
        return await withCheckedContinuation { continuation in
            presentationQueue.async {
                self.presentConflictResolutionUI(
                    context: context,
                    completion: { resolvedItem in
                        continuation.resume(returning: resolvedItem)
                    }
                )
            }
        }
    }
    
    private func presentConflictResolutionUI(
        context: ConflictContext,
        completion: @escaping (ResolvedItem) -> Void
    ) {
        let alertController = UIAlertController(
            title: "Data Conflict Detected",
            message: "The same item was modified both locally and on the server. How would you like to resolve this?",
            preferredStyle: .actionSheet
        )
        
        // Option 1: Keep local version
        alertController.addAction(UIAlertAction(
            title: "Keep My Changes",
            style: .default
        ) { _ in
            let resolved = ResolvedItem(
                item: context.localItem.copy(
                    version: max(context.localItem.version, context.serverItem.version) + 1,
                    lastModified: Date()
                ),
                resolution: .localWins,
                strategy: "user_mediated",
                metadata: ["user_choice": "keep_local"]
            )
            completion(resolved)
        })
        
        // Option 2: Keep server version
        alertController.addAction(UIAlertAction(
            title: "Keep Server Changes",
            style: .default
        ) { _ in
            let resolved = ResolvedItem(
                item: context.serverItem,
                resolution: .serverWins,
                strategy: "user_mediated",
                metadata: ["user_choice": "keep_server"]
            )
            completion(resolved)
        })
        
        // Option 3: Show detailed comparison
        alertController.addAction(UIAlertAction(
            title: "Compare & Merge",
            style: .default
        ) { _ in
            self.presentDetailedComparison(context: context, completion: completion)
        })
        
        // Option 4: Postpone decision
        alertController.addAction(UIAlertAction(
            title: "Decide Later",
            style: .cancel
        ) { _ in
            let resolved = ResolvedItem(
                item: context.localItem.copy(syncStatus: .conflicted),
                resolution: .userDecision,
                strategy: "user_mediated",
                metadata: ["user_choice": "postpone"]
            )
            completion(resolved)
        })
        
        // Present the alert
        if let topViewController = UIApplication.shared.topViewController {
            topViewController.present(alertController, animated: true)
        }
    }
    
    private func presentDetailedComparison(
        context: ConflictContext,
        completion: @escaping (ResolvedItem) -> Void
    ) {
        let comparisonVC = ConflictComparisonViewController(
            localItem: context.localItem,
            serverItem: context.serverItem,
            onResolution: completion
        )
        
        let navigationController = UINavigationController(rootViewController: comparisonVC)
        
        if let topViewController = UIApplication.shared.topViewController {
            topViewController.present(navigationController, animated: true)
        }
    }
}

class ConflictComparisonViewController: UIViewController {
    private let localItem: Item
    private let serverItem: Item
    private let onResolution: (ResolvedItem) -> Void
    
    private var resolvedItem: Item
    
    init(localItem: Item, serverItem: Item, onResolution: @escaping (ResolvedItem) -> Void) {
        self.localItem = localItem
        self.serverItem = serverItem
        self.onResolution = onResolution
        self.resolvedItem = localItem // Default to local
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        title = "Resolve Conflict"
        view.backgroundColor = .systemBackground
        
        // Navigation buttons
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
        
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(doneTapped)
        )
        
        setupComparisonView()
    }
    
    private func setupComparisonView() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        let contentView = UIStackView()
        contentView.axis = .vertical
        contentView.spacing = 20
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        // Title comparison
        contentView.addArrangedSubview(createFieldComparison(
            fieldName: "Title",
            localValue: localItem.title,
            serverValue: serverItem.title,
            currentValue: resolvedItem.title,
            onLocalSelected: { [weak self] in
                self?.resolvedItem.title = self?.localItem.title ?? ""
                self?.updateFieldComparison()
            },
            onServerSelected: { [weak self] in
                self?.resolvedItem.title = self?.serverItem.title ?? ""
                self?.updateFieldComparison()
            }
        ))
        
        // Content comparison
        contentView.addArrangedSubview(createFieldComparison(
            fieldName: "Content",
            localValue: localItem.content,
            serverValue: serverItem.content,
            currentValue: resolvedItem.content,
            onLocalSelected: { [weak self] in
                self?.resolvedItem.content = self?.localItem.content ?? ""
                self?.updateFieldComparison()
            },
            onServerSelected: { [weak self] in
                self?.resolvedItem.content = self?.serverItem.content ?? ""
                self?.updateFieldComparison()
            }
        ))
        
        // Constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor, constant: 20),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: 20),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor, constant: -20),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor, constant: -20),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor, constant: -40)
        ])
    }
    
    @objc private func cancelTapped() {
        let resolved = ResolvedItem(
            item: localItem.copy(syncStatus: .conflicted),
            resolution: .userDecision,
            strategy: "user_mediated",
            metadata: ["user_choice": "cancelled"]
        )
        
        dismiss(animated: true) {
            self.onResolution(resolved)
        }
    }
    
    @objc private func doneTapped() {
        let resolved = ResolvedItem(
            item: resolvedItem.copy(
                version: max(localItem.version, serverItem.version) + 1,
                lastModified: Date()
            ),
            resolution: .merged,
            strategy: "user_mediated",
            metadata: [
                "user_choice": "manual_merge",
                "fields_from_local": getFieldsFromSource(resolvedItem, localItem),
                "fields_from_server": getFieldsFromSource(resolvedItem, serverItem)
            ]
        )
        
        dismiss(animated: true) {
            self.onResolution(resolved)
        }
    }
    
    private func getFieldsFromSource(_ resolved: Item, _ source: Item) -> [String] {
        var fields: [String] = []
        
        if resolved.title == source.title {
            fields.append("title")
        }
        
        if resolved.content == source.content {
            fields.append("content")
        }
        
        return fields
    }
}
```

## Advanced Conflict Resolution

### Semantic Conflict Resolution

```python
# Python semantic conflict resolver
import difflib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class SemanticChange:
    field: str
    change_type: str  # 'addition', 'deletion', 'modification'
    location: int
    old_value: Any
    new_value: Any
    confidence: float

class SemanticConflictResolver:
    def __init__(self):
        self.field_resolvers = {
            'text': self.resolve_text_semantically,
            'list': self.resolve_list_semantically,
            'object': self.resolve_object_semantically,
        }
    
    def resolve(self, base: Dict, local: Dict, server: Dict) -> Dict[str, Any]:
        """Resolve conflicts using semantic analysis"""
        resolved = base.copy()
        conflicts = []
        
        for field in set(base.keys()) | set(local.keys()) | set(server.keys()):
            base_val = base.get(field)
            local_val = local.get(field)
            server_val = server.get(field)
            
            # Determine field type
            field_type = self._determine_field_type(base_val, local_val, server_val)
            
            if field_type in self.field_resolvers:
                try:
                    resolution = self.field_resolvers[field_type](
                        base_val, local_val, server_val
                    )
                    resolved[field] = resolution['value']
                    
                    if resolution['has_conflict']:
                        conflicts.append({
                            'field': field,
                            'resolution': resolution,
                        })
                        
                except Exception as e:
                    # Fallback to simple resolution
                    resolved[field] = self._simple_resolve(base_val, local_val, server_val)
                    conflicts.append({
                        'field': field,
                        'error': str(e),
                        'fallback_used': True,
                    })
            else:
                resolved[field] = self._simple_resolve(base_val, local_val, server_val)
        
        return {
            'resolved': resolved,
            'conflicts': conflicts,
        }
    
    def resolve_text_semantically(self, base: str, local: str, server: str) -> Dict[str, Any]:
        """Resolve text conflicts using diff analysis"""
        if not base:
            # No base version, simple merge
            if local == server:
                return {'value': local, 'has_conflict': False}
            else:
                return {'value': f"{local}\n{server}", 'has_conflict': True, 'method': 'concatenation'}
        
        # Analyze changes
        local_changes = self._analyze_text_changes(base, local)
        server_changes = self._analyze_text_changes(base, server)
        
        # Check for overlapping changes
        overlaps = self._find_change_overlaps(local_changes, server_changes)
        
        if not overlaps:
            # No overlapping changes, can merge automatically
            merged = self._merge_non_overlapping_changes(base, local_changes, server_changes)
            return {'value': merged, 'has_conflict': False, 'method': 'semantic_merge'}
        
        # Has overlapping changes, need conflict resolution
        merged = self._resolve_overlapping_changes(base, local_changes, server_changes, overlaps)
        return {
            'value': merged, 
            'has_conflict': True, 
            'method': 'semantic_merge_with_conflicts',
            'overlaps': overlaps
        }
    
    def _analyze_text_changes(self, base: str, modified: str) -> List[SemanticChange]:
        """Analyze text changes using difflib"""
        changes = []
        
        base_lines = base.splitlines()
        modified_lines = modified.splitlines()
        
        differ = difflib.SequenceMatcher(None, base_lines, modified_lines)
        
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag == 'equal':
                continue
            elif tag == 'delete':
                changes.append(SemanticChange(
                    field='text',
                    change_type='deletion',
                    location=i1,
                    old_value=base_lines[i1:i2],
                    new_value=[],
                    confidence=1.0
                ))
            elif tag == 'insert':
                changes.append(SemanticChange(
                    field='text',
                    change_type='addition',
                    location=i1,
                    old_value=[],
                    new_value=modified_lines[j1:j2],
                    confidence=1.0
                ))
            elif tag == 'replace':
                changes.append(SemanticChange(
                    field='text',
                    change_type='modification',
                    location=i1,
                    old_value=base_lines[i1:i2],
                    new_value=modified_lines[j1:j2],
                    confidence=1.0
                ))
        
        return changes
    
    def _find_change_overlaps(self, local_changes: List[SemanticChange], 
                            server_changes: List[SemanticChange]) -> List[Dict]:
        """Find overlapping changes between local and server"""
        overlaps = []
        
        for local_change in local_changes:
            for server_change in server_changes:
                overlap = self._calculate_overlap(local_change, server_change)
                if overlap['has_overlap']:
                    overlaps.append({
                        'local_change': local_change,
                        'server_change': server_change,
                        'overlap': overlap,
                    })
        
        return overlaps
    
    def _calculate_overlap(self, change1: SemanticChange, change2: SemanticChange) -> Dict:
        """Calculate overlap between two changes"""
        # Simplified overlap detection based on location
        start1 = change1.location
        end1 = start1 + len(change1.old_value)
        
        start2 = change2.location
        end2 = start2 + len(change2.old_value)
        
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)
        
        has_overlap = overlap_start < overlap_end
        
        return {
            'has_overlap': has_overlap,
            'overlap_start': overlap_start if has_overlap else None,
            'overlap_end': overlap_end if has_overlap else None,
            'overlap_size': max(0, overlap_end - overlap_start),
        }
    
    def _merge_non_overlapping_changes(self, base: str, 
                                     local_changes: List[SemanticChange],
                                     server_changes: List[SemanticChange]) -> str:
        """Merge non-overlapping changes"""
        base_lines = base.splitlines()
        result_lines = base_lines.copy()
        
        # Sort changes by location (reverse order to maintain indices)
        all_changes = [(change, 'local') for change in local_changes] + \
                     [(change, 'server') for change in server_changes]
        all_changes.sort(key=lambda x: x[0].location, reverse=True)
        
        for change, source in all_changes:
            if change.change_type == 'deletion':
                del result_lines[change.location:change.location + len(change.old_value)]
            elif change.change_type == 'addition':
                result_lines[change.location:change.location] = change.new_value
            elif change.change_type == 'modification':
                result_lines[change.location:change.location + len(change.old_value)] = change.new_value
        
        return '\n'.join(result_lines)
    
    def resolve_list_semantically(self, base: List, local: List, server: List) -> Dict[str, Any]:
        """Resolve list conflicts using set operations"""
        if not base:
            # No base, merge unique items
            combined = list(set(local + server))
            return {'value': combined, 'has_conflict': len(combined) != len(set(local) | set(server))}
        
        base_set = set(base)
        local_set = set(local)
        server_set = set(server)
        
        # Analyze changes
        local_added = local_set - base_set
        local_removed = base_set - local_set
        server_added = server_set - base_set
        server_removed = base_set - server_set
        
        # Find conflicts
        add_conflicts = local_added & server_removed  # Local added what server removed
        remove_conflicts = local_removed & server_added  # Local removed what server added
        
        # Merge without conflicts
        result_set = base_set.copy()
        result_set.update(local_added - remove_conflicts)
        result_set.update(server_added - remove_conflicts)
        result_set.difference_update(local_removed - add_conflicts)
        result_set.difference_update(server_removed - add_conflicts)
        
        has_conflict = bool(add_conflicts or remove_conflicts)
        
        return {
            'value': list(result_set),
            'has_conflict': has_conflict,
            'conflicts': {
                'add_conflicts': list(add_conflicts),
                'remove_conflicts': list(remove_conflicts),
            } if has_conflict else None
        }
    
    def _determine_field_type(self, *values) -> str:
        """Determine the type of field based on values"""
        for val in values:
            if val is not None:
                if isinstance(val, str):
                    return 'text'
                elif isinstance(val, list):
                    return 'list'
                elif isinstance(val, dict):
                    return 'object'
        return 'unknown'
    
    def _simple_resolve(self, base, local, server):
        """Simple resolution fallback"""
        if local == server:
            return local
        elif local == base:
            return server
        elif server == base:
            return local
        else:
            # Default to server wins
            return server
```

### Conflict Resolution Policies

```kotlin
// Android conflict resolution policy framework
interface ConflictResolutionPolicy {
    fun canHandle(conflict: ConflictInfo): Boolean
    suspend fun resolve(conflict: ConflictInfo): ResolutionResult
    val priority: Int
}

class PolicyBasedConflictResolver(
    private val policies: List<ConflictResolutionPolicy>
) {
    
    suspend fun resolve(conflict: ConflictInfo): ResolutionResult {
        val applicablePolicies = policies
            .filter { it.canHandle(conflict) }
            .sortedByDescending { it.priority }
        
        for (policy in applicablePolicies) {
            try {
                val result = policy.resolve(conflict)
                if (result.isSuccessful) {
                    return result
                }
            } catch (e: Exception) {
                // Policy failed, try next one
                continue
            }
        }
        
        // No policy could resolve, escalate to user
        return ResolutionResult.requiresUserIntervention(conflict)
    }
}

// Specific policies
class TimestampPolicy : ConflictResolutionPolicy {
    override val priority = 100
    
    override fun canHandle(conflict: ConflictInfo): Boolean {
        return conflict.hasTimestamps()
    }
    
    override suspend fun resolve(conflict: ConflictInfo): ResolutionResult {
        val local = conflict.localItem
        val server = conflict.serverItem
        
        return if (local.lastModified > server.lastModified) {
            ResolutionResult.success(local, "timestamp_local_newer")
        } else {
            ResolutionResult.success(server, "timestamp_server_newer")
        }
    }
}

class ContentSizePolicy : ConflictResolutionPolicy {
    override val priority = 50
    
    override fun canHandle(conflict: ConflictInfo): Boolean {
        return conflict.isTextContent()
    }
    
    override suspend fun resolve(conflict: ConflictInfo): ResolutionResult {
        val local = conflict.localItem
        val server = conflict.serverItem
        
        val localSize = local.content?.length ?: 0
        val serverSize = server.content?.length ?: 0
        
        // Prefer the version with more content
        return if (localSize > serverSize) {
            ResolutionResult.success(local, "content_size_local_larger")
        } else {
            ResolutionResult.success(server, "content_size_server_larger")
        }
    }
}

class UserPreferencePolicy : ConflictResolutionPolicy {
    override val priority = 200
    
    private val preferences: UserConflictPreferences
    
    constructor(preferences: UserConflictPreferences) {
        this.preferences = preferences
    }
    
    override fun canHandle(conflict: ConflictInfo): Boolean {
        return preferences.hasPreferenceFor(conflict.type)
    }
    
    override suspend fun resolve(conflict: ConflictInfo): ResolutionResult {
        val preference = preferences.getPreference(conflict.type)
        
        return when (preference.strategy) {
            PreferenceStrategy.ALWAYS_LOCAL -> 
                ResolutionResult.success(conflict.localItem, "user_preference_local")
            PreferenceStrategy.ALWAYS_SERVER -> 
                ResolutionResult.success(conflict.serverItem, "user_preference_server")
            PreferenceStrategy.ASK_USER -> 
                ResolutionResult.requiresUserIntervention(conflict)
            PreferenceStrategy.SMART_MERGE -> 
                performSmartMerge(conflict)
        }
    }
    
    private suspend fun performSmartMerge(conflict: ConflictInfo): ResolutionResult {
        // Implement smart merge logic based on field types
        return ResolutionResult.requiresUserIntervention(conflict)
    }
}

class BusinessRulePolicy : ConflictResolutionPolicy {
    override val priority = 150
    
    override fun canHandle(conflict: ConflictInfo): Boolean {
        return conflict.hasBusinessRules()
    }
    
    override suspend fun resolve(conflict: ConflictInfo): ResolutionResult {
        // Apply business-specific rules
        when (conflict.entityType) {
            "order" -> return resolveOrderConflict(conflict)
            "user_profile" -> return resolveUserProfileConflict(conflict)
            "document" -> return resolveDocumentConflict(conflict)
        }
        
        return ResolutionResult.cannotResolve("no_business_rule")
    }
    
    private fun resolveOrderConflict(conflict: ConflictInfo): ResolutionResult {
        // Orders: server version is authoritative for status changes
        val local = conflict.localItem
        val server = conflict.serverItem
        
        if (server.status in listOf("cancelled", "completed", "shipped")) {
            return ResolutionResult.success(server, "order_status_authoritative")
        }
        
        // For other fields, prefer local changes
        return ResolutionResult.success(local, "order_local_preferred")
    }
    
    private fun resolveUserProfileConflict(conflict: ConflictInfo): ResolutionResult {
        // User profiles: merge non-conflicting fields, user decides on conflicts
        val merged = mergeUserProfile(conflict.localItem, conflict.serverItem)
        return if (merged.hasConflicts) {
            ResolutionResult.requiresUserIntervention(conflict)
        } else {
            ResolutionResult.success(merged.item, "user_profile_merged")
        }
    }
    
    private fun resolveDocumentConflict(conflict: ConflictInfo): ResolutionResult {
        // Documents: preserve collaborative edits
        return ResolutionResult.requiresUserIntervention(conflict)
    }
}

data class UserConflictPreferences(
    private val preferences: Map<String, ConflictPreference>
) {
    fun hasPreferenceFor(conflictType: String): Boolean {
        return preferences.containsKey(conflictType)
    }
    
    fun getPreference(conflictType: String): ConflictPreference {
        return preferences[conflictType] ?: ConflictPreference.default()
    }
}

data class ConflictPreference(
    val strategy: PreferenceStrategy,
    val applyToSubtypes: Boolean = false,
    val conditions: List<String> = emptyList()
) {
    companion object {
        fun default() = ConflictPreference(PreferenceStrategy.ASK_USER)
    }
}

enum class PreferenceStrategy {
    ALWAYS_LOCAL,
    ALWAYS_SERVER,
    ASK_USER,
    SMART_MERGE
}
```

## Monitoring and Analytics

### Conflict Metrics Collection

```typescript
// TypeScript conflict analytics
interface ConflictMetrics {
  conflictId: string;
  entityType: string;
  entityId: string;
  detectionTime: number;
  resolutionTime?: number;
  resolutionStrategy: string;
  resolutionMethod: 'automatic' | 'user_mediated' | 'policy_based';
  conflictType: string;
  fieldsInConflict: string[];
  resolutionDuration?: number;
  userInterventionRequired: boolean;
  automaticResolutionSuccess: boolean;
}

class ConflictAnalytics {
  private metrics: ConflictMetrics[] = [];
  private analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  trackConflictDetected(conflict: ConflictInfo): string {
    const conflictId = generateUniqueId();
    
    const metrics: ConflictMetrics = {
      conflictId,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      detectionTime: Date.now(),
      resolutionStrategy: 'unknown',
      resolutionMethod: 'automatic', // Default assumption
      conflictType: conflict.type,
      fieldsInConflict: conflict.fieldsInConflict,
      userInterventionRequired: false,
      automaticResolutionSuccess: false,
    };

    this.metrics.push(metrics);
    
    this.analyticsService.track('conflict_detected', {
      entityType: conflict.entityType,
      conflictType: conflict.type,
      fieldsCount: conflict.fieldsInConflict.length,
      detectionTime: metrics.detectionTime,
    });

    return conflictId;
  }

  trackConflictResolved(
    conflictId: string, 
    resolution: ResolutionResult
  ): void {
    const metrics = this.metrics.find(m => m.conflictId === conflictId);
    if (!metrics) return;

    metrics.resolutionTime = Date.now();
    metrics.resolutionDuration = metrics.resolutionTime - metrics.detectionTime;
    metrics.resolutionStrategy = resolution.strategy;
    metrics.resolutionMethod = resolution.method;
    metrics.userInterventionRequired = resolution.requiresUserIntervention;
    metrics.automaticResolutionSuccess = resolution.isSuccessful && !resolution.requiresUserIntervention;

    this.analyticsService.track('conflict_resolved', {
      conflictId,
      resolutionStrategy: resolution.strategy,
      resolutionMethod: resolution.method,
      resolutionDuration: metrics.resolutionDuration,
      automaticResolution: metrics.automaticResolutionSuccess,
      userIntervention: metrics.userInterventionRequired,
    });

    // Report aggregate metrics periodically
    this.reportAggregateMetrics();
  }

  trackConflictEscalated(conflictId: string, reason: string): void {
    const metrics = this.metrics.find(m => m.conflictId === conflictId);
    if (!metrics) return;

    metrics.userInterventionRequired = true;
    metrics.resolutionMethod = 'user_mediated';

    this.analyticsService.track('conflict_escalated', {
      conflictId,
      reason,
      entityType: metrics.entityType,
      conflictType: metrics.conflictType,
    });
  }

  private reportAggregateMetrics(): void {
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.detectionTime > last24Hours);

    if (recentMetrics.length === 0) return;

    const totalConflicts = recentMetrics.length;
    const resolvedConflicts = recentMetrics.filter(m => m.resolutionTime).length;
    const automaticResolutions = recentMetrics.filter(m => m.automaticResolutionSuccess).length;
    const userInterventions = recentMetrics.filter(m => m.userInterventionRequired).length;

    const avgResolutionTime = recentMetrics
      .filter(m => m.resolutionDuration)
      .reduce((sum, m) => sum + m.resolutionDuration!, 0) / resolvedConflicts;

    // Group by entity type
    const byEntityType = recentMetrics.reduce((acc, m) => {
      acc[m.entityType] = (acc[m.entityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by conflict type
    const byConflictType = recentMetrics.reduce((acc, m) => {
      acc[m.conflictType] = (acc[m.conflictType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.analyticsService.track('conflict_metrics_24h', {
      totalConflicts,
      resolvedConflicts,
      resolutionRate: resolvedConflicts / totalConflicts,
      automaticResolutions,
      automaticResolutionRate: automaticResolutions / totalConflicts,
      userInterventions,
      userInterventionRate: userInterventions / totalConflicts,
      avgResolutionTimeMs: avgResolutionTime,
      conflictsByEntityType: byEntityType,
      conflictsByType: byConflictType,
    });
  }

  getConflictReport(timeRange: TimeRange): ConflictReport {
    const filteredMetrics = this.metrics.filter(m => 
      m.detectionTime >= timeRange.start && m.detectionTime <= timeRange.end
    );

    return {
      timeRange,
      totalConflicts: filteredMetrics.length,
      resolvedConflicts: filteredMetrics.filter(m => m.resolutionTime).length,
      pendingConflicts: filteredMetrics.filter(m => !m.resolutionTime).length,
      automaticResolutions: filteredMetrics.filter(m => m.automaticResolutionSuccess).length,
      userMediatedResolutions: filteredMetrics.filter(m => m.resolutionMethod === 'user_mediated').length,
      averageResolutionTime: this.calculateAverageResolutionTime(filteredMetrics),
      conflictDistribution: this.getConflictDistribution(filteredMetrics),
      resolutionStrategies: this.getResolutionStrategies(filteredMetrics),
    };
  }

  private calculateAverageResolutionTime(metrics: ConflictMetrics[]): number {
    const resolved = metrics.filter(m => m.resolutionDuration);
    if (resolved.length === 0) return 0;
    
    return resolved.reduce((sum, m) => sum + m.resolutionDuration!, 0) / resolved.length;
  }

  private getConflictDistribution(metrics: ConflictMetrics[]): Record<string, number> {
    return metrics.reduce((acc, m) => {
      const key = `${m.entityType}:${m.conflictType}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getResolutionStrategies(metrics: ConflictMetrics[]): Record<string, number> {
    return metrics
      .filter(m => m.resolutionStrategy !== 'unknown')
      .reduce((acc, m) => {
        acc[m.resolutionStrategy] = (acc[m.resolutionStrategy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  }
}

interface TimeRange {
  start: number;
  end: number;
}

interface ConflictReport {
  timeRange: TimeRange;
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  automaticResolutions: number;
  userMediatedResolutions: number;
  averageResolutionTime: number;
  conflictDistribution: Record<string, number>;
  resolutionStrategies: Record<string, number>;
}

function generateUniqueId(): string {
  return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

This comprehensive conflict resolution guide covers detection mechanisms, various resolution strategies, advanced techniques like semantic resolution, policy-based systems, and monitoring capabilities essential for robust mobile data synchronization systems.
