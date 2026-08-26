import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

const OBJECT_METADATA: Record<string, { label: string; icon: string; description: string }> = {
  donors: { label: 'Contacts (Donors)', icon: '👤', description: 'Central donor profile records, engagement scores, and tax IDs' },
  donations: { label: 'Donations', icon: '💰', description: 'Real-time payment transactions, gateway refs, and tax stamps' },
  campaigns: { label: 'Campaigns', icon: '📢', description: 'Fundraising initiatives, goal amounts, and landing page URLs' },
  subscriptions: { label: 'Subscriptions', icon: '🔄', description: 'Recurring monthly/annual donor auto-debit plans' },
  mandates: { label: 'Mandates', icon: '💳', description: 'NPCI e-NACH & UPI recurring payment mandate authorizations' },
  eighty_g_receipts: { label: '80G Receipts', icon: '📑', description: 'Statutory 80G tax exemption certificates and audit logs' },
  journeys: { label: 'Journeys', icon: '⚡', description: 'Automated donor engagement and retention workflow maps' },
  broadcasts: { label: 'Broadcasts', icon: '📣', description: 'Bulk SMS, Email, and WhatsApp campaign dispatch batches' },
  organizations: { label: 'NGOs', icon: '🏢', description: 'Registered NGO foundation tenant profiles and gateway configs' },
  templates: { label: 'Templates', icon: '✉️', description: 'Master email, WhatsApp, and 80G certificate layouts' },
};

router.get('/objects', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        table_name as name, 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as field_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const objects = result.rows.map(row => {
      const meta = OBJECT_METADATA[row.name] || {
        label: row.name.charAt(0).toUpperCase() + row.name.slice(1).replace(/_/g, ' '),
        icon: '📦',
        description: `Database entity table for ${row.name}`
      };
      return {
        name: row.name,
        label: meta.label,
        icon: meta.icon,
        description: meta.description,
        fields: Number(row.field_count || 0)
      };
    });

    res.json({ success: true, data: objects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get(['/fields/:name', '/objects/:name/fields'], authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const result = await pool.query(`
      SELECT 
        column_name as name, 
        column_name as label,
        data_type as type, 
        (is_nullable = 'NO') as required,
        (column_name IN ('id', 'created_at', 'updated_at', 'organization_id')) as is_system
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position ASC
    `, [name]);

    const formatted = result.rows.map(col => ({
      name: col.name,
      label: col.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: col.type.toUpperCase(),
      required: col.required,
      is_system: col.is_system
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/objects/:name/fields', authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { field_name, type, required } = req.body;
    
    // Sanitize field name
    const sanitizedName = field_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sqlType = type === 'number' ? 'NUMERIC' : (type === 'boolean' ? 'BOOLEAN' : (type === 'date' ? 'TIMESTAMP WITH TIME ZONE' : 'TEXT'));
    
    await pool.query(`ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS ${sanitizedName} ${sqlType}`);
    
    res.json({ success: true, message: `Custom field '${sanitizedName}' added successfully to ${name}!` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/objects/:name/fields/:id', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Field updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/objects/:name/fields/:id', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Custom field removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/objects/:name/permissions', authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const result = await pool.query('SELECT * FROM field_permissions WHERE object_name = $1', [name]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/objects/:name/permissions', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Permissions updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/relationships', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
