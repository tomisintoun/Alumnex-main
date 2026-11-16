import { z } from "zod";
export const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72)
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  );
export const text = (max = 200) => z.string().trim().min(1).max(max);
export const email = z.string().trim().toLowerCase().email().max(254);
export const signupSchema = z.object({
  name: text(100),
  email,
  password,
  role: z.enum(["student", "alumni", "employer"]),
});
export const profileSchema = z.object({
  name: text(100),
  title: z.string().trim().max(150),
  company: z.string().trim().max(150),
  faculty: z.string().trim().max(100),
  department: z.string().trim().max(100),
  graduation: z
    .string()
    .max(4)
    .regex(/^$|^(19|20)\d{2}$/),
  level: z.string().max(30),
  location: z.string().trim().max(100),
  industry: z.string().trim().max(100),
  bio: z.string().trim().max(3000),
  skills: z.array(text(50)).max(30),
  interests: z.array(text(50)).max(30),
  mentorAvailable: z.boolean(),
  visibility: z.enum(["network", "connections", "private"]),
  messages: z.enum(["connections", "network", "nobody"]),
  online: z.boolean(),
});
export const resourceSchema = z.object({
  kind: z.enum([
    "opportunity",
    "event",
    "community",
    "campaign",
    "announcement",
  ]),
  title: text(160),
  description: text(15000),
  status: z.enum(["draft", "pending", "published", "closed"]).default("draft"),
  data: z.object({
    type: z.string().max(60).default(""),
    location: z.string().max(100).default(""),
    industry: z.string().max(80).default(""),
    arrangement: z.enum(["", "Remote", "Hybrid", "On-site"]).default(""),
    salary: z.string().max(80).default(""),
    deadline: z.string().max(40).default(""),
    startsAt: z.string().max(40).default(""),
    endsAt: z.string().max(40).default(""),
    capacity: z.number().int().min(1).max(100000).optional(),
    requirements: z.string().max(5000).default(""),
    skills: z.array(text(50)).max(30).default([]),
    goal: z.number().int().min(100).max(1000000000).optional(),
  }),
});
export const applicationSchema = z.object({
  answers: text(10000),
  availability: text(100),
  resumeId: z.string().uuid(),
  consent: z.literal(true),
});
export const mentorshipSchema = z.object({
  mentorId: z.string().uuid(),
  reason: text(2000),
  goal: text(2000),
  learn: text(2000),
  format: z.enum(["Video", "Phone", "Chat", "In-person"]),
  frequency: z.enum(["Weekly", "Biweekly", "Monthly"]),
});
export const itemSchema = z
  .object({
    kind: z.enum(["goal", "session", "resource", "feedback"]),
    title: text(300),
    body: z.string().trim().max(5000).default(""),
    when: z.string().max(40).default(""),
    done: z.boolean().default(false),
    rating: z.number().int().min(1).max(5).optional(),
    url: z.string().max(1000).default(""),
  })
  .superRefine((d, ctx) => {
    if (
      d.kind === "session" &&
      (!d.when || !Number.isFinite(Date.parse(d.when)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid session date.",
        path: ["when"],
      });
    if (d.kind === "resource" && d.url && !/^https:\/\//.test(d.url))
      ctx.addIssue({
        code: "custom",
        message: "Use a secure https:// link.",
        path: ["url"],
      });
    if (d.kind === "feedback" && !d.rating)
      ctx.addIssue({
        code: "custom",
        message: "Select a rating.",
        path: ["rating"],
      });
  });
