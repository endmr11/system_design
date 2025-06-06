# Frame Rate Management ve 60 FPS Optimizasyonu

## Modern Mobile Rendering Pipeline

### Frame Rendering Anatomy
Modern mobil cihazlarda her frame'in 16.67ms (60 FPS) süre içinde tamamlanması gerekir. Bu süre aşıldığında "jank" denilen görsel takılmalar oluşur.

```
Frame Timeline (16.67ms @ 60 FPS):
┌─ Input Processing (1-2ms)
├─ Animation Calculations (1-3ms)  
├─ Layout Pass (2-4ms)
├─ Paint/Draw (3-6ms)
├─ Composite (2-4ms)
└─ GPU Rendering (3-5ms)
```

### Android Frame Rate Monitoring

#### Systrace ile Frame Analysis
```kotlin
// Build.gradle (app level)
android {
    buildTypes {
        debug {
            // Enable GPU profiling
            debuggable true
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}
```

#### Choreographer ile Frame Callback
```kotlin
class FrameRateMonitor : Choreographer.FrameCallback {
    private var lastFrameTime = 0L
    private val frameTimestamps = mutableListOf<Long>()
    private val maxSamples = 120 // 2 saniye @ 60 FPS
    
    fun startMonitoring() {
        Choreographer.getInstance().postFrameCallback(this)
    }
    
    override fun doFrame(frameTimeNanos: Long) {
        if (lastFrameTime != 0L) {
            val frameDuration = (frameTimeNanos - lastFrameTime) / 1_000_000 // ms
            frameTimestamps.add(frameDuration)
            
            // Dropped frame algılama
            if (frameDuration > 16.67) {
                logDroppedFrame(frameDuration)
            }
            
            // Sliding window ile FPS hesaplama
            if (frameTimestamps.size > maxSamples) {
                frameTimestamps.removeAt(0)
            }
        }
        
        lastFrameTime = frameTimeNanos
        Choreographer.getInstance().postFrameCallback(this)
    }
    
    private fun logDroppedFrame(duration: Double) {
        val droppedFrames = (duration / 16.67).toInt()
        Log.w("FrameRate", "Dropped $droppedFrames frames (${duration}ms)")
        
        // Analytics'e gönder
        FirebaseAnalytics.getInstance(context).logEvent("frame_drop") {
            param("duration_ms", duration)
            param("dropped_count", droppedFrames.toLong())
        }
    }
    
    fun getCurrentFPS(): Double {
        if (frameTimestamps.isEmpty()) return 0.0
        val avgDuration = frameTimestamps.average()
        return 1000.0 / avgDuration
    }
}
```

#### GPU Profiler Integration
```kotlin
class GPUProfiler {
    private val gpuProfiler = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        GpuProfilingApi.getGpuProfiler()
    } else null
    
    fun startGPUProfiling() {
        gpuProfiler?.let { profiler ->
            val profilingRequest = GpuProfilingApi.GpuProfilingRequest.Builder()
                .setSettings(
                    GpuProfilingApi.ClockSettings.Builder()
                        .setGpuClockPointer(GpuProfilingApi.CLOCK_POINTER_TIMESTAMP)
                        .build()
                )
                .build()
                
            profiler.beginProfiling(profilingRequest) { result ->
                when (result.resultCode) {
                    GpuProfilingApi.RESULT_SUCCESS -> {
                        Log.d("GPU", "GPU profiling başlatıldı")
                    }
                    else -> {
                        Log.e("GPU", "GPU profiling başlatılamadı: ${result.resultCode}")
                    }
                }
            }
        }
    }
    
    fun getGPUMetrics(): GpuProfilingApi.GpuProfilingResult? {
        return gpuProfiler?.endProfiling()
    }
}
```

### iOS Core Animation Profiling

