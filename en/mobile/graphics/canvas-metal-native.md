# Canvas & Metal/Native UI

This guide covers advanced canvas drawing techniques and native UI rendering optimizations using Metal on iOS and native graphics APIs on Android for high-performance custom UI components.

## iOS Metal Integration

### Metal-backed Custom Views

```swift
// iOS - Metal-powered custom view
import Metal
import MetalKit
import UIKit

class MetalCanvasView: MTKView {
    private var renderer: MetalRenderer!
    private var commandQueue: MTLCommandQueue!
    
    override init(frame frameRect: CGRect, device: MTLDevice?) {
        super.init(frame: frameRect, device: device ?? MTLCreateSystemDefaultDevice())
        setupMetal()
    }
    
    required init(coder: NSCoder) {
        super.init(coder: coder)
        setupMetal()
    }
    
    private func setupMetal() {
        guard let device = device else {
            fatalError("Metal device not available")
        }
        
        commandQueue = device.makeCommandQueue()
        renderer = MetalRenderer(device: device)
        delegate = renderer
        
        // Configure Metal view
        colorPixelFormat = .bgra8Unorm
        clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        
        // Enable high DPI
        contentScaleFactor = UIScreen.main.scale
    }
    
    func addDrawingPath(_ path: [CGPoint], color: UIColor, width: CGFloat) {
        renderer.addPath(path, color: color, width: width)
        setNeedsDisplay()
    }
    
    func clearCanvas() {
        renderer.clearPaths()
        setNeedsDisplay()
    }
}

class MetalRenderer: NSObject, MTKViewDelegate {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private var pipelineState: MTLRenderPipelineState!
    private var vertexBuffer: MTLBuffer!
    private var paths: [DrawingPath] = []
    
    struct DrawingPath {
        let points: [CGPoint]
        let color: UIColor
        let width: CGFloat
    }
    
    struct Vertex {
        let position: SIMD2<Float>
        let color: SIMD4<Float>
    }
    
    init(device: MTLDevice) {
        self.device = device
        self.commandQueue = device.makeCommandQueue()!
        super.init()
        setupPipeline()
    }
    
    private func setupPipeline() {
        let library = device.makeDefaultLibrary()!
        let vertexFunction = library.makeFunction(name: "vertex_main")!
        let fragmentFunction = library.makeFunction(name: "fragment_main")!
        
        let pipelineDescriptor = MTLRenderPipelineDescriptor()
        pipelineDescriptor.vertexFunction = vertexFunction
        pipelineDescriptor.fragmentFunction = fragmentFunction
        pipelineDescriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        
        // Enable blending for smooth lines
        pipelineDescriptor.colorAttachments[0].isBlendingEnabled = true
        pipelineDescriptor.colorAttachments[0].rgbBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].alphaBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].sourceAlphaBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        pipelineDescriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
        
        pipelineState = try! device.makeRenderPipelineState(descriptor: pipelineDescriptor)
    }
    
    func addPath(_ points: [CGPoint], color: UIColor, width: CGFloat) {
        paths.append(DrawingPath(points: points, color: color, width: width))
    }
    
    func clearPaths() {
        paths.removeAll()
    }
    
    // MARK: - MTKViewDelegate
    
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle size changes
    }
    
    func draw(in view: MTKView) {
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let renderPassDescriptor = view.currentRenderPassDescriptor,
              let renderEncoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor),
              let drawable = view.currentDrawable else {
            return
        }
        
        renderEncoder.setRenderPipelineState(pipelineState)
        
        // Draw all paths
        for path in paths {
            if let vertices = generateVertices(for: path, viewSize: view.drawableSize) {
                let vertexBuffer = device.makeBuffer(
                    bytes: vertices,
                    length: vertices.count * MemoryLayout<Vertex>.stride,
                    options: []
                )!
                
                renderEncoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
                renderEncoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: vertices.count)
            }
        }
        
        renderEncoder.endEncoding()
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
    
    private func generateVertices(for path: DrawingPath, viewSize: CGSize) -> [Vertex]? {
        guard path.points.count >= 2 else { return nil }
        
        var vertices: [Vertex] = []
        let color = SIMD4<Float>(
            Float(path.color.cgColor.components?[0] ?? 0),
            Float(path.color.cgColor.components?[1] ?? 0),
            Float(path.color.cgColor.components?[2] ?? 0),
            Float(path.color.cgColor.components?[3] ?? 1)
        )
        
        let halfWidth = Float(path.width) / 2.0
        
        for i in 0..<(path.points.count - 1) {
            let p1 = path.points[i]
            let p2 = path.points[i + 1]
            
            // Convert to normalized device coordinates
            let x1 = Float(p1.x / viewSize.width) * 2.0 - 1.0
            let y1 = 1.0 - Float(p1.y / viewSize.height) * 2.0
            let x2 = Float(p2.x / viewSize.width) * 2.0 - 1.0
            let y2 = 1.0 - Float(p2.y / viewSize.height) * 2.0
            
            // Calculate perpendicular for line width
            let dx = x2 - x1
            let dy = y2 - y1
            let length = sqrt(dx * dx + dy * dy)
            
            if length > 0 {
                let perpX = -dy / length * halfWidth / Float(viewSize.width) * 2.0
                let perpY = dx / length * halfWidth / Float(viewSize.height) * 2.0
                
                // Add quad vertices
                vertices.append(Vertex(position: SIMD2(x1 + perpX, y1 + perpY), color: color))
                vertices.append(Vertex(position: SIMD2(x1 - perpX, y1 - perpY), color: color))
                vertices.append(Vertex(position: SIMD2(x2 + perpX, y2 + perpY), color: color))
                vertices.append(Vertex(position: SIMD2(x2 - perpX, y2 - perpY), color: color))
            }
        }
        
        return vertices
    }
}
```

