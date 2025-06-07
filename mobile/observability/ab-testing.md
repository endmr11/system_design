# A/B Test Altyapısı

## Genel Bakış

A/B test altyapısı, mobil uygulamalarda kontrollü deneyler yaparak veri odaklı karar vermeyi sağlar. Bu dokümantasyon, Android, iOS, React Native ve Flutter platformlarında kapsamlı A/B test uygulamasını, istatistiksel analiz ve otomatik karar verme mekanizmalarıyla birlikte ele alır.

## Firebase A/B Test

### Android Uygulaması

```kotlin
// ABTestManager.kt
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings
import kotlinx.coroutines.tasks.await
import android.content.Context
import java.util.concurrent.ConcurrentHashMap

class ABTestManager(private val context: Context) {
    private val remoteConfig = FirebaseRemoteConfig.getInstance()
    private val analytics = FirebaseAnalytics.getInstance(context)
    private val activeExperiments = ConcurrentHashMap<String, ExperimentVariant>()
    
    companion object {
        private const val EXPERIMENT_PREFIX = "experiment_"
        private const val CACHE_EXPIRATION = 3600L // 1 saat
    }
    
    init {
        setupRemoteConfig()
    }
    
    private fun setupRemoteConfig() {
        val configSettings = FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(CACHE_EXPIRATION)
            .build()
        
        remoteConfig.setConfigSettingsAsync(configSettings)
        setExperimentDefaults()
    }
    
    private fun setExperimentDefaults() {
        val defaults = mapOf(
            "${EXPERIMENT_PREFIX}yeni_odeme_akisi" to "kontrol",
            "${EXPERIMENT_PREFIX}urun_onerim_algoritmasi" to "isbirlikci_filtreleme",
            "${EXPERIMENT_PREFIX}hosgeldin_akisi" to "standart",
            "${EXPERIMENT_PREFIX}fiyat_gosterimi" to "orijinal",
            "${EXPERIMENT_PREFIX}buton_rengi" to "#2196F3"
        )
        
        remoteConfig.setDefaultsAsync(defaults)
    }
    
    suspend fun initializeExperiments(): Boolean {
        return try {
            remoteConfig.fetchAndActivate().await()
            loadActiveExperiments()
            true
        } catch (e: Exception) {
            false
        }
    }
    
    private fun loadActiveExperiments() {
        val allKeys = remoteConfig.getKeysByPrefix(EXPERIMENT_PREFIX)
        
        for (key in allKeys) {
            val experimentName = key.removePrefix(EXPERIMENT_PREFIX)
            val variantName = remoteConfig.getString(key)
            
            val variant = ExperimentVariant(
                experimentName = experimentName,
                variantName = variantName,
                parameters = getExperimentParameters(experimentName, variantName)
            )
            
            activeExperiments[experimentName] = variant
            
            // Deney atamasını izle
            analytics.logEvent("deney_atandi") {
                param("deney_adi", experimentName)
                param("varyant_adi", variantName)
            }
        }
    }
    
    fun getExperimentVariant(experimentName: String): ExperimentVariant? {
        return activeExperiments[experimentName]
    }
    
    fun isExperimentActive(experimentName: String): Boolean {
        return activeExperiments.containsKey(experimentName)
    }
    
    fun trackExperimentEvent(experimentName: String, eventName: String, parameters: Map<String, Any> = emptyMap()) {
        val variant = activeExperiments[experimentName] ?: return
        
        val eventParameters = mutableMapOf<String, Any>().apply {
            put("deney_adi", experimentName)
            put("varyant_adi", variant.variantName)
            putAll(parameters)
        }
        
        analytics.logEvent("deney_$eventName", eventParameters)
    }
    
    fun trackConversion(experimentName: String, conversionType: String, value: Double = 0.0) {
        trackExperimentEvent(
            experimentName, 
            "donusum",
            mapOf(
                "donusum_tipi" to conversionType,
                "donusum_degeri" to value
            )
        )
    }
    
    private fun getExperimentParameters(experimentName: String, variantName: String): Map<String, Any> {
        return when (experimentName) {
            "yeni_odeme_akisi" -> when (variantName) {
                "tek_sayfa" -> mapOf("adimlar" to 1, "duzen" to "kompakt")
                "coklu_adim" -> mapOf("adimlar" to 3, "duzen" to "detayli")
                else -> mapOf("adimlar" to 2, "duzen" to "standart")
            }
            "buton_rengi" -> mapOf("renk" to variantName)
            "fiyat_gosterimi" -> mapOf("format" to variantName)
            else -> emptyMap()
        }
    }
}

// Veri Sınıfları
data class ExperimentVariant(
    val experimentName: String,
    val variantName: String,
    val parameters: Map<String, Any>
)

// Activity'de Kullanım
class OdemeActivity : AppCompatActivity() {
    private lateinit var abTestManager: ABTestManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        abTestManager = ABTestManager(this)
        
        lifecycleScope.launch {
            abTestManager.initializeExperiments()
            setupUIBasedOnExperiments()
        }
    }
    
    private fun setupUIBasedOnExperiments() {
        val odemeDeneyi = abTestManager.getExperimentVariant("yeni_odeme_akisi")
        
        odemeDeneyi?.let { variant ->
            when (variant.variantName) {
                "tek_sayfa" -> setupTekSayfaOdeme()
                "coklu_adim" -> setupCokluAdimOdeme()
                else -> setupStandartOdeme()
            }
            
            // Deney maruziyetini izle
            abTestManager.trackExperimentEvent("yeni_odeme_akisi", "maruziyet")
        }
    }
    
    private fun onPurchaseCompleted(amount: Double) {
        abTestManager.trackConversion("yeni_odeme_akisi", "satis", amount)
    }
}
```

