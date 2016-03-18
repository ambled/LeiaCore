/**
 * LeiaHeader
 * 
 * Contains and displays version identifier of current LeiaCore.
 *
 */
'use strict';
var VERSION = "0.2.20160318.220915";
console.log("Using LeiaCore version " + VERSION);
var LEIA_startTime = Date.now() * 0.001;

/**
 * LeiaDisplayInfo
 * 
 * Contains physical parameters of current Leia 3D screen.
 * 
 */
function LeiaDisplayInfo(url) {
    this.version = VERSION;
    var self = this;

    function handler() {
        if(this.status == 200){
            var data = JSON.parse(this.responseText);
            self.info = data.info;
        } else {
            throw new Error('LeiaCore: Cannot read file ', url);
        }
    };

    if (url == undefined) {
        throw new Error('LeiaCore: must define configuration file when initializing LeiaDisplay().')
    } else {
        var client = new XMLHttpRequest();
        client.onload = handler;
        client.open('GET', url, false);
        client.send();
    }
}

/**
 * LeiaHoloView
 * 
 * Base class containing the logic for multi-view rendering and displaying.
 *
 */
function LeiaHoloView(leiaDisplay, parameters) {
    var lhv;
    this.RENDER_MODES           = {TILES : 1, SWIZZLE : 2};

    this.setDefaultConfig= function(){
        var defaultLeiaDisplay = {
            "info": {
                "displayType"        : "square",
                "canvasRotation"     : "0deg",
                "physicalDimensions" : {"x":36.8, "y":36.8},
                "displayResolution"  : {"x":1600, "y":1200},
                "numberOfViews"      : {"x": 8, "y":8},
                "maxDisparity"       : 5,
                "emissionPatternR"   : [],
                "emissionPatternG"   : [],
                "emissionPatternB"   : [],
                "deltaView"          : 0.1
            }
        }
        var nvx = defaultLeiaDisplay.info.numberOfViews.x;
        var nvy = defaultLeiaDisplay.info.numberOfViews.y;
        var nvxoffset = (nvx-1.0)/2.0;
        var nvyoffset = (nvy-1.0)/2.0;
        for (var j=0; j<nvy; j++){
            for (var i=0; i<nvx; i++){
                defaultLeiaDisplay.info.emissionPatternR.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaView ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaView});
                defaultLeiaDisplay.info.emissionPatternG.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaView ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaView});
                defaultLeiaDisplay.info.emissionPatternB.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaView ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaView});
            }
        }
        this.configHasChanged = false;
        this.defineNonPhysicalParameters();
        this.setLeiaConfig(defaultLeiaDisplay);
    };

    this.setLeiaConfig= function(leiaDisplay){
        this.modes                  = {};
        this.multiViewParameters    = {};
        this.mvp                    = this.multiViewParameters;
        var info                    = leiaDisplay.info;
        this.mvp.displayType        = info.displayType;
        switch (this.mvp.displayType){
            case "square":
            case "diamondLandscape":
            case "diamondPortrait":
                this.MULTIVIEW_MODES = { FLAT : 'flat', TVH : 'twoViewHorizontal', BASIC : 'basic', SS4X : 'supersample4x'};
                break;
            default:
                this.MULTIVIEW_MODES = { BASIC : 'basic'};
        }
        this.mvp.canvasRotation     = info.canvasRotation;
        this.mvp.physicalDimensions = new THREE.Vector2(info.physicalDimensions.x, info.physicalDimensions.y);
        this.mvp.displayResolution  = new THREE.Vector2(info.displayResolution.x, info.displayResolution.y);
        this.mvp.aspectRatio        = info.displayResolution.x/info.displayResolution.y;
        this.mvp.numberOfViews      = new THREE.Vector2(info.numberOfViews.x, info.numberOfViews.y);
        var viewResX                = this.mvp.displayResolution.x / this.mvp.numberOfViews.x;
        var viewResY                = this.mvp.displayResolution.y / this.mvp.numberOfViews.y;
        this.mvp.viewResolution     = new THREE.Vector2(viewResX, viewResY);
        switch (this.mvp.displayType){
            case "square":
                this.mvp.tileResolution = new THREE.Vector2(viewResX, viewResY);
                break;
            case "diamondLandscape":
                this.mvp.tileResolution = new THREE.Vector2(2*viewResX, viewResY);
                break;
            case "diamondPortrait":
                this.mvp.tileResolution = new THREE.Vector2(viewResX, 2*viewResY);
                break;
            default:
                console.log('FATAL ERROR: unknown display Type');
        }
        this._width                 = info.physicalDimensions.x;
        this._height                = info.physicalDimensions.x/this.mvp.aspectRatio;
        this.deltaView              = info.deltaView;
        this._maxDisparity          = info.maxDisparity ;
        this.emissionPatternG       = leiaDisplay.info.emissionPatternG;
        this.configHasChanged       = true;

        this.updateNonPhysicalParameters();
        this.init()
    };

    this.defineNonPhysicalParameters= function(){
        this.version                = VERSION;
        this.projectionMatrices     = [];
        this._holoScreenCenter      = new THREE.Vector3(0, 0, 0);   // screen center location
        this._normal                = new THREE.Vector3(0, 0, 1);   // screen normal: unit vector pointing from the screen center to the camera array center
        this._up                    = new THREE.Vector3(0, 1, 0);   // positive vertical direction of the screen: y axis
        this.cameraShift            = new THREE.Vector2(0, 0);      // shift of the camera block with respect to its center
        this._baselineScaling       =    1.0;                       // stretch factor of the camera array
        this._distanceExponent      =    1.0;                       // stretch factor of the camera array
        this.currentMode            =   null;                       // needs to be set by renderer
        this.updateNonPhysicalParameters();
    };

    this.updateNonPhysicalParameters = function() {
        this._ScreenCameraDistance  = this._width*Math.exp(this._distanceExponent * Math.log(10.0));
        this._fov                   = 2*Math.atan(this._width/(2*this._ScreenCameraDistance));
        this._cameraCenterPosition  = new THREE.Vector3(0,0,this._ScreenCameraDistance);
        this._baseline              = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane             = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane              = ( (this._maxDisparity>=this._baseline)? -20000 :-(this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity)));
        this._matricesNeedUpdate    =   true;                      // matrices will be generated upon first render
        lhv = this;
    };

    function multiViewMode(parameters) {
        this.modeId                 = null;     // name/identifier of the current mode
        this.deltaView              = null;     // difference between adjacent views
        this.viewDirections         = null;     // emission Pattern of this mode (typically the green channel specified in the display configuration file.)
        this.matrix                 = null;     // blurring/sharpening kernel
        this.matrixTileStep         = null;     // view spacing when applying the kernel: 0.5 means supersampled grid, 1 means normal grid.
        this.numberOfTiles          = null;     // number of tiles that are rendered in this mode
        this.numberOfTilesOnTexture = null;     // number of tiles that are rendered on each texture
        this.numberOfTextures       = null;     // number of textures necessary to render all tiles.
        this.DEBUG_FRAGMENTSHADER   = false;

        this.initFlatCamera  = function( parameters) {
            this.deltaView              =   0.0;
            this.numberOfTiles          =   new THREE.Vector2(1, 1);
            this.numberOfTilesOnTexture =   this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
            this.viewDirections.push(new THREE.Vector3(0, 0, 1));
        };

        this.initBasicCamera = function(parameters) {
            this.deltaView              =   lhv.deltaView;
            this.numberOfTiles          = lhv.multiViewParameters.numberOfViews;
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
            var emissionPattern = lhv.emissionPatternG;
            for (var q=0; q<emissionPattern.length; q++){
                this.viewDirections.push(new THREE.Vector3(emissionPattern[q].x, emissionPattern[q].y, 1));
            }
        };

        this.initHPOCamera = function(parameters) {
            this.numberOfTiles          = new THREE.Vector2(lhv.multiViewParameters.numberOfViews.x, 1);
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
        };

        this.initVPOCamera = function(parameters) {
            this.numberOfTiles          = new THREE.Vector2(1, lhv.multiViewParameters.numberOfViews.y);
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
        };

        this.initTVHCamera = function(parameters) {
            this.numberOfTiles          = new THREE.Vector2(2, 1);
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
            var emissionPattern = lhv.emissionPatternG;
            var nViews  = new THREE.Vector2(lhv.multiViewParameters.numberOfViews.x, lhv.multiViewParameters.numberOfViews.y);
            var xleft   = nViews.x/2-1;
            var xright  = nViews.x/2;
            var yabove  = nViews.y/2;
            var ybelow  = nViews.y/2-1;
            var posA    = emissionPattern[nViews.x*yabove+xleft];
            var posB    = emissionPattern[nViews.x*yabove+xright];
            var posC    = emissionPattern[nViews.x*ybelow+xleft];
            var posD    = emissionPattern[nViews.x*ybelow+xright];
            var leftPos = {
                x: 0.5*(posA.x + posC.x),
                y: 0.5*(posA.y + posC.y)
            };
            var rightPos = {
                x: 0.5*(posB.x + posD.x),
                y: 0.5*(posB.y + posD.y)
            };
            this.viewDirections.push(new THREE.Vector3(leftPos.x, leftPos.y, 1));
            this.viewDirections.push(new THREE.Vector3(rightPos.x, rightPos.y, 1));
        };

        this.initTVVCamera = function(parameters) {
            this.numberOfTiles          = new THREE.Vector2(1, 2);
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       = 1;
            this.matrix                 = [[1]];
            this.matrixTileStep         = new THREE.Vector2(1, 1);
        };

        this.initSS2XCamera = function(parameters) {
            this.numberOfTiles          = lhv.multiViewParameters.numberOfViews;
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       = 1;
            this.matrix                 = [[1]];
            this.matrixTileStep         = new THREE.Vector2(1, 1);
        };

        this.initSS4XCamera = function(parameters) {
            var ntx                     = 2*lhv.multiViewParameters.numberOfViews.x + 1;
            var nty                     = 2*lhv.multiViewParameters.numberOfViews.y + 1;
            this.numberOfTiles          = new THREE.Vector2(ntx, nty);
            this.numberOfTilesOnTexture = this.numberOfTiles;
            this.numberOfTextures       = 1;
            var a =  0.7;
            var b =  0.125;
            var c = -0.05;
            this.matrix                 = [[c, b, c], [b, a, b], [c, b, c]];
            this.matrixTileStep         = new THREE.Vector2(0.5, 0.5);
            var emissionPattern = lhv.emissionPatternG;
            for (var viewIdY=0; viewIdY<this.numberOfTiles.y; viewIdY++){
                for (var viewIdX=0; viewIdX<this.numberOfTiles.x; viewIdX++){
                    this.viewDirections.push(this.computeSS4XPosition(emissionPattern, {x:viewIdX, y:viewIdY}));
                }
            }
        };

        this.computeSS4XPosition = function(emPat, gridIndex){
            var pos         = {x:0, y:0, z:1};
            var nViews      = new THREE.Vector2(lhv.multiViewParameters.numberOfViews.x, lhv.multiViewParameters.numberOfViews.y);
            var nTiles      = new THREE.Vector2(2*nViews.x+1, 2*nViews.y+1);
            var origIndex   = new THREE.Vector2(gridIndex.x/2-0.5, gridIndex.y/2-0.5);
            if ( ((gridIndex.x%2)==1)&&((gridIndex.y%2)==1) ) {
                var emPatId = nViews.x*origIndex.y+origIndex.x;
                pos = emPat[emPatId];
            } else {
                var xmin = Math.floor(origIndex.x);
                var ymin = Math.floor(origIndex.y);
                var xmax = Math.ceil(origIndex.x);
                var ymax = Math.ceil(origIndex.y);
                if (xmin < 0)            { xmin = xmax + 1; }
                if (xmax > (nViews.x-1)) { xmax = xmin - 1; }
                if (ymin < 0)            { ymin = ymax + 1; }
                if (ymax > (nViews.y-1)) { ymax = ymin - 1; }

                var idA = {x: xmin, y: ymin};
                var idB = {x: xmax, y: ymin};
                var idC = {x: xmin, y: ymax};
                var idD = {x: xmax, y: ymax};

                var emPatIdA = nViews.x*idA.y + idA.x;
                var emPatIdB = nViews.x*idB.y + idB.x;
                var emPatIdC = nViews.x*idC.y + idC.x;
                var emPatIdD = nViews.x*idD.y + idD.x;

                var emPatA = emPat[emPatIdA];
                var emPatB = emPat[emPatIdB];
                var emPatC = emPat[emPatIdC];
                var emPatD = emPat[emPatIdD];
                if (xmin>xmax){
                    if (origIndex.x < 0){
                        pos.x = 0.25*(3*emPatB.x - emPatA.x + 3*emPatD.x - emPatC.x);
                    } else {
                        pos.x = 0.25*(3*emPatA.x - emPatB.x + 3*emPatC.x - emPatD.x);
                    }
                } else {
                    pos.x = 0.25*(emPatA.x + emPatB.x + emPatC.x + emPatD.x);
                }
                if (ymin>ymax){
                    if (origIndex.y < 0) {
                        pos.y = 0.25*(3*emPatC.y - emPatA.y + 3*emPatD.y - emPatB.y);
                    } else {
                        pos.y = 0.25*(3*emPatA.y - emPatC.y + 3*emPatB.y - emPatD.y);
                    }
                } else {
                    pos.y = 0.25*(emPatA.y + emPatB.y + emPatC.y + emPatD.y);
                }

            }
            return new THREE.Vector3(pos.x, pos.y, pos.z);
        };

        this.composeVertexShader = function(renderMode) {
            return this.composeStandardVertexShader(renderMode);
        };

        this.composeFragmentShader = function(renderMode) {
            var fragmentShader = "";
            switch (lhv.multiViewParameters.displayType) {
                case "square"  :
                case "diamondLandscape" :
                case "diamondPortrait" :
                    fragmentShader = this.composeStandardFragmentShader(renderMode);
                    break;
                default:
                    fragmentShader = this.composeTileViewFragmentShader(renderMode);
                    console.log('LeiaCore: unknown display type. Please use official display configuration files only.');
            }
            return fragmentShader;
        };

        this.composeStandardVertexShader = function(renderMode) {
            var vertexShader  = "varying vec2 vUv;\n"+
                                "void main() {\n"+
                                "    vUv = uv;\n"+
                                "    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n"+
                                "}\n";
            return vertexShader;
        };

        this.composeTileViewFragmentShader = function(renderMode) {
            var fragmentShader  = "varying vec2 vUv;\n";
            fragmentShader     +=  "uniform sampler2D tTexture0;\n";
            fragmentShader     +=  "void main() {\n";
            fragmentShader     += "  gl_FragColor = texture2D(tTexture0, vUv);\n";
            fragmentShader     += "}\n";
            return fragmentShader;
        };

        this.composeStandardFragmentShader = function(renderMode) {
            var mvp             = lhv.multiViewParameters;
            var displayType     = mvp.displayType;
            var canvasRotation  = mvp.canvasRotation;
            var fragmentShader  = "varying vec2 vUv;\n";
            fragmentShader     += "uniform sampler2D tTexture0;\n";
            fragmentShader     += "vec2 pixelCoord, sPixId, viewId;\n";
            switch (displayType){
                case "diamondLandscape" :
                case "diamondPortrait" :
                    fragmentShader += "float parityId;\n";
                    break;
            }
            fragmentShader     += "void idPixel() {\n" ;
            fragmentShader     += "  pixelCoord = vec2(";
            switch (canvasRotation) {
                case "0deg":
                    fragmentShader += "floor(vUv.s*"+mvp.displayResolution.x.toFixed(1)+"),floor((vUv.t)*"+mvp.displayResolution.y.toFixed(1)+")";
                    break;
                case "90deg":
                    fragmentShader += "floor(max(0.0, (1.0-vUv.t))*"+mvp.displayResolution.x.toFixed(1)+"),floor((vUv.s)*"+mvp.displayResolution.y.toFixed(1)+")";
                    break;
                default:
                    console.log('Warning: wrong canvas rotation setting in configuration file. Please use official LEIA configuration files only.');
            }
            fragmentShader     += ");\n";
            if (renderMode === lhv.RENDER_MODES.SWIZZLE) {
                fragmentShader += "  sPixId = vec2(floor(pixelCoord.s/"+mvp.numberOfViews.x.toFixed(1)+"),floor(pixelCoord.t/"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                fragmentShader += "  viewId = vec2(mod(pixelCoord.s,"+mvp.numberOfViews.x.toFixed(1)+"),mod(pixelCoord.t,"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                switch (displayType) {
                    case "diamondLandscape":
                        fragmentShader += "  parityId = 1.0 - mod(sPixId.t, 2.0);\n";
                        fragmentShader += "  if (parityId == 1.0) {\n";
                        fragmentShader += "    sPixId = vec2( floor(max(0.0, max(0.0, (pixelCoord.s-"+(mvp.numberOfViews.x/2.0).toFixed(1)+")))/"+mvp.numberOfViews.x.toFixed(1)+"), floor(pixelCoord.t/"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                        fragmentShader += "    viewId = vec2(   mod(max(0.0, max(0.0, (pixelCoord.s-"+(mvp.numberOfViews.x/2.0).toFixed(1)+"))),"+mvp.numberOfViews.x.toFixed(1)+"),   mod(pixelCoord.t,"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                        fragmentShader += "  }\n";
                        break;
                    case "diamondPortrait":
                        fragmentShader += "  parityId = mod(sPixId.s, 2.0);\n";
                        fragmentShader += "  if (parityId == 1.0) {\n";
                        fragmentShader += "    sPixId = vec2( floor(pixelCoord.s/"+mvp.numberOfViews.x.toFixed(1)+"), floor(max(0.0, max(0.0, (pixelCoord.t-"+(mvp.numberOfViews.y/2.0).toFixed(1)+")))/"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                        fragmentShader += "    viewId = vec2(   mod(pixelCoord.s,"+mvp.numberOfViews.x.toFixed(1)+"),   mod(max(0.0, max(0.0, (pixelCoord.t-"+(mvp.numberOfViews.y/2.0).toFixed(1)+"))),"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                        fragmentShader += "  }\n";
                        break;
                }
            } else {
                fragmentShader += "  sPixId = vec2(mod(pixelCoord.s,"+mvp.viewResolution.x.toFixed(1)+"),mod(pixelCoord.t, "+mvp.viewResolution.y.toFixed(1)+") );\n";
                fragmentShader += "  viewId = vec2(floor(pixelCoord.s/"+mvp.viewResolution.x.toFixed(1)+"),floor(pixelCoord.t/"+mvp.viewResolution.y.toFixed(1)+") );\n";
            }
            fragmentShader     +=  "}\n";
            fragmentShader     +=  "vec4 getPixel( in vec2 view, in vec2 sPix";
            switch (displayType){
                case "diamondLandscape" :
                case "diamondPortrait" :
                    fragmentShader += ", in float parity";
                    break;
            }
            fragmentShader     +=  ") {\n";

            switch(this.modeId) {
                case lhv.MULTIVIEW_MODES.FLAT:
                    fragmentShader +=  "  vec2 viewPos = vec2(0, 0);\n";
                    break;
                case lhv.MULTIVIEW_MODES.TVH:
                    var center      =  mvp.numberOfViews.x/2;
                    fragmentShader +=  "  vec2 viewPos;\n";
                    fragmentShader +=  "  if (viewId.s<"+center.toFixed(1)+") {\n";
                    fragmentShader +=  "    viewPos = vec2(0, 0);\n";
                    fragmentShader +=  "  } else {\n";
                    fragmentShader +=  "    viewPos = vec2(1, 0);\n";
                    fragmentShader +=  "  }\n";
                    break;
                case lhv.MULTIVIEW_MODES.BASIC:
                    fragmentShader +=  "  vec2 viewPos = viewId;\n";
                    break;
                case lhv.MULTIVIEW_MODES.SS4X:
                    var maxId = new THREE.Vector2(this.numberOfTiles.x-1, this.numberOfTiles.y-1);
                    fragmentShader +=  "  vec2 viewPos = vec2(1.0, 1.0) + 2.0*view;\n";
                    fragmentShader +=  "  viewPos = vec2( min("+maxId.x.toFixed(1)+", max(0.0, viewPos.s)), min("+maxId.y.toFixed(1)+", max(0.0, viewPos.t)) );\n";
                    break;
                default:
                    throw new Error('Error: fragment shader not implemented for mode ['+this.modeId+']. Initializing flat shader');
                    fragmentShader += "  vec2 viewPos = vec2(0, 0);\n";
            }

            var fraction = {
                x : 1.0/(mvp.tileResolution.x * this.numberOfTiles.x),
                y : 1.0/(mvp.tileResolution.y * this.numberOfTiles.y)
            };
            fragmentShader     += "  vec4 res = vec4(1.0, 0.0, 0.0, 1.0);\n";
            switch (displayType){
                case "square":
                    fragmentShader +=  "  vec2 id = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader +=  "  res = texture2D( tTexture0, id );\n";
                    break;
                case "diamondLandscape":
                    fragmentShader += "  vec2 idA = vec2( "+fraction.x.toFixed(8)+"*(2.0*sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  vec2 idB;\n";
                    fragmentShader += "  if (parity == 1.0) {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(2.0*sPix.s+0.5+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  } else {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(max(0.0, 2.0*sPix.s-0.5)+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  }\n";
                    fragmentShader += "  res = 0.5 * ( texture2D( tTexture0, idA) + texture2D( tTexture0, idB) ); \n";
                    break;
                case "diamondPortrait":
                    fragmentShader += "  vec2 idA = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(2.0*sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  vec2 idB;\n";
                    fragmentShader += "  if (parity == 1.0) {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(2.0*sPix.t+0.5+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  } else {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(max(0.0, 2.0*sPix.t-0.5)+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  }\n";
                    fragmentShader += "  res = 0.5 * ( texture2D( tTexture0, idA) + texture2D( tTexture0, idB) ); \n";
                    break;
                default:
                    console.log('Warning: display type in configuration file. Please use official LEIA configuration files only.');
            }
            if (this.DEBUG_FRAGMENTSHADER){
                var coeffX = 0.13;
                var coeffY = 0.09;
                fragmentShader     += "  res = res + vec4("+coeffX.toFixed(2)+"*mod(sPix.s, 3.0), "+coeffY.toFixed(2)+"*mod(sPix.t,3.0), 0.0, 0.0); \n";
                fragmentShader     += "  if ( sPix == vec2(0.0, 0.0) ) { res = vec4(0.0, 1.0, 1.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(0.0, 1.0) ) { res = vec4(0.5, 0.5, 0.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(1.0, 0.0) ) { res = vec4(0.0, 0.5, 0.5, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(1.0, 1.0) ) { res = vec4(1.0, 1.0, 0.0, 0.0); }\n";

                fragmentShader     += "  if ( sPix == vec2(3.0, 3.0) ) { res = vec4(1.0, 0.0, 1.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(3.0, 4.0) ) { res = vec4(1.0, 0.5, 0.5, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(3.0, 5.0) ) { res = vec4(0.6, 0.4, 0.0, 0.0); }\n";

                fragmentShader     += "  if ( sPix == vec2(4.0, 3.0) ) { res = vec4(0.5, 0.0, 1.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(4.0, 4.0) ) { res = vec4(1.0, 1.0, 0.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(4.0, 5.0) ) { res = vec4(0.0, 0.4, 0.6, 0.0); }\n";

                fragmentShader     += "  if ( sPix == vec2(5.0, 3.0) ) { res = vec4(0.5, 1.0, 0.0, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(5.0, 4.0) ) { res = vec4(1.0, 0.2, 0.3, 0.0); }\n";
                fragmentShader     += "  if ( sPix == vec2(5.0, 5.0) ) { res = vec4(0.0, 1.0, 1.0, 0.0); }\n";
            }
            fragmentShader     += "  return res;\n";
            fragmentShader     +=  "}\n";
            fragmentShader     +=  "void main() {\n";
            fragmentShader     +=  "  idPixel();\n";

            var shaderMatrix = this.matrix;
            var myMax = shaderMatrix.length;
            var mvsx  = this.matrixTileStep.x;
            var mvsy  = this.matrixTileStep.y;
            var mcy   = (myMax-1)/2;
            fragmentShader += "  vec4 pixelRGBA = ";
            if ((myMax % 2) == 0) {
                throw new Error('Cannot compute fragment shader for mode ['+this.modeId+']. Matrix needs to be of dimension (2n+1)x(2m+1); e.g 1x1, 1x3, 3x5, 7x3, etc.')
            }
            for (var myid=0; myid<myMax; myid++){
                var mxMax = shaderMatrix[myid].length;
                if ((mxMax % 2) == 0) {
                    throw new Error('Cannot compute fragment shader for mode ['+this.modeId+']. Matrix needs to be of dimension (2n+1)x(2m+1); e.g 1x1, 1x3, 3x5, 7x3, etc.')
                }
                var mcx = (mxMax-1)/2;
                for (var mxid=0; mxid<mxMax; mxid++){
                    var m = shaderMatrix[myid][mxid];
                    var vsx = mvsx*(mxid-mcx);
                    var vsy = mvsy*(myid-mcy);
                    var viewShiftX = "";
                    var viewShiftY = "";
                    if (Math.abs(vsx)>0) viewShiftX = ((vsx<0)?"":"+") + vsx.toFixed(2);
                    if (Math.abs(vsy)>0) viewShiftY = ((vsy<0)?"":"+") + vsy.toFixed(2);
                    if (Math.abs(m)>0){
                        if ((vsx == 0)&&(vsy==0)) {
                            fragmentShader += "+"+m.toFixed(3)+"*getPixel(viewId, sPixId";
                        } else {
                            fragmentShader += "+"+m.toFixed(3)+"*getPixel(vec2(viewId.s"+viewShiftX+", viewId.t"+viewShiftY+"), sPixId";
                        }
                        switch (displayType){
                            case "diamondLandscape":
                            case "diamondPortrait":
                                fragmentShader += ", parityId";
                                break;
                        }
                        fragmentShader += ")";
                    }
                }
            }
            fragmentShader     += ";\n";
            fragmentShader     += "  gl_FragColor = pixelRGBA;\n";
            fragmentShader     += "}\n";
            return fragmentShader;
        };

        this.init = function (parameters) {
            if (parameters === undefined) {
                throw new Error('multiViewMode needs to be instantiated with parameters. Please see examples.')
            }
            this.viewDirections = [];
            this.modeId = parameters.modeId;

            switch (parameters.modeId) {
                case lhv.MULTIVIEW_MODES.FLAT   : this.initFlatCamera(parameters);   break;
                case lhv.MULTIVIEW_MODES.HPO    : this.initHPOCamera(parameters);    break;
                case lhv.MULTIVIEW_MODES.VPO    : this.initVPOCamera(parameters);    break;
                case lhv.MULTIVIEW_MODES.TVH    : this.initTVHCamera(parameters);    break;
                case lhv.MULTIVIEW_MODES.TVV    : this.initTVVCamera(parameters);    break;
                case lhv.MULTIVIEW_MODES.BASIC  : this.initBasicCamera(parameters);  break;
                case lhv.MULTIVIEW_MODES.SS2X   : this.initSS2XCamera(parameters);   break;
                case lhv.MULTIVIEW_MODES.SS4X   : this.initSS4XCamera(parameters);   break;
            }
        };

        this.init(parameters);
    };


    this.checkUpdate = function() {
        if (this._matricesNeedUpdate){
            this.updateProjectionMatrices();
            this._matricesNeedUpdate = false;
        }
    };

    this.calculateProjectionMatrix = function(camPosition) {
        // camPosition is the XY position of sub-camera relative to the camera array center
        var D = this._ScreenCameraDistance;
        var X = {min: -0.5 * this._width, max: 0.5 * this._width};
        var Y = {min: -0.5 * this._height, max: 0.5 * this._height};

        // putting the max here ensures that the nearPlane is between the camera plane and the holo plane
        var Z = {max: D-this._farPlane, min: Math.max(D-this._nearPlane,0)};

        var projectionMatrix = new THREE.Matrix4();

        var m11 = (2*D) / (X.max - X.min);
        var m22 = (2*D) / (Y.max - Y.min);
        var m13 = (X.max + X.min - 2 * camPosition.x) / (X.max - X.min);
        var m23 = (Y.max + Y.min - 2 * camPosition.y) / (Y.max - Y.min);
        var m14 = -(2*D * camPosition.x) / (X.max - X.min);
        var m24 = -(2*D * camPosition.y) / (Y.max - Y.min);
        var m33 = -(Z.max + Z.min) / (Z.max - Z.min);
        var m34 = -2 * Z.max * Z.min / (Z.max - Z.min);

        projectionMatrix.set(
            m11,   0,  m13,  m14,
            0,   m22,  m23,  m24,
            0,     0,  m33,  m34,
            0,     0,   -1,    0
        );

        return projectionMatrix;
    };

    this.updateProjectionMatrices = function() {
        this.projectionMatrices = [];
        var nx = this.currentMode.numberOfTiles.x;  // number of cameras along x direction
        var ny = this.currentMode.numberOfTiles.y;  // number of cameras along y direction

        var distanceToScreen    = this._ScreenCameraDistance;  // unit: webgl
        var baselineScaling     = this._baselineScaling;
        var stretchFactor       = distanceToScreen*baselineScaling;
        var camShiftX = this.cameraShift.x;
        var camShiftY = this.cameraShift.y;

        for (var j = 0; j < ny; j++) {
            for (var i = 0; i < nx; i++) {
                var idx = nx*j + i;
                var camPosition = {
                    x: stretchFactor*this.currentMode.viewDirections[idx].x - camShiftX,
                    y: stretchFactor*this.currentMode.viewDirections[idx].y - camShiftY
                };
                var projectionMatrix = this.calculateProjectionMatrix(camPosition);
                this.projectionMatrices.push(projectionMatrix);
            }
        }
    };

    this.setMode = function(mode) {
        if (mode == undefined){
            mode = lhv.MULTIVIEW_MODES.BASIC;
        }
        this.currentMode = this.modes[mode];
        this._matricesNeedUpdate = true;
    };


    this.init = function(leiaDisplay, parameters) {
        for (var mode in lhv.MULTIVIEW_MODES){
            this.modes[lhv.MULTIVIEW_MODES[mode]] = new multiViewMode({ modeId: lhv.MULTIVIEW_MODES[mode]} );
        }
    };

    if (leiaDisplay == undefined) {
        this.setDefaultConfig();
    } else {
        this.setLeiaConfig(leiaDisplay);
    }
    this.init(leiaDisplay, parameters);
}

