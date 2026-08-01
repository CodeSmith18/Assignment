# Step 3: Flexprice Entity Seeding & Configuration
## Implementation Instructions for TextFlow SaaS

### Overview
This step creates the seed script that populates your Flexprice instance with all the Features, Plans, Entitlements, and Prices that TextFlow needs. The script will be idempotent (safe to run multiple times) and will save the generated entity IDs to your environment file for use by the application.

---

## Part A: Seed Script Foundation

### 1. Create Idempotent Seed Script
**File:** `textflow/server/scripts/seed-flexprice.js`

**Core Requirements:**
- Script must be idempotent - check for existing entities before creating
- Use the Flexprice client modules from Step 2
- Save all generated IDs to the `.env` file
- Provide clear console output showing what was created vs what already existed
- Handle errors gracefully and provide helpful error messages

**Idempotency Strategy:**
- Use Flexprice search endpoints (`POST /features/search`, `POST /plans/search`) to find existing entities by name
- Compare `lookup_key` fields where available to identify existing entities
- Only create entities that don't already exist
- Update the `.env` file with all IDs regardless of whether they were created or found

---

## Part B: Feature Creation

### 2. Metered Feature - Characters Processed
**Implementation Requirements:**

#### Create the Meter (inline with Feature)
- Event name: `text_processed`
- Aggregation type: `SUM` 
- Aggregation field: `char_count` (from event properties)
- Reset usage: `BILLING_PERIOD` (monthly reset)
- Meter name: `"Characters Processed Meter"`

#### Create the Feature
- Feature name: `"Characters Processed"`
- Feature type: `"metered"`
- Unit singular: `"character"`
- Unit plural: `"characters"`
- Include the meter definition inline
- Optional: Add description explaining this tracks character usage

**Search Strategy:** Look for existing features with the same name before creating.

### 3. Boolean Feature - Tone Selector
**Implementation Requirements:**

#### Create the Feature
- Feature name: `"Tone Selector"`
- Feature type: `"boolean"`
- Description: `"Adjust rewrite tone: Professional, Casual, Academic, Creative"`
- No meter needed for boolean features

**Search Strategy:** Look for existing features with this name.

---

## Part C: Plan Creation

### 4. Create Free and Pro Plans
**Implementation Requirements:**

#### Free Plan
- Plan name: `"Free"`
- Lookup key: `"free_plan"`
- Description: `"Free tier — 2,000 characters/month"`
- Display order: `1`

#### Pro Plan
- Plan name: `"Pro"`
- Lookup key: `"pro_plan"`
- Description: `"Pro tier — 50,000 characters/month + tone control"`
- Display order: `2`

**Search Strategy:** Use lookup_key to find existing plans before creating new ones.

---

## Part D: Entitlement Creation

### 5. Attach Features to Plans with Different Limits
**Implementation Requirements:**

#### Free Plan Entitlements

**Characters Processed (Metered):**
- Plan ID: From created Free plan
- Feature ID: From characters_processed feature
- Feature type: `"metered"`
- Usage limit: `2000`
- Usage reset period: `"MONTHLY"`
- Is soft limit: `false` (hard limit)
- Is enabled: `true`

**Tone Selector (Boolean):**
- Plan ID: From created Free plan  
- Feature ID: From tone_selector feature
- Feature type: `"boolean"`
- Is enabled: `false` (feature disabled for Free users)

#### Pro Plan Entitlements

**Characters Processed (Metered):**
- Plan ID: From created Pro plan
- Feature ID: From characters_processed feature
- Feature type: `"metered"`
- Usage limit: `50000`
- Usage reset period: `"MONTHLY"`
- Is soft limit: `false`
- Is enabled: `true`

**Tone Selector (Boolean):**
- Plan ID: From created Pro plan
- Feature ID: From tone_selector feature
- Feature type: `"boolean"`
- Is enabled: `true` (feature available for Pro users)

**Search Strategy:** Check existing entitlements by plan_id and feature_id combination before creating.

---

## Part E: Pricing Configuration

### 6. Create Pro Plan Pricing (Model A)
**Implementation Requirements:**

#### Usage Price - Package Model
- Price type: `"USAGE"`
- Billing model: `"PACKAGE"`
- Entity type: `"PLAN"`
- Entity ID: Pro plan ID
- Meter ID: Characters processed meter ID
- Currency: `"usd"`
- Amount: `"0.50"` (50 cents per package)
- Billing period: `"MONTHLY"`
- Invoice cadence: `"ARREAR"`
- Transform quantity: `{ "divide_by": 1000 }` (1000 characters per package)

#### Fixed Monthly Fee
- Price type: `"FIXED"`
- Billing model: `"FLAT_FEE"`
- Entity type: `"PLAN"`
- Entity ID: Pro plan ID
- Currency: `"usd"`
- Amount: `"9.00"` (9 dollars per month)
- Billing period: `"MONTHLY"`
- Invoice cadence: `"ADVANCE"`

**Note:** Free plan doesn't need explicit pricing - the entitlement limits provide the constraints.

---

## Part F: Environment File Management

### 7. Update .env File with Generated IDs
**Implementation Requirements:**

#### Required Environment Variables to Set
```
FREE_PLAN_ID=<generated_free_plan_id>
PRO_PLAN_ID=<generated_pro_plan_id>
CHAR_FEATURE_ID=<generated_characters_processed_feature_id>
TONE_FEATURE_ID=<generated_tone_selector_feature_id>
CHAR_METER_ID=<extracted_meter_id_from_characters_processed_feature>
```

