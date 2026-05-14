import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Just get basic user info - no relations
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return basic user data with default stats
    return NextResponse.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
      },
      stats: {
        currentStreak: 0,
        longestStreak: 0,
        totalStudyTime: 0,
        totalGoals: 0,
        completedGoals: 0,
        totalTasks: 0,
        completedTasks: 0,
      },
      todayTasksCount: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: message },
      { status: 500 }
    );
  }

}