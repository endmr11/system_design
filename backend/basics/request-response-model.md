# Request-Response Model (İstek-Yanıt Modeli)

## Spring Boot'ta Request-Response Yaşam Döngüsü

### DispatcherServlet
Spring MVC'nin kalbi, gelen HTTP isteklerini ilgili controller'lara yönlendirir.

```mermaid
sequenceDiagram
    participant Client as İstemci
    participant DispatcherServlet as DispatcherServlet
    participant HandlerMapping as Handler Mapping
    participant Controller as Controller
    participant Service as Servis
    participant Repository as Repository
    
    Client->>DispatcherServlet: HTTP İsteği
    DispatcherServlet->>HandlerMapping: Handler Bul
    HandlerMapping-->>DispatcherServlet: Handler Bulundu
    DispatcherServlet->>Controller: İsteği İşle
    Controller->>Service: İş Mantığı
    Service->>Repository: Veri Erişimi
    Repository-->>Service: Veri
    Service-->>Controller: İşlenmiş Veri
    Controller-->>DispatcherServlet: Yanıt
    DispatcherServlet-->>Client: HTTP Yanıtı
```

### Handler Mapping
URL kalıplarını (`@RequestMapping`, `@GetMapping`) controller metodlarına eşler.

### Controller Katmanı
- `@RestController` ile RESTful uç noktalar
- `@RequestBody`/`@ResponseBody` ile JSON serialization/deserialization

### Servis Katmanı
- `@Service` annotation ile iş mantığı
- `@Transactional` ile transaction yönetimi

### Repository Katmanı
- Spring Data JPA ile ORM eşleme
- `@Repository` ile veri erişim katmanı

## Mikroservislerde Servisler Arası İletişim

### Senkron İletişim
- **OpenFeign client** ile service-to-service HTTP çağrıları
- **Yük dengeleme** için Ribbon/Spring Cloud LoadBalancer

```mermaid
sequenceDiagram
    participant Client as İstemci
    participant API Gateway as API Gateway
    participant Load Balancer as Yük Dengeleyici
    participant Service A as Servis A
    participant Service B as Servis B
    
    Client->>API Gateway: İstek
    API Gateway->>Load Balancer: İsteği Yönlendir
    Load Balancer->>Service A: İsteği İlet
    Service A->>Service B: Feign Client Çağrısı
    Service B-->>Service A: Yanıt
    Service A-->>Load Balancer: Yanıt
    Load Balancer-->>API Gateway: Yanıt
    API Gateway-->>Client: Son Yanıt
```

### Asenkron İletişim
- **Spring Cloud Stream** ile mesaj odaklı mimari
- **RabbitMQ/Apache Kafka** entegrasyonu

```mermaid
sequenceDiagram
    participant Producer as Üretici
    participant Message Broker as Mesaj Aracısı
    participant Consumer 1 as Tüketici 1
    participant Consumer 2 as Tüketici 2
    
    Producer->>Message Broker: Olay Yayınla
    Message Broker->>Consumer 1: Olay İlet
    Message Broker->>Consumer 2: Olay İlet
    Consumer 1-->>Message Broker: Onay
    Consumer 2-->>Message Broker: Onay
```

### Olay Odaklı Mimari
- **Domain olayları** ile gevşek bağlantı
- **Eventual consistency** için event sourcing kalıbı

### Timeout ve Yeniden Deneme
- `@Retryable` annotation ile otomatik yeniden deneme
- **Circuit breaker kalıbı** ile hata toleransı

## Performans Değerlendirmeleri

### Bağlantı Havuzu
- **HikariCP** ile veritabanı bağlantı havuzu
- **Apache HttpClient** ile HTTP bağlantı havuzu

### Önbellekleme
- **Spring Cache abstraction** (`@Cacheable`) ile Redis/Hazelcast entegrasyonu

### Asenkron İşleme
- `@Async` annotation ile engellenmeyen işlemler
- **CompletableFuture** ile asenkron programlama

## API Gateway Kalıbı

### Spring Cloud Gateway
- Rota tanımları
- Koşullar
- Filtreler

