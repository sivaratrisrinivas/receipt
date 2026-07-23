---
name: Receipt
description: Calm, trustworthy proof for consequential AI-agent claims
---

<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Receipt

## 1. Overview

**Creative North Star: "The Quiet Instrument"**

Receipt should feel like a precise instrument placed inside an ordinary conversation: immediately readable in daylight on a phone or laptop, calm when the answer is uncertain, and exact when a customer needs to act. Its hierarchy takes cues from Stripe Dashboard, its investigation flow from Linear, and its plain-language discipline from GOV.UK service pages.

The interface is restrained and product-led. A pure-white canvas and quiet neutral layers keep attention on the Claim, Verification Verdict, reason, and next action. Mineral sage or lichen green supplies a scarce brand signature without impersonating a success state. Motion is responsive rather than theatrical: quick feedback and state transitions, never an entrance sequence users must watch.

Receipt must never feel like Etherscan. Dense tables, unexplained identifiers, and proof machinery stay out of the customer-facing path. Deeper evidence appears only when an investigator asks for it.

**Key Characteristics:**

- Quiet, daylight-first surfaces
- Consequence before technical detail
- Compact, familiar product interactions
- Brand color kept separate from verdict meaning
- Fast state feedback with a reduced-motion equivalent

## 2. Colors

The palette is a restrained daylight system: neutral architecture, a scarce mineral-green signature, and independent semantic colors for verdicts.

### Primary

- **Mineral Lichen** (`[to be resolved during implementation]`): the brand anchor for primary actions, current selection, focus, and small identifying moments. It is not the universal color for `PROVEN`.

### Neutral

- **Clear Daylight** (`[to be resolved during implementation]`): the pure-white application background.
- **Instrument Surface** (`[to be resolved during implementation]`): the quiet secondary layer for Proof Cards, Evidence Views, toolbars, and grouped controls.
- **Evidence Ink** (`[to be resolved during implementation]`): the main text color, composed to reach at least 7:1 contrast against Clear Daylight.
- **Measured Muted** (`[to be resolved during implementation]`): secondary text that remains readable and reaches at least 4.5:1 contrast against its background.

Semantic colors for `PROVEN`, `FALSE_SUCCESS`, `PENDING`, and `INCONCLUSIVE` remain `[to be resolved during implementation]`. Every verdict must also use a text label and, where useful, a distinct icon or shape.

### Named Rules

**The Restrained Rule.** Mineral Lichen occupies no more than 10% of a screen. Its rarity gives it authority.

**The Daylight Canvas Rule.** The main background is pure white, not cream, beige, sand, or a secretly warm near-white.

**The Verdict Separation Rule.** Brand color and semantic status color are separate systems. A green brand mark must never make an unresolved Claim look proven.

## 3. Typography

**Display Font:** `[single humanist sans-serif family to be chosen at implementation]`
**Body Font:** `[same family to be chosen at implementation]`
**Label/Mono Font:** `[a separate mono is not yet justified; tabular numerals must be supported]`

**Character:** One humanist sans-serif family carries the whole product. It should be highly readable and approachable without feeling casual, with distinct letterforms and clear tabular numbers for timestamps, amounts, identifiers, and evidence data.

### Hierarchy

- **Display** (`[weight and fixed size to be resolved during implementation]`): rare; reserved for the main page purpose, never routine product chrome.
- **Headline** (`[weight and fixed size to be resolved during implementation]`): names the Claim or investigation section without shouting.
- **Title** (`[weight and fixed size to be resolved during implementation]`): labels Proof Cards, Evidence View groups, and next actions.
- **Body** (`[weight and fixed size to be resolved during implementation]`): explains verdicts in plain language; prose is capped at 65–75 characters per line.
- **Label** (`[weight, fixed size, and spacing to be resolved during implementation]`): names controls, timestamps, and evidence fields in sentence case.

### Named Rules

**The One Voice Rule.** One family serves headings, controls, body copy, and data. Hierarchy comes from weight and size, not competing typefaces.

