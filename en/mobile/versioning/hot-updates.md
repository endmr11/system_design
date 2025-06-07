# Hot Updates & Code Push for Mobile Applications

Hot updates and code push functionality allow mobile applications to update their JavaScript code, assets, and configurations without requiring users to download a new version from app stores. This capability is particularly valuable for React Native and hybrid applications.

## Architecture Overview

### Update Types

1. **JavaScript Bundle Updates**: Core application logic
2. **Asset Updates**: Images, fonts, configuration files
3. **Configuration Updates**: API endpoints, feature flags
4. **Partial Updates**: Delta updates for efficient bandwidth usage
5. **Critical Updates**: Security patches and bug fixes

## Implementation Strategies

### 1. Update Manager Architecture

```typescript
interface UpdateMetadata {
  version: string;
  bundleUrl: string;
  assetsUrl?: string;
  checksum: string;
  signature: string;
  releaseNotes: string;
  isMandatory: boolean;
  rolloutPercentage: number;
  minAppVersion: string;
  maxAppVersion?: string;
  targetPlatform: 'ios' | 'android' | 'both';
  releaseDate: Date;
}

interface UpdateStatus {
  currentVersion: string;
  availableVersion?: string;
  downloadProgress?: number;
  status: 'checking' | 'downloading' | 'installing' | 'ready' | 'failed';
  error?: string;
}

class UpdateManager {
  private updateService: UpdateService;
  private storage: UpdateStorage;
  private validator: UpdateValidator;
  private listeners: UpdateListener[] = [];
  
  constructor() {
    this.updateService = new UpdateService();
    this.storage = new UpdateStorage();
    this.validator = new UpdateValidator();
  }
  
  async checkForUpdates(): Promise<UpdateMetadata | null> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const deviceInfo = await this.getDeviceInfo();
      
      const update = await this.updateService.checkForUpdates({
        currentVersion,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        deviceId: deviceInfo.deviceId
      });
      
      if (update && this.shouldApplyUpdate(update)) {
        return update;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking for updates:', error);
      return null;
    }
  }
  
  async downloadUpdate(metadata: UpdateMetadata): Promise<void> {
    this.notifyListeners({ status: 'downloading', availableVersion: metadata.version });
    
    try {
      // Download bundle
      const bundlePath = await this.downloadWithProgress(
        metadata.bundleUrl,
        (progress) => this.notifyListeners({ 
          status: 'downloading', 
          downloadProgress: progress,
          availableVersion: metadata.version 
        })
      );
      
      // Download assets if available
      let assetsPath;
      if (metadata.assetsUrl) {
        assetsPath = await this.downloadWithProgress(metadata.assetsUrl);
      }
      
      // Verify integrity
      await this.validator.verifyUpdate(bundlePath, metadata);
      
      // Store update
      await this.storage.storeUpdate({
        version: metadata.version,
        bundlePath,
        assetsPath,
        metadata
      });
      
      this.notifyListeners({ status: 'ready', availableVersion: metadata.version });
    } catch (error) {
      this.notifyListeners({ status: 'failed', error: error.message });
      throw error;
    }
  }
  
  async installUpdate(version: string): Promise<void> {
    this.notifyListeners({ status: 'installing' });
    
    try {
      const storedUpdate = await this.storage.getUpdate(version);
      if (!storedUpdate) {
        throw new Error('Update not found in storage');
      }
      
      // Create backup of current version
      await this.storage.createBackup();
      
      // Apply update
      await this.applyUpdate(storedUpdate);
      
      // Update current version
      await this.storage.setCurrentVersion(version);
      
      this.notifyListeners({ status: 'ready', currentVersion: version });
    } catch (error) {
      // Rollback on failure
      await this.rollbackUpdate();
      this.notifyListeners({ status: 'failed', error: error.message });
      throw error;
    }
  }
  
  private shouldApplyUpdate(metadata: UpdateMetadata): boolean {
    // Check rollout percentage
    const userId = this.getUserId();
    const hash = this.hashString(userId);
    if ((hash % 100) >= metadata.rolloutPercentage) {
      return false;
    }
    
    // Check app version compatibility
    const currentAppVersion = this.getAppVersion();
    if (!this.isVersionCompatible(currentAppVersion, metadata.minAppVersion, metadata.maxAppVersion)) {
      return false;
    }
    
    return true;
  }
}
```