### Metal Shaders

```metal
// Vertex shader
#include <metal_stdlib>
using namespace metal;

struct VertexIn {
    float2 position [[attribute(0)]];
    float4 color [[attribute(1)]];
};

struct VertexOut {
    float4 position [[position]];
    float4 color;
};

vertex VertexOut vertex_main(VertexIn in [[stage_in]]) {
    VertexOut out;
    out.position = float4(in.position, 0.0, 1.0);
    out.color = in.color;
    return out;
}

fragment float4 fragment_main(VertexOut in [[stage_in]]) {
    return in.color;
}

// Advanced fragment shader with anti-aliasing
fragment float4 fragment_main_aa(VertexOut in [[stage_in]]) {
    float2 center = float2(0.5, 0.5);
    float2 coord = in.position.xy;
    float distance = length(coord - center);
    
    // Anti-aliasing
    float alpha = 1.0 - smoothstep(0.45, 0.5, distance);
    
    return float4(in.color.rgb, in.color.a * alpha);
}
```

## Android Canvas Optimization

### Custom Canvas Drawing

```kotlin
// Android - Optimized custom canvas view
class OptimizedCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {
    
    private val paths = mutableListOf<DrawingPath>()
    private val paint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    
    // Hardware-accelerated bitmap for complex operations
    private var cacheBitmap: Bitmap? = null
    private var cacheCanvas: Canvas? = null
    private var isDirty = true
    
    data class DrawingPath(
        val path: Path,
        val color: Int,
        val strokeWidth: Float
    )
    
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        
        // Create hardware-accelerated bitmap
        cacheBitmap?.recycle()
        cacheBitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        cacheCanvas = Canvas(cacheBitmap!!)
        isDirty = true
    }
    
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        if (isDirty) {
            redrawCache()
            isDirty = false
        }
        
        cacheBitmap?.let { bitmap ->
            canvas.drawBitmap(bitmap, 0f, 0f, null)
        }
    }
    
    private fun redrawCache() {
        cacheCanvas?.let { canvas ->
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
            
            for (drawingPath in paths) {
                paint.color = drawingPath.color
                paint.strokeWidth = drawingPath.strokeWidth
                canvas.drawPath(drawingPath.path, paint)
            }
        }
    }
    
    fun addPath(points: List<PointF>, color: Int, strokeWidth: Float) {
        if (points.size < 2) return
        
        val path = Path().apply {
            moveTo(points[0].x, points[0].y)
            
            // Use quadratic curves for smooth lines
            for (i in 1 until points.size - 1) {
                val x1 = points[i].x
                val y1 = points[i].y
                val x2 = (points[i].x + points[i + 1].x) / 2
                val y2 = (points[i].y + points[i + 1].y) / 2
                
                quadTo(x1, y1, x2, y2)
            }
            
            // Final line to last point
            if (points.size > 1) {
                lineTo(points.last().x, points.last().y)
            }
        }
        
        paths.add(DrawingPath(path, color, strokeWidth))
        isDirty = true
        invalidate()
    }
    
    fun clearPaths() {
        paths.clear()
        isDirty = true
        invalidate()
    }
    
    // Optimize for hardware acceleration
    init {
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }
    
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cacheBitmap?.recycle()
        cacheBitmap = null
        cacheCanvas = null
    }
}
```

