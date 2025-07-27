// sprong.js - Main game file that ties all modules together

// Matter.js module aliases
const Body = Matter.Body;
const World = Matter.World;
const Engine = Matter.Engine;
const Bodies = Matter.Bodies;

// Global game variables
let ball;
let world;
let engine;
let boundaries = [];
let leftSupport, leftPaddle, leftSpring;
let rightSupport, rightPaddle, rightSpring;

// Game state
let leftScore = 0;
let rightScore = 0;
let aiEnabled = true;
let gameState = 'menu';
let gameMode = 'vs-cpu';
let gameStarted = false;

// Menu state
let menuState = {
    selectedOption: 0,
    options: ['1 Player vs CPU', '2 Player'],
    difficultySelected: 1,
    difficulties: ['Easy', 'Medium', 'Hard'],
    showDifficulty: true
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
    smoothing: 0.08,
    deadZone: 15
};

// Make necessary variables globally accessible for other scripts
window.inputBuffer = inputBuffer;
window.moveSupportEnhanced = moveSupportEnhanced;

function setup() {
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('gameCanvas');
    
    engine = Engine.create();
    world = engine.world;
    
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    
    // Create boundaries
    let topWall = Bodies.rectangle(width/2, -10, width, 20, { isStatic: true });
    let bottomWall = Bodies.rectangle(width/2, height + 10, width, 20, { isStatic: true });
    boundaries.push(topWall, bottomWall);
    
    // Create spring paddle systems
    let leftSystem = createSpringPaddleSystem('left', width, height);
    leftSupport = leftSystem.support;
    leftPaddle = leftSystem.paddle;
    leftSpring = leftSystem.spring;
    
    let rightSystem = createSpringPaddleSystem('right', width, height);
    rightSupport = rightSystem.support;
    rightPaddle = rightSystem.paddle;
    rightSpring = rightSystem.spring;
    
    // Create ball
    ball = resetBall(null, world, width, height);
    
    // Add everything to the world
    World.add(world, [
        ...boundaries,
        leftSupport, leftPaddle, leftSpring,
        rightSupport, rightPaddle, rightSpring
    ]);
    
    // Set up collision handlers
    setupCollisionHandlers(engine, ball, leftPaddle, rightPaddle, particles);
}

function draw() {
    Engine.update(engine);
    
    background(10, 10, 10);
    
    if (gameState === 'menu') {
        drawMenu(menuState);
    } else {
        handleEnhancedInput();
        updateParticles();
        checkBallPosition();
        
        // Enhanced collision detection during bops
        if (bopState.left.active || bopState.right.active) {
            Engine.update(engine, 8);
        }
        
        // Draw everything
        drawParticles();
        drawSpringsEnhanced(leftSupport, leftPaddle, rightSupport, rightPaddle);
        drawPaddlesWithGlow(ball, leftPaddle, rightPaddle, bopState, aiEnabled, aiState, millis());
        drawSupportPointsEnhanced(leftSupport, rightSupport, inputBuffer);
        drawBallEnhanced(ball);
        drawBoundaries();
        drawCenterLine();
        drawDebugInfo(ball, leftSupport, leftPaddle, rightSupport, rightPaddle,
                     inputBuffer, particles, gameMode, aiState, bopState, aiEnabled);
        
        if (!gameStarted) {
            drawStartMessage(aiEnabled, aiState.difficulty);
        }
    }
}

function handleEnhancedInput() {
    handleKeyboardInput();
    handleMouseTouchInput();
    handleBopInput(keys, aiEnabled, millis(), leftPaddle, rightPaddle, 
                   leftSupport, rightSupport, engine, particles);
    
    if (aiEnabled && gameStarted) {
        handleAI(millis(), ball, rightPaddle, rightSupport, 
                leftScore, rightScore, width, height, 
                bopState, activateBop, engine, particles);
    }
}

function handleKeyboardInput() {
    let leftInput = 0;
    let rightInput = 0;
    
    if (keys['w'] || keys['W']) leftInput -= 1;
    if (keys['s'] || keys['S']) leftInput += 1;
    
    if (!aiEnabled) {
        if (keys['ArrowUp']) rightInput -= 1;
        if (keys['ArrowDown']) rightInput += 1;
    }
    
    inputBuffer.left = lerp(inputBuffer.left, leftInput, INPUT_SMOOTHING);
    if (!aiEnabled) {
        inputBuffer.right = lerp(inputBuffer.right, rightInput, INPUT_SMOOTHING);
    }
    
    if (!mouseInput.active) {
        if (Math.abs(inputBuffer.left) > 0.01) {
            moveSupportEnhanced(leftSupport, inputBuffer.left * SUPPORT_SPEED, height);
        }
        if (!aiEnabled && Math.abs(inputBuffer.right) > 0.01) {
            moveSupportEnhanced(rightSupport, inputBuffer.right * SUPPORT_SPEED, height);
        }
    }
}

function handleMouseTouchInput() {
    if (!mouseInput.active) return;
    
    let controllingLeft = mouseX < width / 2;
    if (!controllingLeft && aiEnabled) return;
    
    let targetSupport = controllingLeft ? leftSupport : rightSupport;
    let currentY = targetSupport.position.y;
    let targetY = mouseY;
    let deltaY = targetY - currentY;
    
    if (Math.abs(deltaY) < mouseInput.deadZone) {
        return;
    }
    
    let movement = deltaY * MOUSE_LAG_FACTOR * TOUCH_SENSITIVITY;
    movement = constrain(movement, -MOUSE_SPEED_LIMIT, MOUSE_SPEED_LIMIT);
    
    moveSupportEnhanced(targetSupport, movement, height);
    
    if (controllingLeft) {
        inputBuffer.left = constrain(movement / MOUSE_SPEED_LIMIT, -1, 1);
    } else if (!aiEnabled) {
        inputBuffer.right = constrain(movement / MOUSE_SPEED_LIMIT, -1, 1);
    }
}

