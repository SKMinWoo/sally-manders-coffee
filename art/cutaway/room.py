"""
The whole cafe around the cover's window, for the cafe tour (app/components/tour/). The camera
stands where cafe.py's does, at the window bar, and this renders the room as a cubemap from
there, once in late-afternoon light and once at golden hour, for the page to turn in.

    $B -b -P room.py -- [--quick] [--light=afternoon|golden] [--samples=256] [--size=2048]

Metres, as in cafe.py: the window bar's top is z = 0, the eye 0.25 over it at the origin,
looking north (+y) through the glass at y = 0.727. The window is exactly the cover's frame
(84 deg wide at 20 mm, its horizon at row 525 of 965), so the cover lays into it seamlessly.
Camera rays that leave through the window come out transparent: the page shows the cover there.

Writes art/blender/out_room/{light}-{n,e,s,w,u,d}.png and meta.json (where the page hangs its
HTML: each plane's centre, size and the way it faces). export.mjs turns them into public/tour/
and app/components/tour/room.ts.
"""
import bpy, os, sys, math, json
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUICK = "--quick" in ARGV
LIGHTS = [a.split("=")[1] for a in ARGV if a.startswith("--light=")] or ["afternoon", "golden"]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out_room")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "run.log"), "w", encoding="utf-8")
def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── the cover's camera, from cafe.py ─────────────────────────────────────
W, H, HORIZON, FOCAL = 1440, 965, 525, 800.0
EYE = 0.25
GLASS = EYE * FOCAL / (800 - HORIZON)        # 0.727
FRONT = EYE * FOCAL / (900 - HORIZON)        # 0.533
HALF_W = GLASS * (W / 2) / FOCAL             # 0.654: the frame's edge at the glass
WIN_TOP = EYE + GLASS * HORIZON / FOCAL      # 0.727 over the bar
FLOOR, CEIL = -1.05, 2.3
XW, XE, YS = -4.3, 3.0, -3.9

def lin(h):
    h = h.lstrip("#")
    v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in v) + (1.0,)

# ── materials ────────────────────────────────────────────────────────────

