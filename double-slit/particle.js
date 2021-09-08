'use strict'

const sizem = 50
const periodSeconds = 1
const dt = 0.02
const fontSize = 16
const graphSize = 50
const amplitude = 10
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
		if (!this.simulator.isValid()) {
			return
		}
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
		this.grid = this.createGrid()
		this.barrier = this.createGrid()
		this.propagation = 0
		this.ctx = ctx
		this.raw = ctx.getImageData(0, 0, this.width, this.height)
		this.time = 0
		this.speedms = 0
		this.totalPeriods = 0
		this.readY = 0
	}

	reset() {
		this.fillGrid(this.grid0, 0)
		this.fillGrid(this.grid1, 0)
		this.fillGrid(this.grid2, 0)
		this.time = 0
		this.speedms = getParameter('speed')
		this.propagation = this.computePropagation()
		console.log('propagation ', this.propagation)
		this.computeBarrier()
		this.readY = this.height - 1
		console.log(`graphing: ${this.readY}`)
		this.draw()
	}

	isValid() {
		if (this.propagation > 0.5) {
			alert(`Propagation ${this.propagation} too big > 0.5, aborting`)
			return false
		}
		return true
	}

	update() {
		this.advance()
		this.draw()
		this.replace()
	}

	computePropagation() {
		const dx = sizem / this.width
		const interval = dt * this.speedms / dx
		return interval * interval
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

	fillGrid(grid, value) {
		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < this.height; j++) {
				grid[i + j * this.width] = value
			}
		}
	}

	advance() {
		this.time += dt
		for (let i = 1; i < this.width - 1; i++) {
			for (let j = 1; j < this.height - 1; j++) {
				this.grid2[i + j * this.width] = this.computeNext(i, j)
			}
		}
		this.wrapup()
		if (!this.totalPeriods || this.time < periodSeconds * this.totalPeriods) {
			const j = this.height / 10
			this.grid2[this.cx + j * this.width] = amplitude * Math.sin(2 * Math.PI * this.time / periodSeconds)
		}
	}

	computeNext(i, j) {
		const index = i + j * this.width
		if (this.barrier[index]) {
			return 0
		}
		const previous = this.grid1[index]
		const neighbors = this.grid1[index + 1] + this.grid1[index - 1] + this.grid1[index + this.width] + this.grid1[index - this.width]
		const influence = this.propagation * (neighbors - 4 * previous)
		return previous + influence
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
		for (let i = 0; i < this.screenWidth; i++) {
			for (let j = 0; j < this.height; j++) {
				this.setPixel(i, j)
			}
		}
		this.ctx.putImageData(this.raw, 0, 0);
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', this.screenWidth / 3, this.height + fontSize - 1)
		//console.log(this.grid2[this.cx + 1 + this.cy * this.width])
	}

	replace() {
		const recycled = this.grid0
		this.grid0 = this.grid1
		this.grid1 = this.grid2
		this.grid2 = recycled
	}

	setPixel(i, j) {
		const index = i + j * this.width
		const value = this.grid2[index]
		const position = (i + j * this.width) * 4
		if (this.barrier[index]) {
			this.raw.data[position] = 0
			this.raw.data[position + 1] = 0
			this.raw.data[position + 2] = 0
		} else if (value > 1) {
			this.raw.data[position] = 255 * (1 / value)
			this.raw.data[position + 1] = 0
			this.raw.data[position + 2] = 0
		} else if (value >= 0) {
			this.raw.data[position] = 255
			this.raw.data[position + 1] = 255 * (1 - value)
			this.raw.data[position + 2] = 255 * (1 - value)
		} else if (value < -1) {
			this.raw.data[position] = 0
			this.raw.data[position + 1] = 255 * (-1 / value)
			this.raw.data[position + 2] = 0
		} else {
			this.raw.data[position] = 255 * (1 + value)
			this.raw.data[position + 1] = 255
			this.raw.data[position + 2] = 255 * (1 + value)
		}
		if (j == this.readY) {
			this.raw.data[position] = Math.min(this.raw.data[position], 200)
			this.raw.data[position + 1] = Math.min(this.raw.data[position + 1], 200)
			this.raw.data[position + 2] = Math.min(this.raw.data[position + 2], 200)
		}
		this.raw.data[position + 3] = 255
	}
}

class Grapher {
	constructor(ctx, simulator) {
		this.ctx = ctx
		this.simulator = simulator
		this.width = simulator.screenWidth
		this.height = graphSize
		this.starty = simulator.height + fontSize
		this.raw = ctx.getImageData(0, this.starty, this.width, this.starty + this.height)
		this.data = []
		for (let i = 0; i < this.width; i++) {
			this.data[i] = 0
		}
	}

	update() {
		for (let pos = 0; pos < this.width * this.height * 4; pos++) {
			this.raw.data[pos] = 255
		}
		let absMax = 0
		for (let i = 0; i < this.width; i++) {
			const index = i + this.simulator.readY * this.simulator.width
			const value = this.simulator.grid2[index]
			this.data[i] += value * value
			if (this.data[i] > absMax) absMax = this.data[i]
		}
		for (let i = 0; i < this.width; i++) {
			const basePos = (i + (this.height - 1) * this.width) * 4
			this.raw.data[basePos] = 200
			this.raw.data[basePos + 1] = 200
			this.raw.data[basePos + 2] = 200
			this.raw.data[basePos + 3] = 255
			const j = Math.floor(this.height * Math.abs(this.data[i]) / absMax) || 0
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

