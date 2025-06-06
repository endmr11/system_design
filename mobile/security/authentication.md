# Kimlik Doğrulama Kalıpları

## Genel Bakış

Mobil uygulamalarda güvenli kimlik doğrulama, kullanıcı verilerini korumak ve uygulamanızın güvenilirliğini sağlamak için kritik öneme sahiptir. Bu dokümantasyon modern kimlik doğrulama kalıplarını ve en iyi uygulamaları kapsar.

## OAuth 2.0 ve OpenID Connect

### iOS Implementation
```swift
import AuthenticationServices

class OAuthManager: NSObject, ASWebAuthenticationPresentationContextProviding {
    func authenticate(completion: @escaping (Result<AuthToken, Error>) -> Void) {
        let authURL = URL(string: "https://accounts.google.com/oauth/authorize?client_id=\(clientId)&redirect_uri=\(redirectUri)&response_type=code&scope=openid profile email")!
        
        let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: "myapp") { callbackURL, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let callbackURL = callbackURL,
                  let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "code" })?.value else {
                completion(.failure(AuthError.invalidResponse))
                return
            }
            
            self.exchangeCodeForToken(code: code, completion: completion)
        }
        
        session.presentationContextProvider = self
        session.start()
    }
    
    private func exchangeCodeForToken(code: String, completion: @escaping (Result<AuthToken, Error>) -> Void) {
        // Token exchange implementation
        let tokenRequest = TokenRequest(
            clientId: clientId,
            clientSecret: clientSecret,
            code: code,
            redirectUri: redirectUri
        )
        
        APIService.exchangeToken(tokenRequest) { result in
            DispatchQueue.main.async {
                completion(result)
            }
        }
    }
    
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return UIApplication.shared.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
```

### Android Implementation
```kotlin
import androidx.browser.customtabs.CustomTabsIntent
import net.openid.appauth.*

class OAuthManager(private val context: Context) {
    private val authService = AuthorizationService(context)
    
    fun authenticate(callback: (AuthToken?, Exception?) -> Unit) {
        val serviceConfig = AuthorizationServiceConfiguration(
            Uri.parse("https://accounts.google.com/oauth/authorize"),
            Uri.parse("https://oauth2.googleapis.com/token")
        )
        
        val authRequest = AuthorizationRequest.Builder(
            serviceConfig,
            CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(REDIRECT_URI)
        )
        .setScope("openid profile email")
        .build()
        
        val authIntent = authService.getAuthorizationRequestIntent(authRequest)
        
        // Activity result'ı handle et
        (context as Activity).startActivityForResult(authIntent, AUTH_REQUEST_CODE)
    }
    
    fun handleAuthorizationResponse(
        intent: Intent,
        callback: (AuthToken?, Exception?) -> Unit
    ) {
        val response = AuthorizationResponse.fromIntent(intent)
        val exception = AuthorizationException.fromIntent(intent)
        
        if (response != null) {
            exchangeCodeForToken(response, callback)
        } else {
            callback(null, exception)
        }
    }
    
    private fun exchangeCodeForToken(
        response: AuthorizationResponse,
        callback: (AuthToken?, Exception?) -> Unit
    ) {
        val tokenRequest = response.createTokenExchangeRequest()
        
        authService.performTokenRequest(tokenRequest) { tokenResponse, exception ->
            if (tokenResponse != null) {
                val authToken = AuthToken(
                    accessToken = tokenResponse.accessToken!!,
                    refreshToken = tokenResponse.refreshToken,
                    expiresAt = tokenResponse.accessTokenExpirationTime
                )
                callback(authToken, null)
            } else {
                callback(null, exception)
            }
        }
    }
}
```

## JWT Token Management

### Token Storage ve Refresh
```swift
import Security

class TokenManager {
    private let keychain = KeychainWrapper.standard
    
    func storeToken(_ token: AuthToken) {
        do {
            let tokenData = try JSONEncoder().encode(token)
            keychain.set(tokenData, forKey: "auth_token")
        } catch {
            print("Failed to store token: \(error)")
        }
    }
    
    func getToken() -> AuthToken? {
        guard let tokenData = keychain.data(forKey: "auth_token") else { return nil }
        
        do {
            return try JSONDecoder().decode(AuthToken.self, from: tokenData)
        } catch {
            print("Failed to decode token: \(error)")
            return nil
        }
    }
    
    func refreshTokenIfNeeded() async -> AuthToken? {
        guard let currentToken = getToken() else { return nil }
        
        // Token'ın süresi dolmuş mu kontrol et
        if currentToken.isExpired() {
            return await refreshToken(currentToken.refreshToken)
        }
        
        return currentToken
    }
    
    private func refreshToken(_ refreshToken: String?) async -> AuthToken? {
        guard let refreshToken = refreshToken else { return nil }
        
        do {
            let newToken = try await APIService.refreshToken(refreshToken)
            storeToken(newToken)
            return newToken
        } catch {
            print("Token refresh failed: \(error)")
            // Refresh token geçersizse kullanıcıyı yeniden login'e yönlendir
            clearToken()
            return nil
        }
    }
    
    func clearToken() {
        keychain.removeObject(forKey: "auth_token")
    }
}
```

