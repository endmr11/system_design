# Incident Management

Incident Management, sistem kesintilerini ve performans sorunlarını hızlıca tespit edip çözmek için standartlaştırılmış süreçlerdir. Etkili incident management, sistem güvenilirliğinin ve kullanıcı memnuniyetinin korunması için kritik önem taşır.

## Incident Tanımı ve Sınıflandırması

### Incident Türleri

#### 1. Severity Levels
```yaml
# incident-severity-levels.yaml
severity_levels:
  SEV1_CRITICAL:
    description: "Tam sistem kesintisi"
    response_time: "15 minutes"
    escalation_time: "30 minutes"
    communication: "Every 30 minutes"
    example: "Ana uygulamanın tamamen erişilemez olması"
    
  SEV2_HIGH:
    description: "Ana fonksiyonlarda ciddi sorun"
    response_time: "1 hour"
    escalation_time: "2 hours"
    communication: "Every 2 hours"
    example: "Ödeme sisteminin çalışmaması"
    
  SEV3_MEDIUM:
    description: "Performans sorunları"
    response_time: "4 hours"
    escalation_time: "8 hours"
    communication: "Daily"
    example: "Yavaş response time'lar"
    
  SEV4_LOW:
    description: "Minor sorunlar"
    response_time: "24 hours"
    escalation_time: "48 hours"
    communication: "Weekly"
    example: "UI küçük bug'ları"
```

#### 2. Impact Assessment
```java
// Incident Impact Calculator
@Component
public class IncidentImpactCalculator {
    
    public IncidentImpact calculateImpact(IncidentDetails incident) {
        IncidentImpact impact = new IncidentImpact();
        
        // Affected users calculation
        int affectedUsers = calculateAffectedUsers(incident);
        impact.setAffectedUsers(affectedUsers);
        
        // Financial impact
        double revenueImpact = calculateRevenueImpact(incident);
        impact.setRevenueImpact(revenueImpact);
        
        // Business process impact
        BusinessProcessImpact processImpact = assessBusinessProcessImpact(incident);
        impact.setBusinessProcessImpact(processImpact);
        
        // Brand reputation impact
        ReputationImpact reputationImpact = assessReputationImpact(incident);
        impact.setReputationImpact(reputationImpact);
        
        return impact;
    }
    
    private double calculateRevenueImpact(IncidentDetails incident) {
        double avgRevenuePerMinute = getAverageRevenuePerMinute();
        long durationMinutes = incident.getDurationMinutes();
        double impactPercentage = incident.getImpactPercentage();
        
        return avgRevenuePerMinute * durationMinutes * (impactPercentage / 100);
    }
}
```

## Incident Response Process

### 1. Detection Phase (Tespit)

#### Monitoring ve Alerting
```yaml
# prometheus-incident-detection.yaml
groups:
- name: incident_detection
  rules:
  - alert: ServiceDown
    expr: up{job="api-service"} == 0
    for: 5m
    labels:
      severity: critical
      incident_type: "service_unavailable"
    annotations:
      summary: "Service {{ $labels.instance }} is down"
      description: "Service has been down for more than 5 minutes"
      runbook_url: "https://wiki.company.com/runbooks/service-down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: high
      incident_type: "high_error_rate"
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }}"
```

#### Automated Detection System
```java
// Anomaly Detection Service
@Service
public class AnomalyDetectionService {
    
    @Autowired
    private MetricsService metricsService;
    
    @Autowired
    private IncidentService incidentService;
    
    @Scheduled(fixedRate = 30000) // Her 30 saniyede kontrol et
    public void detectAnomalies() {
        List<ServiceMetrics> metrics = metricsService.getCurrentMetrics();
        
        for (ServiceMetrics metric : metrics) {
            AnomalyDetectionResult result = analyzeMetric(metric);
            
            if (result.isAnomalyDetected()) {
                Incident incident = createIncidentFromAnomaly(result);
                incidentService.createIncident(incident);
                notificationService.sendAlert(incident);
            }
        }
    }
    
    private AnomalyDetectionResult analyzeMetric(ServiceMetrics metric) {
        // Statistical analysis, machine learning models
        double threshold = calculateDynamicThreshold(metric);
        boolean isAnomaly = metric.getValue() > threshold;
        
        return AnomalyDetectionResult.builder()
            .isAnomalyDetected(isAnomaly)
            .confidence(calculateConfidence(metric))
            .metricName(metric.getName())
            .actualValue(metric.getValue())
            .expectedValue(threshold)
            .build();
    }
}
```

