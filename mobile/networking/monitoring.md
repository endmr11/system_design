# Ağ İzleme & Analitik

Mobil uygulamalarda ağ performansını izleme ve analiz etme teknikleri.

## Gerçek Zamanlı İzleme

### Performans Metrikleri
- **Yanıt Süresi Takibi**:
  - İstek/yanıt gecikme süresi ölçümü
  - Yüzdelik bazlı analiz (P50, P95, P99)
  - Geçmiş trend izleme
- **Bant Genişliği Kullanımı**:
  - Veri transfer hacmi takibi
  - Yükleme/indirme hızı izleme
  - Veri kullanımı optimizasyon içgörüleri
- **Hata Oranları**:
  - HTTP hata kodu dağılımı
  - Ağ hatası kategorizasyonu
  - Hata oranı trend analizi

### Ağ Kalitesi Değerlendirmesi
- **Bağlantı Tipi Tespiti**:
  - WiFi ve hücresel ağ tanımlama
  - Bağlantı hızı sınıflandırması
  - Ağ kalitesi puanlaması
- **Sinyal Gücü İzleme**:
  - RSSI ölçümü
  - Ağ operatör bilgisi
  - Kapsama alanı analizi
- **Ağ Geçiş Olayları**:
  - El değiştirme tespiti
  - Bağlantı kararlılığı takibi
  - Performans etki değerlendirmesi

## Analitik Entegrasyonu

### Kullanıcı Davranışı Analitiği
- **Ağ Kullanım Desenleri**:
  - Yoğun kullanım zamanlarının belirlenmesi
  - Özellik kullanımı korelasyonu
  - Coğrafi kullanım dağılımı
- **Özellik Benimseme Takibi**:
  - Ağ bağımlı özellik kullanımı
  - Benimseme üzerindeki performans etkisi
  - Kullanıcı tutma korelasyonu
- **Hata Etki Analizi**:
  - Ağ hataları sonrası kullanıcı kaybı
  - Hata kurtarma başarı oranları
  - Müşteri memnuniyeti korelasyonu

### Performans Analitiği
- **Yükleme Süresi Takibi**:
  - Sayfa/ekran yükleme performansı
  - Kaynak yükleme süreleri
  - Kullanıcı etkileşim gecikmeleri
- **Kaynak Kullanımı**:
  - Ağ yığını verimliliği
  - Bağlantı havuzu kullanımı
  - Önbellek isabet oranları
- **Pil Etkisi Değerlendirmesi**:
  - Ağ aktivitesi güç tüketimi
  - Radyo kullanımı optimizasyonu
  - Arka plan senkronizasyon verimliliği

## Hata Ayıklama Araçları

### Ağ İncelemesi
- **Charles Proxy Entegrasyonu**:
  - HTTP/HTTPS trafik analizi
  - İstek/yanıt incelemesi
  - Hata ayıklama için SSL şifre çözme
- **Wireshark Analizi**:
  - Paket seviyesinde ağ analizi
  - Protokol hata ayıklama
  - Ağ sorun giderme
- **Özel Günlük Tutma**:
  - Uygulama seviyesinde ağ günlüğü
  - Hata ayıklama bilgisi toplama
  - Hata bağlamı koruma

### Performans Profilleme
- **CPU Kullanım Analizi**:
  - Ağ işleme yükü
  - İş parçacığı verimliliği
  - Arka plan görevi etkisi
- **Bellek Tüketimi**:
  - Ağ tamponu kullanımı
  - Önbellek bellek tahsisi
  - Bellek sızıntısı tespiti
- **Ağ Yığını Analizi**:
  - Bağlantı yaşam döngüsü takibi
  - Protokol verimliliği değerlendirmesi
  - Kaynak optimizasyon fırsatları

## İzleme Uygulaması

### Platform Özel İzleme

#### Android Ağ İzleme
```kotlin
class NetworkMonitor {
    private val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    
    fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
            
        connectivityManager.registerNetworkCallback(request, networkCallback)
    }
    
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // Ağ kullanılabilir hale geldi
            trackNetworkEvent("network_available")
        }
        
        override fun onLost(network: Network) {
            // Ağ bağlantısı kesildi
            trackNetworkEvent("network_lost")
        }
        
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            val linkDownstream = capabilities.linkDownstreamBandwidthKbps
            val linkUpstream = capabilities.linkUpstreamBandwidthKbps
            
            trackBandwidth(linkDownstream, linkUpstream)
        }
    }
}
```

#### iOS Ağ İzleme
```swift
import Network

class NetworkMonitor: ObservableObject {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    @Published var isConnected = false
    @Published var connectionType: NWInterface.InterfaceType?
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type
                
                self?.trackNetworkChange(path)
            }
        }
        
        monitor.start(queue: queue)
    }
    
    private func trackNetworkChange(_ path: NWPath) {
        let networkInfo = [
            "status": path.status.rawValue,
            "is_expensive": path.isExpensive,
            "is_constrained": path.isConstrained
        ]
        
        Analytics.track("network_change", properties: networkInfo)
    }
}
```

### Özel Analitik Uygulaması
```dart
// Flutter Ağ Analitiği
class NetworkAnalytics {
  static final Map<String, List<int>> _responseTimes = {};
  static final Map<String, int> _errorCounts = {};
  
  static void trackRequest(String endpoint, int responseTime, bool success) {
    // Yanıt süresini takip et
    _responseTimes.putIfAbsent(endpoint, () => []);
    _responseTimes[endpoint]!.add(responseTime);
    
    // Hataları takip et
    if (!success) {
      _errorCounts[endpoint] = (_errorCounts[endpoint] ?? 0) + 1;
    }
    
    // Analitik servisine gönder
    _sendAnalytics(endpoint, responseTime, success);
  }
  
  static Map<String, dynamic> getPerformanceReport() {
    final report = <String, dynamic>{};
    
    _responseTimes.forEach((endpoint, times) {
      if (times.isNotEmpty) {
        times.sort();
        report[endpoint] = {
          'avg_response_time': times.reduce((a, b) => a + b) / times.length,
          'p95_response_time': times[(times.length * 0.95).round()],
          'error_rate': (_errorCounts[endpoint] ?? 0) / times.length,
          'total_requests': times.length,
        };
      }
    });
    
    return report;
  }
}
```

## Gelişmiş İzleme Teknikleri

### Gerçek Zamanlı Uyarılar
- **Performans Eşik İzleme**:
  - Yanıt süresi uyarıları
  - Hata oranı artışları
  - Bant genişliği kullanım limitleri
- **Otomatik Olay Yanıtı**:
  - Uyarı eskalasyonu
  - Performans düşüşü tespiti
  - Kurtarma süresi takibi

### Ağ Performansı için A/B Testi
- **Performans Deney Tasarımı**:
  - Farklı yeniden deneme stratejileri testi
  - Sıkıştırma algoritması karşılaştırması
  - Önbellek stratejisi değerlendirmesi
- **İstatistiksel Analiz**:
  - Performans etki ölçümü
  - Kullanıcı deneyimi korelasyonu
  - İş metrikleri korelasyonu

### Öngörücü Analitik
- **Performans Tahmini**:
  - Trafik deseni tahmini
  - Kaynak kullanımı tahmini
  - Kapasite planlama içgörüleri
- **Anomali Tespiti**:
  - Olağandışı trafik desenleri
  - Performans gerilemesi tespiti
  - Güvenlik tehdidi tanımlama
