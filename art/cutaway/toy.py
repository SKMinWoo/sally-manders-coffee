"""
Sally Mander's as a painted-wood play set: the cutaway's three rooms, its street front and its van,
built at full size in metres (room.py and the code below), then dressed in the Study's toy
materials and shrunk onto a walnut plinth about 17 cm long. One model for both pages:

    cutaway.py (this repo)      renders it alone for the shop's home page, roof on and off
    the portfolio's Study scene  appends it from out/toy.blend onto the atlas, roof on

Exec'd by cutaway.py. Leaves behind, for the caller:
    TOY            the empty everything hangs from (toy-local metres, origin at the plinth's
                   bottom centre, the street front facing +y)
    w(p)           a full-size point (as ANCH, WALK, ZONES are written) to world space
    local(p)       the same point in toy-local metres
    SHELL_OBS      the roof, sign, awning and street front, which the page lifts off
    VIEW, RIG      the Study's tq camera and its night lights, in toy-local metres: both pages
                   are photographed from exactly here, so the shop's hero is a crop of the Study
"""
import bpy, os, sys, math, json, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOM = os.path.join(HERE, "room.py")
_src = open(ROOM, encoding="utf-8").read()
_g = {"__file__": ROOM, "__name__": "__main__"}
# the room's own interior lamps are wanted; its sun, sky and cube render are not
exec(compile(_src[:_src.index('bpy.ops.object.light_add(type="SUN")')], ROOM, "exec"), _g)
globals().update({k: v for k, v in _g.items() if not k.startswith("__")})

def kill(pred):
    for ob in list(bpy.data.objects):
        if pred(ob):
            bpy.data.objects.remove(ob, do_unlink=True)

def named(*prefixes):
    return lambda ob: any(ob.name == p or ob.name.startswith(p) for p in prefixes)

def alive(L):
    try:
        return L.name in bpy.data.objects
    except ReferenceError:
        return False

# ── the full-size materials the geometry below names (swapped for toy ones at the end) ──
def brick():
    return principled("brick", "#8E4A33", 0.9)[0]
