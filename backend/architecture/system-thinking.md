# Highload Sistemler ve Sistem Düşüncesi

Bu sayfa, bir backend'i tek tek teknoloji seçimleri olarak değil; kullanıcı davranışı, veri akışı, kapasite sınırları, hata alanları ve işletme maliyeti birlikte çalışan bir sistem olarak ele alır.

## Hızlı Karar

| Soru | Başlangıç yaklaşımı | Ne zaman değiştirilmeli? |
| --- | --- | --- |
| Trafik düşük ve belirsiz mi? | Modular monolith, tek veri sahibi | Takımlar, deploy bağımsızlığı veya kapasite ihtiyacı ayrıştığında |
| Okuma yükü baskın mı? | Cache, index ve read replica | Veri hacmi veya hot key tek düğümü zorladığında |
| İşlem uzun sürüyor mu? | Queue ve worker | Kullanıcı yanıtı işlemin tamamlanmasını beklememeliyse |
| Veri hacmi node sınırına yaklaşıyor mu? | Partitioning/sharding | Tek primary veya tek disk kapasite sınırına geldiğinde |
| Bir bağımlılık yavaşlıyor mu? | Timeout, bulkhead, circuit breaker | Retry ve bekleme zinciri kullanıcı trafiğini etkilemeye başladığında |

## Üretim Kontrol Listesi

- Kullanıcı, trafik şekli, veri sahibi ve kritik iş sonucu tanımlı mı?
- Reliability, scalability ve maintainability hedefleri ölçülebilir mi?
- Ortalama yerine p95/p99 latency, peak throughput ve saturation izleniyor mu?
- Her yeni katmanın maliyeti, failure mode'u ve geri alma yolu yazılı mı?
- Sistem tek bir bağımlılığın yavaşlamasında kontrollü şekilde degrade olabiliyor mu?

## Highload ve Data-Intensive Sistemlerin Doğası

Highload yalnızca çok sayıda kullanıcı demek değildir. Trafiğin zamana göre dağılımı, istek başına yapılan iş, veri büyüme hızı ve aynı veriye erişen kullanıcıların yoğunluğu birlikte kapasiteyi belirler.

Data-intensive sistemlerde temel darboğazlar genellikle CPU'dan önce şunlardır:

- disk ve network I/O,
- database connection pool ve lock contention,
- cache hot key veya tek partition,
- queue backlog ve consumer lag,
- cross-region latency ve veri kopyalama maliyeti.

Bir sistemi değerlendirirken şu zincir izlenir:

```mermaid
flowchart LR
    User[Kullanıcı davranışı] --> Load[Trafik ve veri yükü]
    Load --> Capacity[Kapasite sınırları]
    Capacity --> Design[Mimari kararlar]
    Design --> Failure[Hata ve degrade davranışı]
    Failure --> Measure[Ölçüm ve geri besleme]
    Measure --> User
```

## 0'dan Milyon Kullanıcıya Ölçekleme

Ölçekleme, her aşamada aynı mimariyi büyütmek değil, o aşamanın en pahalı darboğazını ortadan kaldırmaktır.

1. **Başlangıç:** Basit servis, tek primary database, güçlü gözlemlenebilirlik ve doğru indexler.
2. **İlk büyüme:** Stateless application instance'ları, load balancer, connection pool sınırları ve temel cache.
3. **Yoğun okuma:** CDN, cache-aside, read replica ve sorgu optimizasyonu.
4. **Ani yük:** Queue, worker, idempotent job ve backpressure.
5. **Veri büyümesi:** Partitioning, arşivleme, read/write ayrımı ve gerektiğinde sharding.
6. **Organizasyonel büyüme:** Modular monolith sınırları, domain ownership, contract test ve bağımsız deploy.
7. **Coğrafi büyüme:** Region seçimi, latency budget, data residency ve multi-region failover.

Erken microservice bölmek network hop, deploy, tracing ve consistency maliyeti ekler. Monolith'i sonsuza kadar korumak da ownership ve bağımsız ölçekleme sorunları doğurur. Geçiş kriteri teknoloji modası değil, ölçülmüş darboğaz ve ekip sınırıdır.

## Reliability, Scalability, Maintainability

- **Reliability:** Sistem doğru sonucu üretir ve hata sonrasında kabul edilebilir sürede toparlanır.
- **Scalability:** Trafik, veri veya tenant sayısı arttığında kapasite öngörülebilir biçimde artırılabilir.
- **Maintainability:** Bir değişiklik sınırlı sayıda bileşeni etkiler; davranış ölçülebilir ve geri alınabilir.

Bu hedefler çatışabilir. Daha fazla replica availability'yi yükseltirken consistency ve maliyet sorunları getirebilir. Daha fazla abstraction maintainability'yi değil, bazen kavrama maliyetini artırabilir.

## Latency, Throughput ve Availability

- **Latency:** Bir işin tamamlanma süresi; kullanıcı deneyimi için p50, p95 ve p99 birlikte incelenir.
- **Throughput:** Birim zamanda işlenen istek, mesaj veya kayıt miktarıdır.
- **Availability:** Başarılı ve kullanılabilir hizmet süresinin toplam hizmet süresine oranıdır.

Bir sistem yüksek throughput'a sahip olup tekil isteklerde yüksek latency üretebilir. Availability de yalnızca process'in ayakta olması değildir; kritik isteğin doğru ve zamanında tamamlanması gerekir.

## System Thinking for Architects

Her tasarım kararı için şu sorular sorulur:

1. Bu bileşen hangi problemi çözüyor?
2. Kendi kapasite sınırı nedir?
3. Başarısız olduğunda upstream ve downstream ne görür?
4. Veri kopyalanıyorsa source of truth neresi?
5. Hangi metriğin değişmesi kararı doğrular?
6. Maliyet ve operasyon yükü kabul edilebilir mi?

Mimari diyagram yalnızca kutuları değil, istek yolu, veri sahipliği, async sınırları, retry davranışı ve gözlemlenebilirlik sinyallerini de göstermelidir.

## Tasarım Sonucu

Bir karar; varsayım, ölçüm, trade-off, failure mode ve geri dönüş planı ile birlikte kaydedildiğinde mimari karar olur. Aksi halde yalnızca teknoloji listesidir.
