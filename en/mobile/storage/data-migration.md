# Data Migration & Versioning

## Introduction to Data Migration

Data migration and versioning are critical aspects of mobile application development that ensure seamless user experiences across app updates while maintaining data integrity and application stability.

## Database Schema Versioning

### Version Management Strategy
```javascript
// Database version management
class DatabaseVersionManager {
  constructor() {
    this.currentVersion = 1;
    this.migrations = new Map();
  }

  addMigration(fromVersion, toVersion, migrationFn) {
    const key = `${fromVersion}-${toVersion}`;
    this.migrations.set(key, migrationFn);
  }

  async migrate(currentVersion, targetVersion) {
    let version = currentVersion;
    
    while (version < targetVersion) {
      const nextVersion = version + 1;
      const migrationKey = `${version}-${nextVersion}`;
      const migration = this.migrations.get(migrationKey);
      
      if (migration) {
        await migration();
        version = nextVersion;
      } else {
        throw new Error(`No migration found for ${migrationKey}`);
      }
    }
  }
}
```

### Schema Evolution Patterns
1. **Additive Changes**: Adding new tables, columns, or indexes
2. **Destructive Changes**: Removing or modifying existing structures
3. **Data Transformations**: Converting data formats or structures
4. **Index Optimization**: Adding or modifying database indexes

## Migration Strategies

### 1. Forward-Only Migrations
```sql
-- Migration v1 to v2: Add user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE UNIQUE INDEX idx_user_preferences_key ON user_preferences(user_id, preference_key);
```

### 2. Reversible Migrations
```javascript
// Reversible migration system
class ReversibleMigration {
  constructor(version, upFn, downFn) {
    this.version = version;
    this.up = upFn;
    this.down = downFn;
  }
}

const migrations = [
  new ReversibleMigration(
    2,
    // Up migration
    async (db) => {
      await db.exec(`
        ALTER TABLE users 
        ADD COLUMN email_verified BOOLEAN DEFAULT FALSE
      `);
    },
    // Down migration
    async (db) => {
      await db.exec(`
        ALTER TABLE users 
        DROP COLUMN email_verified
      `);
    }
  )
];
```

### 3. Zero-Downtime Migrations
```javascript
// Background migration strategy
class BackgroundMigration {
  constructor(db) {
    this.db = db;
    this.batchSize = 1000;
    this.migrationProgress = new Map();
  }

  async migrateInBatches(tableName, transformFn) {
    const totalRecords = await this.getTotalRecords(tableName);
    let processed = 0;

    while (processed < totalRecords) {
      const batch = await this.getBatch(tableName, processed, this.batchSize);
      
      for (const record of batch) {
        await transformFn(record);
      }
      
      processed += batch.length;
      this.updateProgress(tableName, processed, totalRecords);
      
      // Yield control to prevent blocking
      await this.sleep(10);
    }
  }

  updateProgress(tableName, processed, total) {
    const progress = (processed / total) * 100;
    this.migrationProgress.set(tableName, progress);
    
    // Notify UI of progress
    this.notifyProgress(tableName, progress);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Data Transformation Techniques

### 1. Column Type Changes
```sql
-- Safe column type migration
-- Step 1: Add new column
ALTER TABLE products ADD COLUMN price_decimal DECIMAL(10,2);

-- Step 2: Migrate data
UPDATE products SET price_decimal = CAST(price_string AS DECIMAL(10,2));

-- Step 3: Drop old column (in next migration)
-- ALTER TABLE products DROP COLUMN price_string;

-- Step 4: Rename new column (in next migration)
-- ALTER TABLE products RENAME COLUMN price_decimal TO price;
```

### 2. Table Structure Changes
```javascript
// Complex table restructuring
class TableRestructureManager {
  async splitUserTable() {
    // Create new tables
    await this.db.exec(`
      CREATE TABLE user_profiles (
        id INTEGER PRIMARY KEY,
        user_id INTEGER UNIQUE,
        first_name TEXT,
        last_name TEXT,
        bio TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Migrate data
    await this.db.exec(`
      INSERT INTO user_profiles (user_id, first_name, last_name, bio)
      SELECT id, first_name, last_name, bio FROM users
    `);

    // Remove columns from original table (in stages)
    await this.db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      INSERT INTO users_new (id, username, email, password_hash, created_at)
      SELECT id, username, email, password_hash, created_at FROM users
    `);

    await this.db.exec('DROP TABLE users');
    await this.db.exec('ALTER TABLE users_new RENAME TO users');
  }
}
```

### 3. Data Format Migrations
```javascript
// Data format conversion
class DataFormatMigrator {
  async migrateJSONFields() {
    const records = await this.db.all('SELECT id, metadata FROM products');
    
    for (const record of records) {
      try {
        // Convert old format to new format
        const oldMetadata = JSON.parse(record.metadata);
        const newMetadata = this.transformMetadata(oldMetadata);
        
        await this.db.run(
          'UPDATE products SET metadata = ? WHERE id = ?',
          [JSON.stringify(newMetadata), record.id]
        );
      } catch (error) {
        console.error(`Failed to migrate record ${record.id}:`, error);
        // Log error but continue with other records
      }
    }
  }

