/**
 * Smoke test — hits every major flow of the Dehaade backend.
 * Run: node scripts/smokeTest.js
 * Requires server to be up on PORT (default 5352).
 */

const http = require("http");

const BASE = `http://localhost:${process.env.PORT || 5352}`;
let passed = 0, failed = 0;
let adminToken = "";
let userToken  = "";
let testUserId = null;
let testOrderId = null;
let testLabourId = null;
let testOwnerId  = null;
let testBookingId = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: "localhost",
      port: process.env.PORT || 5352,
      path,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(token   ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    if (payload) r.write(payload);
    r.end();
  });
}

function pass(label) {
  passed++;
  console.log(`  ✅  ${label}`);
}
function fail(label, detail) {
  failed++;
  console.log(`  ❌  ${label}`);
  if (detail) console.log(`       → ${JSON.stringify(detail).slice(0, 200)}`);
}
function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 55 - title.length))}`);
}
function expect(label, condition, detail) {
  condition ? pass(label) : fail(label, detail);
}

// ── test suites ───────────────────────────────────────────────────────────────

async function testHealth() {
  section("HEALTH");

  let r = await req("GET", "/");
  expect("GET / → 200 + success:true",
    r.status === 200 && r.body.success === true, r.body);

  r = await req("GET", "/health");
  expect("GET /health → 200 + status:ok",
    r.status === 200 && r.body.status === "ok", r.body);

  r = await req("GET", "/api/health");
  expect("GET /api/health → 200 + ok:true",
    r.status === 200 && r.body.ok === true, r.body);

  r = await req("GET", "/api/status");
  expect("GET /api/status → 200 + db:connected",
    r.status === 200 && r.body.db === "connected", r.body);
}

async function testPublicEndpoints() {
  section("PUBLIC ENDPOINTS");

  let r = await req("GET", "/api/categories");
  expect("GET /api/categories → 200",
    r.status === 200 && r.body.success === true, r.body);

  r = await req("GET", "/api/skills");
  expect("GET /api/skills → 200",
    r.status === 200 && r.body.success === true, r.body);

  r = await req("GET", "/api/payment/config");
  expect("GET /api/payment/config → 200 + upiId present",
    r.status === 200 && r.body.upiId, r.body);

  r = await req("GET", "/api/platform-fees/contractor-tiers");
  expect("GET /api/platform-fees/contractor-tiers → 200",
    r.status === 200 && Array.isArray(r.body.leadFees), r.body);

  r = await req("GET", "/api/platform-fees/labour-tiers");
  expect("GET /api/platform-fees/labour-tiers → 200",
    r.status === 200 && Array.isArray(r.body.data), r.body);

  r = await req("GET", "/api/address/states");
  expect("GET /api/address/states → 200",
    r.status === 200 && r.body.success === true, r.body);
}

async function testAdminAuth() {
  section("ADMIN AUTH");

  let r = await req("POST", "/api/admin/auth/login", {
    email: "wrong@test.com", password: "badpass",
  });
  expect("POST /api/admin/auth/login (bad creds) → 401/400/404",
    r.status === 401 || r.status === 400 || r.status === 404, r.body);

  r = await req("POST", "/api/admin/auth/login", {
    email:    process.env.DEFAULT_ADMIN_EMAIL    || "admin@dehaddi.com",
    password: process.env.DEFAULT_ADMIN_PASSWORD || "admin@123",
  });
  expect("POST /api/admin/auth/login (good creds) → 200 + token",
    r.status === 200 && r.body.token, r.body);

  if (r.body.token) adminToken = r.body.token;

  r = await req("GET", "/api/admin/profile", null, adminToken);
  expect("GET /api/admin/profile → 200",
    r.status === 200 && r.body.success === true, r.body);
}

async function testUserRegistration() {
  section("USER REGISTRATION (new-flow)");

  const phone = `99${Date.now().toString().slice(-8)}`;

  let r = await req("POST", "/api/auth/register", {
    name:   "Smoke Test Labour",
    phone,
    role:   "labour",
    age:    24,
    gender: "male",
    skills: [1],
  });
  expect("POST /api/auth/register (labour) → 200/201 + token",
    (r.status === 200 || r.status === 201) && r.body.token, r.body);

  if (r.body.token) {
    userToken  = r.body.token;
    testUserId = r.body.user?.id || r.body.userId;
  }
}

async function testOldAuthFlow() {
  section("OLD AUTH FLOW");

  const phone = `88${Date.now().toString().slice(-8)}`;

  let r = await req("POST", "/auth/check-phone", { phone });
  expect("POST /auth/check-phone (new number) → 200",
    r.status === 200, r.body);

  r = await req("POST", "/auth/request-otp", { phone, userType: "labour" });
  expect("POST /auth/request-otp → 200/201",
    r.status === 200 || r.status === 201, r.body);
}

async function testAuthGuard() {
  section("AUTH GUARD");

  let r = await req("GET", "/api/orders");
  expect("GET /api/orders (no token) → 401",
    r.status === 401, r.body);

  r = await req("GET", "/api/bookings");
  expect("GET /api/bookings (no token) → 401",
    r.status === 401, r.body);

  r = await req("GET", "/api/admin/dashboard/stats");
  expect("GET /api/admin/dashboard/stats (no token) → 401",
    r.status === 401, r.body);

  r = await req("POST", "/api/categories", { name: "hack" });
  expect("POST /api/categories (no admin token) → 401",
    r.status === 401, r.body);
}

async function testAdminDashboard() {
  section("ADMIN DASHBOARD");
  if (!adminToken) { fail("Admin token missing — skipping admin tests"); return; }

  let r = await req("GET", "/api/admin/dashboard/stats", null, adminToken);
  expect("GET /api/admin/dashboard/stats → 200",
    r.status === 200 && r.body.success === true, r.body);

  r = await req("GET", "/api/admin/admins", null, adminToken);
  expect("GET /api/admin/admins → 200",
    r.status === 200, r.body);

  r = await req("GET", "/api/admin/users", null, adminToken);
  expect("GET /api/admin/users → 200",
    r.status === 200, r.body);

  r = await req("GET", "/api/admin/roles", null, adminToken);
  expect("GET /api/admin/roles → 200",
    r.status === 200, r.body);
}

async function testLabourCRUD() {
  section("LABOUR CRUD (admin-flow)");
  if (!adminToken) { fail("Admin token missing — skipping"); return; }

  const phone = `77${Date.now().toString().slice(-8)}`;

  let r = await req("POST", "/api/admin/labours", {
    name: "Smoke Labour", phone,
    age: 28, gender: "male",
    skillId: 1,
    state: "UP", district: "Agra", pincode: "282001",
  }, adminToken);
  expect("POST /api/admin/labours → 200/201",
    r.status === 200 || r.status === 201, r.body);

  testLabourId = r.body.data?.id || r.body.labour?.id || r.body.id;

  r = await req("GET", "/api/admin/labours", null, adminToken);
  expect("GET /api/admin/labours → 200",
    r.status === 200, r.body);

  if (testLabourId) {
    r = await req("GET", `/api/admin/labours/${testLabourId}`, null, adminToken);
    expect(`GET /api/admin/labours/${testLabourId} → 200`,
      r.status === 200, r.body);

    r = await req("PUT", `/api/admin/labours/${testLabourId}`, {
      experienceYears: 3,
    }, adminToken);
    expect(`PUT /api/admin/labours/${testLabourId} → 200`,
      r.status === 200, r.body);
  }

  if (userToken) {
    r = await req("GET", "/getAllLabour", null, userToken);
    expect("GET /getAllLabour → 200",
      r.status === 200, r.body);
  } else {
    pass("GET /getAllLabour → skipped (no user token, admin JWT not accepted here)");
  }
}

async function testOwnerCRUD() {
  section("OWNER CRUD (admin-flow)");
  if (!adminToken) { fail("Admin token missing — skipping"); return; }

  const phone = `66${Date.now().toString().slice(-8)}`;

  let r = await req("POST", "/api/admin/owners", {
    name: "Smoke Owner", phone,
    age: 35, gender: "male",
    workType: "construction",
    categoryId: 1, skillId: 1,
    state: "UP", district: "Agra", pincode: "282001",
  }, adminToken);
  expect("POST /api/admin/owners → 200/201",
    r.status === 200 || r.status === 201, r.body);

  testOwnerId = r.body.data?.id || r.body.owner?.id || r.body.id;

  r = await req("GET", "/api/admin/owners", null, adminToken);
  expect("GET /api/admin/owners → 200",
    r.status === 200, r.body);

  if (testOwnerId) {
    r = await req("GET", `/api/admin/owners/${testOwnerId}`, null, adminToken);
    expect(`GET /api/admin/owners/${testOwnerId} → 200`,
      r.status === 200, r.body);
  }
}

async function testCategorySkillAdmin() {
  section("CATEGORY & SKILL (admin mutations)");
  if (!adminToken) { fail("Admin token missing — skipping"); return; }

  let r = await req("POST", "/api/categories", {
    name: `SmokeCategory_${Date.now()}`, hindi: "परीक्षण",
  }, adminToken);
  expect("POST /api/categories (admin) → 200/201",
    r.status === 200 || r.status === 201, r.body);

  const catId = r.body.data?.id || r.body.category?.id || r.body.id;

  r = await req("POST", "/api/skills", {
    name: `SmokeSkill_${Date.now()}`, hindi: "परीक्षण कौशल",
  }, adminToken);
  expect("POST /api/skills (admin) → 200/201",
    r.status === 200 || r.status === 201, r.body);

  const skillId = r.body.data?.id || r.body.skill?.id || r.body.id;

  if (skillId) {
    r = await req("DELETE", `/api/skills/${skillId}`, null, adminToken);
    expect(`DELETE /api/skills/${skillId} → 200`,
      r.status === 200, r.body);
  }
  if (catId) {
    r = await req("DELETE", `/api/categories/${catId}`, null, adminToken);
    expect(`DELETE /api/categories/${catId} → 200`,
      r.status === 200, r.body);
  }
}

async function testOrderFlow() {
  section("ORDER FLOW");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping order tests"); return; }

  let r = await req("POST", "/api/orders", {
    needType: "labour",
    skillId: 1,
    categoryId: 1,
    pincode: "282001",
    address: "123 Test Street, Agra",
    requiredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    ownerName: "Test Owner",
    ownerPhone: "9999999999",
    description: "Smoke test order",
  }, token);
  expect("POST /api/orders → 200/201",
    r.status === 200 || r.status === 201, r.body);

  testOrderId = r.body.id || r.body.data?.id || r.body.order?.id;

  r = await req("GET", "/api/orders", null, token);
  expect("GET /api/orders → 200",
    r.status === 200, r.body);

  if (testOrderId) {
    r = await req("GET", `/api/orders/${testOrderId}`, null, token);
    expect(`GET /api/orders/${testOrderId} → 200`,
      r.status === 200, r.body);
  }

  if (adminToken) {
    r = await req("GET", "/api/admin/orders", null, adminToken);
    expect("GET /api/admin/orders → 200",
      r.status === 200, r.body);
  }

  if (testOrderId) {
    r = await req("DELETE", `/api/orders/${testOrderId}/cancel`, null, token);
    expect(`DELETE /api/orders/${testOrderId}/cancel → 200`,
      r.status === 200, r.body);
  }
}

async function testBookingFlow() {
  section("BOOKING FLOW");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping booking tests"); return; }

  let r = await req("POST", "/api/bookings", {
    skill: "Mason",
    pincode: "282001",
    requiredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    address: "456 Test Road, Agra",
    description: "Smoke test booking",
  }, token);
  expect("POST /api/bookings → 200/201",
    r.status === 200 || r.status === 201, r.body);

  testBookingId = r.body.data?.id || r.body.booking?.id || r.body.id;

  r = await req("GET", "/api/bookings", null, token);
  expect("GET /api/bookings → 200",
    r.status === 200, r.body);

  if (testBookingId) {
    r = await req("GET", `/api/bookings/${testBookingId}`, null, token);
    expect(`GET /api/bookings/${testBookingId} → 200`,
      r.status === 200, r.body);
  }
}

async function testProviderSearch() {
  section("PROVIDER SEARCH");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping"); return; }

  let r = await req("GET", "/api/providers/search?needType=labour", null, token);
  expect("GET /api/providers/search?needType=labour → 200",
    r.status === 200, r.body);

  r = await req("GET", "/api/providers/count?needType=labour", null, token);
  expect("GET /api/providers/count → 200",
    r.status === 200, r.body);
}

async function testPaymentFlow() {
  section("PAYMENT");
  const token = userToken || adminToken;

  let r = await req("GET", "/api/payment/config");
  expect("GET /api/payment/config (public) → 200 + upiId",
    r.status === 200 && r.body.upiId, r.body);

  if (token) {
    r = await req("GET", "/api/payment/history", null, token);
    expect("GET /api/payment/history → 200",
      r.status === 200, r.body);
  }

  if (adminToken) {
    r = await req("GET", "/api/admin/order-payments", null, adminToken);
    expect("GET /api/admin/order-payments → 200",
      r.status === 200, r.body);
  }
}

async function testLocationEndpoints() {
  section("LOCATION");

  let r = await req("GET", "/api/address/states");
  expect("GET /api/address/states → 200",
    r.status === 200, r.body);

  r = await req("GET", "/api/address/pincode/282001");
  expect("GET /api/address/pincode/282001 → 200",
    r.status === 200, r.body);

  r = await req("GET", "/pincode/282001");
  expect("GET /pincode/282001 → 200",
    r.status === 200, r.body);
}

async function testLabourVerification() {
  section("LABOUR VERIFICATION");

  if (userToken) {
    let r = await req("GET", "/api/labour/verification/status", null, userToken);
    expect("GET /api/labour/verification/status → 200 or 404",
      r.status === 200 || r.status === 404, r.body);

    r = await req("POST", "/api/labour/verification/submit", {
      aadharNumber: "123456789012",
      documentUrl: "https://example.com/doc.pdf",
    }, userToken);
    expect("POST /api/labour/verification/submit → 200 or 404",
      r.status === 200 || r.status === 404, r.body);
  } else {
    fail("No user token — skipping user verification tests");
  }

  if (adminToken) {
    const r = await req("GET", "/api/admin/labour-verifications", null, adminToken);
    expect("GET /api/admin/labour-verifications → 200",
      r.status === 200, r.body);
  }
}

async function testContractorLeads() {
  section("CONTRACTOR LEADS");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping"); return; }

  let r = await req("GET", "/api/contractor-leads", null, token);
  expect("GET /api/contractor-leads → 200",
    r.status === 200, r.body);

  if (adminToken) {
    r = await req("GET", "/api/admin/contractor-leads", null, adminToken);
    expect("GET /api/admin/contractor-leads → 200",
      r.status === 200, r.body);
  }
}

async function testWorkAssignments() {
  section("WORK ASSIGNMENTS");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping"); return; }

  let r = await req("GET", "/api/work-assignments", null, token);
  expect("GET /api/work-assignments → 200",
    r.status === 200, r.body);

  if (adminToken) {
    r = await req("GET", "/api/admin/work-assignments", null, adminToken);
    expect("GET /api/admin/work-assignments → 200",
      r.status === 200, r.body);
  }
}

async function testAdminPermissionsRoles() {
  section("ROLES & PERMISSIONS (admin)");
  if (!adminToken) { fail("No admin token — skipping"); return; }

  let r = await req("GET", "/api/admin/roles", null, adminToken);
  expect("GET /api/admin/roles → 200",
    r.status === 200, r.body);

  r = await req("GET", "/api/admin/permissions/matrix", null, adminToken);
  expect("GET /api/admin/permissions/matrix → 200",
    r.status === 200, r.body);
}

async function testRatings() {
  section("RATINGS");
  const token = userToken || adminToken;
  if (!token) { fail("No token — skipping"); return; }

  if (userToken) {
    let r = await req("GET", "/api/ratings/my", null, userToken);
    expect("GET /api/ratings/my → 200",
      r.status === 200, r.body);
  }

  if (adminToken) {
    const r = await req("GET", "/api/admin/ratings", null, adminToken);
    expect("GET /api/admin/ratings → 200",
      r.status === 200, r.body);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=".repeat(60));
  console.log(" DEHAADE BACKEND — SMOKE TEST");
  console.log(`  Target: ${BASE}`);
  console.log("=".repeat(60));

  await testHealth();
  await testPublicEndpoints();
  await testAdminAuth();
  await testUserRegistration();
  await testOldAuthFlow();
  await testAuthGuard();
  await testAdminDashboard();
  await testLabourCRUD();
  await testOwnerCRUD();
  await testCategorySkillAdmin();
  await testOrderFlow();
  await testBookingFlow();
  await testProviderSearch();
  await testPaymentFlow();
  await testLocationEndpoints();
  await testLabourVerification();
  await testContractorLeads();
  await testWorkAssignments();
  await testAdminPermissionsRoles();
  await testRatings();

  const total = passed + failed;
  console.log("\n" + "=".repeat(60));
  console.log(` RESULTS: ${passed}/${total} passed  |  ${failed} failed`);
  if (failed === 0) console.log(" ALL SMOKE TESTS PASSED ✅");
  else             console.log(" SOME TESTS FAILED ❌ — review above");
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
})();
