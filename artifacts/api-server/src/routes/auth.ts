import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, passwordResetsTable, settingsTable, sipConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { DEFAULT_USER_SETTINGS, DEFAULT_USER_SIP_CONFIG } from "../lib/defaults";
import { RegisterUserBody, LoginUserBody, ForgotPasswordBody, ResetPasswordBody } from "@workspace/api-zod";

const router = Router();

router.post("/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();

  // Create default settings and SIP config for new user
  await db
    .insert(settingsTable)
    .values({ userId: user.id, ...DEFAULT_USER_SETTINGS })
    .onConflictDoNothing();
  await db
    .insert(sipConfigsTable)
    .values({ userId: user.id, ...DEFAULT_USER_SIP_CONFIG })
    .onConflictDoNothing();

  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
    token,
  });
});

router.post("/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
    token,
  });
});

router.post("/logout", async (req, res): Promise<void> => {
  res.json({ message: "Logged out successfully" });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() });
});

router.post("/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  // Always respond with success to prevent email enumeration
  if (user) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db.insert(passwordResetsTable).values({ userId: user.id, otp, expiresAt });
    req.log.info({ email, otp }, "Password reset OTP generated");
  }

  res.json({ message: "If this email exists, a reset code has been sent" });
});

router.post("/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, otp, newPassword } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(400).json({ error: "Invalid reset request" });
    return;
  }

  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(eq(passwordResetsTable.userId, user.id))
    .orderBy(passwordResetsTable.createdAt)
    .limit(1);

  if (!reset || reset.otp !== otp || reset.usedAt || reset.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  await db.update(passwordResetsTable).set({ usedAt: new Date() }).where(eq(passwordResetsTable.id, reset.id));

  res.json({ message: "Password reset successfully" });
});

export default router;
