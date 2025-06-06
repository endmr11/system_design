# CI/CD İş Akışları

Continuous Integration ve Continuous Deployment (CI/CD) yaklaşımı, modern yazılım geliştirme ekosisteminin kalbidir. Bu metodoloji, sadece teknolojik bir pratik olmaktan ziyade, organizasyonel kültür değişimini ve operational excellence'ı hedefleyen kapsamlı bir felsefedir. Spring Boot uygulamaları için tasarlanmış CI/CD pipeline'ları, rapid software delivery ile production stability arasında hassas dengeyi kurar.

DevOps kültürünün en önemli bileşenlerinden biri olan CI/CD, geliştirme ve operasyon ekipleri arasındaki siloları kırarak, shared responsibility ve collaborative ownership prensiplerini yerleştirir. Bu yaklaşım, time-to-market'i hızlandırırken, quality assurance ve risk management'ı güçlendirir.

## CI/CD'nin Temelleri

CI/CD, yazılım geliştirme yaşam döngüsünü otomatikleştiren ve hızlandıran kritik pratiklerdir.

### Continuous Integration (CI)

**Amaç ve Faydalar:**
- **Erken Hata Tespiti**: Kod değişiklikleri anında test edilir
- **Kalite Kontrolü**: Automated testing ve code quality checks
- **Entegrasyon Sorunlarının Azaltılması**: Küçük, sık değişiklikler
- **Rapid Feedback**: Geliştiriciler hızlı geri bildirim alır

**CI Pipeline Aşamaları:**
1. **Source Code Checkout**: Git repository'den kod çekme
2. **Build**: Uygulama derlemesi ve dependency resolution
3. **Test**: Unit, integration ve smoke test'lerin çalıştırılması
4. **Code Quality Analysis**: Static analysis ve code coverage
5. **Security Scanning**: Vulnerability ve dependency checks
6. **Artifact Creation**: JAR/WAR file'ları ve Docker image'ları

### Continuous Deployment (CD)

**Deployment Stratejileri:**
- **Blue-Green Deployment**: Zero-downtime deployment
- **Canary Deployment**: Gradual rollout ve risk minimization
- **Rolling Deployment**: Progressive instance updates
- **Feature Flags**: Runtime'da feature control

## GitLab CI/CD ile Spring Boot Pipeline

### Gelişmiş Pipeline Konfigürasyonu

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - build
  - test
  - security
  - quality
  - package
  - deploy-staging
  - integration-tests
  - deploy-production
  - post-deployment

variables:
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"
  MAVEN_CLI_OPTS: "--batch-mode --errors --fail-at-end --show-version --no-transfer-progress"
  DOCKER_TLS_CERTDIR: "/certs"
  SPRING_PROFILES_ACTIVE: "ci"
  POSTGRES_DB: "testdb"
  POSTGRES_USER: "testuser"
  POSTGRES_PASSWORD: "testpass"
  
# Cache configuration for better performance
cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - .m2/repository/
    - target/
    - node_modules/
  policy: pull-push

# Global before_script
before_script:
  - echo "Starting CI/CD pipeline for commit $CI_COMMIT_SHA"
  - echo "Pipeline triggered by $GITLAB_USER_NAME"

# Validation stage
validate:
  stage: validate
  image: maven:3.8.6-openjdk-17-slim
  script:
    - mvn $MAVEN_CLI_OPTS validate
    - mvn $MAVEN_CLI_OPTS dependency:resolve-sources
    - echo "✅ Project validation completed"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Build stage with caching
build:
  stage: build
  image: maven:3.8.6-openjdk-17-slim
  script:
    - echo "🔨 Building Spring Boot application..."
    - mvn $MAVEN_CLI_OPTS clean compile
    - mvn $MAVEN_CLI_OPTS process-resources
    - echo "✅ Build completed successfully"
  artifacts:
    paths:
      - target/classes/
      - target/generated-sources/
    expire_in: 1 hour
  cache:
    key: "$CI_COMMIT_REF_SLUG-build"
    paths:
      - .m2/repository/
      - target/
    policy: pull-push

