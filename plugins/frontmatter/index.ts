import type { NextConfig } from "next";
import chokidar from "chokidar";
import path from "path";
import { glob } from "glob";
import { updateJSFrontmatter, updateMDFrontmatter } from "./update";
import { buildDependencyTree } from "./tree";

export interface WithFrontmatterOptions {
  /**
   * Directories to watch
   */
  dir: string[];

  /**
   * Update frequency in seconds
   */
  frequency?: number;
}

const WATCH_FLAG = "_FETCHY_UPDATED_AT";
const JS_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const MD_EXTENSIONS = [".mdx", ".md"];

/**
 * Frontmatter Auto-Updater Plugin for Next.js (Dev Only)
 *
 * This plugin watches specified directories for file changes and automatically updates the `frontmatter` metadata,
 * injecting a fresh `updatedAt` timestamp whenever a file or one of its deep dependencies is modified.
 *
 * Designed specifically for Fetchy to keep tool and blog metadata always up to date during development.
 *
 * @remarks
 * - This only runs in development mode (`next dev`).
 * - It's best practice to **restart the dev server** whenever you add new tools or pages so dependency tracking stays in sync.
 * - Works with both `.mdx`, `.md` (markdown) and `.ts`, `.tsx`, `.js`, `.jsx` (Next.js pages).
 */
export function withFrontmatter({ dir, frequency }: WithFrontmatterOptions) {
  const isDev = process.argv.includes("dev");

  if (isDev && process.env[WATCH_FLAG] !== "1") {
    process.env[WATCH_FLAG] = "1";
    void startWatcher(dir, frequency);
  }

  return (nextConfig: NextConfig = {}): NextConfig => {
    return {
      ...nextConfig,
      pageExtensions: nextConfig.pageExtensions ?? [
        "ts",
        "tsx",
        "js",
        "jsx",
        "mdx",
        "md",
      ],
    };
  };
}

async function startWatcher(dir: string[], frequency?: number) {
  const globPatterns = (await Promise.all(dir.map((d) => glob(d)))).flat();

  const tree = buildDependencyTree(
    globPatterns.filter((d) => !MD_EXTENSIONS.includes(path.extname(d)))
  );

  const flatList = Object.values(tree).flat();
  const watchFiles = [...new Set([...flatList, ...globPatterns])];

  const watcher = chokidar.watch(watchFiles, {
    ignoreInitial: true,
    persistent: true,
  });

  console.log("[FrontMatter] Watching for file changes...");

  watcher.on("change", async (filePath) => {
    const ext = path.extname(filePath);

    if (MD_EXTENSIONS.includes(ext)) {
      void updateMDFrontmatter(filePath, { frequency });
    } else if (JS_EXTENSIONS.includes(ext)) {
      await Promise.all(
        Object.entries(tree).map(async ([entryFile, deps]) => {
          if (deps.includes(filePath)) {
            const segments = entryFile.split(path.sep);
            const metaFile = path.join(...segments.slice(0, -1), "meta.ts");
            await updateJSFrontmatter(metaFile, { frequency });
          }
        })
      );
    }
  });
}
