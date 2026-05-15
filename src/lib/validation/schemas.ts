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

export const astrocartoInputSchema = birthDataSchema.extend({
  planets: z.array(planetEnum).optional(),
  latitude_step: z.number().positive().max(10).optional(),
  min_latitude: z.number().min(-90).max(90).optional(),
  max_latitude: z.number().min(-90).max(90).optional(),
});

export const humanDesignInputSchema = birthDataSchema;

export const geneKeysInputSchema = birthDataSchema;

export type BirthDataInput = z.infer<typeof birthDataSchema>;
export type DateOnlyInput = z.infer<typeof dateOnlySchema>;
export type NatalInput = z.infer<typeof natalInputSchema>;
export type TransitInput = z.infer<typeof transitInputSchema>;
export type AstroCartoInput = z.infer<typeof astrocartoInputSchema>;
export type HumanDesignInput = z.infer<typeof humanDesignInputSchema>;
export type GeneKeysInput = z.infer<typeof geneKeysInputSchema>;
