# Kullanıcı Davranış Takibi

Mobil uygulamalarda kullanıcı davranışlarının izlenmesi ve analizi, kullanıcı deneyimini iyileştirmek ve uygulama performansını optimize etmek için kritik öneme sahiptir.

## Hızlı Karar

| İhtiyaç | Takip Et | Dikkat |
| --- | --- | --- |
| Funnel analizi | Screen/action event | Event isimleri stabil olmalı |
| Retention | Session ve cohort | Consent gerekli olabilir |
| UX sorunları | Drop-off ve rage tap | PII kaydetme |
| Debug | Correlation id | Kullanıcı kimliğiyle karıştırma |

## Üretim Kontrol Listesi

- Problem: Hangi ürün kararını davranış verisiyle vereceğiz?
- Çözüm: Event taxonomy, consent, sampling, retention ve owner net mi?
- Trade-off: Davranış verisi ürün içgörüsü sağlar; gizlilik ve maliyet sorumluluğu getirir.
- Hata durumu: Event drift, duplicate event, PII leak ve metric mismatch ele alınmalı.
- Ölçüm: Event volume, missing event rate, funnel conversion, retention ve opt-out oranı izlenmeli.
- Güvenlik/maliyet: Minimum veri topla; kullanıcı davranışı verisi hassas kabul edilmelidir.

## Önemli Metrikler

- **Kullanıcı Etkileşimleri**
  - Ekran görüntüleme süreleri
  - Buton tıklamaları
  - Kaydırma davranışları
  - Form doldurma süreleri

- **Performans Metrikleri**
  - Sayfa yüklenme süreleri
  - API yanıt süreleri
  - Uygulama çökme oranları
  - Bellek kullanımı

## İzleme Araçları

- Firebase Analytics
- Google Analytics
- Custom Event Tracking
- Heat Maps
- Session Recording

## Veri Toplama Prensipleri

1. Kullanıcı gizliliğine saygı
2. GDPR ve KVKK uyumluluğu
3. Minimum gerekli veri toplama
4. Şeffaf veri kullanım politikaları

## Analiz ve Raporlama

- Kullanıcı segmentasyonu
- Davranış akışları
- Dönüşüm oranları
- Kullanıcı memnuniyeti metrikleri
