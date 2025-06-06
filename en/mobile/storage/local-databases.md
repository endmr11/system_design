---
title: Local Database Options
---

# Local Database Options

Local data storage in mobile applications is critical for performance, offline functionality, and user experience. This section examines all local persistence options in detail, from SQL-based solutions to NoSQL alternatives, from key-value stores to object databases.

## SQL-Based Solutions

### SQLite/Room (Android)

Room is a modern database abstraction that provides an ORM layer over SQLite on Android, offering compile-time verification and type safety.

#### Core Components

**@Entity Annotations**
- Primary key definitions and auto-increment features
- Foreign key relationships and referential integrity
- Index definitions and composite indexes
- Custom table names and column configurations

**@Dao (Data Access Object)**
- SQL queries and parametric queries
- @Insert, @Update, @Delete annotations
- Custom SQL queries with @Query
- Reactive programming with LiveData/Flow

**@Database Configuration**
- Room database versioning
- Entity lists and type converters
- Migration strategies
- In-memory and file-based database options

#### Advanced Features

**Migration Strategies**
```kotlin
// Room migration example
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE User ADD COLUMN age INTEGER DEFAULT 0 NOT NULL")
    }
}

@Database(
    entities = [User::class],
    version = 2,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "app_database"
                )
                .addMigrations(MIGRATION_1_2)
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
```

**Reactive Queries**
- UI reactive updates with LiveData
- Asynchronous data streams with Kotlin Flow
- RxJava integration
- Coroutines support

**Performance Optimizations**
- WAL (Write-Ahead Logging) mode
- Prepared statements and statement caching
- Batch operations and bulk insert/update
- Connection pooling
- Index optimization

### SQLite Cross-Platform Implementations

#### Flutter - sqflite & drift

**sqflite**: Flutter's native SQLite plugin
- Native SQLite access via platform channels
- Transaction support and batch operations
- Database versioning and migration
- Custom SQL and raw query support

```dart
// sqflite example
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  DatabaseHelper._internal();

  factory DatabaseHelper() => _instance;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'app_database.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL
      )
    ''');
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await db.execute('ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 0');
    }
  }
}
```

**drift (formerly moor)**: Type-safe SQL generation
- SQL schema definitions with Dart
- Compile-time SQL validation
- Boilerplate elimination with code generation
- Stream-based reactive queries

#### React Native Solutions

**react-native-sqlite-storage**
- Unified API for iOS and Android
- Promise-based and callback-based operations
- WAL mode support
- Encryption capabilities

**WatermelonDB**
- Reactive database with Observable patterns
- Lazy loading and performance optimization
- Multi-threaded architecture
- Sync protocol with backend integration

#### Xamarin - SQLite.NET
- Native SQLite binding with C#
- ORM capabilities and LINQ queries
- Encryption support (SQLCipher)
- Cross-platform code sharing

## NoSQL Solutions

### Core Data (iOS)

Core Data is Apple's object graph management and persistence framework, providing comprehensive data modeling solutions for iOS and macOS applications.

#### Core Components

**NSManagedObjectModel**
- Entity definitions and relationships
- Attribute types and validation rules
- Fetch request templates
- Configuration and versioning

**NSPersistentStoreCoordinator**
- Store type management (SQLite, Binary, In-Memory)
- Migration coordination
- Store metadata handling
- Multi-store configurations

**NSManagedObjectContext**
- Object lifecycle management
- Change tracking and validation
- Concurrent queue types (main, private)
- Parent-child context hierarchies

### SwiftData (iOS 17+)

SwiftData is Apple's modern declarative data modeling framework, built on top of Core Data with Swift-native syntax.

## Key-Value Stores

### Shared Preferences (Android)

Android's key-value storage for primitive data types and small amounts of data.

### UserDefaults (iOS)

iOS's property list-based storage for user preferences and simple data.

### Cross-Platform Key-Value Solutions

#### AsyncStorage (React Native)
Asynchronous, persistent key-value storage system for React Native applications.

#### Shared Preferences (Flutter)
Platform-agnostic key-value storage for Flutter applications.

## Hybrid and Cloud-Integrated Solutions

### Firebase Local Persistence

Firebase offers local caching and offline support for both Firestore and Realtime Database.

### Realm Database

Realm is a modern object database that provides a simple alternative to SQLite and Core Data.

## Performance Considerations

### Indexing Strategies
- **Primary Key Optimization**: Use appropriate data types and auto-increment when possible
- **Composite Indexes**: Create indexes for multi-column queries
- **Partial Indexes**: Index only relevant rows to reduce storage overhead
- **Covering Indexes**: Include all queried columns to avoid table lookups

### Query Optimization
- **Prepared Statements**: Reuse compiled queries for better performance
- **Batch Operations**: Group multiple insert/update operations
- **Lazy Loading**: Load related objects only when needed
- **Pagination**: Implement cursor-based or offset-based pagination

### Memory Management
- **Connection Pooling**: Reuse database connections
- **Result Set Streaming**: Process large datasets incrementally
- **Cache Management**: Implement intelligent caching strategies
- **Background Processing**: Perform heavy operations on background threads

### Storage Efficiency
- **Data Compression**: Use BLOB compression for large objects
- **Normalization**: Reduce data redundancy through proper table design
- **Archiving**: Move old data to separate tables or files
- **Vacuum Operations**: Regularly optimize database file structure

## Best Practices

### Security
- **Data Encryption**: Encrypt sensitive data at rest
- **Access Control**: Implement proper data access permissions
- **SQL Injection Prevention**: Use parameterized queries
- **Secure Key Management**: Store encryption keys securely

### Architecture
- **Repository Pattern**: Abstract data access logic
- **Dependency Injection**: Make database access testable
- **Error Handling**: Implement comprehensive error recovery
- **Migration Management**: Plan for schema evolution

### Testing
- **Unit Testing**: Test data access logic in isolation
- **Integration Testing**: Test database operations end-to-end
- **Mock Databases**: Use in-memory databases for testing
- **Data Validation**: Ensure data integrity at all levels

### Monitoring
- **Performance Metrics**: Track query execution times
- **Error Logging**: Log database errors and exceptions
- **Usage Analytics**: Monitor data access patterns
- **Capacity Planning**: Track storage growth and usage trends