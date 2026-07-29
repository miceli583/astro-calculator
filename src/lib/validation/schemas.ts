// Zod input schemas for all REST endpoints.

import { z } from "zod";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const birthDataSchema = z.object({
  datetime: z
    .string()
    .regex(ISO_DATETIME, "Expected ISO format YYYY-MM-DDTHH:mm[:ss]"),
  timezone: z.string().min(1, "IANA timezone required, e.g. America/New_York"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const dateOnlySchema = z.object({
  date: z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"),
});

export const houseSystemSchema = z.enum([
  "placidus",
  "koch",
  "porphyrius",
  "regiomontanus",
  "campanus",
  "equal",
  "whole_sign",
]);

export const planetEnum = z.enum([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "mean_node",
  "true_node",
  "mean_lilith",
  "osc_lilith",
  "chiron",
  "ceres",
  "pallas",
  "juno",
  "vesta",
]);

export const natalInputSchema = birthDataSchema.extend({
  house_system: houseSystemSchema.optional(),
  planets: z.array(planetEnum).optional(),
});

export const transitInputSchema = z.object({
  natal: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  transit_datetime: z.string().regex(ISO_DATETIME),
  transit_timezone: z.string(),
  planets: z.array(planetEnum).optional(),
});

export const progressedInputSchema = birthDataSchema.extend({
  // Symbolic "day for a year" — accepting up to 200 years covers any human
  // lifespan plus generous headroom for historical-figure charts.
  years: z.number().min(0).max(200),
  planets: z.array(planetEnum).optional(),
});

export const aspectTypeSchema = z.enum([
  "conjunction",
  "sextile",
  "square",
  "trine",
  "quincunx",
  "opposition",
]);

const orbOverrideSchema = z
  .object({
    conjunction: z.number().min(0).max(15).optional(),
    sextile: z.number().min(0).max(15).optional(),
    square: z.number().min(0).max(15).optional(),
    trine: z.number().min(0).max(15).optional(),
    quincunx: z.number().min(0).max(15).optional(),
    opposition: z.number().min(0).max(15).optional(),
  })
  .partial();

export const transitSkyInputSchema = z.object({
  datetime: z.string().regex(ISO_DATETIME),
  timezone: z.string().min(1),
  planets: z.array(planetEnum).optional(),
});

export const transitToNatalInputSchema = z.object({
  natal: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  transit_datetime: z.string().regex(ISO_DATETIME),
  transit_timezone: z.string().min(1),
  transit_planets: z.array(planetEnum).optional(),
  aspects: z.array(aspectTypeSchema).optional(),
  orbs: orbOverrideSchema.optional(),
});

export const transitEventsInputSchema = z.object({
  natal: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  start_date: z.string().regex(ISO_DATE),
  end_date: z.string().regex(ISO_DATE),
  transit_planets: z.array(planetEnum).optional(),
  natal_points: z.array(z.string()).optional(),
  aspects: z.array(aspectTypeSchema).optional(),
  orbs: orbOverrideSchema.optional(),
  step_days: z.number().int().min(1).max(30).optional(),
});

export const skyEventsInputSchema = z.object({
  start_date: z.string().regex(ISO_DATE),
  end_date: z.string().regex(ISO_DATE),
  categories: z
    .array(z.enum(["retrograde", "lunation", "ingress", "eclipse"]))
    .optional(),
  retrograde_planets: z.array(planetEnum).optional(),
  ingress_planets: z.array(planetEnum).optional(),
});

export const synastryInputSchema = z.object({
  personA: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  personB: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  aspects: z.array(aspectTypeSchema).optional(),
  orbs: orbOverrideSchema.optional(),
});

export const compositeInputSchema = z.object({
  // 2–10 charts: the classic pair composite up to a ten-person group composite.
  charts: z
    .array(birthDataSchema)
    .min(2, "A composite chart needs at least 2 charts")
    .max(10, "A composite chart supports at most 10 charts"),
  house_system: houseSystemSchema.optional(),
});

export const geocodeInputSchema = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(10).optional(),
});

export const solarReturnInputSchema = z.object({
  natal: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  year: z.number().int().min(1500).max(3500),
  relocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      timezone: z.string(),
    })
    .optional(),
});

export const returnPlanetSchema = z.enum([
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
]);

export const planetaryReturnInputSchema = z.object({
  natal: birthDataSchema.extend({ house_system: houseSystemSchema.optional() }),
  planet: returnPlanetSchema,
  after_datetime: z.string().regex(ISO_DATETIME).optional(),
  after_timezone: z.string().optional(),
  relocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      timezone: z.string(),
    })
    .optional(),
});

export const astrocartoInputSchema = birthDataSchema.extend({
  planets: z.array(planetEnum).optional(),
  latitude_step: z.number().positive().max(10).optional(),
  min_latitude: z.number().min(-90).max(90).optional(),
  max_latitude: z.number().min(-90).max(90).optional(),
  include_parans: z.boolean().optional(),
  paran_resolution: z.number().positive().max(5).optional(),
});

export const humanDesignInputSchema = birthDataSchema;

export const geneKeysInputSchema = birthDataSchema;

export type AspectType = z.infer<typeof aspectTypeSchema>;
export type TransitSkyInput = z.infer<typeof transitSkyInputSchema>;
export type TransitToNatalInput = z.infer<typeof transitToNatalInputSchema>;
export type TransitEventsInput = z.infer<typeof transitEventsInputSchema>;
export type SkyEventsInput = z.infer<typeof skyEventsInputSchema>;
export type SynastryInput = z.infer<typeof synastryInputSchema>;
export type CompositeInput = z.infer<typeof compositeInputSchema>;

export type BirthDataInput = z.infer<typeof birthDataSchema>;
export type DateOnlyInput = z.infer<typeof dateOnlySchema>;
export type NatalInput = z.infer<typeof natalInputSchema>;
export type TransitInput = z.infer<typeof transitInputSchema>;
export type AstroCartoInput = z.infer<typeof astrocartoInputSchema>;
export type HumanDesignInput = z.infer<typeof humanDesignInputSchema>;
export type GeneKeysInput = z.infer<typeof geneKeysInputSchema>;
