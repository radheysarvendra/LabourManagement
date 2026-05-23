module.exports = (sequelize, DataTypes) => {
  const Pincode = sequelize.define("pincode", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    districtId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "districts",
        key: "id",
      },
    },
    pincode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    division: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    circle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: "pincodes",
    timestamps: true,
    indexes: [
      { fields: ["pincode"] },
      { fields: ["districtId"] },
    ],
  });

  return Pincode;
};
