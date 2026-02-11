
import * as React from 'react';
import { useState } from 'react';
import { SystemUser, UserRole } from '../types';
import { MENU_ITEMS } from '../constants';
import {
   ShieldCheck,
   UserPlus,
   X,
   User,
   Lock,
   Trash2,
   Edit3,
   Search,
   Eye,
   EyeOff,
   UserCog,
   Shield,
   Briefcase,
   Factory,
   Headphones,
   Users2,
   CheckCircle2
} from 'lucide-react';

interface UsersManagementProps {
   users: SystemUser[];
   onAddUser: (user: SystemUser) => void;
   onUpdateUser: (user: SystemUser) => void;
   onDeleteUser: (id: string) => void;
}

const UsersManagement = ({ users, onAddUser, onUpdateUser, onDeleteUser }: UsersManagementProps) => {
   const [showModal, setShowModal] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

   const [formData, setFormData] = useState<Partial<SystemUser>>({
      name: '',
      login: '',
      password: '',
      role: UserRole.ATTENDANT,
      active: true,
      permissions: []
   });

   const filteredUsers = users.filter((u: SystemUser) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingUser) {
         onUpdateUser({ ...editingUser, ...formData } as SystemUser);
      } else {
         onAddUser({
            ...formData as SystemUser,
            id: crypto.randomUUID()
         });
      }
      closeModal();
   };

   const openModal = (user?: SystemUser) => {
      if (user) {
         setEditingUser(user);
         setFormData({
            ...user,
            permissions: user.permissions || []
         });
      } else {
         setEditingUser(null);
         setFormData({
            name: '',
            login: '',
            password: '',
            role: UserRole.ATTENDANT,
            active: true,
            permissions: []
         });
      }
      setShowModal(true);
   };

   const closeModal = () => {
      setShowModal(false);
      setEditingUser(null);
      setShowPassword(false);
   };

   const togglePermission = (id: string) => {
      const current = formData.permissions || [];
      if (current.includes(id)) {
         setFormData({ ...formData, permissions: current.filter(p => p !== id) });
      } else {
         setFormData({ ...formData, permissions: [...current, id] });
      }
   };

   const selectAllPermissions = () => {
      setFormData({ ...formData, permissions: MENU_ITEMS.map(m => m.id) });
   };

   const clearAllPermissions = () => {
      setFormData({ ...formData, permissions: [] });
   };

   const getRoleBadge = (role: UserRole) => {
      switch (role) {
         case UserRole.ADMIN: return { color: 'bg-rose-500 text-white', label: 'Administrador', icon: <Shield size={12} /> };
         case UserRole.PRODUCTION: return { color: 'bg-indigo-600 text-white', label: 'Equipe PCP', icon: <Factory size={12} /> };
         case UserRole.SELLER: return { color: 'bg-amber-500 text-white', label: 'Vendedor Externo', icon: <Briefcase size={12} /> };
         case UserRole.ATTENDANT: return { color: 'bg-blue-600 text-white', label: 'Atendimento', icon: <Headphones size={12} /> };
         default: return { color: 'bg-slate-500 text-white', label: 'Outro', icon: <User size={12} /> };
      }
   };

   return (
      <div className="space-y-6 animate-in fade-in duration-500">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                  <Users2 className="text-rose-500" size={28} /> Cadastro de Equipe
               </h2>
               <p className="text-slate-500 font-medium italic">Gerencie logins, senhas e permissões de acesso.</p>
            </div>
            <button
               onClick={() => openModal()}
               className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
               <UserPlus size={18} />
               Novo Colaborador
            </button>
         </div>

         <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input
                  type="text"
                  placeholder="Buscar colaborador por nome ou login..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold"
               />
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user: SystemUser) => {
               const badge = getRoleBadge(user.role);
               return (
                  <div key={user.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group overflow-hidden relative">
                     <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                           <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-all group-hover:scale-110 ${badge.color} shadow-current/10`}>
                              {user.name.charAt(0)}
                           </div>
                           <div>
                              <h3 className="font-black text-slate-900 leading-tight truncate w-32">{user.name}</h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{user.login}</p>
                           </div>
                        </div>
                        <div className="flex flex-col gap-2">
                           <button onClick={() => openModal(user)} className="p-2 text-slate-300 hover:text-blue-600 bg-slate-50 rounded-xl transition-all" title="Editar"><Edit3 size={16} /></button>
                           <button onClick={() => onDeleteUser(user.id)} className="p-2 text-slate-300 hover:text-rose-600 bg-slate-50 rounded-xl transition-all" title="Excluir"><Trash2 size={16} /></button>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Usuário</span>
                           <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${badge.color}`}>
                              {badge.icon} {badge.label}
                           </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telas Ativas</span>
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {user.permissions?.length || 0} habilitadas
                           </span>
                        </div>
                     </div>
                  </div>
               );
            })}
         </div>

         {/* Modal - Cadastro de Equipe */}
         {showModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
               <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-rose-500/20">
                           <ShieldCheck size={24} />
                        </div>
                        <div>
                           <h3 className="font-black text-xl text-slate-900 leading-none uppercase tracking-tighter">
                              {editingUser ? 'Atualizar Colaborador' : 'Novo Cadastro de Equipe'}
                           </h3>
                           <p className="text-slate-500 text-xs mt-1 font-medium italic">Defina login, senha e quais telas o usuário pode ver.</p>
                        </div>
                     </div>
                     <button onClick={closeModal} className="p-2 text-slate-400 hover:text-rose-500">
                        <X size={24} />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8">
                     <form id="team-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           {/* Lado Esquerdo: Dados de Login */}
                           <div className="space-y-6">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Informações de Acesso</h4>

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Colaborador</label>
                                 <div className="relative mt-1">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                       type="text" required
                                       value={formData.name}
                                       onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                       className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                       placeholder="Nome Completo"
                                    />
                                 </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login</label>
                                    <div className="relative mt-1">
                                       <UserCog className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                       <input
                                          type="text" required
                                          value={formData.login}
                                          onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                          placeholder="usuario.rtc"
                                       />
                                    </div>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                                    <div className="relative mt-1">
                                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                       <input
                                          type={showPassword ? 'text' : 'password'} required
                                          value={formData.password}
                                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                          className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                          placeholder="••••••••"
                                       />
                                       <button
                                          type="button"
                                          onClick={() => setShowPassword(!showPassword)}
                                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                                       >
                                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                       </button>
                                    </div>
                                 </div>
                              </div>

                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Usuário (Nível)</label>
                                 <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                 >
                                    <option value={UserRole.ATTENDANT}>Atendimento (Comercial)</option>
                                    <option value={UserRole.PRODUCTION}>PCP (Fábrica)</option>
                                    <option value={UserRole.SELLER}>Vendedor (Externo)</option>
                                    <option value={UserRole.ADMIN}>Administrador (Master)</option>
                                 </select>
                              </div>

                              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <input
                                    type="checkbox" id="active"
                                    checked={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    className="w-6 h-6 text-blue-600 rounded-lg border-slate-300"
                                 />
                                 <label htmlFor="active" className="text-xs font-bold text-slate-700 cursor-pointer">Colaborador Ativo (Pode logar)</label>
                              </div>
                           </div>

                           {/* Lado Direito: Permissões de Telas */}
                           <div className="space-y-6">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Permissões de Telas (Views)</h4>
                                 <div className="flex gap-2">
                                    <button type="button" onClick={selectAllPermissions} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Marcar Todas</button>
                                    <button type="button" onClick={clearAllPermissions} className="text-[9px] font-black text-slate-400 uppercase hover:underline">Limpar</button>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                 {MENU_ITEMS.map((item) => {
                                    const isSelected = formData.permissions?.includes(item.id);
                                    return (
                                       <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => togglePermission(item.id)}
                                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                       >
                                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-white border border-slate-100'}`}>
                                             {/* Fix: Cast React.ReactElement to any to allow size prop in cloneElement */}
                                             {React.cloneElement(item.icon as React.ReactElement<any>, { size: 14 })}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <p className="text-[11px] font-bold leading-none truncate">{item.label}</p>
                                          </div>
                                          {isSelected && <CheckCircle2 size={16} />}
                                       </button>
                                    );
                                 })}
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium italic">Se nenhuma tela for marcada, o sistema usará as permissões padrão do cargo selecionado.</p>
                           </div>
                        </div>
                     </form>
                  </div>

                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                     <button type="button" onClick={closeModal} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-colors">Cancelar</button>
                     <button type="submit" form="team-form" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95">
                        {editingUser ? 'Salvar Alterações' : 'Criar Colaborador'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default UsersManagement;
