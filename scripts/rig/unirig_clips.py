"""
unirig_clips.py — headless-Blender clip authoring for UniRig auto-rigs.

UniRig (an ML auto-rigger) outputs a GLB that is ALREADY skinned — armature +
mesh + excellent skin weights — but with NO animation and GENERIC bone names
(bone_0..bone_N). This tool:

    import GLB (armature + skinned mesh already present; DO NOT re-skin)
      -> CLASSIFY the generic bones into humanoid roles by geometry+hierarchy
      -> RENAME them to our canonical names (hips/spine/chest/neck/head,
         clavicle/upperarm/forearm/hand.L/R, thigh/shin/foot.L/R). Fingers/toes
         and any extra bones keep their original name (they ride their parent).
      -> author 5 WORLD-SPACE animation clips (idle/cast/guard/strike/hit) as
         separate Actions pushed to NLA tracks -> separate glTF animations
      -> export the animated GLB with the UNTOUCHED skinned mesh + weights.

Why world-space rotations (NOT local rotation_euler):
    UniRig bone ROLLS are arbitrary, so a local-axis euler rotation deforms each
    bone about an unpredictable axis. Instead we rotate every pose bone about a
    known WORLD axis around its own head (rotate_world below). This is
    roll-independent, so "raise the arm forward" is the same world-X rotation for
    every rig regardless of how UniRig happened to orient the bone.

Coordinate convention (CONFIRMED by inspecting the import, not assumed):
    The glTF importer converts Y-up -> Blender Z-up. Character stands along Z
    (feet ~ -0.49, head ~ +0.39). Left/right is X (RIGHT = +X, LEFT = -X, matching
    UniRig's bone_5.. right arm at +X). Depth is Y; the character faces -Y (front).
    World axes we drive: X = pitch (bend forward/back), Z = yaw/twist, Y = roll.

Usage:
    blender -b -P unirig_clips.py -- \
        --in <unirig.glb> --out <clips.glb> \
        [--render-dir <dir>]      # render + save verification PNGs
        [--target-tris N]         # optional DECIMATE COLLAPSE of the skinned mesh
                                  # BEFORE authoring (preserves vertex groups); off by default
        [--no-export]             # skip GLB export (render-only iteration)
"""

import bpy
import sys
import os
import math
import mathutils


# --------------------------------------------------------------------------- #
# arg parsing (everything after the standalone "--")
# --------------------------------------------------------------------------- #
def parse_args():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    out = {"in": None, "out": None, "render_dir": None, "export": True,
           "target_tris": 0}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--in":
            out["in"] = args[i + 1]; i += 2
        elif a == "--out":
            out["out"] = args[i + 1]; i += 2
        elif a == "--render-dir":
            out["render_dir"] = args[i + 1]; i += 2
        elif a == "--target-tris":
            out["target_tris"] = int(args[i + 1]); i += 2
        elif a == "--no-export":
            out["export"] = False; i += 1
        else:
            i += 1
    return out


def log(*a):
    print("[uclips]", *a)
    sys.stdout.flush()


D = math.radians  # degrees -> radians shorthand


