'use strict'

// time
const dt = 0.1
let time = 0
const maxIntegralError = 4000

// drone movement
const maxAccel = 10

// graph maxxes
const maxPos = 1
const maxSpeed = 0.1
const maxTime = 80

export function run(drone, screen) {
	time = 0
	while (time < screen.maxTime) {
		update(drone, dt)
		screen.draw(drone, time)
	}
}

export function runUntilZero(drone) {
	time = 0
	while (Math.abs(drone.pos) > maxPos || Math.abs(drone.speed) > maxSpeed) {
		update(drone, dt)
		if (time > maxTime) {
			return maxTime
		}
	}
	return time
}

function update(drone, dt) {
	const newTime = time + dt
	drone.update(dt)
	time = newTime
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

export class Drone {
	algorithm = 'none'
	pos = 40
	speed = 30
	accel = 0
	speedComputer = new PidComputer(0, [0, 0, 0])
	accelComputer = new PidComputer(0, [0, 0, 0])
	delay = 0
	delayedPos = new AccumulatedValue(this.pos)
	delayedSpeed = new AccumulatedValue(this.speed)

	update(dt) {
		const newAccel = this.computeAccel(dt)
		const newSpeed = this.speed + dt * newAccel
		const newPos = this.pos + dt * newSpeed
		const total = 1 + this.delay / dt
		this.delayedPos.add(newPos, total)
		this.delayedSpeed.add(newSpeed, total)
		this.pos = newPos
		this.speed = newSpeed
		this.accel = newAccel
	}

	computeAccel(dt) {
		const accel = this.computeAlgorithm(dt)
		return limitMax(accel, maxAccel)
	}

	computeAlgorithm(dt) {
		if (this.algorithm == 'pos-pid') {
			return this.computePosPid(dt)
		} else if (this.algorithm == 'speed-pid') {
			return this.computeSpeedPid(dt)
		} else if (this.algorithm == 'double-pid') {
			return this.computeDoublePid(dt)
		}
		return 0
	}

	computePosPid(dt) {
		const pos = this.delayedPos.getDelayed()
		return this.speedComputer.computePid(pos, dt)
	}

	computeSpeedPid(dt) {
		const speed = this.delayedSpeed.getDelayed()
		return this.accelComputer.computePid(speed, dt)
	}

	computeDoublePid(dt) {
		const pos = this.delayedPos.getDelayed()
		const speed = this.delayedSpeed.getDelayed()
		const targetSpeed = this.speedComputer.computePid(pos, dt)
		this.accelComputer.setPoint = targetSpeed
		const targetAccel = this.accelComputer.computePid(speed, dt)
		return targetAccel
	}

	convertEndpoint(endpoint) {
		const inertial = this.convertToInertial(endpoint)
		const start = sum(this.pos, scale(inertial, this.brokenSeparation))
		const end = sum(start, inertial)
		return [start, end]
	}

	convertToInertial([x, y, z]) {
		const cy = Math.cos(this.yaw)
		const sy = Math.sin(this.yaw)
		const cp = Math.cos(-this.pitch)
		const sp = Math.sin(-this.pitch)
		const cr = Math.cos(this.roll)
		const sr = Math.sin(this.roll)
		const xp = x * cy*cp + y * (cy*sp*sr - sy*cr) + z * (cy*sp*cr + sy*sr)
		const yp = x * sy*cp + y * (sy*sp*sr - cy*cr) + z * (sy*sp*cr - cy*sr)
		const zp = - x * sp + y * (cp*sr) + z * (cp*cr)
		return [xp, yp, zp]
	}
}

/**
 * Stores a number of values. Can be used for delayed values or integral values.
 */
class AccumulatedValue {
	values = []

	constructor(value) {
		this.values.push(value)
	}

	add(value, total) {
		this.values.push(value)
		if (this.values.length > total) {
			this.values.shift()
		}
	}

	getDelayed() {
		return this.values[0]
	}

	getSum() {
		return this.values.reduce((a, b) => a + b)
	}
}

const totalIntegralValues = 10

class PidComputer {
	weights = [0, 0, 0]
	lastError = 0
	setPoint = 0
	integralError = new AccumulatedValue(0)

	constructor(setPoint, weights) {
		this.setPoint = setPoint
		this.weights = weights
	}

	computePid(processVariable, dt) {
		const error = this.setPoint - processVariable
		const proportional = error
		const integrated = error * dt
		this.integralError.add(integrated, totalIntegralValues)
		const integral = limitMax(this.integralError.getSum(), maxIntegralError)
		const derivative = (error - this.lastError) / dt
		this.lastError = error
		return proportional * this.weights[0] + integral * this.weights[1] + derivative * this.weights[2]
	}
}

function limitMax(value, maxValue) {
	if (value > maxValue) {
		return maxValue
	}
	if (value < -maxValue) {
		return -maxValue
	}
	return value
}


