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

// Touch/mouse input
let mouseInput = {
    active: false,
    targetY: 0,
    leftPaddleTarget: 0,
    rightPaddleTarget: 0,
    smoothing: 0.08,  // Slower smoothing for deliberate lag
    deadZone: 15      // Minimum distance before movement starts
};

// Particle systems
let particles = [];
let impactParticles = [];

// Canvas settings
const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 400;

// Game constants
const BALL_SPEED    = 6;
const BALL_RADIUS   = 12;
const PADDLE_WIDTH  = 20;
const PADDLE_HEIGHT = 80;

// Enhanced movement constants (tuned for faster response)
const SUPPORT_SPEED     = 6.5;  // Bumped up from 4.5
const SUPPORT_ACCEL     = 1.2;  // Increased acceleration
const INPUT_SMOOTHING   = 0.25; // More responsive
const SUPPORT_MAX_SPEED = 8;    // Higher max speed

// Touch/mouse control constants
const MOUSE_SPEED_LIMIT = 4;    // Max speed for mouse movement
const MOUSE_LAG_FACTOR  = 0.12; // How much lag in mouse following
const TOUCH_SENSITIVITY = 1.2;  // Touch movement multiplier

// Spring physics constants (tuned for bounciness!)
const PADDLE_MASS       = 0.6;  // Lighter for more bounce
const SPRING_LENGTH     = 40;
const SPRING_DAMPING    = 0.4;  // Much less damping = more bounce!
const SPRING_STIFFNESS  = 0.035; // Higher stiffness = snappier

// Visual enhancement constants
const TRAIL_SEGMENTS        = 8;
const PADDLE_GLOW_DISTANCE  = 25;
const SPRING_GLOW_INTENSITY = 120; // More intense glow

// Particle system constants
const MAX_PARTICLES         = 100;
const PARTICLE_LIFE         = 60;
const IMPACT_PARTICLES      = 8;
const SPRING_PARTICLE_RATE  = 0.3;

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
    
    console.log("🎮 Sprong Phase 5 Complete!");
    console.log("✓ Particle effects system");
    console.log("✓ Tuned physics for maximum bounce");
    console.log("✓ Faster, more responsive paddles");
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
            restitution: 1.3,  // Even bouncier!
            friction: 0,
            frictionAir: 0.005 // Less air resistance
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
            restitution: 1.3,
            friction: 0,
            frictionAir: 0.005
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
    
    // Update particle systems
    updateParticles();
    checkCollisions();
    
    // Check for scoring
    checkBallPosition();
    
    // Clear canvas
    background(10, 10, 10);
    
    // Draw particles behind everything
    drawParticles();
    
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
    // Handle both keyboard and mouse/touch input
    handleKeyboardInput();
    handleMouseTouchInput();
}

function handleKeyboardInput() {
    // Smooth input accumulation with acceleration
    let leftInput   = 0;
    let rightInput  = 0;
    
    // Left paddle input (W/S keys)
    if (keys['w'] || keys['W']) leftInput -= 1;
    if (keys['s'] || keys['S']) leftInput += 1;
    
    // Right paddle input (Arrow keys)
    if (keys['ArrowUp'])    rightInput -= 1;
    if (keys['ArrowDown'])  rightInput += 1;
    
    // Apply acceleration and smoothing for keyboard
    inputBuffer.left = lerp(inputBuffer.left, leftInput, INPUT_SMOOTHING);
    inputBuffer.right = lerp(inputBuffer.right, rightInput, INPUT_SMOOTHING);
    
    // Move supports with enhanced physics (only if not using mouse)
    if (!mouseInput.active) {
        if (Math.abs(inputBuffer.left) > 0.01) {
            moveSupportEnhanced(leftSupport, inputBuffer.left * SUPPORT_SPEED);
        }
        if (Math.abs(inputBuffer.right) > 0.01) {
            moveSupportEnhanced(rightSupport, inputBuffer.right * SUPPORT_SPEED);
        }
    }
}

