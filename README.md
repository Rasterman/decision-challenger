# Decision Challenger

A prototype that explores whether Claude's capacity for reasoned disagreement can become a product behavior people depend on — for team decisions and personal ones.

The professional mode sits in your product workflow before you commit resources: reads a proposal, returns the strongest specific arguments against proceeding, holds its position under weak pushback, and ends every session with a shareable pre-commit brief.

The personal mode applies the same capability to individual high-stakes decisions — leaving a job, buying a house, taking an offer. Same phases, same holds logic, same artifact. But the concerns are different: financial realism, reversibility, stated vs. actual motivations. The output is a decision record you can return to six months later.

**Live demo:** [link]  
**Built with:** React, Tailwind, Anthropic API (claude-sonnet-4-6)

---

## The Product Hypothesis

### Professional mode

Most teams make high-stakes decisions in meetings where everyone nods and nobody says the hard thing out loud. The expensive failure mode isn't bad execution — it's committing to the wrong thing after a review process that felt rigorous but wasn't.

I noticed Claude can now do something qualitatively different from previous AI tools: it can maintain a reasoned position across a contested conversation, identify the specific assumptions a document is resting on, and distinguish between a counter-argument that actually resolves a concern versus one that just sounds confident. That's not a search capability. It's closer to a thinking colleague who read the document before the meeting.

The product bet: the most valuable place to apply this capability is the moment before a sprint starts, not during it.

### Personal mode

The same capability maps cleanly to personal decisions, and the consumer moment is different. When someone writes "I want to leave my job because I'm not growing," and Decision Challenger reads their own words back as the basis for a challenge — "you describe wanting growth, but your actual language points to exhaustion and a specific manager relationship" — that's not something any existing product produces. It's not therapy. It's not life coaching. It's a structured artifact that reflects your stated reasoning back at you before you commit.

The `accepted_cost` field hits differently in a personal context. "You are implicitly agreeing to stay in a city you dislike for at least three more years" is a powerful line to read before signing a mortgage. No existing tool produces that sentence.

The deeper question I'm interested in: what happens when people have access to an interlocutor that holds position on the hardest questions in their life, and produces a record they can return to? The enterprise version is proof of rigor. The consumer version is proof of where the capability wants to go.

---

## What It Does

**Phase 0 — Assumption Map**  
Before raising any objections, Decision Challenger reads the full proposal and surfaces the 3–5 load-bearing assumptions — the things that would need to be true for the proposal to succeed as written. Each assumption is grounded in a verbatim quote from the document. This step makes the objections feel derived rather than imposed.

**Phase 1 — Objections**  
Three specific arguments against proceeding, each tied to actual document language. Not generic risk categories. At HIGH stakes, financial coherence, regulatory pathway, and traction verifiability are mandatory concern categories regardless of what else surfaces.

**Phase 2 — Challenge Session**  
The user responds to each objection. Decision Challenger either:
- **Updates** — concedes with explicit reasoning about what new information resolved the concern
- **Holds** — maintains the objection and specifies exactly what evidence would cause it to update (`would_update_if`)
- **Accepts** — when the user acknowledges a risk and proceeds anyway, records an `accepted_cost`: what the team is implicitly agreeing to absorb

**Phase 3 — Pre-Commit Brief**  
A structured artifact capturing the proposal summary, each objection with its resolution status (resolved / open / accepted), and a `confidence_framing` paragraph — a short, plain-language assessment of what the team is actually betting on when they commit.

The brief is designed to be attached to a Linear ticket or Notion doc. It reads like a colleague wrote it, not a compliance tool.

---

## What I Built and What I Learned

### The Build

The system prompt is the product. The UI is the delivery mechanism. The meaningful engineering work was:

