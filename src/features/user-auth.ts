import { z } from "zod";

// User schema for validation
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(20),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  createdAt: z.date(),
  lastLoginAt: z.date().optional(),
});

export type User = z.infer<typeof UserSchema>;

// Authentication response types
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData extends LoginCredentials {
  username: string;
  firstName: string;
  lastName: string;
}

// Custom error classes
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * User Authentication Service
 * Handles user login, registration, token management, and session validation
 */
export class UserAuthService {
  private readonly apiBaseUrl: string;
  private currentUser: User | null = null;
  private accessToken: string | null = null;

  constructor(apiBaseUrl: string = "/api/auth") {
    this.apiBaseUrl = apiBaseUrl;
    this.loadStoredSession();
  }

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new ValidationError("Email and password are required");
      }

      const response = await fetch(`${this.apiBaseUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError("Invalid email or password");
        }
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const authData = (await response.json()) as AuthResponse;

      // Validate user data
      const validatedUser = UserSchema.parse(authData.user);

      // Store session
      this.currentUser = validatedUser;
      this.accessToken = authData.accessToken;
      this.storeSession(authData);

      return {
        ...authData,
        user: validatedUser,
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Register a new user account
   */
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      // Basic validation
      if (userData.password.length < 8) {
        throw new ValidationError(
          "Password must be at least 8 characters long",
        );
      }

      const response = await fetch(`${this.apiBaseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new ValidationError(errorData.message || "Registration failed");
      }

      const authData = (await response.json()) as AuthResponse;
      const validatedUser = UserSchema.parse(authData.user);

      this.currentUser = validatedUser;
      this.accessToken = authData.accessToken;
      this.storeSession(authData);

      return {
        ...authData,
        user: validatedUser,
      };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Log out current user and clear session
   */
  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await fetch(`${this.apiBaseUrl}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });
      }
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new AuthenticationError("No refresh token available");
      }

      const response = await fetch(`${this.apiBaseUrl}/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new AuthenticationError("Token refresh failed");
      }

      const { accessToken } = (await response.json()) as {
        accessToken: string;
      };
      this.accessToken = accessToken;
      localStorage.setItem("accessToken", accessToken);

      return accessToken;
    } catch (error) {
      console.error("Token refresh error:", error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.accessToken !== null;
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Validate current session and refresh if needed
   */
  async validateSession(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/validate`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        return true;
      }

      // Try to refresh token
      const newToken = await this.refreshAccessToken();
      return newToken !== null;
    } catch (error) {
      console.error("Session validation error:", error);
      return false;
    }
  }

  /**
   * Store authentication session in localStorage
   */
  private storeSession(authData: AuthResponse): void {
    try {
      localStorage.setItem("user", JSON.stringify(authData.user));
      localStorage.setItem("accessToken", authData.accessToken);
      localStorage.setItem("refreshToken", authData.refreshToken);
      localStorage.setItem(
        "tokenExpiry",
        String(Date.now() + authData.expiresIn * 1000),
      );
    } catch (error) {
      console.warn("Failed to store session:", error);
    }
  }

  /**
   * Load stored session from localStorage
   */
  private loadStoredSession(): void {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("accessToken");
      const tokenExpiry = localStorage.getItem("tokenExpiry");

      if (storedUser && storedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        if (Date.now() < expiryTime) {
          this.currentUser = UserSchema.parse(JSON.parse(storedUser));
          this.accessToken = storedToken;
        } else {
          this.clearSession();
        }
      }
    } catch (error) {
      console.warn("Failed to load stored session:", error);
      this.clearSession();
    }
  }

  /**
   * Clear authentication session
   */
  private clearSession(): void {
    this.currentUser = null;
    this.accessToken = null;

    try {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("tokenExpiry");
    } catch (error) {
      console.warn("Failed to clear session storage:", error);
    }
  }
}

// Export singleton instance
export const authService = new UserAuthService();

// Export utility functions
export const withAuth = async <T>(operation: () => Promise<T>): Promise<T> => {
  const isValid = await authService.validateSession();
  if (!isValid) {
    throw new AuthenticationError("Authentication required");
  }
  return operation();
};

export const requireAuth = (user: User | null): User => {
  if (!user) {
    throw new AuthenticationError("User must be authenticated");
  }
  return user;
};
