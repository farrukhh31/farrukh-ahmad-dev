import { z } from "zod";

/**
 * Validation shared by the browser (instant feedback) and the server (the one that matters).
 * Single-line fields reject CR/LF outright - that is what email header injection needs.
 */
export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  subject: { min: 3, max: 120 },
  message: { min: 10, max: 2000 },
} as const;

// control characters except tab / newline (kept for the message body)
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g;

const text = (s: string) => s.normalize("NFKC").replace(CONTROL, "").trim();
const singleLine = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .refine((s) => !/[\r\n\u2028\u2029]/.test(s), `${label} must be a single line.`)
    .transform(text);

export const ContactSchema = z.object({
  name: singleLine("Name")
    .pipe(z.string().min(LIMITS.name.min, `Name must be at least ${LIMITS.name.min} characters.`))
    .pipe(z.string().max(LIMITS.name.max, `Name must be under ${LIMITS.name.max} characters.`)),
  email: singleLine("Email")
    .pipe(z.string().max(LIMITS.email.max, "Email is too long."))
    .pipe(z.email("Please enter a valid email address."))
    .transform((s) => s.toLowerCase()),
  subject: singleLine("Subject")
    .pipe(z.string().min(LIMITS.subject.min, `Subject must be at least ${LIMITS.subject.min} characters.`))
    .pipe(z.string().max(LIMITS.subject.max, `Subject must be under ${LIMITS.subject.max} characters.`)),
  message: z
    .string({ error: "Message is required." })
    .transform((s) => text(s).replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n"))
    .pipe(z.string().min(LIMITS.message.min, `Message must be at least ${LIMITS.message.min} characters.`))
    .pipe(z.string().max(LIMITS.message.max, `Message must be under ${LIMITS.message.max} characters.`)),
});

export type ContactInput = z.infer<typeof ContactSchema>;
export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

export function validateContact(
  raw: unknown,
): { ok: true; data: ContactInput } | { ok: false; errors: FieldErrors } {
  const result = ContactSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ContactInput | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
