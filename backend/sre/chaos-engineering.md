# Chaos Engineering

Chaos Engineering, sistemlerin dayanıklılığını test etmek ve güçlendirmek için kontrollü şekilde hatalar oluşturma disiplinidir. Bu yaklaşım, sistemlerin gerçek dünya koşullarındaki beklenmedik durumlara karşı nasıl davrandığını anlamaya yardımcı olur.

## Chaos Engineering Temelleri

### Chaos Engineering Prensipleri

#### 1. Steady State Hypothesis
```java
// Chaos Engineering Hypothesis Framework
@Component
public class SteadyStateValidator {
    
    public SteadyStateHypothesis defineHypothesis(String serviceName) {
        return SteadyStateHypothesis.builder()
            .serviceName(serviceName)
            .baseline(defineBaseline(serviceName))
            .tolerances(defineTolerance(serviceName))
            .duration(Duration.ofMinutes(30))
            .build();
    }
    
    private ServiceBaseline defineBaseline(String serviceName) {
        // Son 30 günün metriklerinden baseline hesapla
        List<ServiceMetrics> historicalMetrics = metricsService.getHistoricalMetrics(
            serviceName, Duration.ofDays(30)
        );
        
        return ServiceBaseline.builder()
            .averageLatency(calculateAverageLatency(historicalMetrics))
            .averageThroughput(calculateAverageThroughput(historicalMetrics))
            .errorRate(calculateAverageErrorRate(historicalMetrics))
            .availability(calculateAvailability(historicalMetrics))
            .build();
    }
    
    private ServiceTolerance defineTolerance(String serviceName) {
        return ServiceTolerance.builder()
            .latencyTolerance(0.2) // %20 tolerance
            .throughputTolerance(0.15) // %15 tolerance
            .errorRateTolerance(0.1) // %10 tolerance
            .availabilityTolerance(0.01) // %1 tolerance
            .build();
    }
    
    public boolean validateSteadyState(SteadyStateHypothesis hypothesis, ServiceMetrics currentMetrics) {
        ServiceBaseline baseline = hypothesis.getBaseline();
        ServiceTolerance tolerance = hypothesis.getTolerance();
        
        // Latency validation
        if (!isWithinTolerance(currentMetrics.getLatency(), baseline.getAverageLatency(), tolerance.getLatencyTolerance())) {
            return false;
        }
        
        // Throughput validation
        if (!isWithinTolerance(currentMetrics.getThroughput(), baseline.getAverageThroughput(), tolerance.getThroughputTolerance())) {
            return false;
        }
        
        // Error rate validation
        if (!isWithinTolerance(currentMetrics.getErrorRate(), baseline.getErrorRate(), tolerance.getErrorRateTolerance())) {
            return false;
        }
        
        return true;
    }
}
```

#### 2. Experiment Design
```java
// Chaos Experiment Framework
@Entity
public class ChaosExperiment {
    @Id
    private String id;
    private String name;
    private String description;
    private SteadyStateHypothesis hypothesis;
    private ExperimentMethod method;
    private ExperimentScope scope;
    private Duration duration;
    private ExperimentStatus status;
    private List<ExperimentResult> results;
    
    // Constructor, getters, setters
}

@Service
public class ChaosExperimentService {
    
    public ChaosExperiment createExperiment(ExperimentRequest request) {
        ChaosExperiment experiment = ChaosExperiment.builder()
            .id(UUID.randomUUID().toString())
            .name(request.getName())
            .description(request.getDescription())
            .hypothesis(steadyStateValidator.defineHypothesis(request.getServiceName()))
            .method(request.getMethod())
            .scope(defineScope(request))
            .duration(request.getDuration())
            .status(ExperimentStatus.PLANNED)
            .build();
            
        return chaosExperimentRepository.save(experiment);
    }
    
    public ExperimentResult executeExperiment(String experimentId) {
        ChaosExperiment experiment = chaosExperimentRepository.findById(experimentId)
            .orElseThrow(() -> new ExperimentNotFoundException(experimentId));
            
        // Pre-experiment validation
        if (!validatePreConditions(experiment)) {
            throw new ExperimentPreConditionFailedException("Pre-conditions not met");
        }
        
        experiment.setStatus(ExperimentStatus.RUNNING);
        
        try {
            // Execute chaos injection
            ChaosInjectionResult injectionResult = executeInjection(experiment);
            
            // Monitor system behavior
            List<ServiceMetrics> monitoringResults = monitorSystemBehavior(experiment);
            
            // Validate hypothesis
            boolean hypothesisValid = validateHypothesis(experiment, monitoringResults);
            
            // Create result
            ExperimentResult result = ExperimentResult.builder()
                .experimentId(experimentId)
                .injectionResult(injectionResult)
                .monitoringResults(monitoringResults)
                .hypothesisValid(hypothesisValid)
                .executedAt(Instant.now())
                .build();
                
            experiment.addResult(result);
            experiment.setStatus(ExperimentStatus.COMPLETED);
            
            return result;
            
        } catch (Exception e) {
            experiment.setStatus(ExperimentStatus.FAILED);
            throw new ExperimentExecutionException("Experiment failed", e);
        } finally {
            // Cleanup chaos injection
            cleanupInjection(experiment);
        }
    }
}
```

