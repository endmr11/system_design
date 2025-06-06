# Authentication Patterns

Authentication is the cornerstone of mobile application security. Modern mobile apps require sophisticated authentication mechanisms that balance security, user experience, and platform capabilities. This section covers comprehensive authentication strategies from basic patterns to advanced enterprise-grade implementations.

## Authentication Architecture Overview

Mobile authentication operates across multiple layers:
- **User Authentication**: Identity verification (something you know/are/have)
- **Device Authentication**: Device identity and integrity verification
- **Application Authentication**: App-to-service authentication
- **Session Management**: Secure session handling and lifecycle management

## Core Authentication Patterns

### OAuth 2.0 with PKCE

OAuth 2.0 with Proof Key for Code Exchange (PKCE) is the recommended pattern for mobile applications.

```kotlin
// Android OAuth 2.0 with PKCE implementation
class OAuth2Manager {
    private val authService: AuthorizationService
    private val authServiceConfig: AuthorizationServiceConfiguration
    
    fun initiateAuthFlow(): Intent {
        // Generate PKCE parameters
        val codeVerifier = generateCodeVerifier()
        val codeChallenge = generateCodeChallenge(codeVerifier)
        
        val authRequest = AuthorizationRequest.Builder(
            authServiceConfig,
            CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(REDIRECT_URI)
        )
            .setCodeVerifier(codeVerifier)
            .setCodeChallenge(codeChallenge)
            .setCodeChallengeMethod(CodeVerifierUtil.getCodeChallengeMethod())
            .setScope("openid profile email")
            .build()
        
        return authService.getAuthorizationRequestIntent(authRequest)
    }
    
    suspend fun exchangeCodeForTokens(authCode: String, codeVerifier: String): TokenResponse {
        val tokenRequest = TokenRequest.Builder(
            authServiceConfig,
            CLIENT_ID
        )
            .setAuthorizationCode(authCode)
            .setRedirectUri(Uri.parse(REDIRECT_URI))
            .setCodeVerifier(codeVerifier)
            .build()
        
        return withContext(Dispatchers.IO) {
            authService.performTokenRequest(tokenRequest)
        }
    }
    
    private fun generateCodeVerifier(): String {
        return CodeVerifierUtil.generateRandomCodeVerifier()
    }
    
    private fun generateCodeChallenge(verifier: String): String {
        return CodeVerifierUtil.deriveCodeChallengeS256(verifier)
    }
}
```

```swift
// iOS OAuth 2.0 with PKCE implementation
import AuthenticationServices

class OAuth2Manager: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let authURL = URL(string: "https://auth.example.com/oauth/authorize")!
    private let redirectScheme = "com.example.app"
    
    func authenticateWithOAuth2() async throws -> AuthTokens {
        let codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier)
        
        var components = URLComponents(url: authURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: "your_client_id"),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: "com.example.app://oauth"),
            URLQueryItem(name: "scope", value: "openid profile email"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        
        let session = ASWebAuthenticationSession(
            url: components.url!,
            callbackURLScheme: redirectScheme
        ) { callbackURL, error in
            // Handle callback
        }
        
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = true
        
        return try await withCheckedThrowingContinuation { continuation in
            session.start()
        }
    }
    
    private func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64URLEncodedString()
    }
    
    private func generateCodeChallenge(from verifier: String) -> String {
        let challenge = SHA256.hash(data: verifier.data(using: .utf8)!)
        return Data(challenge).base64URLEncodedString()
    }
}
```

### JWT Token Management

JSON Web Tokens (JWT) provide stateless authentication with built-in expiration and claims.

```kotlin
// Android JWT implementation
class JWTManager {
    private val jwtDecoder = JWT()
    
    data class AuthTokens(
        val accessToken: String,
        val refreshToken: String,
        val expiresAt: Long
    )
    
    fun parseJWT(token: String): DecodedJWT? {
        return try {
            jwtDecoder.decodeJwt(token)
        } catch (e: JWTDecodeException) {
            null
        }
    }
    
    fun isTokenValid(token: String): Boolean {
        val decoded = parseJWT(token) ?: return false
        return decoded.expiresAt.time > System.currentTimeMillis()
    }
    
    suspend fun refreshTokenIfNeeded(tokens: AuthTokens): AuthTokens {
        if (isTokenExpiringSoon(tokens.accessToken)) {
            return refreshAccessToken(tokens.refreshToken)
        }
        return tokens
    }
    
    private fun isTokenExpiringSoon(token: String, bufferMinutes: Int = 5): Boolean {
        val decoded = parseJWT(token) ?: return true
        val bufferTime = bufferMinutes * 60 * 1000
        return decoded.expiresAt.time - System.currentTimeMillis() < bufferTime
    }
    
    private suspend fun refreshAccessToken(refreshToken: String): AuthTokens {
        return withContext(Dispatchers.IO) {
            // Implement token refresh API call
            authApiService.refreshToken(RefreshTokenRequest(refreshToken))
        }
    }
}
```

