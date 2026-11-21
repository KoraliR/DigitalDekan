"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Camera, CheckCircle2, Keyboard, LoaderCircle, RotateCcw, ScanLine, X } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { extractAttendanceToken } from "@/lib/qr";

/** Частота анализа кадров: ~5–6 раз в секунду достаточно и не грузит телефон. */
const FRAME_INTERVAL_MS = 180;
/** Максимальная сторона кадра для jsQR: так декодирование дешевле на мобильных. */
const MAX_FRAME_SIDE = 640;

type LessonInfo = { title: string; startsAt: string; groupName: string };
type ScanState = "idle" | "requesting" | "scanning" | "submitting" | "success" | "error";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function createBarcodeDetector(): BarcodeDetectorLike | null {
  if (typeof window === "undefined") return null;
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (typeof Detector !== "function") return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

const lessonDate = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
});

function lessonWhen(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : lessonDate.format(date) + " МСК";
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Доступ к камере запрещён. Разрешите камеру в настройках браузера — или введите код вручную.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
    return "Камера не найдена или занята другим приложением. Введите код вручную.";
  }
  return "Не удалось включить камеру. Введите код вручную.";
}

export function ScanAttendance() {
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const mountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) for (const track of stream.getTracks()) track.stop();
  }, []);

  const markAttendance = useCallback(async (token: string): Promise<boolean> => {
    setState("submitting");
    setMessage("");
    setHint("Отправляем отметку…");
    try {
      const response = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; lesson?: LessonInfo } | null;
      if (!mountedRef.current) return false;
      if (response.ok && data?.ok) {
        stopCamera();
        setLesson(data.lesson ?? null);
        setMessage("");
        setHint("");
        setState("success");
        return true;
      }
      stopCamera();
      setMessage(data?.error ?? (response.status === 401
        ? "Войдите заново, чтобы отметить посещение."
        : "Не удалось отметить посещение. Попросите новый код у сотрудника."));
      setHint("");
      setState("error");
      return false;
    } catch {
      if (!mountedRef.current) return false;
      stopCamera();
      setMessage("Не удалось отправить отметку. Проверьте интернет и попробуйте снова.");
      setHint("");
      setState("error");
      return false;
    }
  }, [stopCamera]);

  const handleRaw = useCallback(async (raw: string) => {
    const token = extractAttendanceToken(raw);
    if (!token) {
      setState("error");
      setMessage("Это не QR для отметки посещаемости. Вставьте ссылку из QR-кода или 48-символьный код.");
      stopCamera();
      return false;
    }
    return markAttendance(token);
  }, [markAttendance, stopCamera]);

  const scanFrame = useCallback(async () => {
    if (!scanningRef.current || busyRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth < 1 || video.videoHeight < 1) return;
    busyRef.current = true;
    try {
      let raw: string | null = null;
      let sawAnyCode = false;
      const detector = detectorRef.current;
      if (detector) {
        try {
          const codes = await detector.detect(video);
          sawAnyCode = codes.length > 0;
          raw = codes.find((code) => typeof code.rawValue === "string" && code.rawValue)?.rawValue ?? null;
        } catch {
          // BarcodeDetector есть, но не умеет работать с этим источником/форматом — уходим на jsQR.
          detectorRef.current = null;
        }
      }
      if (!raw && !sawAnyCode) {
        const canvas = canvasRef.current ?? document.createElement("canvas");
        canvasRef.current = canvas;
        const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
          raw = decoded?.data ?? null;
        }
      }
      if (!raw || !scanningRef.current) return;
      scanningRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const token = extractAttendanceToken(raw);
      if (!token) {
        // Мусорный QR: сообщаем и продолжаем сканирование.
        setHint("Это не QR для отметки посещаемости — ищем дальше…");
        scanningRef.current = true;
        timerRef.current = window.setInterval(() => { void scanFrame(); }, FRAME_INTERVAL_MS);
        return;
      }
      await markAttendance(token);
    } finally {
      busyRef.current = false;
    }
  }, [markAttendance]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setMessage("");
    setHint("");
    setLesson(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setMessage("Браузер не поддерживает камеру. Введите код вручную — откройте блок ниже.");
      setManualOpen(true);
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!mountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        setState("error");
        setMessage("Камера недоступна. Введите код вручную.");
        setManualOpen(true);
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // muted+playsInline обычно воспроизводится автоматически; если нет — кадры просто будут пустыми.
      }
      detectorRef.current = createBarcodeDetector();
      scanningRef.current = true;
      setState("scanning");
      setHint("Наведите камеру на QR-код сотрудника");
      timerRef.current = window.setInterval(() => { void scanFrame(); }, FRAME_INTERVAL_MS);
    } catch (error) {
      stopCamera();
      if (!mountedRef.current) return;
      setState("error");
      setMessage(cameraErrorMessage(error));
      setManualOpen(true);
    }
  }, [scanFrame, stopCamera]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setHint("");
    setState("idle");
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || !manual.trim()) return;
    void handleRaw(manual);
  }

  const active = state === "requesting" || state === "scanning" || state === "submitting";
  const result = state === "success" ? lesson : null;

  return <section className="panel scan-attendance" data-state={state} aria-label="Отметка по QR">
    <div className="scan-head">
      <span className="soft-icon" aria-hidden="true">{state === "success" ? <CheckCircle2 size={20} /> : <ScanLine size={20} />}</span>
      <div>
        <h2>Отметка по QR</h2>
        <p className="muted">Сканируйте код с экрана сотрудника — отметка сразу появится у преподавателя.</p>
      </div>
    </div>

    {result && <div className="scan-success" role="status">
      <CheckCircle2 size={26} aria-hidden="true" />
      <div>
        <strong>Посещение отмечено</strong>
        <p>{result.title} · {result.groupName}</p>
        {lessonWhen(result.startsAt) && <small className="muted">{lessonWhen(result.startsAt)}</small>}
      </div>
    </div>}
    {state === "error" && message && <p className="form-error scan-error" role="alert">{message}</p>}

    <div className="scan-viewport" data-active={active ? "true" : undefined}>
      {/* Видео всегда в DOM (скрыто стилями), чтобы ref был доступен сразу после getUserMedia. */}
      <video ref={videoRef} className="scan-video" autoPlay playsInline muted aria-label="Видеопоток камеры" />
      <span className="scan-reticle" aria-hidden="true" />
      {state === "requesting" && <p className="scan-overlay"><LoaderCircle size={18} className="spin" aria-hidden="true" /> Включаем камеру…</p>}
    </div>

    {state === "scanning" && <div className="scan-controls">
      <p className="scan-hint" role="status" aria-live="polite">{hint || "Наведите камеру на QR-код сотрудника"}</p>
      <Button type="button" variant="secondary" onClick={closeCamera}><X size={17} /> Закрыть</Button>
    </div>}
    {state === "submitting" && <p className="scan-hint" role="status" aria-live="polite">{hint || "Отправляем отметку…"}</p>}

    {(state === "idle" || state === "error" || state === "success") && <div className="scan-actions">
      <Button type="button" onClick={() => { void startCamera(); }}>
        {state === "idle" ? <Camera size={17} /> : <RotateCcw size={17} />}
        {state === "idle" ? "Сканировать QR" : "Сканировать снова"}
      </Button>
    </div>}

    <details className="scan-manual" open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
      <summary><Keyboard size={15} aria-hidden="true" /> Не получается отсканировать? Введите код вручную</summary>
      <form className="scan-manual-form" onSubmit={submitManual}>
        <label className="field-label" htmlFor="scan-manual-input">Ссылка из QR-кода или 48-символьный код</label>
        <input id="scan-manual-input" name="token" value={manual} onChange={(event) => setManual(event.target.value)}
          placeholder="/attendance/check?token=…" autoComplete="off" spellCheck={false} enterKeyHint="done" />
        <Button type="submit" disabled={!manual.trim() || state === "submitting"}>
          {state === "submitting" ? "Отмечаем…" : "Отметить"}
        </Button>
      </form>
    </details>
  </section>;
}
