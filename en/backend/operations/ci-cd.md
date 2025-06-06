# CI/CD (Continuous Integration/Continuous Deployment)

Continuous Integration and Continuous Deployment (CI/CD) represents the cornerstone of modern software delivery practices, fundamentally transforming how organizations approach software development, testing, and deployment. This methodology transcends traditional waterfall development cycles, establishing a culture of rapid iteration, continuous feedback, and reliable automation.

The evolution of CI/CD reflects the broader shift toward DevOps practices, where development and operations teams collaborate seamlessly to deliver value to customers. This approach eliminates traditional silos between development and operations, fostering shared responsibility for application lifecycle management. The ultimate goal is achieving a state where code changes flow smoothly from developer workstations to production environments with minimal human intervention while maintaining high quality and reliability standards.

## Understanding CI/CD

### Continuous Integration (CI)
CI is the practice of automatically building and testing code changes as they are committed to version control. Key principles include:
- **Frequent Integration**: Developers integrate code changes multiple times per day
- **Automated Building**: Every commit triggers an automated build process
- **Automated Testing**: Comprehensive test suites run automatically
- **Fast Feedback**: Quick feedback on code quality and integration issues

### Continuous Deployment (CD)
CD extends CI by automatically deploying validated code changes to production environments. This includes:
- **Automated Deployment Pipeline**: Streamlined deployment process
- **Environment Promotion**: Automatic promotion through staging environments
- **Rollback Capabilities**: Quick rollback mechanisms for failed deployments
- **Release Automation**: Coordinated release of multiple components

## Benefits of CI/CD

### 1. Faster Time to Market
- Automated pipelines reduce deployment time from hours to minutes
- Parallel execution of build and test stages
- Consistent deployment processes across environments

### 2. Improved Quality
- Early detection of integration issues
- Comprehensive automated testing
- Consistent build and deployment processes

### 3. Reduced Risk
- Smaller, more frequent deployments
- Automated rollback capabilities
- Comprehensive testing before production deployment

### 4. Enhanced Collaboration
- Shared responsibility for build and deployment
- Visible pipeline status and metrics
- Standardized development practices

## GitLab CI/CD Pipeline

GitLab provides a comprehensive CI/CD platform with powerful pipeline capabilities.

### Basic Pipeline Configuration (.gitlab-ci.yml)

