---
id: gcp
kind: stack
status: reviewed
tier: plugin
sources:
  - title: Google Cloud Architecture Framework
    url: https://cloud.google.com/architecture/framework
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stacks contains "gcp"
---
# Stack pack: Google Cloud (GCP)

Look in Terraform, `cloudbuild.yaml`, GitHub Actions, `app.yaml`, Cloud Run/Functions configs, IAM bindings.

**Identity & secrets (SEC/PLT)**
- No service account key files (JSON keys) anywhere — use Workload Identity Federation for CI and Workload Identity for GKE. Org policy `iam.disableServiceAccountKeyCreation` enforced.
- No primitive roles (`roles/owner`, `roles/editor`) for service accounts or apps; default compute SA not used by workloads; per-service SAs with minimal roles.
- Secret Manager for secrets, accessed by SA identity; no secrets in env vars in plain Terraform.
- `allUsers` / `allAuthenticatedUsers` bindings on buckets, functions, Cloud Run → Critical unless explicitly public content.

**Network (PLT)**
- VPC Service Controls perimeter around sensitive data services (BigQuery, GCS) for regulated data.
- Cloud SQL: private IP, no `0.0.0.0/0` authorised networks, IAM DB auth, backups + PITR.
- Cloud Run/Functions: ingress `internal` or behind load balancer + Cloud Armor for public; `--no-allow-unauthenticated` unless intended.

**Data & residency (CMP/DAT)**
- Org policy `gcp.resourceLocations` restricted to EU locations (`in:eu-locations`); check BigQuery dataset locations (`EU` multi-region or `europe-north1` etc.) and GCS bucket locations.
- CMEK where policy requires; Assured Workloads / sovereign controls for strict EU residency (needs-evidence).
- Vertex AI / Gemini endpoints in EU regions; check data-processing terms (needs-evidence).
- Uniform bucket-level access + public access prevention on GCS.

**Ops (SRE/PLT)**
- **Data Access audit logs are off by default** (except BigQuery) — enable for services holding personal data, otherwise "who viewed" is unanswerable.
- Log sinks to a locked bucket with retention; Cloud Monitoring alerting policies with notification channels to humans.
- Budgets with alert thresholds (and Pub/Sub automation for hard caps where needed).
- Labels for owner/env/cost centre.
