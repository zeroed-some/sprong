// ai.js - AI logic and behavior

// ============= AI SETTINGS =============
const AI_SETTINGS = {
    easy: {
        reactionTime: 400,
        accuracy: 0.7,
        speed: 0.8,
        prediction: 0.3,
        aggression: 0.2,
        oscillation: 0.3,
        bopChance: 0.25
    },
    medium: {
        reactionTime: 250,
        accuracy: 0.85,
        speed: 1.0,
        prediction: 0.6,
        aggression: 0.5,
        oscillation: 0.7,
        bopChance: 0.55
    },
    hard: {
        reactionTime: 150,
        accuracy: 0.95,
        speed: 1.2,
        prediction: 0.8,
        aggression: 0.8,
        oscillation: 1.0,
        bopChance: 0.85
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
    
    // Oscillation parameters
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
    aiState.breathingOffset = Math.sin(currentTime * 0.003) * 3;
    
    if (currentTime - aiState.lastMicroTime > 2000 + Math.random() * 1000) {
        aiState.microAdjustment = (Math.random() - 0.5) * 15;
        aiState.lastMicroTime = currentTime;
    }
    
    aiState.microAdjustment *= 0.98;
    
    if (aiState.mode === 'ANTICIPATING' || aiState.mode === 'RECOVERING') {
        let centerY = height / 2;
        let wanderRadius = 25;
        aiState.idleTarget = centerY + Math.sin(currentTime * 0.002) * wanderRadius;
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
    
    let trackingIntensity = ballApproaching ? 0.08 : 0.03;
    
    let desiredPaddleY = ballPos.y + aiState.microAdjustment;
    desiredPaddleY = Math.max(80, Math.min(height - 80, desiredPaddleY));
    
    let anchorOffsetNeeded = calculateAnchorOffset(desiredPaddleY, paddlePos, anchorPos);
    let targetAnchorY = desiredPaddleY + anchorOffsetNeeded;
    
    aiState.targetY = lerp(aiState.targetY, targetAnchorY, trackingIntensity);
    
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
    
    // Execute bop
    if (aiState.consideringBop && ballApproaching) {
        let timeToBop = currentTime - aiState.bopDecisionTime;
        let paddleY = rightPaddle.position.y;
        let distanceToBall = Math.abs(ballPos.y - paddleY);
        
        let shouldBop = timeToBop > aiState.bopTiming && 
                       ballDistance < 150 &&
                       distanceToBall < PADDLE_HEIGHT / 2 + 20 &&
                       !bopState.right.active;
        
        if (shouldBop) {
            activateBop('right', currentTime, rightPaddle, rightSupport, engine, particles);
            aiState.consideringBop = false;
            console.log(`AI BOP! Difficulty: ${aiState.difficulty}, Speed: ${ballSpeed.toFixed(1)}`);
        }
        
        if (ballDistance > 200 || ballDistance < 50) {
            aiState.consideringBop = false;
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
                aiState.mode = 'WINDING_UP';
                aiState.windupStartTime = currentTime;
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
    let maxWindupTime = 800;
    let timeProgress = Math.min(windupTime / maxWindupTime, 1.0);
    
    let easedProgress = timeProgress < 0.5 
        ? 2 * timeProgress * timeProgress 
        : 1 - Math.pow(-2 * timeProgress + 2, 3) / 2;
    
    aiState.windupProgress = easedProgress;
    
    let windupTargetY = aiState.interceptY + aiState.windupDirection * 
                       aiState.windupDistance * aiState.aggressionLevel * easedProgress;
    windupTargetY = Math.max(50, Math.min(height - 50, windupTargetY));
    
    let anchorOffsetNeeded = calculateAnchorOffset(windupTargetY, rightPaddle.position, rightSupport.position);
    aiState.targetY = windupTargetY + anchorOffsetNeeded;
    
    let ballDistance = width - ballPos.x;
    let ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    let shouldSwing = windupTime > maxWindupTime || 
                     ballDistance < 120 || 
                     ballSpeed > 6 ||
                     easedProgress > 0.85;
    
    if (shouldSwing) {
        aiState.mode = 'SWINGING';
        aiState.swingStartTime = currentTime;
        aiState.windupProgress = 0;
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
    
    if (Math.abs(deltaY) > 1) {
        let baseSpeed = 0.12 * aiSettings.speed;
        
        if (aiState.mode === 'SWINGING') {
            baseSpeed *= aiState.swingPower * (1 + aiState.aggressionLevel * 0.3);
        } else if (aiState.mode === 'WINDING_UP') {
            let windupSpeedMultiplier = 0.3 + (aiState.windupProgress * 0.4);
            baseSpeed *= windupSpeedMultiplier;
        }
        
        baseSpeed *= (1 + aiState.aggressionLevel * 0.3);
        
        let movement = deltaY * baseSpeed;
        movement = Math.max(-SUPPORT_SPEED * 1.1, Math.min(SUPPORT_SPEED * 1.1, movement));
        
        // Import moveSupportEnhanced from game-systems
        const moveSupportEnhanced = window.moveSupportEnhanced;
        moveSupportEnhanced(rightSupport, movement, window.height);
        
        // Update input buffer for visual effects
        window.inputBuffer.right = movement / (SUPPORT_SPEED * 1.1);
    } else {
        window.inputBuffer.right *= 0.95;
    }
}

// Utility function - should match p5.js lerp
function lerp(start, stop, amt) {
    return amt * (stop - start) + start;
}