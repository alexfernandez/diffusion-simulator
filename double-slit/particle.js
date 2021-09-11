'use strict'

const dt = 0.005
const fontSize = 16
const graphSize = 50
const particlesPerSecond = 20
const slitWidth = 10
const slitDepth = 10
const slitSeparation = 80
const dispersion = Math.PI / 4


window.onload = () => {
	const canvas = document.getElementById('canvas')
	const ctx = canvas.getContext('2d')
	ctx.font = '16px sans-serif'
	ctx.clearRect(0, 0, this.width, this.height)
	const height = canvas.height - fontSize - graphSize - fontSize
	const simulator = new Simulator(canvas.width, height, ctx)
	const grapher = new Grapher(ctx, simulator)
	const controller = new Controller(simulator, grapher)
	controller.reset()
	if (getCheckbox('autorun')) {
		console.log('running')
		controller.run()
	}
	document.getElementById('run').onclick = () => controller.run()
	document.getElementById('pause').onclick = () => controller.pause()
	document.getElementById('reset').onclick = () => controller.reset()
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

class Controller {
	constructor(simulator, grapher) {
		this.simulator = simulator
		this.grapher = grapher
		this.updater = null
		this.logger = null
		this.totalMs = 0
		this.rounds = 0
	}

	reset() {
		this.pause()
		console.log('resetting')
		this.simulator.reset()
		console.log('reset')
	}

	run() {
		if (this.updater) return
		if (getCheckbox('maxspeed')) {
			this.updater = true
			this.updateMaxSpeed()
		} else {
			this.updater = window.setInterval(() => this.update(), dt * 1000)
			this.logger = window.setInterval(() => this.display(), 1000)
		}
	}

	updateMaxSpeed() {
		if (!this.updater) return
		for (let i = 0; i < 100; i++) {
			this.update()
		}
		setTimeout(() => this.updateMaxSpeed(), 0)
	}


	update() {
		const start = Date.now()
		this.simulator.update()
		this.grapher.update()
		const elapsed = Date.now() - start
		this.totalMs += elapsed
		this.rounds += 1
	}

	display() {
		console.log(`Average ms per round: ${Math.round(this.totalMs / this.rounds)}`)
	}

	pause() {
		if (!this.updater) return
		window.clearInterval(this.updater)
		window.clearInterval(this.logger)
		this.updater = null
		this.logger = null
	}
}

class Simulator {
	constructor(width, height, ctx) {
		this.width = width
		this.height = height
		this.cx = Math.round(this.width / 2)
		this.cy = Math.round(this.height / 2)
		this.particles = []
		this.goal = []
		this.barrier = this.createGrid()
		this.ctx = ctx
		this.raw = ctx.getImageData(0, 0, this.width, this.height)
		this.time = 0
		this.speedms = 0
		this.totalPeriods = 0
		this.readY = 0
		this.lastCreated = 0
		this.ac = new window.AudioContext()
	}

	reset() {
		for (let i = 0; i < this.width; i++) {
			this.goal[i] = 0
		}
		this.time = 0
		this.speedms = getParameter('speed')
		this.computeBarrier()
		this.readY = this.height - 1
		console.log(`graphing: ${this.readY}`)
		this.draw()
	}

	update() {
		this.addParticles()
		this.advance()
		this.draw()
	}

	computeBarrier() {
		const firstY = this.height / 5
		const secondY = 4 * this.height / 5
		console.log(`barriers: ${firstY}, ${secondY}`)
		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < slitDepth; j++) {
				const diff = Math.abs(this.cx - i)
				if (diff > slitWidth / 2) {
					this.barrier[i + (firstY + j) * this.width] = 1
				}
				if (diff < slitSeparation / 2 || diff > slitSeparation / 2 + slitWidth) {
					this.barrier[i + (secondY + j) * this.width] = 1
				}
			}
		}
	}

	createGrid() {
		return new Float32Array(this.width * this.height)
	}

	addParticles() {
		if (this.time - this.lastCreated < 1 / particlesPerSecond) {
			return
		}
		const angle = Math.PI * Math.random() / 2 - Math.PI / 4
		const particle = new Particle(this.cx, this.height * 0.18, angle)
		this.particles.push(particle)
		this.lastCreated = this.time
	}

	advance() {
		this.time += dt
		for (let i = 0; i < this.particles.length; i++) {
			const particle = this.particles[i]
			particle.advance()
			const x = particle.getX()
			const y = particle.getY()
			if (x < 0 || x >= this.width || y < 0) {
				// remove
				this.particles.splice(i, 1)
				i -= 1
			} else if (y > this.readY) {
				// add to graph and remove
				this.goal[x] += 1
				this.particles.splice(i, 1)
				this.beep()
				i -= 1
			} else if (this.checkBarrier(particle)) {
				// rebound
				if (!this.rebound(particle)) {
					// no valid rebound
					this.particles.splice(i, 1)
				}
			}
		}
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', this.width / 2 - 50, this.height + fontSize - 3)
		if (!getCheckbox('display')) return
		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < this.height; j++) {
				if (this.barrier[i + j * this.width]) {
					this.setPixel(i, j, 0, 0, 0)
				} else if (j == this.readY) {
					this.setPixel(i, j, 200, 200, 200)
				} else {
					this.setPixel(i, j, 255, 255, 255)
				}
			}
		}
		for (const particle of this.particles) {
			this.setPixel(particle.getX(), particle.getY(), 0, 100, 0)
		}
		this.ctx.putImageData(this.raw, 0, 0);
	}

	rebound(particle) {
		particle.rewind()
		// randomize a bit
		const angle = particle.angle + dispersion * (Math.random() - 0.5)
		particle.setAngle(angle)
		// check reverting horizontal speed
		particle.setAngle(-particle.angle)
		particle.advance()
		if (!this.checkBarrier(particle)) {
			return true
		}
		// now check reverting vertical speed
		particle.rewind()
		particle.setAngle(Math.PI + particle.angle)
		particle.advance()
		if (!this.checkBarrier(particle)) {
			return true
		}
		return false
	}

	checkBarrier(particle) {
		return this.barrier[particle.getX() + particle.getY() * this.width]
	}

	setPixel(i, j, r, g, b) {
		const position = (i + j * this.width) * 4
		this.raw.data[position] = r
		this.raw.data[position + 1] = g
		this.raw.data[position + 2] = b
		this.raw.data[position + 3] = 255
	}

	/**
	 * Adapted from https://codepen.io/noraspice/pen/JpVXVP
	 */
	beep() {
		if (!getCheckbox('sound')) return
		const oscillator = this.ac.createOscillator()
		const gain = this.ac.createGain()
		const now = this.ac.currentTime
		const rampDown = 0.1
		oscillator.connect(gain)
		oscillator.type = 'sine'
		oscillator.frequency.value = 500
		gain.gain.setValueAtTime(0.2, now)
		gain.connect(this.ac.destination)
		oscillator.start(now)
		gain.gain.exponentialRampToValueAtTime(0.00001, now + rampDown)
		oscillator.stop(now + rampDown + .01)
	}
}

