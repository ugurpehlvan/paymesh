# PayMesh — Proje Planı

Amazon + Banka sistemi karışımı. Senior backend kavramlarını gerçek bir sistemde öğrenmek için tasarlandı.

---

## Hedef Kavramlar

| Kategori | Konu |
|---|---|
| Domain | Wallet, Ledger (double-entry), Payment, Order, Inventory |
| API Design | REST conventions, Pagination, Filtering, Sorting, Versioning |
| Database | Normalization, Indexes, Constraints, Migration, Partitioning |
| Security | JWT rotation, Password hashing, CORS, SQL injection, OWASP Top 10 |
| Reliability | Idempotency, Optimistic Locking, Circuit Breaker, Retry |
| Patterns | Saga (Choreography + Orchestration), Outbox + Polling Publisher, CQRS (opsiyonel) |
| Messaging | Apache Kafka (event stream), RabbitMQ (task queue), At-least-once, Exactly-once |
| Cache | Redis — Cache Aside, Write Through, TTL, Invalidation |
| Observability | OpenTelemetry, Jaeger, Prometheus (RED/USE), Grafana, Loki (structured logs) |
| Distributed | CAP theorem, Eventual consistency, Clock skew, Split brain |
| Testing | Unit (Jest), Integration (Testcontainers), E2E, Load (k6) |
| DevOps | Docker, Kubernetes, Blue-Green, Canary, GitHub Actions CI/CD |

---

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Backend | Node.js + TypeScript |
| Frontend | React + TypeScript (minimal UI) |
| Ana Veritabanı | PostgreSQL |
| Cache / Idempotency | Redis |
| Event Streaming | Apache Kafka |
| Task Queue | RabbitMQ |
| Tracing | OpenTelemetry + Jaeger |
| Metrics | Prometheus + Grafana |
| Logging | Loki + Grafana |
| Container | Docker + Kubernetes |

---

## Servisler

```
api-gateway          → Auth (JWT), rate limit, routing, tracing başlangıcı
user-service         → Kayıt, login, JWT + refresh token
wallet-service       → Bakiye, double-entry ledger, optimistic locking
payment-service      → Ödeme simülasyonu, idempotency, outbox pattern
order-service        → Saga orchestrator, sipariş lifecycle yönetimi
inventory-service    → Stok rezerve/serbest bırak (compensating transaction)
notification-service → RabbitMQ consumer, email/push simülasyonu
```

---

## Mimari Özeti

```
Client
  └── API Gateway (JWT doğrula, route et)
        ├── user-service
        ├── wallet-service
        ├── order-service (Saga Orchestrator) ──── Kafka ──── inventory-service
        └── payment-service
              └── outbox → polling publisher → Kafka
                                                    └── notification-service (RabbitMQ)
```

**Saga akışı (Order → Payment):**
```
1. Kullanıcı sipariş verir         → order-service
2. order-service orchestrate eder:
   a. inventory-service → stok rezerve et
   b. payment-service   → ödemeyi işle (idempotency key ile)
   c. wallet-service    → bakiye düş (ledger kaydı, optimistic lock)
3. Hepsi başarılı:
   → order.completed event → Kafka (key: user_id)
   → RabbitMQ → notification-service → kullanıcıya bildirim

Başarısız olursa (compensating transaction):
   c. wallet.deduct başarısız → geri al
   b. payment.failed → rollback
   a. inventory.release → stok geri bırak
   → order.failed event → Kafka
```

**Outbox Pattern (tam akış):**
```
DB Transaction içinde:
  1. Ana kayıt yaz (order, payment vb.)
  2. outbox tablosuna event yaz

Ayrı process (Polling Publisher):
  3. outbox tablosunu periyodik tara
  4. İşlenmemiş eventleri Kafka'ya publish et
  5. Başarılı olanları "published" olarak işaretle
```

**Standart Error Response:**
```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Yetersiz bakiye",
  "requestId": "x-request-id değeri",
  "timestamp": "2026-05-05T10:00:00Z"
}
```
`code` → machine-readable, sabittir (frontend buna göre branch açar)
`requestId` → log'larda arama için, support süreçlerinde kritik
`trace_id` → ayrıca OpenTelemetry header'da taşınır (Jaeger için)

**Standart Log Formatı:**
```json
{
  "level": "info",
  "timestamp": "2026-05-05T10:00:00Z",
  "service": "wallet-service",
  "requestId": "x-request-id değeri",
  "userId": "uuid",
  "method": "POST",
  "url": "/api/v1/wallets/deduct",
  "latency": 42,
  "status": 200,
  "errorCode": null
}
```
Her servis bu formatta log üretir → Loki'de tek standart, Grafana'da aranabilir.