# Comprehensive testing
unit-tests:
  stage: test
  image: maven:3.8.6-openjdk-17-slim
  services:
    - name: postgres:15-alpine
      alias: postgres
    - name: redis:7-alpine
      alias: redis
  variables:
    SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/testdb"
    SPRING_DATASOURCE_USERNAME: $POSTGRES_USER
    SPRING_DATASOURCE_PASSWORD: $POSTGRES_PASSWORD
    SPRING_REDIS_HOST: "redis"
    SPRING_REDIS_PORT: "6379"
  script:
    - echo "🧪 Running unit tests..."
    - mvn $MAVEN_CLI_OPTS test
    - echo "📊 Generating test reports..."
    - mvn jacoco:report
  artifacts:
    reports:
      junit:
        - target/surefire-reports/TEST-*.xml
      coverage_report:
        coverage_format: cobertura
        path: target/site/jacoco/cobertura.xml
    paths:
      - target/site/jacoco/
      - target/surefire-reports/
    expire_in: 1 week
  coverage: '/Total.*?([0-9]{1,3})%/'

integration-tests:
  stage: test
  image: maven:3.8.6-openjdk-17-slim
  services:
    - name: postgres:15-alpine
      alias: postgres
    - name: redis:7-alpine
      alias: redis
    - name: testcontainers/ryuk:0.5.1
      alias: ryuk
  variables:
    SPRING_PROFILES_ACTIVE: "integration-test"
    TESTCONTAINERS_RYUK_DISABLED: "true"
    DOCKER_HOST: "tcp://docker:2376"
    DOCKER_TLS_CERTDIR: "/certs"
    DOCKER_TLS_VERIFY: 1
    DOCKER_CERT_PATH: "$DOCKER_TLS_CERTDIR/client"
  script:
    - echo "🔄 Running integration tests..."
    - mvn $MAVEN_CLI_OPTS verify -P integration-test
    - echo "📋 Integration test results processed"
  artifacts:
    reports:
      junit:
        - target/failsafe-reports/TEST-*.xml
    paths:
      - target/failsafe-reports/
    expire_in: 1 week
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  needs:
    - unit-tests

# Security scanning
dependency-scanning:
  stage: security
  image: owasp/dependency-check:latest
  script:
    - echo "🔒 Scanning for security vulnerabilities..."
    - /usr/share/dependency-check/bin/dependency-check.sh 
      --project "$CI_PROJECT_NAME" 
      --scan target/ 
      --format XML 
      --format JSON 
      --format HTML
      --failOnCVSS 7
      --suppressionFile .dependency-check-suppressions.xml
  artifacts:
    reports:
      dependency_scanning: dependency-check-report.json
    paths:
      - dependency-check-report.*
    expire_in: 1 week
  allow_failure: true
  needs:
    - build

secret-detection:
  stage: security
  image: trufflesecurity/trufflehog:latest
  script:
    - echo "🕵️ Scanning for exposed secrets..."
    - trufflehog git file://. --json > secret-scan-results.json
    - |
      if [ -s secret-scan-results.json ]; then
        echo "❌ Secrets found in repository!"
        cat secret-scan-results.json
        exit 1
      else
        echo "✅ No secrets detected"
      fi
  artifacts:
    paths:
      - secret-scan-results.json
    expire_in: 1 week
  allow_failure: false

