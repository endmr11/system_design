# Containers (Docker)

## Introduction

Containers are lightweight, portable, and self-sufficient packages that include everything needed to run an application: code, runtime, system tools, libraries, and settings. Docker is the most popular containerization platform that enables developers to package applications into containers.

## Docker Fundamentals

### Docker Architecture

```bash
# Docker daemon (dockerd)
sudo systemctl start docker
sudo systemctl enable docker

# Docker client commands
docker version
docker info
docker --help

# Container lifecycle
docker create --name my-container nginx
docker start my-container
docker stop my-container
docker restart my-container
docker pause my-container
docker unpause my-container
docker rm my-container

# Image management
docker images
docker pull nginx:latest
docker push myregistry/myapp:v1.0.0
docker rmi nginx:latest
docker image prune
```

## Dockerfile Best Practices

### Multi-stage Dockerfile Example

```dockerfile
# Dockerfile
# Stage 1: Build stage
FROM maven:3.8.4-openjdk-11-slim AS builder

WORKDIR /app

# Copy dependency files first for better caching
COPY pom.xml .
COPY src/main/resources/application.yml src/main/resources/

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime stage
FROM openjdk:11-jre-slim

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install necessary packages and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/logs /app/temp && \
    chown -R appuser:appuser /app

# Copy JAR from builder stage
COPY --from=builder /app/target/my-web-app-1.0.0.jar app.jar

# Copy configuration files
COPY --chown=appuser:appuser docker/application-docker.yml application.yml
COPY --chown=appuser:appuser docker/entrypoint.sh entrypoint.sh

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Expose port
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
```

### Optimized Spring Boot Dockerfile

```dockerfile
# Dockerfile.layered
FROM openjdk:11-jre-slim

# Create non-root user
RUN groupadd -r spring && useradd -r -g spring spring

# Install required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy layered JAR contents (Spring Boot 2.3+)
COPY --chown=spring:spring target/extracted/dependencies/ ./
COPY --chown=spring:spring target/extracted/spring-boot-loader/ ./
COPY --chown=spring:spring target/extracted/snapshot-dependencies/ ./
COPY --chown=spring:spring target/extracted/application/ ./

# Copy configuration
COPY --chown=spring:spring docker/application-docker.yml application.yml

# Switch to non-root user
USER spring

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["java", "-Dspring.profiles.active=docker", "org.springframework.boot.loader.JarLauncher"]
```

### Entrypoint Script

```bash
#!/bin/bash
# docker/entrypoint.sh

set -e

# Default JVM options
DEFAULT_JVM_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC -XX:+UseContainerSupport"

# Use custom JVM options if provided
JVM_OPTS=${JVM_OPTS:-$DEFAULT_JVM_OPTS}

# Default Spring profiles
SPRING_PROFILES=${SPRING_PROFILES_ACTIVE:-docker}

# Wait for database to be ready
if [ -n "$DATABASE_HOST" ]; then
    echo "Waiting for database at $DATABASE_HOST:${DATABASE_PORT:-5432}..."
    while ! nc -z "$DATABASE_HOST" "${DATABASE_PORT:-5432}"; do
        sleep 1
    done
    echo "Database is ready!"
fi

# Start the application
exec java $JVM_OPTS \
    -Djava.security.egd=file:/dev/./urandom \
    -Dspring.profiles.active="$SPRING_PROFILES" \
    -jar app.jar "$@"
```

## Docker Compose Configuration

### Complete Multi-Service Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  web-app:
    build:
      context: .
      dockerfile: Dockerfile
    image: myregistry/web-app:1.0.0
    container_name: web-app
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - DATABASE_URL=jdbc:postgresql://postgres:5432/myapp
      - DATABASE_USERNAME=postgres
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - app-logs:/app/logs
      - app-temp:/app/temp
    secrets:
      - db_password
      - jwt_secret
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:13
    container_name: postgres-db
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    secrets:
      - db_password
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:6-alpine
    container_name: redis-cache
    command: redis-server --appendonly yes --requirepass "$(cat /run/secrets/redis_password)"
    volumes:
      - redis-data:/data
    secrets:
      - redis_password
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro
      - nginx-logs:/var/log/nginx
    depends_on:
      - web-app
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  app-logs:
    driver: local
  app-temp:
    driver: local
  nginx-logs:
    driver: local

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  redis_password:
    file: ./secrets/redis_password.txt

networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Development Override

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  web-app:
    build:
      target: development
    environment:
      - SPRING_PROFILES_ACTIVE=development
      - DEBUG=true
    volumes:
      - .:/app
      - ~/.m2:/root/.m2
    ports:
      - "5005:5005" # Debug port
    command: ["./mvnw", "spring-boot:run", "-Dspring-boot.run.jvmArguments=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"]

  postgres:
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=myapp_dev

  redis:
    ports:
      - "6379:6379"
```

### Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  web-app:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
        window: 120s
    environment:
      - SPRING_PROFILES_ACTIVE=production
      - JVM_OPTS=-Xmx768m -Xms512m -XX:+UseG1GC
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "fluentd:24224"
        tag: "docker.web-app"

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    volumes:
      - /data/postgres:/var/lib/postgresql/data

  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Container Security Implementation

### Security Configuration Service

```java
// ContainerSecurityService.java
package com.mycompany.security;

import org.springframework.boot.actuate.security.AuthenticationAuditListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@Configuration
@EnableWebSecurity
public class ContainerSecurityConfig {
    
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    
    public ContainerSecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            CustomAuthenticationEntryPoint authenticationEntryPoint) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .and()
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling()
                .authenticationEntryPoint(authenticationEntryPoint)
            .and()
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .headers(headers -> headers
                .frameOptions().deny()
                .contentTypeOptions().and()
                .httpStrictTransportSecurity(hstsConfig -> hstsConfig
                    .maxAgeInSeconds(31536000)
                    .includeSubdomains(true)
                )
                .and()
            );
        
        return http.build();
    }
    
    @Bean
    public AuthenticationAuditListener authenticationAuditListener() {
        return new AuthenticationAuditListener();
    }
}

// Container environment security
@Component
public class ContainerEnvironmentValidator {
    
    private static final Logger logger = LoggerFactory.getLogger(ContainerEnvironmentValidator.class);
    
    @PostConstruct
    public void validateSecurityConfiguration() {
        validateFilePermissions();
        validateNetworkConfiguration();
        validateEnvironmentVariables();
        validateSecrets();
    }
    
    private void validateFilePermissions() {
        try {
            Path appDir = Paths.get("/app");
            Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(appDir);
            
            if (permissions.contains(PosixFilePermission.OTHERS_WRITE)) {
                logger.warn("Application directory has world-write permissions");
            }
            
            // Check for sensitive files
            Files.walk(appDir)
                .filter(path -> path.toString().contains("secret") || 
                               path.toString().contains("password"))
                .forEach(this::checkFilePermissions);
                
        } catch (IOException e) {
            logger.error("Error validating file permissions", e);
        }
    }
    
    private void checkFilePermissions(Path file) {
        try {
            Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(file);
            if (permissions.contains(PosixFilePermission.OTHERS_READ) ||
                permissions.contains(PosixFilePermission.OTHERS_WRITE)) {
                logger.warn("Sensitive file {} has permissive permissions: {}", 
                           file, permissions);
            }
        } catch (IOException e) {
            logger.error("Error checking permissions for file: " + file, e);
        }
    }
    
    private void validateNetworkConfiguration() {
        // Validate network interfaces and exposed ports
        String exposedPorts = System.getenv("EXPOSED_PORTS");
        if (exposedPorts != null) {
            logger.info("Container exposed ports: {}", exposedPorts);
        }
    }
    
    private void validateEnvironmentVariables() {
        Map<String, String> env = System.getenv();
        
        // Check for sensitive data in environment variables
        env.entrySet().stream()
            .filter(entry -> entry.getKey().toLowerCase().contains("password") ||
                           entry.getKey().toLowerCase().contains("secret") ||
                           entry.getKey().toLowerCase().contains("key"))
            .forEach(entry -> {
                if (!entry.getKey().endsWith("_FILE")) {
                    logger.warn("Potential sensitive data in environment variable: {}", 
                               entry.getKey());
                }
            });
    }
    