**Kafka Partition Stratejisi:**
```
key = user_id → aynı kullanıcının eventleri aynı partition'a gider
             → ordering guarantee per user
```

---

## Locking Stratejisi (Wallet)

```
Öncelik sırası (basit → karmaşık):

1. Atomic DB operation
   UPDATE wallets SET balance = balance - 100
   WHERE id = $1 AND balance >= 100

2. Optimistic locking (version column)
   UPDATE wallets SET balance = $1, version = version + 1
   WHERE id = $2 AND version = $3
   → conflict olursa retry

3. SELECT FOR UPDATE (pessimistic, tek servis içi)

4. Redis distributed lock (cross-service gerektiğinde, son çare)
```

---

## Aşamalar

### Phase 0A — Minimal Başlangıç (Önce Çalışan Sistem)
- [ ] Monorepo klasör yapısı oluştur
- [ ] Docker Compose: **sadece PostgreSQL + Redis**
- [ ] Shared kütüphane: logger, error types, standart error response
- [ ] **Log standardı**: requestId, userId, service, method, url, latency, status, errorCode alanları — baştan sabitle
- [ ] **Config yönetimi**: typed config, .env validation (zod), dev/staging/prod ayrımı
- [ ] Correlation ID middleware (x-request-id, tüm servislerde taşınır)
- [ ] API versioning: tüm endpoint'ler `/api/v1/` prefix ile
- [ ] 3 servis boilerplate: api-gateway, user-service, wallet-service
- [ ] Her servis ayağa kalkar ve birbirine ulaşır

### Phase 0B — Altyapı Genişlet
- [ ] Docker Compose'a Kafka + RabbitMQ ekle
- [ ] Docker Compose'a Jaeger + Prometheus + Grafana + Loki ekle
- [ ] Shared tracing kütüphanesi (OpenTelemetry)
- [ ] Kalan servis boilerplate'leri: payment, order, inventory, notification

### Phase 1 — Auth & User
- [ ] user-service: kayıt, login endpoint
- [ ] JWT access token + refresh token
- [ ] **Refresh Token Rotation**: her refresh'te yeni token üret, eskiyi geçersiz kıl
- [ ] **Password hashing**: bcrypt, salt rounds
- [ ] api-gateway: JWT middleware
- [ ] Rate limiting (Redis + sliding window)
- [ ] Unit testler

