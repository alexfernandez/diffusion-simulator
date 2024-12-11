'use strict'

// time
const dt = 0.1
let time = 0

// drone characterization
let drone
const heightTarget = 1
let yawTarget, pitchTarget, rollTarget

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
	readParameters()
	if (updater) return
	updater = window.setInterval(() => {
		update(dt)
		screen.draw()
		if (drone.isFinished(time)) {
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
	readParameters()
	time = 0
	drone = new Drone(heightTarget, yawTarget, pitchTarget, rollTarget)
	console.log('reset')
}

function readParameters() {
	yawTarget = getDegrees('yaw')
	pitchTarget = getDegrees('pitch')
	rollTarget = getDegrees('roll')
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
	console.log(`time: ${newTime.toFixed(1)}`)
	drone.update(dt)
	time = newTime
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
		this.ctx.fillText(`pos = ${this.displayVector(drone.pos.getDistances())}`, 200, this.height + this.fontSize - 1)
		this.ctx.fillText(`vel = ${this.displayVector(drone.pos.getSpeed())}`, 400, this.height + this.fontSize - 1)
		this.ctx.fillText(`acc = ${this.displayVector(drone.pos.getAccel())}`, 600, this.height + this.fontSize - 1)
		this.ctx.fillText(`yaw: ${this.displayDegrees(drone.yaw.distance)}`, this.fontSize, this.fontSize)
		this.ctx.fillText(`pitch: ${this.displayDegrees(drone.pitch.distance)}`, this.fontSize, 2 * this.fontSize)
		this.ctx.fillText(`roll: ${this.displayDegrees(drone.roll.distance)}`, this.fontSize, 3 * this.fontSize)
	}

	drawHorizon() {
		const y = 1000
		const max = 10000
		this.line3d([-max, y, 0], [max, y, 0], 'orange')
	}

	line3d(pos1, pos2, color) {
		if (pos1[1] < this.cameraPos[1] || pos2[1] < this.cameraPos[1]) {
			// behind the camera
			return
		}
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

	displayVector([x, y, z]) {
		return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`
	}

	displayDegrees(angle) {
		const degrees = angle * 180 / Math.PI
		return degrees.toFixed(1) % 360
	}
}

