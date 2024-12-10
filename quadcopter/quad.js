'use strict'

// time
const dt = 0.1
let time = 0

// drone characterization
let drone
const size = 0.075
const mass = 0.03

// drone movement
const g = 9.8
let gravity = [0, 0, -g]
const maxThrustPerMotor = 0.015
const minPwm = 128
const maxPwm = 255
const maxSpeed = 5
const separationSpeed = 5
const maxSeparation = 4

// screen
let updater, screen

window.onload = () => {
	screen = new Screen()
	resetSimulation()
	screen.draw()
	if (getCheckbox('autorun')) {
		console.log('running')
		run()
	}
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('reset').onclick = reset
}

function run() {
	drone.yaw = getDegrees('yaw')
	drone.pitch = getDegrees('pitch')
	drone.roll = getDegrees('roll')
	if (updater) return
	updater = window.setInterval(() => {
		update(dt)
		screen.draw()
		if (drone.isFinished()) {
			pause()
		}
	}, dt * 1000)
}

function pause() {
	if (!updater) return
	window.clearInterval(updater)
	updater = null
}

function reset() {
	pause()
	resetSimulation()
	screen.draw()
}

function resetSimulation() {
	console.log('resetting')
	time = 0
	drone = new Drone()
	console.log('reset')
}

function getDegrees(name) {
	return getParameter(name) * Math.PI / 180
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update(dt) {
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

function display([x, y, z]) {
	return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`
}

class Drone {
	pitch = 0.001 //Math.PI/8
	yaw = 0 //Math.PI/8
	roll = 0 //Math.PI/8
	pos = [0, 0, 0]
	speed = [0, 0, 0]
	accel = [0, 0, 0]
	brokenSeparation = 0
	propulsion = new Propulsion()
	dragComputer = new DragComputer()

	update(dt) {
		if (this.brokenSeparation) {
			return this.computeBroken(dt)
		}
		const forces = this.propulsion.computeForces(dt)
		this.accel = this.computeAccel(forces)
		const newSpeed = sum(scale(this.accel, dt), this.speed)
		const newPos = sum(scale(newSpeed, dt), this.pos)
		if (newPos[2] < 0) {
			newPos[2] = 0
			console.log(`crash: ${newSpeed[2]} > ${maxSpeed}?`)
			if (Math.abs(newSpeed[2]) > maxSpeed) {
				console.log(`leñaso`)
				this.brokenSeparation = dt
			}
			newSpeed[2] = 0
		}
		this.pos = newPos
		this.speed = newSpeed
		console.log(`time: ${time.toFixed(1)}`)
		console.log(`speed: ${this.speed}`)
		console.log(`accel: ${this.accel}`)
	}

	computeBroken(dt) {
		this.brokenSeparation += separationSpeed * dt
	}

	computeAccel(forces) {
		const accel = forces.reduce((a, b) => a + b) / mass
		const inertialAccel = this.convertToInertial([0, 0, accel])
		const accelGrav = sum(inertialAccel, gravity)
		const drag = this.dragComputer.compute(this.speed)
		const total = sum(accelGrav, drag)
		return total
	}

	draw() {
		const segments = this.computeSegments()
		for (const [start, end] of segments) {
			screen.line3d(start, end, 'blue')
		}
		const posAccel = sum(this.pos, this.convertToInertial(this.accel))
		screen.line3d(this.pos, posAccel, 'red')
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

	isFinished() {
		if (this.brokenSeparation > maxSeparation) {
			return true
		}
		return this.propulsion.isFinished()
	}
}

class DragComputer {
	cd = 0.4
	density = 1.2
	area = size * size

	compute(speed) {
		const factor = -0.5 * this.density * this.cd * this.area / mass
		return scale(speed, factor)
	}
}

class Propulsion {
	heightComputer = new PidComputer(1, [10, 0, 40])

	computeForces(dt) {
		const pwm = this.computeValidPwm(dt)
		const value = (pwm - minPwm) / (maxPwm - minPwm)
		const thrust = maxThrustPerMotor * g * value
		return [thrust, thrust, thrust, thrust]
	}

	computeValidPwm() {
		const pwm = this.computePwm()
		if (pwm > maxPwm) {
			return maxPwm
		}
		if (pwm < minPwm) {
			return minPwm
		}
		return Math.round(pwm)
	}

	computePwm() {
		const base = (maxPwm + minPwm) / 2
		return base + this.heightComputer.compute(drone.pos[2])
	}

	isFinished() {
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

	compute(processVariable) {
		const error = this.setPoint - processVariable
		const proportional = error
		this.totalError += error
		const integral = this.totalError
		const derivative = error - this.lastError
		this.lastError = error
		return proportional * this.pidWeights[0] + integral * this.pidWeights[1] + derivative * this.pidWeights[2]
	}
}

class Screen {
	width = 0
	height = 0
	ctx = null
	updater = null
	fontSize = 16
	cameraPos = [0, -1, 1]
	cameraScale = 200

	constructor() {
		const canvas = document.getElementById('canvas');
		this.width = canvas.width
		this.height = canvas.height - this.fontSize
		this.ctx = canvas.getContext('2d');
		this.ctx.font = '16px sans-serif'
		this.ctx.clearRect(0, 0, this.width, this.height)
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + this.fontSize)
		this.ctx.clearRect(0, 0, this.width, this.height)
		drone.draw()
		this.drawHorizon()
		this.ctx.fillText(`t = ${time.toFixed(1)} s`, 50, this.height + this.fontSize - 1)
		this.ctx.fillText(`pos = ${display(drone.pos)}`, 200, this.height + this.fontSize - 1)
		this.ctx.fillText(`vel = ${display(drone.speed)}`, 400, this.height + this.fontSize - 1)
		this.ctx.fillText(`acc = ${display(drone.accel)}`, 600, this.height + this.fontSize - 1)
	}

	drawHorizon() {
		const y = 1000
		const max = 10000
		this.line3d([-max, y, 0], [max, y, 0], 'orange')
	}

	line3d(pos1, pos2, color) {
		const point1 = this.convert3d(pos1)
		const point2 = this.convert3d(pos2)
		this.line2d(point1, point2, color)
	}

	convert3d([vx, vy, vz]) {
		const x = this.cameraScale * (vx - this.cameraPos[0]) / (vy - this.cameraPos[1])
		const y = - this.cameraScale * (vz - this.cameraPos[2]) / (vy - this.cameraPos[1])
		return {x, y}
	}

	line2d(point1, point2, color) {
		this.ctx.strokeStyle = color
		this.ctx.beginPath()
		this.ctx.moveTo(this.width / 2 + point1.x, this.height / 2 + point1.y)
		this.ctx.lineTo(this.width / 2 + point2.x, this.height / 2 + point2.y)
		this.ctx.stroke()
	}
}

