# Controlled live audio verification

Automated tests use mocked services. This checklist is for explicit, bounded live verification.
Record only with permission. Do not commit recordings, credentials, or full live transcripts.
Local paths to clips/credentials may be provided; never paste private-key contents into chat.

## Prerequisites

- Integration worktree, valid server Gemini configuration, and approved Firebase ADC/IAM access.
- `APP_ORIGIN` exactly matches the running origin. Microphone access requires localhost or HTTPS.
- Chrome on the Mac, and a physical iPhone running Safari at a reachable trusted HTTPS origin.
- A consenting speaker who reviews the Malayalam/Hindi scripts for natural wording.
- No billing changes, generated service-account keys, deployment, or new cloud services.

## Scripts and expected facts

**English:** Start at the bus stop. Go straight for two hundred meters past the tea shop.
Turn left at the bridge. Arrive at the clinic.

**Malayalam:** ബസ് സ്റ്റോപ്പിൽ നിന്ന് തുടങ്ങുക. ചായക്കട കടന്ന് ഇരുനൂറ് മീറ്റർ നേരെ പോകുക.
പാലത്തിൽ ഇടത്തോട്ട് തിരിയുക. ക്ലിനിക്കിൽ എത്തുക.

**Hindi:** बस स्टॉप से शुरू करें। चाय की दुकान के पास दो सौ मीटर सीधे चलें।
पुल पर बाएँ मुड़ें। क्लिनिक पर पहुँचें।

**Mixed:** ബസ് സ്റ്റോപ്പിൽ നിന്ന് തുടങ്ങുക. चाय की दुकान के पास दो सौ मीटर सीधे चलें।
Turn left at the bridge. Arrive at the clinic.

For these four scripts, expected order: start/bus stop → straight/tea shop/200 meters →
left/bridge → arrival/clinic. All other distances remain null. No GPS, walking estimates,
city, or speaker identity may be inferred. Language hints must not override detection.

**Ambiguous:** Start at the bus stop. Do not go straight. Turn left or turn right at the bridge,
I am not sure. Walk three to five meters. The clinic is not the destination.

Expected: no positive straight claim from the prohibition; contradictory turn unknown/low and
flagged; range meters null; no affirmative clinic arrival. A fail-closed validation error is also
acceptable for unsupported affirmative model claims; it must never reveal invented directions.

**Negative case:** Record at least two seconds of silence, or say: "The weather is pleasant today."
Expected: no_speech or not_directions, with no guide and no demo fallback.

## Procedure (maximum eight initial API attempts)

1. Record/play back/submit English in actual Chrome. Verify one extraction request.
2. Upload or capture the Malayalam, Hindi, and mixed scripts. Compare with the expected facts.
3. Run the ambiguous and negative cases. Observe safe errors or preserved warnings.
4. Use remaining attempts for physical iPhone Safari MP4 capture/playback/submission and format checks.
5. Respect rate-limit Retry-After; no automatic live retry loops. Stop after eight attempts or quota errors.
6. Check Review edits, blank distances, acknowledgement, Guide warnings, and live Lens/Share unavailable states.
7. Reset and reload. Verify microphone tracks stopped and temporary audio/guide state cleared.

Record only date/browser/container, pass/fail against expected facts, safe error code, and request ID.
Missing consented speech clips, reachable HTTPS, or a connected iPhone keeps live acceptance pending.

## Recorded checks (2026-10-11)

Local keyless ADC token acquisition and a read-only Firestore probe succeeded. No credential,
document content, transcript, or personal recording was printed or committed.

| Extraction attempt | Input / path | Result |
| --- | --- | --- |
| 1 | Synthetic two-second WAV, browser, before ADC | `storage_unavailable`; no model call; request `fa65edb7-6bce-474a-8569-1e2c2131360b` |
| 2 | Same exact-silence WAV, browser, after ADC | `unsupported_language`; model reached; no guide; request `ff778c57-0fe8-4325-83d4-0436fd81186a` |
| 3 | One bounded server diagnostic replay | Transcription incorrectly marked silence as English speech; extraction failed `upstream_unavailable`; no guide |
| 4 | Same WAV, real browser endpoint after guard | `no_speech` before Gemini; no guide/fallback; request `f4839f62-3c2a-4744-b7ba-bbeeb4645d8d` |

Only structural metadata was inspected during the diagnostic; no model transcript was logged.
Exact digital silence in PCM now has a deterministic guard. Compressed silence, ambient noise,
real multilingual accuracy and successful live guide extraction still require controlled checks.
The manual uploads used the in-app browser because Chrome extension file-URL upload access is off.
The automated Chrome recorder checks use fake input; they do not verify microphone acoustics.
Four of the eight initial extraction attempts are recorded above. Use the remaining budget for
consented speech samples, then review results before authorizing a further verification batch.
