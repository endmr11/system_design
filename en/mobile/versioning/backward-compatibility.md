# Backward Compatibility in Mobile Applications

Backward compatibility ensures that newer versions of mobile applications continue to work with older APIs, data formats, and user expectations while introducing new features. This is crucial for maintaining user experience across diverse device ecosystems and API versions.

## Compatibility Strategy

### Compatibility Levels

1. **Forward Compatibility**: New versions work with future data/APIs
2. **Backward Compatibility**: New versions work with older data/APIs
3. **Bidirectional Compatibility**: Full compatibility in both directions
4. **Breaking Changes**: Controlled incompatibility with migration paths

## API Versioning

### 1. Version Management Strategy

```typescript
// API Version Manager
interface APIVersion {
  major: number;
  minor: number;
  patch: number;
  deprecationDate?: Date;
  sunsetDate?: Date;
}

class APIVersionManager {
  private supportedVersions: Map<string, APIVersion> = new Map();
  private currentVersion: APIVersion;
  private minimumVersion: APIVersion;
  
  constructor() {
    this.initializeVersions();
  }
  
  private initializeVersions(): void {
    this.supportedVersions.set('1.0.0', {
      major: 1,
      minor: 0,
      patch: 0,
      deprecationDate: new Date('2024-06-01'),
      sunsetDate: new Date('2024-12-01')
    });
    
    this.supportedVersions.set('2.0.0', {
      major: 2,
      minor: 0,
      patch: 0,
      deprecationDate: new Date('2025-06-01')
    });
    
    this.supportedVersions.set('3.0.0', {
      major: 3,
      minor: 0,
      patch: 0
    });
    
    this.currentVersion = { major: 3, minor: 0, patch: 0 };
    this.minimumVersion = { major: 1, minor: 0, patch: 0 };
  }
  
  isVersionSupported(version: string): boolean {
    const apiVersion = this.parseVersion(version);
    if (!apiVersion) return false;
    
    return this.compareVersions(apiVersion, this.minimumVersion) >= 0 &&
           this.compareVersions(apiVersion, this.currentVersion) <= 0;
  }
  
  getCompatibleVersion(requestedVersion: string): string {
    if (this.isVersionSupported(requestedVersion)) {
      return requestedVersion;
    }
    
    // Return highest compatible version
    const requested = this.parseVersion(requestedVersion);
    if (!requested) return this.versionToString(this.currentVersion);
    
    // Find best match
    for (const [versionStr, version] of this.supportedVersions) {
      if (version.major === requested.major && 
          this.compareVersions(version, requested) >= 0) {
        return versionStr;
      }
    }
    
    return this.versionToString(this.currentVersion);
  }
  
  private parseVersion(versionStr: string): APIVersion | null {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }
  
  private compareVersions(a: APIVersion, b: APIVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }
  
  private versionToString(version: APIVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }
}
```

### 2. API Adapter Pattern

```typescript
// API Adapter for handling multiple versions
interface UserData {
  id: string;
  name: string;
  email: string;
  profile?: UserProfile;
}

interface UserDataV1 {
  id: string;
  name: string;
  email: string;
}

interface UserDataV2 extends UserDataV1 {
  avatar?: string;
  preferences?: Record<string, any>;
}

interface UserDataV3 extends UserDataV2 {
  profile?: UserProfile;
  settings?: UserSettings;
}

class APIAdapter {
  private version: string;
  
  constructor(version: string) {
    this.version = version;
  }
  
  adaptUserData(userData: any): UserData {
    const majorVersion = parseInt(this.version.split('.')[0]);
    
    switch (majorVersion) {
      case 1:
        return this.adaptFromV1(userData);
      case 2:
        return this.adaptFromV2(userData);
      case 3:
        return userData as UserDataV3;
      default:
        throw new Error(`Unsupported API version: ${this.version}`);
    }
  }
  
  private adaptFromV1(data: UserDataV1): UserData {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      profile: {
        displayName: data.name,
        avatar: null,
        bio: null
      }
    };
  }
  
  private adaptFromV2(data: UserDataV2): UserData {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      profile: {
        displayName: data.name,
        avatar: data.avatar || null,
        bio: null,
        preferences: data.preferences
      }
    };
  }
  
  serializeForVersion(userData: UserData): any {
    const majorVersion = parseInt(this.version.split('.')[0]);
    
    switch (majorVersion) {
      case 1:
        return this.serializeForV1(userData);
      case 2:
        return this.serializeForV2(userData);
      case 3:
        return userData;
      default:
        throw new Error(`Unsupported API version: ${this.version}`);
    }
  }
  
  private serializeForV1(userData: UserData): UserDataV1 {
    return {
      id: userData.id,
      name: userData.name,
      email: userData.email
    };
  }
  
  private serializeForV2(userData: UserData): UserDataV2 {
    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar: userData.profile?.avatar,
      preferences: userData.profile?.preferences
    };
  }
}
```