### Vulkan Integration (Advanced)

```kotlin
// Android - Vulkan-based rendering
class VulkanCanvasRenderer {
    private external fun nativeInit(): Long
    private external fun nativeRender(nativeHandle: Long, surface: Surface)
    private external fun nativeResize(nativeHandle: Long, width: Int, height: Int)
    private external fun nativeDestroy(nativeHandle: Long)
    private external fun nativeAddPath(nativeHandle: Long, points: FloatArray, color: Int, width: Float)
    
    private var nativeHandle: Long = 0
    
    companion object {
        init {
            System.loadLibrary("vulkan_canvas")
        }
    }
    
    fun initialize(): Boolean {
        nativeHandle = nativeInit()
        return nativeHandle != 0L
    }
    
    fun render(surface: Surface) {
        if (nativeHandle != 0L) {
            nativeRender(nativeHandle, surface)
        }
    }
    
    fun resize(width: Int, height: Int) {
        if (nativeHandle != 0L) {
            nativeResize(nativeHandle, width, height)
        }
    }
    
    fun addPath(points: FloatArray, color: Int, width: Float) {
        if (nativeHandle != 0L) {
            nativeAddPath(nativeHandle, points, color, width)
        }
    }
    
    fun destroy() {
        if (nativeHandle != 0L) {
            nativeDestroy(nativeHandle)
            nativeHandle = 0
        }
    }
}

class VulkanCanvasView(context: Context, attrs: AttributeSet?) : SurfaceView(context, attrs), SurfaceHolder.Callback {
    private val renderer = VulkanCanvasRenderer()
    private var isInitialized = false
    
    init {
        holder.addCallback(this)
    }
    
    override fun surfaceCreated(holder: SurfaceHolder) {
        isInitialized = renderer.initialize()
    }
    
    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (isInitialized) {
            renderer.resize(width, height)
        }
    }
    
    override fun surfaceDestroyed(holder: SurfaceHolder) {
        renderer.destroy()
        isInitialized = false
    }
    
    fun addDrawingPath(points: List<PointF>, color: Int, width: Float) {
        if (isInitialized) {
            val pointArray = FloatArray(points.size * 2)
            points.forEachIndexed { index, point ->
                pointArray[index * 2] = point.x
                pointArray[index * 2 + 1] = point.y
            }
            renderer.addPath(pointArray, color, width)
            holder.surface?.let { renderer.render(it) }
        }
    }
}
```

## Cross-Platform Canvas Solutions

### React Native Canvas

```typescript
// React Native - High-performance canvas component
import React, { useRef, useCallback, useMemo } from 'react';
import { View, PanGestureHandler, State } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedProps,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

interface CanvasPath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
}

interface Point {
  x: number;
  y: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const HighPerformanceCanvas: React.FC = () => {
  const paths = useSharedValue<CanvasPath[]>([]);
  const currentPath = useSharedValue<Point[]>([]);
  const pathId = useRef(0);
  
  const generatePathData = useCallback((points: Point[]): string => {
    if (points.length < 2) return '';
    
    let pathData = `M${points[0].x},${points[0].y}`;
    
    // Use quadratic curves for smooth drawing
    for (let i = 1; i < points.length - 1; i++) {
      const cpx = (points[i].x + points[i + 1].x) / 2;
      const cpy = (points[i].y + points[i + 1].y) / 2;
      pathData += ` Q${points[i].x},${points[i].y} ${cpx},${cpy}`;
    }
    
    // End with final point
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      pathData += ` L${lastPoint.x},${lastPoint.y}`;
    }
    
    return pathData;
  }, []);
  
  const addPathToCanvas = useCallback((pathData: string) => {
    const newPath: CanvasPath = {
      id: `path_${pathId.current++}`,
      d: pathData,
      color: '#000000',
      strokeWidth: 3,
    };
    
    paths.value = [...paths.value, newPath];
  }, []);
  
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      currentPath.value = [];
    },
    onActive: (event, context) => {
      const newPoint = { x: event.x, y: event.y };
      currentPath.value = [...currentPath.value, newPoint];
    },
    onEnd: () => {
      if (currentPath.value.length > 1) {
        const pathData = generatePathData(currentPath.value);
        runOnJS(addPathToCanvas)(pathData);
      }
      currentPath.value = [];
    },
  });
  
  const animatedCurrentPathProps = useAnimatedProps(() => ({
    d: generatePathData(currentPath.value),
  }));
  
  const renderedPaths = useMemo(() => 
    paths.value.map((path) => (
      <Path
        key={path.id}
        d={path.d}
        stroke={path.color}
        strokeWidth={path.strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )), [paths.value]
  );
  
  return (
    <View style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={{ flex: 1 }}>
          <Svg style={{ flex: 1 }}>
            <G>
              {renderedPaths}
              <AnimatedPath
                animatedProps={animatedCurrentPathProps}
                stroke="#000000"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </Svg>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

export default HighPerformanceCanvas;
```

