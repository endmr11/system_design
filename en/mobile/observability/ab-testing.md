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

### React Native Implementation

```javascript
// ABTestManager.js
import remoteConfig from '@react-native-firebase/remote-config';
import analytics from '@react-native-firebase/analytics';

class ABTestManager {
  constructor() {
    this.activeExperiments = new Map();
    this.experimentPrefix = 'experiment_';
    this.cacheExpiration = 3600000; // 1 hour
    this.isInitialized = false;
    this.setupRemoteConfig();
  }

  async setupRemoteConfig() {
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: this.cacheExpiration,
    });

    await remoteConfig().setDefaults({
      'experiment_new_checkout_flow': 'control',
      'experiment_product_recommendation_algorithm': 'collaborative_filtering',
      'experiment_onboarding_flow': 'standard',
      'experiment_pricing_display': 'original',
      'experiment_button_color': '#2196F3',
    });
  }

  async initializeExperiments() {
    try {
      await remoteConfig().fetch();
      const activated = await remoteConfig().activate();
      
      if (activated) {
        this.loadActiveExperiments();
        this.isInitialized = true;
      }
      
      return activated;
    } catch (error) {
      console.error('Error initializing experiments:', error);
      return false;
    }
  }

  loadActiveExperiments() {
    const allKeys = remoteConfig().getAll();
    const experimentKeys = Object.keys(allKeys).filter(key => 
      key.startsWith(this.experimentPrefix)
    );

    experimentKeys.forEach(key => {
      const experimentName = key.replace(this.experimentPrefix, '');
      const variantName = remoteConfig().getValue(key).asString();
      
      const variant = {
        experimentName,
        variantName,
        parameters: this.getExperimentParameters(experimentName, variantName),
      };

      this.activeExperiments.set(experimentName, variant);

      // Track experiment assignment
      analytics().logEvent('experiment_assigned', {
        experiment_name: experimentName,
        variant_name: variantName,
      });
    });
  }

  getExperimentVariant(experimentName) {
    return this.activeExperiments.get(experimentName);
  }

  isExperimentActive(experimentName) {
    return this.activeExperiments.has(experimentName);
  }

  async trackExperimentEvent(experimentName, eventName, parameters = {}) {
    const variant = this.activeExperiments.get(experimentName);
    if (!variant) return;

    const eventParameters = {
      experiment_name: experimentName,
      variant_name: variant.variantName,
      ...parameters,
    };

    await analytics().logEvent(`experiment_${eventName}`, eventParameters);
  }

  async trackConversion(experimentName, conversionType, value = 0) {
    await this.trackExperimentEvent(experimentName, 'conversion', {
      conversion_type: conversionType,
      conversion_value: value,
    });
  }

  getExperimentParameters(experimentName, variantName) {
    switch (experimentName) {
      case 'new_checkout_flow':
        switch (variantName) {
          case 'single_page':
            return { steps: 1, layout: 'compact' };
          case 'multi_step':
            return { steps: 3, layout: 'detailed' };
          default:
            return { steps: 2, layout: 'standard' };
        }
      case 'button_color':
        return { color: variantName };
      case 'pricing_display':
        return { format: variantName };
      default:
        return {};
    }
  }
}

// React Hook
import { useState, useEffect, useContext, createContext } from 'react';

const ABTestContext = createContext();

export const ABTestProvider = ({ children }) => {
  const [abTestManager] = useState(() => new ABTestManager());
  const [isInitialized, setIsInitialized] = useState(false);
  const [experiments, setExperiments] = useState(new Map());

  useEffect(() => {
    initializeABTests();
  }, []);

  const initializeABTests = async () => {
    const success = await abTestManager.initializeExperiments();
    if (success) {
      setIsInitialized(true);
      setExperiments(new Map(abTestManager.activeExperiments));
    }
  };

  const value = {
    abTestManager,
    isInitialized,
    experiments,
    getExperimentVariant: (experimentName) => experiments.get(experimentName),
    isExperimentActive: (experimentName) => experiments.has(experimentName),
    trackExperimentEvent: abTestManager.trackExperimentEvent.bind(abTestManager),
    trackConversion: abTestManager.trackConversion.bind(abTestManager),
  };

  return (
    <ABTestContext.Provider value={value}>
      {children}
    </ABTestContext.Provider>
  );
};

export const useABTest = () => {
  const context = useContext(ABTestContext);
  if (!context) {
    throw new Error('useABTest must be used within an ABTestProvider');
  }
  return context;
};

// Usage in React Native Component
import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { useABTest } from './ABTestProvider';

const CheckoutScreen = () => {
  const { 
    getExperimentVariant, 
    trackExperimentEvent, 
    trackConversion,
    isInitialized 
  } = useABTest();
  
  const [checkoutVariant, setCheckoutVariant] = useState(null);

  useEffect(() => {
    if (isInitialized) {
      const variant = getExperimentVariant('new_checkout_flow');
      setCheckoutVariant(variant);
      
      if (variant) {
        trackExperimentEvent('new_checkout_flow', 'exposure');
      }
    }
  }, [isInitialized]);

  const handlePurchaseCompleted = (amount) => {
    trackConversion('new_checkout_flow', 'purchase', amount);
  };

  const renderCheckoutFlow = () => {
    if (!checkoutVariant) {
      return <StandardCheckoutFlow onPurchase={handlePurchaseCompleted} />;
    }

    switch (checkoutVariant.variantName) {
      case 'single_page':
        return <SinglePageCheckoutFlow onPurchase={handlePurchaseCompleted} />;
      case 'multi_step':
        return <MultiStepCheckoutFlow onPurchase={handlePurchaseCompleted} />;
      default:
        return <StandardCheckoutFlow onPurchase={handlePurchaseCompleted} />;
    }
  };

  return (
    <View>
      <Text>Checkout</Text>
      {renderCheckoutFlow()}
    </View>
  );
};

export default CheckoutScreen;
```