### Phase 1.5 — Security
- [ ] **Helmet**: HTTP security headers (XSS, clickjacking, MIME sniff)
- [ ] **CORS**: origin whitelist, credentialed requests
- [ ] **SQL Injection**: parameterized queries zorunlu, ORM raw query audit
- [ ] **XSS**: input sanitization, output encoding
- [ ] **CSRF**: double-submit cookie veya CSRF token (stateful endpoint'ler için)
- [ ] **Secrets Management**: env var'lar container secret olarak mount, kod içinde hardcode yok
- [ ] **OWASP Top 10** checklist: her madde için projede karşılığı nedir gözden geçir
- [ ] Security test: OWASP ZAP ile basit tarama

### Phase 2 — API Design
- [ ] **Resource naming**: noun-based URL'ler (`/orders` değil `/createOrder`)
- [ ] **HTTP status codes**: 200/201/204/400/401/403/404/409/422/500 — ne zaman hangisi
- [ ] **Idempotent HTTP methods**: GET/PUT/DELETE idempotent, POST değil — buna göre tasarla
- [ ] **Pagination**: offset-based (`?page=1&limit=20`) — basit liste endpoint'leri için
- [ ] **Cursor pagination**: (`?cursor=xxx&limit=20`) — büyük dataset, feed tarzı endpoint'ler için
- [ ] **Filtering**: `?status=active&currency=TRY` — query param stratejisi
- [ ] **Sorting**: `?sort=createdAt&order=desc`
- [ ] **Versioning**: `/api/v1/` → `/api/v2/` geçişi nasıl yönetilir, breaking change stratejisi
- [ ] Her endpoint için OpenAPI (Swagger) doc yaz

### Phase 3 — Database Design
- [ ] **Normalization**: 1NF/2NF/3NF — hangi tablo neden ayrıldı
- [ ] **UUID vs BIGINT**: primary key seçimi, tradeoff'ları
- [ ] **Indexes**: B-tree, hangi kolonlara index, neden
- [ ] **Composite Index**: `(user_id, created_at)` gibi çok kolonlu index stratejisi
- [ ] **Partial Index**: `WHERE status = 'pending'` gibi filtered index
- [ ] **Foreign Key**: referential integrity, cascade davranışları
- [ ] **Unique Constraint**: idempotency key, email unique
- [ ] **Check Constraint**: `balance >= 0`, `amount > 0`
- [ ] **Soft Delete**: `deleted_at` kolonu — gerçek silme yerine
- [ ] **Migration Strategy**: up/down migration, zero-downtime migration teknikleri
- [ ] **Partitioning** (teorik): range/list/hash partition ne zaman kullanılır

### Phase 4 — Wallet & Ledger
- [ ] wallet-service: bakiye tablosu + version kolonu
- [ ] Double-entry ledger: her işlem debit + credit kaydı
- [ ] Atomic update ile bakiye düş (balance >= amount kontrolü)
- [ ] Optimistic locking (version çakışırsa retry)
- [ ] Integration testler (Testcontainers)

### Phase 5 — Caching
- [ ] **Cache Aside**: önce cache bak, miss ise DB'den çek, cache'e yaz
- [ ] **Write Through**: yazarken aynı anda cache'i de güncelle
- [ ] **Write Behind**: önce cache'e yaz, async olarak DB'ye flush
- [ ] **TTL stratejisi**: hangi veri ne kadar cache'lenir (wallet balance vs user profile)
- [ ] **Cache Invalidation**: event tetiklemeli invalidation vs TTL expiry
- [ ] **Hot Keys**: tek key'e çok istek giderse ne olur, local cache + Redis kombinasyonu
- [ ] wallet balance read path → Cache Aside ile optimize et

### Phase 6 — Idempotency & Payment
- [ ] Idempotency key middleware (Redis'te sakla, TTL ile)
- [ ] payment-service: ödeme simülasyonu (mock 3rd party, %10 fail rate)
- [ ] Outbox tablosu + Polling Publisher (background job)
- [ ] Retry mekanizması (exponential backoff)

### Phase 7 — Order & Inventory + Message Queue Semantics
- [ ] order-service: sipariş oluştur
- [ ] inventory-service: stok yönetimi
- [ ] Kafka producer/consumer kurulumu (key = user_id)
- [ ] order.created → inventory rezervasyon akışı
- [ ] Consumer group yapılandırması
- [ ] **At-least-once delivery**: consumer idempotent olmalı, aynı mesaj 2 kez gelebilir
- [ ] **Exactly-once**: Kafka transactions + idempotent producer
- [ ] **Ordering guarantee**: aynı key → aynı partition → sıra korunur
- [ ] **Poison Message**: parse edilemeyen mesaj consumer'ı durdurur — nasıl handle edilir
- [ ] **Retry Topic**: başarısız mesaj → retry.topic.1 → retry.topic.2 → DLQ
- [ ] **Dead Letter Topic**: tüm retry'lar başarısız → DLT'ye düşer, alert tetiklenir
- [ ] **Consumer Lag monitoring**: Grafana'da consumer lag dashboard'u

### Phase 8 — Saga Pattern
- [ ] Choreography saga: event chain ile akış
- [ ] Orchestration saga: order-service merkezi koordinatör
- [ ] Compensating transaction: her adımın geri alımı
- [ ] Saga state tablosu (DB'de adım takibi)
- [ ] Dead Letter Queue (başarısız saga adımları)

### Phase 9 — Reliability
- [ ] Circuit Breaker (inter-service HTTP calls)
- [ ] Graceful shutdown (SIGTERM handler)
- [ ] Health check endpoint'leri (/health, /ready)
- [ ] Retry + exponential backoff + jitter

### Phase 10 — Distributed Systems (Teori)
- [ ] **CAP theorem**: Consistency, Availability, Partition Tolerance — ikisi seçilir
- [ ] **CP vs AP**: PostgreSQL CP, Kafka AP — projede nerede hangi model
- [ ] **Eventual consistency**: wallet balance nihai tutarlılığa ne zaman ulaşır
- [ ] **Clock skew**: distributed sistemde timestamp'e neden güvenilmez
- [ ] **Split brain**: leader election, Redis Sentinel, hangi node doğru kabul edilir
- [ ] Her servisin CAP konumunu dokümante et — bilinçli tercih

### Phase 11 — Observability
- [ ] OpenTelemetry SDK her servise ekle
- [ ] Distributed tracing: trace_id tüm servisler boyunca akıyor
- [ ] **RED metodolojisi**: Rate (RPS), Errors (error %), Duration (latency) — her servis için
- [ ] **USE metodolojisi**: Utilization, Saturation, Errors — infra (CPU, memory, DB conn)
- [ ] **Latency p95 / p99**: histogram_quantile ile Prometheus'ta hesapla
- [ ] Prometheus metrics: request count, latency histogram, error rate
- [ ] Grafana dashboard: RED paneli, consumer lag, saga başarı/başarısızlık oranı
- [ ] Loki structured logging — standart format (Phase 0A'da tanımlanan)
- [ ] Alert kuralları: error rate > %1, p99 > 500ms, consumer lag > 1000

### Phase 12 — Testing
- [ ] Unit: business logic (Jest, mock'suz mümkün olduğunca)
- [ ] Integration: gerçek DB + Redis (Testcontainers)
- [ ] E2E: tam sipariş akışı (başarılı + başarısız senaryolar)
- [ ] Load test (k6): wallet concurrent update testi
- [ ] **Chaos test**: dependency'yi öldür, circuit breaker devreye giriyor mu

### Phase 13 — DevOps
- [ ] Her servis için Dockerfile (multi-stage build)
- [ ] Kubernetes manifests: Deployment, Service, ConfigMap, Secret
- [ ] Ingress (api-gateway)
- [ ] GitHub Actions: lint → test → build → push
- [ ] Horizontal Pod Autoscaler (HPA)
- [ ] **Rolling Update**: sıfır downtime ile yeni version deploy
- [ ] **Blue-Green Deployment**: iki environment, traffic switch ile geçiş
- [ ] **Canary Deployment**: %10 trafiği yeni versiona yönlendir, metrik izle
- [ ] **Rollback**: canary kötüye giderse otomatik geri al
- [ ] **Readiness Probe**: pod hazır değilse traffic gönderme
- [ ] **Liveness Probe**: pod donmuşsa restart et

### Phase 14 — (Opsiyonel) İleri Konular
- [ ] CQRS: read/write model ayrımı
- [ ] Event Sourcing: state yerine event'lerden rebuild
- [ ] gRPC (HTTP yerine inter-service)
- [ ] Service Mesh (Istio)

---

## Klasör Yapısı (Hedef)

```
paymesh/
├── PLAN.md
├── docker-compose.yml
├── k8s/
│   ├── api-gateway/
│   ├── user-service/
│   └── ...
├── services/
│   ├── api-gateway/
│   ├── user-service/
│   ├── wallet-service/
│   ├── payment-service/
│   ├── order-service/
│   ├── inventory-service/
│   └── notification-service/
├── packages/
│   ├── shared-types/       ← ortak TypeScript tipleri + standart error format
│   ├── logger/             ← structured logging (JSON), standart log formatı
│   ├── config/             ← typed config, .env validation (zod), env ayrımı
│   ├── tracing/            ← OpenTelemetry setup
│   └── http-middleware/    ← correlation ID, error handler, versioning
└── infra/
    ├── grafana/
    ├── prometheus/
    └── loki/
```

---

## Öğrenme Sırası (Öncelik)

1. **PostgreSQL schema tasarımı** — ledger, wallet, order tabloları + index + constraint
2. **JWT auth + güvenlik** — access/refresh token döngüsü, rotation, OWASP
3. **REST API design** — pagination, filtering, resource naming, status codes
4. **Double-entry ledger** — fintech'in temeli
5. **Optimistic locking** — race condition neden olur, version column nasıl çalışır
6. **Caching patterns** — Cache Aside, TTL, invalidation
7. **Idempotency** — aynı istek 2 kez gelirse ne olur
8. **Outbox + Polling Publisher** — event kaybolmaması garantisi
9. **Kafka semantics** — at-least-once, exactly-once, poison message, DLQ
10. **Saga pattern** — dağıtık transaction nasıl yönetilir, compensating tx
11. **CAP theorem** — teorik temel, distributed sistemde nerede duruyoruz
12. **RED/USE + p99** — neyi ölçeceğini bilmek kadar kritik
13. **OpenTelemetry** — distributed tracing neden kritik
14. **Kubernetes + deployment stratejileri** — rolling, blue-green, canary

---

## Notlar

- Phase 0A bitince çalışan bir sistem olmalı (3 servis ayakta, auth çalışıyor)
- Phase 0A'da log formatı ve config yapısı kesinleşmeli — sonradan değiştirmek maliyetli
- Phase 0B bitince tüm altyapı hazır, servisler henüz basit
- Her phase sonunda sistemi ayağa kaldırıp test et
- Redis lock: cross-service senaryolar için rezerve, wallet'ta kullanma
- CQRS, Event Sourcing, gRPC: Phase 14'e ertelenmiş, önce temeli sağlam kur
- Gerçek para işlemi yok, simülasyon
- Distributed Systems (Phase 10) kod içermez — mimari kararları bilinçli almak için teori

---

*Başlangıç: Phase 0A — Monorepo yapısı + PostgreSQL + Redis + 3 servis*
