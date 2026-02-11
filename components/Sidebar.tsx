
import * as React from 'react';
import { X } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  menuItems: any[];
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ activeTab, setActiveTab, menuItems, isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-[100] w-64 bg-slate-900 flex flex-col transition-all duration-300 transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:relative md:w-64 md:flex shrink-0 h-screen
        `}
      >
        <div className="p-4 md:p-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 h-10 w-10 bg-white rounded-lg flex items-center justify-center p-1 overflow-hidden shadow-lg shadow-black/20">
              <img
                src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg"
                alt="RTC Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-white font-bold text-xl tracking-tight whitespace-nowrap">RTC WEB</h1>
          </div>

          {/* Close button - Mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navegação com Scroll Ativo e Barra de Rolagem Invisível */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose(); // Close menu on mobile after selection
              }}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${activeTab === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
