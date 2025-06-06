# Remote Configuration

## Overview

Remote configuration allows you to modify app behavior and appearance without requiring users to download app updates. This documentation covers comprehensive remote config implementation across Android, iOS, React Native, and Flutter platforms with Firebase Remote Config and custom solutions.

## Firebase Remote Config

### Android Implementation

```kotlin
// RemoteConfigManager.kt
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings
import kotlinx.coroutines.tasks.await
import android.content.Context
import org.json.JSONObject

class RemoteConfigManager(private val context: Context) {
    private val remoteConfig = FirebaseRemoteConfig.getInstance()
    
    companion object {
        private const val CACHE_EXPIRATION = 3600L // 1 hour
        
        // Configuration keys
        const val FEATURE_NEW_UI_ENABLED = "feature_new_ui_enabled"
        const val API_BASE_URL = "api_base_url"
        const val MAX_RETRY_ATTEMPTS = "max_retry_attempts"
        const val MAINTENANCE_MODE = "maintenance_mode"
        const val THEME_CONFIG = "theme_config"
        const val EXPERIMENT_CONFIG = "experiment_config"
    }
    
    init {
        setupRemoteConfig()
    }
    
    private fun setupRemoteConfig() {
        val configSettings = FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(CACHE_EXPIRATION)
            .build()
        
        remoteConfig.setConfigSettingsAsync(configSettings)
        
        // Set default values
        val defaults = mapOf(
            FEATURE_NEW_UI_ENABLED to false,
            API_BASE_URL to "https://api.production.com",
            MAX_RETRY_ATTEMPTS to 3,
            MAINTENANCE_MODE to false,
            THEME_CONFIG to getDefaultThemeConfig(),
            EXPERIMENT_CONFIG to getDefaultExperimentConfig()
        )
        
        remoteConfig.setDefaultsAsync(defaults)
    }
    
    suspend fun fetchAndActivate(): Boolean {
        return try {
            val fetchResult = remoteConfig.fetch(CACHE_EXPIRATION).await()
            val activateResult = remoteConfig.activate().await()
            activateResult
        } catch (e: Exception) {
            false
        }
    }
    
    fun isFeatureEnabled(feature: String): Boolean {
        return remoteConfig.getBoolean(feature)
    }
    
    fun getStringConfig(key: String): String {
        return remoteConfig.getString(key)
    }
    
    fun getIntConfig(key: String): Int {
        return remoteConfig.getLong(key).toInt()
    }
    
    fun getJsonConfig(key: String): JSONObject? {
        return try {
            JSONObject(remoteConfig.getString(key))
        } catch (e: Exception) {
            null
        }
    }
    
    private fun getDefaultThemeConfig(): String {
        return """
        {
            "primaryColor": "#2196F3",
            "secondaryColor": "#FF9800",
            "isDarkMode": false,
            "fontSize": "medium"
        }
        """.trimIndent()
    }
    
    private fun getDefaultExperimentConfig(): String {
        return """
        {
            "experiments": {
                "new_checkout_flow": {
                    "enabled": false,
                    "variant": "control"
                },
                "personalized_recommendations": {
                    "enabled": true,
                    "algorithm": "collaborative_filtering"
                }
            }
        }
        """.trimIndent()
    }
}

// Feature Flag Manager
class FeatureFlagManager(private val remoteConfigManager: RemoteConfigManager) {
    
    fun isNewUIEnabled(): Boolean {
        return remoteConfigManager.isFeatureEnabled(RemoteConfigManager.FEATURE_NEW_UI_ENABLED)
    }
    
    fun isMaintenanceMode(): Boolean {
        return remoteConfigManager.isFeatureEnabled(RemoteConfigManager.MAINTENANCE_MODE)
    }
    
    fun getApiBaseUrl(): String {
        return remoteConfigManager.getStringConfig(RemoteConfigManager.API_BASE_URL)
    }
    
    fun getMaxRetryAttempts(): Int {
        return remoteConfigManager.getIntConfig(RemoteConfigManager.MAX_RETRY_ATTEMPTS)
    }
    
    fun getThemeConfig(): ThemeConfig? {
        val jsonConfig = remoteConfigManager.getJsonConfig(RemoteConfigManager.THEME_CONFIG)
        return jsonConfig?.let { parseThemeConfig(it) }
    }
    
    private fun parseThemeConfig(json: JSONObject): ThemeConfig {
        return ThemeConfig(
            primaryColor = json.getString("primaryColor"),
            secondaryColor = json.getString("secondaryColor"),
            isDarkMode = json.getBoolean("isDarkMode"),
            fontSize = json.getString("fontSize")
        )
    }
}

// Data classes
data class ThemeConfig(
    val primaryColor: String,
    val secondaryColor: String,
    val isDarkMode: Boolean,
    val fontSize: String
)

// Usage in Application
class MyApplication : Application() {
    lateinit var remoteConfigManager: RemoteConfigManager
    lateinit var featureFlagManager: FeatureFlagManager
    
    override fun onCreate() {
        super.onCreate()
        
        remoteConfigManager = RemoteConfigManager(this)
        featureFlagManager = FeatureFlagManager(remoteConfigManager)
        
        // Fetch config on app start
        lifecycleScope.launch {
            remoteConfigManager.fetchAndActivate()
        }
    }
}
```

