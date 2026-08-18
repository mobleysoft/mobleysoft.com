import { length, subtract } from "../engine/math.mjs";
import { integrateCraft } from "./flight-system.mjs";
import { enforceExteriorBoundary } from "./horizon-system.mjs";

export function echoSystem(world, input, context) {
  if (world.scene !== "past-exterior") return;
  let nearestRange = Infinity;
  for (const echo of world.echoes) {
    const echoInput = context.inputAtBranch(echo.sourceBranchId, echo.replayTick);
    integrateCraft(echo.craft, echoInput, context.delta, context.content, world.events, echo.id);
    enforceExteriorBoundary(echo.craft, context.content, world.events, echo.id);
    echo.replayTick += 1;
    nearestRange = Math.min(nearestRange, length(subtract(world.craft.position, echo.craft.position)));
  }

  const linked = input.scan && nearestRange <= context.content.contact.range;
  world.scan.active = linked;
  world.scan.quality = Number.isFinite(nearestRange)
    ? Math.max(0, 1 - nearestRange / context.content.contact.range)
    : 0;
  if (linked) {
    if (world.mission.contactTicks === 0) world.events.push({ range: nearestRange, tick: world.tick, type: "echo-link-started" });
    world.mission.contactTicks += 1;
  } else {
    world.mission.contactTicks = Math.max(0, world.mission.contactTicks - 1);
  }
}
