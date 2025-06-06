# Frame Rate Management

Frame rate management is crucial for delivering smooth user experiences in mobile applications. This guide covers advanced techniques for maintaining consistent 60 FPS performance across different platforms and devices.

## Core Concepts

### Frame Budget
Each frame has a 16.67ms budget to render at 60 FPS:
- Layout: ~2ms
- Draw: ~4ms
- GPU processing: ~6ms
- Buffer swap: ~2ms
- System overhead: ~2ms

### VSync and Double Buffering

```swift
// iOS - CADisplayLink for VSync synchronization
class FrameRateMonitor {
    private var displayLink: CADisplayLink?
    private var frameCount = 0
    private var lastTimestamp: CFTimeInterval = 0
    
    func startMonitoring() {
        displayLink = CADisplayLink(target: self, selector: #selector(frameUpdate))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func frameUpdate(displayLink: CADisplayLink) {
        let currentTime = displayLink.timestamp
        frameCount += 1
        
        if lastTimestamp == 0 {
            lastTimestamp = currentTime
            return
        }
        
        let deltaTime = currentTime - lastTimestamp
        if deltaTime >= 1.0 {
            let fps = Double(frameCount) / deltaTime
            print("Current FPS: \(fps)")
            
            frameCount = 0
            lastTimestamp = currentTime
        }
    }
}
```

```kotlin
// Android - Choreographer for frame synchronization
class FrameRateManager : Choreographer.FrameCallback {
    private val choreographer = Choreographer.getInstance()
    private var frameCount = 0
    private var lastFrameTime = 0L
    
    fun startMonitoring() {
        choreographer.postFrameCallback(this)
    }
    
    override fun doFrame(frameTimeNanos: Long) {
        frameCount++
        
        if (lastFrameTime == 0L) {
            lastFrameTime = frameTimeNanos
            choreographer.postFrameCallback(this)
            return
        }
        
        val deltaTime = (frameTimeNanos - lastFrameTime) / 1_000_000_000.0
        
        if (deltaTime >= 1.0) {
            val fps = frameCount / deltaTime
            Log.d("FrameRate", "Current FPS: $fps")
            
            frameCount = 0
            lastFrameTime = frameTimeNanos
        }
        
        choreographer.postFrameCallback(this)
    }
}
```

## Platform-Specific Optimizations

### iOS Frame Rate Management

```swift
// Adaptive refresh rate for ProMotion displays
class AdaptiveFrameRateController {
    private let displayLink: CADisplayLink
    
    init() {
        displayLink = CADisplayLink(target: self, selector: #selector(frameUpdate))
        
        // Set preferred frame rate based on content
        if #available(iOS 15.0, *) {
            displayLink.preferredFrameRateRange = CAFrameRateRange(
                minimum: 60,
                maximum: 120,
                preferred: 120
            )
        }
    }
    
    func setFrameRate(for contentType: ContentType) {
        if #available(iOS 15.0, *) {
            switch contentType {
            case .staticUI:
                displayLink.preferredFrameRateRange = CAFrameRateRange(
                    minimum: 10, maximum: 60, preferred: 30
                )
            case .animation:
                displayLink.preferredFrameRateRange = CAFrameRateRange(
                    minimum: 60, maximum: 120, preferred: 120
                )
            case .video:
                displayLink.preferredFrameRateRange = CAFrameRateRange(
                    minimum: 24, maximum: 60, preferred: 60
                )
            }
        }
    }
}
```

### Android Frame Pacing

```kotlin
// Using Android Frame Pacing Library
class FramePacingManager {
    private var swappyGL: Long = 0
    
    fun initialize() {
        // Initialize Swappy for OpenGL
        swappyGL = SwappyGL.init(0, null)
        
        // Set swap interval for 60 FPS
        SwappyGL.setSwapIntervalNS(swappyGL, 16_666_666L) // 16.67ms
        
        // Enable frame pacing
        SwappyGL.enableStats(swappyGL, true)
    }
    
    fun onDrawFrame() {
        // Your rendering code here
        renderFrame()
        
        // Swap buffers with frame pacing
        SwappyGL.swap(swappyGL)
    }
    
    fun getFrameStats(): FrameStats {
        val stats = SwappyGL.getStats(swappyGL)
        return FrameStats(
            averageFPS = stats.averageFPS,
            frameMissCount = stats.frameMissCount
        )
    }
}
```

## Performance Profiling

### GPU Performance Analysis

