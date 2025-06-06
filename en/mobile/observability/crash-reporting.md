# Crash Reporting Systems

Comprehensive crash reporting and error tracking systems for mobile applications across all platforms.

## Overview

Crash reporting systems are essential for maintaining application stability and user experience. They provide real-time insights into application failures, enabling rapid identification and resolution of critical issues.

## Core Components

### 1. **Crash Detection & Collection**
- **Automatic crash capture**
- **Symbol resolution**
- **Stack trace analysis**
- **Device context collection**

### 2. **Error Categorization**
- **Crash grouping algorithms**
- **Severity classification**
- **Impact assessment**
- **Root cause analysis**

### 3. **Real-time Alerts**
- **Threshold-based notifications**
- **Critical crash alerts**
- **Team notification routing**
- **Escalation workflows**

## Platform Implementation

### Android Crash Reporting

#### Firebase Crashlytics Integration
```kotlin
// Build configuration
dependencies {
    implementation 'com.google.firebase:firebase-crashlytics:18.4.3'
    implementation 'com.google.firebase:firebase-analytics:21.3.0'
}

// Application class setup
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize Crashlytics
        FirebaseCrashlytics.getInstance().apply {
            setCrashlyticsCollectionEnabled(true)
            setUserId(getCurrentUserId())
        }
        
        // Setup custom crash handler
        setupCustomExceptionHandler()
    }
    
    private fun setupCustomExceptionHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        
        Thread.setDefaultUncaughtExceptionHandler { thread, exception ->
            // Log additional context before crash
            FirebaseCrashlytics.getInstance().apply {
                setCustomKey("thread_name", thread.name)
                setCustomKey("available_memory", getAvailableMemory())
                setCustomKey("battery_level", getBatteryLevel())
                setCustomKey("network_state", getNetworkState())
                
                recordException(exception)
            }
            
            // Call default handler
            defaultHandler?.uncaughtException(thread, exception)
        }
    }
}

// Custom crash reporting service
class CrashReportingService {
    companion object {
        fun logNonFatalException(exception: Throwable) {
            FirebaseCrashlytics.getInstance().recordException(exception)
        }
        
        fun setUserContext(userId: String, userType: String) {
            FirebaseCrashlytics.getInstance().apply {
                setUserId(userId)
                setCustomKey("user_type", userType)
                setCustomKey("session_start", System.currentTimeMillis())
            }
        }
        
        fun addBreadcrumb(message: String, category: String = "general") {
            FirebaseCrashlytics.getInstance().log("[$category] $message")
        }
        
        fun recordCustomCrash(message: String, stackTrace: String) {
            val exception = CustomException(message, stackTrace)
            FirebaseCrashlytics.getInstance().recordException(exception)
        }
    }
}

// Custom exception class
class CustomException(
    message: String,
    private val customStackTrace: String
) : Exception(message) {
    
    override fun getStackTrace(): Array<StackTraceElement> {
        return customStackTrace.split("\n").mapNotNull { line ->
            parseStackTraceLine(line)
        }.toTypedArray()
    }
    
    private fun parseStackTraceLine(line: String): StackTraceElement? {
        // Parse custom stack trace format
        val regex = """at (.+)\.(.+)\((.+):(\d+)\)""".toRegex()
        val matchResult = regex.find(line.trim())
        
        return matchResult?.let { match ->
            val (className, methodName, fileName, lineNumber) = match.destructured
            StackTraceElement(className, methodName, fileName, lineNumber.toInt())
        }
    }
}
```

#### Native Crash Handling (NDK)
```cpp
// native-crash-handler.cpp
#include <jni.h>
#include <signal.h>
#include <unistd.h>
#include <android/log.h>

static const char* TAG = "NativeCrashHandler";

// Signal handler for native crashes
void native_crash_handler(int signal, siginfo_t* info, void* context) {
    __android_log_print(ANDROID_LOG_ERROR, TAG, "Native crash detected: signal %d", signal);
    
    // Collect crash information
    char crash_info[1024];
    snprintf(crash_info, sizeof(crash_info), 
             "Signal: %d, Address: %p, PID: %d", 
             signal, info->si_addr, getpid());
    
    // Send to crash reporting service
    send_native_crash_report(crash_info);
    
    // Call default handler
    abort();
}

// JNI setup function
extern "C" JNIEXPORT void JNICALL
Java_com_example_CrashHandler_setupNativeCrashHandler(JNIEnv* env, jobject instance) {
    struct sigaction sa;
    sa.sa_sigaction = native_crash_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_SIGINFO;
    
    // Register for common crash signals
    sigaction(SIGSEGV, &sa, nullptr);  // Segmentation fault
    sigaction(SIGBUS, &sa, nullptr);   // Bus error
    sigaction(SIGFPE, &sa, nullptr);   // Floating point exception
    sigaction(SIGILL, &sa, nullptr);   // Illegal instruction
}
```