# --------------------------------------------------------------------------- #
# import (armature + skinned mesh already present; keep the weights intact)
# --------------------------------------------------------------------------- #
def import_glb(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not arms:
        raise RuntimeError("no armature in imported GLB (UniRig should ship one)")
    arm_obj = arms[0]

    # UniRig sometimes ships a junk helper mesh (e.g. an Icosphere with no weights
    # and no armature modifier). Keep only skinned meshes (verts with weights AND
    # an Armature modifier bound to this armature); delete the rest so they don't
    # pollute the export.
    skinned = []
    junk = []
    for m in meshes:
        has_arm_mod = any(mo.type == "ARMATURE" and mo.object == arm_obj
                          for mo in m.modifiers)
        weighted = m.vertex_groups and any(v.groups for v in m.data.vertices)
        if has_arm_mod and weighted:
            skinned.append(m)
        else:
            junk.append(m)
    for m in junk:
        log("dropping non-skinned mesh:", m.name)
        md = m.data
        bpy.data.objects.remove(m, do_unlink=True)
        # also purge the orphan mesh DATABLOCK — the glTF exporter otherwise still
        # serializes leftover mesh data even though the object is unlinked, which
        # smuggles UniRig's junk Icosphere back into the export.
        if md and md.users == 0:
            bpy.data.meshes.remove(md)
    if not skinned:
        raise RuntimeError("no skinned mesh found in UniRig GLB")

    # join multiple skinned parts into one (rare, but keeps export/decimate simple)
    mesh = skinned[0]
    if len(skinned) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for m in skinned:
            m.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.join()

    bpy.context.view_layer.update()
    return arm_obj, mesh


def _tri_count(mesh):
    mesh.data.calc_loop_triangles()
    return len(mesh.data.loop_triangles)


def decimate_mesh(mesh, target_tris):
    """Optional DECIMATE COLLAPSE of the skinned mesh BEFORE authoring. Collapse
    preserves vertex groups / skin weights, so UniRig's excellent weighting rides
    through onto the reduced mesh. No-op if target_tris<=0 or already under budget."""
    if target_tris <= 0:
        return
    cur = _tri_count(mesh)
    if cur <= target_tris:
        log(f"decimate: {cur} tris already <= target {target_tris}, skipping")
        return
    ratio = max(0.01, min(1.0, target_tris / cur))
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    mod = mesh.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    # keep the collapse from destroying the skin: Blender's collapse preserves
    # vertex groups by default; run it before the Armature modifier deforms.
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log(f"decimated {cur} -> {_tri_count(mesh)} tris (ratio {ratio:.3f}, target {target_tris})")


# --------------------------------------------------------------------------- #
# CLASSIFIER — geometric + hierarchy, robust (NOT hard-coded to bone numbers)
# --------------------------------------------------------------------------- #
def _world_head(arm_obj, bone):
    return arm_obj.matrix_world @ bone.head_local


def _children_of(arm_obj, bone):
    return [b for b in arm_obj.data.bones if b.parent and b.parent.name == bone.name]


def classify_bones(arm_obj):
    """Return dict canonical_role -> bone_name, derived purely from geometry +
    hierarchy so it works for any UniRig humanoid, not just ld49.

    Convention (confirmed at import): Z up, RIGHT = +X, LEFT = -X, feet low-Z."""
    bones = list(arm_obj.data.bones)
    pos = {b.name: _world_head(arm_obj, b) for b in bones}

    # ---- 1. ROOT = parentless (lowest-Z tiebreak) -> hips ----
    roots = [b for b in bones if b.parent is None]
    if not roots:
        # degenerate; pick lowest-Z overall
        roots = [min(bones, key=lambda b: pos[b.name].z)]
    root = min(roots, key=lambda b: pos[b.name].z)
    mapping = {"hips": root.name}

    # ---- 2. SPINE CHAIN: from root, repeatedly pick the child that is most
    # CENTRAL (smallest |x|) AND continues UPWARD (increasing z). Collect the full
    # central chain, then assign roles top-down so the TOPMOST central bone is
    # always `head`. ----
    def central_chain(start):
        chain = [start]
        cur = start
        while True:
            kids = _children_of(arm_obj, cur)
            up = [k for k in kids if pos[k.name].z > pos[cur.name].z - 1e-4]
            if not up:
                break
            # most central child that goes up
            nxt = min(up, key=lambda k: abs(pos[k.name].x))
            # guard: the chosen child must be genuinely central (spine, not an arm
            # root that also happens to rise). If the most-central up-child is way
            # out laterally, the spine has ended.
            if abs(pos[nxt.name].x) > 0.06 + abs(pos[cur.name].x):
                break
            chain.append(nxt)
            cur = nxt
        return chain

    spine = central_chain(root)  # includes root as chain[0]
    # roles for the spine, top-down: the topmost is head, then neck, chest, spine.
    # hips stays the root (chain[0]); assign the remaining chain[1:].
    upper = spine[1:]  # above hips
    # desired role order for the bones above hips, from TOP down:
    top_down_roles = ["head", "neck", "chest", "spine"]
    if upper:
        # topmost -> head, working down; leftover lowest ones collapse to spine.
        n = len(upper)
        # from top: upper[-1] is topmost
        rev = list(reversed(upper))  # topmost first
        for i, b in enumerate(rev):
            role = top_down_roles[i] if i < len(top_down_roles) else "spine"
            # only set the first time we see a role (first from top wins for the
            # named slots; extras collapse into spine)
            if role not in mapping:
                mapping[role] = b.name
            else:
                mapping.setdefault("spine", b.name)
        # ensure the topmost is head even if chain was short
        mapping["head"] = rev[0].name
        if n >= 2 and "neck" not in mapping:
            mapping["neck"] = rev[1].name

    # ---- 3a. LEG ROOTS first (needed to disambiguate the arm branch): the root's
    # lateral children (off the central spine line) that lead a DESCENDING chain.
    # A thigh head can sit slightly ABOVE the pelvis root, so we don't test the
    # head's z directly — we require the bone to (a) be off-center (|x| lateral)
    # and (b) descend to its own children (the shin drops well below). This
    # identifies legs even when the hip joint sits above the pelvis centre.
    spine_names_early = {b.name for b in spine}

    def _descends(b):
        kids = _children_of(arm_obj, b)
        if not kids:
            # a lone lateral child of the root with no children: treat as leg if
            # it is below the root or clearly lateral.
            return pos[b.name].z <= pos[root.name].z + 0.05
        return min(pos[k.name].z for k in kids) < pos[b.name].z - 0.05

    leg_roots = [k for k in _children_of(arm_obj, root)
                 if k.name not in spine_names_early
                 and abs(pos[k.name].x) > abs(pos[root.name].x) + 0.008
                 and _descends(k)]
    leg_R = leg_L = None
    for k in leg_roots:
        if pos[k.name].x > 0 and (leg_R is None or pos[k.name].x > pos[leg_R.name].x):
            leg_R = k
        elif pos[k.name].x < 0 and (leg_L is None or pos[k.name].x < pos[leg_L.name].x):
            leg_L = k
    leg_root_names = {b.name for b in (leg_R, leg_L) if b}

    # ---- 3b. ARMS: the branch bone (chest) is the spine bone whose children go
    # strongly LATERAL AND roughly level/up (NOT the descending legs). Search the
    # spine chain ABOVE hips; a lateral child that is a known leg root, or that
    # drops well below its parent, is excluded. Split by sign(x). ----
    # The clavicle HEAD sits close to the spine (small |x|); it's the arm's DEEPER
    # bones that swing wide. So we detect the branch by a child that is (a) OFF the
    # central spine line (|x| clearly > the parent's central |x|), (b) not a leg
    # root, (c) not on the central spine chain, and (d) near/above the branch's own
    # height (arms don't descend like legs). One lateral child per side is enough.
    spine_names = {b.name for b in spine}
    arm_root_R = arm_root_L = None
    branch = None
    for b in spine:
        if b.name == root.name:
            continue  # legs branch here, not arms
        kids = _children_of(arm_obj, b)
        lat = [k for k in kids
               if k.name not in spine_names            # not the central continuation
               and k.name not in leg_root_names        # not a leg
               and abs(pos[k.name].x) > abs(pos[b.name].x) + 0.008
               and pos[k.name].z > pos[b.name].z - 0.15]  # stays near shoulder height
        # split by sign; need at least one lateral child (ideally two)
        rk = [k for k in lat if pos[k.name].x > 0]
        lk = [k for k in lat if pos[k.name].x < 0]
        if rk or lk:
            branch = b
            if rk:
                arm_root_R = max(rk, key=lambda k: pos[k.name].x)
            if lk:
                arm_root_L = min(lk, key=lambda k: pos[k.name].x)
            break

    def walk_arm(start):
        """From an arm-root (clavicle), walk choosing at each step the child that
        moves most OUTWARD (max |x|), then downward (min z). Collect up to 4 bones
        [clavicle, upperarm, forearm, hand]. Stop before the finger split: when a
        bone has multiple children whose |x| stops increasing (fingers fan/curl in),
        that bone is the hand and we stop."""
        chain = [start]
        cur = start
        while len(chain) < 4:
            kids = _children_of(arm_obj, cur)
            if not kids:
                break
            # if this bone already looks like the hand (2+ children that DON'T
            # continue strictly outward), stop here — its children are fingers.
            outward = [k for k in kids
                       if abs(pos[k.name].x) > abs(pos[cur.name].x) + 0.005]
            if len(kids) >= 2 and not outward:
                break
            cand = outward if outward else kids
            # continue down the arm: most outward, then lowest
            nxt = max(cand, key=lambda k: (abs(pos[k.name].x), -pos[k.name].z))
            chain.append(nxt)
            cur = nxt
            if len(kids) >= 3:
                # a 3+ way split = the hand (finger fan); stop after taking it as hand
                break
        return chain[:4]

    arm_roles = ["clavicle", "upperarm", "forearm", "hand"]
    for side, ar in (("R", arm_root_R), ("L", arm_root_L)):
        if ar is None:
            continue
        chain = walk_arm(ar)
        for role, b in zip(arm_roles, chain):
            mapping[f"{role}.{side}"] = b.name

    # ---- 4. LEGS: walk each leg root (found in 3a) choosing the LOWEST-z child:
    # [thigh, shin, foot]. ----
    def walk_leg(start):
        """Walk down a leg choosing the LOWEST-z child; [thigh, shin, foot]. Stop
        before toe splits (a bone with multiple children -> foot, its children are
        toes)."""
        chain = [start]
        cur = start
        while len(chain) < 3:
            kids = _children_of(arm_obj, cur)
            down = [k for k in kids if pos[k.name].z < pos[cur.name].z + 1e-3]
            if not down:
                break
            # continue down the LOWEST-z child (the ankle/foot line, not a toe that
            # sits at the same height as its parent). This walks thigh->shin->foot
            # even when the shin also sprouts a toe bone at the ankle.
            nxt = min(down, key=lambda k: pos[k.name].z)
            chain.append(nxt)
            cur = nxt
        return chain[:3]

    leg_roles = ["thigh", "shin", "foot"]
    for side, lr in (("R", leg_R), ("L", leg_L)):
        if lr is None:
            continue
        chain = walk_leg(lr)
        for role, b in zip(leg_roles, chain):
            mapping[f"{role}.{side}"] = b.name

    return mapping, (branch.name if branch else None)


def rename_bones(arm_obj, mapping):
    """Rename UniRig bones to canonical roles. Must be done in EDIT/OBJECT with
    the vertex groups following — Blender auto-renames the matching vertex groups
    on the skinned mesh when a bone is renamed IF we also rename the groups. We
    rename bone + its vertex group together so the skin stays bound."""
    # collect meshes skinned by this armature
    meshes = [o for o in bpy.data.objects
              if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm_obj
                                          for m in o.modifiers)]
    # invert to old->new, guarding against name collisions during rename by using
    # a temp prefix pass.
    old_to_new = {v: k for k, v in mapping.items()}

    bpy.context.view_layer.objects.active = arm_obj
    # 1) temp-rename bones and groups to avoid collisions (canonical names never
    # collide with bone_N, but be safe).
    for old, new in old_to_new.items():
        b = arm_obj.data.bones.get(old)
        if b:
            b.name = "__tmp__" + new
        for me in meshes:
            vg = me.vertex_groups.get(old)
            if vg:
                vg.name = "__tmp__" + new
    # 2) strip the temp prefix
    for old, new in old_to_new.items():
        b = arm_obj.data.bones.get("__tmp__" + new)
        if b:
            b.name = new
        for me in meshes:
            vg = me.vertex_groups.get("__tmp__" + new)
            if vg:
                vg.name = new