def stripes():
    """The play set's awning: cream and red bands, as on the Study's model."""
    m, nt, p = principled("awning", None, 0.7, coat=0.1)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord"); w = n.new("ShaderNodeTexWave")
    w.wave_type = "BANDS"; w.bands_direction = "X"; w.wave_profile = "SAW"
    w.inputs["Scale"].default_value = 1.0
    mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (2.2, 1, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], w.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = lin("#E9DDC2")
    ramp.color_ramp.elements[1].position = 0.5; ramp.color_ramp.elements[1].color = lin("#A3352B")
    nt.links.new(w.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    return m
BRICK = brick()
OFFICE_WALL = principled("office-wall", "#E9DCC2", 0.92)[0]
PLANK = walnut("plank", light=True)
ROOF = walnut("roof")
ROOF_DECK = principled("roof-deck", "#2F3B52", 0.6)[0]
SHELL = principled("shell", "#EFE2C8", 0.85)[0]
SIGN = principled("sign", "#F5EAD0", 0.5)[0]
STRIPE = stripes()
GREEN_GLASS = emissive("banker-glass", "#2F7A4E", 1.2)
PAPER = principled("paper", "#F3EBDA", 0.8)[0]
VAN = principled("van-paint", "#1F9E98", 0.35, coat=0.6)[0]
VAN_BAND = principled("van-band", "#F5EAD0", 0.4, coat=0.5)[0]
TYRE = principled("tyre", "#161412", 0.85)[0]
DARK_GLASS = principled("van-glass", "#22302F", 0.05, metal=0.2)[0]
SCAN_RED = emissive("scan-red", "#FF3B22", 4.0)
CAB_STEEL = principled("cabinet", "#2C6F69", 0.5, metal=0.2)[0]
ALLEY = principled("alley", "#9E9284", 0.9)[0]
SLATE = principled("slate", "#24282A", 0.85)[0]
FELT = principled("felt", "#4C6A3E", 1.0)[0]
STREET_BULB = emissive("street-bulb", "#FFD9A0", 30.0)

# ── trim the room for the cutaway ────────────────────────────────────────
# the outside seen through the door, the cover's window, the ceiling and the street front go;
# the front comes back as the shell, which lifts off
kill(named("sidewalk", "outside-sky", "planter", "grass", "case-", "ceiling"))
kill(named("wall-e", "n-", "sk-ne", "sk-nw", "sk-e", "e-shelf", "e-bag", "e-label", "e-mug", "e-upright", "east-sign"))
for L in list(LAMPS):
    if alive(L) and (L.location.y > GLASS - 0.3 or L.location.x > XE - 0.3):
        bpy.data.objects.remove(L, do_unlink=True)
kill(lambda ob: ob.name.startswith("sconce") and (ob.location.y > GLASS - 0.3 or ob.location.x > XE - 0.3))

# one floor, three rooms west to east: the café, the dining room, the back office. The inner walls
# are cut low like a plan; the south wall stays full height behind them all.
DX0, DX1 = XE, XE + 2.9            # the dining room
OX0, OX1 = DX1, DX1 + 2.9          # the office
ALLEY_E = OX1 + T
SIDE = 2.0                         # the sidewalk's depth, north of the shop
PY1 = GLASS + SIDE
WIDE = (-2.75, -0.15)              # the café opens wide into the dining room
DOORWAY = (-0.9, -0.1)             # the office has an ordinary door
def low_wall(nm, x0, gap, mat):
    for y0, y1 in ((YS, gap[0]), (gap[1], GLASS)):
        box(nm, x0, x0 + T, y0, y1, FLOOR, FLOOR + 1.2, mat)
        box(nm + "-cap", x0 - 0.01, x0 + T + 0.01, y0, y1, FLOOR + 1.2, FLOOR + 1.23, WALNUT)
low_wall("partition", DX0, WIDE, PLASTER)
low_wall("office-w", OX0, DOORWAY, BRICK)
box("dining-floor", DX0, DX1, YS, GLASS, FLOOR - T, FLOOR, FLOOR_T)
box("dining-s", DX0, DX1, YS - T, YS, FLOOR, CEIL, BRICK)
box("office-e", OX1, OX1 + T, YS, GLASS + T, FLOOR, FLOOR + 1.2, BRICK)
box("office-e-cap", OX1 - 0.01, OX1 + T + 0.01, YS, GLASS + T, FLOOR + 1.2, FLOOR + 1.23, WALNUT)
# the street front east of the café, cut at knee height
box("front-low", XE, OX1, GLASS, GLASS + T, FLOOR, FLOOR + 0.45, BRICK)
box("front-low-cap", XE, OX1, GLASS - 0.01, GLASS + T + 0.01, FLOOR + 0.45, FLOOR + 0.48, WALNUT)
box("sidewalk", XW - T, ALLEY_E, GLASS, PY1, FLOOR - T, FLOOR, ALLEY)
box("kerb", XW - T, ALLEY_E, PY1 - 0.15, PY1, FLOOR, FLOOR + 0.1, ALLEY)

def halo_mat(colour, strength, alpha):
    """A see-through glowing shell: reads as the soft bloom round a bare bulb, without a compositor."""
    m = bpy.data.materials.new("bulb-halo"); m.use_nodes = True
    nt = m.node_tree; n = nt.nodes; n.clear()
    out = n.new("ShaderNodeOutputMaterial"); mix = n.new("ShaderNodeMixShader")
    tr = n.new("ShaderNodeBsdfTransparent"); em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = lin(colour); em.inputs["Strength"].default_value = strength
    lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = alpha
    inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    pw = n.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 4.0   # bright core, no visible rim
    nt.links.new(lw.outputs["Facing"], inv.inputs[1]); nt.links.new(inv.outputs[0], pw.inputs[0]); nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m

def hang_bulbs(bulbs, top, energy=45, glow=9.0, pools=0.0):
    """Bare amber bulbs on cords, each with a soft halo and a warm spot pooling on what's below."""
    warm = emissive("bulb-warm", "#FFB45C", glow)
    halo = halo_mat("#FF9A3A", 1.2, 0.4)
    for b in bulbs:
        rod("bulb-cord", 0.005, b, (b[0], b[1], top), BOARD, 8)
        bpy.ops.object.light_add(type="POINT", location=b)
        L = bpy.context.object; L.data.shadow_soft_size = 0.05; L.data.color = (1.0, 0.78, 0.5); L.data.energy = energy
        L.visible_camera = False
        ball("bulb", 0.06, b, warm)
        h = ball("bulb-halo", 0.22, b, halo)
        h.visible_shadow = False; h.visible_diffuse = False; h.visible_glossy = False
        if pools:
            bpy.ops.object.light_add(type="SPOT", location=(b[0], b[1], b[2] - 0.08))
            S_ = bpy.context.object; S_.rotation_euler = (0, 0, 0)        # spots point down -Z by default
            S_.data.spot_size = math.radians(62); S_.data.spot_blend = 0.6; S_.data.shadow_soft_size = 0.08
            S_.data.color = (1.0, 0.6, 0.3); S_.data.energy = pools; S_.visible_camera = False

# ── the dining room: four tables and a window ledge; the pantry on the back wall ──
rnd = random.Random(7)
SACK = principled("sack", "#B39A72", 0.95)[0]
SEATS = []
# Every place a guest can stay with their cup: a dining chair, sat in, or a spot at the window ledge,
# stood at. Each says where the guest's cup is set down (on the table in front of the chair, on the
# ledge in front of the spot), so the page stands the cup there for as long as they stay.
CHAIRS = []
def chair(x, y, facing, cup):
    """A shell chair, mustard on walnut legs, with a brass socket in the seat that a peg drops into
    (the play set's way of sitting: pegs have no knees); facing is the way its sitter looks."""
    box("chair-seat", x - 0.2, x + 0.2, y - 0.2, y + 0.2, FLOOR + 0.43, FLOOR + 0.48, MUSTARD, bevel=0.06)
    cyl("chair-socket", 0.235, x, y, FLOOR + 0.48, FLOOR + 0.515, BRASS)
    bx, by = {"n": (0, -1), "s": (0, 1)}[facing]
    y0 = y + by * 0.16
    box("chair-back", x - 0.19, x + 0.19, min(y0, y0 + by * 0.06), max(y0, y0 + by * 0.06), FLOOR + 0.48, FLOOR + 0.8, MUSTARD, bevel=0.03)
    for lx, ly in ((-0.15, -0.15), (-0.15, 0.15), (0.15, -0.15), (0.15, 0.15)):
        rod("chair-leg", 0.012, (x + lx, y + ly, FLOOR), (x + lx * 0.7, y + ly * 0.7, FLOOR + 0.43), WALNUT)
    SEATS.append((x, y, FLOOR + 0.48))
    CHAIRS.append({"at": (x, y, FLOOR + 0.48), "facing": facing, "kind": "chair", "cup": cup})
# The two rows stand apart enough for a guest to walk between them (y -1.75), and the chairs tuck
# under the tops, so the aisle between the columns (x 4.45) reaches every chair.
TABLES = [(DX0 + 0.85, -2.65), (DX1 - 0.85, -2.65), (DX0 + 0.85, -0.85), (DX1 - 0.85, -0.85)]
TUCK = 0.45
for tx, ty in TABLES:
    cyl("table-top", 0.33, tx, ty, FLOOR + 0.72, FLOOR + 0.75, TOP_T)
    cyl("table-post", 0.03, tx, ty, FLOOR + 0.05, FLOOR + 0.72, BRASS)
    cyl("table-foot", 0.22, tx, ty, FLOOR, FLOOR + 0.04, BRASS)
    chair(tx, ty - TUCK, "n", (tx, ty - 0.14, FLOOR + 0.75)); chair(tx, ty + TUCK, "s", (tx, ty + 0.14, FLOOR + 0.75))
# a walnut ledge along the front, stood at: four places, a peg's width and more apart, the cup set on
# the ledge in front of each (no stools: a peg can't sit on one, and a guest at a window stands)
LEDGE = GLASS - 0.55
box("ledge", DX0 + 0.25, DX1 - 0.25, GLASS - 0.32, GLASS - 0.02, FLOOR + 1.0, FLOOR + 1.04, WALNUT, bevel=0.004)
for bx in (DX0 + 0.5, DX1 - 0.5):
    box("ledge-bracket", bx - 0.015, bx + 0.015, GLASS - 0.3, GLASS - 0.02, FLOOR + 0.48, FLOOR + 1.0, BRASS)
for k in range(4):
    lx = DX0 + 0.65 + 0.6 * k
    SEATS.append((lx, LEDGE, FLOOR))
    CHAIRS.append({"at": (lx, LEDGE, FLOOR), "facing": "n", "kind": "ledge", "cup": (lx + 0.05, GLASS - 0.2, FLOOR + 1.04)})
# the pantry: three bays of walnut shelving against the back wall
SH0, SH1, SY0, SY1 = DX0 + 0.3, DX1 - 0.3, YS, YS + 0.42
UP = [SH0 + k * (SH1 - SH0) / 3 for k in range(4)]
LV = [0.1, 0.55, 1.0, 1.45, 1.9, 2.2]                    # shelf heights; the last is the top board
for ux in UP:
    box("shelf-upright", ux - 0.03, ux + 0.03, SY0, SY1, FLOOR, FLOOR + LV[-1] + 0.035, WALNUT, bevel=0.004)
for lz in LV:
    box("shelf", SH0 - 0.03, SH1 + 0.03, SY0, SY1, FLOOR + lz, FLOOR + lz + 0.035, WALNUT_L, bevel=0.003)
for b in range(3):
    bx0, bx1 = UP[b] + 0.05, UP[b + 1] - 0.05
    for j in range(5):
        z = FLOOR + LV[j] + 0.035
        room_h = LV[j + 1] - LV[j] - 0.1
        m = (bx0 + bx1) / 2
        box("shelf-card", m - 0.09, m + 0.09, SY1, SY1 + 0.004, z - 0.033, z - 0.004, PAPER)   # a label per shelf
        x = bx0
        while True:
            if j == 0:   # sacks on the bottom shelf
                wd = rnd.uniform(0.22, 0.3)
                if x + wd > bx1: break
                box("sack", x, x + wd, SY0 + 0.06, SY1 - 0.04, z, z + rnd.uniform(0.26, 0.34), SACK, bevel=0.06)
            else:
                wd = rnd.choice((0.16, 0.2, 0.24, 0.3))
                if x + wd > bx1: break
                hg = room_h * rnd.uniform(0.62, 0.95)
                d0 = SY0 + 0.05 + rnd.uniform(0, 0.08)
                box("store-box", x, x + wd, d0, SY1 - 0.03, z, z + hg, KRAFT, bevel=0.006)
                box("box-label", x + wd * 0.22, x + wd * 0.78, SY1 - 0.03, SY1 - 0.026, z + hg * 0.42, z + hg * 0.72, PAPER)
            x += wd + rnd.uniform(0.015, 0.05)
# the bulbs hang from two walnut beams resting on brass posts over the low walls
for BY_ in sorted({ty for _, ty in TABLES}):
    box("dining-beam", DX0, DX1 + T, BY_ - 0.05, BY_ + 0.05, CEIL - 0.1, CEIL, WALNUT, bevel=0.004)
    for x in (DX0 + T / 2, DX1 + T / 2):
        rod("beam-post", 0.02, (x, BY_, FLOOR + 1.23), (x, BY_, CEIL - 0.1), BRASS)
hang_bulbs([(tx, ty, CEIL - 0.75) for tx, ty in TABLES], CEIL - 0.1, energy=18, glow=5.0, pools=12)
area("dining-fill", ((DX0 + DX1) / 2, -1.6, CEIL - 0.05), ((DX0 + DX1) / 2, -1.6, FLOOR), 2.4, 30, colour=(1.0, 0.76, 0.5))

# ── the back office: the brief, the ledgers, CI, the clock ─────────────────
def wall_frame(nm, centre, wd, h):
    x, y, z = centre
    box(nm + "-frame", x - wd / 2, x + wd / 2, y, y + 0.04, z - h / 2, z + h / 2, WALNUT, bevel=0.006)
    box(nm + "-face", x - wd / 2 + 0.06, x + wd / 2 - 0.06, y + 0.04, y + 0.045, z - h / 2 + 0.06, z + h / 2 - 0.06, PAPER)
def clock(centre):
    rot = (math.radians(90), 0, 0); off = Vector((0, 1, 0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.24, depth=0.05, location=Vector(centre) + off * 0.025, rotation=rot)
    bpy.context.object.name = "clock"; bpy.context.object.data.materials.append(BRASS)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.21, depth=0.01, location=Vector(centre) + off * 0.055, rotation=rot)
    bpy.context.object.name = "clock-face"; bpy.context.object.data.materials.append(PAPER)
    c = Vector(centre) + off * 0.065
    rod("clock-hand", 0.006, c, c + Vector((0.1, 0, 0.1)), BOARD, 8)
    rod("clock-hand", 0.006, c, c + Vector((0, 0, 0.16)), BOARD, 8)

OY0 = YS
box("office-floor", OX0 + T, OX1, OY0, GLASS, FLOOR - T, FLOOR, PLANK)
box("office-s", OX0, OX1, OY0 - T, OY0, FLOOR, CEIL, OFFICE_WALL)
box("office-wainscot", OX0 + T, OX1, OY0, OY0 + 0.02, FLOOR, FLOOR + 0.95, TEAL)
rod("office-rail", 0.012, (OX0 + T, OY0 + 0.02, FLOOR + 0.95), (OX1, OY0 + 0.02, FLOOR + 0.95), BRASS)
O = OX0 - XE                       # the office's furniture, laid out from its west wall
DESK = (O + 3.7, O + 5.2, -2.65, -1.95); LAMP_AT = (O + 3.95, -2.45); BRIEF = (O + 4.35, -2.35); CHAIR = (O + 4.45, -1.5)
FC = (O + 5.15, O + 5.75, OY0 + 0.02, OY0 + 0.62)
CERT = (O + 3.7, OY0, 0.9); CLOCK = (O + 5.45, OY0, 1.2)   # apart, so their pins don't touch
WASH = (O + 4.45, -2.2)
box("desk-top", DESK[0], DESK[1], DESK[2], DESK[3], FLOOR + 0.72, FLOOR + 0.76, WALNUT, bevel=0.006)
box("desk-drawers", DESK[1] - 0.5, DESK[1] - 0.04, DESK[2] + 0.04, DESK[3] - 0.04, FLOOR + 0.3, FLOOR + 0.72, WALNUT_L, bevel=0.004)
for lx, ly in ((DESK[0] + 0.06, DESK[2] + 0.06), (DESK[0] + 0.06, DESK[3] - 0.06)):
    rod("desk-leg", 0.012, (lx, ly, FLOOR), (lx, ly, FLOOR + 0.72), BRASS)
bx_, by_ = BRIEF
box("brief", bx_ - 0.17, bx_ + 0.17, by_ - 0.12, by_ + 0.12, FLOOR + 0.76, FLOOR + 0.765, PAPER)
box("brief-2", bx_ - 0.12, bx_ + 0.22, by_ - 0.07, by_ + 0.17, FLOOR + 0.765, FLOOR + 0.77, PAPER)
lx_, ly_ = LAMP_AT
cyl("lamp-base", 0.07, lx_, ly_, FLOOR + 0.76, FLOOR + 0.79, BRASS)
rod("lamp-stem", 0.008, (lx_, ly_, FLOOR + 0.79), (lx_, ly_ + 0.05, FLOOR + 1.08), BRASS)
box("lamp-shade", lx_ - 0.18, lx_ + 0.18, ly_ - 0.02, ly_ + 0.16, FLOOR + 1.06, FLOOR + 1.14, GREEN_GLASS, bevel=0.03)
bpy.ops.object.light_add(type="POINT", location=(lx_, ly_ + 0.1, FLOOR + 1.02))
L = bpy.context.object; L.data.energy = 30; L.data.color = (1.0, 0.85, 0.6); L.data.shadow_soft_size = 0.05; L.visible_camera = False
cx_, cy_ = CHAIR
box("office-chair", cx_ - 0.22, cx_ + 0.22, cy_ - 0.22, cy_ + 0.22, FLOOR + 0.43, FLOOR + 0.48, MUSTARD, bevel=0.06)
box("office-chair-back", cx_ - 0.21, cx_ + 0.21, cy_ + 0.16, cy_ + 0.22, FLOOR + 0.48, FLOOR + 0.82, MUSTARD, bevel=0.03)
rod("office-chair-post", 0.02, (cx_, cy_, FLOOR), (cx_, cy_, FLOOR + 0.43), BRASS)
# the ledgers: a filing cabinet, four drawers
box("cabinet", FC[0], FC[1], FC[2], FC[3], FLOOR, FLOOR + 1.32, CAB_STEEL, bevel=0.01)
for k in range(4):
    z = FLOOR + 0.12 + k * 0.3
    m = (FC[0] + FC[1]) / 2
    box("cabinet-pull", m - 0.08, m + 0.08, FC[3], FC[3] + 0.02, z + 0.12, z + 0.15, BRASS)
    box("cabinet-label", m - 0.06, m + 0.06, FC[3], FC[3] + 0.004, z + 0.17, z + 0.22, PAPER)
wall_frame("cert", CERT, 0.9, 0.7)
clock(CLOCK)
area("office-wash", (WASH[0], WASH[1], CEIL - 0.05), (WASH[0], WASH[1], FLOOR), 2.6, 70, colour=(1.0, 0.88, 0.72))

# ── the van: deploys ─────────────────────────────────────────────────────
def van(cx, cy, s=1.0):
    """A rounded little delivery van, teal with a cream band, parked along the kerb cab-west.
    s scales it. Returns its centre."""
    L_, W_, Hh = 3.0 * s, 1.55 * s, 1.75 * s
    def b(nm, a0, a1, w0, w1, z0, z1, mat, bev=0.0):
        a0, a1 = -a1, -a0
        return box(nm, cx + a0, cx + a1, cy + w0, cy + w1, z0, z1, mat, bevel=bev)
    z = FLOOR + 0.3 * s
    b("van-body", -L_ / 2, L_ / 2 - 0.55 * s, -W_ / 2, W_ / 2, z, z + Hh - 0.3 * s, VAN, 0.18 * s)
    b("van-cab", L_ / 2 - 0.75 * s, L_ / 2, -W_ / 2 + 0.02 * s, W_ / 2 - 0.02 * s, z, z + Hh - 0.55 * s, VAN, 0.2 * s)
    b("van-band", -L_ / 2 - 0.004, L_ / 2 - 0.5 * s, -W_ / 2 - 0.004, W_ / 2 + 0.004, z + 0.55 * s, z + 0.78 * s, VAN_BAND)
    b("van-screen", L_ / 2 - 0.62 * s, L_ / 2 - 0.2 * s, -W_ / 2 + 0.06 * s, W_ / 2 - 0.06 * s, z + Hh - 0.9 * s, z + Hh - 0.6 * s, DARK_GLASS, 0.05 * s)
    b("van-door-seam", -L_ / 2 - 0.006, -L_ / 2 + 0.01, -0.006, 0.006, z + 0.1 * s, z + Hh - 0.42 * s, TYRE)
    for a in (-L_ / 2 + 0.6 * s, L_ / 2 - 0.55 * s):
        for wv in (-W_ / 2 + 0.05 * s, W_ / 2 - 0.05 * s):
            bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.3 * s, depth=0.2 * s, location=(cx - a, cy + wv, z), rotation=(math.radians(90), 0, 0))
            t = bpy.context.object; t.name = "van-tyre"; t.data.materials.append(TYRE); bpy.ops.object.shade_smooth()
    return (cx, cy, z + Hh / 2)
