import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * Sveltia CMS writes a blank optional field as `null`, but Zod's `.optional()`
 * only accepts the key being absent — so a field left empty in the CMS would
 * fail `astro check` and the build, and the change could not be published.
 * Drop `null`-valued keys before validation so a blank CMS field is treated as
 * "not set". Wrap every CMS-edited collection schema with `cmsSchema(...)`.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  // Only recurse into plain objects — leave Date (from YAML), etc. untouched.
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, dropNulls(v)]),
    );
  }
  return value;
}

const cmsSchema = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(dropNulls, schema);

/**
 * Shared frontmatter used by every editorial collection.
 * `lastReviewed` is the date a human last checked the page against the CARs.
 */
const reviewable = {
  lastReviewed: z.coerce.date(),
  reviewedBy: z.string().default('tiredpilots.ca'),
  draft: z.boolean().default(false),
  lang: z.enum(['en', 'fr']).default('en'),
  /** Old Google Sites paths that should 301 to this page. */
  legacyPaths: z.array(z.string()).default([]),
  /** Map of old `#h.<hash>` anchor id -> new heading id on this page. */
  legacyAnchors: z.record(z.string(), z.string()).default({}),
};

/**
 * One CARs section per file. Metadata lives in frontmatter; the MDX body is the
 * plain-language explanation plus the current in-force text (with headings that
 * become anchor targets). The pre-2018 wording goes in `oldText` and renders
 * behind a <details> expander.
 */
const regulations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/regulations' }),
  schema: cmsSchema(
    z.object({
      title: z.string(),
      section: z.string().regex(/^\d{3}(\.\d+)?$/, 'Use a CARs number like 700.28'),
      sor: z.string().default('SOR/96-433'),
      part: z.enum(['I', 'VI', 'VII']).default('VII'),
      subpart: z.string().optional(), // "703/704/705" | "Medevac" | "FRMS" | "Interpretation"
      order: z.number().default(0),
      slug: z.string().optional(),
      summary: z.string(), // one plain-language sentence -> meta description
      lawUrl: z.string().url(),
      retrievedOn: z.coerce.date(),
      acUrl: z.string().url().optional(), // Advisory Circular 700-047
      effectiveDate: z.coerce.date().optional(),
      changesExplained: z.string().optional(), // short paraphrase of the AC
      hasOldVersion: z.boolean().default(false),
      oldText: z.string().optional(), // pre-2018 text -> expander
      dataModule: z.enum(['fdp', 'augmentedCrew', 'medevac', 'oldVsNew']).optional(),
      relatedCalculator: z.enum(['none', 'fdp']).default('none'),
      relatedExplainers: z.array(reference('explainers')).default([]),
      ...reviewable,
    }),
  ),
});

const workedExample = z.object({
  label: z.string(),
  scenario: z.string(), // markdown
  inputs: z.record(z.string(), z.unknown()).optional(), // maps to FdpInput for cross-check tests
  expected: z.string(), // human-readable expected answer
  expectedFdpHours: z.number().optional(), // machine-checkable target
  citation: z.string(),
});

/** The Q&A explainers. Body is MDX so it can embed <WorkedExample> / the calculator. */
const explainers = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/explainers' }),
  schema: cmsSchema(
    z.object({
      title: z.string(),
      slug: z.string().optional(),
      question: z.string(),
      summary: z.string(),
      order: z.number().default(0),
      relatedRegulations: z.array(reference('regulations')).default([]),
      relatedCalculator: z.enum(['none', 'fdp']).default('none'),
      lawRefs: z.array(z.string()).default([]),
      lawUrl: z.string().url().optional(), // laws-lois.justice.gc.ca deep link
      acUrl: z.string().url().optional(), // Advisory Circular 700-047
      workedExamples: z.array(workedExample).default([]),
      ...reviewable,
    }),
  ),
});

/**
 * Verbatim text of a CARs section, shown behind a "Regulation text" expander on
 * the matching regulation page. Kept separate from the editorial `regulations`
 * collection because it only changes when the law itself changes. The entry id
 * (filename) matches the regulation's slug, e.g. `700-28`.
 */
const regulationText = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/regulation-text' }),
  schema: cmsSchema(
    z.object({
      section: z.string(),
      sourceUrl: z.string().url(),
      retrievedOn: z.coerce.date(),
      lang: z.enum(['en', 'fr']).default('en'),
    }),
  ),
});

/** Standalone editorial pages: Home, About, Coming Into Force, Cheat Sheet, Changelog. */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: cmsSchema(
    z.object({
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      order: z.number().default(0),
      navGroup: z.string().optional(),
      showInNav: z.boolean().default(false),
      hero: z.string().optional(),
      ...reviewable,
    }),
  ),
});

/**
 * Site-wide settings, edited in the CMS as a one-entry "file" collection.
 * The CMS writes a flat JSON object; the parser wraps it as the single `site` entry.
 * Read it with: getEntry('settings', 'site').
 */
const settings = defineCollection({
  loader: file('src/content/settings/site.json', {
    parser: (text) => ({ site: JSON.parse(text) }),
  }),
  schema: cmsSchema(
    z.object({
      disclaimer: z.string(),
      contactEmail: z.string().email(),
      defaultReviewer: z.string().default('tiredpilots.ca'),
      nav: z
        .array(
          z.object({
            label: z.string(),
            href: z.string(),
          }),
        )
        .default([]),
    }),
  ),
});

export const collections = { regulations, regulationText, explainers, pages, settings };
