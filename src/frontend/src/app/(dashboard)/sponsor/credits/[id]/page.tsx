import { CreditProgramDetail } from '@/components/credits/credit-program-detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreditProgramDetail programId={id} />;
}
