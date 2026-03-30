import * as React from 'react';
import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Task, TaskStatus, TaskPriority, SystemUser } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Circle,
  MoreVertical,
  Trash2,
  Edit3,
  User,
  Tag,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  X,
  Check,
  FileText as ClipboardIcon
} from 'lucide-react';


interface TasksProps {
  currentUser: SystemUser;
}

const Tasks = ({ currentUser }: TasksProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    assigned_to: currentUser.role === 'ADMIN' || currentUser.role === 'ATTENDANT' ? '' : currentUser.id
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedTasks, fetchedUsers] = await Promise.all([
        dataService.getTasks(),
        dataService.getSystemUsers()
      ]);
      setTasks(fetchedTasks);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Erro ao carregar dados de tarefas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
      setIsSaving(true);
      const taskToSave = {
        ...formData,
        id: formData.id || crypto.randomUUID(),
        created_by: currentUser.id,
        updated_at: new Date().toISOString()
      };
      await dataService.saveTask(taskToSave);
      setShowAddModal(false);
      setFormData({
        title: '',
        description: '',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        assigned_to: currentUser.role === 'ADMIN' || currentUser.role === 'ATTENDANT' ? '' : currentUser.id
      });
      loadData();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      alert('Erro ao salvar tarefa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      const updatedTask = { ...task, status: newStatus };
      if (newStatus === TaskStatus.COMPLETED) {
        updatedTask.completed_at = new Date().toISOString();
      }
      await dataService.saveTask(updatedTask);
      loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      await dataService.deleteTask(id);
      loadData();
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const isOwner = task.assigned_to === currentUser.id || task.created_by === currentUser.id;
    const canSeeAll = currentUser.role === 'ADMIN' || currentUser.role === 'ATTENDANT';
    
    if (!canSeeAll && !isOwner) return false;

    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (task.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">Pendente</span>;
      case TaskStatus.IN_PROGRESS:
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase">Em Andamento</span>;
      case TaskStatus.COMPLETED:
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Concluída</span>;
      case TaskStatus.CANCELLED:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase">Cancelada</span>;
      default:
        return null;
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return <AlertCircle size={14} className="text-rose-500" />;
      case TaskPriority.HIGH:
        return <TrendingUp size={14} className="text-amber-500" />;
      case TaskPriority.MEDIUM:
        return <Circle size={14} className="text-blue-500" />;
      case TaskPriority.LOW:
        return <ArrowRight size={14} className="text-slate-400" />;

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestão de Demandas</h2>
          <p className="text-slate-500 font-medium">Tarefas, autorizações e comunicações internas.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
        >
          <Plus size={16} /> Nova Tarefa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título ou descrição..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 appearance-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value={TaskStatus.PENDING}>Pendentes</option>
            <option value={TaskStatus.IN_PROGRESS}>Em Andamento</option>
            <option value={TaskStatus.COMPLETED}>Concluídas</option>
            <option value={TaskStatus.CANCELLED}>Canceladas</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-3xl"></div>
          ))
        ) : filteredTasks.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
            <ClipboardIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm">Nenhuma tarefa encontrada</p>
          </div>

        ) : (
          filteredTasks.map(task => (
            <div 
              key={task.id} 
              className={`bg-white rounded-3xl p-6 border-l-4 shadow-sm hover:shadow-md transition-all ${
                task.status === TaskStatus.COMPLETED ? 'border-emerald-500 opacity-75' : 
                task.priority === TaskPriority.URGENT ? 'border-rose-500' : 
                task.priority === TaskPriority.HIGH ? 'border-amber-500' : 'border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {getPriorityIcon(task.priority)}
                  {getStatusBadge(task.status)}
                </div>
                <button 
                  onClick={() => handleDeleteTask(task.id!)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h4 className="font-black text-slate-900 text-sm mb-2 uppercase leading-tight">{task.title}</h4>
              <p className="text-xs text-slate-600 font-medium line-clamp-3 mb-4">{task.description}</p>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <User size={12} />
                    <span className="font-bold uppercase tracking-tighter">
                      {users.find(u => u.id === task.assigned_to)?.name || 'Sem Responsável'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar size={12} />
                    <span className="font-bold">{new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {task.status !== TaskStatus.COMPLETED && (
                    <button 
                      onClick={() => handleUpdateStatus(task, task.status === TaskStatus.PENDING ? TaskStatus.IN_PROGRESS : TaskStatus.COMPLETED)}
                      className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      {task.status === TaskStatus.PENDING ? <><TrendingUp size={12} /> Iniciar</> : <><Check size={12} /> Finalizar</>}
                    </button>
                  )}
                  {task.status === TaskStatus.COMPLETED && (
                    <div className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2">
                      <CheckCircle2 size={12} /> Tarefa Concluída
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 uppercase">Criar Nova Demanda</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Título da Tarefa</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Autorização de Desconto Especial" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Descrição</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalhes sobre a demanda..." 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Prioridade</label>
                    <select 
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as TaskPriority})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={TaskPriority.LOW}>Baixa</option>
                      <option value={TaskPriority.MEDIUM}>Média</option>
                      <option value={TaskPriority.HIGH}>Alta</option>
                      <option value={TaskPriority.URGENT}>Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Atribuir a</label>
                    <select 
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors uppercase text-xs">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all uppercase text-xs flex items-center justify-center gap-2"
                >
                  {isSaving ? 'Salvando...' : <><Plus size={16} /> Criar Tarefa</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
