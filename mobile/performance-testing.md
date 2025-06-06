# Mobil Performans Karşılaştırma & Test Rehberi

## Genel Bakış

Bu kapsamlı rehber, mobil uygulamalar için performans karşılaştırma, test stratejileri ve izleme tekniklerini kapsar. Platforma özel araçlar, otomatik test framework'leri ve canlı izleme çözümleri içerir.

## Performans Metrikleri & Karşılaştırmalar

### Temel Performans Göstergeleri

```typescript
interface PerformanceMetrics {
  // Uygulama Yaşam Döngüsü
  coldStartTime: number;      // Hedef: < 2s
  warmStartTime: number;      // Hedef: < 1s
  hotStartTime: number;       // Hedef: < 0.5s
  // Çalışma Zamanı Performansı
  frameRate: number;          // Hedef: 60 FPS
  frameDrops: number;         // Hedef: < %5
  memoryUsage: number;        // Hedef: < 100MB
  cpuUsage: number;           // Hedef: < %20
  // Ağ Performansı
  apiResponseTime: number;    // Hedef: < 500ms
  networkErrors: number;      // Hedef: < %1
  dataUsage: number;          // Minimize edilmeli
  // Kullanıcı Deneyimi
  screenTransitionTime: number; // Hedef: < 300ms
  scrollPerformance: number;    // Hedef: 60 FPS
  inputLatency: number;         // Hedef: < 100ms
  batteryDrain: number;         // Minimize edilmeli
}
```

```typescript
class PerformanceBenchmark {
  private metrics: PerformanceMetrics[] = [];
  private thresholds = {
    coldStart: 2000,
    frameRate: 55,
    memoryUsage: 100 * 1024 * 1024, // 100MB
    apiResponse: 500,
  };
  async measurePerformance(): Promise<PerformanceReport> {
    const metrics = await this.collectMetrics();
    const analysis = this.analyzeMetrics(metrics);
    return {
      metrics,
      analysis,
      recommendations: this.generateRecommendations(analysis),
      grade: this.calculateGrade(analysis),
    };
  }
  private async collectMetrics(): Promise<PerformanceMetrics> {
    return {
      coldStartTime: await this.measureColdStart(),
      warmStartTime: await this.measureWarmStart(),
      hotStartTime: await this.measureHotStart(),
      frameRate: await this.measureFrameRate(),
      frameDrops: await this.measureFrameDrops(),
      memoryUsage: await this.measureMemoryUsage(),
      cpuUsage: await this.measureCPUUsage(),
      apiResponseTime: await this.measureAPIResponse(),
      networkErrors: await this.measureNetworkErrors(),
      dataUsage: await this.measureDataUsage(),
      screenTransitionTime: await this.measureScreenTransitions(),
      scrollPerformance: await this.measureScrollPerformance(),
      inputLatency: await this.measureInputLatency(),
      batteryDrain: await this.measureBatteryDrain(),
    };
  }
}
```

## Platforma Özel Test Araçları

### iOS Performans Testi

```swift
// iOS Performans Test Framework'ü
import XCTest
import MetricKit

class iOSPerformanceTests: XCTestCase {
    private let performanceMonitor = PerformanceMonitor()
    func testColdStartPerformance() {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
    func testScrollPerformance() {
        let app = XCUIApplication()
        app.launch()
        let scrollView = app.scrollViews.firstMatch
        measure(metrics: [XCTOSSignpostMetric.scrollingAndDecelerationMetric]) {
            scrollView.swipeUp(velocity: .fast)
        }
    }
    func testMemoryPerformance() {
        measure(metrics: [XCTMemoryMetric()]) {
            performMemoryIntensiveTask()
        }
    }
    func testCPUPerformance() {
        measure(metrics: [XCTCPUMetric()]) {
            performCPUIntensiveTask()
        }
    }
}

// MetricKit ile Canlı İzleme
class MetricKitManager: NSObject, MXMetricManagerSubscriber {
    override init() {
        super.init()
        MXMetricManager.shared.add(self)
    }
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            processMetricPayload(payload)
        }
    }
    private func processMetricPayload(_ payload: MXMetricPayload) {
        // CPU metriklerini işle
        if let cpuMetrics = payload.cpuMetrics {
            logCPUMetrics(cpuMetrics)
        }
        // Bellek metriklerini işle
        if let memoryMetrics = payload.memoryMetrics {
            logMemoryMetrics(memoryMetrics)
        }
        // Ekran metriklerini işle
        if let displayMetrics = payload.displayMetrics {
            logDisplayMetrics(displayMetrics)
        }
        // Uygulama başlatma metriklerini işle
        if let launchMetrics = payload.applicationLaunchMetrics {
            logLaunchMetrics(launchMetrics)
        }
    }
    private func logCPUMetrics(_ metrics: MXCPUMetrics) {
        let cpuUsage = metrics.cumulativeCPUTime.converted(to: .seconds).value
        Analytics.log("cpu_usage", value: cpuUsage)
    }
    private func logMemoryMetrics(_ metrics: MXMemoryMetrics) {
        let peakMemory = metrics.peakMemoryUsage.converted(to: .megabytes).value
        Analytics.log("peak_memory", value: peakMemory)
    }
}
```

