# Onboarding 2.0

Sistema de onboarding digital com suporte a múltiplas empresas parceiras e controle de acesso por perfil.

## Perfis de acesso

| Perfil | Permissões |
|---|---|
| **ADMIN** | Acesso total — gerencia empresas, usuários, candidatos |
| **HR** | Valida documentos, aprova candidatos |
| **PARTNER** | Vê apenas candidatos e fases liberadas para sua empresa |
| **Candidato** | Acessa via CPF, preenche formulário |

## Funcionalidades

- ✅ Autenticação JWT (ADMIN / HR / PARTNER)
- ✅ Acesso do candidato via CPF
- ✅ Flag de acesso ao link (`hasAccessed`, `firstAccessAt`)
- ✅ Multi-empresa com permissões por fase
- ✅ Dashboard kanban com etapas
- ✅ Upload de documentos
- ✅ Aprovação e feedback do RH

## Setup rápido

```bash
# 1. Subir banco
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run build
node dist/server.js

# 3. Frontend
cd ../frontend
npm install
npm run build
npx serve -s dist -l 3001
```

## Credenciais padrão (seed)

```
Admin:   admin@empresa.com   / admin123
Partner: parceiro@empresa.com / parceiro123
```

## Variáveis de ambiente

```env
DATABASE_URL="postgresql://onboarding:senha_segura@localhost:5432/onboarding_db"
JWT_SECRET="troque-por-uma-chave-secreta-forte"
PORT=3000
```
