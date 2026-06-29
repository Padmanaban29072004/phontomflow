import mongoose, { Schema, Document } from 'mongoose';
import { logger } from '@/utils/logger';
import bcrypt from 'bcryptjs';

/**
 * User role type
 */
export type UserRole = 'admin' | 'analyst' | 'viewer' | 'soc-l1' | 'soc-l2';

/**
 * User document interface
 */
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): SafeUser;
}

/**
 * Safe user object (no password hash)
 */
export interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

// --- Mongoose Schema ---
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'analyst', 'viewer', 'soc-l1', 'soc-l2'],
      default: 'viewer',
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.toSafeObject = function (): SafeUser {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    role: this.role,
    displayName: this.displayName,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

// --- In-Memory User Store (fallback when MongoDB unavailable) ---
interface MemoryUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

class InMemoryUserStore {
  private users: Map<string, MemoryUser> = new Map();
  private nextId = 1;

  constructor() {
    this.seedDefaultAdmin();
  }

  private async seedDefaultAdmin(): Promise<void> {
    const passwordHash = await bcrypt.hash('admin123', 12);
    const now = new Date();
    this.users.set('admin', {
      id: 'user-default-admin',
      username: 'admin',
      email: 'admin@phantom-flow.local',
      passwordHash,
      role: 'admin',
      displayName: 'Default Admin',
      isActive: true,
      createdAt: now,
    });
    logger.info('Seeded default admin user (username: admin, password: admin123)');
  }

  async findByUsername(username: string): Promise<MemoryUser | undefined> {
    return this.users.get(username.toLowerCase());
  }

  async findById(id: string): Promise<MemoryUser | undefined> {
    for (const user of this.users.values()) {
      if (user.id === id) return user;
    }
    return undefined;
  }

  async createUser(params: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    displayName: string;
  }): Promise<MemoryUser> {
    const passwordHash = await bcrypt.hash(params.password, 12);
    const now = new Date();
    const user: MemoryUser = {
      id: `user-${this.nextId++}-${Date.now()}`,
      username: params.username.toLowerCase(),
      email: params.email.toLowerCase(),
      passwordHash,
      role: params.role,
      displayName: params.displayName,
      isActive: true,
      createdAt: now,
    };
    this.users.set(user.username, user);
    return user;
  }

  toSafeUser(user: MemoryUser): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async comparePassword(user: MemoryUser, candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, user.passwordHash);
  }

  async updateLastLogin(username: string): Promise<void> {
    const user = this.users.get(username.toLowerCase());
    if (user) {
      user.lastLoginAt = new Date();
    }
  }
}

export const memoryUserStore = new InMemoryUserStore();

/**
 * UserService — tries MongoDB first, falls back to in-memory store
 */
export class UserService {
  private useMemoryStore: boolean;

  constructor(mongoAvailable: boolean) {
    this.useMemoryStore = !mongoAvailable;
    if (this.useMemoryStore) {
      logger.info('UserService using in-memory store (MongoDB unavailable)');
    } else {
      logger.info('UserService using MongoDB');
    }
  }

  async findByUsername(username: string): Promise<SafeUser | null> {
    if (this.useMemoryStore) {
      const user = await memoryUserStore.findByUsername(username);
      return user ? memoryUserStore.toSafeUser(user) : null;
    }

    try {
      const user = await UserModel.findOne({ username: username.toLowerCase() });
      return user ? user.toSafeObject() : null;
    } catch {
      return null;
    }
  }

  async findById(id: string): Promise<SafeUser | null> {
    if (this.useMemoryStore) {
      const user = await memoryUserStore.findById(id);
      return user ? memoryUserStore.toSafeUser(user) : null;
    }

    try {
      const user = await UserModel.findById(id);
      return user ? user.toSafeObject() : null;
    } catch {
      return null;
    }
  }

  async validatePassword(
    username: string,
    candidatePassword: string
  ): Promise<SafeUser | null> {
    if (this.useMemoryStore) {
      const user = await memoryUserStore.findByUsername(username);
      if (!user || !user.isActive) return null;
      const isValid = await memoryUserStore.comparePassword(user, candidatePassword);
      if (!isValid) return null;
      await memoryUserStore.updateLastLogin(username);
      return memoryUserStore.toSafeUser(user);
    }

    try {
      const user = await UserModel.findOne({ username: username.toLowerCase(), isActive: true });
      if (!user) return null;
      const isValid = await user.comparePassword(candidatePassword);
      if (!isValid) return null;
      user.lastLoginAt = new Date();
      await user.save();
      return user.toSafeObject();
    } catch {
      return null;
    }
  }
}

