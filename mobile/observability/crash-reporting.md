# Çökme Raporlama Sistemleri

## Genel Bakış

Mobil uygulamalarda çökme raporlama, uygulamanızın kararlılığını izlemek ve kullanıcı deneyimini iyileştirmek için kritik öneme sahiptir. Bu dokümantasyon modern crash reporting sistemlerinin implementasyonunu kapsar.

## Platform-Specific Crash Reporting

### iOS Crash Reporting
```swift
import FirebaseCrashlytics

class CrashReportingManager {
    static func initialize() {
        Crashlytics.crashlytics().setUserID(UserManager.shared.currentUser?.id ?? "anonymous")
        
        // Custom keys ekle
        Crashlytics.crashlytics().setCustomValue(AppVersion.fullVersion, forKey: "app_version")
        Crashlytics.crashlytics().setCustomValue(UIDevice.current.model, forKey: "device_model")
        Crashlytics.crashlytics().setCustomValue(UIDevice.current.systemVersion, forKey: "os_version")
    }
    
    static func logError(_ error: Error, additionalInfo: [String: Any] = [:]) {
        // Custom keys ekle
        additionalInfo.forEach { key, value in
            Crashlytics.crashlytics().setCustomValue(value, forKey: key)
        }
        
        // Error'u raporla
        Crashlytics.crashlytics().record(error: error)
    }
    
    static func logNonFatalError(_ message: String, 
                                userInfo: [String: Any] = [:],
                                file: String = #file,
                                function: String = #function,
                                line: Int = #line) {
        let error = NSError(
            domain: "com.app.nonfatal",
            code: -1,
            userInfo: [
                NSLocalizedDescriptionKey: message,
                "file": file,
                "function": function,
                "line": line
            ].merging(userInfo) { $1 }
        )
        
        Crashlytics.crashlytics().record(error: error)
    }
    
    static func setBreadcrumb(_ message: String, category: String = "general") {
        Crashlytics.crashlytics().log("\(category): \(message)")
    }
    
    static func setUserContext(_ user: User) {
        let crashlytics = Crashlytics.crashlytics()
        crashlytics.setUserID(user.id)
        crashlytics.setCustomValue(user.email, forKey: "user_email")
        crashlytics.setCustomValue(user.subscriptionType, forKey: "subscription_type")
        crashlytics.setCustomValue(user.registrationDate, forKey: "registration_date")
    }
}

// Usage örneği
extension NetworkManager {
    func handleAPIError(_ error: APIError, endpoint: String) {
        CrashReportingManager.logNonFatalError(
            "API request failed",
            userInfo: [
                "endpoint": endpoint,
                "error_code": error.code,
                "error_message": error.localizedDescription,
                "retry_count": error.retryCount
            ]
        )
    }
}
```

### Android Crash Reporting
```kotlin
import com.google.firebase.crashlytics.FirebaseCrashlytics

class CrashReportingManager {
    companion object {
        private val crashlytics = FirebaseCrashlytics.getInstance()
        
        fun initialize(context: Context) {
            val user = UserManager.getCurrentUser()
            crashlytics.setUserId(user?.id ?: "anonymous")
            
            // Custom keys
            crashlytics.setCustomKey("app_version", BuildConfig.VERSION_NAME)
            crashlytics.setCustomKey("device_model", Build.MODEL)
            crashlytics.setCustomKey("os_version", Build.VERSION.RELEASE)
            crashlytics.setCustomKey("sdk_version", Build.VERSION.SDK_INT)
        }
        
        fun logError(throwable: Throwable, additionalInfo: Map<String, String> = emptyMap()) {
            // Custom keys ekle
            additionalInfo.forEach { (key, value) ->
                crashlytics.setCustomKey(key, value)
            }
            
            // Error'u raporla
            crashlytics.recordException(throwable)
        }
        
        fun logNonFatalError(
            message: String,
            additionalInfo: Map<String, String> = emptyMap(),
            cause: Throwable? = null
        ) {
            val exception = NonFatalException(message, cause)
            
            additionalInfo.forEach { (key, value) ->
                crashlytics.setCustomKey(key, value)
            }
            
            crashlytics.recordException(exception)
        }
        
        fun setBreadcrumb(message: String, category: String = "general") {
            crashlytics.log("$category: $message")
        }
        
        fun setUserContext(user: User) {
            crashlytics.setUserId(user.id)
            crashlytics.setCustomKey("user_email", user.email)
            crashlytics.setCustomKey("subscription_type", user.subscriptionType)
            crashlytics.setCustomKey("registration_date", user.registrationDate.toString())
        }
    }
    
    class NonFatalException(message: String, cause: Throwable? = null) : Exception(message, cause)
}

// Usage örneği
class NetworkManager {
    fun handleAPIError(error: APIError, endpoint: String) {
        CrashReportingManager.logNonFatalError(
            "API request failed",
            mapOf(
                "endpoint" to endpoint,
                "error_code" to error.code.toString(),
                "error_message" to error.message,
                "retry_count" to error.retryCount.toString()
            )
        )
    }
}
```