def principled(name, base, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    if base:
        p.inputs["Base Color"].default_value = lin(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    return m, m.node_tree, p

def mapped(nt, vec, scale):
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(vec, mp.inputs["Vector"])
    return mp.outputs[0]

def walnut(name="walnut", vertical=False, light=False):
    """cafe.py's oiled walnut; vertical runs the grain up a board, per-object random offset."""
    m, nt, p = principled(name, None, 0.48, coat=0.12)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord"); info = n.new("ShaderNodeObjectInfo")
    k = n.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 40.0
    nt.links.new(info.outputs["Random"], k.inputs[0])
    comb = n.new("ShaderNodeCombineXYZ")
    nt.links.new(k.outputs[0], comb.inputs[0]); nt.links.new(k.outputs[0], comb.inputs[2])
    add = n.new("ShaderNodeVectorMath"); add.operation = "ADD"
    nt.links.new(tc.outputs["Object"], add.inputs[0]); nt.links.new(comb.outputs[0], add.inputs[1])
    wave = n.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "X" if vertical else "Y"
    for key, v in (("Scale", 1.0), ("Distortion", 16.0), ("Detail", 3.0), ("Detail Roughness", 0.55)):
        wave.inputs[key].default_value = v
    nt.links.new(mapped(nt, add.outputs[0], (60, 60, 3) if vertical else (5, 30, 30)), wave.inputs["Vector"])
    streak = n.new("ShaderNodeTexNoise"); streak.inputs["Scale"].default_value = 3.0
    nt.links.new(mapped(nt, add.outputs[0], (8, 8, 0.4) if vertical else (0.4, 8, 8)), streak.inputs["Vector"])
    mix = n.new("ShaderNodeMix"); mix.data_type = "FLOAT"; mix.inputs[0].default_value = 0.5
    nt.links.new(wave.outputs["Fac"], mix.inputs[2]); nt.links.new(streak.outputs["Fac"], mix.inputs[3])
    ramp = n.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
    lo, hi = ("#5A4130", "#8E6B4C") if light else ("#3B2A20", "#7A5B41")
    e[0].position, e[0].color = 0.2, lin(lo)
    e[1].position, e[1].color = 0.95, lin(hi)
    e.new(0.55).color = lin("#644835" if light else "#4F392B")
    nt.links.new(mix.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    return m

def terrazzo(name, scale, base="#EDE5D6"):
    m, nt, p = principled(name, None, 0.3)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord")
    vor = n.new("ShaderNodeTexVoronoi"); vor.inputs["Randomness"].default_value = 1.0
    nt.links.new(mapped(nt, tc.outputs["Object"], (scale,) * 3), vor.inputs["Vector"])
    bw = n.new("ShaderNodeRGBToBW"); nt.links.new(vor.outputs["Color"], bw.inputs[0])
    ramp = n.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.0, lin(base)
    e[1].position, e[1].color = 0.94, lin("#2E2A27")
    e.new(0.74).color = lin("#CFC5B4"); e.new(0.81).color = lin("#B5714E")
    e.new(0.86).color = lin("#8E9C7E"); e.new(0.90).color = lin("#E3C98F")
    nt.links.new(bw.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    return m

def tiles(name, colour, grout="#E9E0CF"):
    """Mid-century finger tiles, stacked vertically: glazed, each a shade apart."""
    m, nt, p = principled(name, None, 0.18, coat=0.3)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord")
    b = n.new("ShaderNodeTexBrick")
    b.offset = 0.0; b.squash = 1.0
    b.inputs["Scale"].default_value = 1.0
    b.inputs["Mortar Size"].default_value = 0.0035
    b.inputs["Brick Width"].default_value = 0.025
    b.inputs["Row Height"].default_value = 0.15
    # rotate the tile so the long side runs up
    sep = n.new("ShaderNodeSeparateXYZ"); comb = n.new("ShaderNodeCombineXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs[0], comb.inputs[0]); nt.links.new(sep.outputs[2], comb.inputs[1])
    nt.links.new(comb.outputs[0], b.inputs["Vector"])
    c = lin(colour)
    b.inputs["Color1"].default_value = c
    b.inputs["Color2"].default_value = tuple(min(1, x * 1.25) for x in c[:3]) + (1,)
    b.inputs["Mortar"].default_value = lin(grout)
    nt.links.new(b.outputs["Color"], p.inputs["Base Color"])
    return m

def emissive(name, colour, strength):
    m, nt, p = principled(name, colour, 0.4)
    p.inputs["Emission Color"].default_value = lin(colour)
    p.inputs["Emission Strength"].default_value = strength
    return m

def cork():
    m, nt, p = principled("cork", None, 0.85)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 260.0; nz.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.35, lin("#8A5E3A"); e[1].position, e[1].color = 0.7, lin("#C69468")
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    return m

WALNUT, WALNUT_V, WALNUT_L = walnut(), walnut("walnut-v", vertical=True), walnut("walnut-l", light=True)
FLOOR_T = terrazzo("floor", 38.0, "#E6DCCB")
TOP_T = terrazzo("top", 110.0)
BRASS = principled("brass", "#C9A15A", 0.25, metal=1.0)[0]
PLASTER = principled("plaster", "#DCC4A0", 0.92)[0]
CEILING = principled("ceiling", "#E4D2B4", 0.95)[0]
TEAL_TILE = tiles("teal", "#1C8A85")
TEAL = principled("teal-paint", "#2C6F69", 0.6)[0]
MUSTARD = principled("mustard", "#D9A136", 0.75)[0]
BOARD = principled("board", "#1F1A16", 0.9)[0]
MAT = principled("mat", "#181411", 0.9)[0]
CREAM = principled("stoneware", "#F1E8DA", 0.25, coat=0.6)[0]
KRAFT = principled("kraft", "#B48A5C", 0.85)[0]
RED = principled("label-red", "#C9321F", 0.7)[0]
CHROME = principled("chrome", "#DADADA", 0.08, metal=1.0)[0]
LEAF = principled("leaf", "#3F5E33", 0.5)[0]
SOIL = principled("soil", "#2A1E15", 1.0)[0]
def opal():
    m, nt, p = principled("opal", "#F3E4CF", 0.3)
    n = nt.nodes
    lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.35
    k = n.new("ShaderNodeMapRange")
    k.inputs["From Min"].default_value, k.inputs["From Max"].default_value = 0.0, 1.0
    k.inputs["To Min"].default_value, k.inputs["To Max"].default_value = 2.2, 0.25
    nt.links.new(lw.outputs["Facing"], k.inputs["Value"])
    nt.links.new(k.outputs["Result"], p.inputs["Emission Strength"])
    p.inputs["Emission Color"].default_value = lin("#FFD9A8")
    return m
OPAL = opal()
CORK = cork()

# ── geometry helpers ─────────────────────────────────────────────────────

def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    ob = bpy.context.object; ob.name = name
    ob.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new("b", "BEVEL"); mod.width = bevel; mod.segments = 2
    ob.data.materials.append(mat)
    return ob

def cyl(name, r, x, y, z0, z1, mat, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=abs(z1 - z0), location=(x, y, (z0 + z1) / 2))
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ob

def rod(name, r, a, b, mat, verts=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(mat)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.shade_smooth()
    return ob

def ball(name, r, at, mat, squash=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r, location=at)
    ob = bpy.context.object; ob.name = name; ob.scale = (1, 1, squash)
    ob.data.materials.append(mat); bpy.ops.object.shade_smooth()
    return ob

PLANES = {}  # where the page hangs HTML: centre, width, height, and which way it faces
def plane(key, centre, w, h, facing):
    PLANES[key] = {"c": [round(v, 4) for v in centre], "w": w, "h": h, "facing": facing}

# ── the shell ────────────────────────────────────────────────────────────
T = 0.12
box("floor", XW, XE, YS, GLASS, FLOOR - T, FLOOR, FLOOR_T)
box("ceiling", XW, XE, YS, GLASS, CEIL, CEIL + T, CEILING)
box("wall-w", XW - T, XW, YS, GLASS, FLOOR, CEIL, PLASTER)
box("wall-e", XE, XE + T, YS, GLASS, FLOOR, CEIL, PLASTER)
# north wall: around the window (x +-HALF_W, z 0..WIN_TOP) and the glass entrance (x DOOR[0]..DOOR[1])
DOOR = (-4.15, -1.7, 2.0)
N0, N1 = GLASS, GLASS + T
box("n-under", DOOR[1], XE, N0, N1, FLOOR, 0.0, PLASTER)
box("n-over", DOOR[1], XE, N0, N1, WIN_TOP, CEIL, PLASTER)
box("n-left", DOOR[1], -HALF_W, N0, N1, 0.0, WIN_TOP, PLASTER)
box("n-right", HALF_W, XE, N0, N1, 0.0, WIN_TOP, PLASTER)
box("n-door-left", XW, DOOR[0], N0, N1, FLOOR, CEIL, PLASTER)
box("n-door-over", DOOR[0], DOOR[1], N0, N1, DOOR[2], CEIL, PLASTER)
# skirting all round, walnut
for nm, a in (("sk-nw", (XW, DOOR[0], GLASS - 0.02, GLASS)), ("sk-ne", (DOOR[1], XE, GLASS - 0.02, GLASS)), ("sk-s", (XW, XE, YS, YS + 0.02))):
    box(nm, *a, FLOOR, FLOOR + 0.12, WALNUT)
box("sk-w", XW, XW + 0.02, YS, GLASS, FLOOR, FLOOR + 0.12, WALNUT)
box("sk-e", XE - 0.02, XE, YS, GLASS, FLOOR, FLOOR + 0.12, WALNUT)

# the window: a walnut casing just inside the frame's edge, so the cover fills the opening
C = 0.05
box("case-l", -HALF_W - C, -HALF_W + 0.006, GLASS - 0.04, GLASS + 0.02, 0.0, WIN_TOP + C, WALNUT)
box("case-r", HALF_W - 0.006, HALF_W + C, GLASS - 0.04, GLASS + 0.02, 0.0, WIN_TOP + C, WALNUT)
box("case-t", -HALF_W - C, HALF_W + C, GLASS - 0.04, GLASS + 0.02, WIN_TOP - 0.006, WIN_TOP + C, WALNUT)
# the window bar: cafe.py's ledge, carried on past the frame, with its brass nosing
box("bar", -1.6, 2.4, FRONT, GLASS, -0.026, 0.0, WALNUT, bevel=0.003)
rod("nosing", 0.009, (-1.6, FRONT - 0.004, -0.008), (2.4, FRONT - 0.004, -0.008), BRASS)
for bx in (-1.3, 0.0, 1.3, 2.2):
    box("bracket", bx - 0.015, bx + 0.015, FRONT + 0.03, GLASS, -0.22, -0.026, BRASS)
# a stool beside the reader's, mustard, at the bar
cyl("stool-seat", 0.19, 1.05, 0.15, -0.33, -0.27, MUSTARD)
cyl("stool-post", 0.025, 1.05, 0.15, FLOOR, -0.33, BRASS)
cyl("stool-foot", 0.2, 1.05, 0.15, FLOOR, FLOOR + 0.02, BRASS)

# the entrance: a full-height glass door and sidelight in slim black steel, a long brass pull
def glass_mat():
    m, nt, p = principled("glass", "#F4F6F5", 0.0)
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["IOR"].default_value = 1.45
    n = nt.nodes
    lp = n.new("ShaderNodeLightPath"); tr = n.new("ShaderNodeBsdfTransparent"); mix = n.new("ShaderNodeMixShader")
    clear = n.new("ShaderNodeMixShader"); clear.inputs[0].default_value = 0.95   # mostly see-through
    nt.links.new(p.outputs[0], clear.inputs[1]); nt.links.new(tr.outputs[0], clear.inputs[2])
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(clear.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], n["Material Output"].inputs["Surface"])  # sunlight passes; the eye still sees glass
    return m
GLASS_M = glass_mat()
STEEL = principled("steel", "#1D1C1B", 0.42, metal=0.6)[0]
MULLS = (-3.35, -2.45)            # sidelight | door leaf | sidelight
GY, F = GLASS + 0.045, 0.045      # the glazing line, inside the wall's depth; frame width
edges = (DOOR[0],) + MULLS + (DOOR[1],)
for k, nm in enumerate(("pane-side-l", "pane-door", "pane-side-r")):
    box(nm, edges[k] + F / 2, edges[k + 1] - F / 2, GY - 0.006, GY + 0.006, FLOOR + 0.06, DOOR[2] - F, GLASS_M)
box("jamb-l", DOOR[0], DOOR[0] + F, GY - 0.03, GY + 0.03, FLOOR, DOOR[2], STEEL)
box("jamb-r", DOOR[1] - F, DOOR[1], GY - 0.03, GY + 0.03, FLOOR, DOOR[2], STEEL)
for mx in MULLS:
    box("mullion", mx - F / 2, mx + F / 2, GY - 0.03, GY + 0.03, FLOOR, DOOR[2], STEEL)
box("transom", MULLS[0], MULLS[1], GY - 0.03, GY + 0.03, 1.55, 1.55 + F, STEEL)
box("head", DOOR[0], DOOR[1], GY - 0.03, GY + 0.03, DOOR[2] - F, DOOR[2], STEEL)
box("bottom-rail", DOOR[0], DOOR[1], GY - 0.03, GY + 0.03, FLOOR, FLOOR + 0.06, STEEL)
box("threshold", DOOR[0], DOOR[1], GLASS - 0.02, N1, FLOOR - 0.002, FLOOR + 0.004, BRASS)
px = MULLS[1] - 0.14
rod("pull", 0.016, (px, GY - 0.075, -0.45), (px, GY - 0.075, 0.95), BRASS)
for pz in (-0.3, 0.8):
    rod("pull-post", 0.008, (px, GY - 0.006, pz), (px, GY - 0.075, pz), BRASS)
dx = (MULLS[0] + MULLS[1]) / 2 - 0.05
plane("door-sign", (dx, GY - 0.012, 0.62), 0.5, 0.3, "s")

# outside, seen only through the door: a sunlit sidewalk, a planter of grass, and sky.
# All of it stands more than 50 deg left of north, where the window (42 deg either side) never
# looks, so the window stays a hole for the cover's own skyline.
CONCRETE = principled("concrete", "#9E9284", 0.9)[0]
me = bpy.data.meshes.new("sidewalk")
me.from_pydata([(-1.02, N1, FLOOR - 0.01), (-22, N1, FLOOR - 0.01), (-22, 18.33, FLOOR - 0.01)], [], [(0, 1, 2)])
sw = bpy.data.objects.new("sidewalk", me); scene.collection.objects.link(sw); sw.data.materials.append(CONCRETE)
def sky_backdrop():
    m = bpy.data.materials.new("outside-sky"); m.use_nodes = True
    nt = m.node_tree; n = nt.nodes; n.remove(n["Principled BSDF"])
    tc = n.new("ShaderNodeTexCoord"); sep = n.new("ShaderNodeSeparateXYZ")
    em = n.new("ShaderNodeEmission"); ramp = n.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])      # 0 at the bottom, 1 at the top
    nt.links.new(sep.outputs[2], ramp.inputs[0]); nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], n["Material Output"].inputs["Surface"])
    e = ramp.color_ramp.elements
    while len(e) < 5:
        e.new(0.5)
    return m, ramp, em
SKY_M, SKY_RAMP, SKY_EM = sky_backdrop()
box("outside-sky", -22.1, -22.0, N1, 18.4, FLOOR - 0.1, 30.0, SKY_M)
box("planter", -3.7, -3.05, 1.15, 1.55, FLOOR, FLOOR + 0.45, CONCRETE, bevel=0.01)
for k in range(9):
    ball("grass", 0.13, (-3.62 + 0.07 * k, 1.35 + 0.05 * ((k * 7) % 3 - 1), FLOOR + 0.5), LEAF, squash=1.6)

# ── the counter, south ───────────────────────────────────────────────────
CY0, CY1, CX = -2.62, -2.1, 2.3
box("counter-top", -CX - 0.03, CX + 0.03, CY0 - 0.03, CY1 + 0.04, -0.04, 0.0, TOP_T, bevel=0.004)
box("counter-front", -CX, CX, CY1 - 0.005, CY1 + 0.005, FLOOR + 0.12, -0.04, TEAL_TILE)
box("counter-body", -CX, CX, CY0, CY1 - 0.005, FLOOR, -0.04, WALNUT)
box("counter-kick", -CX, CX, CY1 - 0.04, CY1 + 0.0, FLOOR, FLOOR + 0.12, WALNUT)
rod("counter-nosing", 0.01, (-CX - 0.03, CY1 + 0.045, -0.02), (CX + 0.03, CY1 + 0.045, -0.02), BRASS)
rod("foot-rail", 0.018, (-CX + 0.1, CY1 + 0.16, FLOOR + 0.22), (CX - 0.1, CY1 + 0.16, FLOOR + 0.22), BRASS)
for fx in (-1.6, 0, 1.6):
    rod("foot-rail-post", 0.01, (fx, CY1, FLOOR + 0.22), (fx, CY1 + 0.16, FLOOR + 0.22), BRASS)
plane("tent", (0.55, CY1 - 0.16, 0.085), 0.34, 0.17, "n")

# the espresso machine, teal and chrome, on the counter at the right
EX = -1.55
box("esp-body", EX - 0.36, EX + 0.36, CY0 + 0.08, CY0 + 0.42, 0.0, 0.42, TEAL, bevel=0.03)
box("esp-top", EX - 0.38, EX + 0.38, CY0 + 0.06, CY0 + 0.44, 0.42, 0.45, CHROME, bevel=0.01)
for gx in (EX - 0.18, EX + 0.18):
    rod("group", 0.04, (gx, CY0 + 0.42, 0.24), (gx, CY0 + 0.5, 0.24), CHROME)
    rod("handle", 0.012, (gx, CY0 + 0.5, 0.22), (gx, CY0 + 0.68, 0.18), WALNUT)
for cx_ in (EX - 0.3, EX - 0.2, EX + 0.2, EX + 0.3):
    cyl("cup-top", 0.035, cx_, CY0 + 0.25, 0.45, 0.51, CREAM)
plane("pull", (EX, CY0 + 0.44, 0.33), 0.5, 0.14, "n")
# a cake stand and a jar of biscotti at the left
cyl("stand-foot", 0.05, 1.75, CY0 + 0.3, 0.0, 0.12, CREAM)
cyl("stand-plate", 0.17, 1.75, CY0 + 0.3, 0.12, 0.135, CREAM)
ball("dome", 0.16, (1.75, CY0 + 0.3, 0.14), emissive("dome-glass", "#F7EEDC", 0.15), squash=0.9)
cyl("jar", 0.07, 1.4, CY0 + 0.25, 0.0, 0.22, emissive("jar", "#EAD9BE", 0.1))
cyl("lid", 0.075, 1.4, CY0 + 0.25, 0.22, 0.25, BRASS)

# the back bar and the slat wall behind it
box("backing", XW, XE, YS - 0.06, YS - 0.02, FLOOR, CEIL, principled("dark", "#15100C", 0.8)[0])
SLAT, GAP = 0.045, 0.016
x = XW
while x < XE:
    box("slat", x, x + SLAT, YS - 0.02, YS + 0.01, FLOOR + 0.12, CEIL, WALNUT_V)
    x += SLAT + GAP
box("backbar", -2.8, 2.8, YS, YS + 0.5, FLOOR, -0.15, WALNUT)
box("backbar-top", -2.85, 2.85, YS, YS + 0.52, -0.15, -0.12, TOP_T)
box("shelf", -2.8, 2.8, YS, YS + 0.24, 0.48, 0.51, WALNUT_L)
rod("shelf-light", 0.01, (-2.7, YS + 0.2, 0.475), (2.7, YS + 0.2, 0.475), emissive("strip", "#FFD9A0", 6.0))
for i, sx in enumerate([v / 10 for v in range(-26, 27, 3)]):
    if abs(sx) < 0.15:
        continue
    if i % 3 == 0:
        box("bag", sx - 0.06, sx + 0.06, YS + 0.05, YS + 0.13, 0.51, 0.71, KRAFT, bevel=0.01)
        box("bag-label", sx - 0.04, sx + 0.04, YS + 0.129, YS + 0.132, 0.56, 0.62, RED)
    else:
        cyl("mug", 0.045, sx, YS + 0.12, 0.51, 0.61, CREAM)
for sx in (-2.2, -1.6, -1.0, 1.0, 1.6, 2.2):
    cyl("bottle", 0.035, sx, YS + 0.3, -0.12, 0.12, emissive("syrup", "#C98A3A", 0.3))

# the menu boards: walnut frames on brass standoffs; the page letters their faces
BW, BH, BZ0 = 1.38, 0.98, 1.0
for key, bx in (("board-fullstack", 1.52), ("board-sdet", 0.0), ("board-addons", -1.52)):
    y = YS + 0.06
    box(key + "-frame", bx - BW / 2 - 0.04, bx + BW / 2 + 0.04, y - 0.03, y + 0.02, BZ0 - 0.04, BZ0 + BH + 0.04, WALNUT, bevel=0.006)
    box(key + "-face", bx - BW / 2, bx + BW / 2, y + 0.02, y + 0.025, BZ0, BZ0 + BH, BOARD)
    for sx in (bx - BW / 2 + 0.1, bx + BW / 2 - 0.1):
        rod("standoff", 0.012, (sx, YS + 0.01, BZ0 + BH - 0.08), (sx, y - 0.03, BZ0 + BH - 0.08), BRASS)
    plane(key, (bx, y + 0.026, BZ0 + BH / 2), BW, BH, "n")
# the shop's name, painted on the slats over the boards
plane("shop-sign", (0.0, YS + 0.02, 2.13), 2.4, 0.26, "n")
# today's specials, the letter board, on the slats left of the boards, and the till
box("specials-frame", -3.3 - 0.42, -3.3 + 0.42, YS + 0.01, YS + 0.05, 0.06, 1.12, WALNUT, bevel=0.005)
box("specials-face", -3.3 - 0.38, -3.3 + 0.38, YS + 0.05, YS + 0.055, 0.1, 1.08, BOARD)
plane("specials", (-3.3, YS + 0.056, 0.59), 0.76, 0.98, "n")

# ── the east wall: shelves of beans and mugs, and a fig in a terrazzo pot ─
for z in (-0.25, 0.2, 0.65):
    box("e-shelf", XE - 0.3, XE, -1.4, 0.1, z, z + 0.03, WALNUT_L)
    for j, sy in enumerate([-1.25 + 0.18 * k for k in range(8)]):
        if (j + int(z * 10)) % 2:
            box("e-bag", XE - 0.22, XE - 0.1, sy - 0.06, sy + 0.06, z + 0.03, z + 0.24, KRAFT, bevel=0.01)
            box("e-label", XE - 0.221, XE - 0.219, sy - 0.04, sy + 0.04, z + 0.08, z + 0.14, RED)
        else:
            cyl("e-mug", 0.045, XE - 0.15, sy, z + 0.03, z + 0.13, CREAM)
for sy in (-1.4, 0.1):
    box("e-upright", XE - 0.3, XE, sy - 0.015, sy + 0.015, -0.6, 1.0, WALNUT)
plane("east-sign", (XE - 0.005, -0.65, 1.45), 1.5, 0.8, "w")
def sconce(at, normal):
    x, y, z = at
    nx, ny = normal
    box("sconce-plate", x - 0.05 - 0.01 * abs(nx), x + 0.05 + 0.01 * abs(nx), y - 0.05 - 0.01 * abs(ny), y + 0.05 + 0.01 * abs(ny), z - 0.09, z + 0.09, BRASS)
    rod("sconce-arm", 0.008, (x, y, z), (x + nx * 0.14, y + ny * 0.14, z), BRASS)
    ball("sconce", 0.085, (x + nx * 0.17, y + ny * 0.17, z + 0.02), OPAL)
    bpy.ops.object.light_add(type="POINT", location=(x + nx * 0.17, y + ny * 0.17, z + 0.02))
    L = bpy.context.object; L.data.shadow_soft_size = 0.07; L.data.color = (1.0, 0.8, 0.56); L.visible_camera = False
    LAMPS.append(L)
cyl("pot", 0.22, XE - 0.4, -2.9, FLOOR, FLOOR + 0.5, terrazzo("pot", 60.0, "#DCCDB5"))
cyl("soil", 0.2, XE - 0.4, -2.9, FLOOR + 0.49, FLOOR + 0.5, SOIL)
cyl("trunk", 0.018, XE - 0.4, -2.9, FLOOR + 0.5, 0.9, WALNUT)
import random
rng = random.Random(7)
for k in range(26):
    h = rng.uniform(0.0, 1.0)
    z = FLOOR + 1.0 + h * 1.0
    a = rng.uniform(0, 2 * math.pi); r = 0.14 + 0.16 * (1 - abs(h - 0.5) * 2)
    leaf = ball("leaf", 0.13, (XE - 0.4 + r * math.cos(a), -2.9 + r * math.sin(a), z), LEAF, squash=0.35)
    leaf.scale = (1.0, 0.6, 0.3)
    leaf.rotation_euler = (rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), a)