### 3. Graceful Degradation

```typescript
// Feature detection and graceful degradation
class FeatureCompatibilityManager {
  private apiVersion: string;
  private featureSupport: Map<string, boolean> = new Map();
  
  constructor(apiVersion: string) {
    this.apiVersion = apiVersion;
    this.detectFeatureSupport();
  }
  
  private detectFeatureSupport(): void {
    const majorVersion = parseInt(this.apiVersion.split('.')[0]);
    
    // Map features to minimum required versions
    const featureRequirements = {
      'push_notifications': 1,
      'real_time_sync': 2,
      'advanced_analytics': 2,
      'ai_recommendations': 3,
      'voice_commands': 3,
      'ar_features': 3
    };
    
    for (const [feature, minVersion] of Object.entries(featureRequirements)) {
      this.featureSupport.set(feature, majorVersion >= minVersion);
    }
  }
  
  isFeatureSupported(feature: string): boolean {
    return this.featureSupport.get(feature) ?? false;
  }
  
  getAlternativeImplementation(feature: string): string | null {
    const alternatives = {
      'real_time_sync': 'polling_sync',
      'ai_recommendations': 'basic_recommendations',
      'voice_commands': 'text_input',
      'ar_features': 'image_gallery'
    };
    
    if (!this.isFeatureSupported(feature)) {
      return alternatives[feature] || null;
    }
    
    return null;
  }
  
  async executeWithFallback<T>(
    feature: string,
    primaryImpl: () => Promise<T>,
    fallbackImpl: () => Promise<T>
  ): Promise<T> {
    if (this.isFeatureSupported(feature)) {
      try {
        return await primaryImpl();
      } catch (error) {
        console.warn(`Primary implementation failed for ${feature}, falling back:`, error);
        return await fallbackImpl();
      }
    } else {
      return await fallbackImpl();
    }
  }
}
```

## Data Migration

### 1. Database Schema Migration

```typescript
// Database migration system
interface Migration {
  version: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
  description: string;
}

class DatabaseMigrationManager {
  private migrations: Migration[] = [];
  private database: Database;
  
  constructor(database: Database) {
    this.database = database;
    this.initializeMigrations();
  }
  
  private initializeMigrations(): void {
    this.migrations = [
      {
        version: '1.0.0',
        description: 'Initial schema',
        up: async (db) => {
          await db.exec(`
            CREATE TABLE users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
        },
        down: async (db) => {
          await db.exec('DROP TABLE users');
        }
      },
      {
        version: '2.0.0',
        description: 'Add user preferences',
        up: async (db) => {
          await db.exec(`
            ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'
          `);
          
          await db.exec(`
            CREATE TABLE user_settings (
              user_id TEXT PRIMARY KEY,
              theme TEXT DEFAULT 'light',
              notifications_enabled BOOLEAN DEFAULT 1,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `);
        },
        down: async (db) => {
          await db.exec('DROP TABLE user_settings');
          // Note: SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
        }
      },
      {
        version: '3.0.0',
        description: 'Add user profiles',
        up: async (db) => {
          await db.exec(`
            CREATE TABLE user_profiles (
              user_id TEXT PRIMARY KEY,
              display_name TEXT,
              avatar_url TEXT,
              bio TEXT,
              location TEXT,
              website TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `);
        },
        down: async (db) => {
          await db.exec('DROP TABLE user_profiles');
        }
      }
    ];
  }
  
  async getCurrentVersion(): Promise<string> {
    try {
      const result = await this.database.get(`
        SELECT version FROM schema_migrations 
        ORDER BY applied_at DESC 
        LIMIT 1
      `);
      return result?.version || '0.0.0';
    } catch {
      // First run, create migrations table
      await this.database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return '0.0.0';
    }
  }
  
  async migrate(targetVersion?: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion || this.getLatestVersion();
    
    const pendingMigrations = this.migrations.filter(migration => 
      this.compareVersions(migration.version, currentVersion) > 0 &&
      this.compareVersions(migration.version, target) <= 0
    );
    
    for (const migration of pendingMigrations) {
      console.log(`Applying migration ${migration.version}: ${migration.description}`);
      
      try {
        await this.database.run('BEGIN TRANSACTION');
        await migration.up(this.database);
        
        await this.database.run(`
          INSERT INTO schema_migrations (version) VALUES (?)
        `, [migration.version]);
        
        await this.database.run('COMMIT');
        
        console.log(`Migration ${migration.version} applied successfully`);
      } catch (error) {
        await this.database.run('ROLLBACK');
        throw new Error(`Migration ${migration.version} failed: ${error.message}`);
      }
    }
  }
  
  async rollback(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    
    const rollbackMigrations = this.migrations
      .filter(migration => 
        this.compareVersions(migration.version, targetVersion) > 0 &&
        this.compareVersions(migration.version, currentVersion) <= 0
      )
      .reverse();
    
    for (const migration of rollbackMigrations) {
      console.log(`Rolling back migration ${migration.version}`);
      
      try {
        await this.database.run('BEGIN TRANSACTION');
        await migration.down(this.database);
        
        await this.database.run(`
          DELETE FROM schema_migrations WHERE version = ?
        `, [migration.version]);
        
        await this.database.run('COMMIT');
        
        console.log(`Migration ${migration.version} rolled back successfully`);
      } catch (error) {
        await this.database.run('ROLLBACK');
        throw new Error(`Rollback of ${migration.version} failed: ${error.message}`);
      }
    }
  }
  
  private getLatestVersion(): string {
    return this.migrations[this.migrations.length - 1]?.version || '0.0.0';
  }
  
  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const versionA = parseVersion(a);
    const versionB = parseVersion(b);
    
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const partA = versionA[i] || 0;
      const partB = versionB[i] || 0;
      
      if (partA !== partB) {
        return partA - partB;
      }
    }
    
    return 0;
  }
}
```

### 2. Data Format Migration

```typescript
// Data format migration for local storage
interface DataMigration<T = any> {
  from: string;
  to: string;
  migrate: (data: T) => T;
  validate: (data: T) => boolean;
}

