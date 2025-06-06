# Cost Monitoring & Optimization

Modern yazılım geliştirme süreçlerinde maliyet optimizasyonu, hem finansal sürdürülebilirlik hem de operational excellence açısından kritik bir konudur. Cloud computing'in yaygınlaşmasıyla birlikte, IT maliyetleri artık değişken harcamalar haline gelmiş ve doğru yönetilmediğinde kontrolden çıkabilmektedir. Spring Boot uygulamalarında sistemli bir maliyet yönetimi yaklaşımı, hem immediate cost savings hem de long-term strategic benefits sağlar.

Maliyet optimizasyonu, sadece harcamaları azaltmak değil, aynı zamanda değer yaratma ve verimlilik artışı anlamına gelir. Bu yaklaşım, business value ile operational costs arasında optimal dengeyi bulmayı hedefler. FinOps (Financial Operations) prensipleri doğrultusunda, maliyet bilinci tüm organizasyon seviyelerinde yerleştirilmelidir.

## Maliyet Yapısının Analizi ve Bileşenleri

Cloud native uygulamalarda maliyet yapısı, geleneksel on-premise sistemlerden farklı dinamiklere sahiptir. Bu farklılıkları anlamak, etkili optimizasyon stratejileri geliştirmek için temeldir.

### Compute Resource Maliyetleri

**CPU ve Memory Optimizasyonu**: Modern uygulamalarda en büyük maliyet kalemlerinden biri compute kaynaklarıdır. Spring Boot uygulamaları, JVM tabanlı olmaları nedeniyle memory management açısından özel dikkat gerektirir. Garbage collection tuning, heap size optimization ve JIT compilation optimizasyonları, doğrudan compute maliyetlerini etkiler.

**Instance Right-Sizing**: Çoğu organizasyon, "güvenli olmak için" oversized instance'lar kullanır. Bu yaklaşım, %30-50 arası maliyet artışına neden olabilir. Continuous monitoring ve performance analysis ile optimal instance boyutları belirlenmelidir.

**Auto Scaling Strategy**: Reactive scaling yerine predictive scaling yaklaşımları, hem performance hem de cost açısından daha verimli sonuçlar üretir. Historical data analysis ve machine learning algoritmalarıyla gelecekteki ihtiyaçlar öngörülebilir.

### Storage ve Database Maliyetleri

**Data Lifecycle Management**: Data'nın lifecycle'ı boyunca farklı storage tier'larına taşınması, önemli tasarruf sağlar. Hot data için SSD, warm data için standard storage, cold data için archive solutions kullanılmalıdır.

**Database Query Optimization**: Inefficient query'ler sadece performance problemine değil, aynı zamanda compute resource tüketimine ve dolayısıyla maliyete neden olur. Query execution plan analysis ve index optimization kritik önem taşır.

**Log Management Strategy**: Application log'ları hızla büyüyen bir maliyet kalemi haline gelebilir. Structured logging, log level management ve retention policies ile bu maliyetler kontrol altında tutulabilir.

### Network ve Data Transfer Maliyetleri

**Inter-Region Traffic**: Multi-region deployments'ta region arası data transfer'ler önemli maliyet yaratabilir. Data locality ve regional service placement stratejileri bu maliyetleri minimize eder.

**API Gateway ve External Calls**: Third-party service integrations ve API gateway usage, transaction volume'e bağlı olarak hızla artan maliyetler yaratabilir. Connection pooling, caching ve circuit breaker patterns ile bu maliyetler optimize edilebilir.

## Spring Boot Application Cost Monitoring

### Micrometer ile Resource Monitoring

