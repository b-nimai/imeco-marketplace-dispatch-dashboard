import { useEffect, useRef } from 'react';

import logoVideo from '@/assets/imeco_logo_1.mp4';

/**
 * The animated IMECO wordmark.
 *
 * Three things about the source file drive everything here.
 *
 * 1. It is 1280×720 with the wordmark floating in the middle of a lot of empty frame, and
 *    the header slot is roughly 2.7:1. So the video is scaled up and offset inside an
 *    overflow-hidden box — a CSS crop. `object-fit: cover` cannot do this: it only ever
 *    crops to the container's aspect around a point, which would leave the wordmark tiny
 *    inside a mostly-empty box.
 *
 * 2. Its background is pure black, not transparent — mp4 has no alpha. `mix-blend-mode:
 *    screen` is what makes that black drop away against the dark header: screen leaves
 *    black untouched and keeps the light wordmark, so no letterbox shows.
 *
 * 3. THE MARK DRIFTS AS IT SETTLES. It reads clearly from about t=4s at 803×227 and eases
 *    down to 751×205 by the end. Measured per frame at 0.1s steps, filtering out the smoke
 *    by requiring a column to carry ≥10 bright pixels — a letter stroke does, a particle
 *    trail does not.
 *
 *    So the crop is the UNION of those bounds rather than the final frame's: sized to the
 *    final frame, every earlier and slightly larger frame would have its outer letters
 *    sliced. The union means THE WORDMARK IS NEVER CUT, at any point in the loop, and the
 *    cost is only that at rest it sits at ~90% of the box height instead of filling it.
 *
 *    The clip loops in full, all 10s. For the first few seconds the particle plume sweeps
 *    well outside this window and is clipped at its edges. That is smoke, not letterforms,
 *    and no crop that keeps the wordmark legible could contain it.
 */

/**
 * Union of the wordmark's bounds across every frame from when it reads clearly (t≈4s) to the
 * end. Cropping to this is what guarantees no letter is ever clipped.
 *
 * Re-measure these if the source clip is replaced — they are specific to the file.
 */
const MARK = { x: 271, y: 238, w: 803, h: 227 };
const FRAME = { w: 1280, h: 720 };

/**
 * Breathing room either side, in source pixels, so the mark is not flush against the crop.
 *
 * Horizontal only, and applied symmetrically so the centre does not move. Because the scale
 * is set by the crop's HEIGHT, padding the sides costs the mark no size at all — it only
 * widens the box. Vertical padding would shrink the mark, which is the one thing there is
 * no room for.
 */
const PAD_X = 36;

const CROP = {
  x: MARK.x - PAD_X,
  y: MARK.y,
  w: MARK.w + PAD_X * 2,
  h: MARK.h,
};

/**
 * Height is the hard constraint, width is free.
 *
 * 43px is exactly as tall as the title block sitting next to it, which is what sets the
 * header's height — so the box fills the bar completely without making it one pixel taller.
 * Width then follows from the crop's own aspect rather than being chosen and cropped to.
 */
const BOX_H = 43;
const BOX_W = Math.round((BOX_H * CROP.w) / CROP.h);

const scale = BOX_H / CROP.h;
const videoW = FRAME.w * scale;
const cropCentre = { x: CROP.x + CROP.w / 2, y: CROP.y + CROP.h / 2 };
const offset = {
  left: BOX_W / 2 - cropCentre.x * scale,
  top: BOX_H / 2 - cropCentre.y * scale,
};

export function LogoMark({ syncing }: { syncing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  // The rest of the dashboard opts out of motion via CSS, which cannot reach a <video>.
  // Skip straight to the frame it would have ended on.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    video.loop = false; // otherwise it restarts the moment anything resumes it
    video.pause();
    const settle = () => {
      video.currentTime = video.duration;
    };
    if (video.readyState >= 1) settle();
    else video.addEventListener('loadedmetadata', settle, { once: true });
  }, []);

  // Restart the reveal whenever a sync starts — the mark is the refresh button, so this is
  // also the only feedback that a click did anything.
  useEffect(() => {
    const video = ref.current;
    if (!video || !syncing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    video.currentTime = 0;
    void video.play().catch(() => {
      /* autoplay policy — the frame on screen is still a valid one */
    });
  }, [syncing]);

  return (
    <span
      className="relative block shrink-0 overflow-hidden"
      style={{ width: BOX_W, height: BOX_H }}
    >
      <video
        ref={ref}
        src={logoVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        className="absolute max-w-none"
        style={{
          width: videoW,
          left: offset.left,
          top: offset.top,
          mixBlendMode: 'screen',
        }}
      />
    </span>
  );
}