/**
 * LeiaHoloCamera
 *
 * Multi-view camera, derived from LeiaHoloView
 * 
 */
function LeiaHoloCamera(parameters){
    this._position              = new THREE.Vector3(0,0,this._ScreenCameraDistance);
    this._lookAtVector          = new THREE.Vector3(0,0,0);

    this._updateVectors= function(){
        this._up.normalize();
        this._holoScreenCenter.copy(this._lookAtVector);
        this._cameraCenterPosition.copy(this._position);
        this._normal.copy( ( (new THREE.Vector3()).subVectors(this._position,this._lookAtVector) ).normalize() );
        this._ScreenCameraDistance=((new THREE.Vector3()).subVectors(this._position,this._lookAtVector)).length();
        this._updateIntrinsicParametersAfterDistanceChange();
    };

    this.setCameraAtDistance= function(newDistance){
        this._ScreenCameraDistance= newDistance;
        this._position.copy((((new THREE.Vector3()).copy(this._normal)).multiplyScalar(this._ScreenCameraDistance)).add(this._lookAtVector));
        this._cameraCenterPosition.copy(this._position);
        this._updateIntrinsicParametersAfterDistanceChange();
    };

    this._updateIntrinsicParametersAfterDistanceChange=function(){
        this._width               = 2*Math.tan(this._fov/2)*(this._ScreenCameraDistance);
        this._height              = this._width/this.mvp.aspectRatio;
        this._baseline            = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane           = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane            = ( (this._maxDisparity > this._baseline)? -20000 : -this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity) );
        this._matricesNeedUpdate  = true;
    };

    this.setBaselineScaling= function(newBaselineScaling){ // not used for screen based rendering.
        this._baselineScaling     = newBaselineScaling;
        this._baseline            = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane           = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane            = ( (this._maxDisparity > this._baseline)? -20000 : -this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity) );
        this._matricesNeedUpdate  = true;
    };

    this.setFOV = function(newFOV){
        this._fov = newFOV;
        this.setCameraAtDistance(this._width/(2*Math.tan(this._fov/2)));
    };

    this.lookAt= function (newLookAt){
        this._lookAtVector.copy(newLookAt);
        this._updateVectors();
    };

    this.setWidth=function(newWidth){
        this.setCameraAtDistance(newWidth/(2*Math.tan(this._fov/2)));
    };

    this.setPosition=function(newPosition){
        var oldThirdVector = new THREE.Vector3().crossVectors(this._normal,this._up);
        this._normal.copy(newNormal);
        var upProjectionOnNormal=((new THREE.Vector3()).copy(this._normal)).multiplyScalar(this._normal.dot(new THREE.Vector3(0,1,0)));
        if (upProjectionOnNormal.length() > 0.999999){
            this._up.copy(new THREE.Vector3().crossVectors(oldThirdVector,this._normal));
        }
        else{
            this._up.subVectors(new THREE.Vector3(0,1,0),upProjectionOnNormal);
        }
        this._updateVectors();
    };

    this.setUp=function(newUp){
        this._up.copy(newUp);
        this._updateVectors()
    };
}
LeiaHoloCamera.prototype = new LeiaHoloView();

