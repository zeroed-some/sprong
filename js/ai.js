// ai.js - AI logic and behavior

// ============= AI TECHNIQUE CONSTANTS =============
const AI_WINDUP_SPEED       = 0.15;   // Base oscillation speed
const AI_WINDUP_SMOOTHNESS  = 1.00;   // Smooth transitions
const AI_WINDUP_RADIUS      = 240;    // Circular motion radius
const AI_WINDUP_MIN_TIME    = 300;    // Minimum windup duration
const AI_WINDUP_MAX_TIME    = 1200;   // Maximum windup duration
const AI_BOP_AT_PEAK_CHANCE = 0.4;    // Chance to bop at windup peak
const AI_CIRCULAR_MOTION    = 0.9;    // How circular vs linear the motion is
const AI_MOMENTUM_CARRY     = 0.85;   // How much momentum carries between moves
const AI_PHASE_SPEED        = 0.1;    // Speed of phase progression (radians per frame)

const AI_IDLE_MOVEMENT  = 0.8;        // How much AI moves when idle
const AI_NERVOUS_ENERGY = 0.5;        // Random fidgeting energy
const AI_PREDICTIVE_MOVEMENT = 0.7;   // How much AI moves based on prediction
const AI_TRACKING_AGGRESSION = 0.15;  // How aggressively AI tracks the ball


// ============= AI SETTINGS =============
const AI_SETTINGS = {
    easy: {
        reactionTime: 400,
        accuracy: 0.7,
        speed: 0.8,
        prediction: 0.3,
        aggression: 0.2,
        oscillation: 0.3,
        bopChance: 0.25,
        windupSpeed: 0.1,
        windupRadius: 30,
        comboBopChance: 0.1,
        circularMotion: 0.4,
        phaseSpeed: 0.06,
        idleMovement: 0.3,
        trackingAggression: 0.1
    },
    medium: {
        reactionTime: 250,
        accuracy: 0.85,
        speed: 1.0,
        prediction: 0.6,
        aggression: 0.5,
        oscillation: 0.7,
        bopChance: 0.55,
        windupSpeed: 0.15,
        windupRadius: 40,
        comboBopChance: 0.3,
        circularMotion: 0.6,
        phaseSpeed: 0.08,
        idleMovement: 0.5,
        trackingAggression: 0.15
    },
    hard: {
        reactionTime: 150,
        accuracy: 0.95,
        speed: 1.3,  // Increased from 1.2
        prediction: 0.85, // Increased from 0.8
        aggression: 0.9,  // Increased from 0.8
        oscillation: 1.0,
        bopChance: 0.85,
        windupSpeed: 0.2,
        windupRadius: 60,  // Increased from 50
        comboBopChance: 0.5,
        circularMotion: 0.8,
        phaseSpeed: 0.12,  // Increased from 0.1
        idleMovement: 0.8,
        trackingAggression: 0.25
    }
};

// ============= AI STATE =============
let aiState = {
    targetY: 200,
    reactionDelay: 0,
    difficulty: 'medium',
    lastBallX: 0,
    lastUpdateTime: 0,
    
    // Advanced AI state machine
    mode: 'TRACKING',
    windupStartTime: 0,
    swingStartTime: 0,
    interceptY: 200,
    windupDirection: 1,
    aggressionLevel: 0.5,
    lastHitTime: 0,
    
    // Enhanced windup system
    windupPhase: 0,          // 0 to 2π for circular motion
    windupVelocity: 0,       // Current oscillation speed
    windupMomentum: {x: 0, y: 0}, // Momentum vector
    windupCenter: 200,       // Center point of circular motion
    peakReached: false,      // Track if we hit peak velocity
    comboBop: false,         // Planning windup+bop combo
    maxVelocityPhase: 0,     // Phase where max velocity occurs
    
    // Motion tracking
    lastPositions: [],       // Track last N positions for smoothing
    currentVelocity: 0,      // Actual paddle velocity
    targetVelocity: 0,       // Desired paddle velocity
    smoothedTarget: 200,     // Smoothed target position
    
    // Original oscillation parameters (keeping for compatibility)
    windupDistance: 120,
    swingPower: 1.05,
    timingWindow: 40,
    windupProgress: 0,
    
    // Lifelike movement
    idleTarget: 200,
    microAdjustment: 0,
    breathingOffset: 0,
    lastMicroTime: 0,
    
    // AI Bop system
    consideringBop: false,
    bopDecisionTime: 0,
    bopTiming: 200
};

