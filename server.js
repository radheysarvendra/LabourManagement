const express = require("express");
const cors = require("cors");
const http = require("http");

const { config } = require("./config/db.config");
const { connectDB, sequelize } = require("./model/index");
const MigrationHelper = require("./helper/migrationHelper");

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 5352;
// middleware
app.use(cors());
app.use(express.json());

// models init
require("./model");

// routes
const routes = require("./routes");
app.use("", routes);

// start server after DB connect
(async () => {
  await connectDB();

  server.listen(port, () => {
    console.log(`🚀 Server Running On http://localhost:${port}`);
  });
})();