### Flutter Implementation

```dart
// ab_test_manager.dart
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'dart:async';
import 'dart:convert';

class ABTestManager {
  static final ABTestManager _instance = ABTestManager._internal();
  factory ABTestManager() => _instance;
  ABTestManager._internal();

  final FirebaseRemoteConfig _remoteConfig = FirebaseRemoteConfig.instance;
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  
  static const String _experimentPrefix = 'experiment_';
  static const int _cacheExpiration = 3600; // 1 hour
  
  final Map<String, ExperimentVariant> _activeExperiments = {};
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;
  Map<String, ExperimentVariant> get activeExperiments => Map.unmodifiable(_activeExperiments);

  Future<void> initialize() async {
    await _setupRemoteConfig();
    await initializeExperiments();
  }

  Future<void> _setupRemoteConfig() async {
    await _remoteConfig.setConfigSettings(RemoteConfigSettings(
      fetchTimeout: const Duration(seconds: 10),
      minimumFetchInterval: const Duration(seconds: _cacheExpiration),
    ));

    await _remoteConfig.setDefaults({
      '${_experimentPrefix}new_checkout_flow': 'control',
      '${_experimentPrefix}product_recommendation_algorithm': 'collaborative_filtering',
      '${_experimentPrefix}onboarding_flow': 'standard',
      '${_experimentPrefix}pricing_display': 'original',
      '${_experimentPrefix}button_color': '#2196F3',
    });
  }

  Future<bool> initializeExperiments() async {
    try {
      await _remoteConfig.fetch();
      final activated = await _remoteConfig.activate();
      
      if (activated) {
        _loadActiveExperiments();
        _isInitialized = true;
      }
      
      return activated;
    } catch (e) {
      print('Error initializing experiments: $e');
      return false;
    }
  }

  void _loadActiveExperiments() {
    final allKeys = _remoteConfig.getAll().keys;
    final experimentKeys = allKeys.where((key) => key.startsWith(_experimentPrefix));

    for (final key in experimentKeys) {
      final experimentName = key.replaceFirst(_experimentPrefix, '');
      final variantName = _remoteConfig.getString(key);
      
      final variant = ExperimentVariant(
        experimentName: experimentName,
        variantName: variantName,
        parameters: _getExperimentParameters(experimentName, variantName),
      );

      _activeExperiments[experimentName] = variant;

      // Track experiment assignment
      _analytics.logEvent(
        name: 'experiment_assigned',
        parameters: {
          'experiment_name': experimentName,
          'variant_name': variantName,
        },
      );
    }
  }

  ExperimentVariant? getExperimentVariant(String experimentName) {
    return _activeExperiments[experimentName];
  }

  bool isExperimentActive(String experimentName) {
    return _activeExperiments.containsKey(experimentName);
  }

  Future<void> trackExperimentEvent(
    String experimentName, 
    String eventName, 
    [Map<String, dynamic>? parameters]
  ) async {
    final variant = _activeExperiments[experimentName];
    if (variant == null) return;

    final eventParameters = <String, dynamic>{
      'experiment_name': experimentName,
      'variant_name': variant.variantName,
      ...?parameters,
    };

    await _analytics.logEvent(
      name: 'experiment_$eventName',
      parameters: eventParameters,
    );
  }

  Future<void> trackConversion(
    String experimentName, 
    String conversionType, 
    [double value = 0.0]
  ) async {
    await trackExperimentEvent(
      experimentName,
      'conversion',
      {
        'conversion_type': conversionType,
        'conversion_value': value,
      },
    );
  }

  Map<String, dynamic> _getExperimentParameters(String experimentName, String variantName) {
    switch (experimentName) {
      case 'new_checkout_flow':
        switch (variantName) {
          case 'single_page':
            return {'steps': 1, 'layout': 'compact'};
          case 'multi_step':
            return {'steps': 3, 'layout': 'detailed'};
          default:
            return {'steps': 2, 'layout': 'standard'};
        }
      case 'button_color':
        return {'color': variantName};
      case 'pricing_display':
        return {'format': variantName};
      default:
        return {};
    }
  }
}

// experiment_variant.dart
class ExperimentVariant {
  final String experimentName;
  final String variantName;
  final Map<String, dynamic> parameters;

  const ExperimentVariant({
    required this.experimentName,
    required this.variantName,
    required this.parameters,
  });

  @override
  String toString() {
    return 'ExperimentVariant(experimentName: $experimentName, variantName: $variantName, parameters: $parameters)';
  }
}

// ab_test_provider.dart
import 'package:flutter/foundation.dart';
import 'ab_test_manager.dart';

class ABTestProvider extends ChangeNotifier {
  final ABTestManager _abTestManager = ABTestManager();
  
  bool get isInitialized => _abTestManager.isInitialized;
  Map<String, ExperimentVariant> get activeExperiments => _abTestManager.activeExperiments;

  Future<void> initialize() async {
    await _abTestManager.initialize();
    notifyListeners();
  }

  ExperimentVariant? getExperimentVariant(String experimentName) {
    return _abTestManager.getExperimentVariant(experimentName);
  }

  bool isExperimentActive(String experimentName) {
    return _abTestManager.isExperimentActive(experimentName);
  }

  Future<void> trackExperimentEvent(
    String experimentName, 
    String eventName, 
    [Map<String, dynamic>? parameters]
  ) async {
    await _abTestManager.trackExperimentEvent(experimentName, eventName, parameters);
  }

  Future<void> trackConversion(
    String experimentName, 
    String conversionType, 
    [double value = 0.0]
  ) async {
    await _abTestManager.trackConversion(experimentName, conversionType, value);
  }
}

// Usage in Flutter App
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'ab_test_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  final abTestProvider = ABTestProvider();
  await abTestProvider.initialize();
  
  runApp(
    ChangeNotifierProvider.value(
      value: abTestProvider,
      child: MyApp(),
    ),
  );
}

class CheckoutScreen extends StatefulWidget {
  @override
  _CheckoutScreenState createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  ExperimentVariant? checkoutVariant;

  @override
  void initState() {
    super.initState();
    _setupExperiment();
  }

  void _setupExperiment() {
    final abTestProvider = Provider.of<ABTestProvider>(context, listen: false);
    
    if (abTestProvider.isInitialized) {
      checkoutVariant = abTestProvider.getExperimentVariant('new_checkout_flow');
      
      if (checkoutVariant != null) {
        abTestProvider.trackExperimentEvent('new_checkout_flow', 'exposure');
      }
    }
  }

  void _onPurchaseCompleted(double amount) {
    final abTestProvider = Provider.of<ABTestProvider>(context, listen: false);
    abTestProvider.trackConversion('new_checkout_flow', 'purchase', amount);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Checkout')),
      body: _buildCheckoutFlow(),
    );
  }

  Widget _buildCheckoutFlow() {
    if (checkoutVariant == null) {
      return StandardCheckoutFlow(onPurchase: _onPurchaseCompleted);
    }

    switch (checkoutVariant!.variantName) {
      case 'single_page':
        return SinglePageCheckoutFlow(onPurchase: _onPurchaseCompleted);
      case 'multi_step':
        return MultiStepCheckoutFlow(onPurchase: _onPurchaseCompleted);
      default:
        return StandardCheckoutFlow(onPurchase: _onPurchaseCompleted);
    }
  }
}
```

