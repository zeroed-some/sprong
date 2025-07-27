// game-systems.js - Core game mechanics and physics
// TODO redocument

// ============= CONSTANTS =============
// Canvas settings
const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 400;

// Game constants
const BALL_SPEED    = 6;
const BALL_RADIUS   = 12;
const PADDLE_WIDTH  = 20;
const PADDLE_HEIGHT = 80;

// Enhanced movement constants
const SUPPORT_SPEED     = 6.5;
const SUPPORT_ACCEL     = 1.2;
const INPUT_SMOOTHING   = 0.25;
const SUPPORT_MAX_SPEED = 8;

// Touch/mouse control constants
const MOUSE_SPEED_LIMIT = 4;
const MOUSE_LAG_FACTOR  = 0.12;
const TOUCH_SENSITIVITY = 1.2;

// Spring physics constants
const PADDLE_MASS       = 0.8;  
const SPRING_LENGTH     = 50;   
const SPRING_DAMPING    = 0.6;  
const SPRING_STIFFNESS  = 0.025;

// Visual enhancement constants
const TRAIL_SEGMENTS        = 8;
const PADDLE_GLOW_DISTANCE  = 25;
const SPRING_GLOW_INTENSITY = 120;

// Particle system constants
const MAX_PARTICLES         = 100;
const PARTICLE_LIFE         = 60;
const IMPACT_PARTICLES      = 8;
const SPRING_PARTICLE_RATE  = 0.3;

// Bop system constants
const BOP_FORCE             = 1.0;  // self explanatory.      BOP   it.
const BOP_RANGE             = 500;  // also self explanatory. TWIST it.
const BOP_DURATION          = 300;  // traversal duration.    SHAKE it.
const BOP_COOLDOWN          = 500;  // also also self expl.   PULL  it.
const ANCHOR_RECOIL         = 40;   // How far the anchor moves backward during bop
const BOP_VELOCITY_BOOST    = 12;   // Initial velocity boost for paddle

// ============= BOP SYSTEM =============
let bopState = {
    left: {
        active: false,
        startTime: 0,
        duration: BOP_DURATION,
        power: BOP_FORCE,
        cooldown: BOP_COOLDOWN,
        lastBopTime: 0,
        originalPos: null
    },
    right: {
        active: false,
        startTime: 0,
        duration: BOP_DURATION,
        power: BOP_FORCE,
        cooldown: BOP_COOLDOWN,
        lastBopTime: 0,
        originalPos: null
    }
};

function handleBopInput(keys, aiEnabled, currentTime, leftPaddle, rightPaddle, leftSupport, rightSupport, engine, particles) {
    // Left player bop - use Left Shift for both modes
    let leftBopPressed = keys['Shift'] && !keys['Control'];
    
    if (leftBopPressed && !bopState.left.active && 
        currentTime - bopState.left.lastBopTime > bopState.left.cooldown) {
        activateBop('left', currentTime, leftPaddle, leftSupport, engine, particles);
    }
    
    // Right player bop (Enter - only in two player mode)
    if (!aiEnabled) {
        let rightBopPressed = keys['Enter'];
        
        if (rightBopPressed && !bopState.right.active && 
            currentTime - bopState.right.lastBopTime > bopState.right.cooldown) {
            activateBop('right', currentTime, rightPaddle, rightSupport, engine, particles);
        }
    }
    
    // Update active bops
    updateBopStates(currentTime, leftSupport, rightSupport, leftPaddle, rightPaddle);
}

