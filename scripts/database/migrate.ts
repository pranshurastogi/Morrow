import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, { max: 1 });
const migrationDirectory = new URL(
  "../../backend/database/migrations/",
  import.meta.url,
);

await sql`
  create table if not exists morrow_schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const migrationFiles = Array.from(
  new Bun.Glob("*.sql").scanSync({
    cwd: migrationDirectory.pathname,
    onlyFiles: true,
  }),
).sort();

for (const name of migrationFiles) {
  const alreadyApplied = await sql`
    select 1 from morrow_schema_migrations where name = ${name} limit 1
  `;
  if (alreadyApplied.length > 0) continue;

  const contents = await Bun.file(new URL(name, migrationDirectory)).text();
  await sql.begin(async (transaction) => {
    await transaction.unsafe(contents);
    await transaction`
      insert into morrow_schema_migrations (name) values (${name})
    `;
  });
  console.info(`Applied ${name}`);
}

await sql.end();
