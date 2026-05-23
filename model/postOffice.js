module.exports = (sequelize, DataTypes) => {
  const PostOffice = sequelize.define("postOffice", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    pincodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pincodes",
        key: "id",
      },
    },
    postOfficeName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    branchType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deliveryStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: "postOffices",
    timestamps: true,
    indexes: [
      { fields: ["pincodeId"] },
      { unique: true, fields: ["pincodeId", "postOfficeName"] },
    ],
  });

  return PostOffice;
};
