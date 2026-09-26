# FreshCart Backend — Updated Structure

This package is a conservative code-structure refactor of the uploaded FreshCart backend.

## What changed

The large `handlers/handler.go` has been split into focused files without changing the existing API routes or handler method names:

- `handlers/core.go` — shared handler type and helpers
- `handlers/auth.go` — authentication and password reset
- `handlers/catalog.go` — categories and shipping city/area endpoints
- `handlers/products.go` — products, prices and product images
- `handlers/addresses.go` — customer addresses
- `handlers/orders.go` — customer orders
- `handlers/payments.go` — JazzCash/payment endpoints
- `handlers/rider.go` — rider endpoints
- `handlers/admin.go` — admin orders, riders, slots, shipping settings and pricing
- `handlers/seed.go` — startup seed logic
- `handlers/coupons.go` — existing coupon functionality
- `handlers/notifications.go` — notifications
- `handlers/push.go` — Expo push notifications

## Existing folders retained

`config/`, `database/`, `middleware/`, `models/`, `services/`, `uploads/` and the existing `schema.sql` are retained so the refactor is low-risk.

## Next recommended refactor

The next stage should move SQL and business rules from handlers into per-domain `service.go` and `repository.go` files. This should be done incrementally so the existing mobile app and API remain compatible.

## Run

From this `backend` directory:

```bash
go mod tidy
go test ./...
go run .
```

The uploaded `.env` file is intentionally not included in this package. Copy your existing environment values into a local `.env` using `.env.example` as the reference.
