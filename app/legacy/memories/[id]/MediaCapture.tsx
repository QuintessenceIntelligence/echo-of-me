"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMediaAction, type UploadState } from "../../../vault-actions";

type Phase = "idle" | "starting" | "recording" | "recorded" | "unsupported" | "denied";

/**
 * Record in the browser or upload a file. The recording is sent exactly as the browser produced it;
 * the server stores it unchanged (P1) and decides its type from the bytes.
 */
export function MediaCapture({ legacyId, memoryId, audioAllowed }: { legacyId: string; memoryId: string; audioAllowed: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recState, recAction, recPending] = useActionState<UploadState, FormData>(uploadMediaAction, {});
  const [upState, upAction, upPending] = useActionState<UploadState, FormData>(uploadMediaAction, {});

  useEffect(() => {
    if (recState.ok || upState.ok) router.refresh();
  }, [recState, upState, router]);

  useEffect(() => {
    if (recState.ok) {
      setPhase("idle");
      setPreview(null);
      blobRef.current = null;
    }
  }, [recState]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("unsupported");
      return;
    }
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        blobRef.current = blob;
        setPreview(URL.createObjectURL(blob));
        setPhase("recorded");
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setPhase("recording");
    } catch {
      setPhase("denied");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stop();
  }

  function discard() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    blobRef.current = null;
    setPhase("idle");
  }

  function saveRecording() {
    const blob = blobRef.current;
    if (!blob) return;
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const fd = new FormData();
    fd.set("legacyId", legacyId);
    fd.set("memoryId", memoryId);
    fd.set("capture", "browser_recording");
    fd.set("file", new File([blob], `recording.${ext}`, { type: blob.type }));
    recAction(fd);
  }

  return (
    <div className="capture">
      {audioAllowed ? (
        <div>
          <h3>Record your voice</h3>
          <div className="actions" aria-live="polite">
            {(phase === "idle" || phase === "denied" || phase === "unsupported") && (
              <button type="button" onClick={start}>Start recording</button>
            )}
            {phase === "starting" && <span className="muted">Waiting for the microphone…</span>}
            {phase === "recording" && (
              <>
                <span className="recording-dot" aria-hidden="true" />
                <span>Recording… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
                <button type="button" onClick={stop}>Stop</button>
              </>
            )}
            {phase === "recorded" && preview && (
              <>
                <audio controls src={preview} aria-label="Preview of your new recording" />
                <button type="button" onClick={saveRecording} disabled={recPending}>{recPending ? "Saving…" : "Save recording"}</button>
                <button type="button" className="secondary" onClick={discard} disabled={recPending}>Discard</button>
              </>
            )}
          </div>
          {phase === "denied" && <p className="notice error small" role="alert">The microphone could not be used. Please allow microphone access for this site and try again.</p>}
          {phase === "unsupported" && <p className="notice error small" role="alert">This browser cannot record audio here. You can upload a recording instead.</p>}
          {recState.error && <p className="notice error small" role="alert">{recState.error}</p>}
          {recState.ok && <p className="notice ok small" role="status">{recState.ok}</p>}
        </div>
      ) : (
        <p className="notice info small">
          To record or upload audio, first agree to “Storing your voice recordings” under <a href="/legacy#consents">Your consents</a>. Photos do not need it.
        </p>
      )}

      <form action={upAction}>
        <input type="hidden" name="legacyId" value={legacyId} />
        <input type="hidden" name="memoryId" value={memoryId} />
        <input type="hidden" name="capture" value="upload" />
        <label htmlFor="upload-file">{audioAllowed ? "Or upload a recording or photo" : "Upload a photo"}</label>
        <input
          id="upload-file"
          name="file"
          type="file"
          required
          accept={audioAllowed ? "audio/*,image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp"}
        />
        <p className="muted small">Recordings: WebM, Ogg, MP3, WAV or M4A up to 25 MB. Photos: PNG, JPEG or WebP up to 10 MB. Your file is stored exactly as it is.</p>
        <div className="actions"><button type="submit" className="secondary" disabled={upPending}>{upPending ? "Uploading…" : "Upload"}</button></div>
        {upState.error && <p className="notice error small" role="alert">{upState.error}</p>}
        {upState.ok && <p className="notice ok small" role="status">{upState.ok}</p>}
      </form>
    </div>
  );
}
