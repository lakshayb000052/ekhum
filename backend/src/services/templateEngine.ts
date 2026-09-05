import pool from '../config/db';

export interface WhitelistVariables {
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_tax_id?: string;
  donor_country?: string;
  donation_amount?: string | number;
  donation_currency?: string;
  donation_date?: string;
  transaction_id?: string;
  payment_method?: string;
  payment_status?: string;
  payment_link?: string;
  checkout_url?: string;
  decline_reason?: string;
  failure_reason?: string;
  retry_url?: string;
  campaign_title?: string;
  ngo_name?: string;
  ngo_urn?: string;
  ngo_signatory?: string;
  ngo_country?: string;
  receipt_url?: string;
  receipt_number?: string;
}

export const WHITELIST_VAR_DESCRIPTIONS: Record<string, string> = {
  donor_name: "Donor's Full Name (e.g. John Doe)",
  donor_email: "Donor's Email Address (e.g. donor@example.com)",
  donor_phone: "Donor's Phone / WhatsApp Number (e.g. +91 9876543210)",
  donor_tax_id: "Donor's PAN / Tax ID (e.g. ABCDE1234F)",
  donor_country: "Donor's Billing Country (e.g. IN)",
  donation_amount: "Donation Amount (e.g. 5,000)",
  donation_currency: "Currency Code (e.g. INR, USD)",
  donation_date: "Date of Contribution (e.g. 2026-08-12)",
  transaction_id: "Payment Gateway Transaction ID (e.g. pay_Nabc123)",
  payment_method: "Payment Method Rail (e.g. UPI, CARD)",
  payment_status: "Payment State (e.g. SUCCESSFUL, INITIATED, DECLINED)",
  payment_link: "Direct Checkout Payment Link URL",
  decline_reason: "Reason for Payment Decline/Failure",
  retry_url: "Retry Payment Link URL",
  campaign_title: "Campaign Title (e.g. Clean Water Initiative)",
  ngo_name: "NGO Organization Name (e.g. WaterAid India)",
  ngo_urn: "80G URN Approval Registration Number (e.g. AAATD0192K20261)",
  ngo_signatory: "Authorized Digital Signatory Officer (e.g. Country Director)",
  ngo_country: "NGO Registration Country (e.g. IN)",
  receipt_url: "Instant PDF Receipt Download URL Link"
};

export type TemplateType = 
  | '80g_receipt' 
  | 'email_thankyou' | 'email_success' | 'email_initiated' | 'email_declined'
  | 'whatsapp_message' | 'whatsapp_success' | 'whatsapp_initiated' | 'whatsapp_declined';

/**
 * Replace all {{variable_name}} tokens in content string with actual database values.
 */
export function renderTemplateContent(templateContent: string, vars: WhitelistVariables): string {
  if (!templateContent) return '';

  return templateContent.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, tokenName) => {
    const key = tokenName.trim() as keyof WhitelistVariables;
    if (vars[key] !== undefined && vars[key] !== null) {
      return String(vars[key]);
    }
    return match; // Return original {{token}} if missing in map
  });
}

/**
 * Resolve active template for an NGO by type across Payment States & Channels
 * Checks NGO specific template -> Master System Default -> Built-in Fallback
 */