### 2. Delta Update System

```typescript
// Delta update for efficient bandwidth usage
class DeltaUpdateManager {
  async createDelta(fromVersion: string, toVersion: string): Promise<DeltaPackage> {
    const fromBundle = await this.loadBundle(fromVersion);
    const toBundle = await this.loadBundle(toVersion);
    
    const deltaOperations = this.computeDelta(fromBundle, toBundle);
    
    return {
      fromVersion,
      toVersion,
      operations: deltaOperations,
      checksum: this.computeChecksum(deltaOperations)
    };
  }
  
  async applyDelta(currentVersion: string, delta: DeltaPackage): Promise<Bundle> {
    if (currentVersion !== delta.fromVersion) {
      throw new Error('Version mismatch for delta update');
    }
    
    const currentBundle = await this.loadBundle(currentVersion);
    const updatedBundle = this.applyDeltaOperations(currentBundle, delta.operations);
    
    // Verify result
    const checksum = this.computeChecksum(updatedBundle);
    if (checksum !== delta.checksum) {
      throw new Error('Delta application failed - checksum mismatch');
    }
    
    return updatedBundle;
  }
  
  private computeDelta(fromBundle: Bundle, toBundle: Bundle): DeltaOperation[] {
    const operations: DeltaOperation[] = [];
    
    // File additions
    for (const [path, content] of toBundle.files) {
      if (!fromBundle.files.has(path)) {
        operations.push({
          type: 'add',
          path,
          content: this.compressContent(content)
        });
      }
    }
    
    // File modifications
    for (const [path, content] of toBundle.files) {
      const oldContent = fromBundle.files.get(path);
      if (oldContent && oldContent !== content) {
        const patch = this.createBinaryPatch(oldContent, content);
        operations.push({
          type: 'modify',
          path,
          patch
        });
      }
    }
    
    // File deletions
    for (const [path] of fromBundle.files) {
      if (!toBundle.files.has(path)) {
        operations.push({
          type: 'delete',
          path
        });
      }
    }
    
    return operations;
  }
}
```

## Platform-Specific Solutions

### React Native Implementation

