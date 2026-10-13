import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getSignedPayQr } from "../services/accountService";

type Props = { handle?: string | null; address: string };
export default function QRCodeCard({ handle, address }: Props) {
  const [payload, setPayload] = useState("");
  useEffect(() => { let alive = true; void getSignedPayQr().then((v) => { if (alive && v.address.toLowerCase() === address.toLowerCase()) setPayload(v.payload); }).catch(() => setPayload("")); return () => { alive = false; }; }, [address]);
  return <div className="qr-card"><div className="qr-code">{payload ? <QRCodeSVG value={payload} size={200} fgColor="#0a0a0a" level="H" imageSettings={{ src: "/subtle-pay-mark.svg", width: 36, height: 36, excavate: true }} /> : <p role="status">Loading secure QR…</p>}</div><p className="qr-caption">{handle ? `@${handle}` : "Scan to pay me"} · Monad Testnet</p></div>;
}
