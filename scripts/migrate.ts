import { runMigrations } from "../lib/db/migrate";
import { PATHS } from "../lib/db/index";

runMigrations();
// eslint-disable-next-line no-console
console.log(`Migrated ${PATHS.DB_PATH}`);
