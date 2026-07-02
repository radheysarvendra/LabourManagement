const { Sequelize, DataTypes } = require("sequelize");
const { config } = require("../config/db.config");
const { ensureSchema } = require("../utils/ensureSchema");
const shouldSyncDatabase = process.env.ENABLE_DB_SYNC !== "false";

const commonOptions = {
  dialect: config.DIALECT,
  logging: false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 60000,
    ...(config.IS_REMOTE_DB
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
      // Existing installations may not yet have columns referenced by model
      // indexes. Bring the schema forward before Sequelize creates indexes.
      await ensureSchema(db);
      await sequelize.sync({ alter: false, force: false });
      console.log("Database models are ready");
    } else {
      console.log("Database sync skipped (ENABLE_DB_SYNC=false)");
    }

  } catch (error) {
    console.error("❌ DB Connection Error:", error);
    process.exit(1);
  }
};

// FIX: lowercase keys — controller ke saath match karta hai
db.user = require("./user")(sequelize, DataTypes);
db.labour = require("./labour")(sequelize, DataTypes);
db.owner = require("./owner")(sequelize, DataTypes);
db.skill = require("./skill")(sequelize, DataTypes);
db.category = require("./category")(sequelize, DataTypes);
db.categorySkill = require("./categorySkill")(sequelize, DataTypes);
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

// ── NEW MODELS ──────────────────────────────────────────────────────────────
db.appRole = require("./appRole")(sequelize, DataTypes);
db.userRole = require("./userRole")(sequelize, DataTypes);
db.labourProfile = require("./labourProfile")(sequelize, DataTypes);
db.labourSkill = require("./labourSkill")(sequelize, DataTypes);   // after labourProfile (FK dep)
db.contractorProfile = require("./contractorProfile")(sequelize, DataTypes);
db.contractorSkill = require("./contractorSkill")(sequelize, DataTypes);
db.contractorCategory = require("./contractorCategory")(sequelize, DataTypes);
db.session = require("./session")(sequelize, DataTypes);
db.orderAssignment = require("./orderAssignment")(sequelize, DataTypes);
db.labourAssignmentDetail = require("./labourAssignmentDetail")(sequelize, DataTypes);
db.contractorAssignmentDetail = require("./contractorAssignmentDetail")(sequelize, DataTypes);
db.contractorMilestone = require("./contractorMilestone")(sequelize, DataTypes);
db.rating = require("./rating")(sequelize, DataTypes);
db.providerRatingSummary = require("./providerRatingSummary")(sequelize, DataTypes);
db.orderPayment    = require("./orderPayment")(sequelize, DataTypes);
db.contractorLead  = require("./contractorLead")(sequelize, DataTypes);

// NOTE - users → labours/owners (unified identity)
db.user.hasOne(db.labour, { foreignKey: "userId", as: "labourProfile" });
db.labour.belongsTo(db.user, { foreignKey: "userId", as: "user" });

db.user.hasOne(db.owner, { foreignKey: "userId", as: "ownerProfile" });
db.owner.belongsTo(db.user, { foreignKey: "userId", as: "user" });

db.owner.belongsTo(db.skill, {
  foreignKey: "skillId",
  otherKey: "id",
  as: "skillDetail",
});

db.skill.hasMany(db.owner, {
  foreignKey: "skillId",
  sourceKey: "id",
  as: "contractors",
});

db.owner.belongsTo(db.category, {
  foreignKey: "categoryId",
  otherKey: "id",
  as: "categoryDetail",
});

db.category.hasMany(db.owner, {
  foreignKey: "categoryId",
  sourceKey: "id",
  as: "contractors",
});

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

// ── NEW ASSOCIATIONS ─────────────────────────────────────────────────────────

// user ↔ appRole via userRoles
db.user.hasMany(db.userRole, { foreignKey: "userId", as: "userRoles", onDelete: "CASCADE" });
db.userRole.belongsTo(db.user, { foreignKey: "userId", as: "user" });
db.appRole.hasMany(db.userRole, { foreignKey: "roleId", as: "userRoles" });
db.userRole.belongsTo(db.appRole, { foreignKey: "roleId", as: "appRole" });

// user ↔ labourProfile
db.user.hasOne(db.labourProfile, { foreignKey: "userId", as: "newLabourProfile", onDelete: "CASCADE" });
db.labourProfile.belongsTo(db.user, { foreignKey: "userId", as: "user" });

// user ↔ contractorProfile
db.user.hasOne(db.contractorProfile, { foreignKey: "userId", as: "contractorProfile", onDelete: "CASCADE" });
db.contractorProfile.belongsTo(db.user, { foreignKey: "userId", as: "user" });

// labourProfile → labourSkills (new-flow via labourUserId)
db.labourProfile.hasMany(db.labourSkill, { foreignKey: "labourUserId", as: "labourSkills", onDelete: "CASCADE" });
db.labourSkill.belongsTo(db.labourProfile, { foreignKey: "labourUserId", as: "labourProfile" });

// contractorProfile ↔ contractorSkills
db.contractorProfile.hasMany(db.contractorSkill, { foreignKey: "contractorUserId", as: "contractorSkills", onDelete: "CASCADE" });
db.contractorSkill.belongsTo(db.contractorProfile, { foreignKey: "contractorUserId", as: "contractorProfile" });
db.skill.hasMany(db.contractorSkill, { foreignKey: "skillId", as: "contractorSkills" });
db.contractorSkill.belongsTo(db.skill, { foreignKey: "skillId", as: "skill" });

