const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
const gravity = 0.2
const volume = 0.2
let playSpeed
let bird
let pipes = []
let playing = false
let spawnBorder

var f = new FontFace('FFFFORWA', 'url(FFFFORWA.TTF)');
f.load().then(function (font) { document.fonts.add(font); });

CanvasRenderingContext2D.prototype.drawText = function(text,x,y,fontSize,align,color,shadow){
    this.font =  fontSize + "px " + "FFFFORWA";
    this.fillStyle = "gray";
    this.shadowBlur = (shadow?.blur == undefined ? 0 : shadow?.blur);
    this.shadowColor = (shadow?.color == undefined ? "white": shadow?.color);
    this.textAlign = (align != undefined) ? align : "left";
    this.fillText(text,x,y)
    this.shadowBlur = 0;
    this.fillStyle = (color !== undefined ? color : "black");
    this.fillText(text,x-1,y-1)
}
//

const images = {
    pipeBottom: {
        src: 'imgs/pipeBottom.png'
    },
    pipeTop: {
        src: 'imgs/pipeTop.png'
    },
    bird: {
        src: 'imgs/bird.png'
    },
    background: {
        src: 'imgs/background.png'
    }
}

const sounds = {
    die: {
        src: 'sounds/die.mp3'
    },
    hit: {
        src: 'sounds/hit.mp3'
    },
    flap: {
        src: 'sounds/flap.mp3'
    },
    point: {
        src: 'sounds/point.mp3'
    }
}

async function loadImages(images) {
    let promises = []

    for (let value of Object.values(images)) {
        value.img = new Image()
        value.img.src = value.src

        promises.push(new Promise((resolve, reject) => {
            value.img.onload = () => resolve(value)
            value.img.onerror = (error) => reject(error)            
        }))
    }

    try {
        await Promise.all(promises)
    } catch (error) {
        console.log(`Error loading images: ${error}`)
    }
}

async function loadSounds(sounds) {
    let promises = []
    
    for (let value of Object.values(sounds)) {
        value.sound = new Audio(value.src)
        
        promises.push(new Promise((resolve, reject) => {
            value.sound.oncanplaythrough = () => resolve(value)
            value.sound.onerror = (error) => reject(error)
        }))
    }

    try {
        await Promise.all(promises)
    } catch (error) {
        console.log(`Erorr loading sounds: ${error}`)
    }
}

function playAudio(key, volume = 1) {
    const validVolume = Math.max(0, Math.min(1, volume))
    const audio = sounds[key].sound
    audio.volume = validVolume
    audio.currentTime = 0
    audio.play()
}

function collision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return ((x1 + w1 > x2) && (x1 < x2 + w2) && (y1 + h1 > y2) && (y1 < y2 + h2))
}

function drawRotatedImage(image, x, y, w, h, angle) {
    c.save()
    c.translate(x + w / 2, y + h / 2)
    c.rotate(angle)
    c.drawImage(image, -w / 2, -h / 2, w, h)
    c.restore()
}

class Bird {
    constructor(y) {
        this.w = 50
        this.h = 30
        this.x = canvas.width / 5
        this.y = y
        this.vel = 0
        this.maxSpeed = 8
        this.angle = 0
        this.alive = true
        this.score = 0
    }

    jump() {
        if (!playing || !this.alive) return

        this.vel = -this.maxSpeed
        this.angle = - Math.PI / 4
        playAudio('flap', volume)
    }

    update() {
        if (this.angle < Math.PI / 2) this.angle += 0.02
        this.vel += gravity
        if (this.vel > this.maxSpeed) this.vel = this.maxSpeed
        this.y += this.vel
        if (this.y + this.h > canvas.height) { this.y = canvas.height - this.h; gameOver('ground') } 
    }

    draw() {
        drawRotatedImage(images.bird.img, this.x - this.w / 2, this.y - this.h / 2, 100, 100 * 94 / 133, this.angle)
    }
}

class Pipe {
    constructor(x) {
        this.x = x
        this.w = 125
        this.scored = false

        let extra = 11 / 35 * Math.random()
        this.top = canvas.height * (1 / 5 + extra)
        this.bottom = canvas.height * (18 / 35 - extra)
    }

    draw() {
        c.fillStyle = 'green'
        c.drawImage(images.pipeBottom.img, this.x, canvas.height - this.bottom)
        c.drawImage(images.pipeTop.img, this.x,this.top - images.pipeTop.img.height)
    }
}

function gameOver(surface) {
    if (!bird.alive) return
    playSpeed = 0
    bird.alive = false
    playAudio('hit', volume)
    if (surface instanceof Pipe) setTimeout(() => playAudio('die', volume), 400)
}

function draw() {
    c.drawImage(images.background.img, 0, 0, canvas.width, canvas.height + 10)
    pipes.forEach(pipe => pipe.draw())
    bird.draw()
    c.drawText(bird.score, canvas.width / 2, 60, 40, "center", "black", { color: "white", blur: 5})
}

async function animate() {
    draw()
    bird.update()

    let remove = false
    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i]
        pipe.x -= playSpeed
        if (pipe.x + pipe.w < 0) remove = true
        
        if (!pipe.scored && (bird.x + bird.w / 2 > pipe.x + pipe.w / 2)) {
            bird.score++
            pipe.scored = true
            if (bird.score <= 100) { playSpeed += 0.01; spawnBorder += 7 / 3000 }
            playAudio('point', volume)
        }
        
        if (collision(bird.x, bird.y, bird.w, bird.h, pipe.x, 0, pipe.w, pipe.top) || 
        collision(bird.x, bird.y, bird.w, bird.h, pipe.x, canvas.height - pipe.bottom, pipe.w, pipe.bottom) ||
        collision(bird.x, bird.y, bird.w, bird.h, pipe.x, Number.MIN_SAFE_INTEGER, pipe.w, Number.MAX_SAFE_INTEGER)) gameOver(pipe)

        if (i === pipes.length - 1 && pipe.x + pipe.w < canvas.width * spawnBorder + 100 * Math.random() - 50) pipes.push(new Pipe(canvas.width))
    }
    if (remove) pipes.shift()

    if (bird.alive || bird.y + bird.h < canvas.height) requestAnimationFrame(animate)
    else playing = false
}



async function init() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    playSpeed = 2
    spawnBorder = 2 / 3
    pipes = [new Pipe(canvas.width)]
    bird = new Bird(canvas.height / 2)
    draw()
    return true
}

window.onresize = () => {

}

window.onload = () => {
    Promise.all([loadImages(images), loadSounds(sounds)])
        .then(() => init())
        .catch(error => console.error(error))
}

window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase()
    if (key === ' ' || key === 'w' || key === 'arrowup') {
        if (!playing && !bird.alive) init() 
        else if (!playing) { playing = true; animate() }
        bird.jump()
    }
})