```java
@Configuration
@EnableConfigurationProperties(CostMonitoringProperties.class)
public class CostMonitoringConfiguration {
    
    @Bean
    public CostTrackingMeterFilter costTrackingMeterFilter(
            CostMonitoringProperties properties) {
        return new CostTrackingMeterFilter(properties);
    }
    
    @Bean
    public ResourceUsageCollector resourceUsageCollector(
            MeterRegistry meterRegistry,
            CostMonitoringProperties properties) {
        return new ResourceUsageCollector(meterRegistry, properties);
    }
}

@Component
public class ResourceUsageCollector {
    
    private final MeterRegistry meterRegistry;
    private final CostMonitoringProperties properties;
    private final MemoryMXBean memoryBean;
    private final List<GarbageCollectorMXBean> gcBeans;
    
    public ResourceUsageCollector(MeterRegistry meterRegistry, 
                                CostMonitoringProperties properties) {
        this.meterRegistry = meterRegistry;
        this.properties = properties;
        this.memoryBean = ManagementFactory.getMemoryMXBean();
        this.gcBeans = ManagementFactory.getGarbageCollectorMXBeans();
        
        initializeMetrics();
    }
    
    private void initializeMetrics() {
        // Memory usage tracking
        Gauge.builder("cost.memory.heap.used")
            .description("Heap memory usage in bytes")
            .register(meterRegistry, this, obj -> obj.memoryBean.getHeapMemoryUsage().getUsed());
            
        Gauge.builder("cost.memory.heap.max")
            .description("Maximum heap memory in bytes")
            .register(meterRegistry, this, obj -> obj.memoryBean.getHeapMemoryUsage().getMax());
        
        // CPU usage estimation
        Gauge.builder("cost.cpu.process.usage")
            .description("Process CPU usage")
            .register(meterRegistry, this, this::getProcessCpuUsage);
        
        // Thread count
        Gauge.builder("cost.threads.count")
            .description("Current thread count")
            .register(meterRegistry, this, obj -> ManagementFactory.getThreadMXBean().getThreadCount());
        
        // GC metrics
        gcBeans.forEach(gcBean -> {
            Gauge.builder("cost.gc.collections")
                .tag("gc", gcBean.getName())
                .description("Number of GC collections")
                .register(meterRegistry, gcBean, GarbageCollectorMXBean::getCollectionCount);
                
            Gauge.builder("cost.gc.time")
                .tag("gc", gcBean.getName())
                .description("GC collection time")
                .register(meterRegistry, gcBean, GarbageCollectorMXBean::getCollectionTime);
        });
    }
    
    private double getProcessCpuUsage() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
            return ((com.sun.management.OperatingSystemMXBean) osBean).getProcessCpuLoad() * 100;
        }
        return -1;
    }
    
    @Scheduled(fixedRate = 60000) // Every minute
    public void collectResourceMetrics() {
        // Calculate estimated cost based on resource usage
        double memoryUsageGB = memoryBean.getHeapMemoryUsage().getUsed() / (1024.0 * 1024.0 * 1024.0);
        double cpuUsage = getProcessCpuUsage();
        
        // Estimated hourly cost calculation
        double estimatedHourlyCost = calculateEstimatedCost(memoryUsageGB, cpuUsage);
        
        meterRegistry.gauge("cost.estimated.hourly", estimatedHourlyCost);
        
        // Log cost information
        log.info("Resource Usage - Memory: {:.2f}GB, CPU: {:.2f}%, Estimated Hourly Cost: ${:.4f}",
                memoryUsageGB, cpuUsage, estimatedHourlyCost);
    }
    
    private double calculateEstimatedCost(double memoryGB, double cpuUsage) {
        // AWS t3.medium pricing example (adjust based on your instance type)
        double instanceHourlyCost = 0.0416; // $0.0416 per hour for t3.medium
        
        // Calculate efficiency factor
        double memoryEfficiency = Math.min(memoryGB / 4.0, 1.0); // t3.medium has 4GB RAM
        double cpuEfficiency = cpuUsage / 100.0;
        
        // Weight efficiency (memory 60%, CPU 40%)
        double overallEfficiency = (memoryEfficiency * 0.6) + (cpuEfficiency * 0.4);
        
        return instanceHourlyCost * overallEfficiency;
    }
}
```

