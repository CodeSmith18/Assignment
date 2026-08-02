# Issue: Usage Entitlement Quota Not Incrementing (Stuck at 0)

## 🔍 Root Cause Analysis

During telemetry ingestion in `TextFlow`, character processing events were being sent successfully to Flexprice, but the customer dashboard usage values remained at `0% Used` (even after multiple successful summarization/rewrite requests).

The issue was traced to a mismatch between where the **Flexprice API Publisher** sent events and where the **Flexprice Worker Consumer** listened for them:

1. **Publisher Topic (`staging_events`)**:
   In Flexprice's `config.yaml`, the default destination for API-published telemetry events is configured under `kafka.topic`:
   ```yaml
   kafka:
     topic: "staging_events"
   ```
   All `/events` ingestion calls from TextFlow were being written to `staging_events` on Kafka.

2. **Consumer Topic (`events`)**:
   The Watermill consumer task responsible for processing these events and writing them to the ClickHouse analytical database was configured to listen under `event_processing.topic`:
   ```yaml
   event_processing:
     topic: "events"
   ```

3. **Mismatched Transmission**:
   Because of this discrepancy in the docker stack's default configurations:
   * Telemetry events were sent to `staging_events`.
   * The consumer was listening on `events` (where no events were arriving).
   * ClickHouse `events` and `raw_events` database tables remained at `0` rows, resulting in `0` accumulated usage metrics.

---

## 🛠️ Resolution and Changes

To resolve this issue, the publisher and consumer Kafka topics were aligned to `"events"` globally across all services:

### 1. Docker Compose Configuration Overrides
We added environment overrides in `flexprice/docker-compose.yml` to force all Flexprice containers to publish and bind to the correct topics:
* **File Modified**: [flexprice/docker-compose.yml](file:///d:/Assingment/flexprice/docker-compose.yml)
* **Configuration Added**:
  ```yaml
        - FLEXPRICE_KAFKA_TOPIC=events
        - FLEXPRICE_KAFKA_TOPIC_LAZY=events_lazy
        - FLEXPRICE_KAFKA_TOPIC_BULK=events_bulk
  ```
  These variables were applied to the following containers:
  * `flexprice-api`
  * `flexprice-consumer`
  * `flexprice-worker`

### 2. Service Restart
After applying the environment variables, the Docker services were restarted:
```powershell
docker compose down
docker compose up -d
```

### 3. Verification
* Verified using Kafka CLI that all topics (`events`, `events_lazy`) exist on the broker.
* Inspected the consumer logs (`flexprice-consumer`), confirming that the Watermill routing successfully established consumer group claims on the correct topic:
  `[watermill] level=DEBUG msg="Consume claimed" consumer_group=flexprice-consumer-local ... topic=events`
