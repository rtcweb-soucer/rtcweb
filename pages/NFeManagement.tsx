import * as React from 'react';
import { useState, useEffect } from 'react';
import { Order, Customer, Product, UserRole, SystemUser, TechnicalSheet, MeasurementItem } from '../types';
import { dataService } from '../services/dataService';
import { nfEmailService } from '../services/nfEmailService';
import { SEFAZTxtGenerator } from '../services/sefazTxtGenerator';
import {
    FileText,
    Settings,
    RefreshCw,
    ExternalLink,
    Search,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Clock,
    Save,
    Hash,
    Layers,
    Globe,
    Ban,
    FileEdit,
    SendHorizontal,
    X,
    Trash2,
    FileCode
} from 'lucide-react';

interface NFeManagementProps {
    orders: Order[];
    customers: Customer[];
    products: Product[];
    technicalSheets: TechnicalSheet[];
    currentUser: SystemUser;
    onUpdateOrder: (order: Order) => void;
    onNavigateToOrder?: (orderId: string) => void;
}

const NFeManagement = ({ orders, customers, products, technicalSheets, currentUser, onUpdateOrder, onNavigateToOrder }: NFeManagementProps) => {
    const [nfeSettings, setNfeSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [activeTab, setActiveTab] = useState<'rtcweb' | 'portal'>('rtcweb');
    const [externalNotes, setExternalNotes] = useState<any[]>([]);
    const [loadingExternal, setLoadingExternal] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);

    // Estados para ações avançadas
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showCCeModal, setShowCCeModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [modalInput, setModalInput] = useState('');
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (nfeSettings) {
            nfEmailService.setConfig({
                cnpj: nfeSettings.cnpj || '',
                apiKey: nfeSettings.apiKey || ''
            });
        }
    }, [nfeSettings]);

    useEffect(() => {
        if (activeTab === 'portal') {
            loadExternalNotes();
        }
    }, [activeTab]);

    const loadSettings = async () => {
        try {
            const settings = await dataService.getNFeSettings();
            setNfeSettings(settings);
        } catch (error) {
            console.error("Erro ao carregar configurações de NFe:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadExternalNotes = async () => {
        setLoadingExternal(true);
        try {
            // A API do NFEmail tem limite máximo de 30 por página
            const xmlResponse = await nfEmailService.listNFe(1, 30);
            const notes = nfEmailService.parseNFeList(xmlResponse);
            setExternalNotes(notes);
        } catch (error) {
            console.error("Erro ao carregar notas do portal:", error);
        } finally {
            setLoadingExternal(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!nfeSettings) return;
        setIsSavingSettings(true);
        try {
            await dataService.saveNFeSettings(nfeSettings);
            alert("Configurações salvas com sucesso!");
        } catch (error: any) {
            alert("Erro ao salvar configurações: " + error.message);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSyncStatus = async (order: Order) => {
        let currentKey = order.nfeKey;
        let foundStatus: any = null;

        // Tenta SEMPRE buscar na lista do portal primeiro pelo número
        // Isso é mais robusto que buscar por chave se a chave estiver errada localmente
        if (order.nfeNumber) {
            try {
                const responseText = await nfEmailService.listNFe(1, 10, '', order.nfeNumber.toString());
                const notes = nfEmailService.parseNFeList(responseText);

                const foundNote = notes.find((n: any) => {
                    const portalNum = parseInt(n.number || '0');
                    const localNum = parseInt(order.nfeNumber?.toString() || '0');
                    const portalSeries = n.series ? parseInt(n.series) : null;
                    const localSeries = order.nfeSeries || 1;
                    return portalNum === localNum && (portalSeries === null || portalSeries === localSeries) && portalNum > 0;
                });

                if (foundNote) {
                    console.log(`✅ Nota ${order.nfeNumber} encontrada na lista. Status: ${foundNote.status}`);

                    // Mapeia o status da lista para o nosso enum
                    let mappedStatus = 'PENDING';
                    const s = String(foundNote.status).trim().toLowerCase();
                    if (s === '100' || s === '150' || s === '128' || s === 'autorizada' || s === 'authorized' || s === 'sucesso') {
                        mappedStatus = 'AUTHORIZED';
                    } else if (['101', '135', '155', 'cancelada', 'canceled'].includes(s)) {
                        mappedStatus = 'CANCELED';
                    } else if (s && parseInt(s) > 100) {
                        mappedStatus = 'ERROR';
                    }

                    const updatedOrder = {
                        ...order,
                        nfeStatus: mappedStatus,
                        nfeKey: foundNote.key || currentKey,
                        nfeId: foundNote.id || order.nfeId,
                        nfeMessage: foundNote.reason || order.nfeMessage || 'Sincronizado via Lista'
                    } as Order;

                    await dataService.saveOrder(updatedOrder);
                    onUpdateOrder(updatedOrder);

                    if (mappedStatus === 'AUTHORIZED') {
                        alert(`Nota ${order.nfeNumber} Sincronizada: AUTORIZADA com sucesso!`);
                        return 'AUTHORIZED';
                    }

                    // Se encontrou mas não está autorizada, guardamos a chave e ID para o próximo passo se necessário
                    currentKey = foundNote.key || currentKey;
                    if (foundNote.id) (order as any).nfeId = foundNote.id;
                    foundStatus = mappedStatus;
                }
            } catch (e) {
                console.error("Erro na busca por lista:", e);
            }
        }

        // Se não resolveu pela lista ou não encontrou, tenta o detalhe direto com a chave que tivermos
        if (!currentKey) {
            alert("Não foi possível encontrar a chave de acesso para sincronizar.");
            return null;
        }

        try {
            const xmlResponse = await nfEmailService.getNFeStatus(currentKey);
            const result = nfEmailService.parseNFeStatus(xmlResponse);

            if (result && result.status !== 'PENDING') {
                const updatedOrder = {
                    ...order,
                    nfeStatus: result.status,
                    nfeKey: result.chNFe || currentKey,
                    nfeMessage: result.xMotivo || order.nfeMessage
                } as Order;

                await dataService.saveOrder(updatedOrder);
                onUpdateOrder(updatedOrder);

                if (result.status === 'AUTHORIZED') {
                    alert(`Nota ${order.nfeNumber} Sincronizada: AUTORIZADA com sucesso!`);
                } else {
                    const rawData = result.raw ? JSON.stringify(result.raw, null, 2) : 'Sem dados brutos';
                    alert(`Sincronização concluída. Status Portal: ${result.status}\nMotivo: ${result.xMotivo}\n\nResposta da API:\n${rawData}`);
                }

                return result.status;
            } else if (foundStatus) {
                // Se o detalhe falhou mas a lista deu algum status, ficamos com o da lista
                return foundStatus;
            } else {
                const rawData = result?.raw ? JSON.stringify(result.raw, null, 2) : 'Sem dados brutos ou erro na chave';
                alert(`Sincronização incompleta. Status Local: PENDENTE\nMotivo: O portal não retornou status definitivo.\n\nResposta da API:\n${rawData}`);
            }
            return null;
        } catch (error: any) {
            console.error("Erro ao sincronizar status detalhado:", error);
            // Se já tínhamos status da lista, não alertamos erro de comunicação detalhada
            if (!foundStatus) alert("Erro na comunicação detalhada com o portal: " + error.message);
            return foundStatus || null;
        }
    };

    const handleSyncAll = async () => {
        const toSync = nfeOrders.filter(o => o.nfeStatus === 'PENDING' || o.nfeStatus === 'ERROR');
        if (toSync.length === 0) {
            alert("Nenhuma nota pendente para sincronizar.");
            return;
        }

        setIsSyncingAll(true);
        let successCount = 0;
        for (const order of toSync) {
            const newStatus = await handleSyncStatus(order);
            if (newStatus === 'AUTHORIZED') successCount++;
        }
        setIsSyncingAll(false);
        alert(`Sincronização concluída. ${successCount} notas autorizadas.`);
    };

    const handleTransmit = async (note: any) => {
        if (!note.key) return;
        try {
            alert("Sincronizando status para a nota no portal...");
            await handleSyncStatus({ nfeKey: note.key } as Order);
            if (activeTab === 'portal') loadExternalNotes();
        } catch (error: any) {
            alert("Erro ao sincronizar: " + error.message);
        }
    };

    const nfeOrders = orders
        .filter(o => o.nfeNumber || o.nfeStatus || o.status === 'FINISHED' || o.status === 'DELIVERED')
        .sort((a, b) => {
            if (a.nfeNumber && b.nfeNumber) return b.nfeNumber - a.nfeNumber;
            if (a.nfeNumber) return -1;
            if (b.nfeNumber) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    const handleCancelOrder = async () => {
        if (!selectedOrder || !selectedOrder.nfeKey) return;
        if (modalInput.length < 15) {
            alert("A justificativa deve ter pelo menos 15 caracteres.");
            return;
        }

        setIsProcessingAction(true);
        try {
            await nfEmailService.cancelNFe(selectedOrder.nfeKey, modalInput);
            alert("Solicitação de cancelamento enviada!");
            await handleSyncStatus(selectedOrder);
            setShowCancelModal(false);
            setModalInput('');
        } catch (error: any) {
            alert("Erro ao cancelar: " + error.message);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleSendCorrection = async () => {
        if (!selectedOrder || !selectedOrder.nfeKey) return;
        if (modalInput.length < 15) {
            alert("O texto da correção deve ter pelo menos 15 caracteres.");
            return;
        }

        setIsProcessingAction(true);
        try {
            await nfEmailService.sendCCe(selectedOrder.nfeKey, modalInput);
            alert("Carta de Correção enviada com sucesso!");
            setShowCCeModal(false);
            setModalInput('');
        } catch (error: any) {
            alert("Erro ao enviar CC-e: " + error.message);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleTransmitOrder = async (order: Order) => {
        const customer = customers.find(c => c.id === order.customerId);
        if (!customer) {
            alert("Cliente não encontrado.");
            return;
        }

        if (order.nfeNumber || order.nfeKey) {
            if (!confirm(`Este pedido já possui dados de exportação (Nº ${order.nfeNumber}). Deseja transmitir novamente ao SEFAZ?`)) {
                return;
            }
        }

        setIsProcessingAction(true);
        try {
            const settings = await dataService.getNFeSettings();
            const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
            const items = order.itemsSnapshot && order.itemsSnapshot.length > 0
                ? order.itemsSnapshot
                : (sheet?.items.filter(it => order.itemIds?.includes(it.id)) || []);

            if (items.length === 0) throw new Error("Sem itens para exportar.");

            const customPrices: Record<string, number> = {};
            items.forEach(item => {
                if (order.itemPrices && order.itemPrices[item.id] !== undefined) {
                    customPrices[item.id] = order.itemPrices[item.id];
                } else {
                    const product = products.find(p => p.id === item.productId);
                    const area = (item.width * item.height) || 1;
                    customPrices[item.id] = product ? (product.unidade === 'M2' ? product.valor * area : product.valor) : 0;
                }
            });

            const nextNum = order.nfeNumber || settings.nextNumber;
            const series = order.nfeSeries || settings.currentSeries;

            const response = await nfEmailService.sendOrderMethods(order, customer, items, products, customPrices, nextNum, series);

            const result = nfEmailService.parseNFeStatus(response);

            const updatedOrder = {
                ...order,
                nfeNumber: nextNum,
                nfeSeries: series,
                nfeKey: result?.chNFe || (response.match(/[0-9]{44}/)?.[0] || order.nfeKey),
                nfeStatus: result?.status || 'PENDING',
                nfeMessage: result?.xMotivo || 'Nota enviada/processada'
            } as Order;

            await dataService.saveOrder(updatedOrder);
            onUpdateOrder(updatedOrder);

            if (!order.nfeNumber) {
                await dataService.saveNFeSettings({ ...settings, nextNumber: nextNum + 1 });
            }

            alert(`NF-e nº ${nextNum} transmitida com sucesso!`);
            await handleSyncStatus(updatedOrder);
        } catch (error: any) {
            alert("Erro na transmissão: " + error.message);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const filteredOrders = nfeOrders.filter(o => {
        const customer = customers.find(c => c.id === o.customerId);
        const searchStr = `${o.nfeNumber || ''} ${customer?.name || ''} ${o.nfeKey || ''}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    const renderTableBody = () => {
        if (activeTab === 'rtcweb') {
            if (filteredOrders.length === 0) {
                return (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Nenhuma nota fiscal encontrada</td>
                    </tr>
                );
            }
            return filteredOrders.map(order => {
                const customer = customers.find(c => c.id === order.customerId);
                return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                            <span className="text-sm font-black text-slate-900">{order.nfeNumber || '---'}</span>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Série {order.nfeSeries}</div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-700 block truncate max-w-[200px]">{customer?.name || 'Cliente não encontrado'}</span>
                            <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{order.nfeKey || '---'}</div>
                        </td>
                        <td className="px-6 py-4">
                            <button
                                onClick={() => onNavigateToOrder?.(order.id)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                                title="Ver Pedido Completo"
                            >
                                <Hash size={12} /> #{order.id.slice(0, 8)}...
                            </button>
                        </td>
                        <td className="px-6 py-4">
                            {order.nfeStatus === 'AUTHORIZED' ? (
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-emerald-200">
                                        <CheckCircle2 size={12} /> Autorizada
                                    </span>
                                </div>
                            ) : order.nfeStatus === 'ERROR' ? (
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-rose-200">
                                        <AlertCircle size={12} /> Erro
                                    </span>
                                    {order.nfeMessage && (
                                        <div className="text-[9px] text-rose-400 font-bold max-w-[150px] leading-tight truncate" title={order.nfeMessage}>
                                            {order.nfeMessage}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={async () => {
                                        if (confirm(`A nota ${order.nfeNumber} está como PENDENTE. Deseja FORÇAR o status para AUTORIZADA manualmente? (Use isso apenas se confirmou no portal)`)) {
                                            const manualOrder = { ...order, nfeStatus: 'AUTHORIZED', nfeMessage: 'Autorização Manual' } as Order;
                                            await dataService.saveOrder(manualOrder);
                                            onUpdateOrder(manualOrder);
                                            alert("Status atualizado para AUTORIZADA.");
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
                                    title="Clique para Forçar Autorização"
                                >
                                    <Clock size={12} /> Pendente
                                </button>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 text-right">
                                {order.nfeKey && (
                                    <>
                                        <a
                                            href={nfEmailService.getDANFEUrl(order.nfeKey, order.nfeId)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Visualizar DANFE no Portal"
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                        <button
                                            onClick={() => order.nfeKey && nfEmailService.downloadDANFe(order.nfeKey)}
                                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Baixar DANFE (PDF)"
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => order.nfeKey && nfEmailService.downloadXML(order.nfeKey)}
                                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                            title="Baixar XML"
                                        >
                                            <FileCode size={18} />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => handleSyncStatus(order)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Sincronizar Status"
                                >
                                    <RefreshCw size={18} />
                                </button>

                                {order.nfeStatus === 'AUTHORIZED' && order.nfeKey && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setModalInput('');
                                                setShowCCeModal(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                            title="Carta de Correção (CC-e)"
                                        >
                                            <FileEdit size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setModalInput('');
                                                setShowCancelModal(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                            title="Cancelar NF-e"
                                        >
                                            <Ban size={18} />
                                        </button>
                                    </>
                                )}

                                {(order.nfeStatus === 'PENDING' || order.nfeStatus === 'ERROR' || !order.nfeStatus) && (
                                    <button
                                        onClick={() => handleTransmitOrder(order)}
                                        disabled={isProcessingAction}
                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                        title="Transmitir Nota"
                                    >
                                        <SendHorizontal size={18} />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                );
            });
        } else {
            if (loadingExternal) {
                return (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                            <RefreshCw className="animate-spin text-blue-500 inline mr-2" size={16} /> Carregando notas do portal...
                        </td>
                    </tr>
                );
            }
            if (externalNotes.length === 0) {
                return (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Nenhuma nota encontrada no portal</td>
                    </tr>
                );
            }
            return externalNotes.map((note, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-900">#{note.number || '---'}</span>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Série {note.series}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700 block truncate max-w-[200px]">{note.customerName || '---'}</span>
                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{note.key || '---'}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ring-1 ${note.status === 'Autorizada' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' :
                            note.status?.includes('Erro') || note.status?.includes('Rejeitada') ? 'bg-rose-50 text-rose-600 ring-rose-200' :
                                'bg-amber-50 text-amber-600 ring-amber-200'
                            }`}>
                            {note.status === 'Autorizada' ? <CheckCircle2 size={12} /> : note.status?.includes('Erro') ? <AlertCircle size={12} /> : <Clock size={12} />}
                            {note.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            {note.key && (
                                <>
                                    <a
                                        href={nfEmailService.getDANFEUrl(note.key, note.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                        title="Visualizar DANFE no Portal"
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                    <button
                                        onClick={() => note.key && nfEmailService.downloadDANFe(note.key)}
                                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Baixar DANFE (PDF)"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    <button
                                        onClick={() => note.key && nfEmailService.downloadXML(note.key)}
                                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                        title="Baixar XML"
                                    >
                                        <FileCode size={18} />
                                    </button>
                                    {note.status !== 'Autorizada' && (
                                        <button
                                            onClick={() => handleTransmit(note)}
                                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                            title="Transmitir agora"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </td>
                </tr>
            ));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <FileText size={24} />
                        </div>
                        Gerenciamento de NF-e
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Controle de emissão, numeração e status de notas fiscais</p>
                </div>
                <button
                    onClick={handleSyncAll}
                    disabled={isSyncingAll}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={18} className={isSyncingAll ? 'animate-spin' : ''} />
                    {isSyncingAll ? 'Sincronizando...' : 'Sincronizar Pendentes'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Settings Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Settings size={18} className="text-blue-500" /> Configurações Gerais
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Ambiente SEFAZ</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setNfeSettings({ ...nfeSettings, environment: 1 })}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${nfeSettings?.environment === 1 ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        <Globe size={14} className="inline mr-1" /> Produção
                                    </button>
                                    <button
                                        onClick={() => setNfeSettings({ ...nfeSettings, environment: 2 })}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${nfeSettings?.environment === 2 ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        <Clock size={14} className="inline mr-1" /> Homologação
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">CNPJ do Emitente</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={nfeSettings?.cnpj || ''}
                                            onChange={(e) => setNfeSettings({ ...nfeSettings, cnpj: e.target.value })}
                                            placeholder="00.000.000/0000-00"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Chave de API NFEmail</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="password"
                                            value={nfeSettings?.apiKey || ''}
                                            onChange={(e) => setNfeSettings({ ...nfeSettings, apiKey: e.target.value })}
                                            placeholder="Sua API Key"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Série Atual</label>
                                    <div className="relative">
                                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            value={nfeSettings?.currentSeries || 1}
                                            onChange={(e) => setNfeSettings({ ...nfeSettings, currentSeries: parseInt(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Próximo Nº</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            value={nfeSettings?.nextNumber || 1}
                                            onChange={(e) => setNfeSettings({ ...nfeSettings, nextNumber: parseInt(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveSettings}
                                disabled={isSavingSettings}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18} /> {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resumo de Emissões</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <span className="text-xs font-bold text-emerald-700">Autorizadas</span>
                                <span className="text-lg font-black text-emerald-700">{nfeOrders.filter(o => o.nfeStatus === 'AUTHORIZED').length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-2xl border border-amber-100">
                                <span className="text-xs font-bold text-amber-700">Pendentes</span>
                                <span className="text-lg font-black text-amber-700">{nfeOrders.filter(o => o.nfeStatus === 'PENDING').length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-rose-50 rounded-2xl border border-rose-100">
                                <span className="text-xs font-bold text-rose-700">Erros/Canceladas</span>
                                <span className="text-lg font-black text-rose-700">{nfeOrders.filter(o => o.nfeStatus === 'ERROR' || o.nfeStatus === 'CANCELED').length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab('rtcweb')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'rtcweb' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                Notas RTCWEB
                            </button>
                            <button
                                onClick={() => setActiveTab('portal')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'portal' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                Notas do Portal (NFEmail)
                            </button>
                        </div>
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                {activeTab === 'rtcweb' ? 'Notas Fiscais Emitidas' : 'Notas Direto no Portal'}
                            </h3>
                            <div className="flex items-center gap-3">
                                {activeTab === 'portal' && (
                                    <button
                                        onClick={loadExternalNotes}
                                        disabled={loadingExternal}
                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                        title="Recarregar Portal"
                                    >
                                        <RefreshCw size={18} className={loadingExternal ? 'animate-spin' : ''} />
                                    </button>
                                )}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Nota</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Cliente / Chave</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Pedido</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Status</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {renderTableBody()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals para Ações NFe */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
                            <h3 className="text-lg font-black text-rose-900 flex items-center gap-2">
                                <Ban size={20} /> Cancelar Nota Fiscal
                            </h3>
                            <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                <p className="text-xs font-bold text-rose-700 leading-relaxed">
                                    ⚠️ ATENÇÃO: O cancelamento é irreversível e deve ser feito dentro do prazo legal.
                                    A justificativa deve ser clara e ter entre 15 e 255 caracteres.
                                </p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Justificativa do Cancelamento</label>
                                <textarea
                                    value={modalInput}
                                    onChange={(e) => setModalInput(e.target.value)}
                                    placeholder="Descreva o motivo do cancelamento..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all resize-none"
                                />
                                <div className="mt-1 flex justify-end">
                                    <span className={`text-[10px] font-black uppercase ${modalInput.length < 15 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {modalInput.length} / 15 caracteres (min)
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={isProcessingAction || modalInput.length < 15}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-sm font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50"
                            >
                                {isProcessingAction ? 'Processando...' : 'Confirmar Cancelamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCCeModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                            <h3 className="text-lg font-black text-amber-900 flex items-center gap-2">
                                <FileEdit size={20} /> Carta de Correção (CC-e)
                            </h3>
                            <button onClick={() => setShowCCeModal(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                    Nota: A CC-e não pode corrigir valores, quantidades, datas de emissão ou dados do destinatário que alterem a identidade da operação.
                                </p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Texto da Correção</label>
                                <textarea
                                    value={modalInput}
                                    onChange={(e) => setModalInput(e.target.value)}
                                    placeholder="Descreva as correções necessárias..."
                                    rows={6}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                                />
                                <div className="mt-1 flex justify-end">
                                    <span className={`text-[10px] font-black uppercase ${modalInput.length < 15 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {modalInput.length} / 15 caracteres (min)
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button
                                onClick={() => setShowCCeModal(false)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleSendCorrection}
                                disabled={isProcessingAction || modalInput.length < 15}
                                className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95 disabled:opacity-50"
                            >
                                {isProcessingAction ? 'Enviando...' : 'Enviar Correção'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NFeManagement;
