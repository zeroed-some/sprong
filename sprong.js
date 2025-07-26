// Matter.js module aliases
const Body = Matter.Body;
const World = Matter.World;
const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Render = Matter.Render;
const Constraint = Matter.Constraint;

// Game variables
let ball;
let world;
let engine;

// Spring paddle system components
let boundaries = [];
let leftSupport, leftPaddle, leftSpring;
let rightSupport, rightPaddle, rightSpring;

// Game state
let leftScore = 0;
let rightScore = 0;
let gameStarted = false;

// Player input
let keys = {};
let inputBuffer = { left: 0, right: 0 };

// Canvas settings
const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 400;

// Game constants
const BALL_SPEED    = 6;
const BALL_RADIUS   = 12;
const PADDLE_WIDTH  = 20;
const PADDLE_HEIGHT = 80;

// Enhanced movement constants
const SUPPORT_SPEED     = 4.5;
const SUPPORT_ACCEL     = 0.8;
const INPUT_SMOOTHING   = 0.15;
const SUPPORT_MAX_SPEED = 6;

// Spring physics constants
const PADDLE_MASS       = 0.8;
const SPRING_LENGTH     = 40;
const SPRING_DAMPING    = 0.8;
const SPRING_STIFFNESS  = 0.02;

// Visual enhancement constants
const TRAIL_SEGMENTS        = 8;
const PADDLE_GLOW_DISTANCE  = 25;
const SPRING_GLOW_INTENSITY = 80;

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
    
    // Create game boundaries (top and bottom walls)
    let topWall = Bodies.rectangle(width/2, -10, width, 20, { isStatic: true });
    let bottomWall = Bodies.rectangle(width/2, height + 10, width, 20, { isStatic: true });
    boundaries.push(topWall, bottomWall);
    
    // Create spring paddle systems
    createSpringPaddleSystem('left');
    createSpringPaddleSystem('right');
    
    // Create ball
    resetBall();
    
    // Add everything to the world
    World.add(world, [
        ...boundaries, 
        ball,
        leftSupport, leftPaddle, leftSpring,
        rightSupport, rightPaddle, rightSpring
    ]);
}

function createSpringPaddleSystem(side) {
    let supportX = side === 'left' ? 60 : width - 60;
    let paddleX = side === 'left' ? 60 + SPRING_LENGTH : width - 60 - SPRING_LENGTH;
    let startY = height / 2;
    
    if (side === 'left') {
        // Left support (invisible anchor point controlled by player)
        leftSupport = Bodies.rectangle(supportX, startY, 10, 10, {
            isStatic: true,
            render: { visible: false }
        });
        
        // Left paddle (the actual hitting surface)
        leftPaddle = Bodies.rectangle(paddleX, startY, PADDLE_WIDTH, PADDLE_HEIGHT, {
            mass: PADDLE_MASS,
            restitution: 1.2,
            friction: 0,
            frictionAir: 0.01
        });
        
        // Spring constraint connecting support to paddle
        leftSpring = Constraint.create({
            bodyA: leftSupport,
            bodyB: leftPaddle,
            length: SPRING_LENGTH,
            stiffness: SPRING_STIFFNESS,
            damping: SPRING_DAMPING
        });
    } else {
        // Right support (invisible anchor point controlled by player/AI)
        rightSupport = Bodies.rectangle(supportX, startY, 10, 10, {
            isStatic: true,
            render: { visible: false }
        });
        
        // Right paddle (the actual hitting surface)
        rightPaddle = Bodies.rectangle(paddleX, startY, PADDLE_WIDTH, PADDLE_HEIGHT, {
            mass: PADDLE_MASS,
            restitution: 1.2,
            friction: 0,
            frictionAir: 0.01
        });
        
        // Spring constraint connecting support to paddle
        rightSpring = Constraint.create({
            bodyA: rightSupport,
            bodyB: rightPaddle,
            length: SPRING_LENGTH,
            stiffness: SPRING_STIFFNESS,
            damping: SPRING_DAMPING
        });
    }
}

function draw() {
    // Update physics
    Engine.update(engine);
    
    // Handle enhanced player input
    handleEnhancedInput();
    
    // Check for scoring
    checkBallPosition();
    
    // Clear canvas
    background(10, 10, 10);
    
    // Draw game objects with enhanced visuals
    drawSpringPaddleSystemsEnhanced();
    drawBallEnhanced();
    drawBoundaries();
    drawCenterLine();
    
    // Draw debug info
    drawDebugInfo();
    
    // Start message
    if (!gameStarted) {
        drawStartMessage();
    }
}

