
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Order, Customer, TechnicalSheet, Product, OrderStatus, Appointment, ProductionStage, Installer } from '../types';
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
  HardHat,
  Edit2,
  RotateCcw
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { notificationService } from '../services/notificationService';

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

interface InstallationsProps {
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  onUpdateOrder: (order: Order) => void;
  onAddAppointment: (appointment: Appointment) => void;
  installers: Installer[];
}

const Installations = ({ orders, customers, technicalSheets, products, onUpdateOrder, onAddAppointment, installers }: InstallationsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForSchedule, setSelectedOrderForSchedule] = useState<Order | null>(null);
  const [scheduleData, setScheduleData] = useState<{ date: string; time: string; installerIds: string[] }>({
    date: '',
    time: '',
    installerIds: []
  });
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSelection, setManualSelection] = useState<{ customerId: string; orderId: string }>({
    customerId: '',
    orderId: ''
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const [printOrdersList, setPrintOrdersList] = useState<Order[]>([]);

  // New States for History, finalization and Rework
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [finalizingOrder, setFinalizingOrder] = useState<Order | null>(null);
  const [finalizationDate, setFinalizationDate] = useState(new Date().toISOString().split('T')[0]);
  const [reworkOrder, setReworkOrder] = useState<Order | null>(null);
  const [reworkReason, setReworkReason] = useState<'novo produto' | 'ajuste' | 'falta de peças'>('ajuste');
  const [reworkNotes, setReworkNotes] = useState('');
  const [editingFinalizedOrder, setEditingFinalizedOrder] = useState<Order | null>(null);
  const [editFinalDate, setEditFinalDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Agendamento em lote
  const [showBatchScheduleModal, setShowBatchScheduleModal] = useState(false);
  const [batchScheduleData, setBatchScheduleData] = useState<{ date: string; time: string; installerIds: string[] }>({
    date: '',
    time: '',
    installerIds: []
  });

  // Garantia
  const [warrantyOrder, setWarrantyOrder] = useState<Order | null>(null);
  const [warrantyReason, setWarrantyReason] = useState<'novo produto' | 'ajuste' | 'falta de peças' | 'visita'>('ajuste');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [warrantyVisitData, setWarrantyVisitData] = useState<{ date: string; time: string; installerIds: string[] }>({
    date: '',
    time: '',
    installerIds: []
  });

  // Pedidos prontos para instalar (INSTALLATION no PCP e ainda não finalizados)
  const pendingOrders = orders.filter(o =>
    o.productionStage === ProductionStage.INSTALLATION
  ).filter(o => {
    const customer = customers.find(c => c.id === o.customerId);
    return customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
  });

  // Pedidos finalizados (READY no PCP)
  const historyOrders = orders.filter(o =>
    o.productionStage === ProductionStage.READY
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
      installerIds: scheduleData.installerIds
    };

    onUpdateOrder(updatedOrder);

    const newApp: Appointment = {
      id: crypto.randomUUID(),
      customerId: selectedOrderForSchedule.customerId,
      orderId: selectedOrderForSchedule.id,
      sellerId: selectedOrderForSchedule.sellerId,
      installerIds: scheduleData.installerIds,
      date: scheduleData.date,
      time: scheduleData.time,
      type: 'INSTALLATION',
      status: 'SCHEDULED'
    };

    onAddAppointment(newApp);
    setSelectedOrderForSchedule(null);
    setScheduleData({ date: '', time: '', installerIds: [] });
  };

  const handlePrintFicha = (order: Order) => {
    setPrintOrdersList([order]);
    setTimeout(() => {
      if (printRef.current) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const content = printRef.current.innerHTML;
        printWindow.document.write(`
          <html>
            <head>
              <title>Ficha de Instalação - ${order.contractNumber || order.quoteNumber || order.id}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print { 
                  body { padding: 0; }
                  .page-break { page-break-before: always; }
                }
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

  const handlePrintRomaneio = () => {
    if (selectedOrders.length === 0) return;
    const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id));
    setPrintOrdersList(selectedOrdersData);
    setTimeout(() => {
      if (printRef.current) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const content = printRef.current.innerHTML;
        printWindow.document.write(`
          <html>
            <head>
              <title>Romaneio de Instalações</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print { 
                  body { padding: 0; }
                  .page-break { page-break-before: always; }
                }
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

  const handleFinalize = async (order: Order, date: string) => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const newHistory = [
        ...(order.productionHistory || []),
        { stage: ProductionStage.READY, timestamp: now, notes: `Finalizado pela administração em: ${formatDisplayDate(date)}` }
      ];
      const updatedOrder = {
        ...order,
        productionStage: ProductionStage.READY,
        productionHistory: newHistory,
        finalizedAt: date,
        status: 'DELIVERED' as any
      };
      
      await dataService.saveOrder(updatedOrder);
      await dataService.updateProductionStage(order.id, ProductionStage.READY, newHistory);
      onUpdateOrder(updatedOrder);

      // Notificar Financeiro
      await notificationService.notifyFinanceAboutInstallation(updatedOrder);

      // Trigger automated payment notification for the second installment (2/X)
      notificationService.sendAutomatedPaymentNotification(updatedOrder, 2);

      alert("Instalação finalizada e financeiro notificado!");
      setFinalizingOrder(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar instalação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRework = async (order: Order, reason: 'novo produto' | 'ajuste' | 'falta de peças', notes: string) => {
    setIsLoading(true);
    try {
      const userJson = localStorage.getItem('rtc_user');
      const currentUser = userJson ? JSON.parse(userJson) : null;
      const createdBy = currentUser?.id || '00000000-0000-0000-0000-000000000000';

      try {
        await dataService.saveRework({
          orderId: order.id,
          reason: reason,
          description: notes,
          createdBy: createdBy
        });
      } catch (reworkErr) {
        console.warn('Aviso: falha ao salvar na tabela reworks (continuando com atualização do pedido)...', reworkErr);
      }

      const targetStage = reason === 'novo produto' ? ProductionStage.NEW_ORDER : ProductionStage.ASSEMBLY;
      const newHistory = [
        ...(order.productionHistory || []),
        { stage: targetStage, timestamp: new Date().toISOString(), notes: `[RETRABALHO ADM]: ${reason} - ${notes}` }
      ];

      const updatedOrder = {
        ...order,
        productionStage: targetStage,
        productionHistory: newHistory,
        isRework: true,
        reworkReason: reason,
        contractObservations: `${order.contractObservations || ''}\n[RETRABALHO ADM]: ${reason} - ${notes}`
      };

      await dataService.saveOrder(updatedOrder);
      await dataService.updateProductionStage(order.id, targetStage, newHistory);
      onUpdateOrder(updatedOrder);

      alert("Retrabalho registrado com sucesso e enviado ao PCP!");
      setReworkOrder(null);
      setReworkNotes('');
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar retrabalho.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFinalizedDate = async (order: Order, newDate: string) => {
    setIsLoading(true);
    try {
      const updatedOrder = {
        ...order,
        finalizedAt: newDate
      };
      await dataService.saveOrder(updatedOrder);
      onUpdateOrder(updatedOrder);
      alert("Data de finalização atualizada com sucesso!");
      setEditingFinalizedOrder(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar data de finalização.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchSchedule = async () => {
    if (!batchScheduleData.date || !batchScheduleData.time) {
      alert('Selecione data e hora para o agendamento em lote.');
      return;
    }
    setIsLoading(true);
    try {
      const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id));
      for (const order of selectedOrdersData) {
        const updatedOrder: Order = {
          ...order,
          installationDate: batchScheduleData.date,
          installationTime: batchScheduleData.time,
          installerIds: batchScheduleData.installerIds
        };
        await dataService.saveOrder(updatedOrder);
        onUpdateOrder(updatedOrder);
        const newApp: Appointment = {
          id: crypto.randomUUID(),
          customerId: order.customerId,
          orderId: order.id,
          sellerId: order.sellerId,
          installerIds: batchScheduleData.installerIds,
          date: batchScheduleData.date,
          time: batchScheduleData.time,
          type: 'INSTALLATION',
          status: 'SCHEDULED'
        };
        onAddAppointment(newApp);
      }
      alert(`${selectedOrdersData.length} instalações agendadas com sucesso!`);
      setShowBatchScheduleModal(false);
      setSelectedOrders([]);
      setBatchScheduleData({ date: '', time: '', installerIds: [] });
    } catch (err) {
      console.error(err);
      alert('Erro ao agendar em lote.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWarranty = async (order: Order, reason: 'novo produto' | 'ajuste' | 'falta de peças' | 'visita', notes: string) => {
    setIsLoading(true);
    try {
      const userJson = localStorage.getItem('rtc_user');
      const currentUser = userJson ? JSON.parse(userJson) : null;
      const createdBy = currentUser?.id || '00000000-0000-0000-0000-000000000000';

      // Caso especial: resolver com visita (não vai para o PCP)
      if (reason === 'visita') {
        if (!warrantyVisitData.date || !warrantyVisitData.time) {
          alert('Selecione data e hora para a visita de garantia.');
          setIsLoading(false);
          return;
        }
        const newHistory = [
          ...(order.productionHistory || []),
          { stage: order.productionStage, timestamp: new Date().toISOString(), notes: `[GARANTIA - VISITA]: ${notes} | Agendada para ${formatDisplayDate(warrantyVisitData.date)} às ${warrantyVisitData.time}` }
        ];
        const updatedOrder = {
          ...order,
          productionHistory: newHistory,
          installationDate: warrantyVisitData.date,
          installationTime: warrantyVisitData.time,
          installerIds: warrantyVisitData.installerIds,
          contractObservations: `${order.contractObservations || ''}\n[GARANTIA - VISITA]: ${notes}`
        };
        await dataService.saveOrder(updatedOrder);
        onUpdateOrder(updatedOrder);
        const newApp: Appointment = {
          id: crypto.randomUUID(),
          customerId: order.customerId,
          orderId: order.id,
          sellerId: order.sellerId,
          installerIds: warrantyVisitData.installerIds,
          date: warrantyVisitData.date,
          time: warrantyVisitData.time,
          type: 'INSTALLATION',
          status: 'SCHEDULED'
        };
        onAddAppointment(newApp);
        alert('Visita de garantia agendada com sucesso!');
        setWarrantyOrder(null);
        setWarrantyNotes('');
        setWarrantyVisitData({ date: '', time: '', installerIds: [] });
        return;
      }

      try {
        await dataService.saveRework({
          orderId: order.id,
          reason: reason,
          description: `[GARANTIA] ${notes}`,
          createdBy: createdBy
        });
      } catch (reworkErr) {
        console.warn('Aviso: falha ao salvar garantia na tabela reworks (continuando com atualização do pedido)...', reworkErr);
      }

      const targetStage = reason === 'novo produto' ? ProductionStage.NEW_ORDER : ProductionStage.ASSEMBLY;
      const newHistory = [
        ...(order.productionHistory || []),
        { stage: targetStage, timestamp: new Date().toISOString(), notes: `[GARANTIA ADM]: ${reason} - ${notes}` }
      ];

      const updatedOrder = {
        ...order,
        productionStage: targetStage,
        productionHistory: newHistory,
        isRework: true,
        reworkReason: `garantia: ${reason}` as any,
        contractObservations: `${order.contractObservations || ''}\n[GARANTIA ADM]: ${reason} - ${notes}`
      };

      await dataService.saveOrder(updatedOrder);
      await dataService.updateProductionStage(order.id, targetStage, newHistory);
      onUpdateOrder(updatedOrder);

      alert('Garantia registrada e enviada ao PCP!');
      setWarrantyOrder(null);
      setWarrantyNotes('');
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar garantia.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agenda de Instalações</h2>
          <p className="text-slate-500">Gestão de pedidos prontos para entrega e montagem externa.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'pending' && selectedOrders.length > 0 && (
            <>
              <button
                onClick={() => {
                  setBatchScheduleData({ date: '', time: '', installerIds: [] });
                  setShowBatchScheduleModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-all shadow-lg active:scale-95 animate-in fade-in"
              >
                <Calendar size={18} /> Agendar em Lote ({selectedOrders.length})
              </button>
              <button
                onClick={handlePrintRomaneio}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95 animate-in fade-in"
              >
                <Printer size={18} /> Imprimir Romaneio ({selectedOrders.length})
              </button>
            </>
          )}
          <button
            onClick={() => {
              setSelectedOrderForSchedule(null);
              setScheduleData({ date: '', time: '', installerIds: [] });
              setShowManualModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            <Truck size={18} /> Nova Instalação
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('pending');
            setSelectedOrders([]);
          }}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-colors ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck size={16} /> Instalações Pendentes
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            setSelectedOrders([]);
          }}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={16} /> Histórico de Instalações
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente ou contrato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {activeTab === 'pending' && pendingOrders.length > 0 && (
          <button
            onClick={() => {
              if (selectedOrders.length === pendingOrders.length) {
                setSelectedOrders([]);
              } else {
                setSelectedOrders(pendingOrders.map(o => o.id));
              }
            }}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {selectedOrders.length === pendingOrders.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(activeTab === 'pending' ? pendingOrders : historyOrders).length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 opacity-60">
            <Truck size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium italic">
              {activeTab === 'pending' ? 'Nenhum pedido aguardando instalação.' : 'Nenhum histórico de instalação encontrado.'}
            </p>
          </div>
        ) : (
          (activeTab === 'pending' ? pendingOrders : historyOrders).map(order => {
            const customer = customers.find(c => c.id === order.customerId);
            const isScheduled = !!order.installationDate;
            const isSelected = selectedOrders.includes(order.id);

            return (
              <div
                key={order.id}
                className={`bg-white p-6 rounded-3xl border ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                } shadow-sm hover:shadow-xl transition-all group overflow-hidden relative`}
              >
                {activeTab === 'pending' && (
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedOrders(prev =>
                          prev.includes(order.id)
                            ? prev.filter(id => id !== order.id)
                            : [...prev, order.id]
                        );
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                    />
                  </div>
                )}

                <div className={`absolute top-0 right-0 px-4 py-1 text-[9px] font-black uppercase tracking-widest ${
                  order.productionStage === ProductionStage.READY
                    ? 'bg-emerald-100 text-emerald-700'
                    : isScheduled ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {order.productionStage === ProductionStage.READY
                    ? 'Finalizado'
                    : isScheduled ? 'Agendado' : 'Aguardando'}
                </div>

                <div className={`flex items-center gap-3 mb-6 ${activeTab === 'pending' ? 'pl-6' : ''}`}>
                  <div className={`p-3 rounded-2xl ${
                    order.productionStage === ProductionStage.READY
                      ? 'bg-emerald-50 text-emerald-600'
                      : isScheduled ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Truck size={24} />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">RTC TOLDOS E COBERTURAS LTDA</p>
                    <h3 className="font-bold text-slate-900 truncate w-48">{customer?.name}</h3>
                    {order.isRework && (
                      <span className="inline-block text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full mt-1 uppercase animate-pulse">
                        Retrabalho: {order.reworkReason}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{customer?.address.neighborhood}, {customer?.address.city}</span>
                  </div>

                  {activeTab === 'pending' ? (
                    isScheduled ? (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <Calendar size={12} className="text-blue-500" /> {formatDisplayDate(order.installationDate!)}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <Clock size={12} className="text-blue-500" /> {order.installationTime}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <HardHat size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {order.installerIds && order.installerIds.length > 0
                              ? order.installerIds.map((id: string) => installers.find((i: Installer) => i.id === id)?.name).filter(Boolean).join(', ')
                              : 'Equipe não definida'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 px-3 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={12} /> Pedido pronto para agendar
                      </div>
                    )
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500" /> Finalizado em:
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px]">
                          {order.finalizedAt ? formatDisplayDate(order.finalizedAt) : 'Sem data'}
                        </span>
                      </div>
                      {order.installationDate && (
                        <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-1.5">
                          <Calendar size={11} /> Instalado em: {formatDisplayDate(order.installationDate)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <HardHat size={11} className="shrink-0" />
                        <span className="truncate">
                          {order.installerIds && order.installerIds.length > 0
                            ? order.installerIds.map((id: string) => installers.find((i: Installer) => i.id === id)?.name).filter(Boolean).join(', ')
                            : 'Equipe não definida'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {activeTab === 'pending' ? (
                  <div className="space-y-2">
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

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => {
                          setFinalizingOrder(order);
                          setFinalizationDate(new Date().toISOString().split('T')[0]);
                        }}
                        className="flex items-center justify-center gap-2 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 size={14} /> Finalizar
                      </button>
                      <button
                        onClick={() => {
                          setReworkOrder(order);
                          setReworkReason('ajuste');
                          setReworkNotes('');
                        }}
                        className="flex items-center justify-center gap-2 py-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"
                      >
                        <RotateCcw size={14} /> Retrabalho
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handlePrintFicha(order)}
                        className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        <Printer size={14} /> Ficha
                      </button>
                      <button
                        onClick={() => {
                          setEditingFinalizedOrder(order);
                          setEditFinalDate(order.finalizedAt || new Date().toISOString().split('T')[0]);
                        }}
                        className="flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg"
                      >
                        <Edit2 size={14} /> Editar Data
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setWarrantyOrder(order);
                        setWarrantyReason('ajuste');
                        setWarrantyNotes('');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      <RotateCcw size={14} /> Garantia
                    </button>
                  </div>
                )}
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Instaladores Escalados</label>
                <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  {installers.filter((i: Installer) => i.active).map((i: Installer) => (
                    <label key={i.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={scheduleData.installerIds.includes(i.id)}
                        onChange={(e) => {
                          const current = scheduleData.installerIds;
                          const next = e.target.checked
                            ? [...current, i.id]
                            : current.filter(id => id !== i.id);
                          setScheduleData({ ...scheduleData, installerIds: next });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-slate-700">{i.name}</span>
                    </label>
                  ))}
                  {installers.filter((i: Installer) => i.active).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">Nenhum instalador ativo cadastrado.</p>
                  )}
                </div>
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

      {/* Modal de Finalizar Instalação */}
      {finalizingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Finalizar Instalação</h3>
              <button onClick={() => setFinalizingOrder(null)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data da Finalização</label>
                <input
                  type="date"
                  value={finalizationDate}
                  onChange={(e) => setFinalizationDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>
              <button
                disabled={isLoading}
                onClick={() => handleFinalize(finalizingOrder, finalizationDate)}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Confirmando...' : 'Confirmar Conclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Registrar Retrabalho */}
      {reworkOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Registrar Retrabalho</h3>
              <button onClick={() => setReworkOrder(null)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Tipo de Retrabalho</label>
                <select
                  value={reworkReason}
                  onChange={(e: any) => setReworkReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  <option value="novo produto">Novo Produto (Envia para Novos Pedidos no PCP)</option>
                  <option value="falta de peças">Corte / Falta de Peças (Envia para Montagem no PCP)</option>
                  <option value="ajuste">Ajuste técnico (Envia para Montagem no PCP)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Observações / Problema</label>
                <textarea
                  rows={4}
                  value={reworkNotes}
                  onChange={(e) => setReworkNotes(e.target.value)}
                  placeholder="Descreva detalhadamente o problema ou o que precisa ser refeito..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                />
              </div>
              <button
                disabled={isLoading}
                onClick={() => handleSendRework(reworkOrder, reworkReason, reworkNotes)}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-500/30 hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Registrando...' : 'Confirmar e Enviar para PCP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Data de Finalização */}
      {editingFinalizedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Editar Data da Conclusão</h3>
              <button onClick={() => setEditingFinalizedOrder(null)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Nova Data</label>
                <input
                  type="date"
                  value={editFinalDate}
                  onChange={(e) => setEditFinalDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>
              <button
                disabled={isLoading}
                onClick={() => handleUpdateFinalizedDate(editingFinalizedOrder, editFinalDate)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Atualizando...' : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamento em Lote */}
      {showBatchScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Agendar em Lote</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedOrders.length} instalações selecionadas</p>
              </div>
              <button onClick={() => setShowBatchScheduleModal(false)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Instaladores Escalados</label>
                <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  {installers.filter((i: Installer) => i.active).map((i: Installer) => (
                    <label key={i.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={batchScheduleData.installerIds.includes(i.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...batchScheduleData.installerIds, i.id]
                            : batchScheduleData.installerIds.filter(id => id !== i.id);
                          setBatchScheduleData({ ...batchScheduleData, installerIds: next });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-slate-700">{i.name}</span>
                    </label>
                  ))}
                  {installers.filter((i: Installer) => i.active).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">Nenhum instalador ativo cadastrado.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data</label>
                  <input
                    type="date"
                    value={batchScheduleData.date}
                    onChange={(e) => setBatchScheduleData({ ...batchScheduleData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Hora</label>
                  <input
                    type="time"
                    value={batchScheduleData.time}
                    onChange={(e) => setBatchScheduleData({ ...batchScheduleData, time: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>
              <button
                disabled={isLoading}
                onClick={handleBatchSchedule}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Agendando...' : `Confirmar Agendamento (${selectedOrders.length} pedidos)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Garantia */}
      {warrantyOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-amber-900">Registrar Garantia</h3>
              <button onClick={() => setWarrantyOrder(null)} className="p-2 text-amber-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Tipo de Garantia</label>
                <select
                  value={warrantyReason}
                  onChange={(e: any) => setWarrantyReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  <option value="visita">Resolver com Visita (Agenda instaladores, sem ir ao PCP)</option>
                  <option value="ajuste">Ajuste técnico (Envia para Montagem no PCP)</option>
                  <option value="falta de peças">Corte / Falta de Peças (Envia para Montagem no PCP)</option>
                  <option value="novo produto">Novo Produto (Envia para Novos Pedidos no PCP)</option>
                </select>
              </div>

              {/* Campos de agendamento de visita */}
              {warrantyReason === 'visita' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Instaladores</label>
                    <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      {installers.filter((i: Installer) => i.active).map((i: Installer) => (
                        <label key={i.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={warrantyVisitData.installerIds.includes(i.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...warrantyVisitData.installerIds, i.id]
                                : warrantyVisitData.installerIds.filter(id => id !== i.id);
                              setWarrantyVisitData({ ...warrantyVisitData, installerIds: next });
                            }}
                            className="w-4 h-4 text-amber-600 rounded"
                          />
                          <span className="text-sm font-medium text-slate-700">{i.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data da Visita</label>
                      <input
                        type="date"
                        value={warrantyVisitData.date}
                        onChange={(e) => setWarrantyVisitData({ ...warrantyVisitData, date: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Hora</label>
                      <input
                        type="time"
                        value={warrantyVisitData.time}
                        onChange={(e) => setWarrantyVisitData({ ...warrantyVisitData, time: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Descrição do Problema</label>
                <textarea
                  rows={3}
                  value={warrantyNotes}
                  onChange={(e) => setWarrantyNotes(e.target.value)}
                  placeholder="Descreva o problema de garantia relatado pelo cliente..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                />
              </div>
              <button
                disabled={isLoading}
                onClick={() => handleSendWarranty(warrantyOrder, warrantyReason, warrantyNotes)}
                className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold shadow-xl shadow-amber-500/30 hover:bg-amber-700 transition-all disabled:opacity-50"
              >
                {isLoading
                  ? 'Registrando...'
                  : warrantyReason === 'visita'
                  ? 'Confirmar Visita de Garantia'
                  : 'Confirmar e Enviar para PCP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template de Impressão (Escondido) */}
      <div className="hidden">
        <div ref={printRef} className="p-6 text-slate-900">
          {printOrdersList.map((printOrder, index) => (
            <div key={printOrder.id} className={index > 0 ? 'page-break mt-10 border-t-2 border-dashed border-slate-400 pt-10' : ''}>
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <h1 className="text-3xl font-black uppercase tracking-tighter">Ficha de Instalação</h1>
                  <p className="text-xl font-bold text-slate-600 mt-2">RTC TOLDOS E COBERTURAS LTDA</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black uppercase">Contrato Nº</p>
                  <p className="text-3xl font-black text-blue-600">{printOrder?.contractNumber || printOrder?.quoteNumber || printOrder?.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
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
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                    <p className="text-sm font-bold">Data: <span className="font-black">{printOrder?.installationDate ? formatDisplayDate(printOrder.installationDate) : 'A DEFINIR'}</span></p>
                    <p className="text-sm font-bold mt-1">Horário: <span className="font-black">{printOrder?.installationTime || '--:--'}</span></p>
                    <p className="text-sm font-bold mt-1">Equipe: <span className="font-black">
                      {printOrder?.installerIds?.map((id: string) => installers.find((i: Installer) => i.id === id)?.name).filter(Boolean).join(', ') || 'A DEFINIR'}
                    </span></p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
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
                          <td className="border border-slate-300 p-2 text-sm font-bold">{item.environment}</td>
                          <td className="border border-slate-300 p-2 text-sm">{products.find(p => p.id === item.productId)?.nome}</td>
                          <td className="border border-slate-300 p-2 text-sm text-center font-bold uppercase">{item.color || '-'}</td>
                          <td className="border border-slate-300 p-2 text-sm text-center font-mono font-black">{item.width.toFixed(3)}m x {item.height.toFixed(3)}m</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-10 mt-10">
                <div className="text-center pt-8 border-t border-slate-400">
                  <p className="text-[10px] font-black uppercase">Instalador Responsável</p>
                </div>
                <div className="text-center pt-8 border-t border-slate-400">
                  <p className="text-[10px] font-black uppercase">Visto do Cliente (Pós-Instalação)</p>
                </div>
              </div>

              <div className="mt-10 p-6 bg-slate-900 text-white rounded-2xl">
                <h3 className="text-xs font-black uppercase tracking-widest mb-2">Checklist do Instalador</h3>
                <div className="grid grid-cols-2 gap-4">
                  <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Verificado fixação e prumo</p>
                  <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Testado abertura e fechamento</p>
                  <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Ambiente limpo após o serviço</p>
                  <p className="text-[10px] flex items-center gap-2"><div className="w-3 h-3 border border-white"></div> Instruções de uso passadas ao cliente</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Instalação Avulsa */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Nova Instalação Avulsa</h3>
              <button onClick={() => setShowManualModal(false)} className="p-2 text-slate-400 hover:text-rose-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* Seleção de Cliente */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">1. Selecione o Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Nome do cliente..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {customerSearch && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-xl bg-white shadow-sm divide-y divide-slate-50">
                    {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setManualSelection({ ...manualSelection, customerId: c.id, orderId: '' });
                          setCustomerSearch(c.name);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${manualSelection.customerId === c.id ? 'bg-blue-50 font-bold text-blue-600' : 'text-slate-600'}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Seleção de Contrato (Opcional) */}
              {manualSelection.customerId && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">2. Selecione o Contrato (Opcional)</label>
                  <select
                    value={manualSelection.orderId}
                    onChange={(e) => setManualSelection({ ...manualSelection, orderId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sem contrato vinculado</option>
                    {orders.filter(o => o.customerId === manualSelection.customerId).map(o => (
                      <option key={o.id} value={o.id}>Contrato #{o.id} - R$ {o.totalValue.toLocaleString('pt-BR')}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Programação */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Data</label>
                  <input
                    type="date"
                    value={scheduleData.date}
                    onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Hora</label>
                  <input
                    type="time"
                    value={scheduleData.time}
                    onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Equipe */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Equipe de Instaladores</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {installers.filter(i => i.active).map(i => (
                    <label key={i.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${scheduleData.installerIds.includes(i.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={scheduleData.installerIds.includes(i.id)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...scheduleData.installerIds, i.id] : scheduleData.installerIds.filter(id => id !== i.id);
                          setScheduleData({ ...scheduleData, installerIds: next });
                        }}
                      />
                      <span className="text-xs font-bold">{i.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!manualSelection.customerId || !scheduleData.date || !scheduleData.time) {
                    alert('Por favor, selecione o cliente, data e hora.');
                    return;
                  }

                  const selectedOrder = orders.find(o => o.id === manualSelection.orderId);

                  const newApp: Appointment = {
                    id: crypto.randomUUID(),
                    customerId: manualSelection.customerId,
                    orderId: manualSelection.orderId || undefined,
                    sellerId: selectedOrder?.sellerId || 'legacy-rtc', // Fallback
                    installerIds: scheduleData.installerIds,
                    date: scheduleData.date,
                    time: scheduleData.time,
                    type: 'INSTALLATION',
                    status: 'SCHEDULED'
                  };

                  onAddAppointment(newApp);

                  if (selectedOrder) {
                    onUpdateOrder({
                      ...selectedOrder,
                      installationDate: scheduleData.date,
                      installationTime: scheduleData.time,
                      installerIds: scheduleData.installerIds
                    });
                  }

                  setShowManualModal(false);
                  setManualSelection({ customerId: '', orderId: '' });
                  setScheduleData({ date: '', time: '', installerIds: [] });
                  setCustomerSearch('');
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
              >
                Confirmar Agendamento Avulso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Installations;
