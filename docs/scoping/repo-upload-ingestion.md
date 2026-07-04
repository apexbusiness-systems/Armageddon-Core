# Scoping — Repository / ZIP Upload & Code-Analysis Ingestion

**Status:** Reference / planning artifact. No code, dependencies, routes, or
schema are introduced by this document. It exists to let the founder make a
build/no-build decision and to scope v1 honestly.

**Author context (confirmed from the codebase, 2026-06-27):**
The engine today tests a **single live target endpoint**. `targetUrl` flows
onboarding draft → `DestructionConsole.initiateSequence` → `startWorkflowApi(…, targetEndpoint)`
→ `POST /api/run { targetEndpoint }`. There is **no** clone, unzip, archive
extraction, or source ingestion path anywhere in `armageddon-site/src` or
`packages/*` (verified by search). Batteries B10–B14 run adversarial prompts
against a model/endpoint; only the stress battery consumes a URL. There is **no**
object storage (no R2, no Supabase Storage) and **no** upload route.

Conclusion: "upload a repo / zip" is **not** a copy or wiring gap — it is a
**distinct product surface** (static analysis of customer source code) that does
not exist yet. Treat it as a new capability, not a fix.

---

## 1. Problem statement

Prospects read "Repository URL" and expect to point Armageddon at a codebase.
The product instead exercises a running LLM endpoint. We can either (a) keep the
honest endpoint-only positioning (done — onboarding copy corrected), or (b)
build a real code-analysis surface. This doc scopes (b).

## 2. Required components (named honestly, with tradeoffs)

| Component | Options | Recommendation | Tradeoff |
| --- | --- | --- | --- |
| Object storage for uploads | Supabase Storage (already in stack) vs Cloudflare R2 (edge/Workers-native) | **Supabase Storage for v1** — no new vendor, satisfies CLAUDE.md "no new dependency/cost" rule; revisit R2 only if egress/Workers locality becomes a measured bottleneck | Supabase Storage adds load to the existing project; R2 pairs better with the existing Cloudflare Worker but is a new vendor/billing surface |
| Upload intake | New authenticated route accepting multipart/zip with hard caps | Worker- or Next-route, auth-gated, org-scoped | Must not reuse the support-chat intake path (different threat model) |
| Archive extraction | Sandboxed, resource-limited unzip | Isolated worker/queue job, never in the request thread | Extraction is the highest-risk step (see §3) |
| Static-analysis batteries | New battery class operating on files, not a live endpoint | New engine module parallel to B10–B14 | Largest net-new effort; defines the actual product value |
| Results storage | Reuse `armageddon_runs` shape where possible | Extend, do not fork | Avoid a second runs source of truth |

## 3. Security surface (untrusted archive handling)

This is the dominant risk area. Minimum controls for any v1:

- **Size caps:** reject > N MB compressed and > M MB/​files uncompressed
  (defends zip bombs); enforce a max file count and max compression ratio.
- **Path traversal:** reject entries containing `..`, absolute paths, or
  symlinks; extract to a per-run isolated prefix only.
- **MIME / type validation:** validate the archive magic bytes, not the
  filename; allowlist file extensions analyzed.
- **Isolated execution:** extraction and analysis run in a sandboxed,
  network-denied job with CPU/memory/time limits — never in the API process.
- **Authorization:** require explicit attestation that the uploader is
  authorized to submit and have the code analyzed (mirror the existing
  "authorized to test" gate); org-scope every artifact.
- **No code execution:** v1 analyzes source statically; it must never run,
  build, or install dependencies from uploaded code.

## 4. Data lifecycle

- **Where:** customer source lives in object storage under an org-scoped,
  per-run prefix; never in the primary Postgres tables.
- **Retention:** default short TTL (e.g. delete raw archive after analysis
  completes + a small grace window); make retention a stated, configurable
  policy, not an accident.
- **Deletion:** support explicit per-run and per-org purge; deletion must
  remove both the archive and any extracted artifacts.
- **Compliance:** customer source code is sensitive IP — document handling in
  PRIVACY.md / SECURITY.md before GA; consider contractual DPA language.

## 5. Phased plan

- **Phase 0 (this doc):** decision + non-goals. No code.
- **Phase 1 (smallest shippable slice):** auth-gated upload of a single zip,
  hard caps, sandboxed extraction, and **one** static-analysis battery that
  produces a real, honest finding. Org-scoped storage + short retention.
  Proves the pipeline end-to-end without fabricated breadth.
- **Phase 2:** additional static batteries, repo-URL (git) ingestion,
  larger archives, incremental re-analysis.
- **Phase 3:** depth (data-flow/taint analysis), policy packs, integrations.

## 6. Non-goals for v1

- Running, building, or installing uploaded code.
- Git provider OAuth / private-repo cloning (Phase 2+).
- Multi-gigabyte monorepos or binary artifact analysis.
- Replacing the existing live-endpoint batteries — this is additive.

## 7. Open questions for the founder

1. Is code analysis a real wedge for the ICP, or does endpoint testing already
   cover the buyer's need? (Decides build vs. don't-build.)
2. Storage vendor: accept Supabase Storage for v1, or is edge locality worth
   adding R2 now?
3. What is the acceptable retention window for customer source code?
4. What single static-analysis finding would be compelling enough to anchor
   Phase 1 (the "one battery that matters")?
5. Does the GTM still want the word "repository" anywhere pre-Phase-1, or do we
   hold honest endpoint-only positioning until the slice ships?
