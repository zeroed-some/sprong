// game-systems.js - Core game mechanics and physics

// ============= CONSTANTS =============
// Canvas settings
const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 400;

// Game constants
const BALL_SPEED    = 5;
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
const BOP_RANGE             = 500;   // also self explanatory. TWIST it.
const BOP_DURATION          = 1000; // traversal duration.    SHAKE it.
const BOP_COOLDOWN          = 0;  // also also self expl.   PULL  it.
const ANCHOR_RECOIL         = 60;   // How far the anchor moves backward during bop
const BOP_VELOCITY_BOOST    = 5;    // Initial velocity boost for paddle

// Rotation control constants
const ROTATION_SPEED        = 0.05;  // Base rotation speed (radians per frame)
const ROTATION_SMOOTHING    = 0.15;  // Input smoothing for rotation (0-1)
const ROTATION_DAMPING      = 0.92;  // Angular velocity damping (0-1)
const ROTATION_MAX_SPEED    = 0.2;   // Maximum angular velocity (radians per frame)
const ROTATION_RESISTANCE   = 3.0;   // How much harder it is to rotate against momentum
const ROTATION_MOMENTUM     = 0.85;  // How much angular momentum is preserved (0-1)
const ROTATION_RETURN_FORCE = 0.02;  // Force returning paddle to neutral position
const ROTATION_MAX_ANGLE    = Math.PI / 4; // Maximum rotation angle (45 degrees)
const ROTATION_WITH_MOMENTUM_BOOST = 1.5;  // Speed multiplier when rotating with momentum
const ROTATION_AGAINST_MOMENTUM_LAG = 0.05; // Lag multiplier when rotating against momentum

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

// ============= ROTATION SYSTEM =============
let rotationState = {
    left: {
        targetAngle: 0,           // Target angle based on input
        currentAngle: 0,          // Current visual angle
        angularVelocity: 0,       // Current angular velocity
        angularMomentum: 0,       // Angular momentum
        inputBuffer: 0,           // Smoothed rotation input (-1 to 1)
        lastDirection: 0          // Last input direction for momentum checks
    },
    right: {
        targetAngle: 0,
        currentAngle: 0,
        angularVelocity: 0,
        angularMomentum: 0,
        inputBuffer: 0,
        lastDirection: 0
    }
};

function handleBopInput(keys, aiEnabled, currentTime, leftPaddle, rightPaddle, leftSupport, rightSupport, engine, particles) {
    // Left player bop - use Left Shift for both modes
    let leftBopPressed = keys['Shift'] && !keys['Control'];
    
    // BOP_COOLDOWN controls the minimum time between bops
    if (leftBopPressed && !bopState.left.active && 
        currentTime - bopState.left.lastBopTime > BOP_COOLDOWN) {
        activateBop('left', currentTime, leftPaddle, leftSupport, engine, particles);
    }
    
    // Right player bop (Enter - only in two player mode)
    if (!aiEnabled) {
        let rightBopPressed = keys['Enter'];
        
        // BOP_COOLDOWN controls the minimum time between bops
        if (rightBopPressed && !bopState.right.active && 
            currentTime - bopState.right.lastBopTime > BOP_COOLDOWN) {
            activateBop('right', currentTime, rightPaddle, rightSupport, engine, particles);
        }
    }
    
    // Update active bops
    updateBopStates(currentTime, leftSupport, rightSupport, leftPaddle, rightPaddle);
}

