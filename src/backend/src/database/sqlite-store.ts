import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { inferColumns, normalizeRow, safeName } from './schema-inference.js';
import type { Column, DataStore, WriteOptions, WriteResult } from './types.js';

const SQLITE_TYPE: Record<Column['type'], string> = {
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  REAL: 'REAL',
  BOOLEAN: 'INTEGER',
  JSON: 'TEXT',
};

/** Default sink. Creates the destination table from the scraped shape on first write. */
export class SqliteStore implements DataStore {
  driver = 'sqlite' as const;
  private db: Database.Database;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new Database(path.resolve(file));
    this.db.pragma('journal_mode = WAL');
  }

  private existingColumns(table: string): string[] {
    const rows = this.db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  private ddlFor(table: string, columns: Column[]) {
    const body = columns.map((c) => `  "${c.name}" ${SQLITE_TYPE[c.type]}`).join(',\n');
    return `CREATE TABLE IF NOT EXISTS "${table}" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n${body},\n  "_scraped_at" TEXT DEFAULT CURRENT_TIMESTAMP\n);`;
  }

  async write(rows: Record<string, unknown>[], options: WriteOptions): Promise<WriteResult> {
    const table = safeName(options.table);
    const columns = inferColumns(rows);
    const ddl = this.ddlFor(table, columns);

    if (options.mode === 'replace') this.db.exec(`DROP TABLE IF EXISTS "${table}";`);
    this.db.exec(ddl);

    const present = new Set(this.existingColumns(table));
    for (const column of columns) {
      if (!present.has(column.name)) {
        this.db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column.name}" ${SQLITE_TYPE[column.type]};`);
      }
    }

    const dedupe = (options.dedupeOn ?? []).map(safeName).filter((c) => columns.some((col) => col.name === c));
    if (dedupe.length) {
      this.db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ux_${table}_${dedupe.join('_')}" ON "${table}" (${dedupe
          .map((c) => `"${c}"`)
          .join(', ')});`,
      );
    }

    const names = columns.map((c) => c.name);
    const conflict =
      dedupe.length && options.mode === 'upsert'
        ? ` ON CONFLICT(${dedupe.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${names
            .filter((n) => !dedupe.includes(n))
            .map((n) => `"${n}" = excluded."${n}"`)
            .join(', ')}`
        : dedupe.length
          ? ' ON CONFLICT DO NOTHING'
          : '';

    const statement = this.db.prepare(
      `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) VALUES (${names
        .map((n) => `@${n}`)
        .join(', ')})${conflict}`,
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const insertAll = this.db.transaction((batch: Record<string, unknown>[]) => {
      for (const row of batch) {
        const result = statement.run(normalizeRow(row, columns) as never);
        if (result.changes === 0) skipped += 1;
        else if (conflict.includes('DO UPDATE') && result.lastInsertRowid === 0) updated += 1;
        else inserted += 1;
      }
    });
    insertAll(rows);

    return { inserted, updated, skipped, table, columns, ddl };
  }

  async listTables() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    return tables.map(({ name }) => {
      const { count } = this.db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as { count: number };
      return { name, rows: count };
    });
  }

  async read(table: string, limit = 100, offset = 0) {
    return this.db
      .prepare(`SELECT * FROM "${safeName(table)}" ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(limit, offset) as Record<string, unknown>[];
  }

  async drop(table: string) {
    this.db.exec(`DROP TABLE IF EXISTS "${safeName(table)}";`);
  }

  async close() {
    this.db.close();
  }
}
