
import * as React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  menuItems: any[];
}

const Sidebar = ({ activeTab, setActiveTab, menuItems }: SidebarProps) => {
  return (
    <aside className="w-20 md:w-64 bg-slate-900 flex flex-col transition-all duration-300 z-50 h-screen shrink-0">
      <div className="p-4 md:p-6 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 h-10 w-10 bg-white rounded-lg flex items-center justify-center p-1 overflow-hidden shadow-lg shadow-black/20">
            <img
              src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg"
              alt="RTC Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight hidden md:block whitespace-nowrap">RTC WEB</h1>
        </div>
      </div>

      {/* Navegação com Scroll Ativo e Barra de Rolagem Invisível */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${activeTab === item.id
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="text-sm font-medium hidden md:block">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Seção de Suporte Removida para limpar o menu lateral */}
    </aside>
  );
};

export default Sidebar;