### Android Performans Testi

```kotlin
// Android Performans Test Framework'ü
@RunWith(AndroidJUnit4::class)
@LargeTest
class AndroidPerformanceTests {
    @get:Rule
    val activityRule = ActivityTestRule(MainActivity::class.java)
    @Test
    fun testColdStartPerformance() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        val startTime = System.nanoTime()
        scenario.onActivity { activity ->
            val endTime = System.nanoTime()
            val launchTime = (endTime - startTime) / 1_000_000
            Assert.assertTrue("Cold start too slow: ${launchTime}ms", launchTime < 2000)
        }
    }
    @Test
    fun testScrollPerformance() {
        // JankStats ile scroll performansı ölç
        val jankStats = JankStats.createAndTrack(activityRule.activity.window) { frameData ->
            frameData.states.forEach { state ->
                when (state) {
                    is JankStats.JankStatsApi.JankState.Jank -> {
                        Log.w("Performance", "Jank detected: ${state.reason}")
                    }
                }
            }
        }
        // Scroll testi
        onView(withId(R.id.recycler_view))
            .perform(RecyclerViewActions.scroll(10))
    }
    @Test
    fun testMemoryUsage() {
        val runtime = Runtime.getRuntime()
        val initialMemory = runtime.totalMemory() - runtime.freeMemory()
        performMemoryIntensiveTask()
        val finalMemory = runtime.totalMemory() - runtime.freeMemory()
        val memoryIncrease = finalMemory - initialMemory
        Assert.assertTrue(
            "Memory usage too high: ${memoryIncrease / 1024 / 1024}MB",
            memoryIncrease < 50 * 1024 * 1024
        )
    }
}

// Sürekli Performans İzleme
class AndroidPerformanceMonitor {
    private val frameMetricsListener = FrameMetricsListener()
    fun startMonitoring(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            activity.window.addOnFrameMetricsAvailableListener(
                frameMetricsListener,
                Handler(Looper.getMainLooper())
            )
        }
        startMemoryMonitoring()
        startCPUMonitoring()
    }
    private inner class FrameMetricsListener : Window.OnFrameMetricsAvailableListener {
        override fun onFrameMetricsAvailable(
            window: Window,
            frameMetrics: FrameMetrics,
            dropCountSinceLastInvocation: Int
        ) {
            val totalDuration = frameMetrics.getMetric(FrameMetrics.TOTAL_DURATION)
            val layoutDuration = frameMetrics.getMetric(FrameMetrics.LAYOUT_MEASURE_DURATION)
            val drawDuration = frameMetrics.getMetric(FrameMetrics.DRAW_DURATION)
            Analytics.log("frame_metrics", mapOf(
                "total_duration" to totalDuration,
                "layout_duration" to layoutDuration,
                "draw_duration" to drawDuration,
                "dropped_frames" to dropCountSinceLastInvocation
            ))
            if (totalDuration > 16_000_000) {
                Log.w("Performance", "Slow frame detected: ${totalDuration / 1_000_000}ms")
            }
        }
    }
}
```

### React Native Performans Testi

