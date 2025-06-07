# Güvenli Depolama

Güvenli depolama, hassas verileri işleyen mobil uygulamalar için temel bir güvenlik gereksinimidir. Bu, kullanıcı kimlik bilgilerini, API tokenlarını, kişisel bilgileri ve finansal verileri içerir. Hem Android hem de iOS, mevcut olduğunda donanım güvenlik özelliklerinden yararlanan platform özel güvenli depolama mekanizmaları sağlar.

## Android Güvenli Depolama

### EncryptedSharedPreferences

Android'in `EncryptedSharedPreferences`'ı, mevcut olduğunda donanım destekli anahtarlar kullanarak AES şifreleme ile otomatik şifreleme/şifre çözme sağlar.

```kotlin
// Şifreleme için MasterKey oluştur
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

// EncryptedSharedPreferences oluştur
val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Hassas verileri sakla
encryptedPrefs.edit()
    .putString("auth_token", authToken)
    .putString("user_credentials", credentials)
    .apply()
```

### Android Keystore Sistemi

Android Keystore sistemi, kriptografik işlemler için donanım destekli anahtar depolama sağlar.

```kotlin
// Android Keystore'da anahtarlar oluştur
val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
val keyGenParameterSpec = KeyGenParameterSpec.Builder(
    "secure_key",
    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setUserAuthenticationRequired(true)
    .setUserAuthenticationValidityDurationSeconds(300)
    .build()

keyGenerator.init(keyGenParameterSpec)
val secretKey = keyGenerator.generateKey()

// Şifreleme için anahtarı kullan
val cipher = Cipher.getInstance("AES/GCM/NoPadding")
cipher.init(Cipher.ENCRYPT_MODE, secretKey)
val encryptedData = cipher.doFinal(plainTextData.toByteArray())
```

## iOS Güvenli Depolama

### Keychain Servisleri

iOS Keychain, isteğe bağlı iCloud senkronizasyonu ve biyometrik koruma ile hassas bilgilerin güvenli depolanmasını sağlar.

```swift
import Security
import LocalAuthentication

class KeychainManager {
    
    func store(data: Data, forKey key: String, requireBiometry: Bool = false) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        var finalQuery = query
        
        if requireBiometry {
            let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryAny,
                nil
            )
            finalQuery[kSecAttrAccessControl as String] = access
        }
        
        // Mevcut öğeyi sil
        SecItemDelete(query as CFDictionary)
        
        // Yeni öğe ekle
        let status = SecItemAdd(finalQuery as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func retrieve(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        return status == errSecSuccess ? result as? Data : nil
    }
}
```

## Güvenli Depolama İçin En İyi Uygulamalar

### Veri Sınıflandırması
1. **Genel Veri**: Şifreleme gerekmez
2. **İç Veri**: Temel şifreleme
3. **Gizli Veri**: Güçlü şifreleme + erişim kontrolleri
4. **Kısıtlı Veri**: Donanım destekli şifreleme + biyometri

### Anahtar Yönetimi Stratejisi
```kotlin
// Android anahtar yönetimi örneği
class KeyManagementStrategy {
    companion object {
        const val KEY_ALIAS_AUTH_TOKEN = "auth_token_key"
        const val KEY_ALIAS_USER_DATA = "user_data_key"
        const val KEY_ALIAS_FINANCIAL = "financial_key"
    }
    
    fun getKeyForDataType(dataType: DataType): String {
        return when (dataType) {
            DataType.AUTH_TOKEN -> KEY_ALIAS_AUTH_TOKEN
            DataType.USER_DATA -> KEY_ALIAS_USER_DATA
            DataType.FINANCIAL -> KEY_ALIAS_FINANCIAL
        }
    }
}
```

## Güvenlik Değerlendirmeleri

### Anahtar Rotasyonu
- Uzun ömürlü uygulamalar için otomatik anahtar rotasyonu uygulayın
- Mevcut şifrelenmiş veriler için geçiş yolları sağlayın
- Anahtar kullanımını ve yaşam döngüsünü izleyin

### Yedekleme ve Kurtarma
- Şifrelenmiş veriler için güvenli yedekleme stratejileri tasarlayın
- Kurumsal ortamlar için anahtar emanet sistemi uygulayın
- Cihaz geçiş senaryoları için plan yapın

### Uyumluluk Gereksinimleri
- KVKK: Silme hakkı uygulaması
- PCI DSS: Güvenli ödeme verisi depolama
- HIPAA: Sağlık verisi koruması
- SOX: Finansal veri bütünlüğü

Güvenli depolama, mobil uygulama güvenliğinin temelidir. Platform özel API'lerin doğru uygulanması, sağlam anahtar yönetimi uygulamalarıyla birleştirildiğinde, cihaz tehlikeye girse bile hassas kullanıcı verilerinin korunmasını sağlar.
