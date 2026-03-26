import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface ISessionTask {
  taskId: string;
  completed: boolean;
  timeSpent: number;
}

export interface IBreakRecord {
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface IStudySession {
  id: string;
  userId: string;
  goalId: string;
  sessionId?: string | null;
  title: string;
  type: "study" | "review" | "practice" | "project";
  plannedStartTime: Date;
  plannedDuration: number;
  actualStartTime?: Date | null;
  actualEndTime?: Date | null;
  actualDuration?: number;
  status: "scheduled" | "active" | "paused" | "completed" | "cancelled";
  tasks: ISessionTask[];
  notes?: string | null;
  focusScore?: number;
  pauseCount: number;
  totalPauseTime: number;
  breaks: IBreakRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IStudySession>(prisma.studySession, ["tasks", "breaks"]);

export const StudySession = {
  ...baseModel,
  async startSession(id: string) {
    return this.update({ where: { id }, data: { status: "active", actualStartTime: new Date() } });
  },
  async pauseSession(id: string) {
    const session = await this.findUnique({ where: { id } });
    if (!session) return null;
    return this.update({ where: { id }, data: { status: "paused", pauseCount: session.pauseCount + 1 } });
  },
  async resumeSession(id: string) {
    return this.update({ where: { id }, data: { status: "active" } });
  },
  async completeSession(id: string) {
    const session = await this.findUnique({ where: { id } });
    if (!session) return null;
    const actualEndTime = new Date();
    let actualDuration = session.actualDuration ?? 0;
    let focusScore = session.focusScore ?? 0;

    if (session.actualStartTime && session.plannedDuration > 0) {
      const totalTime = actualEndTime.getTime() - new Date(session.actualStartTime).getTime();
      actualDuration = Math.round((totalTime - session.totalPauseTime) / 60000);
      const efficiency = actualDuration / session.plannedDuration;
      const pausePenalty = Math.max(0, 1 - session.pauseCount * 0.1);
      focusScore = Math.round(Math.min(100, efficiency * pausePenalty * 100));
    }

    return this.update({
      where: { id },
      data: { status: "completed", actualEndTime, actualDuration, focusScore },
    });
  },
  async cancelSession(id: string) {
    return this.update({ where: { id }, data: { status: "cancelled" } });
  },
  async addBreak(id: string, startTime: Date, endTime: Date) {
    const session = await this.findUnique({ where: { id } });
    if (!session) return null;
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    return this.update({
      where: { id },
      data: { breaks: [...session.breaks, { startTime, endTime, duration }] },
    });
  },
};
