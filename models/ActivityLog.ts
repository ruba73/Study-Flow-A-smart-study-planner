import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export type ActivityType =
  | "goal_created"
  | "goal_completed"
  | "task_completed"
  | "session_completed"
  | "plan_generated"
  | "plan_regenerated"
  | "milestone_achieved"
  | "streak_achieved"
  | "flashcard_reviewed"
  | "group_joined"
  | "goal_shared";

export interface IActivityLog {
  id: string;
  userId: string;
  type: ActivityType;
  description: string;
  relatedEntityId?: string | null;
  relatedEntityType?: "Goal" | "Task" | "Session" | "Plan" | "StudyGroup" | "Flashcard" | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const baseModel = createPrismaModel<IActivityLog>(prisma.activityLog, ["metadata"]);

const iconMap: Record<ActivityType, string> = {
  goal_created: "target",
  goal_completed: "check-circle",
  task_completed: "check-square",
  session_completed: "book-open",
  plan_generated: "sparkles",
  plan_regenerated: "refresh-cw",
  milestone_achieved: "trophy",
  streak_achieved: "flame",
  flashcard_reviewed: "layers",
  group_joined: "users",
  goal_shared: "share-2",
};

export const ActivityLog = {
  ...baseModel,
  async logActivity(
    userId: string,
    type: ActivityType,
    description: string,
    options: {
      relatedEntityId?: string;
      relatedEntityType?: IActivityLog["relatedEntityType"];
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    return this.create({
      data: {
        userId,
        type,
        description,
        relatedEntityId: options.relatedEntityId ?? null,
        relatedEntityType: options.relatedEntityType ?? null,
        metadata: options.metadata ?? {},
      },
    });
  },
  async getUserFeed(userId: string, limit = 20, skip = 0) {
    return this.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });
  },
  async getByType(userId: string, type: ActivityType, limit = 20) {
    return this.findMany({
      where: { userId, type },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
  async getRecentActivity(userId: string, days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: "desc" },
    });
  },
  async getStats(userId: string, startDate: Date, endDate: Date) {
    const rows = await prisma.activityLog.groupBy({
      by: ["type"],
      where: { userId, createdAt: { gte: startDate, lte: endDate } },
      _count: { type: true },
    });

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = row._count.type;
      return acc;
    }, {});
  },
  formatForDisplay(activity: IActivityLog) {
    return {
      id: activity.id,
      type: activity.type,
      description: activity.description,
      icon: iconMap[activity.type],
      timestamp: activity.createdAt,
    };
  },
};