**The Plain Status Rule.** Verdict labels are ordinary readable words, never tiny uppercase codes or decorative technical shorthand.

## 4. Elevation

Receipt is flat by default. Tonal surface changes, grouping, and spacing create structure; shadows are reserved for a real temporary layer such as a popover, menu, or dialog and will be defined only when those components exist.

### Named Rules

**The Evidence Layer Rule.** Deeper evidence becomes more detailed, not more decorated. Never communicate investigative depth by stacking nested cards.

**The State-Only Motion Rule.** Motion explains a state change or interaction response. It never decorates a page load, and every transition has an instant or simple crossfade reduced-motion equivalent.

## 5. Proof Card

The customer-facing Proof Card follows one fixed reading order:

1. Verdict icon, plain-language label, and short conclusion
2. Safe Claim Summary and impact amount
3. Plain-language reason grounded in the Payment Ledger
4. Customer Guidance
5. Last-check time plus the applicable Completion Deadline or monitoring end
6. A short, customer-safe Receipt reference

Raw identifiers, technical telemetry, Evidence Trail Health, and SigNoz links never appear in the customer view. The original agent message remains owned and displayed by the surrounding support-agent product rather than being copied into Receipt. A clearly labeled **Open Evidence View** control appears only in Investigator mode.

### Named Rules

**The Verdict-First Rule.** A customer must not read technical evidence before learning whether the promised outcome is proven and what to do next.

**The One-Claim Rule.** Every Proof Card represents exactly one Claim, even when several cards are grouped beneath the same message or real-world outcome.

## 6. Evidence View

The Investigator-only Evidence View follows one fixed investigation order:

1. Claim, current Verification Verdict, impact, and Receipt reference
2. Payment Ledger state, observation time, and plain-language explanation of why it produced the verdict
3. Verdict History with the reason and time of each transition
4. Claim Type, immutable Contract Version, Completion Deadline, and Monitoring Window
5. Evidence Trail Health showing expected and observed agent, tool, refund-service, ledger-check, and notification signals
6. A privacy-safe, time-ordered correlated event timeline
7. Masked Claim, refund, Message Reference, and trace identifiers with deliberate copy controls
8. A recorded **Recheck now** control for an already recognized Claim
9. A clearly labeled link to open the complete raw trace in SigNoz

The Evidence View never contains raw conversation text. Authoritative Evidence always precedes telemetry so an incomplete trace cannot be mistaken for a missing real-world outcome.
Recheck performs a fresh authoritative read but never lets the Investigator select or override its result. It is unavailable for an Unresolved Claim.

### Named Rules

**The Judgment-Before-Diagnostics Rule.** Explain the authoritative check and Completion Contract result before exposing trace completeness or service activity.

**The Deliberate-Escape Rule.** Opening SigNoz is an explicit transition from Receipt’s structured explanation into the raw technical investigation surface.

## 7. Do's and Don'ts

### Do:

- **Do** make the Claim, Verification Verdict, reason, and next action understandable within ten seconds.
- **Do** keep the pure-white canvas and restrained Mineral Lichen signature distinct from semantic verdict colors.
- **Do** use familiar product controls, visible keyboard focus, readable status text, and plain-language explanations.
- **Do** reveal technical evidence progressively, from Proof Card to Evidence View to the complete SigNoz trace.
- **Do** use quick feedback and state transitions without choreography.

### Don't:

- **Don't** resemble a generic AI chatbot; the Proof Card is evidence attached to a promise, not another chat response.
- **Don't** resemble a flashy hacker dashboard or use theatrical motion, glowing decoration, or terminal styling as a shortcut to technical credibility.
- **Don't** use crypto-style trust branding or make green decoration imply that a Claim is proven.
- **Don't** become a dense copy of SigNoz; customers should never need to read raw telemetry.
- **Don't** feel like Etherscan: no dense tables, unexplained identifiers, or technical proof machinery in the customer-facing path.
- **Don't** use gradient text, decorative glassmorphism, nested cards, oversized corner radii, or colored side-stripe borders.
