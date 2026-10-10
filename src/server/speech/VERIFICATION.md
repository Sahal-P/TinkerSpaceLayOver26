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
