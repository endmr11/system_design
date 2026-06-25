# Çok Seviyeli Caching

Bu sayfa `en/mobile/caching/multi-level.md` karşılığı olarak tutulur. Türkçe canonical içerik memory cache, disk cache ve cache invalidation sayfalarının birlikte okunmasıyla tamamlanır.

## Ne Zaman Bu Konuya Bakılır?

- Veri önce memory, sonra disk, sonra network sırasıyla okunuyorsa
- Cache hit oranı, stale data ve sync davranışı birlikte tasarlanıyorsa
- Offline-first akışta local database ve cache rolleri karışıyorsa

## Güncel İçerik

- [In-Memory Cache](../performance/memory-cache.md)
- [Disk Önbelleği ve HTTP Önbellekleme](../performance/disk-cache.md)
- [Önbellek Geçersizleştirme Stratejileri](../performance/cache-invalidation.md)
- [Offline-First Tasarım](../storage/offline-first.md)