# ── the west wall: banquette, tables, the gallery shelf; the corkboard by the door
box("wainscot", XW, XW + 0.02, YS, GLASS, FLOOR + 0.12, -0.05, TEAL)
rod("chair-rail", 0.012, (XW + 0.02, YS, -0.05), (XW + 0.02, GLASS, -0.05), BRASS)
BY0, BY1 = -3.6, -1.35
box("banq-base", XW, XW + 0.55, BY0, BY1, FLOOR, FLOOR + 0.4, WALNUT)
box("banq-seat", XW, XW + 0.55, BY0, BY1, FLOOR + 0.4, FLOOR + 0.48, MUSTARD, bevel=0.03)
for k in range(4):
    y0 = BY0 + k * (BY1 - BY0) / 4
    box("banq-back", XW + 0.02, XW + 0.14, y0 + 0.02, y0 + (BY1 - BY0) / 4 - 0.02, FLOOR + 0.5, FLOOR + 1.0, MUSTARD, bevel=0.04)
for ty in (-1.9, -3.05):
    cyl("table-top", 0.33, XW + 0.95, ty, FLOOR + 0.72, FLOOR + 0.75, TOP_T)
    cyl("table-post", 0.03, XW + 0.95, ty, FLOOR + 0.05, FLOOR + 0.72, BRASS)
    cyl("table-foot", 0.22, XW + 0.95, ty, FLOOR, FLOOR + 0.04, BRASS)
    cyl("t-cup", 0.04, XW + 0.85, ty + 0.08, FLOOR + 0.75, FLOOR + 0.83, CREAM)
    cyl("t-saucer", 0.07, XW + 0.85, ty + 0.08, FLOOR + 0.75, FLOOR + 0.76, CREAM)
    # an Eames-ish shell chair across the table, mustard on walnut legs
    cx_ = XW + 1.55
    box("chair-seat", cx_ - 0.22, cx_ + 0.22, ty - 0.22, ty + 0.22, FLOOR + 0.43, FLOOR + 0.48, MUSTARD, bevel=0.06)
    box("chair-back", cx_ + 0.16, cx_ + 0.22, ty - 0.21, ty + 0.21, FLOOR + 0.48, FLOOR + 0.82, MUSTARD, bevel=0.03)
    for lx, ly in ((-0.16, -0.16), (-0.16, 0.16), (0.16, -0.16), (0.16, 0.16)):
        rod("chair-leg", 0.012, (cx_ + lx, ty + ly, FLOOR), (cx_ + lx * 0.7, ty + ly * 0.7, FLOOR + 0.43), WALNUT)
