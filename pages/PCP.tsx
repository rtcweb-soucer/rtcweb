
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Order, OrderStatus, ProductionStage, ProductionHistoryEntry, Product, Seller, Customer } from '../types';
import { dataService } from '../services/dataService';
import ProductionSheetPrint from '../components/ProductionSheetPrint';
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronRight,
  Factory,
  Truck,
  Scissors,
  Hammer,
  Boxes,
  ClipboardList,
  ChevronLeft,
  ArrowRightCircle,
  AlertCircle,
  Printer,
  X,
  Users,
  User as UserIcon,
  Calendar
} from 'lucide-react';

interface PCPProps {
  orders: Order[];
  products: Product[];
  sellers: Seller[];
  customers: Customer[];
  onUpdateOrder: (updatedOrder: Order) => void;
  onSelectCustomer: (customerId: string) => void;
}

const STAGES_CONFIG = [
  { id: ProductionStage.NEW_ORDER, icon: <ClipboardList size={16} />, color: 'bg-indigo-500' },
  { id: ProductionStage.PREPARATION, icon: <Clock size={16} />, color: 'bg-amber-500' },
  { id: ProductionStage.PROVISIONING, icon: <Boxes size={16} />, color: 'bg-blue-500' },
  { id: ProductionStage.CUTTING_WELDING, icon: <Scissors size={16} />, color: 'bg-rose-500' },
  { id: ProductionStage.ASSEMBLY, icon: <Hammer size={16} />, color: 'bg-emerald-500' },
  { id: ProductionStage.INSTALLATION, icon: <Truck size={16} />, color: 'bg-slate-700' }
];

