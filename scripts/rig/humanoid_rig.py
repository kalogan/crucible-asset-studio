"""
humanoid_rig.py — headless-Blender auto-rig for GYRE's forge humanoids.

Pipeline (all CLI / autonomous, run under `blender -b -P`):

    import GLB  ->  MEASURE landmarks from the actual mesh (feet/hip/shoulder/
                    head + widths, ignoring thin tendrils)
                ->  build a humanoid armature FITTED to those landmarks
                ->  skin with GEOMETRIC nearest-bone-segment RIGID weights
                    (every vertex -> its nearest bone, weight 1.0), which binds
                    arbitrary / multi-island meshes where heat weights fail
                ->  author a small CLIP set (idle / cast / guard / strike / hit)
                    as separate Actions pushed to NLA tracks
                ->  export a rigged + animated GLB (glTF binary, skinning + anims)

Coordinate facts for the ld-player sculpts (already established, do not re-derive):
  * The glTF importer converts Y-up -> Blender Z-up, so the character stands along Z.
  * Normalized bbox: height 1.0 along Z, feet at Z = -0.5, head top at Z = +0.5,
    centered on X/Y ~= 0. Character faces -Y (that is the camera-facing front).
  * Bone placement below is expressed as FRACTIONS of height, so any ld-player
    sculpt (which is normalized the same way) reuses this rig.

Usage:
    blender -b -P humanoid_rig.py -- \
        --in <input.glb> --out <rigged.glb> \
        [--render-dir <dir>]      # if set, also render rest/cast/guard verification PNGs
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
           "pose": "adown", "target_tris": 0}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--in":
            out["in"] = args[i + 1]; i += 2
        elif a == "--out":
            out["out"] = args[i + 1]; i += 2
        elif a == "--render-dir":
            out["render_dir"] = args[i + 1]; i += 2
        elif a == "--pose":
            out["pose"] = args[i + 1]; i += 2   # "adown" (arms-down) | "tpose"
        elif a == "--target-tris":
            out["target_tris"] = int(args[i + 1]); i += 2   # decimate budget (0 = off)
        elif a == "--no-export":
            out["export"] = False; i += 1
        else:
            i += 1
    return out


# --------------------------------------------------------------------------- #
# FALLBACK PROPORTIONS — fractions-of-height space (feet Z=-0.5, head Z=+0.5).
#
# These are ONLY used when mesh landmark detection can't find a real landmark
# (see measure_landmarks). The armature is otherwise FITTED per-mesh from the
# actual geometry so bones sit on the model's real joints — which is what lets
# an arbitrary generated boss (wide bbox, disconnected tendrils, non-humanoid
# mass distribution) rig without hand-tuned constants.
#
# Coordinate facts: character stands along Z, faces -Y, left side is +X (.L),
# mirrored to -X (.R). Arms hang DOWN in the "adown" pose (arm bones run -Z).
# --------------------------------------------------------------------------- #
FALLBACK = {
    "feet_z": -0.5,
    "head_z": 0.5,
    "hip_z": 0.0,          # pelvis height
    "chest_z": 0.16,
    "shoulder_z": 0.30,
    "neck_z": 0.40,
    "half_shoulder": 0.09,  # shoulder half-width (|x| of the shoulder joint)
    "half_hip": 0.05,       # leg-center |x|
    "hand_z": -0.195,       # lowest hand reach (arms-down)
    "half_body": 0.13,      # outer dense edge the arm follows down
}


def _pct(sorted_vals, p):
    """p-th percentile (0..1) of an already-sorted list; safe on empties."""
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, max(0, int(len(sorted_vals) * p)))
    return sorted_vals[idx]


def measure_landmarks(mesh):
    """Analyze the normalized mesh (height 1.0, feet Z=-0.5, head Z=+0.5, X/Y
    centered) and derive skeletal landmarks from the REAL geometry, ignoring
    thin far-out tendrils. Everything falls back to FALLBACK proportions if a
    landmark can't be detected, so this never crashes and the ld-player still
    fits. Returns a dict of z-heights + widths used by build_armature."""
    verts = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    if not verts:
        log("measure_landmarks: no verts, using fallback")
        return dict(FALLBACK)

    zmin = min(v.z for v in verts)
    zmax = max(v.z for v in verts)
    feet_z, head_z = zmin, zmax
    span = zmax - zmin
    if span < 1e-6:
        return dict(FALLBACK)

    # ---- bin verts into Z slices; measure a DENSE-body half-width per slice ----
    N = 24
    bins = [[] for _ in range(N)]
    for v in verts:
        i = min(N - 1, int((v.z - zmin) / span * N))
        bins[i].append(v)

    def slice_z(i):
        return zmin + (i + 0.5) / N * span

    # Per-slice widths at TWO percentiles:
    #  * dense_w (85th pct)  -> tracks the solid body incl. hanging arms.
    #  * core_w  (60th pct)  -> the DENSE torso core, robust to a wide tendril
    #    crown (spikes/tendrils are the far tail and don't move a mid percentile).
    dense_w = []
    core_w = []
    central_frac = []   # fraction of verts near the central axis (leg-gap probe)
    counts = []
    for b in bins:
        counts.append(len(b))
        if not b:
            dense_w.append(0.0)
            core_w.append(0.0)
            central_frac.append(0.0)
            continue
        axs = sorted(abs(v.x) for v in b)
        dense_w.append(_pct(axs, 0.85))
        core_w.append(_pct(axs, 0.60))
        # "central" band scaled to the model: within 12% of half-height of axis
        cw = 0.06
        central_frac.append(sum(1 for v in b if abs(v.x) < cw) / len(b))

    # torso core reference: median core width over the mid-body (hip..upper) so a
    # wide crown/tendril spread doesn't set the arm-root width.
    mid = [core_w[i] for i in range(N // 3, 5 * N // 6) if counts[i] > 0]
    torso_core = sorted(mid)[len(mid) // 2] if mid else FALLBACK["half_shoulder"]

    # ---- SHOULDER Z via the NECK NOTCH ----
    # The shoulder is the TOP of the dense torso, just below where the body
    # narrows into the neck/head. Scan from the top DOWN; the head/neck is thin
    # (core width << torso), the shoulders are where the body first broadens back
    # to a solid fraction of the torso core. This is robust for a normal figure
    # (whose WIDEST slice is the hanging arms/hips, not the shoulders — so a
    # naive "widest upper slice" wrongly puts shoulders at the hips) AND for a
    # wide-crown boss (the crown is thin tendrils -> low core width -> ignored).
    top_i = N - 1
    while top_i >= 0 and counts[top_i] == 0:
        top_i -= 1
    shoulder_thresh = 0.55 * torso_core
    shoulder_i = None
    # require a couple of consecutive solid slices so a stray wide tendril slice
    # doesn't false-trigger.
    for i in range(top_i, -1, -1):
        if counts[i] == 0:
            continue
        if core_w[i] >= shoulder_thresh and i <= top_i - 1:
            # confirm the slice below is also solid (real torso, not a blip)
            if i - 1 >= 0 and core_w[i - 1] >= shoulder_thresh:
                shoulder_i = i
                break
    if shoulder_i is not None:
        shoulder_z = slice_z(shoulder_i)
        half_shoulder = max(0.04, min(core_w[shoulder_i], 1.05 * torso_core))
    else:
        # fallback: proportional shoulder near the top of the torso
        shoulder_z = feet_z + 0.80 * span
        half_shoulder = max(0.04, torso_core)
    # CAP the shoulder height: a real humanoid shoulder sits ~0.78-0.82 up the
    # figure. Without this, a boss with a tall dense CROWN above the arms (its
    # crown reads as "shoulders" to the notch test) places the shoulder in the
    # crown -> the arm bone then owns the crown and shreds it on a swing. Capping
    # pulls the shoulder down onto the real arm root; the crown stays on
    # neck/head/chest. The ld-player shoulder (~0.81 up) is unaffected.
    shoulder_cap_z = feet_z + 0.82 * span
    if shoulder_z > shoulder_cap_z:
        shoulder_z = shoulder_cap_z
        # re-measure the core width at the capped height
        ci = min(N - 1, int((shoulder_z - zmin) / span * N))
        half_shoulder = max(0.04, min(core_w[ci] or torso_core, 1.05 * torso_core))

    # ---- HEAD/NECK: neck is just above the shoulder; head top is zmax ----
    # neck ~ 70% of the way from shoulder to head-top.
    neck_z = shoulder_z + 0.55 * (head_z - shoulder_z)
    neck_z = min(neck_z, head_z - 0.02 * span)

    # ---- HIP / leg split: scan lower half for where the two legs meet (crotch).
    # As we go UP from the feet, split legs -> low central density; a solid pelvis
    # -> high central density. The crotch is the lowest slice whose central band
    # is well-populated after a run of leg-gap (low-central) slices below it. If
    # no clear gap (single-column or wide base), fall back proportionally.
    lower = list(range(0, max(1, int(N * 0.62))))
    hip_i = None
    # look for transition: some low slice with central<0.25 (legs apart) below a
    # slice with central>0.45 (pelvis merged).
    for i in lower:
        if counts[i] == 0:
            continue
        below_gap = any(
            counts[j] > 0 and central_frac[j] < 0.30
            for j in range(max(0, i - 4), i)
        )
        if central_frac[i] > 0.45 and below_gap:
            hip_i = i
            break
    if hip_i is not None:
        hip_z = slice_z(hip_i)
        # leg centers: median |x| of the widest leg-gap slice just below the hip
        gap_slices = [j for j in range(max(0, hip_i - 4), hip_i)
                      if counts[j] > 0]
        if gap_slices:
            gj = min(gap_slices, key=lambda j: central_frac[j])
            axs = sorted(abs(v.x) for v in bins[gj] if abs(v.x) > 0.02)
            half_hip = _pct(axs, 0.5) if axs else FALLBACK["half_hip"]
        else:
            half_hip = FALLBACK["half_hip"]
    else:
        # no clean split (e.g. skirted / tendril boss): put hips at ~30% up the
        # feet->shoulder span and use a modest leg offset.
        hip_z = feet_z + 0.30 * (shoulder_z - feet_z)
        half_hip = FALLBACK["half_hip"]
    half_hip = max(0.02, min(half_hip, 0.9 * half_shoulder))

    # ---- CHEST: midway up the pelvis->shoulder torso span ----
    chest_z = hip_z + 0.55 * (shoulder_z - hip_z)

    # ---- HANDS (arms-down): the hanging hand sits at the bottom of the arm,
    # off to the side at ~shoulder width. Look at verts in a vertical band around
    # the arm line (|x| within [0.5,1.4]*half_shoulder) that are BELOW the
    # shoulder, and take a low percentile of their Z (5th pct — the hand tip),
    # excluding the very lowest stray tendrils. Clamp to a sane arm-length band:
    # a hanging hand rests near the hips..upper-thigh, never at the ankles.
    band = [v.z for v in verts
            if 0.5 * half_shoulder < abs(v.x) < 1.4 * half_shoulder
            and v.z < shoulder_z]
    lo_arm = hip_z - 0.10 * span          # hand no higher than just below hips
    hi_arm = feet_z + 0.28 * span         # hand no lower than the lower thigh
    if band:
        band.sort()
        hand_z = _pct(band, 0.05)
        hand_z = max(hi_arm, min(hand_z, lo_arm))
    else:
        hand_z = max(hi_arm, min(FALLBACK["hand_z"], lo_arm))
    # body outer edge the arm follows down (a bit inside the shoulder width)
    half_body = max(half_hip, 0.9 * half_shoulder)

    lm = {
        "feet_z": feet_z, "head_z": head_z,
        "hip_z": hip_z, "chest_z": chest_z,
        "shoulder_z": shoulder_z, "neck_z": neck_z,
        "half_shoulder": half_shoulder, "half_hip": half_hip,
        "hand_z": hand_z, "half_body": half_body,
    }
    log("landmarks:",
        "feet %.2f hip %.2f chest %.2f shoulder %.2f neck %.2f head %.2f | "
        "halfSh %.3f halfHip %.3f hand %.2f" % (
            lm["feet_z"], lm["hip_z"], lm["chest_z"], lm["shoulder_z"],
            lm["neck_z"], lm["head_z"], lm["half_shoulder"], lm["half_hip"],
            lm["hand_z"]))
    return lm


def spine_chain_from(lm):
    """Center spine/neck/head bones from fitted landmarks."""
    hip_z = lm["hip_z"]
    chest_z = lm["chest_z"]
    shoulder_z = lm["shoulder_z"]
    neck_z = lm["neck_z"]
    head_z = lm["head_z"]
    # hips root: a short upward nub at the pelvis (head==tail bones get deleted).
    hips_tail = (0.0, 0.0, hip_z + 0.06 * (shoulder_z - hip_z))
    # chest stops a little BELOW the shoulder line; the neck extends DOWN to own
    # the collar/upper-chest. Under rigid weights the strike chest-twist (+14 Z)
    # would otherwise shear the collar into a fan; letting the near-static neck
    # own the collar keeps that region calm during the twist.
    collar_z = chest_z + 0.78 * (shoulder_z - chest_z)
    return [
        ("hips",  (0.0, 0.0, hip_z),      hips_tail,               None),
        ("spine", (0.0, 0.0, hip_z),      (0.0, 0.0, chest_z),     "hips"),
        ("chest", (0.0, 0.0, chest_z),    (0.0, 0.0, collar_z),    "spine"),
        ("neck",  (0.0, 0.0, collar_z),   (0.0, 0.0, neck_z),      "chest"),
        ("head",  (0.0, 0.0, neck_z),     (0.0, 0.0, head_z),      "neck"),
    ]


def limbs_for(pose, lm):
    """Fitted limb bones on the LEFT (+X) side, from landmarks. Arms differ by
    pose (down vs out); legs hang down in both. .R is generated by symmetrize."""
    hs = lm["half_shoulder"]
    hh = lm["half_hip"]
    hb = lm["half_body"]
    sh_z = lm["shoulder_z"]
    hip_z = lm["hip_z"]
    feet_z = lm["feet_z"]
    hand_z = lm["hand_z"]

    # LEGS (shared): thigh from hip down to a knee ~midway to the feet, shin to
    # just above the feet, foot forward (-Y).
    knee_z = hip_z + 0.5 * (feet_z - hip_z)
    ankle_z = feet_z + 0.06 * (sh_z - feet_z)
    legs = [
        ("thigh", (hh, 0.0, hip_z),    (hh, 0.0, knee_z),  "hips"),
        ("shin",  (hh, 0.0, knee_z),   (hh, 0.0, ankle_z), "thigh"),
        ("foot",  (hh, 0.0, ankle_z),  (hh, -0.08 * (lm["head_z"] - feet_z), feet_z), "shin"),
    ]

    if pose == "tpose":
        # arms extended horizontally (+X) at shoulder height
        arm_len = max(0.18, 1.8 * hs)
        arms = [
            ("clavicle", (0.2 * hs, 0.0, sh_z),          (hs, 0.0, sh_z),                       "chest"),
            ("upperarm", (hs, 0.0, sh_z),                (hs + 0.5 * arm_len, 0.0, sh_z),       "clavicle"),
            ("forearm",  (hs + 0.5 * arm_len, 0.0, sh_z),(hs + 0.85 * arm_len, 0.0, sh_z),      "upperarm"),
            ("hand",     (hs + 0.85 * arm_len, 0.0, sh_z),(hs + arm_len, 0.0, sh_z),            "forearm"),
        ]
        return arms + legs

    # ARMS-DOWN: a SHORT clavicle stub near the neck, then the upperarm owns the
    # WHOLE shoulder/deltoid cap and runs DOWN the body's outer dense edge to the
    # hand. Putting the upperarm head slightly ABOVE + INBOARD of the shoulder
    # joint is deliberate: it makes the deltoid cap swing WITH the arm (as one
    # rigid unit) instead of being split with the near-static clavicle — which is
    # what tears the shoulder into a membrane on a big cast/strike swing.
    elbow_z = sh_z + 0.55 * (hand_z - sh_z)
    wrist_z = sh_z + 0.90 * (hand_z - sh_z)
    arms = [
        ("clavicle", (0.15 * hs, 0.0, sh_z),   (0.55 * hs, 0.0, sh_z),  "chest"),
        ("upperarm", (0.55 * hs, 0.0, sh_z + 0.02), (hb, 0.0, elbow_z), "clavicle"),
        ("forearm",  (hb, 0.0, elbow_z),       (hb, 0.0, wrist_z),      "upperarm"),
        ("hand",     (hb, 0.0, wrist_z),       (hb, 0.0, hand_z),       "forearm"),
    ]
    return arms + legs


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def log(*a):
    print("[rig]", *a)
    sys.stdout.flush()


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("no mesh in imported GLB")
    # join into one object if the sculpt came in as several parts
    mesh = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.join()
    # apply transforms so world == local (importer leaves a rotation on the root)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return mesh


def mesh_bounds(mesh):
    corners = [mesh.matrix_world @ mathutils.Vector(c) for c in mesh.bound_box]
    xs = [c.x for c in corners]; ys = [c.y for c in corners]; zs = [c.z for c in corners]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


def normalize_mesh(mesh):
    """Re-normalize any incoming sculpt to the canonical frame: height 1.0 along Z,
    feet at Z=-0.5, centered on X/Y. Keeps the proportion config valid for every
    ld-player mesh, not just the test one."""
    minx, maxx, miny, maxy, minz, maxz = mesh_bounds(mesh)
    height = maxz - minz
    if height < 1e-6:
        raise RuntimeError("degenerate mesh height")
    scale = 1.0 / height
    cx = (minx + maxx) / 2.0
    cy = (miny + maxy) / 2.0
    # move so center X/Y -> 0, feet Z -> -0.5
    mesh.location = (-cx * scale, -cy * scale, -(minz * scale) - 0.5)
    mesh.scale = (scale, scale, scale)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    b = mesh_bounds(mesh)
    log("normalized bbox x", round(b[0], 3), round(b[1], 3),
        "y", round(b[2], 3), round(b[3], 3),
        "z", round(b[4], 3), round(b[5], 3))
    return mesh


def _tri_count(mesh):
    mesh.data.calc_loop_triangles()
    return len(mesh.data.loop_triangles)


def decimate_mesh(mesh, target_tris):
    """Collapse-decimate the mesh to ~target_tris triangles, for a mobile/LOD budget
    (and for faceted low-poly art styles like GYRE). No-op if target_tris<=0 or the
    mesh is already under budget. Run BEFORE fitting/skinning so the armature + weights
    fit the FINAL geometry (and there's far less to weight). TRELLIS ships ~20k tris;
    a mobile hero wants ~5-8k, a background enemy ~1-3k."""
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
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log(f"decimated {cur} -> {_tri_count(mesh)} tris (ratio {ratio:.3f}, target {target_tris})")


def mirror_x(v):
    return (-v[0], v[1], v[2])


def build_armature(pose="adown", lm=None):
    """Build the humanoid armature FITTED to the mesh landmarks `lm` (from
    measure_landmarks). Returns the armature object (in object mode). `pose`
    picks the arm layout (adown|tpose)."""
    if lm is None:
        lm = dict(FALLBACK)
    arm_data = bpy.data.armatures.new("humanoid")
    arm_obj = bpy.data.objects.new("humanoid", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    ebones = arm_data.edit_bones

    def add(name, head, tail, parent_name):
        eb = ebones.new(name)
        eb.head = head
        eb.tail = tail
        if parent_name and parent_name in ebones:
            eb.parent = ebones[parent_name]
            eb.use_connect = False
        return eb

    # spine chain (centre bones, no mirroring), fitted from landmarks
    for name, head, tail, parent in spine_chain_from(lm):
        add(name, head, tail, parent)

    # left limbs only. The RIGHT side is generated by armature.symmetrize()
    # below — doing it that way (rather than a manual X-flip of head/tail) is
    # essential: symmetrize also mirrors each bone's ROLL, so a given local-axis
    # rotation deforms .L and .R identically. A naive X-flip leaves .R with the
    # wrong local axes, so the same keyframe rotates the .R arm INTO the body
    # and tears the shoulder.
    for name, head, tail, parent in limbs_for(pose, lm):
        add(name + ".L", head, tail, parent)

    # symmetrize .L -> .R with correct mirrored roll.
    bpy.ops.armature.select_all(action="SELECT")
    bpy.ops.armature.symmetrize(direction="POSITIVE_X")

    bpy.ops.object.mode_set(mode="OBJECT")
    log("armature bones:", len(arm_data.bones))
    return arm_obj


def _closest_on_segment(p, a, b):
    """Closest point to p on the segment a->b, plus squared distance. Clamped."""
    ab = b - a
    denom = ab.dot(ab)
    if denom < 1e-12:
        d = p - a
        return a, d.dot(d)
    t = (p - a).dot(ab) / denom
    if t < 0.0:
        t = 0.0
    elif t > 1.0:
        t = 1.0
    proj = a + ab * t
    d = p - proj
    return proj, d.dot(d)


# Bones whose weights the torso-seam smoother may blend among. The clavicle is
# included (it barely rotates in any clip, so blending chest<->clavicle softens
# the collar seam WITHOUT the "taffy shoulder" that blending into the upperarm
# would cause on a big cast/strike swing). upperarm/forearm/hand/legs are NOT
# here — they stay fully rigid.
TORSO_BONES = ("hips", "spine", "chest", "neck", "head", "clavicle.L", "clavicle.R")


def _smooth_torso_seams(mesh, per_bone, repeat=6, factor=0.5):
    """Blend weights across the spine-chain seams ONLY, in pure Python.

    For each torso vertex, iteratively average its torso-bone weights with those
    of its edge-connected torso neighbours. Arm/leg verts and arm/leg weights are
    never touched, so nothing bleeds into or out of the limbs — the shoulder/hip
    seams stay rigid while the chest/neck twist softens into a gradient. Weights
    are renormalized per vertex so the skin stays valid."""
    me = mesh.data
    torso_set = set()
    for b in TORSO_BONES:
        torso_set.update(per_bone.get(b, []))
    if not torso_set:
        return
    # group indices for torso bones (create-safe: they exist from skin())
    gidx = {b: mesh.vertex_groups[b].index for b in TORSO_BONES
            if b in mesh.vertex_groups}

    # adjacency among torso verts only
    adj = {i: set() for i in torso_set}
    for e in me.edges:
        a, c = e.vertices
        if a in torso_set and c in torso_set:
            adj[a].add(c)
            adj[c].add(a)

    # current torso-weight vector per torso vert (dict bone->w), rigid start
    W = {}
    for i in torso_set:
        w = {b: 0.0 for b in gidx}
        for g in me.vertices[i].groups:
            for b, bi in gidx.items():
                if g.group == bi:
                    w[b] = g.weight
        W[i] = w

    for _ in range(repeat):
        newW = {}
        for i in torso_set:
            acc = dict(W[i])
            nb = adj[i]
            if nb:
                avg = {b: 0.0 for b in gidx}
                for j in nb:
                    for b in gidx:
                        avg[b] += W[j][b]
                n = len(nb)
                for b in gidx:
                    acc[b] = (1.0 - factor) * W[i][b] + factor * (avg[b] / n)
            newW[i] = acc
        W = newW

    # write back (renormalize; only torso groups touched)
    for i in torso_set:
        w = W[i]
        s = sum(w.values())
        if s <= 1e-9:
            continue
        for b, bi in gidx.items():
            val = w[b] / s
            grp = mesh.vertex_groups[b]
            if val > 1e-4:
                grp.add([i], val, "REPLACE")
            else:
                grp.remove([i])
    log("seam-softened torso (%d verts, %dx, limbs stay rigid)"
        % (len(torso_set), repeat))


def _smooth_weights_laplacian(mesh, per_bone, repeat=4, factor=0.5, top_k=4):
    """General Laplacian weight-smoothing pass over the WHOLE skin.

    The rigid nearest-bone assignment gives every vertex a single bone at weight
    1.0, so every joint is a HARD boundary: on a big arm swing the upperarm verts
    all rotate as one solid block and a flat slab shears out at the shoulder
    (same at the elbow / knee). This pass turns each hard boundary into a short
    multi-bone GRADIENT so limbs BEND: for each vertex we iteratively blend its
    per-bone weight vector with the AVERAGE of its edge-connected neighbours,
    then renormalize. A handful of iterations only spreads influence a couple of
    vertex-rings across each seam — a local gradient at the joint, not global
    bleed — so the deltoid/elbow/knee bend smoothly while the mid-limb stays
    essentially rigid.

    GUARD against the 'taffy shoulder' (arm weight leaking down the torso so the
    swing drags the chest): after smoothing, each vertex is re-clamped to its
    top-`top_k` bones and renormalized, killing the long tail of tiny far-bone
    influences that a many-iteration smooth would otherwise accumulate. Combined
    with the existing candidate filtering (crown/tendril verts never bind to arm
    bones in the first place) this keeps the bend local to the joint."""
    me = mesh.data
    nv = len(me.vertices)
    if nv == 0:
        return

    # group index -> bone name, and the reverse; only real deform groups.
    gname = {vg.index: vg.name for vg in mesh.vertex_groups}
    ARM_PREFIX = ("clavicle", "upperarm", "forearm", "hand")
    arm_gidx = {gi for gi, n in gname.items()
                if n.split(".")[0] in ARM_PREFIX}

    # which verts were ORIGINALLY torso/leg-owned (i.e. NOT an arm bone). The
    # Laplacian may bleed a little arm weight onto these near the armpit; if that
    # arm weight grows large, the arm swing DRAGS them into a web ("taffy"). We
    # cap the arm-weight these verts can pick up so the seam softens on the ARM
    # side (arm verts freely blend toward the near-static torso) without the
    # torso following the swing.
    torso_owned = set()
    for i, v in enumerate(me.vertices):
        gs = list(v.groups)
        if gs and max(gs, key=lambda g: g.weight).group not in arm_gidx:
            torso_owned.add(i)

    # dense per-vertex weight vectors as dict{gidx: w}, seeded from current skin.
    W = [dict() for _ in range(nv)]
    for i, v in enumerate(me.vertices):
        for g in v.groups:
            if g.weight > 0.0:
                W[i][g.group] = g.weight

    # edge adjacency (whole mesh)
    adj = [[] for _ in range(nv)]
    for e in me.edges:
        a, c = e.vertices
        adj[a].append(c)
        adj[c].append(a)

    for _ in range(repeat):
        newW = [None] * nv
        for i in range(nv):
            nb = adj[i]
            cur = W[i]
            if not nb:
                newW[i] = dict(cur)
                continue
            # accumulate neighbour average
            avg = {}
            for j in nb:
                for gi, w in W[j].items():
                    avg[gi] = avg.get(gi, 0.0) + w
            inv = 1.0 / len(nb)
            acc = {}
            keys = set(cur) | set(avg)
            for gi in keys:
                acc[gi] = (1.0 - factor) * cur.get(gi, 0.0) \
                    + factor * (avg.get(gi, 0.0) * inv)
            newW[i] = acc
        W = newW

    # clamp to top_k bones + renormalize, then write back.
    # ARM_WEIGHT_CAP: a torso/leg-owned vertex may keep at most this fraction of
    # arm-bone influence. This stops the arm swing from dragging armpit/collar
    # verts into a web ("taffy") while still letting the ARM side of the seam
    # soften (arm-owned verts are uncapped, so their deltoid cap bends).
    ARM_WEIGHT_CAP = 0.25
    for i in range(nv):
        w = W[i]
        if not w:
            continue
        if i in torso_owned:
            armw = sum(v for gi, v in w.items() if gi in arm_gidx)
            if armw > ARM_WEIGHT_CAP and armw > 1e-9:
                scale = ARM_WEIGHT_CAP / armw
                for gi in list(w):
                    if gi in arm_gidx:
                        w[gi] *= scale
        if len(w) > top_k:
            top = sorted(w.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
            w = dict(top)
        s = sum(w.values())
        if s <= 1e-9:
            continue
        # rewrite this vertex's membership: set kept groups, drop the rest.
        kept = set()
        for gi, val in w.items():
            nval = val / s
            if nval <= 1e-4:
                continue
            mesh.vertex_groups[gname[gi]].add([i], nval, "REPLACE")
            kept.add(gi)
        # remove any stale group memberships not in the smoothed top-k set
        for g in list(me.vertices[i].groups):
            if g.group not in kept:
                mesh.vertex_groups[gname[g.group]].remove([i])
    log("laplacian weight-smooth (%d verts, %dx factor %.2f, top-%d clamp)"
        % (nv, repeat, factor, top_k))


def _feather_shoulder_seam(mesh, per_bone, lm, factor=0.5, repeat=3):
    """Narrow the rigid ARM<->torso seam at the shoulder into a short gradient.

    A big arm swing (cast ~100 deg, strike ~95 deg) tears the hard upperarm/
    chest boundary into a flat fan. We run a LOCAL smoothing pass over only the
    verts within a couple of rings of that boundary, blending upperarm<->chest/
    clavicle weights. This breaks the fan into a 2-3 vertex gradient (deltoid
    bends instead of tearing) while leaving the rest of the arm — and the whole
    lower arm/hand — fully rigid, so we don't get a floppy 'taffy' arm."""
    me = mesh.data
    seam_bones = ("upperarm.L", "upperarm.R", "clavicle.L", "clavicle.R",
                  "chest", "neck")
    gidx = {b: mesh.vertex_groups[b].index for b in seam_bones
            if b in mesh.vertex_groups}
    if "chest" not in gidx:
        return
    owner = {}
    for b in seam_bones:
        for i in per_bone.get(b, []):
            owner[i] = b
    # seam region: upperarm/clavicle verts near the shoulder + adjacent chest/neck
    sh_z = lm["shoulder_z"]
    hand_z = lm["hand_z"]
    reach = 0.30 * abs(sh_z - hand_z)
    seed = set()
    for b in ("upperarm.L", "upperarm.R", "clavicle.L", "clavicle.R"):
        for i in per_bone.get(b, []):
            if sh_z - me.vertices[i].co.z <= reach:   # near the shoulder joint
                seed.add(i)
    if not seed:
        return
    # grow the region 1 ring into the torso so the gradient spans the seam
    adj = {}
    seam_verts = set(seed)
    for e in me.edges:
        a, c = e.vertices
        adj.setdefault(a, set()).add(c)
        adj.setdefault(c, set()).add(a)
    for i in list(seed):
        for j in adj.get(i, ()):  # pull in immediate torso neighbours
            if owner.get(j) in ("chest", "neck"):
                seam_verts.add(j)

    # weight vectors restricted to seam bones
    W = {}
    for i in seam_verts:
        w = {b: 0.0 for b in gidx}
        for g in me.vertices[i].groups:
            for b, bi in gidx.items():
                if g.group == bi:
                    w[b] = g.weight
        W[i] = w
    for _ in range(repeat):
        newW = {}
        for i in seam_verts:
            nb = [j for j in adj.get(i, ()) if j in seam_verts]
            acc = dict(W[i])
            if nb:
                avg = {b: 0.0 for b in gidx}
                for j in nb:
                    for b in gidx:
                        avg[b] += W[j][b]
                for b in gidx:
                    acc[b] = (1 - factor) * W[i][b] + factor * (avg[b] / len(nb))
            newW[i] = acc
        W = newW
    for i in seam_verts:
        w = W[i]
        s = sum(w.values())
        if s <= 1e-9:
            continue
        for b, bi in gidx.items():
            val = w[b] / s
            grp = mesh.vertex_groups[b]
            if val > 1e-4:
                grp.add([i], val, "REPLACE")
            else:
                grp.remove([i])
    log("shoulder seam feathered (%d verts)" % len(seam_verts))


def skin(mesh, arm_obj, pose="adown", clean=True, lm=None):
    """GEOMETRIC nearest-bone-segment RIGID binding (replaces heat weights).

    Heat weighting (parent_set ARMATURE_AUTO) FAILS on complex / multi-island
    meshes AND, as it turns out, even on the ld-player sculpt once the armature
    is FITTED per-mesh (the solver returns "failed to find solution" and binds
    nothing) — the exporter then drops the skin entirely (skins:0,
    JOINTS_0/WEIGHTS_0 present but inert -> the mesh stays frozen in rest through
    every clip). So we compute weights ourselves (see _skin_geometric), which
    always binds and always exports a real skin (skins:1) — the bug's fix. This
    wrapper is kept as the public entry point / CLI seam."""
    _skin_geometric(mesh, arm_obj, pose=pose, clean=clean, lm=lm)


def _skin_geometric(mesh, arm_obj, pose="adown", clean=True, lm=None):
    """GEOMETRIC nearest-bone-segment RIGID binding.

    Heat weighting FAILS on complex / multi-island meshes: it can't solve, so the
    exporter drops the skin entirely (skins:0, JOINTS_0/WEIGHTS_0 present but
    inert -> the mesh stays frozen in rest). We instead compute weights ourselves:

      1. Create a vertex group per deform bone.
      2. For EVERY vertex, find the nearest BONE SEGMENT (point-to-segment
         distance, clamped to head->tail) and assign that vertex to ONLY that
         bone's group with weight 1.0.
      3. Add an Armature modifier bound to arm_obj and parent (ARMATURE_NAME:
         relationship + modifier, NO auto weights).

    This binds every vertex — including each disconnected tendril island (->
    its nearest bone, typically head/neck/spine) — so the export always yields a
    real skin, with rigid, clean segment deformation (no morph/tear)."""
    # --- vertex groups, one per deform bone ---
    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)
    groups = {}
    for b in arm_obj.data.bones:
        groups[b.name] = mesh.vertex_groups.new(name=b.name)

    # --- bone segments in the mesh's local space ---
    # Mesh and armature both sit at the world origin (transforms applied at
    # import/normalize + the armature is authored in world coords), so bone
    # head/tail (armature-local) already match mesh-local vertex coords. We map
    # explicitly through matrices to be safe against any residual transform.
    arm_mat = arm_obj.matrix_world
    mesh_inv = mesh.matrix_world.inverted()
    segs = []
    for b in arm_obj.data.bones:
        head = mesh_inv @ (arm_mat @ b.head_local)
        tail = mesh_inv @ (arm_mat @ b.tail_local)
        segs.append((b.name, head, tail))

    # --- candidate filtering to keep rigid deformation intentional ---
    # ARM/CLAVICLE bones sit at the shoulder; on a boss with a wide upper crown
    # or tendril mass ABOVE the shoulder line, those verts are geometrically
    # nearest the (short, horizontal) clavicle — so rotating the arm in cast/
    # strike would shred the crown. Rule: a vertex ABOVE the shoulder height may
    # NOT bind to an arm/clavicle bone; it falls to neck/head/chest and moves
    # with the torso/head (which read as one solid mass — the intended look).
    ARM_BONES = ("clavicle", "upperarm", "forearm", "hand")

    def is_arm(name):
        return name.split(".")[0] in ARM_BONES

    lmv = lm or FALLBACK
    shoulder_z = lmv["shoulder_z"]
    half_shoulder = lmv["half_shoulder"]
    # small margin so the actual shoulder cap still binds to the arm
    arm_ceiling = shoulder_z + 0.02
    # crown zone: a vertex in the SHOULDER BAND but far OUTBOARD of the arm root
    # is crown/tendril, not arm — keep it off the arm bones so it doesn't shear
    # when the arm swings. (Below this band, the hanging arm legitimately reaches
    # out, so we only apply the outboard test near/above the shoulder.)
    crown_band_z = shoulder_z - 0.12
    crown_out = 1.35 * half_shoulder

    # --- assign each vertex to its single nearest bone segment ---
    per_bone = {name: [] for name, _, _ in segs}
    for v in mesh.data.vertices:
        p = v.co
        above = p.z > arm_ceiling
        crown = (p.z > crown_band_z) and (abs(p.x) > crown_out)
        block_arm = above or crown
        best_name = None
        best_d2 = None
        for name, a, bb in segs:
            if block_arm and is_arm(name):
                continue  # crown/tendrils never ride the arm
            _, d2 = _closest_on_segment(p, a, bb)
            if best_d2 is None or d2 < best_d2:
                best_d2 = d2
                best_name = name
        if best_name is None:  # safety: only arm bones were candidates
            for name, a, bb in segs:
                _, d2 = _closest_on_segment(p, a, bb)
                if best_d2 is None or d2 < best_d2:
                    best_d2 = d2
                    best_name = name
        per_bone[best_name].append(v.index)

    for name, idxs in per_bone.items():
        if idxs:
            groups[name].add(idxs, 1.0, "REPLACE")
    log("nearest-bone binding:",
        ", ".join("%s=%d" % (n, len(per_bone[n])) for n, _, _ in segs
                  if per_bone[n]))

    # --- parent + Armature modifier (NO auto weights) ---
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_NAME")  # relationship + modifier, no weights

    # ensure the Armature modifier exists and points at arm_obj (belt & braces)
    mod = next((m for m in mesh.modifiers if m.type == "ARMATURE"), None)
    if mod is None:
        mod = mesh.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    mod.use_vertex_groups = True

    # --- weight smoothing so JOINTS BEND instead of shearing (on by default) ---
    # Pure 1-bone rigid weights make every joint a HARD boundary: on a big arm
    # swing (cast/strike ~55-70 deg) the upperarm verts all rotate as one solid
    # block and a flat slab shears out at the shoulder — same at the elbow/knee.
    #
    # We run a GENERAL Laplacian weight-smooth over the whole skin: each vertex
    # blends toward the average of its edge-connected neighbours' weights, a few
    # iterations, then re-clamps to its top-4 bones + renormalizes. A handful of
    # iterations only spreads influence a couple of vertex-rings across each seam
    # — a local gradient at the shoulder/elbow/knee, not global bleed — so limbs
    # BEND smoothly. The top-4 clamp + the existing candidate filtering (crown/
    # tendril verts never bind to an arm bone) guard against the "taffy shoulder"
    # (arm weight dragging the torso). A final torso-only pass keeps the chest/
    # neck twist seams smooth. Islands keep their nearest bone; skins:1 is
    # preserved throughout.
    if clean and os.environ.get("RIG_NOSMOOTH") != "1":
        reps = int(os.environ.get("RIG_SMOOTH_REPS", "3"))
        fac = float(os.environ.get("RIG_SMOOTH_FAC", "0.5"))
        _smooth_weights_laplacian(mesh, per_bone, repeat=reps, factor=fac, top_k=4)
        _smooth_torso_seams(mesh, per_bone, repeat=4, factor=0.5)

    log("skinned (rigid nearest-bone-segment, %d groups, pose=%s)"
        % (sum(1 for n, _, _ in segs if per_bone[n]), pose))


