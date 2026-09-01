export interface NGO {
  id: string;
  name: string;
  slug?: string;
  subdomain?: string;
  custom_domain?: string;
  logo_url?: string;
  primary_color?: string;
  primary_currency?: string;
  tax_id_country?: string;
  status: string;
  plan?: string;
  verified_sender_email?: string;
  whatsapp_meta_config?: any;
  certificate_80g_config?: any;
  payment_gateways_config?: any;
  permissions?: any;
  created_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  title: string;
  slug?: string;
  description?: string;
  goal_amount?: number;
  raised_amount?: number;
  is_active?: boolean;
  status?: string;
  landing_page_url?: string;
  payment_config?: any;
  permissions?: any;
  created_at: string;
}

export interface Contact {
  id: string;
  contact_id?: string;
  organization_id: string;
  organization_name?: string;
  title?: string;
  first_name: string;
  last_name: string;
  name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  pan_number?: string;
  tax_id?: string;
  birthdate?: string;
  date_of_birth?: string;
  street_address_1?: string;
  address_line_1?: string;
  address?: string;
  street_address_2?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  zip_code?: string;
  pincode?: string;
  status?: string;
  contact_status?: string;
  preferred_channel?: string;
  preferred_language?: string;
  total_monthly_donations?: number;
  total_onetime_donations?: number;
  total_paid_amount?: number;
  total_donated?: number;
  first_gift_date?: string;
  last_gift_date?: string;
  total_gift_count_paid?: number;
  gift_count?: number;
  total_gift_value_paid?: number;
  last_gift_amount_paid?: number;
  first_gift_campaign_id?: string;
  first_gift_campaign_title?: string;
  last_gift_campaign_id?: string;
  last_gift_campaign_title?: string;
  acquisition_campaign_id?: string;
  acquisition_campaign_title?: string;
  multi_ngo_names?: string;
  multi_campaign_titles?: string;
  active_subscriptions?: number;
  summary?: {
    total_donated?: number;
    gift_count?: number;
    active_subscriptions?: number;
    first_gift_date?: string;
    last_gift_date?: string;
    first_gift_campaign?: string;
    last_gift_campaign?: string;
    total_monthly_donations?: number;
    total_onetime_donations?: number;
    email_count?: number;
    whatsapp_count?: number;
    eighty_g_count?: number;
  };
  monthly_donations?: MonthlyDonation[];
  payments?: Payment[];
  eighty_g_receipts?: EightyGReceipt[];
  ten_bd_history?: TenBDExport[];
  email_communications?: EmailCommunication[];
  whatsapp_communications?: WhatsAppCommunication[];
  consents?: Consent[];
  journeys?: JourneyEnrolment[];
  created_at: string;
  updated_at?: string;
}

export interface MonthlyDonation {
  id: string;
  monthly_donation_id?: string;
  organization_id?: string;
  organization_name?: string;
  donor_id?: string;
  contact_id?: string;
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_tax_id?: string;
  campaign_id?: string;
  campaign_title?: string;
  signup_campaign?: string;
  signup_campaign_title?: string;
  signup_campaign_id?: string;
  amount: number;
  currency?: string;
  interval?: string;
  status: 'active' | 'paused' | 'cancelled' | 'rejected' | 'burnt' | string;
  signup_date?: string;
  first_payment_date?: string;
  last_donation_date_paid?: string;
  last_billing_date?: string;
  pan_card?: boolean;
  total_paid_installments?: number;
  total_installments_attempted?: number;
  payment_gateway?: 'RAZORPAY' | 'PAYU' | 'CC AVENUE' | 'WORLDLINE' | 'CASHFREE' | string;
  payment_method?: 'ENACH' | 'UPI AUTOPAY' | 'CARD' | string;
  bank_name?: string;
  mandate_bank_name?: string;
  next_payment_due_date?: string;
  next_date?: string;
  end_reason?: string;
  end_date?: string;
  helpdesk_ticket_id?: string;
  helpdesk_status?: 'Cancelled' | 'Paused' | 'Downgrade' | 'Saved' | string;
  downgraded?: boolean;
  paused?: boolean;
  paused_period?: number;
  pause_start_date?: string;
  pause_end_date?: string;
  value_upgrade?: boolean;
  value_upgrade_date?: string;
  upgraded_value?: number;
  mandate_id?: string;
  mandate_method?: string;
  umrn?: string;
  payment_history?: Payment[];
  created_at: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  payment_id?: string;
  organization_id?: string;
  organization_name?: string;
  campaign_id?: string;
  campaign_title?: string;
  payment_campaign?: string;
  payment_campaign_title?: string;
  donor_id?: string;
  contact_id?: string;
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_tax_id?: string;
  subscription_id?: string;
  monthly_donation_id?: string;
  payment_date?: string;
  created_at?: string;
  amount: number;
  currency?: string;
  net_amount?: number;
  fee_covered?: number;
  pan_card?: boolean;
  payment_type: 'monthly_donation' | 'one_time' | 'Monthly Donation' | 'One-time Donation' | string;
  payment_gateway: 'RAZORPAY' | 'PAYU' | 'CC AVENUE' | 'WORLDLINE' | 'CASHFREE' | string;
  payment_method: string;
  status: 'completed' | 'paid' | 'failed' | 'pending' | 'initiated' | 'Paid' | 'Failed' | string;
  failure_reason?: string;
  eighty_g_sent_email?: boolean;
  eighty_g_sent_whatsapp?: boolean;
  receipt_number?: string;
  receipt_pdf_url?: string;
  gateway_transaction_id?: string;
  gateway_order_id?: string;
  gateway_payment_id?: string;
  raw_gateway_response?: any;
  custom_form_data?: any;
  tax_receipt_status?: string;
}