### iOS Uygulaması

```swift
// ABTestManager.swift
import FirebaseRemoteConfig
import FirebaseAnalytics
import Foundation

class ABTestManager: ObservableObject {
    static let shared = ABTestManager()
    
    private let remoteConfig = RemoteConfig.remoteConfig()
    private let experimentPrefix = "experiment_"
    private let cacheExpiration: TimeInterval = 3600 // 1 saat
    
    @Published var activeExperiments: [String: ExperimentVariant] = [:]
    @Published var isInitialized = false
    
    private init() {
        setupRemoteConfig()
    }
    
    private func setupRemoteConfig() {
        let settings = RemoteConfigSettings()
        settings.minimumFetchInterval = cacheExpiration
        remoteConfig.configSettings = settings
        
        setExperimentDefaults()
    }
    
    private func setExperimentDefaults() {
        let defaults: [String: NSObject] = [
            "\(experimentPrefix)yeni_odeme_akisi": "kontrol" as NSObject,
            "\(experimentPrefix)urun_onerim_algoritmasi": "isbirlikci_filtreleme" as NSObject,
            "\(experimentPrefix)hosgeldin_akisi": "standart" as NSObject,
            "\(experimentPrefix)fiyat_gosterimi": "orijinal" as NSObject,
            "\(experimentPrefix)buton_rengi": "#2196F3" as NSObject
        ]
        
        remoteConfig.setDefaults(defaults)
    }
    
    func initializeExperiments() async -> Bool {
        do {
            _ = try await remoteConfig.fetch(withExpirationDuration: cacheExpiration)
            let activated = try await remoteConfig.activate()
            
            if activated {
                loadActiveExperiments()
                isInitialized = true
            }
            
            return activated
        } catch {
            print("Deneyler başlatılırken hata: \(error)")
            return false
        }
    }
    
    private func loadActiveExperiments() {
        let allKeys = remoteConfig.allKeys(from: .remote, namespace: .default)
        let experimentKeys = allKeys.filter { $0.hasPrefix(experimentPrefix) }
        
        var experiments: [String: ExperimentVariant] = [:]
        
        for key in experimentKeys {
            let experimentName = String(key.dropFirst(experimentPrefix.count))
            let variantName = remoteConfig.configValue(forKey: key).stringValue ?? "kontrol"
            
            let variant = ExperimentVariant(
                experimentName: experimentName,
                variantName: variantName,
                parameters: getExperimentParameters(experimentName: experimentName, variantName: variantName)
            )
            
            experiments[experimentName] = variant
            
            // Deney atamasını izle
            Analytics.logEvent("deney_atandi", parameters: [
                "deney_adi": experimentName,
                "varyant_adi": variantName
            ])
        }
        
        DispatchQueue.main.async {
            self.activeExperiments = experiments
        }
    }
    
    func getExperimentVariant(_ experimentName: String) -> ExperimentVariant? {
        return activeExperiments[experimentName]
    }
    
    func isExperimentActive(_ experimentName: String) -> Bool {
        return activeExperiments[experimentName] != nil
    }
    
    func trackExperimentEvent(_ experimentName: String, eventName: String, parameters: [String: Any] = [:]) {
        guard let variant = activeExperiments[experimentName] else { return }
        
        var eventParameters = parameters
        eventParameters["deney_adi"] = experimentName
        eventParameters["varyant_adi"] = variant.variantName
        
        Analytics.logEvent("deney_\(eventName)", parameters: eventParameters)
    }
    
    func trackConversion(_ experimentName: String, conversionType: String, value: Double = 0.0) {
        trackExperimentEvent(
            experimentName,
            eventName: "donusum",
            parameters: [
                "donusum_tipi": conversionType,
                "donusum_degeri": value
            ]
        )
    }
    
    private func getExperimentParameters(experimentName: String, variantName: String) -> [String: Any] {
        switch experimentName {
        case "yeni_odeme_akisi":
            switch variantName {
            case "tek_sayfa":
                return ["adimlar": 1, "duzen": "kompakt"]
            case "coklu_adim":
                return ["adimlar": 3, "duzen": "detayli"]
            default:
                return ["adimlar": 2, "duzen": "standart"]
            }
        case "buton_rengi":
            return ["renk": variantName]
        case "fiyat_gosterimi":
            return ["format": variantName]
        default:
            return [:]
        }
    }
}

// Veri Yapıları
struct ExperimentVariant {
    let experimentName: String
    let variantName: String
    let parameters: [String: Any]
}

// SwiftUI'da Kullanım
struct OdemeView: View {
    @StateObject private var abTestManager = ABTestManager.shared
    @State private var odemeVaryanti: ExperimentVariant?
    
    var body: some View {
        VStack {
            if let variant = odemeVaryanti {
                switch variant.variantName {
                case "tek_sayfa":
                    TekSayfaOdemeView()
                case "coklu_adim":
                    CokluAdimOdemeView()
                default:
                    StandartOdemeView()
                }
            } else {
                StandartOdemeView()
            }
        }
        .onAppear {
            if abTestManager.isInitialized {
                setupExperiment()
            }
        }
        .onReceive(abTestManager.$isInitialized) { initialized in
            if initialized {
                setupExperiment()
            }
        }
    }
    
    private func setupExperiment() {
        odemeVaryanti = abTestManager.getExperimentVariant("yeni_odeme_akisi")
        
        if let variant = odemeVaryanti {
            abTestManager.trackExperimentEvent("yeni_odeme_akisi", eventName: "maruziyet")
        }
    }
    
    private func onPurchaseCompleted(amount: Double) {
        abTestManager.trackConversion("yeni_odeme_akisi", conversionType: "satis", value: amount)
    }
}
```

