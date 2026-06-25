# Mobil Performans Testi ve Benchmarking

Bu sayfa geriye dönük uyumluluk ve hızlı yönlendirme için tutulur. Kapsamlı Türkçe içerik [Mobil Performans Karşılaştırma & Test Rehberi](./performance-testing.md) sayfasındadır.

## Ne Zaman Bu Konuya Bakılır?

- Cold start, warm start veya hot start hedefleri belirlenecekse
- Scroll jank, dropped frame veya input latency ölçülecekse
- Bellek, CPU, batarya ve ağ kullanımı release öncesi karşılaştırılacaksa
- Android ve iOS performans sonuçları aynı ürün hedefleriyle raporlanacaksa

## Minimum Benchmark Seti

| Alan | Başlangıç hedefi | Araç |
| --- | --- | --- |
| Cold start | 2 saniye altı | Android Macrobenchmark, XCTest launch metrics |
| Scroll | 60 FPS hedefi | JankStats, Instruments, Flutter DevTools |
| Bellek | Cihaz sınıfına göre limitli | Android Studio Profiler, Xcode Memory Graph |
| API p95 | Ürün SLA değerinin altında | Network telemetry |
| Batarya | Kritik akışta ölçülebilir düşük etki | Energy profiler, MetricKit |

## Güncel İçerik

- [Mobil Performans Karşılaştırma & Test Rehberi](./performance-testing.md)
- [Liste ve Kaydırma Performansı](./ui-performance/list-performance.md)
- [Performans Analitiği](./observability/performance-analytics.md)