class DataMigrationManager {
  private migrations: Map<string, DataMigration[]> = new Map();
  
  constructor() {
    this.initializeDataMigrations();
  }
  
  private initializeDataMigrations(): void {
    // User data migrations
    this.migrations.set('user_data', [
      {
        from: '1.0.0',
        to: '2.0.0',
        migrate: (data: any) => ({
          ...data,
          preferences: data.settings || {},
          settings: undefined // Remove old field
        }),
        validate: (data: any) => !!data.preferences
      },
      {
        from: '2.0.0',
        to: '3.0.0',
        migrate: (data: any) => ({
          ...data,
          profile: {
            displayName: data.name,
            avatar: data.avatar || null,
            bio: null,
            ...data.profile
          }
        }),
        validate: (data: any) => !!data.profile
      }
    ]);
    
    // App settings migrations
    this.migrations.set('app_settings', [
      {
        from: '1.0.0',
        to: '2.0.0',
        migrate: (data: any) => ({
          ...data,
          theme: data.theme || 'light',
          notifications: {
            push: data.pushNotifications ?? true,
            email: data.emailNotifications ?? false,
            ...data.notifications
          }
        }),
        validate: (data: any) => !!data.notifications
      }
    ]);
  }
  
  async migrateData(
    dataType: string,
    data: any,
    fromVersion: string,
    toVersion: string
  ): Promise<any> {
    const migrations = this.migrations.get(dataType);
    if (!migrations) {
      throw new Error(`No migrations found for data type: ${dataType}`);
    }
    
    let currentData = data;
    let currentVersion = fromVersion;
    
    // Find migration path
    const migrationPath = this.findMigrationPath(migrations, fromVersion, toVersion);
    
    for (const migration of migrationPath) {
      try {
        console.log(`Migrating ${dataType} from ${migration.from} to ${migration.to}`);
        
        currentData = migration.migrate(currentData);
        
        if (!migration.validate(currentData)) {
          throw new Error(`Migration validation failed for ${migration.to}`);
        }
        
        currentVersion = migration.to;
      } catch (error) {
        throw new Error(`Data migration failed: ${error.message}`);
      }
    }
    
    return currentData;
  }
  
  private findMigrationPath(
    migrations: DataMigration[],
    fromVersion: string,
    toVersion: string
  ): DataMigration[] {
    const path: DataMigration[] = [];
    let currentVersion = fromVersion;
    
    while (currentVersion !== toVersion) {
      const nextMigration = migrations.find(m => m.from === currentVersion);
      
      if (!nextMigration) {
        throw new Error(`No migration path from ${currentVersion} to ${toVersion}`);
      }
      
      path.push(nextMigration);
      currentVersion = nextMigration.to;
      
      // Prevent infinite loops
      if (path.length > 10) {
        throw new Error('Migration path too long, possible circular dependency');
      }
    }
    
    return path;
  }
}
```

## Platform Compatibility

### 1. Android Platform Compatibility

```kotlin
// Android API level compatibility manager
class AndroidCompatibilityManager {
    companion object {
        private const val MIN_SDK_VERSION = 21 // Android 5.0
        private const val TARGET_SDK_VERSION = 34 // Android 14
    }
    