VANP = van((OX0 + OX1) / 2, PY1 - 0.15 - 0.62, s=0.75)   # at the kerb in front of the office

# the till's scanner, and the ticket rail on the back bar
box("scanner", 0.98, 1.12, -2.42, -2.3, 0.0, 0.07, STEEL, bevel=0.01)
box("scanner-eye", 1.0, 1.1, -2.302, -2.298, 0.02, 0.05, SCAN_RED)
RAIL_Y, RAIL_Z = YS + 0.6, 0.3
rod("ticket-rail", 0.012, (-0.95, RAIL_Y, RAIL_Z), (0.95, RAIL_Y, RAIL_Z), CHROME)
for hx in (-0.9, 0.9):
    rod("rail-hanger", 0.006, (hx, RAIL_Y, RAIL_Z), (hx, YS + 0.2, 0.48), CHROME, 8)
for k, tx in enumerate((-0.75, -0.5, -0.22, 0.05, 0.3, 0.62)):
    box("ticket", tx - 0.045, tx + 0.045, RAIL_Y - 0.002, RAIL_Y + 0.002, RAIL_Z - 0.16 - 0.02 * (k % 2), RAIL_Z - 0.01, PAPER)

# ── on the street, as on the Study's old play set: the specials board, a lamp, a tree ──
AF = (-1.55, GLASS + 0.95)        # the A-frame, between the walking line and the kerb
# Two boards hinged at the top, feet 0.3 m apart on the pavement. box() leaves each object's origin
# at the world origin, so a board is built round the origin, leant there, then moved into place:
# leaning it where it stood swung it about the origin, one board floating and the other sunk.
AF_H, AF_SPLAY = 0.95, 0.15
AF_LEAN = math.atan2(AF_SPLAY, AF_H); AF_L = math.hypot(AF_SPLAY, AF_H)
for s_ in (1, -1):
    bd = box("a-frame", -0.3, 0.3, -0.022, 0.022, -AF_L / 2, AF_L / 2, SLATE, bevel=0.012)
    bd.rotation_euler[0] = s_ * AF_LEAN
    bd.location = (AF[0], AF[1] + s_ * AF_SPLAY / 2, FLOOR + AF_H / 2)
    if s_ == 1:   # the specials, chalked on the street-facing board, ride on it
        for wd, z in ((0.38, 0.62), (0.3, 0.48), (0.34, 0.36)):
            ch = box("a-frame-chalk", -wd / 2, wd / 2, 0.022, 0.028, z - AF_H / 2, z - AF_H / 2 + 0.035, PAPER)
            ch.parent = bd
