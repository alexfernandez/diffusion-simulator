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


class Drone {
	yaw = new AcceleratedDistance()
	pitch = new AcceleratedDistance()
	roll = new AcceleratedDistance()
	pos = new AcceleratedVector()
	brokenSeparation = 0
	dragComputer = new DragComputer()
	wind = new Wind()
	forces = []

	constructor(heightTarget, yawTarget, pitchTarget, rollTarget) {
		this.propulsion = new Propulsion(this, heightTarget, yawTarget, pitchTarget, rollTarget)
	}

	update(dt) {
		if (this.brokenSeparation) {
			return this.computeBroken(dt)
		}
		this.forces = this.propulsion.computeForces(dt)
		console.log(`forces: ${this.forces}`)
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
		console.log(`speed: ${this.pos.getSpeed()}`)
		console.log(`accel: ${this.pos.getAccel()}`)
		this.wind.update(dt)
	}

	computeBroken(dt) {
		this.brokenSeparation += separationSpeed * dt
	}

	computeAccel() {
		const accel = this.forces.reduce((a, b) => a + b) / mass
		const inertialAccel = this.convertToInertial([0, 0, accel])
		const accelGrav = sum(inertialAccel, gravity)
		const speed = this.pos.getSpeed()
		const drag = this.dragComputer.computeDrag(speed)
		const totalAccel = sum(accelGrav, drag)
		return totalAccel
	}

	computeRotationalAccels() {
		const yawTorque = radius * (this.forces[0] - this.forces[1] + this.forces[2] - this.forces[3])
		const pitchTorque = radius * (this.forces[0] - this.forces[1] - this.forces[2] + this.forces[3])
		const rollTorque = radius * (this.forces[0] + this.forces[1] - this.forces[2] - this.forces[3])
		const yawMoment = mass * radius * radius / 12
		const pitchMoment = mass * radius * radius / 2
		const rollMoment = mass * radius * radius / 2
		return [yawTorque / yawMoment, pitchTorque / pitchMoment, rollTorque / rollMoment]
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
	maxStrength = [0.5, 0.5, 0.1]
	randomWalk = [0.001, 0.001, 0.0001]
	pole = new AcceleratedVector()
	maxPoleLength = 0.5

	update(dt) {
		for (let index = 0; index < this.strength.length; index++) {
			this.strength[index] = this.strength[index] + this.randomWalk[index] * Math.random() * dt
			if (this.strength[index] > this.maxStrength[index]) {
				this.strength[index] = this.maxStrength[index]
			} else if (this.strength[index] < -this.maxStrength[index]) {
				this.strength[index] = -this.maxStrength[index]
			}
		}
		this.pole.update(sum(this.strength, gravity), dt)
		const distances = this.pole.getDistances()
		const length = Math.sqrt(distances[0] * distances[0] + distances[1] * distances[1] + distances[2] * distances[2])
		if (length > this.maxPoleLength) {
			const ratio = this.maxPoleLength / length
			for (let index = 0; index < this.strength.length; index++) {
				const value = this.pole.getValue(index)
				value.distance /= ratio
				value.speed = 0
			}
		}
	}


	draw() {
		const start = [-1.5, 0, 2]
		const end = sum(start, this.pole.getDistances())
		screen.line3d(start, end, 'green')
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

class Propulsion {
	constructor(drone, heightTarget, yawTarget, pitchTarget, rollTarget) {
		this.drone = drone
		this.heightComputer = new PidComputer(heightTarget, [1, 0, 4])
		this.yawComputer = new PidComputer(yawTarget, [0.0001, 0, 0.0004])
		this.pitchComputer = new PidComputer(pitchTarget, [0.0001, 0, 0.0004])
		this.rollComputer = new PidComputer(rollTarget, [0.0001, 0, 0.0004])
	}

	computeForces(dt) {
		const pwms = this.computePwms(dt)
		const thrusts = pwms.map(pwm => (pwm - minPwm) / (maxPwm - minPwm) * maxThrustPerMotor * g)
		return thrusts
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
		const distances = this.drone.pos.getDistances()
		const zAccel = this.heightComputer.computePid(distances[2], dt)
		const yawTorque = this.yawComputer.computePid(this.drone.yaw.distance, dt)
		const pitchTorque = this.pitchComputer.computePid(this.drone.pitch.distance, dt)
		const rollTorque = this.rollComputer.computePid(this.drone.roll.distance, dt)
		const a1 = zAccel / 4 + (rollTorque + pitchTorque + yawTorque) / (4 * mass * radius)
		const a2 = zAccel / 4 + (rollTorque - pitchTorque - yawTorque) / (4 * mass * radius)
		const a3 = zAccel / 4 + (-rollTorque - pitchTorque + yawTorque) / (4 * mass * radius)
		const a4 = zAccel / 4 + (-rollTorque + pitchTorque - yawTorque) / (4 * mass * radius)
		return [a1, a2, a3, a4]
	}

	isFinished(time) {
		return time > 30
	}
}

class PidComputer {
	pidWeights = [0, 0, 0]
	totalError = 0
	lastError = 0
	setPoint = 0

	constructor(setPoint, weights) {
		this.setPoint = setPoint
		this.pidWeights = weights
	}

	computePid(processVariable, dt) {
		const error = this.setPoint - processVariable
		const proportional = error
		this.totalError += error
		const integral = this.totalError
		const derivative = error - this.lastError
		this.lastError = error
		return dt * (proportional * this.pidWeights[0] + integral * this.pidWeights[1] + derivative * this.pidWeights[2])
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

function sum([x1, y1, z1], [x2, y2, z2]) {
	if (x1 === undefined) {
		throw Error(`Bad vector1 for sum: ${x1}`)
	}
	if (x2 === undefined) {
		throw Error(`Bad vector2 for sum: ${x2}`)
	}
	return [x1 + x2, y1 + y2, z1 + z2]
}

function scale([x, y, z], factor) {
	return [factor * x, factor * y, factor * z]
}

