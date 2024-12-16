'use strict'

/* global AcceleratedDistance, AcceleratedVector, DragComputer, Wind, sum, scale, DoublePidComputer, graph */

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
const rollMoment = mass * radius * radius / 2
// factor of motor thrust to drone torque, estimated
const yawFactor = 0.000001


// eslint-disable-next-line no-unused-vars
class Drone {
	yaw = new AcceleratedDistance()
	pitch = new AcceleratedDistance()
	roll = new AcceleratedDistance()
	pos = new AcceleratedVector()
	brokenSeparation = 0
	dragComputer = new DragComputer(size, mass)
	wind = new Wind()
	forces = []
	motorFactors = new Array(4)
	currentTarget = 0

	constructor() {
		this.targets = parameters.getTargets()
		this.propulsion = new Propulsion(this, this.targets[this.currentTarget])
		for (let index = 0; index < this.motorFactors.length; index++) {
			this.motorFactors[index] = 1 + (Math.random() - 0.5) * parameters.motorImprecisionPercent / 100
		}
		console.log('motor factors', this.motorFactors)
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
		this.checkCrash(dt)
		this.wind.update(dt)
		this.updatePropulsion()
	}

	checkCrash(dt) {
		const z = this.pos.getValue(2)
		if (z.distance >= 0) {
			return
		}
		console.log(`crash: ${z.speed} > ${maxSpeed}?`)
		z.distance = 0
		if (Math.abs(z.speed) > maxSpeed) {
			console.log(`leñaso`)
			this.brokenSeparation = dt
		}
		z.speed = 0
	}

	updatePropulsion() {
		if (!this.propulsion.isFinished()) {
			return
		}
		console.log('updating propulsion')
		this.currentTarget += 1
		this.propulsion = new Propulsion(this, this.targets[this.currentTarget])
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
		const rollTorque = radius * (this.forces[0] + this.forces[1] - this.forces[2] - this.forces[3])
		const yawWind = (this.wind.strength[0] + this.wind.strength[1]) / 80
		const pitchWind = this.wind.strength[1] / 80
		const rollWind = this.wind.strength[2] / 80
		const yawAccel = yawTorque / yawMoment + yawWind
		const pitchAccel = pitchTorque / pitchMoment + pitchWind
		const rollAccel = rollTorque / rollMoment + rollWind
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
		return time > 30
	}
}

class Propulsion {
	startMs = Date.now()

	constructor(drone, target) {
		this.drone = drone
		this.target = target
		this.heightComputer = new DoublePidComputer(target.heightTarget, 0.1)
		this.yawComputer = new DoublePidComputer(target.yawTarget, 1)
		this.pitchComputer = new DoublePidComputer(target.pitchTarget, 1)
		this.rollComputer = new DoublePidComputer(target.rollTarget, 1)
		this.timeTargetSeconds = target.timeTargetSeconds
	}

	computeForces(dt) {
		const pwms = this.computePwms(dt)
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
		const rollAccel = this.rollComputer.computeDoublePid(this.drone.roll, dt)
		const yawTorque = yawAccel * yawMoment
		const pitchTorque = pitchAccel * pitchMoment
		const rollTorque = rollAccel * rollMoment
		const a1 = zAccel / 4 + (rollTorque + pitchTorque) / (4 * mass * radius) + yawTorque / (4 * yawFactor)
		const a2 = zAccel / 4 + (rollTorque - pitchTorque) / (4 * mass * radius) - yawTorque / (4 * yawFactor)
		const a3 = zAccel / 4 + (-rollTorque - pitchTorque) / (4 * mass * radius) + yawTorque / (4 * yawFactor)
		const a4 = zAccel / 4 + (-rollTorque + pitchTorque) / (4 * mass * radius) - yawTorque / (4 * yawFactor)
		return [a1, a2, a3, a4]
	}

	isFinished() {
		if (this.timeTargetSeconds) {
			const elapsedSeconds = (Date.now() - this.startMs) / 1000
			return elapsedSeconds > this.timeTargetSeconds
		}
		if (!this.heightComputer.isFinished()) return false
		if (!this.yawComputer.isFinished()) return false
		if (!this.pitchComputer.isFinished()) return false
		if (!this.rollComputer.isFinished()) return false
		return true
	}
}

// eslint-disable-next-line no-unused-vars
class Parameters {
	heightTarget = 1
	yawTarget = 0
	pitchTarget = 10
	rollTarget = 0
	windActive = false
	motorImprecisionPercent = 0
	pidWeightsSpeed = [0.5, 0, 0]
	pidWeightsAccel = [1, 0, 0]

	getTargets() {
		return [
			new Target(this.heightTarget, 0, 0, 0),
			new Target(this.heightTarget, 0, -this.pitchTarget, 0),
			new Target(this.heightTarget, 0, 0, 0),
			new Target(this.heightTarget, this.yawTarget, 0, 0),
			new Target(this.heightTarget, this.yawTarget, -this.pitchTarget, 0),
			new Target(this.heightTarget, this.yawTarget, 0, 0),
			new Target(this.heightTarget, 0, 0, 0, 30),
		]
	}
}

class Target {
	heightTarget = 1
	yawTarget = 0
	pitchTarget = 0
	rollTarget = 0
	timeTargetSeconds = 0

	constructor(heightTarget, yawTarget, pitchTarget, rollTarget, timeTargetSeconds = 0) {
		this.heightTarget = heightTarget
		this.yawTarget = yawTarget
		this.pitchTarget = pitchTarget
		this.rollTarget = rollTarget
		this.timeTargetSeconds = timeTargetSeconds
	}
}

const parameters = new Parameters()