LAMPPOST = (XW + 0.25, PY1 - 0.45)
cyl("lamp-post", 0.05, LAMPPOST[0], LAMPPOST[1], FLOOR, FLOOR + 3.3, BRASS)
cyl("lamp-post-foot", 0.11, LAMPPOST[0], LAMPPOST[1], FLOOR, FLOOR + 0.18, BRASS)
STREET_AT = (LAMPPOST[0], LAMPPOST[1], FLOOR + 3.5)
ball("lamp-ball", 0.2, STREET_AT, STREET_BULB)
TREE = (ALLEY_E + 0.05, PY1 - 0.55)
cyl("trunk", 0.07, TREE[0], TREE[1], FLOOR, FLOOR + 2.0, WALNUT)
ball("crown", 0.75, (TREE[0], TREE[1], FLOOR + 2.55), FELT)

# a walnut plinth with a brass edge, under the whole model
PL = (XW - 0.5, ALLEY_E + 0.4, YS - 0.6, PY1 + 0.4, FLOOR - T - 0.3, FLOOR - T)
box("plinth", *PL, WALNUT, bevel=0.03)
rod("plinth-edge", 0.025, (PL[0], PL[3] + 0.01, PL[5] - 0.03), (PL[1], PL[3] + 0.01, PL[5] - 0.03), BRASS)

# ── the shell: the roof, its sign, the awning and the street front ─────────
def shell_box(nm, *a, mat=SHELL, bevel=0.0):
    return box("shell-" + nm, *a, mat, bevel)