// ============= MAIN AI HANDLER =============
function handleAI(currentTime, ball, rightPaddle, rightSupport, 
                        leftScore, rightScore, width, height, 
                        bopState, activateBop, engine, particles) {
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    let aiSettings = AI_SETTINGS[aiState.difficulty];
    
    updateAIAggression(leftScore, rightScore);
    updateAILifelikeBehavior(currentTime, height);
    
    switch (aiState.mode) {
        case 'TRACKING':
            handleAITracking(currentTime, ballPos, ballVel, aiSettings, 
                           rightPaddle, rightSupport, width, height, 
                           bopState, activateBop, engine, particles);
            break;
        case 'WINDING_UP':
            handleAIWindup(currentTime, ballPos, ballVel, aiSettings, 
                         rightPaddle, rightSupport, height, width);
            break;
        case 'SWINGING':
            handleAISwing(currentTime, ball, rightPaddle, rightSupport);
            break;
        case 'RECOVERING':
            handleAIRecovery(currentTime);
            break;
        case 'ANTICIPATING':
            handleAIAnticipation(currentTime, ballPos, ballVel, 
                               rightPaddle, rightSupport, height);
            break;
    }
    
    executeAIMovement(aiSettings, rightSupport);
}

// ============= AI BEHAVIORS =============
function updateAILifelikeBehavior(currentTime, height) {
    let aiSettings = AI_SETTINGS[aiState.difficulty];
    
    // More pronounced breathing motion
    aiState.breathingOffset = Math.sin(currentTime * 0.005) * 5 * aiSettings.idleMovement;
    
    // More frequent micro-adjustments
    if (currentTime - aiState.lastMicroTime > 1000 + Math.random() * 500) {
        aiState.microAdjustment = (Math.random() - 0.5) * 30 * aiSettings.idleMovement;
        aiState.lastMicroTime = currentTime;
    }
    
    // Slower decay for more persistent movement
    aiState.microAdjustment *= 0.95;
    
    // Add "nervous energy" - small random movements
    let nervousEnergy = (Math.random() - 0.5) * AI_NERVOUS_ENERGY * aiSettings.aggression;
    aiState.microAdjustment += nervousEnergy;
    
    if (aiState.mode === 'ANTICIPATING' || aiState.mode === 'RECOVERING') {
        let centerY = height / 2;
        let wanderRadius = 40 * aiSettings.idleMovement; // Larger wander radius
        aiState.idleTarget = centerY + Math.sin(currentTime * 0.003) * wanderRadius;
        
        // Add vertical patrol behavior
        let patrolOffset = Math.sin(currentTime * 0.002) * 30 * aiSettings.idleMovement;
        aiState.idleTarget += patrolOffset;
    }
}

function updateAIAggression(leftScore, rightScore) {
    let scoreDiff = leftScore - rightScore;
    let baseAggression = AI_SETTINGS[aiState.difficulty].aggression;
    
    if (scoreDiff >= 2) {
        aiState.aggressionLevel = Math.min(1.0, baseAggression + 0.3);
    } else if (scoreDiff >= 1) {
        aiState.aggressionLevel = Math.min(1.0, baseAggression + 0.15);
    } else {
        aiState.aggressionLevel = baseAggression;
    }
}