    fun isFeatureSupported(feature: String): Boolean {
        return when (feature) {
            "biometric_authentication" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            "notification_channels" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            "adaptive_icons" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            "picture_in_picture" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            "background_location" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            "scoped_storage" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            "dark_theme" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            else -> true
        }
    }
    
    fun <T> executeWithFallback(
        feature: String,
        modernImpl: () -> T,
        legacyImpl: () -> T
    ): T {
        return if (isFeatureSupported(feature)) {
            try {
                modernImpl()
            } catch (e: Exception) {
                Log.w("Compatibility", "Modern implementation failed, falling back", e)
                legacyImpl()
            }
        } else {
            legacyImpl()
        }
    }
    
    fun requestPermissionsCompat(
        activity: Activity,
        permissions: Array<String>,
        requestCode: Int
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            activity.requestPermissions(permissions, requestCode)
        } else {
            // Permissions are granted at install time for older versions
            val results = IntArray(permissions.size) { PackageManager.PERMISSION_GRANTED }
            (activity as? PermissionCompatCallback)?.onPermissionResult(requestCode, permissions, results)
        }
    }
    
    fun createNotificationCompat(
        context: Context,
        title: String,
        message: String,
        channelId: String
    ): NotificationCompat.Builder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannel(context, channelId)
            NotificationCompat.Builder(context, channelId)
        } else {
            NotificationCompat.Builder(context)
        }.apply {
            setContentTitle(title)
            setContentText(message)
            setSmallIcon(R.drawable.ic_notification)
            setPriority(NotificationCompat.PRIORITY_DEFAULT)
        }
    }
    
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createNotificationChannel(context: Context, channelId: String) {
        val channel = NotificationChannel(
            channelId,
            "Default Channel",
            NotificationManager.IMPORTANCE_DEFAULT
        )
        
        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(channel)
    }
}

// Usage example
class MainActivity : AppCompatActivity() {
    private val compatibilityManager = AndroidCompatibilityManager()
    
    private fun setupBiometricAuth() {
        compatibilityManager.executeWithFallback(
            "biometric_authentication",
            modernImpl = { setupBiometricPrompt() },
            legacyImpl = { setupFingerprintAuth() }
        )
    }
    
    private fun setupBiometricPrompt() {
        // Modern biometric authentication (API 28+)
        val biometricPrompt = BiometricPrompt(this as FragmentActivity, 
            ContextCompat.getMainExecutor(this), 
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    handleAuthSuccess()
                }
            })
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Authentication")
            .setSubtitle("Use your fingerprint to authenticate")
            .setNegativeButtonText("Cancel")
            .build()
        
        biometricPrompt.authenticate(promptInfo)
    }
    
    private fun setupFingerprintAuth() {
        // Legacy fingerprint authentication (API 23-27)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val fingerprintManager = FingerprintManagerCompat.from(this)
            // Implement legacy fingerprint authentication
        }
    }
}
```

### 2. iOS Platform Compatibility

```swift
// iOS version compatibility manager
class IOSCompatibilityManager {
    static let shared = IOSCompatibilityManager()
    private init() {}
    
    func isFeatureSupported(_ feature: String) -> Bool {
        switch feature {
        case "face_id":
            return isVersionAtLeast(11, 0)
        case "critical_alerts":
            return isVersionAtLeast(12, 0)
        case "dark_mode":
            return isVersionAtLeast(13, 0)
        case "app_clips":
            return isVersionAtLeast(14, 0)
        case "privacy_indicators":
            return isVersionAtLeast(14, 0)
        case "app_tracking_transparency":
            return isVersionAtLeast(14, 5)
        default:
            return true
        }
    }
    
    func executeWithFallback<T>(
        feature: String,
        modernImpl: () throws -> T,
        legacyImpl: () throws -> T
    ) -> T? {
        if isFeatureSupported(feature) {
            do {
                return try modernImpl()
            } catch {
                print("Modern implementation failed for \(feature), falling back: \(error)")
                return try? legacyImpl()
            }
        } else {
            return try? legacyImpl()
        }
    }
    