```yaml
# GitLab CI/CD Pipeline for Spring Boot Application
image: maven:3.8.4-openjdk-17

variables:
  # Maven configuration
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"
  MAVEN_CLI_OPTS: "--batch-mode --errors --fail-at-end --show-version"
  
  # Docker configuration
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  
  # Application configuration
  APP_NAME: "spring-boot-app"
  REGISTRY_URL: "$CI_REGISTRY"
  IMAGE_TAG: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"

# Cache Maven dependencies
cache:
  paths:
    - .m2/repository/
    - target/

# Define pipeline stages
stages:
  - validate
  - test
  - build
  - package
  - deploy-staging
  - integration-test
  - deploy-production

# Validate code quality and formatting
validate:
  stage: validate
  script:
    - mvn $MAVEN_CLI_OPTS validate
    - mvn $MAVEN_CLI_OPTS compile
    - mvn $MAVEN_CLI_OPTS checkstyle:check
    - mvn $MAVEN_CLI_OPTS spotbugs:check
  only:
    - merge_requests
    - main
    - develop

# Run unit tests
unit-test:
  stage: test
  script:
    - mvn $MAVEN_CLI_OPTS test
  coverage: '/Total.*?([0-9]{1,3})%/'
  artifacts:
    when: always
    reports:
      junit:
        - target/surefire-reports/TEST-*.xml
      coverage_report:
        coverage_format: jacoco
        path: target/site/jacoco/jacoco.xml
    paths:
      - target/surefire-reports/
      - target/site/jacoco/
    expire_in: 1 week

# Run integration tests
integration-test:
  stage: test
  services:
    - name: postgres:13
      alias: postgres
  variables:
    POSTGRES_DB: testdb
    POSTGRES_USER: testuser
    POSTGRES_PASSWORD: testpass
    SPRING_PROFILES_ACTIVE: integration-test
    DATABASE_URL: "jdbc:postgresql://postgres:5432/testdb"
  script:
    - mvn $MAVEN_CLI_OPTS verify -Pintegration-test
  artifacts:
    when: always
    reports:
      junit:
        - target/failsafe-reports/TEST-*.xml
    paths:
      - target/failsafe-reports/
    expire_in: 1 week

# Build application
build:
  stage: build
  script:
    - mvn $MAVEN_CLI_OPTS package -DskipTests
  artifacts:
    paths:
      - target/*.jar
    expire_in: 1 week
  only:
    - main
    - develop

# Security scanning
security-scan:
  stage: build
  image: owasp/dependency-check:latest
  script:
    - /usr/share/dependency-check/bin/dependency-check.sh 
      --project "$APP_NAME" 
      --scan target/ 
      --format JSON 
      --out target/dependency-check-report.json
  artifacts:
    reports:
      dependency_scanning: target/dependency-check-report.json
    expire_in: 1 week
  only:
    - main
    - develop

# Build Docker image
package:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    # Build Docker image
    - docker build -t $IMAGE_TAG .
    - docker tag $IMAGE_TAG $CI_REGISTRY_IMAGE:latest
    
    # Push to registry
    - docker push $IMAGE_TAG
    - docker push $CI_REGISTRY_IMAGE:latest
    
    # Scan image for vulnerabilities
    - docker run --rm -v /var/run/docker.sock:/var/run/docker.sock 
      -v $HOME/Library/Caches:/root/.cache/ 
      aquasec/trivy image --exit-code 0 --severity HIGH,CRITICAL $IMAGE_TAG
  only:
    - main
    - develop

# Deploy to staging environment
deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging.myapp.com
  before_script:
    - kubectl config use-context $KUBE_CONTEXT_STAGING
  script:
    # Deploy using Helm
    - helm upgrade --install $APP_NAME-staging ./helm/spring-boot-app 
      --namespace staging 
      --set image.repository=$CI_REGISTRY_IMAGE 
      --set image.tag=$CI_COMMIT_SHA 
      --set environment=staging 
      --set ingress.hosts[0].host=staging.myapp.com
      
    # Wait for deployment to be ready
    - kubectl rollout status deployment/$APP_NAME-staging -n staging --timeout=300s
    
    # Run smoke tests
    - kubectl run smoke-test --rm -i --restart=Never 
      --image=appropriate/curl 
      -- curl -f http://staging.myapp.com/actuator/health
  only:
    - main
    - develop

# Run end-to-end tests against staging
e2e-test:
  stage: integration-test
  image: cypress/included:latest
  variables:
    CYPRESS_baseUrl: "https://staging.myapp.com"
  script:
    - cypress run --record --key $CYPRESS_RECORD_KEY
  artifacts:
    when: always
    paths:
      - cypress/videos/
      - cypress/screenshots/
    expire_in: 1 week
  only:
    - main
    - develop

# Deploy to production (manual approval required)
deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://myapp.com
  before_script:
    - kubectl config use-context $KUBE_CONTEXT_PRODUCTION
  script:
    # Blue-green deployment
    - |
      if kubectl get deployment $APP_NAME-blue -n production; then
        ACTIVE_COLOR="blue"
        INACTIVE_COLOR="green"
      else
        ACTIVE_COLOR="green"
        INACTIVE_COLOR="blue"
      fi
    
    # Deploy to inactive color
    - helm upgrade --install $APP_NAME-$INACTIVE_COLOR ./helm/spring-boot-app 
      --namespace production 
      --set image.repository=$CI_REGISTRY_IMAGE 
      --set image.tag=$CI_COMMIT_SHA 
      --set environment=production 
      --set color=$INACTIVE_COLOR
      
    # Wait for deployment and run health checks
    - kubectl rollout status deployment/$APP_NAME-$INACTIVE_COLOR -n production --timeout=600s
    - kubectl run health-check --rm -i --restart=Never 
      --image=appropriate/curl 
      -- curl -f http://$APP_NAME-$INACTIVE_COLOR.production.svc.cluster.local:8080/actuator/health
    
    # Switch traffic to new version
    - kubectl patch service $APP_NAME -n production 
      -p '{"spec":{"selector":{"color":"'$INACTIVE_COLOR'"}}}'
    
    # Clean up old version after successful deployment
    - sleep 60
    - kubectl delete deployment $APP_NAME-$ACTIVE_COLOR -n production --ignore-not-found=true
  when: manual
  only:
    - main

# Rollback production deployment
rollback-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://myapp.com
  script:
    - kubectl rollout undo deployment/$APP_NAME -n production
    - kubectl rollout status deployment/$APP_NAME -n production --timeout=300s
  when: manual
  only:
    - main
```