function handleAITracking(currentTime, ballPos, ballVel, aiSettings, 
                         rightPaddle, rightSupport, width, height, 
                         bopState, activateBop, engine, particles) {
    let ballApproaching = ballVel.x > 0;
    let ballDistance = width - ballPos.x;
    let ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    let paddlePos = rightPaddle.position;
    let anchorPos = rightSupport.position;
    
    // More aggressive tracking based on difficulty
    let trackingIntensity = ballApproaching ? 
        (0.08 + aiSettings.trackingAggression) : 
        (0.03 + aiSettings.trackingAggression * 0.5);
    
    // Predict where ball will be and move preemptively
    let futureTime = 0.5; // Look ahead 0.5 seconds
    let futureBallY = ballPos.y + ballVel.y * futureTime * 60; // 60 fps assumption
    
    // Blend current and future position based on difficulty
    let targetBallY = lerp(ballPos.y, futureBallY, aiSettings.prediction);
    
    let desiredPaddleY = targetBallY + aiState.microAdjustment + aiState.breathingOffset;
    desiredPaddleY = Math.max(80, Math.min(height - 80, desiredPaddleY));
    
    // Add aggressive positioning - AI tries to "cut off" the ball
    if (ballApproaching && aiSettings.aggression > 0.5) {
        let aggressiveOffset = (ballVel.y > 0 ? 1 : -1) * 20 * aiSettings.aggression;
        desiredPaddleY += aggressiveOffset;
    }
    
    let anchorOffsetNeeded = calculateAnchorOffset(desiredPaddleY, paddlePos, anchorPos);
    let targetAnchorY = desiredPaddleY + anchorOffsetNeeded;
    
    // Faster interpolation for more responsive movement
    aiState.targetY = lerp(aiState.targetY, targetAnchorY, trackingIntensity * 1.5);
    
    
    // AI Bop decision logic
    if (ballApproaching && !aiState.consideringBop && !bopState.right.active) {
        let timeToReach = ballDistance / Math.abs(ballVel.x);
        let predictedBallY = ballPos.y + ballVel.y * timeToReach;
        
        if (predictedBallY < 50) {
            predictedBallY = 100 - predictedBallY;
        } else if (predictedBallY > height - 50) {
            predictedBallY = 2 * (height - 50) - predictedBallY;
        }
        
        let paddleY = rightPaddle.position.y;
        let distanceToIntercept = Math.abs(predictedBallY - paddleY);
        
        let bopEffectiveRange = PADDLE_HEIGHT / 2 + 30;
        
        let shouldConsiderBop = ballSpeed > 5 &&
                               distanceToIntercept < bopEffectiveRange &&
                               ballDistance > 80 && ballDistance < 200 &&
                               currentTime - bopState.right.lastBopTime > BOP_COOLDOWN &&
                               Math.random() < aiSettings.bopChance;
        
        if (shouldConsiderBop) {
            aiState.consideringBop = true;
            aiState.bopDecisionTime = currentTime;
            aiState.bopTiming = Math.max(50, Math.min(200, ballDistance * 2 - ballSpeed * 10));
        }
    }
    
    // Execute bop at the right moment
    if (aiState.consideringBop && ballApproaching) {
        let timeToBop = currentTime - aiState.bopDecisionTime;
        let paddleY = rightPaddle.position.y;
        let distanceToBall = Math.abs(ballPos.y - paddleY);
        
        // Refined bop execution conditions
        let shouldBop = timeToBop > aiState.bopTiming && 
                       ballDistance < 150 && // Close enough
                       distanceToBall < PADDLE_HEIGHT / 2 + 20 && // Paddle can reach ball
                       !bopState.right.active;
        
        // Special handling for combo bops during windup
        if (aiState.comboBop && aiState.mode === 'WINDING_UP') {
            // Execute bop at peak velocity during windup
            shouldBop = shouldBop || (aiState.peakReached && 
                                     ballDistance < 180 && 
                                     distanceToBall < PADDLE_HEIGHT / 2 + 30);
        }
        
        if (shouldBop) {
            activateBop('right', currentTime, rightPaddle, rightSupport, engine, particles);
            aiState.consideringBop = false;
            
            if (aiState.comboBop) {
                console.log(`AI COMBO BOP! Phase: ${(aiState.windupPhase % (Math.PI * 2)).toFixed(2)}, Velocity: ${aiState.currentVelocity.toFixed(1)}`);
                aiState.comboBop = false;
                
                // Transition to swing after combo
                if (aiState.mode === 'WINDING_UP') {
                    aiState.mode = 'SWINGING';
                    aiState.swingStartTime = currentTime;
                }
            } else {
                console.log(`AI BOP! Difficulty: ${aiState.difficulty}, Speed: ${ballSpeed.toFixed(1)}`);
            }
        }
        
        // Cancel bop if opportunity missed
        if (ballDistance > 200 || ballDistance < 50) {
            aiState.consideringBop = false;
            aiState.comboBop = false;
        }
    }
    
    // Advanced prediction and windup logic
    if (currentTime - aiState.lastUpdateTime > aiSettings.reactionTime) {
        if (ballApproaching && ballDistance < 300) {
            let timeToReach = ballDistance / Math.abs(ballVel.x);
            let predictedBallY = ballPos.y + ballVel.y * timeToReach;
            
            if (predictedBallY < 50) {
                predictedBallY = 100 - predictedBallY;
            } else if (predictedBallY > height - 50) {
                predictedBallY = 2 * (height - 50) - predictedBallY;
            }
            
            let error = (Math.random() - 0.5) * 35 * (1 - aiSettings.accuracy);
            predictedBallY += error;
            
            aiState.interceptY = predictedBallY;
            
            let interceptAnchorOffset = calculateAnchorOffset(aiState.interceptY, paddlePos, anchorPos);
            let targetAnchorForIntercept = aiState.interceptY + interceptAnchorOffset;
            
            let shouldWindUp = ballSpeed < 4.5 &&
                              ballDistance > 200 &&
                              Math.abs(ballVel.y) < 3 &&
                              Math.abs(ballVel.x) > 1 &&
                              !aiState.consideringBop &&
                              Math.random() < aiSettings.oscillation * aiState.aggressionLevel * 0.3;
            
            if (shouldWindUp) {
                // Start winding up for power shot
                aiState.mode = 'WINDING_UP';
                aiState.windupStartTime = currentTime;
                
                // Initialize circular windup
                aiState.windupCenter = paddlePos.y; // Start from current position
                aiState.windupPhase = 0;
                aiState.windupMomentum = {x: 0, y: 0};
                aiState.smoothedTarget = paddlePos.y;
                aiState.lastPositions = [paddlePos.y];
                aiState.peakReached = false;
                aiState.comboBop = false;
                
                // Determine initial direction based on intercept position
                aiState.windupDirection = aiState.interceptY > paddlePos.y ? -1 : 1;
            } else {
                aiState.targetY = lerp(aiState.targetY, targetAnchorForIntercept, 0.3);
            }
            
            aiState.lastUpdateTime = currentTime;
        }
    }
}