```typescript
// React Native Code Push Implementation
import CodePush from 'react-native-code-push';

class ReactNativeUpdateManager {
  private codePushOptions: CodePushOptions = {
    checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
    updateDialog: {
      title: 'Update Available',
      optionalUpdateMessage: 'An update is available. Would you like to install it?',
      optionalIgnoreButtonLabel: 'Later',
      optionalInstallButtonLabel: 'Install',
      mandatoryUpdateMessage: 'A mandatory update is available. The app will restart after installation.',
      mandatoryContinueButtonLabel: 'Continue'
    },
    installMode: CodePush.InstallMode.ON_NEXT_RESTART
  };
  
  async checkForUpdates(): Promise<CodePushRemotePackage | null> {
    try {
      return await CodePush.checkForUpdate();
    } catch (error) {
      console.error('CodePush check failed:', error);
      return null;
    }
  }
  
  async downloadUpdate(
    remotePackage: CodePushRemotePackage,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<CodePushLocalPackage> {
    return await remotePackage.download(onProgress);
  }
  
  async installUpdate(localPackage: CodePushLocalPackage, installMode?: InstallMode): Promise<void> {
    await localPackage.install(installMode || this.codePushOptions.installMode);
  }
  
  async getUpdateMetadata(): Promise<CodePushLocalPackage | null> {
    return await CodePush.getUpdateMetadata();
  }
  
  async sync(): Promise<CodePushSyncStatus> {
    return await CodePush.sync(
      this.codePushOptions,
      this.handleSyncStatus.bind(this),
      this.handleDownloadProgress.bind(this)
    );
  }
  
  private handleSyncStatus(status: CodePushSyncStatus) {
    switch (status) {
      case CodePush.SyncStatus.CHECKING_FOR_UPDATE:
        console.log('Checking for updates...');
        break;
      case CodePush.SyncStatus.DOWNLOADING_PACKAGE:
        console.log('Downloading update...');
        break;
      case CodePush.SyncStatus.INSTALLING_UPDATE:
        console.log('Installing update...');
        break;
      case CodePush.SyncStatus.UP_TO_DATE:
        console.log('App is up to date');
        break;
      case CodePush.SyncStatus.UPDATE_INSTALLED:
        console.log('Update installed successfully');
        break;
    }
  }
  
  private handleDownloadProgress(progress: DownloadProgress) {
    const percentage = (progress.receivedBytes / progress.totalBytes) * 100;
    console.log(`Download progress: ${percentage}%`);
  }
}

// Higher-Order Component for CodePush
const CodePushWrapper = (WrappedComponent: React.ComponentType) => {
  return CodePush({
    checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
    installMode: CodePush.InstallMode.ON_NEXT_RESTART,
    mandatoryInstallMode: CodePush.InstallMode.IMMEDIATE,
    updateDialog: {
      title: 'Update Available',
      optionalUpdateMessage: 'An update is available. Install now?',
      optionalIgnoreButtonLabel: 'Later',
      optionalInstallButtonLabel: 'Install'
    }
  })(WrappedComponent);
};

// Usage in App.js
const App: React.FC = () => {
  useEffect(() => {
    const updateManager = new ReactNativeUpdateManager();
    updateManager.sync();
  }, []);
  
  return (
    <NavigationContainer>
      {/* Your app content */}
    </NavigationContainer>
  );
};

export default CodePushWrapper(App);
```

### Expo Updates Implementation

```typescript
// Expo Updates Implementation
import * as Updates from 'expo-updates';

class ExpoUpdateManager {
  async checkForUpdates(): Promise<Updates.UpdateCheckResult> {
    if (!Updates.isEnabled) {
      throw new Error('Updates are not enabled in this build');
    }
    
    return await Updates.checkForUpdateAsync();
  }
  
  async downloadUpdate(): Promise<Updates.UpdateFetchResult> {
    return await Updates.fetchUpdateAsync();
  }
  
  async reloadApp(): Promise<void> {
    await Updates.reloadAsync();
  }
  
  getCurrentVersion(): string | null {
    return Updates.updateId || Updates.releaseChannel;
  }
  
  isUpdateAvailable(): boolean {
    return Updates.isUpdateAvailable;
  }
  
  async handleUpdate(): Promise<void> {
    try {
      const update = await this.checkForUpdates();
      
      if (update.isAvailable) {
        console.log('Update available, downloading...');
        const fetchResult = await this.downloadUpdate();
        
        if (fetchResult.isNew) {
          console.log('New update downloaded, reloading app...');
          await this.reloadApp();
        }
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  }
}

// React Hook for Expo Updates
export const useExpoUpdates = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const updateManager = useMemo(() => new ExpoUpdateManager(), []);
  
  const checkForUpdates = useCallback(async () => {
    try {
      const result = await updateManager.checkForUpdates();
      setUpdateAvailable(result.isAvailable);
    } catch (err) {
      setError(err.message);
    }
  }, [updateManager]);
  
  const downloadAndInstall = useCallback(async () => {
    try {
      setDownloading(true);
      setError(null);
      
      const fetchResult = await updateManager.downloadUpdate();
      
      if (fetchResult.isNew) {
        await updateManager.reloadApp();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }, [updateManager]);
  
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);
  
  return {
    updateAvailable,
    downloading,
    error,
    checkForUpdates,
    downloadAndInstall
  };
};
```

### Cordova/PhoneGap Implementation

