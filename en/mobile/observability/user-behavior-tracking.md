# User Behavior Tracking

## Overview

User behavior tracking is essential for understanding how users interact with your mobile application. This documentation covers comprehensive tracking strategies, analytics implementation, and privacy-compliant data collection across Android, iOS, React Native, and Flutter platforms.

## Analytics Platforms

### Firebase Analytics

#### Android Implementation

```kotlin
// FirebaseAnalyticsManager.kt
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.analytics.ktx.logEvent
import com.google.firebase.ktx.Firebase
import android.content.Context
import android.os.Bundle

class FirebaseAnalyticsManager(private val context: Context) {
    private val firebaseAnalytics = Firebase.analytics
    
    fun trackScreenView(screenName: String, screenClass: String) {
        firebaseAnalytics.logEvent(FirebaseAnalytics.Event.SCREEN_VIEW) {
            param(FirebaseAnalytics.Param.SCREEN_NAME, screenName)
            param(FirebaseAnalytics.Param.SCREEN_CLASS, screenClass)
        }
    }
    
    fun trackUserAction(action: String, category: String, label: String? = null) {
        firebaseAnalytics.logEvent("user_action") {
            param("action_name", action)
            param("action_category", category)
            label?.let { param("action_label", it) }
            param("timestamp", System.currentTimeMillis())
        }
    }
    
    fun trackPurchase(itemId: String, itemName: String, price: Double, currency: String) {
        firebaseAnalytics.logEvent(FirebaseAnalytics.Event.PURCHASE) {
            param(FirebaseAnalytics.Param.ITEM_ID, itemId)
            param(FirebaseAnalytics.Param.ITEM_NAME, itemName)
            param(FirebaseAnalytics.Param.VALUE, price)
            param(FirebaseAnalytics.Param.CURRENCY, currency)
        }
    }
    
    fun setUserProperties(userId: String, userType: String, subscriptionLevel: String) {
        firebaseAnalytics.setUserId(userId)
        firebaseAnalytics.setUserProperty("user_type", userType)
        firebaseAnalytics.setUserProperty("subscription_level", subscriptionLevel)
    }
    
    fun trackCustomEvent(eventName: String, parameters: Map<String, Any>) {
        firebaseAnalytics.logEvent(eventName) {
            parameters.forEach { (key, value) ->
                when (value) {
                    is String -> param(key, value)
                    is Long -> param(key, value)
                    is Double -> param(key, value)
                    is Bundle -> param(key, value)
                }
            }
        }
    }
}

// Usage in Activity
class MainActivity : AppCompatActivity() {
    private lateinit var analyticsManager: FirebaseAnalyticsManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        analyticsManager = FirebaseAnalyticsManager(this)
        analyticsManager.trackScreenView("Main Screen", "MainActivity")
        
        setupButtonListeners()
    }
    
    private fun setupButtonListeners() {
        findViewById<Button>(R.id.button_search).setOnClickListener {
            analyticsManager.trackUserAction("button_click", "navigation", "search_button")
        }
        
        findViewById<Button>(R.id.button_purchase).setOnClickListener {
            analyticsManager.trackPurchase("item_123", "Premium Subscription", 9.99, "USD")
        }
    }
}
```

#### iOS Implementation

```swift
// FirebaseAnalyticsManager.swift
import FirebaseAnalytics
import Foundation

class FirebaseAnalyticsManager {
    static let shared = FirebaseAnalyticsManager()
    
    private init() {}
    
    func trackScreenView(screenName: String, screenClass: String) {
        Analytics.logEvent(AnalyticsEventScreenView, parameters: [
            AnalyticsParameterScreenName: screenName,
            AnalyticsParameterScreenClass: screenClass
        ])
    }
    
    func trackUserAction(action: String, category: String, label: String? = nil) {
        var parameters: [String: Any] = [
            "action_name": action,
            "action_category": category,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        if let label = label {
            parameters["action_label"] = label
        }
        
        Analytics.logEvent("user_action", parameters: parameters)
    }
    
    func trackPurchase(itemId: String, itemName: String, price: Double, currency: String) {
        Analytics.logEvent(AnalyticsEventPurchase, parameters: [
            AnalyticsParameterItemID: itemId,
            AnalyticsParameterItemName: itemName,
            AnalyticsParameterValue: price,
            AnalyticsParameterCurrency: currency
        ])
    }
    
    func setUserProperties(userId: String, userType: String, subscriptionLevel: String) {
        Analytics.setUserID(userId)
        Analytics.setUserProperty(userType, forName: "user_type")
        Analytics.setUserProperty(subscriptionLevel, forName: "subscription_level")
    }
    
    func trackCustomEvent(eventName: String, parameters: [String: Any]) {
        Analytics.logEvent(eventName, parameters: parameters)
    }
}

// Usage in ViewController
class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        FirebaseAnalyticsManager.shared.trackScreenView(
            screenName: "Main Screen",
            screenClass: String(describing: type(of: self))
        )
        
        setupButtonActions()
    }
    
    private func setupButtonActions() {
        searchButton.addTarget(self, action: #selector(searchButtonTapped), for: .touchUpInside)
        purchaseButton.addTarget(self, action: #selector(purchaseButtonTapped), for: .touchUpInside)
    }
    
    @objc private func searchButtonTapped() {
        FirebaseAnalyticsManager.shared.trackUserAction(
            action: "button_click",
            category: "navigation",
            label: "search_button"
        )
    }
    
    @objc private func purchaseButtonTapped() {
        FirebaseAnalyticsManager.shared.trackPurchase(
            itemId: "item_123",
            itemName: "Premium Subscription",
            price: 9.99,
            currency: "USD"
        )
    }
}
```