### iOS Implementation

```swift
// RemoteConfigManager.swift
import FirebaseRemoteConfig
import Foundation

class RemoteConfigManager: ObservableObject {
    static let shared = RemoteConfigManager()
    
    private let remoteConfig = RemoteConfig.remoteConfig()
    private let cacheExpiration: TimeInterval = 3600 // 1 hour
    
    // Configuration keys
    struct ConfigKeys {
        static let featureNewUIEnabled = "feature_new_ui_enabled"
        static let apiBaseURL = "api_base_url"
        static let maxRetryAttempts = "max_retry_attempts"
        static let maintenanceMode = "maintenance_mode"
        static let themeConfig = "theme_config"
        static let experimentConfig = "experiment_config"
    }
    
    private init() {
        setupRemoteConfig()
    }
    
    private func setupRemoteConfig() {
        let settings = RemoteConfigSettings()
        settings.minimumFetchInterval = cacheExpiration
        remoteConfig.configSettings = settings
        
        // Set default values
        let defaults: [String: NSObject] = [
            ConfigKeys.featureNewUIEnabled: false as NSObject,
            ConfigKeys.apiBaseURL: "https://api.production.com" as NSObject,
            ConfigKeys.maxRetryAttempts: 3 as NSObject,
            ConfigKeys.maintenanceMode: false as NSObject,
            ConfigKeys.themeConfig: getDefaultThemeConfig() as NSObject,
            ConfigKeys.experimentConfig: getDefaultExperimentConfig() as NSObject
        ]
        
        remoteConfig.setDefaults(defaults)
    }
    
    func fetchAndActivate() async -> Bool {
        do {
            let status = try await remoteConfig.fetch(withExpirationDuration: cacheExpiration)
            let activated = try await remoteConfig.activate()
            return activated
        } catch {
            print("Error fetching remote config: \(error)")
            return false
        }
    }
    
    func isFeatureEnabled(_ feature: String) -> Bool {
        return remoteConfig.configValue(forKey: feature).boolValue
    }
    
    func getStringConfig(_ key: String) -> String {
        return remoteConfig.configValue(forKey: key).stringValue ?? ""
    }
    
    func getIntConfig(_ key: String) -> Int {
        return remoteConfig.configValue(forKey: key).numberValue.intValue
    }
    
    func getJsonConfig(_ key: String) -> [String: Any]? {
        guard let jsonString = remoteConfig.configValue(forKey: key).stringValue,
              let data = jsonString.data(using: .utf8) else {
            return nil
        }
        
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
    
    private func getDefaultThemeConfig() -> String {
        return """
        {
            "primaryColor": "#2196F3",
            "secondaryColor": "#FF9800",
            "isDarkMode": false,
            "fontSize": "medium"
        }
        """
    }
    
    private func getDefaultExperimentConfig() -> String {
        return """
        {
            "experiments": {
                "new_checkout_flow": {
                    "enabled": false,
                    "variant": "control"
                },
                "personalized_recommendations": {
                    "enabled": true,
                    "algorithm": "collaborative_filtering"
                }
            }
        }
        """
    }
}

// Feature Flag Manager
class FeatureFlagManager: ObservableObject {
    private let remoteConfigManager = RemoteConfigManager.shared
    
    @Published var isNewUIEnabled = false
    @Published var isMaintenanceMode = false
    @Published var themeConfig: ThemeConfig?
    
    init() {
        updateFlags()
    }
    
    func updateFlags() {
        isNewUIEnabled = remoteConfigManager.isFeatureEnabled(RemoteConfigManager.ConfigKeys.featureNewUIEnabled)
        isMaintenanceMode = remoteConfigManager.isFeatureEnabled(RemoteConfigManager.ConfigKeys.maintenanceMode)
        themeConfig = getThemeConfig()
    }
    
    func getApiBaseURL() -> String {
        return remoteConfigManager.getStringConfig(RemoteConfigManager.ConfigKeys.apiBaseURL)
    }
    
    func getMaxRetryAttempts() -> Int {
        return remoteConfigManager.getIntConfig(RemoteConfigManager.ConfigKeys.maxRetryAttempts)
    }
    
    private func getThemeConfig() -> ThemeConfig? {
        guard let config = remoteConfigManager.getJsonConfig(RemoteConfigManager.ConfigKeys.themeConfig) else {
            return nil
        }
        
        return ThemeConfig(
            primaryColor: config["primaryColor"] as? String ?? "#2196F3",
            secondaryColor: config["secondaryColor"] as? String ?? "#FF9800",
            isDarkMode: config["isDarkMode"] as? Bool ?? false,
            fontSize: config["fontSize"] as? String ?? "medium"
        )
    }
}

// Data structures
struct ThemeConfig {
    let primaryColor: String
    let secondaryColor: String
    let isDarkMode: Bool
    let fontSize: String
}

// Usage in SwiftUI App
@main
struct MyApp: App {
    @StateObject private var featureFlagManager = FeatureFlagManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(featureFlagManager)
                .task {
                    await RemoteConfigManager.shared.fetchAndActivate()
                    featureFlagManager.updateFlags()
                }
        }
    }
}
```