function handleAIWindup(currentTime, ballPos, ballVel, aiSettings, 
                       rightPaddle, rightSupport, height, width) {
    let windupTime = currentTime - aiState.windupStartTime;
    let maxWindupTime = AI_WINDUP_MIN_TIME + (AI_WINDUP_MAX_TIME - AI_WINDUP_MIN_TIME) * aiState.aggressionLevel;
    
    // Update windup phase for circular motion
    let phaseSpeed = aiSettings.phaseSpeed * (1 + aiState.aggressionLevel * 0.5);
    aiState.windupPhase += phaseSpeed;
    
    // Calculate circular motion with momentum
    let radius = aiSettings.windupRadius * aiState.aggressionLevel;
    let circularBlend = aiSettings.circularMotion;
    
    // Pure circular motion components
    let circularX = Math.sin(aiState.windupPhase) * radius * 0.3; // Slight X movement
    let circularY = Math.cos(aiState.windupPhase) * radius;
    
    // Add momentum for more natural motion
    let targetDeltaY = circularY - (aiState.smoothedTarget - aiState.windupCenter);
    aiState.windupMomentum.y = aiState.windupMomentum.y * AI_MOMENTUM_CARRY + targetDeltaY * (1 - AI_MOMENTUM_CARRY);
    
    // Calculate the target position with smooth circular motion
    let windupTargetY = aiState.windupCenter + aiState.windupMomentum.y;
    
    // Smooth the target for more fluid motion
    aiState.smoothedTarget = aiState.smoothedTarget * AI_WINDUP_SMOOTHNESS + 
                            windupTargetY * (1 - AI_WINDUP_SMOOTHNESS);
    
    // Keep within bounds
    aiState.smoothedTarget = Math.max(50, Math.min(height - 50, aiState.smoothedTarget));
    
    // Convert paddle target to anchor target
    let anchorOffsetNeeded = calculateAnchorOffset(aiState.smoothedTarget, rightPaddle.position, rightSupport.position);
    aiState.targetY = aiState.smoothedTarget + anchorOffsetNeeded;
    
    // Track velocity for combo detection
    if (aiState.lastPositions.length > 5) {
        aiState.lastPositions.shift();
    }
    aiState.lastPositions.push(aiState.smoothedTarget);
    
    // Calculate current velocity
    if (aiState.lastPositions.length > 1) {
        let recentDelta = aiState.lastPositions[aiState.lastPositions.length - 1] - 
                         aiState.lastPositions[aiState.lastPositions.length - 2];
        aiState.currentVelocity = Math.abs(recentDelta);
        
        // Check if we're at peak velocity (good time for combo bop)
        if (aiState.currentVelocity > radius * phaseSpeed * 0.8 && !aiState.peakReached) {
            aiState.peakReached = true;
            aiState.maxVelocityPhase = aiState.windupPhase;
            
            // Consider combo bop at peak
            if (!aiState.comboBop && !aiState.consideringBop && !bopState.right.active &&
                Math.random() < aiSettings.comboBopChance * aiState.aggressionLevel) {
                aiState.comboBop = true;
                aiState.consideringBop = true;
                aiState.bopDecisionTime = currentTime;
                aiState.bopTiming = 50; // Quick bop at peak
                console.log("AI planning COMBO: Windup + Bop!");
            }
        }
    }
    
    // Check if it's time to swing
    let ballDistance = width - ballPos.x;
    let ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    let shouldSwing = windupTime > maxWindupTime || 
                     ballDistance < 120 || 
                     ballSpeed > 6 ||
                     (aiState.windupPhase > Math.PI * 2 && ballDistance < 200);
    
    if (shouldSwing) {
        aiState.mode = 'SWINGING';
        aiState.swingStartTime = currentTime;
        aiState.windupPhase = 0;
        aiState.peakReached = false;
        aiState.comboBop = false;
        aiState.lastPositions = [];
        
        // Carry momentum into swing
        aiState.targetVelocity = aiState.currentVelocity * 2;
    }
}

