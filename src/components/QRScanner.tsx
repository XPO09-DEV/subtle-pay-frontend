import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { parsePayQR, type ScannedRecipient } from "../utils/qr";

type Props = {
  onScan: (result: ScannedRecipient) => void;
  onClose: () => void;
};

export default function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  function handleText(text: string) {
  const parsed = parsePayQR(text);
  if (parsed) {
    onScan(parsed);
    return true;
  }
  setHint("This is not a payment QR code we can read.");
  return false;
}

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs a secure (https) page. You can upload a picture instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch (e) {
        setError(
          (e as DOMException).name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in your browser, or upload a picture."
            : "Could not open the camera. You can upload a picture instead."
        );
      }
    }

    function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data && handleText(code.data)) return;
      }
      frame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setHint("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (!code) setHint("No QR code found in that picture");
      else handleText(code.data);
    } catch {
      setHint("Could not read that picture");
    }
  }

  return (
    <div className="qr-overlay">
      <div className="qr-top">
        <strong>Scan QR code</strong>
        <button type="button" className="qr-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="qr-view">
        <video ref={videoRef} playsInline muted />
        {!error && <div className="qr-frame" />}
        {error && <p className="qr-error">{error}</p>}
      </div>

      <div className="qr-bottom">
        <p className="qr-hint">{hint}</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
        <button type="button" className="qr-upload" onClick={() => fileRef.current?.click()}>
          Upload from gallery
        </button>
      </div>
    </div>
  );
}