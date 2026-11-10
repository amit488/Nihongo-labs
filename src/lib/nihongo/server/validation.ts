import { z } from 'zod';

export const progressSchema = z.object({
  lessonId: z.string().uuid(),
  status: z.enum(['in_progress', 'completed']),
  lastPositionSeconds: z.number().int().min(0).max(86400).default(0),
  studySeconds: z.number().int().min(0).max(3600).optional(),
}).strict();

export const startAttemptSchema = z.object({ quizId: z.string().uuid() }).strict();

export const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  responses: z.array(z.object({
    questionId: z.string().uuid(),
    response: z.unknown(),
  }).strict()).max(200),
}).strict().superRefine((data, context) => {
  const ids = data.responses.map((item) => item.questionId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'A question may only be answered once.', path: ['responses'] });
});

export const createFlashcardSessionSchema = z.object({
  deckId: z.string().uuid(),
  mode: z.enum(['new', 'review', 'mixed', 'custom']).default('mixed'),
}).strict();

export const flashcardReviewSchema = z.object({
  flashcardId: z.string().uuid(),
  sessionId: z.string().uuid(),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  responseTimeMs: z.number().int().min(0).max(3600000).optional(),
}).strict();

export const checkoutSchema = z.object({ planCode: z.string().min(2).max(64), idempotencyKey: z.string().min(8).max(128) }).strict();
export const verifyPaymentSchema = z.object({ orderId: z.string().min(5).max(80), paymentId: z.string().min(5).max(80), signature: z.string().min(20).max(256) }).strict();

export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().min(1).max(80).optional(),
  showRomaji: z.boolean().optional(),
  showFurigana: z.boolean().optional(),
  preferredJlptLevel: z.enum(['N5', 'N4']).optional(),
  dailyStudyGoalMinutes: z.number().int().min(1).max(600).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required.');

export const bookmarkSchema = z.object({
  resourceType: z.enum(['lesson', 'vocabulary', 'kanji', 'grammar', 'quiz']),
  resourceId: z.string().uuid(),
}).strict();


export const idSchema = z.object({ id: z.string().uuid() }).strict();
export const sessionIdSchema = z.object({ sessionId: z.string().uuid() }).strict();
export const subscriptionIdSchema = z.object({ subscriptionId: z.string().uuid() }).strict();
export const vocabularyReviewSchema = z.object({
  vocabularyId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
}).strict();
export const vocabularyProgressSchema = z.object({
  vocabularyId: z.string().uuid(),
}).strict();
export const billingProfileSchema = z.object({
  billingName: z.string().trim().min(1).max(120).optional(),
  billingEmail: z.string().email().max(254).optional(),
  phone: z.string().trim().max(30).optional(),
  countryCode: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).optional(),
  address: z.record(z.string(), z.unknown()).optional(),
  taxId: z.string().trim().max(40).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one billing field is required.');
export const syncPlanSchema = z.object({ planId: z.string().uuid() }).strict();


export const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().min(1).max(1_000_000_000),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{10,80}$/),
  reason: z.string().trim().max(1000).optional(),
}).strict();
