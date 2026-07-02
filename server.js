const express = require("express");
const cors = require("cors");
const http = require("http");

const { config } = require("./config/db.config");
const { connectDB } = require("./model/index");
const { ensureDefaultAdmin } = require("./controller/admin");
const db = require("./model");
const { seedSkills } = require("./utils/seedSkills");
const { seedAddressData } = require("./utils/seedAddressData");

const app = express();
const server = http.createServer(app);

const port = config.PORT;
const shouldRunStartupSeeds = process.env.RUN_STARTUP_SEEDS !== "false";
const shouldBootstrapAdmin = process.env.SKIP_DEFAULT_ADMIN_BOOTSTRAP !== "true";

// middleware
app.use(cors());
app.use(express.json());

// serve uploaded files statically
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Admin panel
app.get("/admin",           (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/admin/dashboard", (_req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// routes
const routes = require("./routes");
app.use("", routes);

const runStartupTasks = async () => {
  if (!shouldRunStartupSeeds) {
    console.log("Startup seeding skipped (RUN_STARTUP_SEEDS=false)");
    return;
  }
  await seedSkills(db.skill, db.category, db.categorySkill);
  await seedAddressData(db);
};

const startServer = async () => {
  await connectDB();
  if (shouldBootstrapAdmin) {
    await ensureDefaultAdmin();
  }
  await runStartupTasks();

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    console.log("Startup tasks completed");
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



