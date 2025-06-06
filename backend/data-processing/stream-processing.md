# Stream Processing (Akış İşleme)

Stream Processing, gerçek zamanlı veri akışlarını sürekli olarak işleyen mimarilerdir. Bu yaklaşım, geleneksel batch processing'den farklı olarak verileri geldikçe işler ve anında sonuç üretir.

## Temel Kavramlar

### Event Stream
Event Stream, zaman damgasıyla sıralanmış sonsuz veri dizisidir:

```java
@Entity
@Table(name = "event_streams")
public class EventStream {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "event_id", unique = true, nullable = false)
    private String eventId;
    
    @Column(name = "event_type", nullable = false)
    private String eventType;
    
    @Column(name = "event_data", columnDefinition = "TEXT")
    private String eventData;
    
    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;
    
    @Column(name = "partition_key")
    private String partitionKey;
    
    @Column(name = "stream_name", nullable = false)
    private String streamName;
    
    // Constructors, getters, setters
    public EventStream() {}
    
    public EventStream(String eventId, String eventType, String eventData, 
                      String partitionKey, String streamName) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.eventData = eventData;
        this.partitionKey = partitionKey;
        this.streamName = streamName;
        this.timestamp = Instant.now();
    }
    
    // Getters and setters...
}
```

### Stream Producer
Kafka ile stream producer implementasyonu:

```java
@Service
@Slf4j
public class StreamProducerService {
    
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final MeterRegistry meterRegistry;
    private final Timer publishTimer;
    private final Counter publishSuccessCounter;
    private final Counter publishErrorCounter;
    
    public StreamProducerService(KafkaTemplate<String, String> kafkaTemplate,
                               MeterRegistry meterRegistry) {
        this.kafkaTemplate = kafkaTemplate;
        this.meterRegistry = meterRegistry;
        this.publishTimer = Timer.builder("stream.publish.duration")
            .description("Time taken to publish stream events")
            .register(meterRegistry);
        this.publishSuccessCounter = Counter.builder("stream.publish.success")
            .description("Number of successful stream publishes")
            .register(meterRegistry);
        this.publishErrorCounter = Counter.builder("stream.publish.error")
            .description("Number of failed stream publishes")
            .register(meterRegistry);
    }
    
    @Async
    public CompletableFuture<Void> publishEvent(String streamName, 
                                              String partitionKey, 
                                              Object eventData) {
        return Timer.Sample.start(meterRegistry)
            .stop(publishTimer)
            .thenCompose(timer -> {
                try {
                    String eventJson = objectMapper.writeValueAsString(eventData);
                    
                    return kafkaTemplate.send(streamName, partitionKey, eventJson)
                        .addCallback(
                            result -> {
                                publishSuccessCounter.increment();
                                log.info("Event published successfully to stream: {} with key: {}", 
                                        streamName, partitionKey);
                            },
                            failure -> {
                                publishErrorCounter.increment();
                                log.error("Failed to publish event to stream: {} with key: {}", 
                                         streamName, partitionKey, failure);
                            }
                        )
                        .completable()
                        .thenApply(result -> null);
                } catch (Exception e) {
                    publishErrorCounter.increment();
                    log.error("Error serializing event data", e);
                    throw new StreamProcessingException("Failed to serialize event", e);
                }
            });
    }
    
    public void publishOrderEvent(OrderEvent orderEvent) {
        String partitionKey = orderEvent.getCustomerId();
        publishEvent("order-events", partitionKey, orderEvent);
    }
    
    public void publishUserEvent(UserEvent userEvent) {
        String partitionKey = userEvent.getUserId();
        publishEvent("user-events", partitionKey, userEvent);
    }
}
```

## Apache Flink İmplementasyonu

### Flink Stream Job
Apache Flink ile stream processing job'u:

