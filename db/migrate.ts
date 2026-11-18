// Applies db/migrations/*.sql in filename order. Run with: npm run db:migrate (needs DATABASE_URL).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

/** Splits a migration file into statements. Migrations here contain no semicolons inside literals. */
export function splitStatements(sqlText: string): string[] {
  return sqlText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const statements = splitStatements(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
    for (const statement of statements) {
      await sql.query(statement);
    }
    console.log(`applied ${file}`);
  }
}

main().catch((error: unknown) => {
  console.error("migration failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
