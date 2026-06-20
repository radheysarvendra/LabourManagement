module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define("userRole", {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    // pending | complete | suspended
    profileStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
  }, {
    tableName: "userRoles",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["userId"], name: "idx_user_roles_user_id" },
      { fields: ["roleId"], name: "idx_user_roles_role_id" },
    ],
  });

  return UserRole;
};
