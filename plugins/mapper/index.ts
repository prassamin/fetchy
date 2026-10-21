import type { NextConfig } from "next";
import path from "path";
import { glob } from "glob";
import chokidar from "chokidar";
import { existsSync } from "fs";
import { compileToolConfig } from "./compiler";
import { expandBraces, writeDefault } from "./utils";
import { updateToolsMap } from "./update";
import { unlink } from "fs/promises";

const WATCH_FLAG = "_FETCHY_TOOLS_MAPPER";
export const CONFIG_FILE_PATH = "tool.config.ts";
export const ROOT_FILE = "page.{tsx,ts,jsx,js}";
export const META_FILE = "meta.{tsx,ts,jsx,js}";
export const OUTPUT_DIR = ".tools";
export const COMPILED_CONFIG_PATH = "tool.config.mjs";
export const TOOLS_MAP_PATH = path.resolve(OUTPUT_DIR, "index.ts");

export function withToolsMapper() {
  const isDev = process.argv.includes("dev");
  const isBuild = process.argv.includes("build");

  if ((isDev || isBuild) && process.env[WATCH_FLAG] !== "1") {
    process.env[WATCH_FLAG] = "1";

    setTimeout(async () => {
      await compileToolConfig();
      const configPath = path.resolve(OUTPUT_DIR, COMPILED_CONFIG_PATH);

      if (existsSync(configPath)) {
        const { config } = await import(configPath);
        if (isDev) {
          await startWatcher(config.dir);
        } else {
          const pattern = `${config.dir}/**/*`;
          const files = await glob(pattern);
          await updateToolsMap(
            files.filter((f) =>
              expandBraces(ROOT_FILE).some((ending) => f.endsWith(ending))
            )
          );
        }
      }
    }, 500);
  }

  return (nextConfig: NextConfig = {}) => ({
    ...nextConfig,
    pageExtensions: nextConfig.pageExtensions ?? ["ts", "tsx", "js", "jsx"],
  });
}

async function startWatcher(dir: string) {
  const pattern = `${dir}/**/*`;
  const files = await glob(pattern);

  await updateToolsMap(
    files.filter((f) =>
      expandBraces(ROOT_FILE).some((ending) => f.endsWith(ending))
    )
  );

  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on("change", async () => {
    const files = await glob(pattern);
    await updateToolsMap(
      files.filter((f) =>
        expandBraces(ROOT_FILE).some((ending) => f.endsWith(ending))
      )
    );
  });

  watcher.on("unlink", async (filePath) => {
    if (expandBraces(ROOT_FILE).some((ending) => filePath.endsWith(ending))) {
      delete files[files.indexOf(filePath)];
      await updateToolsMap(
        files.filter((f) =>
          expandBraces(ROOT_FILE).some((ending) => f.endsWith(ending))
        )
      );
      await unlink(
        path.join(...filePath.split(path.sep).slice(0, -1), "meta.ts")
      );
    }
  });

  watcher.on("add", async (filePath) => {
    await writeDefault(filePath);
  });
}
