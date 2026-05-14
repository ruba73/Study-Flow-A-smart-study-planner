'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Clock, Upload, FileText, ExternalLink, X, Send, Bot, UserRound, Settings, ChevronDown, MessageSquare } from 'lucide-react';

interface GoalItem {
  id: string;
  title: string;
  priority: string;
  progress: number;
  targetDate: string;
  estimatedTotalHours: number;
}

interface SessionItem {
  id: string;
  goalId: string;
  title: string;
  type: string;
  plannedStartTime: string;
  plannedDuration: number;
  status: string;
  task: {
    title: string;
    description: string | null;
    studyFocus: string[];
    materialReference: string;
    aiQuestion: string;
  } | null;
}

interface MaterialItem {
  id: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string;
  url: string | null;
  status: string;
  extractionStatus: string | null;
  extractionError: string | null;
  extractionTruncated: boolean;
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlanFixSuggestion {
  title: string;
  description: string;
  changes: {
    studyHoursPerDay: number;
    studyDaysPerWeek: number;
    startTime: string;
    endTime: string;
    breakDuration: number;
  };
}

interface PlanIssue {
  message: string;
  suggestions: PlanFixSuggestion[];
}

interface AiTaskNotice {
  title: string;
  message: string;
  tone: 'success' | 'warning' | 'error';
  suggestions?: string[];
}

function formatClockTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMinutesAsHours(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function formatExtractionStatus(status: string | null) {
  if (!status) return '';
  if (status === 'ready') return 'text ready';
  if (status === 'not-extracted') return 're-upload for AI access';
  if (status === 'failed') return 'text extraction failed';
  if (status === 'unsupported') return 'text unsupported';
  if (status === 'empty') return 'no readable text';
  return `text ${status}`;
}

function hasPlanFixChanges(suggestion: unknown): suggestion is PlanFixSuggestion {
  if (!suggestion || typeof suggestion !== 'object') return false;
  const changes = (suggestion as { changes?: unknown }).changes;
  if (!changes || typeof changes !== 'object') return false;
  const values = changes as Record<string, unknown>;

  return Boolean(
    typeof values.studyHoursPerDay === 'number' &&
      typeof values.studyDaysPerWeek === 'number' &&
      typeof values.startTime === 'string' &&
      typeof values.endTime === 'string' &&
      typeof values.breakDuration === 'number',
  );
}

export default function StudyPlanPage() {
  const [studyHoursPerDay, setStudyHoursPerDay] = useState('6');
  const [studyDaysPerWeek, setStudyDaysPerWeek] = useState('6');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('21:00');
  const [breakDuration, setBreakDuration] = useState('15');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedChatMaterialId, setSelectedChatMaterialId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [planIssue, setPlanIssue] = useState<PlanIssue | null>(null);
  const [aiTaskNotice, setAiTaskNotice] = useState<AiTaskNotice | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingAiQuestionRef = useRef<string | null>(null);
  const askMaterialsAiRef = useRef<((question: string) => Promise<void>) | null>(null);

  function addSelectedFiles(fileList: FileList | null) {
    const nextFiles = Array.from(fileList ?? []);
    if (nextFiles.length === 0) return;

    setSelectedFiles((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const uniqueNewFiles = nextFiles.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...uniqueNewFiles];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const loadMaterials = useCallback(async (goalId: string) => {
    if (!goalId) {
      setMaterials([]);
      return;
    }

    const response = await fetch(`/api/materials?goalId=${encodeURIComponent(goalId)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setMaterials(data.materials ?? []);
  }, []);

  const loadStudyPlan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/study-plan', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const profile = data.user?.profile ?? {};
      const preferences = data.user?.preferences ?? {};
      const breakRules = preferences.breakRules ?? {};

      setStudyHoursPerDay(String(preferences.maxStudyHoursPerDay ?? 6));
      setStudyDaysPerWeek(String(Math.min(7, Math.max(1, preferences.maxSessionsPerDay ? Math.ceil((preferences.maxSessionsPerDay * 7) / 2) : 6))));
      setStartTime(profile.availabilityStartTime ?? '09:00');
      setEndTime(profile.availabilityEndTime ?? '21:00');
      setBreakDuration(String(breakRules.breakDuration ?? 15));
      const loadedGoals = data.goals ?? [];
      setGoals(loadedGoals);
      if (!selectedGoalId && loadedGoals[0]) {
        setSelectedGoalId(loadedGoals[0].id);
      }
      setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedGoalId]);

  useEffect(() => {
    loadStudyPlan();
  }, [loadStudyPlan]);

  useEffect(() => {
    loadMaterials(selectedGoalId);
    setSelectedChatMaterialId('');
    setChatMessages([]);
    if (pendingAiQuestionRef.current) {
      const question = pendingAiQuestionRef.current;
      pendingAiQuestionRef.current = null;
      window.setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        askMaterialsAiRef.current?.(question);
      }, 0);
    } else {
      setChatQuestion('');
    }
  }, [loadMaterials, selectedGoalId]);

  const handleGeneratePlan = async (override?: PlanFixSuggestion['changes']) => {
    const nextStudyHoursPerDay = override?.studyHoursPerDay ?? parseInt(studyHoursPerDay);
    const nextStudyDaysPerWeek = override?.studyDaysPerWeek ?? parseInt(studyDaysPerWeek);
    const nextStartTime = override?.startTime ?? startTime;
    const nextEndTime = override?.endTime ?? endTime;
    const nextBreakDuration = override?.breakDuration ?? parseInt(breakDuration);

    setGenerating(true);
    setPlanIssue(null);
    try {
      const response = await fetch(selectedGoalId ? '/api/study-plan/ai-generate' : '/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: selectedGoalId || undefined,
          studyHoursPerDay: nextStudyHoursPerDay,
          studyDaysPerWeek: nextStudyDaysPerWeek,
          startTime: nextStartTime,
          endTime: nextEndTime,
          breakDuration: nextBreakDuration,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const suggestions = Array.isArray(data.suggestions)
          ? data.suggestions.filter(hasPlanFixChanges)
          : [];
        setSessions(data.sessions ?? []);
        setPlanIssue({
          message: data.message || 'Could not generate the full study plan with the current settings.',
          suggestions,
        });
        return;
      }
      setSessions(data.sessions ?? []);
      const examWarnings = [
        ...(Array.isArray(data.examWarnings) ? data.examWarnings : []),
        ...(typeof data.examWarning === 'string' && data.examWarning ? [data.examWarning] : []),
      ];
      if (data.tasksCreated) {
        setAiTaskNotice({
          title: 'AI-generated sessions created',
          message: `${data.tasksCreated} session${data.tasksCreated === 1 ? '' : 's'} created and the final AI exam was added as the last task.`,
          tone: 'success',
        });
      } else if (examWarnings.length) {
        setAiTaskNotice({
          title: 'Plan created',
          message: 'The final AI exam may still be preparing; check Tasks in a moment.',
          tone: 'success',
        });
      }
      setPlanIssue(null);
    } finally {
      setGenerating(false);
    }
  };

  const applyPlanSuggestion = (suggestion: PlanFixSuggestion) => {
    if (!hasPlanFixChanges(suggestion)) return;
    setStudyHoursPerDay(String(suggestion.changes.studyHoursPerDay));
    setStudyDaysPerWeek(String(suggestion.changes.studyDaysPerWeek));
    setStartTime(suggestion.changes.startTime);
    setEndTime(suggestion.changes.endTime);
    setBreakDuration(String(suggestion.changes.breakDuration));
    handleGeneratePlan(suggestion.changes);
  };

  const handleAskSessionAi = (session: SessionItem) => {
    const question = session.task?.aiQuestion || `Explain ${session.title} using my uploaded materials.`;
    setSelectedChatMaterialId('');

    if (session.goalId !== selectedGoalId) {
      pendingAiQuestionRef.current = question;
      setSelectedGoalId(session.goalId);
      return;
    }

    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    handleAskMaterialsAi(question);
  };

  const handleUploadMaterial = async () => {
    if (!selectedGoalId) {
      alert('Select a subject first.');
      return;
    }

    if (selectedFiles.length === 0) {
      alert('Choose at least one material file first.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('goalId', selectedGoalId);
      selectedFiles.forEach((file) => formData.append('files', file));

      const response = await fetch('/api/materials', {
        method: 'POST',
        body: formData,
      });

      let data: { message?: string; failedFiles?: unknown[] } | null = null;

      const contentType = response.headers.get('content-type') ?? '';
      try {
        if (contentType.includes('application/json')) {
          data = await response.json();
        }
      } catch {
        data = null;
      }

      if (!response.ok) {
        alert(data?.message || `Could not upload material (HTTP ${response.status}).`);
        return;
      }



      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadMaterials(selectedGoalId);
      if (data?.failedFiles?.length) {
        alert('Some files were saved locally. AI Generate can still create tasks from their names.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleAskMaterialsAi = async (questionOverride?: string) => {
    const question = (questionOverride ?? chatQuestion).trim();
    if (!selectedGoalId || !question || chatLoading) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: question }];
    setChatMessages(nextMessages);
    setChatQuestion('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/materials/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: selectedGoalId,
          materialId: selectedChatMaterialId || undefined,
          messages: nextMessages,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setChatMessages([...nextMessages, { role: 'assistant', content: data.message || 'AI chat is unavailable right now.' }]);
        return;
      }

      setChatMessages([...nextMessages, { role: 'assistant', content: data.answer ?? 'I could not generate an answer.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  askMaterialsAiRef.current = handleAskMaterialsAi;

  const groupedSessions = sessions.reduce<Record<string, SessionItem[]>>((acc, session) => {
    const day = new Date(session.plannedStartTime).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    acc[day] = acc[day] ?? [];
    acc[day].push(session);
    return acc;
  }, {});

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-4 sm:p-4 lg:p-4">
        <div className="mb-4 flex justify-end">
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Generation Settings
          </Link>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Materials and AI Task Planning</h3>
              <p className="mt-1 text-sm text-gray-600">Upload PDFs, text files, or Word docs, then generate detailed tasks for a subject.</p>
            </div>
            <select
              value={selectedGoalId}
              onChange={(event) => setSelectedGoalId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-72"
            >
              {goals.length === 0 ? (
                <option value="">No subjects yet</option>
              ) : (
                goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pdf,.txt,.md,.doc,.docx,.pptx"
                  multiple
                  onChange={(event) => addSelectedFiles(event.target.files)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700"
                />
                <button
                  onClick={handleUploadMaterial}
                  disabled={uploading || !selectedGoalId || selectedFiles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Materials` : 'Upload Material'}
                </button>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Selected Files ({selectedFiles.length})
                  </div>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {materials.length === 0 ? (
                  <p className="text-sm text-gray-500">No materials added for this subject yet.</p>
                ) : (
                  materials.map((material) => (
                    <div key={material.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                          <p className="truncate text-sm font-semibold text-gray-900">{material.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {material.source === 'upload' ? material.fileName : 'Suggested resource'} - {material.status}
                          {material.extractionStatus ? ` - ${formatExtractionStatus(material.extractionStatus)}` : ''}
                          {material.extractionTruncated ? ' - excerpt saved' : ''}
                          {material.extractionError ? ` - ${material.extractionError}` : ''}
                        </p>
                      </div>
                      {material.url && (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div ref={chatSectionRef} className="mt-5 rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Ask AI about these materials</h4>
                    <p className="mt-1 text-xs text-gray-500">Get help with chapters, concepts, practice questions, or what to study next.</p>
                  </div>
                  <select
                    value={selectedChatMaterialId}
                    onChange={(event) => {
                      setSelectedChatMaterialId(event.target.value);
                      setChatMessages([]);
                    }}
                    disabled={materials.length === 0}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 md:w-64"
                  >
                    <option value="">All materials</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex h-72 flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {chatMessages.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                        Ask about a chapter, a difficult question, or request a short quiz from the selected material.
                      </div>
                    ) : (
                      chatMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                              <Bot className="h-4 w-4" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                              message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {message.content}
                          </div>
                          {message.role === 'user' && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                              <UserRound className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Bot className="h-4 w-4 text-blue-600" />
                        Thinking...
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 p-3">
                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleAskMaterialsAi();
                      }}
                    >
                      <input
                        value={chatQuestion}
                        onChange={(event) => setChatQuestion(event.target.value)}
                        disabled={!selectedGoalId || chatLoading}
                        placeholder="Ask for help with a chapter or question..."
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      />
                      <button
                        type="submit"
                        disabled={!selectedGoalId || !chatQuestion.trim() || chatLoading}
                        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Send question"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {aiTaskNotice && (
          <div
            className={`mb-8 rounded-xl border p-5 ${
              aiTaskNotice.tone === 'success'
                ? 'border-green-200 bg-green-50'
                : aiTaskNotice.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3
                  className={`text-base font-semibold ${
                    aiTaskNotice.tone === 'success'
                      ? 'text-green-950'
                      : aiTaskNotice.tone === 'warning'
                        ? 'text-amber-950'
                        : 'text-red-950'
                  }`}
                >
                  {aiTaskNotice.title}
                </h3>
                <p
                  className={`mt-1 text-sm leading-6 ${
                    aiTaskNotice.tone === 'success'
                      ? 'text-green-800'
                      : aiTaskNotice.tone === 'warning'
                        ? 'text-amber-800'
                        : 'text-red-800'
                  }`}
                >
                  {aiTaskNotice.message}
                </p>
                {aiTaskNotice.tone !== 'success' && (
                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-3">
                    {(aiTaskNotice.suggestions?.length
                      ? aiTaskNotice.suggestions
                      : [
                          'Ask the materials chat to explain chapters or turn weak areas into tasks.',
                          'Check that uploaded files show text ready before relying on chapter content.',
                          'Try Generate Plan if you need a schedule from deadlines and availability.',
                        ]
                    ).map((suggestion, index) => (
                      <div key={`${suggestion}-${index}`} className="rounded-lg bg-white/70 p-3">
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAiTaskNotice(null)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-white/70"
                aria-label="Dismiss AI task notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {planIssue && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-amber-950">Plan needs adjustment</h3>
                <p className="mt-1 text-sm leading-6 text-amber-800">{planIssue.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanIssue(null)}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100"
                aria-label="Dismiss plan suggestions"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {planIssue.suggestions.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {planIssue.suggestions.map((suggestion, index) => (
                  <div key={`${suggestion.title}-${index}`} className="rounded-lg border border-amber-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-gray-900">{suggestion.title}</h4>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-gray-600">{suggestion.description}</p>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      <div>{suggestion.changes.studyHoursPerDay}h/day · {suggestion.changes.studyDaysPerWeek} days/week</div>
                      <div>{suggestion.changes.startTime}-{suggestion.changes.endTime} · {suggestion.changes.breakDuration} min breaks</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyPlanSuggestion(suggestion)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      Apply Fix
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">Loading study plan...</div>
        ) : sessions.length === 0 ? null : (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Active Goals</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-1 font-semibold text-gray-900">{goal.title}</div>
                    <div className="text-sm text-gray-500">Due {new Date(goal.targetDate).toLocaleDateString('en-US')}</div>
                    <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${goal.progress}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{goal.progress}% complete · {Math.round(goal.estimatedTotalHours)}h planned</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Upcoming Sessions</h3>
              <div className="space-y-5">
                {Object.entries(groupedSessions).map(([day, daySessions]) => (
                  <div key={day}>
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{day}</h4>
                    <div className="space-y-3">
                      {daySessions.map((session) => {
                        const isExpanded = expandedSessionId === session.id;
                        const focusItems = session.task?.studyFocus ?? [];

                        return (
                        <div key={session.id} className="rounded-lg border border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-gray-100"
                          >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">{session.title}</div>
                            {session.task?.description && (
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{session.task.description}</p>
                            )}
                            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              {formatClockTime(session.plannedStartTime)}
                              <span>· {formatMinutesAsHours(session.plannedDuration)}</span>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-3">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              {session.status}
                            </span>
                            <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-gray-200 bg-white p-4">
                              {session.task?.description && (
                                <p className="text-sm leading-6 text-gray-700">{session.task.description}</p>
                              )}
                              {session.task?.materialReference && (
                                <p className="mt-3 text-xs font-medium text-gray-500">Material: {session.task.materialReference}</p>
                              )}
                              {focusItems.length > 0 && (
                                <div className="mt-4">
                                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Study Focus</h5>
                                  <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-700">
                                    {focusItems.map((item, index) => (
                                      <li key={`${session.id}-focus-${index}`} className="rounded-md bg-gray-50 px-3 py-2">
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="mt-4 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleAskSessionAi(session)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Ask AI about this session
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => handleGeneratePlan()}
            disabled={generating || goals.length === 0}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" />
            {generating ? 'Generating Plan...' : 'Generate Plan'}
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
