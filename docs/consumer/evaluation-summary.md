# Consumer Test Case Evaluation Summary

Evaluated at: 2026-05-01T18:18:55.153Z

## house-phoenix-2006

**Ground truth type:** structural

**Target finding:** The document treats housing dip risk and job loss risk as independent with separate mitigations, but they are causally correlated — a housing crash in Phoenix would cause local job losses, making both mitigations fail simultaneously

| Condition | Verdict | Evidence |
|---|---|---|
| Raw Claude | no | {   "verdict": "partial",   "evidence": "The scenario you're not allowing yourself to fully consider: Phoenix home price... |
| Light Prompt | partial | The document touches on the correlation implicitly in weakness #1: 'The reasoning assumes the authors get to choose when... |
| Decision Challenger | partial | Objection 2 touches on the holding period failing due to life events: 'If Phoenix prices fall 30–40% and you need to sel... |

**Interpretation:** Mixed results — Raw Claude, Light Prompt, Decision Challenger surfaced the finding. Review the evidence quotes to assess whether the surfacing was precise (traced to the structural flaw) or incidental (generic concern that happened to overlap).

## startup-offer-2019

**Ground truth type:** factual

**Target finding:** The fatal failure assumption that the founder identified in the postmortem appears as a stated strength in the candidate document — Decision Challenger should surface it as an objection grounded in the specific document claim

| Condition | Verdict | Evidence |
|---|---|---|
| Raw Claude | yes | The thing you're most excited about is the thing that killed the company... Staff attorneys who are the distribution mec... |
| Light Prompt | yes | The author calculates he needs a $200M exit to break even, then describes this as merely requiring normal execution: 'Se... |
| Decision Challenger | yes | Objection 1 directly challenges the go-to-market mechanism framed as a strength: 'The feature you find most compelling —... |

**Interpretation:** All conditions surfaced the target finding, suggesting this concern is prominent enough that any critical prompting approach catches it. The test case may need a subtler embedding of the flaw to distinguish conditions.

## mba-decision

**Ground truth type:** analytical

**Target finding:** The ROI calculation compares post-MBA salary against current salary rather than against projected salary without MBA — the counterfactual baseline error

| Condition | Verdict | Evidence |
|---|---|---|
| Raw Claude | yes | You model staying at $165-185K if you don't go. But you're a Series C fintech PM with five years of experience. The real... |
| Light Prompt | no | — |
| Decision Challenger | no | — |

**Interpretation:** Mixed results — Raw Claude surfaced the finding. Review the evidence quotes to assess whether the surfacing was precise (traced to the structural flaw) or incidental (generic concern that happened to overlap).

## relocation-austin-nyc

**Ground truth type:** dependency

**Target finding:** The partner's career impact is mentioned briefly and treated as independent of the relocation decision, but it is a correlated variable — if the partner cannot find equivalent work in NYC, the financial and lifestyle calculus changes materially

| Condition | Verdict | Evidence |
|---|---|---|
| Raw Claude | yes | The math assumes Sarah's salary compensates. You're treating her future NYC income as a buffer but haven't quantified it... |
| Light Prompt | yes | the 2-3 month job search estimate is presented as near-certain for a new mother relocating to a competitive market. If i... |
| Decision Challenger | yes | You are already running -$22,000/year at full dual income. The 'month 3' timeline for Sarah's re-employment is stated as... |

**Interpretation:** All conditions surfaced the target finding, suggesting this concern is prominent enough that any critical prompting approach catches it. The test case may need a subtler embedding of the flaw to distinguish conditions.

## baby-timing

**Ground truth type:** framing_bias

**Target finding:** The document frames "wait" as the costless default requiring no justification, while "now" requires justification — but waiting has real costs including fertility probability changes, housing timing, and opportunity costs that are not modeled

| Condition | Verdict | Evidence |
|---|---|---|
| Raw Claude | no | {   "verdict": "partial",   "evidence": "The second risk is more real but depends on assumptions you haven't locked in: ... |
| Light Prompt | partial | The fertility risk is systematically underweighted given the stated goal of two children... Starting at 34 with the firs... |
| Decision Challenger | yes | Assumption 5: "'Waiting' is the active choice that requires justification, while 'now' carries the burden of disruption ... |

**Interpretation:** Mixed results — Raw Claude, Light Prompt, Decision Challenger surfaced the finding. Review the evidence quotes to assess whether the surfacing was precise (traced to the structural flaw) or incidental (generic concern that happened to overlap).