#### CADisplayLink ile Frame Monitoring
```swift
import QuartzCore

class FrameRateMonitor {
    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameTimestamps: [Double] = []
    private let maxSamples = 120 // 2 seconds @ 60 FPS
    
    func startMonitoring() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkCallback))
        displayLink?.preferredFramesPerSecond = 60
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func displayLinkCallback(displayLink: CADisplayLink) {
        let currentTimestamp = displayLink.timestamp
        
        if lastTimestamp != 0 {
            let frameDuration = (currentTimestamp - lastTimestamp) * 1000 // ms
            frameTimestamps.append(frameDuration)
            
            // Dropped frame detection
            if frameDuration > 16.67 {
                logDroppedFrame(duration: frameDuration)
            }
            
            // Maintain sliding window
            if frameTimestamps.count > maxSamples {
                frameTimestamps.removeFirst()
            }
        }
        
        lastTimestamp = currentTimestamp
    }
    
    private func logDroppedFrame(duration: Double) {
        let droppedFrames = Int(duration / 16.67)
        print("⚠️ Dropped \(droppedFrames) frames (\(String(format: "%.2f", duration))ms)")
        
        // Analytics tracking
        Analytics.logEvent("frame_drop", parameters: [
            "duration_ms": duration,
            "dropped_count": droppedFrames
        ])
    }
    
    func getCurrentFPS() -> Double {
        guard !frameTimestamps.isEmpty else { return 0.0 }
        let avgDuration = frameTimestamps.reduce(0, +) / Double(frameTimestamps.count)
        return 1000.0 / avgDuration
    }
    
    func stopMonitoring() {
        displayLink?.invalidate()
        displayLink = nil
    }
}
```

#### Metal Performance HUD
```swift
import MetalKit

class MetalPerformanceMonitor {
    private var device: MTLDevice
    private var commandQueue: MTLCommandQueue
    private var performanceMetrics: [String: Double] = [:]
    
    init() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let commandQueue = device.makeCommandQueue() else {
            fatalError("Metal not supported")
        }
        
        self.device = device
        self.commandQueue = commandQueue
    }
    
    func measureGPUPerformance<T>(operation: () throws -> T) rethrows -> T {
        let startTime = CACurrentMediaTime()
        let result = try operation()
        let endTime = CACurrentMediaTime()
        
        let gpuTime = (endTime - startTime) * 1000 // ms
        performanceMetrics["last_gpu_operation"] = gpuTime
        
        if gpuTime > 16.67 {
            print("🔥 GPU operation took \(String(format: "%.2f", gpuTime))ms")
        }
        
        return result
    }
    
    func enableMetalHUD() {
        // MetalKit debug layer
        if let metalView = getCurrentMetalView() {
            metalView.preferredFramesPerSecond = 60
            metalView.enableSetNeedsDisplay = false
            metalView.isPaused = false
            
            // Performance HUD
            #if DEBUG
            metalView.device?.makeCommandQueue()?.label = "Performance Monitoring Queue"
            #endif
        }
    }
    
    private func getCurrentMetalView() -> MTKView? {
        // Implementation depends on your app structure
        return nil
    }
}
```

## Cross-Platform Frame Rate Monitoring

### React Native Performance
```javascript
// React Native Performance API
import { Performance } from 'react-native-performance';

class RNFrameRateMonitor {
    constructor() {
        this.frameTimestamps = [];
        this.maxSamples = 120;
        this.isMonitoring = false;
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.scheduleNextFrame();
    }
    
    scheduleNextFrame() {
        if (!this.isMonitoring) return;
        
        requestAnimationFrame((timestamp) => {
            this.recordFrame(timestamp);
            this.scheduleNextFrame();
        });
    }
    
    recordFrame(timestamp) {
        if (this.frameTimestamps.length > 0) {
            const lastFrame = this.frameTimestamps[this.frameTimestamps.length - 1];
            const frameDuration = timestamp - lastFrame;
            
            // 60 FPS = 16.67ms per frame
            if (frameDuration > 16.67) {
                this.logDroppedFrame(frameDuration);
            }
        }
        
        this.frameTimestamps.push(timestamp);
        
        if (this.frameTimestamps.length > this.maxSamples) {
            this.frameTimestamps.shift();
        }
    }
    
    logDroppedFrame(duration) {
        const droppedFrames = Math.floor(duration / 16.67);
        console.warn(`Dropped ${droppedFrames} frames (${duration.toFixed(2)}ms)`);
        
        // Send to analytics
        Performance.mark('frame_drop_start');
        Performance.measure('frame_drop', 'frame_drop_start');
    }
    
    getCurrentFPS() {
        if (this.frameTimestamps.length < 2) return 0;
        
        const totalTime = this.frameTimestamps[this.frameTimestamps.length - 1] - 
                         this.frameTimestamps[0];
        const frameCount = this.frameTimestamps.length - 1;
        
        return (frameCount / totalTime) * 1000;
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
    }
}

// Usage
const monitor = new RNFrameRateMonitor();
monitor.startMonitoring();

// Get FPS periodically
setInterval(() => {
    const fps = monitor.getCurrentFPS();
    console.log(`Current FPS: ${fps.toFixed(1)}`);
}, 1000);
```

