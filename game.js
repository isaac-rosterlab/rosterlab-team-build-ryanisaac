// Game configuration
const config = {
    width: 450,        // Increased from 400 for wider view
    height: 700,       // Increased from 600 for taller view
    gravity: 0.4,      // Reduced from 0.5 for slower fall
    jumpPower: -13,    // Reduced from -15 for lower jumps
    moveSpeed: 3,      // Further reduced from 3.5
    platformGap: 65,   // Reduced gap to make it slightly easier
    cellSize: 60,
    gridLineColor: '#e0e0e0',
    darkGridLineColor: '#cccccc'
};

// Game state
let gameState = {
    player: null,
    platforms: [],
    obstacles: [],
    powerUps: [],
    projectiles: [],
    playerBullets: [],
    flyingMonsters: [],
    camera: { y: 0 },
    maxHeight: 0,
    score: 0,
    gameRunning: false,
    rosterData: [],
    keys: {},
    tilt: 0,
    mouseX: 0,
    touchX: 0,
    touchStartX: 0,
    isDragging: false,
    isMobile: false,
    doubleJumpActive: false,
    doubleJumpTimer: 0
};

// Canvas and context
let canvas, ctx;
let animationId;

// Sound effects (optional)
const sounds = {
    jump: null,
    powerup: null,
    hit: null
};

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 60;
        this.vx = 0;
        this.vy = 0;
        this.frame = 0;
        this.animTimer = 0;
        this.facing = 1;
        this.shootCooldown = 0;
        this.shootCooldownMax = 12; // 200ms at 60fps
        this.boostVelocity = 0; // For smooth power-up animations
        this.image = new Image();
        this.image.src = 'Images/Doodle/state 1.png';
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
    }
    
    update() {
        // Apply gravity
        this.vy += config.gravity;
        
        // Apply boost velocity (for smooth power-up animation)
        if (this.boostVelocity < 0) {
            this.vy = this.boostVelocity;
            this.boostVelocity += 0.5; // Gradually reduce boost
            if (this.boostVelocity >= 0) {
                this.boostVelocity = 0;
            }
        }
        
        // Apply movement
        if (gameState.isMobile) {
            // Mobile: use touch drag controls
            if (gameState.isDragging) {
                const dragDiff = gameState.touchX - gameState.touchStartX;
                const sensitivity = 0.02; // Adjust sensitivity
                this.vx = Math.max(-config.moveSpeed, Math.min(config.moveSpeed, dragDiff * sensitivity));
                this.facing = dragDiff > 0 ? 1 : -1;
            } else {
                this.vx *= 0.8;
            }
        } else {
            // Desktop: use mouse position
            const playerCenterX = this.x + this.width / 2;
            const mouseDiff = gameState.mouseX - playerCenterX;
            
            if (Math.abs(mouseDiff) > 5) { // Dead zone of 5 pixels
                this.vx = Math.max(-config.moveSpeed, Math.min(config.moveSpeed, mouseDiff * 0.1));
                this.facing = mouseDiff > 0 ? 1 : -1;
            } else {
                this.vx *= 0.8;
            }
            
            // Also support keyboard as fallback
            if (gameState.keys.ArrowLeft || gameState.keys.a || gameState.keys.A) {
                this.vx = -config.moveSpeed;
                this.facing = -1;
            } else if (gameState.keys.ArrowRight || gameState.keys.d || gameState.keys.D) {
                this.vx = config.moveSpeed;
                this.facing = 1;
            }
        }
        
        // Update shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        
        // Shoot on spacebar
        if (gameState.keys[' '] && this.shootCooldown === 0) {
            this.shoot();
            this.shootCooldown = this.shootCooldownMax;
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Wrap around screen
        if (this.x < -this.width) {
            this.x = config.width;
        } else if (this.x > config.width) {
            this.x = -this.width;
        }
        
        // Check platform collisions (only when falling down)
        if (this.vy > 0) {
            for (let platform of gameState.platforms) {
                if (!platform.broken &&
                    this.x < platform.x + platform.width &&
                    this.x + this.width > platform.x &&
                    this.y < platform.y &&
                    this.y + this.height > platform.y &&
                    this.y + this.height - this.vy <= platform.y) {
                    
                    this.y = platform.y - this.height;
                    this.vy = config.jumpPower; // Automatic bounce
                    
                    // Start breaking night shift platforms
                    if (platform.type === 'night') {
                        platform.startBreaking();
                    }
                    
                    // Bonus for valid roster line
                    if (platform.isValidShift) {
                        gameState.score += 5;
                    }
                    
                    playSound('jump');
                    break; // Only bounce on one platform
                }
            }
        }
        
        // Check obstacle collisions
        for (let obstacle of gameState.obstacles) {
            if (!obstacle.hit &&
                this.x < obstacle.x + obstacle.width &&
                this.x + this.width > obstacle.x &&
                this.y < obstacle.y + obstacle.height &&
                this.y + this.height > obstacle.y) {
                
                if (obstacle.type === 'hole') {
                    // Fall through hole
                    this.vy = 5;
                    obstacle.hit = true;
                } else {
                    // Hit monster
                    gameOver();
                    return;
                }
            }
        }
        
        // Check power-up collisions
        for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
            let powerUp = gameState.powerUps[i];
            if (this.x < powerUp.x + powerUp.width &&
                this.x + this.width > powerUp.x &&
                this.y < powerUp.y + powerUp.height &&
                this.y + this.height > powerUp.y) {
                
                if (powerUp.type === 'movac') {
                    // 25% boost with smooth animation (more significant)
                    this.boostVelocity = -15; // Significant boost speed
                    gameState.score += 10; // Bonus points for movac
                } else if (powerUp.type === 'rosterlab') {
                    // 60% boost with smooth animation
                    this.boostVelocity = -25; // Very strong boost speed
                    gameState.score += 20; // Bonus points for rosterlab
                }
                updateScore();
                
                gameState.powerUps.splice(i, 1);
                playSound('powerup');
            }
        }
        
        // Double jump
        if (gameState.doubleJumpActive && gameState.doubleJumpTimer > 0) {
            gameState.doubleJumpTimer--;
            if (gameState.doubleJumpTimer === 0) {
                gameState.doubleJumpActive = false;
            }
        }
        
        // Update camera (only moves up, never down) - player positioned lower for better view ahead
        if (this.y < gameState.camera.y + 350) {
            gameState.camera.y = this.y - 350;
        }
        
        // Track max height reached
        if (this.y < gameState.maxHeight) {
            gameState.maxHeight = this.y;
            // Update score based on max height
            let newScore = Math.max(0, Math.floor((-gameState.maxHeight + 600) / 50));
            if (newScore > gameState.score) {
                gameState.score = newScore;
                updateScore();
            }
        }
        
        // Game over if player falls below visible screen
        if (this.y > gameState.camera.y + config.height) {
            gameOver();
        }
        
        // Animation
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animTimer = 0;
            this.frame = (this.frame + 1) % 2;
        }
    }
    
    shoot() {
        // Limit total player bullets to prevent memory issues
        if (gameState.playerBullets.length > 20) return;
        
        // Create bullet going upward from top of player
        const bullet = new PlayerBullet(
            this.x + this.width / 2 - 3,
            this.y - 10, // Start from top of player sprite
            0,
            -12 // Faster bullet speed (was -8)
        );
        gameState.playerBullets.push(bullet);
        playSound('shoot');
    }
    
    draw(ctx) {
        ctx.save();
        
        if (this.imageLoaded) {
            // Draw the image, flipping it if facing left
            if (this.facing === -1) {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        } else {
            // Fallback rectangle while image loads
            ctx.fillStyle = '#4A90E2';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        ctx.restore();
    }
}

// Platform class
class Platform {
    constructor(x, y, label = '', type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = config.cellSize;
        this.height = 10;
        this.label = label;
        this.type = type; // 'normal', 'night', 'moving'
        this.isValidShift = label.includes('7-15') || label.includes('RN-');
        
        // For night shift platforms
        this.breakTimer = 0;
        this.breaking = false;
        this.broken = false;
        
        // For moving platforms
        this.moveDirection = 1;
        this.moveSpeed = 1.5;
        this.originalX = x;
        
        // Platform has power-up if it's a moving platform (reduced chance)
        this.hasPowerUp = type === 'moving' && Math.random() < 0.2; // Only 20% of moving platforms have power-ups
    }
    
    update() {
        // Update moving platforms
        if (this.type === 'moving') {
            this.x += this.moveSpeed * this.moveDirection;
            
            // Reverse direction at edges
            if (this.x <= 40 || this.x + this.width >= config.width) {
                this.moveDirection *= -1;
            }
        }
        
        // Update breaking platforms
        if (this.type === 'night' && this.breaking && !this.broken) {
            this.breakTimer++;
            if (this.breakTimer > 60) { // Break after 1 second
                this.broken = true;
            }
        }
    }
    
    startBreaking() {
        if (this.type === 'night' && !this.breaking) {
            this.breaking = true;
        }
    }
    
    draw(ctx) {
        if (this.broken) return; // Don't draw broken platforms
        
        // Platform color based on type
        if (this.type === 'normal') {
            ctx.fillStyle = '#2E7D32'; // Dark green for safe platforms
        } else if (this.type === 'night') {
            // Black platform that gets redder as it breaks
            const breakProgress = this.breakTimer / 60;
            const red = Math.floor(255 * breakProgress);
            ctx.fillStyle = `rgb(${red}, 0, 0)`;
        } else if (this.type === 'moving') {
            ctx.fillStyle = '#1976D2'; // Blue for moving platforms
        }
        
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Cell border
        ctx.strokeStyle = this.type === 'night' ? '#333' : '#999';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.lineWidth = 1;
        
        // Label
        if (this.label) {
            ctx.fillStyle = this.type === 'night' ? '#FFF' : '#FFF';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.label, this.x + this.width / 2, this.y - 2);
        }
        
        // Show cracks on breaking platforms
        if (this.type === 'night' && this.breaking) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            const crack1X = this.x + this.width * 0.3;
            const crack2X = this.x + this.width * 0.7;
            
            ctx.beginPath();
            ctx.moveTo(crack1X, this.y);
            ctx.lineTo(crack1X - 5, this.y + this.height);
            ctx.moveTo(crack2X, this.y);
            ctx.lineTo(crack2X + 5, this.y + this.height);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }
}

