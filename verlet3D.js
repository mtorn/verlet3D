/*
Copyright (c) 2015 Mihail Tornberg, http://mihailtornberg.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
window.requestAnimFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
    window.setTimeout(callback, 1000 / 60);
};

var Verlet3D = function(settings) {
    this.canvas = settings.canvas;
    this.ctx = canvas.getContext("2d");

    this.draggedParticle = -1;
    this.draggedModel = 0;
    this.mouse = {
        down: false,
        x: 0,
        y: 0,
        ox: 0,
        oy: 0,
        button: 0,
        clicked: 0
    };
    this.ctx.lineWidth = settings.lineWidth || 0.7;
    this.ctx.fillStyle = settings.fillStyle || "#00D5B4";
    this.ctx.strokeStyle = settings.strokeStyle || "#666";

    var _this = this;

    //handle mouse
    this.canvas.onmousemove = function(e) {
        var rect = _this.canvas.getBoundingClientRect();
        _this.mouse.ox = _this.mouse.x;
        _this.mouse.oy = _this.mouse.y;
        _this.mouse.x = e.clientX - rect.left;
        _this.mouse.y = e.clientY - rect.top;
        e.preventDefault();
    };

    this.canvas.onmousedown = function(e) {
        _this.mouse.button = e.which;
        _this.mouse.down = true;
        e.preventDefault();
    };

    this.canvas.onmouseup = function(e) {
        _this.mouse.down = false;
        _this.draggedParticle = -1;
        e.preventDefault();
    };

    //disable menu
    this.canvas.oncontextmenu = function(e) {
        e.preventDefault();
    };
};


Verlet3D.prototype.rotateCamera = function(object) {
    object.model.angleY += object.y || 0;
    object.model.angleX += object.x || 0;
    object.model.angleZ += object.z || 0;
};

Verlet3D.prototype.calc3D = function(model) {
    //reset vertex array
    model.vertex = [];

    //add particles to vertex array
    for (var i = 0; i < model.particles.length; i++) {
        model.vertex.push({
            x: model.particles[i].x,
            y: model.particles[i].y,
            z: model.particles[i].z
        });
    }

    for (var i = 0; i < model.vertex.length; i++) {
        var data = model.vertex[i];
        var x = data.x * model.scale;
        var y = data.y * model.scale;
        var z = data.z * model.scale;

        //rotation
        var xcosa = Math.cos(model.angleX);
        var xsina = Math.sin(model.angleX);
        var ycosa = Math.cos(model.angleY);
        var ysina = Math.sin(model.angleY);
        var zcosa = Math.cos(model.angleZ);
        var zsina = Math.sin(model.angleZ);

        //3D calculation
        var xy = xcosa * y - xsina * z; //x
        var xz = xsina * y + xcosa * z;

        var yz = ycosa * xz - ysina * x; //y
        var yx = ysina * xz + ycosa * x;

        var zx = zcosa * yx - zsina * xy; //z
        var zy = zsina * yx + zcosa * xy;

        //update vertex
        data.x = zx;
        data.y = zy;
        data.z = yz;
    }
};

Verlet3D.prototype.calcVerlet = function(model) {

    //particles first...
    for (var i = 0; i < model.particles.length; i++) {

        var data = model.particles[i];
        var dx = data.x - data.ox;
        var dy = data.y - data.oy;
        var dz = data.z - data.oz;

        if (data.lock === 0) {
            data.ox = data.x;
            data.oy = data.y;
            data.oz = data.z;
            data.x = data.x + dx * model.friction;
            data.y = data.y + dy + model.gravity;
            data.z = data.z + dz * model.friction;
        } else {
            data.x = data.ox;
            data.y = data.oy;
            data.z = data.oz;
        }
    }

    //..and then constraints
    for (var i = 0; i < model.iterations; i++) {

        for (var c = 0; c < model.constraints.length; c++) {

            var c1 = model.particles[model.constraints[c].f];
            var c2 = model.particles[model.constraints[c].s];

            var diffx = c1.x - c2.x;
            var diffy = c1.y - c2.y;
            var diffz = c1.z - c2.z;

            var dist = Math.sqrt(diffx * diffx + diffy * diffy + diffz * diffz);
            var diff = (model.constraints[c].dist - dist) / dist;


            var dx = diffx * 0.5;
            var dy = diffy * 0.5;
            var dz = diffz * 0.5;

            c1.x = c1.x + dx * diff;
            c1.y = c1.y + dy * diff;
            c1.z = c1.z + dz * diff;

            c2.x = c2.x - dx * diff;
            c2.y = c2.y - dy * diff;
            c2.z = c2.z - dz * diff;

            if (dist > model.tear_distance) {
                model.constraints.splice(c, 1);
            }
        }
    }
};

var Model = function(settings) {
    this.vertex = [];
    this.particles = [];
    this.constraints = [];
    this.xPos = settings.xPos || 0;
    this.yPos = settings.yPos || 0;
    this.angleX = 0;
    this.angleY = 0;
    this.angleZ = 0;

    this.scale = settings.scale || 1;
    this.gravity = settings.gravity || 0.2;
    this.friction = settings.friction || 0.99;
    this.iterations = settings.iterations || 5;
    this.tear_distance = settings.tearDistance || 120;
    this.field_of_view = settings.fov || 1500;
};

Model.prototype.createParticle = function(vx, vy, vz, lockstate) {
    this.particles.push({
        x: vx,
        y: vy,
        z: vz,
        ox: vx,
        oy: vy,
        oz: vz,
        lock: (lockstate || 0)
    });
};

Model.prototype.createConstraint = function(first, second) {
    this.constraints.push({
        f: first,
        s: second,
        dist: Math.sqrt(
            Math.pow(this.particles[first].x - this.particles[second].x, 2) +
            Math.pow(this.particles[first].y - this.particles[second].y, 2) +
            Math.pow(this.particles[first].z - this.particles[second].z, 2))
    });
};

Model.prototype.createConstraintsBasedOnDistance = function(distance) {
    for (var i = 0; i < this.particles.length; i++) {

        for (var c = i + 1; c < this.particles.length; c++) {

            var dist = Math.sqrt(
                Math.pow(this.particles[i].x - this.particles[c].x, 2) +
                Math.pow(this.particles[i].y - this.particles[c].y, 2) +
                Math.pow(this.particles[i].z - this.particles[c].z, 2));


            if (dist < distance) {
                this.createConstraint(i, c);
            }

        }
    }
};

Verlet3D.prototype.draw3D = function(dmodels) {
    if (dmodels.constructor !== Array) var dmodels = [dmodels];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.beginPath();

    for (var modeln = 0; modeln < dmodels.length; modeln++) {
        var model = dmodels[modeln];
        for (var i = 0; i < model.constraints.length; i++) {

            for (var c = 0; c < 2; c++) {
                //calculate fov
                var data = (c == 1) ? model.vertex[model.constraints[i].f] : model.vertex[model.constraints[i].s];

                var fov = model.field_of_view / (model.field_of_view + data.z);

                var x = data.x * fov + model.xPos;
                var y = data.y * fov + model.yPos;

                if (c === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
    }
    this.ctx.closePath();
    this.ctx.stroke();
};


Verlet3D.prototype.findClosest = function(fmodels) {
    if (fmodels.constructor !== Array) var fmodels = [fmodels];
    this.smallest = 1000000;
    this.highestZ = -1000000;
    for (var modeln = 0; modeln < fmodels.length; modeln++) {

        var modeldata = fmodels[modeln];

        for (var i = 0; i < fmodels[modeln].vertex.length; i++) {

            var data = modeldata.vertex[i];

            var fov = modeldata.field_of_view / (modeldata.field_of_view + data.z);

            var x = data.x * fov + modeldata.xPos;
            var y = data.y * fov + modeldata.yPos;

            var dist = Math.sqrt(
                Math.pow(x - (this.mouse.x), 2) +
                Math.pow(y - (this.mouse.y), 2));
            if (dist < this.smallest && dist < 10 && data.z > this.highestZ) {
                this.highestZ = data.z;
                this.smallest = dist;
                this.smallestparticle = i;
                this.model = modeln;
            }

        }
    }
    if (this.smallestparticle == undefined) return 0;
    return {
        particle: this.smallestparticle,
        model: this.model
    };
};

Verlet3D.prototype.handleMouse = function(mmodels) {
    if (mmodels.constructor !== Array) var mmodels = [mmodels];
    if (this.mouse.down === true) {
        this.mouse.clicked = 1;
        if (this.draggedParticle == -1) {
            var data = this.findClosest(mmodels);
            if (data === 0) return;
            var model = mmodels[data.model];
            var pdata = mmodels[data.model].vertex[data.particle];
        } else {
            var model = mmodels[this.draggedModel];
            var pdata = mmodels[this.draggedModel].vertex[this.draggedParticle];
        }
        var fov = model.field_of_view / (model.field_of_view + pdata.z);
        var x = pdata.x * fov + model.xPos;
        var y = pdata.y * fov + model.yPos;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 5, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();

        if (this.mouse.button == 1) {
            if (this.draggedParticle == -1) {
                this.draggedParticle = data.particle;
                this.draggedModel = data.model;
            }
            model.particles[this.draggedParticle].x += (this.mouse.x - this.mouse.ox) * 25;
            model.particles[this.draggedParticle].y += (this.mouse.y - this.mouse.oy) * 25;
        }

        if (this.mouse.button == 3) {
            for (var c = 0; c < model.constraints.length; c++) {
                if (model.constraints[c].f == data.particle || model.constraints[c].s == data.particle) {
                    model.constraints.splice(c, 1);
                }
            }
        }

        if (this.mouse.button == 2) {
            model.angleX += (this.mouse.y - this.mouse.oy) / 25;
            model.angleY += (this.mouse.x - this.mouse.ox) / 25;
        }
    } else {
        var data = this.findClosest(mmodels);
        if (data === 0) return;
        var model = mmodels[data.model];
        var pdata = mmodels[data.model].vertex[data.particle];
        var fov = model.field_of_view / (model.field_of_view + pdata.z);
        var x = pdata.x * fov + model.xPos;
        var y = pdata.y * fov + model.yPos;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 5, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};