# Canvas & Metal/OpenGL ES vs. Native UI

## Canvas Tabanlı Custom Drawing

### Android Canvas API
Android Canvas sistemi, 2D grafik çizimi için güçlü ve esnek bir framework sağlar. Hardware acceleration ile birlikte yüksek performanslı custom UI bileşenleri oluşturmaya olanak tanır.

#### Advanced Canvas Techniques
```kotlin
class AdvancedCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {
    
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val path = Path()
    private val matrix = Matrix()
    private val gradientShader: LinearGradient
    private val shadowPaint = Paint()
    
    // Animation properties
    private var animationProgress = 0f
    private val valueAnimator = ValueAnimator.ofFloat(0f, 1f)
    
    init {
        // Gradient shader oluştur
        gradientShader = LinearGradient(
            0f, 0f, 0f, 200f,
            intArrayOf(Color.CYAN, Color.BLUE, Color.MAGENTA),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        
        // Shadow paint ayarla
        shadowPaint.apply {
            color = Color.BLACK
            alpha = 100
            maskFilter = BlurMaskFilter(8f, BlurMaskFilter.Blur.NORMAL)
        }
        
        setupAnimator()
    }
    
    private fun setupAnimator() {
        valueAnimator.apply {
            duration = 2000
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            
            addUpdateListener { animator ->
                animationProgress = animator.animatedValue as Float
                invalidate()
            }
        }
        valueAnimator.start()
    }
    
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        val centerX = width / 2f
        val centerY = height / 2f
        val radius = (Math.min(width, height) / 3f) * (0.8f + 0.2f * animationProgress)
        
        // Background gradient
        drawBackgroundGradient(canvas)
        
        // Shadow layer
        drawShadowLayer(canvas, centerX, centerY + 10f, radius)
        
        // Main shape with complex path
        drawMainShape(canvas, centerX, centerY, radius)
        
        // Overlay effects
        drawOverlayEffects(canvas, centerX, centerY, radius)
    }
    
    private fun drawBackgroundGradient(canvas: Canvas) {
        paint.shader = gradientShader
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null
    }
    
    private fun drawShadowLayer(canvas: Canvas, x: Float, y: Float, radius: Float) {
        canvas.drawCircle(x, y, radius, shadowPaint)
    }
    
    private fun drawMainShape(canvas: Canvas, centerX: Float, centerY: Float, radius: Float) {
        path.reset()
        
        // Karmaşık path oluştur (yıldız benzeri şekil)
        val points = 8
        val outerRadius = radius
        val innerRadius = radius * 0.6f
        
        for (i in 0 until points * 2) {
            val angle = (i * Math.PI / points).toFloat()
            val currentRadius = if (i % 2 == 0) outerRadius else innerRadius
            val x = centerX + cos(angle) * currentRadius
            val y = centerY + sin(angle) * currentRadius
            
            if (i == 0) {
                path.moveTo(x, y)
            } else {
                path.lineTo(x, y)
            }
        }
        path.close()
        
        // Matrix transformations
        matrix.reset()
        matrix.postRotate(animationProgress * 360f, centerX, centerY)
        matrix.postScale(
            1f + animationProgress * 0.1f,
            1f + animationProgress * 0.1f,
            centerX,
            centerY
        )
        path.transform(matrix)
        
        // Fill with gradient
        paint.apply {
            style = Paint.Style.FILL
            color = Color.WHITE
            alpha = (255 * (0.8f + 0.2f * animationProgress)).toInt()
        }
        canvas.drawPath(path, paint)
        
        // Stroke
        paint.apply {
            style = Paint.Style.STROKE
            strokeWidth = 4f
            color = Color.BLACK
            alpha = 255
        }
        canvas.drawPath(path, paint)
    }
    
    private fun drawOverlayEffects(canvas: Canvas, centerX: Float, centerY: Float, radius: Float) {
        // Particle effect benzeri circles
        paint.style = Paint.Style.FILL
        for (i in 0 until 5) {
            val angle = (animationProgress * 360f + i * 72f) * Math.PI / 180f
            val distance = radius * 1.5f
            val x = centerX + cos(angle) * distance
            val y = centerY + sin(angle) * distance
            val particleRadius = 8f * (1f - animationProgress * 0.3f)
            
            paint.apply {
                color = Color.YELLOW
                alpha = (255 * (1f - animationProgress)).toInt()
            }
            canvas.drawCircle(x.toFloat(), y.toFloat(), particleRadius, paint)
        }
    }
    
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        valueAnimator.cancel()
    }
}
```

