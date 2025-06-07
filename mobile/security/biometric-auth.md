# Biyometrik Kimlik Doğrulama

Biyometrik kimlik doğrulama, kullanıcı kimliğini doğrulamak için benzersiz biyolojik özellikleri kullanır. Modern mobil cihazlar parmak izi, yüz tanıma, iris tarama ve ses tanıma dahil olmak üzere çeşitli biyometrik yöntemleri destekler. Bu bölüm, güvenli biyometrik kimlik doğrulama sistemleri için kapsamlı uygulama stratejilerini içerir.

## Biyometrik Kimlik Doğrulama Mimarisi

## Platform Uygulamaları

### iOS Face ID & Touch ID

```swift
import LocalAuthentication
import CryptoKit

class BiometricAuthenticationManager {
    
    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID
        case unknown
    }
    
    enum BiometricError: Error {
        case notAvailable
        case notEnrolled
        case lockout
        case failed
        case cancelled
        case fallback
        case systemCancel
        case appCancel
        case invalidContext
        case biometryNotAvailable
        case biometryNotEnrolled
        case biometryLockout
    }
    
    // MARK: - Biyometrik Yetenek Tespiti
    
    func getBiometricType() -> BiometricType {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        
        if #available(iOS 17.0, *) {
            switch context.biometryType {
            case .touchID:
                return .touchID
            case .faceID:
                return .faceID
            case .opticID:
                return .opticID
            case .none:
                return .none
            @unknown default:
                return .unknown
            }
        } else {
            switch context.biometryType {
            case .touchID:
                return .touchID
            case .faceID:
                return .faceID
            case .none:
                return .none
            @unknown default:
                return .unknown
            }
        }
    }
    
    func isBiometricAvailable() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
    
    func isBiometricEnrolled() -> Bool {
        let context = LAContext()
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        
        if let error = error {
            return error.code != LAError.biometryNotEnrolled.rawValue
        }
        
        return canEvaluate
    }
    
    // MARK: - Temel Biyometrik Kimlik Doğrulama
    
    func authenticateWithBiometrics(
        reason: String,
        fallbackTitle: String? = nil
    ) async throws -> Bool {
        let context = LAContext()
        
        // Bağlamı yapılandır
        if let fallbackTitle = fallbackTitle {
            context.localizedFallbackTitle = fallbackTitle
        }
        
        // Kullanılabilirliği kontrol et
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw mapLAError(error)
        }
        
        do {
            let result = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return result
        } catch {
            throw mapLAError(error)
        }
    }
    
    func authenticateWithBiometricsOrPasscode(
        reason: String
    ) async throws -> Bool {
        let context = LAContext()
        
        do {
            let result = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            return result
        } catch {
            throw mapLAError(error)
        }
    }
    
    // MARK: - Kriptografik Biyometrik Kimlik Doğrulama
    
    func authenticateWithCryptographicKey(
        keyTag: String,
        reason: String
    ) async throws -> SecKey {
        let context = LAContext()
        
        // Anahtarı sorgula
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
            kSecUseAuthenticationContext as String: context
        ]
        
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else {
            throw BiometricError.failed
        }
        
        guard let secKey = result as! SecKey? else {
            throw BiometricError.failed
        }
        
        // Anahtarı açmak için kimlik doğrulama yap
        do {
            _ = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return secKey
        } catch {
            throw mapLAError(error)
        }
    }
    
    func createBiometricProtectedKey(
        keyTag: String,
        requireBiometry: Bool = true
    ) throws -> SecKey {
        let flags: SecAccessControlCreateFlags = requireBiometry
            ? [.privateKeyUsage, .biometryAny]
            : [.privateKeyUsage, .devicePasscode]
        
        guard let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            nil
        ) else {
            throw BiometricError.failed
        }
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag,
                kSecAttrAccessControl as String: access
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw BiometricError.failed
        }
        
        return privateKey
    }
    
    // MARK: - Gelişmiş Özellikler
    
    func authenticateWithCustomUI(
        reason: String,
        onSuccess: @escaping () -> Void,
        onError: @escaping (BiometricError) -> Void,
        onFallback: @escaping () -> Void
    ) {
        let context = LAContext()
        context.localizedFallbackTitle = "Şifre Kullan"
        
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    onSuccess()
                } else if let error = error as? LAError {
                    switch error.code {
                    case .userFallback:
                        onFallback()
                    default:
                        onError(self.mapLAError(error))
                    }
                } else {
                    onError(.failed)
                }
            }
        }
    }
    
    func invalidateBiometricContext() {
        // Yeni kimlik doğrulama gerektirmek için bağlamı geçersiz kıl
        let context = LAContext()
        context.invalidate()
    }
    
    // MARK: - Hata Eşleştirme
    
    private func mapLAError(_ error: Error?) -> BiometricError {
        guard let laError = error as? LAError else {
            return .failed
        }
        
        switch laError.code {
        case .authenticationFailed:
            return .failed
        case .userCancel:
            return .cancelled
        case .userFallback:
            return .fallback
        case .systemCancel:
            return .systemCancel
        case .appCancel:
            return .appCancel
        case .invalidContext:
            return .invalidContext
        case .biometryNotAvailable:
            return .biometryNotAvailable
        case .biometryNotEnrolled:
            return .biometryNotEnrolled
        case .biometryLockout:
            return .biometryLockout
        case .passcodeNotSet:
            return .notAvailable
        default:
            return .failed
        }
    }
}
```

