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
Missing ADC, consented speech clips, reachable HTTPS, or a connected iPhone keeps live acceptance pending.
