"""Процедурные макрорендеры материалов для карточек каталога.

Запуск (из корня проекта):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render_materials.py -- [slug ...]

Каждый материал — куча на тёмном сланце с тёплым боковым светом (стиль референса).
Это ИЛЛЮСТРАЦИИ, а не фото товара: на сайте подписываются «иллюстрация».
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT_DIR = os.path.join(os.getcwd(), "src", "assets", "materials")
SAMPLES = int(os.environ.get("MS_SAMPLES", "96"))
RES = (1600, 1200)

# kind: grains — гранулы; powder — тонкий порошок; mixed — порошок + заполнитель
MATERIALS = {
    "bauxite": dict(kind="grains", colors=[(0.42, 0.36, 0.30), (0.55, 0.47, 0.38), (0.33, 0.29, 0.25)], grain=(0.02, 0.05)),
    "andalusite": dict(kind="grains", colors=[(0.30, 0.29, 0.25), (0.42, 0.38, 0.31), (0.22, 0.22, 0.20)], grain=(0.018, 0.045)),
    "mullite": dict(kind="grains", colors=[(0.86, 0.82, 0.74), (0.78, 0.74, 0.66), (0.92, 0.90, 0.85)], grain=(0.018, 0.045)),
    "dispersants": dict(kind="powder", colors=[(0.93, 0.92, 0.89)], grain=(0.004, 0.01)),
    "castables": dict(kind="mixed", colors=[(0.42, 0.41, 0.39), (0.66, 0.60, 0.50), (0.35, 0.34, 0.33)], grain=(0.02, 0.05)),
    "rice-husk-ash": dict(kind="powder", colors=[(0.12, 0.12, 0.12)], grain=(0.004, 0.01)),
    "pek": dict(kind="grains", colors=[(0.70, 0.66, 0.60), (0.80, 0.77, 0.72), (0.58, 0.55, 0.50)], grain=(0.015, 0.04)),
    "anchors": dict(kind="anchors"),
    "refractories": dict(kind="bricks"),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as exc:  # noqa: BLE001
        print("GPU недоступен, рендер на CPU:", exc)
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = RES
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.003, 0.003, 1)
    scene.world = world
    return scene


def lin(c):
    return tuple(x ** 2.2 for x in c)


def principled(name, color, rough=0.85, metallic=0.0, use_attr=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*lin(color), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if use_attr:
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "grain_col"
        nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def slate():
    bpy.ops.mesh.primitive_plane_add(size=12)
    plane = bpy.context.active_object
    mat = bpy.data.materials.new("slate")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.018, 0.017, 0.017, 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6
    noise.inputs["Detail"].default_value = 12
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    plane.data.materials.append(mat)


def lights_and_camera(target=(0, 0, 0.25), dist=5.4, elev=30):
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 220
    key.size = 1.2
    key.color = (1.0, 0.72, 0.42)
    ko = bpy.data.objects.new("key", key)
    ko.location = (-2.6, -0.8, 1.9)
    ko.rotation_euler = (Vector(target) - ko.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(ko)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 70
    rim.size = 2
    rim.color = (1.0, 0.55, 0.25)
    ro = bpy.data.objects.new("rim", rim)
    ro.location = (2.2, 2.4, 1.2)
    ro.rotation_euler = (Vector(target) - ro.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(ro)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 12
    fill.size = 4
    fill.color = (0.7, 0.8, 1.0)
    fo = bpy.data.objects.new("fill", fill)
    fo.location = (1.5, -3, 2.5)
    fo.rotation_euler = (Vector(target) - fo.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(fo)

    cam = bpy.data.cameras.new("cam")
    cam.lens = 55
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = 3.2
    co = bpy.data.objects.new("cam", cam)
    e = math.radians(elev)
    co.location = (0.4, -dist * math.cos(e), dist * math.sin(e) + target[2])
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    cam.dof.focus_distance = (Vector(target) - co.location).length
    bpy.context.collection.objects.link(co)
    bpy.context.scene.camera = co


def pile_height(r, radius=1.0, h=0.55):
    return max(0.0, h * (1 - (r / radius) ** 1.4))


def powder_cone(color, radius=1.0, h=0.62):
    # Сетка-квадрат: всё вне кучи опускаем под сланец, чтобы не было видно краёв
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=220, y_subdivisions=220, size=radius * 2.6)
    obj = bpy.context.active_object
    rnd = random.Random(7)
    for v in obj.data.vertices:
        r = Vector((v.co.x, v.co.y)).length
        a = math.atan2(v.co.y, v.co.x)
        wob = 1 + 0.1 * math.sin(3 * a + 1.3) + 0.05 * math.sin(7 * a)
        z = pile_height(r / wob, radius, h)
        v.co.z = z + rnd.uniform(-0.003, 0.003) if z > 0 else -0.02
    tex = bpy.data.textures.new("n", "CLOUDS")
    tex.noise_scale = 0.12
    mod = obj.modifiers.new("disp", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.012
    tex.noise_scale = 0.3
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(principled("powder", color, rough=0.95))
    return obj


def grains(colors, size_range, count, radius=1.0, h=0.7, seed=1, on_cone=True):
    rnd = random.Random(seed)
    mesh = bpy.data.meshes.new("grains")
    bm = bmesh.new()
    col_layer = bm.loops.layers.float_color.new("grain_col")
    for _ in range(count):
        # плотнее к центру, «осыпь» по краям
        r = radius * 1.25 * math.sqrt(rnd.random()) ** 1.25
        a = rnd.uniform(0, math.tau)
        wob = 1 + 0.12 * math.sin(3 * a + seed) + 0.06 * math.sin(7 * a + 2 * seed)
        x, y = r * wob * math.cos(a), r * wob * math.sin(a)
        z = pile_height(r, radius, h) if on_cone else 0
        z += rnd.uniform(-0.02, 0.01)
        s = rnd.uniform(*size_range)
        mat = (
            Matrix.Translation((x, y, max(z, s * 0.4)))
            @ Matrix.Rotation(rnd.uniform(0, math.tau), 4, Vector((rnd.random(), rnd.random(), rnd.random())).normalized())
            @ Matrix.Diagonal((s * rnd.uniform(0.7, 1.3), s * rnd.uniform(0.6, 1.1), s * rnd.uniform(0.5, 0.9), 1))
        )
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=mat)
        base = rnd.choice(colors)
        k = rnd.uniform(0.82, 1.15)
        c = (*lin((min(base[0] * k, 1), min(base[1] * k, 1), min(base[2] * k, 1))), 1)
        faces = {f for v in res["verts"] for f in v.link_faces}
        for f in faces:
            for loop in f.loops:
                loop[col_layer] = c
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new("grains", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(principled("grain", colors[0], rough=0.8, use_attr=True))
    return obj


def anchors():
    steel = principled("steel", (0.82, 0.80, 0.77), rough=0.3, metallic=1.0)
    rnd = random.Random(3)

    def v_points(leg=0.95, spread=0.4, waves=4, amp=0.016, stem=0.22):
        pts = [(0.0, -stem), (0.0, 0.0)]
        for side in (-1, 1):
            leg_pts = []
            n = waves * 10
            for k in range(1, n + 1):
                t = k / n
                x = side * spread * t
                y = leg * t
                # волна поперёк ноги
                nx, ny = leg, -side * spread
                ln = math.hypot(nx, ny)
                w = amp * math.sin(t * waves * math.tau) * (0.2 + 0.8 * min(1, t * 3))
                leg_pts.append((x + w * nx / ln, y + w * ny / ln))
            if side == -1:
                left = leg_pts
            else:
                right = leg_pts
        return list(reversed(left)) + [(0.0, 0.0), (0.0, -stem)], right

    placements = [(-0.85, -0.3, 8), (0.2, -0.2, -12), (1.15, -0.3, 18), (-0.55, 1.0, 172)]
    for (x, y, rot) in placements:
        left, right = v_points(leg=rnd.uniform(0.8, 1.0))
        for pts in (left, right):
            curve = bpy.data.curves.new("v", "CURVE")
            curve.dimensions = "3D"
            curve.bevel_depth = 0.034
            curve.bevel_resolution = 4
            sp = curve.splines.new("POLY")
            sp.points.add(len(pts) - 1)
            for i, (px, py) in enumerate(pts):
                sp.points[i].co = (px, py, 0, 1)
            o = bpy.data.objects.new("anchor", curve)
            o.data.materials.append(steel)
            bpy.context.collection.objects.link(o)
            o.location = (x, y, 0.036)
            o.rotation_euler = (0, 0, math.radians(rot) + rnd.uniform(-0.1, 0.1))


def bricks():
    rnd = random.Random(5)
    base = lin((0.80, 0.66, 0.48))
    mat = bpy.data.materials.new("brick")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 40
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*[c * 0.75 for c in base], 1)
    ramp.color_ramp.elements[1].color = (*base, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    w, d, hh = 0.92, 0.46, 0.26
    layout = []
    for layer in range(3):
        for i in range(3):
            if layer % 2 == 0:
                layout.append(((i - 1) * (d + 0.01), 0, layer, 0))
            else:
                layout.append((0, (i - 1) * (d + 0.01), layer, 90))
    for (x, y, layer, rot) in layout:
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.active_object
        o.scale = (d, w, hh)
        o.rotation_euler = (0, 0, math.radians(rot + rnd.uniform(-2, 2)))
        o.location = (x, y, hh / 2 + layer * (hh + 0.004))
        bev = o.modifiers.new("b", "BEVEL")
        bev.width = 0.008
        bev.segments = 3
        o.data.materials.append(mat)
    # одиночный кирпич рядом
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.scale = (w, d, hh)
    o.rotation_euler = (0, 0, math.radians(28))
    o.location = (1.05, -0.75, hh / 2)
    o.modifiers.new("b", "BEVEL").width = 0.008
    o.data.materials.append(mat)


def render(slug):
    cfg = MATERIALS[slug]
    reset()
    slate()
    kind = cfg["kind"]
    target = (0, 0, 0.22)
    if kind == "grains":
        grains(cfg["colors"], cfg["grain"], 12000, seed=hash(slug) % 1000)
    elif kind == "powder":
        powder_cone(cfg["colors"][0])
        # мелкая осыпь вокруг
        grains(cfg["colors"], (0.006, 0.014), 2500, radius=1.15, h=0.0, seed=11, on_cone=False)
    elif kind == "mixed":
        powder_cone(cfg["colors"][0], h=0.62)
        grains(cfg["colors"][1:], (0.012, 0.03), 700, radius=1.25, h=0.0, seed=13, on_cone=False)
    elif kind == "anchors":
        anchors()
        target = (0.15, 0.2, 0.02)
    elif kind == "bricks":
        bricks()
        target = (0.25, -0.1, 0.35)
    lights_and_camera(target=target, dist={"anchors": 4.6, "bricks": 5.2}.get(kind, 4.7))
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(OUT_DIR, f"{slug}.jpg")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", slug)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for s in argv or list(MATERIALS):
        render(s)