## Chaos Monkey Implementation

### 1. Service Termination
```java
// Chaos Monkey Service Killer
@Component
public class ServiceTerminationChaos {
    
    @Autowired
    private KubernetesClient kubernetesClient;
    
    @Autowired
    private ChaosConfigurationService configService;
    
    @Scheduled(cron = "0 */30 9-17 * * MON-FRI") // İş saatlerinde 30 dakikada bir
    public void randomServiceTermination() {
        ChaosConfiguration config = configService.getChaosConfiguration();
        
        if (!config.isServiceTerminationEnabled()) {
            return;
        }
        
        List<String> eligibleServices = getEligibleServices(config);
        
        if (eligibleServices.isEmpty()) {
            log.info("No eligible services for chaos termination");
            return;
        }
        
        String targetService = selectRandomService(eligibleServices);
        terminateRandomInstance(targetService);
    }
    
    private List<String> getEligibleServices(ChaosConfiguration config) {
        return kubernetesClient.apps().deployments()
            .inNamespace(config.getTargetNamespace())
            .list()
            .getItems()
            .stream()
            .filter(deployment -> isEligibleForChaos(deployment, config))
            .map(deployment -> deployment.getMetadata().getName())
            .collect(Collectors.toList());
    }
    
    private boolean isEligibleForChaos(Deployment deployment, ChaosConfiguration config) {
        Map<String, String> labels = deployment.getMetadata().getLabels();
        
        // Chaos engineering'e açık servisler
        if (!"true".equals(labels.get("chaos.enabled"))) {
            return false;
        }
        
        // Minimum replica sayısı kontrolü
        int replicas = deployment.getSpec().getReplicas();
        if (replicas < config.getMinimumReplicasForChaos()) {
            return false;
        }
        
        // Production critical servisleri hariç tut
        if ("critical".equals(labels.get("service.tier"))) {
            return false;
        }
        
        return true;
    }
    
    private void terminateRandomInstance(String serviceName) {
        List<Pod> pods = kubernetesClient.pods()
            .inNamespace("default")
            .withLabel("app", serviceName)
            .list()
            .getItems();
            
        if (pods.isEmpty()) {
            log.warn("No pods found for service: {}", serviceName);
            return;
        }
        
        Pod targetPod = pods.get(random.nextInt(pods.size()));
        
        log.info("Chaos Monkey: Terminating pod {} of service {}", 
            targetPod.getMetadata().getName(), serviceName);
            
        // Pod'u terminate et
        kubernetesClient.pods()
            .inNamespace("default")
            .withName(targetPod.getMetadata().getName())
            .delete();
            
        // Event'i log'la
        chaosEventLogger.logTerminationEvent(serviceName, targetPod.getMetadata().getName());
        
        // Metrics'i update et
        chaosMetrics.incrementTerminationCounter(serviceName);
    }
}
```