# Code quality analysis
sonarqube-check:
  stage: quality
  image: maven:3.8.6-openjdk-17-slim
  variables:
    SONAR_USER_HOME: "${CI_PROJECT_DIR}/.sonar"
    GIT_DEPTH: "0"
  cache:
    key: "${CI_JOB_NAME}"
    paths:
      - .sonar/cache
  script:
    - echo "📊 Running SonarQube analysis..."
    - mvn $MAVEN_CLI_OPTS verify sonar:sonar
      -Dsonar.projectKey=$CI_PROJECT_NAME
      -Dsonar.host.url=$SONAR_HOST_URL
      -Dsonar.login=$SONAR_TOKEN
      -Dsonar.qualitygate.wait=true
  needs:
    - unit-tests
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# Package creation
package-jar:
  stage: package
  image: maven:3.8.6-openjdk-17-slim
  script:
    - echo "📦 Creating JAR package..."
    - mvn $MAVEN_CLI_OPTS package -DskipTests
    - echo "JAR file created: $(ls -la target/*.jar)"
    - java -jar target/*.jar --version || echo "Version check completed"
  artifacts:
    paths:
      - target/*.jar
    expire_in: 1 month
  needs:
    - unit-tests
    - integration-tests

package-docker:
  stage: package
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  variables:
    DOCKER_BUILDKIT: 1
  before_script:
    - echo $CI_REGISTRY_PASSWORD | docker login -u $CI_REGISTRY_USER --password-stdin $CI_REGISTRY
  script:
    - echo "🐳 Building Docker image..."
    - |
      docker build \
        --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
        --build-arg VCS_REF=$CI_COMMIT_SHA \
        --build-arg VERSION=$CI_COMMIT_TAG \
        --cache-from $CI_REGISTRY_IMAGE:latest \
        --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA \
        --tag $CI_REGISTRY_IMAGE:latest \
        .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
    - echo "✅ Docker image pushed to registry"
  needs:
    - package-jar
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Staging deployment
deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging-api.company.com
    on_stop: stop-staging
  before_script:
    - kubectl config use-context staging
    - kubectl version --client
  script:
    - echo "🚀 Deploying to staging environment..."
    - |
      helm upgrade --install staging-app ./helm-chart \
        --namespace staging \
        --create-namespace \
        --set image.tag=$CI_COMMIT_SHA \
        --set environment=staging \
        --set ingress.hosts[0].host=staging-api.company.com \
        --set replicaCount=2 \
        --set resources.requests.memory=512Mi \
        --set resources.requests.cpu=250m \
        --set resources.limits.memory=1Gi \
        --set resources.limits.cpu=500m \
        --wait --timeout=10m
    - echo "✅ Staging deployment completed"
    - kubectl get pods -n staging -l app.kubernetes.io/name=spring-boot-app
  needs:
    - package-docker
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

stop-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  environment:
    name: staging
    action: stop
  script:
    - echo "🛑 Stopping staging environment..."
    - helm uninstall staging-app --namespace staging || true
    - kubectl delete namespace staging || true
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Post-deployment testing
smoke-tests:
  stage: integration-tests
  image: curlimages/curl:latest
  variables:
    STAGING_URL: "https://staging-api.company.com"
  script:
    - echo "💨 Running smoke tests on staging..."
    - sleep 30  # Wait for application to be ready
    - |
      # Health check
      echo "Testing health endpoint..."
      curl -f -s $STAGING_URL/actuator/health | jq '.'
      
      # API functionality test
      echo "Testing API endpoints..."
      curl -f -s $STAGING_URL/api/v1/users?page=0&size=1 | jq '.'
      
      # Performance test
      echo "Testing response time..."
      response_time=$(curl -o /dev/null -s -w '%{time_total}' $STAGING_URL/actuator/health)
      echo "Response time: ${response_time}s"
      
      if (( $(echo "$response_time > 2.0" | bc -l) )); then
        echo "❌ Response time too slow: ${response_time}s"
        exit 1
      fi
    - echo "✅ Smoke tests passed"
  needs:
    - deploy-staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Production deployment
deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://api.company.com
  before_script:
    - kubectl config use-context production
  script:
    - echo "🚀 Deploying to production environment..."
    - |
      # Blue-Green deployment strategy
      helm upgrade --install prod-app ./helm-chart \
        --namespace production \
        --create-namespace \
        --set image.tag=$CI_COMMIT_SHA \
        --set environment=production \
        --set ingress.hosts[0].host=api.company.com \
        --set replicaCount=5 \
        --set autoscaling.enabled=true \
        --set autoscaling.minReplicas=3 \
        --set autoscaling.maxReplicas=20 \
        --set resources.requests.memory=1Gi \
        --set resources.requests.cpu=500m \
        --set resources.limits.memory=2Gi \
        --set resources.limits.cpu=1000m \
        --set monitoring.enabled=true \
        --wait --timeout=15m
    - echo "✅ Production deployment completed"
    - kubectl get pods -n production -l app.kubernetes.io/name=spring-boot-app
  needs:
    - smoke-tests
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  when: manual

# Post-deployment verification
production-health-check:
  stage: post-deployment
  image: curlimages/curl:latest
  variables:
    PRODUCTION_URL: "https://api.company.com"
  script:
    - echo "🏥 Running production health checks..."
    - sleep 60  # Wait for production deployment to stabilize
    - |
      for i in {1..10}; do
        echo "Health check attempt $i/10..."
        if curl -f -s $PRODUCTION_URL/actuator/health | jq '.status' | grep -q "UP"; then
          echo "✅ Production health check passed"
          exit 0
        fi
        echo "⏳ Waiting 30 seconds before retry..."
        sleep 30
      done
      echo "❌ Production health check failed after 10 attempts"
      exit 1
  needs:
    - deploy-production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Cleanup job
cleanup:
  stage: post-deployment
  image: alpine:latest
  script:
    - echo "🧹 Cleaning up old artifacts..."
    - echo "Pipeline completed for commit $CI_COMMIT_SHA"
  when: always
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Docker Multi-Stage Build

```dockerfile
# Dockerfile
# Build stage
FROM maven:3.8.6-openjdk-17-slim AS builder

# Copy source code
WORKDIR /app
COPY pom.xml .
COPY src ./src

# Build application
RUN mvn clean package -DskipTests -Dmaven.repo.local=/app/.m2/repository

# Runtime stage
FROM openjdk:17-jdk-slim

# Add metadata
LABEL maintainer="your-team@company.com"
LABEL version="1.0.0"
LABEL description="Spring Boot Application"

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy JAR file from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Create directories and set permissions
RUN mkdir -p /app/logs /app/tmp && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Expose port
EXPOSE 8080

# JVM optimizations
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -XX:+UseStringDeduplication \
               -XX:+PrintGCDetails \
               -XX:+PrintGCTimeStamps \
               -Xloggc:/app/logs/gc.log"

# Spring Boot optimizations
ENV SPRING_PROFILES_ACTIVE=docker
ENV SERVER_PORT=8080

# Start application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

## GitHub Actions ile CI/CD

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  release:
    types: [ published ]

env:
  JAVA_VERSION: '17'
  MAVEN_ARGS: '--batch-mode --errors --fail-at-end --show-version'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set up JDK ${{ env.JAVA_VERSION }}
      uses: actions/setup-java@v3
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: maven

    - name: Cache dependencies
      uses: actions/cache@v3
      with:
        path: ~/.m2
        key: ${{ runner.os }}-m2-${{ hashFiles('**/pom.xml') }}
        restore-keys: ${{ runner.os }}-m2

    - name: Run tests
      run: |
        mvn ${{ env.MAVEN_ARGS }} clean test
      env:
        SPRING_DATASOURCE_URL: jdbc:postgresql://localhost:5432/testdb
        SPRING_DATASOURCE_USERNAME: testuser
        SPRING_DATASOURCE_PASSWORD: testpass
        SPRING_REDIS_HOST: localhost
        SPRING_REDIS_PORT: 6379

    - name: Generate test report
      uses: dorny/test-reporter@v1
      if: always()
      with:
        name: Maven Tests
        path: target/surefire-reports/*.xml
        reporter: java-junit

    - name: Code Coverage
      run: mvn jacoco:report

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: target/site/jacoco/jacoco.xml
        fail_ci_if_error: true

  security:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up JDK ${{ env.JAVA_VERSION }}
      uses: actions/setup-java@v3
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: maven

    - name: OWASP Dependency Check
      run: |
        mvn org.owasp:dependency-check-maven:check
        
    - name: Upload OWASP report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: owasp-report
        path: target/dependency-check-report.html

  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up JDK ${{ env.JAVA_VERSION }}
      uses: actions/setup-java@v3
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: maven

    - name: Build application
      run: mvn ${{ env.MAVEN_ARGS }} clean package -DskipTests

    - name: Upload JAR
      uses: actions/upload-artifact@v3
      with:
        name: jar-artifact
        path: target/*.jar

  docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name != 'pull_request'
    
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Download JAR artifact
      uses: actions/download-artifact@v3
      with:
        name: jar-artifact
        path: target/

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    runs-on: ubuntu-latest
    needs: docker
    if: github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'latest'

    - name: Set up Helm
      uses: azure/setup-helm@v3
      with:
        version: 'latest'

    - name: Configure kubectl
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > ~/.kube/config

    - name: Deploy to staging
      run: |
        helm upgrade --install staging-app ./helm-chart \
          --namespace staging \
          --create-namespace \
          --set image.tag=${{ github.sha }} \
          --set environment=staging \
          --wait --timeout=10m

    - name: Smoke tests
      run: |
        sleep 30
        curl -f https://staging-api.company.com/actuator/health

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'latest'

    - name: Set up Helm
      uses: azure/setup-helm@v3
      with:
        version: 'latest'

    - name: Configure kubectl
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBE_CONFIG_PRODUCTION }}" | base64 -d > ~/.kube/config

    - name: Deploy to production
      run: |
        helm upgrade --install prod-app ./helm-chart \
          --namespace production \
          --create-namespace \
          --set image.tag=${{ github.sha }} \
          --set environment=production \
          --set replicaCount=5 \
          --wait --timeout=15m

    - name: Production health check
      run: |
        for i in {1..10}; do
          if curl -f https://api.company.com/actuator/health; then
            echo "Production deployment successful"
            exit 0
          fi
          sleep 30
        done
        echo "Production health check failed"
        exit 1
```

## Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        MAVEN_ARGS = '--batch-mode --errors --fail-at-end --show-version'
        DOCKER_REGISTRY = 'your-registry.com'
        DOCKER_IMAGE = 'spring-boot-app'
        KUBECONFIG = credentials('kubeconfig')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('Build') {
            steps {
                sh "mvn ${MAVEN_ARGS} clean compile"
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'target/site',
                        reportFiles: 'index.html',
                        reportName: 'Build Report'
                    ])
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh "mvn ${MAVEN_ARGS} test"
                    }
                    post {
                        always {
                            junit 'target/surefire-reports/*.xml'
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'target/site/jacoco',
                                reportFiles: 'index.html',
                                reportName: 'JaCoCo Coverage Report'
                            ])
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        sh "mvn ${MAVEN_ARGS} verify -P integration-test"
                    }
                    post {
                        always {
                            junit 'target/failsafe-reports/*.xml'
                        }
                    }
                }
            }
        }
        
        stage('Code Quality') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh "mvn ${MAVEN_ARGS} sonar:sonar"
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                sh "mvn org.owasp:dependency-check-maven:check"
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'target',
                        reportFiles: 'dependency-check-report.html',
                        reportName: 'OWASP Dependency Check'
                    ])
                }
            }
        }
        
        stage('Package') {
            steps {
                sh "mvn ${MAVEN_ARGS} package -DskipTests"
                archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
            }
        }
        
        stage('Docker Build') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    def image = docker.build("${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${env.GIT_COMMIT_SHORT}")
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    helm upgrade --install staging-app ./helm-chart \\
                        --namespace staging \\
                        --create-namespace \\
                        --set image.tag=${env.GIT_COMMIT_SHORT} \\
                        --set environment=staging \\
                        --wait --timeout=10m
                """
            }
        }
        
        stage('Staging Tests') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh 'sleep 30' // Wait for deployment
                    sh 'curl -f https://staging-api.company.com/actuator/health'
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
                sh """
                    helm upgrade --install prod-app ./helm-chart \\
                        --namespace production \\
                        --create-namespace \\
                        --set image.tag=${env.GIT_COMMIT_SHORT} \\
                        --set environment=production \\
                        --set replicaCount=5 \\
                        --wait --timeout=15m
                """
            }
        }
        
        stage('Production Verification') {
            when {
                branch 'main'
            }
            steps {
                script {
                    retry(10) {
                        sh 'curl -f https://api.company.com/actuator/health'
                        sleep 30
                    }
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                channel: '#deployments',
                color: 'good',
                message: "✅ Pipeline succeeded for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ Pipeline failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

## Deployment Strategies

### Blue-Green Deployment

```yaml
# blue-green-deployment.yml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: spring-boot-app
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: spring-boot-app-active
      previewService: spring-boot-app-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: spring-boot-app-preview.default.svc.cluster.local
      postPromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: spring-boot-app-active.default.svc.cluster.local
  selector:
    matchLabels:
      app: spring-boot-app
  template:
    metadata:
      labels:
        app: spring-boot-app
    spec:
      containers:
      - name: spring-boot-app
        image: your-registry/spring-boot-app:latest
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Canary Deployment

```yaml
# canary-deployment.yml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: spring-boot-app-canary
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 2m}
      - setWeight: 20
      - pause: {duration: 2m}
      - analysis:
          templates:
          - templateName: error-rate-analysis
          args:
          - name: service-name
            value: spring-boot-app-canary
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 80
      - pause: {duration: 2m}
      trafficRouting:
        nginx:
          stableIngress: spring-boot-app-stable
          annotationPrefix: nginx.ingress.kubernetes.io
          additionalIngressAnnotations:
            canary-by-header: X-Canary
            canary-by-header-value: always
  selector:
    matchLabels:
      app: spring-boot-app
  template:
    # Pod template specification
```

CI/CD pipeline'ları, Spring Boot uygulamalarının güvenilir ve hızlı şekilde production'a deploy edilmesini sağlar. Doğru strateji ve araçlar seçimi ile hem geliştirici deneyimi hem de sistem güvenilirliği önemli ölçüde artırılabilir.