```java
@Component
@Slf4j
public class OrderStreamProcessor {
    
    private final StreamExecutionEnvironment env;
    private final KafkaSource<String> kafkaSource;
    private final OrderAnalyticsService analyticsService;
    
    public OrderStreamProcessor(OrderAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
        this.env = StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Checkpoint configuration
        env.enableCheckpointing(60000); // 1 minute
        env.getCheckpointConfig().setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(600000);
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
        
        // Kafka source configuration
        this.kafkaSource = KafkaSource.<String>builder()
            .setBootstrapServers("localhost:9092")
            .setTopics("order-events")
            .setGroupId("flink-order-processor")
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();
    }
    
    @PostConstruct
    public void startProcessing() {
        try {
            DataStream<String> orderStream = env
                .fromSource(kafkaSource, WatermarkStrategy.noWatermarks(), "Order Events");
            
            // Parse and filter order events
            DataStream<OrderEvent> parsedOrderStream = orderStream
                .map(this::parseOrderEvent)
                .filter(Objects::nonNull);
            
            // Process confirmed orders
            DataStream<OrderEvent> confirmedOrders = parsedOrderStream
                .filter(order -> "ORDER_CONFIRMED".equals(order.getEventType()));
            
            // Windowed aggregations - Order count per customer per hour
            DataStream<CustomerOrderStats> customerStats = confirmedOrders
                .keyBy(OrderEvent::getCustomerId)
                .window(TumblingEventTimeWindows.of(Time.hours(1)))
                .aggregate(new OrderCountAggregator());
            
            // Revenue calculation per hour
            DataStream<RevenueStats> revenueStats = confirmedOrders
                .windowAll(TumblingEventTimeWindows.of(Time.hours(1)))
                .aggregate(new RevenueAggregator());
            
            // Fraud detection - More than 5 orders per minute
            DataStream<FraudAlert> fraudAlerts = confirmedOrders
                .keyBy(OrderEvent::getCustomerId)
                .window(TumblingEventTimeWindows.of(Time.minutes(1)))
                .aggregate(new FraudDetectionAggregator())
                .filter(stats -> stats.getOrderCount() > 5)
                .map(this::createFraudAlert);
            
            // Sink configurations
            customerStats.addSink(new CustomerStatsSink(analyticsService));
            revenueStats.addSink(new RevenueStatsSink(analyticsService));
            fraudAlerts.addSink(new FraudAlertSink());
            
            env.execute("Order Stream Processing Job");
            
        } catch (Exception e) {
            log.error("Failed to start Flink stream processing", e);
            throw new StreamProcessingException("Stream processing startup failed", e);
        }
    }
    
    private OrderEvent parseOrderEvent(String json) {
        try {
            return objectMapper.readValue(json, OrderEvent.class);
        } catch (Exception e) {
            log.warn("Failed to parse order event: {}", json, e);
            return null;
        }
    }
    
    private FraudAlert createFraudAlert(CustomerOrderStats stats) {
        return new FraudAlert(
            stats.getCustomerId(),
            "HIGH_ORDER_FREQUENCY",
            String.format("Customer placed %d orders in 1 minute", stats.getOrderCount()),
            Instant.now()
        );
    }
}
```

### Custom Aggregators
Flink için özel aggregator sınıfları:

```java
public class OrderCountAggregator implements AggregateFunction<OrderEvent, CustomerOrderStats, CustomerOrderStats> {
    
    @Override
    public CustomerOrderStats createAccumulator() {
        return new CustomerOrderStats();
    }
    
    @Override
    public CustomerOrderStats add(OrderEvent orderEvent, CustomerOrderStats accumulator) {
        accumulator.setCustomerId(orderEvent.getCustomerId());
        accumulator.incrementOrderCount();
        accumulator.addRevenue(orderEvent.getAmount());
        accumulator.setLastUpdated(Instant.now());
        return accumulator;
    }
    
    @Override
    public CustomerOrderStats getResult(CustomerOrderStats accumulator) {
        return accumulator;
    }
    
    @Override
    public CustomerOrderStats merge(CustomerOrderStats a, CustomerOrderStats b) {
        CustomerOrderStats merged = new CustomerOrderStats();
        merged.setCustomerId(a.getCustomerId());
        merged.setOrderCount(a.getOrderCount() + b.getOrderCount());
        merged.setTotalRevenue(a.getTotalRevenue().add(b.getTotalRevenue()));
        merged.setLastUpdated(Instant.now());
        return merged;
    }
}

public class RevenueAggregator implements AggregateFunction<OrderEvent, RevenueStats, RevenueStats> {
    
    @Override
    public RevenueStats createAccumulator() {
        return new RevenueStats();
    }
    
    @Override
    public RevenueStats add(OrderEvent orderEvent, RevenueStats accumulator) {
        accumulator.addRevenue(orderEvent.getAmount());
        accumulator.incrementOrderCount();
        accumulator.setLastUpdated(Instant.now());
        return accumulator;
    }
    
    @Override
    public RevenueStats getResult(RevenueStats accumulator) {
        return accumulator;
    }
    
    @Override
    public RevenueStats merge(RevenueStats a, RevenueStats b) {
        RevenueStats merged = new RevenueStats();
        merged.setTotalRevenue(a.getTotalRevenue().add(b.getTotalRevenue()));
        merged.setOrderCount(a.getOrderCount() + b.getOrderCount());
        merged.setLastUpdated(Instant.now());
        return merged;
    }
}
```

