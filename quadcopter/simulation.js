'use strict'

/* global gravity, parameters */


// eslint-disable-next-line no-unused-vars
class Wind {
	strength = [0, 0, 0]
	maxStrength = [0.1, 0.1, 0.01]
	randomWalk = [0.1, 0.1, 0.02]
	maxPoleLength = 0.5
	pole = new AcceleratedVector([0, 0, -this.maxPoleLength])
	drawingScale = 3

	update(dt) {
		if (!parameters.windActive) {
			return
		}
		for (let index = 0; index < this.strength.length; index++) {
			this.strength[index] = this.strength[index] + this.randomWalk[index] * (Math.random() - 0.5) * dt
			if (this.strength[index] > this.maxStrength[index]) {
				this.strength[index] = this.maxStrength[index]
			} else if (this.strength[index] < -this.maxStrength[index]) {
				this.strength[index] = -this.maxStrength[index]
			}
		}
		this.pole.update(sum(scale(this.strength, this.drawingScale), gravity), dt)
		const distances = this.pole.getDistances()
		const length = Math.sqrt(distances[0] * distances[0] + distances[1] * distances[1] + distances[2] * distances[2])
		if (length > this.maxPoleLength) {
			const ratio = length / this.maxPoleLength
			for (let index = 0; index < this.strength.length; index++) {
				const value = this.pole.getValue(index)
				value.distance /= ratio
				value.speed = 0
			}
		}
	}


	draw() {
		const start = [-1.1, 0, 1]
		const pole = [-1.1, 0, 1.8]
		screen.line3d(start, pole, 'green')
		const end = sum(pole, this.pole.getDistances())
		screen.line3d(pole, end, 'green')
	}
}

// eslint-disable-next-line no-unused-vars
class DragComputer {
	cd = 0.4
	density = 1.2

	constructor(size, mass) {
		this.area = size * size
		this.mass = mass
	}

	computeDrag(speed) {
		const factor = -0.5 * this.density * this.cd * this.area / this.mass
		return scale(speed, factor)
	}
}

// eslint-disable-next-line no-unused-vars
class DoublePidComputer {
	speedComputer
	accelComputer
	margin = 0

	constructor(setPoint, margin) {
		this.speedComputer = new PidComputer(setPoint, parameters.pidWeightsSpeed)
		this.accelComputer = new PidComputer(0, parameters.pidWeightsAccel)
		this.margin = margin
	}

	computeDoublePid(accelerated, dt) {
		this.lastValue = accelerated
		const targetSpeed = this.speedComputer.computePid(accelerated.distance, dt)
		this.accelComputer.setPoint = targetSpeed
		const accel = this.accelComputer.computePid(accelerated.speed, dt)
		return accel
	}

	display() {
		console.log(`Display double computer:`)
		this.speedComputer.display()
		this.accelComputer.display()
	}

	isFinished() {
		return this.speedComputer.isWithinMargin(this.margin)
	}
}

class PidComputer {
	weights = [0, 0, 0]
	totalError = 0
	lastError = 0
	setPoint = 0
	lastVariable
	lastComputed = 0

	constructor(setPoint, weights) {
		this.setPoint = setPoint
		this.weights = weights
	}

	computePid(processVariable, dt) {
		this.lastVariable = processVariable
		const error = this.setPoint - processVariable
		const proportional = error
		this.totalError += error
		const integral = this.totalError * dt
		const derivative = (error - this.lastError) / dt
		this.lastError = error
		const computed = proportional * this.weights[0] + integral * this.weights[1] + derivative * this.weights[2]
		this.lastComputed = computed
		return computed
	}

	isWithinMargin(margin) {
		return (Math.abs(this.lastError) < margin)
	}

	display() {
		console.log(`variable: ${this.lastVariable} -> ${this.setPoint}, computed: ${this.lastComputed}`)
	}
}

class AcceleratedDistance {
	distance = 0
	speed = 0
	accel = 0

	constructor(initial = 0) {
		this.distance = initial
	}

	update(accel, dt) {
		this.accel = accel
		const newSpeed = this.speed + this.accel * dt
		const newDistance = this.distance + newSpeed * dt
		this.distance = newDistance
		this.speed = newSpeed
	}
}

class AcceleratedVector {
	acceleratedValues = [new AcceleratedDistance(), new AcceleratedDistance(), new AcceleratedDistance()]

	constructor(distances) {
		if (!distances) {
			return
		}
		for (let index = 0; index < distances.length; index++) {
			this.acceleratedValues[index].distance = distances[index]
		}
	}

	update(accelVector, dt) {
		for (let index = 0; index < this.acceleratedValues.length; index++) {
			const value = this.acceleratedValues[index]
			const accel = accelVector[index]
			value.update(accel, dt)
		}
	}

	getDistances() {
		return this.acceleratedValues.map(accelerated => accelerated.distance)
	}

	getSpeed() {
		return this.acceleratedValues.map(accelerated => accelerated.speed)
	}

	getAccel() {
		return this.acceleratedValues.map(accelerated => accelerated.accel)
	}

	getValue(index) {
		return this.acceleratedValues[index]
	}
}

function sum(...args) {
	const addition = [0, 0, 0]
	for (const arg of args) {
		if (arg[0] === undefined) {
			throw Error(`Bad vector for sum: ${arg}`)
		}
		for (let index = 0; index < addition.length; index++) {
			addition[index] += arg[index]
		}
	}
	return addition
}

function scale([x, y, z], factor) {
	return [factor * x, factor * y, factor * z]
}