```typescript
// Cordova Hot Code Push Implementation
declare var chcp: any;

class CordovaUpdateManager {
  private isInitialized = false;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      document.addEventListener('deviceready', () => {
        if (typeof chcp !== 'undefined') {
          this.setupEventListeners();
          this.isInitialized = true;
          resolve();
        } else {
          reject(new Error('Hot Code Push plugin not available'));
        }
      });
    });
  }
  
  private setupEventListeners(): void {
    document.addEventListener('chcp_updateIsReadyToInstall', this.handleUpdateReady.bind(this));
    document.addEventListener('chcp_updateLoadFailed', this.handleUpdateFailed.bind(this));
    document.addEventListener('chcp_nothingToUpdate', this.handleNoUpdate.bind(this));
    document.addEventListener('chcp_updateInstalled', this.handleUpdateInstalled.bind(this));
  }
  
  async checkForUpdates(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Update manager not initialized');
    }
    
    chcp.fetchUpdate((error: any) => {
      if (error) {
        console.error('Update check failed:', error);
      }
    });
  }
  
  async installUpdate(): Promise<void> {
    chcp.installUpdate((error: any) => {
      if (error) {
        console.error('Update installation failed:', error);
      }
    });
  }
  
  private handleUpdateReady(): void {
    console.log('Update is ready to install');
    
    // Show user dialog
    navigator.notification.confirm(
      'A new update is available. Install now?',
      (buttonIndex: number) => {
        if (buttonIndex === 1) {
          this.installUpdate();
        }
      },
      'Update Available',
      ['Install', 'Later']
    );
  }
  
  private handleUpdateFailed(event: any): void {
    console.error('Update failed:', event.detail.error);
  }
  
  private handleNoUpdate(): void {
    console.log('No updates available');
  }
  
  private handleUpdateInstalled(): void {
    console.log('Update installed successfully');
  }
}
```

### Flutter Implementation

```dart
// Flutter Hot Update Implementation
class FlutterUpdateManager {
  static const MethodChannel _channel = MethodChannel('flutter_hot_update');
  
  static Future<UpdateInfo?> checkForUpdates() async {
    try {
      final Map<String, dynamic>? result = 
          await _channel.invokeMethod('checkForUpdates');
      
      if (result != null) {
        return UpdateInfo.fromMap(result);
      }
      return null;
    } catch (e) {
      print('Error checking for updates: $e');
      return null;
    }
  }
  
  static Future<bool> downloadUpdate(
    String updateUrl,
    Function(double progress)? onProgress,
  ) async {
    try {
      final bool result = await _channel.invokeMethod('downloadUpdate', {
        'updateUrl': updateUrl,
      });
      
      return result;
    } catch (e) {
      print('Error downloading update: $e');
      return false;
    }
  }
  
  static Future<bool> installUpdate() async {
    try {
      final bool result = await _channel.invokeMethod('installUpdate');
      return result;
    } catch (e) {
      print('Error installing update: $e');
      return false;
    }
  }
  
  static Future<String?> getCurrentVersion() async {
    try {
      final String? version = await _channel.invokeMethod('getCurrentVersion');
      return version;
    } catch (e) {
      print('Error getting current version: $e');
      return null;
    }
  }
}

// Flutter Widget for Update Management
class UpdateWidget extends StatefulWidget {
  final Widget child;
  
  const UpdateWidget({Key? key, required this.child}) : super(key: key);
  
  @override
  _UpdateWidgetState createState() => _UpdateWidgetState();
}

class _UpdateWidgetState extends State<UpdateWidget> {
  bool _isChecking = false;
  bool _isDownloading = false;
  double _downloadProgress = 0.0;
  UpdateInfo? _availableUpdate;
  
  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }
  
  Future<void> _checkForUpdates() async {
    setState(() => _isChecking = true);
    
    final update = await FlutterUpdateManager.checkForUpdates();
    
    setState(() {
      _isChecking = false;
      _availableUpdate = update;
    });
    
    if (update != null && update.isMandatory) {
      _showUpdateDialog(mandatory: true);
    } else if (update != null) {
      _showUpdateDialog(mandatory: false);
    }
  }
  
  void _showUpdateDialog({required bool mandatory}) {
    showDialog(
      context: context,
      barrierDismissible: !mandatory,
      builder: (context) => AlertDialog(
        title: Text('Update Available'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_availableUpdate!.releaseNotes),
            if (_isDownloading) ...[
              SizedBox(height: 16),
              LinearProgressIndicator(value: _downloadProgress),
              Text('${(_downloadProgress * 100).toStringAsFixed(1)}%'),
            ],
          ],
        ),
        actions: [
          if (!mandatory && !_isDownloading)
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Later'),
            ),
          ElevatedButton(
            onPressed: _isDownloading ? null : _downloadAndInstall,
            child: Text(_isDownloading ? 'Downloading...' : 'Update'),
          ),
        ],
      ),
    );
  }
  
  Future<void> _downloadAndInstall() async {
    setState(() => _isDownloading = true);
    
    final success = await FlutterUpdateManager.downloadUpdate(
      _availableUpdate!.downloadUrl,
      (progress) => setState(() => _downloadProgress = progress),
    );
    
    if (success) {
      await FlutterUpdateManager.installUpdate();
    }
    
    setState(() => _isDownloading = false);
  }
  
  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

class UpdateInfo {
  final String version;
  final String downloadUrl;
  final String releaseNotes;
  final bool isMandatory;
  final int size;
  
  UpdateInfo({
    required this.version,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.isMandatory,
    required this.size,
  });
  
  factory UpdateInfo.fromMap(Map<String, dynamic> map) {
    return UpdateInfo(
      version: map['version'],
      downloadUrl: map['downloadUrl'],
      releaseNotes: map['releaseNotes'],
      isMandatory: map['isMandatory'] ?? false,
      size: map['size'] ?? 0,
    );
  }
}
```

