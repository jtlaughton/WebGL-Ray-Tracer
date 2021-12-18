var scene = null;
var maxDepth = 1;
var background_color = [190 / 255, 210 / 255, 215 / 255];
var ambientToggle = true;
var diffuseToggle = true;
var specularToggle = true;
var reflectionToggle = true;
var bias = 0.001;

function distanceBetweenPoints(a, b) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2))
}

class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction;
    }
}

class Intersection {
    constructor(distance, point) {
        this.distance = distance;
        this.point = point;
    }
}

class Hit {
    constructor(intersection, object) {
        this.intersection = intersection;
        this.object = object;
    }
}

/*
    Intersect objects
*/
function raySphereIntersection(ray, sphere) {
    var center = sphere.center;
    var radius = sphere.radius;

    // Compute intersection
    var e = ray.origin;
    var d = ray.direction;

    var A = dot(d, d);
    var B = dot(mult(d, 2), sub(e, center));
    var C = dot(sub(e, center), sub(e, center)) - Math.pow(radius, 2);
    var t_int = Math.pow(B, 2) - (4 * A * C);


    // If there is a intersection, return a new Intersection object with the distance and intersection point:
    // E.g., return new Intersection(t, point);
    if (t_int < 0) {
        return null;
    }

    else {
        var t_sub = (-B - Math.sqrt(t_int)) / (2 * A);
        var t_pos = (-B + Math.sqrt(t_int)) / (2 * A);

        var t = Math.min(t_sub, t_pos);

        var p = add(e, mult(d, t - bias));

        if (t > 0)
            return new Intersection(t, p);
        else
            return null;
    }
    // If no intersection, return null
}

function rayPlaneIntersection(ray, plane) {

    // Compute intersection
    var e = ray.origin;
    var d = ray.direction;
    var c = plane.center;
    var n = plane.normal;

    // If there is a intersection, return a dictionary with the distance and intersection point:
    // E.g., return new Intersection(t, point);
    var t = dot(sub(c, e), n) / dot(n, d);

    if (t >= bias && dot(n,d) != 0) {
        var p = add(e, mult(d, t));
        return new Intersection(t, p);
    }

    // If no intersection, return null
    else {
        return null;
    }
}

function intersectObjects(ray, depth) {


    // Loop through all objects, compute their intersection (based on object type and calling the previous two functions)
    // Return a new Hit object, with the closest intersection and closest object
    var closest_intersection = null;
    var closest_object = null;

    scene.objects.forEach((elem) => {
        var intersection = null;

        if (elem.type === 'plane') {
            intersection = rayPlaneIntersection(ray, elem);
        }
        else {
            intersection = raySphereIntersection(ray, elem);
        }

        if (intersection !== null) {
            if (closest_intersection === null) {
                closest_intersection = intersection;
                closest_object = elem;
            }
            else {
                if (distanceBetweenPoints(ray.origin, intersection.point) < distanceBetweenPoints(ray.origin, closest_intersection.point)) {
                    closest_intersection = intersection;
                    closest_object = elem;
                }
            }
        }
    });

    if (closest_intersection !== null) {
        return new Hit(closest_intersection, closest_object);
    }
    else {
        return null;
    }
    // If no hit, retur null

}

function sphereNormal(sphere, pos) {
    // Return sphere normal
    return normalize(sub(pos, sphere.center));
}