#### Performance-Optimized Canvas Drawing
```kotlin
class OptimizedCanvasRenderer {
    private val pathCache = mutableMapOf<String, Path>()
    private val paintCache = mutableMapOf<String, Paint>()
    private val bitmapCache = LruCache<String, Bitmap>(20)
    
    fun drawOptimizedChart(
        canvas: Canvas,
        dataPoints: List<PointF>,
        bounds: RectF
    ) {
        // Path caching
        val pathKey = "chart_${dataPoints.hashCode()}"
        val path = pathCache.getOrPut(pathKey) {
            createChartPath(dataPoints, bounds)
        }
        
        // Paint caching
        val linePaint = paintCache.getOrPut("line_paint") {
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 4f
                color = Color.BLUE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
        }
        
        val fillPaint = paintCache.getOrPut("fill_paint") {
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                shader = LinearGradient(
                    bounds.left, bounds.top,
                    bounds.left, bounds.bottom,
                    Color.BLUE, Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
                )
                alpha = 100
            }
        }
        
        // Efficient drawing
        canvas.drawPath(path, fillPaint)
        canvas.drawPath(path, linePaint)
    }
    
    private fun createChartPath(dataPoints: List<PointF>, bounds: RectF): Path {
        val path = Path()
        
        if (dataPoints.isEmpty()) return path
        
        // Move to first point
        path.moveTo(dataPoints[0].x, dataPoints[0].y)
        
        // Smooth curve through points (Catmull-Rom spline)
        for (i in 1 until dataPoints.size - 1) {
            val p0 = if (i > 0) dataPoints[i - 1] else dataPoints[i]
            val p1 = dataPoints[i]
            val p2 = dataPoints[i + 1]
            val p3 = if (i < dataPoints.size - 2) dataPoints[i + 2] else dataPoints[i + 1]
            
            // Control points for smooth curve
            val cp1x = p1.x + (p2.x - p0.x) / 6f
            val cp1y = p1.y + (p2.y - p0.y) / 6f
            val cp2x = p2.x - (p3.x - p1.x) / 6f
            val cp2y = p2.y - (p3.y - p1.y) / 6f
            
            path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
        }
        
        return path
    }
}
```

### iOS Core Graphics ve Custom Drawing

