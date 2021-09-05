'use strict'

const sizem = 50
const period = 10
const dt = 0.05
const fontSize = 16
const dampingCoefficient = 0.99
const offscreenBuffer = 100
const slit = 20


window.onload = () => {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	ctx.font = '16px sans-serif'
	ctx.clearRect(0, 0, this.width, this.height)
	const simulator = new Simulator(canvas.width, canvas.height - fontSize, ctx)
	simulator.reset()
	simulator.draw()
	if (getCheckbox('autorun')) {
		console.log('running')
		simulator.run()
	}
	document.getElementById('run').onclick = () => simulator.run()
	document.getElementById('pause').onclick = () => simulator.pause()
	document.getElementById('reset').onclick = () => simulator.reset()
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

class Simulator {

	constructor(width, height, ctx) {
		this.screenWidth = width
		this.screenHeight = height
		this.width = this.screenWidth + 2 * offscreenBuffer
		this.height = this.screenHeight + 2 * offscreenBuffer
		this.cx = Math.round(this.width / 2)
		this.cy = Math.round(this.height / 2)
		this.grid0 = this.createGrid()
		this.grid1 = this.createGrid()
		this.grid2 = this.createGrid()
		this.damping = this.createGrid()
		this.barrier = this.createGrid()
		this.propagation = 0
		this.updater = null
		this.logger = null
		this.ctx = ctx
		this.raw = ctx.getImageData(0, 0, this.width, this.height);
		this.time = 0
		this.speedms = 0
	}

	reset() {
		this.pause()
		console.log('resetting')
		this.time = 0
		this.speedms = getParameter('speed')
		this.propagation = this.computePropagation()
		console.log('propagation ', this.propagation)
		console.log('reset')
		this.computeDampingField()
		this.computeBarrier()
		this.draw()
	}

	run() {
		if (this.propagation > 0.5) {
			alert(`Propagation ${this.propagation} too big > 0.5, aborting`)
			return
		}
		if (this.updater) return
		let total = 0
		let rounds = 0
		this.updater = window.setInterval(() => {
			const start = Date.now()
			this.advance()
			this.draw()
			this.replace()
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

	computePropagation() {
		const dx = sizem / this.width
		const interval = dt * this.speedms / dx
		return interval * interval
	}

	computeDampingField() {
		let transparency = 1
		for (let s = 0; s < offscreenBuffer; s++) {
			const d = offscreenBuffer - s
			transparency *= dampingCoefficient
			for (let j = d; j < this.height - d; j++) {
				this.damping[d + j * this.width] = 1 - transparency
				this.damping[this.width - d + j * this.width] = 1 - transparency
			}
			for (let i = d; i < this.width - d; i++) {
				this.damping[i + d * this.width] = 1 - transparency
				this.damping[i + (this.height - d) * this.width] = 1 - transparency
			}
		}
	}

	computeBarrier() {
		const firstY = offscreenBuffer + 2 * this.screenHeight / 5
		const secondY = offscreenBuffer + 4 * this.screenHeight / 5
		console.log(`barriers: ${firstY}, ${secondY}`)
		for (let i = 0; i < this.width; i++) {
			const diff = Math.abs(this.cx - i)
			if (diff > slit) {
				this.barrier[i + firstY * this.width] = 1
			}
			if (diff < slit || diff > 2 * slit) {
				this.barrier[i + secondY * this.width] = 1
			}
		}
	}

	createGrid() {
		return new Float32Array(this.width * this.height)
	}

	advance() {
		this.time += dt
		for (let i = 1; i < this.width - 1; i++) {
			for (let j = 1; j < this.height - 1; j++) {
				this.grid2[i + j * this.width] = this.computeNext(i, j)
			}
		}
		this.wrapup()
		const j = offscreenBuffer + this.screenHeight / 5
		this.grid2[this.cx + j * this.width] = 4 * Math.sin(2 * Math.PI * this.time / period)
	}

	computeNext(i, j) {
		const index = i + j * this.width
		if (this.barrier[index]) {
			return 0
		}
		const previous = this.grid1[index]
		const damping = this.damping[index]
		const damped = (1 - damping * dt) * (previous - this.grid0[index])
		const neighbors = this.grid1[index + 1] + this.grid1[index - 1] + this.grid1[index + this.width] + this.grid1[index - this.width]
		const influence = this.propagation * (neighbors - 4 * previous)
		return previous + damped + influence
	}

	wrapup() {
		for (let i = 0; i < this.width; i++) {
			this.grid2[i] = 0
			this.grid2[i + (this.height - 1) * this.width] = 0
		}
		for (let j = 0; j < this.height; j++) {
			this.grid2[j * this.width] = 0
			this.grid2[this.width - 1 + j * this.width] = 0
		}
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		for (let i = 0; i < this.screenWidth; i++) {
			for (let j = 0; j < this.screenHeight; j++) {
				this.setPixel(i, j)
			}
		}
		this.ctx.putImageData(this.raw, 0, 0);
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', 100, this.screenHeight + fontSize - 1)
		//console.log(this.grid2[this.cx + 1 + this.cy * this.width])
	}

	replace() {
		const recycled = this.grid0
		this.grid0 = this.grid1
		this.grid1 = this.grid2
		this.grid2 = recycled
	}

	setPixel(i, j) {
		const index = i + offscreenBuffer + (j + offscreenBuffer) * this.width
		const value = this.grid2[index]
		const position = (i + j * this.width) * 4
		if (this.barrier[index] || value > 1 || value < -1) {
			this.raw.data[position] = 0
			this.raw.data[position + 1] = 0
			this.raw.data[position + 2] = 0
		}
		else if (value >= 0) {
			this.raw.data[position] = 255
			this.raw.data[position + 1] = (1 - value) * 255
			this.raw.data[position + 2] = (1 - value) * 255
		} else {
			this.raw.data[position] = (1 + value) * 255
			this.raw.data[position + 1] = 255
			this.raw.data[position + 2] = (1 + value) * 255
		}
		this.raw.data[position + 3] = 255
	}
}

