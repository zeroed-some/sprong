// Matter.js module aliases
const Body  = Matter.Body;
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
let gameMode    = 'vs-cpu';  // 'vs-cpu' or 'vs-human'
let leftScore   = 0;
let aiEnabled   = true;
let gameState   = 'menu';   // 'menu', 'playing', 'paused'
let rightScore  = 0;
let gameStarted = false;

// Menu state
let menuState = {
    selectedOption: 0,        // 0 = 1 Player, 1 = 2 Player
    options: ['1 Player vs CPU', '2 Player'],
    difficultySelected: 1,    // 0 = Easy, 1 = Medium, 2 = Hard
    difficulties: ['Easy', 'Medium', 'Hard'],
    showDifficulty: true
};

// AI system
let aiState = {
    targetY: 200,
    reactionDelay: 0,
    difficulty: 'medium', // 'easy', 'medium', 'hard'
    lastBallX: 0,
    lastUpdateTime: 0,
    
    // Advanced AI state machine
    mode: 'TRACKING',     // TRACKING, WINDING_UP, SWINGING, RECOVERING, ANTICIPATING
    windupStartTime: 0,
    swingStartTime: 0,
    interceptY: 200,
    windupDirection: 1,   // 1 for up, -1 for down
    aggressionLevel: 0.5, // 0 = defensive, 1 = maximum aggression
    lastHitTime: 0,
    
    // Oscillation parameters (tuned for smoother movement)
    windupDistance: 40,   // Slightly increased from 35 with longer spring
    swingPower: 1.05,     // Reduced from 1.1 for more control
    timingWindow: 40,     // Slightly longer execution window
    
    // Lifelike movement
    idleTarget: 200,      // Where AI "wants" to be when idle
    microAdjustment: 0,   // Small random movements
    breathingOffset: 0,   // Subtle breathing-like motion
    lastMicroTime: 0      // For micro-movement timing
};

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

// Spring physics constants (adjusted for better oscillation)
const PADDLE_MASS       = 0.8;  // Back to more stable value
const SPRING_LENGTH     = 50;   // Increased from 40 for more room
const SPRING_DAMPING    = 0.6;  // More damping = less erratic
const SPRING_STIFFNESS  = 0.025; // Slightly lower for smoother motion

// AI difficulty settings
const AI_SETTINGS = {
    easy: {
        reactionTime: 400,    // ms delay
        accuracy: 0.7,        // 70% accuracy
        speed: 0.6,           // 60% of normal speed
        prediction: 0.3,      // 30% prediction vs reaction
        aggression: 0.2,      // Low aggression
        oscillation: 0.3      // Minimal oscillation
    },
    medium: {
        reactionTime: 250,
        accuracy: 0.85,
        speed: 0.8,
        prediction: 0.6,
        aggression: 0.5,      // Moderate aggression
        oscillation: 0.7      // Good oscillation technique
    },
    hard: {
        reactionTime: 150,
        accuracy: 0.95,
        speed: 1.0,
        prediction: 0.8,
        aggression: 0.8,      // High aggression
        oscillation: 1.0      // Master-level oscillation
    }
};

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
            restitution: 1.2,  // Slightly toned down
            friction: 0,
            frictionAir: 0.008 // Bit more air resistance for stability
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
    
    // Clear canvas
    background(10, 10, 10);
    
    if (gameState === 'menu') {
        drawMenu();
    } else {
        // Handle enhanced player input
        handleEnhancedInput();
        
        // Update particle systems
        updateParticles();
        checkCollisions();
        
        // Check for scoring
        checkBallPosition();
        
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
}

function handleEnhancedInput() {
    // Handle both keyboard and mouse/touch input
    handleKeyboardInput();
    handleMouseTouchInput();
    
    // Handle AI if enabled
    if (aiEnabled && gameStarted) {
        handleAI();
    }
}