```typescript
// React Native Performans Testleri
import { render, waitFor } from '@testing-library/react-native';
import { performance } from 'perf_hooks';

class ReactNativePerformanceTests {
  async testComponentRenderPerformance<T>(Component: React.ComponentType<T>, props: T): Promise<PerformanceResult> {
    const startTime = performance.now();
    const { rerender } = render(<Component {...props} />);
    const initialRenderTime = performance.now() - startTime;
    const rerenderStartTime = performance.now();
    rerender(<Component {...props} />);
    const rerenderTime = performance.now() - rerenderStartTime;
    return {
      initialRenderTime,
      rerenderTime,
      passed: initialRenderTime < 100 && rerenderTime < 50,
    };
  }
  async testListScrollPerformance(): Promise<PerformanceResult> {
    const frameDrops: number[] = [];
    const frameRateMonitor = setInterval(() => {
      const fps = this.getCurrentFPS();
      if (fps < 55) {
        frameDrops.push(fps);
      }
    }, 100);
    await this.simulateScroll();
    clearInterval(frameRateMonitor);
    return {
      frameDrops: frameDrops.length,
      averageFPS: this.calculateAverageFPS(),
      passed: frameDrops.length < 5,
    };
  }
  private getCurrentFPS(): number {
    return 60;
  }
}
```

### Flutter Performans Testi

```dart
// Flutter Performans Testleri
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

class FlutterPerformanceTests {
  void testScrollPerformance() {
    testWidgets('Scroll performance test', (WidgetTester tester) async {
      await tester.binding.traceAction(() async {
        await tester.pumpWidget(MyApp());
        final listFinder = find.byType(ListView);
        await tester.drag(listFinder, const Offset(0, -500));
        await tester.pumpAndSettle();
        await tester.drag(listFinder, const Offset(0, 500));
        await tester.pumpAndSettle();
      }, reportKey: 'scroll_performance_timeline', stream: Timeline.timeSync);
    });
  }
  void testWidgetBuildPerformance() {
    testWidgets('Widget build performance', (WidgetTester tester) async {
      final stopwatch = Stopwatch()..start();
      await tester.pumpWidget(ComplexWidget());
      stopwatch.stop();
      expect(stopwatch.elapsedMilliseconds, lessThan(100),
          reason: 'Widget build took too long: ${stopwatch.elapsedMilliseconds}ms');
    });
  }
  void testAnimationPerformance() {
    testWidgets('Animation performance test', (WidgetTester tester) async {
      await tester.binding.traceAction(() async {
        await tester.pumpWidget(AnimatedWidget());
        await tester.tap(find.byType(FloatingActionButton));
        await tester.pumpAndSettle(const Duration(seconds: 2));
      }, reportKey: 'animation_performance_timeline');
    });
  }
}
```

## Otomatik Performans Testleri

### CI/CD Pipeline'da Performans Testleri

```yaml
# GitHub Actions ile Performans Testleri
name: Mobile Performance Tests
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  ios-performance:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup iOS
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd ios
          pod install
      - name: Run iOS Performance Tests
        run: |
          xcodebuild test \
            -workspace ios/App.xcworkspace \
            -scheme App \
            -destination 'platform=iOS Simulator,name=iPhone 14' \
            -testPlan PerformanceTests \
            -resultBundlePath TestResults.xcresult
      - name: Analyze Performance
        run: |
          xcrun xcresulttool get --format json \
            --path TestResults.xcresult > performance-results.json
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: ios-performance-results
          path: performance-results.json
  android-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Android
        uses: android-actions/setup-android@v2
      - name: Run Android Performance Tests
        run: |
          ./gradlew :app:connectedAndroidTest \
            -Pandroid.testInstrumentationRunnerArguments.class=com.app.PerformanceTestSuite
      - name: Generate Performance Report
        run: |
          ./gradlew :app:generatePerformanceReport
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: android-performance-results
          path: app/build/reports/performance/
  performance-analysis:
    needs: [ios-performance, android-performance]
    runs-on: ubuntu-latest
    steps:
      - name: Download Results
        uses: actions/download-artifact@v3
      - name: Analyze Performance Trends
        run: |
          node scripts/analyze-performance.js
      - name: Comment PR with Results
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-summary.json'));
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Performance Test Results\n\n${results.summary}`
            });
