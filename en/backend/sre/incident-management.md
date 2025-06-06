# Chapter 11.2: Incident Management

Incident Management is a critical component of Site Reliability Engineering that ensures rapid detection, response, and resolution of service disruptions.

## 1. Incident Classification and Severity Levels

### Severity Level Framework

```yaml
incident_severity_levels:
  sev_1_critical:
    description: "Complete service outage affecting all users"
    response_time: "5 minutes"
    escalation_time: "15 minutes"
    communication_frequency: "Every 15 minutes"
    stakeholders:
      - on_call_engineer
      - incident_commander
      - engineering_director
      - customer_support
    
  sev_2_high:
    description: "Major functionality impacted, affecting significant user base"
    response_time: "15 minutes"
    escalation_time: "30 minutes"
    communication_frequency: "Every 30 minutes"
    stakeholders:
      - on_call_engineer
      - team_lead
      - product_manager
    
  sev_3_medium:
    description: "Minor functionality impacted, workaround available"
    response_time: "1 hour"
    escalation_time: "2 hours"
    communication_frequency: "Every 2 hours"
    stakeholders:
      - on_call_engineer
      - team_lead
    
  sev_4_low:
    description: "Minimal impact, can be resolved during business hours"
    response_time: "4 hours"
    escalation_time: "Next business day"
    communication_frequency: "Daily updates"
    stakeholders:
      - assigned_engineer
```

### Automated Incident Detection

```java
@Component
@Slf4j
public class IncidentDetectionEngine {
    
    private final MetricsCollector metricsCollector;
    private final AlertManager alertManager;
    private final IncidentService incidentService;
    private final Map<String, IncidentRule> detectionRules;
    
    @EventListener
    public void handleMetricAlert(MetricAlertEvent event) {
        IncidentRule rule = detectionRules.get(event.getMetricName());
        if (rule != null && rule.matches(event)) {
            processIncident(event, rule);
        }
    }
    
    private void processIncident(MetricAlertEvent event, IncidentRule rule) {
        // Check if incident already exists
        Optional<Incident> existingIncident = incidentService
            .findActiveIncidentByService(event.getServiceName());
        
        if (existingIncident.isPresent()) {
            updateExistingIncident(existingIncident.get(), event);
        } else {
            createNewIncident(event, rule);
        }
    }
    
    private void createNewIncident(MetricAlertEvent event, IncidentRule rule) {
        IncidentSeverity severity = determineSeverity(event, rule);
        
        Incident incident = Incident.builder()
            .id(generateIncidentId())
            .title(generateIncidentTitle(event))
            .description(generateIncidentDescription(event))
            .severity(severity)
            .status(IncidentStatus.INVESTIGATING)
            .affectedService(event.getServiceName())
            .detectedAt(Instant.now())
            .detectionSource(DetectionSource.AUTOMATED)
            .metadata(buildIncidentMetadata(event))
            .build();
        
        incidentService.createIncident(incident);
        
        // Trigger incident response
        triggerIncidentResponse(incident);
        
        log.info("New incident created: {} - Severity: {} - Service: {}", 
            incident.getId(), severity, event.getServiceName());
    }
    
    private void triggerIncidentResponse(Incident incident) {
        // Page on-call engineer
        pagerDutyService.triggerIncident(incident);
        
        // Create incident war room
        slackService.createIncidentChannel(incident);
        
        // Initialize incident commander if SEV-1 or SEV-2
        if (incident.getSeverity().ordinal() <= IncidentSeverity.SEV_2.ordinal()) {
            incidentCommanderService.assignCommander(incident);
        }
        
        // Start automated diagnostics
        diagnosticsService.startAutomatedDiagnostics(incident);
    }
}
```

## 2. Incident Response Process

### Incident Response Workflow

```yaml
incident_response_workflow:
  detection:
    automated_alerts: true
    manual_reporting: true
    customer_reports: true
    
  initial_response:
    acknowledge_alert: "< 5 minutes"
    assess_severity: "< 10 minutes"
    establish_communication: "< 15 minutes"
    
  investigation:
    gather_context: true
    review_recent_changes: true
    check_dependencies: true
    analyze_metrics: true
    
  mitigation:
    implement_workaround: true
    rollback_changes: true
    scale_resources: true
    enable_circuit_breakers: true
    
  resolution:
    verify_fix: true
    monitor_stability: true
    close_incident: true
    
  post_incident:
    conduct_postmortem: true
    implement_improvements: true
    update_documentation: true
```

