// rendering.js - All visual rendering and particle effects

// ============= PARTICLE SYSTEM =============
let particles = [];

function createImpactParticles(x, y, velX, velY) {
    for (let i = 0; i < IMPACT_PARTICLES; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 6 + 2;
        let size = Math.random() * 4 + 2;
        
        particles.push({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed - velX * 0.2,
            vy: Math.sin(angle) * speed - velY * 0.2,
            size: size,
            life: PARTICLE_LIFE,
            maxLife: PARTICLE_LIFE,
            color: { r: 255, g: Math.random() * 155 + 100, b: Math.random() * 50 + 100 },
            type: 'impact'
        });
    }
}

function createSpringParticles(springPos, compression) {
    if (Math.random() < SPRING_PARTICLE_RATE * compression) {
        let angle = Math.random() * Math.PI * 2;
        let speed = (Math.random() * 2 + 1) * compression;
        
        particles.push({
            x: springPos.x + (Math.random() - 0.5) * 20,
            y: springPos.y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 2 + 1,
            life: PARTICLE_LIFE * 0.5,
            maxLife: PARTICLE_LIFE * 0.5,
            color: { r: 0, g: 255, b: 136 },
            type: 'spring'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life--;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
    
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
            fill(p.color.r, p.color.g, p.color.b, alpha);
            noStroke();
            ellipse(0, 0, p.size, p.size);
            
            fill(p.color.r, p.color.g, p.color.b, alpha * 0.3);
            ellipse(0, 0, p.size * 2, p.size * 2);
        } else if (p.type === 'spring') {
            fill(p.color.r, p.color.g, p.color.b, alpha);
            noStroke();
            ellipse(0, 0, p.size, p.size);
        }
        
        pop();
    }
}

// ============= PADDLE RENDERING =============
function drawPaddlesWithGlow(ball, leftPaddle, rightPaddle, 
                                   bopState, aiEnabled, aiState, millis) {
    let ballPos = ball.position;
    let leftDist = dist(ballPos.x, ballPos.y, leftPaddle.position.x, leftPaddle.position.y);
    let rightDist = dist(ballPos.x, ballPos.y, rightPaddle.position.x, rightPaddle.position.y);
    
    drawSinglePaddleEnhanced(leftPaddle, leftDist, true, false, 
                           bopState, aiEnabled, aiState, millis);
    drawSinglePaddleEnhanced(rightPaddle, rightDist, false, aiEnabled, 
                           bopState, aiEnabled, aiState, millis);
}

function drawSinglePaddleEnhanced(paddle, ballDistance, isLeft, isAI, 
                                 bopState, aiEnabled, aiState, currentMillis) {
    let pos = paddle.position;
    let angle = paddle.angle;
    
    let glowIntensity = map(ballDistance, 0, PADDLE_GLOW_DISTANCE, 150, 0);
    glowIntensity = constrain(glowIntensity, 0, 150);
    
    // Add bop glow effect
    let bopGlow = 0;
    if (isLeft && bopState.left.active) {
        let bopProgress = (currentMillis - bopState.left.startTime) / bopState.left.duration;
        bopGlow = (1 - bopProgress) * 100;
    } else if (!isLeft && bopState.right.active) {
        let bopProgress = (currentMillis - bopState.right.startTime) / bopState.right.duration;
        bopGlow = (1 - bopProgress) * 100;
    }
    
    glowIntensity += bopGlow;
    
    // Add AI state-based effects
    if (isAI) {
        if (aiState.mode === 'WINDING_UP') {
            glowIntensity += 50;
        } else if (aiState.mode === 'SWINGING') {
            glowIntensity += 100;
        }
        glowIntensity += aiState.aggressionLevel * 30;
    }
    
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    
    // Color schemes
    let paddleColor = isAI ? [255, 100, 100] : [0, 255, 136];
    
    if (isAI && aiState.mode === 'WINDING_UP') {
        paddleColor = [255, 150, 50];
    } else if (isAI && aiState.mode === 'SWINGING') {
        paddleColor = [255, 50, 50];
    }
    
    // Bop color override
    if ((isLeft && bopState.left.active) || (!isLeft && bopState.right.active)) {
        paddleColor = [255, 255, 100];
        
        if (isAI && bopState.right.active) {
            paddleColor = [255, 50, 255];
            glowIntensity = Math.min(255, glowIntensity + 50);
        }
    }
    
    // Draw glow effect
    if (glowIntensity > 0) {
        fill(paddleColor[0], paddleColor[1], paddleColor[2], glowIntensity * 0.6);
        noStroke();
        rectMode(CENTER);
        rect(0, 0, PADDLE_WIDTH + 12, PADDLE_HEIGHT + 12);
        
        fill(paddleColor[0], paddleColor[1], paddleColor[2], glowIntensity * 0.3);
        rect(0, 0, PADDLE_WIDTH + 20, PADDLE_HEIGHT + 20);
    }
    
    // Draw main paddle
    fill(paddleColor[0], paddleColor[1], paddleColor[2]);
    stroke(paddleColor[0], paddleColor[1], paddleColor[2], 220 + glowIntensity * 0.5);
    strokeWeight(3);
    rectMode(CENTER);
    rect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    // Core highlight
    if (isAI) {
        fill(255, 200, 200, 100);
    } else {
        fill(150, 255, 200, 100);
    }
    noStroke();
    rect(0, 0, PADDLE_WIDTH - 4, PADDLE_HEIGHT - 4);
    
    pop();
}

// ============= SPRING RENDERING =============
function drawSpringsEnhanced(leftSupport, leftPaddle, rightSupport, rightPaddle) {
    let leftSupportPos = leftSupport.position;
    let leftPaddlePos = leftPaddle.position;
    let leftCompression = drawSpringLineEnhanced(leftSupportPos, leftPaddlePos);
    createSpringParticles(leftPaddlePos, leftCompression);
    
    let rightSupportPos = rightSupport.position;
    let rightPaddlePos = rightPaddle.position;
    let rightCompression = drawSpringLineEnhanced(rightSupportPos, rightPaddlePos);
    createSpringParticles(rightPaddlePos, rightCompression);
}

function drawSpringLineEnhanced(startPos, endPos) {
    let segments = 12;
    let amplitude = 10;
    
    let currentLength = dist(startPos.x, startPos.y, endPos.x, endPos.y);
    let compression = SPRING_LENGTH / currentLength;
    amplitude *= compression;
    
    let glowIntensity = 150 + compression * SPRING_GLOW_INTENSITY;
    stroke(0, 255, 136, glowIntensity);
    strokeWeight(3 + compression * 2);
    
    beginShape();
    noFill();
    
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        let x = lerp(startPos.x, endPos.x, t);
        let y = lerp(startPos.y, endPos.y, t);
        
        if (i > 0 && i < segments) {
            let perpX = -(endPos.y - startPos.y) / currentLength;
            let perpY = (endPos.x - startPos.x) / currentLength;
            let offset = sin(i * PI * 1.5) * amplitude;
            x += perpX * offset;
            y += perpY * offset;
        }
        
        vertex(x, y);
    }
    
    endShape();
    
    // Glow effect
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
    
    return compression;
}

