import * as React from 'react';
import { useMemo, useState } from 'react';
import { 
  Bot, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  AlertCircle,
  ChevronRight,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  Briefcase,
  Trophy,
  Zap,
  Target,
  BarChart3,
  Timer
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { Order, OrderStatus, Seller, Customer, SystemUser, Appointment, SalesGoal } from '../types';
import { aiManagerService, SellerPerformance } from '../services/aiManagerService';
import { dataService } from '../services/dataService';
import { useEffect } from 'react';
import { Settings } from 'lucide-react';

interface IAManagerProps {
  orders: Order[];
  sellers: Seller[];
  customers: Customer[];
  appointments: Appointment[];
  currentUser: SystemUser;
}

const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

const IAManager = ({ orders, sellers, customers, appointments, currentUser }: IAManagerProps) => {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'FINANCE' || currentUser.role === 'MASTER';
  const [isSending, setIsSending] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedSellerReminders, setSelectedSellerReminders] = useState<{ sellerId: string, message: string } | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | 'month'>('7d');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);

  // --- Fetch Goals ---
  const fetchGoals = async () => {
    try {
      setIsLoadingGoals(true);
      const data = await dataService.getSalesGoals();
      setSalesGoals(data);
    } catch (err) {
      console.error('Error fetching sales goals:', err);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleSaveGoal = async (sellerId: string | null, amount: number) => {
    try {
      await dataService.saveSalesGoal(sellerId, amount);
      await fetchGoals();
    } catch (err: any) {
      alert(`Erro ao salvar meta: ${err.message}`);
    }
  };

  // --- Common Data Logic ---
  const performanceData = useMemo(() => {
    return aiManagerService.calculateSellerPerformance(orders, appointments, sellers, salesGoals, timeRange);
  }, [orders, appointments, sellers, salesGoals, timeRange]);

  const staleQuotesGrouped = useMemo(() => {
    const stale = aiManagerService.getStaleQuotes(orders, 48);
    return aiManagerService.groupBySeller(stale, sellers);
  }, [orders, sellers]);

  // --- Admin Specific Logic ---
  const managerStats = useMemo(() => {
    const totalQuotes = staleQuotesGrouped.reduce((acc, group) => acc + group.quotes.length, 0);
    const totalValue = performanceData.reduce((acc, p) => acc + p.totalValue, 0);
    const avgConversion = performanceData.length > 0 ? performanceData.reduce((acc, p) => acc + p.conversionRate, 0) / performanceData.length : 0;

    return { totalQuotes, totalValue, avgConversion };
  }, [staleQuotesGrouped, performanceData]);

  const funnelData = useMemo(() => {
    const statusCounts = orders.reduce((acc: any, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    return [
      { name: 'Orçamentos', value: statusCounts[OrderStatus.QUOTE_SENT] || 0 },
      { name: 'Contatos', value: statusCounts[OrderStatus.CONTRACT_SIGNED] || 0 },
      { name: 'Produção', value: statusCounts[OrderStatus.IN_PRODUCTION] || 0 },
      { name: 'Entregues', value: (statusCounts[OrderStatus.FINISHED] || 0) + (statusCounts[OrderStatus.DELIVERED] || 0) },
    ];
  }, [orders]);

  // --- Seller Specific Logic ---
  const sellerData = useMemo(() => {
    if (isAdmin) return null;
    return performanceData.find(p => p.sellerId === currentUser.sellerId) || {
      sellerId: currentUser.sellerId || '',
      sellerName: currentUser.name,
      totalQuotes: 0,
      totalOrders: 0,
      totalValue: 0,
      conversionRate: 0,
      averageTicket: 0,
      avgSpeedToQuote: 0,
      staleQuotesCount: 0
    };
  }, [performanceData, isAdmin, currentUser]);

  const aiInsights = useMemo(() => {
    const globalGoalObj = salesGoals.find(g => g.sellerId === null);
    const globalGoal = globalGoalObj ? globalGoalObj.goalAmount : 200000;
    const periodGoal = timeRange === 'month' ? globalGoal : (globalGoal / 30) * 7;

    if (isAdmin) {
      return aiManagerService.getAIPerspective(performanceData, timeRange, periodGoal, true);
    } else if (sellerData) {
      const p = sellerData as SellerPerformance;
      const sGoal = p.monthlyGoal || globalGoal;
      const sPeriodGoal = timeRange === 'month' ? sGoal : (sGoal / 30) * 7;
      return aiManagerService.getAIPerspective([p], timeRange, sPeriodGoal, false);
    }
    return null;
  }, [isAdmin, performanceData, sellerData, timeRange]);

  const handleSendReminder = async (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes, managerStats.totalValue);
    setIsSending(seller.id);
    
    try {
      if (!seller.phone) throw new Error('Vendedor sem telefone cadastrado.');
      await aiManagerService.sendReminder(seller.phone, message);
      setSuccessMessage(`Cobrança de meta enviada para ${seller.name}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSending(null);
      setSelectedSellerReminders(null);
    }
  };

  const handlePreview = (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes, managerStats.totalValue);
    setSelectedSellerReminders({ sellerId: seller.id, message });
  };

  // --- RENDER SELLER VIEW ---
  if (!isAdmin) {
    return (
      <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 bg-gradient-to-r from-purple-700 to-indigo-800 p-8 rounded-[40px] text-white shadow-xl">
           <div className="p-4 bg-white/20 backdrop-blur-md rounded-3xl">
              <Bot size={40} />
           </div>
           <div>
              <h2 className="text-2xl font-black">Meu Consultor IA</h2>
              <p className="opacity-80 font-medium">Olá {currentUser.name}, vamos bater a meta de 200k!</p>
           </div>
        </div>

        {/* Priority Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Zap size={14} className="text-amber-500" /> Ações Prioritárias
              </h3>
              <div className="space-y-3">
                 {Array.isArray(aiInsights) && aiInsights.map((msg, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-purple-500 flex gap-3 items-start">
                       <div className="mt-1 text-purple-600"><Target size={18} /></div>
                       <p className="text-sm font-bold text-slate-700 leading-relaxed">{msg}</p>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Minha Performance (Recentemente)</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 bg-purple-50 rounded-3xl">
                    <p className="text-[10px] font-black text-purple-400 uppercase mb-1">Conversão</p>
                    <p className="text-2xl font-black text-purple-700">{Math.round(sellerData?.conversionRate || 0)}%</p>
                 </div>
                 <div className="p-6 bg-emerald-50 rounded-3xl">
                    <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Total Vendido</p>
                    <p className="text-lg font-black text-emerald-700">R$ {sellerData?.totalValue.toLocaleString('pt-BR')}</p>
                 </div>
                 <div className="p-6 bg-amber-50 rounded-3xl">
                    <p className="text-[10px] font-black text-amber-400 uppercase mb-1">Tempo Médio</p>
                    <p className="text-2xl font-black text-amber-700">{Math.round(sellerData?.avgSpeedToQuote || 0)}h</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ticket Médio</p>
                    <p className="text-lg font-black text-slate-700">R$ {Math.round(sellerData?.averageTicket || 0).toLocaleString('pt-BR')}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* My Stale Quotes */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-rose-50 opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={80} />
          </div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Orçamentos que são Prioridade de Meta</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {orders.filter(o => o.sellerId === currentUser.sellerId && o.status === OrderStatus.QUOTE_SENT)
               .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
               .slice(0, 9)
               .map(quote => {
                  const customer = customers.find(c => c.id === quote.customerId);
                  const hours = Math.floor((new Date().getTime() - new Date(quote.createdAt).getTime()) / (1000 * 60 * 60));
                  return (
                    <div key={quote.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between gap-4">
                       <div>
                          <div className="flex items-center justify-between mb-2">
                             <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${hours > 48 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                Parado há {hours}h
                             </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 truncate">{customer?.name || 'Cliente'}</p>
                          <p className="text-[11px] font-bold text-slate-500">R$ {quote.totalValue.toLocaleString('pt-BR')}</p>
                       </div>
                    </div>
                  );
               })}
             {orders.filter(o => o.sellerId === currentUser.sellerId && o.status === OrderStatus.QUOTE_SENT).length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-400 font-medium">
                   Não há orçamentos parados no momento. Excelente!
                </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER ADMIN VIEW ---
  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/20">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Gerente IA</h2>
            <p className="text-slate-500 text-sm font-medium">Visão estratégica e autonomia de cobrança (Meta 200k).</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex p-1 bg-slate-100 rounded-2xl">
             <button 
               onClick={() => setActiveTab('dashboard')}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
             >
                Dashboard
             </button>
             <button 
               onClick={() => setActiveTab('settings')}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
             >
                <Settings size={14} className="inline mr-1" /> Configurações
             </button>
          </div>
        )}
        <div className="flex p-1 bg-slate-100 rounded-2xl">
           <button 
             onClick={() => setTimeRange('7d')}
             className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === '7d' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
           >
              Agressivo (7d)
           </button>
           <button 
             onClick={() => setTimeRange('month')}
             className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === 'month' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
           >
              Estratégico (Mês)
           </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                    <Target size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">Meta Global RTC</h3>
                    <p className="text-sm text-slate-500 font-medium">Meta padrão para todos os vendedores que não possuem meta individual.</p>
                 </div>
              </div>

              <div className="flex items-end gap-4">
                 <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor da Meta Mensal</label>
                    <div className="relative">
                       <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                       <input 
                         type="number"
                         placeholder="200.000"
                         className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 ring-purple-500"
                         defaultValue={salesGoals.find(g => g.sellerId === null)?.goalAmount || 200000}
                         onBlur={(e) => handleSaveGoal(null, Number(e.target.value))}
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Metas Individuais por Vendedor</h3>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50">
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Meta Mensal Personalizada (R$)</th>
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {sellers.map((seller) => {
                          const goal = salesGoals.find(g => g.sellerId === seller.id);
                          return (
                             <tr key={seller.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                                         {seller.name.charAt(0)}
                                      </div>
                                      <span className="text-sm font-black text-slate-900">{seller.name}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="relative max-w-[200px]">
                                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                      <input 
                                        type="number"
                                        placeholder="Meta Global"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 focus:ring-2 ring-purple-500"
                                        defaultValue={goal?.goalAmount || ''}
                                        onBlur={(e) => handleSaveGoal(seller.id, Number(e.target.value))}
                                      />
                                   </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                   {goal ? (
                                      <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Personalizada</span>
                                   ) : (
                                      <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase">Usando Global</span>
                                   )}
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : (
      <>

      {/* Meta de Faturamento Progress Bar */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden relative">
         {(() => {
            const globalGoalObj = salesGoals.find(g => g.sellerId === null);
            const globalGoal = globalGoalObj ? globalGoalObj.goalAmount : 200000;
            const periodGoal = timeRange === 'month' ? globalGoal : (globalGoal / 30) * 7;
            const progress = (managerStats.totalValue / periodGoal) * 100;
            return (
               <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                     <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Target size={14} className="text-purple-600" /> Meta Proporcional ({timeRange === '7d' ? '7 dias' : 'Mês'})
                        </h3>
                        <p className="text-2xl font-black text-slate-900">R$ {periodGoal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">Progresso no Período</p>
                        <p className="text-xl font-black text-purple-600">{Math.round(progress)}%</p>
                     </div>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                     <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-1000" 
                        style={{ width: `${Math.min(progress, 100)}%` }} 
                     />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                     Faltam R$ {Math.max(periodGoal - managerStats.totalValue, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} para atingir a meta do período
                  </p>
               </>
            );
         })()}
      </div>

      {/* Admin Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Faturado</p>
          <p className="text-3xl font-black text-slate-900">R$ {managerStats.totalValue.toLocaleString('pt-BR')}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <TrendingUp size={12} /> {timeRange === '7d' ? '7 dias' : 'Mês Vigente'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px) font-black text-slate-400 uppercase tracking-widest mb-1">Conversão Média</p>
          <p className="text-3xl font-black text-slate-900">{Math.round(managerStats.avgConversion)}%</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-purple-600 bg-purple-50 w-fit px-2 py-1 rounded-lg">
            <Target size={12} /> Eficiência do Time
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orçamentos Pendentes</p>
          <p className="text-3xl font-black text-slate-900">{managerStats.totalQuotes}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-rose-600 bg-rose-50 w-fit px-2 py-1 rounded-lg">
            <Clock size={12} /> Requer Atenção
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Funnel Chart */}
         <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Funil de Conversão</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={funnelData} margin={{ left: 40 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                     />
                     <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={30} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* AI Perspective Card */}
         <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 text-white/5 pointer-events-none">
               <Bot size={150} />
            </div>
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-6">Autonomia IA: Monitor de Meta 200k</h3>
            <div className="space-y-6 relative z-10">
               <div>
                  <p className="text-xl font-bold leading-relaxed">
                     {aiInsights && (aiInsights as any).summary}
                  </p>
               </div>
               <div className="p-5 bg-white/10 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                     <Trophy size={18} className="text-amber-400" />
                     <p className="text-xs font-black uppercase tracking-wider text-amber-400">Destaque</p>
                  </div>
                  <p className="text-sm font-medium opacity-90">{aiInsights && (aiInsights as any).topPerformance}</p>
               </div>
               <div className="p-5 bg-rose-500/10 rounded-3xl border border-rose-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                     <AlertCircle size={18} className="text-rose-400" />
                     <p className="text-xs font-black uppercase tracking-wider text-rose-400">Ação Autônoma de Cobrança</p>
                  </div>
                  <p className="text-sm font-medium opacity-90">{aiInsights && (aiInsights as any).alerts}</p>
               </div>
            </div>
         </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ranking de Faturamento ({timeRange === '7d' ? '7 dias' : 'Mês Vigente'})</h3>
            <BarChart3 size={20} className="text-slate-300" />
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50">
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Vendas</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Conversão</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Velocidade</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Faturamento</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {performanceData.sort((a, b) => b.totalValue - a.totalValue).map((p, idx) => (
                     <tr key={p.sellerId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-slate-300">#{idx + 1}</span>
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                 {p.sellerName.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900">{p.sellerName}</span>
                                 <span className="text-[10px] font-bold text-slate-400">Meta: R$ {p.monthlyGoal.toLocaleString('pt-BR')}</span>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <span className="text-sm font-bold text-slate-600">{p.totalOrders} pedidos</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                 <div className="h-full bg-purple-500" style={{ width: `${Math.min(p.goalProgress, 100)}%` }} />
                              </div>
                              <span className="text-xs font-black text-slate-900">{Math.round(p.goalProgress)}%</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <div className="flex items-center justify-center gap-1.5 text-amber-600">
                              <Timer size={14} />
                              <span className="text-xs font-bold">{Math.round(p.avgSpeedToQuote)}h</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <span className="text-sm font-black text-purple-600">R$ {p.totalValue.toLocaleString('pt-BR')}</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Suggested Follow-ups */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Autonomia de Cobrança: Pressionar Meta</h3>
        
        {staleQuotesGrouped.length === 0 ? (
          <div className="bg-white p-12 rounded-[40px] border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-black text-slate-900">Tudo em dia!</h4>
            <p className="text-slate-500 max-w-xs mx-auto">Nenhum orçamento parado bloqueando a nossa meta de 200k.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {staleQuotesGrouped.map((group) => (
              <div key={group.seller.id} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black">
                      {group.seller.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">{group.seller.name}</h4>
                      <p className="text-xs text-slate-500 font-bold">{group.quotes.length} itens parados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Impacto Meta</p>
                    <p className="text-lg font-black text-purple-600">
                      R$ {group.quotes.reduce((acc, q) => acc + q.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => handlePreview(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    <Eye size={16} /> Preview IA
                  </button>
                  <button 
                    disabled={isSending === group.seller.id}
                    onClick={() => handleSendReminder(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-2xl text-xs font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isSending === group.seller.id ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                    Pressionar Agora
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedSellerReminders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-100 bg-purple-50">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-purple-600 text-white rounded-2xl">
                       <MessageSquare size={24} />
                    </div>
                    <button 
                      onClick={() => setSelectedSellerReminders(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                       <AlertCircle className="rotate-45" size={24} />
                    </button>
                 </div>
                 <h4 className="text-xl font-black text-slate-900">Cobrança de Meta Desatada</h4>
                 <p className="text-sm text-slate-500 font-medium">Esta mensagem agressiva foca na meta de faturamento de 200k.</p>
              </div>
              <div className="p-8">
                 <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-700 font-medium leading-relaxed italic text-sm">
                       "{selectedSellerReminders.message}"
                    </p>
                 </div>
                 <div className="mt-8 flex gap-3">
                    <button 
                       onClick={() => setSelectedSellerReminders(null)}
                       className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                       Ajustar
                    </button>
                    <button 
                       onClick={() => {
                          const group = staleQuotesGrouped.find(g => g.seller.id === selectedSellerReminders.sellerId);
                          if (group) handleSendReminder(group.seller, group.quotes);
                       }}
                       className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                    >
                       Confirmar Envio
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-8 right-8 z-[60] bg-emerald-500 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-right-full duration-500">
          <CheckCircle2 size={24} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default IAManager;
