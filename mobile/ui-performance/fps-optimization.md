# FPS Optimizasyonu ve Akıcı Kullanıcı Deneyimi

Mobil uygulamalarda akıcı kullanıcı deneyimi sağlamak için hedeflenen frame rate (genellikle 60 FPS) sürdürülmelidir. Bu bölümde FPS optimizasyonu teknikleri ve akıcı kullanıcı deneyimi sağlama yöntemleri ele alınacaktır.

## FPS ve Frame Rate Temelleri

### 60 FPS Hedefi
```javascript
// React Native - FPS İzleme
import { PerformanceMonitor } from 'react-native-performance';

const FPSMonitor = () => {
  const [fps, setFps] = useState(60);
  
  useEffect(() => {
    const monitor = new PerformanceMonitor({
      onFPSChange: (currentFPS) => {
        setFps(currentFPS);
        if (currentFPS < 30) {
          console.warn('Düşük FPS tespit edildi:', currentFPS);
        }
      }
    });
    
    return () => monitor.stop();
  }, []);
  
  return (
    <View style={styles.monitor}>
      <Text>FPS: {fps.toFixed(1)}</Text>
    </View>
  );
};
```

### Android FPS Optimizasyonu
```kotlin
// GPU Profiler ile FPS izleme
class FPSMonitor {
    private var frameStartTime = 0L
    private val frameMetrics = mutableListOf<Long>()
    
    fun startFrameMonitoring(activity: Activity) {
        activity.window.addOnFrameMetricsAvailableListener(
            { _, frameMetrics, _ ->
                val totalDuration = frameMetrics.getMetric(
                    FrameMetrics.TOTAL_DURATION
                )
                
                // 16.67ms = 60 FPS threshold
                if (totalDuration > 16_670_000) { // nanoseconds
                    Log.w("FPS", "Dropped frame: ${totalDuration / 1_000_000}ms")
                }
                
                this.frameMetrics.add(totalDuration)
                if (this.frameMetrics.size > 100) {
                    analyzePerformance()
                    this.frameMetrics.clear()
                }
            },
            Handler(Looper.getMainLooper())
        )
    }
    
    private fun analyzePerformance() {
        val avgFrameTime = frameMetrics.average()
        val fps = 1_000_000_000 / avgFrameTime
        
        Log.i("FPS", "Ortalama FPS: ${fps.toInt()}")
    }
}

// Choreographer ile frame callback optimizasyonu
class SmoothAnimationManager : Choreographer.FrameCallback {
    private val choreographer = Choreographer.getInstance()
    private var lastFrameTime = 0L
    
    fun startSmoothing() {
        choreographer.postFrameCallback(this)
    }
    
    override fun doFrame(frameTimeNanos: Long) {
        if (lastFrameTime != 0L) {
            val frameDuration = (frameTimeNanos - lastFrameTime) / 1_000_000
            
            if (frameDuration > 16.67) {
                // Frame drop tespit edildi
                optimizeNextFrame()
            }
        }
        
        lastFrameTime = frameTimeNanos
        choreographer.postFrameCallback(this)
    }
    
    private fun optimizeNextFrame() {
        // Gereksiz işlemleri sonraki frame'e ertele
        choreographer.postFrameCallback {
            // Kritik olmayan güncellemeleri yap
        }
    }
}
```

### iOS FPS Optimizasyonu
```swift
// CADisplayLink ile FPS izleme
class FPSCounter {
    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameCount: Int = 0
    
    func startMonitoring() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkTick))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func displayLinkTick(displayLink: CADisplayLink) {
        if lastTimestamp == 0 {
            lastTimestamp = displayLink.timestamp
            return
        }
        
        frameCount += 1
        let elapsed = displayLink.timestamp - lastTimestamp
        
        if elapsed >= 1.0 {
            let fps = Double(frameCount) / elapsed
            print("FPS: \(Int(fps))")
            
            if fps < 45 {
                // Düşük FPS tespit edildi
                optimizeRendering()
            }
            
            frameCount = 0
            lastTimestamp = displayLink.timestamp
        }
    }
    
    private func optimizeRendering() {
        // Render optimizasyonları
        DispatchQueue.main.async {
            // UI güncellemelerini optimize et
        }
    }
}

// Metal ile GPU optimizasyonu
class MetalRenderer {
    private var device: MTLDevice!
    private var commandQueue: MTLCommandQueue!
    
    func optimizeGPURendering() {
        // Triple buffering kullan
        let bufferCount = 3
        
        // Command buffer pool
        let commandBuffer = commandQueue.makeCommandBuffer()
        
        // Parallel encoding
        let parallelEncoder = commandBuffer?.makeParallelRenderCommandEncoder(
            descriptor: renderPassDescriptor
        )
        
        // GPU iş yükünü dağıt
        for i in 0..<bufferCount {
            if let encoder = parallelEncoder?.makeRenderCommandEncoder() {
                encoder.setRenderPipelineState(pipelineState)
                encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
                encoder.endEncoding()
            }
        }
        
        parallelEncoder?.endEncoding()
        commandBuffer?.commit()
    }
}
```