- Forcing Claude to ground every objection in a verbatim document quote, eliminating generic risk surface
- Engineering the `holds` behavior — Claude's default training toward helpfulness makes it want to validate pushback. The system prompt explicitly requires it to distinguish new information from emotional persistence and hold when the counter doesn't address the core concern
- The `would_update_if` field, which converts a "no" into an actionable path forward
- The `accepted_cost` field, which turns dismissal into a documented commitment
- Forced concern categories at HIGH stakes, derived from consistency testing

### Study 1 — Professional Mode: Comparison Testing

I ran the same documents through three conditions: raw Claude with no system prompt, a lightly prompted Claude asking for weaknesses, and Decision Challenger with full phase structure. Two documents: a well-written internal engineering proposal (API key management portal) and the reconstructed 2006 Theranos investor deck.

**Raw Claude is strong and I won't pretend otherwise.** On the API key proposal, raw Claude produced six objections — more than Decision Challenger's three. On the Theranos deck, raw Claude produced ten objections with a sharp summary judgment table. Unstructured Claude performs well on critical analysis tasks.

**Decision Challenger found things raw Claude missed.** On Theranos, raw Claude flagged the absent regulatory pathway — correct and generic. Decision Challenger's Phase 0 assumption mapping forced reasoning about the full adoption chain: pharmaceutical clinical trial data submitted to the FDA must meet 21 CFR Part 11 and GxP compliance standards, meaning pharma companies cannot substitute an unvalidated diagnostic platform into a trial without potentially invalidating years of trial data — regardless of whether the technology works. That's not "Theranos needs FDA clearance." It's "your customer's own regulatory obligations make adoption structurally impossible." On the API key proposal, Decision Challenger identified that the auth layer assumption conflated two different security threat profiles — internal provisioning versus customer-facing self-serve — in a way neither baseline condition caught.

**The output format is the real differentiator.** Raw Claude renders a verdict. Decision Challenger produces a structured artifact with resolution paths. The `would_update_if` field has no equivalent in raw Claude output. The `accepted_cost` field creates an explicit record of what a team is agreeing to absorb. One you read and close. One you attach to a ticket and act on.

### Study 2 — Professional Mode: Consistency Testing

I ran Decision Challenger three times on the Theranos document with identical inputs and measured which objections appeared consistently using both keyword clustering and semantic deduplication (a second Claude call comparing objection titles pairwise).

*Before forced concern categories:* 50% semantic consistency, 1 noise objection.  
*After adding mandatory concern categories at HIGH stakes:* 75% semantic consistency, 0 noise objections. +25pp delta.

The improvement loop is clean: identify a failure mode (margin/pricing incoherence appearing in only 1 of 3 runs), design a targeted fix (force financial coherence as a mandatory concern category), measure the result. The deeper finding: Decision Challenger exhibits two distinct reliability tiers. **Structural document gaps** — things the document simply fails to address — surface deterministically across every run. **Analytical derivations** — objections requiring inference — surface probabilistically and compete for output slots. Forced categories convert high-priority analytical derivations from probabilistic to mandatory.

### Study 3 — Consumer Mode: Five Real-World Decision Documents

To test whether the capability transfers to personal decisions, I built five consumer test cases — realistic decision documents written the way real people actually write when thinking through high-stakes choices. Each uses real data (actual 2006 Phoenix home prices, actual MBA tuition and salary data, actual NYC childcare costs) and contains specific structural flaws with defined ground truth for evaluation.

**Test cases:**

| Document | Decision | Ground Truth Type | Target Finding |
|---|---|---|---|
| Phoenix house purchase, 2006 | Should we buy at $289K? | Structural correlation | Housing crash and job loss are treated as independent risks with separate mitigations, but they are causally linked |
| Startup offer | Should I leave Google for a Series A legaltech startup? | Factual (postmortem) | The go-to-market mechanism framed as a strength was the fatal flaw |
| Relocation | Should we move from Austin to NYC? | Dependency | Partner's career impact treated as independent of the relocation when it's a correlated variable |
| MBA | Should I leave fintech PM for Booth MBA? | Analytical omission | ROI compares post-MBA salary to current salary, not to projected salary without MBA |
| Baby timing | Should we have a baby now or wait two years? | Framing bias | "Wait" is treated as costless default; "now" carries burden of justification |

