import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: "System Design",
  description: "Comprehensive System Design Documentation",
  base: '/system_design/',

  markdown: {
    mermaid: true
  },

  // Internationalization configuration
  locales: {
    root: {
      label: "Türkçe",
      lang: "tr-TR",
      title: "Sistem Tasarımı",
      description: "Kapsamlı Sistem Tasarımı Dokümantasyonu",
      themeConfig: {
        nav: [
          { text: "Ana Sayfa", link: "/" },
          { text: "Backend", link: "/backend/" },
          { text: "Mobil", link: "/mobile/" },
        ],
        sidebar: {
          "/backend/": [
            {
              text: "Giriş",
              items: [{ text: "Backend Sistem Tasarımı", link: "/backend/" }],
            },
            {
              text: "1. Temel Kavramlar",
              items: [
                {
                  text: "Monolith vs. Microservice Mimarisi",
                  link: "/backend/basics/monolith-vs-microservice",
                },
                {
                  text: "İstek/Yanıt Döngüsü",
                  link: "/backend/basics/request-response-model",
                },
                {
                  text: "HTTP, REST, gRPC Protokolleri",
                  link: "/backend/basics/protocols",
                },
                {
                  text: "Temel Veritabanı Kavramları",
                  link: "/backend/basics/database-concepts",
                },
                {
                  text: "Temel Veri Yapıları ve Algoritmalar",
                  link: "/backend/basics/data-structures",
                },
              ],
            },
            {
              text: "2. Performans ve Ölçeklenebilirlik",
              items: [
                {
                  text: "Yük Dengeleme",
                  link: "/backend/performance/load-balancing",
                },
                { text: "Önbellekleme", link: "/backend/performance/caching" },
                {
                  text: "Veritabanı Sharding ve Partitioning",
                  link: "/backend/performance/sharding",
                },
                {
                  text: "Veritabanı Çoğaltma",
                  link: "/backend/performance/replication",
                },
                {
                  text: "Asenkron İşlemler & Mesaj Kuyrukları",
                  link: "/backend/performance/async-processing",
                },
              ],
            },
            {
              text: "3. Dayanıklılık ve Yüksek Erişilebilirlik",
              items: [
                {
                  text: "Yedekleme Mekanizmaları",
                  link: "/backend/reliability/failover",
                },
                {
                  text: "Circuit Breaker ve Bulkhead Desenleri",
                  link: "/backend/reliability/circuit-breaker",
                },
                {
                  text: "Sağlık Kontrolleri & Heartbeat",
                  link: "/backend/reliability/health-checks",
                },
                {
                  text: "Backpressure Kontrolü",
                  link: "/backend/reliability/backpressure",
                },
              ],
            },
            {
              text: "4. Tutarlılık Modelleri",
              items: [
                {
                  text: "Güçlü vs Nihai Tutarlılık",
                  link: "/backend/consistency/strong-vs-eventual",
                },
                {
                  text: "CAP Teoremi",
                  link: "/backend/consistency/cap-theorem",
                },
                {
                  text: "Paxos ve Raft Konsensüs Algoritmaları",
                  link: "/backend/consistency/consensus-algorithms",
                },
                {
                  text: "Diğer Modeller",
                  link: "/backend/consistency/other-consistency-models",
                },
              ],
            },
            {
              text: "5. API Tasarımı ve Gateway'ler",
              items: [
                { text: "API Versiyonlama", link: "/backend/api/api-versioning" },
                {
                  text: "Hız Sınırlama & Kısıtlama",
                  link: "/backend/api/rate-limiting",
                },
                {
                  text: "API Gateway Kullanımı",
                  link: "/backend/api/api-gateway",
                },
                {
                  text: "GraphQL vs REST vs gRPC",
                  link: "/backend/api/api-comparison",
                },
              ],
            },
            {
              text: "6. Mikroservis İletişimi",
              items: [
                {
                  text: "Senkron vs Asenkron İletişim",
                  link: "/backend/microservices/communication",
                },
                {
                  text: "Servis Keşfi",
                  link: "/backend/microservices/service-discovery",
                },
                {
                  text: "Servis Ağı",
                  link: "/backend/microservices/service-mesh",
                },
              ],
            },
            {
              text: "7. Veri İşleme ve Akış",
              items: [
                {
                  text: "Olay Kaynağı",
                  link: "/backend/data-processing/event-sourcing",
                },
                { text: "CQRS", link: "/backend/data-processing/cqrs" },
                {
                  text: "Akış İşleme",
                  link: "/backend/data-processing/stream-processing",
                },
              ],
            },
            {
              text: "8. Gözlemlenebilirlik",
              items: [
                {
                  text: "Günlükleme (ELK Stack)",
                  link: "/backend/observability/logging",
                },
                {
                  text: "Metrikler (Prometheus, Grafana)",
                  link: "/backend/observability/metrics",
                },
                {
                  text: "İzleme (Jaeger, Zipkin)",
                  link: "/backend/observability/tracing",
                },
                {
                  text: "Dağıtık İzleme",
                  link: "/backend/observability/distributed-tracing",
                },
              ],
            },
            {
              text: "9. Güvenlik",
              items: [
                {
                  text: "Kimlik Doğrulama vs Yetkilendirme",
                  link: "/backend/security/auth",
                },
                { text: "TLS/SSL, mTLS", link: "/backend/security/tls" },
                {
                  text: "API Güvenliği",
                  link: "/backend/security/api-security",
                },
                {
                  text: "Gizli Anahtar Yönetimi",
                  link: "/backend/security/secret-management",
                },
              ],
            },
            {
              text: "10. Bulut ve Konteyner Orkestrasyonu",
              items: [
                {
                  text: "Konteynerler (Docker)",
                  link: "/backend/cloud/containers",
                },
                {
                  text: "Kubernetes Temelleri",
                  link: "/backend/cloud/kubernetes",
                },
                { text: "Helm Chart'lar", link: "/backend/cloud/helm" },
                {
                  text: "Sunucusuz ve FaaS",
                  link: "/backend/cloud/serverless",
                },
              ],
            },
            {
              text: "11. Site Güvenilirlik Mühendisliği",
              items: [
                {
                  text: "SLI/SLO/SLA Tanımları",
                  link: "/backend/sre/sli-slo-sla",
                },
                {
                  text: "Olay Yönetimi",
                  link: "/backend/sre/incident-management",
                },
                {
                  text: "Kaos Mühendisliği",
                  link: "/backend/sre/chaos-engineering",
                },
                {
                  text: "Kapasite Planlaması",
                  link: "/backend/sre/capacity-planning",
                },
              ],
            },
            {
              text: "12. Operasyon ve Maliyet Yönetimi",
              items: [
                {
                  text: "Kod Olarak Altyapı",
                  link: "/backend/operations/iac",
                },
                {
                  text: "Maliyet İzleme & Optimizasyon",
                  link: "/backend/operations/cost-optimization",
                },
                {
                  text: "CI/CD İş Akışları",
                  link: "/backend/operations/ci-cd",
                },
              ],
            },
            {
              text: "13. Uç ve Coğrafi Dağıtık Sistemler",
              items: [
                {
                  text: "Çok Bölgeli Dağıtım",
                  link: "/backend/edge/multi-region",
                },
                {
                  text: "Veri Yerelleştirme ve GDPR",
                  link: "/backend/edge/data-localization",
                },
                {
                  text: "Uç Hesaplama",
                  link: "/backend/edge/edge-computing",
                },
              ],
            },
            {
              text: "14. Sürekli İyileştirme",
              items: [
                {
                  text: "Geri Bildirim Döngüleri",
                  link: "/backend/improvement/feedback-loops",
                },
                {
                  text: "Blue/Green ve Canary Dağıtımları",
                  link: "/backend/improvement/deployment-strategies",
                },
                {
                  text: "Retrospektif & Olay Sonrası İnceleme",
                  link: "/backend/improvement/retrospective",
                },
              ],
            },
          ],
          "/mobile/": [
            {
              text: "Giriş",
              items: [{ text: "Mobil Sistem Tasarımı", link: "/mobile/" }],
            },
            {
              text: "1. Uygulama Mimarileri & Durum Yönetimi",
              items: [
                {
                  text: "Mimari Desenler",
                  link: "/mobile/architecture/patterns",
                },
                {
                  text: "Durum Yönetimi Stratejileri",
                  link: "/mobile/architecture/state-management",
                },
                {
                  text: "Bileşen Tabanlı Tasarım",
                  link: "/mobile/architecture/component-based",
                },
                {
                  text: "Bağımlılık Enjeksiyonu ve IoC",
                  link: "/mobile/architecture/dependency-injection",
                },
                {
                  text: "Modüler Mimari Yapıları",
                  link: "/mobile/architecture/modular-architecture",
                },
              ],
            },
            {
              text: "2. Veri Saklama & Senkronizasyon",
              items: [
                {
                  text: "Yerel Veritabanı Seçenekleri",
                  link: "/mobile/storage/local-databases",
                },
                {
                  text: "Veri Senkronizasyon Stratejileri",
                  link: "/mobile/storage/sync-strategies",
                },
                {
                  text: "Çakışma Çözümü",
                  link: "/mobile/storage/conflict-resolution",
                },
                {
                  text: "Çevrimdışı Öncelikli Tasarım",
                  link: "/mobile/storage/offline-first",
                },
                {
                  text: "Veri Taşıma ve Versiyonlama",
                  link: "/mobile/storage/data-migration",
                },
              ],
            },
            {
              text: "3. Önbellekleme & Bellek Yönetimi",
              items: [
                {
                  text: "Bellek İçi Önbellek Yönetimi",
                  link: "/mobile/performance/memory-cache",
                },
                {
                  text: "Disk Önbellek Stratejileri",
                  link: "/mobile/performance/disk-cache",
                },
                {
                  text: "Önbellek Geçersizleştirme Teknikleri",
                  link: "/mobile/performance/cache-invalidation",
                },
                {
                  text: "Nesne Yaşam Döngüsü Yönetimi",
                  link: "/mobile/performance/object-lifecycle",
                },
              ],
            },
            {
              text: "4. Ağ Katmanları & Veri Transferi",
              items: [
                {
                  text: "İstek Birleştirme & Debouncing",
                  link: "/mobile/networking/batching-debouncing",
                },
                {
                  text: "Sayfalama & Sonsuz Kaydırma",
                  link: "/mobile/networking/pagination",
                },
                {
                  text: "Veri Sıkıştırma Teknikleri",
                  link: "/mobile/networking/compression",
                },
                {
                  text: "Ağ Dayanıklılığı & Yeniden Deneme",
                  link: "/mobile/networking/resilience",
                },
                {
                  text: "Mobil Ağ Güvenliği",
                  link: "/mobile/networking/security",
                },
                {
                  text: "Ağ İzleme & Analitik",
                  link: "/mobile/networking/monitoring",
                },
                {
                  text: "Test & QA Stratejileri",
                  link: "/mobile/networking/testing-qa",
                },
                {
                  text: "Gelişmiş Ağ Desenleri",
                  link: "/mobile/networking/advanced-patterns",
                },
                {
                  text: "Mobil-Spesifik Hususlar",
                  link: "/mobile/networking/mobile-considerations",
                },
                {
                  text: "Gelecek Trendleri & Yeni Teknolojiler",
                  link: "/mobile/networking/future-trends",
                },
              ],
            },
            {
              text: "5. UI/UX Performans Optimizasyonu",
              items: [
                {
                  text: "Render Optimizasyonu",
                  link: "/mobile/ui-performance/rendering",
                },
                {
                  text: "Düzen Performansı",
                  link: "/mobile/ui-performance/layout",
                },
                {
                  text: "Liste ve Kaydırma Performansı",
                  link: "/mobile/ui-performance/list-performance",
                },
                {
                  text: "60 FPS Garantisi",
                  link: "/mobile/ui-performance/fps-optimization",
                },
                {
                  text: "Bellek Verimli UI",
                  link: "/mobile/ui-performance/memory-efficient",
                },
              ],
            },
            {
              text: "6. Animasyon & Grafik İşleme",
              items: [
                {
                  text: "Bildirimsel Animasyonlar",
                  link: "/mobile/graphics/declarative-animations",
                },
                {
                  text: "Kare Hızı Yönetimi",
                  link: "/mobile/graphics/frame-rate-management",
                },
                {
                  text: "Donanım Hızlandırma",
                  link: "/mobile/graphics/hardware-acceleration",
                },
                {
                  text: "Canvas & Metal/Native UI",
                  link: "/mobile/graphics/canvas-metal-native",
                },
              ],
            },
            {
              text: "7. Güvenlik & Yetki Kontrolleri",
              items: [
                {
                  text: "Kimlik Doğrulama Desenleri",
                  link: "/mobile/security/authentication",
                },
                {
                  text: "Güvenli Depolama",
                  link: "/mobile/security/secure-storage",
                },
                {
                  text: "API Güvenliği",
                  link: "/mobile/security/api-security",
                },
                {
                  text: "Biyometrik Kimlik Doğrulama",
                  link: "/mobile/security/biometric-auth",
                },
                {
                  text: "Sertifika Sabitleme",
                  link: "/mobile/security/certificate-pinning",
                },
              ],
            },
            {
              text: "8. Arka Plan İşlemleri",
              items: [
                {
                  text: "Arkaplan Görev Yönetimi",
                  link: "/mobile/background/task-management",
                },
                {
                  text: "Push Notification Mimarisi",
                  link: "/mobile/background/push-notifications",
                },
                {
                  text: "Gerçek Zamanlı İletişim",
                  link: "/mobile/background/real-time",
                },
                {
                  text: "Konum Servisleri",
                  link: "/mobile/background/location-services",
                },
                {
                  text: "Batarya Optimizasyonu",
                  link: "/mobile/background/battery-optimization",
                },
              ],
            },
            {
              text: "9. Telemetri & Gözlemlenebilirlik",
              items: [
                {
                  text: "Çökme Raporlama Sistemleri",
                  link: "/mobile/observability/crash-reporting",
                },
                {
                  text: "Performans Analitikleri",
                  link: "/mobile/observability/performance-analytics",
                },
                {
                  text: "Kullanıcı Davranışı İzleme",
                  link: "/mobile/observability/user-tracking",
                },
                {
                  text: "Uzaktan Yapılandırma",
                  link: "/mobile/observability/remote-config",
                },
                {
                  text: "A/B Test Altyapısı",
                  link: "/mobile/observability/ab-testing",
                },
              ],
            },
            {
              text: "10. Sürüm Yönetimi & Güncellemeler",
              items: [
                {
                  text: "Sürüm Yönetimi",
                  link: "/mobile/versioning/release-management",
                },
                {
                  text: "Özellik Bayrakları",
                  link: "/mobile/versioning/feature-flags",
                },
                {
                  text: "Sıcak Güncellemeler & Kod Push",
                  link: "/mobile/versioning/hot-updates",
                },
                {
                  text: "Geriye Dönük Uyumluluk",
                  link: "/mobile/versioning/backward-compatibility",
                },
                {
                  text: "Dağıtım Stratejileri",
                  link: "/mobile/versioning/deployment-strategies",
                },
              ],
            },
            {
              text: "11. Çapraz Platform Geliştirme",
              items: [
                {
                  text: "Çapraz Platform Geliştirme Rehberi",
                  link: "/mobile/cross-platform-development-guide",
                },
                {
                  text: "Framework Karşılaştırması",
                  link: "/mobile/cross-platform-development#framework-karşılaştırması",
                },
                {
                  text: "React Native Uygulaması",
                  link: "/mobile/cross-platform-development#react-native-uygulaması",
                },
                {
                  text: "Flutter Uygulaması",
                  link: "/mobile/cross-platform-development#flutter-uygulaması",
                },
                {
                  text: "Xamarin Uygulaması",
                  link: "/mobile/cross-platform-development#xamarin-uygulaması",
                },
              ],
            },
            {
              text: "12. Performans Testi ve Karşılaştırma",
              items: [
                {
                  text: "Performans Testi Rehberi",
                  link: "/mobile/performance-testing",
                },
                {
                  text: "Platforma Özel Test Araçları",
                  link: "/mobile/performance-testing#platforma-ozel-test-araclar%C4%B1",
                },
                {
                  text: "Otomatik Performans Testleri",
                  link: "/mobile/performance-testing#otomatik-performans-testleri",
                },
                {
                  text: "Canlı Performans İzleme",
                  link: "/mobile/performance-testing#canlı-performans-izleme",
                },
              ],
            }
          ],
        },
        footer: {
          message: "Eren Demir tarafından oluşturulmuştur.",
          copyright: "Telif Hakkı © " + new Date().getFullYear(),
        },
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      title: "System Design",
      description: "Comprehensive System Design Documentation",
      themeConfig: {
        nav: [
          { text: "Home", link: "/en/" },
          { text: "Backend", link: "/en/backend/" },
          { text: "Mobile", link: "/en/mobile/" },
        ],
        sidebar: {
          "/en/backend/": [
            {
              text: "Introduction",
              items: [{ text: "Backend System Design", link: "/en/backend/" }],
            },
            {
              text: "1. Basic Concepts",
              items: [
                {
                  text: "Monolith vs. Microservice Architecture",
                  link: "/en/backend/basics/monolith-vs-microservice",
                },
                {
                  text: "Request-Response Model",
                  link: "/en/backend/basics/request-response-model",
                },
                {
                  text: "HTTP, REST, gRPC Protocols",
                  link: "/en/backend/basics/protocols",
                },
                {
                  text: "Basic Database Concepts",
                  link: "/en/backend/basics/database-concepts",
                },
                {
                  text: "Basic Data Structures and Algorithms",
                  link: "/en/backend/basics/data-structures",
                },
              ],
            },
            {
              text: "2. Performance and Scalability",
              items: [
                {
                  text: "Load Balancing",
                  link: "/en/backend/performance/load-balancing",
                },
                { text: "Caching", link: "/en/backend/performance/caching" },
                {
                  text: "Database Sharding and Partitioning",
                  link: "/en/backend/performance/sharding",
                },
                {
                  text: "Database Replication",
                  link: "/en/backend/performance/replication",
                },
                {
                  text: "Asynchronous Processing & Message Queues",
                  link: "/en/backend/performance/async-processing",
                },
              ],
            },
            {
              text: "3. Reliability & High Availability",
              items: [
                {
                  text: "Failover Mechanisms",
                  link: "/en/backend/reliability/failover",
                },
                {
                  text: "Circuit Breaker and Bulkhead Pattern",
                  link: "/en/backend/reliability/circuit-breaker",
                },
                {
                  text: "Health Checks & Heartbeats",
                  link: "/en/backend/reliability/health-checks",
                },
                {
                  text: "Backpressure Control",
                  link: "/en/backend/reliability/backpressure",
                },
              ],
            },
            {
              text: "4. Consistency Models",
              items: [
                {
                  text: "Strong vs Eventual Consistency",
                  link: "/en/backend/consistency/strong-vs-eventual",
                },
                {
                  text: "CAP Theorem",
                  link: "/en/backend/consistency/cap-theorem",
                },
                {
                  text: "Paxos and Raft Consensus Algorithms",
                  link: "/en/backend/consistency/consensus-algorithms",
                },
                {
                  text: "Other Models",
                  link: "/en/backend/consistency/other-consistency-models",
                },
              ],
            },
            {
              text: "5. API Design and Gateways",
              items: [
                {
                  text: "API Versioning",
                  link: "/en/backend/api/api-versioning",
                },
                {
                  text: "Rate Limiting & Throttling",
                  link: "/en/backend/api/rate-limiting",
                },
                {
                  text: "API Gateway Usage",
                  link: "/en/backend/api/api-gateway",
                },
                {
                  text: "GraphQL vs REST vs gRPC",
                  link: "/en/backend/api/api-comparison",
                },
              ],
            },
            {
              text: "6. Microservice Communication",
              items: [
                {
                  text: "Synchronous vs Asynchronous Communication",
                  link: "/en/backend/microservices/communication",
                },
                {
                  text: "Service Discovery",
                  link: "/en/backend/microservices/service-discovery",
                },
                {
                  text: "Service Mesh",
                  link: "/en/backend/microservices/service-mesh",
                },
              ],
            },
            {
              text: "7. Data Processing and Streaming",
              items: [
                {
                  text: "Event Sourcing",
                  link: "/en/backend/data-processing/event-sourcing",
                },
                { text: "CQRS", link: "/en/backend/data-processing/cqrs" },
                {
                  text: "Stream Processing",
                  link: "/en/backend/data-processing/stream-processing",
                },
              ],
            },
            {
              text: "8. Observability",
              items: [
                {
                  text: "Logging (ELK Stack)",
                  link: "/en/backend/observability/logging",
                },
                {
                  text: "Metrics (Prometheus, Grafana)",
                  link: "/en/backend/observability/metrics",
                },
                {
                  text: "Tracing (Jaeger, Zipkin)",
                  link: "/en/backend/observability/tracing",
                },
                {
                  text: "Distributed Tracing",
                  link: "/en/backend/observability/distributed-tracing",
                },
              ],
            },
            {
              text: "9. Security",
              items: [
                {
                  text: "Authentication vs Authorization",
                  link: "/en/backend/security/auth",
                },
                { text: "TLS/SSL, mTLS", link: "/en/backend/security/tls" },
                {
                  text: "API Security",
                  link: "/en/backend/security/api-security",
                },
                {
                  text: "Secret Management",
                  link: "/en/backend/security/secret-management",
                },
              ],
            },
            {
              text: "10. Cloud and Container Orchestration",
              items: [
                {
                  text: "Containers (Docker)",
                  link: "/en/backend/cloud/containers",
                },
                {
                  text: "Kubernetes Basics",
                  link: "/en/backend/cloud/kubernetes",
                },
                { text: "Helm Charts", link: "/en/backend/cloud/helm" },
                {
                  text: "Serverless and FaaS",
                  link: "/en/backend/cloud/serverless",
                },
              ],
            },
            {
              text: "11. Site Reliability Engineering",
              items: [
                {
                  text: "SLI/SLO/SLA Definitions",
                  link: "/en/backend/sre/sli-slo-sla",
                },
                {
                  text: "Incident Management",
                  link: "/en/backend/sre/incident-management",
                },
                {
                  text: "Chaos Engineering",
                  link: "/en/backend/sre/chaos-engineering",
                },
                {
                  text: "Capacity Planning",
                  link: "/en/backend/sre/capacity-planning",
                },
              ],
            },
            {
              text: "12. Operations and Cost Management",
              items: [
                {
                  text: "Infrastructure as Code",
                  link: "/en/backend/operations/iac",
                },
                {
                  text: "Cost Monitoring & Optimization",
                  link: "/en/backend/operations/cost-optimization",
                },
                {
                  text: "CI/CD Workflows",
                  link: "/en/backend/operations/ci-cd",
                },
              ],
            },
            {
              text: "13. Edge and Geographically Distributed Systems",
              items: [
                {
                  text: "Multi-Region Deployment",
                  link: "/en/backend/edge/multi-region",
                },
                {
                  text: "Data Localization and GDPR",
                  link: "/en/backend/edge/data-localization",
                },
                {
                  text: "Edge Computing",
                  link: "/en/backend/edge/edge-computing",
                },
              ],
            },
            {
              text: "14. Continuous Improvement",
              items: [
                {
                  text: "Feedback Loops",
                  link: "/en/backend/improvement/feedback-loops",
                },
                {
                  text: "Blue/Green and Canary Deployments",
                  link: "/en/backend/improvement/deployment-strategies",
                },
                {
                  text: "Retrospective & Post-Mortem",
                  link: "/en/backend/improvement/retrospective",
                },
              ],
            },
          ],
          "/en/mobile/": [
            {
              text: "Introduction",
              items: [{ text: "Mobile System Design", link: "/en/mobile/" }],
            },
            {
              text: "1. Application Architectures & State Management",
              items: [
                {
                  text: "Architectural Patterns",
                  link: "/en/mobile/architecture/patterns",
                },
                {
                  text: "State Management Strategies",
                  link: "/en/mobile/architecture/state-management",
                },
                {
                  text: "Component-Based Design",
                  link: "/en/mobile/architecture/component-based",
                },
                {
                  text: "Dependency Injection and IoC",
                  link: "/en/mobile/architecture/dependency-injection",
                },
                {
                  text: "Modular Architecture Structures",
                  link: "/en/mobile/architecture/modular-architecture",
                },
              ],
            },
            {
              text: "2. Data Storage & Synchronization",
              items: [
                {
                  text: "Local Database Options",
                  link: "/en/mobile/storage/local-databases",
                },
                {
                  text: "Data Synchronization Strategies",
                  link: "/en/mobile/storage/sync-strategies",
                },
                {
                  text: "Conflict Resolution",
                  link: "/en/mobile/storage/conflict-resolution",
                },
                {
                  text: "Offline-First Design",
                  link: "/en/mobile/storage/offline-first",
                },
                {
                  text: "Data Migration and Versioning",
                  link: "/en/mobile/storage/data-migration",
                },
              ],
            },
            {
              text: "3. Caching & Memory Management",
              items: [
                {
                  text: "In-Memory Cache Management",
                  link: "/en/mobile/performance/memory-cache",
                },
                {
                  text: "Disk Cache Strategies",
                  link: "/en/mobile/performance/disk-cache",
                },
                {
                  text: "Cache Invalidation Techniques",
                  link: "/en/mobile/performance/cache-invalidation",
                },
                {
                  text: "Object Lifecycle Management",
                  link: "/en/mobile/performance/object-lifecycle",
                },
              ],
            },
            {
              text: "4. Network Layers & Data Transfer",
              items: [
                {
                  text: "Request Batching & Debouncing",
                  link: "/en/mobile/networking/batching-debouncing",
                },
                {
                  text: "Pagination & Infinite Scroll",
                  link: "/en/mobile/networking/pagination",
                },
                {
                  text: "Data Compression Techniques",
                  link: "/en/mobile/networking/compression",
                },
                {
                  text: "Network Resilience & Retry Patterns",
                  link: "/en/mobile/networking/resilience",
                },
                {
                  text: "Mobile Network Security",
                  link: "/en/mobile/networking/security",
                },
                {
                  text: "Network Monitoring & Analytics",
                  link: "/en/mobile/networking/monitoring",
                },
                {
                  text: "Testing & QA Strategies",
                  link: "/en/mobile/networking/testing-qa",
                },
                {
                  text: "Advanced Networking Patterns",
                  link: "/en/mobile/networking/advanced-patterns",
                },
                {
                  text: "Mobile-Specific Considerations",
                  link: "/en/mobile/networking/mobile-considerations",
                },
                {
                  text: "Future Trends & Emerging Technologies",
                  link: "/en/mobile/networking/future-trends",
                },
              ],
            },
            {
              text: "5. UI/UX Performance Optimization",
              items: [
                {
                  text: "Rendering Optimization",
                  link: "/en/mobile/ui-performance/rendering",
                },
                {
                  text: "Layout Performance",
                  link: "/en/mobile/ui-performance/layout",
                },
                {
                  text: "List and Scroll Performance",
                  link: "/en/mobile/ui-performance/list-performance",
                },
                {
                  text: "FPS Optimization",
                  link: "/en/mobile/ui-performance/fps-optimization",
                },
                {
                  text: "Memory Efficient UI",
                  link: "/en/mobile/ui-performance/memory-efficient",
                },
              ],
            },
            {
              text: "6. Animation & Graphics Processing",
              items: [
                {
                  text: "Declarative Animations",
                  link: "/en/mobile/graphics/declarative-animations",
                },
                {
                  text: "Frame Rate Management",
                  link: "/en/mobile/graphics/frame-rate-management",
                },
                {
                  text: "Hardware Acceleration",
                  link: "/en/mobile/graphics/hardware-acceleration",
                },
                {
                  text: "Canvas & Metal/Native UI",
                  link: "/en/mobile/graphics/canvas-metal-native",
                },
              ],
            },
            {
              text: "7. Security & Access Control",
              items: [
                {
                  text: "Authentication Patterns",
                  link: "/en/mobile/security/authentication",
                },
                {
                  text: "Secure Storage",
                  link: "/en/mobile/security/secure-storage",
                },
                {
                  text: "API Security",
                  link: "/en/mobile/security/api-security",
                },
                {
                  text: "Biometric Authentication",
                  link: "/en/mobile/security/biometric-auth",
                },
                {
                  text: "Certificate Pinning",
                  link: "/en/mobile/security/certificate-pinning",
                },
              ],
            },
            {
              text: "8. Background Processing",
              items: [
                {
                  text: "Background Task Management",
                  link: "/en/mobile/background/task-management",
                },
                {
                  text: "Push Notification Architecture",
                  link: "/en/mobile/background/push-notifications",
                },
                {
                  text: "Real-time Communication",
                  link: "/en/mobile/background/real-time",
                },
                {
                  text: "Location Services",
                  link: "/en/mobile/background/location-services",
                },
                {
                  text: "Battery Optimization",
                  link: "/en/mobile/background/battery-optimization",
                },
              ],
            },
            {
              text: "9. Telemetry & Observability",
              items: [
                {
                  text: "Crash Reporting Systems",
                  link: "/en/mobile/observability/crash-reporting",
                },
                {
                  text: "Performance Analytics",
                  link: "/en/mobile/observability/performance-analytics",
                },
                {
                  text: "User Behavior Tracking",
                  link: "/en/mobile/observability/user-tracking",
                },
                {
                  text: "Remote Configuration",
                  link: "/en/mobile/observability/remote-config",
                },
                {
                  text: "A/B Testing Infrastructure",
                  link: "/en/mobile/observability/ab-testing",
                },
              ],
            },
            {
              text: "10. Version Management & Updates",
              items: [
                {
                  text: "Release Management",
                  link: "/en/mobile/versioning/release-management",
                },
                {
                  text: "Feature Flags",
                  link: "/en/mobile/versioning/feature-flags",
                },
                {
                  text: "Hot Updates & Code Push",
                  link: "/en/mobile/versioning/hot-updates",
                },
                {
                  text: "Backward Compatibility",
                  link: "/en/mobile/versioning/backward-compatibility",
                },
                {
                  text: "Deployment Strategies",
                  link: "/en/mobile/versioning/deployment-strategies",
                },
              ],
            },
            {
              text: "11. Cross-Platform Development",
              items: [
                {
                  text: "Cross-Platform Development Guide",
                  link: "/en/mobile/cross-platform-development",
                },
                {
                  text: "Framework Comparison",
                  link: "/en/mobile/cross-platform-development#framework-comparison-matrix",
                },
                {
                  text: "React Native Implementation",
                  link: "/en/mobile/cross-platform-development#react-native-implementation",
                },
                {
                  text: "Flutter Implementation",
                  link: "/en/mobile/cross-platform-development#flutter-implementation",
                },
                {
                  text: "Xamarin Implementation",
                  link: "/en/mobile/cross-platform-development#xamarin-implementation",
                },
              ],
            },
            {
              text: "12. Performance Testing & Benchmarking",
              items: [
                {
                  text: "Performance Testing Guide",
                  link: "/en/mobile/performance-testing",
                },
                {
                  text: "Platform-Specific Testing Tools",
                  link: "/en/mobile/performance-testing#platform-specific-testing-tools",
                },
                {
                  text: "Automated Performance Testing",
                  link: "/en/mobile/performance-testing#automated-performance-testing-pipeline",
                },
                {
                  text: "Production Monitoring",
                  link: "/en/mobile/performance-testing#production-performance-monitoring",
                },
              ],
            },
          ],
        },
        footer: {
          message: "Created by Eren Demir.",
          copyright: "Copyright © " + new Date().getFullYear(),
        },
      },
    },
  },

  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/endmr11/",
      },
      {
        icon: "linkedin",
        link: "https://www.linkedin.com/in/endmr11/",
      },
      {
        icon: "youtube",
        link: "https://www.youtube.com/@erendemirr",
      },
    ],

    search: {
      provider: "local",
    },
  },
})) 