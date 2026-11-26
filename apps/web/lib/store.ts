import type { World, Analysis } from "@bloodnet/core";
import { analyze } from "@bloodnet/core";
import { generateWorld } from "@bloodnet/data";

declare global {
  // eslint-disable-next-line no-var
  var __bloodnet_world: World | undefined;
}

export function getWorld(): World {
  if (!globalThis.__bloodnet_world) {
    globalThis.__bloodnet_world = generateWorld(42);
  }
  return globalThis.__bloodnet_world;
}

export function setWorld(world: World): World {
  globalThis.__bloodnet_world = world;
  return globalThis.__bloodnet_world;
}

export function resetWorld(): World {
  globalThis.__bloodnet_world = generateWorld(42);
  return globalThis.__bloodnet_world;
}

export function getAnalysis(): Analysis {
  const world = getWorld();
  return analyze(world);
}