### Database Cost Monitoring

```java
@Component
public class DatabaseCostMonitor {
    
    private final DataSource dataSource;
    private final MeterRegistry meterRegistry;
    private final Counter queryCounter;
    private final Timer queryTimer;
    private final DistributionSummary connectionPool;
    
    public DatabaseCostMonitor(DataSource dataSource, MeterRegistry meterRegistry) {
        this.dataSource = dataSource;
        this.meterRegistry = meterRegistry;
        
        this.queryCounter = Counter.builder("cost.database.queries")
            .description("Number of database queries")
            .register(meterRegistry);
            
        this.queryTimer = Timer.builder("cost.database.query.duration")
            .description("Database query execution time")
            .register(meterRegistry);
            
        this.connectionPool = DistributionSummary.builder("cost.database.connections")
            .description("Database connection pool usage")
            .register(meterRegistry);
    }
    
    @EventListener
    public void handleQueryExecution(QueryExecutionEvent event) {
        queryCounter.increment(
            Tags.of(
                "query.type", event.getQueryType(),
                "table", event.getTableName(),
                "operation", event.getOperation()
            )
        );
        
        queryTimer.record(event.getExecutionTime(), TimeUnit.MILLISECONDS);
        
        // Track expensive queries
        if (event.getExecutionTime() > 1000) { // Queries > 1 second
            meterRegistry.counter("cost.database.expensive.queries",
                "query.type", event.getQueryType(),
                "table", event.getTableName()
            ).increment();
            
            log.warn("Expensive query detected: {} ms for {} on table {}",
                    event.getExecutionTime(), event.getOperation(), event.getTableName());
        }
    }
    
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void monitorConnectionPool() {
        if (dataSource instanceof HikariDataSource) {
            HikariDataSource hikariDS = (HikariDataSource) dataSource;
            HikariPoolMXBean poolBean = hikariDS.getHikariPoolMXBean();
            
            connectionPool.record(poolBean.getActiveConnections());
            
            meterRegistry.gauge("cost.database.pool.active", poolBean.getActiveConnections());
            meterRegistry.gauge("cost.database.pool.idle", poolBean.getIdleConnections());
            meterRegistry.gauge("cost.database.pool.total", poolBean.getTotalConnections());
            meterRegistry.gauge("cost.database.pool.waiting", poolBean.getThreadsAwaitingConnection());
            
            // Calculate pool efficiency
            double poolEfficiency = (double) poolBean.getActiveConnections() / poolBean.getTotalConnections();
            meterRegistry.gauge("cost.database.pool.efficiency", poolEfficiency);
            
            // Alert if pool efficiency is low
            if (poolEfficiency < 0.3 && poolBean.getTotalConnections() > 5) {
                log.warn("Low database pool efficiency: {:.2f}% (Active: {}, Total: {})",
                        poolEfficiency * 100, poolBean.getActiveConnections(), poolBean.getTotalConnections());
            }
        }
    }
}

// Custom event for query tracking
public class QueryExecutionEvent {
    private final String queryType;
    private final String tableName;
    private final String operation;
    private final long executionTime;
    private final LocalDateTime timestamp;
    
    // Constructor, getters...
}

// Aspect to track query execution
@Aspect
@Component
public class QueryTrackingAspect {
    
    private final ApplicationEventPublisher eventPublisher;
    
    @Around("@annotation(javax.persistence.Query) || " +
            "execution(* org.springframework.data.jpa.repository.JpaRepository+.*(..))")
    public Object trackQueryExecution(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = joinPoint.proceed();
            long executionTime = System.currentTimeMillis() - startTime;
            
            // Publish query execution event
            QueryExecutionEvent event = new QueryExecutionEvent(
                determineQueryType(joinPoint),
                determineTableName(joinPoint),
                determineOperation(joinPoint),
                executionTime,
                LocalDateTime.now()
            );
            
            eventPublisher.publishEvent(event);
            
            return result;
        } catch (Exception e) {
            // Track failed queries
            long executionTime = System.currentTimeMillis() - startTime;
            // Log and re-throw
            throw e;
        }
    }
}
```

