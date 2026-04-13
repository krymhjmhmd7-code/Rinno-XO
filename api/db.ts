import { createClient } from '@libsql/client';

// This runs on Vercel Serverless — TURSO credentials are server-side only
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, params } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  try {
    switch (action) {
      case 'execute': {
        const { sql, args } = params;
        const result = await tursoClient.execute({ sql, args: args || [] });
        return res.json({ success: true, result: { rows: result.rows, rowsAffected: result.rowsAffected } });
      }

      case 'batch': {
        const { statements } = params;
        const tx = await tursoClient.transaction('write');
        const results = [];
        for (const stmt of statements) {
          const result = await tx.execute({ sql: stmt.sql, args: stmt.args || [] });
          results.push({ rowsAffected: result.rowsAffected });
        }
        await tx.commit();
        return res.json({ success: true, results });
      }

      case 'getDatabaseUsage': {
        const countResult = await tursoClient.execute('PRAGMA page_count');
        const sizeResult = await tursoClient.execute('PRAGMA page_size');
        const pageCount = Number(countResult.rows[0][0]);
        const pageSize = Number(sizeResult.rows[0][0]);
        const totalBytes = pageCount * pageSize;
        const rowsResult = await tursoClient.execute('SELECT count(*) as c FROM customers');
        const totalRows = Number(rowsResult.rows[0].c);
        return res.json({ success: true, result: { sizeBytes: totalBytes, rows: totalRows } });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('DB API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
