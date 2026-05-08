#!/usr/bin/env node

/**
 * 🚀 MIGRATION CLI — Command line se migrations run karne ke liye
 * 
 * Usage:
 * node migrate.js run          - Sab migrations run karo
 * node migrate.js fresh        - Fresh migrations (DROP + CREATE)
 * node migrate.js status       - Database status check
 * node migrate.js columns <table> - Table columns dekho
 * node migrate.js reset <table> - Specific table reset karo
 */

const { sequelize, connectDB } = require("./model/index");
const MigrationHelper = require("./helper/migrationHelper");

const migrationHelper = new MigrationHelper(sequelize);
const command = process.argv[2];
const arg = process.argv[3];

const runCommand = async () => {
  try {
    await connectDB();

    switch (command) {
      case "run":
        console.log("🔄 Running migrations...\n");
        const result1 = await migrationHelper.runAllMigrations();
        console.log(result1);
        break;

      case "fresh":
        console.log("🔄 Running FRESH migrations (This will DROP all tables)...\n");
        const result2 = await migrationHelper.freshMigrations();
        console.log(result2);
        break;

      case "status":
        console.log("🔍 Checking database status...\n");
        const result3 = await migrationHelper.checkDatabaseStatus();
        console.log(JSON.stringify(result3, null, 2));
        break;

      case "columns":
        if (!arg) {
          console.error("❌ Table name required: node migrate.js columns <tableName>");
          process.exit(1);
        }
        console.log(`🔍 Showing columns for table: ${arg}\n`);
        const result4 = await migrationHelper.showTableColumns(arg);
        console.log(JSON.stringify(result4, null, 2));
        break;

      case "reset":
        if (!arg) {
          console.error("❌ Table name required: node migrate.js reset <tableName>");
          process.exit(1);
        }
        console.log(`🔄 Resetting table: ${arg}...\n`);
        const result5 = await migrationHelper.resetTable(arg);
        console.log(result5);
        break;

      case "migrate":
        if (!arg) {
          console.error("❌ Table name required: node migrate.js migrate <tableName>");
          process.exit(1);
        }
        console.log(`🔄 Migrating table: ${arg}...\n`);
        const result6 = await migrationHelper.migrateTable(arg);
        console.log(result6);
        break;

      default:
        console.log(`
📚 MIGRATION CLI — Commands:

  node migrate.js run              - Run all migrations
  node migrate.js fresh            - Fresh migrations (DROP + CREATE)
  node migrate.js status           - Check database status
  node migrate.js columns <table>  - Show table columns
  node migrate.js migrate <table>  - Migrate specific table
  node migrate.js reset <table>    - Reset specific table (DELETE DATA)

⚠️ Commands जो production में नहीं चलेंगे:
  - fresh (सब tables drop करेगा)
  - reset (data delete करेगा)
        `);
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

runCommand();
