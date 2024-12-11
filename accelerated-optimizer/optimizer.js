'use strict'

// time
const dt = 0.1
let time = 0
const timeScale = 10

// drone characterization
let drone
const size = 0.075
const mass = 0.03

// drone movement
const maxAccel = 10
const smoothScale = 5
const pidWeights = [0, 0, 0]

// screen
let updater, screen

window.onload = () => {
	screen = new Screen()
	resetSimulation()
	screen.clear()
	console.log('running')
	document.getElementById('pvalue').oninput = resetSimulation
	document.getElementById('ivalue').oninput = resetSimulation
	document.getElementById('dvalue').oninput = resetSimulation
	run()
}

function run() {
	drone.delay = getParameter('delay')
	drone.algorithm = getRadioButton('algorithm')
	pidWeights[0] = getParameter('pvalue')
	pidWeights[1] = getParameter('ivalue')
	pidWeights[2] = getParameter('dvalue')
	console.log(`pid weights: ${pidWeights}`)
	if (updater) return
	while (time * timeScale < screen.width) {
		update(dt)
		screen.draw()
	}
}

function resetSimulation() {
	console.log('resetting')
	screen.clear()
	time = 0
	drone = new Drone()
	console.log('reset')
	run()
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getRadioButton(name) {
	return document.querySelector(`input[name="${name}"]:checked`).value
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

class Drone {
	accel = 0
	speed = 3
	pos = 40
	target = 0
	dragComputer = new DragComputer()
	delay = 0
	lastError = 0
	lastDiff = 0
	errorSum = 0
	errorInterval = 0
	algorithm = 'none'

	update(dt) {
		this.accel = this.computeAccel(dt)
		const newSpeed = this.speed + dt * this.accel
		const newPos = this.pos + dt * newSpeed
		this.pos = newPos
		this.speed = newSpeed
	}

	computeAccel(dt) {
		const accel = this.computeByAlgorithm(dt)
		if (accel > maxAccel) {
			return maxAccel
		}
		if (accel < -maxAccel) {
			return -maxAccel
		}
		return accel
	}

	computeByAlgorithm(dt) {
		if (this.algorithm == 'naive') {
			return this.computeNaive()
		} else if (this.algorithm == 'smooth') {
			return this.computeSmooth()
		} else if (this.algorithm == 'pi') {
			return this.computePid(dt, piWeights)
		} else if (this.algorithm == 'pd') {
			return this.computePid(dt, pdWeights)
		} else if (this.algorithm == 'pid') {
			return this.computePid(dt)
		}
		return 0
	}

	computeNaive() {
		if (this.pos > this.target) {
			return -maxAccel
		}
		if (this.pos < this.target) {
			return maxAccel
		}
		return 0
	}

	computeSmooth() {
		const diff = this.target - this.pos
		return diff / smoothScale
	}

	computePid(dt, weights = pidWeights) {
		const error = this.target - this.pos
		const proportional = error
		this.errorSum += error
		this.errorInterval += dt
		const integral = this.errorSum / this.errorInterval / 10
		const derivative = (error - this.lastError) / dt
		this.lastError = error
		return proportional * weights[0] + integral * weights[1] + derivative * weights[2]
	}

	draw() {
		const x = timeScale * time
		screen.plot2d([x, screen.axis - this.accel - 1], 'red')
		screen.plot2d([x, screen.first + screen.axis - this.speed - 1], 'green')
		screen.plot2d([x, screen.second + screen.axis - this.pos - 1], 'blue')
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

class Screen {
	width = 0
	height = 0
	ctx = null
	updater = null
	fontSize = 16
	first = 0
	second = 0
	third = 0

	constructor() {
		const canvas = document.getElementById('canvas')
		this.width = canvas.width
		this.height = canvas.height
		this.first = this.height / 3
		this.second = 2 * this.height / 3
		this.third = this.height
		this.axis = this.height / 6
		this.ctx = canvas.getContext('2d');
		this.ctx.font = '16px sans-serif'
		this.ctx.clearRect(0, 0, this.width, this.height)
	}

	clear() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.line2d([0, this.axis], [this.width, this.axis], 'red')
		this.line2d([0, this.first], [this.width, this.first], 'black')
		this.line2d([0, this.first + this.axis], [this.width, this.first + this.axis], 'green')
		this.line2d([0, this.second], [this.width, this.second], 'black')
		this.line2d([0, this.second + this.axis], [this.width, this.second + this.axis], 'blue')
	}

	draw() {
		this.ctx.clearRect(0, 0, this.width, this.fontSize)
		this.ctx.fillText(`accel = ${drone.accel.toFixed(1)}`, 50, this.fontSize - 1)
		this.ctx.clearRect(0, this.first, this.width, this.fontSize)
		this.ctx.fillText(`speed = ${drone.speed.toFixed(1)}`, 50, this.first + this.fontSize - 1)
		this.ctx.clearRect(0, this.second, this.width, this.fontSize)
		this.ctx.fillText(`pos = ${drone.pos.toFixed(1)}`, 50, this.second + this.fontSize - 1)
		drone.draw()
	}

	plot2d([x, y], color) {
		return this.line2d([x, y], [x+1, y+1], color)
	}

	line2d([x1, y1], [x2, y2], color) {
		this.ctx.strokeStyle = color
		this.ctx.beginPath()
		this.ctx.moveTo(x1, y1)
		this.ctx.lineTo(x2, y2)
		this.ctx.stroke()
	}
}