## Frame Drop'ları Önleme

### Main Thread Optimizasyonu
```dart
// Flutter - Isolate kullanarak ağır işlemleri main thread'den ayırma
class HeavyComputationManager {
  static Future<List<ProcessedData>> processDataAsync(
    List<RawData> rawData
  ) async {
    final receivePort = ReceivePort();
    
    await Isolate.spawn(_computeInIsolate, {
      'data': rawData,
      'sendPort': receivePort.sendPort,
    });
    
    return await receivePort.first as List<ProcessedData>;
  }
  
  static void _computeInIsolate(Map<String, dynamic> params) {
    final data = params['data'] as List<RawData>;
    final sendPort = params['sendPort'] as SendPort;
    
    // Ağır hesaplama
    final processed = data.map((item) {
      // Karmaşık işlemler
      return ProcessedData(
        result: heavyCalculation(item),
        timestamp: DateTime.now(),
      );
    }).toList();
    
    sendPort.send(processed);
  }
}

// Widget rebuild optimizasyonu
class OptimizedListWidget extends StatefulWidget {
  @override
  _OptimizedListWidgetState createState() => _OptimizedListWidgetState();
}

class _OptimizedListWidgetState extends State<OptimizedListWidget> {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      // addRepaintBoundaries: true (varsayılan)
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: OptimizedListItem(
            key: ValueKey(items[index].id),
            item: items[index],
          ),
        );
      },
    );
  }
}

class OptimizedListItem extends StatelessWidget {
  final Item item;
  
  const OptimizedListItem({Key? key, required this.item}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    // Gereksiz rebuilds'i önlemek için const constructors kullan
    return const Card(
      child: ListTile(
        title: Text(item.title),
        subtitle: Text(item.description),
      ),
    );
  }
}
```

### Async Operations Optimizasyonu
```javascript
// React Native - İşlem kuyruğu ile frame blocking'i önleme
class OperationQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.frameDeadline = 16; // ms
  }
  
  addOperation(operation) {
    this.queue.push(operation);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const startTime = performance.now();
      
      // Frame deadline'ını aşmamak için zaman kontrolü
      while (
        this.queue.length > 0 && 
        (performance.now() - startTime) < this.frameDeadline
      ) {
        const operation = this.queue.shift();
        try {
          await operation();
        } catch (error) {
          console.error('Operation error:', error);
        }
      }
      
      // Bir sonraki frame'e bekle
      if (this.queue.length > 0) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
    
    this.isProcessing = false;
  }
}

// Kullanım
const operationQueue = new OperationQueue();

// Ağır işlemleri kuyruğa ekle
operationQueue.addOperation(() => processLargeDataSet(data1));
operationQueue.addOperation(() => updateComplexUI(uiData));
operationQueue.addOperation(() => performCalculations(calcData));
```

## GPU ve Render Optimizasyonu

