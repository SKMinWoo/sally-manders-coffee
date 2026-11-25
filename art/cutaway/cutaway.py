"""
Sally Mander's play set, photographed for the shop's home page. toy.py builds the model; this
lights it with the portfolio Study's night rig and shoots it from the Study's own three-quarter
camera, with a longer lens and a lens shift, so the hero is optically a crop of the Study's photo:
the same eye, the same perspective, the same depth of field. The Study's zoom then hands over by
scaling one picture onto the other.

    $B -b -P run.py -- [--passes=beauty,shell,dark] [--samples=128] [--quick] [--el=DEG] [--meta-only]
    $B -b -P run.py -- --close [--keys=clock,door] [--quick]     the fixtures' refocused close-ups
    $B -b -P run.py -- --pegs [--quick]          the guests: a peg per colour, lamp on and off,
                                                 public/cutaway/peg-{colour}-{night,dark}.webp

    beauty  roof off, the reading lamp on                public/cutaway/hero-beauty.webp
    shell   the roof, sign, awning and street front only, the rest held out, so the page lays it
            on the beauty pass and lifts it away           public/cutaway/hero-shell.webp
    dark    roof off, the lamp switched off, only the rooms' own lights: "What runs it"
                                                          public/cutaway/hero-dark.webp

All three are transparent, with the model's shadow on a shadow catcher, so the model stands on
the page's own parchment. Also writes components/front/cutaway.json: the frame size, the crop box
in the Study's frame, and every anchor, walking point, seat and room projected to pixels.
--quick renders at half size into art/cutaway/out/ and leaves public/ alone; --el tries another
camera elevation (the Study must then use the same one, see toy.py's VIEW).

What stands for what (the page's key says the same):
    the front door       -> the versioned ordering API (every guest is a request)
    the till + scanner   -> the API handler; barcode checks
    the ticket rail      -> the order queue
    the espresso machine -> the worker
    the pantry           -> Postgres: labelled shelving, a shelf per kind of record
    the dining room      -> where the load test's seats ran out (a seat is a database connection)
    the back office      -> the manager's brief (desk), the Excel ledgers (cabinet),
                            the inspection certificate (CI gates), the clock (uptime probe)
    the van              -> deploys (Argo CD syncing the Helm chart)
"""
import bpy, os, sys, math, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
TOYPY = os.path.join(HERE, "toy.py")
exec(compile(open(TOYPY, encoding="utf-8").read(), TOYPY, "exec"), globals())

ARGS = dict(a[2:].split("=", 1) for a in ARGV if a.startswith("--") and "=" in a)
PASSES = ARGS.get("passes", "beauty,shell,dark").split(",")
META_ONLY = "--meta-only" in ARGV
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
PUB = os.path.join(REPO, "public", "cutaway")
LOG = open(os.path.join(OUT, "hero.log"), "w", encoding="utf-8")
def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()

# the toy sits at the origin, unturned: toy-local metres are world metres here
def V(t):
    return Vector(t)

# ── the Study's night rig ────────────────────────────────────────────────
def rig_area(name, spec, energy):
    bpy.ops.object.light_add(type="AREA", location=spec["at"])
    L = bpy.context.object; L.name = name
    L.data.shape = "RECTANGLE"; L.data.size = L.data.size_y = spec["size"]
    L.data.energy = energy; L.data.color = spec["colour"]
    L.data.spread = math.radians(spec.get("spread", 180))
    L.rotation_euler = (V(spec["aim"]) - V(spec["at"])).to_track_quat("-Z", "Y").to_euler()
    L.visible_camera = False; L.visible_glossy = False
    return L
LAMP = rig_area("reading-lamp", RIG["lamp"], 9)
FILL = rig_area("window-fill", RIG["fill"], 6)
BOUNCE = rig_area("bounce-card", RIG["bounce"], 0.5)
# The card only lifts the street front's faces. Low and in front, its own shadows ran the wrong way
# up the page, against the lamp's, so it casts none (a white card's shadow is too soft to see anyway).
BOUNCE.data.use_shadow = False
bpy.ops.object.light_add(type="POINT", location=w(STREET_AT) + Vector((0, 0, 0.006)))
STREET = bpy.context.object; STREET.data.shadow_soft_size = 0.002; STREET.data.color = (1.0, 0.75, 0.45)
STREET.visible_camera = False
world = bpy.data.worlds.new("study-room"); scene.world = world; world.use_nodes = True
BG = world.node_tree.nodes["Background"]
ROOM_LIGHTS = [ob for ob in BUILT if ob.type == "LIGHT"]
ROOM_BASE = {ob.name: ob.data.energy for ob in ROOM_LIGHTS}

def light(state):
    c = RIG[state]
    LAMP.data.energy = c["lamp"]; FILL.data.energy = c["fill"]; BOUNCE.data.energy = c["bounce"]
    BG.inputs[0].default_value = lin(c["world"][0]); BG.inputs[1].default_value = c["world"][1]
    STREET.data.energy = c["street"]
    k = c["inside"] / 0.25            # the Study's glow inside, relative to its night value
    for ob in ROOM_LIGHTS:
        ob.data.energy = ROOM_BASE[ob.name] * k

# the page under the model: a shadow catcher, so only the model's shadow comes through
bpy.ops.mesh.primitive_plane_add(size=0.8, location=(0, 0, 0.0))
CATCHER = bpy.context.object; CATCHER.name = "catcher"; CATCHER.is_shadow_catcher = True
# the atlas's paper colour, so the lamp bounces off it onto the street front as it does in the Study
CATCHER.data.materials.append(principled("page", "#EADFC6", 0.8)[0])