  transformMetadata(oldFormat) {
    return {
      version: 2,
      properties: {
        ...oldFormat,
        updatedAt: new Date().toISOString()
      }
    };
  }
}
```

## Version Compatibility Management

### 1. Backward Compatibility
```javascript
// Compatibility layer for different app versions
class CompatibilityManager {
  constructor(appVersion, dbVersion) {
    this.appVersion = appVersion;
    this.dbVersion = dbVersion;
    this.adapters = new Map();
  }

  addAdapter(version, adapter) {
    this.adapters.set(version, adapter);
  }

  async getData(query) {
    const rawData = await this.db.query(query);
    const adapter = this.adapters.get(this.appVersion);
    
    return adapter ? adapter.transform(rawData) : rawData;
  }
}

// Version-specific adapters
const v1Adapter = {
  transform(data) {
    // Transform data for v1 app compatibility
    return data.map(item => ({
      id: item.id,
      name: item.title, // Map 'title' to 'name' for v1
      description: item.description
    }));
  }
};
```

### 2. Feature Flags for Gradual Rollout
```javascript
// Feature flag system for migrations
class MigrationFeatureFlags {
  constructor() {
    this.flags = new Map([
      ['new_user_schema', false],
      ['enhanced_search', false],
      ['optimized_indexes', true]
    ]);
  }

  isEnabled(feature) {
    return this.flags.get(feature) || false;
  }

  async conditionalMigration(feature, migrationFn) {
    if (this.isEnabled(feature)) {
      await migrationFn();
    }
  }
}
```

## Error Handling and Rollback

### 1. Safe Migration Execution
```javascript
class SafeMigrationExecutor {
  async executeMigration(migration) {
    const transaction = await this.db.beginTransaction();
    
    try {
      // Create backup of affected tables
      await this.createBackup(migration.affectedTables);
      
      // Execute migration
      await migration.execute();
      
      // Validate migration results
      await this.validateMigration(migration);
      
      // Commit transaction
      await transaction.commit();
      
      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      // Rollback transaction
      await transaction.rollback();
      
      // Restore from backup if needed
      await this.restoreFromBackup(migration.affectedTables);
      
      throw new Error(`Migration ${migration.version} failed: ${error.message}`);
    }
  }

  async createBackup(tables) {
    for (const table of tables) {
      await this.db.exec(`
        CREATE TABLE ${table}_backup_${Date.now()} 
        AS SELECT * FROM ${table}
      `);
    }
  }

  async validateMigration(migration) {
    // Run validation queries
    for (const validation of migration.validations) {
      const result = await this.db.get(validation.query);
      if (!validation.check(result)) {
        throw new Error(`Validation failed: ${validation.description}`);
      }
    }
  }
}
```

### 2. Automatic Rollback Mechanisms
```javascript
// Automatic rollback on critical errors
class AutoRollbackManager {
  constructor(db) {
    this.db = db;
    this.checkpoints = [];
  }