### 2. Network Latency Injection
```java
// Network Chaos Implementation
@Component
public class NetworkLatencyChaos {
    
    public ChaosInjectionResult injectNetworkLatency(NetworkLatencyConfig config) {
        String targetPod = config.getTargetPod();
        Duration latency = config.getLatency();
        double jitter = config.getJitter();
        
        // tc (traffic control) command ile latency inject et
        String tcCommand = String.format(
            "tc qdisc add dev eth0 root netem delay %dms %dms",
            latency.toMillis(),
            (long)(latency.toMillis() * jitter)
        );
        
        ExecutionResult result = kubernetesExecutor.executeCommand(targetPod, tcCommand);
        
        if (result.isSuccess()) {
            log.info("Network latency injected: {}ms ±{}ms on pod {}", 
                latency.toMillis(), (long)(latency.toMillis() * jitter), targetPod);
        }
        
        return ChaosInjectionResult.builder()
            .type(ChaosType.NETWORK_LATENCY)
            .target(targetPod)
            .configuration(config)
            .success(result.isSuccess())
            .message(result.getOutput())
            .injectedAt(Instant.now())
            .build();
    }
    
    public void removeNetworkLatency(String targetPod) {
        String cleanupCommand = "tc qdisc del dev eth0 root";
        ExecutionResult result = kubernetesExecutor.executeCommand(targetPod, cleanupCommand);
        
        if (result.isSuccess()) {
            log.info("Network latency removed from pod {}", targetPod);
        }
    }
}
```

### 3. Resource Exhaustion
```java
// CPU ve Memory Stress Testing
@Component
public class ResourceExhaustionChaos {
    
    public ChaosInjectionResult injectCPUStress(CPUStressConfig config) {
        String targetPod = config.getTargetPod();
        int cpuPercentage = config.getCpuPercentage();
        Duration duration = config.getDuration();
        
        // stress-ng kullanarak CPU stress oluştur
        String stressCommand = String.format(
            "stress-ng --cpu %d --cpu-load %d --timeout %ds",
            Runtime.getRuntime().availableProcessors(),
            cpuPercentage,
            duration.getSeconds()
        );
        
        // Background'da çalıştır
        CompletableFuture<ExecutionResult> futureResult = 
            kubernetesExecutor.executeCommandAsync(targetPod, stressCommand);
        
        return ChaosInjectionResult.builder()
            .type(ChaosType.CPU_STRESS)
            .target(targetPod)
            .configuration(config)
            .success(true)
            .message(String.format("CPU stress started: %d%% for %d seconds", cpuPercentage, duration.getSeconds()))
            .injectedAt(Instant.now())
            .futureResult(futureResult)
            .build();
    }
    
    public ChaosInjectionResult injectMemoryStress(MemoryStressConfig config) {
        String targetPod = config.getTargetPod();
        String memorySize = config.getMemorySize(); // "512M", "1G" etc.
        Duration duration = config.getDuration();
        
        String stressCommand = String.format(
            "stress-ng --vm 1 --vm-bytes %s --timeout %ds",
            memorySize,
            duration.getSeconds()
        );
        
        CompletableFuture<ExecutionResult> futureResult = 
            kubernetesExecutor.executeCommandAsync(targetPod, stressCommand);
        
        return ChaosInjectionResult.builder()
            .type(ChaosType.MEMORY_STRESS)
            .target(targetPod)
            .configuration(config)
            .success(true)
            .message(String.format("Memory stress started: %s for %d seconds", memorySize, duration.getSeconds()))
            .injectedAt(Instant.now())
            .futureResult(futureResult)
            .build();
    }
}
```

## Gremlin Integration