# --------------------------------------------------------------------------- #
# animation authoring
# --------------------------------------------------------------------------- #
def _pose_bone(arm_obj, name):
    return arm_obj.pose.bones.get(name)


def _key_rot(arm_obj, name, frame, euler_xyz):
    """Set a bone's local rotation (XYZ euler, radians) and keyframe it."""
    pb = _pose_bone(arm_obj, name)
    if not pb:
        return
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = mathutils.Euler(euler_xyz, "XYZ")
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def _key_loc(arm_obj, name, frame, loc_xyz):
    pb = _pose_bone(arm_obj, name)
    if not pb:
        return
    pb.location = loc_xyz
    pb.keyframe_insert(data_path="location", frame=frame)


def _reset_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def _new_action(arm_obj, name):
    _reset_pose(arm_obj)
    act = bpy.data.actions.new(name)
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    arm_obj.animation_data.action = act
    return act


def _push_to_nla(arm_obj, act):
    """Push the current action to its own NLA track so the GLB exporter emits it
    as a separate glTF AnimationClip."""
    ad = arm_obj.animation_data
    track = ad.nla_tracks.new()
    track.name = act.name
    track.strips.new(act.name, int(act.frame_range[0]), act)
    ad.action = None


D = math.radians  # degrees -> radians shorthand

