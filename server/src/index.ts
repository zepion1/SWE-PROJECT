import { API_PREFIX } from "@pharma/shared";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createContext } from "./context";
import { openDatabase } from "./db/connection";
import { runMigrations } from "./db/migrate";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const applied = runMigrations(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);

const app = createApp(createContext({ db }));
const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}${API_PREFIX} (${config.nodeEnv})`);
  console.log(`Database: ${config.databasePath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
