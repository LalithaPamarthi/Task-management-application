import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Task, TaskInsert, TaskStatus } from '../lib/supabase';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import {
  CheckSquare, Plus, LogOut, Search, SlidersHorizontal,
  CheckCircle2, Clock, Circle, Wifi, WifiOff
} from 'lucide-react';

type FilterStatus = 'all' | TaskStatus;
type FilterPriority = 'all' | 'low' | 'medium' | 'high';
type SortBy = 'created_at' | 'due_date' | 'priority' | 'title';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null | 'new'>('new');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [sortBy, setSortBy] = useState<SortBy>('created_at');
  const [realtime, setRealtime] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '');
    });

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        setRealtime(true);
        if (payload.eventType === 'INSERT') {
          setTasks((prev) => [payload.new as Task, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks((prev) => prev.map((t) => t.id === payload.new.id ? payload.new as Task : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        setRealtime(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const handleSave = async (data: TaskInsert) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTask && editingTask !== 'new') {
      const { error } = await supabase.from('tasks').update(data).eq('id', editingTask.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('tasks').insert({ ...data, user_id: user.id });
      if (error) throw error;
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    await supabase.from('tasks').update({ status }).eq('id', id);
  };

  const openNew = () => { setEditingTask('new'); setShowModal(true); };
  const openEdit = (task: Task) => { setEditingTask(task); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingTask(null); };

  const signOut = () => supabase.auth.signOut();

  const filtered = tasks
    .filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'due_date') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">TaskFlow</span>
            <span className={`hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              realtime ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
            }`}>
              {realtime ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {realtime ? 'Live' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-slate-400 truncate max-w-[200px]">{userEmail}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'All Tasks', count: counts.all, icon: <SlidersHorizontal className="w-4 h-4" />, color: 'text-slate-300', bg: 'bg-slate-800' },
            { label: 'To Do', count: counts.todo, icon: <Circle className="w-4 h-4" />, color: 'text-slate-400', bg: 'bg-slate-800' },
            { label: 'In Progress', count: counts.in_progress, icon: <Clock className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Done', count: counts.done, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border border-slate-700/50 rounded-xl p-4`}>
              <div className={`flex items-center gap-2 ${stat.color} text-sm font-medium mb-1`}>
                {stat.icon}
                {stat.label}
              </div>
              <p className="text-2xl font-bold text-white">{stat.count}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="all">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="created_at">Newest</option>
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
          </div>

          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">
              {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              {tasks.length === 0 ? 'Create your first task to get started' : 'Try adjusting your search or filters'}
            </p>
            {tasks.length === 0 && (
              <button
                onClick={openNew}
                className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <TaskModal
          task={editingTask !== 'new' ? editingTask : null}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