### iOS Crash Reporting

#### Firebase Crashlytics Integration
```swift
// AppDelegate.swift
import UIKit
import FirebaseCore
import FirebaseCrashlytics

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // Initialize Firebase
        FirebaseApp.configure()
        
        // Setup Crashlytics
        setupCrashlytics()
        
        // Setup custom crash handling
        setupCustomCrashHandler()
        
        return true
    }
    
    private func setupCrashlytics() {
        Crashlytics.crashlytics().setUserId(UserManager.shared.currentUserId)
        
        // Set custom keys
        Crashlytics.crashlytics().setCustomValue(
            UIDevice.current.systemVersion, 
            forKey: "ios_version"
        )
        Crashlytics.crashlytics().setCustomValue(
            UIDevice.current.model, 
            forKey: "device_model"
        )
        Crashlytics.crashlytics().setCustomValue(
            Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown",
            forKey: "build_number"
        )
    }
    
    private func setupCustomCrashHandler() {
        NSSetUncaughtExceptionHandler { exception in
            // Log additional context
            Crashlytics.crashlytics().setCustomValue(
                ProcessInfo.processInfo.physicalMemory,
                forKey: "physical_memory"
            )
            
            Crashlytics.crashlytics().setCustomValue(
                UIDevice.current.batteryLevel,
                forKey: "battery_level"
            )
            
            // Record the exception
            Crashlytics.crashlytics().record(error: exception)
        }
        
        // Setup signal handler for low-level crashes
        setupSignalHandler()
    }
    
    private func setupSignalHandler() {
        signal(SIGABRT) { signal in
            CrashReportingService.recordSignalCrash(signal: signal)
        }
        
        signal(SIGILL) { signal in
            CrashReportingService.recordSignalCrash(signal: signal)
        }
        
        signal(SIGSEGV) { signal in
            CrashReportingService.recordSignalCrash(signal: signal)
        }
    }
}

// Crash reporting service
class CrashReportingService {
    
    static func recordNonFatalError(_ error: Error) {
        Crashlytics.crashlytics().record(error: error)
    }
    
    static func addBreadcrumb(_ message: String, category: String = "general") {
        Crashlytics.crashlytics().log("\(category): \(message)")
    }
    
    static func setUserContext(userId: String, userType: String) {
        Crashlytics.crashlytics().setUserId(userId)
        Crashlytics.crashlytics().setCustomValue(userType, forKey: "user_type")
        Crashlytics.crashlytics().setCustomValue(Date().timeIntervalSince1970, forKey: "session_start")
    }
    
    static func recordCustomCrash(message: String, userInfo: [String: Any] = [:]) {
        let error = NSError(
            domain: "CustomCrashDomain",
            code: 1001,
            userInfo: [
                NSLocalizedDescriptionKey: message,
                "custom_info": userInfo
            ]
        )
        
        Crashlytics.crashlytics().record(error: error)
    }
    
    static func recordSignalCrash(signal: Int32) {
        let signalName = signalName(for: signal)
        let error = NSError(
            domain: "SignalCrashDomain",
            code: Int(signal),
            userInfo: [
                NSLocalizedDescriptionKey: "Signal crash: \(signalName)",
                "signal_number": signal,
                "timestamp": Date().timeIntervalSince1970
            ]
        )
        
        Crashlytics.crashlytics().record(error: error)
    }
    
    private static func signalName(for signal: Int32) -> String {
        switch signal {
        case SIGABRT: return "SIGABRT"
        case SIGILL: return "SIGILL"
        case SIGSEGV: return "SIGSEGV"
        case SIGFPE: return "SIGFPE"
        case SIGBUS: return "SIGBUS"
        default: return "UNKNOWN"
        }
    }
}
```

### React Native Crash Reporting

