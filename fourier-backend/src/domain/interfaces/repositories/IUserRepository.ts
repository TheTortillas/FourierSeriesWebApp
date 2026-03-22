export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string;
  provider?: "email" | "google";
  providerId?: string;
}

export interface UserRecord {
  id: string;
  personId: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string | null;
  role: "user" | "admin";
  tier: "free" | "premium";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  firstName: string;
  lastName: string;
}

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updateLastLogin(id: string): Promise<void>;
  updateTier(id: string, tier: "free" | "premium"): Promise<void>;
  softDelete(id: string): Promise<void>;
  linkGoogleAccount(userId: string, googleId: string): Promise<void>;
  hasProvider(userId: string, provider: "email" | "google"): Promise<boolean>;
  hardDeleteUnverified(id: string): Promise<void>;
  getWeeklyCount(userId: string): Promise<number>;
  incrementWeeklyCount(userId: string): Promise<void>;
}
