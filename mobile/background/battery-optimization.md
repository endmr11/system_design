# Batarya Optimizasyonu

Mobil cihazlarda batarya ömrü kritik bir faktördür. Bu bölümde, uygulamanızın batarya tüketimini minimize etmek için kullanabileceğiniz teknik ve stratejiler ele alınacaktır.

## Temel İlkeler

### 1. CPU Kullanımını Minimize Etme
- **Algoritma Optimizasyonu**: Verimli algoritmalar kullanın
- **Gereksiz İşlemleri Engelleme**: Arka plan işlemlerini sınırlayın
- **Cache Kullanımı**: Hesaplamaları cache'leyerek tekrarları önleyin

### 2. Ağ İşlemlerini Optimize Etme
- **Batch Requests**: Birden fazla isteği birleştirin
- **Compression**: Veri sıkıştırma kullanın
- **Connection Pooling**: Bağlantıları yeniden kullanın

## Platform-Spesifik Optimizasyonlar

### iOS

#### Background App Refresh
```swift
// iOS'ta arka plan yenileme kontrolü
if UIApplication.shared.backgroundRefreshStatus == .available {
    // Arka plan işlemlerini optimize et
    DispatchQueue.global(qos: .background).async {
        // Düşük öncelikli işlemler
    }
}
```

#### Power Management
```swift
import Foundation

class BatteryManager {
    func getCurrentBatteryLevel() -> Float {
        UIDevice.current.isBatteryMonitoringEnabled = true
        return UIDevice.current.batteryLevel
    }
    
    func getBatteryState() -> UIDevice.BatteryState {
        return UIDevice.current.batteryState
    }
    
    func optimizeForLowBattery() {
        let batteryLevel = getCurrentBatteryLevel()
        if batteryLevel < 0.2 { // %20'nin altında
            // Performans modunu düşür
            // Arka plan senkronizasyonunu durdur
            // Animasyonları azalt
        }
    }
}
```

### Android

#### Doze Mode ve App Standby
```kotlin
class BatteryOptimizationManager {
    fun handleDozeMode(context: Context) {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val isIgnoringOptimizations = powerManager.isIgnoringBatteryOptimizations(context.packageName)
            if (!isIgnoringOptimizations) {
                // Kullanıcıyı uyar ve ayarlara yönlendir
                requestBatteryOptimizationExemption(context)
            }
        }
    }
    
    private fun requestBatteryOptimizationExemption(context: Context) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        context.startActivity(intent)
    }
}
```

#### JobScheduler Kullanımı
```kotlin
@TargetApi(Build.VERSION_CODES.LOLLIPOP)
class BatteryOptimizedJobService : JobService() {
    
    override fun onStartJob(params: JobParameters?): Boolean {
        // Arka plan işlemini başlat
        doBackgroundWork(params)
        return true
    }
    
    override fun onStopJob(params: JobParameters?): Boolean {
        // İşlemi durdur
        return false
    }
    
    private fun doBackgroundWork(params: JobParameters?) {
        Thread {
            // Batarya dostu işlemler
            jobFinished(params, false)
        }.start()
    }
}

// JobScheduler kullanımı
class JobSchedulerHelper {
    fun scheduleJob(context: Context) {
        val jobScheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        
        val jobInfo = JobInfo.Builder(JOB_ID, ComponentName(context, BatteryOptimizedJobService::class.java))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED) // Sadece WiFi
            .setRequiresCharging(true) // Şarj olurken çalış
            .setRequiresDeviceIdle(true) // Cihaz boştayken çalış
            .setPersisted(true)
            .build()
            
        jobScheduler.schedule(jobInfo)
    }
}
```

## React Native Optimizasyonları

### Performance Monitor
```javascript
import { PerformanceObserver, performance } from 'perf_hooks';

class BatteryOptimizationManager {
  constructor() {
    this.isLowPowerMode = false;
    this.monitorBatteryLevel();
  }
  
  monitorBatteryLevel() {
    // React Native battery level monitoring
    if (Platform.OS === 'ios') {
      this.checkIOSBatteryLevel();
    } else {
      this.checkAndroidBatteryLevel();
    }
  }
  
  checkIOSBatteryLevel() {
    // iOS için batarya seviyesi kontrolü
    const BatteryLevel = NativeModules.BatteryLevel;
    BatteryLevel.getBatteryLevel((level) => {
      if (level < 0.2) {
        this.enableLowPowerMode();
      }
    });
  }
  
  enableLowPowerMode() {
    this.isLowPowerMode = true;
    
    // Animasyonları azalt
    this.reduceAnimations();
    
    // Arka plan görevlerini durdur
    this.pauseBackgroundTasks();
    
    // Ağ isteklerini azalt
    this.reducedNetworkActivity();
  }
  
  reduceAnimations() {
    // Animasyon süresini kısalt
    const animationConfig = {
      duration: this.isLowPowerMode ? 150 : 300,
      useNativeDriver: true
    };
  }
  
  pauseBackgroundTasks() {
    // Periyodik görevleri durdur
    this.cancelScheduledTasks();
  }
  
  reducedNetworkActivity() {
    // Cache'i daha agresif kullan
    // İstekmeri batch'le
    // Compression kullan
  }
}
```

