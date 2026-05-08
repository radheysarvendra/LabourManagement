const { Sequelize, DataTypes } = require("sequelize");
const { config } = require("../config/db.config");
const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.DIALECT,
  operatorsAliases: 0,
  logging: false,
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 60000,
  },
  define: {
    schema: config.SCHEMA,
    timestamps: true,
  },
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connected Successfully");

    await sequelize.sync({
      alter: process.env.NODE_ENV !== "production",
      force: false,
    });
    console.log("All models synced");

  } catch (error) {
    console.error("❌ DB Connection Error:", error);
    process.exit(1);
  }
};

// FIX: lowercase keys — controller ke saath match karta hai
db.labour = require("./labour")(sequelize, DataTypes);
db.owner = require("./owner")(sequelize, DataTypes);
db.mobileTokenMap = require("./mobile_token")(sequelize, DataTypes);
db.role = require("./role")(sequelize, DataTypes);
db.connectDB = connectDB;
module.exports =db;