function handleAISwing(currentTime, ball, rightPaddle, rightSupport) {
    let paddlePos = rightPaddle.position;
    
    let anchorOffsetNeeded = calculateAnchorOffset(aiState.interceptY, paddlePos, rightSupport.position);
    aiState.targetY = aiState.interceptY + anchorOffsetNeeded;
    
    let swingTime = currentTime - aiState.swingStartTime;
    let maxSwingTime = aiState.timingWindow;
    
    if (swingTime > maxSwingTime || Math.abs(ball.velocity.x) < 2) {
        aiState.mode = 'RECOVERING';
        aiState.lastHitTime = currentTime;
    }
}

function handleAIRecovery(currentTime) {
    aiState.targetY = aiState.idleTarget + aiState.breathingOffset;
    
    let recoveryTime = currentTime - aiState.lastHitTime;
    if (recoveryTime > 400) {
        aiState.mode = 'ANTICIPATING';
    }
}

function handleAIAnticipation(currentTime, ballPos, ballVel, 
                             rightPaddle, rightSupport, height) {
    let baseTarget = aiState.idleTarget + aiState.breathingOffset + aiState.microAdjustment;
    let ballTrackingTarget = ballPos.y;
    
    let desiredPaddleY = lerp(baseTarget, ballTrackingTarget, 0.15);
    
    let paddlePos = rightPaddle.position;
    let anchorPos = rightSupport.position;
    let anchorOffsetNeeded = calculateAnchorOffset(desiredPaddleY, paddlePos, anchorPos);
    aiState.targetY = desiredPaddleY + anchorOffsetNeeded;
    
    if (ballVel.x > 0) {
        aiState.mode = 'TRACKING';
    }
}

