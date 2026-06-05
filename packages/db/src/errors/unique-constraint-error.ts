const UNIQUE_VIOLATION_CODE = "23505";

interface PostgresErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  detail?: unknown;
  table_name?: unknown;
}

export interface UniqueConstraintErrorOptions {
  cause?: unknown;
  constraint?: string;
  detail?: string;
  table?: string;
}

export class UniqueConstraintError extends Error {
  readonly constraint?: string;
  readonly detail?: string;
  readonly table?: string;

  constructor(
    message = "Unique constraint violated",
    options: UniqueConstraintErrorOptions = {},
  ) {
    super(message, { cause: options.cause });

    this.name = "UniqueConstraintError";
    this.constraint = options.constraint;
    this.detail = options.detail;
    this.table = options.table;
  }
}

function isPostgresErrorLike(error: unknown): error is PostgresErrorLike {
  return typeof error === "object" && error !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function isUniqueConstraintError(error: unknown) {
  if (error instanceof UniqueConstraintError) {
    return true;
  }

  return isPostgresErrorLike(error) && error.code === UNIQUE_VIOLATION_CODE;
}

export function toUniqueConstraintError(error: unknown) {
  if (error instanceof UniqueConstraintError) {
    return error;
  }

  if (!isPostgresErrorLike(error) || error.code !== UNIQUE_VIOLATION_CODE) {
    return null;
  }

  return new UniqueConstraintError(undefined, {
    cause: error,
    constraint: readString(error.constraint_name),
    detail: readString(error.detail),
    table: readString(error.table_name),
  });
}
