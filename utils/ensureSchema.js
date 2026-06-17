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
    city: stringColumn,
    village: stringColumn,
    stateId: { type: db.Sequelize.INTEGER, allowNull: true },
    districtId: { type: db.Sequelize.INTEGER, allowNull: true },
    pincodeId: { type: db.Sequelize.INTEGER, allowNull: true },
    postOfficeId: { type: db.Sequelize.INTEGER, allowNull: true },
    district: stringColumn,
    state: stringColumn,
    pincode: stringColumn,
    area: stringColumn,
    postOffice: stringColumn,
    address: textColumn,
    isAvailable: { type: db.Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    isVerified: { type: db.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    profileImage: stringColumn,
    experienceYears: { type: db.Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    createdById: { type: db.Sequelize.INTEGER, allowNull: true },
    updatedById: { type: db.Sequelize.INTEGER, allowNull: true },
  };
  const ownerColumns = {
    userId: { type: db.Sequelize.INTEGER, allowNull: true },
    registeredFrom: registeredFromEnum,
    status: { type: db.Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    city: stringColumn,
    village: stringColumn,
    district: stringColumn,
    state: stringColumn,
    pincode: stringColumn,
    area: stringColumn,
    postOffice: stringColumn,
    address: textColumn,
    age: { type: db.Sequelize.INTEGER, allowNull: true },
    profileImage: stringColumn,
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

  // Backfill ownerName/ownerPhone for orders created before denormalization was added.
  // Tries labours table first (new-flow labour users), then owners table by userId,
  // then owners table by ownerId (old-flow orders already have ownerName set so COALESCE skips them).
  try {
    await db.sequelize.query(`
      UPDATE "orders" o
      SET
        "ownerName" = COALESCE(
          o."ownerName",
          (SELECT l.name FROM "labours" l
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."userId" = l.id LIMIT 1),
          (SELECT ow.name FROM "owners" ow
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."userId" = ow.id LIMIT 1),
          (SELECT ow.name FROM "owners" ow
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."ownerId" = ow.id LIMIT 1)
        ),
        "ownerPhone" = COALESCE(
          o."ownerPhone",
          (SELECT l.phone FROM "labours" l
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."userId" = l.id LIMIT 1),
          (SELECT ow.phone FROM "owners" ow
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."userId" = ow.id LIMIT 1),
          (SELECT ow.phone FROM "owners" ow
           INNER JOIN "orderMappings" m ON m."orderId" = o.id AND m."userType" = 'owner'
           WHERE m."ownerId" = ow.id LIMIT 1)
        )
      WHERE o."ownerName" IS NULL OR o."ownerPhone" IS NULL
    `);
    console.log("Backfilled ownerName/ownerPhone on orders");
  } catch (e) {
    console.warn("Order ownerName backfill skipped:", e.message);
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
