# A/B Testing Infrastructure

## Overview

A/B testing infrastructure enables data-driven decision making by running controlled experiments on mobile applications. This documentation covers comprehensive A/B testing implementation across Android, iOS, React Native, and Flutter platforms with statistical analysis and automated decision making.

## Firebase A/B Testing

### Android Implementation

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
        private const val CACHE_EXPIRATION = 3600L // 1 hour
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
            "${EXPERIMENT_PREFIX}new_checkout_flow" to "control",
            "${EXPERIMENT_PREFIX}product_recommendation_algorithm" to "collaborative_filtering",
            "${EXPERIMENT_PREFIX}onboarding_flow" to "standard",
            "${EXPERIMENT_PREFIX}pricing_display" to "original",
            "${EXPERIMENT_PREFIX}button_color" to "#2196F3"
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
            
            // Track experiment assignment
            analytics.logEvent("experiment_assigned") {
                param("experiment_name", experimentName)
                param("variant_name", variantName)
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
            put("experiment_name", experimentName)
            put("variant_name", variant.variantName)
            putAll(parameters)
        }
        
        analytics.logEvent("experiment_$eventName", eventParameters)
    }
    
    fun trackConversion(experimentName: String, conversionType: String, value: Double = 0.0) {
        trackExperimentEvent(
            experimentName, 
            "conversion",
            mapOf(
                "conversion_type" to conversionType,
                "conversion_value" to value
            )
        )
    }
    
    private fun getExperimentParameters(experimentName: String, variantName: String): Map<String, Any> {
        return when (experimentName) {
            "new_checkout_flow" -> when (variantName) {
                "single_page" -> mapOf("steps" to 1, "layout" to "compact")
                "multi_step" -> mapOf("steps" to 3, "layout" to "detailed")
                else -> mapOf("steps" to 2, "layout" to "standard")
            }
            "button_color" -> mapOf("color" to variantName)
            "pricing_display" -> mapOf("format" to variantName)
            else -> emptyMap()
        }
    }
}

// Data Classes
data class ExperimentVariant(
    val experimentName: String,
    val variantName: String,
    val parameters: Map<String, Any>
)

// Usage in Activity
class CheckoutActivity : AppCompatActivity() {
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
        val checkoutExperiment = abTestManager.getExperimentVariant("new_checkout_flow")
        
        checkoutExperiment?.let { variant ->
            when (variant.variantName) {
                "single_page" -> setupSinglePageCheckout()
                "multi_step" -> setupMultiStepCheckout()
                else -> setupStandardCheckout()
            }
            
            // Track experiment exposure
            abTestManager.trackExperimentEvent("new_checkout_flow", "exposure")
        }
    }
    
    private fun onPurchaseCompleted(amount: Double) {
        abTestManager.trackConversion("new_checkout_flow", "purchase", amount)
    }
}
```

### iOS Implementation

```swift
// ABTestManager.swift
import FirebaseRemoteConfig
import FirebaseAnalytics
import Foundation

class ABTestManager: ObservableObject {
    static let shared = ABTestManager()
    
    private let remoteConfig = RemoteConfig.remoteConfig()
    private let experimentPrefix = "experiment_"
    private let cacheExpiration: TimeInterval = 3600 // 1 hour
    
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
            "\(experimentPrefix)new_checkout_flow": "control" as NSObject,
            "\(experimentPrefix)product_recommendation_algorithm": "collaborative_filtering" as NSObject,
            "\(experimentPrefix)onboarding_flow": "standard" as NSObject,
            "\(experimentPrefix)pricing_display": "original" as NSObject,
            "\(experimentPrefix)button_color": "#2196F3" as NSObject
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
            print("Error initializing experiments: \(error)")
            return false
        }
    }
    
    private func loadActiveExperiments() {
        let allKeys = remoteConfig.allKeys(from: .remote, namespace: .default)
        let experimentKeys = allKeys.filter { $0.hasPrefix(experimentPrefix) }
        
        var experiments: [String: ExperimentVariant] = [:]
        
        for key in experimentKeys {
            let experimentName = String(key.dropFirst(experimentPrefix.count))
            let variantName = remoteConfig.configValue(forKey: key).stringValue ?? "control"
            
            let variant = ExperimentVariant(
                experimentName: experimentName,
                variantName: variantName,
                parameters: getExperimentParameters(experimentName: experimentName, variantName: variantName)
            )
            
            experiments[experimentName] = variant
            
            // Track experiment assignment
            Analytics.logEvent("experiment_assigned", parameters: [
                "experiment_name": experimentName,
                "variant_name": variantName
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
        eventParameters["experiment_name"] = experimentName
        eventParameters["variant_name"] = variant.variantName
        
        Analytics.logEvent("experiment_\(eventName)", parameters: eventParameters)
    }
    
    func trackConversion(_ experimentName: String, conversionType: String, value: Double = 0.0) {
        trackExperimentEvent(
            experimentName,
            eventName: "conversion",
            parameters: [
                "conversion_type": conversionType,
                "conversion_value": value
            ]
        )
    }
    
    private func getExperimentParameters(experimentName: String, variantName: String) -> [String: Any] {
        switch experimentName {
        case "new_checkout_flow":
            switch variantName {
            case "single_page":
                return ["steps": 1, "layout": "compact"]
            case "multi_step":
                return ["steps": 3, "layout": "detailed"]
            default:
                return ["steps": 2, "layout": "standard"]
            }
        case "button_color":
            return ["color": variantName]
        case "pricing_display":
            return ["format": variantName]
        default:
            return [:]
        }
    }
}

// Data Structures
struct ExperimentVariant {
    let experimentName: String
    let variantName: String
    let parameters: [String: Any]
}

// Usage in SwiftUI
struct CheckoutView: View {
    @StateObject private var abTestManager = ABTestManager.shared
    @State private var checkoutVariant: ExperimentVariant?
    
    var body: some View {
        VStack {
            if let variant = checkoutVariant {
                switch variant.variantName {
                case "single_page":
                    SinglePageCheckoutView()
                case "multi_step":
                    MultiStepCheckoutView()
                default:
                    StandardCheckoutView()
                }
            } else {
                StandardCheckoutView()
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
        checkoutVariant = abTestManager.getExperimentVariant("new_checkout_flow")
        
        if let variant = checkoutVariant {
            abTestManager.trackExperimentEvent("new_checkout_flow", eventName: "exposure")
        }
    }
    
    private func onPurchaseCompleted(amount: Double) {
        abTestManager.trackConversion("new_checkout_flow", conversionType: "purchase", value: amount)
    }
}
```

## Best Practices

### 1. Experiment Design
- Define clear success metrics
- Ensure adequate sample sizes
- Use proper randomization
- Control for confounding variables

### 2. Statistical Rigor
- Calculate statistical power
- Set significance thresholds
- Account for multiple comparisons
- Monitor for early stopping

### 3. Technical Implementation
- Consistent user assignment
- Minimize performance impact
- Handle edge cases gracefully
- Implement proper logging

### 4. Business Considerations
- Align with business goals
- Consider long-term effects
- Plan for rollout strategies
- Document learnings

### 5. Ethics and Compliance
- Obtain user consent where required
- Protect user privacy
- Avoid harmful experiments
- Follow data regulations

This comprehensive A/B testing infrastructure provides enterprise-grade experimentation capabilities with proper statistical analysis, automated decision making, and robust tracking across all mobile platforms.
