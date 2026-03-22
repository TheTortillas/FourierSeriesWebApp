import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { config } from "../../config/env";
import { TokenService } from "./tokenService";
import type { IUserRepository } from "../../domain/interfaces/repositories/IUserRepository";
import type { ITokenRepository } from "../../domain/interfaces/repositories/ITokenRepository";
import type { IAuditRepository } from "../../domain/interfaces/repositories/IAuditRepository";

const googleClient = new OAuth2Client(config.google.clientId);
const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "user" | "admin";
    tier: "free" | "premium";
    emailVerified: boolean;
  };
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
  }): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      provider: "email",
    });

    const tokens = this.tokenService.generateTokenPair(user);

    await this.tokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      familyId: tokens.familyId,
      ipAddress: input.ipAddress,
      expiresAt: tokens.expiresAt,
    });

    await this.auditRepo.log({
      userId: user.id,
      action: "register",
      ipAddress: input.ipAddress,
      metadata: { provider: "email" },
    });

    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
  }

  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
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

    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
  }

  async loginWithGoogle(input: {
    idToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new Error("Invalid Google token");
    }

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
        user = await this.userRepo.create({
          firstName: payload.given_name ?? "User",
          lastName: payload.family_name ?? "",
          email: payload.email,
          provider: "google",
          providerId: payload.sub,
        });

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

    return this.buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
  }

  async refresh(input: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
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

    return this.buildAuthResult(
      user,
      newTokens.accessToken,
      newTokens.refreshToken,
    );
  }

  async logout(input: {
    refreshToken: string;
    userId: string;
    ipAddress?: string;
  }): Promise<void> {
    const tokenHash = this.tokenService.hashToken(input.refreshToken);
    const stored = await this.tokenRepo.findRefreshToken(tokenHash);

    if (stored) {
      await this.tokenRepo.revokeFamily(stored.familyId);
    }

    await this.auditRepo.log({
      userId: input.userId,
      action: "logout",
      ipAddress: input.ipAddress,
    });
  }

  private buildAuthResult(
    user: ReturnType<typeof Object.assign>,
    accessToken: string,
    refreshToken: string,
  ): AuthResult {
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
      },
    };
  }
}
