# TLS/SSL, mTLS

## Giriş

Transport Layer Security (TLS) ve Mutual TLS (mTLS), ağ iletişiminde veri bütünlüğü ve gizliliği sağlayan kritik güvenlik protokolleridir. Spring Boot ile HTTPS yapılandırması ve sertifika tabanlı kimlik doğrulama uygulamaları güvenli iletişim altyapısını oluşturur.

## HTTPS Yapılandırması (Spring Boot)

### 1. SSL Sertifika Yönetimi

**KeyStore yapılandırması** PKCS12 formatı ile:

```yaml
server:
  ssl:
    key-store: classpath:keystore.p12
    key-store-password: ${KEY_STORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: tomcat
    enabled: true
    protocol: TLS
    enabled-protocols: TLSv1.2,TLSv1.3
    ciphers: TLS_AES_128_GCM_SHA256,TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256
```

**Kendi imzalı sertifikalar** geliştirme için:

```bash
# Generate keystore with self-signed certificate
keytool -genkeypair \
    -alias tomcat \
    -keyalg RSA \
    -keysize 2048 \
    -storetype PKCS12 \
    -keystore keystore.p12 \
    -validity 365 \
    -dname "CN=localhost,OU=Development,O=MyOrg,L=City,ST=State,C=US"

# Export certificate
keytool -export \
    -alias tomcat \
    -file certificate.crt \
    -keystore keystore.p12 \
    -storetype PKCS12
```

**Let's Encrypt entegrasyonu** üretim için:

```java
@Configuration
public class LetsEncryptConfig {
    
    @Value("${letsencrypt.domain}")
    private String domain;
    
    @Value("${letsencrypt.email}")
    private String email;
    
    @Bean
    public SSLContext sslContext() throws Exception {
        // ACME client configuration
        Session session = new Session("acme://letsencrypt.org/staging");
        
        // Account setup
        KeyPair accountKeyPair = KeyPairUtils.createKeyPair(2048);
        Account account = new AccountBuilder()
                .addContact("mailto:" + email)
                .agreeToTermsOfService()
                .useKeyPair(accountKeyPair)
                .create(session);
        
        // Certificate order
        Order order = account.newOrder()
                .domains(domain)
                .create();
        
        // Challenge handling
        for (Authorization auth : order.getAuthorizations()) {
            processChallenge(auth);
        }
        
        // Generate certificate
        KeyPair domainKeyPair = KeyPairUtils.createKeyPair(2048);
        CSRBuilder csrb = new CSRBuilder();
        csrb.addDomains(domain);
        csrb.sign(domainKeyPair);
        
        order.execute(csrb.getEncoded());
        
        // Wait for completion
        while (order.getStatus() != Status.VALID) {
            Thread.sleep(3000L);
            order.update();
        }
        
        // Download certificate
        Certificate certificate = order.getCertificate();
        return createSSLContext(certificate, domainKeyPair);
    }
    
    private void processChallenge(Authorization auth) throws AcmeException {
        Http01Challenge challenge = auth.findChallenge(Http01Challenge.TYPE);
        if (challenge != null) {
            // Configure web server to serve challenge
            String token = challenge.getToken();
            String content = challenge.getAuthorization();
            
            // Setup challenge endpoint
            setupChallengeEndpoint(token, content);
            
            // Trigger challenge
            challenge.trigger();
            
            // Wait for validation
            while (challenge.getStatus() != Status.VALID) {
                Thread.sleep(3000L);
                challenge.update();
            }
        }
    }
}
```

### 2. Uygulama Özellikleri Yapılandırması

**SSL/TLS protokol sürümleri** ve şifre takımı seçimi:

```yaml
server:
  ssl:
    # Certificate configuration
    key-store: ${SSL_KEYSTORE_PATH:/etc/ssl/keystore.p12}
    key-store-password: ${SSL_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: ${SSL_KEY_ALIAS:server}
    
    # Trust store configuration
    trust-store: ${SSL_TRUSTSTORE_PATH:/etc/ssl/truststore.p12}
    trust-store-password: ${SSL_TRUSTSTORE_PASSWORD}
    trust-store-type: PKCS12
    
    # Protocol configuration
    protocol: TLS
    enabled-protocols: TLSv1.2,TLSv1.3
    
    # Cipher suites (TLS 1.3)
    ciphers: 
      - TLS_AES_128_GCM_SHA256
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
      - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
      - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
    
    # Client authentication
    client-auth: want
    
    # SSL session configuration
    ssl-session-cache-size: 20000
    ssl-session-timeout: 300
    
    # OCSP stapling
    enable-ocsp-stapling: true

# HTTP to HTTPS redirect
security:
  require-ssl: true
```

**Özel SSL yapılandırması**:

```java
@Configuration
public class SSLConfig {
    
    @Bean
    public TomcatServletWebServerFactory servletContainer() {
        TomcatServletWebServerFactory tomcat = new TomcatServletWebServerFactory() {
            @Override
            protected void postProcessContext(Context context) {
                SecurityConstraint securityConstraint = new SecurityConstraint();
                securityConstraint.setUserConstraint("CONFIDENTIAL");
                SecurityCollection collection = new SecurityCollection();
                collection.addPattern("/*");
                securityConstraint.addCollection(collection);
                context.addConstraint(securityConstraint);
            }
        };
        
        tomcat.addAdditionalTomcatConnectors(redirectConnector());
        return tomcat;
    }
    
    private Connector redirectConnector() {
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        connector.setScheme("http");
        connector.setPort(8080);
        connector.setSecure(false);
        connector.setRedirectPort(8443);
        return connector;
    }
}
```

## Karşılıklı TLS (mTLS) Uygulaması

### 1. Sertifika Tabanlı Kimlik Doğrulama

**İstemci sertifikası doğrulama**:

```java
@Configuration
@EnableWebSecurity
public class MTLSSecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .x509(x509 -> x509
                .subjectPrincipalRegex("CN=(.*?)(?:,|$)")
                .userDetailsService(x509UserDetailsService())
            )
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/mtls/**").hasRole("CLIENT_CERT")
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );
        
        return http.build();
    }
    
    @Bean
    public X509UserDetailsService x509UserDetailsService() {
        return new CustomX509UserDetailsService();
    }
}
```

**Sertifika doğrulama** ve eşleme:

```java
@Service
public class CustomX509UserDetailsService implements UserDetailsService {
    
    @Autowired
    private CertificateRepository certificateRepository;
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Username is the CN from certificate subject
        ClientCertificate certificate = certificateRepository.findByCommonName(username)
                .orElseThrow(() -> new UsernameNotFoundException("Certificate not found: " + username));
        
        if (!certificate.isActive()) {
            throw new DisabledException("Certificate is disabled");
        }
        
        if (certificate.isExpired()) {
            throw new AccountExpiredException("Certificate has expired");
        }
        
        return User.builder()
                .username(username)
                .password("") // No password needed for certificate auth
                .authorities(certificate.getAuthorities())
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(false)
                .build();
    }
}
```

**X.509 Sertifika Filtresi**:

```java
@Component
public class X509CertificateFilter extends OncePerRequestFilter {
    
    @Autowired
    private CertificateValidationService certificateValidationService;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                  HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
        
        X509Certificate[] certificates = (X509Certificate[]) request
                .getAttribute("javax.servlet.request.X509Certificate");
        
        if (certificates != null && certificates.length > 0) {
            X509Certificate clientCert = certificates[0];
            
            try {
                // Validate certificate
                certificateValidationService.validate(clientCert);
                
                // Extract user information
                String commonName = extractCommonName(clientCert);
                
                // Create authentication
                PreAuthenticatedAuthenticationToken authentication = 
                    new PreAuthenticatedAuthenticationToken(commonName, clientCert, 
                        Arrays.asList(new SimpleGrantedAuthority("ROLE_CLIENT_CERT")));
                
                SecurityContextHolder.getContext().setAuthentication(authentication);
                
            } catch (CertificateException e) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }
    
    private String extractCommonName(X509Certificate certificate) {
        String subjectDN = certificate.getSubjectDN().getName();
        Pattern pattern = Pattern.compile("CN=(.*?)(?:,|$)");
        Matcher matcher = pattern.matcher(subjectDN);
        return matcher.find() ? matcher.group(1) : null;
    }
}
```