### Flutter Frame Timing
```dart
import 'dart:ui' as ui;
import 'package:flutter/scheduler.dart';

class FlutterFrameRateMonitor {
  List<Duration> _frameTimestamps = [];
  final int _maxSamples = 120;
  bool _isMonitoring = false;
  
  void startMonitoring() {
    if (_isMonitoring) return;
    
    _isMonitoring = true;
    SchedulerBinding.instance.addTimingsCallback(_onReportTimings);
  }
  
  void _onReportTimings(List<FrameTiming> timings) {
    if (!_isMonitoring) return;
    
    for (final timing in timings) {
      final frameDuration = timing.totalSpan;
      _frameTimestamps.add(frameDuration);
      
      // 60 FPS = 16.67ms per frame
      if (frameDuration.inMicroseconds > 16670) {
        _logDroppedFrame(frameDuration);
      }
      
      if (_frameTimestamps.length > _maxSamples) {
        _frameTimestamps.removeAt(0);
      }
    }
  }
  
  void _logDroppedFrame(Duration duration) {
    final durationMs = duration.inMicroseconds / 1000;
    final droppedFrames = (durationMs / 16.67).floor();
    
    print('⚠️ Dropped $droppedFrames frames (${durationMs.toStringAsFixed(2)}ms)');
    
    // Send to Firebase Analytics
    FirebaseAnalytics.instance.logEvent(
      name: 'frame_drop',
      parameters: {
        'duration_ms': durationMs,
        'dropped_count': droppedFrames,
      },
    );
  }
  
  double getCurrentFPS() {
    if (_frameTimestamps.length < 2) return 0.0;
    
    final totalDuration = _frameTimestamps
        .map((d) => d.inMicroseconds)
        .reduce((a, b) => a + b);
    final avgDurationMs = (totalDuration / _frameTimestamps.length) / 1000;
    
    return 1000.0 / avgDurationMs;
  }
  
  void stopMonitoring() {
    _isMonitoring = false;
    SchedulerBinding.instance.removeTimingsCallback(_onReportTimings);
  }
}
```

## Best Practices ve Optimizasyon Teknikleri

### Render Thread Optimization
```kotlin
// Android: UI thread'i bloke etmemek için arka plan işlemleri
class BackgroundProcessor {
    private val backgroundExecutor = Executors.newSingleThreadExecutor()
    
    fun processInBackground(heavyTask: () -> Unit, onComplete: () -> Unit) {
        backgroundExecutor.submit {
            heavyTask()
            
            // UI güncellemesi main thread'de
            Handler(Looper.getMainLooper()).post {
                onComplete()
            }
        }
    }
}
```

### Batch Operations
```swift
// iOS: CATransaction ile animasyonları gruplama
func performBatchedAnimations() {
    CATransaction.begin()
    CATransaction.setAnimationDuration(0.3)
    CATransaction.setCompletionBlock {
        print("All animations completed")
    }
    
    // Multiple layer animations batched together
    layer1.opacity = 0.5
    layer2.transform = CATransform3DMakeScale(1.2, 1.2, 1.0)
    layer3.backgroundColor = UIColor.red.cgColor
    
    CATransaction.commit()
}
```

Bu kapsamlı frame rate yönetimi rehberi, mobil uygulamalarda 60 FPS hedefini yakalamak ve sürdürmek için gerekli tüm teknikleri ve araçları detaylandırır.