## Cloud Cost Optimization Strategies

### AWS Cost Optimization

```java
@Service
public class AwsCostOptimizationService {
    
    private final AmazonCloudWatch cloudWatch;
    private final AmazonEC2 ec2Client;
    private final MeterRegistry meterRegistry;
    
    @Value("${aws.cost.optimization.enabled:true}")
    private boolean optimizationEnabled;
    
    @Scheduled(cron = "0 0 */6 * * *") // Every 6 hours
    public void analyzeAndOptimize() {
        if (!optimizationEnabled) {
            return;
        }
        
        try {
            analyzeEc2Usage();
            analyzeRdsUsage();
            analyzeS3Usage();
            generateCostReport();
        } catch (Exception e) {
            log.error("Error during cost optimization analysis", e);
        }
    }
    
    private void analyzeEc2Usage() {
        // Get CloudWatch metrics for EC2 instances
        GetMetricStatisticsRequest request = new GetMetricStatisticsRequest()
            .withNamespace("AWS/EC2")
            .withMetricName("CPUUtilization")
            .withStartTime(Date.from(Instant.now().minus(24, ChronoUnit.HOURS)))
            .withEndTime(Date.from(Instant.now()))
            .withPeriod(3600) // 1 hour periods
            .withStatistics("Average");
        
        GetMetricStatisticsResult result = cloudWatch.getMetricStatistics(request);
        
        double avgCpuUtilization = result.getDatapoints().stream()
            .mapToDouble(Datapoint::getAverage)
            .average()
            .orElse(0.0);
        
        meterRegistry.gauge("cost.aws.ec2.cpu.average", avgCpuUtilization);
        
        // Recommend downsizing if CPU usage is consistently low
        if (avgCpuUtilization < 10.0) {
            log.warn("Low EC2 CPU utilization detected: {:.2f}%. Consider downsizing instance.", 
                    avgCpuUtilization);
            
            meterRegistry.counter("cost.optimization.recommendations",
                "type", "ec2_downsize",
                "severity", "medium"
            ).increment();
        }
    }
    
    private void analyzeRdsUsage() {
        GetMetricStatisticsRequest request = new GetMetricStatisticsRequest()
            .withNamespace("AWS/RDS")
            .withMetricName("DatabaseConnections")
            .withStartTime(Date.from(Instant.now().minus(24, ChronoUnit.HOURS)))
            .withEndTime(Date.from(Instant.now()))
            .withPeriod(3600)
            .withStatistics("Average", "Maximum");
        
        GetMetricStatisticsResult result = cloudWatch.getMetricStatistics(request);
        
        OptionalDouble avgConnections = result.getDatapoints().stream()
            .mapToDouble(Datapoint::getAverage)
            .average();
        
        OptionalDouble maxConnections = result.getDatapoints().stream()
            .mapToDouble(Datapoint::getMaximum)
            .max();
        
        if (avgConnections.isPresent() && maxConnections.isPresent()) {
            double connectionUtilization = avgConnections.getAsDouble() / maxConnections.getAsDouble();
            
            meterRegistry.gauge("cost.aws.rds.connection.utilization", connectionUtilization);
            
            if (connectionUtilization < 0.3) {
                log.warn("Low RDS connection utilization: {:.2f}%. Consider smaller instance.", 
                        connectionUtilization * 100);
            }
        }
    }
    
    private void analyzeS3Usage() {
        // S3 storage analysis would go here
        // Check for unused objects, old versions, etc.
    }
    
    private void generateCostReport() {
        CostOptimizationReport report = CostOptimizationReport.builder()
            .reportDate(LocalDateTime.now())
            .ec2Recommendations(getEc2Recommendations())
            .rdsRecommendations(getRdsRecommendations())
            .s3Recommendations(getS3Recommendations())
            .estimatedMonthlySavings(calculateEstimatedSavings())
            .build();
        
        // Send report via email or save to database
        sendCostOptimizationReport(report);
    }
}
```

