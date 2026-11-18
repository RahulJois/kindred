/** RFC 4180 CSV: quoted fields may hold commas, newlines and doubled quotes. Returns rows of raw strings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Spreadsheet apps often save a UTF-8 BOM, which would otherwise stick to the first header.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines (a lone empty field).
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/** Rows of header-keyed records. Header names are lowercased and trimmed. */
export function parseCsvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [header = [], ...rows] = parseCsv(text);
  const headers = header.map((h) => h.trim().toLowerCase());
  const records = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  return { headers, records };
}

const csvField = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
