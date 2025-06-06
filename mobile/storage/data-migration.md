---
title: Data Migration ve Versioning
---

# Data Migration ve Versioning

Mobil uygulamalarda veri yapısının evrim geçirmesi kaçınılmazdır. Yeni özellikler, performans iyileştirmeleri ve business requirement değişiklikleri database schema'sında değişiklik gerektirir. Bu bölümde, güvenli ve etkili data migration stratejileri ile schema versioning yaklaşımları detaylı olarak ele alınmaktadır.

## Schema Evolution Strategies

### Backward Compatible Changes
Mevcut verileri bozmayan değişiklikler.

```sql
-- Güvenli schema değişiklikleri
-- Yeni sütun ekleme (default değer ile)
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '';

-- Yeni index ekleme
CREATE INDEX idx_users_email ON users(email);

-- Yeni tablo ekleme
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Breaking Changes
Dikkatli migration gerektiren değişiklikler.

```kotlin
// Android Room Migration example
@Database(
    entities = [User::class, Document::class],
    version = 3,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    
    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Add new column with default value
                database.execSQL("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
                
                // Create new table
                database.execSQL("""
                    CREATE TABLE user_settings (
                        id INTEGER PRIMARY KEY NOT NULL,
                        user_id INTEGER NOT NULL,
                        theme TEXT DEFAULT 'system',
                        notifications_enabled INTEGER DEFAULT 1,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """)
            }
        }
        
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Rename column (complex migration)
                database.execSQL("CREATE TABLE users_new (id INTEGER PRIMARY KEY, username TEXT, email_address TEXT)")
                database.execSQL("INSERT INTO users_new SELECT id, username, email FROM users")
                database.execSQL("DROP TABLE users")
                database.execSQL("ALTER TABLE users_new RENAME TO users")
                
                // Update indexes
                database.execSQL("CREATE UNIQUE INDEX idx_users_email ON users(email_address)")
            }
        }
        
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "app_database"
                )
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .fallbackToDestructiveMigration() // Only for development
                .build()
                
                INSTANCE = instance
                instance
            }
        }
    }
}
```

## Platform-Specific Migration

### iOS Core Data Migration
Core Data'da model versioning ve lightweight/heavyweight migration.

```swift
// Core Data Model Versioning
class CoreDataMigrationManager {
    private let modelName = "DataModel"
    
    func setupPersistentContainer() -> NSPersistentContainer {
        let container = NSPersistentContainer(name: modelName)
        
        // Configure migration options
        let storeDescription = NSPersistentStoreDescription()
        storeDescription.shouldMigrateStoreAutomatically = true
        storeDescription.shouldInferMappingModelAutomatically = true
        
        // Custom migration policy
        storeDescription.setOption(true as NSNumber, 
                                 forKey: NSPersistentHistoryTrackingKey)
        
        container.persistentStoreDescriptions = [storeDescription]
        
        container.loadPersistentStores { _, error in
            if let error = error {
                self.handleMigrationError(error)
            }
        }
        
        return container
    }
    
    // Custom heavyweight migration
    func performHeavyweightMigration() {
        let sourceModel = NSManagedObjectModel.mergedModel(from: [Bundle.main])!
        let targetModel = NSManagedObjectModel(contentsOf: targetModelURL)!
        
        let mappingModel = NSMappingModel(from: [Bundle.main],
                                         forSourceModel: sourceModel,
                                         destinationModel: targetModel)
        
        let migrationManager = NSMigrationManager(sourceModel: sourceModel,
                                                destinationModel: targetModel)
        
        do {
            try migrationManager.migrateStore(from: sourceStoreURL,
                                            sourceType: NSSQLiteStoreType,
                                            options: nil,
                                            with: mappingModel,
                                            toDestinationURL: destinationStoreURL,
                                            destinationType: NSSQLiteStoreType,
                                            destinationOptions: nil)
        } catch {
            print("Migration failed: \(error)")
        }
    }
}

