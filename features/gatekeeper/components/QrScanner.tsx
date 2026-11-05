import type { RefObject } from "react";

export function QrScanner({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  return (
    <div className="gatekeeper-camera">
      <video ref={videoRef} autoPlay playsInline muted />
      <p>وجّه الكاميرا نحو رمز QR. إذا لم تعمل الكاميرا، أدخل الكود يدوياً.</p>
    </div>
  );
}
