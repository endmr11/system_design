# SLI/SLO/SLA Tanımları

Site Reliability Engineering'in temel yapı taşları olan SLI, SLO ve SLA kavramları, sistemlerin güvenilirliğini ölçmek ve yönetmek için kritik önem taşır. Bu metrikler, hem teknik ekipler hem de iş birimlerinin ortak bir dilde konuşmasını sağlar.

## SLI (Service Level Indicator)

Service Level Indicator, sistem performansını ölçmek için kullanılan nicel metriklerdir. Bu göstergeler, hizmetin sağlığını objektif olarak değerlendirmemizi sağlar.

### Yaygın SLI Türleri

#### 1. Latency (Gecikme)
```yaml
# prometheus-latency-sli.yaml
groups:
- name: latency_sli
  rules:
  - record: http_request_duration_p95
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
  - record: http_request_duration_p99
    expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

#### 2. Error Rate (Hata Oranı)
```java
// Spring Boot ile SLI tracking
@Component
public class SLIMetrics {
    private final MeterRegistry meterRegistry;
    private final Counter requestCounter;
    private final Counter errorCounter;
    
    public SLIMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.requestCounter = Counter.builder("http_requests_total")
            .description("Total HTTP requests")
            .register(meterRegistry);
        this.errorCounter = Counter.builder("http_requests_errors_total")
            .description("Total HTTP errors")
            .register(meterRegistry);
    }
    
    @EventListener
    public void handleRequestCompleted(RequestCompletedEvent event) {
        requestCounter.increment(
            Tags.of(
                "method", event.getMethod(),
                "status", event.getStatus().toString()
            )
        );
        
        if (event.getStatus().is5xxServerError()) {
            errorCounter.increment(
                Tags.of("method", event.getMethod())
            );
        }
    }
}
```

#### 3. Throughput (İşlem Hacmi)
```yaml
# Throughput SLI Prometheus query
- record: http_requests_per_second
  expr: rate(http_requests_total[5m])
```

#### 4. Availability (Kullanılabilirlik)
```yaml
# Availability SLI
- record: service_availability
  expr: |
    (
      sum(rate(http_requests_total{code!~"5.."}[5m])) /
      sum(rate(http_requests_total[5m]))
    ) * 100
```

### SLI Best Practices

1. **Kullanıcı Perspektifi**: SLI'ları kullanıcı deneyimini yansıtacak şekilde seçin
2. **Ölçülebilirlik**: Sürekli ve güvenilir şekilde ölçülebilir olmalı
3. **Anlamlılık**: İş hedefleriyle uyumlu olmalı
4. **Basitlik**: Karmaşık hesaplamalardan kaçının

## SLO (Service Level Objective)

Service Level Objective, SLI'lar için belirlenen hedef değerlerdir. SLO'lar, hizmet kalitesi için ölçülebilir hedefler koyar.

### SLO Örnekleri

#### Availability SLO
```yaml
# 99.9% availability SLO
slo_config:
  service: "user-service"
  availability:
    target: 99.9
    measurement_window: "30d"
    calculation: |
      (successful_requests / total_requests) * 100 >= 99.9
```

#### Latency SLO
```java
// Spring Boot SLO monitoring
@Component
public class SLOMonitor {
    private static final double LATENCY_SLO_P95 = 200.0; // 200ms
    private static final double LATENCY_SLO_P99 = 500.0; // 500ms
    
    @Scheduled(fixedRate = 60000) // Her dakika kontrol et
    public void checkLatencySLO() {
        double p95Latency = getP95Latency();
        double p99Latency = getP99Latency();
        
        if (p95Latency > LATENCY_SLO_P95) {
            alertManager.sendAlert(
                "Latency SLO Violation",
                String.format("P95 latency: %.2fms exceeds SLO: %.2fms", 
                    p95Latency, LATENCY_SLO_P95)
            );
        }
        
        // SLO compliance oranını hesapla
        double sloCompliance = calculateSLOCompliance();
        meterRegistry.gauge("slo_compliance_percentage", sloCompliance);
    }
}
```

#### Error Rate SLO
```yaml
# Error rate SLO configuration
slo_targets:
  error_rate:
    threshold: 0.1  # %0.1 hata oranı
    measurement_period: "1h"
    alert_threshold: 0.05  # %0.05'te alert
```

### Error Budget

Error budget, SLO'nun izin verdiği hata miktarıdır.

```python
# Error Budget Calculator
class ErrorBudgetCalculator:
    def __init__(self, slo_target, measurement_period):
        self.slo_target = slo_target  # 99.9%
        self.measurement_period = measurement_period  # 30 days
        
    def calculate_error_budget(self):
        """30 günde %0.1 hata yapabilir"""
        error_budget_percentage = 100 - self.slo_target
        return error_budget_percentage
        
    def calculate_remaining_budget(self, current_error_rate, elapsed_time):
        """Kalan error budget hesapla"""
        total_budget = self.calculate_error_budget()
        consumed_budget = current_error_rate * (elapsed_time / self.measurement_period)
        return max(0, total_budget - consumed_budget)
        
    def budget_burn_rate(self, current_error_rate):
        """Budget tükenme hızı"""
        error_budget = self.calculate_error_budget()
        return current_error_rate / error_budget