### React Native Implementation

```javascript
// RemoteConfigManager.js
import remoteConfig from '@react-native-firebase/remote-config';

class RemoteConfigManager {
  static instance = null;
  
  constructor() {
    if (!RemoteConfigManager.instance) {
      this.setupRemoteConfig();
      RemoteConfigManager.instance = this;
    }
    return RemoteConfigManager.instance;
  }

  async setupRemoteConfig() {
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: 3600000, // 1 hour
    });

    await remoteConfig().setDefaults({
      feature_new_ui_enabled: false,
      api_base_url: 'https://api.production.com',
      max_retry_attempts: 3,
      maintenance_mode: false,
      theme_config: JSON.stringify({
        primaryColor: '#2196F3',
        secondaryColor: '#FF9800',
        isDarkMode: false,
        fontSize: 'medium',
      }),
      experiment_config: JSON.stringify({
        experiments: {
          new_checkout_flow: {
            enabled: false,
            variant: 'control',
          },
          personalized_recommendations: {
            enabled: true,
            algorithm: 'collaborative_filtering',
          },
        },
      }),
    });
  }

  async fetchAndActivate() {
    try {
      const fetchResult = await remoteConfig().fetch();
      const activated = await remoteConfig().activate();
      return activated;
    } catch (error) {
      console.error('Error fetching remote config:', error);
      return false;
    }
  }

  isFeatureEnabled(feature) {
    return remoteConfig().getValue(feature).asBoolean();
  }

  getStringConfig(key) {
    return remoteConfig().getValue(key).asString();
  }

  getNumberConfig(key) {
    return remoteConfig().getValue(key).asNumber();
  }

  getJsonConfig(key) {
    try {
      const jsonString = remoteConfig().getValue(key).asString();
      return JSON.parse(jsonString);
    } catch (error) {
      return null;
    }
  }
}

// Feature Flag Hook
import { useState, useEffect } from 'react';

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState({
    isNewUIEnabled: false,
    isMaintenanceMode: false,
    apiBaseUrl: 'https://api.production.com',
    maxRetryAttempts: 3,
    themeConfig: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const remoteConfigManager = new RemoteConfigManager();

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setIsLoading(true);
    
    try {
      await remoteConfigManager.fetchAndActivate();
      
      setFlags({
        isNewUIEnabled: remoteConfigManager.isFeatureEnabled('feature_new_ui_enabled'),
        isMaintenanceMode: remoteConfigManager.isFeatureEnabled('maintenance_mode'),
        apiBaseUrl: remoteConfigManager.getStringConfig('api_base_url'),
        maxRetryAttempts: remoteConfigManager.getNumberConfig('max_retry_attempts'),
        themeConfig: remoteConfigManager.getJsonConfig('theme_config'),
      });
    } catch (error) {
      console.error('Error fetching feature flags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { flags, isLoading, refetch: fetchFlags };
};

// Usage in React Native Component
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useFeatureFlags } from './hooks/useFeatureFlags';

const HomeScreen = () => {
  const { flags, isLoading, refetch } = useFeatureFlags();

  if (isLoading) {
    return (
      <View>
        <Text>Loading configuration...</Text>
      </View>
    );
  }

  if (flags.isMaintenanceMode) {
    return (
      <View>
        <Text>App is under maintenance. Please try again later.</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: flags.themeConfig?.primaryColor }}>
      <Text>Home Screen</Text>
      {flags.isNewUIEnabled && (
        <Text>New UI is enabled!</Text>
      )}
      <Button title="Refresh Config" onPress={refetch} />
    </View>
  );
};

export default HomeScreen;
```

