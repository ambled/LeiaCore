//====================== Holo Objects ==========================================

//======================The HoloCamera Object ==================================


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
    }

    this.setCameraAtDistance= function(newDistance){
        this._ScreenCameraDistance= newDistance;
        this._position.copy((((new THREE.Vector3()).copy(this._normal)).multiplyScalar(this._ScreenCameraDistance)).add(this._lookAtVector));
        this._cameraCenterPosition.copy(this._position);
        this._updateIntrinsicParametersAfterDistanceChange();
    }

    this._updateIntrinsicParametersAfterDistanceChange=function(){
        this._width               = 2*Math.tan(this._fov/2)*(this._ScreenCameraDistance);
        this._height              = this._width/this.mvp.aspectRatio;
        this._baseline            = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane           = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane            = ( (this._maxDisparity > this._baseline)? -20000 : -this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity) );
        this._matricesNeedUpdate  = true;
    }

    this.setBaselineScaling= function(newBaselineScaling){ // not used for screen based rendering.
        this._baselineScaling     = newBaselineScaling;
        this._baseline            = this._baselineScaling*this.deltaView*this._ScreenCameraDistance;
        this._nearPlane           = this._maxDisparity*this._ScreenCameraDistance/(this._baseline+this._maxDisparity);
        this._farPlane            = ( (this._maxDisparity > this._baseline)? -20000 : -this._maxDisparity*this._ScreenCameraDistance/(this._baseline-this._maxDisparity) );
        this._matricesNeedUpdate  = true;
    }

    this.setFOV = function(newFOV){
        this._fov = newFOV;
        this.setCameraAtDistance(this._width/(2*Math.tan(this._fov/2)));
    }

    this.lookAt= function (newLookAt){
        this._lookAtVector.copy(newLookAt);
        this._updateVectors();
      }

    this.setWidth=function(newWidth){
        this.setCameraAtDistance(newWidth/(2*Math.tan(this._fov/2)));
    }

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
    }

    this.setUp=function(newUp){
        this._up.copy(newUp);
        this._updateVectors()
    }
}
LeiaHoloCamera.prototype = new LeiaHoloView();
