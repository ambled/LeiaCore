/**
 * LeiaHoloScreen
 *
 * @param leiaDisplay
 * @param parameters
 * @constructor
 */
function LeiaHoloView(leiaDisplay, parameters) {
    var lhv;
    this.MULTIVIEW_MODES = { FLAT  : 'flat', TVH   : 'twoViewHorizontal', BASIC : 'basic', SS4X  : 'supersample4x'};
    this.RENDER_MODES   = {TILES   : 1, SWIZZLE : 2};

    this.setDefaultConfig= function(){
      var defaultLeiaDisplay = {
        "info": {
          "displayType"        : "square",
          "canvasRotation"     : "0deg",
          "physicalDimensions" : {"x":36.8, "y":36.8},
          "displayResolution"  : {"x":1600, "y":1200},
          "numberOfViews"      : {"x": 8, "y":8},
          "deltaN"             : 0.1,
          "maxDisparity"       : 5,
          "emissionPatternR"   : [],
          "emissionPatternG"   : [],
          "emissionPatternB"   : []
        }
      }
      var nvx = defaultLeiaDisplay.info.numberOfViews.x;
      var nvy = defaultLeiaDisplay.info.numberOfViews.y;
      var nvxoffset = (nvx-1.0)/2.0;
      var nvyoffset = (nvy-1.0)/2.0;
      for (var j=0; j<nvy; j++){
        for (var i=0; i<nvx; i++){
          defaultLeiaDisplay.info.emissionPatternR.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaN ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaN});
          defaultLeiaDisplay.info.emissionPatternG.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaN ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaN});
          defaultLeiaDisplay.info.emissionPatternB.push({"x":(i-nvxoffset)*defaultLeiaDisplay.info.deltaN ,"y":(j-nvyoffset)*defaultLeiaDisplay.info.deltaN});
        }
      }
      this.configHasChanged     = false;
      this.defineNonPhysicalParameters();
      this.setLeiaConfig(defaultLeiaDisplay);
    }

    this.setLeiaConfig= function(leiaDisplay){
      this.modes                  = {};
      this.multiViewParameters    = {};
      this.mvp                    = this.multiViewParameters;
      var info                    = leiaDisplay.info;
      this.mvp.displayType        = info.displayType;
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
        case "diamond":
          this.mvp.tileResolution = new THREE.Vector2(2*viewResX, viewResY);
          break;
        case "diamond2":
          this.mvp.tileResolution = new THREE.Vector2(viewResX, 2*viewResY);
          break;
        default:
          console.err('FATAL ERROR: unknown display Type')
      }
      this._width                 = info.physicalDimensions.x;
      this._height                = info.physicalDimensions.x/this.mvp.aspectRatio;
      this.deltaN                 = info.deltaN;
      this._maxDisparity          = info.maxDisparity;
      this.emissionPatternG       = leiaDisplay.info.emissionPatternG;
      this.configHasChanged       = true;

      this.updateNonPhysicalParameters();
      this.init()
    }

    this.defineNonPhysicalParameters= function(){
      this.version                = REVISION;
      this.projectionMatrices     = [];
      this._holoScreenCenter      = new THREE.Vector3(0, 0, 0);   // screen center location
      this._normal                = new THREE.Vector3(0, 0, 1);   // screen normal: unit vector pointing from the screen center to the camera array center
      this._up                    = new THREE.Vector3(0, 1, 0);   // positive vertical direction of the screen: y axis
      this.cameraShift            = new THREE.Vector2(0, 0);      // shift of the camera block with respect to its center
      this._baselineScaling       =    1.0;                       // stretch factor of the camera array
      this._distanceExponent      =    1.0;                       // stretch factor of the camera array
      this.currentMode            =   null;                       // needs to be set by renderer
      this.updateNonPhysicalParameters();
    }

    this.updateNonPhysicalParameters = function() {					//     XXX XXX XXX     THIS IS THE ONE WE ARE USING     XXX XXX XXX
      this._ScreenCameraDistance  = this._width*Math.exp(this._distanceExponent * Math.log(10.0));
      this._fov                   = 2*Math.atan(this._width/(2*this._ScreenCameraDistance));
      this._cameraCenterPosition  = new THREE.Vector3(0,0,this._ScreenCameraDistance);
      this._baseline              = this._baselineScaling*this.deltaN*this._ScreenCameraDistance;
      this._nearPlane             = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);      // math formula
      this._farPlane              = ( (this._maxDisparity>=this._baseline)? -20000 :-(this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity))); // math formula
      this._matricesNeedUpdate    =   true;                      // matrices will be generated upon first render
      lhv=this;
   	 // console.log(this._width, this._distanceExponent, this._ScreenCameraDistance, this._fov, this._baseline)
   	 // console.lhvog(this._baselineScaling,this.deltaN,this._ScreenCameraDistance, this._nearPlane, this._farPlane)
    }

    function multiViewMode(parameters) {
        this.modeId                 = null;     // name/identifier of the current mode
        this.viewDirections         = null;     // emission Pattern of this mode (typically the green channel specified in the display configuration file.)
        this.matrix                 = null;     // blurring/sharpening kernel
        this.matrixTileStep         = null;     // view spacing when applying the kernel: 0.5 means supersampled grid, 1 means normal grid.
        this.numberOfTiles          = null;     // number of tiles that are rendered in this mode
        this.numberOfTilesOnTexture = null;     // number of tiles that are rendered on each texture
        this.numberOfTextures       = null;     // number of textures necessary to render all tiles.

        this.initFlatCamera  = function( parameters) {
            this.numberOfTiles          =   new THREE.Vector2(1, 1);
            this.numberOfTilesOnTexture =   this.numberOfTiles;
            this.numberOfTextures       =       1;
            this.matrix                 =   [[1]];
            this.matrixTileStep         =   new THREE.Vector2(1, 1);
            this.viewDirections.push(new THREE.Vector3(0, 0, 1));
        };

        this.initBasicCamera = function(parameters) {
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
                case "diamond" :
                case "diamond2" :
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
              case "diamond":
              case "diamond2":
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
                	case "diamond":
	                    fragmentShader += "  parityId = mod(sPixId.t, 2.0);\n";
	                    fragmentShader += "  if (parityId == 0.0) {\n";
	                    fragmentShader += "    sPixId = vec2( floor(max(0.0, max(0.0, (pixelCoord.s-"+(mvp.numberOfViews.x/2.0).toFixed(1)+")))/"+mvp.numberOfViews.x.toFixed(1)+"), floor(pixelCoord.t/"+mvp.numberOfViews.y.toFixed(1)+") );\n";
                      fragmentShader += "    viewId = vec2(   mod(max(0.0, max(0.0, (pixelCoord.s-"+(mvp.numberOfViews.x/2.0).toFixed(1)+"))),"+mvp.numberOfViews.x.toFixed(1)+"),   mod(pixelCoord.t,"+mvp.numberOfViews.y.toFixed(1)+") );\n";
	                    fragmentShader += "  }\n";
    	                break;
                    case "diamond2":
	                    fragmentShader += "  parityId = mod(sPixId.s, 2.0);\n";
	                    fragmentShader += "  if (parityId == 0.0) {\n";
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
              case "diamond":
              case "diamond2":
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
                    // fragmentShader +=  "  viewPos = vec2( viewPos.s, viewPos.t );\n";
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
                case "diamond":
                    fragmentShader += "  vec2 idA = vec2( "+fraction.x.toFixed(8)+"*(2.0*sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  vec2 idB;\n";
                    fragmentShader += "  if (parity == 0.0) {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(2.0*sPix.s+0.5+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  } else {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(max(0.0, 2.0*sPix.s-0.5)+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5) , "+fraction.y.toFixed(8)+"*(sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5));\n";
                    fragmentShader += "  }\n";
                    fragmentShader += "  res = 0.5 * ( texture2D( tTexture0, idA) + texture2D( tTexture0, idB) ); \n";
                    break;
                case "diamond2":
                    fragmentShader += "  vec2 idA = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(2.0*sPix.t+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  vec2 idB;\n";
                    fragmentShader += "  if (parity == 0.0) {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(2.0*sPix.t+0.5+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  } else {\n";
                    fragmentShader += "    idB = vec2( "+fraction.x.toFixed(8)+"*(sPix.s+viewPos.s*"+mvp.tileResolution.x.toFixed(1)+"+0.5), "+fraction.y.toFixed(8)+"*(max(0.0, 2.0*sPix.t-0.5)+viewPos.t*"+mvp.tileResolution.y.toFixed(1)+"+0.5) );\n";
                    fragmentShader += "  }\n";
                    fragmentShader += "  res = 0.5 * ( texture2D( tTexture0, idA) + texture2D( tTexture0, idB) ); \n";
                    break;
                default:
                    console.log('Warning: display type in configuration file. Please use official LEIA configuration files only.');

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
                        	case "diamond":
                        	case "diamond2":
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
            // console.log(fragmentShader)
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
        this.isUpdated = true;   //not used
    };

    this.setMode = function(mode) {
        this.currentMode = this.modes[mode];
        this._matricesNeedUpdate = true;
    };


    this.init = function(leiaDisplay, parameters) {
            for (var mode in lhv.MULTIVIEW_MODES){
                this.modes[lhv.MULTIVIEW_MODES[mode]] = new multiViewMode({ modeId: lhv.MULTIVIEW_MODES[mode]} );
            }
    };
    this.setDefaultConfig();
    this.init(leiaDisplay, parameters);

}
