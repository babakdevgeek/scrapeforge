export type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'JSON';

export interface Column {
  name: string;
  type: ColumnType;
}

export interface WriteOptions {
  table: string;
  mode?: 'append' | 'upsert' | 'replace';
  dedupeOn?: string[];
}

export interface WriteResult {
  inserted: number;
  updated: number;
  skipped: number;
  table: string;
  columns: Column[];
  ddl: string;
}

export interface DataStore {
  driver: 'sqlite' | 'postgres';
  write(rows: Record<string, unknown>[], options: WriteOptions): Promise<WriteResult>;
  listTables(): Promise<{ name: string; rows: number }[]>;
  read(table: string, limit?: number, offset?: number): Promise<Record<string, unknown>[]>;
  drop(table: string): Promise<void>;
  close(): Promise<void>;
}
