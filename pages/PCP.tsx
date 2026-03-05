
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Order, OrderStatus, ProductionStage, ProductionHistoryEntry, Product, Seller, Customer } from '../types';
import { formatBusinessDate } from '../utils/dateUtils';
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
  Calendar,
  ShoppingCart,
  Plus,
  Trash2
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
  const printRef = React.useRef<HTMLDivElement>(null);

  // Módulo de Compras (Requisição de Material)
  const [showRequestMaterialModal, setShowRequestMaterialModal] = useState(false);
  const [requestMaterialOrder, setRequestMaterialOrder] = useState<Order | null>(null);
  const [requestMaterialItems, setRequestMaterialItems] = useState([{ name: '', quantity: 1, unit: 'un' }]);
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

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
    if (printRef.current) {
      const htmlContent = printRef.current.innerHTML;
      import('../components/ProductionSheetPrint').then(mod => {
        mod.printHTML(htmlContent);
      });
    }
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setPrintData(null);
  };

  // Funções para Requisição de Material
  const handleOpenRequestMaterial = (order: Order) => {
    setRequestMaterialOrder(order);
    setRequestMaterialItems([{ name: '', quantity: 1, unit: 'un' }]);
    setRequestNotes('');
    setShowRequestMaterialModal(true);
  };

  const handleCloseRequestMaterial = () => {
    setShowRequestMaterialModal(false);
    setRequestMaterialOrder(null);
  };

  const handleSaveRequestMaterial = async () => {
    if (!requestMaterialOrder) return;

    // Validate
    const validItems = requestMaterialItems.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      alert("Adicione pelo menos um item válido com nome.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await dataService.savePurchaseRequest({
        id: crypto.randomUUID(),
        order_id: requestMaterialOrder.id,
        requester_name: 'PCP', // ideal seria pegar logado
        items_requested: validItems,
        status: 'PENDING',
        notes: requestNotes
      });
      alert('Solicitação de material enviada ao Comprador com sucesso!');
      handleCloseRequestMaterial();
    } catch (error) {
      console.error('Failed to save purchase request:', error);
      alert('Erro ao enviar solicitação.');
    } finally {
      setIsSubmittingRequest(false);
    }
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
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mb-1">
                            {order.contractNumber || order.quoteNumber || order.id}
                          </span>
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
                              <span>{order.deliveryDeadline ? formatBusinessDate(order.deliveryDeadline) : (order.installationDate ? new Date(order.installationDate).toLocaleDateString() : 'Não definida')}</span>
                            </div>
                          </div>
                          {((order.deliveryDeadline && new Date(order.deliveryDeadline) < new Date()) || (!order.deliveryDeadline && order.installationDate && new Date(order.installationDate) < new Date())) && (
                            <AlertCircle size={14} className="text-rose-500 animate-pulse" />
                          )}
                        </div>
                      </div>

                      {stage.id === ProductionStage.PROVISIONING && (
                        <div className="mb-4">
                          <button
                            onClick={() => handleOpenRequestMaterial(order)}
                            className="w-full flex justify-center items-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors border border-indigo-200"
                          >
                            <ShoppingCart size={16} /> Solicitar Material
                          </button>
                        </div>
                      )}

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
                          className="ml-auto p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 group/btn"
                          title="Avançar Etapa"
                        >
                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter pr-1">
                            <span>Próxima</span>
                            <ChevronRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showPrintModal && printData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-[900px] w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-black text-slate-800">Visualizar Ficha de Produção</h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  <Printer size={18} /> Imprimir
                </button>
                <button
                  onClick={closePrintModal}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-x-auto">
              <ProductionSheetPrint ref={printRef} data={printData} products={products} />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={closePrintModal}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                <Printer size={18} /> Imprimir Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitar Material */}
      {showRequestMaterialModal && requestMaterialOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100/50">
            <div className="p-6 border-b border-slate-100/60 bg-white/50 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Solicitar Material (Compras)</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Pedido {requestMaterialOrder.contractNumber || requestMaterialOrder.quoteNumber} - {customers.find(c => c.id === requestMaterialOrder.customerId)?.name}
                </p>
              </div>
              <button onClick={handleCloseRequestMaterial} className="p-2.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-full text-slate-400 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 block">Itens Solicitados</label>
                  <div className="space-y-2">
                    {requestMaterialItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...requestMaterialItems];
                            newItems[index].name = e.target.value;
                            setRequestMaterialItems(newItems);
                          }}
                          placeholder="Nome do Material (ex: Lona Cristal)"
                          className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0 px-2"
                        />
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...requestMaterialItems];
                            newItems[index].quantity = Number(e.target.value);
                            setRequestMaterialItems(newItems);
                          }}
                          min="0.1"
                          step="0.1"
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-center px-1"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const newItems = [...requestMaterialItems];
                            newItems[index].unit = e.target.value;
                            setRequestMaterialItems(newItems);
                          }}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 px-1"
                        >
                          <option value="un">UN</option>
                          <option value="m">M</option>
                          <option value="m2">M²</option>
                          <option value="kg">KG</option>
                          <option value="cx">CX</option>
                        </select>
                        <button
                          onClick={() => {
                            const newItems = requestMaterialItems.filter((_, i) => i !== index);
                            setRequestMaterialItems(newItems.length ? newItems : [{ name: '', quantity: 1, unit: 'un' }]);
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setRequestMaterialItems([...requestMaterialItems, { name: '', quantity: 1, unit: 'un' }])}
                      className="w-full py-3 flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
                    >
                      <Plus size={16} /> Adicionar Item
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 block mt-6">Observações para o Comprador</label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Especifique urgência, fabricante preferido, etc..."
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex justify-end gap-3">
              <button
                onClick={handleCloseRequestMaterial}
                disabled={isSubmittingRequest}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRequestMaterial}
                disabled={isSubmittingRequest}
                className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingRequest ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><ShoppingCart size={18} /> Enviar ao Comprador</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCP;
