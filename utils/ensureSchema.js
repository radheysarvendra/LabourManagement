const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);

  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`Added missing column ${tableName}.${columnName}`);
  }
};

const ensureIndex = async (queryInterface, tableName, fields, name, options = {}) => {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => index.name === name);

  if (!exists) {
    await queryInterface.addIndex(tableName, fields, { name, ...options });
    console.log(`Added missing index ${name}`);
  }
};

const ensureEnumValues = async (sequelize, enumName, values) => {
  for (const value of values) {
    await sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}';
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END
      $$;
    `);
  }
};

const dropConstraintIfExists = async (sequelize, table, constraint) => {
  await sequelize.query(`
    ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}";
  `);
};

const ensureTable = async (sequelize, tableName, createSQL) => {
  try {
    await sequelize.query(`SELECT 1 FROM "${tableName}" LIMIT 1`);
  } catch (e) {
    await sequelize.query(createSQL);
    console.log(`Created table ${tableName}`);
  }
};

const ensureSchema = async (db) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const userTypeEnumValues = [
    "labour",
    "owner",
    "contractor",
    "contractor_customer",
  ];
  const stringColumn = {
    type: db.Sequelize.STRING,
    allowNull: true,
  };
  const textColumn = {
    type: db.Sequelize.TEXT,
    allowNull: true,
  };
  const registeredFromEnum = { type: db.Sequelize.STRING, allowNull: true };
  const labourColumns = {
    userId: { type: db.Sequelize.INTEGER, allowNull: true },
    registeredFrom: registeredFromEnum,
    labourCode: { type: db.Sequelize.STRING, allowNull: true, unique: true },
    isAvailable: { type: db.Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    isVerified: { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    experienceYears: { type: db.Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    createdById: { type: db.Sequelize.INTEGER, allowNull: true },
    updatedById: { type: db.Sequelize.INTEGER, allowNull: true },
  };
  const ownerColumns = {
    userId: { type: db.Sequelize.INTEGER, allowNull: true },
    registeredFrom: registeredFromEnum,
    categoryId: { type: db.Sequelize.INTEGER, allowNull: true },
    skillId: { type: db.Sequelize.INTEGER, allowNull: true },
    createdById: { type: db.Sequelize.INTEGER, allowNull: true },
    updatedById: { type: db.Sequelize.INTEGER, allowNull: true },
  };
  const categoryColumns = {
    hindi: stringColumn,
    icon: stringColumn,
    color: stringColumn,
    isActive: { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  };
  const skillColumns = {
    hindi: stringColumn,
    category: stringColumn,
    isActive: { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  };
  const categorySkillColumns = {
    isActive: { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  };
  const labourSkillColumns = {
    labourUserId: { type: db.Sequelize.INTEGER, allowNull: true },
  };
  const orderColumns = {
    categoryId: { type: db.Sequelize.INTEGER, allowNull: true },
    skillId: { type: db.Sequelize.INTEGER, allowNull: true },
    address: textColumn,
    requiredDate: { type: db.Sequelize.DATEONLY, allowNull: true },
    needType: { type: db.Sequelize.ENUM("labour", "contractor"), allowNull: false, defaultValue: "labour" },
    assignedType: { type: db.Sequelize.ENUM("labour", "contractor"), allowNull: true },
    ownerName: stringColumn,
    ownerPhone: stringColumn,
    paymentStatus:  { type: db.Sequelize.STRING(20), allowNull: true },
    paymentMethod:  { type: db.Sequelize.STRING(20), allowNull: true },
    paidAmount:     { type: db.Sequelize.FLOAT,       allowNull: true },
    transactionId:  { type: db.Sequelize.STRING,      allowNull: true },
    upiRef:         { type: db.Sequelize.STRING,      allowNull: true },
    orderPaidAt:    { type: db.Sequelize.DATE,        allowNull: true },
  };
  const bookingColumns = {
    requiredDate: { type: db.Sequelize.DATEONLY, allowNull: true },
  };
  const orderMappingColumns = {
    userId: { type: db.Sequelize.INTEGER, allowNull: true },
  };

  // Create users table (unified identity — one row per person regardless of role)
  await ensureTable(db.sequelize, "users", `
    CREATE TABLE "users" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(255) NOT NULL UNIQUE,
      "registeredAs" VARCHAR(50) NOT NULL DEFAULT 'labour',
      "profileImage" VARCHAR(255),
      status INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Add personal/location columns to users (moved from labours/owners)
  const userPersonalColumns = {
    age:          { type: db.Sequelize.INTEGER, allowNull: true },
    gender:       { type: db.Sequelize.STRING(10), allowNull: true },
    city:         { type: db.Sequelize.STRING, allowNull: true },
    village:     { type: db.Sequelize.STRING, allowNull: true },
    district:    { type: db.Sequelize.STRING, allowNull: true },
    state:       { type: db.Sequelize.STRING, allowNull: true },
    stateId:     { type: db.Sequelize.INTEGER, allowNull: true },
    districtId:  { type: db.Sequelize.INTEGER, allowNull: true },
    pincode:     { type: db.Sequelize.STRING, allowNull: true },
    pincodeId:   { type: db.Sequelize.INTEGER, allowNull: true },
    postOffice:  { type: db.Sequelize.STRING, allowNull: true },
    postOfficeId:{ type: db.Sequelize.INTEGER, allowNull: true },
    area:        { type: db.Sequelize.STRING, allowNull: true },
    address:     { type: db.Sequelize.TEXT, allowNull: true },
    isActive:       { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    accountStatus:  { type: db.Sequelize.STRING(20), allowNull: false, defaultValue: "active" },
    deletedAt:      { type: db.Sequelize.DATE, allowNull: true },
  };
  for (const [col, def] of Object.entries(userPersonalColumns)) {
    await ensureColumn(queryInterface, "users", col, def);
  }

  await ensureColumn(queryInterface, "orders", "createdByUserId", {
    type: db.Sequelize.INTEGER,
    allowNull: true,
    references: { model: "users", key: "id" },
  });

  // Copy personal/location data from labours → users (fill nulls only)
  try {
    await db.sequelize.query(`
      UPDATE "users" u
      SET
        age          = COALESCE(u.age,         l.age),
        gender       = COALESCE(u.gender, l.gender::text),
        "profileImage" = COALESCE(u."profileImage", l."profileImage"),
        city         = COALESCE(u.city,        l.city),
        village      = COALESCE(u.village,     l.village),
        district     = COALESCE(u.district,    l.district),
        state        = COALESCE(u.state,       l.state),
        "stateId"    = COALESCE(u."stateId",   l."stateId"),
        "districtId" = COALESCE(u."districtId",l."districtId"),
        pincode      = COALESCE(u.pincode,     l.pincode),
        "pincodeId"  = COALESCE(u."pincodeId", l."pincodeId"),
        "postOffice" = COALESCE(u."postOffice",l."postOffice"),
        "postOfficeId" = COALESCE(u."postOfficeId", l."postOfficeId"),
        area         = COALESCE(u.area,        l.area),
        address      = COALESCE(u.address,     l.address)
      FROM "labours" l
      WHERE l."userId" = u.id
    `);
    console.log("Copied labours personal data → users");
  } catch (e) {
    console.warn("labours → users personal data copy skipped:", e.message);
  }

  // Copy personal/location data from owners → users (fill nulls only)
  try {
    await db.sequelize.query(`
      UPDATE "users" u
      SET
        age          = COALESCE(u.age,         o.age),
        gender       = COALESCE(u.gender, o.gender::text),
        "profileImage" = COALESCE(u."profileImage", o."profileImage"),
        city         = COALESCE(u.city,        o.city),
        village      = COALESCE(u.village,     o.village),
        district     = COALESCE(u.district,    o.district),
        state        = COALESCE(u.state,       o.state),
        pincode      = COALESCE(u.pincode,     o.pincode),
        "postOffice" = COALESCE(u."postOffice",o."postOffice"),
        area         = COALESCE(u.area,        o.area),
        address      = COALESCE(u.address,     o.address)
      FROM "owners" o
      WHERE o."userId" = u.id
    `);
    console.log("Copied owners personal data → users");
  } catch (e) {
    console.warn("owners → users personal data copy skipped:", e.message);
  }

  // Migrate labours → users (creates user row for every labour that doesn't have one yet)
  try {
    await db.sequelize.query(`
      INSERT INTO "users" (name, phone, "registeredAs", "profileImage", status, "createdAt", "updatedAt")
      SELECT DISTINCT ON (phone)
        name, phone, COALESCE("registeredFrom", 'labour'), "profileImage", status, "createdAt", "updatedAt"
      FROM "labours"
      WHERE phone NOT IN (SELECT phone FROM "users")
      ON CONFLICT (phone) DO NOTHING
    `);
    await db.sequelize.query(`
      UPDATE "labours" l SET "userId" = u.id
      FROM "users" u
      WHERE l.phone = u.phone AND l."userId" IS NULL
    `);
    console.log("Migrated labours → users");
  } catch (e) {
    console.warn("labours → users migration skipped:", e.message);
  }

  // Migrate owners → users (merge by phone, skip if already exists from labours)
  try {
    await db.sequelize.query(`
      INSERT INTO "users" (name, phone, "registeredAs", "profileImage", status, "createdAt", "updatedAt")
      SELECT DISTINCT ON (phone)
        name, phone, COALESCE("registeredFrom", 'owner'), "profileImage", 1, "createdAt", "updatedAt"
      FROM "owners"
      WHERE phone NOT IN (SELECT phone FROM "users")
      ON CONFLICT (phone) DO NOTHING
    `);
    await db.sequelize.query(`
      UPDATE "owners" o SET "userId" = u.id
      FROM "users" u
      WHERE o.phone = u.phone AND o."userId" IS NULL
    `);
    console.log("Migrated owners → users");
  } catch (e) {
    console.warn("owners → users migration skipped:", e.message);
  }

  await dropConstraintIfExists(db.sequelize, "orderMappings", "orderMappings_ownerId_fkey");
  await dropConstraintIfExists(db.sequelize, "workAssignments", "workAssignments_ownerId_fkey");
  try {
    await db.sequelize.query(`ALTER TABLE "workAssignments" ALTER COLUMN "ownerId" DROP NOT NULL`);
    await db.sequelize.query(`ALTER TABLE "workAssignments" ALTER COLUMN "orderId" DROP NOT NULL`);
  } catch (e) {
    console.warn("workAssignments NOT NULL drop skipped:", e.message);
  }

  // convert users.gender from ENUM → VARCHAR so it matches the new STRING model
  try {
    await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "gender" TYPE VARCHAR(10) USING gender::text`);
    console.log("Converted users.gender ENUM → VARCHAR");
  } catch (e) {
    // already VARCHAR or column doesn't exist — both are fine
  }

  // convert workAttendances.status and markedByType from ENUM → VARCHAR
  try {
    await db.sequelize.query(`ALTER TABLE "workAttendances" ALTER COLUMN "status" TYPE VARCHAR(20) USING status::text`);
    console.log("Converted workAttendances.status ENUM → VARCHAR");
  } catch (e) {
    // already VARCHAR, column doesn't exist, or no rows — all fine
  }
  try {
    await db.sequelize.query(`ALTER TABLE "workAttendances" ALTER COLUMN "markedByType" TYPE VARCHAR(20) USING "markedByType"::text`);
    console.log("Converted workAttendances.markedByType ENUM → VARCHAR");
  } catch (e) {
    // already VARCHAR or column doesn't exist — fine
  }

  await ensureEnumValues(db.sequelize, "enum_authOtps_userType", userTypeEnumValues);
  await ensureEnumValues(db.sequelize, "enum_mobile_token_maps_userType", userTypeEnumValues);
  await ensureEnumValues(db.sequelize, "enum_orders_status", ["assigned", "confirmed"]);
  await ensureEnumValues(db.sequelize, "enum_orderMappings_userType", ["contractor"]);

  for (const [columnName, definition] of Object.entries(labourColumns)) {
    await ensureColumn(queryInterface, "labours", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(ownerColumns)) {
    await ensureColumn(queryInterface, "owners", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(categoryColumns)) {
    await ensureColumn(queryInterface, "categories", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(skillColumns)) {
    await ensureColumn(queryInterface, "skills", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(categorySkillColumns)) {
    await ensureColumn(queryInterface, "categorySkills", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(labourSkillColumns)) {
    await ensureColumn(queryInterface, "labourSkills", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(orderColumns)) {
    await ensureColumn(queryInterface, "orders", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(bookingColumns)) {
    await ensureColumn(queryInterface, "bookings", columnName, definition);
  }

  for (const [columnName, definition] of Object.entries(orderMappingColumns)) {
    await ensureColumn(queryInterface, "orderMappings", columnName, definition);
  }

  // Rename legacy "want_labour" registeredFrom value to "owner" in both tables
  try {
    await db.sequelize.query(`UPDATE "owners" SET "registeredFrom" = 'owner' WHERE "registeredFrom" = 'want_labour'`);
    await db.sequelize.query(`UPDATE "labours" SET "registeredFrom" = 'owner' WHERE "registeredFrom" = 'want_labour'`);
    console.log("Migrated registeredFrom: want_labour → owner");
  } catch (e) {
    console.warn("registeredFrom migration skipped:", e.message);
  }

  // Backfill ownerName/ownerPhone on orders created before denormalization was added.
  // For new-flow orders (ownerId=null, userId set): checks labours first, then owners.
  // For old-flow orders (ownerId set): joins owners directly.
  // NULLIF treats empty strings as NULL so they get overwritten too.
  try {
    await db.sequelize.query(`
      UPDATE "orders" AS o
      SET
        "ownerName"  = COALESCE(NULLIF(o."ownerName",  ''), u.name),
        "ownerPhone" = COALESCE(NULLIF(o."ownerPhone", ''), u.phone)
      FROM "orderMappings" AS m
      LEFT JOIN "users" AS u ON u.id = m."userId"
      WHERE m."orderId" = o.id
        AND m."userType" = 'owner'
        AND (NULLIF(o."ownerName", '') IS NULL OR NULLIF(o."ownerPhone", '') IS NULL)
    `);
    console.log("Backfilled ownerName/ownerPhone on orders");
  } catch (e) {
    console.warn("Order ownerName backfill skipped:", e.message);
  }

  // location indexes on labours — column may not exist on fresh installs (location now in users)
  for (const [fields, name] of [
    [["stateId"],     "idx_labours_state_id"],
    [["districtId"],  "idx_labours_district_id"],
    [["pincodeId"],   "idx_labours_pincode_id"],
    [["postOfficeId"],"idx_labours_post_office_id"],
    [["pincode"],     "idx_labours_pincode"],
  ]) { try { await ensureIndex(queryInterface, "labours", fields, name); } catch (e) { /* column not present */ } }

  await ensureIndex(queryInterface, "labours", ["isVerified"], "idx_labours_is_verified");
  await ensureIndex(queryInterface, "labours", ["labourCode"], "idx_labours_labour_code");
  await ensureIndex(queryInterface, "labourSkills", ["skillId"], "idx_labour_skills_skill_id");
  await ensureIndex(queryInterface, "labourSkills", ["labourId"], "idx_labour_skills_labour_id");
  await ensureIndex(queryInterface, "labourSkills", ["labourUserId"], "idx_labour_skills_labour_user_id");
  await ensureIndex(queryInterface, "orders", ["requiredDate"], "idx_orders_required_date");
  await ensureIndex(queryInterface, "orders", ["categoryId"], "idx_orders_category_id");
  await ensureIndex(queryInterface, "orders", ["skillId"], "idx_orders_skill_id");
  await ensureIndex(queryInterface, "orders", ["needType"], "idx_orders_need_type");
  await ensureIndex(queryInterface, "bookings", ["requiredDate"], "idx_bookings_required_date");
  await ensureIndex(queryInterface, "orderMappings", ["userId"], "idx_order_mappings_user_id");
  await ensureIndex(queryInterface, "owners", ["categoryId"], "idx_owners_category_id");
  await ensureIndex(queryInterface, "owners", ["skillId"], "idx_owners_skill_id");
  try {
    await ensureIndex(
      queryInterface,
      "workAssignmentLabours",
      ["workAssignmentId", "labourId"],
      "work_assignment_labours_unique_assignment_labour",
      { unique: true }
    );
  } catch (e) {
    console.warn("Could not add unique index on workAssignmentLabours (duplicate rows may exist):", e.message);
  }

  // ── NEW SCHEMA TABLES ────────────────────────────────────────────────────────

  await ensureTable(db.sequelize, "appRoles", `
    CREATE TABLE IF NOT EXISTS "appRoles" (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ensureTable(db.sequelize, "userRoles", `
    CREATE TABLE IF NOT EXISTS "userRoles" (
      "userId" INTEGER NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
      "roleId" INTEGER NOT NULL REFERENCES "appRoles"(id) ON DELETE CASCADE,
      "profileStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("userId", "roleId")
    )
  `);

  await ensureTable(db.sequelize, "labourProfiles", `
    CREATE TABLE IF NOT EXISTS "labourProfiles" (
      "userId" INTEGER PRIMARY KEY REFERENCES "users"(id) ON DELETE CASCADE,
      "labourCode" VARCHAR(255) UNIQUE,
      "experienceYears" INTEGER NOT NULL DEFAULT 0,
      "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
      "verificationStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "verifiedByAdminId" INTEGER,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMP
    )
  `);

  await ensureTable(db.sequelize, "contractorProfiles", `
    CREATE TABLE IF NOT EXISTS "contractorProfiles" (
      "userId" INTEGER PRIMARY KEY REFERENCES "users"(id) ON DELETE CASCADE,
      "contractorCode" VARCHAR(255) UNIQUE,
      "companyName" VARCHAR(255),
      "gstNumber" VARCHAR(20),
      "experienceYears" INTEGER NOT NULL DEFAULT 0,
      "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
      "verificationStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "verifiedByAdminId" INTEGER,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMP
    )
  `);

  await ensureTable(db.sequelize, "contractorSkills", `
    CREATE TABLE IF NOT EXISTS "contractorSkills" (
      "contractorUserId" INTEGER NOT NULL REFERENCES "contractorProfiles"("userId") ON DELETE CASCADE,
      "skillId" INTEGER NOT NULL REFERENCES "skills"(id) ON DELETE CASCADE,
      "experienceYears" INTEGER NOT NULL DEFAULT 0,
      rate DECIMAL(12, 2),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("contractorUserId", "skillId")
    )
  `);

  await ensureTable(db.sequelize, "contractorCategories", `
    CREATE TABLE IF NOT EXISTS "contractorCategories" (
      "contractorUserId" INTEGER NOT NULL REFERENCES "contractorProfiles"("userId") ON DELETE CASCADE,
      "categoryId" INTEGER NOT NULL REFERENCES "categories"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("contractorUserId", "categoryId")
    )
  `);

  await ensureTable(db.sequelize, "sessions", `
    CREATE TABLE IF NOT EXISTS "sessions" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" INTEGER NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
      "activeRoleId" INTEGER NOT NULL REFERENCES "appRoles"(id),
      "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
      "deviceId" VARCHAR(255),
      "expiresAt" TIMESTAMP NOT NULL,
      "revokedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ensureTable(db.sequelize, "orderAssignments", `
    CREATE TABLE IF NOT EXISTS "orderAssignments" (
      id SERIAL PRIMARY KEY,
      "orderId" INTEGER NOT NULL REFERENCES "orders"(id) ON DELETE CASCADE,
      "providerUserId" INTEGER NOT NULL,
      "providerRoleId" INTEGER NOT NULL,
      "assignmentStatus" VARCHAR(20) NOT NULL DEFAULT 'assigned',
      "adminStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "assignedByAdminId" INTEGER,
      "assignedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMP,
      UNIQUE ("orderId", "providerUserId", "providerRoleId")
    )
  `);

  await ensureTable(db.sequelize, "labourAssignmentDetails", `
    CREATE TABLE IF NOT EXISTS "labourAssignmentDetails" (
      "assignmentId" INTEGER PRIMARY KEY REFERENCES "orderAssignments"(id) ON DELETE CASCADE,
      "skillId" INTEGER REFERENCES "skills"(id),
      "dailyWage" DECIMAL(10, 2),
      "startDate" DATE,
      "endDate" DATE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ensureTable(db.sequelize, "contractorAssignmentDetails", `
    CREATE TABLE IF NOT EXISTS "contractorAssignmentDetails" (
      "assignmentId" INTEGER PRIMARY KEY REFERENCES "orderAssignments"(id) ON DELETE CASCADE,
      "categoryId" INTEGER REFERENCES "categories"(id),
      "contractFee" DECIMAL(12, 2),
      "startDate" DATE,
      "endDate" DATE,
      "paymentTermType" VARCHAR(20),
      "paymentTerms" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ensureTable(db.sequelize, "contractorMilestones", `
    CREATE TABLE IF NOT EXISTS "contractorMilestones" (
      id SERIAL PRIMARY KEY,
      "assignmentId" INTEGER NOT NULL REFERENCES "orderAssignments"(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      amount DECIMAL(10, 2),
      "dueDate" DATE,
      "milestoneStatus" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "completedAt" TIMESTAMP,
      "verifiedAt" TIMESTAMP,
      "verifiedByUserId" INTEGER,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ensureTable(db.sequelize, "providerRatingSummaries", `
    CREATE TABLE IF NOT EXISTS "providerRatingSummaries" (
      "userId" INTEGER NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
      "roleCode" VARCHAR(20) NOT NULL,
      "averageRating" DECIMAL(3, 2) NOT NULL DEFAULT 0,
      "totalRatings" INTEGER NOT NULL DEFAULT 0,
      "fiveStarCount" INTEGER NOT NULL DEFAULT 0,
      "fourStarCount" INTEGER NOT NULL DEFAULT 0,
      "threeStarCount" INTEGER NOT NULL DEFAULT 0,
      "twoStarCount" INTEGER NOT NULL DEFAULT 0,
      "oneStarCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("userId", "roleCode")
    )
  `);

  // Enforce normalized identity and assignment integrity at database level.
  await db.sequelize.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_assignment_user_role') THEN
        ALTER TABLE "orderAssignments"
          ADD CONSTRAINT "fk_order_assignment_user_role"
          FOREIGN KEY ("providerUserId", "providerRoleId")
          REFERENCES "userRoles" ("userId", "roleId");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_user_role') THEN
        ALTER TABLE "sessions"
          ADD CONSTRAINT "fk_session_user_role"
          FOREIGN KEY ("userId", "activeRoleId")
          REFERENCES "userRoles" ("userId", "roleId");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_account_status') THEN
        ALTER TABLE "users" ADD CONSTRAINT "ck_user_account_status"
          CHECK ("accountStatus" IN ('active', 'suspended', 'deleted'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_role_profile_status') THEN
        ALTER TABLE "userRoles" ADD CONSTRAINT "ck_user_role_profile_status"
          CHECK ("profileStatus" IN ('pending', 'complete', 'suspended'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_order_assignment_status') THEN
        ALTER TABLE "orderAssignments" ADD CONSTRAINT "ck_order_assignment_status"
          CHECK ("assignmentStatus" IN ('pending','assigned','accepted','in_progress','completed','rejected','cancelled'));
      END IF;
    END $$;
  `);

  await db.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_labour_skills_user_skill"
      ON "labourSkills" ("labourUserId", "skillId")
      WHERE "labourUserId" IS NOT NULL
  `);
  try {
    await db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_work_attendance_assignment_date"
        ON "workAttendances" ("assignmentId", "attendanceDate")
        WHERE "assignmentId" IS NOT NULL
    `);
  } catch (e) { /* column not yet added — ensureColumn will handle it */ }

  // Backfill labourCode for existing labours that have NULL labourCode
  try {
    const nullCodes = await db.sequelize.query(
      `SELECT id FROM "labours" WHERE "labourCode" IS NULL`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    for (const row of nullCodes) {
      let code = null;
      for (let i = 0; i < 8; i++) {
        const candidate = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
        const [exists] = await db.sequelize.query(
          `SELECT 1 FROM "labours" WHERE "labourCode" = :code LIMIT 1`,
          { replacements: { code: candidate }, type: db.Sequelize.QueryTypes.SELECT }
        );
        if (!exists) { code = candidate; break; }
      }
      if (!code) code = `LAB-${Date.now().toString().slice(-6)}`;
      await db.sequelize.query(`UPDATE "labours" SET "labourCode" = :code WHERE id = :id`, { replacements: { code, id: row.id } });
    }
    if (nullCodes.length > 0) console.log(`Backfilled labourCode for ${nullCodes.length} labours`);
  } catch (e) { console.warn("labourCode backfill skipped:", e.message); }

  // Remove name/phone from labours and owners — now canonical in users table only
  for (const col of ["name", "phone"]) {
    try { await db.sequelize.query(`ALTER TABLE "labours" DROP COLUMN IF EXISTS "${col}"`); } catch (e) { /* already gone */ }
    try { await db.sequelize.query(`ALTER TABLE "owners"  DROP COLUMN IF EXISTS "${col}"`); } catch (e) { /* already gone */ }
  }

  // Remove isActive + status from owners, status from labours — now canonical in users table only
  for (const col of ["isActive", "status"]) {
    try { await db.sequelize.query(`ALTER TABLE "owners" DROP COLUMN IF EXISTS "${col}"`); } catch (e) { /* already gone */ }
  }
  try { await db.sequelize.query(`ALTER TABLE "labours" DROP COLUMN IF EXISTS "status"`); } catch (e) { /* already gone */ }

  // Drop NOT NULL constraints on authOtps columns that the new model no longer provides
  try {
    await db.sequelize.query(`ALTER TABLE "authOtps" ALTER COLUMN "userType" DROP NOT NULL`);
  } catch (e) { /* already nullable */ }
  try {
    await db.sequelize.query(`ALTER TABLE "authOtps" ALTER COLUMN "userId" DROP NOT NULL`);
  } catch (e) { /* already nullable */ }

  // age and gender now live in users table; keep copies in labours/owners but make nullable
  try {
    await db.sequelize.query(`ALTER TABLE "labours" ALTER COLUMN "age" DROP NOT NULL`);
    await db.sequelize.query(`ALTER TABLE "labours" ALTER COLUMN "gender" DROP NOT NULL`);
  } catch (e) { /* already nullable */ }

  // Add new columns to authOtps (verifiedAt replaces old boolean verified; attempts is new)
  const authOtpNewColumns = {
    verifiedAt: { type: db.Sequelize.DATE, allowNull: true },
    attempts:   { type: db.Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    purpose:    { type: db.Sequelize.STRING(30), allowNull: false, defaultValue: "login" },
  };
  for (const [col, def] of Object.entries(authOtpNewColumns)) {
    await ensureColumn(queryInterface, "authOtps", col, def);
  }

  // Add new columns to workAttendances (new-flow columns alongside old-flow)
  const workAttendanceNewColumns = {
    assignmentId:    { type: db.Sequelize.INTEGER, allowNull: true },
    attendanceStatus:{ type: db.Sequelize.STRING(20), allowNull: true, defaultValue: "present" },
    markedByUserId:  { type: db.Sequelize.INTEGER, allowNull: true },
    note:            { type: db.Sequelize.TEXT, allowNull: true },
  };
  for (const [col, def] of Object.entries(workAttendanceNewColumns)) {
    await ensureColumn(queryInterface, "workAttendances", col, def);
  }

  // Add UPI payment tracking columns to orderPayments
  const orderPaymentUpiColumns = {
    transactionId: { type: db.Sequelize.STRING, allowNull: true },
    upiRef:        { type: db.Sequelize.STRING, allowNull: true },
    paymentMethod: { type: db.Sequelize.STRING(20), allowNull: true, defaultValue: "upi" },
  };
  for (const [col, def] of Object.entries(orderPaymentUpiColumns)) {
    await ensureColumn(queryInterface, "orderPayments", col, def);
  }

  // Add UPI payment tracking columns to contractorLeads
  const contractorLeadUpiColumns = {
    transactionId: { type: db.Sequelize.STRING, allowNull: true },
    upiRef:        { type: db.Sequelize.STRING, allowNull: true },
  };
  for (const [col, def] of Object.entries(contractorLeadUpiColumns)) {
    await ensureColumn(queryInterface, "contractorLeads", col, def);
  }

  // Seed default app roles
  try {
    await db.sequelize.query(`
      INSERT INTO "appRoles" (code, name, "createdAt", "updatedAt")
      VALUES
        ('LABOUR', 'Labour', NOW(), NOW()),
        ('OWNER', 'Owner', NOW(), NOW()),
        ('CONTRACTOR', 'Contractor', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `);
    console.log("Seeded default appRoles");
  } catch (e) {
    console.warn("appRoles seeding skipped:", e.message);
  }

  // Migrate existing labours → labourProfiles
  try {
    await db.sequelize.query(`
      INSERT INTO "labourProfiles" ("userId", "labourCode", "experienceYears", "isAvailable", "verificationStatus", "createdAt", "updatedAt")
      SELECT
        l."userId",
        l."labourCode",
        COALESCE(l."experienceYears", 0),
        COALESCE(l."isAvailable", true),
        CASE WHEN COALESCE(l."isVerified", false) THEN 'verified' ELSE 'pending' END,
        l."createdAt",
        l."updatedAt"
      FROM "labours" l
      WHERE l."userId" IS NOT NULL
        AND (l."registeredFrom" = 'labour' OR l."registeredFrom" IS NULL)
      ON CONFLICT ("userId") DO NOTHING
    `);
    console.log("Migrated labours → labourProfiles");
  } catch (e) {
    console.warn("labours → labourProfiles migration skipped:", e.message);
  }

  // Migrate existing owners (registeredFrom=contractor) → contractorProfiles
  try {
    await db.sequelize.query(`
      INSERT INTO "contractorProfiles" ("userId", "experienceYears", "isAvailable", "verificationStatus", "createdAt", "updatedAt")
      SELECT
        o."userId",
        0,
        COALESCE(o."isActive", true),
        'pending',
        o."createdAt",
        o."updatedAt"
      FROM "owners" o
      WHERE o."userId" IS NOT NULL
        AND o."registeredFrom" = 'contractor'
      ON CONFLICT ("userId") DO NOTHING
    `);
    console.log("Migrated contractor owners → contractorProfiles");
  } catch (e) {
    console.warn("owners → contractorProfiles migration skipped:", e.message);
  }

  // Seed userRoles for existing labours
  try {
    await db.sequelize.query(`
      INSERT INTO "userRoles" ("userId", "roleId", "profileStatus", "createdAt")
      SELECT l."userId", ar.id, 'complete', NOW()
      FROM "labours" l
      JOIN "appRoles" ar ON ar.code = 'LABOUR'
      WHERE l."userId" IS NOT NULL
        AND (l."registeredFrom" = 'labour' OR l."registeredFrom" IS NULL)
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `);
    console.log("Seeded userRoles for labours");
  } catch (e) {
    console.warn("labours → userRoles seeding skipped:", e.message);
  }

  // Seed userRoles for existing owners (registeredFrom=owner)
  try {
    await db.sequelize.query(`
      INSERT INTO "userRoles" ("userId", "roleId", "profileStatus", "createdAt")
      SELECT o."userId", ar.id, 'complete', NOW()
      FROM "owners" o
      JOIN "appRoles" ar ON ar.code = 'OWNER'
      WHERE o."userId" IS NOT NULL
        AND o."registeredFrom" = 'owner'
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `);
    console.log("Seeded userRoles for owners");
  } catch (e) {
    console.warn("owners → userRoles seeding skipped:", e.message);
  }

  // Seed userRoles for existing contractors (registeredFrom=contractor)
  try {
    await db.sequelize.query(`
      INSERT INTO "userRoles" ("userId", "roleId", "profileStatus", "createdAt")
      SELECT o."userId", ar.id, 'complete', NOW()
      FROM "owners" o
      JOIN "appRoles" ar ON ar.code = 'CONTRACTOR'
      WHERE o."userId" IS NOT NULL
        AND o."registeredFrom" = 'contractor'
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `);
    console.log("Seeded userRoles for contractors");
  } catch (e) {
    console.warn("contractors → userRoles seeding skipped:", e.message);
  }

  // Migrate contractorSkills from owners (skillId + categoryId)
  try {
    await db.sequelize.query(`
      INSERT INTO "contractorSkills" ("contractorUserId", "skillId", "createdAt", "updatedAt")
      SELECT o."userId", o."skillId", NOW(), NOW()
      FROM "owners" o
      WHERE o."userId" IS NOT NULL
        AND o."registeredFrom" = 'contractor'
        AND o."skillId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "contractorProfiles" cp WHERE cp."userId" = o."userId")
      ON CONFLICT ("contractorUserId", "skillId") DO NOTHING
    `);
    console.log("Migrated contractorSkills from owners");
  } catch (e) {
    console.warn("contractorSkills migration skipped:", e.message);
  }

  // Migrate contractorCategories from owners (categoryId)
  try {
    await db.sequelize.query(`
      INSERT INTO "contractorCategories" ("contractorUserId", "categoryId", "createdAt", "updatedAt")
      SELECT o."userId", o."categoryId", NOW(), NOW()
      FROM "owners" o
      WHERE o."userId" IS NOT NULL
        AND o."registeredFrom" = 'contractor'
        AND o."categoryId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "contractorProfiles" cp WHERE cp."userId" = o."userId")
      ON CONFLICT ("contractorUserId", "categoryId") DO NOTHING
    `);
    console.log("Migrated contractorCategories from owners");
  } catch (e) {
    console.warn("contractorCategories migration skipped:", e.message);
  }

  // Labour verification columns (added for the verification flow)
  const labourVerificationColumns = {
    aadharNumber:            { type: db.Sequelize.STRING(20), allowNull: true },
    documentUrl:             { type: db.Sequelize.TEXT,       allowNull: true },
    rejectionReason:         { type: db.Sequelize.TEXT,       allowNull: true },
    verificationSubmittedAt: { type: db.Sequelize.DATE,       allowNull: true },
    cloudinaryPublicId:      { type: db.Sequelize.TEXT,       allowNull: true },
    photoUrl:                { type: db.Sequelize.TEXT,       allowNull: true },
    photoCloudinaryPublicId: { type: db.Sequelize.TEXT,       allowNull: true },
    isLocked:                { type: db.Sequelize.BOOLEAN,    allowNull: false, defaultValue: false },
  };
  for (const [col, def] of Object.entries(labourVerificationColumns)) {
    await ensureColumn(queryInterface, "labourProfiles", col, def);
  }

  // ratings table columns/indexes — table may not exist yet on first deploy (Sequelize sync creates it)
  try {
    await ensureColumn(queryInterface, "ratings", "assignmentId", { type: db.Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, "ratings", "workAssignmentId", { type: db.Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, "ratings", "ratedRoleCode", { type: db.Sequelize.STRING(20), allowNull: true });
    await ensureIndex(queryInterface, "ratings", ["orderId"], "idx_ratings_order_id");
    await ensureIndex(queryInterface, "ratings", ["assignmentId"], "idx_ratings_assignment_id");
    await ensureIndex(queryInterface, "ratings", ["ratedUserId"], "idx_ratings_rated_user_id");
    await db.sequelize.query(`DROP INDEX IF EXISTS "uq_rating_per_ratee_per_order"`);
    await db.sequelize.query(`ALTER TABLE "ratings" DROP CONSTRAINT IF EXISTS "uq_rating_per_ratee_per_order"`);
    await ensureIndex(queryInterface, "ratings", ["orderId", "assignmentId", "ratedByUserId", "ratedUserId"], "uq_rating_per_provider_assignment", { unique: true });
    await db.sequelize.query(`
      UPDATE "ratings"
      SET "ratedRoleCode" = CASE
        WHEN UPPER(COALESCE("rateeType"::text, '')) = 'CONTRACTOR' THEN 'CONTRACTOR'
        WHEN UPPER(COALESCE("rateeType"::text, '')) = 'OWNER' THEN 'OWNER'
        ELSE 'LABOUR'
      END
      WHERE "ratedRoleCode" IS NULL
    `);
    await db.sequelize.query(`ALTER TABLE "ratings" ALTER COLUMN "ratedRoleCode" SET NOT NULL`);
  } catch (e) { /* table not yet created — sync will handle it */ }

  // platformFee column on workPayments (labour platform fee per day)
  await ensureColumn(queryInterface, "workPayments", "platformFee", {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0,
  });

  await ensureIndex(queryInterface, "sessions", ["tokenHash"], "idx_sessions_token_hash");
  await ensureIndex(queryInterface, "sessions", ["userId"], "idx_sessions_user_id");
  await ensureIndex(queryInterface, "orderAssignments", ["orderId"], "idx_order_assignments_order_id");
  await ensureIndex(queryInterface, "orderAssignments", ["providerUserId"], "idx_order_assignments_provider");
  await ensureIndex(queryInterface, "labourProfiles", ["isAvailable"], "idx_labour_profiles_available");
  await ensureIndex(queryInterface, "contractorProfiles", ["isAvailable"], "idx_contractor_profiles_available");
  await ensureIndex(queryInterface, "contractorSkills", ["skillId"], "idx_contractor_skills_skill_id");
  await ensureIndex(queryInterface, "contractorCategories", ["categoryId"], "idx_contractor_categories_category_id");
  await ensureIndex(queryInterface, "providerRatingSummaries", ["roleCode"], "idx_provider_rating_role");
  await ensureIndex(queryInterface, "providerRatingSummaries", ["averageRating"], "idx_provider_rating_average");
  await ensureIndex(queryInterface, "providerRatingSummaries", ["totalRatings"], "idx_provider_rating_total");
};

module.exports = {
  ensureSchema,
};