### 1. Gremlin API Integration
```java
// Gremlin Service Integration
@Service
public class GremlinChaosService {
    
    @Value("${gremlin.api.key}")
    private String apiKey;
    
    @Value("${gremlin.team.id}")
    private String teamId;
    
    private final WebClient gremlinClient;
    
    public GremlinChaosService() {
        this.gremlinClient = WebClient.builder()
            .baseUrl("https://api.gremlin.com/v1")
            .defaultHeader("Authorization", "Key " + apiKey)
            .build();
    }
    
    public GremlinAttack createCPUAttack(GremlinCPUAttackRequest request) {
        return gremlinClient.post()
            .uri("/attacks")
            .bodyValue(buildCPUAttackPayload(request))
            .retrieve()
            .bodyToMono(GremlinAttack.class)
            .block();
    }
    
    private Map<String, Object> buildCPUAttackPayload(GremlinCPUAttackRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "cpu");
        payload.put("target", Map.of(
            "type", "Random",
            "exact", request.getTargetCount()
        ));
        payload.put("command", Map.of(
            "type", "cpu",
            "args", List.of(
                "-l", String.valueOf(request.getCpuPercentage()),
                "-c", String.valueOf(request.getCpuCores())
            )
        ));
        return payload;
    }
    
    public GremlinAttack createNetworkAttack(GremlinNetworkAttackRequest request) {
        return gremlinClient.post()
            .uri("/attacks")
            .bodyValue(buildNetworkAttackPayload(request))
            .retrieve()
            .bodyToMono(GremlinAttack.class)
            .block();
    }
    
    private Map<String, Object> buildNetworkAttackPayload(GremlinNetworkAttackRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "network");
        payload.put("target", Map.of(
            "type", "Container",
            "container_selection", Map.of(
                "labels", request.getTargetLabels()
            )
        ));
        
        Map<String, Object> command = new HashMap<>();
        command.put("type", "latency");
        command.put("args", List.of(
            "-m", String.valueOf(request.getLatencyMs()),
            "-j", String.valueOf(request.getJitterMs())
        ));
        
        payload.put("command", command);
        return payload;
    }
}
```

### 2. Experiment Scheduling
```java
// Scheduled Chaos Experiments
@Component
public class ScheduledChaosExperiments {
    
    @Autowired
    private GremlinChaosService gremlinService;
    
    @Autowired
    private ChaosExperimentService experimentService;
    
    // Her Salı 10:00'da mikroservis dayanıklılığı testi
    @Scheduled(cron = "0 0 10 * * TUE")
    public void weeklyMicroserviceResilienceTest() {
        if (!isChaosExperimentSafe()) {
            log.info("Skipping chaos experiment - unsafe conditions detected");
            return;
        }
        
        ExperimentPlan plan = ExperimentPlan.builder()
            .name("Weekly Microservice Resilience Test")
            .description("Test microservice resilience against random failures")
            .experiments(List.of(
                createServiceTerminationExperiment(),
                createNetworkLatencyExperiment(),
                createDatabaseConnectionExperiment()
            ))
            .build();
            
        executeExperimentPlan(plan);
    }
    
    // Her Perşembe 14:00'da database failover testi
    @Scheduled(cron = "0 0 14 * * THU")
    public void databaseFailoverTest() {
        if (!isDatabaseFailoverTestSafe()) {
            log.info("Skipping database failover test - unsafe conditions");
            return;
        }
        
        DatabaseFailoverExperiment experiment = DatabaseFailoverExperiment.builder()
            .targetDatabase("user-service-db")
            .failoverType(FailoverType.PRIMARY_SHUTDOWN)
            .duration(Duration.ofMinutes(5))
            .expectedBehavior("Application should failover to secondary database")
            .build();
            
        experimentService.executeDatabaseFailoverExperiment(experiment);
    }
    
    private boolean isChaosExperimentSafe() {
        // Production load kontrolü
        double currentLoad = systemMetricsService.getCurrentCPUUtilization();
        if (currentLoad > 70.0) {
            return false;
        }
        
        // Ongoing incidents kontrolü
        long ongoingIncidents = incidentService.getActiveIncidentCount();
        if (ongoingIncidents > 0) {
            return false;
        }
        
        // Deployment window kontrolü
        boolean isDeploymentWindow = deploymentService.isDeploymentInProgress();
        if (isDeploymentWindow) {
            return false;
        }
        
        return true;
    }
}
```

## Chaos Engineering Best Practices

