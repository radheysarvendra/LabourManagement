# Code Review — Critical Bugs & Performance Issues

---

## CRITICAL BUGS (Security / Data Integrity)

| # | File | Line | Function | Issue |
|---|------|------|----------|-------|
| 1 | routes/index.js | 72–87 | — | All 16 public `/api/work-assignments` routes have zero auth middleware — anyone can create, update, delete work assignments |
| 2 | routes/index.js | 59–71 | — | Order routes have no auth — `PUT /api/orders/:id/admin-status` (order approval) is completely unprotected |
| 3 | routes/index.js | 54–58 | — | Booking routes have no auth — anyone can create/read/update bookings |
| 4 | routes/index.js | 88–89 | — | `/createLabour` and `/searchLabour` have no `verifyToken` |
| 5 | controller/owner/service.js | 354 | `createOwnerService` | Returns a valid session token without OTP when phone already exists — attacker knowing any phone gets a login token |
| 6 | controller/order/service.js | 260 | `updateOrderAdminStatusService` | Work assignment creation runs outside the transaction — if it fails, order is already marked `approved` but no work assignment exists (broken state) |
| 7 | controller/workAssignment/service.js | 624 | `generatePaymentService` | No duplicate check — calling generate payment twice creates duplicate payment rows for same period |

---

## PERFORMANCE ISSUES (Slow / N+1 Queries)

| # | File | Line | Function | Issue |
|---|------|------|----------|-------|
| 8 | controller/admin/index.js | 64–100 | `ensureDefaultAdmin` | Nested `for...of` loops — for each of 6 roles loops over every module and fires `AdminPermission.findOrCreate()` individually — up to 6 × 17 = 102 DB queries on startup |
| 9 | controller/Labours/service.js | 233 | `createLabourSkillRows` | N+1: `for...of` loop with `await Skill.findOne()` + `await LabourSkill.create()` per skill — 2 queries per skill instead of bulk insert |
| 10 | controller/order/service.js | 180 | `createOrderService` | N+1: `for...of` with `await OrderMapping.create()` per labour — should use `OrderMapping.bulkCreate()` |
| 11 | controller/order/service.js | 340 | `updateOrderAdminStatusService` | N+1: `for...of` with `await OrderMapping.create()` per selected labour inside a transaction |
| 12 | controller/workAssignment/service.js | 86 | `syncAssignmentLabours` | N+1: `for...of` with `await WorkAssignmentLabour.upsert()` per labour — fires 1 query per labour instead of bulk upsert |
| 13 | controller/booking/service.js | 159 | `createBookingService` | N+1: `for...of` with `await BookingAllocation.create()` per allocated labour |
| 14 | controller/workAssignment/service.js | 295 | `getWorkAssignmentsService` | Hard-coded `include[3]` — fragile index reference; breaks silently if `assignmentInclude` array order changes |
| 15 | controller/workAssignment/service.js | 518 | `getAttendanceService` | Unbounded `findAll()` — no `limit`, returns all attendance records for all dates in one query |
| 16 | controller/workAssignment/service.js | 649 | `getPaymentsService` | Unbounded `findAll()` — no `limit`, returns all payment records |
| 17 | controller/admin/index.js | 197 | `getAdmins` | Unbounded `findAll()` — no pagination on admin list |

---

## Priority Order to Fix

1. Fix #1–4 first — add `verifyToken` to all unprotected routes (highest risk)
2. Fix #5 — owner auto-login without OTP
3. Fix #6 — move work assignment creation inside the transaction
4. Fix #8 — 102 DB queries on startup, use bulkCreate / Promise.all
5. Fix #9–13 — replace `for...of` + await loops with `bulkCreate`
6. Fix #7 — add payment duplicate guard
7. Fix #15–17 — add `limit` to unbounded queries