// Obstacle class
class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 60;  // Increased from 40
        this.height = 60; // Increased from 40
        this.hit = false;
        this.shootTimer = 0;
        this.shootInterval = getDifficulty().shootInterval;
        
        // Load monster image (alternate between two images)
        if (type !== 'hole') {
            this.image = new Image();
            const useAlternateImage = Math.random() < 0.5;
            this.image.src = useAlternateImage ? 'Images/Monsters/images.jpg' : 'Images/Monsters/IMG_5377.png';
            this.imageLoaded = false;
            this.image.onload = () => {
                this.imageLoaded = true;
            };
            this.image.onerror = () => {
                console.error('Failed to load monster image:', this.image.src);
            };
        }
    }
    
    update() {
        // Only monsters can shoot
        if (this.type !== 'hole' && !this.hit && gameState.gameRunning) {
            this.shootTimer++;
            if (this.shootTimer >= this.shootInterval) {
                this.shootTimer = 0;
                this.shoot();
            }
        }
    }
    
    shoot() {
        // Limit total projectiles to prevent memory issues
        if (gameState.projectiles.length > 50) return;
        
        // Calculate direction to player
        const dx = gameState.player.x + gameState.player.width/2 - (this.x + this.width/2);
        const dy = gameState.player.y + gameState.player.height/2 - (this.y + this.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0 && distance < 500) { // Only shoot if player is within range
            // Normalize and set bullet velocity
            const vx = (dx / distance) * 3;
            const vy = (dy / distance) * 3;
            
            // Create projectile
            const projectile = new Projectile(
                this.x + this.width/2 - 5,
                this.y + this.height/2 - 5,
                vx,
                vy
            );
            gameState.projectiles.push(projectile);
        }
    }
    
    draw(ctx) {
        if (this.type === 'hole') {
            // Broken cell
            ctx.strokeStyle = '#666';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.setLineDash([]);
            
            // Torn edges
            ctx.fillStyle = '#FFF';
            ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
        } else {
            // Draw monster image
            if (this.imageLoaded) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                // Fallback to red blob
                ctx.fillStyle = '#FF4444';
                ctx.beginPath();
                ctx.arc(this.x + 20, this.y + 20, 18, 0, Math.PI * 2);
                ctx.fill();
                
                // Exclamation mark
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('!', this.x + 20, this.y + 28);
            }
            
            // Label
            ctx.fillStyle = '#FF4444';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            let label = this.type === 'fatigue' ? 'Fatigue Rule' : 
                       this.type === 'double' ? 'Double Shift' : 'Over Budget';
            ctx.fillText(label, this.x + 20, this.y + 55);
        }
    }
}

