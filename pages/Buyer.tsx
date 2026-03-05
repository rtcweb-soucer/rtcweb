import React, { useState, useEffect } from 'react';
import { PurchaseRequest, PurchaseOrder, Order, Customer } from '../types';
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
    FileText
} from 'lucide-react';

interface BuyerProps {
    orders: Order[];
    customers: Customer[];
}

const Buyer = ({ orders, customers }: BuyerProps) => {
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
                                            onClick={() => handleUpdateStatus(req, 'ORDERED')}
                                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors"
                                        >
                                            Criar OC
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
                                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                                        <button
                                            onClick={() => handleUpdateStatus(req, 'RECEIVED')}
                                            className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex justify-center items-center gap-1"
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
        </div>
    );
};

export default Buyer;