# --------------------------------------------------------------------------- #
# WORLD-SPACE pose helpers (roll-independent)
# --------------------------------------------------------------------------- #
def rotate_world(pb, axis_vec, angle, arm_obj):
    """Rotate a pose bone about a WORLD axis around its own (current) head.
    Roll-independent: doesn't care how the bone's local axes are oriented.
    Apply to PARENTS before CHILDREN (parent moves the child's head, and we read
    the live head each call)."""
    h = arm_obj.matrix_world @ pb.head  # live world head (parent pose included)
    R = mathutils.Matrix.Rotation(angle, 4, axis_vec)
    T = mathutils.Matrix.Translation(h)
    pb.matrix = T @ R @ T.inverted() @ pb.matrix
    bpy.context.view_layer.update()


WX = mathutils.Vector((1, 0, 0))  # left-right axis: pitch (bend forward/back)
WY = mathutils.Vector((0, 1, 0))  # depth axis: roll
WZ = mathutils.Vector((0, 0, 1))  # up axis: yaw / twist


def _reset_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def _key_all(arm_obj, names, frame):
    for n in names:
        pb = arm_obj.pose.bones.get(n)
        if pb:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            pb.keyframe_insert("location", frame=frame)


def _new_action(arm_obj, name):
    _reset_pose(arm_obj)
    act = bpy.data.actions.new(name)
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = act
    return act


