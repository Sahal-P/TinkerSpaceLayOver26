# Gemini and Firestore backend

The backend converts short Malayalam, Hindi, English, or mixed-language directions into a
source-grounded draft. All endpoints are same-origin Next.js Node route handlers. The browser uses
the API; server-rendered pages call repository functions directly. No client Firebase SDK is needed.

## Integration contract

Import schemas and inferred types from `@/contracts/guide` and upload constants from
`@/contracts/audio`. These modules and `@/contracts/fixtures` are client-safe and contain no SDKs
or secrets. UI view-models remain owned by the UI track.

Success: `{ data, requestId }`. Failure:
`{ error: { code, message, retryable }, requestId }`. `requestId` is a UUID and also appears in
`X-Request-Id`. Every handled response uses `Cache-Control: private, no-store, max-age=0`.
429 and temporary service failures include `Retry-After` when a retry interval is known.
Unsupported HTTP methods receive Next.js's default 405 response rather than this JSON envelope.

| Method / path | Input | Success |
| --- | --- | --- |
| POST `/api/directions/extract` | Multipart fields below | 200 `{ data: GuideDraft, requestId }` |
| POST `/api/guides` | JSON `{ guide: ReviewedGuide, confirmed: true }`; `Idempotency-Key` | 201 draft ID; 200 for identical retries, possibly published |
| GET `/api/guides/[id]` | Owner cookie optional | 200 private owner guide or published projection; 404 for unavailable/private guides |
| POST `/api/guides/[id]/publish` | JSON `{ acknowledgeWarnings: boolean }` | 200 `{ data: { id, status: "published", url }, requestId }` |
| POST `/api/guides/[id]/unpublish` | Empty body, or JSON `{}` | 200 `{ data: { id, status: "draft" }, requestId }` |
| DELETE `/api/guides/[id]` | Empty body, or JSON `{}` | 204; further deletes return 404 |

POST and DELETE requests require an `Origin` equal to `APP_ORIGIN` and reject `Sec-Fetch-Site:
cross-site`. Same-origin browser fetch/XHR adds these headers automatically. Use `credentials:
"same-origin"` and retain cookies for retries. Cross-origin API clients are deliberately unsupported.

### Upload

Exactly one `audio` file, `durationMs` (numeric string), `consent` (literal string `"true"`), and
optional `languageHint` (`"auto"`, or a Malayalam/Hindi/English BCP-47 code such as `ml-IN`).
Unknown and duplicate fields are rejected. The UI must obtain recording consent before sending.

- File maximum: **4 MiB** (4,194,304 bytes). Multipart body maximum: 4 MiB + 64 KiB.
- Duration: **2–120 seconds**, verified from actual media packets/metadata. Claimed `durationMs`
  must agree within one second. Unknown, empty, corrupt, unsupported or video-bearing files fail.
- Containers: WAV/PCM, MP3, M4A/MP4 AAC, Ogg/Opus or Vorbis, WebM/Opus, and FLAC. Browser codec
  MIME parameters are accepted. The file's real container must match the declared MIME.
- Bytes stay in request memory. No Firebase Storage, Gemini Files API, filesystem audio persistence,
  raw-audio response, or guide audio field is used. Buffers owned by the extraction handler are
  cleared after success or failure; provider/browser internal copies are outside that buffer's scope.
- Audio is sent to Google's Gemini API. Inline upload does not imply zero retention by Google;
  the Gemini account's applicable terms govern provider handling.
- Upload reading is bounded to 10 seconds, inspection to 5 seconds, Gemini processing to 45 seconds,
  and the extraction handler to a 58-second signal within a 60-second platform route budget.

```ts
const form = new FormData();
form.set("audio", audioBlob, "directions.webm");
form.set("languageHint", "auto");
form.set("durationMs", String(durationMs));
form.set("consent", "true");
const response = await fetch("/api/directions/extract", {
  method: "POST", credentials: "same-origin", body: form,
});
// Do not manually set Content-Type; the browser supplies the multipart boundary.
const result = extractionResponseSchema.parse(await response.json());
```