## Biometric Authentication

### iOS Face ID / Touch ID
```swift
import LocalAuthentication

class BiometricAuthManager {
    private let context = LAContext()
    
    func authenticateWithBiometrics(completion: @escaping (Result<Bool, Error>) -> Void) {
        var error: NSError?
        
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = "Uygulamaya erişim için kimlik doğrulaması gerekiyor"
            
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
                DispatchQueue.main.async {
                    if success {
                        completion(.success(true))
                    } else {
                        completion(.failure(error ?? BiometricError.unknown))
                    }
                }
            }
        } else {
            completion(.failure(error ?? BiometricError.notAvailable))
        }
    }
    
    func getBiometricType() -> LABiometryType {
        context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }
}

enum BiometricError: Error {
    case notAvailable
    case unknown
    
    var localizedDescription: String {
        switch self {
        case .notAvailable:
            return "Biyometrik kimlik doğrulama mevcut değil"
        case .unknown:
            return "Bilinmeyen hata oluştu"
        }
    }
}
```

### Android Fingerprint / Face Recognition
```kotlin
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity

class BiometricAuthManager(private val activity: FragmentActivity) {
    
    fun authenticateWithBiometrics(
        onSuccess: () -> Unit,
        onError: (String) -> Unit
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
                    onError("Kimlik doğrulama başarısız")
                }
            })
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biyometrik Kimlik Doğrulama")
            .setSubtitle("Parmak izinizi veya yüzünüzü kullanarak giriş yapın")
            .setNegativeButtonText("İptal")
            .build()
        
        biometricPrompt.authenticate(promptInfo)
    }
    
    fun isBiometricAvailable(): Boolean {
        return BiometricManager.from(activity).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }
}
```

## Multi-Factor Authentication (MFA)

### TOTP Implementation
```swift
import CryptoKit

class TOTPManager {
    private let secretKey: Data
    
    init(secretKey: String) {
        self.secretKey = Data(base32Encoded: secretKey) ?? Data()
    }
    
    func generateTOTP(timeStep: TimeInterval = 30) -> String {
        let counter = UInt64(Date().timeIntervalSince1970 / timeStep)
        return generateHOTP(counter: counter)
    }
    
    private func generateHOTP(counter: UInt64) -> String {
        var counterBytes = withUnsafeBytes(of: counter.bigEndian) { Data($0) }
        
        let hmac = HMAC<Insecure.SHA1>.authenticationCode(for: counterBytes, using: SymmetricKey(data: secretKey))
        let hmacData = Data(hmac)
        
        let offset = Int(hmacData[hmacData.count - 1] & 0x0f)
        let truncatedHash = hmacData.subdata(in: offset..<offset + 4)
        
        let code = truncatedHash.withUnsafeBytes { bytes in
            let value = bytes.load(as: UInt32.self).bigEndian
            return (value & 0x7fffffff) % 1000000
        }
        
        return String(format: "%06d", code)
    }
    
    func verifyTOTP(_ userCode: String, tolerance: Int = 1) -> Bool {
        let currentTime = Date().timeIntervalSince1970
        let timeStep: TimeInterval = 30
        
        for i in -tolerance...tolerance {
            let testTime = currentTime + Double(i) * timeStep
            let testCounter = UInt64(testTime / timeStep)
            let expectedCode = generateHOTP(counter: testCounter)
            
            if userCode == expectedCode {
                return true
            }
        }
        
        return false
    }
}
```

## Session Management

### Secure Session Handling
```kotlin
class SessionManager(private val context: Context) {
    private val sharedPrefs = context.getSharedPreferences("secure_session", Context.MODE_PRIVATE)
    private val encryptedPrefs = EncryptedSharedPreferences.create(
        "encrypted_session",
        MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    fun createSession(user: User, token: AuthToken) {
        val sessionData = SessionData(
            userId = user.id,
            token = token,
            createdAt = System.currentTimeMillis(),
            expiresAt = token.expiresAt
        )
        
        encryptedPrefs.edit()
            .putString("session_data", sessionData.toJson())
            .apply()
        
        // Session timeout ayarla
        scheduleSessionTimeout(token.expiresAt)
    }
    
    fun getSession(): SessionData? {
        val sessionJson = encryptedPrefs.getString("session_data", null)
        return sessionJson?.let { SessionData.fromJson(it) }
    }
    
    fun isSessionValid(): Boolean {
        val session = getSession() ?: return false
        return System.currentTimeMillis() < session.expiresAt
    }
    
    fun clearSession() {
        encryptedPrefs.edit().clear().apply()
        cancelSessionTimeout()
    }
    
    private fun scheduleSessionTimeout(expiresAt: Long) {
        val workRequest = OneTimeWorkRequestBuilder<SessionTimeoutWorker>()
            .setInitialDelay(expiresAt - System.currentTimeMillis(), TimeUnit.MILLISECONDS)
            .build()
        
        WorkManager.getInstance(context).enqueue(workRequest)
    }
}
```

Bu kimlik doğrulama kalıpları ile güvenli, kullanıcı dostu ve modern mobil uygulamalar geliştirebilirsiniz.
