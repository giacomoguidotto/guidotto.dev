// Gyro tilt → field parallax (the native-phone translation of the hero's desktop
// pointer parallax). The hero field parallax writes `--mx` / `--my` from pointer
// movement, but a phone has no mouse, so the field would sit static; here device
// tilt drives the same two vars instead. The phone is treated as more feedback
// channels for the same one physics (see CONTEXT → "Mobile-native input → Gyro
// tilt → field parallax"): a *subtle sway*, not a ride.
//
// Two parts, split so the maths is unit-testable on its own:
//   - `TiltMapper` — the pure, DOM-free mapping: calibrate to the orientation at
//     first read (relative deltas, so the rest pose is wherever you happen to
//     hold the phone), low-pass smooth, and clamp to a small range.
//   - `startGyroTilt` — the thin DOM controller: wires `DeviceOrientationEvent`,
//     the iOS permission piggyback, recalibration on `orientationchange`, and
//     teardown. It never decides *whether* the field should move (reduced-motion
//     gating lives in ShowcaseRoot, the single owner of `--mx` / `--my`).

// Degrees of relative tilt that reach the clamp's edge. A comfortable hold sways
// the phone well under this, so typical tilt lands a fraction of `TILT_RANGE`.
const TILT_FULL_DEG = 28;
// Max |mx| / |my| the tilt can drive. The pointer reaches ±0.5 at the screen
// edges; the gyro is held to a smaller reach so it reads as a subtle sway, never
// the full-throw parallax a mouse can sweep.
const TILT_RANGE = 0.3;
// Low-pass factor folded in per reading (0..1): lower is smoother and laggier.
// Orientation events fire at the device rate (~60Hz), so this is an exponential
// moving average that strips the sensor jitter without a visible lag.
const SMOOTHING = 0.18;

const clampRange = (value: number): number =>
  Math.min(TILT_RANGE, Math.max(-TILT_RANGE, value));

/** One device-orientation sample, in degrees (the two axes the field uses). */
export interface TiltReading {
  /** Front-back tilt (`DeviceOrientationEvent.beta`) → vertical `--my`. */
  beta: number;
  /** Left-right tilt (`DeviceOrientationEvent.gamma`) → horizontal `--mx`. */
  gamma: number;
}

/** The smoothed, clamped field offsets a reading maps to (the `--mx` / `--my`). */
export interface FieldOffset {
  mx: number;
  my: number;
}

// The tilt → parallax mapper. Stateful (it holds the calibration baseline and the
// smoothed value) but DOM-free, so the whole feel — calibration, smoothing,
// clamp — is exercised by plain unit tests.
export class TiltMapper {
  private baseGamma: number | null = null;
  private baseBeta: number | null = null;
  private mx = 0;
  private my = 0;

  // Drop the calibration so the next reading re-bases the rest pose. The smoothed
  // value is kept, so after a recalibration the field eases back toward centre
  // (the new baseline reads as ~0 delta) instead of snapping.
  recalibrate(): void {
    this.baseGamma = null;
    this.baseBeta = null;
  }

  // Fold a reading in and return the field offset. The first reading after a
  // (re)calibration sets the baseline, so it maps to the rest position; every
  // reading thereafter is a relative, smoothed, clamped delta from it.
  push(reading: TiltReading): FieldOffset {
    if (this.baseGamma === null || this.baseBeta === null) {
      this.baseGamma = reading.gamma;
      this.baseBeta = reading.beta;
    }
    const targetX = clampRange(
      ((reading.gamma - this.baseGamma) / TILT_FULL_DEG) * TILT_RANGE
    );
    const targetY = clampRange(
      ((reading.beta - this.baseBeta) / TILT_FULL_DEG) * TILT_RANGE
    );
    this.mx += SMOOTHING * (targetX - this.mx);
    this.my += SMOOTHING * (targetY - this.my);
    return { mx: this.mx, my: this.my };
  }
}

// iOS 13+ gates `DeviceOrientationEvent` behind a permission prompt that must be
// requested from a user gesture; it exposes a static `requestPermission()` that
// is absent on Android and desktop. It is a WebKit extension, so it is not in the
// DOM lib types — narrow it here rather than reaching for `any`.
type OrientationPermission = "granted" | "denied" | "default";
interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<OrientationPermission>;
}

const permissionRequester = ():
  | (() => Promise<OrientationPermission>)
  | undefined => {
  if (typeof DeviceOrientationEvent === "undefined") {
    return;
  }
  const requester = (
    DeviceOrientationEvent as unknown as DeviceOrientationEventStatic
  ).requestPermission;
  return typeof requester === "function" ? requester : undefined;
};

/** The running tilt driver: an iOS permission piggyback plus teardown. */
export interface GyroTilt {
  /**
   * The iOS permission piggyback: request orientation access from a user
   * gesture and, if granted, start driving the field. Idempotent and safe to
   * call on every tap. A no-op where no gesture gate exists (Android / desktop,
   * which already started listening) and after a denial (the field just rests —
   * no error, no nag).
   */
  enable: () => void;
  /** Remove every listener (ShowcaseRoot calls this on cleanup). */
  stop: () => void;
}

// Start driving `onTilt(mx, my)` from device orientation. Android and desktop
// have no permission gate, so listening starts immediately; iOS waits for
// `enable()` (called from the hero's first tap-to-light). Callers own the
// reduced-motion decision — this only runs once they have decided the field may
// move. Recalibrates on `orientationchange` (landscape/portrait flips the axes,
// and the relative baseline re-bases to wherever the phone now rests).
export function startGyroTilt(
  onTilt: (mx: number, my: number) => void
): GyroTilt {
  const mapper = new TiltMapper();
  let listening = false;
  let requested = false;

  const onOrientation = (event: DeviceOrientationEvent) => {
    // A device without the sensors (or a browser that fires the event empty)
    // reports null axes; leave the field at rest rather than jumping to 0,0.
    if (event.gamma === null || event.beta === null) {
      return;
    }
    const { mx, my } = mapper.push({ gamma: event.gamma, beta: event.beta });
    onTilt(mx, my);
  };

  const onRecalibrate = () => mapper.recalibrate();

  const listen = () => {
    if (listening) {
      return;
    }
    listening = true;
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("orientationchange", onRecalibrate);
  };

  const requestPermission = permissionRequester();

  // No gesture gate (Android / desktop with a sensor): begin immediately.
  if (!requestPermission) {
    listen();
  }

  return {
    enable: () => {
      // Only iOS reaches the request; everywhere else this is already listening.
      // Guard `requested` so a flurry of taps asks exactly once, and a denial is
      // final (the gyro is offered on the first tap, not nagged on every one).
      if (!requestPermission || listening || requested) {
        return;
      }
      requested = true;
      requestPermission()
        .then((state) => {
          if (state === "granted") {
            listen();
          }
        })
        .catch(() => {
          // Denied / unsupported → the field simply rests.
        });
    },
    stop: () => {
      if (!listening) {
        return;
      }
      listening = false;
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("orientationchange", onRecalibrate);
    },
  };
}
