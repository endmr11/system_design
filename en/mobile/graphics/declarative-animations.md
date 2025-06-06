# Declarative Animations in Modern Mobile Development

Modern mobile development has evolved toward declarative UI paradigms that fundamentally change how we approach animations. This comprehensive guide explores enterprise-level animation strategies using Jetpack Compose, SwiftUI, and cross-platform frameworks.

## Declarative Animation Philosophy

### Traditional vs. Declarative Approach
```
Traditional Imperative Animation:
┌─ Manual state management
├─ Explicit animation timing
├─ Complex lifecycle handling
└─ Platform-specific implementations

Declarative Animation:
┌─ State-driven animations
├─ Automatic transitions
├─ Simplified lifecycle
└─ Cross-platform patterns
```

## Jetpack Compose Advanced Animations

### State-Based Animation System
```kotlin
@Composable
fun AdvancedAnimationExample() {
    var expanded by remember { mutableStateOf(false) }
    
    // Multiple synchronized animations
    val transition = updateTransition(
        targetState = expanded,
        label = "expansion_transition"
    )
    
    val cardHeight by transition.animateDp(
        transitionSpec = { tween(300) },
        label = "card_height"
    ) { expanded ->
        if (expanded) 200.dp else 100.dp
    }
    
    val cardElevation by transition.animateFloat(
        transitionSpec = { tween(300) },
        label = "card_elevation"
    ) { expanded ->
        if (expanded) 12f else 4f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Animated Card", style = MaterialTheme.typography.headlineSmall)
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically() + fadeIn(),
                exit = slideOutVertically() + fadeOut()
            ) {
                Text("This content is shown with animations")
            }
        }
    }
}
```

### Complex Animation Sequences
```kotlin
@Composable
fun ParticleSystemAnimation() {
    var isActive by remember { mutableStateOf(false) }
    val particles = remember { mutableStateListOf<ParticleState>() }
    
    LaunchedEffect(isActive) {
        if (isActive) {
            repeat(50) { index ->
                particles.add(
                    ParticleState(
                        x = Random.nextFloat() * 300f,
                        y = Random.nextFloat() * 300f,
                        velocity = Random.nextFloat() * 5f,
                        color = Color.hsv(Random.nextFloat() * 360f, 1f, 1f)
                    )
                )
                delay(20) // Stagger particle creation
            }
        } else {
            particles.clear()
        }
    }
    
    Canvas(modifier = Modifier.fillMaxSize()) {
        particles.forEach { particle ->
            drawCircle(
                color = particle.color,
                radius = 8.dp.toPx(),
                center = Offset(particle.x, particle.y)
            )
        }
    }
}

data class ParticleState(
    var x: Float,
    var y: Float,
    var velocity: Float,
    val color: Color
)
```

## SwiftUI Advanced Animation Techniques

### MatchedGeometryEffect for Hero Animations
```swift
struct HeroAnimationView: View {
    @State private var showDetail = false
    @Namespace private var heroNamespace
    
    var body: some View {
        ZStack {
            if showDetail {
                DetailView(showDetail: $showDetail, namespace: heroNamespace)
            } else {
                CardView(showDetail: $showDetail, namespace: heroNamespace)
            }
        }
        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: showDetail)
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(Color.blue.gradient)
            .frame(width: 200, height: 100)
            .matchedGeometryEffect(
                id: "hero-card",
                in: namespace,
                properties: .frame
            )
            .overlay(
                Text("Tap for Detail")
                    .foregroundColor(.white)
                    .matchedGeometryEffect(
                        id: "hero-text",
                        in: namespace
                    )
            )
            .onTapGesture {
                showDetail = true
            }
    }
}
```

### Custom Animation Timing and Curves
```swift
struct CustomTimingAnimations: View {
    @State private var progress: CGFloat = 0
    
    var body: some View {
        VStack(spacing: 50) {
            // Elastic spring animation
            Circle()
                .fill(Color.blue)
                .frame(width: 50)
                .offset(x: progress * 200 - 100)
                .animation(
                    .interpolatingSpring(
                        mass: 2.0,
                        stiffness: 100.0,
                        damping: 10.0
                    ),
                    value: progress
                )
            
            // Custom timing curve
            Rectangle()
                .fill(Color.red)
                .frame(width: 50, height: 50)
                .offset(x: progress * 200 - 100)
                .animation(
                    .timingCurve(0.68, -0.55, 0.265, 1.55, duration: 1.0),
                    value: progress
                )
            
            Button("Animate") {
                progress = progress == 0 ? 1 : 0
            }
        }
    }
}
```

## Cross-Platform Animation Strategies

### React Native Animated API
```javascript
import React, { useRef, useEffect } from 'react';
import { Animated, Dimensions } from 'react-native';

const CrossPlatformParallax = () => {
    const scrollY = useRef(new Animated.Value(0)).current;
    const { height } = Dimensions.get('window');
    
    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, height * 0.5],
        outputRange: [0, -height * 0.25],
        extrapolate: 'clamp',
    });
    
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, height * 0.3, height * 0.5],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp',
    });
    
    return (
        <View style={{ flex: 1 }}>
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: height * 0.6,
                    transform: [{ translateY: headerTranslateY }],
                    opacity: headerOpacity,
                    backgroundColor: '#007AFF',
                }}
            >
                <Text style={{ color: 'white', fontSize: 24 }}>
                    Parallax Header
                </Text>
            </Animated.View>
            
            <Animated.ScrollView
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {/* Content */}
            </Animated.ScrollView>
        </View>
    );
};
```