// Custom migration policy
class UserMigrationPolicy: NSEntityMigrationPolicy {
    override func createDestinationInstances(forSource sInstance: NSManagedObject,
                                           in mapping: NSEntityMapping,
                                           manager: NSMigrationManager) throws {
        
        let destinationInstance = NSEntityDescription.insertNewObject(
            forEntityName: mapping.destinationEntityName!,
            into: manager.destinationContext
        )
        
        // Custom field transformation
        if let firstName = sInstance.value(forKey: "firstName") as? String,
           let lastName = sInstance.value(forKey: "lastName") as? String {
            destinationInstance.setValue("\(firstName) \(lastName)", forKey: "fullName")
        }
        
        // Copy other attributes
        for attribute in mapping.attributeMappings ?? [] {
            if let sourceKey = attribute.valueExpression?.keyPath {
                let value = sInstance.value(forKey: sourceKey)
                destinationInstance.setValue(value, forKey: attribute.name!)
            }
        }
        
        manager.associate(sourceInstance: sInstance, 
                         withDestinationInstance: destinationInstance, 
                         for: mapping)
    }
}
```

### Flutter/Dart Migration
Cross-platform migration strategies.

```dart
class FlutterMigrationManager {
  static const String _versionKey = 'db_version';
  static const int currentVersion = 5;
  
  final Database database;
  final SharedPreferences prefs;
  
  FlutterMigrationManager(this.database, this.prefs);
  
  Future<void> migrateIfNeeded() async {
    final currentDbVersion = prefs.getInt(_versionKey) ?? 1;
    
    if (currentDbVersion < currentVersion) {
      await _performMigration(currentDbVersion, currentVersion);
      await prefs.setInt(_versionKey, currentVersion);
    }
  }
  
  Future<void> _performMigration(int fromVersion, int toVersion) async {
    for (int version = fromVersion + 1; version <= toVersion; version++) {
      print('Migrating to version $version');
      
      switch (version) {
        case 2:
          await _migrateToV2();
          break;
        case 3:
          await _migrateToV3();
          break;
        case 4:
          await _migrateToV4();
          break;
        case 5:
          await _migrateToV5();
          break;
      }
    }
  }
  
  Future<void> _migrateToV2() async {
    await database.execute('''
      ALTER TABLE users ADD COLUMN created_at INTEGER DEFAULT 0
    ''');
    
    // Backfill created_at for existing users
    await database.execute('''
      UPDATE users SET created_at = ? WHERE created_at = 0
    ''', [DateTime.now().millisecondsSinceEpoch]);
  }
  
  Future<void> _migrateToV3() async {
    // Create new table
    await database.execute('''
      CREATE TABLE user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_info TEXT,
        created_at INTEGER NOT NULL,
        last_active INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    ''');
  }
  
  Future<void> _migrateToV4() async {
    // Complex migration: normalize user data
    await database.transaction((txn) async {
      // Create temporary table
      await txn.execute('''
        CREATE TABLE users_temp (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          profile_data TEXT,
          settings_data TEXT,
          created_at INTEGER NOT NULL
        )
      ''');
      
      // Migrate data with transformation
      final users = await txn.query('users');
      for (final user in users) {
        final profileData = {
          'firstName': user['first_name'],
          'lastName': user['last_name'],
          'avatarUrl': user['avatar_url'],
        };
        
        final settingsData = {
          'theme': user['theme'] ?? 'system',
          'notifications': user['notifications_enabled'] == 1,
        };
        
        await txn.insert('users_temp', {
          'id': user['id'],
          'email': user['email'],
          'profile_data': jsonEncode(profileData),
          'settings_data': jsonEncode(settingsData),
          'created_at': user['created_at'],
        });
      }
      
      // Replace old table
      await txn.execute('DROP TABLE users');
      await txn.execute('ALTER TABLE users_temp RENAME TO users');
    });
  }
  
  Future<void> _migrateToV5() async {
    // Add indexes for performance
    await database.execute('''
      CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id)
    ''');
    
    await database.execute('''
      CREATE INDEX idx_user_sessions_last_active ON user_sessions(last_active)
    ''');
  }
}
```

## Gradual Migration Strategies

### Shadow Tables
Risk-free migration için shadow table yaklaşımı.

```sql
-- Shadow table pattern
CREATE TABLE users_v2 (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    profile_json TEXT,
    settings_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    migrated_at TIMESTAMP
);

-- Gradual data migration
INSERT INTO users_v2 (id, email, profile_json, settings_json, created_at, migrated_at)
SELECT 
    id,
    email,
    json_object('firstName', first_name, 'lastName', last_name, 'avatar', avatar_url),
    json_object('theme', theme, 'notifications', notifications_enabled),
    created_at,
    CURRENT_TIMESTAMP
FROM users 
WHERE id NOT IN (SELECT id FROM users_v2);
```

### Dual-Write Pattern
Migration sırasında iki schema'ya da yazma.

```kotlin
class DualWriteMigrationManager {
    private val oldUserDao: OldUserDao
    private val newUserDao: NewUserDao
    private val migrationFlags: MigrationFlags
    
