export function getQueryRows<Row>(result: unknown): Row[] {
  if (typeof result === "object" && result !== null && "rows" in result) {
    return (result as { rows: Row[] }).rows;
  }

  return Array.from(result as Iterable<Row>);
}