### Memory Management
```javascript
class MemoryOptimizer {
  constructor() {
    this.imageCache = new Map();
    this.maxCacheSize = 50;
  }
  
  optimizeImageLoading(imageUri) {
    // Düşük bataryada düşük kalite resimleri yükle
    if (this.isLowPowerMode) {
      return this.loadLowQualityImage(imageUri);
    }
    return this.loadHighQualityImage(imageUri);
  }
  
  loadLowQualityImage(imageUri) {
    // Düşük çözünürlük ve yüksek compression
    return {
      uri: imageUri,
      quality: 0.3,
      resize: { width: 200, height: 200 }
    };
  }
  
  clearUnusedCache() {
    // Bellek basıncında cache'i temizle
    if (this.imageCache.size > this.maxCacheSize) {
      const keysToDelete = Array.from(this.imageCache.keys()).slice(0, 10);
      keysToDelete.forEach(key => this.imageCache.delete(key));
    }
  }
}
```

## Flutter Optimizasyonları

### Battery Awareness
```dart
import 'package:battery_plus/battery_plus.dart';
import 'package:flutter/services.dart';

class BatteryOptimizationService {
  final Battery _battery = Battery();
  bool _isLowPowerMode = false;
  
  Future<void> initializeBatteryMonitoring() async {
    _battery.batteryLevel.then((batteryLevel) {
      if (batteryLevel < 20) {
        _enableLowPowerMode();
      }
    });
    
    _battery.onBatteryStateChanged.listen((BatteryState state) {
      _handleBatteryStateChange(state);
    });
  }
  
  void _enableLowPowerMode() {
    _isLowPowerMode = true;
    
    // Widget rebuild'lerini azalt
    _optimizeWidgetUpdates();
    
    // Animasyonları yavaşlat
    _reduceAnimationSpeed();
    
    // Arka plan işlemlerini durdur
    _pauseBackgroundOperations();
  }
  
  void _optimizeWidgetUpdates() {
    // setState çağrılarını batch'le
    // Gereksiz rebuild'leri önle
  }
  
  void _reduceAnimationSpeed() {
    // Animation controller'ların süresini artır
    const Duration normalDuration = Duration(milliseconds: 300);
    Duration optimizedDuration = _isLowPowerMode 
        ? Duration(milliseconds: 500)
        : normalDuration;
  }
  
  void _pauseBackgroundOperations() {
    // Timer'ları durdur
    // Periyodik görevleri ertele
  }
}
```

### Performance Optimization
```dart
class PerformanceOptimizer {
  static const int _maxCacheSize = 100;
  final Map<String, dynamic> _cache = {};
  
  // Lazy loading implementation
  Widget buildOptimizedList(List<dynamic> items) {
    return ListView.builder(
      cacheExtent: _isLowPowerMode ? 200 : 500,
      itemCount: items.length,
      itemBuilder: (context, index) {
        return _buildOptimizedListItem(items[index], index);
      },
    );
  }
  
  Widget _buildOptimizedListItem(dynamic item, int index) {
    // Düşük güç modunda basit widget'lar kullan
    if (_isLowPowerMode) {
      return _buildSimpleListItem(item);
    }
    return _buildRichListItem(item);
  }
  
  Widget _buildSimpleListItem(dynamic item) {
    return ListTile(
      title: Text(item.title),
      // Minimal UI elements
    );
  }
  
  Widget _buildRichListItem(dynamic item) {
    return Card(
      child: Column(
        children: [
          // Rich UI with images, animations, etc.
        ],
      ),
    );
  }
}
```

## En İyi Uygulamalar

### 1. Proaktif Monitoring
- Batarya seviyesini sürekli izleyin
- Kullanıcı davranışlarına göre optimize edin
- Performance metrikleri toplayın

### 2. Adaptive UI
- Düşük bataryada UI karmaşıklığını azaltın
- Animasyonları minimize edin
- Renk derinliğini azaltın (OLED ekranlar için)

### 3. Background Task Management
- Gerekli olmayan arka plan görevlerini durdurun
- Senkronizasyonu geciktirin
- Push notification'ları kullanın

### 4. Network Optimization
- WiFi bağlantısını tercih edin
- Request'leri batch'leyin
- Cache'i agresif şekilde kullanın

### 5. Resource Management
- Memory leak'leri önleyin
- CPU-intensive işlemleri erteleyin
- GPU kullanımını minimize edin

## Ölçüm ve Testing

### Battery Usage Profiling
```javascript
// Batarya kullanımını ölçme
class BatteryProfiler {
  constructor() {
    this.startTime = Date.now();
    this.startBatteryLevel = null;
  }
  
  async startProfiling() {
    this.startBatteryLevel = await this.getBatteryLevel();
    this.startTime = Date.now();
  }
  
  async endProfiling() {
    const endBatteryLevel = await this.getBatteryLevel();
    const endTime = Date.now();
    
    const batteryDrain = this.startBatteryLevel - endBatteryLevel;
    const duration = endTime - this.startTime;
    
    return {
      batteryDrainPercent: batteryDrain * 100,
      durationMs: duration,
      drainRate: (batteryDrain * 100) / (duration / 1000 / 60) // % per minute
    };
  }
}
```

Bu optimizasyonları uygulayarak, uygulamanızın batarya tüketimini önemli ölçüde azaltabilir ve kullanıcı deneyimini iyileştirebilirsiniz.
