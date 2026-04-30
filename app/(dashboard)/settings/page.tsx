'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Settings as SettingsIcon, Target, Bell, Save, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [dailyGoal, setDailyGoal] = useState(6);
  const [breakDuration, setBreakDuration] = useState('10');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('21:00');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [studyReminders, setStudyReminders] = useState(true);
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const response = await fetch('/api/settings', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const profile = data.user?.profile ?? {};
      const preferences = data.user?.preferences ?? {};
      const notifications = preferences.notifications ?? {};
      const breakRules = preferences.breakRules ?? {};

      setDailyGoal(preferences.maxStudyHoursPerDay ?? 6);
      setBreakDuration(String(breakRules.breakDuration ?? 10));
      setStartTime(profile.availabilityStartTime ?? '09:00');
      setEndTime(profile.availabilityEndTime ?? '21:00');
      setEmailNotifications(Boolean(notifications.email));
      setPushNotifications(Boolean(notifications.push));
      setStudyReminders(Boolean(notifications.dailyReminder));
      setDeadlineAlerts(Boolean(notifications.inApp));
      setWeeklyReports(Boolean(notifications.weeklyReport));
    }

    loadSettings();
  }, []);

  const calculateStudyWindow = () => {
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    return `${startTime} - ${endTime} (${Math.max(0, end - start)} hours)`;
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            availabilityStartTime: startTime,
            availabilityEndTime: endTime,
          },
          preferences: {
            maxStudyHoursPerDay: dailyGoal,
            breakRules: {
              breakDuration: parseInt(breakDuration),
            },
            notifications: {
              email: emailNotifications,
              push: pushNotifications,
              inApp: deadlineAlerts,
              dailyReminder: studyReminders,
              weeklyReport: weeklyReports,
            },
          },
        }),
      });

      if (!response.ok) {
        alert('Could not save settings.');
        return;
      }
      alert('Settings saved successfully!');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await signOut({ callbackUrl: '/Auth?mode=login' });
    }
  };

  const toggleRows: Array<{
    title: string;
    subtitle: string;
    value: boolean;
    setter: (value: boolean) => void;
  }> = [
    { title: 'Email Notifications', subtitle: 'Receive updates via email', value: emailNotifications, setter: setEmailNotifications },
    { title: 'Push Notifications', subtitle: 'Receive browser notifications', value: pushNotifications, setter: setPushNotifications },
    { title: 'Study Reminders', subtitle: 'Get reminded about study sessions', value: studyReminders, setter: setStudyReminders },
    { title: 'Deadline Alerts', subtitle: 'Alerts for upcoming deadlines', value: deadlineAlerts, setter: setDeadlineAlerts },
    { title: 'Weekly Reports', subtitle: 'Receive weekly progress summaries', value: weeklyReports, setter: setWeeklyReports },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="mb-6 hidden md:block">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <SettingsIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="mb-1 text-xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-600">Manage your preferences and application settings</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Study Preferences</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Daily Study Goal (hours)</label>
              <input
                type="number"
                min="1"
                max="12"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Break Duration (minutes)</label>
                <select
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['5', '10', '15', '20', '30'].map((value) => (
                    <option key={value} value={value}>{value} minutes</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Preferred Study Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Preferred Study End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Available Study Window: <span className="text-blue-600">{calculateStudyWindow()}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
          </div>

          <div className="space-y-4">
            {toggleRows.map((row, index) => (
              <div key={row.title} className={`flex items-center justify-between py-3 ${index < toggleRows.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div>
                  <p className="font-medium text-gray-900">{row.title}</p>
                  <p className="text-sm text-gray-600">{row.subtitle}</p>
                </div>
                <button
                  onClick={() => row.setter(!row.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    row.value ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      row.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-60"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-600 px-6 py-3 font-semibold text-red-600 transition-all hover:bg-red-50 sm:w-auto"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
