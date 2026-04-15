import React from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Dynamic font size: shrinks as title gets longer so the full title always fits.
function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 30) return 54;
  if (len <= 50) return 46;
  if (len <= 75) return 38;
  if (len <= 100) return 32;
  return 26;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FundraisingShareCanvasProps {
  title: string;
  bannerUrl?: string | null;
  targetAmount?: number | null;
  totalRaised: number;
  donorCount: number;
  shareUrl: string;       // /contribute/:slug  — the public donation page
  deadline?: string | null;
}

// ── Canvas Component ──────────────────────────────────────────────────────────
// 1080 × 1080 social-media flyer rendered entirely with inline styles so
// html2canvas can faithfully capture every pixel.

const FundraisingShareCanvas = React.forwardRef<HTMLDivElement, FundraisingShareCanvasProps>(
  ({ title, bannerUrl, targetAmount, totalRaised, donorCount, shareUrl, deadline }, ref) => {
    const pct = targetAmount && targetAmount > 0
      ? Math.min((totalRaised / targetAmount) * 100, 100)
      : 0;
    const remaining = daysLeft(deadline);

    // QR code → public contribution/donation page
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}&color=FFFFFF&bgcolor=1B5E20&margin=8`;

    const hasBanner = !!bannerUrl;
    const fs = titleFontSize(title);

    return (
      <div
        ref={ref}
        data-flyer-canvas
        style={{
          width: 1080,
          height: 1080,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          backgroundColor: '#0C3318',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Background gradient ──────────────────────────────────────── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(148deg, #0C3318 0%, #1B5E20 45%, #0F4019 100%)',
        }} />

        {/* ── Decorative blobs ─────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 460, height: 460, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,202,40,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -180, left: -100,
          width: 560, height: 560, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,167,38,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Dot-grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          pointerEvents: 'none',
        }} />

        {/* ── Content layer ────────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '52px 60px 48px',
          boxSizing: 'border-box',
        }}>

          {/* ── HEADER: logo + badge ──────────────────────────────────── */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 36,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: 'linear-gradient(135deg, #FFCA28 0%, #FFA726 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#0C3318', lineHeight: 1 }}>K</span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                kolekto
              </span>
            </div>
            <div style={{
              background: 'rgba(255,202,40,0.14)',
              border: '1.5px solid rgba(255,202,40,0.45)',
              borderRadius: 100,
              padding: '9px 22px',
              color: '#FFCA28',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1.6px',
              textTransform: 'uppercase' as const,
            }}>
              Fundraising Campaign
            </div>
          </div>

          {/* ── BANNER IMAGE ─────────────────────────────────────────────
              objectFit: contain  → shows the full image, never crops/stretches.
              Background matches the card so no jarring color bleed.            */}
          {hasBanner && (
            <div style={{
              width: '100%',
              height: 260,
              borderRadius: 18,
              overflow: 'hidden',
              marginBottom: 32,
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#0C3318',         // dark bg shows behind contained image
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={bannerUrl!}
                alt=""
                crossOrigin="anonymous"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',      // full image, no stretch, no crop
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* ── CAMPAIGN TITLE ───────────────────────────────────────────
              Font shrinks dynamically so the full title is always readable.
              No maxHeight / overflow:hidden — title never gets cut off.        */}
          <div style={{
            color: '#FFFFFF',
            fontSize: fs,
            fontWeight: 900,
            lineHeight: 1.18,
            letterSpacing: '-0.8px',
            marginBottom: 28,
            wordBreak: 'break-word' as const,
            flexShrink: 0,
          }}>
            {title}
          </div>

          {/* ── SPACER ───────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 8 }} />

          {/* ── PROGRESS BLOCK ───────────────────────────────────────────── */}
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 20,
            padding: '26px 32px',
            marginBottom: 24,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 16,
            }}>
              <div>
                <div style={{ color: '#FFCA28', fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>
                  {fmtFull(totalRaised)}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 5 }}>
                  raised so far
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {targetAmount && targetAmount > 0 ? (
                  <>
                    <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                      {pct.toFixed(0)}%
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 5 }}>
                      of {fmtFull(targetAmount)} goal
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>No target set</div>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 10, background: 'rgba(255,255,255,0.14)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${targetAmount && targetAmount > 0 ? pct : 0}%`,
                background: 'linear-gradient(90deg, #FFCA28 0%, #FFA726 100%)',
                borderRadius: 999,
                minWidth: totalRaised > 0 ? 10 : 0,
              }} />
            </div>
          </div>

          {/* ── BOTTOM: stats + QR ───────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexShrink: 0,
          }}>
            {/* Left: donor count + days left + URL pill */}
            <div>
              <div style={{ display: 'flex', gap: 36, marginBottom: 24 }}>
                <div>
                  <div style={{ color: '#FFFFFF', fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.5px' }}>
                    {donorCount.toLocaleString()}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 }}>
                    {donorCount === 1 ? 'donor' : 'donors'}
                  </div>
                </div>
                {remaining !== null && remaining > 0 && (
                  <div>
                    <div style={{ color: '#FFFFFF', fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.5px' }}>
                      {remaining}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 }}>
                      {remaining === 1 ? 'day left' : 'days left'}
                    </div>
                  </div>
                )}
              </div>
              {/* URL pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 100,
                padding: '9px 18px',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13, letterSpacing: '0.3px' }}>
                  kolekto.com.ng
                </span>
              </div>
            </div>

            {/* QR Code → contribution/donation page */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 }}>
              <div style={{
                background: '#FFFFFF',
                borderRadius: 14,
                padding: 10,
                width: 140,
                height: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 4px rgba(255,202,40,0.35)',
              }}>
                <img
                  src={qrUrl}
                  alt="Donate QR"
                  crossOrigin="anonymous"
                  width={120}
                  height={120}
                  style={{ display: 'block', borderRadius: 4 }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#FFCA28', fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const }}>
                  Scan to Donate
                </div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 2 }}>
                  Camera · Any QR App
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, letterSpacing: '0.3px' }}>
              Powered by Kolekto · kolekto.com.ng
            </div>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>
              #KolektoCampaign
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FundraisingShareCanvas.displayName = 'FundraisingShareCanvas';

export default FundraisingShareCanvas;