```swift
// iOS - Metal Performance Shaders profiling
class GPUProfiler {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    
    init() {
        device = MTLCreateSystemDefaultDevice()!
        commandQueue = device.makeCommandQueue()!
    }
    
    func profileGPUWork<T>(_ work: (MTLCommandBuffer) -> T) -> (result: T, duration: TimeInterval) {
        let commandBuffer = commandQueue.makeCommandBuffer()!
        
        let startTime = CACurrentMediaTime()
        let result = work(commandBuffer)
        
        commandBuffer.addCompletedHandler { _ in
            let endTime = CACurrentMediaTime()
            let duration = endTime - startTime
            print("GPU work completed in: \(duration * 1000)ms")
        }
        
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        let endTime = CACurrentMediaTime()
        return (result, endTime - startTime)
    }
}
```

### Frame Drop Detection

```kotlin
// Android - Detecting frame drops using FrameMetrics
class FrameDropDetector {
    private val frameMetricsListener = object : Window.OnFrameMetricsAvailableListener {
        override fun onFrameMetricsAvailable(
            window: Window,
            frameMetrics: FrameMetrics,
            dropCountSinceLastInvocation: Int
        ) {
            val totalDuration = frameMetrics.getMetric(FrameMetrics.TOTAL_DURATION)
            val vsyncDuration = 16_666_666L // 16.67ms in nanoseconds
            
            if (totalDuration > vsyncDuration) {
                val droppedFrames = (totalDuration / vsyncDuration).toInt()
                onFrameDrop(droppedFrames, totalDuration / 1_000_000.0)
            }
        }
    }
    
    private fun onFrameDrop(count: Int, duration: Double) {
        Log.w("FrameDrop", "Dropped $count frames, duration: ${duration}ms")
        
        // Analytics tracking
        Analytics.track("frame_drop", mapOf(
            "dropped_frames" to count,
            "duration_ms" to duration
        ))
    }
}
```

## Cross-Platform Solutions

### React Native Frame Rate Optimization

```typescript
// React Native - Performance monitoring
import { InteractionManager, PixelRatio } from 'react-native';

class FrameRateOptimizer {
    private frameDropCallback?: (info: FrameDropInfo) => void;
    
    startMonitoring(callback: (info: FrameDropInfo) => void) {
        this.frameDropCallback = callback;
        
        // Monitor interaction completion
        InteractionManager.runAfterInteractions(() => {
            this.scheduleFrameCheck();
        });
    }
    
    private scheduleFrameCheck() {
        requestAnimationFrame((timestamp) => {
            const now = performance.now();
            const frameDuration = now - this.lastFrameTime;
            
            if (frameDuration > 16.67) {
                this.frameDropCallback?.({
                    droppedFrames: Math.floor(frameDuration / 16.67) - 1,
                    timestamp: now,
                    duration: frameDuration
                });
            }
            
            this.lastFrameTime = now;
            this.scheduleFrameCheck();
        });
    }
    
    optimizeForPerformance() {
        // Reduce pixel ratio for performance
        const scale = PixelRatio.get();
        if (scale > 2) {
            console.warn('High pixel ratio detected, consider optimization');
        }
        
        // Defer non-critical updates
        InteractionManager.createInteractionHandle();
    }
}

interface FrameDropInfo {
    droppedFrames: number;
    timestamp: number;
    duration: number;
}
```

### Flutter Frame Rate Management

```dart
// Flutter - Custom frame rate controller
class FrameRateController {
  late Ticker _ticker;
  Duration _lastFrameTime = Duration.zero;
  final List<double> _frameTimes = [];
  
  void startMonitoring() {
    _ticker = Ticker(_onTick);
    _ticker.start();
  }
  
  void _onTick(Duration elapsed) {
    if (_lastFrameTime != Duration.zero) {
      final frameDuration = elapsed - _lastFrameTime;
      final frameTime = frameDuration.inMicroseconds / 1000.0; // ms
      
      _frameTimes.add(frameTime);
      
      // Keep only last 60 frames
      if (_frameTimes.length > 60) {
        _frameTimes.removeAt(0);
      }
      
      // Check for frame drops
      if (frameTime > 16.67) {
        _handleFrameDrop(frameTime);
      }
    }
    
    _lastFrameTime = elapsed;
  }
  
  void _handleFrameDrop(double frameTime) {
    final droppedFrames = (frameTime / 16.67).floor() - 1;
    print('Frame drop detected: ${droppedFrames} frames, ${frameTime}ms');
    
    // Trigger performance optimization
    SchedulerBinding.instance.ensureVisualUpdate();
  }
  
  double get averageFPS {
    if (_frameTimes.isEmpty) return 0;
    
    final averageFrameTime = _frameTimes.reduce((a, b) => a + b) / _frameTimes.length;
    return 1000 / averageFrameTime;
  }
}
```

