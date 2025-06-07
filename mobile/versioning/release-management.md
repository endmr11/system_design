# Sürüm Yönetimi

Mobil uygulamalarda sürüm yönetimi, kullanıcıya kesintisiz deneyim sunmak ve uygulamanın yaşam döngüsünü etkili şekilde yönetmek için kritik öneme sahiptir. Bu dokümantasyon, modern sürüm yönetimi stratejilerini ve CI/CD entegrasyonunu kapsar.

## Semantic Versioning

### Versiyon Numaralandırma
```
MAJOR.MINOR.PATCH
Örnek: 2.1.3

MAJOR: Geriye dönük uyumsuz değişiklikler
MINOR: Geriye dönük uyumlu yeni özellikler
PATCH: Geriye dönük uyumlu hata düzeltmeleri
```

### iOS App Store Sürümleme
```swift
// Info.plist
<key>CFBundleShortVersionString</key>
<string>2.1.3</string>
<key>CFBundleVersion</key>
<string>23</string>

// Sürüm yönetimi
struct AppVersion {
    static let marketing = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    static let fullVersion = "\(marketing) (\(build))"
    
    static func isNewerVersion(_ version: String) -> Bool {
        return marketing.compare(version, options: .numeric) == .orderedAscending
    }
}
```

### Android Play Store Sürümleme
```kotlin
// build.gradle.kts
android {
    defaultConfig {
        versionCode = 23
        versionName = "2.1.3"
    }
}

// Sürüm yönetimi
object AppVersion {
    val versionName: String
        get() = BuildConfig.VERSION_NAME
    
    val versionCode: Int
        get() = BuildConfig.VERSION_CODE
    
    fun isNewerVersion(version: String): Boolean {
        return versionName.compareTo(version, ignoreCase = true) < 0
    }
}
```

## Sürüm Pipeline

```yaml
# GitHub Actions - Release Pipeline
name: Release Pipeline
on:
  push:
    tags:
      - 'v*'

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      - name: Build iOS
        run: |
          xcodebuild -workspace App.xcworkspace \
                     -scheme App \
                     -configuration Release \
                     -archivePath App.xcarchive \
                     archive
      - name: Export IPA
        run: |
          xcodebuild -exportArchive \
                     -archivePath App.xcarchive \
                     -exportPath ./build \
                     -exportOptionsPlist ExportOptions.plist
      - name: Upload to App Store
        uses: apple-actions/upload-testflight-build@v1
        with:
          app-path: './build/App.ipa'
          issuer-id: ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id: ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Build Android
        run: ./gradlew assembleRelease
      - name: Sign APK
        uses: r0adkll/sign-android-release@v1
        with:
          releaseDirectory: app/build/outputs/apk/release
          signingKeyBase64: ${{ secrets.SIGNING_KEY }}
          alias: ${{ secrets.ALIAS }}
          keyStorePassword: ${{ secrets.KEY_STORE_PASSWORD }}
          keyPassword: ${{ secrets.KEY_PASSWORD }}
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.SERVICE_ACCOUNT_JSON }}
          packageName: com.example.app
          releaseFiles: app/build/outputs/apk/release/app-release-signed.apk
          track: production
```

## Kademeli Dağıtım

### Kademeli Yayın Stratejisi
```swift
// iOS Kademeli Yayın
class ReleaseManager {
    func checkRolloutEligibility() -> Bool {
        let userId = UserDefaults.standard.string(forKey: "user_id") ?? ""
        let userHash = userId.sha256()
        let rolloutPercentage = RemoteConfig.shared.getInt("rollout_percentage", defaultValue: 0)
        let userBucket = Int(userHash.prefix(8), radix: 16) ?? 0
        return (userBucket % 100) < rolloutPercentage
    }
    func shouldShowNewFeature() -> Bool {
        return checkRolloutEligibility() && AppVersion.isNewerVersion("2.1.0")
    }
}
extension String {
    func sha256() -> String {
        let data = Data(self.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}
```

## A/B Test Entegrasyonu

```kotlin
class ReleaseExperimentManager {
    private val remoteConfig = Firebase.remoteConfig
    fun isUserInExperiment(experimentName: String): Boolean {
        val experimentConfig = remoteConfig.getString("experiment_$experimentName")
        val config = JSONObject(experimentConfig)
        val enabled = config.getBoolean("enabled")
        if (!enabled) return false
        val percentage = config.getInt("percentage")
        val userId = getUserId()
        return getUserBucket(userId) < percentage
    }
    private fun getUserBucket(userId: String): Int {
        val hash = userId.toByteArray().fold(0) { acc, byte -> 31 * acc + byte.toInt() }
        return kotlin.math.abs(hash % 100)
    }
    fun trackExperimentExposure(experimentName: String, variant: String) {
        FirebaseAnalytics.getInstance(context).logEvent("experiment_exposure") {
            param("experiment_name", experimentName)
            param("variant", variant)
            param("user_id", getUserId())
        }
    }
}
```

---

Modern sürüm yönetimi, otomasyon, kademeli dağıtım ve analitik entegrasyonu ile güvenli ve esnek mobil uygulama yayınları sağlar.
