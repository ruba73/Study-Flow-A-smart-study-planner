import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface ITopicMastery {
  topicId: string;
  topicName: string;
  score: number;
  quizzesTaken: number;
  reviewsCompleted: number;
}

export interface IProgress {
  id: string;
  userId: string;
  goalId?: string | null;
  date: Date;
  week: number;
  month: number;
  year: number;
  plannedTime: number;
  actualTime: number;
  timeStudied: number;
  tasksPlanned: number;
  tasksCompleted: number;
  tasksSkipped: number;
  completionRate: number;
  topicMastery: ITopicMastery[];
  currentStreak: number;
  burnoutScore: number;
  status: "behind" | "on-track" | "ahead";
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IProgress>(prisma.progress, ["topicMastery"]);

export const Progress = {
  ...baseModel,
  calculateBurnout(progress: Pick<IProgress, "plannedTime" | "actualTime" | "completionRate">) {
    const timeRatio = progress.plannedTime > 0 ? progress.actualTime / progress.plannedTime : 0;
    const completionPressure = progress.completionRate < 50 ? 1.5 : 1;
    return Math.round(Math.min(100, (1 - progress.completionRate / 100) * 50 + timeRatio * 30 * completionPressure));
  },
  getStatus(progress: Pick<IProgress, "completionRate" | "actualTime" | "plannedTime">): IProgress["status"] {
    if (progress.completionRate >= 80 && progress.actualTime <= progress.plannedTime * 1.1) return "ahead";
    if (progress.completionRate < 60 || progress.actualTime > progress.plannedTime * 1.3) return "behind";
    return "on-track";
  },
  async getWeeklyProgress(userId: string, week: number, year: number) {
    return this.findMany({ where: { userId, week, year }, orderBy: { date: "asc" } });
  },
  async getMonthlyProgress(userId: string, month: number, year: number) {
    return this.findMany({ where: { userId, month, year }, orderBy: { date: "asc" } });
  },
  async calculateStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const currentDate = new Date(today);

    while (true) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const progress = await this.findFirst({
        where: {
          userId,
          date: { gte: currentDate, lt: nextDate },
        },
      });

      if (!progress || progress.timeStudied === 0) break;
      streak += 1;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  },
};