# Bones deform arms that hang DOWN. To raise an arm forward (toward -Y front),
# we rotate the upperarm about local X. The sign that lifts the arm forward was
# found by rendering; documented at each use.


def author_idle(arm_obj):
    """Slow breathing + weight sway. Loops 1..96 (~4s at 24fps)."""
    _new_action(arm_obj, "idle")
    f0, fh, f1 = 1, 48, 96
    for f, s in ((f0, 0.0), (fh, 1.0), (f1, 0.0)):
        # subtle chest lift + hips sway
        _key_rot(arm_obj, "chest", f, (D(-2.0) * s, 0, 0))
        _key_rot(arm_obj, "spine", f, (D(1.0) * s, 0, 0))
        _key_rot(arm_obj, "hips", f, (0, 0, D(1.5) * s))
        _key_rot(arm_obj, "head", f, (0, 0, D(2.0) * s))
        # arms drift very slightly out
        _key_rot(arm_obj, "upperarm.L", f, (0, 0, D(3.0) * s))
        _key_rot(arm_obj, "upperarm.R", f, (0, 0, D(-3.0) * s))
    act = arm_obj.animation_data.action
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    _push_to_nla(arm_obj, act)


def author_cast(arm_obj):
    """Both arms raise up/forward — the 'arms up to receive/cast' gesture.
    Hold at the peak, then settle. 1..60."""
    _new_action(arm_obj, "cast")
    f0, fpeak, f1 = 1, 40, 60
    # rest
    for f in (f0,):
        _key_rot(arm_obj, "upperarm.L", f, (0, 0, 0))
        _key_rot(arm_obj, "upperarm.R", f, (0, 0, 0))
        _key_rot(arm_obj, "forearm.L", f, (0, 0, 0))
        _key_rot(arm_obj, "forearm.R", f, (0, 0, 0))
        _key_rot(arm_obj, "chest", f, (0, 0, 0))
        _key_rot(arm_obj, "head", f, (0, 0, 0))
    # peak: arms swing up & forward — the "arms up to receive/cast" gesture.
    # upperarm rotates about local X to lift the hanging arm up/forward; +X on
    # .L, mirrored on .R (symmetrized roll makes the same sign lift both). Kept
    # at ~65 deg: a firm raised gesture that reads as "reaching up" WITHOUT the
    # over-extended ~100 deg swing that maximised the shoulder seam and tore a
    # slab out under rigid weights. The Laplacian weight-smooth lets this bend
    # cleanly at the deltoid; a small clavicle raise + elbow bend sell the reach.
    for f in (fpeak, f1 - 4):
        _key_rot(arm_obj, "clavicle.L", f, (0, 0, D(-12)))
        _key_rot(arm_obj, "clavicle.R", f, (0, 0, D(12)))
        _key_rot(arm_obj, "upperarm.L", f, (D(65), 0, D(8)))
        _key_rot(arm_obj, "upperarm.R", f, (D(65), 0, D(-8)))
        _key_rot(arm_obj, "forearm.L", f, (D(-28), 0, 0))
        _key_rot(arm_obj, "forearm.R", f, (D(-28), 0, 0))
        _key_rot(arm_obj, "chest", f, (D(-6), 0, 0))   # lean back slightly
        _key_rot(arm_obj, "head", f, (D(-6), 0, 0))    # look up
    # settle back toward peak (hold-ish)
    _key_rot(arm_obj, "upperarm.L", f1, (D(60), 0, D(7)))
    _key_rot(arm_obj, "upperarm.R", f1, (D(60), 0, D(-7)))
    act = arm_obj.animation_data.action
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    _push_to_nla(arm_obj, act)