# ── the camera: the Study's tq, then cropped to the set ──────────────────
EYE, LOOK, FOCUS = V(VIEW["eye"]), V(VIEW["look"]), V(VIEW["focus"])
if "el" in ARGS:   # swing the eye round the look point to another elevation, same azimuth and distance
    d = EYE - LOOK; flat = Vector((d.x, d.y, 0)); e = math.radians(float(ARGS["el"]))
    EYE = LOOK + (flat.normalized() * math.cos(e) + Vector((0, 0, math.sin(e)))) * d.length
EL = math.degrees(math.atan2((EYE - LOOK).z, Vector(((EYE - LOOK).x, (EYE - LOOK).y)).length))
FW, FH = VIEW["frame"]
cd = bpy.data.cameras.new("tq"); cd.sensor_width = 36; cd.sensor_fit = "HORIZONTAL"; cd.clip_start = 0.01
cam = bpy.data.objects.new("tq", cd); scene.collection.objects.link(cam); scene.camera = cam
cam.location = EYE
cam.rotation_euler = (LOOK - EYE).to_track_quat("-Z", "Y").to_euler()
cd.lens = VIEW["lens"]
r = scene.render
r.resolution_x, r.resolution_y = FW, FH
bpy.context.view_layer.update()

# what the crop must hold: the model, and the ground round it where its shadow falls
pts = []
for ob in BUILT:
    if ob.type in ("MESH", "FONT") and alive(ob) and ob.visible_get():
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), 0)); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), 0))
M = 0.008
ground = [Vector((x, y, 0)) for x in (lo.x - M, hi.x + M) for y in (lo.y - M, hi.y + M)]
# and where the lamp throws each high corner's shadow on the page
lamp_at = V(RIG["lamp"]["at"])
for p in list(pts):
    if p.z > 0.002:
        t = lamp_at.z / (lamp_at.z - p.z)
        ground.append(lamp_at + (p - lamp_at) * t)
pts += ground
def uv_box(points):
    uv = [world_to_camera_view(scene, cam, p) for p in points]
    return min(p.x for p in uv), 1 - max(p.y for p in uv), max(p.x for p in uv), 1 - min(p.y for p in uv)
u0, v0, u1, v1 = uv_box(pts)
PAD = 0.02
u0, u1 = u0 - PAD * (u1 - u0), u1 + PAD * (u1 - u0)
v0, v1 = v0 - PAD * (v1 - v0), v1 + PAD * (v1 - v0)
BOX = [round(u0, 5), round(v0, 5), round(u1, 5), round(v1, 5)]   # 0..1 of the Study's frame, y down
log("el", round(EL, 2), "box", BOX)

# The crop: a lens (u1-u0) times longer shows exactly that slice of the frame's width; the shift
# moves the slice off-axis without turning the camera, so nothing in the picture changes but its edges.
# 3600 wide: the page shows the model up to ~1400 CSS px, so this stays sharp at 2x density
W_ = 1200 if QUICK else int(ARGS.get("width", 3600))
H_ = round(W_ * ((v1 - v0) * FH) / ((u1 - u0) * FW))
r.resolution_x, r.resolution_y = W_, H_
cd.lens = VIEW["lens"] / (u1 - u0)
big = max(W_, H_)
for _ in range(6):   # a unit of shift is the frame's larger side: walk the crop's centre onto the axis
    bpy.context.view_layer.update()
    a0, b0, a1, b1 = uv_box(pts)
    du, dv = (a0 + a1) / 2 - 0.5, (b0 + b1) / 2 - 0.5     # the model's centre, off the frame's
    cd.shift_x += du * W_ / big
    cd.shift_y -= dv * H_ / big
bpy.context.view_layer.update()
chk = uv_box(pts)
log("crop check (should sit just inside 0..1)", [round(x, 4) for x in chk])
# The depth of field. The Study's aperture diameter (the same blur as its photo) is a shallow cut
# for a hero the set fills: the counter went soft along with the back wall. --fstop-scale stops it
# down (5: the set reads sharp, only the far wall and the kerb soften a touch) and the focus moves
# onto the set's middle, square to the lens. hero-closed.webp keeps the Study's blur, so arriving
# from the Study plays as a focus pull as the roof lifts. 1 restores the Study's own aperture.
FSTOP_SCALE = float(ARGS.get("fstop-scale", 5))
cd.dof.use_dof = True
_fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
_mid = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0.25 * max(p.z for p in pts)))
cd.dof.focus_distance = (_mid - cam.location).dot(_fwd) if FSTOP_SCALE > 1 else (FOCUS - EYE).length
cd.dof.aperture_fstop = VIEW["fstop"] * cd.lens / VIEW["lens"] * FSTOP_SCALE
log("lens", round(cd.lens, 2), "fstop", round(cd.dof.aperture_fstop, 2), "frame", W_, H_)

# ── render settings ──────────────────────────────────────────────────────
r.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind; prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"; log("device", kind); break
    except TypeError:
        continue
scene.cycles.samples = int(ARGS.get("samples", 32 if QUICK else 256))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
r.film_transparent = True
# 95: next/image re-encodes it for each width, so this is the master, not what the browser gets
r.image_settings.file_format = "WEBP"; r.image_settings.color_mode = "RGBA"; r.image_settings.quality = 95
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0

# ── full-size space: the metres ANCH, WALK and the obstacles are written in ──
INV = TOY_EMPTY.matrix_world.inverted()
def full(q):
    return INV @ q + C
def fbox(ob):
    cs = [full(ob.matrix_world @ Vector(c)) for c in ob.bound_box]
    return Vector([min(v[i] for v in cs) for i in range(3)]), Vector([max(v[i] for v in cs) for i in range(3)])