### Android Biyometrik Kimlik Doğrulama

```kotlin
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.core.content.ContextCompat
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import java.security.KeyStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

class BiometricAuthenticationManager(private val activity: FragmentActivity) {
    
    enum class BiometricCapability {
        BIOMETRIC_SUCCESS,
        BIOMETRIC_ERROR_HW_UNAVAILABLE,
        BIOMETRIC_ERROR_NO_HARDWARE,
        BIOMETRIC_ERROR_NONE_ENROLLED,
        BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED,
        BIOMETRIC_ERROR_UNSUPPORTED,
        BIOMETRIC_STATUS_UNKNOWN
    }
    
    enum class AuthenticatorType {
        BIOMETRIC_STRONG,
        BIOMETRIC_WEAK,
        DEVICE_CREDENTIAL,
        BIOMETRIC_STRONG_OR_DEVICE_CREDENTIAL,
        BIOMETRIC_WEAK_OR_DEVICE_CREDENTIAL
    }
    
    // MARK: - Yetenek Tespiti
    
    fun getBiometricCapability(authenticatorType: AuthenticatorType = AuthenticatorType.BIOMETRIC_STRONG): BiometricCapability {
        val biometricManager = BiometricManager.from(activity)
        
        val authenticators = when (authenticatorType) {
            AuthenticatorType.BIOMETRIC_STRONG -> BiometricManager.Authenticators.BIOMETRIC_STRONG
            AuthenticatorType.BIOMETRIC_WEAK -> BiometricManager.Authenticators.BIOMETRIC_WEAK
            AuthenticatorType.DEVICE_CREDENTIAL -> BiometricManager.Authenticators.DEVICE_CREDENTIAL
            AuthenticatorType.BIOMETRIC_STRONG_OR_DEVICE_CREDENTIAL -> 
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            AuthenticatorType.BIOMETRIC_WEAK_OR_DEVICE_CREDENTIAL ->
                BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        }
        
        return when (biometricManager.canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricCapability.BIOMETRIC_SUCCESS
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricCapability.BIOMETRIC_ERROR_HW_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricCapability.BIOMETRIC_ERROR_NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricCapability.BIOMETRIC_ERROR_NONE_ENROLLED
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> BiometricCapability.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> BiometricCapability.BIOMETRIC_ERROR_UNSUPPORTED
            else -> BiometricCapability.BIOMETRIC_STATUS_UNKNOWN
        }
    }
    
    fun isBiometricAvailable(): Boolean {
        return getBiometricCapability() == BiometricCapability.BIOMETRIC_SUCCESS
    }
    
    // MARK: - Temel Kimlik Doğrulama
    
    fun authenticateWithBiometrics(
        title: String,
        subtitle: String,
        description: String? = null,
        negativeButtonText: String = "İptal",
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailed()
                }
            }
        )
        
        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
        
        if (!description.isNullOrEmpty()) {
            promptInfoBuilder.setDescription(description)
        }
        
        val promptInfo = promptInfoBuilder.build()
        biometricPrompt.authenticate(promptInfo)
    }
    
    fun authenticateWithBiometricsOrDeviceCredential(
        title: String,
        subtitle: String,
        description: String? = null,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailed()
                }
            }
        )
        
        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or 
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        
        if (!description.isNullOrEmpty()) {
            promptInfoBuilder.setDescription(description)
        }
        
        val promptInfo = promptInfoBuilder.build()
        biometricPrompt.authenticate(promptInfo)
    }
    
    // MARK: - Kriptografik İşlemler
    
    fun createBiometricKey(keyAlias: String, requireUserAuthentication: Boolean = true): Boolean {
        return try {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            
            val keyGenParameterSpecBuilder = KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
                .setUserAuthenticationRequired(requireUserAuthentication)
                .setInvalidatedByBiometricEnrollment(true)
            
            if (requireUserAuthentication) {
                keyGenParameterSpecBuilder.setUserAuthenticationValidityDurationSeconds(300) // 5 dakika
            }
            
            keyGenerator.init(keyGenParameterSpecBuilder.build())
            keyGenerator.generateKey()
            true
        } catch (e: Exception) {
            false
        }
    }
    
    fun getCipher(keyAlias: String, mode: Int): Cipher? {
        return try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            
            val secretKey = keyStore.getKey(keyAlias, null)
            val cipher = Cipher.getInstance("AES/CBC/PKCS7Padding")
            cipher.init(mode, secretKey)
            cipher
        } catch (e: Exception) {
            null
        }
    }
    
    fun authenticateWithCryptography(
        cipher: Cipher,
        title: String,
        subtitle: String,
        description: String? = null,
        negativeButtonText: String = "İptal",
        onSuccess: (BiometricPrompt.CryptoObject) -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    result.cryptoObject?.let { onSuccess(it) }
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailed()
                }
            }
        )
        
        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
        
        if (!description.isNullOrEmpty()) {
            promptInfoBuilder.setDescription(description)
        }
        
        val promptInfo = promptInfoBuilder.build()
        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        
        biometricPrompt.authenticate(promptInfo, cryptoObject)
    }
    
    // MARK: - Gelişmiş Özellikler
    
    fun authenticateWithCustomTimeout(
        title: String,
        subtitle: String,
        timeoutSeconds: Int,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onTimeout: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        var authenticationCompleted = false
        
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (!authenticationCompleted) {
                        authenticationCompleted = true
                        onError(errString.toString())
                    }
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    if (!authenticationCompleted) {
                        authenticationCompleted = true
                        onSuccess()
                    }
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Başarısız denemeler için tamamlandı olarak işaretleme
                }
            }
        )
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("İptal")
            .build()
        
        biometricPrompt.authenticate(promptInfo)
        
        // Zaman aşımı ayarla
        ContextCompat.getMainExecutor(activity).execute {
            android.os.Handler().postDelayed({
                if (!authenticationCompleted) {
                    authenticationCompleted = true
                    biometricPrompt.cancelAuthentication()
                    onTimeout()
                }
            }, timeoutSeconds * 1000L)
        }
    }
    
    fun removeBiometricKey(keyAlias: String): Boolean {
        return try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            keyStore.deleteEntry(keyAlias)
            true
        } catch (e: Exception) {
            false
        }
    }
}
```

