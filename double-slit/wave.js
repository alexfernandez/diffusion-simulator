'use strict'


class WaveParameters {
	constructor() {
		this.sizem = 50
		this.periodSeconds = 1
		this.dt = 0.02
		this.offscreenDamping = 0.99
		this.offscreenBuffer = 200
		this.amplitude = 10
		this.maxSpeedRuns = 10
	}
}

startups.push(() => {
	const canvas = document.getElementById('wave-canvas')
	const ctx = canvas.getContext('2d')
	ctx.font = '16px sans-serif'
	const height = canvas.height - fontSize - graphSize - fontSize
	const parameters = new WaveParameters()
	const simulator = new WaveSimulator(canvas.width, height, ctx, parameters)
	const grapher = new WaveGrapher(ctx, simulator, parameters)
	const controller = new Controller(simulator, grapher, parameters)
	controller.reset()
	if (getCheckbox('wave-autorun')) {
		console.log('running')
		controller.run()
	}
	document.getElementById('wave-run').onclick = () => controller.run()
	document.getElementById('wave-pause').onclick = () => controller.pause()
	document.getElementById('wave-reset').onclick = () => controller.reset()
})

class WaveSimulator {
	constructor(width, height, ctx, parameters) {
		this.screenWidth = width
		this.screenHeight = height
		this.parameters = parameters
		this.width = this.screenWidth + 2 * this.parameters.offscreenBuffer
		this.height = this.screenHeight + 2 * this.parameters.offscreenBuffer
		this.cx = Math.round(this.width / 2)
		this.cy = Math.round(this.height / 2)
		this.grid0 = this.createGrid()
		this.grid1 = this.createGrid()
		this.grid2 = this.createGrid()
		this.damping = this.createGrid()
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
		this.fillGrid(this.barrier, 0)
		this.time = 0
		this.speedms = getParameter('wave-speed')
		this.initialDamping = getParameter('wave-damping')
		this.totalPeriods = getParameter('wave-periods')
		this.propagation = this.computePropagation()
		console.log('propagation ', this.propagation)
		this.computeDampingField()
		this.computeBarrier()
		this.readY = this.parameters.offscreenBuffer + this.screenHeight - 1
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
		const dx = this.parameters.sizem / this.width
		const interval = this.parameters.dt * this.speedms / dx
		return interval * interval
	}

	computeDampingField() {
		this.fillGrid(this.damping, this.initialDamping)
		let transparency = 1
		for (let s = 0; s < this.parameters.offscreenBuffer; s++) {
			const d = this.parameters.offscreenBuffer - s
			transparency *= this.parameters.offscreenDamping
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
		const firstY = this.parameters.offscreenBuffer + this.screenHeight / 5
		const secondY = this.parameters.offscreenBuffer + 3 * this.screenHeight / 5
		console.log(`barriers: ${firstY}, ${secondY}`)
		for (let i = 0; i < this.width; i++) {
			const diff = Math.abs(this.cx - i)
			if (diff > slitWidth / 2) {
				this.barrier[i + firstY * this.width] = 1
			}
			if (this.isSecondBarrier(i)) {
				this.barrier[i + secondY * this.width] = 1
			}
		}
	}

	isSecondBarrier(x) {
		const diff = Math.abs(this.cx - x)
		if (diff < slitSeparation / 2) return true
		if (diff > slitSeparation / 2 + slitWidth) return true
		if (x < this.cx && getCheckbox('wave-close1')) return true
		if (x > this.cx && getCheckbox('wave-close2')) return true
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
				this.grid2[i + j * this.width] = this.computeNext(i, j)
			}
		}
		if (!this.totalPeriods || this.time < this.parameters.periodSeconds * this.totalPeriods) {
			const j = this.parameters.offscreenBuffer + this.screenHeight / 10
			this.grid2[this.cx + j * this.width] = this.parameters.amplitude * Math.sin(2 * Math.PI * this.time / this.parameters.periodSeconds)
		}
	}

	computeNext(i, j) {
		const index = i + j * this.width
		if (this.barrier[index]) {
			return 0
		}
		const previous = this.grid1[index]
		const damping = this.damping[index]
		const damped = (1 - damping * this.parameters.dt) * (previous - this.grid0[index])
		const neighbors = this.grid1[index + 1] + this.grid1[index - 1] + this.grid1[index + this.width] + this.grid1[index - this.width]
		const influence = this.propagation * (neighbors - 4 * previous)
		return previous + damped + influence
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
		//console.log(this.grid2[this.cx + 1 + this.cy * this.width])
	}

	replace() {
		const recycled = this.grid0
		this.grid0 = this.grid1
		this.grid1 = this.grid2
		this.grid2 = recycled
	}

	setPixel(i, j) {
		const index = i + this.parameters.offscreenBuffer + (j + this.parameters.offscreenBuffer) * this.width
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
		if (j == this.readY - this.parameters.offscreenBuffer) {
			this.raw.data[position] = Math.min(this.raw.data[position], 200)
			this.raw.data[position + 1] = Math.min(this.raw.data[position + 1], 200)
			this.raw.data[position + 2] = Math.min(this.raw.data[position + 2], 200)
		}
		this.raw.data[position + 3] = 255
	}
}

class WaveGrapher {
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

