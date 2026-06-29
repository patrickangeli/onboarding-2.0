import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET = process.env.JWT_SECRET || 'onboarding-secret-2.0';

app.use(express.json());
app.use(cors());

// -----------------------------------------------
// SETUP
// -----------------------------------------------

app.post('/api/setup', async (req, res) => {
  const { secret } = req.body;
  if (secret !== (process.env.SETUP_SECRET || 'setup-onboarding-2024')) {
    return res.status(403).json({ error: 'Proibido' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: 'admin@empresa.com' } });
    if (existing) return res.json({ message: 'Setup j\u00e1 realizado.', email: 'admin@empresa.com' });

    const process = await prisma.onboardingProcess.create({
      data: {
        title: 'Admiss\u00e3o - Padr\u00e3o',
        description: 'Fluxo de onboarding padr\u00e3o',
        phases: {
          create: [
            {
              title: 'Dados Pessoais', order: 1,
              questions: {
                create: [
                  { label: 'Nome Completo', type: 'TEXT', required: true, order: 1 },
                  { label: 'Data de Nascimento', type: 'DATE', required: true, order: 2 },
                  { label: 'G\u00eanero', type: 'SELECT', required: true, order: 3, options: { create: [{ label: 'Masculino', value: 'M', order: 1 }, { label: 'Feminino', value: 'F', order: 2 }, { label: 'Prefiro n\u00e3o dizer', value: 'NB', order: 3 }] } },
                  { label: 'Estado Civil', type: 'SELECT', required: true, order: 4, options: { create: [{ label: 'Solteiro(a)', value: 'SOLTEIRO', order: 1 }, { label: 'Casado(a)', value: 'CASADO', order: 2 }, { label: 'Divorciado(a)', value: 'DIVORCIADO', order: 3 }, { label: 'Vi\u00favo(a)', value: 'VIUVO', order: 4 }, { label: 'Uni\u00e3o Est\u00e1vel', value: 'UNIAO_ESTAVEL', order: 5 }] } },
                  { label: 'Documentos comprobat\u00f3rios (at\u00e9 3 arquivos)', type: 'MULTI_FILE', required: false, order: 5 }
                ]
              }
            },
            {
              title: 'Endere\u00e7o', order: 2,
              questions: {
                create: [
                  { label: 'CEP', type: 'CEP', required: true, order: 1 },
                  { label: 'Rua', type: 'TEXT', required: true, order: 2 },
                  { label: 'N\u00famero', type: 'TEXT', required: true, order: 3 },
                  { label: 'Complemento', type: 'TEXT', required: false, order: 4 },
                  { label: 'Bairro', type: 'TEXT', required: true, order: 5 },
                  { label: 'Cidade', type: 'TEXT', required: true, order: 6 },
                  { label: 'Estado', type: 'TEXT', required: true, order: 7 },
                  { label: 'Documentos comprobat\u00f3rios (at\u00e9 3 arquivos)', type: 'MULTI_FILE', required: false, order: 8 }
                ]
              }
            },
            {
              title: 'Documenta\u00e7\u00e3o', order: 3,
              questions: {
                create: [
                  { label: 'Foto do RG (Frente e Verso)', type: 'FILE', required: true, order: 1 },
                  { label: 'Comprovante de Resid\u00eancia', type: 'FILE', required: true, order: 2 },
                  { label: 'CPF', type: 'FILE', required: true, order: 3 }
                ]
              }
            }
          ]
        }
      },
      include: { phases: true }
    });

    const company = await prisma.company.create({
      data: {
        name: 'Empresa Parceira Demo', slug: 'parceira-demo',
        phaseAccess: { create: [{ phaseId: process.phases[0].id }, { phaseId: process.phases[1].id }] }
      }
    });

    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({ data: { name: 'Admin RH', email: 'admin@empresa.com', passwordHash: adminHash, role: 'ADMIN', active: true } });

    const partnerHash = await bcrypt.hash('parceiro123', 10);
    await prisma.user.create({ data: { name: 'Usu\u00e1rio Parceiro', email: 'parceiro@empresa.com', passwordHash: partnerHash, role: 'PARTNER', companyId: company.id, active: true } });

    return res.json({
      message: 'Setup conclu\u00eddo!',
      processId: process.id,
      admin: { email: 'admin@empresa.com', password: 'admin123' },
      partner: { email: 'parceiro@empresa.com', password: 'parceiro123' }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no setup', details: String(error) });
  }
});

// -----------------------------------------------
// MIDDLEWARE DE AUTENTICA\u00c7\u00c3O
// -----------------------------------------------

function authMiddleware(roles: string[] = []) {
  return (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token n\u00e3o fornecido' });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Token inv\u00e1lido' });
    }
  };
}

