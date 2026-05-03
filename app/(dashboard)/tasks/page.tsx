'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { TaskCard } from '@/components/tasks/TaskCard';

interface CompletionTestQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Assignment' | 'Study' | 'Review' | 'Exam' | 'Project';
  date: string;
  time: string;
  completed: boolean;
  completionTest?: {
    generatedBy?: string;
    generatedAt?: string | null;
    aiModel?: string | null;
    questions: CompletionTestQuestion[];
  } | null;
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
  completionTest: {
    generatedBy?: string;
    generatedAt?: string | null;
    aiModel?: string | null;
    questions: CompletionTestQuestion[];
  } | null;
}

interface TestResult {
  score: number;
  passed: boolean;
  feedback: string;
  strengths: string[];
  weakPoints: string[];
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    score: number;
    feedback: string;
    topic: string;
  }>;
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

function toLocalDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split('T')[0];
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toTask(item: TaskApiItem): Task {
  const dateSource = item.scheduledDate ?? item.dueDate ?? new Date().toISOString();
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? 'No description provided.',
    priority: toPriority(item.difficulty),
    type: toTaskType(item.type),
    date: toLocalDateKey(dateSource),
    time: item.scheduledTime ?? (item.dueDate ? item.dueDate.slice(11, 16) : '09:00'),
    completed: item.completed,
    completionTest: item.completionTest,
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [activeTestTask, setActiveTestTask] = useState<Task | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [submittingTest, setSubmittingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());

  async function loadTasks() {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: TaskApiItem[]; examWarnings?: string[] };
      setTasks(data.tasks.map(toTask));
      if (data.examWarnings?.length) {
        alert(`Some AI exams could not be created:\n${data.examWarnings.join('\n')}`);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function toggleTask(task: Task) {
    if (pendingTaskIds.has(task.id)) return;

    if (task.completionTest && !task.completed) {
      setActiveTestTask(task);
      setTestAnswers({});
      setTestResult(null);
      return;
    }

    const nextCompleted = !task.completed;
    const previous = tasks;
    setPendingTaskIds((current) => new Set(current).add(task.id));
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completed: nextCompleted } : item)),
    );

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: nextCompleted }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setTasks(previous);
        alert(data?.message || 'Could not update this task.');
        return;
      }

      const data = (await response.json().catch(() => null)) as {
        examWarning?: string | null;
        syncWarning?: string | null;
        remainingLearningTasks?: number | null;
        generatedTestTaskId?: string | null;
        subjectDeleted?: boolean;
      } | null;
      if (data?.subjectDeleted) {
        alert('Review completed. The subject was archived to analytics and removed.');
      } else if (data?.examWarning) {
        alert(`Task saved, but the AI exam was not created: ${data.examWarning}`);
      } else if (nextCompleted && typeof data?.remainingLearningTasks === 'number' && data.remainingLearningTasks > 0) {
        console.info(`${data.remainingLearningTasks} learning task(s) still need to be completed before the exam is generated.`);
      }

      await loadTasks();
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function submitTest() {
    if (!activeTestTask?.completionTest) return;
    const unanswered = activeTestTask.completionTest.questions.some((question) => !testAnswers[question.id]?.trim());
    if (unanswered) {
      alert('Answer every question before submitting.');
      return;
    }

    setSubmittingTest(true);
    try {
      const response = await fetch('/api/tasks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: activeTestTask.id, answers: testAnswers }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Could not grade the test.');
        return;
      }
      setTestResult(data.result);
      await loadTasks();
    } finally {
      setSubmittingTest(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const today = toLocalDateKey(new Date().toISOString());
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

  const today = toLocalDateKey(new Date().toISOString());
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
                pending={pendingTaskIds.has(task.id)}
              />
            ))
          )}
          </div>
        </div>
      </div>

      {activeTestTask?.completionTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{activeTestTask.title}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Pass mark: 60%
                  {activeTestTask.completionTest.generatedBy === 'ai' && activeTestTask.completionTest.aiModel
                    ? ` - AI generated by ${activeTestTask.completionTest.aiModel}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTestTask(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close test"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {testResult ? (
                <div className={`rounded-lg border p-4 ${testResult.passed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className={`text-lg font-semibold ${testResult.passed ? 'text-green-900' : 'text-amber-900'}`}>
                    Grade: {testResult.score}% - {testResult.passed ? 'Passed' : 'Review needed'}
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${testResult.passed ? 'text-green-800' : 'text-amber-800'}`}>{testResult.feedback}</p>
                  {testResult.strengths.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-900">What went well</h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {testResult.strengths.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  )}
                  {testResult.weakPoints.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-900">Focus next</h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {testResult.weakPoints.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  )}
                  {!testResult.passed && (
                    <p className="mt-4 text-sm text-amber-800">New review tasks were opened for these weak points.</p>
                  )}
                </div>
              ) : (
                activeTestTask.completionTest.questions.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Question {index + 1}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-700">{question.question}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{question.topic}</span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">{question.difficulty}</span>
                      </div>
                    </div>
                    {(question.type === 'mcq' || question.type === 'true_false') && question.options?.length ? (
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name={question.id}
                              value={option}
                              checked={testAnswers[question.id] === option}
                              onChange={() => setTestAnswers((current) => ({ ...current, [question.id]: option }))}
                              className="h-4 w-4"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={testAnswers[question.id] ?? ''}
                        onChange={(event) => setTestAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                        rows={4}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Write your answer..."
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white p-5">
              <button
                type="button"
                onClick={() => setActiveTestTask(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {!testResult && (
                <button
                  type="button"
                  onClick={submitTest}
                  disabled={submittingTest}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingTest ? 'Grading...' : 'Submit Test'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
