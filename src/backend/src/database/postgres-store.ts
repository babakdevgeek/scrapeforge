import { inferColumns, normalizeRow, safeName } from './schema-inference.js';
import type { Column, DataStore, WriteOptions, WriteResult } from './types.js';

const PG_TYPE: Record<Column['type'], string> = {
  TEXT: 'text',
  INTEGER: 'bigint',
  REAL: 'double precision',
  BOOLEAN: 'boolean',
  JSON: 'jsonb',
};

/** Optional sink. `pg` is an optional dependency, so it is imported lazily. */
export class PostgresStore implements DataStore {
  driver = 'postgres' as const;
  private pool: any;

  private constructor(pool: unknown) {
    this.pool = pool;
  }

  static async connect(connectionString: string) {
    let pg: any;
    try {
      pg = await import('pg');
    } catch {
      throw new Error('PostgreSQL support needs the optional "pg" package: npm i pg -w @scrapeforge/backend');
    }
    const Pool = pg.default?.Pool ?? pg.Pool;
    const pool = new Pool({ connectionString, max: 4 });
    await pool.query('SELECT 1');
    return new PostgresStore(pool);
  }

  async write(rows: Record<string, unknown>[], options: WriteOptions): Promise<WriteResult> {
    const table = safeName(options.table);
    const columns = inferColumns(rows);
    const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (\n  id bigserial PRIMARY KEY,\n${columns
      .map((c) => `  "${c.name}" ${PG_TYPE[c.type]}`)
      .join(',\n')},\n  _scraped_at timestamptz DEFAULT now()\n);`;

    if (options.mode === 'replace') await this.pool.query(`DROP TABLE IF EXISTS "${table}"`);
    await this.pool.query(ddl);
    for (const column of columns) {
      await this.pool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column.name}" ${PG_TYPE[column.type]}`);
    }

    const dedupe = (options.dedupeOn ?? []).map(safeName).filter((c) => columns.some((col) => col.name === c));
    if (dedupe.length) {
      await this.pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ux_${table}_${dedupe.join('_')}" ON "${table}" (${dedupe
          .map((c) => `"${c}"`)
          .join(', ')})`,
      );
    }

    const names = columns.map((c) => c.name);
    const conflict =
      dedupe.length && options.mode === 'upsert'
        ? ` ON CONFLICT (${dedupe.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${names
            .filter((n) => !dedupe.includes(n))
            .map((n) => `"${n}" = EXCLUDED."${n}"`)
            .join(', ')}`
        : dedupe.length
          ? ' ON CONFLICT DO NOTHING'
          : '';

    let inserted = 0;
    for (const row of rows) {
      const normalized = normalizeRow(row, columns);
      const values = names.map((n) => normalized[n]);
      const result = await this.pool.query(
        `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) VALUES (${names
          .map((_, i) => `$${i + 1}`)
          .join(', ')})${conflict}`,
        values,
      );
      inserted += result.rowCount ?? 0;
    }

    return { inserted, updated: 0, skipped: rows.length - inserted, table, columns, ddl };
  }

  async listTables() {
    const { rows } = await this.pool.query(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const out: { name: string; rows: number }[] = [];
    for (const row of rows) {
      const count = await this.pool.query(`SELECT COUNT(*)::int AS count FROM "${row.name}"`);
      out.push({ name: row.name, rows: count.rows[0].count });
    }
    return out;
  }

  async read(table: string, limit = 100, offset = 0) {
    const { rows } = await this.pool.query(`SELECT * FROM "${safeName(table)}" ORDER BY id DESC LIMIT $1 OFFSET $2`, [
      limit,
      offset,
    ]);
    return rows;
  }

  async drop(table: string) {
    await this.pool.query(`DROP TABLE IF EXISTS "${safeName(table)}"`);
  }

  async close() {
    await this.pool.end();
  }
}
