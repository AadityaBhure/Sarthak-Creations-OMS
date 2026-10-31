import { BusinessError, filterExpression, uuid } from './domain.mjs';

export const LEDGER_FIELDS = [
  { key: 'vendor', filter: 'vendor_id', label: 'Vendor', type: 'select', master: 'vendors' },
  { key: 'job_type', filter: 'job_type_id', label: 'Work / Job Type', type: 'select', master: 'jobs' },
  { key: 'stage_started_at', label: 'Stage Date / Time', type: 'date' },
  { key: 'stage_number', label: 'Stage No.', type: 'number' },
  { key: 'serial_number', label: 'Count', type: 'number' },
  { key: 'job_card_number', label: 'Job Card Number', type: 'text' },
  { key: 'job_title', label: 'Job Title', type: 'text' },
  { key: 'quantity', label: 'Batch Quantity', type: 'number' },
  { key: 'product_type', filter: 'product_type_id', label: 'Product Type', type: 'select', master: 'products' },
  { key: 'paper_type', filter: 'paper_type_id', label: 'Paper Type', type: 'select', master: 'papers' },
  { key: 'status', label: 'Current Job Status', type: 'select' },
  { key: 'deleted_at', label: 'Deleted On', type: 'date' },
];

export function ledgerQuery(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BusinessError('Invalid ledger search.');
  const { page = 1, limit = 50, vendorId = null, includeDeleted = false, filters = [], sort = { column: 'stage_started_at', direction: 'desc' } } = input;
  if (!Number.isInteger(page) || page < 1 || page > 1000000 || ![25, 50, 100, 200].includes(limit)) throw new BusinessError('Select a valid page and page size.');
  if (vendorId !== null && !uuid(vendorId)) throw new BusinessError('Select a valid vendor.');
  if (typeof includeDeleted !== 'boolean') throw new BusinessError('Select a valid Deleted Records option.');
  if (!sort || !LEDGER_FIELDS.some(f => f.key === sort.column) || !['asc', 'desc'].includes(sort.direction)) throw new BusinessError('Select a valid sort column.');
  return { page, limit, vendorId, includeDeleted, sort, expression: filterExpression(filters, LEDGER_FIELDS) };
}
