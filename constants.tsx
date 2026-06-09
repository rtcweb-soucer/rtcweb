
import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserSquare,
  Ruler,
  FileText,
  Package,
  Calendar,
  Wallet,
  Factory,
  CheckCircle2,
  Briefcase,
  Truck,
  Zap,
  ShieldAlert,
  Users2,
  Receipt,
  Coins,
  HardHat,
  ShoppingCart,
  CheckSquare,
  BarChart3,
  Bot,
  Clock,
  MessageSquare,
  Settings as SettingsIcon
} from 'lucide-react';

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'crm', label: 'CRM WhatsApp', icon: <MessageSquare size={20} className="text-emerald-500" />, roles: ['ADMIN', 'SELLER', 'ATTENDANT'] },
  { id: 'quick-quote', label: 'Orçamento Rápido', icon: <Zap size={20} className="text-amber-500" />, roles: ['ADMIN', 'SELLER', 'ATTENDANT'] },
  { id: 'sellers', label: 'Equipe de Vendas', icon: <UserSquare size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'customers', label: 'Clientes', icon: <Users size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'products', label: 'Produtos', icon: <Package size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'schedule', label: 'Agendamentos', icon: <Calendar size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'my-schedule', label: 'Minha Agenda', icon: <Calendar size={20} />, roles: ['SELLER'] },
  { id: 'agenda', label: 'Agenda', icon: <Calendar size={20} className="text-blue-500" />, roles: ['ADMIN', 'ATTENDANT', 'SELLER'] },
  { id: 'measurements', label: 'Medições/Fichas', icon: <Ruler size={20} />, roles: ['ADMIN', 'SELLER'] },
  { id: 'quotes', label: 'Orçamentos', icon: <FileText size={20} />, roles: ['ADMIN', 'ATTENDANT', 'SELLER'] },
  { id: 'orders', label: 'Pedidos', icon: <Briefcase size={20} />, roles: ['ADMIN', 'ATTENDANT', 'SELLER'] },
  { id: 'tarefas', label: 'Tarefas', icon: <CheckSquare size={20} className="text-blue-600" />, roles: ['ADMIN', 'ATTENDANT', 'SELLER', 'PRODUCTION', 'BUYER'] },
  { id: 'pcp', label: 'PCP (Produção)', icon: <Factory size={20} />, roles: ['ADMIN', 'PRODUCTION'] },
  { id: 'buyer', label: 'Compras', icon: <ShoppingCart size={20} className="text-emerald-500" />, roles: ['ADMIN', 'PRODUCTION', 'BUYER'] },
  { id: 'raw-material-stock', label: 'Estoque Matéria-Prima', icon: <Package size={20} className="text-indigo-500" />, roles: ['ADMIN', 'PRODUCTION', 'BUYER'] },
  { id: 'installations', label: 'Instalações', icon: <Truck size={20} />, roles: ['ADMIN', 'ATTENDANT', 'PRODUCTION'] },
  { id: 'finance', label: 'Contas a Receber', icon: <Wallet size={20} />, roles: ['ADMIN'] },
  { id: 'expenses', label: 'Despesas', icon: <Receipt size={20} className="text-rose-500" />, roles: ['ADMIN'] },
  { id: 'commissions', label: 'Comissões', icon: <Coins size={20} className="text-amber-500" />, roles: ['ADMIN'] },
  { id: 'sales-report', label: 'Relatório de Vendas', icon: <BarChart3 size={20} className="text-indigo-500" />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'gerente-ia', label: 'Gerente IA', icon: <Bot size={20} className="text-purple-600" />, roles: ['ADMIN', 'SELLER'] },
  { id: 'installers', label: 'Instaladores', icon: <HardHat size={20} className="text-blue-500" />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'ponto', label: 'Ponto Eletrônico', icon: <Clock size={20} className="text-amber-500" />, roles: ['ADMIN', 'ATTENDANT', 'PRODUCTION', 'BUYER'] },
  { id: 'nfe-management', label: 'Gerenciar NF-e', icon: <FileText size={20} className="text-blue-500" />, roles: ['ADMIN'] },
  { id: 'api-config', label: 'Configuração de APIs', icon: <SettingsIcon size={20} className="text-indigo-600" />, roles: ['ADMIN'] },
  { id: 'system-users', label: 'Cadastro de Equipe', icon: <Users2 size={20} className="text-rose-500" />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'settings', label: 'Configurações', icon: <SettingsIcon size={20} className="text-blue-600" />, roles: ['ADMIN'] },
  { id: 'mass-messaging', label: 'Ativação de Clientes', icon: <MessageSquare size={20} className="text-blue-500" />, roles: ['ADMIN', 'SELLER', 'ATTENDANT'] },
];


export const STATUS_COLORS = {
  PENDING_MEASUREMENT: 'bg-yellow-100 text-yellow-800',
  TECHNICAL_SHEET_CREATED: 'bg-blue-100 text-blue-800',
  QUOTE_SENT: 'bg-indigo-100 text-indigo-800',
  CONTRACT_SIGNED: 'bg-emerald-100 text-emerald-800',
  IN_PRODUCTION: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-slate-100 text-slate-800',
};

export const CORTINA_COMMAND_OPTIONS = [
  'DIREITA - PAD',
  'DIREITA - INV',
  'ESQUERDA PAD',
  'ESQUERDA - INV',
  'DIREITA CENTRAL',
  'ESQUERDA CENTRAL',
  'PAINÉIS LIVRES',
  'CENTRAL D/E DIVID.',
  'INTEIRA',
  'SKYLIGHT RETA',
  'SKYLIGHT FRANZIDA'
];

export const TOLDO_COMMAND_OPTIONS = [
  'Direita',
  'Esquerda',
  'Mola',
  'Motorizado D',
  'Motorizado E'
];

