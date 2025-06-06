# Secret Management - Güvenli Konfigürasyon Yönetimi

Modern uygulamalarda gizli bilgilerin (secret) güvenli yönetimi kritik öneme sahiptir. Bu bölümde Spring Boot uygulamalarında HashiCorp Vault entegrasyonu, şifrelenmiş özellikler ve bulut tabanlı gizli bilgi yönetimi çözümlerini ele alacağız.

## HashiCorp Vault Entegrasyonu (Spring Boot)

### Spring Cloud Vault Konfigürasyonu

Spring Cloud Vault, uygulamaların Vault'tan otomatik olarak gizli bilgileri almasını sağlar:

```yaml
spring:
  cloud:
    vault:
      host: vault.example.com
      port: 8200
      scheme: https
      authentication: TOKEN
      token: ${VAULT_TOKEN}
      kv:
        enabled: true
        backend: secret
        application-name: myapp
      generic:
        enabled: true
        backend: secret
        default-context: myapp
        application-name: myapp
```

### Otomatik Gizli Bilgi Enjeksiyonu

```java
@Configuration
@EnableConfigurationProperties
public class VaultConfiguration {
    
    @Value("${database.password}")
    private String databasePassword;
    
    @Value("${api.secret}")
    private String apiSecret;
    
    // Vault'tan otomatik olarak alınan değerler
}
```

### Dinamik Konfigürasyon Yenileme

```java
@Component
@RefreshScope
public class DynamicConfiguration {
    
    @Value("${dynamic.secret}")
    private String dynamicSecret;
    
    public String getSecret() {
        return dynamicSecret;
    }
}
```

## Vault Kimlik Doğrulama Yöntemleri

### AppRole Authentication

```java
@Configuration
public class VaultConfig {
    
    @Bean
    public VaultTemplate vaultTemplate() {
        VaultEndpoint vaultEndpoint = new VaultEndpoint();
        vaultEndpoint.setHost("vault.example.com");
        vaultEndpoint.setPort(8200);
        vaultEndpoint.setScheme("https");
        
        AppRoleAuthentication authentication = new AppRoleAuthentication(
            AppRoleAuthenticationOptions.builder()
                .roleId(RoleId.provided("my-role-id"))
                .secretId(SecretId.provided("my-secret-id"))
                .build()
        );
        
        return new VaultTemplate(vaultEndpoint, authentication);
    }
}
```

### Kubernetes Authentication

```java
@Configuration
public class KubernetesVaultConfig {
    
    @Bean
    public VaultTemplate vaultTemplate() {
        VaultEndpoint vaultEndpoint = VaultEndpoint.create(
            "vault.example.com", 8200);
        
        KubernetesAuthentication authentication = 
            new KubernetesAuthentication(
                KubernetesAuthenticationOptions.builder()
                    .role("my-k8s-role")
                    .jwtSupplier(() -> {
                        try {
                            return Files.readString(
                                Paths.get("/var/run/secrets/kubernetes.io/serviceaccount/token"));
                        } catch (IOException e) {
                            throw new VaultException("JWT token okunamadı", e);
                        }
                    })
                    .build()
            );
        
        return new VaultTemplate(vaultEndpoint, authentication);
    }
}
```

### AWS IAM Authentication

```java
@Configuration
public class AwsIamVaultConfig {
    
    @Bean
    public VaultTemplate vaultTemplate() {
        VaultEndpoint vaultEndpoint = VaultEndpoint.create(
            "vault.example.com", 8200);
        
        AwsIamAuthentication authentication = new AwsIamAuthentication(
            AwsIamAuthenticationOptions.builder()
                .role("my-aws-role")
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()
        );
        
        return new VaultTemplate(vaultEndpoint, authentication);
    }
}
```

## Spring Boot Konfigürasyon Güvenliği

### Jasypt ile Şifrelenmiş Özellikler

```xml
<dependency>
    <groupId>com.github.ulisesbocchio</groupId>
    <artifactId>jasypt-spring-boot-starter</artifactId>
    <version>3.0.4</version>
</dependency>
```

```yaml
jasypt:
  encryptor:
    password: ${JASYPT_PASSWORD}
    algorithm: PBEWITHHMACSHA512ANDAES_256
    key-obtention-iterations: 1000
    pool-size: 1
    provider-name: SunJCE
    salt-generator-classname: org.jasypt.salt.RandomSaltGenerator
    iv-generator-classname: org.jasypt.iv.RandomIvGenerator
    string-output-type: base64

# Şifrelenmiş değerler
database:
  password: ENC(encrypted_password_here)
  
api:
  secret: ENC(encrypted_api_secret_here)
```

### Konfigürasyon Şifreleme Utility

