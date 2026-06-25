import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { config } from "../../config/env";
import { TokenService } from "./tokenService";
import type { IUserRepository } from "../../domain/interfaces/repositories/IUserRepository";
import type { ITokenRepository } from "../../domain/interfaces/repositories/ITokenRepository";
import type { IAuditRepository } from "../../domain/interfaces/repositories/IAuditRepository";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../infrastructure/email/emailService";

const googleClient = new OAuth2Client(config.google.clientId);
const BCRYPT_ROUNDS = 12;

/** Shape sent to the client in the JSON response body. No tokens beyond the access token. */
export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "user" | "admin";
    tier: "free" | "premium";
    emailVerified: boolean;
    hasDoneSurvey: boolean;
    hasDoneFeedback: boolean;
    avatarUrl: string | null;
    providers: ("email" | "google")[];
  };
}

/** Internal shape returned by auth methods — includes the refresh token so the router
 *  can set it as an httpOnly cookie without ever putting it in the JSON body. */
export interface AuthServiceResult extends AuthResult {
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: ITokenRepository,
    private readonly auditRepo: IAuditRepository,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    ipAddress?: string;
    lang?: string;
  }): Promise<AuthServiceResult> {
    const existing = await this.userRepo.findByEmail(input.email);

    if (existing) {
      if (existing.emailVerified) {
        throw new Error("Email already registered");
      }

      const pendingToken = await this.tokenRepo.findPendingVerificationToken(
        existing.id,
      );

      if (pendingToken && new Date() < pendingToken.expiresAt) {
        throw new Error(
          "Email already registered but not verified. Check your inbox or request a new verification email.",
        );
      }

      await this.userRepo.hardDeleteUnverified(existing.id);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    let user;
    try {
      user = await this.userRepo.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        provider: "email",
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "EMAIL_RECENTLY_DELETED") {
        throw Object.assign(new Error("EMAIL_RECENTLY_DELETED"), { code: "EMAIL_RECENTLY_DELETED" });
      }
      throw err;
    }

    const tokens = this.tokenService.generateTokenPair(user);

    await this.tokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      familyId: tokens.familyId,
      ipAddress: input.ipAddress,
      expiresAt: tokens.expiresAt,
    });

    const emailToken = this.tokenService.generateEmailToken();
    await this.tokenRepo.createEmailToken({
      userId: user.id,
      tokenHash: emailToken.hash,
      purpose: "email_verification",
      expiresAt: emailToken.expiresAt,
    });
    await sendVerificationEmail(user.email, user.firstName, emailToken.token, input.lang);

    await this.auditRepo.log({
      userId: user.id,
      action: "register",
      ipAddress: input.ipAddress,
      metadata: { provider: "email" },
    });

    const providers = await this.userRepo.getProviders(user.id);
    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken, providers);
  }

  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthServiceResult> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const tokens = this.tokenService.generateTokenPair(user);

    await this.tokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      familyId: tokens.familyId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: tokens.expiresAt,
    });

    await this.userRepo.updateLastLogin(user.id);

    await this.auditRepo.log({
      userId: user.id,
      action: "login",
      ipAddress: input.ipAddress,
      metadata: { provider: "email" },
    });

    const providers = await this.userRepo.getProviders(user.id);
    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken, providers);
  }

  async loginWithGoogle(input: {
    idToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthServiceResult> {
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new Error("Invalid Google token");
    }

    // Upgrade Google picture to 200px and strip trailing size param variations.
    const avatarUrl = payload.picture
      ? payload.picture.replace(/=s\d+-c$/, "=s200-c")
      : null;

    let user = await this.userRepo.findByGoogleId(payload.sub);

    if (!user) {
      user = await this.userRepo.findByEmail(payload.email);

      if (user) {
        await this.userRepo.linkGoogleAccount(user.id, payload.sub);
        await this.auditRepo.log({
          userId: user.id,
          action: "google_linked",
          ipAddress: input.ipAddress,
        });
      } else {
        try {
          user = await this.userRepo.create({
            firstName: payload.given_name ?? "User",
            lastName: payload.family_name ?? "",
            email: payload.email,
            provider: "google",
            providerId: payload.sub,
          });
        } catch (err: unknown) {
          if ((err as { code?: string }).code === "EMAIL_RECENTLY_DELETED") {
            throw Object.assign(new Error("EMAIL_RECENTLY_DELETED"), { code: "EMAIL_RECENTLY_DELETED" });
          }
          throw err;
        }

        await this.auditRepo.log({
          userId: user.id,
          action: "register",
          ipAddress: input.ipAddress,
          metadata: { provider: "google" },
        });
      }
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    // Sync avatar on every Google login so photo changes are picked up automatically.
    await this.userRepo.updateAvatarUrl(user.id, avatarUrl);
    user = { ...user, avatarUrl };

    const tokens = this.tokenService.generateTokenPair(user);

    await this.tokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      familyId: tokens.familyId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: tokens.expiresAt,
    });

    await this.userRepo.updateLastLogin(user.id);

    await this.auditRepo.log({
      userId: user.id,
      action: "login",
      ipAddress: input.ipAddress,
      metadata: { provider: "google" },
    });

    const providers = await this.userRepo.getProviders(user.id);
    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken, providers);
  }

  async refresh(input: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthServiceResult> {
    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const stored = await this.tokenRepo.findRefreshToken(tokenHash);

    if (!stored) {
      throw new Error("Invalid refresh token");
    }

    if (stored.revokedAt) {
      await this.tokenRepo.revokeFamily(stored.familyId);
      throw new Error("Refresh token reuse detected");
    }

    if (new Date() > stored.expiresAt) {
      throw new Error("Refresh token expired");
    }

    const user = await this.userRepo.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new Error("User not found or deactivated");
    }

    const newTokens = this.tokenService.generateTokenPair(
      user,
      stored.familyId,
    );

    await this.tokenRepo.rotateRefreshToken(
      stored.id,
      newTokens.refreshTokenHash,
      newTokens.expiresAt,
    );

    const providers = await this.userRepo.getProviders(user.id);
    return this.buildAuthResult(user, newTokens.accessToken, newTokens.refreshToken, providers);
  }

  async logout(input: {
    refreshToken: string;
    ipAddress?: string;
  }): Promise<void> {
    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const stored = await this.tokenRepo.findRefreshToken(tokenHash);

    if (stored) {
      await this.tokenRepo.revokeFamily(stored.familyId);
      await this.auditRepo.log({
        userId: stored.userId,
        action: "logout",
        ipAddress: input.ipAddress,
      });
    }
  }

  private buildAuthResult(
    user: ReturnType<typeof Object.assign>,
    accessToken: string,
    refreshToken: string,
    providers: ("email" | "google")[],
  ): AuthServiceResult {
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tier: user.tier,
        emailVerified: user.emailVerified,
        hasDoneSurvey: user.hasDoneSurvey ?? false,
        hasDoneFeedback: user.hasDoneFeedback ?? false,
        avatarUrl: user.avatarUrl ?? null,
        providers,
      },
    };
  }
  async verifyEmail(token: string): Promise<void> {
    const hash = this.tokenService.hashToken(token);
    const record = await this.tokenRepo.findEmailToken(
      hash,
      "email_verification",
    );

    if (!record) {
      throw new Error("Invalid verification token");
    }

    if (record.usedAt) {
      throw new Error("Token already used");
    }

    if (new Date() > record.expiresAt) {
      throw new Error("Token expired");
    }

    await this.tokenRepo.markEmailTokenUsed(record.id);
    await this.userRepo.markEmailVerified(record.userId);
  }

  async forgotPassword(email: string, ipAddress?: string, lang?: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return; // No revelar si el email existe

    const resetToken = this.tokenService.generatePasswordResetToken();
    await this.tokenRepo.createPasswordReset({
      userId: user.id,
      tokenHash: resetToken.hash,
      expiresAt: resetToken.expiresAt,
    });

    await sendPasswordResetEmail(user.email, user.firstName, resetToken.token, lang);

    await this.auditRepo.log({
      userId: user.id,
      action: "account_recovery_initiated",
      ipAddress,
    });
  }

  async resetPassword(input: {
    token: string;
    newPassword: string;
    ipAddress?: string;
  }): Promise<void> {
    const hash = this.tokenService.hashToken(input.token);
    const record = await this.tokenRepo.findPasswordReset(hash);

    if (!record || record.usedAt || new Date() > record.expiresAt) {
      throw new Error("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.updatePassword(record.userId, passwordHash);

    await this.tokenRepo.markPasswordResetUsed(record.id);
    await this.tokenRepo.revokeAllUserTokens(record.userId);

    await this.auditRepo.log({
      userId: record.userId,
      action: "password_change",
      ipAddress: input.ipAddress,
    });
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
  }): Promise<void> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new Error("User not found");

    if (!user.passwordHash) {
      throw new Error("Account uses Google sign-in. Use forgot password to set a password.");
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.updatePassword(input.userId, newHash);

    // Revoke all refresh tokens so any other active session is invalidated immediately.
    // The caller's current access token (15 min TTL) will expire on its own.
    await this.tokenRepo.revokeAllUserTokens(input.userId);

    await this.auditRepo.log({
      userId: input.userId,
      action: "password_change",
      ipAddress: input.ipAddress,
    });
  }

  async resendVerification(email: string, _ipAddress?: string, lang?: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || user.emailVerified) return;

    // Cooldown: silently skip if a token was sent within the last 5 minutes.
    // Prevents cross-IP email spam against known unverified addresses.
    const COOLDOWN_MS = 5 * 60 * 1000;
    const recent = await this.tokenRepo.findPendingVerificationToken(user.id);
    if (recent && Date.now() - recent.createdAt.getTime() < COOLDOWN_MS) return;

    const emailToken = this.tokenService.generateEmailToken();
    await this.tokenRepo.createEmailToken({
      userId: user.id,
      tokenHash: emailToken.hash,
      purpose: "email_verification",
      expiresAt: emailToken.expiresAt,
    });

    await sendVerificationEmail(user.email, user.firstName, emailToken.token, lang);
  }
}
