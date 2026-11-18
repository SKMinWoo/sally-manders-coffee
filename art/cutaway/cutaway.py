"""
Sally Mander's play set, photographed for the shop's home page. toy.py builds the model; this
lights it with the portfolio Study's night rig and shoots it from the Study's own three-quarter
camera, with a longer lens and a lens shift, so the hero is optically a crop of the Study's photo:
the same eye, the same perspective, the same depth of field. The Study's zoom then hands over by
scaling one picture onto the other.

    $B -b -P run.py -- [--passes=beauty,shell,dark] [--samples=128] [--quick] [--el=DEG] [--meta-only]

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
W_ = 1200 if QUICK else 2400
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
# the depth of field: the same aperture diameter, so the same blur on the model
cd.dof.use_dof = True
cd.dof.focus_distance = (FOCUS - EYE).length
cd.dof.aperture_fstop = VIEW["fstop"] * cd.lens / VIEW["lens"]
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
scene.cycles.samples = int(ARGS.get("samples", 32 if QUICK else 160))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
r.film_transparent = True
r.image_settings.file_format = "WEBP"; r.image_settings.color_mode = "RGBA"; r.image_settings.quality = 88
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0

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
meta = {
    "size": [W_, H_],
    "box": BOX,
    "view": {"el": round(EL, 2), "lens": round(cd.lens, 2)},
    "anchors": {k: px(v) for k, v in ANCH.items()},
    "walk": {k: px((x, y, FLOOR)) + px((x, y, FLOOR + 1.6)) for k, (x, y) in WALK.items()},
    "seats": [px(s) + px((s[0], s[1], s[2] + 0.75)) for s in SEATS],
    "zones": {k: hull([px((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (FLOOR, FLOOR + h)])
              for k, (x0, x1, y0, y1, h) in ZONES.items()},
}
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
        ob.hide_render = not shell and ob in SHELL_OBS
        ob.is_holdout = shell and ob not in SHELL_OBS   # in front of the shell it still hides it
    # with the lamp off, the walls would "shadow" the whole page from the rooms' own lights
    CATCHER.hide_render = pass_ in ("shell", "dark")
for p in PASSES:
    show(p)
    light("dark" if p == "dark" else "night")
    render(p)
log("done")
