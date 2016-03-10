<img src="http://myleia.com/github/LeiaGitHub.png"/>

Want to be a pioneer in interactive holographic design? Write the first mobile holographic apps and be remembered for the ages?

Well here is your chance! :-)

[LEIA](https://www.leiainc.com) has developed an API, [LeiaCore](https://github.com/LeiaInc/LeiaCore), using [WebGL](https://www.khronos.org/webgl) and [three.js](http://threejs.org) making it super easy to create interactive holographic content running directly in your browser. You can write code from scratch, or adapt existing [WebGL](https://www.khronos.org/webgl) and [three.js](http://threejs.org) based apps. In essence, the main difference between standard code and our 3D code is using our holographic renderer function instead of the standard renderer.

Not only will your designs come to life on our display, you’ll also get the chance to interact with them using a variety of cool new user interfaces such as the [Leap Motion Controller™](https://developer.leapmotion.com), [Intel® RealSense™ 3D cameras](http://www.intel.com/RealSense), hovering panels, even our very own holographic camera. You can use existing JavaScript plug-ins, or write your own to integrate the device of your choice to our ecosystem.

Have a look at [our website](https://www.leia3d.com), browse and edit some of our example applications on our [jsbin IDE](http://ide.leia3d.com/), [download our holographic 3D creation guidelines](https://www.leiainc.com/wp-content/uploads/2014/11/Holographic-content-creation-guidelines.pdf) for an overview of the technology involved in the [LEIA](https://www.leia3d.com) display, and get more details on where the [LEIA](https://www.leia3d.com) platform is headed in general.

Welcome to the holographic future!

# LeiaCore API #

We'd like to give you, the developer, the smoothest possible onramp to implementing some basic 3D functionality using the LeiaCore library that will render as a three dimensional image on a [LEIA](https://www.leia3d.com) display.

Exposure and experience with the [three.js](http://threejs.org) library will help you immeasurably in quickly understanding how to best create more complex 3D scenes for Leia holographic devices, as the core library heavily leverages [three.js](http://threejs.org) for anything involving custom content creation.

It is also possible to use pre-rendered content and have it appear holographically, however in most cases its more ideal to render your content as [three.js](http://threejs.org) vector primitives for optimum design flexibility and rendering performance.

### Demo/Example Quick Links ###

**[Single Shape](https://github.com/LeiaInc/LeiaCore/blob/master/README.md#getting-started)**

**[Multiple Shapes](https://github.com/LeiaInc/LeiaFourShapeScene)**

**[Basic Animation](https://github.com/LeiaInc/BasicAnimation)**

**[Basic Visual Effects](https://github.com/LeiaInc/LeiaBasicShadowEffect)**

## Getting Started ##

First, there are a few things you are going to need to have installed and be familiar with in order to be able to write and run our examples. We will be doing almost everything from the [bash terminal](http://en.wikipedia.org/wiki/Terminal_%28OS_X%29) (Mac) typically located in /Applications/Utilities/Terminal.app, or the command line ([CMD](http://en.wikipedia.org/wiki/Cmd.exe)) if you are on Windows.

**Windows Users:** A quick shortcut to running CMD is to simply hold the Windows key, and type the letter "R". This will get you a "Run" window. Then just type "cmd.exe" in this window and hit the enter key to launch an instance of the Windows command line interface.

### Installing Git ###

This isn't a requirement to run our demonstration code, but if you want to have full working copies of the source code for the examples, and/or the API itself locally on your computer, the next few steps are necessary to achieve this. First, you need to have [git](http://git-scm.com/) installed in order to get the Leia projects from GitHub.

GitHub has an [excellent tutorial](https://help.github.com/articles/set-up-git) on installing and configuring [git](http://git-scm.com/) on your system. We highly recommend reading this and following its instructions first. Once you have git installed and configured on your system, then you can continue with the rest of our tutorial.

### Running The Examples ###

You'll also need a local HTTP/web server to run our examples to avoid local file access restrictions due to almost all modern browser default security settings.

**Mac:** If you are on a Mac, you're in luck since python comes pre-installed, and all you need do is run the following command from the same directory you saved your example code to.

```
python -m SimpleHTTPServer
```

This will start a local web server on port 8000 (the default) from whatever directory it was run from on your system. Then all you need to do is go to [http://localhost:8000](http://localhost:8000) in your web browser to see the example run.

**Windows:** Windows users would ideally have NodeJS and NPM installed already. If not, go to the Node website, and install the stable release of Node immediately. :-) Node/NPM come as a bundle with the main installer for all supported platforms.

Once Node and NPM are installed, use NPM to install the http-server Node module by issuing the following command in your command line:
```
npm install http-server -g
```
Now simply navigate to the directory on your local filesystem you want to serve your code example from, and start http-server by running the following command in your command line with the following command:
```
http-server -d
```
With that done, you should be able to point your web browser at [http://localhost:8080](http://localhost:8080) and see a directory listing of all of the files in the directory you started http-server in.

### How To Use The Code ###

All of our coding examples are simply plain text and can be created and edited in any basic text editor of your choice. Most of us opt for more feature rich text editors such as [Sublime Text](http://www.sublimetext.com/), [Atom](https://www.jetbrains.com/idea/), [Brackets](https://www.http://brackets.io/), etc. You can also just as easily use one of the built-in text editors for your operating system, such as [TextEdit](http://en.wikipedia.org/wiki/TextEdit), [Notepad](http://en.wikipedia.org/wiki/Notepad_%28software%29), [vim/vi](http://en.wikipedia.org/wiki/Vim_%28text_editor%29), [emacs](http://en.wikipedia.org/wiki/Emacs), etc. The main difference is you don't get intelligent code highlighting/helpers with a basic text editor, but the main function still accomplishes the same goal; editing and saving a text file.

### Starter Code ###

We will start with code that provides all of the necessary pieces to begin working with the LEIA display. Simply open your editor of choice, and copy/paste the code below into a new file and name it something like index.html (if you want the http/web server you just installed to load it automatically from the directory its serving files from).
```
<!DOCTYPE html>
<head>
    <meta charset="utf-8">
    <title>Single Shape Demo Example</title>
    <style type="text/css">
    body {   
        overflow          : hidden;
        background-color  : black;
        margin            : 0 0 0 0;
        padding           : 0 0 0 0;
        -webkit-transform : rotate(0deg);
    }
    </style>
    <script src="https://www.leiainc.com/devkit/examples/js/three.js"></script>
    <script src="https://www.leiainc.com/devkit/build/LeiaCore.js"></script>
</head>
<body></body>
<script>
    // Add global variables here

    // three.js scene
    var scene;

    // Essential Leia Objects
    var leiaDisplayInfo, leiaHoloScreen, leiaRenderer, leiaKeys;

    window.onload = function () {
        // Start initialization and render once page has loaded
        init();
        animate();
    };

    function init() {
        // Initialize Everything that LEIA needs
        leiaDisplayInfo     = new LeiaDisplayInfo('https://www.leiainc.com/devkit/config/displayPrototypeSmallDevKit.json');
        leiaHoloScreen      = new LeiaHoloScreen(leiaDisplayInfo);
        leiaRenderer        = new LeiaRenderer(leiaHoloScreen);

        // Init three.js scene
        scene  = new THREE.Scene();

        addObjects();
        addEvents();

        document.body.appendChild(leiaRenderer.renderer.domElement);
    }

    function addObjects() {
        // Add three.js objects here
    }

    function addEvents() {
        // Add event handlers here
        leiaKeys = new LeiaKeystrokeHandler(scene, leiaHoloScreen, leiaRenderer, true);
    }

    function animate() {
        requestAnimationFrame(animate);

        // Add animation logic here

        // Render scene
        leiaRenderer.render(scene, leiaHoloScreen);
    }

</script>
</html>
```
[This file](https://github.com/LeiaInc/LeiaSingleShape/blob/master/index.html), as well as the rest of the files for this example are available for viewing or download in the [LeiaSingleShape](https://github.com/LeiaInc/LeiaSingleShape) repository.

The following is an explanation of the starter code. If you would like to skip this and begin adding objects to the scene, skip to [Generate a Cube](https://github.com/LeiaInc/LeiaCore/blob/master/README.md#generate-a-cube).



#### CSS ####
```
<style type="text/css">
    body {   
    overflow          : hidden;
    background-color  : black;
    margin            : 0 0 0 0;
    padding           : 0 0 0 0;
    -webkit-transform : rotate(0deg);
</style>
```
To correctly display our rendered content on our device we must use CSS. Our content should fill the entire page so we need to set our margins and padding to zero and also disable scrolling by setting overflow to hidden. We then set the background to black to remove white edges that may appear.

#### Includes ####
```
<script src="https://www.leiainc.com/devkit/examples/js/three.js"></script>
<script src="https://www.leiainc.com/devkit/build/LeiaCore.js"></script>
```
To create our 3D content we will be using three.js so it will need to be included in our project as well as LeiaCore.js.

#### Global Variables ####
```
// three.js scene
var scene;

//  Essential LEIA objects
var leiaDisplayInfo, leiaHoloScreen, leiaRenderer, leiaKeys;
```

The [scene](http://threejs.org/docs/#Reference/Scenes/Scene) object is where we will place our objects and lights to be rendered.

##### LEIA Objects #####
* leiaDisplayInfo contains configuration information for the LEIA display we are using.
* leiaHoloScreen represents a screen in 3D space. Objects in front of the leiaHoloScreen will appear to pop out while those behind will appear to be inset.
* leiaRenderer renders our scene in a way that can be seen holographically.
* leiaKeys Provides keyboard bindings that are useful for adjustments.

##### LEIA Keys #####
* (i, j, k, l) are used for screen alignment.
* (spacebar) will toggle rendering.
* (1 and 2) will adjust baseline scaling.
* (3 and 4) will adjust distortion.

**Note:** If the 3D effect jumps in the middle of the screen, the screen may be misaligned. Use the i, j, k, l keys to adjust the screen. When your screen is correctly aligned, you will see a natural 3D image with no unnatural jumps within the field of view.

#### The init Function ####
```
function init() {
    leiaDisplayInfo     = new LeiaDisplayInfo('https://www.leiainc.com/devkit/config/displayPrototypeSmallDevKit.json');
    leiaHoloScreen      = new LeiaHoloScreen(leiaDisplayInfo);
    leiaRenderer        = new LeiaRenderer(leiaHoloScreen);

    scene  = new THREE.Scene();
    addObjects();
    addEvents();
}
```
#### The addObjects Function ####
```
function addObjects() {
    // Add three.js objects here
}
```
Most of our scene set up will be done in the addObjects function.

#### The addEvents Function ####
```
function addEvents() {
    // Add event handlers here
    leiaKeys = new LeiaKeystrokeHandler(scene, leiaHoloScreen, leiaRenderer, true);
}
```
This is where we will add event handlers as necessary such as the leiaKeys handler.

#### The animate Function ####
```
function animate() {
    requestAnimationFrame(animate);

    // Add animation logic here

    // Render scene
    leiaRenderer.render(scene, leiaHoloScreen);
}
```
Anything we want to animate or change will go in the animate() loop.

#### window.onload ####
```
window.onload = function () {
    // Start initialization and render once page has loaded
    init();
    animate();
};
```
After the browser has completed necessary tasks such as loading scripts, our callback function will be called.

Now lets go through an example of what it takes to render the simplest single shape scene using LeiaCore and [three.js](http://threejs.org).

## Generate A Cube ##

Now we need to actually build something to send to our new scene. Lets start with a single cube, and see what it takes to place it into our new basic scene.

First we'll need to define what kind of geometry we'll be building a displayable 3D object for. three.js provides a whole assortment of prebuilt primitives for us to use to base any other more complex shape out of. For now lets just focus on rendering one though. Inside our addObjects function we instantiate a THREE [BoxGeometry()](http://threejs.org/docs/#Reference/Extras.Geometries/BoxGeometry) thusly:
```
var boxGeometry = new THREE.BoxGeometry(6, 6, 6);
```
This gives us a 6x6x6 (x:6, y:6, z:6) instance of [BoxGeometry()](http://threejs.org/docs/#Reference/Extras.Geometries/BoxGeometry) as boxGeometry.

Next we need to tell three.js what kind of material we want our new box to use when we render it. Just like with three.js' geometries, there are a plethora of available materials to choose from. The simplest possible one in our context is a [MeshBasicMaterial()](http://threejs.org/docs/#Reference/Materials/MeshBasicMaterial). Here's how you construct an instance of one:
```
var greenMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
```
This will give us a MeshBasicMaterial() set to the color green as greenMaterial.

Now that we have a geometry and a material constructed, we need to get three.js to use them to generate the actual shape we've embodied in these two dependent objects. For this we'll generate a three.js Mesh() like so:
```
var cube = new THREE.Mesh(boxGeometry, greenMaterial);
```
Now we have a three.js Mesh() instantiated as the cube variable. This completes the basics for constructing our cube, but we will need to get the shape into the viewable environment. For this we need to add it to the scene.

**Note:** Normally, if we were going to play around with the initial position of our object(s), this would be a good place in the initialization routine to set their default state, and initial orientation or global placement in our scene. For the purposes of this example, we're just going to let three.js render our cube from the 0,0,0 origin point in the world coordinate space. three.js will assume that our cube's world origin is already at 0,0,0, and is identical to if we had called:
```
cube.position.set(0,0,0);
```
Now that we've built a simple cube we can add it to the scene we created earlier. It's literally this easy:
```
scene.add(cube);
```
At this point, the addObjects function should look identical to:
```
function addObjects() {
    // Add three.js objects here
    var boxGeometry = new THREE.BoxGeometry(6, 6, 6);
    var greenMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    var cube = new THREE.Mesh(boxGeometry, greenMaterial);
    cube.position.set(0,0,0);
    scene.add(cube);
}
```
## Putting It All Together ##

The [complete HTML file](https://github.com/LeiaInc/LeiaSingleShape/blob/master/index.html) filled in with our new 3D shape, and all of our LEIA rendering code is [available here](https://github.com/LeiaInc/LeiaSingleShape/blob/master/index.html), and should look identical to:
```
<!DOCTYPE html>
<head>
    <meta charset="utf-8">
    <title>Single Shape Demo Example</title>
    <style type="text/css">
    body {   
        overflow          : hidden;
        background-color  :  black;
        margin            : 0 0 0 0;
        padding           : 0 0 0 0;
        -webkit-transform : rotate(0deg);
    }
    </style>
    <script src="https://www.leiainc.com/devkit/examples/js/three.js"></script>
    <script src="https://www.leiainc.com/devkit/build/LeiaCore.js"></script>
</head>
<body></body>
<script>
    // Add global variables here

    // three.js scene
    var scene;

    // Essential LEIA objects
    var leiaDisplayInfo, leiaHoloScreen, leiaRenderer, leiaKeys;

    window.onload = function () {
        // Start initialization and render once page has loaded
        init();
        animate();
    };

    function init() {
        // Initialize everything that LEIA needs
        leiaDisplayInfo     = new LeiaDisplayInfo('https://www.leiainc.com/devkit/config/displayPrototypeSmallDevKit.json');
        leiaHoloScreen      = new LeiaHoloScreen(leiaDisplayInfo);
        leiaRenderer        = new LeiaRenderer(leiaHoloScreen);

        // Init three.js scene
        scene  = new THREE.Scene();

        addObjects();
        addEvents();

        document.body.appendChild(leiaRenderer.renderer.domElement);
    }

    function addObjects() {
        // Add three.js objects here
        var boxGeometry = new THREE.BoxGeometry(6, 6, 6);
        var greenMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        var cube = new THREE.Mesh(boxGeometry, greenMaterial);
        cube.position.set(0,0,0);
        scene.add(cube);
    }

    function addEvents() {
        // Add event handlers here
        leiaKeys = new LeiaKeystrokeHandler(scene, leiaHoloScreen, leiaRenderer, true);
    }

    function animate() {
        requestAnimationFrame(animate);

        // Add animation logic here

        // Render scene
        leiaRenderer.render(scene, leiaHoloScreen);
    }

</script>
</html>
```
When you are ready for more, lets move on to creating a more complex scene in our [LeiaFourShapeScene](https://github.com/LeiaInc/LeiaFourShapeScene) demo!
