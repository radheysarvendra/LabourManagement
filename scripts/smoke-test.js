/* eslint-disable no-console */
"use strict";
const http = require("http");

const BASE = "http://localhost:5352";
let adminToken = "";
let userToken = "";
let testLabourId = 0;
let testOwnerId = 0;
let testOrderId = 0;
let testWorkAssignmentId = 0;
let testBookingId = 0;
let testAttendanceId = 0;
let testPaymentId = 0;
let testSkillId = 0;
let testCategoryId = 0;
let testStateId = 0;
let testDistrictId = 0;
let testLabourUserId = 0;
let testAssignmentLabourId = 0;

const ERRORS = [];
const PASSES = [];

function req(method, path, body, token, isAdmin = false) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "localhost",
      port: 5352,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = { _raw: raw }; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

function pass(label) {
  PASSES.push(label);
  console.log(`  ✓ ${label}`);
}
function fail(label, res) {
  ERRORS.push({ label, res });
  console.log(`  ✗ ${label} → ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
}
function check(label, res, expectStatus, bodyCheck) {
  const statusOk = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
  const bodyOk = bodyCheck ? bodyCheck(res.body) : true;
  if (statusOk && bodyOk) pass(label);
  else fail(label, res);
  return { statusOk, bodyOk, res };
}

async function run() {
  console.log("\n══════════════ SMOKE TEST ══════════════\n");

  // ── PUBLIC & HEALTH ────────────────────────────────────────
  console.log("── Health / Public ──");
  check("GET /", await req("GET", "/"), 200, b => b.success);
  check("GET /health", await req("GET", "/health"), 200, b => b.status === "ok");
  check("GET /api/health", await req("GET", "/api/health"), 200, b => b.ok);
  check("GET /api/status", await req("GET", "/api/status"), 200, b => b.success);

  // ── ADMIN LOGIN ────────────────────────────────────────────
  console.log("\n── Admin Auth ──");
  {
    const r = await req("POST", "/api/admin/auth/login", { email: "admin@dehaddi.com", password: "admin@123" });
    check("POST /api/admin/auth/login", r, 200, b => b.token);
    if (r.body.token) { adminToken = r.body.token; pass("Admin token obtained"); }
    else fail("Admin token obtained", r);
  }

  // ── CATEGORIES & SKILLS (public reads) ────────────────────
  console.log("\n── Categories & Skills ──");
  {
    const r = await req("GET", "/api/categories");
    check("GET /api/categories", r, 200);
    if (r.body.data?.length) testCategoryId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testCategoryId = r.body[0].id;
  }
  {
    const r = await req("GET", "/api/skills");
    check("GET /api/skills", r, 200);
    if (r.body.data?.length) testSkillId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testSkillId = r.body[0].id;
    if (!testSkillId && r.body?.skills?.length) testSkillId = r.body.skills[0].id;
  }
  if (testCategoryId) {
    check("GET /api/categories/:id/skills", await req("GET", `/api/categories/${testCategoryId}/skills`), [200, 404]);
  }

  // ── ADMIN CATEGORY/SKILL MUTATIONS ────────────────────────
  {
    const r = await req("POST", "/api/categories", { name: "SmokeTestCat_" + Date.now(), description: "test" }, adminToken, true);
    check("POST /api/categories (admin)", r, [200, 201]);
    if (r.body.id) testCategoryId = r.body.id;
    else if (r.body.data?.id) testCategoryId = r.body.data.id;
    else if (r.body.category?.id) testCategoryId = r.body.category.id;
  }
  if (testCategoryId) {
    check("PUT /api/categories/:id (admin)", await req("PUT", `/api/categories/${testCategoryId}`, { name: "SmokeTestCat_U_" + Date.now() }, adminToken, true), [200, 201]);
  }
  {
    const r = await req("POST", "/api/skills", { name: "SmokeTestSkill_" + Date.now(), description: "test" }, adminToken, true);
    check("POST /api/skills (admin)", r, [200, 201]);
    if (r.body.id) testSkillId = r.body.id;
    else if (r.body.data?.id) testSkillId = r.body.data.id;
    else if (r.body.skill?.id) testSkillId = r.body.skill.id;
  }
  if (testSkillId) {
    check("PUT /api/skills/:id (admin)", await req("PUT", `/api/skills/${testSkillId}`, { name: "SmokeSkill_Updated" }, adminToken, true), [200, 201]);
  }
  if (testCategoryId && testSkillId) {
    check("POST /api/categories/:id/skills (admin)", await req("POST", `/api/categories/${testCategoryId}/skills`, { skillId: testSkillId }, adminToken, true), [200, 201, 409]);
  }

  // ── ADDRESS / LOCATION ────────────────────────────────────
  console.log("\n── Address & Location ──");
  {
    const r = await req("GET", "/api/address/states");
    check("GET /api/address/states", r, 200);
    if (r.body.data?.length) testStateId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testStateId = r.body[0].id;
    else if (r.body.states?.length) testStateId = r.body.states[0].id;
  }
  if (testStateId) {
    const r = await req("GET", `/api/address/districts/${testStateId}`);
    check("GET /api/address/districts/:stateId", r, 200);
    if (r.body.data?.length) testDistrictId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testDistrictId = r.body[0].id;
  }
  check("GET /api/address/pincode/110001", await req("GET", "/api/address/pincode/110001"), [200, 404]);
  check("GET /pincode/110001", await req("GET", "/pincode/110001"), [200, 404]);

  // ── USER AUTH FLOW ────────────────────────────────────────
  console.log("\n── User Auth ──");
  {
    const r = await req("POST", "/auth/check-phone", { phone: "7985882700" });
    check("POST /auth/check-phone", r, 200);
  }
  {
    const r = await req("POST", "/auth/request-otp", { phone: "7985882700" });
    check("POST /auth/request-otp", r, 200, b => b.success);
    if (r.body.testOtp) console.log(`    [testOtp from server: ${r.body.testOtp}]`);
  }
  {
    const r = await req("POST", "/auth/verify-otp", { phone: "7985882700", otp: "1234" });
    check("POST /auth/verify-otp", r, 200, b => b.token || b.success);
    if (r.body.token) { userToken = r.body.token; pass("User token obtained"); }
    else fail("User token obtained", r);
  }

  // ── REGISTER NEW USER (smoke only — use unique phone) ─────
  {
    const fakePhone = "9" + String(Date.now()).slice(-9);
    const r = await req("POST", "/api/auth/register", {
      name: "SmokeUser", phone: fakePhone, role: "labour",
      age: 25, gender: "male", skills: [testSkillId || 1],
      city: "Delhi", state: "Delhi", district: "Central Delhi",
    });
    check("POST /api/auth/register (labour)", r, [200, 201, 400, 409]);
  }

  // ── ADMIN PROFILE ─────────────────────────────────────────
  console.log("\n── Admin Profile & Dashboard ──");
  check("GET /api/admin/profile", await req("GET", "/api/admin/profile", null, adminToken, true), 200);
  check("GET /api/admin/dashboard/stats", await req("GET", "/api/admin/dashboard/stats", null, adminToken, true), 200);

  // ── LABOUR CRUD ───────────────────────────────────────────
  console.log("\n── Labours ──");
  {
    const r = await req("GET", "/getAllLabour", null, userToken);
    check("GET /getAllLabour", r, 200);
    if (r.body.data?.length) testLabourId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testLabourId = r.body[0].id;
    else if (r.body.labours?.length) testLabourId = r.body.labours[0].id;
  }
  {
    const r = await req("GET", "/api/admin/labours", null, adminToken, true);
    check("GET /api/admin/labours", r, 200);
    if (!testLabourId && r.body.data?.length) testLabourId = r.body.data[0].id;
    if (!testLabourUserId && r.body.data?.length) testLabourUserId = r.body.data[0].userId;
  }
  check("GET /searchLabour?name=a", await req("GET", "/searchLabour?name=a", null, userToken), 200);
  if (testLabourId) {
    check(`GET /getLabourById/${testLabourId}`, await req("GET", `/getLabourById/${testLabourId}`, null, userToken), 200);
    check(`GET /api/admin/labours/${testLabourId}`, await req("GET", `/api/admin/labours/${testLabourId}`, null, adminToken, true), 200);
    check(`PUT /updateLabourById/${testLabourId}`, await req("PUT", `/updateLabourById/${testLabourId}`, { isAvailable: true }, userToken), [200, 201]);
    check(`PUT /api/admin/labours/${testLabourId}`, await req("PUT", `/api/admin/labours/${testLabourId}`, { status: 1 }, adminToken, true), [200, 201]);
  }
  {
    const r = await req("POST", "/api/admin/labours", {
      name: "SmokeLabour_" + Date.now(), phone: "8" + String(Date.now()).slice(-9),
      age: 22, gender: "male", city: "Delhi",
    }, adminToken, true);
    check("POST /api/admin/labours (admin create)", r, [200, 201, 400, 409]);
  }

  // ── OWNER CRUD ────────────────────────────────────────────
  console.log("\n── Owners ──");
  {
    const r = await req("GET", "/getAllOwners", null, userToken);
    check("GET /getAllOwners", r, 200);
    if (r.body.data?.length) testOwnerId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testOwnerId = r.body[0].id;
    else if (r.body.owners?.length) testOwnerId = r.body.owners[0].id;
  }
  {
    const r = await req("GET", "/api/admin/owners", null, adminToken, true);
    check("GET /api/admin/owners", r, 200);
    if (!testOwnerId && r.body.data?.length) testOwnerId = r.body.data[0].id;
  }
  if (testOwnerId) {
    check(`GET /getOwnerById/${testOwnerId}`, await req("GET", `/getOwnerById/${testOwnerId}`, null, userToken), 200);
    check(`GET /api/admin/owners/${testOwnerId}`, await req("GET", `/api/admin/owners/${testOwnerId}`, null, adminToken, true), 200);
    check(`PUT /updateOwnerById/${testOwnerId}`, await req("PUT", `/updateOwnerById/${testOwnerId}`, { isActive: true }, userToken), [200, 201]);
  }
  {
    const r = await req("POST", "/api/admin/owners", {
      name: "SmokeOwner_" + Date.now(), phone: "7" + String(Date.now()).slice(-9),
      workType: "both",
    }, adminToken, true);
    check("POST /api/admin/owners (admin create)", r, [200, 201, 400, 409]);
    if (r.body.id) testOwnerId = r.body.id;
    else if (r.body.data?.id) testOwnerId = r.body.data.id;
  }

  // ── PROVIDERS SEARCH ──────────────────────────────────────
  console.log("\n── Providers ──");
  check("GET /api/providers/search?role=labour", await req("GET", "/api/providers/search?role=labour", null, userToken), [200, 400]);
  check("GET /api/providers/count?role=labour", await req("GET", "/api/providers/count?role=labour", null, userToken), [200, 400]);
  check("GET /api/admin/providers/search?role=labour", await req("GET", "/api/admin/providers/search?role=labour", null, adminToken, true), [200, 400]);

  // ── BOOKINGS ──────────────────────────────────────────────
  console.log("\n── Bookings ──");
  {
    const r = await req("POST", "/api/bookings", {
      labourId: testLabourId || 1,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      dailyWage: 500,
      description: "Smoke test booking",
    }, userToken);
    check("POST /api/bookings", r, [200, 201, 400, 422]);
    if (r.body.id) testBookingId = r.body.id;
    else if (r.body.data?.id) testBookingId = r.body.data.id;
    else if (r.body.booking?.id) testBookingId = r.body.booking.id;
  }
  {
    const r = await req("GET", "/api/bookings", null, userToken);
    check("GET /api/bookings", r, 200);
    if (!testBookingId && r.body.data?.length) testBookingId = r.body.data[0].id;
    else if (!testBookingId && Array.isArray(r.body) && r.body.length) testBookingId = r.body[0].id;
  }
  if (testBookingId) {
    check(`GET /api/bookings/${testBookingId}`, await req("GET", `/api/bookings/${testBookingId}`, null, userToken), [200, 404]);
    check(`PUT /api/bookings/${testBookingId}/status`, await req("PUT", `/api/bookings/${testBookingId}/status`, { status: "pending" }, userToken), [200, 201, 400, 404]);
  }
  check("GET /api/admin/bookings", await req("GET", "/api/admin/bookings", null, adminToken, true), 200);

  // ── ORDERS ────────────────────────────────────────────────
  console.log("\n── Orders ──");
  {
    const r = await req("POST", "/api/orders", {
      ownerId: testOwnerId || 1,
      labourCount: 2,
      requiredProviderCount: 2,
      categoryId: 1,
      skillId: 1,
      pincode: "110001",
      pincodeId: 1,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      dailyWage: 600,
      description: "Smoke test order",
      city: "Delhi",
      state: "Delhi",
    }, userToken);
    check("POST /api/orders", r, [200, 201, 400, 422]);
    if (r.body.id) testOrderId = r.body.id;
    else if (r.body.data?.id) testOrderId = r.body.data.id;
    else if (r.body.order?.id) testOrderId = r.body.order.id;
  }
  {
    const r = await req("GET", "/api/orders", null, userToken);
    check("GET /api/orders", r, 200);
    if (!testOrderId && r.body.data?.length) testOrderId = r.body.data[0].id;
    else if (!testOrderId && Array.isArray(r.body) && r.body.length) testOrderId = r.body[0].id;
  }
  if (testOrderId) {
    check(`GET /api/orders/${testOrderId}`, await req("GET", `/api/orders/${testOrderId}`, null, userToken), [200, 404]);
    check(`GET /api/orders/owner/1`, await req("GET", "/api/orders/owner/1", null, userToken), 200);
    check(`GET /api/orders/user/7`, await req("GET", "/api/orders/user/7", null, userToken), 200);
    check(`GET /api/orders/labour/1`, await req("GET", "/api/orders/labour/1", null, userToken), 200);
    check(`PUT /api/orders/${testOrderId}/admin-status`, await req("PUT", `/api/orders/${testOrderId}/admin-status`, { status: "approved" }, adminToken, true), [200, 201, 400, 404]);
  }
  check("GET /api/admin/orders", await req("GET", "/api/admin/orders", null, adminToken, true), 200);
  if (testOrderId) {
    check(`GET /api/admin/orders/${testOrderId}`, await req("GET", `/api/admin/orders/${testOrderId}`, null, adminToken, true), [200, 404]);
    check(`PUT /api/admin/orders/${testOrderId}/approve`, await req("PUT", `/api/admin/orders/${testOrderId}/approve`, { status: "approved" }, adminToken, true), [200, 201, 400, 404]);
  }

  // ── WORK ASSIGNMENTS ──────────────────────────────────────
  console.log("\n── Work Assignments ──");
  {
    const payload = {
      title: "Smoke WA " + Date.now(),
      description: "Smoke test work assignment",
      labourCount: 1,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
      dailyWage: 500,
      ownerId: testOwnerId || 1,
      orderId: testOrderId || null,
    };
    const r = await req("POST", "/api/work-assignments", payload, userToken);
    check("POST /api/work-assignments", r, [200, 201, 400, 422]);
    if (r.body.id) testWorkAssignmentId = r.body.id;
    else if (r.body.data?.id) testWorkAssignmentId = r.body.data.id;
    else if (r.body.workAssignment?.id) testWorkAssignmentId = r.body.workAssignment.id;
    else if (r.body.assignment?.id) testWorkAssignmentId = r.body.assignment.id;
  }
  {
    const r = await req("GET", "/api/work-assignments", null, userToken);
    check("GET /api/work-assignments", r, 200);
    if (!testWorkAssignmentId && r.body.data?.length) testWorkAssignmentId = r.body.data[0].id;
    else if (!testWorkAssignmentId && Array.isArray(r.body) && r.body.length) testWorkAssignmentId = r.body[0].id;
  }
  check("GET /api/admin/work-assignments", await req("GET", "/api/admin/work-assignments", null, adminToken, true), 200);

  if (testWorkAssignmentId) {
    check(`GET /api/work-assignments/${testWorkAssignmentId}`, await req("GET", `/api/work-assignments/${testWorkAssignmentId}`, null, userToken), [200, 404]);
    check(`PUT /api/work-assignments/${testWorkAssignmentId}`, await req("PUT", `/api/work-assignments/${testWorkAssignmentId}`, { description: "updated" }, userToken), [200, 201, 400, 404]);

    // Add labour to work assignment
    {
      const r = await req("POST", `/api/work-assignments/${testWorkAssignmentId}/labours`, { labourId: testLabourId || 1, dailyWage: 500 }, userToken);
      check(`POST /api/work-assignments/${testWorkAssignmentId}/labours`, r, [200, 201, 400, 404, 409]);
      if (r.body.id) testAssignmentLabourId = r.body.id;
      else if (r.body.data?.id) testAssignmentLabourId = r.body.data.id;
    }
    check(`GET /api/work-assignments/${testWorkAssignmentId}/labours`, await req("GET", `/api/work-assignments/${testWorkAssignmentId}/labours`, null, userToken), [200, 404]);
    if (testAssignmentLabourId && testLabourId) {
      check(`PUT /api/work-assignments/${testWorkAssignmentId}/labours/${testLabourId}`, await req("PUT", `/api/work-assignments/${testWorkAssignmentId}/labours/${testLabourId}`, { dailyWage: 600 }, userToken), [200, 201, 400, 404]);
    }

    // Attendance
    const today = new Date().toISOString().split("T")[0];
    {
      const r = await req("POST", `/api/work-assignments/${testWorkAssignmentId}/attendance`, {
        labourId: testLabourId || 1,
        attendanceDate: today,
        status: "present",
      }, userToken);
      check(`POST /api/work-assignments/${testWorkAssignmentId}/attendance`, r, [200, 201, 400, 404, 409]);
      if (r.body.id) testAttendanceId = r.body.id;
      else if (r.body.data?.id) testAttendanceId = r.body.data.id;
    }
    {
      const r = await req("GET", `/api/work-assignments/${testWorkAssignmentId}/attendance`, null, userToken);
      check(`GET /api/work-assignments/${testWorkAssignmentId}/attendance`, r, [200, 404]);
    }
    if (testAttendanceId) {
      check(`PUT /api/work-assignments/${testWorkAssignmentId}/attendance/${testAttendanceId}`, await req("PUT", `/api/work-assignments/${testWorkAssignmentId}/attendance/${testAttendanceId}`, { status: "absent" }, userToken), [200, 201, 400, 404]);
    }

    // Payments
    {
      const r = await req("POST", `/api/work-assignments/${testWorkAssignmentId}/payments/generate`, {}, userToken);
      check(`POST /api/work-assignments/${testWorkAssignmentId}/payments/generate`, r, [200, 201, 400, 404]);
      if (r.body.id) testPaymentId = r.body.id;
      else if (r.body.data?.id) testPaymentId = r.body.data.id;
      else if (r.body.payment?.id) testPaymentId = r.body.payment.id;
    }
    {
      const r = await req("GET", `/api/work-assignments/${testWorkAssignmentId}/payments`, null, userToken);
      check(`GET /api/work-assignments/${testWorkAssignmentId}/payments`, r, [200, 404]);
      if (!testPaymentId && r.body.data?.length) testPaymentId = r.body.data[0].id;
    }
    if (testPaymentId) {
      check(`PUT /api/work-assignments/${testWorkAssignmentId}/payments/${testPaymentId}/status`, await req("PUT", `/api/work-assignments/${testWorkAssignmentId}/payments/${testPaymentId}/status`, { status: "paid" }, userToken), [200, 201, 400, 404]);
    }

    // Create assignment from order
    if (testOrderId) {
      check(`POST /api/orders/${testOrderId}/work-assignment`, await req("POST", `/api/orders/${testOrderId}/work-assignment`, {
        title: "WA from order " + Date.now(),
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        dailyWage: 500,
        labourCount: 1,
      }, userToken), [200, 201, 400, 404, 409]);
    }

    // Remove labour & delete
    if (testAssignmentLabourId && testLabourId) {
      check(`DELETE /api/work-assignments/${testWorkAssignmentId}/labours/${testLabourId}`, await req("DELETE", `/api/work-assignments/${testWorkAssignmentId}/labours/${testLabourId}`, null, userToken), [200, 201, 400, 404]);
    }
    check(`DELETE /api/work-assignments/${testWorkAssignmentId}`, await req("DELETE", `/api/work-assignments/${testWorkAssignmentId}`, null, userToken), [200, 201, 400, 404]);
  }

  // ── ADMIN ROLES ───────────────────────────────────────────
  console.log("\n── Admin Roles ──");
  let testAdminRoleId = 0;
  {
    const r = await req("GET", "/api/admin/roles", null, adminToken, true);
    check("GET /api/admin/roles", r, 200);
    if (r.body.data?.length) testAdminRoleId = r.body.data[0].id;
    else if (Array.isArray(r.body) && r.body.length) testAdminRoleId = r.body[0].id;
    else if (r.body.roles?.length) testAdminRoleId = r.body.roles[0].id;
  }
  {
    const r = await req("POST", "/api/admin/roles", { name: "SmokeRole_" + Date.now(), accessLevel: 5, permissions: [] }, adminToken, true);
    check("POST /api/admin/roles", r, [200, 201, 400]);
    if (r.body.id) testAdminRoleId = r.body.id;
    else if (r.body.data?.id) testAdminRoleId = r.body.data.id;
    else if (r.body.role?.id) testAdminRoleId = r.body.role.id;
  }
  if (testAdminRoleId) {
    check(`GET /api/admin/roles/${testAdminRoleId}`, await req("GET", `/api/admin/roles/${testAdminRoleId}`, null, adminToken, true), [200, 404]);
    check(`PUT /api/admin/roles/${testAdminRoleId}`, await req("PUT", `/api/admin/roles/${testAdminRoleId}`, { name: "SmokeRoleUpdated" }, adminToken, true), [200, 201, 400, 404]);
    check(`DELETE /api/admin/roles/${testAdminRoleId}`, await req("DELETE", `/api/admin/roles/${testAdminRoleId}`, null, adminToken, true), [200, 201, 400, 404, 409]);
  }
  check("GET /GetAllRoles", await req("GET", "/GetAllRoles", null, adminToken, true), 200);

  // ── ADMIN ADMINS ──────────────────────────────────────────
  console.log("\n── Admin Management ──");
  check("GET /api/admin/admins", await req("GET", "/api/admin/admins", null, adminToken, true), 200);
  check("GET /api/admin/permissions/matrix", await req("GET", "/api/admin/permissions/matrix", null, adminToken, true), 200);

  // ── SWITCH ROLE (user) ────────────────────────────────────
  console.log("\n── User Role Switch ──");
  check("POST /auth/switch-role", await req("POST", "/auth/switch-role", { role: "LABOUR" }, userToken), [200, 400, 404]);

  // ── AUTH LOGOUT ───────────────────────────────────────────
  console.log("\n── Logout ──");
  check("POST /auth/logout", await req("POST", "/auth/logout", {}, userToken), [200, 201, 400]);

  // ── CLEANUP: Delete test category/skill ───────────────────
  if (testCategoryId) await req("DELETE", `/api/categories/${testCategoryId}`, null, adminToken, true);
  if (testSkillId) await req("DELETE", `/api/skills/${testSkillId}`, null, adminToken, true);

  // ── SUMMARY ───────────────────────────────────────────────
  console.log(`\n══════════════ RESULTS ══════════════`);
  console.log(`  PASSED: ${PASSES.length}`);
  console.log(`  FAILED: ${ERRORS.length}`);
  if (ERRORS.length) {
    console.log(`\n  FAILED TESTS:`);
    ERRORS.forEach(({ label, res }) => {
      console.log(`  ✗ ${label}`);
      console.log(`    → ${res.status} | ${JSON.stringify(res.body).slice(0, 200)}`);
    });
  }
  console.log("");
}

run().catch(console.error);