    private func isVersionAtLeast(_ major: Int, _ minor: Int) -> Bool {
        let version = ProcessInfo.processInfo.operatingSystemVersion
        return version.majorVersion > major || 
               (version.majorVersion == major && version.minorVersion >= minor)
    }
    
    // Notification compatibility
    func scheduleNotificationCompat(
        title: String,
        body: String,
        identifier: String,
        trigger: UNNotificationTrigger?
    ) {
        if #available(iOS 10.0, *) {
            scheduleUserNotification(title: title, body: body, identifier: identifier, trigger: trigger)
        } else {
            scheduleLocalNotification(title: title, body: body)
        }
    }
    
    @available(iOS 10.0, *)
    private func scheduleUserNotification(
        title: String,
        body: String,
        identifier: String,
        trigger: UNNotificationTrigger?
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
    
    private func scheduleLocalNotification(title: String, body: String) {
        let notification = UILocalNotification()
        notification.alertTitle = title
        notification.alertBody = body
        notification.fireDate = Date()
        
        UIApplication.shared.scheduleLocalNotification(notification)
    }
    
    // Biometric authentication compatibility
    func authenticateWithBiometrics(
        reason: String,
        completion: @escaping (Bool, Error?) -> Void
    ) {
        executeWithFallback(
            feature: "face_id",
            modernImpl: {
                authenticateWithBiometricsModern(reason: reason, completion: completion)
            },
            legacyImpl: {
                authenticateWithTouchID(reason: reason, completion: completion)
            }
        )
    }
    
    private func authenticateWithBiometricsModern(
        reason: String,
        completion: @escaping (Bool, Error?) -> Void
    ) {
        let context = LAContext()
        var error: NSError?
        
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            ) { success, error in
                DispatchQueue.main.async {
                    completion(success, error)
                }
            }
        } else {
            completion(false, error)
        }
    }
    
    private func authenticateWithTouchID(
        reason: String,
        completion: @escaping (Bool, Error?) -> Void
    ) {
        let context = LAContext()
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { success, error in
            DispatchQueue.main.async {
                completion(success, error)
            }
        }
    }
}

// Usage example
class ViewController: UIViewController {
    private let compatibilityManager = IOSCompatibilityManager.shared
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupDarkModeSupport()
    }
    
    private func setupDarkModeSupport() {
        compatibilityManager.executeWithFallback(
            feature: "dark_mode",
            modernImpl: {
                // iOS 13+ dark mode support
                if #available(iOS 13.0, *) {
                    overrideUserInterfaceStyle = .unspecified
                    view.backgroundColor = UIColor.systemBackground
                }
            },
            legacyImpl: {
                // Legacy color handling
                view.backgroundColor = UIColor.white
            }
        )
    }
}
```

### 3. Cross-Platform Compatibility (React Native)

```typescript
// React Native platform compatibility
import { Platform, PlatformOSType } from 'react-native';
import DeviceInfo from 'react-native-device-info';

interface PlatformFeature {
  ios?: boolean;
  android?: boolean;
  minVersion?: {
    ios?: string;
    android?: number;
  };
}

class CrossPlatformCompatibilityManager {
  private static instance: CrossPlatformCompatibilityManager;
  private platformFeatures: Map<string, PlatformFeature> = new Map();
  
  static getInstance(): CrossPlatformCompatibilityManager {
    if (!this.instance) {
      this.instance = new CrossPlatformCompatibilityManager();
    }
    return this.instance;
  }
  
  private constructor() {
    this.initializePlatformFeatures();
  }
  
  private initializePlatformFeatures(): void {
    this.platformFeatures.set('biometric_authentication', {
      ios: true,
      android: true,
      minVersion: {
        ios: '11.0',
        android: 23
      }
    });
    
    this.platformFeatures.set('push_notifications', {
      ios: true,
      android: true
    });
    
    this.platformFeatures.set('background_location', {
      ios: true,
      android: true,
      minVersion: {
        android: 29
      }
    });
    
    this.platformFeatures.set('dark_mode', {
      ios: true,
      android: true,
      minVersion: {
        ios: '13.0',
        android: 29
      }
    });
  }
  
  async isFeatureSupported(feature: string): Promise<boolean> {
    const featureConfig = this.platformFeatures.get(feature);
    if (!featureConfig) return false;
    
    const platform = Platform.OS as PlatformOSType;
    
    // Check platform support
    if (!featureConfig[platform]) return false;
    
    // Check version requirements
    const minVersion = featureConfig.minVersion?.[platform];
    if (minVersion) {
      const currentVersion = await this.getCurrentPlatformVersion();
      return this.isVersionSupported(currentVersion, minVersion);
    }
    
    return true;
  }
  