#### Advanced Core Graphics Implementation
```swift
class AdvancedDrawingView: UIView {
    private var animationProgress: CGFloat = 0
    private var displayLink: CADisplayLink?
    private let particleSystem = ParticleSystem()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupAnimation()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupAnimation()
    }
    
    private func setupAnimation() {
        displayLink = CADisplayLink(target: self, selector: #selector(updateAnimation))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    @objc private func updateAnimation() {
        animationProgress += 0.016 // ~60 FPS
        if animationProgress > 1.0 {
            animationProgress = 0
        }
        
        particleSystem.update(deltaTime: 0.016)
        setNeedsDisplay()
    }
    
    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        
        // Background gradient
        drawBackgroundGradient(in: context, rect: rect)
        
        // Complex shapes with transforms
        drawAnimatedShapes(in: context, rect: rect)
        
        // Particle system
        particleSystem.render(in: context)
        
        // Text with custom effects
        drawStyledText(in: context, rect: rect)
    }
    
    private func drawBackgroundGradient(in context: CGContext, rect: CGRect) {
        let colors = [UIColor.blue.cgColor, UIColor.purple.cgColor, UIColor.black.cgColor]
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let gradient = CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: [0, 0.5, 1])!
        
        context.drawLinearGradient(
            gradient,
            start: CGPoint.zero,
            end: CGPoint(x: rect.width, y: rect.height),
            options: []
        )
    }
    
    private func drawAnimatedShapes(in context: CGContext, rect: CGRect) {
        context.saveGState()
        
        let centerX = rect.width / 2
        let centerY = rect.height / 2
        
        // Apply transforms
        context.translateBy(x: centerX, y: centerY)
        context.rotate(by: animationProgress * 2 * .pi)
        context.scaleBy(x: 1 + animationProgress * 0.2, y: 1 + animationProgress * 0.2)
        
        // Draw complex path
        let path = CGMutablePath()
        let radius: CGFloat = 60
        let points = 6
        
        for i in 0..<points {
            let angle = CGFloat(i) * 2 * .pi / CGFloat(points)
            let x = cos(angle) * radius
            let y = sin(angle) * radius
            
            if i == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        path.closeSubpath()
        
        // Fill with pattern
        context.setFillColor(UIColor.white.withAlphaComponent(0.8).cgColor)
        context.addPath(path)
        context.fillPath()
        
        // Stroke with shadow
        context.setShadow(offset: CGSize(width: 2, height: 2), blur: 4)
        context.setStrokeColor(UIColor.yellow.cgColor)
        context.setLineWidth(3)
        context.addPath(path)
        context.strokePath()
        
        context.restoreGState()
    }
    
    private func drawStyledText(in context: CGContext, rect: CGRect) {
        let text = "Advanced Graphics"
        let font = UIFont.boldSystemFont(ofSize: 24)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.white,
            .strokeColor: UIColor.black,
            .strokeWidth: -2.0
        ]
        
        let attributedString = NSAttributedString(string: text, attributes: attributes)
        let textSize = attributedString.size()
        let textRect = CGRect(
            x: (rect.width - textSize.width) / 2,
            y: rect.height - textSize.height - 20,
            width: textSize.width,
            height: textSize.height
        )
        
        attributedString.draw(in: textRect)
    }
    
    deinit {
        displayLink?.invalidate()
    }
}

// Particle System for advanced effects
class ParticleSystem {
    private var particles: [Particle] = []
    private let maxParticles = 50
    
    init() {
        for _ in 0..<maxParticles {
            particles.append(Particle())
        }
    }
    
    func update(deltaTime: TimeInterval) {
        for particle in particles {
            particle.update(deltaTime: deltaTime)
        }
    }
    
    func render(in context: CGContext) {
        for particle in particles {
            particle.render(in: context)
        }
    }
}

class Particle {
    var position: CGPoint
    var velocity: CGPoint
    var life: CGFloat
    var maxLife: CGFloat
    var color: UIColor
    
    init() {
        position = CGPoint(x: CGFloat.random(in: 0...400), y: CGFloat.random(in: 0...800))
        velocity = CGPoint(x: CGFloat.random(in: -50...50), y: CGFloat.random(in: -100...0))
        life = 1.0
        maxLife = 1.0
        color = UIColor(hue: CGFloat.random(in: 0...1), saturation: 1, brightness: 1, alpha: 1)
    }
    
    func update(deltaTime: TimeInterval) {
        position.x += velocity.x * CGFloat(deltaTime)
        position.y += velocity.y * CGFloat(deltaTime)
        life -= CGFloat(deltaTime)
        
        if life <= 0 {
            // Reset particle
            position = CGPoint(x: CGFloat.random(in: 0...400), y: 800)
            life = maxLife
        }
    }
    
    func render(in context: CGContext) {
        let alpha = life / maxLife
        context.setFillColor(color.withAlphaComponent(alpha).cgColor)
        context.fillEllipse(in: CGRect(x: position.x - 2, y: position.y - 2, width: 4, height: 4))
    }
}
```

## Metal ve OpenGL ES ile Low-Level Graphics

