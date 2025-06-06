# Chapter 11.1: Service Level Indicators (SLI), Service Level Objectives (SLO), and Service Level Agreements (SLA)

Service Level concepts form the foundation of Site Reliability Engineering (SRE) practices. These metrics help organizations measure and manage service reliability.

## 1. Service Level Indicators (SLI)

Service Level Indicators are quantitative measures of service performance and user experience.

### Common SLI Types

```yaml
# Prometheus metrics for SLI tracking
- name: availability_sli
  expr: |
    (sum(rate(http_requests_total{status!~"5.."}[5m])) / 
     sum(rate(http_requests_total[5m]))) * 100

- name: latency_sli
  expr: |
    histogram_quantile(0.95, 
      sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

- name: throughput_sli
  expr: |
    sum(rate(http_requests_total[5m]))

- name: error_rate_sli
  expr: |
    (sum(rate(http_requests_total{status=~"5.."}[5m])) / 
     sum(rate(http_requests_total[5m]))) * 100
```

### SLI Implementation in Spring Boot

```java
@Component
@Slf4j
public class SLICollector {
    
    private final MeterRegistry meterRegistry;
    private final Counter totalRequests;
    private final Counter errorRequests;
    private final Timer requestDuration;
    private final Gauge activeConnections;
    
    public SLICollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.totalRequests = Counter.builder("http_requests_total")
            .description("Total HTTP requests")
            .register(meterRegistry);
        this.errorRequests = Counter.builder("http_errors_total")
            .description("Total HTTP errors")
            .register(meterRegistry);
        this.requestDuration = Timer.builder("http_request_duration")
            .description("HTTP request duration")
            .register(meterRegistry);
        this.activeConnections = Gauge.builder("active_connections")
            .description("Active connections")
            .register(meterRegistry, this, SLICollector::getActiveConnections);
    }
    
    @EventListener
    public void handleHttpRequest(HttpRequestEvent event) {
        totalRequests.increment(
            Tags.of(
                "method", event.getMethod(),
                "endpoint", event.getEndpoint(),
                "status", String.valueOf(event.getStatus())
            )
        );
        
        if (event.getStatus() >= 500) {
            errorRequests.increment(
                Tags.of(
                    "method", event.getMethod(),
                    "endpoint", event.getEndpoint()
                )
            );
        }
        
        requestDuration.record(event.getDuration(), TimeUnit.MILLISECONDS);
    }
    
    public double getAvailabilitySLI() {
        return calculateAvailability("5m");
    }
    
    public double getLatencySLI() {
        return calculateLatencyPercentile(95.0, "5m");
    }
    
    public double getErrorRateSLI() {
        return calculateErrorRate("5m");
    }
    
    private double calculateAvailability(String timeWindow) {
        // Implementation for availability calculation
        return 99.95; // Placeholder
    }
    
    private double calculateLatencyPercentile(double percentile, String timeWindow) {
        // Implementation for latency percentile calculation
        return 150.0; // Placeholder
    }
    
    private double calculateErrorRate(String timeWindow) {
        // Implementation for error rate calculation
        return 0.1; // Placeholder
    }
    
    private double getActiveConnections() {
        // Implementation for active connections count
        return 0.0;
    }
}
```

### SLI Dashboard Configuration

```json
{
  "dashboard": {
    "id": "sli-dashboard",
    "title": "Service Level Indicators",
    "panels": [
      {
        "title": "Availability SLI",
        "type": "stat",
        "targets": [
          {
            "expr": "availability_sli",
            "legendFormat": "Availability %"
          }
        ],
        "thresholds": [
          { "color": "red", "value": 99.0 },
          { "color": "yellow", "value": 99.9 },
          { "color": "green", "value": 99.95 }
        ]
      },
      {
        "title": "Latency SLI (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "latency_sli",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate SLI",
        "type": "graph",
        "targets": [
          {
            "expr": "error_rate_sli",
            "legendFormat": "Error Rate %"
          }
        ]
      }
    ]
  }
}
```

## 2. Service Level Objectives (SLO)

Service Level Objectives define target performance levels for services based on SLI measurements.

### SLO Configuration

```yaml
slos:
  user_facing_service:
    availability:
      target: 99.9
      timeWindow: "30d"
      sli: "availability_sli"
    
    latency:
      target: 200
      timeWindow: "30d"
      sli: "latency_sli"
      unit: "ms"
    
    error_rate:
      target: 0.1
      timeWindow: "30d"
      sli: "error_rate_sli"
      unit: "%"

  background_service:
    availability:
      target: 99.0
      timeWindow: "30d"
      sli: "background_availability_sli"
    
    throughput:
      target: 1000
      timeWindow: "1h"
      sli: "background_throughput_sli"
      unit: "rps"
```

