
import * as React from 'react';
import { useState } from 'react';
import { Seller, Appointment, Customer, TechnicalSheet, OrderStatus } from '../types';
import {
  Plus,
  Mail,
  Phone,
  ShieldCheck,
  X,
  Users,
  Calendar,
  Star,
  ChevronRight,
  User,
  Search,
  Ruler,
  FileText,
  Edit3,
  Info,
  Clock,
  ExternalLink,
  ChevronLeft,
  Lock,
  Eye,
  EyeOff,
  UserPlus
} from 'lucide-react';

interface SellersProps {
  sellers: Seller[];
  appointments: Appointment[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  onAdd: (s: Seller) => void;
  onUpdate: (s: Seller) => void;
  onEditTechnicalSheet: (sheet: TechnicalSheet) => void;
  onGenerateQuote: (sheet: TechnicalSheet) => void;
  onStartMeasurement: (customerId: string) => void;
}

const Sellers = ({
  sellers,
  appointments,
  customers,
  technicalSheets,
  onAdd,
  onUpdate,
  onEditTechnicalSheet,
  onGenerateQuote,
  onStartMeasurement
}: SellersProps) => {
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Seller>>({
    name: '',
    email: '',
    phone: '',
    login: '',
    password: ''
  });

  const handleOpenAdd = () => {
    setEditingSeller(null);
    setFormData({ name: '', email: '', phone: '', login: '', password: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({ ...seller });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSeller) {
      onUpdate({ ...editingSeller, ...formData } as Seller);
    } else {
      onAdd({
        ...formData as Seller,
        id: crypto.randomUUID()
      });
    }
    setShowModal(false);
  };

  const getSellerCustomers = (sellerId: string) => {
    const sellerAppIds = appointments
      .filter(app => app.sellerId === sellerId)
      .map(app => app.customerId);

    const uniqueIds = Array.from(new Set(sellerAppIds));
    return customers.filter(c => uniqueIds.includes(c.id))
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getCustomerSheetsForSeller = (customerId: string, sellerId: string) => {
    return technicalSheets.filter(s => s.customerId === customerId && s.sellerId === sellerId);
  };

  const getCustomerAppointmentsForSeller = (customerId: string, sellerId: string) => {
    return appointments.filter(a => a.customerId === customerId && a.sellerId === sellerId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
            <Users className="text-blue-600" /> Equipe de Vendas
          </h2>
          <p className="text-slate-500 font-medium">Gestão de vendedores e credenciais de acesso externo.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all font-black uppercase text-xs tracking-widest"
        >
          <UserPlus size={18} />
          Cadastrar Vendedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.map(seller => {
          const sellerCustomers = getSellerCustomers(seller.id);
          const sellerApps = appointments.filter(a => a.sellerId === seller.id);

          return (
            <div key={seller.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-blue-300 transition-all">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                      {seller.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-md leading-tight">{seller.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">@{seller.login || 'sem-login'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(seller)}
                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Carteira</p>
                    <p className="text-xl font-black text-slate-900">{sellerCustomers.length}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Visitas</p>
                    <p className="text-xl font-black text-slate-900">{sellerApps.length}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => { setSelectedSeller(seller); setSearchTerm(''); setSelectedCustomerForDetails(null); }}
                  className="text-xs font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors uppercase tracking-tighter"
                >
                  Ver Clientes <ChevronRight size={14} />
                </button>
                <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">ID: {seller.id}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal - Cadastro de Vendedor com ACESSO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">
                {editingSeller ? 'Editar Vendedor' : 'Novo Vendedor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo do Vendedor</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="text" required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Nome do consultor"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="email" required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="email@rtcdecor.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      type="text" required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="(21) 99999-9999"
                    />
                  </div>
                </div>

                {/* Seção de Login - Obrigatória */}
                <div className="md:col-span-2 p-6 bg-slate-900 text-white rounded-[32px] space-y-4 border border-white/5 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="text-blue-400" size={20} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Definir Usuário e Senha de Acesso</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Login</label>
                      <input
                        type="text" required
                        placeholder="vendedor.rtc"
                        value={formData.login}
                        onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold focus:border-blue-500/50 outline-none placeholder:text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Senha</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'} required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold focus:border-blue-500/50 outline-none pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 font-medium italic">* Estes dados serão usados pelo vendedor para logar no sistema.</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                >
                  Finalizar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sellers;
