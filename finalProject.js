/* Charles Horton, Nathan Cheung */

var gl;

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialize WebGL, sorry :-(");
    }
}


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}


var shaderProgram;

function initShaders() {
    var fragmentShader = getShader(gl, "fragment-shader");
    var vertexShader = getShader(gl, "vertex-shader");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialize shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.pointLightingLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightingLocation");
    shaderProgram.pointLightingColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingColor");
}


function handleLoadedTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);
}


// var earthTexture;
// var jupiterTexture;
var crateTexture;

function initTextures() {
    for (var planetNum = 0; planetNum < planets.length; planetNum++){
        planets[planetNum].initPlanetTexture();
    }

    crateTexture = gl.createTexture();
    crateTexture.image = new Image();
    crateTexture.image.onload = function () {
        handleLoadedTexture(crateTexture)
    }
    crateTexture.image.src = "crate.gif";
}


var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}


function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

var Planet = (function() {
    function Planet(radius, xpos, ypos, zpos, longitudeBands, latitudeBands, initRotateAngle, rotateSpeed, turnSpeed, textureFile){
        this._longitudeBands = longitudeBands;
        this._latitudeBands = latitudeBands;
        this._radius = radius;
        this._xpos = xpos;
        this._ypos = ypos;
        this._zpos = zpos;
        this._rotateAngle = initRotateAngle;
        this._turnAngle = 0;
        this._rotateSpeed = rotateSpeed;
        this._turnSpeed = turnSpeed;
        this._textureFile = textureFile;
        this._texture;
        this._vertexPositionData = [];
        this._normalData = [];
        this._textureCoordData = [];
        this._indexData = [];
    };

    this._vertexPositionBuffer;
    this._vertexNormalBuffer;
    this._vertexTextureCoordBuffer;
    this._vertexIndexBuffer;

    Planet.prototype.initPlanetBuffers = function(){
        this.fillPlanetArrays();
        this.createPlanetBufferData();
    };

    Planet.prototype.fillPlanetArrays = function(){
        for (var latNumber=0; latNumber <= this._latitudeBands; latNumber++) {
            var theta = latNumber * Math.PI / this._latitudeBands;
            var sinTheta = Math.sin(theta);
            var cosTheta = Math.cos(theta);

            for (var longNumber=0; longNumber <= this._longitudeBands; longNumber++) {
                var phi = longNumber * 2 * Math.PI / this._longitudeBands;
                var sinPhi = Math.sin(phi);
                var cosPhi = Math.cos(phi);

                var x = cosPhi * sinTheta;
                var y = cosTheta;
                var z = sinPhi * sinTheta;
                var u = 1 - (longNumber / this._longitudeBands);
                var v = 1 - (latNumber / this._latitudeBands);

                this._normalData.push(x);
                this._normalData.push(y);
                this._normalData.push(z);
                this._textureCoordData.push(u);
                this._textureCoordData.push(v);
                this._vertexPositionData.push(this._radius * x);
                this._vertexPositionData.push(this._radius * y);
                this._vertexPositionData.push(this._radius * z);
            }
        }

        var indexData = [];
        for (var latNumber=0; latNumber < this._latitudeBands; latNumber++) {
            for (var longNumber=0; longNumber < this._longitudeBands; longNumber++) {
                var first = (latNumber * (this._longitudeBands + 1)) + longNumber;
                var second = first + this._longitudeBands + 1;
                this._indexData.push(first);
                this._indexData.push(second);
                this._indexData.push(first + 1);

                this._indexData.push(second);
                this._indexData.push(second + 1);
                this._indexData.push(first + 1);
            }
        }
    };

    Planet.prototype.createPlanetBufferData = function(){
        this._vertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._normalData), gl.STATIC_DRAW);
        this._vertexNormalBuffer.itemSize = 3;
        this._vertexNormalBuffer.numItems = this._normalData.length / 3;

        this._vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._textureCoordData), gl.STATIC_DRAW);
        this._vertexTextureCoordBuffer.itemSize = 2;
        this._vertexTextureCoordBuffer.numItems = this._textureCoordData.length / 2;

        this._vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._vertexPositionData), gl.STATIC_DRAW);
        this._vertexPositionBuffer.itemSize = 3;
        this._vertexPositionBuffer.numItems = this._vertexPositionData.length / 3;

        this._vertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._indexData), gl.STREAM_DRAW);
        this._vertexIndexBuffer.itemSize = 1;
        this._vertexIndexBuffer.numItems = this._indexData.length;
    };

    Planet.prototype.drawPlanet = function(){
        mvPushMatrix();

        mat4.rotate(mvMatrix, degToRad(this._rotateAngle), [0, 0, 1]);
        mat4.translate(mvMatrix, [0 + this._xpos, 0 + this._ypos, 0 + this._zpos]);
        mat4.rotate(mvMatrix, degToRad(this._turnAngle), [0, 0, 1]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(shaderProgram.samplerUniform, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this._vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexTextureCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, this._vertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, this._vertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer);
        setMatrixUniforms();
        gl.drawElements(gl.TRIANGLES, this._vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        mvPopMatrix();
    };

    Planet.prototype.setPlanetTexture = function(texture){
        this._texture = texture;
    };

    Planet.prototype.initPlanetTexture = function(){
        this._texture = gl.createTexture();
        this._texture.image = new Image();
        var tempTexture = this._texture;
        this._texture.image.onload = function () {
            handleLoadedTexture(tempTexture)
        }
        this._texture.image.src = this._textureFile;
        // planets[0].setPlanetTexture(this._texture);
    };

    Planet.prototype.rotateAndTurn = function(elapsed){
        currentRotateAngle = this.getPlanetRotateAngle();
        currentTurnAngle = this.getPlanetTurnAngle();
        this.setPlanetAngles(currentRotateAngle + this._rotateSpeed * elapsed, currentTurnAngle + this._turnSpeed * elapsed);
    };

    Planet.prototype.setPlanetAngles = function(rotateAngle, turnAngle){
        this._rotateAngle = rotateAngle;
        this._turnAngle = turnAngle;
    };

    Planet.prototype.getPlanetRotateAngle = function(){
        return this._rotateAngle;
    };

    Planet.prototype.getPlanetTurnAngle = function(){
        return this._turnAngle;
    }

    Planet.prototype.getPlanetXpos = function(){
        return this._xpos;
    }

    Planet.prototype.getPlanetYpos = function(){
        return this._ypos;
    }

    Planet.prototype.getPlanetZPos = function(){
        return this._zpos;
    }

    Planet.prototype.setPlanetXpos = function(xpos){
        this._xpos = xpos;
    }

    Planet.prototype.setPlanetYpos = function(ypos){
        this._ypos = ypos;
    }

    Planet.prototype.setPlanetZpos = function(zpos){
        this._zpos = zpos;
    }

    return Planet
})();

