'use strict'

// drone characterization
const size = 0.075
const radius = size * Math.sqrt(2) / 2
const mass = 0.03

// drone movement
const g = 9.8
const gravity = [0, 0, -g]
const maxThrustPerMotor = 0.015
const minPwm = 128
const maxPwm = 255
const maxSpeed = 5
const separationSpeed = 5
const maxSeparation = 4

const yawMoment = mass * radius * radius / 12
const pitchMoment = 4 * mass * radius * radius / 2
const rollMoment = mass * radius * radius / 4
// factor of motor thrust to drone torque, estimated
const yawFactor = 0.000001


class Drone {
	yaw = new AcceleratedDistance()
	pitch = new AcceleratedDistance()
	roll = new AcceleratedDistance()
	pos = new AcceleratedVector()
	brokenSeparation = 0
	dragComputer = new DragComputer()
	wind = new Wind()
	forces = []
	motorFactors = new Array(4)

	constructor(heightTarget, yawTarget, pitchTarget, rollTarget) {
		this.propulsion = new Propulsion(this, heightTarget, yawTarget, pitchTarget, rollTarget)
		for (let index = 0; index < this.motorFactors.length; index++) {
			this.motorFactors[index] = 1 + (Math.random() - 0.5) * motorImprecisionPercent / 100
		}
		console.log(`motor factors: ${this.motorFactors}`)
	}

	update(dt) {
		if (this.brokenSeparation) {
			return this.computeBroken(dt)
		}
		this.forces = this.computeForces(dt)
		const accel = this.computeAccel()
		this.pos.update(accel, dt)
		const [yawRot, pitchRot, rollRot] = this.computeRotationalAccels()
		this.yaw.update(yawRot, dt)
		this.pitch.update(pitchRot, dt)
		this.roll.update(rollRot, dt)
		const z = this.pos.getValue(2)
		if (z.distance < 0) {
			z.distance = 0
			console.log(`crash: ${z.speed} > ${maxSpeed}?`)
			if (Math.abs(z.speed) > maxSpeed) {
				console.log(`leñaso`)
				this.brokenSeparation = dt
			}
			z.speed = 0
		}
		this.wind.update(dt)
	}

	computeBroken(dt) {
		this.brokenSeparation += separationSpeed * dt
	}

	computeForces(dt) {
		const forces = this.propulsion.computeForces(dt)
		for (let index = 0; index < forces.length; index++) {
			forces[index] *= this.motorFactors[index]
		}
		return forces
	}

	computeAccel() {
		const accel = this.forces.reduce((a, b) => a + b) / mass
		const speed = this.pos.getSpeed()
		const drag = this.dragComputer.computeDrag(speed)
		const inertialAccel = this.convertToInertial([0, 0, accel])
		return sum(
			inertialAccel,
			gravity,
			this.wind.strength,
			drag
		)
	}

	computeRotationalAccels() {
		const yawTorque = yawFactor * (this.forces[0] - this.forces[1] + this.forces[2] - this.forces[3])
		const pitchTorque = radius * (this.forces[0] - this.forces[1] - this.forces[2] + this.forces[3])
		if (pitchTorque) console.log(`pitch torque: ${pitchTorque}`)
		const rollTorque = radius * (this.forces[0] + this.forces[1] - this.forces[2] - this.forces[3])
		const yawWind = (this.wind.strength[0] + this.wind.strength[1]) / 80
		const pitchWind = this.wind.strength[1] / 80
		const rollWind = this.wind.strength[2] / 80
		const yawAccel = yawTorque / yawMoment + yawWind
		const pitchAccel = pitchTorque / pitchMoment + pitchWind
		if (pitchAccel) console.log(`pitch accel: ${pitchAccel * 180 / Math.PI} deg/s2`)
		const rollAccel = rollTorque / rollMoment + rollWind
		if (rollAccel) console.log(`roll accel: ${rollAccel * 180 / Math.PI} deg/s2`)
		const accels = [yawAccel, pitchAccel, rollAccel]
		const drag = this.dragComputer.computeDrag([this.yaw.speed, this.pitch.speed, this.roll.speed])
		return sum(accels, drag)
	}

	draw() {
		const distances = this.pos.getDistances()
		const accel = this.pos.getAccel()
		const segments = this.computeSegments()
		for (let index = 0; index < segments.length; index++) {
			const [start, end] = segments[index]
			screen.line3d(start, end, 'blue')
			const force = this.forces[index]
			if (force) {
				const forceVector = this.convertToInertial([0, 0, force])
				const forceEnd = sum(end, forceVector)
				screen.line3d(end, forceEnd, 'brown')
			}
		}
		const accelEnd = sum(distances, this.convertToInertial(accel))
		screen.line3d(distances, accelEnd, 'red')
		this.wind.draw()
		this.drawGraph()
	}

	drawGraph() {
		const distances = this.pos.getDistances()
		const angles = [this.yaw, this.pitch, this.roll].map(angle => graph.displayDegrees(angle.distance))
		graph.draw([distances[2], ...angles])
	}

