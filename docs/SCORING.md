# Proofline scoring methodology

Proofline uses a deterministic, versioned evidence rubric to rank an opportunity. It does **not** calculate founder worth, a probability of success, a valuation, a revenue forecast, or an investment recommendation. Caller-supplied weights, popularity fields, prestige proxies, protected characteristics, and uncited assertions are rejected at the domain boundary.

The authoritative implementation is [`src/live-domain.mjs`](../src/live-domain.mjs). Investment policy is a separate engine in [`src/investment-policy.mjs`](../src/investment-policy.mjs).

## 1. Score components

The Opportunity score is a weighted composite of five visible dimensions.

| Dimension | Composite weight | Criterion weights inside the dimension |
|---|---:|---|
| Founder execution evidence | 18% | Delivery record 30%, learning velocity 25%, evidence discipline 25%, domain execution 20% |
| Market / problem pull | 25% | Problem severity 30%, buyer urgency 30%, market timing 15%, incumbent pain 25% |
| Product / technical fit | 23% | Technical feasibility 30%, differentiation 25%, independent validation 25%, academic alignment 20% |
| Evidence quality | 14% | Mean cited-source quality, source independence, and substantive coverage |
| Revenue plausibility | 20% | Willingness to pay 30%, unit economics 25%, sales path 25%, market scale 20% |

There are 16 substantive criteria across Founder, Market, Product, and Revenue. Evidence Quality is computed from the evidence supporting those criteria rather than from a caller-authored assessment.