### SLO Monitoring Implementation

```java
@Service
@Slf4j
public class SLOMonitoringService {
    
    private final SLICollector sliCollector;
    private final AlertManager alertManager;
    private final Map<String, SLOConfiguration> sloConfigs;
    
    public SLOMonitoringService(SLICollector sliCollector, 
                               AlertManager alertManager,
                               SLOConfigurationProvider configProvider) {
        this.sliCollector = sliCollector;
        this.alertManager = alertManager;
        this.sloConfigs = configProvider.loadConfigurations();
    }
    
    @Scheduled(fixedDelay = 60000) // Check every minute
    public void checkSLOCompliance() {
        sloConfigs.forEach((service, config) -> {
            checkServiceSLO(service, config);
        });
    }
    
    private void checkServiceSLO(String service, SLOConfiguration config) {
        config.getSLOs().forEach(slo -> {
            double currentValue = getCurrentSLIValue(slo.getSliName());
            double errorBudget = calculateErrorBudget(slo, currentValue);
            
            SLOStatus status = evaluateSLOStatus(slo, currentValue, errorBudget);
            
            if (status.requiresAlert()) {
                alertManager.sendAlert(createSLOAlert(service, slo, status));
            }
            
            log.info("SLO Check - Service: {}, SLO: {}, Current: {}, Target: {}, Status: {}", 
                service, slo.getName(), currentValue, slo.getTarget(), status);
        });
    }
    
    public double calculateErrorBudget(SLO slo, double currentValue) {
        if (slo.getType() == SLOType.AVAILABILITY) {
            return calculateAvailabilityErrorBudget(slo, currentValue);
        } else if (slo.getType() == SLOType.LATENCY) {
            return calculateLatencyErrorBudget(slo, currentValue);
        } else if (slo.getType() == SLOType.ERROR_RATE) {
            return calculateErrorRateErrorBudget(slo, currentValue);
        }
        return 0.0;
    }
    
    private double calculateAvailabilityErrorBudget(SLO slo, double currentAvailability) {
        double targetAvailability = slo.getTarget();
        double allowedDowntime = (100.0 - targetAvailability) / 100.0;
        double actualDowntime = (100.0 - currentAvailability) / 100.0;
        
        return Math.max(0, (allowedDowntime - actualDowntime) / allowedDowntime * 100);
    }
    
    private SLOAlert createSLOAlert(String service, SLO slo, SLOStatus status) {
        return SLOAlert.builder()
            .service(service)
            .sloName(slo.getName())
            .severity(determineSeverity(status))
            .message(String.format("SLO %s for service %s is %s. Current: %.2f, Target: %.2f", 
                slo.getName(), service, status.getDescription(), 
                status.getCurrentValue(), slo.getTarget()))
            .errorBudgetRemaining(status.getErrorBudgetRemaining())
            .timestamp(Instant.now())
            .build();
    }
}
```

### Error Budget Calculation

```java
@Component
public class ErrorBudgetCalculator {
    
    public ErrorBudgetReport calculateErrorBudget(String service, Duration timeWindow) {
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = endTime.minus(timeWindow);
        
        // Get SLO configuration for the service
        SLOConfiguration config = getSLOConfiguration(service);
        
        ErrorBudgetReport.Builder reportBuilder = ErrorBudgetReport.builder()
            .service(service)
            .timeWindow(timeWindow)
            .calculationTime(endTime);
        
        config.getSLOs().forEach(slo -> {
            ErrorBudgetDetails budget = calculateSLOErrorBudget(slo, startTime, endTime);
            reportBuilder.addErrorBudget(slo.getName(), budget);
        });
        
        return reportBuilder.build();
    }
    
    private ErrorBudgetDetails calculateSLOErrorBudget(SLO slo, 
                                                      LocalDateTime startTime, 
                                                      LocalDateTime endTime) {
        switch (slo.getType()) {
            case AVAILABILITY:
                return calculateAvailabilityErrorBudget(slo, startTime, endTime);
            case LATENCY:
                return calculateLatencyErrorBudget(slo, startTime, endTime);
            case ERROR_RATE:
                return calculateErrorRateErrorBudget(slo, startTime, endTime);
            default:
                throw new IllegalArgumentException("Unsupported SLO type: " + slo.getType());
        }
    }
    
    private ErrorBudgetDetails calculateAvailabilityErrorBudget(SLO slo, 
                                                               LocalDateTime startTime, 
                                                               LocalDateTime endTime) {
        Duration totalDuration = Duration.between(startTime, endTime);
        Duration allowedDowntime = totalDuration.multipliedBy(
            (long)((100.0 - slo.getTarget()) * 100)) // Convert percentage
            .dividedBy(10000);
        
        Duration actualDowntime = getActualDowntime(startTime, endTime);
        Duration remainingErrorBudget = allowedDowntime.minus(actualDowntime);
        
        double budgetUsedPercentage = actualDowntime.toMillis() * 100.0 / allowedDowntime.toMillis();
        
        return ErrorBudgetDetails.builder()
            .sloName(slo.getName())
            .totalBudget(allowedDowntime)
            .usedBudget(actualDowntime)
            .remainingBudget(remainingErrorBudget)
            .budgetUsedPercentage(budgetUsedPercentage)
            .status(remainingErrorBudget.isNegative() ? 
                ErrorBudgetStatus.EXHAUSTED : ErrorBudgetStatus.HEALTHY)
            .build();
    }
}
```