### Incident Management Service

```java
@Service
@Slf4j
public class IncidentManagementService {
    
    private final IncidentRepository incidentRepository;
    private final TimelineService timelineService;
    private final CommunicationService communicationService;
    private final EscalationService escalationService;
    
    public Incident updateIncidentStatus(String incidentId, 
                                        IncidentStatus newStatus, 
                                        String updateMessage) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IncidentNotFoundException(incidentId));
        
        IncidentStatus previousStatus = incident.getStatus();
        incident.setStatus(newStatus);
        incident.setLastUpdated(Instant.now());
        
        // Add timeline entry
        timelineService.addEntry(incidentId, TimelineEntry.builder()
            .timestamp(Instant.now())
            .type(TimelineEntryType.STATUS_CHANGE)
            .message(String.format("Status changed from %s to %s: %s", 
                previousStatus, newStatus, updateMessage))
            .author(getCurrentUser())
            .build());
        
        // Handle status-specific actions
        handleStatusChange(incident, previousStatus, newStatus);
        
        return incidentRepository.save(incident);
    }
    
    private void handleStatusChange(Incident incident, 
                                   IncidentStatus from, 
                                   IncidentStatus to) {
        switch (to) {
            case INVESTIGATING:
                startInvestigation(incident);
                break;
            case MITIGATED:
                handleMitigation(incident);
                break;
            case RESOLVED:
                handleResolution(incident);
                break;
            case CLOSED:
                handleClosure(incident);
                break;
        }
    }
    
    private void startInvestigation(Incident incident) {
        // Assign primary responder if not already assigned
        if (incident.getAssignedTo() == null) {
            String onCallEngineer = getOnCallEngineer(incident.getAffectedService());
            assignIncident(incident.getId(), onCallEngineer);
        }
        
        // Start automated diagnostics
        diagnosticsService.startDiagnostics(incident);
        
        // Check escalation criteria
        scheduleEscalationCheck(incident);
    }
    
    @Scheduled(fixedDelay = 300000) // Check every 5 minutes
    public void checkEscalations() {
        List<Incident> activeIncidents = incidentRepository
            .findByStatusIn(List.of(
                IncidentStatus.INVESTIGATING, 
                IncidentStatus.MITIGATED
            ));
        
        activeIncidents.forEach(this::checkEscalationCriteria);
    }
    
    private void checkEscalationCriteria(Incident incident) {
        Duration timeElapsed = Duration.between(incident.getDetectedAt(), Instant.now());
        EscalationPolicy policy = getEscalationPolicy(incident.getSeverity());
        
        if (shouldEscalate(incident, timeElapsed, policy)) {
            escalateIncident(incident, policy);
        }
    }
    
    private void escalateIncident(Incident incident, EscalationPolicy policy) {
        EscalationLevel nextLevel = policy.getNextLevel(incident.getCurrentEscalationLevel());
        
        if (nextLevel != null) {
            incident.setCurrentEscalationLevel(nextLevel);
            
            // Notify escalation contacts
            escalationService.notifyEscalation(incident, nextLevel);
            
            // Add timeline entry
            timelineService.addEntry(incident.getId(), TimelineEntry.builder()
                .timestamp(Instant.now())
                .type(TimelineEntryType.ESCALATION)
                .message("Incident escalated to " + nextLevel.getName())
                .automated(true)
                .build());
            
            log.warn("Incident {} escalated to level {}", 
                incident.getId(), nextLevel.getName());
        }
    }
}
```

### Incident Communication System

