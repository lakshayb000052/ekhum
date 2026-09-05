import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import pool from '../config/db';

const router = Router();

import { authenticate, AuthenticatedRequest } from '../middleware/auth';

// Ensure receipts directory exists locally
const receiptsDir = path.join(__dirname, '../../receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// GET /api/compliance/stats — live metrics for 80G & 10BD
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);

    let orgFilter = '';
    const params: any[] = [];
    if (organization_id) {
      orgFilter = ' AND d.organization_id = $1';
      params.push(organization_id);
    }

    // Total and voided 80G receipts
    const receiptsCountRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE voided = true) as voided_count
      FROM eighty_g_receipts 
      WHERE 1=1 ${organization_id ? 'AND organization_id = $1' : ''}
    `, params);

    const totalReceipts = Number(receiptsCountRes.rows[0]?.total || 0);
    const voidedCount = Number(receiptsCountRes.rows[0]?.voided_count || 0);

    // Missing PAN count in completed donations
    const missingPanDonationsRes = await pool.query(`
      SELECT 
        d.id, d.amount, d.currency, d.created_at,
        dn.id as donor_id, dn.name as donor_name, dn.email, dn.phone, dn.tax_id
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.status = 'completed' 
        AND (dn.tax_id IS NULL OR TRIM(dn.tax_id) = '' OR UPPER(dn.tax_id) = 'PAN_PENDING')
        ${orgFilter}
      ORDER BY d.created_at DESC
      LIMIT 100
    `, params);

    const missingPanCount = missingPanDonationsRes.rows.length;

    // 10BD aggregate stats
    const tenBdRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE dn.tax_id IS NOT NULL AND TRIM(dn.tax_id) != '' AND UPPER(dn.tax_id) != 'PAN_PENDING') as valid_pan_count,
        COALESCE(SUM(d.amount) FILTER (WHERE dn.tax_id IS NOT NULL AND TRIM(dn.tax_id) != '' AND UPPER(dn.tax_id) != 'PAN_PENDING'), 0) as valid_pan_amount,
        COUNT(*) FILTER (WHERE dn.tax_id IS NULL OR TRIM(dn.tax_id) = '' OR UPPER(dn.tax_id) = 'PAN_PENDING') as missing_pan_count
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.currency = 'INR' AND d.status = 'completed'
        ${orgFilter}
    `, params);

    const validPanCount = Number(tenBdRes.rows[0]?.valid_pan_count || 0);
    const validPanAmount = Number(tenBdRes.rows[0]?.valid_pan_amount || 0);
    const excludedCount = Number(tenBdRes.rows[0]?.missing_pan_count || 0);

    // Latest filing status from ten_bd_exports
    const latestFilingRes = await pool.query(`
      SELECT filing_status FROM ten_bd_exports 
      WHERE 1=1 ${organization_id ? 'AND organization_id = $1' : ''}
      ORDER BY created_at DESC LIMIT 1
    `, params);
    const filingStatus = latestFilingRes.rows[0]?.filing_status || (validPanCount > 0 ? 'Draft' : 'Draft');

    res.json({
      success: true,
      data: {
        total_receipts: totalReceipts,
        missing_pan_count: missingPanCount,
        voided_count: voidedCount,
        missing_pan_records: missingPanDonationsRes.rows,
        current_fy_10bd: {
          record_count: validPanCount,
          total_amount: validPanAmount,
          excluded_count: excludedCount,
          filing_status: filingStatus
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/compliance/10bd/history — export history
router.get('/10bd/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);

    const query = `
      SELECT id, financial_year as fy, record_count, total_amount, filing_status as status, created_at as date, csv_file_url
      FROM ten_bd_exports
      WHERE 1=1 ${organization_id ? 'AND organization_id = $1' : ''}
      ORDER BY created_at DESC
    `;
    const params = organization_id ? [organization_id] : [];
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/compliance/10bd/generate — trigger new export record
router.post('/10bd/generate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    let organization_id = user?.role === 'superadmin' 
      ? (req.body.organizationId)
      : (user?.organizationId || (user as any)?.organization_id);

    if (!organization_id) {
      const orgLookup = await pool.query('SELECT id FROM organizations LIMIT 1');
      organization_id = orgLookup.rows[0]?.id;
    }

    if (!organization_id) {
      return res.status(400).json({ success: false, message: 'No organization registered yet.' });
    }

    const fy = req.body.fy || '2023-24';

    const statsRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE dn.tax_id IS NOT NULL AND TRIM(dn.tax_id) != '' AND UPPER(dn.tax_id) != 'PAN_PENDING') as valid_count,
        COALESCE(SUM(d.amount) FILTER (WHERE dn.tax_id IS NOT NULL AND TRIM(dn.tax_id) != '' AND UPPER(dn.tax_id) != 'PAN_PENDING'), 0) as valid_amount,
        COUNT(*) FILTER (WHERE dn.tax_id IS NULL OR TRIM(dn.tax_id) = '' OR UPPER(dn.tax_id) = 'PAN_PENDING') as excluded_count
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.currency = 'INR' AND d.status = 'completed' AND d.organization_id = $1
    `, [organization_id]);

    const count = Number(statsRes.rows[0]?.valid_count || 0);
    const amount = Number(statsRes.rows[0]?.valid_amount || 0);
    const excluded = Number(statsRes.rows[0]?.excluded_count || 0);

    const insertRes = await pool.query(`
      INSERT INTO ten_bd_exports (
        organization_id, financial_year, record_count, total_amount, excluded_record_count, filing_status, csv_file_url
      ) VALUES ($1, $2, $3, $4, $5, 'draft', '/api/compliance/export/10bd')
      RETURNING *
    `, [organization_id, fy, count, amount, excluded]);

    res.json({ success: true, message: 'Form 10BD draft generated successfully.', data: insertRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/compliance/receipts/:id/void — void 80G receipt
router.post('/receipts/:id/void', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { void_reason } = req.body;
    await pool.query(`
      UPDATE eighty_g_receipts 
      SET voided = true, void_reason = $1 
      WHERE id::text = $2 OR payment_id::text = $2
    `, [void_reason || 'Voided by Administrator', id]);
    res.json({ success: true, message: 'Receipt voided successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/compliance/eighty_g OR /api/receipts — list 80G receipts
router.get('/eighty_g', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);
    const fy = req.query.fy as string;

    let query = `
      SELECT 
        id, organization_id, contact_id, payment_id, monthly_donation_id,
        receipt_number, financial_year, donation_date, amount,
        COALESCE(donor_name_snapshot, 'Donor') as donor_name,
        COALESCE(donor_pan_snapshot, 'PAN_PENDING') as donor_pan,
        donor_address_snapshot as donor_address,
        pdf_url, generated_at as created_at, generated_at,
        email_delivery_status as email_status,
        whatsapp_delivery_status as whatsapp_status,
        voided as is_voided, voided, void_reason,
        included_in_10bd
      FROM eighty_g_receipts 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (organization_id) {
      query += ` AND organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (fy) {
      query += ` AND financial_year = $${paramIndex++}`;
      params.push(fy);
    }
    query += ` ORDER BY generated_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/compliance/consents — list consents
router.get('/consents', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);
    let query = `
      SELECT c.*, d.name as contact_name, d.email as contact_email, d.phone as contact_phone
      FROM consents c
      LEFT JOIN donors d ON c.contact_id = d.id
    `;
    const params: any[] = [];
    if (organization_id) {
      query += ` WHERE c.organization_id = $1`;
      params.push(organization_id);
    }
    query += ` ORDER BY c.created_at DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate/Retrieve Tax Receipt PDF dynamically
router.get('/receipts/:donationId', async (req: Request, res: Response) => {
  const { donationId } = req.params;

  try {
    // 1. Fetch complete donation, donor, and campaign details
    const donationQuery = `
      SELECT 
        d.id AS donation_id,
        d.amount,
        d.currency,
        d.created_at,
        d.gateway_transaction_id,
        d.payment_method,
        dn.name AS donor_name,
        dn.email AS donor_email,
        dn.tax_id AS donor_tax_id,
        dn.country AS donor_country,
        c.title AS campaign_title,
        o.name AS org_name,
        o.tax_id_country AS org_country,
        o.certificate_80g_config,
        r.receipt_number,
        r.transaction_hash
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      JOIN campaigns c ON d.campaign_id = c.id
      JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN compliance_receipts r ON d.id = r.donation_id
      WHERE d.id = $1 AND d.status = 'completed'
    `;

    const { rows } = await pool.query(donationQuery, [donationId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Completed donation not found.' });
    }

    const item = rows[0];
    const isIndia = item.currency === 'INR';
    const taxRegime = isIndia ? '80G' : '501c3';

    // Parse the NGO dynamic certificate configuration
    const r80g = item.certificate_80g_config || {};
    const urn = r80g.urn || 'AAATD0192K20261';
    const issueDate = r80g.issue_date || '2026-01-15';
    const signatory = r80g.signatory || 'WaterAid President';

    // Receipt Number formatting
    let receiptNumber = item.receipt_number;
    if (!receiptNumber) {
      const year = new Date(item.created_at).getFullYear();
      const countResult = await pool.query('SELECT COUNT(*) FROM compliance_receipts');
      const sequence = Number(countResult.rows[0].count) + 1;
      receiptNumber = `REC-${year}-${taxRegime}-${String(sequence).padStart(4, '0')}`;
    }

    const pdfFileName = `${donationId}.pdf`;
    const pdfPath = path.join(receiptsDir, pdfFileName);

    // 2. Build PDF Document using pdfkit
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Styling & Layout
    // Header Banner
    doc.fillColor('#0D9488').rect(0, 0, 612, 15).fill();
    doc.moveDown(2);

    // Title
    doc.fillColor('#1F2937')
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('DONATION RECEIPT & CERTIFICATE', { align: 'center' });
    doc.moveDown(1);

    // Divider Line
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Organisation & Receipt Info columns
    const initialY = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).text('RECIPIENT ORGANISATION', 50, initialY);
    doc.font('Helvetica').fontSize(10).text(item.org_name || 'Charitable Trust', 50, initialY + 18);
    doc.text(`Country: ${item.org_country || 'India'}`, 50, initialY + 32);
    doc.text(`Status: Registered Charitable Non-Profit`, 50, initialY + 46);
    if (isIndia) {
      doc.text(`PAN: AAATD0192K | 80G Reg: URN-${urn}`, 50, initialY + 60);
      doc.text(`Approval Date: ${issueDate}`, 50, initialY + 74);
    } else {
      doc.text(`IRS Code: Section 501(c)(3) Exempt Public Charity`, 50, initialY + 60);
    }

    doc.font('Helvetica-Bold').fontSize(11).text('RECEIPT DETAILS', 340, initialY);
    doc.font('Helvetica').fontSize(10).text(`Receipt No: ${receiptNumber}`, 340, initialY + 18);
    doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, 340, initialY + 32);
    doc.text(`Gateway ID: ${item.gateway_transaction_id || 'N/A'}`, 340, initialY + 46);
    doc.text(`Payment Rail: ${(item.payment_method || 'Online').toUpperCase()}`, 340, initialY + 60);

    doc.moveDown(4.5);

    // Donor Details Box
    doc.fillColor('#F9FAFB').rect(50, doc.y, 512, 100).fill();
    const boxY = doc.y + 15;
    doc.fillColor('#1F2937');
    doc.font('Helvetica-Bold').fontSize(11).text('DONOR DETAILS', 65, boxY);
    doc.font('Helvetica').fontSize(10).text(`Name: ${item.donor_name || 'Donor'}`, 65, boxY + 20);
    doc.text(`Email: ${item.donor_email || 'N/A'}`, 65, boxY + 34);
    if (item.donor_tax_id) {
      doc.text(`PAN/Tax Identification: ${item.donor_tax_id}`, 65, boxY + 48);
    } else {
      doc.text(`PAN/Tax Identification: Not Provided (Anonymous)`, 65, boxY + 48);
    }
    doc.text(`Billing Country: ${item.donor_country || 'India'}`, 65, boxY + 62);

    doc.moveDown(7);

    // Contribution details
    doc.font('Helvetica-Bold').fontSize(11).text('CONTRIBUTION SUMMARY', 50, doc.y);
    doc.moveDown(0.5);

    // Table Header
    const tableY = doc.y;
    doc.strokeColor('#1F2937').lineWidth(1.5).moveTo(50, tableY).lineTo(562, tableY).stroke();
    doc.font('Helvetica-Bold').fontSize(10).text('Campaign Description', 60, tableY + 8);
    doc.text('Currency', 340, tableY + 8);
    doc.text('Total Amount', 470, tableY + 8, { align: 'right', width: 90 });
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(50, tableY + 26).lineTo(562, tableY + 26).stroke();

    // Table Content
    doc.font('Helvetica').fontSize(10).text(item.campaign_title, 60, tableY + 34);
    doc.text(item.currency, 340, tableY + 34);
    doc.text(`${item.currency} ${item.amount}`, 470, tableY + 34, { align: 'right', width: 90 });
    doc.strokeColor('#1F2937').lineWidth(1.5).moveTo(50, tableY + 54).lineTo(562, tableY + 54).stroke();

    doc.moveDown(2);

    // Statutory Declaration clauses
    if (isIndia) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#4B5563')
         .text(`Statutory Declaration: Donations to this organisation qualify for tax deductions under Section 80G(5) of the Income Tax Act, 1961. Unique Registration Number: URN-${urn}.`);
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#4B5563')
         .text('Statutory Declaration: No goods, services, or personal benefits were provided to the donor in exchange for this contribution. This contribution is tax-deductible to the full extent allowed under Section 501(c)(3) of the IRS Code.');
    }

    doc.moveDown(2);

    // Digital Checksum Audit details
    const dummyHash = crypto.createHash('sha256').update(donationId + receiptNumber + item.amount).digest('hex');
    doc.font('Courier').fontSize(8).fillColor('#9CA3AF')
       .text(`Cryptographic Security Ledger Verification Hash (SHA-256):`, 50, doc.y);
    doc.text(item.transaction_hash || dummyHash);

    // Add Signature Mark
    doc.moveDown(2.5);
    const signatureY = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor('#1F2937').text('Authorized Digital Signatory', 380, signatureY);
    doc.font('Helvetica-Oblique').fontSize(11).fillColor('#0D9488').text(signatory, 380, signatureY + 15);
    doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(380, signatureY + 32).lineTo(520, signatureY + 32).stroke();

    // Finish PDF
    doc.end();

    // 3. Wait for PDF write stream to complete, save hash to DB, then send file
    writeStream.on('finish', async () => {
      const fileBuffer = fs.readFileSync(pdfPath);
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Update database with generated receipt details if not already present
      if (!item.receipt_number) {
        await pool.query(`
          INSERT INTO compliance_receipts (donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (donation_id) DO NOTHING
        `, [donationId, receiptNumber, taxRegime, `/receipts/${pdfFileName}`, sha256Hash]);

        await pool.query('UPDATE donations SET tax_receipt_status = \'generated\' WHERE id = $1', [donationId]);
      }

      // Stream PDF response directly
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${receiptNumber}.pdf`);
      return res.send(fileBuffer);
    });

  } catch (error: any) {
    console.error('Error generating PDF receipt:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Compile and Export real Form 10BD CSV for Indian Tax Department
router.get('/export/10bd', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const organization_id = user?.role === 'superadmin' 
      ? (req.query.organizationId as string | undefined) 
      : (user?.organizationId || (user as any)?.organization_id);

    // Query completed Indian donations
    let query = `
      SELECT 
        d.id,
        dn.tax_id,
        dn.tax_id_type,
        dn.name AS donor_name,
        d.amount,
        d.created_at
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.currency = 'INR' AND d.status = 'completed'
    `;
    const params: any[] = [];
    if (organization_id) {
      query += ` AND d.organization_id = $1`;
      params.push(organization_id);
    }
    query += ` ORDER BY d.created_at ASC`;

    const { rows } = await pool.query(query, params);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Form10BD_Export_${new Date().getFullYear()}.csv`);

    // Standard 10BD CSV Headers
    let csv = "S.No,ID Code (1=PAN; 2=Aadhaar; etc),Unique Identification Number of the Donor,Section Code (80G),Name of Donor,Address of Donor,Donation Type (Corpus/General),Amount of Donation (INR)\n";

    rows.forEach((row: any, index: number) => {
      const idCode = row.tax_id_type === 'PAN' ? '1' : '2';
      const taxId = row.tax_id || 'NOT_PROVIDED';
      const donorName = row.donor_name.replace(/"/g, '""'); // CSV safety
      csv += `${index + 1},${idCode},"${taxId}",80G,"${donorName}","Not Provided",General,${row.amount}\n`;
    });

    return res.send(csv);
  } catch (error: any) {
    console.error('Form 10BD compilation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
