import flexpriceClient from './client.js';
import { normalizeFlexpriceError } from './errors.js';
import { nanoid } from 'nanoid';

/**
 * Ingests a single usage event into Flexprice.
 * @param {object} eventData - { event_name, external_customer_id, properties, timestamp, event_id }
 * @returns {Promise<object>} The response containing acceptance confirmation and event ID
 */
export async function ingestEvent(eventData) {
  try {
    const payload = {
      event_id: eventData.event_id || `evt_${nanoid(16)}`,
      event_name: eventData.event_name,
      external_customer_id: eventData.external_customer_id,
      properties: eventData.properties || {},
      source: 'api'
    };

    if (eventData.timestamp) {
      payload.timestamp = eventData.timestamp;
    }

    const response = await flexpriceClient.post('/events', payload);
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}

/**
 * Ingests multiple usage events in bulk.
 * @param {array} eventsArray - Array of eventData objects
 * @returns {Promise<object>} Bulk ingestion confirmation response
 */
export async function bulkIngestEvents(eventsArray) {
  try {
    const formattedEvents = eventsArray.map(event => ({
      event_id: event.event_id || `evt_${nanoid(16)}`,
      event_name: event.event_name,
      external_customer_id: event.external_customer_id,
      properties: event.properties || {},
      source: 'api',
      timestamp: event.timestamp || new Date().toISOString()
    }));

    const response = await flexpriceClient.post('/events/bulk', {
      events: formattedEvents
    });
    return response;
  } catch (error) {
    throw normalizeFlexpriceError(error);
  }
}
