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
    PEG_HEAD.hide_render = False
    out = OUT if QUICK else PUB
    for state in ("night", "dark"):
        light(state)
        # with the ceiling and the shades hidden, the rooms' pendants would light the peg bare; in the
        # set they're shaded and mostly light the tables, so they get a fraction of their power here
        for ob in ROOM_LIGHTS:
            ob.data.energy *= PEG_ROOM_GAIN
        for c, body in PEG_BODY.items():
            body.hide_render = False
            r.filepath = os.path.join(out, f"peg-{c}-{state}.webp")
            if not META_ONLY:
                bpy.ops.render.render(write_still=True)
            log("wrote", r.filepath)
            body.hide_render = True

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
    "seats": [px(s) + px((s[0], s[1], s[2] + 0.75)) for s in SEATS],
    # the peg sprites (--pegs): their size, and where the feet and the 1.6 m mark fall in them
    "peg": PEG_META,
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
    for p in PASSES:
        show(p)
        light("dark" if p == "dark" else "night")
        render(p)
log("done")
