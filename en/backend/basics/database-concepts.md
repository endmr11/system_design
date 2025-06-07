# Core Database Concepts

## Database Architecture Diagram

```mermaid
graph TD
    subgraph SQL
        SQLApp[Application]
        SQLDB[(SQL Database)]
        SQLApp -- SQL Query --> SQLDB
    end
    subgraph NoSQL
        NoSQLApp[Application]
        NoSQLDB[(NoSQL Database)]
        NoSQLApp -- JSON/BSON/Key-Value --> NoSQLDB
    end
    SQLApp -.-> NoSQLDB
    NoSQLApp -.-> SQLDB
```

# Basic Database Concepts

## SQL Databases (with Spring Boot)

### Spring Data JPA
- **Hibernate ORM** for entity mapping
- `@Entity`/`@Table` annotations for schema mapping

### Repository Pattern
- `JpaRepository<Entity, ID>` for CRUD operations
- Custom query methods (`@Query` annotation)

### Transaction Management
- `@Transactional` annotation for declarative transaction management
- Isolation levels
- Propagation behaviors

### Connection Pooling
- **HikariCP** for production-ready connection pooling
- Connection leak detection

### Database Migration
- **Flyway/Liquibase** for schema versioning
- Baseline migrations
- Repeatable scripts

### PostgreSQL
- JSON/JSONB support
- Advanced indexing
- Full-text search
- Horizontal scaling with CitusDB

### MySQL
- Master-slave replication
- InnoDB storage engine
- Partitioning strategies

## NoSQL Databases (with Spring Boot)

### MongoDB
- **Spring Data MongoDB** for document-based storage
- `@Document` annotation
- Reactive support

### Redis
- **Spring Data Redis** for caching layer
- RedisTemplate/StringRedisTemplate
- Pub/sub messaging

### Elasticsearch
- **Spring Data Elasticsearch** for full-text search
- Aggregations
- Real-time analytics

### Cassandra
- **Spring Data Cassandra** for wide-column store
- Eventual consistency
- High availability

## Database Design Patterns

### Domain-Driven Design
```mermaid
graph TD
    A[Aggregate Root] --> B[Entity 1]
    A --> C[Entity 2]
    B --> D[Value Object 1]
    C --> E[Value Object 2]
    F[Repository] --> A
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style F fill:#bbf,stroke:#333,stroke-width:2px
```

### Event Sourcing
```mermaid
graph LR
    A[Command] --> B[Event Store]
    B --> C[Event Stream]
    C --> D[Projection 1]
    C --> E[Projection 2]
    C --> F[Projection 3]
    style B fill:#f96,stroke:#333,stroke-width:2px
```

### CQRS
```mermaid
graph TD
    A[Command] --> B[Command Handler]
    B --> C[Write Model]
    C --> D[Event Store]
    D --> E[Event Handler]
    E --> F[Read Model]
    G[Query] --> H[Query Handler]
    H --> F
    style C fill:#f96,stroke:#333,stroke-width:2px
    style F fill:#9f6,stroke:#333,stroke-width:2px
```

### Database per Service
- Microservices pattern
- Data ownership
- Distributed transactions challenges

## Indexing - Spring Boot Perspective

### JPA Index Annotations
- `@Index` annotation for entity-level index definitions
- `@Table(indexes = {...})` for composite indices

### Database-Specific Indices
- **PostgreSQL JSONB indices**
- **MySQL full-text indices**
- **Spatial indices** for geographic data

### Performance Monitoring
- Spring Boot Actuator for slow query detection
- Hibernate statistics
- Connection pool metrics

### Index Strategy
- Cardinality analysis
- Covering indices for query performance
- Partial indices for storage optimization

### B-tree Implementation
```mermaid
graph TD
    A[Root Node] --> B[Child 1]
    A --> C[Child 2]
    A --> D[Child 3]
    B --> E[Leaf 1]
    B --> F[Leaf 2]
    C --> G[Leaf 3]
    C --> H[Leaf 4]
    D --> I[Leaf 5]
    D --> J[Leaf 6]
    style A fill:#f96,stroke:#333,stroke-width:2px
```

## Normalization and Denormalization - Spring Boot Context

### Normalization (3NF/BCNF)
- JPA `@OneToMany`/`@ManyToOne` relationships with foreign key constraints
- `@JoinColumn` for relationship mapping

### Denormalization Strategies
- `@Formula` annotation for computed fields
- `@SecondaryTable` for table splitting
- Read-optimized views

### Event-Driven Denormalization
- Domain events for derived data synchronization
- Eventual consistency patterns

### Materialized Views
- Database-level precomputed aggregations
- Spring scheduled tasks for view refresh

### Trade-offs
- Write complexity vs read performance
- Storage cost vs query speed
- Consistency vs availability

## Performance Optimization

### Indexing Strategies
- **B-tree indices**: Default index type, good for equality and range queries
- **Partial indices**: Index only specific rows, reduces index size
- **Composite indices**: Multiple columns, order matters
- **Covering indices**: Include all needed columns, avoid table lookup

### Query Optimization
- **EXPLAIN PLAN** analysis
- **N+1 query problem** (`@EntityGraph`, `@BatchSize`)

### Caching Layers
- **Second-level cache** (Hibernate)
- **Query result cache**
- **Distributed cache** (Redis)

### Read Replicas
- Master-slave replication
- Read-write splitting
- Eventual consistency handling

## Distributed Database Patterns

### Sharding Strategies
```mermaid
graph TD
    A[Router] --> B[Shard 1]
    A --> C[Shard 2]
    A --> D[Shard 3]
    B --> E[Data Partition 1]
    C --> F[Data Partition 2]
    D --> G[Data Partition 3]
    style A fill:#f96,stroke:#333,stroke-width:2px
```

### Replication
```mermaid
graph TD
    A[Master] --> B[Slave 1]
    A --> C[Slave 2]
    A --> D[Slave 3]
    B --> E[Read Replica 1]
    C --> F[Read Replica 2]
    D --> G[Read Replica 3]
    style A fill:#f96,stroke:#333,stroke-width:2px
```

### CAP Theorem
```mermaid
graph TD
    A[CAP Theorem] --> B[Consistency]
    A --> C[Availability]
    A --> D[Partition Tolerance]
    B --> E[All nodes see same data]
    C --> F[System remains operational]
    D --> G[System continues despite network failures]
    style A fill:#f96,stroke:#333,stroke-width:2px
```

### Database Federation
- Cross-database queries
- Data virtualization
- Service-oriented data access

### Polyglot Persistence
- Right tool for right job
- Hybrid storage strategies
- Data synchronization challenges

## SQL vs NoSQL Comparison

| Feature | SQL | NoSQL |
|---------|-----|-------|
| Schema | Fixed | Flexible |
| ACID | ✅ | Varies |
| Scalability | Vertical | Horizontal |
| Complex Queries | ✅ | Limited |
| Consistency | Strong | Eventual |
| Maturity | High | Varies |

## Database Selection Criteria

### Use SQL Databases
- Complex relationships
- ACID compliance required
- Complex queries and analytics
- Strong consistency needs
- Mature ecosystem requirements

### Use NoSQL Databases
- Horizontal scaling needs
- Flexible schema requirements
- High availability priorities
- Simple query patterns
- Rapid development cycles

## Monitoring & Performance

### Database Metrics
- Query execution time
- Connection pool usage
- Index utilization
- Lock contention
- Replication lag

### Optimization Techniques
- Query performance tuning
- Index optimization
- Connection pool tuning
- Partitioning strategies
- Caching implementations
