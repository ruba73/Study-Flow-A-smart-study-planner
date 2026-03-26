import prisma from "@/lib/prisma";

export interface IWeeklyAvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface IWeeklyAvailability {
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  slots: IWeeklyAvailabilitySlot[];
}

export interface IUserProfile {
  schoolLevel?: "high-school" | "undergraduate" | "graduate" | "professional";
  weeklyAvailability: IWeeklyAvailability[];
  preferredSessionLength: 25 | 45 | 60 | 90;
  focusHours: "morning" | "afternoon" | "evening" | "night" | "flexible";
  timezone: string;
  language: string;
  skillsLevel: Record<string, "beginner" | "intermediate" | "advanced">;
}

export interface IBreakRules {
  enabled: boolean;
  workDuration: number;
  breakDuration: number;
  longBreak: number;
}

export interface INotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  reminderMinutesBefore: number;
  dailyReminder: boolean;
  weeklyReport: boolean;
}

export interface IAccessibility {
  darkMode: boolean;
  fontSize: "small" | "medium" | "large";
  reducedMotion: boolean;
}

export interface IUserPreferences {
  maxStudyHoursPerDay: number;
  maxSessionsPerDay: number;
  preferredRestDay: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | "none";
  sessionLength: number;
  breakRules: IBreakRules;
  difficultyBalancing: boolean;
  bufferTime: number;
  notifications: INotificationPreferences;
  accessibility: IAccessibility;
}

export interface IUserStats {
  totalGoals: number;
  completedGoals: number;
  totalStudyTime: number;
  currentStreak: number;
  longestStreak: number;
  totalTasks: number;
  completedTasks: number;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
  googleId?: string | null;
  avatar?: string | null;
  profile: IUserProfile;
  preferences: IUserPreferences;
  stats: IUserStats;
  onboardingCompleted: boolean;
  onboardingStep?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

type UserCreateInput = Omit<IUser, "id" | "createdAt" | "updatedAt">;

const defaultProfile: IUserProfile = {
  weeklyAvailability: [],
  preferredSessionLength: 60,
  focusHours: "flexible",
  timezone: "UTC",
  language: "en",
  skillsLevel: {},
};

const defaultPreferences: IUserPreferences = {
  maxStudyHoursPerDay: 6,
  maxSessionsPerDay: 4,
  preferredRestDay: "sunday",
  sessionLength: 60,
  breakRules: {
    enabled: true,
    workDuration: 50,
    breakDuration: 10,
    longBreak: 30,
  },
  difficultyBalancing: true,
  bufferTime: 20,
  notifications: {
    email: true,
    push: true,
    inApp: true,
    reminderMinutesBefore: 30,
    dailyReminder: true,
    weeklyReport: true,
  },
  accessibility: {
    darkMode: false,
    fontSize: "medium",
    reducedMotion: false,
  },
};

const defaultStats: IUserStats = {
  totalGoals: 0,
  completedGoals: 0,
  totalStudyTime: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalTasks: 0,
  completedTasks: 0,
};

function normalizeJsonFields<T extends { profile: unknown; preferences: unknown; stats: unknown }>(user: T) {
  return {
    ...user,
    profile: user.profile as IUserProfile,
    preferences: user.preferences as IUserPreferences,
    stats: user.stats as IUserStats,
  };
}

export const User = {
  async findOne(where: Partial<Pick<IUser, "email" | "id" | "googleId">>) {
    if (where.email) {
      const user = await prisma.user.findUnique({ where: { email: where.email } });
      return user ? normalizeJsonFields(user) : null;
    }

    if (where.id) {
      const user = await prisma.user.findUnique({ where: { id: where.id } });
      return user ? normalizeJsonFields(user) : null;
    }

    if (where.googleId) {
      const user = await prisma.user.findUnique({ where: { googleId: where.googleId } });
      return user ? normalizeJsonFields(user) : null;
    }

    return null;
  },

  async create(data: Partial<UserCreateInput> & Pick<IUser, "name" | "email" | "password">) {
    const user = await prisma.user.create({
      data: {
        ...data,
        profile: {
          ...defaultProfile,
          ...data.profile,
          skillsLevel: data.profile?.skillsLevel ?? defaultProfile.skillsLevel,
          weeklyAvailability: data.profile?.weeklyAvailability ?? defaultProfile.weeklyAvailability,
        },
        preferences: {
          ...defaultPreferences,
          ...data.preferences,
          breakRules: {
            ...defaultPreferences.breakRules,
            ...data.preferences?.breakRules,
          },
          notifications: {
            ...defaultPreferences.notifications,
            ...data.preferences?.notifications,
          },
          accessibility: {
            ...defaultPreferences.accessibility,
            ...data.preferences?.accessibility,
          },
        },
        stats: {
          ...defaultStats,
          ...data.stats,
        },
        onboardingCompleted: data.onboardingCompleted ?? false,
        onboardingStep: data.onboardingStep ?? 0,
      },
    });
    return normalizeJsonFields(user);
  },

  async deleteMany() {
    return prisma.user.deleteMany();
  },

  async insertMany(users: Array<Partial<UserCreateInput> & Pick<IUser, "name" | "email" | "password">>) {
    return Promise.all(users.map((user) => this.create(user)));
  },
};