### Advanced Pipeline Features

```yaml
# Multi-environment pipeline with dynamic environments
.deploy_template: &deploy_template
  image: bitnami/kubectl:latest
  before_script:
    - kubectl config use-context $KUBE_CONTEXT
  script:
    - |
      helm upgrade --install $APP_NAME-$ENVIRONMENT ./helm/spring-boot-app \
        --namespace $ENVIRONMENT \
        --set image.repository=$CI_REGISTRY_IMAGE \
        --set image.tag=$CI_COMMIT_SHA \
        --set environment=$ENVIRONMENT \
        --set ingress.hosts[0].host=$ENVIRONMENT.myapp.com \
        --set resources.requests.cpu=$CPU_REQUEST \
        --set resources.requests.memory=$MEMORY_REQUEST \
        --set resources.limits.cpu=$CPU_LIMIT \
        --set resources.limits.memory=$MEMORY_LIMIT \
        --set autoscaling.minReplicas=$MIN_REPLICAS \
        --set autoscaling.maxReplicas=$MAX_REPLICAS

# Deploy to development environment
deploy-dev:
  <<: *deploy_template
  stage: deploy-staging
  environment:
    name: development
    url: https://dev.myapp.com
  variables:
    ENVIRONMENT: "development"
    KUBE_CONTEXT: $KUBE_CONTEXT_DEV
    CPU_REQUEST: "100m"
    MEMORY_REQUEST: "256Mi"
    CPU_LIMIT: "500m"
    MEMORY_LIMIT: "512Mi"
    MIN_REPLICAS: "1"
    MAX_REPLICAS: "3"
  only:
    - develop

# Deploy feature branch environments
deploy-feature:
  <<: *deploy_template
  stage: deploy-staging
  environment:
    name: feature/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.myapp.com
    on_stop: cleanup-feature
  variables:
    ENVIRONMENT: $CI_COMMIT_REF_SLUG
    KUBE_CONTEXT: $KUBE_CONTEXT_STAGING
    CPU_REQUEST: "50m"
    MEMORY_REQUEST: "128Mi"
    CPU_LIMIT: "200m"
    MEMORY_LIMIT: "256Mi"
    MIN_REPLICAS: "1"
    MAX_REPLICAS: "2"
  only:
    - /^feature\/.*$/
  except:
    - main
    - develop

# Cleanup feature environments
cleanup-feature:
  image: bitnami/kubectl:latest
  stage: deploy-staging
  environment:
    name: feature/$CI_COMMIT_REF_SLUG
    action: stop
  script:
    - kubectl config use-context $KUBE_CONTEXT_STAGING
    - helm uninstall $APP_NAME-$CI_COMMIT_REF_SLUG --namespace $CI_COMMIT_REF_SLUG
    - kubectl delete namespace $CI_COMMIT_REF_SLUG --ignore-not-found=true
  when: manual
  only:
    - /^feature\/.*$/
```

