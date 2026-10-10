# Voice guidance verification

2026-10-11. Live checks used scripted public directions, existing Gemini configuration and
approved ADC; no real recording, credential, raw provider exception or full translation was logged.
Audio artifacts are outside Git in `~/.local/share/local-to-lens-verification/voice-guidance`,
directory 0700 and files 0600. This is integration evidence, not native-speaker acoustic acceptance.

## Bounded live calls

Six TTS attempts and four translation calls were used. No automated provider retries were made.
The English clear retry was explicit; failed translations were not synthesized.

| Sample | Translation | Speech |
| --- | --- | --- |
| English clear, `200 meters` / `tea shop` | Canonical English | First attempt timed out safely; explicit retry returned WAV (301,796 bytes) |
| English uncertain, prohibited straight / alternative turn / bridge | Canonical English | 200; valid non-silent WAV, 8.800 s |
| Hindi clear | 200; distance/nulls/names/quantity guards passed | 200; valid WAV, 5.920 s |
| Hindi uncertain | 200; one warning and negation/uncertainty guards passed | 200; valid WAV, 10.880 s |
| Malayalam clear | 200; distance/nulls/names/quantity guards passed | 200; valid WAV, 6.080 s |
| Malayalam uncertain | 502 `invalid_speech_output` | No synthesis; translation failed conservative validation |

Safe request IDs:

- English timeout: `b4285437-504d-4eae-827c-32ea61e0da3e`
- English clear retry: `eaf04c51-abfc-4244-8b3c-3ebda8af8bf6`
- English uncertain audio: `72e47c38-bb9e-4617-8a21-d4fa84c3d7d5`
- Hindi clear translation/audio: `287d2ddd-7a21-4484-803f-d98a74336c7b`, `a34072d8-aca4-4acb-acae-1b3e3a1ead94`
- Hindi uncertain translation/audio: `d78e8901-aac0-4b12-b465-4a2e188f1ff8`, `e5847dfd-e579-4e1c-8cfd-110bec2ca3c2`
- Malayalam clear translation/audio: `10dca11d-0f50-4ef3-9e14-f9d2b27ccbba`, `fb5b886a-7212-444a-89f8-f4a2cc262437`
- Malayalam uncertain rejected translation: `22075fe9-6320-4f12-b437-62fea9433595`

The rejected Malayalam translation's content was not retained. A native speaker should review
translation naturalness, pronunciation and uncertainty fidelity in a separately authorized batch.
Do not loosen guards to force a pass without reproducing the reason.
Physical Safari playback/autoplay behavior is still pending. Automated WebKit checks use mocked
services. Native browser inspection confirmed the guide controls without spending further TTS calls.

## Automated and browser checks

- Lint, typecheck and production build pass.
- Vitest: 258 tests / 33 files pass, with SDK mocks and no live service calls.
- Browser suite: 74 pass; two existing WebKit microphone cases remain explicitly skipped.
- Chrome and WebKit cover phone/desktop voice controls, replay cache, translated preview, quota
  cooldown, cancellation, processing loader, reduced motion and overflow; APIs are intercepted.
- Source and built client-bundle scans found no configured secrets.
- The scene modules and package/lockfile were unchanged; root untracked audio files were preserved.

Live results above predate the final additional turn/alternative-word guards. Those stricter checks
were tested with mocks; no further live calls were made after the six-TTS/four-translation budget.


## Malayalam narration and model follow-up — 2026-10-11

The user selected `gemini-2.5-flash-preview-tts` after the exact requested Cloud TTS model,
`gemini-2.5-flash-lite-preview-tts`, returned 404 through the Gemini API. Read-only metadata
confirmed the selected model supports `generateContent`. No Cloud TTS API, billing change,
service-account key or alternate-model fallback was introduced.

### Corrections

- Generated review annotations are excluded from translation, audio text and voice previews.
  Canonical guide/step warnings stay visible and unchanged. Spoken hedges/negation remain narrated.
- Revision 2 cache keys prevent reuse of narration containing old review annotations.
- Malayalam negative suffixes such as `ചെയ്തിട്ടില്ല` are recognized, with a word-ending check to
  avoid treating `വില്ലേജ്` as negation. Explicit “maybe”/“think” require matching hedge markers;
  affirmative turns, changed quantities/names and dropped uncertainty still fail validation.
- Common Hindi nasal spellings `बाएं`/`दाएं` have regression coverage; opposite turns still fail.
- Speech diagnostics contain fixed stage/reason codes, whitelisted field paths and request IDs,
  never narration, audio, model responses, credentials or raw provider exceptions.
- Gemini 2.5 synthesis uses audio-only `models.generateContent`, prebuilt Kore, no thinking or
  structured-output options, and no SDK retries. Valid 24 kHz mono signed little-endian PCM is
  wrapped in WAV without modifying samples, then inspected before delivery/playback.
- Language is automatically detected from the translated text; the prompt gives a language cue.
  A concise verbatim-read prompt replaces the previous JSON-quoted transcript/instruction format.

### Bounded live results

Four speech requests and four translation requests were used (one English speech request;
Hindi translation; three Malayalam browser translation/speech attempts). No further live requests
were made. All calls used existing configuration and the real protected API, with explicit retries.

| Check | Result |
| --- | --- |
| English speech | 200; valid non-silent WAV, 190,650 bytes, 24 kHz, 3.971 s; request `f934a4f4-2433-4932-b657-0d77d17361f2` |
| Hindi translation | Rejected by direction-word guard; request `edcbe618-c217-4d04-9f0b-defe91de7b35`. Nasal-spelling regression correction passes mocked checks; no live Hindi retry was spent. Exact discarded response was not retained. |
| Malayalam browser attempt 1 | Translation passed; synthesis rejected incomplete/unsupported response structure; request `1416d56a-9a01-4207-ac9f-39861e628c21` |
| Malayalam browser attempt 2 | Translation passed; model stopped with `OTHER`, rejected before playback; request `b284e5ad-fc93-4e84-ad28-2a0ac8ee46ba` |
| Malayalam browser attempt 3 | Passed after automatic language detection and concise transcript prompt. Actual Chrome playback completed, Replay step appeared, no alert, Malayalam voice preview visible; route warnings remained on screen. Successful request IDs are not rendered by the voice controls and were not retained. |

The final successful check verifies the selected model, real API delivery, WAV decoding and Chrome
playback for one clear Malayalam guide instruction. It does not establish which of the two request
changes individually resolved the model's earlier `OTHER` stop, nor guarantee model availability
or pronunciation accuracy. The original screenshot request `60df8870-7801-41fa-8d4c-103db22a899e`
was not retained, so its precise past rejection cannot be claimed. Known validation gaps are covered
with mocked regressions; live Malayalam negation/uncertainty and a live Hindi rerun remain pending.
Native-speaker acoustic review and physical iPhone Safari remain pending.

### Verification

Lint, typecheck, unit tests and production build pass. Unit suite: 303 tests in 36 files.
Browser suite: 82 pass / two existing WebKit microphone skips, across Chrome/WebKit phone and desktop.
APIs are mocked in automated tests. They cover Malayalam voice previews, warning omission with
on-screen retention, replay caching, failure/cooldown behavior, processing loader and cancellation.
The complete browser suite was rerun against the final production build with the final prompt,
model diagnostics, punctuation separator and enabled-voice status copy.
The final punctuation-only section separator avoids doubled sentence punctuation without editing
canonical instructions. It was verified with mocks, without exceeding the live request budget.