### 2. Response Phase (Müdahale)

#### Incident Commander System
```java
// Incident Commander Selection
@Component
public class IncidentCommanderSelector {
    
    public IncidentCommander selectCommander(Incident incident) {
        Severity severity = incident.getSeverity();
        String serviceArea = incident.getServiceArea();
        
        // Severity bazlı commander seçimi
        switch (severity) {
            case SEV1:
                return selectSeniorCommander(serviceArea);
            case SEV2:
                return selectExperiencedCommander(serviceArea);
            case SEV3:
            case SEV4:
                return selectAvailableCommander(serviceArea);
            default:
                throw new IllegalArgumentException("Unknown severity: " + severity);
        }
    }
    
    private IncidentCommander selectSeniorCommander(String serviceArea) {
        return commanderRepository.findSeniorCommandersByArea(serviceArea)
            .stream()
            .filter(IncidentCommander::isAvailable)
            .filter(commander -> commander.getExperienceLevel() >= ExperienceLevel.SENIOR)
            .findFirst()
            .orElseThrow(() -> new NoAvailableCommanderException("No senior commander available"));
    }
}
```

#### Communication Bridge
```java
// Incident Communication Service
@Service
public class IncidentCommunicationService {
    
    public void establishCommunicationBridge(Incident incident) {
        // Slack channel oluştur
        String channelName = createIncidentChannel(incident);
        
        // War room kurulum
        WarRoom warRoom = warRoomService.setupWarRoom(incident);
        
        // Stakeholder notifications
        notifyStakeholders(incident);
        
        // Status page update
        updateStatusPage(incident);
    }
    
    private void notifyStakeholders(Incident incident) {
        List<Stakeholder> stakeholders = getStakeholdersForIncident(incident);
        
        for (Stakeholder stakeholder : stakeholders) {
            NotificationPreference preference = stakeholder.getNotificationPreference();
            
            switch (preference.getChannel()) {
                case SMS:
                    smsService.sendIncidentNotification(stakeholder, incident);
                    break;
                case EMAIL:
                    emailService.sendIncidentNotification(stakeholder, incident);
                    break;
                case SLACK:
                    slackService.sendIncidentNotification(stakeholder, incident);
                    break;
                case PHONE:
                    phoneService.initiateIncidentCall(stakeholder, incident);
                    break;
            }
        }
    }
}
```

### 3. Investigation Phase (Araştırma)

#### Root Cause Analysis
```java
// RCA Framework
@Component
public class RootCauseAnalyzer {
    
    public RootCauseAnalysis performRCA(Incident incident) {
        RootCauseAnalysis rca = new RootCauseAnalysis();
        
        // Timeline analysis
        Timeline timeline = buildTimeline(incident);
        rca.setTimeline(timeline);
        
        // 5 Whys analysis
        FiveWhysAnalysis fiveWhys = performFiveWhysAnalysis(incident);
        rca.setFiveWhysAnalysis(fiveWhys);
        
        // System architecture analysis
        ArchitectureAnalysis archAnalysis = analyzeSystemArchitecture(incident);
        rca.setArchitectureAnalysis(archAnalysis);
        
        // Contributing factors
        List<ContributingFactor> factors = identifyContributingFactors(incident);
        rca.setContributingFactors(factors);
        
        // Prevention measures
        List<PreventionMeasure> measures = identifyPreventionMeasures(rca);
        rca.setPreventionMeasures(measures);
        
        return rca;
    }
    
    private FiveWhysAnalysis performFiveWhysAnalysis(Incident incident) {
        FiveWhysAnalysis analysis = new FiveWhysAnalysis();
        String currentProblem = incident.getDescription();
        
        for (int i = 1; i <= 5; i++) {
            String why = analyzeWhy(currentProblem, i);
            analysis.addWhy(i, why);
            currentProblem = why;
        }
        
        return analysis;
    }
}
```