# the gallery shelf and its three shadow boxes; the page plays each project's loop in its window
box("gallery", XW, XW + 0.13, BY0 + 0.05, BY1 - 0.05, 0.62, 0.65, WALNUT_L, bevel=0.004)
rod("gallery-lip", 0.006, (XW + 0.128, BY0 + 0.05, 0.665), (XW + 0.128, BY1 - 0.05, 0.665), BRASS)
FW, FH = 0.6, 0.5
for key, fy in (("frame-leetloop", -1.78), ("frame-shelf-life", -2.475), ("frame-walnut-css", -3.17)):
    box(key, XW + 0.02, XW + 0.09, fy - FW / 2, fy + FW / 2, 0.65, 0.65 + FH, WALNUT, bevel=0.006)
    box(key + "-mat", XW + 0.09, XW + 0.092, fy - FW / 2 + 0.04, fy + FW / 2 - 0.04, 0.69, 0.65 + FH - 0.04, MAT)
    plane(key, (XW + 0.093, fy, 0.65 + FH / 2), FW - 0.1, FH - 0.1, "e")
rod("picture-light", 0.012, (XW + 0.18, BY0 + 0.2, 1.32), (XW + 0.18, BY1 - 0.2, 1.32), BRASS)
plane("gallery-label", (XW + 0.14, -2.475, 0.6), 1.6, 0.08, "e")
# the community corkboard by the door
CB = (-0.95, -0.05, 0.0, 0.85)  # y0, y1, z0, z1
box("cork-frame", XW, XW + 0.04, CB[0] - 0.04, CB[1] + 0.04, CB[2] - 0.04, CB[3] + 0.04, WALNUT, bevel=0.005)
box("cork", XW + 0.04, XW + 0.045, CB[0], CB[1], CB[2], CB[3], CORK)
plane("corkboard", (XW + 0.046, (CB[0] + CB[1]) / 2, (CB[2] + CB[3]) / 2), CB[1] - CB[0], CB[3] - CB[2], "e")
# a coat hook rail and a little plant on a stool by the door
rod("hook-rail", 0.01, (XW + 0.03, 0.15, 0.95), (XW + 0.03, 0.55, 0.95), BRASS)

