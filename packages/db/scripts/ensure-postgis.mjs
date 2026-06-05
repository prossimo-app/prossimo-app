import { config } from "dotenv";
import postgres from "postgres";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to enable PostGIS");
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public`;

  const [postgis] = await sql`
    SELECT
      extversion,
      extnamespace::regnamespace::text AS schema
    FROM pg_extension
    WHERE extname = 'postgis'
  `;

  const [geography] = await sql`
    SELECT to_regtype('public.geography')::text AS type
  `;

  if (!postgis || geography?.type !== "geography") {
    throw new Error(
      [
        "PostGIS is not available as public.geography.",
        postgis
          ? `Installed schema: ${postgis.schema}, version: ${postgis.extversion}.`
          : "PostGIS extension is not installed.",
        "Create or move the postgis extension into the public schema before running drizzle-kit push.",
      ].join(" "),
    );
  }
} finally {
  await sql.end();
}
