import { createPrismaModel } from "@/models/_base";
import prisma from "@/lib/prisma";

export interface INotification {
  id: string;
  userId: string;
  type: "reminder" | "achievement" | "deadline" | "review-due" | "system" | "group-invite";
  title: string;
  message: string;
  actionUrl?: string | null;
  relatedEntityId?: string | null;
  relatedEntityType?: "Goal" | "Task" | "Session" | "StudyGroup" | "Flashcard" | null;
  isRead: boolean;
  readAt?: Date | null;
  scheduledFor?: Date | null;
  sent: boolean;
  createdAt: Date;
}

const baseModel = createPrismaModel<INotification>(prisma.notification);

export const Notification = {
  ...baseModel,
  async createNotification(
    userId: string,
    type: INotification["type"],
    title: string,
    message: string,
    options: {
      actionUrl?: string;
      relatedEntityId?: string;
      relatedEntityType?: INotification["relatedEntityType"];
      scheduledFor?: Date;
    } = {},
  ) {
    return this.create({
      data: {
        userId,
        type,
        title,
        message,
        actionUrl: options.actionUrl ?? null,
        relatedEntityId: options.relatedEntityId ?? null,
        relatedEntityType: options.relatedEntityType ?? null,
        scheduledFor: options.scheduledFor ?? null,
        sent: !options.scheduledFor,
      },
    });
  },
  async markAsRead(id: string) {
    return this.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  },
  async markAsSent(id: string) {
    return this.update({ where: { id }, data: { sent: true } });
  },
  async getUnreadCount(userId: string) {
    return this.count({ where: { userId, isRead: false } });
  },
  async getUnread(userId: string, limit = 20) {
    return this.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
  async getAll(userId: string, limit = 50, skip = 0) {
    return this.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });
  },
  async markAllAsRead(userId: string) {
    return this.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },
  async deleteOldNotifications(userId: string, daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return this.deleteMany({
      where: {
        userId,
        isRead: true,
        createdAt: { lt: cutoffDate },
      },
    });
  },
  async getPendingScheduled() {
    return this.findMany({
      where: {
        sent: false,
        scheduledFor: { lte: new Date() },
      },
    });
  },
  async createReminder(userId: string, title: string, message: string, scheduledFor: Date, relatedEntityId?: string, relatedEntityType?: INotification["relatedEntityType"]) {
    return this.createNotification(userId, "reminder", title, message, {
      scheduledFor,
      relatedEntityId,
      relatedEntityType,
    });
  },
  async createAchievement(userId: string, title: string, message: string, relatedEntityId?: string) {
    return this.createNotification(userId, "achievement", title, message, { relatedEntityId });
  },
  async createDeadlineWarning(userId: string, goalTitle: string, daysLeft: number, goalId: string) {
    return this.createNotification(
      userId,
      "deadline",
      "Deadline Approaching",
      `${goalTitle} deadline is in ${daysLeft} days`,
      {
        actionUrl: `/goals/${goalId}`,
        relatedEntityId: goalId,
        relatedEntityType: "Goal",
      },
    );
  },
};
