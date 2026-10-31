// Explicit business-data scope: credentials and authentication configuration are excluded.
export const EXPORT_TABLES = [
  ['orders', ['id']], ['clients', ['id']], ['product_names', ['id']],
  ['product_types', ['id']], ['deleted_orders', ['id']],
  ['deleted_clients', ['id']], ['deleted_product_names', ['id']],
  ['deleted_product_types', ['id']], ['global_settings', ['id']],
  ['quick_views', ['id']],
  ['vjt_job_cards', ['id']], ['vjt_stages', ['id']],
  ['vjt_vendors', ['id']], ['vjt_job_types', ['id']], ['vjt_paper_types', ['id']],
  ['vjt_vendor_capabilities', ['vendor_id', 'job_type_id']],
  ['vjt_completed_intervals', ['id']], ['vjt_number_counter', ['id']],
  ['oms_number_counters', ['module']], ['oms_serial_register', ['module', 'record_id']],
];

export async function readExportTable(db, table, keys, pageSize = 500) {
  const rows = [];
  let total;
  do {
    let query = db.from(table).select('*', { count: 'exact' });
    for (const key of keys) query = query.order(key, { ascending: true });
    const { data, error, count } = await query.range(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(`Could not export ${table}.`);
    if (!Array.isArray(data) || !Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid export response for ${table}.`);
    }
    if (total !== undefined && count !== total) throw new Error('Records changed during export. Please try again.');
    total = count;
    if (!data.length && rows.length < total) throw new Error(`Incomplete export for ${table}.`);
    rows.push(...data);
  } while (rows.length < total);
  return rows;
}
