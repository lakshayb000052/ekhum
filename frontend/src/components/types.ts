export interface NGO {
  id: string;
  name: string;
  subdomain?: string;
  custom_domain?: string;
  logo_url?: string;
  primary_color?: string;
  plan?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  goal_amount?: number;
  raised_amount?: number;
  status: string;
  created_at: string;
}

export interface Donation {
  id: string;
  organization_id: string;
  campaign_id?: string;
  contact_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  created_at: string;
}

export interface GlobalMetrics {
  total_donations: number;
  total_amount: number;
  active_campaigns: number;
  new_donors: number;
}

export interface BreakdownData {
  name: string;
  value: number;
}

export interface Contact {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  pan_number?: string;
  address?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  status: string;
  contact_status?: string;
  preferred_channel?: string;
  total_donated?: number;
  gift_count?: number;
  active_subscriptions?: number;
  first_gift_date?: string;
  date_of_birth?: string;
  created_at: string;
}

export type Communication = EmailCommunication | WhatsAppCommunication;

export interface MonthlyDonation {
  id: string;
  contact_id: string;
  amount: number;
  status: string;
  next_date: string;
  created_at: string;
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

export interface EightyGReceipt {
  id: string;
  donation_id: string;
  receipt_number: string;
  status: string;
  pdf_url?: string;
  created_at: string;
}

export interface TenBDExport {
  id: string;
  organization_id: string;
  financial_year: string;
  status: string;
  file_url?: string;
  created_at: string;
}

export interface EmailCommunication {
  id: string;
  contact_id: string;
  subject: string;
  status: string;
  sent_at?: string;
}

export interface WhatsAppCommunication {
  id: string;
  contact_id: string;
  message_template: string;
  status: string;
  sent_at?: string;
}

export interface Consent {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  status: string;
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

export interface JourneyEnrolment {
  id: string;
  journey_id: string;
  contact_id: string;
  status: string;
  enrolled_at: string;
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
