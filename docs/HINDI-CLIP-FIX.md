# Targeted Hindi MP3 extraction fix

2026-10-11. Branch base: voice-guidance review `948e988`. Both ElevenLabs clips remain outside Git.
The user confirmed the Monika and Sudhir recordings use the same script; no text script was supplied.

## Reproduction and correction

The MP3 container was valid and within the existing limits: Sudhir 1,366,528 bytes / 84.349 s;
Monika 1,336,017 bytes / 82.442 s. The screenshot's old response was not retained, so its exact
rejection cannot be reconstructed. New calls reproduced `invalid_model_output` independently.

Content-free diagnostics located unsupported direction labels. Some generated steps guessed
`straight` where their evidence did not contain an explicit heading. The prompt now requires
supported non-turn wording and asks for `unknown` / low confidence / a warning when heading is
unspecified. Unsupported model claims still fail validation; the server does not repair them.

A retained response also showed a false arrival rejection: the existing check accepted `reach`
but missed its grammatical forms `reached`, `reaching`, and `reaches`. The only vocabulary change
adds those forms. With that change, the same retained model response passed canonical assembly
without changing its transcript, evidence, instruction, landmark, distance, or warnings. Regression
samples use unrelated public synthetic text, not the user's transcript.

## Eight-attempt ledger

| Attempt | Path | Result | Request ID |
| --- | --- | --- | --- |
| 1 | Sudhir HTTP endpoint, before correction | `request_timeout` | `da31f2f8-2b44-4717-bf2f-27a46252f5d0` |
| 2 | Sudhir same route handler with diagnostic SDK wrapper | `unsupported_direction`, `steps.0.direction` | `33d4ce1a-4f6a-42e1-a3b2-c6bcaf6d5419` |
| 3 | Sudhir diagnostic route replay | `unsupported_direction`, `steps.4.direction`; inferred straight labels identified | `1efff0d9-f549-4c89-9d7f-5da3378fe1a5` |
| 4 | Sudhir HTTP after prompt clarification | `unsupported_direction`, `steps.2.direction` | `41dd9e17-6a92-4613-ba5e-317b2814ece2` |
| 5 | Sudhir diagnostic replay retained in process memory | `unsupported_direction`, `steps.2.direction`; arrival inflection identified; offline assembly passed after vocabulary fix | `90e39669-fffb-4c22-886a-004f378bc45a` |
| 6 | Sudhir real browser | `request_timeout`; explicit retry remained available | `a0016182-1cb0-410a-abfa-8d521dbe0f96` |
| 7 | Monika HTTP cross-check after correction | 200 canonical extraction | `c5694747-f693-441f-ad61-f9b0eb1bdadf` |
| 8 | Sudhir explicit browser retry | Successful extraction → Review → local Guide; request ID not rendered by success UI and not retained | — |

No ninth request was made. Temporary model responses were held only in memory, then released.
Diagnostics contain only fixed reason codes, whitelisted schema paths and request IDs. No recording,
transcript, raw provider exception or credential was added to repository files or diagnostic logs.
The UI screenshot captures only the generic successful status, excluding transcript contents.

## Verification and limits

- Sudhir browser upload used automatic detection and the real API. Review displayed original and
  English text, six steps, and uncertainty flags. Confirming warnings opened the temporary Guide;
  manual step navigation preserved warnings and the illustrative scene. Nothing was saved/published.
- Monika's same-script cross-check passed the real HTTP endpoint.
- Lint, typecheck and production build pass. Vitest: 277 tests / 34 files, SDKs mocked.
- Chrome/WebKit browser regression suite: 74 pass, two existing WebKit microphone cases skipped.
- The existing public API, version-1 contract, upload limits, 20-second SDK call timeout,
  45-second processing deadline, 60-second route/client budget, rate limits and explicit retries remain.
- Timeouts still occur under provider latency and remain safe retryable errors; these checks do not
  establish a production reliability rate. No full text script was available for independent
  fact-by-fact accuracy comparison. Native-speaker review of the original audio and extracted guide
  is still required. Physical Safari and previously noted mixed/TTS limitations remain pending.