Each was run through the same three-condition comparison as the professional tests. Results:

| Case | Raw Claude | Light Prompt | Decision Challenger |
|---|---|---|---|
| House purchase (2006) | no | partial | partial |
| Startup offer | yes | yes | yes |
| MBA decision | yes | no | no |
| Relocation | yes | yes | yes |
| Baby timing | no | partial | **yes** |

**Finding 6: Decision Challenger's structural advantage transfers to personal decisions — and the strongest result is on the hardest case.**

The baby timing document is the most emotionally complex test case: no financial ground truth, no "right answer," and a document that subtly privileges one option while appearing balanced. Raw Claude produced a thoughtful, empathetic essay that validated both sides — good advice, but it mirrored the document's own framing rather than challenging it. The light prompt caught the fertility underweighting but missed the framing bias.

Decision Challenger's Assumption 5 identified that the document treats "wait" as the costless default requiring no justification while "now" carries the burden of disruption — then called out that this framing is itself a load-bearing structural choice, not a neutral observation. Its Objection 4 caught that the person says she can't articulate what she's waiting for, yet built an elaborate justification for waiting — and named that pattern as anxiety management rather than optimization: "When a person cannot name what they are waiting for, but has built an elaborate structure around waiting, the structure is more likely performing the function of managing anxiety than resolving a genuine optimization problem."

That's a finding raw Claude can't produce because raw Claude mirrors the document's frame. Decision Challenger's grounding requirement forced it to read the document's own language as evidence of a structural pattern rather than taking the framing at face value.

**Finding 7: The grounding requirement creates a characterized blind spot for analytical omissions.**

The MBA case is the honest negative result. Raw Claude caught the counterfactual baseline error — the document compares post-MBA salary to current salary rather than to projected salary growth without the MBA. Decision Challenger didn't find it.

This is a genuine design tradeoff, not a bug. The grounding requirement forces every objection to cite a verbatim quote from the document, which is what makes Decision Challenger's objections feel credible and derived rather than generic. But the MBA error is an analytical omission — the document never mentions the counterfactual comparison, so there's no quote to ground an objection in. The error is the *absence* of an analysis, not a flaw in a stated claim.

The fix follows the same pattern as forced concern categories in professional mode: a consumer-mode forced category for "counterfactual comparison" would make Decision Challenger check whether the document's decision math compares against the right baseline, regardless of whether the document raises it. That design iteration hasn't been implemented yet — but the architectural pattern is already validated.

**Finding 8: The house purchase case reveals partial but real structural detection.**

Decision Challenger scored "partial" on the assumption correlation target — it surfaced income disruption correlated with housing stress but didn't consistently lead with the full causal chain (housing crash → local job losses → both mitigations fail simultaneously). In Run 1, Objection 3 nailed it precisely: "Municipal infrastructure contracts are directly downstream of local government budgets, which contract sharply during housing downturns as property tax revenue falls. Banner Health's administration headcount is similarly sensitive to a regional economic slowdown. The two income streams are not as independent as they appear." In Runs 2 and 3, this finding appeared but wasn't the lead objection, competing for output slots with other valid concerns.

This is the same slot competition problem identified in Study 2 with the Theranos margin/pricing concern. The finding is in the system — it surfaces in some runs — but it's probabilistic rather than deterministic. It confirms that the forced category mechanism, while effective for professional mode, needs consumer-specific categories to ensure structural correlation detection doesn't get crowded out.

### Study 4 — Consumer Mode: Consistency Testing

I ran Decision Challenger three times on each consumer document with identical inputs, applying the same keyword clustering and semantic deduplication methodology from Study 2.