#### Ishikawa Diagram Implementation
```java
// Fishbone Diagram for RCA
public class IshikawaDiagramBuilder {
    
    public IshikawaDiagram buildDiagram(Incident incident) {
        IshikawaDiagram diagram = new IshikawaDiagram(incident.getDescription());
        
        // Ana kategoriler
        diagram.addCategory(CategoryType.PEOPLE, analyzePeopleFactors(incident));
        diagram.addCategory(CategoryType.PROCESS, analyzeProcessFactors(incident));
        diagram.addCategory(CategoryType.TECHNOLOGY, analyzeTechnologyFactors(incident));
        diagram.addCategory(CategoryType.ENVIRONMENT, analyzeEnvironmentFactors(incident));
        diagram.addCategory(CategoryType.MATERIALS, analyzeMaterialFactors(incident));
        diagram.addCategory(CategoryType.METHODS, analyzeMethodFactors(incident));
        
        return diagram;
    }
    
    private List<CauseFactor> analyzeTechnologyFactors(Incident incident) {
        List<CauseFactor> factors = new ArrayList<>();
        
        // Hardware failures
        if (hasHardwareRelatedLogs(incident)) {
            factors.add(new CauseFactor("Hardware Failure", "Server hardware malfunction"));
        }
        
        // Software bugs
        if (hasSoftwareBugIndicators(incident)) {
            factors.add(new CauseFactor("Software Bug", "Application code defect"));
        }
        
        // Configuration issues
        if (hasConfigurationChanges(incident)) {
            factors.add(new CauseFactor("Configuration Error", "Incorrect system configuration"));
        }
        
        return factors;
    }
}
```

### 4. Resolution Phase (Çözüm)

#### Automated Remediation
```java
// Automated Incident Remediation
@Component
public class AutomatedRemediationService {
    
    @EventListener
    public void handleIncident(IncidentCreatedEvent event) {
        Incident incident = event.getIncident();
        
        // Automated remediation stratejisini belirle
        RemediationStrategy strategy = determineRemediationStrategy(incident);
        
        if (strategy.isAutomationApplicable()) {
            executeAutomatedRemediation(incident, strategy);
        } else {
            escalateToHuman(incident);
        }
    }
    
    private void executeAutomatedRemediation(Incident incident, RemediationStrategy strategy) {
        switch (strategy.getType()) {
            case RESTART_SERVICE:
                restartService(incident.getAffectedService());
                break;
                
            case SCALE_UP:
                scaleUpService(incident.getAffectedService(), strategy.getScaleFactor());
                break;
                
            case FAILOVER:
                executeFailover(incident.getAffectedService());
                break;
                
            case ROLLBACK:
                rollbackDeployment(incident.getAffectedService());
                break;
                
            case TRAFFIC_REDIRECT:
                redirectTraffic(incident.getAffectedService(), strategy.getTargetService());
                break;
        }
        
        // Remediation sonrasında verification
        scheduleVerification(incident, strategy);
    }
}
```

#### Manual Resolution Procedures
```bash
#!/bin/bash
# incident-response-playbook.sh

# Service restart procedure
restart_service() {
    local service_name=$1
    echo "Restarting service: $service_name"
    
    # Graceful shutdown
    kubectl scale deployment $service_name --replicas=0
    sleep 30
    
    # Restart with new replicas
    kubectl scale deployment $service_name --replicas=3
    
    # Wait for healthy state
    kubectl rollout status deployment/$service_name --timeout=300s
    
    # Verify service health
    verify_service_health $service_name
}

# Database connection issue resolution
resolve_db_connection_issue() {
    echo "Resolving database connection issues..."
    
    # Check connection pool status
    check_connection_pool_status
    
    # Reset connection pool
    reset_connection_pool
    
    # Verify database connectivity
    verify_database_connectivity
    
    # Update monitoring dashboards
    update_incident_dashboard "Database connection restored"
}

# Network issue resolution
resolve_network_issue() {
    echo "Diagnosing network issues..."
    
    # Check network connectivity
    ping -c 5 database.internal
    telnet database.internal 5432
    
    # Check DNS resolution
    nslookup database.internal
    
    # Restart network services if needed
    if [ $? -ne 0 ]; then
        sudo systemctl restart networking
    fi
}
```

