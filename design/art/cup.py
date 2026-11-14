"""A to-go cup for each brand direction, with its logo printed on it.

    B="$LOCALAPPDATA/Microsoft/WindowsApps/blender-launcher.exe"
    $B -b -P art/cup.py -- [--quick] [--only=tall]

Reads art/out/cups.json (written by art/logos.mjs: each cup's colours and its print as a PNG) and
writes art/out/cup-<id>.png on a transparent ground. The Store build of Blender has no console,
so everything printed also goes to art/out/run.log.

Units are roughly decimetres: the cup stands 2.7 tall.
"""
import bpy, bmesh, os, sys, math, json
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUICK = "--quick" in ARGV
ONLY = next((a.split("=")[1] for a in ARGV if a.startswith("--only=")), None)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

import builtins, traceback
_log = open(os.path.join(OUT, "run.log"), "w", encoding="utf-8")
_print = builtins.print
def print(*a, **k):
    _print(*a, **k)
    _print(*a, file=_log, flush=True)

HEIGHT, FOOT, MOUTH = 2.7, 0.60, 0.90
# the print: how much of the way round the cup it takes, and where up the wall it sits
PRINT_ROUND, PRINT_FROM, PRINT_TO = 0.41, 0.15, 0.89

def lin(hex_):
    """sRGB hex to the linear RGBA Blender shades in."""
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def lathe(name, prof, mat, segs=128):
    """A turned piece from its (radius, height) profile. u runs once round it with 0.5 facing
    the camera (-y), v is height over the cup's, so a print lands square on the front."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("uv")
    def ring(r, z):
        if r == 0.0:
            return [bm.verts.new((0.0, 0.0, z))]
        return [bm.verts.new((r * math.sin(2 * math.pi * (k / segs - 0.5)), -r * math.cos(2 * math.pi * (k / segs - 0.5)), z))
                for k in range(segs)]
    rings = [ring(r, z) for r, z in prof]
    for i, (a, b) in enumerate(zip(rings, rings[1:])):
        za, zb = prof[i][1], prof[i + 1][1]
        for k in range(segs):
            n = (k + 1) % segs
            if len(a) == 1:
                corners = [(a[0], k + 0.5, za), (b[k], k, zb), (b[n], k + 1, zb)]
            elif len(b) == 1:
                corners = [(a[k], k, za), (a[n], k + 1, za), (b[0], k + 0.5, zb)]
            else:
                corners = [(a[k], k, za), (a[n], k + 1, za), (b[n], k + 1, zb), (b[k], k, zb)]
            face = bm.faces.new([c[0] for c in corners])
            for loop, (_, u, z) in zip(face.loops, corners):
                loop[uv].uv = (u / segs, z / HEIGHT)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = True
    return link(bpy.data.objects.new(name, me))

def principled(name, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = rough
    return m, p

def paper(colour, print_png):
    """The cup wall: coated paper in the brand's colour, with the logo printed on its front."""
    m, p = principled("paper", 0.52)
    nt = m.node_tree
    coord, place = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeMapping")
    art = nt.nodes.new("ShaderNodeTexImage")
    art.image, art.extension = bpy.data.images.load(print_png), "CLIP"
    sx, sy = 1 / PRINT_ROUND, 1 / (PRINT_TO - PRINT_FROM)
    place.inputs["Scale"].default_value = (sx, sy, 1.0)
    place.inputs["Location"].default_value = (-(0.5 - PRINT_ROUND / 2) * sx, -PRINT_FROM * sy, 0.0)
    ink = nt.nodes.new("ShaderNodeMix"); ink.data_type = "RGBA"
    ink.inputs[6].default_value = lin(colour)
    nt.links.new(coord.outputs["UV"], place.inputs["Vector"])
    nt.links.new(place.outputs["Vector"], art.inputs["Vector"])
    nt.links.new(art.outputs["Alpha"], ink.inputs[0])
    nt.links.new(art.outputs["Color"], ink.inputs[7])
    nt.links.new(ink.outputs[2], p.inputs["Base Color"])
    return m

