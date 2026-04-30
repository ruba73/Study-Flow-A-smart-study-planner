'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, BookOpen, SquareCheckBig, Brain } from 'lucide-react';

type EventType = 'session' | 'task' | 'exam' | 'deadline';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration?: string;
  type: EventType;
  subject?: string;
  color: string;
}

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  blue: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  purple: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  green: { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  orange: { dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  red: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function typeIcon(type: EventType) {
  switch (type) {
    case 'session':
      return <Brain className="h-3.5 w-3.5" />;
    case 'task':
      return <SquareCheckBig className="h-3.5 w-3.5" />;
    case 'exam':
      return <BookOpen className="h-3.5 w-3.5" />;
    case 'deadline':
      return <Clock className="h-3.5 w-3.5" />;
  }
}

function typeLabel(type: EventType) {
  switch (type) {
    case 'session':
      return 'Study Session';
    case 'task':
      return 'Task';
    case 'exam':
      return 'Exam / Quiz';
    case 'deadline':
      return 'Deadline';
  }
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function DayDetailPanel({ date, events }: { date: string; events: CalendarEvent[] }) {
  const dt = new Date(`${date}T12:00:00`);
  const label = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{sorted.length} event{sorted.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <CalendarIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No events scheduled</p>
          </div>
        ) : (
          sorted.map((event) => {
            const color = EVENT_COLORS[event.color] ?? EVENT_COLORS.blue;
            return (
              <div key={event.id} className={`rounded-lg border p-3 ${color.bg} ${color.border}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 ${color.text}`}>{typeIcon(event.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${color.text}`}>{event.title}</p>
                    {event.subject && <p className="mt-0.5 text-xs text-gray-500">{event.subject}</p>}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.time)}
                        {event.duration && <span>· {event.duration}</span>}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color.bg} ${color.text}`}>
                        {typeLabel(event.type)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeFilter, setActiveFilter] = useState<'all' | EventType>('all');

  useEffect(() => {
    async function loadCalendar() {
      setLoading(true);
      try {
        const response = await fetch('/api/calendar', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { events: CalendarEvent[] };
        setEvents(data.events);
      } finally {
        setLoading(false);
      }
    }
    loadCalendar();
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
  }

  const eventsForDate = (date: string) => events.filter((event) => event.date === date);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => (activeFilter === 'all' ? true : event.type === activeFilter))
        .filter((event) => event.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .slice(0, 12),
    [events, activeFilter, todayStr],
  );

  const monthEvents = events.filter((event) => {
    const [year, month] = event.date.split('-').map(Number);
    return year === viewYear && month - 1 === viewMonth;
  });

  const stats = [
    { label: 'Study Sessions', value: monthEvents.filter((event) => event.type === 'session').length, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Brain className="h-4 w-4" /> },
    { label: 'Tasks', value: monthEvents.filter((event) => event.type === 'task').length, color: 'text-purple-600', bg: 'bg-purple-50', icon: <SquareCheckBig className="h-4 w-4" /> },
    { label: 'Exams / Quizzes', value: monthEvents.filter((event) => event.type === 'exam').length, color: 'text-red-600', bg: 'bg-red-50', icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Deadlines', value: monthEvents.filter((event) => event.type === 'deadline').length, color: 'text-orange-600', bg: 'bg-orange-50', icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
              <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                    {MONTHS[viewMonth]} {viewYear}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => (viewMonth === 0 ? (setViewYear((y) => y - 1), setViewMonth(11)) : setViewMonth((m) => m - 1))} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                      <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <button onClick={() => (viewMonth === 11 ? (setViewYear((y) => y + 1), setViewMonth(0)) : setViewMonth((m) => m + 1))} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setViewYear(todayDate.getFullYear());
                    setViewMonth(todayDate.getMonth());
                    setSelectedDate(todayStr);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Today
                </button>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:py-3 sm:text-xs">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day[0]}</span>
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="p-10 text-center text-sm text-gray-500">Loading calendar...</div>
              ) : (
                <div className="grid grid-cols-7">
                  {cells.map((cell, index) => {
                    const dayEvents = eventsForDate(cell.date);
                    const isToday = cell.date === todayStr;
                    const isSelected = cell.date === selectedDate;
                    const isPast = cell.date < todayStr;

                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`min-h-[56px] cursor-pointer border-b border-r border-gray-100 p-1 transition-colors sm:min-h-[88px] sm:p-2 ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        } ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}
                      >
                        <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm ${
                          isToday
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                            : isSelected
                              ? 'bg-blue-100 text-blue-700'
                              : isPast && cell.isCurrentMonth
                                ? 'text-gray-400'
                                : 'text-gray-700'
                        }`}>
                          {cell.day}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                            {dayEvents.slice(0, 3).map((event) => {
                              const color = EVENT_COLORS[event.color] ?? EVENT_COLORS.blue;
                              return <div key={event.id} className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />;
                            })}
                          </div>
                          <div className="hidden space-y-0.5 sm:block">
                            {dayEvents.slice(0, 3).map((event) => {
                              const color = EVENT_COLORS[event.color] ?? EVENT_COLORS.blue;
                              return (
                                <div key={event.id} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>
                                  {event.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && <div className="px-1.5 text-[10px] font-medium text-gray-400">+{dayEvents.length - 3} more</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex min-h-[300px] flex-col">
              <DayDetailPanel date={selectedDate} events={eventsForDate(selectedDate)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {(['all', 'session', 'task', 'exam', 'deadline'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All' : typeLabel(filter)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading events...</div>
              ) : upcomingEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No upcoming events</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {upcomingEvents.map((event) => {
                    const color = EVENT_COLORS[event.color] ?? EVENT_COLORS.blue;
                    const date = new Date(`${event.date}T12:00:00`);
                    const tomorrow = new Date(todayDate.getTime() + 86400000).toISOString().split('T')[0];
                    const dateLabel =
                      event.date === todayStr
                        ? 'Today'
                        : event.date === tomorrow
                          ? 'Tomorrow'
                          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                      <div key={event.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-shadow hover:shadow-sm">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
                          {typeIcon(event.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-gray-900">{event.title}</h4>
                          {event.subject && <p className="mt-0.5 text-xs text-gray-500">{event.subject}</p>}
                          <div className="mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <CalendarIcon className="h-3 w-3" />
                              {dateLabel}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {formatTime(event.time)}
                              {event.duration && <span>· {event.duration}</span>}
                            </span>
                          </div>
                        </div>
                        <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${color.bg} ${color.text} ${color.border}`}>
                          {typeLabel(event.type)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