```java
@Component
public class IncidentCommunicationService {
    
    private final SlackService slackService;
    private final EmailService emailService;
    private final StatusPageService statusPageService;
    private final CustomerNotificationService customerNotificationService;
    
    @EventListener
    public void handleIncidentStatusChange(IncidentStatusChangeEvent event) {
        Incident incident = event.getIncident();
        
        // Internal communications
        sendInternalUpdates(incident, event.getUpdateMessage());
        
        // External communications for customer-facing incidents
        if (isCustomerFacing(incident)) {
            sendExternalUpdates(incident, event.getUpdateMessage());
        }
    }
    
    private void sendInternalUpdates(Incident incident, String updateMessage) {
        // Slack notifications
        String channelId = incident.getSlackChannelId();
        if (channelId != null) {
            SlackMessage message = SlackMessage.builder()
                .channel(channelId)
                .text(formatInternalUpdate(incident, updateMessage))
                .attachments(buildIncidentAttachments(incident))
                .build();
            
            slackService.sendMessage(message);
        }
        
        // Email to stakeholders
        List<String> stakeholders = getStakeholders(incident.getSeverity());
        stakeholders.forEach(email -> {
            emailService.sendIncidentUpdate(email, incident, updateMessage);
        });
    }
    
    private void sendExternalUpdates(Incident incident, String updateMessage) {
        // Update status page
        statusPageService.updateIncident(incident.getId(), 
            mapToStatusPageUpdate(incident, updateMessage));
        
        // Notify affected customers
        if (shouldNotifyCustomers(incident)) {
            customerNotificationService.sendIncidentNotification(
                incident, updateMessage);
        }
    }
    
    public void sendScheduledUpdate(String incidentId) {
        Incident incident = getIncident(incidentId);
        
        if (incident.getStatus() == IncidentStatus.INVESTIGATING || 
            incident.getStatus() == IncidentStatus.MITIGATED) {
            
            String updateMessage = generateStatusUpdate(incident);
            sendInternalUpdates(incident, updateMessage);
            
            if (isCustomerFacing(incident)) {
                sendExternalUpdates(incident, updateMessage);
            }
            
            // Schedule next update
            scheduleNextUpdate(incident);
        }
    }
    
    private String generateStatusUpdate(Incident incident) {
        StringBuilder update = new StringBuilder();
        update.append("Incident Update - ").append(incident.getTitle()).append("\n\n");
        update.append("Status: ").append(incident.getStatus()).append("\n");
        update.append("Duration: ").append(getIncidentDuration(incident)).append("\n");
        
        if (incident.getCurrentAction() != null) {
            update.append("Current Action: ").append(incident.getCurrentAction()).append("\n");
        }
        
        if (incident.getEstimatedResolutionTime() != null) {
            update.append("ETA: ").append(incident.getEstimatedResolutionTime()).append("\n");
        }
        
        return update.toString();
    }
}
```

## 3. Root Cause Analysis (RCA)

### RCA Framework Implementation

