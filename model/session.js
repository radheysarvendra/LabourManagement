module.exports = (sequelize, DataTypes) => sequelize.define("session", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  activeRoleId: { type: DataTypes.INTEGER, allowNull: true },
  tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
  deviceId: { type: DataTypes.STRING, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: "sessions", timestamps: true });