### Metal Shaders ve Advanced Rendering
```swift
import Metal
import MetalKit

class MetalAdvancedRenderer: NSObject, MTKViewDelegate {
    private var device: MTLDevice
    private var commandQueue: MTLCommandQueue
    private var renderPipelineState: MTLRenderPipelineState
    private var computePipelineState: MTLComputePipelineState
    private var vertexBuffer: MTLBuffer
    private var uniformBuffer: MTLBuffer
    
    struct Uniforms {
        var time: Float
        var resolution: simd_float2
        var modelViewProjectionMatrix: simd_float4x4
    }
    
    init?(metalKitView: MTKView) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let commandQueue = device.makeCommandQueue() else {
            return nil
        }
        
        self.device = device
        self.commandQueue = commandQueue
        
        // Vertex data
        let vertices: [Float] = [
            -1.0, -1.0, 0.0, 1.0,  // Bottom-left
             1.0, -1.0, 0.0, 1.0,  // Bottom-right
             1.0,  1.0, 0.0, 1.0,  // Top-right
            -1.0,  1.0, 0.0, 1.0   // Top-left
        ]
        
        vertexBuffer = device.makeBuffer(bytes: vertices, length: vertices.count * MemoryLayout<Float>.size, options: [])!
        uniformBuffer = device.makeBuffer(length: MemoryLayout<Uniforms>.size, options: [])!
        
        super.init()
        
        setupPipelines(metalKitView: metalKitView)
        
        metalKitView.device = device
        metalKitView.delegate = self
        metalKitView.colorPixelFormat = .bgra8Unorm
    }
    
    private func setupPipelines(metalKitView: MTKView) {
        guard let library = device.makeDefaultLibrary() else {
            fatalError("Could not load default library")
        }
        
        // Render pipeline
        let vertexFunction = library.makeFunction(name: "vertexShader")
        let fragmentFunction = library.makeFunction(name: "fragmentShader")
        
        let renderPipelineDescriptor = MTLRenderPipelineDescriptor()
        renderPipelineDescriptor.vertexFunction = vertexFunction
        renderPipelineDescriptor.fragmentFunction = fragmentFunction
        renderPipelineDescriptor.colorAttachments[0].pixelFormat = metalKitView.colorPixelFormat
        
        do {
            renderPipelineState = try device.makeRenderPipelineState(descriptor: renderPipelineDescriptor)
        } catch {
            fatalError("Could not create render pipeline state: \(error)")
        }
        
        // Compute pipeline
        let computeFunction = library.makeFunction(name: "postProcessCompute")!
        do {
            computePipelineState = try device.makeComputePipelineState(function: computeFunction)
        } catch {
            fatalError("Could not create compute pipeline state: \(error)")
        }
    }
    
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle size changes
    }
    
    func draw(in view: MTKView) {
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let renderPassDescriptor = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable else {
            return
        }
        
        // Update uniforms
        let uniforms = Uniforms(
            time: Float(CACurrentMediaTime()),
            resolution: simd_float2(Float(view.bounds.width), Float(view.bounds.height)),
            modelViewProjectionMatrix: matrix_identity_float4x4
        )
        
        let uniformBufferPointer = uniformBuffer.contents().bindMemory(to: Uniforms.self, capacity: 1)
        uniformBufferPointer.pointee = uniforms
        
        // Render pass
        let renderEncoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)!
        renderEncoder.setRenderPipelineState(renderPipelineState)
        renderEncoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
        renderEncoder.setVertexBuffer(uniformBuffer, offset: 0, index: 1)
        renderEncoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 0)
        renderEncoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
        renderEncoder.endEncoding()
        
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

### Metal Shaders (MSL)
```metal
// Vertex Shader
#include <metal_stdlib>
using namespace metal;

struct Vertex {
    float4 position [[attribute(0)]];
};

struct Uniforms {
    float time;
    float2 resolution;
    float4x4 modelViewProjectionMatrix;
};

struct VertexOut {
    float4 position [[position]];
    float2 uv;
};

vertex VertexOut vertexShader(
    const device Vertex* vertices [[buffer(0)]],
    const device Uniforms& uniforms [[buffer(1)]],
    uint vid [[vertex_id]]
) {
    VertexOut out;
    out.position = uniforms.modelViewProjectionMatrix * vertices[vid].position;
    out.uv = (vertices[vid].position.xy + 1.0) * 0.5;
    return out;
}

// Fragment Shader with procedural graphics
fragment float4 fragmentShader(
    VertexOut in [[stage_in]],
    const device Uniforms& uniforms [[buffer(0)]]
) {
    float2 uv = in.uv;
    float2 center = float2(0.5);
    float2 pos = uv - center;
    
    // Animated parameters
    float time = uniforms.time;
    float aspect = uniforms.resolution.x / uniforms.resolution.y;
    pos.x *= aspect;
    
    // Distance field calculations
    float distance = length(pos);
    float angle = atan2(pos.y, pos.x);
    
    // Animated pattern
    float pattern = sin(distance * 20.0 - time * 2.0) * 0.5 + 0.5;
    float spiral = sin(angle * 5.0 + distance * 10.0 - time) * 0.5 + 0.5;
    
    // Color mixing
    float3 color1 = float3(0.2, 0.7, 1.0);
    float3 color2 = float3(1.0, 0.3, 0.8);
    float3 finalColor = mix(color1, color2, pattern * spiral);
    
    // Vignette effect
    float vignette = 1.0 - smoothstep(0.3, 0.8, distance);
    finalColor *= vignette;
    
    return float4(finalColor, 1.0);
}

