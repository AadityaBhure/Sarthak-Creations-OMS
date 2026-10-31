export const MASTER_TABLES = {
  vendors: 'vjt_vendors',
  jobs: 'vjt_job_types',
  papers: 'vjt_paper_types',
};
export const JOB_STATUSES = ['Active', 'Hold', 'Completed', 'Canceled'];
export const FIELDS = [
  { key: 'serial_number', label: 'Count', type: 'number' },
  { key: 'job_card_number', label: 'Job Card Number', type: 'text' },
  {
    key: 'current_vendor',
    filter: 'current_vendor_id',
    label: 'Current Vendor',
    type: 'select',
    master: 'vendors',
  },
  {
    key: 'current_job',
    filter: 'current_job_id',
    label: 'Current Job',
    type: 'select',
    master: 'jobs',
  },
  { key: 'job_title', label: 'Job Title', type: 'text' },
  { key: 'product_type', filter: 'product_type_id', label: 'Product Type', type: 'select', master: 'products' },
  { key: 'created_at', label: 'Date of Entry', type: 'date' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  {
    key: 'paper_type',
    filter: 'paper_type_id',
    label: 'Paper Type',
    type: 'select',
    master: 'papers',
  },
  { key: 'days_at_current_job', label: 'Days', type: 'number' },
  { key: 'total_days', label: 'Total Days', type: 'number' },
  { key: 'vendor_history', label: 'Vendor History', type: 'text' },
  { key: 'status', label: 'Status', type: 'select' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];
export const OPERATORS = {
  text: [
    ['eq', 'Is'],
    ['neq', 'Is Not'],
    ['ilike', 'Contains'],
  ],
  select: [
    ['eq', 'Is'],
    ['neq', 'Is Not'],
  ],
  number: [
    ['eq', '='],
    ['gt', '>'],
    ['lt', '<'],
    ['gte', '>='],
    ['lte', '<='],
    ['between', 'Between'],
  ],
  date: [
    ['eq', 'On'],
    ['lt', 'Before'],
    ['gt', 'After'],
    ['gte', 'On or After'],
    ['lte', 'On or Before'],
    ['between', 'Between'],
  ],
};
export class BusinessError extends Error {
  constructor(message, status = 400, code = 'VALIDATION') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function uuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function requiredId(value, label) {
  if (!uuid(value)) throw new BusinessError(`Select a valid ${label}.`);
}
export function validateMutation(action, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BusinessError('Invalid form data.');
  const allowed = {
    create: [
      'job_title', 'product_type_id',
      'quantity',
      'paper_type_id',
      'remarks',
      'vendor_id',
      'job_type_id',
      'job_card_number',
      'expected_number',
      'created_at',
      'confirm_duplicate',
    ],
    update: [
      'job_title', 'product_type_id',
      'revision',
      'quantity',
      'paper_type_id',
      'remarks',
      'job_card_number',
      'confirm_duplicate',
    ],
    progress: ['revision', 'vendor_id', 'job_type_id'],
    sequence: ['revision', 'stages'],
    complete: ['revision'],
    reopen: ['revision', 'confirm_duplicate'],
    save: [
      'job_title', 'product_type_id',
      'revision',
      'quantity',
      'paper_type_id',
      'remarks',
      'job_card_number',
      'confirm_duplicate',
      'vendor_id',
      'job_type_id',
      'status',
    ],
    delete: ['revision'],
    restore: ['revision'],
    purge: ['revision'],
  }[action];
  if (!allowed) throw new BusinessError('This action is not available.');
  if (Object.keys(input).some((k) => !allowed.includes(k)))
    throw new BusinessError(
      'This change is not available in the current workflow.',
    );
  if (
    action !== 'create' &&
    (!Number.isInteger(input.revision) || input.revision < 1)
  )
    throw new BusinessError('Refresh this record before saving.');
  if (action === 'create' || 'quantity' in input) {
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 2147483647
    )
      throw new BusinessError(
        'Quantity must be a positive whole number no greater than 2,14,74,83,647.',
      );
  }
  if (action === 'create' || 'paper_type_id' in input)
    requiredId(input.paper_type_id, 'Paper Type');
  if (
    'job_card_number' in input &&
    (typeof input.job_card_number !== 'string' ||
      !input.job_card_number.trim() ||
      input.job_card_number.length > 100)
  )
    throw new BusinessError('Enter a Job Card Number of 1–100 characters.');
  if ('remarks' in input && typeof input.remarks !== 'string')
    throw new BusinessError('Remarks must be text.');
  if ('job_title' in input && (typeof input.job_title !== 'string' || input.job_title.length > 200))
    throw new BusinessError('Job Title must be text of up to 200 characters.');
  if ('product_type_id' in input && input.product_type_id !== null && !uuid(input.product_type_id))
    throw new BusinessError('Select a valid Product Type.');
  if ('status' in input && !JOB_STATUSES.includes(input.status))
    throw new BusinessError('Select a valid Status.');
  if (
    'expected_number' in input &&
    (typeof input.expected_number !== 'string' ||
      !/^JB\d+$/.test(input.expected_number))
  )
    throw new BusinessError('Refresh the suggested Job Card Number.');
  if ('expected_number' in input && 'job_card_number' in input)
    throw new BusinessError(
      'Use either the suggested number or a manual number.',
    );
  if (
    'created_at' in input &&
    (typeof input.created_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.created_at) ||
      !Number.isFinite(Date.parse(input.created_at)))
  )
    throw new BusinessError('Enter a valid Date of Entry.');
  if (action === 'save' && ('vendor_id' in input || 'job_type_id' in input)) {
    requiredId(input.vendor_id, 'Vendor');
    requiredId(input.job_type_id, 'Job Type');
  }
  if (
    'confirm_duplicate' in input &&
    typeof input.confirm_duplicate !== 'boolean'
  )
    throw new BusinessError('Confirm the duplicate number before saving.');
  if (['create', 'progress'].includes(action)) {
    requiredId(input.vendor_id, 'Vendor');
    requiredId(input.job_type_id, 'Job Type');
  }
  if (action === 'sequence') {
    if (!Array.isArray(input.stages) || !input.stages.length)
      throw new BusinessError('Keep at least one stage in the Vendor History.');
    const ids = new Set();
    for (const stage of input.stages) {
      if (
        !stage ||
        Object.keys(stage).some(
          (k) => !['id', 'vendor_id', 'job_type_id', 'started_at'].includes(k),
        )
      )
        throw new BusinessError('Invalid history stage.');
      requiredId(stage.vendor_id, 'Vendor');
      requiredId(stage.job_type_id, 'Job Type');
      if (stage.id !== undefined) {
        requiredId(stage.id, 'stage');
        if (ids.has(stage.id))
          throw new BusinessError('A history stage cannot appear twice.');
        ids.add(stage.id);
      }
      if (
        'started_at' in stage &&
        (typeof stage.started_at !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(
            stage.started_at,
          ) ||
          !Number.isFinite(Date.parse(stage.started_at)))
      )
        throw new BusinessError('Enter a valid stage date and time.');
    }
  }
  return input;
}
export function validateMaster(kind, input, editing = false) {
  if (!MASTER_TABLES[kind])
    throw new BusinessError('Unknown master list.', 404);
  const keys =
    kind === 'vendors'
      ? [
          'name',
          'revision',
          'address',
          'concerned_persons',
          'concerned_contacts',
          'capabilities',
        ]
      : ['name', 'revision'];
  if (!input || Object.keys(input).some((k) => !keys.includes(k)))
    throw new BusinessError('Invalid master data.');
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 200
  )
    throw new BusinessError('Name must contain 1–200 characters.');
  if (editing && (!Number.isInteger(input.revision) || input.revision < 1))
    throw new BusinessError('Refresh this record before saving.');
  for (const field of ['address', 'concerned_persons', 'concerned_contacts'])
    if (field in input && typeof input[field] !== 'string')
      throw new BusinessError('Contact and address fields must be text.');
  if (
    kind === 'vendors' &&
    (!Array.isArray(input.capabilities) ||
      input.capabilities.some((id) => !uuid(id)))
  )
    throw new BusinessError('Select valid Job Capabilities.');
  return { ...input, name: input.name.trim() };
}

