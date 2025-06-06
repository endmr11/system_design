# Performance Analytics

Comprehensive performance monitoring and analytics systems for mobile applications to track, analyze, and optimize user experience.

## Overview

Performance analytics provide deep insights into how mobile applications perform in real-world conditions, enabling data-driven optimization decisions and proactive performance management.

## Core Performance Metrics

### 1. **Application Performance**
- **App launch time** (cold start, warm start, hot start)
- **Screen transition time**
- **Frame rate and rendering performance**
- **Memory usage patterns**
- **CPU utilization**
- **Battery consumption**

### 2. **Network Performance**
- **API response times**
- **Request success/failure rates**
- **Network latency**
- **Bandwidth utilization**
- **Connection stability**

### 3. **User Experience Metrics**
- **Time to Interactive (TTI)**
- **First Meaningful Paint (FMP)**
- **User interaction responsiveness**
- **Feature adoption rates**
- **Session duration and engagement**

## Platform Implementation

### Android Performance Analytics

#### Firebase Performance Monitoring
```kotlin
// Build configuration
dependencies {
    implementation 'com.google.firebase:firebase-perf:20.4.1'
    implementation 'com.google.firebase:firebase-analytics:21.3.0'
}

// Performance monitoring service
class PerformanceMonitoringService {
    companion object {
        private val firebasePerformance = FirebasePerformance.getInstance()
        
        fun trackAppStart() {
            val trace = firebasePerformance.newTrace("app_start")
            trace.start()
            
            // Track different start phases
            val coldStartTrace = firebasePerformance.newTrace("cold_start")
            coldStartTrace.start()
            
            // Add custom attributes
            trace.putAttribute("device_model", Build.MODEL)
            trace.putAttribute("android_version", Build.VERSION.RELEASE)
            trace.putAttribute("app_version", getAppVersion())
            
            // Stop traces when app is ready
            GlobalScope.launch {
                delay(100) // Wait for app initialization
                coldStartTrace.stop()
                trace.stop()
            }
        }
        
        fun trackScreenLoad(screenName: String) {
            val trace = firebasePerformance.newTrace("screen_$screenName")
            trace.start()
            
            // Track specific screen loading phases
            val phases = mapOf(
                "data_fetch" to firebasePerformance.newTrace("${screenName}_data_fetch"),
                "ui_render" to firebasePerformance.newTrace("${screenName}_ui_render"),
                "user_ready" to firebasePerformance.newTrace("${screenName}_user_ready")
            )
            
            phases.values.forEach { it.start() }
            
            // Stop traces when screen is loaded
            PerformanceTracker.onScreenLoaded = {
                phases.values.forEach { it.stop() }
                trace.stop()
            }
        }
        
        fun trackCustomOperation(operationName: String, block: suspend () -> Unit) {
            val trace = firebasePerformance.newTrace(operationName)
            trace.start()
            
            val startTime = System.currentTimeMillis()
            
            GlobalScope.launch {
                try {
                    block()
                    trace.putAttribute("success", "true")
                } catch (e: Exception) {
                    trace.putAttribute("success", "false")
                    trace.putAttribute("error", e.message ?: "unknown")
                } finally {
                    val duration = System.currentTimeMillis() - startTime
                    trace.putMetric("duration_ms", duration)
                    trace.stop()
                }
            }
        }
        
        fun trackMemoryUsage() {
            val runtime = Runtime.getRuntime()
            val trace = firebasePerformance.newTrace("memory_usage")
            
            trace.putMetric("used_memory_mb", (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024)
            trace.putMetric("total_memory_mb", runtime.totalMemory() / 1024 / 1024)
            trace.putMetric("max_memory_mb", runtime.maxMemory() / 1024 / 1024)
            
            trace.start()
            trace.stop()
        }
    }
}

// Custom performance tracker
class PerformanceTracker {
    companion object {
        var onScreenLoaded: (() -> Unit)? = null
        private val performanceMetrics = mutableMapOf<String, MutableList<Long>>()
        
        fun startTracing(operationName: String): String {
            val traceId = "${operationName}_${System.currentTimeMillis()}"
            performanceMetrics[traceId] = mutableListOf(System.currentTimeMillis())
            return traceId
        }
        
        fun stopTracing(traceId: String) {
            performanceMetrics[traceId]?.add(System.currentTimeMillis())
        }
        
        fun getPerformanceReport(): Map<String, Any> {
            val report = mutableMapOf<String, Any>()
            
            performanceMetrics.forEach { (traceId, timestamps) ->
                if (timestamps.size >= 2) {
                    val duration = timestamps.last() - timestamps.first()
                    val operationName = traceId.substringBeforeLast("_")
                    
                    val operationMetrics = report.getOrPut(operationName) {
                        mutableMapOf<String, MutableList<Long>>()
                    } as MutableMap<String, MutableList<Long>>
                    
                    operationMetrics.getOrPut("durations") { mutableListOf() }.add(duration)
                }
            }
            
            // Calculate statistics
            report.forEach { (operation, metrics) ->
                val durations = (metrics as Map<String, List<Long>>)["durations"] ?: emptyList()
                if (durations.isNotEmpty()) {
                    val sorted = durations.sorted()
                    report[operation] = mapOf(
                        "count" to durations.size,
                        "avg" to durations.average(),
                        "min" to sorted.first(),
                        "max" to sorted.last(),
                        "p50" to sorted[sorted.size / 2],
                        "p90" to sorted[(sorted.size * 0.9).toInt()],
                        "p95" to sorted[(sorted.size * 0.95).toInt()]
                    )
                }
            }
            
            return report
        }
    }
}

// Usage in Activities/Fragments
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Track app start
        PerformanceMonitoringService.trackAppStart()
        
        setContentView(R.layout.activity_main)
        
        // Track screen load
        PerformanceMonitoringService.trackScreenLoad("main")
        
        // Mark screen as loaded when UI is ready
        findViewById<View>(R.id.root).viewTreeObserver.addOnGlobalLayoutListener(
            object : ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    PerformanceTracker.onScreenLoaded?.invoke()
                    findViewById<View>(R.id.root).viewTreeObserver.removeOnGlobalLayoutListener(this)
                }
            }
        )
    }
    
    private fun performExpensiveOperation() {
        PerformanceMonitoringService.trackCustomOperation("expensive_operation") {
            // Simulate expensive operation
            delay(1000)
        }
    }
}
```

