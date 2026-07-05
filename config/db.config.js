require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

// Production  → LIVE_DATABASE_URL (Neon cloud)
// Development → LOCAL_DATABASE_URL (your local PostgreSQL)
// Override either with DATABASE_URL if set explicitly
const databaseUrl = process.env.DATABASE_URL
  || (isProduction ? process.env.LIVE_DATABASE_URL : process.env.LOCAL_DATABASE_URL)
  || process.env.LIVE_DATABASE_URL
  || "";
const requiredInProduction = ["SECRET_KEY"];

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);

  if (!databaseUrl) {
    missing.push("DATABASE_URL or LIVE_DATABASE_URL");
  }

  if (process.env.SKIP_DEFAULT_ADMIN_BOOTSTRAP !== "true" && !process.env.DEFAULT_ADMIN_PASSWORD) {
    missing.push("DEFAULT_ADMIN_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production env var(s): ${missing.join(", ")}`);
  }
}

// SSL only for remote databases (not localhost / 127.0.0.1)
const isRemoteDb = Boolean(databaseUrl) &&
  !databaseUrl.includes("localhost") &&
  !databaseUrl.includes("127.0.0.1");

exports.config = {
  PORT: process.env.PORT || 5352,
  DATABASE_URL: databaseUrl,
  IS_REMOTE_DB: isRemoteDb,
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "",
  DB: process.env.DB_NAME || "labour_db",
  DIALECT: "postgres",
  SCHEMA: "public",
  SECRET_KEY: process.env.SECRET_KEY || "dev-only-secret-key",
};
