const express = require("express");
const cors = require("cors");
const http = require("http");

const { config } = require("./config/db.config");
const { connectDB } = require("./model/index");
const { ensureDefaultAdmin } = require("./controller/admin");
const db = require("./model");
const { seedSkills } = require("./utils/seedSkills");
const { seedAddressData } = require("./utils/seedAddressData");
const { ensureSchema } = require("./utils/ensureSchema");

const app = express();
const server = http.createServer(app);

const port = config.PORT;

// middleware
app.use(cors());
app.use(express.json());

// routes
const routes = require("./routes");
app.use("", routes);

const runStartupTasks = async () => {
  await ensureSchema(db);
  await seedSkills(db.skill, db.category, db.categorySkill);
  await seedAddressData(db);
};

const startServer = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  try {
    await runStartupTasks();
  } catch (error) {
    console.error("Startup seed warning:", error.message);
  }

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  }

  console.error("Server error:", error);
  process.exit(1);
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});