#### Flipper Integration
```javascript
// crashReporting.js
import crashlytics from '@react-native-firebase/crashlytics';
import { NativeModules, Platform } from 'react-native';

class CrashReportingService {
  constructor() {
    this.initialized = false;
    this.sessionId = this.generateSessionId();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Enable crashlytics collection
      await crashlytics().setCrashlyticsCollectionEnabled(true);
      
      // Set session information
      await crashlytics().setAttributes({
        session_id: this.sessionId,
        platform: Platform.OS,
        platform_version: Platform.Version,
        app_version: this.getAppVersion(),
      });

      this.setupErrorHandlers();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize crash reporting:', error);
    }
  }

  setupErrorHandlers() {
    // Global error handler
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.recordError(error, { isFatal, context: 'global_handler' });
      originalHandler(error, isFatal);
    });

    // Unhandled promise rejection
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id, error) => {
        this.recordError(error, { 
          context: 'unhandled_promise',
          promise_id: id 
        });
      },
    });

    // Network error tracking
    this.setupNetworkErrorTracking();
  }

  setupNetworkErrorTracking() {
    const originalFetch = global.fetch;
    
    global.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          this.recordNetworkError(args[0], response.status, response.statusText);
        }
        
        return response;
      } catch (error) {
        this.recordNetworkError(args[0], 0, error.message);
        throw error;
      }
    };
  }

  async recordError(error, additionalInfo = {}) {
    try {
      // Set additional context
      await crashlytics().setAttributes({
        error_timestamp: Date.now(),
        memory_usage: await this.getMemoryUsage(),
        ...additionalInfo,
      });

      // Record the error
      await crashlytics().recordError(error);
    } catch (reportingError) {
      console.error('Failed to record error:', reportingError);
    }
  }

  async recordNetworkError(url, status, message) {
    const error = new Error(`Network Error: ${status} - ${message}`);
    error.name = 'NetworkError';
    
    await this.recordError(error, {
      network_url: url,
      network_status: status,
      network_message: message,
    });
  }

  async addBreadcrumb(message, category = 'general', data = {}) {
    await crashlytics().log(`[${category}] ${message}`);
    
    await crashlytics().setAttributes({
      [`breadcrumb_${Date.now()}`]: JSON.stringify({
        message,
        category,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  async setUserContext(userId, userType, additionalData = {}) {
    await crashlytics().setUserId(userId);
    
    await crashlytics().setAttributes({
      user_type: userType,
      session_start: Date.now(),
      ...additionalData,
    });
  }

  async getMemoryUsage() {
    try {
      if (Platform.OS === 'android') {
        return await NativeModules.MemoryInfo.getMemoryUsage();
      } else {
        return await NativeModules.MemoryInfo.getMemoryUsage();
      }
    } catch (error) {
      return { error: 'Unable to get memory usage' };
    }
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getAppVersion() {
    try {
      const { version } = require('../package.json');
      return version;
    } catch {
      return 'unknown';
    }
  }
}

// Export singleton instance
export default new CrashReportingService();

// Usage example
import crashReporting from './crashReporting';

// Initialize in App.js
export default function App() {
  useEffect(() => {
    crashReporting.initialize();
  }, []);

  // ... rest of component
}

// Usage in components
const handleUserAction = async () => {
  try {
    await crashReporting.addBreadcrumb('User clicked submit button', 'user_action');
    await performAction();
  } catch (error) {
    await crashReporting.recordError(error, { context: 'user_action' });
  }
};
```

### Flutter Crash Reporting

