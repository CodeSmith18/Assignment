# Output 10: Manual Demo Run-Through & Pricing Simulation

This document lists the exact files implemented and modified for **Step 10: Manual Demo Run-Through** and **Step 11: Pricing Experiment & Simulation**.

---

## 📁 Implemented and Modified Files

### 1. Pricing Simulation Script
* **File Path**: [textflow/server/scripts/simulate-pricing.js](file:///d:/Assingment/textflow/server/scripts/simulate-pricing.js)
* **Description**: Compares package pricing (Model A) vs tiered slab pricing (Model B).
* **Details**:
  * Seeds the tiered Pro plan (`pro_plan_tiered`) and slab pricing on Flexprice if not present.
  * Dynamically creates 5 simulation customers (`sim_light_1`, `sim_medium_1`, `sim_heavy_1`, `sim_heavy_2`, `sim_medium_2`) on Flexprice.
  * Ingests realistic historical character usage events (500+ events) spread over the last 30 days using `bulkIngestEvents`.
  * Computes costs locally for both billing models.
  * Generates a comparison table and saves a local CSV report.
  * Cleans up all simulation customer records from Flexprice upon completion.

### 2. Output Data File
* **File Path**: [textflow/server/simulation-results.csv](file:///d:/Assingment/textflow/server/simulation-results.csv)
* **Description**: Holds structured CSV outputs of the simulation.

### 3. README File
* **File Path**: [textflow/README.md](file:///d:/Assingment/textflow/README.md)
* **Description**: Holds setup guides, architectural mermaid graphs, and economic takeaways.

---

## 📊 Run-Through Table Output

```text
========================================================================
📊 PRICING EXPERIMENT RESULTS COMPARISON
========================================================================
Customer        Profile   Total Chars   Model A ($)   Model B ($)   Cheaper
------------------------------------------------------------------------
sim_light_1     light     4,734         $11.50        $12.79        Model A
sim_medium_1    medium    33,763        $26.00        $28.13        Model A
sim_heavy_1     heavy     168,822       $93.50        $68.65        Model B
sim_heavy_2     heavy     157,742       $88.00        $65.32        Model B
sim_medium_2    medium    33,102        $26.00        $27.93        Model A
========================================================================
```

### Key Takeaways:
* **Model A** is cheaper for light and medium users.
* **Model B** offers massive discounts to heavy volume users, incentivizing enterprise scale and customer retention.
