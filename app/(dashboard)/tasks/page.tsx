'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { TaskCard } from '@/components/tasks/TaskCard';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Assignment' | 'Study' | 'Review' | 'Exam' | 'Project';
  date: string;
  time: string;
  completed: boolean;
}

interface TaskApiItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: number;
  type: string;
  dueDate: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  completed: boolean;
}

function toPriority(difficulty: number): Task['priority'] {
  if (difficulty >= 4) return 'High';
  if (difficulty <= 2) return 'Low';
  return 'Medium';
}

function toTaskType(type: string): Task['type'] {
  switch (type) {
    case 'assignment':
      return 'Assignment';
    case 'review':
      return 'Review';
    case 'quiz':
      return 'Exam';
    case 'project':
      return 'Project';
    default:
      return 'Study';
  }
}

function toTask(item: TaskApiItem): Task {
  const dateSource = item.scheduledDate ?? item.dueDate ?? new Date().toISOString();
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? 'No description provided.',
    priority: toPriority(item.difficulty),
    type: toTaskType(item.type),
    date: dateSource.split('T')[0],
    time: item.scheduledTime ?? (item.dueDate ? item.dueDate.slice(11, 16) : '09:00'),
    completed: item.completed,
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  async function loadTasks() {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: TaskApiItem[] };
      setTasks(data.tasks.map(toTask));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function toggleTask(task: Task) {
    const nextCompleted = !task.completed;
    const previous = tasks;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completed: nextCompleted } : item)),
    );

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completed: nextCompleted }),
    });

    if (!response.ok) {
      setTasks(previous);
      return;
    }

    const data = (await response.json()) as { completedGoal?: boolean };
    if (data.completedGoal) {
      await loadTasks();
    }
  }

  const filteredTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const query = searchQuery.toLowerCase().trim();

    return tasks.filter((task) => {
      if (activeFilter === 'all' && task.completed) return false;
      if (activeFilter === 'today' && (task.date !== today || task.completed)) return false;
      if (activeFilter === 'upcoming' && (task.date <= today || task.completed)) return false;
      if (activeFilter === 'completed' && !task.completed) return false;
      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.type.toLowerCase().includes(query) ||
        task.priority.toLowerCase().includes(query)
      );
    });
  }, [tasks, searchQuery, activeFilter]);

  const today = new Date().toISOString().split('T')[0];
  const counts = {
    all: tasks.filter((task) => !task.completed).length,
    today: tasks.filter((task) => task.date === today && !task.completed).length,
    upcoming: tasks.filter((task) => task.date > today && !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="space-y-6 sm:space-y-6">
          <div>
            <div className="flex flex-row gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'today', 'upcoming', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {filter === 'all' && `All Tasks (${counts.all})`}
                {filter === 'today' && `Today (${counts.today})`}
                {filter === 'upcoming' && `Upcoming (${counts.upcoming})`}
                {filter === 'completed' && `Completed (${counts.completed})`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {loading ? (
              <div className="col-span-full rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="col-span-full rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
                {searchQuery ? `No tasks found matching "${searchQuery}"` : 'No tasks found'}
              </div>
            ) : (
              filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
              />
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
