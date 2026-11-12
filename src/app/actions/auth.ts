'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import {
  KEEP_SIGNED_IN_COOKIE_NAME,
  KEEP_SIGNED_IN_MAX_AGE_SECONDS,
} from '@/lib/nihongo/auth-session';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
const emailOnly = z.object({ email: z.string().trim().email().max(254) });

export type AuthActionResult = {
  success: boolean;
  message: string;
  authenticated?: boolean;
  requiresEmailConfirmation?: boolean;
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
    const duplicateEmail = ['user_already_exists', 'email_exists'].includes(error.code ?? '')
      || /already registered|already exists/i.test(error.message);
    if (duplicateEmail) {
      // Keep duplicate-email responses indistinguishable from a normal pending
      // signup so the action cannot be used to enumerate registered accounts.
      return {
        success: true,
        requiresEmailConfirmation: true,
        message: 'If this address can be registered, a confirmation email will arrive shortly.',
      };
    }
    console.error('[Nihongo Labs signup]', error);
    return { success: false, message: 'We could not create your account. Check your details and try again.' };
  }

  // Supabase returns an obfuscated user with no identities for duplicate-email
  // signups. Return the same generic pending state used for ordinary signup.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      message: 'If this address can be registered, a confirmation email will arrive shortly.',
    };
  }

  if (!data.session) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      message: 'If this address can be registered, a confirmation email will arrive shortly.',
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

  if (error) console.error('[Nihongo Labs resend signup confirmation]', error);
  return { success: true, message: 'If this address has a pending signup, a fresh verification email is on its way.' };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and password.' };
  const keepSignedIn = formData.get('keepSignedIn') === 'on';
  const supabase = await createServerSupabase({ keepSignedIn });
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { success: false, message: 'Invalid email or password, or additional verification is required.' };
  }

  const cookieStore = await cookies();
  if (keepSignedIn) {
    cookieStore.set(KEEP_SIGNED_IN_COOKIE_NAME, '1', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: KEEP_SIGNED_IN_MAX_AGE_SECONDS,
    });
  } else {
    cookieStore.delete(KEEP_SIGNED_IN_COOKIE_NAME);
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
  const cookieStore = await cookies();
  cookieStore.delete(KEEP_SIGNED_IN_COOKIE_NAME);
  return { success: true, message: 'Signed out.' };
}
