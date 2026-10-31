import DeletedRecords from '@/components/vendor-jobs/DeletedRecords';
export default async function Page({ searchParams }) {
  const { tab } = await searchParams;
  return <DeletedRecords key={tab || 'vendors'} initialTab={tab} />;
}