# The baristas leave the baked passes: the page stands them as sprites and walks them between stations.
STAFF_OBS = [ob for ob in BUILT if ob.name.startswith("staff-")]
def solid(ob):
    if not alive(ob) or ob.type not in ("MESH", "FONT"):
        return False
    nm = ob.name.split(".")[0]
    return nm not in DOORWAY_PARTS and not nm.startswith(("staff-", "bulb"))   # the café's door stands open

# ── where a guest may walk: every solid thing a peg's body would touch, as a floor rectangle ──
PEG_R = 0.2                                   # a peg's radius, full size
BAND = (FLOOR + 0.03, FLOOR + 1.4)            # from its ankles to the top of its head
OBST = []
for ob in BUILT:
    if solid(ob):
        lo_, hi_ = fbox(ob)
        if hi_.z > BAND[0] and lo_.z < BAND[1]:
            OBST.append((lo_.x, hi_.x, lo_.y, hi_.y, ob.name))
OBST.sort(key=lambda o: -(o[1] - o[0]) * (o[3] - o[2]))
_kept = []
for o in OBST:   # the pantry's boxes sit inside its shelving, the cups inside the counter: keep the outlines
    if not any(k[0] <= o[0] and o[1] <= k[1] and k[2] <= o[2] and o[3] <= k[3] for k in _kept):
        _kept.append(o)
OBST = _kept
def rect_gap(x, y, o):
    return math.hypot(max(o[0] - x, 0.0, x - o[1]), max(o[2] - y, 0.0, y - o[3]))
def blocked(a, b, spots, ignore=()):
    (ax, ay), (bx, by) = spots[a], spots[b]
    n = max(2, int(math.hypot(bx - ax, by - ay) / 0.04) + 1)
    for i in range(n + 1):
        x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
        hit = sorted({o[4].split(".")[0] for o in OBST if o[4].split(".")[0] not in ignore and rect_gap(x, y, o) < PEG_R})
        if hit:
            return f"{a} -> {b} at ({x:.2f}, {y:.2f}) touches {', '.join(hit)}"
    return None
_bad = [m for m in (blocked(a, b, WALK) for a, b in EDGES) if m]
_bad += [m for m in (blocked(a, b, STATIONS) for a in STATIONS for b in STATIONS if a < b) if m]
# where guests stand still (the till, the pass, the wait spots) must be a peg's width apart, or two of
# them stand inside each other while one waits and the other collects a cup
_STAND = [k for k in WALK if k in ("till", "pass") or k.startswith("wait-")]
_bad += [f"{a} and {b} stand {math.dist(WALK[a], WALK[b]):.2f} m apart, under a peg's width"
         for i, a in enumerate(_STAND) for b in _STAND[i + 1:] if math.dist(WALK[a], WALK[b]) < 2 * PEG_R + 0.05]
# the ledge's places are walked to and stood at, so the step along the ledge is checked like an edge,
# and they too must stand a peg's width apart
_LEDGE = {f"ledge-{i}": ch["at"][:2] for i, ch in enumerate(CHAIRS) if ch["kind"] == "ledge"}
_bad += [m for m in (blocked("din-ledge", k, {**WALK, **_LEDGE}) for k in _LEDGE) if m]
_bad += [f"{a} and {b} stand {math.dist(_LEDGE[a], _LEDGE[b]):.2f} m apart, under a peg's width"
         for i, a in enumerate(_LEDGE) for b in list(_LEDGE)[i + 1:] if math.dist(_LEDGE[a], _LEDGE[b]) < 2 * PEG_R + 0.05]
log("obstacles", len(OBST), "edges", len(EDGES))
for m in _bad:
    log("BLOCKED", m)
if _bad:
    raise RuntimeError("the walking graph runs through something solid:\n" + "\n".join(_bad))

# ── the guests: the Study's peg people, as this camera sees them ─────────
# Each order walks the model as a peg: a painted body and a maple head, the same figure the Study's
# guests are. Rendered one at a time on a shadow catcher, standing in the café where the camera
# sees them, looking down the same line of sight, so the page stands a sprite on any walking spot and
# scales it to that spot's 1.6 m. Built at full size and shrunk like the rest of the toy, so the
# paint's bump and the maple's grain come out at the toy's scale. Hidden from every other pass.
import bmesh
PEG_COLOURS = {"mustard": "#C8952F", "navy": "#26324A", "oxblood": "#6B2624", "teal": "#2C6B67"}
PEG_AT = WALK["wait-4"]
PEG_FOOT = w((PEG_AT[0], PEG_AT[1], FLOOR))
PEG_S = (w((PEG_AT[0], PEG_AT[1], FLOOR + 1.6)) - PEG_FOOT).length / 1.6   # world metres per full-size metre
def peg_part(name, mesh_of, z, mat, bevel=0.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); mesh_of(bm); bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = len(f.vertices) == 4 or name.endswith("head")
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    ob.location = PEG_FOOT + Vector((0, 0, z * PEG_S)); ob.scale = (PEG_S,) * 3
    if bevel:
        mod = ob.modifiers.new("b", "BEVEL"); mod.width = bevel; mod.segments = 3; mod.limit_method = "ANGLE"
    me.materials.append(mat); ob.hide_render = True
    return ob
# the Study's peg (scene.py's peg()), slimmed to stand in the queue's 0.42 m spacing: a body 1 m
# tall, and the head resting on it (sunk a little, as the Study's is), its top at 1.4 m
PEG_BODY = {c: peg_part(f"peg-{c}-body", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.2, radius2=0.2, depth=1.0),
                        0.5, paint(hexc), bevel=0.07) for c, hexc in PEG_COLOURS.items()}
