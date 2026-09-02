import pool from '../config/db';

export interface ContactRollupMetrics {
  totalMonthlyDonations: number;
  totalOnetimeDonations: number;
  totalPaidAmount: number;
  firstGiftDate: string | null;
  lastGiftDate: string | null;
  totalGiftCountPaid: number;
  totalGiftValuePaid: number;
  lastGiftAmountPaid: number | null;
  averageGiftAmount: number;
  largestGiftAmount: number | null;
  largestGiftDate: string | null;
  donorTier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  donorLifecycleStage: 'lead' | 'first_time' | 'active_regular' | 'monthly_retained' | 'major_donor' | 'lapsed';
  daysSinceLastGift: number | null;
  firstGiftCampaignId: string | null;
  lastGiftCampaignId: string | null;
  firstGiftCampaignTitle?: string;
  lastGiftCampaignTitle?: string;
  ngosContributed: string[];
  campaignsContributed: string[];
}

/**
 * Automatically recalculates and updates lifetime giving metrics for a donor/contact.
 * Triggered on every donation completion, refund, failure, or subscription event.
 */
export async function recalculateContactRollups(donorId: string, orgId?: string): Promise<ContactRollupMetrics | null> {
  if (!donorId) return null;

  try {
    // 1. Calculate Donation Metrics (completed / paid)
    const donRes = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status IN ('completed', 'paid', 'success')) as total_paid_count,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('completed', 'paid', 'success')), 0) as total_paid_sum,
         COALESCE(AVG(amount) FILTER (WHERE status IN ('completed', 'paid', 'success')), 0) as avg_paid_amount,
         COALESCE(MAX(amount) FILTER (WHERE status IN ('completed', 'paid', 'success')), 0) as max_paid_amount,
         COUNT(*) FILTER (WHERE status IN ('completed', 'paid', 'success') AND (subscription_id IS NULL OR payment_type = 'one_time')) as onetime_count,
         COUNT(*) FILTER (WHERE status IN ('completed', 'paid', 'success') AND (subscription_id IS NOT NULL OR payment_type = 'monthly_donation')) as monthly_count
       FROM donations 
       WHERE donor_id = $1`,
      [donorId]
    );

    const paidCount = Number(donRes.rows[0]?.total_paid_count || 0);
    const paidSum = Number(donRes.rows[0]?.total_paid_sum || 0);
    const avgPaid = Math.round(Number(donRes.rows[0]?.avg_paid_amount || 0));
    const maxPaid = Number(donRes.rows[0]?.max_paid_amount || 0);
    const onetimeCount = Number(donRes.rows[0]?.onetime_count || 0);

    // 2. Count active and total Monthly Donations / Subscriptions
    const subRes = await pool.query(
      `SELECT 
         COUNT(*) as total_subscriptions,
         COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions
       FROM subscriptions 
       WHERE donor_id = $1`,
      [donorId]
    );
    const totalSubscriptions = Number(subRes.rows[0]?.total_subscriptions || 0);
    const activeSubscriptions = Number(subRes.rows[0]?.active_subscriptions || 0);

    // 3. Find First and Last Gift Details & Largest Gift
    const firstGiftRes = await pool.query(
      `SELECT d.amount, d.created_at, d.campaign_id, c.title as campaign_title
       FROM donations d
       LEFT JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.donor_id = $1 AND d.status IN ('completed', 'paid', 'success')
       ORDER BY d.created_at ASC 
       LIMIT 1`,
      [donorId]
    );

    const lastGiftRes = await pool.query(
      `SELECT d.amount, d.created_at, d.campaign_id, c.title as campaign_title
       FROM donations d
       LEFT JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.donor_id = $1 AND d.status IN ('completed', 'paid', 'success')
       ORDER BY d.created_at DESC 
       LIMIT 1`,
      [donorId]
    );

    const largestGiftRes = await pool.query(
      `SELECT d.amount, d.created_at
       FROM donations d
       WHERE d.donor_id = $1 AND d.status IN ('completed', 'paid', 'success')
       ORDER BY d.amount DESC, d.created_at DESC
       LIMIT 1`,
      [donorId]
    );

    const firstGift = firstGiftRes.rows[0] || null;
    const lastGift = lastGiftRes.rows[0] || null;
    const largestGift = largestGiftRes.rows[0] || null;

    // 4. Find all NGOs & Campaigns this donor has given to
    const multiNgoRes = await pool.query(
      `SELECT DISTINCT o.name as org_name, c.title as campaign_title
       FROM donations d
       JOIN organizations o ON d.organization_id = o.id
       LEFT JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.donor_id = $1 AND d.status IN ('completed', 'paid', 'success')`,
      [donorId]
    );

    const ngos = Array.from(new Set(multiNgoRes.rows.map((r: any) => r.org_name).filter(Boolean)));
    const campaigns = Array.from(new Set(multiNgoRes.rows.map((r: any) => r.campaign_title).filter(Boolean)));

    const firstGiftDate = firstGift ? firstGift.created_at : null;
    const lastGiftDate = lastGift ? lastGift.created_at : null;
    const largestGiftDate = largestGift ? largestGift.created_at : null;
    const firstGiftCampaignId = firstGift ? firstGift.campaign_id : null;
    const lastGiftCampaignId = lastGift ? lastGift.campaign_id : null;
    const lastGiftAmount = lastGift ? Number(lastGift.amount) : null;
    
    // Calculate Days since last gift
    let daysSinceLastGift: number | null = null;
    if (lastGiftDate) {
      const diffMs = Date.now() - new Date(lastGiftDate).getTime();
      daysSinceLastGift = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // Determine Donor Tier
    let donorTier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' = 'Bronze';
    if (paidSum >= 100000) donorTier = 'Platinum';
    else if (paidSum >= 25000) donorTier = 'Gold';
    else if (paidSum >= 5000) donorTier = 'Silver';

    // Determine Donor Lifecycle Stage
    let donorLifecycleStage: 'lead' | 'first_time' | 'active_regular' | 'monthly_retained' | 'major_donor' | 'lapsed' = 'lead';
    if (paidCount === 0 && totalSubscriptions === 0) {
      donorLifecycleStage = 'lead';
    } else if (paidSum >= 50000) {
      donorLifecycleStage = 'major_donor';
    } else if (activeSubscriptions > 0) {
      donorLifecycleStage = 'monthly_retained';
    } else if (daysSinceLastGift !== null && daysSinceLastGift > 180) {
      donorLifecycleStage = 'lapsed';
    } else if (paidCount > 1) {
      donorLifecycleStage = 'active_regular';
    } else {
      donorLifecycleStage = 'first_time';
    }

    const contactStatus = (paidCount > 0 || totalSubscriptions > 0) ? (daysSinceLastGift !== null && daysSinceLastGift > 180 ? 'lapsed' : 'donor') : 'lead';

    // 5. Update Contact Record in Database
    await pool.query(
      `UPDATE donors 
       SET 
         total_monthly_donations = $1,
         total_onetime_donations = $2,
         total_paid_amount = $3,
         total_gift_count_paid = $4,
         total_gift_value_paid = $5,
         last_gift_amount_paid = $6,
         first_gift_date = $7,
         last_gift_date = $8,
         first_gift_campaign_id = COALESCE($9, first_gift_campaign_id),
         last_gift_campaign_id = COALESCE($10, last_gift_campaign_id),
         contact_status = $11,
         updated_at = NOW()
       WHERE id = $12`,
      [
        totalSubscriptions,
        onetimeCount,
        paidSum,
        paidCount,
        paidSum,
        lastGiftAmount,
        firstGiftDate,
        lastGiftDate,
        firstGiftCampaignId,
        lastGiftCampaignId,
        contactStatus,
        donorId
      ]
    );

    return {
      totalMonthlyDonations: totalSubscriptions,
      totalOnetimeDonations: onetimeCount,
      totalPaidAmount: paidSum,
      firstGiftDate,
      lastGiftDate,
      totalGiftCountPaid: paidCount,
      totalGiftValuePaid: paidSum,
      lastGiftAmountPaid: lastGiftAmount,
      averageGiftAmount: avgPaid,
      largestGiftAmount: maxPaid > 0 ? maxPaid : null,
      largestGiftDate,
      donorTier,
      donorLifecycleStage,
      daysSinceLastGift,
      firstGiftCampaignId,
      lastGiftCampaignId,
      firstGiftCampaignTitle: firstGift?.campaign_title,
      lastGiftCampaignTitle: lastGift?.campaign_title,
      ngosContributed: ngos as string[],
      campaignsContributed: campaigns as string[]
    };
  } catch (error) {
    console.error(`[ContactRollupService] Error calculating rollups for donor ${donorId}:`, error);
    return null;
  }
}

/**
 * Recalculate Monthly Donation / Subscription statistics when a payment or attempt occurs.
 */
export async function updateSubscriptionStats(subscriptionId: string): Promise<void> {
  if (!subscriptionId) return;

  try {
    const statsRes = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status IN ('completed', 'paid', 'success')) as total_paid_installments,
         COUNT(*) as total_installments_attempted,
         MIN(created_at) FILTER (WHERE status IN ('completed', 'paid', 'success')) as first_payment_date,
         MAX(created_at) FILTER (WHERE status IN ('completed', 'paid', 'success')) as last_donation_date_paid,
         MAX(created_at) as last_billing_date
       FROM donations 
       WHERE subscription_id = $1`,
      [subscriptionId]
    );

    const row = statsRes.rows[0];
    if (row) {
      await pool.query(
        `UPDATE subscriptions 
         SET 
           total_paid_installments = $1,
           total_installments_attempted = $2,
           first_payment_date = COALESCE($3, first_payment_date),
           last_donation_date_paid = COALESCE($4, last_donation_date_paid),
           last_billing_date = COALESCE($5, last_billing_date),
           updated_at = NOW()
         WHERE id = $6`,
        [
          Number(row.total_paid_installments || 0),
          Number(row.total_installments_attempted || 0),
          row.first_payment_date || null,
          row.last_donation_date_paid || null,
          row.last_billing_date || null,
          subscriptionId
        ]
      );
    }
  } catch (error) {
    console.error(`[ContactRollupService] Error updating subscription stats ${subscriptionId}:`, error);
  }
}