/*
    Shade surface
*/
function shade(ray, hit, depth) {

    var object = hit.object;

    // Compute object normal, based on object type
    // If sphere, use sphereNormal, if not then it's a plane, use object normal
    var normal;
    if (object.type === 'plane')
        normal = object.normal;
    else
        normal = sphereNormal(object, hit.intersection.point);

    // Loop through all lights, computing diffuse and specular components *if not in shadow*
    var diffuse = 0;
    var specular = 0;

    var toEye = normalize(sub(scene.camera.position, hit.intersection.point));

    scene.lights.forEach((elem) => {
        if (!isInShadow(hit, elem)) {
            var lm = normalize(sub(elem.position, hit.intersection.point));

            diffuse += object.diffuseK * (dot(lm, normal));

            var addToEye = add(lm, toEye);

            var halfway = normalize(mult(addToEye, 1 / length(addToEye)));

            var halfDotNorm = dot(halfway, normal);

            specular += object.specularK * Math.pow(halfDotNorm, object.specularExponent);
        }
    });

    // Combine colors, taking into account object constants
    var total = 0;

    if (ambientToggle) {
        total += object.ambientK
    }

    if (diffuseToggle) {
        total += diffuse;
    }

    if (specularToggle) {
        total += specular;
    }

    var previousColor = mult(object.color, total);

    if (!reflectionToggle) {
        return previousColor;
    }

    // Handle reflection, make sure to call trace incrementing depth

    var reflection = reflect(mult(ray.direction, -1), normal);
    var reflectedRay = new Ray(hit.intersection.point, reflection);
    var reflectedColor = trace(reflectedRay, depth + 1);

    if (reflectedColor === null) {
        return previousColor;
    }
    else
        return add(previousColor, mult(reflectedColor, object.reflectiveK));
}


/*
    Trace ray
*/
function trace(ray, depth) {
    if (depth > maxDepth) return background_color;
    var hit = intersectObjects(ray, depth);
    if (hit != null) {
        var color = shade(ray, hit, depth);
        return color;
    }
    return null;
}

function isInShadow(hit, light) {

    // Check if there is an intersection between the hit.intersection.point point and the light
    // If so, return true
    // If not, return false

    var origin = hit.intersection.point;
    var direction = sub(light.position, origin);

    var new_ray = new Ray(origin, normalize(direction));

    var new_hit = intersectObjects(new_ray, 0);

    return (new_hit != null) && new_hit.intersection.distance > 0;
}

/*
    Render loop
*/
function render(element) {
    if (scene == null)
        return;

    var width = element.clientWidth;
    var height = element.clientHeight;
    element.width = width;
    element.height = height;
    scene.camera.width = width;
    scene.camera.height = height;

    var ctx = element.getContext("2d");
    var data = ctx.getImageData(0, 0, width, height);

    var eye = normalize(sub(scene.camera.direction, scene.camera.position));
    var right = normalize(cross(eye, [0, 1, 0]));
    var up = normalize(cross(right, eye));
    var fov = ((scene.camera.fov / 2.0) * Math.PI / 180.0);

    var halfWidth = Math.tan(fov);
    var halfHeight = (scene.camera.height / scene.camera.width) * halfWidth;
    var pixelWidth = (halfWidth * 2) / (scene.camera.width - 1);
    var pixelHeight = (halfHeight * 2) / (scene.camera.height - 1);

    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            var vx = mult(right, x * pixelWidth - halfWidth);
            var vy = mult(up, y * pixelHeight - halfHeight);
            var direction = normalize(add(add(eye, vx), vy));
            var origin = scene.camera.position;

            var ray = new Ray(origin, direction);
            var color = trace(ray, 0);
            if (color != null) {
                var index = x * 4 + y * width * 4;
                data.data[index + 0] = color[0];
                data.data[index + 1] = color[1];
                data.data[index + 2] = color[2];
                data.data[index + 3] = 255;
            }
        }
    }
    console.log("done");
    ctx.putImageData(data, 0, 0);
}

/*
    Handlers
*/
window.handleFile = function (e) {
    var reader = new FileReader();
    reader.onload = function (evt) {
        var parsed = JSON.parse(evt.target.result);
        scene = parsed;
    }
    reader.readAsText(e.files[0]);
}

window.updateMaxDepth = function () {
    maxDepth = document.querySelector("#maxDepth").value;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleAmbient = function () {
    ambientToggle = document.querySelector("#ambient").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleDiffuse = function () {
    diffuseToggle = document.querySelector("#diffuse").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleSpecular = function () {
    specularToggle = document.querySelector("#specular").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleReflection = function () {
    reflectionToggle = document.querySelector("#reflection").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

/*
    Render scene
*/
window.renderScene = function (e) {
    var element = document.querySelector("#canvas");
    render(element);
}