## Advanced Optimization Techniques

### Adaptive Quality System

```swift
// iOS - Dynamic quality adjustment
class AdaptiveQualityManager {
    private var currentQuality: QualityLevel = .high
    private let frameRateMonitor = FrameRateMonitor()
    
    enum QualityLevel: CaseIterable {
        case low, medium, high, ultra
        
        var renderScale: Float {
            switch self {
            case .low: return 0.5
            case .medium: return 0.75
            case .high: return 1.0
            case .ultra: return 1.25
            }
        }
    }
    
    func startAdaptiveQuality() {
        frameRateMonitor.onFrameRateChanged = { [weak self] fps in
            self?.adjustQuality(basedOn: fps)
        }
    }
    
    private func adjustQuality(basedOn fps: Double) {
        let targetFPS: Double = 58.0 // Slight buffer below 60
        
        if fps < targetFPS && currentQuality != .low {
            // Decrease quality
            if let currentIndex = QualityLevel.allCases.firstIndex(of: currentQuality),
               currentIndex > 0 {
                currentQuality = QualityLevel.allCases[currentIndex - 1]
                applyQualitySettings()
            }
        } else if fps > targetFPS + 5 && currentQuality != .ultra {
            // Increase quality
            if let currentIndex = QualityLevel.allCases.firstIndex(of: currentQuality),
               currentIndex < QualityLevel.allCases.count - 1 {
                currentQuality = QualityLevel.allCases[currentIndex + 1]
                applyQualitySettings()
            }
        }
    }
    
    private func applyQualitySettings() {
        // Apply render scale and other quality settings
        NotificationCenter.default.post(
            name: .qualityChanged,
            object: currentQuality
        )
    }
}
```

## Debugging Tools

### Frame Rate Debugging

```kotlin
// Android - Comprehensive frame debugging
class FrameDebugger {
    private val methodTracing = mutableMapOf<String, Long>()
    
    fun debugFrame(frameName: String, block: () -> Unit) {
        val startTime = System.nanoTime()
        
        try {
            block()
        } finally {
            val endTime = System.nanoTime()
            val duration = (endTime - startTime) / 1_000_000.0 // Convert to ms
            
            methodTracing[frameName] = endTime - startTime
            
            if (duration > 16.67) {
                Log.w("FrameDebug", "$frameName took ${duration}ms (>${16.67}ms budget)")
                printCallStack()
            }
        }
    }
    
    private fun printCallStack() {
        val trace = Thread.currentThread().stackTrace
        trace.take(10).forEach { element ->
            Log.d("FrameStack", "${element.className}.${element.methodName}:${element.lineNumber}")
        }
    }
    
    fun generatePerformanceReport(): String {
        return methodTracing.entries
            .sortedByDescending { it.value }
            .joinToString("\n") { (method, time) ->
                "$method: ${time / 1_000_000.0}ms"
            }
    }
}
```

## Best Practices

### Frame Rate Guidelines

1. **Target 60 FPS consistently**
   - Budget 16.67ms per frame
   - Monitor for frame drops
   - Implement adaptive quality

2. **GPU vs CPU balance**
   - Offload work to GPU when possible
   - Use async operations for heavy computations
   - Implement proper batching

3. **Memory management**
   - Avoid allocations in render loop
   - Pool frequently used objects
   - Implement proper cleanup

4. **Platform optimization**
   - Use Metal/Vulkan for advanced graphics
   - Leverage hardware acceleration
   - Implement platform-specific optimizations

### Performance Monitoring

```typescript
// Cross-platform performance metrics
interface FrameMetrics {
  averageFPS: number;
  frameMissCount: number;
  worstFrameTime: number;
  memoryUsage: number;
  gpuUtilization: number;
}

class PerformanceTracker {
  private metrics: FrameMetrics[] = [];
  
  trackFrame(metrics: FrameMetrics) {
    this.metrics.push(metrics);
    
    // Keep only last 1000 frames
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
    
    // Alert on performance issues
    if (metrics.averageFPS < 50) {
      this.reportPerformanceIssue('low_fps', metrics);
    }
  }
  
  private reportPerformanceIssue(type: string, metrics: FrameMetrics) {
    // Send to analytics service
    console.warn(`Performance issue: ${type}`, metrics);
  }
}
```

Frame rate management is critical for user experience. Regular monitoring, adaptive quality systems, and platform-specific optimizations ensure smooth 60 FPS performance across all devices and scenarios.