# ── lamps: the cover's saucer pendant and ball, really here, and globes over the counter
def pendant(key, at, r, hh, cord_to=CEIL):
    x, y, z = at
    shade = ball(key, r, at, OPAL, squash=hh / r)
    rod(key + "-cord", 0.004, (x, y, z + hh), (x, y, cord_to), BRASS, 8)
    cyl(key + "-cap", 0.04, x, y, z + hh - 0.01, z + hh + 0.04, BRASS)
    bpy.ops.object.light_add(type="POINT", location=at)
    L = bpy.context.object; L.data.shadow_soft_size = r * 0.8
    L.data.color = (1.0, 0.8, 0.56); L.visible_camera = False
    LAMPS.append(L)
    return L
LAMPS = []
pendant("saucer", (-0.76, -2.38, 0.45), 0.27, 0.11)
pendant("globe-l", (0.76, -2.38, 0.5), 0.12, 0.12)
pendant("globe-r", (2.3, -2.38, 0.5), 0.12, 0.12)
pendant("ball", (XW + 0.95, -3.05, 0.25), 0.19, 0.18)
pendant("ball-2", (XW + 0.95, -1.9, 0.25), 0.16, 0.15)
for sx in (1.45, 2.45):
    sconce((sx, GLASS, 0.85), (0, -1))
