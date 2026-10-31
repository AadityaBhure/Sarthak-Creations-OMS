import { notFound } from 'next/navigation';
import Masters from '@/components/vendor-jobs/Masters';
export default async function Page({ params }) {
  const { kind } = await params;
  if (!['vendors', 'jobs', 'papers'].includes(kind)) notFound();
  return <Masters key={kind} kind={kind} />;
}
