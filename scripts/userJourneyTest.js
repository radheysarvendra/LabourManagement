const http = require("http");

const port = Number(process.env.PORT || 5352);
let passed = 0;
let failed = 0;

const request = (method, path, body, token) => new Promise((resolve) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const req = http.request({
    hostname: "localhost",
    port,
    path,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, (res) => {
    let raw = "";
    res.on("data", (chunk) => { raw += chunk; });
    res.on("end", () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
      catch { resolve({ status: res.statusCode, body: raw }); }
    });
  });
  req.on("error", (error) => resolve({ status: 0, body: { message: error.message } }));
  if (payload) req.write(payload);
  req.end();
});

const expect = (name, condition, response) => {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}: ${JSON.stringify(response?.body ?? response).slice(0, 500)}`);
  }
};

const run = async () => {
  const skillsResponse = await request("GET", "/api/skills");
  const skillRows = skillsResponse.body?.data || [];
  const selectedSkills = skillRows.slice(0, 2);
  expect("skills master available", skillsResponse.status === 200 && selectedSkills.length === 2, skillsResponse);
  if (selectedSkills.length < 2) throw new Error("At least two active skills are required");

  const phone = `77${Date.now().toString().slice(-8)}`;
  const password = "Test@123";
  const ownerRegistration = await request("POST", "/api/auth/register", {
    name: "User Journey Owner",
    phone,
    password,
    role: "owner",
  });
  expect("owner registration", ownerRegistration.status === 201 && ownerRegistration.body?.token && ownerRegistration.body?.userType === "owner", ownerRegistration);

  const ownerLogin = await request("POST", "/auth/login-password", {
    phone,
    password,
    activeRole: "LABOUR",
  });
  expect("login ignores role selection and uses users.registeredAs", ownerLogin.status === 200 && ownerLogin.body?.userType === "owner", ownerLogin);

  const ownerToken = ownerLogin.body?.token;
  const first = selectedSkills[0];
  const second = selectedSkills[1];
  const labourCompletion = await request("PUT", "/api/profile/labour/skills", {
    age: 30,
    gender: "male",
    skills: [first.id, second.id, first.id],
    skillWages: {
      [first.skillName]: 801,
      [second.skillName]: 902,
    },
    experienceYears: 3,
    city: "Noida",
  }, ownerToken);
  expect("owner converts to labour with deduplicated skills", labourCompletion.status === 200 && labourCompletion.body?.skillIds?.length === 2, labourCompletion);
  expect("skill wages saved in atomic update", labourCompletion.body?.skillWages?.[first.skillName] === 801 && labourCompletion.body?.skillWages?.[second.skillName] === 902, labourCompletion);

  const labourId = labourCompletion.body?.labourId;
  const invalidUpdate = await request("PUT", "/api/profile/labour/skills", {
    skills: [99999999],
  }, ownerToken);
  expect("invalid skill returns 400", invalidUpdate.status === 400, invalidUpdate);

  const profileAfterInvalid = await request("GET", `/getLabourById/${labourId}`, undefined, ownerToken);
  const savedWages = profileAfterInvalid.body?.data?.skillWages || [];
  expect("invalid update rolls back existing skills", profileAfterInvalid.status === 200 && savedWages.length === 2, profileAfterInvalid);

  const checkPhone = await request("POST", "/auth/check-phone", { phone });
  expect("check-phone uses users table and reports labour", checkPhone.status === 200 && checkPhone.body?.exists === true && checkPhone.body?.userType === "labour", checkPhone);

  const labourLogin = await request("POST", "/auth/login-password", { phone, password });
  expect("next login opens labour without selection", labourLogin.status === 200 && labourLogin.body?.userType === "labour" && labourLogin.body?.labourId === labourId, labourLogin);

  const labourToken = labourLogin.body?.token;
  const match = await request("GET", `/api/providers/labour-match?skillId=${first.id}&isAvailable=true`, undefined, labourToken);
  expect("labour count endpoint", match.status === 200 && Number.isInteger(match.body?.data?.matchedCount), match);

  const search = await request("GET", `/api/providers/search?providerType=labour&skillId=${first.id}&page=1&limit=2`, undefined, labourToken);
  expect("provider search endpoint", search.status === 200 && search.body?.success === true, search);

  const verification = await request("GET", "/api/labour/verification/status", undefined, labourToken);
  expect("verification profile exists", verification.status === 200 && verification.body?.data?.userCode, verification);

  console.log(JSON.stringify({ passed, failed, phone, userId: labourLogin.body?.userId, labourId }, null, 2));
  process.exitCode = failed ? 1 : 0;
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