#### Custom Performance Metrics
```kotlin
// Advanced performance metrics collection
class AdvancedPerformanceMetrics {
    
    data class FrameMetrics(
        val totalFrames: Long,
        val jankyFrames: Long,
        val avgFrameTime: Double,
        val maxFrameTime: Long
    )
    
    data class MemoryMetrics(
        val heapSize: Long,
        val heapUsed: Long,
        val nativeSize: Long,
        val nativeUsed: Long
    )
    
    data class BatteryMetrics(
        val batteryLevel: Float,
        val chargingState: String,
        val powerProfile: String
    )
    
    companion object {
        fun collectFrameMetrics(activity: Activity): FrameMetrics {
            val frameMetricsAggregator = FrameMetricsAggregator()
            frameMetricsAggregator.add(activity)
            
            val metrics = frameMetricsAggregator.metrics
            val totalFrames = metrics.size.toLong()
            
            var jankyFrames = 0L
            var totalFrameTime = 0L
            var maxFrameTime = 0L
            
            metrics.forEach { frameTime ->
                totalFrameTime += frameTime
                if (frameTime > 16) jankyFrames++ // 16ms = 60fps threshold
                if (frameTime > maxFrameTime) maxFrameTime = frameTime
            }
            
            return FrameMetrics(
                totalFrames = totalFrames,
                jankyFrames = jankyFrames,
                avgFrameTime = if (totalFrames > 0) totalFrameTime.toDouble() / totalFrames else 0.0,
                maxFrameTime = maxFrameTime
            )
        }
        
        fun collectMemoryMetrics(context: Context): MemoryMetrics {
            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memoryInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memoryInfo)
            
            val runtime = Runtime.getRuntime()
            
            return MemoryMetrics(
                heapSize = runtime.totalMemory(),
                heapUsed = runtime.totalMemory() - runtime.freeMemory(),
                nativeSize = memoryInfo.totalMem,
                nativeUsed = memoryInfo.totalMem - memoryInfo.availMem
            )
        }
        
        fun collectBatteryMetrics(context: Context): BatteryMetrics {
            val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            
            val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) / 100f
            val chargingState = when (batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS)) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
                BatteryManager.BATTERY_STATUS_FULL -> "full"
                else -> "unknown"
            }
            
            return BatteryMetrics(
                batteryLevel = batteryLevel,
                chargingState = chargingState,
                powerProfile = determinePowerProfile(batteryLevel, chargingState)
            )
        }
        
        private fun determinePowerProfile(level: Float, state: String): String {
            return when {
                level < 0.15 -> "low_power"
                level < 0.50 && state == "discharging" -> "power_saver"
                state == "charging" -> "performance"
                else -> "balanced"
            }
        }
    }
}
```

### iOS Performance Analytics

