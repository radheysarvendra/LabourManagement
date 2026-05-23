module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define("district", {
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
    districtName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    districtCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: "districts",
    timestamps: true,
    indexes: [
      { fields: ["stateId"] },
      { unique: true, fields: ["stateId", "districtName"] },
    ],
  });

  return District;
};
