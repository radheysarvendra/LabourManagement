module.exports = (sequelize, DataTypes) => {
  const AdminPermission = sequelize.define("adminPermission", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    moduleName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    canView: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    canCreate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    canUpdate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    canDelete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    canApprove: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: "adminPermissions",
    timestamps: true,
    indexes: [
      { fields: ["roleId"] },
      { fields: ["moduleName"] },
      { unique: true, fields: ["roleId", "moduleName"] },
    ],
  });

  return AdminPermission;
};
