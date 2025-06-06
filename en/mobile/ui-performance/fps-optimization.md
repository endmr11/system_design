# FPS Optimization and Animation Performance

## Introduction to FPS Optimization

### Understanding Frame Rate Performance
Frame rate optimization is crucial for delivering smooth user experiences in mobile applications. The human eye perceives motion as smooth when the frame rate is at least 24 FPS, but modern mobile devices target 60 FPS (16.67ms per frame) or even 120 FPS (8.33ms per frame) for premium devices.

### Performance Metrics
- **Target Frame Rates**: 60 FPS (16.67ms budget), 120 FPS (8.33ms budget)
- **Jank Detection**: Frame drops below 60 FPS threshold
- **Performance Budget**: Maximum time allowed for each frame rendering

## Platform-Specific FPS Optimization

### Android FPS Optimization

#### GPU Overdraw Reduction
```kotlin
// Minimize overdraw with efficient layouts
class OptimizedViewGroup @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : ViewGroup(context, attrs) {
    
    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        // Efficient layout implementation
        children.forEach { child ->
            child.layout(
                child.left,
                child.top,
                child.right,
                child.bottom
            )
        }
    }
    
    override fun dispatchDraw(canvas: Canvas) {
        // Minimize overdraw in drawing operations
        canvas.clipRect(0, 0, width, height)
        super.dispatchDraw(canvas)
    }
}
```

#### Hardware Acceleration
```kotlin
// Enable hardware acceleration for smooth animations
class AnimatedView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    
    init {
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }
    
    fun startAnimation() {
        animate()
            .translationX(200f)
            .setDuration(300)
            .setInterpolator(FastOutSlowInInterpolator())
            .start()
    }
}
```

#### Choreographer Frame Monitoring
```kotlin
class FrameRateMonitor {
    private val choreographer = Choreographer.getInstance()
    private var lastFrameTime = 0L
    private var frameCount = 0
    
    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (lastFrameTime > 0) {
                val frameDuration = (frameTimeNanos - lastFrameTime) / 1_000_000
                if (frameDuration > 16.67) {
                    // Frame drop detected
                    Log.w("FPS", "Frame drop: ${frameDuration}ms")
                }
            }
            lastFrameTime = frameTimeNanos
            frameCount++
            choreographer.postFrameCallback(this)
        }
    }
    
    fun startMonitoring() {
        choreographer.postFrameCallback(frameCallback)
    }
}
```

### iOS FPS Optimization

#### Core Animation Optimization
```swift
class OptimizedAnimationView: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Enable rasterization for complex views
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
    }
    
    func performOptimizedAnimation() {
        // Use Core Animation for better performance
        let animation = CABasicAnimation(keyPath: "transform.translation.x")
        animation.toValue = 200
        animation.duration = 0.3
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        
        layer.add(animation, forKey: "translation")
    }
}
```

#### Metal Performance Shaders
```swift
import MetalPerformanceShaders

class MetalRenderer {
    private var device: MTLDevice
    private var commandQueue: MTLCommandQueue
    
    init() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let commandQueue = device.makeCommandQueue() else {
            fatalError("Metal not supported")
        }
        
        self.device = device
        self.commandQueue = commandQueue
    }
    
    func applyImageFilter(to texture: MTLTexture) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: texture.width,
            height: texture.height,
            mipmapped: false
        )
        
        guard let outputTexture = device.makeTexture(descriptor: descriptor),
              let commandBuffer = commandQueue.makeCommandBuffer() else {
            return nil
        }
        
        let filter = MPSImageGaussianBlur(device: device, sigma: 2.0)
        filter.encode(
            commandBuffer: commandBuffer,
            sourceTexture: texture,
            destinationTexture: outputTexture
        )
        
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        return outputTexture
    }
}
```

### Flutter FPS Optimization

#### Widget Build Optimization
```dart
class OptimizedWidget extends StatefulWidget {
  @override
  _OptimizedWidgetState createState() => _OptimizedWidgetState();
}

class _OptimizedWidgetState extends State<OptimizedWidget> {
  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: animationController,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(animation.value * 200, 0),
            child: child,
          );
        },
        child: ExpensiveWidget(), // This won't rebuild every frame
      ),
    );
  }
}
```

#### Skia Engine Optimization
```dart
class CustomPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Use efficient drawing operations
    final paint = Paint()
      ..color = Colors.blue
      ..style = PaintingStyle.fill;
    
    // Batch drawing operations
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height)
      ..close();
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    // Only repaint when necessary
    return false;
  }
}
```

## Animation Performance Optimization

### High-Performance Animation Techniques

#### Property Animation Optimization
```kotlin
// Android - Use ValueAnimator for custom animations
class CustomAnimator {
    fun createOptimizedAnimation(view: View): ValueAnimator {
        return ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 300
            interpolator = AccelerateDecelerateInterpolator()
            
            addUpdateListener { animator ->
                val progress = animator.animatedValue as Float
                view.translationX = progress * 200f
                view.alpha = progress
            }
        }
    }
}
```

