# Capacity Planning

Capacity Planning, sistem kaynaklarının gelecekteki ihtiyaçları karşılayacak şekilde planlanması ve ölçeklendirilmesidir. Etkili kapasite planlaması, performans sorunlarını önler, maliyetleri optimize eder ve kullanıcı deneyimini garanti altına alır.

## Capacity Planning Temelleri

### 1. Kapasite Modelleme

#### Historical Data Analysis
```java
// Historical Capacity Analyzer
@Service
public class HistoricalCapacityAnalyzer {
    
    @Autowired
    private MetricsRepository metricsRepository;
    
    public CapacityTrendAnalysis analyzeHistoricalTrends(String serviceName, Duration period) {
        LocalDateTime endDate = LocalDateTime.now();
        LocalDateTime startDate = endDate.minus(period);
        
        List<ServiceMetrics> historicalMetrics = metricsRepository
            .findByServiceNameAndTimestampBetween(serviceName, startDate, endDate);
        
        CapacityTrendAnalysis analysis = new CapacityTrendAnalysis();
        
        // CPU utilization trends
        CPUTrend cpuTrend = analyzeCPUTrend(historicalMetrics);
        analysis.setCpuTrend(cpuTrend);
        
        // Memory utilization trends
        MemoryTrend memoryTrend = analyzeMemoryTrend(historicalMetrics);
        analysis.setMemoryTrend(memoryTrend);
        
        // Network I/O trends
        NetworkTrend networkTrend = analyzeNetworkTrend(historicalMetrics);
        analysis.setNetworkTrend(networkTrend);
        
        // Storage trends
        StorageTrend storageTrend = analyzeStorageTrend(historicalMetrics);
        analysis.setStorageTrend(storageTrend);
        
        // Traffic patterns
        TrafficPattern trafficPattern = analyzeTrafficPattern(historicalMetrics);
        analysis.setTrafficPattern(trafficPattern);
        
        return analysis;
    }
    
    private CPUTrend analyzeCPUTrend(List<ServiceMetrics> metrics) {
        List<Double> cpuValues = metrics.stream()
            .map(ServiceMetrics::getCpuUtilization)
            .collect(Collectors.toList());
        
        LinearRegressionResult regression = performLinearRegression(cpuValues);
        
        return CPUTrend.builder()
            .averageUtilization(cpuValues.stream().mapToDouble(Double::doubleValue).average().orElse(0.0))
            .peakUtilization(cpuValues.stream().mapToDouble(Double::doubleValue).max().orElse(0.0))
            .growthRate(regression.getSlope())
            .correlation(regression.getCorrelation())
            .projectedUtilization(projectFutureUtilization(cpuValues, Duration.ofDays(30)))
            .build();
    }
    
    private double projectFutureUtilization(List<Double> historicalValues, Duration projectionPeriod) {
        LinearRegressionResult regression = performLinearRegression(historicalValues);
        double daysToProject = projectionPeriod.toDays();
        double currentValue = historicalValues.get(historicalValues.size() - 1);
        
        return currentValue + (regression.getSlope() * daysToProject);
    }
}
```