#### Firebase Performance Monitoring
```swift
// Performance monitoring setup
import FirebasePerformance
import UIKit

class PerformanceMonitoringService {
    static let shared = PerformanceMonitoringService()
    
    private var activeTraces: [String: Trace] = [:]
    
    func trackAppLaunch() {
        let trace = Performance.startTrace(name: "app_launch")
        trace?.setValue("ios", forAttribute: "platform")
        trace?.setValue(UIDevice.current.systemVersion, forAttribute: "ios_version")
        trace?.setValue(UIDevice.current.model, forAttribute: "device_model")
        
        // Track cold start specifically
        let coldStartTrace = Performance.startTrace(name: "cold_start")
        coldStartTrace?.start()
        
        // Stop trace when app becomes active
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            coldStartTrace?.stop()
            trace?.stop()
        }
    }
    
    func trackViewControllerLoad(_ viewController: UIViewController) {
        let className = String(describing: type(of: viewController))
        let trace = Performance.startTrace(name: "screen_\(className)")
        
        trace?.setValue(className, forAttribute: "screen_name")
        trace?.setValue(String(describing: viewController.navigationController), forAttribute: "navigation_type")
        
        activeTraces[className] = trace
        
        // Track different loading phases
        trackLoadingPhases(for: className)
    }
    
    private func trackLoadingPhases(for screenName: String) {
        let phases = [
            "data_fetch": Performance.startTrace(name: "\(screenName)_data_fetch"),
            "ui_render": Performance.startTrace(name: "\(screenName)_ui_render"),
            "user_ready": Performance.startTrace(name: "\(screenName)_user_ready")
        ]
        
        phases.values.forEach { $0?.start() }
        
        // Stop phases when screen is ready
        DispatchQueue.main.async {
            phases.values.forEach { $0?.stop() }
        }
    }
    
    func trackCustomOperation<T>(
        name: String,
        attributes: [String: String] = [:],
        operation: () throws -> T
    ) rethrows -> T {
        let trace = Performance.startTrace(name: name)
        
        attributes.forEach { key, value in
            trace?.setValue(value, forAttribute: key)
        }
        
        let startTime = CFAbsoluteTimeGetCurrent()
        
        do {
            let result = try operation()
            trace?.setValue("true", forAttribute: "success")
            return result
        } catch {
            trace?.setValue("false", forAttribute: "success")
            trace?.setValue(String(describing: error), forAttribute: "error")
            throw error
        } finally {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            trace?.setIntValue(Int64(duration * 1000), forMetric: "duration_ms")
            trace?.stop()
        }
    }
    
    func trackMemoryUsage() {
        let memoryUsage = getMemoryUsage()
        let trace = Performance.startTrace(name: "memory_usage")
        
        trace?.setIntValue(Int64(memoryUsage.used / 1024 / 1024), forMetric: "used_memory_mb")
        trace?.setIntValue(Int64(memoryUsage.total / 1024 / 1024), forMetric: "total_memory_mb")
        trace?.setValue(String(format: "%.1f", memoryUsage.percentUsed), forAttribute: "usage_percent")
        
        trace?.start()
        trace?.stop()
    }
    
    private func getMemoryUsage() -> (used: UInt64, total: UInt64, percentUsed: Double) {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            let used = info.resident_size
            let total = ProcessInfo.processInfo.physicalMemory
            let percentUsed = Double(used) / Double(total) * 100
            
            return (used, total, percentUsed)
        }
        
        return (0, 0, 0)
    }
}

// Custom performance tracker
class CustomPerformanceTracker {
    struct PerformanceMetric {
        let name: String
        let value: Double
        let unit: String
        let timestamp: Date
        let attributes: [String: String]
    }
    
    private var metrics: [PerformanceMetric] = []
    private let queue = DispatchQueue(label: "performance-tracker", qos: .utility)
    
    func record(metric name: String, value: Double, unit: String = "", attributes: [String: String] = [:]) {
        queue.async {
            let metric = PerformanceMetric(
                name: name,
                value: value,
                unit: unit,
                timestamp: Date(),
                attributes: attributes
            )
            
            self.metrics.append(metric)
            self.sendToAnalytics(metric)
        }
    }
    
    func recordFrameRate() {
        let displayLink = CADisplayLink(target: self, selector: #selector(frameCallback))
        displayLink.add(to: .main, forMode: .common)
        
        var frameCount = 0
        let startTime = CFAbsoluteTimeGetCurrent()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            displayLink.invalidate()
            let endTime = CFAbsoluteTimeGetCurrent()
            let actualFPS = Double(frameCount) / (endTime - startTime)
            
            self.record(
                metric: "frame_rate",
                value: actualFPS,
                unit: "fps",
                attributes: ["measurement_duration": "1.0"]
            )
        }
    }
    
    @objc private func frameCallback() {
        // This will be called for each frame
    }
    
    private func sendToAnalytics(_ metric: PerformanceMetric) {
        // Send to analytics service
        Analytics.track("performance_metric", properties: [
            "metric_name": metric.name,
            "metric_value": metric.value,
            "metric_unit": metric.unit,
            "timestamp": metric.timestamp.timeIntervalSince1970
        ])
    }
}

// Usage example
class ViewController: UIViewController {
    private let performanceTracker = CustomPerformanceTracker()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        PerformanceMonitoringService.shared.trackViewControllerLoad(self)
        
        // Track frame rate
        performanceTracker.recordFrameRate()
        
        loadData()
    }
    
    private func loadData() {
        PerformanceMonitoringService.shared.trackCustomOperation(
            name: "data_load",
            attributes: ["screen": "main", "data_type": "user_profile"]
        ) {
            // Simulate data loading
            Thread.sleep(forTimeInterval: 0.5)
        }
    }
}
```