// PlayerBullet class
class PlayerBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 6;
        this.height = 10;
        this.active = true;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Check collision with obstacles
        for (let obstacle of gameState.obstacles) {
            if (!obstacle.hit && obstacle.type !== 'hole' &&
                this.x < obstacle.x + obstacle.width &&
                this.x + this.width > obstacle.x &&
                this.y < obstacle.y + obstacle.height &&
                this.y + this.height > obstacle.y) {
                
                // Hit obstacle
                obstacle.hit = true;
                this.active = false;
                gameState.score += 10; // Bonus points for hitting monsters
                updateScore();
                break;
            }
        }
        
        // Deactivate if off screen
        if (this.y < gameState.camera.y - 50) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add a small glow effect
        ctx.shadowColor = '#00FF00';
        ctx.shadowBlur = 5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// Projectile class (enemy bullets)
class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 10;
        this.height = 10;
        this.active = true;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Check collision with player
        if (this.x < gameState.player.x + gameState.player.width &&
            this.x + this.width > gameState.player.x &&
            this.y < gameState.player.y + gameState.player.height &&
            this.y + this.height > gameState.player.y) {
            
            // Hit player
            gameOver();
            this.active = false;
        }
        
        // Deactivate if off screen
        if (this.x < -50 || this.x > config.width + 50 ||
            this.y < gameState.camera.y - 50 || 
            this.y > gameState.camera.y + config.height + 50) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(this.x + 5, this.y + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a small glow effect
        ctx.strokeStyle = '#FF6666';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// FlyingMonster class
class FlyingMonster {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 70;  // Increased from 50
        this.height = 70; // Increased from 50
        this.speed = 1.5 + Math.random() * 1.5; // Slower speed between 1.5-3 (was 2-4)
        this.direction = Math.random() < 0.5 ? -1 : 1; // Random initial direction
        this.animFrame = 0;
        this.animTimer = 0;
        this.active = true;
        
        // Load flying monster image (alternate between two images)
        this.image = new Image();
        const useAlternateImage = Math.random() < 0.5;
        this.image.src = useAlternateImage ? 'Images/Monsters/images.jpg' : 'Images/Monsters/IMG_5377.png';
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
        this.image.onerror = () => {
            console.error('Failed to load flying monster image:', this.image.src);
        };
    }
    
    update() {
        // Move horizontally
        this.x += this.speed * this.direction;
        
        // Bounce off edges
        if (this.x <= 0 || this.x + this.width >= config.width) {
            this.direction *= -1;
        }
        
        // Deactivate if too far from camera
        if (this.y > gameState.camera.y + config.height + 100 ||
            this.y < gameState.camera.y - 200) {
            this.active = false;
        }
        
        // Check collision with player
        if (this.x < gameState.player.x + gameState.player.width &&
            this.x + this.width > gameState.player.x &&
            this.y < gameState.player.y + gameState.player.height &&
            this.y + this.height > gameState.player.y) {
            gameOver();
        }
        
        // Check collision with player bullets
        for (let i = gameState.playerBullets.length - 1; i >= 0; i--) {
            const bullet = gameState.playerBullets[i];
            if (bullet.active &&
                bullet.x < this.x + this.width &&
                bullet.x + bullet.width > this.x &&
                bullet.y < this.y + this.height &&
                bullet.y + bullet.height > this.y) {
                
                // Monster hit
                this.active = false;
                bullet.active = false;
                gameState.score += 15; // Bonus for hitting flying monster
                updateScore();
                playSound('hit');
                break;
            }
        }
        
        // Animation
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 2;
        }
    }
    
    draw(ctx) {
        ctx.save();
        
        if (this.imageLoaded) {
            // Flip image based on direction
            if (this.direction < 0) {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }
        
        ctx.restore();
    }
}

