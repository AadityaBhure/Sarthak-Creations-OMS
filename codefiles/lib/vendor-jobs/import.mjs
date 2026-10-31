import { BusinessError, validateMaster } from './domain.mjs';

export const IMPORT_COLUMNS = {
  vendors: {
    'Vendor Name': 'name',
    Address: 'address',
    'Concerned Person(s)': 'concerned_persons',
    'Concerned Person Contact(s)': 'concerned_contacts',
    'Job Capabilities': 'job_capabilities',
  },
  papers: { 'Paper Type Name': 'name' },
};

export function prepareImport(kind, rows, existing, jobs = [], force = false) {
  if (!Object.hasOwn(IMPORT_COLUMNS, kind)) throw new BusinessError('Import is unavailable for this master.', 404);
  if (!Array.isArray(rows) || !rows.length) throw new BusinessError('No data provided.');
  const names = new Map(existing.map(row => [row.name.trim().toLowerCase(), row]));
  const jobNames = new Map(jobs.filter(row => !row.deleted_at).map(row => [row.name.trim().toLowerCase(), row.id]));
  const records = [], skippedRows = [], missing = new Set();
  for (const input of rows) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      skippedRows.push({ reason: 'Invalid row' });
      continue;
    }
    const row = Object.fromEntries(Object.values(IMPORT_COLUMNS[kind]).map(key => [key, String(input[key] ?? '').trim()]));
    const data = { name: row.name };
    if (kind === 'vendors') {
      const capabilities = [...new Set(row.job_capabilities.split(';').map(name => name.trim().toLowerCase()).filter(Boolean))];
      const unknown = capabilities.filter(name => !jobNames.has(name));
      if (unknown.length) {
        unknown.forEach(name => missing.add(name));
        skippedRows.push({ ...row, reason: `Job Capabilities not found or deleted: ${unknown.join('; ')}` });
        continue;
      }
      Object.assign(data, { address: row.address, concerned_persons: row.concerned_persons, concerned_contacts: row.concerned_contacts, capabilities: capabilities.map(name => jobNames.get(name)) });
    }
    try { validateMaster(kind, data); } catch (error) {
      skippedRows.push({ ...row, reason: error.message });
      continue;
    }
    const key = row.name.toLowerCase();
    if (names.has(key)) {
      skippedRows.push({ ...row, reason: names.get(key).deleted_at ? 'Already exists in Recycle Bin—restore it first.' : 'Duplicate name' });
      continue;
    }
    names.set(key, row);
    records.push({ row, data });
  }
  if (missing.size && !force) return {
    requiresConfirmation: true,
    message: `These Job Capabilities do not exist or are deleted: ${[...missing].join('; ')}. Vendors using them will be skipped.`,
  };
  return { records, skippedRows };
}

// Each save is atomic: a vendor and all capability links succeed together.
export async function saveImport(plan, save, audit) {
  const insertedRows = [], skippedRows = [...plan.skippedRows];
  for (let start = 0; start < plan.records.length; start += 200) {
    for (const { row, data } of plan.records.slice(start, start + 200)) {
      let result;
      try {
        result = await save(data);
      } catch (error) {
        skippedRows.push({ ...row, reason: error.code === '23505' ? 'Duplicate name' : error.code === 'P0001' ? error.message : 'Could not save this record. Please retry.' });
        continue;
      }
      insertedRows.push(row);
      await audit(result);
    }
  }
  return { success: true, inserted: insertedRows.length, skipped: skippedRows.length, insertedRows, skippedRows };
}
