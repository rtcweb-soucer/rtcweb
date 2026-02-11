
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Appointment, Seller, Customer, UserRole, TechnicalSheet, Product } from '../types';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  MapPin,
  Ruler,
  Info,
  Phone,
  User,
  Search,
  FileText,
  Edit3,
  ChevronRight,
  Package,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';

interface ScheduleProps {
  appointments: Appointment[];
  sellers: Seller[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  onAdd: (a: Appointment) => void;
  onStartMeasurement?: (customerId: string) => void;
  onEditTechnicalSheet?: (sheet: TechnicalSheet) => void;
  onGenerateQuote?: (sheet: TechnicalSheet, selectedItemIds?: string[]) => void;
  role: UserRole;
  currentUser: any;
}

const Schedule = ({
  appointments,
  sellers,
  customers,
  technicalSheets,
  products,
  onAdd,
  onStartMeasurement,
  onEditTechnicalSheet,
  onGenerateQuote,
  role,
  currentUser
}: ScheduleProps) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [filterSeller, setFilterSeller] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para controlar a seleção de itens da ficha técnica no modal
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [newApp, setNewApp] = useState<Partial<Appointment>>({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    status: 'SCHEDULED'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...newApp as Appointment,
      id: crypto.randomUUID()
    });
    setShowModal(false);
  };

  const filteredAppointments = appointments.filter((app: Appointment) => {
    const customer = customers.find((c: Customer) => c.id === app.customerId);
    const matchesSearch = customer?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeller = !filterSeller || app.sellerId === filterSeller;
    const matchesStatus = !filterStatus || app.status === filterStatus;

    if (role === UserRole.SELLER) {
      const sellerId = currentUser?.sellerId || currentUser?.id;
      return matchesSearch && matchesStatus && app.sellerId === sellerId;
    }

    return matchesSearch && matchesSeller && matchesStatus;
  });

  const getSheetForApp = (app: Appointment) => {
    return technicalSheets
      .filter((s: TechnicalSheet) => s.customerId === app.customerId)
      .sort((a: TechnicalSheet, b: TechnicalSheet) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  };

  // Efeito para selecionar todos os itens por padrão ao abrir o modal
  useEffect(() => {
    if (selectedApp) {
      const sheet = getSheetForApp(selectedApp);
      if (sheet) {
        setSelectedItems(new Set(sheet.items.map((i: any) => i.id)));
      } else {
        setSelectedItems(new Set());
      }
    }
  }, [selectedApp]);

  const toggleItemSelection = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{role === UserRole.SELLER ? 'Minha Agenda' : 'Agendamentos'}</h2>
          <p className="text-slate-500">Acompanhe as visitas técnicas em campo.</p>
        </div>
        {role !== UserRole.SELLER && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 font-bold"
          >
            <Plus size={20} />
            Agendar Visita
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        {role !== UserRole.SELLER && (
          <div className="w-full md:w-48">
            <select
              value={filterSeller}
              onChange={(e) => setFilterSeller(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="w-full md:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                {role !== UserRole.SELLER && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Vendedor</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={role === UserRole.SELLER ? 4 : 5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum agendamento encontrado</td>
                </tr>
              ) : (
                filteredAppointments.map((app) => {
                  const customer = customers.find(c => c.id === app.customerId);
                  const seller = sellers.find(s => s.id === app.sellerId);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <CalendarIcon size={14} className="text-blue-500" />
                          {new Date(app.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Clock size={14} className="text-slate-400" />
                          {app.time}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors text-left block"
                        >
                          {customer?.name}
                        </button>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <MapPin size={12} />
                          {customer?.address.neighborhood}, {customer?.address.city}
                        </div>
                      </td>
                      {role !== UserRole.SELLER && (
                        <td className="px-6 py-4 text-sm text-slate-600">{seller?.name}</td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${app.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                          {app.status === 'SCHEDULED' ? 'AGENDADO' : 'CONCLUÍDO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {role === UserRole.SELLER && app.status === 'SCHEDULED' && (
                            <button
                              onClick={() => onStartMeasurement?.(app.customerId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              <Ruler size={14} />
                              Medir
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Detalhes e Ficha Técnica"
                          >
                            <Info size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 italic">
            Nenhum agendamento encontrado
          </div>
        ) : (
          filteredAppointments.map((app) => {
            const customer = customers.find(c => c.id === app.customerId);
            const seller = sellers.find(s => s.id === app.sellerId);
            return (
              <div key={app.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors text-left block"
                    >
                      {customer?.name}
                    </button>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin size={12} />
                      {customer?.address.neighborhood}, {customer?.address.city}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${app.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                    {app.status === 'SCHEDULED' ? 'AGENDADO' : 'CONCLUÍDO'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <CalendarIcon size={14} className="text-blue-500" />
                      {new Date(app.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                      <Clock size={14} className="text-slate-400" />
                      {app.time}
                    </div>
                  </div>
                </div>

                {role !== UserRole.SELLER && (
                  <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg">
                    Vendedor: <span className="font-semibold text-slate-700">{seller?.name}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-50">
                  {role === UserRole.SELLER && app.status === 'SCHEDULED' && (
                    <button
                      onClick={() => onStartMeasurement?.(app.customerId)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                    >
                      <Ruler size={16} />
                      Iniciar Medição
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="p-3 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all"
                    title="Detalhes"
                  >
                    <Info size={20} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Detalhes Estendido */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Visita Técnica: {customers.find(c => c.id === selectedApp.customerId)?.name}</h3>
                  <p className="text-xs text-slate-500">Agendamento ID: {selectedApp.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              {(() => {
                const customer = customers.find(c => c.id === selectedApp.customerId);
                const seller = sellers.find(s => s.id === selectedApp.sellerId);
                const sheet = getSheetForApp(selectedApp);

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Informações do Cliente</p>
                        <p className="font-bold text-slate-900 flex items-center gap-2">
                          <User size={14} className="text-blue-500" /> {customer?.name}
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone size={14} className="text-slate-400" /> {customer?.phone}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin size={14} className="text-slate-400 shrink-0" />
                            <span className="text-xs">{customer?.address.street}, {customer?.address.number} - {customer?.address.neighborhood}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50">
                        <p className="text-[10px] uppercase font-black text-blue-400 mb-2 tracking-widest">Horário e Vendedor</p>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {seller?.name.charAt(0)}
                          </div>
                          <p className="text-sm font-bold text-slate-700">{seller?.name}</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <CalendarIcon size={14} className="text-blue-500" /> {new Date(selectedApp.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <Clock size={14} className="text-blue-500" /> {selectedApp.time}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedApp.notes && (
                      <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                        <Info className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="text-[10px] uppercase font-black text-amber-600 mb-1 tracking-widest">Observações</p>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">{selectedApp.notes}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <Layers size={16} className="text-orange-500" />
                          Itens Medidos / Ficha Técnica
                        </h4>
                        {sheet && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setSelectedApp(null); onEditTechnicalSheet?.(sheet); }}
                              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              <Edit3 size={14} /> Editar
                            </button>
                            <button
                              onClick={() => {
                                if (selectedItems.size === 0) {
                                  alert("Selecione pelo menos um item para gerar o orçamento.");
                                  return;
                                }
                                setSelectedApp(null);
                                onGenerateQuote?.(sheet, Array.from(selectedItems));
                              }}
                              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm ${selectedItems.size > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                            >
                              <FileText size={14} /> Gerar Orçamento ({selectedItems.size})
                            </button>
                          </div>
                        )}
                      </div>

                      {sheet ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-slate-400 uppercase px-4">
                            <div className="col-span-1"></div>
                            <div className="col-span-3">Ambiente</div>
                            <div className="col-span-4">Produto</div>
                            <div className="col-span-2 text-center">Largura</div>
                            <div className="col-span-2 text-center">Altura</div>
                          </div>
                          <div className="space-y-2">
                            {sheet.items.map((item, idx) => {
                              const product = products.find(p => p.id === item.productId);
                              const isSelected = selectedItems.has(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className={`grid grid-cols-12 gap-2 p-3 border rounded-xl items-center transition-all ${isSelected ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                                >
                                  <div className="col-span-1 flex justify-center">
                                    <button
                                      onClick={() => toggleItemSelection(item.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-slate-300 border border-slate-200 hover:border-blue-300'}`}
                                    >
                                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                  </div>
                                  <div className="col-span-3 text-sm font-bold text-slate-700 uppercase tracking-tight truncate">{item.environment}</div>
                                  <div className="col-span-4 flex items-center gap-2">
                                    <Package size={14} className="text-slate-400" />
                                    <span className="text-xs text-slate-600 truncate">{product?.nome || item.productId}</span>
                                  </div>
                                  <div className="col-span-2 text-center text-xs font-mono font-bold text-blue-600 bg-white py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                    {item.width.toFixed(3)}m
                                  </div>
                                  <div className="col-span-2 text-center text-xs font-mono font-bold text-blue-600 bg-white py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                    {item.height.toFixed(3)}m
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                          <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4">
                            <Ruler size={24} />
                          </div>
                          <p className="text-sm text-slate-500 font-medium">Nenhuma ficha técnica vinculada.</p>
                          <p className="text-xs text-slate-400 mt-1 mb-6">Realize as medições em campo para gerar o orçamento.</p>
                          <button
                            onClick={() => { setSelectedApp(null); onStartMeasurement?.(selectedApp.customerId); }}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                          >
                            Iniciar Medição Agora
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">Agendar Visita Técnica</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Cliente *</label>
                  <select
                    required
                    onChange={(e) => setNewApp({ ...newApp, customerId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="">Selecione um cliente...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Vendedor Responsável *</label>
                  <select
                    required
                    onChange={(e) => setNewApp({ ...newApp, sellerId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="">Selecione um vendedor...</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data *</label>
                    <input
                      type="date"
                      required
                      value={newApp.date}
                      onChange={(e) => setNewApp({ ...newApp, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Hora *</label>
                    <input
                      type="time"
                      required
                      value={newApp.time}
                      onChange={(e) => setNewApp({ ...newApp, time: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Observações (Opcional)</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Cliente solicitou catálogo de cores específicas, portão estreito..."
                    value={newApp.notes || ''}
                    onChange={(e) => setNewApp({ ...newApp, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">Salvar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
