
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Globe, Info, CheckCircle2, DownloadCloud, DatabaseBackup } from 'lucide-react';
import { dataService } from '../services/dataService';

interface SettingsProps {
    settings: { id: string, key: string, value: string }[];
    onUpdateSetting: (key: string, value: string) => Promise<void>;
}

const Settings = ({ settings, onUpdateSetting }: SettingsProps) => {
    const [scriptUrl, setScriptUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    useEffect(() => {
        const url = settings.find(s => s.key === 'google_apps_script_url')?.value || '';
        setScriptUrl(url);
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdateSetting('google_apps_script_url', scriptUrl);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            alert("Erro ao salvar configuração");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                        <SettingsIcon className="text-blue-600" size={28} /> Configurações do Sistema
                    </h2>
                    <p className="text-slate-500 font-medium italic">Gerencie chaves de API e integrações globais.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50"
                >
                    {saving ? 'Salvando...' : (
                        <>
                            <Save size={18} />
                            Salvar Alterações
                        </>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                            <Globe size={20} />
                        </div>
                        <h3 className="font-black text-lg text-slate-900 uppercase tracking-tighter">Integração Google Calendar</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-700">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <div className="text-xs font-medium space-y-1">
                                <p>Esta integração permite que os agendamentos sejam sincronizados automaticamente com a agenda dos vendedores.</p>
                                <p><strong>Como configurar:</strong> Crie um Google Apps Script, implante como "App da Web" e cole a URL abaixo.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL do Apps Script</label>
                            <input
                                type="text"
                                value={scriptUrl}
                                onChange={(e) => setScriptUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {success && (
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs animate-in fade-in slide-in-from-bottom-2">
                                <CheckCircle2 size={16} /> Configuração salva com sucesso!
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6 shadow-2xl">
                    <h3 className="font-black text-lg uppercase tracking-tighter text-blue-400">Status da Sincronização</h3>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                            <span className="text-xs font-bold text-slate-400 uppercase">Script Link</span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${scriptUrl ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {scriptUrl ? 'Configurado' : 'Pendente'}
                            </span>
                        </div>
                        
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dica de Uso</p>
                            <p className="text-xs text-slate-300 italic leading-relaxed">
                                "Certifique-se de que cada vendedor tenha seu e-mail do Google cadastrado na tela de Equipe de Vendas para que os convites funcionem corretamente."
                            </p>
                        </div>
                    </div>
                </div>

                {/* Backup Zone */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-8 rounded-[40px] border border-blue-200 shadow-sm space-y-6 md:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                    
                    <div className="flex items-center gap-3 relative">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20">
                            <DatabaseBackup size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-900 uppercase tracking-tighter">Segurança & Copia de Base</h3>
                            <p className="text-xs font-bold text-slate-500">Exporte toda a matriz do sistema para o seu Computador Oficial.</p>
                        </div>
                    </div>

                    <div className="space-y-4 relative">
                        <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white flex justify-between items-center max-md:flex-col gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-black text-slate-800">Exportação .JSON Criptografada</p>
                                <p className="text-xs font-medium text-slate-500">Baixa a raiz de 21 tabelas oficiais, incluindo Clientes de Ponta a Ponta e Cadastros Nativos.</p>
                            </div>
                            
                            <button
                                onClick={async () => {
                                    setIsBackingUp(true);
                                    try {
                                        const fileRaw = await dataService.generateSystemBackup();
                                        const jsonString = JSON.stringify(fileRaw, null, 2);
                                        const blob = new Blob([jsonString], { type: 'application/json' });
                                        const href = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = href;
                                        const dt = new Date();
                                        const fileDate = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}h${String(dt.getMinutes()).padStart(2,'0')}m`;
                                        link.download = `rtc_backup_global_${fileDate}.json`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(href);
                                    } catch (err) {
                                        alert("Falha catastrofica ao sugar tabelas. Contate Suporte.");
                                        console.error(err);
                                    } finally {
                                        setIsBackingUp(false);
                                    }
                                }}
                                disabled={isBackingUp}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black shadow-xl transition-all uppercase text-xs tracking-widest disabled:opacity-50 min-w-[200px] justify-center"
                            >
                                {isBackingUp ? (
                                    <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Exportando Base...</span>
                                ) : (
                                    <><DownloadCloud size={16} /> Gerar Backup Seguro</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
