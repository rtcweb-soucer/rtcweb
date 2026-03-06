import React, { useState, useEffect } from 'react';
import { PurchaseRequest, PurchaseOrder, Order, Customer, FinancialTransaction } from '../types';
import { dataService } from '../services/dataService';
import {
    ShoppingCart,
    Clock,
    CheckCircle2,
    XCircle,
    Truck,
    Plus,
    Search,
    Filter,
    FileText,
    Calendar,
    DollarSign,
    User,
    X,
    RefreshCw
} from 'lucide-react';

interface BuyerProps {
    orders: Order[];
    customers: Customer[];
}

const Buyer = ({ orders, customers }: BuyerProps) => {
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estados para o Modal de OC
    const [showPOModal, setShowPOModal] = useState(false);
    const [activeRequest, setActiveRequest] = useState<PurchaseRequest | null>(null);
    const [supplierName, setSupplierName] = useState('');
    const [totalAmount, setTotalAmount] = useState<number>(0);
    const [expectedDate, setExpectedDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const allRequests = await dataService.getPurchaseRequests();
            const allPOs = await dataService.getPurchaseOrders();
            setRequests(allRequests);
            setPurchaseOrders(allPOs);
        } catch (error) {
            console.error("Error loading buyer data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getOrderContext = (orderId?: string) => {
        if (!orderId) return null;
        const order = orders.find(o => o.id === orderId);
        if (!order) return null;
        const customer = customers.find(c => c.id === order.customerId);
        return { order, customer };
    };

    const handleOpenPOModal = (request: PurchaseRequest) => {
        setActiveRequest(request);
        setSupplierName('');
        setTotalAmount(0);
        setExpectedDate(new Date().toISOString().split('T')[0]);
        setShowPOModal(true);
    };

    const handleCreatePO = async () => {
        if (!activeRequest || !supplierName || totalAmount <= 0) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSaving(true);
        try {
            const newPO: PurchaseOrder = {
                id: crypto.randomUUID(),
                supplier_name: supplierName,
                total_amount: totalAmount,
                status: 'PENDING',
                expected_delivery_date: expectedDate,
                linked_request_ids: [activeRequest.id],
                created_at: new Date().toISOString()
            };

            await dataService.savePurchaseOrder(newPO);

            const updatedRequest: PurchaseRequest = {
                ...activeRequest,
                status: 'ORDERED',
                purchase_order_id: newPO.id as any
            };

            await dataService.savePurchaseRequest(updatedRequest);

            await loadData();
            setShowPOModal(false);
            alert("Ordem de Compra gerada com sucesso!");
        } catch (error) {
            console.error("Error creating PO:", error);
            alert("Erro ao gerar Ordem de Compra");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRegisterReceipt = async (request: PurchaseRequest) => {
        const poId = (request as any).purchase_order_id;
        const po = purchaseOrders.find(p => p.id === poId);

        if (!confirm("Confirmar o recebimento total deste material e gerar lançamento no financeiro?")) return;

        setIsSaving(true);
        try {
            if (po) {
                await dataService.savePurchaseOrder({
                    ...po,
                    status: 'RECEIVED',
                    received_date: new Date().toISOString()
                });
            }

            await dataService.savePurchaseRequest({
                ...request,
                status: 'RECEIVED'
            });

            const transaction: FinancialTransaction = {
                id: crypto.randomUUID(),
                description: `Compra: ${po?.supplier_name || 'Fornecedor'} - Ref Pedido ${request.order_id || 'Avulso'}`,
                amount: po?.total_amount || 0,
                type: 'EXPENSE',
                status: 'PENDING',
                due_date: new Date().toISOString().split('T')[0],
                category_id: '2.0.0' as any,
                order_id: request.order_id,
                purchase_order_id: poId as any,
                notes: `Origem: Módulo de Compras. Item: ${request.items_requested[0]?.name || 'Diversos'}`,
                created_at: new Date().toISOString()
            };

            await dataService.saveFinancialTransaction(transaction);

            await loadData();
            alert("Entrada registrada! Uma nova conta a pagar foi gerada no financeiro.");
        } catch (error) {
            console.error("Error registering receipt:", error);
            alert("Erro ao registrar recebimento");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateStatus = async (request: PurchaseRequest, newStatus: PurchaseRequest['status']) => {
        try {
            const updated = { ...request, status: newStatus };
            await dataService.savePurchaseRequest(updated);
            setRequests(requests.map(r => r.id === request.id ? updated : r));
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Erro ao atualizar status");
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'PENDING');
    const orderedRequests = requests.filter(r => r.status === 'ORDERED');
    const receivedRequests = requests.filter(r => r.status === 'RECEIVED');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel do Comprador</h2>
                        <p className="text-slate-500 font-medium mt-1">Gerencie requisições e ordens de compra</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all sm:hidden"
                        title="Atualizar dados"
                    >
                        <RefreshCw size={24} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={loadData}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 text-indigo-600 font-bold hover:bg-indigo-50 rounded-xl transition-all"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-12">
                    <span className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Coluna Pendentes */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
                            <h3 className="font-black text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <Clock size={16} className="text-amber-500" /> Pendentes
                            </h3>
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{pendingRequests.length}</span>
                        </div>
                        {pendingRequests.map(req => {
                            const ctx = getOrderContext(req.order_id);
                            return (
                                <div key={req.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-bold text-slate-500">{new Date(req.created_at || '').toLocaleDateString()}</span>
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">Requisição</span>
                                    </div>
                                    {ctx && (
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <p className="text-xs font-bold text-indigo-700">Pedido {ctx.order.contractNumber || ctx.order.quoteNumber}</p>
                                            <p className="text-xs text-slate-600 truncate">{ctx.customer?.name}</p>
                                        </div>
                                    )}
                                    <ul className="space-y-1">
                                        {req.items_requested.map((item, idx) => (
                                            <li key={idx} className="text-sm font-medium text-slate-800 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                {item.quantity} {item.unit} - {item.name}
                                            </li>
                                        ))}
                                    </ul>
                                    {req.notes && <p className="text-xs italic text-slate-500 bg-amber-50 p-2 rounded-lg border border-amber-100">"{req.notes}"</p>}

                                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                                        <button
                                            onClick={() => handleOpenPOModal(req)}
                                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors"
                                        >
                                            Criar OC
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(req, 'CANCELED')}
                                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                            title="Cancelar solicitação"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Coluna Comprado (ORDERED) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
                            <h3 className="font-black text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <Truck size={16} className="text-blue-500" /> Aguardando Entrega
                            </h3>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{orderedRequests.length}</span>
                        </div>
                        {orderedRequests.map(req => {
                            const ctx = getOrderContext(req.order_id);
                            return (
                                <div key={req.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    {ctx && <p className="text-xs font-bold text-slate-600">Para: Pedido {ctx.order.contractNumber}</p>}
                                    <ul className="space-y-1">
                                        {req.items_requested.map((item, idx) => (
                                            <li key={idx} className="text-sm font-medium text-slate-800 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                {item.quantity} {item.unit} - {item.name}
                                            </li>
                                        ))}
                                    </ul>
                                    {req.notes && <p className="text-xs italic text-slate-500">"{req.notes}"</p>}

                                    {/* Exibe dados da OC se houver */}
                                    {(() => {
                                        const po = purchaseOrders.find(p => p.id === (req as any).purchase_order_id);
                                        if (!po) return null;
                                        return (
                                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 space-y-1">
                                                <p className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1">
                                                    <Truck size={12} /> OC: {po.supplier_name}
                                                </p>
                                                <p className="text-xs font-bold text-blue-900">R$ {po.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                {po.expected_delivery_date && (
                                                    <p className="text-[10px] text-blue-700">Entrega: {new Date(po.expected_delivery_date).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                                        <button
                                            onClick={() => handleRegisterReceipt(req)}
                                            disabled={isSaving}
                                            className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex justify-center items-center gap-1 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={14} /> Registrar Chegada
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Coluna Recebido */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
                            <h3 className="font-black text-slate-700 uppercase tracking-wider text-sm flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" /> Recebidos
                            </h3>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">{receivedRequests.length}</span>
                        </div>
                        {receivedRequests.map(req => {
                            return (
                                <div key={req.id} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm space-y-2 opacity-70 hover:opacity-100 transition-opacity">
                                    <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 size={14} /> Entregue na Fábrica
                                    </p>
                                    <p className="text-xs text-slate-600">Requisitante: {req.requester_name}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal de Criação de OC */}
            {showPOModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Gerar Ordem de Compra</h3>
                                <p className="text-xs text-slate-500 mt-1">Defina fornecedor e custos para o financeiro</p>
                            </div>
                            <button onClick={() => setShowPOModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fornecedor</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Nome da empresa / fornecedor"
                                        value={supplierName}
                                        onChange={(e) => setSupplierName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Valor Total</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            placeholder="0,00"
                                            value={totalAmount || ''}
                                            onChange={(e) => setTotalAmount(Number(e.target.value))}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Prev. Entrega</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            value={expectedDate}
                                            onChange={(e) => setExpectedDate(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {activeRequest && (
                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Itens da Requisição</p>
                                    {activeRequest.items_requested.map((it: any, i: number) => (
                                        <p key={i} className="text-xs font-bold text-indigo-900">• {it.quantity} {it.unit} - {it.name}</p>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setShowPOModal(false)}
                                    className="flex-1 py-3 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreatePO}
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Gerando...' : 'Confirmar Ordem'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Buyer;