var cubeVertexPositionBuffer;
var cubeVertexNormalBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;

var planets = [];
planets.push(new Planet(1, 0, 0, 0, 30, 30, 180, .06, .1, "sunMap_2.jpg"));
planets.push(new Planet(1, 4, 0, 0, 30, 30, 180, .02, .1, "mercurymap.jpg"));
planets.push(new Planet(1, 6, 0, 0, 30, 30, 180, .02, .1, "venusmap.jpg"));
planets.push(new Planet(1, 8, 0, 0, 30, 30, 180, .02, .1, "earthMap_2.jpg"));
planets.push(new Planet(1, 10, 0, 0, 30, 30, 180, .02, .1, "marsmap1k.jpg"));
planets.push(new Planet(1, 12, 0, 0, 30, 30, 180, .02, .1, "jupiterMap_2.jpg"));
planets.push(new Planet(1, 14, 0, 0, 30, 30, 180, .02, .1, "saturnmap.jpg"));
planets.push(new Planet(1, 16, 0, 0, 30, 30, 180, .02, .1, "uranusmap.jpg"));
planets.push(new Planet(1, 18, 0, 0, 30, 30, 180, .02, .1, "neptunemap.jpg"));
planets.push(new Planet(1, 20, 0, 0, 30, 30, 180, .02, .1, "plutomap1k.jpg"));