  async executeWithFallback<T>(
    feature: string,
    primaryImpl: () => Promise<T>,
    fallbackImpl: () => Promise<T>
  ): Promise<T> {
    const isSupported = await this.isFeatureSupported(feature);
    
    if (isSupported) {
      try {
        return await primaryImpl();
      } catch (error) {
        console.warn(`Primary implementation failed for ${feature}:`, error);
        return await fallbackImpl();
      }
    } else {
      return await fallbackImpl();
    }
  }
  
  private async getCurrentPlatformVersion(): Promise<string | number> {
    if (Platform.OS === 'ios') {
      return DeviceInfo.getSystemVersion();
    } else {
      return DeviceInfo.getApiLevel();
    }
  }
  
  private isVersionSupported(
    current: string | number,
    minimum: string | number
  ): boolean {
    if (typeof current === 'string' && typeof minimum === 'string') {
      // iOS version comparison
      return this.compareVersionStrings(current, minimum) >= 0;
    } else if (typeof current === 'number' && typeof minimum === 'number') {
      // Android API level comparison
      return current >= minimum;
    }
    
    return false;
  }
  
  private compareVersionStrings(current: string, minimum: string): number {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const minimumPart = minimumParts[i] || 0;
      
      if (currentPart !== minimumPart) {
        return currentPart - minimumPart;
      }
    }
    
    return 0;
  }
}

// Usage hooks
export const useCompatibility = () => {
  const compatibilityManager = CrossPlatformCompatibilityManager.getInstance();
  
  const isFeatureSupported = useCallback(async (feature: string) => {
    return await compatibilityManager.isFeatureSupported(feature);
  }, [compatibilityManager]);
  
  const executeWithFallback = useCallback(async <T>(
    feature: string,
    primaryImpl: () => Promise<T>,
    fallbackImpl: () => Promise<T>
  ) => {
    return await compatibilityManager.executeWithFallback(feature, primaryImpl, fallbackImpl);
  }, [compatibilityManager]);
  
  return { isFeatureSupported, executeWithFallback };
};