// PowerUp class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 40;
        this.attachedPlatform = null; // For power-ups on moving platforms
        this.offsetX = 0; // Offset from platform center
        
        // Load power-up images
        this.image = new Image();
        if (type === 'movac') {
            this.image.src = 'Images/powerups/1631342884554.jpeg';
        } else if (type === 'rosterlab') {
            this.image.src = 'Images/powerups/QQUIG5yjsIHDnfAC7jzNFbOu4T91732796902043_200x200.png';
        }
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
    }
    
    update() {
        // Move with attached platform
        if (this.attachedPlatform) {
            this.x = this.attachedPlatform.x + this.attachedPlatform.width/2 - this.width/2;
        }
    }
    
    draw(ctx) {
        if (this.imageLoaded) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // Fallback while loading
            if (this.type === 'movac') {
                ctx.fillStyle = '#FF9800';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('M', this.x + 20, this.y + 25);
            } else {
                ctx.fillStyle = '#2196F3';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('RL', this.x + 20, this.y + 25);
            }
        }
    }
}

// Initialize game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Detect mobile
    gameState.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        ('ontouchstart' in window);
    
    // Input handlers
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.key] = false;
    });
    
    // Mouse movement for desktop
    if (!gameState.isMobile) {
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            gameState.mouseX = (e.clientX - rect.left) * scaleX;
        });
        
        // Click to shoot on desktop
        canvas.addEventListener('click', () => {
            if (gameState.gameRunning && gameState.player) {
                gameState.player.shoot();
                gameState.player.shootCooldown = gameState.player.shootCooldownMax;
            }
        });
    }
    
    // Touch controls for mobile
    if (gameState.isMobile) {
        let touchStartTime = 0;
        
        // Touch start - begin drag or prepare to shoot
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            
            gameState.touchStartX = (touch.clientX - rect.left) * scaleX;
            gameState.touchX = gameState.touchStartX;
            gameState.isDragging = true;
            touchStartTime = Date.now();
        });
        
        // Touch move - drag to control movement
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (gameState.isDragging) {
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                
                gameState.touchX = (touch.clientX - rect.left) * scaleX;
            }
        });
        
        // Touch end - shoot if it was a quick tap, stop dragging
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchDuration = Date.now() - touchStartTime;
            const dragDistance = Math.abs(gameState.touchX - gameState.touchStartX);
            
            // If it was a quick tap (< 200ms) and minimal drag (< 20px), shoot
            if (touchDuration < 200 && dragDistance < 20 && 
                gameState.gameRunning && gameState.player && gameState.player.shootCooldown === 0) {
                gameState.player.shoot();
                gameState.player.shootCooldown = gameState.player.shootCooldownMax;
            }
            
            gameState.isDragging = false;
        });
        
        // Prevent scrolling on mobile
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === canvas) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // Touch drag controls implemented above - no tilt needed
    
    // Intro screen is shown by default
}