function handleKeyboardInput() {
    // Smooth input accumulation with acceleration
    let leftInput   = 0;
    let rightInput  = 0;
    
    // Left paddle input (W/S keys) - always player controlled
    if (keys['w'] || keys['W']) leftInput -= 1;
    if (keys['s'] || keys['S']) leftInput += 1;
    
    // Right paddle input (Arrow keys) - only if AI is disabled
    if (!aiEnabled) {
        if (keys['ArrowUp'])    rightInput -= 1;
        if (keys['ArrowDown'])  rightInput += 1;
    }
    
    // Apply acceleration and smoothing for keyboard
    inputBuffer.left = lerp(inputBuffer.left, leftInput, INPUT_SMOOTHING);
    if (!aiEnabled) {
        inputBuffer.right = lerp(inputBuffer.right, rightInput, INPUT_SMOOTHING);
    }
    
    // Move supports with enhanced physics (only if not using mouse)
    if (!mouseInput.active) {
        if (Math.abs(inputBuffer.left) > 0.01) {
            moveSupportEnhanced(leftSupport, inputBuffer.left * SUPPORT_SPEED);
        }
        if (!aiEnabled && Math.abs(inputBuffer.right) > 0.01) {
            moveSupportEnhanced(rightSupport, inputBuffer.right * SUPPORT_SPEED);
        }
    }
}

function handleMouseTouchInput() {
    if (!mouseInput.active) return;
    
    // Determine which paddle to control based on mouse X position
    let controllingLeft = mouseX < width / 2;
    
    // Don't allow mouse control of AI paddle
    if (!controllingLeft && aiEnabled) return;
    
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
    } else if (!aiEnabled) {
        inputBuffer.right = constrain(movement / MOUSE_SPEED_LIMIT, -1, 1);
    }
}

function handleAI() {
    let currentTime = millis();
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    let aiSettings = AI_SETTINGS[aiState.difficulty];
    
    // Update aggression based on score difference and time
    updateAIAggression();
    
    // Add lifelike micro-movements
    updateAILifelikeBehavior(currentTime);
    
    // Advanced AI state machine
    switch (aiState.mode) {
        case 'TRACKING':
            handleAITracking(currentTime, ballPos, ballVel, aiSettings);
            break;
        case 'WINDING_UP':
            handleAIWindup(currentTime, ballPos, ballVel, aiSettings);
            break;
        case 'SWINGING':
            handleAISwing(currentTime, ballPos, ballVel, aiSettings);
            break;
        case 'RECOVERING':
            handleAIRecovery(currentTime, ballPos, ballVel, aiSettings);
            break;
        case 'ANTICIPATING':
            handleAIAnticipation(currentTime, ballPos, ballVel, aiSettings);
            break;
    }
    
    // Apply movement with spring physics awareness
    executeAIMovement(aiSettings);
}

function updateAILifelikeBehavior(currentTime) {
    // Subtle breathing-like motion when not actively engaged
    aiState.breathingOffset = sin(currentTime * 0.003) * 3;
    
    // Random micro-adjustments every few seconds
    if (currentTime - aiState.lastMicroTime > 2000 + random(1000)) {
        aiState.microAdjustment = (random() - 0.5) * 15;
        aiState.lastMicroTime = currentTime;
    }
    
    // Gradually decay micro-adjustment
    aiState.microAdjustment *= 0.98;
    
    // Update idle target with slight wandering
    if (aiState.mode === 'ANTICIPATING' || aiState.mode === 'RECOVERING') {
        let centerY = height / 2;
        let wanderRadius = 25;
        aiState.idleTarget = centerY + sin(currentTime * 0.002) * wanderRadius;
    }
}

function updateAIAggression() {
    // Increase aggression when losing
    let scoreDiff = leftScore - rightScore;
    let baseAggression = AI_SETTINGS[aiState.difficulty].aggression;
    
    // Rage mode when losing by 2+ points
    if (scoreDiff >= 2) {
        aiState.aggressionLevel = Math.min(1.0, baseAggression + 0.3);
    } else if (scoreDiff >= 1) {
        aiState.aggressionLevel = Math.min(1.0, baseAggression + 0.15);
    } else {
        aiState.aggressionLevel = baseAggression;
    }
}

