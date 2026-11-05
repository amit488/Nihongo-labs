'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });

export type AuthActionResult = { success: boolean; message: string; authenticated?: boolean };

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and a password of at least 8 characters.' };
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 80);
  const supabase = await createServerSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: displayName || parsed.data.email.split('@')[0] },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/learn`,
    },
  });
  if (error) return { success: false, message: error.message };
  if (!data.session) return { success: true, message: 'Account created. Check your email to confirm your address, then sign in.' };
  return { success: true, authenticated: true, message: 'Account created successfully.' };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { success: false, message: 'Enter a valid email and password.' };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { success: false, message: error.message };
  return { success: true, authenticated: true, message: 'Signed in successfully.' };
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Signed out.' };
}
