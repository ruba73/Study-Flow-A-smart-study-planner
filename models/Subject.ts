import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface ISubjectTopic {
  name: string;
  description?: string;
  estimatedHours: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  order: number;
}

export interface ISubjectResource {
  type: "book" | "video" | "article" | "pdf" | "website";
  title: string;
  url?: string;
  author?: string;
}

export interface ISubject {
  id: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  description?: string | null;
  semester?: string | null;
  academicYear?: string | null;
  instructor?: string | null;
  topics: ISubjectTopic[];
  resources: ISubjectResource[];
  prerequisites: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedTotalHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<ISubject>(prisma.subject, ["topics", "resources", "prerequisites"]);

export const Subject = {
  ...baseModel,
  async create(args: { data: Omit<ISubject, "id" | "createdAt" | "updatedAt" | "estimatedTotalHours"> & { estimatedTotalHours?: number } }) {
    return baseModel.create({
      data: {
        ...args.data,
        code: args.data.code.toUpperCase(),
        estimatedTotalHours:
          args.data.estimatedTotalHours ??
          args.data.topics.reduce((sum, topic) => sum + topic.estimatedHours, 0),
      },
    });
  },
  async findByCode(code: string) {
    return this.findFirst({ where: { code: code.toUpperCase(), isActive: true } });
  },
  async findByDepartment(department: string) {
    return this.findMany({ where: { department, isActive: true }, orderBy: { code: "asc" } });
  },
  async searchSubjects(query: string) {
    return this.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: query } },
          { name: { contains: query } },
          { description: { contains: query } },
          { department: { contains: query } },
        ],
      },
      orderBy: { code: "asc" },
    });
  },
  getTopicByName(subject: ISubject, topicName: string) {
    return subject.topics.find((topic) => topic.name === topicName);
  },
};
