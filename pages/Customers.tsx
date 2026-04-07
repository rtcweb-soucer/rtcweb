
import * as React from 'react';
import { useState } from 'react';
import { Customer, Appointment, Order, Seller, OrderStatus, TechnicalSheet, SystemUser } from '../types';
import { fuzzyMatch } from '../utils/searchUtils';
import CustomerModal from '../components/CustomerModal';
import { dataService } from '../services/dataService';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  MapPin,
  FileDown,
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
  Ruler,
  RefreshCw
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
  currentUser: SystemUser;
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
  preselectedCustomerId,
  currentUser
}: CustomersProps) => {
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'schedule'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showOnlyToday, setShowOnlyToday] = useState(true);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [scheduleData, setScheduleData] = useState<Partial<Appointment>>({
    date: getLocalISODate(new Date()),
    time: '09:00',
    status: 'SCHEDULED'
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  React.useEffect(() => {
    if (preselectedCustomerId) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
        setActiveTab('info');
        setShowDetailModal(true);
      }
    }
  }, [preselectedCustomerId, customers]);

  const handleModalSave = (customer: Customer) => {
    if (selectedCustomer) {
      onUpdate(customer);
    } else {
      onAdd(customer);
    }
    setShowModal(false);
    setShowDetailModal(false);
    setSelectedCustomer(null);
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

  const openEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const openDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setActiveTab('info');
    setShowDetailModal(true);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let duplicateCount = 0;
        const importedDocuments = new Set<string>();
        const toSave: Customer[] = [];

        for (const row of data as any[]) {
          const rawDoc = String(row.document || '').replace(/\D/g, '');

          if (rawDoc.length === 0) continue; // Pula se não tiver nenhum documento

          // Verifica se já existe na base de dados ou na própria planilha
          const isDuplicateInDB = customers.some(c => c.document.replace(/\D/g, '') === rawDoc);
          if (isDuplicateInDB || importedDocuments.has(rawDoc)) {
            duplicateCount++;
            continue; // Pula este cliente duplicado
          }
          importedDocuments.add(rawDoc);

          const inferType = rawDoc.length > 11 ? 'CNPJ' : 'CPF';
          const finalType = row.type ? (String(row.type).toUpperCase().includes('J') ? 'CNPJ' : 'CPF') : inferType;

          const newCust: Customer = {
            id: crypto.randomUUID(),
            type: finalType as 'CPF' | 'CNPJ',
            document: rawDoc,
            name: row.name || 'Cliente Sem Nome',
            tradeName: row.tradeName || '',
            email: row.email ? String(row.email).trim() : '',
            phone: String(row.phone || '').substring(0, 150),
            phone2: row.phone2 ? String(row.phone2).substring(0, 150) : undefined,
            address: {
              cep: String(row.cep || '').replace(/\D/g, ''),
              street: row.street || '',
              number: String(row.number || ''),
              complement: row.complement || '',
              neighborhood: row.neighborhood || '',
              city: row.city || '',
              state: row.state || ''
            },
            contactName: row.contactName || '',
            contactPhone: row.contactPhone ? String(row.contactPhone).substring(0, 150) : undefined,
            contactEmail: row.contactEmail ? String(row.contactEmail).trim() : '',
            legacyId: row.legacyId ? Number(row.legacyId) : undefined,
            legacyHistory: row.legacyHistory || ''
          };
          toSave.push(newCust);
        }

        if (toSave.length === 0) {
          alert(`Nenhum cliente novo encontrado.${duplicateCount > 0 ? ` (${duplicateCount} duplicados ignorados)` : ''}`);
          setIsImporting(false);
          return;
        }

        const confirmMsg = `Encontrei ${toSave.length} clientes novos para importar.\n` +
          (duplicateCount > 0 ? `${duplicateCount} duplicados serão ignorados.\n` : '') +
          `Deseja realizar a gravação definitiva no banco de dados?`;

        if (!window.confirm(confirmMsg)) {
          setIsImporting(false);
          return;
        }

        let successCount = 0;
        for (const cust of toSave) {
          await dataService.saveCustomer(cust);
          successCount++;
        }

        alert(`Sucesso! ${successCount} clientes importados.`);
        window.location.reload();

      } catch (err) {
        console.error("Erro na importação:", err);
        alert("Erro ao ler arquivo Excel. Verifique se o modelo está correto.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const todayStr = getLocalISODate(new Date());

  const filteredCustomers = React.useMemo(() => {
    const searchDigits = debouncedSearchTerm.replace(/\D/g, '');
    const hasDigits = searchDigits.length > 0;

    const filtered = customers.filter((c: Customer) => {
      const searchMatch = fuzzyMatch(c.name || '', debouncedSearchTerm) || 
                          fuzzyMatch(c.tradeName || '', debouncedSearchTerm) ||
                          (hasDigits && (c.document || '').replace(/\D/g, '').includes(searchDigits));

      if (showOnlyToday && !debouncedSearchTerm) {
        const dateRaw = c.createdAt || (c as any).created_at;
        let createdDateStr = '';
        if (dateRaw) {
          createdDateStr = typeof dateRaw === 'string' ? dateRaw.substring(0, 10) : getLocalISODate(dateRaw as Date);
        }
        return searchMatch && createdDateStr === todayStr;
      }

      return searchMatch;
    });

    return filtered.slice(0, 200);
  }, [customers, debouncedSearchTerm, showOnlyToday, todayStr]);

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
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href="/modelo_importacao_clientes.xlsx"
            download
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium border border-slate-300"
            title="Baixar planilha modelo vazia"
          >
            <FileDown size={20} />
            Baixar Modelo
          </a>
          <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls, .csv" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
          >
            <FileText size={20} />
            {isImporting ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            onClick={() => { setSelectedCustomer(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={20} />
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar cliente por nome ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnlyToday(!showOnlyToday)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${showOnlyToday ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
            title="Alternar entre cadastrados hoje ou todos os clientes"
          >
            {showOnlyToday ? 'Mostrando: Hoje' : 'Mostrando: Todos'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            title="Sincronizar e recarregar a tela"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
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

      <CustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleModalSave}
        initialData={selectedCustomer}
        mode={selectedCustomer ? 'edit' : 'add'}
      />

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
                {selectedCustomer.legacyId && (
                  <span className="mt-2 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md uppercase inline-block">ID Antigo: {selectedCustomer.legacyId}</span>
                )}
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

                    {selectedCustomer.legacyHistory && (
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                          <History size={18} className="text-emerald-500" />
                          Histórico (Sistema Antigo)
                        </h4>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                          <pre className="text-xs font-medium text-amber-900 whitespace-pre-wrap font-sans">{selectedCustomer.legacyHistory}</pre>
                        </div>
                      </div>
                    )}
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
