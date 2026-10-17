import { useEffect, useState } from 'react';

/**
 * QR code for a join link, drawn in the browser. The qrcode library is loaded on demand
 * so only the teacher screen pays for it. The link text is always shown alongside, so a
 * failed load still leaves students a way in.
 */
export function JoinQrCode({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640, color: { dark: '#0f172a', light: '#ffffff' } }),
      )
      .then(
        (dataUrl) => live && setSrc(dataUrl),
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [url]);

  if (failed) return <p className="text-sm text-slate-600">Couldn’t draw the QR code. Students can use the link below.</p>;
  return (
    <div className="mx-auto aspect-square w-full max-w-72 sm:max-w-80">
      {src && <img src={src} alt={`QR code for ${url}`} className="size-full rounded-lg [image-rendering:pixelated]" />}
    </div>
  );
}