// Compute Shader for post-processing
kernel void postProcessCompute(
    texture2d<float, access::read> inputTexture [[texture(0)]],
    texture2d<float, access::write> outputTexture [[texture(1)]],
    const device Uniforms& uniforms [[buffer(0)]],
    uint2 gid [[thread_position_in_grid]]
) {
    if (gid.x >= outputTexture.get_width() || gid.y >= outputTexture.get_height()) {
        return;
    }
    
    float2 textureSize = float2(inputTexture.get_width(), inputTexture.get_height());
    float2 uv = float2(gid) / textureSize;
    
    // Sample neighboring pixels for blur effect
    float4 color = float4(0.0);
    int kernelSize = 3;
    float weight = 1.0 / float(kernelSize * kernelSize);
    
    for (int x = -kernelSize/2; x <= kernelSize/2; x++) {
        for (int y = -kernelSize/2; y <= kernelSize/2; y++) {
            uint2 sampleCoord = uint2(
                clamp(int(gid.x) + x, 0, int(textureSize.x) - 1),
                clamp(int(gid.y) + y, 0, int(textureSize.y) - 1)
            );
            color += inputTexture.read(sampleCoord) * weight;
        }
    }
    
    // Apply color grading
    color.rgb = pow(color.rgb, float3(1.2));
    color.rgb = saturate(color.rgb * 1.1);
    
    outputTexture.write(color, gid);
}
```

## Native UI vs Custom Graphics Performance

## Native UI vs Custom Graphics Comparison

### Performance Characteristics
```
Performance Metrics Comparison:
┌─────────────────────┬─────────────┬──────────────┬─────────────┐
│ Aspect              │ Native UI   │ Canvas API   │ Metal/GL    │
├─────────────────────┼─────────────┼──────────────┼─────────────┤
│ Setup Overhead      │ Low         │ Medium       │ High        │
│ Rendering Speed     │ Fast        │ Medium       │ Very Fast   │
│ Memory Usage        │ Optimized   │ High         │ Variable    │
│ Flexibility         │ Limited     │ High         │ Very High   │
│ Platform Integration│ Excellent   │ Good         │ Limited     │
│ Learning Curve      │ Easy        │ Medium       │ Hard        │
└─────────────────────┴─────────────┴──────────────┴─────────────┘
```

## Android Canvas API Advanced Techniques

### Custom ViewGroup with Hardware Acceleration
```kotlin
class PerformanceCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {
    
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.BLUE
    }
    
    private val path = Path()
    private val matrix = Matrix()
    private val rect = RectF()
    
    // Hardware acceleration optimization
    private var bitmap: Bitmap? = null
    private var bitmapCanvas: Canvas? = null
    private var isDirty = true
    
    init {
        // Enable hardware acceleration
        setLayerType(LAYER_TYPE_HARDWARE, null)
        
        // Optimize drawing
        setWillNotDraw(false)
    }
    
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        
        // Create offscreen bitmap for complex drawings
        bitmap?.recycle()
        bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        bitmapCanvas = Canvas(bitmap!!)
        isDirty = true
    }
    
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        // Only redraw if necessary
        if (isDirty) {
            drawComplexGraphics(bitmapCanvas!!)
            isDirty = false
        }
        
        // Draw cached bitmap
        bitmap?.let { canvas.drawBitmap(it, 0f, 0f, null) }
        
        // Draw dynamic elements directly
        drawDynamicElements(canvas)
    }
    
    private fun drawComplexGraphics(canvas: Canvas) {
        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
        
        // Complex path drawing
        path.reset()
        path.moveTo(50f, 50f)
        path.quadTo(100f, 25f, 150f, 50f)
        path.quadTo(200f, 75f, 250f, 50f)
        
        // Gradient shader
        val gradient = LinearGradient(
            0f, 0f, width.toFloat(), height.toFloat(),
            intArrayOf(Color.RED, Color.GREEN, Color.BLUE),
            null,
            Shader.TileMode.CLAMP
        )
        paint.shader = gradient
        
        canvas.drawPath(path, paint)
        
        // Reset shader
        paint.shader = null
    }
    
    private fun drawDynamicElements(canvas: Canvas) {
        // Draw elements that change frequently
        val time = System.currentTimeMillis()
        val x = (Math.sin(time * 0.001) * 100 + width / 2).toFloat()
        val y = (Math.cos(time * 0.001) * 100 + height / 2).toFloat()
        
        paint.color = Color.YELLOW
        canvas.drawCircle(x, y, 20f, paint)
    }
    
    fun invalidateDrawing() {
        isDirty = true
        invalidate()
    }
    
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        bitmap?.recycle()
        bitmap = null
        bitmapCanvas = null
    }
}
```

### Advanced Canvas Transformations
```kotlin
class TransformationCanvas : View {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val matrix = Matrix()
    private val camera = Camera()
    
