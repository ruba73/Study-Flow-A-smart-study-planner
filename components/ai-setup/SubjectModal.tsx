'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Subject } from '@/app/types/types';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subject: Omit<Subject, 'id'> | Subject) => void;
  subject: Subject | null;
}

export function SubjectModal({ isOpen, onClose, onSave, subject }: SubjectModalProps) {
  const [name, setName] = useState(subject?.name ?? '');
  const [description, setDescription] = useState(subject?.description ?? '');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>(subject?.priority ?? 'Medium');
  const [hoursNeeded, setHoursNeeded] = useState(subject ? subject.hoursNeeded.toString() : '');
  const [deadline, setDeadline] = useState(subject?.deadline ?? '');

  const handleSave = () => {
    if (!name.trim()) { alert('Please enter a subject name'); return; }
    if (!deadline) { alert('Please select a deadline'); return; }

    const hours = parseInt(hoursNeeded);
    if (isNaN(hours) || hours < 1) { alert('Please enter valid hours'); return; }

    const subjectData: Omit<Subject, 'id'> = {
      name: name.trim(),
      description: description.trim(),
      priority,
      hoursNeeded: hours,
      deadline,
    };

    if (subject) {
      onSave({ ...subjectData, id: subject.id });
    } else {
      onSave(subjectData);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={subject ? 'Edit Subject' : 'Add New Subject'}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subject Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Data Structures"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Chapters, topics, or materials to finish"
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hours Needed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={hoursNeeded}
              onChange={(e) => setHoursNeeded(e.target.value)}
              min="1"
              max="100"
              placeholder="10"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deadline <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
          <Button onClick={handleSave} variant="primary" className="flex-1">
            {subject ? 'Save Changes' : 'Add Subject'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