Check `response.ok` and validate the error envelope before parsing a success envelope.
No upload URL or download endpoint is exposed.

### Draft and review

`GuideDraft` includes:

- `version: 1`; optional user-provided `title`; detected BCP-47 language codes and categorical
  confidence; target language `"en"`.
- `transcript: { original, translation, segments }`. Each segment has an ID, original text,
  translated text and paired nullable `startSec/endSec`. The pipeline leaves timestamps null.
- An ordered list of 1–40 steps, guide warnings, and `needsReview`.

Each step has `id`, `instruction`, `direction`, `incline`, `landmark`, `distance`, `source`,
`evidence`, `confidence`, `warnings`, `needsReview`, and `reviewed`.

Direction values are `start`, `straight`, `slight_left`, `left`, `slight_right`, `right`, `u_turn`,
`arrive`, or `unknown`. Incline is `"up"`, `"down"`, or null. Landmark is `{ spoken, label }`,
with nulls for missing values. Distance is `{ spoken, meters }`; absent distance is **null, never 0**.
`confidence` is `"high"`, `"medium"`, or `"low"` and describes speech specificity, not a verified
real-world location.

Audio steps use `source: "audio"` with non-null `{ original, translation, startSec }` evidence.
The instruction must be the exact translated quote. Both quotes must occur in the same transcript
segment; source order is checked. Turn and incline values require explicit supporting English
words. Landmark phrases must occur in their respective evidence quotes. Unknown directions keep
low confidence, warnings, and `needsReview: true`.

Numeric meters are deterministically normalized from explicit English numeric or number-word
phrases with recognized meter/kilometer/foot/mile/yard units. Time, vague references, ranges,
alternatives and multiple distances retain `meters: null`. No coordinates, geocoding, walking
estimates, or 3D anchors are accepted.

Before saving, set `reviewed: true` on **every** step and send `confirmed: true`.
For a changed instruction, landmark, distance, turn, incline, or reordered source-derived step,
set `source: "user"` and `evidence: null`; give new steps a UUID. A user correction must not claim
audio provenance. Keep warnings/confidence when the user merely acknowledges uncertainty;
changing `reviewed` never upgrades confidence or clears `needsReview`.

All schemas are strict. UI fields such as `anchor`, `lookFor`, estimated walking time, speaker
identity, arbitrary metadata or GPS fail validation. The guide and creation request are bounded to
**128 KiB** JSON; strings and array counts are also bounded.

Use a stable random `Idempotency-Key` (16–128 base64url-safe characters, e.g. `crypto.randomUUID()`)
for retries of the same creation body. Generate a new key for a different body. Reusing a key with
a changed guide returns 409. The key is scoped to the signed owner session. If the initial HTTP
response/cookie is entirely lost, a new browser owner cannot deduplicate an old owner's request.

### Publishing and server pages

Guides start private. Publishing is an explicit owner action and requires
`acknowledgeWarnings: true` whenever uncertainty remains. Publishing does not erase warnings.
The share ID contains 128 random bits in 22 base64url characters. Anyone holding the published
URL can read it; it is an unlisted share link, not authentication.

Public projections contain confirmed steps and uncertainty but omit full transcripts, evidence,
owner hashes, credentials, idempotency metadata and audio. Original spoken landmark and distance
phrases remain as navigation references; review those before sharing. Owner GET responses include
the private reviewed draft. Do not put owner responses into shared caches.

```ts
import { getPublishedGuide } from "@/server/guides/repository";

// Inside the UI-owned /g/[id] Server Component:
const guide = await getPublishedGuide(id);
// Use notFound() for null, preserve warnings, and set noindex metadata.
// Keep the page dynamic and uncached: no "use cache", ISR, or static generation.
```

