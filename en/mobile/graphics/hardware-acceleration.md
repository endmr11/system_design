# Hardware Acceleration

Hardware acceleration leverages specialized processors (GPU, NPU, DSP) to offload computationally intensive tasks from the CPU, resulting in better performance and energy efficiency for mobile applications.

## GPU Acceleration Fundamentals

### Graphics Processing Pipeline

```swift
// iOS - Metal GPU acceleration
import Metal
import MetalKit

class GPUAcceleratedRenderer {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let library: MTLLibrary
    
    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw GPUError.deviceNotAvailable
        }
        
        self.device = device
        self.commandQueue = device.makeCommandQueue()!
        self.library = device.makeDefaultLibrary()!
    }
    
    func createComputePipeline(functionName: String) throws -> MTLComputePipelineState {
        guard let function = library.makeFunction(name: functionName) else {
            throw GPUError.functionNotFound
        }
        
        return try device.makeComputePipelineState(function: function)
    }
    
    func executeComputeShader<T>(
        pipeline: MTLComputePipelineState,
        inputData: [T],
        outputCount: Int
    ) throws -> [T] {
        let inputBuffer = device.makeBuffer(
            bytes: inputData,
            length: inputData.count * MemoryLayout<T>.stride,
            options: .storageModeShared
        )!
        
        let outputBuffer = device.makeBuffer(
            length: outputCount * MemoryLayout<T>.stride,
            options: .storageModeShared
        )!
        
        let commandBuffer = commandQueue.makeCommandBuffer()!
        let encoder = commandBuffer.makeComputeCommandEncoder()!
        
        encoder.setComputePipelineState(pipeline)
        encoder.setBuffer(inputBuffer, offset: 0, index: 0)
        encoder.setBuffer(outputBuffer, offset: 0, index: 1)
        
        let threadsPerThreadgroup = MTLSize(width: 32, height: 1, depth: 1)
        let threadgroupsPerGrid = MTLSize(
            width: (inputData.count + threadsPerThreadgroup.width - 1) / threadsPerThreadgroup.width,
            height: 1,
            depth: 1
        )
        
        encoder.dispatchThreadgroups(threadgroupsPerGrid, threadsPerThreadgroup: threadsPerThreadgroup)
        encoder.endEncoding()
        
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        let resultPointer = outputBuffer.contents().bindMemory(to: T.self, capacity: outputCount)
        return Array(UnsafeBufferPointer(start: resultPointer, count: outputCount))
    }
}
```

### Android OpenGL ES/Vulkan

```kotlin
// Android - OpenGL ES acceleration
class OpenGLAcceleratedProcessor {
    private var program: Int = 0
    private var vertexShader: Int = 0
    private var fragmentShader: Int = 0
    
    fun initializeShaders() {
        val vertexShaderCode = """
            attribute vec4 vPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            
            void main() {
                gl_Position = vPosition;
                vTexCoord = aTexCoord;
            }
        """.trimIndent()
        
        val fragmentShaderCode = """
            precision mediump float;
            uniform sampler2D uTexture;
            varying vec2 vTexCoord;
            
            void main() {
                vec4 color = texture2D(uTexture, vTexCoord);
                // Apply GPU-accelerated effects
                gl_FragColor = color;
            }
        """.trimIndent()
        
        vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, vertexShaderCode)
        fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, fragmentShaderCode)
        
        program = GLES20.glCreateProgram().also {
            GLES20.glAttachShader(it, vertexShader)
            GLES20.glAttachShader(it, fragmentShader)
            GLES20.glLinkProgram(it)
        }
    }
    
    private fun loadShader(type: Int, shaderCode: String): Int {
        return GLES20.glCreateShader(type).also { shader ->
            GLES20.glShaderSource(shader, shaderCode)
            GLES20.glCompileShader(shader)
        }
    }
    
    fun processTexture(textureId: Int, width: Int, height: Int) {
        GLES20.glUseProgram(program)
        
        // Bind texture and execute GPU processing
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        
        // Set uniforms and draw
        val textureUniform = GLES20.glGetUniformLocation(program, "uTexture")
        GLES20.glUniform1i(textureUniform, 0)
        
        // Execute rendering
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    }
}
```