### React Native Implementation

```javascript
// AnalyticsManager.js
import analytics from '@react-native-firebase/analytics';

class AnalyticsManager {
  static async trackScreenView(screenName, screenClass) {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass,
    });
  }

  static async trackUserAction(action, category, label = null) {
    const parameters = {
      action_name: action,
      action_category: category,
      timestamp: Date.now(),
    };

    if (label) {
      parameters.action_label = label;
    }

    await analytics().logEvent('user_action', parameters);
  }

  static async trackPurchase(itemId, itemName, price, currency) {
    await analytics().logPurchase({
      currency: currency,
      value: price,
      items: [{
        item_id: itemId,
        item_name: itemName,
        price: price,
      }],
    });
  }

  static async setUserProperties(userId, userType, subscriptionLevel) {
    await analytics().setUserId(userId);
    await analytics().setUserProperty('user_type', userType);
    await analytics().setUserProperty('subscription_level', subscriptionLevel);
  }

  static async trackCustomEvent(eventName, parameters) {
    await analytics().logEvent(eventName, parameters);
  }
}

// Usage in React Native Component
import React, { useEffect } from 'react';
import { View, Button, Text } from 'react-native';
import AnalyticsManager from './AnalyticsManager';

const MainScreen = () => {
  useEffect(() => {
    AnalyticsManager.trackScreenView('Main Screen', 'MainScreen');
  }, []);

  const handleSearchPress = () => {
    AnalyticsManager.trackUserAction('button_click', 'navigation', 'search_button');
  };

  const handlePurchasePress = () => {
    AnalyticsManager.trackPurchase('item_123', 'Premium Subscription', 9.99, 'USD');
  };

  return (
    <View>
      <Text>Main Screen</Text>
      <Button title="Search" onPress={handleSearchPress} />
      <Button title="Purchase" onPress={handlePurchasePress} />
    </View>
  );
};

export default MainScreen;
```

### Flutter Implementation

```dart
// analytics_manager.dart
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsManager {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  
  static Future<void> trackScreenView(String screenName, String screenClass) async {
    await _analytics.logScreenView(
      screenName: screenName,
      screenClass: screenClass,
    );
  }
  
  static Future<void> trackUserAction(String action, String category, [String? label]) async {
    final parameters = <String, dynamic>{
      'action_name': action,
      'action_category': category,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    
    if (label != null) {
      parameters['action_label'] = label;
    }
    
    await _analytics.logEvent(
      name: 'user_action',
      parameters: parameters,
    );
  }
  
  static Future<void> trackPurchase(String itemId, String itemName, double price, String currency) async {
    await _analytics.logPurchase(
      currency: currency,
      value: price,
      parameters: {
        'item_id': itemId,
        'item_name': itemName,
      },
    );
  }
  
  static Future<void> setUserProperties(String userId, String userType, String subscriptionLevel) async {
    await _analytics.setUserId(id: userId);
    await _analytics.setUserProperty(name: 'user_type', value: userType);
    await _analytics.setUserProperty(name: 'subscription_level', value: subscriptionLevel);
  }
  
  static Future<void> trackCustomEvent(String eventName, Map<String, dynamic> parameters) async {
    await _analytics.logEvent(
      name: eventName,
      parameters: parameters,
    );
  }
}

// Usage in Flutter Widget
import 'package:flutter/material.dart';
import 'analytics_manager.dart';

class MainScreen extends StatefulWidget {
  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  @override
  void initState() {
    super.initState();
    AnalyticsManager.trackScreenView('Main Screen', 'MainScreen');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Main Screen')),
      body: Column(
        children: [
          ElevatedButton(
            onPressed: () {
              AnalyticsManager.trackUserAction('button_click', 'navigation', 'search_button');
            },
            child: Text('Search'),
          ),
          ElevatedButton(
            onPressed: () {
              AnalyticsManager.trackPurchase('item_123', 'Premium Subscription', 9.99, 'USD');
            },
            child: Text('Purchase'),
          ),
        ],
      ),
    );
  }
}
```