For owner views, `getViewerFromCookies()` from `@/server/session` verifies the cookie; pass that
result to `getGuideForViewer(id, viewer)`. Never accept viewer identity from a request body.
The UI agent builds `/g/[id]`; this track returns its canonical URL only.

Unpublishing makes subsequent public reads return null/404 immediately. Deletion removes both
the guide and creation-idempotency record in one transaction. Previously downloaded or copied
content cannot be revoked.

## Architecture and failures

`getGemini()` and `getDb()` remain the only SDK constructors. Server modules start with
`import "server-only"`. Thin routes use shared validation, errors, ownership and feature services.
Firestore documents and responses are validated before use.

Two model calls use `gemini-3.8-flash` by default with low thinking, bounded output and Zod-derived
JSON schemas: audio → original transcription/English translation → quoted navigation steps.
Audio/transcripts are untrusted prompt data; no grounding tools or external route knowledge are
enabled. Fenced JSON, extra fields, incomplete output and unsupported claims fail closed.
SDK retries are disabled; at most one 5xx transient retry is allowed across both stages.
429 quota errors are not retried immediately. Cancellation bounds the application's wait; Google
may still process and charge a request already received.

Grounding proves consistency against the **model transcript**, not perfect fidelity to the recording
or real-world route safety. A model can mistranscribe or mistranslate. Conservative guards may also
reject legitimate phrasing. Human review is required, and native-speaker live evaluation remains
necessary before launch. No blanket claim of hallucination-free speech recognition is made.

Firestore collections:

- `guides/{randomId}`: reviewed guide, status, ISO creation/publication timestamps, hashed owner,
  hashed idempotency record reference.
- `_guide_requests/{hash}`: hashed owner/key scope, body hash and guide ID for atomic deduplication.
- `_rate_limits/{scope}`: one rolling minute/day counter per operation/scope; UTC day windows.

Creation, publication and deletion use transactions. Backend reads are uncached. Storage waits
are capped at eight seconds. A write can commit after a client timeout; retry creation with the same
key/body, or repeat publication/unpublication. A repeated deletion can return 404.
Rate-limit failures deny service rather than bypassing ownership or budgets.

| Operation | Per session | Global |
| --- | --- | --- |
| Extraction | 3/minute, 20/UTC day | 200/UTC day |
| Guide mutations (including retry attempts) | 10/minute | 1,000/UTC day |
| Guide reads (owner/public, including missing valid IDs) | — | 5,000/UTC day |

Counters use transactions across instances. No raw IP or transcript is logged. Cookie reset cannot
bypass global ceilings, but a public unauthenticated API can be denied service by exhausting them;
stronger bot prevention is outside this track. Internal counter documents persist and reuse windows.
No TTL billing feature or cleanup infrastructure is enabled.

| HTTP | Error codes |
| --- | --- |
| 400 | `invalid_request`, `consent_required` |
| 403 | `forbidden_origin` |
| 404 | `not_found` |
| 409 | `idempotency_conflict` |
| 413 | `audio_too_large`, `request_too_large` |
| 415 | `unsupported_media_type` |
| 422 | `invalid_audio`, `audio_too_short`, `audio_too_long`, `unsupported_language`, `no_speech`, `not_directions`, `audio_unprocessable`, `confirmation_required` |
| 429 | `rate_limited` |
| 502 | `invalid_model_output` |
| 503 | `service_misconfigured`, `storage_unavailable`, `upstream_quota_exceeded`, `upstream_unavailable` |
| 504 | `request_timeout` |
| 500 | `internal_error` (curated message only) |

Never display provider exceptions, schema input values, credential errors or raw SDK messages.
Correlation IDs are safe for support; recordings, transcripts and secrets must not enter logs.

## Environment and deployment