// ============= HELPER FUNCTIONS =============
function calculateAnchorOffset(targetPaddleY, currentPaddlePos, currentAnchorPos) {
    let springVectorY = currentPaddlePos.y - currentAnchorPos.y;
    let estimatedPaddleOffset = springVectorY * 0.8;
    return -estimatedPaddleOffset;
}

function executeAIMovement(aiSettings, rightSupport) {
    let currentY = rightSupport.position.y;
    let deltaY = aiState.targetY - currentY;
    
    // Lower threshold for more constant movement
    if (Math.abs(deltaY) > 0.5) { // Reduced from 1
        let baseSpeed = 0.15 * aiSettings.speed; // Increased from 0.12
        
        // Apply swing power during swing phase
        if (aiState.mode === 'SWINGING') {
            baseSpeed *= aiState.swingPower * (1 + aiState.aggressionLevel * 0.5); // Increased multiplier
            
            // Add momentum from windup if available
            if (aiState.targetVelocity > 0) {
                baseSpeed *= (1 + aiState.targetVelocity * 0.15); // Increased from 0.1
                aiState.targetVelocity *= 0.85; // Slower decay
            }
        } else if (aiState.mode === 'WINDING_UP') {
            // Enhanced windup speed based on phase and settings
            let windupSpeedMultiplier = aiSettings.windupSpeed / AI_WINDUP_SPEED;
            baseSpeed *= (2.0 + windupSpeedMultiplier); // Increased from 1.5
            
            // Add extra speed at peak velocity points
            if (aiState.peakReached) {
                baseSpeed *= 1.5; // Increased from 1.3
            }
        } else if (aiState.mode === 'TRACKING' || aiState.mode === 'ANTICIPATING') {
            // Add movement urgency based on ball position
            let ball = window.ball; // Access global ball
            if (ball && ball.velocity.x > 0) {
                let urgency = 1 + (1 - (ball.position.x / window.width)) * aiSettings.aggression;
                baseSpeed *= urgency;
            }
        }
        
        // Apply aggression multiplier with higher impact
        baseSpeed *= (1 + aiState.aggressionLevel * 0.5); // Increased from 0.3
        
        let movement = deltaY * baseSpeed;
        
        // Allow faster movement for hard AI
        let maxSpeed = SUPPORT_SPEED * (1.2 + aiSettings.aggression * 0.3);
        movement = Math.max(-maxSpeed, Math.min(maxSpeed, movement));
        
        // Import moveSupportEnhanced from game-systems
        const moveSupportEnhanced = window.moveSupportEnhanced;
        moveSupportEnhanced(rightSupport, movement, window.height);
        
        // Update input buffer for visual effects
        window.inputBuffer.right = movement / maxSpeed;
    } else {
        // Even when close to target, add small movements for liveliness
        if (aiSettings.idleMovement > 0.5) {
            let tinyMovement = (Math.random() - 0.5) * aiSettings.idleMovement;
            const moveSupportEnhanced = window.moveSupportEnhanced;
            moveSupportEnhanced(rightSupport, tinyMovement, window.height);
            window.inputBuffer.right = tinyMovement / SUPPORT_SPEED;
        } else {
            // Gradually reduce input buffer when AI is not moving
            window.inputBuffer.right *= 0.9; // Slower decay for more visible movement
        }
    }
}

// Utility function - should match p5.js lerp
function lerp(start, stop, amt) {
    return amt * (stop - start) + start;
}