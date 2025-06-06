# TLS/SSL & mTLS - Secure Transport Implementation

Transport layer security is crucial for protecting data in transit. This chapter covers HTTPS configuration, SSL certificate management, mutual TLS (mTLS) implementation, and certificate rotation strategies in Spring Boot applications.

## HTTPS Configuration in Spring Boot

### SSL Certificate Management and KeyStore Setup

Setting up HTTPS with SSL certificates in Spring Boot:

```yaml
server:
  port: 8443
  ssl:
    enabled: true
    key-store: classpath:keystore/server-keystore.p12
    key-store-password: ${KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: server
    key-password: ${KEY_PASSWORD}
    trust-store: classpath:keystore/server-truststore.p12
    trust-store-password: ${TRUSTSTORE_PASSWORD}
    trust-store-type: PKCS12
    client-auth: want
    protocol: TLS
    enabled-protocols: TLSv1.3,TLSv1.2
    ciphers: 
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
      - TLS_AES_128_GCM_SHA256
      - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
      - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
```

### Advanced SSL Configuration

```java
@Configuration
@EnableWebSecurity
public class SSLConfiguration {
    
    @Value("${server.ssl.key-store}")
    private String keyStorePath;
    
    @Value("${server.ssl.key-store-password}")
    private String keyStorePassword;
    
    @Value("${server.ssl.trust-store}")
    private String trustStorePath;
    
    @Value("${server.ssl.trust-store-password}")
    private String trustStorePassword;
    
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
    
    @Bean
    public SSLContext sslContext() throws Exception {
        // Load KeyStore
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (InputStream keyStoreInputStream = getClass().getClassLoader()
                .getResourceAsStream(keyStorePath.replace("classpath:", ""))) {
            keyStore.load(keyStoreInputStream, keyStorePassword.toCharArray());
        }
        
        // Initialize KeyManagerFactory
        KeyManagerFactory keyManagerFactory = KeyManagerFactory.getInstance(
            KeyManagerFactory.getDefaultAlgorithm());
        keyManagerFactory.init(keyStore, keyStorePassword.toCharArray());
        
        // Load TrustStore
        KeyStore trustStore = KeyStore.getInstance("PKCS12");
        try (InputStream trustStoreInputStream = getClass().getClassLoader()
                .getResourceAsStream(trustStorePath.replace("classpath:", ""))) {
            trustStore.load(trustStoreInputStream, trustStorePassword.toCharArray());
        }
        
        // Initialize TrustManagerFactory
        TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm());
        trustManagerFactory.init(trustStore);
        
        // Create SSL Context
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(
            keyManagerFactory.getKeyManagers(),
            trustManagerFactory.getTrustManagers(),
            new SecureRandom()
        );
        
        return sslContext;
    }
}
```

### Self-Signed Certificates for Development

Creating self-signed certificates using OpenSSL:

```bash
#!/bin/bash

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request
openssl req -new -key server.key -out server.csr -config <(
cat <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
C=US
ST=California
L=San Francisco
O=MyCompany
OU=Development
CN=localhost

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Generate self-signed certificate
openssl x509 -req -in server.csr -signkey server.key -out server.crt -days 365 \
    -extensions req_ext -extfile <(
cat <<EOF
[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Convert to PKCS12 format
openssl pkcs12 -export -in server.crt -inkey server.key -out server-keystore.p12 \
    -name server -passout pass:changeit

# Create truststore
keytool -import -alias server -file server.crt -keystore server-truststore.p12 \
    -storetype PKCS12 -storepass changeit -noprompt

echo "SSL certificates generated successfully!"
```

### Let's Encrypt Integration

