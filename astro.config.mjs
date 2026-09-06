// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import pagefind from 'astro-pagefind';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

// The final canonical origin. The site is developed on a temporary *.pages.dev
// URL; only the DNS cutover (Stage 4) makes this address live.
const SITE = 'https://tiredpilots.ca';

/**
 * Wrap every Markdown/MDX <table> in <div class="table-scroll"> so wide tables
 * scroll on small screens instead of overflowing the page. Component tables
 * (DataTable / FdpTables) bring their own scroll container and are untouched.
 */
function rehypeWrapTables() {
  /** @param {any} child */
  const wrap = (child) => {
    walk(child);
    if (child.type === 'element' && child.tagName === 'table') {
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'] },
        children: [child],
      };
    }
    return child;
  };
  /** @param {any} node */
  const walk = (node) => {
    if (Array.isArray(node.children)) node.children = node.children.map(wrap);
  };
  /** @param {any} tree */
  return (tree) => {
    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // English ships unprefixed (/foo); a French edition can be added later under
  // /fr with no schema or routing rework.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [mdx(), sitemap(), preact({ compat: true }), pagefind()],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'wrap',
          properties: { className: ['heading-anchor'] },
        },
      ],
      rehypeWrapTables,
    ],
  },
});