## GitHub Actions Workflow

GitHub Actions provides integrated CI/CD capabilities within GitHub repositories.

### Complete Workflow Configuration

```yaml
name: Spring Boot CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  JAVA_VERSION: '17'
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Test job
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
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
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up JDK
      uses: actions/setup-java@v4
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: maven
        
    - name: Cache Maven dependencies
      uses: actions/cache@v3
      with:
        path: ~/.m2/repository
        key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
        restore-keys: |
          ${{ runner.os }}-maven-
    
    - name: Run tests
      run: |
        mvn clean test
        mvn jacoco:report
      env:
        DATABASE_URL: jdbc:postgresql://localhost:5432/testdb
        DATABASE_USERNAME: testuser
        DATABASE_PASSWORD: testpass
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: target/site/jacoco/jacoco.xml
        flags: unittests
        name: codecov-umbrella
        
    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # Security scan job
  security:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Run Snyk to check for vulnerabilities
      uses: snyk/actions/maven@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
        
    - name: Upload result to GitHub Code Scanning
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: snyk.sarif

  # Build and push Docker image
  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.tags }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up JDK
      uses: actions/setup-java@v4
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: maven
    
    - name: Build application
      run: mvn clean package -DskipTests
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        
    - name: Generate SBOM
      uses: anchore/sbom-action@v0
      with:
        image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        format: spdx-json
        output-file: sbom.spdx.json
        
    - name: Upload SBOM
      uses: actions/upload-artifact@v3
      with:
        name: sbom
        path: sbom.spdx.json

  # Deploy to staging
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Configure kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'latest'
        
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
        
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --name staging-cluster --region us-west-2
    
    - name: Deploy to staging
      run: |
        helm upgrade --install spring-boot-app ./helm/spring-boot-app \
          --namespace staging \
          --create-namespace \
          --set image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }} \
          --set image.tag=${{ github.sha }} \
          --set environment=staging \
          --wait --timeout=300s
    
    - name: Run smoke tests
      run: |
        kubectl wait --for=condition=ready pod -l app=spring-boot-app -n staging --timeout=300s
        curl -f https://staging.myapp.com/actuator/health

  # Deploy to production
  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Configure kubectl
      uses: azure/setup-kubectl@v3
      
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
        
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --name production-cluster --region us-west-2
    
    - name: Blue-Green Deployment
      run: |
        # Determine current active deployment
        CURRENT_COLOR=$(kubectl get service spring-boot-app -n production -o jsonpath='{.spec.selector.color}' || echo "blue")
        NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")
        
        echo "Deploying to $NEW_COLOR environment"
        
        # Deploy new version
        helm upgrade --install spring-boot-app-$NEW_COLOR ./helm/spring-boot-app \
          --namespace production \
          --set image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }} \
          --set image.tag=${{ github.sha }} \
          --set environment=production \
          --set color=$NEW_COLOR \
          --wait --timeout=600s
        
        # Health check
        kubectl wait --for=condition=ready pod -l app=spring-boot-app,color=$NEW_COLOR -n production --timeout=300s
        
        # Switch traffic
        kubectl patch service spring-boot-app -n production -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'
        
        # Clean up old deployment
        sleep 60
        helm uninstall spring-boot-app-$CURRENT_COLOR -n production || true

  # Performance testing
  performance-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Run k6 performance tests
      uses: grafana/k6-action@v0.3.1
      with:
        filename: tests/performance/load-test.js
      env:
        TARGET_URL: https://staging.myapp.com
        
    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: results.json
```

## Jenkins Pipeline

Jenkins provides flexible pipeline capabilities through Jenkinsfile configuration.

### Declarative Pipeline

