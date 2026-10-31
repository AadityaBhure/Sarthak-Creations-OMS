import Tracking from '@/components/vendor-jobs/Tracking';

export default async function Page({ searchParams }) {
  const { filter_status } = await searchParams;
  const initialStatus = ['Active', 'Hold'].includes(filter_status) ? filter_status : '';
  return <Tracking key={initialStatus || 'all'} context="active" initialStatus={initialStatus} />;
}