## Kafka Streams İmplementasyonu

### Kafka Streams Application
Kafka Streams ile lightweight stream processing:

```java
@Service
@Slf4j
public class KafkaStreamsOrderProcessor {
    
    private final StreamsBuilder streamsBuilder;
    private final KafkaStreams kafkaStreams;
    private final OrderAnalyticsService analyticsService;
    
    public KafkaStreamsOrderProcessor(OrderAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
        this.streamsBuilder = new StreamsBuilder();
        
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-stream-processor");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);
        props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, 30000);
        
        buildTopology();
        this.kafkaStreams = new KafkaStreams(streamsBuilder.build(), props);
    }
    
    private void buildTopology() {
        // Order events stream
        KStream<String, String> orderEvents = streamsBuilder.stream("order-events");
        
        // Parse JSON events
        KStream<String, OrderEvent> parsedOrders = orderEvents
            .mapValues(this::parseOrderEvent)
            .filter((key, value) -> value != null);
        
        // Filter confirmed orders
        KStream<String, OrderEvent> confirmedOrders = parsedOrders
            .filter((key, order) -> "ORDER_CONFIRMED".equals(order.getEventType()));
        
        // Customer order aggregation
        KTable<String, CustomerOrderStats> customerStats = confirmedOrders
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(TimeWindows.of(Duration.ofHours(1)))
            .aggregate(
                CustomerOrderStats::new,
                (customerId, order, stats) -> {
                    stats.setCustomerId(customerId);
                    stats.incrementOrderCount();
                    stats.addRevenue(order.getAmount());
                    stats.setLastUpdated(Instant.now());
                    return stats;
                },
                Materialized.with(Serdes.String(), customerStatsJsonSerde())
            )
            .suppress(Suppressed.untilWindowCloses(Suppressed.BufferConfig.unbounded()));
        
        // Global revenue aggregation
        KTable<String, RevenueStats> revenueStats = confirmedOrders
            .groupBy((key, order) -> "global")
            .windowedBy(TimeWindows.of(Duration.ofHours(1)))
            .aggregate(
                RevenueStats::new,
                (globalKey, order, stats) -> {
                    stats.addRevenue(order.getAmount());
                    stats.incrementOrderCount();
                    stats.setLastUpdated(Instant.now());
                    return stats;
                },
                Materialized.with(Serdes.String(), revenueStatsJsonSerde())
            );
        
        // Fraud detection
        KStream<String, FraudAlert> fraudAlerts = confirmedOrders
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(TimeWindows.of(Duration.ofMinutes(1)))
            .count(Materialized.with(Serdes.String(), Serdes.Long()))
            .toStream()
            .filter((windowedKey, count) -> count > 5)
            .map((windowedKey, count) -> KeyValue.pair(
                windowedKey.key(),
                new FraudAlert(
                    windowedKey.key(),
                    "HIGH_ORDER_FREQUENCY",
                    String.format("Customer placed %d orders in 1 minute", count),
                    Instant.now()
                )
            ));
        
        // Output streams
        customerStats.toStream().foreach(this::processCustomerStats);
        revenueStats.toStream().foreach(this::processRevenueStats);
        fraudAlerts.foreach(this::processFraudAlert);
    }
    
    @PostConstruct
    public void start() {
        kafkaStreams.setUncaughtExceptionHandler((thread, exception) -> {
            log.error("Uncaught exception in Kafka Streams thread: {}", thread.getName(), exception);
            return StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse.REPLACE_THREAD;
        });
        
        kafkaStreams.start();
        log.info("Kafka Streams application started");
    }
    
    @PreDestroy
    public void stop() {
        kafkaStreams.close(Duration.ofSeconds(30));
        log.info("Kafka Streams application stopped");
    }
    
    private OrderEvent parseOrderEvent(String json) {
        try {
            return objectMapper.readValue(json, OrderEvent.class);
        } catch (Exception e) {
            log.warn("Failed to parse order event: {}", json, e);
            return null;
        }
    }
    
    private void processCustomerStats(Windowed<String> windowedKey, CustomerOrderStats stats) {
        analyticsService.updateCustomerStats(stats);
    }
    
    private void processRevenueStats(Windowed<String> windowedKey, RevenueStats stats) {
        analyticsService.updateRevenueStats(stats);
    }
    
    private void processFraudAlert(String customerId, FraudAlert alert) {
        log.warn("Fraud alert for customer {}: {}", customerId, alert.getMessage());
        // Send to fraud detection service
    }
    
    private Serde<CustomerOrderStats> customerStatsJsonSerde() {
        return Serdes.serdeFrom(
            new JsonSerializer<>(),
            new JsonDeserializer<>(CustomerOrderStats.class)
        );
    }
    
    private Serde<RevenueStats> revenueStatsJsonSerde() {
        return Serdes.serdeFrom(
            new JsonSerializer<>(),
            new JsonDeserializer<>(RevenueStats.class)
        );
    }
}
```