```groovy
pipeline {
    agent any
    
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], 
               description: 'Target deployment environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, 
                    description: 'Skip running tests')
        string(name: 'IMAGE_TAG', defaultValue: 'latest', 
               description: 'Docker image tag to deploy')
    }
    
    environment {
        MAVEN_OPTS = '-Dmaven.repo.local=.m2/repository'
        DOCKER_REGISTRY = 'your-registry.com'
        KUBECONFIG = credentials('kubeconfig')
        SONAR_TOKEN = credentials('sonar-token')
        SLACK_WEBHOOK = credentials('slack-webhook')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.BUILD_VERSION = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
            }
        }
        
        stage('Build') {
            steps {
                sh 'mvn clean compile'
            }
        }
        
        stage('Test') {
            when {
                not { params.SKIP_TESTS }
            }
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'mvn test'
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'target/surefire-reports/*.xml'
                            publishCoverage adapters: [jacocoAdapter('target/site/jacoco/jacoco.xml')], 
                                          sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        sh 'docker-compose -f docker-compose.test.yml up -d'
                        sh 'mvn verify -Pintegration-test'
                    }
                    post {
                        always {
                            sh 'docker-compose -f docker-compose.test.yml down'
                            publishTestResults testResultsPattern: 'target/failsafe-reports/*.xml'
                        }
                    }
                }
                
                stage('Code Quality') {
                    steps {
                        withSonarQubeEnv('SonarQube') {
                            sh 'mvn sonar:sonar'
                        }
                    }
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Package') {
            steps {
                sh 'mvn package -DskipTests'
                archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
            }
        }
        
        stage('Docker Build') {
            steps {
                script {
                    def image = docker.build("${DOCKER_REGISTRY}/spring-boot-app:${BUILD_VERSION}")
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }
        
        stage('Security Scan') {
            parallel {
                stage('Container Scan') {
                    steps {
                        sh """
                            docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
                            aquasec/trivy image --exit-code 0 --severity HIGH,CRITICAL \\
                            ${DOCKER_REGISTRY}/spring-boot-app:${BUILD_VERSION}
                        """
                    }
                }
                
                stage('Dependency Scan') {
                    steps {
                        dependencyCheck additionalArguments: '--format JSON --format HTML', 
                                       odcInstallation: 'dependency-check'
                        publishHTML([allowMissing: false, 
                                   alwaysLinkToLastBuild: true, 
                                   keepAll: true, 
                                   reportDir: 'target', 
                                   reportFiles: 'dependency-check-report.html', 
                                   reportName: 'Dependency Check Report'])
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    def targetEnv = (env.BRANCH_NAME == 'main') ? 'production' : 'staging'
                    
                    sh """
                        helm upgrade --install spring-boot-app-${targetEnv} ./helm/spring-boot-app \\
                        --namespace ${targetEnv} \\
                        --create-namespace \\
                        --set image.repository=${DOCKER_REGISTRY}/spring-boot-app \\
                        --set image.tag=${BUILD_VERSION} \\
                        --set environment=${targetEnv} \\
                        --wait --timeout=300s
                    """
                    
                    // Health check
                    sh """
                        kubectl wait --for=condition=ready pod -l app=spring-boot-app \\
                        -n ${targetEnv} --timeout=300s
                    """
                }
            }
        }
        
        stage('Smoke Tests') {
            steps {
                script {
                    def targetEnv = (env.BRANCH_NAME == 'main') ? 'production' : 'staging'
                    def appUrl = (targetEnv == 'production') ? 'https://myapp.com' : 'https://staging.myapp.com'
                    
                    sh """
                        curl -f ${appUrl}/actuator/health
                        curl -f ${appUrl}/actuator/info
                    """
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
                message: "✅ Pipeline succeeded for ${env.JOB_NAME} - ${env.BUILD_NUMBER} (${env.GIT_COMMIT_SHORT})"
            )
        }
        
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ Pipeline failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER} (${env.GIT_COMMIT_SHORT})"
            )
        }
        
        unstable {
            slackSend(
                channel: '#deployments',
                color: 'warning',
                message: "⚠️ Pipeline unstable for ${env.JOB_NAME} - ${env.BUILD_NUMBER} (${env.GIT_COMMIT_SHORT})"
            )
        }
    }
}
```

