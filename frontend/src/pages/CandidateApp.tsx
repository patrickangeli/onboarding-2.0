import { useState, useEffect } from 'react';
import api from '../api';

const PROCESS_ID = (import.meta as any).env?.VITE_PROCESS_ID || '';

interface Props { onBack: () => void; }

export function CandidateApp({ onBack }: Props) {
  const [step, setStep] = useState<'cpf' | 'register' | 'form' | 'done'>('cpf');
  const [employeeId, setEmployeeId] = useState('');
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [process, setProcess] = useState<any>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [addressData, setAddressData] = useState<any>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rhFeedback, setRhFeedback] = useState<{ message: string; corrections: string[] } | null>(null);

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  useEffect(() => {
    if (step === 'form' && PROCESS_ID) {
      api.get(`/process/${PROCESS_ID}/structure`).then(res => setProcess(res.data));
      api.get(`/employee/${employeeId}/details`).then(d => {
        if (d.data.feedback) setRhFeedback({ message: d.data.feedback, corrections: d.data.corrections || [] });
        const saved: Record<string, string> = {};
        d.data.answers?.forEach((a: any) => { saved[a.questionId] = a.value; });
        setAnswers(saved);
      }).catch(() => {});
    }
  }, [step, employeeId]);

  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) { setError('CPF inválido.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.get(`/employee/check-cpf/${clean}`);
      setEmployeeId(res.data.id);
      setStep('form');
    } catch (err: any) {
      if (err.response?.status === 404) setStep('register');
      else setError('Erro ao verificar CPF.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/employee', { name, email, cpf: cpf.replace(/\D/g, ''), processId: PROCESS_ID });
      setEmployeeId(res.data.id);
      setStep('form');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cadastrar.');
    } finally { setLoading(false); }
  };

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    api.post('/answer/text', { employeeId, questionId, value }).catch(() => {});
  };

  const handleFile = async (questionId: string, file: File) => {
    setFiles(prev => ({ ...prev, [questionId]: file }));
    const form = new FormData();
    form.append('file', file);
    form.append('employeeId', employeeId);
    form.append('questionId', questionId);
    await api.post('/upload', form);
  };

  const handleCep = async (questionId: string, val: string) => {
    handleAnswer(questionId, val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const d = await r.json();
        if (!d.erro) setAddressData({ street: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf });
      } catch {}
    }
  };

  const handleNext = async () => {
    setLoading(true); setError('');
    const phase = process?.phases?.[currentPhaseIndex];
    const cepQuestion = phase?.questions?.find((q: any) => q.type === 'CEP');
    if (cepQuestion && Object.keys(addressData).length > 0) {
      await api.post('/employee/address', {
        employeeId,
        cep: answers[cepQuestion.id] || '',
        ...addressData
      }).catch(() => {});
    }
    try {
      await api.post('/next-step', { employeeId });
      if (currentPhaseIndex < process.phases.length - 1) {
        setCurrentPhaseIndex(i => i + 1);
        setRhFeedback(null);
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao avançar.');
    } finally { setLoading(false); }
  };

  // TELA CPF
  if (step === 'cpf') return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl mb-4 shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Portal do Candidato</h1>
          <p className="text-slate-500 text-sm mt-1">Insira seu CPF para continuar</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleCpfSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">CPF</label>
              <input type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="000.000.000-00" maxLength={14} />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        </div>
        <div className="text-center mt-4">
          <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600">← Voltar</button>
        </div>
      </div>
    </div>
  );

  // TELA CADASTRO
  if (step === 'register') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Primeiro acesso</h2>
        <p className="text-slate-500 text-sm mb-6">Complete seu cadastro para começar.</p>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Completo</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition">
            {loading ? 'Cadastrando...' : 'Iniciar Formulário'}
          </button>
        </form>
      </div>
    </div>
  );

  // TELA FORMULÁRIO
  if (step === 'form' && process) {
    const phase = process.phases[currentPhaseIndex];
    const totalPhases = process.phases.length;
    const progress = (currentPhaseIndex / totalPhases) * 100;
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Etapa {currentPhaseIndex + 1} de {totalPhases}</span>
              <span>{process.title}</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full">
              <div className="h-1.5 bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {rhFeedback && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="font-semibold text-amber-800 text-sm mb-1">⚠️ Correções solicitadas pelo RH</p>
              <p className="text-amber-700 text-sm">{rhFeedback.message}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-1">{phase.title}</h2>
            <p className="text-slate-500 text-sm mb-6">Preencha todos os campos obrigatórios.</p>

            <div className="space-y-5">
              {phase.questions.map((q: any) => {
                const isCorrection = rhFeedback?.corrections.includes(q.id);
                return (
                  <div key={q.id} className={`space-y-1.5 ${isCorrection ? 'ring-2 ring-amber-400 rounded-lg p-3 -mx-3' : ''}`}>
                    <label className="block text-sm font-medium text-slate-700">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                      {isCorrection && <span className="ml-2 text-xs text-amber-600">⚠️ corrigir</span>}
                    </label>
                    {q.type === 'TEXT' && (
                      <input type="text" value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    )}
                    {q.type === 'DATE' && (
                      <input type="date" value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    )}
                    {q.type === 'SELECT' && (
                      <select value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                        <option value="">Selecione...</option>
                        {q.options.map((o: any) => <option key={o.id} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {q.type === 'CEP' && (
                      <input type="text" value={answers[q.id] || ''} maxLength={9}
                        onChange={e => handleCep(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="00000-000" />
                    )}
                    {q.type === 'FILE' && (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                        {files[q.id] || answers[q.id] === 'ARQUIVO' ? (
                          <p className="text-teal-600 text-sm font-semibold">✓ {files[q.id]?.name || 'Arquivo enviado'}</p>
                        ) : (
                          <label className="cursor-pointer block">
                            <p className="text-slate-500 text-sm">Clique para enviar arquivo</p>
                            <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(q.id, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

            <button onClick={handleNext} disabled={loading}
              className="w-full mt-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
              {loading ? 'Salvando...' : currentPhaseIndex < totalPhases - 1 ? 'Próxima etapa →' : 'Enviar documentos'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TELA CONCLUÍDO
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Tudo certo!</h2>
        <p className="text-slate-500">Seus documentos foram enviados. O RH irá analisar e entrar em contato em breve.</p>
      </div>
    </div>
  );
}
