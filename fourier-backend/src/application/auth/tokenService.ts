import jwt from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config/env";
import type { UserRecord } from "../../domain/interfaces/repositories/IUserRepository";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: "user" | "admin";
  tier: "free" | "premium";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export class TokenService {
  generateAccessToken(user: UserRecord): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    };

    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  generateTokenPair(user: UserRecord, existingFamilyId?: string): TokenPair {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = this.hashToken(refreshToken);
    const familyId = existingFamilyId ?? uuidv4();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return { accessToken, refreshToken, refreshTokenHash, familyId, expiresAt };
  }

  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
  }

  generateEmailToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return { token, hash, expiresAt };
  }

  generatePasswordResetToken(): {
    token: string;
    hash: string;
    expiresAt: Date;
  } {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    return { token, hash, expiresAt };
  }
}