#### Firebase Crashlytics Integration
```dart
// crash_reporting_service.dart
import 'dart:async';
import 'dart:isolate';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class CrashReportingService {
  static final CrashReportingService _instance = CrashReportingService._internal();
  factory CrashReportingService() => _instance;
  CrashReportingService._internal();

  bool _initialized = false;
  String? _sessionId;

  Future<void> initialize() async {
    if (_initialized) return;

    try {
      // Set up Crashlytics
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
      
      _sessionId = _generateSessionId();
      
      // Set initial custom keys
      await _setInitialContext();
      
      // Setup error handlers
      _setupErrorHandlers();
      
      _initialized = true;
    } catch (error) {
      debugPrint('Failed to initialize crash reporting: $error');
    }
  }

  void _setupErrorHandlers() {
    // Flutter framework errors
    FlutterError.onError = (FlutterErrorDetails details) {
      FirebaseCrashlytics.instance.recordFlutterFatalError(details);
    };

    // Async errors
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };

    // Isolate errors
    Isolate.current.addErrorListener(RawReceivePort((pair) async {
      final List<dynamic> errorAndStacktrace = pair;
      await FirebaseCrashlytics.instance.recordError(
        errorAndStacktrace.first,
        errorAndStacktrace.last,
        fatal: true,
      );
    }).sendPort);
  }

  Future<void> _setInitialContext() async {
    await FirebaseCrashlytics.instance.setCustomKey('session_id', _sessionId!);
    await FirebaseCrashlytics.instance.setCustomKey('session_start', DateTime.now().millisecondsSinceEpoch);
    await FirebaseCrashlytics.instance.setCustomKey('app_version', await _getAppVersion());
    await FirebaseCrashlytics.instance.setCustomKey('platform', defaultTargetPlatform.name);
  }

  Future<void> recordError(
    dynamic error, 
    StackTrace? stackTrace, {
    bool fatal = false,
    Map<String, dynamic>? additionalData,
  }) async {
    try {
      // Add additional context
      if (additionalData != null) {
        for (final entry in additionalData.entries) {
          await FirebaseCrashlytics.instance.setCustomKey(entry.key, entry.value);
        }
      }

      // Add memory information
      await _addMemoryContext();

      // Record the error
      await FirebaseCrashlytics.instance.recordError(
        error,
        stackTrace,
        fatal: fatal,
      );
    } catch (reportingError) {
      debugPrint('Failed to record error: $reportingError');
    }
  }

  Future<void> addBreadcrumb(String message, {
    String category = 'general',
    Map<String, dynamic>? data,
  }) async {
    final breadcrumb = {
      'message': message,
      'category': category,
      'timestamp': DateTime.now().toIso8601String(),
      'data': data ?? {},
    };

    await FirebaseCrashlytics.instance.log('[$category] $message');
    await FirebaseCrashlytics.instance.setCustomKey(
      'breadcrumb_${DateTime.now().millisecondsSinceEpoch}',
      breadcrumb.toString(),
    );
  }

  Future<void> setUserContext(String userId, {
    String? userType,
    Map<String, dynamic>? additionalData,
  }) async {
    await FirebaseCrashlytics.instance.setUserIdentifier(userId);
    
    if (userType != null) {
      await FirebaseCrashlytics.instance.setCustomKey('user_type', userType);
    }
    
    if (additionalData != null) {
      for (final entry in additionalData.entries) {
        await FirebaseCrashlytics.instance.setCustomKey(entry.key, entry.value);
      }
    }
  }

  Future<void> recordNetworkError(String url, int statusCode, String message) async {
    final error = NetworkException(
      message: 'Network Error: $statusCode - $message',
      url: url,
      statusCode: statusCode,
    );

    await recordError(
      error,
      StackTrace.current,
      additionalData: {
        'network_url': url,
        'network_status': statusCode,
        'network_message': message,
        'error_type': 'network',
      },
    );
  }

  Future<void> _addMemoryContext() async {
    try {
      // Add memory usage information if available
      await FirebaseCrashlytics.instance.setCustomKey(
        'memory_timestamp',
        DateTime.now().millisecondsSinceEpoch,
      );
    } catch (error) {
      debugPrint('Failed to add memory context: $error');
    }
  }

  String _generateSessionId() {
    return '${DateTime.now().millisecondsSinceEpoch}-${_generateRandomString(8)}';
  }

  String _generateRandomString(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return List.generate(length, (index) => chars[DateTime.now().millisecond % chars.length]).join();
  }

  Future<String> _getAppVersion() async {
    try {
      final packageInfo = await _getPackageInfo();
      return packageInfo['version'] ?? 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  Future<Map<String, dynamic>> _getPackageInfo() async {
    // Platform-specific implementation would go here
    return {'version': '1.0.0'}; // Placeholder
  }
}

// Custom exception classes
class NetworkException implements Exception {
  final String message;
  final String url;
  final int statusCode;

  NetworkException({
    required this.message,
    required this.url,
    required this.statusCode,
  });

  @override
  String toString() => 'NetworkException: $message (URL: $url, Status: $statusCode)';
}

class CustomCrashException implements Exception {
  final String message;
  final Map<String, dynamic> context;

  CustomCrashException({
    required this.message,
    required this.context,
  });

  @override
  String toString() => 'CustomCrashException: $message (Context: $context)';
}

// Usage example
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize crash reporting
  await CrashReportingService().initialize();
  
  runApp(MyApp());
}

// Usage in widgets
class MyWidget extends StatefulWidget {
  @override
  _MyWidgetState createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  final _crashReporting = CrashReportingService();

  Future<void> _handleUserAction() async {
    try {
      await _crashReporting.addBreadcrumb(
        'User initiated action',
        category: 'user_interaction',
        data: {'screen': 'home', 'action': 'button_tap'},
      );
      
      await _performAction();
    } catch (error, stackTrace) {
      await _crashReporting.recordError(
        error,
        stackTrace,
        additionalData: {
          'context': 'user_action',
          'screen': 'home',
        },
      );
    }
  }

  Future<void> _performAction() async {
    // Implementation here
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: _handleUserAction,
      child: Text('Perform Action'),
    );
  }
}
```