    suspend fun saveUser(user: User) {
        // Always write to old schema for backward compatibility
        oldUserDao.insert(user.toOldFormat())
        
        // Also write to new schema if migration is active
        if (migrationFlags.isDualWriteEnabled) {
            newUserDao.insert(user.toNewFormat())
        }
    }
    
    suspend fun getUser(id: String): User? {
        return if (migrationFlags.isReadFromNewSchema) {
            // Try new schema first
            newUserDao.getById(id)?.let { return User.fromNewFormat(it) }
            
            // Fallback to old schema
            oldUserDao.getById(id)?.let { 
                val user = User.fromOldFormat(it)
                
                // Lazy migration: write to new schema
                if (migrationFlags.isLazyMigrationEnabled) {
                    newUserDao.insert(user.toNewFormat())
                }
                
                return user
            }
        } else {
            // Read from old schema
            oldUserDao.getById(id)?.let { User.fromOldFormat(it) }
        }
    }
}
```

### Lazy Migration
Data access sırasında opportunistic migration.

```swift
class LazyMigrationManager {
    private let oldStore: OldDataStore
    private let newStore: NewDataStore
    private let migrationTracker: MigrationTracker
    
    func getEntity<T: Migratable>(id: String, type: T.Type) async -> T? {
        // Check if already migrated
        if migrationTracker.isMigrated(id: id, type: type) {
            return await newStore.get(id: id, type: type)
        }
        
        // Get from old store
        guard let oldEntity = await oldStore.get(id: id, type: type) else {
            return nil
        }
        
        // Perform lazy migration
        let migratedEntity = await migrate(oldEntity)
        
        // Save to new store
        await newStore.save(migratedEntity)
        
        // Mark as migrated
        migrationTracker.markMigrated(id: id, type: type)
        
        // Optionally cleanup old data
        if migrationTracker.shouldCleanupOldData(type: type) {
            await oldStore.delete(id: id, type: type)
        }
        
        return migratedEntity
    }
    
    private func migrate<T: Migratable>(_ entity: T) async -> T {
        return await entity.migrateToCurrentVersion()
    }
}

protocol Migratable {
    func migrateToCurrentVersion() async -> Self
}
```

## Data Transformation

### Complex Field Transformations
Veri tiplerinin ve yapılarının dönüştürülmesi.

```typescript
// React Native Complex Transformation
interface LegacyUser {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  preferences_json: string;
  avatar_url?: string;
}

interface ModernUser {
  id: string;
  profile: {
    fullName: string;
    avatar?: string;
    phoneNumber?: string;
  };
  preferences: UserPreferences;
  metadata: {
    createdAt: Date;
    lastModified: Date;
    version: number;
  };
}

class UserDataTransformer {
  static transformUser(legacy: LegacyUser): ModernUser {
    const preferences = this.parsePreferences(legacy.preferences_json);
    
    return {
      id: legacy.id,
      profile: {
        fullName: `${legacy.first_name} ${legacy.last_name}`.trim(),
        avatar: legacy.avatar_url,
        phoneNumber: this.normalizePhoneNumber(legacy.phone_number),
      },
      preferences: {
        theme: preferences.theme || 'system',
        notifications: preferences.notifications !== false,
        language: preferences.language || 'en',
        privacy: {
          shareAnalytics: preferences.share_analytics !== false,
          allowContacts: preferences.allow_contacts !== false,
        },
      },
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        version: 2,
      },
    };
  }
  
  private static parsePreferences(json: string): any {
    try {
      return JSON.parse(json || '{}');
    } catch {
      return {};
    }
  }
  
  private static normalizePhoneNumber(phone: string): string | undefined {
    if (!phone) return undefined;
    
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digits.length === 10) {
      return `+1${digits}`; // US number
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else if (digits.length > 7) {
      return `+${digits}`;
    }
    
    return undefined; // Invalid phone number
  }
}
```

### Batch Processing
Büyük veri setlerinin performanslı migration'ı.

```kotlin
class BatchMigrationProcessor {
    private val batchSize = 1000
    private val migrationDao: MigrationDao
    
    suspend fun migrateLargeDataset(tableName: String) = withContext(Dispatchers.IO) {
        var offset = 0
        var totalProcessed = 0
        
        do {
            val batch = migrationDao.getBatch(tableName, offset, batchSize)
            
            if (batch.isNotEmpty()) {
                processBatch(batch)
                offset += batchSize
                totalProcessed += batch.size
                
                // Progress reporting
                emitProgress(totalProcessed)
                
                // Throttle to avoid overwhelming the system
                delay(100)
            }
        } while (batch.size == batchSize)
        
        println("Migration completed. Processed $totalProcessed records.")
    }
    