// Mirrors Module 1's AND groups joined by OR and PostgREST filter interface.
// Only Module 2 fields/operators are accepted. Dates are calendar days in IST.
export function filterExpression(filters = [], fields = FIELDS) {
  if (!Array.isArray(filters) || filters.length > 40)
    throw new BusinessError('Use no more than 40 filter rules.');
  const groups = [];
  let group = [];
  const quote = (value) =>
    `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  for (const rule of filters) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule))
      throw new BusinessError('Select a valid filter rule.');
    const field = fields.find((f) => (f.filter || f.key) === rule.column);
    if (!field || !OPERATORS[field.type].some(([op]) => op === rule.operator))
      throw new BusinessError('Select a valid filter field and operator.');
    if (rule.logic && !['and', 'or'].includes(rule.logic))
      throw new BusinessError('Select AND or OR.');
    if (rule.value !== '' && rule.value !== undefined && rule.value !== null) {
      const col = rule.column;
      const op = rule.operator;
      const value = (val) => {
        if (field.type === 'number') {
          if (val === '' || !Number.isFinite(Number(val)))
            throw new BusinessError('Enter a numeric filter value.');
          return String(Number(val));
        }
        if (field.type === 'select' && field.master) {
          requiredId(val, field.label);
          return quote(val);
        }
        if (field.type === 'select' && !JOB_STATUSES.includes(val))
          throw new BusinessError('Select a valid Status.');
        return quote(val);
      };
      if (field.type === 'date') {
        const day = (val) => {
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(val) ||
            !Number.isFinite(Date.parse(val))
          )
            throw new BusinessError('Select a valid filter date.');
          return new Date(`${val}T00:00:00+05:30`);
        };
        const start = day(rule.value);
        const end = new Date(start.getTime() + 86400000);
        if (op === 'eq')
          group.push(
            `${col}.gte.${quote(start.toISOString())}`,
            `${col}.lt.${quote(end.toISOString())}`,
          );
        else if (op === 'between') {
          const last = day(rule.valueTo);
          if (last < start)
            throw new BusinessError('The end date must follow the start date.');
          group.push(
            `${col}.gte.${quote(start.toISOString())}`,
            `${col}.lt.${quote(new Date(last.getTime() + 86400000).toISOString())}`,
          );
        } else
          group.push(
            `${col}.${op === 'gt' ? 'gte' : op === 'lte' ? 'lt' : op}.${quote((op === 'gt' || op === 'lte' ? end : start).toISOString())}`,
          );
      } else if (op === 'between') {
        if (
          rule.valueTo === '' ||
          rule.valueTo === undefined ||
          Number(rule.valueTo) < Number(rule.value)
        )
          throw new BusinessError('Enter a valid numeric range.');
        group.push(
          `${col}.gte.${value(rule.value)}`,
          `${col}.lte.${value(rule.valueTo)}`,
        );
      } else
        group.push(
          `${col}.${op}.${value(op === 'ilike' ? `%${rule.value}%` : rule.value)}`,
        );
    }
    if (rule.logic === 'or' && group.length) {
      groups.push(group);
      group = [];
    }
  }
  if (group.length) groups.push(group);
  return groups
    .map((g) => (g.length > 1 ? `and(${g.join(',')})` : g[0]))
    .join(',');
}
