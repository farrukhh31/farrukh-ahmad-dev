"""
Farrukh Dev Hub — procedural avatar builder (Blender 4.x / 5.x).

Builds a stylised low-poly "developer hero", rigs it with a simple skeleton,
keys three animation clips (Idle, Walk, Wave) and exports a GLB for the web.

Run it either way:
  * Inside Blender:  Scripting tab -> open this file -> Run Script
  * Command line:    blender -b -P avatar/build_avatar.py
  * As a module:     python avatar/build_avatar.py   (needs `pip install bpy`)

Edit the CONFIG block below to make the character look like YOU
(skin, hair, hoodie colour, glasses...). Everything else rebuilds itself.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------
# CONFIG — change these to customise the avatar
# --------------------------------------------------------------------------
SKIN = "#d6a27a"
HAIR = "#12151f"
HOODIE = "#6d3fd1"      # main hoodie colour (also tints the knit texture)
HOODIE_TRIM = "#22d3ee"  # glowing accents (matches the portfolio's cyan)
PANTS = "#0f172a"
SHOES = "#e5e7eb"
BACKPACK = "#1e293b"
GLASSES_GLOW = "#22d3ee"
WAVE_ARM = "R"           # which arm waves: "L" or "R"
FPS = 24

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
ROOT = os.path.dirname(HERE)
BLEND_PATH = os.path.join(HERE, "farrukh-avatar.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "avatar.glb")
PREVIEW_DIR = os.path.join(HERE, "previews")
RENDER_PREVIEWS = "--no-render" not in sys.argv

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def hex_to_rgba(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    # convert sRGB hex -> linear for Blender's colour fields
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.render.fps = FPS
    return scn


def make_material(name, color, roughness=0.55, metallic=0.0, emit=None, emit_strength=0.0, image=None):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True  # deprecated (always on) in 5.x, still needed in 4.x
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(color)
    if emit:
        bsdf.inputs["Emission Color"].default_value = hex_to_rgba(emit)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def make_knit_texture(size=512):
    """Procedural ribbed-knit hoodie texture, packed into the .blend / .glb."""
    img = bpy.data.images.new("hoodie_knit", size, size, alpha=False)
    base = np.array(hex_to_rgba(HOODIE)[:3])
    # work in sRGB space for the stored pixels
    to_srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)
    base = to_srgb(base)
    x = np.linspace(0, 1, size, endpoint=False)
    u, v = np.meshgrid(x, x)
    ribs = 0.5 + 0.5 * np.sin(2 * math.pi * u * 96)          # vertical knit ribs
    weave = 0.5 + 0.5 * np.sin(2 * math.pi * v * 160)        # fine horizontal rows
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 0.012, (size, size))
    shade = 0.86 + 0.10 * ribs + 0.04 * weave + noise
    rgb = np.clip(base[None, None, :] * shade[..., None], 0, 1)
    px = np.ones((size, size, 4), dtype=np.float32)
    px[..., :3] = rgb
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


PARTS = []


def _finish(ob, name, mat, bone, smooth=True):
    ob.name = name
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    PARTS.append(ob)
    return ob


def sphere(name, loc, scale, mat, bone, rot=(0, 0, 0), seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=loc, segments=seg, ring_count=rings)
    ob = bpy.context.active_object
    ob.scale = scale
    ob.rotation_euler = rot
    return _finish(ob, name, mat, bone)


def box(name, loc, half, mat, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    ob = bpy.context.active_object
    ob.scale = half
    ob.rotation_euler = rot
    return _finish(ob, name, mat, bone, smooth=False)


def torus(name, loc, major, minor, mat, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=12, location=loc)
    ob = bpy.context.active_object
    ob.rotation_euler = rot
    return _finish(ob, name, mat, bone)


def limb(name, a, b, radius, mat, bone):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=d.length, location=(a + b) / 2, vertices=24)
    ob = bpy.context.active_object
    ob.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return _finish(ob, name, mat, bone)


# --------------------------------------------------------------------------
# build the model
# --------------------------------------------------------------------------

def build_mesh():
    knit = make_knit_texture()
    m = {
        "skin": make_material("Skin", SKIN, roughness=0.6),
        "hair": make_material("Hair", HAIR, roughness=0.45),
        "hoodie": make_material("HoodieKnit", HOODIE, roughness=0.85, image=knit),
        "trim": make_material("NeonTrim", HOODIE_TRIM, roughness=0.3, emit=HOODIE_TRIM, emit_strength=3.0),
        "glasses": make_material("GlassesGlow", GLASSES_GLOW, roughness=0.2, emit=GLASSES_GLOW, emit_strength=4.0),
        "pants": make_material("Pants", PANTS, roughness=0.7),
        "shoes": make_material("Shoes", SHOES, roughness=0.45),
        "pack": make_material("Backpack", BACKPACK, roughness=0.5, metallic=0.3),
        "dark": make_material("Dark", "#05070d", roughness=0.4),
    }

    # head ---------------------------------------------------------------
    sphere("Head", (0, 0, 2.0), (0.46, 0.44, 0.48), m["skin"], "head")
    for s in (-1, 1):
        sphere(f"Eye{s}", (s * 0.17, -0.40, 2.03), (0.055, 0.04, 0.07), m["dark"], "head", seg=16, rings=8)
        torus(f"Lens{s}", (s * 0.17, -0.435, 2.03), 0.115, 0.016, m["glasses"], "head", rot=(math.pi / 2, 0, 0))
        sphere(f"Ear{s}", (s * 0.46, 0, 1.99), (0.05, 0.07, 0.09), m["skin"], "head", seg=12, rings=8)
    box("GlassesBridge", (0, -0.435, 2.04), (0.06, 0.015, 0.012), m["glasses"], "head")
    box("Mouth", (0, -0.43, 1.87), (0.07, 0.012, 0.012), m["dark"], "head")
    sphere("Hair", (0, 0.05, 2.14), (0.5, 0.47, 0.38), m["hair"], "head")
    sphere("Fringe", (0, -0.28, 2.33), (0.4, 0.2, 0.16), m["hair"], "head")

    # neck + torso ---------------------------------------------------------
    limb("Neck", (0, 0, 1.64), (0, 0, 1.82), 0.12, m["skin"], "neck")
    sphere("Torso", (0, 0, 1.38), (0.5, 0.34, 0.46), m["hoodie"], "spine")
    torus("HoodCollar", (0, 0.03, 1.74), 0.26, 0.085, m["hoodie"], "spine")
    for s in (-1, 1):
        limb(f"Drawstring{s}", (s * 0.08, -0.33, 1.66), (s * 0.08, -0.35, 1.42), 0.014, m["trim"], "spine")
    box("PocketTrim", (0, -0.3, 1.1), (0.22, 0.02, 0.012), m["trim"], "spine")
    box("Backpack", (0, 0.40, 1.42), (0.3, 0.15, 0.36), m["pack"], "spine")
    box("BackpackStrip", (0, 0.555, 1.5), (0.06, 0.012, 0.26), m["trim"], "spine")

    # pelvis -------------------------------------------------------------
    sphere("Pelvis", (0, 0, 1.0), (0.46, 0.3, 0.27), m["pants"], "hips")

    # arms (+X = character's left) --------------------------------------------
    for side, sx in (("L", 1), ("R", -1)):
        sh, el, wr = (sx * 0.5, 0, 1.58), (sx * 0.55, 0, 1.28), (sx * 0.55, 0, 0.98)
        sphere(f"Shoulder.{side}", sh, (0.14, 0.14, 0.14), m["hoodie"], f"upper_arm.{side}")
        limb(f"UpperArm.{side}", sh, el, 0.115, m["hoodie"], f"upper_arm.{side}")
        sphere(f"Elbow.{side}", el, (0.115, 0.115, 0.115), m["hoodie"], f"forearm.{side}")
        limb(f"Forearm.{side}", el, wr, 0.1, m["hoodie"], f"forearm.{side}")
        torus(f"Cuff.{side}", (sx * 0.55, 0, 1.0), 0.1, 0.022, m["trim"], f"forearm.{side}")
        sphere(f"Hand.{side}", (sx * 0.55, 0, 0.9), (0.115, 0.1, 0.12), m["skin"], f"forearm.{side}")

    # legs ---------------------------------------------------------------
    for side, sx in (("L", 1), ("R", -1)):
        hip, knee, ank = (sx * 0.22, 0, 1.02), (sx * 0.22, 0, 0.58), (sx * 0.22, 0, 0.22)
        limb(f"Thigh.{side}", hip, knee, 0.155, m["pants"], f"thigh.{side}")
        sphere(f"Knee.{side}", knee, (0.14, 0.14, 0.14), m["pants"], f"shin.{side}")
        limb(f"Shin.{side}", knee, ank, 0.13, m["pants"], f"shin.{side}")
        sphere(f"Shoe.{side}", (sx * 0.22, -0.1, 0.13), (0.17, 0.3, 0.13), m["shoes"], f"foot.{side}")
        box(f"Sole.{side}", (sx * 0.22, -0.1, 0.025), (0.16, 0.29, 0.022), m["trim"], f"foot.{side}")

    # join everything into ONE skinned mesh ---------------------------------
    bpy.ops.object.select_all(action="DESELECT")
    for ob in PARTS:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "AvatarBody"
    body.data.name = "AvatarBodyMesh"
    return body


BONES = [
    # name,          head,               tail,                parent
    ("root",        (0, 0, 0),          (0, 0, 0.25),        None),
    ("hips",        (0, 0, 1.0),        (0, 0, 1.25),        "root"),
    ("spine",       (0, 0, 1.25),       (0, 0, 1.65),        "hips"),
    ("neck",        (0, 0, 1.65),       (0, 0, 1.82),        "spine"),
    ("head",        (0, 0, 1.82),       (0, 0, 2.5),         "neck"),
    ("upper_arm.L", (0.5, 0, 1.58),     (0.55, 0, 1.28),     "spine"),
    ("forearm.L",   (0.55, 0, 1.28),    (0.55, 0, 0.9),      "upper_arm.L"),
    ("upper_arm.R", (-0.5, 0, 1.58),    (-0.55, 0, 1.28),    "spine"),
    ("forearm.R",   (-0.55, 0, 1.28),   (-0.55, 0, 0.9),     "upper_arm.R"),
    ("thigh.L",     (0.22, 0, 1.02),    (0.22, 0, 0.58),     "hips"),
    ("shin.L",      (0.22, 0, 0.58),    (0.22, 0, 0.22),     "thigh.L"),
    ("foot.L",      (0.22, 0, 0.22),    (0.22, -0.32, 0.05), "shin.L"),
    ("thigh.R",     (-0.22, 0, 1.02),   (-0.22, 0, 0.58),    "hips"),
    ("shin.R",      (-0.22, 0, 0.58),   (-0.22, 0, 0.22),    "thigh.R"),
    ("foot.R",      (-0.22, 0, 0.22),   (-0.22, -0.32, 0.05), "shin.R"),
]


def build_rig(body):
    data = bpy.data.armatures.new("AvatarRig")
    rig = bpy.data.objects.new("AvatarRig", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent in BONES:
        eb = data.edit_bones.new(name)
        eb.head, eb.tail = head, tail
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    body.parent = rig
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    return rig


# --------------------------------------------------------------------------
# animation
# --------------------------------------------------------------------------

def rot(pb, frame, axis, degrees):
    """Key a rotation about a WORLD axis ('X','Y','Z') on a pose bone."""
    r_world = Matrix.Rotation(math.radians(degrees), 3, axis)
    r_rest = pb.bone.matrix_local.to_3x3()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (r_rest.inverted() @ r_world @ r_rest).to_quaternion()
    pb.keyframe_insert("rotation_quaternion", frame=frame)


def combine(pb, frame, rotations):
    """Key several world-axis rotations at once (applied in order X, Y, Z)."""
    r_world = Matrix.Identity(3)
    for axis, deg in rotations:
        r_world = Matrix.Rotation(math.radians(deg), 3, axis) @ r_world
    r_rest = pb.bone.matrix_local.to_3x3()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (r_rest.inverted() @ r_world @ r_rest).to_quaternion()
    pb.keyframe_insert("rotation_quaternion", frame=frame)


def lift(pb, frame, dz):
    r_rest = pb.bone.matrix_local.to_3x3()
    pb.location = r_rest.inverted() @ Vector((0, 0, dz))
    pb.keyframe_insert("location", frame=frame)


def new_action(rig, name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    return act


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


def key_all_rest(rig, frame):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.keyframe_insert("rotation_quaternion", frame=frame)


def make_idle(rig):
    new_action(rig, "Idle")
    reset_pose(rig)
    P = rig.pose.bones
    n = 72
    for f in range(0, n + 1, 6):
        t = 2 * math.pi * f / n
        s = math.sin(t)
        rot(P["spine"], f, "X", 1.6 * s)
        rot(P["head"], f, "X", -1.2 * s)
        combine(P["head"], f, [("X", -1.2 * s), ("Z", 2.5 * math.sin(t + 1.0))])
        rot(P["upper_arm.L"], f, "Y", -3 - 1.5 * s)
        rot(P["upper_arm.R"], f, "Y", 3 + 1.5 * s)
        rot(P["forearm.L"], f, "X", -5 - 2 * s)
        rot(P["forearm.R"], f, "X", -5 - 2 * s)
        lift(P["hips"], f, 0.012 * s)
    return n


def make_walk(rig):
    new_action(rig, "Walk")
    reset_pose(rig)
    P = rig.pose.bones
    n = 24
    for f in range(0, n + 1, 2):
        ph = 2 * math.pi * f / n
        for side, sgn in (("L", 1), ("R", -1)):
            fwd = 36 * math.sin(ph) * sgn            # thigh forward swing (deg)
            rot(P[f"thigh.{side}"], f, "X", -fwd)    # negative X = forward (-Y)
            bend = 48 * max(0.0, math.cos(ph) * sgn) ** 1.2
            rot(P[f"shin.{side}"], f, "X", bend)     # knee bends foot backwards
            rot(P[f"foot.{side}"], f, "X", -0.35 * fwd + 0.25 * bend)
            arm = -30 * math.sin(ph) * sgn           # arms swing opposite the legs
            rot(P[f"upper_arm.{side}"], f, "X", -arm)
            rot(P[f"forearm.{side}"], f, "X", -(22 + 10 * max(0.0, -arm / 30)))
        lift(P["hips"], f, 0.035 * math.cos(2 * ph))
        rot(P["spine"], f, "Z", 5 * math.sin(ph))
        rot(P["head"], f, "Z", -4 * math.sin(ph))
    return n


def make_wave(rig):
    new_action(rig, "Wave")
    reset_pose(rig)
    P = rig.pose.bones
    arm = P[f"upper_arm.{WAVE_ARM}"]
    fore = P[f"forearm.{WAVE_ARM}"]
    up = 150 if WAVE_ARM == "R" else -150   # raise the arm out and up
    n = 64
    for f in (0, 12, 52, 64):
        raised = 1.0 if f in (12, 52) else 0.0
        rot(arm, f, "Y", up * raised)
        rot(P["spine"], f, "Z", (-4 if WAVE_ARM == "R" else 4) * raised)
        rot(P["head"], f, "Z", (6 if WAVE_ARM == "R" else -6) * raised)
    swing = 28 if WAVE_ARM == "R" else -28
    for f, v in zip((0, 12, 18, 24, 30, 36, 42, 48, 52, 64), (0, 10, swing, -swing, swing, -swing, swing, -swing, 5, 0)):
        rot(fore, f, "Y", v)
    # make sure every other bone sits at rest at both ends of the clip
    for name in ("forearm.L", "upper_arm.L", "thigh.L", "thigh.R", "shin.L", "shin.R"):
        if name == f"upper_arm.{WAVE_ARM}":
            continue
        for f in (0, 64):
            rot(P[name], f, "X", 0)
    return n


def build_animations(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    idle_n = make_idle(rig)
    walk_n = make_walk(rig)
    wave_n = make_wave(rig)
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"Idle": idle_n, "Walk": walk_n, "Wave": wave_n}


# --------------------------------------------------------------------------
# export + previews
# --------------------------------------------------------------------------

def export_glb(rig, body):
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig
    kwargs = dict(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
    )
    bpy.ops.export_scene.gltf(**kwargs)
    print("GLB written:", GLB_PATH, os.path.getsize(GLB_PATH) // 1024, "KB")


def render_previews(rig):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scn = bpy.context.scene
    # simple studio
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(make_material("Floor", "#0a1020", roughness=0.35, metallic=0.4))
    world = bpy.data.worlds.new("W")
    scn.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_to_rgba("#050a18")
    bg.inputs["Strength"].default_value = 0.6

    def light(name, kind, loc, energy, color="#ffffff", size=4):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = hex_to_rgba(color)[:3]
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d)
        scn.collection.objects.link(o)
        o.location = loc
        direction = Vector((0, 0, 1.3)) - Vector(loc)
        o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return o

    light("Key", "AREA", (-3.5, -4, 4.5), 700, "#ffffff", 4)
    light("Rim", "AREA", (4, 3, 3.5), 900, "#22d3ee", 3)
    light("Fill", "AREA", (4, -3, 2), 250, "#8b5cf6", 4)

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 60
    cam = bpy.data.objects.new("Cam", cam_d)
    scn.collection.objects.link(cam)
    scn.camera = cam

    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = 48
    scn.cycles.use_denoising = False
    scn.render.resolution_x, scn.render.resolution_y = 720, 900

    shots = [
        ("avatar_front_idle", "Idle", 0, (0, -8.2, 1.35)),
        ("avatar_three_quarter_wave", "Wave", 30, (-5.6, -6.0, 1.45)),
        ("avatar_walk", "Walk", 4, (5.6, -5.8, 1.4)),
    ]
    for fname, action, frame, pos in shots:
        rig.animation_data.action = bpy.data.actions[action]
        scn.frame_set(frame)
        cam.location = pos
        look = Vector((0, 0, 1.25)) - Vector(pos)
        cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
        scn.render.filepath = os.path.join(PREVIEW_DIR, fname + ".png")
        bpy.ops.render.render(write_still=True)
        print("preview:", scn.render.filepath)


def main():
    reset_scene()
    body = build_mesh()
    rig = build_rig(body)
    clips = build_animations(rig)
    rig.animation_data.action = bpy.data.actions["Idle"]
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = max(clips.values())
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("Saved .blend:", BLEND_PATH)
    export_glb(rig, body)
    if RENDER_PREVIEWS:
        render_previews(rig)


if __name__ == "__main__":
    main()