## Backend Infrastructure

### Update Server Implementation

```typescript
// Update Server with Express.js
import express from 'express';
import AWS from 'aws-sdk';
import crypto from 'crypto';
import semver from 'semver';

interface UpdateRequest {
  platform: 'ios' | 'android';
  currentVersion: string;
  appVersion: string;
  deviceId: string;
  userId?: string;
}

interface UpdateResponse {
  updateAvailable: boolean;
  metadata?: UpdateMetadata;
  rolloutInfo?: RolloutInfo;
}

class UpdateServer {
  private s3: AWS.S3;
  private dynamoDB: AWS.DynamoDB.DocumentClient;
  
  constructor() {
    this.s3 = new AWS.S3();
    this.dynamoDB = new AWS.DynamoDB.DocumentClient();
  }
  
  async checkForUpdates(request: UpdateRequest): Promise<UpdateResponse> {
    try {
      // Get latest available version
      const latestVersion = await this.getLatestVersion(request.platform);
      
      if (!latestVersion || semver.lte(latestVersion.version, request.currentVersion)) {
        return { updateAvailable: false };
      }
      
      // Check rollout eligibility
      const rolloutInfo = await this.checkRolloutEligibility(
        request.deviceId,
        request.userId,
        latestVersion
      );
      
      if (!rolloutInfo.eligible) {
        return { updateAvailable: false, rolloutInfo };
      }
      
      // Generate signed URLs for download
      const bundleUrl = await this.generateSignedUrl(latestVersion.bundlePath);
      const assetsUrl = latestVersion.assetsPath 
        ? await this.generateSignedUrl(latestVersion.assetsPath)
        : undefined;
      
      const metadata: UpdateMetadata = {
        ...latestVersion,
        bundleUrl,
        assetsUrl
      };
      
      return { 
        updateAvailable: true, 
        metadata,
        rolloutInfo 
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }
  
  async publishUpdate(updateData: PublishUpdateRequest): Promise<void> {
    // Upload bundle to S3
    const bundleKey = `updates/${updateData.platform}/${updateData.version}/bundle.js`;
    await this.s3.upload({
      Bucket: process.env.UPDATES_BUCKET!,
      Key: bundleKey,
      Body: updateData.bundle,
      ContentType: 'application/javascript'
    }).promise();
    
    // Upload assets if provided
    let assetsKey;
    if (updateData.assets) {
      assetsKey = `updates/${updateData.platform}/${updateData.version}/assets.zip`;
      await this.s3.upload({
        Bucket: process.env.UPDATES_BUCKET!,
        Key: assetsKey,
        Body: updateData.assets,
        ContentType: 'application/zip'
      }).promise();
    }
    
    // Create signature
    const signature = this.createSignature(updateData.bundle);
    
    // Store metadata in DynamoDB
    await this.dynamoDB.put({
      TableName: 'Updates',
      Item: {
        platform: updateData.platform,
        version: updateData.version,
        bundlePath: bundleKey,
        assetsPath: assetsKey,
        checksum: crypto.createHash('sha256').update(updateData.bundle).digest('hex'),
        signature,
        releaseNotes: updateData.releaseNotes,
        isMandatory: updateData.isMandatory,
        rolloutPercentage: updateData.rolloutPercentage,
        minAppVersion: updateData.minAppVersion,
        maxAppVersion: updateData.maxAppVersion,
        createdAt: new Date().toISOString()
      }
    }).promise();
  }
  
  private async getLatestVersion(platform: string): Promise<any> {
    const result = await this.dynamoDB.query({
      TableName: 'Updates',
      KeyConditionExpression: 'platform = :platform',
      ExpressionAttributeValues: {
        ':platform': platform
      },
      ScanIndexForward: false,
      Limit: 1
    }).promise();
    
    return result.Items?.[0];
  }
  
  private async checkRolloutEligibility(
    deviceId: string,
    userId: string | undefined,
    version: any
  ): Promise<RolloutInfo> {
    const identifier = userId || deviceId;
    const hash = crypto.createHash('md5').update(identifier).digest('hex');
    const hashValue = parseInt(hash.substr(0, 8), 16) % 100;
    
    const eligible = hashValue < version.rolloutPercentage;
    
    return {
      eligible,
      rolloutPercentage: version.rolloutPercentage,
      userHash: hashValue
    };
  }
  
  private async generateSignedUrl(key: string): Promise<string> {
    return this.s3.getSignedUrl('getObject', {
      Bucket: process.env.UPDATES_BUCKET!,
      Key: key,
      Expires: 3600 // 1 hour
    });
  }
  
  private createSignature(content: Buffer): string {
    const privateKey = process.env.SIGNING_PRIVATE_KEY!;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(content);
    return sign.sign(privateKey, 'base64');
  }
}

// Express routes
const app = express();
const updateServer = new UpdateServer();

app.post('/api/updates/check', async (req, res) => {
  try {
    const result = await updateServer.checkForUpdates(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/updates/publish', async (req, res) => {
  try {
    await updateServer.publishUpdate(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### CDN Configuration

```yaml
# CloudFront Distribution Configuration
Resources:
  UpdatesCDN:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - DomainName: !GetAtt UpdatesBucket.DomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${OriginAccessIdentity}'
        Enabled: true
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS]
          CachedMethods: [GET, HEAD]
          Compress: true
          TTL:
            DefaultTTL: 86400
            MaxTTL: 31536000
        CacheBehaviors:
          - PathPattern: '/updates/*'
            TargetOriginId: S3Origin
            ViewerProtocolPolicy: https-only
            CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad # CachingOptimized
        PriceClass: PriceClass_100
        ViewerCertificate:
          AcmCertificateArn: !Ref SSLCertificate
          SslSupportMethod: sni-only