```java
@Component
public class LetsEncryptCertificateManager {
    
    private final AcmeClient acmeClient;
    private final DomainValidator domainValidator;
    
    public LetsEncryptCertificateManager(AcmeClient acmeClient, 
                                       DomainValidator domainValidator) {
        this.acmeClient = acmeClient;
        this.domainValidator = domainValidator;
    }
    
    public Certificate obtainCertificate(String domain) throws AcmeException {
        // Create account if not exists
        Account account = getOrCreateAccount();
        
        // Create order for domain
        Order order = account.newOrder()
            .domains(domain)
            .create();
        
        // Process authorizations
        for (Authorization auth : order.getAuthorizations()) {
            processAuthorization(auth);
        }
        
        // Generate key pair for certificate
        KeyPair domainKeyPair = KeyPairUtils.createKeyPair(2048);
        
        // Request certificate
        order.execute(domainKeyPair);
        
        // Wait for certificate to be ready
        waitForCertificate(order);
        
        // Download certificate
        Certificate certificate = order.getCertificate();
        
        // Store certificate
        storeCertificate(domain, certificate, domainKeyPair);
        
        return certificate;
    }
    
    private Account getOrCreateAccount() throws AcmeException {
        KeyPair accountKeyPair = loadOrCreateAccountKeyPair();
        
        return new AccountBuilder()
            .agreeToTermsOfService()
            .useKeyPair(accountKeyPair)
            .create(acmeClient.getSession());
    }
    
    private void processAuthorization(Authorization auth) throws AcmeException {
        String domain = auth.getIdentifier().getDomain();
        
        // Find HTTP challenge
        Http01Challenge challenge = auth.findChallenge(Http01Challenge.TYPE);
        if (challenge == null) {
            throw new AcmeException("HTTP challenge not found for domain: " + domain);
        }
        
        // Setup challenge response
        domainValidator.setupChallengeResponse(
            challenge.getToken(), 
            challenge.getAuthorization()
        );
        
        // Trigger challenge
        challenge.trigger();
        
        // Wait for validation
        waitForValidation(challenge);
    }
    
    private void waitForValidation(Challenge challenge) throws AcmeException {
        int attempts = 10;
        while (challenge.getStatus() != Status.VALID && attempts-- > 0) {
            if (challenge.getStatus() == Status.INVALID) {
                throw new AcmeException("Challenge failed: " + challenge.getError());
            }
            
            try {
                Thread.sleep(3000L);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new AcmeException("Validation interrupted", ex);
            }
            
            challenge.update();
        }
        
        if (challenge.getStatus() != Status.VALID) {
            throw new AcmeException("Challenge validation timeout");
        }
    }
    
    private void storeCertificate(String domain, Certificate certificate, KeyPair keyPair) {
        try {
            // Store private key
            Path keyPath = Paths.get("certificates", domain + ".key");
            Files.createDirectories(keyPath.getParent());
            
            try (FileWriter writer = new FileWriter(keyPath.toFile())) {
                writer.write(KeyPairUtils.getPrivateKeyPem(keyPair));
            }
            
            // Store certificate chain
            Path certPath = Paths.get("certificates", domain + ".crt");
            try (FileWriter writer = new FileWriter(certPath.toFile())) {
                certificate.writeTo(writer);
            }
            
            log.info("Certificate stored for domain: {}", domain);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store certificate", e);
        }
    }
}
```

## Mutual TLS (mTLS) Implementation

### Certificate-Based Authentication

```java
@Configuration
public class MutualTLSConfiguration {
    
    @Bean
    public X509AuthenticationProvider x509AuthenticationProvider() {
        X509AuthenticationProvider provider = new X509AuthenticationProvider();
        provider.setX509AuthoritiesPopulator(x509AuthoritiesPopulator());
        return provider;
    }
    
    @Bean
    public X509AuthoritiesPopulator x509AuthoritiesPopulator() {
        return new X509AuthoritiesPopulator() {
            @Override
            public Collection<? extends GrantedAuthority> getGrantedAuthorities(
                    X509Certificate userCert) {
                
                String clientCN = getCommonName(userCert);
                
                // Map certificate CN to authorities
                if (clientCN.startsWith("admin-")) {
                    return Arrays.asList(
                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("ROLE_USER")
                    );
                } else if (clientCN.startsWith("service-")) {
                    return Arrays.asList(
                        new SimpleGrantedAuthority("ROLE_SERVICE")
                    );
                } else {
                    return Arrays.asList(
                        new SimpleGrantedAuthority("ROLE_USER")
                    );
                }
            }
        };
    }
    
    @Bean
    public PreAuthenticatedAuthenticationProvider preAuthenticatedProvider() {
        PreAuthenticatedAuthenticationProvider provider = 
            new PreAuthenticatedAuthenticationProvider();
        provider.setPreAuthenticatedUserDetailsService(
            new X509UserDetailsService(x509AuthoritiesPopulator())
        );
        return provider;
    }
    
    private String getCommonName(X509Certificate certificate) {
        String dn = certificate.getSubjectX500Principal().getName();
        for (String part : dn.split(",")) {
            if (part.trim().startsWith("CN=")) {
                return part.trim().substring(3);
            }
        }
        return "unknown";
    }
}
```