## Neural Processing Unit (NPU) Acceleration

### Core ML (iOS)

```swift
// iOS - Core ML for NPU acceleration
import CoreML
import Vision

class NPUAcceleratedProcessor {
    private var model: VNCoreMLModel?
    
    init(modelName: String) throws {
        guard let modelURL = Bundle.main.url(forResource: modelName, withExtension: "mlmodelc"),
              let coreMLModel = try? MLModel(contentsOf: modelURL) else {
            throw NPUError.modelLoadFailed
        }
        
        self.model = try VNCoreMLModel(for: coreMLModel)
    }
    
    func processImage(_ image: CVPixelBuffer) async throws -> [VNObservation] {
        guard let model = model else {
            throw NPUError.modelNotLoaded
        }
        
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFill
        
        // Configure for NPU usage
        if #available(iOS 13.0, *) {
            request.usesCPUOnly = false // Allow NPU usage
        }
        
        let handler = VNImageRequestHandler(cvPixelBuffer: image, options: [:])
        
        return try await withCheckedThrowingContinuation { continuation in
            do {
                try handler.perform([request])
                continuation.resume(returning: request.results ?? [])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
    
    func benchmarkNPUPerformance() async {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        // Create dummy input
        guard let pixelBuffer = createDummyPixelBuffer() else { return }
        
        do {
            _ = try await processImage(pixelBuffer)
            let endTime = CFAbsoluteTimeGetCurrent()
            let processingTime = (endTime - startTime) * 1000 // ms
            
            print("NPU processing time: \(processingTime)ms")
        } catch {
            print("NPU benchmark failed: \(error)")
        }
    }
}
```

### Android Neural Networks API

```kotlin
// Android - NNAPI acceleration
class NNAPIProcessor {
    private var compilation: NeuralNetworksCompilation? = null
    private var model: NeuralNetworksModel? = null
    
    fun initializeModel(modelBytes: ByteArray) {
        try {
            model = NeuralNetworksModel().apply {
                // Define model architecture
                addOperand(NeuralNetworksOperandType.TENSOR_FLOAT32, intArrayOf(1, 224, 224, 3))
                addOperand(NeuralNetworksOperandType.TENSOR_FLOAT32, intArrayOf(1, 1000))
                
                // Add operations
                addOperation(NeuralNetworksOperationType.CONV_2D, intArrayOf(0), intArrayOf(1))
                
                // Set model inputs and outputs
                identifyInputsAndOutputs(intArrayOf(0), intArrayOf(1))
                finish()
            }
            
            compilation = NeuralNetworksCompilation(model!!).apply {
                setPreference(NeuralNetworksCompilation.PREFER_FAST_SINGLE_ANSWER)
                finish()
            }
        } catch (e: Exception) {
            Log.e("NNAPI", "Model initialization failed", e)
        }
    }
    
    fun executeInference(inputData: FloatArray): FloatArray? {
        return try {
            val execution = NeuralNetworksExecution(compilation!!)
            
            // Set input
            execution.setInput(0, inputData)
            
            // Prepare output
            val outputData = FloatArray(1000)
            execution.setOutput(0, outputData)
            
            // Execute on NPU/DSP
            execution.compute()
            
            outputData
        } catch (e: Exception) {
            Log.e("NNAPI", "Inference failed", e)
            null
        }
    }
}
```

## Image Processing Acceleration

### Metal Performance Shaders