  async createCheckpoint(name) {
    const checkpoint = {
      name,
      timestamp: Date.now(),
      tables: await this.captureTableState()
    };
    
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  async rollbackToCheckpoint(checkpointName) {
    const checkpoint = this.checkpoints.find(cp => cp.name === checkpointName);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointName} not found`);
    }

    // Restore table states
    for (const [tableName, tableData] of Object.entries(checkpoint.tables)) {
      await this.restoreTable(tableName, tableData);
    }
  }

  async captureTableState() {
    // Capture current state of all tables
    const tables = await this.db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const state = {};
    for (const table of tables) {
      state[table.name] = await this.db.all(`SELECT * FROM ${table.name}`);
    }

    return state;
  }
}
```

## Performance Optimization During Migration

### 1. Batch Processing
```javascript
class PerformantMigrator {
  constructor(db, options = {}) {
    this.db = db;
    this.batchSize = options.batchSize || 1000;
    this.delayBetweenBatches = options.delay || 100;
  }

  async migrateLargeTable(tableName, transformFn) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.db.all(`
        SELECT * FROM ${tableName} 
        ORDER BY id 
        LIMIT ${this.batchSize} 
        OFFSET ${offset}
      `);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch in transaction
      await this.db.transaction(async () => {
        for (const row of batch) {
          await transformFn(row);
        }
      });

      offset += this.batchSize;
      
      // Prevent blocking the main thread
      await this.sleep(this.delayBetweenBatches);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2. Index Management
```sql
-- Optimize indexes during migration
-- Drop indexes before large data migrations
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

-- Perform data migration
-- ... migration operations ...

-- Recreate indexes after migration
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Create new optimized indexes
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_status_created ON users(status, created_at);
```

## Platform-Specific Migration

### 1. SQLite Migrations (Mobile)
```javascript
// SQLite-specific migration utilities
class SQLiteMigrator {
  async addColumnSafely(tableName, columnName, columnType, defaultValue) {
    // SQLite doesn't support all ALTER TABLE operations
    // Use table recreation for complex changes
    
    const tempTableName = `${tableName}_temp_${Date.now()}`;
    
    // Get current table schema
    const tableInfo = await this.db.all(`PRAGMA table_info(${tableName})`);
    const columns = tableInfo.map(col => col.name);
    
    // Create temporary table with new column
    await this.db.exec(`
      CREATE TABLE ${tempTableName} AS 
      SELECT *, ${defaultValue} as ${columnName} 
      FROM ${tableName}
    `);
    
    // Drop original table
    await this.db.exec(`DROP TABLE ${tableName}`);
    
    // Rename temporary table
    await this.db.exec(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);
  }

  async renameColumn(tableName, oldName, newName) {
    // SQLite doesn't support RENAME COLUMN until version 3.25.0
    // Use table recreation for older versions
    
    const tableSchema = await this.getTableSchema(tableName);
    const newSchema = tableSchema.replace(
      new RegExp(`\\b${oldName}\\b`, 'g'), 
      newName
    );
    
    const tempTableName = `${tableName}_temp`;
    
    // Create new table with updated schema
    await this.db.exec(newSchema.replace(tableName, tempTableName));
    
    // Copy data
    const columns = await this.getColumnNames(tableName);
    const columnMapping = columns.map(col => 
      col === oldName ? `${oldName} as ${newName}` : col
    ).join(', ');
    
    await this.db.exec(`
      INSERT INTO ${tempTableName} 
      SELECT ${columnMapping} FROM ${tableName}
    `);
    
    // Replace original table
    await this.db.exec(`DROP TABLE ${tableName}`);
    await this.db.exec(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);
  }
}
```

### 2. Cross-Platform Considerations
```javascript
// Platform-agnostic migration framework
class CrossPlatformMigrator {
  constructor(platform) {
    this.platform = platform;
    this.migrators = {
      'sqlite': new SQLiteMigrator(),
      'realm': new RealmMigrator(),
      'indexeddb': new IndexedDBMigrator()
    };
  }

  async migrate(fromVersion, toVersion) {
    const migrator = this.migrators[this.platform];
    if (!migrator) {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }

    return await migrator.migrate(fromVersion, toVersion);
  }
}
```

## Testing Migration Scripts

### 1. Migration Testing Framework
```javascript
class MigrationTester {
  constructor() {
    this.testData = new Map();
  }

  async setupTestData(version, data) {
    this.testData.set(version, data);
  }

  async testMigration(fromVersion, toVersion) {
    // Create test database with source version data
    const testDb = await this.createTestDatabase(fromVersion);
    
    // Apply migration
    const migrator = new DatabaseVersionManager();
    await migrator.migrate(fromVersion, toVersion);
    
    // Validate results
    const validationResults = await this.validateMigrationResults(testDb, toVersion);
    
    return {
      success: validationResults.every(r => r.passed),
      results: validationResults
    };
  }

  async validateMigrationResults(db, version) {
    const validators = this.getValidatorsForVersion(version);
    const results = [];

    for (const validator of validators) {
      try {
        const result = await validator.validate(db);
        results.push({ ...result, passed: true });
      } catch (error) {
        results.push({ 
          validator: validator.name, 
          error: error.message, 
          passed: false 
        });
      }
    }

    return results;
  }
}
```

### 2. Automated Migration Tests
```javascript
// Automated test suite for migrations
describe('Database Migrations', () => {
  let migrationTester;

  beforeEach(() => {
    migrationTester = new MigrationTester();
  });

  test('should migrate from v1 to v2 successfully', async () => {
    const v1Data = {
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com' }
      ]
    };

    await migrationTester.setupTestData(1, v1Data);
    const result = await migrationTester.testMigration(1, 2);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3); // Expected validations
  });

  test('should handle migration rollback on failure', async () => {
    // Test rollback functionality
    const invalidMigration = () => {
      throw new Error('Simulated migration failure');
    };

    await expect(
      migrationTester.testMigrationWithRollback(invalidMigration)
    ).rejects.toThrow('Simulated migration failure');

    // Verify database state unchanged
    const state = await migrationTester.getDatabaseState();
    expect(state.version).toBe(1); // Should remain at original version
  });
});
```

## Best Practices

### 1. Migration Planning
- **Version Strategy**: Use semantic versioning for database schemas
- **Change Documentation**: Maintain detailed migration logs
- **Testing Coverage**: Test all migration paths thoroughly
- **Rollback Plans**: Always have rollback strategies

### 2. Performance Guidelines
- **Batch Operations**: Process large datasets in batches
- **Index Management**: Drop and recreate indexes efficiently
- **Transaction Usage**: Use transactions for atomic operations
- **Progress Monitoring**: Provide user feedback for long migrations

### 3. Safety Measures
- **Backup Strategy**: Always backup before migrations
- **Validation Rules**: Implement comprehensive validation
- **Feature Flags**: Use flags for gradual rollouts
- **Monitoring**: Monitor migration performance and errors

## Conclusion

Effective data migration and versioning strategies are crucial for maintaining application stability and user trust. By implementing robust migration frameworks, comprehensive testing, and careful planning, developers can ensure smooth transitions between application versions while preserving data integrity and minimizing user disruption.

The key to successful migrations is preparation, testing, and having solid rollback mechanisms in place for when things don't go as planned.
