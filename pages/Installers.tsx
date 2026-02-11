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
    Download
} from 'lucide-react';
import { Installer, Appointment } from '../types';

interface InstallersProps {
    installers: Installer[];
    appointments: Appointment[];
    onAdd: (i: Installer) => void;
    onUpdate: (i: Installer) => void;
    onDelete: (id: string) => void;
}

const Installers = ({
    installers,
    appointments,
    onAdd,
    onUpdate,
    onDelete
}: InstallersProps) => {
    const [activeTab, setActiveTab] = useState<'manage' | 'report'>('manage');
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
        active: true
    });

    const handleOpenAdd = () => {
        setEditingInstaller(null);
        setFormData({ name: '', phone: '', dailyRate: 0, active: true });
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
        // 1. Filtrar agendamentos concluídos no período
        const completedApps = appointments.filter(app => {
            if (app.status !== 'COMPLETED') return false;
            // Se for do tipo MEASUREMENT, talvez não conte diária de instalador? 
            // Geralmente diária é para instalação. Vou incluir todos que tenham instaladores vinculados.
            if (!app.installerIds || app.installerIds.length === 0) return false;

            return app.date >= reportStartDate && app.date <= reportEndDate;
        });

        // 2. Mapear diárias por (Installer, Data)
        // Usamos um Set de strings "installerId|date" para garantir unicidade por dia
        const workedDays = new Set<string>();
        completedApps.forEach(app => {
            app.installerIds?.forEach(id => {
                if (!reportFilterInstallerId || id === reportFilterInstallerId) {
                    workedDays.add(`${id}|${app.date}`);
                }
            });
        });

        // 3. Transformar em lista para exibição
        const results = Array.from(workedDays).map(key => {
            const [installerId, date] = key.split('|');
            const installer = installers.find(i => i.id === installerId);
            return {
                installerName: installer?.name || 'Desconhecido',
                date,
                dailyRate: installer?.dailyRate || 0
            };
        });

        // Ordenar por data
        return results.sort((a, b) => b.date.localeCompare(a.date));
    }, [appointments, installers, reportStartDate, reportEndDate, reportFilterInstallerId]);

    const reportTotal = reportData.reduce((acc, curr) => acc + curr.dailyRate, 0);

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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-100 w-full flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">Total a Pagar</p>
                                        <p className="text-xl font-black text-slate-900">R$ {reportTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <TrendingUp className="text-blue-500" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela do Relatório */}
                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Instalador</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor da Diária</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-12 text-center text-slate-400 italic">Nenhum registro encontrado no período selecionado.</td>
                                    </tr>
                                ) : (
                                    reportData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4 text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-400" />
                                                {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-8 py-4 text-sm font-black text-slate-900 uppercase">{row.installerName}</td>
                                            <td className="px-8 py-4 text-sm font-bold text-emerald-600 text-right">R$ {row.dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {reportData.length > 0 && (
                                <tfoot className="bg-slate-50">
                                    <tr>
                                        <td colSpan={2} className="px-8 py-4 text-xs font-black text-slate-900 uppercase text-right">Total Acumulado:</td>
                                        <td className="px-8 py-4 text-lg font-black text-slate-900 text-right">R$ {reportTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
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
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor da Diária</label>
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
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                        id="installer-active"
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="installer-active" className="text-sm font-bold text-slate-700">Instalador Ativo (Disponível para agendamentos)</label>
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