const PCP = ({ orders, products, sellers, customers, onUpdateOrder, onSelectCustomer }: PCPProps) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  /* REMOVED OLD LOGIC */
  // Internal state for orders with production tracking
  const [pcpOrders, setPcpOrders] = useState<Order[]>([]);

  // Reload data when component mounts or orders prop changes (if we want to keep sync)
  useEffect(() => {
    loadPcpData();
  }, [orders]);

  const loadPcpData = async () => {
    try {
      const data = await dataService.getPCPOrders();
      setPcpOrders(data);
    } catch (error) {
      console.error("Error loading PCP data:", error);
    }
  };

  const handleAdvanceStage = async (orderId: string) => {
    const order = pcpOrders.find((o: Order) => o.id === orderId);
    if (!order) return;

    const currentStage = order.productionStage || ProductionStage.NEW_ORDER;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);

    let nextStage: ProductionStage;

    if (currentIndex < STAGES_CONFIG.length - 1) {
      nextStage = STAGES_CONFIG[currentIndex + 1].id;
    } else if (currentIndex === STAGES_CONFIG.length - 1) {
      nextStage = ProductionStage.READY;
    } else {
      return;
    }

    const historyEntry: ProductionHistoryEntry = {
      stage: nextStage,
      timestamp: new Date()
    };

    const newHistory = [...(order.productionHistory || []), historyEntry];

    // Optimistic Update
    const updatedOrder = { ...order, productionStage: nextStage, productionHistory: newHistory };

    // Auto-update order status based on stage
    if (order.status === OrderStatus.CONTRACT_SIGNED) {
      updatedOrder.status = OrderStatus.IN_PRODUCTION;
    }

    if (nextStage === ProductionStage.READY) {
      updatedOrder.status = OrderStatus.FINISHED;
    }

    const updatedOrders = pcpOrders.map(o => o.id === orderId ? updatedOrder : o);
    setPcpOrders(updatedOrders);

    try {
      // First update the production tracking
      await dataService.updateProductionStage(orderId, nextStage, newHistory);

      // Then sync the main order status if changed
      if (updatedOrder.status !== order.status) {
        await dataService.saveOrder(updatedOrder);
      }

      // Always notify global state of the change
      onUpdateOrder(updatedOrder);
    } catch (error) {
      console.error("Failed to update stage:", error);
      // Revert if failed
      loadPcpData();
    }
  };

  const handleRegressStage = async (orderId: string) => {
    const order = pcpOrders.find((o: Order) => o.id === orderId);
    if (!order) return;

    const currentStage = order.productionStage;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);

    if (currentIndex > 0) {
      const prevStage = STAGES_CONFIG[currentIndex - 1].id;

      const historyEntry: ProductionHistoryEntry = {
        stage: prevStage,
        timestamp: new Date()
      };

      const newHistory = [...(order.productionHistory || []), historyEntry];

      // Optimistic Update
      const updatedOrder = { ...order, productionStage: prevStage, productionHistory: newHistory };
      const updatedOrders = pcpOrders.map(o => o.id === orderId ? updatedOrder : o);
      setPcpOrders(updatedOrders);

      try {
        await dataService.updateProductionStage(orderId, prevStage, newHistory);
        // Sync global state
        onUpdateOrder(updatedOrder);
      } catch (error) {
        console.error("Failed to regress stage:", error);
        loadPcpData();
      }
    }
  };

  const handlePrintProductionSheet = async (orderId: string) => {
    try {
      const data = await dataService.getOrderProductionData(orderId);
      setPrintData(data);
      setShowPrintModal(true);
    } catch (error) {
      console.error('Error loading production data:', error);
      alert('Erro ao carregar dados para impressão: ' + (error as Error).message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setPrintData(null);
  };

  return (
    <div className="space-y-6 max-h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">PCP - Planejamento e Controle</h2>
          <p className="text-slate-500 text-sm">Acompanhe o fluxo fabril e gerencie o provisionamento.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Fluxo Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Lista Geral
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="flex gap-5 min-w-max h-full">
          {STAGES_CONFIG.map((stage: any) => {
            const stageOrders = pcpOrders.filter((o: Order) => o.productionStage === stage.id);

            return (
              <div key={stage.id} className="w-80 flex flex-col gap-4">
                {/* Cabeçalho da Coluna */}
                <div className="flex items-center justify-between px-2">
                  <h4 className="flex items-center gap-2.5 font-black text-slate-700 text-xs uppercase tracking-widest">
                    <div className={`p-1.5 rounded-lg text-white ${stage.color}`}>
                      {stage.icon}
                    </div>
                    {stage.id}
                  </h4>
                  <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {stageOrders.length}
                  </span>
                </div>

                {/* Área dos Cards */}
                <div className="flex-1 bg-slate-100/40 border border-slate-200 rounded-3xl p-3 space-y-3 min-h-[500px] overflow-y-auto">
                  {stageOrders.map((order: Order) => (
                    <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mb-1">CONTRATO #{order.id}</span>
                          <p className="text-sm font-black text-slate-900 leading-tight">Pedido de Produção</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Factory size={14} />
                        </div>
                      </div>

                      <div className="space-y-2.5 mb-4">
                        <button
                          onClick={() => onSelectCustomer(order.customerId)}
                          className="flex items-center gap-2 text-[11px] text-slate-700 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all w-full text-left group/cust"
                        >
                          <Users size={12} className="text-blue-500 group-hover/cust:scale-110 transition-transform" />
                          <span className="truncate">{customers.find(c => c.id === order.customerId)?.name || 'Cliente Desconhecido'}</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Vendedor</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                              <UserIcon size={10} className="text-slate-400" />
                              <span className="truncate">{sellers.find(s => s.id === order.sellerId)?.name || 'Vendedor RTC'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Data Pedido</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                              <Calendar size={10} className="text-slate-400" />
                              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Prazo de Entrega</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-900">
                              <Truck size={12} className="text-amber-500" />
                              <span>{order.installationDate ? new Date(order.installationDate).toLocaleDateString() : 'Não definida'}</span>
                            </div>
                          </div>
                          {order.installationDate && new Date(order.installationDate) < new Date() && (
                            <AlertCircle size={14} className="text-rose-500 animate-pulse" />
                          )}
                        </div>
                      </div>

                      {/* Controles de Movimentação (Forward/Encaminhar) */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                        <button
                          onClick={() => handlePrintProductionSheet(order.id)}
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                          title="Imprimir Ficha de Produção"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => handleRegressStage(order.id)}
                          disabled={stage.id === ProductionStage.NEW_ORDER}
                          className="p-2 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Voltar Etapa"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => handleAdvanceStage(order.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10"
                        >
                          Encaminhar <ArrowRightCircle size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {stageOrders.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl gap-2 bg-white/50">
                      <Package size={24} className="text-slate-200" />
                      <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Aguardando Itens</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Informativo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs font-bold text-slate-600">Provisionado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs font-bold text-slate-600">Em Alerta</span>
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total em produção: {pcpOrders.length} pedidos</p>
      </div>

      {/* Print Modal */}
      {showPrintModal && printData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-[900px] w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-3xl flex items-center justify-between z-10 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Printer size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Ficha de Produção e Instalação</h3>
                  <p className="text-xs text-blue-100 font-medium">Preview para impressão</p>
                </div>
              </div>
              <button
                onClick={closePrintModal}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors no-print"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            <div className="p-6">
              <ProductionSheetPrint data={printData} products={products} />
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 rounded-b-3xl flex gap-3 no-print">
              <button
                onClick={closePrintModal}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCP;