RZ = CEIL + 0.02
shell_box("roof", XW - T - 0.08, ALLEY_E + 0.08, YS - T - 0.08, N1 + 0.12, RZ, RZ + 0.16, mat=ROOF, bevel=0.03)
# a painted deck set into the walnut slab, so the roof reads as a lid with a walnut edge, not a plank
shell_box("roof-deck", XW - T + 0.12, ALLEY_E - 0.12, YS - T + 0.12, N1 - 0.1, RZ + 0.16, RZ + 0.19, mat=ROOF_DECK, bevel=0.02)
rod("shell-roof-nosing", 0.016, (XW - T - 0.08, N1 + 0.13, RZ + 0.02), (ALLEY_E + 0.08, N1 + 0.13, RZ + 0.02), BRASS)
# the café's front: the door and the window stay open, so the room shows through them
shell_box("cafe-under", DOOR[1], XE, N0, N1, FLOOR, 0.0)
shell_box("cafe-over", XW - T, XE, N0, N1, DOOR[2], RZ)
shell_box("cafe-left", DOOR[1], -HALF_W, N0, N1, 0.0, DOOR[2])
shell_box("cafe-mid", HALF_W, XE, N0, N1, 0.0, DOOR[2])
shell_box("cafe-west", XW - T, DOOR[0], N0, N1, FLOOR, DOOR[2])
shell_box("cafe-transom", -HALF_W, HALF_W, N0, N1, 1.6, DOOR[2])
shell_box("west", XW - T, XW, YS - T, N0, FLOOR, RZ)
# the dining room's and the office's fronts, each with a window over the low wall
for nm, x0, x1 in (("dining", DX0, DX1), ("office", OX0 + T, OX1 + T)):
    shell_box(nm + "-sill", x0, x1, N0, N1, FLOOR + 0.48, FLOOR + 0.9)
    shell_box(nm + "-head", x0, x1, N0, N1, FLOOR + 2.55, RZ)
    for px0, px1 in ((x0, x0 + 0.35), (x1 - 0.35, x1)):
        shell_box(nm + "-pier", px0, px1, N0, N1, FLOOR + 0.9, FLOOR + 2.55)
    box("shell-" + nm + "-sill-cap", x0 + 0.35, x1 - 0.35, N0 - 0.02, N1 + 0.05, FLOOR + 0.88, FLOOR + 0.92, WALNUT)
shell_box("east", OX1, OX1 + T, YS - T, N1, FLOOR + 1.23, RZ)
# The café's own end wall (room.py's wall-w) sits exactly inside the shell's west wall, face on face,
# and the two creams fought in the render as stripes across the end of the set. Tuck it a centimetre
# inside on both sides, so the roof-on frame shows only the shell and the roof-off one only the wall.
_ww = bpy.data.objects["wall-w"]
for v in _ww.data.vertices:
    v.co.x *= (T - 0.02) / T
# the awning over the café's glass, and the sign board on the roof
me = bpy.data.meshes.new("shell-awning")
ay0, ay1, az0, az1 = N1, N1 + 0.75, DOOR[2] + 0.2, DOOR[2] - 0.12
me.from_pydata([(XW - T, ay0, az0), (XE, ay0, az0), (XE, ay1, az1), (XW - T, ay1, az1)], [], [(0, 1, 2, 3)])
aw = bpy.data.objects.new("shell-awning", me); scene.collection.objects.link(aw); me.materials.append(STRIPE)
aw.modifiers.new("s", "SOLIDIFY").thickness = 0.03
box("shell-valance", XW - T, XE, ay1 - 0.03, ay1, az1 - 0.16, az1, STRIPE)
SX = (XW + XE) / 2
SIGN_TOP = RZ + 1.55
box("shell-sign", SX - 3.3, SX + 3.3, N1 - 0.12, N1 - 0.02, RZ + 0.19, SIGN_TOP, SIGN, bevel=0.05)
for sx in (SX - 2.5, SX + 2.5):
    box("shell-sign-post", sx - 0.06, sx + 0.06, N1 - 0.4, N1 - 0.12, RZ + 0.19, RZ + 0.8, WALNUT)
cu = bpy.data.curves.new("shell-sign-text", "FONT")
fontp = next((p for p in ("C:/Windows/Fonts/georgiaz.ttf", "C:/Windows/Fonts/georgiai.ttf") if os.path.exists(p)), None)
if fontp:
    cu.font = bpy.data.fonts.load(fontp)
cu.body = "Sally Mander’s"; cu.size = 0.95; cu.extrude = 0.02; cu.align_x = "CENTER"; cu.align_y = "CENTER"
tx = bpy.data.objects.new("shell-sign-text", cu); scene.collection.objects.link(tx); tx.data.materials.append(RED)
tx.location = (SX, N1 - 0.012, (RZ + 0.19 + SIGN_TOP) / 2); tx.rotation_euler = (math.radians(90), 0, math.radians(180))   # faces the street (+y)

# ── anchors (full-size points; the caller projects them) ──────────────────
ANCH = {
    "door": (-2.9, GLASS, -0.1),
    "till": (0.55, CY1 - 0.16, 0.12),
    "scanner": (1.05, -2.36, 0.07),
    "rail": (-0.6, RAIL_Y, RAIL_Z - 0.08),   # the rail's west end, clear of the till's pin
    "machine": (EX, CY0 + 0.25, 0.3),
    "boards": (0.0, YS + 0.06, 1.5),
    "pantry": ((SH0 + SH1) / 2, SY1, FLOOR + 1.3),
    "dining": ((DX0 + DX1) / 2, -1.75, FLOOR + 0.75),
    "desk": (BRIEF[0], BRIEF[1], FLOOR + 0.77),
    "cabinet": ((FC[0] + FC[1]) / 2, FC[3], FLOOR + 0.9),
    "certificate": CERT,
    "clock": CLOCK,
    "van": VANP,
}
# where a guest stands: a foot on the floor, a head 1.6 m up (the page scales its figures by these)
LANE = GLASS + 0.4                       # the sidewalk's walking line, clear of the van's tyres and the board
WALK = {
    # guests step out from behind the van in the east, and from the open pavement past the lamp post
    "street-w": (XW + 0.05, LANE), "street-e": (VANP[0] + 0.25, LANE),
    "door-out": (-2.9, LANE), "door-in": (-2.9, GLASS - 0.35),
    "aisle": (-1.75, -0.75), "till": (0.55, CY1 + 0.42),
    # where a cup is handed over, at the counter's west end by the machine
    "pass": (-1.1, CY1 + 0.38),
    # into the dining room: across the café, through the partition's opening, along the gangway
    # between the two rows of tables, and up and down the aisle between the two columns
    "cafe-e": (2.0, -1.7), "din-gate": (DX0 + T / 2, -1.75),
    "din-w": (TABLES[0][0], -1.75), "din-x": ((DX0 + DX1) / 2, -1.75), "din-e": (TABLES[1][0], -1.75),
    "din-n": ((DX0 + DX1) / 2, TABLES[2][1] + TUCK), "din-s": ((DX0 + DX1) / 2, TABLES[0][1] - TUCK),
    # on along the aisle to the window ledge, between the front tables' chairs
    "din-ledge": ((DX0 + DX1) / 2, LEDGE),
}
# the wait spots, nearest the pass first: the front row keeps a peg's width clear of the pass and the
# till either side of it (cutaway.py checks every standing spot is that far from the rest)
for k, (wx, wy) in enumerate(((-0.55, -1.62), (-1.65, -1.6), (-0.1, -1.62), (-0.75, -1.12), (-1.2, -1.1),
                              (-1.65, -1.06), (-0.3, -0.7), (-0.75, -0.55), (-1.2, -0.5), (0.15, -1.1))):
    WALK[f"wait-{k}"] = (wx, wy)