### Resource Right-Sizing

```java
@Component
public class ResourceRightSizingAnalyzer {
    
    private final MeterRegistry meterRegistry;
    private final ApplicationEventPublisher eventPublisher;
    
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void analyzeResourceUsage() {
        ResourceUsageSnapshot snapshot = captureResourceUsage();
        analyzeAndRecommend(snapshot);
    }
    
    private ResourceUsageSnapshot captureResourceUsage() {
        Runtime runtime = Runtime.getRuntime();
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        
        return ResourceUsageSnapshot.builder()
            .timestamp(Instant.now())
            .totalMemory(runtime.totalMemory())
            .usedMemory(runtime.totalMemory() - runtime.freeMemory())
            .maxMemory(runtime.maxMemory())
            .cpuUsage(getCpuUsage(osBean))
            .threadCount(ManagementFactory.getThreadMXBean().getThreadCount())
            .gcCollections(getGcCollections())
            .build();
    }
    
    private void analyzeAndRecommend(ResourceUsageSnapshot snapshot) {
        // Memory analysis
        double memoryUtilization = (double) snapshot.getUsedMemory() / snapshot.getMaxMemory();
        meterRegistry.gauge("cost.resource.memory.utilization", memoryUtilization);
        
        if (memoryUtilization > 0.85) {
            eventPublisher.publishEvent(new ResourceRecommendationEvent(
                "MEMORY_INCREASE",
                "High memory utilization detected: " + String.format("%.2f%%", memoryUtilization * 100),
                "MEDIUM"
            ));
        } else if (memoryUtilization < 0.5) {
            eventPublisher.publishEvent(new ResourceRecommendationEvent(
                "MEMORY_DECREASE",
                "Low memory utilization detected: " + String.format("%.2f%%", memoryUtilization * 100),
                "LOW"
            ));
        }
        
        // CPU analysis
        if (snapshot.getCpuUsage() > 80.0) {
            eventPublisher.publishEvent(new ResourceRecommendationEvent(
                "CPU_INCREASE",
                "High CPU utilization detected: " + String.format("%.2f%%", snapshot.getCpuUsage()),
                "HIGH"
            ));
        } else if (snapshot.getCpuUsage() < 20.0) {
            eventPublisher.publishEvent(new ResourceRecommendationEvent(
                "CPU_DECREASE",
                "Low CPU utilization detected: " + String.format("%.2f%%", snapshot.getCpuUsage()),
                "LOW"
            ));
        }
        
        // GC analysis
        analyzeGarbageCollection(snapshot);
    }
    
    private void analyzeGarbageCollection(ResourceUsageSnapshot snapshot) {
        long totalGcTime = snapshot.getGcCollections().values().stream()
            .mapToLong(GcStats::getTotalTime)
            .sum();
        
        long totalGcCollections = snapshot.getGcCollections().values().stream()
            .mapToLong(GcStats::getCollectionCount)
            .sum();
        
        if (totalGcCollections > 0) {
            double avgGcTime = (double) totalGcTime / totalGcCollections;
            meterRegistry.gauge("cost.resource.gc.average.time", avgGcTime);
            
            if (avgGcTime > 100) { // More than 100ms average GC time
                eventPublisher.publishEvent(new ResourceRecommendationEvent(
                    "GC_TUNING",
                    "High GC times detected. Consider memory tuning or GC algorithm changes.",
                    "MEDIUM"
                ));
            }
        }
    }
}

@Data
@Builder
public class ResourceUsageSnapshot {
    private Instant timestamp;
    private long totalMemory;
    private long usedMemory;
    private long maxMemory;
    private double cpuUsage;
    private int threadCount;
    private Map<String, GcStats> gcCollections;
}

@Data
@AllArgsConstructor
public class GcStats {
    private long collectionCount;
    private long totalTime;
}
```

