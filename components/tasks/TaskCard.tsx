import { Calendar, Clock, Edit, Trash2, Check, ClipboardList } from 'lucide-react';
import { Task } from '@/app/(dashboard)/tasks/page';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  pending?: boolean;
}

export function TaskCard({ task, onToggle, onEdit, onDelete, pending = false }: TaskCardProps) {
  const isOpenTest = Boolean(task.completionTest && !task.completed);
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
    const date = new Date(`${dateString}T00:00:00`);
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
  <div
    onClick={() => {
      if (!pending) onToggle();
    }}
    className={`bg-white rounded-xl p-4 sm:p-5 border transition-all duration-300 ease-out ${
      task.completed ? 'border-green-200 bg-green-50/30 shadow-sm' : 'border-gray-200 hover:shadow-md'
    } ${pending ? 'cursor-wait opacity-80' : task.completed ? 'cursor-default' : 'cursor-pointer'} ${
      pending ? 'scale-[0.995]' : 'scale-100'
    }`}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (!pending && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onToggle();
      }
    }}
  >
    <div className="flex flex-col sm:flex-row gap-4">

      {/* Top Section */}
      <div className="flex gap-4 flex-1">
        {/* Checkbox */}
        <button
          onClick={(event) => {
            event.stopPropagation();
            if (!pending) onToggle();
          }}
          disabled={pending}
          className={`mt-1 flex items-center justify-center transition-all duration-300 ease-out ${
            isOpenTest
              ? 'h-9 w-9 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100'
              : `h-7 w-7 rounded border-2 shadow-sm ${
                  task.completed
                    ? 'scale-105 bg-green-500 border-green-500'
                    : pending
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50'
                }`
          } ${pending ? 'animate-pulse' : ''}`}
          aria-label={isOpenTest ? 'Start completion test' : task.completed ? 'Mark task incomplete' : 'Mark task complete'}
        >
          {isOpenTest ? (
            <ClipboardList className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <Check
              className={`w-3.5 h-3.5 text-white transition-all duration-200 ease-out ${
                task.completed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold mb-1 transition-all duration-300 ${
            task.completed ? 'text-gray-500 line-through decoration-green-600 decoration-2' : 'text-gray-900'
          }`}>
            {task.title}
          </h3>
          <p className={`text-sm mb-3 transition-colors duration-300 ${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>{task.description}</p>

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
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
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