```java
@Service
public class RootCauseAnalysisService {
    
    private final IncidentRepository incidentRepository;
    private final ChangeLogService changeLogService;
    private final MetricsAnalysisService metricsAnalysisService;
    private final DependencyService dependencyService;
    
    public RCAnalysisReport conductRCA(String incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IncidentNotFoundException(incidentId));
        
        RCAnalysisReport.Builder reportBuilder = RCAnalysisReport.builder()
            .incidentId(incidentId)
            .analysisDate(LocalDateTime.now())
            .analyst(getCurrentUser());
        
        // Analyze timeline
        Timeline timeline = analyzeIncidentTimeline(incident);
        reportBuilder.timeline(timeline);
        
        // Analyze recent changes
        List<Change> recentChanges = analyzeRecentChanges(incident);
        reportBuilder.recentChanges(recentChanges);
        
        // Analyze metrics and patterns
        MetricsAnalysis metricsAnalysis = analyzeMetricsPatterns(incident);
        reportBuilder.metricsAnalysis(metricsAnalysis);
        
        // Analyze dependencies
        DependencyAnalysis dependencyAnalysis = analyzeDependencies(incident);
        reportBuilder.dependencyAnalysis(dependencyAnalysis);
        
        // Apply RCA techniques
        FiveWhysAnalysis fiveWhys = conductFiveWhysAnalysis(incident);
        reportBuilder.fiveWhysAnalysis(fiveWhys);
        
        FishboneAnalysis fishbone = conductFishboneAnalysis(incident);
        reportBuilder.fishboneAnalysis(fishbone);
        
        // Generate recommendations
        List<Recommendation> recommendations = generateRecommendations(
            timeline, recentChanges, metricsAnalysis, dependencyAnalysis);
        reportBuilder.recommendations(recommendations);
        
        return reportBuilder.build();
    }
    
    private FiveWhysAnalysis conductFiveWhysAnalysis(Incident incident) {
        FiveWhysAnalysis.Builder builder = FiveWhysAnalysis.builder()
            .problem(incident.getTitle());
        
        String currentWhy = incident.getTitle();
        for (int i = 1; i <= 5; i++) {
            String why = analyzeWhy(currentWhy, incident);
            builder.addWhy(i, why);
            currentWhy = why;
            
            if (isRootCause(why)) {
                break;
            }
        }
        
        return builder.build();
    }
    
    private FishboneAnalysis conductFishboneAnalysis(Incident incident) {
        return FishboneAnalysis.builder()
            .problem(incident.getTitle())
            .addCause(CauseCategory.METHODS, analyzeMethodCauses(incident))
            .addCause(CauseCategory.MACHINES, analyzeMachineCauses(incident))
            .addCause(CauseCategory.MATERIALS, analyzeMaterialCauses(incident))
            .addCause(CauseCategory.PEOPLE, analyzePeopleCauses(incident))
            .addCause(CauseCategory.ENVIRONMENT, analyzeEnvironmentCauses(incident))
            .addCause(CauseCategory.MANAGEMENT, analyzeManagementCauses(incident))
            .build();
    }
    
    private List<Recommendation> generateRecommendations(Timeline timeline,
                                                        List<Change> recentChanges,
                                                        MetricsAnalysis metricsAnalysis,
                                                        DependencyAnalysis dependencyAnalysis) {
        List<Recommendation> recommendations = new ArrayList<>();
        
        // Analyze change-related recommendations
        if (!recentChanges.isEmpty()) {
            recommendations.addAll(generateChangeRecommendations(recentChanges));
        }
        
        // Analyze monitoring recommendations
        if (metricsAnalysis.hasGaps()) {
            recommendations.addAll(generateMonitoringRecommendations(metricsAnalysis));
        }
        
        // Analyze process recommendations
        if (timeline.hasDelays()) {
            recommendations.addAll(generateProcessRecommendations(timeline));
        }
        
        // Analyze dependency recommendations
        if (dependencyAnalysis.hasIssues()) {
            recommendations.addAll(generateDependencyRecommendations(dependencyAnalysis));
        }
        
        return recommendations.stream()
            .sorted(Comparator.comparing(Recommendation::getPriority))
            .collect(Collectors.toList());
    }
}
```

### Automated RCA Tools

```java
@Component
public class AutomatedRCATools {
    
    private final LogAnalysisService logAnalysisService;
    private final AnomalyDetectionService anomalyDetectionService;
    private final CorrelationAnalysisService correlationService;
    
    public AutomatedRCAResults analyzeIncident(Incident incident) {
        AutomatedRCAResults.Builder builder = AutomatedRCAResults.builder();
        
        // Analyze logs for anomalies
        LogAnalysisResults logResults = logAnalysisService.analyzeLogsAroundIncident(
            incident.getAffectedService(),
            incident.getDetectedAt().minus(Duration.ofHours(1)),
            incident.getDetectedAt().plus(Duration.ofHours(1))
        );
        builder.logAnalysis(logResults);
        
        // Detect metric anomalies
        List<MetricAnomaly> anomalies = anomalyDetectionService.detectAnomalies(
            incident.getAffectedService(),
            incident.getDetectedAt().minus(Duration.ofHours(2)),
            incident.getDetectedAt()
        );
        builder.metricAnomalies(anomalies);
        
        // Correlate with external events
        List<CorrelatedEvent> correlatedEvents = correlationService.findCorrelatedEvents(
            incident.getDetectedAt(),
            Duration.ofHours(2)
        );
        builder.correlatedEvents(correlatedEvents);
        
        // Generate automated insights
        List<RCAInsight> insights = generateAutomatedInsights(
            logResults, anomalies, correlatedEvents);
        builder.insights(insights);
        
        return builder.build();
    }
    
    private List<RCAInsight> generateAutomatedInsights(LogAnalysisResults logResults,
                                                      List<MetricAnomaly> anomalies,
                                                      List<CorrelatedEvent> correlatedEvents) {
        List<RCAInsight> insights = new ArrayList<>();
        
        // Analyze error patterns in logs
        if (logResults.hasErrorSpikes()) {
            insights.add(RCAInsight.builder()
                .type(InsightType.ERROR_PATTERN)
                .confidence(0.8)
                .description("Error spike detected in logs starting " + 
                    logResults.getErrorSpikeStart())
                .evidence(logResults.getTopErrors())
                .build());
        }
        
        // Analyze metric correlations
        for (MetricAnomaly anomaly : anomalies) {
            if (anomaly.getConfidence() > 0.7) {
                insights.add(RCAInsight.builder()
                    .type(InsightType.METRIC_ANOMALY)
                    .confidence(anomaly.getConfidence())
                    .description(String.format("Anomaly detected in %s: %s", 
                        anomaly.getMetricName(), anomaly.getDescription()))
                    .evidence(List.of(anomaly.getMetricName()))
                    .build());
            }
        }
        
        // Analyze external correlations
        for (CorrelatedEvent event : correlatedEvents) {
            if (event.getCorrelationStrength() > 0.6) {
                insights.add(RCAInsight.builder()
                    .type(InsightType.EXTERNAL_CORRELATION)
                    .confidence(event.getCorrelationStrength())
                    .description(String.format("Correlated with %s at %s", 
                        event.getEventType(), event.getTimestamp()))
                    .evidence(List.of(event.getEventDescription()))
                    .build());
            }
        }
        
        return insights;
    }
}
```