#### Seasonal Pattern Detection
```java
// Seasonal Pattern Analyzer
@Component
public class SeasonalPatternAnalyzer {
    
    public SeasonalAnalysis analyzeSeasonalPatterns(String serviceName, Duration analysisWindow) {
        List<ServiceMetrics> yearlyMetrics = getYearlyMetrics(serviceName);
        
        SeasonalAnalysis analysis = new SeasonalAnalysis();
        
        // Daily patterns
        DailyPattern dailyPattern = extractDailyPattern(yearlyMetrics);
        analysis.setDailyPattern(dailyPattern);
        
        // Weekly patterns
        WeeklyPattern weeklyPattern = extractWeeklyPattern(yearlyMetrics);
        analysis.setWeeklyPattern(weeklyPattern);
        
        // Monthly patterns
        MonthlyPattern monthlyPattern = extractMonthlyPattern(yearlyMetrics);
        analysis.setMonthlyPattern(monthlyPattern);
        
        // Holiday impacts
        HolidayImpactAnalysis holidayImpact = analyzeHolidayImpacts(yearlyMetrics);
        analysis.setHolidayImpact(holidayImpact);
        
        // Special events
        SpecialEventAnalysis specialEvents = analyzeSpecialEvents(yearlyMetrics);
        analysis.setSpecialEvents(specialEvents);
        
        return analysis;
    }
    
    private DailyPattern extractDailyPattern(List<ServiceMetrics> metrics) {
        Map<Integer, List<Double>> hourlyTraffic = metrics.stream()
            .collect(Collectors.groupingBy(
                metric -> metric.getTimestamp().getHour(),
                Collectors.mapping(ServiceMetrics::getRequestsPerSecond, Collectors.toList())
            ));
        
        Map<Integer, Double> avgTrafficByHour = hourlyTraffic.entrySet().stream()
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                entry -> entry.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)
            ));
        
        // Peak hours detection
        List<Integer> peakHours = avgTrafficByHour.entrySet().stream()
            .filter(entry -> entry.getValue() > getTrafficThreshold(avgTrafficByHour))
            .map(Map.Entry::getKey)
            .sorted()
            .collect(Collectors.toList());
        
        return DailyPattern.builder()
            .avgTrafficByHour(avgTrafficByHour)
            .peakHours(peakHours)
            .peakTrafficMultiplier(calculatePeakMultiplier(avgTrafficByHour))
            .lowTrafficHours(getLowTrafficHours(avgTrafficByHour))
            .build();
    }
}
```

### 2. Load Forecasting

#### Machine Learning Based Forecasting
```java
// Load Forecasting Service
@Service
public class LoadForecastingService {
    
    @Autowired
    private TimeSeriesAnalyzer timeSeriesAnalyzer;
    
    @Autowired
    private MachineLearningPredictor mlPredictor;
    
    public LoadForecast generateLoadForecast(LoadForecastRequest request) {
        String serviceName = request.getServiceName();
        Duration forecastHorizon = request.getForecastHorizon();
        
        // Historical data preparation
        TimeSeriesData historicalData = prepareTimeSeriesData(serviceName, Duration.ofDays(90));
        
        // Multiple forecasting models
        List<ForecastModel> models = List.of(
            new ARIMAModel(),
            new LinearRegressionModel(),
            new RandomForestModel(),
            new LSTMNeuralNetworkModel()
        );
        
        List<ForecastResult> modelResults = new ArrayList<>();
        
        for (ForecastModel model : models) {
            ForecastResult result = model.forecast(historicalData, forecastHorizon);
            modelResults.add(result);
        }
        
        // Ensemble forecasting
        ForecastResult ensembleResult = combineForecasts(modelResults);
        
        // Confidence intervals
        ConfidenceInterval confidenceInterval = calculateConfidenceInterval(ensembleResult);
        
        return LoadForecast.builder()
            .serviceName(serviceName)
            .forecastHorizon(forecastHorizon)
            .predictedLoad(ensembleResult.getPredictedValues())
            .confidenceInterval(confidenceInterval)
            .modelAccuracy(ensembleResult.getAccuracy())
            .seasonalFactors(extractSeasonalFactors(historicalData))
            .trendFactors(extractTrendFactors(historicalData))
            .generatedAt(Instant.now())
            .build();
    }
    
    private ForecastResult combineForecasts(List<ForecastResult> modelResults) {
        // Weighted ensemble based on model accuracy
        Map<ForecastModel, Double> weights = calculateModelWeights(modelResults);
        
        List<Double> ensemblePredictions = new ArrayList<>();
        
        int forecastLength = modelResults.get(0).getPredictedValues().size();
        
        for (int i = 0; i < forecastLength; i++) {
            double weightedSum = 0.0;
            double totalWeight = 0.0;
            
            for (ForecastResult result : modelResults) {
                double weight = weights.get(result.getModel());
                weightedSum += result.getPredictedValues().get(i) * weight;
                totalWeight += weight;
            }
            
            ensemblePredictions.add(weightedSum / totalWeight);
        }
        
        return ForecastResult.builder()
            .predictedValues(ensemblePredictions)
            .accuracy(calculateEnsembleAccuracy(modelResults))
            .model(new EnsembleModel(modelResults))
            .build();
    }
}
```

