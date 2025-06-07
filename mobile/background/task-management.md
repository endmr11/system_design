# Arkaplan Görev Yönetimi

## Genel Bakış

Modern mobil uygulamalarda arkaplan işleme, kullanıcı deneyimini kesintiye uğratmadan kritik görevleri yerine getirmek için hayati öneme sahiptir. Bu dokümantasyon, iOS ve Android platformlarında etkili arkaplan görev yönetimi stratejilerini kapsar.

## Platform-Specific Arkaplan İşleme

### iOS Background Tasks
```swift
import BackgroundTasks

class BackgroundTaskManager {
    static func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.refresh",
            using: nil
        ) { task in
            handleAppRefresh(task: task as! BGAppRefreshTask)
        }
    }
    
    private static func handleAppRefresh(task: BGAppRefreshTask) {
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        // Arkaplan işlemini gerçekleştir
        performBackgroundWork { success in
            task.setTaskCompleted(success: success)
        }
    }
}
```

### Android Background Services
```kotlin
class BackgroundSyncService : Service() {
    private val binder = LocalBinder()
    
    inner class LocalBinder : Binder() {
        fun getService(): BackgroundSyncService = this@BackgroundSyncService
    }
    
    override fun onBind(intent: Intent): IBinder {
        return binder
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundService()
        performBackgroundSync()
        return START_STICKY
    }
    
    private fun startForegroundService() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Senkronizasyon")
            .setContentText("Veriler senkronize ediliyor...")
            .setSmallIcon(R.drawable.ic_sync)
            .build()
            
        startForeground(1, notification)
    }
}
```

## En İyi Uygulamalar

### 1. Batarya Optimizasyonu
- İşlem süresini minimize edin
- Ağ isteklerini gruplayın
- Gereksiz işlemleri önleyin

### 2. Platform Sınırlamaları
- iOS: 30 saniye çalışma süresi limiti
- Android: Doze modu ve App Standby'yi dikkate alın

### 3. Hata Yönetimi
```swift
func performBackgroundWork(completion: @escaping (Bool) -> Void) {
    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            print("Arkaplan görevi başarısız oldu: \(error)")
            completion(false)
            return
        }
        
        // İşlem başarılı
        completion(true)
    }
    task.resume()
}
```
