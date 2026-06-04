const { Sequelize, DataTypes } = require("sequelize");
const { config } = require("../config/db.config");
const shouldSyncDatabase = process.env.ENABLE_DB_SYNC !== "false";

const commonOptions = {
  dialect: config.DIALECT,
  logging: false,
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 60000,
    ...(config.DATABASE_URL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {}),
  },
  define: {
    schema: config.SCHEMA,
    timestamps: true,
  },
};

const sequelize = config.DATABASE_URL
  ? new Sequelize(config.DATABASE_URL, commonOptions)
  : new Sequelize(config.DB, config.USER, config.PASSWORD, {
  ...commonOptions,
  host: config.HOST,
  operatorsAliases: 0,
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connected Successfully");

    if (shouldSyncDatabase) {
      await sequelize.sync({
        alter: process.env.NODE_ENV !== "production",
        force: false,
      });
      console.log("Database models are ready");
    }

  } catch (error) {
    console.error("❌ DB Connection Error:", error);
    process.exit(1);
  }
};

// FIX: lowercase keys — controller ke saath match karta hai
db.labour = require("./labour")(sequelize, DataTypes);
db.owner = require("./owner")(sequelize, DataTypes);
db.skill = require("./skill")(sequelize, DataTypes);
db.category = require("./category")(sequelize, DataTypes);
db.categorySkill = require("./categorySkill")(sequelize, DataTypes);
db.labourSkill = require("./labourSkill")(sequelize, DataTypes);
db.state = require("./state")(sequelize, DataTypes);
db.district = require("./district")(sequelize, DataTypes);
db.pincode = require("./pincode")(sequelize, DataTypes);
db.postOffice = require("./postOffice")(sequelize, DataTypes);
db.address = require("./address")(sequelize, DataTypes);
db.mobileTokenMap = require("./mobile_token")(sequelize, DataTypes);
db.authOtp = require("./authOtp")(sequelize, DataTypes);
db.role = require("./role")(sequelize, DataTypes);
db.booking = require("./booking")(sequelize, DataTypes);
db.bookingAllocation = require("./bookingAllocation")(sequelize, DataTypes);
db.order = require("./order")(sequelize, DataTypes);
db.orderMapping = require("./orderMapping")(sequelize, DataTypes);

// NOTE - labour skills map
db.labour.hasMany(db.labourSkill, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "labourSkills",
  onDelete: "CASCADE",
});

db.labourSkill.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});

db.skill.hasMany(db.labourSkill, {
  foreignKey: "skillId",
  sourceKey: "id",
  as: "labourSkills",
  onDelete: "CASCADE",
});

db.labourSkill.belongsTo(db.skill, {
  foreignKey: "skillId",
  otherKey: "id",
  as: "skill",
});

// NOTE - category skills map
db.category.hasMany(db.categorySkill, {
  foreignKey: "categoryId",
  sourceKey: "id",
  as: "categorySkills",
  onDelete: "CASCADE",
});

db.categorySkill.belongsTo(db.category, {
  foreignKey: "categoryId",
  otherKey: "id",
  as: "category",
});

db.skill.hasMany(db.categorySkill, {
  foreignKey: "skillId",
  sourceKey: "id",
  as: "categorySkills",
  onDelete: "CASCADE",
});

db.categorySkill.belongsTo(db.skill, {
  foreignKey: "skillId",
  otherKey: "id",
  as: "skill",
});

// NOTE - districts map
db.state.hasMany(db.district, {
  foreignKey: "stateId",
  sourceKey: "id",
  as: "districts",
});
db.district.belongsTo(db.state, {
  foreignKey: "stateId",
  otherKey: "id",
  as: "state",
});

// NOTE - pincodes map
db.district.hasMany(db.pincode, {
  foreignKey: "districtId",
  sourceKey: "id",
  as: "pincodes",
});
db.pincode.belongsTo(db.district, {
  foreignKey: "districtId",
  otherKey: "id",
  as: "district",
});

// NOTE - post offices map
db.pincode.hasMany(db.postOffice, {
  foreignKey: "pincodeId",
  sourceKey: "id",
  as: "postOffices",
});
db.postOffice.belongsTo(db.pincode, {
  foreignKey: "pincodeId",
  otherKey: "id",
  as: "pincode",
});

// NOTE - addresses map
db.address.belongsTo(db.state, {
  foreignKey: "stateId",
  otherKey: "id",
  as: "state",
});
db.address.belongsTo(db.district, {
  foreignKey: "districtId",
  otherKey: "id",
  as: "district",
});
db.address.belongsTo(db.pincode, {
  foreignKey: "pincodeId",
  otherKey: "id",
  as: "pincode",
});
db.address.belongsTo(db.postOffice, {
  foreignKey: "postOfficeId",
  otherKey: "id",
  as: "postOffice",
});

// NOTE - booking allocations map
db.owner.hasMany(db.booking, {
  foreignKey: "ownerId",
  sourceKey: "id",
  as: "bookings",
});

db.booking.belongsTo(db.owner, {
  foreignKey: "ownerId",
  otherKey: "id",
  as: "owner",
});

db.booking.hasMany(db.bookingAllocation, {
  foreignKey: "bookingId",
  sourceKey: "id",
  as: "allocations",
  onDelete: "CASCADE",
});

db.bookingAllocation.belongsTo(db.booking, {
  foreignKey: "bookingId",
  otherKey: "id",
  as: "booking",
});

db.labour.hasMany(db.bookingAllocation, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "bookingAllocations",
});

db.bookingAllocation.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});

// NOTE - order mappings map
db.order.hasMany(db.orderMapping, {
  foreignKey: "orderId",
  sourceKey: "id",
  as: "mappings",
  onDelete: "CASCADE",
});

db.orderMapping.belongsTo(db.order, {
  foreignKey: "orderId",
  otherKey: "id",
  as: "order",
});

db.owner.hasMany(db.orderMapping, {
  foreignKey: "ownerId",
  sourceKey: "id",
  as: "orderMappings",
});

db.orderMapping.belongsTo(db.owner, {
  foreignKey: "ownerId",
  otherKey: "id",
  as: "owner",
});

db.labour.hasMany(db.orderMapping, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "orderMappings",
});

db.orderMapping.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});

db.connectDB = connectDB;
module.exports =db;