```swift
// iOS - Metal Performance Shaders for image processing
import MetalPerformanceShaders

class MPSImageProcessor {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    
    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw GPUError.deviceNotAvailable
        }
        
        self.device = device
        self.commandQueue = device.makeCommandQueue()!
    }
    
    func applyGaussianBlur(to texture: MTLTexture, sigma: Float) -> MTLTexture? {
        let blur = MPSImageGaussianBlur(device: device, sigma: sigma)
        
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: texture.pixelFormat,
            width: texture.width,
            height: texture.height,
            mipmapped: false
        )
        descriptor.usage = [.shaderRead, .shaderWrite]
        
        guard let outputTexture = device.makeTexture(descriptor: descriptor) else {
            return nil
        }
        
        let commandBuffer = commandQueue.makeCommandBuffer()!
        blur.encode(commandBuffer: commandBuffer, sourceTexture: texture, destinationTexture: outputTexture)
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        return outputTexture
    }
    
    func performConvolution(input: MTLTexture, kernel: [Float], kernelSize: Int) -> MTLTexture? {
        let convolution = MPSImageConvolution(
            device: device,
            kernelWidth: kernelSize,
            kernelHeight: kernelSize,
            weights: kernel
        )
        
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: input.pixelFormat,
            width: input.width,
            height: input.height,
            mipmapped: false
        )
        descriptor.usage = [.shaderRead, .shaderWrite]
        
        guard let outputTexture = device.makeTexture(descriptor: descriptor) else {
            return nil
        }
        
        let commandBuffer = commandQueue.makeCommandBuffer()!
        convolution.encode(commandBuffer: commandBuffer, sourceTexture: input, destinationTexture: outputTexture)
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        return outputTexture
    }
}
```

### RenderScript (Android)

```kotlin
// Android - RenderScript for parallel processing
class RenderScriptProcessor(private val context: Context) {
    private val renderScript = RenderScript.create(context)
    
    fun blurImage(inputBitmap: Bitmap, radius: Float): Bitmap {
        val inputAllocation = Allocation.createFromBitmap(renderScript, inputBitmap)
        val outputBitmap = Bitmap.createBitmap(
            inputBitmap.width,
            inputBitmap.height,
            inputBitmap.config
        )
        val outputAllocation = Allocation.createFromBitmap(renderScript, outputBitmap)
        
        val blurScript = ScriptIntrinsicBlur.create(renderScript, Element.U8_4(renderScript))
        blurScript.setRadius(radius)
        blurScript.setInput(inputAllocation)
        blurScript.forEach(outputAllocation)
        
        outputAllocation.copyTo(outputBitmap)
        
        // Cleanup
        inputAllocation.destroy()
        outputAllocation.destroy()
        blurScript.destroy()
        
        return outputBitmap
    }
    
    fun customKernelProcessing(input: FloatArray, kernelSize: Int): FloatArray {
        val inputAllocation = Allocation.createSized(
            renderScript,
            Element.F32(renderScript),
            input.size
        )
        inputAllocation.copyFrom(input)
        
        val outputAllocation = Allocation.createSized(
            renderScript,
            Element.F32(renderScript),
            input.size
        )
        
        // Load and execute custom script
        val script = ScriptC_custom_kernel(renderScript)
        script._input = inputAllocation
        script.invoke_processData()
        script.forEach_process(inputAllocation, outputAllocation)
        
        val output = FloatArray(input.size)
        outputAllocation.copyTo(output)
        
        return output
    }
}
```

## Cross-Platform Hardware Acceleration

### React Native GPU Processing

```typescript
// React Native - Native module for GPU acceleration
import { NativeModules } from 'react-native';

interface GPUProcessor {
  processImage(imageUri: string, filter: string): Promise<string>;
  computeParallel(data: number[], operation: string): Promise<number[]>;
  benchmarkGPU(): Promise<{ renderTime: number; computeTime: number }>;
}

const { GPUAccelerator } = NativeModules as { GPUAccelerator: GPUProcessor };

class HardwareAcceleratedProcessor {
  async applyImageFilter(imageUri: string, filterType: 'blur' | 'sharpen' | 'edge'): Promise<string> {
    try {
      const processedImageUri = await GPUAccelerator.processImage(imageUri, filterType);
      return processedImageUri;
    } catch (error) {
      console.error('GPU image processing failed:', error);
      throw error;
    }
  }
  
  async parallelComputation(data: number[], operation: 'sum' | 'multiply' | 'transform'): Promise<number[]> {
    const chunkSize = 1000; // Process in chunks for memory efficiency
    const results: number[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkResult = await GPUAccelerator.computeParallel(chunk, operation);
      results.push(...chunkResult);
    }
    
    return results;
  }
  
  async measurePerformance(): Promise<{ cpu: number; gpu: number }> {
    const cpuStart = performance.now();
    
    // CPU-only computation
    const testData = new Array(10000).fill(0).map((_, i) => i);
    testData.reduce((acc, val) => acc + val * val, 0);
    
    const cpuTime = performance.now() - cpuStart;
    
    // GPU computation
    const gpuBenchmark = await GPUAccelerator.benchmarkGPU();
    
    return {
      cpu: cpuTime,
      gpu: gpuBenchmark.computeTime
    };
  }
}
```