### React Native Performance Analytics

#### Performance Monitoring Setup
```javascript
// performance-analytics.js
import { PixelRatio, Dimensions, Platform } from 'react-native';
import perf from '@react-native-firebase/perf';

class PerformanceAnalytics {
  constructor() {
    this.traces = new Map();
    this.metrics = [];
    this.isEnabled = true;
  }

  // App launch tracking
  async trackAppLaunch() {
    const trace = perf().newTrace('app_launch');
    await trace.start();

    // Add device context
    await trace.putAttribute('platform', Platform.OS);
    await trace.putAttribute('platform_version', Platform.Version.toString());
    await trace.putAttribute('device_resolution', this.getDeviceResolution());
    await trace.putAttribute('pixel_ratio', PixelRatio.get().toString());

    // Track cold start time
    const coldStartTrace = perf().newTrace('cold_start');
    await coldStartTrace.start();

    // Stop traces when app is ready
    setTimeout(async () => {
      await coldStartTrace.stop();
      await trace.stop();
    }, 100);
  }

  // Screen tracking
  async trackScreenLoad(screenName) {
    const trace = perf().newTrace(`screen_${screenName}`);
    await trace.start();

    await trace.putAttribute('screen_name', screenName);
    await trace.putAttribute('timestamp', Date.now().toString());

    this.traces.set(screenName, trace);

    // Track screen loading phases
    await this.trackScreenPhases(screenName);
  }

  async trackScreenPhases(screenName) {
    const phases = {
      data_fetch: perf().newTrace(`${screenName}_data_fetch`),
      ui_render: perf().newTrace(`${screenName}_ui_render`),
      user_ready: perf().newTrace(`${screenName}_user_ready`)
    };

    // Start all phases
    await Promise.all(Object.values(phases).map(trace => trace.start()));

    // Store phases for later stopping
    this.traces.set(`${screenName}_phases`, phases);
  }

  async stopScreenLoad(screenName) {
    const trace = this.traces.get(screenName);
    const phases = this.traces.get(`${screenName}_phases`);

    if (phases) {
      await Promise.all(Object.values(phases).map(trace => trace.stop()));
      this.traces.delete(`${screenName}_phases`);
    }

    if (trace) {
      await trace.stop();
      this.traces.delete(screenName);
    }
  }

  // Custom operation tracking
  async trackOperation(operationName, operation) {
    const trace = perf().newTrace(operationName);
    await trace.start();

    const startTime = Date.now();

    try {
      const result = await operation();
      await trace.putAttribute('success', 'true');
      return result;
    } catch (error) {
      await trace.putAttribute('success', 'false');
      await trace.putAttribute('error', error.message || 'unknown');
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await trace.putMetric('duration_ms', duration);
      await trace.stop();
    }
  }

  // Memory tracking
  trackMemoryUsage() {
    if (Platform.OS === 'ios') {
      // iOS memory tracking would require native module
      this.recordMetric('memory_warning', 0, 'count');
    } else {
      // Android memory tracking
      this.recordMetric('memory_usage', this.getMemoryUsage(), 'mb');
    }
  }

  // Frame rate tracking
  trackFrameRate() {
    let frameCount = 0;
    const startTime = Date.now();

    const raf = () => {
      frameCount++;
      if (Date.now() - startTime < 1000) {
        requestAnimationFrame(raf);
      } else {
        const fps = frameCount;
        this.recordMetric('frame_rate', fps, 'fps');
      }
    };

    requestAnimationFrame(raf);
  }

  // Network performance tracking
  async trackNetworkRequest(url, method = 'GET') {
    const trace = perf().newHttpMetric(url, method);
    await trace.start();

    return {
      async complete(response) {
        await trace.setHttpResponseCode(response.status);
        await trace.setResponseContentType(response.headers['content-type'] || 'unknown');
        await trace.setResponsePayloadSize(parseInt(response.headers['content-length'] || '0'));
        await trace.stop();
      },
      async error(error) {
        await trace.putAttribute('error', error.message || 'network_error');
        await trace.stop();
      }
    };
  }

  // Custom metrics recording
  recordMetric(name, value, unit = '', attributes = {}) {
    const metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      attributes: {
        platform: Platform.OS,
        ...attributes
      }
    };

    this.metrics.push(metric);
    this.sendToAnalytics(metric);
  }

  // Device information
  getDeviceResolution() {
    const { width, height } = Dimensions.get('window');
    return `${width}x${height}`;
  }

  getMemoryUsage() {
    // This would require a native module for accurate memory usage
    return 0;
  }

  sendToAnalytics(metric) {
    // Send to your analytics service
    console.log('Performance Metric:', metric);
  }

  // Performance report generation
  generatePerformanceReport() {
    const report = {
      total_metrics: this.metrics.length,
      metrics_by_type: {},
      time_range: {
        start: Math.min(...this.metrics.map(m => m.timestamp)),
        end: Math.max(...this.metrics.map(m => m.timestamp))
      }
    };

    // Group metrics by name
    this.metrics.forEach(metric => {
      if (!report.metrics_by_type[metric.name]) {
        report.metrics_by_type[metric.name] = [];
      }
      report.metrics_by_type[metric.name].push(metric.value);
    });

    // Calculate statistics
    Object.keys(report.metrics_by_type).forEach(metricName => {
      const values = report.metrics_by_type[metricName];
      values.sort((a, b) => a - b);

      report.metrics_by_type[metricName] = {
        count: values.length,
        min: values[0],
        max: values[values.length - 1],
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        p50: values[Math.floor(values.length * 0.5)],
        p90: values[Math.floor(values.length * 0.9)],
        p95: values[Math.floor(values.length * 0.95)]
      };
    });

    return report;
  }
}

// Export singleton
export default new PerformanceAnalytics();

// Usage example
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import PerformanceAnalytics from './performance-analytics';

const MyScreen = ({ navigation }) => {
  useEffect(() => {
    const screenName = 'MyScreen';
    
    // Start tracking screen load
    PerformanceAnalytics.trackScreenLoad(screenName);
    
    // Track frame rate
    PerformanceAnalytics.trackFrameRate();
    
    // Cleanup when screen unmounts
    return () => {
      PerformanceAnalytics.stopScreenLoad(screenName);
    };
  }, []);

  const handleApiCall = async () => {
    await PerformanceAnalytics.trackOperation('api_call', async () => {
      const tracker = await PerformanceAnalytics.trackNetworkRequest(
        'https://api.example.com/data',
        'GET'
      );

      try {
        const response = await fetch('https://api.example.com/data');
        await tracker.complete(response);
        return response.json();
      } catch (error) {
        await tracker.error(error);
        throw error;
      }
    });
  };

  return (
    <View>
      <Text>My Screen</Text>
    </View>
  );
};

export default MyScreen;
```