```mermaid
graph TD
    Client[İstemci] -->|İstek| Gateway[API Gateway]
    Gateway -->|Rota| Auth[Kimlik Doğrulama]
    Gateway -->|Rota| RateLimit[Hız Sınırlama]
    Gateway -->|Rota| CircuitBreaker[Circuit Breaker]
    Gateway -->|Rota| Transform[İstek/Yanıt Dönüşümü]
    
    Auth -->|Geçerli| Service1[Servis 1]
    RateLimit -->|İzinli| Service2[Servis 2]
    CircuitBreaker -->|Açık| Service3[Servis 3]
    Transform -->|Değiştirilmiş| Service4[Servis 4]
    
    Service1 -->|Yanıt| Gateway
    Service2 -->|Yanıt| Gateway
    Service3 -->|Yanıt| Gateway
    Service4 -->|Yanıt| Gateway
    
    Gateway -->|Son Yanıt| Client
```

### Hız Sınırlama
- Redis tabanlı hız sınırlama
- Token bucket algoritması

### Circuit Breaking
- Resilience4j entegrasyonu
- Fallback mekanizmaları

### İstek/Yanıt Dönüşümü
- Header manipülasyonu
- Body dönüşümü

### Güvenlik
- JWT doğrulama
- OAuth2 entegrasyonu
- API anahtarı yönetimi

## Yük Dengeleme Stratejileri

### İstemci Tarafı Yük Dengeleme
- Spring Cloud LoadBalancer
- Ribbon

```mermaid
graph TD
    Client[İstemci] -->|İstek| LoadBalancer[Yük Dengeleyici]
    LoadBalancer -->|Rota 1| Service1[Servis Örneği 1]
    LoadBalancer -->|Rota 2| Service2[Servis Örneği 2]
    LoadBalancer -->|Rota 3| Service3[Servis Örneği 3]
    
    Service1 -->|Yanıt| LoadBalancer
    Service2 -->|Yanıt| LoadBalancer
    Service3 -->|Yanıt| LoadBalancer
    
    LoadBalancer -->|Son Yanıt| Client
    
    subgraph Load Balancing Algorithms[Yük Dengeleme Algoritmaları]
        RoundRobin[Round Robin]
        Weighted[Ağırlıklı Round Robin]
        LeastConn[En Az Bağlantı]
    end
```

### Sunucu Tarafı Yük Dengeleme
- Nginx
- HAProxy
- AWS ALB

### Sağlık Kontrolleri
- Spring Boot Actuator
- Özel sağlık göstergeleri

### Servis Keşfi Entegrasyonu
- Eureka
- Consul
- Kubernetes servis keşfi

## İstek Yaşam Döngüsü Örneği

```mermaid
sequenceDiagram
    participant Client as İstemci
    participant Gateway as Gateway
    participant Service1 as Servis1
    participant Service2 as Servis2
    participant Database as Veritabanı
    
    Client->>Gateway: HTTP İsteği
    Gateway->>Service1: İsteği Yönlendir
    Service1->>Service2: Servis Çağrısı
    Service2->>Database: Sorgu
    Database-->>Service2: Sonuç
    Service2-->>Service1: Yanıt
    Service1-->>Gateway: Yanıt
    Gateway-->>Client: HTTP Yanıtı
```

## Performans Optimizasyonu

### İstek Optimizasyonu
- Keep-alive bağlantıları
- HTTP/2 multiplexing
- İstek gruplandırma
- Sıkıştırma (gzip)

```mermaid
sequenceDiagram
    participant Client as İstemci
    participant Server as Sunucu
    
    Client->>Server: İlk Bağlantı
    Server-->>Client: Bağlantı Kuruldu
    
    loop Keep-alive Bağlantısı
        Client->>Server: İstek 1
        Server-->>Client: Yanıt 1
        Client->>Server: İstek 2
        Server-->>Client: Yanıt 2
        Client->>Server: İstek 3
        Server-->>Client: Yanıt 3
    end
    
    Note over Client,Server: Bağlantı birden fazla istek için açık kalır
```

### Yanıt Optimizasyonu
- Yanıt önbellekleme
- Sayfalama
- Alan filtreleme
- Veri sıkıştırma

### Hata Yönetimi
- Circuit breaker kalıbı
- Yeniden deneme mekanizmaları
- Zarif bozulma
- Fallback yanıtları

## İzleme ve Gözlemlenebilirlik

### İstek İzleme
- Dağıtık izleme
- Korelasyon ID'leri
- İstek zamanlaması
- Hata takibi

### Metrik Toplama
- İstek sayısı
- Yanıt süresi
- Hata oranı
- İş hacmi

### Günlükleme Stratejisi
- Yapılandırılmış günlükleme
- Günlük toplama
- İstek/yanıt günlükleme
- Güvenlik olayları
