require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL || process.env.LIVE_DATABASE_URL || "";
const requiredInProduction = ["SECRET_KEY", "DEFAULT_ADMIN_PASSWORD"];

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);

  if (!databaseUrl) {
    missing.push("DATABASE_URL or LIVE_DATABASE_URL");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production env var(s): ${missing.join(", ")}`);
  }
}

exports.config = {
  PORT: process.env.PORT || 5352,
  DATABASE_URL: databaseUrl,
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "",
  DB: process.env.DB_NAME || "labour_db",
  DIALECT: "postgres",
  SCHEMA: "public",
  SECRET_KEY: process.env.SECRET_KEY || "dev-only-secret-key",
};
