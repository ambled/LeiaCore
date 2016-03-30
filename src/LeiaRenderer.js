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
            antialias:true,
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

