import pool from '../config/db';

export type EventHandler = (event: EventPayload) => Promise<void>;

export interface EventPayload {
  eventType: string;
  organizationId: string;
  contactId?: string;
  paymentId?: string;
  monthlyDonationId?: string;
  campaignId?: string;
  payload: Record<string, any>;
  source: string;
  idempotencyKey: string;
}

export class EventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);
  }

  async publish(event: EventPayload): Promise<void> {
    const handlers = this.subscribers.get(event.eventType) || [];
    
    // Dispatch to all subscribers concurrently
    const promises = handlers.map(handler => 
      handler(event).catch(err => {
        console.error(`Error in event handler for ${event.eventType}:`, err);
      })
    );
    
    await Promise.allSettled(promises);
  }

  async publishAndStore(event: EventPayload): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check idempotency (assuming a unique constraint on idempotencyKey)
      // or explicit check if idempotencyKey is used that way.
      // Table should be: `events (idempotency_key, event_type, organization_id, payload, created_at)`
      const checkRes = await client.query(
        'SELECT id FROM events WHERE idempotency_key = $1',
        [event.idempotencyKey]
      );
      
      if (checkRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return false; // Already processed
      }

      await client.query(
        `INSERT INTO events (
          event_type, organization_id, contact_id, payment_id, 
          monthly_donation_id, campaign_id, payload, source, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          event.eventType, event.organizationId, event.contactId, event.paymentId,
          event.monthlyDonationId, event.campaignId, event.payload, event.source,
          event.idempotencyKey
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to store event:', error);
      throw error;
    } finally {
      client.release();
    }

    // After storing successfully, dispatch the event
    await this.publish(event);
    return true;
  }
}

export const eventBus = new EventBus();
