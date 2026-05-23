const express = require("express");
const cors = require("cors");
const http = require("http");

const { config } = require("./config/db.config");
const { connectDB } = require("./model/index");
const db = require("./model");
const { seedSkills } = require("./utils/seedSkills");
const { seedAddressData } = require("./utils/seedAddressData");

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
  await seedSkills(db.skill);
  await seedAddressData(db);
};

const startServer = async () => {
  await connectDB();

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