## Advanced Crash Analysis

### Crash Grouping and Deduplication

```typescript
// Advanced crash analysis service
interface CrashGroup {
  id: string;
  signature: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedUsers: number;
  platforms: string[];
  versions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface CrashReport {
  id: string;
  timestamp: Date;
  exception: string;
  stackTrace: string[];
  deviceInfo: DeviceInfo;
  appVersion: string;
  userId?: string;
  breadcrumbs: Breadcrumb[];
  customData: Record<string, any>;
}

class CrashAnalysisService {
  private crashGroups = new Map<string, CrashGroup>();
  
  generateCrashSignature(crash: CrashReport): string {
    // Create unique signature based on exception type and stack trace
    const exceptionType = crash.exception.split(':')[0];
    const topStackFrames = crash.stackTrace.slice(0, 3);
    
    return `${exceptionType}-${topStackFrames.join('|')}`;
  }
  
  categorizeCrash(crash: CrashReport): CrashGroup {
    const signature = this.generateCrashSignature(crash);
    
    let group = this.crashGroups.get(signature);
    if (!group) {
      group = {
        id: this.generateGroupId(),
        signature,
        count: 0,
        firstSeen: crash.timestamp,
        lastSeen: crash.timestamp,
        affectedUsers: 0,
        platforms: [],
        versions: [],
        severity: this.calculateSeverity(crash),
      };
      this.crashGroups.set(signature, group);
    }
    
    // Update group statistics
    group.count++;
    group.lastSeen = crash.timestamp;
    
    if (!group.platforms.includes(crash.deviceInfo.platform)) {
      group.platforms.push(crash.deviceInfo.platform);
    }
    
    if (!group.versions.includes(crash.appVersion)) {
      group.versions.push(crash.appVersion);
    }
    
    return group;
  }
  
  calculateSeverity(crash: CrashReport): 'low' | 'medium' | 'high' | 'critical' {
    // Analyze crash characteristics to determine severity
    const criticalExceptions = [
      'OutOfMemoryError',
      'StackOverflowError',
      'SecurityException',
      'NullPointerException'
    ];
    
    if (criticalExceptions.some(ex => crash.exception.includes(ex))) {
      return 'critical';
    }
    
    // Check if crash affects core functionality
    const coreModules = ['payment', 'auth', 'data'];
    const affectsCoreModule = crash.stackTrace.some(frame =>
      coreModules.some(module => frame.includes(module))
    );
    
    if (affectsCoreModule) {
      return 'high';
    }
    
    return 'medium';
  }
  
  private generateGroupId(): string {
    return `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Monitoring and Alerting

### Real-time Crash Monitoring