// Start game from intro screen
function startGameFromIntro() {
    document.getElementById('introScreen').classList.add('hide');
    
    // Use demo roster data by default
    gameState.rosterData = [
        ['John', '7-15', '7-15', 'OFF', 'RN-Night', 'RN-Night'],
        ['Sarah', 'OFF', '7-15', '7-15', '7-15', 'OFF'],
        ['Mike', 'RN-Day', 'RN-Day', '7-15', 'OFF', 'OFF']
    ];
    startGame();
}

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const aspectRatio = config.width / config.height;
    
    let width = container.clientWidth;
    let height = container.clientHeight;
    
    if (width / height > aspectRatio) {
        width = height * aspectRatio;
    } else {
        height = width / aspectRatio;
    }
    
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

// Start game with roster data
function startWithRoster() {
    const rosterText = document.getElementById('rosterGrid').value;
    if (rosterText.trim()) {
        gameState.rosterData = parseCSV(rosterText);
    }
    document.getElementById('rosterModal').classList.remove('show');
    startGame();
}

// Start with demo data
function startWithDemo() {
    gameState.rosterData = [
        ['John', '7-15', '7-15', 'OFF', 'RN-Night', 'RN-Night'],
        ['Sarah', 'OFF', '7-15', '7-15', '7-15', 'OFF'],
        ['Mike', 'RN-Day', 'RN-Day', '7-15', 'OFF', 'OFF']
    ];
    document.getElementById('rosterModal').classList.remove('show');
    startGame();
}

