const { Sequelize, DataTypes } = require("sequelize");
const { config } = require("../config/db.config");
const { ensureSchema } = require("../utils/ensureSchema");
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
      // alter:false → only creates missing tables, never modifies existing ones (prevents data loss)
      await sequelize.sync({ alter: false, force: false });
      // ensureSchema safely adds missing columns one-by-one using ADD COLUMN IF NOT EXISTS
      await ensureSchema(db);
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
db.admin = require("./admin")(sequelize, DataTypes);
db.adminPermission = require("./adminPermission")(sequelize, DataTypes);
db.booking = require("./booking")(sequelize, DataTypes);
db.bookingAllocation = require("./bookingAllocation")(sequelize, DataTypes);
db.order = require("./order")(sequelize, DataTypes);
db.orderMapping = require("./orderMapping")(sequelize, DataTypes);
db.workAssignment = require("./workAssignment")(sequelize, DataTypes);
db.workAssignmentLabour = require("./workAssignmentLabour")(sequelize, DataTypes);
db.workAttendance = require("./workAttendance")(sequelize, DataTypes);
db.workPayment = require("./workPayment")(sequelize, DataTypes);

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

// userId-based lookups for new single-registration flow (constraints:false → no FK in DB)
db.orderMapping.belongsTo(db.labour, {
  foreignKey: "userId",
  targetKey: "id",
  as: "userLabour",
  constraints: false,
});

db.orderMapping.belongsTo(db.owner, {
  foreignKey: "userId",
  targetKey: "id",
  as: "userOwner",
  constraints: false,
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

db.order.belongsTo(db.skill, {
  foreignKey: "skillId",
  otherKey: "id",
  as: "skillDetail",
});

db.skill.hasMany(db.order, {
  foreignKey: "skillId",
  sourceKey: "id",
  as: "orders",
});

db.order.belongsTo(db.category, {
  foreignKey: "categoryId",
  otherKey: "id",
  as: "categoryDetail",
});

db.category.hasMany(db.order, {
  foreignKey: "categoryId",
  sourceKey: "id",
  as: "orders",
});

// NOTE - work assignments map
db.order.hasMany(db.workAssignment, {
  foreignKey: "orderId",
  sourceKey: "id",
  as: "workAssignments",
  onDelete: "CASCADE",
});
db.order.hasOne(db.workAssignment, {
  foreignKey: "orderId",
  sourceKey: "id",
  as: "workAssignment",
});

db.workAssignment.belongsTo(db.order, {
  foreignKey: "orderId",
  otherKey: "id",
  as: "order",
});

db.owner.hasMany(db.workAssignment, {
  foreignKey: "ownerId",
  sourceKey: "id",
  as: "workAssignments",
});

db.workAssignment.belongsTo(db.owner, {
  foreignKey: "ownerId",
  otherKey: "id",
  as: "owner",
});

db.admin.hasMany(db.workAssignment, {
  foreignKey: "middlemanId",
  sourceKey: "id",
  as: "middlemanAssignments",
});

db.workAssignment.belongsTo(db.admin, {
  foreignKey: "middlemanId",
  otherKey: "id",
  as: "middleman",
});

db.workAssignment.hasMany(db.workAssignmentLabour, {
  foreignKey: "workAssignmentId",
  sourceKey: "id",
  as: "assignmentLabours",
  onDelete: "CASCADE",
});

db.workAssignmentLabour.belongsTo(db.workAssignment, {
  foreignKey: "workAssignmentId",
  otherKey: "id",
  as: "workAssignment",
});

db.labour.hasMany(db.workAssignmentLabour, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "workAssignmentLabours",
});

db.workAssignmentLabour.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});

db.skill.hasMany(db.workAssignmentLabour, {
  foreignKey: "skillId",
  sourceKey: "id",
  as: "workAssignmentLabours",
});

db.workAssignmentLabour.belongsTo(db.skill, {
  foreignKey: "skillId",
  otherKey: "id",
  as: "skillDetail",
});

db.workAssignment.hasMany(db.workAttendance, {
  foreignKey: "workAssignmentId",
  sourceKey: "id",
  as: "attendances",
  onDelete: "CASCADE",
});

db.workAttendance.belongsTo(db.workAssignment, {
  foreignKey: "workAssignmentId",
  otherKey: "id",
  as: "workAssignment",
});

db.labour.hasMany(db.workAttendance, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "workAttendances",
});

db.workAttendance.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});

db.workAssignment.hasMany(db.workPayment, {
  foreignKey: "workAssignmentId",
  sourceKey: "id",
  as: "payments",
  onDelete: "CASCADE",
});

db.workPayment.belongsTo(db.workAssignment, {
  foreignKey: "workAssignmentId",
  otherKey: "id",
  as: "workAssignment",
});

db.labour.hasMany(db.workPayment, {
  foreignKey: "labourId",
  sourceKey: "id",
  as: "workPayments",
});

db.workPayment.belongsTo(db.labour, {
  foreignKey: "labourId",
  otherKey: "id",
  as: "labour",
});


// NOTE - admin role and permissions map
db.admin.belongsTo(db.role, {
  foreignKey: "roleId",
  otherKey: "id",
  as: "role",
});

db.role.hasMany(db.admin, {
  foreignKey: "roleId",
  sourceKey: "id",
  as: "admins",
});

db.adminPermission.belongsTo(db.role, {
  foreignKey: "roleId",
  otherKey: "id",
  as: "role",
});

db.role.hasMany(db.adminPermission, {
  foreignKey: "roleId",
  sourceKey: "id",
  as: "adminPermissions",
});

db.admin.hasMany(db.adminPermission, {
  foreignKey: "roleId",
  sourceKey: "roleId",
  as: "permissions",
});
db.connectDB = connectDB;
module.exports =db;