function activateBop(side, currentTime, paddle, support, engine, particles) {
    const Body = Matter.Body;
    const Engine = Matter.Engine;
    
    bopState[side].active = true;
    bopState[side].startTime = currentTime;
    bopState[side].lastBopTime = currentTime;
    
    // Calculate direction from support to paddle
    let dx = paddle.position.x - support.position.x;
    let dy = paddle.position.y - support.position.y;
    
    // Normalize direction
    let magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
        
        // Calculate anchor recoil distance
        let anchorRecoilDistance = ANCHOR_RECOIL * 0.4;
        
        // Move the support BACKWARD (recoil effect)
        let newSupportX = support.position.x - dx * anchorRecoilDistance;
        let newSupportY = support.position.y - dy * anchorRecoilDistance;
        
        Body.setPosition(support, { x: newSupportX, y: newSupportY });
        
        // Store original support position for recovery
        bopState[side].originalPos = { 
            x: support.position.x + dx * anchorRecoilDistance, 
            y: support.position.y + dy * anchorRecoilDistance 
        };
        
        // Set paddle velocity directly for immediate forward thrust
        let forwardSpeed = (BOP_RANGE / SPRING_LENGTH) * BOP_VELOCITY_BOOST;
        Body.setVelocity(paddle, {
            x: paddle.velocity.x + dx * forwardSpeed,
            y: paddle.velocity.y + dy * forwardSpeed
        });
        
        // Apply a strong forward force for continued acceleration
        Body.applyForce(paddle, paddle.position, {
            x: dx * bopState[side].power * BOP_RANGE * 0.1,
            y: dy * bopState[side].power * BOP_RANGE * 0.1
        });
        
        // Create particle burst for visual feedback
        for (let i = 0; i < 5; i++) {
            let angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
            let speed = Math.random() * 4 + 2;
            particles.push({
                x: support.position.x,
                y: support.position.y,
                vx: Math.cos(angle) * speed * -1,
                vy: Math.sin(angle) * speed * -1,
                size: Math.random() * 3 + 2,
                life: 30,
                maxLife: 30,
                color: { r: 255, g: 255, b: 100 },
                type: 'impact'
            });
        }
        
        // Force collision detection update
        Engine.update(engine, 0);
    }
    
    console.log(side + " player BOP!");
}

function updateBopStates(currentTime, leftSupport, rightSupport, leftPaddle, rightPaddle) {
    const Body = Matter.Body;
    
    // Update left bop
    if (bopState.left.active) {
        let elapsed = currentTime - bopState.left.startTime;
        let progress = elapsed / bopState.left.duration;
        
        if (progress >= 1.0) {
            bopState.left.active = false;
            bopState.left.originalPos = null;
        } else {
            if (bopState.left.originalPos) {
                let support = leftSupport;
                let currentX = support.position.x;
                let currentY = support.position.y;
                
                let returnSpeed = 0.15 * (1 - Math.pow(1 - progress, 3));
                let newX = currentX + (bopState.left.originalPos.x - currentX) * returnSpeed;
                let newY = currentY + (bopState.left.originalPos.y - currentY) * returnSpeed;
                
                Body.setPosition(support, { x: newX, y: newY });
            }
            
            limitBopRange(leftSupport, leftPaddle);
        }
    }
    
    // Update right bop
    if (bopState.right.active) {
        let elapsed = currentTime - bopState.right.startTime;
        let progress = elapsed / bopState.right.duration;
        
        if (progress >= 1.0) {
            bopState.right.active = false;
            bopState.right.originalPos = null;
        } else {
            if (bopState.right.originalPos) {
                let support = rightSupport;
                let currentX = support.position.x;
                let currentY = support.position.y;
                
                let returnSpeed = 0.15 * (1 - Math.pow(1 - progress, 3));
                let newX = currentX + (bopState.right.originalPos.x - currentX) * returnSpeed;
                let newY = currentY + (bopState.right.originalPos.y - currentY) * returnSpeed;
                
                Body.setPosition(support, { x: newX, y: newY });
            }
            
            limitBopRange(rightSupport, rightPaddle);
        }
    }
}

function limitBopRange(support, paddle) {
    const Body = Matter.Body;
    
    let currentDistance = dist(support.position.x, support.position.y,
                              paddle.position.x, paddle.position.y);
    
    let maxDistance = SPRING_LENGTH + BOP_RANGE;
    if (currentDistance > maxDistance) {
        let dx = paddle.position.x - support.position.x;
        let dy = paddle.position.y - support.position.y;
        
        let magnitude = Math.sqrt(dx * dx + dy * dy);
        dx /= magnitude;
        dy /= magnitude;
        
        let newX = support.position.x + dx * maxDistance;
        let newY = support.position.y + dy * maxDistance;
        
        let currentVel = paddle.velocity;
        Body.setPosition(paddle, { x: newX, y: newY });
        Body.setVelocity(paddle, { 
            x: currentVel.x * 0.7, 
            y: currentVel.y * 0.7 
        });
    }
}