function handleMouseTouchInput() {
    if (!mouseInput.active) return;
    
    // Determine which paddle to control based on mouse X position
    let controllingLeft = mouseX < width / 2;
    let targetSupport = controllingLeft ? leftSupport : rightSupport;
    
    // Calculate target Y with dead zone
    let currentY = targetSupport.position.y;
    let targetY = mouseY;
    let deltaY = targetY - currentY;
    
    // Apply dead zone - don't move unless mouse is far enough
    if (Math.abs(deltaY) < mouseInput.deadZone) {
        return;
    }
    
    // Calculate movement with lag and speed limiting
    let movement = deltaY * MOUSE_LAG_FACTOR * TOUCH_SENSITIVITY;
    
    // Limit maximum speed to prevent snappy movement
    movement = constrain(movement, -MOUSE_SPEED_LIMIT, MOUSE_SPEED_LIMIT);
    
    // Apply the lagged movement
    moveSupportEnhanced(targetSupport, movement);
    
    // Visual feedback - update input buffer for particle effects
    if (controllingLeft) {
        inputBuffer.left = constrain(movement / MOUSE_SPEED_LIMIT, -1, 1);
    } else {
        inputBuffer.right = constrain(movement / MOUSE_SPEED_LIMIT, -1, 1);
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

function checkCollisions() {
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    
    // Check paddle collisions for particle effects
    let leftDist = dist(ballPos.x, ballPos.y, leftPaddle.position.x, leftPaddle.position.y);
    let rightDist = dist(ballPos.x, ballPos.y, rightPaddle.position.x, rightPaddle.position.y);
    
    // Collision threshold
    let collisionDist = BALL_RADIUS + PADDLE_WIDTH/2 + 5;
    
    // Left paddle collision
    if (leftDist < collisionDist && ballVel.x < 0) {
        createImpactParticles(ballPos.x, ballPos.y, ballVel.x, ballVel.y);
    }
    
    // Right paddle collision  
    if (rightDist < collisionDist && ballVel.x > 0) {
        createImpactParticles(ballPos.x, ballPos.y, ballVel.x, ballVel.y);
    }
}

function createImpactParticles(x, y, velX, velY) {
    for (let i = 0; i < IMPACT_PARTICLES; i++) {
        let angle = random(TWO_PI);
        let speed = random(2, 8);
        let size = random(2, 6);
        
        particles.push({
            x: x + random(-5, 5),
            y: y + random(-5, 5),
            vx: cos(angle) * speed - velX * 0.2,
            vy: sin(angle) * speed - velY * 0.2,
            size: size,
            life: PARTICLE_LIFE,
            maxLife: PARTICLE_LIFE,
            color: { r: 255, g: random(100, 255), b: random(100, 150) },
            type: 'impact'
        });
    }
}

function createSpringParticles(springPos, compression) {
    if (random() < SPRING_PARTICLE_RATE * compression) {
        let angle = random(TWO_PI);
        let speed = random(1, 3) * compression;
        
        particles.push({
            x: springPos.x + random(-10, 10),
            y: springPos.y + random(-10, 10),
            vx: cos(angle) * speed,
            vy: sin(angle) * speed,
            size: random(1, 3),
            life: PARTICLE_LIFE * 0.5,
            maxLife: PARTICLE_LIFE * 0.5,
            color: { r: 0, g: 255, b: 136 },
            type: 'spring'
        });
    }
}

function updateParticles() {
    // Update and remove dead particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        
        // Apply drag
        p.vx *= 0.98;
        p.vy *= 0.98;
        
        // Update life
        p.life--;
        
        // Remove dead particles
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Limit particle count
    if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
    }
}

function drawParticles() {
    for (let p of particles) {
        let alpha = map(p.life, 0, p.maxLife, 0, 255);
        
        push();
        translate(p.x, p.y);
        
        if (p.type === 'impact') {
            // Impact particles: bright sparks
            fill(p.color.r, p.color.g, p.color.b, alpha);
            noStroke();
            ellipse(0, 0, p.size, p.size);
            
            // Add glow
            fill(p.color.r, p.color.g, p.color.b, alpha * 0.3);
            ellipse(0, 0, p.size * 2, p.size * 2);
            
        } else if (p.type === 'spring') {
            // Spring particles: green energy
            fill(p.color.r, p.color.g, p.color.b, alpha);
            noStroke();
            ellipse(0, 0, p.size, p.size);
        }
        
        pop();
    }
}

function drawSpringPaddleSystemsEnhanced() {
    // Draw springs with enhanced visuals and particles
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
    let leftCompression = drawSpringLineEnhanced(leftSupportPos, leftPaddlePos);
    createSpringParticles(leftPaddlePos, leftCompression);
    
    // Right spring
    let rightSupportPos = rightSupport.position;
    let rightPaddlePos = rightPaddle.position;
    let rightCompression = drawSpringLineEnhanced(rightSupportPos, rightPaddlePos);
    createSpringParticles(rightPaddlePos, rightCompression);
}

function drawSpringLineEnhanced(startPos, endPos) {
    let segments = 12; // More segments for smoother springs
    let amplitude = 10; // Bigger amplitude for more dramatic effect
    
    // Calculate spring compression for visual effects
    let currentLength = dist(startPos.x, startPos.y, endPos.x, endPos.y);
    let compression = SPRING_LENGTH / currentLength;
    amplitude *= compression;
    
    // Enhanced spring glow based on compression
    let glowIntensity = 150 + compression * SPRING_GLOW_INTENSITY;
    stroke(0, 255, 136, glowIntensity);
    strokeWeight(3 + compression * 2); // Thicker when compressed
    
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
            let offset = sin(i * PI * 1.5) * amplitude; // More dramatic oscillation
            x += perpX * offset;
            y += perpY * offset;
        }
        
        vertex(x, y);
    }
    
    endShape();
    
    // Add spring glow effect with pulsing
    let pulse = sin(frameCount * 0.1) * 0.2 + 1;
    stroke(0, 255, 136, glowIntensity * 0.4 * pulse);
    strokeWeight(8 + compression * 3);
    beginShape();
    noFill();
    
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        let x = lerp(startPos.x, endPos.x, t);
        let y = lerp(startPos.y, endPos.y, t);
        vertex(x, y);
    }
    
    endShape();
    
    return compression; // Return compression for particle effects
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
    let glowIntensity = map(ballDistance, 0, PADDLE_GLOW_DISTANCE, 150, 0);
    glowIntensity = constrain(glowIntensity, 0, 150);
    
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    
    // Draw enhanced glow effect first
    if (glowIntensity > 0) {
        fill(0, 255, 136, glowIntensity * 0.6);
        noStroke();
        rectMode(CENTER);
        rect(0, 0, PADDLE_WIDTH + 12, PADDLE_HEIGHT + 12);
        
        // Add outer glow
        fill(0, 255, 136, glowIntensity * 0.3);
        rect(0, 0, PADDLE_WIDTH + 20, PADDLE_HEIGHT + 20);
    }
    
    // Draw main paddle with enhanced visual
    fill(0, 255, 136);
    stroke(0, 255, 136, 220 + glowIntensity * 0.5);
    strokeWeight(3);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    // Add core highlight
    fill(150, 255, 200, 100);
    noStroke();
    rect(0, 0, PADDLE_WIDTH - 4, PADDLE_HEIGHT - 4);
    
    pop();
}