function handleAITracking(currentTime, ballPos, ballVel, aiSettings) {
    // Only react if enough time has passed (reaction delay)
    if (currentTime - aiState.lastUpdateTime < aiSettings.reactionTime) return;
    
    // Check if ball is approaching AI paddle
    let ballApproaching = ballVel.x > 0;
    let ballDistance = width - ballPos.x;
    let ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    if (ballApproaching && ballDistance < 280) {
        // Calculate intercept point with advanced prediction
        let timeToReach = ballDistance / Math.abs(ballVel.x);
        aiState.interceptY = ballPos.y + ballVel.y * timeToReach;
        
        // Account for wall bounces
        if (aiState.interceptY < 50) {
            aiState.interceptY = 100 - aiState.interceptY;
        } else if (aiState.interceptY > height - 50) {
            aiState.interceptY = 2 * (height - 50) - aiState.interceptY;
        }
        
        // Add accuracy error
        let error = (random() - 0.5) * 35 * (1 - aiSettings.accuracy);
        aiState.interceptY += error;
        
        // Smart oscillation decision: lower velocity threshold and more distance
        let shouldWindUp = ballSpeed < 7 &&           // Reduced from 9 - easier to trigger
                          ballDistance > 160 &&       // More distance required  
                          Math.abs(ballVel.y) < 5 &&  // Stricter vertical movement limit
                          random() < aiSettings.oscillation * aiState.aggressionLevel;
        
        if (shouldWindUp) {
            // Start winding up for power shot
            aiState.mode = 'WINDING_UP';
            aiState.windupStartTime = currentTime;
            
            // Determine windup direction (opposite of intercept)
            let currentY = rightSupport.position.y;
            aiState.windupDirection = aiState.interceptY > currentY ? -1 : 1;
            
        } else {
            // Simple tracking without oscillation
            aiState.targetY = aiState.interceptY;
        }
        
        aiState.lastUpdateTime = currentTime;
    } else {
        // When ball isn't approaching, do lifelike tracking
        let trackingY = ballPos.y + aiState.microAdjustment;
        trackingY = constrain(trackingY, 80, height - 80);
        aiState.targetY = lerp(aiState.targetY, trackingY, 0.02); // Very gentle tracking
    }
}

function handleAIWindup(currentTime, ballPos, ballVel, aiSettings) {
    let windupTime = currentTime - aiState.windupStartTime;
    let maxWindupTime = 350 / Math.max(aiState.aggressionLevel, 0.3); // Slower windup, minimum time
    
    // Calculate windup target (move away from intercept point)
    let currentY = rightSupport.position.y;
    let windupTarget = currentY + aiState.windupDirection * aiState.windupDistance * aiState.aggressionLevel;
    windupTarget = constrain(windupTarget, 70, height - 70); // More margin from edges
    
    aiState.targetY = windupTarget;
    
    // Check if it's time to swing - more conservative timing
    let ballDistance = width - ballPos.x;
    let ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    let shouldSwing = windupTime > maxWindupTime || 
                     ballDistance < 90 || 
                     ballSpeed > 8; // Lower threshold - abort if ball speeds up
    
    if (shouldSwing) {
        aiState.mode = 'SWINGING';
        aiState.swingStartTime = currentTime;
    }
}

function handleAISwing(currentTime, ballPos, ballVel, aiSettings) {
    // Aggressive swing toward intercept point
    aiState.targetY = aiState.interceptY;
    
    let swingTime = currentTime - aiState.swingStartTime;
    let maxSwingTime = aiState.timingWindow;
    
    // Check if swing is complete
    if (swingTime > maxSwingTime || Math.abs(ball.velocity.x) < 2) {
        aiState.mode = 'RECOVERING';
        aiState.lastHitTime = currentTime;
    }
}

function handleAIRecovery(currentTime, ballPos, ballVel, aiSettings) {
    // Return to idle position with lifelike movement
    aiState.targetY = aiState.idleTarget + aiState.breathingOffset;
    
    let recoveryTime = currentTime - aiState.lastHitTime;
    if (recoveryTime > 400) { // Faster recovery
        aiState.mode = 'ANTICIPATING';
    }
}

function handleAIAnticipation(currentTime, ballPos, ballVel, aiSettings) {
    // Stay near center with subtle lifelike movements
    aiState.targetY = aiState.idleTarget + aiState.breathingOffset + aiState.microAdjustment;
    
    // Switch back to tracking when ball changes direction
    if (ballVel.x > 0) {
        aiState.mode = 'TRACKING';
    }
}

