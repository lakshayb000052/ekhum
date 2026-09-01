import { Pool } from 'pg';

interface Migration {
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    name: '001_extend_existing_tables',
    up: `
      -- 1. Extend organizations
      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS registration_number VARCHAR(255),
      ADD COLUMN IF NOT EXISTS organisation_pan VARCHAR(20),
      ADD COLUMN IF NOT EXISTS eighty_g_urn VARCHAR(100),
      ADD COLUMN IF NOT EXISTS eighty_g_approval_date DATE,
      ADD COLUMN IF NOT EXISTS eighty_g_valid_until DATE,
      ADD COLUMN IF NOT EXISTS twelve_a_registration VARCHAR(100),
      ADD COLUMN IF NOT EXISTS fcra_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS csr_registration VARCHAR(100),
      ADD COLUMN IF NOT EXISTS registered_address TEXT,
      ADD COLUMN IF NOT EXISTS signatory_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS signatory_designation VARCHAR(255),
      ADD COLUMN IF NOT EXISTS signature_image_url VARCHAR(2048),
      ADD COLUMN IF NOT EXISTS receipt_number_prefix VARCHAR(50),
      ADD COLUMN IF NOT EXISTS platform_fee_percentage NUMERIC(5,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS ses_verified_identity VARCHAR(255),
      ADD COLUMN IF NOT EXISTS waba_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS enabled_gateways JSONB DEFAULT '["razorpay"]'::jsonb,
      ADD COLUMN IF NOT EXISTS gateway_credentials JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS logo_brand_colors JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS onboarded_date DATE;

      -- 2. Extend campaigns
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS campaign_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20) DEFAULT 'online',
      ADD COLUMN IF NOT EXISTS channel VARCHAR(50),
      ADD COLUMN IF NOT EXISTS cause_or_programme VARCHAR(255),
      ADD COLUMN IF NOT EXISTS start_date DATE,
      ADD COLUMN IF NOT EXISTS end_date DATE,
      ADD COLUMN IF NOT EXISTS target_signups INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS default_frequency VARCHAR(20) DEFAULT 'both',
      ADD COLUMN IF NOT EXISTS default_ask_amounts JSONB DEFAULT '[500, 1000, 2500, 5000]'::jsonb,
      ADD COLUMN IF NOT EXISTS minimum_amount NUMERIC(12,2) DEFAULT 1.00,
      ADD COLUMN IF NOT EXISTS allowed_gateways JSONB DEFAULT '["razorpay"]'::jsonb,
      ADD COLUMN IF NOT EXISTS default_utm_source VARCHAR(255),
      ADD COLUMN IF NOT EXISTS default_utm_medium VARCHAR(255),
      ADD COLUMN IF NOT EXISTS default_utm_campaign VARCHAR(255),
      ADD COLUMN IF NOT EXISTS fundraiser_agency_id UUID,
      ADD COLUMN IF NOT EXISTS offline_batch_reference VARCHAR(255),
      ADD COLUMN IF NOT EXISTS thankyou_template_override_id UUID,
      ADD COLUMN IF NOT EXISTS approved_by UUID,
      ADD COLUMN IF NOT EXISTS approval_date DATE;

      -- 3. Extend donors (Contact)
      ALTER TABLE donors
      ADD COLUMN IF NOT EXISTS title VARCHAR(20),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS birthdate DATE,
      ADD COLUMN IF NOT EXISTS street_address_1 VARCHAR(500),
      ADD COLUMN IF NOT EXISTS street_address_2 VARCHAR(500),
      ADD COLUMN IF NOT EXISTS city VARCHAR(255),
      ADD COLUMN IF NOT EXISTS state VARCHAR(255),
      ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS contact_status VARCHAR(50) DEFAULT 'lead',
      ADD COLUMN IF NOT EXISTS acquisition_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(50),
      ADD COLUMN IF NOT EXISTS total_monthly_donations INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_onetime_donations INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_paid_amount NUMERIC(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS total_gift_count_paid INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_gift_value_paid NUMERIC(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS last_gift_amount_paid NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS first_gift_date DATE,
      ADD COLUMN IF NOT EXISTS last_gift_date DATE,
      ADD COLUMN IF NOT EXISTS first_gift_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS last_gift_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS total_failed_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_failed_attempt_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(20) DEFAULT 'both',
      ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES donors(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS lapsed_date DATE,
      ADD COLUMN IF NOT EXISTS created_by UUID;

      -- 4. Extend subscriptions (Monthly Donation)
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS mandate_id UUID,
      ADD COLUMN IF NOT EXISTS signup_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS consecutive_failed_installments INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS debit_day_preference INTEGER,
      ADD COLUMN IF NOT EXISTS burn_date DATE,
      ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pause_start_date DATE,
      ADD COLUMN IF NOT EXISTS pause_end_date DATE,
      ADD COLUMN IF NOT EXISTS value_upgrade BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS value_upgrade_date DATE,
      ADD COLUMN IF NOT EXISTS upgraded_value NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS downgraded BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS helpdesk_ticket_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS helpdesk_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS end_reason TEXT,
      ADD COLUMN IF NOT EXISTS end_date DATE,
      ADD COLUMN IF NOT EXISTS pan_card BOOLEAN DEFAULT false;

      -- 5. Extend donations (Payment)
      ALTER TABLE donations
      ADD COLUMN IF NOT EXISTS landing_page_session_id UUID,
      ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_raw_status VARCHAR(100),
      ADD COLUMN IF NOT EXISTS normalised_failure_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS net_settled_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS settlement_date DATE,
      ADD COLUMN IF NOT EXISTS settlement_utr VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'online',
      ADD COLUMN IF NOT EXISTS offline_receipt_number VARCHAR(255),
      ADD COLUMN IF NOT EXISTS retry_attempt_number INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS eighty_g_receipt_id UUID,
      ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'one_time';
      
      -- Add unique constraint for idempotency_key safely
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'donations_idempotency_key_key') THEN
            ALTER TABLE donations ADD CONSTRAINT donations_idempotency_key_key UNIQUE (idempotency_key);
        END IF;
      END $$;
    `
  },
  {
    name: '002_create_new_tables',
    up: `
      -- We will ensure 'templates' table exists first, just in case, because of references.
      CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 1. roles
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. landing_pages
      CREATE TABLE IF NOT EXISTS landing_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        url_slug VARCHAR(255) NOT NULL,
        page_title VARCHAR(500),
        meta_description TEXT,
        template VARCHAR(100),
        form_field_config JSONB DEFAULT '[]'::jsonb,
        hero_media_url VARCHAR(2048),
        variant_label VARCHAR(100),
        status VARCHAR(50) DEFAULT 'draft',
        published_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, url_slug)
      );

      -- 3. landing_page_sessions
      CREATE TABLE IF NOT EXISTS landing_page_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        contact_id UUID REFERENCES donors(id) ON DELETE SET NULL,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        utm_term VARCHAR(255),
        referrer_url VARCHAR(2048),
        broadcast_id UUID,
        journey_id UUID,
        device_type VARCHAR(50),
        browser VARCHAR(100),
        os VARCHAR(100),
        ip_address_hash VARCHAR(64),
        city_inferred VARCHAR(255),
        state_inferred VARCHAR(255),
        form_started BOOLEAN DEFAULT false,
        form_submitted BOOLEAN DEFAULT false,
        gateway_redirected BOOLEAN DEFAULT false,
        outcome VARCHAR(50),
        payment_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. mandates
      CREATE TABLE IF NOT EXISTS mandates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        payment_gateway VARCHAR(50) NOT NULL,
        mandate_method VARCHAR(50) NOT NULL,
        umrn VARCHAR(255),
        gateway_mandate_ref VARCHAR(255),
        bank_name VARCHAR(255),
        account_last_four VARCHAR(4),
        max_debit_amount NUMERIC(12,2),
        mandate_start_date DATE,
        mandate_end_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        rejection_reason VARCHAR(255),
        registered_at TIMESTAMP WITH TIME ZONE,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 5. eighty_g_receipts
      CREATE TABLE IF NOT EXISTS eighty_g_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
        payment_id UUID NOT NULL REFERENCES donations(id) ON DELETE RESTRICT,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        receipt_number VARCHAR(100) NOT NULL,
        financial_year VARCHAR(10) NOT NULL,
        donation_date DATE NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        donor_name_snapshot VARCHAR(500) NOT NULL,
        donor_pan_snapshot VARCHAR(20),
        donor_address_snapshot TEXT,
        organisation_urn_snapshot VARCHAR(100),
        organisation_pan_snapshot VARCHAR(20),
        signatory_snapshot VARCHAR(255),
        pdf_url VARCHAR(2048),
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        email_delivery_status VARCHAR(50) DEFAULT 'pending',
        email_delivery_date TIMESTAMP WITH TIME ZONE,
        whatsapp_delivery_status VARCHAR(50) DEFAULT 'pending',
        whatsapp_delivery_date TIMESTAMP WITH TIME ZONE,
        download_count INTEGER DEFAULT 0,
        reissued BOOLEAN DEFAULT false,
        reissue_of UUID REFERENCES eighty_g_receipts(id) ON DELETE SET NULL,
        voided BOOLEAN DEFAULT false,
        void_reason TEXT,
        included_in_10bd BOOLEAN DEFAULT false,
        ten_bd_export_id UUID,
        UNIQUE(organization_id, receipt_number, financial_year)
      );

      -- 6. ten_bd_exports
      CREATE TABLE IF NOT EXISTS ten_bd_exports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        financial_year VARCHAR(10) NOT NULL,
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        generated_by UUID,
        record_count INTEGER DEFAULT 0,
        total_amount NUMERIC(14,2) DEFAULT 0.00,
        excluded_record_count INTEGER DEFAULT 0,
        exclusion_reasons JSONB DEFAULT '[]'::jsonb,
        donation_type_breakdown JSONB DEFAULT '{}'::jsonb,
        receipt_mode_breakdown JSONB DEFAULT '{}'::jsonb,
        csv_file_url VARCHAR(2048),
        filing_status VARCHAR(50) DEFAULT 'draft',
        filed_date DATE,
        acknowledgement_number VARCHAR(255),
        revision_number INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 7. consents
      CREATE TABLE IF NOT EXISTS consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'never_given',
        source VARCHAR(50),
        captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        consent_text_version TEXT,
        ip_address VARCHAR(64),
        session_id UUID,
        withdrawn_at TIMESTAMP WITH TIME ZONE,
        withdrawal_source VARCHAR(50),
        legal_basis VARCHAR(50) DEFAULT 'consent',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, contact_id, channel)
      );

      -- 8. events
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        contact_id UUID REFERENCES donors(id) ON DELETE SET NULL,
        payment_id UUID REFERENCES donations(id) ON DELETE SET NULL,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        source VARCHAR(50),
        idempotency_key VARCHAR(255) UNIQUE,
        processing_status VARCHAR(20) DEFAULT 'pending',
        processed_at TIMESTAMP WITH TIME ZONE,
        retry_count INTEGER DEFAULT 0,
        subscribers_fired JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 9. segments
      CREATE TABLE IF NOT EXISTS segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        segment_name VARCHAR(255) NOT NULL,
        description TEXT,
        query_sql TEXT NOT NULL,
        query_parameters JSONB DEFAULT '{}'::jsonb,
        type VARCHAR(20) DEFAULT 'dynamic',
        refresh_frequency VARCHAR(20) DEFAULT 'on_demand',
        last_refreshed_at TIMESTAMP WITH TIME ZONE,
        member_count INTEGER DEFAULT 0,
        row_limit INTEGER DEFAULT 50000,
        suppression_applied BOOLEAN DEFAULT true,
        created_by UUID,
        approved_by UUID,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 10. journeys
      CREATE TABLE IF NOT EXISTS journeys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        journey_name VARCHAR(255) NOT NULL,
        description TEXT,
        entry_type VARCHAR(50) NOT NULL,
        entry_event_type VARCHAR(100),
        entry_segment_id UUID REFERENCES segments(id) ON DELETE SET NULL,
        entry_conditions JSONB DEFAULT '{}'::jsonb,
        re_entry_allowed BOOLEAN DEFAULT false,
        max_entries_per_contact INTEGER DEFAULT 1,
        goal_event_type VARCHAR(100),
        exit_conditions JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(20) DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        created_by UUID,
        approved_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 11. journey_steps
      CREATE TABLE IF NOT EXISTS journey_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type VARCHAR(50) NOT NULL,
        wait_duration_minutes INTEGER,
        wait_until TIMESTAMP WITH TIME ZONE,
        template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
        condition_expression JSONB DEFAULT '{}'::jsonb,
        true_branch_step_id UUID,
        false_branch_step_id UUID,
        respect_quiet_hours BOOLEAN DEFAULT true,
        fallback_channel VARCHAR(20),
        config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 12. journey_enrolments
      CREATE TABLE IF NOT EXISTS journey_enrolments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
        entry_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
        entered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        current_step_id UUID REFERENCES journey_steps(id) ON DELETE SET NULL,
        next_action_due_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'active',
        exit_reason TEXT,
        goal_achieved BOOLEAN DEFAULT false,
        goal_achieved_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 13. email_communications
      CREATE TABLE IF NOT EXISTS email_communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        payment_id UUID REFERENCES donations(id) ON DELETE SET NULL,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        communication_type VARCHAR(50) NOT NULL,
        trigger_type VARCHAR(20),
        event_id UUID REFERENCES events(id) ON DELETE SET NULL,
        broadcast_id UUID,
        journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
        step_id UUID REFERENCES journey_steps(id) ON DELETE SET NULL,
        template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
        template_version VARCHAR(50),
        subject_line VARCHAR(500),
        from_address VARCHAR(255),
        reply_to VARCHAR(255),
        status VARCHAR(50) DEFAULT 'queued',
        ses_message_id VARCHAR(255),
        queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        opened_at TIMESTAMP WITH TIME ZONE,
        open_count INTEGER DEFAULT 0,
        first_clicked_at TIMESTAMP WITH TIME ZONE,
        click_count INTEGER DEFAULT 0,
        bounce_type VARCHAR(20),
        bounce_reason TEXT,
        complaint_at TIMESTAMP WITH TIME ZONE,
        attachment_ref VARCHAR(2048),
        retry_count INTEGER DEFAULT 0,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 14. whatsapp_communications
      CREATE TABLE IF NOT EXISTS whatsapp_communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        payment_id UUID REFERENCES donations(id) ON DELETE SET NULL,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        waba_id VARCHAR(255),
        phone_number_id VARCHAR(255),
        recipient_number VARCHAR(20),
        template_name VARCHAR(255),
        template_language VARCHAR(10) DEFAULT 'en',
        template_category VARCHAR(20),
        template_variables JSONB DEFAULT '{}'::jsonb,
        communication_type VARCHAR(50) NOT NULL,
        trigger_type VARCHAR(20),
        event_id UUID REFERENCES events(id) ON DELETE SET NULL,
        broadcast_id UUID,
        journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
        step_id UUID REFERENCES journey_steps(id) ON DELETE SET NULL,
        meta_message_id VARCHAR(255),
        meta_conversation_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'queued',
        queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        read_at TIMESTAMP WITH TIME ZONE,
        failure_code VARCHAR(100),
        failure_reason TEXT,
        opt_in_verified BOOLEAN DEFAULT false,
        conversation_category VARCHAR(50),
        billable BOOLEAN DEFAULT false,
        message_cost NUMERIC(8,4) DEFAULT 0.00,
        reply_received BOOLEAN DEFAULT false,
        reply_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 15. broadcasts
      CREATE TABLE IF NOT EXISTS broadcasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL,
        broadcast_name VARCHAR(255) NOT NULL,
        segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE RESTRICT,
        template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
        template_version VARCHAR(50),
        scheduled_at TIMESTAMP WITH TIME ZONE,
        timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
        send_window_start TIME,
        send_window_end TIME,
        throttle_rate INTEGER DEFAULT 100,
        status VARCHAR(50) DEFAULT 'draft',
        approved_by UUID,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        clicked_count INTEGER DEFAULT 0,
        read_count INTEGER DEFAULT 0,
        estimated_cost NUMERIC(12,2) DEFAULT 0.00,
        actual_cost NUMERIC(12,2) DEFAULT 0.00,
        variant_label VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 16. field_definitions
      CREATE TABLE IF NOT EXISTS field_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        object_name VARCHAR(100) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        field_label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        is_required BOOLEAN DEFAULT false,
        default_value TEXT,
        picklist_values JSONB DEFAULT '[]'::jsonb,
        validation_regex VARCHAR(500),
        help_text TEXT,
        is_system BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        group_name VARCHAR(100) DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, object_name, field_name)
      );

      -- 17. reports
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        report_type VARCHAR(50) DEFAULT 'tabular',
        primary_object VARCHAR(100) NOT NULL,
        columns JSONB DEFAULT '[]'::jsonb,
        filters JSONB DEFAULT '[]'::jsonb,
        group_by JSONB DEFAULT '[]'::jsonb,
        sort_by JSONB DEFAULT '[]'::jsonb,
        chart_type VARCHAR(50),
        chart_config JSONB DEFAULT '{}'::jsonb,
        is_system BOOLEAN DEFAULT false,
        is_public BOOLEAN DEFAULT false,
        folder VARCHAR(100) DEFAULT 'My Reports',
        last_run_at TIMESTAMP WITH TIME ZONE,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 18. dashboards
      CREATE TABLE IF NOT EXISTS dashboards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        layout JSONB DEFAULT '[]'::jsonb,
        is_default BOOLEAN DEFAULT false,
        role_visibility JSONB DEFAULT '["super_admin", "ngo_admin"]'::jsonb,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 19. dashboard_widgets
      CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
        widget_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
        config JSONB DEFAULT '{}'::jsonb,
        position_x INTEGER DEFAULT 0,
        position_y INTEGER DEFAULT 0,
        width INTEGER DEFAULT 6,
        height INTEGER DEFAULT 4,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 20. api_keys
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        key_prefix VARCHAR(10) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        scopes JSONB DEFAULT '[]'::jsonb,
        rate_limit_per_minute INTEGER DEFAULT 60,
        last_used_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'active',
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 21. api_integrations
      CREATE TABLE IF NOT EXISTS api_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        webhook_url VARCHAR(2048) NOT NULL,
        events_subscribed JSONB DEFAULT '[]'::jsonb,
        auth_type VARCHAR(20) DEFAULT 'hmac',
        auth_config JSONB DEFAULT '{}'::jsonb,
        headers JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(20) DEFAULT 'active',
        last_triggered_at TIMESTAMP WITH TIME ZONE,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 22. api_logs
      CREATE TABLE IF NOT EXISTS api_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES api_integrations(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        response_status INTEGER,
        response_body TEXT,
        delivered_at TIMESTAMP WITH TIME ZONE,
        retry_count INTEGER DEFAULT 0,
        next_retry_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'pending',
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: '003_seed_and_backfill',
    up: `
      -- 1. Seed system roles
      INSERT INTO roles (organization_id, name, display_name, description, is_system, permissions)
      VALUES 
        (NULL, 'super_admin', 'Super Admin', 'System administrator with full access', true, '{"all": true}'::jsonb),
        (NULL, 'ngo_admin', 'NGO Admin', 'Administrator for the NGO', true, '{"all": true}'::jsonb),
        (NULL, 'ngo_manager', 'NGO Manager', 'Manager for the NGO', true, '{"contacts": {"create": true, "read": true, "update": true, "delete": false}, "donations": {"read": true}}'::jsonb),
        (NULL, 'ngo_viewer', 'NGO Viewer', 'Read-only access for the NGO', true, '{"contacts": {"read": true}, "donations": {"read": true}}'::jsonb)
      ON CONFLICT DO NOTHING;

      -- 2. Backfill existing donors
      -- Split name into first_name and last_name where applicable
      -- First, check if the "name" column exists in donors table
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donors' AND column_name = 'name') THEN
            UPDATE donors
            SET 
              first_name = CASE 
                WHEN strpos(trim(name), ' ') > 0 THEN split_part(trim(name), ' ', 1) 
                ELSE trim(name) 
              END,
              last_name = CASE 
                WHEN strpos(trim(name), ' ') > 0 THEN substr(trim(name), strpos(trim(name), ' ') + 1)
                ELSE '' 
              END
            WHERE name IS NOT NULL AND first_name IS NULL;
        END IF;
      END $$;

      -- Set contact_status='donor' where donations exist
      UPDATE donors d
      SET contact_status = 'donor'
      WHERE EXISTS (
        SELECT 1 FROM donations p WHERE p.donor_id = d.id AND p.status = 'success'
      ) AND contact_status = 'lead';
    `
  },
  {
    name: '004_communication_gateways_multi_provider',
    up: `
      -- 1. Extend organizations with communication configs
      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS whatsapp_config JSONB DEFAULT '{"provider": "meta"}'::jsonb,
      ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT '{"provider": "ses"}'::jsonb;

      -- 2. Backfill existing organizations with legacy configs if present
      UPDATE organizations
      SET whatsapp_config = jsonb_build_object(
        'provider', 'meta',
        'meta', COALESCE(whatsapp_meta_config, '{}'::jsonb),
        'evolution_go', '{"api_url": "", "api_key": "", "instance_name": ""}'::jsonb
      )
      WHERE whatsapp_config IS NULL OR whatsapp_config = '{}'::jsonb;

      UPDATE organizations
      SET email_config = jsonb_build_object(
        'provider', 'ses',
        'from_email', COALESCE(verified_sender_email, reply_to_email, 'donations@danapro.org'),
        'sender_name', COALESCE(sender_name, name, 'DanaPro'),
        'reply_to', COALESCE(reply_to_email, verified_sender_email, ''),
        'ses', '{}'::jsonb,
        'smtp', '{"host": "", "port": 587, "user": "", "pass": "", "secure": false}'::jsonb
      )
      WHERE email_config IS NULL OR email_config = '{}'::jsonb;

      -- 3. Extend communications tracking tables with provider telemetry
      ALTER TABLE whatsapp_communications
      ADD COLUMN IF NOT EXISTS provider_used VARCHAR(50) DEFAULT 'meta',
      ADD COLUMN IF NOT EXISTS dispatch_log JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE email_communications
      ADD COLUMN IF NOT EXISTS provider_used VARCHAR(50) DEFAULT 'ses',
      ADD COLUMN IF NOT EXISTS dispatch_log JSONB DEFAULT '{}'::jsonb;
    `
  },
  {
    name: '005_salesforce_crm_complete_schema',
    up: `
      -- 1. Complete Contact Object fields (donors)
      ALTER TABLE donors
      ADD COLUMN IF NOT EXISTS title VARCHAR(50),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS birthdate DATE,
      ADD COLUMN IF NOT EXISTS street_address_1 VARCHAR(500),
      ADD COLUMN IF NOT EXISTS street_address_2 VARCHAR(500),
      ADD COLUMN IF NOT EXISTS city VARCHAR(255),
      ADD COLUMN IF NOT EXISTS state VARCHAR(255),
      ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS total_monthly_donations INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_onetime_donations INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_paid_amount NUMERIC(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS first_gift_date DATE,
      ADD COLUMN IF NOT EXISTS last_gift_date DATE,
      ADD COLUMN IF NOT EXISTS total_gift_count_paid INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_gift_value_paid NUMERIC(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS last_gift_amount_paid NUMERIC(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS first_gift_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS last_gift_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS contact_status VARCHAR(50) DEFAULT 'donor';

      -- 2. Complete Monthly Donation Object fields (subscriptions)
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS signup_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS signup_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS first_payment_date DATE,
      ADD COLUMN IF NOT EXISTS last_donation_date_paid DATE,
      ADD COLUMN IF NOT EXISTS last_billing_date DATE,
      ADD COLUMN IF NOT EXISTS pan_card BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS total_paid_installments INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_installments_attempted INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'razorpay',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'upi_autopay',
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS next_payment_due_date DATE,
      ADD COLUMN IF NOT EXISTS end_reason TEXT,
      ADD COLUMN IF NOT EXISTS end_date DATE,
      ADD COLUMN IF NOT EXISTS helpdesk_ticket_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS helpdesk_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS downgraded BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS paused_period INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pause_start_date DATE,
      ADD COLUMN IF NOT EXISTS pause_end_date DATE,
      ADD COLUMN IF NOT EXISTS value_upgrade BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS value_upgrade_date DATE,
      ADD COLUMN IF NOT EXISTS upgraded_value NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS mandate_id UUID;

      -- 3. Complete Payment Object fields (donations)
      ALTER TABLE donations
      ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'one_time',
      ADD COLUMN IF NOT EXISTS failure_reason TEXT,
      ADD COLUMN IF NOT EXISTS eighty_g_sent_email BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS eighty_g_sent_whatsapp BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS eighty_g_receipt_id UUID;

      -- 4. Complete 80G Receipts table
      CREATE TABLE IF NOT EXISTS eighty_g_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
        payment_id UUID NOT NULL REFERENCES donations(id) ON DELETE RESTRICT,
        monthly_donation_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
        receipt_number VARCHAR(100) NOT NULL,
        financial_year VARCHAR(10) NOT NULL,
        donation_date DATE NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        donor_name_snapshot VARCHAR(500) NOT NULL,
        donor_pan_snapshot VARCHAR(20),
        donor_address_snapshot TEXT,
        organisation_urn_snapshot VARCHAR(100),
        organisation_pan_snapshot VARCHAR(20),
        signatory_snapshot VARCHAR(255),
        pdf_url VARCHAR(2048),
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        email_delivery_status VARCHAR(50) DEFAULT 'pending',
        email_delivery_date TIMESTAMP WITH TIME ZONE,
        whatsapp_delivery_status VARCHAR(50) DEFAULT 'pending',
        whatsapp_delivery_date TIMESTAMP WITH TIME ZONE,
        download_count INTEGER DEFAULT 0,
        reissued BOOLEAN DEFAULT false,
        reissue_of UUID REFERENCES eighty_g_receipts(id) ON DELETE SET NULL,
        voided BOOLEAN DEFAULT false,
        void_reason TEXT,
        included_in_10bd BOOLEAN DEFAULT false,
        ten_bd_export_id UUID,
        UNIQUE(organization_id, receipt_number, financial_year)
      );

      -- 5. Indexes for high performance Salesforce-style CRM lookups
      CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
      CREATE INDEX IF NOT EXISTS idx_donations_subscription_id ON donations(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_donor_id ON subscriptions(donor_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_campaign_id ON subscriptions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_eighty_g_contact_id ON eighty_g_receipts(contact_id);
      CREATE INDEX IF NOT EXISTS idx_eighty_g_payment_id ON eighty_g_receipts(payment_id);
      CREATE INDEX IF NOT EXISTS idx_email_comm_contact_id ON email_communications(contact_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_comm_contact_id ON whatsapp_communications(contact_id);
    `
  }
];

/**
 * Runs all pending migrations.
 * @param pool - The pg Pool instance connected to the database.
 */
export default async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    // 1. Create schema_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already applied migrations
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const appliedMigrations = new Set(rows.map(row => row.name));

    // 3. Run pending migrations
    for (const migration of migrations) {
      if (!appliedMigrations.has(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        
        await client.query('BEGIN');
        try {
          await client.query(migration.up);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [migration.name]);
          await client.query('COMMIT');
          console.log(`Successfully ran migration: ${migration.name}`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Failed to run migration ${migration.name}:`, error);
          throw error;
        }
      }
    }
    
    console.log('All database migrations applied successfully.');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}