def author_guard(arm_obj):
    """Kneel back + brace: bend knees, sink hips, lean torso back, arms come up
    to guard. 1..50."""
    _new_action(arm_obj, "guard")
    f0, fpeak, f1 = 1, 35, 50
    for f in (fpeak, f1):
        s = 1.0 if f == fpeak else 0.92
        # sink & bend into a braced crouch. Angles kept in the clean range
        # verified by render: thigh forward ~32, shin folds back ~-28 so the
        # lower leg stays roughly under the body (past ~-45 the knee tears),
        # small foot counter-rotation. Hips sink and pelvis tilts back.
        _key_loc(arm_obj, "hips", f, (0, 0, -0.07 * s))     # sink down
        _key_rot(arm_obj, "hips", f, (D(-8) * s, 0, 0))     # tilt pelvis back
        _key_rot(arm_obj, "thigh.L", f, (D(32) * s, 0, D(6)))
        _key_rot(arm_obj, "thigh.R", f, (D(32) * s, 0, D(-6)))
        _key_rot(arm_obj, "shin.L", f, (D(-28) * s, 0, 0))
        _key_rot(arm_obj, "shin.R", f, (D(-28) * s, 0, 0))
        _key_rot(arm_obj, "foot.L", f, (D(6) * s, 0, 0))
        _key_rot(arm_obj, "foot.R", f, (D(6) * s, 0, 0))
        # torso leans back, arms raise to a braced guard (in the clean arm range)
        _key_rot(arm_obj, "spine", f, (D(8) * s, 0, 0))
        _key_rot(arm_obj, "chest", f, (D(5) * s, 0, 0))
        _key_rot(arm_obj, "upperarm.L", f, (D(58) * s, 0, D(16)))
        _key_rot(arm_obj, "upperarm.R", f, (D(58) * s, 0, D(-16)))
        _key_rot(arm_obj, "forearm.L", f, (D(-70) * s, 0, 0))
        _key_rot(arm_obj, "forearm.R", f, (D(-70) * s, 0, 0))
    # rest frame
    for name in ("hips", "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L",
                 "foot.R", "spine", "chest", "upperarm.L", "upperarm.R",
                 "forearm.L", "forearm.R"):
        _key_rot(arm_obj, name, f0, (0, 0, 0))
    _key_loc(arm_obj, "hips", f0, (0, 0, 0))
    act = arm_obj.animation_data.action
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    _push_to_nla(arm_obj, act)