## Custom A/B Testing Service

### Node.js Backend Service

```javascript
// ab-test-service.js
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Experiment Schema
const experimentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  status: { 
    type: String, 
    enum: ['draft', 'running', 'paused', 'completed'], 
    default: 'draft' 
  },
  variants: [{
    name: String,
    weight: { type: Number, default: 50 }, // Percentage allocation
    parameters: mongoose.Schema.Types.Mixed,
  }],
  targetingRules: [{
    condition: String,
    priority: Number,
  }],
  metrics: [{
    name: String,
    type: { type: String, enum: ['conversion', 'revenue', 'engagement'] },
    isGoalMetric: { type: Boolean, default: false },
  }],
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Experiment = mongoose.model('Experiment', experimentSchema);

// Assignment Schema
const assignmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  experimentName: { type: String, required: true },
  variantName: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed,
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

// Event Schema
const eventSchema = new mongoose.Schema({
  userId: String,
  experimentName: String,
  variantName: String,
  eventType: String,
  eventName: String,
  properties: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
});

const Event = mongoose.model('Event', eventSchema);

class ABTestService {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      req.userId = req.headers['x-user-id'] || this.generateUserId();
      req.userAttributes = {
        platform: req.headers['x-platform'],
        appVersion: req.headers['x-app-version'],
        country: req.headers['x-country'],
        userType: req.headers['x-user-type'],
      };
      next();
    });
  }

  setupRoutes() {
    this.app.get('/experiments/:userId', this.getExperiments.bind(this));
    this.app.post('/experiments/:name/assign', this.assignVariant.bind(this));
    this.app.post('/events', this.trackEvent.bind(this));
    this.app.get('/experiments/:name/results', this.getExperimentResults.bind(this));
    this.app.post('/experiments', this.createExperiment.bind(this));
    this.app.put('/experiments/:name', this.updateExperiment.bind(this));
  }

  async getExperiments(req, res) {
    try {
      const { userId } = req.params;
      const runningExperiments = await Experiment.find({ status: 'running' });
      
      const assignments = {};
      
      for (const experiment of runningExperiments) {
        if (this.isUserEligible(experiment, req.userAttributes)) {
          const assignment = await this.getOrCreateAssignment(userId, experiment);
          assignments[experiment.name] = {
            variant: assignment.variantName,
            parameters: this.getVariantParameters(experiment, assignment.variantName),
          };
        }
      }

      res.json({ experiments: assignments });
    } catch (error) {
      console.error('Error getting experiments:', error);
      res.status(500).json({ error: 'Failed to get experiments' });
    }
  }

  async assignVariant(req, res) {
    try {
      const { name } = req.params;
      const { userId } = req.body;
      
      const experiment = await Experiment.findOne({ name, status: 'running' });
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found or not running' });
      }

      const assignment = await this.getOrCreateAssignment(userId, experiment);
      
      res.json({
        experimentName: name,
        variantName: assignment.variantName,
        parameters: this.getVariantParameters(experiment, assignment.variantName),
      });
    } catch (error) {
      console.error('Error assigning variant:', error);
      res.status(500).json({ error: 'Failed to assign variant' });
    }
  }

  async trackEvent(req, res) {
    try {
      const { userId, experimentName, eventType, eventName, properties } = req.body;
      
      const assignment = await Assignment.findOne({ userId, experimentName });
      if (!assignment) {
        return res.status(404).json({ error: 'No assignment found for user and experiment' });
      }

      const event = new Event({
        userId,
        experimentName,
        variantName: assignment.variantName,
        eventType,
        eventName,
        properties,
      });

      await event.save();
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  }

  async getExperimentResults(req, res) {
    try {
      const { name } = req.params;
      const results = await this.calculateExperimentResults(name);
      res.json(results);
    } catch (error) {
      console.error('Error getting experiment results:', error);
      res.status(500).json({ error: 'Failed to get experiment results' });
    }
  }

  async getOrCreateAssignment(userId, experiment) {
    let assignment = await Assignment.findOne({
      userId,
      experimentName: experiment.name,
    });

    if (!assignment) {
      const variantName = this.selectVariant(userId, experiment);
      assignment = new Assignment({
        userId,
        experimentName: experiment.name,
        variantName,
      });
      await assignment.save();
    }

    return assignment;
  }

  selectVariant(userId, experiment) {
    // Consistent hash-based assignment
    const hash = crypto
      .createHash('md5')
      .update(`${userId}-${experiment.name}`)
      .digest('hex');
    
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const percentage = (hashInt % 100) + 1;
    
    let cumulativeWeight = 0;
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (percentage <= cumulativeWeight) {
        return variant.name;
      }
    }
    
    return experiment.variants[0].name; // Fallback
  }

  getVariantParameters(experiment, variantName) {
    const variant = experiment.variants.find(v => v.name === variantName);
    return variant ? variant.parameters : {};
  }

  isUserEligible(experiment, userAttributes) {
    if (!experiment.targetingRules.length) return true;
    
    return experiment.targetingRules.some(rule => {
      try {
        const func = new Function('user', `return ${rule.condition}`);
        return func(userAttributes);
      } catch {
        return false;
      }
    });
  }

  async calculateExperimentResults(experimentName) {
    const pipeline = [
      { $match: { experimentName } },
      {
        $group: {
          _id: { variantName: '$variantName', eventType: '$eventType' },
          count: { $sum: 1 },
          users: { $addToSet: '$userId' },
        }
      },
      {
        $group: {
          _id: '$_id.variantName',
          events: {
            $push: {
              eventType: '$_id.eventType',
              count: '$count',
              uniqueUsers: { $size: '$users' },
            }
          },
          totalUsers: { $addToSet: '$users' },
        }
      },
      {
        $project: {
          variant: '$_id',
          events: 1,
          totalUniqueUsers: { $size: { $reduce: {
            input: '$totalUsers',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] }
          }}}
        }
      }
    ];

    const results = await Event.aggregate(pipeline);
    return this.calculateStatisticalSignificance(results);
  }

  calculateStatisticalSignificance(results) {
    // Implement statistical significance calculation
    // This is a simplified version - use proper statistical libraries in production
    return results.map(result => ({
      ...result,
      conversionRate: this.calculateConversionRate(result),
      confidenceInterval: this.calculateConfidenceInterval(result),
      significance: this.calculateSignificance(result, results),
    }));
  }

  generateUserId() {
    return crypto.randomUUID();
  }
}

module.exports = ABTestService;
```

