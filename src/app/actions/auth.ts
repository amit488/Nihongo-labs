'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
const emailOnly = z.object({ email: z.string().trim().email().max(254) });

export type AuthActionResult = {
  success: boolean;
  message: string;
  authenticated?: boolean;
  requiresEmailConfirmation?: boolean;
  alreadyRegistered?: boolean;
  redirectTo?: string;
};

function getEmailRedirectUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL('/auth/callback?next=/learn', siteUrl).toString();
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and a password of at least 8 characters.' };

  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 80);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: displayName || parsed.data.email.split('@')[0] },
      emailRedirectTo: getEmailRedirectUrl(),
    },
  });

  if (error) {
    const alreadyRegistered = ['user_already_exists', 'email_exists'].includes(error.code ?? '') || /already registered|already exists/i.test(error.message);
    if (alreadyRegistered) {
      return {
        success: false,
        alreadyRegistered: true,
        message: 'An account with this email address already exists. Sign in instead, or use your account recovery option if you have forgotten your password.',
      };
    }
    return { success: false, message: error.message };
  }

  // Supabase intentionally returns an obfuscated user with no identities for
  // some duplicate-email signups, so the app must not claim an email was sent.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      success: false,
      alreadyRegistered: true,
      message: 'An account with this email address already exists. Sign in instead, or use your account recovery option if you have forgotten your password.',
    };
  }

  if (!data.session) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      message: 'Your account is almost ready. Open the verification link we sent to your inbox to finish signing up.',
    };
  }
  return { success: true, authenticated: true, message: 'Account created successfully.' };
}

export async function resendSignupConfirmationAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = emailOnly.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email address first.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: getEmailRedirectUrl() },
  });

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'If this address has a pending signup, a fresh verification email is on its way.' };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and password.' };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return { success: false, message: 'Please verify your email address using the link we sent before signing in.' };
    }
    return { success: false, message: error.message };
  }
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id);
  const administrator = !roleError && (roleRows ?? []).some((row) => row.role === 'super_admin' || row.role === 'admin');
  return {
    success: true,
    authenticated: true,
    redirectTo: administrator ? '/admin' : '/learn',
    message: 'Signed in successfully.',
  };
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Signed out.' };
}
