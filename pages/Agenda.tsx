
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Seller, Appointment, SellerBlockedSlot, UserRole, Customer, TechnicalSheet, Product, Installer } from '../types';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Trash2,
    Clock,
    Calendar as CalendarIcon,
    Info,
    Lock,
    User,
    X,
    Layers,
    Edit3,
    FileText,
    Package,
    Ruler,
    CheckSquare,
    Square,
    MapPin,
    Phone,
    HardHat
} from 'lucide-react';

interface AgendaProps {
    appointments: Appointment[];
    blockedSlots: SellerBlockedSlot[];
    sellers: Seller[];
    customers: Customer[];
    technicalSheets: TechnicalSheet[];
    products: Product[];
    installers: Installer[];
    currentUser: any;
    onAddBlockedSlot: (slot: SellerBlockedSlot) => void;
    onDeleteBlockedSlot: (id: string) => void;
    onStartMeasurement?: (customerId: string) => void;
    onEditTechnicalSheet?: (sheet: TechnicalSheet) => void;
    onGenerateQuote?: (sheet: TechnicalSheet, selectedItemIds?: string[]) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

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

const Agenda = ({
    appointments,
    blockedSlots,
    sellers,
    customers,
    technicalSheets,
    products,
    installers,
    currentUser,
    onAddBlockedSlot,
    onDeleteBlockedSlot,
    onStartMeasurement,
    onEditTechnicalSheet,
    onGenerateQuote
}: AgendaProps) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filterSellerId, setFilterSellerId] = useState<string>(
        currentUser?.role === UserRole.SELLER ? (currentUser.sellerId || currentUser.id) : ''
    );
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [newBlock, setNewBlock] = useState({
        date: getLocalISODate(new Date()),
        startTime: '09:00',
        endTime: '12:00',
        reason: ''
    });

    // Calculate inclusive week starting on Sunday
    const weekDays = useMemo(() => {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const handleToday = () => setCurrentDate(new Date());

    const handleSaveBlock = (e: React.FormEvent) => {
        e.preventDefault();
        const sellerId = filterSellerId || (currentUser?.sellerId || currentUser?.id);
        if (!sellerId) return;

        onAddBlockedSlot({
            id: crypto.randomUUID(),
            sellerId,
            ...newBlock
        });
        setShowBlockModal(false);
        setNewBlock({
            date: getLocalISODate(new Date()),
            startTime: '09:00',
            endTime: '12:00',
            reason: ''
        });
    };

    // Filter relevant items for the selected seller
    const isSeller = currentUser?.role === UserRole.SELLER;
    const activeSellerId = isSeller ? (currentUser.sellerId || currentUser.id) : filterSellerId;

    const sellerAppointments = appointments.filter(a => a.sellerId === activeSellerId && activeSellerId && a.status !== 'CANCELLED');
    const sellerBlockedSlots = blockedSlots.filter(s => s.sellerId === activeSellerId && activeSellerId);

    const getDayItems = (date: Date) => {
        const dateStr = getLocalISODate(date);
        const dayApps = sellerAppointments.filter(a => a.date === dateStr);
        const dayBlocks = sellerBlockedSlots.filter(s => s.date === dateStr);
        return { dayApps, dayBlocks };
    };

    const getSheetForApp = (app: Appointment) => {
        return technicalSheets
            .filter((s: TechnicalSheet) => s.customerId === app.customerId)
            .sort((a: TechnicalSheet, b: TechnicalSheet) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    };

    const toggleItemSelection = (id: string) => {
        const next = new Set(selectedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItems(next);
    };

    // Auto-select items when opening modal
    React.useEffect(() => {
        if (selectedApp) {
            const sheet = getSheetForApp(selectedApp);
            if (sheet) {
                setSelectedItems(new Set(sheet.items.map(i => i.id)));
            } else {
                setSelectedItems(new Set());
            }
        }
    }, [selectedApp]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Agenda Semanal</h2>
                    <p className="text-slate-500 font-medium">Visualize compromissos e bloqueie horários.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {currentUser?.role !== UserRole.SELLER && (
                        <select
                            value={filterSellerId}
                            onChange={(e) => setFilterSellerId(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        >
                            <option value="">Selecione um Vendedor...</option>
                            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}

                    <div className="flex bg-white border border-slate-200 rounded-xl shadow-sm p-1">
                        <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                        <button onClick={handleToday} className="px-4 py-1 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-lg transition-all">Hoje</button>
                        <button onClick={handleNextWeek} className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                    </div>

                    <button
                        onClick={() => setShowBlockModal(true)}
                        disabled={!activeSellerId}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50"
                    >
                        <Lock size={16} /> Bloquear Horário
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                {/* Calendar Header */}
                <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="p-4 border-r border-slate-100 flex items-center justify-center">
                        <Clock size={16} className="text-slate-400" />
                    </div>
                    {weekDays.map((day, i) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                            <div key={i} className={`p-4 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                                </p>
                                <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>{day.getDate()}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Calendar Body */}
                <div className="relative overflow-y-auto max-h-[70vh]">
                    {!activeSellerId ? (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                            <User size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-bold italic">Selecione um vendedor para visualizar a agenda.</p>
                        </div>
                    ) : (
                        HOURS.map((hour) => (
                            <div key={hour} className="grid grid-cols-8 border-b border-slate-50 min-h-[100px]">
                                {/* Time Column */}
                                <div className="p-4 border-r border-slate-100 bg-slate-50/20 flex flex-col items-center justify-start">
                                    <span className="text-xs font-black text-slate-400">{hour.toString().padStart(2, '0')}:00</span>
                                </div>

                                {/* Day Columns */}
                                {weekDays.map((day, i) => {
                                    const { dayApps, dayBlocks } = getDayItems(day);

                                    // Find items that start at this specific hour
                                    const hourApps = dayApps.filter(a => parseInt(a.time.split(':')[0]) === hour);
                                    const hourBlocks = dayBlocks.filter(b => {
                                        const startH = parseInt(b.startTime.split(':')[0]);
                                        const endH = parseInt(b.endTime.split(':')[0]);
                                        return hour >= startH && hour < endH;
                                    });

                                    return (
                                        <div key={i} className={`p-1 border-r border-slate-50 last:border-r-0 relative group hover:bg-slate-50/30 transition-colors`}>
                                            <div className="space-y-1">
                                                {hourBlocks.map((block) => (
                                                    <div
                                                        key={block.id}
                                                        className="bg-rose-50 border-l-4 border-rose-500 p-2 rounded-r-lg shadow-sm animate-in slide-in-from-left-2 duration-300"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-[10px] font-black text-rose-600 uppercase leading-none">Indisponível</p>
                                                            <button
                                                                onClick={() => onDeleteBlockedSlot(block.id)}
                                                                className="text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-slate-800 mt-1 line-clamp-2">{block.reason || 'Sem motivo informado'}</p>
                                                        <p className="text-[9px] text-rose-400 font-bold mt-1">{block.startTime} - {block.endTime}</p>
                                                    </div>
                                                ))}

                                                {hourApps.map((app) => {
                                                    const customer = customers.find(c => c.id === app.customerId);
                                                    return (
                                                        <div
                                                            key={app.id}
                                                            onClick={() => setSelectedApp(app)}
                                                            className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded-r-lg shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
                                                        >
                                                            <p className="text-[10px] font-black text-blue-600 uppercase leading-none">
                                                                {app.type === 'MEASUREMENT' ? 'Medição' : 'Agendamento'}
                                                            </p>
                                                            <p className="text-[11px] font-bold text-slate-800 mt-1 truncate">{customer?.name || 'Cliente'}</p>
                                                            <p className="text-[9px] font-bold text-slate-500">{customer?.phone}</p>
                                                            <p className="text-[9px] text-slate-400 truncate">{customer?.address.neighborhood}</p>
                                                            <p className="text-[10px] font-black text-blue-400 mt-1">{app.time}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )))}
                </div>
            </div>

            {/* Modal de Bloqueio */}
            {showBlockModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                                    <Lock size={20} />
                                </div>
                                <h3 className="font-bold text-lg text-slate-900">Bloquear Horário</h3>
                            </div>
                            <button onClick={() => setShowBlockModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBlock} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Data do Bloqueio</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="date"
                                        required
                                        value={newBlock.date}
                                        onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Início</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="time"
                                            required
                                            value={newBlock.startTime}
                                            onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Fim</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="time"
                                            required
                                            value={newBlock.endTime}
                                            onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Motivo do Bloqueio</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newBlock.reason}
                                    onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                                    placeholder="Ex: Consultório, Compromisso Pessoal, Logística..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowBlockModal(false)}
                                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black hover:bg-rose-700 shadow-xl shadow-rose-500/20 transition-all"
                                >
                                    Confirmar Bloqueio
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Detalhes Estendido (Reutilizado do Schedule) */}
            {selectedApp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
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
                                                        <CalendarIcon size={14} className="text-blue-500" /> {formatDisplayDate(selectedApp.date)}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                                        <Clock size={14} className="text-blue-500" /> {selectedApp.time}
                                                    </div>
                                                </div>

                                                {selectedApp.installerIds && selectedApp.installerIds.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-blue-100/50">
                                                        <p className="text-[10px] uppercase font-black text-blue-400 mb-1 tracking-widest">Instaladores Escalados</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedApp.installerIds.map(id => {
                                                                const inst = installers.find(i => i.id === id);
                                                                return (
                                                                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold">
                                                                        <HardHat size={10} /> {inst?.name || 'Desconhecido'}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
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
        </div>
    );
};

export default Agenda;
