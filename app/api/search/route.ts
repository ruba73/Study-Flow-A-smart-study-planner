import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

type SearchCategory = "Course" | "Task" | "Session" | "Page";

const pageItems = [
  { id: "p1", category: "Page" as SearchCategory, title: "Dashboard", subtitle: "Overview of your study activity", href: "/dashboard" },
  { id: "p2", category: "Page" as SearchCategory, title: "Subjects", subtitle: "Manage your subjects", href: "/subjects" },
  { id: "p3", category: "Page" as SearchCategory, title: "Tasks / To-Do", subtitle: "View and manage all your tasks", href: "/tasks" },
  { id: "p4", category: "Page" as SearchCategory, title: "Study Plan", subtitle: "Your personalized AI study schedule", href: "/study-plan" },
  { id: "p5", category: "Page" as SearchCategory, title: "Calendar", subtitle: "Calendar view of all study sessions", href: "/calendar" },
  { id: "p6", category: "Page" as SearchCategory, title: "Analytics", subtitle: "Track your progress and statistics", href: "/analytics" },
  { id: "p7", category: "Page" as SearchCategory, title: "My Profile", subtitle: "Manage your profile and account settings", href: "/profile" },
];

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ results: pageItems });
  }

  const [goals, tasks, sessions] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, progress: true, targetDate: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, type: true, dueDate: true, completed: true },
    }),
    prisma.studySession.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, type: true, plannedStartTime: true, plannedDuration: true },
    }),
  ]);

  const lowerQ = q.toLowerCase();
  const pageResults = pageItems.filter(
    (item) => item.title.toLowerCase().includes(lowerQ) || item.subtitle.toLowerCase().includes(lowerQ),
  );

  return NextResponse.json({
    results: [
      ...pageResults,
      ...goals.map((goal) => ({
        id: `goal-${goal.id}`,
        category: "Course" as SearchCategory,
        title: goal.title,
        subtitle: `${goal.progress}% complete · Due ${goal.targetDate.toLocaleDateString("en-US")}`,
        href: "/subjects",
      })),
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        category: "Task" as SearchCategory,
        title: task.title,
        subtitle: `${task.type} · ${task.completed ? "Completed" : "Pending"}`,
        href: "/tasks",
      })),
      ...sessions.map((session) => ({
        id: `session-${session.id}`,
        category: "Session" as SearchCategory,
        title: session.title,
        subtitle: `${session.type} · ${session.plannedStartTime.toLocaleDateString("en-US")}`,
        href: "/calendar",
      })),
    ].slice(0, 10),
  });
}
