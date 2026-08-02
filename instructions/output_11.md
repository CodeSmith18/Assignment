# Issue: Usage Entitlement Quota Not Incrementing (Stuck at 0)

## 🔍 Root Cause Analysis

During telemetry ingestion in `TextFlow`, character processing events were being sent successfully to Flexprice, but the customer dashboard usage values remained at `0% Used` (even after multiple successful summarization/rewrite requests).

We identified and resolved three consecutive issues causing this behavior:

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
   'x-environment-id': '00000000-0000-0000-0000-000000000000'
   ```
2. **Created DLQ Topics**:
   Created the missing `event_processing_dlq` and `staging_events_dlq` topics on the Kafka broker to let the consumer clean out any legacy invalid events.
3. **Gitignore Adjustment**:
   Adjusted the root `.gitignore` to anchor the `flexprice/` ignore directory as `/flexprice/`, ensuring nested client code in `textflow/server/src/flexprice/` is correctly tracked and versioned.

---

### Issue 3: Missing Entitlement Usage Calculation for Free Subscriptions (No-Charge Items)
Once events were successfully written to ClickHouse, the usage summary endpoint `/customers/usage` still returned `0` usage for Free plan users.
1. **No-Charge Metered Features**:
   Under the Free Plan, the `Characters Processed` entitlement exists with a limit of 2,000, but has *no price* associated with it (it is a $0.00 free tier plan, so it does not contain a metered pricing charge line item).
2. **Charges Loop Dependency**:
   In Flexprice's `billingService.GetCustomerUsageSummary` method (`flexprice/internal/ee/service/billing.go`), usage calculations were nested solely inside the loop processing active subscription charges:
   ```go
   for _, charge := range usage.Charges { ... }
   ```
   Because features without price items are omitted from subscription charges, the billing service bypassed querying ClickHouse for these metered features, leaving their usage values uninitialized (`0`).

#### Fix: Added Fallback Ingestion Query for Free Entitlements
Modified `flexprice/internal/ee/service/billing.go` to add a proactive fallback loop. If a metered feature is entitled to a subscription but does not have any active charges (which is the case for free tiers), the billing service will dynamically query ClickHouse for the meter's telemetry:
```go
	// 3.5. Proactively fetch usage for metered features that do not have charges (e.g. Free plan features)
	for _, feature := range entitlements.Features {
		featureID := feature.Feature.ID
		if types.FeatureType(feature.Feature.Type) != types.FeatureTypeMetered {
			continue
		}
		if !usageByFeature[featureID].IsZero() {
			continue
		}
        ...
		usageResult, err := eventService.GetUsageByMeter(ctx, usageRequest)
        ...
	}
```
Rebuilt the `flexprice-build` container image without caching and restarted the compose cluster.

---

## 🧪 Verification
* ClickHouse `events` table row count successfully registers new character processing events.
* Direct query to `/customers/usage?customer_lookup_key=<user>` now successfully returns the exact character count processed (e.g., `1983 / 2000`).
* The UI dashboard **Usage & Quota** progress bar correctly displays live usage.