class Particle {
	constructor(x, y, angle) {
		this.x = x
		this.y = y
		this.angle = angle
		this.speedx = 0
		this.speedy = 0
		this.setAngle(angle)
	}

	advance() {
		this.x += this.speedx
		this.y += this.speedy
	}

	rewind() {
		this.x -= this.speedx
		this.y -= this.speedy
	}

	setAngle(angle) {
		this.angle = angle
		this.speedx = Math.sin(angle)
		this.speedy = Math.cos(angle)
	}

	getX() {
		return Math.round(this.x)
	}

	getY() {
		return Math.round(this.y)
	}
}

class Grapher {
	constructor(ctx, simulator) {
		this.ctx = ctx
		this.simulator = simulator
		this.width = simulator.width
		this.height = graphSize
		this.starty = simulator.height + fontSize
		this.raw = ctx.getImageData(0, this.starty, this.width, this.starty + this.height)
		this.lastTotal = 0
	}

	update() {
		let absMax = 0
		let total = 0
		for (let i = 0; i < this.width; i++) {
			total += this.simulator.goal[i]
			if (this.simulator.goal[i] > absMax) absMax = this.simulator.goal[i]
		}
		if (this.lastTotal == total) return
		this.lastTotal = total
		this.raw.data.fill(255, 0, this.width * this.height * 4)
		for (let i = 0; i < this.width; i++) {
			const basePos = (i + this.height * this.width) * 4
			this.raw.data[basePos] = 200
			this.raw.data[basePos + 1] = 200
			this.raw.data[basePos + 2] = 200
			this.raw.data[basePos + 3] = 255
			const j = Math.floor(this.height * this.simulator.goal[i] / absMax) || 0
			const position = (i + (this.height - j) * this.width) * 4
			this.raw.data[position] = 127
			this.raw.data[position + 1] = 127
			this.raw.data[position + 2] = 127
			this.raw.data[position + 3] = 255
		}
		this.ctx.putImageData(this.raw, 0, this.starty);
		this.ctx.fillText('max: ' + absMax.toFixed(2), this.width / 3, this.starty + this.height + fontSize - 3)
	}
}

