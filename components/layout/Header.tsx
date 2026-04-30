'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signOut } from "next-auth/react";
import {
  Bell,
  Search,
  Menu,
  X,
  Clock,
  AlertCircle,
  Trophy,
  Sparkles,
  ChevronDown,
  LogOut,
  Settings,
  User,
  BookOpen,
  CheckSquare,
  Calendar,
  Star,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — all searchable data across the whole project
// ─────────────────────────────────────────────────────────────────────────────

type SearchCategory = 'Course' | 'Task' | 'Session' | 'Page';

interface SearchItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

const ALL_ITEMS: SearchItem[] = [
  // Pages
  { id: 'p1', category: 'Page', title: 'Dashboard',     subtitle: 'Overview of your study activity',          href: '/dashboard',  keywords: 'home overview stats streak goals' },
  { id: 'p2', category: 'Page', title: 'AI Setup',      subtitle: 'Configure your AI study plan generator',   href: '/ai-setup',   keywords: 'ai generate plan schedule setup' },
  { id: 'p3', category: 'Page', title: 'My Courses',    subtitle: 'Manage your courses and learning goals',   href: '/courses',    keywords: 'courses subjects classes goals' },
  { id: 'p4', category: 'Page', title: 'Tasks / To-Do', subtitle: 'View and manage all your tasks',           href: '/tasks',      keywords: 'tasks todo assignments checklist' },
  { id: 'p5', category: 'Page', title: 'Study Plan',    subtitle: 'Your personalized AI study schedule',      href: '/study-plan', keywords: 'plan schedule timetable sessions' },
  { id: 'p6', category: 'Page', title: 'Calendar',      subtitle: 'Calendar view of all study sessions',      href: '/calendar',   keywords: 'calendar events month week' },
  { id: 'p7', category: 'Page', title: 'Analytics',     subtitle: 'Track your progress and statistics',       href: '/analytics',  keywords: 'analytics stats progress charts hours' },
  { id: 'p8', category: 'Page', title: 'My Profile',    subtitle: 'Manage your profile and account settings', href: '/profile',    keywords: 'profile account settings password name email' },

  // Courses
  { id: 'c1', category: 'Course', title: 'Data Structures & Algorithms', subtitle: 'Hard · 45% complete · Due 3/15/2026',  href: '/courses', keywords: 'dsa binary trees avl leetcode graphs sorting hard' },
  { id: 'c2', category: 'Course', title: 'Calculus II',                  subtitle: 'Medium · 62% complete · Due 3/20/2026', href: '/courses', keywords: 'calculus integration techniques midterm math medium' },
  { id: 'c3', category: 'Course', title: 'Web Development',              subtitle: 'Easy · 78% complete · Due 4/1/2026',   href: '/courses', keywords: 'web react hooks portfolio javascript css html easy' },
  { id: 'c4', category: 'Course', title: 'Database Systems',             subtitle: 'Medium · 38% complete · Due 3/25/2026', href: '/courses', keywords: 'sql joins normalization database queries medium' },
  { id: 'c5', category: 'Course', title: 'Linear Algebra',               subtitle: 'Hard · 55% complete · Due 3/18/2026',  href: '/courses', keywords: 'linear algebra eigenvalues matrices vectors hard' },
  { id: 'c6', category: 'Course', title: 'Operating Systems',            subtitle: 'Hard · 30% complete · Due 4/10/2026',  href: '/courses', keywords: 'os threads scheduling memory management hard' },

  // Tasks
  { id: 't1', category: 'Task', title: 'Complete Data Structures Assignment', subtitle: 'High priority · Due Feb 3 · 23:59', href: '/tasks', keywords: 'avl tree rotation assignment high priority data structures' },
  { id: 't2', category: 'Task', title: 'Study Calculus Chapter 5',            subtitle: 'Medium · Due Feb 3 · 18:00',         href: '/tasks', keywords: 'calculus integration study chapter medium' },
  { id: 't3', category: 'Task', title: 'Review React Hooks',                  subtitle: 'Low priority · Due Feb 4 · 10:00',  href: '/tasks', keywords: 'react usestate useeffect custom hooks review low' },
  { id: 't4', category: 'Task', title: 'Database Systems Quiz Prep',          subtitle: 'High priority · Due Feb 5 · 14:00', href: '/tasks', keywords: 'sql quiz exam database prep high priority' },
  { id: 't5', category: 'Task', title: 'Linear Algebra Problem Set',          subtitle: 'Medium · Due Feb 6 · 23:59',         href: '/tasks', keywords: 'linear algebra problems assignment medium textbook' },
  { id: 't6', category: 'Task', title: 'Prepare Presentation Slides',         subtitle: 'High priority · Due Feb 7 · 16:00', href: '/tasks', keywords: 'presentation slides project operating systems high' },

  // Sessions
  { id: 's1', category: 'Session', title: 'Data Structures – Binary Trees',  subtitle: 'Today 2:00 PM · 2h · Hard',    href: '/study-plan', keywords: 'binary trees data structures session hard today' },
  { id: 's2', category: 'Session', title: 'Calculus II – Integration',       subtitle: 'Today 5:00 PM · 1.5h · Medium', href: '/study-plan', keywords: 'calculus integration session medium today' },
  { id: 's3', category: 'Session', title: 'Web Dev – React Hooks Review',    subtitle: 'Tomorrow 10:00 AM · 1h · Easy', href: '/study-plan', keywords: 'web react hooks review session easy tomorrow' },
  { id: 's4', category: 'Session', title: 'Database Systems – SQL Joins',    subtitle: 'Tomorrow 3:00 PM · 2h · Medium', href: '/study-plan', keywords: 'sql joins database session medium tomorrow' },
];

const CATEGORY_META: Record<
  SearchCategory,
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  Page:    { label: 'Pages',    Icon: Star,        color: 'text-gray-600',   bg: 'bg-gray-100'   },
  Course:  { label: 'Courses',  Icon: BookOpen,    color: 'text-blue-600',   bg: 'bg-blue-100'   },
  Task:    { label: 'Tasks',    Icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-100' },
  Session: { label: 'Sessions', Icon: Calendar,    color: 'text-green-600',  bg: 'bg-green-100'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

type NotificationType = 'reminder' | 'deadline' | 'achievement' | 'feature';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read?: boolean;
};

function notifIcon(type: NotificationType) {
  switch (type) {
    case 'reminder':    return { Icon: Clock,       bg: 'bg-blue-50',   fg: 'text-blue-600'   };
    case 'deadline':    return { Icon: AlertCircle, bg: 'bg-red-50',    fg: 'text-red-600'    };
    case 'achievement': return { Icon: Trophy,      bg: 'bg-green-50',  fg: 'text-green-600'  };
    default:            return { Icon: Sparkles,    bg: 'bg-purple-50', fg: 'text-purple-600' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT — bolds the matched query inside a result title
// ─────────────────────────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded-sm font-bold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

export function Header({
  setIsOpen,
  title = 'Dashboard',
}: {
  setIsOpen?: (v: boolean) => void;
  title?: string;
}) {
  const router = useRouter();

  // ── useSession: reads the active NextAuth session from the browser cookie ──
  // `data` is the session object (null when logged out, undefined while loading)
  // `status` is 'loading' | 'authenticated' | 'unauthenticated'
  const { data: session, status } = useSession();

  // Derive display values from the session — fall back gracefully while loading
  const userName  = session?.user?.name  ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const initials  = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Search
  const [query,       setQuery]       = useState('');
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [focused,     setFocused]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Panels
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  // Notifications data
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: '1', type: 'reminder',    title: 'Study Reminder',        message: 'Time to study Data Structures - Binary Trees',       time: '5 min ago',  read: false },
    { id: '2', type: 'deadline',    title: 'Upcoming Deadline',     message: 'Calculus II assignment due in 2 days',                time: '1 hour ago', read: false },
    { id: '3', type: 'achievement', title: 'Achievement Unlocked!', message: 'You completed 7 days study streak!',                 time: '3 hours ago',read: false },
    { id: '4', type: 'feature',     title: 'New Feature Available', message: 'Check out our new AI-powered study recommendations', time: '1 day ago',  read: true  },
  ]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Compute search results
  const results = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<SearchCategory, SearchItem[]>();
    for (const item of results) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [results]);

  const showDropdown = searchOpen && query.trim().length > 0;

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (searchRef.current && !searchRef.current.contains(t)) { setSearchOpen(false); setActiveIndex(-1); }
      if (notifRef.current  && !notifRef.current.contains(t))  setNotifOpen(false);
      if (menuRef.current   && !menuRef.current.contains(t))   setMenuOpen(false);
    }
    document.addEventListener('mousedown',  handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  // Escape key
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); setMenuOpen(false); setActiveIndex(-1); inputRef.current?.blur(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Arrow key nav
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); navigateTo(results[activeIndex]); }
  }

  function navigateTo(item: SearchItem) {
    setQuery(''); setSearchOpen(false); setActiveIndex(-1);
    router.push(item.href);
  }

  function markAllRead() { setNotifications((p) => p.map((n) => ({ ...n, read: true }))); }
  function dismiss(id: string) { setNotifications((p) => p.filter((n) => n.id !== id)); }

  let runIdx = -1; // running index for keyboard highlight across groups

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-3">

        {/* Left */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setIsOpen?.(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100" aria-label="Open sidebar">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="hidden md:block text-lg md:text-xl font-bold text-gray-800">{title}</h2>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* ── Search ──────────────────────────────────────────────────────── */}
          <div className="relative" ref={searchRef}>
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 bg-white transition-all duration-200 ${
              focused ? 'border-blue-500 ring-2 ring-blue-100 w-52 sm:w-72 md:w-96' : 'border-gray-200 w-36 sm:w-52 md:w-72'
            }`}>
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder="Search courses, tasks, topics…"
                className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400 min-w-0"
                aria-label="Search"
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); setActiveIndex(-1); }}
                onFocus={() => { setFocused(true); setSearchOpen(true); setNotifOpen(false); setMenuOpen(false); }}
                onBlur={() => setFocused(false)}
                onKeyDown={onKeyDown}
              />
              {query && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); setQuery(''); setActiveIndex(-1); inputRef.current?.focus(); }}
                  aria-label="Clear"
                >
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                {results.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2 text-center px-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">No results for "{query}"</p>
                    <p className="text-xs text-gray-400">Try a course name, task, or page</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-gray-50">
                      <p className="text-xs text-gray-400">
                        <span className="font-semibold text-gray-700">{results.length}</span> result{results.length !== 1 ? 's' : ''} for "<span className="text-gray-700">{query}</span>"
                      </p>
                      <p className="text-xs text-gray-300 hidden sm:block">↑↓ · Enter</p>
                    </div>

                    <div className="max-h-[440px] overflow-y-auto pb-2">
                      {Array.from(grouped.entries()).map(([cat, items]) => {
                        const meta = CATEGORY_META[cat];
                        return (
                          <div key={cat}>
                            {/* Category header */}
                            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                              <meta.Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{meta.label}</span>
                            </div>

                            {/* Items */}
                            {items.map((item) => {
                              runIdx++;
                              const myIdx = runIdx;
                              const isActive = myIdx === activeIndex;
                              return (
                                <button
                                  key={item.id}
                                  onMouseDown={(e) => { e.preventDefault(); navigateTo(item); }}
                                  onMouseEnter={() => setActiveIndex(myIdx)}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                >
                                  <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                                    <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      <Highlight text={item.title} query={query} />
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 -rotate-90 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-200'}`} />
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

          {/* ── Notifications ─────────────────────────────────────────────────── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
              className="relative p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] rounded-full flex items-center justify-center font-semibold">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="
                  fixed sm:absolute
                  right-3 sm:right-0
                  top-[72px] sm:top-auto
                  mt-0 sm:mt-3
                  w-[calc(100vw-24px)] sm:w-[360px]
                  max-w-[420px]
                  bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden
                  z-50
                "
              >
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Notifications</div>
                    <div className="text-xs text-gray-500">{unreadCount} unread</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-700">Mark all read</button>
                    <button onClick={() => setNotifOpen(false)} className="p-1 rounded-md hover:bg-gray-100" aria-label="Close">
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[70vh] sm:max-h-[420px] overflow-auto">
                  {notifications.map((n) => {
                    const { Icon, bg, fg } = notifIcon(n.type);
                    return (
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition flex gap-3 ${n.read ? 'opacity-80' : ''}`}>
                        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${fg}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                            <button onClick={() => dismiss(n.id)} className="p-1 rounded-md hover:bg-gray-100" aria-label="Dismiss"><X className="w-3.5 h-3.5 text-gray-500" /></button>
                          </div>
                          <div className="text-sm text-gray-600 truncate">{n.message}</div>
                          <div className="text-xs text-gray-400 mt-1">{n.time}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3">
                    <Link href="/notifications" className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => setNotifOpen(false)}>
                      View all notifications
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Avatar + profile dropdown ──────────────────────────────────────── */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100"
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              {/* Avatar circle — shows initials from session */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold text-sm">
                {status === 'loading' ? '…' : initials}
              </div>
              <ChevronDown className="hidden sm:block w-4 h-4 text-gray-500" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-[280px] max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {/* Larger avatar in dropdown */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      {/* Name and email pulled from session */}
                      <div className="font-semibold text-gray-900">{userName}</div>
                      <div className="text-sm text-gray-500 truncate">{userEmail}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 border border-blue-100">Free Plan</span>
                  </div>
                </div>
                <div className="p-2">
                  <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-800" onClick={() => setMenuOpen(false)}>
                    <User className="w-5 h-5 text-gray-500" /><span className="font-medium">My Profile</span>
                  </Link>
                  <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-800" onClick={() => setMenuOpen(false)}>
                    <Settings className="w-5 h-5 text-gray-500" /><span className="font-medium">Settings</span>
                  </Link>
                  <div className="my-2 border-t border-gray-100" />
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600"
                  >
                    <LogOut className="w-5 h-5" /><span className="font-medium">Logout</span>
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