### Flutter Advanced Animation Controllers
```dart
class FlutterComplexAnimations extends StatefulWidget {
    @override
    _FlutterComplexAnimationsState createState() => _FlutterComplexAnimationsState();
}

class _FlutterComplexAnimationsState extends State<FlutterComplexAnimations>
    with TickerProviderStateMixin {
    
    late AnimationController _primaryController;
    late AnimationController _secondaryController;
    late Animation<double> _scaleAnimation;
    late Animation<double> _rotationAnimation;
    late Animation<Color?> _colorAnimation;
    
    @override
    void initState() {
        super.initState();
        
        _primaryController = AnimationController(
            duration: Duration(seconds: 2),
            vsync: this,
        );
        
        _secondaryController = AnimationController(
            duration: Duration(milliseconds: 800),
            vsync: this,
        );
        
        _scaleAnimation = Tween<double>(
            begin: 1.0,
            end: 1.5,
        ).animate(CurvedAnimation(
            parent: _primaryController,
            curve: Curves.elasticOut,
        ));
        
        _rotationAnimation = Tween<double>(
            begin: 0.0,
            end: 2 * math.pi,
        ).animate(CurvedAnimation(
            parent: _secondaryController,
            curve: Curves.linear,
        ));
        
        _colorAnimation = ColorTween(
            begin: Colors.blue,
            end: Colors.red,
        ).animate(_primaryController);
    }
    
    @override
    Widget build(BuildContext context) {
        return AnimatedBuilder(
            animation: Listenable.merge([_primaryController, _secondaryController]),
            builder: (context, child) {
                return Transform.scale(
                    scale: _scaleAnimation.value,
                    child: Transform.rotate(
                        angle: _rotationAnimation.value,
                        child: Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                                color: _colorAnimation.value,
                                borderRadius: BorderRadius.circular(50),
                            ),
                        ),
                    ),
                );
            },
        );
    }
}
```

## Performance Optimization Techniques

### Animation Performance Monitoring
```kotlin
@Composable
fun AnimationPerformanceTracker() {
    var frameCount by remember { mutableStateOf(0) }
    var lastTime by remember { mutableStateOf(System.currentTimeMillis()) }
    var fps by remember { mutableStateOf(0f) }
    
    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { frameTimeNanos ->
                frameCount++
                val currentTime = System.currentTimeMillis()
                
                if (currentTime - lastTime >= 1000) {
                    fps = frameCount * 1000f / (currentTime - lastTime)
                    frameCount = 0
                    lastTime = currentTime
                    
                    // Log performance warnings
                    if (fps < 55f) {
                        Log.w("Animation", "Low FPS detected: $fps")
                    }
                }
            }
        }
    }
    
    // Display FPS overlay
    Text(
        text = "FPS: ${String.format("%.1f", fps)}",
        modifier = Modifier
            .background(Color.Black.copy(alpha = 0.7f))
            .padding(8.dp),
        color = Color.White
    )
}
```

### Memory-Efficient Animation Patterns
```swift
class AnimationMemoryManager {
    private var activeAnimations: [UUID: CAAnimation] = [:]
    private let maxConcurrentAnimations = 10
    
    func addAnimation(_ animation: CAAnimation, to layer: CALayer) -> UUID {
        let id = UUID()
        
        // Remove oldest animations if limit exceeded
        if activeAnimations.count >= maxConcurrentAnimations {
            removeOldestAnimation()
        }
        
        // Setup completion handler
        animation.completion = { [weak self] _ in
            self?.activeAnimations.removeValue(forKey: id)
        }
        
        activeAnimations[id] = animation
        layer.add(animation, forKey: id.uuidString)
        
        return id
    }
    
    private func removeOldestAnimation() {
        if let firstKey = activeAnimations.keys.first {
            activeAnimations.removeValue(forKey: firstKey)
        }
    }
    
    func cancelAllAnimations() {
        activeAnimations.removeAll()
    }
}
```

## Enterprise Animation Architecture

### Animation State Management
```kotlin
sealed class AnimationState {
    object Idle : AnimationState()
    object Running : AnimationState()
    object Paused : AnimationState()
    data class Error(val message: String) : AnimationState()
}

class AnimationManager {
    private val _animationState = MutableStateFlow(AnimationState.Idle)
    val animationState: StateFlow<AnimationState> = _animationState.asStateFlow()
    
    private val animationQueue = mutableListOf<AnimationRequest>()
    private var isProcessing = false
    
    suspend fun queueAnimation(request: AnimationRequest) {
        animationQueue.add(request)
        processNextAnimation()
    }
    
    private suspend fun processNextAnimation() {
        if (isProcessing || animationQueue.isEmpty()) return
        
        isProcessing = true
        _animationState.value = AnimationState.Running
        
        try {
            val request = animationQueue.removeFirst()
            executeAnimation(request)
        } catch (e: Exception) {
            _animationState.value = AnimationState.Error(e.message ?: "Unknown error")
        } finally {
            isProcessing = false
            _animationState.value = AnimationState.Idle
            
            // Process next animation if available
            if (animationQueue.isNotEmpty()) {
                processNextAnimation()
            }
        }
    }
}

data class AnimationRequest(
    val type: AnimationType,
    val duration: Long,
    val properties: Map<String, Any>
)
```

This comprehensive guide provides the foundation for implementing enterprise-level declarative animations across modern mobile platforms.
