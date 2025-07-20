import bcrypt from 'bcryptjs';
import { BaseModel } from './BaseModel';
import { User, UserRole, UserStatus } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class UserModel extends BaseModel<User> {
  constructor() {
    super('users', 'user');
  }

  // Hash password before saving
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  // Verify password
  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  // Create user with proper type validation
  async create(userData: Omit<User, '_id' | '_rev' | 'createdAt' | 'updatedAt' | 'id'>): Promise<User> {
    try {
      logger.info('Creating user', { email: userData.email, role: userData.role });

      // Hash the password before saving
      const hashedPassword = await this.hashPassword(userData.password);
      
      // Generate ID that will be used for both _id and id fields
      const userId = this.generateId();
      
      // Set default values
      const userWithDefaults = {
        ...userData,
        id: userId, // Set id field to match what will be the _id
        password: hashedPassword, // Use hashed password
        type: 'user' as const,
        status: userData.status || 'active', // Default to active for verified users
        verified: userData.verified || false,
        profile: userData.profile || {
          bio: '',
          expertise: [],
          location: '',
          website: '',
          socialMedia: {},
        },
        preferences: userData.preferences || {
          language: 'en',
          notifications: {
            email: true,
            push: true,
            marketing: false,
          },
          accessibility: {
            highContrast: false,
            largeText: false,
            screenReader: false,
            reducedMotion: false,
          },
        },
        refreshTokens: userData.refreshTokens || [],
        ...(userData.avatar && { avatar: userData.avatar }),
        ...(userData.lastLogin && { lastLogin: userData.lastLogin }),
      };

      // Override the BaseModel create to use our specific ID
      const now = new Date().toISOString();
      const doc = {
        ...userWithDefaults,
        _id: userId, // Use the same ID for both _id and id
        createdAt: now,
        updatedAt: now,
      } as User;

      const result = await this.db.insert(doc);
      
      const createdUser = {
        ...doc,
        _id: result.id,
        _rev: result.rev,
      } as User;
      
      logger.info('User created successfully', { 
        userId: createdUser.id, 
        email: createdUser.email 
      });

      return createdUser;
    } catch (error) {
      logger.error('Failed to create user:', { email: userData.email, error });
      throw error;
    }
  }

  // Find user by email using the existing CouchDB view
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await databases.users.view('users', 'by_email', {
        key: email,
        include_docs: true,
        limit: 1,
      });

      if (result.rows.length > 0) {
        // @ts-ignore - CouchDB view result doc property can be undefined but we check for it
        const doc = result.rows[0].doc;
        if (doc) {
          const user = doc as User;
          // Ensure id field matches _id field
          user.id = user._id!;
          return user;
        }
      }
      return null;
    } catch (error) {
      logger.error('Failed to find user by email', { email, error });
      throw error;
    }
  }

  // Find users by role using the existing CouchDB view
  async findByRole(role: UserRole): Promise<User[]> {
    try {
      const result = await databases.users.view('users', 'by_role', {
        key: role,
        include_docs: true,
      });

      return result.rows.map(row => row.doc as User);
    } catch (error) {
      logger.error('Failed to find users by role', { role, error });
      throw error;
    }
  }

  // Find users by status using the existing CouchDB view
  async findByStatus(status: string): Promise<User[]> {
    try {
      const result = await databases.users.view('users', 'by_status', {
        key: status,
        include_docs: true,
      });

      return result.rows.map(row => row.doc as User);
    } catch (error) {
      logger.error('Failed to find users by status', { status, error });
      throw error;
    }
  }

  // Find active users using the existing CouchDB view
  async findActiveUsers(): Promise<User[]> {
    try {
      const result = await databases.users.view('users', 'active_users', {
        include_docs: true,
      });

      return result.rows.map(row => row.doc as User);
    } catch (error) {
      logger.error('Failed to find active users', error);
      throw error;
    }
  }

  // Get all users (for admin purposes) - includes active, inactive, and suspended
  async getAllUsers(): Promise<User[]> {
    try {
      logger.info('Fetching all users for admin dashboard');
      
      // Try using the all_users view first
      try {
        const result = await databases.users.view('users', 'all_users', {
          include_docs: true,
          limit: 10000, // Increase limit for comprehensive data
        });

        const users = result.rows.map(row => {
          const user = row.doc as User;
          // Ensure id is set for consistency
          if (!user.id && user._id) {
            user.id = user._id;
          }
          return user;
        });

        logger.info('Successfully fetched users via view:', { count: users.length });
        return users;
      } catch (viewError) {
        logger.warn('Failed to find users via view, falling back to direct query', viewError);
        
        // Fallback: use direct query with proper error handling
        const result = await databases.users.find({
          selector: { type: 'user' },
          limit: 10000,
          sort: [{ createdAt: 'desc' }] // Sort by creation date
        });
        
        const users = result.docs.map(doc => {
          const user = doc as User;
          // Ensure id is set for consistency
          if (!user.id && user._id) {
            user.id = user._id;
          }
          return user;
        });

        logger.info('Successfully fetched users via fallback query:', { count: users.length });
        return users;
      }
    } catch (error) {
      logger.error('Failed to fetch users with all methods:', error);
      throw new Error('Unable to fetch users from database');
    }
  }

  // Find verified users using the existing CouchDB view
  async findVerifiedUsers(): Promise<User[]> {
    try {
      const result = await databases.users.view('users', 'verified_users', {
        include_docs: true,
      });

      return result.rows.map(row => row.doc as User);
    } catch (error) {
      logger.error('Failed to find verified users', error);
      throw error;
    }
  }

  // Update user status
  async updateStatus(userId: string, status: string): Promise<User> {
    try {
      return await this.update(userId, { status } as Partial<User>);
    } catch (error) {
      logger.error('Failed to update user status', { userId, status, error });
      throw error;
    }
  }

  // Verify user account
  async verifyAccount(userId: string): Promise<User> {
    try {
      return await this.update(userId, { 
        verified: true, 
        status: 'active' 
      } as Partial<User>);
    } catch (error) {
      logger.error('Failed to verify user account', { userId, error });
      throw error;
    }
  }

  // Update user preferences
  async updatePreferences(userId: string, preferences: Partial<User['preferences']>): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const updatedPreferences = {
        ...user.preferences,
        ...preferences,
      };

      return await this.update(userId, { preferences: updatedPreferences } as Partial<User>);
    } catch (error) {
      logger.error('Failed to update user preferences', { userId, error });
      throw error;
    }
  }

  
  // are not defined in the User type. These would be handled in separate models/services.

  // Update password
  async updatePassword(userId: string, newPassword: string): Promise<User> {
    try {
      const hashedPassword = await this.hashPassword(newPassword);
      return await this.update(userId, {
        password: hashedPassword,
        refreshTokens: [], // Clear all refresh tokens
      });
    } catch (error) {
      logger.error('Failed to update password', { userId, error });
      throw error;
    }
  }

  // Update last login
  async updateLastLogin(userId: string): Promise<User> {
    try {
      return await this.update(userId, {
        lastLogin: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to update last login', { userId, error });
      throw error;
    }
  }

  // Add refresh token
  async addRefreshToken(userId: string, token: string): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const refreshTokens = [...user.refreshTokens, token];
      
      // Keep only the last 5 refresh tokens
      if (refreshTokens.length > 5) {
        refreshTokens.splice(0, refreshTokens.length - 5);
      }

      return await this.update(userId, { refreshTokens });
    } catch (error) {
      logger.error('Failed to add refresh token', { userId, error });
      throw error;
    }
  }

  // Remove refresh token
  async removeRefreshToken(userId: string, token: string): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const refreshTokens = user.refreshTokens.filter(t => t !== token);
      return await this.update(userId, { refreshTokens });
    } catch (error) {
      logger.error('Failed to remove refresh token', { userId, error });
      throw error;
    }
  }

  // Clear all refresh tokens
  async clearRefreshTokens(userId: string): Promise<User> {
    try {
      return await this.update(userId, { refreshTokens: [] });
    } catch (error) {
      logger.error('Failed to clear refresh tokens', { userId, error });
      throw error;
    }
  }

  // Search users
  async searchUsers(
    query: string,
    options: {
      page?: number;
      limit?: number;
      role?: UserRole;
      status?: UserStatus;
    } = {}
  ): Promise<{
    docs: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      // First, apply filters if provided
      let filteredUsers: User[] = [];

      if (options.role) {
        const roleResults = await this.findByRole(options.role);
        filteredUsers = roleResults;
      } else if (options.status) {
        const statusResults = await this.findByStatus(options.status);
        filteredUsers = statusResults;
      } else {
        // Get all users
        const allResults = await this.findActiveUsers();
        filteredUsers = allResults;
      }

      // Apply text search
      const queryLower = query.toLowerCase();
      const searchResults = filteredUsers.filter(user => 
        user.name.toLowerCase().includes(queryLower) ||
        user.email.toLowerCase().includes(queryLower) ||
        (user.profile?.bio && user.profile.bio.toLowerCase().includes(queryLower))
      );

      // Apply pagination
      const page = options.page || 1;
      const limit = options.limit || 10;
      const total = searchResults.length;
      const pages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = searchResults.slice(startIndex, endIndex);

      return {
        docs: paginatedResults,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to search users', { query, options, error });
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(): Promise<{
    total: number;
    byRole: Record<UserRole, number>;
    byStatus: Record<UserStatus, number>;
    recentSignups: number; // Last 30 days
  }> {
    try {
      const [totalUsers, allUsers] = await Promise.all([
        this.count(),
        this.findActiveUsers(),
      ]);

      const byRole: Record<UserRole, number> = {
        admin: 0,
        tutor: 0,
        learner: 0,
      };

      const byStatus: Record<UserStatus, number> = {
        active: 0,
        inactive: 0,
        suspended: 0,
        pending: 0,
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let recentSignups = 0;

      allUsers.forEach(user => {
        byRole[user.role]++;
        byStatus[user.status]++;

        if (new Date(user.createdAt) >= thirtyDaysAgo) {
          recentSignups++;
        }
      });

      return {
        total: totalUsers,
        byRole,
        byStatus,
        recentSignups,
      };
    } catch (error) {
      logger.error('Failed to get user statistics', { error });
      throw error;
    }
  }

  // Deactivate user
  async deactivateUser(userId: string): Promise<User> {
    try {
      return await this.update(userId, {
        status: 'inactive' as UserStatus,
        refreshTokens: [], // Clear all refresh tokens
      });
    } catch (error) {
      logger.error('Failed to deactivate user', { userId, error });
      throw error;
    }
  }

  // Activate user
  async activateUser(userId: string): Promise<User> {
    try {
      return await this.update(userId, {
        status: 'active' as UserStatus,
      });
    } catch (error) {
      logger.error('Failed to activate user', { userId, error });
      throw error;
    }
  }

  // Suspend user
  async suspendUser(userId: string): Promise<User> {
    try {
      return await this.update(userId, {
        status: 'suspended' as UserStatus,
        refreshTokens: [], // Clear all refresh tokens
      });
    } catch (error) {
      logger.error('Failed to suspend user', { userId, error });
      throw error;
    }
  }

  // Generate a new user ID (public method)
  generateUserId(): string {
    return this.generateId();
  }
}

export const userModel = new UserModel();
export default userModel; 