def _push_to_nla(arm_obj, act, f0, f1):
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    ad = arm_obj.animation_data
    track = ad.nla_tracks.new()
    track.name = act.name
    track.strips.new(act.name, int(f0), act)
    ad.action = None
    # MUTE the stashed track. All strips start at frame 1 and overlap, so leaving them
    # live means the NEXT clip's keying (which does view_layer.update → depsgraph
    # re-evaluates the animation) captures the OTHER clips' poses into the new clip's
    # keyframes — that's what put a stride into `use` frame-1. Muted tracks don't
    # evaluate, so each clip is authored in isolation. export_glb unmutes before export.
    track.mute = True


# --------------------------------------------------------------------------- #
# clip authoring — each builds a full world-space pose per keyframe, keys ALL
# driven bones (so no bone leaks between keyframes), then pushes to its own NLA
# track. All bones referenced by canonical name; missing ones (short rigs) are
# silently skipped by rotate_world/_key_all.
# --------------------------------------------------------------------------- #
# ROLE GROUPS driven across clips (union) — keyed every keyframe for clean holds.
DRIVEN = ["hips", "spine", "chest", "neck", "head",
          "clavicle.L", "clavicle.R", "upperarm.L", "upperarm.R",
          "forearm.L", "forearm.R", "hand.L", "hand.R",
          "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R"]


def _pb(arm_obj, name):
    return arm_obj.pose.bones.get(name)


def _pose(arm_obj, ops):
    """Apply a list of (bone_name, world_axis, angle_rad) in order (parents first).
    Reads live head each op so parent rotations propagate correctly."""
    for name, axis, ang in ops:
        pb = _pb(arm_obj, name)
        if pb and abs(ang) > 1e-9:
            rotate_world(pb, axis, ang, arm_obj)


def _pose_loc(arm_obj, name, delta):
    """Translate a bone in WORLD space by delta (applied to its matrix)."""
    pb = _pb(arm_obj, name)
    if pb:
        pb.matrix = mathutils.Matrix.Translation(mathutils.Vector(delta)) @ pb.matrix
        bpy.context.view_layer.update()


# --- SIGN CONVENTION (CORRECTED 2026-07-01 after a front+side render check) ---
# The character faces -Y. A world-X rotation moves a bone's TAIL, and the sense
# depends on which way the bone points:
#   HANGING LIMB bones (arm/leg — tail BELOW head):
#     NEGATIVE world-X -> tail swings toward -Y  = FORWARD/UP-IN-FRONT (raise arm, knee fwd)
#     POSITIVE world-X -> tail swings toward +Y  = BACK/BEHIND
#   UPRIGHT bones (spine/neck/head — tail ABOVE head): the sense is REVERSED —
#     POSITIVE world-X -> lean FORWARD/down,  NEGATIVE -> lean BACK/up.
# (The earlier code had the limb sign inverted, so arms/legs swung BEHIND the body;
# torso/head were already correct. Limb swings below are now negative = forward.)
# World Z (twist): POSITIVE = counter-clockwise seen from above.