#### Business Growth Integration
```java
// Business Growth Factor Integration
@Component
public class BusinessGrowthIntegrator {
    
    public AdjustedLoadForecast integrateBusinessFactors(LoadForecast baseForecast, BusinessGrowthFactors factors) {
        List<Double> adjustedPredictions = new ArrayList<>();
        
        List<Double> basePredictions = baseForecast.getPredictedLoad();
        
        for (int i = 0; i < basePredictions.size(); i++) {
            double basePrediction = basePredictions.get(i);
            double timeOffsetDays = i; // i-th day in the future
            
            // Apply growth factors
            double growthMultiplier = calculateGrowthMultiplier(factors, timeOffsetDays);
            double adjustedPrediction = basePrediction * growthMultiplier;
            
            adjustedPredictions.add(adjustedPrediction);
        }
        
        return AdjustedLoadForecast.builder()
            .baseForecast(baseForecast)
            .adjustedPredictions(adjustedPredictions)
            .growthFactors(factors)
            .adjustmentRatio(calculateAverageAdjustmentRatio(basePredictions, adjustedPredictions))
            .build();
    }
    
    private double calculateGrowthMultiplier(BusinessGrowthFactors factors, double timeOffsetDays) {
        double baseGrowthRate = factors.getAnnualGrowthRate();
        
        // Product launch impact
        double productLaunchImpact = calculateProductLaunchImpact(factors, timeOffsetDays);
        
        // Marketing campaign impact
        double marketingImpact = calculateMarketingImpact(factors, timeOffsetDays);
        
        // Seasonal business factors
        double seasonalFactor = calculateSeasonalBusinessFactor(factors, timeOffsetDays);
        
        // Geographic expansion
        double expansionFactor = calculateExpansionFactor(factors, timeOffsetDays);
        
        double dailyGrowthRate = Math.pow(1 + baseGrowthRate, 1.0 / 365.0) - 1;
        double baseMultiplier = Math.pow(1 + dailyGrowthRate, timeOffsetDays);
        
        return baseMultiplier * productLaunchImpact * marketingImpact * seasonalFactor * expansionFactor;
    }
}
```

## Capacity Planning Strategies

### 1. Proactive Scaling
```java
// Proactive Scaling Service
@Service
public class ProactiveScalingService {
    
    @Autowired
    private LoadForecastingService forecastingService;
    
    @Autowired
    private KubernetesScalingService k8sScalingService;
    
    @Scheduled(fixedRate = 3600000) // Her saat
    public void evaluateProactiveScaling() {
        List<String> monitoredServices = getMonitoredServices();
        
        for (String serviceName : monitoredServices) {
            ProactiveScalingDecision decision = evaluateScalingNeed(serviceName);
            
            if (decision.isScalingNeeded()) {
                executeProactiveScaling(serviceName, decision);
            }
        }
    }
    
    private ProactiveScalingDecision evaluateScalingNeed(String serviceName) {
        // 4 saatlik forecast al
        LoadForecast forecast = forecastingService.generateLoadForecast(
            LoadForecastRequest.builder()
                .serviceName(serviceName)
                .forecastHorizon(Duration.ofHours(4))
                .build()
        );
        
        // Mevcut kapasite
        ServiceCapacity currentCapacity = getCurrentServiceCapacity(serviceName);
        
        // Capacity utilization projections
        List<Double> projectedUtilization = calculateProjectedUtilization(forecast, currentCapacity);
        
        // Scaling triggers
        ScalingTriggers triggers = getScalingTriggers(serviceName);
        
        ProactiveScalingDecision decision = new ProactiveScalingDecision();
        
        // Scale up scenarios
        if (willExceedCapacity(projectedUtilization, triggers.getScaleUpThreshold())) {
            int requiredReplicas = calculateRequiredReplicas(forecast, triggers);
            decision.setScalingNeeded(true);
            decision.setScalingDirection(ScalingDirection.UP);
            decision.setTargetReplicas(requiredReplicas);
            decision.setReason("Predicted capacity utilization will exceed threshold");
        }
        
        // Scale down scenarios
        else if (willBeUnderutilized(projectedUtilization, triggers.getScaleDownThreshold())) {
            int optimalReplicas = calculateOptimalReplicas(forecast, triggers);
            decision.setScalingNeeded(true);
            decision.setScalingDirection(ScalingDirection.DOWN);
            decision.setTargetReplicas(optimalReplicas);
            decision.setReason("Predicted capacity utilization allows for optimization");
        }
        
        return decision;
    }
    
    private void executeProactiveScaling(String serviceName, ProactiveScalingDecision decision) {
        ScalingAction action = ScalingAction.builder()
            .serviceName(serviceName)
            .currentReplicas(getCurrentReplicaCount(serviceName))
            .targetReplicas(decision.getTargetReplicas())
            .reason(decision.getReason())
            .executedAt(Instant.now())
            .type(ScalingType.PROACTIVE)
            .build();
        
        // Execute scaling
        k8sScalingService.scaleService(serviceName, decision.getTargetReplicas());
        
        // Log scaling action
        scalingActionRepository.save(action);
        
        // Send notification
        notificationService.sendScalingNotification(action);
        
        log.info("Proactive scaling executed for service {}: {} -> {} replicas ({})",
            serviceName, action.getCurrentReplicas(), action.getTargetReplicas(), decision.getReason());
    }
}
```