function handleEnhancedInput() {
    // Smooth input accumulation with acceleration
    let leftInput = 0;
    let rightInput = 0;
    
    // Left paddle input (W/S keys)
    if (keys['w'] || keys['W']) leftInput -= 1;
    if (keys['s'] || keys['S']) leftInput += 1;
    
    // Right paddle input (Arrow keys)
    if (keys['ArrowUp']) rightInput -= 1;
    if (keys['ArrowDown']) rightInput += 1;
    
    // Apply acceleration and smoothing
    inputBuffer.left = lerp(inputBuffer.left, leftInput, INPUT_SMOOTHING);
    inputBuffer.right = lerp(inputBuffer.right, rightInput, INPUT_SMOOTHING);
    
    // Move supports with enhanced physics
    if (Math.abs(inputBuffer.left) > 0.01) {
        moveSupportEnhanced(leftSupport, inputBuffer.left * SUPPORT_SPEED);
    }
    if (Math.abs(inputBuffer.right) > 0.01) {
        moveSupportEnhanced(rightSupport, inputBuffer.right * SUPPORT_SPEED);
    }
}

function moveSupportEnhanced(support, deltaY) {
    let newY = support.position.y + deltaY;
    
    // Keep support within reasonable bounds with smooth clamping
    let minY = 50;
    let maxY = height - 50;
    
    if (newY < minY) {
        newY = minY + (newY - minY) * 0.1; // Soft boundary
    } else if (newY > maxY) {
        newY = maxY + (newY - maxY) * 0.1; // Soft boundary
    }
    
    Body.setPosition(support, { x: support.position.x, y: newY });
}

function drawSpringPaddleSystemsEnhanced() {
    // Draw springs with enhanced visuals
    drawSpringsEnhanced();
    
    // Draw paddles with glow effects
    drawPaddlesWithGlow();
    
    // Draw support points with input feedback
    drawSupportPointsEnhanced();
}

function drawSpringsEnhanced() {
    // Left spring
    let leftSupportPos = leftSupport.position;
    let leftPaddlePos = leftPaddle.position;
    drawSpringLineEnhanced(leftSupportPos, leftPaddlePos);
    
    // Right spring
    let rightSupportPos = rightSupport.position;
    let rightPaddlePos = rightPaddle.position;
    drawSpringLineEnhanced(rightSupportPos, rightPaddlePos);
}

function drawSpringLineEnhanced(startPos, endPos) {
    let segments = 10;
    let amplitude = 8;
    
    // Calculate spring compression for visual effects
    let currentLength = dist(startPos.x, startPos.y, endPos.x, endPos.y);
    let compression = SPRING_LENGTH / currentLength;
    amplitude *= compression;
    
    // Enhanced spring glow based on compression
    let glowIntensity = 150 + compression * SPRING_GLOW_INTENSITY;
    stroke(0, 255, 136, glowIntensity);
    strokeWeight(2 + compression * 1.5);
    
    // Draw spring coil with smooth curves
    beginShape();
    noFill();
    
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        let x = lerp(startPos.x, endPos.x, t);
        let y = lerp(startPos.y, endPos.y, t);
        
        // Enhanced zigzag with smoother curves
        if (i > 0 && i < segments) {
            let perpX = -(endPos.y - startPos.y) / currentLength;
            let perpY = (endPos.x - startPos.x) / currentLength;
            let offset = sin(i * PI * 1.2) * amplitude;
            x += perpX * offset;
            y += perpY * offset;
        }
        
        vertex(x, y);
    }
    
    endShape();
    
    // Add spring glow effect
    stroke(0, 255, 136, glowIntensity * 0.3);
    strokeWeight(6 + compression * 2);
    beginShape();
    noFill();
    
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        let x = lerp(startPos.x, endPos.x, t);
        let y = lerp(startPos.y, endPos.y, t);
        vertex(x, y);
    }
    
    endShape();
}

function drawPaddlesWithGlow() {
    // Calculate ball distance for glow effects
    let ballPos = ball.position;
    let leftDist = dist(ballPos.x, ballPos.y, leftPaddle.position.x, leftPaddle.position.y);
    let rightDist = dist(ballPos.x, ballPos.y, rightPaddle.position.x, rightPaddle.position.y);
    
    // Enhanced paddle drawing
    drawSinglePaddleEnhanced(leftPaddle, leftDist);
    drawSinglePaddleEnhanced(rightPaddle, rightDist);
}

function drawSinglePaddleEnhanced(paddle, ballDistance) {
    let pos = paddle.position;
    let angle = paddle.angle;
    
    // Calculate glow intensity based on ball proximity
    let glowIntensity = map(ballDistance, 0, PADDLE_GLOW_DISTANCE, 100, 0);
    glowIntensity = constrain(glowIntensity, 0, 100);
    
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    
    // Draw glow effect first
    if (glowIntensity > 0) {
        fill(0, 255, 136, glowIntensity * 0.5);
        noStroke();
        rectMode(CENTER);
        rect(0, 0, PADDLE_WIDTH + 8, PADDLE_HEIGHT + 8);
    }
    
    // Draw main paddle
    fill(0, 255, 136);
    stroke(0, 255, 136, 200 + glowIntensity);
    strokeWeight(2);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    pop();
}