## Güvenlik Hususları

### Sahte Biyometrik Önlemleri

```kotlin
// Android Sahte Biyometrik Önleme Uygulaması
class BiometricAntiSpoofing {
    
    fun enableLivenessDetection(): Boolean {
        // Sadece güçlü biyometrik doğrulayıcıları kullan
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == 
               BiometricManager.BIOMETRIC_SUCCESS
    }
    
    fun validateBiometricQuality(result: BiometricPrompt.AuthenticationResult): BiometricQuality {
        // Bu kavramsal bir uygulamadır
        // Gerçek uygulamalar platform özel API'leri gerektirir
        
        val cryptoObject = result.cryptoObject
        if (cryptoObject != null) {
            // Kriptografik kimlik doğrulama daha yüksek güvence sağlar
            return BiometricQuality.HIGH
        }
        
        // Kimlik doğrulama gücünü kontrol et
        return when {
            isStrongBiometric() -> BiometricQuality.MEDIUM
            else -> BiometricQuality.LOW
        }
    }
    
    private fun isStrongBiometric(): Boolean {
        // Uygulama, kullanılan biyometriğin
        // güçlü kimlik doğrulama gereksinimlerini karşılayıp karşılamadığını kontrol eder
        return true
    }
    
    enum class BiometricQuality {
        LOW,
        MEDIUM,
        HIGH
    }
}
```

