'use strict'

const dt = 0.005
const fontSize = 16
const graphSize = 50
const particlesPerSecond = 20
const slitWidth = 10
const slitDepth = 10
const slitSeparation = 80


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
	}

	reset() {
		this.pause()
		console.log('resetting')
		this.simulator.reset()
		console.log('reset')
	}

	run() {
		if (this.updater) return
		let total = 0
		let rounds = 0
		this.updater = window.setInterval(() => {
			const start = Date.now()
			this.simulator.update()
			this.grapher.update()
			const elapsed = Date.now() - start
			total += elapsed
			rounds += 1
		}, dt * 1000)
		this.logger = window.setInterval(() => {
			console.log(`Average ms per round: ${Math.round(total / rounds)}`)
		}, 1000)
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
		const secondY = 3 * this.height / 5
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
		const particle = new Particle(this.cx, this.height / 10, Math.random() - 0.5, 1)
		this.particles.push(particle)
		this.lastCreated = this.time
	}

	advance() {
		this.time += dt
		for (const particle of this.particles) {
			particle.advance()
		}
	}

	draw() {
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
		for (let i = 0; i < this.particles.length; i++) {
			const particle = this.particles[i]
			if (particle.x < 0 || particle.x >= this.width) {
				this.particles.splice(i, 1)
				i -= 1
			} else if (particle.y > this.readY) {
				this.goal[particle.getX()] += 1
				this.particles.splice(i, 1)
				i -= 1
			} else {
				this.setPixel(particle.getX(), particle.getY())
			}

		}
		this.ctx.putImageData(this.raw, 0, 0);
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', this.width / 3, this.height + fontSize - 1)
	}

	setPixel(i, j, r, g, b) {
		const position = (i + j * this.width) * 4
		this.raw.data[position] = r
		this.raw.data[position + 1] = g
		this.raw.data[position + 2] = b
		this.raw.data[position + 3] = 255
	}
}

class Particle {
	constructor(x, y, speedx, speedy) {
		this.x = x
		this.y = y
		this.speedx = speedx
		this.speedy = speedy
	}

	advance() {
		this.x += this.speedx
		this.y += this.speedy
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
	}

	update() {
		this.raw.data.fill(255, 0, this.width * this.height * 4)
		/*
		for (let pos = 0; pos < this.width * this.height * 4; pos++) {
			this.raw.data[pos] = 255
		}
		*/
		let absMax = 0
		for (let i = 0; i < this.width; i++) {
			if (this.simulator.goal[i] > absMax) absMax = this.simulator.goal[i]
		}
		for (let i = 0; i < this.width; i++) {
			const basePos = (i + (this.height - 1) * this.width) * 4
			this.raw.data[basePos] = 200
			this.raw.data[basePos + 1] = 200
			this.raw.data[basePos + 2] = 200
			this.raw.data[basePos + 3] = 255
			const j = Math.floor(this.height * Math.abs(this.simulator.goal[i]) / absMax) || 0
			const position = (i + (this.height - j - 1) * this.width) * 4
			this.raw.data[position] = 127
			this.raw.data[position + 1] = 127
			this.raw.data[position + 2] = 127
			this.raw.data[position + 3] = 255
		}
		this.ctx.putImageData(this.raw, 0, this.starty);
		this.ctx.fillText('max: ' + absMax.toFixed(2), this.width / 3, this.starty + this.height + fontSize - 1)
	}
}