function activateBop(side, currentTime, paddle, support, engine, particles) {
    const Body = Matter.Body;
    
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
        
        // ANCHOR_RECOIL now properly controls the recoil distance
        let anchorRecoilDistance = ANCHOR_RECOIL * 0.3; // Can adjust the 0.3 multiplier

        // Move support and paddle backward together
        Body.translate(support, { x: -dx * anchorRecoilDistance, y: -dy * anchorRecoilDistance });
        Body.translate(paddle,  { x: -dx * anchorRecoilDistance, y: -dy * anchorRecoilDistance });

        // Remember where the support started so we can ease it back later
        bopState[side].originalPos = { 
            x: support.position.x + dx * anchorRecoilDistance,
            y: support.position.y + dy * anchorRecoilDistance 
        };
        
        // BOP_VELOCITY_BOOST controls the initial forward velocity
        let forwardSpeed = BOP_VELOCITY_BOOST;
        Body.setVelocity(paddle, {
            x: paddle.velocity.x + dx * forwardSpeed,
            y: paddle.velocity.y + dy * forwardSpeed
        });

        // BOP_FORCE controls the sustained forward thrust
        // Combined with BOP_RANGE for the total force applied
        Body.applyForce(paddle, paddle.position, {
            x: dx * BOP_FORCE * BOP_RANGE * 0.002,  // Scaled down for Matter.js
            y: dy * BOP_FORCE * BOP_RANGE * 0.002
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
    }
    
    console.log(`${side} player BOP! Duration: ${BOP_DURATION}ms, Cooldown: ${BOP_COOLDOWN}ms`);
}

function updateBopStates(currentTime, leftSupport, rightSupport, leftPaddle, rightPaddle) {
    const Body = Matter.Body;
    
    // Update left bop
    if (bopState.left.active) {
        let elapsed = currentTime - bopState.left.startTime;
        let progress = elapsed / BOP_DURATION;  // BOP_DURATION controls how long the effect lasts
        
        if (progress >= 1.0) {
            bopState.left.active = false;
            bopState.left.originalPos = null;
            console.log("Left bop ended after", elapsed, "ms");
        } else {
            if (bopState.left.originalPos) {
                let support = leftSupport;
                let currentX = support.position.x;
                let currentY = support.position.y;
                
                // Smooth return motion with easing
                let returnSpeed = 0.15 * (1 - Math.pow(1 - progress, 3));
                let newX = currentX + (bopState.left.originalPos.x - currentX) * returnSpeed;
                let newY = currentY + (bopState.left.originalPos.y - currentY) * returnSpeed;
                
                Body.setPosition(support, { x: newX, y: newY });
            }
            
            limitBopRange(leftSupport, leftPaddle);
        }
    }
    
    // Update right bop (same logic)
    if (bopState.right.active) {
        let elapsed = currentTime - bopState.right.startTime;
        let progress = elapsed / BOP_DURATION;  // BOP_DURATION controls how long the effect lasts
        
        if (progress >= 1.0) {
            bopState.right.active = false;
            bopState.right.originalPos = null;
            console.log("Right bop ended after", elapsed, "ms");
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
    
    // BOP_RANGE controls the maximum extension allowed
    let maxDistance = SPRING_LENGTH + BOP_RANGE;
    if (currentDistance > maxDistance) {
        let dx = paddle.position.x - support.position.x;
        let dy = paddle.position.y - support.position.y;
        
        let magnitude = Math.sqrt(dx * dx + dy * dy);
        dx /= magnitude;
        dy /= magnitude;
        
        // Clamp paddle position to max range
        let newX = support.position.x + dx * maxDistance;
        let newY = support.position.y + dy * maxDistance;
        
        let currentVel = paddle.velocity;
        Body.setPosition(paddle, { x: newX, y: newY });
        
        // Dampen velocity when hitting the range limit
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
        // Add rotational physics
        inertia: PADDLE_MASS * 200,  // Lower inertia = more rotation
        frictionAngular: 0.02,       // Slight angular damping
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
        damping: SPRING_DAMPING,
        // Add angular stiffness to create torque from movement
        angularStiffness: 0.01,  // Allows paddle to rotate based on spring tension
        render: { visible: false }
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
    
    // Track collision state to prevent double-triggering
    let collisionState = {
        left: { inCollision: false, lastCollisionTime: 0 },
        right: { inCollision: false, lastCollisionTime: 0 }
    };
    
    Matter.Events.on(engine, 'collisionStart', function(event) {
        let pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i];
            
            if ((pair.bodyA === ball && (pair.bodyB === leftPaddle || pair.bodyB === rightPaddle)) ||
                (pair.bodyB === ball && (pair.bodyA === leftPaddle || pair.bodyA === rightPaddle))) {
                
                let paddle = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
                let isLeftPaddle = paddle === leftPaddle;
                let side = isLeftPaddle ? 'left' : 'right';
                
                // Prevent multiple collisions in quick succession
                let currentTime = Date.now();
                if (currentTime - collisionState[side].lastCollisionTime < 100) {
                    continue; // Skip if we just had a collision
                }
                
                collisionState[side].lastCollisionTime = currentTime;
                
                // Apply bop boost if paddle is currently bopping
                if ((isLeftPaddle && bopState.left.active) || (!isLeftPaddle && bopState.right.active)) {
                    // Get actual collision point from Matter.js
                    let collision = pair.collision;
                    let contactPoint = collision.supports[0];
                    
                    // Check if this is a valid collision
                    let isValidCollision = false;
                    
                    if (contactPoint) {
                        isValidCollision = true;
                    } else {
                        // Use penetration depth as fallback to avoid false positives
                        const depth = collision.depth || 0;
                        isValidCollision = depth > 0.5;
                    }
                    
                    if (isValidCollision) {
                        // During bop, ALWAYS apply boost
                        let ballVel = ball.velocity;
                        let paddleVel = paddle.velocity;
                        
                        // Calculate the normal collision response first
                        let normal = collision.normal;
                        let relativeVelocity = {
                            x: ballVel.x - paddleVel.x,
                            y: ballVel.y - paddleVel.y
                        };
                        
                        // Calculate the velocity along the collision normal
                        let velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
                        
                        // Only apply boost if ball is approaching paddle
                        if (velocityAlongNormal < 0) {
                            // Base reflection velocity (enhanced during bop)
                            let restitution = 1.5; // Higher restitution during bop
                            let impulse = 2 * velocityAlongNormal * restitution;
                            
                            // Apply the impulse
                            let newVelX = ballVel.x - impulse * normal.x;
                            let newVelY = ballVel.y - impulse * normal.y;
                            
                            // Add paddle velocity influence (more during bop)
                            let paddleInfluence = 0.6; // Higher influence during bop
                            newVelX += paddleVel.x * paddleInfluence;
                            newVelY += paddleVel.y * paddleInfluence;
                            
                            // Add bop boost in the direction of the normal
                            let bopBoostMagnitude = 3; // Extra boost during bop
                            newVelX += normal.x * bopBoostMagnitude;
                            newVelY += normal.y * bopBoostMagnitude;
                            
                            // Ensure minimum speed after bop
                            let newSpeed = Math.sqrt(newVelX * newVelX + newVelY * newVelY);
                            let minSpeed = BALL_SPEED * 1.3; // At least 30% faster than normal
                            
                            if (newSpeed < minSpeed) {
                                let scale = minSpeed / newSpeed;
                                newVelX *= scale;
                                newVelY *= scale;
                            }
                            
                            // Apply the new velocity
                            Body.setVelocity(ball, {
                                x: newVelX,
                                y: newVelY
                            });
                            
                            // Move ball slightly away from paddle to prevent sticking
                            let separation = 2; // pixels
                            Body.setPosition(ball, {
                                x: ball.position.x + normal.x * separation,
                                y: ball.position.y + normal.y * separation
                            });
                            
                            // Create impact particles
                            for (let j = 0; j < IMPACT_PARTICLES * 2; j++) { // More particles for bop
                                let angle = Math.atan2(normal.y, normal.x) + (Math.random() - 0.5) * Math.PI;
                                let speed = Math.random() * 8 + 4;
                                
                                particles.push({
                                    x: contactPoint ? contactPoint.x : ball.position.x,
                                    y: contactPoint ? contactPoint.y : ball.position.y,
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed,
                                    size: Math.random() * 5 + 3,
                                    life: PARTICLE_LIFE,
                                    maxLife: PARTICLE_LIFE,
                                    color: { r: 255, g: Math.random() * 155 + 100, b: 50 },
                                    type: 'impact'
                                });
                            }
                            
                            console.log(`BOP HIT! Clean bounce. New speed: ${newSpeed.toFixed(1)}, Side: ${side}`);
                        }
                    }
                }
            }
        }
    });
    
    // Reset collision state on collision end
    Matter.Events.on(engine, 'collisionEnd', function(event) {
        let pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i];
            
            if ((pair.bodyA === ball && (pair.bodyB === leftPaddle || pair.bodyB === rightPaddle)) ||
                (pair.bodyB === ball && (pair.bodyA === leftPaddle || pair.bodyA === rightPaddle))) {
                
                let paddle = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
                let isLeftPaddle = paddle === leftPaddle;
                let side = isLeftPaddle ? 'left' : 'right';
                
                collisionState[side].inCollision = false;
            }
        }
    });
}