def author_strike(arm_obj):
    """Step + swing the right arm forward. 1..40."""
    _new_action(arm_obj, "strike")
    f0, fwind, fhit, f1 = 1, 12, 26, 40
    # rest
    for name in ("upperarm.R", "forearm.R", "chest", "neck", "hips", "thigh.R"):
        _key_rot(arm_obj, name, f0, (0, 0, 0))
    # wind up: arm back, torso coils. Twist is spread across chest+neck (a
    # single hard chest-Z twist crimps the neck junction — verified by render).
    _key_rot(arm_obj, "upperarm.R", fwind, (D(-32), 0, D(-22)))
    _key_rot(arm_obj, "forearm.R", fwind, (D(-26), 0, 0))
    _key_rot(arm_obj, "chest", fwind, (0, 0, D(-11)))
    _key_rot(arm_obj, "neck", fwind, (0, 0, D(5)))
    _key_rot(arm_obj, "hips", fwind, (0, 0, D(-8)))
    # hit: arm swings forward/down, torso uncoils, small step (thigh forward).
    # Peak swing softened ~95 -> ~62 deg: a firm forward strike gesture that the
    # smoothed shoulder can bend cleanly, instead of the over-extended swing that
    # maximised the seam and tore a slab out of the shoulder.
    _key_rot(arm_obj, "upperarm.R", fhit, (D(62), 0, D(8)))
    _key_rot(arm_obj, "forearm.R", fhit, (D(-18), 0, 0))
    _key_rot(arm_obj, "chest", fhit, (0, 0, D(13)))
    _key_rot(arm_obj, "neck", fhit, (0, 0, D(-6)))
    _key_rot(arm_obj, "hips", fhit, (0, 0, D(10)))
    _key_rot(arm_obj, "thigh.R", fhit, (D(25), 0, 0))
    # recover toward neutral
    for name in ("upperarm.R", "forearm.R", "chest", "neck", "hips", "thigh.R"):
        _key_rot(arm_obj, name, f1, (0, 0, 0))
    act = arm_obj.animation_data.action
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    _push_to_nla(arm_obj, act)