### 1. Safe Failure Injection
```java
// Safety Controls
@Component
public class ChaosSafetyController {
    
    public boolean validateExperimentSafety(ChaosExperiment experiment) {
        List<SafetyCheck> checks = List.of(
            new LoadLevelCheck(),
            new ActiveIncidentCheck(),
            new DeploymentWindowCheck(),
            new BusinessHoursCheck(),
            new ResourceAvailabilityCheck()
        );
        
        for (SafetyCheck check : checks) {
            SafetyCheckResult result = check.execute(experiment);
            if (!result.isSafe()) {
                log.warn("Safety check failed: {} - {}", 
                    check.getName(), result.getReason());
                return false;
            }
        }
        
        return true;
    }
    
    @Component
    public static class LoadLevelCheck implements SafetyCheck {
        @Override
        public SafetyCheckResult execute(ChaosExperiment experiment) {
            double currentCPU = systemMetrics.getCurrentCPUUtilization();
            double currentMemory = systemMetrics.getCurrentMemoryUtilization();
            
            if (currentCPU > 80.0 || currentMemory > 80.0) {
                return SafetyCheckResult.unsafe(
                    String.format("High resource utilization: CPU=%.1f%%, Memory=%.1f%%", 
                        currentCPU, currentMemory)
                );
            }
            
            return SafetyCheckResult.safe();
        }
    }
}
```

### 2. Blast Radius Control
```java
// Blast Radius Management
@Component
public class BlastRadiusController {
    
    public BlastRadiusAssessment assessBlastRadius(ChaosExperiment experiment) {
        BlastRadiusAssessment assessment = new BlastRadiusAssessment();
        
        // Service dependency analizi
        Set<String> affectedServices = analyzeServiceDependencies(experiment.getTargetService());
        assessment.setAffectedServices(affectedServices);
        
        // User impact analizi
        UserImpactAssessment userImpact = analyzeUserImpact(affectedServices);
        assessment.setUserImpact(userImpact);
        
        // Business process impact
        BusinessProcessImpact businessImpact = analyzeBusinessProcessImpact(affectedServices);
        assessment.setBusinessImpact(businessImpact);
        
        // Risk level hesaplama
        RiskLevel riskLevel = calculateRiskLevel(assessment);
        assessment.setRiskLevel(riskLevel);
        
        return assessment;
    }
    
    private Set<String> analyzeServiceDependencies(String targetService) {
        // Service mesh'ten dependency graph'ı al
        ServiceDependencyGraph graph = serviceMeshService.getDependencyGraph();
        
        // Downstream dependencies
        Set<String> downstreamServices = graph.getDownstreamServices(targetService);
        
        // Critical path analysis
        Set<String> criticalPathServices = graph.getCriticalPathServices(targetService);
        
        Set<String> allAffected = new HashSet<>();
        allAffected.addAll(downstreamServices);
        allAffected.addAll(criticalPathServices);
        
        return allAffected;
    }
    
    public boolean isBlastRadiusAcceptable(BlastRadiusAssessment assessment) {
        // Risk level kontrolü
        if (assessment.getRiskLevel() == RiskLevel.HIGH) {
            return false;
        }
        
        // User impact kontrolü
        if (assessment.getUserImpact().getAffectedUserPercentage() > 10.0) {
            return false;
        }
        
        // Business impact kontrolü
        if (assessment.getBusinessImpact().getRevenueImpactPercentage() > 5.0) {
            return false;
        }
        
        return true;
    }
}
```

