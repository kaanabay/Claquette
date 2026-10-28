import { getTableName, sql, type Column } from "drizzle-orm";

/**
 * `"table"."column"` regardless of query shape. Drizzle renders columns unqualified in
 * single-table queries, so an outer reference inside a correlated sql`` subquery could bind
 * to the inner table; use this for such references.
 */
export function qualified(column: Column) {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
}
