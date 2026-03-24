import { Router, Request, Response, NextFunction } from "express";
import { authService, userRepository } from "../../infrastructure/container";
import { authenticate, optionalAuth } from "../middlewares/authenticate";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { config } from "../../config/env";

export const authRouter = Router();

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: !config.server.isDevelopment,
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string, example: "Juan" }
 *               lastName: { type: string, example: "Pérez" }
 *               email: { type: string, example: "juan@email.com" }
 *               password: { type: string, example: "password123" }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Email ya registrado o datos inválidos
 */
authRouter.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, email, password } = req.body as {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
      };

      if (!firstName || !lastName || !email || !password) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      if (password.length < 8) {
        res
          .status(400)
          .json({ error: "Password must be at least 8 characters" });
        return;
      }

      const result = await authService.register({
        firstName,
        lastName,
        email,
        password,
        ipAddress: req.ip,
      });

      setRefreshCookie(res, result.refreshToken);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "Email already registered") {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
authRouter.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as {
        email: string;
        password: string;
      };

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const result = await authService.login({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      setRefreshCookie(res, result.refreshToken);
      res.json(result);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "Invalid credentials" ||
          err.message === "Account is deactivated")
      ) {
        res.status(401).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/google:
 *   post:
 *     summary: Iniciar sesión con Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string }
 *     responses:
 *       200:
 *         description: Login con Google exitoso
 *       401:
 *         description: Token de Google inválido
 */
authRouter.post(
  "/google",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { idToken } = req.body as { idToken: string };

      if (!idToken) {
        res.status(400).json({ error: "idToken is required" });
        return;
      }

      const result = await authService.loginWithGoogle({
        idToken,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      setRefreshCookie(res, result.refreshToken);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid Google token") {
        res.status(401).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Tokens renovados
 *       401:
 *         description: Refresh token inválido o expirado
 */
authRouter.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token: string | undefined =
        req.cookies?.[REFRESH_COOKIE] ?? (req.body as { refreshToken?: string }).refreshToken;

      if (!token) {
        res.status(400).json({ error: "refreshToken is required" });
        return;
      }

      const result = await authService.refresh({
        refreshToken: token,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      setRefreshCookie(res, result.refreshToken);
      res.json(result);
    } catch (err) {
      if (err instanceof Error) {
        res.status(401).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
authRouter.post(
  "/logout",
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token: string | undefined =
        req.cookies?.[REFRESH_COOKIE] ?? (req.body as { refreshToken?: string }).refreshToken;

      if (!token) {
        res.status(400).json({ error: "refreshToken is required" });
        return;
      }

      await authService.logout({
        refreshToken: token,
        userId: req.user!.id,
        ipAddress: req.ip,
      });

      clearRefreshCookie(res);
      res.json({ message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: No autenticado
 */
authRouter.get(
  "/me",
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  },
);

authRouter.get(
  "/verify-email",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }
      await authService.verifyEmail(token);
      res.json({ message: "Email verified successfully" });
    } catch (err) {
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

authRouter.post(
  "/forgot-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body as { email: string };
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }
      await authService.forgotPassword(email, req.ip);
      res.json({
        message: "If that email exists you will receive a reset link",
      });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body as {
        token: string;
        newPassword: string;
      };
      if (!token || !newPassword) {
        res.status(400).json({ error: "Token and newPassword are required" });
        return;
      }
      if (newPassword.length < 8) {
        res
          .status(400)
          .json({ error: "Password must be at least 8 characters" });
        return;
      }
      await authService.resetPassword({
        token,
        newPassword,
        ipAddress: req.ip,
      });
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

authRouter.post(
  "/resend-verification",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body as { email: string };
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }
      await authService.resendVerification(email, req.ip);
      res.json({ message: "Verification email sent if account exists" });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/auth/quota:
 *   get:
 *     summary: Obtener cuota de cálculos semanal del usuario actual
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuota de cálculos
 */
authRouter.get(
  "/quota",
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let used: number;
      let limit: number;

      if (req.user) {
        const tier = req.user.tier;
        limit =
          tier === "premium"
            ? config.calcLimits.premium
            : config.calcLimits.free;
        used = await userRepository.getWeeklyCount(req.user.id);
      } else {
        limit = config.calcLimits.anonymous;
        used = await userRepository.getAnonymousWeeklyCount(
          req.ip ?? "0.0.0.0",
        );
      }

      const remaining = limit === -1 ? null : Math.max(0, limit - used);
      res.json({ used, limit, remaining });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/change-password",
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "currentPassword and newPassword are required" });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }

      await authService.changePassword({
        userId: req.user!.id,
        currentPassword,
        newPassword,
        ipAddress: req.ip,
      });

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);