    private var rotationX = 0f
    private var rotationY = 0f
    private var rotationZ = 0f
    
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        val centerX = width / 2f
        val centerY = height / 2f
        
        // 3D transformation using Camera
        camera.save()
        camera.rotateX(rotationX)
        camera.rotateY(rotationY)
        camera.rotateZ(rotationZ)
        camera.getMatrix(matrix)
        camera.restore()
        
        // Adjust matrix for center rotation
        matrix.preTranslate(-centerX, -centerY)
        matrix.postTranslate(centerX, centerY)
        
        canvas.save()
        canvas.concat(matrix)
        
        // Draw 3D-transformed content
        paint.color = Color.BLUE
        canvas.drawRect(
            centerX - 100f, centerY - 100f,
            centerX + 100f, centerY + 100f,
            paint
        )
        
        canvas.restore()
        
        // Advanced clipping
        drawClippedGraphics(canvas)
    }
    
    private fun drawClippedGraphics(canvas: Canvas) {
        canvas.save()
        
        // Create complex clipping path
        val clipPath = Path().apply {
            addCircle(width / 4f, height / 4f, 100f, Path.Direction.CW)
            addRect(
                width * 3f / 4f - 50f, height / 4f - 50f,
                width * 3f / 4f + 50f, height / 4f + 50f,
                Path.Direction.CW
            )
        }
        
        canvas.clipPath(clipPath)
        
        // Draw gradient background
        val gradient = RadialGradient(
            width / 2f, height / 2f, width / 2f,
            intArrayOf(Color.MAGENTA, Color.CYAN, Color.YELLOW),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        
        paint.shader = gradient
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null
        
        canvas.restore()
    }
    
    fun setRotation(x: Float, y: Float, z: Float) {
        rotationX = x
        rotationY = y
        rotationZ = z
        invalidate()
    }
}
```

## iOS Core Graphics Advanced Implementation

### Custom Core Graphics Drawing
```swift
import UIKit
import CoreGraphics
import QuartzCore

class AdvancedCoreGraphicsView: UIView {
    private var cachedLayer: CALayer?
    private var needsRedraw = true
    
    override class var layerClass: AnyClass {
        return CALayer.self
    }
    
    override func awakeFromNib() {
        super.awakeFromNib()
        setupOptimizations()
    }
    
    private func setupOptimizations() {
        // Enable rasterization for complex drawings
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
        
        // Set drawing delegate
        layer.delegate = self
        layer.setNeedsDisplay()
    }
    
    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        
        if needsRedraw {
            drawComplexGraphics(in: context, rect: rect)
            needsRedraw = false
        }
        