```

## Security & Validation

### 1. Code Signing and Verification

```typescript
// Update signature verification
import crypto from 'crypto';

class UpdateValidator {
  private publicKey: string;
  
  constructor(publicKey: string) {
    this.publicKey = publicKey;
  }
  
  async verifyUpdate(bundlePath: string, metadata: UpdateMetadata): Promise<boolean> {
    try {
      // Verify file integrity
      const bundleContent = await this.readFile(bundlePath);
      const actualChecksum = crypto.createHash('sha256').update(bundleContent).digest('hex');
      
      if (actualChecksum !== metadata.checksum) {
        throw new Error('Checksum verification failed');
      }
      
      // Verify digital signature
      const isSignatureValid = this.verifySignature(bundleContent, metadata.signature);
      if (!isSignatureValid) {
        throw new Error('Signature verification failed');
      }
      
      // Additional security checks
      await this.performSecurityScan(bundleContent);
      
      return true;
    } catch (error) {
      console.error('Update validation failed:', error);
      return false;
    }
  }
  
  private verifySignature(content: Buffer, signature: string): boolean {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(content);
    return verify.verify(this.publicKey, signature, 'base64');
  }
  
  private async performSecurityScan(content: Buffer): Promise<void> {
    // Scan for malicious patterns
    const contentStr = content.toString();
    
    const maliciousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /XMLHttpRequest/,
      /__dirname/,
      /__filename/,
      /require\s*\(/
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(contentStr)) {
        throw new Error(`Malicious pattern detected: ${pattern}`);
      }
    }
  }
}
```

### 2. Runtime Protection

```typescript
// Runtime security monitoring
class SecurityMonitor {
  private allowedOrigins: string[];
  private maxUpdateSize: number;
  
