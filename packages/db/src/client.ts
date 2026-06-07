import type { PoolConfig } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema.js";

export type NeonClient = Pool;
export type PostgresJsClient = postgres.Sql;
export type PostgresClient = PostgresJsClient;
export type PostgresJsTransactionSql = postgres.TransactionSql;
export type DbClient = ReturnType<typeof createDbClient>;

export type CreateNeonClientOptions = Omit<PoolConfig, "connectionString">;
export type CreatePostgresJsClientOptions = NonNullable<
  Parameters<typeof postgres>[1]
>;
export type CreatePostgresClientOptions = CreatePostgresJsClientOptions;

export function createNeonClient(
  connectionString: string,
  options: CreateNeonClientOptions = {},
) {
  return new Pool({
    max: 10,
    ...options,
    connectionString,
  });
}

export function createPostgresJsClient(
  connectionString: string,
  options: CreatePostgresJsClientOptions = {},
) {
  return postgres(connectionString, {
    max: 10,
    ...options,
  });
}

export const createPostgresClient = createPostgresJsClient;

export function createPostgresJsDatabase(client: PostgresJsClient) {
  return drizzlePostgresJs(client, { schema });
}

export function getPostgresJsTransactionSql(transaction: unknown) {
  const client = (
    transaction as {
      readonly _?: {
        readonly session?: {
          readonly client?: PostgresJsTransactionSql;
        };
      };
    }
  )._?.session?.client;

  if (!client) {
    throw new Error("Expected a Drizzle postgres-js transaction client");
  }

  return client;
}

export function createDbClient(
  connectionString: string,
  options?: CreatePostgresJsClientOptions,
) {
  const client = createPostgresJsClient(connectionString, options);
  const db = createPostgresJsDatabase(client);

  return {
    client,
    db,
    async close() {
      await client.end();
    },
  };
}
