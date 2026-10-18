import { useEffect, useState } from 'react';

/**
 * QR code for a join link, drawn in the browser. The qrcode library is loaded on demand
 * so only the teacher screen pays for it. The link text is always shown alongside, so a
 * failed load still leaves students a way in.
 */
export function JoinQrCode({ url, sizeClass = 'max-w-72 sm:max-w-80' }: { url: string; sizeClass?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import('qrcode')
      .then(({ toDataURL }) =>
        // Card ink on the card surface (design tokens); a data URL can't read CSS variables.
        toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640, color: { dark: '#0d1b3e', light: '#ffffff' } }),
      )
      .then(
        (dataUrl) => live && setSrc(dataUrl),
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [url]);

  if (failed) return <p className="text-small text-card-ink-muted">Couldn’t draw the QR code. Students can use the link below.</p>;
  return (
    <div className={`mx-auto aspect-square w-full ${sizeClass}`}>
      {src && <img src={src} alt={`QR code for ${url}`} className="size-full rounded-chip [image-rendering:pixelated]" />}
    </div>
  );
}
