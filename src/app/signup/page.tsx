import AuthForm from '@/components/nihongo/auth-form';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const { confirmation } = await searchParams;
  return <AuthForm mode="signup" confirmationError={confirmation === 'failed'} />;
}