## Application-Level Cost Optimization

### Efficient Data Access Patterns

```java
@Repository
public class OptimizedUserRepository {
    
    private final EntityManager entityManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final MeterRegistry meterRegistry;
    
    // Efficient pagination with database cost awareness
    @Cacheable(value = "users", key = "#pageable.pageNumber + '_' + #pageable.pageSize")
    public Page<User> findUsersOptimized(Pageable pageable) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            // Use cursor-based pagination for better performance
            String query = """
                SELECT u FROM User u 
                WHERE u.id > :lastId 
                ORDER BY u.id ASC
                """;
            
            List<User> users = entityManager.createQuery(query, User.class)
                .setParameter("lastId", getLastIdFromCache(pageable))
                .setMaxResults(pageable.getPageSize())
                .getResultList();
            
            // Track database cost
            meterRegistry.counter("cost.database.queries.optimized").increment();
            
            return new PageImpl<>(users, pageable, getTotalCount());
            
        } finally {
            sample.stop(Timer.builder("cost.database.query.duration")
                .tag("operation", "findUsersOptimized")
                .register(meterRegistry));
        }
    }
    
    // Batch operations to reduce database roundtrips
    @Transactional
    public void batchUpdateUsers(List<User> users) {
        int batchSize = 50;
        
        for (int i = 0; i < users.size(); i += batchSize) {
            List<User> batch = users.subList(i, Math.min(i + batchSize, users.size()));
            
            batch.forEach(entityManager::merge);
            
            if (i % batchSize == 0) {
                entityManager.flush();
                entityManager.clear(); // Prevent memory buildup
            }
        }
        
        meterRegistry.counter("cost.database.batch.operations")
            .increment(Math.ceil((double) users.size() / batchSize));
    }
    
    // Projection queries to reduce data transfer
    public List<UserSummary> findUserSummaries() {
        String query = """
            SELECT new com.example.dto.UserSummary(u.id, u.username, u.email)
            FROM User u
            WHERE u.active = true
            """;
        
        List<UserSummary> summaries = entityManager.createQuery(query, UserSummary.class)
            .getResultList();
        
        // Track reduced data transfer
        meterRegistry.counter("cost.database.queries.projection").increment();
        
        return summaries;
    }
}

// Efficient caching strategy
@Service
public class CacheOptimizationService {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final MeterRegistry meterRegistry;
    
    @EventListener
    @Async
    public void handleUserUpdated(UserUpdatedEvent event) {
        // Selective cache invalidation
        Set<String> keysToInvalidate = Set.of(
            "user:" + event.getUserId(),
            "user:profile:" + event.getUserId(),
            "user:preferences:" + event.getUserId()
        );
        
        keysToInvalidate.forEach(key -> {
            redisTemplate.delete(key);
            meterRegistry.counter("cost.cache.invalidations").increment();
        });
        
        // Warm up critical cache entries
        if (event.isCriticalUser()) {
            preloadUserData(event.getUserId());
        }
    }
    
    @Cacheable(value = "expensiveCalculations", key = "#input", 
               condition = "#input.length() > 10") // Only cache expensive operations
    public String performExpensiveCalculation(String input) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            // Simulate expensive calculation
            return processComplexLogic(input);
        } finally {
            sample.stop(Timer.builder("cost.calculation.duration")
                .tag("cached", "true")
                .register(meterRegistry));
        }
    }
    
    @Scheduled(cron = "0 0 2 * * *") // Daily at 2 AM
    public void cleanupExpiredCacheEntries() {
        // Remove expired entries to reduce memory usage
        Set<String> expiredKeys = findExpiredKeys();
        
        if (!expiredKeys.isEmpty()) {
            redisTemplate.delete(expiredKeys);
            meterRegistry.counter("cost.cache.cleanup")
                .increment(expiredKeys.size());
            
            log.info("Cleaned up {} expired cache entries", expiredKeys.size());
        }
    }
}
```

