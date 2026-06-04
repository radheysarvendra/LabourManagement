const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);

  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`Added missing column ${tableName}.${columnName}`);
  }
};

const ensureIndex = async (queryInterface, tableName, fields, name) => {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => index.name === name);

  if (!exists) {
    await queryInterface.addIndex(tableName, fields, { name });
    console.log(`Added missing index ${name}`);
  }
};

const ensureSchema = async (db) => {
  const queryInterface = db.sequelize.getQueryInterface();
  const stringColumn = {
    type: db.Sequelize.STRING,
    allowNull: true,
  };
  const textColumn = {
    type: db.Sequelize.TEXT,
    allowNull: true,
  };
  const labourColumns = {
    userId: { type: db.Sequelize.INTEGER, allowNull: true },
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
    requiredDate: { type: db.Sequelize.DATEONLY, allowNull: true },
  };
  const bookingColumns = {
    requiredDate: { type: db.Sequelize.DATEONLY, allowNull: true },
  };

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
  await ensureIndex(queryInterface, "bookings", ["requiredDate"], "idx_bookings_required_date");
};

module.exports = {
  ensureSchema,
};
