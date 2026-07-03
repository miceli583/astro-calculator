// Shared solar-arc constants used by Human Design and Gene Keys.
//
// Both systems compute a "Design" chart cast when the Sun was exactly
// HD_DESIGN_ARC_DEG earlier in ecliptic longitude than at birth. The Newton's
// method solver in both calculators uses SOLAR_MEAN_MOTION_DEG_PER_DAY to
// seed an initial JD guess.

/** Sun's average apparent daily motion in ecliptic longitude (deg/day). */
export const SOLAR_MEAN_MOTION_DEG_PER_DAY = 0.9856;

/** Human Design / Gene Keys design-chart solar arc offset (degrees before birth). */
export const HD_DESIGN_ARC_DEG = 88;

/** Approximate number of mean solar days corresponding to the design arc (~89.28). */
export const HD_DESIGN_ARC_APPROX_DAYS =
  HD_DESIGN_ARC_DEG / SOLAR_MEAN_MOTION_DEG_PER_DAY;
