# Terraform

## Contents
- State & backends
- Modules & workspaces
- Plan/apply discipline
- Common errors
- Verify

## State & backends

State is the source of truth Terraform diffs against — not your `.tf` files, not real infrastructure. Three failure classes come from forgetting this:

- **Local state in a team repo**: `terraform.tfstate` committed to git or left local means two people can apply concurrently against different copies and silently diverge. Use a remote backend (S3+DynamoDB lock table, Terraform Cloud, GCS, Azure Storage) before more than one person touches the config.
- **No locking**: without a lock (DynamoDB table for S3 backend, native locking for Cloud/GCS), two concurrent `apply` runs can corrupt state. Confirm locking is configured, not just remote storage.
- **Manual out-of-band changes**: if someone edits a resource in the provider console, state and reality diverge ("drift"). `terraform plan` will show a diff even though nothing in the `.tf` changed. Run `terraform plan -refresh-only` periodically to catch this before it surprises an `apply`.

```hcl
terraform {
  backend "s3" {
    bucket         = "apex-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "apex-tf-locks"
    encrypt        = true
  }
}
```

Never hand-edit `.tfstate`. If a resource needs to be removed from state without destroying it (e.g. it's now managed elsewhere), use `terraform state rm <address>` — and `terraform import <address> <id>` to bring an existing resource under management instead of recreating it.

## Modules & workspaces

- **Modules** are for reuse across environments/services, not for organizing files within one config. A module boundary should map to something you'd version and reuse — e.g. `modules/render-service` used by both staging and prod callers — not just "networking.tf split into a folder."
- **Workspaces** (`terraform workspace new staging`) give you separate state per environment from one config, but all workspaces share the same backend config and provider. For meaningfully different environments (different accounts, different regions with different failure domains), prefer separate state files/directories over workspaces — workspaces make it easy to `apply` against the wrong one by accident.
- Pin provider versions (`required_providers` with a `version` constraint) and commit `.terraform.lock.hcl`. An unpinned provider can introduce breaking schema changes on a routine `terraform init` in CI.

```hcl
terraform {
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
  required_version = ">= 1.5"
}
```

## Plan/apply discipline

- Always run `terraform plan -out=tfplan` and review the diff before `terraform apply tfplan`. Applying a fresh plan (no `-out`) in CI means the plan Terraform shows you isn't necessarily the plan it executes if state changed in between.
- `count`/`for_each` index changes reorder or recreate resources unexpectedly — prefer `for_each` with a stable key (map/set) over `count` with a list whose order can shift.
- `terraform destroy -target` and `apply -target` are escape hatches, not routine tools — targeted applies can leave dependent resources in a state the rest of your config doesn't expect. Use them to unblock, then reconcile with a full `plan`.

## Common errors

| Error | Likely cause | Fix |
|---|---|---|
| `Error: state lock` / lock held by another process | Prior run crashed without releasing the lock, or a concurrent apply | Confirm no other apply is actually running, then `terraform force-unlock <lock-id>` |
| `Error: Provider produced inconsistent result after apply` | Provider bug or resource mutated outside Terraform mid-apply | Re-run `plan`; if persistent, check provider issue tracker — don't just retry blindly |
| Resource recreated when you expected in-place update | Changed an attribute that forces replacement (check provider docs — often marked `ForceNew` / ⚠ in resource docs) | If replacement is unacceptable, look for a lifecycle workaround (`create_before_destroy`) or a different attribute path that updates in place |
| `Error: Cycle` | Two resources reference each other, often via implicit dependency through a data source | Break the cycle with an explicit `depends_on` restructure or split into two applies |
| Drift shows up only in `plan`, never applied cleanly | Out-of-band console change | `terraform apply` to reconcile, or `terraform state rm` + `import` if the manual change should now be authoritative |

## Verify

```bash
terraform fmt -check
terraform validate
terraform plan -out=tfplan   # review the diff — this is the actual gate, not validate
```
