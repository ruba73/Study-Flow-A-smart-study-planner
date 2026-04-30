"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock, Sparkles, Trophy, X } from "lucide-react";

type NotificationType = "reminder" | "deadline" | "achievement" | "feature" | "review-due" | "system" | "group-invite";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

function notifIcon(type: NotificationType) {
  switch (type) {
    case "reminder":
      return { Icon: Clock, bg: "bg-blue-50", fg: "text-blue-600" };
    case "deadline":
      return { Icon: AlertCircle, bg: "bg-red-50", fg: "text-red-600" };
    case "achievement":
      return { Icon: Trophy, bg: "bg-green-50", fg: "text-green-600" };
    default:
      return { Icon: Sparkles, bg: "bg-purple-50", fg: "text-purple-600" };
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const unread = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=100", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: NotificationItem[] };
      setItems(data.notifications);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });
    if (!response.ok) return;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  }

  async function dismiss(id: string) {
    const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-500">{unread} unread</p>
            </div>

            <button
              onClick={markAllRead}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Mark all read
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading notifications...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">You are all caught up.</div>
            ) : (
              items.map((item) => {
                const { Icon, bg, fg } = notifIcon(item.type);
                return (
                  <div key={item.id} className="flex gap-4 border-b border-gray-100 px-5 py-4 hover:bg-gray-50">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
                      <Icon className={`h-5 w-5 ${fg}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{item.title}</div>
                          <div className="text-sm text-gray-600">{item.message}</div>
                          <div className="mt-1 text-xs text-gray-400">{formatRelativeTime(item.createdAt)}</div>
                        </div>

                        <button onClick={() => dismiss(item.id)} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Dismiss">
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