  constructor(config: SecurityConfig) {
    this.allowedOrigins = config.allowedOrigins;
    this.maxUpdateSize = config.maxUpdateSize;
  }
  
  validateUpdateRequest(url: string, size: number): boolean {
    // Check origin
    const origin = new URL(url).origin;
    if (!this.allowedOrigins.includes(origin)) {
      throw new Error(`Unauthorized update origin: ${origin}`);
    }
    
    // Check size
    if (size > this.maxUpdateSize) {
      throw new Error(`Update size exceeds limit: ${size} > ${this.maxUpdateSize}`);
    }
    
    return true;
  }
  
  async monitorUpdateInstallation(updatePath: string): Promise<void> {
    // Monitor file system changes
    const watcher = require('fs').watch(updatePath, (eventType, filename) => {
      console.log(`File system event: ${eventType} - ${filename}`);
      
      // Log suspicious activities
      if (this.isSuspiciousActivity(eventType, filename)) {
        this.alertSecurity(`Suspicious activity detected: ${eventType} ${filename}`);
      }
    });
    
    // Cleanup after installation
    setTimeout(() => watcher.close(), 60000);
  }
  
  private isSuspiciousActivity(eventType: string, filename: string): boolean {
    const suspiciousFiles = ['.env', 'config.json', 'secrets.txt'];
    return suspiciousFiles.some(file => filename.includes(file));
  }
  
  private alertSecurity(message: string): void {
    console.error(`[SECURITY ALERT] ${message}`);
    
    // Send to monitoring service
    fetch('/api/security/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        timestamp: new Date().toISOString(),
        severity: 'high'
      })
    });
  }
}
```

## Best Practices

### 1. Rollback Strategy

```typescript
// Automatic rollback implementation
class RollbackManager {
  private healthCheckInterval: number = 30000; // 30 seconds
  private maxFailures: number = 3;
  private currentFailures: number = 0;
  
  async installWithRollback(update: StoredUpdate): Promise<void> {
    // Create checkpoint before installation
    const checkpoint = await this.createCheckpoint();
    
    try {
      // Install update
      await this.installUpdate(update);
      
      // Start health monitoring
      await this.startHealthMonitoring();
      
    } catch (error) {
      // Immediate rollback on installation failure
      await this.rollbackToCheckpoint(checkpoint);
      throw error;
    }
  }
  
