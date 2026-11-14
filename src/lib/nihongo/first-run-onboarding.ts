export function shouldLaunchFirstRunTour(userMetadata: unknown): boolean {
  if (!userMetadata || typeof userMetadata !== 'object' || Array.isArray(userMetadata)) return false;
  return (userMetadata as Record<string, unknown>).nihongo_onboarding === 'pending';
}
