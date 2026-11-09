import { redirect } from 'next/navigation';
import LearningApp from '@/components/nihongo/learning-app';

export default async function LearnPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  if (section[0] === 'sensei') redirect('/learn');
  return <LearningApp section={section} />;
}