PEG_HEAD = peg_part("peg-head", lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=0.21), 1.19, T_MAPLE)
PEG_TOP = PEG_FOOT + Vector((0, 0, 1.6 * PEG_S))
# an orthographic camera down the hero camera's own line of sight to that spot
PEG_PX = 384
pcd = bpy.data.cameras.new("peg"); pcd.type = "ORTHO"; pcd.ortho_scale = 2.3 * 1.6 * PEG_S
pcam = bpy.data.objects.new("peg", pcd); scene.collection.objects.link(pcam)
_mid = PEG_FOOT + Vector((0, 0, 0.45 * 1.6 * PEG_S))
pcam.rotation_euler = (_mid - cam.location).to_track_quat("-Z", "Y").to_euler()
pcam.location = _mid - (_mid - cam.location).normalized() * 0.3
bpy.context.view_layer.update()
def peg_px(p):
    q = pcam.matrix_world.inverted() @ p
    return [round((q.x / pcd.ortho_scale + 0.5) * PEG_PX, 1), round((0.5 - q.y / pcd.ortho_scale) * PEG_PX, 1)]
PEG_META = {"size": [PEG_PX, PEG_PX], "foot": peg_px(PEG_FOOT), "top": peg_px(PEG_TOP), "colours": list(PEG_COLOURS)}

# Seated: the peg dropped into the brass socket in a chair's seat (toy.py's chair()), its foot point
# on the seat. The socket's near lip is shot with it, so it stays in front of the body when the page
# lays the sprite over the chair. Same camera and foot, so the page scales it by the same 1.6 m mark.
SEAT_BODY = 0.62
PEG_SEATED = {c: peg_part(f"peg-{c}-seated", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.2, radius2=0.2, depth=SEAT_BODY),
                          SEAT_BODY / 2, paint(hexc), bevel=0.07) for c, hexc in PEG_COLOURS.items()}
PEG_SEATED_HEAD = peg_part("peg-seated-head", lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=0.21), SEAT_BODY + 0.19, T_MAPLE)
PEG_SOCKET = peg_part("peg-socket", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.235, radius2=0.235, depth=0.035), 0.0175, T_BRASS)
# The cups, turned toy forms in the set's paint and no saucer, half again a real cup so they read at a
# peg's few dozen pixels: a cream tumbler with a red band, a kraft cup with a teal lid, a squat mustard
# mug with a maple dowel for a handle. Each guest gets one of the three (footfall.ts's cupKindOf). Held,
# it rides on the peg's camera side at the waist (pegs have no arms, like the Study's); alone, it
# stands where it is put down: on the pass, on a table, on the window ledge.
_to_cam = cam.location - PEG_FOOT; _to_cam.z = 0; _to_cam.normalize()
_side = _to_cam.cross(Vector((0, 0, 1))).normalized()
COFFEE = paint("#3B2418", 0.3, 0.6)
CUP_KINDS = ("tumbler", "kraft", "mug")
def _disc(r0, r1, d):
    return lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=r0, radius2=r1, depth=d)
def toy_cup(name, kind, off, z):
    """One cup, off (full-size metres, in the camera's frame) from the peg's axis and z up from its foot."""
    at = PEG_FOOT + (_to_cam * off[0] + _side * off[1]) * PEG_S
    if kind == "tumbler":
        parts = [peg_part(f"{name}-body", _disc(0.065, 0.065, 0.17), z + 0.085, TOY["stoneware"], bevel=0.008),
                 peg_part(f"{name}-band", _disc(0.067, 0.067, 0.035), z + 0.1075, TOY["label-red"]),
                 peg_part(f"{name}-coffee", _disc(0.056, 0.056, 0.004), z + 0.168, COFFEE)]
    elif kind == "kraft":
        parts = [peg_part(f"{name}-body", _disc(0.052, 0.07, 0.19), z + 0.095, TOY["kraft"]),
                 peg_part(f"{name}-lid", _disc(0.075, 0.075, 0.025), z + 0.2025, TOY["teal"], bevel=0.008),
                 peg_part(f"{name}-sip", _disc(0.05, 0.05, 0.02), z + 0.225, TOY["teal"], bevel=0.006)]
    else:
        parts = [peg_part(f"{name}-body", _disc(0.08, 0.08, 0.11), z + 0.055, TOY["mustard"], bevel=0.012),
                 peg_part(f"{name}-coffee", _disc(0.068, 0.068, 0.004), z + 0.108, COFFEE)]
        # the dowel handle, out to the camera's side so it shows in profile
        a = Vector((0, 0, (z + 0.06) * PEG_S)) + _side * 0.07 * PEG_S
        b = Vector((0, 0, (z + 0.06) * PEG_S)) + (_side * 0.16 + _to_cam * 0.03) * PEG_S
        dw = rod(f"{name}-dowel", 0.017 * PEG_S, PEG_FOOT + a, PEG_FOOT + b, T_MAPLE)
        dw.hide_render = True
        parts.append(dw)
    for ob in parts:
        ob.location += Vector((at.x - PEG_FOOT.x, at.y - PEG_FOOT.y, 0))
    return parts
HELD_CUP = {k: toy_cup(f"held-{k}", k, (0.27, 0.08), 0.62) for k in CUP_KINDS}
LONE_CUP = {k: toy_cup(f"lone-{k}", k, (0.0, 0.0), 0.0) for k in CUP_KINDS}
# a barista: toy.py's first staff figure, walked over to the sprites' spot
def _near_first_staff(ob):
    lo_, hi_ = fbox(ob)
    return math.hypot((lo_.x + hi_.x) / 2 - STAFF[0][0], (lo_.y + hi_.y) / 2 - STAFF[0][1]) < 0.45
