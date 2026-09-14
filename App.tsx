import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  createInvoice,
  useCreateInvoice,
  useGetInvoiceStats,
  useListInvoices,
  useVerifyInvoice,
  type InvoiceCreateInput,
  type InvoiceRecord,
  type InvoiceStatus,
} from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CircleCheck,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Hash,
  LayoutDashboard,
  Loader2,
  Menu,
  Package,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Ship,
  X,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, useLocation, useRoute } from 'wouter';

type Invoice = InvoiceRecord;
type FormData = InvoiceCreateInput & { value: number };
type Panel = 'registry' | 'register' | 'verify';

const queryClient = new QueryClient();
const currencies = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AED'];
function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const parsed = value.includes('T')
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

const emptyForm: FormData = {
  supplier: '',
  buyer: '',
  exportCountry: '',
  importCountry: '',
  invoiceDate: today(),
  goods: '',
  hsCode: '',
  quantity: 1,
  value: 0,
  currency: 'USD',
};

function Home() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();
  const [activePanel, setActivePanel] = useState<Panel>('registry');
  const [mobileNav, setMobileNav] = useState(false);
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyId, setVerifyId] = useState('');
  const [verifySubmitted, setVerifySubmitted] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [registered, setRegistered] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const invoicesQuery = useListInvoices(
    searchQuery.trim() ? { search: searchQuery.trim() } : undefined,
    { query: { enabled: isAuthenticated, refetchOnMount: 'always' } },
  );
  const statsQuery = useGetInvoiceStats({
    query: { enabled: isAuthenticated, refetchOnMount: 'always' },
  });
  const verifyQueryResult = useVerifyInvoice(verifyId, {
    query: { enabled: verifySubmitted && Boolean(verifyId) },
  });
  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (invoice) => {
        setRegistered(invoice);
        setForm({ ...emptyForm, invoiceDate: today() });
        setFormError('');
        void queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/invoices/stats'] });
      },
      onError: () => {
        setFormError('The registry could not save this invoice. Please try again.');
      },
    },
  });

  const totalValue = useMemo(() => form.value, [form.value]);
  const invoices = invoicesQuery.data ?? [];
  const stats = statsQuery.data;
  const verificationResult =
    !verifySubmitted ? undefined : verifyQueryResult.data ?? (verifyQueryResult.isError ? null : undefined);

  const navigate = (panel: Panel) => {
    setActivePanel(panel);
    setMobileNav(false);
    setRegistered(null);
    setFormError('');
    if (panel !== 'verify') {
      setVerifySubmitted(false);
      setVerifyId('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPublicVerify = (id: string) => {
    setLocation(`/verify/${encodeURIComponent(id)}`);
  };

  const registerInvoice = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const required = [form.supplier, form.buyer, form.goods, form.hsCode];
    if (required.some((value) => !value.trim())) {
      setFormError('Complete every required field before registering this invoice.');
      return;
    }
    if (form.quantity <= 0 || form.value <= 0) {
      setFormError('Quantity and declared value must be greater than zero.');
      return;
    }
    createMutation.mutate({
      data: {
        supplier: form.supplier,
        buyer: form.buyer,
        goods: form.goods,
        hsCode: form.hsCode,
        quantity: form.quantity,
        value: form.value,
        exportCountry: form.exportCountry,
        importCountry: form.importCountry,
        invoiceDate: form.invoiceDate,
        currency: form.currency,
      },
    });
  };

  const verifyInvoice = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = verifyQuery.trim().toUpperCase();
    setVerifyId(cleaned);
    setVerifySubmitted(true);
    void queryClient.invalidateQueries({ queryKey: ['/api/invoices/stats'] });
  };

  if (authLoading) {
    return <LoadingScreen label="Checking your account..." />;
  }

  if (!isAuthenticated) {
    return <SignInView onLogin={login} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="app-sidebar hidden md:flex">
        <Brand onClick={() => navigate('registry')} />
        <div className="mt-10">
          <p className="sidebar-label">Workspace</p>
          <nav className="mt-3 space-y-1" aria-label="Main navigation">
            <SidebarButton active={activePanel === 'registry'} icon={<LayoutDashboard size={16} />} onClick={() => navigate('registry')}>Dashboard</SidebarButton>
            <SidebarButton active={activePanel === 'register'} icon={<Plus size={16} />} onClick={() => navigate('register')}>Register invoice</SidebarButton>
            <SidebarButton active={false} icon={<FileText size={16} />} onClick={() => navigate('registry')}>Registry</SidebarButton>
            <SidebarButton active={activePanel === 'verify'} icon={<ShieldCheck size={16} />} onClick={() => navigate('verify')}>Verify</SidebarButton>
          </nav>
           <p className="sidebar-label mt-9">Account</p>
          <nav className="mt-3 space-y-1">
             <SidebarButton icon={<Settings2 size={16} />} onClick={logout}>Log out</SidebarButton>
          </nav>
        </div>
        <div className="sidebar-bottom">
           <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-sidebar-foreground/60"><span className="h-2 w-2 rounded-full bg-[hsl(152_28%_52%)] shadow-[0_0_0_4px_hsl(152_28%_52%/.14)]" /> Shared registry active</div>
           <p className="mt-3 text-xs leading-5 text-sidebar-foreground/45">{user?.email ?? 'Signed-in workspace'} · PostgreSQL storage</p>
        </div>
      </aside>

      <div className="min-h-[100dvh] md:pl-[244px]">
        <header className="mobile-header sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm md:hidden">
          <div className="flex h-[68px] items-center justify-between px-5">
            <Brand onClick={() => navigate('registry')} compact />
            <button type="button" data-testid="button-mobile-menu" onClick={() => setMobileNav((open) => !open)} className="rounded-md p-2 hover:bg-sidebar-accent">
              {mobileNav ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
          {mobileNav && <nav className="border-t border-sidebar-border bg-sidebar px-4 py-3" aria-label="Mobile navigation">
            <SidebarButton active={activePanel === 'registry'} icon={<LayoutDashboard size={16} />} onClick={() => navigate('registry')}>Dashboard</SidebarButton>
            <SidebarButton active={activePanel === 'register'} icon={<Plus size={16} />} onClick={() => navigate('register')}>Register invoice</SidebarButton>
            <SidebarButton active={activePanel === 'verify'} icon={<ShieldCheck size={16} />} onClick={() => navigate('verify')}>Verify</SidebarButton>
          </nav>}
        </header>

        <main className="registry-grid min-h-[100dvh]">
          <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-11 lg:px-12">
            <div className="animate-rise mb-9 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[.25em] text-accent">Trade records / live workspace</p>
                <h1 className="font-serif text-4xl font-bold leading-[.98] tracking-[-.045em] text-primary sm:text-6xl">{activePanel === 'registry' ? 'A clear record of every crossing.' : activePanel === 'register' ? 'Register an invoice.' : 'Verify a record.'}</h1>
                <p className="mt-4 max-w-xl text-[15px] leading-6 text-muted-foreground">{activePanel === 'registry' ? 'The working registry for international invoices. Register once, keep the reference close, and find the record when it matters.' : activePanel === 'register' ? 'Create a traceable UIEI reference for a cross-border commercial invoice. All fields stay in this browser for the MVP.' : 'Look up a UIEI number against this workspace’s registered records. Search is exact and case-insensitive.'}</p>
              </div>
               <div className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground lg:flex"><span className="h-2 w-2 rounded-full bg-[hsl(152_28%_42%)] shadow-[0_0_0_4px_hsl(152_28%_42%/.14)]" /> Shared registry active</div>
            </div>

            {activePanel === 'registry' && <RegistryView invoices={invoices} stats={stats} isLoading={invoicesQuery.isLoading || statsQuery.isLoading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onRegister={() => navigate('register')} onVerify={() => navigate('verify')} onOpenPublicVerify={openPublicVerify} />}
            {activePanel === 'register' && <RegisterView form={form} setForm={setForm} totalValue={totalValue} error={formError} isSaving={createMutation.isPending} registered={registered} onSubmit={registerInvoice} onViewRegistry={() => navigate('registry')} onOpenPublicVerify={openPublicVerify} />}
            {activePanel === 'verify' && <VerifyView query={verifyQuery} setQuery={setVerifyQuery} result={verificationResult} isLoading={verifyQueryResult.isFetching} onSubmit={verifyInvoice} onRegister={() => navigate('register')} onOpenPublicVerify={openPublicVerify} />}
          </div>
        </main>
        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <span>UIEI / Global Invoice Registry</span><span>Authenticated workspace · PostgreSQL records</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Brand({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return <button type="button" data-testid="button-brand" onClick={onClick} className="flex items-center gap-3 text-left">
    <span className="flex h-10 w-10 items-center justify-center border border-sidebar-primary/60 bg-sidebar-primary text-primary-foreground shadow-[3px_3px_0_hsl(var(--sidebar-primary)/.25)]"><span className="font-serif text-lg font-bold">U</span></span>
    <span className={compact ? '' : 'block'}><span className="block font-serif text-[19px] font-bold tracking-tight">UIEI</span><span className="block font-mono text-[9px] uppercase tracking-[.22em] text-sidebar-foreground/60">Global Invoice Registry</span></span>
  </button>;
}

function SidebarButton({ active, disabled = false, icon, onClick, children }: { active?: boolean; disabled?: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`sidebar-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}>{icon}<span>{children}</span>{disabled && <span className="ml-auto font-mono text-[9px] uppercase tracking-wider opacity-50">Soon</span>}</button>;
}

function RegistryView({ invoices, statValue, suppliers, countries, verificationRequests, searchQuery, setSearchQuery, onRegister, onVerify, onOpenPublicVerify }: { invoices: Invoice[]; statValue: number; suppliers: number; countries: number; verificationRequests: number; searchQuery: string; setSearchQuery: (value: string) => void; onRegister: () => void; onVerify: () => void; onOpenPublicVerify: (id: string) => void }) {
  const visibleInvoices = invoices.filter((invoice) => [invoice.id, invoice.supplier, invoice.buyer, invoice.goods].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())));
  return <div className="animate-rise delay-1">
    <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Invoices registered" value={String(invoices.length).padStart(2, '0')} icon={<FileCheck2 size={18} />} />
      <Stat label="Verification requests" value={String(verificationRequests).padStart(2, '0')} icon={<ShieldCheck size={18} />} />
      <Stat label="Registered suppliers" value={String(suppliers).padStart(2, '0')} icon={<Globe2 size={18} />} />
      <Stat label="Countries served" value={String(countries).padStart(2, '0')} icon={<Ship size={18} />} />
      <Stat label="Declared value" value={formatMoney(statValue)} icon={<Package size={18} />} />
      <Stat label="Last registry update" value={invoices[0] ? formatDate(invoices[0].registeredAt) : 'Awaiting record'} icon={<Hash size={18} />} />
    </div>
    <section className="overflow-hidden border border-card-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="font-serif text-2xl font-bold tracking-tight text-primary">Registered invoices</h2><p className="mt-1 text-sm text-muted-foreground">A local index of records created in this workspace.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-[270px]"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search invoice number</span><input data-testid="input-search-invoice" className="registry-input pl-9 font-mono text-xs uppercase tracking-[.06em]" placeholder="Search invoice number" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
            <div className="flex gap-2"><button type="button" data-testid="button-open-verify" onClick={onVerify} className="secondary-button"><Search size={15} /> Verify</button><button type="button" data-testid="button-open-register" onClick={onRegister} className="primary-button"><Plus size={15} /> Register</button></div>
          </div>
        </div>
      </div>
      {visibleInvoices.length ? <div className="divide-y divide-border">{visibleInvoices.map((invoice, index) => <InvoiceRow invoice={invoice} key={invoice.id} index={index} onOpenPublicVerify={onOpenPublicVerify} />)}</div> : searchQuery ? <div className="paper-lines flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center"><Search size={25} className="mb-4 text-muted-foreground" /><h3 className="font-serif text-xl font-bold text-primary">No matching invoice</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try a different UIEI number, supplier, buyer, or goods description.</p></div> : <EmptyRegistry onRegister={onRegister} />}
    </section>
    <div className="mt-5 flex items-start gap-3 border-l-2 border-accent px-4 py-1 text-xs leading-5 text-muted-foreground"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><p>This MVP stores records in your browser only. It does not make security, customs, payment, or authenticity claims.</p></div>
  </div>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="border border-card-border bg-card px-5 py-4 shadow-sm"><div className="mb-3 flex items-center justify-between text-accent"><span className="font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">{label}</span>{icon}</div><strong className="block truncate font-serif text-2xl font-bold tracking-tight text-primary" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</strong></div>;
}

function InvoiceRow({ invoice, index, onOpenPublicVerify }: { invoice: Invoice; index: number; onOpenPublicVerify: (id: string) => void }) {
  return <article className="group grid gap-4 px-5 py-5 transition-colors hover:bg-secondary/35 sm:grid-cols-[1.4fr_1.3fr_1fr_auto] sm:items-center sm:px-7" data-testid={`row-invoice-${index}`}>
    <div><span className="mb-2 block font-mono text-[11px] font-bold tracking-[.1em] text-accent" data-testid={`text-invoice-id-${index}`}>{invoice.id}</span><p className="font-medium text-primary">{invoice.goods}</p><p className="mt-1 text-xs text-muted-foreground">HS {invoice.hsCode} · {invoice.quantity.toLocaleString()} units · {invoice.exportCountry} → {invoice.importCountry}</p></div>
    <div><p className="text-xs text-muted-foreground">Parties</p><p className="mt-1 text-sm text-primary"><span className="font-medium">{invoice.supplier}</span><span className="mx-2 text-accent">→</span>{invoice.buyer}</p></div>
    <div><p className="text-xs text-muted-foreground">Declared value</p><p className="mt-1 font-mono text-sm font-bold text-primary">{formatMoney(invoice.totalValue, invoice.currency)}</p></div>
    <div className="flex items-center gap-2 sm:justify-end"><StatusBadge status={invoice.status} /><button type="button" title="Open public verification page" aria-label={`Open public verification page for ${invoice.id}`} data-testid={`button-public-verify-${index}`} onClick={() => onOpenPublicVerify(invoice.id)} className="icon-button"><ExternalLink size={14} /></button></div>
  </article>;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const icon = status === 'VALID' ? <CircleCheck size={12} /> : status === 'PENDING' ? <Clock3 size={12} /> : status === 'SUSPENDED' ? <AlertTriangle size={12} /> : <X size={12} />;
  return <span className={`status-pill ${status.toLowerCase()}`}>{icon} {status}</span>;
}

function EmptyRegistry({ onRegister }: { onRegister: () => void }) {
  return <div className="paper-lines flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center"><span className="mb-5 flex h-14 w-14 items-center justify-center border border-accent/40 bg-accent/10 text-accent"><FileText size={24} strokeWidth={1.5} /></span><h3 className="font-serif text-xl font-bold text-primary">The registry is ready for its first record.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Register an invoice to create a UIEI number and start your local index.</p><button type="button" data-testid="button-empty-register" onClick={onRegister} className="primary-button mt-5"><Plus size={15} /> Register first invoice</button></div>;
}

function RegisterView({ form, setForm, totalValue, error, isSaving, registered, onSubmit, onViewRegistry, onOpenPublicVerify }: { form: FormData; setForm: (data: FormData) => void; totalValue: number; error: string; isSaving: boolean; registered: Invoice | null; onSubmit: (event: FormEvent) => void; onViewRegistry: () => void; onOpenPublicVerify: (id: string) => void }) {
  if (registered) return <div className="animate-rise mx-auto max-w-3xl border border-card-border bg-card shadow-md"><div className="border-b border-border bg-[hsl(152_28%_42%/.08)] px-6 py-8 text-center sm:px-12"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(152_28%_42%)] text-card"><Check size={28} /></span><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(152_28%_42%)]">Registration complete</p><h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-primary">Your UIEI number is ready.</h2><p className="mt-2 text-sm text-muted-foreground">Keep this reference with the commercial invoice.</p></div><div className="px-6 py-8 sm:px-12"><div className="border border-accent/35 bg-accent/10 p-5 text-center"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">UIEI invoice number</p><p className="mt-2 break-all font-mono text-2xl font-bold tracking-[.08em] text-primary" data-testid="text-new-invoice-id">{registered.id}</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" data-testid="button-copy-invoice-id" className="secondary-button" onClick={() => navigator.clipboard?.writeText(registered.id)}><Clipboard size={14} /> Copy number</button><button type="button" data-testid="button-open-new-public-verify" className="secondary-button" onClick={() => onOpenPublicVerify(registered.id)}><ExternalLink size={14} /> Public verify</button></div></div><dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2"><Detail label="Supplier" value={registered.supplier} /><Detail label="Buyer" value={registered.buyer} /><Detail label="Countries" value={`${registered.exportCountry} → ${registered.importCountry}`} /><Detail label="Declared value" value={formatMoney(registered.totalValue, registered.currency)} /><Detail label="Invoice date" value={formatDate(registered.invoiceDate)} /><Detail label="Status" value={registered.status} /></dl><button type="button" data-testid="button-view-registry" onClick={onViewRegistry} className="primary-button mt-8 w-full justify-center">View registry <span aria-hidden>→</span></button></div></div>;
  const field = (key: keyof FormData, label: string, placeholder: string, type = 'text') => <label className="field-label">{label}<input data-testid={`input-${key}`} type={type} value={form[key]} placeholder={placeholder} onChange={(event) => setForm({ ...form, [key]: type === 'number' ? Number(event.target.value) : event.target.value })} /><span className="field-hint">Required field</span></label>;
  return <div className="animate-rise delay-1 grid gap-6 lg:grid-cols-[1fr_320px]"><form onSubmit={onSubmit} className="border border-card-border bg-card shadow-sm"><div className="border-b border-border px-5 py-5 sm:px-8"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground"><FileText size={17} /></span><div><h2 className="font-serif text-2xl font-bold tracking-tight text-primary">Invoice particulars</h2><p className="text-sm text-muted-foreground">Enter the information as it appears on your invoice.</p></div></div></div><div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-8">
    {field('supplier', 'Supplier name', 'e.g. Mariner Components Ltd.')}{field('buyer', 'Buyer name', 'e.g. Sora Industrial Works')}{field('exportCountry', 'Country of export', 'e.g. United States')}{field('importCountry', 'Country of import', 'e.g. Japan')}<label className="field-label">Invoice date<input data-testid="input-invoiceDate" type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /><span className="field-hint">Date shown on the commercial invoice.</span></label><label className="field-label">Currency<select data-testid="input-currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select><span className="field-hint">Used for the declared total.</span></label><label className="field-label sm:col-span-2">Goods description<input data-testid="input-goods" value={form.goods} placeholder="e.g. Precision machined aluminum housings" onChange={(e) => setForm({ ...form, goods: e.target.value })} /><span className="field-hint">Describe the goods plainly and specifically.</span></label>{field('hsCode', 'HS code', 'e.g. 7616.99')}{field('quantity', 'Quantity', 'e.g. 240', 'number')}{field('value', `Declared value (${form.currency})`, 'e.g. 12450.00', 'number')}<div className="sm:col-span-2">{error && <div className="error-box" data-testid="status-form-error"><X size={16} /><span>{error}</span></div>}<button type="submit" data-testid="button-register-submit" disabled={isSaving} className="primary-button mt-2 w-full justify-center py-3">{isSaving ? <><Loader2 size={16} className="animate-spin" /> Registering record...</> : <><FileCheck2 size={16} /> Register invoice</>}</button></div></div></form><aside className="h-fit border border-card-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Record preview</p></div><div className="p-5"><div className="flex items-end justify-between border-b border-border pb-5"><div><p className="text-xs text-muted-foreground">Declared total</p><p className="mt-1 font-serif text-3xl font-bold tracking-tight text-primary">{formatMoney(totalValue, form.currency)}</p></div><Package size={22} className="mb-1 text-accent" /></div><div className="space-y-4 pt-5"><Detail label="Supplier" value={form.supplier || 'Not entered'} muted={!form.supplier} /><Detail label="Buyer" value={form.buyer || 'Not entered'} muted={!form.buyer} /><Detail label="Route" value={`${form.exportCountry || 'Export'} → ${form.importCountry || 'Import'}`} muted={!form.exportCountry || !form.importCountry} /><Detail label="Quantity" value={`${form.quantity || 0} units`} /><Detail label="Declared value" value={formatMoney(form.value || 0, form.currency)} /></div></div><div className="border-t border-border bg-secondary/40 px-5 py-4 text-xs leading-5 text-muted-foreground">A sequential UIEI number is generated when you register.</div></aside></div>;
}

function VerifyView({ query, setQuery, result, onSubmit, onRegister, onOpenPublicVerify }: { query: string; setQuery: (value: string) => void; result: Invoice | null | undefined; onSubmit: (event: FormEvent) => void; onRegister: () => void; onOpenPublicVerify: (id: string) => void }) {
  return <div className="animate-rise delay-1 mx-auto max-w-3xl"><section className="border border-card-border bg-card shadow-sm"><div className="border-b border-border px-5 py-6 sm:px-10"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-accent text-accent-foreground"><Search size={17} /></span><div><h2 className="font-serif text-2xl font-bold tracking-tight text-primary">Find a UIEI record</h2><p className="text-sm text-muted-foreground">Enter the complete invoice number to check this local registry.</p></div></div><form onSubmit={onSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="verify-query">UIEI invoice number</label><input id="verify-query" data-testid="input-verify-number" className="registry-input flex-1 font-mono uppercase tracking-[.08em]" placeholder="UIEI-2026-000001" value={query} onChange={(e) => setQuery(e.target.value)} /><button type="submit" data-testid="button-verify-submit" className="primary-button justify-center px-7"><Search size={15} /> Check record</button></form></div>{result === undefined ? <div className="paper-lines flex min-h-[260px] flex-col items-center justify-center px-6 text-center"><Hash size={20} className="mb-4 text-muted-foreground" /><p className="font-serif text-lg font-bold text-primary">Enter a number to begin.</p><p className="mt-1 text-sm text-muted-foreground">The result will appear here with the registered particulars.</p></div> : result ? <div className="animate-rise px-5 py-7 sm:px-10"><div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center"><div><StatusBadge status={result.status} /><p className="mt-3 font-mono text-xl font-bold tracking-[.06em] text-primary" data-testid="text-verified-id">{result.id}</p></div><div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">Invoice date</p><p className="mt-1 font-mono text-sm text-primary">{formatDate(result.invoiceDate)}</p></div></div><div className="grid gap-5 pt-6 sm:grid-cols-2"><Detail label="Supplier" value={result.supplier} /><Detail label="Buyer" value={result.buyer} /><Detail label="Route" value={`${result.exportCountry} → ${result.importCountry}`} /><Detail label="Goods description" value={result.goods} /><Detail label="HS code" value={result.hsCode} /><Detail label="Quantity" value={result.quantity.toLocaleString()} /><Detail label="Declared value" value={formatMoney(result.totalValue, result.currency)} /><Detail label="Registered" value={formatDate(result.registeredAt)} /></div><div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5"><button type="button" data-testid="button-open-public-result" className="primary-button" onClick={() => onOpenPublicVerify(result.id)}><ExternalLink size={14} /> Open public page</button><button type="button" data-testid="button-copy-public-url" className="secondary-button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/verify/${result.id}`)}><Copy size={14} /> Copy public URL</button></div></div> : <div className="animate-rise flex min-h-[260px] flex-col items-center justify-center px-6 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive"><X size={21} /></span><p className="font-serif text-lg font-bold text-primary" data-testid="status-verify-not-found">No matching record</p><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">We could not find that number in this workspace. Check the format and try again.</p><button type="button" data-testid="button-verify-register" onClick={onRegister} className="secondary-button mt-5"><Plus size={15} /> Register an invoice</button></div>}</section></div>;
}

function PublicVerifyRoute() {
  const [, params] = useRoute<{ id: string }>('/verify/:id');
  const [, setLocation] = useLocation();
  const id = params?.id ? decodeURIComponent(params.id).toUpperCase() : '';
  const invoice = readInvoices().find((record) => record.id === id);
  return <div className="public-verify min-h-[100dvh] bg-background px-5 py-10 text-foreground sm:px-8"><div className="mx-auto max-w-2xl"><Brand onClick={() => setLocation('/')} /><div className="mt-12 border border-card-border bg-card shadow-lg"><div className="border-b border-border bg-primary px-6 py-8 text-primary-foreground sm:px-10"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-sidebar-primary">Public verification page</p><h1 className="mt-3 font-serif text-4xl font-bold tracking-tight">UIEI record lookup</h1><p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/70">A read-only view of the invoice record stored in this local workspace.</p></div>{invoice ? <div className="px-6 py-8 sm:px-10"><div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start"><div><StatusBadge status={invoice.status} /><p className="mt-3 break-all font-mono text-xl font-bold tracking-[.06em] text-primary" data-testid="text-public-invoice-id">{invoice.id}</p></div><div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">Registered</p><p className="mt-1 font-mono text-sm text-primary">{formatDate(invoice.registeredAt)}</p></div></div><dl className="grid gap-6 pt-7 sm:grid-cols-2"><Detail label="Supplier" value={invoice.supplier} /><Detail label="Buyer" value={invoice.buyer} /><Detail label="Country of export" value={invoice.exportCountry} /><Detail label="Country of import" value={invoice.importCountry} /><Detail label="Invoice date" value={formatDate(invoice.invoiceDate)} /><Detail label="Goods description" value={invoice.goods} /><Detail label="HS code" value={invoice.hsCode} /><Detail label="Quantity" value={invoice.quantity.toLocaleString()} /><Detail label="Declared value" value={formatMoney(invoice.totalValue, invoice.currency)} /></dl><div className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">This MVP is browser-only and does not independently certify authenticity, customs status, payment, or security.</div></div> : <div className="px-6 py-14 text-center sm:px-10"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive"><X size={21} /></span><h2 className="font-serif text-2xl font-bold text-primary">No record found</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">This UIEI number is not present in the local registry.</p><button type="button" className="primary-button mx-auto mt-6" onClick={() => setLocation('/')}>Open workspace</button></div>}</div><p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">UIEI / Global Invoice Registry MVP</p></div></div>;
}

function Detail({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return <div><dt className="text-[11px] uppercase tracking-[.1em] text-muted-foreground">{label}</dt><dd className={`mt-1 text-sm ${muted ? 'italic text-muted-foreground/70' : 'font-medium text-primary'}`}>{value}</dd></div>;
}

function NotFound() {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="text-center"><p className="font-mono text-xs uppercase tracking-[.2em] text-accent">404 / no record</p><h1 className="mt-3 font-serif text-4xl font-bold text-primary">This page is not in the registry.</h1></div></div>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/verify/:id" component={PublicVerifyRoute} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;