### X.509 Certificate Filter

```java
@Component
public class X509CertificateFilter extends AbstractPreAuthenticatedProcessingFilter {
    
    private final CertificateValidator certificateValidator;
    
    public X509CertificateFilter(CertificateValidator certificateValidator) {
        this.certificateValidator = certificateValidator;
        setAuthenticationManager(new NoOpAuthenticationManager());
    }
    
    @Override
    protected Object getPreAuthenticatedPrincipal(HttpServletRequest request) {
        X509Certificate[] certificates = extractCertificates(request);
        
        if (certificates == null || certificates.length == 0) {
            return null;
        }
        
        X509Certificate clientCert = certificates[0];
        
        // Validate certificate
        if (!certificateValidator.validate(clientCert)) {
            throw new BadCredentialsException("Invalid client certificate");
        }
        
        return clientCert.getSubjectX500Principal().getName();
    }
    
    @Override
    protected Object getPreAuthenticatedCredentials(HttpServletRequest request) {
        X509Certificate[] certificates = extractCertificates(request);
        return certificates != null ? certificates[0] : null;
    }
    
    private X509Certificate[] extractCertificates(HttpServletRequest request) {
        return (X509Certificate[]) request.getAttribute(
            "jakarta.servlet.request.X509Certificate"
        );
    }
}
```

### Certificate Validation Service

```java
@Service
public class CertificateValidator {
    
    private final CertificateRepository certificateRepository;
    private final CRLService crlService;
    private final OCSPService ocspService;
    
    public CertificateValidator(CertificateRepository certificateRepository,
                              CRLService crlService,
                              OCSPService ocspService) {
        this.certificateRepository = certificateRepository;
        this.crlService = crlService;
        this.ocspService = ocspService;
    }
    
    public boolean validate(X509Certificate certificate) {
        try {
            // Check certificate validity period
            certificate.checkValidity();
            
            // Check if certificate is in our trusted store
            if (!isTrustedCertificate(certificate)) {
                log.warn("Certificate not in trusted store: {}", 
                    certificate.getSubjectX500Principal().getName());
                return false;
            }
            
            // Check certificate revocation status
            if (isRevoked(certificate)) {
                log.warn("Certificate is revoked: {}", 
                    certificate.getSubjectX500Principal().getName());
                return false;
            }
            
            // Additional custom validation
            return performCustomValidation(certificate);
            
        } catch (CertificateExpiredException | CertificateNotYetValidException e) {
            log.error("Certificate validity check failed", e);
            return false;
        }
    }
    
    private boolean isTrustedCertificate(X509Certificate certificate) {
        String fingerprint = calculateFingerprint(certificate);
        return certificateRepository.existsByFingerprint(fingerprint);
    }
    
    private boolean isRevoked(X509Certificate certificate) {
        // Check CRL
        if (crlService.isRevoked(certificate)) {
            return true;
        }
        
        // Check OCSP
        return ocspService.isRevoked(certificate);
    }
    
    private boolean performCustomValidation(X509Certificate certificate) {
        // Check key usage
        boolean[] keyUsage = certificate.getKeyUsage();
        if (keyUsage != null && !keyUsage[0]) { // Digital signature
            log.warn("Certificate does not allow digital signature");
            return false;
        }
        
        // Check extended key usage
        try {
            List<String> extendedKeyUsage = certificate.getExtendedKeyUsage();
            if (extendedKeyUsage != null && 
                !extendedKeyUsage.contains("1.3.6.1.5.5.7.3.2")) { // Client authentication
                log.warn("Certificate not valid for client authentication");
                return false;
            }
        } catch (CertificateParsingException e) {
            log.error("Failed to parse extended key usage", e);
            return false;
        }
        
        return true;
    }
    
    private String calculateFingerprint(X509Certificate certificate) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(certificate.getEncoded());
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate certificate fingerprint", e);
        }
    }
}
```

## Advanced Certificate Management

### Certificate Rotation Strategy