BARISTA = [ob for ob in STAFF_OBS if _near_first_staff(ob)]

PEG_ROOM_GAIN = float(ARGS.get("room", 0.15))
def render_pegs():
    for ob in BUILT:
        if alive(ob) and ob.type in ("MESH", "FONT"):
            ob.hide_render = True
    CATCHER.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=1.6 * PEG_S * 3, location=PEG_FOOT)
    floor = bpy.context.object; floor.name = "peg-catcher"; floor.is_shadow_catcher = True
    floor.data.materials.append(principled("peg-floor", "#E9DDC2", 0.6)[0])
    scene.camera = pcam
    r.resolution_x = r.resolution_y = PEG_PX; r.resolution_percentage = 100
    r.image_settings.quality = 90
    out = OUT if QUICK else PUB
    dx, dy = PEG_AT[0] - STAFF[0][0], PEG_AT[1] - STAFF[0][1]
    for ob in BARISTA:
        ob.location += Vector((dx, dy, 0))
    def shoot(name, obs, shadow=True):
        for ob in obs:
            ob.hide_render = False
        floor.hide_render = not shadow
        r.filepath = os.path.join(out, name + ".webp")
        if not META_ONLY:
            bpy.ops.render.render(write_still=True)
        log("wrote", r.filepath)
        for ob in obs:
            ob.hide_render = True
    for state in ("night", "dark"):
        light(state)
        # with the ceiling and the shades hidden, the rooms' pendants would light the peg bare; in the
        # set they're shaded and mostly light the tables, so they get a fraction of their power here
        for ob in ROOM_LIGHTS:
            ob.data.energy *= PEG_ROOM_GAIN
        # A sprite's shadow is baked where it was shot, so it points the same way wherever the page
        # stands it. Under the reading lamp that's true of the whole set (the lamp is high and far,
        # so its shadows run parallel), but with the lamp off the nearest light is the street lamp,
        # and its long shadow would climb the counter and the walls. Lamp off, the sprites go out
        # bare and the page puts a soft contact shadow under each instead.
        cast = state == "night"
        for c in PEG_COLOURS:
            shoot(f"peg-{c}-{state}", [PEG_BODY[c], PEG_HEAD], shadow=cast)
            for k in CUP_KINDS:
                shoot(f"peg-{c}-cup-{k}-{state}", [PEG_BODY[c], PEG_HEAD] + HELD_CUP[k], shadow=cast)
            # on a chair the seat takes its shadow; on the sprite's own floor it would spill past the seat
            shoot(f"peg-{c}-seated-{state}", [PEG_SEATED[c], PEG_SEATED_HEAD, PEG_SOCKET], shadow=False)
        shoot(f"barista-{state}", BARISTA, shadow=cast)
        for k in CUP_KINDS:
            shoot(f"cup-{k}-{state}", LONE_CUP[k], shadow=cast)

# ── the meta: everything the page pins, in the hero's pixels ─────────────
def px(p):
    v = world_to_camera_view(scene, cam, w(p))
    return [round(v.x * W_, 1), round((1 - v.y) * H_, 1)]
def hull(points):
    """Andrew's monotone chain: the outline of a room's box in pixels."""
    P = sorted(map(tuple, points))
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(P):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return [list(p) for p in lower[:-1] + upper[:-1]]
# The page glides in on a picked fixture until this rectangle fills the frame: 1/CLOSE_Z of it, centred
# on the pin and kept inside the picture. The --close pass renders exactly this rectangle, so its
# close-up lands on the zoomed hero pixel for pixel.
CLOSE_Z = 2.2
def close_rect(k):
    ax, ay = px(ANCH[k])
    cw, ch = W_ / CLOSE_Z, H_ / CLOSE_Z
    x0 = min(max(ax - cw / 2, 0), W_ - cw); y0 = min(max(ay - ch / 2, 0), H_ - ch)
    return [round(x0), round(y0), round(x0 + cw), round(y0 + ch)]
