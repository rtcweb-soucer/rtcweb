import * as React from 'react';
import { useState, useMemo } from 'react';
import {
    Plus,
    User,
    Phone,
    DollarSign,
    Calendar,
    Search,
    Edit3,
    Trash2,
    X,
    HardHat,
    ChevronRight,
    Filter,
    FileText,
    TrendingUp,
    Download,
    Clock,
    Clipboard
} from 'lucide-react';
import { Installer, Appointment, TimeEntry } from '../types';

interface InstallersProps {
    installers: Installer[];
    appointments: Appointment[];
    timeEntries: TimeEntry[];
    onAdd: (i: Installer) => void;
    onUpdate: (i: Installer) => void;
    onDelete: (id: string) => void;
}

const Installers = ({
    installers,
    appointments,
    timeEntries,
    onAdd,
    onUpdate,
    onDelete
}: InstallersProps) => {
    const [activeTab, setActiveTab] = useState<'manage' | 'report'>('manage');
    const [reportType, setReportType] = useState<'diarias' | 'ponto' | 'fechamento'>('fechamento');
    const [showModal, setShowModal] = useState(false);
    const [editingInstaller, setEditingInstaller] = useState<Installer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Report filters
    const [reportStartDate, setReportStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [reportEndDate, setReportEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [reportFilterInstallerId, setReportFilterInstallerId] = useState('');

    const [formData, setFormData] = useState<Partial<Installer>>({
        name: '',
        phone: '',
        dailyRate: 0,
        hourlyRate: 0,
        active: true,
        login: '',
        password: ''
    });

    const handleOpenAdd = () => {
        setEditingInstaller(null);
        setFormData({ name: '', phone: '', dailyRate: 0, hourlyRate: 0, active: true, login: '', password: '' });
        setShowModal(true);
    };

    const handleOpenEdit = (installer: Installer) => {
        setEditingInstaller(installer);
        setFormData({ ...installer });
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingInstaller) {
            onUpdate({ ...editingInstaller, ...formData } as Installer);
        } else {
            onAdd({
                ...formData as Installer,
                id: crypto.randomUUID()
            });
        }
        setShowModal(false);
    };

    const filteredInstallers = installers.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Report Calculation
    const reportData = useMemo(() => {
        // 1. Filtrar agendamentos escalados no período (COMPLETED ou SCHEDULED)
        const validApps = appointments.filter(app => {
            if (app.status !== 'COMPLETED' && app.status !== 'SCHEDULED') return false;
            // Apenas agendamentos com instaladores vinculados
            if (!app.installerIds || app.installerIds.length === 0) return false;

            return app.date >= reportStartDate && app.date <= reportEndDate;
        });

        // 2. Mapear diárias por (Installer, Data)
        // Usamos um Set de strings "installerId|date|status" para garantir unicidade por dia
        // NOTA: Se houver múltiplos status no mesmo dia, o Set vai tratar como entradas diferentes.
        // Assumindo que um instalador só tem uma diária por dia, vamos simplificar para "installerId|date" e pegar o status mais relevante (COMPLETED > SCHEDULED)
        const workedDays = new Map<string, { status: string }>();
        validApps.forEach(app => {
            app.installerIds?.forEach(id => {
                if (!reportFilterInstallerId || id === reportFilterInstallerId) {
                    const key = `${id}|${app.date}`;
                    const current = workedDays.get(key);
                    // Prioriza COMPLETED sobre SCHEDULED
                    if (!current || (current.status === 'SCHEDULED' && app.status === 'COMPLETED')) {
                        workedDays.set(key, { status: app.status });
                    }
                }
            });
        });

        // 3. Transformar em lista para exibição
        const results = Array.from(workedDays.entries()).map(([key, value]) => {
            const [installerId, date] = key.split('|');
            const installer = installers.find(i => i.id === installerId);
            return {
                installerName: installer?.name || 'Desconhecido',
                date,
                dailyRate: installer?.dailyRate || 0,
                status: value.status
            };
        });

        // Ordenar por data
        return results.sort((a, b) => b.date.localeCompare(a.date));
    }, [appointments, installers, reportStartDate, reportEndDate, reportFilterInstallerId]);

    const pontoReportData = useMemo(() => {
        const filtered = timeEntries.filter(te => {
            const date = te.timestamp.split('T')[0];
            const inInstaller = !reportFilterInstallerId || te.installerId === reportFilterInstallerId;
            return inInstaller && date >= reportStartDate && date <= reportEndDate;
        });

        // Agrupar por data e instalador para mostrar turnos/dia
        const grouped: Record<string, TimeEntry[]> = {};
        filtered.forEach(te => {
            const date = te.timestamp.split('T')[0];
            const key = `${te.installerId}|${date}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(te);
        });

        return Object.entries(grouped).map(([key, entries]) => {
            const [installerId, date] = key.split('|');
            const installer = installers.find(i => i.id === installerId);
            
            // Ordenar por horário
            const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            
            const entrance = sorted.find(e => e.type === 'IN');
            const exit = sorted.find(e => e.type === 'OUT');
            
            let duration = '---';
            if (entrance && exit) {
                const start = new Date(entrance.timestamp);
                const end = new Date(exit.timestamp);
                const diffMs = end.getTime() - start.getTime();
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                duration = `${diffHrs}h ${diffMins}m`;
            }

            return {
                installerName: installer?.name || 'Desconhecido',
                date,
                entrance: entrance ? new Date(entrance.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---',
                exit: exit ? new Date(exit.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---',
                duration,
                location: entrance?.locationName || exit?.locationName || 'Externo',
                isExtra: entrance?.isExtra || exit?.isExtra
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [timeEntries, installers, reportStartDate, reportEndDate, reportFilterInstallerId]);

    const fechamentoReportData = useMemo(() => {
        // Obter todas as combinações únicas de (Instalador, Data) presentes em ambos os conjuntos
        const allKeys = new Set<string>();
        
        // Da agenda
        reportData.forEach(r => {
            const installer = installers.find(i => i.name === r.installerName);
            if (installer) allKeys.add(`${installer.id}|${r.date}`);
        });
        
        // Do ponto
        pontoReportData.forEach(p => {
            const installer = installers.find(i => i.name === p.installerName);
            if (installer) allKeys.add(`${installer.id}|${p.date}`);
        });

        return Array.from(allKeys).map(key => {
            const [installerId, date] = key.split('|');
            const installer = installers.find(i => i.id === installerId);
            
            const agenda = reportData.find(r => r.date === date && r.installerName === installer?.name);
            const ponto = pontoReportData.find(p => p.date === date && p.installerName === installer?.name);
            
            const dailyRate = agenda?.dailyRate || installer?.dailyRate || 0;
            const hourlyRate = installer?.hourlyRate || 0;
            
            // Cálculo de horas extras
            // Consideramos extras se houver marcação manual de isExtra ou se exceder 9h
            let extraHoursDecimal = 0;
            if (ponto?.duration && ponto.duration !== '---') {
                const [h, m] = ponto.duration.replace('h', '').replace('m', '').split(' ').map(Number);
                const totalMins = (h * 60) + m;
                if (totalMins > 540) { // 9 horas
                    extraHoursDecimal = (totalMins - 540) / 60;
                }
            }
            
            const extraValue = extraHoursDecimal * hourlyRate;
            const totalToPay = dailyRate + extraValue;

            return {
                date,
                installerName: installer?.name || '---',
                statusAgenda: agenda?.status || 'Não Agendado',
                entrance: ponto?.entrance || '---',
                exit: ponto?.exit || '---',
                duration: ponto?.duration || '---',
                extraHours: extraHoursDecimal > 0 ? `${Math.floor(extraHoursDecimal)}h ${Math.round((extraHoursDecimal % 1) * 60)}m` : '---',
                extraValue,
                dailyRate,
                totalToPay
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [reportData, pontoReportData, installers]);

    const reportTotal = reportData.reduce((acc, curr) => acc + curr.dailyRate, 0);
    const fechamentoTotal = fechamentoReportData.reduce((acc, curr) => acc + curr.totalToPay, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <HardHat className="text-blue-600" size={28} /> Equipe de Instaladores
                    </h2>
                    <p className="text-slate-500 font-medium">Gestão de profissionais e controle de diárias.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'manage' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Gerenciar
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'report' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Relatório
                    </button>
                </div>
            </div>

            {activeTab === 'manage' ? (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar instalador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={handleOpenAdd}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all font-black uppercase text-[10px] tracking-widest"
                        >
                            <Plus size={18} /> Novo Instalador
                        </button>
                    </div>

                    {/* Grid de Instaladores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredInstallers.map(installer => (
                            <div key={installer.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-blue-300 transition-all">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl border transition-all shadow-sm ${installer.active ? 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {installer.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-md leading-tight">{installer.name}</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                    {installer.active ? 'Ativo' : 'Inativo'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleOpenEdit(installer)}
                                                className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Excluir instalador?')) onDelete(installer.id); }}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <DollarSign size={16} className="text-emerald-500" />
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Valor da Diária</p>
                                                <p className="font-bold text-slate-900">R$ {installer.dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                        {installer.phone && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <Phone size={16} className="text-blue-400" />
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Contato</p>
                                                    <p className="font-bold text-slate-900">{installer.phone}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID: {installer.id.split('-')[0]}</span>
                                    <div className={`h-2 w-2 rounded-full ${installer.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredInstallers.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
                            <User className="mx-auto text-slate-200 mb-4" size={48} />
                            <p className="text-slate-400 font-medium">Nenhum instalador encontrado.</p>
                        </div>
                    )}
                </div>
            ) : (
                /* Aba de Relatório */
                <div className="space-y-6">
                    {/* Filtros do Relatório */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Filter size={16} className="text-blue-600" />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Filtros do Relatório</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Relatório</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <button
                                        onClick={() => setReportType('fechamento')}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${reportType === 'fechamento' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 opacity-60'}`}
                                    >
                                        Fechamento Geral
                                    </button>
                                    <button
                                        onClick={() => setReportType('diarias')}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${reportType === 'diarias' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 opacity-60'}`}
                                    >
                                        Agenda
                                    </button>
                                    <button
                                        onClick={() => setReportType('ponto')}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${reportType === 'ponto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 opacity-60'}`}
                                    >
                                        Ponto
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Início</label>
                                <input
                                    type="date"
                                    value={reportStartDate}
                                    onChange={(e) => setReportStartDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Fim</label>
                                <input
                                    type="date"
                                    value={reportEndDate}
                                    onChange={(e) => setReportEndDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Instalador</label>
                                <select
                                    value={reportFilterInstallerId}
                                    onChange={(e) => setReportFilterInstallerId(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Todos os Instaladores</option>
                                    {installers.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <div className="bg-emerald-600/5 p-4 rounded-2xl border border-emerald-100 w-full flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase leading-none mb-1">Total a Pagar</p>
                                        <p className="text-xl font-black text-slate-900">R$ {(reportType === 'fechamento' ? fechamentoTotal : reportTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <DollarSign className="text-emerald-500" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {reportType === 'fechamento' ? (
                        /* Tabela de Fechamento Unificado */
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Instalador</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ponto (Ent/Saí)</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">H. Extras</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">A Pagar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {fechamentoReportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">Nenhum dado integrado encontrado no período.</td>
                                        </tr>
                                    ) : (
                                        fechamentoReportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-4 text-sm font-bold text-slate-700">
                                                    {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-8 py-4 text-sm font-black text-slate-900 uppercase">{row.installerName}</td>
                                                <td className="px-8 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${row.statusAgenda === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : row.statusAgenda === 'SCHEDULED' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        {row.statusAgenda}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-xs font-medium text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-emerald-600">{row.entrance}</span>
                                                        <span>/</span>
                                                        <span className="text-rose-600">{row.exit}</span>
                                                    </div>
                                                    <div className="text-[10px] font-black text-slate-400 mt-1">{row.duration}</div>
                                                </td>
                                                <td className="px-8 py-4">
                                                    {row.extraHours !== '---' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-amber-600">{row.extraHours}</span>
                                                            <span className="text-[9px] font-bold text-amber-500/70">R$ {row.extraValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">---</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <div className="text-sm font-black text-slate-900">R$ {row.totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Diária: R$ {row.dailyRate}</div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {fechamentoReportData.length > 0 && (
                                    <tfoot className="bg-slate-50">
                                        <tr>
                                            <td colSpan={5} className="px-8 py-4 text-xs font-black text-slate-900 uppercase text-right">Relatório de Fechamento Total:</td>
                                            <td className="px-8 py-4 text-xl font-black text-emerald-600 text-right whitespace-nowrap">R$ {fechamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    ) : reportType === 'diarias' ? (
                        /* Tabela do Relatório de Diárias */
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Instalador</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor da Diária</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">Nenhum registro de agenda encontrado no período.</td>
                                        </tr>
                                    ) : (
                                        reportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-4 text-sm font-bold text-slate-700 flex items-center gap-2">
                                                    <Calendar size={14} className="text-blue-400" />
                                                    {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-8 py-4 text-sm font-black text-slate-900 uppercase">{row.installerName}</td>
                                                <td className="px-8 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${row.status === 'COMPLETED'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {row.status === 'COMPLETED' ? 'Realizado' : 'Agendado'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-sm font-bold text-slate-900 text-right">R$ {row.dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {reportData.length > 0 && (
                                    <tfoot className="bg-slate-50">
                                        <tr>
                                            <td colSpan={3} className="px-8 py-4 text-xs font-black text-slate-900 uppercase text-right">Total Acumulado:</td>
                                            <td className="px-8 py-4 text-lg font-black text-slate-900 text-right">R$ {reportTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    ) : (
                        /* Tabela do Relatório de Ponto Eletrônico */
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Instalador</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Saída</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Permanência</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Localização</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pontoReportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">Nenhuma marcação de ponto encontrada no período.</td>
                                        </tr>
                                    ) : (
                                        pontoReportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                                                    {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-8 py-4 text-sm font-black text-slate-900 uppercase truncate max-w-[150px]">{row.installerName}</td>
                                                <td className="px-8 py-4 text-sm font-bold text-emerald-600">{row.entrance}</td>
                                                <td className="px-8 py-4 text-sm font-bold text-rose-600">{row.exit}</td>
                                                <td className="px-8 py-4 text-center">
                                                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black">
                                                        {row.duration}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500">
                                                        <Clock size={12} className={row.location === 'RTC - Sede' ? 'text-blue-500' : 'text-slate-300'} />
                                                        {row.location}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">
                                {editingInstaller ? 'Editar Instalador' : 'Novo Instalador'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase mapping-widest ml-1">Nome do Instalador</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input
                                            type="text" required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Ex: João da Silva"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor da Diária (R$)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="number" step="0.01" required
                                                value={formData.dailyRate}
                                                onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor da Hora Extra (R$)</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="number" step="0.01"
                                                value={formData.hourlyRate}
                                                onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Telefone</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 flex items-end">
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 w-full">
                                            <input
                                                type="checkbox"
                                                checked={formData.active}
                                                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                                id="installer-active"
                                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor="installer-active" className="text-[10px] font-black text-slate-400 uppercase">Ativo</label>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Usuário (Login)</label>
                                        <input
                                            type="text"
                                            value={formData.login}
                                            onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="ex: joao.instalador"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Senha de Acesso</label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 text-sm font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all"
                                >
                                    {editingInstaller ? 'Salvar Alterações' : 'Cadastrar Instalador'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Installers;