def author_hit(arm_obj):
    """Short recoil back. 1..24."""
    _new_action(arm_obj, "hit")
    f0, fpeak, f1 = 1, 8, 24
    for name in ("spine", "chest", "head", "hips"):
        _key_rot(arm_obj, name, f0, (0, 0, 0))
    _key_loc(arm_obj, "hips", f0, (0, 0, 0))
    # recoil: torso snaps back, head flicks, hips shift back
    _key_rot(arm_obj, "spine", fpeak, (D(14), 0, 0))
    _key_rot(arm_obj, "chest", fpeak, (D(10), 0, 0))
    _key_rot(arm_obj, "head", fpeak, (D(16), 0, 0))
    _key_loc(arm_obj, "hips", fpeak, (0, 0.03, -0.02))
    _key_rot(arm_obj, "upperarm.L", fpeak, (0, 0, D(20)))
    _key_rot(arm_obj, "upperarm.R", fpeak, (0, 0, D(-20)))
    # settle
    for name in ("spine", "chest", "head", "upperarm.L", "upperarm.R"):
        _key_rot(arm_obj, name, f1, (0, 0, 0))
    _key_loc(arm_obj, "hips", f1, (0, 0, 0))
    act = arm_obj.animation_data.action
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    _push_to_nla(arm_obj, act)