    private suspend fun processBatch(batch: List<LegacyRecord>) {
        val transformedBatch = batch.map { record ->
            transformRecord(record)
        }
        
        // Bulk insert for performance
        migrationDao.insertBatch(transformedBatch)
        
        // Update migration progress
        migrationDao.markBatchMigrated(batch.map { it.id })
    }
    
    private fun transformRecord(legacy: LegacyRecord): ModernRecord {
        return ModernRecord(
            id = legacy.id,
            data = transformData(legacy.data),
            metadata = RecordMetadata(
                version = 2,
                migratedAt = System.currentTimeMillis()
            )
        )
    }
}
```

## Error Handling ve Rollback

### Migration Error Recovery
Migration hatalarında güvenli geri alma.

```swift
class SafeMigrationManager {
    private let backupManager: BackupManager
    private let migrationValidator: MigrationValidator
    
    func performSafeMigration(from: Int, to: Int) async throws {
        // Create backup before migration
        let backupId = try await backupManager.createBackup()
        
        do {
            // Perform migration in transaction
            try await performMigrationSteps(from: from, to: to)
            
            // Validate migration result
            let validationResult = try await migrationValidator.validate()
            
            if !validationResult.isValid {
                throw MigrationError.validationFailed(validationResult.errors)
            }
            
            // Migration successful - cleanup backup
            try await backupManager.cleanupBackup(backupId)
            
        } catch {
            // Migration failed - rollback
            print("Migration failed: \(error). Rolling back...")
            
            try await rollbackMigration(backupId: backupId)
            throw error
        }
    }
    
    private func rollbackMigration(backupId: String) async throws {
        try await backupManager.restoreFromBackup(backupId)
        
        // Reset migration state
        UserDefaults.standard.removeObject(forKey: "migration_version")
        
        print("Rollback completed successfully")
    }
}

class MigrationValidator {
    func validate() async -> ValidationResult {
        var errors: [ValidationError] = []
        
        // Validate data integrity
        if let integrityErrors = await validateDataIntegrity() {
            errors.append(contentsOf: integrityErrors)
        }
        
        // Validate foreign key constraints
        if let constraintErrors = await validateConstraints() {
            errors.append(contentsOf: constraintErrors)
        }
        
        // Validate data completeness
        if let completenessErrors = await validateCompleteness() {
            errors.append(contentsOf: completenessErrors)
        }
        
        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors
        )
    }
}
```

## Progressive Migration

### Feature Flag-based Migration
Feature flag'ler ile kontrollü migration.

```dart
class ProgressiveMigrationManager {
  final FeatureFlagService _featureFlags;
  final MigrationMetrics _metrics;
  
  Future<void> startProgressiveMigration() async {
    final migrationConfig = await _featureFlags.getMigrationConfig();
    
    if (!migrationConfig.isEnabled) {
      return; // Migration disabled
    }
    
    // Start with small percentage of users
    if (await _shouldParticipateInMigration(migrationConfig.rolloutPercentage)) {
      await _performUserMigration();
    }
  }
  
  Future<bool> _shouldParticipateInMigration(double percentage) async {
    final userId = await _getCurrentUserId();
    final hash = userId.hashCode.abs();
    final userPercentile = (hash % 100) / 100.0;
    
    return userPercentile < percentage;
  }
  
  Future<void> _performUserMigration() async {
    final startTime = DateTime.now();
    
    try {
      await _migrateUserData();
      
      // Report success metrics
      _metrics.recordMigrationSuccess(
        duration: DateTime.now().difference(startTime),
      );
      
      // Mark user as migrated
      await _markUserMigrated();
      
    } catch (error) {
      // Report failure metrics
      _metrics.recordMigrationFailure(
        error: error.toString(),
        duration: DateTime.now().difference(startTime),
      );
      
      // Don't retry automatically for this user
      await _markMigrationFailed();
      
      rethrow;
    }
  }
}
```

---

> Data migration ve versioning, mobil uygulama yaşam döngüsünün kritik bir parçasıdır. Güvenli migration stratejileri, veri kaybını önler ve kullanıcı deneyimini korur. Progressive migration ve feature flag'ler ile risk minimize edilebilir ve migration süreçleri gözlemlenebilir hale gelir.