for k in range(8):   # the load test's line, along the sidewalk east of the door
    WALK[f"queue-{k}"] = (-2.35 + 0.42 * k, LANE + 0.05)
WALK["refused"] = (-3.7, LANE + 0.5)
# The walking graph: a guest only ever moves along these straight edges, and cutaway.py fails the
# render if any of them, widened by a peg's radius, touches something solid.
EDGES = [("street-w", "door-out"), ("street-e", "door-out"), ("door-out", "door-in"), ("door-in", "aisle"),
         ("aisle", "till"), ("aisle", "pass"), ("pass", "cafe-e"), ("cafe-e", "din-gate"),
         ("din-gate", "din-w"), ("din-w", "din-x"), ("din-x", "din-e"), ("din-x", "din-n"), ("din-x", "din-s"),
         ("din-n", "din-ledge")]
EDGES += [("till", f"wait-{k}") for k in range(10)] + [(f"wait-{k}", "pass") for k in range(10)]
EDGES += [(f"wait-{k}", "aisle") for k in range(10)]
# each place's last step: from the gangway or the aisle into the seat (a sit, unchecked), or along the
# ledge to the spot (a walk, which cutaway.py checks like an edge)
for ch in CHAIRS:
    x, y, _ = ch["at"]
    if ch["kind"] == "ledge":
        ch["from"] = "din-ledge"
    else:
        ch["from"] = ("din-w" if x < WALK["din-x"][0] else "din-e") if abs(y - (-1.75)) < 0.6 else ("din-n" if y > -1.75 else "din-s")
# the baristas' marks behind the counter: the till, the pass, the machine (from its far side, where
# the machine doesn't hide them) and the back bar between
STATIONS = {"till": (0.3, -2.97), "pass": (-1.1, -2.95), "machine": (-2.12, -3.0), "backbar": (-0.35, -3.05)}
CUP_AT = (-1.1, CY1 - 0.12, 0.0)                   # where a finished drink waits, on the counter at the pass
STEAM_AT = (EX, CY0 + 0.5, 0.26)                   # the group heads, where the shots pour
# rooms, for the floor-by-floor plates: floor boxes the caller hulls
ZONES = {
    "front": (XW - T, ALLEY_E, GLASS, PY1, 0.0),
    "cafe": (XW, XE, YS, GLASS, 1.2),
    "dining": (DX0, DX1 + T, YS, GLASS, 1.2),
    "office": (OX0, OX1 + T, YS, GLASS, 1.2),
}
# the Study's hotspots on the outside, and the flag's foot on top of the sign board
OUTSIDE = {
    "order": (0.0, N1, 0.75),                          # the café's window: the ordering API
    "door": (-2.9, N1, 0.4),
    "board": (AF[0], AF[1], FLOOR + 0.95),
    "van": VANP,
    "sign": (SX, N1 - 0.02, (RZ + 0.19 + SIGN_TOP) / 2),
    "flag": (SX + 3.0, N1 - 0.9, RZ + 0.19),         # on the roof deck, behind the sign's east end
    "street": STREET_AT,
    "inside": (-1.75, -0.4, 0.4),
}

# ── the staff: two peg baristas behind the counter, in the shop's apron and cap ──
# The same figure as the guests (a painted body, a maple head), a little taller so the apron's bib
# clears the counter, in a cream shirt with a red apron and a red cap. The apron is a curved panel
# on the body's front, tied at the waist, with a cream patch on the bib for the shop's mark.
STAFF_SHIRT = principled("staff-shirt", "#E9DDC2", 0.6)[0]
STAFF_RED = principled("staff-red", "#A3352B", 0.6)[0]
STAFF_PATCH = principled("staff-patch", "#F2E8D2", 0.6)[0]
# x clear of the pendants (-0.76, 0.76, 2.3) and of the machine, which stands taller than a peg's chest
STAFF = [(0.2, -2.97), (-2.12, -3.0)]           # at the till, and on the far side of the espresso machine
BODY_H, HEAD_R = 1.3, 0.21                       # the bib's top clears the counter (1.05 m) by a hand
def arc_shell(nm, x, y, r0, r1, half_deg, z0, z1, mat, segs=24):
    """A curved panel round the front (+y) of a peg: the arc ±half_deg, between radii r0 and r1."""
    vs, fs = [], []
    for i in range(segs + 1):
        a = math.radians(-half_deg + 2 * half_deg * i / segs)
        for r in (r0, r1):
            for z in (z0, z1):
                vs.append((x + r * math.sin(a), y + r * math.cos(a), z))
    for i in range(segs):
        a, b = 4 * i, 4 * (i + 1)
        fs += [(a + 2, b + 2, b + 3, a + 3),   # outside
               (a, a + 1, b + 1, b),           # inside
               (a + 1, a + 3, b + 3, b + 1),   # top
               (a, b, b + 2, a + 2)]           # bottom
    fs += [(0, 2, 3, 1), (4 * segs, 4 * segs + 1, 4 * segs + 3, 4 * segs + 2)]   # the two ends
    me = bpy.data.meshes.new(nm); me.from_pydata(vs, [], fs); me.update()
    for f in me.polygons: f.use_smooth = True
    ob = bpy.data.objects.new(nm, me); scene.collection.objects.link(ob); me.materials.append(mat)
    md = ob.modifiers.new("b", "BEVEL"); md.width = 0.008; md.segments = 2; md.limit_method = "ANGLE"
    return ob
for sx, sy in STAFF:
    body = cyl("staff-body", 0.2, sx, sy, FLOOR, FLOOR + BODY_H, STAFF_SHIRT)
    md = body.modifiers.new("b", "BEVEL"); md.width = 0.07; md.segments = 3; md.limit_method = "ANGLE"
    hz = FLOOR + BODY_H + HEAD_R - 0.02           # the head rests on the body, sunk a little
    ball("staff-head", HEAD_R, (sx, sy, hz), WALNUT_L)
    # the apron: a bib from the chest to the knees, round the front, tied at the waist
    top = FLOOR + BODY_H - 0.07
    arc_shell("staff-apron", sx, sy, 0.2, 0.218, 62, FLOOR + 0.3, top, STAFF_RED)
    cyl("staff-tie", 0.209, sx, sy, FLOOR + 0.72, FLOOR + 0.76, STAFF_RED)
    for s_ in (-1, 1):   # the neck strap, from the bib's corners over the shoulders
        a0, a1 = math.radians(s_ * 60), math.radians(s_ * 28)
        rod("staff-strap", 0.012, (sx + 0.214 * math.sin(a0), sy + 0.214 * math.cos(a0), top - 0.01),
            (sx + 0.13 * math.sin(a1), sy + 0.13 * math.cos(a1), FLOOR + BODY_H + 0.005), STAFF_RED, 12)
    arc_shell("staff-patch", sx, sy, 0.217, 0.222, 17, top - 0.17, top - 0.05, STAFF_PATCH, segs=6)
    # the cap hugs the crown, so the maple face shows under it; a brim to the front, a button on top
    ball("staff-cap", HEAD_R + 0.004, (sx, sy, hz + 0.09), STAFF_RED, squash=0.56)
    cyl("staff-brim", 0.14, sx, sy + 0.11, hz + 0.075, hz + 0.093, STAFF_RED)
    ball("staff-button", 0.022, (sx, sy, hz + 0.09 + (HEAD_R + 0.004) * 0.56), STAFF_PATCH)