meta = {
    "size": [W_, H_],
    "close": {k: close_rect(k) for k in ANCH},
    "box": BOX,
    "view": {"el": round(EL, 2), "lens": round(cd.lens, 2)},
    "anchors": {k: px(v) for k, v in ANCH.items()},
    "walk": {k: px((x, y, FLOOR)) + px((x, y, FLOOR + 1.6)) for k, (x, y) in WALK.items()},
    "seats": [px(s) + px((s[0], s[1], s[2] + 1.6)) for s in SEATS],
    # the peg sprites (--pegs): their size, and where the feet and the 1.6 m mark fall in them
    "peg": PEG_META,
    "zones": {k: hull([px((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (FLOOR, FLOOR + h)])
              for k, (x0, x1, y0, y1, h) in ZONES.items()},
}

# ── the world behind the pixels: the page walks guests in metres and projects them itself ──
import numpy as np
def px_raw(p):
    v = world_to_camera_view(scene, cam, w(p))
    return v.x * W_, (1 - v.y) * H_
def fit_projection():
    """The camera as a 3x4 matrix from full-size metres to the hero's pixels (a pinhole with a lens
    shift is exactly projective, so a direct linear fit to a grid of points recovers it)."""
    rows, pts = [], []
    for x in (XW - 0.5, -1.0, 3.0, ALLEY_E + 0.4):
        for y in (YS, -1.5, 0.5, PY1):
            for z in (FLOOR, FLOOR + 1.6, CEIL):
                u, v = px_raw((x, y, z)); u /= W_; v /= H_
                rows += [[x, y, z, 1, 0, 0, 0, 0, -u * x, -u * y, -u * z, -u],
                         [0, 0, 0, 0, x, y, z, 1, -v * x, -v * y, -v * z, -v]]
                pts.append((x, y, z))
    M = np.linalg.svd(np.array(rows))[2][-1].reshape(3, 4)
    M[0] *= W_; M[1] *= H_
    centre = np.array([0.0, -1.5, FLOOR, 1.0])
    M /= M[2] @ centre                       # w = 1 at the middle of the floor, positive in front
    err = 0.0
    for p in pts + [tuple(ANCH[k]) for k in ANCH if len(ANCH[k]) == 3]:
        h = M @ np.array([*p, 1.0]); u, v = px_raw(p)
        err = max(err, abs(h[0] / h[2] - u), abs(h[1] / h[2] - v))
    log("projection fit, worst error px", round(err, 4))
    if err > 0.5:
        raise RuntimeError(f"projection fit is off by {err:.2f} px")
    return [[float(f"{c:.8g}") for c in row] for row in M]

# ── occluders: what a guest can pass behind ──────────────────────────────
# The guests are drawn over the render, so anything standing between a guest and the camera has to
# be drawn again over the guest. Each such object (or small group) is cut out of the finished frame by
# its Cryptomatte matte: its own pixels, lit and blurred exactly as in the frame, so laid back over the
# frame it is invisible, and laid over a guest it hides what it should. The page decides per guest
# which ones stand in front, from the floor rectangles below and the camera's position.
def group_of(ob):
    if not solid(ob) or ob in SHELL_OBS:
        return None
    nm = ob.name.split(".")[0]
    lo_, hi_ = fbox(ob)
    cx, cy, cz = (lo_.x + hi_.x) / 2, (lo_.y + hi_.y) / 2, (lo_.z + hi_.z) / 2
    if nm.startswith("van-"): return "van"
    if nm in ("trunk", "crown") and cx > ALLEY_E - 0.5: return "tree"
    if nm in ("lamp-post", "lamp-post-foot", "lamp-ball"): return "lamppost"
    if nm.startswith("a-frame"): return "a-frame"
    if nm.startswith("front-low"): return "front-low"
    if nm in ("partition", "partition-cap"): return "partition-" + ("s" if cy < -1.45 else "n")
    if nm in ("office-w", "office-w-cap"): return "office-w-" + ("s" if cy < -0.5 else "n")
    if nm in ("office-e", "office-e-cap"): return "office-e"
    if nm in ("ledge", "ledge-bracket"): return "ledge"
    if nm.startswith("table-") and cx > DX0:
        return "table-%d" % min(range(len(TABLES)), key=lambda k: math.hypot(TABLES[k][0] - cx, TABLES[k][1] - cy))
    if nm in ("chair-seat", "chair-socket", "chair-leg", "chair-back") and cx > DX0:
        k = min((k for k in range(len(CHAIRS)) if CHAIRS[k]["kind"] == "chair"),
                key=lambda k: math.hypot(CHAIRS[k]["at"][0] - cx, CHAIRS[k]["at"][1] - cy))
        return f"chair-{k}-{'back' if nm == 'chair-back' else 'seat'}"
    if -CX - 0.3 <= cx <= CX + 0.3 and CY0 - 0.08 <= cy <= CY1 + 0.2: return "counter"   # with its pendants
    if -1.8 <= cx <= 2.6 and FRONT - 0.7 <= cy <= GLASS + 0.01 and cz < 0.6: return "window-bar"
    return None
OCC = {}
for ob in BUILT:
    g = group_of(ob)
    if g:
        OCC.setdefault(g, []).append(ob)
def footprint(obs):
    rs = []
    for ob in obs:
        lo_, hi_ = fbox(ob)
        rs.append([round(lo_.x, 3), round(hi_.x, 3), round(lo_.y, 3), round(hi_.y, 3)])
    rs.sort(key=lambda o: -(o[1] - o[0]) * (o[3] - o[2]))
    keep = []
    for o in rs:
        if not any(k[0] <= o[0] and o[1] <= k[1] and k[2] <= o[2] and o[3] <= k[3] for k in keep):
            keep.append(o)
    return keep
log("occluders", {g: len(v) for g, v in OCC.items()})

def mm3(data, seed=0):
    """MurmurHash3 x86 32-bit, as Blender hashes an object's name for its Cryptomatte id."""
    c1, c2, h, n = 0xcc9e2d51, 0x1b873593, seed, len(data)
    rotl = lambda x, k: ((x << k) | (x >> (32 - k))) & 0xFFFFFFFF
    for i in range(0, n - n % 4, 4):
        k = int.from_bytes(data[i:i + 4], "little")
        k = rotl((k * c1) & 0xFFFFFFFF, 15) * c2 & 0xFFFFFFFF
        h = (rotl(h ^ k, 13) * 5 + 0xe6546b64) & 0xFFFFFFFF
    tail, k = data[n - n % 4:], 0
    for i, b in enumerate(tail):
        k |= b << (8 * i)
    if tail:
        k = rotl((k * c1) & 0xFFFFFFFF, 15) * c2 & 0xFFFFFFFF
        h ^= k
    h ^= n
    h ^= h >> 16; h = (h * 0x85ebca6b) & 0xFFFFFFFF
    h ^= h >> 13; h = (h * 0xc2b2ae35) & 0xFFFFFFFF
    return h ^ (h >> 16)
def crypto_id(name):
    """The id's bits as Cryptomatte stores them: a float, nudged off the inf/NaN and denormal exponents."""
    h = mm3(name.encode("utf-8"))
    if (h >> 23) & 255 in (0, 255):
        h ^= 1 << 23
    return h

def save_exr(path):
    """The render result with every pass, as a 32-bit multilayer EXR (Cryptomatte ids are float bits,
    so half floats would scramble them)."""
    s = r.image_settings
    quality = s.quality
    if hasattr(s, "media_type"):
        s.media_type = "MULTI_LAYER_IMAGE"
    s.file_format = "OPEN_EXR_MULTILAYER"
    s.color_depth = "32"; s.exr_codec = "ZIP"
    bpy.data.images["Render Result"].save_render(filepath=path, scene=scene)
    if hasattr(s, "media_type"):
        s.media_type = "IMAGE"
    s.file_format = "WEBP"; s.color_mode = "RGBA"; s.quality = quality
    log("wrote", path)

def mattes(exr):
    """Each occluder's coverage, 0..1 per pixel, from the EXR's Cryptomatte object layers."""
    import OpenImageIO as oiio
    # Blender writes each pass as its own EXR part, so the Cryptomatte levels are separate subimages;
    # the header's manifest maps every object name to its id, which beats re-deriving the hash.
    inp = oiio.ImageInput.open(exr)
    chans, manifest, sub = {}, {}, 0
    while inp.seek_subimage(sub, 0):
        spec = inp.spec(); names = list(spec.channelnames)
        for a in spec.extra_attribs:
            if a.name.startswith("cryptomatte/") and a.name.endswith("/manifest") and "CryptoObject" in str(spec.getattribute(a.name.replace("manifest", "name")) or ""):
                manifest = json.loads(a.value)
        for i, n in enumerate(names):
            if "CryptoObject" in n:
                base, ch = n.rsplit(".", 1)
                ch = {"X": "R", "Y": "G", "Z": "B", "W": "A"}.get(ch.upper(), ch.upper())
                chans[f"{base}.{ch}"] = inp.read_image(sub, 0, i, i + 1, "float").reshape(spec.height, spec.width)
        sub += 1
    inp.close()
    H0, W0 = next(iter(chans.values())).shape
    levels = sorted({n.rsplit(".", 1)[0] for n in chans})
    log("cryptomatte", len(manifest), "names,", levels, sorted(chans))
    out = {}
    for g, obs in OCC.items():
        ids = np.array([int(manifest[ob.name], 16) if ob.name in manifest else crypto_id(ob.name) for ob in obs], dtype=np.uint32)
        m = np.zeros((H0, W0), np.float32)
        for lv in levels:
            for idc, covc in (("R", "G"), ("B", "A")):
                hit = np.isin(chans[f"{lv}.{idc}"].view(np.uint32), ids)
                m += np.where(hit, chans[f"{lv}.{covc}"], 0.0)
        out[g] = np.clip(m, 0.0, 1.0)
    return out

def cut(lights):
    """Cut every occluder out of each light's frame and pack them into one atlas per light. The boxes
    are shared, so one set of numbers serves both atlases."""
    import OpenImageIO as oiio
    frames, ms = {}, {}
    for lt, (webp, exr) in lights.items():
        cfg = oiio.ImageSpec(); cfg.attribute("oiio:UnassociatedAlpha", 1)
        inp = oiio.ImageInput.open(webp, cfg)
        frames[lt] = inp.read_image(0, 0, 0, 4, "uint8"); inp.close()
        ms[lt] = mattes(exr)
    H, Wd = next(iter(frames.values())).shape[:2]
    boxes = {}
    for g in OCC:
        on = np.zeros((H, Wd), bool)
        for lt in lights:
            on |= ms[lt][g] > 0.01
        ys, xs = np.nonzero(on)
        if len(xs) == 0:
            log("occluder not in frame", g); continue
        x0, y0 = max(int(xs.min()) - 2, 0), max(int(ys.min()) - 2, 0)
        x1, y1 = min(int(xs.max()) + 3, Wd), min(int(ys.max()) + 3, H)
        boxes[g] = [x0, y0, x1 - x0, y1 - y0]
    # shelf-pack, tallest first
    AW = max(2048, max(b[2] for b in boxes.values()) + 4)
    at, x, y, row = {}, 0, 0, 0
    for g in sorted(boxes, key=lambda g: -boxes[g][3]):
        bw, bh = boxes[g][2], boxes[g][3]
        if x + bw > AW:
            x, y, row = 0, y + row + 2, 0
        at[g] = [x, y]; x += bw + 2; row = max(row, bh)
    AH = y + row
    out_dir = OUT if QUICK else PUB
    for lt in lights:
        atlas = np.zeros((AH, AW, 4), np.uint8)
        fr = frames[lt]
        for g, (x0, y0, bw, bh) in boxes.items():
            ax, ay = at[g]
            crop = fr[y0:y0 + bh, x0:x0 + bw].copy()
            a = np.minimum(ms[lt][g][y0:y0 + bh, x0:x0 + bw] * 255.0 + 0.5, crop[..., 3].astype(np.float32))
            crop[..., 3] = a.astype(np.uint8)
            atlas[ay:ay + bh, ax:ax + bw] = crop
        path = os.path.join(out_dir, f"occ-{lt}.webp")
        spec = oiio.ImageSpec(AW, AH, 4, "uint8")
        spec.attribute("oiio:UnassociatedAlpha", 1); spec.attribute("compression", "webp:95")
        o = oiio.ImageOutput.create(path); o.open(path, spec); o.write_image(atlas); o.close()
        log("wrote", path, AW, AH)
    items = [{"id": g, "frame": boxes[g], "at": at[g], "floor": footprint(OCC[g])} for g in sorted(boxes)]
    json.dump({"atlas": [AW, AH], "items": items}, open(OCC_JSON, "w"), indent=1)

OCC_JSON = os.path.join(OUT, "occ-quick.json" if QUICK else "occ.json")
meta["world"] = {
    "floor": FLOOR,
    "proj": fit_projection(),
    "camera": [round(v, 3) for v in full(cam.location)],
    "pegRadius": PEG_R,
    "walk": {k: [round(x, 3), round(y, 3)] for k, (x, y) in WALK.items()},
    "edges": [list(e) for e in EDGES],
    "chairs": [{"at": [round(v, 3) for v in ch["at"]], "facing": ch["facing"], "from": ch["from"], "kind": ch["kind"],
                "cup": [round(v, 3) for v in ch["cup"]]} for ch in CHAIRS],
    "stations": {k: [round(x, 3), round(y, 3)] for k, (x, y) in STATIONS.items()},
    "cup": [round(v, 3) for v in CUP_AT],
    "steam": [round(v, 3) for v in STEAM_AT],
    "obstacles": [[round(o[0], 3), round(o[1], 3), round(o[2], 3), round(o[3], 3)] for o in OBST],
}
def write_meta():
    if os.path.exists(OCC_JSON):
        meta["occluders"] = json.load(open(OCC_JSON))
    json.dump(meta, open(os.path.join(OUT, "hero.json"), "w"), indent=1)
    if not QUICK and "el" not in ARGS:
        json.dump(meta, open(os.path.join(REPO, "components", "front", "cutaway.json"), "w"), indent=1)

# ── the passes ───────────────────────────────────────────────────────────
def render(name):
    tag = f"-el{ARGS['el']}" if "el" in ARGS else ""
    if QUICK or "el" in ARGS:
        r.filepath = os.path.join(OUT, f"hero-{name}{tag}.webp")
    else:
        os.makedirs(PUB, exist_ok=True); r.filepath = os.path.join(PUB, f"hero-{name}.webp")
    if not META_ONLY:
        bpy.ops.render.render(write_still=True)
    log("wrote", r.filepath)

def show(pass_):
    shell = pass_ == "shell"
    for ob in BUILT:
        if not alive(ob) or ob.type not in ("MESH", "FONT"):
            continue
        ob.hide_render = (not shell and ob in SHELL_OBS) or ob in STAFF_OBS
        ob.is_holdout = shell and ob not in SHELL_OBS   # in front of the shell it still hides it
    # with the lamp off, the walls would "shadow" the whole page from the rooms' own lights
    CATCHER.hide_render = pass_ in ("shell", "dark")
# ── close-ups (--close): each fixture's rectangle, at twice the density, focused on the fixture ──
# The hero's tilt-shift keeps the middle of the set sharp and lets the back wall and the street go
# soft; zooming the hero into the clock would only enlarge the blur. Each close-up is the same
# camera and aperture with the focus moved onto its fixture, so the page's glide ends in the lens
# refocusing. The guests' view tags three fixtures under the lamp; "What runs it" pins them all.
FRONT_KEYS = ("door", "boards", "till")
def render_close(k, pass_):
    x0, y0, x1, y1 = meta["close"][k]
    r.use_border = True; r.use_crop_to_border = True
    r.border_min_x, r.border_max_x = x0 / W_, x1 / W_
    r.border_min_y, r.border_max_y = 1 - y1 / H_, 1 - y0 / H_   # Blender counts up from the bottom
    r.resolution_percentage = 200
    fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    cd.dof.focus_distance = (w(ANCH[k]) - cam.location).dot(fwd)   # the focal plane is square to the lens
    out = os.path.join(OUT if QUICK else PUB, "close"); os.makedirs(out, exist_ok=True)
    r.filepath = os.path.join(out, f"{k}-{pass_}.webp")
    if not META_ONLY:
        bpy.ops.render.render(write_still=True)
    log("wrote", r.filepath, "focus", round(cd.dof.focus_distance, 4))

if "--pegs" in ARGV:
    render_pegs()
    write_meta()
elif "--close" in ARGV:
    r.image_settings.quality = 82
    keys = ARGS["keys"].split(",") if "keys" in ARGS else list(ANCH)
    for p in ("beauty", "dark"):
        show(p)
        light("dark" if p == "dark" else "night")
        for k in keys:
            if p == "dark" or k in FRONT_KEYS:
                render_close(k, p)
else:
    # beauty and dark also keep a Cryptomatte EXR, which the occluders are cut by
    CUTS = {"beauty": "night", "dark": "dark"}
    def frame_of(p):
        return os.path.join(OUT, f"hero-{p}.webp") if QUICK else os.path.join(PUB, f"hero-{p}.webp")
    def exr_of(p):
        return os.path.join(OUT, f"crypto-{p}{'-quick' if QUICK else ''}.exr")
    CUT_ONLY = "--cut-only" in ARGV
    if not CUT_ONLY:
        for p in PASSES:
            show(p)
            light("dark" if p == "dark" else "night")
            bpy.context.view_layer.use_pass_cryptomatte_object = p in CUTS
            bpy.context.view_layer.pass_cryptomatte_depth = 4
            render(p)
            if p in CUTS and not META_ONLY:
                save_exr(exr_of(p))
    if not META_ONLY and "el" not in ARGS:
        have = {CUTS[p]: (frame_of(p), exr_of(p)) for p in CUTS if os.path.exists(exr_of(p)) and os.path.exists(frame_of(p))}
        if len(have) == len(CUTS):
            cut(have)
        else:
            log("occluders not cut: need both", list(CUTS), "have", list(have))
    write_meta()
log("done")