```java
@Component
public class ConfigurationEncryptor {
    
    private final StringEncryptor encryptor;
    
    public ConfigurationEncryptor(StringEncryptor encryptor) {
        this.encryptor = encryptor;
    }
    
    public String encrypt(String plainText) {
        return encryptor.encrypt(plainText);
    }
    
    public String decrypt(String encryptedText) {
        return encryptor.decrypt(encryptedText);
    }
}
```

### Çevre Değişkeni Tabanlı Şifreleme

```java
@Configuration
public class EncryptionConfig {
    
    @Bean("jasyptStringEncryptor")
    public StringEncryptor stringEncryptor() {
        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        
        config.setPassword(getEncryptionPassword());
        config.setAlgorithm("PBEWITHHMACSHA512ANDAES_256");
        config.setKeyObtentionIterations("1000");
        config.setPoolSize("1");
        config.setProviderName("SunJCE");
        config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        config.setIvGeneratorClassName("org.jasypt.iv.RandomIvGenerator");
        config.setStringOutputType("base64");
        
        encryptor.setConfig(config);
        return encryptor;
    }
    
    private String getEncryptionPassword() {
        String password = System.getenv("JASYPT_ENCRYPTOR_PASSWORD");
        if (password == null) {
            throw new IllegalStateException("JASYPT_ENCRYPTOR_PASSWORD çevre değişkeni tanımlı değil");
        }
        return password;
    }
}
```

## Veritabanı Güvenlik Patterns

### Bağlantı Güvenliği

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb?ssl=true&sslmode=verify-full
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      connection-test-query: SELECT 1
      validation-timeout: 3000
      leak-detection-threshold: 60000
      maximum-pool-size: 20
      minimum-idle: 5
    properties:
      ssl: true
      sslmode: verify-full
      sslcert: ${SSL_CERT_PATH}
      sslkey: ${SSL_KEY_PATH}
      sslrootcert: ${SSL_ROOT_CERT_PATH}
```

### Veritabanı Şifreleme

```java
@Entity
@Table(name = "secure_data")
public class SecureData {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "sensitive_data")
    private String sensitiveData;
    
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "personal_info")
    private String personalInfo;
    
    // getters and setters
}
```

### JPA Attribute Converter

```java
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {
    
    private final AESUtil aesUtil;
    
    public EncryptedStringConverter() {
        this.aesUtil = new AESUtil(getEncryptionKey());
    }
    
    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return aesUtil.encrypt(attribute);
        } catch (Exception e) {
            throw new RuntimeException("Şifreleme hatası", e);
        }
    }
    
    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            return aesUtil.decrypt(dbData);
        } catch (Exception e) {
            throw new RuntimeException("Şifre çözme hatası", e);
        }
    }
    
    private String getEncryptionKey() {
        return System.getenv("DB_ENCRYPTION_KEY");
    }
}
```

## Anahtar Yönetimi Best Practices

### Şifreleme at Rest

```java
@Service
public class FileEncryptionService {
    
    private final AESUtil aesUtil;
    
    public FileEncryptionService() {
        this.aesUtil = new AESUtil(getFileEncryptionKey());
    }
    
    public void encryptFile(String inputPath, String outputPath) throws Exception {
        byte[] fileContent = Files.readAllBytes(Paths.get(inputPath));
        byte[] encryptedContent = aesUtil.encrypt(fileContent);
        Files.write(Paths.get(outputPath), encryptedContent);
    }
    
    public void decryptFile(String inputPath, String outputPath) throws Exception {
        byte[] encryptedContent = Files.readAllBytes(Paths.get(inputPath));
        byte[] decryptedContent = aesUtil.decrypt(encryptedContent);
        Files.write(Paths.get(outputPath), decryptedContent);
    }
    
    private String getFileEncryptionKey() {
        return System.getenv("FILE_ENCRYPTION_KEY");
    }
}
```

### Backup Şifreleme

```java
@Service
public class BackupEncryptionService {
    
    private final StringEncryptor encryptor;
    
    public BackupEncryptionService(StringEncryptor encryptor) {
        this.encryptor = encryptor;
    }
    
    public void createEncryptedBackup(String data, String backupPath) throws IOException {
        String encryptedData = encryptor.encrypt(data);
        Files.write(Paths.get(backupPath), encryptedData.getBytes());
    }
    
    public String restoreFromEncryptedBackup(String backupPath) throws IOException {
        String encryptedData = Files.readString(Paths.get(backupPath));
        return encryptor.decrypt(encryptedData);
    }
}
```

## Cloud-Native Secret Management

### AWS Secrets Manager

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>secretsmanager</artifactId>
</dependency>
```

```java
@Configuration
public class AwsSecretsConfig {
    
    @Bean
    public SecretsManagerClient secretsManagerClient() {
        return SecretsManagerClient.builder()
            .region(Region.US_WEST_2)
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
    }
}
```

### AWS Secrets Manager Service

