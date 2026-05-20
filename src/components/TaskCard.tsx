import { Calendar, Flag, CheckCircle2, Circle, Clock, Trash2, Pencil } from 'lucide-react';
import type { Task, TaskStatus } from '../lib/supabase';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const STATUS_CYCLE: TaskStatus[] = ['todo', 'in_progress', 'done'];

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  todo: {
    label: 'To Do',
    icon: <Circle className="w-4 h-4" />,
    classes: 'text-slate-400 bg-slate-700/60',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock className="w-4 h-4" />,
    classes: 'text-blue-400 bg-blue-500/15',
  },
  done: {
    label: 'Done',
    icon: <CheckCircle2 className="w-4 h-4" />,
    classes: 'text-emerald-400 bg-emerald-500/15',
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  low: { label: 'Low', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  medium: { label: 'Medium', dot: 'bg-amber-400', text: 'text-amber-400' },
  high: { label: 'High', dot: 'bg-red-400', text: 'text-red-400' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.setHours(0, 0, 0, 0);
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: false };
}

export default function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const status = STATUS_CONFIG[task.status];
  const priority = PRIORITY_CONFIG[task.priority];
  const dueInfo = task.due_date ? formatDate(task.due_date) : null;
  const isOverdue = dueInfo?.overdue && task.status !== 'done';

  const cycleStatus = () => {
    const idx = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onStatusChange(task.id, next);
  };

  return (
    <div className={`group bg-slate-800/80 border rounded-xl p-4 hover:border-slate-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 ${
      task.status === 'done' ? 'border-slate-700/30 opacity-70' : 'border-slate-700/60'
    }`}>
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={cycleStatus}
          className={`mt-0.5 shrink-0 transition-transform hover:scale-110 ${status.classes} rounded-full p-0.5`}
          title="Click to cycle status"
        >
          {status.icon}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium leading-snug break-words ${
            task.status === 'done' ? 'line-through text-slate-500' : 'text-white'
          }`}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-slate-400 text-sm mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.classes}`}>
              {status.label}
            </span>

            <span className={`inline-flex items-center gap-1 text-xs font-medium ${priority.text}`}>
              <Flag className="w-3 h-3" />
              {priority.label}
            </span>

            {dueInfo && (
              <span className={`inline-flex items-center gap-1 text-xs ${
                isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'
              }`}>
                <Calendar className="w-3 h-3" />
                {dueInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
