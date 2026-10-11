# Complete navigation instruction correction

2026-10-11. This correction reproduces the screenshot's Hindi “वहाँ पहुँचकर” / “After reaching
there” fragment with a mocked provider response. It does not replay or claim a new accuracy check
of the original ElevenLabs recording.

## Cause

The extraction prompt favored the smallest clause. The direction guard accepted any `reaching`
word as arrival evidence, even in a dependent phrase with no action, landmark or distance.
Consequently a transition could become a high-confidence arrival card. The old evidence contract
also limited quotes to one transcript segment, encouraging overly narrow clauses.

## Correction

- Ask transcription/extraction for complete spoken actions, retaining transport, stop names,
  boarding/alighting, landmarks, quantities, conditions and sequence details.
- Combine a fact-free transition with its adjacent actionable quote only when both languages
  have a punctuation/space-only gap. All original words and punctuation remain exact source text.
- Verify every raw claim and ordered paired evidence before combining/removing a transition.
  Quotes spanning adjacent segments must cover matching segments in both languages. They cannot
  skip intervening words, mismatch translations, reuse evidence or invent timestamps.
- Reject standalone transition cards at canonical request/model/Firestore-read boundaries.
  Keep a dangling fact-free transition in the transcript with an incomplete-route warning;
  factual references on an unmatched transition cannot be silently dropped.
- Conditional reaching/arrival is not an arrival action. A gerund with explicit stopping, such
  as “After reaching the clinic, stop”, remains supported. “End of the street” is not route completion.
- An unnamed place reference stays low confidence and requires review. Do not substitute an
  earlier landmark by guessing. Ordinary existential “there are” wording is not a place reference.
- Check the last step for final arrival, rather than letting an intermediate arrival hide missing
  destination details. Confirmation never upgrades confidence or removes warnings.

## Regression example (synthetic fixture, not the user's actual route)

Before: a separate “After reaching there” arrival card.

After: “After reaching there, turn left at the bridge and walk two hundred meters.” The complete
quoted Hindi action, bridge, 200-meter reference, turn, low confidence and unresolved-place warning
survive extraction, review and guide. There is no fabricated place name replacing “there”.

Fixture: `contextualHindiFixture` from `@/contracts/fixtures`.

## Verification and limits

Lint, typecheck, unit tests and production build pass. Combined unit suite: 338 tests / 37 files (including the Vercel keyless Firestore changes).
Chrome/WebKit phone and desktop checks cover the complete action, distance, Hindi evidence and
uncertainty after confirmation, alongside existing upload, review, voice and processing-loader checks.
Final browser suite: 86 passed / two existing WebKit microphone skips, across all four projects.
Initial browser regression runs exposed test navigation before hydration and a check for warning
acknowledgement before the Review page mounted. The test now waits for Review/Guide content and
uses the accessible Next step control. A stale production process was also restarted after the
concurrent backend build changed its browser assets. The targeted four-project check passes.

No additional live Gemini extraction request was spent. Grounding is against the model transcript;
transcription/translation accuracy and natural phrasing still need human review. Existing in-memory
routes are not silently rewritten: reprocess the clip to apply the corrected pipeline.

Generated verification WAVs were removed from the current Git index and added to `.gitignore`;
local copies are preserved. They had already been committed in `dd02a7c`; history was not rewritten.
No private recordings, credentials, model responses or raw provider errors were added.
