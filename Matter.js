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

// Canvas settings
const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 400;

// Game constants
const BALL_SPEED    = 8;
const BALL_RADIUS   = 12;
const PADDLE_WIDTH  = 20;
const PADDLE_HEIGHT = 80;
const SUPPORT_SPEED = 4;

// Spring physics constants
const PADDLE_MASS       = 0.8;
const SPRING_LENGTH     = 40;
const SPRING_DAMPING    = 0.8;
const SPRING_STIFFNESS  = 0.02;

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
    
    // Handle player input
    handleInput();
    
    // Check for scoring
    checkBallPosition();
    
    // Clear canvas
    background(10, 10, 10);
    
    // Draw game objects
    drawSpringPaddleSystems();
    drawBall();
    drawBoundaries();
    drawCenterLine();
    
    // Draw debug info
    drawDebugInfo();
    
    // Start message
    if (!gameStarted) {
        drawStartMessage();
    }
}

function drawSpringPaddleSystems() {
    // Draw springs first (behind paddles)
    drawSprings();
    
    // Draw paddles
    fill(0, 255, 136);
    stroke(0, 255, 136);
    strokeWeight(2);
    
    // Left paddle
    let leftPos = leftPaddle.position;
    let leftAngle = leftPaddle.angle;
    push();
    translate(leftPos.x, leftPos.y);
    rotate(leftAngle);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    pop();
    
    // Right paddle
    let rightPos = rightPaddle.position;
    let rightAngle = rightPaddle.angle;
    push();
    translate(rightPos.x, rightPos.y);
    rotate(rightAngle);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    pop();
    
    // Draw support points (small indicators)
    fill(0, 255, 136, 100);
    noStroke();
    ellipse(leftSupport.position.x, leftSupport.position.y, 8, 8);
    ellipse(rightSupport.position.x, rightSupport.position.y, 8, 8);
}

function drawSprings() {
    stroke(0, 255, 136, 150);
    strokeWeight(3);
    
    // Left spring
    let leftSupportPos = leftSupport.position;
    let leftPaddlePos = leftPaddle.position;
    
    // Draw spring as a zigzag line
    drawSpringLine(leftSupportPos, leftPaddlePos, 'left');
    
    // Right spring
    let rightSupportPos = rightSupport.position;
    let rightPaddlePos = rightPaddle.position;
    
    drawSpringLine(rightSupportPos, rightPaddlePos, 'right');
}

function drawSpringLine(startPos, endPos, side) {
    let segments = 8;
    let amplitude = 8;
    
    // Calculate spring compression (affects visual amplitude)
    let currentLength = dist(startPos.x, startPos.y, endPos.x, endPos.y);
    let compression = SPRING_LENGTH / currentLength;
    amplitude *= compression;
    
    stroke(0, 255, 136, 150 + compression * 50); // Brighter when compressed
    strokeWeight(2 + compression);
    
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        let x = lerp(startPos.x, endPos.x, t);
        let y = lerp(startPos.y, endPos.y, t);
        
        // Add zigzag offset
        if (i > 0 && i < segments) {
            let perpX = -(endPos.y - startPos.y) / currentLength;
            let perpY = (endPos.x - startPos.x) / currentLength;
            let offset = sin(i * PI) * amplitude;
            x += perpX * offset;
            y += perpY * offset;
        }
        
        if (i === 0) {
            beginShape();
            vertex(x, y);
        } else {
            vertex(x, y);
            if (i === segments) {
                endShape();
            }
        }
    }
}

function drawBall() {
    fill(255, 100, 100);
    stroke(255, 150, 150);
    strokeWeight(2);
    
    let ballPos = ball.position;
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 2, BALL_RADIUS * 2);
    
    // Ball trail effect
    fill(255, 100, 100, 50);
    noStroke();
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 3, BALL_RADIUS * 3);
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
    
    // Spring info
    let leftSpringLength = dist(leftSupport.position.x, leftSupport.position.y, 
                               leftPaddle.position.x, leftPaddle.position.y);
    let rightSpringLength = dist(rightSupport.position.x, rightSupport.position.y, 
                                rightPaddle.position.x, rightPaddle.position.y);
    
    text(`Left Spring: ${Math.round(leftSpringLength)}px`, 10, 50);
    text(`Right Spring: ${Math.round(rightSpringLength)}px`, 10, 65);
    text(`Spring Rest Length: ${SPRING_LENGTH}px`, 10, 80);
}

function drawStartMessage() {
    fill(0, 255, 136, 200);
    textAlign(CENTER);
    textSize(20);
    text("Press any key to start!", width/2, height/2 + 100);
    textSize(14);
    text("Watch the springs compress and extend!", width/2, height/2 + 125);
}

function handleInput() {
    // Left paddle (W/S keys) - move the support point
    if (keys['w'] || keys['W']) {
        moveSupport(leftSupport, -SUPPORT_SPEED);
    }
    if (keys['s'] || keys['S']) {
        moveSupport(leftSupport, SUPPORT_SPEED);
    }
    
    // Right paddle (Arrow keys) - move the support point
    if (keys['ArrowUp']) {
        moveSupport(rightSupport, -SUPPORT_SPEED);
    }
    if (keys['ArrowDown']) {
        moveSupport(rightSupport, SUPPORT_SPEED);
    }
}

function moveSupport(support, deltaY) {
    let newY = support.position.y + deltaY;
    
    // Keep support within reasonable bounds
    newY = constrain(newY, 50, height - 50);
    
    Body.setPosition(support, { x: support.position.x, y: newY });
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
        console.log("🔄 Game reset!");
    }
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}