import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../config/database";
import { workspaceService } from "./workspace.service";
import { env } from "../config/env";
import { ConflictError, UnauthorizedError } from "../utils/errors";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResult {
  user: SafeUser;
  apiToken: string;
}

export class AuthService {
  async register(name: string, email: string, password: string): Promise<SafeUser> {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });

    // Give the new workspace its starter policies, merchants and agent,
    // so the dashboard is usable the moment they land on it.
    await workspaceService.bootstrap(user.id);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Sign in a Google user.
   *
   * Google users have no password, so they never go through register().
   * The first time one appears we create their row and bootstrap a
   * workspace, exactly like a password signup. After that we just return
   * the existing user, so their agents and policies persist.
   */
  async findOrCreateOAuthUser(email: string, name: string): Promise<LoginResult> {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: name || email.split("@")[0],
          email,
          password: null,
          role: Role.ADMIN,
        },
      });
      await workspaceService.bootstrap(user.id);
    }

    const apiToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.API_JWT_SECRET,
      { expiresIn: "24h" }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, apiToken };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const apiToken = jwt.sign(payload, env.API_JWT_SECRET, {
      expiresIn: "24h",
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      apiToken,
    };
  }
}

export const authService = new AuthService();
