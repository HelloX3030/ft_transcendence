import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().nonempty(),
});

const passwordSchema = z
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

export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(260).optional(),
});