/**
 * Standard Indian PIN Code Directory & Postal Lookup.
 * Resolves 6-digit PIN codes to City and State automatically.
 */
export function lookupIndianPincode(pincode: string): { city: string; state: string; country: string } | null {
  const pin = (pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) {
    return null;
  }

  const prefix = pin.substring(0, 2);

  // Common Indian Region & City Mapping
  const pinStateMap: Record<string, { state: string; sampleCity: string }> = {
    '11': { state: 'Delhi', sampleCity: 'New Delhi' },
    '12': { state: 'Haryana', sampleCity: 'Gurugram' },
    '13': { state: 'Haryana', sampleCity: 'Ambala' },
    '14': { state: 'Punjab', sampleCity: 'Ludhiana' },
    '15': { state: 'Punjab', sampleCity: 'Bathinda' },
    '16': { state: 'Chandigarh', sampleCity: 'Chandigarh' },
    '17': { state: 'Himachal Pradesh', sampleCity: 'Shimla' },
    '18': { state: 'Jammu & Kashmir', sampleCity: 'Jammu' },
    '19': { state: 'Jammu & Kashmir', sampleCity: 'Srinagar' },
    '20': { state: 'Uttar Pradesh', sampleCity: 'Noida' },
    '21': { state: 'Uttar Pradesh', sampleCity: 'Prayagraj' },
    '22': { state: 'Uttar Pradesh', sampleCity: 'Lucknow' },
    '23': { state: 'Uttar Pradesh', sampleCity: 'Kanpur' },
    '24': { state: 'Uttarakhand', sampleCity: 'Dehradun' },
    '25': { state: 'Uttar Pradesh', sampleCity: 'Meerut' },
    '26': { state: 'Uttar Pradesh', sampleCity: 'Bareilly' },
    '27': { state: 'Uttar Pradesh', sampleCity: 'Gorakhpur' },
    '28': { state: 'Uttar Pradesh', sampleCity: 'Agra' },
    '30': { state: 'Rajasthan', sampleCity: 'Jaipur' },
    '31': { state: 'Rajasthan', sampleCity: 'Udaipur' },
    '32': { state: 'Rajasthan', sampleCity: 'Kota' },
    '33': { state: 'Rajasthan', sampleCity: 'Bikaner' },
    '34': { state: 'Rajasthan', sampleCity: 'Jodhpur' },
    '36': { state: 'Gujarat', sampleCity: 'Rajkot' },
    '37': { state: 'Gujarat', sampleCity: 'Jamnagar' },
    '38': { state: 'Gujarat', sampleCity: 'Ahmedabad' },
    '39': { state: 'Gujarat', sampleCity: 'Surat' },
    '40': { state: 'Maharashtra', sampleCity: 'Mumbai' },
    '41': { state: 'Maharashtra', sampleCity: 'Pune' },
    '42': { state: 'Maharashtra', sampleCity: 'Nashik' },
    '43': { state: 'Maharashtra', sampleCity: 'Aurangabad' },
    '44': { state: 'Maharashtra', sampleCity: 'Nagpur' },
    '45': { state: 'Madhya Pradesh', sampleCity: 'Indore' },
    '46': { state: 'Madhya Pradesh', sampleCity: 'Bhopal' },
    '47': { state: 'Madhya Pradesh', sampleCity: 'Gwalior' },
    '48': { state: 'Madhya Pradesh', sampleCity: 'Jabalpur' },
    '49': { state: 'Chhattisgarh', sampleCity: 'Raipur' },
    '50': { state: 'Telangana', sampleCity: 'Hyderabad' },
    '51': { state: 'Andhra Pradesh', sampleCity: 'Tirupati' },
    '52': { state: 'Andhra Pradesh', sampleCity: 'Vijayawada' },
    '53': { state: 'Andhra Pradesh', sampleCity: 'Visakhapatnam' },
    '56': { state: 'Karnataka', sampleCity: 'Bengaluru' },
    '57': { state: 'Karnataka', sampleCity: 'Mangaluru' },
    '58': { state: 'Karnataka', sampleCity: 'Hubballi' },
    '59': { state: 'Karnataka', sampleCity: 'Belagavi' },
    '60': { state: 'Tamil Nadu', sampleCity: 'Chennai' },
    '61': { state: 'Tamil Nadu', sampleCity: 'Thanjavur' },
    '62': { state: 'Tamil Nadu', sampleCity: 'Madurai' },
    '63': { state: 'Tamil Nadu', sampleCity: 'Salem' },
    '64': { state: 'Tamil Nadu', sampleCity: 'Coimbatore' },
    '67': { state: 'Kerala', sampleCity: 'Kozhikode' },
    '68': { state: 'Kerala', sampleCity: 'Kochi' },
    '69': { state: 'Kerala', sampleCity: 'Thiruvananthapuram' },
    '70': { state: 'West Bengal', sampleCity: 'Kolkata' },
    '71': { state: 'West Bengal', sampleCity: 'Howrah' },
    '72': { state: 'West Bengal', sampleCity: 'Medinipur' },
    '73': { state: 'West Bengal', sampleCity: 'Siliguri' },
    '74': { state: 'West Bengal', sampleCity: 'North 24 Parganas' },
    '75': { state: 'Odisha', sampleCity: 'Bhubaneswar' },
    '76': { state: 'Odisha', sampleCity: 'Cuttack' },
    '77': { state: 'Odisha', sampleCity: 'Rourkela' },
    '78': { state: 'Assam', sampleCity: 'Guwahati' },
    '79': { state: 'North East', sampleCity: 'Agartala' },
    '80': { state: 'Bihar', sampleCity: 'Patna' },
    '81': { state: 'Bihar', sampleCity: 'Bhagalpur' },
    '82': { state: 'Bihar', sampleCity: 'Gaya' },
    '83': { state: 'Jharkhand', sampleCity: 'Ranchi' },
    '84': { state: 'Bihar', sampleCity: 'Muzaffarpur' },
    '85': { state: 'Bihar', sampleCity: 'Purnia' }
  };

  const match = pinStateMap[prefix];
  if (match) {
    return {
      city: match.sampleCity,
      state: match.state,
      country: 'India'
    };
  }

  return {
    city: 'India',
    state: 'India',
    country: 'India'
  };
}
