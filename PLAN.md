# PayMesh — Proje Planı

Amazon + Banka sistemi karışımı. Senior backend kavramlarını gerçek bir sistemde öğrenmek için tasarlandı.

---

## Hedef Kavramlar

| Kategori | Konu |
|---|---|
| Domain | Wallet, Ledger (double-entry), Payment, Order, Inventory |
| Reliability | Idempotency, Optimistic Locking, Circuit Breaker, Retry |
| Patterns | Saga (Choreography + Orchestration), Outbox + Polling Publisher, CQRS (opsiyonel) |
| Messaging | Apache Kafka (event stream), RabbitMQ (task queue) |
| Cache | Redis (cache + idempotency store) |
| Observability | OpenTelemetry, Jaeger (tracing), Prometheus, Grafana, Loki |
| Testing | Unit (Jest), Integration (Testcontainers), E2E, Load (k6) |
| DevOps | Docker, Docker Compose, Kubernetes, GitHub Actions CI/CD |

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
- [ ] api-gateway: JWT middleware
- [ ] Rate limiting (Redis + sliding window)
- [ ] Unit testler

### Phase 2 — Wallet & Ledger
- [ ] wallet-service: bakiye tablosu + version kolonu
- [ ] Double-entry ledger: her işlem debit + credit kaydı
- [ ] Atomic update ile bakiye düş (balance >= amount kontrolü)
- [ ] Optimistic locking (version çakışırsa retry)
- [ ] Integration testler (Testcontainers)

### Phase 3 — Idempotency & Payment
- [ ] Idempotency key middleware (Redis'te sakla, TTL ile)
- [ ] payment-service: ödeme simülasyonu (mock 3rd party, %10 fail rate)
- [ ] Outbox tablosu + Polling Publisher (background job)
- [ ] Retry mekanizması (exponential backoff)

### Phase 4 — Order & Inventory
- [ ] order-service: sipariş oluştur
- [ ] inventory-service: stok yönetimi
- [ ] Kafka producer/consumer kurulumu (key = user_id)
- [ ] order.created → inventory rezervasyon akışı
- [ ] Consumer group yapılandırması

### Phase 5 — Saga Pattern
- [ ] Choreography saga: event chain ile akış
- [ ] Orchestration saga: order-service merkezi koordinatör
- [ ] Compensating transaction: her adımın geri alımı
- [ ] Saga state tablosu (DB'de adım takibi)
- [ ] Dead Letter Queue (başarısız saga adımları)

### Phase 6 — Reliability
- [ ] Circuit Breaker (inter-service HTTP calls)
- [ ] Graceful shutdown (SIGTERM handler)
- [ ] Health check endpoint'leri (/health, /ready)
- [ ] Retry + exponential backoff + jitter

### Phase 7 — Observability
- [ ] OpenTelemetry SDK her servise ekle
- [ ] Distributed tracing: trace_id tüm servisler boyunca akıyor
- [ ] Prometheus metrics: request count, latency histogram, error rate
- [ ] Grafana dashboard: servis sağlığı paneli
- [ ] Loki structured logging (JSON format)

### Phase 8 — Testing
- [ ] Unit: business logic (Jest, mock'suz mümkün olduğunca)
- [ ] Integration: gerçek DB + Redis (Testcontainers)
- [ ] E2E: tam sipariş akışı (başarılı + başarısız senaryolar)
- [ ] Load test (k6): wallet concurrent update testi

### Phase 9 — DevOps
- [ ] Her servis için Dockerfile (multi-stage build)
- [ ] Kubernetes manifests: Deployment, Service, ConfigMap, Secret
- [ ] Ingress (api-gateway)
- [ ] GitHub Actions: lint → test → build → push
- [ ] Horizontal Pod Autoscaler (HPA)

### Phase 10 — (Opsiyonel) İleri Konular
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
│   ├── logger/             ← structured logging (JSON)
│   ├── tracing/            ← OpenTelemetry setup
│   └── http-middleware/    ← correlation ID, error handler, versioning
└── infra/
    ├── grafana/
    ├── prometheus/
    └── loki/
```

---

## Öğrenme Sırası (Öncelik)

1. **PostgreSQL schema tasarımı** — ledger, wallet, order tabloları
2. **JWT auth** — access/refresh token döngüsü
3. **Double-entry ledger** — fintech'in temeli
4. **Optimistic locking** — race condition neden olur, version column nasıl çalışır
5. **Idempotency** — aynı istek 2 kez gelirse ne olur
6. **Outbox + Polling Publisher** — event kaybolmaması garantisi
7. **Kafka** — producer, consumer, partition, consumer group, key stratejisi
8. **Saga pattern** — dağıtık transaction nasıl yönetilir, compensating tx
9. **OpenTelemetry** — distributed tracing neden kritik
10. **Kubernetes** — servis discovery, scaling, rolling update

---

## Notlar

- Phase 0A bitince çalışan bir sistem olmalı (3 servis ayakta, auth çalışıyor)
- Phase 0B bitince tüm altyapı hazır, servisler henüz basit
- Her phase sonunda sistemi ayağa kaldırıp test et
- Redis lock: cross-service senaryolar için rezerve, wallet'ta kullanma
- CQRS, Event Sourcing, gRPC: Phase 10'a ertelenmiş, önce temeli sağlam kur
- Gerçek para işlemi yok, simülasyon

---

*Başlangıç: Phase 0A — Monorepo yapısı + PostgreSQL + Redis + 3 servis*
