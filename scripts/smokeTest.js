const http = require("http");

const BASE = "http://localhost:5352";
let passed = 0; let failed = 0;

const req = (method, path, body, headers = {}) => new Promise((resolve) => {
  const data = body ? JSON.stringify(body) : null;
  const opts = {
    hostname: "localhost", port: 5352,
    path, method,
    headers: { "Content-Type": "application/json", "Content-Length": data ? Buffer.byteLength(data) : 0, ...headers },
  };
  const r = http.request(opts, (res) => {
    let raw = "";
    res.on("data", (c) => raw += c);
    res.on("end", () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
      catch { resolve({ status: res.statusCode, body: raw.slice(0, 100) }); }
    });
  });
  r.on("error", (e) => resolve({ status: 0, body: { message: e.message } }));
  if (data) r.write(data);
  r.end();
});

const check = (label, status, body, okCodes = [200, 201]) => {
  const ok = okCodes.includes(status);
  const msg = (typeof body === "object" ? body.message || body.error || "" : "").slice(0, 70);
  if (ok) { passed++; console.log(`  ✅ [${status}] ${label} — ${msg}`); }
  else    { failed++; console.log(`  ❌ [${status}] ${label} — ${msg || JSON.stringify(body).slice(0,80)}`); }
  return { status, body, ok };
};

(async () => {
  const ts = Date.now();
  const phoneL = `9${String(ts).slice(-9)}`;
  const phoneO = `8${String(ts).slice(-9)}`;

  console.log("\n── HEALTH ───────────────────────────────────────────");
  check("Health",   (await req("GET", "/health")).status,     {}, [200]);
  check("API Health",(await req("GET", "/api/health")).status, {}, [200]);

  console.log("\n── AUTH — NEW FLOW ──────────────────────────────────");
  const regL = await req("POST", "/api/auth/register", { name:"TestLabour", phone:phoneL, gender:"male", age:25, role:"labour", skills:[1] });
  check("Register labour", regL.status, regL.body, [201]);
  const userToken = regL.body.token;

  const regO = await req("POST", "/api/auth/register", { name:"TestOwner", phone:phoneO, role:"owner", workType:"both" });
  check("Register owner", regO.status, regO.body, [201]);

  const dup = await req("POST", "/api/auth/register", { name:"Dup", phone:phoneL, role:"labour", skills:[1], age:25, gender:"male" });
  check("Duplicate phone → 409", dup.status, dup.body, [409]);

  console.log("\n── AUTH — OTP FLOW ──────────────────────────────────");
  const otpReq = await req("POST", "/auth/request-otp", { phone:"9873895858" });
  check("Request OTP", otpReq.status, otpReq.body, [200]);
  const testOtp = otpReq.body.testOtp || "1234";
  const otpUserType = otpReq.body.userType || (otpReq.body.roles && otpReq.body.roles[0]);

  const otpVer = await req("POST", "/auth/verify-otp", { phone:"9873895858", otp: testOtp, ...(otpUserType ? { userType: otpUserType } : {}) });
  check("Verify OTP", otpVer.status, otpVer.body, [200]);
  const otpToken = otpVer.body.token;

  console.log("\n── ORDERS ───────────────────────────────────────────");
  const orders = await req("GET", "/api/orders?limit=3", null, otpToken ? { Authorization:`Bearer ${otpToken}` } : {});
  check("Get orders (auth)", orders.status, orders.body, [200, 401]);

  console.log("\n── SKILLS / CATEGORIES ──────────────────────────────");
  check("Get skills",     (await req("GET", "/api/skills")).status,     {}, [200]);
  check("Get categories", (await req("GET", "/api/categories")).status, {}, [200]);

  console.log("\n── PLATFORM FEES ────────────────────────────────────");
  check("Labour tiers", (await req("GET", "/api/platform-fees/labour-tiers")).status, {}, [200]);

  console.log("\n── ADMIN ────────────────────────────────────────────");
  const adminLogin = await req("POST", "/api/admin/auth/login", { email:"admin@dehaddi.com", password:"admin@123" });
  check("Admin login", adminLogin.status, adminLogin.body, [200]);
  const adminToken = adminLogin.body.token;

  console.log("\n── ADMIN CRUD ───────────────────────────────────────");
  const adminH = { Authorization:`Bearer ${adminToken}` };
  const labours = await req("GET", "/api/admin/labours?limit=3", null, adminH);
  check("Admin: all labours", labours.status, labours.body, [200]);
  if (labours.body.data?.[0]) {
    const l = labours.body.data[0];
    console.log(`     sample: id=${l.id}, name=${l.name}, phone=${l.phone}`);
  }

  const owners = await req("GET", "/api/admin/owners?limit=3", null, adminH);
  check("Admin: all owners", owners.status, owners.body, [200]);
  if (owners.body.data?.[0]) {
    const o = owners.body.data[0];
    console.log(`     sample: id=${o.id}, name=${o.name}, phone=${o.phone}`);
  }

  const ownerSearch = await req("GET", "/api/admin/owners?search=ram&limit=2", null, adminH);
  check("Search owners (ram)", ownerSearch.status, ownerSearch.body, [200]);

  const labourSearch = await req("GET", "/api/admin/labours?search=ram&limit=2", null, adminH);
  check("Search labours (ram)", labourSearch.status, labourSearch.body, [200]);

  console.log(`\n── RESULT: ${passed} passed, ${failed} failed ──────────────────`);
  process.exit(failed > 0 ? 1 : 0);
})();