    private void validateSecrets() {
        // Validate that secrets are properly mounted
        Path secretsDir = Paths.get("/run/secrets");
        if (Files.exists(secretsDir)) {
            try {
                Files.list(secretsDir)
                    .forEach(secret -> logger.info("Secret file available: {}", 
                                                  secret.getFileName()));
            } catch (IOException e) {
                logger.error("Error reading secrets directory", e);
            }
        }
    }
}
```

## Docker Registry Implementation

### Private Registry Service

```java
// DockerRegistryService.java
package com.mycompany.registry;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.util.Base64Utils;

import java.util.*;

@Service
public class DockerRegistryService {
    
    private final RestTemplate restTemplate;
    private final String registryUrl;
    private final String username;
    private final String password;
    
    public DockerRegistryService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.registryUrl = System.getenv("REGISTRY_URL");
        this.username = System.getenv("REGISTRY_USERNAME");
        this.password = System.getenv("REGISTRY_PASSWORD");
    }
    
    public void pushImage(String imageName, String tag, byte[] imageData) {
        try {
            // Authenticate with registry
            String authToken = authenticate();
            
            // Upload image layers
            String uploadUrl = initiateUpload(imageName, authToken);
            uploadImageLayers(uploadUrl, imageData, authToken);
            
            // Create and upload manifest
            String manifest = createManifest(imageName, tag);
            uploadManifest(imageName, tag, manifest, authToken);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to push image to registry", e);
        }
    }
    
    public ImageMetadata pullImageMetadata(String imageName, String tag) {
        try {
            String authToken = authenticate();
            String manifestUrl = String.format("%s/v2/%s/manifests/%s", 
                                              registryUrl, imageName, tag);
            
            HttpHeaders headers = createAuthHeaders(authToken);
            headers.add("Accept", "application/vnd.docker.distribution.manifest.v2+json");
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                manifestUrl, HttpMethod.GET, entity, String.class);
            
            return parseManifest(response.getBody());
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to pull image metadata", e);
        }
    }
    
    public List<String> listRepositories() {
        try {
            String authToken = authenticate();
            String catalogUrl = registryUrl + "/v2/_catalog";
            
            HttpHeaders headers = createAuthHeaders(authToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<RepositoryCatalog> response = restTemplate.exchange(
                catalogUrl, HttpMethod.GET, entity, RepositoryCatalog.class);
            
            return response.getBody().getRepositories();
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to list repositories", e);
        }
    }
    
    public List<String> listTags(String repositoryName) {
        try {
            String authToken = authenticate();
            String tagsUrl = String.format("%s/v2/%s/tags/list", registryUrl, repositoryName);
            
            HttpHeaders headers = createAuthHeaders(authToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<TagsList> response = restTemplate.exchange(
                tagsUrl, HttpMethod.GET, entity, TagsList.class);
            
            return response.getBody().getTags();
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to list tags for repository: " + repositoryName, e);
        }
    }
    
    public void deleteImage(String imageName, String tag) {
        try {
            String authToken = authenticate();
            
            // Get manifest digest
            String digest = getManifestDigest(imageName, tag, authToken);
            
            // Delete manifest
            String deleteUrl = String.format("%s/v2/%s/manifests/%s", 
                                            registryUrl, imageName, digest);
            
            HttpHeaders headers = createAuthHeaders(authToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            restTemplate.exchange(deleteUrl, HttpMethod.DELETE, entity, Void.class);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete image", e);
        }
    }
    
    private String authenticate() {
        String authUrl = registryUrl + "/v2/token";
        String credentials = username + ":" + password;
        String encodedCredentials = Base64Utils.encodeToString(credentials.getBytes());
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Basic " + encodedCredentials);
        
        HttpEntity<String> entity = new HttpEntity<>(headers);
        ResponseEntity<AuthResponse> response = restTemplate.exchange(
            authUrl, HttpMethod.GET, entity, AuthResponse.class);
        
        return response.getBody().getToken();
    }
    
    private HttpHeaders createAuthHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Bearer " + token);
        return headers;
    }
    
    private String initiateUpload(String imageName, String authToken) {
        String uploadUrl = String.format("%s/v2/%s/blobs/uploads/", registryUrl, imageName);
        
        HttpHeaders headers = createAuthHeaders(authToken);
        HttpEntity<String> entity = new HttpEntity<>(headers);
        
        ResponseEntity<String> response = restTemplate.exchange(
            uploadUrl, HttpMethod.POST, entity, String.class);
        
        return response.getHeaders().getLocation().toString();
    }
    
    private void uploadImageLayers(String uploadUrl, byte[] imageData, String authToken) {
        HttpHeaders headers = createAuthHeaders(authToken);
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        
        HttpEntity<byte[]> entity = new HttpEntity<>(imageData, headers);
        restTemplate.exchange(uploadUrl, HttpMethod.PUT, entity, Void.class);
    }
    
    private String createManifest(String imageName, String tag) {
        // Create Docker manifest v2 format
        Map<String, Object> manifest = new HashMap<>();
        manifest.put("schemaVersion", 2);
        manifest.put("mediaType", "application/vnd.docker.distribution.manifest.v2+json");
        
        // Add config and layers
        return new ObjectMapper().writeValueAsString(manifest);
    }
    
    private void uploadManifest(String imageName, String tag, String manifest, String authToken) {
        String manifestUrl = String.format("%s/v2/%s/manifests/%s", registryUrl, imageName, tag);
        
        HttpHeaders headers = createAuthHeaders(authToken);
        headers.setContentType(MediaType.valueOf("application/vnd.docker.distribution.manifest.v2+json"));
        
        HttpEntity<String> entity = new HttpEntity<>(manifest, headers);
        restTemplate.exchange(manifestUrl, HttpMethod.PUT, entity, Void.class);
    }
    
    private String getManifestDigest(String imageName, String tag, String authToken) {
        String manifestUrl = String.format("%s/v2/%s/manifests/%s", registryUrl, imageName, tag);
        
        HttpHeaders headers = createAuthHeaders(authToken);
        headers.add("Accept", "application/vnd.docker.distribution.manifest.v2+json");
        
        HttpEntity<String> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(
            manifestUrl, HttpMethod.HEAD, entity, String.class);
        
        return response.getHeaders().getFirst("Docker-Content-Digest");
    }
    
    private ImageMetadata parseManifest(String manifestJson) {
        // Parse manifest and extract metadata
        return new ImageMetadata();
    }
    
    // DTOs
    static class AuthResponse {
        private String token;
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
    }
    
    static class RepositoryCatalog {
        private List<String> repositories;
        public List<String> getRepositories() { return repositories; }
        public void setRepositories(List<String> repositories) { this.repositories = repositories; }
    }
    
    static class TagsList {
        private List<String> tags;
        public List<String> getTags() { return tags; }
        public void setTags(List<String> tags) { this.tags = tags; }
    }
    
    static class ImageMetadata {
        private String digest;
        private long size;
        private Date createdAt;
        
        // Getters and setters
        public String getDigest() { return digest; }
        public void setDigest(String digest) { this.digest = digest; }
        
        public long getSize() { return size; }
        public void setSize(long size) { this.size = size; }
        
        public Date getCreatedAt() { return createdAt; }
        public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    }
}
```

## Container Health Monitoring

### Health Check Service

```java
// ContainerHealthService.java
package com.mycompany.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

@Component
public class ContainerHealthIndicator implements HealthIndicator {
    
    @Override
    public Health health() {
        Map<String, Object> details = new HashMap<>();
        
        try {
            // Check container resources
            checkMemoryUsage(details);
            checkDiskSpace(details);
            checkFileDescriptors(details);
            checkNetworkConnectivity(details);
            
            // All checks passed
            return Health.up()
                .withDetails(details)
                .build();
                
        } catch (Exception e) {
            return Health.down()
                .withException(e)
                .withDetails(details)
                .build();
        }
    }
    
    private void checkMemoryUsage(Map<String, Object> details) {
        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        long maxMemory = runtime.maxMemory();
        
        double memoryUsagePercent = (double) usedMemory / maxMemory * 100;
        
        details.put("memory.used", usedMemory);
        details.put("memory.total", totalMemory);
        details.put("memory.max", maxMemory);
        details.put("memory.usage.percent", Math.round(memoryUsagePercent * 100.0) / 100.0);
        
        if (memoryUsagePercent > 90) {
            throw new RuntimeException("Memory usage too high: " + memoryUsagePercent + "%");
        }
    }
    
    private void checkDiskSpace(Map<String, Object> details) throws IOException {
        Path appPath = Paths.get("/app");
        long totalSpace = Files.getFileStore(appPath).getTotalSpace();
        long usableSpace = Files.getFileStore(appPath).getUsableSpace();
        long usedSpace = totalSpace - usableSpace;
        
        double diskUsagePercent = (double) usedSpace / totalSpace * 100;
        
        details.put("disk.used", usedSpace);
        details.put("disk.total", totalSpace);
        details.put("disk.usable", usableSpace);
        details.put("disk.usage.percent", Math.round(diskUsagePercent * 100.0) / 100.0);
        
        if (diskUsagePercent > 95) {
            throw new RuntimeException("Disk usage too high: " + diskUsagePercent + "%");
        }
    }
    
    private void checkFileDescriptors(Map<String, Object> details) throws IOException {
        try {
            Path fdPath = Paths.get("/proc/self/fd");
            long openFileDescriptors = Files.list(fdPath).count();
            
            details.put("file.descriptors.open", openFileDescriptors);
            
            // Check for file descriptor leaks
            if (openFileDescriptors > 1000) {
                throw new RuntimeException("Too many open file descriptors: " + openFileDescriptors);
            }
            
        } catch (IOException e) {
            // If we can't read /proc (non-Linux), skip this check
            details.put("file.descriptors.check", "skipped");
        }
    }
    
    private void checkNetworkConnectivity(Map<String, Object> details) {
        // Check connectivity to essential services
        boolean databaseConnectable = checkService("DATABASE_HOST", 5432);
        boolean redisConnectable = checkService("REDIS_HOST", 6379);
        
        details.put("network.database.connected", databaseConnectable);
        details.put("network.redis.connected", redisConnectable);
        
        if (!databaseConnectable) {
            throw new RuntimeException("Cannot connect to database");
        }
    }
    
    private boolean checkService(String hostEnv, int port) {
        String host = System.getenv(hostEnv);
        if (host == null) {
            return true; // Skip check if not configured
        }
        
        try (java.net.Socket socket = new java.net.Socket()) {
            socket.connect(new java.net.InetSocketAddress(host, port), 5000);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}

// Container metrics service
@Component
public class ContainerMetricsService {
    
    private final MeterRegistry meterRegistry;
    private final Timer.Sample requestTimer;
    
    public ContainerMetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.requestTimer = Timer.start(meterRegistry);
        
        // Register custom metrics
        registerContainerMetrics();
    }
    
    private void registerContainerMetrics() {
        // Memory usage gauge
        Gauge.builder("container.memory.usage")
            .description("Container memory usage in bytes")
            .register(meterRegistry, this, ContainerMetricsService::getMemoryUsage);
        
        // CPU usage gauge
        Gauge.builder("container.cpu.usage")
            .description("Container CPU usage percentage")
            .register(meterRegistry, this, ContainerMetricsService::getCpuUsage);
        
        // Network metrics
        Gauge.builder("container.network.connections")
            .description("Active network connections")
            .register(meterRegistry, this, ContainerMetricsService::getNetworkConnections);
    }
    
    private double getMemoryUsage(ContainerMetricsService service) {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }
    
    private double getCpuUsage(ContainerMetricsService service) {
        try {
            Path statPath = Paths.get("/proc/self/stat");
            if (Files.exists(statPath)) {
                String stat = Files.readString(statPath);
                String[] parts = stat.split(" ");
                long utime = Long.parseLong(parts[13]);
                long stime = Long.parseLong(parts[14]);
                return (utime + stime) / 100.0; // Convert to percentage
            }
        } catch (IOException | NumberFormatException e) {
            // Fallback for non-Linux systems
        }
        return 0.0;
    }
    
    private double getNetworkConnections(ContainerMetricsService service) {
        try {
            Path tcpPath = Paths.get("/proc/net/tcp");
            if (Files.exists(tcpPath)) {
                return Files.lines(tcpPath).count() - 1; // Subtract header line
            }
        } catch (IOException e) {
            // Fallback for non-Linux systems
        }
        return 0.0;
    }
}
```

## Container Vulnerability Scanning

### Security Scanner Service

```java
// ContainerSecurityScanner.java
package com.mycompany.security.scanner;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class ContainerSecurityScanner {
    
    private final TrivyScanner trivyScanner;
    private final ClairScanner clairScanner;
    private final SecurityDatabase securityDatabase;
    
    public ContainerSecurityScanner(
            TrivyScanner trivyScanner,
            ClairScanner clairScanner,
            SecurityDatabase securityDatabase) {
        this.trivyScanner = trivyScanner;
        this.clairScanner = clairScanner;
        this.securityDatabase = securityDatabase;
    }
    
    public CompletableFuture<ScanResult> scanImage(String imageName, String tag) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Perform parallel scanning with multiple tools
                CompletableFuture<List<Vulnerability>> trivyResults = 
                    CompletableFuture.supplyAsync(() -> trivyScanner.scan(imageName, tag));
                
                CompletableFuture<List<Vulnerability>> clairResults = 
                    CompletableFuture.supplyAsync(() -> clairScanner.scan(imageName, tag));
                
                // Wait for all scans to complete
                List<Vulnerability> allVulnerabilities = new ArrayList<>();
                allVulnerabilities.addAll(trivyResults.get());
                allVulnerabilities.addAll(clairResults.get());
                
                // Deduplicate and prioritize vulnerabilities
                List<Vulnerability> dedupedVulnerabilities = deduplicateVulnerabilities(allVulnerabilities);
                
                // Create scan result
                ScanResult result = new ScanResult();
                result.setImageName(imageName);
                result.setTag(tag);
                result.setScanDate(new Date());
                result.setVulnerabilities(dedupedVulnerabilities);
                result.setSeverityCount(calculateSeverityCount(dedupedVulnerabilities));
                result.setRiskScore(calculateRiskScore(dedupedVulnerabilities));
                
                // Store results
                securityDatabase.storeScanResult(result);
                
                return result;
                
            } catch (Exception e) {
                throw new RuntimeException("Security scan failed for " + imageName + ":" + tag, e);
            }
        });
    }
    
    private List<Vulnerability> deduplicateVulnerabilities(List<Vulnerability> vulnerabilities) {
        Map<String, Vulnerability> vulnMap = new HashMap<>();
        
        for (Vulnerability vuln : vulnerabilities) {
            String key = vuln.getCveId();
            Vulnerability existing = vulnMap.get(key);
            
            if (existing == null || vuln.getSeverity().ordinal() > existing.getSeverity().ordinal()) {
                vulnMap.put(key, vuln);
            }
        }
        
        return new ArrayList<>(vulnMap.values());
    }
    
    private Map<Severity, Integer> calculateSeverityCount(List<Vulnerability> vulnerabilities) {
        Map<Severity, Integer> severityCount = new HashMap<>();
        
        for (Vulnerability vuln : vulnerabilities) {
            severityCount.merge(vuln.getSeverity(), 1, Integer::sum);
        }
        
        return severityCount;
    }
    
    private double calculateRiskScore(List<Vulnerability> vulnerabilities) {
        double score = 0.0;
        
        for (Vulnerability vuln : vulnerabilities) {
            switch (vuln.getSeverity()) {
                case CRITICAL -> score += 10.0;
                case HIGH -> score += 7.0;
                case MEDIUM -> score += 4.0;
                case LOW -> score += 1.0;
                default -> score += 0.0;
            }
        }
        
        return Math.min(score, 100.0); // Cap at 100
    }
    
    public List<ScanResult> getImageScanHistory(String imageName) {
        return securityDatabase.getScanHistory(imageName);
    }
    
    public ComplianceReport generateComplianceReport(String imageName, String tag) {
        ScanResult latestScan = securityDatabase.getLatestScanResult(imageName, tag);
        
        ComplianceReport report = new ComplianceReport();
        report.setImageName(imageName);
        report.setTag(tag);
        report.setReportDate(new Date());
        
        // Check compliance against security policies
        boolean compliant = checkSecurityCompliance(latestScan);
        report.setCompliant(compliant);
        
        if (!compliant) {
            report.setViolations(getComplianceViolations(latestScan));
            report.setRecommendations(getSecurityRecommendations(latestScan));
        }
        
        return report;
    }
    
    private boolean checkSecurityCompliance(ScanResult scanResult) {
        Map<Severity, Integer> severityCount = scanResult.getSeverityCount();
        
        // Policy: No critical vulnerabilities allowed
        if (severityCount.getOrDefault(Severity.CRITICAL, 0) > 0) {
            return false;
        }
        
        // Policy: Maximum 5 high severity vulnerabilities
        if (severityCount.getOrDefault(Severity.HIGH, 0) > 5) {
            return false;
        }
        
        // Policy: Risk score must be below 50
        if (scanResult.getRiskScore() >= 50.0) {
            return false;
        }
        
        return true;
    }
    
    private List<String> getComplianceViolations(ScanResult scanResult) {
        List<String> violations = new ArrayList<>();
        Map<Severity, Integer> severityCount = scanResult.getSeverityCount();
        
        int criticalCount = severityCount.getOrDefault(Severity.CRITICAL, 0);
        if (criticalCount > 0) {
            violations.add("Found " + criticalCount + " critical vulnerabilities");
        }
        
        int highCount = severityCount.getOrDefault(Severity.HIGH, 0);
        if (highCount > 5) {
            violations.add("Found " + highCount + " high severity vulnerabilities (max allowed: 5)");
        }
        
        if (scanResult.getRiskScore() >= 50.0) {
            violations.add("Risk score " + scanResult.getRiskScore() + " exceeds threshold (50.0)");
        }
        
        return violations;
    }
    
    private List<String> getSecurityRecommendations(ScanResult scanResult) {
        List<String> recommendations = new ArrayList<>();
        
        recommendations.add("Update base image to latest security-patched version");
        recommendations.add("Remove unnecessary packages and dependencies");
        recommendations.add("Apply security patches for identified vulnerabilities");
        recommendations.add("Use multi-stage builds to reduce attack surface");
        recommendations.add("Run containers with non-root user");
        
        return recommendations;
    }
    
    // DTOs
    public static class ScanResult {
        private String imageName;
        private String tag;
        private Date scanDate;
        private List<Vulnerability> vulnerabilities;
        private Map<Severity, Integer> severityCount;
        private double riskScore;
        
        // Getters and setters
        public String getImageName() { return imageName; }
        public void setImageName(String imageName) { this.imageName = imageName; }
        
        public String getTag() { return tag; }
        public void setTag(String tag) { this.tag = tag; }
        
        public Date getScanDate() { return scanDate; }
        public void setScanDate(Date scanDate) { this.scanDate = scanDate; }
        
        public List<Vulnerability> getVulnerabilities() { return vulnerabilities; }
        public void setVulnerabilities(List<Vulnerability> vulnerabilities) { this.vulnerabilities = vulnerabilities; }
        
        public Map<Severity, Integer> getSeverityCount() { return severityCount; }
        public void setSeverityCount(Map<Severity, Integer> severityCount) { this.severityCount = severityCount; }
        
        public double getRiskScore() { return riskScore; }
        public void setRiskScore(double riskScore) { this.riskScore = riskScore; }
    }
    
    public static class Vulnerability {
        private String cveId;
        private String packageName;
        private String installedVersion;
        private String fixedVersion;
        private Severity severity;
        private String description;
        private double cvssScore;
        
        // Getters and setters
        public String getCveId() { return cveId; }
        public void setCveId(String cveId) { this.cveId = cveId; }
        
        public String getPackageName() { return packageName; }
        public void setPackageName(String packageName) { this.packageName = packageName; }
        
        public String getInstalledVersion() { return installedVersion; }
        public void setInstalledVersion(String installedVersion) { this.installedVersion = installedVersion; }
        
        public String getFixedVersion() { return fixedVersion; }
        public void setFixedVersion(String fixedVersion) { this.fixedVersion = fixedVersion; }
        
        public Severity getSeverity() { return severity; }
        public void setSeverity(Severity severity) { this.severity = severity; }
        
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        
        public double getCvssScore() { return cvssScore; }
        public void setCvssScore(double cvssScore) { this.cvssScore = cvssScore; }
    }
    
    public enum Severity {
        UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL
    }
    
    public static class ComplianceReport {
        private String imageName;
        private String tag;
        private Date reportDate;
        private boolean compliant;
        private List<String> violations;
        private List<String> recommendations;
        
        // Getters and setters
        public String getImageName() { return imageName; }
        public void setImageName(String imageName) { this.imageName = imageName; }
        
        public String getTag() { return tag; }
        public void setTag(String tag) { this.tag = tag; }
        
        public Date getReportDate() { return reportDate; }
        public void setReportDate(Date reportDate) { this.reportDate = reportDate; }
        
        public boolean isCompliant() { return compliant; }
        public void setCompliant(boolean compliant) { this.compliant = compliant; }
        
        public List<String> getViolations() { return violations; }
        public void setViolations(List<String> violations) { this.violations = violations; }
        
        public List<String> getRecommendations() { return recommendations; }
        public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }
    }
}
```

## Build and Deployment Scripts

### Makefile for Container Operations

```makefile
# Makefile
.PHONY: build push deploy clean test security-scan