### Flutter Implementation

```dart
// remote_config_manager.dart
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'dart:convert';

class RemoteConfigManager {
  static final RemoteConfigManager _instance = RemoteConfigManager._internal();
  factory RemoteConfigManager() => _instance;
  RemoteConfigManager._internal();

  final FirebaseRemoteConfig _remoteConfig = FirebaseRemoteConfig.instance;
  static const int _cacheExpiration = 3600; // 1 hour

  // Configuration keys
  static const String featureNewUIEnabled = 'feature_new_ui_enabled';
  static const String apiBaseURL = 'api_base_url';
  static const String maxRetryAttempts = 'max_retry_attempts';
  static const String maintenanceMode = 'maintenance_mode';
  static const String themeConfig = 'theme_config';
  static const String experimentConfig = 'experiment_config';

  Future<void> initialize() async {
    await _remoteConfig.setConfigSettings(RemoteConfigSettings(
      fetchTimeout: const Duration(seconds: 10),
      minimumFetchInterval: const Duration(seconds: _cacheExpiration),
    ));

    await _remoteConfig.setDefaults({
      featureNewUIEnabled: false,
      apiBaseURL: 'https://api.production.com',
      maxRetryAttempts: 3,
      maintenanceMode: false,
      themeConfig: _getDefaultThemeConfig(),
      experimentConfig: _getDefaultExperimentConfig(),
    });
  }

  Future<bool> fetchAndActivate() async {
    try {
      await _remoteConfig.fetch();
      return await _remoteConfig.activate();
    } catch (e) {
      print('Error fetching remote config: $e');
      return false;
    }
  }

  bool isFeatureEnabled(String feature) {
    return _remoteConfig.getBool(feature);
  }

  String getStringConfig(String key) {
    return _remoteConfig.getString(key);
  }

  int getIntConfig(String key) {
    return _remoteConfig.getInt(key);
  }

  Map<String, dynamic>? getJsonConfig(String key) {
    try {
      final jsonString = _remoteConfig.getString(key);
      return json.decode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      return null;
    }
  }

  String _getDefaultThemeConfig() {
    return json.encode({
      'primaryColor': '#2196F3',
      'secondaryColor': '#FF9800',
      'isDarkMode': false,
      'fontSize': 'medium',
    });
  }

  String _getDefaultExperimentConfig() {
    return json.encode({
      'experiments': {
        'new_checkout_flow': {
          'enabled': false,
          'variant': 'control',
        },
        'personalized_recommendations': {
          'enabled': true,
          'algorithm': 'collaborative_filtering',
        },
      },
    });
  }
}

// feature_flag_provider.dart
import 'package:flutter/foundation.dart';
import 'remote_config_manager.dart';

class FeatureFlagProvider extends ChangeNotifier {
  final RemoteConfigManager _remoteConfigManager = RemoteConfigManager();
  
  bool _isNewUIEnabled = false;
  bool _isMaintenanceMode = false;
  String _apiBaseUrl = 'https://api.production.com';
  int _maxRetryAttempts = 3;
  ThemeConfig? _themeConfig;
  bool _isLoading = true;

  // Getters
  bool get isNewUIEnabled => _isNewUIEnabled;
  bool get isMaintenanceMode => _isMaintenanceMode;
  String get apiBaseUrl => _apiBaseUrl;
  int get maxRetryAttempts => _maxRetryAttempts;
  ThemeConfig? get themeConfig => _themeConfig;
  bool get isLoading => _isLoading;

  Future<void> initialize() async {
    await _remoteConfigManager.initialize();
    await fetchFlags();
  }

  Future<void> fetchFlags() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _remoteConfigManager.fetchAndActivate();
      _updateFlags();
    } catch (e) {
      print('Error fetching feature flags: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _updateFlags() {
    _isNewUIEnabled = _remoteConfigManager.isFeatureEnabled(RemoteConfigManager.featureNewUIEnabled);
    _isMaintenanceMode = _remoteConfigManager.isFeatureEnabled(RemoteConfigManager.maintenanceMode);
    _apiBaseUrl = _remoteConfigManager.getStringConfig(RemoteConfigManager.apiBaseURL);
    _maxRetryAttempts = _remoteConfigManager.getIntConfig(RemoteConfigManager.maxRetryAttempts);
    
    final themeConfigMap = _remoteConfigManager.getJsonConfig(RemoteConfigManager.themeConfig);
    if (themeConfigMap != null) {
      _themeConfig = ThemeConfig.fromMap(themeConfigMap);
    }
  }
}

// theme_config.dart
class ThemeConfig {
  final String primaryColor;
  final String secondaryColor;
  final bool isDarkMode;
  final String fontSize;

  ThemeConfig({
    required this.primaryColor,
    required this.secondaryColor,
    required this.isDarkMode,
    required this.fontSize,
  });

  factory ThemeConfig.fromMap(Map<String, dynamic> map) {
    return ThemeConfig(
      primaryColor: map['primaryColor'] ?? '#2196F3',
      secondaryColor: map['secondaryColor'] ?? '#FF9800',
      isDarkMode: map['isDarkMode'] ?? false,
      fontSize: map['fontSize'] ?? 'medium',
    );
  }
}

// Usage in Flutter App
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'feature_flag_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  final featureFlagProvider = FeatureFlagProvider();
  await featureFlagProvider.initialize();
  
  runApp(
    ChangeNotifierProvider.value(
      value: featureFlagProvider,
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<FeatureFlagProvider>(
      builder: (context, flags, child) {
        if (flags.isLoading) {
          return MaterialApp(
            home: Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        if (flags.isMaintenanceMode) {
          return MaterialApp(
            home: Scaffold(
              body: Center(
                child: Text('App is under maintenance. Please try again later.'),
              ),
            ),
          );
        }

        return MaterialApp(
          theme: ThemeData(
            primarySwatch: Colors.blue,
            brightness: flags.themeConfig?.isDarkMode == true 
                ? Brightness.dark 
                : Brightness.light,
          ),
          home: HomeScreen(),
        );
      },
    );
  }
}
```