### Flutter Performance Analytics

#### Firebase Performance Integration
```dart
// performance_analytics_service.dart
import 'dart:async';
import 'dart:io';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class PerformanceAnalyticsService {
  static final PerformanceAnalyticsService _instance = PerformanceAnalyticsService._internal();
  factory PerformanceAnalyticsService() => _instance;
  PerformanceAnalyticsService._internal();

  final Map<String, Trace> _activeTraces = {};
  final List<PerformanceMetric> _metrics = [];
  bool _isEnabled = true;

  // Initialize performance tracking
  Future<void> initialize() async {
    if (!_isEnabled) return;

    try {
      await FirebasePerformance.instance.setPerformanceCollectionEnabled(true);
      await _trackAppLaunch();
    } catch (error) {
      debugPrint('Failed to initialize performance analytics: $error');
    }
  }

  // Track app launch
  Future<void> _trackAppLaunch() async {
    final trace = FirebasePerformance.instance.newTrace('app_launch');
    await trace.start();

    // Add device context
    await trace.putAttribute('platform', Platform.operatingSystem);
    await trace.putAttribute('platform_version', Platform.operatingSystemVersion);
    await trace.putAttribute('app_version', await _getAppVersion());

    // Track cold start
    final coldStartTrace = FirebasePerformance.instance.newTrace('cold_start');
    await coldStartTrace.start();

    // Stop traces after app initialization
    Future.delayed(const Duration(milliseconds: 100), () async {
      await coldStartTrace.stop();
      await trace.stop();
    });
  }

  // Track screen/widget load
  Future<void> trackScreenLoad(String screenName) async {
    final trace = FirebasePerformance.instance.newTrace('screen_$screenName');
    await trace.start();

    await trace.putAttribute('screen_name', screenName);
    await trace.putAttribute('timestamp', DateTime.now().millisecondsSinceEpoch.toString());

    _activeTraces[screenName] = trace;

    // Track screen loading phases
    await _trackScreenPhases(screenName);
  }

  Future<void> _trackScreenPhases(String screenName) async {
    final phases = {
      'data_fetch': FirebasePerformance.instance.newTrace('${screenName}_data_fetch'),
      'ui_render': FirebasePerformance.instance.newTrace('${screenName}_ui_render'),
      'user_ready': FirebasePerformance.instance.newTrace('${screenName}_user_ready'),
    };

    // Start all phases
    await Future.wait(phases.values.map((trace) => trace.start()));

    // Store phases for later cleanup
    _activeTraces['${screenName}_phases'] = phases['data_fetch']!; // Store reference
  }

  Future<void> stopScreenLoad(String screenName) async {
    final trace = _activeTraces.remove(screenName);
    if (trace != null) {
      await trace.stop();
    }

    // Clean up phase traces
    _activeTraces.remove('${screenName}_phases');
  }

  // Track custom operations
  Future<T> trackOperation<T>(
    String operationName,
    Future<T> Function() operation, {
    Map<String, String>? attributes,
  }) async {
    final trace = FirebasePerformance.instance.newTrace(operationName);
    await trace.start();

    // Add custom attributes
    if (attributes != null) {
      for (final entry in attributes.entries) {
        await trace.putAttribute(entry.key, entry.value);
      }
    }

    final startTime = DateTime.now();

    try {
      final result = await operation();
      await trace.putAttribute('success', 'true');
      return result;
    } catch (error) {
      await trace.putAttribute('success', 'false');
      await trace.putAttribute('error', error.toString());
      rethrow;
    } finally {
      final duration = DateTime.now().difference(startTime);
      await trace.putMetric('duration_ms', duration.inMilliseconds);
      await trace.stop();
    }
  }

  // Track HTTP requests
  Future<HttpMetric> trackHttpRequest(String url, HttpMethod method) async {
    final httpMetric = FirebasePerformance.instance.newHttpMetric(url, method);
    await httpMetric.start();
    return httpMetric;
  }

  // Memory usage tracking
  void trackMemoryUsage() {
    final metric = PerformanceMetric(
      name: 'memory_usage',
      value: _getMemoryUsage(),
      unit: 'mb',
      timestamp: DateTime.now(),
      attributes: {'platform': Platform.operatingSystem},
    );

    _metrics.add(metric);
    _sendToAnalytics(metric);
  }

  // Frame rate tracking
  void trackFrameRate() {
    int frameCount = 0;
    final startTime = DateTime.now();

    Timer.periodic(const Duration(milliseconds: 16), (timer) {
      frameCount++;
      if (DateTime.now().difference(startTime).inSeconds >= 1) {
        timer.cancel();
        recordMetric('frame_rate', frameCount.toDouble(), 'fps');
      }
    });
  }

  // Widget build time tracking
  Future<void> trackWidgetBuild(String widgetName, VoidCallback buildFunction) async {
    final stopwatch = Stopwatch()..start();
    
    try {
      buildFunction();
    } finally {
      stopwatch.stop();
      recordMetric(
        'widget_build_time',
        stopwatch.elapsedMilliseconds.toDouble(),
        'ms',
        attributes: {'widget_name': widgetName},
      );
    }
  }

  // Custom metrics recording
  void recordMetric(
    String name,
    double value,
    String unit, {
    Map<String, String>? attributes,
  }) {
    final metric = PerformanceMetric(
      name: name,
      value: value,
      unit: unit,
      timestamp: DateTime.now(),
      attributes: {
        'platform': Platform.operatingSystem,
        ...?attributes,
      },
    );

    _metrics.add(metric);
    _sendToAnalytics(metric);
  }

  // Performance report generation
  Map<String, dynamic> generatePerformanceReport() {
    final report = <String, dynamic>{
      'total_metrics': _metrics.length,
      'metrics_by_type': <String, dynamic>{},
      'time_range': {
        'start': _metrics.isEmpty ? 0 : _metrics.first.timestamp.millisecondsSinceEpoch,
        'end': _metrics.isEmpty ? 0 : _metrics.last.timestamp.millisecondsSinceEpoch,
      },
    };

    // Group metrics by name
    final metricsByType = <String, List<double>>{};
    for (final metric in _metrics) {
      metricsByType.putIfAbsent(metric.name, () => []).add(metric.value);
    }

    // Calculate statistics
    for (final entry in metricsByType.entries) {
      final values = entry.value..sort();
      report['metrics_by_type'][entry.key] = {
        'count': values.length,
        'min': values.first,
        'max': values.last,
        'avg': values.reduce((a, b) => a + b) / values.length,
        'p50': values[(values.length * 0.5).floor()],
        'p90': values[(values.length * 0.9).floor()],
        'p95': values[(values.length * 0.95).floor()],
      };
    }

    return report;
  }

  // Helper methods
  double _getMemoryUsage() {
    // Platform-specific memory usage calculation
    return 0.0; // Placeholder
  }

  Future<String> _getAppVersion() async {
    // Get app version from package info
    return '1.0.0'; // Placeholder
  }

  void _sendToAnalytics(PerformanceMetric metric) {
    // Send to analytics service
    debugPrint('Performance Metric: ${metric.name} = ${metric.value}${metric.unit}');
  }
}

// Performance metric data class
class PerformanceMetric {
  final String name;
  final double value;
  final String unit;
  final DateTime timestamp;
  final Map<String, String> attributes;

  PerformanceMetric({
    required this.name,
    required this.value,
    required this.unit,
    required this.timestamp,
    required this.attributes,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'value': value,
    'unit': unit,
    'timestamp': timestamp.millisecondsSinceEpoch,
    'attributes': attributes,
  };
}

// Performance tracking mixin for widgets
mixin PerformanceTrackingMixin<T extends StatefulWidget> on State<T> {
  final PerformanceAnalyticsService _performance = PerformanceAnalyticsService();
  late String _screenName;

  @override
  void initState() {
    super.initState();
    _screenName = runtimeType.toString();
    _performance.trackScreenLoad(_screenName);
  }

  @override
  void dispose() {
    _performance.stopScreenLoad(_screenName);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _performance.trackWidgetBuild(_screenName, () => buildWithTracking(context)) as Widget;
  }

  Widget buildWithTracking(BuildContext context);
}

// Usage example
class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> with PerformanceTrackingMixin {
  final PerformanceAnalyticsService _performance = PerformanceAnalyticsService();

  @override
  Widget buildWithTracking(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Performance Demo')),
      body: Column(
        children: [
          ElevatedButton(
            onPressed: _performExpensiveOperation,
            child: Text('Expensive Operation'),
          ),
          ElevatedButton(
            onPressed: _makeNetworkRequest,
            child: Text('Network Request'),
          ),
        ],
      ),
    );
  }

  Future<void> _performExpensiveOperation() async {
    await _performance.trackOperation(
      'expensive_operation',
      () async {
        // Simulate expensive operation
        await Future.delayed(const Duration(milliseconds: 500));
      },
      attributes: {'operation_type': 'user_initiated'},
    );
  }

  Future<void> _makeNetworkRequest() async {
    final httpMetric = await _performance.trackHttpRequest(
      'https://api.example.com/data',
      HttpMethod.Get,
    );

    try {
      // Make actual network request here
      await Future.delayed(const Duration(milliseconds: 300));
      
      await httpMetric.putAttribute('success', 'true');
      await httpMetric.setResponseCode(200);
      await httpMetric.setResponsePayloadSize(1024);
    } catch (error) {
      await httpMetric.putAttribute('error', error.toString());
    } finally {
      await httpMetric.stop();
    }
  }
}
```

