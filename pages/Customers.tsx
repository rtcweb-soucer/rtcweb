
import * as React from 'react';
import { useState } from 'react';
import { Customer, Appointment, Order, Seller, OrderStatus, TechnicalSheet } from '../types';
import { fuzzyMatch } from '../utils/searchUtils';
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Building2,
  User as UserIcon,
  X,
  Smartphone,
  Eye,
  Edit3,
  History,
  Calendar,
  FileText,
  ChevronRight,
  Clock,
  ArrowRightCircle,
  SearchCode,
  Ruler
} from 'lucide-react';

// Helpers para tratamento de data local
const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

interface CustomersProps {
  customers: Customer[];
  onAdd: (c: Customer) => void;
  onUpdate: (c: Customer) => void;
  appointments: Appointment[];
  orders: Order[];
  sellers: Seller[];
  technicalSheets: TechnicalSheet[];
  onAddAppointment: (a: Appointment) => void;
  preselectedCustomerId?: string | null;
}

const Customers = ({
  customers,
  onAdd,
  onUpdate,
  appointments,
  orders,
  sellers,
  technicalSheets,
  onAddAppointment,
  preselectedCustomerId
}: CustomersProps) => {
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'schedule'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [formData, setFormData] = useState<Partial<Customer>>({
    type: 'CPF',
    address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  });

  const [scheduleData, setScheduleData] = useState<Partial<Appointment>>({
    date: getLocalISODate(new Date()),
    time: '09:00',
    status: 'SCHEDULED'
  });

  React.useEffect(() => {
    if (preselectedCustomerId) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        openDetails(customer);
      }
    }
  }, [preselectedCustomerId, customers]);

  const handleCepLookup = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length === 8) {
      setLoadingSearch(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            address: {
              ...prev.address!,
              cep,
              street: data.logradouro || prev.address?.street || '',
              neighborhood: data.bairro || prev.address?.neighborhood || '',
              city: data.localidade || prev.address?.city || '',
              state: data.uf || prev.address?.state || ''
            }
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setLoadingSearch(false);
      }
    }
  };

  const handleCnpjLookup = async () => {
    if (!formData.document) return;
    const cleanCnpj = formData.document.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      alert("CNPJ inválido (deve ter 14 dígitos)");
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();

      setFormData(prev => ({
        ...prev,
        name: data.razao_social || '',
        tradeName: data.nome_fantasia || '',
        email: data.email || prev.email || '',
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : prev.phone || '',
        address: {
          ...prev.address!,
          cep: data.cep || '',
          street: data.logradouro || '',
          number: data.numero || '',
          complement: data.complemento || '',
          neighborhood: data.bairro || '',
          city: data.municipio || '',
          state: data.uf || ''
        }
      }));
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      alert("Erro ao consultar CNPJ. Verifique se o número está correto.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomer) {
      onUpdate({ ...selectedCustomer, ...formData } as Customer);
    } else {
      onAdd({
        ...formData as Customer,
        id: crypto.randomUUID()
      });
    }
    setShowModal(false);
    setShowDetailModal(false);
    resetForms();
  };

  const handleQuickSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    onAddAppointment({
      ...scheduleData as Appointment,
      id: crypto.randomUUID(),
      customerId: selectedCustomer.id
    });

    setScheduleData({
      date: getLocalISODate(new Date()),
      time: '09:00',
      status: 'SCHEDULED'
    });
    setActiveTab('history');
  };

  const resetForms = () => {
    setSelectedCustomer(null);
    setFormData({
      type: 'CPF',
      address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' },
      phone2: '',
      contactName: '',
      contactPhone: '',
      contactEmail: ''
    });
  };

  const openEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({ ...customer });
    setShowModal(true);
  };

  const openDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({ ...customer });
    setActiveTab('info');
    setShowDetailModal(true);
  };

  const filteredCustomers = customers.filter((c: Customer) =>
    fuzzyMatch(c.name || '', searchTerm) ||
    (c.document || '').includes(searchTerm)
  );

  const customerAppointments = appointments.filter((a: Appointment) => a.customerId === selectedCustomer?.id);
  const customerOrders = orders.filter((o: Order) => o.customerId === selectedCustomer?.id);
  const customerSheets = technicalSheets.filter((s: TechnicalSheet) => s.customerId === selectedCustomer?.id);
  const customerQuotes = customerOrders.filter((o: Order) => o.status === OrderStatus.TECHNICAL_SHEET_CREATED || o.status === OrderStatus.QUOTE_SENT);
  const customerFinalOrders = customerOrders.filter((o: Order) => o.status !== OrderStatus.TECHNICAL_SHEET_CREATED && o.status !== OrderStatus.QUOTE_SENT);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clientes</h2>
          <p className="text-slate-500">Gerencie sua base de clientes e leads.</p>
        </div>
        <button
          onClick={() => { resetForms(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Documento</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome / Razão Social</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Telefone</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Localização</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((customer: Customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">
                    {customer.document}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {customer.type === 'CNPJ' ? <Building2 size={18} /> : <UserIcon size={18} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{customer.name}</div>
                        {customer.tradeName && <div className="text-[10px] text-blue-600 font-medium">{customer.tradeName}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      {customer.address.city}/{customer.address.state}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase">
                      {customer.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDetails(customer)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Detalhes e Histórico"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => openEdit(customer)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit3 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum cliente cadastrado ou encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">{selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo</label>
                  <div className="flex gap-2">
                    {['CPF', 'CNPJ'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t as any })}
                        className={`flex-1 py-2 text-sm font-bold rounded-xl border ${formData.type === t ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Documento *</label>
                  <div className="relative">
                    <input type="text" required value={formData.document || ''} onChange={(e) => setFormData({ ...formData, document: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10" />
                    {formData.type === 'CNPJ' && (
                      <button
                        type="button"
                        onClick={handleCnpjLookup}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 p-1"
                        title="Consultar CNPJ"
                      >
                        <SearchCode size={18} className={loadingSearch ? 'animate-pulse' : ''} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail *</label>
                  <input type="email" required value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo / Razão Social *</label>
                  <input type="text" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                {formData.type === 'CNPJ' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Fantasia</label>
                    <input type="text" value={formData.tradeName || ''} onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP *</label>
                  <input type="text" required value={formData.address?.cep || ''} onChange={(e) => { handleCepLookup(e.target.value); setFormData(p => ({ ...p, address: { ...p.address!, cep: e.target.value } })) }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone Principal *</label>
                  <input type="text" required value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone Secundário</label>
                  <input type="text" value={formData.phone2 || ''} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="col-span-full grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rua/Logradouro</label>
                    <input type="text" value={formData.address?.street || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, street: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº</label>
                    <input type="text" value={formData.address?.number || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, number: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comp.</label>
                    <input type="text" value={formData.address?.complement || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, complement: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Ex: Apto 10" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label>
                    <input type="text" value={formData.address?.neighborhood || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, neighborhood: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label>
                    <input type="text" value={formData.address?.city || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, city: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UF</label>
                    <input type="text" value={formData.address?.state || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, state: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase" />
                  </div>
                </div>

                {formData.type === 'CNPJ' && (
                  <div className="col-span-full bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-4">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dados de Contato (PJ)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Contato</label>
                        <input type="text" value={formData.contactName || ''} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" placeholder="Ex: João Silva" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone do Contato</label>
                        <input type="text" value={formData.contactPhone || ''} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail do Contato</label>
                        <input type="email" value={formData.contactEmail || ''} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Detalhes / Histórico / Agendamento Rápido */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row h-[90vh]">
            <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 p-8 flex flex-col overflow-y-auto shrink-0">
              <div className="mb-8 text-center md:text-left">
                <div className="h-20 w-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-4 mx-auto md:mx-0">
                  {selectedCustomer.type === 'CNPJ' ? <Building2 size={32} /> : <UserIcon size={32} />}
                </div>
                <h3 className="font-bold text-xl text-slate-900 leading-tight mb-1">{selectedCustomer.name}</h3>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{selectedCustomer.document}</p>
              </div>

              <div className="space-y-6 flex-1">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Contato</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-blue-500" /> {selectedCustomer.phone}
                    </div>
                    {selectedCustomer.phone2 && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Smartphone size={14} className="text-blue-500" /> {selectedCustomer.phone2}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} className="text-blue-500" /> {selectedCustomer.email}
                    </div>
                  </div>
                </div>

                {(selectedCustomer.contactName || selectedCustomer.contactPhone) && (
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Contato na Empresa</p>
                    <div className="space-y-1">
                      {selectedCustomer.contactName && <p className="text-xs font-bold text-slate-900">{selectedCustomer.contactName}</p>}
                      {selectedCustomer.contactPhone && <p className="text-[11px] text-slate-600 flex items-center gap-1.5"><Phone size={10} /> {selectedCustomer.contactPhone}</p>}
                      {selectedCustomer.contactEmail && <p className="text-[11px] text-slate-600 flex items-center gap-1.5"><Mail size={10} /> {selectedCustomer.contactEmail}</p>}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Endereço</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {selectedCustomer.address.street}, {selectedCustomer.address.number}
                    {selectedCustomer.address.complement && <span> • {selectedCustomer.address.complement}</span>}
                    <br />
                    {selectedCustomer.address.neighborhood}<br />
                    {selectedCustomer.address.city} - {selectedCustomer.address.state}<br />
                    <span className="text-[10px] font-bold text-slate-400">CEP: {selectedCustomer.address.cep}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setShowDetailModal(false); openEdit(selectedCustomer); }}
                className="mt-8 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Edit3 size={16} /> Editar Cadastro
              </button>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-white">
              <div className="px-8 pt-8 flex items-center justify-between border-b border-slate-50 shrink-0">
                <div className="flex gap-8">
                  {[
                    { id: 'info', label: 'Visão Geral', icon: <Eye size={18} /> },
                    { id: 'history', label: 'Histórico', icon: <History size={18} /> },
                    { id: 'schedule', label: 'Agendar Visita', icon: <Calendar size={18} /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 text-slate-400 hover:text-slate-900 mb-4 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'info' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Agendamentos</p>
                        <p className="text-2xl font-black text-slate-900">{customerAppointments.length}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Orçamentos</p>
                        <p className="text-2xl font-black text-slate-900">{customerQuotes.length}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contratos</p>
                        <p className="text-2xl font-black text-slate-900">{customerFinalOrders.length}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        Atividade Recente
                      </h4>
                      <div className="space-y-3">
                        {customerAppointments.slice(0, 3).map((app: Appointment) => (
                          <div key={app.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={16} /></div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">Visita Técnica Agendada</p>
                                <p className="text-xs text-slate-500">{formatDisplayDate(app.date)} às {app.time}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">AGENDADO</span>
                          </div>
                        ))}
                        {customerAppointments.length === 0 && <p className="text-sm text-slate-400 italic">Nenhuma atividade recente encontrada.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                    <section className="space-y-3">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-blue-500 pl-3">Linha do Tempo de Visitas</h5>
                      {customerAppointments.map((app: Appointment) => (
                        <div key={app.id} className="flex items-center gap-4 p-4 border-b border-slate-50">
                          <div className="w-12 h-12 flex flex-col items-center justify-center bg-slate-50 rounded-xl text-slate-500 font-bold border border-slate-100">
                            <span className="text-[10px] uppercase">{formatDisplayDate(app.date).split('/')[1]}</span>
                            <span className="text-lg leading-none">{app.date.split('-')[2]}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">Medição Técnica</p>
                            <p className="text-xs text-slate-500">Realizada por: {sellers.find((s: Seller) => s.id === app.sellerId)?.name || 'Vendedor RTC'}</p>
                          </div>
                          <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><ChevronRight size={20} /></button>
                        </div>
                      ))}
                      {customerAppointments.length === 0 && <p className="text-sm text-slate-400 italic py-4">Nenhum agendamento registrado.</p>}
                    </section>

                    <section className="space-y-3">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-orange-500 pl-3">Fichas Técnicas (Medições)</h5>
                      {customerSheets.map((sheet: TechnicalSheet) => (
                        <div key={sheet.id} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/30">
                          <div className="p-3 bg-white text-orange-500 rounded-xl border border-slate-100"><Ruler size={20} /></div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">{sheet.id}</p>
                            <p className="text-xs text-slate-500">{sheet.items.length} itens medidos • {new Date(sheet.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button className="p-2 text-slate-300 hover:text-orange-600 transition-colors"><Eye size={18} /></button>
                        </div>
                      ))}
                      {customerSheets.length === 0 && <p className="text-sm text-slate-400 italic py-4">Nenhuma ficha técnica vinculada.</p>}
                    </section>

                    <section className="space-y-3">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-3">Orçamentos e Pedidos</h5>
                      {customerOrders.map((order: Order) => (
                        <div key={order.id} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/30">
                          <div className="p-3 bg-white text-slate-400 rounded-xl border border-slate-100"><FileText size={20} /></div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">Pedido {order.id}</p>
                            <p className="text-xs text-slate-500">Valor: R$ {order.totalValue.toLocaleString('pt-BR')}</p>
                          </div>
                          <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${order.status === OrderStatus.QUOTE_SENT ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
                            }`}>
                            {order.status}
                          </div>
                        </div>
                      ))}
                      {customerOrders.length === 0 && <p className="text-sm text-slate-400 italic py-4">Nenhum pedido ou orçamento encontrado.</p>}
                    </section>
                  </div>
                )}

                {activeTab === 'schedule' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="max-w-md">
                      <h4 className="font-bold text-xl text-slate-900 mb-6">Novo Agendamento Rápido</h4>
                      <form onSubmit={handleQuickSchedule} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendedor Responsável</label>
                          <select
                            required
                            value={scheduleData.sellerId || ''}
                            onChange={(e) => setScheduleData({ ...scheduleData, sellerId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                          >
                            <option value="">Selecione um vendedor...</option>
                            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                            <input
                              type="date"
                              required
                              value={scheduleData.date}
                              onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                            <input
                              type="time"
                              required
                              value={scheduleData.time}
                              onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                            />
                          </div>
                        </div>
                        <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95">
                          <ArrowRightCircle size={20} /> Confirmar Agendamento
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