// ============= PADDLE SYSTEM =============
function createSpringPaddleSystem(side, width, height) {
    const Bodies = Matter.Bodies;
    const Constraint = Matter.Constraint;
    
    let supportX = side === 'left' ? 60 : width - 60;
    let paddleX = side === 'left' ? 60 + SPRING_LENGTH : width - 60 - SPRING_LENGTH;
    let startY = height / 2;
    
    let support = Bodies.rectangle(supportX, startY, 10, 10, {
        isStatic: true,
        render: { visible: false }
    });
    
    let paddleOptions = {
        mass: PADDLE_MASS,
        restitution: side === 'left' ? 1.3 : 1.2,
        friction: 0,
        frictionAir: side === 'left' ? 0.005 : 0.008,
        isSensor: false,
        slop: 0.01,
        render: {
            fillStyle: side === 'left' ? '#00ff88' : '#ff6464'
        }
    };
    
    let paddle = Bodies.rectangle(paddleX, startY, PADDLE_WIDTH, PADDLE_HEIGHT, paddleOptions);
    
    paddle.collisionFilter = {
        category: side === 'left' ? 0x0002 : 0x0004,
        mask: 0xFFFF
    };
    
    let spring = Constraint.create({
        bodyA: support,
        bodyB: paddle,
        length: SPRING_LENGTH,
        stiffness: SPRING_STIFFNESS,
        damping: SPRING_DAMPING
    });
    
    return { support, paddle, spring };
}

// ============= MOVEMENT =============
function moveSupportEnhanced(support, deltaY, height) {
    const Body = Matter.Body;
    
    let newY = support.position.y + deltaY;
    
    let minY = 50;
    let maxY = height - 50;
    
    if (newY < minY) {
        newY = minY + (newY - minY) * 0.1;
    } else if (newY > maxY) {
        newY = maxY + (newY - maxY) * 0.1;
    }
    
    Body.setPosition(support, { x: support.position.x, y: newY });
}

// ============= BALL SYSTEM =============
function resetBall(ball, world, width, height) {
    const Bodies = Matter.Bodies;
    const World = Matter.World;
    const Body = Matter.Body;
    
    if (ball) {
        World.remove(world, ball);
    }
    
    ball = Bodies.circle(width/2, height/2, BALL_RADIUS, {
        restitution: 1,
        friction: 0,
        frictionAir: 0,
        slop: 0.01,
        collisionFilter: {
            category: 0x0001,
            mask: 0xFFFF
        },
        render: {
            fillStyle: '#ff6464'
        }
    });
    
    World.add(world, ball);
    
    // Start ball moving after a short delay
    setTimeout(() => {
        let direction = Math.random() > 0.5 ? 1 : -1;
        let angle = (Math.random() - 0.5) * Math.PI/3;
        
        Body.setVelocity(ball, {
            x: direction * BALL_SPEED * Math.cos(angle),
            y: BALL_SPEED * Math.sin(angle)
        });
    }, 1000);
    
    return ball;
}

// ============= COLLISION =============
function setupCollisionHandlers(engine, ball, leftPaddle, rightPaddle, particles) {
    const Body = Matter.Body;
    
    Matter.Events.on(engine, 'collisionStart', function(event) {
        let pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i];
            
            if ((pair.bodyA === ball && (pair.bodyB === leftPaddle || pair.bodyB === rightPaddle)) ||
                (pair.bodyB === ball && (pair.bodyA === leftPaddle || pair.bodyA === rightPaddle))) {
                
                let paddle = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
                let isLeftPaddle = paddle === leftPaddle;
                
                if ((isLeftPaddle && bopState.left.active) || (!isLeftPaddle && bopState.right.active)) {
                    let ballVel = ball.velocity;
                    let paddleVel = paddle.velocity;
                    
                    let boostX = paddleVel.x * 0.5;
                    let boostY = paddleVel.y * 0.5;
                    
                    Body.setVelocity(ball, {
                        x: ballVel.x * 1.3 + boostX,
                        y: ballVel.y * 1.3 + boostY
                    });
                    
                    // Create impact particles
                    for (let j = 0; j < IMPACT_PARTICLES; j++) {
                        let angle = Math.random() * Math.PI * 2;
                        let speed = Math.random() * 6 + 2;
                        
                        particles.push({
                            x: ball.position.x,
                            y: ball.position.y,
                            vx: Math.cos(angle) * speed - ballVel.x * 0.2,
                            vy: Math.sin(angle) * speed - ballVel.y * 0.2,
                            size: Math.random() * 4 + 2,
                            life: PARTICLE_LIFE,
                            maxLife: PARTICLE_LIFE,
                            color: { r: 255, g: Math.random() * 155 + 100, b: Math.random() * 50 + 100 },
                            type: 'impact'
                        });
                    }
                }
            }
        }
    });
}