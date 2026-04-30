'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Subject } from '@/app/types/types';
import { SubjectCard } from '@/components/ai-setup/SubjectCard';
import { AddSubjectCard } from '@/components/ai-setup/AddSubjectCard';
import { SubjectModal } from '@/components/ai-setup/SubjectModal';

interface GoalApiItem {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  estimatedTotalHours: number;
  targetDate: string;
}

function toSubject(goal: GoalApiItem): Subject {
  return {
    id: goal.id,
    name: goal.title,
    description: goal.description ?? '',
    priority: goal.priority === 'high' ? 'High' : goal.priority === 'low' ? 'Low' : 'Medium',
    hoursNeeded: Math.round(goal.estimatedTotalHours) || 10,
    deadline: goal.targetDate.split('T')[0],
  };
}

function toGoalPayload(subject: Omit<Subject, 'id'> | Subject) {
  return {
    id: 'id' in subject ? subject.id : undefined,
    title: subject.name,
    description: subject.description,
    priority: subject.priority.toLowerCase(),
    estimatedTotalHours: subject.hoursNeeded,
    targetDate: subject.deadline,
  };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [generating, setGenerating] = useState(false);

  async function loadSubjects() {
    setLoading(true);
    try {
      const response = await fetch('/api/goals', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { goals: GoalApiItem[] };
      setSubjects(data.goals.map(toSubject));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleSave = async (subjectData: Omit<Subject, 'id'> | Subject) => {
    const method = 'id' in subjectData ? 'PATCH' : 'POST';
    const response = await fetch('/api/goals', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toGoalPayload(subjectData)),
    });

    if (!response.ok) {
      alert('Could not save subject.');
      return;
    }

    await loadSubjects();
    setIsModalOpen(false);
    setEditingSubject(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this subject?')) return;
    const response = await fetch(`/api/goals?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      alert('Could not delete subject.');
      return;
    }
    await loadSubjects();
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/study-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Could not generate study plan.');
        return;
      }
      alert('Study plan generated successfully.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="space-y-6 p-4 sm:p-4 lg:p-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Your Subjects</h3>
            <span className="text-sm text-gray-500">{subjects.length} subjects added</span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading subjects...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  onEdit={() => openEditModal(subject)}
                  onDelete={() => handleDelete(subject.id)}
                />
              ))}
              <AddSubjectCard onClick={openAddModal} />
            </div>
          )}
        </div>

        <button
          onClick={generatePlan}
          disabled={subjects.length === 0 || generating}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5" />
          {generating ? 'Generating...' : 'Generate My Study Plan'}
          <span>→</span>
        </button>
      </div>

      {isModalOpen && (
        <SubjectModal
          key={editingSubject?.id ?? 'new-subject'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSubject(null);
          }}
          onSave={handleSave}
          subject={editingSubject}
        />
      )}
    </div>
  );
}
