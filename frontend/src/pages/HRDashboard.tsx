import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import type { AuthUser } from '../App';
import { CandidateDetailModal } from '../components/CandidateDetailModal';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: 'Em Progresso', color: 'bg-blue-100 text-blue-800' },
  DOCS_SENT:   { label: 'Docs Enviados', color: 'bg-purple-100 text-purple-800' },
  APPROVED:    { label: 'Aprovado',      color: 'bg-green-100 text-green-800' },
  REJECTED:    { label: 'Rejeitado',     color: 'bg-red-100 text-red-800' },
};

export function HRDashboard({ user, onLogout }: Props) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setCandidates(res.data);
    } catch {
      alert('Erro ao carregar candidatos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const companies = Array.from(new Set(candidates.map(c => c.company?.name).filter(Boolean))) as string[];

  const filtered = candidates.filter(c => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (filterCompany !== 'ALL' && c.company?.name !== filterCompany) return false;
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.cpf?.includes(search)) return false;
    return true;
  });

  const statCounts: Record<string, number> = {};
  Object.keys(STATUS_LABELS).forEach(k => { statCounts[k] = candidates.filter(c => c.status === k).length; });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span className="font-bold text-slate-800">Onboarding 2.0</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}{user.company ? ` · ${user.company.name}` : ''}</p>
            </div>
            <button onClick={onLogout} className="text-sm text-slate-500 hover:text-red-500 transition font-medium">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Candidatos</h1>
          <p className="text-slate-500 text-sm mt-1">{candidates.length} candidato(s) no total</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Object.entries(STATUS_LABELS).map(([key, val]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{statCounts[key] ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">{val.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input type="text" placeholder="Buscar por nome ou CPF..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none w-64" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
            <option value="ALL">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {user.role !== 'PARTNER' && companies.length > 0 && (
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
              <option value="ALL">Todas as empresas</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Carregando...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Candidato</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">CPF</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Fase</th>
                  {user.role !== 'PARTNER' && <th className="text-left px-5 py-3 font-semibold text-slate-600">Empresa</th>}
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Link Acessado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Nenhum candidato encontrado.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{c.name || <span className="text-slate-400 italic">Não informado</span>}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{c.cpf}</td>
                    <td className="px-5 py-3.5">
                      <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {c.currentPhase?.title || '—'}
                      </span>
                    </td>
                    {user.role !== 'PARTNER' && (
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{c.company?.name || '—'}</td>
                    )}
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_LABELS[c.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.hasAccessed
                        ? <span className="text-green-600 text-xs font-semibold">✓ Sim</span>
                        : <span className="text-slate-400 text-xs">Não</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => setSelectedId(c.id)}
                        className="text-teal-600 hover:text-teal-800 font-semibold text-xs border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition">
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedId && (
        <CandidateDetailModal
          candidateId={selectedId}
          userRole={user.role}
          onClose={() => { setSelectedId(null); load(); }}
        />
      )}
    </div>
  );
}
