const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);

  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`Added missing column ${tableName}.${columnName}`);
  }
};

const ensureSchema = async (db) => {
  const queryInterface = db.sequelize.getQueryInterface();

  await ensureColumn(queryInterface, "labours", "village", {
    type: db.Sequelize.STRING,
    allowNull: true,
  });

  await ensureColumn(queryInterface, "owners", "village", {
    type: db.Sequelize.STRING,
    allowNull: true,
  });
};

module.exports = {
  ensureSchema,
};