### 2. Cost-Aware Capacity Planning
```java
// Cost-Aware Capacity Planner
@Component
public class CostAwareCapacityPlanner {
    
    public CapacityPlan createCostOptimizedPlan(CapacityPlanningRequest request) {
        String serviceName = request.getServiceName();
        Duration planningHorizon = request.getPlanningHorizon();
        CostConstraints costConstraints = request.getCostConstraints();
        
        // Load forecast
        LoadForecast loadForecast = forecastingService.generateLoadForecast(
            LoadForecastRequest.builder()
                .serviceName(serviceName)
                .forecastHorizon(planningHorizon)
                .build()
        );
        
        // Infrastructure options analysis
        List<InfrastructureOption> options = analyzeInfrastructureOptions(serviceName, loadForecast);
        
        // Cost modeling for each option
        List<CostModel> costModels = options.stream()
            .map(option -> createCostModel(option, loadForecast, planningHorizon))
            .collect(Collectors.toList());
        
        // Multi-objective optimization
        OptimizationResult optimization = optimizeCapacityPlan(costModels, costConstraints);
        
        return CapacityPlan.builder()
            .serviceName(serviceName)
            .planningHorizon(planningHorizon)
            .recommendedInfrastructure(optimization.getOptimalOption())
            .costProjection(optimization.getCostProjection())
            .performanceProjection(optimization.getPerformanceProjection())
            .riskAssessment(optimization.getRiskAssessment())
            .alternativeOptions(optimization.getAlternativeOptions())
            .createdAt(Instant.now())
            .build();
    }
    
    private List<InfrastructureOption> analyzeInfrastructureOptions(String serviceName, LoadForecast forecast) {
        List<InfrastructureOption> options = new ArrayList<>();
        
        // Current setup optimization
        options.add(optimizeCurrentSetup(serviceName, forecast));
        
        // Vertical scaling option
        options.add(createVerticalScalingOption(serviceName, forecast));
        
        // Horizontal scaling option
        options.add(createHorizontalScalingOption(serviceName, forecast));
        
        // Auto-scaling option
        options.add(createAutoScalingOption(serviceName, forecast));
        
        // Spot instance option
        options.add(createSpotInstanceOption(serviceName, forecast));
        
        // Reserved instance option
        options.add(createReservedInstanceOption(serviceName, forecast));
        
        // Serverless option
        if (isServerlessViable(serviceName, forecast)) {
            options.add(createServerlessOption(serviceName, forecast));
        }
        
        return options;
    }
    
    private CostModel createCostModel(InfrastructureOption option, LoadForecast forecast, Duration horizon) {
        CostModel model = new CostModel();
        
        // Compute costs
        ComputeCost computeCost = calculateComputeCost(option, forecast, horizon);
        model.setComputeCost(computeCost);
        
        // Storage costs
        StorageCost storageCost = calculateStorageCost(option, forecast, horizon);
        model.setStorageCost(storageCost);
        
        // Network costs
        NetworkCost networkCost = calculateNetworkCost(option, forecast, horizon);
        model.setNetworkCost(networkCost);
        
        // Operational costs
        OperationalCost operationalCost = calculateOperationalCost(option, horizon);
        model.setOperationalCost(operationalCost);
        
        // Total cost
        double totalCost = computeCost.getTotal() + storageCost.getTotal() + 
                          networkCost.getTotal() + operationalCost.getTotal();
        model.setTotalCost(totalCost);
        
        return model;
    }
}
```

