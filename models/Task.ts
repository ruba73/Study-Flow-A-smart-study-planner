import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface ITaskResource {
  type: string;
  url: string;
  title: string;
}

export interface IReviewSchedule {
  originalTaskId?: string;
  nextReviewDate: Date;
  reviewCount: number;
  lastReviewedAt?: Date;
}

export interface ITask {
  id: string;
  userId: string;
  goalId: string;
  sessionId?: string | null;
  topicId?: string | null;
  title: string;
  description?: string | null;
  type: "read" | "watch" | "practice" | "assignment" | "quiz" | "project" | "review";
  estimatedDuration: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  status: "not-started" | "in-progress" | "done" | "skipped";
  dueDate?: Date | null;
  scheduledDate?: Date | null;
  scheduledTime?: string | null;
  completed: boolean;
  completedAt?: Date | null;
  timeSpent?: number;
  isReview: boolean;
  reviewSchedule?: IReviewSchedule | null;
  resources: ITaskResource[];
  dependsOn: string[];
  linkedTasks: string[];
  isManual: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<ITask>(prisma.task, ["reviewSchedule", "resources", "dependsOn", "linkedTasks"]);

export const Task = {
  ...baseModel,
  async create(args: { data: Omit<ITask, "id" | "createdAt" | "updatedAt"> }) {
    const data = {
      ...args.data,
      ...(args.data.status === "done" && !args.data.completed
        ? { completed: true, completedAt: args.data.completedAt ?? new Date() }
        : {}),
    };
    return baseModel.create({ data });
  },
  async markComplete(id: string, timeSpent: number) {
    return this.update({
      where: { id },
      data: {
        status: "done",
        completed: true,
        completedAt: new Date(),
        timeSpent,
      },
    });
  },
};
