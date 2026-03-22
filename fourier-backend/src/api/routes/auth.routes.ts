import { Router, Request, Response, NextFunction } from "express";
import { authService } from "../../infrastructure/container";
import { authenticate } from "../middlewares/authenticate";
import type { AuthenticatedRequest } from "../middlewares/authenticate";

export const authRouter = Router();

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
      const { refreshToken } = req.body as { refreshToken: string };

      if (!refreshToken) {
        res.status(400).json({ error: "refreshToken is required" });
        return;
      }

      const result = await authService.refresh({
        refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

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
      const { refreshToken } = req.body as { refreshToken: string };

      if (!refreshToken) {
        res.status(400).json({ error: "refreshToken is required" });
        return;
      }

      await authService.logout({
        refreshToken,
        userId: req.user!.id,
        ipAddress: req.ip,
      });

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
