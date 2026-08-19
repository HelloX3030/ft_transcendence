import { z } from 'zod';
import { WATCHLIST_NAME_MAX_LENGTH } from '@cinemates/shared';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().nonempty(),
});

export const userEditSchema = z.object({
  username: z.string().min(6),
  email: z.string().email(),
});

// Exported so the reset form reuses it rather than becoming a third definition
// of "strong password" that drifts away from this one and the backend's.
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .refine((val) => /[a-z]/.test(val), 'Must contain at least one lowercase letter.')
  .refine((val) => /[A-Z]/.test(val), 'Must contain at least one uppercase letter.')
  .refine((val) => /\d/.test(val), 'Must contain at least one number.')
  .refine((val) => /[\W_]/.test(val), 'Must contain at least one special character.');

export const registerSchema = z
  .object({
    username: z.string().min(6),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'The passwords did not match',
        path: ['confirmPassword'],
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'The passwords did not match',
        path: ['confirmPassword'],
      });
    }
  });

// .trim() before .min(1) is what rejects a whitespace-only name, and it also
// means the trimmed value is what gets submitted.
const watchlistName = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(WATCHLIST_NAME_MAX_LENGTH, `Name must be at most ${WATCHLIST_NAME_MAX_LENGTH} characters`);

export const createListSchema = z.object({ name: watchlistName });
export const updateListSchema = z.object({ name: watchlistName.optional() });