### 2. Sertifika Doğrulama Servisi

**Gelişmiş sertifika doğrulama**:

```java
@Service
public class CertificateValidationService {
    
    @Autowired
    private CertificateAuthorityService caService;
    
    @Autowired
    private CertificateRevocationService crlService;
    
    public void validate(X509Certificate certificate) throws CertificateException {
        // Check expiration
        certificate.checkValidity();
        
        // Verify certificate chain
        verifyCertificateChain(certificate);
        
        // Check certificate revocation
        if (crlService.isRevoked(certificate)) {
            throw new CertificateException("Certificate has been revoked");
        }
        
        // Custom business logic validation
        validateBusinessRules(certificate);
    }
    
    private void verifyCertificateChain(X509Certificate certificate) throws CertificateException {
        try {
            // Get CA certificate
            X509Certificate caCertificate = caService.getCACertificate();
            
            // Verify signature
            certificate.verify(caCertificate.getPublicKey());
            
            // Verify CA certificate
            caCertificate.checkValidity();
            
        } catch (Exception e) {
            throw new CertificateException("Certificate chain validation failed", e);
        }
    }
    
    private void validateBusinessRules(X509Certificate certificate) throws CertificateException {
        String subject = certificate.getSubjectDN().getName();
        
        // Check if certificate is from allowed organizations
        if (!subject.contains("O=AllowedOrg")) {
            throw new CertificateException("Certificate from unauthorized organization");
        }
        
        // Check key usage
        boolean[] keyUsage = certificate.getKeyUsage();
        if (keyUsage != null && !keyUsage[0]) { // Digital signature
            throw new CertificateException("Certificate not valid for digital signature");
        }
        
        // Check extended key usage
        try {
            List<String> extendedKeyUsage = certificate.getExtendedKeyUsage();
            if (extendedKeyUsage != null && 
                !extendedKeyUsage.contains("1.3.6.1.5.5.7.3.2")) { // Client authentication
                throw new CertificateException("Certificate not valid for client authentication");
            }
        } catch (CertificateParsingException e) {
            throw new CertificateException("Error parsing certificate extensions", e);
        }
    }
}
```

## Sertifika Yönetimi

### 1. Sertifika Otoriteleri

**Dahili CA kurulumu** OpenSSL ile:

```bash
#!/bin/bash

# Create CA directory structure
mkdir -p ca/{certs,crl,newcerts,private}
chmod 700 ca/private
touch ca/index.txt
echo 1000 > ca/serial

# Generate CA private key
openssl genrsa -aes256 -out ca/private/ca.key.pem 4096
chmod 400 ca/private/ca.key.pem

# Generate CA certificate
openssl req -config ca/openssl.cnf \
    -key ca/private/ca.key.pem \
    -new -x509 -days 7300 -sha256 -extensions v3_ca \
    -out ca/certs/ca.cert.pem

# Generate intermediate CA
openssl genrsa -aes256 -out ca/private/intermediate.key.pem 4096
chmod 400 ca/private/intermediate.key.pem

openssl req -config ca/openssl.cnf -new -sha256 \
    -key ca/private/intermediate.key.pem \
    -out ca/csr/intermediate.csr.pem

openssl ca -config ca/openssl.cnf -extensions v3_intermediate_ca \
    -days 3650 -notext -md sha256 \
    -in ca/csr/intermediate.csr.pem \
    -out ca/certs/intermediate.cert.pem

# Create certificate chain
cat ca/certs/intermediate.cert.pem \
    ca/certs/ca.cert.pem > ca/certs/ca-chain.cert.pem
```

**Sertifika imzalama iş akışı**:

```java
@Service
public class CertificateSigningService {
    
    @Autowired
    private CertificateAuthorityService caService;
    
    public X509Certificate signCertificate(PKCS10CertificationRequest csr) throws Exception {
        // Load CA private key and certificate
        PrivateKey caPrivateKey = caService.getCAPrivateKey();
        X509Certificate caCertificate = caService.getCACertificate();
        
        // Create certificate builder
        X509v3CertificateGenerator certGen = new X509v3CertificateGenerator();
        
        // Set certificate details
        certGen.setSerialNumber(BigInteger.valueOf(System.currentTimeMillis()));
        certGen.setIssuerDN(caCertificate.getSubjectX500Principal());
        certGen.setSubjectDN(csr.getSubject());
        certGen.setPublicKey(csr.getPublicKey());
        
        // Set validity period
        Date startDate = new Date();
        Date endDate = new Date(startDate.getTime() + (365L * 24 * 60 * 60 * 1000)); // 1 year
        certGen.setNotBefore(startDate);
        certGen.setNotAfter(endDate);
        
        // Set signature algorithm
        certGen.setSignatureAlgorithm("SHA256WithRSAEncryption");
        
        // Add extensions
        certGen.addExtension(X509Extensions.KeyUsage, true, 
            new KeyUsage(KeyUsage.digitalSignature | KeyUsage.keyEncipherment));
        
        certGen.addExtension(X509Extensions.ExtendedKeyUsage, true,
            new ExtendedKeyUsage(new KeyPurposeId[]{KeyPurposeId.id_kp_clientAuth}));
        
        // Generate certificate
        X509Certificate certificate = certGen.generate(caPrivateKey);
        
        // Verify the certificate
        certificate.verify(caCertificate.getPublicKey());
        
        return certificate;
    }
}
```

### 2. Sertifika Döngüsü (Rotation)

**Otomatik yenileme** cert-manager ile:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-cert
  namespace: default
spec:
  secretName: example-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - example.com
    - www.example.com
  duration: 2160h # 90 days
  renewBefore: 360h # 15 days before expiry
  subject:
    organizations:
      - example-org
  privateKey:
    algorithm: RSA
    encoding: PKCS1
    size: 2048
```

**Sıfır kesintiyle sertifika güncelleme**:

```java
@Component
public class CertificateRotationService {
    
    @Autowired
    private TomcatWebServer tomcatWebServer;
    
    @EventListener
    public void handleCertificateRenewal(CertificateRenewalEvent event) {
        try {
            // Update keystore with new certificate
            updateKeystore(event.getNewCertificate(), event.getPrivateKey());
            
            // Reload SSL configuration without downtime
            reloadSSLConfiguration();
            
            log.info("Certificate rotated successfully");
            
        } catch (Exception e) {
            log.error("Failed to rotate certificate", e);
            // Send alert for manual intervention
            alertService.sendCertificateRotationFailure(e);
        }
    }
    
    private void updateKeystore(X509Certificate certificate, PrivateKey privateKey) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        keyStore.load(new FileInputStream(keystorePath), keystorePassword.toCharArray());
        
        // Remove old certificate
        keyStore.deleteEntry(keyAlias);
        
        // Add new certificate
        Certificate[] certificateChain = {certificate};
        keyStore.setKeyEntry(keyAlias, privateKey, keyPassword.toCharArray(), certificateChain);
        
        // Save keystore
        try (FileOutputStream fos = new FileOutputStream(keystorePath)) {
            keyStore.store(fos, keystorePassword.toCharArray());
        }
    }
    
    private void reloadSSLConfiguration() {
        // Reload Tomcat SSL configuration
        Connector connector = tomcatWebServer.getTomcat().getConnector();
        ProtocolHandler protocolHandler = connector.getProtocolHandler();
        
        if (protocolHandler instanceof AbstractHttp11Protocol) {
            AbstractHttp11Protocol<?> httpProtocol = (AbstractHttp11Protocol<?>) protocolHandler;
            try {
                httpProtocol.reloadSslHostConfigs();
            } catch (Exception e) {
                log.error("Failed to reload SSL configuration", e);
            }
        }
    }
}
```

Bu kapsamlı TLS/SSL ve mTLS uygulaması, güvenli iletişim altyapısı ve sertifika yönetimi için gereken tüm bileşenleri sağlar.