### Texture ve Shader Optimizasyonu
```swift
// iOS Metal Shader optimizasyonu
class OptimizedShaderManager {
    private var pipelineStates: [String: MTLRenderPipelineState] = [:]
    
    func createOptimizedPipeline(for shaderName: String) -> MTLRenderPipelineState? {
        if let cachedState = pipelineStates[shaderName] {
            return cachedState
        }
        
        let pipelineDescriptor = MTLRenderPipelineDescriptor()
        
        // Vertex shader
        pipelineDescriptor.vertexFunction = library.makeFunction(name: "\(shaderName)_vertex")
        
        // Fragment shader - optimized precision
        pipelineDescriptor.fragmentFunction = library.makeFunction(name: "\(shaderName)_fragment")
        
        // Color attachment optimization
        pipelineDescriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        
        // Alpha blending optimization
        let colorAttachment = pipelineDescriptor.colorAttachments[0]!
        colorAttachment.isBlendingEnabled = true
        colorAttachment.rgbBlendOperation = .add
        colorAttachment.alphaBlendOperation = .add
        colorAttachment.sourceRGBBlendFactor = .sourceAlpha
        colorAttachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
        
        do {
            let pipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
            pipelineStates[shaderName] = pipelineState
            return pipelineState
        } catch {
            print("Pipeline state creation failed: \(error)")
            return nil
        }
    }
}

// Texture atlasing için optimizasyon
class TextureAtlasManager {
    private var atlases: [MTLTexture] = []
    private var textureCoordinates: [String: CGRect] = [:]
    
    func createAtlas(from images: [String: UIImage]) -> MTLTexture? {
        let atlasSize = calculateOptimalAtlasSize(imageCount: images.count)
        
        let textureDescriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: atlasSize,
            height: atlasSize,
            mipmapped: true
        )
        
        guard let atlasTexture = device.makeTexture(descriptor: textureDescriptor) else {
            return nil
        }
        
        // Pack images into atlas
        var currentX = 0, currentY = 0, rowHeight = 0
        
        for (name, image) in images {
            let imageSize = image.size
            
            if currentX + Int(imageSize.width) > atlasSize {
                currentX = 0
                currentY += rowHeight
                rowHeight = 0
            }
            
            // Copy image data to atlas
            copyImageToAtlas(image: image, atlas: atlasTexture, x: currentX, y: currentY)
            
            // Store texture coordinates
            textureCoordinates[name] = CGRect(
                x: Double(currentX) / Double(atlasSize),
                y: Double(currentY) / Double(atlasSize),
                width: imageSize.width / Double(atlasSize),
                height: imageSize.height / Double(atlasSize)
            )
            
            currentX += Int(imageSize.width)
            rowHeight = max(rowHeight, Int(imageSize.height))
        }
        
        return atlasTexture
    }
}
```

### Draw Call Optimizasyonu
```kotlin
// Android - Draw call batching
class DrawCallOptimizer {
    private val batchedDrawCommands = mutableListOf<DrawCommand>()
    private var currentTexture: Texture? = null
    
    fun addDrawCommand(command: DrawCommand) {
        // Texture değişimi kontrolü
        if (currentTexture != command.texture) {
            flushBatch()
            currentTexture = command.texture
        }
        
        batchedDrawCommands.add(command)
        
        // Batch size limiti
        if (batchedDrawCommands.size >= MAX_BATCH_SIZE) {
            flushBatch()
        }
    }
    
    private fun flushBatch() {
        if (batchedDrawCommands.isEmpty()) return
        
        // Vertex buffer'ı hazırla
        val vertexBuffer = createBatchedVertexBuffer(batchedDrawCommands)
        
        // Tek draw call ile tüm batch'i çiz
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, currentTexture?.id ?: 0)
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vertexBuffer.id)
        
        GLES20.glVertexAttribPointer(
            positionHandle, 3, GLES20.GL_FLOAT, false,
            VERTEX_STRIDE, 0
        )
        GLES20.glVertexAttribPointer(
            textureCoordHandle, 2, GLES20.GL_FLOAT, false,
            VERTEX_STRIDE, 12
        )
        
        GLES20.glDrawArrays(
            GLES20.GL_TRIANGLES, 0,
            batchedDrawCommands.size * 6
        )
        
        batchedDrawCommands.clear()
    }
    
    private fun createBatchedVertexBuffer(commands: List<DrawCommand>): VertexBuffer {
        val vertices = FloatArray(commands.size * 30) // 6 vertices * 5 floats per vertex
        var index = 0
        
        for (command in commands) {
            val quad = command.generateQuadVertices()
            System.arraycopy(quad, 0, vertices, index, quad.size)
            index += quad.size
        }
        
        return VertexBuffer(vertices)
    }
    
    companion object {
        private const val MAX_BATCH_SIZE = 1000
        private const val VERTEX_STRIDE = 20 // 5 floats * 4 bytes
    }
}
```

## Animation Performance