# ── the menu wall: one long sign-painted board behind the counter ───────
# room.py's slat wall and its three empty boards stay for the portfolio's full-size tour; the toy
# trades them for a plain plaster wall and the real menu, lettered by menu-wall.mjs from the
# catalogue in the shop's own faces, so the board says what the till sells.
_BACK = {"backing", "slat", "standoff", "specials-frame", "specials-face",
         *(f"board-{k}-{p}" for k in ("fullstack", "sdet", "addons") for p in ("frame", "face"))}
kill(lambda ob: ob.name.split(".")[0] in _BACK)
box("back-wall", XW, XE, YS - 0.06, YS - 0.01, FLOOR, CEIL, PLASTER)
# 7% under the painted size, kept to its proportions and hung from the counter's open end: at full
# size its far end ran in behind the side wall's return, and the last price (the banana bread's) with
# it (round 1, all four)
box("menu-frame", -3.36, 2.8, YS - 0.01, YS + 0.05, 0.715, 2.08, WALNUT)
def _menu_face(nm, x0, x1, z0, z1, y, image):
    """A flat face toward the camera (+y), u running the way the viewer reads it (from +x to -x)."""
    m, nt, p = principled("menu-wall", None, 0.7, coat=0.1)
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(image)
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
    tbump_ = nt.nodes.new("ShaderNodeTexNoise"); tbump_.inputs["Scale"].default_value = 400.0
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.05
    nt.links.new(tbump_.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    me = bpy.data.meshes.new(nm)
    me.from_pydata([(x1, y, z0), (x0, y, z0), (x0, y, z1), (x1, y, z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = c
    ob = bpy.data.objects.new(nm, me); scene.collection.objects.link(ob); me.materials.append(m)
    return ob
# 6.0 m by 1.285 m, the same proportions menu-wall.mjs paints at (6.44 by 1.38)
_menu_face("menu-face", -3.28, 2.72, 0.755, 2.04, YS + 0.052, os.path.join(HERE, "menu-wall.png"))
# three brass picture lights over the board, each a hooded tube on a swan arm throwing a warm scallop
# down the painted face: next to the old slat wall the plain board read flat and cold (round 1, three
# of four). Lights made here are in BUILT, so the toy's shrink scales their watts back like the rest.
for i, px in enumerate((-2.28, -0.28, 1.72)):
    rod("menu-lamp-arm", 0.011, (px, YS + 0.05, 2.1), (px, YS + 0.24, 2.24), BRASS, 10)
    rod("menu-lamp-hood", 0.042, (px - 0.24, YS + 0.27, 2.22), (px + 0.24, YS + 0.27, 2.22), BRASS, 18)
    area(f"menu-lamp-{i}", (px, YS + 0.25, 2.17), (px, YS + 0.02, 1.35), 0.44, 38, colour=(1.0, 0.76, 0.48), sy=0.05)

# ── into a toy ───────────────────────────────────────────────────────────
LAMPS[:] = [L for L in LAMPS if alive(L)]
# room.py sets these per light state after the point it was cut at; take its evening values
for L in LAMPS:
    L.data.energy = 40
for L in INTERIOR:
    if alive(L):
        L.data.energy *= 0.6
BUILT = [ob for ob in bpy.data.objects]
# the café's glazed door and sidelights are part of the street front, so they lift off with it
DOORWAY_PARTS = {"pane-side-l", "pane-door", "pane-side-r", "jamb-l", "jamb-r", "mullion", "transom", "head",
                 "bottom-rail", "pull", "pull-post", "door-sign"}
SHELL_OBS = [ob for ob in BUILT if ob.name.startswith("shell-") or ob.name.split(".")[0] in DOORWAY_PARTS]

# full size → toy: the plinth comes to 17 cm, like the Study's old base
S = 0.17 / (PL[1] - PL[0])
C = Vector(((PL[0] + PL[1]) / 2, (PL[2] + PL[3]) / 2, PL[4]))
def local(p):
    return (Vector(p) - C) * S

def tmapped(nt, vec, scale):
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    nt.links.new(vec, mp.inputs["Vector"]); return mp.outputs[0]

def tbump(nt, p, scale, strength, detail=4.0):
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord"); no = n.new("ShaderNodeTexNoise")
    no.inputs["Scale"].default_value = scale; no.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], no.inputs["Vector"])
    b = n.new("ShaderNodeBump"); b.inputs["Strength"].default_value = strength; b.inputs["Distance"].default_value = 0.001
    nt.links.new(no.outputs["Fac"], b.inputs["Height"]); nt.links.new(b.outputs["Normal"], p.inputs["Normal"])

# The Study's toy materials (its scene.py), with their texture scales given per toy metre and
# converted here, since these objects keep full-size coordinates under the shrunk parent.
def toy_wood(name, scale, lo, hi, rough=0.5, coat=0.3):
    m, nt, p = principled("toy-" + name, None, rough, coat=coat)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord"); info = n.new("ShaderNodeObjectInfo")
    k = n.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 40.0
    nt.links.new(info.outputs["Random"], k.inputs[0])
    comb = n.new("ShaderNodeCombineXYZ")
    nt.links.new(k.outputs[0], comb.inputs[0]); nt.links.new(k.outputs[0], comb.inputs[2])
    add = n.new("ShaderNodeVectorMath"); add.operation = "ADD"
    nt.links.new(tc.outputs["Object"], add.inputs[0]); nt.links.new(comb.outputs[0], add.inputs[1])
    wave = n.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Y"
    for key, v in (("Scale", 1.0), ("Distortion", 14.0), ("Detail", 3.0), ("Detail Roughness", 0.6)):
        wave.inputs[key].default_value = v
    f = scale * S
    nt.links.new(tmapped(nt, add.outputs[0], (4 * f, 40 * f, 40 * f)), wave.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.15, lin(lo); e[1].position, e[1].color = 0.95, lin(hi)
    e.new(0.55).color = lin(lo)
    nt.links.new(wave.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    return m
_paint = {}
def paint(colour, rough=0.5, coat=0.18):
    """Satin paint over wood, with a fine orange-peel bump."""
    key = (colour, rough, coat)
    if key not in _paint:
        m, nt, p = principled("toy-paint-" + colour.lstrip("#"), colour, rough, coat=coat)
        tbump(nt, p, 900 * S, 0.08, 2.0)
        _paint[key] = m
    return _paint[key]
def checker(a, b, tiles_per_m):
    m, nt, p = principled("toy-checker", None, 0.45, coat=0.18)
    n = nt.nodes
    tc = n.new("ShaderNodeTexCoord"); ch = n.new("ShaderNodeTexChecker")
    ch.inputs["Scale"].default_value = tiles_per_m
    ch.inputs["Color1"].default_value = lin(a); ch.inputs["Color2"].default_value = lin(b)
    nt.links.new(tc.outputs["Object"], ch.inputs["Vector"]); nt.links.new(ch.outputs["Color"], p.inputs["Base Color"])
    tbump(nt, p, 900 * S, 0.06, 2.0)
    return m

T_WALNUT = toy_wood("walnut", 6, "#4A3324", "#8A6646")
T_MAPLE = toy_wood("maple", 6, "#B98F5E", "#DDBF92")
T_BRASS = principled("toy-brass", "#C9A15A", 0.28, metal=1.0)[0]
T_NICKEL = principled("toy-nickel", "#CFC8BC", 0.3, metal=1.0)[0]
T_FELT = principled("toy-felt", "#4C6A3E", 1.0, sheen=0.8)[0] if "sheen" in principled.__code__.co_varnames else principled("toy-felt", "#4C6A3E", 1.0)[0]
tbump(T_FELT.node_tree, T_FELT.node_tree.nodes["Principled BSDF"], 500 * S, 0.3)
T_RUBBER = principled("toy-rubber", "#1A1817", 0.7)[0]
CREAM_P = "#E9DDC2"
TOY = {
    # woods
    "walnut": T_WALNUT, "walnut-v": T_WALNUT, "roof": T_WALNUT, "walnut-l": T_MAPLE, "plank": T_MAPLE, "alley": T_MAPLE,
    "concrete": T_MAPLE,
    # paint, in the play set's six colours and their near neighbours
    "floor": checker("#E9DDC2", "#CDB993", 1 / 0.6), "top": paint("#EFE6D2", 0.4, 0.3), "pot": paint(CREAM_P),
    "plaster": paint("#E3D3B4"), "office-wall": paint(CREAM_P), "shell": paint(CREAM_P), "sign": paint("#F2E8D2"),
    "teal": paint("#2C6B67"), "teal-paint": paint("#2C6B67"), "cabinet": paint("#2C6B67"), "van-paint": paint("#2C6B67", 0.4, 0.4),
    "mustard": paint("#C8952F"), "label-red": paint("#A3352B"), "brick": paint("#5E211F"), "van-band": paint(CREAM_P, 0.4, 0.4),
    "steel": paint("#26324A"), "roof-deck": paint("#2F3B52", 0.55, 0.25), "dark": paint("#1F1A16", 0.8), "board": paint("#24282A", 0.8), "mat": paint("#24282A", 0.8),
    "slate": paint("#24282A", 0.85, 0.0), "stoneware": paint("#F4F0E8", 0.15, 0.6), "kraft": paint("#B48A5C", 0.75),
    "sack": paint("#B39A72", 0.9, 0.0), "soil": paint("#2A1E15", 1.0, 0.0),
    "staff-shirt": paint(CREAM_P), "staff-red": paint("#9A3128", 0.65, 0.1), "staff-patch": paint("#F2E8D2"),
    # metal, felt, rubber
    "brass": T_BRASS, "chrome": T_NICKEL, "leaf": T_FELT, "felt": T_FELT, "tyre": T_RUBBER,
}
for ob in BUILT:
    for slot in ob.material_slots:
        if slot.material:
            base = slot.material.name.split(".")[0]
            if base in TOY:
                slot.material = TOY[base]

# softer, rounder edges: a toymaker sands every corner. Boxes without a bevel get one in
# proportion to their thinnest side; the ones that had one get it at least doubled.
for ob in BUILT:
    if ob.type != "MESH" or ob.name.startswith(("bulb", "van-tyre", "clock", "lamp-ball", "crown")):
        continue
    bev = next((md for md in ob.modifiers if md.type == "BEVEL"), None)
    thin = min(ob.dimensions) if min(ob.dimensions) > 0 else 0.0
    if thin <= 0.004:
        continue
    want = min(0.045, 0.3 * thin)
    if bev:
        bev.width = max(bev.width, min(2 * bev.width, 0.45 * thin)); bev.segments = 3
    elif len(ob.data.polygons) <= 6:
        md = ob.modifiers.new("toy", "BEVEL"); md.width = want; md.segments = 3; md.limit_method = "ANGLE"

# hang it all from one empty and shrink it
coll = bpy.data.collections.new("toy"); scene.collection.children.link(coll)
TOY_EMPTY = bpy.data.objects.new("toy", None); coll.objects.link(TOY_EMPTY)
for ob in BUILT:
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    if ob.parent is None:
        ob.parent = TOY_EMPTY
        ob.matrix_parent_inverse = Matrix.Translation(-C)
TOY_EMPTY.scale = (S, S, S)
# Lights keep their watts under a scaled parent, so the same lamp on a model 1/83 the size would
# blaze 83² times brighter. Scale them back, then let the rooms glow a little more than life,
# as a lit-up model does under a reading lamp.
INTERIOR_GAIN = float(globals().get("INTERIOR_GAIN", 1.5))
for ob in BUILT:
    if ob.type == "LIGHT":
        ob.data.energy *= S * S * INTERIOR_GAIN
        if ob.data.type in ("POINT", "SPOT"):
            ob.data.shadow_soft_size *= S
bpy.context.view_layer.update()

def w(p):
    """A full-size point in world space, wherever the toy has been put. The empty already carries
    the shrink, and its children hang from it offset by -C, so the point goes through the same."""
    return TOY_EMPTY.matrix_world @ (Vector(p) - C)

def frame():
    """The toy's frame at unit scale: where toy-local metres (VIEW, RIG, POINTS) sit in the world."""
    loc, rot, _ = TOY_EMPTY.matrix_world.decompose()
    return Matrix.Translation(loc) @ rot.to_matrix().to_4x4()

# The Study's tq camera and night rig, in toy-local metres (its scene.py, with the set's 2° yaw
# and the toy turned 180° to face the camera undone): both pages are photographed from here.
VIEW = {"eye": (-0.3802, 0.5986, 0.4828),   # 35 deg down (the Study's was 30): the rooms read with the roof off
         "look": (-0.0707, -0.0175, 0.0), "focus": (0.0, 0.0, 0.02), "lens": 50.0, "fstop": 2.8,
        "frame": (2400, 1500)}
RIG = {
    "lamp": {"at": (-0.7217, -0.5652, 1.0066), "aim": (-0.1511, 0.0152, -0.0234), "size": 0.22, "colour": (1.0, 0.70, 0.42), "spread": 55},
    # a warm card just off the street side, as a photographer bounces light into a model's shadowed face
    "bounce": {"at": (-0.12, 0.42, 0.07), "aim": (-0.02, 0.0, 0.025), "size": 0.3, "colour": (1.0, 0.84, 0.64)},
    "fill": {"at": (1.9969, -1.5107, 1.1566), "aim": (-0.1528, -0.0348, -0.1434), "size": 1.6, "colour": (0.62, 0.72, 1.0)},
    # the Study's light states: lamp and fill watts, the street lamp and the glow inside
    "night": {"lamp": 9, "fill": 6, "bounce": 0.5, "world": ("#0D0A08", 0.35), "street": 0.5, "inside": 0.25},
    "dark": {"lamp": 0, "fill": 4, "bounce": 0.12, "world": ("#08070A", 0.3), "street": 0.6, "inside": 0.3},
}
POINTS = {k: [round(v, 5) for v in local(p)] for k, p in OUTSIDE.items()}
POINTS.update({f"walk-{k}": [round(v, 5) for v in local((x, y, FLOOR))] for k, (x, y) in WALK.items() if k.startswith(("street", "door"))})
