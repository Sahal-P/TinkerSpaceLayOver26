"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_AUDIO_BYTES } from "@/contracts/audio";
import { prepareClip, type AudioClip } from "./audio-client";

export const recorderTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;
export function chooseRecorderType(
  supported: (mime: string) => boolean,
): string | null {
  return recorderTypes.find(supported) ?? null;
}
export function recordingError(error: unknown): string {
  const name =
    error instanceof Error || error instanceof DOMException ? error.name : "";
  if (["NotAllowedError", "SecurityError"].includes(name))
    return "Microphone permission was denied. Allow it in browser settings, or upload a clip.";
  if (name === "NotFoundError")
    return "No microphone was found. You can upload a clip instead.";
  if (name === "NotReadableError")
    return "The microphone is busy or unavailable. Close other recording apps, or upload a clip.";
  return "Recording could not start. Try again, or upload a supported audio clip.";
}
const quiet = Array.from({ length: 56 }, () => 0.08);
type Phase =
  | "idle"
  | "requesting"
  | "recording"
  | "validating"
  | "ready"
  | "error";
export function useAudioRecorder(
  initial: AudioClip | null,
  reducedMotion = false,
) {
  const [clip, setClip] = useState<AudioClip | null>(initial);
  const [phase, setPhase] = useState<Phase>(initial ? "ready" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState(quiet);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inspection = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const mounted = useRef(false);
  const busy = useRef(false);
  function release() {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void context.current?.close().catch(() => undefined);
    context.current = null;
  }
  function stop() {
    const current = recorder.current;
    if (current?.state === "recording") current.stop();
  }
  useEffect(() => {
    mounted.current = true;
    const hidden = () => {
      if (document.hidden) {
        const current = recorder.current;
        if (current?.state === "recording") current.stop();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      busy.current = false;
      inspection.current?.abort();
      const current = recorder.current;
      if (current?.state === "recording") current.stop();
      if (timer.current !== null) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      void context.current?.close().catch(() => undefined);
      context.current = null;
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function inspect(blob: Blob, id: number) {
    inspection.current?.abort();
    const controller = new AbortController();
    inspection.current = controller;
    if (!mounted.current || id !== operation.current) return;
    setPhase("validating");
    setClip(null);
    try {
      const prepared = await prepareClip(blob, controller.signal);
      if (
        mounted.current &&
        id === operation.current &&
        !controller.signal.aborted
      ) {
        setClip(prepared);
        setPhase("ready");
        setElapsedMs(prepared.durationMs);
      }
    } catch (failure) {
      if (
        !mounted.current ||
        id !== operation.current ||
        controller.signal.aborted
      )
        return;
      const message =
        failure instanceof Error &&
        ["AudioInspectionError", "Error"].includes(failure.name) &&
        /^(Audio must|The file is not)/.test(failure.message)
          ? failure.message
          : "The clip is invalid, corrupt, or unsupported. Use 2–120 seconds of audio under 4 MiB.";
      setError(message);
      setPhase("error");
    } finally {
      if (id === operation.current) busy.current = false;
    }
  }
  async function start(consent: boolean) {
    if (!consent || busy.current) return;
    busy.current = true;
    const id = ++operation.current;
    inspection.current?.abort();
    release();
    setError(null);
    setClip(null);
    setElapsedMs(0);
    setPhase("requesting");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("Unsupported");
      const mimeType = chooseRecorderType((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      if (!mimeType) throw new Error("Unsupported");
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 } },
        video: false,
      });
      if (!mounted.current || id !== operation.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const current = new MediaRecorder(captured, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      recorder.current = current;
      let chunks: Blob[] = [];
      let bytes = 0;
      let failure = false;
      current.ondataavailable = (event) => {
        if (!mounted.current || id !== operation.current) return;
        bytes += event.data.size;
        if (bytes > MAX_AUDIO_BYTES) {
          failure = true;
          if (current.state === "recording") current.stop();
          return;
        }
        if (event.data.size > 0) chunks.push(event.data);
      };
      current.onerror = () => {
        failure = true;
        if (id !== operation.current) return;
        stop();
        release();
        busy.current = false;
        if (mounted.current) {
          setError("Recording was interrupted. Please record again.");
          setPhase("error");
        }
      };
      current.onstop = () => {
        if (!mounted.current || id !== operation.current) {
          captured.getTracks().forEach((track) => track.stop());
          chunks = [];
          return;
        }
        release();
        const blob = new Blob(chunks, { type: current.mimeType });
        chunks = [];
        if (!mounted.current || id !== operation.current) return;
        if (failure) {
          setError(
            bytes > MAX_AUDIO_BYTES
              ? "Audio must be at most 4 MiB. Record a shorter clip."
              : "Recording was interrupted. Please record again.",
          );
          setPhase("error");
          busy.current = false;
          return;
        }
        void inspect(blob, id);
      };
      captured.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (id === operation.current && current.state === "recording")
            current.stop();
        };
      });
      let analyser: AnalyserNode | null = null;
      try {
        const audio = new AudioContext();
        context.current = audio;
        void audio.resume().catch(() => undefined);
        analyser = audio.createAnalyser();
        analyser.fftSize = 256;
        audio.createMediaStreamSource(captured).connect(analyser);
      } catch {
        /* Recording works even when visual metering is unavailable. */
      }
      const samples = new Uint8Array(256);
      const startedAt = performance.now();
      current.start(250);
      setPhase("recording");
      timer.current = setInterval(() => {
        const elapsed = performance.now() - startedAt;
        setElapsedMs(elapsed);
        if (analyser && !reducedMotion) {
          analyser.getByteTimeDomainData(samples);
          setLevels(
            quiet.map((_, i) =>
              Math.max(
                0.08,
                Math.min(1, Math.abs((samples[i * 4] ?? 128) - 128) / 24),
              ),
            ),
          );
        }
        if (elapsed >= 119000) stop();
      }, 100);
    } catch (failure) {
      if (id === operation.current) {
        release();
        busy.current = false;
        if (mounted.current) {
          setError(recordingError(failure));
          setPhase("error");
        }
      }
    }
  }
  function upload(file: File) {
    if (busy.current) return;
    busy.current = true;
    const id = ++operation.current;
    setError(null);
    release();
    void inspect(file, id);
  }
  function reset() {
    operation.current++;
    busy.current = false;
    inspection.current?.abort();
    stop();
    release();
    recorder.current = null;
    setClip(null);
    setError(null);
    setElapsedMs(0);
    setLevels(quiet);
    setPhase("idle");
  }
  return { phase, clip, error, elapsedMs, levels, start, stop, upload, reset };
}