def plastic(colour):
    m, p = principled("lid", 0.34)
    p.inputs["Base Color"].default_value = lin(colour)
    return m

def build(cup):
    wall = [(0.0, 0.03), (FOOT - 0.04, 0.03), (FOOT - 0.02, 0.0), (FOOT, 0.0), (FOOT + 0.004, 0.03), (MOUTH, HEIGHT)]
    lathe("cup", wall, paper(cup["body"], cup["print"]))
    lid = [(MOUTH + 0.05, HEIGHT - 0.10), (MOUTH + 0.06, HEIGHT - 0.06), (MOUTH + 0.06, HEIGHT + 0.03),
           (MOUTH + 0.035, HEIGHT + 0.075), (MOUTH - 0.02, HEIGHT + 0.09), (MOUTH - 0.10, HEIGHT + 0.25),
           (MOUTH - 0.125, HEIGHT + 0.285), (MOUTH - 0.17, HEIGHT + 0.295), (MOUTH - 0.21, HEIGHT + 0.28),
           (MOUTH - 0.24, HEIGHT + 0.215), (MOUTH - 0.29, HEIGHT + 0.195), (0.0, HEIGHT + 0.195)]
    lathe("lid", lid, plastic(cup["lid"]))
    # the sip hole: a dark lozenge set into the lid's well
    hole = bpy.data.meshes.new("sip")
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=32, radius=0.09)
    bm.to_mesh(hole)
    m, p = principled("sip", 0.5)
    p.inputs["Base Color"].default_value = (0.012, 0.010, 0.010, 1.0)
    hole.materials.append(m)
    sip = link(bpy.data.objects.new("sip", hole))
    sip.scale, sip.location = (1.9, 0.7, 1.0), (0.0, -(MOUTH - 0.42), HEIGHT + 0.199)

def stage():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value, bg.inputs["Strength"].default_value = (1.0, 0.98, 0.95, 1.0), 0.42
    scene.world = world

    def lamp(name, kind, at, energy, size=None, colour="#FFFFFF"):
        d = bpy.data.lights.new(name, kind)
        d.energy, d.color = energy, lin(colour)[:3]
        if kind == "AREA":
            d.size = size
        else:
            d.angle = math.radians(28)
        ob = link(bpy.data.objects.new(name, d))
        ob.location = at
        ob.rotation_euler = (Vector((0.0, 0.0, 1.4)) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
        return ob
    lamp("key", "SUN", (-5.0, -6.0, 8.0), 1.9, colour="#FFF4E6")
    lamp("rim", "AREA", (5.5, 4.0, 5.0), 2600.0, size=5.0, colour="#FFE9D2")
    lamp("fill", "AREA", (6.0, -5.0, 2.0), 500.0, size=7.0)

    cd = bpy.data.cameras.new("eye")
    cd.lens, cd.sensor_fit, cd.sensor_width = 90.0, "HORIZONTAL", 36.0
    cam = link(bpy.data.objects.new("eye", cd))
    cam.location = (0.0, -8.6, 3.5)
    cam.rotation_euler = (Vector((0.0, 0.0, 1.52)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    r = scene.render
    r.engine = "BLENDER_EEVEE"
    r.film_transparent = True
    r.image_settings.file_format, r.image_settings.color_mode = "PNG", "RGBA"
    r.resolution_x, r.resolution_y, r.resolution_percentage = 900, 1200, 50 if QUICK else 100
    scene.view_settings.view_transform, scene.view_settings.look = "Standard", "None"
    scene.eevee.taa_render_samples = 16 if QUICK else 96
    scene.eevee.use_raytracing = True

try:
    cups = json.load(open(os.path.join(OUT, "cups.json"), encoding="utf-8"))
    for cup in cups:
        if ONLY and ONLY not in cup["id"]:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        stage()
        build(cup)
        bpy.context.scene.render.filepath = os.path.join(OUT, f"cup-{cup['id']}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", bpy.context.scene.render.filepath)
    print("done")
except Exception:
    print(traceback.format_exc())
    raise
finally:
    _log.close()