## Statistical Analysis Dashboard

### React Analytics Dashboard

```jsx
// ExperimentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Statistic, 
  Progress, 
  Tag, 
  Space,
  Alert,
  Tabs,
  Row,
  Col
} from 'antd';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ExperimentDashboard = ({ experimentName }) => {
  const [experimentData, setExperimentData] = useState(null);
  const [results, setResults] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExperimentData();
    const interval = setInterval(fetchExperimentData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [experimentName]);

  const fetchExperimentData = async () => {
    try {
      setLoading(true);
      
      const [experimentRes, resultsRes, timelineRes] = await Promise.all([
        fetch(`/api/experiments/${experimentName}`),
        fetch(`/api/experiments/${experimentName}/results`),
        fetch(`/api/experiments/${experimentName}/timeline`),
      ]);

      const experiment = await experimentRes.json();
      const results = await resultsRes.json();
      const timeline = await timelineRes.json();

      setExperimentData(experiment);
      setResults(results);
      setTimeline(timeline);
    } catch (error) {
      console.error('Error fetching experiment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSignificanceColor = (significance) => {
    if (significance >= 0.95) return 'green';
    if (significance >= 0.90) return 'orange';
    return 'red';
  };

  const variantColumns = [
    {
      title: 'Variant',
      dataIndex: 'variant',
      key: 'variant',
      render: (variant) => <Tag color="blue">{variant}</Tag>,
    },
    {
      title: 'Users',
      dataIndex: 'totalUniqueUsers',
      key: 'users',
      render: (users) => users.toLocaleString(),
    },
    {
      title: 'Conversion Rate',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      render: (rate) => `${(rate * 100).toFixed(2)}%`,
    },
    {
      title: 'Confidence',
      dataIndex: 'significance',
      key: 'significance',
      render: (significance) => (
        <Progress 
          percent={Math.round(significance * 100)} 
          status={getSignificanceColor(significance)}
          size="small"
        />
      ),
    },
    {
      title: 'Lift',
      key: 'lift',
      render: (_, record, index) => {
        if (index === 0) return '-'; // Control variant
        const controlRate = results[0]?.conversionRate || 0;
        const lift = ((record.conversionRate - controlRate) / controlRate) * 100;
        return (
          <span style={{ color: lift > 0 ? 'green' : 'red' }}>
            {lift > 0 ? '+' : ''}{lift.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  if (loading) {
    return <div>Loading experiment data...</div>;
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Participants"
              value={results.reduce((sum, r) => sum + r.totalUniqueUsers, 0)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Duration"
              value={experimentData?.duration || 0}
              suffix="days"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Status"
              value={experimentData?.status}
              valueStyle={{ color: experimentData?.status === 'running' ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Confidence Level"
              value={Math.max(...results.map(r => r.significance)) * 100}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {results.some(r => r.significance >= 0.95) && (
        <Alert
          message="Statistical Significance Achieved"
          description="One or more variants have achieved statistical significance. Consider concluding the experiment."
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs defaultActiveKey="results">
        <Tabs.TabPane tab="Results" key="results">
          <Card title="Variant Performance">
            <Table
              columns={variantColumns}
              dataSource={results}
              rowKey="variant"
              pagination={false}
            />
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="Timeline" key="timeline">
          <Card title="Conversion Rate Over Time">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {results.map((variant, index) => (
                  <Line
                    key={variant.variant}
                    type="monotone"
                    dataKey={`${variant.variant}_rate`}
                    stroke={`hsl(${index * 120}, 70%, 50%)`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="Events" key="events">
          <Card title="Event Breakdown">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={results}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="variant" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalUniqueUsers" fill="#8884d8" name="Users" />
                <Bar dataKey="conversions" fill="#82ca9d" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ExperimentDashboard;
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
