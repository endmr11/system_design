---
title: Local Database Seçenekleri
---

# Local Database Seçenekleri

Mobil uygulamalarda lokal veri saklama, performans, offline çalışabilirlik ve kullanıcı deneyimi açısından kritik öneme sahiptir. Bu bölümde SQL tabanlı çözümlerden NoSQL alternatiflerine, key-value store'lardan objektif veritabanlarına kadar tüm lokal persistence seçenekleri detaylı olarak incelenmektedir.

## SQL Tabanlı Çözümler

### SQLite/Room (Android)

Room, Android'de SQLite üzerinde bir ORM katmanı sunan, compile-time verification ve type safety sağlayan modern bir database abstraction'dır.

#### Temel Bileşenler

**@Entity Annotations**
- Primary key tanımları ve auto-increment özelliği
- Foreign key ilişkileri ve referential integrity
- Index tanımları ve composite index'ler
- Özel tablo isimleri ve sütun konfigürasyonları

**@Dao (Data Access Object)**
- SQL sorguları ve parametrik query'ler
- @Insert, @Update, @Delete annotations
- @Query ile custom SQL sorguları
- LiveData/Flow ile reactive programming

**@Database Configuration**
- Room database versioning
- Entity listesi ve type converter'lar
- Migration stratejileri
- In-memory ve file-based database seçenekleri

#### Gelişmiş Özellikler

**Migration Strategies**
```kotlin
// Room migration örneği
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE User ADD COLUMN age INTEGER DEFAULT 0 NOT NULL")
    }
}
```

**Reactive Queries**
- LiveData ile UI reactive güncellemeleri
- Kotlin Flow ile asenkron data stream'leri
- RxJava integration
- Coroutines support

**Performance Optimizations**
- WAL (Write-Ahead Logging) mode
- Prepared statements ve statement caching
- Batch operations ve bulk insert/update
- Connection pooling
- Index optimization

### SQLite Cross-Platform Implementations

#### Flutter - sqflite & drift
**sqflite**: Flutter'ın native SQLite plugin'i
- Platform channel üzerinden native SQLite erişimi
- Transaction support ve batch operations
- Database versioning ve migration
- Custom SQL ve raw query desteği

**drift (eski adı moor)**: Type-safe SQL generation
- Dart ile SQL schema tanımları
- Compile-time SQL validation
- Code generation ile boilerplate elimination
- Stream-based reactive queries

#### React Native Solutions
**react-native-sqlite-storage**
- iOS ve Android için unified API
- Promise-based ve callback-based operations
- WAL mode support
- Encryption capabilities

**WatermelonDB**
- Reactive database with Observable patterns
- Lazy loading ve performance optimization
- Multi-threaded architecture
- Sync protokolü ile backend integration

#### Xamarin - SQLite.NET
- C# ile native SQLite binding
- ORM capabilities ve LINQ queries
- Encryption support (SQLCipher)
- Cross-platform code sharing

## NoSQL Çözümler

### Core Data (iOS)

Apple'ın object graph management ve persistence framework'ü olan Core Data, iOS ve macOS uygulamaları için kapsamlı data modeling çözümü sunar.

#### Core Components

**NSManagedObject**
- Entity modeling ve attribute definitions
- Relationship management (to-one, to-many)
- Validation rules ve custom validation
- Key-Value Coding (KVC) compliance

**NSManagedObjectContext**
- Change tracking ve dirty checking
- Undo/redo functionality
- Save operations ve error handling
- Parent-child context hierarchy

**NSPersistentStore**
- SQLite, Binary, In-Memory, XML storage options
- Store coordination ve multiple store types
- Encryption ve data protection
- CloudKit integration

#### Advanced Features

**Performance Optimizations**
- Faulting mechanism ile lazy loading
- Batch processing operations
- NSFetchedResultsController ile efficient UI updates
- Predicate optimization

**CloudKit Integration**
- Automatic cloud sync
- Schema mirroring
- Conflict resolution strategies
- Privacy ve data sharing controls

### Realm Database

Modern object database olan Realm, live objects, automatic relationships ve real-time synchronization özellikleriyle öne çıkar.

#### Platform Support
- **Native iOS/Android**: Swift, Objective-C, Java, Kotlin
- **Flutter**: realm_dart package
- **React Native**: @realm/react
- **Xamarin**: Realm.NET

#### Core Features

**Live Objects**
```swift
// Realm live object örneği
let results = realm.objects(Person.self)
// Otomatik UI güncellemeleri
notificationToken = results.observe { changes in
    switch changes {
    case .initial:
        // İlk yüklemede
    case .update(_, let deletions, let insertions, let modifications):
        // Data değişikliklerinde otomatik UI güncellemeleri
    case .error(let error):
        // Error handling
    }
}
```

**Advanced Capabilities**
- MVCC (Multi-Version Concurrency Control)
- Zero-copy architecture
- Encryption at rest
- Schema versioning ve migration
- Full-text search capabilities

#### Realm Sync (Cloud)
- Real-time data synchronization
- Offline-first with automatic conflict resolution
- User authentication ve authorization
- Partitioned realms for data isolation

## Key-Value Storage Solutions

### Platform-Specific Options

#### Android
**SharedPreferences**
- XML-based key-value storage
- Type-safe değer saklama
- Commit vs apply operations
- Mode options (private, readable, writable)

**Jetpack DataStore**
- SharedPreferences'ın modern alternatifi
- Coroutines ve Flow integration
- Protocol Buffers support
- Type safety ve consistency

**EncryptedSharedPreferences**
- AES-256 encryption
- Master key yönetimi
- Automatic key rotation

#### iOS
**UserDefaults**
- Property list tabanlı storage
- NSCoding compliance
- Synchronization ve iCloud sync
- Suite-based grouping

**Keychain Services**
- Secure credential storage
- Biometric authentication integration
- Access control ve sharing options
- Cross-app data sharing capabilities

#### Cross-Platform Key-Value Stores

**MMKV (Tencent)**
- High-performance key-value store
- Memory-mapped file I/O
- Multi-process safe
- Encryption support
- iOS, Android, Flutter, React Native support

**Hive (Flutter)**
- Pure Dart NoSQL database
- Box-based organization
- Type adapters ve code generation
- Encryption capabilities

## Performance Considerations

### Indexing Strategies
- Primary index optimization
- Composite index design
- Full-text search indexes
- Query plan analysis

### Memory Management
- Object lifecycle management
- Cache size tuning
- Memory pressure handling
- Background cleanup strategies

### Connection Management
- Connection pooling
- Thread safety
- Transaction management
- Deadlock prevention

---

> Modern mobil uygulamalarda doğru database seçimi, uygulama gereksinimlerine, platform kısıtlarına ve performans hedeflerine bağlıdır. SQL tabanlı çözümler complex queries ve ACID compliance gerektiren senaryolarda, NoSQL çözümler ise rapid development ve flexible schema ihtiyaçlarında tercih edilmelidir.


