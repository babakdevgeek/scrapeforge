import ExcelJS from 'exceljs';

function flatten(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function collectColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

export function toCsv(rows: Record<string, unknown>[], columns = collectColumns(rows)): string {
  const escape = (value: string) => (/[",\n;]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value);
  const head = columns.map(escape).join(',');
  const body = rows.map((row) => columns.map((c) => escape(flatten(row[c]))).join(','));
  return [head, ...body].join('\n');
}

export function toJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2);
}

export async function toXlsx(rows: Record<string, unknown>[], sheetName = 'Scraped'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ScrapeForge';
  const sheet = workbook.addWorksheet(sheetName.slice(0, 30));
  const columns = collectColumns(rows);

  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(48, Math.max(14, key.length + 6)) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(Object.fromEntries(columns.map((c) => [c, flatten(row[c])])));
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: Math.max(1, columns.length) } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
