'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  BookOpen,
  SquareCheckBig,
  Brain,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type EventType = 'session' | 'task' | 'exam' | 'deadline';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration?: string; // e.g. '2h'
  type: EventType;
  subject?: string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA  (same subjects/tasks as the rest of the project)
// ─────────────────────────────────────────────────────────────────────────────

function buildEvents(): CalendarEvent[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');

  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + offset);
    return dt.toISOString().split('T')[0];
  };

  return [
    // This month fixed sessions
    { id: 'e1',  title: 'Data Structures – Binary Trees',  date: d(0),  time: '14:00', duration: '2h',   type: 'session',  subject: 'Data Structures', color: 'blue'   },
    { id: 'e2',  title: 'Calculus II – Integration',       date: d(0),  time: '17:00', duration: '1.5h', type: 'session',  subject: 'Calculus II',      color: 'purple' },
    { id: 'e3',  title: 'Web Dev – React Hooks Review',    date: d(1),  time: '10:00', duration: '1h',   type: 'session',  subject: 'Web Development',  color: 'green'  },
    { id: 'e4',  title: 'Database Systems – SQL Joins',    date: d(1),  time: '15:00', duration: '2h',   type: 'session',  subject: 'Database Systems', color: 'orange' },
    { id: 'e5',  title: 'Linear Algebra – Eigenvalues',    date: d(3),  time: '09:00', duration: '1.5h', type: 'session',  subject: 'Linear Algebra',   color: 'blue'   },
    { id: 'e6',  title: 'Operating Systems – Threads',     date: d(3),  time: '13:00', duration: '2h',   type: 'session',  subject: 'Operating Systems',color: 'red'    },
    { id: 'e7',  title: 'Data Structures – AVL Trees',     date: d(5),  time: '14:00', duration: '2h',   type: 'session',  subject: 'Data Structures',  color: 'blue'   },
    { id: 'e8',  title: 'Calculus – Problem Solving',      date: d(5),  time: '18:00', duration: '1h',   type: 'session',  subject: 'Calculus II',      color: 'purple' },
    // Tasks / Deadlines
    { id: 't1',  title: 'Data Structures Assignment',      date: d(2),  time: '23:59', type: 'task',     subject: 'Data Structures',  color: 'red'    },
    { id: 't2',  title: 'Linear Algebra Problem Set',      date: d(5),  time: '23:59', type: 'deadline', subject: 'Linear Algebra',   color: 'orange' },
    { id: 't3',  title: 'Prepare Presentation Slides',     date: d(6),  time: '16:00', type: 'task',     subject: 'Operating Systems',color: 'pink'   },
    // Exam
    { id: 'x1',  title: 'Database Systems Quiz',           date: d(4),  time: '14:00', type: 'exam',     subject: 'Database Systems', color: 'purple' },
    // Past / earlier in month events
    { id: 'p1',  title: 'Web Dev – CSS Layouts',           date: `${y}-${m}-03`, time: '10:00', duration: '1h',   type: 'session', subject: 'Web Development',  color: 'green'  },
    { id: 'p2',  title: 'Calculus – Integration Intro',    date: `${y}-${m}-05`, time: '15:00', duration: '1.5h', type: 'session', subject: 'Calculus II',      color: 'purple' },
    { id: 'p3',  title: 'OS – Memory Management',          date: `${y}-${m}-07`, time: '13:00', duration: '2h',   type: 'session', subject: 'Operating Systems',color: 'red'    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  blue:   { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  purple: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  green:  { dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  orange: { dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  red:    { dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
  pink:   { dot: 'bg-pink-500',   bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'   },
};

function typeIcon(type: EventType) {
  switch (type) {
    case 'session':  return <Brain className="w-3.5 h-3.5" />;
    case 'task':     return <SquareCheckBig className="w-3.5 h-3.5" />;
    case 'exam':     return <BookOpen className="w-3.5 h-3.5" />;
    case 'deadline': return <Clock className="w-3.5 h-3.5" />;
  }
}

function typeLabel(type: EventType) {
  switch (type) {
    case 'session':  return 'Study Session';
    case 'task':     return 'Task';
    case 'exam':     return 'Exam / Quiz';
    case 'deadline': return 'Deadline';
  }
}

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─────────────────────────────────────────────────────────────────────────────
// ADD EVENT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function AddEventModal({
  isOpen,
  onClose,
  onSave,
  defaultDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ev: Omit<CalendarEvent, 'id'>) => void;
  defaultDate: string;
}) {
  const [title, setTitle]    = useState('');
  const [date, setDate]      = useState(defaultDate);
  const [time, setTime]      = useState('09:00');
  const [duration, setDur]   = useState('1h');
  const [type, setType]      = useState<EventType>('session');
  const [subject, setSubj]   = useState('');

  const typeColorMap: Record<EventType, string> = {
    session: 'blue', task: 'red', exam: 'purple', deadline: 'orange',
  };

  function handleSubmit() {
    if (!title.trim()) return;
    onSave({ title, date, time, duration: type === 'session' ? duration : undefined, type, subject: subject || undefined, color: typeColorMap[type] });
    setTitle(''); setDate(defaultDate); setTime('09:00'); setDur('1h'); setType('session'); setSubj('');
    onClose();
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-xl font-bold text-gray-900">Add Event</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['session','task','exam','deadline'] as EventType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      type === t
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {typeIcon(t)}
                    {typeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Data Structures – Binary Trees"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject (optional)</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubj(e.target.value)}
                placeholder="e.g. Data Structures"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Duration (sessions only) */}
            {type === 'session' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <select
                  value={duration}
                  onChange={e => setDur(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {['0.5h','1h','1.5h','2h','2.5h','3h','4h'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────

function DayDetailPanel({
  date,
  events,
  onClose,
  onAdd,
}: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
  onAdd: () => void;
}) {
  const dt = new Date(date + 'T12:00:00');
  const label = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{sorted.length} event{sorted.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CalendarIcon className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No events scheduled</p>
            <button
              onClick={onAdd}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add an event
            </button>
          </div>
        ) : (
          sorted.map(ev => {
            const c = EVENT_COLORS[ev.color] ?? EVENT_COLORS.blue;
            return (
              <div key={ev.id} className={`p-3 rounded-lg border ${c.bg} ${c.border}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 ${c.text}`}>{typeIcon(ev.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${c.text} truncate`}>{ev.title}</p>
                    {ev.subject && (
                      <p className="text-xs text-gray-500 mt-0.5">{ev.subject}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(ev.time)}
                        {ev.duration && <span>· {ev.duration}</span>}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
                        {typeLabel(ev.type)}
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(buildEvents);
  const todayDate = new Date();
  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate.toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState(todayDate.toISOString().split('T')[0]);
  const [activeFilter, setActiveFilter] = useState<'all' | EventType>('all');

  const todayStr = todayDate.toISOString().split('T')[0];

  // Navigation
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: string; day: number; isCurrentMonth: boolean }[] = [];

  // Prev month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
      day: d,
      isCurrentMonth: true,
    });
  }
  // Next month fill
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrentMonth: false });
  }

  // Events per day
  const eventsForDate = (date: string) => events.filter(e => e.date === date);

  // Filtered upcoming list
  const upcomingEvents = events
    .filter(e => {
      if (activeFilter !== 'all' && e.type !== activeFilter) return false;
      return e.date >= todayStr;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 12);

  function handleAddEvent(ev: Omit<CalendarEvent, 'id'>) {
    setEvents(prev => [...prev, { ...ev, id: Date.now().toString() }]);
  }

  function openAddModal(date: string) {
    setModalDefaultDate(date);
    setIsModalOpen(true);
  }

  // Stats
  const monthEvents = events.filter(e => {
    const [ey, em] = e.date.split('-').map(Number);
    return ey === viewYear && em - 1 === viewMonth;
  });

  const stats = [
    { label: 'Study Sessions', value: monthEvents.filter(e => e.type === 'session').length,  color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <Brain className="w-4 h-4" /> },
    { label: 'Tasks',          value: monthEvents.filter(e => e.type === 'task').length,      color: 'text-purple-600', bg: 'bg-purple-50', icon: <SquareCheckBig className="w-4 h-4" /> },
    { label: 'Exams / Quizzes',value: monthEvents.filter(e => e.type === 'exam').length,      color: 'text-red-600',    bg: 'bg-red-50',    icon: <BookOpen className="w-4 h-4" /> },
    { label: 'Deadlines',      value: monthEvents.filter(e => e.type === 'deadline').length,  color: 'text-orange-600', bg: 'bg-orange-50', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="space-y-6">

          {/* ── Top: Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main: Calendar + Side Panel ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Calendar */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    {MONTHS[viewMonth]} {viewYear}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setViewYear(todayDate.getFullYear()); setViewMonth(todayDate.getMonth()); setSelectedDate(todayStr); }}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => openAddModal(selectedDate)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Event</span>
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAYS_OF_WEEK.map(d => (
                  <div key={d} className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7">
                {cells.map((cell, i) => {
                  const dayEvents = eventsForDate(cell.date);
                  const isToday    = cell.date === todayStr;
                  const isSelected = cell.date === selectedDate;
                  const isPast     = cell.date < todayStr;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`min-h-[56px] sm:min-h-[88px] p-1 sm:p-2 border-b border-r border-gray-100 cursor-pointer transition-colors
                        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${!cell.isCurrentMonth ? 'opacity-40' : ''}
                      `}
                    >
                      {/* Day number */}
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1 text-xs sm:text-sm font-medium mx-auto
                        ${isToday    ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' :
                          isSelected ? 'bg-blue-100 text-blue-700' :
                          isPast && cell.isCurrentMonth ? 'text-gray-400' :
                          'text-gray-700'}
                      `}>
                        {cell.day}
                      </div>

                      {/* Event dots on mobile / pills on desktop */}
                      <div className="space-y-0.5">
                        {/* Mobile: dots only */}
                        <div className="flex flex-wrap gap-0.5 justify-center sm:hidden">
                          {dayEvents.slice(0, 3).map(ev => {
                            const c = EVENT_COLORS[ev.color] ?? EVENT_COLORS.blue;
                            return <div key={ev.id} className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />;
                          })}
                          {dayEvents.length > 3 && <div className={`w-1.5 h-1.5 rounded-full bg-gray-400`} />}
                        </div>
                        {/* Desktop: pills with title */}
                        <div className="hidden sm:block space-y-0.5">
                          {dayEvents.slice(0, 3).map(ev => {
                            const c = EVENT_COLORS[ev.color] ?? EVENT_COLORS.blue;
                            return (
                              <div key={ev.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${c.bg} ${c.text}`}>
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                                <span className="truncate">{ev.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 font-medium px-1.5">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4 flex flex-col">
              {/* Selected day detail */}
              <div className="flex-1 min-h-[300px]">
                <DayDetailPanel
                  date={selectedDate}
                  events={eventsForDate(selectedDate)}
                  onClose={() => setSelectedDate(todayStr)}
                  onAdd={() => openAddModal(selectedDate)}
                />
              </div>

              {/* Legend */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'session' as EventType,  color: 'blue'   },
                    { type: 'task'    as EventType,  color: 'red'    },
                    { type: 'exam'    as EventType,  color: 'purple' },
                    { type: 'deadline' as EventType, color: 'orange' },
                  ].map(({ type, color }) => {
                    const c = EVENT_COLORS[color];
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                        <span className="text-xs text-gray-600">{typeLabel(type)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Upcoming Events List ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
              {/* Filter tabs */}
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {(['all','session','task','exam','deadline'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap transition-colors
                      ${activeFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                      }`}
                  >
                    {f === 'all' ? 'All' : typeLabel(f)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No upcoming events</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {upcomingEvents.map(ev => {
                    const c = EVENT_COLORS[ev.color] ?? EVENT_COLORS.blue;
                    const dt = new Date(ev.date + 'T12:00:00');
                    const dateLabel = ev.date === todayStr
                      ? 'Today'
                      : ev.date === new Date(todayDate.getTime() + 86400000).toISOString().split('T')[0]
                        ? 'Tomorrow'
                        : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                      <div key={ev.id} className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                        <div className={`w-10 h-10 ${c.bg} ${c.text} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          {typeIcon(ev.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{ev.title}</h4>
                          {ev.subject && <p className="text-xs text-gray-500 mt-0.5">{ev.subject}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <CalendarIcon className="w-3 h-3" />
                              {dateLabel}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {formatTime(ev.time)}
                              {ev.duration && <span>· {ev.duration}</span>}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${c.bg} ${c.text} border ${c.border} whitespace-nowrap`}>
                          {typeLabel(ev.type)}
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

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddEvent}
        defaultDate={modalDefaultDate}
      />
    </div>
  );
}