```java
@Service
public class CertificateRotationService {
    
    private final CertificateStore certificateStore;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    
    @Value("${certificate.rotation.days-before-expiry:30}")
    private int daysBeforeExpiry;
    
    public CertificateRotationService(CertificateStore certificateStore,
                                    NotificationService notificationService,
                                    ApplicationEventPublisher eventPublisher) {
        this.certificateStore = certificateStore;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
    }
    
    @Scheduled(cron = "0 0 1 * * ?") // Daily at 1 AM
    public void checkCertificateExpiry() {
        List<CertificateInfo> certificates = certificateStore.getAllCertificates();
        
        for (CertificateInfo cert : certificates) {
            if (isNearExpiry(cert)) {
                handleNearExpiryCertificate(cert);
            }
        }
    }
    
    private boolean isNearExpiry(CertificateInfo certificate) {
        LocalDate expiryDate = certificate.getExpiryDate();
        LocalDate checkDate = LocalDate.now().plusDays(daysBeforeExpiry);
        return expiryDate.isBefore(checkDate);
    }
    
    private void handleNearExpiryCertificate(CertificateInfo certificate) {
        log.info("Certificate nearing expiry: {}", certificate.getCommonName());
        
        try {
            // Attempt automatic renewal
            if (certificate.isAutoRenewable()) {
                renewCertificate(certificate);
            } else {
                // Send notification for manual renewal
                notificationService.sendCertificateExpiryNotification(certificate);
            }
        } catch (Exception e) {
            log.error("Failed to handle certificate rotation for: {}", 
                certificate.getCommonName(), e);
            notificationService.sendCertificateRotationFailureNotification(certificate, e);
        }
    }
    
    @Async
    public void renewCertificate(CertificateInfo certificateInfo) {
        try {
            log.info("Starting certificate renewal for: {}", certificateInfo.getCommonName());
            
            // Generate new certificate
            X509Certificate newCertificate = generateNewCertificate(certificateInfo);
            
            // Validate new certificate
            if (!validateNewCertificate(newCertificate)) {
                throw new CertificateException("New certificate validation failed");
            }
            
            // Store new certificate
            certificateStore.storeCertificate(certificateInfo.getCommonName(), newCertificate);
            
            // Schedule old certificate removal
            scheduleOldCertificateRemoval(certificateInfo);
            
            // Publish rotation event
            eventPublisher.publishEvent(new CertificateRotatedEvent(
                certificateInfo.getCommonName(), 
                certificateInfo.getExpiryDate(),
                newCertificate.getNotAfter().toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
            ));
            
            log.info("Certificate renewal completed for: {}", certificateInfo.getCommonName());
            
        } catch (Exception e) {
            log.error("Certificate renewal failed for: {}", certificateInfo.getCommonName(), e);
            throw new CertificateRotationException("Certificate renewal failed", e);
        }
    }
    
    private X509Certificate generateNewCertificate(CertificateInfo certificateInfo) 
            throws Exception {
        // Implementation depends on certificate type (Let's Encrypt, internal CA, etc.)
        if (certificateInfo.getIssuer().equals("Let's Encrypt")) {
            return renewLetsEncryptCertificate(certificateInfo);
        } else {
            return renewInternalCertificate(certificateInfo);
        }
    }
    
    private boolean validateNewCertificate(X509Certificate certificate) {
        try {
            // Check validity
            certificate.checkValidity();
            
            // Check key usage
            return certificate.getKeyUsage() != null && certificate.getKeyUsage()[0];
            
        } catch (CertificateException e) {
            log.error("Certificate validation failed", e);
            return false;
        }
    }
    
    @Async
    @EventListener
    public void handleCertificateRotated(CertificateRotatedEvent event) {
        // Update application configuration
        updateSSLConfiguration(event.getCommonName());
        
        // Notify monitoring systems
        notificationService.sendCertificateRenewalSuccessNotification(event);
        
        // Update load balancer configuration if applicable
        updateLoadBalancerCertificate(event.getCommonName());
    }
}
```

### Zero-Downtime Certificate Updates

