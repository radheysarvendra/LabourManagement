module.exports = (sequelize, DataTypes) => {
  const Labour = sequelize.define("labour", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    labourCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    registeredFrom: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "labour",
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: "labours",
    timestamps: true,
  });

  return Labour;
};
