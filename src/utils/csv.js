/**
 * Minimal RFC-4180 CSV helpers — no external dependency. Handles quoted
 * fields containing commas, quotes, and newlines.
 */

function escapeField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Serializes rows to CSV text.
 * @param {Array<string>} headers
 * @param {Array<Array<*>>} rows
 * @returns {string}
 */
export function toCSV(headers, rows) {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Parses CSV text into an array of records keyed by the header row
 * (headers lowercased and trimmed). Returns { records, headers }.
 * @param {string} text
 * @returns {{headers: Array<string>, records: Array<Object>}}
 */
export function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    // Skip rows that are entirely empty (e.g. trailing newline).
    if (row.length > 1 || row[0].trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushField();
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }

  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const records = rows.slice(1).map(cells => {
    const record = {};
    headers.forEach((h, idx) => { record[h] = (cells[idx] ?? '').trim(); });
    return record;
  });
  return { headers, records };
}
