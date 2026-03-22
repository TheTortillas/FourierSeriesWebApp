export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export interface ITokenRepository {
  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(
    oldId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenRecord>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
  createEmailToken(input: {
    userId: string;
    tokenHash: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void>;
  findEmailToken(
    tokenHash: string,
    purpose: string,
  ): Promise<{
    id: string;
    userId: string;
    usedAt: Date | null;
    expiresAt: Date;
  } | null>;
  markEmailTokenUsed(id: string): Promise<void>;
  createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findPasswordReset(tokenHash: string): Promise<{
    id: string;
    userId: string;
    usedAt: Date | null;
    expiresAt: Date;
  } | null>;
  markPasswordResetUsed(id: string): Promise<void>;
  findPendingVerificationToken(
    userId: string,
  ): Promise<{ expiresAt: Date } | null>;
}