## Windowing ve Time-Based Processing

### Time Windows
Zaman tabanlı pencere işlemleri:

```java
@Component
public class WindowedAnalyticsProcessor {
    
    private final StreamsBuilder streamsBuilder;
    
    public void configureTimeWindows() {
        KStream<String, OrderEvent> orderStream = streamsBuilder.stream("order-events");
        
        // Tumbling Window - 1 saatlik aralıklar
        KTable<Windowed<String>, Long> hourlyOrderCounts = orderStream
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(TimeWindows.of(Duration.ofHours(1)))
            .count();
        
        // Hopping Window - 15 dakika kayarak 1 saatlik pencere
        KTable<Windowed<String>, Long> rollingOrderCounts = orderStream
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(TimeWindows.of(Duration.ofHours(1)).advanceBy(Duration.ofMinutes(15)))
            .count();
        
        // Session Window - Aktivite bazlı pencereler
        KTable<Windowed<String>, Long> sessionOrderCounts = orderStream
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(SessionWindows.with(Duration.ofMinutes(30)))
            .count();
        
        // Custom Window - Özel zaman aralıkları
        KTable<Windowed<String>, OrderAnalytics> customAnalytics = orderStream
            .groupBy((key, order) -> order.getCustomerId())
            .windowedBy(TimeWindows.of(Duration.ofHours(6)).grace(Duration.ofMinutes(10)))
            .aggregate(
                OrderAnalytics::new,
                (customerId, order, analytics) -> {
                    analytics.addOrder(order);
                    analytics.calculateMetrics();
                    return analytics;
                },
                Materialized.with(Serdes.String(), orderAnalyticsJsonSerde())
            );
    }
}
```

## State Management

### Stateful Processing
Durum yönetimi ve fault tolerance:

```java
@Service
public class StatefulOrderProcessor {
    
    private final KafkaStreams streams;
    private ReadOnlyKeyValueStore<String, CustomerOrderStats> customerStatsStore;
    
    @PostConstruct
    public void initializeStores() {
        // Wait for streams to be ready
        streams.start();
        
        // Get read-only access to state store
        customerStatsStore = streams.store(
            StoreQueryParameters.fromNameAndType(
                "customer-stats-store",
                QueryableStoreTypes.keyValueStore()
            )
        );
    }
    
    public CustomerOrderStats getCustomerStats(String customerId) {
        return customerStatsStore.get(customerId);
    }
    
    public void configureStatefulProcessing(StreamsBuilder builder) {
        KStream<String, OrderEvent> orderStream = builder.stream("order-events");
        
        // Stateful transformation with custom store
        KTable<String, CustomerOrderStats> customerStats = orderStream
            .groupBy((key, order) -> order.getCustomerId())
            .aggregate(
                CustomerOrderStats::new,
                (customerId, order, stats) -> {
                    // Stateful logic
                    stats.updateWithOrder(order);
                    stats.calculateRunningAverages();
                    stats.updateTrends();
                    return stats;
                },
                Materialized.<String, CustomerOrderStats, KeyValueStore<Bytes, byte[]>>as("customer-stats-store")
                    .withKeySerde(Serdes.String())
                    .withValueSerde(customerStatsJsonSerde())
                    .withCachingEnabled()
                    .withLoggingEnabled(Map.of(
                        "cleanup.policy", "compact",
                        "segment.ms", "86400000" // 1 day
                    ))
            );
        
        // Join with enrichment data
        KTable<String, CustomerProfile> customerProfiles = builder.table("customer-profiles");
        
        KTable<String, EnrichedCustomerStats> enrichedStats = customerStats
            .join(customerProfiles,
                (stats, profile) -> new EnrichedCustomerStats(stats, profile),
                Materialized.with(Serdes.String(), enrichedStatsJsonSerde())
            );
    }
}
```

## Performance ve Monitoring

### Stream Metrics
Stream processing performans metrikleri:

```java
@Component
@Slf4j
public class StreamMetricsCollector {
    
    private final MeterRegistry meterRegistry;
    private final KafkaStreams kafkaStreams;
    
    public StreamMetricsCollector(MeterRegistry meterRegistry, KafkaStreams kafkaStreams) {
        this.meterRegistry = meterRegistry;
        this.kafkaStreams = kafkaStreams;
        configureMetrics();
    }
    
    private void configureMetrics() {
        // Kafka Streams metrics
        Gauge.builder("stream.state")
            .description("Kafka Streams application state")
            .register(meterRegistry, kafkaStreams, streams -> 
                streams.state().ordinal());
        
        // Custom processing metrics
        Timer.builder("stream.processing.latency")
            .description("Stream processing latency")
            .register(meterRegistry);
        
        Counter.builder("stream.events.processed")
            .description("Number of events processed")
            .register(meterRegistry);
        
        Counter.builder("stream.events.failed")
            .description("Number of failed events")
            .register(meterRegistry);
        
        Gauge.builder("stream.lag.records")
            .description("Consumer lag in records")
            .register(meterRegistry, this::calculateConsumerLag);
    }
    
    @Scheduled(fixedRate = 30000) // Her 30 saniyede
    public void collectCustomMetrics() {
        try {
            // Stream topology metrics
            Map<MetricName, ? extends Metric> streamMetrics = kafkaStreams.metrics();
            
            streamMetrics.entrySet().stream()
                .filter(entry -> entry.getKey().name().contains("process-rate"))
                .forEach(entry -> {
                    String metricName = String.format("stream.%s", 
                        entry.getKey().name().replace("-", "."));
                    
                    Gauge.builder(metricName)
                        .description(entry.getKey().description())
                        .register(meterRegistry, entry.getValue(), 
                            metric -> ((Number) metric.metricValue()).doubleValue());
                });
            
            // State store metrics
            ReadOnlyKeyValueStore<String, CustomerOrderStats> store = kafkaStreams.store(
                StoreQueryParameters.fromNameAndType(
                    "customer-stats-store",
                    QueryableStoreTypes.keyValueStore()
                )
            );
            
            KeyValueIterator<String, CustomerOrderStats> iterator = store.all();
            long storeSize = 0;
            while (iterator.hasNext()) {
                iterator.next();
                storeSize++;
            }
            iterator.close();
            
            Gauge.builder("stream.store.size")
                .description("Number of entries in state store")
                .register(meterRegistry, () -> storeSize);
            
        } catch (Exception e) {
            log.error("Failed to collect stream metrics", e);
        }
    }
    
    private double calculateConsumerLag() {
        // Implement consumer lag calculation
        return 0.0;
    }
}
```

