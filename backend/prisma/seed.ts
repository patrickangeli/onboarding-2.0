import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Limpar banco
  await prisma.document.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.address.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.companyPhaseAccess.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.onboardingProcess.deleteMany();
  console.log('Banco limpo!');

  // Criar processo
  const process = await prisma.onboardingProcess.create({
    data: {
      title: 'Admissão TI - Padrão',
      description: 'Fluxo de onboarding para desenvolvedores',
      phases: {
        create: [
          {
            title: 'Dados Pessoais',
            order: 1,
            questions: {
              create: [
                { label: 'Nome Completo', type: 'TEXT', required: true, order: 1 },
                { label: 'Data de Nascimento', type: 'DATE', required: true, order: 2 },
                {
                  label: 'Gênero', type: 'SELECT', required: true, order: 3,
                  options: {
                    create: [
                      { label: 'Masculino', value: 'M', order: 1 },
                      { label: 'Feminino', value: 'F', order: 2 },
                      { label: 'Prefiro não dizer', value: 'NB', order: 3 }
                    ]
                  }
                },
                {
                  label: 'Estado Civil', type: 'SELECT', required: true, order: 4,
                  options: {
                    create: [
                      { label: 'Solteiro(a)', value: 'SOLTEIRO', order: 1 },
                      { label: 'Casado(a)', value: 'CASADO', order: 2 },
                      { label: 'Divorciado(a)', value: 'DIVORCIADO', order: 3 },
                      { label: 'Viúvo(a)', value: 'VIUVO', order: 4 },
                      { label: 'União Estável', value: 'UNIAO_ESTAVEL', order: 5 }
                    ]
                  }
                }
              ]
            }
          },
          {
            title: 'Endereço',
            order: 2,
            questions: {
              create: [
                { label: 'CEP', type: 'CEP', required: true, order: 1 },
                { label: 'Rua', type: 'TEXT', required: true, order: 2 },
                { label: 'Número', type: 'TEXT', required: true, order: 3 },
                { label: 'Complemento', type: 'TEXT', required: false, order: 4 },
                { label: 'Bairro', type: 'TEXT', required: true, order: 5 },
                { label: 'Cidade', type: 'TEXT', required: true, order: 6 },
                { label: 'Estado', type: 'TEXT', required: true, order: 7 }
              ]
            }
          },
          {
            title: 'Documentação',
            order: 3,
            questions: {
              create: [
                { label: 'Foto do RG (Frente e Verso)', type: 'FILE', required: true, order: 1 },
                { label: 'Comprovante de Residência', type: 'FILE', required: true, order: 2 },
                { label: 'CPF', type: 'FILE', required: true, order: 3 }
              ]
            }
          }
        ]
      }
    },
    include: { phases: true }
  });

  // Criar empresa parceira
  const phases = process.phases;
  const company = await prisma.company.create({
    data: {
      name: 'Empresa Parceira Demo',
      slug: 'parceira-demo',
      // Liberar apenas fases 1 e 2 para essa empresa
      phaseAccess: {
        create: [
          { phaseId: phases[0].id },
          { phaseId: phases[1].id }
        ]
      }
    }
  });

  // Criar usuário Admin
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: { name: 'Admin RH', email: 'admin@empresa.com', passwordHash: adminHash, role: 'ADMIN' }
  });

  // Criar usuário Parceiro
  const partnerHash = await bcrypt.hash('parceiro123', 10);
  await prisma.user.create({
    data: { name: 'Usuário Parceiro', email: 'parceiro@empresa.com', passwordHash: partnerHash, role: 'PARTNER', companyId: company.id }
  });

  console.log('\n========================================');
  console.log('SEED CONCLUÍDO COM SUCESSO!');
  console.log('PROCESS ID:', process.id);
  console.log('Admin:   admin@empresa.com / admin123');
  console.log('Partner: parceiro@empresa.com / parceiro123');
  console.log('========================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
