const db = require("../model/index");

const TABLE_NAME = "labourProfiles";
const OLD_COLUMN = "labourCode";
const NEW_COLUMN = "userCode";

const run = async () => {
  const queryInterface = db.sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(TABLE_NAME);

  if (table[NEW_COLUMN] && !table[OLD_COLUMN]) {
    console.log(`${TABLE_NAME}.${NEW_COLUMN} already exists. Nothing to do.`);
    return;
  }

  if (!table[OLD_COLUMN] && !table[NEW_COLUMN]) {
    console.log(`${TABLE_NAME}.${OLD_COLUMN} not found. Nothing to do.`);
    return;
  }

  if (table[OLD_COLUMN] && !table[NEW_COLUMN]) {
    await queryInterface.renameColumn(TABLE_NAME, OLD_COLUMN, NEW_COLUMN);
    console.log(`Renamed ${TABLE_NAME}.${OLD_COLUMN} -> ${NEW_COLUMN}`);
    return;
  }

  if (table[OLD_COLUMN] && table[NEW_COLUMN]) {
    console.log(`${TABLE_NAME} has both columns. Please verify data manually before removing ${OLD_COLUMN}.`);
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Rename failed:", error);
    process.exit(1);
  });
