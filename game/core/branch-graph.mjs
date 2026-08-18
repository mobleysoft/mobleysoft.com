import { add, cross, normalize, scale } from "../engine/math.mjs";

export function applyBranchFork(world, request, originWorld) {
  const sourceBranchId = request.sourceBranchId;
  const branchId = `branch-${world.timeline.branchCounter}`;
  world.timeline.branchCounter += 1;
  const source = world.timeline.branches.find((branch) => branch.id === sourceBranchId);
  if (source) source.status = "preserved";
  world.timeline.branches.push({
    createdAtExecutionTick: world.tick,
    forkTick: request.targetTick,
    id: branchId,
    parentId: sourceBranchId,
    status: "active",
  });

  const earlierCraft = structuredClone(originWorld.craft);
  const radial = normalize(earlierCraft.position, [0, 0, 1]);
  let tangent = normalize(cross(radial, [0, 1, 0]), [1, 0, 0]);
  if (Math.abs(tangent[0]) + Math.abs(tangent[1]) + Math.abs(tangent[2]) < 0.1) tangent = [1, 0, 0];
  const traveler = world.craft;
  traveler.branchId = branchId;
  traveler.originBranchId = sourceBranchId;
  traveler.position = add(earlierCraft.position, add(scale(radial, 22), scale(tangent, 38)));
  traveler.velocity = add(earlierCraft.velocity, scale(tangent, 2));
  traveler.boundaryContact = false;

  world.echoes = [{
    branchId,
    craft: earlierCraft,
    id: `earlier-self-${world.timeline.branchCounter - 1}`,
    replayTick: request.targetTick,
    sourceBranchId,
  }];
  world.timeline.activeBranchId = branchId;
  world.timeline.localTick = request.targetTick;
  world.scene = "past-exterior";
  world.interior.exitReady = false;
  world.interior.coherenceTicks = 0;
  world.mission.contactTicks = 0;
  world.scan.active = false;
  world.scan.quality = 0;
  world.events.push({
    branchId,
    parentId: sourceBranchId,
    targetTick: request.targetTick,
    tick: world.tick,
    type: "branch-created",
  });
  world.commands.push({ tick: world.tick, type: "save-checkpoint" });
  return branchId;
}
