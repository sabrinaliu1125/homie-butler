import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const expectedPin = process.env.HOMIE_FAMILY_PIN;
  const providedPin = req.headers['x-homie-pin'];

  if (!expectedPin || providedPin !== expectedPin) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    return res.status(500).json({ ok: false, error: 'Database URL missing' });
  }

  const sql = neon(databaseUrl);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS homie_state (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data, updated_at
        FROM homie_state
        WHERE id = 1
      `;

      if (rows.length === 0) {
        return res.status(200).json({ ok: true, data: null });
      }

      return res.status(200).json({
        ok: true,
        data: rows[0].data,
        updatedAt: rows[0].updated_at
      });
    }

    if (req.method === 'POST') {
      const data = req.body;

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid data' });
      }

      await sql`
        INSERT INTO homie_state (id, data, updated_at)
        VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
