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
    status: { type: db.Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
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
    status: { type: db.Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    isActive: { type: db.Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
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
  const orderColumns = {
    categoryId: { type: db.Sequelize.INTEGER, allowNull: true },
    skillId: { type: db.Sequelize.INTEGER, allowNull: true },
    address: textColumn,
    requiredDate: { type: db.Sequelize.DATEONLY, allowNull: true },
    needType: { type: db.Sequelize.ENUM("labour", "contractor"), allowNull: false, defaultValue: "labour" },
    ownerName: stringColumn,
    ownerPhone: stringColumn,
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
    age:         { type: db.Sequelize.INTEGER, allowNull: true },
    gender:      { type: db.Sequelize.ENUM("male", "female"), allowNull: true },
    city:        { type: db.Sequelize.STRING, allowNull: true },
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
    isActive:    { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  };
  for (const [col, def] of Object.entries(userPersonalColumns)) {
    await ensureColumn(queryInterface, "users", col, def);
  }

  // Copy personal/location data from labours → users (fill nulls only)
  try {
    await db.sequelize.query(`
      UPDATE "users" u
      SET
        age          = COALESCE(u.age,         l.age),
        gender       = COALESCE(u.gender,      l.gender),
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
        gender       = COALESCE(u.gender,      o.gender),
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
        "ownerName" = COALESCE(NULLIF(o."ownerName", ''), la.name, ow_u.name, ow_o.name),
        "ownerPhone" = COALESCE(NULLIF(o."ownerPhone", ''), la.phone, ow_u.phone, ow_o.phone)
      FROM "orderMappings" AS m
      LEFT JOIN "labours" AS la   ON la.id   = m."userId"
      LEFT JOIN "owners"  AS ow_u ON ow_u.id = m."userId"
      LEFT JOIN "owners"  AS ow_o ON ow_o.id = m."ownerId"
      WHERE m."orderId" = o.id
        AND m."userType" = 'owner'
        AND (NULLIF(o."ownerName", '') IS NULL OR NULLIF(o."ownerPhone", '') IS NULL)
    `);
    console.log("Backfilled ownerName/ownerPhone on orders");
  } catch (e) {
    console.warn("Order ownerName backfill skipped:", e.message);
  }

  // Create contractorSkills table (multi-skill mapping for contractors)
  await ensureTable(db.sequelize, "contractorSkills", `
    CREATE TABLE "contractorSkills" (
      id SERIAL PRIMARY KEY,
      "contractorId" INTEGER NOT NULL,
      "categoryId" INTEGER,
      "skillId" INTEGER NOT NULL,
      price INTEGER DEFAULT 0,
      "experienceYears" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("contractorId", "skillId")
    )
  `);

  // Backfill contractorSkills from owners.skillId for existing contractors
  try {
    await db.sequelize.query(`
      INSERT INTO "contractorSkills" ("contractorId", "categoryId", "skillId", "createdAt", "updatedAt")
      SELECT id, "categoryId", "skillId", NOW(), NOW()
      FROM "owners"
      WHERE "registeredFrom" = 'contractor'
        AND "skillId" IS NOT NULL
        AND id NOT IN (SELECT "contractorId" FROM "contractorSkills")
      ON CONFLICT ("contractorId", "skillId") DO NOTHING
    `);
    console.log("Backfilled contractorSkills from owners");
  } catch (e) {
    console.warn("contractorSkills backfill skipped:", e.message);
  }

  await ensureIndex(queryInterface, "labours", ["stateId"], "idx_labours_state_id");
  await ensureIndex(queryInterface, "labours", ["districtId"], "idx_labours_district_id");
  await ensureIndex(queryInterface, "labours", ["pincodeId"], "idx_labours_pincode_id");
  await ensureIndex(queryInterface, "labours", ["postOfficeId"], "idx_labours_post_office_id");
  await ensureIndex(queryInterface, "labours", ["pincode"], "idx_labours_pincode");
  await ensureIndex(queryInterface, "labours", ["isVerified"], "idx_labours_is_verified");
  await ensureIndex(queryInterface, "labours", ["labourCode"], "idx_labours_labour_code");
  await ensureIndex(queryInterface, "labourSkills", ["skillId"], "idx_labour_skills_skill_id");
  await ensureIndex(queryInterface, "labourSkills", ["labourId"], "idx_labour_skills_labour_id");
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
};

module.exports = {
  ensureSchema,
};