        drawDynamicContent(in: context, rect: rect)
    }
    
    private func drawComplexGraphics(in context: CGContext, rect: CGRect) {
        // Create gradient
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let colors = [UIColor.red.cgColor, UIColor.blue.cgColor, UIColor.green.cgColor]
        let locations: [CGFloat] = [0.0, 0.5, 1.0]
        
        guard let gradient = CGGradient(colorsSpace: colorSpace,
                                      colors: colors as CFArray,
                                      locations: locations) else { return }
        
        // Draw radial gradient
        context.drawRadialGradient(
            gradient,
            startCenter: CGPoint(x: rect.midX, y: rect.midY),
            startRadius: 0,
            endCenter: CGPoint(x: rect.midX, y: rect.midY),
            endRadius: min(rect.width, rect.height) / 2,
            options: []
        )
        
        // Complex path with Bezier curves
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 50, y: 50))
        path.addQuadCurve(
            to: CGPoint(x: 250, y: 50),
            control: CGPoint(x: 150, y: 20)
        )
        path.addQuadCurve(
            to: CGPoint(x: 250, y: 250),
            control: CGPoint(x: 280, y: 150)
        )
        path.addQuadCurve(
            to: CGPoint(x: 50, y: 250),
            control: CGPoint(x: 150, y: 280)
        )
        path.addQuadCurve(
            to: CGPoint(x: 50, y: 50),
            control: CGPoint(x: 20, y: 150)
        )
        
        context.setFillColor(UIColor.yellow.withAlphaComponent(0.7).cgColor)
        context.addPath(path)
        context.fillPath()
    }
    
    private func drawDynamicContent(in context: CGContext, rect: CGRect) {
        // Animated circle
        let time = CACurrentMediaTime()
        let x = sin(time) * 50 + rect.midX
        let y = cos(time) * 50 + rect.midY
        
        context.setFillColor(UIColor.orange.cgColor)
        context.fillEllipse(in: CGRect(x: x - 15, y: y - 15, width: 30, height: 30))
        
        // Text rendering with custom attributes
        drawCustomText(in: context, at: CGPoint(x: rect.midX, y: rect.maxY - 50))
    }
    
    private func drawCustomText(in context: CGContext, at point: CGPoint) {
        let text = "Advanced Core Graphics"
        let font = CTFontCreateWithName("Helvetica-Bold" as CFString, 20, nil)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor.white,
            .strokeColor: UIColor.black,
            .strokeWidth: -2.0
        ]
        
        let attributedString = NSAttributedString(string: text, attributes: attributes)
        let line = CTLineCreateWithAttributedString(attributedString)
        
        context.saveGState()
        context.textPosition = point
        CTLineDraw(line, context)
        context.restoreGState()
    }
    
    func invalidateDrawing() {
        needsRedraw = true
        setNeedsDisplay()
    }
}

// MARK: - CALayerDelegate
extension AdvancedCoreGraphicsView: CALayerDelegate {
    func draw(_ layer: CALayer, in ctx: CGContext) {
        // Custom layer drawing
        ctx.setFillColor(UIColor.blue.withAlphaComponent(0.3).cgColor)
        ctx.fill(layer.bounds)
    }
}
```

### Metal Integration with UIKit
```swift
import MetalKit
import Metal

class MetalUIKitView: UIView {
    private var metalView: MTKView!
    private var device: MTLDevice!
    private var commandQueue: MTLCommandQueue!
    private var pipelineState: MTLRenderPipelineState!
    
    override func awakeFromNib() {
        super.awakeFromNib()
        setupMetal()
    }
    
    private func setupMetal() {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal not supported")
        }
        
        self.device = device
        self.commandQueue = device.makeCommandQueue()
        
        // Create MTKView
        metalView = MTKView(frame: bounds, device: device)
        metalView.delegate = self
        metalView.preferredFramesPerSecond = 60
        metalView.colorPixelFormat = .bgra8Unorm_srgb
        addSubview(metalView)
        
        // Setup render pipeline
        setupRenderPipeline()
    }
    
    private func setupRenderPipeline() {
        guard let library = device.makeDefaultLibrary() else {
            fatalError("Could not load default library")
        }
        
        let vertexFunction = library.makeFunction(name: "vertex_main")
        let fragmentFunction = library.makeFunction(name: "fragment_main")
        
        let pipelineDescriptor = MTLRenderPipelineDescriptor()
        pipelineDescriptor.vertexFunction = vertexFunction
        pipelineDescriptor.fragmentFunction = fragmentFunction
        pipelineDescriptor.colorAttachments[0].pixelFormat = metalView.colorPixelFormat
        
        do {
            pipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
        } catch {
            fatalError("Could not create render pipeline state: \(error)")
        }
    }
}