// -----------------------------------------------
// AUTH
// -----------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciais inv\u00e1lidas' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inv\u00e1lidas' });
    const token = jwt.sign(
      { id: user.id, role: user.role, companyId: user.companyId, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, user: { id: user.id, name: user.name, role: user.role, company: user.company } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// -----------------------------------------------
// PROCESSOS
// -----------------------------------------------

app.get('/api/process/first', async (req, res) => {
  try {
    const process = await prisma.onboardingProcess.findFirst({
      select: { id: true, title: true }
    });
    if (!process) return res.status(404).json({ error: 'Nenhum processo encontrado.' });
    return res.json(process);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar processo.' });
  }
});

app.get('/api/processes', authMiddleware(['ADMIN', 'HR', 'PARTNER']), async (req, res) => {
  try {
    const processes = await prisma.onboardingProcess.findMany({
      select: { id: true, title: true, description: true }
    });
    return res.json(processes);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar processos.' });
  }
});

app.get('/api/process/:id/structure', async (req, res) => {
  const { id } = req.params;
  try {
    const process = await prisma.onboardingProcess.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: { orderBy: { order: 'asc' } } }
            }
          }
        }
      }
    });
    if (!process) return res.status(404).json({ error: 'Processo n\u00e3o encontrado' });
    return res.json(process);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar estrutura' });
  }
});

// -----------------------------------------------
// CEP LOOKUP (p\u00fablico)
// -----------------------------------------------

app.get('/api/cep/:cep', async (req, res) => {
  const cep = req.params.cep.replace(/\D/g, '');
  if (cep.length !== 8) return res.status(400).json({ error: 'CEP inv\u00e1lido' });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await r.json() as any;
    if (data.erro) return res.status(404).json({ error: 'CEP n\u00e3o encontrado' });
    return res.json({
      cep: data.cep,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf
    });
  } catch {
    return res.status(500).json({ error: 'Erro ao consultar CEP' });
  }
});

// -----------------------------------------------
// CANDIDATO
// -----------------------------------------------

app.get('/api/employee/check-cpf/:cpf', async (req, res) => {
  const cpfLimpo = req.params.cpf.replace(/\D/g, '');
  try {
    const employee = await prisma.employee.findUnique({
      where: { cpf: cpfLimpo },
      select: { id: true, hasAccessed: true, currentPhaseId: true, status: true }
    });
    if (!employee) return res.status(404).json({ error: 'CPF n\u00e3o encontrado' });
    if (!employee.hasAccessed) {
      await prisma.employee.update({
        where: { cpf: cpfLimpo },
        data: { hasAccessed: true, firstAccessAt: new Date() }
      });
    }
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: 'Erro ao verificar CPF' });
  }
});

app.post('/api/employee', async (req, res) => {
  const { name, email, cpf, processId } = req.body;
  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const existing = await prisma.employee.findUnique({ where: { cpf: cpfLimpo } });
    if (existing) return res.status(400).json({ error: 'Este CPF j\u00e1 possui cadastro!' });
    const firstPhase = await prisma.phase.findFirst({ where: { processId, order: 1 } });
    if (!firstPhase) return res.status(400).json({ error: 'Processo sem fases.' });
    const employee = await prisma.employee.create({
      data: { name, email, cpf: cpfLimpo, currentPhaseId: firstPhase.id, status: 'IN_PROGRESS' }
    });
    return res.json(employee);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar candidato.' });
  }
});

app.get('/api/employee/:id/details', async (req, res) => {
  const { id } = req.params;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        address: true,
        currentPhase: true,
        company: true,
        answers: {
          include: {
            question: true,
            documents: { select: { id: true, fileName: true, mimeType: true } }
          }
        }
      }
    });
    if (!employee) return res.status(404).json({ error: 'Candidato n\u00e3o encontrado' });
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar detalhes.' });
  }
});

app.post('/api/employee/address', async (req, res) => {
  const { employeeId, cep, street, number, complement, neighborhood, city, state } = req.body;
  try {
    const address = await prisma.address.upsert({
      where: { employeeId },
      create: { employeeId, cep, street, number, complement, neighborhood, city, state },
      update: { cep, street, number, complement, neighborhood, city, state }
    });
    return res.json(address);
  } catch {
    return res.status(500).json({ error: 'Erro ao salvar endere\u00e7o.' });
  }
});