### Hardware Accelerated Animations
```dart
// Flutter - Transform ve Opacity animasyonları (GPU accelerated)
class OptimizedAnimationWidget extends StatefulWidget {
  @override
  _OptimizedAnimationWidgetState createState() => _OptimizedAnimationWidgetState();
}

class _OptimizedAnimationWidgetState extends State<OptimizedAnimationWidget>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: Duration(milliseconds: 300),
      vsync: this,
    );
    
    // GPU ile hızlandırılmış animasyonlar
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.2,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    
    _opacityAnimation = Tween<double>(
      begin: 1.0,
      end: 0.8,
    ).animate(_controller);
  }
  
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Opacity(
            opacity: _opacityAnimation.value,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        );
      },
    );
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}

// Custom painter ile optimize edilmiş çizim
class OptimizedCustomPainter extends CustomPainter {
  final Animation<double> animation;
  
  OptimizedCustomPainter(this.animation) : super(repaint: animation);
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.blue
      ..style = PaintingStyle.fill;
    
    // Animasyonlu çizim
    final progress = animation.value;
    final radius = size.width * 0.5 * progress;
    
    canvas.drawCircle(
      Offset(size.width * 0.5, size.height * 0.5),
      radius,
      paint,
    );
  }
  
  @override
  bool shouldRepaint(OptimizedCustomPainter oldDelegate) {
    return animation.value != oldDelegate.animation.value;
  }
}
```

### Interpolation Optimizasyonu
```javascript
// React Native - Native driver ile optimize edilmiş animasyonlar
import { Animated, Easing } from 'react-native';

class OptimizedAnimationManager {
  constructor() {
    this.animatedValues = new Map();
    this.runningAnimations = new Set();
  }
  
  createOptimizedAnimation(key, config) {
    const animatedValue = new Animated.Value(config.initialValue || 0);
    this.animatedValues.set(key, animatedValue);
    
    return {
      start: (toValue, duration = 300, callback) => {
        const animation = Animated.timing(animatedValue, {
          toValue,
          duration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true, // GPU acceleration
        });
        
        this.runningAnimations.add(key);
        
        animation.start(() => {
          this.runningAnimations.delete(key);
          callback && callback();
        });
        
        return animation;
      },
      
      stop: () => {
        animatedValue.stopAnimation();
        this.runningAnimations.delete(key);
      },
      
      getValue: () => animatedValue._value,
      getAnimatedValue: () => animatedValue,
    };
  }
  
  // Spring animation ile doğal hareket
  createSpringAnimation(key, config) {
    const animatedValue = new Animated.Value(config.initialValue || 0);
    this.animatedValues.set(key, animatedValue);
    
    return {
      spring: (toValue, springConfig = {}) => {
        const animation = Animated.spring(animatedValue, {
          toValue,
          friction: springConfig.friction || 8,
          tension: springConfig.tension || 100,
          useNativeDriver: true,
        });
        
        this.runningAnimations.add(key);
        animation.start(() => this.runningAnimations.delete(key));
        
        return animation;
      }
    };
  }
  
  // Paralel animasyonlar
  createParallelAnimation(animations) {
    const parallelAnimations = animations.map(anim => anim.animation);
    
    return Animated.parallel(parallelAnimations, {
      stopTogether: false
    });
  }
  
  // Sequence animasyonlar
  createSequenceAnimation(animations) {
    const sequenceAnimations = animations.map(anim => anim.animation);
    
    return Animated.sequence(sequenceAnimations);
  }
  
  stopAllAnimations() {
    this.runningAnimations.forEach(key => {
      const animatedValue = this.animatedValues.get(key);
      if (animatedValue) {
        animatedValue.stopAnimation();
      }
    });
    this.runningAnimations.clear();
  }
}

// Kullanım örneği
const animationManager = new OptimizedAnimationManager();

const fadeAnimation = animationManager.createOptimizedAnimation('fade', {
  initialValue: 0
});

const scaleAnimation = animationManager.createSpringAnimation('scale', {
  initialValue: 1
});

// Paralel animasyon
const showModal = () => {
  const parallelAnim = animationManager.createParallelAnimation([
    fadeAnimation.start(1, 250),
    scaleAnimation.spring(1.1)
  ]);
  
  parallelAnim.start();
};
```

## Performans İzleme ve Profiling