```java
@Service
public class AwsSecretsManagerService {
    
    private final SecretsManagerClient secretsClient;
    
    public AwsSecretsManagerService(SecretsManagerClient secretsClient) {
        this.secretsClient = secretsClient;
    }
    
    public String getSecret(String secretName) {
        try {
            GetSecretValueRequest request = GetSecretValueRequest.builder()
                .secretId(secretName)
                .build();
            
            GetSecretValueResponse response = secretsClient.getSecretValue(request);
            return response.secretString();
        } catch (SecretsManagerException e) {
            throw new RuntimeException("Secret alınamadı: " + secretName, e);
        }
    }
    
    public void updateSecret(String secretName, String secretValue) {
        try {
            UpdateSecretRequest request = UpdateSecretRequest.builder()
                .secretId(secretName)
                .secretString(secretValue)
                .build();
            
            secretsClient.updateSecret(request);
        } catch (SecretsManagerException e) {
            throw new RuntimeException("Secret güncellenemedi: " + secretName, e);
        }
    }
    
    public void rotateSecret(String secretName) {
        try {
            RotateSecretRequest request = RotateSecretRequest.builder()
                .secretId(secretName)
                .build();
            
            secretsClient.rotateSecret(request);
        } catch (SecretsManagerException e) {
            throw new RuntimeException("Secret rotate edilemedi: " + secretName, e);
        }
    }
}
```

### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
type: Opaque
data:
  database-password: <base64-encoded-password>
  api-key: <base64-encoded-api-key>
  jwt-secret: <base64-encoded-jwt-secret>
```

### External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.example.com:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "my-role"
          serviceAccountRef:
            name: "external-secrets"
```

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: production
spec:
  refreshInterval: 30s
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
  - secretKey: database-password
    remoteRef:
      key: secret/app
      property: database-password
  - secretKey: api-key
    remoteRef:
      key: secret/app
      property: api-key
```

### Sealed Secrets

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: mysecret
  namespace: production
spec:
  encryptedData:
    database-password: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEQAx...
  template:
    metadata:
      name: mysecret
      namespace: production
    type: Opaque
```

## Secret Management Best Practices

### Secret Rotation Strategy

```java
@Component
@Scheduled
public class SecretRotationService {
    
    private final VaultTemplate vaultTemplate;
    private final ApplicationEventPublisher eventPublisher;
    
    public SecretRotationService(VaultTemplate vaultTemplate, 
                               ApplicationEventPublisher eventPublisher) {
        this.vaultTemplate = vaultTemplate;
        this.eventPublisher = eventPublisher;
    }
    
    @Scheduled(cron = "0 0 2 * * ?") // Her gün saat 02:00
    public void rotateSecrets() {
        try {
            // Database password rotation
            rotateDatabasePassword();
            
            // API key rotation
            rotateApiKeys();
            
            // JWT secret rotation
            rotateJwtSecret();
            
            eventPublisher.publishEvent(new SecretsRotatedEvent());
        } catch (Exception e) {
            log.error("Secret rotation başarısız", e);
            eventPublisher.publishEvent(new SecretRotationFailedEvent(e));
        }
    }
    
    private void rotateDatabasePassword() {
        String newPassword = generateSecurePassword();
        vaultTemplate.write("secret/database", Map.of("password", newPassword));
        log.info("Database password rotated");
    }
    
    private void rotateApiKeys() {
        String newApiKey = generateApiKey();
        vaultTemplate.write("secret/api", Map.of("key", newApiKey));
        log.info("API key rotated");
    }
    
    private void rotateJwtSecret() {
        String newJwtSecret = generateJwtSecret();
        vaultTemplate.write("secret/jwt", Map.of("secret", newJwtSecret));
        log.info("JWT secret rotated");
    }
    
    private String generateSecurePassword() {
        // Güvenli password generation logic
        return SecureRandom.getInstanceStrong()
            .ints(32, 33, 126)
            .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
            .toString();
    }
}
```

### Secret Validation

```java
@Component
public class SecretValidator {
    
    public boolean validateDatabasePassword(String password) {
        return password != null && 
               password.length() >= 12 &&
               password.matches(".*[A-Z].*") &&
               password.matches(".*[a-z].*") &&
               password.matches(".*[0-9].*") &&
               password.matches(".*[!@#$%^&*()].*");
    }
    
    public boolean validateApiKey(String apiKey) {
        return apiKey != null && 
               apiKey.length() == 32 &&
               apiKey.matches("^[A-Za-z0-9]+$");
    }
    
    public boolean validateJwtSecret(String jwtSecret) {
        return jwtSecret != null && 
               jwtSecret.length() >= 64;
    }
}
```

Bu kapsamlı secret management implementasyonu, modern Spring Boot uygulamalarında gizli bilgilerin güvenli yönetimi için gerekli tüm bileşenleri içermektedir.