| Case | Keyword Consistency | Semantic Consistency | Language Variance | Noise Objections |
|---|---|---|---|---|
| House purchase (2006) | 20% | 100% | +80pp | 0 |
| Startup offer | 60% | 60% | 0pp | 0 |
| Relocation | 50% | 100% | +50pp | 0 |
| MBA decision | 50% | 20% | −30pp | 2 |
| Baby timing | 100% | 100% | 0pp | 0 |

**Finding 9: Consistency improves on emotionally loaded documents.**

The baby timing case — the most emotionally complex document — hit 100% consistency on both keyword and semantic measures. Every run found the same four concerns with nearly identical language. The house purchase case hit 100% semantic with high language variance (+80pp), meaning the model found the same concerns every time but phrased them differently. Zero noise objections across both.

The hypothesis: documents with strong emotional framing produce more stable assumption maps because the assumptions are more visible — the motivated reasoning, the selective emphasis, the unstated preferences all create clear structural signatures that Phase 0 locks onto consistently. This is stated as a hypothesis, not a conclusion — five test cases isn't enough to confirm it.

**Finding 10: The MBA case confirms the two-tier reliability model extends to consumer documents.**

The MBA case hit 20% semantic consistency with 2 noise objections and a negative language variance score (−30pp, meaning keyword clustering was overcounting). This is the weakest result in the consumer suite, and it's instructive. The MBA document has genuinely ambiguous tradeoffs with multiple plausible analytical entry points. Unlike the baby timing document, where the structural bias is clear, the MBA document's central flaw is an omission — and omissions produce less stable objection sets because the model finds different things to say about what isn't there.

This extends the two-tier finding from Study 2: structural gaps and framing biases surface deterministically; analytical omissions surface probabilistically. The consumer mode needs its own forced category architecture — not the professional mode's categories (financial coherence, regulatory pathway, traction verifiability) but consumer-appropriate ones like counterfactual comparison, reversibility stress-test, and stated-vs-actual motivation analysis.

### The Targeting Insight

The most interesting thing I learned across both modes wasn't about output quality. It was about when people accept being challenged.

Resistance to AI challenge correlates strongly with decision stage — people accept pushback when stakes are high and they're genuinely uncertain; they reject it when they've already decided and are seeking confirmation. That's not a product failure. It's a targeting constraint. Decision Challenger isn't for every decision. It's for the specific moment before someone commits, when they privately know there are open questions they haven't fully resolved.

In professional mode, that moment is ticket creation. In consumer mode, it's harder to identify — but the baby timing document suggests the signal is when someone writes out their reasoning and the document itself reveals ambivalence. The person who wrote "I think I want to wait. But I notice I can't fully articulate what I'm waiting for" is the ideal user. The person who has already signed the mortgage is not.

---

## Architecture

```
src/
  components/
    IntakeView.jsx        # Mode toggle (team/personal), document paste, stakes selector
    SessionView.jsx       # Phase 0-2: assumption map confirmation + objection cards
    ObjectionCard.jsx     # Per-objection counter/accept/skip + verdict display
    BriefView.jsx         # Phase 3: pre-commit brief or decision record
  lib/
    prompts.js            # System prompts for both modes — the actual product
    api.js                # Anthropic client, sendMessage, parseJSON
  App.jsx                 # State machine: intake → session → brief

docs/
  theranos-2006-testcase-comparison.json     # Three-condition comparison output
  theranos-2006-testcase-consistency.json    # Consistency test with semantic dedup
  comparison.json                            # API key proposal comparison
  consumer/
    house-phoenix-2006.txt                   # 2006 home purchase analysis (real data)
    startup-offer-2019.txt                   # Google → legaltech startup decision
    relocation-austin-nyc.txt                # Austin to NYC relocation analysis
    mba-decision.txt                         # Booth MBA decision with ROI math
    baby-timing.txt                          # Baby now vs. wait two years
    *-comparison.json                        # Three-condition comparison per case
    *-consistency.json                       # Consistency test per case
    evaluation-summary.json                  # Ground truth evaluation results
    evaluation-summary.md                    # Human-readable evaluation
```

