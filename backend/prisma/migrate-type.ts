/**
 * Script de migração: converte a coluna `type` da tabela `Question`
 * de enum para texto (VARCHAR) sem perder dados.
 * Executado uma única vez antes do `prisma db push`.
 */
import { Client } from 'pg';

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Verifica se a coluna ainda é enum (udt_name diferente de 'text'/'varchar')
    const check = await client.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_name = 'Question'
        AND column_name = 'type'
      LIMIT 1;
    `);

    if (check.rows.length === 0) {
      console.log('Tabela Question não existe ainda. Nada a migrar.');
      return;
    }

    const udt = check.rows[0].udt_name;
    console.log(`Tipo atual da coluna type: ${udt}`);

    if (udt === 'text' || udt === 'varchar') {
      console.log('Coluna já é texto. Nenhuma migração necessária.');
      return;
    }

    // Converte enum -> text usando USING cast
    console.log('Convertendo coluna type de enum para text...');
    await client.query(`
      ALTER TABLE "Question"
      ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
    `);
    console.log('✅ Migração concluída com sucesso!');

  } catch (err: any) {
    // Se o erro for que a tabela não existe, está tudo bem
    if (err.message?.includes('does not exist')) {
      console.log('Tabela não encontrada, pulando migração.');
      return;
    }
    console.error('Erro na migração:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
