'use strict'

const sizem = 50
const period = 10
const dt = 0.05
const fontSize = 16



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
		this.width = width
		this.height = height
		this.cx = Math.round(width / 2)
		this.cy = Math.round(height / 2)
		this.grid0 = this.createGrid()
		this.grid1 = this.createGrid()
		this.grid2 = this.createGrid()
		this.propagation = 0
		this.updater = null
		this.logger = null
		this.ctx = ctx
		this.raw = ctx.getImageData(0, 0, this.width, this.height);
		this.time = 0
		this.speedms = 0
		this.damping = 0
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

	reset() {
		this.pause()
		console.log('resetting')
		this.time = 0
		this.speedms = getParameter('speed')
		this.damping = getParameter('damping')
		this.propagation = this.computePropagation()
		console.log('propagation ', this.propagation)
		console.log('reset')
		this.draw()
	}

	computePropagation() {
		const dx = sizem / this.width
		const interval = dt * this.speedms / dx
		return interval * interval
	}

	createGrid() {
		const grid = []
		for (let i = -1; i <= this.width; i++) {
			grid[i] = []
			for (let j = -1; j <= this.height; j++) {
				grid[i][j] = 0
			}
		}
		return grid
	}

	advance() {
		this.time += dt
		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < this.height; j++) {
				this.grid2[i][j] = this.computeNext(i, j)
			}
		}
		this.wrapup()
		if (this.time < period) {
			this.grid2[this.cx][this.cy] = Math.sin(2 * Math.PI * this.time / period)
		}
	}

	computeNext(i, j) {
		const previous = this.grid1[i][j]
		const damped = (1 - this.damping * dt) * (previous - this.grid0[i][j])
		const neighbors = this.grid1[i + 1][j] + this.grid1[i - 1][j] + this.grid1[i][j + 1] + this.grid1[i][j - 1]
		const influence = this.propagation * (neighbors - 4 * previous)
		return previous + damped + influence
	}

	computeDamping(i, j) {
		const lowratio = 0.25
		const highratio = 0.30
		const distancex = Math.abs(this.cx - i) / this.width
		const distancey = Math.abs(this.cy - j) / this.height
		if (distancex > highratio || distancey > highratio) {
			return 1
		}
		if (distancex < lowratio && distancey < lowratio) {
			return this.damping
		}
		const distance = Math.max(distancex, distancey)
		return (distance - lowratio) / (highratio - lowratio)
	}

	wrapup() {
		this.wrapupZero()
	}

	wrapupZero() {
		for (let i = -1; i <= this.width; i++) {
			this.grid2[i][-1] = 0
			this.grid2[i][this.height] = 0
		}
		for (let j = -1; j <= this.height; j++) {
			this.grid2[-1][j] = 0
			this.grid2[this.width][j] = 0
			this.grid2[this.width - 1][j]
		}
	}

	wrapupEqual() {
		for (let i = 0; i <= this.width - 1; i++) {
			this.grid2[i][-1] = this.grid2[i][0]
			this.grid2[i][this.height] = this.grid2[i][this.height - 1]
		}
		for (let j = 0; j <= this.height - 1; j++) {
			this.grid2[-1][j] = this.grid2[0][j]
			this.grid2[this.width][j] = this.grid2[this.width - 1][j]
		}
		this.grid2[-1][-1] = this.grid2[0][0]
		this.grid2[-1][this.height] = this.grid2[0][this.height - 1]
		this.grid2[this.width][-1] = this.grid2[this.width - 1][0]
		this.grid2[this.width][this.height] = this.grid2[this.width - 1][this.height - 1]
	}

	wrapupSecond() {
		for (let i = 0; i <= this.width - 1; i++) {
			this.grid2[i][-1] = 2 * this.grid2[i][0] - this.grid2[i][1]
			this.grid2[i][this.height] = 2 * this.grid2[i][this.height - 1] - this.grid2[i][this.height - 2]
		}
		for (let j = 0; j <= this.height - 1; j++) {
			this.grid2[-1][j] = 2 * this.grid2[0][j] - this.grid2[1][j]
			this.grid2[this.width][j] = 2 * this.grid2[this.width - 1][j] - this.grid2[this.width - 2][j]
		}
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < this.height; j++) {
				this.setPixel(i, j, this.grid2[i][j])
			}
		}
		this.ctx.putImageData(this.raw, 0, 0);
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', 100, this.height + fontSize - 1)
		//console.log(this.grid2[this.cx + 1][this.cy])
	}

	replace() {
		const recycled = this.grid0
		this.grid0 = this.grid1
		this.grid1 = this.grid2
		this.grid2 = recycled
	}

	setPixel(x, y, value) {
		const index = (x + y * this.width) * 4
		if (value > 1 || value < -1) {
			this.raw.data[index] = 0
			this.raw.data[index + 1] = 0
			this.raw.data[index + 2] = 0
		}
		else if (value >= 0) {
			this.raw.data[index] = 255
			this.raw.data[index + 1] = (1 - value) * 255
			this.raw.data[index + 2] = (1 - value) * 255
		} else {
			this.raw.data[index] = (1 + value) * 255
			this.raw.data[index + 1] = 255
			this.raw.data[index + 2] = (1 + value) * 255
		}
		this.raw.data[index + 3] = 255
	}
}