/**
 * LeiaHoloScreen
 *
 * Leia 3D screen, derived from LeiaHoloView.
 * 
 */
function LeiaHoloScreen(leiaDisplayInfo){
    this._position              = new THREE.Vector3(0,0,0);

    this.setPosition=function(newPosition){
        this._position.copy(newPosition);
        this._updateVectors();
    }

    this.setUp=function(newUp){
        this._up.copy(newUp);
        this._updateVectors()
    }

    this.setNormal=function(newNormal){
        var oldThirdVector = new THREE.Vector3().crossVectors(this._normal,this._up);
        this._normal.copy(newNormal);
        var upProjectionOnNormal=((new THREE.Vector3()).copy(this._normal)).multiplyScalar(this._normal.dot(new THREE.Vector3(0,1,0)));
        if (upProjectionOnNormal.length()>=0.999999){
            this._up.copy(new THREE.Vector3().crossVectors(oldThirdVector,this._normal));
        }
        else{
            this._up.subVectors(new THREE.Vector3(0,1,0),upProjectionOnNormal);
        }
        this._updateVectors();
    }

    this._updateVectors= function(){
        this._up.normalize();
        this._normal.normalize();
        this._holoScreenCenter.copy(this._position);
        this._cameraCenterPosition= new THREE.Vector3();
        this._cameraCenterPosition.copy(this._normal);
        this._cameraCenterPosition.multiplyScalar(this._ScreenCameraDistance);
        this._cameraCenterPosition.add(this._holoScreenCenter);
    }

   this._updateIntrinsicParameters= function(){
        this._height              = this._width/this.mvp.aspectRatio;
        this._ScreenCameraDistance  = this._width*Math.exp(this._distanceExponent * Math.log(10.0));
        this._fov                 = 2.0*Math.atan(this._width/(2.0*this._ScreenCameraDistance));
        this._baseline            = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane           = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane            = ( (this._maxDisparity>=this._baseline)? -20000 :-(this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity))); // math formula
        this._matricesNeedUpdate  = true;
   }

    this.setWidth= function(newWidth){
        this._width = newWidth;
        this._updateIntrinsicParameters();
        this._cameraCenterPosition= new THREE.Vector3();
        this._cameraCenterPosition.copy(this._normal);
        this._cameraCenterPosition.multiplyScalar(this._ScreenCameraDistance);
        this._cameraCenterPosition.add(this._holoScreenCenter);
    }

    this.setFOV= function (newFOV){
        this._fov= newFOV;
        this._updateIntrinsicParameters();
        this._cameraCenterPosition= new THREE.Vector3();
        this._cameraCenterPosition.copy(this._normal);
        this._cameraCenterPosition.multiplyScalar(this._ScreenCameraDistance);
        this._cameraCenterPosition.add(this._holoScreenCenter);
    }

    this.getBaselineScaling= function(){
        return this._baselineScaling;
    }

    this.setBaselineScaling= function(newBaselineScaling){
        this._baselineScaling= newBaselineScaling;
        this.updateNonPhysicalParameters();
    }

    this.getDistanceExponent = function(){
        return this._distanceExponent;
    }

    this.getScreenCameraDistance= function(){
        return this._ScreenCameraDistance;
    }

    this.setDistanceExponent = function(newDistanceExponent){
        this._distanceExponent = newDistanceExponent;
        this.updateNonPhysicalParameters();
    }

    this.setDistanceScaling= function(newDistanceScaling){
        this._distanceScaling= newDistanceScaling;
        this._updateIntrinsicParameters();
        this._cameraCenterPosition= new THREE.Vector3();
        this._cameraCenterPosition.copy(this._normal);
        this._cameraCenterPosition.multiplyScalar(this._ScreenCameraDistance);
        this._cameraCenterPosition.add(this._holoScreenCenter);
    }

    if (leiaDisplayInfo != undefined) {
        this.setLeiaConfig(leiaDisplayInfo)
    }
   
}
LeiaHoloScreen.prototype = new LeiaHoloView();

