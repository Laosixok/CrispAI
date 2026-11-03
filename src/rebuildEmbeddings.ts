import sql, { migrate } from "./services/db.service";
import { createEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./services/openai.service";

// Sequential, bounded-memory rebuild. Each write checks that the original text is unchanged.
let failed = 0;
try {
  await migrate();
  let cursor = "00000000-0000-0000-0000-000000000000";
  let count = 0;
  while (true) {
    const rows = await sql`select id, raw from payload where id > ${cursor}::uuid order by id limit 20`;
    if (!rows.length) break;
    for (const row of rows) {
      cursor = row.id;
      try {
        const vector = await createEmbedding(row.raw);
        const updated = await sql`update payload
          set vector = ${JSON.stringify(vector)}::extensions.vector,
              embedding_model = ${EMBEDDING_MODEL}
          where id = ${row.id} and raw = ${row.raw} returning id`;
        if (!updated.length) throw new Error("知识条目已被修改或删除，请重新执行");
        console.log(`Rebuilt ${++count}: ${row.id} (${EMBEDDING_DIMENSIONS})`);
      } catch {
        failed++;
        console.error(`Failed: ${row.id}; check embedding provider and rerun`);
      }
    }
  }
  console.log(`Completed: ${count}, failed: ${failed}`);
} finally {
  await sql.close();
}
if (failed) process.exitCode = 1;