function drawSupportPointsEnhanced() {
    // Enhanced support indicators with input feedback
    let leftActivity = Math.abs(inputBuffer.left) * 255;
    let rightActivity = Math.abs(inputBuffer.right) * 255;
    
    // Left support with pulsing effect
    let leftPulse = sin(frameCount * 0.2) * 0.3 + 1;
    fill(0, 255, 136, 100 + leftActivity * 0.6);
    noStroke();
    ellipse(leftSupport.position.x, leftSupport.position.y, 
           (8 + leftActivity * 0.15) * leftPulse, 
           (8 + leftActivity * 0.15) * leftPulse);
    
    // Right support with pulsing effect
    let rightPulse = sin(frameCount * 0.2 + PI) * 0.3 + 1;
    fill(0, 255, 136, 100 + rightActivity * 0.6);
    ellipse(rightSupport.position.x, rightSupport.position.y, 
           (8 + rightActivity * 0.15) * rightPulse, 
           (8 + rightActivity * 0.15) * rightPulse);
}

function drawBallEnhanced() {
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    let speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    // Enhanced ball with speed-based effects
    let speedIntensity = map(speed, 0, 15, 50, 255);
    
    // Multi-layered trail effect
    for (let i = 0; i < 3; i++) {
        let offset = i * 3;
        fill(255, 100, 100, 40 - i * 10);
        noStroke();
        ellipse(ballPos.x - ballVel.x * offset * 0.1, 
               ballPos.y - ballVel.y * offset * 0.1, 
               BALL_RADIUS * (4 - i), BALL_RADIUS * (4 - i));
    }
    
    // Main ball with enhanced glow
    fill(255, 100, 100);
    stroke(255, 200, 200, speedIntensity);
    strokeWeight(3 + speed * 0.15);
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 2, BALL_RADIUS * 2);
    
    // Speed indicator core
    if (speed > 8) {
        fill(255, 255, 255, speedIntensity * 0.8);
        noStroke();
        ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 0.8, BALL_RADIUS * 0.8);
    }
    
    // Outer energy ring for high speeds
    if (speed > 12) {
        noFill();
        stroke(255, 255, 255, speedIntensity * 0.5);
        strokeWeight(2);
        ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 3, BALL_RADIUS * 3);
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
    text(`Particles: ${particles.length}`, 10, 50);
    
    // Enhanced spring info
    let leftSpringLength = dist(leftSupport.position.x, leftSupport.position.y, 
                               leftPaddle.position.x, leftPaddle.position.y);
    let rightSpringLength = dist(rightSupport.position.x, rightSupport.position.y, 
                                rightPaddle.position.x, rightPaddle.position.y);
    
    text(`L Spring: ${Math.round(leftSpringLength)}px (${((SPRING_LENGTH/leftSpringLength - 1) * 100).toFixed(0)}%)`, 10, 65);
    text(`R Spring: ${Math.round(rightSpringLength)}px (${((SPRING_LENGTH/rightSpringLength - 1) * 100).toFixed(0)}%)`, 10, 80);
    text(`Input: L=${inputBuffer.left.toFixed(2)} R=${inputBuffer.right.toFixed(2)}`, 10, 95);
    
    // Mouse/touch input debug
    if (mouseInput.active) {
        text(`Mouse: ${mouseInput.active ? 'Active' : 'Inactive'} | Side: ${mouseX < width/2 ? 'Left' : 'Right'}`, 10, 110);
        text(`Mouse Y: ${mouseY} | Dead Zone: ${mouseInput.deadZone}px`, 10, 125);
    }
}