Implementation: [`RUBRIC`](../src/live-domain.mjs#L12) and the composite calculation in [`calculateLiveOpportunityScore`](../src/live-domain.mjs#L1131).

## 2. Evidence records

Every source is normalized into a cited record containing:

- canonical URL and excerpt;
- captured and published dates;
- source type and subject role;
- independence group;
- review state;
- directness and entity-match confidence;
- retraction metadata when present.

Live web results begin as `UNREVIEWED`. A claim may address only one allow-listed criterion and must link to evidence with a `SUPPORT`, `OPPOSE`, or `CONTEXT` stance. Contradictions identify their affected claims and sources and retain a `LOW`, `MEDIUM`, or `HIGH` severity.

## 3. Source quality

Each source begins with a transparent raw-quality calculation:

```text
raw quality =
  45% × source reliability
  + 25% × directness
  + 20% × entity-match confidence
  + 10% × freshness

final quality = min(raw quality, every applicable cap)
```

Reliability is fixed by source class rather than supplied by the researcher.

| Example source class | Base reliability |
|---|---:|
| Government or regulatory | 94% |
| Peer-reviewed research | 90% |
| Independent technical evidence | 88% |
| Customer-primary evidence | 84% |
| Startup-primary material | 62% |
| Uploaded business plan | 52% |
| Social profile | 42% |
| Search snippet | 30% |

Important caps include:

| Condition | Maximum quality |
|---|---:|
| Verified | 100% |
| Reviewed | 78% |
| Unreviewed | 35% |
| Missing publication date | 40% |
| Stale | 55% |
| Severely stale | 35% |
| Uploaded business plan | 65% |
| Social profile | 45% |
| Search snippet | 30% |
| Retracted | 0% |

A polished pitch deck or popular social profile therefore cannot acquire the authority of independent customer, technical, regulatory, or academic evidence.

Implementation: source reliabilities and caps in [`src/live-domain.mjs`](../src/live-domain.mjs#L78), and quality calculation near [`sourceQuality`](../src/live-domain.mjs#L438).

## 4. Independence and claim scoring

Proofline keeps only the strongest source from each independence group. Additional independent groups contribute with diminishing returns of `1`, `0.5`, and `0.25`, capped at 95% total strength. Reposts, copied articles, or the same URL returned by multiple providers cannot be multiplied into false corroboration.

For a scorable claim:

```text
claim score =
  50
  + (assessment − 50) × supporting strength
  − 25 × opposing strength
  − contradiction penalty

claim confidence =
  supporting strength
  × (1 − 0.55 × opposing strength)
  × (1 − contradiction penalty / 50)
```

Scores are constrained to 0–100. No supporting evidence produces no criterion score.

The automated live adapter uses keywords only to route candidate excerpts. It still requires the correct subject role, topical overlap, and independent corroboration before emitting a criterion. Automated assessments remain in a conservative range and receive stricter provisional caps.

## 5. Dimension and Opportunity score

Within a substantive dimension, covered criteria are combined using fixed criterion weights. Missing criteria do not become negative claims; instead, they pull the dimension toward neutral while reducing coverage.

```text
dimension score =
  50 + (observed weighted score − 50) × covered criterion weight
```

The Opportunity score is the weighted sum of all five dimensions. A dimension with no scorable criteria contributes neutral 50 to the headline composite, but its missingness reduces coverage, raises uncertainty, and normally fails the separate policy gates. Provisional Opportunity scores are capped at 74.

## 6. Coverage and confidence

Proofline reports more than a source count:

- scorable criteria against 16 substantive criteria;
- named missing criteria;
- criterion-weighted dimension coverage;
- overall weighted coverage;
- evidence independence and linked-source counts;
- source-strength-derived confidence.

The displayed coverage percentage is therefore weighted evidence coverage—not simply `covered criteria ÷ 16`.

## 7. Uncertainty

The score always travels with a visible uncertainty band:

```text
uncertainty points =
  8
  + 27 × (1 − coverage)
  + 15 × (1 − confidence)
  + 8 × contradiction pressure
```

Contradiction pressure is capped after three open contradictions. Uncertainty is constrained to 8–40 points and rounded upward. A provisional result has a minimum uncertainty of ±18.

| Level | Uncertainty |
|---|---:|
| Low | below 18 |
| Medium | 18–27 |
| High | 28 or above |

The engine also names the drivers: material evidence gaps, limited source strength, open contradictions, or residual model/market uncertainty.

## 8. Opposing evidence and contradictions

Opposing evidence directly lowers score and confidence. If one independence group appears on both sides of a claim, it is retained only on the opposing side.

Open contradictions add a source-strength-adjusted penalty:

| Severity | Base penalty |
|---|---:|
| Low | 4 points |
| Medium | 10 points |
| High | 18 points |

The combined explicit penalty is capped at 25 points per claim. Open material contradictions also increase uncertainty and block check eligibility.

## 9. Provisional versus reviewed

| Mode | Evidence behavior | Decision boundary |
|---|---|---|
| Provisional | Can surface bounded unreviewed public-web evidence after independent corroboration; automated criteria and the composite remain capped | No decision impact; at least ±18 uncertainty |
| Reviewed | Excludes every `UNREVIEWED` source from scored claims and citations; automated claims require reviewed independent evidence | Can enter policy screening, subject to every separate gate |

A source becomes reviewed only after a human attests that they opened it, checked the company/entity match, and found the excerpt relevant. Review does not prove every claim or turn a non-peer-reviewed source into peer-reviewed research.

## 10. Explicit exclusions

The scoring schema excludes:

- protected characteristics and personal-worth judgments;
- education, employer, investor, or accelerator prestige;
- followers, likes, virality, and social popularity;
- uncited assertions and caller-defined scoring weights.

Founder-execution evidence additionally requires explicit founder attribution. Academic comparison is recorded as research alignment only; it does not establish peer-review status, product efficacy, or adoption. GitHub popularity, trend signals, and official open-data observations remain outside the Opportunity score and check sizing.

## 11. Score versus check policy

The Opportunity score supports ranking. The policy engine controls eligibility and is deliberately noncompensatory.

Every policy gate must pass:

- reviewed evidence mode;
- confirmed entity identity and thesis match;
- no compliance hold;
- no open material contradiction;
- Founder execution ≥55;
- Market / problem pull ≥55;
- Product / technical fit ≥55;
- Revenue plausibility ≥50;
- Evidence Quality ≥40;
- overall coverage ≥70%;
- overall source confidence ≥50%;
- uncertainty ≤25 points.

The default policy amount is a fixed USD 100,000. Optional risk-adjusted sizing uses a separate risk index based on market shortfall (25%), product/technical shortfall (40%), and revenue shortfall (35%). The amount is recomputed from the immutable reviewed score.

Recording a check further requires a queued reviewed assessment, the `Policy screen eligible` workflow action, a named reviewer, a written rationale, and all required acknowledgements. Every resulting record states that it is non-binding, reserves no funds, and authorizes no transfer.

Implementation: [`src/investment-policy.mjs`](../src/investment-policy.mjs) and [`src/live-queue.mjs`](../src/live-queue.mjs#L511).

## 12. Repeatable public-source demonstration

The packaged Emovo Care demonstration uses nine reviewed evidence records across eight unique public-source URLs. It produces:

- Opportunity score: 62.1/100;
- weighted evidence coverage: 85.1%;
- criteria covered: 15/16;
- uncertainty: ±18;
- five visible dimension scores;
- a non-binding fixed-policy USD 100,000 result eligible for named human review.

This is a frozen, repeatable workflow demonstration—not a current endorsement, investment recommendation, or promise of funding.

[Return to the main README](../README.md)
