import { useState, useEffect, useRef } from 'react';
import api from '../api';

interface Props { onBack: () => void; }

export function CandidateApp({ onBack }: Props) {
  const [step, setStep] = useState<'cpf' | 'register' | 'form' | 'done'>('cpf');
  const [employeeId, setEmployeeId] = useState('');
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [processId, setProcessId] = useState('');
  const [process, setProcess] = useState<any>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiFiles, setMultiFiles] = useState<Record<string, File[]>>({});
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { id: string; fileName: string; mimeType: string }[]>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [cepFound, setCepFound] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rhFeedback, setRhFeedback] = useState<{ message: string; corrections: string[] } | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; name: string; type: string } | null>(null);
  const cepTimer = useRef<any>(null);

  useEffect(() => {
    api.get('/process/first').then(r => setProcessId(r.data.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 'form' && processId && employeeId) {
      api.get(`/process/${processId}/structure`).then(res => {
        const proc = res.data;
        setProcess(proc);
        api.get(`/employee/${employeeId}/details`).then(d => {
          const emp = d.data;
          if (emp.feedback) setRhFeedback({ message: emp.feedback, corrections: emp.corrections || [] });
          const saved: Record<string, string> = {};
          const savedDocs: Record<string, { id: string; fileName: string; mimeType: string }[]> = {};
          emp.answers?.forEach((a: any) => {
            saved[a.questionId] = a.value;
            if (a.documents?.length > 0) savedDocs[a.questionId] = a.documents;
          });
          setAnswers(saved);
          setUploadedDocs(savedDocs);
          if (emp.currentPhaseId && proc.phases) {
            const idx = proc.phases.findIndex((p: any) => p.id === emp.currentPhaseId);
            if (idx >= 0) setCurrentPhaseIndex(idx);
          }
        }).catch(() => {});
      });
    }
  }, [step, employeeId, processId]);

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  const formatCep = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) { setError('CPF inválido.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.get(`/employee/check-cpf/${clean}`);
      setEmployeeId(res.data.id);
      if (res.data.status === 'DOCS_SENT' || res.data.status === 'APPROVED') setStep('done');
      else setStep('form');
    } catch (err: any) {
      if (err.response?.status === 404) setStep('register');
      else setError('Erro ao verificar CPF.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processId) { setError('Processo não encontrado. Contate o RH.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/employee', { name, email, cpf: cpf.replace(/\D/g, ''), processId });
      setEmployeeId(res.data.id);
      setStep('form');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cadastrar.');
    } finally { setLoading(false); }
  };

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    api.post('/answer/text', { employeeId, questionId, value }).catch(() => {});
    showSaved();
  };

  // CEP: busca automática ao completar 8 dígitos
  const handleCep = (questionId: string, val: string) => {
    const formatted = formatCep(val);
    setAnswers(prev => ({ ...prev, [questionId]: formatted }));
    api.post('/answer/text', { employeeId, questionId, value: formatted }).catch(() => {});
    setCepError('');
    setCepFound(false);

    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      if (cepTimer.current) clearTimeout(cepTimer.current);
      cepTimer.current = setTimeout(async () => {
        setCepLoading(true);
        try {
          const r = await api.get(`/cep/${clean}`);
          const d = r.data;
          const phase = process?.phases?.[currentPhaseIndex];
          const qs = phase?.questions || [];
          const newAnswers: Record<string, string> = { ...answers, [questionId]: formatted };
          const fill = (label: string, value: string) => {
            const q = qs.find((x: any) => x.label.toLowerCase().includes(label));
            if (q && value) {
              newAnswers[q.id] = value;
              api.post('/answer/text', { employeeId, questionId: q.id, value }).catch(() => {});
            }
          };
          fill('rua', d.street); fill('logradouro', d.street);
          fill('bairro', d.neighborhood);
          fill('cidade', d.city);
          fill('estado', d.state);
          setAnswers(newAnswers);
          setCepFound(true);
          showSaved();
        } catch {
          setCepError('CEP não encontrado. Verifique e tente novamente.');
        } finally {
          setCepLoading(false);
        }
      }, 600);
    }
  };

  // Upload de arquivo único
  const handleFile = async (questionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('employeeId', employeeId);
    form.append('questionId', questionId);
    try {
      await api.post('/upload', form);
      setAnswers(prev => ({ ...prev, [questionId]: 'ARQUIVO' }));
      // Atualiza preview local
      setUploadedDocs(prev => ({
        ...prev,
        [questionId]: [{ id: 'local', fileName: file.name, mimeType: file.type }]
      }));
      showSaved();
    } catch { setError('Erro ao enviar arquivo.'); }
  };

  // Upload múltiplo (até 3 arquivos - PDF ou imagem)
  const handleMultiFile = async (questionId: string, newFiles: FileList) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const filtered = Array.from(newFiles).filter(f => validTypes.includes(f.type));
    if (filtered.length < newFiles.length) {
      setError('Apenas arquivos PDF ou imagens (JPG, PNG, WEBP) são aceitos.');
      return;
    }
    const current = multiFiles[questionId] || [];
    const combined = [...current, ...filtered].slice(0, 3);
    setMultiFiles(prev => ({ ...prev, [questionId]: combined }));

    const form = new FormData();
    combined.forEach(f => form.append('files', f));
    form.append('employeeId', employeeId);
    form.append('questionId', questionId);
    try {
      await api.post('/upload-multi', form);
      showSaved();
    } catch { setError('Erro ao enviar arquivos.'); }
  };

  const removeMultiFile = async (questionId: string, index: number) => {
    const updated = (multiFiles[questionId] || []).filter((_, i) => i !== index);
    setMultiFiles(prev => ({ ...prev, [questionId]: updated }));
    if (updated.length > 0) {
      const form = new FormData();
      updated.forEach(f => form.append('files', f));
      form.append('employeeId', employeeId);
      form.append('questionId', questionId);
      await api.post('/upload-multi', form).catch(() => {});
    } else {
      setUploadedDocs(prev => ({ ...prev, [questionId]: [] }));
      await api.post('/answer/text', { employeeId, questionId, value: '' }).catch(() => {});
    }
  };

  // Gera preview local de arquivo (imagem ou PDF)
  const openPreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl({ url, name: file.name, type: file.type });
  };

  const openServerPreview = (docId: string, fileName: string, mimeType: string) => {
    const url = `${api.defaults.baseURL}/file/${docId}`;
    setPreviewUrl({ url, name: fileName, type: mimeType });
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl.url);
    setPreviewUrl(null);
  };

  const showSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const handleSaveAndExit = () => {
    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onBack();
    }, 1200);
  };

  const handleNext = async () => {
    setLoading(true); setError('');
    const phase = process?.phases?.[currentPhaseIndex];
    const cepQuestion = phase?.questions?.find((q: any) => q.type === 'CEP');
    if (cepQuestion && answers[cepQuestion.id]) {
      const qs = phase.questions;
      const get = (label: string) => {
        const q = qs.find((x: any) => x.label.toLowerCase().includes(label));
        return q ? (answers[q.id] || '') : '';
      };
      await api.post('/employee/address', {
        employeeId,
        cep: answers[cepQuestion.id] || '',
        street: get('rua') || get('logradouro'),
        number: get('número') || get('numero'),
        complement: get('complemento'),
        neighborhood: get('bairro'),
        city: get('cidade'),
        state: get('estado')
      }).catch(() => {});
    }
    try {
      await api.post('/next-step', { employeeId });
      if (currentPhaseIndex < process.phases.length - 1) {
        setCurrentPhaseIndex(i => i + 1);
        setRhFeedback(null);
        setCepFound(false);
        setCepError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao avançar.');
    } finally { setLoading(false); }
  };

  // Ícone de tipo de arquivo
  const fileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  };

  // ---- TELA CPF ----
  if (step === 'cpf') return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl mb-4 shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Portal do Colaborador</h1>
          <p className="text-slate-500 text-sm mt-1">Insira seu CPF para continuar ou retomar seu preenchimento</p>
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

  // ---- TELA CADASTRO ----
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

  // ---- TELA FORMULÁRIO ----
  if (step === 'form' && process) {
    const phase = process.phases[currentPhaseIndex];
    const totalPhases = process.phases.length;
    const progress = Math.round(((currentPhaseIndex) / totalPhases) * 100);

    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">

        {/* Modal de preview de arquivo */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={closePreview}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  {fileIcon(previewUrl.type)}
                  <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{previewUrl.name}</span>
                </div>
                <button onClick={closePreview} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="overflow-auto max-h-[75vh] flex items-center justify-center bg-slate-100">
                {previewUrl.type === 'application/pdf' ? (
                  <iframe src={previewUrl.url} className="w-full" style={{ height: '70vh' }} title={previewUrl.name} />
                ) : (
                  <img src={previewUrl.url} alt={previewUrl.name} className="max-w-full max-h-[70vh] object-contain" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Banner salvo automaticamente */}
        <div className={`fixed top-4 right-4 z-40 transition-all duration-300 ${savedBanner ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
          <div className="bg-teal-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Salvo automaticamente
          </div>
        </div>

        <div className="max-w-lg mx-auto">
          {/* Progresso */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium">Etapa {currentPhaseIndex + 1} de {totalPhases}</span>
              <span>{process.title}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-2 bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex mt-2 gap-1">
              {process.phases.map((_: any, i: number) => (
                <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < currentPhaseIndex ? 'bg-teal-500' : i === currentPhaseIndex ? 'bg-teal-300' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          {/* Aviso de retomada */}
          {currentPhaseIndex > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M12 8v4l3 3" />
              </svg>
              <p className="text-teal-700 text-xs">Seu progresso foi salvo. Você pode continuar de onde parou.</p>
            </div>
          )}

          {rhFeedback && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="font-semibold text-amber-800 text-sm mb-1">⚠️ Correções solicitadas pelo RH</p>
              <p className="text-amber-700 text-sm">{rhFeedback.message}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-1">{phase.title}</h2>
            <p className="text-slate-500 text-sm mb-6">Os dados são salvos automaticamente.</p>

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
                      <input type="text" value={answers[q.id] || ''}
                        onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    )}

                    {q.type === 'DATE' && (
                      <input type="date" value={answers[q.id] || ''}
                        onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    )}

                    {q.type === 'SELECT' && (
                      <select value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                        <option value="">Selecione...</option>
                        {q.options.map((o: any) => <option key={o.id} value={o.value}>{o.label}</option>)}
                      </select>
                    )}

                    {/* CEP com busca automática e preview do endereço encontrado */}
                    {q.type === 'CEP' && (
                      <div>
                        <div className="relative">
                          <input
                            type="text"
                            value={answers[q.id] || ''}
                            maxLength={9}
                            onChange={e => handleCep(q.id, e.target.value)}
                            className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none pr-10 transition-colors
                              ${ cepError ? 'border-red-400 bg-red-50' : cepFound ? 'border-teal-400 bg-teal-50/30' : 'border-slate-300' }`}
                            placeholder="00000-000"
                          />
                          {/* Spinner durante busca */}
                          {cepLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                          {/* Check verde quando CEP encontrado */}
                          {!cepLoading && cepFound && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                          {/* X vermelho quando CEP inválido */}
                          {!cepLoading && cepError && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Feedback de erro */}
                        {cepError && (
                          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {cepError}
                          </p>
                        )}

                        {/* Card de confirmação do endereço encontrado */}
                        {cepFound && answers[q.id]?.replace(/\D/g, '').length === 8 && (() => {
                          const qs = phase.questions;
                          const get = (label: string) => {
                            const found = qs.find((x: any) => x.label.toLowerCase().includes(label));
                            return found ? (answers[found.id] || '') : '';
                          };
                          const street = get('rua') || get('logradouro');
                          const neighborhood = get('bairro');
                          const city = get('cidade');
                          const state = get('estado');
                          return (
                            <div className="mt-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span className="text-xs font-semibold text-teal-700">Endereço encontrado</span>
                              </div>
                              <p className="text-xs text-teal-700">
                                {[street, neighborhood, city, state].filter(Boolean).join(' — ')}
                              </p>
                              <p className="text-xs text-teal-500 mt-1">Os campos abaixo foram preenchidos automaticamente. Complete o número.</p>
                            </div>
                          );
                        })()}

                        {!cepFound && !cepError && (
                          <p className="text-slate-400 text-xs mt-1">Digite o CEP para preencher o endereço automaticamente</p>
                        )}
                      </div>
                    )}

                    {/* Upload de arquivo único */}
                    {q.type === 'FILE' && (() => {
                      const serverDoc = uploadedDocs[q.id]?.[0];
                      const hasFile = answers[q.id] === 'ARQUIVO' || !!serverDoc;
                      return (
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-teal-400 transition-colors">
                          {hasFile ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2 text-teal-600">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-sm font-medium">Arquivo enviado</span>
                              </div>
                              {serverDoc && (
                                <button
                                  type="button"
                                  onClick={() => openServerPreview(serverDoc.id, serverDoc.fileName, serverDoc.mimeType)}
                                  className="text-xs text-teal-600 underline hover:text-teal-800 flex items-center gap-1 mx-auto"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  {serverDoc.fileName} — Visualizar
                                </button>
                              )}
                              <label className="text-xs text-slate-400 underline cursor-pointer">
                                Substituir arquivo
                                <input type="file" className="hidden" accept="image/*,.pdf"
                                  onChange={e => e.target.files?.[0] && handleFile(q.id, e.target.files[0])} />
                              </label>
                            </div>
                          ) : (
                            <label className="cursor-pointer block">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" className="mx-auto mb-2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              <p className="text-slate-500 text-sm">Clique para enviar</p>
                              <p className="text-slate-400 text-xs mt-1">PDF ou imagem (JPG, PNG)</p>
                              <input type="file" className="hidden" accept="image/*,.pdf"
                                onChange={e => e.target.files?.[0] && handleFile(q.id, e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      );
                    })()}

                    {/* Upload múltiplo (até 3 arquivos PDF ou imagem) */}
                    {q.type === 'MULTI_FILE' && (() => {
                      const localFiles = multiFiles[q.id] || [];
                      const serverDocs = uploadedDocs[q.id] || [];
                      const hasLocal = localFiles.length > 0;
                      const displayCount = hasLocal ? localFiles.length : serverDocs.length;
                      const canAdd = displayCount < 3;

                      return (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">
                            Envie até 3 arquivos (PDF ou imagem) como comprovante.
                            {displayCount > 0 && <span className="ml-1 font-medium text-teal-600">{displayCount}/3 enviado{displayCount > 1 ? 's' : ''}</span>}
                          </p>

                          {/* Arquivos locais (recém selecionados) */}
                          {hasLocal && localFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                              {fileIcon(file.type)}
                              <button
                                type="button"
                                onClick={() => openPreview(file)}
                                className="text-xs text-teal-700 flex-1 truncate text-left underline hover:text-teal-900"
                              >
                                {file.name}
                              </button>
                              <span className="text-xs text-slate-400 shrink-0">
                                {file.type === 'application/pdf' ? 'PDF' : 'Imagem'}
                              </span>
                              <button type="button" onClick={() => removeMultiFile(q.id, i)}
                                className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ))}

                          {/* Arquivos do servidor (sessões anteriores) */}
                          {!hasLocal && serverDocs.map((doc, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                              {fileIcon(doc.mimeType)}
                              <button
                                type="button"
                                onClick={() => openServerPreview(doc.id, doc.fileName, doc.mimeType)}
                                className="text-xs text-slate-700 flex-1 truncate text-left underline hover:text-teal-700"
                              >
                                {doc.fileName}
                              </button>
                              <span className="text-xs text-slate-400 shrink-0">
                                {doc.mimeType === 'application/pdf' ? 'PDF' : 'Imagem'}
                              </span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ))}

                          {canAdd && (
                            <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              <span className="text-xs text-slate-500">
                                {displayCount === 0
                                  ? 'Adicionar arquivo (PDF ou imagem, máx 3)'
                                  : `Adicionar mais (${3 - displayCount} restante${3 - displayCount > 1 ? 's' : ''})`}
                              </span>
                              <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                                onChange={e => e.target.files && handleMultiFile(q.id, e.target.files)} />
                            </label>
                          )}

                          {displayCount === 3 && (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Máximo de 3 arquivos atingido.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {error && <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

            <button onClick={handleNext} disabled={loading}
              className="w-full mt-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
              {loading ? 'Salvando...' : currentPhaseIndex < totalPhases - 1 ? 'Próxima etapa →' : 'Enviar documentos'}
            </button>

            {/* Botão salvar e sair */}
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="w-full mt-3 border border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 font-medium py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Salvar e continuar depois
            </button>

            <p className="text-center text-xs text-slate-400 mt-3">
              Pode fechar e voltar a qualquer momento — seu progresso é salvo automaticamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'form' && !process) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Carregando formulário...</p>
      </div>
    </div>
  );

  // ---- TELA CONCLUÍDO ----
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Tudo certo!</h2>
        <p className="text-slate-500">Seus documentos foram enviados com sucesso. O RH irá analisar e entrar em contato em breve.</p>
      </div>
    </div>
  );
}
