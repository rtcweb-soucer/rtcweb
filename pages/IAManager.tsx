
import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
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
  Briefcase
} from 'lucide-react';
import { Order, OrderStatus, Seller, Customer, SystemUser } from '../types';
import { aiManagerService } from '../services/aiManagerService';

interface IAManagerProps {
  orders: Order[];
  sellers: Seller[];
  customers: Customer[];
  currentUser: SystemUser;
}

const IAManager = ({ orders, sellers, customers, currentUser }: IAManagerProps) => {
  const [isSending, setIsSending] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedSellerReminders, setSelectedSellerReminders] = useState<{ sellerId: string, message: string } | null>(null);

  const staleQuotesGrouped = useMemo(() => {
    const stale = aiManagerService.getStaleQuotes(orders, 48); // 48h threshold
    return aiManagerService.groupBySeller(stale, sellers);
  }, [orders, sellers]);

  const stats = useMemo(() => {
    const totalQuotes = staleQuotesGrouped.reduce((acc, group) => acc + group.quotes.length, 0);
    const totalValue = staleQuotesGrouped.reduce((acc, group) => 
      acc + group.quotes.reduce((sum, q) => sum + q.totalValue, 0), 0
    );
    const sellersImpacted = staleQuotesGrouped.length;

    return { totalQuotes, totalValue, sellersImpacted };
  }, [staleQuotesGrouped]);

  const handleSendReminder = async (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes);
    setIsSending(seller.id);
    
    try {
      if (!seller.phone) throw new Error('Vendedor sem telefone cadastrado.');
      
      await aiManagerService.sendReminder(seller.phone, message);
      setSuccessMessage(`Lembrete enviado para ${seller.name}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSending(null);
      setSelectedSellerReminders(null);
    }
  };

  const handlePreview = (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes);
    setSelectedSellerReminders({ sellerId: seller.id, message });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/20">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Gerente IA</h2>
            <p className="text-slate-500 text-sm font-medium">Monitoramento proativo e cobrança de negociações paradas.</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-rose-50 opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={80} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orçamentos Parados (+48h)</p>
          <p className="text-3xl font-black text-slate-900">{stats.totalQuotes}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-rose-600 bg-rose-50 w-fit px-2 py-1 rounded-lg">
            <AlertCircle size={12} /> Requer Atenção
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-emerald-50 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={80} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor em Negociação</p>
          <p className="text-3xl font-black text-slate-900">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <TrendingUp size={12} /> Recuperação Potencial
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-blue-50 opacity-10 group-hover:scale-110 transition-transform">
            <Users size={80} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendedores Pendentes</p>
          <p className="text-3xl font-black text-slate-900">{stats.sellersImpacted}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-lg">
            <MessageSquare size={12} /> Lembretes a Enviar
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <CheckCircle2 size={20} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* Sellers List */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Detalhamento por Vendedor</h3>
        
        {staleQuotesGrouped.length === 0 ? (
          <div className="bg-white p-12 rounded-[40px] border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-black text-slate-900">Tudo em dia!</h4>
            <p className="text-slate-500 max-w-xs mx-auto">Não encontramos orçamentos parados há mais de 48h no momento.</p>
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
                      <p className="text-xs text-slate-500 font-bold">{group.quotes.length} orçamentos pendentes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Total</p>
                    <p className="text-lg font-black text-purple-600">
                      R$ {group.quotes.reduce((acc, q) => acc + q.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-6 flex-1 space-y-3">
                  {group.quotes.slice(0, 3).map((quote) => {
                    const customer = customers.find(c => c.id === quote.customerId);
                    const days = Math.floor((new Date().getTime() - new Date(quote.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={quote.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-400" />
                          <div>
                            <p className="text-xs font-black text-slate-900 truncate max-w-[150px]">{customer?.name || 'Cliente Desconhecido'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{quote.quoteNumber || quote.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-rose-500 font-black uppercase">{days} dias atrás</p>
                        </div>
                      </div>
                    );
                  })}
                  {group.quotes.length > 3 && (
                    <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">
                      e mais {group.quotes.length - 3} orçamentos...
                    </p>
                  )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => handlePreview(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    <Eye size={16} /> Ver Preview
                  </button>
                  <button 
                    disabled={isSending === group.seller.id}
                    onClick={() => handleSendReminder(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-2xl text-xs font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isSending === group.seller.id ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                    Cobrar Vendedor
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
                 <h4 className="text-xl font-black text-slate-900">Preview do Lembrete</h4>
                 <p className="text-sm text-slate-500 font-medium">Esta é a mensagem que será enviada via WhatsApp.</p>
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
                       Cancelar
                    </button>
                    <button 
                       onClick={() => {
                          const group = staleQuotesGrouped.find(g => g.seller.id === selectedSellerReminders.sellerId);
                          if (group) handleSendReminder(group.seller, group.quotes);
                       }}
                       className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                    >
                       Enviar Agora
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default IAManager;