### Flutter GPU Acceleration

```dart
// Flutter - Platform channel for hardware acceleration
class HardwareAcceleration {
  static const platform = MethodChannel('hardware_acceleration');
  
  static Future<Uint8List> processImageGPU(Uint8List imageData, String filter) async {
    try {
      final result = await platform.invokeMethod('processImage', {
        'imageData': imageData,
        'filter': filter,
      });
      return result as Uint8List;
    } on PlatformException catch (e) {
      throw Exception('GPU processing failed: ${e.message}');
    }
  }
  
  static Future<List<double>> computeParallel(List<double> data) async {
    try {
      final result = await platform.invokeMethod('computeParallel', {
        'data': data,
      });
      return List<double>.from(result);
    } on PlatformException catch (e) {
      throw Exception('Parallel computation failed: ${e.message}');
    }
  }
  
  static Future<Map<String, double>> benchmarkHardware() async {
    try {
      final result = await platform.invokeMethod('benchmark');
      return Map<String, double>.from(result);
    } on PlatformException catch (e) {
      throw Exception('Benchmark failed: ${e.message}');
    }
  }
}

// Usage in Flutter widget
class AcceleratedImageProcessor extends StatefulWidget {
  @override
  _AcceleratedImageProcessorState createState() => _AcceleratedImageProcessorState();
}

class _AcceleratedImageProcessorState extends State<AcceleratedImageProcessor> {
  bool _isProcessing = false;
  Uint8List? _processedImage;
  
  Future<void> _processImage(Uint8List originalImage) async {
    setState(() => _isProcessing = true);
    
    try {
      final processed = await HardwareAcceleration.processImageGPU(
        originalImage,
        'blur'
      );
      
      setState(() {
        _processedImage = processed;
        _isProcessing = false;
      });
    } catch (e) {
      print('Processing error: $e');
      setState(() => _isProcessing = false);
    }
  }
}
```

## Performance Optimization Strategies

### Memory Management for Hardware Acceleration

```swift
// iOS - Efficient memory management for GPU operations
class GPUMemoryManager {
    private let device: MTLDevice
    private var bufferPool: [MTLBuffer] = []
    private let maxPoolSize = 10
    
    init(device: MTLDevice) {
        self.device = device
    }
    
    func getBuffer(size: Int) -> MTLBuffer? {
        // Try to reuse existing buffer
        if let index = bufferPool.firstIndex(where: { $0.length >= size }) {
            return bufferPool.remove(at: index)
        }
        
        // Create new buffer if pool is empty or no suitable buffer found
        return device.makeBuffer(length: size, options: .storageModeShared)
    }
    
    func returnBuffer(_ buffer: MTLBuffer) {
        if bufferPool.count < maxPoolSize {
            bufferPool.append(buffer)
        }
        // Buffer will be automatically deallocated if pool is full
    }
    
    func clearPool() {
        bufferPool.removeAll()
    }
}
```

### Async GPU Operations

