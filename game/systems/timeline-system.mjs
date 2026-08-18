export function timelineSystem(world) {
  if (world.scene !== "interior" || !world.interior.exitReady) return;
  if (world.commands.some((command) => command.type === "fork-branch")) return;
  world.scene = "forking";
  world.commands.push({
    sourceBranchId: world.scan.selectedFrame.sourceBranchId,
    targetTick: world.interior.targetTick,
    tick: world.tick,
    type: "fork-branch",
  });
}
