/**
 * Hero-scale ambient SVG. Our riff on Compass's "AmbientSphere" but in our
 * own visual language: a faint encrypted-handle graph (three nodes + edges +
 * a centre dot) inside a soft radial halo. Particle dots orbit slowly.
 *
 * Used as a decorative background element behind the hero text.
 */
export function AmbientShield({
  className = "",
  size = 640,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center opacity-60 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 600 600"
        width={size}
        height={size}
        className="h-[80vmin] w-[80vmin] max-h-[640px] max-w-[640px]"
      >
        <defs>
          <radialGradient id="halo-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(124, 141, 240, 0.18)" />
            <stop offset="60%" stopColor="rgba(124, 141, 240, 0.04)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
          <radialGradient id="halo-inner" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
            <stop offset="50%" stopColor="rgba(160, 200, 240, 0.04)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
        </defs>

        {/* Outer halo */}
        <circle cx="300" cy="300" r="280" fill="url(#halo-fill)" />
        <circle cx="300" cy="300" r="200" fill="url(#halo-inner)" />
        <circle
          cx="300"
          cy="300"
          r="200"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
        />

        {/* Encrypted-handle motif — large, faint */}
        <g opacity="0.55">
          <path
            d="M300 200 L220 360 M300 200 L380 360 M220 360 L380 360"
            stroke="rgba(124, 141, 240, 0.55)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="300" cy="200" r="6" fill="rgba(255,255,255,0.85)" />
          <circle cx="220" cy="360" r="6" fill="rgba(255,255,255,0.85)" />
          <circle cx="380" cy="360" r="6" fill="rgba(255,255,255,0.85)" />
          <circle cx="300" cy="293" r="3.5" fill="#34D399" />
        </g>

        {/* Orbiting particles */}
        <g
          style={{
            animation: "ambientSpin 24s linear infinite",
            transformOrigin: "300px 300px",
          }}
        >
          <circle cx="300" cy="80" r="2" fill="rgba(255,255,255,0.55)" />
          <circle cx="520" cy="300" r="1.5" fill="rgba(255,255,255,0.35)" />
          <circle cx="300" cy="520" r="2" fill="rgba(255,255,255,0.55)" />
          <circle cx="80" cy="300" r="1.5" fill="rgba(255,255,255,0.35)" />
        </g>

        {/* Inline keyframes so the SVG is self-contained */}
        <style>{`
          @keyframes ambientSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </svg>
    </div>
  );
}
