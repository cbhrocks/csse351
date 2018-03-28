
var canvas;
var gl;
var colorLoc;
var thetaLoc;
var clipLoc;

var vertices = [];
var colors = [];
var indices = [];
var theta = [];

var cubeSize = 10;
var windowMin = -cubeSize / 2.0;
var windowMax = cubeSize + cubeSize/2.0;

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;
var axis = 0;

var clipXform = mat4 ();

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

	// Load vertices and colors for cube faces
	
	vertices = [
	   vec4(0.0, 0.0, cubeSize, 1.0),
	   vec4(0.0, cubeSize, cubeSize, 1.0),
	   vec4(cubeSize, cubeSize, cubeSize, 1.0),
	   vec4(cubeSize, 0.0, cubeSize, 1.0),
	   vec4(0.0, 0.0, 0.0, 1.0),
	   vec4(0.0, cubeSize, 0.0, 1.0),
	   vec4(cubeSize, cubeSize, 0.0, 1.0),
	   vec4(cubeSize, 0.0, 0.0, 1.0)
	];
	 colors = [
	    vec4(1.0, 0.0, 0.0, 1.0),  // red
		vec4(1.0, 1.0, 0.0, 1.0),  // yellow
		vec4(0.0, 1.0, 0.0, 1.0),  // green
		vec4(0.0, 0.0, 1.0, 1.0),  // blue
		vec4(1.0, 0.0, 1.0, 1.0),  // magenta
		vec4(0.0, 1.0, 1.0, 1.0)   // cyan
	];
	
	// Load indices to represent the triangles that will draw each face
	
	indices = [
	   1, 0, 3, 3, 2, 1,  // front face
	   2, 3, 7, 7, 6, 2,  // right face
	   3, 0, 4, 4, 7, 3,  // bottom face
	   6, 5, 1, 1, 2, 6,  // top face
	   4, 5, 6, 6, 7, 4,  // back face
	   5, 4, 0, 0, 1, 5   // left face
	];
	
	theta[0] = 0.0;
	theta[1] = 0.0;
	theta[2] = 0.0;
	
    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
	gl.enable(gl.DEPTH_TEST);
    setWorldCoords (windowMin, windowMax, windowMin, windowMax, windowMin, windowMax);
	
	// Register event listeners for the buttons
	
	var a=document.getElementById ("XButton");
	a.addEventListener ("click", function() { axis = xAxis; });
	var b=document.getElementById ("YButton");
	b.addEventListener ("click", function () { axis = yAxis; });
	var c=document.getElementById ("ZButton");
	c.addEventListener ("click", function () { axis = zAxis; });
	var d=document.getElementById ("Reset");
	d.addEventListener ("click", function () { theta = [0.0, 0.0, 0.0]; axis = xAxis });

    //  Load shaders and initialize attribute buffers
    
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );
    
	colorLoc = gl.getUniformLocation (program, "color");
	thetaLoc = gl.getUniformLocation (program, "theta");
	clipLoc  = gl.getUniformLocation (program, "clipXform");
	
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
	
	var iBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, iBuffer);
	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);
	
    render();
};

function render()
{
    gl.clear( gl.COLOR_BUFER_BIT | gl.DEPTH_BUFFER_BIT);
	theta[axis] += 0.5;
	gl.uniform3fv (thetaLoc, flatten(theta));
	gl.uniformMatrix4fv (clipLoc, false, flatten(clipXform));
	for (var i=0; i<6; i++) {
		gl.uniform4fv (colorLoc, colors[i]);
		gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, 6*i );
	}
	requestAnimFrame (render);
};

function setWorldCoords (xmin, xmax, ymin, ymax, zmin, zmax)
{
	var W = mat4 (1.0, 0.0, 0.0, -xmin,
			  0.0, 1.0, 0.0, -ymin,
			  0.0, 0.0, 1.0, -zmin,
			  0.0, 0.0, 0.0, 1.0);
			  
	var S = mat4 (2.0/(xmax-xmin), 0.0, 0.0, 0.0,
			  0.0, 2.0/(ymax-ymin), 0.0, 0.0,
			  0.0, 0.0, 2.0/(zmax-zmin), 0.0,
			  0.0, 0.0, 0.0, 1.0);
			  
	var C = mat4 (1.0, 0.0, 0.0, -1.0,
			  0.0, 1.0, 0.0, -1.0,
			  0.0, 0.0, 1.0, -1.0,
			  0.0, 0.0, 0.0, 1.0);
	
	clipXform = mult (C, mult(S, W));
};
