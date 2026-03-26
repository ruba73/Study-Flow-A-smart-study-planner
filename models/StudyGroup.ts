import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface IGroupMember {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
  stats: {
    totalStudyTime: number;
    rank?: number;
  };
}

export interface ILeaderboardEntry {
  userId: string;
  timeStudied: number;
  tasksCompleted: number;
  rank: number;
}

export interface IGroupSettings {
  allowMemberInvite: boolean;
  showLeaderboard: boolean;
  allowGoalSharing: boolean;
  timetablePermissions: "view-only" | "edit";
}

export interface IStudyGroup {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  members: IGroupMember[];
  inviteCode: string;
  isPublic: boolean;
  sharedGoals: string[];
  settings: IGroupSettings;
  leaderboard: ILeaderboardEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IStudyGroup>(prisma.studyGroup, ["members", "sharedGoals", "settings", "leaderboard"]);

function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const StudyGroup = {
  ...baseModel,
  generateInviteCode,
  async create(args: { data: Omit<IStudyGroup, "id" | "createdAt" | "updatedAt" | "inviteCode" | "leaderboard"> & { inviteCode?: string; leaderboard?: ILeaderboardEntry[] } }) {
    const ownerExists = args.data.members.some((member) => member.userId === args.data.ownerId);
    const members = ownerExists
      ? args.data.members
      : [
          ...args.data.members,
          {
            userId: args.data.ownerId,
            role: "owner",
            joinedAt: new Date(),
            stats: { totalStudyTime: 0 },
          },
        ];

    return baseModel.create({
      data: {
        ...args.data,
        members,
        inviteCode: args.data.inviteCode ?? generateInviteCode(),
        leaderboard: args.data.leaderboard ?? [],
      },
    });
  },
  async findByInviteCode(code: string) {
    return this.findFirst({ where: { inviteCode: code.toUpperCase() } });
  },
  addMember(group: IStudyGroup, userId: string, role: "admin" | "member" = "member") {
    if (group.members.some((member) => member.userId === userId)) return group.members;
    return [...group.members, { userId, role, joinedAt: new Date(), stats: { totalStudyTime: 0 } }];
  },
  removeMember(group: IStudyGroup, userId: string) {
    const member = group.members.find((entry) => entry.userId === userId);
    if (!member || member.role === "owner") return group.members;
    return group.members.filter((entry) => entry.userId !== userId);
  },
  updateMemberRole(group: IStudyGroup, userId: string, newRole: "admin" | "member") {
    return group.members.map((member) =>
      member.userId === userId && member.role !== "owner" ? { ...member, role: newRole } : member,
    );
  },
  isMember(group: IStudyGroup, userId: string) {
    return group.members.some((member) => member.userId === userId);
  },
  getMemberRole(group: IStudyGroup, userId: string) {
    return group.members.find((member) => member.userId === userId)?.role ?? null;
  },
  async updateLeaderboard(groupId: string) {
    const group = await this.findUnique({ where: { id: groupId } });
    if (!group) return null;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const progressRows = await prisma.progress.findMany({
      where: {
        userId: { in: group.members.map((member) => member.userId) },
        date: { gte: thirtyDaysAgo },
      },
    });

    const leaderboard = group.members
      .map((member) => {
        const rows = progressRows.filter((row) => row.userId === member.userId);
        return {
          userId: member.userId,
          timeStudied: rows.reduce((sum, row) => sum + row.timeStudied, 0),
          tasksCompleted: rows.reduce((sum, row) => sum + row.tasksCompleted, 0),
          rank: 0,
        };
      })
      .sort((a, b) => b.timeStudied - a.timeStudied)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const members = group.members.map((member) => {
      const entry = leaderboard.find((item) => item.userId === member.userId);
      return entry
        ? { ...member, stats: { ...member.stats, totalStudyTime: entry.timeStudied, rank: entry.rank } }
        : member;
    });

    return this.update({
      where: { id: groupId },
      data: { leaderboard, members },
    });
  },
};

export default StudyGroup;
