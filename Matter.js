// Matter.js module aliases
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Render = Matter.Render;
const Constraint = Matter.Constraint;

// Game variables
let engine;
let world;
let testBox;

// Canvas settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

function setup() {
    // Create p5.js canvas
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('gameCanvas');
    
    // Initialize Matter.js physics engine
    engine = Engine.create();
    world = engine.world;
    
    // Disable gravity for classic Pong feel
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    
    // Create a test rectangle to confirm everything is working
    testBox = Bodies.rectangle(width/2, height/2, 60, 60);
    
    // Add the test box to the world
    World.add(world, testBox);
}

function draw() {
    // Update physics
    Engine.update(engine);
    
    // Clear canvas with dark background
    background(26, 26, 26);
    
    // Draw test box
    push();
    fill(0, 255, 136); // Bright green
    stroke(0, 255, 136);
    strokeWeight(2);
    
    // Get the test box position and angle from Matter.js
    let pos = testBox.position;
    let angle = testBox.angle;
    
    // Draw the box at its physics position
    translate(pos.x, pos.y);
    rotate(angle);
    rectMode(CENTER);
    rect(0, 0, 60, 60);
    pop();
    
    // Draw some helpful debug info
    fill(255);
    textAlign(LEFT);
    text(`FPS: ${Math.round(frameRate())}`, 10, 20);
    text(`Physics Bodies: ${world.bodies.length}`, 10, 40);
    text(`Test Box Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 10, 60);
}

// Add some interactivity - click to move the test box
function mousePressed() {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        // Set the test box position to mouse position
        Body.setPosition(testBox, { x: mouseX, y: mouseY });
        
        // Add a little spin for fun
        Body.setAngularVelocity(testBox, random(-0.1, 0.1));
        
        console.log(`🎯 Test box moved to (${mouseX}, ${mouseY})`);
    }
}

// Keyboard interaction for testing
function keyPressed() {
    if (key === ' ') {
        // Spacebar: reset test box to center
        Body.setPosition(testBox, { x: width/2, y: height/2 });
        Body.setAngle(testBox, 0);
        Body.setVelocity(testBox, { x: 0, y: 0 });
        Body.setAngularVelocity(testBox, 0);
        console.log("🔄 Test box reset to center");
    }
    
    if (key === 'g' || key === 'G') {
        // Toggle gravity for fun
        if (engine.world.gravity.y === 0) {
            engine.world.gravity.y = 0.8;
            console.log("🌍 Gravity enabled");
        } else {
            engine.world.gravity.y = 0;
            console.log("🚀 Gravity disabled");
        }
    }
}