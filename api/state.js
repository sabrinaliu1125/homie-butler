import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expectedPin = String(process.env.HOMIE_FAMILY_PIN || '').trim();
  const body = req.body || {};
  const providedPin = String(body.pin || '').trim();
  const action = body.action;

  if (!expectedPin) return res.status(500).json({ ok:false, error:'HOMIE_FAMILY_PIN is not configured' });
  if (providedPin !== expectedPin) return res.status(401).json({ ok:false, error:'Unauthorized' });

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) return res.status(500).json({ ok:false, error:'Database URL missing' });

  const sql = neon(databaseUrl);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS homie_state (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE homie_state ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1`;

    if (action === 'get') {
      const rows = await sql`
        SELECT data, updated_at, revision
        FROM homie_state
        WHERE id = 1
      `;
      if (rows.length === 0) return res.status(200).json({ ok:true, data:null, revision:0 });
      return res.status(200).json({
        ok:true,
        data:rows[0].data,
        updatedAt:rows[0].updated_at,
        revision:Number(rows[0].revision || 1)
      });
    }

    if (action === 'save') {
      const data = body.data;
      const baseRevision = Number(body.baseRevision);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ ok:false, error:'Invalid data' });
      }

      const current = await sql`
        SELECT data, updated_at, revision
        FROM homie_state
        WHERE id = 1
      `;

      if (current.length === 0) {
        await sql`
          INSERT INTO homie_state (id, data, updated_at, revision)
          VALUES (1, ${JSON.stringify(data)}::jsonb, NOW(), 1)
        `;
        return res.status(200).json({ ok:true, revision:1 });
      }

      const currentRevision = Number(current[0].revision || 1);

      if (!Number.isFinite(baseRevision) || baseRevision !== currentRevision) {
        return res.status(409).json({
          ok:false,
          error:'STALE_STATE',
          revision:currentRevision,
          data:current[0].data,
          updatedAt:current[0].updated_at
        });
      }

      const nextRevision = currentRevision + 1;
      const updated = await sql`
        UPDATE homie_state
        SET data=${JSON.stringify(data)}::jsonb,
            updated_at=NOW(),
            revision=${nextRevision}
        WHERE id=1 AND revision=${currentRevision}
        RETURNING revision, updated_at
      `;

      if (updated.length === 0) {
        const latest = await sql`
          SELECT data, updated_at, revision
          FROM homie_state
          WHERE id=1
        `;
        return res.status(409).json({
          ok:false,
          error:'STALE_STATE',
          revision:Number(latest[0]?.revision || currentRevision),
          data:latest[0]?.data || null,
          updatedAt:latest[0]?.updated_at || null
        });
      }

      return res.status(200).json({
        ok:true,
        revision:Number(updated[0].revision),
        updatedAt:updated[0].updated_at
      });
    }

    return res.status(400).json({ ok:false, error:'Invalid action' });
  } catch (error) {
    console.error('Homie state API error:', error);
    return res.status(500).json({ ok:false, error:'Database operation failed' });
  }
}