```kotlin
// Android - Asynchronous GPU processing
class AsyncGPUProcessor {
    private val glExecutor = Executors.newSingleThreadExecutor()
    private val computeExecutor = Executors.newFixedThreadPool(2)
    
    fun processAsync(
        inputData: FloatArray,
        callback: (FloatArray) -> Unit
    ) {
        computeExecutor.submit {
            try {
                val result = processOnGPU(inputData)
                
                // Return result on main thread
                Handler(Looper.getMainLooper()).post {
                    callback(result)
                }
            } catch (e: Exception) {
                Log.e("AsyncGPU", "Processing failed", e)
            }
        }
    }
    
    private fun processOnGPU(data: FloatArray): FloatArray {
        // GPU processing implementation
        return data.map { it * 2.0f }.toFloatArray()
    }
    
    fun batchProcess(
        batches: List<FloatArray>,
        progressCallback: (Int, Int) -> Unit,
        completionCallback: (List<FloatArray>) -> Unit
    ) {
        val results = mutableListOf<FloatArray>()
        val totalBatches = batches.size
        
        batches.forEachIndexed { index, batch ->
            computeExecutor.submit {
                val result = processOnGPU(batch)
                
                synchronized(results) {
                    results.add(result)
                    
                    Handler(Looper.getMainLooper()).post {
                        progressCallback(index + 1, totalBatches)
                        
                        if (results.size == totalBatches) {
                            completionCallback(results.toList())
                        }
                    }
                }
            }
        }
    }
}
```

## Hardware Detection and Fallbacks

### Capability Detection

```typescript
// Cross-platform hardware capability detection
interface HardwareCapabilities {
  hasGPU: boolean;
  hasNPU: boolean;
  hasDSP: boolean;
  gpuMemory: number;
  computeUnits: number;
  supportedFormats: string[];
}

class HardwareDetector {
  static async getCapabilities(): Promise<HardwareCapabilities> {
    if (Platform.OS === 'ios') {
      return await this.getIOSCapabilities();
    } else {
      return await this.getAndroidCapabilities();
    }
  }
  
  private static async getIOSCapabilities(): Promise<HardwareCapabilities> {
    const capabilities = await NativeModules.HardwareDetector.getIOSCapabilities();
    
    return {
      hasGPU: capabilities.hasGPU,
      hasNPU: capabilities.hasNeuralEngine,
      hasDSP: capabilities.hasImageSignalProcessor,
      gpuMemory: capabilities.gpuMemory,
      computeUnits: capabilities.gpuCores,
      supportedFormats: capabilities.supportedPixelFormats
    };
  }
  
  private static async getAndroidCapabilities(): Promise<HardwareCapabilities> {
    const capabilities = await NativeModules.HardwareDetector.getAndroidCapabilities();
    
    return {
      hasGPU: capabilities.hasGPU,
      hasNPU: capabilities.hasNNAPI,
      hasDSP: capabilities.hasHexagonDSP,
      gpuMemory: capabilities.gpuMemory,
      computeUnits: capabilities.gpuCores,
      supportedFormats: capabilities.supportedFormats
    };
  }
  
  static selectOptimalProcessor(
    capabilities: HardwareCapabilities,
    taskType: 'image' | 'ml' | 'compute'
  ): ProcessorType {
    switch (taskType) {
      case 'image':
        return capabilities.hasGPU ? 'gpu' : 'cpu';
      case 'ml':
        return capabilities.hasNPU ? 'npu' : 
               capabilities.hasGPU ? 'gpu' : 'cpu';
      case 'compute':
        return capabilities.hasDSP ? 'dsp' :
               capabilities.hasGPU ? 'gpu' : 'cpu';
      default:
        return 'cpu';
    }
  }
}

type ProcessorType = 'cpu' | 'gpu' | 'npu' | 'dsp';
```

## Best Practices

### Hardware Acceleration Guidelines

1. **Choose the right accelerator**
   - GPU: Parallel graphics and compute operations
   - NPU: Machine learning inference
   - DSP: Signal processing and audio

2. **Memory optimization**
   - Pool GPU buffers
   - Minimize CPU-GPU transfers
   - Use appropriate memory types

3. **Async processing**
   - Don't block main thread
   - Implement proper error handling
   - Provide progress feedback

4. **Fallback strategies**
   - Detect hardware capabilities
   - Implement CPU fallbacks
   - Graceful degradation

5. **Power efficiency**
   - Monitor thermal state
   - Balance performance vs battery
   - Use adaptive quality settings

Hardware acceleration is essential for performance-critical mobile applications. Proper implementation can provide significant performance improvements while maintaining energy efficiency across different device capabilities.