## Incident Tools ve Integration

### 1. PagerDuty Integration
```java
// PagerDuty Integration Service
@Service
public class PagerDutyService {
    
    @Value("${pagerduty.routing.key}")
    private String routingKey;
    
    public void createIncident(Incident incident) {
        PagerDutyEvent event = PagerDutyEvent.builder()
            .routingKey(routingKey)
            .eventAction(EventAction.TRIGGER)
            .dedupeKey(incident.getId())
            .payload(createPayload(incident))
            .build();
            
        pagerDutyClient.sendEvent(event);
    }
    
    private PagerDutyPayload createPayload(Incident incident) {
        return PagerDutyPayload.builder()
            .summary(incident.getTitle())
            .source(incident.getSource())
            .severity(mapSeverity(incident.getSeverity()))
            .timestamp(incident.getCreatedAt())
            .customDetails(createCustomDetails(incident))
            .build();
    }
    
    public void resolveIncident(String incidentId) {
        PagerDutyEvent event = PagerDutyEvent.builder()
            .routingKey(routingKey)
            .eventAction(EventAction.RESOLVE)
            .dedupeKey(incidentId)
            .build();
            
        pagerDutyClient.sendEvent(event);
    }
}
```

### 2. Jira Integration
```java
// Jira Incident Tracking
@Service
public class JiraIncidentService {
    
    public JiraIssue createIncidentTicket(Incident incident) {
        JiraIssueRequest request = JiraIssueRequest.builder()
            .projectKey("INC")
            .issueType("Incident")
            .summary(incident.getTitle())
            .description(buildIncidentDescription(incident))
            .priority(mapPriority(incident.getSeverity()))
            .labels(Arrays.asList("incident", incident.getServiceArea()))
            .customFields(buildCustomFields(incident))
            .build();
            
        return jiraClient.createIssue(request);
    }
    
    private Map<String, Object> buildCustomFields(Incident incident) {
        Map<String, Object> customFields = new HashMap<>();
        customFields.put("Affected Service", incident.getAffectedService());
        customFields.put("Impact Level", incident.getImpactLevel());
        customFields.put("Customer Impact", incident.getCustomerImpact());
        customFields.put("Incident Commander", incident.getCommanderEmail());
        return customFields;
    }
}
```

### 3. Slack Integration
```java
// Slack Incident Bot
@Component
public class SlackIncidentBot {
    
    public void createIncidentChannel(Incident incident) {
        String channelName = generateChannelName(incident);
        
        SlackChannel channel = slackClient.createChannel(
            CreateChannelRequest.builder()
                .name(channelName)
                .topic(String.format("Incident: %s", incident.getTitle()))
                .purpose("Incident response and coordination")
                .build()
        );
        
        // Invite relevant team members
        inviteTeamMembers(channel, incident);
        
        // Post incident summary
        postIncidentSummary(channel, incident);
        
        // Pin important information
        pinImportantInfo(channel, incident);
    }
    
    private void postIncidentSummary(SlackChannel channel, Incident incident) {
        SlackMessage message = SlackMessage.builder()
            .channel(channel.getId())
            .blocks(buildIncidentSummaryBlocks(incident))
            .build();
            
        slackClient.postMessage(message);
    }
    
    private List<Block> buildIncidentSummaryBlocks(Incident incident) {
        return Arrays.asList(
            SectionBlock.builder()
                .text(markdownText(String.format("*Incident: %s*", incident.getTitle())))
                .fields(Arrays.asList(
                    markdownText(String.format("*Severity:* %s", incident.getSeverity())),
                    markdownText(String.format("*Commander:* %s", incident.getCommanderName())),
                    markdownText(String.format("*Affected Service:* %s", incident.getAffectedService())),
                    markdownText(String.format("*Impact:* %s", incident.getImpactDescription()))
                ))
                .build(),
            ActionsBlock.builder()
                .elements(Arrays.asList(
                    ButtonElement.builder()
                        .text(plainText("Update Status"))
                        .actionId("update_incident_status")
                        .value(incident.getId())
                        .build(),
                    ButtonElement.builder()
                        .text(plainText("Escalate"))
                        .actionId("escalate_incident")
                        .value(incident.getId())
                        .style("danger")
                        .build()
                ))
                .build()
        );
    }
}
```