## 4. Post-Incident Review and Improvement

### Post-Mortem Process

```java
@Entity
@Table(name = "post_mortems")
public class PostMortem {
    
    @Id
    private String incidentId;
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String summary;
    
    @Column(columnDefinition = "TEXT")
    private String timeline;
    
    @Column(columnDefinition = "TEXT")
    private String rootCause;
    
    @Column(columnDefinition = "TEXT")
    private String impact;
    
    @ElementCollection
    @CollectionTable(name = "postmortem_action_items")
    private List<ActionItem> actionItems;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column
    private LocalDateTime reviewedAt;
    
    @Enumerated(EnumType.STRING)
    private PostMortemStatus status;
    
    @Column
    private String facilitator;
    
    @ElementCollection
    private List<String> participants;
    
    // Constructors, getters, setters
}

@Embeddable
public class ActionItem {
    
    @Column(nullable = false)
    private String description;
    
    @Column
    private String assignee;
    
    @Column
    private LocalDateTime dueDate;
    
    @Enumerated(EnumType.STRING)
    private ActionItemPriority priority;
    
    @Enumerated(EnumType.STRING)
    private ActionItemStatus status;
    
    @Column
    private String jiraTicket;
    
    // Constructors, getters, setters
}
```

### Post-Mortem Management Service