/**
 * LeiaRenderer
 * 
 * Replaces default three.js rendering function and outputs the 3D image to the screen.
 * 
 */
function LeiaRenderer(leiaHoloObject, parameters) {
    this.setParameters= function(){
        this.leiaHoloObject        = leiaHoloObject;
        this.aspectRatio           = this.leiaHoloObject.mvp.aspectRatio;
        this.version               = VERSION;
        this.width                 = this.leiaHoloObject.mvp.displayResolution.x;
        this.height                = this.leiaHoloObject.mvp.displayResolution.y;
        this.canvasWidth           = null;
        this.canvasHeight          = null;
        this.currentModeId         = this.leiaHoloObject.MULTIVIEW_MODES.BASIC;
        this.renderMode            = this.leiaHoloObject.RENDER_MODES.SWIZZLE;
        this.updateTextureSettings = true;
        this.updateShaders         = true;
        this.debugMode             = false;
        this.isAnimating           = true;
        this.outputScene           = new THREE.Scene;
        this.outputGeometry        = new THREE.PlaneGeometry(this.width, this.height);
        this.outputMesh            = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.currentShaderMaterial)
        this.shifterCookie         = null;
        this.canvasShift           = null;
        this.canvasRotation        = this.leiaHoloObject.mvp.canvasRotation;
        this.orthoCamera           = new THREE.OrthographicCamera(this.width / -2, this.width / 2, this.height / 2, this.height / -2, -1, 1);
        this.cannedScene           = new THREE.Scene();
        this.emptyScene            = new THREE.Scene();
        this.runningTimer          = Date.now() * 0.001;
        this.timer                 = 0;
        this.textures              = null;
        this.video                 = null;
        this.videotexture          = null;
        this.leiaHoloObject.configHasChanged=false;
    };

    this.setMultiViewMode = function(multiViewMode){
        this.currentModeId          = multiViewMode;
        this.updateTextureSettings  = true;
    };

    this.getMultiViewMode = function(){
        return this.currentModeId;
    };

    this.setRenderMode = function(renderMode){
        this.renderMode             = renderMode;
        this.updateShaderMaterial   = true;
    };

    this.getRenderMode = function(){
        return this.renderMode;
    };

    this.setCannedImage = function(multiViewMode, url){
        this.setMultiViewMode(multiViewMode);
        leiaHoloObject.setMode(this.currentModeId);
        console.log('LeiaCore: Preparing shaders for render mode ['+this.leiaHoloObject.currentMode.modeId+'].');
        this.textures    = [];
        var cm           = this.leiaHoloObject.currentMode;
        var mvp          = this.leiaHoloObject.multiViewParameters;
        var textureSizeX = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
        var textureSizeY = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;

        for (var textureNumber = 0; textureNumber<cm.numberOfTextures; textureNumber++) {
            this.textures[textureNumber] = new THREE.WebGLRenderTarget(textureSizeX, textureSizeY, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });
        }
        this.prepareShaderMaterial(this.leiaHoloObject)
        this.renderer.shadowMap.enabled = true;
        this.updateTextureSettings      = false;
        var backgroundPlaneTexture      = new THREE.ImageUtils.loadTexture(url);
        backgroundPlaneTexture.wrapS    = backgroundPlaneTexture.wrapT = THREE.RepeatWrapping;
        backgroundPlaneTexture.repeat.set(1, 1);

        var views           = this.leiaHoloObject.currentMode.numberOfTiles;
        var cm              = this.leiaHoloObject.currentMode;
        var mvp             = this.leiaHoloObject.multiViewParameters;
        var textureSizeX    = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
        var textureSizeY    = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;
        var planeMaterial   = new THREE.MeshBasicMaterial({ map: backgroundPlaneTexture });
        var planeGeometry   = new THREE.PlaneGeometry(mvp.displayResolution.x, mvp.displayResolution.y);
        var plane           = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.castShadow    = true;
        plane.receiveShadow = true;
        this.cannedScene.add(plane);
    };

    this.prepareTextures = function () {
        this.leiaHoloObject.setMode(this.currentModeId);
        console.log('LeiaCore: Preparing shaders for render mode ['+this.leiaHoloObject.currentMode.modeId+'].');
        this.textures    = [];
        var cm           = this.leiaHoloObject.currentMode;
        var mvp          = this.leiaHoloObject.multiViewParameters;
        var textureSizeX = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
        var textureSizeY = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;
        for (var textureNumber = 0; textureNumber<cm.numberOfTextures; textureNumber++){
            this.textures[textureNumber] = new THREE.WebGLRenderTarget(textureSizeX, textureSizeY, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });
        }
        this.prepareShaderMaterial(this.leiaHoloObject)
        this.renderer.shadowMap.enabled  = true;
        this.updateTextureSettings      = false;
    };

    this.render = function(scene) {
      if (this.leiaHoloObject.configHasChanged){
        this.setParameters();
        this.initWithoutRenderer();
        this.render(scene);
      }
      else{
        this.runningTimer = Date.now() * 0.001;
        if (!this.isAnimating) {
            LEIA_startTime = this.runningTimer - this.timer;
        }
        if ((this.isAnimating) || (this.updateTextureSettings||this.updateShaderMaterial) ) {
            this.timer = this.runningTimer - LEIA_startTime;
            this.doRender(scene, this.leiaHoloObject);
        }
      }
    };


    this.prepareVideo = function(filename, multiViewMode) {
        this.setMultiViewMode(multiViewMode);
        this.leiaHoloObject.setMode(this.currentModeId);
        this.textures   = [];
        var cm          = this.leiaHoloObject.currentMode;
        var mvp         = this.leiaHoloObject.multiViewParameters;
        var textureSizeX, textureSizeY;
        switch (this.leiaHoloObject.multiViewParameters.displayType){
            case "square" :
                textureSizeX = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
                textureSizeY = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;
                break;
            case "diamondLandscape":
                textureSizeX = 0.5*cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
                textureSizeY = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;
                break;
            case "diamondPortrait":
                textureSizeX = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
                textureSizeY = 0.5*cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;
                break;
        }
        for (var textureNumber = 0; textureNumber<cm.numberOfTextures; textureNumber++){
            this.textures[textureNumber] = new THREE.WebGLRenderTarget(textureSizeX, textureSizeY, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });
        }
        this.prepareShaderMaterial(this.leiaHoloObject)
        this.renderer.shadowMap.enabled  = true;
        this.updateTextureSettings      = false;

        var views        = this.leiaHoloObject.currentMode.numberOfTiles;
        var cm           = this.leiaHoloObject.currentMode;
        var mvp          = this.leiaHoloObject.multiViewParameters;
        var textureSizeX = cm.numberOfTilesOnTexture.x * mvp.tileResolution.x;
        var textureSizeY = cm.numberOfTilesOnTexture.y * mvp.tileResolution.y;

        this.video             = document.createElement('video');
        this.video.autoplay    = true;
        this.video.crossOrigin = "Anonymous";
        this.video.src         = filename;
        var tv                 = this.video;
        document.addEventListener('click',function(){
          console.log("\n\n\nvideo start play\n\n\n");
          tv.play();
        },false);

        this.videotexture                 = new THREE.Texture(this.video);
        this.videotexture.minFilter       = THREE.LinearFilter;
        this.videotexture.magFilter       = THREE.LinearFilter;
        this.videotexture.format          = THREE.RGBFormat;
        this.videotexture.generateMipmaps = false;
        var videoMaterial                 = new THREE.MeshBasicMaterial({ color:0xffffff, map:this.videotexture});
        var planeGeometry                 = new THREE.PlaneGeometry(mvp.displayResolution.x, mvp.displayResolution.y);
        var plane                         = new THREE.Mesh(planeGeometry, videoMaterial);
        plane.castShadow                  = true;
        plane.receiveShadow               = true;
        this.cannedScene.add(plane);
    };

    this.showVideo = function() {
        if ( this.video.readyState === this.video.HAVE_ENOUGH_DATA ) {
            //imageContext.drawImage( video, 0, 0 );
            this.videotexture.needsUpdate=true;
            if  ( this.videotexture ) this.videotexture.needsUpdate = true;
        }
        this.updateRenderer(this.leiaHoloObject);
        this.renderer.setClearColor(new THREE.Color().setRGB(0.0, 0.0, 0.0));
        this.renderer.setViewport(0, 0, this.width, this.height);
        this.renderer.setScissor (0, 0, this.width, this.height);
        this.renderer.setScissorTest(true);
        this.renderer.render(this.cannedScene, this.orthoCamera, this.textures[0], false);
        this.displayOutput();
    };

    this.doRender = function(scene) {
        this.updateRenderer(this.leiaHoloObject);
        this.renderTiles(scene, this.leiaHoloObject, this.textures);
        this.displayOutput();
    };

    this.displayOutput = function(){
        this.outputScene.remove(this.outputMesh);
        this.outputMesh = new THREE.Mesh(this.outputGeometry, this.currentShaderMaterial)
        this.outputScene.add(this.outputMesh);
        this.renderer.setViewport(0, 0, this.canvasWidth, this.canvasHeight);
        this.renderer.setScissor (0, 0, this.canvasWidth, this.canvasHeight);
        this.renderer.setScissorTest(true);
        this.renderer.render(this.outputScene, this.orthoCamera);
    };

    this.composeShaderUniforms = function() {
        var uniforms={};
        switch (this.leiaHoloObject.currentMode.numberOfTextures) {
            case 8: uniforms.tTexture7 = { type: "t", value: this.textures[7] };
            case 7: uniforms.tTexture6 = { type: "t", value: this.textures[6] };
            case 6: uniforms.tTexture5 = { type: "t", value: this.textures[5] };
            case 5: uniforms.tTexture4 = { type: "t", value: this.textures[4] };
            case 4: uniforms.tTexture3 = { type: "t", value: this.textures[3] };
            case 3: uniforms.tTexture2 = { type: "t", value: this.textures[2] };
            case 2: uniforms.tTexture1 = { type: "t", value: this.textures[1] };
            case 1: uniforms.tTexture0 = { type: "t", value: this.textures[0] };
        }
        return uniforms;
    };

    this.renderTiles = function(scene, textures) {
        this.renderer.setClearColor(new THREE.Color().setRGB(0.0, 0.0, 0.0));
        var currentCamera       = this.camera;
        var numberOfTextures    = this.leiaHoloObject.currentMode.numberOfTextures;
        var tileResolution      = this.leiaHoloObject.multiViewParameters.tileResolution;
        var numberOfTilesX      = this.leiaHoloObject.currentMode.numberOfTilesOnTexture.x;
        var numberOfTilesY      = this.leiaHoloObject.currentMode.numberOfTilesOnTexture.y;
        var tileId              = 0;
        var nbrOfTiles          = this.leiaHoloObject.currentMode.numberOfTiles.x * this.leiaHoloObject.currentMode.numberOfTiles.y;
        this.renderer.setScissorTest(true);
        this.renderer.autoClear = true;
          for (var textureNumber = 0; textureNumber < numberOfTextures; textureNumber++){
            var textureOffsetPage = textureNumber * numberOfTilesX * numberOfTilesY;

                this.renderer.clear();

            for (var ty = 0; ty < numberOfTilesY; ty++) {
                var textureOffset = textureOffsetPage + ty*numberOfTilesX;
                for (var tx = 0; tx < numberOfTilesX; tx++) {
                    tileId = textureOffset + tx;
                    if (tileId < nbrOfTiles) {
                        var projectionMatrix = this.leiaHoloObject.projectionMatrices[textureOffset + tx];
                        currentCamera.projectionMatrix.copy( projectionMatrix );
                        var tleft = tileResolution.x * tx;
                        var tbottom = tileResolution.y * ty;
                        var twidth  = tileResolution.x;
                        var theight = tileResolution.y;
                        this.textures[textureNumber].scissor.set(tleft,tbottom,twidth,theight);
                        this.textures[textureNumber].viewport.set(tleft,tbottom,twidth,theight);
                        this.textures[textureNumber].scissorTest = true; 
                        this.renderer.render(scene, currentCamera, this.textures[textureNumber], false);
                    }
                 }
            }
        }
        this.renderer.autoClear = true;
    };

    this.prepareShaderMaterial = function() {
        var shaderMaterial;
        var shaderUniforms  = this.composeShaderUniforms(this.leiaHoloObject);
        var vertexShader    = this.leiaHoloObject.currentMode.composeVertexShader(this.renderMode);
        var fragmentShader  = this.leiaHoloObject.currentMode.composeFragmentShader(this.renderMode);

        shaderMaterial = new THREE.ShaderMaterial({
            uniforms: shaderUniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            depthWrite: false,
            depthTest: false,
            blending: THREE.NoBlending
        });
        this.currentShaderMaterial  = shaderMaterial;
        this.updateShaderMaterial   = false;
    };

    this.resetCentralCamera = function() {
       var cameraFOV = this.leiaHoloObject._fov;
       var aspectRatio = this.leiaHoloObject.mvp.aspectRatio;
       this.camera = new THREE.PerspectiveCamera(cameraFOV, aspectRatio, this.leiaHoloObject._nearPlane, this.leiaHoloObject._farPlane);
       this.camera.up.copy(this.leiaHoloObject._up);
       this.camera.position.copy(this.leiaHoloObject._cameraCenterPosition);
       this.camera.lookAt(this.leiaHoloObject._holoScreenCenter);
   };


   this.updateRenderer = function() {
       if (this.updateTextureSettings){
           this.prepareTextures(this.leiaHoloObject);
       } else {
           if (this.updateShaderMaterial){
               this.prepareShaderMaterial(this.leiaHoloObject);
           }
       }
       this.leiaHoloObject.checkUpdate(this.leiaHoloObject);
       this.resetCentralCamera(this.leiaHoloObject);
   };

    this.dataURLtoBlob = function(dataURL) {
        var byteString;
        // Convert base64/URLEncoded data component to raw binary data held in a string
        if (dataURL.split(',')[0].indexOf('base64') >= 0) {
            byteString = atob(dataURL.split(',')[1]);
        } else {
            byteString = unescape(dataURL.split(',')[1]);
        }
        var mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0]; // Separate out the mime component
        var ia = new Uint8Array(byteString.length); // Write the bytes of the string to a typed array
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type:mimeString});
    };

    this.saveCanvas = function(prefix) {
        var a = document.createElement("a");
        var filename = prefix + ".png";
        console.log("LeiaCore: creating image file ", filename);
        a.download = filename;
        var blob = this.dataURLtoBlob(leiaRenderer.renderer.domElement.toDataURL("image/png"));
        a.href = (window.URL || window.URL).createObjectURL(blob);
        a.click();
    };

    this.toggleMultiViewModes = function() {
        console.log('LeiaCore: Toggling multiview modes');
        var q = 0;
        var currentId = 0;
        var availableModes  = [];
        for (var mode in this.leiaHoloObject.MULTIVIEW_MODES) {
            var modeId = this.leiaHoloObject.MULTIVIEW_MODES[mode]
            availableModes[q] = mode;
            if (modeId == this.currentModeId){
                currentId = q;
            }
            q++;
        }
        this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES[availableModes[(currentId+1)%q]]);
    };

    this.toggleSuperSample = function() {
        switch (this.getMultiViewMode()) {
            case this.leiaHoloObject.MULTIVIEW_MODES.BASIC :   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.SS4X);   break;
            case this.leiaHoloObject.MULTIVIEW_MODES.SS4X  :   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.BASIC);  break;
            default:   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.BASIC);  break;
        }
    };

    this.toggle2D3D = function() {
        switch (this.getMultiViewMode()) {
            case this.leiaHoloObject.MULTIVIEW_MODES.BASIC :   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.FLAT);   break;
            case this.leiaHoloObject.MULTIVIEW_MODES.FLAT  :   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.BASIC);  break;
            default:   this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.FLAT);  break;
        }
    };

    this.toggleIsAnimating = function() {
        this.setAnimationStatus(!this.getAnimationStatus());
    };

    this.setAnimationStatus = function(setting) {
        if ((setting == true) || (setting == false)) {
            this.isAnimating = setting;
            if (this.isAnimating){
                this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.BASIC);
            } else {
                this.setMultiViewMode(this.leiaHoloObject.MULTIVIEW_MODES.SS4X);
                this.doRender(scene, this.leiaHoloObject);
            }
        }
    };

    this.getAnimationStatus = function() {
        return this.isAnimating;
    };

    this.importShaderMatrix = function(url) {
        var request = new XMLHttpRequest;
        request.open('GET', url, false);
        request.send(null);
        var m;
        if (request.status === 200) {
            var data = JSON.parse(request.responseText);
            m = data.matrix;
        } else {
            throw new Error('LeiaCore: Cannot read shader matrix file ', url);
        }
        return m;
    };

    this.toggleSwizzle = function() {  // Single, Tiled, Swizzle
        switch (this.getRenderMode()){
            case this.leiaHoloObject.RENDER_MODES.TILES    :   this.setRenderMode(this.leiaHoloObject.RENDER_MODES.SWIZZLE);  break;
            case this.leiaHoloObject.RENDER_MODES.SWIZZLE  :   this.setRenderMode(this.leiaHoloObject.RENDER_MODES.TILES);    break;
        }
    };

    this.shiftX = function(shiftX) {
        var shiftMax = Math.max(this.canvasShift.nbrOfViewsX, this.canvasShift.nbrOfViewsY);
        this.canvasShift.x = (this.canvasShift.x + shiftX + shiftMax) % shiftMax;
        this.setCanvasShift();
    };

    this.shiftY = function(shiftY) {
        var shiftMax = Math.max(this.canvasShift.nbrOfViewsX, this.canvasShift.nbrOfViewsY);
        this.canvasShift.y = (this.canvasShift.y + shiftY + shiftMax) % shiftMax;
        this.setCanvasShift();
    };

    this.setCanvasShift = function(){
        var shiftX = this.canvasShift.x;
        var shiftY = this.canvasShift.y;
        this.shifterCookie.setItem('LeiaShiftX_'+this.leiaHoloObject.mvp.displayType, shiftX);
        this.shifterCookie.setItem('LeiaShiftY_'+this.leiaHoloObject.mvp.displayType, shiftY);
        var sX = 0;
        var sY = 0;
        var canRot = this.canvasRotation;
        setTimeout( function() {
            var canvas = document.getElementsByTagName("canvas");
            switch (canRot) {
                case "0deg":
                    sX = shiftX;
                    sY = shiftY;
    		        canvas[0].style.setProperty("transform", "translate("+sX.toFixed(2)+"px, "+sY.toFixed(2)+"px) ", null);
                    break;
                case "90deg":
                    sX = shiftY;
                    sY = shiftX;
    		        canvas[0].style.setProperty("transform", "translate("+sX.toFixed(2)+"px, "+sY.toFixed(2)+"px) ", null);
                    break;
                default:
                    console.log('Warning: wrong canvas rotation setting in configuration file. Please use official LEIA configuration files only.');
            }
        }, 0);
    };

    this.initWithoutRenderer= function(parameters){
        var nViews          = this.leiaHoloObject.multiViewParameters.numberOfViews;
        this.shifterCookie  = LeiaCookieHandler;
        this.canvasShift    = {
                                x           : this.shifterCookie.getItem('LeiaShiftX_'+this.leiaHoloObject.mvp.displayType),
                                y           : this.shifterCookie.getItem('LeiaShiftY_'+this.leiaHoloObject.mvp.displayType),
                                nbrOfViewsX : nViews.x,
                                nbrOfViewsY : nViews.y
                              };
        this.setCanvasShift();
        this.outputScene.add(this.outputMesh);
        switch (this.leiaHoloObject.multiViewParameters.canvasRotation) {
            case "0deg":
                this.renderer.setSize(this.width, this.height);
                this.canvasWidth  = this.width;
                this.canvasHeight = this.height;
                break;
            case "90deg":
                this.renderer.setSize(this.height, this.width);
                this.canvasWidth  = this.height;
                this.canvasHeight = this.width;
                break;
            default:
                console.log('Warning: wrong canvas rotation setting in configuration file. Please use official LEIA configuration files only.');
        }
    }

    this.init = function(parameters) {
        var nViews          = this.leiaHoloObject.multiViewParameters.numberOfViews;
        this.shifterCookie  = LeiaCookieHandler;
        this.canvasShift    = {
                                x           : this.shifterCookie.getItem('LeiaShiftX_'+this.leiaHoloObject.mvp.displayType),
                                y           : this.shifterCookie.getItem('LeiaShiftY_'+this.leiaHoloObject.mvp.displayType),
                                nbrOfViewsX : nViews.x,
                                nbrOfViewsY : nViews.y
                              };
        this.setCanvasShift();
        this.outputScene.add(this.outputMesh);
        this.renderer = new THREE.WebGLRenderer({
            antialias:false,
            preserveDrawingBuffer: true,
            devicePixelRatio: 1,
        });
        if (this.debugMode){
            console.log('Warning: initializing LeiaCore in debug mode.')
        }

        switch (this.leiaHoloObject.multiViewParameters.canvasRotation) {
            case "0deg":
                this.renderer.setSize(this.width, this.height);
                this.canvasWidth  = this.width;
                this.canvasHeight = this.height;
                break;
            case "90deg":
                this.renderer.setSize(this.height, this.width);
                this.canvasWidth  = this.height;
                this.canvasHeight = this.width;
                break;
            default:
                console.log('Warning: wrong canvas rotation setting in configuration file. Please use official LEIA configuration files only.');
        }
        this.resetCentralCamera(this.leiaHoloObject);
    };

    this.setParameters();
    this.init(this.leiaHoloObject);
}