// contractorProfile ↔ contractorCategories
db.contractorProfile.hasMany(db.contractorCategory, { foreignKey: "contractorUserId", as: "contractorCategories", onDelete: "CASCADE" });
db.contractorCategory.belongsTo(db.contractorProfile, { foreignKey: "contractorUserId", as: "contractorProfile" });
db.category.hasMany(db.contractorCategory, { foreignKey: "categoryId", as: "contractorCategories" });
db.contractorCategory.belongsTo(db.category, { foreignKey: "categoryId", as: "category" });

// user ↔ sessions
db.user.hasMany(db.session, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: "userId", as: "user" });
db.appRole.hasMany(db.session, { foreignKey: "activeRoleId", as: "sessions" });
db.session.belongsTo(db.appRole, { foreignKey: "activeRoleId", as: "activeRole" });

// order ↔ orderAssignments
db.order.hasMany(db.orderAssignment, { foreignKey: "orderId", as: "orderAssignments", onDelete: "CASCADE" });
db.orderAssignment.belongsTo(db.order, { foreignKey: "orderId", as: "order" });
db.orderAssignment.belongsTo(db.appRole, { foreignKey: "providerRoleId", as: "providerRole" });
db.appRole.hasMany(db.orderAssignment, { foreignKey: "providerRoleId", as: "providerAssignments" });

// orderAssignment → assignedByAdmin (the admin who approved/assigned this order)
db.orderAssignment.belongsTo(db.admin, { foreignKey: "assignedByAdminId", as: "assignedByAdmin" });
db.admin.hasMany(db.orderAssignment, { foreignKey: "assignedByAdminId", as: "approvedAssignments" });

// orderAssignment → detail tables
db.orderAssignment.hasOne(db.labourAssignmentDetail, { foreignKey: "assignmentId", as: "labourDetail", onDelete: "CASCADE" });
db.labourAssignmentDetail.belongsTo(db.orderAssignment, { foreignKey: "assignmentId", as: "assignment" });
db.labourAssignmentDetail.belongsTo(db.skill, { foreignKey: "skillId", as: "skill" });

db.orderAssignment.hasOne(db.contractorAssignmentDetail, { foreignKey: "assignmentId", as: "contractorDetail", onDelete: "CASCADE" });
db.contractorAssignmentDetail.belongsTo(db.orderAssignment, { foreignKey: "assignmentId", as: "assignment" });
db.contractorAssignmentDetail.belongsTo(db.category, { foreignKey: "categoryId", as: "category" });

// orderAssignment → milestones
db.orderAssignment.hasMany(db.contractorMilestone, { foreignKey: "assignmentId", as: "milestones", onDelete: "CASCADE" });
db.contractorMilestone.belongsTo(db.orderAssignment, { foreignKey: "assignmentId", as: "assignment" });

// orderAssignment → workAttendance (new-flow via assignmentId)
db.orderAssignment.hasMany(db.workAttendance, { foreignKey: "assignmentId", as: "attendances", onDelete: "CASCADE" });
db.workAttendance.belongsTo(db.orderAssignment, { foreignKey: "assignmentId", as: "orderAssignment" });

// contractorLead associations
db.order.hasMany(db.contractorLead, { foreignKey: "orderId", as: "contractorLeads", onDelete: "CASCADE" });
db.contractorLead.belongsTo(db.order, { foreignKey: "orderId", as: "order" });
db.user.hasMany(db.contractorLead, { foreignKey: "contractorUserId", as: "contractorLeads" });
db.contractorLead.belongsTo(db.user, { foreignKey: "contractorUserId", as: "contractor" });

// orderPayment associations
db.order.hasMany(db.orderPayment, { foreignKey: "orderId", as: "orderPayments", onDelete: "CASCADE" });
db.orderPayment.belongsTo(db.order, { foreignKey: "orderId", as: "order" });

// rating associations
db.order.hasMany(db.rating, { foreignKey: "orderId", as: "ratings", onDelete: "CASCADE" });
db.rating.belongsTo(db.order, { foreignKey: "orderId", as: "order" });
db.user.hasMany(db.rating, { foreignKey: "ratedByUserId", as: "givenRatings" });
db.rating.belongsTo(db.user, { foreignKey: "ratedByUserId", as: "ratedBy" });
db.user.hasMany(db.rating, { foreignKey: "ratedUserId", as: "receivedRatings" });
db.rating.belongsTo(db.user, { foreignKey: "ratedUserId", as: "rated" });
db.orderAssignment.hasMany(db.rating, { foreignKey: "assignmentId", as: "ratings" });
db.rating.belongsTo(db.orderAssignment, { foreignKey: "assignmentId", as: "assignment" });
db.workAssignment.hasMany(db.rating, { foreignKey: "workAssignmentId", as: "ratings" });
db.rating.belongsTo(db.workAssignment, { foreignKey: "workAssignmentId", as: "workAssignment" });
db.user.hasMany(db.providerRatingSummary, { foreignKey: "userId", as: "ratingSummaries" });
db.providerRatingSummary.belongsTo(db.user, { foreignKey: "userId", as: "user" });

db.connectDB = connectDB;
module.exports = db;