## 3. Service Level Agreements (SLA)

Service Level Agreements are contractual commitments to customers regarding service performance.

### SLA Management System

```java
@Entity
@Table(name = "service_level_agreements")
public class ServiceLevelAgreement {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String customerId;
    
    @Column(nullable = false)
    private String serviceName;
    
    @Column(nullable = false)
    private String tierLevel; // Premium, Standard, Basic
    
    @ElementCollection
    @CollectionTable(name = "sla_commitments")
    private List<SLACommitment> commitments;
    
    @Column(nullable = false)
    private LocalDateTime effectiveDate;
    
    @Column
    private LocalDateTime expirationDate;
    
    @Enumerated(EnumType.STRING)
    private SLAStatus status;
    
    // Constructors, getters, setters
}

@Embeddable
public class SLACommitment {
    
    @Column(nullable = false)
    private String metric; // availability, response_time, throughput
    
    @Column(nullable = false)
    private Double target;
    
    @Column
    private String unit;
    
    @Column
    private String measurementWindow;
    
    @Column
    private Double penalty; // Penalty percentage for SLA breach
    
    @Column
    private Double credit; // Service credit for SLA breach
    
    // Constructors, getters, setters
}
```

### SLA Monitoring and Reporting

```java
@Service
@Slf4j
public class SLAMonitoringService {
    
    private final SLARepository slaRepository;
    private final SLICollector sliCollector;
    private final NotificationService notificationService;
    private final SLAReportGenerator reportGenerator;
    
    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void monitorSLACompliance() {
        List<ServiceLevelAgreement> activeSLAs = slaRepository.findByStatus(SLAStatus.ACTIVE);
        
        activeSLAs.forEach(this::checkSLACompliance);
    }
    
    private void checkSLACompliance(ServiceLevelAgreement sla) {
        sla.getCommitments().forEach(commitment -> {
            SLAComplianceResult result = evaluateCommitment(sla, commitment);
            
            if (!result.isCompliant()) {
                handleSLABreach(sla, commitment, result);
            }
            
            // Store compliance data for reporting
            storeSLAComplianceData(sla, commitment, result);
        });
    }
    
    private SLAComplianceResult evaluateCommitment(ServiceLevelAgreement sla, 
                                                  SLACommitment commitment) {
        String serviceName = sla.getServiceName();
        String metricName = commitment.getMetric();
        
        // Get current metric value
        double currentValue = getCurrentMetricValue(serviceName, metricName, 
                                                   commitment.getMeasurementWindow());
        
        boolean isCompliant = isCommitmentMet(commitment, currentValue);
        
        return SLAComplianceResult.builder()
            .slaId(sla.getId())
            .customerId(sla.getCustomerId())
            .serviceName(serviceName)
            .metric(metricName)
            .target(commitment.getTarget())
            .actualValue(currentValue)
            .compliant(isCompliant)
            .measurementTime(LocalDateTime.now())
            .build();
    }
    
    private void handleSLABreach(ServiceLevelAgreement sla, 
                                SLACommitment commitment, 
                                SLAComplianceResult result) {
        // Create SLA breach event
        SLABreachEvent event = SLABreachEvent.builder()
            .slaId(sla.getId())
            .customerId(sla.getCustomerId())
            .serviceName(sla.getServiceName())
            .metric(commitment.getMetric())
            .target(commitment.getTarget())
            .actualValue(result.getActualValue())
            .breachTime(LocalDateTime.now())
            .severity(calculateBreachSeverity(commitment, result))
            .build();
        
        // Notify stakeholders
        notificationService.notifySLABreach(event);
        
        // Calculate service credits if applicable
        if (commitment.getCredit() != null) {
            calculateServiceCredits(sla, commitment, result);
        }
        
        log.warn("SLA Breach detected - Customer: {}, Service: {}, Metric: {}, Target: {}, Actual: {}", 
            sla.getCustomerId(), sla.getServiceName(), commitment.getMetric(), 
            commitment.getTarget(), result.getActualValue());
    }
    
    @Scheduled(cron = "0 0 0 * * MON") // Weekly reports
    public void generateWeeklySLAReports() {
        List<ServiceLevelAgreement> activeSLAs = slaRepository.findByStatus(SLAStatus.ACTIVE);
        
        activeSLAs.forEach(sla -> {
            SLAReport report = reportGenerator.generateWeeklyReport(sla);
            sendReportToCustomer(sla.getCustomerId(), report);
        });
    }
}
```