```java
@Service
@Slf4j
public class PostMortemService {
    
    private final PostMortemRepository postMortemRepository;
    private final IncidentRepository incidentRepository;
    private final ActionItemTrackingService actionItemService;
    private final NotificationService notificationService;
    
    public PostMortem createPostMortem(String incidentId, String facilitator) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new IncidentNotFoundException(incidentId));
        
        PostMortem postMortem = PostMortem.builder()
            .incidentId(incidentId)
            .title("Post-mortem: " + incident.getTitle())
            .createdAt(LocalDateTime.now())
            .status(PostMortemStatus.DRAFT)
            .facilitator(facilitator)
            .build();
        
        // Pre-populate with incident data
        populateFromIncident(postMortem, incident);
        
        return postMortemRepository.save(postMortem);
    }
    
    private void populateFromIncident(PostMortem postMortem, Incident incident) {
        // Generate initial summary
        String summary = generateInitialSummary(incident);
        postMortem.setSummary(summary);
        
        // Generate timeline from incident timeline
        String timeline = generateTimelineFromIncident(incident);
        postMortem.setTimeline(timeline);
        
        // Generate impact assessment
        String impact = generateImpactAssessment(incident);
        postMortem.setImpact(impact);
    }
    
    public PostMortem conductPostMortemReview(String incidentId, 
                                             PostMortemReviewData reviewData) {
        PostMortem postMortem = postMortemRepository.findById(incidentId)
            .orElseThrow(() -> new PostMortemNotFoundException(incidentId));
        
        // Update with review data
        postMortem.setRootCause(reviewData.getRootCause());
        postMortem.setParticipants(reviewData.getParticipants());
        postMortem.setReviewedAt(LocalDateTime.now());
        postMortem.setStatus(PostMortemStatus.REVIEWED);
        
        // Create action items
        List<ActionItem> actionItems = reviewData.getActionItems().stream()
            .map(this::createActionItem)
            .collect(Collectors.toList());
        postMortem.setActionItems(actionItems);
        
        // Schedule follow-up tracking
        scheduleActionItemTracking(postMortem);
        
        // Notify stakeholders
        notificationService.notifyPostMortemCompleted(postMortem);
        
        return postMortemRepository.save(postMortem);
    }
    
    @Scheduled(cron = "0 0 9 * * MON") // Every Monday at 9 AM
    public void trackActionItemProgress() {
        List<PostMortem> activePostMortems = postMortemRepository
            .findByStatusAndActionItemsStatusNot(
                PostMortemStatus.REVIEWED, 
                ActionItemStatus.COMPLETED
            );
        
        activePostMortems.forEach(this::checkActionItemProgress);
    }
    
    private void checkActionItemProgress(PostMortem postMortem) {
        boolean hasOverdueItems = false;
        
        for (ActionItem item : postMortem.getActionItems()) {
            if (item.getStatus() != ActionItemStatus.COMPLETED &&
                item.getDueDate().isBefore(LocalDateTime.now())) {
                
                hasOverdueItems = true;
                
                // Notify assignee
                notificationService.notifyOverdueActionItem(item);
                
                log.warn("Overdue action item: {} - Assignee: {} - Due: {}", 
                    item.getDescription(), item.getAssignee(), item.getDueDate());
            }
        }
        
        if (hasOverdueItems) {
            // Escalate if needed
            escalateOverdueActionItems(postMortem);
        }
    }
    
    public PostMortemMetrics generateMetrics(Duration period) {
        LocalDateTime startDate = LocalDateTime.now().minus(period);
        
        List<PostMortem> postMortems = postMortemRepository
            .findByCreatedAtAfter(startDate);
        
        return PostMortemMetrics.builder()
            .totalIncidents(postMortems.size())
            .averageTimeToPostMortem(calculateAverageTimeToPostMortem(postMortems))
            .actionItemCompletionRate(calculateActionItemCompletionRate(postMortems))
            .topRootCauses(analyzeTopRootCauses(postMortems))
            .improvementTrends(analyzeImprovementTrends(postMortems))
            .build();
    }
}
```

### Integration with External Tools

```yaml
# PagerDuty Integration
pagerduty:
  api_key: "${PAGERDUTY_API_KEY}"
  service_id: "${PAGERDUTY_SERVICE_ID}"
  escalation_policy: "${PAGERDUTY_ESCALATION_POLICY}"
  integration_key: "${PAGERDUTY_INTEGRATION_KEY}"

# Jira Integration
jira:
  url: "${JIRA_URL}"
  username: "${JIRA_USERNAME}"
  api_token: "${JIRA_API_TOKEN}"
  project_key: "INC"
  issue_type: "Incident"

# Slack Integration
slack:
  bot_token: "${SLACK_BOT_TOKEN}"
  incident_channel: "#incidents"
  escalation_channel: "#on-call-escalation"
  postmortem_channel: "#postmortems"

# StatusPage Integration
statuspage:
  api_key: "${STATUSPAGE_API_KEY}"
  page_id: "${STATUSPAGE_PAGE_ID}"
```

```java
@Configuration
@EnableConfigurationProperties({
    PagerDutyProperties.class,
    JiraProperties.class,
    SlackProperties.class,
    StatusPageProperties.class
})
public class IncidentToolsConfiguration {
    
    @Bean
    public PagerDutyClient pagerDutyClient(PagerDutyProperties properties) {
        return PagerDutyClient.builder()
            .apiKey(properties.getApiKey())
            .serviceId(properties.getServiceId())
            .build();
    }
    
    @Bean
    public JiraClient jiraClient(JiraProperties properties) {
        return JiraClient.builder()
            .url(properties.getUrl())
            .username(properties.getUsername())
            .apiToken(properties.getApiToken())
            .build();
    }
    
    @Bean
    public SlackClient slackClient(SlackProperties properties) {
        return SlackClient.builder()
            .botToken(properties.getBotToken())
            .build();
    }
}
```

This comprehensive incident management system provides the foundation for effective incident response, from automated detection through post-incident improvement. The integration with external tools ensures seamless workflow and communication throughout the incident lifecycle.
