module.exports = (sequelize, DataTypes) => {
  const Address = sequelize.define("address", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    stateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "states",
        key: "id",
      },
    },
    districtId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "districts",
        key: "id",
      },
    },
    pincodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pincodes",
        key: "id",
      },
    },
    postOfficeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "postOffices",
        key: "id",
      },
    },
    fullAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    landmark: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    village: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entityType: {
      type: DataTypes.ENUM("labour", "owner"),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: "addresses",
    timestamps: true,
    indexes: [
      { fields: ["entityType", "entityId"] },
      { fields: ["stateId"] },
      { fields: ["districtId"] },
    ],
  });

  return Address;
};