function executeAIMovement(aiSettings) {
    // Move AI paddle toward target with speed limitation
    let currentY = rightSupport.position.y;
    let deltaY = aiState.targetY - currentY;
    
    if (Math.abs(deltaY) > 2) { // Smaller dead zone for more responsive micro-movements
        let baseSpeed = 0.06 * aiSettings.speed; // Slightly slower base movement
        
        // Apply swing power during swing phase
        if (aiState.mode === 'SWINGING') {
            baseSpeed *= aiState.swingPower * (1 + aiState.aggressionLevel * 0.3);
        } else if (aiState.mode === 'WINDING_UP') {
            baseSpeed *= 0.7; // Slower during windup for more deliberate movement
        }
        
        // Apply aggression multiplier
        baseSpeed *= (1 + aiState.aggressionLevel * 0.2);
        
        let movement = deltaY * baseSpeed;
        movement = constrain(movement, -SUPPORT_SPEED * 0.9, SUPPORT_SPEED * 0.9);
        
        moveSupportEnhanced(rightSupport, movement);
        
        // Update input buffer for visual effects
        inputBuffer.right = constrain(movement / (SUPPORT_SPEED * 0.9), -1, 1);
    } else {
        // Gradually reduce input buffer when AI is not moving
        inputBuffer.right *= 0.95;
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
    
    // Check if this is the AI paddle
    let isAI = aiEnabled && paddle === rightPaddle;
    
    // Calculate glow intensity based on ball proximity
    let glowIntensity = map(ballDistance, 0, PADDLE_GLOW_DISTANCE, 150, 0);
    glowIntensity = constrain(glowIntensity, 0, 150);
    
    // Add AI state-based effects
    if (isAI) {
        // Enhance glow during aggressive states
        if (aiState.mode === 'WINDING_UP') {
            glowIntensity += 50;
        } else if (aiState.mode === 'SWINGING') {
            glowIntensity += 100;
        }
        
        // Aggression-based glow
        glowIntensity += aiState.aggressionLevel * 30;
    }
    
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    
    // Different color scheme for AI paddle
    let paddleColor = isAI ? [255, 100, 100] : [0, 255, 136]; // Red for AI, green for player
    
    // AI mode indicator colors
    if (isAI && aiState.mode === 'WINDING_UP') {
        paddleColor = [255, 150, 50]; // Orange during windup
    } else if (isAI && aiState.mode === 'SWINGING') {
        paddleColor = [255, 50, 50]; // Bright red during swing
    }
    
    // Draw enhanced glow effect first
    if (glowIntensity > 0) {
        fill(paddleColor[0], paddleColor[1], paddleColor[2], glowIntensity * 0.6);
        noStroke();
        rectMode(CENTER);
        rect(0, 0, PADDLE_WIDTH + 12, PADDLE_HEIGHT + 12);
        
        // Add outer glow
        fill(paddleColor[0], paddleColor[1], paddleColor[2], glowIntensity * 0.3);
        rect(0, 0, PADDLE_WIDTH + 20, PADDLE_HEIGHT + 20);
    }
    
    // Draw main paddle with enhanced visual
    fill(paddleColor[0], paddleColor[1], paddleColor[2]);
    stroke(paddleColor[0], paddleColor[1], paddleColor[2], 220 + glowIntensity * 0.5);
    strokeWeight(3);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    // Add core highlight
    if (isAI) {
        fill(255, 200, 200, 100); // Light red highlight for AI
    } else {
        fill(150, 255, 200, 100); // Light green highlight for player
    }
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
    text(`Mode: ${aiEnabled ? 'vs CPU' : '2 Player'} | Difficulty: ${aiState.difficulty}`, 10, 65);
    
    // Enhanced spring info
    let leftSpringLength = dist(leftSupport.position.x, leftSupport.position.y, 
                               leftPaddle.position.x, leftPaddle.position.y);
    let rightSpringLength = dist(rightSupport.position.x, rightSupport.position.y, 
                                rightPaddle.position.x, rightPaddle.position.y);
    
    text(`L Spring: ${Math.round(leftSpringLength)}px (${((SPRING_LENGTH/leftSpringLength - 1) * 100).toFixed(0)}%)`, 10, 80);
    text(`R Spring: ${Math.round(rightSpringLength)}px (${((SPRING_LENGTH/rightSpringLength - 1) * 100).toFixed(0)}%)`, 10, 95);
    text(`Input: L=${inputBuffer.left.toFixed(2)} R=${inputBuffer.right.toFixed(2)}`, 10, 110);
    
    // Advanced AI debug info
    if (aiEnabled) {
        text(`AI State: ${aiState.mode} | Aggression: ${aiState.aggressionLevel.toFixed(2)}`, 10, 125);
        text(`Target: ${Math.round(aiState.targetY)} | Intercept: ${Math.round(aiState.interceptY)}`, 10, 140);
        text(`Ball: (${Math.round(ball.position.x)}, ${Math.round(ball.position.y)}) Vel: (${ball.velocity.x.toFixed(1)}, ${ball.velocity.y.toFixed(1)})`, 10, 155);
        
        // Show AI technique indicators
        if (aiState.mode === 'WINDING_UP') {
            fill(255, 150, 50, 200);
            text("AI WINDING UP FOR POWER SHOT", 10, 175);
        } else if (aiState.mode === 'SWINGING') {
            fill(255, 50, 50, 200);
            text("⚡ AI POWER SWING!", 10, 175);
        }
    }
    
    // Mouse/touch input debug
    if (mouseInput.active) {
        text(`Mouse: Active | Side: ${mouseX < width/2 ? 'Left' : 'Right'} | Y: ${mouseY}`, 10, 190);
    }
}

function drawMenu() {
    // Draw animated background
    drawMenuBackground();
    
    // Main title
    push();
    let titlePulse = sin(frameCount * 0.05) * 0.2 + 1;
    fill(0, 255, 136);
    textAlign(CENTER);
    textSize(60 * titlePulse);
    text("SPRONG", width/2, 120);
    
    // Subtitle
    fill(0, 255, 136, 150);
    textSize(16);
    text("Physics-based Pong with Spring Paddles", width/2, 150);
    pop();
    
    // Menu options
    let startY = height/2 - 20;
    let spacing = 60;
    
    for (let i = 0; i < menuState.options.length; i++) {
        let y = startY + i * spacing;
        let isSelected = i === menuState.selectedOption;
        
        // Selection indicator
        if (isSelected) {
            push();
            let pulse = sin(frameCount * 0.15) * 0.3 + 1;
            fill(0, 255, 136, 100 * pulse);
            noStroke();
            rectMode(CENTER);
            rect(width/2, y, 300, 45);
            pop();
        }
        
        // Option text
        fill(isSelected ? 255 : 200);
        textAlign(CENTER);
        textSize(isSelected ? 24 : 20);
        text(menuState.options[i], width/2, y + 8);
        
        // Show difficulty selector for 1 Player option
        if (i === 0 && isSelected && menuState.showDifficulty) {
            fill(0, 255, 136, 180);
            textSize(14);
            text(`Difficulty: ${menuState.difficulties[menuState.difficultySelected]}`, width/2, y + 28);
            text("(Use ← → to change)", width/2, y + 45);
        }
    }
    
    // Instructions
    fill(0, 255, 136, 120);
    textAlign(CENTER);
    textSize(14);
    text("Use ↑↓ to select, ENTER to confirm", width/2, height - 80);
    text("or click/touch to select", width/2, height - 60);
    
    // Show controls preview
    textSize(12);
    fill(255, 100);
    if (menuState.selectedOption === 0) {
        text("Controls: W/S keys or Mouse/Touch to move paddle", width/2, height - 30);
    } else {
        text("Controls: Player 1 (W/S) | Player 2 (↑/↓) | Mouse/Touch", width/2, height - 30);
    }
}

function drawMenuBackground() {
    // Draw subtle animated background elements
    push();
    stroke(0, 255, 136, 30);
    strokeWeight(1);
    
    // Animated grid
    for (let x = 0; x < width; x += 40) {
        let offset = sin(frameCount * 0.01 + x * 0.01) * 5;
        line(x, 0, x, height + offset);
    }
    
    for (let y = 0; y < height; y += 40) {
        let offset = cos(frameCount * 0.01 + y * 0.01) * 5;
        line(0, y, width + offset, y);
    }
    
    // Floating particles
    for (let i = 0; i < 20; i++) {
        let x = (frameCount * 0.5 + i * 137) % width;
        let y = (sin(frameCount * 0.01 + i) * 50 + height/2);
        let alpha = sin(frameCount * 0.02 + i) * 30 + 50;
        
        fill(0, 255, 136, alpha);
        noStroke();
        ellipse(x, y, 3, 3);
    }
    pop();
}

function drawStartMessage() {
    fill(0, 255, 136, 200);
    textAlign(CENTER);
    textSize(20);
    text("Press any key to start!", width/2, height/2 + 100);
    textSize(14);
    
    if (aiEnabled) {
        text("Player vs CPU | Left paddle: W/S or Mouse/Touch", width/2, height/2 + 125);
        text(`AI Difficulty: ${aiState.difficulty.toUpperCase()}`, width/2, height/2 + 145);
    } else {
        text("2 Player Mode | P1: W/S | P2: ↑/↓ | Mouse/Touch: Drag paddles", width/2, height/2 + 125);
    }
    
    textSize(12);
    fill(0, 255, 136, 120);
    text("Press ESC to return to menu", width/2, height/2 + 170);
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
    
    if (gameState === 'menu') {
        handleMenuInput();
        return;
    }
    
    if (!gameStarted && key !== ' ') {
        gameStarted = true;
    }
    
    // Toggle game mode (only during gameplay)
    if (key === 'm' || key === 'M') {
        aiEnabled = !aiEnabled;
        gameMode = aiEnabled ? 'vs-cpu' : 'vs-human';
        console.log(`Switched to ${gameMode} mode`);
    }
    
    // Change AI difficulty (only during gameplay)
    if (key === 'd' || key === 'D') {
        if (aiState.difficulty === 'easy') {
            aiState.difficulty = 'medium';
        } else if (aiState.difficulty === 'medium') {
            aiState.difficulty = 'hard';
        } else {
            aiState.difficulty = 'easy';
        }
        console.log(`AI difficulty: ${aiState.difficulty}`);
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
        
        // Reset AI state
        aiState.targetY = height / 2;
        aiState.lastUpdateTime = 0;
        aiState.mode = 'ANTICIPATING';
        aiState.aggressionLevel = AI_SETTINGS[aiState.difficulty].aggression;
        
        // Clear particles
        particles = [];
        
        console.log("Game reset!");
    }
    
    // Return to menu with ESC
    if (keyCode === 27) { // ESC key
        gameState = 'menu';
        gameStarted = false;
        particles = [];
        console.log("Returned to menu");
    }
}

function handleMenuInput() {
    // Navigate menu with arrow keys
    if (keyCode === UP_ARROW) {
        menuState.selectedOption = Math.max(0, menuState.selectedOption - 1);
    } else if (keyCode === DOWN_ARROW) {
        menuState.selectedOption = Math.min(menuState.options.length - 1, menuState.selectedOption + 1);
    }
    
    // Change difficulty for 1 Player mode
    if (menuState.selectedOption === 0) {
        if (keyCode === LEFT_ARROW) {
            menuState.difficultySelected = Math.max(0, menuState.difficultySelected - 1);
        } else if (keyCode === RIGHT_ARROW) {
            menuState.difficultySelected = Math.min(menuState.difficulties.length - 1, menuState.difficultySelected + 1);
        }
    }
    
    // Confirm selection with ENTER
    if (keyCode === ENTER || key === ' ') {
        startGameWithSelection();
    }
}

function startGameWithSelection() {
    // Set game mode based on selection
    if (menuState.selectedOption === 0) {
        // 1 Player vs CPU
        aiEnabled = true;
        gameMode = 'vs-cpu';
        aiState.difficulty = menuState.difficulties[menuState.difficultySelected].toLowerCase();
    } else {
        // 2 Player
        aiEnabled = false;
        gameMode = 'vs-human';
    }
    
    // Start the game
    gameState = 'playing';
    gameStarted = false; // Will start when user presses a key
    
    // Reset game state
    leftScore = 0;
    rightScore = 0;
    updateScore();
    resetBall();
    
    // Reset input buffers
    inputBuffer.left = 0;
    inputBuffer.right = 0;
    mouseInput.active = false;
    
    // Reset AI state
    aiState.targetY = height / 2;
    aiState.lastUpdateTime = 0;
    
    // Clear particles
    particles = [];
    
    console.log(`Started ${gameMode} mode${aiEnabled ? ' - Difficulty: ' + aiState.difficulty : ''}`);
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}

// Mouse/touch input handlers
function mousePressed() {
    if (gameState === 'menu') {
        handleMenuClick();
        return false;
    }
    
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

function handleMenuClick() {
    let startY = height/2 - 20;
    let spacing = 60;
    
    // Check if clicked on menu options
    for (let i = 0; i < menuState.options.length; i++) {
        let y = startY + i * spacing;
        
        if (mouseY > y - 25 && mouseY < y + 25) {
            if (menuState.selectedOption === i) {
                // Double click or click on already selected - start game
                startGameWithSelection();
            } else {
                // Select this option
                menuState.selectedOption = i;
            }
            break;
        }
    }
    
    // Check difficulty selection area for 1 Player mode
    if (menuState.selectedOption === 0) {
        let diffY = startY + 28;
        if (mouseY > diffY && mouseY < diffY + 20) {
            // Cycle through difficulties on click
            menuState.difficultySelected = (menuState.difficultySelected + 1) % menuState.difficulties.length;
        }
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