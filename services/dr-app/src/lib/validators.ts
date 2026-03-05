import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().optional().or(z.literal("")),
  description: z.string().max(240).optional().or(z.literal("")),
  startAt: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  inviteEmails: z.array(z.string().email("Invalid email")).optional(),
  language: z.enum(["EN", "IT"]).default("EN"),
  transcriptionProvider: z.enum(["DEEPGRAM", "DEEPGRAMLIVE", "VOSK"]).default("DEEPGRAMLIVE"),
  timezone: z.string().max(100).optional().nullable(),
  dataspaceId: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  requiresApproval: z.boolean().optional().default(false),
  capacity: z.number().int().positive().optional().nullable()
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email")
});

export const linkTranscriptionSchema = z.object({
  roundId: z.string().min(1, "Round ID is required")
});

export const deactivateMeetingSchema = z.object({
  confirm: z.boolean().optional()
});

export const createPlanSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().max(240).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start time is required"),
  roundDurationMinutes: z.number().int().positive().max(240),
  roundsCount: z.number().int().positive().max(100),
  participantIds: z.array(z.string().min(1)),
  inviteEmails: z.array(z.string().email("Invalid email")).optional(),
  syncMode: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
  maxParticipantsPerRoom: z.number().int().min(2).max(12).default(2),
  allowOddGroup: z.boolean().optional().default(false),
  dataspaceId: z.string().optional().nullable(),
  language: z.enum(["EN", "IT"]).default("EN"),
  transcriptionProvider: z.enum(["DEEPGRAM", "VOSK"]).default("DEEPGRAM"),
  timezone: z.string().max(100).optional().nullable(),
  meditationEnabled: z.boolean().optional().default(false),
  meditationAtStart: z.boolean().optional().default(false),
  meditationBetweenRounds: z.boolean().optional().default(false),
  meditationAtEnd: z.boolean().optional().default(false),
  meditationDurationMinutes: z.number().int().min(1).max(15).default(5),
  meditationAnimationId: z.string().optional().nullable(),
  meditationAudioUrl: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  requiresApproval: z.boolean().optional().default(false),
  capacity: z.number().int().positive().optional().nullable(),
  blocks: z
    .array(
      z.object({
        type: z.enum(["PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING"]),
        durationSeconds: z.number().int().min(1).max(7200),
        roundMaxParticipants: z.number().int().min(2).max(12).optional().nullable(),
        formQuestion: z.string().trim().max(240).optional().nullable(),
        formChoices: z
          .array(
            z.object({
              key: z.string().min(1).max(80),
              label: z.string().min(1).max(120)
            })
          )
          .optional()
          .nullable(),
        posterId: z.string().optional().nullable(),
        embedUrl: z.string().trim().max(500).optional().nullable(),
        matchingMode: z.enum(["polar", "anti"]).optional().nullable(),
        meditationAnimationId: z.string().optional().nullable(),
        meditationAudioUrl: z.string().optional().nullable()
      })
    )
    .optional()
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "USER"])
});

export const adminResetPasswordSchema = z
  .object({
    newPassword: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12)
  })
  .refine((data) => /[a-zA-Z]/.test(data.newPassword), {
    message: "Password must include at least one letter",
    path: ["newPassword"]
  })
  .refine((data) => /[0-9]/.test(data.newPassword), {
    message: "Password must include at least one number",
    path: ["newPassword"]
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12),
    code: z.string().optional().or(z.literal("")),
    acceptPolicy: z.literal(true, {
      errorMap: () => ({ message: "Please accept the privacy policy" })
    })
  })
  .refine((data) => /[a-zA-Z]/.test(data.password), {
    message: "Password must include at least one letter",
    path: ["password"]
  })
  .refine((data) => /[0-9]/.test(data.password), {
    message: "Password must include at least one number",
    path: ["password"]
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const createDataspaceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional().or(z.literal("")),
  imageUrl: z
    .string()
    .trim()
    .url("Image URL must be valid")
    .or(z.string().regex(/^\/api\/uploads\/[a-z-]+\/[A-Za-z0-9._-]+$/))
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #F97316")
    .optional()
    .or(z.literal(""))
});

export const updateDataspaceSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().max(500).optional().or(z.literal("")),
  imageUrl: z
    .string()
    .trim()
    .url("Image URL must be valid")
    .or(z.string().regex(/^\/api\/uploads\/[a-z-]+\/[A-Za-z0-9._-]+$/))
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #F97316")
    .optional()
    .or(z.literal("")),
  notifyAllActivity: z.boolean().optional(),
  notifyMeetings: z.boolean().optional(),
  notifyPlans: z.boolean().optional(),
  notifyTexts: z.boolean().optional(),
  rssEnabled: z.boolean().optional()
});

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12)
  })
  .refine((data) => /[a-zA-Z]/.test(data.newPassword), {
    message: "Password must include at least one letter",
    path: ["newPassword"]
  })
  .refine((data) => /[0-9]/.test(data.newPassword), {
    message: "Password must include at least one number",
    path: ["newPassword"]
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const profileSettingsSchema = z.object({
  telegramHandle: z
    .string()
    .trim()
    .max(64, "Telegram handle is too long")
    .optional()
    .or(z.literal("")),
  calComLink: z
    .string()
    .trim()
    .max(200, "Cal.com link is too long")
    .optional()
    .or(z.literal("")),
  avatarUrl: z
    .string()
    .trim()
    .url("Avatar URL must be valid")
    .or(z.string().regex(/^\/api\/uploads\/[a-z-]+\/[A-Za-z0-9._-]+$/))
    .optional()
    .or(z.literal("")),
  notifyEmailMeetingInvites: z.boolean().optional(),
  notifyTelegramMeetingInvites: z.boolean().optional(),
  notifyEmailPlanInvites: z.boolean().optional(),
  notifyTelegramPlanInvites: z.boolean().optional(),
  notifyEmailDataspaceInvites: z.boolean().optional(),
  notifyTelegramDataspaceInvites: z.boolean().optional(),
  notifyEmailDataspaceActivity: z.boolean().optional(),
  notifyTelegramDataspaceActivity: z.boolean().optional()
});

export const dataspacePreferenceSchema = z.object({
  notifyAllActivity: z.boolean().optional(),
  notifyMeetings: z.boolean().optional(),
  notifyPlans: z.boolean().optional(),
  notifyTexts: z.boolean().optional()
});

export const changeEmailSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required")
});