```

## SLA (Service Level Agreement)

Service Level Agreement, kullanıcılarla yapılan resmi anlaşmalardır. SLO'lara dayalı olarak hazırlanır ve yasal bağlayıcılığı vardır.

### SLA Komponenti

#### 1. Availability SLA
```yaml
# Public API SLA
api_sla:
  service_name: "Public API"
  availability: 99.95%
  measurement_period: "monthly"
  exclusions:
    - "planned_maintenance"
    - "force_majeure"
  penalties:
    - threshold: "99.95% - 99.0%"
      credit: "10%"
    - threshold: "< 99.0%"
      credit: "25%"
```

#### 2. Performance SLA
```java
// SLA Monitoring Service
@Service
public class SLAMonitoringService {
    
    @Value("${sla.latency.p95.threshold:250}")
    private double latencyThreshold;
    
    @Value("${sla.availability.threshold:99.95}")
    private double availabilityThreshold;
    
    public SLAComplianceReport generateMonthlyReport(String serviceId) {
        SLAComplianceReport report = new SLAComplianceReport();
        
        // Availability compliance
        double monthlyAvailability = calculateMonthlyAvailability(serviceId);
        report.setAvailabilityCompliance(monthlyAvailability >= availabilityThreshold);
        report.setActualAvailability(monthlyAvailability);
        
        // Latency compliance
        double averageP95Latency = calculateAverageP95Latency(serviceId);
        report.setLatencyCompliance(averageP95Latency <= latencyThreshold);
        report.setActualLatency(averageP95Latency);
        
        // Credit calculation
        if (!report.isFullyCompliant()) {
            double creditPercentage = calculateCreditPercentage(report);
            report.setCreditPercentage(creditPercentage);
        }
        
        return report;
    }
    
    private double calculateCreditPercentage(SLAComplianceReport report) {
        if (report.getActualAvailability() < 99.0) {
            return 25.0; // %25 kredi
        } else if (report.getActualAvailability() < 99.95) {
            return 10.0; // %10 kredi
        }
        return 0.0;
    }
}
```

### SLA İhlali Durumları

#### Otomatik Kredi Hesaplama
```java
@Component
public class SLACreditCalculator {
    
    public CreditCalculation calculateCredit(SLAMetrics metrics, SLAThresholds thresholds) {
        CreditCalculation calculation = new CreditCalculation();
        
        // Availability breach check
        if (metrics.getAvailability() < thresholds.getAvailabilityThreshold()) {
            double availabilityCredit = calculateAvailabilityCredit(
                metrics.getAvailability(), 
                thresholds.getAvailabilityThreshold()
            );
            calculation.addCredit("availability", availabilityCredit);
        }
        
        // Performance breach check
        if (metrics.getP95Latency() > thresholds.getLatencyThreshold()) {
            double performanceCredit = calculatePerformanceCredit(
                metrics.getP95Latency(), 
                thresholds.getLatencyThreshold()
            );
            calculation.addCredit("performance", performanceCredit);
        }
        
        return calculation;
    }
}
```

## Monitoring ve Alerting

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "SLI/SLO/SLA Dashboard",
    "panels": [
      {
        "title": "Availability SLO",
        "type": "stat",
        "targets": [
          {
            "expr": "service_availability",
            "legendFormat": "Current Availability"
          }
        ],
        "thresholds": [
          {"value": 99.9, "color": "red"},
          {"value": 99.95, "color": "yellow"},
          {"value": 99.99, "color": "green"}
        ]
      },
      {
        "title": "Error Budget Burn Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "error_budget_burn_rate",
            "legendFormat": "Burn Rate"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules
```yaml
# Prometheus alerting rules
groups:
- name: slo_alerts
  rules:
  - alert: AvailabilitySLOBreach
    expr: service_availability < 99.9
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Availability SLO breached"
      description: "Service availability {{ $value }}% is below SLO target 99.9%"
      
  - alert: ErrorBudgetExhausted
    expr: error_budget_remaining < 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Error budget nearly exhausted"
      description: "Only {{ $value }}% of error budget remaining"
```

## Best Practices

### 1. SLI Seçimi
- Kullanıcı deneyimini yansıtan metrikler seçin
- Ölçülebilir ve tekrarlanabilir olsun
- İş hedefleriyle uyumlu olsun

### 2. SLO Belirleme
- Gerçekçi hedefler koyun (%100 availability hedeflemeyin)
- Error budget konseptini kullanın
- Düzenli olarak gözden geçirin

### 3. SLA Yönetimi
- SLO'lardan daha gevşek SLA'lar belirleyin
- Açık ve ölçülebilir dil kullanın
- İhlal durumlarında adil prosedürler oluşturun

### 4. Monitoring
- Real-time monitoring sistemleri kurun
- Automated alerting mekanizmaları oluşturun
- Regular SLO review toplantıları yapın

SLI/SLO/SLA sistemi, Site Reliability Engineering'in kalbidir. Doğru implementasyon ile hem kullanıcı memnuniyetini artırabilir hem de sistemlerin güvenilirliğini sürekli iyileştirebilirsiniz.