```java
@Component
public class GracefulCertificateUpdater {
    
    private final TomcatWebServer tomcatWebServer;
    private final CertificateStore certificateStore;
    
    public GracefulCertificateUpdater(TomcatWebServer tomcatWebServer,
                                    CertificateStore certificateStore) {
        this.tomcatWebServer = tomcatWebServer;
        this.certificateStore = certificateStore;
    }
    
    public void updateCertificateWithoutDowntime(String commonName, 
                                               X509Certificate newCertificate,
                                               PrivateKey privateKey) throws Exception {
        
        // Get Tomcat connector
        Connector connector = tomcatWebServer.getTomcat()
            .getService()
            .findConnectors()[0]; // HTTPS connector
        
        ProtocolHandler protocolHandler = connector.getProtocolHandler();
        
        if (protocolHandler instanceof AbstractHttp11JsseProtocol) {
            AbstractHttp11JsseProtocol<?> jsseProtocol = 
                (AbstractHttp11JsseProtocol<?>) protocolHandler;
            
            // Create new SSL context with updated certificate
            SSLContext newSSLContext = createSSLContext(newCertificate, privateKey);
            
            // Update SSL context on the connector
            jsseProtocol.setSslContext(newSSLContext);
            
            // Store new certificate
            certificateStore.storeCertificate(commonName, newCertificate);
            
            log.info("Certificate updated without downtime for: {}", commonName);
        } else {
            throw new UnsupportedOperationException(
                "Protocol handler does not support runtime SSL context updates");
        }
    }
    
    private SSLContext createSSLContext(X509Certificate certificate, PrivateKey privateKey) 
            throws Exception {
        
        // Create keystore with new certificate
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        keyStore.load(null, null);
        
        Certificate[] certificateChain = {certificate};
        keyStore.setKeyEntry("server", privateKey, "changeit".toCharArray(), certificateChain);
        
        // Initialize key manager
        KeyManagerFactory keyManagerFactory = KeyManagerFactory.getInstance(
            KeyManagerFactory.getDefaultAlgorithm());
        keyManagerFactory.init(keyStore, "changeit".toCharArray());
        
        // Create SSL context
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(keyManagerFactory.getKeyManagers(), null, new SecureRandom());
        
        return sslContext;
    }
}
```

### OpenSSL CA Setup

Setting up a Certificate Authority with OpenSSL:

```bash
#!/bin/bash

# Create CA directory structure
mkdir -p ca/{certs,crl,newcerts,private}
cd ca

# Initialize CA database
touch index.txt
echo 1000 > serial
echo 1000 > crlnumber

# Create CA configuration
cat > openssl.cnf << EOF
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = .
certs             = \$dir/certs
crl_dir           = \$dir/crl
new_certs_dir     = \$dir/newcerts
database          = \$dir/index.txt
serial            = \$dir/serial
RANDFILE          = \$dir/private/.rand

private_key       = \$dir/private/ca.key.pem
certificate       = \$dir/certs/ca.cert.pem

crlnumber         = \$dir/crlnumber
crl               = \$dir/crl/ca.crl.pem
crl_extensions    = crl_ext
default_crl_days  = 30

default_md        = sha256
name_opt          = ca_default
cert_opt          = ca_default
default_days      = 375
preserve          = no
policy            = policy_strict

[ policy_strict ]
countryName             = match
stateOrProvinceName     = match
organizationName        = match
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ req ]
default_bits        = 2048
distinguished_name  = req_distinguished_name
string_mask         = utf8only
default_md          = sha256
x509_extensions     = v3_ca

[ req_distinguished_name ]
countryName                     = Country Name (2 letter code)
stateOrProvinceName             = State or Province Name
localityName                    = Locality Name
0.organizationName              = Organization Name
organizationalUnitName          = Organizational Unit Name
commonName                      = Common Name
emailAddress                    = Email Address

[ v3_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[ server_cert ]
basicConstraints = CA:FALSE
nsCertType = server
nsComment = "OpenSSL Generated Server Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ crl_ext ]
authorityKeyIdentifier=keyid:always
EOF

# Generate CA private key
openssl genrsa -aes256 -out private/ca.key.pem 4096
chmod 400 private/ca.key.pem

# Generate CA certificate
openssl req -config openssl.cnf -key private/ca.key.pem \
    -new -x509 -days 7300 -sha256 -extensions v3_ca \
    -out certs/ca.cert.pem

chmod 444 certs/ca.cert.pem

echo "Certificate Authority setup completed!"
```

This comprehensive TLS/SSL and mTLS implementation provides secure transport layer protection for Spring Boot applications with proper certificate management and rotation capabilities.
