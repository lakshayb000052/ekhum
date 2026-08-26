import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { EVENT_TYPES, autoEnrolFromEvent } from '../services/journeyExecutor';

const router = Router();
router.use(authenticate);

async function resolveContact(orgId: string, input?: string | null): Promise<string | null> {
  if (!input || typeof input !== 'string' || !input.trim()) {
    // If no input provided, use most recent donor or create a test donor
    const recent = await pool.query('SELECT id FROM donors WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1', [orgId]);
    if (recent.rows.length > 0) return recent.rows[0].id;
    const created = await pool.query(
      `INSERT INTO donors (organization_id, name, email, phone) 
       VALUES ($1, 'Test Donor', 'test@donor.org', '+919999999999') 
       RETURNING id`,
      [orgId]
    );
    return created.rows[0]?.id || null;
  }

  const trimmed = input.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(trimmed)) {
    const dRes = await pool.query('SELECT id FROM donors WHERE id = $1', [trimmed]);
    if (dRes.rows.length > 0) return dRes.rows[0].id;
  }

  // Lookup by phone, email, or name
  const match = await pool.query(
    `SELECT id FROM donors 
     WHERE (organization_id = $1 OR organization_id IS NULL) 
       AND (phone ILIKE $2 OR email ILIKE $2 OR name ILIKE $2) 
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, `%${trimmed}%`]
  );
  if (match.rows.length > 0) return match.rows[0].id;

  // If input looks like phone or email, create donor with it
  const isEmail = trimmed.includes('@');
  const isPhone = /^\+?[0-9]{7,15}$/.test(trimmed.replace(/[\s-]/g, ''));
  const newEmail = isEmail ? trimmed : `donor_${Date.now()}@danapro.org`;
  const newPhone = isPhone ? trimmed : '+919999999999';

  const newDonor = await pool.query(
    `INSERT INTO donors (organization_id, name, email, phone) 
     VALUES ($1, 'Test Contact', $2, $3) 
     RETURNING id`,
    [orgId, newEmail, newPhone]
  );
  return newDonor.rows[0]?.id || null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { event_type, contact_id } = req.query;
    const orgId = user.organization_id || user.organizationId;
    let query = 'SELECT * FROM events WHERE (organization_id = $1 OR $2 = \'superadmin\')';
    const params: any[] = [orgId, user.role];
    let count = 3;
    
    if (event_type) {
      query += ` AND event_type = $${count++}`;
      params.push(event_type);
    }
    if (contact_id) {
      query += ` AND contact_id = $${count++}`;
      params.push(contact_id);
    }
    query += ' ORDER BY occurred_at DESC LIMIT 50';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { event_type, contact_id, payload } = req.body;
    const orgId = user.organization_id || user.organizationId;
    const resolvedContactId = await resolveContact(orgId, contact_id);

    const result = await pool.query(
      `INSERT INTO events (organization_id, event_type, contact_id, payload, source, occurred_at)
       VALUES ($1, $2, $3, $4, 'api', NOW()) RETURNING *`,
      [orgId, event_type, resolvedContactId, JSON.stringify(payload || {})]
    );
    const event = result.rows[0];
    if (resolvedContactId) {
      await autoEnrolFromEvent(event_type, orgId, resolvedContactId, event.id);
    }
    res.json({ success: true, data: event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/types', (req: Request, res: Response) => {
  res.json({ success: true, data: EVENT_TYPES });
});

router.post('/fire', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { event_type, contact_id, payload } = req.body;
    const orgId = user.organization_id || user.organizationId;
    const resolvedContactId = await resolveContact(orgId, contact_id);

    const result = await pool.query(
      `INSERT INTO events (organization_id, event_type, contact_id, payload, source, occurred_at)
       VALUES ($1, $2, $3, $4, 'test', NOW()) RETURNING *`,
      [orgId, event_type, resolvedContactId, JSON.stringify(payload || {})]
    );
    const event = result.rows[0];
    if (resolvedContactId) {
      await autoEnrolFromEvent(event_type, orgId, resolvedContactId, event.id);
    }
    res.json({ success: true, data: event });
  } catch (err: any) {
    console.error('[Event Trigger Engine Fire Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