### 3. Multi-Environment Capacity Planning
```java
// Multi-Environment Capacity Coordinator
@Service
public class MultiEnvironmentCapacityCoordinator {
    
    public GlobalCapacityPlan createGlobalCapacityPlan(GlobalCapacityRequest request) {
        List<Environment> environments = request.getEnvironments();
        Duration planningHorizon = request.getPlanningHorizon();
        
        GlobalCapacityPlan globalPlan = new GlobalCapacityPlan();
        
        // Environment-specific plans
        Map<Environment, CapacityPlan> environmentPlans = new HashMap<>();
        
        for (Environment env : environments) {
            CapacityPlan envPlan = createEnvironmentCapacityPlan(env, planningHorizon);
            environmentPlans.put(env, envPlan);
        }
        
        globalPlan.setEnvironmentPlans(environmentPlans);
        
        // Cross-environment optimization
        CrossEnvironmentOptimization optimization = optimizeAcrossEnvironments(environmentPlans);
        globalPlan.setOptimization(optimization);
        
        // Resource sharing opportunities
        ResourceSharingAnalysis sharingAnalysis = analyzeResourceSharingOpportunities(environmentPlans);
        globalPlan.setResourceSharing(sharingAnalysis);
        
        // Disaster recovery planning
        DisasterRecoveryPlan drPlan = createDisasterRecoveryPlan(environmentPlans);
        globalPlan.setDisasterRecoveryPlan(drPlan);
        
        return globalPlan;
    }
    
    private CrossEnvironmentOptimization optimizeAcrossEnvironments(Map<Environment, CapacityPlan> plans) {
        CrossEnvironmentOptimization optimization = new CrossEnvironmentOptimization();
        
        // Workload migration opportunities
        List<WorkloadMigrationOpportunity> migrationOpportunities = 
            identifyWorkloadMigrationOpportunities(plans);
        optimization.setMigrationOpportunities(migrationOpportunities);
        
        // Shared resource pools
        List<SharedResourcePool> sharedPools = identifySharedResourcePools(plans);
        optimization.setSharedResourcePools(sharedPools);
        
        // Cost arbitrage opportunities
        List<CostArbitrageOpportunity> arbitrageOpportunities = 
            identifyCostArbitrageOpportunities(plans);
        optimization.setArbitrageOpportunities(arbitrageOpportunities);
        
        return optimization;
    }
    
    private List<WorkloadMigrationOpportunity> identifyWorkloadMigrationOpportunities(
            Map<Environment, CapacityPlan> plans) {
        
        List<WorkloadMigrationOpportunity> opportunities = new ArrayList<>();
        
        for (Map.Entry<Environment, CapacityPlan> sourceEntry : plans.entrySet()) {
            Environment sourceEnv = sourceEntry.getKey();
            CapacityPlan sourcePlan = sourceEntry.getValue();
            
            for (Map.Entry<Environment, CapacityPlan> targetEntry : plans.entrySet()) {
                Environment targetEnv = targetEntry.getKey();
                CapacityPlan targetPlan = targetEntry.getValue();
                
                if (sourceEnv.equals(targetEnv)) continue;
                
                // Analyze migration viability
                MigrationAnalysis analysis = analyzeMigrationViability(sourcePlan, targetPlan);
                
                if (analysis.isViable() && analysis.getCostSavings() > 0) {
                    WorkloadMigrationOpportunity opportunity = WorkloadMigrationOpportunity.builder()
                        .sourceEnvironment(sourceEnv)
                        .targetEnvironment(targetEnv)
                        .workloadServices(analysis.getMigratableServices())
                        .costSavings(analysis.getCostSavings())
                        .migrationCost(analysis.getMigrationCost())
                        .netBenefit(analysis.getCostSavings() - analysis.getMigrationCost())
                        .riskLevel(analysis.getRiskLevel())
                        .build();
                        
                    opportunities.add(opportunity);
                }
            }
        }
        
        return opportunities.stream()
            .sorted(Comparator.comparing(WorkloadMigrationOpportunity::getNetBenefit).reversed())
            .collect(Collectors.toList());
    }
}
```