```

## Canlı Performans İzleme

### Gerçek Zamanlı Performans Dashboard'u

```typescript
// Performans İzleme Servisi
class PerformanceMonitoringService {
  private analytics: AnalyticsService;
  private alerting: AlertingService;
  constructor() {
    this.analytics = new AnalyticsService();
    this.alerting = new AlertingService();
  }
  async setupRealTimeMonitoring(): Promise<void> {
    this.setupFrameRateMonitoring();
    this.setupMemoryMonitoring();
    this.setupNetworkMonitoring();
    this.setupCrashReporting();
    this.setupPerformanceAlerts();
  }
  private setupFrameRateMonitoring(): void {
    const frameRateMonitor = new FrameRateMonitor();
    frameRateMonitor.onFrameRate((fps: number) => {
      this.analytics.track('frame_rate', { fps });
      if (fps < 50) {
        this.alerting.sendAlert({
          type: 'performance',
          severity: 'warning',
          message: `Low frame rate detected: ${fps} FPS`,
          metadata: { fps, timestamp: Date.now() }
        });
      }
    });
  }
  private setupMemoryMonitoring(): void {
    const memoryMonitor = new MemoryMonitor();
    memoryMonitor.onMemoryUsage((usage: MemoryUsage) => {
      this.analytics.track('memory_usage', usage);
      if (usage.used > usage.total * 0.8) {
        this.alerting.sendAlert({
          type: 'memory',
          severity: 'critical',
          message: 'High memory usage detected',
          metadata: usage
        });
      }
    });
  }
  generatePerformanceReport(): PerformanceReport {
    return {
      summary: this.analytics.getSummary(),
      trends: this.analytics.getTrends(),
      alerts: this.alerting.getActiveAlerts(),
      recommendations: this.generateRecommendations(),
    };
  }
}
```

### Performans Dashboard Bileşeni

```typescript
interface PerformanceDashboardProps {
  timeRange: TimeRange;
  platforms: Platform[];
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  timeRange,
  platforms
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    const fetchData = async () => {
      const data = await PerformanceAPI.getMetrics(timeRange, platforms);
      setMetrics(data.metrics);
      setAlerts(data.alerts);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [timeRange, platforms]);
  return (
    <div className="performance-dashboard">
      <MetricsOverview metrics={metrics} />
      <FrameRateChart data={metrics} />
      <MemoryUsageChart data={metrics} />
      <NetworkPerformanceChart data={metrics} />
      <AlertsPanel alerts={alerts} />
      <RecommendationsPanel metrics={metrics} />
    </div>
  );
};
```

## Performans Test Stratejileri

### Mobil Uygulamalar için Yük Testi

```typescript
// Mobil Yük Test Framework'ü
class MobileLoadTester {
  private testConfig: LoadTestConfig;
  constructor(config: LoadTestConfig) {
    this.testConfig = config;
  }
  async runLoadTest(): Promise<LoadTestResults> {
    const results: LoadTestResults = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      throughput: 0,
      errors: [],
    };
    const userSimulations = Array.from(
      { length: this.testConfig.concurrentUsers },
      (_, index) => this.simulateUser(index)
    );
    const allResults = await Promise.allSettled(userSimulations);
    return this.aggregateResults(allResults);
  }
  private async simulateUser(userId: number): Promise<UserTestResult> {
    const userActions = [
      'login',
      'browse',
      'search',
      'viewDetails',
      'addToCart',
      'checkout',
    ];
    const results: ActionResult[] = [];
    for (const action of userActions) {
      const startTime = Date.now();
      try {
        await this.performAction(action);
        const endTime = Date.now();
        results.push({
          action,
          success: true,
          responseTime: endTime - startTime,
          userId,
        });
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error.message,
          userId,
        });
      }
    }
    return { userId, results };
  }
}
```

---

Bu rehberde:

1. **Detaylı Performans Metrikleri** – Tüm önemli göstergeler
2. **Platforma Özel Testler** – iOS, Android, React Native, Flutter
3. **Otomatik CI/CD Testleri** – Sürekli performans izleme
4. **Canlı İzleme** – Gerçek zamanlı dashboard
5. **Yük Testleri** – Yük ve stres testleri

Tüm başlıklar, kod örnekleri ve best practice'ler İngilizce orijinal ile birebir uyumlu şekilde Türkçeye aktarılmıştır.