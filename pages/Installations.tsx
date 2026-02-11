
import * as React from 'react';
import { useState, useRef } from 'react';
import { Order, Customer, TechnicalSheet, Product, OrderStatus, Appointment, ProductionStage } from '../types';
import {
  Truck,
  Calendar,
  Clock,
  Printer,
  Search,
  MapPin,
  User,
  Package,
  Ruler,
  ChevronRight,
  X,
  CheckCircle2,
  FileText,
  Phone,
  HardHat
} from 'lucide-react';

interface InstallationsProps {
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  onUpdateOrder: (order: Order) => void;
  onAddAppointment: (appointment: Appointment) => void;
}

const Installations = ({ orders, customers, technicalSheets, products, onUpdateOrder, onAddAppointment }: InstallationsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForSchedule, setSelectedOrderForSchedule] = useState<Order | null>(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', technician: '' });
  const printRef = useRef<HTMLDivElement>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Pedidos prontos para instalar (Finished no PCP, em Instalação no PCP, ou status FINISHED)
  const installationOrders = orders.filter(o =>
    o.productionStage === ProductionStage.INSTALLATION
  ).filter(o => {
    const customer = customers.find(c => c.id === o.customerId);
    return customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
  });

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForSchedule) return;

    const updatedOrder: Order = {
      ...selectedOrderForSchedule,
      installationDate: scheduleData.date,
      installationTime: scheduleData.time,
      technician: scheduleData.technician
    };

    onUpdateOrder(updatedOrder);

    const newApp: Appointment = {
      id: crypto.randomUUID(),
      customerId: selectedOrderForSchedule.customerId,
      orderId: selectedOrderForSchedule.id,
      sellerId: selectedOrderForSchedule.sellerId,
      technicianName: scheduleData.technician,
      date: scheduleData.date,
      time: scheduleData.time,
      type: 'INSTALLATION',
      status: 'SCHEDULED'
    };

    onAddAppointment(newApp);
    setSelectedOrderForSchedule(null);
    setScheduleData({ date: '', time: '', technician: '' });
  };

  const handlePrintFicha = (order: Order) => {
    setPrintOrder(order);
    setTimeout(() => {
      if (printRef.current) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const content = printRef.current.innerHTML;
        printWindow.document.write(`
          <html>
            <head>
              <title>Ficha de Instalação - ${order.id}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print { body { padding: 0; } }
                body { font-family: sans-serif; padding: 20px; }
              </style>
            </head>
            <body>${content}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agenda de Instalações</h2>
          <p className="text-slate-500">Gestão de pedidos prontos para entrega e montagem externa.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente ou contrato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {installationOrders.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 opacity-60">
            <Truck size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium italic">Nenhum pedido aguardando instalação.</p>
          </div>
        ) : (
          installationOrders.map(order => {
            const customer = customers.find(c => c.id === order.customerId);
            const isScheduled = !!order.installationDate;

            return (
              <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                <div className={`absolute top-0 right-0 px-4 py-1 text-[9px] font-black uppercase tracking-widest ${isScheduled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isScheduled ? 'Agendado' : 'Aguardando'}
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-2xl ${isScheduled ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Truck size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase">Contrato #{order.id}</p>
                    <h3 className="font-bold text-slate-900 truncate w-48">{customer?.name}</h3>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{customer?.address.neighborhood}, {customer?.address.city}</span>
                  </div>
                  {isScheduled ? (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Calendar size={12} className="text-emerald-500" /> {new Date(order.installationDate!).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Clock size={12} className="text-emerald-500" /> {order.installationTime}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <HardHat size={12} className="text-slate-400" /> {order.technician || 'Instalador não definido'}
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 px-3 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={12} /> Pedido pronto para agendar
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handlePrintFicha(order)}
                    className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    <Printer size={14} /> Ficha
                  </button>
                  <button
                    onClick={() => setSelectedOrderForSchedule(order)}
                    className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    <Calendar size={14} /> {isScheduled ? 'Reagendar' : 'Agendar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Agendamento */}
      {selectedOrderForSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Agendar Instalação</h3>
              <button onClick={() => setSelectedOrderForSchedule(null)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Instalador / Equipe</label>
                <input
                  required
                  placeholder="Ex: Equipe Carlos"
                  value={scheduleData.technician}
                  onChange={(e) => setScheduleData({ ...scheduleData, technician: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data</label>
                  <input
                    type="date" required
                    value={scheduleData.date}
                    onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Hora</label>
                  <input
                    type="time" required
                    value={scheduleData.time}
                    onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all">
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Template de Impressão (Escondido) */}
      <div className="hidden">
        <div ref={printRef} className="p-10 text-slate-900">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Ficha de Instalação</h1>
              <p className="text-xl font-bold text-slate-600 mt-2">RTC TOLDOS E DECORAÇÕES</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black uppercase">Contrato Nº</p>
              <p className="text-3xl font-black text-blue-600">{printOrder?.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 mb-10">
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-3 py-1 w-fit">Dados do Cliente</h2>
              <div>
                <p className="text-lg font-black">{customers.find(c => c.id === printOrder?.customerId)?.name}</p>
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                  <MapPin size={14} />
                  {customers.find(c => c.id === printOrder?.customerId)?.address.street}, {customers.find(c => c.id === printOrder?.customerId)?.address.number}
                </p>
                <p className="text-sm text-slate-600 ml-5">
                  {customers.find(c => c.id === printOrder?.customerId)?.address.neighborhood} - {customers.find(c => c.id === printOrder?.customerId)?.address.city}
                </p>
                <p className="text-sm font-bold mt-2 flex items-center gap-2">
                  <Phone size={14} /> {customers.find(c => c.id === printOrder?.customerId)?.phone}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-3 py-1 w-fit">Programação</h2>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                <p className="text-sm font-bold">Data: <span className="font-black">{printOrder?.installationDate ? new Date(printOrder.installationDate).toLocaleDateString() : 'A DEFINIR'}</span></p>
                <p className="text-sm font-bold mt-1">Horário: <span className="font-black">{printOrder?.installationTime || '--:--'}</span></p>
                <p className="text-sm font-bold mt-1">Equipe: <span className="font-black">{printOrder?.technician || 'A DEFINIR'}</span></p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-3 py-1 w-fit mb-4">Itens para Instalação</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-[10px] uppercase font-black text-left">Ambiente</th>
                  <th className="border border-slate-300 p-2 text-[10px] uppercase font-black text-left">Produto</th>
                  <th className="border border-slate-300 p-2 text-[10px] uppercase font-black text-center">Cor</th>
                  <th className="border border-slate-300 p-2 text-[10px] uppercase font-black text-center">Medida (L x A)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sheet = technicalSheets.find(s => s.id === printOrder?.technicalSheetId);
                  const items = printOrder?.itemIds
                    ? sheet?.items.filter(i => printOrder.itemIds?.includes(i.id))
                    : sheet?.items;

                  return items?.map(item => (
                    <tr key={item.id}>
                      <td className="border border-slate-300 p-3 text-sm font-bold">{item.environment}</td>
                      <td className="border border-slate-300 p-3 text-sm">{products.find(p => p.id === item.productId)?.nome}</td>
                      <td className="border border-slate-300 p-3 text-sm text-center font-bold uppercase">{item.color || '-'}</td>
                      <td className="border border-slate-300 p-3 text-sm text-center font-mono font-black">{item.width.toFixed(3)}m x {item.height.toFixed(3)}m</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-10 mt-20">
            <div className="text-center pt-8 border-t border-slate-400">
              <p className="text-[10px] font-black uppercase">Instalador Responsável</p>
            </div>
            <div className="text-center pt-8 border-t border-slate-400">
              <p className="text-[10px] font-black uppercase">Visto do Cliente (Pós-Instalação)</p>
            </div>
          </div>

          <div className="mt-20 p-6 bg-slate-900 text-white rounded-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest mb-2">Checklist do Instalador</h3>
            <div className="grid grid-cols-2 gap-4">
              <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Verificado fixação e prumo</p>
              <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Testado abertura e fechamento</p>
              <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Ambiente limpo após o serviço</p>
              <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Instruções de uso passadas ao cliente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Installations;