## Capacity Monitoring ve Alerting

### 1. Real-time Capacity Monitoring
```java
// Real-time Capacity Monitor
@Component
public class RealTimeCapacityMonitor {
    
    private final MeterRegistry meterRegistry;
    
    @EventListener
    public void onCapacityMetricsUpdate(CapacityMetricsUpdateEvent event) {
        CapacityMetrics metrics = event.getMetrics();
        String serviceName = metrics.getServiceName();
        
        // Current utilization tracking
        Gauge.builder("capacity_utilization_percentage")
            .description("Current capacity utilization percentage")
            .tag("service", serviceName)
            .tag("resource", "cpu")
            .register(meterRegistry, metrics, m -> m.getCpuUtilization());
            
        Gauge.builder("capacity_utilization_percentage")
            .description("Current capacity utilization percentage")
            .tag("service", serviceName)
            .tag("resource", "memory")
            .register(meterRegistry, metrics, m -> m.getMemoryUtilization());
        
        // Available capacity tracking
        Gauge.builder("capacity_available_units")
            .description("Available capacity units")
            .tag("service", serviceName)
            .tag("resource", "cpu")
            .register(meterRegistry, metrics, m -> m.getAvailableCPU());
            
        // Projected time to capacity exhaustion
        double timeToExhaustion = calculateTimeToCapacityExhaustion(metrics);
        Gauge.builder("capacity_time_to_exhaustion_hours")
            .description("Projected time to capacity exhaustion in hours")
            .tag("service", serviceName)
            .register(meterRegistry, timeToExhaustion);
        
        // Capacity efficiency metrics
        double efficiency = calculateCapacityEfficiency(metrics);
        Gauge.builder("capacity_efficiency_ratio")
            .description("Capacity efficiency ratio")
            .tag("service", serviceName)
            .register(meterRegistry, efficiency);
    }
    
    @Scheduled(fixedRate = 300000) // Her 5 dakika
    public void evaluateCapacityAlerts() {
        List<String> services = getMonitoredServices();
        
        for (String serviceName : services) {
            CapacityMetrics currentMetrics = getCurrentCapacityMetrics(serviceName);
            CapacityThresholds thresholds = getCapacityThresholds(serviceName);
            
            evaluateAndSendAlerts(serviceName, currentMetrics, thresholds);
        }
    }
    
    private void evaluateAndSendAlerts(String serviceName, CapacityMetrics metrics, CapacityThresholds thresholds) {
        // High utilization alert
        if (metrics.getCpuUtilization() > thresholds.getCpuWarningThreshold()) {
            CapacityAlert alert = CapacityAlert.builder()
                .serviceName(serviceName)
                .alertType(CapacityAlertType.HIGH_CPU_UTILIZATION)
                .severity(metrics.getCpuUtilization() > thresholds.getCpuCriticalThreshold() ? 
                    AlertSeverity.CRITICAL : AlertSeverity.WARNING)
                .message(String.format("CPU utilization %.1f%% exceeds threshold %.1f%%", 
                    metrics.getCpuUtilization(), thresholds.getCpuWarningThreshold()))
                .currentValue(metrics.getCpuUtilization())
                .threshold(thresholds.getCpuWarningThreshold())
                .build();
                
            capacityAlertService.sendAlert(alert);
        }
        
        // Projected capacity exhaustion alert
        double timeToExhaustion = calculateTimeToCapacityExhaustion(metrics);
        if (timeToExhaustion < thresholds.getTimeToExhaustionWarningHours()) {
            CapacityAlert alert = CapacityAlert.builder()
                .serviceName(serviceName)
                .alertType(CapacityAlertType.PROJECTED_CAPACITY_EXHAUSTION)
                .severity(timeToExhaustion < thresholds.getTimeToExhaustionCriticalHours() ? 
                    AlertSeverity.CRITICAL : AlertSeverity.WARNING)
                .message(String.format("Projected capacity exhaustion in %.1f hours", timeToExhaustion))
                .currentValue(timeToExhaustion)
                .threshold(thresholds.getTimeToExhaustionWarningHours())
                .build();
                
            capacityAlertService.sendAlert(alert);
        }
    }
}
```