## Custom Crash Reporting Implementation

### Local Crash Handler
```swift
// iOS Custom Crash Handler
class LocalCrashHandler {
    private static let crashLogPath = FileManager.default.urls(for: .documentDirectory, 
                                                              in: .userDomainMask)[0]
        .appendingPathComponent("crash_logs")
    
    static func setup() {
        // NSSetUncaughtExceptionHandler kullanımı
        NSSetUncaughtExceptionHandler { exception in
            handleCrash(exception: exception)
        }
        
        // Signal handler kurulumu
        signal(SIGABRT) { signal in
            handleSignal(signal)
        }
        signal(SIGILL) { signal in
            handleSignal(signal)
        }
        signal(SIGSEGV) { signal in
            handleSignal(signal)
        }
    }
    
    private static func handleCrash(exception: NSException) {
        let crashReport = CrashReport(
            timestamp: Date(),
            type: .exception,
            name: exception.name.rawValue,
            reason: exception.reason ?? "Unknown",
            stackTrace: exception.callStackSymbols,
            deviceInfo: getDeviceInfo(),
            appInfo: getAppInfo()
        )
        
        saveCrashReport(crashReport)
    }
    
    private static func handleSignal(_ signal: Int32) {
        let crashReport = CrashReport(
            timestamp: Date(),
            type: .signal,
            name: "Signal \(signal)",
            reason: "Signal caught",
            stackTrace: Thread.callStackSymbols,
            deviceInfo: getDeviceInfo(),
            appInfo: getAppInfo()
        )
        
        saveCrashReport(crashReport)
        exit(signal)
    }
    
    private static func saveCrashReport(_ report: CrashReport) {
        do {
            try FileManager.default.createDirectory(at: crashLogPath, 
                                                   withIntermediateDirectories: true)
            
            let fileName = "crash_\(Int(report.timestamp.timeIntervalSince1970)).json"
            let fileURL = crashLogPath.appendingPathComponent(fileName)
            
            let data = try JSONEncoder().encode(report)
            try data.write(to: fileURL)
            
            print("Crash report saved: \(fileURL)")
        } catch {
            print("Failed to save crash report: \(error)")
        }
    }
    
    static func sendPendingCrashReports() {
        do {
            let files = try FileManager.default.contentsOfDirectory(at: crashLogPath, 
                                                                   includingPropertiesForKeys: nil)
            
            for file in files where file.pathExtension == "json" {
                let data = try Data(contentsOf: file)
                let report = try JSONDecoder().decode(CrashReport.self, from: data)
                
                uploadCrashReport(report) { success in
                    if success {
                        try? FileManager.default.removeItem(at: file)
                    }
                }
            }
        } catch {
            print("Failed to process crash reports: \(error)")
        }
    }
    
    private static func uploadCrashReport(_ report: CrashReport, completion: @escaping (Bool) -> Void) {
        // Backend'e crash report gönder
        APIService.uploadCrashReport(report) { result in
            switch result {
            case .success:
                completion(true)
            case .failure(let error):
                print("Failed to upload crash report: \(error)")
                completion(false)
            }
        }
    }
}

struct CrashReport: Codable {
    let timestamp: Date
    let type: CrashType
    let name: String
    let reason: String
    let stackTrace: [String]
    let deviceInfo: DeviceInfo
    let appInfo: AppInfo
}

enum CrashType: String, Codable {
    case exception
    case signal
}
```

## Advanced Crash Analysis