## Error Handling ve Resilience

### Error Recovery
Hata yönetimi ve kurtarma stratejileri:

```java
@Service
@Slf4j
public class StreamErrorHandler {
    
    private final DeadLetterQueueService deadLetterService;
    private final AlertService alertService;
    
    public StreamErrorHandler(DeadLetterQueueService deadLetterService,
                            AlertService alertService) {
        this.deadLetterService = deadLetterService;
        this.alertService = alertService;
    }
    
    public void configureErrorHandling(StreamsBuilder builder) {
        KStream<String, String> orderEvents = builder.stream("order-events");
        
        // Branching for error handling
        KStream<String, String>[] branches = orderEvents.branch(
            (key, value) -> isValidEvent(value),  // Valid events
            (key, value) -> true                  // Invalid events (catch-all)
        );
        
        KStream<String, String> validEvents = branches[0];
        KStream<String, String> invalidEvents = branches[1];
        
        // Process valid events
        validEvents
            .mapValues(this::parseEvent)
            .filter((key, event) -> event != null)
            .foreach(this::processEvent);
        
        // Handle invalid events
        invalidEvents
            .mapValues(this::createErrorRecord)
            .to("dead-letter-queue");
        
        // Retry mechanism for failed processing
        validEvents
            .transform(() -> new RetryTransformer<>())
            .filter((key, result) -> !result.isSuccess())
            .mapValues(result -> result.getFailedEvent())
            .to("retry-queue");
    }
    
    private boolean isValidEvent(String eventJson) {
        try {
            JsonNode node = objectMapper.readTree(eventJson);
            return node.has("eventType") && 
                   node.has("timestamp") && 
                   node.has("data");
        } catch (Exception e) {
            return false;
        }
    }
    
    private OrderEvent parseEvent(String eventJson) {
        try {
            return objectMapper.readValue(eventJson, OrderEvent.class);
        } catch (Exception e) {
            log.warn("Failed to parse event: {}", eventJson, e);
            deadLetterService.sendToDeadLetter(eventJson, e.getMessage());
            return null;
        }
    }
    
    private void processEvent(String key, OrderEvent event) {
        try {
            // Process event logic
            log.debug("Processing event: {}", event.getEventId());
        } catch (Exception e) {
            log.error("Failed to process event: {}", event.getEventId(), e);
            alertService.sendAlert("Stream processing failed", e.getMessage());
            throw e; // Re-throw to trigger retry
        }
    }
    
    private ErrorRecord createErrorRecord(String invalidEvent) {
        return new ErrorRecord(
            UUID.randomUUID().toString(),
            invalidEvent,
            "INVALID_FORMAT",
            Instant.now()
        );
    }
}

// Retry Transformer
public class RetryTransformer<K, V> implements Transformer<K, V, KeyValue<K, ProcessingResult<V>>> {
    
    private ProcessorContext context;
    private KeyValueStore<String, Integer> retryCountStore;
    
    @Override
    public void init(ProcessorContext context) {
        this.context = context;
        this.retryCountStore = (KeyValueStore<String, Integer>) context.getStateStore("retry-counts");
    }
    
    @Override
    public KeyValue<K, ProcessingResult<V>> transform(K key, V value) {
        String keyStr = key.toString();
        Integer retryCount = retryCountStore.get(keyStr);
        
        if (retryCount == null) {
            retryCount = 0;
        }
        
        try {
            // Process the value
            ProcessingResult<V> result = processWithRetry(value);
            
            if (result.isSuccess()) {
                retryCountStore.delete(keyStr); // Clear retry count on success
            } else if (retryCount < 3) {
                retryCountStore.put(keyStr, retryCount + 1);
                // Schedule retry
                context.schedule(Duration.ofSeconds(Math.pow(2, retryCount)), 
                               PunctuationType.WALL_CLOCK_TIME, 
                               timestamp -> transform(key, value));
            }
            
            return KeyValue.pair(key, result);
            
        } catch (Exception e) {
            return KeyValue.pair(key, ProcessingResult.failure(value, e.getMessage()));
        }
    }
    
    private ProcessingResult<V> processWithRetry(V value) {
        // Implement retry logic
        try {
            // Process value
            return ProcessingResult.success(value);
        } catch (Exception e) {
            return ProcessingResult.failure(value, e.getMessage());
        }
    }
    
    @Override
    public void close() {
        // Cleanup resources
    }
}
```