function drawSupportPointsEnhanced() {
    // Enhanced support indicators with input feedback
    let leftActivity = Math.abs(inputBuffer.left) * 255;
    let rightActivity = Math.abs(inputBuffer.right) * 255;
    
    // Left support
    fill(0, 255, 136, 100 + leftActivity * 0.5);
    noStroke();
    ellipse(leftSupport.position.x, leftSupport.position.y, 8 + leftActivity * 0.1, 8 + leftActivity * 0.1);
    
    // Right support
    fill(0, 255, 136, 100 + rightActivity * 0.5);
    ellipse(rightSupport.position.x, rightSupport.position.y, 8 + rightActivity * 0.1, 8 + rightActivity * 0.1);
}

function drawBallEnhanced() {
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    let speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    // Enhanced ball with speed-based effects
    let speedIntensity = map(speed, 0, 15, 50, 255);
    
    // Ball trail effect
    fill(255, 100, 100, 30);
    noStroke();
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 4, BALL_RADIUS * 4);
    
    // Main ball
    fill(255, 100, 100);
    stroke(255, 150, 150, speedIntensity);
    strokeWeight(2 + speed * 0.1);
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 2, BALL_RADIUS * 2);
    
    // Speed indicator
    if (speed > 10) {
        fill(255, 255, 255, speedIntensity * 0.5);
        noStroke();
        ellipse(ballPos.x, ballPos.y, BALL_RADIUS, BALL_RADIUS);
    }
}

function drawBoundaries() {
    stroke(0, 255, 136, 30);
    strokeWeight(1);
    noFill();
    line(0, 0, width, 0);
    line(0, height, width, height);
}

function drawCenterLine() {
    stroke(0, 255, 136, 50);
    strokeWeight(2);
    
    for (let y = 0; y < height; y += 20) {
        line(width/2, y, width/2, y + 10);
    }
}

function drawDebugInfo() {
    fill(255, 100);
    textAlign(LEFT);
    textSize(12);
    text(`FPS: ${Math.round(frameRate())}`, 10, 20);
    text(`Ball Speed: ${Math.round(getBallSpeed())}`, 10, 35);
    
    // Enhanced spring info
    let leftSpringLength = dist(leftSupport.position.x, leftSupport.position.y, 
                               leftPaddle.position.x, leftPaddle.position.y);
    let rightSpringLength = dist(rightSupport.position.x, rightSupport.position.y, 
                                rightPaddle.position.x, rightPaddle.position.y);
    
    text(`Left Spring: ${Math.round(leftSpringLength)}px`, 10, 50);
    text(`Right Spring: ${Math.round(rightSpringLength)}px`, 10, 65);
    text(`Input Buffer: L=${inputBuffer.left.toFixed(2)} R=${inputBuffer.right.toFixed(2)}`, 10, 80);
}

function drawStartMessage() {
    fill(0, 255, 136, 200);
    textAlign(CENTER);
    textSize(20);
    text("Press any key to start!", width/2, height/2 + 100);
    textSize(14);
    text("Enhanced controls with smooth acceleration!", width/2, height/2 + 125);
}

function resetBall() {
    if (ball) {
        World.remove(world, ball);
    }
    
    // Create new ball at center
    ball = Bodies.circle(width/2, height/2, BALL_RADIUS, {
        restitution: 1,
        friction: 0,
        frictionAir: 0
    });
    
    if (world) {
        World.add(world, ball);
    }
    
    // Start ball moving after a short delay
    setTimeout(() => {
        let direction = random() > 0.5 ? 1 : -1;
        let angle = random(-PI/6, PI/6);
        
        Body.setVelocity(ball, {
            x: direction * BALL_SPEED * cos(angle),
            y: BALL_SPEED * sin(angle)
        });
        
        gameStarted = true;
    }, 1000);
}

function checkBallPosition() {
    let ballX = ball.position.x;
    
    if (ballX < -BALL_RADIUS) {
        rightScore++;
        updateScore();
        resetBall();
        gameStarted = false;
    }
    
    if (ballX > width + BALL_RADIUS) {
        leftScore++;
        updateScore();
        resetBall();
        gameStarted = false;
    }
}

function updateScore() {
    document.getElementById('leftScore').textContent = leftScore;
    document.getElementById('rightScore').textContent = rightScore;
}

function getBallSpeed() {
    let velocity = ball.velocity;
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}

// Input handling
function keyPressed() {
    keys[key] = true;
    keys[keyCode] = true;
    
    if (!gameStarted && key !== ' ') {
        gameStarted = true;
    }
    
    // Reset game with spacebar
    if (key === ' ') {
        leftScore = 0;
        rightScore = 0;
        updateScore();
        resetBall();
        gameStarted = false;
        
        // Reset input buffers
        inputBuffer.left = 0;
        inputBuffer.right = 0;
        
        console.log("🔄 Game reset!");
    }
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}