### 3. Monitoring ve Observability
```java
// Chaos Experiment Monitoring
@Component
public class ChaosExperimentMonitor {
    
    @EventListener
    public void onExperimentStarted(ChaosExperimentStartedEvent event) {
        ChaosExperiment experiment = event.getExperiment();
        
        // Monitoring setup
        setupExperimentMonitoring(experiment);
        
        // Alert suppression (experiment süresince)
        alertSuppressionService.suppressAlerts(
            experiment.getTargetService(), 
            experiment.getDuration()
        );
        
        // Stakeholder notification
        notificationService.notifyExperimentStart(experiment);
    }
    
    private void setupExperimentMonitoring(ChaosExperiment experiment) {
        MonitoringConfiguration config = MonitoringConfiguration.builder()
            .targetService(experiment.getTargetService())
            .metricsToTrack(List.of(
                "response_time_p95",
                "error_rate",
                "throughput",
                "cpu_utilization",
                "memory_utilization"
            ))
            .samplingInterval(Duration.ofSeconds(10))
            .duration(experiment.getDuration())
            .build();
            
        experimentMonitoringService.startMonitoring(experiment.getId(), config);
    }
    
    @EventListener
    public void onExperimentCompleted(ChaosExperimentCompletedEvent event) {
        ChaosExperiment experiment = event.getExperiment();
        
        // Monitoring cleanup
        experimentMonitoringService.stopMonitoring(experiment.getId());
        
        // Alert suppression cleanup
        alertSuppressionService.removeSuppressions(experiment.getTargetService());
        
        // Results analysis
        ExperimentAnalysis analysis = analyzeExperimentResults(experiment);
        
        // Report generation
        generateExperimentReport(experiment, analysis);
    }
    
    private ExperimentAnalysis analyzeExperimentResults(ChaosExperiment experiment) {
        List<ServiceMetrics> metrics = experimentMonitoringService.getMetrics(experiment.getId());
        
        ExperimentAnalysis analysis = new ExperimentAnalysis();
        
        // Performance impact analysis
        PerformanceImpact performanceImpact = analyzePerformanceImpact(metrics);
        analysis.setPerformanceImpact(performanceImpact);
        
        // System behavior analysis
        SystemBehavior behavior = analyzeSystemBehavior(metrics);
        analysis.setSystemBehavior(behavior);
        
        // Recovery analysis
        RecoveryAnalysis recovery = analyzeRecoveryBehavior(metrics, experiment);
        analysis.setRecoveryAnalysis(recovery);
        
        return analysis;
    }
}
```

## Chaos Engineering Metrics

### 1. Experiment Success Metrics
```java
// Chaos Metrics Collection
@Component
public class ChaosMetricsCollector {
    
    private final MeterRegistry meterRegistry;
    
    public ChaosMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordExperimentExecution(ChaosExperiment experiment, ExperimentResult result) {
        // Experiment count
        Counter.builder("chaos_experiments_total")
            .description("Total number of chaos experiments executed")
            .tag("service", experiment.getTargetService())
            .tag("type", experiment.getMethod().getType())
            .tag("status", result.isSuccess() ? "success" : "failure")
            .register(meterRegistry)
            .increment();
            
        // Experiment duration
        Timer.builder("chaos_experiment_duration_seconds")
            .description("Duration of chaos experiments")
            .tag("service", experiment.getTargetService())
            .tag("type", experiment.getMethod().getType())
            .register(meterRegistry)
            .record(experiment.getDuration());
            
        // MTTR during experiment
        if (result.getIncidentsDetected() > 0) {
            Gauge.builder("chaos_experiment_mttr_seconds")
                .description("Mean time to recovery during chaos experiment")
                .tag("service", experiment.getTargetService())
                .register(meterRegistry, result, r -> r.getMeanTimeToRecovery().getSeconds());
        }
        
        // System resilience score
        Gauge.builder("chaos_system_resilience_score")
            .description("System resilience score based on chaos experiments")
            .tag("service", experiment.getTargetService())
            .register(meterRegistry, result, r -> r.getResilienceScore());
    }
    
    public void recordBlastRadiusMetrics(BlastRadiusAssessment assessment) {
        Gauge.builder("chaos_blast_radius_affected_services")
            .description("Number of services affected by chaos experiment")
            .register(meterRegistry, assessment, a -> a.getAffectedServices().size());
            
        Gauge.builder("chaos_blast_radius_user_impact_percentage")
            .description("Percentage of users affected by chaos experiment")
            .register(meterRegistry, assessment, a -> a.getUserImpact().getAffectedUserPercentage());
    }
}
```