// Parse CSV
function parseCSV(text) {
    return text.trim().split('\n').map(row => row.split(',').map(cell => cell.trim()));
}

// Start game
function startGame() {
    // Reset game state
    gameState.player = new Player(config.width / 2 - 30, config.height - 140);
    gameState.platforms = [];
    gameState.obstacles = [];
    gameState.powerUps = [];
    gameState.projectiles = [];
    gameState.playerBullets = [];
    gameState.flyingMonsters = [];
    gameState.camera.y = 0;
    gameState.maxHeight = config.height;
    gameState.score = 0;
    gameState.gameRunning = true;
    gameState.doubleJumpActive = false;
    gameState.doubleJumpTimer = 0;
    
    // Generate initial platforms
    for (let i = 0; i < 15; i++) {
        generatePlatform(config.height - i * config.platformGap);
    }
    
    // Add starting platform directly under player (safe green platform)
    gameState.platforms.push(new Platform(config.width / 2 - 30, config.height - 60, 'START', 'normal'));
    
    // Start game loop
    gameLoop();
}

// Generate platform
function generatePlatform(y) {
    const x = Math.random() * (config.width - config.cellSize);
    const label = getRandomLabel();
    
    // Determine platform type based on probability and label
    let platformType = 'normal';
    const rand = Math.random();
    
    if (label.includes('Night') || label.includes('RN-Night')) {
        platformType = 'night'; // Night shift platforms break
    } else if (rand < 0.15 && gameState.score > 30) { // 15% chance of moving platforms after score 30
        platformType = 'moving';
    }
    
    const platform = new Platform(x, y, label, platformType);
    gameState.platforms.push(platform);
    
    // If it's a moving platform with power-up, create the power-up
    if (platform.type === 'moving' && platform.hasPowerUp) {
        const powerUpType = Math.random() < 0.7 ? 'movac' : 'rosterlab';
        const powerUp = new PowerUp(
            platform.x + platform.width/2 - 20,
            y - 45,
            powerUpType
        );
        powerUp.attachedPlatform = platform; // Link power-up to platform
        gameState.powerUps.push(powerUp);
        return; // Don't generate additional power-ups for this platform
    }
    
    const difficulty = getDifficulty();
    
    // Chance to spawn obstacle (based on difficulty)
    if (Math.random() < difficulty.monsterChance && y < config.height - 200) {
        const type = difficulty.monsterTypes[Math.floor(Math.random() * difficulty.monsterTypes.length)];
        const obstacle = new Obstacle(
            Math.random() * (config.width - 60),
            y - 70,
            type
        );
        gameState.obstacles.push(obstacle);
    }
    
    // Chance to spawn power-up (based on difficulty)
    if (Math.random() < difficulty.powerUpChance && y < config.height - 200) {
        const powerUpType = Math.random() < 0.7 ? 'movac' : 'rosterlab'; // 70% movac, 30% rosterlab
        const powerUp = new PowerUp(
            Math.random() * (config.width - 40),
            y - 50,
            powerUpType
        );
        gameState.powerUps.push(powerUp);
    }
}