function drawStartMessage() {
    fill(0, 255, 136, 200);
    textAlign(CENTER);
    textSize(20);
    text("Press any key to start!", width/2, height/2 + 100);
    textSize(14);
    text("Keyboard: W/S + ↑/↓ | Mouse/Touch: Drag paddles", width/2, height/2 + 125);
    textSize(12);
    text("(Mouse movement has deliberate lag to preserve challenge!)", width/2, height/2 + 145);
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
        
        // Reset mouse input
        mouseInput.active = false;
        
        // Clear particles
        particles = [];
        
        console.log("🔄 Game reset!");
    }
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}

// Mouse/touch input handlers
function mousePressed() {
    // Start mouse/touch input when clicking in game area
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        mouseInput.active = true;
        
        // Start game if not started
        if (!gameStarted) {
            gameStarted = true;
        }
        
        return false; // Prevent default behavior
    }
}

function mouseDragged() {
    // Continue mouse/touch input while dragging
    if (mouseInput.active) {
        return false; // Prevent default behavior
    }
}

function mouseReleased() {
    // Stop mouse/touch input when releasing
    mouseInput.active = false;
    
    // Gradually reduce input buffer when mouse is released
    inputBuffer.left *= 0.8;
    inputBuffer.right *= 0.8;
}

function touchStarted() {
    // Handle touch events same as mouse
    return mousePressed();
}

function touchMoved() {
    // Handle touch drag same as mouse
    return mouseDragged();
}

function touchEnded() {
    // Handle touch end same as mouse
    mouseReleased();
    return false;
}