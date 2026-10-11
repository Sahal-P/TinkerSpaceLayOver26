/**
 * A synthetic Hindi recording shipped with the app (`public/samples/`), so a reviewer can try the
 * real pipeline without a microphone or a file. It is not a canned result: the recorder inspects
 * it exactly like an upload, and the server revalidates and processes it like any other clip.
 */
export const SAMPLE_CLIP_URL = "/samples/hindi-directions.mp3";

/** A failed fetch, as opposed to a clip that fails validation. */
export class SampleClipError extends Error {
  constructor() {
    super("The sample clip could not be loaded. Check your connection and try again.");
    this.name = "SampleClipError";
  }
}

export async function fetchSampleClip(signal: AbortSignal): Promise<Blob> {
  try {
    const response = await fetch(SAMPLE_CLIP_URL, { signal });
    if (!response.ok) throw new SampleClipError();
    return await response.blob();
  } catch (failure) {
    // A cancelled load is not an error the traveler needs to hear about.
    if (signal.aborted || failure instanceof SampleClipError) throw failure;
    throw new SampleClipError();
  }
}