## Incident Metrics ve Reporting

### 1. MTTR (Mean Time To Recovery)
```java
// MTTR Calculator
@Component
public class MTTRCalculator {
    
    public MTTRMetrics calculateMTTR(LocalDate startDate, LocalDate endDate) {
        List<Incident> incidents = incidentRepository.findByDateRange(startDate, endDate);
        
        Map<Severity, List<Duration>> mttrBySeverity = incidents.stream()
            .filter(incident -> incident.getStatus() == IncidentStatus.RESOLVED)
            .collect(Collectors.groupingBy(
                Incident::getSeverity,
                Collectors.mapping(
                    incident -> Duration.between(incident.getCreatedAt(), incident.getResolvedAt()),
                    Collectors.toList()
                )
            ));
        
        MTTRMetrics metrics = new MTTRMetrics();
        
        for (Map.Entry<Severity, List<Duration>> entry : mttrBySeverity.entrySet()) {
            Severity severity = entry.getKey();
            List<Duration> durations = entry.getValue();
            
            Duration averageMTTR = calculateAverage(durations);
            Duration medianMTTR = calculateMedian(durations);
            Duration p95MTTR = calculatePercentile(durations, 95);
            
            metrics.addSeverityMTTR(severity, SeverityMTTR.builder()
                .average(averageMTTR)
                .median(medianMTTR)
                .p95(p95MTTR)
                .count(durations.size())
                .build());
        }
        
        return metrics;
    }
}
```

### 2. Incident Trend Analysis
```java
// Incident Analytics Service
@Service
public class IncidentAnalyticsService {
    
    public IncidentTrendReport generateTrendReport(AnalyticsPeriod period) {
        IncidentTrendReport report = new IncidentTrendReport();
        
        // Incident frequency trends
        Map<LocalDate, Long> dailyIncidentCount = calculateDailyIncidentCount(period);
        report.setIncidentFrequencyTrend(dailyIncidentCount);
        
        // Top incident categories
        Map<String, Long> topCategories = getTopIncidentCategories(period);
        report.setTopIncidentCategories(topCategories);
        
        // Most affected services
        Map<String, Long> affectedServices = getMostAffectedServices(period);
        report.setMostAffectedServices(affectedServices);
        
        // Resolution time trends
        Map<LocalDate, Duration> avgResolutionTime = calculateAvgResolutionTime(period);
        report.setResolutionTimeTrend(avgResolutionTime);
        
        // Recurring incidents
        List<RecurringIncidentPattern> patterns = identifyRecurringPatterns(period);
        report.setRecurringPatterns(patterns);
        
        return report;
    }
    
    private List<RecurringIncidentPattern> identifyRecurringPatterns(AnalyticsPeriod period) {
        // Machine learning based pattern recognition
        List<Incident> incidents = getIncidentsForPeriod(period);
        
        return patternAnalysisService.findPatterns(incidents)
            .stream()
            .filter(pattern -> pattern.getOccurrenceCount() >= 3)
            .sorted(Comparator.comparing(RecurringIncidentPattern::getOccurrenceCount).reversed())
            .collect(Collectors.toList());
    }
}
```

## Post-Incident Activities

