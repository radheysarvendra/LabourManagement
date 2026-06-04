const { connectDB } = require("../model");
const { ensureDefaultAdmin } = require("../controller/admin");

const run = async () => {
  await connectDB();
  await ensureDefaultAdmin();
  console.log("Default admin is ready");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed default admin:", error);
    process.exit(1);
  });
