# CQRS (Command Query Responsibility Segregation)

CQRS, yazma (Command) ve okuma (Query) işlemlerini ayrı modellerde yönetme desenidir. Bu bölümde Spring Boot ile CQRS'in detaylı implementasyonunu inceleyeceğiz.

## İçindekiler
- [CQRS Mimarisi](#cqrs-mimarisi)
- [Command Side Implementation](#command-side-implementation)
- [Query Side Implementation](#query-side-implementation)
- [Event-Driven CQRS](#event-driven-cqrs)
- [Implementation Examples](#implementation-examples)

## CQRS Mimarisi

### Temel Mimari Bileşenleri

**CQRS Configuration:**

```java
@Configuration
@EnableJpaRepositories(
    basePackages = "com.example.command.repository",
    entityManagerFactoryRef = "commandEntityManagerFactory",
    transactionManagerRef = "commandTransactionManager"
)
@EnableSecondaryJpaRepositories(
    basePackages = "com.example.query.repository",
    entityManagerFactoryRef = "queryEntityManagerFactory",
    transactionManagerRef = "queryTransactionManager"
)
public class CqrsConfiguration {
    
    @Primary
    @Bean(name = "commandDataSource")
    @ConfigurationProperties("spring.datasource.command")
    public DataSource commandDataSource() {
        return DataSourceBuilder.create().build();
    }
    
    @Bean(name = "queryDataSource")
    @ConfigurationProperties("spring.datasource.query")
    public DataSource queryDataSource() {
        return DataSourceBuilder.create().build();
    }
    
    @Primary
    @Bean(name = "commandEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean commandEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("commandDataSource") DataSource dataSource) {
        
        return builder
            .dataSource(dataSource)
            .packages("com.example.command.entity")
            .persistenceUnit("command")
            .properties(jpaProperties())
            .build();
    }
    
    @Bean(name = "queryEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean queryEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("queryDataSource") DataSource dataSource) {
        
        return builder
            .dataSource(dataSource)
            .packages("com.example.query.entity")
            .persistenceUnit("query")
            .properties(jpaProperties())
            .build();
    }
    
    @Primary
    @Bean(name = "commandTransactionManager")
    public PlatformTransactionManager commandTransactionManager(
            @Qualifier("commandEntityManagerFactory") 
            EntityManagerFactory commandEntityManagerFactory) {
        return new JpaTransactionManager(commandEntityManagerFactory);
    }
    
    @Bean(name = "queryTransactionManager")
    public PlatformTransactionManager queryTransactionManager(
            @Qualifier("queryEntityManagerFactory") 
            EntityManagerFactory queryEntityManagerFactory) {
        return new JpaTransactionManager(queryEntityManagerFactory);
    }
    
    private Map<String, Object> jpaProperties() {
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", "update");
        properties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        properties.put("hibernate.show_sql", false);
        properties.put("hibernate.format_sql", true);
        return properties;
    }
}
```

### Command and Query Interfaces

```java
// Command interface
public interface Command {
    String getCommandId();
    Instant getTimestamp();
}

// Query interface
public interface Query<T> {
    String getQueryId();
    Class<T> getResponseType();
}

// Command Handler interface
public interface CommandHandler<T extends Command> {
    void handle(T command);
}

// Query Handler interface
public interface QueryHandler<Q extends Query<R>, R> {
    R handle(Q query);
}
```

## Command Side Implementation

### Command Model

```java
// Order Commands
public class CreateOrderCommand implements Command {
    private final String commandId;
    private final Instant timestamp;
    private final String customerId;
    private final List<OrderItem> items;
    private final String shippingAddress;
    
    public CreateOrderCommand(String customerId, List<OrderItem> items, String shippingAddress) {
        this.commandId = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
        this.customerId = customerId;
        this.items = items;
        this.shippingAddress = shippingAddress;
    }
    
    // Getters
}

public class ConfirmOrderCommand implements Command {
    private final String commandId;
    private final Instant timestamp;
    private final String orderId;
    
    public ConfirmOrderCommand(String orderId) {
        this.commandId = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
        this.orderId = orderId;
    }
    
    // Getters
}

public class CancelOrderCommand implements Command {
    private final String commandId;
    private final Instant timestamp;
    private final String orderId;
    private final String reason;
    
    public CancelOrderCommand(String orderId, String reason) {
        this.commandId = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
        this.orderId = orderId;
        this.reason = reason;
    }
    
    // Getters
}
```

### Command Entities (Write Model)

```java
@Entity
@Table(name = "orders")
public class OrderEntity {
    
    @Id
    private String orderId;
    
    @Column(nullable = false)
    private String customerId;
    
    @Column(nullable = false)
    private BigDecimal totalAmount;
    
    @Enumerated(EnumType.STRING)
    private OrderStatus status;
    
    @Column(nullable = false)
    private String shippingAddress;
    
    @Column(nullable = false)
    private Instant createdAt;
    
    private Instant confirmedAt;
    private Instant cancelledAt;
    private String cancellationReason;
    
    @Version
    private Long version;
    
    // Constructors, getters, setters
}

@Entity
@Table(name = "order_items")
public class OrderItemEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String orderId;
    
    @Column(nullable = false)
    private String productId;
    
    @Column(nullable = false)
    private String productName;
    
    @Column(nullable = false)
    private BigDecimal unitPrice;
    
    @Column(nullable = false)
    private Integer quantity;
    
    // Constructors, getters, setters
}
```

### Command Handlers

```java
@Component
@Transactional("commandTransactionManager")
@Slf4j
public class OrderCommandHandler implements 
    CommandHandler<CreateOrderCommand>,
    CommandHandler<ConfirmOrderCommand>,
    CommandHandler<CancelOrderCommand> {
    
    private final OrderCommandRepository orderRepository;
    private final OrderItemCommandRepository orderItemRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final MeterRegistry meterRegistry;
    
    public OrderCommandHandler(OrderCommandRepository orderRepository,
                             OrderItemCommandRepository orderItemRepository,
                             ApplicationEventPublisher eventPublisher,
                             MeterRegistry meterRegistry) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.eventPublisher = eventPublisher;
        this.meterRegistry = meterRegistry;
    }
    
    @Override
    public void handle(CreateOrderCommand command) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            // Validate command
            validateCreateOrderCommand(command);
            
            // Calculate total amount
            BigDecimal totalAmount = command.getItems().stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            // Create order entity
            OrderEntity order = new OrderEntity();
            order.setOrderId(UUID.randomUUID().toString());
            order.setCustomerId(command.getCustomerId());
            order.setTotalAmount(totalAmount);
            order.setStatus(OrderStatus.PENDING);
            order.setShippingAddress(command.getShippingAddress());
            order.setCreatedAt(command.getTimestamp());
            
            orderRepository.save(order);
            
            // Create order items
            List<OrderItemEntity> orderItems = command.getItems().stream()
                .map(item -> {
                    OrderItemEntity orderItem = new OrderItemEntity();
                    orderItem.setOrderId(order.getOrderId());
                    orderItem.setProductId(item.getProductId());
                    orderItem.setProductName(item.getProductName());
                    orderItem.setUnitPrice(item.getUnitPrice());
                    orderItem.setQuantity(item.getQuantity());
                    return orderItem;
                })
                .collect(Collectors.toList());
            
            orderItemRepository.saveAll(orderItems);
            
            // Publish domain event
            OrderCreatedEvent event = new OrderCreatedEvent(
                order.getOrderId(),
                command.getCustomerId(),
                totalAmount,
                command.getItems()
            );
            eventPublisher.publishEvent(event);
            
            meterRegistry.counter("command.order_created").increment();
            log.info("Order created successfully: {}", order.getOrderId());
            
        } catch (Exception e) {
            meterRegistry.counter("command.order_creation_failed").increment();
            log.error("Failed to create order", e);
            throw new CommandHandlingException("Failed to create order", e);
        } finally {
            sample.stop(Timer.builder("command.create_order_duration")
                .register(meterRegistry));
        }
    }
    
    @Override
    public void handle(ConfirmOrderCommand command) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            Optional<OrderEntity> optionalOrder = orderRepository.findById(command.getOrderId());
            
            if (optionalOrder.isEmpty()) {
                throw new OrderNotFoundException("Order not found: " + command.getOrderId());
            }
            
            OrderEntity order = optionalOrder.get();
            
            if (order.getStatus() != OrderStatus.PENDING) {
                throw new InvalidOrderStateException(
                    "Order cannot be confirmed in current state: " + order.getStatus());
            }
            
            order.setStatus(OrderStatus.CONFIRMED);
            order.setConfirmedAt(command.getTimestamp());
            
            orderRepository.save(order);
            
            // Publish domain event
            OrderConfirmedEvent event = new OrderConfirmedEvent(
                order.getOrderId(),
                command.getTimestamp()
            );
            eventPublisher.publishEvent(event);
            
            meterRegistry.counter("command.order_confirmed").increment();
            log.info("Order confirmed successfully: {}", order.getOrderId());
            
        } catch (Exception e) {
            meterRegistry.counter("command.order_confirmation_failed").increment();
            log.error("Failed to confirm order: {}", command.getOrderId(), e);
            throw new CommandHandlingException("Failed to confirm order", e);
        } finally {
            sample.stop(Timer.builder("command.confirm_order_duration")
                .register(meterRegistry));
        }
    }
    
    @Override
    public void handle(CancelOrderCommand command) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            Optional<OrderEntity> optionalOrder = orderRepository.findById(command.getOrderId());
            
            if (optionalOrder.isEmpty()) {
                throw new OrderNotFoundException("Order not found: " + command.getOrderId());
            }
            
            OrderEntity order = optionalOrder.get();
            
            if (order.getStatus() == OrderStatus.CANCELLED || 
                order.getStatus() == OrderStatus.DELIVERED) {
                throw new InvalidOrderStateException(
                    "Order cannot be cancelled in current state: " + order.getStatus());
            }
            
            order.setStatus(OrderStatus.CANCELLED);
            order.setCancelledAt(command.getTimestamp());
            order.setCancellationReason(command.getReason());
            
            orderRepository.save(order);
            
            // Publish domain event
            OrderCancelledEvent event = new OrderCancelledEvent(
                order.getOrderId(),
                command.getReason(),
                command.getTimestamp()
            );
            eventPublisher.publishEvent(event);
            
            meterRegistry.counter("command.order_cancelled").increment();
            log.info("Order cancelled successfully: {}", order.getOrderId());
            
        } catch (Exception e) {
            meterRegistry.counter("command.order_cancellation_failed").increment();
            log.error("Failed to cancel order: {}", command.getOrderId(), e);
            throw new CommandHandlingException("Failed to cancel order", e);
        } finally {
            sample.stop(Timer.builder("command.cancel_order_duration")
                .register(meterRegistry));
        }
    }
    
    private void validateCreateOrderCommand(CreateOrderCommand command) {
        if (command.getCustomerId() == null || command.getCustomerId().trim().isEmpty()) {
            throw new InvalidCommandException("Customer ID is required");
        }
        
        if (command.getItems() == null || command.getItems().isEmpty()) {
            throw new InvalidCommandException("Order items are required");
        }
        
        if (command.getShippingAddress() == null || command.getShippingAddress().trim().isEmpty()) {
            throw new InvalidCommandException("Shipping address is required");
        }
        
        // Additional business validations
        for (OrderItem item : command.getItems()) {
            if (item.getQuantity() <= 0) {
                throw new InvalidCommandException("Item quantity must be greater than zero");
            }
            if (item.getUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new InvalidCommandException("Item price must be greater than zero");
            }
        }
    }
}
```

## Query Side Implementation

### Query Model

```java
// Order Queries
public class GetOrderByIdQuery implements Query<OrderDto> {
    private final String queryId;
    private final String orderId;
    
    public GetOrderByIdQuery(String orderId) {
        this.queryId = UUID.randomUUID().toString();
        this.orderId = orderId;
    }
    
    @Override
    public Class<OrderDto> getResponseType() {
        return OrderDto.class;
    }
    
    // Getters
}

public class GetOrdersByCustomerQuery implements Query<List<OrderSummaryDto>> {
    private final String queryId;
    private final String customerId;
    private final int page;
    private final int size;
    
    public GetOrdersByCustomerQuery(String customerId, int page, int size) {
        this.queryId = UUID.randomUUID().toString();
        this.customerId = customerId;
        this.page = page;
        this.size = size;
    }
    
    @Override
    public Class<List<OrderSummaryDto>> getResponseType() {
        return (Class<List<OrderSummaryDto>>) (Class<?>) List.class;
    }
    
    // Getters
}

public class GetOrderStatisticsQuery implements Query<OrderStatisticsDto> {
    private final String queryId;
    private final Instant startDate;
    private final Instant endDate;
    
    public GetOrderStatisticsQuery(Instant startDate, Instant endDate) {
        this.queryId = UUID.randomUUID().toString();
        this.startDate = startDate;
        this.endDate = endDate;
    }
    
    @Override
    public Class<OrderStatisticsDto> getResponseType() {
        return OrderStatisticsDto.class;
    }
    
    // Getters
}
```

### Query Entities (Read Model)

```java
@Entity
@Table(name = "order_read_model")
public class OrderReadModelEntity {
    
    @Id
    private String orderId;
    
    @Column(nullable = false)
    private String customerId;
    
    @Column(nullable = false)
    private String customerName;
    
    @Column(nullable = false)
    private String customerEmail;
    
    @Column(nullable = false)
    private BigDecimal totalAmount;
    
    @Column(nullable = false)
    private String status;
    
    @Column(nullable = false)
    private String shippingAddress;
    
    @Column(nullable = false)
    private Instant createdAt;
    
    private Instant confirmedAt;
    private Instant cancelledAt;
    private String cancellationReason;
    
    @Column(nullable = false)
    private Integer itemCount;
    
    @Column(nullable = false)
    private Instant lastUpdated;
    
    // Constructors, getters, setters
}

@Entity
@Table(name = "order_item_read_model")
public class OrderItemReadModelEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String orderId;
    
    @Column(nullable = false)
    private String productId;
    
    @Column(nullable = false)
    private String productName;
    
    @Column(nullable = false)
    private String productCategory;
    
    @Column(nullable = false)
    private BigDecimal unitPrice;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Column(nullable = false)
    private BigDecimal totalPrice;
    
    // Constructors, getters, setters
}
```

### Query Handlers

```java
@Component
@Transactional(value = "queryTransactionManager", readOnly = true)
@Slf4j
public class OrderQueryHandler implements 
    QueryHandler<GetOrderByIdQuery, OrderDto>,
    QueryHandler<GetOrdersByCustomerQuery, List<OrderSummaryDto>>,
    QueryHandler<GetOrderStatisticsQuery, OrderStatisticsDto> {
    
    private final OrderQueryRepository orderQueryRepository;
    private final OrderItemQueryRepository orderItemQueryRepository;
    private final MeterRegistry meterRegistry;
    
    public OrderQueryHandler(OrderQueryRepository orderQueryRepository,
                           OrderItemQueryRepository orderItemQueryRepository,
                           MeterRegistry meterRegistry) {
        this.orderQueryRepository = orderQueryRepository;
        this.orderItemQueryRepository = orderItemQueryRepository;
        this.meterRegistry = meterRegistry;
    }
    
    @Override
    public OrderDto handle(GetOrderByIdQuery query) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            Optional<OrderReadModelEntity> optionalOrder = 
                orderQueryRepository.findById(query.getOrderId());
            
            if (optionalOrder.isEmpty()) {
                throw new OrderNotFoundException("Order not found: " + query.getOrderId());
            }
            
            OrderReadModelEntity order = optionalOrder.get();
            List<OrderItemReadModelEntity> items = 
                orderItemQueryRepository.findByOrderId(query.getOrderId());
            
            OrderDto dto = mapToOrderDto(order, items);
            
            meterRegistry.counter("query.get_order_by_id").increment();
            log.debug("Retrieved order: {}", query.getOrderId());
            
            return dto;
            
        } finally {
            sample.stop(Timer.builder("query.get_order_by_id_duration")
                .register(meterRegistry));
        }
    }
    
    @Override
    public List<OrderSummaryDto> handle(GetOrdersByCustomerQuery query) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            Pageable pageable = PageRequest.of(query.getPage(), query.getSize());
            Page<OrderReadModelEntity> orders = 
                orderQueryRepository.findByCustomerId(query.getCustomerId(), pageable);
            
            List<OrderSummaryDto> summaries = orders.getContent().stream()
                .map(this::mapToOrderSummaryDto)
                .collect(Collectors.toList());
            
            meterRegistry.counter("query.get_orders_by_customer").increment();
            log.debug("Retrieved {} orders for customer: {}", 
                summaries.size(), query.getCustomerId());
            
            return summaries;
            
        } finally {
            sample.stop(Timer.builder("query.get_orders_by_customer_duration")
                .register(meterRegistry));
        }
    }
    
    @Override
    public OrderStatisticsDto handle(GetOrderStatisticsQuery query) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            OrderStatisticsProjection stats = orderQueryRepository
                .getOrderStatistics(query.getStartDate(), query.getEndDate());
            
            OrderStatisticsDto dto = new OrderStatisticsDto();
            dto.setTotalOrders(stats.getTotalOrders());
            dto.setTotalRevenue(stats.getTotalRevenue());
            dto.setAverageOrderValue(stats.getAverageOrderValue());
            dto.setConfirmedOrders(stats.getConfirmedOrders());
            dto.setCancelledOrders(stats.getCancelledOrders());
            dto.setPendingOrders(stats.getPendingOrders());
            
            meterRegistry.counter("query.get_order_statistics").increment();
            log.debug("Retrieved order statistics for period: {} to {}", 
                query.getStartDate(), query.getEndDate());
            
            return dto;
            
        } finally {
            sample.stop(Timer.builder("query.get_order_statistics_duration")
                .register(meterRegistry));
        }
    }
    
    private OrderDto mapToOrderDto(OrderReadModelEntity order, 
                                  List<OrderItemReadModelEntity> items) {
        OrderDto dto = new OrderDto();
        dto.setOrderId(order.getOrderId());
        dto.setCustomerId(order.getCustomerId());
        dto.setCustomerName(order.getCustomerName());
        dto.setCustomerEmail(order.getCustomerEmail());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setStatus(order.getStatus());
        dto.setShippingAddress(order.getShippingAddress());
        dto.setCreatedAt(order.getCreatedAt());
        dto.setConfirmedAt(order.getConfirmedAt());
        dto.setCancelledAt(order.getCancelledAt());
        dto.setCancellationReason(order.getCancellationReason());
        
        List<OrderItemDto> itemDtos = items.stream()
            .map(this::mapToOrderItemDto)
            .collect(Collectors.toList());
        dto.setItems(itemDtos);
        
        return dto;
    }
    
    private OrderItemDto mapToOrderItemDto(OrderItemReadModelEntity item) {
        OrderItemDto dto = new OrderItemDto();
        dto.setProductId(item.getProductId());
        dto.setProductName(item.getProductName());
        dto.setProductCategory(item.getProductCategory());
        dto.setUnitPrice(item.getUnitPrice());
        dto.setQuantity(item.getQuantity());
        dto.setTotalPrice(item.getTotalPrice());
        return dto;
    }
    
    private OrderSummaryDto mapToOrderSummaryDto(OrderReadModelEntity order) {
        OrderSummaryDto dto = new OrderSummaryDto();
        dto.setOrderId(order.getOrderId());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setStatus(order.getStatus());
        dto.setCreatedAt(order.getCreatedAt());
        dto.setItemCount(order.getItemCount());
        return dto;
    }
}
```

## Event-Driven CQRS

### Event Handlers for Read Model Updates

```java
@Component
@Slf4j
public class OrderReadModelUpdater {
    
    private final OrderQueryRepository orderQueryRepository;
    private final OrderItemQueryRepository orderItemQueryRepository;
    private final CustomerService customerService;
    private final ProductService productService;
    private final MeterRegistry meterRegistry;
    
    public OrderReadModelUpdater(OrderQueryRepository orderQueryRepository,
                               OrderItemQueryRepository orderItemQueryRepository,
                               CustomerService customerService,
                               ProductService productService,
                               MeterRegistry meterRegistry) {
        this.orderQueryRepository = orderQueryRepository;
        this.orderItemQueryRepository = orderItemQueryRepository;
        this.customerService = customerService;
        this.productService = productService;
        this.meterRegistry = meterRegistry;
    }
    
    @EventListener
    @Async
    @Transactional("queryTransactionManager")
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            // Get customer information
            CustomerDto customer = customerService.getCustomer(event.getCustomerId());
            
            // Create order read model
            OrderReadModelEntity orderReadModel = new OrderReadModelEntity();
            orderReadModel.setOrderId(event.getAggregateId());
            orderReadModel.setCustomerId(event.getCustomerId());
            orderReadModel.setCustomerName(customer.getName());
            orderReadModel.setCustomerEmail(customer.getEmail());
            orderReadModel.setTotalAmount(event.getTotalAmount());
            orderReadModel.setStatus("PENDING");
            orderReadModel.setShippingAddress(event.getShippingAddress());
            orderReadModel.setCreatedAt(event.getTimestamp());
            orderReadModel.setItemCount(event.getItems().size());
            orderReadModel.setLastUpdated(Instant.now());
            
            orderQueryRepository.save(orderReadModel);
            
            // Create order item read models
            List<OrderItemReadModelEntity> itemReadModels = event.getItems().stream()
                .map(item -> {
                    ProductDto product = productService.getProduct(item.getProductId());
                    
                    OrderItemReadModelEntity itemReadModel = new OrderItemReadModelEntity();
                    itemReadModel.setOrderId(event.getAggregateId());
                    itemReadModel.setProductId(item.getProductId());
                    itemReadModel.setProductName(item.getProductName());
                    itemReadModel.setProductCategory(product.getCategory());
                    itemReadModel.setUnitPrice(item.getUnitPrice());
                    itemReadModel.setQuantity(item.getQuantity());
                    itemReadModel.setTotalPrice(
                        item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
                    
                    return itemReadModel;
                })
                .collect(Collectors.toList());
            
            orderItemQueryRepository.saveAll(itemReadModels);
            
            meterRegistry.counter("read_model.order_created").increment();
            log.info("Updated read model for order created: {}", event.getAggregateId());
            
        } catch (Exception e) {
            meterRegistry.counter("read_model.update_errors",
                "event_type", "OrderCreatedEvent").increment();
            log.error("Failed to update read model for OrderCreatedEvent", e);
        }
    }
    
    @EventListener
    @Async
    @Transactional("queryTransactionManager")
    public void handleOrderConfirmed(OrderConfirmedEvent event) {
        try {
            Optional<OrderReadModelEntity> optionalOrder = 
                orderQueryRepository.findById(event.getAggregateId());
            
            if (optionalOrder.isPresent()) {
                OrderReadModelEntity order = optionalOrder.get();
                order.setStatus("CONFIRMED");
                order.setConfirmedAt(event.getConfirmedAt());
                order.setLastUpdated(Instant.now());
                
                orderQueryRepository.save(order);
                
                meterRegistry.counter("read_model.order_confirmed").increment();
                log.info("Updated read model for order confirmed: {}", event.getAggregateId());
            } else {
                log.warn("Order not found in read model for confirmation: {}", event.getAggregateId());
            }
            
        } catch (Exception e) {
            meterRegistry.counter("read_model.update_errors",
                "event_type", "OrderConfirmedEvent").increment();
            log.error("Failed to update read model for OrderConfirmedEvent", e);
        }
    }
    
    @EventListener
    @Async
    @Transactional("queryTransactionManager")
    public void handleOrderCancelled(OrderCancelledEvent event) {
        try {
            Optional<OrderReadModelEntity> optionalOrder = 
                orderQueryRepository.findById(event.getAggregateId());
            
            if (optionalOrder.isPresent()) {
                OrderReadModelEntity order = optionalOrder.get();
                order.setStatus("CANCELLED");
                order.setCancelledAt(event.getTimestamp());
                order.setCancellationReason(event.getReason());
                order.setLastUpdated(Instant.now());
                
                orderQueryRepository.save(order);
                
                meterRegistry.counter("read_model.order_cancelled").increment();
                log.info("Updated read model for order cancelled: {}", event.getAggregateId());
            } else {
                log.warn("Order not found in read model for cancellation: {}", event.getAggregateId());
            }
            
        } catch (Exception e) {
            meterRegistry.counter("read_model.update_errors",
                "event_type", "OrderCancelledEvent").increment();
            log.error("Failed to update read model for OrderCancelledEvent", e);
        }
    }
}
```

### Command and Query Bus

```java
@Component
public class CommandBus {
    
    private final Map<Class<? extends Command>, CommandHandler<? extends Command>> handlers = new HashMap<>();
    private final MeterRegistry meterRegistry;
    
    public CommandBus(List<CommandHandler<? extends Command>> commandHandlers,
                     MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        registerHandlers(commandHandlers);
    }
    
    @SuppressWarnings("unchecked")
    public <T extends Command> void dispatch(T command) {
        CommandHandler<T> handler = (CommandHandler<T>) handlers.get(command.getClass());
        
        if (handler == null) {
            throw new CommandHandlerNotFoundException(
                "No handler found for command: " + command.getClass().getSimpleName());
        }
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Dispatching command: {} with ID: {}", 
                command.getClass().getSimpleName(), command.getCommandId());
            
            handler.handle(command);
            
            meterRegistry.counter("command_bus.dispatched",
                "command_type", command.getClass().getSimpleName()).increment();
            
        } catch (Exception e) {
            meterRegistry.counter("command_bus.dispatch_errors",
                "command_type", command.getClass().getSimpleName()).increment();
            log.error("Failed to dispatch command: {}", command.getClass().getSimpleName(), e);
            throw e;
        } finally {
            sample.stop(Timer.builder("command_bus.dispatch_duration")
                .tag("command_type", command.getClass().getSimpleName())
                .register(meterRegistry));
        }
    }
    
    private void registerHandlers(List<CommandHandler<? extends Command>> commandHandlers) {
        for (CommandHandler<? extends Command> handler : commandHandlers) {
            Type[] genericInterfaces = handler.getClass().getGenericInterfaces();
            for (Type genericInterface : genericInterfaces) {
                if (genericInterface instanceof ParameterizedType) {
                    ParameterizedType parameterizedType = (ParameterizedType) genericInterface;
                    if (CommandHandler.class.equals(parameterizedType.getRawType())) {
                        Type commandType = parameterizedType.getActualTypeArguments()[0];
                        handlers.put((Class<? extends Command>) commandType, handler);
                        break;
                    }
                }
            }
        }
    }
}

@Component
public class QueryBus {
    
    private final Map<Class<? extends Query<?>>, QueryHandler<? extends Query<?>, ?>> handlers = new HashMap<>();
    private final MeterRegistry meterRegistry;
    
    public QueryBus(List<QueryHandler<? extends Query<?>, ?>> queryHandlers,
                   MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        registerHandlers(queryHandlers);
    }
    
    @SuppressWarnings("unchecked")
    public <Q extends Query<R>, R> R dispatch(Q query) {
        QueryHandler<Q, R> handler = (QueryHandler<Q, R>) handlers.get(query.getClass());
        
        if (handler == null) {
            throw new QueryHandlerNotFoundException(
                "No handler found for query: " + query.getClass().getSimpleName());
        }
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.debug("Dispatching query: {} with ID: {}", 
                query.getClass().getSimpleName(), query.getQueryId());
            
            R result = handler.handle(query);
            
            meterRegistry.counter("query_bus.dispatched",
                "query_type", query.getClass().getSimpleName()).increment();
            
            return result;
            
        } catch (Exception e) {
            meterRegistry.counter("query_bus.dispatch_errors",
                "query_type", query.getClass().getSimpleName()).increment();
            log.error("Failed to dispatch query: {}", query.getClass().getSimpleName(), e);
            throw e;
        } finally {
            sample.stop(Timer.builder("query_bus.dispatch_duration")
                .tag("query_type", query.getClass().getSimpleName())
                .register(meterRegistry));
        }
    }
    
    private void registerHandlers(List<QueryHandler<? extends Query<?>, ?>> queryHandlers) {
        for (QueryHandler<? extends Query<?>, ?> handler : queryHandlers) {
            Type[] genericInterfaces = handler.getClass().getGenericInterfaces();
            for (Type genericInterface : genericInterfaces) {
                if (genericInterface instanceof ParameterizedType) {
                    ParameterizedType parameterizedType = (ParameterizedType) genericInterface;
                    if (QueryHandler.class.equals(parameterizedType.getRawType())) {
                        Type queryType = parameterizedType.getActualTypeArguments()[0];
                        handlers.put((Class<? extends Query<?>>) queryType, handler);
                        break;
                    }
                }
            }
        }
    }
}
```

### REST Controller with CQRS

```java
@RestController
@RequestMapping("/api/orders")
@Slf4j
public class OrderController {
    
    private final CommandBus commandBus;
    private final QueryBus queryBus;
    
    public OrderController(CommandBus commandBus, QueryBus queryBus) {
        this.commandBus = commandBus;
        this.queryBus = queryBus;
    }
    
    @PostMapping
    public ResponseEntity<Void> createOrder(@RequestBody @Valid CreateOrderRequest request) {
        CreateOrderCommand command = new CreateOrderCommand(
            request.getCustomerId(),
            request.getItems(),
            request.getShippingAddress()
        );
        
        commandBus.dispatch(command);
        
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
    
    @PutMapping("/{orderId}/confirm")
    public ResponseEntity<Void> confirmOrder(@PathVariable String orderId) {
        ConfirmOrderCommand command = new ConfirmOrderCommand(orderId);
        commandBus.dispatch(command);
        return ResponseEntity.ok().build();
    }
    
    @PutMapping("/{orderId}/cancel")
    public ResponseEntity<Void> cancelOrder(@PathVariable String orderId,
                                          @RequestBody @Valid CancelOrderRequest request) {
        CancelOrderCommand command = new CancelOrderCommand(orderId, request.getReason());
        commandBus.dispatch(command);
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/{orderId}")
    public ResponseEntity<OrderDto> getOrder(@PathVariable String orderId) {
        GetOrderByIdQuery query = new GetOrderByIdQuery(orderId);
        OrderDto order = queryBus.dispatch(query);
        return ResponseEntity.ok(order);
    }
    
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<OrderSummaryDto>> getOrdersByCustomer(
            @PathVariable String customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        GetOrdersByCustomerQuery query = new GetOrdersByCustomerQuery(customerId, page, size);
        List<OrderSummaryDto> orders = queryBus.dispatch(query);
        return ResponseEntity.ok(orders);
    }
    
    @GetMapping("/statistics")
    public ResponseEntity<OrderStatisticsDto> getOrderStatistics(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate) {
        
        GetOrderStatisticsQuery query = new GetOrderStatisticsQuery(startDate, endDate);
        OrderStatisticsDto statistics = queryBus.dispatch(query);
        return ResponseEntity.ok(statistics);
    }
}
```

Bu kapsamlı CQRS implementasyonu, Spring Boot ekosisteminde yazma ve okuma işlemlerinin ayrı optimizasyonuna olanak tanıyarak yüksek performans ve ölçeklenebilirlik sağlamaktadır.