## Batch vs Stream Processing Karşılaştırması

### Batch Processing Örneği
Geleneksel batch processing yaklaşımı:

```java
@Service
@Slf4j
public class BatchOrderProcessor {
    
    private final OrderRepository orderRepository;
    private final ReportService reportService;
    
    @Scheduled(cron = "0 0 1 * * ?") // Her gün saat 01:00
    public void processDailyOrders() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDateTime startOfDay = yesterday.atStartOfDay();
        LocalDateTime endOfDay = yesterday.atTime(23, 59, 59);
        
        log.info("Starting daily batch processing for date: {}", yesterday);
        
        try {
            // Retrieve all orders for the day
            List<Order> dailyOrders = orderRepository
                .findByCreatedAtBetween(startOfDay, endOfDay);
            
            // Process in chunks
            int chunkSize = 1000;
            for (int i = 0; i < dailyOrders.size(); i += chunkSize) {
                int endIndex = Math.min(i + chunkSize, dailyOrders.size());
                List<Order> chunk = dailyOrders.subList(i, endIndex);
                
                processBatch(chunk);
            }
            
            // Generate reports
            generateDailyReports(dailyOrders, yesterday);
            
            log.info("Completed daily batch processing for {} orders", dailyOrders.size());
            
        } catch (Exception e) {
            log.error("Failed to process daily batch", e);
            throw new BatchProcessingException("Daily batch processing failed", e);
        }
    }
    
    private void processBatch(List<Order> orders) {
        orders.parallelStream().forEach(order -> {
            try {
                // Calculate metrics
                OrderMetrics metrics = calculateOrderMetrics(order);
                
                // Update aggregations
                updateCustomerStats(order);
                updateProductStats(order);
                updateRevenueStats(order);
                
            } catch (Exception e) {
                log.error("Failed to process order: {}", order.getId(), e);
            }
        });
    }
    
    private void generateDailyReports(List<Order> orders, LocalDate date) {
        // Revenue report
        BigDecimal totalRevenue = orders.stream()
            .map(Order::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // Customer report
        Map<String, Long> customerOrderCounts = orders.stream()
            .collect(Collectors.groupingBy(
                Order::getCustomerId,
                Collectors.counting()
            ));
        
        // Product report
        Map<String, Long> productSales = orders.stream()
            .flatMap(order -> order.getItems().stream())
            .collect(Collectors.groupingBy(
                OrderItem::getProductId,
                Collectors.summingLong(OrderItem::getQuantity)
            ));
        
        reportService.generateDailyReport(date, totalRevenue, customerOrderCounts, productSales);
    }
}
```

### Stream vs Batch Karşılaştırması

| Özellik | Stream Processing | Batch Processing |
|---------|------------------|------------------|
| **Latency** | Düşük (ms-seconds) | Yüksek (minutes-hours) |
| **Throughput** | Orta-Yüksek | Çok Yüksek |
| **Veri Modeli** | Sonsuz akış | Sabit veri seti |
| **İşleme Zamanı** | Gerçek zamanlı | Periyodik |
| **Kaynak Kullanımı** | Sürekli | Periyodik |
| **Fault Tolerance** | Checkpoint/Recovery | Restart from beginning |
| **Use Cases** | Real-time analytics, Fraud detection | ETL, Reporting |

Stream Processing modern uygulamalar için kritik önemdedir çünkü:

1. **Gerçek Zamanlı İnsight**: Anlık karar verme imkanı
2. **Proaktif Yaklaşım**: Sorunları önceden tespit etme
3. **Müşteri Deneyimi**: Hızlı tepki ve kişiselleştirme
4. **İş Sürekliliği**: Kesintisiz veri işleme

Bu örneklerde Apache Flink ve Kafka Streams ile gerçek zamanlı veri işleme, windowing, state management ve error handling implementasyonlarını gördük. Stream processing modern veri mimarilerinin temel taşıdır.