// ============= SUPPORT POINTS RENDERING =============
function drawSupportPointsEnhanced(leftSupport, rightSupport, inputBuffer) {
    let leftActivity = Math.abs(inputBuffer.left) * 255;
    let rightActivity = Math.abs(inputBuffer.right) * 255;
    
    let leftPulse = sin(frameCount * 0.2) * 0.3 + 1;
    fill(0, 255, 136, 100 + leftActivity * 0.6);
    noStroke();
    ellipse(leftSupport.position.x, leftSupport.position.y, 
           (8 + leftActivity * 0.15) * leftPulse, 
           (8 + leftActivity * 0.15) * leftPulse);
    
    let rightPulse = sin(frameCount * 0.2 + PI) * 0.3 + 1;
    fill(0, 255, 136, 100 + rightActivity * 0.6);
    ellipse(rightSupport.position.x, rightSupport.position.y, 
           (8 + rightActivity * 0.15) * rightPulse, 
           (8 + rightActivity * 0.15) * rightPulse);
}

// ============= BALL RENDERING =============
function drawBallEnhanced(ball) {
    let ballPos = ball.position;
    let ballVel = ball.velocity;
    let speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    let speedIntensity = map(speed, 0, 15, 50, 255);
    
    // Trail effect
    for (let i = 0; i < 3; i++) {
        let offset = i * 3;
        fill(255, 100, 100, 40 - i * 10);
        noStroke();
        ellipse(ballPos.x - ballVel.x * offset * 0.1, 
               ballPos.y - ballVel.y * offset * 0.1, 
               BALL_RADIUS * (4 - i), BALL_RADIUS * (4 - i));
    }
    
    // Main ball
    fill(255, 100, 100);
    stroke(255, 200, 200, speedIntensity);
    strokeWeight(3 + speed * 0.15);
    ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 2, BALL_RADIUS * 2);
    
    // Speed core
    if (speed > 8) {
        fill(255, 255, 255, speedIntensity * 0.8);
        noStroke();
        ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 0.8, BALL_RADIUS * 0.8);
    }
    
    // Energy ring
    if (speed > 12) {
        noFill();
        stroke(255, 255, 255, speedIntensity * 0.5);
        strokeWeight(2);
        ellipse(ballPos.x, ballPos.y, BALL_RADIUS * 3, BALL_RADIUS * 3);
    }
}

// ============= UI RENDERING =============
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

