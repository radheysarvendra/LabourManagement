const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
loadDotEnv(path.join(projectRoot, ".env"));

const args = new Set(process.argv.slice(2));
const shouldCheckOnly = args.has("--check");
const shouldRestore = args.has("--restore");
const backupDir = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(projectRoot, "backups");

const liveDatabaseUrl = process.env.LIVE_DATABASE_URL || process.env.DATABASE_URL;
const localDatabaseUrl =
  process.env.LOCAL_DATABASE_URL ||
  buildLocalDatabaseUrl({
    host: process.env.LOCAL_DB_HOST || process.env.DB_HOST || "localhost",
    port: process.env.LOCAL_DB_PORT || process.env.DB_PORT || "5432",
    user: process.env.LOCAL_DB_USER || process.env.DB_USER || "postgres",
    password: process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.LOCAL_DB_NAME || process.env.DB_NAME || "labour_db",
  });

function buildLocalDatabaseUrl({ host, port, user, password, database }) {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const auth = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function maskUrl(url) {
  return url ? url.replace(/:[^:@]+@/, ":****@") : "(none)";
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function getTables(client) {
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return rows.map((r) => r.tablename);
}

async function getColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, udt_name, character_maximum_length,
            numeric_precision, numeric_scale, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return rows;
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    [tableName]
  );
  return rows.length > 0;
}

function buildColumnType(col) {
  const dt = col.data_type;
  if (dt === "character varying") {
    return col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : "TEXT";
  }
  if (dt === "character") return col.character_maximum_length ? `CHAR(${col.character_maximum_length})` : "CHAR";
  if (dt === "integer") return "INTEGER";
  if (dt === "bigint") return "BIGINT";
  if (dt === "smallint") return "SMALLINT";
  if (dt === "boolean") return "BOOLEAN";
  if (dt === "text") return "TEXT";
  if (dt === "numeric" || dt === "decimal") {
    return col.numeric_precision ? `NUMERIC(${col.numeric_precision},${col.numeric_scale ?? 0})` : "NUMERIC";
  }
  if (dt === "real") return "REAL";
  if (dt === "double precision") return "DOUBLE PRECISION";
  if (dt === "timestamp with time zone") return "TIMESTAMPTZ";
  if (dt === "timestamp without time zone") return "TIMESTAMP";
  if (dt === "date") return "DATE";
  if (dt === "time without time zone") return "TIME";
  if (dt === "jsonb") return "JSONB";
  if (dt === "json") return "JSON";
  if (dt === "uuid") return "UUID";
  if (dt === "bytea") return "BYTEA";
  if (dt === "ARRAY") return `${col.udt_name.replace(/^_/, "")}[]`;
  if (dt === "USER-DEFINED") return col.udt_name;
  return dt.toUpperCase();
}

