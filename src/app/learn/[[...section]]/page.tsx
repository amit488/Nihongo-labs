import LearningApp from '@/components/nihongo/learning-app';

export default async function LearnPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  return <LearningApp section={section} />;
}
