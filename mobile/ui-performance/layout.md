# Düzen Performansı

Layout performansı, UI'ın ölçüm ve yerleşim işini frame budget içinde bitirebilmesidir. Sorun çoğu zaman tek bir büyük view değil, sık tekrarlanan küçük layout hesaplarıdır.

## Hızlı Karar

| Durum | Yaklaşım | Dikkat |
| --- | --- | --- |
| Nested layout fazla | Flatten layout | Okunabilirliği tamamen bozma |
| Liste item yavaş | Sabit/öngörülebilir ölçü | Dynamic height maliyetlidir |
| Responsive ekran | Constraint dikkatli kullan | Constraint zinciri büyümesin |
| Sık state değişimi | Recomposition/layout scope daralt | Tüm ekran yenilenmesin |

## Üretim Kontrol Listesi

- Problem: Layout hangi ekranda kaç ms sürüyor?
- Çözüm: View hierarchy, constraint count, invalidation scope ve placeholder boyutları net mi?
- Trade-off: Esnek layout bakım kolaylığı sağlar; ölçüm maliyetini artırabilir.
- Hata durumu: Layout thrashing, text overflow, infinite constraints ve orientation bug ele alınmalı.
- Ölçüm: Layout time, measure count, re-layout frequency, frame time ve jank rate izlenmeli.
- Güvenlik/maliyet: Dynamic font/accessibility boyutları desteklenmeli; layout test matrisi cihaz maliyeti getirir.

## Düzen Optimizasyonu Temelleri

### Düzen Sürecini Anlama
- **Ölçüm Aşaması**: View boyutlarının hesaplanması
- **Düzen Aşaması**: View pozisyonlarının belirlenmesi  
- **Çizim Aşaması**: Canvas'a çizim işlemi

### Android Düzen Optimizasyonu

#### ConstraintLayout En İyi Uygulamaları
```kotlin
// Optimize Edilmiş ConstraintLayout Örneği
class OptimizedConstraintLayout : ConstraintLayout {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        // Performans için özel ölçüm mantığı
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }
}
```

#### View Hiyerarşisini Düzleştirme
```kotlin
// İç içe LinearLayout'ları düzleştirme
fun flattenLinearLayouts(parent: ViewGroup) {
    for (i in 0 until parent.childCount) {
        val child = parent.getChildAt(i)
        if (child is LinearLayout && child.childCount == 1) {
            // Düzleştirmeyi düşün
        }
    }
}
```

### iOS Auto Layout Optimizasyonu

#### Kısıtlama Önceliği Yönetimi
```swift
// iOS Auto Layout Optimizasyonu
class OptimizedAutoLayoutView: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        // Özel düzen optimizasyonu
    }
    
    func optimizeConstraints() {
        // Kısıtlama karmaşıklığını azalt
        constraints.forEach { constraint in
            if constraint.priority.rawValue < 1000 {
                constraint.priority = UILayoutPriority(999)
            }
        }
    }
}
```

### Flutter Düzen Performansı

#### Verimli Widget Kompozisyonu
```dart
// Flutter Düzen Optimizasyonu
class OptimizedLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Mümkün olduğunda const yapıcıları kullan
        const Text('Statik Metin'),
        // Widget yeniden oluşturmalarını minimize et
        RepaintBoundary(
          child: CustomPainter(
            painter: OptimizedPainter(),
          ),
        ),
      ],
    );
  }
}
```

## Performans İzleme

### Düzen Performans Metrikleri
```kotlin
// Android Düzen Performans İzleme
class LayoutPerformanceMonitor {
    fun measureLayoutTime(view: View): Long {
        val startTime = System.nanoTime()
        view.measure(
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        )
        return System.nanoTime() - startTime
    }
}
```