The system prompt in [src/lib/prompts.js](src/lib/prompts.js) is the meaningful artifact. `buildSystemPrompt(stakes, mode)` returns either the professional or consumer prompt. The phase structure, the `holds` logic, the forced concern categories at HIGH stakes, and the `would_update_if` constraint are all there. Reading it is faster than reading this README for understanding how the product actually works.

---

## Running It

```bash
npm install
ANTHROPIC_API_KEY=your_key npm run dev
```

To run the comparison and consistency tests:

```bash
# Professional mode tests
ANTHROPIC_API_KEY=your_key node test-prompts.js
ANTHROPIC_API_KEY=your_key node test-consistency.js

# Consumer mode tests (five real-world decision documents)
ANTHROPIC_API_KEY=your_key node test-consumer.js
ANTHROPIC_API_KEY=your_key node test-consumer-consistency.js
ANTHROPIC_API_KEY=your_key node test-consumer-eval.js
```

Test outputs write to `docs/`. Consumer test outputs write to `docs/consumer/`. Swap in any proposal or decision document — paste text, select mode, set stakes, run.

---

## What I'd Build Next

The consumer testing answered several open questions from the first version of this prototype. Some are resolved; others are sharper now.

**Resolved: the capability transfers to personal decisions.** The baby timing case — 100% consistency, framing bias detection that neither baseline condition caught — demonstrates that the phase structure and grounding requirement work on emotionally complex, ambiguous documents, not just structured proposals with clear analytical flaws. The consumer mode isn't a stretch from the professional mode. It's a natural extension.

**Resolved: where the system breaks.** The MBA case identified a specific, characterized failure mode: the grounding requirement makes Decision Challenger blind to errors of omission. When a document's flaw is something it *doesn't say* — a missing counterfactual comparison, an unmodeled alternative — there's no verbatim quote to anchor an objection to. The fix is the same architectural pattern that works in professional mode: forced concern categories tuned to the consumer domain (counterfactual comparison, reversibility stress-test, stated-vs-actual motivation). That design iteration is next.

**Open: does the decision record change behavior over time?** The consumer mode's long-term value depends on whether people return to the artifact. The `accepted_cost` from a baby timing session — "you are implicitly agreeing to defer a decision you have already emotionally made, for reasons that will keep shifting forward" — is designed to be confronted six months later, not just read once. Testing this requires persistence and accounts, which is a different product surface.

**Open: the holds behavior under emotional pushback.** The consumer consistency and comparison tests evaluate Phase 0 and Phase 1 output. Phase 2 — the challenge session where the user pushes back and Decision Challenger holds or updates — hasn't been systematically tested in the consumer context. The baby timing case is the ideal test: someone responding to Objection 4 ("stated logic may be rationalizing avoidance") with "I'm not avoiding, I'm being responsible" would test whether the holds logic distinguishes emotional persistence from new information in a domain where the line is genuinely hard to draw.

**Open: consumer-mode forced categories.** The professional mode forces financial coherence, regulatory pathway, and traction verifiability at HIGH stakes. The consumer equivalent — counterfactual comparison, reversibility, stated-vs-actual motivation — hasn't been implemented or tested. The MBA result suggests this is where the next measurable improvement will come from.

---

## On Using Claude to Build This

This prototype was built using Claude Code. The irony of using Claude to build a tool that challenges Claude's tendency toward agreeableness was not lost on me — and it turned out to be methodologically useful. The hardest part of the system prompt design was engineering the `holds` behavior against a model that wants to be helpful. Building with Claude Code made it immediately visible when the prompt was too weak: Claude would write compliant-looking code that validated the output schema but failed to actually hold position under test. The gap between schema compliance and behavioral reliability is where most of the iteration happened.

That experience is part of what I'd bring to consumer product work: I know where the prompt engineering work actually lives, and it's not where it looks like it is from the outside.

---

*Built by James Bryant — Tampa, FL*  
*May 2026*
