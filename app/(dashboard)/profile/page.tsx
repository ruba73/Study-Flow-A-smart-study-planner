"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Award, BookOpen, CalendarDays, Camera, Clock, Flame, Globe, Shield } from "lucide-react";

type SchoolLevel = "high-school" | "undergraduate" | "graduate" | "professional";
type FocusHours = "morning" | "afternoon" | "evening" | "night" | "flexible";

interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: string;
    profile: {
      schoolLevel?: SchoolLevel;
      timezone?: string;
      language?: string;
      focusHours?: FocusHours;
    };
    stats: {
      completedGoals: number;
      totalStudyTime: number;
      currentStreak: number;
      totalTasks: number;
      completedTasks: number;
    };
  };
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function formatSchoolLevel(value?: SchoolLevel) {
  switch (value) {
    case "high-school":
      return "High School";
    case "undergraduate":
      return "Undergraduate";
    case "graduate":
      return "Graduate";
    case "professional":
      return "Professional";
    default:
      return "Undergraduate";
  }
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    schoolLevel: "undergraduate" as SchoolLevel,
    timezone: "UTC",
    language: "en",
    focusHours: "flexible" as FocusHours,
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [stats, setStats] = useState({
    completedGoals: 0,
    totalStudyTime: 0,
    currentStreak: 0,
    totalTasks: 0,
    completedTasks: 0,
  });
  const [joinedAt, setJoinedAt] = useState("");

  const initials = useMemo(() => getInitials(form.fullName), [form.fullName]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadProfile() {
    setLoading(true);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as ProfileResponse;
      setForm((current) => ({
        ...current,
        fullName: data.user.name,
        email: data.user.email,
        schoolLevel: data.user.profile.schoolLevel ?? "undergraduate",
        timezone: data.user.profile.timezone ?? "UTC",
        language: data.user.profile.language ?? "en",
        focusHours: data.user.profile.focusHours ?? "flexible",
      }));
      setAvatarPreview(data.user.avatar);
      setStats(data.user.stats);
      setJoinedAt(
        new Date(data.user.createdAt).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.fullName,
          email: form.email,
          avatar: avatarPreview,
          profile: {
            schoolLevel: form.schoolLevel,
            timezone: form.timezone,
            language: form.language,
            focusHours: form.focusHours,
          },
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        alert(data.message || "Could not save profile");
        return;
      }

      alert("Profile saved successfully.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordSaving(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          confirmNewPassword: form.confirmNewPassword,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        alert(data.message || "Could not change password");
        return;
      }

      setForm((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      alert("Password changed successfully.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function onPickAvatar() {
    fileInputRef.current?.click();
  }

  function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      alert("Please use an image under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return <div className="min-h-full bg-gray-50 p-4 text-sm text-gray-500">Loading profile...</div>;
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="mx-auto max-w-5xl">
          <div className="hidden items-start gap-3 md:mb-6 md:flex">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <span className="text-2xl font-bold">👤</span>
            </div>
            <div>
              <h2 className="mb-1 text-xl font-bold text-gray-900">My Profile</h2>
              <p className="text-gray-600">Manage your personal information and account preferences</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="relative h-28 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500">
              <div className="absolute bottom-8 left-4 w-[calc(100%-2rem)] text-left sm:left-6 sm:w-[calc(100%-3rem)] md:left-16 md:w-[60%] lg:left-[12%] lg:w-[30%]">
                <div className="truncate text-xl font-bold leading-tight text-white drop-shadow sm:text-2xl">
                  {form.fullName}
                </div>
                <div className="truncate text-xs text-white/90 drop-shadow sm:text-sm">{form.email}</div>
              </div>
            </div>

            <div className="-mt-10 px-6">
              <div className="flex items-end gap-4">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white ring-4 ring-white">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onPickAvatar}
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
                    aria-label="Change avatar"
                  >
                    <Camera className="h-4 w-4 text-gray-600" />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAvatarSelected}
                  />
                </div>

                <div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-700">
                      <BookOpen className="h-4 w-4" />
                      {formatSchoolLevel(form.schoolLevel)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm text-purple-700">
                      <Globe className="h-4 w-4" />
                      {form.timezone}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-sm text-green-700">
                      <CalendarDays className="h-4 w-4" />
                      Joined {joinedAt}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={<Award className="h-5 w-5 text-blue-600" />} title="Goals Completed" value={String(stats.completedGoals)} />
                <StatCard icon={<Clock className="h-5 w-5 text-purple-600" />} title="Study Hours" value={`${Math.round(stats.totalStudyTime / 60)}h`} />
                <StatCard icon={<Flame className="h-5 w-5 text-green-600" />} title="Current Streak" value={`${stats.currentStreak} days`} />
                <StatCard icon={<BookOpen className="h-5 w-5 text-orange-600" />} title="Tasks Completed" value={`${stats.completedTasks}/${stats.totalTasks}`} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <input
                    value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Email Address">
                  <input
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="School Level">
                  <select
                    value={form.schoolLevel}
                    onChange={(e) => setField("schoolLevel", e.target.value as SchoolLevel)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="high-school">High School</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="graduate">Graduate</option>
                    <option value="professional">Professional</option>
                  </select>
                </Field>

                <Field label="Preferred Focus Hours">
                  <select
                    value={form.focusHours}
                    onChange={(e) => setField("focusHours", e.target.value as FocusHours)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </Field>

                <Field label="Timezone">
                  <input
                    value={form.timezone}
                    onChange={(e) => setField("timezone", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>

                <Field label="Language">
                  <input
                    value={form.language}
                    onChange={(e) => setField("language", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              </div>

              <div className="mt-8 rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <Shield className="h-5 w-5 text-red-500" />
                  Security
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Current Password">
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={form.currentPassword}
                      onChange={(e) => setField("currentPassword", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>

                  <div className="hidden md:block" />

                  <Field label="New Password">
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={form.newPassword}
                      onChange={(e) => setField("newPassword", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>

                  <Field label="Confirm New Password">
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={form.confirmNewPassword}
                      onChange={(e) => setField("confirmNewPassword", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={changePassword}
                      disabled={passwordSaving}
                      className="rounded-xl bg-gray-100 px-5 py-2.5 font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-60"
                    >
                      {passwordSaving ? "Changing..." : "Change Password"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 pb-6">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 py-4 font-semibold text-white hover:opacity-95 active:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
      {children}
    </label>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">{icon}</div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}