// Calculate difficulty based on score
function getDifficulty() {
    const score = gameState.score;
    return {
        // Monster spawn chance: starts at 5%, maxes out at 20%
        monsterChance: Math.min(0.05 + (score / 1000) * 0.15, 0.20),
        // Power-up chance: starts at 8%, decreases to 3% (much less power-ups for skill-based gameplay)
        powerUpChance: Math.max(0.08 - (score / 1000) * 0.05, 0.03),
        // Shooting interval: starts at 180 frames (3 sec), decreases to 60 frames (1 sec)
        shootInterval: Math.max(180 - (score / 500) * 120, 60),
        // Monster types: more dangerous types appear as you progress
        monsterTypes: score < 50 ? ['hole'] : 
                     score < 100 ? ['hole', 'fatigue'] :
                     score < 200 ? ['hole', 'fatigue', 'double'] :
                     ['hole', 'fatigue', 'double', 'budget']
    };
}

// Get random label from roster data
function getRandomLabel() {
    if (gameState.rosterData.length === 0) {
        const labels = ['', '', '7-15', 'RN-Day', 'RN-Night', 'OFF', 'Break', '15-23'];
        return labels[Math.floor(Math.random() * labels.length)];
    }
    
    const row = Math.floor(Math.random() * gameState.rosterData.length);
    const col = Math.floor(Math.random() * gameState.rosterData[row].length);
    return gameState.rosterData[row][col] || '';
}

