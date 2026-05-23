exports.config = {
  PORT: process.env.PORT || 5352,
  DATABASE_URL: process.env.DATABASE_URL || "",
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "Sarvendra@123#",
  DB: process.env.DB_NAME || "labour_db",
  DIALECT: "postgres",
  SCHEMA: "public",
  SECRET_KEY: process.env.SECRET_KEY || "change-this-secret-key",
};