### Auto-scaling Configuration

```java
@Configuration
@ConditionalOnProperty(value = "app.autoscaling.enabled", havingValue = "true")
public class AutoScalingConfiguration {
    
    @Bean
    public ApplicationAutoScaler applicationAutoScaler(
            MeterRegistry meterRegistry,
            AutoScalingProperties properties) {
        return new ApplicationAutoScaler(meterRegistry, properties);
    }
}

@Component
public class ApplicationAutoScaler {
    
    private final MeterRegistry meterRegistry;
    private final AutoScalingProperties properties;
    private final AtomicInteger currentInstances = new AtomicInteger(1);
    
    @Scheduled(fixedRate = 60000) // Check every minute
    public void evaluateScaling() {
        ScalingMetrics metrics = collectScalingMetrics();
        ScalingDecision decision = makeScalingDecision(metrics);
        
        if (decision.shouldScale()) {
            executeScalingDecision(decision);
        }
        
        recordScalingMetrics(metrics, decision);
    }
    
    private ScalingMetrics collectScalingMetrics() {
        double cpuUsage = getCurrentCpuUsage();
        double memoryUsage = getCurrentMemoryUsage();
        double requestRate = getRequestRate();
        double responseTime = getAverageResponseTime();
        
        return ScalingMetrics.builder()
            .cpuUsage(cpuUsage)
            .memoryUsage(memoryUsage)
            .requestRate(requestRate)
            .averageResponseTime(responseTime)
            .timestamp(Instant.now())
            .build();
    }
    
    private ScalingDecision makeScalingDecision(ScalingMetrics metrics) {
        int currentSize = currentInstances.get();
        
        // Scale up conditions
        if (shouldScaleUp(metrics, currentSize)) {
            int targetSize = Math.min(currentSize + 1, properties.getMaxInstances());
            return ScalingDecision.scaleUp(targetSize, calculateScaleUpReason(metrics));
        }
        
        // Scale down conditions
        if (shouldScaleDown(metrics, currentSize)) {
            int targetSize = Math.max(currentSize - 1, properties.getMinInstances());
            return ScalingDecision.scaleDown(targetSize, calculateScaleDownReason(metrics));
        }
        
        return ScalingDecision.noChange();
    }
    
    private boolean shouldScaleUp(ScalingMetrics metrics, int currentSize) {
        return currentSize < properties.getMaxInstances() && (
            metrics.getCpuUsage() > properties.getCpuScaleUpThreshold() ||
            metrics.getMemoryUsage() > properties.getMemoryScaleUpThreshold() ||
            metrics.getAverageResponseTime() > properties.getResponseTimeThreshold()
        );
    }
    
    private boolean shouldScaleDown(ScalingMetrics metrics, int currentSize) {
        return currentSize > properties.getMinInstances() && 
            metrics.getCpuUsage() < properties.getCpuScaleDownThreshold() &&
            metrics.getMemoryUsage() < properties.getMemoryScaleDownThreshold() &&
            metrics.getAverageResponseTime() < properties.getResponseTimeThreshold() * 0.5;
    }
    
    private void executeScalingDecision(ScalingDecision decision) {
        try {
            // Integrate with cloud provider APIs or Kubernetes
            if (decision.getScaleDirection() == ScaleDirection.UP) {
                scaleUp(decision.getTargetInstances());
            } else {
                scaleDown(decision.getTargetInstances());
            }
            
            currentInstances.set(decision.getTargetInstances());
            
            meterRegistry.counter("cost.autoscaling.actions",
                "direction", decision.getScaleDirection().name().toLowerCase(),
                "reason", decision.getReason()
            ).increment();
            
            log.info("Scaling {} to {} instances. Reason: {}", 
                    decision.getScaleDirection(), 
                    decision.getTargetInstances(), 
                    decision.getReason());
            
        } catch (Exception e) {
            log.error("Failed to execute scaling decision", e);
            meterRegistry.counter("cost.autoscaling.failures").increment();
        }
    }
    
    private void recordScalingMetrics(ScalingMetrics metrics, ScalingDecision decision) {
        meterRegistry.gauge("cost.autoscaling.instances.current", currentInstances.get());
        meterRegistry.gauge("cost.autoscaling.cpu.usage", metrics.getCpuUsage());
        meterRegistry.gauge("cost.autoscaling.memory.usage", metrics.getMemoryUsage());
        meterRegistry.gauge("cost.autoscaling.request.rate", metrics.getRequestRate());
        meterRegistry.gauge("cost.autoscaling.response.time", metrics.getAverageResponseTime());
    }
}
```

