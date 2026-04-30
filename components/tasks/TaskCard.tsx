import { Calendar, Clock, Edit, Trash2, Check } from 'lucide-react';
import { Task } from '@/app/(dashboard)/tasks/page';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskCard({ task, onToggle, onEdit, onDelete }: TaskCardProps) {
  const priorityColors = {
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-green-100 text-green-700',
  };

  const typeColors = {
    Assignment: 'bg-blue-100 text-blue-700',
    Study: 'bg-green-100 text-green-700',
    Review: 'bg-orange-100 text-orange-700',
    Exam: 'bg-purple-100 text-purple-700',
    Project: 'bg-pink-100 text-pink-700',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (

  <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 hover:shadow-md transition-shadow">
    <div className="flex flex-col sm:flex-row gap-4">

      {/* Top Section */}
      <div className="flex gap-4 flex-1">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            task.completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-blue-500'
          }`}
        >
          {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-gray-900 mb-1 ${task.completed ? 'line-through text-gray-500' : ''}`}>
            {task.title}
          </h3>
          <p className="text-sm text-gray-600 mb-3">{task.description}</p>

          {/* Badges and Info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeColors[task.type]}`}>
              {task.type}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(task.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{formatTime(task.time)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {(onEdit || onDelete) && (
          <div className="flex gap-2 sm:flex-col sm:items-end">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