## En İyi Uygulamalar

### 1. Deney Tasarımı
- Net başarı metrikleri tanımlayın
- Yeterli örneklem büyüklüğü sağlayın
- Uygun randomizasyon kullanın
- Karıştırıcı değişkenleri kontrol edin

### 2. İstatistiksel Sağlamlık
- İstatistiksel gücü hesaplayın
- Anlamlılık eşiklerini belirleyin
- Çoklu karşılaştırmaları hesaba katın
- Erken durdurma için izleme yapın

### 3. Teknik Uygulama
- Tutarlı kullanıcı ataması
- Performans etkisini minimize edin
- Sınır durumlarını düzgün şekilde ele alın
- Uygun loglama uygulayın

### 4. İş Düşünceleri
- İş hedefleriyle uyumlu olun
- Uzun vadeli etkileri göz önünde bulundurun
- Yayın stratejilerini planlayın
- Öğrenilenleri belgelendirin

### 5. Etik ve Uyumluluk
- Gerektiğinde kullanıcı onayı alın
- Kullanıcı gizliliğini koruyun
- Zararlı deneylerden kaçının
- Veri düzenlemelerine uyun

Bu kapsamlı A/B test altyapısı, tüm mobil platformlarda uygun istatistiksel analiz, otomatik karar verme ve sağlam izleme ile kurumsal düzeyde deney yapma yetenekleri sağlar.