function initBuffers() {
    cubeVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    vertices = [
        // Front face
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,

        // Back face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0, -1.0, -1.0,

        // Top face
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
         1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,

        // Bottom face
        -1.0, -1.0, -1.0,
         1.0, -1.0, -1.0,
         1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,

        // Right face
         1.0, -1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,

        // Left face
        -1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeVertexPositionBuffer.itemSize = 3;
    cubeVertexPositionBuffer.numItems = 24;

    cubeVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
    var vertexNormals = [
        // Front face
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,

        // Back face
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,

        // Top face
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,

        // Bottom face
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,

        // Right face
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,

        // Left face
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
    cubeVertexNormalBuffer.itemSize = 3;
    cubeVertexNormalBuffer.numItems = 24;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    var textureCoords = [
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Back face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Top face
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,

        // Bottom face
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,

        // Right face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 24;

    cubeVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [
        0, 1, 2,      0, 2, 3,    // Front face
        4, 5, 6,      4, 6, 7,    // Back face
        8, 9, 10,     8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15, // Bottom face
        16, 17, 18,   16, 18, 19, // Right face
        20, 21, 22,   20, 22, 23  // Left face
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 36;

    for (var planetNum = 0; planetNum < planets.length; planetNum++){
        planets[planetNum].initPlanetBuffers();
    }
}

var cubeAngle = 0;

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    var lighting = document.getElementById("lighting").checked;
    gl.uniform1i(shaderProgram.useLightingUniform, lighting);
    if (lighting) {
        gl.uniform3f(
            shaderProgram.ambientColorUniform,
            parseFloat(document.getElementById("ambientR").value),
            parseFloat(document.getElementById("ambientG").value),
            parseFloat(document.getElementById("ambientB").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingLocationUniform,
            parseFloat(document.getElementById("lightPositionX").value),
            parseFloat(document.getElementById("lightPositionY").value),
            parseFloat(document.getElementById("lightPositionZ").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingColorUniform,
            parseFloat(document.getElementById("pointR").value),
            parseFloat(document.getElementById("pointG").value),
            parseFloat(document.getElementById("pointB").value)
        );
    }

    mat4.identity(mvMatrix);

    mat4.translate(mvMatrix, [0, 0, -50]);

    for (planetNum = 0; planetNum < planets.length; planetNum++){
        planets[planetNum].drawPlanet();
    }



    mvPushMatrix();
    mat4.rotate(mvMatrix, degToRad(cubeAngle), [0, 1, 0]);
    mat4.translate(mvMatrix, [5, 0, 0]);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, crateTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();
}


var lastTime = 0;

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;

        for (planetNum = 0; planetNum < planets.length; planetNum++){
            planets[planetNum].rotateAndTurn(elapsed)
            // planets[planetNum].setPlanetAngle(planets[planetNum].getPlanetAngle() + ((planetNum+1)*.01) * elapsed);
        }

        // earthAngle += 0.05 * elapsed;
        cubeAngle += 0.05 * elapsed;
        // jupiterAngle += 0.05 * elapsed;
    }
    lastTime = timeNow;
}



function tick() {
    requestAnimFrame(tick);
    drawScene();
    animate();
}


function webGLStart() {
    var canvas = document.getElementById("gl-canvas");
    var ctx = canvas.getContext('experimental-webgl');
    
    window.addEventListener('resize', resizeCanvas, false);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // perspective = mat4.create();
        // perspective = mat4.perspective(60, canvas.width / canvas.height, 0.1, 100);
        // perspective[3][3] = 1;
        // perspective = mat4.multiply(perspective,(mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -5, 0, 0, 0, 1)));

        initGL(canvas);
        initTextures();
        initShaders();
        initBuffers();

        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    
    resizeCanvas();

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}
