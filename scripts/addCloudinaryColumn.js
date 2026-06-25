require("dotenv").config();
const { Sequelize } = require("sequelize");
const { config }    = require("../config/db.config");

const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: config.IS_REMOTE_DB ? { ssl: { rejectUnauthorized: false } } : {},
  logging: false,
});

(async () => {
  try {
    await sequelize.authenticate();

    // Add cloudinaryPublicId column if it doesn't already exist
    await sequelize.query(`
      ALTER TABLE "labourProfiles"
      ADD COLUMN IF NOT EXISTS "cloudinaryPublicId" TEXT DEFAULT NULL;
    `);

    console.log('✅ Column "cloudinaryPublicId" added to labourProfiles (or already existed)');
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
})();
