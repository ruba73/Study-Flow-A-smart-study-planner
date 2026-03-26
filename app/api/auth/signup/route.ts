// app/api/auth/signup/route.ts
import { NextResponse, NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      profile: {
        weeklyAvailability: [],
        preferredSessionLength: 60,
        focusHours: 'flexible',
        timezone: 'UTC',
        language: 'en',
        skillsLevel: {},
      },
      preferences: {
        maxStudyHoursPerDay: 6,
        maxSessionsPerDay: 4,
        preferredRestDay: 'sunday',
        sessionLength: 60,
        breakRules: { enabled: true, workDuration: 50, breakDuration: 10, longBreak: 30 },
        difficultyBalancing: true,
        bufferTime: 20,
        notifications: { email: true, push: true, inApp: true, reminderMinutesBefore: 30, dailyReminder: true, weeklyReport: true },
        accessibility: { darkMode: false, fontSize: 'medium', reducedMotion: false },
      },
      stats: {
        totalGoals: 0,
        completedGoals: 0,
        totalStudyTime: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTasks: 0,
        completedTasks: 0,
      },
    });

    const safeUser = { ...user };
    delete safeUser.password;

    return NextResponse.json(
      { message: "User created successfully", user: safeUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