app.post('/api/next-step', async (req, res) => {
  const { employeeId } = req.body;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { currentPhase: { include: { questions: true } }, answers: true }
    });
    if (!employee) return res.status(404).json({ error: 'Colaborador n\u00e3o encontrado' });
    const missing = employee.currentPhase!.questions.filter(q =>
      q.required && !employee.answers.some(a => a.questionId === q.id)
    );
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Campos obrigat\u00f3rios n\u00e3o preenchidos.', missing: missing.map(q => q.label) });
    }
    const nextPhase = await prisma.phase.findFirst({
      where: { processId: employee.currentPhase!.processId, order: employee.currentPhase!.order + 1 }
    });
    if (!nextPhase) {
      await prisma.employee.update({ where: { id: employeeId }, data: { status: 'DOCS_SENT' } });
      return res.json({ message: 'Processo finalizado! Documentos enviados para an\u00e1lise.' });
    }
    await prisma.employee.update({ where: { id: employeeId }, data: { currentPhaseId: nextPhase.id } });
    return res.json({ message: 'Fase avan\u00e7ada com sucesso!', nextPhaseId: nextPhase.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Upload de arquivo \u00fanico (FILE)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { employeeId, questionId } = req.body as any;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const answer = await prisma.answer.upsert({
      where: { employeeId_questionId: { employeeId, questionId } },
      create: { employeeId, questionId, value: 'ARQUIVO' },
      update: { value: 'ARQUIVO' }
    });
    const existing = await prisma.document.findFirst({ where: { answerId: answer.id } });
    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: { fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer, uploadedAt: new Date() }
      });
    } else {
      await prisma.document.create({
        data: { fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer, employeeId, answerId: answer.id }
      });
    }
    return res.json({ message: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao fazer upload.' });
  }
});

// Upload m\u00faltiplo (MULTI_FILE, m\u00e1x 3 arquivos)
app.post('/api/upload-multi', upload.array('files', 3), async (req, res) => {
  const { employeeId, questionId } = req.body as any;
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const answer = await prisma.answer.upsert({
      where: { employeeId_questionId: { employeeId, questionId } },
      create: { employeeId, questionId, value: `${files.length} arquivo(s)` },
      update: { value: `${files.length} arquivo(s)` }
    });
    // Remove documentos antigos desta resposta
    await prisma.document.deleteMany({ where: { answerId: answer.id } });
    // Salva os novos
    await Promise.all(files.map(file =>
      prisma.document.create({
        data: { fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer, employeeId, answerId: answer.id }
      })
    ));
    return res.json({ message: `${files.length} arquivo(s) salvo(s) com sucesso!` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao fazer upload.' });
  }
});

app.get('/api/file/:documentId', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
    if (!doc) return res.status(404).json({ error: 'Arquivo n\u00e3o encontrado' });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    return res.send(doc.fileData);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar arquivo' });
  }
});

app.post('/api/answer/text', async (req, res) => {
  const { employeeId, questionId, value } = req.body;
  try {
    const answer = await prisma.answer.upsert({
      where: { employeeId_questionId: { employeeId, questionId } },
      update: { value },
      create: { employeeId, questionId, value }
    });
    return res.json(answer);
  } catch {
    return res.status(500).json({ error: 'Erro ao salvar resposta' });
  }
});

// -----------------------------------------------
// RH / ADMIN
// -----------------------------------------------

app.get('/api/employees', authMiddleware(['ADMIN', 'HR', 'PARTNER']), async (req: any, res) => {
  try {
    const where = req.user.role === 'PARTNER' ? { companyId: req.user.companyId } : {};
    const employees = await prisma.employee.findMany({
      where,
      include: { currentPhase: true, company: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(employees);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar candidatos.' });
  }
});

app.post('/api/employee/:id/feedback', authMiddleware(['ADMIN', 'HR']), async (req, res) => {
  const { feedback, corrections } = req.body;
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { feedback, corrections, status: 'PENDING' }
    });
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: 'Erro ao salvar feedback.' });
  }
});

app.post('/api/employee/:id/approve', authMiddleware(['ADMIN', 'HR']), async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', feedback: null, corrections: [] }
    });
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: 'Erro ao aprovar candidato.' });
  }
});

app.delete('/api/employee/:id', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Candidato removido.' });
  } catch {
    return res.status(500).json({ error: 'Erro ao remover candidato.' });
  }
});

app.get('/api/companies', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: { _count: { select: { employees: true, users: true } }, phaseAccess: { include: { phase: true } } }
    });
    return res.json(companies);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar empresas.' });
  }
});

app.post('/api/companies', authMiddleware(['ADMIN']), async (req, res) => {
  const { name, slug, phaseIds } = req.body;
  try {
    const company = await prisma.company.create({
      data: {
        name, slug,
        phaseAccess: { create: phaseIds.map((phaseId: string) => ({ phaseId })) }
      }
    });
    return res.json(company);
  } catch {
    return res.status(500).json({ error: 'Erro ao criar empresa.' });
  }
});

app.get('/api/users', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, company: true }
    });
    return res.json(users);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar usu\u00e1rios.' });
  }
});

app.post('/api/users', authMiddleware(['ADMIN']), async (req, res) => {
  const { name, email, password, role, companyId } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, companyId }
    });
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch {
    return res.status(500).json({ error: 'Erro ao criar usu\u00e1rio.' });
  }
});

app.listen(3000, () => console.log('Server rodando na porta 3000'));
