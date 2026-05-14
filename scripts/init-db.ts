import { getDb } from "../lib/db";

const db = getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Database initialised. Tables:");
for (const t of tables as { name: string }[]) console.log("  -", t.name);