  private async startHealthMonitoring(): Promise<void> {
    const healthCheck = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck();
        
        if (!isHealthy) {
          this.currentFailures++;
          
          if (this.currentFailures >= this.maxFailures) {
            clearInterval(healthCheck);
            await this.performEmergencyRollback();
          }
        } else {
          // Reset failure count on successful health check
          this.currentFailures = 0;
        }
      } catch (error) {
        console.error('Health check failed:', error);
        this.currentFailures++;
      }
    }, this.healthCheckInterval);
    
    // Stop monitoring after 10 minutes
    setTimeout(() => clearInterval(healthCheck), 600000);
  }
  
  private async performHealthCheck(): Promise<boolean> {
    try {
      // Check app responsiveness
      const startTime = Date.now();
      await fetch('/api/health', { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 10000) {
        return false;
      }
      
      // Check error rates
      const errorRate = await this.getErrorRate();
      if (errorRate > 0.05) { // 5% error rate threshold
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  private async performEmergencyRollback(): Promise<void> {
    console.log('Emergency rollback triggered');
    
    const lastKnownGood = await this.getLastKnownGoodVersion();
    if (lastKnownGood) {
      await this.rollbackToVersion(lastKnownGood);
    }
  }
}
```

### 2. Performance Monitoring

```typescript
// Update performance tracking
class UpdatePerformanceMonitor {
  private metrics: UpdateMetrics = {
    downloadTime: 0,
    installTime: 0,
    verificationTime: 0,
    totalUpdateTime: 0,
    bundleSize: 0,
    compressionRatio: 0
  };
  
  startTracking(): void {
    this.metrics.startTime = Date.now();
  }
  
  trackDownload(size: number, compressedSize: number): void {
    this.metrics.downloadTime = Date.now() - (this.metrics.downloadStartTime || 0);
    this.metrics.bundleSize = size;
    this.metrics.compressionRatio = compressedSize / size;
  }
  
  trackInstallation(): void {
    this.metrics.installTime = Date.now() - (this.metrics.installStartTime || 0);
  }
  
  finishTracking(): UpdateMetrics {
    this.metrics.totalUpdateTime = Date.now() - this.metrics.startTime;
    
    // Send metrics to analytics
    this.sendMetrics(this.metrics);
    
    return this.metrics;
  }
  
  private sendMetrics(metrics: UpdateMetrics): void {
    // Send to analytics service
    fetch('/api/analytics/update-performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    });
  }
}
```

### 3. User Experience Guidelines

- **Non-intrusive updates**: Check for updates in background
- **Progress indication**: Show download/installation progress
- **Offline handling**: Queue updates when offline
- **Battery awareness**: Defer non-critical updates on low battery
- **Network awareness**: Use WiFi for large updates
- **Graceful failures**: Handle update failures gracefully

### 4. Testing Strategy

```typescript
// Update testing framework
class UpdateTester {
  async testUpdate(updatePackage: UpdatePackage): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test update integrity
    results.push(await this.testIntegrity(updatePackage));
    
    // Test backward compatibility
    results.push(await this.testBackwardCompatibility(updatePackage));
    
    // Test performance impact
    results.push(await this.testPerformanceImpact(updatePackage));
    
    // Test rollback capability
    results.push(await this.testRollback(updatePackage));
    
    return results;
  }
  
  private async testIntegrity(updatePackage: UpdatePackage): Promise<TestResult> {
    try {
      const validator = new UpdateValidator(this.publicKey);
      const isValid = await validator.verifyUpdate(updatePackage.path, updatePackage.metadata);
      
      return {
        test: 'integrity',
        passed: isValid,
        message: isValid ? 'Update integrity verified' : 'Integrity check failed'
      };
    } catch (error) {
      return {
        test: 'integrity',
        passed: false,
        message: error.message
      };
    }
  }
}
```

Hot updates and code push capabilities provide significant value for mobile applications by enabling rapid bug fixes, feature updates, and A/B testing without app store dependencies. However, they require careful consideration of security, performance, and user experience to implement successfully.