```swift
// iOS - Use UIViewPropertyAnimator for modern animations
class AnimationController {
    func createOptimizedAnimation(for view: UIView) {
        let animator = UIViewPropertyAnimator(
            duration: 0.3,
            curve: .easeInOut
        ) {
            view.transform = CGAffineTransform(translationX: 200, y: 0)
            view.alpha = 1.0
        }
        
        animator.startAnimation()
    }
}
```

### Composite Layer Optimization

#### Layer Promotion Strategies
```kotlin
// Android - Hardware layer for animations
class LayerOptimizedView : View {
    fun startOptimizedAnimation() {
        // Promote to hardware layer during animation
        setLayerType(LAYER_TYPE_HARDWARE, null)
        
        animate()
            .translationX(200f)
            .setDuration(300)
            .withEndAction {
                // Remove hardware layer after animation
                setLayerType(LAYER_TYPE_NONE, null)
            }
            .start()
    }
}
```

```swift
// iOS - CALayer optimization
extension UIView {
    func performLayerOptimizedAnimation() {
        // Enable rasterization during animation
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
        
        UIView.animate(
            withDuration: 0.3,
            animations: {
                self.transform = CGAffineTransform(translationX: 200, y: 0)
            },
            completion: { _ in
                // Disable rasterization after animation
                self.layer.shouldRasterize = false
            }
        )
    }
}
```

## Performance Profiling and Monitoring

### Frame Rate Monitoring Tools

#### Real-time Performance Tracking
```kotlin
// Android - Custom FPS counter
class FPSCounter {
    private var frameCount = 0
    private var lastTime = System.currentTimeMillis()
    
    fun onFrame() {
        frameCount++
        val currentTime = System.currentTimeMillis()
        
        if (currentTime - lastTime >= 1000) {
            val fps = frameCount * 1000f / (currentTime - lastTime)
            Log.d("FPS", "Current FPS: $fps")
            
            frameCount = 0
            lastTime = currentTime
        }
    }
}
```

```swift
// iOS - CADisplayLink for FPS monitoring
class FPSMonitor {
    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameCount = 0
    
    func startMonitoring() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func displayLinkFired(_ displayLink: CADisplayLink) {
        if lastTimestamp == 0 {
            lastTimestamp = displayLink.timestamp
            return
        }
        
        frameCount += 1
        let elapsed = displayLink.timestamp - lastTimestamp
        
        if elapsed >= 1.0 {
            let fps = Double(frameCount) / elapsed
            print("Current FPS: \(fps)")
            
            frameCount = 0
            lastTimestamp = displayLink.timestamp
        }
    }
}
```

### Performance Optimization Best Practices

#### Animation Performance Guidelines
1. **Use appropriate animation properties**: Transform, opacity, and other GPU-accelerated properties
2. **Avoid layout thrashing**: Don't animate properties that trigger layout recalculation
3. **Batch animations**: Group multiple animations together when possible
4. **Use easing functions**: Provide natural motion with proper timing curves

#### Memory and CPU Optimization
```dart
// Flutter - Efficient animation disposal
class AnimationController extends StatefulWidget {
  @override
  _AnimationControllerState createState() => _AnimationControllerState();
}

class _AnimationControllerState extends State<AnimationController>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(milliseconds: 300),
      vsync: this,
    );
    
    _animation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }
  
  @override
  void dispose() {
    _controller.dispose(); // Important: Dispose to prevent memory leaks
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Opacity(
          opacity: _animation.value,
          child: child,
        );
      },
      child: Container(
        width: 100,
        height: 100,
        color: Colors.blue,
      ),
    );
  }
}
```

## Advanced FPS Optimization Techniques

### Render Pipeline Optimization

#### GPU Utilization Strategies
```kotlin
// Android - Custom drawable for GPU optimization
class GPUOptimizedDrawable : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    
    override fun draw(canvas: Canvas) {
        // Use hardware-accelerated drawing operations
        canvas.drawRect(bounds, paint)
    }
    
    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
    }
    
    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
    }
    
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
```

### Cross-Platform Performance Strategies

#### React Native FPS Optimization
```javascript
// React Native - Optimized animations
import { Animated, useNativeDriver } from 'react-native';

const OptimizedAnimation = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  const startAnimation = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true, // Critical for performance
    }).start();
  };
  
  return (
    <Animated.View
      style={{
        transform: [{
          translateX: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 200],
          }),
        }],
      }}
    >
      {/* Content */}
    </Animated.View>
  );
};
```

This comprehensive guide covers FPS optimization techniques across all major mobile platforms, providing practical implementation examples and performance monitoring strategies for maintaining smooth 60+ FPS performance in mobile applications.