// Component example
const BiometricLoginButton: React.FC = () => {
  const { executeWithFallback } = useCompatibility();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleBiometricLogin = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await executeWithFallback(
        'biometric_authentication',
        async () => {
          // Modern biometric authentication
          const { TouchID, FaceID } = await import('react-native-touch-id');
          return await TouchID.authenticate('Authenticate to login');
        },
        async () => {
          // Fallback to PIN/password
          return await showPinEntry();
        }
      );
      
      // Handle successful authentication
      handleLoginSuccess();
    } catch (error) {
      console.error('Authentication failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [executeWithFallback]);
  
  return (
    <TouchableOpacity onPress={handleBiometricLogin} disabled={isLoading}>
      <Text>{isLoading ? 'Authenticating...' : 'Login with Biometrics'}</Text>
    </TouchableOpacity>
  );
};
```

## Testing & Validation

### 1. Compatibility Testing Framework

```typescript
// Automated compatibility testing
interface CompatibilityTest {
  name: string;
  description: string;
  minVersion: string;
  maxVersion?: string;
  platforms: ('ios' | 'android')[];
  test: () => Promise<CompatibilityTestResult>;
}

interface CompatibilityTestResult {
  passed: boolean;
  message: string;
  details?: any;
}

class CompatibilityTestSuite {
  private tests: CompatibilityTest[] = [];
  
  constructor() {
    this.initializeTests();
  }
  
  private initializeTests(): void {
    this.tests = [
      {
        name: 'database_migration',
        description: 'Test database schema migration',
        minVersion: '1.0.0',
        platforms: ['ios', 'android'],
        test: async () => {
          try {
            const migrationManager = new DatabaseMigrationManager(database);
            await migrationManager.migrate();
            return { passed: true, message: 'Migration successful' };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      },
      {
        name: 'api_compatibility',
        description: 'Test API backward compatibility',
        minVersion: '1.0.0',
        platforms: ['ios', 'android'],
        test: async () => {
          try {
            const apiAdapter = new APIAdapter('1.0.0');
            const result = await apiAdapter.adaptUserData(sampleData);
            return { 
              passed: !!result, 
              message: 'API adaptation successful',
              details: result
            };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      },
      {
        name: 'feature_fallback',
        description: 'Test feature fallback mechanisms',
        minVersion: '1.0.0',
        platforms: ['ios', 'android'],
        test: async () => {
          try {
            const compatManager = CrossPlatformCompatibilityManager.getInstance();
            const result = await compatManager.executeWithFallback(
              'nonexistent_feature',
              () => Promise.reject(new Error('Feature not supported')),
              () => Promise.resolve('Fallback executed')
            );
            
            return {
              passed: result === 'Fallback executed',
              message: 'Fallback mechanism works correctly'
            };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      }
    ];
  }
  
  async runTests(platform?: 'ios' | 'android'): Promise<CompatibilityTestResult[]> {
    const results: CompatibilityTestResult[] = [];
    
    for (const test of this.tests) {
      if (platform && !test.platforms.includes(platform)) {
        continue;
      }
      
      console.log(`Running compatibility test: ${test.name}`);
      
      try {
        const result = await test.test();
        results.push({
          ...result,
          message: `${test.name}: ${result.message}`
        });
      } catch (error) {
        results.push({
          passed: false,
          message: `${test.name}: Test execution failed - ${error.message}`
        });
      }
    }
    
    return results;
  }
  
  generateReport(results: CompatibilityTestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    let report = `Compatibility Test Report\n`;
    report += `=========================\n`;
    report += `Tests Passed: ${passed}/${total}\n`;
    report += `Success Rate: ${((passed / total) * 100).toFixed(1)}%\n\n`;
    
    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      report += `${index + 1}. ${status} ${result.message}\n`;
      
      if (result.details) {
        report += `   Details: ${JSON.stringify(result.details, null, 2)}\n`;
      }
    });
    
    return report;
  }
}
```

### 2. Version Matrix Testing

```typescript
// Test compatibility across version matrix
class VersionMatrixTester {
  private supportedVersions: string[] = ['1.0.0', '2.0.0', '3.0.0'];
  private testScenarios: TestScenario[] = [];
  
  interface TestScenario {
    name: string;
    fromVersion: string;
    toVersion: string;
    test: (from: string, to: string) => Promise<boolean>;
  }
  
  constructor() {
    this.initializeTestScenarios();
  }
  
  private initializeTestScenarios(): void {
    this.testScenarios = [
      {
        name: 'Data Migration',
        fromVersion: '*',
        toVersion: '*',
        test: async (from, to) => {
          const migrator = new DataMigrationManager();
          try {
            const result = await migrator.migrateData('user_data', sampleData, from, to);
            return !!result;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'API Compatibility',
        fromVersion: '*',
        toVersion: '*',
        test: async (from, to) => {
          try {
            const oldAdapter = new APIAdapter(from);
            const newAdapter = new APIAdapter(to);
            
            const oldFormat = oldAdapter.serializeForVersion(testData);
            const newFormat = newAdapter.adaptUserData(oldFormat);
            
            return !!newFormat;
          } catch {
            return false;
          }
        }
      }
    ];
  }
  
  async runMatrixTests(): Promise<VersionTestMatrix> {
    const matrix: VersionTestMatrix = {};
    
    for (const fromVersion of this.supportedVersions) {
      matrix[fromVersion] = {};
      
      for (const toVersion of this.supportedVersions) {
        matrix[fromVersion][toVersion] = {};
        
        for (const scenario of this.testScenarios) {
          const shouldTest = this.shouldRunTest(scenario, fromVersion, toVersion);
          
          if (shouldTest) {
            try {
              const result = await scenario.test(fromVersion, toVersion);
              matrix[fromVersion][toVersion][scenario.name] = result;
            } catch (error) {
              matrix[fromVersion][toVersion][scenario.name] = false;
            }
          }
        }
      }
    }
    
    return matrix;
  }
  
  private shouldRunTest(scenario: TestScenario, from: string, to: string): boolean {
    const matchesFrom = scenario.fromVersion === '*' || scenario.fromVersion === from;
    const matchesTo = scenario.toVersion === '*' || scenario.toVersion === to;
    
    return matchesFrom && matchesTo;
  }
  
  analyzeMatrix(matrix: VersionTestMatrix): CompatibilityReport {
    const report: CompatibilityReport = {
      overallCompatibility: 0,
      versionCompatibility: {},
      issues: []
    };
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const [fromVersion, toVersions] of Object.entries(matrix)) {
      for (const [toVersion, scenarios] of Object.entries(toVersions)) {
        for (const [scenario, passed] of Object.entries(scenarios)) {
          totalTests++;
          if (passed) passedTests++;
          
          if (!passed) {
            report.issues.push({
              fromVersion,
              toVersion,
              scenario,
              severity: this.calculateSeverity(fromVersion, toVersion, scenario)
            });
          }
        }
      }
    }
    
    report.overallCompatibility = (passedTests / totalTests) * 100;
    
    return report;
  }
  
  private calculateSeverity(from: string, to: string, scenario: string): 'low' | 'medium' | 'high' {
    // Critical scenarios
    if (scenario.includes('Migration') || scenario.includes('Security')) {
      return 'high';
    }
    
    // Major version differences
    const fromMajor = parseInt(from.split('.')[0]);
    const toMajor = parseInt(to.split('.')[0]);
    
    if (Math.abs(fromMajor - toMajor) > 1) {
      return 'medium';
    }
    
    return 'low';
  }
}
```

## Implementation Patterns

### 1. Strategy Pattern for Compatibility

```typescript
// Strategy pattern for handling different implementations
interface CompatibilityStrategy {
  isSupported(): boolean;
  execute<T>(operation: () => T): T;
}

class ModernImplementationStrategy implements CompatibilityStrategy {
  private minVersion: string;
  
  constructor(minVersion: string) {
    this.minVersion = minVersion;
  }
  
  isSupported(): boolean {
    const currentVersion = this.getCurrentVersion();
    return this.compareVersions(currentVersion, this.minVersion) >= 0;
  }
  
  execute<T>(operation: () => T): T {
    return operation();
  }
  
  private getCurrentVersion(): string {
    // Implementation to get current app version
    return '3.0.0';
  }
  
  private compareVersions(a: string, b: string): number {
    // Version comparison logic
    return 0;
  }
}

class LegacyImplementationStrategy implements CompatibilityStrategy {
  isSupported(): boolean {
    return true; // Legacy implementation always works
  }
  
  execute<T>(operation: () => T): T {
    return operation();
  }
}

class CompatibilityContext {
  private strategies: CompatibilityStrategy[] = [];
  
  addStrategy(strategy: CompatibilityStrategy): void {
    this.strategies.push(strategy);
  }
  
  execute<T>(operation: () => T, fallback: () => T): T {
    for (const strategy of this.strategies) {
      if (strategy.isSupported()) {
        try {
          return strategy.execute(operation);
        } catch (error) {
          console.warn('Strategy failed, trying next:', error);
          continue;
        }
      }
    }
    
    // All strategies failed, use fallback
    return fallback();
  }
}
```

### 2. Adapter Pattern for Legacy Support

```typescript
// Adapter pattern for legacy API support
interface ModernUserAPI {
  getUser(id: string): Promise<UserProfile>;
  updateProfile(id: string, profile: UserProfile): Promise<void>;
  getPreferences(id: string): Promise<UserPreferences>;
}

interface LegacyUserAPI {
  getUserData(id: string): Promise<LegacyUserData>;
  saveUserData(id: string, data: LegacyUserData): Promise<void>;
}

class LegacyUserAPIAdapter implements ModernUserAPI {
  constructor(private legacyAPI: LegacyUserAPI) {}
  
  async getUser(id: string): Promise<UserProfile> {
    const legacyData = await this.legacyAPI.getUserData(id);
    
    return {
      id: legacyData.id,
      displayName: legacyData.name,
      email: legacyData.email,
      avatar: legacyData.avatar || null,
      bio: null,
      preferences: this.adaptPreferences(legacyData.settings)
    };
  }
  
  async updateProfile(id: string, profile: UserProfile): Promise<void> {
    const legacyData: LegacyUserData = {
      id: profile.id,
      name: profile.displayName,
      email: profile.email,
      avatar: profile.avatar,
      settings: this.adaptToLegacySettings(profile.preferences)
    };
    
    await this.legacyAPI.saveUserData(id, legacyData);
  }
  
  async getPreferences(id: string): Promise<UserPreferences> {
    const legacyData = await this.legacyAPI.getUserData(id);
    return this.adaptPreferences(legacyData.settings);
  }
  
  private adaptPreferences(settings: any): UserPreferences {
    return {
      theme: settings?.theme || 'light',
      notifications: settings?.notifications !== false,
      language: settings?.language || 'en',
      privacy: {
        shareData: settings?.shareData !== false,
        analytics: settings?.analytics !== false
      }
    };
  }
  
  private adaptToLegacySettings(preferences: UserPreferences): any {
    return {
      theme: preferences.theme,
      notifications: preferences.notifications,
      language: preferences.language,
      shareData: preferences.privacy.shareData,
      analytics: preferences.privacy.analytics
    };
  }
}
```

Backward compatibility is essential for maintaining user trust and ensuring smooth upgrades. By implementing comprehensive version management, data migration strategies, and platform-specific compatibility layers, mobile applications can successfully evolve while preserving functionality for existing users across diverse device ecosystems.
