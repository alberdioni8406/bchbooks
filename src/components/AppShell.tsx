'use client';

type View = 'dashboard' | 'transactions' | 'reports' | 'categories' | 'settings';

const NAV: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports' },
  { id: 'categories', label: 'Categories' },
  { id: 'settings', label: 'Settings' },
];

export function AppShell(props: {
  view: View;
  onViewChange: (v: View) => void;
  onHome: () => void;
  addressCount: number;
  uncategorized: number;
  children: React.ReactNode;
}) {
  var view = props.view;
  var onViewChange = props.onViewChange;
  var onHome = props.onHome;
  var addressCount = props.addressCount;
  var uncategorized = props.uncategorized;
  var children = props.children;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onHome}
              title="Back to home / start over"
              className="rounded-md px-1 text-lg font-semibold tracking-tight text-teal-700 hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              BCHBooks
            </button>
            <span className="hidden text-xs text-slate-400 sm:inline">
              · {addressCount} address{addressCount === 1 ? '' : 'es'}
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map(function (item) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={function () {
                    onViewChange(item.id);
                  }}
                  className={
                    'relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
                    (view === item.id
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-100')
                  }
                >
                  {item.label}
                  {item.id === 'transactions' && uncategorized > 0 ? (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                      {uncategorized}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        BCHBooks is read-only. It cannot spend your BCH. · Free & open accounting
        for Bitcoin Cash
      </footer>
    </div>
  );
}