APP_NAME = my-web-app
VERSION = $(shell git describe --tags --always --dirty)
REGISTRY = myregistry.azurecr.io
IMAGE = $(REGISTRY)/$(APP_NAME):$(VERSION)
LATEST_IMAGE = $(REGISTRY)/$(APP_NAME):latest

# Build application
build:
	@echo "Building application..."
	./mvnw clean package -DskipTests
	docker build -t $(IMAGE) .
	docker tag $(IMAGE) $(LATEST_IMAGE)

# Build with tests
build-with-tests:
	@echo "Building application with tests..."
	./mvnw clean package
	docker build -t $(IMAGE) .
	docker tag $(IMAGE) $(LATEST_IMAGE)

# Push to registry
push: build
	@echo "Pushing image to registry..."
	docker push $(IMAGE)
	docker push $(LATEST_IMAGE)

# Security scan
security-scan:
	@echo "Running security scan..."
	trivy image --exit-code 1 --severity HIGH,CRITICAL $(IMAGE)

# Run locally with docker-compose
run-local:
	@echo "Starting local environment..."
	docker-compose up -d

# Run tests
test:
	@echo "Running tests..."
	./mvnw test

# Integration tests
test-integration:
	@echo "Running integration tests..."
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Clean up
clean:
	@echo "Cleaning up..."
	docker-compose down -v
	docker system prune -f
	./mvnw clean

# Deploy to staging
deploy-staging: build push
	@echo "Deploying to staging..."
	kubectl apply -f k8s/staging/

# Deploy to production
deploy-production: security-scan
	@echo "Deploying to production..."
	kubectl apply -f k8s/production/

# Health check
health-check:
	@echo "Checking application health..."
	curl -f http://localhost:8080/actuator/health

# Monitor logs
logs:
	docker-compose logs -f web-app

# Database migration
migrate:
	@echo "Running database migration..."
	docker-compose exec web-app java -jar app.jar --spring.profiles.active=migration
```

This comprehensive guide covers all essential aspects of container technology with Docker, including best practices, security implementations, monitoring, and deployment strategies. Use these patterns to build robust, secure, and scalable containerized applications.