### Multi-Factor Authentication (MFA)

```swift
// iOS MFA implementation
class MFAManager {
    enum MFAMethod {
        case sms(phoneNumber: String)
        case email(emailAddress: String)
        case authenticatorApp
        case biometric
    }
    
    enum MFAError: Error {
        case invalidCode
        case expiredCode
        case tooManyAttempts
        case methodNotSupported
    }
    
    func initiateMFA(method: MFAMethod, userId: String) async throws -> String {
        switch method {
        case .sms(let phoneNumber):
            return try await sendSMSCode(to: phoneNumber, userId: userId)
        case .email(let email):
            return try await sendEmailCode(to: email, userId: userId)
        case .authenticatorApp:
            return try await setupTOTP(userId: userId)
        case .biometric:
            return try await setupBiometric(userId: userId)
        }
    }
    
    func verifyMFA(code: String, challengeId: String) async throws -> Bool {
        let request = MFAVerificationRequest(
            code: code,
            challengeId: challengeId,
            timestamp: Date().timeIntervalSince1970
        )
        
        let response = try await apiService.verifyMFA(request)
        return response.isValid
    }
    
    private func sendSMSCode(to phoneNumber: String, userId: String) async throws -> String {
        let request = SMSChallengeRequest(
            phoneNumber: phoneNumber,
            userId: userId,
            method: "sms"
        )
        
        let response = try await apiService.initiateSMSChallenge(request)
        return response.challengeId
    }
}
```

## Biometric Authentication

### iOS Face ID / Touch ID

```swift
import LocalAuthentication

class BiometricAuthManager {
    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID
    }
    
    enum BiometricError: Error {
        case notAvailable
        case notEnrolled
        case lockout
        case failed
        case cancelled
        case fallback
    }
    
    func getBiometricType() -> BiometricType {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        
        switch context.biometryType {
        case .touchID:
            return .touchID
        case .faceID:
            return .faceID
        case .opticID:
            return .opticID
        default:
            return .none
        }
    }
    
    func authenticateWithBiometrics(reason: String) async throws -> Bool {
        let context = LAContext()
        
        // Check if biometric authentication is available
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw BiometricError.notAvailable
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
    
    func authenticateWithBiometricsOrPasscode(reason: String) async throws -> Bool {
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
    
    private func mapLAError(_ error: Error) -> BiometricError {
        guard let laError = error as? LAError else {
            return .failed
        }
        
        switch laError.code {
        case .biometryNotAvailable:
            return .notAvailable
        case .biometryNotEnrolled:
            return .notEnrolled
        case .biometryLockout:
            return .lockout
        case .userCancel:
            return .cancelled
        case .userFallback:
            return .fallback
        default:
            return .failed
        }
    }
}
```

### Android Biometric Authentication

```kotlin
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

class BiometricAuthManager(private val fragmentActivity: FragmentActivity) {
    
    enum class BiometricStatus {
        SUCCESS,
        HARDWARE_UNAVAILABLE,
        FEATURE_UNAVAILABLE,
        NONE_ENROLLED,
        SECURITY_UPDATE_REQUIRED,
        UNSUPPORTED,
        STATUS_UNKNOWN
    }
    
    fun getBiometricStatus(): BiometricStatus {
        val biometricManager = BiometricManager.from(fragmentActivity)
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricStatus.SUCCESS
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricStatus.HARDWARE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricStatus.FEATURE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricStatus.NONE_ENROLLED
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> BiometricStatus.SECURITY_UPDATE_REQUIRED
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> BiometricStatus.UNSUPPORTED
            else -> BiometricStatus.STATUS_UNKNOWN
        }
    }
    
    fun authenticateWithBiometrics(
        title: String,
        subtitle: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(fragmentActivity)
        val biometricPrompt = BiometricPrompt(fragmentActivity, executor,
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
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .build()
        
        biometricPrompt.authenticate(promptInfo)
    }
    
    // Biometric authentication with cryptographic operations
    fun authenticateWithCrypto(
        cipher: Cipher,
        title: String,
        subtitle: String,
        onSuccess: (BiometricPrompt.CryptoObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(fragmentActivity)
        val biometricPrompt = BiometricPrompt(fragmentActivity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
                
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    result.cryptoObject?.let { onSuccess(it) }
                }
            }
        )
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .build()
        
        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        biometricPrompt.authenticate(promptInfo, cryptoObject)
    }
}
```

## Session Management

### Secure Session Implementation

