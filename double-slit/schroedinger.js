'use strict'


class SchroedingerParameters {
	constructor() {
		this.dx = 1
		this.dt = 0.02
		this.offscreenDamping = 0.99
		this.offscreenBuffer = 200
		this.maxSpeedRuns = 10
	}
}

startups.push(() => {
	const canvas = document.getElementById('schroedinger-canvas')
	const ctx = canvas.getContext('2d')
	ctx.font = '16px sans-serif'
	const height = canvas.height - fontSize - graphSize - fontSize
	const parameters = new SchroedingerParameters()
	const simulator = new SchroedingerSimulator(canvas.width, height, ctx, parameters)
	const grapher = new SchroedingerGrapher(ctx, simulator, parameters)
	const controller = new Controller(simulator, grapher, parameters)
	controller.reset()
	if (getCheckbox('schroedinger-autorun')) {
		console.log('running')
		controller.run()
	}
	document.getElementById('schroedinger-run').onclick = () => controller.run()
	document.getElementById('schroedinger-pause').onclick = () => controller.pause()
	document.getElementById('schroedinger-reset').onclick = () => controller.reset()
})

class SchroedingerSimulator {
	constructor(width, height, ctx, parameters) {
		this.screenWidth = width
		this.screenHeight = height
		this.parameters = parameters
		this.width = this.screenWidth + 2 * this.parameters.offscreenBuffer
		this.height = this.screenHeight + 2 * this.parameters.offscreenBuffer
		this.cx = Math.round(this.width / 2)
		this.cy = Math.round(this.height / 2)
		this.r0 = this.createGrid()
		this.r1 = this.createGrid()
		this.i05 = this.createGrid()
		this.i15 = this.createGrid()
		this.potential = this.createGrid()
		this.propagation = 0
		this.ctx = ctx
		this.raw = ctx.getImageData(0, 0, this.width, this.height)
		this.time = 0
		this.mass = 0
		this.totalEnergy = 0
		this.readY = 0
	}

	reset() {
		this.fillGrid(this.r0, 0)
		this.fillGrid(this.r1, 0)
		this.fillGrid(this.i05, 0)
		this.fillGrid(this.i15, 0)
		this.fillGrid(this.potential, 0)
		this.time = 0
		this.mass = getParameter('schroedinger-mass')
		this.totalEnergy = getParameter('schroedinger-energy')
		this.computeInitialField()
		this.computePotential()
		this.readY = this.parameters.offscreenBuffer + this.screenHeight - 1
		console.log(`graphing: ${this.readY}`)
		this.draw()
	}

	isValid() {
		return true
	}

	update() {
		this.advance()
		this.draw()
		this.replace()
	}

	computeInitialField() {
		const j = this.parameters.offscreenBuffer + this.screenHeight / 10
		const index = this.cx + j * this.width
		this.r0[index] = this.totalEnergy
		this.i05[index + this.width] = this.totalEnergy
	}

	computePotential() {
		const firstY = this.parameters.offscreenBuffer + this.screenHeight / 5
		const secondY = this.parameters.offscreenBuffer + 3 * this.screenHeight / 5
		console.log(`barriers: ${firstY}, ${secondY}`)
		for (let i = 0; i < this.width; i++) {
			const diff = Math.abs(this.cx - i)
			if (diff > slitWidth / 2) {
				this.potential[i + firstY * this.width] = 1
			}
			if (this.isSecondBarrier(i)) {
				this.potential[i + secondY * this.width] = 1
			}
		}
		let transparency = 1
		for (let s = 0; s < this.parameters.offscreenBuffer; s++) {
			const d = this.parameters.offscreenBuffer - s
			transparency *= this.parameters.offscreenDamping
			for (let j = d; j < this.height - d; j++) {
				this.potential[d + j * this.width] = 1 - transparency
				this.potential[this.width - d + j * this.width] = 1 - transparency
			}
			for (let i = d; i < this.width - d; i++) {
				this.potential[i + d * this.width] = 1 - transparency
				this.potential[i + (this.height - d) * this.width] = 1 - transparency
			}
		}
	}

	isSecondBarrier(x) {
		const diff = Math.abs(this.cx - x)
		if (diff < slitSeparation / 2) return true
		if (diff > slitSeparation / 2 + slitWidth) return true
		if (x < this.cx && getCheckbox('schroedinger-close1')) return true
		if (x > this.cx && getCheckbox('schroedinger-close2')) return true
		return false
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
		this.time += this.parameters.dt
		for (let i = 1; i < this.width - 1; i++) {
			for (let j = 1; j < this.height - 1; j++) {
				const index = i + j * this.width
				this.r1[index] = this.computeNextR(index)
				this.i15[index] = this.computeNextI(index)
			}
		}
	}

	computeNextR(index) {
		const previous = this.i05[index]
		const neighbors = this.i05[index + 1] + this.i05[index - 1] + this.i05[index + this.width] + this.i05[index - this.width]
		const constant = -1 / (2 * this.mass) / (this.parameters.dx * this.parameters.dx)
		const hi = constant * (neighbors - 4 * previous) + this.potential[index] * previous
		return this.r0[index] + this.parameters.dt * hi
	}

	computeNextI(index) {
		const previous = this.r1[index]
		const neighbors = this.r1[index + 1] + this.r1[index - 1] + this.r1[index + this.width] + this.r1[index - this.width]
		const constant = -1 / (2 * this.mass) / (this.parameters.dx * this.parameters.dx)
		const hr = constant * (neighbors - 4 * previous) + this.potential[index] * previous
		return this.i05[index] - this.parameters.dt * hr
	}

	draw() {
		for (let i = 0; i < this.screenWidth; i++) {
			for (let j = 0; j < this.screenHeight; j++) {
				this.setPixel(i, j)
			}
		}
		this.ctx.putImageData(this.raw, 0, 0);
		this.ctx.clearRect(0, this.height, this.width, this.height + fontSize)
		this.ctx.fillText('t = ' + this.time.toFixed(1) + ' s', this.screenWidth / 3, this.screenHeight + fontSize - 1)
	}

	replace() {
		const recycledR = this.r0
		this.r0 = this.r1
		this.r1 = recycledR
		const recycledI = this.i05
		this.i05 = this.i15
		this.i15 = recycledI
	}

	setPixel(i, j) {
		const index = i + this.parameters.offscreenBuffer + (j + this.parameters.offscreenBuffer) * this.width
		const value = this.getProb(index)
		const position = (i + j * this.width) * 4
		if (this.potential[index]) {
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
		if (j == this.readY - this.parameters.offscreenBuffer) {
			this.raw.data[position] = Math.min(this.raw.data[position], 200)
			this.raw.data[position + 1] = Math.min(this.raw.data[position + 1], 200)
			this.raw.data[position + 2] = Math.min(this.raw.data[position + 2], 200)
		}
		this.raw.data[position + 3] = 255
	}

	getProb(index) {
		return this.r1[index] * this.r1[index] + this.i05[index] * this.i15[index]
	}
}

class SchroedingerGrapher {
	constructor(ctx, simulator, parameters) {
		this.ctx = ctx
		this.simulator = simulator
		this.parameters = parameters
		this.width = simulator.screenWidth
		this.height = graphSize
		this.starty = simulator.screenHeight + fontSize
		this.raw = ctx.getImageData(0, this.starty, this.width, this.starty + this.height)
		this.data = []
		this.reset()
	}

	reset() {
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
			const index = i + this.parameters.offscreenBuffer + this.simulator.readY * this.simulator.width
			const value = this.simulator.getProb(index)
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

