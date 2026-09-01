import pool from '../config/db';
import { dispatchWhatsAppMessage, dispatchEmailMessage } from './messagingRouter';
import { getResolvedTemplate, renderTemplateContent, WhitelistVariables } from './templateEngine';
import { sendWhatsAppNotification, sendAWSEmailNotification } from './notification';
import { recalculateContactRollups } from './contactRollupService';

// Event types supported by the system
export const EVENT_TYPES = [
  { id: 'donation.completed', label: 'Donation Completed', description: 'Payment status becomes paid' },
  { id: 'donation.failed', label: 'Donation Failed', description: 'Payment fails' },
  { id: 'subscription.created', label: 'Subscription Created', description: 'New monthly donation created' },
  { id: 'subscription.cancelled', label: 'Subscription Cancelled', description: 'Monthly donation cancelled' },
  { id: 'mandate.failed', label: 'Mandate Failed', description: 'Auto-debit mandate rejected' },
  { id: 'mandate.created', label: 'Mandate Created', description: 'New mandate registered' },
  { id: 'contact.created', label: 'Contact Created', description: 'New donor added' },
  { id: 'contact.updated', label: 'Contact Updated', description: 'Contact record modified' },
  { id: 'campaign.signup', label: 'Campaign Signup', description: 'Someone signs up via landing page' },
  { id: 'receipt.generated', label: 'Receipt Generated', description: '80G receipt issued' },
  { id: 'broadcast.sent', label: 'Broadcast Sent', description: 'Broadcast dispatch complete' }
];

