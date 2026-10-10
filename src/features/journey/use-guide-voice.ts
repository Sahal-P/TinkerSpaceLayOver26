"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NarrationInput, SpeechLanguage } from "@/contracts/speech";
import { prepareNarration, VoiceError, type PreparedNarration } from "./speech-client";

type Status = "off" | "loading" | "playing" | "ready" | "blocked" | "paused" | "error";
export function useGuideVoice(current: NarrationInput | null, next: NarrationInput | null) {
  const [enabled, setEnabled] = useState(false);
  const [language, setLanguage] = useState<SpeechLanguage>("en");
  const [status, setStatus] = useState<Status>("off");
  const [prepared, setPrepared] = useState<PreparedNarration | null>(null);
  const [error, setError] = useState<VoiceError | null>(null);
  const [clock, setClock] = useState(0);
  const [replay, setReplay] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const attempt = useRef(0);
  const failure = useRef<VoiceError | null>(null);
  const retryKey = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const stop = useCallback(() => {
    attempt.current++; controller.current?.abort(); controller.current = null;
    if (audio.current?.hasAttribute("src")) audio.current.pause();
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; if (audio.current.hasAttribute("src")) { audio.current.removeAttribute("src"); audio.current.load(); } }
    if (url.current) URL.revokeObjectURL(url.current); url.current = null;
  }, []);
  const currentKey = JSON.stringify(current); const nextKey = JSON.stringify(next);
  useEffect(() => {
    if (!audio.current) audio.current = document.createElement("audio");
    return () => { stop(); audio.current = null; };
  }, [stop]);
  useEffect(() => {
    stop();
    if (!enabled || !currentKey || currentKey === "null") {
      void Promise.resolve().then(() => { if (enabled) { setStatus("ready"); setPrepared(null); } });
      return;
    }
    const input: NarrationInput = JSON.parse(currentKey);
    const nextInput: NarrationInput | null = JSON.parse(nextKey);
    const active = new AbortController(); controller.current = active; const id = attempt.current;
    let index = 0;
    const playClip = async (data: PreparedNarration) => {
      if (active.signal.aborted || id !== attempt.current || document.hidden) return;
      const element = audio.current; const clip = data.clips[index]; if (!element || !clip) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(clip); element.src = url.current;
      element.onended = () => {
        index++;
        if (index < data.clips.length) void playClip(data);
        else {
          setStatus("ready");
          if (nextInput && !active.signal.aborted) void prepareNarration(nextInput, language, active.signal).catch((reason) => {
            if (active.signal.aborted || id !== attempt.current) return;
            const safe = reason instanceof VoiceError ? reason : new VoiceError("The next step's voice could not be prepared.", 0, null, true);
            failure.current = safe;
            setError(safe);
          });
        }
      };
      element.onerror = () => { if (id === attempt.current && !active.signal.aborted) { setStatus("error"); setError(new VoiceError("Voice playback failed. Try again.", 0, null, true)); } };
      try { await element.play(); if (!active.signal.aborted && id === attempt.current) setStatus("playing"); }
      catch (reason) {
        if (active.signal.aborted || id !== attempt.current) return;
        if ((reason instanceof Error || reason instanceof DOMException) && reason.name === "NotAllowedError") setStatus("blocked");
        else { setStatus("error"); setError(new VoiceError("Voice playback failed. Try again.", 0, null, true)); }
      }
    };
    // Defer initial state updates; all request completion writes are attempt-guarded.
    void Promise.resolve().then(async () => {
      if (active.signal.aborted) return;
      if (failure.current && retryKey.current !== currentKey + language) {
        setStatus("error"); setError(failure.current); setPrepared(null); return;
      }
      setStatus("loading"); setPrepared(null); setError(null);
      try {
        const retry = retryKey.current === currentKey + language;
        retryKey.current = null;
        const data = await prepareNarration(input, language, active.signal, retry);
        if (active.signal.aborted || id !== attempt.current) return;
        setPrepared(data);
        if (document.hidden) { setStatus("paused"); return; }
        await playClip(data);
      } catch (reason) {
        if (active.signal.aborted || id !== attempt.current) return;
        const safe = reason instanceof VoiceError ? reason : new VoiceError("Voice guidance is unavailable. Try again.", 0, null, true);
        failure.current = safe; setStatus("error"); setError(safe);
      }
    });
    const visibility = () => { if (document.hidden) { audio.current?.pause(); active.abort(); setStatus("paused"); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { active.abort(); document.removeEventListener("visibilitychange", visibility); stop(); };
  }, [currentKey, nextKey, language, enabled, replay, stop]);
  useEffect(() => {
    if (!error?.retryAt) return;
    const timer = setInterval(() => setClock(Date.now()), 250); return () => clearInterval(timer);
  }, [error?.retryAt]);
  const toggle = () => {
    if (enabled) { stop(); setEnabled(false); setStatus("off"); }
    else { setEnabled(true); setClock(Date.now()); }
  };
  const changeLanguage = (value: SpeechLanguage) => { stop(); setLanguage(value); setPrepared(null); setError(null); };
  const play = () => {
    if ((error?.retryAt ?? 0) > Date.now()) return;
    if (status === "blocked" && audio.current) {
      const id = attempt.current;
      void audio.current.play().then(() => { if (id === attempt.current) setStatus("playing"); }).catch(() => { if (id === attempt.current) setStatus("blocked"); });
    } else { failure.current = null; retryKey.current = currentKey + language; setReplay(value => value + 1); }
  };
  return { enabled, language, status: enabled ? status : "off", prepared, error, toggle, changeLanguage, play, coolingDown: (error?.retryAt ?? 0) > clock };
}