	computeSegments() {
		const dist = size / 2
		const coord1 = [-dist, -dist, 0]
		const coord2 = [dist, -dist, 0]
		const coord3 = [dist, dist, 0]
		const coord4 = [-dist, dist, 0]
		const endpoints = [coord1, coord2, coord3, coord4]
		return endpoints.map(endpoint => this.convertEndpoint(endpoint))
	}

	convertEndpoint(endpoint) {
		const inertial = this.convertToInertial(endpoint)
		const distances = this.pos.getDistances()
		const start = sum(distances, scale(inertial, this.brokenSeparation))
		const end = sum(start, inertial)
		return [start, end]
	}

	convertToInertial([x, y, z]) {
		const cy = Math.cos(this.yaw.distance)
		const sy = Math.sin(this.yaw.distance)
		const cp = Math.cos(-this.pitch.distance)
		const sp = Math.sin(-this.pitch.distance)
		const cr = Math.cos(this.roll.distance)
		const sr = Math.sin(this.roll.distance)
		const xp = x * cy*cp + y * (cy*sp*sr - sy*cr) + z * (cy*sp*cr + sy*sr)
		const yp = x * sy*cp + y * (sy*sp*sr - cy*cr) + z * (sy*sp*cr - cy*sr)
		const zp = - x * sp + y * (cp*sr) + z * (cp*cr)
		return [xp, yp, zp]
	}

	isFinished(time) {
		if (this.brokenSeparation > maxSeparation) {
			return true
		}
		return this.propulsion.isFinished(time)
	}
}

class Wind {
	strength = [0, 0, 0]
	maxStrength = [0.1, 0.1, 0.01]
	randomWalk = [0.1, 0.1, 0.02]
	maxPoleLength = 0.5
	pole = new AcceleratedVector([0, 0, -this.maxPoleLength])
	drawingScale = 3

	update(dt) {
		if (!windActive) {
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

class DragComputer {
	cd = 0.4
	density = 1.2
	area = size * size

	computeDrag(speed) {
		const factor = -0.5 * this.density * this.cd * this.area / mass
		return scale(speed, factor)
	}
}

const pidWeightsSpeed = [0.5, 0, 0]
const pidWeightsAccel = [1, 0, 0]

class Propulsion {
	constructor(drone, heightTarget, yawTarget, pitchTarget, rollTarget) {
		this.drone = drone
		this.heightComputer = new DoublePidComputer(heightTarget, pidWeightsSpeed, pidWeightsAccel)
		this.yawComputer = new DoublePidComputer(yawTarget, pidWeightsSpeed, pidWeightsAccel)
		this.pitchComputer = new DoublePidComputer(pitchTarget, pidWeightsSpeed, pidWeightsAccel)
		this.rollComputer = new PidComputer(rollTarget, pidWeightsSpeed)
	}

	computeForces(dt) {
		const pwms = this.computePwms(dt)
		const averagePwm = pwms.reduce((a, b) => a+b) / pwms.length
		if (pwms.some(pwm => pwm != averagePwm)) {
			console.log(pwms)
		}
		return pwms.map(pwm => this.convertPwmToThrust(pwm))
	}

	convertPwmToThrust(pwm) {
		const rescaledPwm = (pwm - minPwm) / (maxPwm - minPwm)
		return rescaledPwm * maxThrustPerMotor * g
	}

	computePwms(dt) {
		const base = (maxPwm + minPwm) / 2
		const accels = this.computeAccels(dt)
		return accels.map(accel => this.computeValidPwm(base + accel * base))
	}

	computeValidPwm(pwm) {
		if (pwm > maxPwm) {
			return maxPwm
		}
		if (pwm < minPwm) {
			return minPwm
		}
		return Math.round(pwm)
	}

	computeAccels(dt) {
		const zValue = this.drone.pos.getValue(2)
		const zAccel = this.heightComputer.computeDoublePid(zValue, dt)
		const yawAccel = this.yawComputer.computeDoublePid(this.drone.yaw, dt)
		//this.yawComputer.display()
		const pitchAccel = this.pitchComputer.computeDoublePid(this.drone.pitch, dt)
		const rollAccel = 0 //this.rollComputer.computePid(this.drone.roll.distance, dt)
		const yawTorque = yawAccel * yawMoment
		const pitchTorque = pitchAccel * pitchMoment
		const rollTorque = rollAccel * rollMoment
		const a1 = zAccel / 4 + (rollTorque + pitchTorque) / (4 * mass * radius) + yawTorque / (4 * yawFactor)
		const a2 = zAccel / 4 + (rollTorque - pitchTorque) / (4 * mass * radius) - yawTorque / (4 * yawFactor)
		const a3 = zAccel / 4 + (-rollTorque - pitchTorque) / (4 * mass * radius) + yawTorque / (4 * yawFactor)
		const a4 = zAccel / 4 + (-rollTorque + pitchTorque) / (4 * mass * radius) - yawTorque / (4 * yawFactor)
		return [a1, a2, a3, a4]
	}

	isFinished(time) {
		return time > 30
	}
}

class DoublePidComputer {
	speedComputer
	accelComputer

	constructor(setPoint, speedWeights, accelWeights) {
		this.speedComputer = new PidComputer(setPoint, speedWeights)
		this.accelComputer = new PidComputer(0, accelWeights)
	}

	computeDoublePid(accelerated, dt) {
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