### 2. Capacity Planning Dashboard
```java
// Capacity Planning Dashboard Service
@RestController
@RequestMapping("/api/capacity")
public class CapacityPlanningDashboardController {
    
    @GetMapping("/overview")
    public CapacityOverview getCapacityOverview() {
        CapacityOverview overview = new CapacityOverview();
        
        // Current capacity status
        Map<String, ServiceCapacityStatus> serviceStatuses = getAllServiceCapacityStatuses();
        overview.setServiceStatuses(serviceStatuses);
        
        // Global capacity metrics
        GlobalCapacityMetrics globalMetrics = calculateGlobalCapacityMetrics();
        overview.setGlobalMetrics(globalMetrics);
        
        // Capacity alerts
        List<CapacityAlert> activeAlerts = getActiveCapacityAlerts();
        overview.setActiveAlerts(activeAlerts);
        
        // Upcoming capacity events
        List<CapacityEvent> upcomingEvents = getUpcomingCapacityEvents();
        overview.setUpcomingEvents(upcomingEvents);
        
        return overview;
    }
    
    @GetMapping("/forecast/{serviceName}")
    public CapacityForecastResponse getServiceCapacityForecast(
            @PathVariable String serviceName,
            @RequestParam(defaultValue = "30") int forecastDays) {
        
        LoadForecast forecast = forecastingService.generateLoadForecast(
            LoadForecastRequest.builder()
                .serviceName(serviceName)
                .forecastHorizon(Duration.ofDays(forecastDays))
                .build()
        );
        
        CapacityRecommendations recommendations = 
            capacityRecommendationService.generateRecommendations(serviceName, forecast);
        
        return CapacityForecastResponse.builder()
            .serviceName(serviceName)
            .forecast(forecast)
            .recommendations(recommendations)
            .confidenceLevel(forecast.getConfidenceInterval().getLevel())
            .build();
    }
    
    @GetMapping("/cost-analysis")
    public CostAnalysisResponse getCostAnalysis(
            @RequestParam(required = false) List<String> services,
            @RequestParam(defaultValue = "90") int analysisDays) {
        
        if (services == null || services.isEmpty()) {
            services = getAllMonitoredServices();
        }
        
        CostAnalysisResponse response = new CostAnalysisResponse();
        
        for (String serviceName : services) {
            ServiceCostAnalysis costAnalysis = performServiceCostAnalysis(serviceName, analysisDays);
            response.addServiceAnalysis(serviceName, costAnalysis);
        }
        
        // Global cost optimization opportunities
        List<CostOptimizationOpportunity> opportunities = 
            identifyGlobalCostOptimizationOpportunities(services);
        response.setOptimizationOpportunities(opportunities);
        
        return response;
    }
}
```

## Best Practices

### 1. Capacity Planning Process
```java
// Capacity Planning Process Orchestrator
@Component
public class CapacityPlanningOrchestrator {
    
    @Scheduled(cron = "0 0 2 * * SUN") // Her Pazar 02:00'da
    public void weeklyCapacityPlanningReview() {
        log.info("Starting weekly capacity planning review");
        
        try {
            // 1. Collect and analyze historical data
            HistoricalAnalysisReport historicalReport = analyzeHistoricalData();
            
            // 2. Generate load forecasts
            Map<String, LoadForecast> serviceForecasts = generateServiceForecasts();
            
            // 3. Evaluate current capacity
            CapacityAssessmentReport currentCapacity = assessCurrentCapacity();
            
            // 4. Identify capacity gaps
            List<CapacityGap> capacityGaps = identifyCapacityGaps(serviceForecasts, currentCapacity);
            
            // 5. Generate recommendations
            List<CapacityRecommendation> recommendations = generateRecommendations(capacityGaps);
            
            // 6. Create capacity plan
            WeeklyCapacityPlan plan = createWeeklyCapacityPlan(recommendations);
            
            // 7. Send report to stakeholders
            sendCapacityPlanningReport(plan);
            
            // 8. Update capacity planning dashboard
            updateCapacityPlanningDashboard(plan);
            
        } catch (Exception e) {
            log.error("Weekly capacity planning review failed", e);
            alertService.sendCapacityPlanningAlert("Weekly capacity planning review failed: " + e.getMessage());
        }
    }
    
    private List<CapacityRecommendation> generateRecommendations(List<CapacityGap> gaps) {
        List<CapacityRecommendation> recommendations = new ArrayList<>();
        
        for (CapacityGap gap : gaps) {
            switch (gap.getType()) {
                case IMMEDIATE_SCALING_NEEDED:
                    recommendations.add(createImmediateScalingRecommendation(gap));
                    break;
                    
                case FUTURE_CAPACITY_SHORTAGE:
                    recommendations.add(createFutureCapacityRecommendation(gap));
                    break;
                    
                case RESOURCE_INEFFICIENCY:
                    recommendations.add(createEfficiencyRecommendation(gap));
                    break;
                    
                case COST_OPTIMIZATION_OPPORTUNITY:
                    recommendations.add(createCostOptimizationRecommendation(gap));
                    break;
            }
        }
        
        return recommendations.stream()
            .sorted(Comparator.comparing(CapacityRecommendation::getPriority).reversed())
            .collect(Collectors.toList());
    }
}
```

