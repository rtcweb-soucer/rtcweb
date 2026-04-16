import { Order, OrderStatus, Seller } from '../types';
import { evolutionService } from './evolutionService';

export const aiManagerService = {
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

    generateReminders(sellerName: string, quotes: Order[]) {
        const templates = [
            `Olá ${sellerName}, aqui é o Gerente IA. Notei que você tem ${quotes.length} orçamento(s) parado(s) há mais de 48h. Precisa de uma ajuda para fechar com esses clientes?`,
            `${sellerName}, vamos bater a meta? Verifiquei os orçamentos de ${quotes.map(q => q.customerName || 'clientes pendentes').slice(0, 2).join(', ')} e outros que ainda não converteram. Alguma dificuldade nesses itens?`,
            `Oi ${sellerName}! Passando para lembrar dos orçamentos pendentes. O total em negociação que está parado com você é de R$ ${quotes.reduce((acc, q) => acc + q.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Vamos pra cima!`
        ];

        // Retorna um template aleatório para variar
        return templates[Math.floor(Math.random() * templates.length)];
    },

    async sendReminder(sellerPhone: string, message: string) {
        if (!sellerPhone) throw new Error('Telefone do vendedor não cadastrado');
        // Limpar o número (manter apenas dígitos)
        const cleanNumber = sellerPhone.replace(/\D/g, '');
        return await evolutionService.sendMessage(cleanNumber, message);
    }
};