### Biyometrik Şablon Koruması

```swift
// iOS Biyometrik Şablon Güvenliği
class BiometricTemplateProtection {
    
    func createSecureKey(withBiometricProtection: Bool) throws -> SecKey {
        let flags: SecAccessControlCreateFlags = withBiometricProtection 
            ? [.privateKeyUsage, .biometryAny, .invalidateWhenBiometricsChange]
            : [.privateKeyUsage, .devicePasscode]
        
        guard let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            nil
        ) else {
            throw BiometricError.failed
        }
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: "biometric.key",
                kSecAttrAccessControl as String: access
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw BiometricError.failed
        }
        
        return privateKey
    }
    
    func invalidateKeysOnBiometricChange() {
        // .invalidateWhenBiometricsChange bayrağına sahip anahtarlar
        // biyometrik kayıt değiştiğinde otomatik olarak geçersiz kılınır
        // Bu, sahte biyometrik veriler kullanılarak yapılan saldırıları önler
    }
}
```

## En İyi Uygulamalar

### Biyometrik Kimlik Doğrulama Kontrol Listesi

- [ ] **Kullanılabilirlik Kontrolü**
  - Biyometrik donanım kullanılabilirliğini kontrol et
  - Biyometrik kayıt durumunu doğrula
  - Uygun yedek mekanizmaları sağla
  - Cihaza özgü sınırlamaları yönet

- [ ] **Güvenlik Uygulaması**
  - Sadece platform tarafından sağlanan biyometrik API'lerini kullan
  - Mümkün olduğunda kriptografik kimlik doğrulama uygula
  - Biyometrik değişikliklerde anahtar geçersiz kılmayı etkinleştir
  - Hassas anahtarlar için donanım destekli depolama kullan

- [ ] **Kullanıcı Deneyimi**
  - Net kimlik doğrulama istemleri sağla
  - Zarif hata işleme uygula
  - Alternatif kimlik doğrulama yöntemleri sun
  - Kullanıcı tercihlerini ve seçimlerini saygı göster

- [ ] **Gizlilik ve Uyumluluk**
  - Biyometrik şablonları asla saklama veya iletme
  - Uygun onay mekanizmaları uygula
  - Platform gizlilik yönergelerini takip et
  - Bölgesel biyometrik yasalara uy

- [ ] **Hata İşleme**
  - Tüm olası hata senaryolarını yönet
  - Anlamlı hata mesajları sağla
  - Sınırlı yeniden deneme mekanizmaları uygula
  - Güvenlik olaylarını uygun şekilde kaydet

- [ ] **Test ve Doğrulama**
  - Birden fazla cihaz türünde test et
  - Sahte biyometrik önlemleri doğrula
  - Yedek senaryoları test et
  - Güvenlik penetrasyon testleri gerçekleştir

### Uygulama Yönergeleri

1. **Platform API'lerini asla atlama**: Her zaman resmi platform biyometrik API'lerini kullan
2. **Derinlemesine savunma uygula**: Biyometrik kimlik doğrulamayı diğer güvenlik önlemleriyle birleştir
3. **Başarısızlık için planla**: Her zaman yedek kimlik doğrulama yöntemleri sağla
4. **Kullanıcı seçimine saygı göster**: Kullanıcıların biyometrik kimlik doğrulamayı devre dışı bırakmasına izin ver
5. **Güncel kal**: Platform güvenlik güncellemelerini ve en iyi uygulamaları takip et

Biyometrik kimlik doğrulama, güvenlik ve kullanıcı kolaylığı arasında güçlü bir denge sağlar. Platform tarafından sağlanan API'ler kullanılarak ve güvenlik en iyi uygulamaları takip edilerek doğru şekilde uygulandığında, mükemmel kullanıcı deneyimini korurken güçlü koruma sağlar. Anahtar, platform yeteneklerini anlamak, uygun yedekleri uygulamak ve kimlik doğrulama yaşam döngüsü boyunca güvenliği sürdürmektir.