Configuration is parsed lazily; lint/tests/build require no production credentials.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server Gemini key, required for extraction |
| `GEMINI_MODEL` | Defaults to `gemini-3.8-flash`; change only after multilingual evaluation |
| `FIREBASE_PROJECT_ID` | `local-to-lens` for the configured production project |
| `SESSION_SECRET` | Random signing secret, at least 32 characters |
| `APP_ORIGIN` | Exact trusted origin; HTTPS for non-local production |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional ADC file path, consumed by Google libraries |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Existing optional Admin fallback; set together with project ID |
| `FIRESTORE_EMULATOR_HOST` | Optional local emulator address |

Prefer an attached runtime identity with ADC. Locally use Google ADC login with project access,
or an existing credential file outside the repository. A newly generated key requires separate
approval and is not part of this track. No values use `NEXT_PUBLIC_`.

The owner cookie is `__Host-ltl-owner` in production (`ltl-owner` locally), HttpOnly, Secure in
production, SameSite=Lax, Path=/, with a 30-day signed expiry. Keep the signing secret stable across
instances. Cookie loss/expiry or secret rotation loses ownership access; there is no account recovery.

The existing Firestore default database is in `asia-south1` (Mumbai), with deny-all client rules.
Admin SDK access uses IAM, not those rules. This implementation does not change Firebase Console
settings, IAM, billing, Authentication, Storage, Hosting or Analytics.

The host must support Node >=22.13, outbound Gemini/Firestore requests, this upload size and the
60-second route budget. Keep request logs from recording bodies. No deployment is provisioned.

## Fixtures and verification

`@/contracts/fixtures` exports English, Malayalam, Hindi, mixed-language, ambiguous, vague-distance
and incomplete fixtures, validated at import. These are expected-output examples, not speech
recognition benchmarks. Fixtures have `reviewed: false`; UI review sets it true before saving.

Synthetic silence clips in `src/server/testing/audio` exercise real WAV/MP3/M4A/Ogg/WebM/FLAC
containers locally. They contain no real recordings and need no services or ffmpeg at test runtime.
The WebM fixture omits duration metadata to test packet scanning.

Tests mock SDKs and cover multilingual assembly, grounding, cancellation, quotas, ownership,
origin checks, idempotency races, safe publishing, revocation, deletion, collisions and corrupted
records. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

Before production integration, evaluate actual multilingual/code-switched recordings with native
speakers, verify real credentials/IAM and perform a controlled extraction/save/publish/unpublish
smoke test. Automated tests never call live services.

## Integrated frontend (2026-10-11)

The default flow is recording/upload → extraction → review → temporary local guide. A separate,
explicit English Lisbon demo sends no audio or service requests. SDKs remain server-only.
Canonical guide state is the only domain source; UI presentation and form conversions are derived.
Blank landmark/distance values remain null; explicit zero/decimals are preserved, and unavailable
timestamps are hidden. No inferred metadata, GPS, total route length or walking-time estimates.

MediaRecorder selects supported WebM/Opus, MP4/AAC or Ogg/Opus at approximately 64 kbps/mono,
stopping at 119 s for finalization headroom. Upload accepts verified audio-only containers, including
MP4 files declared as video/octet-stream by the browser; MIME is normalized only after inspection.
The same bounded parser is reused server-side, with the server authoritative. Object URLs, tracks,
contexts and parser resources are cleaned up. Audio stays in memory for retry, never localStorage.

Shape is an explicit XHR submission with same-origin cookies and no manual multipart Content-Type.
Upload progress is real; Gemini processing is indeterminate because the endpoint is synchronous.
Only a validated complete response reveals content. One attempt is active; cancellation/navigation
abort it and stale results are ignored. Retries require a user action and honor Retry-After.
Local transport errors use network_error, invalid_response or cancelled without exposing raw errors.
Consent revocation blocks subsequent submissions.