def ease_all_actions():
    """Give every keyframe a smooth (slow, weighty) interpolation."""
    for act in bpy.data.actions:
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"


# --------------------------------------------------------------------------- #
# verification render (WORKBENCH, ORTHO cam, TRACK_TO, Z-up) — front view
# --------------------------------------------------------------------------- #
def setup_render_camera():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "MATCAP"
    scene.render.resolution_x = 420
    scene.render.resolution_y = 640
    scene.render.film_transparent = False

    target = bpy.data.objects.new("rig_target", None)
    target.location = (0, 0, 0)
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
    # front view: look from -Y (character faces -Y), slightly toward +X so raised
    # arms read in depth. Distance along -Y.
    cam.location = (0.35, -2.5, 0.0)
    return scene, cam


def render_pose(scene, arm_obj, action_name, frame, path):
    """Set the armature to a given action+frame and render a still.

    Crucial: fully reset every pose bone first, because each clip only keys a
    subset of bones — without a reset, bones keyed by a *previous* clip stay
    posed and the render tears. (Export is unaffected: each NLA strip carries a
    complete action, evaluated independently.)"""
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
# export
# --------------------------------------------------------------------------- #
def export_glb(path, mesh, arm_obj):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",   # one glTF clip per NLA action
        export_nla_strips=True,
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

    pose = args.get("pose", "adown")
    log("pose mode:", pose)

    clean_scene()
    mesh = import_glb(args["in"])
    normalize_mesh(mesh)
    decimate_mesh(mesh, args.get("target_tris", 0))  # optional mobile/LOD budget
    lm = measure_landmarks(mesh)
    arm_obj = build_armature(pose, lm)
    skin(mesh, arm_obj, pose=pose, clean=(os.environ.get("RIG_NOCLEAN") != "1"), lm=lm)

    if pose == "tpose":
        log("NOTE: T-pose BIND + smooth weights are wired (the validated win). The "
            "clips below are still authored for the arms-DOWN rest; on a T-pose bind "
            "the rest is arms-OUT, so cast/guard/strike/hit need one render-tune pass "
            "against the real T-pose model (author animation against the actual rig, "
            "not blind). Idle will show arms-out until that pass.")

    # author clips
    author_idle(arm_obj)
    author_cast(arm_obj)
    author_guard(arm_obj)
    author_strike(arm_obj)
    author_hit(arm_obj)
    ease_all_actions()
    log("actions:", [a.name for a in bpy.data.actions])

    # verification renders
    if args["render_dir"]:
        os.makedirs(args["render_dir"], exist_ok=True)
        scene, cam = setup_render_camera()
        rd = args["render_dir"]
        render_pose(scene, arm_obj, None, 1, os.path.join(rd, "rest.png"))
        render_pose(scene, arm_obj, "cast", 40, os.path.join(rd, "cast.png"))
        render_pose(scene, arm_obj, "guard", 35, os.path.join(rd, "guard.png"))
        render_pose(scene, arm_obj, "strike", 26, os.path.join(rd, "strike.png"))
        render_pose(scene, arm_obj, "hit", 8, os.path.join(rd, "hit.png"))
        # a 3/4 side view of the guard crouch to read knee bend + depth
        cam.location = (1.6, -1.9, 0.05)
        render_pose(scene, arm_obj, "guard", 35, os.path.join(rd, "guard_side.png"))
        cam.location = (0.35, -2.5, 0.0)
        # reset to rest for a clean export
        arm_obj.animation_data.action = None
        scene.frame_set(1)

    if args["export"] and args["out"]:
        export_glb(args["out"], mesh, arm_obj)

    log("DONE")


if __name__ == "__main__":
    main()
