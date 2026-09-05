import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import { 
  getRegisteredObjects, 
  getObjectFields, 
  addFieldToObject, 
  createCustomObject, 
  getSchemaGraph,
  STANDARD_RELATIONSHIPS 
} from '../services/schemaService';

const router = Router();

// GET /api/object-manager/objects — List all standard & custom database entities with live metrics
router.get('/objects', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    const objects = await getRegisteredObjects(orgId);
    res.json({ success: true, data: objects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/object-manager/objects — Create a new custom database object with standard multi-tenant schema
router.post('/objects', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.body.organization_id || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);

    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required to create a custom object.' });
    }

    const { object_name, label_singular, label_plural, description, icon } = req.body;
    if (!object_name || !label_singular) {
      return res.status(400).json({ success: false, message: 'Object API Name and Singular Label are required.' });
    }

    const result = await createCustomObject(orgId, {
      object_name,
      label_singular,
      label_plural: label_plural || `${label_singular}s`,
      description,
      icon
    });

    res.status(201).json({ success: true, data: result, message: `Custom entity '${label_singular}' created successfully in PostgreSQL!` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/object-manager/schema-graph — Return interactive ER Diagram nodes and relationship edges
router.get('/schema-graph', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    const graph = await getSchemaGraph(orgId);
    res.json({ success: true, data: graph });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/object-manager/objects/:name/fields (and /fields/:name) — List all fields with rich types & metadata
router.get(['/fields/:name', '/objects/:name/fields'], authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    const { name } = req.params;

    const fields = await getObjectFields(name, orgId);
    res.json({ success: true, data: fields });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/object-manager/objects/:name/fields — Add custom field with PostgreSQL ALTER TABLE and field_definitions
router.post(['/objects/:name/fields', '/fields/:name'], authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.body.organization_id || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);
    const { name } = req.params;
    const { 
      field_name, 
      label, 
      field_label, 
      type, 
      field_type, 
      is_required, 
      required, 
      default_value, 
      picklist_values, 
      lookup_target_object, 
      help_text, 
      group_name 
    } = req.body;

    const finalFieldName = field_name || label;
    const finalFieldLabel = field_label || label || field_name;
    const finalFieldType = field_type || type || 'text';

    if (!finalFieldName) {
      return res.status(400).json({ success: false, message: 'Field name is required.' });
    }

    const savedField = await addFieldToObject(orgId, name, {
      object_name: name,
      field_name: finalFieldName,
      field_label: finalFieldLabel,
      field_type: finalFieldType,
      is_required: is_required || required || false,
      default_value,
      picklist_values,
      lookup_target_object,
      help_text,
      group_name
    });

    res.status(201).json({ 
      success: true, 
      data: savedField, 
      message: `Custom field '${finalFieldLabel}' added successfully to ${name}!` 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/object-manager/objects/:name/fields/:field_name — Update custom field metadata
router.put('/objects/:name/fields/:field_name', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.body.organization_id || user?.organizationId || user?.organization_id) 
      : (user?.organizationId || user?.organization_id);
    const { name, field_name } = req.params;
    const { field_label, is_required, picklist_values, help_text, group_name, permissions } = req.body;

    const result = await pool.query(
      `UPDATE field_definitions 
       SET 
         field_label = COALESCE($1, field_label),
         is_required = COALESCE($2, is_required),
         picklist_values = COALESCE($3, picklist_values),
         help_text = COALESCE($4, help_text),
         group_name = COALESCE($5, group_name),
         permissions = COALESCE($6, permissions),
         updated_at = NOW()
       WHERE object_name = $7 AND field_name = $8 AND (organization_id = $9 OR organization_id IS NULL)
       RETURNING *`,
      [
        field_label || null,
        is_required !== undefined ? is_required : null,
        picklist_values ? JSON.stringify(picklist_values) : null,
        help_text || null,
        group_name || null,
        permissions ? JSON.stringify(permissions) : null,
        name,
        field_name,
        orgId || null
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Field definition not found.' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Field definition updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/object-manager/objects/:name/fields/:field_name — Drop custom field
router.delete('/objects/:name/fields/:field_name', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);
    const { name, field_name } = req.params;

    const safeObj = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeField = field_name.toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Prevent deleting system columns
    const systemProtected = ['id', 'organization_id', 'created_at', 'updated_at', 'name', 'email', 'amount', 'status'];
    if (systemProtected.includes(safeField)) {
      return res.status(400).json({ success: false, message: 'System core fields cannot be deleted.' });
    }

    await pool.query(`ALTER TABLE ${safeObj} DROP COLUMN IF EXISTS ${safeField}`);
    await pool.query(
      `DELETE FROM field_definitions WHERE object_name = $1 AND field_name = $2 AND (organization_id = $3 OR organization_id IS NULL)`,
      [safeObj, safeField, orgId || null]
    );

    res.json({ success: true, message: `Field '${safeField}' removed from ${safeObj}.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/object-manager/relationships — List relational foreign keys
router.get('/relationships', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || user?.organization_id);

    let customRels: any = { rows: [] };
    try {
      customRels = await pool.query(`SELECT * FROM object_relationships WHERE organization_id = $1 OR organization_id IS NULL`, [orgId || null]);
    } catch {}

    const allRels = [...STANDARD_RELATIONSHIPS, ...customRels.rows];
    res.json({ success: true, data: allRels });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
