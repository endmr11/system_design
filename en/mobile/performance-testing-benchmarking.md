# Mobile Performance Testing and Benchmarking

This page is kept for backward compatibility and quick routing. The comprehensive English content lives in [Mobile Performance Benchmarking & Testing Guide](./performance-testing.md).

## When To Use This Topic

- Defining cold start, warm start, or hot start targets
- Measuring scroll jank, dropped frames, or input latency
- Comparing memory, CPU, battery, and network usage before release
- Reporting Android and iOS performance against the same product goals

## Minimum Benchmark Set

| Area | Starting target | Tool |
| --- | --- | --- |
| Cold start | Under 2 seconds | Android Macrobenchmark, XCTest launch metrics |
| Scroll | 60 FPS target | JankStats, Instruments, Flutter DevTools |
| Memory | Bounded by device class | Android Studio Profiler, Xcode Memory Graph |
| API p95 | Under product SLA | Network telemetry |
| Battery | Measurably low impact in critical flows | Energy profiler, MetricKit |

## Current Content

- [Mobile Performance Benchmarking & Testing Guide](./performance-testing.md)
- [List Performance and Infinite Scroll Optimization](./ui-performance/list-performance.md)
- [Performance Analytics](./observability/performance-analytics.md)
