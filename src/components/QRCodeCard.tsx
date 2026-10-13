import { QRCodeSVG } from "qrcode.react";
import { buildPayQR } from "../utils/qr";

type Props = { handle?: string | null; address: string };

export default function QRCodeCard({ handle, address }: Props) {
  return (
    <div className="qr-card">
      <div className="qr-code">
        <QRCodeSVG value={buildPayQR(handle, address)} size={200} fgColor="#0a0a0a" level="M" />
      </div>
      <p className="qr-caption">{handle ? `@${handle}` : "Scan to pay me"}</p>
    </div>
  );
}