export async function getResolvedTemplate(
  organizationId: string | null | undefined,
  type: TemplateType
): Promise<{ content: string; subject?: string; name: string; source: 'ngo' | 'master_default' | 'fallback' }> {
  // Normalize type aliases
  let targetTypes: string[] = [type];
  if (type === 'email_success' || type === 'email_thankyou') {
    targetTypes = ['email_success', 'email_thankyou'];
  } else if (type === 'whatsapp_success' || type === 'whatsapp_message') {
    targetTypes = ['whatsapp_success', 'whatsapp_message'];
  }

  try {
    // 1. Check custom NGO template
    if (organizationId) {
      const ngoRes = await pool.query(
        'SELECT name, subject, content FROM templates WHERE organization_id = $1 AND type = ANY($2) ORDER BY updated_at DESC LIMIT 1',
        [organizationId, targetTypes]
      );
      if (ngoRes.rows.length > 0) {
        return {
          name: ngoRes.rows[0].name,
          subject: ngoRes.rows[0].subject,
          content: ngoRes.rows[0].content,
          source: 'ngo'
        };
      }
    }

    // 2. Check Master System Default
    const defaultRes = await pool.query(
      'SELECT name, subject, content FROM templates WHERE (organization_id IS NULL OR is_default = TRUE) AND type = ANY($1) ORDER BY is_default DESC, updated_at DESC LIMIT 1',
      [targetTypes]
    );
    if (defaultRes.rows.length > 0) {
      return {
        name: defaultRes.rows[0].name,
        subject: defaultRes.rows[0].subject,
        content: defaultRes.rows[0].content,
        source: 'master_default'
      };
    }
  } catch (error) {
    console.error(`[TemplateEngine] Error loading template for ${type}:`, error);
  }

  // 3. Built-in Aligned Fallbacks per Channel & Payment State
  if (type === 'whatsapp_initiated') {
    return {
      name: 'Default WhatsApp Payment Initiated Alert',
      content: '⌛ *Payment Checkout Started*\n\nDear {{donor_name}},\n\nYou started a donation of *{{donation_currency}} {{donation_amount}}* for "{{campaign_title}}" by {{ngo_name}}.\n\nTo complete your payment securely, click below:\n👉 {{payment_link}}\n\nThank you for supporting {{ngo_name}}!',
      source: 'fallback'
    };
  } else if (type === 'whatsapp_declined') {
    return {
      name: 'Default WhatsApp Payment Declined Alert',
      content: '⚠️ *Payment Declined / Failed*\n\nDear {{donor_name}},\n\nYour recent donation of *{{donation_currency}} {{donation_amount}}* for "{{campaign_title}}" could not be completed.\n\n*Reason:* {{decline_reason}}\n\nYou can easily retry your payment here:\n👉 {{retry_url}}\n\nNeed help? Contact support@{{ngo_name}}.',
      source: 'fallback'
    };
  } else if (type === 'whatsapp_message' || type === 'whatsapp_success') {
    return {
      name: 'Default WhatsApp Payment Success Alert',
      content: '✅ *Donation Successfully Confirmed!*\n\nDear {{donor_name}},\n\nThank you for your generous contribution of *{{donation_currency}} {{donation_amount}}* to support "{{campaign_title}}" by {{ngo_name}}.\n\n*Transaction ID:* {{transaction_id}}\n*PAN / Tax ID:* {{donor_tax_id}}\n\n📥 *Download 80G Tax Receipt:* {{receipt_url}}\n\nWith gratitude,\n*{{ngo_name}}*',
      source: 'fallback'
    };
  } else if (type === 'email_initiated') {
    return {
      name: 'Default Email Payment Initiated Notification',
      subject: 'Complete your donation to {{campaign_title}} - {{ngo_name}}',
      content: `<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 12px; color: #0F172A; background: #FFFFFF;">
  <div style="text-align: center; margin-bottom: 20px;">
    <span style="background: #FEF3C7; color: #D97706; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">⏳ Payment Initiated</span>
  </div>
  <h2 style="color: #D97706; margin-top: 0; text-align: center;">Finish Your Contribution to {{campaign_title}}</h2>
  <p>Dear <strong>{{donor_name}}</strong>,</p>
  <p>You recently initiated a donation of <strong>{{donation_currency}} {{donation_amount}}</strong> to support <strong>"{{campaign_title}}"</strong> organized by <strong>{{ngo_name}}</strong>.</p>
  <div style="background: #FFFBEB; padding: 16px; border: 1px solid #FCD34D; border-radius: 8px; margin: 20px 0; font-size: 0.9rem;">
    <div><strong>Organization:</strong> {{ngo_name}}</div>
    <div><strong>Campaign:</strong> {{campaign_title}}</div>
    <div><strong>Amount:</strong> <strong style="color: #D97706;">{{donation_currency}} {{donation_amount}}</strong></div>
  </div>
  <p style="text-align: center; margin: 24px 0;">
    <a href="{{payment_link}}" style="background: #D97706; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2);">💳 Complete Payment Now</a>
  </p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
  <p style="font-size: 0.78rem; color: #64748B; text-align: center;">This notification was generated automatically by WeGive on behalf of {{ngo_name}}.</p>
</div>`,
      source: 'fallback'
    };
  } else if (type === 'email_declined') {
    return {
      name: 'Default Email Payment Declined Notification',
      subject: 'Payment Failed: Action required for your donation to {{ngo_name}}',
      content: `<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #FECDD3; border-radius: 12px; color: #0F172A; background: #FFFFFF;">
  <div style="text-align: center; margin-bottom: 20px;">
    <span style="background: #FFE4E6; color: #E11D48; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">⚠️ Payment Declined</span>
  </div>
  <h2 style="color: #E11D48; margin-top: 0; text-align: center;">Your Payment Could Not Be Processed</h2>
  <p>Dear <strong>{{donor_name}}</strong>,</p>
  <p>We attempted to process your donation of <strong>{{donation_currency}} {{donation_amount}}</strong> for <strong>"{{campaign_title}}"</strong>, but the transaction was declined by your bank or payment gateway.</p>
  <div style="background: #FFF1F2; padding: 16px; border: 1px solid #FECDD3; border-radius: 8px; margin: 20px 0; font-size: 0.9rem;">
    <div><strong>Decline Reason:</strong> <span style="color: #E11D48; font-weight: bold;">{{decline_reason}}</span></div>
    <div><strong>Campaign:</strong> {{campaign_title}}</div>
    <div><strong>Attempted Amount:</strong> {{donation_currency}} {{donation_amount}}</div>
  </div>
  <p>Don't worry! You can retry your donation using a different payment method (UPI, Card, Netbanking):</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="{{retry_url}}" style="background: #E11D48; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.2);">🔄 Retry Payment Now</a>
  </p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
  <p style="font-size: 0.78rem; color: #64748B; text-align: center;">If you continue experiencing issues, please contact {{ngo_name}} support.</p>
</div>`,
      source: 'fallback'
    };
  } else if (type === 'email_thankyou' || type === 'email_success') {
    return {
      name: 'Default Email Thank-You Notification',
      subject: 'Thank you for supporting {{ngo_name}}!',
      content: `<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 12px; color: #0F172A; background: #FFFFFF;">
  <div style="text-align: center; margin-bottom: 20px;">
    <span style="background: #D1FAE5; color: #059669; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">✅ Payment Successful</span>
  </div>
  <h2 style="color: #059669; margin-top: 0; text-align: center;">Thank You for Your Generous Contribution!</h2>
  <p>Dear <strong>{{donor_name}}</strong>,</p>
  <p>We gratefully acknowledge your contribution of <strong>{{donation_currency}} {{donation_amount}}</strong> in support of <strong>"{{campaign_title}}"</strong> organized by <strong>{{ngo_name}}</strong>.</p>
  <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 0.9rem;">
    <div><strong>Transaction Reference:</strong> <code>{{transaction_id}}</code></div>
    <div><strong>Date of Payment:</strong> {{donation_date}}</div>
    <div><strong>Tax Identification (PAN):</strong> {{donor_tax_id}}</div>
  </div>
  <p>Your official 80G tax exemption receipt is attached to this email and available for instant download:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="{{receipt_url}}" style="background: #059669; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">📥 Download 80G PDF Receipt</a>
  </p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
  <p style="font-size: 0.78rem; color: #64748B; text-align: center;">This notification was dispatched automatically by WeGive on behalf of {{ngo_name}} (80G URN: {{ngo_urn}}).</p>
</div>`,
      source: 'fallback'
    };
  } else {
    return {
      name: 'Default 80G Certificate Layout',
      subject: '80G Tax Exemption Certificate',
      content: '<div style="font-family: sans-serif; padding: 20px;"><h1>80G RECEIPT</h1><p>NGO: {{ngo_name}} (URN: {{ngo_urn}})</p><p>Donor: {{donor_name}} (PAN: {{donor_tax_id}})</p><p>Amount: {{donation_currency}} {{donation_amount}}</p></div>',
      source: 'fallback'
    };
  }
}