### Flutter Custom Painter

```dart
// Flutter - Optimized custom painter
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

class HighPerformanceCanvasPainter extends CustomPainter {
  final List<DrawingPath> paths;
  final DrawingPath? currentPath;
  
  HighPerformanceCanvasPainter({
    required this.paths,
    this.currentPath,
  });
  
  @override
  void paint(Canvas canvas, Size size) {
    // Draw completed paths
    for (final path in paths) {
      _drawPath(canvas, path);
    }
    
    // Draw current path if exists
    if (currentPath != null) {
      _drawPath(canvas, currentPath!);
    }
  }
  
  void _drawPath(Canvas canvas, DrawingPath drawingPath) {
    if (drawingPath.points.length < 2) return;
    
    final paint = Paint()
      ..color = drawingPath.color
      ..strokeWidth = drawingPath.strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    
    final path = Path();
    final points = drawingPath.points;
    
    path.moveTo(points[0].dx, points[0].dy);
    
    // Use quadratic curves for smooth lines
    for (int i = 1; i < points.length - 1; i++) {
      final cp = Offset(
        (points[i].dx + points[i + 1].dx) / 2,
        (points[i].dy + points[i + 1].dy) / 2,
      );
      path.quadraticBezierTo(points[i].dx, points[i].dy, cp.dx, cp.dy);
    }
    
    // Connect to last point
    if (points.length > 1) {
      path.lineTo(points.last.dx, points.last.dy);
    }
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(CustomPainter oldDelegate) {
    if (oldDelegate is HighPerformanceCanvasPainter) {
      return paths != oldDelegate.paths || currentPath != oldDelegate.currentPath;
    }
    return true;
  }
  
  @override
  bool shouldRebuildSemantics(CustomPainter oldDelegate) => false;
}

class DrawingPath {
  final List<Offset> points;
  final Color color;
  final double strokeWidth;
  
  const DrawingPath({
    required this.points,
    required this.color,
    required this.strokeWidth,
  });
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DrawingPath &&
        other.points == points &&
        other.color == color &&
        other.strokeWidth == strokeWidth;
  }
  
  @override
  int get hashCode => Object.hash(points, color, strokeWidth);
}

class HighPerformanceCanvasWidget extends StatefulWidget {
  @override
  _HighPerformanceCanvasWidgetState createState() => _HighPerformanceCanvasWidgetState();
}

class _HighPerformanceCanvasWidgetState extends State<HighPerformanceCanvasWidget> {
  List<DrawingPath> paths = [];
  List<Offset> currentPoints = [];
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: (details) {
        setState(() {
          currentPoints = [details.localPosition];
        });
      },
      onPanUpdate: (details) {
        setState(() {
          currentPoints.add(details.localPosition);
        });
      },
      onPanEnd: (details) {
        setState(() {
          if (currentPoints.length > 1) {
            paths.add(DrawingPath(
              points: List.from(currentPoints),
              color: Colors.black,
              strokeWidth: 3.0,
            ));
          }
          currentPoints.clear();
        });
      },
      child: CustomPaint(
        painter: HighPerformanceCanvasPainter(
          paths: paths,
          currentPath: currentPoints.isNotEmpty
              ? DrawingPath(
                  points: currentPoints,
                  color: Colors.black,
                  strokeWidth: 3.0,
                )
              : null,
        ),
        size: Size.infinite,
      ),
    );
  }
}
```

