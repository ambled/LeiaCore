//==============================================================================

//======================The HoloScreen Object ==================================


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
