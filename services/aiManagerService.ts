import { Order, OrderStatus, Seller, Appointment } from '../types';
import { evolutionService } from './evolutionService';

export interface SellerPerformance {
    sellerId: string;
    sellerName: string;
    totalQuotes: number;
    totalOrders: number;
    totalValue: number;
    conversionRate: number;
    averageTicket: number;
    avgSpeedToQuote: number; // in hours
    staleQuotesCount: number;
    monthlyGoal: number; // New
    goalProgress: number; // New
}

export const aiManagerService = {
    REVENUE_GOAL: 200000,
    
    getStaleQuotes(orders: Order[], thresholdHours: number = 48) {
        const now = new Date();
        return orders.filter(order => {
            if (order.status !== OrderStatus.QUOTE_SENT) return false;
            
            const createdAt = new Date(order.createdAt);
            const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            return diffHours >= thresholdHours;
        });
    },

    groupBySeller(staleQuotes: Order[], sellers: Seller[]) {
        const grouped: Record<string, { seller: Seller, quotes: Order[] }> = {};

        staleQuotes.forEach(quote => {
            if (!grouped[quote.sellerId]) {
                const seller = sellers.find(s => s.id === quote.sellerId);
                if (seller) {
                    grouped[quote.sellerId] = { seller, quotes: [] };
                }
            }
            if (grouped[quote.sellerId]) {
                grouped[quote.sellerId].quotes.push(quote);
            }
        });

        return Object.values(grouped);
    },

    calculateSellerPerformance(orders: Order[], appointments: Appointment[], sellers: Seller[], salesGoals: any[], period: '7d' | 'month' = 'month'): SellerPerformance[] {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

        let startDate: Date;
        let endDate: Date = now;
        let periodDays = 30; // default for month

        const globalGoalObj = salesGoals.find(g => g.sellerId === null);
        const GLOBAL_MONTHLY_TARGET = globalGoalObj ? globalGoalObj.goalAmount : this.REVENUE_GOAL;

        if (period === '7d') {
            if (day <= 7) {
                startDate = new Date(year, month, 1);
                periodDays = 7;
            } else if (day <= 14) {
                startDate = new Date(year, month, 8);
                periodDays = 7;
            } else if (day <= 21) {
                startDate = new Date(year, month, 15);
                periodDays = 7;
            } else {
                startDate = new Date(year, month, 22);
                periodDays = lastDayOfMonth - 21;
            }
        } else {
            startDate = new Date(year, month, 1);
            periodDays = lastDayOfMonth;
        }

        return sellers.map(seller => {
            const sellerOrders = orders.filter(o => o.sellerId === seller.id && new Date(o.createdAt) >= startDate);
            const quotes = sellerOrders.filter(o => o.status === OrderStatus.QUOTE_SENT);
            const closed = sellerOrders.filter(o => o.status !== OrderStatus.QUOTE_SENT && o.status !== OrderStatus.PENDING_MEASUREMENT);
            
            const totalValue = closed.reduce((acc, o) => acc + (o.totalValue || 0), 0);
            const conversionRate = sellerOrders.length > 0 ? (closed.length / sellerOrders.length) * 100 : 0;
            const averageTicket = closed.length > 0 ? totalValue / closed.length : 0;

            const measurements = appointments.filter(a => a.sellerId === seller.id && a.type === 'MEASUREMENT' && a.status === 'COMPLETED');
            let totalHours = 0;
            let count = 0;

            measurements.forEach(m => {
                const relatedOrder = orders.find(o => o.customerId === m.customerId && new Date(o.createdAt) >= new Date(m.date));
                if (relatedOrder) {
                    const diff = (new Date(relatedOrder.createdAt).getTime() - new Date(`${m.date}T${m.time || '08:00'}:00`).getTime()) / (1000 * 60 * 60);
                    if (diff > 0) {
                        totalHours += diff;
                        count++;
                    }
                }
            });

            const avgSpeedToQuote = count > 0 ? totalHours / count : 0;
            const staleQuotesCount = this.getStaleQuotes(sellerOrders, 48).length;

            // Goal calculation
            const sellerGoalObj = salesGoals.find(g => g.sellerId === seller.id);
            const monthGoal = sellerGoalObj?.goalAmount || GLOBAL_MONTHLY_TARGET;
            const periodGoal = (monthGoal / lastDayOfMonth) * periodDays;
            const goalProgress = (totalValue / periodGoal) * 100;

            return {
                sellerId: seller.id,
                sellerName: seller.name,
                totalQuotes: quotes.length,
                totalOrders: closed.length,
                totalValue,
                conversionRate,
                averageTicket,
                avgSpeedToQuote,
                staleQuotesCount,
                monthlyGoal: monthGoal,
                goalProgress
            };
        });
    },

    getAIPerspective(performance: SellerPerformance[], period: '7d' | 'month', periodGoal: number, isManager: boolean = true) {
        const totalValue = performance.reduce((acc, p) => acc + p.totalValue, 0);
        const goalProgress = (totalValue / periodGoal) * 100;
        
        const now = new Date();
        const day = now.getDate();
        let periodLabel = 'mês vigente';
        if (period === '7d') {
            if (day <= 7) periodLabel = 'Semana 1 (1-7)';
            else if (day <= 14) periodLabel = 'Semana 2 (8-14)';
            else if (day <= 21) periodLabel = 'Semana 3 (15-21)';
            else periodLabel = 'Semana 4+ (22-fim)';
        }

        if (!isManager && performance.length === 1) {
            const p = performance[0];
            const messages = [];
            
            if (p.goalProgress < 80) {
                messages.push(`🚀 FOCO NA META: No período de ${periodLabel}, sua meta proporcional é R$ ${periodGoal.toLocaleString('pt-BR')}. Seu faturamento atual é de R$ ${p.totalValue.toLocaleString('pt-BR')}. Vamos acelerar!`);
            } else if (p.goalProgress >= 100) {
                messages.push(`🎯 META BATIDA! Você superou o objetivo proporcional de ${periodLabel}. Continue assim para garantir o recorde do mês!`);
            }

            if (p.staleQuotesCount > 0) messages.push(`⚠️ Você tem ${p.staleQuotesCount} orçamentos parados há mais de 48h. Vamos resgatar essas vendas!`);
            if (p.avgSpeedToQuote > 24) messages.push(`⏱️ Notei lentidão no envio: média de ${Math.round(p.avgSpeedToQuote)}h. Reduzir esse tempo aumentará sua conversão imediatamente.`);
            
            return messages;
        }

        const topSeller = [...performance].sort((a, b) => b.totalValue - a.totalValue)[0];
        const needingAttention = performance.filter(p => p.conversionRate < 20 || p.avgSpeedToQuote > 48);
        
        const currentDay = new Date().getDate();
        const projectedMonthly = (totalValue / (period === '7d' ? 7 : currentDay)) * 30;

        let statusMessage = `Faturamento (${periodLabel}): R$ ${totalValue.toLocaleString('pt-BR')} (${Math.round(goalProgress)}% da meta de R$ ${periodGoal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}).`;
        
        if (projectedMonthly < periodGoal) {
            statusMessage += ` ⚠️ Alerta: No ritmo de ${periodLabel}, fecharemos o mês com R$ ${Math.round(projectedMonthly).toLocaleString('pt-BR')}. Precisamos de mais agressividade!`;
        } else {
            statusMessage += ` ✅ Ótimo! No ritmo de ${periodLabel}, ultrapassaremos a meta mensal definida.`;
        }

        return {
            summary: statusMessage,
            topPerformance: topSeller ? `${topSeller.sellerName} é o destaque com R$ ${topSeller.totalValue.toLocaleString('pt-BR')}.` : '',
            alerts: needingAttention.length > 0 ? `${needingAttention.length} vendedores abaixo da média. Autonomia de cobrança ativada para garantir o resultado.` : 'Equipe operando em ritmo saudável.'
        };
    },

    generateReminders(sellerName: string, quotes: Order[], currentRevenue: number = 0) {
        const totalPending = quotes.reduce((acc, q) => acc + q.totalValue, 0);
        const gap = this.REVENUE_GOAL - currentRevenue;

        const templates = [
            `Olá ${sellerName}, aqui é o Gerente IA. Nossa meta de R$ 200.000,00 está no radar! Você tem R$ ${totalPending.toLocaleString('pt-BR')} em orçamentos parados que podem nos ajudar a chegar lá. Vamos fechar?`,
            `${sellerName}, foco no faturamento! Faltam R$ ${gap > 0 ? gap.toLocaleString('pt-BR') : '0'} para batermos a meta total. Notei que você tem orçamentos parados dos clientes: ${quotes.map(q => q.customerName).slice(0, 2).join(', ')}. Qual a dificuldade neles?`,
            `Oi ${sellerName}! Como está o follow-up? Precisamos de força total para atingir os 200k este mês. Seu apoio com os ${quotes.length} orçamentos pendentes é fundamental agora. Posso contar com você?`,
            `⚠️ AVISO DE META: ${sellerName}, o Gerente IA identificou que sua velocidade de fechamento precisa aumentar para alcançarmos os 200k. R$ ${totalPending.toLocaleString('pt-BR')} estão aguardando sua ação. Vamos pra cima!`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    },

    async sendReminder(sellerPhone: string, message: string) {
        if (!sellerPhone) throw new Error('Telefone do vendedor não cadastrado');
        const cleanNumber = sellerPhone.replace(/\D/g, '');
        return await evolutionService.sendMessage(cleanNumber, message);
    }
};