Acknowledgement preserves confidence, warnings and needsReview. Edited/reordered facts use
source:user/evidence:null; new steps enter only after valid form submission. Open editors prevent
confirmation, and the whole guide must pass reviewedGuideSchema. Warning acknowledgement is
explicit. Original evidence is consumed in source order, so one occurrence cannot support duplicates.
Negated assertions fail grounding; estimates, bounds, signed values, ranges and multiple references
retain null meters. Grounding still establishes transcript consistency, not real-world accuracy.

Save/publish APIs are installed but not called by this phase's UI. Live Lens/Share show unavailable
states. Reload loses the local guide. The scene remains supplementary, explicitly illustrative,
with live anchors null and no persistence of scene information.

Run locally with APP_ORIGIN=http://localhost:3210 and pnpm dev --port 3210. Configure secrets only
in the ignored local env file or approved runtime. The supplied key/model metadata read succeeded;
no audio was sent. No Firebase ADC file was found. After reconnecting the owner Chrome profile,
project access was verified; the Admin SDK page offers creation of a new private key, not retrieval
of an existing credential. The approved plan excludes key creation. No service-account key, billing change, cloud
resource, rules change or deployment was created. Generation/live IAM and native/iPhone checks
remain pending. [AUDIO-VERIFICATION.md](AUDIO-VERIFICATION.md) contains scripts and the eight-attempt cap.

Automated tests mock SDKs or intercept APIs. pnpm test:e2e runs installed Chrome and Playwright
WebKit at 375×812 and 1440×900; install prerequisites with pnpm exec playwright install chrome webkit.
Chromium microphone tests use fake input. WebKit microphone cases are explicitly skipped pending
physical iPhone verification; WebKit upload and actual media playback are exercised.

## Parallel-track handoff

This branch uses an isolated staged-foundation seed because the main checkout had no Git commit.
Integrate only the backend review commit after the UI track has its baseline; do not integrate the
seed. Preserve the UI's dependency entries when adding `mediabunny@1.61.3`.
Backend documentation additions may need a contextual merge with the UI track's docs.

## Final automated verification

2026-10-11, Node 26.8.1 / pnpm 11.28.2:

- lint, typecheck and production build pass.
- Vitest: 209 tests across 25 files pass.
- Browser suite: 62 pass, two explicitly skipped WebKit microphone cases.
- Source secret scan and built client-bundle scan found no configured key/secret values.
- The local environment file is ignored and mode 0600.

These tests establish container validation, canonical data handling and UI behavior with mock AI
responses. They do not establish multilingual transcription accuracy, production Firestore IAM,
real microphone acoustics or physical iPhone behavior. One manual real-endpoint upload of a synthetic two-second silence fixture returned storage_unavailable
before Gemini invocation. No speech or audio was sent to Gemini.

## Resumed web and Firebase verification

On 2026-10-11, connected Chrome profiles initially showed accounts without local-to-lens access.
The owner account sahal.connect@gmail.com was absent from their account switchers. After reconnecting the correct profile, the project was visible under sahal.connect@gmail.com,
with Spark billing and Analytics disabled. Earlier native screen capture was unavailable. Web configuration does not provide Admin credentials; use approved ADC or an existing
credential file. No key creation, billing changes or Firebase settings changes were performed.

The actual browser upload accepted the synthetic silence WAV and reached the installed endpoint.
It failed closed at Firestore rate-limit storage with a safe storage_unavailable response and
request ID fa65edb7-6bce-474a-8569-1e2c2131360b. No model call, saved guide or mock fallback occurred.
This is a configuration-failure smoke check, not live transcription acceptance.

Recorder replacements clear the previous selected/retry clip even when the new file is invalid.
Obsolete recorder data events cannot stop a newer recorder; validation cancellation ignores late
results. Additional browser coverage verifies denied permission and network failure recovery.

The connected owner profile now exposes Firebase Admin SDK settings for the existing service account.
Choosing keyless ADC setup, providing an existing credential file, or explicitly changing scope to
a new service-account key is required before live extraction. Restart the local server after
credential configuration. No credential contents were read or logged from Chrome.
