
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
  Clock,
  AlertCircle,
  Briefcase,
  Truck,
  Zap,
  ShieldAlert,
  Users2,
  Receipt,
  Coins,
  HardHat
} from 'lucide-react';

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'ATTENDANT'] },
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
  { id: 'pcp', label: 'PCP (Produção)', icon: <Factory size={20} />, roles: ['ADMIN', 'PRODUCTION'] },
  { id: 'installations', label: 'Instalações', icon: <Truck size={20} />, roles: ['ADMIN', 'ATTENDANT', 'PRODUCTION'] },
  { id: 'finance', label: 'Contas a Receber', icon: <Wallet size={20} />, roles: ['ADMIN'] },
  { id: 'expenses', label: 'Despesas', icon: <Receipt size={20} className="text-rose-500" />, roles: ['ADMIN'] },
  { id: 'commissions', label: 'Comissões', icon: <Coins size={20} className="text-amber-500" />, roles: ['ADMIN'] },
  { id: 'installers', label: 'Instaladores', icon: <HardHat size={20} className="text-blue-500" />, roles: ['ADMIN', 'ATTENDANT'] },
  { id: 'system-users', label: 'Cadastro de Equipe', icon: <Users2 size={20} className="text-rose-500" />, roles: ['ADMIN', 'ATTENDANT'] },
];

export const STATUS_COLORS = {
  PENDING_MEASUREMENT: 'bg-yellow-100 text-yellow-800',
  TECHNICAL_SHEET_CREATED: 'bg-blue-100 text-blue-800',
  QUOTE_SENT: 'bg-indigo-100 text-indigo-800',
  CONTRACT_SIGNED: 'bg-emerald-100 text-emerald-800',
  IN_PRODUCTION: 'bg-orange-100 text-orange-800',
  FINISHED: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-slate-100 text-slate-800',
};
