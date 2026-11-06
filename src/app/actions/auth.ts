'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

const emailAddress = z.string().trim().toLowerCase().email().max(254);

export type AuthActionResult = {
  success: boolean;
  message: string;
  authenticated?: boolean;
  confirmationRequired?: boolean;
  email?: string;
};

/**
 * Use an explicit app origin for Auth redirects. Falling back to localhost in
 * production can send a real user's confirmation email to the wrong site.
 */
function getAuthCallbackUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = configuredSiteUrl || (
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
  );

  if (!siteUrl) {
    throw new Error('Set NEXT_PUBLIC_SITE_URL to your deployed Nihongo Labs URL before enabling signup.');
  }

  const callback = new URL('/auth/callback', siteUrl);
  callback.searchParams.set('next', '/learn');
  return callback.toString();
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { success: false, message: 'Enter a valid email and a password of at least 8 characters.' };
  }

  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 80);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: displayName || parsed.data.email.split('@')[0] },
      emailRedirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) return { success: false, message: error.message };

  // With Confirm Email enabled, Supabase deliberately returns no session
  // until the user follows the confirmation link.
  if (!data.session) {
    return {
      success: true,
      confirmationRequired: true,
      email: parsed.data.email,
      message: 'Check your inbox for a confirmation link. You must confirm your email before signing in.',
    };
  }

  // Keep the no-confirmation local/hosted mode functional if an environment
  // explicitly disables Confirm Email, though the recommended setting is ON.
  return { success: true, authenticated: true, message: 'Account created successfully.' };
}

export async function resendSignupConfirmationAction(emailInput: string): Promise<AuthActionResult> {
  const parsed = emailAddress.safeParse(emailInput);
  if (!parsed.success) {
    return { success: false, message: 'Enter a valid email address before requesting another confirmation email.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data,
    options: { emailRedirectTo: getAuthCallbackUrl() },
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit') {
      return { success: false, message: 'A confirmation email was requested recently. Wait a little before trying again.' };
    }
    // Do not reveal whether an email address has an account or is already confirmed.
    return {
      success: false,
      message: 'We could not resend the confirmation email. Check the address and try again later.',
    };
  }

  return {
    success: true,
    message: 'If this address has a pending signup, a fresh confirmation email has been sent. Check your inbox and spam folder.',
  };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and password.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error?.code === 'email_not_confirmed') {
    return {
      success: false,
      confirmationRequired: true,
      email: parsed.data.email,
      message: 'Confirm your email address before signing in. You can request another confirmation email below.',
    };
  }
  if (error) return { success: false, message: error.message };

  return { success: true, authenticated: true, message: 'Signed in successfully.' };
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Signed out.' };
}