## Cost Alerting ve Reporting

```java
@Service
public class CostAlertingService {
    
    private final NotificationService notificationService;
    private final MeterRegistry meterRegistry;
    private final CostThresholdProperties thresholds;
    
    @EventListener
    public void handleHighCostAlert(HighCostEvent event) {
        CostAlert alert = CostAlert.builder()
            .alertType(event.getAlertType())
            .currentCost(event.getCurrentCost())
            .threshold(event.getThreshold())
            .resourceType(event.getResourceType())
            .severity(calculateSeverity(event))
            .timestamp(Instant.now())
            .recommendations(generateRecommendations(event))
            .build();
        
        sendCostAlert(alert);
        recordAlertMetrics(alert);
    }
    
    private void sendCostAlert(CostAlert alert) {
        String message = String.format(
            "🚨 Cost Alert: %s\n" +
            "Resource: %s\n" +
            "Current Cost: $%.2f\n" +
            "Threshold: $%.2f\n" +
            "Recommendations:\n%s",
            alert.getAlertType(),
            alert.getResourceType(),
            alert.getCurrentCost(),
            alert.getThreshold(),
            String.join("\n", alert.getRecommendations())
        );
        
        notificationService.sendSlackAlert(message);
        notificationService.sendEmailAlert("Cost Alert", message);
    }
    
    @Scheduled(cron = "0 0 8 * * MON") // Every Monday at 8 AM
    public void generateWeeklyCostReport() {
        WeeklyCostReport report = WeeklyCostReport.builder()
            .reportPeriod(getLastWeek())
            .totalCost(calculateWeeklyCost())
            .costByService(calculateCostByService())
            .costTrends(calculateCostTrends())
            .optimizationOpportunities(identifyOptimizationOpportunities())
            .projectedMonthlyCost(projectMonthlyCost())
            .build();
        
        sendWeeklyCostReport(report);
    }
    
    private List<String> identifyOptimizationOpportunities() {
        List<String> opportunities = new ArrayList<>();
        
        // Analyze metrics for optimization opportunities
        Double avgCpuUsage = meterRegistry.get("cost.cpu.process.usage").gauge().value();
        if (avgCpuUsage < 30.0) {
            opportunities.add("Consider downsizing instances - CPU utilization is low (" + 
                           String.format("%.1f%%", avgCpuUsage) + ")");
        }
        
        Double memoryEfficiency = meterRegistry.get("cost.database.pool.efficiency").gauge().value();
        if (memoryEfficiency < 0.5) {
            opportunities.add("Optimize database connection pool - efficiency is low (" + 
                           String.format("%.1f%%", memoryEfficiency * 100) + ")");
        }
        
        // Add more optimization checks...
        
        return opportunities;
    }
}
```

Maliyet optimizasyonu sürekli bir süreçtir. Spring Boot uygulamalarında doğru monitoring ve optimization stratejileri ile hem performansı artırabilir hem de maliyetleri önemli ölçüde azaltabilirsiniz.