export type Donation = Payment;

export interface EightyGReceipt {
  id: string;
  receipt_id?: string;
  organization_id?: string;
  organization_name?: string;
  contact_id?: string;
  donor_id?: string;
  payment_id?: string;
  donation_id?: string;
  monthly_donation_id?: string;
  receipt_number: string;
  financial_year: string;
  fy?: string;
  donation_date: string;
  amount: number;
  donor_name_snapshot?: string;
  donor_name?: string;
  donor_pan_snapshot?: string;
  donor_pan?: string;
  donor_address_snapshot?: string;
  donor_address?: string;
  pdf_url?: string;
  email_delivery_status?: string;
  email_status?: string;
  email_delivery_date?: string;
  whatsapp_delivery_status?: string;
  whatsapp_status?: string;
  whatsapp_delivery_date?: string;
  download_count?: number;
  voided?: boolean;
  is_voided?: boolean;
  void_reason?: string;
  included_in_10bd?: boolean;
  ten_bd_export_id?: string;
  generated_at?: string;
  created_at?: string;
}

export interface TenBDExport {
  id: string;
  ten_bd_id?: string;
  organization_id?: string;
  financial_year: string;
  fy?: string;
  record_count?: number;
  total_amount?: number;
  excluded_record_count?: number;
  filing_status?: string;
  status?: string;
  csv_file_url?: string;
  file_url?: string;
  date?: string;
  created_at?: string;
}

export interface EmailCommunication {
  id: string;
  organization_id?: string;
  contact_id: string;
  campaign_id?: string;
  campaign_title?: string;
  payment_id?: string;
  monthly_donation_id?: string;
  communication_type?: string;
  trigger_type?: string;
  subject_line?: string;
  subject?: string;
  from_address?: string;
  recipient_name?: string;
  recipient_email?: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | string;
  ses_message_id?: string;
  date?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  first_clicked_at?: string;
  error?: string;
  created_at?: string;
}

export interface WhatsAppCommunication {
  id: string;
  organization_id?: string;
  contact_id: string;
  campaign_id?: string;
  campaign_title?: string;
  payment_id?: string;
  monthly_donation_id?: string;
  recipient_number?: string;
  recipient_name?: string;
  recipient_phone?: string;
  template_name?: string;
  message_template?: string;
  communication_type?: string;
  trigger_type?: string;
  meta_message_id?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  date?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failure_code?: string;
  failure_reason?: string;
  created_at?: string;
}

export type Communication = EmailCommunication | WhatsAppCommunication;

export interface Consent {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  source?: string;
  captured_at?: string;
  updated_at: string;
}

export interface JourneyEnrolment {
  id: string;
  journey_id: string;
  journey_name?: string;
  journey_description?: string;
  contact_id: string;
  status: string;
  current_step_id?: string;
  goal_achieved?: boolean;
  entered_at: string;
}

export interface Mandate {
  id: string;
  contact_id: string;
  status: string;
  provider: string;
  created_at: string;
}

export interface LandingPage {
  id: string;
  campaign_id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
}

export interface LandingPageSession {
  id: string;
  landing_page_id: string;
  session_id: string;
  status: 'Visited' | 'Form Started' | 'Submitted' | 'Paid';
  created_at: string;
}

export interface Segment {
  id: string;
  name: string;
  criteria: any;
  created_at: string;
}

export interface Broadcast {
  id: string;
  segment_id: string;
  channel: string;
  status: string;
  scheduled_at?: string;
}

export interface Journey {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface JourneyStep {
  id: string;
  journey_id: string;
  type: string;
  config: any;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  created_at: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  type: string;
  config: any;
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: string;
  required: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key_hint: string;
  created_at: string;
}

export interface ApiIntegration {
  id: string;
  provider: string;
  status: string;
}

export interface ApiLog {
  id: string;
  endpoint: string;
  status_code: number;
  duration_ms: number;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
}