#### .env File Update Strategy
- Read the existing `.env` file content
- Replace or append the Flexprice entity ID variables
- Preserve all other environment variables
- Use a simple find-and-replace strategy for each variable
- Create backup of `.env` before modifying (optional but recommended)

#### Console Output Requirements
- Print each generated ID clearly: "✅ FREE_PLAN_ID=plan_abc123"
- Show which entities were created vs found: "Found existing feature: Characters Processed"
- Confirm .env file was updated: "✅ Environment file updated with entity IDs"

---

## Part G: Validation and Testing

### 8. Post-Creation Verification
**Implementation Requirements:**

#### Verify Entity Relationships
- Confirm features are properly attached to plans via entitlements
- Verify usage limits are correctly set for each plan
- Check that boolean features have correct enabled/disabled state
- Validate pricing is properly attached to Pro plan

#### Test Customer Entitlements (Optional)
- Create a test customer and subscription to Free plan
- Verify entitlements show correct limits and feature access
- Test upgrade to Pro plan and re-check entitlements
- Clean up test customer (optional)

### 9. Error Handling Requirements
**Implementation Requirements:**

#### Graceful Failure Handling
- Continue processing other entities if one creation fails
- Provide clear error messages for each failure
- Don't update .env file if critical entities failed to create
- Exit with appropriate status codes (0 for success, 1 for failure)

#### Common Error Scenarios
- Handle duplicate entity creation attempts gracefully
- Manage network timeouts or connection failures to Flexprice
- Deal with invalid entity configurations (e.g., malformed meter definitions)
- Handle missing dependencies (e.g., trying to create entitlement before plan exists)

---

## Part H: Script Usage and Documentation

### 10. Command Line Interface
**Implementation Requirements:**

#### Basic Usage
- Script should run with: `node scripts/seed-flexprice.js`
- Support a `--force` flag to recreate entities even if they exist
- Support a `--dry-run` flag to show what would be created without actually creating
- Provide `--help` flag with usage information

#### Environment Validation
- Check that Flexprice connection is working before starting
- Validate that all required environment variables are set
- Confirm that Flexprice instance is accessible and API key is valid

### 11. Output and Logging
**Implementation Requirements:**

#### Progress Reporting
- Show clear progress for each step: "Creating Features...", "Creating Plans...", etc.
- Use visual indicators: ✅ for success, ⚠️ for warnings, ❌ for errors
- Display total progress: "Step 3 of 6: Creating Entitlements..."
- Show summary at end: "Created 2 features, 2 plans, 4 entitlements, 2 prices"

#### Debugging Information
- Log API calls in verbose mode (optional --verbose flag)
- Show entity IDs as they're created
- Display any warnings about existing entities or configuration issues

---

## Implementation Guidelines

### Entity Creation Order
**Critical Sequence (dependencies matter):**
1. Features (with inline meters) - no dependencies
2. Plans - no dependencies
3. Entitlements - require both Features and Plans to exist
4. Prices - require Plans and Meters to exist

### Search and Deduplication
- Always search before creating to maintain idempotency
- Use exact name matching for features and plans
- For entitlements, check plan_id + feature_id combinations
- For prices, check entity_type + entity_id + meter_id combinations

### Data Validation
- Validate that all required fields are present before API calls
- Ensure numeric values (usage limits, amounts) are properly formatted
- Verify that enum values (billing_model, feature_type) match Flexprice expectations
- Check that lookup_keys follow naming conventions

---

## Verification Checklist

**Before proceeding to Step 4, ensure:**
- [ ] Seed script runs successfully without errors
- [ ] All 5 entity types are created in Flexprice (features, plans, entitlements, prices)
- [ ] .env file is updated with all required entity IDs
- [ ] Script is idempotent (can be run multiple times safely)
- [ ] Free plan has 2,000 character limit with tone selector disabled
- [ ] Pro plan has 50,000 character limit with tone selector enabled
- [ ] Pro plan has proper pricing configuration (fixed + usage)
- [ ] Integration test script from Step 2 now passes all tests including entitlements

---

## Testing Strategy

### Manual Verification
1. Run the seed script: `node scripts/seed-flexprice.js`
2. Check that .env file contains all required IDs
3. Run the integration test: `node scripts/test-flexprice-connection.js`
4. Verify in Flexprice UI (if available) that entities were created correctly

### Idempotency Testing
1. Run seed script once, note the output
2. Run seed script again, confirm no duplicates are created
3. Manually delete one entity from Flexprice
4. Run seed script again, confirm only the missing entity is recreated

---

## Common Pitfalls to Avoid

1. **Creation Order:** Don't create entitlements before their dependent features/plans exist
2. **ID Management:** Don't hardcode entity IDs - always use the returned values from creation
3. **Search Logic:** Don't assume entity names are unique - use lookup_keys where available
4. **Meter Extraction:** Remember that meters are embedded in feature responses, not separate entities
5. **Environment Updates:** Don't partially update .env file if some entities fail to create
6. **Error Recovery:** Don't continue creating dependent entities if their dependencies failed

---

## Next Step Preview

**Step 4** will implement the authentication routes and user management system that uses these Flexprice entities. The signup flow will automatically subscribe new users to the Free plan, and the upgrade flow will change their subscription to the Pro plan using the entity IDs saved in this step.

The seed script you build here is the foundation that makes the entire TextFlow application work with your specific Flexprice instance configuration.