```python
# Python-based crash monitoring system
import asyncio
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class CrashAlert:
    crash_type: str
    count: int
    threshold: int
    time_window: int  # minutes
    affected_versions: List[str]
    platforms: List[str]
    severity: str

class CrashMonitoringService:
    def __init__(self):
        self.crash_counts: Dict[str, List[datetime]] = {}
        self.alert_thresholds = {
            'critical': {'count': 5, 'window': 5},    # 5 crashes in 5 minutes
            'high': {'count': 10, 'window': 15},      # 10 crashes in 15 minutes
            'medium': {'count': 25, 'window': 30},    # 25 crashes in 30 minutes
        }
        self.notification_channels = []
    
    async def process_crash(self, crash_data: dict):
        """Process incoming crash report and check for alert conditions"""
        crash_signature = self._generate_signature(crash_data)
        current_time = datetime.now()
        
        # Record crash occurrence
        if crash_signature not in self.crash_counts:
            self.crash_counts[crash_signature] = []
        
        self.crash_counts[crash_signature].append(current_time)
        
        # Clean old entries
        self._cleanup_old_entries(crash_signature, current_time)
        
        # Check for alert conditions
        await self._check_alert_conditions(crash_signature, crash_data)
    
    def _generate_signature(self, crash_data: dict) -> str:
        """Generate unique signature for crash grouping"""
        exception_type = crash_data.get('exception', '').split(':')[0]
        top_frames = crash_data.get('stackTrace', [])[:3]
        return f"{exception_type}-{'-'.join(top_frames)}"
    
    def _cleanup_old_entries(self, signature: str, current_time: datetime):
        """Remove crash entries older than maximum window"""
        max_window = max(config['window'] for config in self.alert_thresholds.values())
        cutoff_time = current_time - timedelta(minutes=max_window)
        
        self.crash_counts[signature] = [
            timestamp for timestamp in self.crash_counts[signature]
            if timestamp > cutoff_time
        ]
    
    async def _check_alert_conditions(self, signature: str, crash_data: dict):
        """Check if crash count exceeds any alert thresholds"""
        current_time = datetime.now()
        crash_times = self.crash_counts[signature]
        
        for severity, config in self.alert_thresholds.items():
            window_start = current_time - timedelta(minutes=config['window'])
            recent_crashes = [
                t for t in crash_times if t > window_start
            ]
            
            if len(recent_crashes) >= config['count']:
                alert = CrashAlert(
                    crash_type=signature,
                    count=len(recent_crashes),
                    threshold=config['count'],
                    time_window=config['window'],
                    affected_versions=[crash_data.get('appVersion', 'unknown')],
                    platforms=[crash_data.get('platform', 'unknown')],
                    severity=severity
                )
                
                await self._send_alert(alert)
    
    async def _send_alert(self, alert: CrashAlert):
        """Send alert to configured notification channels"""
        alert_message = self._format_alert_message(alert)
        
        for channel in self.notification_channels:
            try:
                await channel.send(alert_message)
            except Exception as e:
                print(f"Failed to send alert via {channel}: {e}")
    
    def _format_alert_message(self, alert: CrashAlert) -> str:
        """Format alert message for notifications"""
        return f"""
🚨 CRASH ALERT - {alert.severity.upper()}

Crash Type: {alert.crash_type}
Count: {alert.count} crashes in {alert.time_window} minutes
Threshold: {alert.threshold}
Platforms: {', '.join(alert.platforms)}
Versions: {', '.join(alert.affected_versions)}

Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """.strip()

# Notification channels
class SlackNotificationChannel:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def send(self, message: str):
        # Implementation for Slack notifications
        pass

class EmailNotificationChannel:
    def __init__(self, smtp_config: dict):
        self.smtp_config = smtp_config
    
    async def send(self, message: str):
        # Implementation for email notifications
        pass

class PagerDutyNotificationChannel:
    def __init__(self, integration_key: str):
        self.integration_key = integration_key
    
    async def send(self, message: str):
        # Implementation for PagerDuty alerts
        pass
```

## Analytics and Reporting

### Crash Analytics Dashboard