## Custom Analytics Backend

### Node.js Analytics Service

```javascript
// analytics-service.js
const express = require('express');
const mongodb = require('mongodb');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class AnalyticsService {
  constructor() {
    this.app = express();
    this.mongoClient = null;
    this.redisClient = redis.createClient();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      req.sessionId = req.headers['x-session-id'] || uuidv4();
      req.userId = req.headers['x-user-id'];
      req.timestamp = new Date();
      next();
    });
  }

  setupRoutes() {
    this.app.post('/track/event', this.trackEvent.bind(this));
    this.app.post('/track/screen', this.trackScreenView.bind(this));
    this.app.post('/track/user-properties', this.setUserProperties.bind(this));
    this.app.get('/analytics/funnel/:funnelId', this.getFunnelAnalytics.bind(this));
    this.app.get('/analytics/retention/:period', this.getRetentionAnalytics.bind(this));
  }

  async trackEvent(req, res) {
    try {
      const { eventName, properties, category } = req.body;
      
      const eventData = {
        eventId: uuidv4(),
        sessionId: req.sessionId,
        userId: req.userId,
        eventName,
        properties,
        category,
        timestamp: req.timestamp,
        deviceInfo: req.headers['x-device-info'],
        appVersion: req.headers['x-app-version'],
      };

      // Store in MongoDB
      await this.getDatabase().collection('events').insertOne(eventData);
      
      // Cache hot data in Redis
      await this.redisClient.zadd(
        `user:${req.userId}:events`,
        req.timestamp.getTime(),
        JSON.stringify(eventData)
      );

      // Real-time processing
      await this.processRealTimeAnalytics(eventData);

      res.json({ success: true, eventId: eventData.eventId });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  }

  async trackScreenView(req, res) {
    try {
      const { screenName, screenClass, previousScreen } = req.body;
      
      const screenData = {
        sessionId: req.sessionId,
        userId: req.userId,
        screenName,
        screenClass,
        previousScreen,
        timestamp: req.timestamp,
        deviceInfo: req.headers['x-device-info'],
      };

      await this.getDatabase().collection('screen_views').insertOne(screenData);
      
      // Update user journey
      await this.updateUserJourney(req.userId, screenName, req.timestamp);

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking screen view:', error);
      res.status(500).json({ error: 'Failed to track screen view' });
    }
  }

  async processRealTimeAnalytics(eventData) {
    // Update real-time counters
    const counterKey = `realtime:${eventData.eventName}:${new Date().toISOString().slice(0, 10)}`;
    await this.redisClient.incr(counterKey);
    await this.redisClient.expire(counterKey, 86400); // 24 hours

    // Trigger real-time alerts if needed
    if (eventData.eventName === 'error' || eventData.eventName === 'crash') {
      await this.triggerAlert(eventData);
    }
  }

  async getFunnelAnalytics(req, res) {
    try {
      const { funnelId } = req.params;
      const { startDate, endDate } = req.query;

      const funnel = await this.calculateFunnelConversion(funnelId, startDate, endDate);
      res.json(funnel);
    } catch (error) {
      console.error('Error getting funnel analytics:', error);
      res.status(500).json({ error: 'Failed to get funnel analytics' });
    }
  }

  async getRetentionAnalytics(req, res) {
    try {
      const { period } = req.params; // daily, weekly, monthly
      const { startDate, endDate } = req.query;

      const retention = await this.calculateRetentionCohorts(period, startDate, endDate);
      res.json(retention);
    } catch (error) {
      console.error('Error getting retention analytics:', error);
      res.status(500).json({ error: 'Failed to get retention analytics' });
    }
  }

  async calculateFunnelConversion(funnelId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
          'properties.funnelId': funnelId
        }
      },
      {
        $group: {
          _id: { userId: '$userId', step: '$properties.step' },
          timestamp: { $min: '$timestamp' }
        }
      },
      {
        $group: {
          _id: '$_id.step',
          users: { $addToSet: '$_id.userId' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await this.getDatabase().collection('events').aggregate(pipeline).toArray();
    return this.calculateConversionRates(results);
  }

  getDatabase() {
    // Implement MongoDB connection logic
    return this.mongoClient.db('analytics');
  }
}

module.exports = AnalyticsService;
```

## User Journey Tracking

### Session Management