### Real-time FPS Monitoring
```kotlin
// Android - Gerçek zamanlı performans izleme
class PerformanceProfiler {
    private val frameMetrics = FrameMetricsCollector()
    private val memoryMonitor = MemoryMonitor()
    private val listeners = mutableListOf<PerformanceListener>()
    
    fun startProfiling(activity: Activity) {
        // Frame metrics
        frameMetrics.start(activity) { metrics ->
            val fps = calculateFPS(metrics)
            val frameTime = metrics.totalDuration / 1_000_000.0 // ms
            
            notifyListeners(PerformanceData(
                fps = fps,
                frameTime = frameTime,
                droppedFrames = metrics.droppedFrames,
                memoryUsage = memoryMonitor.getCurrentUsage()
            ))
            
            // Performans uyarıları
            if (fps < 30) {
                Log.w("Performance", "Düşük FPS: $fps")
                suggestOptimizations(metrics)
            }
        }
        
        // Memory monitoring
        memoryMonitor.startMonitoring { usage ->
            if (usage.percentUsed > 80) {
                Log.w("Performance", "Yüksek bellek kullanımı: ${usage.percentUsed}%")
                triggerGarbageCollection()
            }
        }
    }
    
    private fun calculateFPS(metrics: FrameMetrics): Double {
        val frameDuration = metrics.totalDuration / 1_000_000.0 // ms
        return 1000.0 / frameDuration
    }
    
    private fun suggestOptimizations(metrics: FrameMetrics) {
        when {
            metrics.layoutDuration > 2_000_000 -> { // 2ms
                Log.i("Optimization", "Layout optimizasyonu gerekli")
            }
            metrics.drawDuration > 8_000_000 -> { // 8ms
                Log.i("Optimization", "Draw call optimizasyonu gerekli")
            }
            metrics.syncDuration > 1_000_000 -> { // 1ms
                Log.i("Optimization", "UI thread senkronizasyonu gerekli")
            }
        }
    }
    
    interface PerformanceListener {
        fun onPerformanceUpdate(data: PerformanceData)
        fun onPerformanceWarning(warning: PerformanceWarning)
    }
}

data class PerformanceData(
    val fps: Double,
    val frameTime: Double,
    val droppedFrames: Int,
    val memoryUsage: MemoryUsage
)
```

### Automated Performance Testing
```swift
// iOS - Otomatik performans testleri
class PerformanceTestSuite {
    private let testMetrics = XCTMetric.default
    
    func runFPSPerformanceTest() {
        measure(metrics: [XCTCPUMetric(), XCTMemoryMetric()]) {
            // Test senaryosu
            performHeavyUIOperations()
        }
    }
    
    private func performHeavyUIOperations() {
        let expectation = XCTestExpectation(description: "UI Operations")
        
        DispatchQueue.main.async {
            // Ağır UI işlemleri simüle et
            for i in 0..<1000 {
                let view = UIView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
                view.backgroundColor = UIColor.random()
                view.layer.cornerRadius = 10
                view.layer.shadowOffset = CGSize(width: 2, height: 2)
                view.layer.shadowOpacity = 0.5
                
                // View hierarchy'ye ekle ve kaldır
                self.testView.addSubview(view)
                view.removeFromSuperview()
            }
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
    
    func measureScrollPerformance() {
        let tableView = UITableView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        
        measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric]) {
            // Scroll işlemi simüle et
            tableView.setContentOffset(CGPoint(x: 0, y: 1000), animated: true)
        }
    }
    
    func measureAnimationPerformance() {
        let animationView = UIView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        
        measure(metrics: [XCTCPUMetric()]) {
            UIView.animate(
                withDuration: 1.0,
                delay: 0,
                options: [.curveEaseInOut],
                animations: {
                    animationView.transform = CGAffineTransform(scaleX: 2.0, y: 2.0)
                    animationView.alpha = 0.5
                }
            )
        }
    }
}

// Custom performance metrics
extension XCTMetric {
    static let frameDropMetric = XCTMetric(
        identifier: "com.app.framedrops",
        displayName: "Frame Drops",
        unitOfMeasurement: "frames"
    )
    
    static let renderTimeMetric = XCTMetric(
        identifier: "com.app.rendertime",
        displayName: "Render Time",
        unitOfMeasurement: "ms"
    )
}
```

Bu FPS optimizasyonu dokümantasyonu, mobil uygulamalarda akıcı kullanıcı deneyimi sağlamak için gerekli teknikleri kapsamlı bir şekilde ele almaktadır. Frame rate optimizasyonu, GPU kullanımı, animasyon performansı ve sürekli izleme konularında platform-specific çözümler sunmaktadır.
