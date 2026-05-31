# Answers

## 1.

Right now `OrdersService` holds everything in the module-level `ORDERS` constant: a plain TypeScript array that won't survive a server restart and falls apart the moment two instances try to write at the same time. For production I'd swap it for PostgreSQL, which fits well here since orders and garments have clear relational structure (orders --> garments is a classic one-to-many). I'd bring in TypeORM or Prisma as the ORM layer to get migrations, type-safe queries, and connection pooling out of the box.

On the service design side, I'd pull data access into a dedicated repository layer (NestJS has clean patterns for this with `@InjectRepository`) so `OrdersService` only deals with business logic, validating status transitions, calculating totals, while the repository handles queries. This separation makes unit testing much easier since you can mock the repository without touching a real DB. I'd also add pagination to `findAll()` early, because returning thousands of orders in one shot will kill performance and wrap any write operations in transactions so something like "update garment status + create billing entry" either fully succeeds or fully rolls back.

---

## 2.

The current `getOrder` endpoint returns `Order | { error: string }` from the same 200 response, which is problematic. The client has no reliable way to know if the request failed without inspecting the response body shape, you'd have to do `if ('error' in response)` which is fragile and non-standard. Any consumer of this API (frontend, mobile app, third-party integration) has to implement this quirky check instead of just relying on the HTTP status code, which defeats the whole point of using HTTP semantics.

The fix is straightforward: throw NestJS's built-in `NotFoundException` when `findOne()` returns `undefined`, which automatically returns a 404 and a consistent error shape. I'd also standardize the error response across all endpoints, NestJS already does `{ statusCode, message, error }` by default with its exception classes, so you mostly just need to stop bypassing that. For a POS API that'll eventually handle payments and delivery, consistent error handling isn't optional; the client needs to confidently distinguish between "not found", "validation failed", and "server error" without parsing strings. Adding a `ParseUUIDPipe` or similar validation on the `:id` param would also stop malformed requests from reaching the service layer entirely.

---

## 3.

The current pattern of a bare `fetch('http://localhost:3001/api/orders')` inside `useEffect` in `App.tsx` works for a demo but becomes a copy-paste mess once you need filters, pagination, and multiple endpoints. Every component ends up with its own `loading`/`error` state boilerplate, the hardcoded base URL has to be updated in multiple places and there's no way to share cached data between components or avoid redundant network calls.

I'd bring in React Query (TanStack Query) as the data-fetching layer: it gives you caching, background refetching, pagination hooks and stale-while-revalidate behavior out of the box. Each endpoint becomes a custom hook like `useOrders(filters)` or `useOrderById(id)` that returns `{ data, isLoading, error }`, so components just consume data without caring about the mechanics. I'd also extract the base URL and fetch logic into an API client module (`api/ordersApi.ts`) so HTTP details live in one place, the base URL should come from a `VITE_API_BASE_URL` env variable rather than being hardcoded. `OrdersList.tsx` is already cleanly separated from data fetching which is the right instinct — that pattern just needs to extend upward into a proper data layer.

---

## 4.

Looking at the current `Order` and `Garment` interfaces in `orders.service.ts`, they're missing quite a lot that a real laundry operation would need. There's no pricing at all, no `unitPrice` per garment, no `totalAmount` on the order, no `paymentStatus`. There's no `customerId` linking an order to a customer record, so there's no way to pull up order history for a returning customer --> `customerName` as a plain string is a dead end. The `GarmentStatus` enum is also too simplified; real workflows have intermediate steps like `inspected`, `stain_treatment`, `pressing`, `quality_check` between `in_cleaning` and `ready`. And there's no `updatedAt` or status history, so you can't tell when a garment's status last changed, which matters for SLA tracking and handling disputes.

For evolving this I'd add: a `customerId` foreign key on `Order`, a `ServiceType` enum and `unitPrice` on `Garment` since pricing depends on service type, a separate `status` on `Order` itself (an order is `partially_ready` when some garments are done but not all) and an `OrderEvent` audit log table to track every status change with a timestamp and the user who made it. Prepaid packages are a separate entity entirely, a `Package` model with a balance that gets decremented when orders are placed against it, rather than per-order billing.

---

## 5.

The biggest risk with AI-generated code in a codebase like this is that it looks correct at first glance but has subtle gaps on the edges. You can see it here: `findOne()` quietly returns `undefined` and instead of throwing a proper 404, the controller returns a 200 with an error body — the classic "happy path only" pattern. The `ORDERS` array is module-scoped and shared across all requests, which means any future write that mutates it directly would have race condition issues under concurrent load. On the frontend, the catch block does `e.message || 'Failed to load orders'` but network errors that have no `.message` would silently swallow useful information. The `res.ok` check is there, which is better than a lot of AI-generated fetch code but it's easy to miss that kind of subtlety in a review.

Before shipping any of this I'd trace through the unhappy paths manually, invalid IDs, empty arrays, concurrent writes, what happens when the server is down. I'd review every `any` cast (the `e: any` in the catch block is one) since those are usually shortcuts the generator took. I'd also write unit tests for the service methods since AI rarely generates those unless asked and integration tests that actually hit the endpoints. Basically treat AI output like a PR from a junior dev, the structure is often fine but you need to verify edge cases, error handling and whether it follows your team's actual patterns before it earns trust.

---

## 6.

With the current REST-only setup, the simplest path to near real-time is short polling hit `GET /api/orders` every few seconds with `setInterval`. It works, it's dead simple and for a single-store dashboard with a handful of users it's honestly fine as a starting point. The downside is bandwidth waste since most responses will be identical and the UI is always slightly stale by the length of the poll interval.

The cleaner approach is Server-Sent Events: NestJS supports it natively via `@Sse()` and since the garment board is mostly server-to-client pushes (status changed, broadcast to dashboard), SSE fits perfectly without the overhead of full-duplex WebSockets. The client opens one persistent `EventSource` connection and receives events whenever a garment status changes. If the product later needs the dashboard to also *send* updates, like dragging a card to update status, then WebSockets via `@nestjs/websockets` make more sense. The bigger architectural consideration either way is that the current `ORDERS` array has no pub/sub mechanism; you'd need to introduce an event emitter (NestJS has `EventEmitter2` built in) so that when a status update happens, it fires an event the SSE controller can forward to connected clients. For multi-instance deployments, you'd replace that with Redis Pub/Sub so all instances share the same event stream.