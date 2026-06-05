import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://prossimo:prossimo@localhost:5432/prossimo";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  extensionsFilters: ["postgis"],
  out: "./drizzle",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