// Game loop
function gameLoop() {
    if (!gameState.gameRunning) return;
    
    // Clear canvas
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, config.width, config.height);
    
    // Draw grid background
    drawGrid();
    
    // Update and draw game objects
    ctx.save();
    ctx.translate(0, -gameState.camera.y);
    
    // Update player
    gameState.player.update();
    
    // Update platforms
    gameState.platforms.forEach(p => p.update());
    
    // Update power-ups (for moving with platforms)
    gameState.powerUps.forEach(p => p.update());
    
    // Update obstacles (for shooting)
    gameState.obstacles.forEach(o => o.update());
    
    // Update projectiles
    gameState.projectiles.forEach(p => p.update());
    gameState.projectiles = gameState.projectiles.filter(p => p.active);
    
    // Update player bullets
    gameState.playerBullets.forEach(b => b.update());
    gameState.playerBullets = gameState.playerBullets.filter(b => b.active);
    
    // Update flying monsters
    gameState.flyingMonsters.forEach(m => m.update());
    gameState.flyingMonsters = gameState.flyingMonsters.filter(m => m.active);
    
    // Spawn flying monsters occasionally (more likely at higher scores)
    const flyingMonsterChance = Math.min(0.005 + (gameState.score / 10000) * 0.01, 0.015); // 0.5% to 1.5%
    if (Math.random() < flyingMonsterChance && gameState.flyingMonsters.length < 3) {
        const monster = new FlyingMonster(
            Math.random() * (config.width - 70),
            gameState.camera.y - 50 // Spawn above the screen
        );
        gameState.flyingMonsters.push(monster);
    }
    
    // Generate new platforms based on max height reached
    let platformsGenerated = 0;
    const maxPlatformsPerFrame = 5;
    
    while (platformsGenerated < maxPlatformsPerFrame && gameState.platforms.length > 0) {
        // More efficient way to find minimum
        let highestPlatform = Infinity;
        for (let platform of gameState.platforms) {
            if (platform.y < highestPlatform) {
                highestPlatform = platform.y;
            }
        }
        
        if (highestPlatform <= gameState.maxHeight - 400) break;
        
        generatePlatform(highestPlatform - config.platformGap);
        platformsGenerated++;
    }
    
    // Remove objects that have fallen below the screen
    gameState.platforms = gameState.platforms.filter(p => p.y < gameState.camera.y + config.height + 100);
    gameState.obstacles = gameState.obstacles.filter(o => o.y < gameState.camera.y + config.height + 100);
    gameState.powerUps = gameState.powerUps.filter(p => p.y < gameState.camera.y + config.height + 100);
    gameState.projectiles = gameState.projectiles.filter(p => p.y < gameState.camera.y + config.height + 100 && p.active);
    gameState.playerBullets = gameState.playerBullets.filter(b => b.active);
    
    // Draw everything
    gameState.platforms.forEach(p => p.draw(ctx));
    gameState.obstacles.forEach(o => o.draw(ctx));
    gameState.powerUps.forEach(p => p.draw(ctx));
    gameState.projectiles.forEach(p => p.draw(ctx));
    gameState.playerBullets.forEach(b => b.draw(ctx));
    gameState.flyingMonsters.forEach(m => m.draw(ctx));
    gameState.player.draw(ctx);
    
    ctx.restore();
    
    // Draw UI
    if (gameState.doubleJumpActive) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Double Jump Active!', config.width / 2 - 60, 50);
    }
    
    // Draw difficulty indicator
    let difficultyText = 'Easy';
    let difficultyColor = '#4CAF50';
    
    if (gameState.score >= 200) {
        difficultyText = 'Extreme';
        difficultyColor = '#FF0000';
    } else if (gameState.score >= 100) {
        difficultyText = 'Hard';
        difficultyColor = '#FF9800';
    } else if (gameState.score >= 50) {
        difficultyText = 'Medium';
        difficultyColor = '#FFC107';
    }
    
    ctx.fillStyle = difficultyColor;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Difficulty: ' + difficultyText, config.width - 10, 20);
    ctx.textAlign = 'left';
    
    // Show controls hint for first 5 seconds
    if (gameState.score < 10) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        
        if (gameState.isMobile) {
            ctx.fillText('Drag to move • Tap to shoot', config.width / 2, config.height - 20);
        } else {
            ctx.fillText('Mouse to move • Click or Space to shoot', config.width / 2, config.height - 20);
        }
        ctx.textAlign = 'left';
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Draw grid background
function drawGrid() {
    const cellWidth = 60;
    const cellHeight = 25;
    const startY = Math.floor(gameState.camera.y / cellHeight) * cellHeight;
    const endY = startY + config.height + cellHeight * 2;
    
    // Excel-like background color
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, config.width, config.height);
    
    // Draw row headers (numbers)
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, 0, 40, config.height);
    
    // Draw column headers area
    const headerY = -gameState.camera.y - 25;
    if (headerY > -25 && headerY < config.height) {
        ctx.fillStyle = '#F0F0F0';
        ctx.fillRect(0, headerY, config.width, 25);
        
        // Column letters
        ctx.fillStyle = '#505050';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const columns = ['', 'A', 'B', 'C', 'D', 'E', 'F'];
        for (let i = 0; i < columns.length; i++) {
            if (columns[i]) {
                ctx.fillText(columns[i], 40 + i * cellWidth + cellWidth/2, headerY + 16);
            }
        }
    }
    
    // Horizontal lines and row numbers
    ctx.strokeStyle = '#D0D0D0';
    ctx.lineWidth = 1;
    for (let y = startY; y < endY; y += cellHeight) {
        const screenY = y - gameState.camera.y;
        
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(config.width, screenY);
        ctx.stroke();
        
        // Row number
        const rowNum = Math.floor(-y / cellHeight) + 50;
        if (rowNum > 0 && screenY > -cellHeight && screenY < config.height + cellHeight) {
            ctx.fillStyle = '#F0F0F0';
            ctx.fillRect(0, screenY, 40, cellHeight);
            
            ctx.fillStyle = '#505050';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(rowNum.toString(), 20, screenY + 17);
        }
    }
    
    // Vertical lines
    ctx.strokeStyle = '#D0D0D0';
    for (let x = 40; x <= config.width; x += cellWidth) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, config.height);
        ctx.stroke();
    }
    
    // Darker border for row header
    ctx.strokeStyle = '#B0B0B0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, config.height);
    ctx.stroke();
    
    // Reset line width
    ctx.lineWidth = 1;
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = `Completed Shifts: ${gameState.score}`;
}

// Game over
function gameOver() {
    gameState.gameRunning = false;
    cancelAnimationFrame(animationId);
    
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.add('show');
    
    playSound('hit');
}

// Restart game
function restartGame() {
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('introScreen').classList.remove('hide');
    gameState.gameRunning = false;
    cancelAnimationFrame(animationId);
}

// Play sound (placeholder)
function playSound(name) {
    // Sound implementation would go here
    // For now, just console log
    console.log(`Playing sound: ${name}`);
}

// Initialize when page loads
window.addEventListener('load', init);

// Make functions available globally
window.startGameFromIntro = startGameFromIntro;
window.startWithRoster = startWithRoster;
window.startWithDemo = startWithDemo;
window.restartGame = restartGame;