exports.config = {
  PORT: process.env.PORT || 5352,
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "Sarvendra@123#",
  DB: process.env.DB_NAME || "labour_db",
  DIALECT: "postgresql",
  SCHEMA: "public",
  SECRET_KEY: process.env.SECRET_KEY || "j4%$^5%32g3590g4fn4tvT8s9vjhUKJF79^&JJUD947749893^&@(",
};