/**
 * LeiaKeystokeHandler
 *
 * Example usage:
 *
 * var lks = new LeiaKeystrokeHandler(threeScene, leiaHoloScreen, leiaRenderer, useReservedKeys);
 * lks.addKeyHandler('t', function(event){
 *     console.log(event.keyCode + " was pressed");
 * });
 *
 */
function LeiaKeystrokeHandler(threeScene, leiaHoloObject, leiaRenderer, useReservedKeys) {
    var KEY = {
            ESC:27,
            SPACE:32,
            LEFT:37,
            UP:38,
            RIGHT:39,
            DOWN:40,
            SHIFT:16,
            TILDE:192,
            ONE:49,
            TWO:50,
            THREE:51,
            FOUR:52,
            ENTER:13,
            A:65,
            C:67,
            S:83,
            T:84,
            U:85,
            V:86,
            W:87,
            K:75,
            L:76,
            B:66,
            INF:188,           // technically it's " , " but I like to think of it as " > " (same key) which looks like an fov , decrease fov
            SUP:190,           // technically it's " . " but I like to think of it as " > " , increases fov
            SLASH:191,         // " / " used to switch between modes if defined.
            RIGHT_BRACKET:221, // " ] "  increase width
            LEFT_BRACKET:219}; // " [ "  decrease width

    var keyHandlers = [];

    this.onKeyDown = function(event) {
        var kc = event.keyCode;
        if( keyHandlers[kc] !== undefined ) {
            keyHandlers[kc](event);
        }
    };

    this.addKeyHandler = function(key, handlerFunction) {
        var keyCode = key.toUpperCase().charCodeAt(0);
        keyHandlers[keyCode] = handlerFunction;
    };

    this.addKeyHandlerForCharCode = function(keyCode, handlerFunction) {
        keyHandlers[keyCode] = handlerFunction;
    };

    document.addEventListener('keydown', this.onKeyDown, false);

    if(useReservedKeys) {
        console.log("LeiaKeystrokeHandler: Initializing with LEIA reserved keys turned on.");
        this.addKeyHandler("a", function(){ // toggle between swizzle and tile mode
            leiaRenderer.toggleSwizzle();
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
        this.addKeyHandler("i", function(){ // move canvas by 1 pixel in y
            leiaRenderer.shiftY(1);
        });
        this.addKeyHandler("j", function(){ // move canvas by -1 pixel in x
            leiaRenderer.shiftX(-1);
        });
        this.addKeyHandler("k", function(){ // move canvas by -1 pixel in y
            leiaRenderer.shiftY(-1);
        });
        this.addKeyHandler("l", function(){ // move canvas by 1 pixel in x
            leiaRenderer.shiftX(1);
        });
        this.addKeyHandler("p", function(){ // save canvas as image: holoScreenOutput.png
            leiaRenderer.saveCanvas("holoScreenOutput");
        });
        this.addKeyHandler("s", function(){ // toggle between basic and supersample4x mode.
            leiaRenderer.toggleSuperSample();
        });
        this.addKeyHandlerForCharCode(KEY.SPACE, function(){ // toggle between animation on/off
            leiaRenderer.toggleIsAnimating();
        });
        this.addKeyHandlerForCharCode(KEY.TILDE, function(){ // toggle between basic and supersample4x mode.
            leiaRenderer.toggleMultiViewModes();
        });
        this.addKeyHandlerForCharCode(KEY.ONE, function(){ // toggle between basic and supersample4x mode.
            leiaHoloObject.setBaselineScaling(Math.max(0.001, Math.min(3.0, leiaHoloObject.getBaselineScaling() - 0.2)));
            leiaRenderer.updateShaderMaterial = true;
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
        this.addKeyHandlerForCharCode(KEY.TWO, function(){
            leiaHoloObject.setBaselineScaling(Math.max(0.001, Math.min(3.0, leiaHoloObject.getBaselineScaling() + 0.2)));
            leiaRenderer.updateShaderMaterial = true;
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
        // this.addKeyHandlerForCharCode(KEY.THREE, function(){ // toggle between basic and supersample4x mode.
        //     leiaRenderer.toggle2D3D();
        //     leiaRenderer.updateShaderMaterial = true;
        // });
        this.addKeyHandlerForCharCode(KEY.THREE, function(){ // toggle between basic and supersample4x mode.
            leiaHoloObject.setDistanceExponent(Math.max(-1.0, Math.min(3.0, leiaHoloObject.getDistanceExponent() - 0.2)));
            leiaRenderer.updateShaderMaterial = true;
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
        this.addKeyHandlerForCharCode(KEY.FOUR, function(){ // toggle between basic and supersample4x mode.
            leiaHoloObject.setDistanceExponent(Math.max(-1.0, Math.min(3.0, leiaHoloObject.getDistanceExponent() + 0.2)));
            leiaRenderer.updateShaderMaterial = true;
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
        this.addKeyHandlerForCharCode(KEY.SUP, function(){ // increase fov
            var fov= leiaHoloObject._fov;
            fov+=0.1
            if (fov > 3*Math.PI/4) {
                fov = 3*Math.PI/4;
            }
              leiaHoloObject.setFOV(fov);
              leiaRenderer.updateShaderMaterial = true;
              leiaRenderer.render(threeScene, leiaHoloObject);
        });

        this.addKeyHandlerForCharCode(KEY.INF, function(){ // decrease fov
            var fov= leiaHoloObject._fov;
            fov -=0.1;
            if (fov < 0) {
                fov = 0.01; 
            }

              leiaHoloObject.setFOV(fov);
              leiaRenderer.updateShaderMaterial = true;
              leiaRenderer.render(threeScene, leiaHoloObject);
        });

        this.addKeyHandlerForCharCode(KEY.RIGHT_BRACKET, function(){ // increase width
          var width= leiaHoloObject._width;
          width += 1;
          leiaHoloObject.setWidth(width);
          leiaRenderer.updateShaderMaterial = true;
          leiaRenderer.render(threeScene, leiaHoloObject);

        });
        this.addKeyHandlerForCharCode(KEY.LEFT_BRACKET, function(){ // decrease width
          var width= leiaHoloObject._width;
          width -=1;
          if (width < 15) {
              width = 15;
          }
            leiaHoloObject.setWidth(width);
            leiaRenderer.updateShaderMaterial = true;
            leiaRenderer.render(threeScene, leiaHoloObject);
        });
    }
}

/**
 * LeiaCookieHandler
 *
 * Example usage:
 *
 * LeiaCookieHandler.getItem(key)
 * LeiaCookieHandler.setItem(key, value)
 * LeiaCookieHandler.removeItem(key)
 * LeiaCookieHandler.hasItem(key)
 * LeiaCookieHandler.keys()
 *
 */
var LeiaCookieHandler = {
    SHIFTX: "LeiaShiftX",
    SHIFTY: "LeiaShiftY",

    getItem: function (key) {
        if (!key) { return null; }
        var q = parseInt(decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(key).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null);
        if (isNaN(q)) {
            q = 0;
        }
        return q;
    },

    setItem: function (key, value) {
        if (!key || /^(?:expires|max\-age|path|domain|secure)$/i.test(key)) { return false; }
        var suffix = "; expires=Fri, 31 Dec 9999 23:59:59 GMT;path=/";
        document.cookie = encodeURIComponent(key) + "=" + encodeURIComponent(value) + suffix;
        return true;
    },

    removeItem: function (key) {
        if (!this.hasItem(key)) { return false; }
        document.cookie = encodeURIComponent(key) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return true;
    },

    hasItem: function (key) {
        if (!key) { return false; }
        return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(key).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
    },

    keys: function () {
        var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
        for (var nLen = aKeys.length, nIdx = 0; nIdx < nLen; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
        return aKeys;
    },

    shiftX: function(amount) {
        this.setItem(this.SHIFTX, this.getItem(this.SHIFTX)+amount);
    },

    shiftY: function(amount) {
        this.setItem(this.SHIFTY, this.getItem(this.SHIFTY)+amount);
    }
};
if( !LeiaCookieHandler.hasItem(LeiaCookieHandler.SHIFTX) ) {
    LeiaCookieHandler.setItem(LeiaCookieHandler.SHIFTX, 0);
}
if( !LeiaCookieHandler.hasItem(LeiaCookieHandler.SHIFTY) ) {
    LeiaCookieHandler.setItem(LeiaCookieHandler.SHIFTY, 0);
}