sconce((XE, 0.45, 0.85), (-1, 0))

def area(name, at, aim, size, energy, colour=(1.0, 0.82, 0.6), sy=None):
    bpy.ops.object.light_add(type="AREA", location=at)
    L = bpy.context.object; L.name = name
    L.data.shape = "RECTANGLE"; L.data.size = size; L.data.size_y = sy or size
    L.data.energy = energy; L.data.color = colour
    L.rotation_euler = (Vector(aim) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    L.visible_camera = False
    return L
INTERIOR = [
    area("board-wash", (0, YS + 1.2, CEIL - 0.05), (0, YS, 1.3), 4.6, 220, sy=0.3),
    area("gallery-wash", (XW + 0.25, -2.475, 1.3), (XW, -2.475, 0.8), 2.0, 40, sy=0.06),
    area("cork-wash", (XW + 0.6, -0.5, CEIL - 0.05), (XW, -0.5, 0.4), 0.6, 45),
    area("shelf-wash", (XE - 0.7, -1.15, CEIL - 0.05), (XE, -1.15, 0.2), 1.2, 60),
    area("room-fill", (-0.6, -1.4, CEIL - 0.02), (-0.6, -1.4, FLOOR), 3.0, 55, colour=(1.0, 0.88, 0.74)),
    area("door-fill", (-2.3, -0.6, CEIL - 0.05), (-2.3, GLASS, 0.0), 0.8, 50),
]

bpy.ops.object.light_add(type="SUN")
SUN = bpy.context.object
world = bpy.data.worlds.new("sky"); scene.world = world; world.use_nodes = True
BG = world.node_tree.nodes["Background"]

LIGHT = {
    # sun: elevation deg, azimuth deg right of north (the cover's sun stands right of centre),
    # strength, colour; sky colour and strength; lamp watts
    "afternoon": dict(elev=26, az=14, sun=7.0, sun_c=(1.0, 0.93, 0.82), sky="#CFDCE8", sky_s=0.9, lamp=22, interior=0.7,
                      outside=[(0.0, "#5E6A50"), (0.12, "#74805F"), (0.135, "#E7ECEA"), (0.35, "#C9DAE6"), (1.0, "#A9C4DC")], outside_s=1.5),
    "golden":    dict(elev=6.0, az=18, sun=16.0, sun_c=(1.0, 0.6, 0.3), sky="#F2B98C", sky_s=0.5, lamp=40, interior=0.6,
                      outside=[(0.0, "#5A5444"), (0.12, "#76684F"), (0.135, "#FBD3A4"), (0.35, "#F5CDBE"), (1.0, "#E3D9EC")], outside_s=1.2),
}
BASE = {L.name: L.data.energy for L in INTERIOR}

def light(name):
    c = LIGHT[name]
    e, a = math.radians(c["elev"]), math.radians(c["az"])
    toward_sun = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    SUN.rotation_euler = (-toward_sun).to_track_quat("-Z", "Y").to_euler()
    SUN.data.energy, SUN.data.color, SUN.data.angle = c["sun"], c["sun_c"], math.radians(1.2)
    BG.inputs[0].default_value = lin(c["sky"]); BG.inputs[1].default_value = c["sky_s"]
    for el, (pos, col) in zip(SKY_RAMP.color_ramp.elements, c["outside"]):
        el.position, el.color = pos, lin(col)
    SKY_EM.inputs["Strength"].default_value = c["outside_s"]
    for L in LAMPS:
        L.data.energy = c["lamp"]
    for L in INTERIOR:
        L.data.energy = BASE[L.name] * c["interior"]

# ── render the cube ──────────────────────────────────────────────────────
r = scene.render
r.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            log("device", kind)
            break
    except TypeError:
        continue
ARGS = dict(a[2:].split("=", 1) for a in ARGV if a.startswith("--") and "=" in a)
scene.cycles.samples = int(ARGS.get("samples", 48 if QUICK else 256))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
r.film_transparent = True
r.image_settings.file_format, r.image_settings.color_mode = "PNG", "RGBA"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
SIZE = int(ARGS.get("size", 1024 if QUICK else 2048))
r.resolution_x = r.resolution_y = SIZE

cd = bpy.data.cameras.new("cube"); cd.lens, cd.sensor_width, cd.sensor_fit = 18.0, 36.0, "HORIZONTAL"
cd.clip_start = 0.01
cam = bpy.data.objects.new("cube", cd); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, 0, EYE)
FACES = {  # camera rotation; the page lays each face accordingly
    "n": (90, 0, 0), "w": (90, 0, 90), "s": (90, 0, 180), "e": (90, 0, -90),
    "u": (180, 0, 0), "d": (0, 0, 0),
}
for name in LIGHTS:
    light(name)
    for f, rot in FACES.items():
        cam.rotation_euler = tuple(math.radians(v) for v in rot)
        r.filepath = os.path.join(OUT, f"{name}-{f}.png")
        bpy.ops.render.render(write_still=True)
        log("wrote", r.filepath)

json.dump({"eye": EYE, "glass": GLASS, "halfW": HALF_W, "winTop": WIN_TOP, "front": FRONT,
           "floor": FLOOR, "ceil": CEIL, "planes": PLANES}, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
log("done")
