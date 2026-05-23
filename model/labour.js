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
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    village: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    districtId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pincodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    postOfficeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    area: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postOffice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM("male", "female"),
      allowNull: false,
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
    indexes: [
      { fields: ["stateId"] },
      { fields: ["districtId"] },
      { fields: ["pincodeId"] },
      { fields: ["postOfficeId"] },
      { fields: ["pincode"] },
    ],
  });

  return Labour;
};