### 2. Capacity Planning Metrics
```yaml
# Prometheus capacity planning queries
capacity_planning_queries:
  # Current utilization
  cpu_utilization: |
    avg by (service) (
      rate(cpu_usage_seconds_total[5m]) / on(instance) cpu_count
    ) * 100
    
  memory_utilization: |
    avg by (service) (
      memory_usage_bytes / memory_limit_bytes
    ) * 100
    
  # Growth rate
  weekly_growth_rate: |
    (
      avg_over_time(http_requests_total[7d]) - 
      avg_over_time(http_requests_total[7d] offset 7d)
    ) / avg_over_time(http_requests_total[7d] offset 7d) * 100
    
  # Capacity headroom
  cpu_headroom: |
    100 - avg by (service) (
      rate(cpu_usage_seconds_total[5m]) / on(instance) cpu_count
    ) * 100
    
  # Time to capacity exhaustion
  time_to_exhaustion: |
    (
      100 - avg by (service)(rate(cpu_usage_seconds_total[5m]) / on(instance) cpu_count) * 100
    ) / (
      deriv(avg by (service)(rate(cpu_usage_seconds_total[5m]) / on(instance) cpu_count) * 100[1d])
    ) / 24
```

### 3. Automation
```java
// Automated Capacity Management
@Component
public class AutomatedCapacityManager {
    
    @EventListener
    public void onCapacityRecommendationGenerated(CapacityRecommendationEvent event) {
        CapacityRecommendation recommendation = event.getRecommendation();
        
        if (recommendation.isAutoApprovalEligible()) {
            executeAutomaticCapacityAction(recommendation);
        } else {
            requestManualApproval(recommendation);
        }
    }
    
    private void executeAutomaticCapacityAction(CapacityRecommendation recommendation) {
        switch (recommendation.getActionType()) {
            case SCALE_UP:
                executeAutomaticScaleUp(recommendation);
                break;
                
            case RESOURCE_OPTIMIZATION:
                executeAutomaticOptimization(recommendation);
                break;
                
            case COST_OPTIMIZATION:
                executeAutomaticCostOptimization(recommendation);
                break;
                
            default:
                log.warn("Unsupported automatic action type: {}", recommendation.getActionType());
        }
    }
    
    private boolean isAutoApprovalEligible(CapacityRecommendation recommendation) {
        // Safety checks
        if (recommendation.getRiskLevel() == RiskLevel.HIGH) {
            return false;
        }
        
        // Cost impact check
        if (recommendation.getCostImpact() > maxAutoApprovalCostImpact) {
            return false;
        }
        
        // Business hours check
        if (!isBusinessHours() && recommendation.getActionType().requiresBusinessHours()) {
            return false;
        }
        
        return true;
    }
}
```

Etkili capacity planning, sistem performansını garanti altına alırken maliyetleri optimize eden kritik bir SRE pratiğidir. Proaktif yaklaşım, veri odaklı kararlar ve otomasyonla sürdürülebilir büyüme sağlanabilir.
