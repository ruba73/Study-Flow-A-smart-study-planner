"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  Star,
  Trophy,
  User,
  X,
} from "lucide-react";

type SearchCategory = "Course" | "Task" | "Session" | "Page";

interface SearchItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  href: string;
  keywords?: string;
}

type NotificationType = "reminder" | "deadline" | "achievement" | "feature" | "review-due" | "system" | "group-invite";

interface HeaderNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actionUrl?: string | null;
}

const CATEGORY_META: Record<SearchCategory, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  Page: { label: "Pages", Icon: Star, color: "text-gray-600", bg: "bg-gray-100" },
  Course: { label: "Courses", Icon: BookOpen, color: "text-blue-600", bg: "bg-blue-100" },
  Task: { label: "Tasks", Icon: CheckSquare, color: "text-purple-600", bg: "bg-purple-100" },
  Session: { label: "Sessions", Icon: Calendar, color: "text-green-600", bg: "bg-green-100" },
};

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

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-100 font-bold text-yellow-900 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
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

function getInitials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export function Header({
  setIsOpen,
  title = "Dashboard",
}: {
  setIsOpen?: (v: boolean) => void;
  title?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const grouped = useMemo(() => {
    const map = new Map<SearchCategory, SearchItem[]>();
    for (const item of results) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)?.push(item);
    }
    return map;
  }, [results]);

  const showDropdown = searchOpen && query.trim().length > 0;

  async function loadNotifications() {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: HeaderNotification[] };
      setNotifications(data.notifications);
    } finally {
      setNotificationsLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadNotifications();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { results: SearchItem[] };
        setResults(data.results);
      } finally {
        setSearchLoading(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    }

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setMenuOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  function navigateTo(item: SearchItem) {
    setQuery("");
    setSearchOpen(false);
    setActiveIndex(-1);
    router.push(item.href);
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });

    if (!response.ok) return;
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
  }

  async function dismiss(id: string) {
    const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) return;
    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  async function handleLogout() {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/Auth?mode=login" });
  }

  const profileName = session?.user?.name || "User";
  const profileEmail = session?.user?.email || "";
  const initials = getInitials(profileName);
  let runIdx = -1;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            onClick={() => setIsOpen?.(true)}
            className="rounded-lg p-2 hover:bg-gray-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h2 className="hidden text-lg font-bold text-gray-800 md:block md:text-xl">{title}</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative" ref={searchRef}>
            <div
              className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 transition-all duration-200 ${
                focused ? "w-52 border-blue-500 ring-2 ring-blue-100 sm:w-72 md:w-96" : "w-36 border-gray-200 sm:w-52 md:w-72"
              }`}
            >
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder="Search subjects, tasks, topics..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                aria-label="Search"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  setFocused(true);
                  setSearchOpen(true);
                  setNotifOpen(false);
                  setMenuOpen(false);
                }}
                onBlur={() => setFocused(false)}
                onKeyDown={onKeyDown}
              />
              {query && (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("");
                    setActiveIndex(-1);
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {showDropdown && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl sm:w-[440px]">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      {searchLoading ? "Searching..." : `No results for "${query}"`}
                    </p>
                    <p className="text-xs text-gray-400">Try a course name, task, or page</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-gray-50 px-4 pb-1 pt-3">
                      <p className="text-xs text-gray-400">
                        <span className="font-semibold text-gray-700">{results.length}</span> result{results.length !== 1 ? "s" : ""} for <span className="text-gray-700">&quot;{query}&quot;</span>
                      </p>
                      <p className="hidden text-xs text-gray-300 sm:block">↑↓ · Enter</p>
                    </div>

                    <div className="max-h-[440px] overflow-y-auto pb-2">
                      {Array.from(grouped.entries()).map(([category, items]) => {
                        const meta = CATEGORY_META[category];
                        return (
                          <div key={category}>
                            <div className="flex items-center gap-1.5 px-4 pb-1 pt-3">
                              <meta.Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{meta.label}</span>
                            </div>

                            {items.map((item) => {
                              runIdx += 1;
                              const currentIndex = runIdx;
                              const isActive = currentIndex === activeIndex;
                              return (
                                <button
                                  key={item.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    navigateTo(item);
                                  }}
                                  onMouseEnter={() => setActiveIndex(currentIndex)}
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                >
                                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                                    <meta.Icon className={`h-4 w-4 ${meta.color}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                      <Highlight text={item.title} query={query} />
                                    </p>
                                    <p className="truncate text-xs text-gray-500">{item.subtitle}</p>
                                  </div>
                                  <ChevronDown className={`h-4 w-4 flex-shrink-0 -rotate-90 ${isActive ? "text-blue-400" : "text-gray-200"}`} />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen((value) => !value);
                setMenuOpen(false);
              }}
              className="relative rounded-lg p-2 hover:bg-gray-100"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed right-3 top-[72px] z-50 mt-0 w-[calc(100vw-24px)] max-w-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:absolute sm:right-0 sm:top-auto sm:mt-3 sm:w-[360px]">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <div className="font-semibold text-gray-900">Notifications</div>
                    <div className="text-xs text-gray-500">{unreadCount} unread</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-700">
                      Mark all read
                    </button>
                    <button onClick={() => setNotifOpen(false)} className="rounded-md p-1 hover:bg-gray-100" aria-label="Close">
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-auto sm:max-h-[420px]">
                  {notificationsLoading ? (
                    <div className="p-4 text-sm text-gray-500">Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No notifications yet.</div>
                  ) : (
                    notifications.map((notification) => {
                      const { Icon, bg, fg } = notifIcon(notification.type);
                      return (
                        <div
                          key={notification.id}
                          className={`flex gap-3 border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 ${notification.isRead ? "opacity-80" : ""}`}
                        >
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
                            <Icon className={`h-5 w-5 ${fg}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-semibold text-gray-900">{notification.title}</div>
                              <button onClick={() => dismiss(notification.id)} className="rounded-md p-1 hover:bg-gray-100" aria-label="Dismiss">
                                <X className="h-3.5 w-3.5 text-gray-500" />
                              </button>
                            </div>
                            <div className="truncate text-sm text-gray-600">{notification.message}</div>
                            <div className="mt-1 text-xs text-gray-400">{formatRelativeTime(notification.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="p-3">
                    <Link href="/notifications" className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => setNotifOpen(false)}>
                      View all notifications
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                setMenuOpen((value) => !value);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                {initials}
              </div>
              <ChevronDown className="hidden h-4 w-4 text-gray-500 sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[280px] max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                <div className="border-b border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{profileName}</div>
                      <div className="truncate text-sm text-gray-500">{profileEmail}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-700">
                      Student Account
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <Link href="/profile" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-800 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                    <User className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">My Profile</span>
                  </Link>
                  <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-800 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                    <Settings className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Settings</span>
                  </Link>
                  <div className="my-2 border-t border-gray-100" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50">
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