## Performance Optimization Techniques

### Memory Management

```swift
// iOS - Memory-efficient canvas rendering
class MemoryEfficientCanvasRenderer {
    private var tileCache: [String: UIImage] = [:]
    private let tileSize: CGSize = CGSize(width: 256, height: 256)
    private let maxCacheSize = 50
    
    func renderTile(at position: CGPoint, paths: [DrawingPath]) -> UIImage? {
        let tileKey = "\(Int(position.x))_\(Int(position.y))"
        
        if let cachedTile = tileCache[tileKey] {
            return cachedTile
        }
        
        let renderer = UIGraphicsImageRenderer(size: tileSize)
        let tileImage = renderer.image { context in
            let cgContext = context.cgContext
            
            // Only render paths that intersect with this tile
            let tileRect = CGRect(origin: position, size: tileSize)
            
            for path in paths {
                if path.boundingBox.intersects(tileRect) {
                    cgContext.setStrokeColor(path.color.cgColor)
                    cgContext.setLineWidth(path.strokeWidth)
                    cgContext.addPath(path.path)
                    cgContext.strokePath()
                }
            }
        }
        
        // Cache management
        if tileCache.count >= maxCacheSize {
            // Remove oldest tile (simple LRU would be better)
            if let firstKey = tileCache.keys.first {
                tileCache.removeValue(forKey: firstKey)
            }
        }
        
        tileCache[tileKey] = tileImage
        return tileImage
    }
    
    func clearCache() {
        tileCache.removeAll()
    }
}
```

### Async Rendering

```kotlin
// Android - Background rendering pipeline
class AsyncCanvasRenderer {
    private val renderExecutor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    
    fun renderAsync(
        paths: List<DrawingPath>,
        canvasSize: Size,
        callback: (Bitmap) -> Unit
    ) {
        renderExecutor.execute {
            val bitmap = Bitmap.createBitmap(
                canvasSize.width.toInt(),
                canvasSize.height.toInt(),
                Bitmap.Config.ARGB_8888
            )
            
            val canvas = Canvas(bitmap)
            val paint = Paint().apply {
                isAntiAlias = true
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
            
            // Render all paths
            for (path in paths) {
                paint.color = path.color
                paint.strokeWidth = path.strokeWidth
                canvas.drawPath(path.path, paint)
            }
            
            // Return result on main thread
            mainHandler.post {
                callback(bitmap)
            }
        }
    }
    
    fun batchRender(
        pathBatches: List<List<DrawingPath>>,
        canvasSize: Size,
        progressCallback: (Int, Bitmap) -> Unit
    ) {
        renderExecutor.execute {
            pathBatches.forEachIndexed { index, paths ->
                val bitmap = Bitmap.createBitmap(
                    canvasSize.width.toInt(),
                    canvasSize.height.toInt(),
                    Bitmap.Config.ARGB_8888
                )
                
                // Render batch
                renderPaths(bitmap, paths)
                
                mainHandler.post {
                    progressCallback(index, bitmap)
                }
            }
        }
    }
    
    private fun renderPaths(bitmap: Bitmap, paths: List<DrawingPath>) {
        // Implementation details...
    }
}
```

## Best Practices

### Performance Guidelines

1. **Use hardware acceleration**
   - Enable GPU rendering where possible
   - Use Metal/Vulkan for complex operations
   - Leverage platform-specific optimizations

2. **Optimize memory usage**
   - Implement tile-based rendering for large canvases
   - Use object pooling for frequent allocations
   - Cache rendered content appropriately

3. **Smooth interaction**
   - Render on background threads
   - Use interpolation for smooth curves
   - Implement predictive rendering

4. **Platform optimization**
   - Use native APIs when possible
   - Leverage hardware-specific features
   - Implement appropriate fallbacks

Canvas and native UI rendering require careful balance between performance and visual quality. Metal and modern graphics APIs provide powerful tools for creating smooth, responsive drawing experiences while maintaining optimal performance across different devices.
