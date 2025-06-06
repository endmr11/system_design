# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {
                    showDetail = false
                }
            }
            .padding()
        }
        .padding()
    }
}
```

## Reaktif Programlama ve UI Güncellemeleri

### Compose'da Side Effect Yönetimi
```kotlin
@Composable
fun AnimatedProgress() {
    var progress by remember { mutableStateOf(0f) }
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000)
    )
    
    LaunchedEffect(Unit) {
        while (progress < 1f) {
            delay(100)
            progress += 0.1f
        }
    }
    
    Column {
        LinearProgressIndicator(
            progress = animatedProgress,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        )
        
        Text(
            text = "${(animatedProgress * 100).toInt()}%",
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
```

### SwiftUI'de Combine Entegrasyonu
```swift
import Combine

class AnimationViewModel: ObservableObject {
    @Published var progress: Double = 0.0
    @Published var isAnimating = false
    
    private var timer: Timer?
    
    func startAnimation() {
        isAnimating = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            if self.progress < 1.0 {
                self.progress += 0.1
            } else {
                self.stopAnimation()
            }
        }
    }
    
    func stopAnimation() {
        isAnimating = false
        timer?.invalidate()
        timer = nil
        progress = 0.0
    }
}

struct ProgressAnimationView: View {
    @StateObject private var viewModel = AnimationViewModel()
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView(value: viewModel.progress)
                .scaleEffect(1.2)
                .animation(.easeInOut(duration: 0.3), value: viewModel.progress)
            
            Text("\(Int(viewModel.progress * 100))%")
                .font(.title2)
                .fontWeight(.bold)
            
            Button(action: {
                if viewModel.isAnimating {
                    viewModel.stopAnimation()
                } else {
                    viewModel.startAnimation()
                }
            }) {
                Text(viewModel.isAnimating ? "Durdur" : "Başlat")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding()
                    .background(viewModel.isAnimating ? Color.red : Color.green)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}
```

## Performance Best Practices

### Jetpack Compose Optimizasyonu
```kotlin
// Yanlış: Her recomposition'da yeni lambda oluşturur
@Composable
fun InefficientButton() {
    var count by remember { mutableStateOf(0) }
    
    Button(
        onClick = { count++ } // Yeni lambda her seferinde
    ) {
        Text("Count: $count")
    }
}

// Doğru: Stable lambda kullanımı
@Composable
fun EfficientButton() {
    var count by remember { mutableStateOf(0) }
    val onClickHandler = remember { { count++ } }
    
    Button(onClick = onClickHandler) {
        Text("Count: $count")
    }
}

// Daha da iyi: Stable state hoisting
@Composable
fun OptimalButton(
    count: Int,
    onIncrement: () -> Unit
) {
    Button(onClick = onIncrement) {
        Text("Count: $count")
    }
}
```

### SwiftUI Performance Optimizasyonu
```swift
// Yanlış: Her view update'inde yeni görünüm oluşturur
struct InefficientView: View {
    @State private var counter = 0
    
    var body: some View {
        VStack {
            // Bu her güncellemede yeniden hesaplanır
            ForEach(0..<counter, id: \.self) { index in
                Text("Item \(index)")
                    .font(.title)
                    .foregroundColor(.blue)
            }
        }
    }
}

// Doğru: Computed property kullanımı
struct EfficientView: View {
    @State private var counter = 0
    
    private var itemsView: some View {
        ForEach(0..<counter, id: \.self) { index in
            Text("Item \(index)")
                .font(.title)
                .foregroundColor(.blue)
        }
    }
    
    var body: some View {
        VStack {
            itemsView
        }
    }
}
```

Bu kapsamlı declarative animations rehberi, modern mobil UI framework'lerinde animasyon oluşturmanın en güncel yaklaşımlarını ve performans optimizasyonlarını detaylandırır.

# Declarative Animations (Jetpack Compose, SwiftUI)

## Declarative UI Paradigması

### Modern UI Framework'lerinde Paradigma Değişimi
Declarative UI yaklaşımı, geleneksel imperative UI programlamadan köklü bir sapma temsil eder. Bu yaklaşımda kullanıcı arayüzü, mevcut duruma (state) göre otomatik olarak yeniden oluşturulur ve geliştiriciler "nasıl" değil "ne" yapılacağını tanımlar.

### Jetpack Compose'da Declarative UI

#### State Yönetimi ve Recomposition
```kotlin
@Composable
fun AnimatedCounter() {
    var count by remember { mutableStateOf(0) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        )
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = animatedCount.toString(),
            style = MaterialTheme.typography.headlineLarge,
            fontSize = 48.sp
        )
        
        Button(
            onClick = { count++ },
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text("Artır")
        }
    }
}
```

#### Çoklu Durum Geçişleri (Transition)
```kotlin
@Composable
fun AnimatedCard() {
    var expanded by remember { mutableStateOf(false) }
    val transition = updateTransition(
        targetState = expanded,
        label = "card_transition"
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
    
    val contentAlpha by transition.animateFloat(
        transitionSpec = { tween(200, delayMillis = 100) },
        label = "content_alpha"
    ) { expanded ->
        if (expanded) 1f else 0f
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(cardHeight)
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = cardElevation.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Kart Başlığı",
                style = MaterialTheme.typography.headlineSmall
            )
            
            AnimatedVisibility(
                visible = expanded,
                enter = slideInVertically(animationSpec = tween(300)) + fadeIn(),
                exit = slideOutVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .alpha(contentAlpha)
                ) {
                    Text("Bu içerik animasyonlu olarak gösteriliyor")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Çoklu animasyon geçişleri sağlıyor")
                }
            }
        }
    }
}
```

#### Sonsuz Animasyonlar (Infinite Transitions)
```kotlin
@Composable
fun PulsingButton() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.7f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    
    Button(
        onClick = { /* Aksiyonlar */ },
        modifier = Modifier
            .scale(scale)
            .alpha(alpha)
    ) {
        Text("Pulsing Button")
    }
}
```

### SwiftUI'de Declarative Animations

#### State-Driven Animasyonlar
```swift
struct AnimatedToggle: View {
    @State private var isToggled = false
    
    var body: some View {
        VStack(spacing: 30) {
            Circle()
                .fill(isToggled ? Color.green : Color.red)
                .frame(width: 100, height: 100)
                .scaleEffect(isToggled ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: isToggled)
            
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isToggled.toggle()
                }
            }) {
                Text(isToggled ? "Kapat" : "Aç")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}
```

#### Karmaşık Geçiş Animasyonları
```swift
struct DetailTransition: View {
    @State private var showDetail = false
    @Namespace private var heroAnimation
    
    var body: some View {
        if showDetail {
            DetailView(showDetail: $showDetail, namespace: heroAnimation)
        } else {
            CardView(showDetail: $showDetail, namespace: heroAnimation)
        }
    }
}

struct CardView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(width: 200, height: 150)
                .matchedGeometryEffect(id: "hero", in: namespace)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showDetail = true
                    }
                }
            
            Text("Detayı Göster")
                .font(.headline)
                .padding(.top)
        }
    }
}

struct DetailView: View {
    @Binding var showDetail: Bool
    let namespace: Namespace.ID
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color.blue)
                .frame(maxWidth: .infinity, maxHeight: 300)
                .matchedGeometryEffect(id: "hero", in: namespace)
            
            Text("Detay İçeriği")
                .font(.title)
                .padding()
            
            Spacer()
            
            Button("Kapat") {
                withAnimation(.easeInOut(duration: 0.6)) {