function checkBallPosition() {
    let ballX = ball.position.x;
    
    if (ballX < -BALL_RADIUS) {
        rightScore++;
        updateScore();
        ball = resetBall(ball, world, width, height);
        gameStarted = false;
    }
    
    if (ballX > width + BALL_RADIUS) {
        leftScore++;
        updateScore();
        ball = resetBall(ball, world, width, height);
        gameStarted = false;
    }
}

function updateScore() {
    document.getElementById('leftScore').textContent = leftScore;
    document.getElementById('rightScore').textContent = rightScore;
}

// Input handlers
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
    
    if (key === 'm' || key === 'M') {
        aiEnabled = !aiEnabled;
        gameMode = aiEnabled ? 'vs-cpu' : 'vs-human';
        console.log("Switched to " + gameMode + " mode");
    }
    
    if (key === 'd' || key === 'D') {
        if (aiState.difficulty === 'easy') {
            aiState.difficulty = 'medium';
        } else if (aiState.difficulty === 'medium') {
            aiState.difficulty = 'hard';
        } else {
            aiState.difficulty = 'easy';
        }
        console.log("AI difficulty: " + aiState.difficulty);
    }
    
    if (key === ' ') {
        leftScore = 0;
        rightScore = 0;
        updateScore();
        ball = resetBall(ball, world, width, height);
        gameStarted = false;
        
        inputBuffer.left = 0;
        inputBuffer.right = 0;
        mouseInput.active = false;
        
        aiState.targetY = height / 2;
        aiState.lastUpdateTime = 0;
        aiState.mode = 'ANTICIPATING';
        aiState.aggressionLevel = AI_SETTINGS[aiState.difficulty].aggression;
        aiState.windupProgress = 0;
        
        particles.length = 0;
        
        console.log("Game reset!");
    }
    
    if (keyCode === 27) {
        gameState = 'menu';
        gameStarted = false;
        particles.length = 0;
        console.log("Returned to menu");
    }
}

function handleMenuInput() {
    if (keyCode === UP_ARROW) {
        menuState.selectedOption = Math.max(0, menuState.selectedOption - 1);
    } else if (keyCode === DOWN_ARROW) {
        menuState.selectedOption = Math.min(menuState.options.length - 1, menuState.selectedOption + 1);
    }
    
    if (menuState.selectedOption === 0) {
        if (keyCode === LEFT_ARROW) {
            menuState.difficultySelected = Math.max(0, menuState.difficultySelected - 1);
        } else if (keyCode === RIGHT_ARROW) {
            menuState.difficultySelected = Math.min(menuState.difficulties.length - 1, menuState.difficultySelected + 1);
        }
    }
    
    if (keyCode === ENTER || key === ' ') {
        startGameWithSelection();
    }
}

function startGameWithSelection() {
    if (menuState.selectedOption === 0) {
        aiEnabled = true;
        gameMode = 'vs-cpu';
        aiState.difficulty = menuState.difficulties[menuState.difficultySelected].toLowerCase();
    } else {
        aiEnabled = false;
        gameMode = 'vs-human';
    }
    
    gameState = 'playing';
    gameStarted = false;
    
    leftScore = 0;
    rightScore = 0;
    updateScore();
    ball = resetBall(ball, world, width, height);
    
    inputBuffer.left = 0;
    inputBuffer.right = 0;
    mouseInput.active = false;
    
    aiState.targetY = height / 2;
    aiState.lastUpdateTime = 0;
    
    particles.length = 0;
    
    console.log("Started " + gameMode + " mode" + (aiEnabled ? " - Difficulty: " + aiState.difficulty : ""));
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}

function mousePressed() {
    if (gameState === 'menu') {
        handleMenuClick();
        return false;
    }
    
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        mouseInput.active = true;
        
        if (!gameStarted) {
            gameStarted = true;
        }
        
        return false;
    }
}

function handleMenuClick() {
    let startY = height/2 - 20;
    let spacing = 60;
    
    for (let i = 0; i < menuState.options.length; i++) {
        let y = startY + i * spacing;
        
        if (mouseY > y - 25 && mouseY < y + 25) {
            if (menuState.selectedOption === i) {
                startGameWithSelection();
            } else {
                menuState.selectedOption = i;
            }
            break;
        }
    }
    
    if (menuState.selectedOption === 0) {
        let diffY = startY + 28;
        if (mouseY > diffY && mouseY < diffY + 20) {
            menuState.difficultySelected = (menuState.difficultySelected + 1) % menuState.difficulties.length;
        }
    }
}

function mouseDragged() {
    if (mouseInput.active) {
        return false;
    }
}

function mouseReleased() {
    mouseInput.active = false;
    inputBuffer.left *= 0.8;
    inputBuffer.right *= 0.8;
}

function touchStarted() {
    return mousePressed();
}

function touchMoved() {
    return mouseDragged();
}

function touchEnded() {
    mouseReleased();
    return false;
}

// Helper functions
function getBallSpeed() {
    let velocity = ball.velocity;
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}