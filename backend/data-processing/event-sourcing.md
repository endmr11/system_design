# Event Sourcing

Event Sourcing, sistem durumunun geçmiş tüm olaylar (event'ler) olarak kaydedilmesi yaklaşımıdır. Bu bölümde Event Sourcing'in Spring Boot ile detaylı implementasyonunu inceleyeceğiz.

## İçindekiler
- [Event Sourcing Temelleri](#event-sourcing-temelleri)
- [Spring Boot ile Event Store Implementasyonu](#spring-boot-ile-event-store-implementasyonu)
- [Event Bus ve Message Publishing](#event-bus-ve-message-publishing)
- [Event Handlers ve Projection](#event-handlers-ve-projection)
- [Implementation Examples](#implementation-examples)

## Event Sourcing Temelleri

### Temel Bileşenler

**Event Store Architecture:**

```java
@Entity
@Table(name = "event_store")
public class EventEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String aggregateId;
    
    @Column(nullable = false)
    private String aggregateType;
    
    @Column(nullable = false)
    private String eventType;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String eventData;
    
    @Column(nullable = false)
    private Long version;
    
    @Column(nullable = false)
    private Instant timestamp;
    
    @Column
    private String metadata;
    
    // Constructors, getters, setters
}
```

**Event Store Repository:**

```java
@Repository
public interface EventStoreRepository extends JpaRepository<EventEntity, Long> {
    
    List<EventEntity> findByAggregateIdOrderByVersionAsc(String aggregateId);
    
    List<EventEntity> findByAggregateIdAndVersionGreaterThanOrderByVersionAsc(
        String aggregateId, Long version);
    
    List<EventEntity> findByAggregateTypeAndTimestampBetweenOrderByTimestampAsc(
        String aggregateType, Instant start, Instant end);
    
    @Query("SELECT e FROM EventEntity e WHERE e.aggregateId = :aggregateId AND e.version = :version")
    Optional<EventEntity> findByAggregateIdAndVersion(
        @Param("aggregateId") String aggregateId, 
        @Param("version") Long version);
    
    @Modifying
    @Query("DELETE FROM EventEntity e WHERE e.aggregateId = :aggregateId AND e.version <= :version")
    void deleteEventsUpToVersion(
        @Param("aggregateId") String aggregateId, 
        @Param("version") Long version);
}
```

### Event Store Service

```java
@Service
@Transactional
@Slf4j
public class EventStoreService {
    
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final MeterRegistry meterRegistry;
    
    public EventStoreService(EventStoreRepository eventStoreRepository,
                           ObjectMapper objectMapper,
                           ApplicationEventPublisher eventPublisher,
                           MeterRegistry meterRegistry) {
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
        this.meterRegistry = meterRegistry;
    }
    
    public void saveEvents(String aggregateId, String aggregateType, 
                          List<DomainEvent> events, Long expectedVersion) {
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            // Optimistic locking check
            validateExpectedVersion(aggregateId, expectedVersion);
            
            List<EventEntity> eventEntities = new ArrayList<>();
            long currentVersion = expectedVersion + 1;
            
            for (DomainEvent event : events) {
                EventEntity eventEntity = createEventEntity(
                    aggregateId, aggregateType, event, currentVersion++);
                eventEntities.add(eventEntity);
            }
            
            eventStoreRepository.saveAll(eventEntities);
            
            // Publish events to event bus
            publishEvents(events);
            
            meterRegistry.counter("event_store.events_saved", 
                "aggregate_type", aggregateType)
                .increment(events.size());
                
            log.info("Saved {} events for aggregate: {}", events.size(), aggregateId);
            
        } catch (Exception e) {
            meterRegistry.counter("event_store.save_errors", 
                "aggregate_type", aggregateType)
                .increment();
            log.error("Failed to save events for aggregate: {}", aggregateId, e);
            throw new EventStoreException("Failed to save events", e);
        } finally {
            sample.stop(Timer.builder("event_store.save_duration")
                .tag("aggregate_type", aggregateType)
                .register(meterRegistry));
        }
    }
    
    public List<DomainEvent> getEvents(String aggregateId) {
        try {
            List<EventEntity> eventEntities = eventStoreRepository
                .findByAggregateIdOrderByVersionAsc(aggregateId);
            
            return eventEntities.stream()
                .map(this::deserializeEvent)
                .collect(Collectors.toList());
                
        } catch (Exception e) {
            log.error("Failed to retrieve events for aggregate: {}", aggregateId, e);
            throw new EventStoreException("Failed to retrieve events", e);
        }
    }
    
    public List<DomainEvent> getEventsAfterVersion(String aggregateId, Long version) {
        try {
            List<EventEntity> eventEntities = eventStoreRepository
                .findByAggregateIdAndVersionGreaterThanOrderByVersionAsc(aggregateId, version);
            
            return eventEntities.stream()
                .map(this::deserializeEvent)
                .collect(Collectors.toList());
                
        } catch (Exception e) {
            log.error("Failed to retrieve events after version {} for aggregate: {}", 
                version, aggregateId, e);
            throw new EventStoreException("Failed to retrieve events", e);
        }
    }
    
    private void validateExpectedVersion(String aggregateId, Long expectedVersion) {
        List<EventEntity> existingEvents = eventStoreRepository
            .findByAggregateIdOrderByVersionAsc(aggregateId);
        
        if (!existingEvents.isEmpty()) {
            Long actualVersion = existingEvents.get(existingEvents.size() - 1).getVersion();
            if (!actualVersion.equals(expectedVersion)) {
                throw new OptimisticLockingException(
                    String.format("Expected version %d but actual version is %d for aggregate %s",
                        expectedVersion, actualVersion, aggregateId));
            }
        } else if (expectedVersion != 0) {
            throw new OptimisticLockingException(
                String.format("Expected version %d but no events exist for aggregate %s",
                    expectedVersion, aggregateId));
        }
    }
    
    private EventEntity createEventEntity(String aggregateId, String aggregateType,
                                        DomainEvent event, Long version) {
        try {
            EventEntity entity = new EventEntity();
            entity.setAggregateId(aggregateId);
            entity.setAggregateType(aggregateType);
            entity.setEventType(event.getClass().getSimpleName());
            entity.setEventData(objectMapper.writeValueAsString(event));
            entity.setVersion(version);
            entity.setTimestamp(event.getTimestamp());
            entity.setMetadata(createMetadata(event));
            return entity;
        } catch (JsonProcessingException e) {
            throw new EventSerializationException("Failed to serialize event", e);
        }
    }
    
    private DomainEvent deserializeEvent(EventEntity entity) {
        try {
            Class<?> eventClass = Class.forName(getEventPackage() + "." + entity.getEventType());
            return (DomainEvent) objectMapper.readValue(entity.getEventData(), eventClass);
        } catch (Exception e) {
            throw new EventDeserializationException("Failed to deserialize event", e);
        }
    }
    
    private void publishEvents(List<DomainEvent> events) {
        events.forEach(event -> {
            try {
                eventPublisher.publishEvent(event);
                log.debug("Published event: {}", event.getClass().getSimpleName());
            } catch (Exception e) {
                log.error("Failed to publish event: {}", event.getClass().getSimpleName(), e);
                // Consider dead letter queue for failed publications
            }
        });
    }
}
```

## Spring Boot ile Event Store Implementasyonu

### Aggregate Root Base Class

```java
public abstract class AggregateRoot {
    
    protected String id;
    protected Long version = 0L;
    private final List<DomainEvent> uncommittedEvents = new ArrayList<>();
    
    protected void applyEvent(DomainEvent event) {
        uncommittedEvents.add(event);
        applyEventToAggregate(event);
        version++;
    }
    
    protected abstract void applyEventToAggregate(DomainEvent event);
    
    public List<DomainEvent> getUncommittedEvents() {
        return new ArrayList<>(uncommittedEvents);
    }
    
    public void markEventsAsCommitted() {
        uncommittedEvents.clear();
    }
    
    public void replayEvents(List<DomainEvent> events) {
        events.forEach(event -> {
            applyEventToAggregate(event);
            version++;
        });
    }
    
    // Getters
    public String getId() { return id; }
    public Long getVersion() { return version; }
}
```

### Domain Events

```java
public abstract class DomainEvent {
    private final String eventId;
    private final Instant timestamp;
    private final String aggregateId;
    
    protected DomainEvent(String aggregateId) {
        this.eventId = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
        this.aggregateId = aggregateId;
    }
    
    // Getters
    public String getEventId() { return eventId; }
    public Instant getTimestamp() { return timestamp; }
    public String getAggregateId() { return aggregateId; }
}

// Order Domain Events
public class OrderCreatedEvent extends DomainEvent {
    private final String customerId;
    private final BigDecimal totalAmount;
    private final List<OrderItem> items;
    
    public OrderCreatedEvent(String aggregateId, String customerId, 
                           BigDecimal totalAmount, List<OrderItem> items) {
        super(aggregateId);
        this.customerId = customerId;
        this.totalAmount = totalAmount;
        this.items = items;
    }
    
    // Getters
}

public class OrderConfirmedEvent extends DomainEvent {
    private final Instant confirmedAt;
    
    public OrderConfirmedEvent(String aggregateId, Instant confirmedAt) {
        super(aggregateId);
        this.confirmedAt = confirmedAt;
    }
    
    // Getters
}

public class OrderCancelledEvent extends DomainEvent {
    private final String reason;
    private final Instant cancelledAt;
    
    public OrderCancelledEvent(String aggregateId, String reason, Instant cancelledAt) {
        super(aggregateId);
        this.reason = reason;
        this.cancelledAt = cancelledAt;
    }
    
    // Getters
}
```

### Order Aggregate Implementation

```java
public class Order extends AggregateRoot {
    
    private String customerId;
    private BigDecimal totalAmount;
    private List<OrderItem> items;
    private OrderStatus status;
    private Instant createdAt;
    private Instant confirmedAt;
    private String cancellationReason;
    
    // Constructor for new orders
    public Order(String customerId, List<OrderItem> items) {
        this.id = UUID.randomUUID().toString();
        this.status = OrderStatus.PENDING;
        
        BigDecimal total = items.stream()
            .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        applyEvent(new OrderCreatedEvent(id, customerId, total, new ArrayList<>(items)));
    }
    
    // Constructor for event replay
    public Order() {
        // Empty constructor for event replay
    }
    
    public void confirm() {
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("Only pending orders can be confirmed");
        }
        
        applyEvent(new OrderConfirmedEvent(id, Instant.now()));
    }
    
    public void cancel(String reason) {
        if (status == OrderStatus.CANCELLED || status == OrderStatus.DELIVERED) {
            throw new IllegalStateException("Order cannot be cancelled in current status: " + status);
        }
        
        applyEvent(new OrderCancelledEvent(id, reason, Instant.now()));
    }
    
    @Override
    protected void applyEventToAggregate(DomainEvent event) {
        if (event instanceof OrderCreatedEvent) {
            applyOrderCreated((OrderCreatedEvent) event);
        } else if (event instanceof OrderConfirmedEvent) {
            applyOrderConfirmed((OrderConfirmedEvent) event);
        } else if (event instanceof OrderCancelledEvent) {
            applyOrderCancelled((OrderCancelledEvent) event);
        }
    }
    
    private void applyOrderCreated(OrderCreatedEvent event) {
        this.customerId = event.getCustomerId();
        this.totalAmount = event.getTotalAmount();
        this.items = new ArrayList<>(event.getItems());
        this.status = OrderStatus.PENDING;
        this.createdAt = event.getTimestamp();
    }
    
    private void applyOrderConfirmed(OrderConfirmedEvent event) {
        this.status = OrderStatus.CONFIRMED;
        this.confirmedAt = event.getConfirmedAt();
    }
    
    private void applyOrderCancelled(OrderCancelledEvent event) {
        this.status = OrderStatus.CANCELLED;
        this.cancellationReason = event.getReason();
    }
    
    // Getters
}
```

## Event Bus ve Message Publishing

### Event Publisher Configuration

```java
@Configuration
@EnableKafka
public class EventBusConfiguration {
    
    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        configProps.put(ProducerConfig.ACKS_CONFIG, "all");
        configProps.put(ProducerConfig.RETRIES_CONFIG, 3);
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        return new DefaultKafkaProducerFactory<>(configProps);
    }
    
    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }
    
    @Bean
    public ApplicationEventPublisher eventPublisher() {
        return new SimpleApplicationEventPublisher();
    }
}
```

### Event Publisher Service

```java
@Service
@Slf4j
public class EventPublisherService {
    
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MeterRegistry meterRegistry;
    
    public EventPublisherService(KafkaTemplate<String, Object> kafkaTemplate,
                               MeterRegistry meterRegistry) {
        this.kafkaTemplate = kafkaTemplate;
        this.meterRegistry = meterRegistry;
    }
    
    @EventListener
    @Async
    public void handleDomainEvent(DomainEvent event) {
        String topicName = getTopicNameForEvent(event);
        
        try {
            ListenableFuture<SendResult<String, Object>> future = 
                kafkaTemplate.send(topicName, event.getAggregateId(), event);
            
            future.addCallback(
                result -> {
                    log.info("Published event {} to topic {}", 
                        event.getClass().getSimpleName(), topicName);
                    meterRegistry.counter("event_bus.published", 
                        "event_type", event.getClass().getSimpleName(),
                        "topic", topicName)
                        .increment();
                },
                failure -> {
                    log.error("Failed to publish event {} to topic {}", 
                        event.getClass().getSimpleName(), topicName, failure);
                    meterRegistry.counter("event_bus.publish_failures",
                        "event_type", event.getClass().getSimpleName(),
                        "topic", topicName)
                        .increment();
                }
            );
            
        } catch (Exception e) {
            log.error("Error publishing event {}", event.getClass().getSimpleName(), e);
            meterRegistry.counter("event_bus.publish_errors",
                "event_type", event.getClass().getSimpleName())
                .increment();
        }
    }
    
    private String getTopicNameForEvent(DomainEvent event) {
        return "events." + event.getClass().getSimpleName().toLowerCase()
            .replaceAll("event$", "");
    }
}
```

## Event Handlers ve Projection

### Read Model Projection

```java
@Entity
@Table(name = "order_read_model")
public class OrderReadModel {
    
    @Id
    private String orderId;
    
    private String customerId;
    private BigDecimal totalAmount;
    private String status;
    private Instant createdAt;
    private Instant confirmedAt;
    private String cancellationReason;
    private Integer itemCount;
    
    // Constructors, getters, setters
}

@Repository
public interface OrderReadModelRepository extends JpaRepository<OrderReadModel, String> {
    
    List<OrderReadModel> findByCustomerId(String customerId);
    
    List<OrderReadModel> findByStatus(String status);
    
    @Query("SELECT o FROM OrderReadModel o WHERE o.createdAt BETWEEN :start AND :end")
    List<OrderReadModel> findByCreatedAtBetween(
        @Param("start") Instant start, 
        @Param("end") Instant end);
}
```

### Event Handlers for Projections

```java
@Component
@Slf4j
public class OrderProjectionHandler {
    
    private final OrderReadModelRepository repository;
    private final MeterRegistry meterRegistry;
    
    public OrderProjectionHandler(OrderReadModelRepository repository,
                                MeterRegistry meterRegistry) {
        this.repository = repository;
        this.meterRegistry = meterRegistry;
    }
    
    @KafkaListener(topics = "events.ordercreated")
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            OrderReadModel readModel = new OrderReadModel();
            readModel.setOrderId(event.getAggregateId());
            readModel.setCustomerId(event.getCustomerId());
            readModel.setTotalAmount(event.getTotalAmount());
            readModel.setStatus("PENDING");
            readModel.setCreatedAt(event.getTimestamp());
            readModel.setItemCount(event.getItems().size());
            
            repository.save(readModel);
            
            meterRegistry.counter("projection.order_created").increment();
            log.info("Updated order projection for order: {}", event.getAggregateId());
            
        } catch (Exception e) {
            log.error("Failed to update projection for OrderCreatedEvent", e);
            meterRegistry.counter("projection.errors", 
                "event_type", "OrderCreatedEvent").increment();
        }
    }
    
    @KafkaListener(topics = "events.orderconfirmed")
    public void handleOrderConfirmed(OrderConfirmedEvent event) {
        try {
            Optional<OrderReadModel> optionalOrder = repository.findById(event.getAggregateId());
            
            if (optionalOrder.isPresent()) {
                OrderReadModel order = optionalOrder.get();
                order.setStatus("CONFIRMED");
                order.setConfirmedAt(event.getConfirmedAt());
                repository.save(order);
                
                meterRegistry.counter("projection.order_confirmed").increment();
                log.info("Updated order projection for confirmed order: {}", event.getAggregateId());
            } else {
                log.warn("Order not found for confirmation: {}", event.getAggregateId());
            }
            
        } catch (Exception e) {
            log.error("Failed to update projection for OrderConfirmedEvent", e);
            meterRegistry.counter("projection.errors", 
                "event_type", "OrderConfirmedEvent").increment();
        }
    }
    
    @KafkaListener(topics = "events.ordercancelled")
    public void handleOrderCancelled(OrderCancelledEvent event) {
        try {
            Optional<OrderReadModel> optionalOrder = repository.findById(event.getAggregateId());
            
            if (optionalOrder.isPresent()) {
                OrderReadModel order = optionalOrder.get();
                order.setStatus("CANCELLED");
                order.setCancellationReason(event.getReason());
                repository.save(order);
                
                meterRegistry.counter("projection.order_cancelled").increment();
                log.info("Updated order projection for cancelled order: {}", event.getAggregateId());
            } else {
                log.warn("Order not found for cancellation: {}", event.getAggregateId());
            }
            
        } catch (Exception e) {
            log.error("Failed to update projection for OrderCancelledEvent", e);
            meterRegistry.counter("projection.errors", 
                "event_type", "OrderCancelledEvent").increment();
        }
    }
}
```

### Repository Pattern for Aggregates

```java
@Service
@Transactional
public class OrderRepository {
    
    private final EventStoreService eventStoreService;
    private final MeterRegistry meterRegistry;
    
    public OrderRepository(EventStoreService eventStoreService,
                         MeterRegistry meterRegistry) {
        this.eventStoreService = eventStoreService;
        this.meterRegistry = meterRegistry;
    }
    
    public void save(Order order) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            List<DomainEvent> events = order.getUncommittedEvents();
            if (!events.isEmpty()) {
                eventStoreService.saveEvents(
                    order.getId(), 
                    "Order", 
                    events, 
                    order.getVersion() - events.size()
                );
                order.markEventsAsCommitted();
            }
            
            meterRegistry.counter("repository.order_saved").increment();
            
        } finally {
            sample.stop(Timer.builder("repository.save_duration")
                .tag("aggregate_type", "Order")
                .register(meterRegistry));
        }
    }
    
    public Optional<Order> findById(String orderId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            List<DomainEvent> events = eventStoreService.getEvents(orderId);
            
            if (events.isEmpty()) {
                return Optional.empty();
            }
            
            Order order = new Order();
            order.replayEvents(events);
            
            meterRegistry.counter("repository.order_loaded").increment();
            return Optional.of(order);
            
        } finally {
            sample.stop(Timer.builder("repository.load_duration")
                .tag("aggregate_type", "Order")
                .register(meterRegistry));
        }
    }
}
```

### Snapshot Support

```java
@Entity
@Table(name = "aggregate_snapshots")
public class AggregateSnapshot {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String aggregateId;
    
    @Column(nullable = false)
    private String aggregateType;
    
    @Column(nullable = false)
    private Long version;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String snapshotData;
    
    @Column(nullable = false)
    private Instant timestamp;
    
    // Constructors, getters, setters
}

@Service
public class SnapshotService {
    
    private final AggregateSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;
    
    public void saveSnapshot(AggregateRoot aggregate, int snapshotFrequency) {
        if (aggregate.getVersion() % snapshotFrequency == 0) {
            try {
                AggregateSnapshot snapshot = new AggregateSnapshot();
                snapshot.setAggregateId(aggregate.getId());
                snapshot.setAggregateType(aggregate.getClass().getSimpleName());
                snapshot.setVersion(aggregate.getVersion());
                snapshot.setSnapshotData(objectMapper.writeValueAsString(aggregate));
                snapshot.setTimestamp(Instant.now());
                
                snapshotRepository.save(snapshot);
                
            } catch (JsonProcessingException e) {
                log.error("Failed to save snapshot for aggregate: {}", aggregate.getId(), e);
            }
        }
    }
    
    public Optional<AggregateSnapshot> getLatestSnapshot(String aggregateId) {
        return snapshotRepository.findTopByAggregateIdOrderByVersionDesc(aggregateId);
    }
}
```

Bu kapsamlı Event Sourcing implementasyonu, Spring Boot ekosisteminde production-ready çözümler sunarak veri tutarlılığı, audit trail ve sistem durumu yönetimi için güçlü bir temel oluşturmaktadır.