async function ensureTableExists(localClient, tableName, columns) {
  if (await tableExists(localClient, tableName)) return;
  const colDefs = columns.map((col) => {
    let def = `"${col.column_name}" ${buildColumnType(col)}`;
    if (col.is_nullable === "NO") def += " NOT NULL";
    if (col.column_default && !col.column_default.startsWith("nextval(")) {
      def += ` DEFAULT ${col.column_default}`;
    }
    return def;
  });
  const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(", ")})`;
  await localClient.query(sql);
  console.log(`  Created table: ${tableName}`);
}

async function copyTableData(liveClient, localClient, tableName, columns) {
  const colNames = columns.map((c) => `"${c.column_name}"`).join(", ");
  const { rows } = await liveClient.query(`SELECT ${colNames} FROM "${tableName}"`);
  if (rows.length === 0) return 0;

  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let paramCount = 0;

    for (const row of batch) {
      const rowParams = columns.map(() => `$${++paramCount}`);
      values.push(`(${rowParams.join(", ")})`);
      for (const col of columns) {
        params.push(row[col.column_name] ?? null);
      }
    }

    await localClient.query(
      `INSERT INTO "${tableName}" (${colNames}) VALUES ${values.join(", ")}`,
      params
    );
  }
  return rows.length;
}

async function syncSequences(liveClient, localClient) {
  const { rows: seqs } = await liveClient.query(`
    SELECT sequencename, last_value
    FROM pg_sequences
    WHERE schemaname = 'public' AND last_value IS NOT NULL
  `);

  for (const seq of seqs) {
    try {
      await localClient.query(`SELECT setval('"${seq.sequencename}"', $1, true)`, [
        seq.last_value,
      ]);
    } catch {
      // sequence may not exist locally — skip
    }
  }
  if (seqs.length > 0) {
    console.log(`  Synced ${seqs.length} sequences`);
  }
}

async function runCheck() {
  if (!liveDatabaseUrl) {
    throw new Error("LIVE_DATABASE_URL or DATABASE_URL is required in .env");
  }
  if (!localDatabaseUrl) {
    throw new Error("LOCAL_DATABASE_URL or LOCAL_DB_* variables are required in .env");
  }
  if (liveDatabaseUrl === localDatabaseUrl) {
    throw new Error("Live and local database URLs are the same — refusing to continue");
  }

  console.log("Live DB   :", maskUrl(liveDatabaseUrl));
  console.log("Local DB  :", maskUrl(localDatabaseUrl));
  console.log("Backup dir:", backupDir);
  console.log("");

  const liveClient = new Client({ connectionString: liveDatabaseUrl });
  await liveClient.connect();
  const { rows: lv } = await liveClient.query("SELECT version()");
  console.log("Live DB connected  :", lv[0].version.split(" ").slice(0, 2).join(" "));
  const liveTables = await getTables(liveClient);
  console.log("Live tables        :", liveTables.length, `(${liveTables.join(", ")})`);
  await liveClient.end();

  const localClient = new Client({ connectionString: localDatabaseUrl });
  await localClient.connect();
  const { rows: lc } = await localClient.query("SELECT version()");
  console.log("Local DB connected :", lc[0].version.split(" ").slice(0, 2).join(" "));
  await localClient.end();

  console.log("\nConfig OK — ready to sync. Run:");
  console.log("  npm run db:backup        -> save live data to JSON files");
  console.log("  npm run db:sync-local    -> copy live data directly into local DB");
}

async function runBackup() {
  if (!liveDatabaseUrl) throw new Error("LIVE_DATABASE_URL is required in .env");

  const liveClient = new Client({ connectionString: liveDatabaseUrl });
  await liveClient.connect();

  const tables = await getTables(liveClient);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `backup-${timestamp()}.json`);
  const backup = { createdAt: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    const columns = await getColumns(liveClient, table);
    const colNames = columns.map((c) => `"${c.column_name}"`).join(", ");
    const { rows } = await liveClient.query(`SELECT ${colNames} FROM "${table}"`);
    backup.tables[table] = rows;
    console.log(`  Backed up ${table}: ${rows.length} rows`);
  }

  await liveClient.end();
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\nBackup saved to: ${backupFile}`);
}

async function runSync() {
  if (!liveDatabaseUrl) throw new Error("LIVE_DATABASE_URL is required in .env");
  if (!localDatabaseUrl) throw new Error("LOCAL_DATABASE_URL is required in .env");
  if (liveDatabaseUrl === localDatabaseUrl) {
    throw new Error("Live and local database URLs are the same — refusing to continue");
  }

  const liveClient = new Client({ connectionString: liveDatabaseUrl });
  const localClient = new Client({ connectionString: localDatabaseUrl });

  await liveClient.connect();
  await localClient.connect();

  try {
    const tables = await getTables(liveClient);
    console.log(`Found ${tables.length} tables in live DB\n`);

    // Disable FK constraints for the session
    await localClient.query("SET session_replication_role = replica");

    // Disable all triggers on each table individually as extra safety
    for (const table of tables) {
      if (await tableExists(localClient, table)) {
        await localClient.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
      }
    }

    for (const table of tables) {
      const columns = await getColumns(liveClient, table);
      await ensureTableExists(localClient, table, columns);

      await localClient.query(`DELETE FROM "${table}"`);
      const count = await copyTableData(liveClient, localClient, table, columns);
      console.log(`  ${table}: ${count} rows`);
    }

    await syncSequences(liveClient, localClient);

    // Re-enable triggers
    for (const table of tables) {
      if (await tableExists(localClient, table)) {
        await localClient.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
      }
    }

    await localClient.query("SET session_replication_role = DEFAULT");

    console.log("\nSync complete — local DB is up to date with live DB.");
  } finally {
    await liveClient.end().catch(() => {});
    await localClient.end().catch(() => {});
  }
}

async function main() {
  if (shouldCheckOnly) {
    await runCheck();
  } else if (shouldRestore) {
    await runSync();
  } else {
    await runBackup();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
