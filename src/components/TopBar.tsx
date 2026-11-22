import React from 'react';

export type ActiveTab = 'comparador' | 'calendario' | 'combustible' | 'alertas';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewAlert: () => void;
  unreadPushCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewAlert,
  unreadPushCount,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'comparador', label: 'Comparador' },
    { id: 'calendario', label: 'Ofertas 30/60d' },
    { id: 'combustible', label: 'Combustible' },
    {
      id: 'alertas',
      label: unreadPushCount > 0 ? `Alertas Push (${unreadPushCount})` : 'Alertas Push',
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md shadow-xs">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('comparador')}
          className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-sky-500 to-teal-500 dark:from-sky-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          RutaCba
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 border-b-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'border-blue-600 dark:border-cyan-400 text-blue-700 dark:text-cyan-300 font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewAlert}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950 dark:hover:from-sky-400 dark:hover:to-cyan-300 rounded-lg shadow-sm shadow-blue-600/20 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Nueva Alerta
          </button>
        </div>
      </div>

      <nav className="md:hidden border-t border-slate-200/80 dark:border-slate-800/80 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
