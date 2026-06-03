import { z } from 'zod';

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
  image: z
    .instanceof(File)
    .refine((file) => file.size <= 1024 * 1024, 'Max 1MB')
    .refine((file) => file.type === 'image/png', 'Only PNG allowed')
    .optional(),
});