// Execute a single journey step for an enrolment
export async function executeStep(enrolmentId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get enrolment with current step
    const enrolRes = await client.query(
      `SELECT e.*, js.step_type, js.wait_duration_minutes, js.template_id, 
              js.condition_expression, js.true_branch_step_id, js.false_branch_step_id,
              js.config, js.fallback_channel, j.organization_id as journey_org_id, j.journey_name
       FROM journey_enrolments e
       JOIN journey_steps js ON e.current_step_id = js.id
       JOIN journeys j ON e.journey_id = j.id
       WHERE e.id = $1 AND e.status = 'active'`,
      [enrolmentId]
    );
    
    if (enrolRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    
    const enrolment = enrolRes.rows[0];
    const stepType = enrolment.step_type;

    // Fetch contact and organization details for variable rendering
    const donorRes = await client.query('SELECT id, name, email, phone, tax_id FROM donors WHERE id = $1', [enrolment.contact_id]);
    const orgRes = await client.query('SELECT name, certificate_80g_config FROM organizations WHERE id = $1', [enrolment.journey_org_id]);
    const donor = donorRes.rows[0] || {};
    const org = orgRes.rows[0] || {};

    // Retrieve rich payload from triggering event if present
    let eventPayload: any = {};
    if (enrolment.entry_event_id) {
      const evRes = await client.query('SELECT payload FROM events WHERE id = $1', [enrolment.entry_event_id]);
      if (evRes.rows.length > 0) {
        eventPayload = evRes.rows[0].payload || {};
      }
    }
    
    const defaultVars: WhitelistVariables = {
      donor_name: donor.name || eventPayload.donorName || 'Valued Supporter',
      donor_email: donor.email || eventPayload.donorEmail || '',
      donor_phone: donor.phone || eventPayload.donorPhone || '',
      donor_tax_id: donor.tax_id || eventPayload.donorTaxId || 'NOT_PROVIDED',
      donation_amount: eventPayload.amount || 0,
      donation_currency: eventPayload.currency || 'INR',
      transaction_id: eventPayload.transactionId || eventPayload.gatewayTransactionId || 'TXN_DIRECT',
      payment_status: 'SUCCESS',
      receipt_url: eventPayload.receiptUrl || 'https://danapro.org',
      receipt_number: eventPayload.receiptNumber || '',
      ngo_name: org.name || 'DanaPro NGO',
      ngo_urn: org.certificate_80g_config?.urn || '',
      ngo_signatory: org.certificate_80g_config?.signatory || '',
      campaign_title: eventPayload.campaignTitle || enrolment.journey_name || 'Individual Giving Journey',
      donation_date: new Date().toISOString().split('T')[0]
    };
    
    switch (stepType) {
      case 'send_email': {
        let templateSubject = 'Important Update from ' + (org.name || 'DanaPro');
        let templateContent = '<p>Dear {{donor_name}},</p><p>Thank you for being a part of our mission with {{ngo_name}}.</p>';

        if (enrolment.template_id) {
          const tmplRes = await client.query('SELECT subject, content FROM templates WHERE id = $1', [enrolment.template_id]);
          if (tmplRes.rows.length > 0) {
            templateSubject = tmplRes.rows[0].subject || templateSubject;
            templateContent = tmplRes.rows[0].content || templateContent;
          }
        } else {
          const fallbackTmpl = await getResolvedTemplate(enrolment.journey_org_id, 'email_success');
          templateSubject = fallbackTmpl.subject || templateSubject;
          templateContent = fallbackTmpl.content || templateContent;
        }

        const subject = renderTemplateContent(templateSubject, defaultVars);
        const htmlBody = renderTemplateContent(templateContent, defaultVars);

        const emailResult = await dispatchEmailMessage({
          organizationId: enrolment.journey_org_id,
          recipientEmail: donor.email || defaultVars.donor_email || '',
          recipientName: donor.name || defaultVars.donor_name || 'Supporter',
          subject,
          htmlBody
        });

        const emailStatus = emailResult.success ? 'delivered' : 'failed';
        await client.query(
          `INSERT INTO email_communications (
             organization_id, contact_id, journey_id, step_id, template_id,
             subject_line, communication_type, trigger_type, status,
             sent_at, delivered_at, error
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'journey_email', 'journey', $7, NOW(), $8, $9)`,
          [
            enrolment.journey_org_id, 
            enrolment.contact_id, 
            enrolment.journey_id, 
            enrolment.current_step_id, 
            enrolment.template_id || null,
            subject,
            emailStatus,
            emailResult.success ? new Date() : null,
            emailResult.error || null
          ]
        );
        await advanceToNextStep(client, enrolment);
        break;
      }
      case 'send_whatsapp': {
        let templateContent = 'Hello {{donor_name}}, thank you for your generous contribution of {{donation_currency}} {{donation_amount}} to {{ngo_name}} for {{campaign_title}}! 🙏';
        const targetTemplateName = enrolment.config?.template_name || 'journey_step_whatsapp';

        if (enrolment.template_id) {
          const tmplRes = await client.query('SELECT content FROM templates WHERE id = $1', [enrolment.template_id]);
          if (tmplRes.rows.length > 0 && tmplRes.rows[0].content) {
            templateContent = tmplRes.rows[0].content;
          }
        } else {
          const fallbackTmpl = await getResolvedTemplate(enrolment.journey_org_id, 'whatsapp_message');
          templateContent = fallbackTmpl.content || templateContent;
        }

        const messageText = renderTemplateContent(templateContent, defaultVars);

        const waResult = await dispatchWhatsAppMessage({
          organizationId: enrolment.journey_org_id,
          recipientPhone: donor.phone || defaultVars.donor_phone || '',
          messageText,
          templateName: targetTemplateName
        });

        const waStatus = waResult.success ? 'delivered' : 'failed';
        await client.query(
          `INSERT INTO whatsapp_communications (
             organization_id, contact_id, recipient_number, journey_id, step_id,
             communication_type, trigger_type, status, template_name,
             meta_message_id, sent_at, delivered_at, failure_reason
           )
           VALUES ($1, $2, $3, $4, $5, 'journey_whatsapp', 'journey', $6, $7, $8, NOW(), $9, $10)`,
          [
            enrolment.journey_org_id, 
            enrolment.contact_id, 
            donor.phone || defaultVars.donor_phone || '',
            enrolment.journey_id, 
            enrolment.current_step_id, 
            waStatus,
            targetTemplateName,
            waResult.messageId || null,
            waResult.success ? new Date() : null,
            waResult.error || null
          ]
        );
        await advanceToNextStep(client, enrolment);
        break;
      }
      case 'wait': {
        const waitMinutes = enrolment.wait_duration_minutes || 60;
        const nextRes = await client.query(
          `SELECT id FROM journey_steps WHERE journey_id = $1 AND step_order > (
            SELECT step_order FROM journey_steps WHERE id = $2
          ) ORDER BY step_order ASC LIMIT 1`,
          [enrolment.journey_id, enrolment.current_step_id]
        );
        if (nextRes.rows.length > 0) {
          await client.query(
            `UPDATE journey_enrolments 
             SET current_step_id = $1, 
                 next_action_due_at = NOW() + INTERVAL '${waitMinutes} minutes',
                 updated_at = NOW()
             WHERE id = $2`,
            [nextRes.rows[0].id, enrolmentId]
          );
        } else {
          await completeEnrolment(client, enrolmentId, 'Journey wait step finished with no next step');
        }
        break;
      }
      case 'condition': {
        const cond = enrolment.condition_expression || {};
        const matched = await evaluateCondition(client, enrolment.contact_id, cond);
        const nextStepId = matched ? enrolment.true_branch_step_id : enrolment.false_branch_step_id;
        
        if (nextStepId) {
          await client.query(
            `UPDATE journey_enrolments SET current_step_id = $1, next_action_due_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [nextStepId, enrolmentId]
          );
        } else {
          await completeEnrolment(client, enrolmentId, 'Branch ended - no next step');
        }
        break;
      }
      case 'update_field': {
        const config = enrolment.config || {};
        if (config.field_name && config.field_value !== undefined) {
          await client.query(
            `UPDATE donors SET ${config.field_name} = $1, updated_at = NOW() WHERE id = $2`,
            [config.field_value, enrolment.contact_id]
          );
        }
        await advanceToNextStep(client, enrolment);
        break;
      }
      case 'goal_check': {
        const goalRes = await client.query(
          `SELECT id FROM events WHERE contact_id = $1 AND event_type = $2 AND created_at > $3`,
          [enrolment.contact_id, enrolment.config?.goal_event || 'donation.completed', enrolment.entered_at]
        );
        if (goalRes.rows.length > 0) {
          await client.query(
            `UPDATE journey_enrolments SET goal_achieved = true, goal_achieved_at = NOW(), status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [enrolmentId]
          );
        } else {
          await advanceToNextStep(client, enrolment);
        }
        break;
      }
      default:
        await advanceToNextStep(client, enrolment);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[JourneyExecutor] Error executing step:', error);
  } finally {
    client.release();
  }
}

async function advanceToNextStep(client: any, enrolment: any): Promise<void> {
  // Find next step by step_order
  const nextRes = await client.query(
    `SELECT id FROM journey_steps WHERE journey_id = $1 AND step_order > (
      SELECT step_order FROM journey_steps WHERE id = $2
    ) ORDER BY step_order ASC LIMIT 1`,
    [enrolment.journey_id, enrolment.current_step_id]
  );
  
  if (nextRes.rows.length > 0) {
    await client.query(
      `UPDATE journey_enrolments SET current_step_id = $1, next_action_due_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [nextRes.rows[0].id, enrolment.id]
    );
  } else {
    await completeEnrolment(client, enrolment.id, 'All steps completed');
  }
}

async function completeEnrolment(client: any, enrolmentId: string, reason: string): Promise<void> {
  await client.query(
    `UPDATE journey_enrolments SET status = 'completed', completed_at = NOW(), exit_reason = $1, updated_at = NOW() WHERE id = $2`,
    [reason, enrolmentId]
  );
}

async function evaluateCondition(client: any, contactId: string, condition: any): Promise<boolean> {
  if (!condition || !condition.field) return true;
  try {
    const res = await client.query(`SELECT * FROM donors WHERE id = $1`, [contactId]);
    if (res.rows.length === 0) return false;
    const contact = res.rows[0];
    const fieldValue = contact[condition.field];
    
    switch (condition.operator) {
      case 'equals': return fieldValue === condition.value;
      case 'not_equals': return fieldValue !== condition.value;
      case 'greater_than': return Number(fieldValue) > Number(condition.value);
      case 'less_than': return Number(fieldValue) < Number(condition.value);
      case 'contains': return String(fieldValue).includes(String(condition.value));
      default: return true;
    }
  } catch {
    return true;
  }
}

// Auto-enrol contacts into journeys when matching events fire
export async function autoEnrolFromEvent(eventType: string, organizationId: string, contactId: string, eventId: string): Promise<number> {
  let enrolledCount = 0;
  try {
    // Find all active/published journeys (or created drafts) triggered by this event type
    const journeyRes = await pool.query(
      `SELECT * FROM journeys 
       WHERE (organization_id = $1 OR organization_id IS NULL) 
         AND (
           entry_event_type = $2 
           OR entry_event_type = 'donation_completed' 
           OR entry_event_type = 'all' 
           OR entry_type = 'event' 
           OR entry_event_type IS NULL
         )
         AND status IN ('active', 'published', 'draft')`,
      [organizationId, eventType]
    );
    
    for (const journey of journeyRes.rows) {
      // Check re-entry: If entry_event_id is provided, prevent duplicate enrolment for the exact same event
      if (eventId) {
        const existingForEvent = await pool.query(
          `SELECT id FROM journey_enrolments WHERE journey_id = $1 AND contact_id = $2 AND entry_event_id = $3`,
          [journey.id, contactId, eventId]
        );
        if (existingForEvent.rows.length > 0) continue;
      } else if (!journey.re_entry_allowed) {
        const existing = await pool.query(
          `SELECT id FROM journey_enrolments WHERE journey_id = $1 AND contact_id = $2`,
          [journey.id, contactId]
        );
        if (existing.rows.length > 0) continue;
      }
      
      // Get first step
      const firstStep = await pool.query(
        `SELECT id FROM journey_steps WHERE journey_id = $1 ORDER BY step_order ASC LIMIT 1`,
        [journey.id]
      );
      
      if (firstStep.rows.length === 0) continue;
      
      const insertRes = await pool.query(
        `INSERT INTO journey_enrolments (journey_id, organization_id, contact_id, entry_event_id, current_step_id, next_action_due_at, status)
         VALUES ($1, $2, $3, $4, $5, NOW(), 'active') RETURNING id`,
        [journey.id, organizationId, contactId, eventId, firstStep.rows[0].id]
      );
      
      const enrolmentId = insertRes.rows[0]?.id;
      if (enrolmentId) {
        enrolledCount++;
        console.log(`[JourneyExecutor] Auto-enrolled contact ${contactId} into journey "${journey.journey_name}" (enrolment: ${enrolmentId})`);
        // Immediately execute the first step
        await executeStep(enrolmentId).catch(err => console.error('[JourneyExecutor Step Error]:', err));
      }
    }
  } catch (error) {
    console.error('[JourneyExecutor] Auto-enrol error:', error);
  }
  return enrolledCount;
}

// Background processor - runs on interval
export async function processJourneyQueue(): Promise<void> {
  try {
    const dueRes = await pool.query(
      `SELECT id FROM journey_enrolments 
       WHERE status = 'active' AND next_action_due_at <= NOW()
       ORDER BY next_action_due_at ASC LIMIT 50`
    );
    
    for (const row of dueRes.rows) {
      await executeStep(row.id);
    }
    
    if (dueRes.rows.length > 0) {
      console.log(`[JourneyExecutor] Processed ${dueRes.rows.length} journey step(s)`);
    }
  } catch (error) {
    console.error('[JourneyExecutor] Queue processing error:', error);
  }
}

// Universal Trigger Function for Successful Donations (Emits Events, Fires Journeys, Dispatches Multi-Channel Notifications)
export async function triggerDonationSuccessEventsAndNotifications(params: {
  donationId: string;
  organizationId: string;
  donorId?: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string | null;
  donorTaxId?: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  transactionId: string;
  receiptNumber?: string;
  receiptPdfUrl?: string;
  orgName: string;
  gateway: string;
}) {
  try {
    const {
      donationId, organizationId, donorName, donorEmail, donorPhone,
      donorTaxId, campaignTitle, amount, currency, transactionId,
      receiptNumber, receiptPdfUrl, orgName, gateway
    } = params;

    // 1. Ensure contact exists in donors table with phone & tax_id updated
    let contactId = params.donorId;
    if (!contactId && donorEmail) {
      const donorRes = await pool.query(
        `SELECT id FROM donors WHERE email = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
        [donorEmail, organizationId]
      );
      if (donorRes.rows.length > 0) {
        contactId = donorRes.rows[0].id;
        if (donorPhone || donorTaxId) {
          await pool.query(
            'UPDATE donors SET phone = COALESCE($1, phone), tax_id = COALESCE($2, tax_id), updated_at = NOW() WHERE id = $3',
            [donorPhone || null, donorTaxId || null, contactId]
          );
        }
      } else {
        const ins = await pool.query(
          `INSERT INTO donors (organization_id, name, email, phone, tax_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [organizationId, donorName, donorEmail, donorPhone || null, donorTaxId || null]
        );
        contactId = ins.rows[0].id;
      }
    } else if (contactId && (donorPhone || donorTaxId)) {
      await pool.query(
        'UPDATE donors SET phone = COALESCE($1, phone), tax_id = COALESCE($2, tax_id), updated_at = NOW() WHERE id = $3',
        [donorPhone || null, donorTaxId || null, contactId]
      );
    }

    // 2. Insert event record into events table
    const eventPayload = {
      donationId,
      amount,
      currency,
      donorName,
      donorEmail,
      donorPhone,
      donorTaxId,
      campaignTitle,
      transactionId,
      receiptNumber,
      receiptUrl: receiptPdfUrl,
      gateway,
      organizationId,
      orgName
    };

    let eventId = '';
    if (contactId) {
      const evRes = await pool.query(
        `INSERT INTO events (organization_id, event_type, contact_id, payload, source, occurred_at)
         VALUES ($1, 'donation.completed', $2, $3, 'payment_gateway', NOW()) RETURNING id`,
        [organizationId, contactId, JSON.stringify(eventPayload)]
      );
      eventId = evRes.rows[0]?.id;

      // 3. Auto-enrol in active Journey Builder flows
      await autoEnrolFromEvent('donation.completed', organizationId, contactId, eventId);
    }

    // 4. Channel-level Coverage Check:
    // Check if journey handled WhatsApp and Email specifically
    let hasJourneyWhatsApp = false;
    let hasJourneyEmail = false;

    if (eventId && contactId) {
      const journeyStepsRes = await pool.query(
        `SELECT js.step_type FROM journey_enrolments je
         JOIN journey_steps js ON je.journey_id = js.journey_id
         WHERE je.entry_event_id = $1`,
        [eventId]
      );
      const stepTypes = journeyStepsRes.rows.map((r: any) => r.step_type);
      hasJourneyWhatsApp = stepTypes.includes('send_whatsapp');
      hasJourneyEmail = stepTypes.includes('send_email');
    }

    // If journey didn't handle WhatsApp, dispatch direct WhatsApp notification
    if (!hasJourneyWhatsApp && donorPhone) {
      sendWhatsAppNotification(
        organizationId,
        donorName,
        donorPhone,
        campaignTitle,
        amount,
        currency,
        true,
        transactionId,
        receiptPdfUrl,
        donorTaxId,
        'success'
      ).catch(e => console.error('[WhatsApp Notification Error]:', e));
    }

    // If journey didn't handle Email, dispatch direct 80G Email notification
    if (!hasJourneyEmail && donorEmail && !donorEmail.includes('@external.org')) {
      sendAWSEmailNotification(
        donorEmail,
        donorName,
        campaignTitle,
        amount,
        currency,
        true,
        transactionId,
        orgName,
        organizationId,
        donorTaxId,
        receiptPdfUrl,
        'success'
      ).catch(e => console.error('[Email Notification Error]:', e));
    }

    // 5. Update eighty_g_receipts & donations with dispatch flags
    if (contactId) {
      await recalculateContactRollups(contactId, organizationId);
    }
    if (params.donationId) {
      await pool.query(
        `UPDATE donations 
         SET eighty_g_sent_email = true, 
             eighty_g_sent_whatsapp = true,
             updated_at = NOW() 
         WHERE id = $1`,
        [donationId]
      );
      await pool.query(
        `UPDATE eighty_g_receipts 
         SET email_delivery_status = 'delivered', 
             email_delivery_date = NOW(),
             whatsapp_delivery_status = 'delivered',
             whatsapp_delivery_date = NOW()
         WHERE payment_id = $1 OR donation_id = $1`,
        [donationId]
      );
    }
  } catch (err: any) {
    console.error('[triggerDonationSuccessEventsAndNotifications Error]:', err);
  }
}