## Custom Remote Configuration Service

### Node.js Backend Service

```javascript
// config-service.js
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');

// Configuration Schema
const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  type: { type: String, enum: ['boolean', 'string', 'number', 'json'], required: true },
  description: String,
  targetingRules: [{
    condition: String,
    value: mongoose.Schema.Types.Mixed,
    priority: Number,
  }],
  rolloutPercentage: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Config = mongoose.model('Config', configSchema);

class ConfigService {
  constructor() {
    this.app = express();
    this.redisClient = redis.createClient();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      req.clientInfo = {
        userId: req.headers['x-user-id'],
        appVersion: req.headers['x-app-version'],
        platform: req.headers['x-platform'],
        country: req.headers['x-country'],
        deviceType: req.headers['x-device-type'],
      };
      next();
    });
  }

  setupRoutes() {
    this.app.get('/config', this.getConfiguration.bind(this));
    this.app.post('/config', this.updateConfiguration.bind(this));
    this.app.get('/config/:key', this.getConfigValue.bind(this));
    this.app.put('/config/:key', this.updateConfigValue.bind(this));
    this.app.delete('/config/:key', this.deleteConfigValue.bind(this));
  }

  async getConfiguration(req, res) {
    try {
      const configs = await Config.find({ isActive: true });
      const clientConfig = {};

      for (const config of configs) {
        const value = await this.evaluateConfig(config, req.clientInfo);
        clientConfig[config.key] = value;
      }

      // Cache the result
      await this.redisClient.setex(
        `config:${this.getClientHash(req.clientInfo)}`,
        300, // 5 minutes
        JSON.stringify(clientConfig)
      );

      res.json(clientConfig);
    } catch (error) {
      console.error('Error getting configuration:', error);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  }

  async evaluateConfig(config, clientInfo) {
    // Check targeting rules
    for (const rule of config.targetingRules.sort((a, b) => b.priority - a.priority)) {
      if (this.evaluateCondition(rule.condition, clientInfo)) {
        return rule.value;
      }
    }

    // Check rollout percentage
    if (config.rolloutPercentage < 100) {
      const hash = this.getClientHash(clientInfo);
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const percentage = (hashValue % 100) + 1;
      
      if (percentage > config.rolloutPercentage) {
        return this.getDefaultValue(config.type);
      }
    }

    return config.value;
  }

  evaluateCondition(condition, clientInfo) {
    try {
      // Simple condition evaluation - in production, use a proper expression evaluator
      const func = new Function('client', `return ${condition}`);
      return func(clientInfo);
    } catch (error) {
      return false;
    }
  }

  getClientHash(clientInfo) {
    const crypto = require('crypto');
    const str = JSON.stringify(clientInfo);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  getDefaultValue(type) {
    const defaults = {
      boolean: false,
      string: '',
      number: 0,
      json: {},
    };
    return defaults[type];
  }

  async updateConfiguration(req, res) {
    try {
      const { key, value, type, description, targetingRules, rolloutPercentage } = req.body;

      const config = await Config.findOneAndUpdate(
        { key },
        {
          value,
          type,
          description,
          targetingRules: targetingRules || [],
          rolloutPercentage: rolloutPercentage || 100,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Invalidate cache
      await this.invalidateCache();

      res.json(config);
    } catch (error) {
      console.error('Error updating configuration:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  async invalidateCache() {
    const keys = await this.redisClient.keys('config:*');
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }
}

module.exports = ConfigService;
```

