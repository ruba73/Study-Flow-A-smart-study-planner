"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Flame,
  Clock,
  Target,
  Award,
  TrendingUp,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

type KPI = {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconColor: string;
};

const iconMap: Record<string, LucideIcon> = { Flame, Clock, Target, Award };

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white shadow-sm">{children}</div>;
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-6 pb-2">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {right}
    </div>
  );
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-6 pt-2">{children}</div>;
}

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 12,
      border: "1px solid #E5E7EB",
      boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
    },
    labelStyle: { color: "#111827", fontWeight: 700 },
  } as const;
}

function ProgressBar({ value, colorClass }: { value: number; colorClass: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-200">
      <div className={`h-2.5 rounded-full ${colorClass} transition-all`} style={{ width: `${bounded}%` }} />
    </div>
  );
}

function StatCard({ label, value, icon, iconBg, iconColor }: KPI) {
  const Icon = iconMap[icon];
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm text-gray-600">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function InsightCard({
  Icon,
  title,
  message,
  tone,
}: {
  Icon: LucideIcon;
  title: string;
  message: string;
  tone: "blue" | "orange" | "green";
}) {
  const tones = {
    blue: {
      wrap: "border-blue-200 bg-blue-50",
      iconWrap: "bg-blue-100",
      icon: "text-blue-600",
      title: "text-blue-900",
      text: "text-blue-800",
    },
    orange: {
      wrap: "border-orange-200 bg-orange-50",
      iconWrap: "bg-orange-100",
      icon: "text-orange-600",
      title: "text-orange-900",
      text: "text-orange-800",
    },
    green: {
      wrap: "border-green-200 bg-green-50",
      iconWrap: "bg-green-100",
      icon: "text-green-600",
      title: "text-green-900",
      text: "text-green-800",
    },
  }[tone];

  return (
    <div className={`rounded-xl border p-6 ${tones.wrap}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tones.iconWrap}`}>
          <Icon className={`h-5 w-5 ${tones.icon}`} />
        </div>
        <div>
          <h4 className={`mb-1 font-semibold ${tones.title}`}>{title}</h4>
          <p className={`text-sm ${tones.text}`}>{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPageView() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [weeklyStudy, setWeeklyStudy] = useState<Array<{ week: string; actual: number; target: number }>>([]);
  const [dailyConsistency, setDailyConsistency] = useState<Array<{ day: string; hours: number }>>([]);
  const [sessionType, setSessionType] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [timeByCourse, setTimeByCourse] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [courseProgress, setCourseProgress] = useState<Array<{ name: string; studied: string; pct: number; color: string }>>([]);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const response = await fetch("/api/analytics", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setKpis(data.kpis);
        setWeeklyStudy(data.weeklyStudy);
        setDailyConsistency(data.dailyConsistency);
        setSessionType(data.sessionType);
        setTimeByCourse(data.timeByCourse);
        setCourseProgress(data.courseProgress);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading) {
    return <div className="min-h-full bg-gray-50 p-4 text-sm text-gray-500">Loading analytics...</div>;
  }

  const topCourse = courseProgress[0];
  const weakestCourse = [...courseProgress].sort((a, b) => a.pct - b.pct)[0];
  const streakKpi = kpis.find((item) => item.label === "Study Streak")?.value ?? "0 days";

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Weekly Study Hours"
              right={
                <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  Last 6 weeks
                </span>
              }
            />
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyStudy} barCategoryGap={18}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle()} />
                    <Bar dataKey="actual" fill="#3B82F6" radius={[10, 10, 0, 0]} name="Actual Hours" />
                    <Bar dataKey="target" fill="#D1D5DB" radius={[10, 10, 0, 0]} name="Target Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  <span className="font-medium text-gray-700">Actual Hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-gray-300" />
                  <span className="text-gray-400">Target Hours</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Daily Consistency" />
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyConsistency}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle()} />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="#8B5CF6"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#8B5CF6" }}
                      activeDot={{ r: 7 }}
                      name="Study Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Session Type Distribution" />
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sessionType} dataKey="value" nameKey="name" outerRadius={110} paddingAngle={2}>
                      {sessionType.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mx-auto mt-2 grid w-full max-w-md grid-cols-3 gap-8">
                {sessionType.map((item) => (
                  <div key={item.name} className="text-center">
                    <div className="mb-1 flex items-center justify-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <p className="text-xs text-gray-600">{item.name}</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Time Distribution by Course" />
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={timeByCourse} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                      {timeByCourse.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader title="Course Progress Overview" />
          <CardContent>
            <div className="space-y-5">
              {courseProgress.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">{item.studied}</span>
                      <span className="text-sm font-bold text-gray-900">{item.pct}%</span>
                    </div>
                  </div>

                  <ProgressBar value={item.pct} colorClass={item.color} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <InsightCard
            Icon={Sparkles}
            tone="blue"
            title="Best Performance"
            message={topCourse ? `${topCourse.name} is currently your strongest track at ${topCourse.pct}% completion.` : "No progress data available yet."}
          />
          <InsightCard
            Icon={AlertCircle}
            tone="orange"
            title="Needs Attention"
            message={weakestCourse ? `${weakestCourse.name} has the lowest completion rate right now at ${weakestCourse.pct}%.` : "No low-progress items detected."}
          />
          <InsightCard
            Icon={CheckCircle2}
            tone="green"
            title="Streak Bonus"
            message={`${streakKpi} active. Keep that consistency going into next week.`}
          />
        </div>
      </div>
    </div>
  );
}