// ============= ROTATION SYSTEM =============
function handleRotationInput() {
    // Left paddle rotation (A/D keys)
    let leftRotationInput = 0;
    if (keys['a'] || keys['A']) leftRotationInput -= 1;
    if (keys['d'] || keys['D']) leftRotationInput += 1;
    
    // Right paddle rotation (Left/Right arrows, only if AI disabled)
    let rightRotationInput = 0;
    if (!aiEnabled) {
        if (keys['ArrowLeft']) rightRotationInput -= 1;
        if (keys['ArrowRight']) rightRotationInput += 1;
    }
    
    // Update rotation states
    updateRotationPhysics('left', leftRotationInput, leftPaddle);
    if (!aiEnabled) {
        updateRotationPhysics('right', rightRotationInput, rightPaddle);
    }
}

function updateRotationPhysics(side, input, paddle) {
    const Body = Matter.Body;
    let state = rotationState[side];
    
    // Smooth the input
    state.inputBuffer = lerp(state.inputBuffer, input, ROTATION_SMOOTHING);
    
    // Calculate resistance based on momentum
    let rotatingWithMomentum = (state.inputBuffer * state.angularVelocity) > 0;
    let effectiveInput = state.inputBuffer;
    
    if (rotatingWithMomentum && Math.abs(state.inputBuffer) > 0.1) {
        // Easier to rotate with momentum
        effectiveInput *= ROTATION_WITH_MOMENTUM_BOOST;
    } else if (!rotatingWithMomentum && Math.abs(state.inputBuffer) > 0.1) {
        // Harder to rotate against momentum
        effectiveInput *= ROTATION_AGAINST_MOMENTUM_LAG;
    }
    
    // Apply torque based on input
    let torque = effectiveInput * ROTATION_SPEED;
    
    // Update angular velocity with torque
    state.angularVelocity += torque;
    
    // Apply damping
    state.angularVelocity *= ROTATION_DAMPING;
    
    // Limit maximum angular velocity
    state.angularVelocity = Math.max(-ROTATION_MAX_SPEED, 
                                    Math.min(ROTATION_MAX_SPEED, state.angularVelocity));
    
    // Apply return-to-center force when no input
    if (Math.abs(state.inputBuffer) < 0.1) {
        let returnForce = -state.currentAngle * ROTATION_RETURN_FORCE;
        state.angularVelocity += returnForce;
    }
    
    // Update current angle
    state.currentAngle += state.angularVelocity;
    
    // Limit maximum rotation angle
    state.currentAngle = Math.max(-ROTATION_MAX_ANGLE, 
                                 Math.min(ROTATION_MAX_ANGLE, state.currentAngle));
    
    // Apply rotation to the paddle body
    Body.setAngle(paddle, state.currentAngle);
    
    // Update angular momentum for next frame
    state.angularMomentum = state.angularMomentum * ROTATION_MOMENTUM + 
                           state.angularVelocity * (1 - ROTATION_MOMENTUM);
    
    // Track last direction for momentum calculations
    if (Math.abs(input) > 0.1) {
        state.lastDirection = Math.sign(input);
    }
}

// ============= HELPER FUNCTIONS =============
function lerp(start, stop, amt) {
    return amt * (stop - start) + start;
}