### Symbolication ve Stack Trace Analysis
```python
# Backend crash analysis script
import re
import requests
from typing import List, Dict

class CrashAnalyzer:
    def __init__(self, dsym_path: str):
        self.dsym_path = dsym_path
        
    def symbolicate_crash_report(self, crash_report: Dict) -> Dict:
        """iOS crash report'unu symbolicate et"""
        symbolicated_trace = []
        
        for frame in crash_report['stack_trace']:
            # Binary address'i extract et
            address_match = re.search(r'0x[0-9a-fA-F]+', frame)
            if address_match:
                address = address_match.group()
                symbolicated_frame = self.symbolicate_address(address)
                symbolicated_trace.append(symbolicated_frame)
            else:
                symbolicated_trace.append(frame)
        
        crash_report['symbolicated_stack_trace'] = symbolicated_trace
        return crash_report
    
    def symbolicate_address(self, address: str) -> str:
        """Belirli bir address'i symbolicate et"""
        try:
            # atos komutu ile symbolication
            import subprocess
            result = subprocess.run([
                'atos', '-o', self.dsym_path, '-arch', 'arm64', address
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                return f"<unable to symbolicate {address}>"
        except Exception as e:
            return f"<symbolication failed: {e}>"
    
    def analyze_crash_pattern(self, crash_reports: List[Dict]) -> Dict:
        """Crash pattern analizi"""
        patterns = {
            'most_common_crashes': {},
            'affected_versions': {},
            'device_distribution': {},
            'time_analysis': []
        }
        
        for report in crash_reports:
            # En yaygın crash'ler
            crash_signature = f"{report['name']}: {report['reason']}"
            patterns['most_common_crashes'][crash_signature] = \
                patterns['most_common_crashes'].get(crash_signature, 0) + 1
            
            # Etkilenen versiyonlar
            version = report['app_info']['version']
            patterns['affected_versions'][version] = \
                patterns['affected_versions'].get(version, 0) + 1
            
            # Cihaz dağılımı
            device = report['device_info']['model']
            patterns['device_distribution'][device] = \
                patterns['device_distribution'].get(device, 0) + 1
        
        return patterns
    
    def generate_crash_dashboard_data(self, patterns: Dict) -> Dict:
        """Dashboard için veri oluştur"""
        return {
            'summary': {
                'total_crashes': sum(patterns['most_common_crashes'].values()),
                'unique_crash_types': len(patterns['most_common_crashes']),
                'affected_versions': len(patterns['affected_versions']),
                'affected_devices': len(patterns['device_distribution'])
            },
            'top_crashes': sorted(
                patterns['most_common_crashes'].items(),
                key=lambda x: x[1],
                reverse=True
            )[:10],
            'version_impact': patterns['affected_versions'],
            'device_impact': patterns['device_distribution']
        }
```

## Real-time Crash Monitoring

### WebSocket-based Real-time Updates
```typescript
// React Dashboard için real-time crash monitoring
import { io, Socket } from 'socket.io-client';

class CrashMonitoringDashboard {
    private socket: Socket;
    private crashData: CrashData[] = [];
    
    constructor() {
        this.socket = io('ws://crash-monitoring-server:3000');
        this.setupEventListeners();
    }
    
    private setupEventListeners() {
        this.socket.on('new_crash', (crashData: CrashData) => {
            this.handleNewCrash(crashData);
        });
        
        this.socket.on('crash_pattern_alert', (alert: CrashAlert) => {
            this.handleCrashAlert(alert);
        });
        
        this.socket.on('crash_statistics', (stats: CrashStatistics) => {
            this.updateStatistics(stats);
        });
    }
    
    private handleNewCrash(crashData: CrashData) {
        // Yeni crash'i listeye ekle
        this.crashData.unshift(crashData);
        
        // Critical crash ise immediate alert
        if (crashData.severity === 'critical') {
            this.showCriticalAlert(crashData);
        }
        
        // Real-time chart'ları güncelle
        this.updateCrashCharts();
        
        // Slack/Discord notification gönder
        this.sendNotification(crashData);
    }
    
    private handleCrashAlert(alert: CrashAlert) {
        // Pattern-based alert (örnek: crash rate %50 arttı)
        this.showPatternAlert(alert);
        
        // Auto-scale investigation
        if (alert.type === 'spike') {
            this.triggerAutoInvestigation(alert);
        }
    }
    
    private triggerAutoInvestigation(alert: CrashAlert) {
        // Otomatik analiz başlat
        fetch('/api/crash/auto-investigate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alertId: alert.id,
                timeRange: alert.timeRange,
                affectedVersions: alert.affectedVersions
            })
        });
    }
    
    async getCrashTrends(timeRange: string): Promise<CrashTrend[]> {
        const response = await fetch(`/api/crash/trends?range=${timeRange}`);
        return response.json();
    }
    
    async getTopCrashIssues(limit: number = 10): Promise<CrashIssue[]> {
        const response = await fetch(`/api/crash/top-issues?limit=${limit}`);
        return response.json();
    }
}

interface CrashData {
    id: string;
    timestamp: Date;
    appVersion: string;
    platform: 'ios' | 'android';
    deviceModel: string;
    osVersion: string;
    crashType: string;
    stackTrace: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    userImpact: number;
}

interface CrashAlert {
    id: string;
    type: 'spike' | 'new_crash' | 'regression';
    message: string;
    timeRange: string;
    affectedVersions: string[];
    impactLevel: number;
}
```

Bu crash reporting sistemi ile uygulamanızın kararlılığını proaktif olarak izleyebilir ve kullanıcı deneyimini sürekli iyileştirebilirsiniz.