// MARK: - MTKViewDelegate
extension MetalUIKitView: MTKViewDelegate {
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle size changes
    }
    
    func draw(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let renderPassDescriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let renderEncoder = commandBuffer.makeRenderCommandEncoder(
                descriptor: renderPassDescriptor
              ) else {
            return
        }
        
        // Clear background
        renderPassDescriptor.colorAttachments[0].clearColor = MTLClearColor(
            red: 0.0, green: 0.0, blue: 0.0, alpha: 1.0
        )
        
        // Set render pipeline
        renderEncoder.setRenderPipelineState(pipelineState)
        
        // Draw triangle
        let vertices: [Float] = [
             0.0,  0.5, 0.0, 1.0, 0.0, 0.0, 1.0,  // Top vertex (red)
            -0.5, -0.5, 0.0, 0.0, 1.0, 0.0, 1.0,  // Bottom left (green)
             0.5, -0.5, 0.0, 0.0, 0.0, 1.0, 1.0   // Bottom right (blue)
        ]
        
        renderEncoder.setVertexBytes(vertices, length: vertices.count * MemoryLayout<Float>.size, index: 0)
        renderEncoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        
        renderEncoder.endEncoding()
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

## Performance Benchmarking & Analysis

### Canvas vs Native UI Benchmark
```kotlin
class PerformanceBenchmark {
    private val renderTimes = mutableListOf<Long>()
    private val maxSamples = 100
    
    fun benchmarkCanvasDrawing(canvas: Canvas, iterations: Int): BenchmarkResult {
        renderTimes.clear()
        
        repeat(iterations) {
            val startTime = System.nanoTime()
            
            // Canvas drawing operations
            drawComplexCanvas(canvas)
            
            val endTime = System.nanoTime()
            renderTimes.add(endTime - startTime)
        }
        
        return calculateBenchmarkResult("Canvas Drawing")
    }
    
    fun benchmarkNativeUI(viewGroup: ViewGroup, iterations: Int): BenchmarkResult {
        renderTimes.clear()
        
        repeat(iterations) {
            val startTime = System.nanoTime()
            
            // Native UI operations
            updateNativeViews(viewGroup)
            
            val endTime = System.nanoTime()
            renderTimes.add(endTime - startTime)
        }
        
        return calculateBenchmarkResult("Native UI")
    }
    
    private fun drawComplexCanvas(canvas: Canvas) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        
        // Draw 100 circles with gradients
        repeat(100) { i ->
            val gradient = RadialGradient(
                (i * 10).toFloat(), (i * 5).toFloat(), 50f,
                Color.RED, Color.BLUE, Shader.TileMode.CLAMP
            )
            paint.shader = gradient
            canvas.drawCircle((i * 10).toFloat(), (i * 5).toFloat(), 20f, paint)
        }
        
        paint.shader = null
    }
    
    private fun updateNativeViews(viewGroup: ViewGroup) {
        // Update 100 native views
        repeat(100) { i ->
            val view = viewGroup.getChildAt(i % viewGroup.childCount)
            view?.apply {
                x = (i * 10).toFloat()
                y = (i * 5).toFloat()
                scaleX = 1.0f + (i % 10) * 0.1f
                scaleY = 1.0f + (i % 10) * 0.1f
            }
        }
    }
    
    private fun calculateBenchmarkResult(name: String): BenchmarkResult {
        val avgTime = renderTimes.average()
        val minTime = renderTimes.minOrNull() ?: 0L
        val maxTime = renderTimes.maxOrNull() ?: 0L
        val fps = 1_000_000_000.0 / avgTime // Convert nanoseconds to FPS
        
        return BenchmarkResult(
            name = name,
            averageTimeNs = avgTime.toLong(),
            minTimeNs = minTime,
            maxTimeNs = maxTime,
            estimatedFPS = fps
        )
    }
    
    data class BenchmarkResult(
        val name: String,
        val averageTimeNs: Long,
        val minTimeNs: Long,
        val maxTimeNs: Long,
        val estimatedFPS: Double
    ) {
        override fun toString(): String {
            return """
                $name Benchmark Results:
                Average Time: ${averageTimeNs / 1_000_000.0} ms
                Min Time: ${minTimeNs / 1_000_000.0} ms
                Max Time: ${maxTimeNs / 1_000_000.0} ms
                Estimated FPS: ${String.format("%.1f", estimatedFPS)}
            """.trimIndent()
        }
    }
}
```

## Best Practices Summary

### When to Use Canvas API
```kotlin
/*
✅ Use Canvas when:
- Complex custom drawings
- Particle systems
- Games and animations
- Data visualizations
- Custom shapes and paths
- Performance-critical graphics

❌ Avoid Canvas for:
- Simple UI layouts
- Standard UI components
- Text-heavy interfaces
- Forms and inputs
- List/grid layouts
*/
```

### When to Use Native UI
```kotlin
/*
✅ Use Native UI when:
- Standard UI patterns
- Platform consistency needed
- Accessibility requirements
- Form-based interfaces
- Quick development needed
- Platform animations

❌ Avoid Native UI for:
- Complex custom graphics
- Game-like interfaces
- Heavy animation requirements
- Pixel-perfect control needed
- Performance-critical rendering
*/
```
