'use strict'

// time
const dt = 0.1
let time = 0
const timeScale = 10

// drone characterization
let drone

// drone movement
const maxAccel = 10

// screen
let screen

window.onload = () => {
	screen = new Screen()
	resetSimulation()
	screen.clear()
	document.getElementById('run').onclick = resetSimulation
	document.getElementById('p1value').oninput = resetSimulation
	document.getElementById('i1value').oninput = resetSimulation
	document.getElementById('d1value').oninput = resetSimulation
	document.getElementById('p2value').oninput = resetSimulation
	document.getElementById('i2value').oninput = resetSimulation
	document.getElementById('d2value').oninput = resetSimulation
	console.log('running')
	run()
}

function run() {
	drone.algorithm = getRadioButton('algorithm')
	const p1value = getParameter('p1value')
	const i1value = getParameter('i1value')
	const d1value = getParameter('d1value')
	drone.posComputer.weights = [p1value, i1value, d1value]
	const p2value = getParameter('p2value')
	const i2value = getParameter('i2value')
	const d2value = getParameter('d2value')
	drone.speedComputer.weights = [p2value, i2value, d2value]
	console.log(`pids weights: ${drone.posComputer.weights}, ${drone.speedComputer.weights}`)
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
	speed = 30
	pos = 40
	algorithm = 'none'
	posComputer = new PidComputer(0, [0, 0, 0])
	speedComputer = new PidComputer(0, [0, 0, 0])

	update(dt) {
		const newAccel = this.computeAccel(dt)
		const newSpeed = this.speed + dt * newAccel
		const newPos = this.pos + dt * newSpeed
		this.pos = newPos
		this.speed = newSpeed
		this.accel = newAccel
	}

	computeAccel(dt) {
		const accel = this.computeAlgorithm(dt)
		const limitedMax = this.limitMax(accel)
		return limitedMax
	}

	limitMax(accel) {
		if (accel > maxAccel) {
			return maxAccel
		}
		if (accel < -maxAccel) {
			return -maxAccel
		}
		return accel
	}

	computeAlgorithm(dt) {
		if (this.algorithm == 'pid') {
			return this.computePid(dt)
		} else if (this.algorithm == 'double-pid') {
			return this.computeDoublePid(dt)
		}
		return 0
	}

	computePid(dt) {
		return this.posComputer.computePid(this.pos, dt)
	}

	computeDoublePid(dt) {
		const targetSpeed = this.posComputer.computePid(this.pos, dt)
		this.speedComputer.setPoint = targetSpeed
		const targetAccel = this.speedComputer.computePid(this.speed, dt)
		console.log(`target speed: ${targetSpeed}, target accel: ${targetAccel}`)
		return targetAccel
	}

	draw() {
		const x = timeScale * time
		screen.plot2d([x, screen.axis - this.accel - 1], 'red')
		screen.plot2d([x, screen.first + screen.axis - this.speed - 1], 'green')
		screen.plot2d([x, screen.second + screen.axis - this.pos - 1], 'blue')
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

class PidComputer {
	weights = [0, 0, 0]
	totalError = 0
	totalInterval = 0
	lastError = 0
	setPoint = 0

	constructor(setPoint, weights) {
		this.setPoint = setPoint
		this.weights = weights
	}

	computePid(processVariable, dt) {
		const error = this.setPoint - processVariable
		const proportional = error
		this.totalError += error
		this.totalInterval += dt
		const integral = this.totalError * dt
		const derivative = (error - this.lastError) / dt
		this.lastError = error
		return proportional * this.weights[0] + integral * this.weights[1] + derivative * this.weights[2]
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