## Configuration Management Dashboard

### React Admin Dashboard

```jsx
// ConfigurationDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Switch, 
  InputNumber,
  Space,
  Tag,
  Popconfirm
} from 'antd';

const ConfigurationDashboard = () => {
  const [configs, setConfigs] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const response = await fetch('/api/admin/configs');
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const handleSave = async (values) => {
    try {
      const url = editingConfig 
        ? `/api/admin/configs/${editingConfig.key}`
        : '/api/admin/configs';
      
      const method = editingConfig ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      fetchConfigurations();
      setIsModalVisible(false);
      setEditingConfig(null);
      form.resetFields();
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  const handleDelete = async (key) => {
    try {
      await fetch(`/api/admin/configs/${key}`, { method: 'DELETE' });
      fetchConfigurations();
    } catch (error) {
      console.error('Error deleting configuration:', error);
    }
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value, record) => {
        if (record.type === 'json') {
          return <pre>{JSON.stringify(value, null, 2)}</pre>;
        }
        return String(value);
      },
    },
    {
      title: 'Rollout %',
      dataIndex: 'rolloutPercentage',
      key: 'rolloutPercentage',
      render: (percentage) => `${percentage}%`,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small"
            onClick={() => {
              setEditingConfig(record);
              form.setFieldsValue(record);
              setIsModalVisible(true);
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this configuration?"
            onConfirm={() => handleDelete(record.key)}
          >
            <Button type="primary" danger size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          onClick={() => {
            setEditingConfig(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
        >
          Add Configuration
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={configs} 
        rowKey="key"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingConfig ? 'Edit Configuration' : 'Add Configuration'}
        visible={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingConfig(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Key"
            name="key"
            rules={[{ required: true, message: 'Please input the configuration key!' }]}
          >
            <Input disabled={!!editingConfig} />
          </Form.Item>

          <Form.Item
            label="Type"
            name="type"
            rules={[{ required: true, message: 'Please select the type!' }]}
          >
            <Select>
              <Select.Option value="boolean">Boolean</Select.Option>
              <Select.Option value="string">String</Select.Option>
              <Select.Option value="number">Number</Select.Option>
              <Select.Option value="json">JSON</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Value"
            name="value"
            rules={[{ required: true, message: 'Please input the value!' }]}
          >
            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
              {({ getFieldValue }) => {
                const type = getFieldValue('type');
                switch (type) {
                  case 'boolean':
                    return <Switch />;
                  case 'number':
                    return <InputNumber />;
                  case 'json':
                    return <Input.TextArea rows={4} />;
                  default:
                    return <Input />;
                }
              }}
            </Form.Item>
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            label="Rollout Percentage"
            name="rolloutPercentage"
            initialValue={100}
          >
            <InputNumber min={0} max={100} />
          </Form.Item>

          <Form.Item
            label="Active"
            name="isActive"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Save
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConfigurationDashboard;
```

## Best Practices

### 1. Configuration Design
- Use clear, descriptive key names
- Group related configurations
- Set appropriate default values
- Document configuration purposes

### 2. Performance Optimization
- Implement client-side caching
- Use CDN for configuration delivery
- Minimize configuration size
- Batch configuration requests

### 3. Security Considerations
- Validate configuration values
- Encrypt sensitive configurations
- Implement access controls
- Audit configuration changes

### 4. Testing and Rollout
- Test configurations in staging
- Use gradual rollout percentages
- Monitor application metrics
- Implement rollback mechanisms

### 5. Monitoring and Analytics
- Track configuration usage
- Monitor performance impact
- Alert on configuration failures
- Analyze user behavior changes

This comprehensive remote configuration system provides flexible, scalable configuration management with advanced targeting, rollout controls, and monitoring capabilities across all mobile platforms.
