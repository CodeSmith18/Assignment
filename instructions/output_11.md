# Issue: Usage Entitlement Quota Not Incrementing (Stuck at 0)

## 🔍 Root Cause Analysis

During telemetry ingestion in `TextFlow`, character processing events were being sent successfully to Flexprice, but the customer dashboard usage values remained at `0% Used` (even after multiple successful summarization/rewrite requests).

We identified and resolved two consecutive issues causing this behavior:

---

### Issue 1: Kafka Ingestion Topic Mismatch
The worker consumer was decoupled from the publisher due to mismatched topic configurations in `config.yaml`:
1. **Publisher Topic (`staging_events`)**:
   In Flexprice's `config.yaml`, the default destination for API-published telemetry events is configured under `kafka.topic: "staging_events"`.
2. **Consumer Topic (`events`)**:
   The consumer task responsible for processing events was configured to listen under `event_processing.topic: "events"`.
3. **Outcome**:
   Events sent from TextFlow to `/events` went to `staging_events` and were never read by the consumer listening on `events`.

#### Fix: Topic Alignment
We added environment overrides in `flexprice/docker-compose.yml` to force all Flexprice containers to publish and bind to the correct topics:
```yaml
      - FLEXPRICE_KAFKA_TOPIC=events
      - FLEXPRICE_KAFKA_TOPIC_LAZY=events_lazy
      - FLEXPRICE_KAFKA_TOPIC_BULK=events_bulk
```
These were applied to:
* `flexprice-api`
* `flexprice-consumer`
* `flexprice-worker`

---

### Issue 2: Empty Environment ID Constraint Violation in ClickHouse
Even after aligning the topics, events were not appearing in ClickHouse due to a table constraint violation:
1. **ClickHouse Table Constraint**:
   The ClickHouse `events` table defines a strict constraint:
   `CONSTRAINT check_environment_id CHECK environment_id != ''`
2. **Missing Request Header**:
   Flexprice extracts the `environment_id` for api key operations from the HTTP header:
   `X-Environment-ID`
   Because our Node backend client `client.js` was only sending `x-api-key`, the request environment resolved to `""`.
3. **Consumer DLQ Blocking**:
   The consumer received the event with `environment_id: ""`, tried to insert it, and got a ClickHouse database exception. 
   Because the DLQ topic `event_processing_dlq` was missing on the Kafka broker, the poison handler could not offload it, causing the consumer to retry the invalid event indefinitely and block the entire partition from advancing.

#### Fix: Client Header Injection & DLQ Topic Creation
1. **Added Environment Header**:
   Modified `textflow/server/src/flexprice/client.js` to pass the Sandbox environment ID header matching the PostgreSQL database setup:
   ```javascript
   const flexpriceClient = axios.create({
     baseURL: `${baseURL}/v1`,
     timeout: 30000,
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': apiKey,
       'x-environment-id': '00000000-0000-0000-0000-000000000000'
     }
   });
   ```
2. **Created DLQ Topics**:
   Created the missing `event_processing_dlq` and `staging_events_dlq` topics on the Kafka broker to let the consumer clean out any legacy invalid events.
3. **Gitignore Adjustment**:
   Adjusted the root `.gitignore` to anchor the `flexprice/` ignore directory as `/flexprice/`, ensuring nested client code in `textflow/server/src/flexprice/` is correctly tracked and versioned.

---

## 🧪 Verification
* ClickHouse `events` table row count now successfully increments from `0` to `1` as new events with valid `environment_id` headers are processed.
* The consumer successfully routing poison messages ensures the ingestion queue remains clean and responsive.
