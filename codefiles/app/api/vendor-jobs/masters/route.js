import { context, failure, allRows } from '@/lib/vendor-jobs/server';
export async function GET(request) {
  try {
    const { db } = await context(request);
    const includeDeleted =
      new URL(request.url).searchParams.get('includeDeleted') === 'true';
    const [vendors, jobs, papers, products, deletedProducts] = await Promise.all([
      allRows(db, 'vjt_vendors', '*, vjt_vendor_capabilities(job_type_id)'),
      allRows(db, 'vjt_job_types'),
      allRows(db, 'vjt_paper_types'),
      allRows(db, 'product_types'),
      includeDeleted ? allRows(db, 'deleted_product_types') : Promise.resolve([]),
    ]);
    return Response.json({
      products: [...products, ...deletedProducts.filter(p => !products.some(active => active.id === p.id)).map(p => ({ ...p, deleted_at: p.deleted_at || 'deleted' }))].sort((a, b) => a.name.localeCompare(b.name)),
      vendors: vendors
        .filter((v) => includeDeleted || !v.deleted_at)
        .map((v) => ({
          ...v,
          capabilities: v.vjt_vendor_capabilities.map((c) => c.job_type_id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      jobs: jobs
        .filter((v) => includeDeleted || !v.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name)),
      papers: papers
        .filter((v) => includeDeleted || !v.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    return failure(error);
  }
}