def author_idle(arm_obj):
    """Subtle breathing + gentle arm sway, loopable. 1..96."""
    _new_action(arm_obj, "idle")
    f0, fh, f1 = 1, 48, 96
    for f, s in ((f0, 0.0), (fh, 1.0), (f0 and f1, 0.0)):
        _reset_pose(arm_obj)
        _pose(arm_obj, [
            ("spine", WX, D(2.0) * s),      # small chest lift/settle
            ("chest", WX, D(-1.5) * s),
            ("head",  WX, D(-1.5) * s),
            ("upperarm.L", WX, D(-3.0) * s),  # tiny forward sway (NEG = forward)
            ("upperarm.R", WX, D(-3.0) * s),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_cast(arm_obj):
    """Both arms raise UP-AND-FORWARD, head tilts up, slight forearm bend. 1..60."""
    _new_action(arm_obj, "cast")
    f0, fpeak, f1 = 1, 40, 60
    keys = [(f0, 0.0), (fpeak, 1.0), (f1, 0.90)]
    for f, s in keys:
        _reset_pose(arm_obj)
        _pose(arm_obj, [
            # small clavicle raise (world Z opens the shoulder a touch)
            ("clavicle.R", WZ, D(-8) * s),
            ("clavicle.L", WZ, D(8) * s),
            # upperarms swing UP-AND-FORWARD ~110deg about world X (NEG = forward):
            # the arm starts hanging DOWN, so -110 carries it ABOVE horizontal into a
            # raised "reach up" in FRONT of the body (side-render verified).
            ("upperarm.R", WX, D(-110) * s),
            ("upperarm.L", WX, D(-110) * s),
            # slight forearm bend (continue the reach forward)
            ("forearm.R", WX, D(-22) * s),
            ("forearm.L", WX, D(-22) * s),
            # head tilts up (NEG world-X leans back/up), small spine counter-lean
            ("spine", WX, D(-6) * s),
            ("head",  WX, D(-14) * s),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_guard(arm_obj):
    """Kneel-and-brace: drop onto the RIGHT knee (knee near the ground, foot folded
    back behind), LEFT knee up with the foot planted in front, torso upright, forearms
    up in front (defensive). A one-knee genuflect, not a squat. 1..50."""
    _new_action(arm_obj, "guard")
    f0, fpeak, f1 = 1, 35, 50
    for f, s in ((f0, 0.0), (fpeak, 1.0), (f1, 0.94)):
        _reset_pose(arm_obj)
        # hips sink LOW (world -Z) so the down-knee can reach toward the ground; do it
        # before the limb rotations so the legs ride the sunk pelvis.
        _pose_loc(arm_obj, "hips", (0, 0, -0.22 * s))
        _pose(arm_obj, [
            ("hips",  WX, D(4) * s),        # tiny pelvis tuck
            # DOWN leg (R): thigh drops ~vertical & slightly back, shin folds hard back
            # so the shin lies behind under the body and the knee sinks low (kneeling).
            ("thigh.R", WX, D(16) * s),     # POS = slightly back/down
            ("shin.R",  WX, D(108) * s),    # fold lower leg back (foot behind, kneeling)
            ("foot.R",  WX, D(40) * s),     # toe/top-of-foot to the ground behind
            # UP leg (L): thigh swings FORWARD to ~horizontal, shin drops vertical to a
            # foot planted flat in FRONT (the classic raised-knee genuflect).
            ("thigh.L", WX, D(-88) * s),    # NEG = forward
            ("shin.L",  WX, D(90) * s),     # shin down to a planted forward foot
            ("foot.L",  WX, D(-22) * s),    # foot flat, forward
            # torso upright with a small forward set, forearms up in front (defensive)
            ("chest", WX, D(8) * s),
            ("upperarm.R", WX, D(-34) * s),
            ("upperarm.L", WX, D(-34) * s),
            ("forearm.R", WX, D(-52) * s),
            ("forearm.L", WX, D(-52) * s),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_walk(arm_obj):
    """Looping walk cycle: alternating leg strides with a knee lift on the swing leg,
    opposite-arm swing, a small hip bob at passing, tiny forward lean. 1..48 (frame 48
    repeats frame 1 for a seamless loop). NEG world-X = forward, POS shin = knee bend."""
    _new_action(arm_obj, "walk")
    f0, f1 = 1, 48
    A = 24     # thigh stride swing (deg)
    KNEE = 46  # shin knee-lift on the swing/passing leg
    ARM = 22   # opposite-arm swing
    BOB = 0.02 # hip rise at passing (on the single support leg)
    # (frame, thighL, thighR, shinL, shinR, armR, armL, hipZ)
    keys = [
        (1,  -A,  +A,   8,  8,  -ARM, +ARM, 0.0),     # L fwd / R back; R arm fwd
        (12,  0,   0,   8, KNEE,  0,    0,  BOB),      # passing: R leg swings thru (knee up)
        (24, +A,  -A,   8,  8,  +ARM, -ARM, 0.0),     # R fwd / L back; L arm fwd
        (36,  0,   0, KNEE, 8,    0,    0,  BOB),      # passing: L leg swings thru
        (48, -A,  +A,   8,  8,  -ARM, +ARM, 0.0),     # == key 1 (loop)
    ]
    for f, lt, rt, ls, rs, ra, la, hz in keys:
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (0, 0, hz))
        _pose(arm_obj, [
            ("spine", WX, D(2)),            # tiny forward lean into the walk
            ("thigh.L", WX, D(lt)),
            ("thigh.R", WX, D(rt)),
            ("shin.L",  WX, D(ls)),
            ("shin.R",  WX, D(rs)),
            ("upperarm.R", WX, D(ra)),
            ("upperarm.L", WX, D(la)),
            ("forearm.R", WX, D(-10)),      # slight constant elbow bend
            ("forearm.L", WX, D(-10)),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_strike(arm_obj):
    """Lunge: right arm swings forward-down, chest twists, weight forward. 1..40."""
    _new_action(arm_obj, "strike")
    f0, fwind, fhit, f1 = 1, 12, 26, 40
    # A hip-chambered forward punch: the fist DRAWS TO THE HIP (upper arm stays at the
    # side — only a slight pull-back — while the forearm cocks the fist up to the
    # waist), then the arm DRIVES FORWARD to roughly horizontal. Keeping uR small on the
    # wind stops the arm from rising up BEHIND the torso (the old +45 backswing); the
    # motion now originates at the hip. NEG world-X = forward.
    frames = [
        (f0,   dict(uR=0,   fR=0,   tw=0,  lean=0,  hips=0,  th=0)),
        (fwind, dict(uR=12,  fR=48,  tw=-8, lean=-4, hips=-6, th=6)),    # chamber at hip
        (fhit,  dict(uR=-80, fR=-15, tw=8,  lean=10, hips=6,  th=-22)),  # drive forward
        (f1,    dict(uR=0,   fR=0,   tw=0,  lean=0,  hips=0,  th=0)),   # recover
    ]
    for f, p in frames:
        _reset_pose(arm_obj)
        _pose(arm_obj, [
            ("hips",  WZ, D(p["hips"])),
            ("spine", WX, D(p["lean"])),        # weight forward on the hit
            ("chest", WZ, D(p["tw"])),          # modest torso twist about world Z
            ("neck",  WZ, D(-p["tw"] * 0.5)),   # counter so the head stays forward
            ("thigh.R", WX, D(p["th"])),        # step / weight forward
            ("upperarm.R", WX, D(p["uR"])),     # POS = swing forward
            ("forearm.R",  WX, D(p["fR"])),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_hit(arm_obj):
    """Recoil: spine leans BACK ~20deg, arms flinch outward briefly. 1..24."""
    _new_action(arm_obj, "hit")
    f0, fpeak, f1 = 1, 8, 24
    for f, s in ((f0, 0.0), (fpeak, 1.0), (f1, 0.0)):
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (0, 0.04 * s, 0))  # shove back (+Y)
        _pose(arm_obj, [
            ("spine", WX, D(-20) * s),   # NEG world-X = lean BACK ~20deg
            ("chest", WX, D(-10) * s),
            ("head",  WX, D(-18) * s),   # head snaps back
            # arms flinch outward (world Z opens them away from the body) + up
            ("upperarm.R", WZ, D(-30) * s),
            ("upperarm.L", WZ, D(30) * s),
            ("upperarm.R", WX, D(18) * s),
            ("upperarm.L", WX, D(18) * s),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_run(arm_obj):
    """Looping run cycle: like walk but bigger — larger thigh stride, stronger knee
    lift on the swing leg, a forward torso lean, bigger opposite-arm pump, more hip
    bob. 1..32 (frame 32 repeats frame 1 for a seamless loop). NEG world-X = forward,
    POS shin = knee bend."""
    _new_action(arm_obj, "run")
    f0, f1 = 1, 32
    A = 35      # thigh stride swing (deg) — bigger than walk's 24
    KNEE = 55   # shin knee-lift on the swing/passing leg — bigger than walk's 46
    ARM = 35    # opposite-arm pump — bigger than walk's 22
    BOB = 0.04  # hip rise (bigger bob than walk's 0.02)
    LEAN = 6    # forward torso lean (spine POS world-X = forward)
    # (frame, thighL, thighR, shinL, shinR, armR, armL, hipZ)
    keys = [
        (1,  -A,  +A,  12, 12,  -ARM, +ARM, 0.0),     # L fwd / R back; R arm fwd
        (8,   0,   0,  12, KNEE,  0,    0,  BOB),      # passing: R leg drives thru (knee up)
        (16, +A,  -A,  12, 12,  +ARM, -ARM, 0.0),     # R fwd / L back; L arm fwd
        (24,  0,   0, KNEE, 12,   0,    0,  BOB),      # passing: L leg drives thru
        (32, -A,  +A,  12, 12,  -ARM, +ARM, 0.0),     # == key 1 (loop)
    ]
    for f, lt, rt, ls, rs, ra, la, hz in keys:
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (0, 0, hz))
        _pose(arm_obj, [
            ("spine", WX, D(LEAN)),         # forward lean into the run (POS = forward)
            ("thigh.L", WX, D(lt)),
            ("thigh.R", WX, D(rt)),
            ("shin.L",  WX, D(ls)),
            ("shin.R",  WX, D(rs)),
            ("upperarm.R", WX, D(ra)),
            ("upperarm.L", WX, D(la)),
            ("forearm.R", WX, D(-40)),      # stronger elbow bend (arms pump high)
            ("forearm.L", WX, D(-40)),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_jump(arm_obj):
    """Vertical hop, one-shot 1..36: crouch (sink hips + bend knees, arms back) ->
    launch/apex (hips UP, legs extend, arms swing up/forward) -> land (dip + absorb,
    knees bend) -> settle to neutral. Hips translate in world Z to actually leave the
    ground. NEG world-X = forward/up for limbs, POS shin = knee bend."""
    _new_action(arm_obj, "jump")
    f0, fcrouch, fapex, fland, f1 = 1, 9, 20, 28, 36
    # (frame, hipZ, thigh(fwd NEG), shin(bend POS), upperarm(WX), forearm(WX), lean)
    frames = [
        (f0,      0.00,   0,    8,    0,    -10,   0),    # neutral stance
        (fcrouch, -0.22, -42,  74,   30,    -20,   4),    # CROUCH: deeper load before the launch
        (fapex,   +0.44,  -4,   4,  -120,   -30,  -4),    # APEX: hips up 2x (higher hop), legs extend
        (fland,   -0.16, -32,  60,   20,    -20,   3),    # LAND: dip, absorb with bent knees
        (f1,       0.00,   0,    8,    0,    -10,   0),    # settle to neutral
    ]
    for f, hz, th, sh, ua, fa, lean in frames:
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (0, 0, hz))
        _pose(arm_obj, [
            ("spine", WX, D(lean)),         # POS = forward crouch lean, NEG = arch on apex
            ("thigh.L", WX, D(th)),
            ("thigh.R", WX, D(th)),
            ("shin.L",  WX, D(sh)),
            ("shin.R",  WX, D(sh)),
            ("upperarm.R", WX, D(ua)),      # NEG = swing up/forward on the launch
            ("upperarm.L", WX, D(ua)),
            ("forearm.R", WX, D(fa)),
            ("forearm.L", WX, D(fa)),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_dodge(arm_obj):
    """Quick lateral side-step to the character's LEFT, one-shot 1..22, snappy: shift
    hips in world -X (LEFT = -X per the rig), lean the torso with the shift, a small
    knee bend, then return to neutral. Reads as a crisp weight-shift sidestep."""
    _new_action(arm_obj, "dodge")
    f0, fstep, f1 = 1, 9, 22
    SHIFT = 0.16   # lateral hip shift toward the character's LEFT (-X)
    # (frame, hipX, torso-roll(WY), knee-bend(POS shin), thigh(small))
    frames = [
        (f0,     0.0,    0,   6,   0),     # neutral
        (fstep, -SHIFT, -14,  22, -8),     # STEP LEFT: hips -X, torso rolls with it, knees bend
        (f1,     0.0,    0,   6,   0),     # recover to neutral
    ]
    for f, hx, roll, sh, th in frames:
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (hx, 0, 0))
        _pose(arm_obj, [
            ("spine", WY, D(roll)),         # roll the torso in the step direction (world Y)
            ("chest", WY, D(roll * 0.6)),
            ("thigh.L", WX, D(th)),
            ("thigh.R", WX, D(th)),
            ("shin.L",  WX, D(sh)),
            ("shin.R",  WX, D(sh)),
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_use(arm_obj):
    """Extend the RIGHT arm forward softly (offering/interact), one-shot 1..30, gentle:
    upperarm.R forward ~55deg (NEG world-X), forearm.R slight extend, hand relaxed, a
    tiny forward chest lean; hold briefly; ease back. Left arm stays at rest. Reads as
    'puts out the right hand, palm forward, softly.'"""
    _new_action(arm_obj, "use")
    f0, freach, fhold, f1 = 1, 14, 22, 30
    # (frame, scalar) — reach to the peak, hold, ease back to neutral
    for f, s in ((f0, 0.0), (freach, 1.0), (fhold, 1.0), (f1, 0.0)):
        _reset_pose(arm_obj)
        _pose(arm_obj, [
            ("chest", WX, D(4) * s),          # tiny forward chest lean (POS = forward)
            ("upperarm.R", WX, D(-55) * s),   # right arm forward (NEG = forward)
            ("forearm.R",  WX, D(-15) * s),   # slight extend, palm forward
            ("hand.R",     WX, D(-8) * s),    # relaxed hand
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def author_death(arm_obj):
    """Collapse to the floor, one-shot 1..48, MONOTONIC (no return; last frame is the
    final resting pose the game clamps): knees buckle hard so the figure sinks, hips
    sink toward the floor (world -Z), and the whole body tips forward over the hips
    (hips rotated about world-X, POS = fall forward/down since hips' upper chain is
    upright) so the torso goes to the ground; limbs go limp/splay. Ends face-down /
    crumpled on the floor."""
    _new_action(arm_obj, "death")
    f0, fbuckle, ffall, f1 = 1, 12, 30, 48
    # (frame, hipZ, hipPitch(WX topple), knee(POS shin), thigh(fold), arm-splay(WZ), arm-drop(WX))
    # NOTE: a body LYING on the floor keeps its hips only ~one body-thickness off the
    # ground, not a deep sink — so hipZ ends much shallower than before (-0.20, not
    # -0.46). Earlier -0.46 + 80deg hip-pitch + hard knee-fold drove the knees to
    # z=-0.72 (floor is ~-0.49). We ease the hip sink AND the thigh-fold so the folded
    # legs rest ON the ground; min world-Z of the mesh on the final frame is >= -0.49
    # (verified with minz_probe). Progression standing -> buckle -> topple -> prone kept.
    frames = [
        (f0,      0.00,   0,   6,    0,    0,   -8),    # standing
        (fbuckle, -0.14,  18,  90,  -24,   16,   10),   # KNEES BUCKLE: sink onto folding legs
        (ffall,   -0.22,  55, 100,  -34,   28,   26),   # HIPS SINK + torso tips forward
        (f1,      -0.25,  80, 108,  -40,   34,   34),   # FINAL: crumpled/face-down ON floor
    ]
    for f, hz, pitch, sh, th, splay, drop in frames:
        _reset_pose(arm_obj)
        _pose_loc(arm_obj, "hips", (0, 0, hz))
        _pose(arm_obj, [
            ("hips",  WX, D(pitch)),          # topple the whole upper body forward/down
            ("thigh.L", WX, D(th)),           # legs fold (NEG = forward under the body)
            ("thigh.R", WX, D(th)),
            ("shin.L",  WX, D(sh)),           # knees buckle hard (POS = fold back)
            ("shin.R",  WX, D(sh)),
            # arms go limp: splay outward (world Z) and drop
            ("upperarm.R", WZ, D(-splay)),
            ("upperarm.L", WZ, D(splay)),
            ("upperarm.R", WX, D(drop)),      # POS = arms fall back/limp as body tips
            ("upperarm.L", WX, D(drop)),
            ("forearm.R",  WX, D(-20)),
            ("forearm.L",  WX, D(-20)),
            ("head",  WX, D(-14)),            # head lolls
        ])
        _key_all(arm_obj, DRIVEN, f)
    _push_to_nla(arm_obj, arm_obj.animation_data.action, f0, f1)


def ease_all_actions():
    for act in bpy.data.actions:
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"


# --------------------------------------------------------------------------- #
# verification render (WORKBENCH MATCAP, ORTHO cam, TRACK_TO, Z-up) — front view
# --------------------------------------------------------------------------- #
def setup_render_camera():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "MATCAP"
    scene.render.resolution_x = 420
    scene.render.resolution_y = 640
    scene.render.film_transparent = False

    target = bpy.data.objects.new("rig_target", None)
    target.location = (0, 0, -0.05)
    scene.collection.objects.link(target)

    cam_data = bpy.data.cameras.new("rig_cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.4
    cam = bpy.data.objects.new("rig_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    # front view: character faces -Y, so look from -Y toward +Y.
    cam.location = (0.0, -3.0, 0.0)
    return scene, cam, target


def render_pose(scene, arm_obj, action_name, frame, path):
    ad = arm_obj.animation_data
    act = bpy.data.actions.get(action_name) if action_name else None
    _reset_pose(arm_obj)
    ad.action = act
    scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log("rendered", os.path.basename(path), "(", action_name, "frame", frame, ")")


# --------------------------------------------------------------------------- #
# export — the untouched skinned mesh + armature + all 5 animations
# --------------------------------------------------------------------------- #
def export_glb(path, arm_obj):
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    for o in bpy.data.objects:
        if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm_obj
                                    for m in o.modifiers):
            o.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    # unmute the stashed tracks (muted during authoring to isolate each clip) so the
    # ACTIONS exporter finds every action.
    if arm_obj.animation_data:
        for tr in arm_obj.animation_data.nla_tracks:
            tr.mute = False
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",   # one glTF clip per stashed action
        # CRITICAL: export_nla_strips must be FALSE in ACTIONS mode. With it True the
        # exporter BAKES the whole (overlapping) NLA stack into every action, so each
        # clip's early frames were contaminated by the other clips' poses (e.g. `use`
        # frame-1 legs came out as a stride). False = each stashed action is sampled in
        # isolation. export_optimize_animation_size=False keeps every keyframe intact.
        export_nla_strips=False,
        export_optimize_animation_size=False,
        export_apply=False,
    )
    log("exported", path)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    args = parse_args()
    if not args["in"]:
        raise SystemExit("need --in <glb>")
    log("input:", args["in"])

    arm_obj, mesh = import_glb(args["in"])

    # PRINT actual world head coords to confirm the axis convention (do not assume)
    W = arm_obj.matrix_world
    log("=== imported bones (world head XYZ) — confirm axis before classifying ===")
    for b in arm_obj.data.bones:
        h = W @ b.head_local
        p = b.parent.name if b.parent else "-"
        log(f"  {b.name:10s} p={p:10s} ({h.x:+.3f},{h.y:+.3f},{h.z:+.3f})")
    zs = [(W @ b.head_local).z for b in arm_obj.data.bones]
    log("Z(up) range:", round(min(zs), 2), round(max(zs), 2), "-> Z is the vertical axis")

    decimate_mesh(mesh, args.get("target_tris", 0))

    mapping, branch = classify_bones(arm_obj)
    log("=== CLASSIFIER MAPPING (canonical -> original) ===")
    for role in ["hips", "spine", "chest", "neck", "head",
                 "clavicle.R", "upperarm.R", "forearm.R", "hand.R",
                 "clavicle.L", "upperarm.L", "forearm.L", "hand.L",
                 "thigh.R", "shin.R", "foot.R", "thigh.L", "shin.L", "foot.L"]:
        if role in mapping:
            log(f"  {role:12s} -> {mapping[role]}")
    log("  (branch/chest detected at:", branch, ")")

    rename_bones(arm_obj, mapping)
    log("renamed bones:", sorted(b.name for b in arm_obj.data.bones
                                 if not b.name.startswith("bone_"))[:24])

    # author the clips
    author_idle(arm_obj)
    author_walk(arm_obj)
    author_cast(arm_obj)
    author_guard(arm_obj)
    author_strike(arm_obj)
    author_hit(arm_obj)
    author_run(arm_obj)
    author_jump(arm_obj)
    author_dodge(arm_obj)
    author_use(arm_obj)
    author_death(arm_obj)
    ease_all_actions()
    log("actions:", [a.name for a in bpy.data.actions])

    # verification renders
    if args["render_dir"]:
        os.makedirs(args["render_dir"], exist_ok=True)
        scene, cam, target = setup_render_camera()
        rd = args["render_dir"]
        render_pose(scene, arm_obj, None, 1, os.path.join(rd, "uc_rest.png"))
        render_pose(scene, arm_obj, "walk", 12, os.path.join(rd, "uc_walk.png"))
        render_pose(scene, arm_obj, "cast", 40, os.path.join(rd, "uc_cast.png"))
        render_pose(scene, arm_obj, "guard", 35, os.path.join(rd, "uc_guard.png"))
        render_pose(scene, arm_obj, "strike", 26, os.path.join(rd, "uc_strike.png"))
        render_pose(scene, arm_obj, "hit", 8, os.path.join(rd, "uc_hit.png"))
        render_pose(scene, arm_obj, "run", 8, os.path.join(rd, "uc_run.png"))
        render_pose(scene, arm_obj, "jump", 20, os.path.join(rd, "uc_jump.png"))
        render_pose(scene, arm_obj, "dodge", 9, os.path.join(rd, "uc_dodge.png"))
        render_pose(scene, arm_obj, "use", 14, os.path.join(rd, "uc_use.png"))
        render_pose(scene, arm_obj, "death", 48, os.path.join(rd, "uc_death.png"))
        # 3/4 side views to read depth (knee bend on the kneel; leg stride on the walk)
        cam.location = (1.7, -2.1, 0.05)
        render_pose(scene, arm_obj, "guard", 35, os.path.join(rd, "uc_guard_side.png"))
        render_pose(scene, arm_obj, "walk", 1, os.path.join(rd, "uc_walk_side.png"))
        cam.location = (0.0, -3.0, 0.0)
        arm_obj.animation_data.action = None
        scene.frame_set(1)

    if args["export"] and args["out"]:
        export_glb(args["out"], arm_obj)

    log("DONE")


if __name__ == "__main__":
    main()