### 2. Resilience Scoring
```java
// System Resilience Scorer
@Component
public class SystemResilienceScorer {
    
    public ResilienceScore calculateResilienceScore(String serviceName, Duration period) {
        List<ChaosExperiment> experiments = getExperimentsForPeriod(serviceName, period);
        
        if (experiments.isEmpty()) {
            return ResilienceScore.noData();
        }
        
        double recoveryScore = calculateRecoveryScore(experiments);
        double performanceScore = calculatePerformanceScore(experiments);
        double availabilityScore = calculateAvailabilityScore(experiments);
        double errorHandlingScore = calculateErrorHandlingScore(experiments);
        
        double overallScore = (recoveryScore + performanceScore + availabilityScore + errorHandlingScore) / 4.0;
        
        return ResilienceScore.builder()
            .serviceName(serviceName)
            .period(period)
            .overallScore(overallScore)
            .recoveryScore(recoveryScore)
            .performanceScore(performanceScore)
            .availabilityScore(availabilityScore)
            .errorHandlingScore(errorHandlingScore)
            .experimentCount(experiments.size())
            .calculatedAt(Instant.now())
            .build();
    }
    
    private double calculateRecoveryScore(List<ChaosExperiment> experiments) {
        List<Duration> recoveryTimes = experiments.stream()
            .filter(exp -> exp.getResults() != null)
            .flatMap(exp -> exp.getResults().stream())
            .filter(result -> result.getRecoveryTime() != null)
            .map(ExperimentResult::getRecoveryTime)
            .collect(Collectors.toList());
            
        if (recoveryTimes.isEmpty()) {
            return 0.0;
        }
        
        Duration averageRecoveryTime = calculateAverage(recoveryTimes);
        
        // Score: 100 için <30s, 0 için >300s
        double seconds = averageRecoveryTime.getSeconds();
        if (seconds <= 30) {
            return 100.0;
        } else if (seconds >= 300) {
            return 0.0;
        } else {
            return 100.0 - ((seconds - 30) / 270.0) * 100.0;
        }
    }
}
```

## Continuous Chaos Engineering

### 1. Chaos as Code
```yaml
# chaos-experiment-config.yaml
apiVersion: chaos.engineering/v1
kind: ChaosExperiment
metadata:
  name: user-service-resilience-test
  namespace: production
spec:
  schedule: "0 10 * * TUE"  # Her Salı 10:00
  hypothesis:
    description: "User service should maintain <200ms P95 latency during pod failures"
    steadyStateMetrics:
      - name: "p95_latency"
        query: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service=\"user-service\"}[5m]))"
        threshold: 0.2
      - name: "error_rate"
        query: "rate(http_requests_total{service=\"user-service\",status=~\"5..\"}[5m])"
        threshold: 0.01
  experiment:
    type: "pod-failure"
    target:
      namespace: "production"
      labelSelector:
        app: "user-service"
    configuration:
      killPercentage: 25
      duration: "5m"
  safety:
    minReplicas: 3
    maxConcurrentExperiments: 1
    businessHoursOnly: true
    excludeWeekends: true
```

### 2. GitOps Integration
```java
// Chaos Experiment GitOps Controller
@Component
public class ChaosExperimentController {
    
    @EventListener
    public void onChaosConfigurationChange(GitRepositoryChangeEvent event) {
        if (!event.getChangedFiles().stream()
                .anyMatch(file -> file.startsWith("chaos-experiments/"))) {
            return;
        }
        
        List<ChaosExperimentConfig> configs = parseConfigFiles(event.getChangedFiles());
        
        for (ChaosExperimentConfig config : configs) {
            if (config.isDeleted()) {
                deactivateExperiment(config.getName());
            } else {
                deployOrUpdateExperiment(config);
            }
        }
    }
    
    private void deployOrUpdateExperiment(ChaosExperimentConfig config) {
        // Validation
        validateExperimentConfig(config);
        
        // Safety checks
        if (!chaosConfigValidator.isConfigSafe(config)) {
            throw new UnsafeExperimentConfigException(
                "Experiment configuration is not safe: " + config.getName()
            );
        }
        
        // Deploy experiment
        ChaosExperiment experiment = chaosExperimentFactory.createFromConfig(config);
        chaosExperimentRepository.save(experiment);
        
        // Schedule execution
        chaosScheduler.scheduleExperiment(experiment);
        
        log.info("Chaos experiment deployed: {}", config.getName());
    }
}
```

Chaos Engineering, sistem dayanıklılığını proaktif olarak test etmenin ve iyileştirmenin güçlü bir yoludur. Doğru implementasyon ile beklenmedik durumlar karşısında daha güvenilir sistemler inşa edebilirsiniz.