### 1. Post-Mortem Process
```java
// Post-Mortem Service
@Service
public class PostMortemService {
    
    public PostMortem createPostMortem(Incident incident) {
        PostMortem postMortem = PostMortem.builder()
            .incidentId(incident.getId())
            .title(String.format("Post-Mortem: %s", incident.getTitle()))
            .createdBy(incident.getCommanderEmail())
            .status(PostMortemStatus.DRAFT)
            .build();
        
        // Template sections
        postMortem.addSection(createSummarySection(incident));
        postMortem.addSection(createTimelineSection(incident));
        postMortem.addSection(createRootCauseSection(incident));
        postMortem.addSection(createImpactSection(incident));
        postMortem.addSection(createLessonsLearnedSection());
        postMortem.addSection(createActionItemsSection());
        
        return postMortemRepository.save(postMortem);
    }
    
    private PostMortemSection createActionItemsSection() {
        return PostMortemSection.builder()
            .title("Action Items")
            .content("""
                ## Action Items
                
                | Action | Owner | Priority | Due Date | Status |
                |--------|-------|----------|----------|--------|
                | [Describe action] | [Team/Person] | [High/Medium/Low] | [Date] | [Open/In Progress/Done] |
                
                ### Prevention Measures
                - [ ] [Specific prevention measure]
                - [ ] [Another prevention measure]
                
                ### Process Improvements
                - [ ] [Process improvement item]
                - [ ] [Another process improvement]
                
                ### Technical Improvements
                - [ ] [Technical improvement item]
                - [ ] [Another technical improvement]
            """)
            .build();
    }
}
```

### 2. Action Item Tracking
```java
// Action Item Management
@Entity
public class ActionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String incidentId;
    private String title;
    private String description;
    private String assignee;
    private ActionItemPriority priority;
    private LocalDate dueDate;
    private ActionItemStatus status;
    private String implementationNotes;
    
    // getters, setters, constructors
}

@Service
public class ActionItemService {
    
    @Scheduled(cron = "0 9 * * MON") // Her Pazartesi sabah 9'da
    public void sendWeeklyActionItemReport() {
        List<ActionItem> overdueItems = findOverdueActionItems();
        List<ActionItem> dueSoonItems = findItemsDueSoon(7); // 7 gün içinde
        
        ActionItemReport report = ActionItemReport.builder()
            .overdueItems(overdueItems)
            .dueSoonItems(dueSoonItems)
            .completionRate(calculateCompletionRate())
            .build();
        
        emailService.sendActionItemReport(report);
        slackService.postActionItemSummary(report);
    }
    
    public void trackActionItemProgress(String incidentId) {
        List<ActionItem> actionItems = actionItemRepository.findByIncidentId(incidentId);
        
        ActionItemProgress progress = ActionItemProgress.builder()
            .totalItems(actionItems.size())
            .completedItems(countCompletedItems(actionItems))
            .inProgressItems(countInProgressItems(actionItems))
            .notStartedItems(countNotStartedItems(actionItems))
            .build();
        
        // Progress tracking event'i publish et
        eventPublisher.publishEvent(new ActionItemProgressEvent(incidentId, progress));
    }
}
```

## Best Practices

### 1. Preparation
- **Runbook'ları güncel tutun**: Her servis için detaylı troubleshooting rehberleri
- **On-call rotasyon planı**: Adil ve sürdürülebilir on-call programı
- **Cross-training**: Ekip üyelerinin birden fazla alanda bilgi sahibi olması

### 2. Response
- **Hızlı acknowledgment**: Alert'leri mümkün olan en kısa sürede onaylayın
- **Clear communication**: Stakeholder'lara düzenli ve net bilgilendirme
- **Focus on resolution**: Blame culture yerine çözüm odaklı yaklaşım

### 3. Learning
- **Blameless post-mortems**: Kişi odaklı değil, sistem odaklı analiz
- **Action item follow-up**: Belirlenen aksiyonların takibi ve implementasyonu
- **Knowledge sharing**: Öğrenilen derslerin tüm organizasyonla paylaşılması

### 4. Continuous Improvement
- **Incident metrics tracking**: MTTR, frequency, impact metriklerinin takibi
- **Process refinement**: Süreçlerin düzenli olarak gözden geçirilmesi
- **Tool optimization**: Kullanılan araçların etkinliğinin artırılması

Etkili incident management, sadece sorunları hızlı çözmekle kalmaz, aynı zamanda organizasyonun öğrenme kapasitesini artırır ve gelecekteki sorunları önlemeye yardımcı olur.
