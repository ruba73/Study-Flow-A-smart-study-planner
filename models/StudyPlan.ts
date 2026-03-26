import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface ISpacedRepetition {
  enabled: boolean;
  intervals: number[];
}

export interface IBreakRules {
  sessionDuration: number;
  shortBreak: number;
  longBreak: number;
}

export interface IConstraints {
  lockWeekends: boolean;
  lockSpecificDays: string[];
  respectFixedEvents: boolean;
}

export interface IPlanConfig {
  spacedRepetition: ISpacedRepetition;
  bufferTimePercentage: number;
  breakRules: IBreakRules;
  constraints: IConstraints;
}

export interface IBreak {
  afterMinutes: number;
  duration: number;
}

export interface ISession {
  id?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  topicId: string;
  topicName: string;
  type: "study" | "review" | "practice" | "quiz" | "project";
  difficulty: number;
  taskIds: string[];
  status: "scheduled" | "in-progress" | "completed" | "skipped" | "rescheduled";
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualDuration?: number;
  breaks: IBreak[];
}

export interface IMilestone {
  id?: string;
  title: string;
  type: "module" | "midterm" | "mock-exam" | "project" | "review";
  targetDate: Date;
  status: "pending" | "achieved";
  achievedAt?: Date;
}

export interface IStudyPlan {
  id: string;
  goalId: string;
  userId: string;
  planVersion: number;
  config: IPlanConfig;
  sessions: ISession[];
  milestones: IMilestone[];
  aiGenerated: boolean;
  aiModel?: string | null;
  generationPrompt?: string | null;
  lastRegenerated?: Date | null;
  regenerationReason?: string | null;
  preservedSessions?: string[];
  totalPlannedHours: number;
  totalCompletedHours: number;
  completionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IStudyPlan>(prisma.studyPlan, ["config", "sessions", "milestones", "preservedSessions"]);

export const StudyPlan = {
  ...baseModel,
  calculateCompletionRate(plan: Pick<IStudyPlan, "sessions">) {
    if (plan.sessions.length === 0) return 0;
    const completedSessions = plan.sessions.filter((session) => session.status === "completed").length;
    return Math.round((completedSessions / plan.sessions.length) * 100);
  },
  getTotalPlannedHours(plan: Pick<IStudyPlan, "sessions">) {
    return plan.sessions.reduce((sum, session) => sum + session.duration / 60, 0);
  },
};