## Analytics Dashboard and Reporting

### Performance Dashboard Implementation

```typescript
// performance-dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Line, Bar, Gauge, Heatmap } from 'react-chartjs-2';

interface PerformanceData {
  appLaunchTimes: TimeSeries[];
  screenLoadTimes: { [screenName: string]: TimeSeries[] };
  memoryUsage: TimeSeries[];
  frameRates: TimeSeries[];
  networkPerformance: NetworkMetrics[];
  crashFreeRate: number;
  userSatisfactionScore: number;
}

interface TimeSeries {
  timestamp: number;
  value: number;
}

interface NetworkMetrics {
  endpoint: string;
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}

const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('launch_time');

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedTimeRange]);

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(`/api/performance?range=${selectedTimeRange}`);
      const data = await response.json();
      setPerformanceData(data);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    }
  };

  const renderAppLaunchChart = () => {
    if (!performanceData?.appLaunchTimes) return null;

    const chartData = {
      labels: performanceData.appLaunchTimes.map(point => 
        new Date(point.timestamp).toLocaleTimeString()
      ),
      datasets: [
        {
          label: 'App Launch Time (ms)',
          data: performanceData.appLaunchTimes.map(point => point.value),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        },
      ],
    };

    const options = {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time (ms)',
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: (context: any) => {
              const value = context.parsed.y;
              if (value > 3000) return 'Status: Poor';
              if (value > 1500) return 'Status: Fair';
              return 'Status: Good';
            },
          },
        },
      },
    };

    return (
      <div className="chart-container">
        <h3>App Launch Performance</h3>
        <Line data={chartData} options={options} />
      </div>
    );
  };

  const renderMemoryUsageChart = () => {
    if (!performanceData?.memoryUsage) return null;

    const chartData = {
      labels: performanceData.memoryUsage.map(point => 
        new Date(point.timestamp).toLocaleTimeString()
      ),
      datasets: [
        {
          label: 'Memory Usage (MB)',
          data: performanceData.memoryUsage.map(point => point.value),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
        },
      ],
    };

    return (
      <div className="chart-container">
        <h3>Memory Usage Over Time</h3>
        <Line data={chartData} />
      </div>
    );
  };

  const renderFrameRateGauge = () => {
    if (!performanceData?.frameRates) return null;

    const avgFrameRate = performanceData.frameRates.reduce((sum, point) => sum + point.value, 0) / 
                         performanceData.frameRates.length;

    const gaugeData = {
      datasets: [{
        data: [avgFrameRate, 60 - avgFrameRate],
        backgroundColor: [
          avgFrameRate >= 55 ? '#4CAF50' : avgFrameRate >= 45 ? '#FF9800' : '#F44336',
          '#E0E0E0'
        ],
        borderWidth: 0,
      }],
    };

    return (
      <div className="gauge-container">
        <h3>Average Frame Rate</h3>
        <div className="gauge-value">{avgFrameRate.toFixed(1)} FPS</div>
        <Gauge data={gaugeData} />
      </div>
    );
  };

  const renderScreenLoadHeatmap = () => {
    if (!performanceData?.screenLoadTimes) return null;

    const screenNames = Object.keys(performanceData.screenLoadTimes);
    const hours = Array.from({length: 24}, (_, i) => i);

    const heatmapData = screenNames.map(screenName => {
      return hours.map(hour => {
        const hourlyData = performanceData.screenLoadTimes[screenName].filter(point => {
          const pointHour = new Date(point.timestamp).getHours();
          return pointHour === hour;
        });

        return hourlyData.length > 0 
          ? hourlyData.reduce((sum, point) => sum + point.value, 0) / hourlyData.length
          : 0;
      });
    });

    return (
      <div className="heatmap-container">
        <h3>Screen Load Times by Hour</h3>
        <Heatmap
          data={{
            labels: hours.map(h => `${h}:00`),
            datasets: screenNames.map((screenName, index) => ({
              label: screenName,
              data: heatmapData[index],
            })),
          }}
        />
      </div>
    );
  };

  const renderNetworkPerformance = () => {
    if (!performanceData?.networkPerformance) return null;

    return (
      <div className="network-performance">
        <h3>API Performance</h3>
        <table className="performance-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Avg Response Time</th>
              <th>Error Rate</th>
              <th>Throughput</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {performanceData.networkPerformance.map((metric, index) => (
              <tr key={index}>
                <td>{metric.endpoint}</td>
                <td>{metric.avgResponseTime.toFixed(0)}ms</td>
                <td>{(metric.errorRate * 100).toFixed(2)}%</td>
                <td>{metric.throughput.toFixed(1)} req/s</td>
                <td>
                  <span className={`status-indicator ${getPerformanceStatus(metric)}`}>
                    {getPerformanceStatus(metric)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getPerformanceStatus = (metric: NetworkMetrics): string => {
    if (metric.errorRate > 0.05 || metric.avgResponseTime > 2000) return 'poor';
    if (metric.errorRate > 0.02 || metric.avgResponseTime > 1000) return 'fair';
    return 'good';
  };

  const renderKPIs = () => {
    if (!performanceData) return null;

    return (
      <div className="kpi-grid">
        <div className="kpi-card">
          <h4>Crash-Free Rate</h4>
          <div className="kpi-value">
            {(performanceData.crashFreeRate * 100).toFixed(2)}%
          </div>
          <div className="kpi-trend">
            {performanceData.crashFreeRate >= 0.995 ? '✅ Excellent' : 
             performanceData.crashFreeRate >= 0.99 ? '⚠️ Good' : '❌ Needs Attention'}
          </div>
        </div>

        <div className="kpi-card">
          <h4>User Satisfaction</h4>
          <div className="kpi-value">
            {(performanceData.userSatisfactionScore * 100).toFixed(1)}/100
          </div>
          <div className="kpi-trend">
            {performanceData.userSatisfactionScore >= 0.8 ? '😊 High' : 
             performanceData.userSatisfactionScore >= 0.6 ? '😐 Medium' : '😞 Low'}
          </div>
        </div>

        <div className="kpi-card">
          <h4>Avg Launch Time</h4>
          <div className="kpi-value">
            {performanceData.appLaunchTimes.length > 0 
              ? (performanceData.appLaunchTimes.reduce((sum, point) => sum + point.value, 0) / 
                 performanceData.appLaunchTimes.length).toFixed(0)
              : 0}ms
          </div>
          <div className="kpi-trend">
            Target: < 1500ms
          </div>
        </div>
      </div>
    );
  };

  if (!performanceData) {
    return <div className="loading">Loading performance data...</div>;
  }

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <h1>Performance Analytics</h1>
        <div className="controls">
          <select 
            value={selectedTimeRange} 
            onChange={e => setSelectedTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {renderKPIs()}

      <div className="dashboard-grid">
        {renderAppLaunchChart()}
        {renderMemoryUsageChart()}
        {renderFrameRateGauge()}
        {renderScreenLoadHeatmap()}
      </div>

      {renderNetworkPerformance()}
    </div>
  );
};

export default PerformanceDashboard;
```

## Best Practices

### 1. **Metric Selection and Prioritization**
- Focus on user-centric metrics (launch time, responsiveness)
- Track business-critical flows and features
- Monitor both technical and experiential metrics
- Establish performance budgets and SLAs

### 2. **Data Collection Strategy**
- Implement sampling to reduce overhead
- Balance data granularity with performance impact
- Respect user privacy and data regulations
- Ensure consistent measurement across platforms

### 3. **Analysis and Action**
- Set up automated alerting for performance regressions
- Correlate performance data with business metrics
- Identify and prioritize optimization opportunities
- Track the impact of performance improvements

### 4. **Continuous Monitoring**
- Monitor performance across different devices and network conditions
- Track performance trends over time
- Compare performance across app versions
- Monitor real user performance vs. synthetic testing

## Conclusion

Performance analytics provide essential insights for maintaining and improving mobile application quality. By implementing comprehensive monitoring systems across all platforms and focusing on user-centric metrics, development teams can proactively identify performance issues and deliver exceptional user experiences.

The combination of automated data collection, real-time monitoring, and actionable insights enables teams to make informed decisions about performance optimization and maintain high-quality mobile applications.