```javascript
// React-based crash analytics dashboard
import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';

const CrashAnalyticsDashboard = () => {
  const [crashData, setCrashData] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('count');

  useEffect(() => {
    fetchCrashAnalytics();
  }, [timeRange]);

  const fetchCrashAnalytics = async () => {
    try {
      const response = await fetch(`/api/crash-analytics?range=${timeRange}`);
      const data = await response.json();
      setCrashData(data);
    } catch (error) {
      console.error('Failed to fetch crash analytics:', error);
    }
  };

  const renderCrashTrend = () => {
    if (!crashData?.trend) return null;

    const chartData = {
      labels: crashData.trend.map(point => point.date),
      datasets: [
        {
          label: 'Total Crashes',
          data: crashData.trend.map(point => point.totalCrashes),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
        },
        {
          label: 'Unique Crashes',
          data: crashData.trend.map(point => point.uniqueCrashes),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
        },
      ],
    };

    return (
      <div className="chart-container">
        <h3>Crash Trend</h3>
        <Line data={chartData} />
      </div>
    );
  };

  const renderPlatformDistribution = () => {
    if (!crashData?.platformDistribution) return null;

    const chartData = {
      labels: Object.keys(crashData.platformDistribution),
      datasets: [
        {
          data: Object.values(crashData.platformDistribution),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
          ],
        },
      ],
    };

    return (
      <div className="chart-container">
        <h3>Platform Distribution</h3>
        <Pie data={chartData} />
      </div>
    );
  };

  const renderTopCrashes = () => {
    if (!crashData?.topCrashes) return null;

    return (
      <div className="table-container">
        <h3>Top Crashes</h3>
        <table>
          <thead>
            <tr>
              <th>Exception</th>
              <th>Count</th>
              <th>Affected Users</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {crashData.topCrashes.map((crash, index) => (
              <tr key={index}>
                <td>{crash.exception}</td>
                <td>{crash.count}</td>
                <td>{crash.affectedUsers}</td>
                <td>{new Date(crash.firstSeen).toLocaleDateString()}</td>
                <td>{new Date(crash.lastSeen).toLocaleDateString()}</td>
                <td>
                  <span className={`severity-badge ${crash.severity}`}>
                    {crash.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMetrics = () => {
    if (!crashData?.metrics) return null;

    return (
      <div className="metrics-grid">
        <div className="metric-card">
          <h4>Total Crashes</h4>
          <div className="metric-value">{crashData.metrics.totalCrashes}</div>
          <div className="metric-change">
            {crashData.metrics.crashChange > 0 ? '+' : ''}
            {crashData.metrics.crashChange}% vs last period
          </div>
        </div>
        
        <div className="metric-card">
          <h4>Crash-Free Sessions</h4>
          <div className="metric-value">
            {(crashData.metrics.crashFreeRate * 100).toFixed(2)}%
          </div>
          <div className="metric-change">
            {crashData.metrics.rateChange > 0 ? '+' : ''}
            {crashData.metrics.rateChange}% vs last period
          </div>
        </div>
        
        <div className="metric-card">
          <h4>Affected Users</h4>
          <div className="metric-value">{crashData.metrics.affectedUsers}</div>
          <div className="metric-change">
            {crashData.metrics.userChange > 0 ? '+' : ''}
            {crashData.metrics.userChange}% vs last period
          </div>
        </div>
        
        <div className="metric-card">
          <h4>Avg Time to Fix</h4>
          <div className="metric-value">{crashData.metrics.avgTimeToFix}h</div>
          <div className="metric-change">
            {crashData.metrics.fixTimeChange > 0 ? '+' : ''}
            {crashData.metrics.fixTimeChange}% vs last period
          </div>
        </div>
      </div>
    );
  };

  if (!crashData) {
    return <div className="loading">Loading crash analytics...</div>;
  }

  return (
    <div className="crash-analytics-dashboard">
      <div className="dashboard-header">
        <h1>Crash Analytics</h1>
        <div className="controls">
          <select 
            value={timeRange} 
            onChange={e => setTimeRange(e.target.value)}
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {renderMetrics()}
      
      <div className="dashboard-grid">
        {renderCrashTrend()}
        {renderPlatformDistribution()}
      </div>
      
      {renderTopCrashes()}
    </div>
  );
};

export default CrashAnalyticsDashboard;
```

## Best Practices

### 1. **Crash Prevention**
- Implement defensive programming practices
- Use proper error handling and validation
- Perform thorough testing across devices and scenarios
- Monitor memory usage and performance metrics

### 2. **Meaningful Error Context**
- Collect relevant device and app state information
- Include user actions leading to the crash
- Add custom breadcrumbs for debugging
- Maintain user privacy while collecting data

### 3. **Response and Resolution**
- Set up appropriate alert thresholds
- Establish incident response procedures
- Prioritize crashes based on impact and severity
- Track fix deployment and effectiveness

### 4. **Continuous Improvement**
- Analyze crash trends and patterns
- Identify common root causes
- Implement preventive measures
- Monitor crash-free session rates

## Conclusion

Comprehensive crash reporting systems are essential for maintaining mobile application stability and user satisfaction. By implementing robust crash detection, categorization, and analysis systems across all platforms, development teams can quickly identify and resolve critical issues, ultimately delivering more reliable applications to users.

The combination of automated crash collection, intelligent grouping, real-time alerting, and detailed analytics provides the foundation for effective incident management and continuous quality improvement in mobile applications.
