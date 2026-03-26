import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface IResource {
  type: "video" | "article" | "pdf" | "course" | "book" | "playlist" | "other";
  title: string;
  url?: string;
  duration?: number;
  file?: string;
}

export interface ITopic {
  id?: string;
  name: string;
  order: number;
  estimatedHours: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description?: string;
  resources: IResource[];
  status: "not-started" | "in-progress" | "completed";
  progress: number;
  masteryScore: number;
}

export interface IPrerequisite {
  goalId?: string;
  skillName?: string;
  required: boolean;
}

export interface IGoal {
  id: string;
  userId: string;
  subjectId?: string | null;
  type: "skill-path" | "academic-course";
  title: string;
  description?: string | null;
  targetDate: Date;
  priority: "low" | "medium" | "high";
  difficulty: 1 | 2 | 3 | 4 | 5;
  status: "not-started" | "in-progress" | "completed" | "paused" | "abandoned";
  progress: number;
  topics: ITopic[];
  resources: IResource[];
  prerequisites: IPrerequisite[];
  estimatedTotalHours: number;
  actualHoursSpent: number;
  studyGroupId?: string | null;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IGoal>(prisma.goal, ["topics", "resources", "prerequisites"]);

export const Goal = {
  ...baseModel,
  async create(args: { data: Omit<IGoal, "id" | "createdAt" | "updatedAt" | "estimatedTotalHours"> & { estimatedTotalHours?: number } }) {
    const estimatedTotalHours = args.data.estimatedTotalHours ?? this.calculateEstimatedHours(args.data.topics);
    const progress = args.data.progress ?? this.calculateProgressFromTopics(args.data.topics);

    return baseModel.create({
      data: {
        ...args.data,
        estimatedTotalHours,
        progress,
      },
    });
  },
  calculateEstimatedHours(topics: ITopic[]) {
    return topics.reduce((sum, topic) => sum + topic.estimatedHours, 0);
  },
  calculateProgressFromTopics(topics: ITopic[]) {
    if (topics.length === 0) return 0;
    return Math.round(topics.reduce((sum, topic) => sum + topic.progress, 0) / topics.length);
  },
};