## Advanced CI/CD Patterns

### 1. Feature Branch Deployments
Automatically deploy feature branches to isolated environments for testing:

```yaml
# Dynamic environment creation
deploy-feature:
  stage: deploy
  environment:
    name: feature/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.dev.myapp.com
    on_stop: cleanup-feature
  script:
    - |
      kubectl create namespace $CI_COMMIT_REF_SLUG --dry-run=client -o yaml | kubectl apply -f -
      helm upgrade --install app-$CI_COMMIT_REF_SLUG ./helm/spring-boot-app \
        --namespace $CI_COMMIT_REF_SLUG \
        --set image.tag=$CI_COMMIT_SHA \
        --set ingress.hosts[0].host=$CI_COMMIT_REF_SLUG.dev.myapp.com
  only:
    - /^feature\/.*$/
```

### 2. Multi-Cloud Deployments
Deploy applications across multiple cloud providers:

```yaml
deploy-multi-cloud:
  parallel:
    matrix:
      - CLOUD_PROVIDER: aws
        KUBE_CONTEXT: $AWS_KUBE_CONTEXT
      - CLOUD_PROVIDER: azure
        KUBE_CONTEXT: $AZURE_KUBE_CONTEXT
      - CLOUD_PROVIDER: gcp
        KUBE_CONTEXT: $GCP_KUBE_CONTEXT
  script:
    - kubectl config use-context $KUBE_CONTEXT
    - helm upgrade --install spring-boot-app-$CLOUD_PROVIDER ./helm/spring-boot-app
```

### 3. Canary Deployments
Gradual rollout with traffic splitting:

```yaml
deploy-canary:
  script:
    # Deploy canary version
    - helm upgrade --install spring-boot-app-canary ./helm/spring-boot-app \
        --set image.tag=$CI_COMMIT_SHA \
        --set canary.enabled=true \
        --set canary.weight=10
    
    # Monitor metrics for 10 minutes
    - sleep 600
    
    # Check error rate and response time
    - |
      ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result[0].value[1]')
      if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
        echo "Error rate too high, rolling back"
        helm rollback spring-boot-app-canary
        exit 1
      fi
    
    # Promote canary to full deployment
    - helm upgrade spring-boot-app ./helm/spring-boot-app \
        --set image.tag=$CI_COMMIT_SHA \
        --set canary.enabled=false
```

## Best Practices

### 1. Pipeline Design
- Keep pipelines fast with parallel execution
- Use appropriate caching strategies
- Implement proper error handling and rollback mechanisms
- Use environment-specific configurations

### 2. Security
- Store secrets securely using CI/CD platform secret management
- Implement least privilege access for deployment accounts
- Scan for security vulnerabilities in dependencies and containers
- Use signed container images

### 3. Testing
- Implement comprehensive test pyramids (unit, integration, e2e)
- Use test doubles and mocks for faster feedback
- Implement performance and security testing
- Maintain test data management strategies

### 4. Monitoring and Observability
- Implement deployment monitoring and alerting
- Track deployment metrics and success rates
- Use distributed tracing for complex deployments
- Implement comprehensive logging strategies

### 5. Rollback and Recovery
- Implement automated rollback triggers
- Maintain deployment artifacts for quick rollbacks
- Use blue-green or canary deployment strategies
- Test rollback procedures regularly

CI/CD is essential for modern software development, enabling teams to deliver high-quality software quickly and reliably. By implementing comprehensive pipelines with proper testing, security scanning, and deployment strategies, organizations can achieve faster time-to-market while maintaining high reliability and security standards.