### SLA Reporting Dashboard

```yaml
# Grafana dashboard for SLA monitoring
apiVersion: v1
kind: ConfigMap
metadata:
  name: sla-dashboard-config
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "SLA Compliance Dashboard",
        "panels": [
          {
            "title": "SLA Compliance by Service",
            "type": "table",
            "targets": [
              {
                "expr": "sla_compliance_status",
                "format": "table"
              }
            ]
          },
          {
            "title": "SLA Breach Count",
            "type": "stat",
            "targets": [
              {
                "expr": "increase(sla_breach_total[24h])",
                "legendFormat": "24h Breaches"
              }
            ]
          },
          {
            "title": "Service Credits Issued",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(sla_service_credits_total) by (customer)",
                "legendFormat": "Credits - {{customer}}"
              }
            ]
          }
        ]
      }
    }
```

## 4. Best Practices

### 4.1 SLI Selection Guidelines

```yaml
sli_selection_guidelines:
  user_facing_services:
    primary_slis:
      - availability
      - latency
      - error_rate
    secondary_slis:
      - throughput
      - data_quality
  
  data_processing_services:
    primary_slis:
      - data_freshness
      - processing_completeness
      - error_rate
    secondary_slis:
      - throughput
      - resource_utilization
  
  storage_services:
    primary_slis:
      - availability
      - durability
      - consistency
    secondary_slis:
      - latency
      - throughput
```

### 4.2 SLO Setting Strategy

```java
@Component
public class SLOOptimizer {
    
    public SLORecommendation recommendSLO(String service, String metric, 
                                         Duration analysisWindow) {
        // Analyze historical performance
        HistoricalPerformance historical = analyzeHistoricalPerformance(
            service, metric, analysisWindow);
        
        // Calculate realistic targets
        double p99Performance = historical.getPercentile(99.0);
        double p95Performance = historical.getPercentile(95.0);
        double p90Performance = historical.getPercentile(90.0);
        
        // Recommend target based on business criticality
        ServiceCriticality criticality = getServiceCriticality(service);
        
        double recommendedTarget = switch (criticality) {
            case CRITICAL -> p95Performance * 0.95; // More aggressive
            case IMPORTANT -> p90Performance * 0.98; // Balanced
            case STANDARD -> p90Performance * 1.02; // Conservative
        };
        
        return SLORecommendation.builder()
            .service(service)
            .metric(metric)
            .recommendedTarget(recommendedTarget)
            .confidence(calculateConfidence(historical))
            .reasoning(generateReasoning(historical, criticality))
            .build();
    }
}
```

### 4.3 Error Budget Policies

```yaml
error_budget_policies:
  fast_burn:
    detection_window: "1h"
    threshold: "2%" # 2% error budget consumed in 1 hour
    actions:
      - alert_on_call
      - stop_deployments
      - enable_feature_flags
  
  slow_burn:
    detection_window: "6h" 
    threshold: "5%" # 5% error budget consumed in 6 hours
    actions:
      - alert_team
      - schedule_review
  
  budget_exhausted:
    threshold: "100%"
    actions:
      - stop_all_deployments
      - activate_incident_response
      - notify_leadership
```

This comprehensive guide provides the foundation for implementing effective SLI/SLO/SLA practices in your organization. The next sections will cover Incident Management, Chaos Engineering, and Capacity Planning to complete your SRE implementation.
