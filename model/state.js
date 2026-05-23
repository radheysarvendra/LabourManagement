module.exports = (sequelize, DataTypes) => {
  const State = sequelize.define("state", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    stateName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stateCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    totalDistricts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: "states",
    timestamps: true,
  });

  return State;
};