```kotlin
class SessionManager {
    private val secureStorage = SecureStorageManager()
    private val sessionTimeout = 30 * 60 * 1000L // 30 minutes
    
    data class Session(
        val userId: String,
        val accessToken: String,
        val refreshToken: String,
        val expiresAt: Long,
        val lastActivity: Long
    )
    
    suspend fun createSession(authTokens: AuthTokens, userId: String): Session {
        val session = Session(
            userId = userId,
            accessToken = authTokens.accessToken,
            refreshToken = authTokens.refreshToken,
            expiresAt = authTokens.expiresAt,
            lastActivity = System.currentTimeMillis()
        )
        
        secureStorage.storeSession(session)
        return session
    }
    
    suspend fun validateSession(): Session? {
        val session = secureStorage.getSession() ?: return null
        
        // Check if session is expired
        if (System.currentTimeMillis() > session.expiresAt) {
            invalidateSession()
            return null
        }
        
        // Check for inactivity timeout
        if (System.currentTimeMillis() - session.lastActivity > sessionTimeout) {
            invalidateSession()
            return null
        }
        
        // Update last activity
        val updatedSession = session.copy(lastActivity = System.currentTimeMillis())
        secureStorage.storeSession(updatedSession)
        
        return updatedSession
    }
    
    suspend fun refreshSession(session: Session): Session? {
        return try {
            val newTokens = authApiService.refreshToken(session.refreshToken)
            val newSession = session.copy(
                accessToken = newTokens.accessToken,
                expiresAt = newTokens.expiresAt,
                lastActivity = System.currentTimeMillis()
            )
            secureStorage.storeSession(newSession)
            newSession
        } catch (e: Exception) {
            invalidateSession()
            null
        }
    }
    
    suspend fun invalidateSession() {
        secureStorage.clearSession()
    }
}
```

## Single Sign-On (SSO)

### Enterprise SSO Integration

```swift
// iOS SSO with SAML/OpenID Connect
class SSOManager {
    enum SSOProvider {
        case okta
        case azureAD
        case pingIdentity
        case custom(String)
    }
    
    func initiateSSO(provider: SSOProvider) async throws -> AuthResult {
        let ssoConfig = getSSOConfiguration(for: provider)
        
        let session = ASWebAuthenticationSession(
            url: ssoConfig.authURL,
            callbackURLScheme: ssoConfig.callbackScheme
        ) { callbackURL, error in
            // Handle SSO callback
        }
        
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false // Allow SSO cookies
        
        return try await withCheckedThrowingContinuation { continuation in
            session.start()
        }
    }
    
    private func getSSOConfiguration(for provider: SSOProvider) -> SSOConfiguration {
        switch provider {
        case .okta:
            return SSOConfiguration(
                authURL: URL(string: "https://company.okta.com/oauth2/v1/authorize")!,
                callbackScheme: "com.company.app"
            )
        case .azureAD:
            return SSOConfiguration(
                authURL: URL(string: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize")!,
                callbackScheme: "com.company.app"
            )
        // Other providers...
        default:
            fatalError("Unsupported SSO provider")
        }
    }
}
```

## Device Authentication

### Device Fingerprinting

```kotlin
class DeviceAuthenticationManager {
    fun generateDeviceFingerprint(): String {
        val deviceInfo = collectDeviceInfo()
        val fingerprint = hashDeviceInfo(deviceInfo)
        return fingerprint
    }
    
    private fun collectDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID),
            model = Build.MODEL,
            manufacturer = Build.MANUFACTURER,
            osVersion = Build.VERSION.RELEASE,
            screenDensity = context.resources.displayMetrics.density.toString(),
            timezone = TimeZone.getDefault().id,
            language = Locale.getDefault().language
        )
    }
    
    private fun hashDeviceInfo(deviceInfo: DeviceInfo): String {
        val infoString = "${deviceInfo.androidId}-${deviceInfo.model}-${deviceInfo.manufacturer}-${deviceInfo.osVersion}"
        return MessageDigest.getInstance("SHA-256")
            .digest(infoString.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
    
    fun verifyDeviceIntegrity(): Boolean {
        // Implement device integrity checks
        return checkRootStatus() && checkDebuggerAttachment() && checkEmulatorStatus()
    }
    
    private fun checkRootStatus(): Boolean {
        // Check for root indicators
        val rootIndicators = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su"
        )
        
        return rootIndicators.none { File(it).exists() }
    }
}
```

## Security Best Practices

### Authentication Flow Security

1. **Secure Token Storage**: Always use platform keychain/keystore
2. **Token Rotation**: Implement automatic token refresh
3. **Biometric Fallback**: Provide passcode fallback options
4. **Session Timeout**: Implement inactivity timeouts
5. **Device Binding**: Bind sessions to device fingerprints

### Implementation Checklist

- [ ] OAuth 2.0 with PKCE implemented
- [ ] JWT token validation and refresh
- [ ] Biometric authentication with fallbacks
- [ ] Secure session management
- [ ] Device fingerprinting
- [ ] Multi-factor authentication support
- [ ] SSO integration for enterprise
- [ ] Proper error handling and user feedback
- [ ] Security logging and monitoring
- [ ] Compliance with platform guidelines

Authentication patterns form the foundation of mobile security. Proper implementation requires understanding platform capabilities, security best practices, and user experience considerations to create secure yet usable authentication flows.