function drawDebugInfo(ball, leftSupport, leftPaddle, rightSupport, rightPaddle,
                             inputBuffer, particles, gameMode, aiState, bopState, aiEnabled) {
    fill(255, 100);
    textAlign(LEFT);
    textSize(12);
    text(`FPS: ${Math.round(frameRate())}`, 10, 20);
    text(`Ball Speed: ${Math.round(getBallSpeed(ball))}`, 10, 35);
    text(`Particles: ${particles.length}`, 10, 50);
    text(`Mode: ${gameMode} | Difficulty: ${aiState.difficulty}`, 10, 65);
    
    // Spring info
    let leftSpringLength = dist(leftSupport.position.x, leftSupport.position.y, 
                               leftPaddle.position.x, leftPaddle.position.y);
    let rightSpringLength = dist(rightSupport.position.x, rightSupport.position.y, 
                                rightPaddle.position.x, rightPaddle.position.y);
    
    text(`L Spring: ${Math.round(leftSpringLength)}px (${((SPRING_LENGTH/leftSpringLength - 1) * 100).toFixed(0)}%)`, 10, 80);
    text(`R Spring: ${Math.round(rightSpringLength)}px (${((SPRING_LENGTH/rightSpringLength - 1) * 100).toFixed(0)}%)`, 10, 95);
    text(`Input: L=${inputBuffer.left.toFixed(2)} R=${inputBuffer.right.toFixed(2)}`, 10, 110);
    
    // AI debug info
    if (aiEnabled) {
        text(`AI State: ${aiState.mode} | Aggression: ${aiState.aggressionLevel.toFixed(2)}`, 10, 125);
        text(`Target: ${Math.round(aiState.targetY)} | Intercept: ${Math.round(aiState.interceptY)}`, 10, 140);
        text(`Ball: (${Math.round(ball.position.x)}, ${Math.round(ball.position.y)}) Vel: (${ball.velocity.x.toFixed(1)}, ${ball.velocity.y.toFixed(1)})`, 10, 155);
        
        if (aiState.mode === 'WINDING_UP') {
            fill(255, 150, 50, 200);
            text("🔄 AI WINDING UP FOR POWER SHOT", 10, 175);
        } else if (aiState.mode === 'SWINGING') {
            fill(255, 50, 50, 200);
            text("⚡ AI POWER SWING!", 10, 175);
        } else if (aiState.consideringBop) {
            fill(255, 255, 100, 200);
            text("💥 AI PREPARING BOP!", 10, 175);
        }
        
        if (bopState.right.active) {
            fill(255, 255, 0, 255);
            text("🚀 AI BOPPING!", 10, 190);
        }
    }
}

function drawStartMessage(aiEnabled, aiDifficulty) {
    fill(0, 255, 136, 200);
    textAlign(CENTER);
    textSize(20);
    text("Press any key to start!", width/2, height/2 + 100);
    textSize(14);
    
    if (aiEnabled) {
        text("Player vs CPU | Left paddle: W/S or Mouse/Touch", width/2, height/2 + 125);
        text(`AI Difficulty: ${aiDifficulty.toUpperCase()}`, width/2, height/2 + 145);
    } else {
        text("2 Player Mode | P1: W/S | P2: ↑/↓ | Mouse/Touch: Drag paddles", width/2, height/2 + 125);
    }
    
    textSize(12);
    fill(0, 255, 136, 120);
    text("Press ESC to return to menu", width/2, height/2 + 170);
}

// ============= MENU RENDERING =============
function drawMenu(menuState) {
    drawMenuBackground();
    
    // Title
    push();
    let titlePulse = sin(frameCount * 0.05) * 0.2 + 1;
    fill(0, 255, 136);
    textAlign(CENTER);
    textSize(60 * titlePulse);
    text("SPRONG", width/2, 120);
    
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
        
        if (isSelected) {
            push();
            let pulse = sin(frameCount * 0.15) * 0.3 + 1;
            fill(0, 255, 136, 100 * pulse);
            noStroke();
            rectMode(CENTER);
            rect(width/2, y, 300, 45);
            pop();
        }
        
        fill(isSelected ? 255 : 200);
        textAlign(CENTER);
        textSize(isSelected ? 24 : 20);
        text(menuState.options[i], width/2, y + 8);
        
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
    
    textSize(12);
    fill(255, 100);
    if (menuState.selectedOption === 0) {
        text("Controls: W/S keys + LEFT SHIFT (bop) or Mouse/Touch", width/2, height - 30);
    } else {
        text("Controls: P1 (W/S + L.Shift) | P2 (↑/↓ + Enter) | Mouse/Touch", width/2, height - 30);
    }
}

function drawMenuBackground() {
    push();
    stroke(0, 255, 136, 30);
    strokeWeight(1);
    
    for (let x = 0; x < width; x += 40) {
        let offset = sin(frameCount * 0.01 + x * 0.01) * 5;
        line(x, 0, x, height + offset);
    }
    
    for (let y = 0; y < height; y += 40) {
        let offset = cos(frameCount * 0.01 + y * 0.01) * 5;
        line(0, y, width + offset, y);
    }
    
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

// ============= HELPER FUNCTIONS =============
function getBallSpeed(ball) {
    let velocity = ball.velocity;
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}