```javascript
// session-manager.js
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  startSession(userId, deviceInfo) {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId,
      deviceInfo,
      startTime: new Date(),
      lastActivity: new Date(),
      events: [],
      screens: [],
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.scheduleSessionTimeout(sessionId);
    
    return sessionId;
  }

  updateSession(sessionId, eventData) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.events.push(eventData);
    
    // Restart timeout
    this.scheduleSessionTimeout(sessionId);
  }

  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    session.endTime = new Date();
    session.duration = session.endTime - session.startTime;

    // Persist session data
    this.persistSession(session);
    this.sessions.delete(sessionId);
  }

  scheduleSessionTimeout(sessionId) {
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && new Date() - session.lastActivity > this.sessionTimeout) {
        this.endSession(sessionId);
      }
    }, this.sessionTimeout);
  }

  async persistSession(session) {
    // Save session data to database
    await this.getDatabase().collection('sessions').insertOne(session);
  }
}
```

## Privacy and Compliance

### GDPR Compliance

```javascript
// privacy-manager.js
class PrivacyManager {
  constructor() {
    this.consentTypes = ['analytics', 'marketing', 'functional'];
    this.dataRetentionPeriod = 365 * 24 * 60 * 60 * 1000; // 1 year
  }

  async checkConsent(userId, consentType) {
    const consent = await this.getDatabase()
      .collection('user_consent')
      .findOne({ userId, consentType });
    
    return consent && consent.granted && !consent.revoked;
  }

  async grantConsent(userId, consentType, source = 'app') {
    await this.getDatabase().collection('user_consent').updateOne(
      { userId, consentType },
      {
        $set: {
          granted: true,
          grantedAt: new Date(),
          source,
          revoked: false,
        }
      },
      { upsert: true }
    );
  }

  async revokeConsent(userId, consentType) {
    await this.getDatabase().collection('user_consent').updateOne(
      { userId, consentType },
      {
        $set: {
          revoked: true,
          revokedAt: new Date(),
        }
      }
    );

    // Delete related data
    await this.deleteUserData(userId, consentType);
  }

  async deleteUserData(userId, consentType) {
    const collections = this.getCollectionsForConsentType(consentType);
    
    for (const collection of collections) {
      await this.getDatabase().collection(collection).deleteMany({ userId });
    }
  }

  getCollectionsForConsentType(consentType) {
    const mapping = {
      analytics: ['events', 'screen_views', 'sessions'],
      marketing: ['user_profiles', 'campaigns'],
      functional: ['preferences', 'settings'],
    };
    
    return mapping[consentType] || [];
  }
}
```

## Analytics Dashboard

### React Dashboard Component

```jsx
// AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    sessions: 0,
    events: 0,
    retention: [],
    topScreens: [],
    eventTimeline: [],
  });

  useEffect(() => {
    fetchAnalyticsData();
    
    const interval = setInterval(fetchAnalyticsData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch('/api/analytics/dashboard');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  return (
    <div className="analytics-dashboard">
      <div className="metrics-overview">
        <div className="metric-card">
          <h3>Active Users</h3>
          <p className="metric-value">{metrics.activeUsers.toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h3>Sessions</h3>
          <p className="metric-value">{metrics.sessions.toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h3>Events</h3>
          <p className="metric-value">{metrics.events.toLocaleString()}</p>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-section">
          <h3>Event Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.eventTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="events" stroke="#8884d8" />
              <Line type="monotone" dataKey="users" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Top Screens</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.topScreens}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="screen" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="views" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="retention-matrix">
        <h3>User Retention</h3>
        <table>
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Day 1</th>
              <th>Day 7</th>
              <th>Day 30</th>
            </tr>
          </thead>
          <tbody>
            {metrics.retention.map((cohort, index) => (
              <tr key={index}>
                <td>{cohort.date}</td>
                <td>{cohort.day1}%</td>
                <td>{cohort.day7}%</td>
                <td>{cohort.day30}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
```

## Best Practices

### 1. Event Design
- Use consistent naming conventions
- Include context and metadata
- Avoid PII in event properties
- Use structured event schemas

### 2. Performance Optimization
- Batch events for network efficiency
- Implement local caching
- Use background processing
- Minimize tracking overhead

### 3. Data Quality
- Validate event data
- Handle network failures gracefully
- Implement retry mechanisms
- Monitor data completeness

### 4. Privacy First
- Obtain explicit consent
- Implement data anonymization
- Provide data deletion options
- Regular compliance audits

### 5. Testing Strategy
- Unit test tracking code
- Validate event schemas
- Test privacy controls
- Monitor data accuracy

This comprehensive user behavior tracking system provides enterprise-grade analytics capabilities while maintaining user privacy and system performance across all mobile platforms.
